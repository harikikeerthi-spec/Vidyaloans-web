"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffLayout } from "@/app/staff/layout";
import { adminApi, apiFetch } from "@/lib/api";
import ApplicationDetailView from "@/components/staff/ApplicationDetailView";
import SendEmailModal from "@/components/staff/SendEmailModal";
import { Filter, ChevronDown, MessageSquare, Mail } from "lucide-react";

const getCountryDisplay = (country?: string) => {
    if (!country) return null;
    const c = country.toLowerCase().trim();
    let flag = "🌍";
    if (c.includes("canada")) flag = "🇨🇦";
    else if (c.includes("uk") || c.includes("united kingdom") || c.includes("england") || c.includes("britain")) flag = "🇬🇧";
    else if (c.includes("usa") || c.includes("united states") || c.includes("america")) flag = "🇺🇸";
    else if (c.includes("germany") || c.includes("deutschland")) flag = "🇩🇪";
    else if (c.includes("australia")) flag = "🇦🇺";
    else if (c.includes("ireland")) flag = "🇮🇪";
    else if (c.includes("france")) flag = "🇫🇷";
    else if (c.includes("india")) flag = "🇮🇳";
    else if (c.includes("new zealand")) flag = "🇳🇿";
    return `${flag} ${country}`;
};

const formatStatusLabel = (status: string): string => {
    if (!status) return "Pending";
    const norm = status.toLowerCase().replace(/_/g, " ");
    if (norm.includes("file logged")) return "File Logged";
    if (norm.includes("submitted to bank") || norm.includes("submit to bank")) return "Submitted to Bank";
    if (norm.includes("under review") || norm.includes("under bank review")) return "Under Review";
    if (norm.includes("docs received") || norm.includes("documents received")) return "Docs Received";
    if (norm.includes("staff verified") || norm.includes("docs verified")) return "Verified";
    if (norm.includes("disbursed") || norm.includes("disbursement")) return "Disbursed";
    if (norm.includes("sanctioned") || norm.includes("sanction")) return "Sanctioned";
    if (norm.includes("approved")) return "Approved";
    if (norm.includes("rejected")) return "Rejected";
    if (norm.includes("processing")) return "Processing";
    if (norm.includes("pending")) return "Pending";
    return norm.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

const getApplicationDisplayProgress = (app: any): number => {
    const status = (app.status || "").toLowerCase();
    const stage = (app.stage || "").toLowerCase();
    const bankWorkflow = (app.bankWorkflowStatus || "").toUpperCase();

    if (status === "disbursed" || status === "disbursement_confirmed" || status === "closed" || bankWorkflow === "DISBURSED") return 100;
    if (status === "approved" || stage === "sanction" || stage === "sanctioned") return Math.max(app.progress ?? 0, 95);
    if (stage === "bank_review" || status === "under_bank_review" || status === "processing") return Math.max(app.progress ?? 0, 90);
    if (stage === "credit_check" || status === "query_raised") return Math.max(app.progress ?? 0, 75);
    if (stage === "submit_to_bank" || stage === "bank_submission" || status === "submitted_to_bank" || status === "file_logged") return Math.max(app.progress ?? 0, 50);
    if (stage === "document_verification" || stage === "documents_verification" || status === "staff_verified" || status === "docs_received" || status === "docs_uploaded" || status === "under_review") return Math.max(app.progress ?? 0, 40);
    if (status === "submitted" || stage === "application_submitted") return Math.max(app.progress ?? 0, 25);
    return app.progress ?? 10;
};

const renderBankLogo = (name: string, sizeClass: string = "h-11") => {
    const b = name.toLowerCase();
    if (b.includes('idfc')) return <img src="/images/lenders/idfc-first-bank.jpg" alt="IDFC" className={`${sizeClass} object-contain`} />;
    if (b.includes('avanse')) return <img src="/images/lenders/avanse.jpg" alt="Avanse" className={`${sizeClass} object-contain`} />;
    if (b.includes('auxilo')) return <img src="/images/lenders/auxilo.png" alt="Auxilo" className={`${sizeClass} object-contain`} />;
    if (b.includes('credila') || b.includes('hdfc')) return <img src="/images/lenders/hdfc-credila.png" alt="Credila" className={`${sizeClass} object-contain`} />;
    if (b.includes('poonawalla')) return <img src="/images/lenders/poonawalla.png" alt="Poonawalla" className={`${sizeClass} object-contain`} />;
    if (b.includes('incred')) return <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] font-black border border-purple-200">InCred</span>;
    return <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[9px] font-black border border-slate-200">{name}</span>;
};

