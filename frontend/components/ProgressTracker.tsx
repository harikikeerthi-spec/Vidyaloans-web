"use client";

import React, { useMemo } from "react";
import { getProfileDocumentRequirements, isDocTypeMatchingRequirement } from "@/lib/documentRequirements";

export interface Stage {
    order: number;
    label: string;
    icon: string;
    progress: number;
}

export const STAGES_CONFIG: Record<string, Stage> = {
    application_created: { order: 1, label: 'Created', icon: 'bolt', progress: 10 },
    application_submitted: { order: 2, label: 'Submitted', icon: 'send', progress: 25 },
    document_verification: { order: 3, label: 'Documents', icon: 'verified', progress: 40 },
    submit_to_bank: { order: 4, label: 'Submit to Bank', icon: 'account_balance', progress: 50 },
    credit_check: { order: 5, label: 'Credit Check', icon: 'credit_score', progress: 75 },
    bank_review: { order: 6, label: 'Review', icon: 'rate_review', progress: 90 },
    sanction: { order: 7, label: 'Sanction', icon: 'assignment_turned_in', progress: 95 },
    disbursement: { order: 8, label: 'Disbursed', icon: 'payments', progress: 100 },
};

export const STAGES_LIST = Object.entries(STAGES_CONFIG)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, value]) => ({ id: key, ...value }));

export const isApplicationDocumentsComplete = (documents: any[] = [], profile?: any): boolean => {
    if (!documents || documents.length === 0) return false;
    const uploadedDocs = documents.filter(d =>
        d && (d.uploaded === true || d.status === 'uploaded' || d.status === 'verified' || Boolean(d.fileUrl || d.s3Key || d.url))
    );
    let requiredCount = 3;
    if (profile) {
        try {
            const reqs = getProfileDocumentRequirements(profile);
            if (reqs && reqs.length > 0) {
                requiredCount = reqs.length;
                return reqs.every(r => uploadedDocs.some(d => isDocTypeMatchingRequirement(d.docType, r.type, d.docName || d.name)));
            }
        } catch { }
    }
    return uploadedDocs.length >= requiredCount;
};

export const getDynamicProgress = (app: any, documents: any[] = [], profile?: any): number => {
    if (!app) return 10;
    const s = String(app.status || '').toLowerCase().trim();
    const stg = String(app.stage || '').toLowerCase().trim();

    // 1. Disbursed (100%) - crossed Sanction
    if (['disbursed', 'closed', 'disbursement_confirmed'].includes(s) || stg === 'disbursement' || stg === 'disbursed') {
        return 100;
    }

    // 2. Approved / Sanction stage (95%) - crossed Review
    const isApprovedOrSanctioned = ['sanctioned', 'approved', 'sanction', 'conditional_sanction', 'partial_sanction', 'counter_offer', 'sanction_issued', 'bank_approved', 'approved_by_bank'].includes(s) ||
        stg === 'sanction' || stg === 'sanctioned' || Boolean(app.sanctionLetterUrl);
    if (isApprovedOrSanctioned) {
        return 95;
    }

    // 3. Bank member adds LAN number -> crosses Credit Check, enters Review stage (90%)
    const hasLan = Boolean(app.lanNumber || app.lanEnteredAt);
    const isUnderBankReview = hasLan || ['file_logged', 'under_bank_review', 'bank_review', 'processing'].includes(s) || stg === 'bank_review';
    if (isUnderBankReview) {
        return 90;
    }

    // 4. Submitted to bank -> crosses Submit to Bank, enters Credit Check stage (75%)
    const isSentToBank = Boolean(
        app.submittedToBankAt || app.bankSubmittedAt || app.routedToBankAt || app.bankSubmissionId ||
        (app.bankWorkflowStatus && !['PENDING', 'DRAFT'].includes(String(app.bankWorkflowStatus).toUpperCase())) ||
        ['submitted_to_bank', 'routed_multiparty', 'credit_check', 'query_raised'].includes(s) ||
        stg === 'credit_check' ||
        (app.bank && !['any bank', '—', 'pending partner', 'none'].includes(String(app.bank).toLowerCase()) && !['draft', 'pending', 'application_created'].includes(s))
    );
    if (isSentToBank) {
        return 75;
    }

    // 5. Submit to bank stage (50%)
    if (['submit_to_bank', 'bank_submission', 'staff_verified', 'verification', 'documents_verified', 'document_verification'].includes(s) || stg === 'submit_to_bank' || stg === 'document_verification') {
        return 50;
    }

    // 6. Pre-bank: Document verification vs Submitted vs Created
    const docsComplete = isApplicationDocumentsComplete(documents, profile);
    if (!docsComplete) {
        let base = typeof app.progress === 'number' && app.progress > 0 ? app.progress : 10;
        if (['submitted', 'application_submitted', 'docs_received', 'docs_uploaded', 'under_review'].includes(s)) {
            base = Math.max(base, 25);
        }
        if (documents && documents.length > 0) {
            const uploadedCount = documents.filter(d => d && (d.uploaded === true || d.status === 'uploaded' || d.status === 'verified' || Boolean(d.fileUrl || d.s3Key || d.url))).length;
            if (uploadedCount > 0) {
                base = Math.max(base, Math.min(40, 25 + Math.round((uploadedCount / 3) * 15)));
            }
        }
        return Math.min(base, 40);
    }

    let baseProgress = typeof app.progress === 'number' && app.progress > 0 ? app.progress : 50;
    return Math.max(baseProgress, 50);
};

