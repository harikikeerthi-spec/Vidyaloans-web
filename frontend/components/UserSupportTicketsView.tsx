"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { supportApi, staffProfileApi } from "@/lib/api";

interface UserSupportTicketsViewProps {
    userRole?: string;
    userInfo?: {
        id?: string;
        name?: string;
        email?: string;
    };
}

export interface SupportCategoryItem {
    value: string;
    label: string;
    icon: string;
    color: string;
    badgeColor?: string;
    description?: string;
}

// All 16 categories present in IT Dashboard Filter Tab & Support Operations Center
export const IT_DASHBOARD_CATEGORIES: SupportCategoryItem[] = [
    { value: "Loan Application", label: "Loan Application", icon: "assignment", color: "bg-blue-50 text-blue-700 border-blue-200", badgeColor: "bg-blue-100 text-blue-800", description: "Loan inquiry, eligibility & processing" },
    { value: "Bank Statement", label: "Bank Statement", icon: "account_balance", color: "bg-emerald-50 text-emerald-700 border-emerald-200", badgeColor: "bg-emerald-100 text-emerald-800", description: "Upload, parsing & account statement" },
    { value: "EVV", label: "EVV Verification", icon: "fact_check", color: "bg-teal-50 text-teal-700 border-teal-200", badgeColor: "bg-teal-100 text-teal-800", description: "Electronic verification & fraud check" },
    { value: "OCR", label: "OCR Recognition", icon: "document_scanner", color: "bg-orange-50 text-orange-700 border-orange-200", badgeColor: "bg-orange-100 text-orange-800", description: "Document OCR scanning & text extraction" },
    { value: "Digilocker", label: "DigiLocker Integration", icon: "lock", color: "bg-purple-50 text-purple-700 border-purple-200", badgeColor: "bg-purple-100 text-purple-800", description: "Aadhaar / DigiLocker verification sync" },
    { value: "Document Verification", label: "Document Verification", icon: "verified", color: "bg-amber-50 text-amber-700 border-amber-200", badgeColor: "bg-amber-100 text-amber-800", description: "KYC, academic & collateral documents" },
    { value: "University", label: "University & Admit", icon: "school", color: "bg-indigo-50 text-indigo-700 border-indigo-200", badgeColor: "bg-indigo-100 text-indigo-800", description: "University admit letter & I-20 queries" },
    { value: "Visa", label: "Visa Assistance", icon: "flight_takeoff", color: "bg-pink-50 text-pink-700 border-pink-200", badgeColor: "bg-pink-100 text-pink-800", description: "Visa documents & embassy support" },
    { value: "Payment", label: "Payment & Fees", icon: "payments", color: "bg-green-50 text-green-700 border-green-200", badgeColor: "bg-green-100 text-green-800", description: "Processing fees & transaction issues" },
    { value: "Disbursement", label: "Disbursement & Sanction", icon: "paid", color: "bg-emerald-50 text-emerald-700 border-emerald-200", badgeColor: "bg-emerald-100 text-emerald-800", description: "Sanction letter release & fund disbursement" },
    { value: "EMI", label: "EMI & Repayment", icon: "calendar_month", color: "bg-cyan-50 text-cyan-700 border-cyan-200", badgeColor: "bg-cyan-100 text-cyan-800", description: "Repayment schedule & interest calculation" },
    { value: "Authentication", label: "Authentication / Login", icon: "key", color: "bg-indigo-50 text-indigo-700 border-indigo-200", badgeColor: "bg-indigo-100 text-indigo-800", description: "OTP, login & password reset issues" },
    { value: "Profile", label: "Profile & Account", icon: "person", color: "bg-violet-50 text-violet-700 border-violet-200", badgeColor: "bg-violet-100 text-violet-800", description: "User information & contact details" },
    { value: "API Error", label: "API & Server Error", icon: "dns", color: "bg-rose-50 text-rose-700 border-rose-200", badgeColor: "bg-rose-100 text-rose-800", description: "System endpoint error & network failures" },
    { value: "Technical Issue", label: "Technical & System Error", icon: "bug_report", color: "bg-red-50 text-red-700 border-red-200", badgeColor: "bg-red-100 text-red-800", description: "UI glitch, performance or portal bugs" },
    { value: "Others", label: "General Query / Others", icon: "help_outline", color: "bg-slate-50 text-slate-700 border-slate-200", badgeColor: "bg-slate-100 text-slate-800", description: "General inquiry or unlisted concern" },
];

