"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { authApi, chatApi, documentApi } from "@/lib/api";
import Navbar from "@/components/Navbar";
import ProgressTracker from "@/components/ProgressTracker";
import UserActivityLog from "@/components/User/UserActivityLog";
import UserProfileView from "@/components/User/UserProfileView";
import { io } from "socket.io-client";
import { getProfileDocumentRequirements, getDocumentRequirementName } from "@/lib/documentRequirements";
import DatePicker from "@/components/DatePicker";
import SupportTicketModal from "@/components/SupportTicketModal";
import UserSupportTicketsView from "@/components/UserSupportTicketsView";
import MultiPartyChatInterface from "@/components/Chat/MultiPartyChatInterface";
import ChatInterface from "@/components/Chat/ChatInterface";
import { formatPhone, isPhoneValid } from "@/lib/validation";

interface DashboardData {
    applicationCount?: number;
    applications?: Array<{
        id: string;
        bank: string;
        amount: number;
        status: string;
        createdAt: string;
        loanType?: string;
        universityName?: string;
        country?: string;
        courseName?: string;
        stage?: string;
        progress?: number;
        applicationNumber?: string;
        submittedAt?: string;
        date?: string;
        firstName?: string;
        lastName?: string;
        remarks?: string;
        sanctionLetterUrl?: string;
        coApplicantRelation?: string;
        coApplicantPhone?: string;
        coApplicantIncome?: number;
    }>;
    recommendedLoans?: Array<{ name: string; rate: string }>;
    documents?: Array<{ name: string; status: string; docType: string }>;
    aiToolsUsed?: number;
    activity?: Array<{
        type: string;
        title: string;
        description: string;
        timestamp: string;
        link?: string;
    }>;
    profile?: any;
    parents?: any[];
    family?: any;
}

interface Stage {
    order: number;
    label: string;
    icon: string;
    progress: number;
}

const STAGES_CONFIG: Record<string, Stage> = {
    application_created: { order: 1, label: 'Created', icon: 'bolt', progress: 10 },
    application_submitted: { order: 2, label: 'Submitted', icon: 'send', progress: 25 },
    document_verification: { order: 3, label: 'Documents', icon: 'verified', progress: 40 },
    submit_to_bank: { order: 4, label: 'Submit to Bank', icon: 'account_balance', progress: 50 },
    credit_check: { order: 5, label: 'Credit Check', icon: 'credit_score', progress: 75 },
    bank_review: { order: 6, label: 'Review', icon: 'rate_review', progress: 90 },
    sanction: { order: 7, label: 'Sanction', icon: 'assignment_turned_in', progress: 95 },
    disbursement: { order: 8, label: 'Disbursed', icon: 'payments', progress: 100 },
};

const STAGES_LIST = Object.entries(STAGES_CONFIG)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([key, value]) => ({ id: key, ...value }));