export const getStageKeyForApp = (app: any, calculatedProgress?: number, documents: any[] = [], profile?: any): string => {
    if (!app) return 'application_created';
    const status = String(app.status || '').toLowerCase().trim();
    if (status === 'rejected' || status === 'cancelled') return 'application_created';

    const stageKey = String(app.stage || '').toLowerCase().trim();

    // 1. Disbursed (crossed Sanction)
    if (['disbursed', 'disbursement_confirmed', 'closed'].includes(status) || stageKey === 'disbursement' || stageKey === 'disbursed') {
        return 'disbursement';
    }

    // 2. Approved / Sanction stage (crossed Review)
    if (['sanctioned', 'approved', 'sanction', 'conditional_sanction', 'partial_sanction', 'counter_offer', 'sanction_issued', 'bank_approved', 'approved_by_bank'].includes(status) ||
        stageKey === 'sanction' || stageKey === 'sanctioned' || Boolean(app.sanctionLetterUrl)) {
        return 'sanction';
    }

    // 3. Bank member adds LAN number -> crosses Credit Check, enters Review stage
    const hasLan = Boolean(app.lanNumber || app.lanEnteredAt);
    if (hasLan || ['file_logged', 'under_bank_review', 'bank_review', 'processing'].includes(status) || stageKey === 'bank_review') {
        return 'bank_review';
    }

    // 4. Submitted to bank -> crosses Submit to Bank, enters Credit Check stage
    const isSentToBank = Boolean(
        app.submittedToBankAt || app.bankSubmittedAt || app.routedToBankAt || app.bankSubmissionId ||
        (app.bankWorkflowStatus && !['PENDING', 'DRAFT'].includes(String(app.bankWorkflowStatus).toUpperCase())) ||
        ['submitted_to_bank', 'routed_multiparty', 'credit_check', 'query_raised'].includes(status) ||
        stageKey === 'credit_check' ||
        (app.bank && !['any bank', '—', 'pending partner', 'none'].includes(String(app.bank).toLowerCase()) && !['draft', 'pending', 'application_created'].includes(status))
    );
    if (isSentToBank) {
        return 'credit_check';
    }

    // 5. Submit to Bank stage
    if (['submit_to_bank', 'bank_submission'].includes(status) || stageKey === 'submit_to_bank') {
        return 'submit_to_bank';
    }

    // 6. Check documents completeness for earlier stages
    const docsComplete = isApplicationDocumentsComplete(documents, profile);
    if (!docsComplete) {
        if (status === 'submitted' || status === 'application_submitted' || (calculatedProgress && calculatedProgress >= 25)) {
            return 'document_verification';
        }
        return 'application_created';
    }

    // If documents complete but not yet submitted to bank:
    if (['staff_verified', 'verification', 'documents_verified', 'document_verification'].includes(status) || stageKey === 'document_verification') {
        return 'submit_to_bank';
    }

    const p = calculatedProgress !== undefined ? calculatedProgress : (app.progress || 50);
    if (p >= 100) return 'disbursement';
    if (p >= 95) return 'sanction';
    if (p >= 90) return 'bank_review';
    if (p >= 75) return 'credit_check';
    if (p >= 50) return 'submit_to_bank';
    return 'document_verification';
};

