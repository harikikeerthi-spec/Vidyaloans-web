"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffLayout } from "@/app/staff/layout";
import { adminApi, staffProfileApi, apiFetch, assignmentApi } from "@/lib/api";
import Link from "next/link";
import SendEmailModal from "@/components/staff/SendEmailModal";
import ShareWithBankModal from "@/components/staff/ShareWithBankModal";

import { useDialog } from "@/contexts/DialogContext";
import { motion, AnimatePresence } from "framer-motion";
import { checkFollowUpConflict, DEFAULT_TIME_SLOTS, formatSlot12Hr, getTodayDateString } from "@/lib/followUpUtils";

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

const convertToIST = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    let cleanDs = dateStr;
    if (typeof cleanDs === 'string' && !cleanDs.includes('Z') && !cleanDs.includes('+')) {
        if (cleanDs.includes('T') || cleanDs.includes(':')) {
            const formatted = cleanDs.replace(' ', 'T');
            cleanDs = formatted.includes('Z') ? formatted : formatted + 'Z';
        }
    }
    const utcDate = new Date(cleanDs);
    return new Date(utcDate.getTime() + IST_OFFSET);
};

const formatIST = (dateVal: any, includeTime: boolean = true): string => {
    if (!dateVal) return "—";
    try {
        let cleanDs = dateVal;
        if (typeof cleanDs === 'string' && !cleanDs.includes('Z') && !cleanDs.includes('+')) {
            if (cleanDs.includes('T') || cleanDs.includes(':')) {
                const formatted = cleanDs.replace(' ', 'T');
                cleanDs = formatted.includes('Z') ? formatted : formatted + 'Z';
            }
        }
        const d = new Date(cleanDs);
        if (isNaN(d.getTime())) return "—";

        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: includeTime ? "2-digit" : undefined,
            minute: includeTime ? "2-digit" : undefined,
            second: includeTime ? "2-digit" : undefined,
            hour12: false
        }).formatToParts(d);

        const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";

        const month = getPart("month");
        const day = getPart("day");
        const year = getPart("year");

        if (includeTime) {
            const hour = getPart("hour");
            const minute = getPart("minute");
            const second = getPart("second");
            return `${month} ${day}, ${year} • ${hour}:${minute}:${second}`;
        } else {
            return `${month} ${day}, ${year} `;
        }
    } catch {
        return "—";
    }
};

const getApplicationDisplayProgress = (app: any): number => {
    const status = (app.status || "").toLowerCase();
    const stage = (app.stage || "").toLowerCase();
    const bankWorkflow = (app.bankWorkflowStatus || "").toUpperCase();

    if (
        status === "disbursed" ||
        status === "disbursement_confirmed" ||
        status === "closed" ||
        bankWorkflow === "DISBURSED"
    ) {
        return 100;
    }
    if (status === "approved" || stage === "sanction" || stage === "sanctioned") {
        return Math.max(app.progress ?? 0, 95);
    }
    if (
        stage === "bank_review" ||
        status === "under_bank_review" ||
        status === "processing"
    ) {
        return Math.max(app.progress ?? 0, 90);
    }
    if (stage === "credit_check" || status === "query_raised") {
        return Math.max(app.progress ?? 0, 75);
    }
    if (
        stage === "submit_to_bank" ||
        stage === "bank_submission" ||
        status === "submitted_to_bank" ||
        status === "file_logged"
    ) {
        return Math.max(app.progress ?? 0, 50);
    }
    if (
        stage === "document_verification" ||
        stage === "documents_verification" ||
        status === "staff_verified" ||
        status === "docs_received" ||
        status === "docs_uploaded" ||
        status === "under_review"
    ) {
        return Math.max(app.progress ?? 0, 40);
    }
    if (status === "submitted" || stage === "application_submitted") {
        return Math.max(app.progress ?? 0, 25);
    }

    return app.progress ?? 10;
};

const renderBankLogo = (name: string, sizeClass: string = "h-11") => {
    const b = name.toLowerCase();
    if (b.includes('idfc')) return <img src="/images/lenders/idfc-first-bank.jpg" alt="IDFC" className={`${sizeClass} object-contain`} title="IDFC FIRST Bank" />;
    if (b.includes('avanse')) return <img src="/images/lenders/avanse.jpg" alt="Avanse" className={`${sizeClass} object-contain`} title="Avanse Financial" />;
    if (b.includes('auxilo')) return <img src="/images/lenders/auxilo.png" alt="Auxilo" className={`${sizeClass} object-contain`} title="Auxilo Finserve" />;
    if (b.includes('credila') || b.includes('hdfc')) return <img src="/images/lenders/hdfc-credila.png" alt="Credila" className={`${sizeClass} object-contain`} title="HDFC Credila" />;
    if (b.includes('poonawalla')) return <img src="/images/lenders/poonawalla.png" alt="Poonawalla" className={`${sizeClass} object-contain`} title="Poonawalla Fincorp" />;
    if (b.includes('incred')) return <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] font-black border border-purple-200" title="InCred">InCred</span>;
    return <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[9px] font-black border border-slate-200" title={name}>{name}</span>;
};

const getApplicationStageLabel = (app: any, progress: number): string => {
    if (app.currentStage) return app.currentStage;

    const status = (app.status || "").toLowerCase();
    if (
        status === "disbursed" ||
        status === "disbursement_confirmed" ||
        status === "closed" ||
        (app.bankWorkflowStatus || "").toUpperCase() === "DISBURSED"
    ) {
        return "Disbursed";
    }

    if (progress <= 12) return "Application Created";
    if (progress <= 25) return "Application Submitted";
    if (progress <= 40) return "Documents";
    if (progress <= 50) return "Submit to Bank";
    if (progress <= 75) return "Credit Check";
    if (progress <= 90) return "Bank Review";
    if (progress <= 95) return "Sanction";
    return "Disbursement";
};