function ApplicationProgressCollapse({ app }: { app: any }) {
    const isRejected = app.status?.toLowerCase() === 'rejected' || app.status?.toLowerCase() === 'cancelled';
    const statusLower = app.status?.toLowerCase() || '';
    const isSanctionedOrApproved = ['sanctioned', 'approved', 'sanction', 'conditional_sanction', 'partial_sanction', 'counter_offer', 'sanction_issued'].includes(statusLower) || app.stage === 'sanction' || app.stage === 'sanctioned';
    const isDisbursedOrClosed = ['disbursed', 'disbursement_confirmed', 'closed'].includes(statusLower) || app.stage === 'disbursement' || app.stage === 'disbursed';

    const currentStageKey = (() => {
        if (!app) return null;
        if (app.status?.toLowerCase() === 'rejected' || app.status?.toLowerCase() === 'cancelled') return null;

        let stageKey = app.stage;
        const status = app.status?.toLowerCase() || '';
        if (['sanctioned', 'approved', 'sanction', 'conditional_sanction', 'partial_sanction', 'counter_offer', 'sanction_issued'].includes(status)) return 'sanction';
        if (['disbursed', 'disbursement_confirmed', 'closed'].includes(status)) return 'disbursement';
        if (status.includes('process') || status.includes('review') || status === 'under_bank_review') return 'bank_review';
        if (status.includes('submit_to_bank') || status.includes('submitted_to_bank') || status === 'file_logged') return 'submit_to_bank';
        if (status === 'submitted' || status === 'application_submitted') return 'application_submitted';
        if (status.includes('document') || status.includes('verification')) return 'document_verification';
        if (status.includes('credit')) return 'credit_check';

        if (!stageKey || !STAGES_CONFIG[stageKey]) {
            if (app.progress >= 100) return 'disbursement';
            if (app.progress >= 95) return 'sanction';
            if (app.progress >= 90) return 'bank_review';
            if (app.progress >= 75) return 'credit_check';
            if (app.progress >= 50) return 'submit_to_bank';
            if (app.progress >= 40) return 'document_verification';
            if (app.progress >= 25) return 'application_submitted';

            return 'application_created';
        }
        return stageKey;
    })();

    const currentStage = currentStageKey ? STAGES_CONFIG[currentStageKey] : null;
    const currentProgress = getDynamicProgress(app, [], null);

    const maxCompletedOrder = isDisbursedOrClosed
        ? 8
        : isSanctionedOrApproved
            ? 7
            : (currentStage ? (currentStageKey === 'disbursement' && currentProgress >= 100 ? 8 : currentStage.order - 1) : 0);

    const appCreatedAt = app.createdAt || app.created_at || app.submittedAt || app.submitted_at || app.date;
    const appUpdatedAt = app.updatedAt || app.updated_at || appCreatedAt;

    const lastCompletedIdx = maxCompletedOrder - 1;

    const getStageTimestamp = (stageIdx: number, completed: boolean, active?: boolean): string | undefined => {
        if (!completed && !active) return undefined;
        if (stageIdx === 0) return appCreatedAt;
        if (active || stageIdx === lastCompletedIdx) return appUpdatedAt || appCreatedAt;

        // Give intermediate steps a small simulated progressive delay for realism
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

    const formatToIST = (dateVal: any): { date: string; time: string } | null => {
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

    if (isRejected) {
        return (
            <div className="mt-4 bg-red-50/50 border border-red-100 rounded-xl p-6 shadow-sm animate-fadeIn">
                <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center text-white shadow-md shrink-0">
                        <span className="material-symbols-outlined text-xl">cancel</span>
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-red-900 capitalize">Application {app.status}</h3>
                        <p className="text-red-700/60 text-xs truncate">Your {getBankDisplayName(app.bank) ? `${getBankDisplayName(app.bank)} ` : ""}application was {app.status}.</p>
                    </div>
                </div>
                <div className="p-3 bg-white/60 rounded-lg border border-red-100">
                    <p className="text-xs text-red-700 font-medium">Please contact our support team or start a new application for a different bank.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-4 bg-[#6605c7]/[0.01] border border-gray-100 rounded-xl p-6 md:p-8 shadow-inner animate-fadeIn">
            {/* Header / Info */}
            <div className="flex justify-between items-center mb-10">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#6605c7] flex items-center gap-2">
                    <span className="w-5 h-5 bg-[#6605c7]/10 text-[#6605c7] rounded flex items-center justify-center">
                        <span className="material-symbols-outlined text-xs">rocket_launch</span>
                    </span>
                    Application Progress
                </h3>
                <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${isDisbursedOrClosed || isSanctionedOrApproved
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}>
                        <span className="material-symbols-outlined text-xs">
                            {isDisbursedOrClosed ? 'payments' : isSanctionedOrApproved ? 'verified' : 'rocket_launch'}
                        </span>
                        {isDisbursedOrClosed ? '100% Disbursed' : isSanctionedOrApproved ? 'Sanctioned & Approved' : `${currentProgress}% Complete`}
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className="relative px-2 mb-8 select-none">
                {/* Background Line */}
                <div className="absolute top-5 left-0 right-0 h-[2px] bg-gray-100 rounded-full mx-6" />

                {/* Active Progress Line */}
                <div
                    className={`absolute top-5 left-0 h-[3px] rounded-full mx-6 transition-all duration-1000 ease-out ${isDisbursedOrClosed || isSanctionedOrApproved
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                            : 'bg-[#6605c7] shadow-[0_0_10px_rgba(102,5,199,0.3)]'
                        }`}
                    style={{ width: `calc(${currentProgress}% - 48px)` }}
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
                            <div key={stage.id} className="flex flex-col items-center group relative" style={{ width: '40px' }}>
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
    );
}

const getDynamicProgress = (app: any, documents: any[] = [], profile?: any) => {
    if (!app) return 10;
    const s = String(app.status || '').toLowerCase();
    if (['disbursed', 'closed'].includes(s)) return 100;
    if (['sanctioned', 'approved', 'sanction'].includes(s)) return 95;
    if (['under_bank_review', 'query_raised', 'conditional_sanction', 'processing'].includes(s)) return 90;
    if (['submitted_to_bank', 'file_logged'].includes(s)) return 75;
    if (['staff_verified', 'verification', 'documents_verified'].includes(s)) return 50;

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

const getBankDisplayName = (bank?: string) => {
    if (!bank) return "";
    const b = bank.trim().toLowerCase();
    if (["anybank", "any_bank", "any bank", "any", "not_selected", "pending", "pending partner", "none", "not specified", "—"].includes(b)) {
        return "";
    }
    return bank;
};

export default function DashboardPage() {
    const { user, token, refreshUser } = useAuth();
    const { settings } = useSiteSettings();
    // The new ID is already human-readable (e.g. VL-STU-2026-54097) — no mangling needed
    const displayUserId = user?.id || "";
    const [data, setData] = useState<DashboardData>({});
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("overview");
    const [selectedChatApp, setSelectedChatApp] = useState<any>(null);
    const [expandedApps, setExpandedApps] = useState<Record<string, boolean>>({});
    const [selectedAppDetails, setSelectedAppDetails] = useState<any>(null);
    const [connectingSupport, setConnectingSupport] = useState(false);
    const [isSupportOpen, setIsSupportOpen] = useState(false);

    const handleConnectSupport = async () => {
        if (connectingSupport) return;
        setConnectingSupport(true);
        try {
            // Create/fetch conversation on the backend
            const res = await chatApi.connect() as any;
            // Use the whatsappUrl returned by backend (AWS WhatsApp number) or fallback
            const waUrl = res?.whatsappUrl ||
                (() => {
                    const num = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_AWS_WHATSAPP_NUMBER || '918143797779').replace(/\D/g, '');
                    const name = user?.firstName || 'there';
                    const text = encodeURIComponent(`Hi VidyaLoans team! I am ${name} and I need help with my education loan application.`);
                    return `https://wa.me/${num}?text=${text}`;
                })();
            window.open(waUrl, '_blank');
        } catch {
            // Fallback if API fails — still open WhatsApp
            const num = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_AWS_WHATSAPP_NUMBER || '918143797779').replace(/\D/g, '');
            const name = user?.firstName || 'there';
            const text = encodeURIComponent(`Hi VidyaLoans team! I am ${name} and I need help with my education loan application.`);
            window.open(`https://wa.me/${num}?text=${text}`, '_blank');
        } finally {
            setConnectingSupport(false);
        }
    };

    const handleDownloadApp = () => {
        let targetUrl = settings?.appStoreUrl || settings?.playStoreUrl || "https://play.google.com/store/apps/details?id=in.vidyaloans.app";
        if (typeof window !== "undefined") {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
            const isAndroid = /android/i.test(navigator.userAgent);
            if (isIOS && settings?.appStoreUrl) {
                targetUrl = settings.appStoreUrl;
            } else if (isAndroid && settings?.playStoreUrl) {
                targetUrl = settings.playStoreUrl;
            }
        }
        window.open(targetUrl, "_blank", "noopener,noreferrer");
    };

    const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});

    const [profileSubTab, setProfileSubTab] = useState<"personal" | "family" | "academic">("personal");
    const [leftTilt, setLeftTilt] = useState({ x: 0, y: 0 });
    const [rightTilt, setRightTilt] = useState({ x: 0, y: 0 });

    const handleLeftMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        setLeftTilt({ x: -(y / rect.height) * 10, y: (x / rect.width) * 10 });
    };

    const handleLeftMouseLeave = () => setLeftTilt({ x: 0, y: 0 });

    const handleRightMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        setRightTilt({ x: -(y / rect.height) * 10, y: (x / rect.width) * 10 });
    };

    const handleRightMouseLeave = () => setRightTilt({ x: 0, y: 0 });

    // Inline Editing States
    const [editingCard, setEditingCard] = useState<string | null>(null);
    const [savingProfile, setSavingProfile] = useState(false);
    const [personalForm, setPersonalForm] = useState({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        dateOfBirth: "",
    });
    const [familyForm, setFamilyForm] = useState({
        fatherName: "",
        fatherAadhar: "",
        fatherPan: "",
        motherName: "",
        motherAadhar: "",
        motherPan: "",
        coApplicantName: "",
        coApplicantRelation: "",
        coApplicantPhone: "",
        coApplicantIncome: "",
        coApplicantAadhar: "",
        coApplicantPan: "",
    });

    const toggleSecretVisibility = (key: string) => {
        setVisibleSecrets(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const toggleAppProgress = (appId: string) => {
        setExpandedApps(prev => ({ ...prev, [appId]: !prev[appId] }));
    };

    const loadData = useCallback(async (isSilent = false) => {
        if (!user?.email && !user?.id) return;
        if (!isSilent) {
            setLoading(true);
        }
        try {
            let targetUserId = user?.id;
            if (!targetUserId && user?.email) {
                const dash = await authApi.getDashboard(user.email) as {
                    success: boolean;
                    user?: { id: string };
                };
                if (dash?.success && dash.user?.id) {
                    targetUserId = dash.user.id;
                }
            }

            if (targetUserId) {
                const dynamic = await authApi.getDashboardData(targetUserId) as {
                    success: boolean;
                    data?: {
                        applications?: DashboardData["applications"];
                        documents?: DashboardData["documents"];
                        activity?: DashboardData["activity"];
                        applicationCount?: number;
                        user?: any;
                    };
                };
                if (dynamic?.success && dynamic.data) {
                    const dynData: any = dynamic.data;
                    setData({
                        applicationCount: dynData.applications?.length || 0,
                        applications: dynData.applications || [],
                        documents: dynData.documents || [],
                        activity: dynData.activity || [],
                        profile: dynData.user || null,
                        parents: dynData.parents || dynData.user?.parents || [],
                        family: dynData.family || dynData.user?.family || {},
                    });
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [user?.email, user?.id]);

    const handleSavePersonal = async () => {
        if (!user?.email) return;

        // Validate first name
        if (!personalForm.firstName || personalForm.firstName.trim().length < 3) {
            alert("First name must be at least 3 characters");
            return;
        }

        // Validate last name
        if (!personalForm.lastName || personalForm.lastName.trim().length < 1) {
            alert("Last name must be at least 1 character");
            return;
        }

        // Validate phone number
        if (personalForm.phoneNumber && !isPhoneValid(personalForm.phoneNumber)) {
            alert("Please enter a valid phone number");
            return;
        }

        // Validate Date of Birth
        if (!personalForm.dateOfBirth) {
            alert("Date of birth is required");
            return;
        }

        setSavingProfile(true);
        try {
            await authApi.updateDetails(user.email, {
                firstName: personalForm.firstName,
                lastName: personalForm.lastName,
                phoneNumber: personalForm.phoneNumber,
                dateOfBirth: personalForm.dateOfBirth,
            });
            await refreshUser();
            await loadData();
            setEditingCard(null);
        } catch (e) {
            console.error(e);
            alert(e instanceof Error ? e.message : "Failed to save changes");
        } finally {
            setSavingProfile(false);
        }
    };

    const handleSaveFamily = async () => {
        if (!user?.id) return;

        setSavingProfile(true);
        try {
            await documentApi.updateProfile(user.id, {
                email: user.email,
                family: {
                    fatherName: familyForm.fatherName || null,
                    fatherAadhar: familyForm.fatherAadhar ? familyForm.fatherAadhar.replace(/\s+/g, '') : null,
                    fatherPan: familyForm.fatherPan ? familyForm.fatherPan.toUpperCase().replace(/\s+/g, '') : null,
                    motherName: familyForm.motherName || null,
                    motherAadhar: familyForm.motherAadhar ? familyForm.motherAadhar.replace(/\s+/g, '') : null,
                    motherPan: familyForm.motherPan ? familyForm.motherPan.toUpperCase().replace(/\s+/g, '') : null,
                },
                parents: [
                    {
                        relation: "father",
                        name: familyForm.fatherName || null,
                        aadharNumber: familyForm.fatherAadhar ? familyForm.fatherAadhar.replace(/\s+/g, '') : null,
                        panNumber: familyForm.fatherPan ? familyForm.fatherPan.toUpperCase().replace(/\s+/g, '') : null
                    },
                    {
                        relation: "mother",
                        name: familyForm.motherName || null,
                        aadharNumber: familyForm.motherAadhar ? familyForm.motherAadhar.replace(/\s+/g, '') : null,
                        panNumber: familyForm.motherPan ? familyForm.motherPan.toUpperCase().replace(/\s+/g, '') : null
                    },
                    {
                        relation: "coapplicant",
                        name: familyForm.coApplicantName || null,
                        aadharNumber: familyForm.coApplicantAadhar ? familyForm.coApplicantAadhar.replace(/\s+/g, '') : null,
                        panNumber: familyForm.coApplicantPan ? familyForm.coApplicantPan.toUpperCase().replace(/\s+/g, '') : null
                    }
                ],
                coApplicant: {
                    name: familyForm.coApplicantName || null,
                    relation: familyForm.coApplicantRelation || null,
                    mobile: familyForm.coApplicantPhone ? familyForm.coApplicantPhone.replace(/\s+/g, '') : null,
                    monthlyIncome: familyForm.coApplicantIncome ? parseFloat(familyForm.coApplicantIncome) : null
                }
            });
            await refreshUser();
            await loadData();
            setEditingCard(null);
        } catch (e) {
            console.error(e);
            alert(e instanceof Error ? e.message : "Failed to save changes");
        } finally {
            setSavingProfile(false);
        }
    };

    const handleTabChange = useCallback((newTab: string, replace = false) => {
        const validTabs = ["overview", "applications", "documents", "support_tickets", "profile"];
        if (!validTabs.includes(newTab)) return;

        setActiveTab(newTab);

        if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("tab", newTab);
            url.hash = newTab;

            if (replace) {
                window.history.replaceState({}, "", url.toString());
            } else {
                window.history.pushState({}, "", url.toString());
            }
        }
    }, []);

    useEffect(() => {
        loadData();

        // Sync activeTab with URL search params or hash on initial load & popstate/hashchange
        const syncTabFromUrl = () => {
            if (typeof window !== "undefined") {
                const params = new URLSearchParams(window.location.search);
                const queryTab = params.get("tab");
                const hashTab = window.location.hash.replace("#", "");
                const validTabs = ["overview", "applications", "documents", "support_tickets", "profile"];

                if (queryTab && validTabs.includes(queryTab)) {
                    setActiveTab(queryTab);
                } else if (hashTab && validTabs.includes(hashTab)) {
                    setActiveTab(hashTab);
                }
            }
        };

        syncTabFromUrl();

        const handleUrlChange = () => {
            syncTabFromUrl();
        };

        window.addEventListener("popstate", handleUrlChange);
        window.addEventListener("hashchange", handleUrlChange);
        return () => {
            window.removeEventListener("popstate", handleUrlChange);
            window.removeEventListener("hashchange", handleUrlChange);
        };
    }, [loadData]);

    // Listen for dashboard updates from other pages/tabs
    useEffect(() => {
        const onExternalUpdate = () => {
            loadData(true);
            if (refreshUser) refreshUser();
        };
        const onStorage = (e: StorageEvent) => {
            if (e.key && (e.key.startsWith('dashboardDataUpdated_') || e.key === 'staff_profile_updated')) {
                loadData(true);
                if (refreshUser) refreshUser();
            }
        };

        window.addEventListener('dashboard-data-changed', onExternalUpdate as EventListener);
        window.addEventListener('storage', onStorage);

        return () => {
            window.removeEventListener('dashboard-data-changed', onExternalUpdate as EventListener);
            window.removeEventListener('storage', onStorage);
        };
    }, [loadData, refreshUser]);

    const hasRecentLocalSubmission = typeof window !== 'undefined' && (() => {
        try {
            if (localStorage.getItem('has_applied_loan')) {
                localStorage.removeItem('has_applied_loan');
            }
            const raw = localStorage.getItem('recent_application_submitted');
            if (!raw) return false;
            const parsed = JSON.parse(raw);
            return (parsed.userId === user?.id || (user?.email && parsed.email === user.email)) && (Date.now() - (parsed.timestamp || 0)) < 2592000000;
        } catch {
            return false;
        }
    })();

    const hasUserApps = !!((user as any)?.applications && ((user as any).applications as any[]).length > 0) || !!((user as any)?.loanApplications && ((user as any).loanApplications as any[]).length > 0);
    const hasDataApps = !!(data.applications && data.applications.length > 0);
    const hasApplied = hasDataApps || hasUserApps || hasRecentLocalSubmission;

    useEffect(() => {
        if (!hasDataApps && !hasUserApps && !loading) {
            try {
                if (localStorage.getItem('has_applied_loan')) {
                    localStorage.removeItem('has_applied_loan');
                }
                const raw = localStorage.getItem('recent_application_submitted');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (parsed.userId === user?.id || (user?.email && parsed.email === user.email)) {
                        if (Date.now() - (parsed.timestamp || 0) > 60000) {
                            localStorage.removeItem('recent_application_submitted');
                        }
                    }
                }
            } catch { }
        }
    }, [hasDataApps, hasUserApps, loading, user?.id, user?.email]);

    const firstApp = (data.applications && data.applications.length > 0) ? data.applications[0] : null;
    const isApproved = !!(firstApp && ['sanctioned', 'approved', 'disbursed'].includes(firstApp.status?.toLowerCase()));

    const getStaffDetails = (app: any) => {
        const staffName = app?.assignedStaffName || app?.assignedStaff?.name || (app?.assignedStaff?.firstName ? `${app.assignedStaff.firstName} ${app.assignedStaff.lastName || ''}`.trim() : '');
        const staffEmail = app?.assignedStaffEmail || app?.assignedStaff?.email;
        const staffPhone = app?.assignedStaffPhone || app?.assignedStaff?.phone || app?.assignedStaff?.phoneNumber || app?.assignedStaffMobile;
        const staffRole = app?.assignedStaffRole || app?.assignedStaff?.role || app?.assignedStaff?.designation || "Assigned Loan Processing Officer";

        if (staffName || staffEmail) {
            const displayName = staffName || (staffEmail ? staffEmail.split('@')[0].replace(/[\._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Assigned Support Officer");
            return {
                isAssigned: true,
                name: displayName,
                email: staffEmail || "support@vidyaloans.com",
                phone: staffPhone || "",
                role: staffRole,
                initials: displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
            };
        }

        if (app?.assignedTo?.name || app?.assignedTo?.email) {
            const name = app.assignedTo.name || app.assignedTo.email.split('@')[0];
            return {
                isAssigned: true,
                name,
                email: app.assignedTo.email || "support@vidyaloans.com",
                phone: app.assignedTo.phone || app.assignedTo.phoneNumber || "",
                role: app.assignedTo.role || "Senior Loan Officer",
                initials: name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
            };
        }

        if (app?.assignedStaffId && app.assignedStaffId !== 'unassigned' && app.assignedStaffId !== 'null') {
            const staffIdStr = String(app.assignedStaffId);
            const isEmail = staffIdStr.includes('@');
            const cleanName = app?.assignedStaffName || (isEmail ? staffIdStr.split('@')[0].replace(/[\._]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : "Education Loan Officer");
            const cleanEmail = app?.assignedStaffEmail || (isEmail ? staffIdStr : "support@vidyaloans.com");
            return {
                isAssigned: true,
                name: cleanName,
                email: cleanEmail,
                phone: staffPhone || "",
                role: staffRole || "Senior Education Loan Advisor",
                initials: cleanName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
            };
        }

        return {
            isAssigned: false,
            name: "VidyaLoans Support Team",
            email: "support@vidyaloans.com",
            phone: "",
            role: "Loan Processing Desk",
            initials: "VL"
        };
    };

    const allDocsUploaded = (() => {
        if (!hasApplied) return false;

        // 1. Get the requirements for this profile
        const activeProfile = data.profile || user || {};
        let family = activeProfile.family;
        if (typeof family === 'string') {
            try { family = JSON.parse(family); } catch { family = {}; }
        }
        if (!family) family = activeProfile.familyDetails || {};

        let coApplicant = activeProfile.coApplicant;
        if (typeof coApplicant === 'string') {
            try { coApplicant = JSON.parse(coApplicant); } catch { coApplicant = {}; }
        }
        if (!coApplicant) coApplicant = {};

        const mergedProfile = {
            ...activeProfile,
            family,
            coApplicant: {
                ...coApplicant,
                relation: (firstApp as any)?.coApplicantRelation || coApplicant.relation || activeProfile.coApplicantRelation || "",
                name: (firstApp as any)?.coApplicantName || coApplicant.name || activeProfile.coApplicantName || ""
            }
        };

        const requiredDocs = getProfileDocumentRequirements(mergedProfile);
        if (requiredDocs.length === 0) return true;

        // 2. Get the uploaded docTypes (or those synced/uploaded)
        const uploadedDocTypes = new Set(
            (data.documents || [])
                .map(d => d.docType)
        );

        // 3. Verify all requiredDocs types are in uploadedDocTypes
        return requiredDocs.every(req => uploadedDocTypes.has(req.type));
    })();
    const profileCompleteness = (() => {
        let count = 0;
        if (user?.id) count += 1;
        if (user?.firstName) count += 1;
        if (user?.lastName) count += 1;
        if (user?.phoneNumber) count += 1;
        if (user?.dateOfBirth) count += 1;
        return count * 20;
    })();

    const quickLinks = [
        ...(hasApplied ? [] : [{ href: "/apply-loan", icon: "add_circle", label: "Apply for Loan", desc: "Start a new application", color: "from-purple-500 to-indigo-600", comingSoon: false, isApp: false }]),
        { href: "/document-vault", icon: "folder_shared", label: "Document Vault", desc: "Securely upload docs", color: "from-blue-600 to-indigo-700", comingSoon: false, isApp: false },
        // { href: "#download-app", icon: "smartphone", label: "Mobile App", desc: "Real-time updates & tracking", color: "from-[#6605c7] to-[#8b24e5]", comingSoon: false, isApp: true },
        { href: "/community/discussions", icon: "forum", label: "Community", desc: "Ask & share advice", color: "from-emerald-500 to-teal-600", comingSoon: false, isApp: false },
    ];

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
                <div className="w-12 h-12 border-4 border-[#6605c7]/20 border-t-[#6605c7] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-transparent">
            <Navbar />

            <div className="max-w-7xl mx-auto px-6 pt-32 pb-16">
                {/* Welcome Banner */}
                <div className="mb-10 bg-[#6605c7]/[0.03] border border-[#6605c7]/10 rounded-2xl p-8 md:p-10 relative overflow-hidden">
                    <div className="absolute right-0 top-0 h-full w-64 opacity-[0.03] grayscale">
                        <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=500&q=20')] bg-cover" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                {/* <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6605c7]/10 text-[#6605c7] text-[10px] font-bold uppercase tracking-wider">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                    </span>
                                    Active Account
                                </div> */}
                                {user?.id && (
                                    <div className="inline-flex items-center gap-1.5 px-3 py-3 rounded-full bg-[#6605c7]/5 text-[#6605c7] text-[10px] font-bold uppercase tracking-wider border border-[#6605c7]/10 shadow-sm">
                                        <span className="material-symbols-outlined text-[30px] text-[#6605c7]">fingerprint</span>
                                        <span className="text-[13px]">User ID: {user.id}</span>
                                    </div>
                                )}
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold font-display text-gray-900 mb-2">
                                Welcome back, {data.profile?.passportOriginalName || data.profile?.nameAsInPassport || user?.passportOriginalName || user?.nameAsInPassport || (user?.firstName ? (user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName) : user?.email?.split("@")[0])}! 👋
                            </h1>
                            <p className="text-gray-500 text-sm">
                                {data.applications?.length
                                    ? `Your education loan journey is ${getDynamicProgress(data.applications[0], data.documents, data.profile)}% complete. ${getDynamicProgress(data.applications[0], data.documents, data.profile) >= 50 ? "You're doing great!" : "Keep going!"}`
                                    : "Start your education loan journey today!"}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                id="btn-connect-support"
                                type="button"
                                onClick={handleConnectSupport}
                                disabled={connectingSupport}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all duration-200 disabled:opacity-70 disabled:cursor-wait"
                            >
                                {connectingSupport ? (
                                    <>
                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        {/* WhatsApp icon SVG */}
                                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                        </svg>
                                        Connect with Support
                                    </>
                                )}
                            </button>
                            <Link href="/onboarding" className="px-5 py-2.5 bg-white text-gray-700 border border-gray-200 text-xs font-bold rounded-lg hover:bg-gray-50 transition-all">
                                Speak with Counsellor
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Mobile App Download Banner */}
                <div className="mb-10 relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1A0338] via-[#43088C] to-[#6605c7] p-6 md:p-8 text-white shadow-xl shadow-purple-900/15 border border-white/10">
                    <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-purple-400/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute right-1/3 top-0 w-48 h-48 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
                                <span className="material-symbols-outlined text-[32px] md:text-[38px] text-amber-300 animate-pulse">smartphone</span>
                            </div>
                            <div>
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-300/30 text-[10px] font-black uppercase tracking-wider mb-1.5">
                                    <span className="material-symbols-outlined text-[14px]">notifications_active</span>
                                    Instant Real-Time Updates
                                </div>
                                <h2 className="text-base md:text-lg font-black font-display tracking-tight text-white mb-1">
                                    For Real-Time Updates & Application Tracking, Download Our Mobile App
                                </h2>
                                <p className="text-purple-100/90 text-xs font-medium leading-relaxed max-w-2xl">
                                    Stay instantly informed on your application stage, bank decision alerts, document verification, and live advisor messages right on your phone!
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 shrink-0 w-full lg:w-auto justify-start lg:justify-end">
                            <button
                                type="button"
                                onClick={handleDownloadApp}
                                className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-amber-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer border-0 active:scale-95"
                            >
                                <span className="material-symbols-outlined text-lg">download</span>
                                Download App
                            </button>
                        </div>
                    </div>
                </div>

                {/* Loan Action Roadmap / Journey Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full mb-10">
                    {/* Card 1: Apply Loan / Loan Applied */}
                    {!hasApplied ? (
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-[#6605c7]/20 hover:-translate-y-1 hover:shadow-md transition-all group duration-300">
                            <div>
                                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-[#6605c7] mb-5 border border-purple-100 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-2xl">add_circle</span>
                                </div>
                                <h3 className="text-base font-black text-gray-900 mb-2">Apply for Loan</h3>
                                <p className="text-gray-500 text-xs font-semibold leading-relaxed mb-6">
                                    Submit your financing blueprint and university target for competitive interest rates.
                                </p>
                            </div>
                            <Link href="/apply-loan" className="w-full py-3 bg-[#6605c7] hover:bg-[#5504a8] text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 active:scale-98">
                                <span className="material-symbols-outlined text-sm">bolt</span> Apply Now
                            </Link>
                        </div>
                    ) : (
                        <div className="bg-emerald-50/20 rounded-3xl p-6 border border-emerald-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                            <div>
                                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-5 border border-emerald-100">
                                    <span className="material-symbols-outlined text-2xl">check_circle</span>
                                </div>
                                <h3 className="text-base font-black text-emerald-800 mb-2">Loan Applied</h3>
                                {getBankDisplayName(firstApp?.bank) ? (
                                    <p className="text-emerald-700 text-xs font-bold leading-relaxed mb-1">
                                        Bank: {getBankDisplayName(firstApp?.bank)}
                                    </p>
                                ) : null}
                                <p className="text-emerald-600/80 text-[11px] font-semibold">
                                    Amount: ₹{firstApp?.amount?.toLocaleString("en-IN") || '0'}
                                </p>
                            </div>
                            <div className="w-full py-3 bg-emerald-100/50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-xl text-center select-none border border-emerald-200/50 flex items-center justify-center gap-1.5">
                                <span className="material-symbols-outlined text-sm">verified</span> Submission Locked
                            </div>
                        </div>
                    )}

                    {/* Card 2: Upload Documents */}
                    {!hasApplied ? (
                        <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100/85 shadow-sm flex flex-col justify-between select-none opacity-60">
                            <div>
                                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-5 border border-slate-200">
                                    <span className="material-symbols-outlined text-2xl">lock</span>
                                </div>
                                <h3 className="text-base font-black text-slate-500 mb-2">Upload Documents</h3>
                                <p className="text-slate-400 text-xs font-semibold leading-relaxed mb-6">
                                    Upload academic marksheets and parents' income proofs to your secure vault.
                                </p>
                            </div>
                            <div className="w-full py-3 bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl text-center border border-slate-200/50 flex items-center justify-center gap-1.5">
                                <span className="material-symbols-outlined text-sm">lock</span> Locked
                            </div>
                        </div>
                    ) : isApproved ? (
                        <div className="bg-emerald-50/20 rounded-3xl p-6 border border-emerald-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                            <div>
                                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-5 border border-emerald-100">
                                    <span className="material-symbols-outlined text-2xl">check_circle</span>
                                </div>
                                <h3 className="text-base font-black text-emerald-800 mb-2">Documents Verified</h3>
                                <p className="text-emerald-600 text-xs font-semibold leading-relaxed mb-6">
                                    All your primary profile and parent financial documents have been successfully verified.
                                </p>
                            </div>
                            <Link href="/document-vault" className="w-full py-3 bg-emerald-100/50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-xl text-center transition-all border border-emerald-200/50 flex items-center justify-center gap-1.5 active:scale-98">
                                <span className="material-symbols-outlined text-sm">folder_open</span> View Documents
                            </Link>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-[#6605c7]/20 hover:-translate-y-1 hover:shadow-md transition-all group duration-300">
                            <div>
                                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-[#6605c7] mb-5 border border-purple-100 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                                </div>
                                <h3 className="text-base font-black text-gray-900 mb-2">Upload Documents</h3>
                                <p className="text-gray-505 text-xs font-semibold leading-relaxed mb-6">
                                    Upload academic marksheets and parents' income proofs to your secure vault.
                                </p>
                            </div>
                            <Link href="/document-vault" className="w-full py-3 bg-[#6605c7] hover:bg-[#5504a8] text-white text-[11px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 active:scale-98">
                                <span className="material-symbols-outlined text-sm">folder_shared</span> Open Vault
                            </Link>
                        </div>
                    )}

                    {/* Card 3: Bank Review / Approved */}
                    {!hasApplied || !allDocsUploaded ? (
                        <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100/85 shadow-sm flex flex-col justify-between select-none opacity-60">
                            <div>
                                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-5 border border-slate-200">
                                    <span className="material-symbols-outlined text-2xl">lock</span>
                                </div>
                                <h3 className="text-base font-black text-slate-500 mb-2">Bank Review</h3>
                                <p className="text-slate-400 text-xs font-semibold leading-relaxed mb-6">
                                    {!hasApplied
                                        ? "Your loan application is under underwriting evaluation at partner banks."
                                        : "Your loan application review will begin once all pre-required documents have been uploaded."}
                                </p>
                            </div>
                            <div className="w-full py-3 bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl text-center border border-slate-200/50 flex items-center justify-center gap-1.5">
                                <span className="material-symbols-outlined text-sm">lock</span> Locked
                            </div>
                        </div>
                    ) : isApproved ? (
                        <div className="bg-emerald-50/20 rounded-3xl p-6 border border-emerald-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                            <div>
                                <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mb-5 border border-emerald-100">
                                    <span className="material-symbols-outlined text-2xl">task_alt</span>
                                </div>
                                <h3 className="text-base font-black text-emerald-800 mb-2">Bank Approved</h3>
                                <p className="text-emerald-600 text-xs font-semibold leading-relaxed mb-6">
                                    Congratulations! Your application has been officially approved by {getBankDisplayName(firstApp?.bank) || 'our partner bank'}.
                                </p>
                            </div>
                            <div className="w-full py-3 bg-emerald-100/50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-xl text-center select-none border border-emerald-200/50 flex items-center justify-center gap-1.5">
                                <span className="material-symbols-outlined text-sm">verified</span> Approval Confirmed
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col justify-between hover:border-amber-500/20 hover:-translate-y-1 hover:shadow-md transition-all group duration-300">
                            <div>
                                <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-5 border border-amber-100 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-2xl animate-spin" style={{ animationDuration: '3s' }}>sync</span>
                                </div>
                                <h3 className="text-base font-black text-gray-900 mb-2">Bank Review</h3>
                                <p className="text-gray-500 text-xs font-semibold leading-relaxed mb-6">
                                    Your loan application is under underwriting evaluation at {getBankDisplayName(firstApp?.bank) || 'partner banks'}.
                                </p>
                            </div>
                            <div className="w-full py-3 bg-amber-50 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-xl text-center select-none border border-amber-100 flex items-center justify-center gap-1.5">
                                <span className="material-symbols-outlined text-sm">pending</span> Review in Progress
                            </div>
                        </div>
                    )}

                    {/* Card 4: Sanction Letter */}
                    {hasApplied && isApproved ? (
                        <div className="bg-emerald-50/20 rounded-3xl p-6 border border-emerald-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden group">
                            <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />
                            <div>
                                <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                                    <span className="material-symbols-outlined text-2xl">download</span>
                                </div>
                                <h3 className="text-base font-black text-emerald-800 mb-2">Sanction Letter</h3>
                                <p className="text-emerald-600 text-xs font-semibold leading-relaxed mb-6">
                                    Your official sanction letter provided by the bank is ready. View or download it below.
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <a
                                    href={firstApp?.sanctionLetterUrl || "/docs/mock-sanction.pdf"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 py-3 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-slate-200 flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer text-center"
                                >
                                    <span className="material-symbols-outlined text-sm">visibility</span> View
                                </a>
                                <a
                                    href={firstApp?.sanctionLetterUrl || "/docs/mock-sanction.pdf"}
                                    download
                                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-98 shadow-md shadow-emerald-500/15 cursor-pointer text-center"
                                >
                                    <span className="material-symbols-outlined text-sm">download</span> Download
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100/85 shadow-sm flex flex-col justify-between select-none opacity-60">
                            <div>
                                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-5 border border-slate-200">
                                    <span className="material-symbols-outlined text-2xl">lock</span>
                                </div>
                                <h3 className="text-base font-black text-slate-500 mb-2">Sanction Letter</h3>
                                <p className="text-slate-400 text-xs font-semibold leading-relaxed mb-6">
                                    Your official sanction letter will be unlocked here once the bank completes evaluation and approves your loan.
                                </p>
                            </div>
                            <div className="w-full py-3 bg-slate-100 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl text-center border border-slate-200/50 flex items-center justify-center gap-1.5">
                                <span className="material-symbols-outlined text-sm">lock</span> Locked
                            </div>
                        </div>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-8 overflow-x-auto no-scrollbar border-b border-slate-200/60 relative">
                    {["overview", "applications", "documents", "profile"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => handleTabChange(tab)}
                            className={`group relative px-6 py-3 text-[11px] font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap ${activeTab === tab
                                ? "text-[#0F172A] font-extrabold"
                                : "text-slate-400 hover:text-slate-700"
                                }`}
                        >
                            {tab.replace("_", " ")}
                            {/* Sliding underline */}
                            <span
                                className={`absolute bottom-0 left-0 h-[2px] bg-[#6605c7] transition-all duration-300 ease-out ${activeTab === tab ? "w-full" : "w-0 group-hover:w-full"
                                    }`}
                            />
                        </button>
                    ))}
                </div>

                {/* Overview Tab */}
                {activeTab === "overview" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Quick Actions */}
                        <div className="lg:col-span-2">
                            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6">Quick Actions</h2>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
                                {quickLinks.map((l, idx) => (
                                    l.comingSoon ? (
                                        <div key={l.label + idx} className="group p-5 bg-white rounded-xl border border-gray-100 border-amber-200/40 transition-all cursor-not-allowed relative overflow-hidden opacity-80 select-none">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className={`w-9 h-9 bg-gradient-to-r ${l.color} rounded-lg flex items-center justify-center text-white opacity-60`}>
                                                    <span className="material-symbols-outlined text-lg">{l.icon}</span>
                                                </div>
                                                <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200/60 rounded-full">Coming Soon</span>
                                            </div>
                                            <div className="font-bold text-[13px] text-gray-500">{l.label}</div>
                                            <div className="text-[11px] text-gray-400 mt-1 line-clamp-1">{l.desc}</div>
                                        </div>
                                    ) : (l as any).isApp ? (
                                        <div
                                            key={l.label + idx}
                                            onClick={handleDownloadApp}
                                            className="group p-5 bg-white rounded-xl border border-purple-100 hover:border-[#6605c7]/30 shadow-sm transition-all cursor-pointer"
                                        >
                                            <div className={`w-9 h-9 bg-gradient-to-r ${l.color} rounded-lg flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform shadow-md shadow-purple-500/20`}>
                                                <span className="material-symbols-outlined text-lg">{l.icon}</span>
                                            </div>
                                            <div className="font-bold text-[13px] text-gray-900 flex items-center justify-between">
                                                <span>{l.label}</span>
                                                <span className="text-[9px] font-black uppercase text-[#6605c7] bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded">App</span>
                                            </div>
                                            <div className="text-[11px] text-gray-500 mt-1 line-clamp-1">{l.desc}</div>
                                        </div>
                                    ) : (
                                        <Link key={l.href + idx} href={l.href} className="group p-5 bg-white rounded-xl border border-gray-100 hover:border-[#6605c7]/20 transition-all">
                                            <div className={`w-9 h-9 bg-gradient-to-r ${l.color} rounded-lg flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
                                                <span className="material-symbols-outlined text-lg">{l.icon}</span>
                                            </div>
                                            <div className="font-bold text-[13px] text-gray-900">{l.label}</div>
                                            <div className="text-[11px] text-gray-500 mt-1 line-clamp-1">{l.desc}</div>
                                        </Link>
                                    )
                                ))}
                            </div>

                            {/* Active Applications Summary */}
                            <div className="mb-10">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Active Applications</h2>
                                    {(data.applications?.length || 0) > 0 && (
                                        <button onClick={() => handleTabChange("applications")} className="text-[10px] font-bold uppercase tracking-wider text-[#6605c7] hover:underline flex items-center gap-1">
                                            View All <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                                        </button>
                                    )}
                                </div>
                                {!data.applications?.length ? (
                                    <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
                                        <div className="w-14 h-14 bg-[#6605c7]/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                            <span className="material-symbols-outlined text-3xl text-[#6605c7]/40">add_circle</span>
                                        </div>
                                        <p className="text-gray-500 text-[13px] font-semibold mb-1">No applications yet</p>
                                        <p className="text-gray-400 text-[11px] mb-4">Start your education loan journey</p>
                                        <Link href="/apply-loan" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#6605c7] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#5504a8] transition-all">
                                            <span className="material-symbols-outlined text-[16px]">add</span> Apply Now
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {data.applications.slice(0, 3).map((app) => {
                                            const statusColors: Record<string, string> = {
                                                pending: "bg-amber-100 text-amber-700",
                                                submitted: "bg-blue-100 text-blue-700",
                                                processing: "bg-indigo-100 text-indigo-700",
                                                approved: "bg-emerald-100 text-emerald-700 font-extrabold",
                                                sanctioned: "bg-emerald-100 text-emerald-700 font-extrabold",
                                                conditional_sanction: "bg-emerald-100 text-emerald-700 font-extrabold",
                                                partial_sanction: "bg-emerald-100 text-emerald-700 font-extrabold",
                                                counter_offer: "bg-emerald-100 text-emerald-700 font-extrabold",
                                                rejected: "bg-red-100 text-red-600",
                                                disbursed: "bg-emerald-100 text-emerald-700 font-extrabold",
                                                disbursement_confirmed: "bg-emerald-100 text-emerald-700 font-extrabold",
                                            };
                                            const sc = statusColors[app.status] || "bg-gray-100 text-gray-600";
                                            const isSanctionedOrDisbursed = ['approved', 'sanctioned', 'sanction', 'disbursed', 'disbursement_confirmed', 'closed'].includes(app.status?.toLowerCase() || '');
                                            return (
                                                <div key={app.id} className="bg-white rounded-xl p-4 border border-gray-100 hover:border-[#6605c7]/15 transition-all">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            <div className="w-9 h-9 bg-[#6605c7]/5 rounded-lg flex items-center justify-center text-[#6605c7] shrink-0">
                                                                <span className="material-symbols-outlined text-xl">account_balance</span>
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-[15px] text-gray-900 truncate">
                                                                        {getBankDisplayName(app.bank) || "Loan Application"}
                                                                    </span>
                                                                    {app.applicationNumber && (
                                                                        <span className="text-[12px] text-gray-500 font-mono font-semibold bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100/50">
                                                                            {app.applicationNumber}
                                                                        </span>
                                                                    )}
                                                                    <span className={`px-2 py-0.5 rounded-full text-[12px] font-bold uppercase tracking-wider ${sc}`}>
                                                                        {app.status}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-x-3 text-[14px] text-gray-500 mt-0.5">
                                                                    <span className="font-semibold text-gray-700">₹{app.amount?.toLocaleString("en-IN")}</span>
                                                                    {app.universityName && <span>• {app.universityName}</span>}
                                                                    {app.country && <span>• {app.country}</span>}

                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {/* Mini Progress */}
                                                    <div className="flex items-center gap-3 mt-2">
                                                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                                                            <div
                                                                className={`h-1.5 rounded-full transition-all duration-700 ${isSanctionedOrDisbursed
                                                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                                                        : 'bg-gradient-to-r from-[#6605c7] to-purple-400'
                                                                    }`}
                                                                style={{ width: `${getDynamicProgress(app, data.documents, data.profile)}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-[10px] font-bold whitespace-nowrap ${isSanctionedOrDisbursed ? 'text-emerald-600' : 'text-[#6605c7]'
                                                            }`}>{getDynamicProgress(app, data.documents, data.profile)}%</span>
                                                    </div>

                                                    {/* Overview Staff Details */}
                                                    {app.status !== 'draft' && (() => {
                                                        const staff = getStaffDetails(app);
                                                        return (
                                                            <div className="mt-4 pt-3 border-t border-slate-100/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-purple-50/40 via-indigo-50/20 to-transparent p-3 rounded-xl border border-purple-100/50">
                                                                <div>
                                                                    <span className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] block">
                                                                        Assigned Officer
                                                                    </span>
                                                                    <p className="text-xs font-extrabold text-slate-900 mt-0.5">{staff.name}</p>
                                                                </div>

                                                                <div className="flex items-center gap-3 text-xs shrink-0">
                                                                    {staff.email && (
                                                                        <a
                                                                            href={`mailto:${staff.email}`}
                                                                            className="px-2.5 py-1 bg-white hover:bg-purple-50 text-indigo-700 font-bold rounded-lg border border-purple-100 transition-all text-[11px] flex items-center gap-1.5 shadow-2xs"
                                                                            title="Send email to assigned officer"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[13px]">mail</span>
                                                                            <span className="max-w-[140px] truncate">{staff.email}</span>
                                                                        </a>
                                                                    )}
                                                                    {staff.phone && staff.phone.trim().length > 0 && (
                                                                        <a
                                                                            href={`tel:${staff.phone.replace(/[^0-9+]/g, '')}`}
                                                                            className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-100 transition-all text-[11px] flex items-center gap-1.5 shadow-2xs"
                                                                            title="Call assigned officer"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[13px]">call</span>
                                                                            <span>{staff.phone}</span>
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Action Footer for detailed progress toggle */}
                                                    <div className="flex items-center justify-between gap-4 mt-4 pt-3 border-t border-gray-50 select-none">
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => toggleAppProgress(app.id)}
                                                                className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase text-[#6605c7] hover:text-[#5504a8] transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">
                                                                    {expandedApps[app.id] ? 'expand_less' : 'expand_more'}
                                                                </span>
                                                                {expandedApps[app.id] ? 'Hide Progress' : 'View Progress'}
                                                            </button>

                                                            <button
                                                                onClick={() => setSelectedAppDetails(app)}
                                                                className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase text-gray-500 hover:text-gray-800 transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">
                                                                    visibility
                                                                </span>
                                                                Details
                                                            </button>
                                                        </div>

                                                        {app.id && (
                                                            <span className="text-[9px] font-black uppercase text-gray-300 tracking-wider">
                                                                Track Progress
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Expanded Stepper timeline */}
                                                    {expandedApps[app.id] && (
                                                        <ApplicationProgressCollapse app={app} />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>


                        </div>

                        {/* Recent Activity */}
                        <div className="lg:col-span-1">
                            <UserActivityLog userId={user?.id} limit={10} refreshInterval={30000} variant="sidebar" />
                        </div>
                    </div>
                )}

                {/* Applications Tab */}
                {activeTab === "applications" && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">My Applications</h2>
                            {!hasApplied && (
                                <Link href="/apply-loan" className="px-4 py-2 bg-[#6605c7] text-white text-xs font-bold rounded-lg hover:bg-[#5504a8] transition-all">
                                    + New Application
                                </Link>
                            )}
                        </div>
                        {loading ? (
                            <div className="space-y-4">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : (!data.applications?.length && !hasApplied) ? (
                            <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
                                <span className="material-symbols-outlined text-5xl text-gray-200 mb-4 block">description</span>
                                <p className="text-gray-500 text-sm font-bold">No applications yet</p>
                                <p className="text-gray-400 text-xs mt-2 mb-6">Start your education loan journey today</p>
                                <Link href="/apply-loan" className="px-6 py-2.5 bg-[#6605c7] text-white text-xs font-bold rounded-lg">
                                    Apply Now
                                </Link>
                            </div>
                        ) : (!data.applications?.length && hasApplied) ? (
                            <div className="space-y-4">
                                {[...Array(2)].map((_, i) => (
                                    <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {(data.applications || []).map((app) => {
                                    const statusConfig: Record<string, { bg: string; text: string; icon: string }> = {
                                        pending: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", icon: "schedule" },
                                        submitted: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", icon: "assignment" },
                                        processing: { bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700", icon: "sync" },
                                        approved: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", icon: "check_circle" },
                                        rejected: { bg: "bg-red-50 border-red-200", text: "text-red-600", icon: "cancel" },
                                        disbursed: { bg: "bg-purple-50 border-purple-200", text: "text-purple-700", icon: "paid" },
                                    };
                                    const sc = statusConfig[app.status] || statusConfig.pending;
                                    const submittedDate = app.submittedAt || app.date || app.createdAt;
                                    return (
                                        <div key={app.id} className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-[#6605c7]/20 hover:shadow-lg transition-all group">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                <div className="flex items-start gap-4 flex-1 min-w-0">
                                                    <div className="w-12 h-12 bg-gradient-to-br from-[#6605c7]/10 to-purple-100 rounded-xl flex items-center justify-center text-[#6605c7] shrink-0">
                                                        <span className="material-symbols-outlined text-2xl">account_balance</span>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h3 className="font-bold text-[15px] text-gray-900 truncate">
                                                                {getBankDisplayName(app.bank) || "Loan Application"}
                                                            </h3>
                                                            {app.applicationNumber && (
                                                                <span className="text-[12px] text-gray-400 font-mono font-semibold bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                                                                    {app.applicationNumber}
                                                                </span>
                                                            )}
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${sc.bg} ${sc.text}`}>
                                                                {app.status}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-gray-500 mt-1">
                                                            <span className="font-bold text-gray-900">₹{app.amount?.toLocaleString("en-IN")}</span>
                                                            {app.loanType && <span>• {app.loanType}</span>}
                                                            {app.universityName && (
                                                                <span className="flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[14px]">school</span>
                                                                    {app.universityName}
                                                                </span>
                                                            )}
                                                            {app.country && (
                                                                <span className="flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[14px]">public</span>
                                                                    {app.country}
                                                                </span>
                                                            )}

                                                        </div>
                                                        {/* Progress Bar */}
                                                        {app.progress !== undefined && (
                                                            <div className="mt-3">
                                                                <div className="flex items-center justify-between mb-1">
                                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                                                        {app.stage?.replace(/_/g, ' ') || 'application submitted'}
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-[#6605c7]">{getDynamicProgress(app, data.documents, data.profile)}%</span>
                                                                </div>
                                                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                                    <div
                                                                        className="bg-gradient-to-r from-[#6605c7] to-purple-400 h-1.5 rounded-full transition-all duration-500"
                                                                        style={{ width: `${getDynamicProgress(app, data.documents, data.profile)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Staff Details Column */}
                                                {app.status !== 'draft' && (() => {
                                                    const staff = getStaffDetails(app);
                                                    return (
                                                        <div className="flex flex-col justify-center gap-1.5 min-w-[230px] border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 pl-0 md:pl-6 bg-slate-50/40 p-3 rounded-xl">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-[#6605c7] block">Assigned Support Staff</span>
                                                                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Active Staff Assigned" />
                                                            </div>
                                                            <div className="flex items-center gap-2.5 mt-0.5">
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6605c7] to-indigo-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0 shadow-2xs">
                                                                    {staff.initials || "SO"}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-xs font-extrabold text-slate-900 truncate" title={staff.name}>{staff.name}</p>
                                                                    <p className="text-[9px] text-[#6605c7] font-semibold uppercase truncate">{staff.role}</p>
                                                                </div>
                                                            </div>
                                                            <div className="space-y-1 mt-1">
                                                                {staff.email && (
                                                                    <a href={`mailto:${staff.email}`} className="text-[10px] text-slate-600 hover:text-indigo-600 flex items-center gap-1.5 transition-colors font-medium truncate" title={staff.email}>
                                                                        <span className="material-symbols-outlined text-[12px] text-indigo-500">mail</span>
                                                                        <span className="truncate">{staff.email}</span>
                                                                    </a>
                                                                )}
                                                                {staff.phone && (
                                                                    <a href={`tel:${staff.phone.replace(/[^0-9+]/g, '')}`} className="text-[10px] text-slate-600 hover:text-emerald-600 flex items-center gap-1.5 transition-colors font-semibold">
                                                                        <span className="material-symbols-outlined text-[12px] text-emerald-500">call</span>
                                                                        <span>{staff.phone}</span>
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                <div className="flex flex-col items-start md:items-end gap-1 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 pl-0 md:pl-6 min-w-[120px]">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Submitted On</span>
                                                    {submittedDate ? (
                                                        <span className="text-xs font-bold text-slate-700">
                                                            {new Date(submittedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-bold text-slate-400">—</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Footer for detailed progress toggle */}
                                            <div className="mt-4 pt-3 border-t border-gray-50 flex flex-wrap items-center justify-between gap-4 select-none">
                                                <button
                                                    onClick={() => toggleAppProgress(app.id)}
                                                    className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase text-[#6605c7] hover:text-[#5504a8] transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">
                                                        {expandedApps[app.id] ? 'expand_less' : 'expand_more'}
                                                    </span>
                                                    {expandedApps[app.id] ? 'Hide Progress Details' : 'View Progress Details'}
                                                </button>


                                            </div>

                                            {/* Expanded Stepper timeline */}
                                            {expandedApps[app.id] && (
                                                <ApplicationProgressCollapse app={app} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Activity Tab */}
                {/* {activeTab === "activity" && (
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-6">Activity Log</h2>
                        <div className="bg-white rounded-xl border border-gray-100 p-8">
                            <UserActivityLog
                                userId={user?.id}
                                limit={50}
                                refreshInterval={30000}
                                variant="page"
                            />
                        </div>
                    </div>
                )} */}



                {/* Profile Tab */}
                {activeTab === "profile" && (
                    <UserProfileView
                        user={user}
                        data={data}
                        firstApp={firstApp}
                        refreshUser={refreshUser}
                        loadData={loadData}
                    />
                )}




                {/* Documents Tab */}
                {activeTab === "documents" && (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">My Documents</h2>
                            <Link href="/document-vault" className="px-4 py-2 bg-white text-gray-700 border border-gray-200 text-xs font-bold rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-all">
                                <span className="material-symbols-outlined text-[16px]">cloud_upload</span> Open Vault
                            </Link>
                        </div>
                        {!data.documents?.length ? (
                            <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
                                <span className="material-symbols-outlined text-5xl text-gray-200 mb-4 block">folder_open</span>
                                <p className="text-gray-500 text-sm font-bold">No documents uploaded yet</p>
                                <p className="text-gray-400 text-xs mt-2 mb-6">Upload required documents for faster loan processing</p>
                                <Link href="/document-vault" className="px-6 py-2.5 bg-[#6605c7] text-white text-xs font-bold rounded-lg">
                                    Go to Document Vault
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {data.documents.map((doc: any, i) => {
                                    const status = doc.status;
                                    const isVerified = status === 'verified';
                                    const isRejected = status === 'rejected';
                                    const isPending = status === 'uploaded' || status === 'pending';

                                    let statusLabel = "Uploaded";
                                    let statusColor = "text-gray-400";
                                    let bgClass = "bg-gray-50 text-gray-600";
                                    let iconName = "description";
                                    let checkIcon = "check";
                                    let checkColor = "bg-emerald-500 text-white";

                                    if (isVerified) {
                                        statusLabel = "Verified";
                                        statusColor = "text-emerald-600";
                                        bgClass = "bg-emerald-50 text-emerald-600";
                                        iconName = "check_circle";
                                        checkIcon = "check";
                                        checkColor = "bg-emerald-500 text-white";
                                    } else if (isRejected) {
                                        statusLabel = "Rejected";
                                        statusColor = "text-rose-600";
                                        bgClass = "bg-rose-50 text-rose-600";
                                        iconName = "cancel";
                                        checkIcon = "close";
                                        checkColor = "bg-rose-500 text-white";
                                    } else if (isPending) {
                                        statusLabel = "Pending Review";
                                        statusColor = "text-amber-600";
                                        bgClass = "bg-amber-50 text-[#d97706]";
                                        iconName = "pending";
                                        checkIcon = "hourglass_empty";
                                        checkColor = "bg-amber-500 text-white";
                                    }

                                    return (
                                        <div key={i} className={`bg-white rounded-xl p-5 border flex flex-col justify-between hover:border-[#6605c7]/20 transition-all ${isRejected ? 'border-rose-100 bg-rose-50/5' : isPending ? 'border-amber-100 bg-amber-50/5' : isVerified ? 'border-emerald-100 bg-emerald-50/5' : 'border-gray-100'
                                            }`}>
                                            <div className="flex items-center justify-between w-full">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-9 h-9 ${bgClass} rounded-lg flex items-center justify-center shrink-0`}>
                                                        <span className="material-symbols-outlined text-xl">{iconName}</span>
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-[13px] text-gray-900 capitalize">
                                                            {(() => {
                                                                const typeKey = doc.docType || doc.name || doc.type || '';
                                                                const rawFallback = doc.docName || (typeKey ? typeKey.replace(/_/g, ' ') : 'Document');
                                                                return typeKey ? getDocumentRequirementName(typeKey, rawFallback, data.profile || user) : rawFallback;
                                                            })()}
                                                        </div>
                                                        <div className={`text-[10px] uppercase font-black tracking-widest mt-0.5 ${statusColor}`}>{statusLabel}</div>
                                                    </div>
                                                </div>
                                                <div className={`w-6 h-6 rounded-full ${checkColor} flex items-center justify-center shrink-0`}>
                                                    <span className="material-symbols-outlined text-[14px] font-bold">{checkIcon}</span>
                                                </div>
                                            </div>

                                            {isRejected && (
                                                <div className="mt-4 p-3 bg-rose-50 rounded-lg border border-rose-100 flex gap-2">
                                                    <span className="material-symbols-outlined text-rose-500 text-[14px] shrink-0 mt-0.5">info</span>
                                                    <div>
                                                        <p className="text-[9px] font-black uppercase tracking-wider text-rose-600 mb-0.5">Rejection Reason</p>
                                                        <p className="text-[10px] text-rose-700 leading-normal font-medium">{doc.verificationMetadata?.rejectionReason || doc.rejectionReason || "Please upload a clearer document."}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Application Details Modal */}
            {selectedAppDetails && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedAppDetails(null)} />
                    <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900 tracking-tight">Application Details</h2>
                                <p className="text-[13px] text-gray-500 font-medium">#{(selectedAppDetails.applicationNumber && (selectedAppDetails.applicationNumber.startsWith('VTU-APP-') || selectedAppDetails.applicationNumber.startsWith('VTU-BNK-'))) ? selectedAppDetails.applicationNumber : 'Pending'}</p>
                            </div>
                            <button
                                onClick={() => setSelectedAppDetails(null)}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-white border border-transparent hover:border-gray-200 transition-all shadow-sm"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {/* Loan Info */}
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2">Loan Request</h3>

                                    <div>
                                        <div className="text-[11px] font-bold text-gray-400 uppercase">Amount Required</div>
                                        <div className="text-sm font-semibold text-gray-800">₹{selectedAppDetails.amount?.toLocaleString("en-IN") || 'Not specified'}</div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] font-bold text-gray-400 uppercase">Field of Study</div>
                                        <div className="text-sm font-semibold text-gray-800">{selectedAppDetails.loanType || 'Not specified'}</div>
                                    </div>

                                </div>

                                {/* Education Info */}
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2">Education Details</h3>

                                    <div>
                                        <div className="text-[11px] font-bold text-gray-400 uppercase">University & Country</div>
                                        <div className="text-sm font-semibold text-gray-800">{selectedAppDetails.universityName || 'Not specified'}, {selectedAppDetails.country || 'Not specified'}</div>
                                    </div>
                                </div>

                                {/* Financial & Co-Applicant */}
                                <div className="space-y-4 sm:col-span-2 mt-2">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-100 pb-2">Financial & Contact</h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-[11px] font-bold text-gray-400 uppercase">Co-Applicant</div>
                                            <div className="text-sm font-semibold text-gray-800">
                                                {(() => {
                                                    let localData: any = null;
                                                    if (typeof window !== 'undefined') {
                                                        try {
                                                            const raw = localStorage.getItem('recent_application_submitted') || localStorage.getItem('apply_loan_form_data');
                                                            if (raw) localData = JSON.parse(raw);
                                                        } catch { }
                                                    }
                                                    const rawName = selectedAppDetails.coApplicantName || selectedAppDetails.fatherName || selectedAppDetails.motherName || selectedAppDetails.user?.coApplicantName || selectedAppDetails.user?.coApplicant?.name || data.family?.coApplicantName || data.family?.fatherName || data.family?.motherName || data.profile?.coApplicant?.name || localData?.coApplicantName || user?.coApplicantName || "";
                                                    const rawRel = selectedAppDetails.coApplicantRelation || selectedAppDetails.coApplicant || localData?.coApplicantRelation || localData?.coApplicant || user?.coApplicantRelation || "";
                                                    const relationLabel = rawRel && rawRel.toLowerCase() !== 'coapplicant' ? (rawRel.charAt(0).toUpperCase() + rawRel.slice(1)) : '';

                                                    const isValidName = rawName && !['coapplicant', 'father', 'mother', 'spouse', 'brother', 'sister'].includes(rawName.toLowerCase());

                                                    if (isValidName) {
                                                        return relationLabel ? `${rawName} (${relationLabel})` : rawName;
                                                    }
                                                    if (relationLabel) return relationLabel;
                                                    if (rawName) return rawName;
                                                    if (selectedAppDetails.hasCoApplicant) return 'Yes';
                                                    return 'Not specified';
                                                })()}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold text-gray-400 uppercase">Co-Applicant Income</div>
                                            <div className="text-sm font-semibold text-gray-800">
                                                {(() => {
                                                    let localData: any = null;
                                                    if (typeof window !== 'undefined') {
                                                        try {
                                                            const raw = localStorage.getItem('recent_application_submitted') || localStorage.getItem('apply_loan_form_data');
                                                            if (raw) localData = JSON.parse(raw);
                                                        } catch { }
                                                    }
                                                    const income = selectedAppDetails.coApplicantIncome || localData?.coApplicantIncome || localData?.income || data.family?.coApplicantIncome || data.profile?.coApplicant?.monthlyIncome || user?.coApplicantIncome;
                                                    return income ? `₹${Number(income).toLocaleString("en-IN")}` : 'Not specified';
                                                })()}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold text-gray-400 uppercase">Co-Applicant Phone</div>
                                            <div className="text-sm font-semibold text-gray-800">
                                                {(() => {
                                                    let localData: any = null;
                                                    if (typeof window !== 'undefined') {
                                                        try {
                                                            const raw = localStorage.getItem('recent_application_submitted') || localStorage.getItem('apply_loan_form_data');
                                                            if (raw) localData = JSON.parse(raw);
                                                        } catch { }
                                                    }
                                                    return (
                                                        selectedAppDetails.coApplicantPhone ||
                                                        selectedAppDetails.coApplicantMobile ||
                                                        selectedAppDetails.coApplicant_phone ||
                                                        selectedAppDetails.fatherPhone ||
                                                        selectedAppDetails.motherPhone ||
                                                        selectedAppDetails.user?.coApplicantPhone ||
                                                        selectedAppDetails.user?.coApplicant?.mobile ||
                                                        selectedAppDetails.user?.coApplicant?.phone ||
                                                        localData?.coApplicantPhone ||
                                                        localData?.coApplicantMobile ||
                                                        data.family?.coApplicantPhone ||
                                                        data.family?.coApplicantMobile ||
                                                        data.family?.fatherPhone ||
                                                        data.family?.motherPhone ||
                                                        data.profile?.coApplicant?.mobile ||
                                                        data.profile?.coApplicant?.phone ||
                                                        data.profile?.coApplicantPhone ||
                                                        user?.coApplicantPhone ||
                                                        user?.coApplicant?.mobile ||
                                                        user?.coApplicant?.phone ||
                                                        'Not specified'
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold text-gray-400 uppercase">Co-Applicant Email</div>
                                            <div className="text-sm font-semibold text-gray-800">
                                                {(() => {
                                                    let localData: any = null;
                                                    if (typeof window !== 'undefined') {
                                                        try {
                                                            const raw = localStorage.getItem('recent_application_submitted') || localStorage.getItem('apply_loan_form_data');
                                                            if (raw) localData = JSON.parse(raw);
                                                        } catch { }
                                                    }
                                                    return (
                                                        selectedAppDetails.coApplicantEmail ||
                                                        selectedAppDetails.coApplicant_email ||
                                                        selectedAppDetails.fatherEmail ||
                                                        selectedAppDetails.motherEmail ||
                                                        selectedAppDetails.user?.coApplicantEmail ||
                                                        selectedAppDetails.user?.coApplicant?.email ||
                                                        localData?.coApplicantEmail ||
                                                        data.family?.coApplicantEmail ||
                                                        data.profile?.coApplicant?.email ||
                                                        data.profile?.coApplicantEmail ||
                                                        user?.coApplicantEmail ||
                                                        user?.coApplicant?.email ||
                                                        'Not specified'
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold text-gray-400 uppercase">Applicant Name</div>
                                            <div className="text-sm font-semibold text-gray-800">
                                                {selectedAppDetails.firstName || selectedAppDetails.user?.firstName || user?.firstName || ''} {selectedAppDetails.lastName || selectedAppDetails.user?.lastName || user?.lastName || ''}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-bold text-gray-400 uppercase">Contact</div>
                                            <div className="text-sm font-semibold text-gray-800">
                                                {(() => {
                                                    const email = selectedAppDetails.email || selectedAppDetails.user?.email || user?.email || "";
                                                    const phone = selectedAppDetails.phone || selectedAppDetails.phoneNumber || selectedAppDetails.mobile || selectedAppDetails.user?.phoneNumber || selectedAppDetails.user?.phone || selectedAppDetails.user?.mobile || user?.phoneNumber || user?.mobile || "";
                                                    if (email && phone) return `${email} • ${phone}`;
                                                    if (email) return email;
                                                    if (phone) return phone;
                                                    return 'Not specified';
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Assigned Support Staff Card in Details Modal */}
                                {(() => {
                                    const staff = getStaffDetails(selectedAppDetails);
                                    return (
                                        <div className="sm:col-span-2 mt-2 bg-gradient-to-r from-purple-50/70 via-indigo-50/50 to-purple-50/30 p-4 rounded-xl border border-purple-100 shadow-2xs">
                                            <div className="flex items-center justify-between mb-3 border-b border-purple-100/80 pb-2">
                                                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#6605c7]">
                                                    Assigned Officer
                                                </h3>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div>
                                                    <div className="text-[10px] font-extrabold text-slate-400 uppercase">Officer Name</div>
                                                    <div className="font-extrabold text-slate-900 text-xs mt-0.5">{staff.name}</div>
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-extrabold text-slate-400 uppercase">Official Email</div>
                                                    {staff.email ? (
                                                        <a href={`mailto:${staff.email}`} className="font-bold text-indigo-600 hover:underline text-xs flex items-center gap-1 mt-1 truncate">
                                                            <span className="material-symbols-outlined text-[13px]">mail</span>
                                                            <span className="truncate">{staff.email}</span>
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs font-semibold text-slate-500 mt-1 block">—</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-[10px] font-extrabold text-slate-400 uppercase">Direct Phone</div>
                                                    {staff.phone ? (
                                                        <a href={`tel:${staff.phone.replace(/[^0-9+]/g, '')}`} className="font-bold text-emerald-700 hover:text-emerald-800 text-xs flex items-center gap-1 mt-1">
                                                            <span className="material-symbols-outlined text-[13px]">call</span>
                                                            <span>{staff.phone}</span>
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs font-semibold text-slate-500 mt-1 block">—</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Notes */}
                                {selectedAppDetails.notes && (
                                    <div className="space-y-2 sm:col-span-2 mt-2 bg-amber-50/50 p-4 rounded-xl border border-amber-100/50">
                                        <h3 className="text-[10px] font-black uppercase tracking-widest text-amber-600/70">Additional Notes</h3>
                                        <div className="text-sm text-amber-900/80 leading-relaxed whitespace-pre-wrap">
                                            {selectedAppDetails.notes}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <SupportTicketModal
                isOpen={isSupportOpen}
                onClose={() => setIsSupportOpen(false)}
                userRole={user?.role || "student"}
                userInfo={{ id: user?.id, name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(), email: user?.email }}
            />
        </div>
    );
}
