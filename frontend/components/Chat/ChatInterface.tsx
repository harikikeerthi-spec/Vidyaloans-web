"use client";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '@/contexts/AuthContext';
import { HttpApiPaths } from '@/lib/http-api-paths';

/** Maps the sessionStorage bank key to the full bank name stored in conversation metadata */
const BANK_NAME_MAP: Record<string, string> = {
    auxilo: "Auxilo Finserve",
    avanse: "Avanse Financial",
    credila: "HDFC Credila",
    idfc: "IDFC FIRST Bank",
    poonawalla: "Poonawalla Fincorp",
};

export function normalizeBankName(nameOrKey?: string | null): string | undefined {
    if (!nameOrKey) return undefined;
    const lower = nameOrKey.toLowerCase().trim();
    if (lower.includes('avanse')) return 'Avanse Financial';
    if (lower.includes('auxilo')) return 'Auxilo Finserve';
    if (lower.includes('credila') || lower.includes('hdfc')) return 'HDFC Credila';
    if (lower.includes('idfc')) return 'IDFC FIRST Bank';
    if (lower.includes('poonawalla')) return 'Poonawalla Fincorp';
    return nameOrKey;
}

function formatMessageGroupDate(dateStr: string) {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return 'TODAY';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'YESTERDAY';
    } else {
        return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
    }
}

function formatSidebarDate(dateStr: string) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
}

function getMetadata(c: any): any {
    if (!c || !c.metadata) return {};
    if (typeof c.metadata === 'string') {
        try { return JSON.parse(c.metadata); } catch { return {}; }
    }
    return typeof c.metadata === 'object' ? c.metadata : {};
}

function parseAttachmentMessage(content: string) {
    if (!content) return { fileName: 'Attachment', textContent: '' };
    const newlineIndex = content.indexOf('\n');
    if (newlineIndex !== -1) {
        const fileName = content.substring(0, newlineIndex).replace('[Attached File: ', '').replace(']', '').trim();
        const textContent = content.substring(newlineIndex).trim();
        return { fileName, textContent };
    }
    const fileName = content.replace('[Attached File: ', '').replace(']', '').trim();
    return { fileName, textContent: '' };
}


interface Message {
    id: string;
    conversationId: string;
    senderType: string;
    senderId: string;
    senderName?: string;
    content: string;
    messageType: string;
    status: string;
    createdAt: string;
    attachmentUrl?: string;
}

interface Conversation {
    id: string;
    customerPhone: string;
    customerName?: string;
    customerEmail?: string;
    metadata?: any;
    status: string;
    updatedAt: string;
    lastMessage?: Message;
    unreadCount?: number;
}

interface ChatInterfaceProps {
    role: 'staff' | 'bank' | 'agent'; // What dashboard is this embedded in
    initialUser?: any;
    initialBank?: { bankName: string; bankEmail?: string; applicationId?: string; applicationNumber?: string } | null;
    initialConversation?: Conversation | null;
    initialConversationId?: string;
    portalTitle?: string;
    className?: string;
    hideSidebar?: boolean;
    chatContext?: 'student' | 'staff';
    initialStudentId?: string;
    autoSendLead?: boolean;
}

interface StudentDocument {
    id: string;
    docType: string;
    name?: string;
    status?: string;
    uploaded?: boolean;
    fileName?: string;
    filePath?: string;
    uploadedAt?: string;
}