export const getCategoryMeta = (categoryVal?: string): SupportCategoryItem => {
    if (!categoryVal) {
        return {
            value: "Others",
            label: "Others / General",
            icon: "help_outline",
            color: "bg-slate-50 text-slate-700 border-slate-200",
            badgeColor: "bg-slate-100 text-slate-800",
            description: "General support query"
        };
    }
    const clean = categoryVal.trim().toLowerCase();
    const matched = IT_DASHBOARD_CATEGORIES.find(
        (c) => c.value.toLowerCase() === clean || c.label.toLowerCase() === clean
    );
    if (matched) return matched;
    return {
        value: categoryVal,
        label: categoryVal,
        icon: "category",
        color: "bg-indigo-50 text-indigo-700 border-indigo-200",
        badgeColor: "bg-indigo-100 text-indigo-800",
        description: "Support category"
    };
};

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

export default function UserSupportTicketsView({ userRole = "student", userInfo }: UserSupportTicketsViewProps) {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"my_tickets" | "create">("my_tickets");

    // Selected ticket view
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [replyText, setReplyText] = useState("");
    const [replying, setReplying] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterSearch, setFilterSearch] = useState<string>("");

    // Dynamic available categories (initialized with all 16 IT Dashboard categories)
    const [availableCategories, setAvailableCategories] = useState<SupportCategoryItem[]>(IT_DASHBOARD_CATEGORIES);

    // Form state for creating ticket
    const [subject, setSubject] = useState("");
    const [category, setCategory] = useState("Loan Application");
    const [priority, setPriority] = useState("medium");
    const [description, setDescription] = useState("");
    const [proofFile, setProofFile] = useState<File | null>(null);

    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");
    const [createdTicketNum, setCreatedTicketNum] = useState<string | null>(null);

    // Dynamically fetch any additional custom categories from backend
    useEffect(() => {
        supportApi.getCategories().then((res: any) => {
            const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
            if (list.length > 0) {
                const merged = [...IT_DASHBOARD_CATEGORIES];
                list.forEach((c: any) => {
                    const cName = c.name || c.value;
                    if (cName && !merged.some(m => m.value.toLowerCase() === cName.toLowerCase())) {
                        merged.push({
                            value: cName,
                            label: cName,
                            icon: "category",
                            color: "bg-indigo-50 text-indigo-700 border-indigo-200",
                            badgeColor: "bg-indigo-100 text-indigo-800",
                            description: c.description || "Support category"
                        });
                    }
                });
                setAvailableCategories(merged);
            }
        }).catch(() => {});
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 20 * 1024 * 1024) {
                setFormError("File size exceeds 20MB limit.");
                return;
            }
            setProofFile(file);
            setFormError("");
        }
    };

    useEffect(() => {
        loadTickets();
    }, [userInfo?.id]);

    const loadTickets = async () => {
        setLoading(true);
        try {
            // Always filter by this user's ID — each user should only see their own tickets
            const params: Record<string, any> = { limit: 100, sortBy: "createdAt", sortOrder: "desc" };
            if (userInfo?.id) {
                params.createdById = userInfo.id;
            }
            const res = await supportApi.getTickets(params) as any;
            const data = res?.data || res || {};
            const fetched = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
            setTickets(fetched);
            // Select first ticket if none selected and tickets exist
            if (fetched.length > 0 && !selectedTicket) {
                handleSelectTicket(fetched[0]);
            }
        } catch (err) {
            console.error("Failed to load tickets:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectTicket = async (t: any) => {
        try {
            const detail = await supportApi.getTicket(t.id) as any;
            // getTicket returns the ticket object directly (or wrapped in .data)
            setSelectedTicket(detail?.data || detail);
        } catch (err) {
            setSelectedTicket(t);
        }
    };

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !selectedTicket) return;
        setReplying(true);
        setFormError("");
        try {
            await supportApi.addComment(selectedTicket.id, replyText.trim());

            // Log staff activity in DB
            staffProfileApi.logActivity({
                type: 'update',
                msg: `Replied to Support Ticket #${selectedTicket.ticketNumber || selectedTicket.id?.slice(-6)}`,
                icon: 'chat',
                color: 'bg-[#4F46E5]/10 text-[#4F46E5] border-indigo-100'
            }).catch(console.error);

            setReplyText("");
            // Refresh ticket to show the new comment
            const updated = await supportApi.getTicket(selectedTicket.id) as any;
            setSelectedTicket(updated?.data || updated);
        } catch (err: any) {
            console.error("Failed to send reply:", err);
            setFormError(err?.message || "Failed to send reply. Please try again.");
        } finally {
            setReplying(false);
        }
    };



    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !description.trim()) {
            setFormError("Please enter both a subject and description.");
            return;
        }
        setSubmitting(true);
        setFormError("");
        try {
            // Send JSON payload (not FormData) — attachment is uploaded separately
            const payload = {
                subject: subject.trim(),
                category,
                priority,
                description: description.trim(),
                userRole: userRole || undefined,
                studentName: userInfo?.name || undefined,
                userEmail: userInfo?.email || undefined,
                tags: userRole ? [userRole.toUpperCase()] : [],
            };

            const res = await supportApi.createTicket(payload) as any;
            const newTicket = res?.data || res;
            const ticketId = newTicket?.id;
            const ticketNum = newTicket?.ticketNumber || ("ST-" + Math.floor(100000 + Math.random() * 900000));

            // Upload proof attachment separately if selected
            if (proofFile && ticketId) {
                try {
                    await supportApi.uploadAttachment(ticketId, proofFile);
                } catch (uploadErr: any) {
                    console.warn("Attachment upload warning:", uploadErr);
                }
            }

            // Log staff activity in DB
            staffProfileApi.logActivity({
                type: 'new',
                msg: `Created Support Ticket #${ticketNum}: ${subject.trim()}`,
                icon: 'confirmation_number',
                color: 'bg-purple-50 text-purple-700 border-purple-100'
            }).catch(console.error);

            setCreatedTicketNum(ticketNum);

            // Reset form
            setSubject("");
            setDescription("");
            setProofFile(null);
            loadTickets();
        } catch (err: any) {
            setFormError(err.message || "Failed to create support ticket. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    const filteredTickets = useMemo(() => {
        return tickets.filter((t) => {
            if (filterStatus !== "all" && t.status !== filterStatus) return false;
            if (filterSearch.trim()) {
                const q = filterSearch.toLowerCase().trim();
                const subj = (t.subject || "").toLowerCase();
                const num = (t.ticketNumber || t.id || "").toLowerCase();
                const cat = (t.category || "").toLowerCase();
                const desc = (t.description || "").toLowerCase();
                if (!subj.includes(q) && !num.includes(q) && !cat.includes(q) && !desc.includes(q)) {
                    return false;
                }
            }
            return true;
        });
    }, [tickets, filterStatus, filterSearch]);

    const openCount = tickets.filter((t) => t.status === "open").length;
    const inProgressCount = tickets.filter((t) => t.status === "in_progress" || t.status === "assigned").length;
    const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;

    const homeUrl = userRole === 'staff'
        ? '/staff/dashboard'
        : userRole === 'bank'
            ? '/bank/dashboard'
            : userRole === 'agent'
                ? '/agent/dashboard'
                : '/dashboard';

    return (
        <div className="space-y-6 font-sans">
            {/* Header & Main Page Navigation Banner */}
            <div className="bg-gradient-to-r from-[#6605c7] to-indigo-700 rounded-3xl p-6 md:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href={homeUrl}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-xs font-black uppercase tracking-wider text-white border border-white/25 no-underline transition-all cursor-pointer shadow-sm"
                        >
                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                            Go Back
                        </Link>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-black uppercase tracking-wider text-purple-200 border border-white/20">
                            <span className="material-symbols-outlined text-sm">support_agent</span>
                            Help & Support Center
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-white/20 text-white">
                                {userRole}
                            </span>
                        </div>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black tracking-tight">Support Desk</h2>
                    <p className="text-xs md:text-sm text-purple-200 font-medium">Submit tickets & track resolution progress dynamically in real-time.</p>
                </div>

                {/* Page Navigation Tabs */}
                <div className="flex flex-wrap items-center gap-2 bg-white/10 p-1.5 rounded-2xl border border-white/20 shrink-0 w-full md:w-auto">
                    <button
                        type="button"
                        onClick={() => { setActiveTab("my_tickets"); setCreatedTicketNum(null); }}
                        className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 border-0 cursor-pointer ${activeTab === "my_tickets"
                                ? "bg-white text-[#6605c7] shadow-lg"
                                : "text-white hover:bg-white/10"
                            }`}
                    >
                        <span className="material-symbols-outlined text-base">confirmation_number</span>
                        My Tickets ({tickets.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => { setActiveTab("create"); setCreatedTicketNum(null); }}
                        className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 border-0 cursor-pointer ${activeTab === "create"
                                ? "bg-white text-[#6605c7] shadow-lg"
                                : "text-white hover:bg-white/10"
                            }`}
                    >
                        <span className="material-symbols-outlined text-base">add_circle</span>
                        New Support Ticket
                    </button>
                </div>
            </div>

            {/* TAB 1: CREATE NEW SUPPORT TICKET (PAGE INLINE VIEW) */}
            {activeTab === "create" && (
                <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6 md:p-8 space-y-6">
                    {createdTicketNum ? (
                        <div className="py-12 text-center space-y-6 max-w-md mx-auto">
                            <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                                <span className="material-symbols-outlined text-4xl">check_circle</span>
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-gray-900">Support Ticket Raised!</h3>
                                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                                    Your support ticket has been registered successfully. Our resolution team will review and respond shortly.
                                </p>
                            </div>
                            <div className="inline-block bg-purple-50 border border-purple-200 px-6 py-3 rounded-2xl">
                                <span className="text-xs text-gray-400 font-bold block uppercase tracking-widest">Ticket ID</span>
                                <span className="text-xl font-black text-[#6605c7] font-mono">{createdTicketNum}</span>
                            </div>
                            <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setCreatedTicketNum(null)}
                                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                                >
                                    Raise Another Ticket
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setActiveTab("my_tickets"); setCreatedTicketNum(null); }}
                                    className="px-6 py-3 bg-[#6605c7] hover:bg-[#5204a3] text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0 shadow-lg shadow-purple-600/20"
                                >
                                    View My Tickets List
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleCreateSubmit} className="space-y-6">
                            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#6605c7]">edit_document</span>
                                        Raise a Support Ticket
                                    </h3>
                                    <p className="text-xs text-gray-500 font-medium">
                                        Submitting as: <strong className="text-gray-800">{userInfo?.name || "User"}</strong> ({userInfo?.email || "No email"})
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("my_tickets")}
                                    className="text-xs font-bold text-gray-400 hover:text-gray-600 flex items-center gap-1 border-0 bg-transparent cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                                    Cancel & Go Back
                                </button>
                            </div>

                            {formError && (
                                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">error</span>
                                    {formError}
                                </div>
                            )}

                            {/* Issue Category Select Dropdown */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="issue-category-select" className="block text-xs font-black uppercase tracking-widest text-gray-500">
                                        Issue Category <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[10px] font-bold text-[#6605c7] bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full">
                                        {availableCategories.length} Categories Available
                                    </span>
                                </div>

                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                        <span className="material-symbols-outlined text-[20px] text-[#6605c7]">
                                            {getCategoryMeta(category).icon || "category"}
                                        </span>
                                    </div>
                                    <select
                                        id="issue-category-select"
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full pl-11 pr-10 py-3 bg-gray-50/90 hover:bg-white border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 focus:outline-none focus:border-[#6605c7] focus:bg-white focus:ring-2 focus:ring-[#6605c7]/20 transition-all cursor-pointer appearance-none shadow-2xs"
                                    >
                                        {availableCategories.map((cat) => (
                                            <option key={cat.value} value={cat.value} className="py-2 text-xs font-medium text-gray-800">
                                                {cat.label} {cat.description ? `— ${cat.description}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                                        <span className="material-symbols-outlined text-[20px]">expand_more</span>
                                    </div>
                                </div>

                                {/* Selected Category Preview Info Chip */}
                                {(() => {
                                    const selectedCatMeta = getCategoryMeta(category);
                                    return (
                                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${selectedCatMeta.color}`}>
                                                <span className="material-symbols-outlined text-[15px]">{selectedCatMeta.icon}</span>
                                                {selectedCatMeta.label}
                                            </span>
                                            {selectedCatMeta.description && (
                                                <span className="text-[11px] text-gray-500 font-medium">
                                                    {selectedCatMeta.description}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Priority Selector */}
                            <div className="space-y-2">
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-500">
                                    Priority Level
                                </label>
                                <div className="flex flex-wrap gap-2.5">
                                    {PRIORITIES.map((p) => (
                                        <button
                                            key={p.value}
                                            type="button"
                                            onClick={() => setPriority(p.value)}
                                            className={`px-5 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${priority === p.value
                                                    ? `${p.color} ring-2 ring-[#6605c7]/30 font-black shadow-xs`
                                                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                                                }`}
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Ticket Subject */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-500">
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
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-500">
                                    Detailed Description & Steps to Reproduce <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    required
                                    rows={5}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Provide complete details, error codes, application numbers or context so our team can resolve it quickly..."
                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#6605c7] focus:bg-white transition-all resize-none"
                                />
                            </div>

                            {/* Proof Attachment */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-black uppercase tracking-widest text-gray-500">
                                    Proof Attachment / Screenshot (Optional, Max 20MB)
                                </label>
                                <div className="border-2 border-dashed border-purple-200 hover:border-[#6605c7] rounded-2xl p-6 bg-purple-50/30 transition-all text-center relative group">
                                    <input
                                        type="file"
                                        onChange={handleFileChange}
                                        accept="image/*,.pdf,.doc,.docx,.png,.jpg,.jpeg"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    {proofFile ? (
                                        <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-purple-100 shadow-xs z-20 relative max-w-md mx-auto">
                                            <div className="flex items-center gap-3 text-left truncate">
                                                <span className="material-symbols-outlined text-[#6605c7] text-2xl">attach_file</span>
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
                                                <span className="material-symbols-outlined text-lg">close</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <span className="material-symbols-outlined text-3xl text-[#6605c7]">cloud_upload</span>
                                            <p className="text-xs font-bold text-gray-700">Click or Drag & Drop file here</p>
                                            <p className="text-[10px] text-gray-400">Supports PNG, JPG, PDF, DOCX up to 20MB</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Submit & Cancel Actions */}
                            <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("my_tickets")}
                                    className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-8 py-3 bg-gradient-to-r from-[#6605c7] to-indigo-600 hover:from-[#5204a3] hover:to-indigo-700 text-white font-black rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer border-0 shadow-lg shadow-purple-600/20 disabled:opacity-50 flex items-center gap-2"
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
                    )}
                </div>
            )}

            {/* TAB 2: MY TICKETS LIST & DETAILS VIEW */}
            {activeTab === "my_tickets" && (
                <>
                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div
                            onClick={() => setFilterStatus("all")}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer ${filterStatus === "all" ? "bg-purple-50 border-[#6605c7] shadow-xs" : "bg-white border-gray-100 hover:bg-gray-50"
                                }`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Total Tickets</span>
                            <span className="text-2xl font-black text-gray-900 mt-1 block">{tickets.length}</span>
                        </div>
                        <div
                            onClick={() => setFilterStatus("open")}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer ${filterStatus === "open" ? "bg-amber-50 border-amber-400 shadow-xs" : "bg-white border-gray-100 hover:bg-gray-50"
                                }`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 block">Open Issues</span>
                            <span className="text-2xl font-black text-amber-700 mt-1 block">{openCount}</span>
                        </div>
                        <div
                            onClick={() => setFilterStatus("in_progress")}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer ${filterStatus === "in_progress" ? "bg-blue-50 border-blue-400 shadow-xs" : "bg-white border-gray-100 hover:bg-gray-50"
                                }`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 block">In Progress</span>
                            <span className="text-2xl font-black text-blue-700 mt-1 block">{inProgressCount}</span>
                        </div>
                        <div
                            onClick={() => setFilterStatus("resolved")}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer ${filterStatus === "resolved" ? "bg-emerald-50 border-emerald-400 shadow-xs" : "bg-white border-gray-100 hover:bg-gray-50"
                                }`}
                        >
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 block">Resolved</span>
                            <span className="text-2xl font-black text-emerald-700 mt-1 block">{resolvedCount}</span>
                        </div>
                    </div>

                    {/* Main Content Area: Ticket List & Detail Pane */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left: Ticket Cards List */}
                        <div className="lg:col-span-1 space-y-3">
                            <div className="space-y-2.5">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px] text-[#6605c7]">confirmation_number</span>
                                        Submitted Tickets ({filteredTickets.length})
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={loadTickets}
                                        className="text-xs text-[#6605c7] hover:underline font-bold border-0 bg-transparent cursor-pointer flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-sm">refresh</span> Refresh
                                    </button>
                                </div>

                                {/* Search Filter Bar */}
                                <div className="bg-slate-50/70 p-2 rounded-2xl border border-gray-100">
                                    {/* Real-time search */}
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-sm">search</span>
                                        <input
                                            type="text"
                                            value={filterSearch}
                                            onChange={(e) => setFilterSearch(e.target.value)}
                                            placeholder="Search tickets by ID, title, or keyword..."
                                            className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 focus:border-[#6605c7]"
                                        />
                                        {filterSearch && (
                                            <button
                                                type="button"
                                                onClick={() => setFilterSearch("")}
                                                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs border-0 bg-transparent cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {loading ? (
                                <div className="py-12 text-center text-xs font-bold text-gray-400 bg-white rounded-3xl border border-gray-100">
                                    <div className="w-5 h-5 border-2 border-[#6605c7] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                    Loading support tickets...
                                </div>
                            ) : filteredTickets.length === 0 ? (
                                <div className="py-12 text-center bg-white rounded-3xl border border-gray-100 p-6 space-y-3">
                                    <span className="material-symbols-outlined text-4xl text-purple-200">confirmation_number</span>
                                    <p className="text-xs text-gray-500 font-bold">No support tickets found.</p>
                                    {filterSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setFilterSearch("")}
                                            className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl border-0 cursor-pointer"
                                        >
                                            Clear Search
                                        </button>
                                    )}
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab("create")}
                                            className="px-5 py-2.5 bg-[#6605c7] text-white text-xs font-bold rounded-xl uppercase tracking-wider border-0 cursor-pointer shadow-md"
                                        >
                                            Raise Support Ticket
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[650px] overflow-y-auto pr-1">
                                    {filteredTickets.map((t) => {
                                        const catMeta = getCategoryMeta(t.category);
                                        const isSelected = selectedTicket?.id === t.id;
                                        return (
                                            <div
                                                key={t.id}
                                                onClick={() => handleSelectTicket(t)}
                                                className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${isSelected
                                                        ? "border-[#6605c7] bg-purple-50/50 shadow-md ring-2 ring-[#6605c7]/20"
                                                        : "border-gray-200/80 bg-white hover:border-purple-200 hover:shadow-xs"
                                                    }`}
                                            >
                                                {/* Card Top: Ticket ID + Prominent Category Badge + Status */}
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[10px] font-mono font-bold text-[#6605c7] bg-purple-100/60 px-2 py-0.5 rounded-md">
                                                            {t.ticketNumber || `#${(t.id || '').slice(-6)}`}
                                                        </span>
                                                        {/* Category Badge on Ticket Card */}
                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${catMeta.color}`}>
                                                            <span className="material-symbols-outlined text-[13px]">{catMeta.icon}</span>
                                                            {t.category || "Others"}
                                                        </span>
                                                    </div>
                                                    <span
                                                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${t.status === "resolved"
                                                                ? "bg-emerald-100 text-emerald-700"
                                                                : t.status === "closed"
                                                                    ? "bg-gray-100 text-gray-700"
                                                                    : t.status === "in_progress"
                                                                        ? "bg-blue-100 text-blue-700"
                                                                        : "bg-amber-100 text-amber-700"
                                                            }`}
                                                    >
                                                        {(t.status || 'open').replace("_", " ")}
                                                    </span>
                                                </div>

                                                {/* Subject */}
                                                <h4 className="text-xs font-bold text-gray-900 line-clamp-2 leading-snug">{t.subject}</h4>

                                                {/* Card Bottom: Explicit Category Name Display + Date */}
                                                <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium pt-1.5 border-t border-gray-100/80">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-gray-400 font-bold uppercase tracking-wider text-[9px]">Category:</span>
                                                        <span className="font-bold text-gray-800">{t.category || "Others"}</span>
                                                    </div>
                                                    <span className="text-gray-400">{formatIST(t.createdAt || t.created_at)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Right: Ticket Detail & Responses */}
                        <div className="lg:col-span-2">
                            {selectedTicket ? (
                                <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-6">
                                    <div className="flex justify-between items-start gap-4 pb-4 border-b border-gray-100 flex-wrap">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-mono font-bold text-[#6605c7] bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                                                    {selectedTicket.ticketNumber || `#${(selectedTicket.id || '').slice(-6)}`}
                                                </span>
                                                {/* Prominent Category Badge in Detail Pane */}
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black border ${getCategoryMeta(selectedTicket.category).color}`}>
                                                    <span className="material-symbols-outlined text-[15px]">{getCategoryMeta(selectedTicket.category).icon}</span>
                                                    Category: {selectedTicket.category || "Others"}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900">{selectedTicket.subject}</h3>
                                        </div>
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shrink-0 ${selectedTicket.status === "resolved"
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : selectedTicket.status === "out_of_scope"
                                                        ? "bg-rose-100 text-rose-700 border border-rose-200"
                                                        : selectedTicket.status === "closed"
                                                            ? "bg-gray-100 text-gray-700"
                                                            : selectedTicket.status === "in_progress"
                                                                ? "bg-blue-100 text-blue-700"
                                                                : "bg-amber-100 text-amber-700"
                                                }`}
                                        >
                                            {selectedTicket.status === "out_of_scope" ? "Out of Scope" : selectedTicket.status.replace("_", " ")}
                                        </span>
                                    </div>

                                    {/* Ticket Description */}
                                    <div className="space-y-2 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Description</span>
                                        <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-line font-medium">{selectedTicket.description}</p>
                                    </div>

                                    {/* Proof Attachments & Image Previews */}
                                    {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                                        <div className="space-y-3">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">Uploaded Proof & Attachments</span>
                                            <div className="space-y-3">
                                                {selectedTicket.attachments.map((att: any) => {
                                                    const isImg = (att.mimeType || att.fileName || att.fileUrl || att.filePath || "").match(/\.(jpg|jpeg|png|webp|gif|svg)$/i);
                                                    const fileUrl = att.fileUrl || att.url || att.filePath || "";
                                                    if (isImg) {
                                                        return (
                                                            <div key={att.id} className="rounded-2xl border border-purple-100 bg-purple-50/20 p-3.5 space-y-2.5">
                                                                <div className="flex items-center justify-between text-xs font-bold text-[#6605c7]">
                                                                    <span className="truncate flex items-center gap-1.5">
                                                                        <span className="material-symbols-outlined text-sm">photo_library</span>
                                                                        {att.fileName}
                                                                    </span>
                                                                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline text-[11px] shrink-0 font-bold">Open Full Image ↗</a>
                                                                </div>
                                                                <div className="rounded-xl overflow-hidden border border-purple-100 max-h-80 bg-slate-900/5 flex items-center justify-center p-2">
                                                                    <img src={fileUrl} alt={att.fileName} className="max-h-72 w-auto object-contain rounded-lg shadow-xs" />
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
                                                            className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold text-[#6605c7] transition-all"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">attachment</span>
                                                            {att.fileName}
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Updates & Responses Thread */}
                                    <div className="space-y-4 pt-2">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">Official Responses & History</h4>
                                        {!selectedTicket.comments || selectedTicket.comments.length === 0 ? (
                                            <div className="p-6 rounded-2xl bg-purple-50/40 text-center space-y-1 border border-purple-100">
                                                <p className="text-xs font-bold text-[#6605c7]">Ticket Under Review</p>
                                                <p className="text-[11px] text-gray-400">Our resolution team has received your ticket and will update you shortly.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {selectedTicket.comments.map((c: any) => (
                                                    <div key={c.id} className="p-4 rounded-2xl bg-white border border-gray-100 shadow-2xs space-y-1.5">
                                                        <div className="flex justify-between items-center text-[10px] font-bold">
                                                            <span className="text-[#6605c7] font-black">
                                                                {c.authorName} ({c.authorRole})
                                                            </span>
                                                            <span className="text-gray-400">{formatIST(c.createdAt || c.created_at)}</span>
                                                        </div>
                                                        <p className="text-xs text-gray-700 font-medium leading-relaxed">{c.content}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Reply Input Box */}
                                    <form onSubmit={handleSendReply} className="space-y-2 pt-2 border-t border-gray-100">
                                        {/* Error message from sending reply */}
                                        {formError && (
                                            <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-600">
                                                <span className="material-symbols-outlined text-sm">error</span>
                                                {formError}
                                            </div>
                                        )}
                                        <textarea
                                            rows={3}
                                            value={replyText}
                                            onChange={(e) => { setReplyText(e.target.value); if (formError) setFormError(""); }}
                                            placeholder="Write a message or reply to support team..."
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium text-gray-800 focus:outline-none focus:border-[#6605c7] focus:bg-white transition-all resize-none"
                                        />
                                        <div className="flex justify-end">
                                            <button
                                                type="submit"
                                                disabled={replying || !replyText.trim()}
                                                className="px-6 py-2.5 bg-[#6605c7] hover:bg-[#5204a3] text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all border-0 disabled:opacity-50 cursor-pointer shadow-md flex items-center gap-2"
                                            >
                                                {replying ? (
                                                    <>
                                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Sending...
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="material-symbols-outlined text-sm">send</span>
                                                        Send Reply
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            ) : (
                                <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center space-y-3">
                                    <span className="material-symbols-outlined text-4xl text-purple-200">touch_app</span>
                                    <h4 className="text-sm font-bold text-gray-700">Select a support ticket from the list</h4>
                                    <p className="text-xs text-gray-400 max-w-sm mx-auto">
                                        Click any ticket on the left pane to review its status, view uploaded proof attachments, or reply to our support team.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