const getApplicationStageLabel = (app: any, progress: number): string => {
    if (app.currentStage) return app.currentStage;
    const status = (app.status || "").toLowerCase();
    if (status === "disbursed" || status === "disbursement_confirmed" || status === "closed" || (app.bankWorkflowStatus || "").toUpperCase() === "DISBURSED") return "Disbursed";
    if (progress <= 12) return "Created";
    if (progress <= 25) return "Submitted";
    if (progress <= 40) return "Documents";
    if (progress <= 50) return "Submit to Bank";
    if (progress <= 75) return "Credit Check";
    if (progress <= 90) return "Review";
    if (progress <= 95) return "Sanction";
    return "Disbursed";
};

const StudentContactDropdownBesideName = ({
    phone,
    email,
    name,
    onOpenEmailModal,
}: {
    phone?: string;
    email?: string;
    name?: string;
    onOpenEmailModal?: (email: string, name: string) => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
    const [copiedText, setCopiedText] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const updatePosition = useCallback(() => {
        if (!menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        const dropdownApproxHeight = 110;
        const spaceBelow = window.innerHeight - rect.bottom;
        const shouldOpenUp = spaceBelow < dropdownApproxHeight && rect.top > dropdownApproxHeight;

        let left = rect.left;
        const menuWidth = 280;
        if (left + menuWidth > window.innerWidth - 16) {
            left = Math.max(16, window.innerWidth - menuWidth - 16);
        }

        setOpenUpward(shouldOpenUp);
        setCoords({
            top: shouldOpenUp ? rect.top - 6 : rect.bottom + 6,
            left,
        });
    }, []);

    useEffect(() => {
        if (!isOpen) return;

        updatePosition();

        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current && !menuRef.current.contains(event.target as Node) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        const handleScrollOrResize = () => {
            updatePosition();
        };

        document.addEventListener("mousedown", handleClickOutside);
        window.addEventListener("scroll", handleScrollOrResize, true);
        window.addEventListener("resize", handleScrollOrResize);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("scroll", handleScrollOrResize, true);
            window.removeEventListener("resize", handleScrollOrResize);
        };
    }, [isOpen, updatePosition]);

    const toggleOpen = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isOpen) {
            updatePosition();
            setIsOpen(true);
        } else {
            setIsOpen(false);
        }
    };

    const handleCopy = (text: string, label: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!text || text === '—') return;
        navigator.clipboard.writeText(text);
        setCopiedText(label);
        setTimeout(() => setCopiedText(null), 1800);
    };

    const cleanPhone = phone ? phone.replace(/[^0-9+]/g, '') : '';
    const hasPhone = Boolean(phone && phone !== '—');
    const hasEmail = Boolean(email && email !== '—');

    if (!hasPhone && !hasEmail) return null;

    return (
        <div ref={menuRef} className="relative inline-flex items-center">
            {/* Single Dropdown Button beside student name */}
            <button
                type="button"
                onClick={toggleOpen}
                className="w-6 h-6 rounded-full bg-purple-50 hover:bg-purple-100 text-[#6605c7] border border-purple-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
                title="Click for Phone & Email options"
            >
                <span className="material-symbols-outlined text-[15px]">
                    {isOpen ? 'expand_less' : 'expand_more'}
                </span>
            </button>

            {copiedText && (
                <span className="absolute left-8 top-0 whitespace-nowrap text-[9px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 animate-fade-in z-50 shadow-xs">
                    {copiedText} Copied!
                </span>
            )}

            {/* Dropdown Options Popover */}
            {isOpen && mounted && coords && typeof document !== 'undefined' && createPortal(
                <div
                    ref={dropdownRef}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        position: 'fixed',
                        top: `${coords.top}px`,
                        left: `${coords.left}px`,
                        transform: openUpward ? 'translateY(-100%)' : 'none',
                        zIndex: 99999,
                    }}
                    className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl p-2 min-w-[270px] max-w-[340px] text-xs font-semibold text-slate-700 space-y-1.5 animate-fade-in"
                >
                    {/* Phone Options */}
                    {hasPhone && (
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50/80 hover:bg-purple-50/40 rounded-xl border border-slate-100 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="material-symbols-outlined text-[15px] text-[#6605c7] shrink-0">call</span>
                                <span className="font-mono text-slate-800 text-[12px] font-bold tracking-tight truncate">{phone}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <a
                                    href={`tel:${cleanPhone}`}
                                    onClick={() => setIsOpen(false)}
                                    className="w-7 h-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                                    title={`Call ${cleanPhone}`}
                                >
                                    <span className="material-symbols-outlined text-[14px]">phone_in_talk</span>
                                </a>

                                <button
                                    type="button"
                                    onClick={(e) => handleCopy(phone!, 'Phone', e)}
                                    className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-2xs ${copiedText === 'Phone' ? 'bg-emerald-50 text-emerald-600 border-emerald-300' : 'bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 border-slate-200'}`}
                                    title="Copy Phone Number"
                                >
                                    <span className="material-symbols-outlined text-[14px]">
                                        {copiedText === 'Phone' ? 'check' : 'content_copy'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Email Options */}
                    {hasEmail && (
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50/80 hover:bg-indigo-50/40 rounded-xl border border-slate-100 transition-colors">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="material-symbols-outlined text-[15px] text-[#6605c7] shrink-0">mail</span>
                                <span className="font-mono text-slate-700 text-[11px] font-semibold truncate max-w-[150px]" title={email}>{email}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {onOpenEmailModal && (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); onOpenEmailModal(email!, name || ''); }}
                                        className="w-7 h-7 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                                        title="Send Email"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">send</span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={(e) => handleCopy(email!, 'Email', e)}
                                    className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-2xs ${copiedText === 'Email' ? 'bg-emerald-50 text-emerald-600 border-emerald-300' : 'bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 border-slate-200'}`}
                                    title="Copy Email Address"
                                >
                                    <span className="material-symbols-outlined text-[14px]">
                                        {copiedText === 'Email' ? 'check' : 'content_copy'}
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
};

function ApplicationsPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const appIdParam = searchParams.get("id");
    const { onlineEmails } = useStaffLayout();
    const { user } = useAuth();

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const applicationsPerPage = 20;
    const [selectedApp, setSelectedApp] = useState<any | null>(null);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailModalRecipient, setEmailModalRecipient] = useState("");
    const [emailModalRecipientName, setEmailModalRecipientName] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const res: any = await adminApi.getApplications({ limit: "1000" });
            if (res && res.data) {
                setData(res.data);
            } else {
                setData(Array.isArray(res) ? res : []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        if (appIdParam) {
            const found = data.find(app => (app.id || app._id) === appIdParam);
            if (found) {
                const targetUserId = found.userId || found.studentId || found.user?.id || found.user_id || found.applicantId;
                if (targetUserId) {
                    router.replace(`/staff/users/${targetUserId}/applications`);
                    return;
                }
            }
            adminApi.getApplication(appIdParam)
                .then((res: any) => {
                    const app = res?.data || res;
                    const targetUserId = app?.userId || app?.studentId || app?.user?.id || app?.user_id || app?.applicantId;
                    if (targetUserId) {
                        router.replace(`/staff/users/${targetUserId}/applications`);
                    } else {
                        router.replace("/staff/users");
                    }
                })
                .catch(() => {
                    router.replace("/staff/users");
                });
        }
    }, [appIdParam, data, router]);

    const filteredData = useMemo(() => {
        const isPureStaff = user?.role === 'staff';
        const staffId = (user?.id || '').toLowerCase();
        const staffEmail = (user?.email || '').toLowerCase();

        return data.filter(item => {
            // Strict per-staff isolation for pure staff role
            if (isPureStaff && staffId) {
                const assignedId = (item.assignedStaffId || '').toLowerCase();
                const assignedEmail = (item.assignedStaffEmail || '').toLowerCase();
                const matchesStaff = (
                    assignedId === staffId ||
                    (staffEmail && assignedId === staffEmail) ||
                    (staffEmail && assignedEmail === staffEmail)
                );
                if (!matchesStaff) return false;
            }

            const status = (item.status || "draft").toLowerCase();
            const bankWorkflow = (item.bankWorkflowStatus || "").toUpperCase();

            // Rejected, cancelled, and draft applications do not belong in Active Pipeline
            if (status === "rejected" || status === "cancelled" || status === "draft" || bankWorkflow === "REJECTED") {
                return false;
            }

            // Active Pipeline MUST ONLY include applications that HAVE BEEN sent to a bank
            const isSentToBank = Boolean(
                item.submittedToBankAt ||
                item.bankSubmissionId ||
                (bankWorkflow && bankWorkflow !== "NONE" && bankWorkflow !== "") ||
                ["submitted_to_bank", "routed_multiparty", "file_logged", "under_bank_review", "processing", "sanctioned", "approved", "disbursed", "disbursement_confirmed"].includes(status)
            );

            if (!isSentToBank) return false;

            // Applications are already securely filtered by backend role & staff assignment query

            const fullName = `${item.firstName || item.student?.firstName || ''} ${item.lastName || item.student?.lastName || ''}`.toLowerCase();
            const college = (item.universityName || item.college || '').toLowerCase();
            const email = (item.email || item.student?.email || item.user?.email || '').toLowerCase();
            const phone = (item.phone || item.mobile || item.student?.phone || item.student?.mobile || item.user?.phone || '').toLowerCase();
            const query = searchQuery.toLowerCase();
            const matchesSearch = fullName.includes(query) || college.includes(query) || email.includes(query) || phone.includes(query);
            if (!matchesSearch) return false;
            if (filterStatus === "all") return true;
            if (filterStatus === "pending") return ["pending", "draft", "submitted"].includes(status);
            if (filterStatus === "processing") return ["processing", "submitted_to_bank", "routed_multiparty", "file_logged", "docs_received", "staff_verified", "under_review", "docs_uploaded"].includes(status);
            if (filterStatus === "approved") return ["approved", "verified", "disbursed", "disbursement_confirmed"].includes(status);
            return status === filterStatus;
        });
    }, [data, searchQuery, filterStatus, user]);

    const totalPages = Math.max(1, Math.ceil(filteredData.length / applicationsPerPage));
    const pagedData = useMemo(() => {
        const start = (currentPage - 1) * applicationsPerPage;
        return filteredData.slice(start, start + applicationsPerPage);
    }, [filteredData, currentPage]);

    const showingStart = Math.min((currentPage - 1) * applicationsPerPage + 1, filteredData.length);
    const showingEnd = Math.min(currentPage * applicationsPerPage, filteredData.length);

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-[#0A2540]">Active Applications Pipeline</h1>
                </div>
                <div className="flex items-center gap-2.5">
                    {/* Search Input */}
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            placeholder="Search active pipeline..."
                            className="h-9 pl-9 pr-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 w-56 shadow-2xs placeholder:text-slate-400"
                        />
                    </div>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={loadData}
                        className="h-9 w-9 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center justify-center shadow-2xs cursor-pointer shrink-0"
                        title="Refresh Active Pipeline"
                    >
                        <span className="material-symbols-outlined text-[16px]">refresh</span>
                    </button>

                    {/* Status Filter Dropdown */}
                    <div className="relative inline-flex items-center">
                        <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                        <select
                            value={filterStatus}
                            onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                            className="h-9 pl-8 pr-8 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs cursor-pointer appearance-none"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="processing">Processing</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="rounded-[24px] border border-slate-100 overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto min-h-[320px]">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 border-y border-slate-200/80 text-slate-400 text-[11px] font-semibold tracking-wider uppercase text-left">
                            <tr>
                                <th className="px-6 py-3.5 whitespace-nowrap">Applicant Profile</th>
                                <th className="px-6 py-3.5 whitespace-nowrap">College Name</th>
                                <th className="px-6 py-3.5 whitespace-nowrap">Target Bank</th>
                                <th className="px-6 py-3.5 whitespace-nowrap">Stage & Progress</th>
                                <th className="px-6 py-3.5 whitespace-nowrap">Current Status</th>
                                <th className="px-6 py-3.5 whitespace-nowrap text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className={`divide-y divide-slate-50 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
                            {pagedData.length > 0 ? pagedData.map((item: any) => {
                                const rowId = item.id || item._id;
                                const initials = `${(item.firstName || item.student?.firstName || '?')[0]}${(item.lastName || item.student?.lastName || '')[0] || ''}`;
                                const progress = getApplicationDisplayProgress(item);
                                const stageLabel = getApplicationStageLabel(item, progress);
                                const statusKey = (item.status || 'draft').toLowerCase();
                                let bankName = item.bank || item.targetBank || item.lender || "IDFC FIRST Bank";
                                if (!bankName || bankName.toLowerCase().includes('any') || bankName.toLowerCase().includes('pending')) {
                                    const sub = item.bankSubmissions?.[0] || item.submissions?.[0];
                                    if (sub?.bankName || sub?.bank) {
                                        bankName = sub.bankName || sub.bank;
                                    } else if (item.targetBank && !item.targetBank.toLowerCase().includes('any')) {
                                        bankName = item.targetBank;
                                    } else {
                                        bankName = "IDFC FIRST Bank";
                                    }
                                }
                                const userEmail = item.email || item.student?.email || item.user?.email || "";
                                const userPhone = item.phone || item.mobile || item.student?.phone || item.student?.mobile || item.user?.phone || item.user?.mobile || "";

                                return (
                                    <tr key={rowId} className="hover:bg-slate-50/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const uid = item.userId || item.user_id || item.student?.id || item.student?._id;
                                                        const fName = item.firstName || item.student?.firstName || "";
                                                        const lName = item.lastName || item.student?.lastName || "";
                                                        const appNum = item.applicationNumber || "";

                                                        const query = new URLSearchParams();
                                                        if (uid) query.set("userId", uid);
                                                        if (item.id || item._id) query.set("applicationId", item.id || item._id);
                                                        if (appNum) query.set("applicationNumber", appNum);

                                                        router.push(`/staff/chat-customer?${query.toString()}`);
                                                    }}
                                                    className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer transition-all shadow-xs hover:scale-105"
                                                    title="Click to open Support Chat with Student"
                                                >
                                                    {initials.toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <p
                                                             onClick={(e) => {
                                                                 e.stopPropagation();
                                                                 const uid = item.studentId || item.student?.studentId || item.userId || item.user_id || item.student?.id;
                                                                 if (uid) {
                                                                     window.open(`/staff/users/${uid}`, '_blank');
                                                                 } else {
                                                                     router.push(`/staff/users?search=${encodeURIComponent(item.firstName || '')}`);
                                                                 }
                                                             }}
                                                            className="text-sm font-semibold text-slate-900 hover:text-indigo-600 cursor-pointer transition-colors whitespace-nowrap truncate max-w-[170px]"
                                                            title={`${item.firstName || ''} ${item.lastName || ''}`}
                                                        >
                                                            {item.firstName || item.student?.firstName || "—"} {item.lastName || item.student?.lastName || ""}
                                                        </p>
                                                        <div onClick={(e) => e.stopPropagation()}>
                                                            <StudentContactDropdownBesideName
                                                                phone={userPhone}
                                                                email={userEmail}
                                                                name={`${item.firstName || item.student?.firstName || ''} ${item.lastName || item.student?.lastName || ''}`.trim()}
                                                                onOpenEmailModal={(email, name) => {
                                                                    setEmailModalRecipient(email);
                                                                    setEmailModalRecipientName(name);
                                                                    setIsEmailModalOpen(true);
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                    <span className="font-mono text-xs whitespace-nowrap block mt-0.5">
                                                        {item.applicationNumber ? (
                                                            <span className="text-slate-600 font-semibold">{item.applicationNumber}</span>
                                                        ) : (
                                                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px] font-bold tracking-tight">
                                                                Pending Bank Submission
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="max-w-[220px]">
                                                <span
                                                    className="text-sm font-semibold text-slate-800 block truncate"
                                                    title={item.universityName || item.college || "—"}
                                                >
                                                    {item.universityName || item.college || "—"}
                                                </span>
                                                {item.country && (
                                                    <span className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 truncate font-medium">
                                                        {getCountryDisplay(item.country)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="h-8 px-2.5 rounded-md border border-slate-200 bg-slate-50/70 inline-flex items-center gap-2 shadow-2xs max-w-[200px]">
                                                {renderBankLogo(bankName, "h-4 max-w-[50px]")}
                                                <span className="text-xs font-semibold text-slate-700 whitespace-nowrap truncate max-w-[110px]" title={bankName}>
                                                    {bankName.replace(" Finserve", "").replace(" Financial", "").replace(" Fincorp", "").replace(" FIRST Bank", "")}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="w-36 space-y-1">
                                                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                                                    <span className="truncate max-w-[85px]">{stageLabel}</span>
                                                    <span className="tabular-nums text-slate-700 font-semibold">{progress}%</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-1.5 rounded-full transition-all duration-500 ${progress === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                                                        style={{ width: `${progress}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {(() => {
                                                const label = formatStatusLabel(item.status || "Pending");
                                                const norm = (item.status || "").toLowerCase();
                                                const isRejected = norm.includes("rejected") || norm.includes("cancel");
                                                const isApproved = norm.includes("approved") || norm.includes("sanction") || norm.includes("disburs") || norm.includes("verified");
                                                const isProcessing = norm.includes("process") || norm.includes("bank") || norm.includes("review") || norm.includes("file");

                                                const pillClasses = isRejected
                                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                                    : isApproved
                                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                                        : isProcessing
                                                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                                            : "border-amber-200 bg-amber-50 text-amber-700";

                                                const dotClasses = isRejected
                                                    ? "bg-rose-500"
                                                    : isApproved
                                                        ? "bg-emerald-500"
                                                        : isProcessing
                                                            ? "bg-indigo-500"
                                                            : "bg-amber-500";

                                                return (
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${pillClasses} whitespace-nowrap shadow-2xs`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${dotClasses} shrink-0`} />
                                                        <span>{label}</span>
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        let targetBank = bankName || "";
                                                        if (targetBank.includes(',')) targetBank = targetBank.split(',')[0].trim();
                                                        const appNo = item.applicationNumber || `APP-${(item.id || item._id || 'UNKNOWN').slice(-6)}`;
                                                        router.push(`/staff/chat-customer?bankName=${encodeURIComponent(targetBank.trim())}&applicationId=${item.id || item._id}&applicationNumber=${encodeURIComponent(appNo)}`);
                                                    }}
                                                    className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs active:scale-95"
                                                    title="Chat with Bank"
                                                >
                                                    <MessageSquare className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                    <span>Chat</span>
                                                </button>

                                                {(item.email || item.student?.email) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const email = item.email || item.student?.email;
                                                            const name = `${item.firstName || item.student?.firstName || ''} ${item.lastName || item.student?.lastName || ''}`.trim();
                                                            setEmailModalRecipient(email);
                                                            setEmailModalRecipientName(name);
                                                            setIsEmailModalOpen(true);
                                                        }}
                                                        className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-2xs active:scale-95"
                                                        title="Send Email"
                                                    >
                                                        <Mail className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                        <span>Email</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            }) : (
                                <tr>
                                    <td colSpan={6} className="px-8 py-24 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4 text-slate-400">
                                            <span className="material-symbols-outlined text-5xl">inventory_2</span>
                                            <p className="text-xs font-black uppercase tracking-widest">No Active Applications Found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredData.length > 0 && (
                    <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
                        <p className="text-xs font-bold text-slate-700">
                            Showing <span className="text-indigo-600 font-extrabold">{showingStart}–{showingEnd}</span> of <span className="font-extrabold">{filteredData.length}</span> applications &nbsp;·&nbsp; Page <span className="text-indigo-600 font-extrabold">{currentPage}</span> of <span className="font-extrabold">{totalPages}</span>
                        </p>
                        <div className="flex items-center gap-1.5">
                            <button
                                disabled={currentPage === 1 || loading}
                                onClick={() => setCurrentPage(1)}
                                className="w-8 h-8 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-all flex items-center justify-center shadow-2xs"
                                title="First page"
                            >
                                <span className="material-symbols-outlined text-[15px]">first_page</span>
                            </button>
                            <button disabled={currentPage === 1 || loading} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all flex items-center gap-1 shadow-2xs">
                                <span className="material-symbols-outlined text-[15px]">chevron_left</span>Prev
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                                const page = startPage + i;
                                if (page > totalPages) return null;
                                return (
                                    <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-lg text-[11px] font-black transition-all shadow-2xs ${page === currentPage ? 'bg-indigo-600 text-white border border-indigo-600' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                        {page}
                                    </button>
                                );
                            })}
                            <button disabled={currentPage >= totalPages || loading} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all flex items-center gap-1 shadow-2xs">
                                Next<span className="material-symbols-outlined text-[15px]">chevron_right</span>
                            </button>
                            <button
                                disabled={currentPage >= totalPages || loading}
                                onClick={() => setCurrentPage(totalPages)}
                                className="w-8 h-8 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-all flex items-center justify-center shadow-2xs"
                                title="Last page"
                            >
                                <span className="material-symbols-outlined text-[15px]">last_page</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <SendEmailModal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                recipientEmail={emailModalRecipient}
                recipientName={emailModalRecipientName}
            />
        </div>
    );
}

export default function ApplicationsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
            </div>
        }>
            <ApplicationsPageInner />
        </Suspense>
    );
}
