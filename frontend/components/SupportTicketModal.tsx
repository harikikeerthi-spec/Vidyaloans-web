"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supportApi } from "@/lib/api";

interface SupportTicketModalProps {
    isOpen?: boolean;
    isModal?: boolean;
    onClose?: () => void;
    userRole?: string;
    userInfo?: {
        id?: string;
        name?: string;
        email?: string;
        phone?: string;
    };
    loanApplicationId?: string;
    loanApplicationNum?: string;
    studentId?: string;
    studentName?: string;
}

const CATEGORIES = [
    { value: "Loan Application", label: "Loan Application Issue", icon: "assignment" },
    { value: "Document Verification", label: "Document Verification / KYC", icon: "verified" },
    { value: "Bank Statement", label: "Bank Statement Verification", icon: "account_balance" },
    { value: "Disbursement", label: "Disbursement & Sanction Letter", icon: "payments" },
    { value: "Technical Issue", label: "Technical & System Error", icon: "bug_report" },
    { value: "Profile", label: "Profile & Account Settings", icon: "person" },
    { value: "Others", label: "General Query / Others", icon: "help_outline" },
];

const PRIORITIES = [
    { value: "low", label: "Low", color: "bg-slate-100 text-slate-700 border-slate-200" },
    { value: "medium", label: "Medium", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { value: "high", label: "High", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { value: "critical", label: "Urgent / Critical", color: "bg-rose-50 text-rose-700 border-rose-200" },
];

const parseISTDate = (dateVal: any): Date => {
    if (!dateVal) return new Date();
    if (dateVal instanceof Date) return dateVal;
    let s = String(dateVal).trim();
    if (!s.endsWith("Z") && !s.includes("+") && !s.includes("Z")) {
        s += "Z";
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
};

const formatIST = (dateVal: any): string => {
    if (!dateVal) return "—";
    const d = parseISTDate(dateVal);
    const options: Intl.DateTimeFormatOptions = {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    };
    return new Intl.DateTimeFormat("en-IN", options).format(d);
};

export default function SupportTicketModal({
    isOpen = true,
    isModal = true,
    onClose,
    userRole = "student",
    userInfo,
    loanApplicationId,
    loanApplicationNum,
    studentId,
    studentName,
}: SupportTicketModalProps) {
    const [activeTab, setActiveTab] = useState<"create" | "my_tickets">("create");

    // Form state
    const [subject, setSubject] = useState("");
    const [category, setCategory] = useState("Loan Application");
    const [priority, setPriority] = useState("medium");
    const [description, setDescription] = useState("");
    const [proofFile, setProofFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 20 * 1024 * 1024) {
                setError("File size exceeds 20MB limit.");
                return;
            }
            setProofFile(file);
            setError("");
        }
    };

    // Submission states
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [createdTicketNum, setCreatedTicketNum] = useState<string | null>(null);

    // My Tickets state
    const [myTickets, setMyTickets] = useState<any[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [replyText, setReplyText] = useState("");
    const [replying, setReplying] = useState(false);

    useEffect(() => {
        if (isOpen && activeTab === "my_tickets") {
            fetchMyTickets();
        }
    }, [isOpen, activeTab]);

    const fetchMyTickets = async () => {
        setLoadingTickets(true);
        try {
            const params: Record<string, any> = { limit: 100, sortBy: "createdAt", sortOrder: "desc" };
            if (userInfo?.id) params.createdById = userInfo.id;
            const res = await supportApi.getTickets(params) as any;
            const data = res?.data || res || {};
            setMyTickets(Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []);
        } catch (err: any) {
            console.error("Failed to fetch tickets:", err);
        } finally {
            setLoadingTickets(false);
        }
    };



    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!subject.trim() || subject.trim().length < 5) {
            setError("Subject must be at least 5 characters long.");
            return;
        }
        if (!description.trim() || description.trim().length < 10) {
            setError("Please provide a detailed description (at least 10 characters).");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                subject: subject.trim(),
                description: description.trim(),
                category,
                priority,
                loanApplicationId,
                loanApplicationNum,
                studentId,
                studentName: studentName || userInfo?.name,
                tags: [userRole.toUpperCase()],
            };

            const ticketRes = await supportApi.createTicket(payload) as any;
            const ticketId = ticketRes?.id;
            const ticketNumber = ticketRes?.ticketNumber || "TKT-SUCCESS";

            // Upload proof attachment if selected
            if (proofFile && ticketId) {
                try {
                    await supportApi.uploadAttachment(ticketId, proofFile);
                } catch (uploadErr: any) {
                    console.error("Attachment upload warning:", uploadErr);
                }
            }

            setCreatedTicketNum(ticketNumber);
            setSubject("");
            setDescription("");
            setProofFile(null);
            fetchMyTickets();
        } catch (err: any) {
            console.error("Failed to create support ticket:", err);
            setError(err.message || "Failed to submit support ticket. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleSelectTicket = async (ticket: any) => {
        try {
            const detail = await supportApi.getTicket(ticket.id) as any;
            setSelectedTicket(detail?.data || detail);
        } catch (err) {
            setSelectedTicket(ticket);
        }
    };

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !selectedTicket) return;
        setReplying(true);
        setError("");
        try {
            await supportApi.addComment(selectedTicket.id, replyText.trim());
            setReplyText("");
            const updated = await supportApi.getTicket(selectedTicket.id) as any;
            setSelectedTicket(updated?.data || updated);
        } catch (err: any) {
            console.error("Failed to send reply:", err);
            setError(err?.message || "Failed to send reply. Please try again.");
        } finally {
            setReplying(false);
        }
    };

    if (!isOpen) return null;

    const modalContent = (
        <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className={`bg-white rounded-3xl border border-purple-100 shadow-xl w-full overflow-hidden relative font-sans flex flex-col ${
                isModal ? "max-w-2xl max-h-[90vh]" : "max-w-full"
            }`}
        >
            {/* Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-[#6605c7] to-indigo-700 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                        <span className="material-symbols-outlined text-xl text-purple-200">support_agent</span>
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                            Help & Support Center
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/20 text-purple-100">
                                {userRole}
                            </span>
                        </h3>
                        <p className="text-xs text-purple-200 font-medium">Submit tickets & track resolution progress dynamically</p>
                    </div>
                </div>
                {onClose && (
                    <button
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-white border-0 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                )}
            </div>

                    {/* Navigation Tabs */}
                    <div className="flex border-b border-gray-100 px-6 bg-purple-50/30 shrink-0">
                        <button
                            type="button"
                            onClick={() => { setActiveTab("create"); setCreatedTicketNum(null); }}
                            className={`py-3.5 px-5 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer border-0 flex items-center gap-2 ${activeTab === "create"
                                ? "border-[#6605c7] text-[#6605c7] bg-white rounded-t-xl shadow-xs"
                                : "border-transparent text-gray-400 hover:text-gray-600 bg-transparent"
                                }`}
                        >
                            <span className="material-symbols-outlined text-base">add_circle</span>
                            New Support Ticket
                        </button>
                        <button
                            type="button"
                            onClick={() => { setActiveTab("my_tickets"); setSelectedTicket(null); }}
                            className={`py-3.5 px-5 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer border-0 flex items-center gap-2 ${activeTab === "my_tickets"
                                ? "border-[#6605c7] text-[#6605c7] bg-white rounded-t-xl shadow-xs"
                                : "border-transparent text-gray-400 hover:text-gray-600 bg-transparent"
                                }`}
                        >
                            <span className="material-symbols-outlined text-base">confirmation_number</span>
                            My Tickets ({myTickets.length})
                        </button>
                    </div>

                    {/* Body Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === "create" && (
                            createdTicketNum ? (
                                <div className="py-10 text-center space-y-5">
                                    <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                                        <span className="material-symbols-outlined text-3xl">check_circle</span>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-xl font-bold text-gray-900">Support Ticket Raised!</h4>
                                        <p className="text-xs text-gray-500 font-medium">Your request has been logged and assigned to our resolution team.</p>
                                    </div>
                                    <div className="inline-block bg-purple-50 border border-purple-200 px-5 py-2.5 rounded-2xl">
                                        <span className="text-xs text-gray-400 font-bold block uppercase tracking-widest">Ticket ID</span>
                                        <span className="text-lg font-black text-[#6605c7] font-mono">{createdTicketNum}</span>
                                    </div>
                                    <div className="pt-4 flex justify-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setCreatedTicketNum(null)}
                                            className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                                        >
                                            Raise Another Ticket
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab("my_tickets")}
                                            className="px-5 py-2.5 bg-[#6605c7] hover:bg-[#5204a3] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0 shadow-md"
                                        >
                                            View Ticket Progress
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {error && (
                                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center gap-2">
                                            <span className="material-symbols-outlined text-base">error</span>
                                            {error}
                                        </div>
                                    )}

                                    {/* Category Select */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                                            Issue Category <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {CATEGORIES.map((cat) => (
                                                <button
                                                    key={cat.value}
                                                    type="button"
                                                    onClick={() => setCategory(cat.value)}
                                                    className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2 cursor-pointer ${category === cat.value
                                                        ? "border-[#6605c7] bg-purple-50/80 text-[#6605c7] font-bold shadow-xs"
                                                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                                                        }`}
                                                >
                                                    <span className="material-symbols-outlined text-base text-[#6605c7] shrink-0">{cat.icon}</span>
                                                    <span className="text-xs truncate">{cat.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Priority selector */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                                            Priority Level
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {PRIORITIES.map((p) => (
                                                <button
                                                    key={p.value}
                                                    type="button"
                                                    onClick={() => setPriority(p.value)}
                                                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${priority === p.value
                                                        ? `${p.color} ring-2 ring-[#6605c7]/30 font-black`
                                                        : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                                                        }`}
                                                >
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Subject */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">
                                            Ticket Subject / Title <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            placeholder="Briefly state the issue (e.g. Document verification status stuck)"
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#6605c7] focus:bg-white transition-all"
                                        />
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">
                                            Detailed Description & Steps to Reproduce <span className="text-rose-500">*</span>
                                        </label>
                                        <textarea
                                            required
                                            rows={4}
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="Provide complete details, error codes, application numbers or context so our team can resolve it quickly..."
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#6605c7] focus:bg-white transition-all resize-none"
                                        />
                                    </div>

                                    {/* Proof Attachment */}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1.5">
                                            Proof Attachment / Screenshot (Optional, Max 20MB)
                                        </label>
                                        <div className="border-2 border-dashed border-purple-200 hover:border-[#6605c7] rounded-2xl p-4 bg-purple-50/30 transition-all text-center relative group">
                                            <input
                                                type="file"
                                                onChange={handleFileChange}
                                                accept="image/*,.pdf,.doc,.docx,.png,.jpg,.jpeg"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                            />
                                            {proofFile ? (
                                                <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-purple-100 shadow-xs z-20 relative">
                                                    <div className="flex items-center gap-2 text-left truncate">
                                                        <span className="material-symbols-outlined text-[#6605c7]">attach_file</span>
                                                        <div className="truncate">
                                                            <p className="text-xs font-bold text-gray-800 truncate">{proofFile.name}</p>
                                                            <p className="text-[10px] text-gray-400 font-mono">{(proofFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setProofFile(null)}
                                                        className="text-rose-500 hover:text-rose-700 p-1 border-0 bg-transparent cursor-pointer z-30"
                                                    >
                                                        <span className="material-symbols-outlined text-base">close</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                                    <span className="material-symbols-outlined text-2xl text-[#6605c7]">cloud_upload</span>
                                                    <p className="text-xs font-bold text-gray-700">Click or Drag & Drop file here</p>
                                                    <p className="text-[10px] text-gray-400">Supports PNG, JPG, PDF, DOCX up to 20MB</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="pt-2 flex justify-end gap-3 border-t border-gray-100">
                                        <button
                                            type="button"
                                            onClick={onClose}
                                            className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="px-7 py-3 bg-gradient-to-r from-[#6605c7] to-indigo-600 hover:from-[#5204a3] hover:to-indigo-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0 shadow-lg shadow-purple-600/20 disabled:opacity-50 flex items-center gap-2"
                                        >
                                            {submitting ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                    Submitting Ticket...
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-base">send</span>
                                                    Submit Ticket
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )
                        )}

                        {activeTab === "my_tickets" && (
                            selectedTicket ? (
                                <div className="space-y-5">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTicket(null)}
                                        className="text-xs font-bold text-[#6605c7] hover:underline flex items-center gap-1 border-0 bg-transparent cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                                        Back to All Tickets
                                    </button>

                                    <div className="bg-purple-50/50 rounded-2xl border border-purple-100 p-5 space-y-3">
                                        <div className="flex justify-between items-start gap-3">
                                            <div>
                                                <span className="text-[10px] font-mono font-bold text-gray-400 block">{selectedTicket.ticketNumber}</span>
                                                <h4 className="text-base font-bold text-gray-900">{selectedTicket.subject}</h4>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${selectedTicket.status === "resolved" ? "bg-emerald-100 text-emerald-700" :
                                                selectedTicket.status === "out_of_scope" ? "bg-rose-100 text-rose-700 border border-rose-200" :
                                                selectedTicket.status === "closed" ? "bg-gray-100 text-gray-700" :
                                                    selectedTicket.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                                                }`}>
                                                {selectedTicket.status === "out_of_scope" ? "Out of Scope" : selectedTicket.status.replace("_", " ")}
                                            </span>
                                        </div>

                                        <p className="text-xs text-gray-700 font-medium whitespace-pre-line leading-relaxed">{selectedTicket.description}</p>

                                        {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                                            <div className="pt-2 border-t border-purple-100 space-y-2">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Proof Attachments & Images</span>
                                                <div className="space-y-2">
                                                    {selectedTicket.attachments.map((att: any) => {
                                                        const isImg = (att.mimeType || att.fileName || att.fileUrl || att.filePath || "").match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
                                                        const fileUrl = att.fileUrl || att.url || att.filePath || "";
                                                        if (isImg) {
                                                            return (
                                                                <div key={att.id} className="rounded-xl border border-purple-100 bg-white p-2.5 space-y-2">
                                                                    <div className="flex items-center justify-between text-xs font-bold text-[#6605c7]">
                                                                        <span className="truncate">{att.fileName}</span>
                                                                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-[11px] shrink-0">Open Image ↗</a>
                                                                    </div>
                                                                    <div className="rounded-lg overflow-hidden border border-gray-100 max-h-60 bg-gray-50 flex items-center justify-center">
                                                                        <img src={fileUrl} alt={att.fileName} className="max-h-60 w-auto object-contain rounded-lg" />
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return (
                                                            <a
                                                                key={att.id}
                                                                href={fileUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-[#6605c7] hover:bg-purple-100 transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-sm">attachment</span>
                                                                {att.fileName}
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Comments Thread */}
                                    <div className="space-y-3">
                                        <h5 className="text-xs font-black uppercase tracking-wider text-gray-500">Updates & Responses</h5>
                                        {(!selectedTicket.comments || selectedTicket.comments.length === 0) ? (
                                            <p className="text-xs text-gray-400 italic bg-gray-50 p-4 rounded-2xl text-center">No responses yet. Our team will update you shortly.</p>
                                        ) : (
                                            selectedTicket.comments.map((c: any) => (
                                                <div key={c.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-1">
                                                    <div className="flex justify-between items-center text-[10px] font-bold">
                                                        <span className="text-[#6605c7]">{c.authorName} ({c.authorRole})</span>
                                                        <span className="text-gray-400">{formatIST(c.createdAt || c.created_at)}</span>
                                                    </div>
                                                    <p className="text-xs text-gray-700 font-medium">{c.content}</p>
                                                </div>
                                            ))
                                        )}
                                    </div>

                                    {/* Reply Box */}
                                    <form onSubmit={handleSendReply} className="space-y-2 pt-2">
                                        <textarea
                                            rows={2}
                                            value={replyText}
                                            onChange={(e) => setReplyText(e.target.value)}
                                            placeholder="Write a message or reply..."
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium text-gray-800 focus:outline-none focus:border-[#6605c7] focus:bg-white transition-all resize-none"
                                        />
                                        <div className="flex justify-end">
                                            <button
                                                type="submit"
                                                disabled={replying || !replyText.trim()}
                                                className="px-5 py-2 bg-[#6605c7] hover:bg-[#5204a3] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all border-0 disabled:opacity-50 cursor-pointer"
                                            >
                                                {replying ? "Sending..." : "Send Reply"}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            ) : (
                                loadingTickets ? (
                                    <div className="py-12 text-center text-xs font-bold text-gray-400 flex items-center justify-center gap-2">
                                        <div className="w-4 h-4 border-2 border-[#6605c7] border-t-transparent rounded-full animate-spin" />
                                        Loading your support tickets...
                                    </div>
                                ) : myTickets.length === 0 ? (
                                    <div className="py-12 text-center space-y-3">
                                        <span className="material-symbols-outlined text-4xl text-purple-200">confirmation_number</span>
                                        <p className="text-xs text-gray-500 font-bold">You haven't created any support tickets yet.</p>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab("create")}
                                            className="px-4 py-2 bg-[#6605c7] text-white font-bold rounded-xl text-xs uppercase tracking-wider border-0 cursor-pointer"
                                        >
                                            Create Ticket Now
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {myTickets.map((t) => (
                                            <div
                                                key={t.id}
                                                onClick={() => handleSelectTicket(t)}
                                                className="bg-white p-4 rounded-2xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 group"
                                            >
                                                <div className="space-y-1 min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono font-bold text-[#6605c7] bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100">{t.ticketNumber}</span>
                                                        <span className="text-[10px] font-bold text-gray-400">{t.category}</span>
                                                    </div>
                                                    <h5 className="text-xs font-bold text-gray-800 truncate group-hover:text-[#6605c7] transition-colors">{t.subject}</h5>
                                                    <p className="text-[10px] text-gray-400 font-medium">{formatIST(t.createdAt || t.created_at)}</p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${t.status === "resolved" ? "bg-emerald-100 text-emerald-700" :
                                                        t.status === "closed" ? "bg-gray-100 text-gray-700" :
                                                            t.status === "in_progress" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                                                        }`}>
                                                        {t.status.replace("_", " ")}
                                                    </span>
                                                    <span className="material-symbols-outlined text-gray-300 group-hover:text-[#6605c7] transition-colors text-base">chevron_right</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )
                        )}
                    </div>
        </motion.div>
    );

    if (!isModal) {
        return modalContent;
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
                {modalContent}
            </div>
        </AnimatePresence>
    );
}
