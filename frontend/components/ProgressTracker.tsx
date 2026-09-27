"use client";

import React, { useMemo } from "react";
import { getProfileDocumentRequirements } from "@/lib/documentRequirements";

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

export const getDynamicProgress = (app: any, documents: any[] = [], profile?: any): number => {
    if (!app) return 10;
    const s = String(app.status || '').toLowerCase();
    if (['disbursed', 'closed', 'disbursement_confirmed'].includes(s)) return 100;
    if (['sanctioned', 'approved', 'sanction', 'conditional_sanction', 'partial_sanction', 'counter_offer', 'sanction_issued'].includes(s)) return 95;
    if (['under_bank_review', 'query_raised', 'processing', 'bank_review'].includes(s)) return 90;
    if (['submitted_to_bank', 'submit_to_bank', 'file_logged'].includes(s)) return 75;
    if (['staff_verified', 'verification', 'documents_verified', 'document_verification'].includes(s)) return 50;

    let baseProgress = typeof app.progress === 'number' && app.progress > 0 ? app.progress : 10;
    if (['docs_received', 'docs_uploaded', 'under_review'].includes(s)) baseProgress = Math.max(baseProgress, 40);
    if (['submitted', 'application_submitted'].includes(s)) baseProgress = Math.max(baseProgress, 25);

    if (documents && documents.length > 0) {
        const uploadedCount = documents.filter(d => d.uploaded === true || d.status === 'uploaded' || d.status === 'verified').length;
        if (uploadedCount > 0) {
            let requiredCount = 3;
            try {
                if (profile) {
                    const reqs = getProfileDocumentRequirements(profile);
                    if (reqs && reqs.length > 0) requiredCount = reqs.length;
                }
            } catch { }

            const isAllDocsUploaded = uploadedCount >= requiredCount;
            const docProgress = isAllDocsUploaded ? 50 : Math.min(50, 25 + Math.round((uploadedCount / Math.max(requiredCount, 1)) * 25));
            return Math.max(baseProgress, docProgress);
        }
    }

    return baseProgress;
};

export const getStageKeyForApp = (app: any, calculatedProgress?: number): string => {
    if (!app) return 'application_created';
    const status = String(app.status || '').toLowerCase();
    if (status === 'rejected' || status === 'cancelled') return 'application_created';

    let stageKey = app.stage;
    if (['sanctioned', 'approved', 'sanction', 'conditional_sanction', 'partial_sanction', 'counter_offer', 'sanction_issued'].includes(status)) return 'sanction';
    if (['disbursed', 'disbursement_confirmed', 'closed'].includes(status)) return 'disbursement';
    if (status.includes('process') || status.includes('review') || status === 'under_bank_review' || stageKey === 'bank_review') return 'bank_review';
    if (status.includes('submit_to_bank') || status.includes('submitted_to_bank') || status === 'file_logged' || stageKey === 'submit_to_bank') return 'submit_to_bank';
    if (status === 'submitted' || status === 'application_submitted' || stageKey === 'application_submitted') return 'application_submitted';
    if (status.includes('document') || status.includes('verification') || stageKey === 'document_verification') return 'document_verification';
    if (status.includes('credit') || stageKey === 'credit_check') return 'credit_check';

    if (!stageKey || !STAGES_CONFIG[stageKey]) {
        const p = calculatedProgress !== undefined ? calculatedProgress : (app.progress || 10);
        if (p >= 100) return 'disbursement';
        if (p >= 95) return 'sanction';
        if (p >= 90) return 'bank_review';
        if (p >= 75) return 'credit_check';
        if (p >= 50) return 'submit_to_bank';
        if (p >= 40) return 'document_verification';
        if (p >= 25) return 'application_submitted';

        return 'application_created';
    }
    return stageKey;
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
}: ProgressTrackerProps) {
    const targetApp = application || app;

    const calculatedProgress = useMemo(() => {
        return getDynamicProgress(targetApp, documents, profile);
    }, [targetApp, documents, profile]);

    const currentStageKey = useMemo(() => {
        if (!targetApp) return null;
        if (targetApp.status?.toLowerCase() === 'rejected' || targetApp.status?.toLowerCase() === 'cancelled') return null;
        return getStageKeyForApp(targetApp, calculatedProgress);
    }, [targetApp, calculatedProgress]);

    const statusLower = targetApp?.status?.toLowerCase() || '';
    const isSanctionedOrApproved = ['sanctioned', 'approved', 'sanction', 'conditional_sanction', 'partial_sanction', 'counter_offer', 'sanction_issued'].includes(statusLower) || targetApp?.stage === 'sanction' || targetApp?.stage === 'sanctioned';
    const isDisbursedOrClosed = ['disbursed', 'disbursement_confirmed', 'closed'].includes(statusLower) || targetApp?.stage === 'disbursement' || targetApp?.stage === 'disbursed';
    const isRejected = targetApp?.status?.toLowerCase() === 'rejected' || targetApp?.status?.toLowerCase() === 'cancelled';

    const currentStage = currentStageKey ? STAGES_CONFIG[currentStageKey] : null;

    const maxCompletedOrder = isDisbursedOrClosed
        ? 8
        : isSanctionedOrApproved
            ? 7
            : (currentStage ? (currentStageKey === 'disbursement' && calculatedProgress >= 100 ? 8 : currentStage.order - 1) : 0);

    const appCreatedAt = targetApp?.createdAt || targetApp?.created_at || targetApp?.submittedAt || targetApp?.submitted_at || targetApp?.date;
    const appUpdatedAt = targetApp?.updatedAt || targetApp?.updated_at || appCreatedAt;
    const lastCompletedIdx = maxCompletedOrder - 1;

    const getStageTimestamp = (stageIdx: number, completed: boolean, active?: boolean): string | undefined => {
        if (!completed && !active) return undefined;
        if (stageIdx === 0) return appCreatedAt;
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
                            const isCurrent = !isCompleted && currentStage && (
                                isSanctionedOrApproved ? stage.id === 'disbursement' : stage.id === currentStageKey
                            );
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
