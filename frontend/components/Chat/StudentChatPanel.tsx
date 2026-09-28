"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "@/contexts/AuthContext";
import { HttpApiPaths } from "@/lib/http-api-paths";

interface Message {
    id: string;
    conversationId: string;
    senderType: "customer" | "staff" | "bank" | "system";
    senderId?: string;
    content: string;
    status?: string;
    createdAt: string;
}

interface StudentChatPanelProps {
    /** Call this to close the panel */
    onClose: () => void;
}

export default function StudentChatPanel({ onClose }: StudentChatPanelProps) {
    const { token, user } = useAuth();

    // Connection state
    const [socket, setSocket] = useState<Socket | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [customerPhone, setCustomerPhone] = useState<string>("");

    // UI state
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState("");
    const [connecting, setConnecting] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isTyping, setIsTyping] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const conversationIdRef = useRef<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Keep ref in sync with state for socket callbacks
    useEffect(() => {
        conversationIdRef.current = conversationId;
    }, [conversationId]);

    const scrollToBottom = useCallback(() => {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, scrollToBottom]);

    // 1. Call /chat/connect to get or create the conversation
    useEffect(() => {
        if (!token) return;

        const connectChat = async () => {
            setConnecting(true);
            setError(null);
            try {
                const res = await fetch(HttpApiPaths.chat.connect(), {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error("Failed to connect");
                const data = await res.json();
                const convId: string = data?.conversation?.id;
                const phone: string =
                    data?.conversation?.customerPhone ||
                    user?.phoneNumber ||
                    "";
                if (!convId) throw new Error("No conversation returned");
                setConversationId(convId);
                setCustomerPhone(phone);
            } catch (e: any) {
                setError("Could not connect to support. Please try again.");
                setConnecting(false);
            }
        };

        connectChat();
    }, [token, user?.phoneNumber]);

    // 2. Load message history + setup socket once we have a conversationId
    useEffect(() => {
        if (!conversationId || !token) return;

        // Load history
        const loadHistory = async () => {
            try {
                const res = await fetch(
                    HttpApiPaths.chat.messages(conversationId),
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                const data = await res.json();
                if (Array.isArray(data)) setMessages(data);
            } catch {
                // non-fatal — history may be empty
            } finally {
                setConnecting(false);
                scrollToBottom();
                setTimeout(() => inputRef.current?.focus(), 200);
            }
        };

        loadHistory();

        const baseApiUrl =
            typeof window !== "undefined" &&
            (window.location.hostname.includes("localhost") ||
            window.location.hostname.includes("127.0.0.1"))
                ? "http://localhost:5000"
                : (process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000"));
        const socketUrl = baseApiUrl.endsWith("/api")
            ? baseApiUrl.replace("/api", "/chat")
            : `${baseApiUrl.replace(/\/$/, "")}/chat`;

        const sock = io(socketUrl, { auth: { token } });

        sock.on("connect", () => {
            sock.emit("join_conversation", conversationId);
            sock.emit("mark_read", { conversationId });
        });

        sock.on("new_message", (msg: Message) => {
            if (msg.conversationId === conversationIdRef.current) {
                setMessages((prev) => {
                    if (prev.find((m) => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
                // Brief typing indicator reset
                setIsTyping(false);
                if (msg.senderType !== "customer") {
                    sock.emit("mark_read", { conversationId: msg.conversationId });
                }
            }
        });

        sock.on("messages_read", (data: { conversationId: string, readerType: string, readerId?: string }) => {
            if (data.conversationId === conversationIdRef.current) {
                // readerType tells us WHO read the messages:
                // 'customer' → customer read → mark staff/bank messages as 'read'
                // 'staff_or_bank' → staff/bank read → mark customer messages as 'read'
                setMessages((prev) => prev.map((m) => {
                    if (data.readerType === 'customer' && m.senderType !== 'customer') {
                        return { ...m, status: 'read' };
                    }
                    if (data.readerType === 'staff_or_bank' && m.senderType === 'customer') {
                        return { ...m, status: 'read' };
                    }
                    return m;
                }));
            }
        });

        setSocket(sock);
        return () => {
            sock.emit("leave_conversation", conversationId);
            sock.disconnect();
        };
    }, [conversationId, token, scrollToBottom]);

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        const text = inputText.trim();
        if (!text || !socket || !conversationId) return;

        // Optimistic local message
        const optimistic: Message = {
            id: `opt_${Date.now()}`,
            conversationId,
            senderType: "customer",
            content: text,
            createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);
        setInputText("");

        // Send via sim_customer_reply — existing gateway handler saves + broadcasts to staff
        const phone = customerPhone || user?.phoneNumber || "";
        socket.emit("sim_customer_reply", { phone, content: text });
    };

    const formatTime = (iso: string) => {
        try {
            return new Date(iso).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return "";
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed bottom-0 right-0 md:bottom-6 md:right-6 z-50 w-full md:w-[420px] h-[90vh] md:h-[620px] flex flex-col rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden shadow-[0_40px_120px_rgba(102,5,199,0.22)] border border-[#6605c7]/20 animate-in slide-in-from-bottom-4 duration-300">

                {/* Gradient Header */}
                <div className="bg-gradient-to-r from-[#6605c7] to-[#8b3cf7] px-6 pt-6 pb-5 flex-shrink-0">
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/25 shadow-inner">
                                    <span className="material-symbols-outlined text-white text-[22px]">support_agent</span>
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#6605c7] shadow" />
                            </div>
                            <div>
                                <h3 className="text-white font-black text-[15px] tracking-tight leading-none">VidyaLoans Support</h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-white/70 text-[10px] font-semibold uppercase tracking-wider">Online · Avg. reply &lt; 2 min</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center transition-all border border-white/20 group"
                        >
                            <span className="material-symbols-outlined text-white text-[18px] group-hover:rotate-90 transition-transform duration-200">close</span>
                        </button>
                    </div>

                    {/* Channel badge */}
                    <div className="flex items-center justify-between gap-2 mt-4">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm">
                            <span className="material-symbols-outlined text-emerald-300 text-[14px]">verified</span>
                            <span className="text-white/80 text-[10px] font-bold uppercase tracking-wider">Secure In-App Messaging</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const rawNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_AWS_WHATSAPP_NUMBER || '+918143797779';
                                const cleanNumber = rawNumber.replace('whatsapp:', '').replace(/\D/g, '');
                                const welcomeText = encodeURIComponent(`Hi Vidyaloan team, I am ${user?.firstName || 'applicant'} and I would like to connect with a mentor.`);
                                window.open(`https://wa.me/${cleanNumber}?text=${welcomeText}`, '_blank');
                            }}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 border border-emerald-400/20 text-white text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[13px]">chat</span>
                            Chat on WhatsApp
                        </button>
                    </div>
                </div>

                {/* Messages area */}
                <div className="flex-1 overflow-y-auto bg-[#faf9fd] px-5 py-4 space-y-3 no-scrollbar">

                    {/* Connecting state */}
                    {connecting && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-2xl bg-[#6605c7]/10 flex items-center justify-center mx-auto mb-3 relative">
                                    <div className="absolute inset-0 rounded-2xl border-2 border-[#6605c7]/30 border-t-[#6605c7] animate-spin" />
                                    <span className="material-symbols-outlined text-[#6605c7] text-[20px]">chat</span>
                                </div>
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Connecting to support…</p>
                            </div>
                        </div>
                    )}

                    {/* Error state */}
                    {!connecting && error && (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center p-6 bg-red-50 rounded-2xl border border-red-100 max-w-[280px]">
                                <span className="material-symbols-outlined text-red-400 text-[36px] mb-2 block">error_outline</span>
                                <p className="text-[12px] font-bold text-red-700 mb-4">{error}</p>
                                <button
                                    onClick={() => { setError(null); setConnecting(true); }}
                                    className="px-4 py-2 bg-[#6605c7] text-white text-[11px] font-bold rounded-xl hover:bg-[#4f0399] transition-all"
                                >
                                    Retry
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {!connecting && !error && messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                            <div className="w-20 h-20 rounded-[1.75rem] bg-gradient-to-br from-[#6605c7]/10 to-[#8b3cf7]/10 flex items-center justify-center border border-[#6605c7]/10 relative">
                                <div className="absolute inset-0 rounded-[1.75rem] animate-ping bg-[#6605c7]/5" style={{ animationDuration: '3s' }} />
                                <span className="material-symbols-outlined text-[#6605c7] text-[38px]">forum</span>
                            </div>
                            <div>
                                <p className="text-[13px] font-bold text-slate-700">Start the conversation</p>
                                <p className="text-[11px] text-slate-400 font-medium mt-1 max-w-[220px] leading-relaxed">
                                    Our support team will respond in seconds. Ask about your loan status, documents, or anything else.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Messages */}
                    {!connecting && !error && messages.length > 0 && (
                        <>
                            {/* Date separator */}
                            <div className="flex items-center gap-3 py-1">
                                <div className="flex-1 h-px bg-slate-200" />
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Today</span>
                                <div className="flex-1 h-px bg-slate-200" />
                            </div>

                            {messages.map((msg) => {
                                const isCustomer = msg.senderType === "customer";
                                const isSystem = msg.senderType === "system";

                                if (isSystem) {
                                    return (
                                        <div key={msg.id} className="flex justify-center">
                                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                                                {msg.content}
                                            </span>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={msg.id}
                                        className={`flex flex-col ${isCustomer ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-1 duration-200`}
                                    >
                                        {!isCustomer && (
                                            <div className="flex items-center gap-1.5 mb-1 px-1">
                                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6605c7] to-[#8b3cf7] flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-white text-[10px]">support_agent</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-[#6605c7] uppercase tracking-wider">Support Agent</span>
                                            </div>
                                        )}

                                        <div
                                            className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-sm text-[13px] font-medium leading-relaxed ${
                                                isCustomer
                                                    ? "bg-gradient-to-br from-[#6605c7] to-[#8b3cf7] text-white rounded-br-none shadow-[#6605c7]/20"
                                                    : "bg-white text-slate-700 border border-slate-200 rounded-bl-none shadow-slate-100"
                                            }`}
                                        >
                                            {msg.content}
                                        </div>

                                        <div className={`flex items-center gap-1 mt-1 px-1 ${isCustomer ? "flex-row-reverse" : ""}`}>
                                            <span className="text-[9px] font-semibold text-slate-400">
                                                {formatTime(msg.createdAt)}
                                            </span>
                                            {isCustomer && (
                                                <span className="inline-flex items-center gap-0.5 shrink-0">
                                                    {msg.status === 'read' ? (
                                                        <span className="material-symbols-outlined text-[12px] text-[#6605c7] font-bold leading-none">done_all</span>
                                                    ) : msg.status === 'delivered' ? (
                                                        <span className="material-symbols-outlined text-[12px] text-slate-400 font-bold leading-none">done_all</span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[12px] text-slate-400 font-medium leading-none">done</span>
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Staff typing indicator */}
                            {isTyping && (
                                <div className="flex items-start gap-2 animate-in fade-in duration-200">
                                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6605c7] to-[#8b3cf7] flex items-center justify-center shrink-0 mt-1">
                                        <span className="material-symbols-outlined text-white text-[10px]">support_agent</span>
                                    </div>
                                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                                        <div className="flex gap-1 items-center h-4">
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* Quick reply chips */}
                {!connecting && !error && (
                    <div className="px-4 pt-3 pb-1 bg-white border-t border-slate-100 flex gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
                        {[
                            "What's my loan status?",
                            "Documents required?",
                            "Speak to an agent",
                        ].map((chip) => (
                            <button
                                key={chip}
                                type="button"
                                onClick={() => setInputText(chip)}
                                className="shrink-0 px-3 py-1.5 rounded-full bg-[#6605c7]/8 border border-[#6605c7]/15 text-[#6605c7] text-[10px] font-bold hover:bg-[#6605c7] hover:text-white transition-all whitespace-nowrap"
                            >
                                {chip}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input area */}
                <div className="bg-white px-4 pb-5 pt-3 flex-shrink-0">
                    <form onSubmit={handleSend} className="flex items-center gap-3">
                        <div className="flex-1 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder={connecting ? "Connecting…" : "Type a message…"}
                                disabled={connecting || !!error}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 focus:border-[#6605c7]/40 transition-all font-medium disabled:opacity-50"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!inputText.trim() || connecting || !!error}
                            className="w-12 h-12 bg-gradient-to-br from-[#6605c7] to-[#8b3cf7] text-white rounded-2xl flex items-center justify-center hover:from-[#5504a8] hover:to-[#7a2fe0] disabled:opacity-30 transition-all shadow-lg shadow-[#6605c7]/25 active:scale-95 group flex-shrink-0"
                        >
                            <span className="material-symbols-outlined font-black text-[20px] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">send</span>
                        </button>
                    </form>
                    <p className="text-[9px] text-slate-400 font-semibold text-center mt-2 flex items-center justify-center gap-1">
                        <span className="material-symbols-outlined text-[11px]">lock</span>
                        End-to-end encrypted · VidyaLoans Secure Messaging
                    </p>
                </div>
            </div>
        </>
    );
}
