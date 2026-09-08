"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { mailApi } from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";
import {
    Mail,
    Send,
    Star,
    Trash2,
    Inbox,
    Folder,
    Paperclip,
    Search,
    RefreshCw,
    Reply,
    Forward,
    X,
    Maximize2,
    Minimize2,
    CheckCircle2,
    AlertCircle,
    User,
    ArrowLeft,
    Clock,
    Tag,
    ChevronDown,
    FileText,
    Download,
    Eye,
    Plus,
    Filter,
    ShieldAlert,
    ShieldCheck
} from "lucide-react";

interface MailSummaryItem {
    id: string;
    key: string;
    from: string;
    to: string;
    subject: string;
    date: string;
    size: number;
    read: boolean;
    folder?: string;
    snippet?: string;
    isSpam?: boolean;
    spamScore?: number;
    spamVerdict?: 'PASS' | 'FAIL' | 'GRAY' | 'UNKNOWN';
    virusVerdict?: 'PASS' | 'FAIL' | 'UNKNOWN';
    spamReasons?: string[];
    authResults?: {
        spf?: string;
        dkim?: string;
        dmarc?: string;
    };
}

interface MailDetailItem extends MailSummaryItem {
    html?: string;
    text?: string;
    cc?: string;
    bcc?: string;
    replyTo?: string;
    attachments: {
        filename: string;
        contentType?: string;
        size: number;
        content?: string;
    }[];
}

interface S3Folder {
    name: string;
    prefix: string;
    isStaff?: boolean;
    count?: number;
}

function StaffInboxContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    // Query parameters
    const urlFolder = searchParams.get("folder");
    const urlStaffEmail = searchParams.get("staffEmail");
    const urlStaffName = searchParams.get("name");

    // Staff identity slug for AWS folder matching
    const currentUserEmail = user?.email || "";
    const currentUserSlug = useMemo(() => {
        return currentUserEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "");
    }, [currentUserEmail]);

    const initialFolder = useMemo(() => {
        if (urlFolder) return urlFolder;
        if (urlStaffEmail) {
            const slug = urlStaffEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "");
            return `staff/${slug}/`;
        }
        // Default to personal staff folder if staff member, else support/
        if (currentUserSlug) {
            return `staff/${currentUserSlug}/`;
        }
        return "support/";
    }, [urlFolder, urlStaffEmail, currentUserSlug]);

    // Active folder / mailbox state
    const [selectedFolder, setSelectedFolder] = useState<string>(initialFolder);
    const [activeTab, setActiveTab] = useState<"inbox" | "starred" | "sent" | "spam" | "trash">("inbox");
    const [foldersList, setFoldersList] = useState<S3Folder[]>([]);
    const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);

    // Emails data state
    const [emails, setEmails] = useState<MailSummaryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
    const [activeEmailDetail, setActiveEmailDetail] = useState<MailDetailItem | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Search and filter
    const [searchQuery, setSearchQuery] = useState("");
    const [showOnlyUnread, setShowOnlyUnread] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // LocalStorage tracking for read, starred, trashed, sent, and spam overrides
    const [readIds, setReadIds] = useState<Set<string>>(new Set());
    const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
    const [trashedIds, setTrashedIds] = useState<Set<string>>(new Set());
    const [userSpamIds, setUserSpamIds] = useState<Set<string>>(new Set());
    const [userNotSpamIds, setUserNotSpamIds] = useState<Set<string>>(new Set());
    const [sentEmails, setSentEmails] = useState<any[]>([]);

    // Compose / Reply modal
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [isComposeMinimized, setIsComposeMinimized] = useState(false);
    const [isComposeExpanded, setIsComposeExpanded] = useState(false);
    const [showCcBcc, setShowCcBcc] = useState(false);
    const [composeData, setComposeData] = useState({
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body: "",
        replyTo: "",
    });
    const [attachments, setAttachments] = useState<{ filename: string; contentType: string; size: number; content: string }[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [feedbackToast, setFeedbackToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Initialize state from localStorage
    useEffect(() => {
        try {
            const savedRead = localStorage.getItem("vidya_mail_read_ids");
            if (savedRead) setReadIds(new Set(JSON.parse(savedRead)));

            const savedStarred = localStorage.getItem("vidya_mail_starred_ids");
            if (savedStarred) setStarredIds(new Set(JSON.parse(savedStarred)));

            const savedTrashed = localStorage.getItem("vidya_mail_trashed_ids");
            if (savedTrashed) setTrashedIds(new Set(JSON.parse(savedTrashed)));

            const savedSpam = localStorage.getItem("vidya_mail_user_spam_ids");
            if (savedSpam) setUserSpamIds(new Set(JSON.parse(savedSpam)));

            const savedNotSpam = localStorage.getItem("vidya_mail_user_not_spam_ids");
            if (savedNotSpam) setUserNotSpamIds(new Set(JSON.parse(savedNotSpam)));

            const savedSent = localStorage.getItem("vidya_mail_sent_history");
            if (savedSent) setSentEmails(JSON.parse(savedSent));
        } catch (e) {
            console.warn("Error reading mail local state", e);
        }
    }, []);

    // Load available S3 folders
    useEffect(() => {
        mailApi.getFolders()
            .then((res: any) => {
                if (res?.success && Array.isArray(res.data)) {
                    setFoldersList(res.data);
                }
            })
            .catch((err) => console.warn("Could not fetch S3 folders", err));
    }, []);

    // Load emails for the selected S3 folder
    const fetchEmails = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            const res: any = await mailApi.getInbox({ folder: selectedFolder });
            if (res?.success && Array.isArray(res.data)) {
                setEmails(res.data);
            } else if (Array.isArray(res)) {
                setEmails(res);
            } else {
                setEmails([]);
            }
        } catch (err) {
            console.error("Failed to load inbox emails:", err);
            setEmails([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedFolder]);

    useEffect(() => {
        fetchEmails();
    }, [fetchEmails]);

    // Load email details when an email is selected
    const handleSelectEmail = useCallback(async (email: MailSummaryItem) => {
        setSelectedEmailId(email.id);
        setLoadingDetail(true);

        // Mark as read
        setReadIds((prev) => {
            const next = new Set(prev);
            next.add(email.id);
            try {
                localStorage.setItem("vidya_mail_read_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });

        try {
            const res: any = await mailApi.getMail(email.id);
            if (res?.success && res.data) {
                setActiveEmailDetail(res.data);
            } else {
                setActiveEmailDetail(res);
            }
        } catch (err: any) {
            console.error("Failed to load email details", err);
            // Fallback to summary info if detail fetch fails
            setActiveEmailDetail({
                ...email,
                attachments: [],
                text: email.snippet || "Could not retrieve full email body.",
            });
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    // Helper to evaluate if email is considered Spam (with manual user override support)
    const isEmailSpam = useCallback((e: MailSummaryItem) => {
        if (userNotSpamIds.has(e.id)) return false;
        if (userSpamIds.has(e.id)) return true;
        return Boolean(e.isSpam);
    }, [userNotSpamIds, userSpamIds]);

    // Filter emails based on Active Tab, Search Query, and Unread Toggle
    const filteredEmails = useMemo(() => {
        let list = [...emails];

        // Tab filter
        if (activeTab === "starred") {
            list = list.filter((e) => starredIds.has(e.id) && !trashedIds.has(e.id));
        } else if (activeTab === "trash") {
            list = list.filter((e) => trashedIds.has(e.id));
        } else if (activeTab === "spam") {
            list = list.filter((e) => !trashedIds.has(e.id) && isEmailSpam(e));
        } else if (activeTab === "sent") {
            // Display sent history
            return sentEmails.map((item, idx) => ({
                id: `sent-${idx}-${Date.now()}`,
                key: `sent/${item.subject}`,
                from: item.from || "Me",
                to: Array.isArray(item.to) ? item.to.join(", ") : item.to,
                subject: item.subject || "(No Subject)",
                date: item.date || new Date().toISOString(),
                size: 0,
                read: true,
                snippet: item.text || item.body || "",
                isSpam: false,
                spamScore: 0,
                spamReasons: [] as string[],
            }));
        } else {
            // Inbox tab excludes trashed items AND spam items
            list = list.filter((e) => !trashedIds.has(e.id) && !isEmailSpam(e));
        }

        // Unread toggle filter
        if (showOnlyUnread && (activeTab === "inbox" || activeTab === "spam")) {
            list = list.filter((e) => !readIds.has(e.id));
        }

        // Search filter
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (e) =>
                    e.subject.toLowerCase().includes(q) ||
                    e.from.toLowerCase().includes(q) ||
                    (e.snippet && e.snippet.toLowerCase().includes(q))
            );
        }

        return list;
    }, [emails, activeTab, starredIds, trashedIds, sentEmails, showOnlyUnread, readIds, searchQuery, isEmailSpam]);

    // Star toggle action
    const toggleStar = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setStarredIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            try {
                localStorage.setItem("vidya_mail_starred_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
    };

    // Mark as Spam
    const handleMarkAsSpam = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setUserSpamIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            try {
                localStorage.setItem("vidya_mail_user_spam_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        setUserNotSpamIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            try {
                localStorage.setItem("vidya_mail_user_not_spam_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        setFeedbackToast({ type: "error", message: "Reported as Spam / Moved to Junk folder." });
        setTimeout(() => setFeedbackToast(null), 3500);
    };

    // Mark as Not Spam
    const handleMarkAsNotSpam = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setUserNotSpamIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            try {
                localStorage.setItem("vidya_mail_user_not_spam_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        setUserSpamIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            try {
                localStorage.setItem("vidya_mail_user_spam_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        setFeedbackToast({ type: "success", message: "Restored to Inbox (Marked as Not Spam)." });
        setTimeout(() => setFeedbackToast(null), 3500);
    };

    // Move to Trash action
    const moveToTrash = (id: string) => {
        setTrashedIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            try {
                localStorage.setItem("vidya_mail_trashed_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        if (selectedEmailId === id) {
            setSelectedEmailId(null);
            setActiveEmailDetail(null);
        }
    };

    // Bulk action: move selected to trash
    const handleBulkTrash = () => {
        if (selectedIds.size === 0) return;
        setTrashedIds((prev) => {
            const next = new Set(prev);
            selectedIds.forEach((id) => next.add(id));
            try {
                localStorage.setItem("vidya_mail_trashed_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        setSelectedIds(new Set());
    };

    // Bulk selection toggles
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredEmails.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredEmails.map((e) => e.id)));
        }
    };

    const toggleSelectOne = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Trigger Reply
    const handleReply = () => {
        if (!activeEmailDetail) return;
        const sender = activeEmailDetail.from.replace(/.*<(.+)>/, "$1").trim();
        const cleanSubj = activeEmailDetail.subject.startsWith("Re:")
            ? activeEmailDetail.subject
            : `Re: ${activeEmailDetail.subject}`;
        const quote = `\n\n\n--- On ${format(new Date(activeEmailDetail.date), "PPP 'at' p")}, ${activeEmailDetail.from} wrote ---\n> ${activeEmailDetail.text ? activeEmailDetail.text.replace(/\n/g, "\n> ") : ""}`;

        setComposeData({
            to: sender,
            cc: "",
            bcc: "",
            subject: cleanSubj,
            body: quote,
            replyTo: "support@vidyaloans.in",
        });
        setAttachments([]);
        setIsComposeOpen(true);
        setIsComposeMinimized(false);
    };

    // Trigger Forward
    const handleForward = () => {
        if (!activeEmailDetail) return;
        const cleanSubj = activeEmailDetail.subject.startsWith("Fwd:")
            ? activeEmailDetail.subject
            : `Fwd: ${activeEmailDetail.subject}`;
        const quote = `\n\n\n---------- Forwarded message ---------\nFrom: ${activeEmailDetail.from}\nDate: ${format(new Date(activeEmailDetail.date), "PPP 'at' p")}\nSubject: ${activeEmailDetail.subject}\nTo: ${activeEmailDetail.to}\n\n${activeEmailDetail.text || ""}`;

        setComposeData({
            to: "",
            cc: "",
            bcc: "",
            subject: cleanSubj,
            body: quote,
            replyTo: "support@vidyaloans.in",
        });
        const forwardAttachments = (activeEmailDetail.attachments || [])
            .filter((a) => typeof a.content === "string")
            .map((a) => ({
                filename: a.filename,
                contentType: a.contentType || "application/octet-stream",
                size: a.size,
                content: a.content as string,
            }));
        setAttachments(forwardAttachments);
        setIsComposeOpen(true);
        setIsComposeMinimized(false);
    };

    // File Attachment Handler
    const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach((file) => {
            if (file.size > 15 * 1024 * 1024) {
                alert(`File ${file.name} is larger than 15MB limit.`);
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                const base64String = (reader.result as string).split(",")[1];
                setAttachments((prev) => [
                    ...prev,
                    {
                        filename: file.name,
                        contentType: file.type || "application/octet-stream",
                        size: file.size,
                        content: base64String,
                    },
                ]);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = "";
    };

    // Remove an attachment from compose list
    const removeAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    // Send Email
    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!composeData.to) {
            alert("Recipient address is required.");
            return;
        }
        if (!composeData.subject) {
            alert("Subject is required.");
            return;
        }

        setIsSending(true);
        try {
            const payload = {
                to: composeData.to.split(",").map((s) => s.trim()).filter(Boolean),
                cc: composeData.cc ? composeData.cc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                bcc: composeData.bcc ? composeData.bcc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                subject: composeData.subject,
                text: composeData.body,
                replyTo: composeData.replyTo || undefined,
                attachments: attachments.map((a) => ({
                    filename: a.filename,
                    content: a.content,
                    contentType: a.contentType,
                })),
            };

            await mailApi.sendMail(payload);

            // Record sent item in localStorage
            const sentRecord = {
                to: composeData.to,
                subject: composeData.subject,
                body: composeData.body,
                date: new Date().toISOString(),
                from: "support@vidyaloans.in",
            };
            const updatedSent = [sentRecord, ...sentEmails].slice(0, 100);
            setSentEmails(updatedSent);
            try {
                localStorage.setItem("vidya_mail_sent_history", JSON.stringify(updatedSent));
            } catch { }

            setFeedbackToast({ type: "success", message: "Email dispatched successfully via Amazon SES!" });
            setTimeout(() => setFeedbackToast(null), 4000);

            setIsComposeOpen(false);
            setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", replyTo: "" });
            setAttachments([]);
        } catch (err: any) {
            console.error("Send email error:", err);
            setFeedbackToast({
                type: "error",
                message: err.message || "Failed to dispatch email. Please verify SES SMTP credentials.",
            });
            setTimeout(() => setFeedbackToast(null), 6000);
        } finally {
            setIsSending(false);
        }
    };

    // Download attachment helper
    const handleDownloadAttachment = (att: { filename: string; content?: string; contentType?: string }) => {
        if (!att.content) {
            alert("Attachment content not available for download.");
            return;
        }
        try {
            const byteCharacters = atob(att.content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: att.contentType || "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = att.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Attachment download error", e);
            alert("Failed to download attachment.");
        }
    };

    const currentFolderLabel = useMemo(() => {
        const found = foldersList.find((f) => f.prefix === selectedFolder);
        if (found) return found.name;
        if (selectedFolder.startsWith("staff/")) {
            const slug = selectedFolder.replace(/^staff\//, "").replace(/\/$/, "");
            return `Staff: ${slug.toUpperCase()}`;
        }
        return selectedFolder;
    }, [selectedFolder, foldersList]);

    return (
        <div className="flex h-[calc(100vh-65px)] overflow-hidden bg-slate-100 font-sans">
            {/* ── FEEDBACK TOAST ── */}
            {feedbackToast && (
                <div
                    className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border text-sm font-semibold transition-all animate-bounce ${
                        feedbackToast.type === "success"
                            ? "bg-emerald-900 text-emerald-100 border-emerald-700"
                            : "bg-rose-900 text-rose-100 border-rose-700"
                    }`}
                >
                    {feedbackToast.type === "success" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-rose-400" />
                    )}
                    <span>{feedbackToast.message}</span>
                </div>
            )}

            {/* ── LEFT SIDEBAR ── */}
            <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col flex-shrink-0 select-none">
                {/* Compose Action */}
                <div className="p-4 border-b border-slate-100">
                    <button
                        onClick={() => {
                            setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", replyTo: "" });
                            setAttachments([]);
                            setIsComposeOpen(true);
                            setIsComposeMinimized(false);
                        }}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-[#4F46E5] hover:bg-[#4338CA] active:bg-[#3730A3] text-white font-bold rounded-2xl shadow-md shadow-indigo-500/25 transition-all text-sm cursor-pointer"
                    >
                        <Plus className="w-4 h-4 stroke-[3]" />
                        <span>Compose Email</span>
                    </button>
                </div>

                {/* AWS S3 Staff Folder Switcher */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1.5 flex items-center justify-between">
                        <span>AWS S3 Folder</span>
                        <span className="text-[9px] text-indigo-700 font-extrabold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            SES INBOUND
                        </span>
                    </label>

                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsFolderDropdownOpen(!isFolderDropdownOpen)}
                            className="w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-bold text-slate-800 shadow-sm hover:border-indigo-400 transition-all text-left truncate"
                        >
                            <span className="flex items-center gap-2 truncate">
                                <Folder className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span className="truncate">{currentFolderLabel}</span>
                            </span>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isFolderDropdownOpen ? "rotate-180" : ""}`} />
                        </button>

                        {isFolderDropdownOpen && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 py-1.5 max-h-64 overflow-y-auto">
                                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                    Select Folder
                                </div>

                                {/* Default Support */}
                                <button
                                    onClick={() => {
                                        setSelectedFolder("support/");
                                        setIsFolderDropdownOpen(false);
                                    }}
                                    className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 hover:bg-indigo-50 transition-colors ${
                                        selectedFolder === "support/" ? "text-indigo-600 bg-indigo-50/60 font-bold" : "text-slate-700"
                                    }`}
                                >
                                    <Inbox className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Support Team (support/)</span>
                                </button>

                                {/* Current User Personal Folder */}
                                {currentUserSlug && (
                                    <button
                                        onClick={() => {
                                            setSelectedFolder(`staff/${currentUserSlug}/`);
                                            setIsFolderDropdownOpen(false);
                                        }}
                                        className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center gap-2 hover:bg-indigo-50 transition-colors ${
                                            selectedFolder === `staff/${currentUserSlug}/` ? "text-indigo-600 bg-indigo-50/60 font-bold" : "text-slate-700"
                                        }`}
                                    >
                                        <User className="w-3.5 h-3.5 text-emerald-500" />
                                        <span>My Folder (staff/{currentUserSlug}/)</span>
                                    </button>
                                )}

                                {/* Other Folders Dynamically from S3 */}
                                {foldersList.length > 0 && (
                                    <>
                                        <div className="px-3 py-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 mt-1">
                                            All AWS S3 Staff Folders
                                        </div>
                                        {foldersList.map((f) => (
                                            <button
                                                key={f.prefix}
                                                onClick={() => {
                                                    setSelectedFolder(f.prefix);
                                                    setIsFolderDropdownOpen(false);
                                                }}
                                                className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-indigo-50 transition-colors truncate ${
                                                    selectedFolder === f.prefix ? "text-indigo-600 bg-indigo-50/60 font-bold" : "text-slate-700 font-medium"
                                                }`}
                                            >
                                                <Folder className={`w-3.5 h-3.5 ${f.isStaff ? "text-amber-500" : "text-indigo-500"}`} />
                                                <span className="truncate">{f.name}</span>
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Mail Navigation Tabs */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                    {[
                        {
                            id: "inbox",
                            label: "Folder Inbox",
                            icon: Inbox,
                            badge: emails.filter((e) => !readIds.has(e.id) && !trashedIds.has(e.id) && !isEmailSpam(e)).length,
                        },
                        {
                            id: "starred",
                            label: "Starred",
                            icon: Star,
                            badge: emails.filter((e) => starredIds.has(e.id) && !trashedIds.has(e.id)).length,
                        },
                        {
                            id: "sent",
                            label: "Sent History",
                            icon: Send,
                            badge: sentEmails.length,
                        },
                        {
                            id: "spam",
                            label: "Spam / Junk",
                            icon: ShieldAlert,
                            badge: emails.filter((e) => !trashedIds.has(e.id) && isEmailSpam(e) && !readIds.has(e.id)).length,
                            activeColor: "bg-rose-50 text-rose-700 border-rose-200",
                            badgeColor: "bg-rose-600 text-white",
                        },
                        {
                            id: "trash",
                            label: "Trash",
                            icon: Trash2,
                            badge: emails.filter((e) => trashedIds.has(e.id)).length,
                        },
                    ].map((tab: any) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        const activeCls = tab.activeColor || "bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100/80";
                        const badgeCls = tab.badgeColor || (isActive ? "bg-indigo-600 text-white" : "bg-slate-200/80 text-slate-600");
                        return (
                            <button
                                key={tab.id}
                                onClick={() => {
                                    setActiveTab(tab.id as any);
                                    setSelectedEmailId(null);
                                    setActiveEmailDetail(null);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    isActive
                                        ? activeCls
                                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                }`}
                            >
                                <span className="flex items-center gap-3">
                                    <Icon className={`w-4 h-4 ${isActive ? (tab.id === 'spam' ? 'text-rose-600' : 'text-indigo-600') : "text-slate-400"}`} />
                                    <span>{tab.label}</span>
                                </span>
                                {tab.badge > 0 && (
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${badgeCls}`}
                                    >
                                        {tab.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Staff User Context Footer */}
                <div className="p-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center gap-3">
                    <img
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || "staff"}`}
                        alt="Avatar"
                        className="w-8 h-8 rounded-full border border-slate-200 bg-white"
                    />
                    <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">
                            {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "Staff Member"}
                        </p>
                        <p className="text-[10px] text-indigo-700 font-mono font-bold truncate">
                            {user?.email || "support@vidyaloans.in"}
                        </p>
                    </div>
                </div>
            </aside>

            {/* ── CENTER: EMAIL LIST PANE ── */}
            <section
                className={`${
                    selectedEmailId ? "hidden lg:flex" : "flex"
                } w-full lg:w-[420px] bg-white border-r border-slate-200/80 flex-col flex-shrink-0`}
            >
                {/* Search & Action Header */}
                <div className="p-3.5 border-b border-slate-100 flex flex-col gap-2.5 bg-slate-50/40">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            placeholder="Search emails, sender, subject..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200/90 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="selectAll"
                                checked={filteredEmails.length > 0 && selectedIds.size === filteredEmails.length}
                                onChange={toggleSelectAll}
                                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                            />
                            <button
                                onClick={() => setShowOnlyUnread(!showOnlyUnread)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 ${
                                    showOnlyUnread
                                        ? "bg-indigo-600 text-white"
                                        : "bg-slate-200/70 text-slate-600 hover:bg-slate-300/70"
                                }`}
                            >
                                <Filter className="w-2.5 h-2.5" />
                                Unread
                            </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={handleBulkTrash}
                                    title="Move selected to Trash"
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}

                            <button
                                onClick={() => fetchEmails(true)}
                                disabled={refreshing}
                                title="Refresh S3 Inbox"
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Email List Content */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {loading ? (
                        <div className="p-8 text-center space-y-3">
                            <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                            <p className="text-xs font-bold text-slate-500">Scanning S3 bucket for MIME emails...</p>
                        </div>
                    ) : filteredEmails.length === 0 ? (
                        <div className="p-10 text-center space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mx-auto text-indigo-500">
                                <Mail className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-700">No emails found</p>
                                <p className="text-[11px] text-slate-400 mt-1 max-w-[240px] mx-auto">
                                    No incoming emails in folder <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600">{selectedFolder}</code>
                                </p>
                            </div>
                        </div>
                    ) : (
                        filteredEmails.map((email) => {
                            const isSelected = selectedEmailId === email.id;
                            const isRead = readIds.has(email.id);
                            const isStarred = starredIds.has(email.id);

                            let relativeTime = "";
                            try {
                                relativeTime = formatDistanceToNow(new Date(email.date), { addSuffix: true });
                            } catch {
                                relativeTime = "recently";
                            }

                            return (
                                <div
                                    key={email.id}
                                    onClick={() => {
                                        setReadIds((prev) => {
                                            const next = new Set(prev);
                                            next.add(email.id);
                                            try {
                                                localStorage.setItem("vidya_mail_read_ids", JSON.stringify(Array.from(next)));
                                            } catch { }
                                            return next;
                                        });
                                        router.push(`/staff/inbox/${email.id}?folder=${encodeURIComponent(selectedFolder)}`);
                                    }}
                                    className={`p-3.5 cursor-pointer transition-all flex items-start gap-3 hover:bg-indigo-50/40 relative ${
                                        isSelected ? "bg-indigo-50/90 border-l-4 border-indigo-600" : isRead ? "bg-white" : "bg-indigo-50/20 font-bold"
                                    }`}
                                >
                                    {/* Checkbox and Star */}
                                    <div className="flex flex-col items-center gap-2 pt-0.5">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(email.id)}
                                            onClick={(e) => toggleSelectOne(e, email.id)}
                                            onChange={() => { }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                                        />
                                        <button
                                            onClick={(e) => toggleStar(e, email.id)}
                                            className="text-slate-300 hover:text-amber-400 transition-colors"
                                        >
                                            <Star className={`w-3.5 h-3.5 ${isStarred ? "fill-amber-400 text-amber-400" : ""}`} />
                                        </button>
                                    </div>

                                    {/* Email Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                            <span className={`text-xs truncate ${!isRead ? "font-extrabold text-slate-900" : "font-semibold text-slate-700"}`}>
                                                {email.from}
                                            </span>
                                            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                                                {relativeTime}
                                            </span>
                                        </div>

                                        <p className={`text-xs truncate mb-1 ${!isRead ? "font-black text-[#0A2540]" : "font-medium text-slate-800"}`}>
                                            {email.subject}
                                        </p>

                                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                            {email.snippet || "No body preview available."}
                                        </p>

                                        {/* Spam Indicator Pill & Primary Reason */}
                                        {isEmailSpam(email) && (
                                            <div className="mt-1.5 flex items-center justify-between gap-2">
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-[9px] font-black text-rose-700">
                                                    <ShieldAlert className="w-3 h-3 text-rose-500" />
                                                    SPAM ({email.spamScore || 75}%)
                                                </span>
                                                {email.spamReasons && email.spamReasons[0] && (
                                                    <span className="text-[9px] text-rose-600 font-medium truncate max-w-[160px]">
                                                        {email.spamReasons[0]}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action buttons on card: quick Spam / Not Spam */}
                                    <div className="flex flex-col items-center gap-1 pt-0.5">
                                        {!isRead && (
                                            <span className="w-2 h-2 rounded-full bg-indigo-600 mb-1 shrink-0" />
                                        )}
                                        {activeTab === "spam" || isEmailSpam(email) ? (
                                            <button
                                                onClick={(e) => handleMarkAsNotSpam(e, email.id)}
                                                title="Mark as Not Spam (Restore to Inbox)"
                                                className="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                            >
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={(e) => handleMarkAsSpam(e, email.id)}
                                                title="Report as Spam / Move to Junk"
                                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                            >
                                                <ShieldAlert className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>

            {/* ── RIGHT: EMAIL DETAIL VIEWER ── */}
            <main className={`${selectedEmailId ? "flex" : "hidden lg:flex"} flex-1 bg-white flex-col overflow-hidden`}>
                {selectedEmailId && activeEmailDetail ? (
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        {/* Detail Header & Action Toolbar */}
                        <div className="p-4 border-b border-slate-200/80 bg-white flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setSelectedEmailId(null)}
                                    className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={handleReply}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all border border-indigo-200/60 cursor-pointer"
                                >
                                    <Reply className="w-3.5 h-3.5" />
                                    Reply
                                </button>

                                <button
                                    onClick={handleForward}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                                >
                                    <Forward className="w-3.5 h-3.5" />
                                    Forward
                                </button>

                                <button
                                    onClick={(e) => toggleStar(e, activeEmailDetail.id)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-slate-100 transition-colors"
                                    title="Star email"
                                >
                                    <Star
                                        className={`w-4 h-4 ${
                                            starredIds.has(activeEmailDetail.id) ? "fill-amber-400 text-amber-400" : ""
                                        }`}
                                    />
                                </button>

                                <button
                                    onClick={() => moveToTrash(activeEmailDetail.id)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Move to trash"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            {/* S3 Key Tag */}
                            <div className="flex items-center gap-2">
                                <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-[10px] font-mono font-bold text-slate-600 border border-slate-200">
                                    <Tag className="w-3 h-3 text-slate-400" />
                                    {selectedFolder}
                                </span>
                            </div>
                        </div>

                        {/* Email Meta and Content Container */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Subject and Date */}
                            <div className="space-y-3 border-b border-slate-100 pb-5">
                                <h1 className="text-xl font-black text-slate-900 leading-snug">
                                    {activeEmailDetail.subject || "(No Subject)"}
                                </h1>

                                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700">
                                            {activeEmailDetail.from.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-extrabold text-slate-900">{activeEmailDetail.from}</p>
                                            <p className="text-slate-400 text-[11px]">To: {activeEmailDetail.to}</p>
                                            {activeEmailDetail.cc && (
                                                <p className="text-slate-400 text-[10px]">Cc: {activeEmailDetail.cc}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-slate-500 font-medium">
                                            {format(new Date(activeEmailDetail.date), "PPP 'at' p")}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Attachments Section */}
                            {activeEmailDetail.attachments && activeEmailDetail.attachments.length > 0 && (
                                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                        <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>Attachments ({activeEmailDetail.attachments.length})</span>
                                    </div>

                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {activeEmailDetail.attachments.map((att, index) => (
                                            <div
                                                key={index}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm"
                                            >
                                                <FileText className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="truncate max-w-[180px]">{att.filename}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    ({Math.round(att.size / 1024)} KB)
                                                </span>
                                                {att.content && (
                                                    <button
                                                        onClick={() => handleDownloadAttachment(att)}
                                                        className="p-1 hover:text-indigo-600 text-slate-400 transition-colors"
                                                        title="Download file"
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Email Body: Sanitized HTML iframe or plain text fallback */}
                            <div className="pt-2">
                                {activeEmailDetail.html ? (
                                    <div className="rounded-2xl border border-slate-100 bg-white p-2 min-h-[300px]">
                                        <iframe
                                            title="Email HTML Preview"
                                            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1e293b;line-height:1.6;padding:12px;margin:0;word-break:break-word;}img{max-width:100%;height:auto;}</style></head><body>${activeEmailDetail.html}</body></html>`}
                                            className="w-full min-h-[480px] border-none rounded-xl"
                                            sandbox="allow-popups allow-popups-to-escape-sandbox"
                                        />
                                    </div>
                                ) : (
                                    <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200/60 font-sans text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                                        {activeEmailDetail.text || "(Empty email body)"}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/30">
                        <div className="w-16 h-16 rounded-3xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500 mb-4 shadow-sm">
                            <Mail className="w-8 h-8" />
                        </div>
                        <h3 className="text-base font-bold text-slate-800">Select an email to view details</h3>
                        <p className="text-xs text-slate-400 mt-1 max-w-sm">
                            Emails retrieved securely from AWS S3 bucket <code className="text-indigo-600 font-mono">vidyaloans-incoming-emails</code>
                        </p>
                    </div>
                )}
            </main>

            {/* ── COMPOSE & REPLY MODAL ── */}
            {isComposeOpen && (
                <div
                    className={`fixed z-50 transition-all duration-200 ${
                        isComposeExpanded
                            ? "inset-4 sm:inset-10"
                            : isComposeMinimized
                            ? "bottom-0 right-8 w-80 h-12"
                            : "bottom-0 right-8 w-[580px] max-w-[calc(100vw-40px)] h-[580px] max-h-[calc(100vh-80px)]"
                    } bg-white rounded-t-2xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden`}
                >
                    {/* Modal Header */}
                    <div className="px-4 py-3 bg-[#0A2540] text-white flex items-center justify-between flex-shrink-0 cursor-pointer">
                        <span className="text-xs font-bold tracking-wide flex items-center gap-2">
                            <Send className="w-3.5 h-3.5 text-indigo-400" />
                            {composeData.subject ? composeData.subject : "New Message"}
                        </span>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsComposeMinimized(!isComposeMinimized)}
                                className="p-1 hover:text-indigo-300 text-slate-300 transition-colors"
                            >
                                <Minimize2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setIsComposeExpanded(!isComposeExpanded)}
                                className="p-1 hover:text-indigo-300 text-slate-300 transition-colors"
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setIsComposeOpen(false)}
                                className="p-1 hover:text-rose-400 text-slate-300 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {!isComposeMinimized && (
                        <form onSubmit={handleSendEmail} className="flex-1 flex flex-col overflow-hidden bg-white">
                            {/* Inputs */}
                            <div className="p-3 border-b border-slate-100 space-y-2 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1 flex items-center gap-2">
                                        <span className="w-12 text-slate-400 font-bold uppercase text-[10px]">To</span>
                                        <input
                                            type="text"
                                            placeholder="recipient@example.com"
                                            value={composeData.to}
                                            onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                                            required
                                            className="flex-1 px-2 py-1 text-xs font-semibold focus:outline-none border-b border-transparent focus:border-indigo-500"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowCcBcc(!showCcBcc)}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                                    >
                                        {showCcBcc ? "Hide CC/BCC" : "CC / BCC"}
                                    </button>
                                </div>

                                {showCcBcc && (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="w-12 text-slate-400 font-bold uppercase text-[10px]">Cc</span>
                                            <input
                                                type="text"
                                                placeholder="cc@example.com"
                                                value={composeData.cc}
                                                onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
                                                className="flex-1 px-2 py-1 text-xs font-semibold focus:outline-none border-b border-transparent focus:border-indigo-500"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-12 text-slate-400 font-bold uppercase text-[10px]">Bcc</span>
                                            <input
                                                type="text"
                                                placeholder="bcc@example.com"
                                                value={composeData.bcc}
                                                onChange={(e) => setComposeData({ ...composeData, bcc: e.target.value })}
                                                className="flex-1 px-2 py-1 text-xs font-semibold focus:outline-none border-b border-transparent focus:border-indigo-500"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="flex items-center gap-2">
                                    <span className="w-12 text-slate-400 font-bold uppercase text-[10px]">Subject</span>
                                    <input
                                        type="text"
                                        placeholder="Email Subject"
                                        value={composeData.subject}
                                        onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                                        required
                                        className="flex-1 px-2 py-1 text-xs font-semibold focus:outline-none border-b border-transparent focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Message Body */}
                            <textarea
                                placeholder="Type your message here..."
                                value={composeData.body}
                                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                                className="flex-1 p-4 text-xs leading-relaxed font-sans focus:outline-none resize-none"
                            />

                            {/* Attachments Pills */}
                            {attachments.length > 0 && (
                                <div className="px-4 py-2 border-t border-slate-100 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                                    {attachments.map((att, i) => (
                                        <span
                                            key={i}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-bold"
                                        >
                                            <FileText className="w-3 h-3 text-indigo-500" />
                                            <span className="truncate max-w-[120px]">{att.filename}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeAttachment(i)}
                                                className="hover:text-rose-600"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Modal Footer */}
                            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <label className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer" title="Attach Files">
                                        <Paperclip className="w-4 h-4" />
                                        <input
                                            type="file"
                                            multiple
                                            onChange={handleAttachmentChange}
                                            className="hidden"
                                        />
                                    </label>
                                    <span className="text-[10px] text-slate-400">
                                        Max 15MB total via SES SMTP
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsComposeOpen(false)}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200/60 transition-colors"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="submit"
                                        disabled={isSending}
                                        className="inline-flex items-center gap-2 px-5 py-2 bg-[#4F46E5] hover:bg-[#4338CA] active:bg-[#3730A3] text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        <span>{isSending ? "Sending..." : "Send Email"}</span>
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}

export default function StaffInboxPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center bg-slate-100"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>}>
            <StaffInboxContent />
        </Suspense>
    );
}