const TableHeader = ({ children }: { children: React.ReactNode }) => (
    <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 text-[11px] uppercase tracking-wider font-sans font-bold text-left">
        <tr>{children}</tr>
    </thead>
);

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
            <button
                type="button"
                onClick={toggleOpen}
                className="w-6 h-6 rounded-full bg-purple-50 hover:bg-purple-100 text-[#6605c7] border border-purple-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0 ml-1.5"
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

export default function IncomingQueuePage() {
    return (
        <Suspense fallback={<div className="p-8 text-slate-500">Loading incoming queue...</div>}>
            <IncomingQueuePageInner />
        </Suspense>
    );
}

function IncomingQueuePageInner() {
    const router = useRouter();
    const { user, token } = useAuth();
    const { onlineEmails, fetchBadgeStats } = useStaffLayout();
    const { confirm: dialogConfirm } = useDialog();

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const applicationsPerPage = 20;



    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
    const [activeContactPopup, setActiveContactPopup] = useState<{ id: string; type: 'email' | 'phone' } | null>(null);
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const [activeDockApp, setActiveDockApp] = useState<any | null>(null);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [routingApp, setRoutingApp] = useState<any | null>(null);

    // Email Modal
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailModalRecipient, setEmailModalRecipient] = useState("");
    const [emailModalRecipientName, setEmailModalRecipientName] = useState("");



    // Rejection Modal
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [appToReject, setAppToReject] = useState<any | null>(null);

    const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
    const [tempFollowUpDate, setTempFollowUpDate] = useState("");
    const [tempFollowUpTime, setTempFollowUpTime] = useState("");
    const [followUpDates, setFollowUpDates] = useState<Record<string, { date: string, time: string, studentName: string, appNumber: string, notes?: string }>>({});
    const [tempFollowUpNotes, setTempFollowUpNotes] = useState("");
    const [followUpItem, setFollowUpItem] = useState<any | null>(null);

    // ── Assignment State ──────────────────────────────────────────────────
    const [assigningIds, setAssigningIds] = useState<Set<string>>(new Set());
    const [assignedStaffMap, setAssignedStaffMap] = useState<Record<string, { staffId: string; staffName?: string }>>({});

    const followUpKey = user?.id
        ? `staff_follow_up_dates_${user.id}`
        : user?.email
            ? `staff_follow_up_dates_${user.email}`
            : `staff_follow_up_dates_default`;

    useEffect(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem(followUpKey);
            if (stored) {
                try {
                    setFollowUpDates(JSON.parse(stored));
                } catch (e) {
                    console.error("Failed to parse follow up dates:", e);
                }
            }
        }
    }, [followUpKey]);

    const saveFollowUp = async (appId: string, studentName: string, appNumber: string) => {
        if (!tempFollowUpDate) {
            alert("Please select a date.");
            return;
        }

        const todayStr = getTodayDateString();
        if (tempFollowUpDate < todayStr) {
            alert("⚠️ Past Date Selected!\n\nFollow-up date cannot be scheduled in the past. Please select today's date or a future date.");
            return;
        }

        const selectedTime = tempFollowUpTime || "10:00";
        const staffId = user?.id || user?.email || "default";

        // Check if date and time slot is already assigned to another student
        const conflict = checkFollowUpConflict({
            staffId,
            date: tempFollowUpDate,
            time: selectedTime,
            currentAppId: appId
        });

        if (conflict) {
            alert(`⚠️ Schedule Conflict!\n\nThe slot (${tempFollowUpDate} at ${selectedTime}) is already assigned to ${conflict.studentName} (${conflict.appNumber || 'Student'}).\n\nThe same date and time cannot be assigned to two different students. Please choose a different date or time slot.`);
            return;
        }

        if (tempFollowUpNotes.trim()) {
            try {
                await adminApi.addRemark(appId, {
                    type: "note",
                    content: tempFollowUpNotes.trim(),
                    authorName: "Staff Member",
                    isInternal: true,
                } as any);
            } catch (err) {
                console.error("Failed to add follow-up notes as internal note:", err);
            }
        }

        // 1. Update app-level follow-up
        const updated = {
            ...followUpDates,
            [appId]: {
                date: tempFollowUpDate,
                time: selectedTime,
                studentName,
                appNumber: appNumber || `#${appId.slice(0, 8)}`,
                notes: tempFollowUpNotes
            }
        };
        setFollowUpDates(updated);
        localStorage.setItem(followUpKey, JSON.stringify(updated));

        // 2. Update student-level follow-up (synchronization)
        const sId = followUpItem?.userId || followUpItem?.studentId || followUpItem?.student?.id || followUpItem?.user?.id;
        if (sId) {
            const studentKey = `follow_ups_${staffId}_${sId}`;
            const stored = localStorage.getItem(studentKey);
            let currentList: any[] = [];
            if (stored) {
                try {
                    currentList = JSON.parse(stored);
                    if (!Array.isArray(currentList)) currentList = [];
                } catch (e) {
                    console.error(e);
                }
            }

            const pendingIndex = currentList.findIndex((f: any) => f.status === "pending");
            if (pendingIndex > -1) {
                currentList[pendingIndex] = {
                    ...currentList[pendingIndex],
                    date: tempFollowUpDate,
                    time: selectedTime,
                    notes: tempFollowUpNotes
                };
            } else {
                currentList.push({
                    id: Date.now().toString(),
                    date: tempFollowUpDate,
                    time: selectedTime,
                    notes: tempFollowUpNotes,
                    status: "pending",
                    createdAt: new Date().toISOString(),
                    studentId: sId,
                    studentName,
                    appNumber: appNumber || `#${appId.slice(0, 8)}`,
                    appId
                });
            }
            localStorage.setItem(studentKey, JSON.stringify(currentList));
        }

        // 3. Persist reminder in Database via API
        adminApi.updateFollowUp(appId, {
            date: tempFollowUpDate,
            time: selectedTime,
            notes: tempFollowUpNotes,
            status: "pending"
        }).catch((err) => console.error("Failed to sync follow-up to DB:", err));

        setEditingFollowUpId(null);
        setFollowUpItem(null);
    };

    const clearFollowUp = (appId: string) => {
        // 1. Clear app-level follow-up
        const updated = { ...followUpDates };
        delete updated[appId];
        setFollowUpDates(updated);
        localStorage.setItem(followUpKey, JSON.stringify(updated));

        // 2. Clear student-level follow-up (synchronization)
        const staffId = user?.id || user?.email || "default";
        const sId = followUpItem?.userId || followUpItem?.studentId || followUpItem?.student?.id || followUpItem?.user?.id;
        if (sId) {
            const studentKey = `follow_ups_${staffId}_${sId}`;
            const stored = localStorage.getItem(studentKey);
            if (stored) {
                try {
                    let currentList = JSON.parse(stored);
                    if (Array.isArray(currentList)) {
                        currentList = currentList.map((f: any) => f.status === "pending" ? { ...f, status: "cancelled" } : f);
                        localStorage.setItem(studentKey, JSON.stringify(currentList));
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        }

        // 3. Clear reminder in Database via API
        adminApi.updateFollowUp(appId, {
            date: "",
            time: "",
            notes: "",
            status: "completed"
        }).catch((err) => console.error("Failed to clear follow-up in DB:", err));

        setEditingFollowUpId(null);
        setFollowUpItem(null);
    };

    const openFollowUpModal = (rowId: string, item: any) => {
        setEditingFollowUpId(rowId);
        setFollowUpItem(item);

        // 1. Check app-level first
        if (followUpDates[rowId]) {
            setTempFollowUpDate(followUpDates[rowId].date);
            setTempFollowUpTime(followUpDates[rowId].time);
            setTempFollowUpNotes(followUpDates[rowId].notes || "");
            return;
        }

        // 2. Check student-level next
        const sId = item.userId || item.studentId || item.student?.id || item.user?.id;
        if (sId) {
            const staffId = user?.id || user?.email || "default";
            const studentKey = `follow_ups_${staffId}_${sId}`;
            const stored = localStorage.getItem(studentKey);
            if (stored) {
                try {
                    const list = JSON.parse(stored);
                    if (Array.isArray(list)) {
                        const pending = list.find((f: any) => f.status === "pending");
                        if (pending) {
                            setTempFollowUpDate(pending.date);
                            setTempFollowUpTime(pending.time);
                            setTempFollowUpNotes(pending.notes || "");
                            return;
                        }
                    }
                } catch (e) {
                    console.error(e);
                }
            }
        }

        setTempFollowUpDate("");
        setTempFollowUpTime("");
        setTempFollowUpNotes("");
    };

    const applyQuickDate = (days: number) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setTempFollowUpDate(`${yyyy}-${mm}-${dd}`);
    };

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch incoming student applications assigned to the logged-in staff member
            const res: any = await adminApi.getApplications({ limit: "1000" });
            const rawItems: any[] = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

            const isPureStaff = user?.role === 'staff';
            const staffId = (user?.id || '').toLowerCase();
            const staffEmail = (user?.email || '').toLowerCase();

            const items: any[] = rawItems.filter((app: any) => {
                // Strict per-staff isolation for pure staff role
                if (isPureStaff && staffId) {
                    const assignedId = (app.assignedStaffId || '').toLowerCase();
                    const assignedEmail = (app.assignedStaffEmail || '').toLowerCase();
                    const matchesStaff = (
                        assignedId === staffId ||
                        (staffEmail && assignedId === staffEmail) ||
                        (staffEmail && assignedEmail === staffEmail)
                    );
                    if (!matchesStaff) return false;
                }

                const s = (app.status || "").toLowerCase();
                const bw = (app.bankWorkflowStatus || "").toUpperCase();

                // Exclude draft, inactive, or rejected applications
                if (s === "draft" || s === "rejected" || s === "cancelled" || s === "disbursed" || s === "disbursement_confirmed" || bw === "REJECTED") {
                    return false;
                }

                // Check if application has already been sent to a bank
                const isSentToBank = Boolean(
                    app.submittedToBankAt ||
                    app.bankSubmissionId ||
                    (bw && bw !== "NONE" && bw !== "") ||
                    ["submitted_to_bank", "routed_multiparty", "file_logged", "under_bank_review", "processing", "sanctioned", "approved", "disbursed", "disbursement_confirmed"].includes(s)
                );

                // Incoming queue ONLY includes applications that have NOT been sent to a bank yet
                if (isSentToBank) return false;

                return true;
            });

            // Client-side pagination (getMyApplications returns all at once)
            const offset = (currentPage - 1) * applicationsPerPage;
            let filtered = items;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                filtered = items.filter(item =>
                    `${item.firstName || ''} ${item.lastName || ''}`.toLowerCase().includes(q) ||
                    (item.universityName || '').toLowerCase().includes(q) ||
                    (item.email || '').toLowerCase().includes(q) ||
                    (item.applicationNumber || '').toLowerCase().includes(q)
                );
            }
            setTotalItems(filtered.length);
            setData(filtered.slice(offset, offset + applicationsPerPage));

            // Populate assignedStaffMap and DB followUpDates
            const newMap: Record<string, { staffId: string; staffName?: string }> = {};
            const dbFollowUps: Record<string, any> = {};
            items.forEach((app: any) => {
                if (app.assignedStaffId) {
                    newMap[app.id] = { staffId: app.assignedStaffId, staffName: app.assignedStaffName };
                }
                if (app.followUpDate) {
                    dbFollowUps[app.id] = {
                        date: app.followUpDate,
                        time: app.followUpTime || "",
                        notes: app.followUpNotes || "",
                        studentName: `${app.firstName || ''} ${app.lastName || ''}`.trim() || app.email,
                        appNumber: app.applicationNumber || `#${(app.id || '').slice(0, 8)}`
                    };
                }
            });
            setAssignedStaffMap(prev => ({ ...prev, ...newMap }));
            if (Object.keys(dbFollowUps).length > 0) {
                setFollowUpDates(prev => ({ ...dbFollowUps, ...prev }));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchQuery]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // ── Round-Robin Assignment Handler ────────────────────────────────────
    const handleAssign = async (item: any) => {
        const appId = item.id || item._id;
        if (!appId) return;

        // Guard: already assigned
        if (assignedStaffMap[appId]?.staffId || item.assignedStaffId) {
            alert('This application is already assigned to a staff member.');
            return;
        }

        setAssigningIds(prev => new Set(prev).add(appId));
        try {
            const res: any = await assignmentApi.assign(appId);
            if (res?.data?.success && res?.data?.assignedStaffId) {
                setAssignedStaffMap(prev => ({
                    ...prev,
                    [appId]: { staffId: res.data.assignedStaffId },
                }));
                await logActivity(
                    'assigned',
                    `Application #${item.applicationNumber || appId.slice(-6)} assigned to staff via round-robin`,
                    'assignment_ind',
                    'bg-purple-50 text-purple-700 border-purple-100'
                );
                await fetchBadgeStats();
            } else {
                alert(res?.data?.message || 'Assignment failed — no eligible staff available.');
            }
        } catch (e: any) {
            alert(e?.message || 'Failed to assign application');
        } finally {
            setAssigningIds(prev => {
                const next = new Set(prev);
                next.delete(appId);
                return next;
            });
        }
    };

    const getActiveFollowUp = (item: any) => {
        const appId = item.id || item._id;
        const staffId = user?.id || user?.email || "default";

        // 1. Check app-level follow-up first
        if (appId && followUpDates[appId]) {
            return {
                date: followUpDates[appId].date,
                time: followUpDates[appId].time,
                notes: followUpDates[appId].notes
            };
        }

        // 2. Otherwise check student-level follow-up
        const sId = item.userId || item.studentId || item.student?.id || item.user?.id;
        if (sId) {
            const studentKey = `follow_ups_${staffId}_${sId}`;
            const stored = localStorage.getItem(studentKey);
            if (stored) {
                try {
                    const list = JSON.parse(stored);
                    if (Array.isArray(list)) {
                        const pending = list.find((f: any) => f.status === "pending");
                        if (pending) {
                            return {
                                date: pending.date,
                                time: pending.time,
                                notes: pending.notes
                            };
                        }
                    }
                } catch (e) {
                    console.error("Error parsing student followups:", e);
                }
            }
        }
        return null;
    };



    const toggleRowExpanded = (rowId: string) => {
        setExpandedRows(prev => ({ ...prev, [rowId]: !prev[rowId] }));
    };

    const openEmailModal = (email: string, name: string) => {
        setEmailModalRecipient(email);
        setEmailModalRecipientName(name);
        setIsEmailModalOpen(true);
    };



    const logActivity = async (type: string, msg: string, icon: string, color: string) => {
        try {
            await staffProfileApi.logActivity({ type, msg, icon, color });
        } catch (e) {
            console.error(e);
        }
    };



    const handleMoveToActivePipeline = async (item: any) => {
        const appId = item.id || item._id;
        if (!appId) {
            alert("Application ID is missing.");
            return;
        }

        try {
            await adminApi.updateApplicationStatus(appId, {
                status: 'submitted_to_bank',
                stage: 'bank_review',
                progress: 70,
                remarks: 'Moved to active pipeline by staff',
            });

            await logActivity('approved', `Application #${item.applicationNumber || (appId + '').slice(-6)} moved to active pipeline`, 'check_circle', 'bg-emerald-50 text-emerald-700');
            setActiveDockApp(null);
            await loadData();
            await fetchBadgeStats();
        } catch (e: any) {
            alert(e?.message || 'Failed to move application to active pipeline');
        }
    };
    const handleApproveApplication = handleMoveToActivePipeline;

    const handleMoveToInactivePipeline = async (item: any) => {
        const appId = item.id || item._id;
        if (!appId) {
            alert("Application ID is missing.");
            return;
        }

        if (!confirm(`Are you sure you want to move ${item.firstName || item.student?.firstName || "this student"}'s application to the Inactive Pipeline?`)) {
            return;
        }

        try {
            await adminApi.updateApplicationStatus(appId, {
                status: 'rejected',
                stage: 'rejected',
                rejectionReason: 'Moved to inactive pipeline by staff',
                remarks: 'Moved to inactive pipeline by staff',
            });

            await logActivity('rejected', `Application #${item.applicationNumber || (appId + '').slice(-6)} moved to inactive pipeline`, 'archive', 'bg-rose-50 text-rose-700');
            setActiveDockApp(null);
            await loadData();
            await fetchBadgeStats();
            alert("Application successfully moved to Inactive Pipeline!");
        } catch (e: any) {
            alert(e?.message || 'Failed to move application to inactive pipeline');
        }
    };

    const handleConfirmRejection = async () => {
        if (!appToReject || !rejectionReason.trim()) return;
        try {
            await adminApi.updateApplicationStatus(appToReject.id || appToReject._id, {
                status: 'rejected',
                rejectionReason: rejectionReason.trim(),
                remarks: rejectionReason.trim()
            });
            await logActivity('rejected', `Application #${appToReject.applicationNumber || appToReject.id?.slice(-4)} rejected by staff`, 'cancel', 'bg-rose-50 text-rose-700 border-rose-100');
            setActiveDockApp(null);
            setIsRejectModalOpen(false);
            setAppToReject(null);
            setRejectionReason("");
            await loadData();
        } catch (err) {
            alert("Failed to reject application");
        }
    };

    const statusColors: Record<string, string> = {
        draft: 'bg-amber-50 text-amber-600 border border-amber-200',
        pending: 'bg-amber-50 text-amber-600 border border-amber-200',
        submitted: 'bg-blue-50 text-blue-600 border border-blue-200',
        submitted_to_bank: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
        processing: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
        approved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        verified: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        rejected: 'bg-rose-50 text-rose-600 border border-rose-200',
        disbursed: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
        routed_multiparty: 'bg-purple-50 text-purple-700 border border-purple-200',
    };

    const totalPages = Math.max(1, Math.ceil(totalItems / applicationsPerPage));
    const showingStart = (currentPage - 1) * applicationsPerPage + 1;
    const showingEnd = Math.min(currentPage * applicationsPerPage, totalItems);

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[#0A2540]">
                        Incoming Queue
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">Newly submitted applications awaiting initial review & verification</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            placeholder="Search incoming queue..."
                            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 w-60 shadow-sm"
                        />
                    </div>
                    <button
                        onClick={loadData}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[16px]">refresh</span>
                        Refresh
                    </button>
                </div>
            </div>

            <div className="rounded-[24px] border border-slate-100 overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto min-h-[320px]">
                    <table className="w-full text-left">
                        <TableHeader>
                            <th className="px-6 py-4">Applicant Profile</th>
                            <th className="px-6 py-4">College Name</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4">Follow Up</th>
                            <th className="px-6 py-4">Timestamp</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </TableHeader>
                        <tbody className={`divide-y divide-slate-50 ${loading ? 'opacity-60 pointer-events-none transition-opacity duration-300' : 'transition-opacity duration-300'}`}>
                            {loading && data.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-8 py-32 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Loading incoming applications...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : data.length > 0 ? (
                                data.map((item, idx) => {
                                    const progress = getApplicationDisplayProgress(item);
                                    const statusKey = (item.status || 'draft').toLowerCase();
                                    const initials = `${(item.firstName || item.student?.firstName || '?')[0]}${(item.lastName || item.student?.lastName || '')[0] || ''}`;
                                    const stageLabel = getApplicationStageLabel(item, progress);
                                    const isOnline = (item.email || item.student?.email) && onlineEmails.map(e => e.toLowerCase()).includes((item.email || item.student?.email).toLowerCase());
                                    const popup = activeContactPopup;
                                    const rowId = item.id || item._id || String(idx);
                                    const isExpanded = !!expandedRows[rowId];
                                    const userEmail = item.email || item.student?.email || item.user?.email || "";
                                    const userPhone = item.phone || item.mobile || item.student?.phone || item.student?.mobile || item.user?.phone || item.user?.mobile || "";
                                    const studentId = item.userId || item.user_id || item.studentId || item.student?.id || item.user?.id || item.student?._id || "";

                                    return (
                                        <tr key={rowId} className="hover:bg-slate-50/30 transition-colors">
                                            {/* 1. Applicant Profile */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-start gap-3">
                                                    <div
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const uid = item.userId || item.user_id || item.student?.id || item.student?._id;
                                                            const fName = item.firstName || item.student?.firstName || "";
                                                            const lName = item.lastName || item.student?.lastName || "";
                                                            const appNum = item.applicationNumber || "";

                                                            const query = new URLSearchParams();
                                                            if (uid) query.set("userId", uid);
                                                            if (userEmail) query.set("email", userEmail);
                                                            if (fName) query.set("firstName", fName);
                                                            if (lName) query.set("lastName", lName);
                                                            if (userPhone) query.set("phone", userPhone);
                                                            if (item.id || item._id) query.set("applicationId", item.id || item._id);
                                                            if (appNum) query.set("applicationNumber", appNum);

                                                            router.push(`/staff/chat-customer?${query.toString()}`);
                                                        }}
                                                        className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 cursor-pointer transition-all shadow-xs hover:scale-105 group/avatar"
                                                        title="Click to open Support Chat with Student"
                                                    >
                                                        <span className="group-hover/avatar:hidden">{initials.toUpperCase()}</span>
                                                    </div>
                                                    <div className="min-w-0 space-y-0.5">
                                                        <div className="min-w-0 space-y-0.5">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <p
                                                                    onClick={() => {
                                                                        const uid = item.userId || item.user_id || item.student?.id || item.student?._id;
                                                                        const email = item.email || item.student?.email;
                                                                        if (uid) {
                                                                            window.open(`/staff/users/${uid}${email ? `?email=${encodeURIComponent(email)}` : ''}`, '_blank');
                                                                        } else {
                                                                            router.push(`/staff/users?search=${encodeURIComponent(item.firstName || '')}`);
                                                                        }
                                                                    }}
                                                                    className="text-[15px] font-bold text-slate-950 hover:text-indigo-600 cursor-pointer transition-colors truncate max-w-[220px]"
                                                                    title="Click to view Student Profile"
                                                                >
                                                                    {item.firstName || item.student?.firstName || '—'} {item.lastName || item.student?.lastName || ''}
                                                                </p>
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
                                                            <p className="text-xs font-mono text-slate-400">
                                                                {studentId || <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50">NO STUDENT ID</span>}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* 2. College Name */}
                                            <td className="px-6 py-4">
                                                <span className="text-[15px] font-semibold text-slate-800 block truncate max-w-[220px]" title={item.universityName || item.college || "—"}>
                                                    {item.universityName || item.college || "—"}
                                                </span>
                                            </td>

                                            {/* 3. Status */}
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${statusKey === 'submitted' || statusKey === 'pending'
                                                    ? 'bg-blue-50 text-blue-600 border border-blue-200'
                                                    : statusKey === 'processing' || statusKey === 'under_review'
                                                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                                                        : statusKey === 'approved' || statusKey === 'verified'
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                            : statusKey === 'rejected'
                                                                ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                                                : 'bg-amber-50 text-amber-600 border border-amber-200'
                                                    }`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${statusKey === 'rejected' ? 'bg-rose-500' : ['approved', 'verified'].includes(statusKey) ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                                                    {(() => {
                                                        const rawStatus = (item.status || 'SUBMITTED').replace(/_/g, ' ').toUpperCase();
                                                        if (rawStatus.includes('DOCUMENTS VERIFIED') || rawStatus.includes('DOCS VERIFIED') || rawStatus.includes('DOCUMENTS UPLOADED') || rawStatus.includes('DOCS UPLOADED') || rawStatus.includes('DOCUMENT VERIFICATION')) {
                                                            return 'DOCUMENTS';
                                                        }
                                                        return rawStatus;
                                                    })()}
                                                </span>
                                            </td>

                                            {/* 5. Follow Up */}
                                            <td className="px-6 py-4">
                                                {(() => {
                                                    const activeFU = getActiveFollowUp(item);
                                                    if (activeFU) {
                                                        const dateObj = new Date(activeFU.date + 'T00:00:00');
                                                        const day = String(dateObj.getDate()).padStart(2, '0');
                                                        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                                                        const monthLabel = months[dateObj.getMonth()] || 'JUN';
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() => openFollowUpModal(rowId, item)}
                                                                className="px-3.5 py-1.5 border border-rose-200 hover:border-rose-300 hover:bg-rose-100/60 rounded-xl text-xs font-extrabold text-rose-600 transition-colors bg-rose-50 active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
                                                                title="Click to edit follow-up"
                                                            >
                                                                <span>{`${day} ${monthLabel}${activeFU.time ? ` ${activeFU.time}` : ''}`}</span>
                                                                <span className="material-symbols-outlined text-[14px] text-rose-500">edit</span>
                                                            </button>
                                                        );
                                                    } else {
                                                        return (
                                                            <button
                                                                type="button"
                                                                onClick={() => openFollowUpModal(rowId, item)}
                                                                className="px-3.5 py-1.5 border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/20 rounded-xl text-xs font-extrabold text-slate-500 hover:text-indigo-600 transition-colors bg-white active:scale-95 cursor-pointer inline-flex items-center gap-1"
                                                            >
                                                                Add +
                                                            </button>
                                                        );
                                                    }
                                                })()}
                                            </td>

                                            {/* 6. Timestamp */}
                                            <td className="px-6 py-4">
                                                <span className="text-xs text-slate-600 font-semibold">
                                                    {formatIST(item.submittedAt || item.createdAt || item.updatedAt, true)}
                                                </span>
                                            </td>

                                            {/* 7. Actions */}
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setRoutingApp(item);
                                                            setIsShareModalOpen(true);
                                                        }}
                                                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                                        title="Approve application & select target bank"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                                        Approve & Select Bank
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveDockApp(item);
                                                        }}
                                                        className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                                        title="More Actions"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">more_vert</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10} className="px-8 py-24 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4 text-slate-400">
                                            <span className="material-symbols-outlined text-5xl">inbox_customize</span>
                                            <p className="text-[12px] font-black uppercase tracking-widest">No Incoming Applications Found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalItems > 0 && (
                    <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
                        <p className="text-[11px] font-bold text-slate-700">
                            Showing <span className="text-indigo-600 font-extrabold">{showingStart}–{Math.min(showingEnd, totalItems)}</span> of <span className="font-extrabold">{totalItems}</span> applications &nbsp;·&nbsp; Page <span className="text-indigo-600 font-extrabold">{currentPage}</span> of <span className="font-extrabold">{totalPages}</span>
                        </p>
                        <div className="flex items-center gap-1.5">
                            {/* <button
                                disabled={currentPage === 1 || loading}
                                onClick={() => setCurrentPage(1)}
                                className="w-8 h-8 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-all flex items-center justify-center shadow-2xs"
                                title="First page"
                            >
                                <span className="material-symbols-outlined text-[15px]">first_page</span>
                            </button> */}
                            <button
                                disabled={currentPage === 1 || loading}
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all flex items-center gap-1 shadow-2xs"
                            >
                                <span className="material-symbols-outlined text-[15px]">chevron_left</span>
                                Prev
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                                const page = startPage + i;
                                if (page > totalPages) return null;
                                return (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-8 h-8 rounded-lg text-[11px] font-black transition-all shadow-2xs ${page === currentPage
                                            ? 'bg-indigo-600 text-white border border-indigo-600'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                            <button
                                disabled={currentPage >= totalPages || loading}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-all flex items-center gap-1 shadow-2xs"
                            >
                                Next
                                <span className="material-symbols-outlined text-[15px]">chevron_right</span>
                            </button>
                            {/* <button
                                disabled={currentPage >= totalPages || loading}
                                onClick={() => setCurrentPage(totalPages)}
                                className="w-8 h-8 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-500 hover:bg-slate-50 disabled:opacity-40 transition-all flex items-center justify-center shadow-2xs"
                                title="Last page"
                            >
                                <span className="material-symbols-outlined text-[15px]">last_page</span>
                            </button> */}
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

            {editingFollowUpId && followUpItem && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 font-sans" onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Create Follow-up</p>
                                <h3 className="text-[14px] font-black text-slate-800 leading-tight">
                                    {`${followUpItem.firstName || followUpItem.student?.firstName || ''} ${followUpItem.lastName || followUpItem.student?.lastName || ''}`.trim()}
                                </h3>
                                <p className="text-[10px] text-indigo-500 font-bold mt-0.5">{followUpItem.applicationNumber || '—'}</p>
                            </div>
                            <button type="button" onClick={() => { setEditingFollowUpId(null); setFollowUpItem(null); }} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all border-0 bg-transparent cursor-pointer mt-0.5">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Set a due date</p>
                                <div className="flex items-center gap-2">
                                    {[{ label: '1 Day', days: 1 }, { label: '3 Days', days: 3 }, { label: '1 Week', days: 7 }].map(opt => {
                                        const pd = new Date(); pd.setDate(pd.getDate() + opt.days);
                                        const val = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}-${String(pd.getDate()).padStart(2, '0')}`;
                                        const isActive = tempFollowUpDate === val;
                                        return (
                                            <button key={opt.label} type="button" onClick={() => applyQuickDate(opt.days)}
                                                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all cursor-pointer ${isActive ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600'}`}>
                                                {opt.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-px bg-slate-100" />
                                <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Or</span>
                                <div className="flex-1 h-px bg-slate-100" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Set a custom due date</label>
                                    <input type="date" min={getTodayDateString()} value={tempFollowUpDate} onChange={e => setTempFollowUpDate(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Select time slot</label>
                                    <select
                                        value={tempFollowUpTime}
                                        onChange={e => setTempFollowUpTime(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    >
                                        <option value="">Select Time Slot...</option>
                                        {DEFAULT_TIME_SLOTS.map(slot => {
                                            const staffId = user?.id || user?.email || "default";
                                            const conflict = tempFollowUpDate ? checkFollowUpConflict({
                                                staffId,
                                                date: tempFollowUpDate,
                                                time: slot,
                                                currentAppId: editingFollowUpId
                                            }) : null;

                                            return (
                                                <option key={slot} value={slot} disabled={!!conflict}>
                                                    {formatSlot12Hr(slot)} {conflict ? `❌ (Booked - ${conflict.studentName})` : '✓ (Available)'}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </div>
                            {tempFollowUpDate && (
                                <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                                    <p className="text-[11px] font-bold text-emerald-700">
                                        Due date will be <span className="font-black">{new Date(tempFollowUpDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                        {tempFollowUpTime && <> at <span className="font-black">{tempFollowUpTime}</span></>}
                                    </p>
                                </div>
                            )}
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Notes</label>
                                <textarea rows={3} value={tempFollowUpNotes} onChange={e => setTempFollowUpNotes(e.target.value)} placeholder="Add a quick note..." className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 font-medium resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" />
                            </div>
                        </div>
                        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                            <button type="button" onClick={() => clearFollowUp(editingFollowUpId)} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-100 bg-white transition-all cursor-pointer">Clear</button>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => { setEditingFollowUpId(null); setFollowUpItem(null); }} className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all cursor-pointer">Cancel</button>
                                <button type="button" onClick={() => saveFollowUp(editingFollowUpId, `${followUpItem.firstName || followUpItem.student?.firstName || ''} ${followUpItem.lastName || followUpItem.student?.lastName || ''}`.trim(), followUpItem.applicationNumber)} className="px-5 py-2 text-[10px] font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all cursor-pointer">Create</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {isRejectModalOpen && appToReject && (

                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-rose-600 text-[20px]">cancel</span>
                                <h2 className="text-[14px] font-black uppercase tracking-wider text-slate-800">
                                    Reject Application
                                </h2>
                            </div>
                            <button
                                onClick={() => { setIsRejectModalOpen(false); setAppToReject(null); setRejectionReason(""); }}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-[11px] font-bold text-slate-600">
                                Please provide the reason for rejecting {appToReject.firstName || appToReject.student?.firstName || ''} {appToReject.lastName || appToReject.student?.lastName || ''}'s application. This reason will be emailed to the student.
                            </p>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5 ml-1">
                                    Rejection Reason *
                                </label>
                                <textarea
                                    required
                                    rows={4}
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    placeholder="Enter detailed reason (e.g. CIBIL score too low, missing income proof, invalid academic certifications)..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all text-slate-900 resize-none"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                            <button
                                onClick={() => { setIsRejectModalOpen(false); setAppToReject(null); setRejectionReason(""); }}
                                className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmRejection}
                                disabled={!rejectionReason.trim()}
                                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-rose-600/10"
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}



            <AnimatePresence>
                {activeDockApp && (
                    <motion.div
                        initial={{ y: 120, x: "-50%", opacity: 0 }}
                        animate={{ y: 0, x: "-50%", opacity: 1 }}
                        exit={{ y: 120, x: "-50%", opacity: 0 }}
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        className="fixed bottom-8 left-1/2 z-50 w-full max-w-5xl bg-white/95 backdrop-blur-md border border-slate-100 rounded-[28px] shadow-[0_24px_60px_rgba(15,23,42,0.12)] px-8 py-5 flex items-center justify-between gap-8 font-sans"
                    >
                        {/* Info Section */}
                        <div className="shrink-0">
                            {/* <span className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] block">Processing Lead</span> */}
                            <h4 className="text-[16px] font-black text-slate-800 tracking-tight mt-0.5">
                                {activeDockApp.firstName || activeDockApp.student?.firstName || '—'} {activeDockApp.lastName || activeDockApp.student?.lastName || ''}
                                <span className="text-[10px] font-bold text-slate-400 block mt-0.5 font-mono">
                                    {activeDockApp.userId || activeDockApp.studentId || activeDockApp.student?.id || activeDockApp.user?.id || '—'}
                                </span>
                            </h4>
                        </div>

                        {/* View Profile */}
                        {/* <button
                            onClick={() => router.push(`/staff/applications/${activeDockApp.id || activeDockApp._id}`)}
                            className="shrink-0 h-11 px-5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-wider text-slate-700 transition-all flex items-center gap-2 active:scale-95"
                        >
                            <span className="material-symbols-outlined text-[16px] text-slate-500">visibility</span>
                            View Application
                        </button> */}

                        {/* Select Target Banks: Pills style */}
                        {/* <div className="flex-1 flex flex-col gap-1 min-w-0">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Select Target Banks</span>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {bankOptions.map((bankName: string) => {
                                    const currentBanks = activeDockApp.bank && activeDockApp.bank.toLowerCase().replace(/\s+/g, '') !== 'pendingpartner' ? activeDockApp.bank.split(', ').filter(Boolean) : [];
                                    const isChecked = currentBanks.includes(bankName);
                                    return (
                                        <button
                                            key={bankName}
                                            onClick={async () => {
                                                if (!isChecked && currentBanks.length >= 3) {
                                                    alert("You can select a maximum of 3 target banks.");
                                                    return;
                                                }
                                                const updated = isChecked
                                                    ? currentBanks.filter((b: string) => b !== bankName)
                                                    : [...currentBanks, bankName];
                                                const updateVal = updated.length > 0 ? updated.join(', ') : 'ANY BANK';
                                                try {
                                                    await adminApi.updateApplication(activeDockApp.id || activeDockApp._id, { bank: updateVal });
                                                    // Update locally in dataset
                                                    setData((prev: any[]) => prev.map(d => (d.id || d._id) === (activeDockApp.id || activeDockApp._id) ? { ...d, bank: updateVal } : d));
                                                    // Update currently active dock app state
                                                    setActiveDockApp((prev: any) => prev ? { ...prev, bank: updateVal } : null);
                                                } catch (err) {
                                                    alert("Failed to update target banks");
                                                }
                                            }}
                                            className={`h-7 px-3.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${isChecked
                                                ? 'bg-[#6605c7] text-white border-[#6605c7] shadow-sm shadow-purple-600/10'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                }`}
                                        >
                                            {bankName.replace(" Finserve", "").replace(" Financial", "").replace(" FIRST Bank", "").replace(" Fincorp", "").replace("HDFC ", "")}
                                        </button>
                                    );
                                })}
                            </div>
                        </div> */}

                        {/* Route / Send Bank button */}
                        <div className="shrink-0 flex items-center gap-3">
                            {/* Move to Inactive Pipeline button */}
                            <button
                                onClick={() => handleMoveToInactivePipeline(activeDockApp)}
                                className="h-11 px-5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm cursor-pointer active:scale-95"
                            >
                                <span className="material-symbols-outlined text-[16px]">archive</span>
                                Move to Inactive Pipeline
                            </button>

                            {/* Direct Approve & Move to Active Pipeline button */}
                            {/* <button
                                onClick={() => handleMoveToActivePipeline(activeDockApp)}
                                className="h-11 px-5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm cursor-pointer active:scale-95"
                                title="Approve and move application to Active Pipeline"
                            >
                                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                                Approve & Move to Active Pipeline
                            </button> */}

                            {/* Approve & Select Bank button */}
                            <button
                                onClick={() => {
                                    setRoutingApp(activeDockApp);
                                    setIsShareModalOpen(true);
                                }}
                                className="h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg cursor-pointer active:scale-95"
                            >
                                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                                Approve & Select Bank
                            </button>

                            {/* Close Capsule Button */}
                            <button
                                onClick={() => setActiveDockApp(null)}
                                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all flex items-center justify-center shrink-0"
                                title="Close"
                            >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {isShareModalOpen && routingApp && (
                <ShareWithBankModal
                    applicationId={routingApp.id || routingApp._id}
                    applicationNumber={routingApp.applicationNumber || ""}
                    studentName={`${routingApp.firstName || routingApp.student?.firstName || ""} ${routingApp.lastName || routingApp.student?.lastName || ""}`}
                    loanAmount={routingApp.amount || 1500000}
                    isOpen={isShareModalOpen}
                    onClose={() => {
                        setIsShareModalOpen(false);
                        setRoutingApp(null);
                    }}
                    onSuccess={async () => {
                        setIsShareModalOpen(false);
                        setRoutingApp(null);
                        setActiveDockApp(null);
                        await loadData();
                        await fetchBadgeStats();
                    }}
                />
            )}
        </div>
    );
}