export default function ChatInterface({ role, initialUser, initialBank, initialConversation = null, initialConversationId, portalTitle, className, hideSidebar = false, chatContext = 'student', initialStudentId, autoSendLead = true }: ChatInterfaceProps) {

    const { token, user } = useAuth();
    const isMessageFromMe = (msg: Message) => {
        const currentUserId = user?.id || (user as any)?._id || (user as any)?.uid;
        const currentUserEmail = user?.email;

        // 1. Email or ID match (case-insensitive)
        if (msg.senderId) {
            const cleanSenderId = msg.senderId.toLowerCase();
            if (currentUserId && cleanSenderId === String(currentUserId).toLowerCase()) return true;
            if (currentUserEmail && cleanSenderId === currentUserEmail.toLowerCase()) return true;
        }

        // 2. Staff dashboard: match staff, admin, super_admin roles, or if user is support and message is support
        if (role === 'staff') {
            if (['staff', 'admin', 'super_admin'].includes(msg.senderType)) {
                return true;
            }
            if (user?.role === 'support' && msg.senderType === 'support') {
                return true;
            }
        }

        // 3. Bank dashboard: match bank or partner_bank roles
        if (role === 'bank') {
            if (['bank', 'partner_bank'].includes(msg.senderType)) {
                return true;
            }
        }

        // 4. Agent dashboard: match agent roles
        if (role === 'agent') {
            if (['agent', 'partner_agent'].includes(msg.senderType)) {
                return true;
            }
        }

        // 5. Fallback on exact match of role and senderType
        return msg.senderType === role || msg.senderType === user?.role;
    };
    const getFormattedAppId = (appId?: string) => {
        if (!appId) return '';
        return `APP${appId.replace(/-/g, '').slice(-10).toUpperCase()}`;
    };
    const [socket, setSocket] = useState<Socket | null>(null);
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversation, setActiveConversation] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [sidebarTab, setSidebarTab] = useState<'chats' | 'users'>('chats');
    // 'all' | 'student' | 'bank' — for staff to filter which conversation type they see
    const [chatTypeFilter, setChatTypeFilter] = useState<'all' | 'student' | 'bank'>('all');
    const [allUsers, setAllUsers] = useState<any[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [editingMessage, setEditingMessage] = useState<Message | null>(null);

    // Document panel state
    const [showDocPanel, setShowDocPanel] = useState(false);
    const [studentDocs, setStudentDocs] = useState<StudentDocument[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [docsUserId, setDocsUserId] = useState<string | null>(null);
    const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string } | null>(null);
    const [previewLoading, setPreviewLoading] = useState<string | null>(null);
    const [sharingDoc, setSharingDoc] = useState<string | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [pendingVaultDoc, setPendingVaultDoc] = useState<StudentDocument | null>(null);

    // Save Contact Name State
    const [savedNames, setSavedNames] = useState<Record<string, string>>({});
    const [showSaveNameModal, setShowSaveNameModal] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [showHeaderMenu, setShowHeaderMenu] = useState(false);

    // Load saved names from localStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const stored = JSON.parse(localStorage.getItem('chat_saved_contact_names') || '{}');
                setSavedNames(stored);
            } catch (e) {
                console.error('Failed to parse saved contact names', e);
            }
        }
    }, []);

    const getSavedNameForConv = (conv?: Conversation | null) => {
        if (!conv) return '';
        if (savedNames[conv.id]) return savedNames[conv.id];
        if (conv.customerPhone && savedNames[conv.customerPhone]) return savedNames[conv.customerPhone];
        const cleanPhone = conv.customerPhone ? conv.customerPhone.replace(/\D/g, '') : '';
        if (cleanPhone && savedNames[cleanPhone]) return savedNames[cleanPhone];
        if (conv.customerName) return conv.customerName;
        return '';
    };

    const getConversationDisplayName = (conv: Conversation) => {
        const saved = getSavedNameForConv(conv);
        if (saved) return saved;
        if (role === 'bank' && conv.metadata?.applicationId) {
            return conv.metadata.applicationNumber || getFormattedAppId(conv.metadata.applicationId);
        }
        return conv.customerPhone || conv.customerEmail || "Chat Contact";
    };

    const handleSaveContactNameSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const activeConv = conversations.find(c => c.id === activeConversation);
        if (!activeConv || !nameInput.trim()) return;
        const newName = nameInput.trim();
        setSavingName(true);

        try {
            // Update local storage & state immediately
            const updatedSaved = {
                ...savedNames,
                [activeConv.id]: newName,
            };
            if (activeConv.customerPhone) {
                updatedSaved[activeConv.customerPhone] = newName;
                const clean = activeConv.customerPhone.replace(/\D/g, '');
                if (clean) updatedSaved[clean] = newName;
            }
            setSavedNames(updatedSaved);
            if (typeof window !== 'undefined') {
                localStorage.setItem('chat_saved_contact_names', JSON.stringify(updatedSaved));
            }

            // Update conversation list state
            setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, customerName: newName } : c));

            // Call backend API to update conversation in DB if token exists
            if (token) {
                await fetch(HttpApiPaths.chat.saveName(activeConv.id), {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ name: newName })
                }).catch(() => { });
            }

            setShowSaveNameModal(false);
            setNameInput('');
        } catch (err: any) {
            console.error("Failed to save contact name", err);
        } finally {
            setSavingName(false);
        }
    };

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const activeConversationRef = useRef<string | null>(null);
    const hasStartedInitialStudent = useRef(false);
    const hasStartedInitialBank = useRef<string | null>(null);

    // Sync ref with state
    useEffect(() => {
        activeConversationRef.current = activeConversation;
    }, [activeConversation]);

    // Handle initialConversation from props
    useEffect(() => {
        if (initialConversation) {
            setConversations(prev => {
                if (prev.find(c => c.id === initialConversation.id)) return prev;
                return [initialConversation, ...prev];
            });
            setActiveConversation(initialConversation.id);
        }
    }, [initialConversation]);

    useEffect(() => {
        setPendingFile(null);
        setPendingVaultDoc(null);
    }, [activeConversation]);

    // Resolve the full bank name for the current bank session
    const resolvedBankName = useMemo(() => {
        if (role !== 'bank') return undefined;
        // 1. Try initialBank.bankName from props
        if (initialBank?.bankName) {
            const norm = normalizeBankName(initialBank.bankName);
            if (norm) return norm;
        }
        // 2. Try window URL query param ?bank= or ?bankName=
        if (typeof window !== 'undefined') {
            const sp = new URLSearchParams(window.location.search);
            const urlBank = sp.get('bank') || sp.get('bankName');
            if (urlBank) {
                const norm = normalizeBankName(urlBank);
                if (norm) return norm;
            }
        }
        // 3. Try user.bankName or user.bank
        const userBank = user?.bankName || (user as any)?.bank;
        if (userBank) {
            const norm = normalizeBankName(userBank);
            if (norm) return norm;
        }
        // 4. Try sessionStorage/localStorage
        if (typeof window !== 'undefined') {
            const storedName = sessionStorage.getItem('selectedBankName') || localStorage.getItem('selectedBankName');
            if (storedName) {
                const norm = normalizeBankName(storedName);
                if (norm) return norm;
            }
            const storedKey = sessionStorage.getItem('selectedBank') || localStorage.getItem('selectedBank');
            if (storedKey) {
                const norm = normalizeBankName(storedKey);
                if (norm) return norm;
            }
        }
        // 5. If user is bank representative whose firstName contains bank name
        if (user?.role === 'bank' || (user as any)?.role === 'partner_bank') {
            if (user?.firstName) {
                const norm = normalizeBankName(user.firstName);
                if (norm && norm !== user.firstName) return norm;
            }
        }
        return undefined;
    }, [role, user, initialBank?.bankName]);

    const fetchConversations = async () => {
        try {
            const res = await fetch(HttpApiPaths.chat.conversations(role, resolvedBankName), {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data: Conversation[] = await res.json();
            if (Array.isArray(data)) {
                setConversations(prev => {
                    const map = new Map<string, Conversation>();
                    data.forEach(c => map.set(c.id, c));
                    prev.forEach(c => {
                        if (!map.has(c.id)) map.set(c.id, c);
                    });
                    return Array.from(map.values());
                });
            }
        } catch (e) {
            console.error("Failed to load conversations", e);
        }
    };

    const fetchUsers = async () => {
        if (role !== 'staff' && role !== 'agent') return;
        setLoadingUsers(true);
        try {
            const res = await fetch(HttpApiPaths.admin.usersList(30, 0), {
                headers: { Authorization: `Bearer ${token}` }
            });
            const responseData = await res.json();
            if (responseData.success && Array.isArray(responseData.data)) {
                setAllUsers(responseData.data);
            } else if (Array.isArray(responseData)) {
                setAllUsers(responseData);
            }
        } catch (e) {
            console.error("Failed to load users", e);
        } finally {
            setLoadingUsers(false);
        }
    };

    // Refetch conversations when bank name is resolved
    useEffect(() => {
        if (token) {
            fetchConversations();
        }
    }, [resolvedBankName, token]);

    // Initialize Socket Connection
    useEffect(() => {
        if (!token) return;

        fetchConversations();
        if (role === 'staff') fetchUsers();

        const baseApiUrl = typeof window !== 'undefined' && (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
            ? 'http://localhost:5000'
            : (process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'));
        const socketUrl = baseApiUrl.endsWith('/api')
            ? baseApiUrl.replace('/api', '/chat')
            : `${baseApiUrl.replace(/\/$/, '')}/chat`;

        const socketInstance = io(socketUrl, {
            auth: { token }
        });

        socketInstance.on('connect', () => {
            console.log(`Connected to chat socket as ${role}`);
            fetchConversations();
        });

        const pollInterval = setInterval(() => {
            fetchConversations();
        }, 10000);

        socketInstance.on('user_activity', (data: any) => {
            console.log("Activity detected:", data);
            fetchConversations();
        });

        socketInstance.on('conversation_updated', (data: { conversationId: string, lastMessage?: Message }) => {
            setConversations(prev => {
                const exists = prev.find(c => c.id === data.conversationId);
                if (exists) {
                    const updated = prev.filter(c => c.id !== data.conversationId);
                    return [{
                        ...exists,
                        lastMessage: data.lastMessage !== undefined ? data.lastMessage : exists.lastMessage,
                        updatedAt: (data.lastMessage && data.lastMessage.createdAt) ? data.lastMessage.createdAt : exists.updatedAt
                    }, ...updated];
                } else {
                    fetchConversations();
                    return prev;
                }
            });
        });

        socketInstance.on('new_message', (msg: Message) => {
            if (msg.conversationId === activeConversationRef.current) {
                setMessages(prev => {
                    if (prev.find(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
                if (!isMessageFromMe(msg)) {
                    socketInstance.emit('mark_read', { conversationId: msg.conversationId });
                }
            }
            setConversations(prev => {
                const exists = prev.find(c => c.id === msg.conversationId);
                if (exists) {
                    const updated = prev.filter(c => c.id !== msg.conversationId);
                    let newUnreadCount = exists.unreadCount || 0;
                    if (msg.conversationId !== activeConversationRef.current && !isMessageFromMe(msg)) {
                        newUnreadCount += 1;
                    }
                    return [{ ...exists, lastMessage: msg, updatedAt: msg.createdAt, unreadCount: newUnreadCount }, ...updated];
                }
                return prev;
            });
        });

        socketInstance.on('message_updated', (msg: Message) => {
            if (msg.conversationId === activeConversationRef.current) {
                setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
            }
            setConversations(prev => {
                const exists = prev.find(c => c.id === msg.conversationId);
                if (exists && exists.lastMessage?.id === msg.id) {
                    const updated = prev.filter(c => c.id !== msg.conversationId);
                    return [{ ...exists, lastMessage: msg, updatedAt: msg.createdAt }, ...updated];
                }
                return prev;
            });
        });

        socketInstance.on('message_deleted', (payload: { conversationId: string, messageId: string }) => {
            if (payload.conversationId === activeConversationRef.current) {
                setMessages(prev => prev.filter(m => m.id !== payload.messageId));
            }
            fetchConversations();
        });

        socketInstance.on('messages_read', (data: { conversationId: string, readerType: string, readerId?: string }) => {
            // readerType tells us WHO read the messages:
            // 'customer' → customer read the messages, so mark staff/bank-sent messages as 'read'
            // 'staff_or_bank' → staff/bank read the messages, so mark customer-sent messages as 'read'
            const markAsRead = (msg: Message): Message => {
                if (data.readerType === 'customer') {
                    // Customer read → mark messages NOT sent by customer as 'read'
                    if (msg.senderType !== 'customer') return { ...msg, status: 'read' };
                } else if (data.readerType === 'staff_or_bank') {
                    if (data.readerId) {
                        const isBankReader = data.readerId.toLowerCase().includes('bank') || data.readerId.toLowerCase().includes('partner');
                        if (isBankReader) {
                            // Bank read the messages → mark all non-bank messages as read (e.g. staff messages)
                            if (msg.senderType !== 'bank' && msg.senderType !== 'partner_bank') {
                                return { ...msg, status: 'read' };
                            }
                        } else {
                            // Staff/agent read the messages → mark all non-staff messages as read (e.g. bank messages)
                            if (msg.senderType !== 'staff' && msg.senderType !== 'admin' && msg.senderType !== 'super_admin' && msg.senderType !== 'agent') {
                                return { ...msg, status: 'read' };
                            }
                        }
                    } else {
                        // Fallback: mark customer messages as read
                        if (msg.senderType === 'customer') return { ...msg, status: 'read' };
                    }
                }
                return msg;
            };

            if (data.conversationId === activeConversationRef.current) {
                setMessages(prev => prev.map(markAsRead));
            }
            setConversations(prev => prev.map(c => {
                if (c.id === data.conversationId) {
                    const updatedLastMessage = c.lastMessage ? markAsRead(c.lastMessage) : undefined;
                    let newUnreadCount = c.unreadCount || 0;
                    if (data.readerId) {
                        const isBankReader = data.readerId.toLowerCase().includes('bank') || data.readerId.toLowerCase().includes('partner');
                        const isStaffReader = data.readerId.toLowerCase().includes('staff') || data.readerId.toLowerCase().includes('agent') || data.readerId.includes('@');

                        if (role === 'bank' && isBankReader) {
                            newUnreadCount = 0;
                        } else if ((role === 'staff' || role === 'agent') && isStaffReader) {
                            newUnreadCount = 0;
                        }
                    }
                    return { ...c, lastMessage: updatedLastMessage, unreadCount: newUnreadCount };
                }
                return c;
            }));
        });

        setSocket(socketInstance);

        return () => {
            clearInterval(pollInterval);
            socketInstance.disconnect();
        };
    }, [token, role]);

    // Handle initialStudentId for agent-to-staff chat
    useEffect(() => {
        if (initialStudentId && token && !hasStartedInitialStudent.current) {
            hasStartedInitialStudent.current = true;

            const startAgentStaffChat = async () => {
                try {
                    const res = await fetch(HttpApiPaths.chat.agentStaffStart(), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            studentId: initialStudentId,
                            sendLead: autoSendLead
                        })
                    });
                    const data = await res.json();
                    if (data.success && data.conversation) {
                        setConversations(prev => {
                            if (prev.some(c => c.id === data.conversation.id)) return prev;
                            return [data.conversation, ...prev];
                        });
                        setActiveConversation(data.conversation.id);

                        // Clear parameters from URL
                        if (typeof window !== 'undefined') {
                            const newParams = new URLSearchParams(window.location.search);
                            newParams.delete('studentId');
                            newParams.delete('sendLead');
                            const newQuery = newParams.toString();
                            const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : '');
                            window.history.replaceState({}, '', newUrl);
                        }
                    }
                } catch (e) {
                    console.error("Failed to start agent staff chat", e);
                }
            };

            startAgentStaffChat();
        }
    }, [initialStudentId, token, autoSendLead]);

    // Auto-select conversation if initialConversationId or conversationId URL query is present
    useEffect(() => {
        const queryConvId = initialConversationId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('conversationId') : null);
        if (!queryConvId) return;

        // Set active conversation immediately
        setActiveConversation(queryConvId);

        // Find matching conversation in current list
        const existing = conversations.find(c => c.id === queryConvId);
        if (existing) {
            if (existing.metadata?.type === 'bank') setChatTypeFilter('bank');
            else if (existing.metadata?.type === 'customer') setChatTypeFilter('student');
        } else if (token) {
            // Fetch targeted single conversation if not present in current list
            fetch(HttpApiPaths.chat.singleConversation(queryConvId), {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    const conv = data?.conversation || data;
                    if (conv && conv.id) {
                        setConversations(prev => {
                            if (prev.some(c => c.id === conv.id)) return prev;
                            return [conv, ...prev];
                        });
                        if (conv.metadata?.type === 'bank') setChatTypeFilter('bank');
                        else if (conv.metadata?.type === 'customer') setChatTypeFilter('student');
                    }
                })
                .catch(e => console.error("Could not load targeted conversation", e));
        }

        // Clear conversationId from URL query to avoid sticking
        if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('conversationId')) {
            const newParams = new URLSearchParams(window.location.search);
            newParams.delete('conversationId');
            const newQuery = newParams.toString();
            const newUrl = window.location.pathname + (newQuery ? `?${newQuery}` : '');
            window.history.replaceState({}, '', newUrl);
        }
    }, [initialConversationId, conversations.length, token]);

    // Handle active conversation change
    useEffect(() => {
        if (activeConversation && token) {
            if (socket) {
                socket.emit('join_conversation', activeConversation);
                socket.emit('mark_read', { conversationId: activeConversation });
            }

            setConversations(prev => prev.map(c =>
                c.id === activeConversation ? { ...c, unreadCount: 0 } : c
            ));

            fetch(HttpApiPaths.chat.messages(activeConversation), {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) setMessages(data);
                    scrollToBottom();
                }).catch(e => console.error("Could not load messages."));

            return () => {
                if (socket) {
                    socket.emit('leave_conversation', activeConversation);
                }
            };
        }
    }, [socket, activeConversation, token]);

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    };

    const [uploading, setUploading] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingFile(file);
        setPendingVaultDoc(null);
        e.target.value = '';
    };

    const handleStartEdit = (msg: Message) => {
        if (msg.messageType && msg.messageType !== 'text') {
            alert('Only text messages can be edited.');
            return;
        }
        setEditingMessage(msg);
        setInputText(msg.content);
    };

    const handleCancelEdit = () => {
        setEditingMessage(null);
        setInputText('');
    };

    const handleDeleteMessage = async (messageId: string) => {
        if (!confirm('Are you sure you want to delete this message?')) return;
        try {
            const res = await fetch(`/api/chat/messages/${messageId}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setMessages(prev => prev.filter(m => m.id !== messageId));
                fetchConversations();
            } else {
                alert(data.error || 'Failed to delete message');
            }
        } catch (err) {
            console.error('Delete message error:', err);
            alert('Failed to delete message');
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeConversation) return;

        if (editingMessage) {
            if (!inputText.trim()) return;
            try {
                const res = await fetch(`/api/chat/messages/${editingMessage.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ content: inputText })
                });
                const data = await res.json();
                if (data.success && data.message) {
                    setMessages(prev => prev.map(m => m.id === editingMessage.id ? data.message : m));
                    setEditingMessage(null);
                    setInputText('');
                    fetchConversations();
                } else {
                    alert(data.error || 'Failed to edit message');
                }
            } catch (err) {
                console.error('Edit message error:', err);
                alert('Failed to edit message');
            }
            return;
        }

        const conv = conversations.find(c => c.id === activeConversation);
        const hasText = !!inputText.trim();

        // 1. Process pending local file upload
        if (pendingFile) {
            setUploading(true);
            const formData = new FormData();
            formData.append('file', pendingFile);
            formData.append('conversationId', activeConversation);

            try {
                const res = await fetch(`/api/chat/upload`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`
                    },
                    body: formData
                });
                const data = await res.json();
                if (data.success && data.message) {
                    setMessages(prev => {
                        if (prev.find(m => m.id === data.message.id)) return prev;
                        return [...prev, data.message];
                    });
                    setConversations(prev => prev.map(c =>
                        c.id === activeConversation
                            ? { ...c, lastMessage: data.message, updatedAt: data.message.createdAt }
                            : c
                    ));
                } else if (!data.success) {
                    alert(data.message || data.error || 'Upload failed');
                    setUploading(false);
                    return; // Stop if upload failed
                }
            } catch (err) {
                console.error('Upload error:', err);
                alert('An error occurred during upload');
                setUploading(false);
                return; // Stop if upload failed
            } finally {
                setUploading(false);
                setPendingFile(null);
            }
        }

        // 2. Process pending vault document sharing
        if (pendingVaultDoc) {
            if (!pendingVaultDoc.filePath) {
                alert("This document does not have a valid file path associated.");
                return;
            }
            setSharingDoc(pendingVaultDoc.id);
            try {
                const res = await fetch(`/api/chat/share-document`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        conversationId: activeConversation,
                        fileName: pendingVaultDoc.fileName || pendingVaultDoc.name || pendingVaultDoc.docType,
                        filePath: pendingVaultDoc.filePath,
                        mimeType: (pendingVaultDoc.fileName || pendingVaultDoc.name || pendingVaultDoc.docType)?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
                    })
                });

                const data = await res.json();
                if (data.success && data.message) {
                    setMessages(prev => {
                        if (prev.find(m => m.id === data.message.id)) return prev;
                        return [...prev, data.message];
                    });
                    setConversations(prev => prev.map(c =>
                        c.id === activeConversation
                            ? { ...c, lastMessage: data.message, updatedAt: data.message.createdAt }
                            : c
                    ));
                } else if (!data.success) {
                    alert(data.message || 'Failed to share document');
                    setSharingDoc(null);
                    return; // Stop if share failed
                }
            } catch (e) {
                console.error("Failed to share document:", e);
                alert("An error occurred while sharing the document.");
                setSharingDoc(null);
                return; // Stop if share failed
            } finally {
                setSharingDoc(null);
                setPendingVaultDoc(null);
            }
        }

        // 3. Process text message if any
        if (hasText && socket) {
            socket.emit('send_message', {
                conversationId: activeConversation,
                customerPhone: conv?.customerPhone,
                content: inputText
            });
            setInputText('');
        }
    };

    const startNewChat = async (targetUser: any) => {
        let phone = targetUser.phoneNumber || targetUser.phone || targetUser.mobile;
        if (!phone) {
            if (targetUser.id || targetUser._id) {
                phone = `USR_${targetUser.id || targetUser._id}`;
            } else if (targetUser.email) {
                phone = `USR_${targetUser.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
            }
        }
        if (!phone) {
            alert("This user does not have a phone or email registered.");
            return;
        }

        const doFetch = async (retried = false): Promise<any> => {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            };
            try {
                const csrfRes = await fetch('/api/csrf-token');
                const csrfData = await csrfRes.json();
                if (csrfData?.csrfToken) headers['X-CSRF-Token'] = csrfData.csrfToken;
            } catch {}

            const res = await fetch(HttpApiPaths.chat.staffStart(), {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    customerPhone: phone,
                    customerEmail: targetUser.email,
                    customerName: `${targetUser.firstName || ''} ${targetUser.lastName || ''}`.trim(),
                    type: (role as string) === 'bank' || (role as string) === 'partner_bank' ? 'bank' : 'staff',
                    bank: role === 'bank' ? (user?.firstName || '') : undefined,
                    applicationId: targetUser.applicationId,
                    applicationNumber: targetUser.applicationNumber
                })
            });
            if (res.status === 403 && !retried) {
                return doFetch(true);
            }
            return res.json();
        };

        try {
            const data = await doFetch();
            if (data.success && data.conversation) {
                setSidebarTab('chats');
                setChatTypeFilter('all');
                setConversations(prev => {
                    const idx = prev.findIndex(c => c.id === data.conversation.id);
                    if (idx >= 0) {
                        const copy = [...prev];
                        copy[idx] = data.conversation;
                        return copy;
                    }
                    return [data.conversation, ...prev];
                });
                setActiveConversation(data.conversation.id);
                fetchConversations();
            } else {
                console.error("startNewChat response not successful:", data);
            }
        } catch (e) {
            console.error("Failed to start chat", e);
        }
    };

    const startBankChat = async (bankInfo: { bankName: string; bankEmail?: string; applicationId?: string; applicationNumber?: string }) => {
        if (role === 'agent') {
            console.warn("Agents are not allowed to chat with banks directly.");
            return;
        }
        const doFetch = async (retried = false): Promise<any> => {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            };
            // Try to include CSRF token if available
            try {
                const csrfRes = await fetch('/api/csrf-token');
                const csrfData = await csrfRes.json();
                if (csrfData?.csrfToken) headers['X-CSRF-Token'] = csrfData.csrfToken;
            } catch {}

            const res = await fetch(HttpApiPaths.chat.bankStart(), {
                method: 'POST',
                headers,
                body: JSON.stringify(bankInfo)
            });
            if (res.status === 403 && !retried) {
                console.warn("bank-start got 403, retrying with fresh CSRF token...");
                return doFetch(true);
            }
            return res.json();
        };
        try {
            const data = await doFetch();
            if (data.success && data.conversation) {
                setSidebarTab('chats');
                setChatTypeFilter('bank');
                setConversations(prev => {
                    const idx = prev.findIndex(c => c.id === data.conversation.id);
                    if (idx >= 0) {
                        const copy = [...prev];
                        copy[idx] = data.conversation;
                        return copy;
                    }
                    return [data.conversation, ...prev];
                });
                setActiveConversation(data.conversation.id);
                fetchConversations();
            } else {
                console.error("startBankChat response not successful:", data);
            }
        } catch (e) {
            console.error("Failed to start bank chat", e);
        }
    }

    const hasStartedInitialUser = useRef<string | null>(null);

    // Handle initialUser from props
    useEffect(() => {
        if (!initialUser || !token) return;
        const userKey = `${initialUser.id || ''}_${initialUser.email || ''}_${initialUser.phone || initialUser.phoneNumber || ''}`;
        if (hasStartedInitialUser.current === userKey) return;
        hasStartedInitialUser.current = userKey;
        startNewChat(initialUser);
    }, [initialUser, token]);

    // Handle initialBank from props
    useEffect(() => {
        if (initialBank && token && role !== 'agent' && hasStartedInitialBank.current !== `${initialBank.bankName}_${initialBank.applicationId}`) {
            hasStartedInitialBank.current = `${initialBank.bankName}_${initialBank.applicationId}`;
            startBankChat(initialBank);
        }
    }, [initialBank?.applicationId, initialBank?.bankName, token, role]);

    // Auto-select conversation matching applicationId
    useEffect(() => {
        const appId = initialBank?.applicationId || (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('applicationId') : null);
        if (!appId || conversations.length === 0) return;

        const match = conversations.find(c => {
            const meta = getMetadata(c);
            return meta.applicationId === appId || c.id === appId;
        });
        if (match && activeConversation !== match.id) {
            setSidebarTab('chats');
            const meta = getMetadata(match);
            if (meta.type === 'bank') setChatTypeFilter('bank');
            setActiveConversation(match.id);
        }
    }, [conversations, initialBank?.applicationId, activeConversation]);

    // Fetch student documents for the active conversation
    const openStudentDocuments = async () => {
        const conv = conversations.find(c => c.id === activeConversation);
        if (!conv) return;

        // Try to find if there is an applicationId in conversation metadata
        const appId = conv.metadata?.applicationId;

        if (role === 'bank' || appId) {
            if (!appId) {
                alert("This conversation does not have a linked loan application.");
                return;
            }
            setLoadingDocs(true);
            setShowDocPanel(true);
            try {
                // For bank role, we use bankApi.getDocuments. For staff role, we fetch applications/admin/...
                const res = role === 'bank'
                    ? await fetch(`/api/bank/documents/${appId}`, { headers: { Authorization: `Bearer ${token}` } })
                    : await fetch(`/api/applications/admin/${appId}/documents`, { headers: { Authorization: `Bearer ${token}` } });
                const data = await res.json();
                const docsList = data.success && Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);

                // Map application documents to StudentDocument format
                const mappedDocs = docsList.map((d: any) => ({
                    id: d.id,
                    docType: d.docType,
                    name: d.docName || d.name || d.docType,
                    status: d.status,
                    uploaded: d.uploaded !== false,
                    fileName: d.fileName,
                    filePath: d.filePath,
                    uploadedAt: d.uploadedAt
                }));

                setStudentDocs(mappedDocs);
                setDocsUserId(conv.metadata?.userId || null);
            } catch (e) {
                console.error("Failed to load application documents:", e);
                setStudentDocs([]);
            } finally {
                setLoadingDocs(false);
            }
            return;
        }

        // Try to find userId from conversation metadata or email match
        const customerEmail = conv.customerEmail || conv.metadata?.customerEmail;
        let userId: string | null = null;

        // Look up userId from the users list
        if (customerEmail && allUsers.length > 0) {
            const match = allUsers.find((u: any) => u.email?.toLowerCase() === customerEmail?.toLowerCase());
            if (match) userId = match.id || (match as any)._id || (match as any).uid;
        }

        // If not found from users list, try via API
        if (!userId && customerEmail) {
            try {
                const res = await fetch(`/api/users/admin/list?search=${encodeURIComponent(customerEmail)}&limit=1`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                const found = data?.data?.[0] || data?.[0];
                if (found) userId = found.id || (found as any)._id || (found as any).uid;
            } catch (_) { /* ignore */ }
        }

        setDocsUserId(userId);
        setShowDocPanel(true);

        if (!userId) {
            setStudentDocs([]);
            return;
        }

        setLoadingDocs(true);
        try {
            const res = await fetch(HttpApiPaths.documents.byUserId(userId), {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            const docs: StudentDocument[] = (data?.data || data || []).filter(
                (d: StudentDocument) => d.uploaded || ['uploaded', 'verified', 'approved'].includes(String(d.status || '').toLowerCase())
            );
            setStudentDocs(docs);
        } catch (e) {
            console.error("Failed to load student documents:", e);
            setStudentDocs([]);
        } finally {
            setLoadingDocs(false);
        }
    };

    const handleShareDocument = async (doc: StudentDocument) => {
        if (!activeConversation) return;
        if (!doc.filePath) {
            alert("This document does not have a valid file path associated.");
            return;
        }
        setSharingDoc(doc.id);
        try {
            const res = await fetch(`/api/chat/share-document`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    conversationId: activeConversation,
                    fileName: doc.fileName || doc.name || doc.docType,
                    filePath: doc.filePath,
                    mimeType: (doc.fileName || doc.name || doc.docType)?.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
                })
            });

            const data = await res.json();
            if (data.success && data.message) {
                // Immediately add shared document to local message state
                setMessages(prev => {
                    if (prev.find(m => m.id === data.message.id)) return prev;
                    return [...prev, data.message];
                });
                setConversations(prev => prev.map(c =>
                    c.id === activeConversation
                        ? { ...c, lastMessage: data.message, updatedAt: data.message.createdAt }
                        : c
                ));
            } else if (!data.success) {
                alert(data.message || 'Failed to share document');
            }
        } catch (e) {
            console.error("Failed to share document:", e);
            alert("An error occurred while sharing the document.");
        } finally {
            setSharingDoc(null);
        }
    };

    const handleViewDocument = async (doc: StudentDocument) => {
        const conv = conversations.find(c => c.id === activeConversation);
        const appId = conv?.metadata?.applicationId;

        if (appId) {
            const cleanDocId = doc.id.replace('vault_', '');
            const url = `/api/applications/admin/${appId}/documents/${cleanDocId}/view?token=${token}`;
            setPreviewDoc({ url, name: (doc.name || doc.docType).toUpperCase().replace(/_/g, ' ') });
            return;
        }

        if (!docsUserId) return;
        setPreviewLoading(doc.docType);
        try {
            const res = await fetch(HttpApiPaths.documents.presignedView(docsUserId, doc.docType), {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.url) {
                    setPreviewDoc({ url: data.url, name: (doc.name || doc.docType).toUpperCase().replace(/_/g, ' ') });
                    return;
                }
            }
        } catch (_) { /* fallback */ }
        // Fallback stream URL
        setPreviewDoc({
            url: HttpApiPaths.documents.streamView(docsUserId, doc.docType),
            name: (doc.name || doc.docType).toUpperCase().replace(/_/g, ' ')
        });
        setPreviewLoading(null);
    };

    const handleDownloadDocument = async (doc: StudentDocument) => {
        const conv = conversations.find(c => c.id === activeConversation);
        const appId = conv?.metadata?.applicationId;

        if (appId) {
            const cleanDocId = doc.id.replace('vault_', '');
            window.open(`/api/applications/admin/${appId}/documents/${cleanDocId}/view?download=true&token=${token}`, '_blank', 'noopener,noreferrer');
            return;
        }

        if (!docsUserId) return;
        try {
            const res = await fetch(HttpApiPaths.documents.presignedView(docsUserId, doc.docType), {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.url) {
                    const link = document.createElement('a');
                    link.href = data.url;
                    link.download = `${(doc.name || doc.docType).replace(/\s+/g, '_')}.pdf`;
                    link.target = '_blank';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    return;
                }
            }
        } catch (_) { /* fallback */ }
        window.open(HttpApiPaths.documents.streamView(docsUserId, doc.docType), '_blank', 'noopener,noreferrer');
    };

    const getDocStatusColor = (status?: string, uploaded?: boolean) => {
        const s = String(status || '').toLowerCase();
        if (s === 'verified' || s === 'approved') return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'Verified' };
        if (s === 'rejected') return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-500', label: 'Rejected' };
        if (uploaded || s === 'uploaded') return { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500', label: 'Uploaded' };
        return { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', dot: 'bg-slate-400', label: 'Pending' };
    };

    const filteredConversations = conversations.filter(c => {
        const matchesSearch = (c.customerName || c.customerPhone || '').toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesSearch) return false;
        if (role === 'bank') {
            // Extra client-side safety: show bank-type conversations matching this bank
            if (c.metadata?.type !== 'bank') return false;
            if (resolvedBankName) {
                const convBank = normalizeBankName(c.metadata?.bank);
                const targetBank = normalizeBankName(resolvedBankName);
                if (convBank && targetBank && convBank !== targetBank) return false;
            }
            return true;
        }
        if (role === 'agent') {
            if (chatContext === 'staff') {
                return c.metadata?.type === 'agent_to_staff';
            } else {
                return c.metadata?.type === 'agent' || !c.metadata?.type;
            }
        }
        if (role !== 'staff') return true;
        if (chatTypeFilter === 'bank') return c.metadata?.type === 'bank';
        if (chatTypeFilter === 'student') return c.metadata?.type !== 'bank';
        return true; // 'all'
    });

    // In bank portal, auto-select the first conversation if none is active
    useEffect(() => {
        if (role === 'bank' && !activeConversation && filteredConversations.length > 0) {
            setActiveConversation(filteredConversations[0].id);
        }
    }, [role, activeConversation, filteredConversations]);

    const filteredUsers = allUsers.filter(u =>
        u.role !== 'admin' && u.role !== 'staff' && u.role !== 'agent' &&
        (role !== 'agent' || u.role !== 'bank') &&
        (`${u.firstName} ${u.lastName} ${u.email} ${u.phoneNumber}`).toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={(className || "flex h-[800px] border border-[#E2E8F0] rounded-[2.5rem] overflow-hidden bg-[#FFFFFF] shadow-[0_24px_80px_rgba(90,66,228,0.06)] mt-6 animate-fade-in text-[#1A1D20]") + " font-sans"}>

            {/* Sidebar: Conversations & Users */}
            {!hideSidebar && (
                <div className="w-96 shrink-0 border-r border-[#E2E8F0] bg-[#F8F9FC] flex flex-col h-full overflow-hidden">
                    <div className="p-6 border-b border-[#E2E8F0] bg-[#FFFFFF]">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg text-[#1A1D20] tracking-tight">{portalTitle || 'Conversations'}</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setSidebarTab('chats')}
                                    className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${sidebarTab === 'chats' ? 'bg-[#5A42E4] text-[#FFFFFF] shadow-md shadow-[#5A42E4]/25' : 'bg-[#FFFFFF] text-[#4A525A] hover:bg-[#F2F0FF] hover:text-[#5A42E4] border border-[#E2E8F0]'}`}
                                >
                                    <span className="material-symbols-outlined text-sm font-bold">forum</span>
                                </button>
                                {(role === 'staff' || role === 'agent') && (
                                    <button
                                        onClick={() => setSidebarTab('users')}
                                        className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${sidebarTab === 'users' ? 'bg-[#5A42E4] text-[#FFFFFF] shadow-md shadow-[#5A42E4]/25' : 'bg-[#FFFFFF] text-[#4A525A] hover:bg-[#F2F0FF] hover:text-[#5A42E4] border border-[#E2E8F0]'}`}
                                    >
                                        <span className="material-symbols-outlined text-sm font-bold">person_add</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Student / Bank filter tabs — only for staff when in chats tab */}
                        {role === 'staff' && sidebarTab === 'chats' && (
                            <div className="flex gap-1 mb-4 p-1 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl">
                                {(['all', 'student', 'bank'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setChatTypeFilter(type)}
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${chatTypeFilter === type
                                            ? 'bg-[#5A42E4] text-[#FFFFFF] shadow-sm'
                                            : 'text-[#4A525A] hover:bg-[#F2F0FF] hover:text-[#5A42E4]'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined text-[13px]">
                                            {type === 'bank' ? 'account_balance' : type === 'student' ? 'school' : 'all_inclusive'}
                                        </span>
                                        {type === 'all' ? 'ALL' : type === 'student' ? 'STUDENTS' : 'BANKS'}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[#8A94A6] text-lg font-medium">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={sidebarTab === 'chats' ? "Search conversations..." : "Search students..."}
                                className="w-full pl-11 pr-4 py-2.5 bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl text-xs font-semibold placeholder-[#8A94A6] focus:outline-none focus:bg-[#FFFFFF] focus:border-[#5A42E4] focus:ring-4 focus:ring-[#5A42E4]/10 transition-all text-[#1A1D20] shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1 bg-[#F8F9FC] py-2">
                        {sidebarTab === 'chats' ? (
                            filteredConversations.length === 0 ? (
                                <div className="p-10 text-center opacity-50">
                                    <div className="w-14 h-14 rounded-2xl bg-[#FFFFFF] flex items-center justify-center mx-auto mb-3 border border-[#E2E8F0] shadow-sm">
                                        <span className="material-symbols-outlined text-2xl text-[#8A94A6]">sensors_off</span>
                                    </div>
                                    <p className="text-xs font-semibold text-[#4A525A]">No active conversations</p>
                                </div>
                            ) : (
                                filteredConversations.map(conv => {
                                    const isBank = conv.metadata?.type === 'bank';
                                    const activeStyle = activeConversation === conv.id;
                                    const unreadCountVal = conv.unreadCount || 0;
                                    const isUnread = unreadCountVal > 0;
                                    return (
                                        <div
                                            key={conv.id}
                                            onClick={() => { setActiveConversation(conv.id); setShowDocPanel(false); }}
                                            className={`px-5 py-4 cursor-pointer transition-all duration-200 relative flex flex-col border-b border-[#F1F5F9] border-l-4 ${activeStyle ? 'bg-[#F2F0FF] border-l-[#5A42E4]' : 'bg-[#FFFFFF] hover:bg-[#F8F9FC] border-l-transparent'}`}
                                        >
                                            <div className="flex justify-between items-start mb-1.5">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${activeStyle
                                                        ? 'bg-[#5A42E4] text-[#FFFFFF] shadow-sm'
                                                        : isBank
                                                            ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                                            : 'bg-[#F2F0FF] text-[#5A42E4] border border-[#E2E8F0]'
                                                        }`}>
                                                        {role === 'bank' && conv.metadata?.applicationId
                                                            ? 'A'
                                                            : (isBank
                                                                ? <span className="material-symbols-outlined text-[15px]">account_balance</span>
                                                                : (conv.customerName || conv.customerPhone)?.substring(0, 1)
                                                            )
                                                        }
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="font-bold text-xs text-[#1A1D20] truncate block tracking-tight">
                                                            {getConversationDisplayName(conv)}
                                                        </span>
                                                        <div className="flex items-center gap-1 mt-0.5">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${isBank ? 'bg-amber-500' : 'bg-[#10B981]'}`}></span>
                                                            <span className="text-[9px] font-semibold text-[#8A94A6] block truncate">
                                                                {isBank ? `Bank Channel` : 'Online'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="text-[9.5px] font-semibold text-[#8A94A6] shrink-0">
                                                    {conv.updatedAt ? formatSidebarDate(conv.updatedAt) : ''}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between gap-2 mt-1 pl-0.5">
                                                <div className={`text-[11px] truncate flex items-center gap-1 flex-1 ${isUnread ? 'font-bold text-[#1A1D20]' : 'font-medium text-[#4A525A]'}`}>
                                                    {conv.lastMessage && isMessageFromMe(conv.lastMessage) && (
                                                        <span className="inline-flex items-center shrink-0">
                                                            {conv.lastMessage.status === 'read' ? (
                                                                <span className="material-symbols-outlined text-[13px] text-[#10B981] font-bold leading-none">done_all</span>
                                                            ) : conv.lastMessage.status === 'delivered' ? (
                                                                <span className="material-symbols-outlined text-[13px] text-[#8A94A6] font-bold leading-none">done_all</span>
                                                            ) : (
                                                                <span className="material-symbols-outlined text-[13px] text-[#8A94A6] font-medium leading-none">done</span>
                                                            )}
                                                        </span>
                                                    )}
                                                    <span className="truncate">
                                                        {conv.lastMessage
                                                            ? (conv.lastMessage.attachmentUrl
                                                                ? `📎 ${parseAttachmentMessage(conv.lastMessage.content).fileName}`
                                                                : conv.lastMessage.content)
                                                            : 'Starting conversation...'}
                                                    </span>
                                                </div>

                                                {conv.metadata?.applicationNumber && (
                                                    <span className="px-1.5 py-0.5 bg-[#F2F0FF] text-[#5A42E4] text-[8.5px] font-mono font-bold rounded border border-[#E2E8F0] whitespace-nowrap shrink-0">
                                                        #{conv.metadata.applicationNumber}
                                                    </span>
                                                )}
                                            </div>

                                            {isUnread && (
                                                <div className="absolute right-4 top-4 flex items-center justify-center w-5 h-5 rounded-full bg-[#EF4444] text-white font-bold text-[9px] shadow-sm">
                                                    {unreadCountVal}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )
                        ) : (
                            loadingUsers ? (
                                <div className="p-10 text-center">
                                    <div className="w-8 h-8 border-3 border-[#5A42E4]/20 border-t-[#5A42E4] rounded-full animate-spin mx-auto" />
                                </div>
                            ) : filteredUsers.length === 0 ? (
                                <div className="p-10 text-center opacity-40">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8A94A6]">No users found</p>
                                </div>
                            ) : (
                                filteredUsers.map(u => (
                                    <div
                                        key={u.id}
                                        onClick={() => startNewChat(u)}
                                        className="px-5 py-4 cursor-pointer transition-all duration-200 relative flex items-center gap-3 border-b border-[#F1F5F9] bg-[#FFFFFF] hover:bg-[#F8F9FC] group"
                                    >
                                        <div className="w-9 h-9 rounded-xl bg-[#F2F0FF] text-[#5A42E4] flex items-center justify-center font-bold text-xs shrink-0 border border-[#E2E8F0]">
                                            {u.firstName?.[0] || u.email?.[0]?.toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <span className="font-bold text-xs text-[#1A1D20] truncate block">
                                                {u.firstName} {u.lastName}
                                            </span>
                                            <span className="text-[10px] font-semibold text-[#8A94A6] block truncate mt-0.5">
                                                {u.email}
                                            </span>
                                        </div>
                                        <div className="w-7 h-7 rounded-lg bg-[#F2F0FF] text-[#5A42E4] items-center justify-center hidden group-hover:flex border border-[#E2E8F0]">
                                            <span className="material-symbols-outlined text-sm font-bold">chat</span>
                                        </div>
                                    </div>
                                ))
                            )
                        )}
                    </div>
                </div>
            )}

            {/* Main Chat Area */}
            <div className="flex-1 flex min-w-0 overflow-hidden bg-[#FFFFFF] relative">
                {/* Chat column */}
                <div className={`flex flex-col h-full min-w-0 flex-1 transition-all duration-300`}>
                    {activeConversation ? (() => {
                        const activeConv = conversations.find(c => c.id === activeConversation);
                        const displayName = activeConv ? getConversationDisplayName(activeConv) : '';
                        const savedName = activeConv ? getSavedNameForConv(activeConv) : '';

                        return (
                            <>
                                {/* Chat Header */}
                                <div className="px-6 py-4 bg-[#FFFFFF] border-b border-[#E2E8F0] flex items-center justify-between shrink-0 h-20 relative">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="relative shrink-0">
                                            <div className="w-10 h-10 rounded-xl bg-[#5A42E4] flex items-center justify-center font-bold text-lg text-white shadow-sm">
                                                {displayName ? displayName.substring(0, 1).toUpperCase() : 'C'}
                                            </div>
                                            <div className="absolute -right-0.5 -bottom-0.5 w-3 h-3 bg-[#10B981] border-2 border-white rounded-full"></div>
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h4 className="font-bold text-sm text-[#1A1D20] tracking-tight truncate">
                                                    {displayName}
                                                </h4>

                                                {/* Save / Edit Contact Name button right next to title */}
                                                {/* <button
                                                    type="button"
                                                    onClick={() => {
                                                        setNameInput(savedName || activeConv?.customerName || '');
                                                        setShowSaveNameModal(true);
                                                    }}
                                                    className="px-2.5 py-1 bg-[#F2F0FF] hover:bg-[#5A42E4] text-[#5A42E4] hover:text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 border border-[#5A42E4]/25 cursor-pointer shadow-xs"
                                                    title="Save or edit contact name for this number"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">edit_note</span>
                                                    {savedName ? "+ Save Name" : "Edit Name"}
                                                </button> */}

                                                {/* <span className="px-2 py-0.5 bg-[#F2F0FF] text-[#5A42E4] text-[9px] font-bold uppercase tracking-wider rounded border border-[#5A42E4]/20 whitespace-nowrap">
                                                    {activeConv?.metadata?.type === 'agent_to_staff' ? 'RM DISCUSSION' : 'STAFF CHANNEL'}
                                                </span> */}
                                            </div>
                                            <p className="text-[10px] text-[#8A94A6] truncate mt-0.5 font-medium flex items-center gap-2 min-w-0">
                                                <span className="truncate">{activeConv?.customerEmail || 'support@student-loan.org'}</span>
                                                {activeConv?.customerPhone && (
                                                    <span className="font-mono text-[#5A42E4] truncate max-w-[180px] sm:max-w-[260px]">({activeConv.customerPhone})</span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 relative">
                                        <button
                                            onClick={openStudentDocuments}
                                            className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer ${showDocPanel
                                                ? 'bg-[#5A42E4] text-white border-[#5A42E4] shadow-md shadow-[#5A42E4]/20'
                                                : 'bg-white hover:bg-[#F8F9FC] border-[#E2E8F0] text-[#4A525A]'
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-base">description</span>
                                            Student Documents
                                            {showDocPanel && studentDocs.length > 0 && (
                                                <span className="ml-1 w-4.5 h-4.5 rounded-full bg-white/20 text-white text-[9px] font-bold flex items-center justify-center">
                                                    {studentDocs.length}
                                                </span>
                                            )}
                                        </button>

                                        {/* Options Menu Button (Three Dots) */}
                                        <button
                                            onClick={() => setShowHeaderMenu(prev => !prev)}
                                            className="w-9 h-9 flex items-center justify-center text-[#8A94A6] hover:text-[#1A1D20] hover:bg-[#F8F9FC] rounded-xl border border-[#E2E8F0] transition-all cursor-pointer"
                                            title="Chat Options"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">more_vert</span>
                                        </button>

                                        {/* Options Dropdown Menu */}
                                        {showHeaderMenu && (
                                            <div className="absolute right-0 top-12 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 py-2 animate-scale-up font-sans">
                                                <button
                                                    onClick={() => {
                                                        setShowHeaderMenu(false);
                                                        setNameInput(savedName || activeConv?.customerName || '');
                                                        setShowSaveNameModal(true);
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2.5 border-0 cursor-pointer"
                                                >
                                                    <span className="material-symbols-outlined text-base text-indigo-600">edit_note</span>
                                                    Save / Edit Contact Name
                                                </button>
                                                {activeConv?.customerPhone && (
                                                    <button
                                                        onClick={() => {
                                                            setShowHeaderMenu(false);
                                                            navigator.clipboard.writeText(activeConv.customerPhone);
                                                            alert(`Phone number (${activeConv.customerPhone}) copied to clipboard!`);
                                                        }}
                                                        className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2.5 border-0 cursor-pointer"
                                                    >
                                                        <span className="material-symbols-outlined text-base text-slate-500">content_copy</span>
                                                        Copy Phone Number
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setShowHeaderMenu(false);
                                                        openStudentDocuments();
                                                    }}
                                                    className="w-full px-4 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center gap-2.5 border-0 cursor-pointer"
                                                >
                                                    <span className="material-symbols-outlined text-base text-slate-500">folder_open</span>
                                                    View Student Documents
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 p-10 overflow-y-auto no-scrollbar flex flex-col gap-8 bg-gradient-to-b from-[#fbfbfd] to-white">
                                    {messages.length === 0 ? (
                                        <div className="flex-1 flex flex-col items-center justify-center opacity-60 mt-10 animate-fade-in px-6 text-center">
                                            <div className="w-16 h-16 bg-[#F2F0FF] rounded-2xl flex items-center justify-center mb-4 border border-[#5A42E4]/10 shadow-sm text-[#5A42E4]">
                                                <span className="material-symbols-outlined text-2xl">forum</span>
                                            </div>
                                            <p className="text-sm font-bold text-[#1A1D20]">No recent messages</p>
                                            <p className="text-xs text-[#8A94A6] mt-1">Send a message below to start the conversation.</p>
                                        </div>
                                    ) : (
                                        <>
                                            {(() => {
                                                let lastDateStr = '';
                                                return messages.map(msg => {
                                                    const isMe = isMessageFromMe(msg);
                                                    const isCustomer = msg.senderType === 'customer';

                                                    // Fallback to senderId (which is usually their email) if senderName is missing
                                                    const staffOrBankName = msg.senderName || (msg.senderId && msg.senderId.includes('@') ? msg.senderId.split('@')[0] : msg.senderId) || 'Support Agent';

                                                    const senderLabel = isCustomer
                                                        ? 'Student'
                                                        : (msg.senderType === 'system' ? 'System' : staffOrBankName);

                                                    const msgDate = new Date(msg.createdAt).toDateString();
                                                    const showDivider = msgDate !== lastDateStr;
                                                    lastDateStr = msgDate;

                                                    if (msg.senderType === 'system') {
                                                        return (
                                                            <React.Fragment key={msg.id}>
                                                                {showDivider && (
                                                                    <div className="flex items-center justify-center my-6 w-full relative">
                                                                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                                                            <div className="w-full border-t border-[#E2E8F0]"></div>
                                                                        </div>
                                                                        <span className="relative px-3 py-1 bg-[#F2F0FF] text-[#5A42E4] text-[9px] font-bold uppercase tracking-wider rounded-full border border-[#5A42E4]/25 shadow-sm">
                                                                            {formatMessageGroupDate(msg.createdAt)}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <div className="self-center my-3 max-w-[85%] w-full font-sans">
                                                                    <div className="px-5 py-4 bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl shadow-sm flex items-start gap-3">
                                                                        <div className="w-8 h-8 rounded-lg bg-[#F2F0FF] text-[#5A42E4] flex items-center justify-center shrink-0 border border-[#E2E8F0]">
                                                                            <span className="material-symbols-outlined text-lg font-bold">info</span>
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <span className="text-[9px] font-bold text-[#5A42E4] uppercase tracking-wider block mb-0.5">SYSTEM NOTICE</span>
                                                                            <p className="text-xs font-medium text-[#1A1D20] leading-relaxed">{msg.content}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </React.Fragment>
                                                        );
                                                    }

                                                    return (
                                                        <React.Fragment key={msg.id}>
                                                            {showDivider && (
                                                                <div className="flex items-center justify-center my-6 w-full relative">
                                                                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                                                        <div className="w-full border-t border-[#E2E8F0]"></div>
                                                                    </div>
                                                                    <span className="relative px-3 py-1 bg-[#F2F0FF] text-[#5A42E4] text-[9px] font-bold uppercase tracking-wider rounded-full border border-[#5A42E4]/25 shadow-sm">
                                                                        {formatMessageGroupDate(msg.createdAt)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className={`flex flex-col max-w-[75%] ${isMe ? 'self-end items-end animate-slide-up font-sans group' : 'self-start items-start animate-slide-up font-sans'}`}>
                                                                <div className="flex items-center gap-2 mb-1 px-1">
                                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isMe ? 'text-[#5A42E4]' : 'text-[#4A525A]'}`}>
                                                                        {isMe ? 'You' : senderLabel}
                                                                    </span>
                                                                    {isCustomer && (
                                                                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#E8F8F5] text-[#10B981] rounded border border-[#10B981]/15">
                                                                            <span className="w-1 h-1 rounded-full bg-[#10B981]"></span>
                                                                            <span className="text-[8px] text-[#10B981] font-bold uppercase tracking-wider">WhatsApp</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className={`px-4 py-3 rounded-2xl shadow-sm relative border ${isMe
                                                                    ? 'bg-[#5A42E4] text-[#FFFFFF] rounded-tr-none border-[#5A42E4]/10 shadow-sm'
                                                                    : 'bg-[#FFFFFF] border-[#E2E8F0] text-[#1A1D20] rounded-tl-none'
                                                                    }`}>
                                                                    {isMe && (
                                                                        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                                                                            {!msg.attachmentUrl && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleStartEdit(msg)}
                                                                                    className="w-7 h-7 rounded-lg bg-[#FFFFFF] border border-slate-200 text-slate-500 hover:text-[#5A42E4] hover:bg-[#F2F0FF] flex items-center justify-center transition-all cursor-pointer shadow-sm"
                                                                                    title="Edit Message"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[15px] font-bold">edit</span>
                                                                                </button>
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => handleDeleteMessage(msg.id)}
                                                                                className="w-7 h-7 rounded-lg bg-[#FFFFFF] border border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all cursor-pointer shadow-sm"
                                                                                title="Delete Message"
                                                                            >
                                                                                <span className="material-symbols-outlined text-[15px] font-bold">delete</span>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    {msg.attachmentUrl ? (
                                                                        (() => {
                                                                            const parsed = parseAttachmentMessage(msg.content);
                                                                            return (
                                                                                <div className="flex flex-col gap-2">
                                                                                    <a
                                                                                        href={`/api/chat/attachment/${msg.id}?token=${token}`}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className={`flex items-center gap-3 p-3 rounded-xl border ${isMe ? 'bg-white/10 border-white/20 hover:bg-white/20' : 'bg-white border-[#E2E8F0] hover:bg-gray-50'} transition-colors`}
                                                                                    >
                                                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isMe ? 'bg-white/20 text-white' : 'bg-[#F2F0FF] text-[#5A42E4]'}`}>
                                                                                            <span className="material-symbols-outlined">
                                                                                                {msg.messageType === 'image' ? 'image' : 'description'}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <p className="text-xs font-bold truncate">
                                                                                                {parsed.fileName}
                                                                                            </p>
                                                                                            <p className={`text-[9px] ${isMe ? 'text-white/70' : 'text-[#8A94A6]'} uppercase tracking-wider`}>
                                                                                                Click to {msg.messageType === 'image' ? 'view' : 'download'}
                                                                                            </p>
                                                                                        </div>
                                                                                    </a>
                                                                                    {parsed.textContent && (
                                                                                        <div className={`text-xs font-medium leading-relaxed tracking-tight border-t pt-2 whitespace-pre-wrap ${isMe ? 'border-white/20 text-white' : 'border-[#E2E8F0] text-slate-800'}`}>
                                                                                            {parsed.textContent}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })()
                                                                    ) : (
                                                                        <p className="text-xs font-medium leading-relaxed tracking-tight whitespace-pre-wrap">{msg.content}</p>
                                                                    )}
                                                                </div>

                                                                <div className={`mt-1.5 flex items-center gap-2 px-1 text-[9px] font-bold tracking-wide uppercase ${isMe ? 'text-[#5A42E4]/70' : 'text-[#8A94A6]'}`}>
                                                                    <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                                    {isMe && (
                                                                        <span className="inline-flex items-center gap-0.5 shrink-0">
                                                                            {msg.status === 'read' ? (
                                                                                <>
                                                                                    <span className="material-symbols-outlined text-[13px] text-[#10B981] font-bold leading-none">done_all</span>
                                                                                    <span className="text-[#10B981] text-[8px] font-bold tracking-wider">Seen</span>
                                                                                </>
                                                                            ) : msg.status === 'delivered' ? (
                                                                                <>
                                                                                    <span className="material-symbols-outlined text-[13px] text-[#8A94A6] font-bold leading-none">done_all</span>
                                                                                    <span className="text-[8px] font-bold tracking-wider">Delivered</span>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <span className="material-symbols-outlined text-[13px] text-[#8A94A6] font-bold leading-none">done</span>
                                                                                    <span className="text-[8px] font-bold tracking-wider">Sent</span>
                                                                                </>
                                                                            )}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </React.Fragment>
                                                    );
                                                });
                                            })()}
                                        </>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input Panel */}
                                <div className="p-6 bg-white border-t border-[#E2E8F0] shrink-0">
                                    {/* Message Presets */}
                                    <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar pb-1.5 scroll-smooth font-sans">
                                        {[
                                            { label: "MISSING MARKS", text: "Hello! We have reviewed your initial dossier but require the original 10th and 12th standard marksheets. Please upload them in the Document Vault." },
                                            { label: "PROCESSING FEE", text: "Dear applicant, processing fees of ₹17,700 (including 18% GST) are due to advance sanctioning. Kindly deposit upfront or select deduction." },
                                            { label: "CO-APPLICANT KYC", text: "Hello! To proceed with duplicate checks, please upload your co-applicant's verified Aadhaar and PAN documents." },
                                            { label: "CLARIFICATION MEMO", text: "Dear applicant, a credit audit query has been raised on your files. Kindly check the Queries Tab and submit responses." }
                                        ].map((preset, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => setInputText(preset.text)}
                                                className="px-3 py-1.5 bg-[#FFFFFF] text-[#5A42E4] border border-[#E2E8F0] text-[9.5px] font-bold uppercase tracking-wider rounded-xl transition-all duration-250 hover:bg-[#F2F0FF] hover:border-[#5A42E4] hover:-translate-y-0.5 shrink-0 shadow-sm cursor-pointer"
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                    {(pendingFile || pendingVaultDoc) && (
                                        <div className="flex items-center justify-between p-3 mb-3 bg-[#F2F0FF] border border-[#5A42E4]/25 rounded-xl animate-fade-in">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-[#5A42E4] text-white flex items-center justify-center shrink-0 shadow-sm">
                                                    <span className="material-symbols-outlined text-lg">
                                                        {pendingFile
                                                            ? (pendingFile.type.startsWith('image/') ? 'image' : 'description')
                                                            : ((pendingVaultDoc?.fileName || pendingVaultDoc?.name || '')?.toLowerCase().endsWith('.pdf') ? 'description' : 'image')
                                                        }
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-[#1A1D20] truncate">
                                                        {pendingFile ? pendingFile.name : (pendingVaultDoc?.fileName || pendingVaultDoc?.name || pendingVaultDoc?.docType)}
                                                    </p>
                                                    <p className="text-[9px] text-[#5A42E4] font-bold uppercase tracking-wider">
                                                        {pendingFile ? 'Local Attachment' : 'Vault Document'}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPendingFile(null);
                                                    setPendingVaultDoc(null);
                                                }}
                                                className="w-7 h-7 rounded-lg hover:bg-white/50 flex items-center justify-center text-[#8A94A6] hover:text-[#5A42E4] transition-all cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-base">close</span>
                                            </button>
                                        </div>
                                    )}
                                    {editingMessage && (
                                        <div className="flex items-center justify-between p-3 mb-3 bg-[#F2F0FF] border border-[#5A42E4]/25 rounded-xl animate-fade-in">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-[#5A42E4] text-white flex items-center justify-center shrink-0 border border-[#5A42E4]/10 shadow-sm">
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-[#1A1D20] truncate">
                                                        Editing Message: <span className="font-medium text-[#4A525A]">"{editingMessage.content}"</span>
                                                    </p>
                                                    <p className="text-[9px] text-[#5A42E4] font-bold uppercase tracking-wider">
                                                        Press Send to Save Changes or click Close to cancel
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleCancelEdit}
                                                className="w-7 h-7 rounded-lg hover:bg-white/50 flex items-center justify-center text-[#8A94A6] hover:text-[#5A42E4] transition-all cursor-pointer shrink-0"
                                            >
                                                <span className="material-symbols-outlined text-base">close</span>
                                            </button>
                                        </div>
                                    )}
                                    <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
                                        <div className="flex-1 relative flex items-center bg-[#F8F9FC] border border-[#E2E8F0] rounded-xl transition-all duration-200 focus-within:bg-white focus-within:border-[#5A42E4] focus-within:ring-4 focus-within:ring-[#5A42E4]/10 pl-11 pr-20 h-13 shadow-inner">
                                            <label className="absolute left-2 w-8 h-8 flex items-center justify-center text-[#8A94A6] hover:text-[#5A42E4] hover:bg-[#F2F0FF] rounded-lg transition-all cursor-pointer">
                                                {uploading ? (
                                                    <div className="w-4 h-4 border-2 border-[#5A42E4]/30 border-t-[#5A42E4] rounded-full animate-spin" />
                                                ) : (
                                                    <span className="material-symbols-outlined text-[20px]">attach_file</span>
                                                )}
                                                <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx" />
                                            </label>
                                            <input
                                                type="text"
                                                value={inputText}
                                                onChange={(e) => setInputText(e.target.value)}
                                                placeholder="Type your message here..."
                                                className="w-full bg-transparent border-none py-2 text-xs text-[#1A1D20] placeholder-[#8A94A6] focus:outline-none font-semibold h-full"
                                            />
                                            <div className="absolute right-2 flex items-center gap-0.5">
                                                {/* <button type="button" className="w-7 h-7 flex items-center justify-center text-[#8A94A6] hover:text-[#5A42E4] hover:bg-[#F2F0FF] transition-all rounded-lg cursor-pointer">
                                                <span className="material-symbols-outlined text-[18px]">mood</span>
                                            </button> */}
                                                {/* <button type="button" className="w-7 h-7 flex items-center justify-center text-[#8A94A6] hover:text-[#5A42E4] hover:bg-[#F2F0FF] transition-all rounded-lg cursor-pointer">
                                                <span className="material-symbols-outlined text-[18px]">mic</span>
                                            </button> */}
                                            </div>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={!inputText.trim() && !pendingFile && !pendingVaultDoc}
                                            className="w-13 h-13 bg-[#5A42E4] hover:bg-[#432ec4] text-white rounded-xl flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all shadow-md shadow-[#5A42E4]/20 hover:shadow-lg hover:shadow-[#5A42E4]/30 active:scale-95 group shrink-0 cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-[18px] font-bold group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">send</span>
                                        </button>
                                    </form>
                                    <div className="flex justify-between items-center mt-4 px-1 font-sans">
                                        <div className="flex items-center gap-1.5 text-[#10B981]">
                                            <span className="material-symbols-outlined text-sm font-bold">verified_user</span>
                                            <span className="text-[9px] font-bold uppercase tracking-wider">End-to-End Encrypted Staff Channel</span>
                                        </div>
                                        <p className="text-[9px] font-bold uppercase tracking-wider text-[#8A94A6]">Press Enter to send</p>
                                    </div>
                                </div>
                            </>
                        );
                    })() : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F8F9FC] font-sans">
                            <div className="absolute inset-0 bg-gradient-to-t from-[#5A42E4]/3 to-transparent"></div>
                            <div className="text-center relative z-10 animate-fade-in px-6">
                                <div className="w-24 h-24 rounded-3xl bg-[#F2F0FF] text-[#5A42E4] flex items-center justify-center mx-auto mb-6 border border-[#5A42E4]/10 relative shadow-sm">
                                    <span className="material-symbols-outlined text-4xl">chat</span>
                                </div>
                                <h3 className="text-xl font-bold tracking-tight text-[#1A1D20] mb-2">{portalTitle || (role === 'agent' ? (hideSidebar ? "Staff RM Connection" : "Student Pipeline") : "Staff Communication Portal")}</h3>
                                <p className="text-[#4A525A] text-sm max-w-sm mx-auto font-medium">
                                    {role === 'agent' && hideSidebar
                                        ? "Connecting you with your counselor. Messages will load automatically."
                                        : `Select a ${portalTitle?.toLowerCase().includes('staff') ? 'counselor' : 'student'} or ${role !== 'agent' ? 'bank ' : ''}conversation from the left sidebar to start messaging in real-time.`
                                    }
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Document Side Panel */}
                {showDocPanel && activeConversation && (
                    <div className="w-72 sm:w-80 border-l border-[#E2E8F0] bg-[#F8F9FC] flex flex-col shrink-0 animate-in slide-in-from-right duration-300 h-full overflow-hidden font-sans">
                        {/* Panel Header */}
                        <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#FFFFFF] flex items-center justify-between shrink-0">
                            <div className="min-w-0 pr-2">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-[#5A42E4]">Document Vault</p>
                                <h5 className="text-sm font-bold text-[#1A1D20] mt-0.5 truncate max-w-[200px]">
                                    {conversations.find(c => c.id === activeConversation)?.metadata?.bank
                                        ? conversations.find(c => c.id === activeConversation)?.metadata?.bank
                                        : (conversations.find(c => c.id === activeConversation)?.customerName || 'Student')
                                    }&apos;s Files
                                </h5>
                            </div>
                            <button
                                onClick={() => { setShowDocPanel(false); setPreviewDoc(null); }}
                                className="w-8 h-8 rounded-lg hover:bg-[#F2F0FF] flex items-center justify-center text-[#8A94A6] hover:text-[#5A42E4] transition-all border border-[#E2E8F0] hover:border-[#5A42E4]/20 cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>

                        {/* Upload & Share Section */}
                        <div className="px-5 py-3 border-b border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
                            <label className="w-full flex items-center justify-center gap-2 py-2 bg-[#5A42E4] hover:bg-[#432ec4] text-white text-[11px] font-bold uppercase tracking-wider rounded-xl cursor-pointer shadow-md shadow-[#5A42E4]/20 hover:shadow-lg transition-all text-center">
                                <span className="material-symbols-outlined text-sm font-bold">upload_file</span>
                                Select Local File
                                <input
                                    type="file"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                                />
                            </label>
                        </div>

                        {/* Document List */}
                        <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3 bg-[#F8F9FC]">
                            {loadingDocs ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3">
                                    <div className="w-8 h-8 border-3 border-[#5A42E4]/20 border-t-[#5A42E4] rounded-full animate-spin" />
                                    <p className="text-[10px] font-bold text-[#8A94A6] uppercase tracking-wider">Loading documents...</p>
                                </div>
                            ) : !docsUserId && studentDocs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center gap-3 px-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
                                    <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500">
                                        <span className="material-symbols-outlined text-[24px]">person_search</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-[#1A1D20]">Profile not found</p>
                                        <p className="text-[10px] text-[#8A94A6] mt-1">Make sure the student has a registered account linked to this phone/email.</p>
                                    </div>
                                </div>
                            ) : studentDocs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center gap-3 px-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
                                    <div className="w-12 h-12 rounded-xl bg-[#F8F9FC] border border-[#E2E8F0] flex items-center justify-center text-[#8A94A6]">
                                        <span className="material-symbols-outlined text-[24px]">folder_open</span>
                                    </div>
                                    <p className="text-xs font-bold text-[#4A525A]">No documents found</p>
                                </div>
                            ) : (
                                studentDocs.map(doc => {
                                    const sc = getDocStatusColor(doc.status, doc.uploaded);
                                    const docLabel = (doc.name || doc.docType || '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                                    const isLoadingThis = previewLoading === doc.docType;

                                    let statusBgClass = "bg-[#F1F5F9]";
                                    let statusTextClass = "text-[#8A94A6]";
                                    let statusBorderClass = "border-[#E2E8F0]";
                                    let dotClass = "bg-[#8A94A6]";

                                    if (sc.label === "Verified") {
                                        statusBgClass = "bg-[#E8F8F5]";
                                        statusTextClass = "text-[#10B981]";
                                        statusBorderClass = "border-[#10B981]/20";
                                        dotClass = "bg-[#10B981]";
                                    } else if (sc.label === "Rejected") {
                                        statusBgClass = "bg-[#FDF2F2]";
                                        statusTextClass = "text-[#EF4444]";
                                        statusBorderClass = "border-[#EF4444]/20";
                                        dotClass = "bg-[#EF4444]";
                                    } else if (sc.label === "Uploaded") {
                                        statusBgClass = "bg-[#F2F0FF]";
                                        statusTextClass = "text-[#5A42E4]";
                                        statusBorderClass = "border-[#5A42E4]/20";
                                        dotClass = "bg-[#5A42E4]";
                                    }

                                    return (
                                        <div
                                            key={doc.id || doc.docType}
                                            className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm hover:shadow-md transition-all duration-200"
                                        >
                                            <div className="flex items-start gap-3 mb-3">
                                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${statusBorderClass} ${statusBgClass} ${statusTextClass}`}>
                                                    <span className="material-symbols-outlined text-[18px]">description</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-[#1A1D20] truncate">{docLabel}</p>
                                                    <div className="flex items-center gap-1.5 mt-1">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
                                                        <span className={`text-[9px] font-bold uppercase ${statusTextClass}`}>{sc.label}</span>
                                                    </div>
                                                    {doc.fileName && (
                                                        <p className="text-[9px] text-[#8A94A6] font-medium mt-1 truncate">{doc.fileName}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex gap-1.5">
                                                <button
                                                    onClick={() => handleViewDocument(doc)}
                                                    disabled={isLoadingThis}
                                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#F2F0FF] hover:bg-[#5A42E4] text-[#5A42E4] hover:text-white border border-[#5A42E4]/20 hover:border-[#5A42E4] rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer"
                                                >
                                                    {isLoadingThis ? (
                                                        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        "View"
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadDocument(doc)}
                                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-white hover:bg-[#F8F9FC] text-[#4A525A] border border-[#E2E8F0] rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer"
                                                >
                                                    Download
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setPendingVaultDoc(doc);
                                                        setPendingFile(null);
                                                    }}
                                                    className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-emerald-50 hover:bg-[#10B981] text-[#10B981] hover:text-white border border-[#10B981]/20 hover:border-[#10B981] rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer"
                                                >
                                                    Share
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Panel Footer */}
                        {docsUserId && !loadingDocs && (
                            <div className="px-5 py-3.5 border-t border-[#E2E8F0] bg-[#FFFFFF] shrink-0">
                                <p className="text-[9px] text-[#8A94A6] font-bold uppercase tracking-wider text-center">
                                    {studentDocs.length} uploaded document{studentDocs.length !== 1 ? 's' : ''} found
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Document Preview Modal */}
            {previewDoc && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-end p-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
                    onClick={() => setPreviewDoc(null)}
                >
                    <div
                        className="w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Preview Header */}
                        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#6605c7]">Document Viewer</span>
                                <h3 className="text-lg font-bold text-slate-900 mt-0.5">{previewDoc.name}</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <a
                                    href={previewDoc.url}
                                    download
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center"
                                    title="Download"
                                >
                                    <span className="material-symbols-outlined text-[20px]">download</span>
                                </a>
                                <button
                                    onClick={() => setPreviewDoc(null)}
                                    className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-all shadow-lg flex items-center justify-center"
                                >
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Preview Content */}
                        <div className="flex-1 bg-slate-100/40 p-8 flex items-center justify-center overflow-auto">
                            {previewDoc.url.toLowerCase().includes('.pdf') ||
                                previewDoc.name.toLowerCase().includes('pdf') ||
                                !/\.(jpg|jpeg|png|webp|gif)/i.test(previewDoc.url.split('?')[0]) ? (
                                <iframe
                                    src={previewDoc.url}
                                    className="w-full h-full rounded-2xl border border-slate-200 bg-white shadow-xl"
                                    title={previewDoc.name}
                                    onLoad={() => setPreviewLoading(null)}
                                />
                            ) : (
                                <div className="relative max-w-full max-h-full rounded-2xl overflow-hidden shadow-2xl bg-white p-4 border border-slate-200">
                                    <img
                                        src={previewDoc.url}
                                        alt={previewDoc.name}
                                        className="max-w-full max-h-[70vh] object-contain rounded-xl"
                                        onLoad={() => setPreviewLoading(null)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Save Contact Name Modal */}
            {showSaveNameModal && (() => {
                const activeConv = conversations.find(c => c.id === activeConversation);
                const phone = activeConv?.customerPhone || activeConv?.id || '';

                return (
                    <div
                        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => setShowSaveNameModal(false)}
                    >
                        <div
                            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-200 font-sans"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold border border-indigo-200">
                                        <span className="material-symbols-outlined text-xl">edit_note</span>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900">Save Contact Name</h3>
                                        <p className="text-xs text-slate-500 font-medium">Assign a custom name to this number</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowSaveNameModal(false)}
                                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors border-0 cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-lg">close</span>
                                </button>
                            </div>

                            <form onSubmit={handleSaveContactNameSubmit} className="space-y-4">
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Contact Number / ID</span>
                                    <p className="text-xs font-bold font-mono text-indigo-600">{phone}</p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        Contact Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={nameInput}
                                        onChange={e => setNameInput(e.target.value)}
                                        placeholder="Enter name (e.g. Rahul Sharma, Priya P)"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10 transition-all"
                                        autoFocus
                                        required
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2.5 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowSaveNameModal(false)}
                                        className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingName || !nameInput.trim()}
                                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        {savingName && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                        {savingName ? "Saving..." : "Save Contact Name"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