export const formatToIST = (dateVal: any): { date: string; time: string } | null => {
    if (!dateVal) return null;
    try {
        let str = String(dateVal).trim();
        if (!str) return null;
        if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(str) && !/[Zz+\-]\d{0,2}:?\d{0,2}$/.test(str)) {
            str = str.replace(' ', 'T') + 'Z';
        }
        const d = new Date(str);
        if (isNaN(d.getTime())) return null;

        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
        }).formatToParts(d);

        const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";

        const month = getPart("month");
        const day = getPart("day");
        const hour = getPart("hour");
        const minute = getPart("minute");
        const dayPeriod = getPart("dayPeriod").toUpperCase();

        return {
            date: `${month} ${day}`,
            time: `${hour}:${minute} ${dayPeriod}`
        };
    } catch {
        return null;
    }
};

export interface ProgressTrackerProps {
    application?: any;
    app?: any;
    documents?: any[];
    profile?: any;
    compact?: boolean;
    title?: string;
    showEmptyState?: boolean;
    className?: string;
    orientation?: 'horizontal' | 'vertical';
}

export default function ProgressTracker({
    application,
    app,
    documents = [],
    profile,
    compact = false,
    title = "Application Progress",
    showEmptyState = true,
    className = "",
    orientation = "horizontal",
}: ProgressTrackerProps) {
    const targetApp = application || app;

    const calculatedProgress = useMemo(() => {
        return getDynamicProgress(targetApp, documents, profile);
    }, [targetApp, documents, profile]);

    const currentStageKey = useMemo(() => {
        if (!targetApp) return null;
        if (targetApp.status?.toLowerCase() === 'rejected' || targetApp.status?.toLowerCase() === 'cancelled') return null;
        return getStageKeyForApp(targetApp, calculatedProgress, documents, profile);
    }, [targetApp, calculatedProgress, documents, profile]);

    const statusLower = targetApp?.status?.toLowerCase() || '';
    const isDisbursedOrClosed = ['disbursed', 'disbursement_confirmed', 'closed'].includes(statusLower) || targetApp?.stage === 'disbursement' || targetApp?.stage === 'disbursed' || calculatedProgress >= 100;
    const isSanctionedOrApproved = !isDisbursedOrClosed && (['sanctioned', 'approved', 'sanction', 'conditional_sanction', 'partial_sanction', 'counter_offer', 'sanction_issued', 'bank_approved', 'approved_by_bank'].includes(statusLower) || targetApp?.stage === 'sanction' || targetApp?.stage === 'sanctioned' || Boolean(targetApp?.sanctionLetterUrl) || currentStageKey === 'sanction' || calculatedProgress === 95);
    const isRejected = targetApp?.status?.toLowerCase() === 'rejected' || targetApp?.status?.toLowerCase() === 'cancelled';

    const currentStage = currentStageKey ? STAGES_CONFIG[currentStageKey] : null;

    const maxCompletedOrder = isDisbursedOrClosed || calculatedProgress >= 100
        ? 8
        : (currentStage ? currentStage.order - 1 : 0);

    const appCreatedAt = targetApp?.createdAt || targetApp?.created_at || targetApp?.submittedAt || targetApp?.submitted_at || targetApp?.date;
    const appUpdatedAt = targetApp?.updatedAt || targetApp?.updated_at || appCreatedAt;
    const lastCompletedIdx = maxCompletedOrder - 1;

    const getStageTimestamp = (stageIdx: number, completed: boolean, active?: boolean): string | undefined => {
        if (!completed && !active) return undefined;
        if (stageIdx === 0) return appCreatedAt;
        if (stageIdx === 1) return targetApp?.submittedAt || targetApp?.submitted_at || appCreatedAt;
        if (stageIdx === 2) return targetApp?.documentsVerifiedAt || targetApp?.verifiedAt || appUpdatedAt || appCreatedAt;
        if (stageIdx === 3) return targetApp?.submittedToBankAt || targetApp?.bankSubmittedAt || targetApp?.routedToBankAt || appUpdatedAt || appCreatedAt;
        if (stageIdx === 4) return targetApp?.creditCheckedAt || targetApp?.submittedToBankAt || appUpdatedAt || appCreatedAt;
        if (stageIdx === 5) return targetApp?.lanEnteredAt || targetApp?.fileLoggedAt || appUpdatedAt || appCreatedAt;
        if (stageIdx === 6) return targetApp?.approvedAt || targetApp?.sanctionedAt || appUpdatedAt || appCreatedAt;
        if (stageIdx === 7) return targetApp?.disbursedAt || appUpdatedAt || appCreatedAt;

        if (active || stageIdx === lastCompletedIdx) return appUpdatedAt || appCreatedAt;

        try {
            const baseDate = new Date(appCreatedAt);
            if (stageIdx > 0 && !isNaN(baseDate.getTime())) {
                const offsetDate = new Date(baseDate.getTime() + stageIdx * 18 * 60 * 60 * 1000);
                const updatedDate = new Date(appUpdatedAt);
                if (offsetDate.getTime() < updatedDate.getTime()) {
                    return offsetDate.toISOString();
                }
            }
        } catch { }
        return appCreatedAt;
    };

    if (!targetApp) {
        if (!showEmptyState) return null;
        return (
            <div className={`bg-white rounded-xl border border-gray-100 p-8 text-center shadow-sm ${className}`}>
                <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center mx-auto mb-4 text-gray-200">
                    <span className="material-symbols-outlined text-3xl">hourglass_empty</span>
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1 uppercase tracking-tight">No active applications</h3>
                <p className="text-gray-400 text-xs">Start a new application to track your progress</p>
            </div>
        );
    }

    if (isRejected) {
        return (
            <div className={`bg-red-50/50 border border-red-100 rounded-xl p-6 md:p-8 shadow-sm ${className}`}>
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center text-white shadow-md shrink-0">
                        <span className="material-symbols-outlined text-xl">cancel</span>
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-red-900 capitalize">Application {targetApp.status}</h3>
                        <p className="text-red-700/60 text-xs">Your {targetApp.bank ? `${targetApp.bank} ` : ""}application was {targetApp.status}.</p>
                    </div>
                </div>
                <div className="p-3 bg-white/60 rounded-lg border border-red-100">
                    <p className="text-xs text-red-700 font-medium">Please contact our support team or submit a new file.</p>
                </div>
            </div>
        );
    }

    if (orientation === "vertical") {
        return (
            <div className={`space-y-4 font-sans ${className}`}>
                <div className={`flex items-center justify-between p-3.5 rounded-xl border ${
                    isDisbursedOrClosed || isSanctionedOrApproved
                        ? 'bg-emerald-50/60 border-emerald-200/70'
                        : 'bg-[#F3E8FF]/40 border-purple-100'
                }`}>
                    <div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                            isDisbursedOrClosed || isSanctionedOrApproved ? 'text-emerald-700' : 'text-[#7C3AED]'
                        }`}>Current Status</span>
                        <span className="text-xs font-extrabold text-slate-800">
                            {isDisbursedOrClosed ? 'Loan Disbursed' : isSanctionedOrApproved ? 'Sanctioned & Approved' : (currentStage?.label || 'Created')}
                        </span>
                    </div>
                    <span className={`text-xl font-black ${
                        isDisbursedOrClosed || isSanctionedOrApproved ? 'text-emerald-600' : 'text-[#7C3AED]'
                    }`}>{calculatedProgress}%</span>
                </div>

                {/* Stepper Funnel */}
                <div className="relative pl-6 space-y-3.5 py-2">
                    {/* Stepper Connector Line */}
                    <div className="absolute left-[9px] top-4 bottom-4 w-[2px] bg-slate-100" />

                    {STAGES_LIST.map((stage) => {
                        const isCompleted = stage.order <= maxCompletedOrder;
                        const isCurrent = !isCompleted && Boolean(currentStage) && stage.id === currentStageKey;
                        const stageTimestamp = getStageTimestamp(stage.order - 1, isCompleted, Boolean(isCurrent));
                        const stageTimestampFormatted = formatToIST(stageTimestamp);

                        return (
                            <div key={stage.id} className="flex items-start justify-between gap-3 relative py-0.5">
                                <div className="flex items-start gap-3 min-w-0">
                                    {/* Step Circle */}
                                    <div className={`absolute -left-[21px] top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                        isCompleted
                                            ? "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-600/20"
                                            : isCurrent
                                                ? "bg-white border-[#7C3AED] text-[#7C3AED] shadow-sm shadow-purple-600/20"
                                                : "bg-white border-slate-200 text-slate-400"
                                    }`}>
                                        {isCompleted ? (
                                            <span className="material-symbols-outlined text-[10px] font-black">check</span>
                                        ) : (
                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                        )}
                                    </div>
                                    <div>
                                        <span className={`text-xs block transition-all ${
                                            isCurrent
                                                ? "font-extrabold text-[#7C3AED]"
                                                : isCompleted
                                                    ? "font-semibold text-emerald-700"
                                                    : "font-medium text-slate-400"
                                        }`}>
                                            {stage.label}
                                        </span>
                                        {stageTimestampFormatted && (isCompleted || isCurrent) && (
                                            <span className="text-[9px] font-medium text-slate-400 block tracking-tight mt-0.5">
                                                {stageTimestampFormatted.date} • {stageTimestampFormatted.time}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold font-mono text-slate-400 shrink-0">{stage.progress}%</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className={`bg-white rounded-xl border border-gray-100 ${compact ? 'p-4 md:p-5' : 'p-6 md:p-8'} shadow-sm ${className}`}>
            {/* Header / Info */}
            <div className={`flex justify-between items-center ${compact ? 'mb-6' : 'mb-10'}`}>
                <h3 className="text-xs font-black uppercase tracking-widest text-[#6605c7] flex items-center gap-2">
                    <span className="w-5 h-5 bg-[#6605c7]/10 text-[#6605c7] rounded flex items-center justify-center">
                        <span className="material-symbols-outlined text-xs">rocket_launch</span>
                    </span>
                    {title}
                </h3>
                <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
                        isDisbursedOrClosed || isSanctionedOrApproved
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : 'bg-emerald-50 text-emerald-700'
                    }`}>
                        <span className="material-symbols-outlined text-xs">
                            {isDisbursedOrClosed ? 'payments' : isSanctionedOrApproved ? 'verified' : 'rocket_launch'}
                        </span>
                        {isDisbursedOrClosed ? '100% Disbursed' : isSanctionedOrApproved ? 'Sanctioned & Approved' : `${calculatedProgress}% Complete`}
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className={`relative px-2 ${compact ? 'mb-10' : 'mb-12'} select-none overflow-x-auto custom-scrollbar`}>
                <div className="min-w-[640px] relative pb-4">
                    {/* Background Line */}
                    <div className="absolute top-5 left-0 right-0 h-[2px] bg-gray-100 rounded-full mx-6" />

                    {/* Active Progress Line */}
                    <div
                        className={`absolute top-5 left-0 h-[3px] rounded-full mx-6 transition-all duration-1000 ease-out ${
                            isDisbursedOrClosed || isSanctionedOrApproved
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                                : 'bg-[#6605c7] shadow-[0_0_10px_rgba(102,5,199,0.3)]'
                        }`}
                        style={{ width: `calc(${calculatedProgress}% - 48px)` }}
                    />

                    <div className="relative flex justify-between">
                        {STAGES_LIST.map((stage) => {
                            const isCompleted = stage.order <= maxCompletedOrder;
                            const isCurrent = !isCompleted && Boolean(currentStage) && stage.id === currentStageKey;
                            const stageTimestamp = getStageTimestamp(stage.order - 1, isCompleted, Boolean(isCurrent));
                            const stageTimestampFormatted = formatToIST(stageTimestamp);

                            return (
                                <div key={stage.id} className="flex flex-col items-center group relative" style={{ width: '48px' }}>
                                    {/* Step Circle */}
                                    <div className={`
                                        w-10 h-10 rounded-full flex items-center justify-center z-10 transition-all duration-500 border-2
                                        ${isCompleted ? 'bg-emerald-500 border-emerald-100 text-white shadow-lg shadow-emerald-500/10' :
                                            isCurrent ? 'bg-white border-[#6605c7] text-[#6605c7] shadow-lg shadow-[#6605c7]/10 scale-110' :
                                                'bg-white border-gray-100 text-gray-300'}
                                    `}>
                                        <span className={`material-symbols-outlined text-[18px] ${isCurrent ? 'animate-pulse' : ''}`}>
                                            {isCompleted ? 'check' : stage.icon}
                                        </span>
                                    </div>

                                    {/* Label & Completion Timestamp */}
                                    <div className="absolute top-12 whitespace-nowrap text-center flex flex-col items-center">
                                        <span className={`text-[10px] font-bold uppercase tracking-tighter ${isCompleted ? 'text-emerald-600' : isCurrent ? 'text-[#6605c7]' : 'text-gray-400'}`}>
                                            {stage.label}
                                        </span>
                                        {stageTimestampFormatted && (
                                            <div className="text-[8px] leading-tight text-gray-400 font-bold tracking-wider mt-1 select-none tabular-nums text-center">
                                                <div>{stageTimestampFormatted.date}</div>
                                                <div className="text-gray-400/80 font-medium mt-0.5">{stageTimestampFormatted.time}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

export { ProgressTracker };
