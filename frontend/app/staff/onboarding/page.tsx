"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { io } from "socket.io-client";
import { adminApi, authApi, documentApi, onboardingApi, staffProfileApi, referenceApi, applicationApi, apiFetch } from "@/lib/api";
import { HttpApiPaths } from "@/lib/http-api-paths";
import { normalizeOcrFieldsForAutofill, normalizeGenderForForm, normalizeCountryName, parseOcrDateForInput } from "@/lib/ocr-fields";
import { examYearToEndDate, inferStartDate, normalizeStateName } from "@/lib/academic-ocr";
import { format } from "date-fns";
import ChatInterface from "@/components/Chat/ChatInterface";
import ApplicationDetailView from "@/components/staff/ApplicationDetailView";
import { getAllCountries, getStatesByCountry } from "@/lib/countriesData";
import { formatPhone, formatAadhar, formatPan, isPhoneValid, isAadharValid, isPanValid } from "@/lib/validation";
import {
    getPersonDocumentRequirements,
    getProfileDocumentRequirements,
    getStudentDocumentRequirements,
    type DocumentRequirement,
} from "@/lib/documentRequirements";
import ActivityLogWidget from "@/components/staff/ActivityLogWidget";
import ShareProfileToBankModal from "@/components/staff/ShareProfileToBankModal";
import NotificationsPanel from "@/components/staff/NotificationsPanel";
import SendEmailModal from "@/components/staff/SendEmailModal";

// --- Components ---

const DASHBOARD_SECTIONS = [
    "overview",
    "incoming_queue",
    "applications",
    "tasks",
    "performance",
    "users",
    "blogs",
    "community",
    "communications",
    "chat_customer",
    "my_profile",
    "onboarding",
    "calendar",
] as const;

const getDashboardSection = (section: string | null) =>
    DASHBOARD_SECTIONS.includes(section as any) ? section as typeof DASHBOARD_SECTIONS[number] : "overview";

const getDashboardPage = (page: string | null) => {
    const parsed = Number(page);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};

type BankReference = Partial<Record<"name" | "bankName" | "displayName" | "title" | "label" | "id", string>>;
type ApplicationRowForBankSend = {
    id?: string;
    _id?: string;
    bank?: string;
    targetBank?: string;
};

type ApplicationProgressFields = {
    progress?: number;
    status?: string;
    stage?: string;
    bankWorkflowStatus?: string;
    currentStage?: string;
};

const getApplicationDisplayProgress = (app: ApplicationProgressFields): number => {
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
        status === "documents_verified" ||
        status === "docs_verified" ||
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

const getApplicationStageLabel = (app: ApplicationProgressFields, progress: number): string => {
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

const StatCard = ({ label, value, icon, color, trend, loading, hint, badge, ...props }: any) => {
    // Generate styling based on the color string to keep the UI clean
    let colorScheme = {
        iconBg: 'bg-slate-50',
        iconText: 'text-slate-600',
        valueText: 'text-slate-900',
        trendBg: 'bg-slate-50',
        trendText: 'text-slate-500'
    };

    if (color?.includes('blue')) {
        colorScheme = { iconBg: 'bg-blue-50', iconText: 'text-blue-500', valueText: 'text-slate-900', trendBg: 'bg-slate-50', trendText: 'text-slate-500' };
    } else if (color?.includes('amber')) {
        colorScheme = { iconBg: 'bg-amber-50', iconText: 'text-amber-500', valueText: 'text-slate-900', trendBg: 'bg-amber-50/50', trendText: 'text-amber-700' };
    } else if (color?.includes('green') || color?.includes('emerald')) {
        colorScheme = { iconBg: 'bg-emerald-50', iconText: 'text-emerald-500', valueText: 'text-slate-900', trendBg: 'bg-emerald-50/50', trendText: 'text-emerald-700' };
    } else if (color?.includes('purple') || color?.includes('indigo')) {
        colorScheme = { iconBg: 'bg-purple-50', iconText: 'text-purple-500', valueText: 'text-slate-900', trendBg: 'bg-slate-50', trendText: 'text-slate-500' };
    }

    return (
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:shadow-md transition-all relative overflow-hidden group hover:border-indigo-200 flex flex-col justify-between min-h-[140px]">
            {/* Visual Indicator (e.g. amber urgency tint or subtle background) */}
            {color?.includes('amber') && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full blur-3xl opacity-50 pointer-events-none" />
            )}

            {/* Top row: Metric Title + Icon */}
            <div className="flex justify-between items-start mb-2 relative z-10">
                <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">{label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorScheme.iconBg} ${colorScheme.iconText}`}>
                    <span className="material-symbols-outlined text-[16px]">{icon}</span>
                </div>
            </div>

            {/* Middle row: Large primary number */}
            <div className="mt-1 mb-3 relative z-10 flex items-center gap-3">
                <div className={`staff-dashboard-number text-[42px] font-bold tracking-normal leading-none ${colorScheme.valueText}`}>
                    {loading ? <span className="h-10 bg-slate-100 animate-pulse rounded block w-20" /> : value ?? "—"}
                </div>
                {badge && !loading && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 border border-amber-100/50">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-amber-700">{badge}</span>
                    </div>
                )}
            </div>

            {/* Bottom Row: Micro-trend / Context text */}
            <div className="mt-auto relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    {trend !== undefined && !loading && (
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${colorScheme.trendBg} ${colorScheme.trendText}`}>
                            {typeof trend === 'string' && (trend.includes('⏳') || trend.includes('📈')) ? null : (
                                <span className="material-symbols-outlined text-[12px]">
                                    {Number(trend) >= 0 ? 'trending_up' : 'trending_down'}
                                </span>
                            )}
                            {trend}
                        </div>
                    )}
                    {hint && !loading && (
                        <span className="text-[10px] font-medium text-slate-400 border-l border-slate-200 pl-2 ml-1">
                            {hint}
                        </span>
                    )}
                </div>
                {props.footerAction && !loading && (
                    <button onClick={props.onFooterActionClick} className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 transition-colors flex items-center gap-1">
                        {props.footerAction}
                    </button>
                )}
            </div>
        </div>
    );
};

const NavItem = ({ section, active, icon, label, badge, expanded, onClick }: any) => {
    const isActive = active === section;
    return (
        <button
            onClick={() => onClick(section)}
            title={label}
            className={`relative w-full flex items-center gap-3 px-3 transition-all duration-150 group/item ${isActive
                ? 'text-white'
                : 'text-slate-500 hover:text-slate-200'
                }`}
            style={{ height: 44 }}
        >
            {isActive && (
                <span className="absolute inset-x-1 inset-y-1 rounded-lg bg-indigo-600" />
            )}
            {/* Icon — always visible */}
            <div className="w-6 h-6 flex items-center justify-center relative z-10 flex-shrink-0">
                <span className={`material-symbols-outlined text-[18px] transition-colors ${isActive ? 'text-white' : 'text-slate-400 group-hover/item:text-slate-200'
                    }`}>{icon}</span>
            </div>
            {/* Label */}
            <span className={`relative z-10 text-[15px] font-['Playfair_Display',serif] tracking-wider whitespace-nowrap overflow-hidden transition-all duration-300
                ${expanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}
                ${isActive ? 'text-white font-medium' : 'text-slate-300'}`}>
                {label}
            </span>
            {badge > 0 && (
                <span className={`relative z-10 ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full
                    bg-rose-500 text-white shrink-0 transition-opacity duration-300
                    ${expanded ? 'inline-flex' : 'hidden group-hover/sidebar:inline-flex'}`}>
                    {badge > 9 ? '9+' : badge}
                </span>
            )}
        </button>
    );
};

const TableHeader = ({ children }: { children: React.ReactNode }) => (
    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-widest font-['Playfair_Display',serif] font-bold text-left">
        <tr>{children}</tr>
    </thead>
);

function safeParseJson(val: any, fallback: any) {
    if (!val) return fallback;
    if (typeof val === 'object') return val;
    if (typeof val === 'string') {
        try {
            return JSON.parse(val);
        } catch (e) {
            console.error("Failed to parse JSON string:", val, e);
            return fallback;
        }
    }
    return fallback;
}

/** Fresh applicant profile — KYC/personal fields empty until student enters or uploads documents. */
function createEmptyNewStudent() {
    return {
        email: "", firstName: "", lastName: "", middleName: "", mobile: "", role: "student",
        dob: "", gender: "", maritalStatus: "", pan: "", aadhaarNumber: "",
        mailingAddress: { address1: "", address2: "", city: "", state: "", country: "", pincode: "" },
        permanentAddress: { address1: "", address2: "", city: "", state: "", country: "", pincode: "" },
        passport: { number: "", issueDate: "", expiryDate: "", issueCountry: "", birthCity: "", birthCountry: "" },
        nationality: { name: "", citizenship: "", dualCitizenship: "No", livingOtherCountry: "No", livingOtherCountryName: "" },
        background: { immigrationApplied: "No", immigrationAppliedCountry: "", medicalCondition: "No", medicalConditionDetails: "", visaRefusal: "No", visaRefusalDetails: "", criminalOffence: "No", criminalOffenceDetails: "" },
        emergencyContact: { name: "", phone: "", email: "", relation: "" },
        academic: {
            countryOfEducation: "",
            highestLevel: "",
            postgrad: { country: "", state: "", university: "", qualification: "", city: "", grading: "", percentage: "", language: "", startDate: "", endDate: "" },
            undergrad: { country: "", state: "", university: "", qualification: "", city: "", grading: "", score: "", backlogs: "", language: "", startDate: "", endDate: "" },
            grade12: { country: "", state: "", board: "", institution: "", city: "", grading: "", score: "", language: "", startDate: "", endDate: "" },
            grade10: { country: "", state: "", board: "", institution: "", city: "", grading: "", score: "", language: "", startDate: "", endDate: "" }
        },
        workExperience: [{ employer: "", role: "", country: "", startDate: "", endDate: "", current: false }],
        tests: { ielts: "", toefl: "", pte: "", duolingo: "", gre: "", gmat: "", sat: "", act: "" },
        family: {
            fatherName: "", fatherMobile: "", fatherEmail: "", fatherOccupation: "", fatherAadhar: "", fatherPan: "",
            fatherEmploymentType: "", fatherMonthlyIncome: "",
            motherName: "", motherMobile: "", motherEmail: "", motherOccupation: "", motherAadhar: "", motherPan: "",
            motherEmploymentType: "", motherMonthlyIncome: "",
        },
        coApplicant: {
            name: "", mobile: "", email: "", relation: "", occupation: "", aadhar: "", pan: "",
            employmentType: "", monthlyIncome: "",
            isSameAsFather: false, isSameAsMother: false
        },
        loanAmount: "",
        targetUniversity: "",
        studyDestination: "",
        courseName: "",
        budget: "",
        pincode: "",
        admitStatus: "",
        intakeSeason: "",
        goal: ""
    };
}

export default function OnboardingPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user, logout, token } = useAuth();
    const activeSection: string = "onboarding";
    const [loading, setLoading] = useState(true);
    const nowTime = new Date();
    const [stats, setStats] = useState<any>({});
    const [todayStats, setTodayStats] = useState<any>(null);
    const [dashboardSummary, setDashboardSummary] = useState<any>(null);
    const [rejectionAnalytics, setRejectionAnalytics] = useState<any>(null);
    const [slaTracker, setSlaTracker] = useState<any>(null);
    const [loadingPerformance, setLoadingPerformance] = useState<boolean>(false);
    const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
    const [loadingCalendar, setLoadingCalendar] = useState<boolean>(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [filterTab, setFilterTab] = useState<'filters' | 'columns'>('filters');
    const [filterCountry, setFilterCountry] = useState<string>("");
    const [filterPaymentPaid, setFilterPaymentPaid] = useState<boolean | null>(null);
    const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
    const [visibleColumns, setVisibleColumns] = useState<string[]>([
        'applicant_profile', 'college_name', 'target_bank', 'lan_number', 'progress', 'current_status', 'actions'
    ]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [autoStartUser, setAutoStartUser] = useState<any>(null);
    const [showShareProfileModal, setShowShareProfileModal] = useState(false);
    const [shareProfileData, setShareProfileData] = useState<any>(null);

    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailModalRecipient, setEmailModalRecipient] = useState("");
    const [emailModalRecipientName, setEmailModalRecipientName] = useState("");

    // Premium Document Upload Popup States
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [selectedDocType, setSelectedDocType] = useState<string>("passport");
    const [selectedDocCategory, setSelectedDocCategory] = useState<'applicant' | 'father' | 'mother' | 'coapplicant'>('applicant');
    const [selectedDocName, setSelectedDocName] = useState<string>("Passport");

    const getModalDocumentsList = () => {
        const allDocs = getProfileDocumentRequirements(newStudent);

        let activeGroup: 'student_identity' | 'student_academic' | 'father' | 'mother' | 'coapplicant' = 'student_identity';

        if (selectedDocType.startsWith('father_')) {
            activeGroup = 'father';
        } else if (selectedDocType.startsWith('mother_')) {
            activeGroup = 'mother';
        } else if (selectedDocType.startsWith('coapplicant_')) {
            activeGroup = 'coapplicant';
        } else if (['marksheet_10', 'marksheet_12', 'ug_transcript', 'ug_degree', 'pg_transcript', 'pg_degree', 'english_test', 'aptitude_test', 'resume', 'work_letters'].includes(selectedDocType)) {
            activeGroup = 'student_academic';
        }

        if (activeGroup === 'student_identity') {
            return {
                title: "Student KYC & Identity",
                icon: "fingerprint",
                items: allDocs.filter(d => ['passport', 'national_id', 'pan'].includes(d.type))
            };
        } else if (activeGroup === 'student_academic') {
            return {
                title: "Student Academic Docs",
                icon: "school",
                items: allDocs.filter(d => ['marksheet_10', 'marksheet_12', 'ug_transcript', 'ug_degree', 'pg_transcript', 'pg_degree', 'english_test', 'aptitude_test', 'resume', 'work_letters'].includes(d.type))
            };
        } else if (activeGroup === 'father') {
            const fatherName = newStudent.family.fatherName || "Father";
            return {
                title: `${fatherName}'s Documents`,
                icon: "hail",
                items: allDocs.filter(d => d.type.startsWith('father_'))
            };
        } else if (activeGroup === 'mother') {
            const motherName = newStudent.family.motherName || "Mother";
            return {
                title: `${motherName}'s Documents`,
                icon: "woman",
                items: allDocs.filter(d => d.type.startsWith('mother_'))
            };
        } else if (activeGroup === 'coapplicant') {
            const coName = newStudent.coApplicant.name || "Co-applicant";
            return {
                title: `${coName}'s Documents`,
                icon: "group",
                items: allDocs.filter(d => d.type.startsWith('coapplicant_'))
            };
        }

        return {
            title: "Documents",
            icon: "folder",
            items: []
        };
    };

    const [countryOfEducation, setCountryOfEducation] = useState<string>("India");
    const [highestEducation, setHighestEducation] = useState<string>("Select Level");
    const [selectedTestType, setSelectedTestType] = useState<string>("Select Test");
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [onlineEmails, setOnlineEmails] = useState<string[]>([]);
    const socketRef = useRef<any>(null);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const activeSectionRef = useRef<string>('overview');

    const loadDataRef = useRef<any>(null);
    const loadOverviewRef = useRef<any>(null);

    // Initialize real-time WebSocket connection and fetch initial unread counts
    useEffect(() => {
        if (!token) return;

        const baseApiUrl = typeof window !== 'undefined' && (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
            ? 'http://localhost:5000'
            : (process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'));
        const socketUrl = baseApiUrl.endsWith('/api')
            ? baseApiUrl.replace('/api', '/chat')
            : `${baseApiUrl.replace(/\/$/, '')}/chat`;

        console.log("[StaffDashboard] Connecting to WebSocket at", socketUrl);
        const socketInstance = io(socketUrl, {
            auth: { token }
        });

        socketRef.current = socketInstance;

        const fetchChatUnreadCount = async () => {
            if (activeSectionRef.current === 'chat_customer') {
                setUnreadChatCount(0);
                return;
            }
            try {
                const data = await apiFetch<any[]>("/api/chat/conversations");
                if (Array.isArray(data)) {
                    const totalUnread = data.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
                    if (activeSectionRef.current !== 'chat_customer') {
                        setUnreadChatCount(totalUnread);
                    }
                }
            } catch (err) {
                console.error("Failed to load staff chat unread count:", err);
            }
        };

        socketInstance.on('connect', () => {
            console.log('[StaffDashboard] Socket connected successfully');
            socketInstance.emit('request_presence');
            fetchChatUnreadCount();
        });

        socketInstance.on('presence_update', (emails: string[]) => {
            console.log('[StaffDashboard] Online presence update received:', emails);
            if (Array.isArray(emails)) {
                setOnlineEmails(emails);
            }
        });

        socketInstance.on('user_activity', (newActivity: any) => {
            console.log('[StaffDashboard] Live activity received:', newActivity);
            setRecentActivity(prev => [
                {
                    ...newActivity,
                    time: "Just now"
                },
                ...prev
            ].slice(0, 15));

            // Refresh data dynamically based on active section
            if (activeSectionRef.current === "overview") {
                if (loadOverviewRef.current) loadOverviewRef.current(true);
            } else if (activeSectionRef.current === "incoming_queue" || activeSectionRef.current === "applications") {
                if (loadDataRef.current) loadDataRef.current();
            }
        });

        // Listen for incoming customer/bank messages even when ChatInterface is not active
        socketInstance.on('conversation_updated', (data: { conversationId: string, lastMessage: any }) => {
            console.log('[StaffDashboard] New incoming message on conversation:', data.conversationId);
            fetchChatUnreadCount();
        });

        socketInstance.on('new_message', (msg: any) => {
            if (activeSectionRef.current !== 'chat_customer') {
                fetchChatUnreadCount();
            }
        });

        // Fetch initial unread count on mount/token change
        fetchChatUnreadCount();

        // 15-second polling fallback to ensure count stays synced
        const interval = setInterval(fetchChatUnreadCount, 15000);

        return () => {
            console.log('[StaffDashboard] Disconnecting WebSocket');
            socketInstance.disconnect();
            clearInterval(interval);
        };
    }, [token]);

    // IST Timezone offset: +5:30 (19800000 milliseconds)
    const IST_OFFSET = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds

    // Convert UTC to IST
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
        // Add IST offset to UTC time
        return new Date(utcDate.getTime() + IST_OFFSET);
    };

    // Formats a date exactly into India Standard Time (+5:30) with timezone label
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

    const formatRelativeTime = (dateStr: string) => {
        if (!dateStr) return "Just now";
        const date = convertToIST(dateStr);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return "Just now";
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    const formatAbsoluteDateTime = (dateStr: string) => {
        if (!dateStr) return "";
        try {
            const date = convertToIST(dateStr);
            return date.toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
                timeZone: "Asia/Kolkata"
            });
        } catch {
            return "";
        }
    };

    const addActivity = (type: string, msg: string, icon: string, color: string) => {
        const istTime = new Date(Date.now() + IST_OFFSET).toISOString();
        setRecentActivity(prev => [
            { id: Date.now(), type, msg, time: "Just now", icon, color, createdAt: istTime },
            ...prev
        ].slice(0, 15));

        staffProfileApi.logActivity({ type, msg, icon, color }).catch(console.error);
    };

    const [fullActivities, setFullActivities] = useState<any[]>([]);
    const [activitiesLoading, setActivitiesLoading] = useState(false);
    const [activitiesTotal, setActivitiesTotal] = useState(0);
    const [activitiesPage, setActivitiesPage] = useState(1);
    const [activitiesFilter, setActivitiesFilter] = useState("all");
    const [activitiesSearch, setActivitiesSearch] = useState("");
    const activitiesLimit = 15;

    const getMockActivities = useCallback(() => {
        return [];
    }, []);

    useEffect(() => {
        const loadActivities = async () => {
            try {
                const res: any = await staffProfileApi.getDashboardActivities(15);
                // Backend returns a plain array directly
                const items: any[] = Array.isArray(res) ? res : (res?.data ?? []);
                const finalItems = items.length > 0 ? items : getMockActivities();
                setRecentActivity(finalItems.map((a: any) => ({
                    ...a,
                    time: formatRelativeTime(a.createdAt || a.time)
                })));
            } catch (err) {
                console.error("Failed to load activities", err);
                const fallback = getMockActivities();
                setRecentActivity(fallback.map((a: any) => ({
                    ...a,
                    time: formatRelativeTime(a.createdAt || a.time)
                })));
            }
        };
        loadActivities();
    }, [user, getMockActivities]);

    const loadFullActivities = async () => {
        setActivitiesLoading(true);
        try {
            const offset = (activitiesPage - 1) * activitiesLimit;
            const res: any = await staffProfileApi.getAllDashboardActivities({
                limit: activitiesLimit,
                offset,
                type: activitiesFilter,
                search: activitiesSearch,
            });
            let items: any[] = Array.isArray(res?.data) ? res.data : [];
            let total = res?.total ?? items.length;

            if (items.length === 0) {
                const filteredSeeds = getMockActivities();
                items = filteredSeeds;
                total = filteredSeeds.length;
            }

            setFullActivities(items.map((a: any) => ({
                ...a,
                time: formatRelativeTime(a.createdAt || a.time)
            })));
            setActivitiesTotal(total);
        } catch (err) {
            console.warn("Failed to load full activities from API, falling back to mock seeds:", err);
            const filteredSeeds = getMockActivities();
            setFullActivities(filteredSeeds.map((a: any) => ({
                ...a,
                time: formatRelativeTime(a.createdAt || a.time)
            })));
            setActivitiesTotal(filteredSeeds.length);
        } finally {
            setActivitiesLoading(false);
        }
    };

    useEffect(() => {
        if ((activeSection as any) === 'activities') {
            loadFullActivities();
        }
    }, [activeSection, activitiesPage, activitiesFilter, activitiesSearch]);

    // Real-time updates
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
    const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);

    const [tasks, setTasks] = useState<{ id: any; title: string; completed: boolean }[]>([
        { id: 1, title: "Loading action items...", completed: false }
    ]);
    const [newTaskTitle, setNewTaskTitle] = useState("");

    const loadDynamicTasks = useCallback(async () => {
        try {
            const res: any = await adminApi.getApplications({ limit: "5", status: "submitted" });
            const apps = res.data || [];
            const dynamicTasks = apps.map((app: any, idx: number) => ({
                id: app._id || app.id || idx,
                title: `Review pending application from ${app.applicant?.firstName || 'Student'} (${app.applicationNumber || 'New'})`,
                completed: false
            }));

            if (dynamicTasks.length === 0) {
                dynamicTasks.push({ id: 999, title: "All caught up! No pending applications.", completed: true });
            }
            setTasks(dynamicTasks);
        } catch (e) {
            console.error("Failed to load tasks", e);
            setTasks([{ id: 1, title: "Failed to load tasks", completed: false }]);
        }
    }, []);

    useEffect(() => {
        loadDynamicTasks();
    }, [loadDynamicTasks]);

    // Email / Communications
    const [emailData, setEmailData] = useState({ to: "", subject: "", content: "", role: "student", isBulk: false });
    const [emailLoading, setEmailLoading] = useState(false);

    // Application detail modal state
    const [selectedApp, setSelectedApp] = useState<any>(null);
    const [actionRemarks, setActionRemarks] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
    const [userRoleFilter, setUserRoleFilter] = useState("all");
    const [activeContactPopup, setActiveContactPopup] = useState<{ id: string; type: 'email' | 'phone' } | null>(null);
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
    const toggleRowExpanded = (rowId: string) => {
        setExpandedRows(prev => ({ ...prev, [rowId]: !prev[rowId] }));
    };

    const [currentPage, setCurrentPage] = useState(() => getDashboardPage(searchParams.get("page")));
    const [itemsPerPage] = useState(30);
    const applicationsPerPage = 20;
    const [totalItems, setTotalItems] = useState(0);
    const [userSectionStats, setUserSectionStats] = useState<any>(null);
    const [countries, setCountries] = useState<any[]>([]);

    const buildDashboardUrl = useCallback((section: string, page: number) => {
        const params = new URLSearchParams(searchParams.toString());
        const safeSection = getDashboardSection(section);

        if (safeSection === "overview") params.delete("section");
        else params.set("section", safeSection);

        if (page <= 1) params.delete("page");
        else params.set("page", String(page));

        const query = params.toString();
        return query ? `${pathname}?${query}` : pathname;
    }, [pathname, searchParams]);

    const navigateToSection = useCallback((section: string) => {
        const routes: Record<string, string> = {
            overview: "/staff/dashboard",
            incoming_queue: "/staff/incoming-queue",
            applications: "/staff/incoming-queue",
            tasks: "/staff/tasks",
            performance: "/staff/performance",
            users: "/staff/users",
            communications: "/staff/communications",
            chat_customer: "/staff/chat-customer",
            my_profile: "/staff/my-profile",
            onboarding: "/staff/onboarding",
            calendar: "/staff/calendar"
        };
        const path = routes[section] || "/staff/dashboard";
        router.push(path);
    }, [router]);

    const navigateToPage = useCallback((page: number) => {
        setCurrentPage(Math.max(1, page));
    }, []);

    useEffect(() => {
        const fetchCountries = async () => {
            try {
                const res = await referenceApi.getCountries();
                setCountries(res as any[]);
            } catch (e) {
                console.error("Failed to fetch countries", e);
            }
        };
        fetchCountries();
    }, []);

    const [onboardMode, setOnboardMode] = useState<"new" | "link">("new");
    const [userSearchQuery, setUserSearchQuery] = useState("");
    const [userSuggestions, setUserSuggestions] = useState<any[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);
    const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);

    // Step 4 Share State
    const [shareTarget, setShareTarget] = useState<'bank' | 'student'>('bank');
    const [shareEmail, setShareEmail] = useState("");
    const [shareName, setShareName] = useState("");
    const [shareMessage, setShareMessage] = useState("");
    const [isSharing, setIsSharing] = useState(false);
    const [shareResult, setShareResult] = useState<{ url: string; expires: string; applicationId?: string; applicationNumber?: string } | null>(null);
    const [availableBanks, setAvailableBanks] = useState<any[]>([]);
    const [bankUsers, setBankUsers] = useState<any[]>([]);
    const [sendToBankSelection, setSendToBankSelection] = useState<Record<string, string>>({});
    const [sendToBankLoadingId, setSendToBankLoadingId] = useState<string | null>(null);

    // Fetch suggestions as user types for "Link Existing"
    useEffect(() => {
        const fetchSuggestions = async () => {
            if (onboardMode === 'link' && userSearchQuery.trim().length >= 2) {
                setIsSearchingSuggestions(true);
                try {
                    const res: any = await adminApi.getUsers(5, 0, userSearchQuery.trim());
                    const users = res.data || [];
                    setUserSuggestions(users.sort((a: any, b: any) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime()));
                } catch (e) {
                    console.error("Failed to fetch suggestions", e);
                } finally {
                    setIsSearchingSuggestions(false);
                }
            } else {
                setUserSuggestions([]);
            }
        };

        const timer = setTimeout(fetchSuggestions, 400);
        return () => clearTimeout(timer);
    }, [userSearchQuery, onboardMode]);

    // Fetch banks and bank users for dynamic distribution matching
    useEffect(() => {
        const fetchBanksAndUsers = async () => {
            try {
                const banksRes: any = await referenceApi.getBanks();
                setAvailableBanks(banksRes?.data || banksRes || []);

                const usersRes: any = await adminApi.getUsers(100, 0, "", "bank");
                setBankUsers(usersRes?.data || usersRes || []);
            } catch (e) {
                console.error("Failed to load reference banks or bank users", e);
            }
        };
        fetchBanksAndUsers();
    }, []);

    // Validation Helpers removed - using shared lib

    // Helper function to generate required documents based on employment type
    const getRequiredDocuments = (employmentType: string, personName: string, personType: 'father' | 'mother' | 'coapplicant') => {
        return getPersonDocumentRequirements(employmentType, personName, personType);
    };

    // Onboard applicant — two-step state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string } | null>(null);
    const [onboardStep, setOnboardStep] = useState<1 | 2 | 3 | 4>(1);
    const [createdUser, setCreatedUser] = useState<any>(null);
    const [quickForm, setQuickForm] = useState({ firstName: "", lastName: "", email: "", phone: "" });
    const [profileTab, setProfileTab] = useState<"personal" | "academic" | "loan" | "work" | "tests" | "family">("personal");
    const [newStudent, setNewStudent] = useState(createEmptyNewStudent);
    const [createLoading, setCreateLoading] = useState(false);

    // Document state
    const [userDocuments, setUserDocuments] = useState<any[]>([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [uploadingDocs, setUploadingDocs] = useState<{ [key: string]: number }>({});
    const [uploadErrors, setUploadErrors] = useState<{ [key: string]: string }>({});
    const [uploadMessages, setUploadMessages] = useState<{ [key: string]: { type: 'success' | 'error' | 'warning'; text: string } }>({});
    const [autofillMessages, setAutofillMessages] = useState<{ [key: string]: { type: 'success' | 'error'; text: string } }>({});
    const [s3Documents, setS3Documents] = useState<any[]>([]);
    const [ocrResults, setOcrResults] = useState<{ [key: string]: any }>({});
    const [showOcrReview, setShowOcrReview] = useState<{ [key: string]: boolean }>({});
    const fileInputRefs = useRef<{ [key: string]: HTMLInputElement }>({});
    const loadOverview = useCallback(async (silent?: boolean) => {
        if (!silent) setLoading(true);
        try {
            const [blogStats, appStats, userStats, todayRes]: [any, any, any, any] = await Promise.all([
                adminApi.getBlogStats().catch(() => ({ data: {} })),
                adminApi.getApplicationStats().catch(() => ({ data: {} })),
                adminApi.getUsers().catch(() => ({ data: [], total: 0 })),
                staffProfileApi.getTodayDashboard().catch(() => null)
            ]);

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const joinedToday = userStats.data?.filter((u: any) => u.createdAt && new Date(u.createdAt) >= today).length || 0;

            setStats({
                blogs: blogStats.data || {},
                apps: appStats.data || {},
                users: {
                    total: userStats.total || userStats.data?.length || 0,
                    joinedToday
                }
            });

            if (todayRes && todayRes.success) {
                setTodayStats(todayRes.data);
            } else if (todayRes) {
                setTodayStats(todayRes);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleGlobalSearch = useCallback(async (q: string) => {
        setSearchQuery(q);
        if (q.trim().length < 2) {
            setSearchResults([]);
            setShowSearchSuggestions(false);
            return;
        }
        setIsSearching(true);
        try {
            const res = await staffProfileApi.globalSearch(q) as any;
            if (res && res.success) {
                setSearchResults(res.data || []);
                setShowSearchSuggestions(true);
            } else if (Array.isArray(res)) {
                setSearchResults(res);
                setShowSearchSuggestions(true);
            }
        } catch (err) {
            console.error("Global search error:", err);
        } finally {
            setIsSearching(false);
        }
    }, []);

    const handleViewCalendarApp = useCallback(async (appId: string) => {
        setLoading(true);
        try {
            const res = await adminApi.getApplication(appId) as any;
            if (res && res.data) {
                setSelectedApp(res.data);
            } else if (res) {
                setSelectedApp(res);
            }
        } catch (err) {
            console.error("Error viewing application from calendar:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadPerformanceData = useCallback(async () => {
        setLoadingPerformance(true);
        try {
            const [summary, rejections, sla]: [any, any, any] = await Promise.all([
                staffProfileApi.getDashboardSummary().catch(() => null),
                staffProfileApi.getRejectionAnalytics('30').catch(() => null),
                staffProfileApi.getSlaTracker().catch(() => null)
            ]);

            if (summary && summary.success) setDashboardSummary(summary.data);
            else if (summary) setDashboardSummary(summary);

            if (rejections && rejections.success) setRejectionAnalytics(rejections.data);
            else if (rejections) setRejectionAnalytics(rejections);

            if (sla && sla.success) setSlaTracker(sla.data);
            else if (sla) setSlaTracker(sla);
        } catch (err) {
            console.error("Error loading performance data:", err);
        } finally {
            setLoadingPerformance(false);
        }
    }, []);

    const loadCalendarEvents = useCallback(async () => {
        setLoadingCalendar(true);
        try {
            const res = await staffProfileApi.getDeadlineCalendar() as any;
            if (res && res.success) {
                setCalendarEvents(res.data || []);
            } else if (Array.isArray(res)) {
                setCalendarEvents(res);
            }
        } catch (err) {
            console.error("Error loading calendar events:", err);
        } finally {
            setLoadingCalendar(false);
        }
    }, []);

    // Track whether this is the first load for the current section (show spinner) or a background refresh (silent)
    const isInitialSectionLoad = useRef(true);
    const lastLoadedSection = useRef("");

    const loadData = useCallback(async () => {
        if (activeSection === "overview" || activeSection.startsWith("chat_")) return;
        // Only show loading spinner + clear data on initial section load, not on background refreshes
        const isInitial = lastLoadedSection.current !== activeSection;
        if (isInitial) {
            setLoading(true);
            setData([]);
            lastLoadedSection.current = activeSection;
        }
        try {
            let res: any;
            if (activeSection === "blogs") {
                res = await adminApi.getBlogs({ limit: '100' });
                setData(Array.isArray(res) ? res : (res.data || []));
            } else if (activeSection === "incoming_queue") {
                const offset = (currentPage - 1) * applicationsPerPage;
                const params: any = {
                    limit: String(applicationsPerPage),
                    offset: String(offset),
                    status: "submitted",
                };
                if (searchQuery) params.search = searchQuery;
                res = await adminApi.getApplications(params);
                if (res && res.data) {
                    setData(res.data);
                    setTotalItems(res.pagination?.total ?? res.total ?? res.data.length);
                } else {
                    setData(Array.isArray(res) ? res : []);
                    setTotalItems(Array.isArray(res) ? res.length : 0);
                }
            } else if (activeSection === "applications") {
                const params: any = {
                    limit: "1000",
                    excludeStatus: "submitted",
                };
                res = await adminApi.getApplications(params);
                if (res && res.data) {
                    setData(res.data);
                    setTotalItems(res.data.length);
                } else {
                    setData(Array.isArray(res) ? res : []);
                    setTotalItems(0);
                }
            } else if (activeSection === "community") {
                res = await adminApi.getForumPosts(50);
                setData(Array.isArray(res) ? res : (res.data || []));
            } else if (activeSection === "users") {
                const offset = (currentPage - 1) * itemsPerPage;
                const [usersRes, statsRes]: [any, any] = await Promise.all([
                    adminApi.getUsers(itemsPerPage, offset, searchQuery, userRoleFilter),
                    adminApi.getUserStats().catch(() => null)
                ]);
                if (usersRes && usersRes.data) {
                    setData(usersRes.data);
                    setTotalItems(usersRes.total || usersRes.data.length);
                } else {
                    setData(Array.isArray(usersRes) ? usersRes : []);
                    setTotalItems(Array.isArray(usersRes) ? usersRes.length : 0);
                }
                if (statsRes && statsRes.success) {
                    setUserSectionStats(statsRes.data || statsRes);
                } else if (statsRes) {
                    setUserSectionStats(statsRes);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [activeSection, filterStatus, currentPage, itemsPerPage, searchQuery, userRoleFilter]);

    useEffect(() => {
        setCurrentPage(1);
        if (searchParams.get("page")) {
            router.replace(buildDashboardUrl(activeSection, 1), { scroll: false });
        }
    }, [filterStatus, searchQuery, userRoleFilter]);

    useEffect(() => {
        loadDataRef.current = loadData;
    }, [loadData]);

    useEffect(() => {
        loadOverviewRef.current = loadOverview;
    }, [loadOverview]);

    useEffect(() => {
        if (activeSection === "overview") {
            loadOverviewRef.current();
        } else if (activeSection === "performance") {
            loadPerformanceData();
        } else if (activeSection === "calendar") {
            loadCalendarEvents();
        } else {
            loadDataRef.current();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSection, filterStatus, currentPage, searchQuery, userRoleFilter, loadPerformanceData, loadCalendarEvents]);


    // Pre-calculate stats for different sections to avoid complex IIFEs in JSX
    const userStatsData = activeSection === 'users' ? (() => {
        const total = userSectionStats?.total ?? totalItems;
        const students = userSectionStats?.student ?? 0;
        const bankPartners = userSectionStats?.bank ?? 0;
        const staffMembers = userSectionStats?.staff ?? 0;
        return [
            { id: 'all', label: 'Total Users', value: total, icon: 'group', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', tag: 'ACTIVE' },
            { id: 'student', label: 'Student Accounts', value: students, icon: 'school', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', tag: 'ROLE' },
            { id: 'bank', label: 'Bank Partners', value: bankPartners, icon: 'account_balance', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', tag: 'ROLE' },
            { id: 'staff', label: 'Staff Members', value: staffMembers, icon: 'badge', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', tag: 'O_ADMIN' },
        ];
    })() : [];

    const blogStatsData = activeSection === 'blogs' ? (() => {
        const total = data.length;
        const published = data.filter((b: any) => b.isPublished).length;
        const drafts = total - published;
        const totalViews = data.reduce((acc: number, b: any) => acc + (b.views || 0), 0);
        return [
            { label: 'Total Posts', value: total, icon: 'article', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', tag: 'ALL' },
            { label: 'Published', value: published, icon: 'check_circle', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', tag: 'LIVE' },
            { label: 'Drafts', value: drafts, icon: 'edit_note', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', tag: 'WORK' },
            { label: 'Total Engagement', value: totalViews, icon: 'visibility', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', tag: 'VIEWS' },
            { label: 'Avg Read Time', value: '4m', icon: 'timer', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', tag: 'METRIC' },
        ];
    })() : [];

    const communityStatsData = activeSection === 'community' ? (() => {
        const total = data.length;
        const activeThreads = data.filter((t: any) => !t.isClosed).length;
        const totalLikes = data.reduce((acc: number, t: any) => acc + (t.likes?.length || 0), 0);
        return [
            { label: 'Active Topics', value: total, icon: 'forum', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100', tag: 'HUB' },
            { label: 'Open Threads', value: activeThreads, icon: 'bolt', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', tag: 'LIVE' },
            { label: 'Total Reactions', value: totalLikes, icon: 'favorite', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', tag: 'SOCIAL' },
            { label: 'New Replies', value: '12', icon: 'chat', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', tag: '24H' },
            { label: 'Moderation', value: '0', icon: 'gavel', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', tag: 'PENDING' },
        ];
    })() : [];

    // Auto-refresh for real-time updates (intentionally low frequency to avoid spamming auth checks)
    useEffect(() => {
        if (!autoRefreshEnabled) return;
        if (autoRefreshInterval.current) clearInterval(autoRefreshInterval.current);

        if (activeSection === "overview") {
            // Refresh overview every 90 seconds (silently - no spinner)
            autoRefreshInterval.current = setInterval(() => {
                loadOverview(true);
                setLastRefresh(new Date());
            }, 90000);
        } else if (activeSection === "applications" || activeSection === "incoming_queue") {
            // Refresh applications every 60 seconds
            autoRefreshInterval.current = setInterval(() => {
                loadData();
                setLastRefresh(new Date());
            }, 60000);
        } else if (activeSection === "performance") {
            // Refresh metrics every 120 seconds (silently)
            autoRefreshInterval.current = setInterval(() => {
                loadOverview(true);
                setLastRefresh(new Date());
            }, 120000);
        } else if (activeSection === "users") {
            // Refresh users every 120 seconds
            autoRefreshInterval.current = setInterval(() => {
                loadData();
                setLastRefresh(new Date());
            }, 120000);
        }

        return () => {
            if (autoRefreshInterval.current) clearInterval(autoRefreshInterval.current);
        };
    }, [activeSection, autoRefreshEnabled, loadOverview, loadData]);

    const handleAppStatus = async (appId: string, status: string) => {
        setActionLoading(true);
        try {
            await adminApi.updateApplicationStatus(appId, {
                status,
                remarks: actionRemarks || undefined,
            });
            setSelectedApp(null);
            setActionRemarks("");
            loadData();
            loadOverview();
        } catch (e) {
            alert("Failed to update application status");
        } finally {
            setActionLoading(false);
        }
    };

    const getBankDisplayName = (bank: BankReference) =>
        bank?.name || bank?.bankName || bank?.displayName || bank?.title || bank?.label || bank?.id || "";

    const bankOptions = availableBanks
        .map(getBankDisplayName)
        .filter((name: string, index: number, list: string[]) => name && list.indexOf(name) === index);

    const handleSendApplicationToBank = async (item: ApplicationRowForBankSend, selectedBank: string) => {
        const appId = item.id || item._id;
        if (!appId) {
            alert("Application ID is missing.");
            return;
        }
        if (!selectedBank) {
            alert("Select a bank before sending this application.");
            return;
        }

        setSendToBankLoadingId(appId);
        try {
            await adminApi.updateApplicationStatus(appId, {
                status: "submitted_to_bank",
                bank: selectedBank,
                stage: "Submitted",
                progress: 50,
                remarks: `Sent to ${selectedBank} from staff incoming queue.`,
            });

            // Map selectedBank display name to reference bank details
            const matchingBank = availableBanks.find(b => getBankDisplayName(b) === selectedBank);
            const bankId = matchingBank?.id || matchingBank?.bankId || selectedBank.toLowerCase();
            const bankName = matchingBank?.name || matchingBank?.bankName || selectedBank;
            const staffName = user
                ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email
                : "Staff";

            // Submit application to bank workflow to trigger creation of BankSubmission and notifications
            try {
                await apiFetch("/api/bank/workflow/submit", {
                    method: "POST",
                    body: JSON.stringify({
                        applicationId: appId,
                        bankId,
                        bankName,
                        submittedBy: staffName,
                    }),
                });
            } catch (workflowErr: any) {
                console.warn("[Dashboard] Workflow submit warning:", workflowErr?.message);
            }

            addActivity("share", `Sent application to ${selectedBank}`, "send", "text-indigo-600 bg-indigo-50");
            setActiveMenuId(null);
            setMenuPosition(null);
            await Promise.all([loadData(), loadOverview()]);
        } catch (e: unknown) {
            alert(e instanceof Error ? e.message : "Failed to send application to bank");
        } finally {
            setSendToBankLoadingId(null);
        }
    };

    const handleSendEmail = async () => {
        if (!emailData.subject || !emailData.content) { alert("Subject and content are required"); return; }
        setEmailLoading(true);
        try {
            await adminApi.sendEmail(emailData);
            alert("Email sent successfully");
            setEmailData({ to: "", subject: "", content: "", role: "student", isBulk: false });
        } catch (e: any) {
            alert("Failed to send email: " + e.message);
        } finally { setEmailLoading(false); }
    };

    const openEmailModal = (email: string, name: string = "") => {
        setEmailModalRecipient(email || "");
        setEmailModalRecipientName(name || "");
        setIsEmailModalOpen(true);
    };

    const toggleTask = (id: number) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    };

    const addTask = () => {
        if (!newTaskTitle.trim()) return;
        setTasks([{ id: Date.now(), title: newTaskTitle, completed: false }, ...tasks]);
        setNewTaskTitle("");
    };

    const deleteTask = (id: number) => {
        setTasks(tasks.filter(t => t.id !== id));
    };

    const resetOnboardState = () => {
        setOnboardStep(1);
        setCreatedUser(null);
        setQuickForm({ firstName: "", lastName: "", email: "", phone: "" });
        setNewStudent(createEmptyNewStudent());
        setProfileTab("personal");
        setOnboardMode('new');
        setUserSearchQuery("");
        setShareTarget('bank');
        setShareEmail("");
        setShareName("");
        setShareMessage("");
        setShareResult(null);
        setUserDocuments([]);
        setOcrResults({});
        setShowOcrReview({});
        setUploadErrors({});
        setUploadMessages({});
        setAutofillMessages({});
        setUploadingDocs({});
    };

    const startOnboarding = () => {
        resetOnboardState();
        navigateToSection('onboarding');
    };

    const resetOnboardModal = () => {
        const wasShared = !!shareResult;
        resetOnboardState();
        if (wasShared) {
            navigateToSection('applications');
        } else {
            navigateToSection('overview');
        }
    };

    const handleCheckEmailAndLink = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userSearchQuery) return;
        setIsSearchingUsers(true);
        try {
            // Use res.data as the backend returns 'data' array
            const res: any = await adminApi.getUsers(20, 0, userSearchQuery.trim());
            const user = res.data?.find((u: any) => u.email.toLowerCase() === userSearchQuery.trim().toLowerCase());

            if (user) {
                handleLinkExistingUser(user);
            } else {
                alert("No student found with this exact email address. Please select from suggestions or register as a new applicant.");
            }
        } catch (e) {
            console.error("Check email failed", e);
            alert("Failed to verify user. Please try again.");
        } finally {
            setIsSearchingUsers(false);
        }
    };

    const handleLinkExistingUser = async (user: any) => {
        setCreatedUser(user);

        let fullUser = user;
        try {
            const profileRes: any = await adminApi.getUserProfile(user.email);
            if (profileRes?.success && profileRes?.user) {
                fullUser = profileRes.user;
            }
        } catch (e) {
            console.warn("Failed to fetch full user profile, using basic list data", e);
        }

        let parsedDob = "";
        if (fullUser.dateOfBirth) {
            const parts = fullUser.dateOfBirth.split('-');
            if (parts.length === 3) {
                if (parts[2].length === 4) {
                    parsedDob = `${parts[2]}-${parts[1]}-${parts[0]}`;
                } else if (parts[0].length === 4) {
                    parsedDob = `${parts[0]}-${parts[1]}-${parts[2]}`;
                }
            } else {
                parsedDob = fullUser.dateOfBirth;
            }
        }

        setNewStudent(s => ({
            ...s,
            firstName: fullUser.firstName || "",
            lastName: fullUser.lastName || "",
            email: fullUser.email || "",
            mobile: fullUser.phoneNumber || fullUser.mobile || fullUser.phone || "",
            dob: parsedDob,
            gender: normalizeGenderForForm(fullUser.gender) || fullUser.gender || "",
            pan: fullUser.panNumber || "",
            aadhaarNumber: fullUser.aadhaarNumber || "",
            permanentAddress: fullUser.permanentAddress ? {
                ...s.permanentAddress,
                address1: fullUser.permanentAddress
            } : s.permanentAddress,
            mailingAddress: safeParseJson(fullUser.mailingAddress, null) || (fullUser.permanentAddress ? {
                ...s.mailingAddress,
                address1: fullUser.permanentAddress
            } : s.mailingAddress),
            passport: safeParseJson(fullUser.passport, s.passport),
            nationality: safeParseJson(fullUser.nationality, s.nationality),
            emergencyContact: safeParseJson(fullUser.emergencyContact, s.emergencyContact),
            academic: safeParseJson(fullUser.academic, null) || {
                ...s.academic,
                highestLevel: fullUser.bachelorsDegree || "",
                countryOfEducation: fullUser.studyDestination || "",
                undergrad: {
                    ...s.academic.undergrad,
                    qualification: fullUser.bachelorsDegree || "",
                    score: fullUser.gpa ? String(fullUser.gpa) : "",
                }
            },
            workExperience: safeParseJson(fullUser.workExperience, null) || (fullUser.workExp ? [
                { employer: "Previous Employer", role: "Professional", country: "India", startDate: "", endDate: "", current: false }
            ] : s.workExperience),
            tests: safeParseJson(fullUser.tests, null) || {
                ...s.tests,
                ielts: fullUser.englishTest?.toLowerCase() === 'ielts' ? String(fullUser.englishScore || "") : "",
                toefl: fullUser.englishTest?.toLowerCase() === 'toefl' ? String(fullUser.englishScore || "") : "",
                pte: fullUser.englishTest?.toLowerCase() === 'pte' ? String(fullUser.englishScore || "") : "",
                duolingo: fullUser.englishTest?.toLowerCase() === 'duolingo' ? String(fullUser.englishScore || "") : "",
                gre: fullUser.entranceTest?.toLowerCase() === 'gre' ? String(fullUser.entranceScore || "") : "",
                gmat: fullUser.entranceTest?.toLowerCase() === 'gmat' ? String(fullUser.entranceScore || "") : "",
                sat: fullUser.entranceTest?.toLowerCase() === 'sat' ? String(fullUser.entranceScore || "") : "",
                act: fullUser.entranceTest?.toLowerCase() === 'act' ? String(fullUser.entranceScore || "") : "",
            },
            family: safeParseJson(fullUser.family, null) || {
                ...s.family,
                fatherName: fullUser.fatherName || "",
            },
            coApplicant: safeParseJson(fullUser.coApplicant, s.coApplicant),
            loanAmount: fullUser.loanAmount || "",
            targetUniversity: fullUser.targetUniversity || "",
            studyDestination: fullUser.studyDestination || "",
            courseName: fullUser.courseName || "",
            budget: fullUser.budget || "",
            pincode: fullUser.pincode || "",
            admitStatus: fullUser.admitStatus || "",
            intakeSeason: fullUser.intakeSeason || "",
            goal: fullUser.goal || "",
        }));

        // Check if StaffProfile exists first to prevent 409 Conflict error
        try {
            const userId = user.id || user._id || user.uid;
            if (userId) {
                const checkRes: any = await staffProfileApi.checkExists(userId);
                if (!checkRes.exists) {
                    await staffProfileApi.create({
                        linked_user_id: userId,
                        internal_notes: `Staff-initiated link for existing user ${user.firstName}`
                    });
                }
            }
        } catch (spErr) {
            console.warn("Staff profile check/creation failed", spErr);
        }

        addActivity("new", `Linked existing student: ${user.firstName} ${user.lastName}`, "link", "text-indigo-600 bg-indigo-50");
        setOnboardStep(2);
    };

    const handleQuickRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quickForm.firstName || !quickForm.lastName || !quickForm.email || !quickForm.phone) return;

        const firstNameTrim = quickForm.firstName.trim();
        const lastNameTrim = quickForm.lastName.trim();

        if (firstNameTrim.length < 3) {
            alert("First name must be at least 3 characters");
            return;
        }
        if (firstNameTrim.length > 30) {
            alert("First name must not exceed 30 characters");
            return;
        }
        if (/[^A-Za-z]/.test(firstNameTrim)) {
            alert("First name must contain only letters");
            return;
        }

        if (lastNameTrim.length < 1) {
            alert("Last name must be at least 1 character");
            return;
        }
        if (lastNameTrim.length > 30) {
            alert("Last name must not exceed 30 characters");
            return;
        }
        if (/[^A-Za-z]/.test(lastNameTrim)) {
            alert("Last name must contain only letters");
            return;
        }

        if (!isPhoneValid(quickForm.phone)) {
            alert("Please enter a valid 10-digit Indian mobile number");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quickForm.email)) {
            alert("Please enter a valid email format");
            return;
        }

        setCreateLoading(true);
        try {
            const res: any = await adminApi.createUser({
                firstName: quickForm.firstName,
                lastName: quickForm.lastName,
                email: quickForm.email,
                mobile: quickForm.phone,
                role: "student",
            });

            console.log("Create User Response Full:", JSON.stringify(res, null, 2));
            console.log("Response keys:", Object.keys(res || {}));

            // Handle different possible response structures
            const user = res?.user || (Array.isArray(res?.data) ? res.data[0] : res.data) || res;
            console.log("Extracted user object:", JSON.stringify(user, null, 2));
            console.log("User object keys:", Object.keys(user || {}));

            const userId = user?.id || user?.uid || user?._id;
            console.log("Extracted userId:", userId);

            if (!userId) {
                console.error("Failed to extract user ID. Response structure:", {
                    hasUser: !!res?.user,
                    userKeys: Object.keys(res?.user || {}),
                    hasData: !!res?.data,
                    hasId: !!user?.id,
                    hasUid: !!user?.uid,
                    has_id: !!user?._id,
                    responseObj: res
                });
                throw new Error("User created but no valid ID returned from server. Response: " + JSON.stringify(res));
            }

            setCreatedUser(user);
            setNewStudent({
                ...createEmptyNewStudent(),
                firstName: quickForm.firstName,
                lastName: quickForm.lastName,
                email: quickForm.email,
                mobile: quickForm.phone,
            });

            // Create a StaffProfile for this user to enable document fetching/syncing
            try {
                await staffProfileApi.create({
                    linked_user_id: userId,
                    internal_notes: `Staff-initiated onboarding for ${quickForm.firstName}`
                });
            } catch (spErr) {
                console.warn("Staff profile creation failed", spErr);
            }

            addActivity("new", `Registered new student: ${quickForm.firstName} ${quickForm.lastName}`, "person_add", "text-emerald-600 bg-emerald-50");
            setOnboardStep(2);
        } catch (e: any) {
            alert(e.message || "Failed to register applicant");
        } finally {
            setCreateLoading(false);
        }
    };

    // Auto-fetch documents when entering step 3
    useEffect(() => {
        if (onboardStep === 3 && createdUser) {
            const userId = createdUser.id || createdUser.uid || createdUser._id;
            if (userId) {
                (async () => {
                    await syncRequiredDocumentRecords(userId);
                    await fetchUserDocuments(userId);
                })();
            }
        }
    }, [onboardStep, createdUser]);

    const handleSaveProfile = async (e?: React.FormEvent | boolean) => {
        if (e && typeof e !== 'boolean') e.preventDefault();

        // We only save to the database in two explicit cases:
        // 1. e is explicitly false (e.g. from buttons/proceed calls: handleSaveProfile(false))
        // 2. e is a React FormEvent (from <form onSubmit={handleSaveProfile}>)
        // In all other cases (e is undefined, or e is true), we bypass saving.
        const silent = e === undefined || e === true;

        // Bypasses all automatic background database saves to ensure the user
        // only saves to the database once when they explicitly click the Save button.
        if (silent) return;

        if (!createdUser) return;

        setCreateLoading(true);
        try {
            const userId = createdUser.id || createdUser.uid || createdUser._id;
            const payload = {
                userId,
                personal: {
                    firstName: newStudent.firstName,
                    lastName: newStudent.lastName,
                    middleName: newStudent.middleName,
                    email: newStudent.email,
                    mobile: newStudent.mobile,
                    dob: newStudent.dob,
                    gender: newStudent.gender,
                    maritalStatus: newStudent.maritalStatus,
                    pan: newStudent.pan,
                    aadhaarNumber: newStudent.aadhaarNumber
                },
                address: {
                    mailing: newStudent.mailingAddress,
                    permanent: newStudent.permanentAddress
                },
                academic: newStudent.academic,
                studyDestination: newStudent.studyDestination || newStudent.academic.countryOfEducation || newStudent.academic.undergrad?.country,
                testScores: newStudent.tests,
                workExperience: newStudent.workExperience,
                familyDetails: newStudent.family,
                coApplicant: newStudent.coApplicant,
                passport: newStudent.passport,
                nationality: newStudent.nationality,
                emergencyContact: newStudent.emergencyContact,
                loanAmount: newStudent.loanAmount,
                targetUniversity: newStudent.targetUniversity,
                courseName: newStudent.courseName,
                budget: newStudent.budget,
                pincode: newStudent.pincode,
                admitStatus: newStudent.admitStatus,
                intakeSeason: newStudent.intakeSeason,
                goal: newStudent.goal
            };

            await onboardingApi.submit(payload);
            addActivity("update", `Synced profile for ${newStudent.firstName}`, "sync", "text-emerald-600 bg-emerald-50");

            if (!silent) {
                alert("Profile Synced: Student details have been successfully updated in the database.");
            }
        } catch (error) {
            console.error("Save profile error:", error);
            if (!silent) {
                alert("Sync Failed: Could not update profile details. Please try again.");
            }
        } finally {
            setCreateLoading(false);
        }
    };

    const handleShareProfile = async () => {
        const studentId = createdUser?.id || createdUser?.uid || createdUser?._id;
        if (!studentId) {
            alert("Please register the student first.");
            return;
        }

        const studentEmail = newStudent.email || createdUser?.email || quickForm.email;
        if (!studentEmail) {
            alert("Student email is not registered. Please set student email first.");
            return;
        }

        const studentName = `${newStudent.firstName || createdUser?.firstName || 'Student'} ${newStudent.lastName || createdUser?.lastName || ''}`.trim();
        const shareUrl = `${window.location.origin}/student/onboarding?studentId=${studentId}`;

        setCreateLoading(true);
        try {
            const shareRes: any = await onboardingApi.share({
                studentId,
                studentEmail,
                studentName,
                shareUrl
            });

            if (shareRes.success) {
                try {
                    await navigator.clipboard.writeText(shareUrl);
                } catch (clipErr) {
                    const tempInput = document.createElement("input");
                    tempInput.value = shareUrl;
                    document.body.appendChild(tempInput);
                    tempInput.select();
                    document.execCommand("copy");
                    document.body.removeChild(tempInput);
                }
                alert(`📧 Onboarding Link shared successfully to student registered email (${studentEmail})!\n📋 Link has also been copied to your clipboard.`);
                addActivity("approved", `Shared onboarding profile link with student (${studentEmail})`, "mail", "text-indigo-600 bg-indigo-50");
            } else {
                alert(`Failed to share onboarding link via email: ${shareRes.message}`);
            }
        } catch (err: any) {
            console.error("Share onboarding error:", err);
            alert(`Failed to share onboarding profile: ${err.message || err}`);
        } finally {
            setCreateLoading(false);
        }
    };

    const handleFinalOnboardSubmit = async () => {
        // Global validation check before final submission
        if (newStudent.pan && !isPanValid(newStudent.pan)) {
            alert("Invalid Applicant's PAN Number.");
            return;
        }
        if (newStudent.family.fatherMobile && !isPhoneValid(newStudent.family.fatherMobile)) {
            alert("Invalid Father's Mobile Number.");
            return;
        }
        if (newStudent.family.fatherAadhar && !isAadharValid(newStudent.family.fatherAadhar)) {
            alert("Invalid Father's Aadhar Number.");
            return;
        }
        if (newStudent.family.fatherPan && !isPanValid(newStudent.family.fatherPan)) {
            alert("Invalid Father's PAN Number.");
            return;
        }

        if (newStudent.family.motherMobile && !isPhoneValid(newStudent.family.motherMobile)) {
            alert("Invalid Mother's Mobile Number.");
            return;
        }

        if (newStudent.coApplicant.name) {
            if (newStudent.coApplicant.mobile && !isPhoneValid(newStudent.coApplicant.mobile)) {
                alert("Invalid Co-applicant Mobile Number.");
                return;
            }
        }

        setCreateLoading(true);
        try {
            await onboardingApi.submit(newStudent);

            // Fetch the profile ID to use for sharing in Step 4
            const userId = createdUser?.id || createdUser?.uid || createdUser?._id;
            const profileRes: any = await staffProfileApi.checkExists(userId);
            if (profileRes?.data?.id) {
                // Ensure we have the profile ID for Step 4
                // You might want to store this in state if not already there
            }

            alert("🎉 Onboarding complete! Profile has been finalized.");
            setOnboardStep(4); // Move to Distribution step
            loadData();
            addActivity("approved", `Completed onboarding for ${newStudent.firstName}`, "task_alt", "text-emerald-600 bg-emerald-50");
        } catch (e: any) {
            alert("Failed to finalize onboarding: " + e.message);
        } finally {
            setCreateLoading(false);
        }
    };

    const handleBankSelect = (selectedName: string) => {
        setShareName(selectedName);
        if (!selectedName) {
            setShareEmail("");
            return;
        }

        const lowercaseSelected = selectedName.toLowerCase().trim();

        // 1. Dynamic check in loaded bankUsers
        const matched = bankUsers.find((u: any) => {
            const userBank = (u.bank || "").toLowerCase().trim();
            const firstName = (u.firstName || "").toLowerCase().trim();
            const lastName = (u.lastName || "").toLowerCase().trim();
            const email = (u.email || "").toLowerCase().trim();
            return (
                (userBank && (lowercaseSelected.includes(userBank) || userBank.includes(lowercaseSelected))) ||
                (firstName && (lowercaseSelected.includes(firstName) || firstName.includes(lowercaseSelected))) ||
                (lastName && (lowercaseSelected.includes(lastName) || lastName.includes(lowercaseSelected))) ||
                (email && email.includes(lowercaseSelected))
            );
        });

        if (matched?.email) {
            setShareEmail(matched.email);
            return;
        }

        setShareEmail("");
    };

    const handleDistributionShare = async () => {
        const studentId = createdUser?.id || createdUser?.uid || createdUser?._id;
        if (!studentId) {
            alert("No student profile found to share.");
            return;
        }

        setIsSharing(true);
        try {
            const res: any = await staffProfileApi.shareProfile(studentId, {
                recipientType: shareTarget,
                recipientName: shareName || (shareTarget === 'student' ? `${newStudent.firstName} ${newStudent.lastName}` : "Bank Representative"),
                recipientEmail: shareEmail,
                message: shareMessage,
                sharedBy: "staff",
                studentDetails: newStudent
            });

            if (res.success || res.url) {
                const shareUrl = res.url || `${window.location.origin}/share/${res.shareId || 'test'}`;
                const shareExpires = res.expiresAt || new Date(Date.now() + IST_OFFSET + 30 * 24 * 60 * 60 * 1000).toISOString();

                let targetAppId = "";
                let targetAppNumber = "";

                // Try to find an existing application first
                try {
                    const appsRes: any = await adminApi.getApplications({ userId: studentId });
                    const applications = appsRes?.data || [];
                    const activeApp = applications.find((app: any) => app.userId === studentId || app.email === (createdUser?.email || newStudent?.email));
                    if (activeApp) {
                        targetAppId = activeApp.id;
                        targetAppNumber = activeApp.applicationNumber;
                    }
                } catch (findErr) {
                    console.warn("Failed to find existing application", findErr);
                }

                // Update application status and progress if sharing to bank
                if (shareTarget === 'bank' && shareName) {
                    try {
                        if (!targetAppId) {
                            const studentEmail = createdUser?.email || newStudent?.email;
                            const amountVal = createdUser?.loanAmount || (newStudent as any)?.loanAmount || "1500000";

                            const newAppRes: any = await applicationApi.create({
                                userId: studentId,
                                bank: shareName,
                                loanType: "education",
                                amount: amountVal,
                                purpose: "education_loan",
                                firstName: newStudent.firstName || createdUser?.firstName || "Student",
                                lastName: newStudent.lastName || createdUser?.lastName || "",
                                email: studentEmail,
                                phone: newStudent.mobile || createdUser?.mobile || createdUser?.phoneNumber || "",
                                dateOfBirth: newStudent.dob || createdUser?.dateOfBirth,
                                address: newStudent.mailingAddress?.address1 ? `${newStudent.mailingAddress.address1}, ${newStudent.mailingAddress.city || ''}`.trim() : undefined,
                                universityName: newStudent.targetUniversity,
                                university: newStudent.targetUniversity,
                                targetUniversity: newStudent.targetUniversity,
                                courseName: newStudent.courseName,
                                courseType: newStudent.courseName,
                                program: newStudent.courseName,
                                programFocus: newStudent.courseName
                            });

                            const createdApp = newAppRes?.application || newAppRes;
                            if (createdApp?.id) {
                                targetAppId = createdApp.id;
                                targetAppNumber = createdApp.applicationNumber;
                            }
                        } else {
                            await adminApi.updateApplication(targetAppId, {
                                universityName: newStudent.targetUniversity,
                                courseName: newStudent.courseName
                            });
                        }

                        if (targetAppId) {
                            await adminApi.updateApplicationStatus(targetAppId, {
                                status: "submitted_to_bank",
                                bank: shareName,
                                progress: 50,
                                currentStage: "Submitted",
                                remarks: `Application shared with ${shareName} on ${new Date().toLocaleDateString()}`
                            });

                            await loadData();
                        }
                    } catch (updateError) {
                        console.warn("Failed to update application status after sharing", updateError);
                    }
                }

                setShareResult({
                    url: shareUrl,
                    expires: shareExpires,
                    applicationId: targetAppId || undefined,
                    applicationNumber: targetAppNumber || undefined
                });

                addActivity("share", `Shared profile with ${shareName || shareEmail}`, "send", "text-indigo-600 bg-indigo-50");
            } else {
                throw new Error(res.message || "Failed to generate share link");
            }
        } catch (error: any) {
            alert("Sharing Failed: " + (error.message || "Could not generate secure link."));
        } finally {
            setIsSharing(false);
        }
    };

    const fetchUserDocuments = async (userId: string) => {
        setDocsLoading(true);
        try {
            const res: any = await documentApi.getUsersDocuments(userId);
            setUserDocuments(res?.data || res || []);
        } catch (e) {
            console.error("Failed to load documents");
        } finally {
            setDocsLoading(false);
        }
    };

    const getCreatedUserId = () => createdUser?.id || createdUser?.uid || createdUser?._id;

    const syncRequiredDocumentRecords = async (userId: string) => {
        const requirements = getProfileDocumentRequirements(newStudent).filter((doc: DocumentRequirement) => doc.required !== false);
        const existingByType = new Map(userDocuments.map((doc: any) => [doc.docType || doc.type, doc]));

        await Promise.all(
            requirements.map((doc) => {
                const existing = existingByType.get(doc.type) as any;
                if (existing?.uploaded || ["uploaded", "verified"].includes(String(existing?.status || "").toLowerCase())) {
                    return Promise.resolve(existing);
                }
                return documentApi.addRequirement(userId, doc.type, doc.name);
            })
        );
    };

    const proceedToDocuments = async () => {
        await handleSaveProfile(false);
        const userId = getCreatedUserId();
        if (userId) {
            await syncRequiredDocumentRecords(userId);
            await fetchUserDocuments(userId);
        }
        setOnboardStep(3);
    };

    const renderAcademicDocumentStatus = (docType: 'marksheet_10' | 'marksheet_12', label: string) => {
        const userId = getCreatedUserId();
        if (!userId) {
            return (
                <div className="mb-6 p-4 bg-slate-50 border border-slate-200 border-dashed rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-slate-400 text-[22px]">info</span>
                        <div>
                            <p className="text-xs font-bold text-slate-700">Document Management Locked</p>
                            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Please register the student first in Step 1 to upload or verify {label}.</p>
                        </div>
                    </div>
                </div>
            );
        }

        const doc = userDocuments.find(ud => ud.docType === docType || ud.type === docType);
        const docStatus = String(doc?.status || "").toLowerCase();
        const isUploaded = Boolean(doc?.uploaded || ["uploaded", "verified"].includes(docStatus));
        const isVerified = docStatus === 'verified' || docStatus === 'approved';
        const confidence = doc?.ocrResult?.confidence_score || doc?.confidence || doc?.details?.confidence_score || null;

        return (
            <div className={`mb-6 p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${isVerified
                ? 'bg-emerald-50/30 border-emerald-200/80 shadow-sm shadow-emerald-500/5'
                : isUploaded
                    ? 'bg-amber-50/30 border-amber-200/80 shadow-sm shadow-amber-500/5'
                    : 'bg-slate-50/50 border-slate-200/80'
                }`}>
                <div className="flex items-start gap-3.5">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-inner ${isVerified
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                        : isUploaded
                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                            : 'bg-white text-slate-400 border-slate-200'
                        }`}>
                        <span className="material-symbols-outlined text-[24px]">
                            {isVerified ? 'verified' : isUploaded ? 'hourglass_empty' : 'cloud_upload'}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-bold text-slate-800">{label}</p>
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${isVerified
                                ? 'bg-emerald-100/60 text-emerald-700 border-emerald-200/50'
                                : isUploaded
                                    ? 'bg-amber-100/60 text-amber-700 border-amber-200/50 animate-pulse'
                                    : 'bg-slate-100 text-slate-500 border-slate-200'
                                }`}>
                                {isVerified ? 'Verified' : isUploaded ? 'Pending Verification' : 'Not Uploaded'}
                            </span>
                            {isVerified && confidence && (
                                <span className="text-[9px] font-black text-emerald-600 bg-emerald-100/40 border border-emerald-200/30 px-2 py-0.5 rounded-full">
                                    {confidence}% Match
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-semibold mt-1">
                            {isVerified
                                ? `Document successfully verified via premium AI OCR. All academic fields populated.`
                                : isUploaded
                                    ? `Scanned copy uploaded. System is running background verification...`
                                    : `Required document for verification. Uploading details will trigger automated fields populate.`
                            }
                        </p>
                        {isUploaded && (doc?.fileName || doc?.filename) && (
                            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-600 font-bold bg-white/60 border border-slate-200/60 rounded-lg px-2.5 py-1 w-fit">
                                <span className="material-symbols-outlined text-slate-400 text-[14px]">description</span>
                                <span className="truncate max-w-[200px]">{doc.fileName || doc.filename}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                    {isUploaded && (
                        <button
                            type="button"
                            onClick={() => viewFile(docType)}
                            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow"
                        >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            View Scan
                        </button>
                    )}
                    {isUploaded && (
                        <button
                            type="button"
                            onClick={async () => {
                                const uploadKey = `${docType}-applicant`;
                                const ocrRes = ocrResults[uploadKey] || doc?.ocrResult?.extractedFields || doc?.verificationMetadata?.details?.extractedFields || doc?.verificationMetadata?.details?.extracted_data;
                                if (ocrRes && Object.keys(ocrRes).length > 0) {
                                    const res = await autoFillFromOcr(docType, ocrRes);
                                    alert(res.message);
                                } else {
                                    alert("No OCR data available for this document yet. Try re-uploading.");
                                }
                            }}
                            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow"
                        >
                            <span className="material-symbols-outlined text-[16px]">magic_button</span>
                            Autofill Profile
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedDocType(docType);
                            setSelectedDocName(label);
                            setSelectedDocCategory('applicant');
                            setIsUploadModalOpen(true);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm hover:shadow ${isUploaded
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/10'
                            }`}
                    >
                        <span className="material-symbols-outlined text-[16px]">
                            {isUploaded ? 'settings_backup_restore' : 'cloud_upload'}
                        </span>
                        {isUploaded ? 'Re-upload' : 'Upload & Autofill'}
                    </button>
                </div>
            </div>
        );
    };

    const viewFile = async (docType: string) => {
        const userId = getCreatedUserId();
        if (!userId) return;
        try {
            const data = await apiFetch<{ success: boolean; url?: string }>(HttpApiPaths.documents.presignedView(userId, docType));
            if (data.success && data.url) {
                setPreviewDoc({ url: data.url, name: docType.toUpperCase().replace(/_/g, ' ') });
                return;
            }
        } catch (e) {
            console.error("Presigned view retrieval failed:", e);
        }
        // Fallback: direct streaming URL route
        setPreviewDoc({
            url: HttpApiPaths.documents.streamView(userId, docType),
            name: docType.toUpperCase().replace(/_/g, ' ')
        });
    };

    const getNormalizedStateAndCountry = (stateVal?: string, countryVal?: string) => {
        let country = countryVal ? normalizeCountryName(countryVal) : 'India';
        const matchedCountry = getAllCountries().find(c => c.toLowerCase() === country.toLowerCase()) || country;

        let state = stateVal ? String(stateVal).trim() : '';
        if (state && matchedCountry) {
            const statesList = getStatesByCountry(matchedCountry);
            const matchedState = statesList.find(s => s.toLowerCase() === state.toLowerCase());
            if (matchedState) {
                state = matchedState;
            } else {
                const clean = state.toLowerCase();
                const aliases: Record<string, string> = {
                    'tg': 'Telangana', 'ts': 'Telangana', 'ap': 'Andhra Pradesh', 'up': 'Uttar Pradesh',
                    'mp': 'Madhya Pradesh', 'wb': 'West Bengal', 'mh': 'Maharashtra', 'dl': 'Delhi'
                };
                if (aliases[clean]) {
                    const aliasMatch = statesList.find(s => s.toLowerCase() === aliases[clean].toLowerCase());
                    if (aliasMatch) state = aliasMatch;
                }
            }
        }
        return { state, country: matchedCountry };
    };

    const formatStructuredAddress = (addr: Record<string, string | undefined>): string => {
        return [
            addr.house_details,
            addr.area,
            addr.landmark,
            addr.mandal,
            addr.city,
            addr.district,
            addr.state,
            addr.pincode,
        ].filter(Boolean).join(', ');
    };

    const applyStructuredAddressToProfile = (
        addr: Record<string, string | undefined>,
        permanentAddress: typeof newStudent.permanentAddress,
        mailingAddress: typeof newStudent.mailingAddress,
    ) => {
        const address1Parts = [addr.house_details, addr.area].filter(Boolean);
        const address2Parts = [addr.landmark, addr.mandal, addr.district].filter(Boolean);
        const formatted = formatStructuredAddress(addr);

        const norm = getNormalizedStateAndCountry(addr.state, addr.country);

        const nextPermanent = {
            ...permanentAddress,
            address1: address1Parts.length ? address1Parts.join(', ') : (formatted || permanentAddress.address1),
            address2: address2Parts.length ? address2Parts.join(', ') : permanentAddress.address2,
            city: addr.city || permanentAddress.city,
            state: norm.state || addr.state || permanentAddress.state,
            pincode: addr.pincode || permanentAddress.pincode,
            country: norm.country || permanentAddress.country || 'India',
        };

        return {
            permanentAddress: nextPermanent,
            mailingAddress: {
                ...mailingAddress,
                address1: nextPermanent.address1,
                address2: nextPermanent.address2,
                city: nextPermanent.city,
                state: nextPermanent.state,
                pincode: nextPermanent.pincode,
                country: nextPermanent.country,
            },
        };
    };

    const parseOcrDate = (dateStr: string): string => parseOcrDateForInput(dateStr);

    const autoFillFromOcr = async (
        docType: string,
        extractedFields: any,
    ): Promise<{ filled: boolean; message: string }> => {
        const normalized = extractedFields && (extractedFields._isNormalized || extractedFields.board || extractedFields.institution || extractedFields.passport_number)
            ? extractedFields
            : normalizeOcrFieldsForAutofill(extractedFields || {}, docType);
        if (!normalized || Object.keys(normalized).length === 0) {
            return {
                filled: false,
                message: 'No readable fields were found in the OCR result. Try re-uploading a clearer scan.',
            };
        }
        console.log(`[OCR AUTOFILL] Processing extracted fields for ${docType}:`, normalized);
        extractedFields = normalized;

        setNewStudent(prev => {
            const updated = { ...prev };

            const compareAndSet = (currentVal: string | undefined | null, newVal: string, setter: (val: string) => void) => {
                if (!newVal) return;
                const cleanCurrent = String(currentVal || '').trim().toLowerCase();
                const cleanNew = String(newVal).trim().toLowerCase();
                if (!currentVal || cleanCurrent !== cleanNew) {
                    setter(newVal);
                }
            };

            const mapFullName = (fullName: string) => {
                if (!fullName) return;
                const parts = fullName.trim().split(/\s+/);
                if (parts.length > 0) {
                    const newFirstName = parts[0];
                    const newLastName = parts.slice(1).join(' ');

                    compareAndSet(updated.firstName, newFirstName, (val) => {
                        updated.firstName = val;
                    });
                    if (newLastName) {
                        compareAndSet(updated.lastName, newLastName, (val) => {
                            updated.lastName = val;
                        });
                    }
                }
            };

            const parseAddressDetails = (addressStr: string) => {
                const result = {
                    house_details: "",
                    area: "",
                    landmark: "",
                    mandal: "",
                    city: "",
                    district: "",
                    state: "",
                    pincode: "",
                    country: ""
                };
                if (!addressStr) return result;

                // 1. Extract 6-digit Pincode
                const pinMatch = addressStr.match(/\b\d{6}\b/) || addressStr.match(/\b\d{3}\s\d{3}\b/);
                if (pinMatch) {
                    result.pincode = pinMatch[0].replace(/\s/g, '');
                }

                // 2. Identify State
                const states = [
                    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
                    'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
                    'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
                    'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
                    'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu & Kashmir',
                    'Jammu and Kashmir', 'Puducherry', 'Chandigarh', 'Dadra and Nagar Haveli',
                    'Daman and Diu', 'Lakshadweep', 'Ladakh', 'Andaman and Nicobar'
                ];

                const lowerAddress = addressStr.toLowerCase();
                let foundState = "";
                for (const state of states) {
                    if (lowerAddress.includes(state.toLowerCase())) {
                        foundState = state;
                        break;
                    }
                }
                if (foundState) {
                    result.state = foundState;
                    result.country = "India";
                }

                // 3. Parse address into components
                const parts = addressStr.split(/[\n,;:-]+/).map(p => p.trim()).filter(Boolean);

                // Remove state and pincode from parts for easier parsing
                const filteredParts = parts.filter(p => {
                    const pLower = p.toLowerCase();
                    return !states.some(s => pLower.includes(s.toLowerCase())) && !pinMatch?.includes(p);
                });

                // Assign parts to address components (Aadhar format: house_details, area, landmark, mandal/city, district, state, pincode)
                if (filteredParts.length > 0) {
                    result.house_details = filteredParts[0]; // First line - house/plot details
                }
                if (filteredParts.length > 1) {
                    result.area = filteredParts[1]; // Second line - area/locality
                }
                if (filteredParts.length > 2) {
                    result.landmark = filteredParts[2]; // Third line - landmark
                }
                if (filteredParts.length > 3) {
                    result.mandal = filteredParts[3]; // Fourth line - mandal/tehsil/taluk
                }
                if (filteredParts.length > 4) {
                    result.district = filteredParts[4]; // Fifth line - district
                }

                // Extract City using segments
                if (foundState) {
                    const stateIndex = parts.findIndex(p => p.toLowerCase().includes(foundState.toLowerCase()));
                    if (stateIndex > 0) {
                        let potentialCity = parts[stateIndex - 1];
                        potentialCity = potentialCity.replace(/\b\d+\b/g, '').trim();
                        if (potentialCity && potentialCity.length > 2) {
                            result.city = potentialCity;
                        }
                    }
                }

                if (!result.city) {
                    const commonCities = [
                        'Mumbai', 'Delhi', 'Bengaluru', 'Bangalore', 'Hyderabad', 'Ahmedabad', 'Chennai',
                        'Kolkata', 'Surat', 'Pune', 'Jaipur', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore',
                        'Thane', 'Bhopal', 'Visakhapatnam', 'Pimpri-Chinchwad', 'Patna', 'Vadodara',
                        'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Ranchi', 'Faridabad', 'Meerut',
                        'Rajkot', 'Kalyan-Dombivli', 'Vasai-Virar', 'Varanasi', 'Srinagar', 'Aurangabad',
                        'Dhanbad', 'Amritsar', 'Navi Mumbai', 'Allahabad', 'Howrah', 'Gwalior',
                        'Jabalpur', 'Coimbatore', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur',
                        'Kota', 'Guwahati', 'Chandigarh', 'Solapur', 'Hubli-Dharwad', 'Bareilly',
                        'Moradabad', 'Mysore', 'Gurgaon', 'Gurugram', 'Aligarh', 'Jalandhar', 'Tiruchirappalli',
                        'Bhubaneswar', 'Salem', 'Mira-Bhayandar', 'Warangal', 'Guntur', 'Bhiwandi',
                        'Saharanpur', 'Noida', 'Amravati', 'Kochi', 'Cochin', 'Cuttack', 'Trivandrum',
                        'Thiruvananthapuram', 'Mangalore', 'Mangaluru', 'Udupi', 'Mysuru', 'Belgaum',
                        'Hubli', 'Dharwad', 'Gulbarga', 'Shimoga', 'Tumkur', 'Bellary', 'Davangere'
                    ];
                    for (const city of commonCities) {
                        if (lowerAddress.includes(city.toLowerCase())) {
                            result.city = city;
                            if (!result.state) {
                                const cityToState: Record<string, string> = {
                                    'mumbai': 'Maharashtra', 'pune': 'Maharashtra', 'nagpur': 'Maharashtra', 'thane': 'Maharashtra', 'nashik': 'Maharashtra', 'aurangabad': 'Maharashtra', 'navi mumbai': 'Maharashtra', 'solapur': 'Maharashtra', 'amravati': 'Maharashtra', 'bhiwandi': 'Maharashtra', 'mira-bhayandar': 'Maharashtra', 'kalyan-dombivli': 'Maharashtra', 'vasai-virar': 'Maharashtra',
                                    'delhi': 'Delhi',
                                    'bengaluru': 'Karnataka', 'bangalore': 'Karnataka', 'mysore': 'Karnataka', 'hubli-dharwad': 'Karnataka', 'mangalore': 'Karnataka', 'mangaluru': 'Karnataka', 'udupi': 'Karnataka', 'mysuru': 'Karnataka', 'belgaum': 'Karnataka', 'hubli': 'Karnataka', 'dharwad': 'Karnataka', 'gulbarga': 'Karnataka', 'shimoga': 'Karnataka', 'tumkur': 'Karnataka', 'bellary': 'Karnataka', 'davangere': 'Karnataka',
                                    'hyderabad': 'Telangana', 'warangal': 'Telangana',
                                    'ahmedabad': 'Gujarat', 'surat': 'Gujarat', 'rose': 'Gujarat', 'vadodara': 'Gujarat', 'rajkot': 'Gujarat',
                                    'chennai': 'Tamil Nadu', 'coimbatore': 'Tamil Nadu', 'madurai': 'Tamil Nadu', 'salem': 'Tamil Nadu', 'tiruchirappalli': 'Tamil Nadu',
                                    'kolkata': 'West Bengal', 'howrah': 'West Bengal',
                                    'jaipur': 'Rajasthan', 'jodhpur': 'Rajasthan', 'kota': 'Rajasthan',
                                    'lucknow': 'Uttar Pradesh', 'kanpur': 'Uttar Pradesh', 'ghaziabad': 'Uttar Pradesh', 'agra': 'Uttar Pradesh', 'meerut': 'Uttar Pradesh', 'varanasi': 'Uttar Pradesh', 'allahabad': 'Uttar Pradesh', 'gwalior': 'Madhya Pradesh', 'jabalpur': 'Madhya Pradesh', 'bhopal': 'Madhya Pradesh', 'indore': 'Madhya Pradesh', 'noida': 'Uttar Pradesh', 'aligarh': 'Uttar Pradesh', 'moradabad': 'Uttar Pradesh', 'bareilly': 'Uttar Pradesh', 'saharanpur': 'Uttar Pradesh',
                                    'visakhapatnam': 'Andhra Pradesh', 'vijayawada': 'Andhra Pradesh', 'guntur': 'Andhra Pradesh',
                                    'patna': 'Bihar',
                                    'ludhiana': 'Punjab', 'amritsar': 'Punjab', 'jalandhar': 'Punjab',
                                    'ranchi': 'Jharkhand', 'dhanbad': 'Jharkhand',
                                    'faridabad': 'Haryana', 'gurgaon': 'Haryana', 'gurugram': 'Haryana',
                                    'srinagar': 'Jammu & Kashmir',
                                    'raipur': 'Chhattisgarh',
                                    'guwahati': 'Assam',
                                    'chandigarh': 'Chandigarh',
                                    'bhubaneswar': 'Odisha', 'cuttack': 'Odisha',
                                    'kochi': 'Kerala', 'cochin': 'Kerala', 'trivandrum': 'Kerala', 'thiruvananthapuram': 'Kerala'
                                };
                                const stateVal = cityToState[city.toLowerCase()];
                                if (stateVal) {
                                    result.state = stateVal;
                                    result.country = "India";
                                }
                            }
                            break;
                        }
                    }
                }
                return result;
            };

            const applyAddressFromOcr = (addressInput: string | Record<string, string | undefined>) => {
                if (!addressInput) return;
                if (typeof addressInput === 'object' && !Array.isArray(addressInput)) {
                    const a = addressInput as Record<string, string | undefined>;

                    // Check if this is a structured Aadhar address with granular fields
                    if (a.house_details || a.area || a.landmark || a.mandal || a.district) {
                        // Combine house_details and area for address1
                        const address1 = [a.house_details, a.area].filter(Boolean).join(', ');
                        // Use landmark for address2
                        const address2 = a.landmark || '';

                        const norm = getNormalizedStateAndCountry(a.state, a.country);
                        const nextPermanent = {
                            ...updated.permanentAddress,
                            address1: address1 || updated.permanentAddress.address1,
                            address2: address2 || updated.permanentAddress.address2,
                            city: a.city || updated.permanentAddress.city,
                            state: norm.state || a.state || updated.permanentAddress.state,
                            pincode: a.pincode || a.pin_code || updated.permanentAddress.pincode,
                            country: norm.country || updated.permanentAddress.country || 'India',
                        };
                        updated.permanentAddress = nextPermanent;
                        updated.mailingAddress = { ...updated.mailingAddress, ...nextPermanent };
                        return;
                    }

                    if (a.address1 || a.line1 || a.city || a.state || a.pincode) {
                        const line1 = a.address1 || a.line1 || [a.house_details, a.area].filter(Boolean).join(', ');
                        const norm = getNormalizedStateAndCountry(a.state, a.country);
                        const nextPermanent = {
                            ...updated.permanentAddress,
                            address1: line1 || updated.permanentAddress.address1,
                            address2: a.address2 || a.line2 || updated.permanentAddress.address2,
                            city: a.city || updated.permanentAddress.city,
                            state: norm.state || a.state || updated.permanentAddress.state,
                            pincode: a.pincode || a.pin_code || updated.permanentAddress.pincode,
                            country: norm.country || updated.permanentAddress.country || 'India',
                        };
                        updated.permanentAddress = nextPermanent;
                        updated.mailingAddress = { ...updated.mailingAddress, ...nextPermanent };
                        return;
                    }
                    const applied = applyStructuredAddressToProfile(
                        addressInput,
                        updated.permanentAddress,
                        updated.mailingAddress,
                    );
                    updated.permanentAddress = applied.permanentAddress;
                    updated.mailingAddress = applied.mailingAddress;
                    return;
                }
                const addrStr = String(addressInput);
                updated.permanentAddress = { ...updated.permanentAddress, address1: addrStr };
                updated.mailingAddress = { ...updated.mailingAddress, address1: addrStr };
                syncAddressFields(addrStr);
            };

            const syncAddressFields = (addr: string) => {
                if (!addr) return;
                const parsed = parseAddressDetails(addr);
                const norm = getNormalizedStateAndCountry(parsed.state, parsed.country);
                const explicitPin = extractedFields.pin_code || extractedFields.pincode || extractedFields.zip;
                const finalPincode = explicitPin || parsed.pincode;

                // Update permanent address with parsed components
                if (parsed.house_details || parsed.area || parsed.landmark || parsed.mandal || parsed.district) {
                    const address1 = [parsed.house_details, parsed.area].filter(Boolean).join(', ');
                    if (address1) {
                        updated.permanentAddress = { ...updated.permanentAddress, address1 };
                        updated.mailingAddress = { ...updated.mailingAddress, address1 };
                    }
                    const address2 = [parsed.landmark, parsed.mandal, parsed.district].filter(Boolean).join(', ');
                    if (address2) {
                        updated.permanentAddress = { ...updated.permanentAddress, address2 };
                        updated.mailingAddress = { ...updated.mailingAddress, address2 };
                    }
                }

                if (norm.state) {
                    compareAndSet(updated.permanentAddress?.state, norm.state, (val) => {
                        updated.permanentAddress = { ...updated.permanentAddress, state: val };
                    });
                    compareAndSet(updated.mailingAddress?.state, norm.state, (val) => {
                        updated.mailingAddress = { ...updated.mailingAddress, state: val };
                    });
                }
                if (norm.country) {
                    compareAndSet(updated.permanentAddress?.country, norm.country, (val) => {
                        updated.permanentAddress = { ...updated.permanentAddress, country: val };
                    });
                    compareAndSet(updated.mailingAddress?.country, norm.country, (val) => {
                        updated.mailingAddress = { ...updated.mailingAddress, country: val };
                    });
                }
                if (finalPincode) {
                    compareAndSet(updated.permanentAddress?.pincode, finalPincode, (val) => {
                        updated.permanentAddress = { ...updated.permanentAddress, pincode: val };
                    });
                    compareAndSet(updated.mailingAddress?.pincode, finalPincode, (val) => {
                        updated.mailingAddress = { ...updated.mailingAddress, pincode: val };
                    });
                }
                if (parsed.city) {
                    compareAndSet(updated.permanentAddress?.city, parsed.city, (val) => {
                        updated.permanentAddress = { ...updated.permanentAddress, city: val };
                    });
                    compareAndSet(updated.mailingAddress?.city, parsed.city, (val) => {
                        updated.mailingAddress = { ...updated.mailingAddress, city: val };
                    });
                }
            };

            if (docType === 'passport') {
                const passportPatch: typeof updated.passport = { ...updated.passport };

                if (extractedFields.passport_number) {
                    passportPatch.number = String(extractedFields.passport_number);
                }
                const issueDate = parseOcrDate(String(extractedFields.date_of_issue || ''));
                if (issueDate) passportPatch.issueDate = issueDate;
                const expiryDate = parseOcrDate(String(extractedFields.date_of_expiry || ''));
                if (expiryDate) passportPatch.expiryDate = expiryDate;

                const issueCountry = extractedFields.issue_country
                    ? normalizeCountryName(String(extractedFields.issue_country))
                    : '';
                if (issueCountry) {
                    passportPatch.issueCountry = issueCountry;
                } else if (extractedFields.nationality && /indian|ind\b/i.test(String(extractedFields.nationality))) {
                    passportPatch.issueCountry = 'India';
                }

                if (extractedFields.birth_city) {
                    passportPatch.birthCity = String(extractedFields.birth_city);
                } else if (extractedFields.place_of_birth) {
                    passportPatch.birthCity = String(extractedFields.place_of_birth).split(',')[0].trim();
                }

                const birthCountry = extractedFields.birth_country
                    ? normalizeCountryName(String(extractedFields.birth_country))
                    : extractedFields.nationality
                        ? normalizeCountryName(String(extractedFields.nationality).replace(/^indian$/i, 'India'))
                        : '';
                if (birthCountry) passportPatch.birthCountry = birthCountry;

                updated.passport = passportPatch;

                if (extractedFields.nationality) {
                    const nat = String(extractedFields.nationality);
                    const citizenship = /indian/i.test(nat) ? 'India' : normalizeCountryName(nat);
                    updated.nationality = {
                        ...updated.nationality,
                        citizenship,
                        name: /indian/i.test(nat) ? 'Indian' : nat,
                    };
                }

                if (extractedFields.given_names || extractedFields.surname) {
                    if (extractedFields.given_names) {
                        updated.firstName = String(extractedFields.given_names).trim();
                    }
                    if (extractedFields.surname) {
                        updated.lastName = String(extractedFields.surname).trim();
                    }
                } else {
                    const nameVal = extractedFields.full_name || extractedFields.name || extractedFields.fullName;
                    if (nameVal) {
                        const parts = String(nameVal).trim().split(/\s+/);
                        if (parts.length > 0) {
                            updated.firstName = parts[0];
                            if (parts.length > 1) updated.lastName = parts.slice(1).join(' ');
                        }
                    }
                }
                if (extractedFields.dob) {
                    const parsedDob = parseOcrDate(String(extractedFields.dob));
                    if (parsedDob) updated.dob = parsedDob;
                }
                const passportGender = normalizeGenderForForm(extractedFields.gender || extractedFields.sex);
                if (passportGender) updated.gender = passportGender;
                if (extractedFields.address) {
                    applyAddressFromOcr(extractedFields.address);
                }
            } else if (docType === 'pan') {
                // PAN: Only extract and autofill the PAN Card number
                const panVal = extractedFields.pan_number || extractedFields.panNumber || extractedFields.pan;
                if (panVal) {
                    updated.pan = String(panVal).toUpperCase();
                }
            } else if (docType === 'national_id' || docType === 'aadhaar_card' || docType === 'aadhaar' || docType === 'aadhar') {
                // Aadhaar: Only extract and autofill the Aadhaar number
                const aadharNum = extractedFields.aadhaar_number || extractedFields.aadhaar || extractedFields.aadhaarNumber || extractedFields.aadharNumber || extractedFields.national_id_number || extractedFields.document_number;
                if (aadharNum) {
                    updated.aadhaarNumber = String(aadharNum).replace(/\s/g, '');
                }
            } else if (docType === 'father_pan') {
                const panVal = extractedFields.pan_number || extractedFields.panNumber || extractedFields.pan;
                if (panVal) {
                    compareAndSet(updated.family?.fatherPan, String(panVal).toUpperCase(), (val) => {
                        updated.family = { ...updated.family, fatherPan: val };
                    });
                }
                const nameVal = extractedFields.full_name || extractedFields.fullName || extractedFields.cardholder_name || extractedFields.holder_name || extractedFields.name;
                if (nameVal) {
                    compareAndSet(updated.family?.fatherName, String(nameVal).trim(), (val) => {
                        updated.family = { ...updated.family, fatherName: val };
                    });
                }
            } else if (docType === 'mother_pan') {
                const panVal = extractedFields.pan_number || extractedFields.panNumber || extractedFields.pan;
                if (panVal) {
                    compareAndSet(updated.family?.motherPan, String(panVal).toUpperCase(), (val) => {
                        updated.family = { ...updated.family, motherPan: val };
                    });
                }
                const nameVal = extractedFields.full_name || extractedFields.fullName || extractedFields.cardholder_name || extractedFields.holder_name || extractedFields.name;
                if (nameVal) {
                    compareAndSet(updated.family?.motherName, String(nameVal).trim(), (val) => {
                        updated.family = { ...updated.family, motherName: val };
                    });
                }
            } else if (docType === 'coapplicant_pan') {
                if (extractedFields.pan_number) {
                    compareAndSet(updated.coApplicant?.pan, extractedFields.pan_number, (val) => {
                        updated.coApplicant = { ...updated.coApplicant, pan: val };
                    });
                }
                if (extractedFields.full_name) {
                    compareAndSet(updated.coApplicant?.name, extractedFields.full_name, (val) => {
                        updated.coApplicant = { ...updated.coApplicant, name: val };
                    });
                }
            } else if (
                docType === 'marksheet_10' ||
                docType === 'marksheet_12' ||
                docType === 'diploma' ||
                docType === 'diploma_marksheet' ||
                docType === 'marksheet_ug' ||
                docType === 'ug_degree' ||
                docType === 'ug_transcript' ||
                docType === 'marksheet_pg' ||
                docType === 'pg_degree' ||
                docType === 'pg_transcript'
            ) {
                const isGrade10 = docType === 'marksheet_10';
                const isGrade12 = docType === 'marksheet_12' || docType === 'diploma' || docType === 'diploma_marksheet';
                const isUndergrad = ['marksheet_ug', 'ug_degree', 'ug_transcript'].includes(docType);
                const isPostgrad = ['marksheet_pg', 'pg_degree', 'pg_transcript'].includes(docType);

                const nameVal = extractedFields.full_name || extractedFields.name;
                if (nameVal) {
                    const parts = String(nameVal).trim().split(/\s+/);
                    if (parts.length > 0) {
                        compareAndSet(updated.firstName, parts[0], (v) => { updated.firstName = v; });
                        if (parts.length > 1) {
                            compareAndSet(updated.lastName, parts.slice(1).join(' '), (v) => { updated.lastName = v; });
                        }
                    }
                }
                if (extractedFields.dob) {
                    const parsedDob = parseOcrDate(String(extractedFields.dob));
                    if (parsedDob) compareAndSet(updated.dob, parsedDob, (v) => { updated.dob = v; });
                }

                const country = extractedFields.country || extractedFields.country_of_study
                    ? normalizeCountryName(String(extractedFields.country || extractedFields.country_of_study))
                    : (extractedFields.state || extractedFields.state_of_study)
                        ? 'India'
                        : '';
                let state = String(extractedFields.state || extractedFields.state_of_study || '');
                if (state) {
                    state = normalizeStateName(state);
                }
                const city = String(extractedFields.city || extractedFields.city_of_study || '');
                const board = String(extractedFields.board || extractedFields.board_name || extractedFields.examining_body || '');
                const institution = String(
                    extractedFields.institution ||
                    extractedFields.institution_name ||
                    extractedFields.school_name ||
                    extractedFields.college_name ||
                    ''
                );
                const university = String(extractedFields.university || extractedFields.university_name || institution || '');
                const qualification = String(extractedFields.qualification || extractedFields.degree || extractedFields.program_name || extractedFields.course_name || '');

                let grading = String(extractedFields.grading || extractedFields.grading_system || '');
                if (grading.toLowerCase().includes('cgpa') || grading.toLowerCase().includes('gpa')) {
                    grading = 'CGPA';
                } else if (grading.toLowerCase().includes('percent') || grading.toLowerCase().includes('%')) {
                    grading = 'Percentage';
                } else {
                    grading = '';
                }

                const score = String(extractedFields.score || extractedFields.percentage || extractedFields.overall_percentage || extractedFields.overall_gpa || extractedFields.cgpa || '');
                const language = String(extractedFields.language || extractedFields.medium_of_instruction || extractedFields.medium || '');

                let endDate = extractedFields.end_date || extractedFields.endDate
                    ? parseOcrDate(String(extractedFields.end_date || extractedFields.endDate))
                    : examYearToEndDate(String(extractedFields.exam_period || extractedFields.year_of_passing || extractedFields.examination_month_year || extractedFields.exam_month_year || ''));
                if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
                    endDate = parseOcrDate(endDate) || endDate;
                }
                let startDate = extractedFields.start_date || extractedFields.startDate
                    ? parseOcrDate(String(extractedFields.start_date || extractedFields.startDate))
                    : endDate
                        ? inferStartDate(
                            endDate,
                            isUndergrad || isPostgrad ? 3 : isGrade12 ? 2 : isGrade10 ? 1 : 2,
                        )
                        : '';
                if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
                    startDate = parseOcrDate(startDate) || startDate;
                }

                const academicObj = typeof updated.academic === 'string'
                    ? safeParseJson(updated.academic, createEmptyNewStudent().academic)
                    : (updated.academic || createEmptyNewStudent().academic);

                if (isGrade10 || isGrade12) {
                    const key = isGrade10 ? 'grade10' : 'grade12';
                    const prev = academicObj[key] || createEmptyNewStudent().academic[key];
                    const hl = academicObj.highestLevel;
                    const minLevel = isGrade12 ? 'Grade 12' : 'Grade 10';
                    const shouldRaiseLevel =
                        !hl ||
                        (isGrade12 && hl === 'Grade 10');
                    updated.academic = {
                        ...academicObj,
                        ...(shouldRaiseLevel ? { highestLevel: minLevel } : {}),
                        countryOfEducation: country || academicObj.countryOfEducation || 'India',
                        [key]: {
                            ...prev,
                            country: country || prev.country || 'India',
                            state: state || prev.state,
                            board: board || prev.board,
                            institution: institution || prev.institution,
                            city: city || prev.city,
                            grading: grading || prev.grading,
                            score: score || prev.score,
                            language: language || prev.language,
                            startDate: startDate || prev.startDate,
                            endDate: endDate || prev.endDate,
                        },
                    };
                }
                if (isUndergrad) {
                    const prev = academicObj.undergrad || createEmptyNewStudent().academic.undergrad;
                    updated.academic = {
                        ...academicObj,
                        countryOfEducation: country || academicObj.countryOfEducation || 'India',
                        undergrad: {
                            ...prev,
                            country: country || prev.country || 'India',
                            state: state || prev.state,
                            university: university || prev.university,
                            qualification: qualification || prev.qualification,
                            city: city || prev.city,
                            grading: grading || prev.grading,
                            score: score || prev.score,
                            language: language || prev.language,
                            startDate: startDate || prev.startDate,
                            endDate: endDate || prev.endDate,
                        },
                    };
                }
                if (isPostgrad) {
                    const prev = academicObj.postgrad || createEmptyNewStudent().academic.postgrad;
                    updated.academic = {
                        ...academicObj,
                        countryOfEducation: country || academicObj.countryOfEducation || 'India',
                        postgrad: {
                            ...prev,
                            country: country || prev.country || 'India',
                            state: state || prev.state,
                            university: university || prev.university,
                            qualification: qualification || prev.qualification,
                            city: city || prev.city,
                            grading: grading || prev.grading,
                            percentage: score || prev.percentage,
                            language: language || prev.language,
                            startDate: startDate || prev.startDate,
                            endDate: endDate || prev.endDate,
                        },
                    };
                }
            }

            // Sync the updated profile to backend immediately
            const userId = createdUser?.id || createdUser?.uid || createdUser?._id;
            if (userId) {
                const payload = {
                    userId,
                    personal: {
                        firstName: updated.firstName,
                        lastName: updated.lastName,
                        middleName: updated.middleName,
                        email: updated.email,
                        mobile: updated.mobile,
                        dob: updated.dob,
                        gender: updated.gender,
                        maritalStatus: updated.maritalStatus,
                        pan: updated.pan,
                        aadhaarNumber: updated.aadhaarNumber
                    },
                    address: {
                        mailing: updated.mailingAddress,
                        permanent: updated.permanentAddress
                    },
                    academic: updated.academic,
                    studyDestination: updated.academic.countryOfEducation || updated.academic.undergrad?.country,
                    testScores: updated.tests,
                    workExperience: updated.workExperience,
                    familyDetails: updated.family,
                    coApplicant: updated.coApplicant,
                    passport: updated.passport,
                    nationality: updated.nationality,
                    emergencyContact: updated.emergencyContact
                };
                onboardingApi.submit(payload)
                    .then(() => {
                        console.log("[OCR AUTOFILL] Live database sync completed successfully.");
                    })
                    .catch(err => {
                        console.error("[OCR AUTOFILL] Failed to sync live database:", err);
                    });
            }

            return updated;
        });

        const isAcademic = /marksheet|ug_|pg_|degree|transcript/.test(docType);
        const message = isAcademic
            ? `Academic qualifications have been filled from the ${docType.replace(/_/g, ' ').toUpperCase()} document.`
            : `Profile details have been filled from the ${docType.replace(/_/g, ' ').toUpperCase()} document.`;
        return { filled: true, message };
    };

    // Handle S3 document upload
    const handleDocumentUpload = async (
        file: File,
        docType: string,
        personType: 'applicant' | 'father' | 'mother' | 'coapplicant',
        personName: string,
        employmentType?: string
    ) => {
        const userId = createdUser?.id || createdUser?.uid || createdUser?._id;
        const uploadKey = `${docType}-${personType}`;

        if (!userId) {
            const text = 'Student profile not found. Please complete registration first.';
            setUploadErrors(prev => ({ ...prev, [uploadKey]: text }));
            setUploadMessages(prev => ({ ...prev, [uploadKey]: { type: 'error', text } }));
            return;
        }

        setUploadingDocs(prev => ({ ...prev, [uploadKey]: 0 }));
        setUploadErrors(prev => ({ ...prev, [uploadKey]: '' }));
        setUploadMessages(prev => {
            const next = { ...prev };
            delete next[uploadKey];
            return next;
        });
        setAutofillMessages(prev => {
            const next = { ...prev };
            delete next[uploadKey];
            return next;
        });

        try {
            // Use the standard multipart upload endpoint which is supported by the backend
            // This endpoint also handles automated OCR verification
            const res: any = await documentApi.upload(userId, docType, file, (progress) => {
                setUploadingDocs(prev => ({ ...prev, [uploadKey]: progress }));
            });

            if (res.success) {
                addActivity("upload", `Uploaded ${docType.replace(/_/g, ' ')} for ${personName}`, "upload_file", "text-purple-600 bg-purple-50");

                const docLabel = docType.replace(/_/g, ' ');
                let feedbackType: 'success' | 'warning' = 'success';
                let feedbackText = `✅ ${personName} — ${docLabel} uploaded successfully!`;

                if (res.data?.verification?.code === 'AI_VERIFIED') {
                    feedbackText = `✅ ${personName} — ${docLabel} uploaded and AI-verified successfully!`;
                } else if (res.data?.status === 'rejected') {
                    feedbackType = 'warning';
                    feedbackText = `⚠️ ${personName} — ${docLabel} uploaded but AI rejected: ${res.data?.aiExplanation || 'Invalid document type'}`;
                }

                const rawExtracted = res.data?.ocrResult?.extractedFields || res.data?.verification?.details?.extractedFields;
                const documentValidation = res.data?.ocrResult?.document_validation || res.data?.verification?.details?.document_validation;
                const ocrIssues = res.data?.ocrResult?.ocr_issues || res.data?.verification?.details?.ocr_issues;
                if (rawExtracted && Object.keys(rawExtracted).length > 0) {
                    const extractedFields = normalizeOcrFieldsForAutofill(rawExtracted, docType);
                    if (extractedFields) {
                        (extractedFields as any)._isNormalized = true;
                    }
                    setOcrResults(prev => ({
                        ...prev,
                        [uploadKey]: {
                            ...extractedFields,
                            ...(documentValidation ? { document_validation: documentValidation } : {}),
                            ...(Array.isArray(ocrIssues) && ocrIssues.length ? { ocr_issues: ocrIssues } : {}),
                        },
                    }));
                    setShowOcrReview(prev => ({ ...prev, [uploadKey]: true }));
                    console.log('📄 [OCR RESULTS CAPTURED]', { docType, extractedFields, documentValidation, ocrIssues });

                    // Auto-trigger autofill for supported identity and academic documents.
                    const isIdentityDoc = /aadhaar|aadhar|national_id|pan|passport/.test(docType);
                    const isAcademicDoc = /marksheet|ug_|pg_|degree|transcript/.test(docType);
                    if (isIdentityDoc || isAcademicDoc) {
                        try {
                            const autofillResult = await autoFillFromOcr(docType, extractedFields);
                            console.log('🪄 [AUTO-AUTOFILL TRIGGERED]', { docType, result: autofillResult });
                            if (autofillResult.filled) {
                                feedbackText = `✨ ${docLabel.toUpperCase()} verified & autofilled successfully! ${autofillResult.message}`;
                                setAutofillMessages(prev => ({
                                    ...prev,
                                    [uploadKey]: { type: 'success', text: `✨ ${autofillResult.message}` },
                                }));
                            } else {
                                const ocrHint = ' OCR data is ready — click Autofill to populate profile fields.';
                                feedbackText = feedbackType === 'warning'
                                    ? `${feedbackText}${ocrHint}`
                                    : `✨ ${docLabel.toUpperCase()} extracted successfully.${ocrHint}`;
                            }
                        } catch (autofillErr) {
                            console.error('[AUTO-AUTOFILL ERROR]', autofillErr);
                            const ocrHint = ' OCR data is ready — click Autofill to populate profile fields.';
                            feedbackText = `✨ ${docLabel.toUpperCase()} extracted successfully.${ocrHint}`;
                        }
                    } else {
                        const ocrHint = ' OCR data is ready — click Autofill to populate profile fields.';
                        feedbackText = feedbackType === 'warning'
                            ? `${feedbackText}${ocrHint}`
                            : `✨ ${docLabel.toUpperCase()} extracted successfully.${ocrHint}`;
                    }
                }

                setUploadMessages(prev => ({ ...prev, [uploadKey]: { type: feedbackType, text: feedbackText } }));
                fetchUserDocuments(userId);
            } else {
                throw new Error(res.message || 'Upload failed');
            }
        } catch (error: any) {
            const errorMsg = error.message || 'Upload failed';
            setUploadErrors(prev => ({ ...prev, [uploadKey]: errorMsg }));
            setUploadMessages(prev => ({ ...prev, [uploadKey]: { type: 'error', text: `❌ Upload failed: ${errorMsg}` } }));
            console.error('Document upload error:', error);
        } finally {
            setUploadingDocs(prev => {
                const updated = { ...prev };
                delete updated[uploadKey];
                return updated;
            });
        }
    };

    // Handle S3 document deletion
    const handleDocumentDelete = async (docType: string, category: string, name: string) => {
        const userId = createdUser?.id || createdUser?.uid || createdUser?._id;
        if (!userId) {
            alert('User ID not found');
            return;
        }
        if (!window.confirm(`Are you sure you want to remove the ${docType.replace(/_/g, ' ').toUpperCase()} document?`)) {
            return;
        }

        try {
            const res: any = await documentApi.delete(userId, docType);
            if (res.success) {
                alert(`✅ Document deleted successfully!`);
                addActivity("rejected", `Deleted ${docType.replace(/_/g, ' ')} for ${name}`, "delete", "text-rose-600 bg-rose-50");
                fetchUserDocuments(userId);
            } else {
                throw new Error(res.message || 'Deletion failed');
            }
        } catch (error: any) {
            alert(`❌ Deletion failed: ${error.message || error}`);
        }
    };

    const handleDeleteBlog = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this editorial piece? This action cannot be undone.")) return;
        try {
            await adminApi.deleteBlog(id);
            alert("Editorial content deleted successfully.");
            loadData();
            addActivity("rejected", `Deleted editorial content: ${id}`, "delete", "text-rose-600 bg-rose-50");
        } catch (e: any) {
            alert("Failed to delete: " + e.message);
        }
    };

    const handleToggleBlogStatus = async (item: any) => {
        try {
            await adminApi.bulkUpdateBlogStatus([item.id || item._id], !item.isPublished);
            alert(`Content ${!item.isPublished ? 'published live' : 'moved to drafts'}.`);
            loadData();
            addActivity("update", `${!item.isPublished ? 'Published' : 'Unpublished'} editorial`, "visibility", "text-indigo-600 bg-indigo-50");
        } catch (e: any) {
            alert("Failed to update status: " + e.message);
        }
    };

    const handleDeleteCommunityPost = async (id: string) => {
        if (!window.confirm("Are you sure you want to remove this community broadcast?")) return;
        try {
            await adminApi.deleteForumPost(id);
            alert("Community post removed.");
            loadData();
            addActivity("rejected", `Removed community post: ${id}`, "delete_sweep", "text-rose-600 bg-rose-50");
        } catch (e: any) {
            alert("Failed to delete: " + e.message);
        }
    };

    const handleDeleteUser = async (id: string) => {
        if (!window.confirm("CRITICAL: Delete this user account? All profile data and records will be purged. This action is irreversible.")) return;
        try {
            await adminApi.deleteUser(id);
            alert("User account has been permanently removed.");
            loadData();
            addActivity("rejected", `Deleted user account: ${id}`, "person_remove", "text-rose-600 bg-rose-50");
        } catch (e: any) {
            alert("Operation failed: " + e.message);
        }
    };

    const handleDeleteApplication = async (id: string) => {
        if (!window.confirm("Are you sure you want to purge this loan application record?")) return;
        try {
            await adminApi.deleteApplication(id);
            alert("Application record removed.");
            loadData();
            addActivity("rejected", `Purged application record: ${id}`, "delete_forever", "text-rose-600 bg-rose-50");
        } catch (e: any) {
            alert("Failed to remove record: " + e.message);
        }
    };

    const isPaid = (item: any) => {
        const status = (item.processingFeeStatus || '').toUpperCase();
        if (status === 'PAID' || status === 'WAIVED') return true;
        if (Array.isArray(item.ProcessingFee)) {
            return item.ProcessingFee.some((fee: any) => {
                const fStatus = (fee.status || '').toUpperCase();
                return fStatus === 'PAID' || fStatus === 'WAIVED';
            });
        }
        return false;
    };

    const uniqueCountries = Array.from(
        new Set(
            data.map(item => item.country || item.student?.studyDestination || item.studyDestination || item.user?.studyDestination || '').filter(Boolean)
        )
    ).sort();

    const showCol = (colId: string) => {
        return visibleColumns.includes(colId);
    };

    const clearAllFilters = () => {
        setFilterCountry("");
        setFilterPaymentPaid(null);
        setFilterStatuses([]);
    };

    const filteredData = data.filter(item => {
        const query = searchQuery.toLowerCase();
        if (activeSection === 'blogs') {
            return (item.title?.toLowerCase().includes(query) ||
                item.authorName?.toLowerCase().includes(query));
        }
        if (activeSection === 'incoming_queue') {
            const fName = (item.firstName || item.student?.firstName || '').toLowerCase();
            const lName = (item.lastName || item.student?.lastName || '').toLowerCase();
            const appNum = (item.applicationNumber || '').toLowerCase();
            const lanNum = (item.lanNumber || '').toLowerCase();
            const bName = (item.bank || item.targetBank || '').toLowerCase();
            const email = (item.email || item.student?.email || '').toLowerCase();
            return (appNum.includes(query) || lanNum.includes(query) || fName.includes(query) || lName.includes(query) || bName.includes(query) || email.includes(query));
        }
        if (activeSection === 'applications') {
            // Text search
            const fName = (item.firstName || item.student?.firstName || '').toLowerCase();
            const lName = (item.lastName || item.student?.lastName || '').toLowerCase();
            const appNum = (item.applicationNumber || '').toLowerCase();
            const lanNum = (item.lanNumber || '').toLowerCase();
            const bName = (item.bank || item.targetBank || '').toLowerCase();
            const email = (item.email || item.student?.email || '').toLowerCase();
            const matchesQuery = !query || (appNum.includes(query) || lanNum.includes(query) || fName.includes(query) || lName.includes(query) || bName.includes(query) || email.includes(query));

            // School country
            const country = (item.country || item.student?.studyDestination || item.studyDestination || item.user?.studyDestination || '').toLowerCase();
            const matchesCountry = !filterCountry || country === filterCountry.toLowerCase();

            // Payment Status
            let matchesPayment = true;
            if (filterPaymentPaid !== null) {
                const paid = isPaid(item);
                matchesPayment = filterPaymentPaid ? paid : !paid;
            }

            // Application status checkboxes
            let matchesStatuses = true;
            if (filterStatuses.length > 0) {
                const itemStatus = (item.status || 'draft').toLowerCase();
                matchesStatuses = filterStatuses.map(s => s.toLowerCase()).includes(itemStatus);
            }

            // Status dropdown next to search bar
            let matchesDropdownStatus = true;
            if (filterStatus !== 'all') {
                const itemStatus = (item.status || 'draft').toLowerCase();
                if (filterStatus === 'pending') {
                    matchesDropdownStatus = itemStatus === 'pending';
                } else if (filterStatus === 'processing') {
                    matchesDropdownStatus = itemStatus === 'processing';
                } else if (filterStatus === 'approved') {
                    matchesDropdownStatus = ['approved', 'verified', 'disbursed'].includes(itemStatus);
                } else if (filterStatus === 'rejected') {
                    matchesDropdownStatus = ['rejected', 'cancelled'].includes(itemStatus);
                }
            }

            return matchesQuery && matchesCountry && matchesPayment && matchesStatuses && matchesDropdownStatus;
        }
        if (activeSection === 'users') {
            const fName = (item.firstName || '').toLowerCase();
            const lName = (item.lastName || '').toLowerCase();
            const email = (item.email || '').toLowerCase();
            const roleMatch = userRoleFilter === 'all' ||
                (userRoleFilter === 'student' && (item.role === 'user' || item.role === 'student')) ||
                (userRoleFilter === 'bank' && item.role === 'bank') ||
                (userRoleFilter === 'staff' && (item.role === 'staff' || item.role === 'staff_admin')) ||
                (userRoleFilter === 'admin' && item.role?.includes('admin'));

            return roleMatch && (fName.includes(query) || lName.includes(query) || email.includes(query));
        }
        return true;
    });

    // Server-side pagination for applications (20 per page)
    const activePageSize = (activeSection === 'applications' || activeSection === 'incoming_queue') ? applicationsPerPage : itemsPerPage;
    const appsTotalItems = activeSection === 'applications' ? filteredData.length : totalItems;

    const pagedData = (activeSection === 'applications')
        ? filteredData.slice((currentPage - 1) * applicationsPerPage, currentPage * applicationsPerPage)
        : filteredData;

    const totalPages = (activeSection === 'applications' || activeSection === 'incoming_queue')
        ? Math.max(1, Math.ceil(appsTotalItems / applicationsPerPage))
        : Math.max(1, Math.ceil(totalItems / activePageSize));

    const showingStart = (activeSection === 'applications' || activeSection === 'incoming_queue')
        ? (appsTotalItems > 0 ? (currentPage - 1) * applicationsPerPage + 1 : 0)
        : ((currentPage - 1) * itemsPerPage + 1);

    const showingEnd = (activeSection === 'applications' || activeSection === 'incoming_queue')
        ? Math.min(currentPage * applicationsPerPage, appsTotalItems)
        : Math.min(currentPage * itemsPerPage, totalItems);


    // Auto-advance to next page when all applications on the current page are completed
    useEffect(() => {
        if ((activeSection === 'applications' || activeSection === 'incoming_queue') && pagedData.length > 0 && !loading) {
            const allCompleted = pagedData.every((item: any) => {
                const statusKey = (item.status || 'draft').toLowerCase();
                return ['approved', 'rejected', 'disbursed', 'cancelled', 'verified'].includes(statusKey);
            });
            if (allCompleted) {
                if (currentPage < totalPages) {
                    navigateToPage(currentPage + 1);
                }
            }
        }
    }, [pagedData, activeSection, currentPage, totalPages, loading, navigateToPage]);

    const statusColors: Record<string, string> = {
        pending: "bg-amber-100 text-amber-700 border-amber-200",
        submitted: "bg-blue-100 text-blue-700 border-blue-200",
        processing: "bg-blue-100 text-blue-700 border-blue-200",
        approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
        rejected: "bg-red-100 text-red-600 border-red-200",
        disbursed: "bg-purple-100 text-purple-700 border-purple-200",
        cancelled: "bg-gray-100 text-gray-600 border-gray-200",
        draft: "bg-gray-100 text-gray-500 border-gray-200",
        routed_multiparty: "bg-purple-100 text-purple-700 border-purple-200",
    };

    const pendingCount = Number(stats.apps?.statusStats?.pending || 0) + Number(stats.apps?.statusStats?.processing || 0);
    const approvedCount = Number(stats.apps?.statusStats?.approved || 0) + Number(stats.apps?.statusStats?.disbursed || 0);
    const rejectedCount = Number(stats.apps?.statusStats?.rejected || 0) + Number(stats.apps?.statusStats?.cancelled || 0);
    const totalApps = Number(stats.apps?.total ?? 0);
    const approvalRate = totalApps > 0 ? Math.round((approvedCount / totalApps) * 100) : 0;

    const sectionTitles: Record<string, string> = {
        overview: 'Dashboard',
        incoming_queue: 'Incoming Queue',
        applications: 'Active Pipeline',
        tasks: 'Action Items',
        performance: 'Performance',
        users: 'Bank & Staff Members',
        blogs: 'Editorial Content',
        community: 'Engagement Hub',
        communications: 'Outreach Center',
        my_profile: 'My Profile',
        chat_customer: 'Support Chat',
        onboarding: 'Applicant Onboarding',
    };

    const incomingQueueCount = Number(stats.apps?.statusStats?.submitted || 0);

    const navItems = [
        { section: "overview", icon: "dashboard", label: "Dashboard", badge: 0 },
        { section: "incoming_queue", icon: "move_to_inbox", label: "Incoming Queue", badge: incomingQueueCount },
        { section: "applications", icon: "description", label: "Active Pipeline", badge: pendingCount },
        { section: "users", icon: "people", label: "Bank & Staff Members", badge: 0 },
        { section: "performance", icon: "insights", label: "Performance", badge: 0 },
        { section: "tasks", icon: "check_circle", label: "Action Items", badge: tasks.filter(t => !t.completed).length },
        { section: "communications", icon: "mail", label: "Outreach Center", badge: 0 },
        { section: "calendar", icon: "calendar_month", label: "Deadline Calendar", badge: 0 },
        { section: "chat_customer", icon: "support_agent", label: "Support Chat", badge: unreadChatCount },
        { section: "my_profile", icon: "badge", label: "My Profile", badge: 0 },
    ];

    const renderRequirementRow = (
        doc: DocumentRequirement,
        personType: 'applicant' | 'father' | 'mother' | 'coapplicant',
        personName: string,
        employmentType?: string,
    ) => {
        const existingDoc = userDocuments.find((ud) => ud.docType === doc.type || ud.type === doc.type);
        const existingStatus = String(existingDoc?.status || "").toLowerCase();
        const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));
        const uploadKey = `${doc.type}-${personType}`;
        const inputKey = `${personType}-${doc.type}`;
        const isUploading = uploadingDocs[uploadKey] !== undefined;
        const tone = personType === "coapplicant" ? "violet" : personType === "applicant" ? "indigo" : "rose";
        const pendingClasses = tone === "violet"
            ? "bg-violet-50/50 border-violet-100"
            : tone === "indigo"
                ? "bg-slate-50 border-slate-200 hover:border-slate-300"
                : doc.required
                    ? "bg-red-50/50 border-red-100"
                    : "bg-amber-50/50 border-amber-100";
        const iconClasses = isUploaded
            ? "bg-white text-emerald-500 border border-emerald-100"
            : tone === "violet"
                ? "bg-white border-violet-200 text-violet-500"
                : tone === "indigo"
                    ? "bg-white border border-slate-200 text-slate-400"
                    : doc.required
                        ? "bg-white border-red-200 text-red-500"
                        : "bg-white border-amber-200 text-amber-500";

        return (
            <div key={`${personType}-${doc.type}`} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isUploaded ? 'bg-emerald-50/30 border-emerald-100 shadow-sm' : pendingClasses}`}>
                <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconClasses}`}>
                        <span className="material-symbols-outlined text-[20px]">{isUploaded ? 'task_alt' : doc.required ? 'exclamation' : 'info'}</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{doc.name}</h4>
                            {isUploaded ? (
                                <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded leading-none">In Profile</span>
                            ) : doc.required ? (
                                <span className={`px-1.5 py-0.5 ${tone === "violet" ? "bg-violet-500" : "bg-red-500"} text-white text-[8px] font-black uppercase tracking-widest rounded leading-none`}>Required</span>
                            ) : (
                                <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest rounded leading-none">Optional</span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">{doc.type.toUpperCase().replace(/_/g, ' ')} - PDF/JPG/PNG</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        ref={el => {
                            if (el) fileInputRefs.current[inputKey] = el;
                        }}
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                await handleDocumentUpload(file, doc.type, personType, personName, employmentType);
                                e.target.value = '';
                            }
                        }}
                        hidden
                    />
                    {isUploaded && (
                        <button
                            type="button"
                            onClick={() => viewFile(doc.type)}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                            Review
                        </button>
                    )}
                    <button
                        onClick={() => fileInputRefs.current[inputKey]?.click()}
                        disabled={isUploading}
                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[11px] font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined text-[16px]">
                            {isUploading ? 'hourglass_top' : 'upload'}
                        </span>
                        {isUploading ? `${Math.round(uploadingDocs[uploadKey])}%` : isUploaded ? 'Re-upload' : 'Upload'}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <>
            <div className="flex flex-col md:flex-row h-[calc(100vh-56px)] bg-slate-50 animate-in fade-in duration-500 overflow-hidden">
                {/* Header / Breadcrumbs & Stepper */}
                {/* LEFT SIDEBAR: Profile & Progress */}
                <div className="w-full md:w-[320px] bg-[#F8FAFC] border-b md:border-b-0 md:border-r border-slate-200 flex flex-col p-6 md:p-8 overflow-y-auto no-scrollbar shrink-0 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                    <div className="mb-8">
                        {onboardStep >= 2 ? (
                            <div className="space-y-6">
                                <div className="text-center">
                                    <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-600 text-white rounded-[32px] flex items-center justify-center mx-auto mb-4 text-3xl font-black shadow-xl shadow-emerald-500/20 rotate-3">
                                        {newStudent.firstName?.[0] || 'S'}
                                    </div>
                                    <h3 className="text-xl font-bold text-[#0d1b2a] leading-tight">{newStudent.firstName} {newStudent.lastName}</h3>
                                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Student Profile</p>
                                </div>

                                <div className="space-y-4 pt-6 border-t border-slate-100">
                                    <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                        <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                                            <span className="material-symbols-outlined text-[18px]">mail</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Email</p>
                                            <p className="text-[12px] font-bold text-slate-700 truncate">{newStudent.email || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                        <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                                            <span className="material-symbols-outlined text-[18px]">call</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Mobile</p>
                                            <p className="text-[12px] font-bold text-slate-700">{newStudent.mobile || '—'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                                        <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                                            <span className="material-symbols-outlined text-[18px]">cake</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Date of Birth</p>
                                            <p className="text-[12px] font-bold text-slate-700">{newStudent.dob || '—'}</p>
                                        </div>
                                    </div>
                                </div>

                                <button onClick={handleShareProfile} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-600/30 transition-all flex items-center justify-center gap-3">
                                    <span className="material-symbols-outlined text-[18px]">share</span>
                                    Share Profile Link
                                </button>
                            </div>
                        ) : (
                            <div className="py-12 text-center space-y-6 flex flex-col items-center">
                                <div className="relative w-40 h-40 flex items-center justify-center">
                                    {/* Animated background rings */}
                                    <div className="absolute inset-0 border-2 border-dashed border-indigo-100/60 rounded-full animate-[spin_40s_linear_infinite]" />
                                    <div className="absolute inset-4 border border-dashed border-slate-200 rounded-full animate-[spin_20s_linear_infinite_reverse]" />

                                    {/* Outer glowing blur */}
                                    <div className="absolute w-24 h-24 bg-gradient-to-tr from-indigo-500/10 to-emerald-500/10 rounded-full blur-xl animate-pulse" />

                                    {/* Center avatar card illustration */}
                                    <svg width="100" height="100" viewBox="0 0 100 100" fill="none" className="relative z-10 filter drop-shadow-[0_8px_16px_rgba(99,102,241,0.1)]">
                                        <rect x="15" y="10" width="70" height="80" rx="16" fill="white" stroke="#E2E8F0" strokeWidth="2" />
                                        <rect x="25" y="20" width="50" height="8" rx="4" fill="#F1F5F9" />
                                        <rect x="25" y="32" width="35" height="6" rx="3" fill="#F1F5F9" />

                                        {/* User Avatar Circle */}
                                        <circle cx="50" cy="58" r="16" fill="url(#avatar-grad)" />
                                        <mask id="avatar-mask">
                                            <circle cx="50" cy="58" r="16" fill="white" />
                                        </mask>
                                        <g mask="url(#avatar-mask)">
                                            <circle cx="50" cy="53" r="6" fill="white" />
                                            <path d="M34 68 C34 61.3726 39.3726 59 46 59 H54 C60.6274 59 66 61.3726 66 68 V74 H34 V68 Z" fill="white" />
                                        </g>

                                        {/* Plus badge */}
                                        <circle cx="72" cy="24" r="12" fill="#10B981" className="animate-bounce" style={{ animationDuration: '3s' }} />
                                        <path d="M72 19V29M67 24H77" stroke="white" strokeWidth="2" strokeLinecap="round" />

                                        <defs>
                                            <linearGradient id="avatar-grad" x1="34" y1="42" x2="66" y2="74" gradientUnits="userSpaceOnUse">
                                                <stop stopColor="#6366F1" />
                                                <stop offset="1" stopColor="#4F46E5" />
                                            </linearGradient>
                                        </defs>
                                    </svg>

                                    {/* Small floating elements */}
                                    <div className="absolute top-2 left-6 w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.5s', animationDuration: '2.5s' }} />
                                    <div className="absolute bottom-6 right-6 w-3.5 h-3.5 bg-indigo-100 rounded-lg rotate-12 animate-[spin_10s_linear_infinite]" />
                                </div>
                                <div className="space-y-2 max-w-[240px]">
                                    <h4 className="text-[12px] font-bold text-slate-800">Add Applicant Profile</h4>
                                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                        Register a student to unlock the full onboarding profile and document management.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-8 flex-1">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Onboarding Progress</h4>
                        <div className="space-y-0 relative pl-4">
                            {/* Dotted line track */}
                            <div className="absolute left-[27px] top-6 bottom-6 w-[2px] border-l-2 border-dashed border-slate-200 z-0" />

                            {[
                                { id: 1, label: 'Registration', description: 'Enter basic applicant info' },
                                { id: 2, label: 'Profile Details', description: 'Fill out full profile forms' },
                                { id: 3, label: 'Document Vault', description: 'Upload KYC & academic documents' },
                                { id: 4, label: 'Distribution', description: 'Share or match with banks' },
                            ].map((step) => {
                                const isCompleted = onboardStep > step.id;
                                const isActive = onboardStep === step.id;
                                const isUpcoming = onboardStep < step.id;

                                return (
                                    <button
                                        key={step.id}
                                        type="button"
                                        disabled={!createdUser || step.id === 1 || step.id === 4}
                                        onClick={() => setOnboardStep(step.id as any)}
                                        className={`relative w-full text-left flex items-start gap-4 py-3 group/step ${(!createdUser || step.id === 1 || step.id === 4) ? 'cursor-default' : 'cursor-pointer'}`}
                                    >
                                        {/* Dot indicator column */}
                                        <div className="flex flex-col items-center relative z-10">
                                            {isCompleted ? (
                                                <div className="w-[26px] h-[26px] rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                                                    <span className="material-symbols-outlined text-[14px] font-black">check</span>
                                                </div>
                                            ) : isActive ? (
                                                <div className="w-[26px] h-[26px] rounded-full bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/35 border-4 border-indigo-100">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                                </div>
                                            ) : (
                                                <div className="w-[26px] h-[26px] rounded-full border-2 border-dashed border-slate-300 bg-white" />
                                            )}
                                        </div>

                                        {/* Text details */}
                                        <div className="min-w-0 flex-1 -mt-0.5">
                                            <h5 className={`text-[12px] font-bold tracking-wide uppercase transition-colors ${isActive ? 'text-indigo-600 font-extrabold' : isCompleted ? 'text-emerald-700' : 'text-slate-500'
                                                }`}>
                                                {step.label}
                                            </h5>
                                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                {step.description}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* MAIN CONTENT AREA */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    {onboardStep >= 2 && (
                        <div className="bg-white border-b border-slate-200 px-10 py-0 flex items-center justify-between overflow-x-auto no-scrollbar shrink-0">
                            <div className="flex items-center gap-10">
                                {[
                                    { id: 'personal', label: 'Personal', icon: 'person' },
                                    { id: 'academic', label: 'Academic', icon: 'school' },
                                    { id: 'loan', label: 'Loan Details', icon: 'account_balance' },
                                    { id: 'work', label: 'Work Experience', icon: 'work' },
                                    { id: 'tests', label: 'Test Scores', icon: 'terminal' },
                                    { id: 'family', label: 'Family & Co-applicant', icon: 'family_restroom' },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => {
                                            setProfileTab(tab.id as any);
                                        }}
                                        className={`py-5 flex items-center gap-2 border-b-2 transition-all shrink-0 group ${profileTab === tab.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <span className={`material-symbols-outlined text-[18px] ${profileTab === tab.id ? 'text-indigo-600' : 'text-slate-300 group-hover:text-slate-400'}`}>{tab.icon}</span>
                                        <span className="text-[11px] font-bold font-['Playfair_Display',serif] uppercase tracking-widest">{tab.label}</span>
                                    </button>
                                ))}
                            </div>
                            {/* <button
                                            type="button"
                                            onClick={() => handleSaveProfile(false)}
                                            disabled={createLoading}
                                            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-md shadow-emerald-600/10 shrink-0 my-3 hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                                            {createLoading ? 'Saving...' : 'Save to Database'}
                                        </button> */}
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-8 relative">
                        {onboardStep === 1 ? (
                            /* STEP 1: Registration */
                            <div className="max-w-2xl mx-auto py-12">
                                <div className="bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-100 p-12 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full opacity-30 pointer-events-none" />

                                    <div className="relative z-10 text-center mb-10">
                                        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner transition-all duration-500 ${onboardMode === 'new' ? 'bg-emerald-50 text-emerald-600 rotate-0' : 'bg-indigo-50 text-indigo-600 rotate-12'}`}>
                                            <span className="material-symbols-outlined text-[40px]">{onboardMode === 'new' ? 'person_add' : 'link'}</span>
                                        </div>
                                        <h2 className="text-3xl font-bold font-['Playfair_Display',serif] text-slate-900 tracking-tight">Onboarding Entry</h2>

                                        {/* Pill segment controller */}
                                        <div className="inline-flex p-1 bg-slate-100 rounded-xl relative max-w-sm mx-auto w-full mt-6">
                                            <button
                                                type="button"
                                                onClick={() => setOnboardMode('new')}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all relative z-10 ${onboardMode === 'new' ? 'bg-white text-[#0d1b2a] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                            >
                                                <span className="material-symbols-outlined text-[16px]">person_add</span>
                                                Register New
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setOnboardMode('link')}
                                                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all relative z-10 ${onboardMode === 'link' ? 'bg-white text-[#0d1b2a] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                                            >
                                                <span className="material-symbols-outlined text-[16px]">link</span>
                                                Link Existing
                                            </button>
                                        </div>
                                    </div>

                                    {onboardMode === 'new' ? (
                                        <form id="quick-register-form" onSubmit={handleQuickRegister} className="space-y-6">
                                            {/* Equalized 2x2 Form Row Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* First Name */}
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center ml-1">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">First Name*</label>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            required
                                                            type="text"
                                                            value={quickForm.firstName}
                                                            onChange={e => setQuickForm({ ...quickForm, firstName: e.target.value.replace(/[^A-Za-z]/g, "") })}
                                                            className={`w-full pl-6 pr-10 py-4 bg-slate-50 border rounded-2xl text-[14px] focus:outline-none focus:ring-4 transition-all font-bold ${quickForm.firstName.trim().length >= 3
                                                                ? 'border-emerald-500 focus:ring-emerald-500/10 focus:border-emerald-500'
                                                                : 'border-slate-200 focus:ring-indigo-500/10 focus:border-indigo-500'
                                                                }`}
                                                            placeholder="Rahul"
                                                        />
                                                        {quickForm.firstName.trim().length >= 3 && (
                                                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 text-[18px] font-bold animate-in fade-in zoom-in-50 duration-200">check_circle</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Last Name */}
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center ml-1">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Last Name*</label>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            required
                                                            type="text"
                                                            value={quickForm.lastName}
                                                            onChange={e => setQuickForm({ ...quickForm, lastName: e.target.value.replace(/[^A-Za-z]/g, "") })}
                                                            className={`w-full pl-6 pr-10 py-4 bg-slate-50 border rounded-2xl text-[14px] focus:outline-none focus:ring-4 transition-all font-bold ${quickForm.lastName.trim().length >= 1
                                                                ? 'border-emerald-500 focus:ring-emerald-500/10 focus:border-emerald-500'
                                                                : 'border-slate-200 focus:ring-indigo-500/10 focus:border-indigo-500'
                                                                }`}
                                                            placeholder="Sharma"
                                                        />
                                                        {quickForm.lastName.trim().length >= 1 && (
                                                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 text-[18px] font-bold animate-in fade-in zoom-in-50 duration-200">check_circle</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Email */}
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center ml-1">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address*</label>
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            required
                                                            type="email"
                                                            value={quickForm.email}
                                                            onChange={e => setQuickForm({ ...quickForm, email: e.target.value })}
                                                            className={`w-full pl-6 pr-10 py-4 bg-slate-50 border rounded-2xl text-[14px] focus:outline-none focus:ring-4 transition-all font-bold ${/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quickForm.email)
                                                                ? 'border-emerald-500 focus:ring-emerald-500/10 focus:border-emerald-500'
                                                                : 'border-slate-200 focus:ring-indigo-500/10 focus:border-indigo-500'
                                                                }`}
                                                            placeholder="rahul@example.com"
                                                        />
                                                        {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quickForm.email) && (
                                                            <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 text-[18px] font-bold animate-in fade-in zoom-in-50 duration-200">check_circle</span>
                                                        )}
                                                    </div>
                                                    {quickForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quickForm.email) && (
                                                        <p className="text-[10px] text-rose-500 font-semibold mt-1 ml-1 animate-in fade-in duration-200">Please enter a valid email format</p>
                                                    )}
                                                </div>

                                                {/* Mobile Number */}
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center ml-1">
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mobile Number*</label>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <div className="px-4 py-4 bg-slate-100 border border-slate-200 rounded-2xl text-[13px] flex items-center gap-1.5 font-bold text-slate-600 shadow-inner">🇮🇳 +91</div>
                                                        <div className="relative flex-1">
                                                            <input
                                                                required
                                                                type="tel"
                                                                value={quickForm.phone}
                                                                onChange={e => setQuickForm({ ...quickForm, phone: formatPhone(e.target.value) })}
                                                                className={`w-full pl-6 pr-10 py-4 bg-slate-50 border rounded-2xl text-[14px] focus:outline-none focus:ring-4 transition-all font-bold ${isPhoneValid(quickForm.phone)
                                                                    ? 'border-emerald-500 focus:ring-emerald-500/10 focus:border-emerald-500'
                                                                    : 'border-slate-200 focus:ring-indigo-500/10 focus:border-indigo-500'
                                                                    }`}
                                                                placeholder="9876543210"
                                                                maxLength={10}
                                                            />
                                                            {isPhoneValid(quickForm.phone) && (
                                                                <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 text-[18px] font-bold animate-in fade-in zoom-in-50 duration-200">check_circle</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {quickForm.phone && !isPhoneValid(quickForm.phone) && (
                                                        <p className="text-[10px] text-rose-500 font-semibold mt-1 ml-1 animate-in fade-in duration-200">
                                                            {quickForm.phone.length !== 10
                                                                ? "Must be exactly 10 digits"
                                                                : !/^[6-9]/.test(quickForm.phone)
                                                                    ? "Must start with 6, 7, 8, or 9"
                                                                    : "Please enter a valid mobile number"}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Centered Action Buttons */}
                                            <div className="flex items-center justify-center gap-4 pt-6 border-t border-slate-100">
                                                <button
                                                    type="button"
                                                    onClick={resetOnboardModal}
                                                    className="px-8 py-4 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-2xl font-bold text-[11px] uppercase tracking-wider transition-all"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={createLoading}
                                                    className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-[11px] uppercase tracking-wider hover:shadow-lg hover:shadow-emerald-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                                                >
                                                    {createLoading ? 'Syncing...' : 'Register Applicant'}
                                                    {!createLoading && <span className="material-symbols-outlined text-[16px]">arrow_forward</span>}
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <form id="link-existing-form" onSubmit={handleCheckEmailAndLink} className="space-y-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Student Email Address</label>
                                                <div className="relative">
                                                    <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-400">mail</span>
                                                    <input required type="email" value={userSearchQuery} onChange={e => setUserSearchQuery(e.target.value)} placeholder="Enter student email..." className="w-full pl-14 pr-12 py-5 bg-slate-50 border border-slate-200 rounded-2xl text-[14px] focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-bold" />
                                                    {isSearchingSuggestions && (
                                                        <div className="absolute right-5 top-1/2 -translate-y-1/2">
                                                            <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                                        </div>
                                                    )}

                                                    {/* Suggestions Dropdown */}
                                                    {userSuggestions.length > 0 && (
                                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-100 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                                            {userSuggestions.map((u: any) => (
                                                                <button
                                                                    key={u.id || u._id}
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setUserSearchQuery(u.email);
                                                                        setUserSuggestions([]);
                                                                        // Link immediately when clicking a suggestion
                                                                        handleLinkExistingUser(u);
                                                                    }}
                                                                    className="w-full flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                                                                >
                                                                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[12px] shrink-0 uppercase">
                                                                        {u.firstName?.[0] || '?'}{u.lastName?.[0] || ''}
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-[13px] font-bold text-[#0d1b2a] truncate">{u.firstName} {u.lastName}</p>
                                                                        <p className="text-[11px] text-slate-500 truncate">{u.email}</p>
                                                                    </div>
                                                                    <span className="material-symbols-outlined text-slate-300 text-[18px]">chevron_right</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Centered Action Buttons */}
                                            <div className="flex items-center justify-center gap-4 pt-6 border-t border-slate-100">
                                                <button
                                                    type="button"
                                                    onClick={resetOnboardModal}
                                                    className="px-8 py-4 border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-2xl font-bold text-[11px] uppercase tracking-wider transition-all"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={isSearchingUsers}
                                                    className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-[11px] uppercase tracking-wider hover:shadow-lg hover:shadow-indigo-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                                                >
                                                    {isSearchingUsers ? 'Searching...' : 'Check & Link Account'}
                                                    {!isSearchingUsers && <span className="material-symbols-outlined text-[20px]">link</span>}
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </div>
                            </div>
                        ) : onboardStep === 2 ? (
                            /* STEP 2: Full Profile */
                            <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-500">
                                {profileTab === 'personal' && (
                                    <form id="profile-personal-form" onSubmit={handleSaveProfile} className="space-y-10">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-2xl font-bold font-['Playfair_Display',serif] text-slate-900 tracking-tight">Personal Details</h3>
                                                <p className="text-slate-500 text-sm font-medium mt-1">Provide core identification and contact information.</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <button type="button" onClick={() => handleSaveProfile(false)} disabled={createLoading} className="px-6 py-3 bg-white border border-slate-200 text-slate-900 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
                                                    {createLoading ? 'Saving...' : 'Sync with DB'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* AI Autofill Banner */}
                                        <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-100 rounded-3xl p-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 space-y-4">
                                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0 animate-pulse">
                                                        <span className="material-symbols-outlined text-[24px]">magic_button</span>
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                                            Autofill Profile with Premium AI OCR
                                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[9px] font-black uppercase tracking-wider">Manual apply</span>
                                                        </h4>
                                                        <p className="text-xs text-slate-500 font-medium mt-0.5">Upload identity documents to extract data, then use Autofill in Document Vault to populate profile fields.</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Hidden File Inputs for each document type to avoid state closure race conditions */}
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                ref={el => {
                                                    if (el) fileInputRefs.current[`quick-ocr-national_id`] = el;
                                                }}
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        console.log(`[QUICK OCR] Selected ${file.name} for Aadhaar`);
                                                        await handleDocumentUpload(
                                                            file,
                                                            'national_id',
                                                            'applicant',
                                                            newStudent.firstName + ' ' + newStudent.lastName
                                                        );
                                                        e.target.value = '';
                                                    }
                                                }}
                                                hidden
                                            />
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                ref={el => {
                                                    if (el) fileInputRefs.current[`quick-ocr-pan`] = el;
                                                }}
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        console.log(`[QUICK OCR] Selected ${file.name} for PAN`);
                                                        await handleDocumentUpload(
                                                            file,
                                                            'pan',
                                                            'applicant',
                                                            newStudent.firstName + ' ' + newStudent.lastName
                                                        );
                                                        e.target.value = '';
                                                    }
                                                }}
                                                hidden
                                            />
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                ref={el => {
                                                    if (el) fileInputRefs.current[`quick-ocr-passport`] = el;
                                                }}
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        console.log(`[QUICK OCR] Selected ${file.name} for Passport`);
                                                        await handleDocumentUpload(
                                                            file,
                                                            'passport',
                                                            'applicant',
                                                            newStudent.firstName + ' ' + newStudent.lastName
                                                        );
                                                        e.target.value = '';
                                                    }
                                                }}
                                                hidden
                                            />

                                            <div className="flex flex-wrap gap-3 pt-2">
                                                {[
                                                    { type: 'national_id', name: 'National Identity Card (Aadhaar)', label: 'Aadhaar Card', icon: 'badge', color: 'text-indigo-500' },
                                                    { type: 'pan', name: 'Permanent Account Number (PAN)', label: 'PAN Card', icon: 'credit_card', color: 'text-amber-500' },
                                                    { type: 'passport', name: 'Passport', label: 'Passport', icon: 'menu_book', color: 'text-purple-500' }
                                                ].map((btn) => {
                                                    const uploadKey = `${btn.type}-applicant`;
                                                    const isUploading = uploadingDocs[uploadKey] !== undefined;
                                                    const progress = uploadingDocs[uploadKey] ?? 0;

                                                    return (
                                                        <button
                                                            key={btn.type}
                                                            type="button"
                                                            disabled={isUploading}
                                                            onClick={() => {
                                                                setSelectedDocType(btn.type);
                                                                setSelectedDocName(btn.name);
                                                                setSelectedDocCategory('applicant');
                                                                setOnboardStep(3);
                                                                setIsUploadModalOpen(true);
                                                            }}
                                                            className={`px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 hover:border-indigo-355 hover:shadow-sm disabled:opacity-75`}
                                                        >
                                                            {isUploading ? (
                                                                <>
                                                                    <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                                                    <span>Uploading ({Math.round(progress)}%)</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className={`material-symbols-outlined ${btn.color} text-[18px]`}>{btn.icon}</span>
                                                                    <span>Upload {btn.label}</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* {Object.entries(uploadMessages)
                                                            .filter(([key]) => key.endsWith('-applicant'))
                                                            .map(([key, msg]) => (
                                                                <div
                                                                    key={key}
                                                                    className={`rounded-xl px-4 py-3 text-xs font-bold border ${msg.type === 'success'
                                                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                                        : msg.type === 'warning'
                                                                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                                                        }`}
                                                                >
                                                                    {msg.text}
                                                                </div>
                                                            ))} */}
                                        </div>

                                        {/* OCR Results Display Card */}
                                        {/* {Object.keys(ocrResults).length > 0 && Object.entries(ocrResults).map(([key, fields]: any) => {
                                                        const [docType] = key.split('-');
                                                        return (
                                                            <div key={key} className="bg-gradient-to-r from-emerald-50 via-emerald-50/50 to-transparent border-2 border-emerald-200 rounded-3xl p-6 shadow-lg shadow-emerald-100/50 animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-10 h-10 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                                                            <span className="material-symbols-outlined text-[20px]">verified_user</span>
                                                                        </div>
                                                                        <div>
                                                                            <h4 className="text-sm font-bold text-emerald-900">✨ OCR Data Successfully Extracted & Attached</h4>
                                                                            <p className="text-xs text-emerald-700 font-medium mt-0.5">{docType.replace(/_/g, ' ').toUpperCase()} extracted — use Autofill in Document Vault to apply</p>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowOcrReview(prev => ({ ...prev, [key]: !prev[key] }))}
                                                                        className="px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 rounded-lg transition-all"
                                                                    >
                                                                        {showOcrReview[key] ? '▼ Hide' : '▶ Show'} Details
                                                                    </button>
                                                                </div>

                                                                {showOcrReview[key] && (
                                                                    <div className="bg-white rounded-2xl p-4 mt-3 border border-emerald-100">
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                            {Object.entries(fields)
                                                                                .filter(([_, v]) => v != null && (typeof v === 'object' ? Object.keys(v).length > 0 : String(v).trim()))
                                                                                .flatMap(([fieldName, fieldValue]: any) => {
                                                                                    if (fieldName === 'address' && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
                                                                                        return Object.entries(fieldValue)
                                                                                            .filter(([, v]) => v && String(v).trim())
                                                                                            .map(([subKey, subVal]) => (
                                                                                                <div key={`${fieldName}-${subKey}`} className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-100">
                                                                                                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">{subKey.replace(/_/g, ' ')}</p>
                                                                                                    <p className="text-sm font-semibold text-slate-800 break-words">{String(subVal)}</p>
                                                                                                </div>
                                                                                            ));
                                                                                    }
                                                                                    return [(
                                                                                        <div key={fieldName} className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-100">
                                                                                            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">{fieldName.replace(/_/g, ' ')}</p>
                                                                                            <p className="text-sm font-semibold text-slate-800 break-words">{typeof fieldValue === 'object' ? JSON.stringify(fieldValue) : String(fieldValue)}</p>
                                                                                        </div>
                                                                                    )];
                                                                                })
                                                                            }
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })} */}

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            {/* ... (rest of personal tab content) */}
                                            {/* I'll use targetContent for the rest below to keep it clean */}
                                            <div className="space-y-8">
                                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-[18px]">badge</span>
                                                        </div>
                                                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900">Legal Name</h4>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">First Name*</label>
                                                            <input type="text" value={newStudent.firstName} onChange={e => setNewStudent({ ...newStudent, firstName: e.target.value })} onBlur={() => handleSaveProfile(true)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Last Name*</label>
                                                            <input type="text" value={newStudent.lastName} onChange={e => setNewStudent({ ...newStudent, lastName: e.target.value })} onBlur={() => handleSaveProfile(true)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-[18px]">contact_phone</span>
                                                        </div>
                                                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900">Contact Details</h4>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Mobile Number*</label>
                                                            <input type="tel" value={newStudent.mobile} onChange={e => setNewStudent({ ...newStudent, mobile: formatPhone(e.target.value) })} onBlur={() => handleSaveProfile(true)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" maxLength={10} />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Email Address*</label>
                                                            <input type="email" value={newStudent.email} onChange={e => setNewStudent({ ...newStudent, email: e.target.value })} onBlur={() => handleSaveProfile(true)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-8">
                                                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-8 h-8 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-[18px]">cake</span>
                                                        </div>
                                                        <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-900">Personal Attributes</h4>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Date of Birth*</label>
                                                            <input type="date" value={newStudent.dob} onChange={e => setNewStudent({ ...newStudent, dob: e.target.value })} onBlur={() => handleSaveProfile(true)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Gender*</label>
                                                                <select value={newStudent.gender} onChange={e => { setNewStudent({ ...newStudent, gender: e.target.value }); handleSaveProfile(true); }} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none">
                                                                    <option value="">Select</option>
                                                                    <option value="male">Male</option>
                                                                    <option value="female">Female</option>
                                                                    <option value="other">Other</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Marital Status*</label>
                                                                <select value={newStudent.maritalStatus} onChange={e => { setNewStudent({ ...newStudent, maritalStatus: e.target.value }); handleSaveProfile(true); }} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none">
                                                                    <option value="">Select</option>
                                                                    <option value="single">Single</option>
                                                                    <option value="married">Married</option>
                                                                    <option value="divorced">Divorced</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">PAN Card*</label>
                                                                <input type="text" value={newStudent.pan} onChange={e => setNewStudent({ ...newStudent, pan: formatPan(e.target.value) })} onBlur={() => handleSaveProfile(true)} className={`w-full px-5 py-3.5 bg-slate-50 border ${newStudent.pan && !isPanValid(newStudent.pan) ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all`} placeholder="PAN Number" style={{ textTransform: 'uppercase' }} maxLength={10} />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Aadhaar Card*</label>
                                                                <input type="text" value={newStudent.aadhaarNumber || ""} onChange={e => setNewStudent({ ...newStudent, aadhaarNumber: e.target.value.replace(/\D/g, '') })} onBlur={() => handleSaveProfile(true)} className={`w-full px-5 py-3.5 bg-slate-50 border ${newStudent.aadhaarNumber && !isAadharValid(newStudent.aadhaarNumber) ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-indigo-500'} rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all`} placeholder="Aadhaar Number" maxLength={12} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-indigo-900 rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-900/20">
                                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full" />
                                                    <div className="relative z-10">
                                                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                                                            <span className="material-symbols-outlined text-[24px]">verified_user</span>
                                                        </div>
                                                        <h4 className="text-xl font-black mb-2 leading-tight">Secure Record</h4>
                                                        <p className="text-[12px] font-medium text-indigo-200 leading-relaxed">This data is encrypted and synced directly with our core application system to ensure seamless processing.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="h-px bg-slate-100 my-8"></div>

                                        <section>
                                            <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">mail</span>
                                                Mailing Address
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Address 1*</label>
                                                    <input type="text" value={newStudent.mailingAddress.address1} onChange={e => setNewStudent({ ...newStudent, mailingAddress: { ...newStudent.mailingAddress, address1: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Address" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Address 2</label>
                                                    <input type="text" value={newStudent.mailingAddress.address2} onChange={e => setNewStudent({ ...newStudent, mailingAddress: { ...newStudent.mailingAddress, address2: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Address" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Country*</label>
                                                    <select value={newStudent.mailingAddress.country} onChange={e => { setNewStudent({ ...newStudent, mailingAddress: { ...newStudent.mailingAddress, country: e.target.value, state: "" } }); handleSaveProfile(); }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                        <option value="">Select Country</option>
                                                        {getAllCountries().map(country => (
                                                            <option key={country} value={country}>{country}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">State*</label>
                                                    <select value={newStudent.mailingAddress.state} onChange={e => { setNewStudent({ ...newStudent, mailingAddress: { ...newStudent.mailingAddress, state: e.target.value } }); handleSaveProfile(); }} disabled={!newStudent.mailingAddress.country} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                                        <option value="">Select State</option>
                                                        {newStudent.mailingAddress.country && getStatesByCountry(newStudent.mailingAddress.country).map(state => (
                                                            <option key={state} value={state}>{state}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">City*</label>
                                                    <input type="text" value={newStudent.mailingAddress.city} onChange={e => setNewStudent({ ...newStudent, mailingAddress: { ...newStudent.mailingAddress, city: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter City" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Pincode*</label>
                                                    <input type="text" value={newStudent.mailingAddress.pincode} onChange={e => setNewStudent({ ...newStudent, mailingAddress: { ...newStudent.mailingAddress, pincode: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Pincode" />
                                                </div>
                                            </div>
                                        </section>

                                        <div className="h-px bg-slate-100 my-8"></div>

                                        <section>
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                                                    <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">location_on</span>
                                                    Permanent Address
                                                </div>
                                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setNewStudent({ ...newStudent, permanentAddress: { ...newStudent.mailingAddress } });
                                                                handleSaveProfile();
                                                            }
                                                        }}
                                                        className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                                                    />
                                                    Same as mailing address
                                                </label>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Address 1*</label>
                                                    <input type="text" value={newStudent.permanentAddress.address1} onChange={e => setNewStudent({ ...newStudent, permanentAddress: { ...newStudent.permanentAddress, address1: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Address" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Address 2</label>
                                                    <input type="text" value={newStudent.permanentAddress.address2} onChange={e => setNewStudent({ ...newStudent, permanentAddress: { ...newStudent.permanentAddress, address2: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Address" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Country*</label>
                                                    <select value={newStudent.permanentAddress.country} onChange={e => { setNewStudent({ ...newStudent, permanentAddress: { ...newStudent.permanentAddress, country: e.target.value, state: "" } }); handleSaveProfile(); }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                        <option value="">Select Country</option>
                                                        {getAllCountries().map(country => (
                                                            <option key={country} value={country}>{country}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">State*</label>
                                                    <select value={newStudent.permanentAddress.state} onChange={e => { setNewStudent({ ...newStudent, permanentAddress: { ...newStudent.permanentAddress, state: e.target.value } }); handleSaveProfile(); }} disabled={!newStudent.permanentAddress.country} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                                        <option value="">Select State</option>
                                                        {newStudent.permanentAddress.country && getStatesByCountry(newStudent.permanentAddress.country).map(state => (
                                                            <option key={state} value={state}>{state}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">City*</label>
                                                    <input type="text" value={newStudent.permanentAddress.city} onChange={e => setNewStudent({ ...newStudent, permanentAddress: { ...newStudent.permanentAddress, city: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter City" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Pincode*</label>
                                                    <input type="text" value={newStudent.permanentAddress.pincode} onChange={e => setNewStudent({ ...newStudent, permanentAddress: { ...newStudent.permanentAddress, pincode: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Pincode" />
                                                </div>
                                            </div>
                                        </section>

                                        <div className="h-px bg-slate-100 my-8"></div>

                                        <section>
                                            <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">badge</span>
                                                Passport Information
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Passport Number*</label>
                                                    <input type="text" value={newStudent.passport.number} onChange={e => setNewStudent({ ...newStudent, passport: { ...newStudent.passport, number: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Number" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Issue Date*</label>
                                                    <input type="date" value={newStudent.passport.issueDate} onChange={e => setNewStudent({ ...newStudent, passport: { ...newStudent.passport, issueDate: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-600" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Expiry Date*</label>
                                                    <input type="date" value={newStudent.passport.expiryDate} onChange={e => setNewStudent({ ...newStudent, passport: { ...newStudent.passport, expiryDate: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-600" />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Issue Country*</label>
                                                    <select value={newStudent.passport.issueCountry} onChange={e => { setNewStudent({ ...newStudent, passport: { ...newStudent.passport, issueCountry: e.target.value } }); handleSaveProfile(); }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"><option value="">Select Issue Country</option>{getAllCountries().map(country => (<option key={`issue-${country}`} value={country}>{country}</option>))}</select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">City of Birth*</label>
                                                    <input type="text" value={newStudent.passport.birthCity} onChange={e => setNewStudent({ ...newStudent, passport: { ...newStudent.passport, birthCity: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter City" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Country of Birth*</label>
                                                    <select value={newStudent.passport.birthCountry} onChange={e => { setNewStudent({ ...newStudent, passport: { ...newStudent.passport, birthCountry: e.target.value } }); handleSaveProfile(); }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"><option value="">Select Country of Birth</option>{getAllCountries().map(country => (<option key={`birth-${country}`} value={country}>{country}</option>))}</select>
                                                </div>
                                            </div>
                                        </section>

                                        <div className="h-px bg-slate-100 my-8"></div>

                                        <section>
                                            <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">public</span>
                                                Nationality
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Nationality*</label>
                                                    <select value={newStudent.nationality.name} onChange={e => { setNewStudent({ ...newStudent, nationality: { ...newStudent.nationality, name: e.target.value } }); handleSaveProfile(); }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"><option value="">Select Nationality</option><option value="Indian">Indian</option><option value="American">American</option></select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Citizenship*</label>
                                                    <select value={newStudent.nationality.citizenship} onChange={e => { setNewStudent({ ...newStudent, nationality: { ...newStudent.nationality, citizenship: e.target.value } }); handleSaveProfile(); }} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"><option value="">Select Citizenship</option><option value="India">India</option><option value="USA">USA</option></select>
                                                </div>
                                            </div>
                                        </section>

                                        <div className="h-px bg-slate-100 my-8"></div>

                                        <section>
                                            <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">contact_emergency</span>
                                                Emergency Contacts
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Name*</label>
                                                    <input type="text" value={newStudent.emergencyContact.name} onChange={e => setNewStudent({ ...newStudent, emergencyContact: { ...newStudent.emergencyContact, name: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Name" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Phone*</label>
                                                    <div className="flex gap-2 mb-2">
                                                        <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm flex items-center gap-2">🇮🇳 +91</div>
                                                        <input type="tel" value={newStudent.emergencyContact.phone} onChange={e => setNewStudent({ ...newStudent, emergencyContact: { ...newStudent.emergencyContact, phone: formatPhone(e.target.value) } })} onBlur={() => handleSaveProfile()} className={`flex-1 px-4 py-3 bg-slate-50 border ${newStudent.emergencyContact.phone && !isPhoneValid(newStudent.emergencyContact.phone) ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-emerald-500'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium`} placeholder="Mobile Number" maxLength={10} />
                                                    </div>
                                                    {newStudent.emergencyContact.phone && !isPhoneValid(newStudent.emergencyContact.phone) && (
                                                        <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-rose-600 text-sm">error</span>
                                                            <span className="text-rose-600 text-xs font-medium">
                                                                {newStudent.emergencyContact.phone.length < 10
                                                                    ? "Phone number must be 10 digits"
                                                                    : newStudent.emergencyContact.phone[0] < '6'
                                                                        ? "Phone number must start with 6, 7, 8, or 9"
                                                                        : "This phone number is not realistic"}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Email*</label>
                                                    <input type="email" value={newStudent.emergencyContact.email} onChange={e => setNewStudent({ ...newStudent, emergencyContact: { ...newStudent.emergencyContact, email: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Email Address" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Relation with Applicant*</label>
                                                    <input type="text" value={newStudent.emergencyContact.relation} onChange={e => setNewStudent({ ...newStudent, emergencyContact: { ...newStudent.emergencyContact, relation: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Relation" />
                                                </div>
                                            </div>
                                        </section>

                                        <div className="h-px bg-slate-100 my-8"></div>

                                        <div className="pt-10 flex justify-end">
                                            <button type="button" onClick={() => setProfileTab('academic')} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-800 transition-all flex items-center gap-3 shadow-xl shadow-slate-900/20">
                                                Academic Qualifications
                                                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                                            </button>
                                        </div>
                                    </form>
                                )}

                                {profileTab === 'academic' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200"
                                    >
                                        {/* Academic AI OCR Autofill */}
                                        <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border border-emerald-100 rounded-3xl p-6 shadow-sm space-y-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20 shrink-0">
                                                    <span className="material-symbols-outlined text-[24px]">auto_stories</span>
                                                </div>
                                                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }}>
                                                    <h4 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                                        Autofill Academic Qualifications with AI OCR
                                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[9px] font-black uppercase tracking-wider">Auto apply</span>
                                                    </h4>
                                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                                        Upload marksheets to verify OCR and automatically populate academic qualification fields.
                                                    </p>
                                                </motion.div>
                                            </div>

                                            {(['marksheet_10', 'marksheet_12', 'marksheet_ug', 'marksheet_pg'] as const).map((docType) => (
                                                <input
                                                    key={docType}
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                    ref={el => {
                                                        if (el) fileInputRefs.current[`quick-ocr-${docType}`] = el;
                                                    }}
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            await handleDocumentUpload(
                                                                file,
                                                                docType,
                                                                'applicant',
                                                                `${newStudent.firstName} ${newStudent.lastName}`.trim() || 'Applicant',
                                                            );
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                    hidden
                                                />
                                            ))}

                                            <div className="flex flex-wrap gap-3 pt-1">
                                                {([
                                                    { type: 'marksheet_10', label: '10th / SSC', icon: 'school', color: 'text-blue-600', levels: ['Grade 10', 'Grade 12', 'Undergraduate', 'Postgraduate'] },
                                                    { type: 'marksheet_12', label: '12th / Intermediate', icon: 'menu_book', color: 'text-indigo-600', levels: ['Grade 12', 'Undergraduate', 'Postgraduate'] },
                                                    { type: 'marksheet_ug', label: 'Undergraduate', icon: 'history_edu', color: 'text-violet-600', levels: ['Undergraduate', 'Postgraduate'] },
                                                    { type: 'marksheet_pg', label: 'Postgraduate', icon: 'workspace_premium', color: 'text-amber-600', levels: ['Postgraduate'] },
                                                ] as const).map((btn) => {
                                                    const hl = newStudent.academic.highestLevel;
                                                    const isRelevant = !hl || (btn.levels as readonly string[]).includes(hl);
                                                    const uploadKey = `${btn.type}-applicant`;
                                                    const isUploading = uploadingDocs[uploadKey] !== undefined;
                                                    const progress = uploadingDocs[uploadKey] ?? 0;

                                                    return (
                                                        <button
                                                            key={btn.type}
                                                            type="button"
                                                            disabled={isUploading || !isRelevant}
                                                            title={!isRelevant ? 'Set Highest Level of Education to enable' : undefined}
                                                            onClick={() => {
                                                                if (!createdUser?.id && !createdUser?.uid && !createdUser?._id) {
                                                                    alert('Please register the student first (Step 1) before uploading documents.');
                                                                    return;
                                                                }
                                                                setSelectedDocType(btn.type);
                                                                setSelectedDocName(btn.label + " Marksheet");
                                                                setSelectedDocCategory('applicant');
                                                                setOnboardStep(3);
                                                                setIsUploadModalOpen(true);
                                                            }}
                                                            className={`px-4 py-2.5 bg-white border rounded-xl text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${isRelevant
                                                                ? 'hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-emerald-300 hover:shadow-sm'
                                                                : 'border-slate-100 text-slate-400'
                                                                }`}
                                                        >
                                                            {isUploading ? (
                                                                <>
                                                                    <div className="w-4 h-4 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                                                                    <span>Uploading ({Math.round(progress)}%)</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className={`material-symbols-outlined ${btn.color} text-[18px]`}>{btn.icon}</span>
                                                                    <span>Upload {btn.label}</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {!newStudent.academic.highestLevel && (
                                                <p className="text-[11px] text-amber-700 font-medium">
                                                    Tip: Select &quot;Highest Level of Education&quot; below to enable the most relevant upload buttons.
                                                </p>
                                            )}
                                        </div>

                                        {/* {Object.entries(ocrResults).filter(([key]) => {
                                                        const [docType] = key.split('-');
                                                        return /marksheet|ug_|pg_/.test(docType);
                                                    }).map(([key, fields]: [string, Record<string, unknown>]) => {
                                                        const [docType] = key.split('-');
                                                        const documentValidation = fields.document_validation && typeof fields.document_validation === 'object'
                                                            ? fields.document_validation as Record<string, unknown>
                                                            : null;
                                                        const validationEntries = Object.entries(documentValidation || {})
                                                            .filter(([, value]) => value === true || value === false);
                                                        const ocrIssues = Array.isArray(fields.ocr_issues)
                                                            ? fields.ocr_issues.map(issue => String(issue)).filter(Boolean)
                                                            : [];
                                                        return (
                                                            <div key={key} className="bg-gradient-to-r from-emerald-50 via-teal-50/50 to-transparent border-2 border-emerald-200 rounded-3xl p-6 shadow-lg shadow-emerald-100/50 space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-3">
                                                                        <motion.div
                                                                            initial={{ scale: 0.9, opacity: 0 }}
                                                                            animate={{ scale: 1, opacity: 1 }}
                                                                            className="w-10 h-10 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[20px]">verified</span>
                                                                        </motion.div>
                                                                        <div>
                                                                            <h4 className="text-sm font-bold text-emerald-900">Academic OCR — fields auto-filled</h4>
                                                                            <p className="text-xs text-emerald-700 font-medium mt-0.5">{docType.replace(/_/g, ' ').toUpperCase()}</p>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowOcrReview(prev => ({ ...prev, [key]: !prev[key] }))}
                                                                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900"
                                                                    >
                                                                        {showOcrReview[key] ? '▼ Hide' : '▶ Show'} Details
                                                                    </button>
                                                                </div>
                                                                {(validationEntries.length > 0 || ocrIssues.length > 0) && (
                                                                    <div className="bg-white/85 border border-emerald-100 rounded-2xl p-4 space-y-3">
                                                                        {validationEntries.length > 0 && (
                                                                            <div>
                                                                                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-2">OCR Validation Notes</p>
                                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                                                    {validationEntries.map(([label, value]) => (
                                                                                        <div key={label} className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                                                                                            <span className={`material-symbols-outlined text-[16px] ${value ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                                                                {value ? 'check_circle' : 'info'}
                                                                                            </span>
                                                                                            <span>{label.replace(/_/g, ' ')}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                        {ocrIssues.length > 0 && (
                                                                            <div>
                                                                                <p className="text-[9px] font-black uppercase tracking-widest text-amber-600 mb-2">OCR Issues Detected</p>
                                                                                <ul className="space-y-1">
                                                                                    {ocrIssues.map((issue, idx) => (
                                                                                        <li key={`${issue}-${idx}`} className="text-xs font-medium text-slate-600 flex gap-2">
                                                                                            <span className="text-amber-500">-</span>
                                                                                            <span>{issue}</span>
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {showOcrReview[key] !== false && (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                                                                        {Object.entries(fields || {})
                                                                            .filter(([k, v]) => k !== 'document_validation' && k !== 'ocr_issues' && (typeof v !== 'object' || v == null))
                                                                            .map(([k, v]) => (
                                                                                v != null && String(v).trim() !== '' && (
                                                                                    <div key={k} className="bg-white/80 rounded-xl px-4 py-2 border border-emerald-100">
                                                                                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600">{k.replace(/_/g, ' ')}</p>
                                                                                        <p className="text-sm font-semibold text-slate-800 truncate">{String(v)}</p>
                                                                                    </div>
                                                                                )
                                                                            ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })} */}

                                        <section>
                                            <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">school</span>
                                                Education Summary
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Country of Education*</label>
                                                    <select value={newStudent.academic.countryOfEducation} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, countryOfEducation: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"><option value="">Select Country</option><option value="India">India</option><option value="USA">USA</option><option value="UK">UK</option><option value="Canada">Canada</option></select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Highest Level of Education*</label>
                                                    <select value={newStudent.academic.highestLevel} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, highestLevel: e.target.value } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium appearance-none">
                                                        <option value="">Select Level</option>
                                                        <option value="Postgraduate">Postgraduate</option>
                                                        <option value="Undergraduate">Undergraduate</option>
                                                        <option value="Grade 12">Grade 12 or equivalent</option>
                                                        <option value="Grade 10">Grade 10 or equivalent</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </section>

                                        {(newStudent.academic.highestLevel === 'Postgraduate') && (
                                            <>
                                                <div className="h-px bg-slate-100 my-8"></div>
                                                <section>
                                                    <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                        <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">workspace_premium</span>
                                                        Post Graduate
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Country of Study*</label>
                                                            <select value={newStudent.academic.postgrad.country} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, postgrad: { ...newStudent.academic.postgrad, country: e.target.value, state: "" } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                                <option value="">Select Country</option>
                                                                {getAllCountries().map(country => (
                                                                    <option key={country} value={country}>{country}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">State of Study*</label>
                                                            <select value={newStudent.academic.postgrad.state} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, postgrad: { ...newStudent.academic.postgrad, state: e.target.value } } })} disabled={!newStudent.academic.postgrad.country} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                                                <option value="">Select State</option>
                                                                {newStudent.academic.postgrad.country && getStatesByCountry(newStudent.academic.postgrad.country).map(state => (
                                                                    <option key={state} value={state}>{state}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Level of Study*</label>
                                                            <select value={newStudent.academic.postgrad.qualification} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, postgrad: { ...newStudent.academic.postgrad, qualification: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"><option value="Postgraduate">Postgraduate</option></select>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Name of University*</label>
                                                            <input type="text" value={newStudent.academic.postgrad.university} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, postgrad: { ...newStudent.academic.postgrad, university: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Name of University" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Qualification Achieved/Degree Awarded</label>
                                                            <input type="text" value={newStudent.academic.postgrad.qualification} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, postgrad: { ...newStudent.academic.postgrad, qualification: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Qualification Achieved / Degree Awarded" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">City of Study*</label>
                                                            <input type="text" value={newStudent.academic.postgrad.city} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, postgrad: { ...newStudent.academic.postgrad, city: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter City of Study" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Grading System*</label>
                                                            <select value={newStudent.academic.postgrad.grading} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, postgrad: { ...newStudent.academic.postgrad, grading: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"><option value="">Select...</option><option value="CGPA">CGPA</option><option value="Percentage">Percentage</option></select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Percentage*</label>
                                                            <input type="text" value={newStudent.academic.postgrad.percentage} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, postgrad: { ...newStudent.academic.postgrad, percentage: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Percentage" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Primary Language of Instruction*</label>
                                                            <input type="text" value={newStudent.academic.postgrad.language} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, postgrad: { ...newStudent.academic.postgrad, language: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Primary Language of Instruction" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-w-lg">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Start Date*</label>
                                                            <input type="date" value={newStudent.academic.postgrad.startDate} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, postgrad: { ...newStudent.academic.postgrad, startDate: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">End Date*</label>
                                                            <input type="date" value={newStudent.academic.postgrad.endDate} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, postgrad: { ...newStudent.academic.postgrad, endDate: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                                        </div>
                                                    </div>
                                                    <div className="mt-6 flex justify-center md:justify-start">
                                                        <button type="button" onClick={() => alert('Postgraduate details saved to local state.')} className="px-10 py-3 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20">Save</button>
                                                    </div>
                                                </section>
                                            </>
                                        )}

                                        {(['Postgraduate', 'Undergraduate'].includes(newStudent.academic.highestLevel)) && (
                                            <>
                                                <div className="h-px bg-slate-100 my-8"></div>
                                                <section>
                                                    <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                        <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">menu_book</span>
                                                        Undergraduate
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Country of Study*</label>
                                                            <select value={newStudent.academic.undergrad.country} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, undergrad: { ...newStudent.academic.undergrad, country: e.target.value, state: "" } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                                <option value="">Select Country</option>
                                                                {getAllCountries().map(country => (
                                                                    <option key={country} value={country}>{country}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">State of Study*</label>
                                                            <select value={newStudent.academic.undergrad.state} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, undergrad: { ...newStudent.academic.undergrad, state: e.target.value } } })} disabled={!newStudent.academic.undergrad.country} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                                                <option value="">Select State</option>
                                                                {newStudent.academic.undergrad.country && getStatesByCountry(newStudent.academic.undergrad.country).map(state => (
                                                                    <option key={state} value={state}>{state}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Level of Study*</label>
                                                            <select value={newStudent.academic.undergrad.qualification} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, undergrad: { ...newStudent.academic.undergrad, qualification: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"><option value="Undergraduate">Undergraduate</option></select>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Name of University*</label>
                                                            <input type="text" value={newStudent.academic.undergrad.university} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, undergrad: { ...newStudent.academic.undergrad, university: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Name of University" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Qualification Achieved/Degree Awarded</label>
                                                            <input type="text" value={newStudent.academic.undergrad.qualification} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, undergrad: { ...newStudent.academic.undergrad, qualification: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Qualification Achieved / Degree Awarded" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">City of Study*</label>
                                                            <input type="text" value={newStudent.academic.undergrad.city} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, undergrad: { ...newStudent.academic.undergrad, city: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter City of Study" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Grading System*</label>
                                                            <select value={newStudent.academic.undergrad.grading} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, undergrad: { ...newStudent.academic.undergrad, grading: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"><option value="">Select...</option><option value="CGPA">CGPA</option><option value="Percentage">Percentage</option></select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Score(UG)*</label>
                                                            <input type="text" value={newStudent.academic.undergrad.score} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, undergrad: { ...newStudent.academic.undergrad, score: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Score" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Primary Language of Instruction*</label>
                                                            <input type="text" value={newStudent.academic.undergrad.language} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, undergrad: { ...newStudent.academic.undergrad, language: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Primary Language of Instruction" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Backlogs</label>
                                                            <input type="text" value={newStudent.academic.undergrad.backlogs} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, undergrad: { ...newStudent.academic.undergrad, backlogs: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Backlogs" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Start Date*</label>
                                                            <input type="date" value={newStudent.academic.undergrad.startDate} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, undergrad: { ...newStudent.academic.undergrad, startDate: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">End Date*</label>
                                                            <input type="date" value={newStudent.academic.undergrad.endDate} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, undergrad: { ...newStudent.academic.undergrad, endDate: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                                        </div>
                                                    </div>
                                                    <div className="mt-6 flex justify-center md:justify-start">
                                                        <button type="button" onClick={() => alert('Undergraduate details saved.')} className="px-10 py-3 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20">Save</button>
                                                    </div>
                                                </section>
                                            </>
                                        )}

                                        {(['Postgraduate', 'Undergraduate', 'Grade 12'].includes(newStudent.academic.highestLevel)) && (
                                            <>
                                                <div className="h-px bg-slate-100 my-8"></div>
                                                <section>
                                                    <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                        <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">school</span>
                                                        Grade 12th or equivalent education
                                                    </div>
                                                    {renderAcademicDocumentStatus('marksheet_12', '12th Marksheet')}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Country of Study*</label>
                                                            <select value={newStudent.academic.grade12.country} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade12: { ...newStudent.academic.grade12, country: e.target.value, state: "" } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                                <option value="">Select Country</option>
                                                                {getAllCountries().map(country => (
                                                                    <option key={country} value={country}>{country}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">State of Study*</label>
                                                            <select value={newStudent.academic.grade12.state} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade12: { ...newStudent.academic.grade12, state: e.target.value } } })} disabled={!newStudent.academic.grade12.country} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                                                <option value="">Select State</option>
                                                                {newStudent.academic.grade12.country && getStatesByCountry(newStudent.academic.grade12.country).map(state => (
                                                                    <option key={state} value={state}>{state}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Name of Board*</label>
                                                            <input type="text" value={newStudent.academic.grade12.board} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade12: { ...newStudent.academic.grade12, board: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Name of Board" />
                                                        </div>

                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Name of the institution*</label>
                                                            <input type="text" value={newStudent.academic.grade12.institution} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade12: { ...newStudent.academic.grade12, institution: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Name of the institution" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">City of Study*</label>
                                                            <input type="text" value={newStudent.academic.grade12.city} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade12: { ...newStudent.academic.grade12, city: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter City of Study" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Grading System*</label>
                                                            <select value={newStudent.academic.grade12.grading} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade12: { ...newStudent.academic.grade12, grading: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"><option value="">Select...</option><option value="CGPA">CGPA</option><option value="Percentage">Percentage</option></select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Score(12th)*</label>
                                                            <input type="text" value={newStudent.academic.grade12.score} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade12: { ...newStudent.academic.grade12, score: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Score" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Primary Language of Instruction*</label>
                                                            <input type="text" value={newStudent.academic.grade12.language} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade12: { ...newStudent.academic.grade12, language: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Primary Language of Instruction" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-w-lg">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Start Date*</label>
                                                            <input type="date" value={newStudent.academic.grade12.startDate} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade12: { ...newStudent.academic.grade12, startDate: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">End Date*</label>
                                                            <input type="date" value={newStudent.academic.grade12.endDate} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade12: { ...newStudent.academic.grade12, endDate: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                                        </div>
                                                    </div>
                                                    <div className="mt-6 flex justify-center md:justify-start">
                                                        <button type="button" onClick={() => alert('Grade 12th details saved.')} className="px-10 py-3 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20">Save</button>
                                                    </div>
                                                </section>
                                            </>
                                        )}

                                        {(['Postgraduate', 'Undergraduate', 'Grade 12', 'Grade 10'].includes(newStudent.academic.highestLevel)) && (
                                            <>
                                                <div className="h-px bg-slate-100 my-8"></div>
                                                <section>
                                                    <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                        <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">school</span>
                                                        Grade 10th or equivalent
                                                    </div>
                                                    {renderAcademicDocumentStatus('marksheet_10', '10th Marksheet')}
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Country of Study*</label>
                                                            <select value={newStudent.academic.grade10.country} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade10: { ...newStudent.academic.grade10, country: e.target.value, state: "" } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                                <option value="">Select Country</option>
                                                                {getAllCountries().map(country => (
                                                                    <option key={country} value={country}>{country}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">State of Study*</label>
                                                            <select value={newStudent.academic.grade10.state} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade10: { ...newStudent.academic.grade10, state: e.target.value } } })} disabled={!newStudent.academic.grade10.country} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                                                <option value="">Select State</option>
                                                                {newStudent.academic.grade10.country && getStatesByCountry(newStudent.academic.grade10.country).map(state => (
                                                                    <option key={state} value={state}>{state}</option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Name of Board*</label>
                                                            <input type="text" value={newStudent.academic.grade10.board} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade10: { ...newStudent.academic.grade10, board: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Name of Board" />
                                                        </div>

                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Name of the institution*</label>
                                                            <input type="text" value={newStudent.academic.grade10.institution} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade10: { ...newStudent.academic.grade10, institution: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Name of the institution" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">City of Study*</label>
                                                            <input type="text" value={newStudent.academic.grade10.city} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade10: { ...newStudent.academic.grade10, city: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter City of Study" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Grading System*</label>
                                                            <select value={newStudent.academic.grade10.grading} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade10: { ...newStudent.academic.grade10, grading: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20"><option value="">Select...</option><option value="CGPA">CGPA</option><option value="Percentage">Percentage</option></select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Score(10th)*</label>
                                                            <input type="text" value={newStudent.academic.grade10.score} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade10: { ...newStudent.academic.grade10, score: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Score" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Primary Language of Instruction*</label>
                                                            <input type="text" value={newStudent.academic.grade10.language} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade10: { ...newStudent.academic.grade10, language: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Primary Language of Instruction" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-w-lg">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Start Date*</label>
                                                            <input type="date" value={newStudent.academic.grade10.startDate} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade10: { ...newStudent.academic.grade10, startDate: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">End Date*</label>
                                                            <input type="date" value={newStudent.academic.grade10.endDate} onChange={e => setNewStudent({ ...newStudent, academic: { ...newStudent.academic, grade10: { ...newStudent.academic.grade10, endDate: e.target.value } } })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                                        </div>
                                                    </div>
                                                    <div className="mt-6 flex justify-center md:justify-start">
                                                        <button type="button" onClick={() => setProfileTab('work')} className="px-10 py-3 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20">Continue</button>
                                                    </div>
                                                    <div className="mt-8 flex justify-center border-t border-dashed border-slate-200 pt-6">
                                                        <button type="button" className="flex items-center gap-2 text-emerald-600 text-sm font-bold hover:text-emerald-700 transition-all">
                                                            <span className="material-symbols-outlined text-white bg-emerald-500 rounded-full text-[16px] p-0.5">add</span>
                                                            Add Another
                                                        </button>
                                                    </div>
                                                </section>
                                            </>
                                        )}

                                        {/* Premium Academic Certificates Checklist */}
                                        {/* <div className="mt-12 pt-8 border-t border-slate-100 space-y-6">
                                                        <h4 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-indigo-600 text-[20px]">folder_managed</span>
                                                            Required Academic Certificates & Transcripts
                                                        </h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                            {(() => {
                                                                const studentDocs = getStudentDocumentRequirements(newStudent);
                                                                const academicDocs = studentDocs.filter(d => d.category === 'academic' && d.type !== 'resume' && d.type !== 'work_letters' && d.type !== 'english_test' && d.type !== 'aptitude_test');
                                                                return academicDocs.map((doc, idx) => {
                                                                    const existingDoc = userDocuments.find(ud => ud.docType === doc.type || ud.type === doc.type);
                                                                    const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                                                    const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));
                                                                    
                                                                    return (
                                                                        <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isUploaded ? 'bg-emerald-50/30 border-emerald-100 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                                                            <div className="flex items-center gap-3">
                                                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${isUploaded ? 'bg-white text-emerald-500 border-emerald-100' : 'bg-white border-slate-200 text-slate-400'}`}>
                                                                                    <span className="material-symbols-outlined text-[18px]">{isUploaded ? 'task_alt' : 'description'}</span>
                                                                                </div>
                                                                                <div>
                                                                                    <h5 className="text-xs font-bold text-slate-900">{doc.name}</h5>
                                                                                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">{doc.type.toUpperCase().replace(/_/g, ' ')} • PDF/JPG/PNG</p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <input
                                                                                    type="file"
                                                                                    accept=".pdf,.jpg,.jpeg,.png"
                                                                                    ref={el => {
                                                                                        if (el) fileInputRefs.current[`academic-tab-${doc.type}`] = el;
                                                                                    }}
                                                                                    onChange={async (e) => {
                                                                                        const file = e.target.files?.[0];
                                                                                        if (file) {
                                                                                            await handleDocumentUpload(
                                                                                                file,
                                                                                                doc.type,
                                                                                                'applicant',
                                                                                                `${newStudent.firstName} ${newStudent.lastName}`.trim() || 'Applicant'
                                                                                            );
                                                                                            e.target.value = '';
                                                                                        }
                                                                                    }}
                                                                                    hidden
                                                                                />
                                                                                {isUploaded ? (
                                                                                    <>
                                                                                        <button type="button" onClick={() => viewFile(doc.type)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-all flex items-center gap-1">
                                                                                            <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                                                            Review
                                                                                        </button>
                                                                                        <button type="button" onClick={() => handleDocumentDelete(doc.type, 'applicant', doc.name)} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-100 transition-all flex items-center gap-1">
                                                                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                                                                            Remove
                                                                                        </button>
                                                                                    </>
                                                                                ) : (
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => fileInputRefs.current[`academic-tab-${doc.type}`]?.click()}
                                                                                        disabled={uploadingDocs[`${doc.type}-applicant`] !== undefined}
                                                                                        className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50 flex items-center gap-1"
                                                                                    >
                                                                                        <span className="material-symbols-outlined text-[14px]">upload</span>
                                                                                        {uploadingDocs[`${doc.type}-applicant`] !== undefined ? `${Math.round(uploadingDocs[`${doc.type}-applicant`])}%` : 'Upload'}
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    </div> */}
                                    </motion.div>
                                )}

                                {profileTab === 'loan' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200"
                                    >
                                        <section>
                                            <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">account_balance</span>
                                                Education Loan Details
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Loan Amount Needed (₹)*</label>
                                                    <input type="text" value={newStudent.loanAmount} onChange={e => setNewStudent({ ...newStudent, loanAmount: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="e.g. 2500000" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Target University / College*</label>
                                                    <input type="text" value={newStudent.targetUniversity} onChange={e => setNewStudent({ ...newStudent, targetUniversity: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="e.g. Stanford University" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Country of Study*</label>
                                                    <select value={newStudent.studyDestination} onChange={e => setNewStudent({ ...newStudent, studyDestination: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                        <option value="">Select Country</option>
                                                        {getAllCountries().map(country => (
                                                            <option key={country} value={country}>{country}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Course / Program Name*</label>
                                                    <input type="text" value={newStudent.courseName} onChange={e => setNewStudent({ ...newStudent, courseName: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="e.g. MS in Computer Science" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Academic Goal / Degree Level*</label>
                                                    <select value={newStudent.goal} onChange={e => setNewStudent({ ...newStudent, goal: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                        <option value="">Select Goal...</option>
                                                        <option value="Postgraduate">Postgraduate</option>
                                                        <option value="Undergraduate">Undergraduate</option>
                                                        <option value="Doctorate">Doctorate</option>
                                                        <option value="Diploma">Diploma / Certificate</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Target Intake Season*</label>
                                                    <select value={newStudent.intakeSeason} onChange={e => setNewStudent({ ...newStudent, intakeSeason: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                        <option value="">Select Intake...</option>
                                                        {(() => {
                                                            const cy = new Date().getFullYear();
                                                            return [
                                                                `Fall ${cy}`,
                                                                `Spring ${cy + 1}`,
                                                                `Summer ${cy + 1}`,
                                                                `Fall ${cy + 1}`,
                                                                `Spring ${cy + 2}`,
                                                            ].map(opt => (
                                                                <option key={opt} value={opt}>{opt}</option>
                                                            ));
                                                        })()}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Study Budget / Estimated Cost*</label>
                                                    <select value={newStudent.budget} onChange={e => setNewStudent({ ...newStudent, budget: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                        <option value="">Select Budget...</option>
                                                        <option value="Under ₹15 Lakhs">Under ₹15 Lakhs</option>
                                                        <option value="₹15 Lakhs - ₹25 Lakhs">₹15 Lakhs - ₹25 Lakhs</option>
                                                        <option value="₹25 Lakhs - ₹40 Lakhs">₹25 Lakhs - ₹40 Lakhs</option>
                                                        <option value="₹40 Lakhs - ₹60 Lakhs">₹40 Lakhs - ₹60 Lakhs</option>
                                                        <option value="Above ₹60 Lakhs">Above ₹60 Lakhs</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Admit Status*</label>
                                                    <select value={newStudent.admitStatus} onChange={e => setNewStudent({ ...newStudent, admitStatus: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                        <option value="">Select Status...</option>
                                                        <option value="Admitted">Admitted (Has Admit Letter)</option>
                                                        <option value="Applied">Applied (Awaiting Decision)</option>
                                                        <option value="Planning">Planning to Apply</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Residential Pincode*</label>
                                                    <input type="text" maxLength={6} value={newStudent.pincode} onChange={e => setNewStudent({ ...newStudent, pincode: e.target.value.replace(/\D/g, '') })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="e.g. 560001" />
                                                </div>
                                            </div>

                                            <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        await handleSaveProfile(false);
                                                    }}
                                                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
                                                >
                                                    Save Loan Details
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        await handleSaveProfile(false);
                                                        setProfileTab('work');
                                                    }}
                                                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
                                                >
                                                    Continue
                                                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                                </button>
                                            </div>
                                        </section>
                                    </motion.div>
                                )}

                                {profileTab === 'work' && (
                                    <div className="space-y-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                                        <section>
                                            <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">work</span>
                                                Professional Experience
                                            </div>
                                            {newStudent.workExperience.map((exp, index) => (
                                                <div key={index} className="p-6 bg-slate-50 border border-slate-200 rounded-2xl mb-6 relative group">
                                                    {index > 0 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const newExp = [...newStudent.workExperience];
                                                                newExp.splice(index, 1);
                                                                setNewStudent({ ...newStudent, workExperience: newExp });
                                                            }}
                                                            className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                                        </button>
                                                    )}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Employer / Company*</label>
                                                            <input type="text" value={exp.employer} onChange={e => {
                                                                const newExp = [...newStudent.workExperience];
                                                                newExp[index].employer = e.target.value;
                                                                setNewStudent({ ...newStudent, workExperience: newExp });
                                                            }} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="e.g. Google" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Job Title / Role*</label>
                                                            <input type="text" value={exp.role} onChange={e => {
                                                                const newExp = [...newStudent.workExperience];
                                                                newExp[index].role = e.target.value;
                                                                setNewStudent({ ...newStudent, workExperience: newExp });
                                                            }} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="e.g. Software Engineer" />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Country*</label>
                                                            <select value={exp.country} onChange={e => {
                                                                const newExp = [...newStudent.workExperience];
                                                                newExp[index].country = e.target.value;
                                                                setNewStudent({ ...newStudent, workExperience: newExp });
                                                            }} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                                <option value="">Select Country</option>
                                                                {getAllCountries().map(country => (
                                                                    <option key={country} value={country}>{country}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Start Date*</label>
                                                            <input type="date" value={exp.startDate} onChange={e => {
                                                                const newExp = [...newStudent.workExperience];
                                                                newExp[index].startDate = e.target.value;
                                                                setNewStudent({ ...newStudent, workExperience: newExp });
                                                            }} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-600" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">End Date</label>
                                                            <input type="date" value={exp.endDate} disabled={exp.current} onChange={e => {
                                                                const newExp = [...newStudent.workExperience];
                                                                newExp[index].endDate = e.target.value;
                                                                setNewStudent({ ...newStudent, workExperience: newExp });
                                                            }} className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 ${exp.current ? 'opacity-50' : ''}`} />
                                                        </div>
                                                    </div>
                                                    <div className="mt-4">
                                                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                                                            <input type="checkbox" checked={exp.current} onChange={e => {
                                                                const newExp = [...newStudent.workExperience];
                                                                newExp[index].current = e.target.checked;
                                                                if (e.target.checked) newExp[index].endDate = "";
                                                                setNewStudent({ ...newStudent, workExperience: newExp });
                                                            }} className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500" />
                                                            I currently work here
                                                        </label>
                                                    </div>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setNewStudent({ ...newStudent, workExperience: [...newStudent.workExperience, { employer: "", role: "", country: "", startDate: "", endDate: "", current: false }] })}
                                                className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold uppercase tracking-widest hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/30 transition-all flex items-center justify-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">add</span>
                                                Add Experience
                                            </button>
                                            {/* Premium Work Experience Documents Checklist */}
                                            <div className="mt-12 pt-8 border-t border-slate-100 space-y-6">
                                                <h4 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-indigo-600 text-[20px]">folder_managed</span>
                                                    Required Professional Experience Documents
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {(() => {
                                                        const studentDocs = getStudentDocumentRequirements(newStudent);
                                                        const workDocs = studentDocs.filter(d => d.type === 'resume' || d.type === 'work_letters');
                                                        return workDocs.map((doc, idx) => {
                                                            const existingDoc = userDocuments.find(ud => ud.docType === doc.type || ud.type === doc.type);
                                                            const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                                            const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));

                                                            return (
                                                                <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isUploaded ? 'bg-emerald-50/30 border-emerald-100 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${isUploaded ? 'bg-white text-emerald-500 border-emerald-100' : 'bg-white border-slate-200 text-slate-400'}`}>
                                                                            <span className="material-symbols-outlined text-[18px]">{isUploaded ? 'task_alt' : 'description'}</span>
                                                                        </div>
                                                                        <div>
                                                                            <h5 className="text-xs font-bold text-slate-900">{doc.name}</h5>
                                                                            <p className="text-[10px] text-slate-500 font-medium mt-0.5">{doc.type.toUpperCase().replace(/_/g, ' ')} • PDF/JPG/PNG</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="file"
                                                                            accept=".pdf,.jpg,.jpeg,.png"
                                                                            ref={el => {
                                                                                if (el) fileInputRefs.current[`work-tab-${doc.type}`] = el;
                                                                            }}
                                                                            onChange={async (e) => {
                                                                                const file = e.target.files?.[0];
                                                                                if (file) {
                                                                                    await handleDocumentUpload(
                                                                                        file,
                                                                                        doc.type,
                                                                                        'applicant',
                                                                                        `${newStudent.firstName} ${newStudent.lastName}`.trim() || 'Applicant'
                                                                                    );
                                                                                    e.target.value = '';
                                                                                }
                                                                            }}
                                                                            hidden
                                                                        />
                                                                        {isUploaded ? (
                                                                            <>
                                                                                <button type="button" onClick={() => viewFile(doc.type)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-all flex items-center gap-1">
                                                                                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                                                    Review
                                                                                </button>
                                                                                <button type="button" onClick={() => handleDocumentDelete(doc.type, 'applicant', doc.name)} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-100 transition-all flex items-center gap-1">
                                                                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                                                                    Remove
                                                                                </button>
                                                                            </>
                                                                        ) : (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => fileInputRefs.current[`work-tab-${doc.type}`]?.click()}
                                                                                disabled={uploadingDocs[`${doc.type}-applicant`] !== undefined}
                                                                                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50 flex items-center gap-1"
                                                                            >
                                                                                <span className="material-symbols-outlined text-[14px]">upload</span>
                                                                                {uploadingDocs[`${doc.type}-applicant`] !== undefined ? `${Math.round(uploadingDocs[`${doc.type}-applicant`])}%` : 'Upload'}
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        });
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="mt-8 flex justify-end">
                                                <button type="button" onClick={() => setProfileTab('tests')} className="px-10 py-3 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20">Continue</button>
                                            </div>
                                        </section>
                                    </div>
                                )}

                                {profileTab === 'tests' && (
                                    <div className="space-y-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                                        <section>
                                            <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">terminal</span>
                                                Standardized Test Scores
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                <div className="space-y-4">
                                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">English Proficiency</h4>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">IELTS Score (out of 9)</label>
                                                            <input type="text" value={newStudent.tests.ielts} onChange={e => { const cleaned = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*?)\..*/g, "$1"); setNewStudent({ ...newStudent, tests: { ...newStudent.tests, ielts: cleaned } }); }} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="0.0" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">TOEFL Score (out of 120)</label>
                                                            <input type="text" value={newStudent.tests.toefl} onChange={e => { const cleaned = e.target.value.replace(/[^0-9]/g, ""); setNewStudent({ ...newStudent, tests: { ...newStudent.tests, toefl: cleaned } }); }} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="0" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">PTE Score (out of 90)</label>
                                                            <input type="text" value={newStudent.tests.pte} onChange={e => { const cleaned = e.target.value.replace(/[^0-9]/g, ""); setNewStudent({ ...newStudent, tests: { ...newStudent.tests, pte: cleaned } }); }} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="0" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">Duolingo Score (out of 160)</label>
                                                            <input type="text" value={newStudent.tests.duolingo || ""} onChange={e => { const cleaned = e.target.value.replace(/[^0-9]/g, ""); setNewStudent({ ...newStudent, tests: { ...newStudent.tests, duolingo: cleaned } }); }} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="0" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-2">Aptitude Tests</h4>
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">GRE Score (out of 340)</label>
                                                            <input type="text" value={newStudent.tests.gre} onChange={e => { const cleaned = e.target.value.replace(/[^0-9]/g, ""); setNewStudent({ ...newStudent, tests: { ...newStudent.tests, gre: cleaned } }); }} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="0" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">GMAT Score (out of 800)</label>
                                                            <input type="text" value={newStudent.tests.gmat} onChange={e => { const cleaned = e.target.value.replace(/[^0-9]/g, ""); setNewStudent({ ...newStudent, tests: { ...newStudent.tests, gmat: cleaned } }); }} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="0" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">SAT Score (out of 1600)</label>
                                                            <input type="text" value={newStudent.tests.sat} onChange={e => { const cleaned = e.target.value.replace(/[^0-9]/g, ""); setNewStudent({ ...newStudent, tests: { ...newStudent.tests, sat: cleaned } }); }} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="0" />
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-bold text-slate-500 mb-1 block">ACT Score (out of 36)</label>
                                                            <input type="text" value={newStudent.tests.act || ""} onChange={e => { const cleaned = e.target.value.replace(/[^0-9]/g, ""); setNewStudent({ ...newStudent, tests: { ...newStudent.tests, act: cleaned } }); }} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="0" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex flex-col justify-center text-center">
                                                    <span className="material-symbols-outlined text-[40px] text-slate-300 mb-4">info</span>
                                                    <p className="text-xs text-slate-500 leading-relaxed font-medium">Standardized test scores help in determining the eligibility for various universities and visa requirements.</p>
                                                </div>
                                            </div>
                                            {/* Premium Test Scores Documents Checklist */}
                                            {/* <div className="mt-12 pt-8 border-t border-slate-100 space-y-6">
                                                            <h4 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                                                <span className="material-symbols-outlined text-indigo-600 text-[20px]">folder_managed</span>
                                                                Required Standardized Test Scorecards
                                                            </h4>
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                {(() => {
                                                                    const studentDocs = getStudentDocumentRequirements(newStudent);
                                                                    const testDocs = studentDocs.filter(d => d.type === 'english_test' || d.type === 'aptitude_test');
                                                                    return testDocs.map((doc, idx) => {
                                                                        const existingDoc = userDocuments.find(ud => ud.docType === doc.type || ud.type === doc.type);
                                                                        const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                                                        const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));

                                                                        return (
                                                                            <div key={idx} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isUploaded ? 'bg-emerald-50/30 border-emerald-100 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                                                                <div className="flex items-center gap-3">
                                                                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${isUploaded ? 'bg-white text-emerald-500 border-emerald-100' : 'bg-white border-slate-200 text-slate-400'}`}>
                                                                                        <span className="material-symbols-outlined text-[18px]">{isUploaded ? 'task_alt' : 'description'}</span>
                                                                                    </div>
                                                                                    <div>
                                                                                        <h5 className="text-xs font-bold text-slate-900">{doc.name}</h5>
                                                                                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">{doc.type.toUpperCase().replace(/_/g, ' ')} • PDF/JPG/PNG</p>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-2">
                                                                                    <input
                                                                                        type="file"
                                                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                                                        ref={el => {
                                                                                            if (el) fileInputRefs.current[`tests-tab-${doc.type}`] = el;
                                                                                        }}
                                                                                        onChange={async (e) => {
                                                                                            const file = e.target.files?.[0];
                                                                                            if (file) {
                                                                                                await handleDocumentUpload(
                                                                                                    file,
                                                                                                    doc.type,
                                                                                                    'applicant',
                                                                                                    `${newStudent.firstName} ${newStudent.lastName}`.trim() || 'Applicant'
                                                                                                );
                                                                                                e.target.value = '';
                                                                                            }
                                                                                        }}
                                                                                        hidden
                                                                                    />
                                                                                    {isUploaded ? (
                                                                                        <>
                                                                                            <button type="button" onClick={() => viewFile(doc.type)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold hover:bg-slate-50 transition-all flex items-center gap-1">
                                                                                                <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                                                                Review
                                                                                            </button>
                                                                                            <button type="button" onClick={() => handleDocumentDelete(doc.type, 'applicant', doc.name)} className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-100 transition-all flex items-center gap-1">
                                                                                                <span className="material-symbols-outlined text-[14px]">delete</span>
                                                                                                Remove
                                                                                            </button>
                                                                                        </>
                                                                                    ) : (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() => fileInputRefs.current[`tests-tab-${doc.type}`]?.click()}
                                                                                            disabled={uploadingDocs[`${doc.type}-applicant`] !== undefined}
                                                                                            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-bold hover:bg-indigo-700 transition-all shadow-sm disabled:opacity-50 flex items-center gap-1"
                                                                                        >
                                                                                            <span className="material-symbols-outlined text-[14px]">upload</span>
                                                                                            {uploadingDocs[`${doc.type}-applicant`] !== undefined ? `${Math.round(uploadingDocs[`${doc.type}-applicant`])}%` : 'Upload'}
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    });
                                                                })()}
                                                            </div>
                                                        </div> */}
                                            <div className="mt-8 flex justify-end">
                                                <button type="button" onClick={() => setProfileTab('family')} className="px-10 py-3 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20">Continue</button>
                                            </div>
                                        </section>
                                    </div>
                                )}

                                {profileTab === 'family' && (
                                    <div className="space-y-8 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
                                        {/* Father Details */}
                                        <section>
                                            <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">person</span>
                                                Father's Details
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Father's Name*</label>
                                                    <input type="text" value={newStudent.family.fatherName} onChange={e => setNewStudent({ ...newStudent, family: { ...newStudent.family, fatherName: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Name" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Mobile Number*</label>
                                                    <input type="tel" value={newStudent.family.fatherMobile} onChange={e => setNewStudent({ ...newStudent, family: { ...newStudent.family, fatherMobile: formatPhone(e.target.value) } })} onBlur={() => handleSaveProfile()} className={`w-full px-4 py-3 bg-slate-50 border ${newStudent.family.fatherMobile && !isPhoneValid(newStudent.family.fatherMobile) ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-emerald-500'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium`} placeholder="Mobile Number" maxLength={10} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Email ID</label>
                                                    <input type="email" value={newStudent.family.fatherEmail} onChange={e => setNewStudent({ ...newStudent, family: { ...newStudent.family, fatherEmail: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Email Address" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Occupation</label>
                                                    <input type="text" value={newStudent.family.fatherOccupation} onChange={e => setNewStudent({ ...newStudent, family: { ...newStudent.family, fatherOccupation: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Occupation" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Father's Aadhar Number</label>
                                                    <input type="text" value={newStudent.family.fatherAadhar} onChange={e => setNewStudent({ ...newStudent, family: { ...newStudent.family, fatherAadhar: formatAadhar(e.target.value) } })} onBlur={() => handleSaveProfile()} className={`w-full px-4 py-3 bg-slate-50 border ${newStudent.family.fatherAadhar && !isAadharValid(newStudent.family.fatherAadhar) ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-emerald-500'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium`} placeholder="12 Digit Aadhar" maxLength={12} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Father's PAN Card</label>
                                                    <input type="text" value={newStudent.family.fatherPan} onChange={e => setNewStudent({ ...newStudent, family: { ...newStudent.family, fatherPan: formatPan(e.target.value) } })} onBlur={() => handleSaveProfile()} className={`w-full px-4 py-3 bg-slate-50 border ${newStudent.family.fatherPan && !isPanValid(newStudent.family.fatherPan) ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-emerald-500'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium`} placeholder="PAN Number" style={{ textTransform: 'uppercase' }} maxLength={10} />
                                                </div>
                                            </div>
                                        </section>

                                        <div className="h-px bg-slate-100"></div>

                                        {/* Mother Details */}
                                        <section>
                                            <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">person</span>
                                                Mother's Details
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Mother's Name*</label>
                                                    <input type="text" value={newStudent.family.motherName} onChange={e => setNewStudent({ ...newStudent, family: { ...newStudent.family, motherName: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Name" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Mobile Number*</label>
                                                    <input type="tel" value={newStudent.family.motherMobile} onChange={e => setNewStudent({ ...newStudent, family: { ...newStudent.family, motherMobile: formatPhone(e.target.value) } })} onBlur={() => handleSaveProfile()} className={`w-full px-4 py-3 bg-slate-50 border ${newStudent.family.motherMobile && !isPhoneValid(newStudent.family.motherMobile) ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-emerald-500'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium`} placeholder="Mobile Number" maxLength={10} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Email ID</label>
                                                    <input type="email" value={newStudent.family.motherEmail} onChange={e => setNewStudent({ ...newStudent, family: { ...newStudent.family, motherEmail: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Email Address" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Occupation</label>
                                                    <input type="text" value={newStudent.family.motherOccupation} onChange={e => setNewStudent({ ...newStudent, family: { ...newStudent.family, motherOccupation: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Occupation" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Mother's Aadhar Number</label>
                                                    <input type="text" value={newStudent.family.motherAadhar} onChange={e => setNewStudent({ ...newStudent, family: { ...newStudent.family, motherAadhar: formatAadhar(e.target.value) } })} onBlur={() => handleSaveProfile()} className={`w-full px-4 py-3 bg-slate-50 border ${newStudent.family.motherAadhar && !isAadharValid(newStudent.family.motherAadhar) ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-emerald-500'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium`} placeholder="12 Digit Aadhar" maxLength={12} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Mother's PAN Card</label>
                                                    <input type="text" value={newStudent.family.motherPan} onChange={e => setNewStudent({ ...newStudent, family: { ...newStudent.family, motherPan: formatPan(e.target.value) } })} onBlur={() => handleSaveProfile()} className={`w-full px-4 py-3 bg-slate-50 border ${newStudent.family.motherPan && !isPanValid(newStudent.family.motherPan) ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-emerald-500'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium`} placeholder="PAN Number" style={{ textTransform: 'uppercase' }} maxLength={10} />
                                                </div>
                                            </div>
                                        </section>

                                        <div className="h-px bg-slate-100"></div>

                                        {/* Co-applicant Details */}
                                        <section>
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                                                    <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">group</span>
                                                    Co-applicant Details
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer hover:text-emerald-600 transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={newStudent.coApplicant.isSameAsFather}
                                                            onChange={e => {
                                                                const checked = e.target.checked;
                                                                setNewStudent({
                                                                    ...newStudent,
                                                                    coApplicant: {
                                                                        ...newStudent.coApplicant,
                                                                        isSameAsFather: checked,
                                                                        isSameAsMother: false,
                                                                        name: checked ? newStudent.family.fatherName : "",
                                                                        mobile: checked ? newStudent.family.fatherMobile : "",
                                                                        email: checked ? newStudent.family.fatherEmail : "",
                                                                        occupation: checked ? newStudent.family.fatherOccupation : "",
                                                                        aadhar: checked ? newStudent.family.fatherAadhar : "",
                                                                        pan: checked ? newStudent.family.fatherPan : "",
                                                                        employmentType: checked ? newStudent.family.fatherEmploymentType : "",
                                                                        monthlyIncome: checked ? newStudent.family.fatherMonthlyIncome : "",
                                                                        relation: checked ? "Father" : ""
                                                                    }
                                                                });
                                                                handleSaveProfile(true);
                                                            }}
                                                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                                        />
                                                        Same as Father
                                                    </label>
                                                    <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer hover:text-emerald-600 transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={newStudent.coApplicant.isSameAsMother}
                                                            onChange={e => {
                                                                const checked = e.target.checked;
                                                                setNewStudent({
                                                                    ...newStudent,
                                                                    coApplicant: {
                                                                        ...newStudent.coApplicant,
                                                                        isSameAsMother: checked,
                                                                        isSameAsFather: false,
                                                                        name: checked ? newStudent.family.motherName : "",
                                                                        mobile: checked ? newStudent.family.motherMobile : "",
                                                                        email: checked ? newStudent.family.motherEmail : "",
                                                                        occupation: checked ? newStudent.family.motherOccupation : "",
                                                                        aadhar: checked ? newStudent.family.motherAadhar : "",
                                                                        pan: checked ? newStudent.family.motherPan : "",
                                                                        employmentType: checked ? newStudent.family.motherEmploymentType : "",
                                                                        monthlyIncome: checked ? newStudent.family.motherMonthlyIncome : "",
                                                                        relation: checked ? "Mother" : ""
                                                                    }
                                                                });
                                                                handleSaveProfile(true);
                                                            }}
                                                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                                                        />
                                                        Same as Mother
                                                    </label>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Co-applicant Name*</label>
                                                    <input type="text" value={newStudent.coApplicant.name} onChange={e => setNewStudent({ ...newStudent, coApplicant: { ...newStudent.coApplicant, name: e.target.value, isSameAsFather: false, isSameAsMother: false } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Name" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Mobile Number*</label>
                                                    <input type="tel" value={newStudent.coApplicant.mobile} onChange={e => setNewStudent({ ...newStudent, coApplicant: { ...newStudent.coApplicant, mobile: formatPhone(e.target.value), isSameAsFather: false, isSameAsMother: false } })} onBlur={() => handleSaveProfile()} className={`w-full px-4 py-3 bg-slate-50 border ${newStudent.coApplicant.mobile && !isPhoneValid(newStudent.coApplicant.mobile) ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-emerald-500'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium`} placeholder="Mobile Number" maxLength={10} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Email ID</label>
                                                    <input type="email" value={newStudent.coApplicant.email} onChange={e => setNewStudent({ ...newStudent, coApplicant: { ...newStudent.coApplicant, email: e.target.value, isSameAsFather: false, isSameAsMother: false } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Email Address" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Relation with Applicant*</label>
                                                    <input type="text" value={newStudent.coApplicant.relation} onChange={e => setNewStudent({ ...newStudent, coApplicant: { ...newStudent.coApplicant, relation: e.target.value, isSameAsFather: false, isSameAsMother: false } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Relation" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Occupation</label>
                                                    <input type="text" value={newStudent.coApplicant.occupation} onChange={e => setNewStudent({ ...newStudent, coApplicant: { ...newStudent.coApplicant, occupation: e.target.value, isSameAsFather: false, isSameAsMother: false } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Occupation" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Aadhar Number</label>
                                                    <input type="text" value={newStudent.coApplicant.aadhar} onChange={e => setNewStudent({ ...newStudent, coApplicant: { ...newStudent.coApplicant, aadhar: formatAadhar(e.target.value), isSameAsFather: false, isSameAsMother: false } })} onBlur={() => handleSaveProfile()} className={`w-full px-4 py-3 bg-slate-50 border ${newStudent.coApplicant.aadhar && !isAadharValid(newStudent.coApplicant.aadhar) ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-emerald-500'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium`} placeholder="12 Digit Aadhar" maxLength={12} />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">PAN Card</label>
                                                    <input type="text" value={newStudent.coApplicant.pan} onChange={e => setNewStudent({ ...newStudent, coApplicant: { ...newStudent.coApplicant, pan: formatPan(e.target.value), isSameAsFather: false, isSameAsMother: false } })} onBlur={() => handleSaveProfile()} className={`w-full px-4 py-3 bg-slate-50 border ${newStudent.coApplicant.pan && !isPanValid(newStudent.coApplicant.pan) ? 'border-rose-300 focus:border-rose-500' : 'border-slate-200 focus:border-emerald-500'} rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium`} placeholder="PAN Number" style={{ textTransform: 'uppercase' }} maxLength={10} />
                                                </div>
                                            </div>
                                        </section>

                                        <div className="h-px bg-slate-100"></div>

                                        {/* Employment & Financial Details */}
                                        <section>
                                            <div className="flex items-center gap-2 mb-6 text-emerald-600 font-bold text-sm">
                                                <span className="material-symbols-outlined text-emerald-500 bg-emerald-50 p-1 rounded-full">work</span>
                                                Employment & Income Details
                                            </div>

                                            {/* Father's Employment */}
                                            <div className="bg-slate-50 p-6 rounded-xl mb-6 border border-slate-200">
                                                <h4 className="font-bold text-slate-700 mb-4">Father's Employment</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Employment Type*</label>
                                                        <select value={newStudent.family.fatherEmploymentType} onChange={e => { setNewStudent({ ...newStudent, family: { ...newStudent.family, fatherEmploymentType: e.target.value } }); handleSaveProfile(true); }} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                            <option value="">Select Employment Type</option>
                                                            <option value="employed">Employed (Salaried)</option>
                                                            <option value="self_employed_business">Self-Employed (Business)</option>
                                                            <option value="self_employed_professional">Self-Employed (Professional)</option>
                                                            <option value="retired">Retired</option>
                                                            <option value="not_employed">Not Employed</option>
                                                            <option value="expired">Deceased / Expired</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Monthly Income (₹)</label>
                                                        <input type="number" value={newStudent.family.fatherMonthlyIncome} onChange={e => setNewStudent({ ...newStudent, family: { ...newStudent.family, fatherMonthlyIncome: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Monthly Income" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Mother's Employment */}
                                            <div className="bg-slate-50 p-6 rounded-xl mb-6 border border-slate-200">
                                                <h4 className="font-bold text-slate-700 mb-4">Mother's Employment</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Employment Type*</label>
                                                        <select value={newStudent.family.motherEmploymentType} onChange={e => { setNewStudent({ ...newStudent, family: { ...newStudent.family, motherEmploymentType: e.target.value } }); handleSaveProfile(true); }} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                            <option value="">Select Employment Type</option>
                                                            <option value="employed">Employed (Salaried)</option>
                                                            <option value="self_employed_business">Self-Employed (Business)</option>
                                                            <option value="self_employed_professional">Self-Employed (Professional)</option>
                                                            <option value="retired">Retired</option>
                                                            <option value="not_employed">Not Employed</option>
                                                            <option value="expired">Deceased / Expired</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Monthly Income (₹)</label>
                                                        <input type="number" value={newStudent.family.motherMonthlyIncome} onChange={e => setNewStudent({ ...newStudent, family: { ...newStudent.family, motherMonthlyIncome: e.target.value } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Monthly Income" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Co-Applicant's Employment */}
                                            {newStudent.coApplicant.name && (
                                                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                                                    <h4 className="font-bold text-slate-700 mb-4">Co-Applicant's Employment</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Employment Type*</label>
                                                            <select value={newStudent.coApplicant.employmentType} onChange={e => { setNewStudent({ ...newStudent, coApplicant: { ...newStudent.coApplicant, employmentType: e.target.value, isSameAsFather: false, isSameAsMother: false } }); handleSaveProfile(true); }} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20">
                                                                <option value="">Select Employment Type</option>
                                                                <option value="employed">Employed (Salaried)</option>
                                                                <option value="self_employed_business">Self-Employed (Business)</option>
                                                                <option value="self_employed_professional">Self-Employed (Professional)</option>
                                                                <option value="retired">Retired</option>
                                                                <option value="not_employed">Not Employed</option>
                                                                <option value="expired">Deceased / Expired</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 block">Monthly Income (₹)</label>
                                                            <input type="number" value={newStudent.coApplicant.monthlyIncome} onChange={e => setNewStudent({ ...newStudent, coApplicant: { ...newStudent.coApplicant, monthlyIncome: e.target.value, isSameAsFather: false, isSameAsMother: false } })} onBlur={() => handleSaveProfile()} className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" placeholder="Enter Monthly Income" />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </section>

                                        {/* Dynamic Family & Co-applicant Documents Upload Checklists */}


                                        <div className="mt-8 flex justify-end">
                                            <button type="button" onClick={async () => { await proceedToDocuments(); addActivity("person", `Completed profile for ${newStudent.firstName}`, "person", "text-emerald-600 bg-emerald-50"); }} className="px-10 py-3 bg-emerald-500 text-white text-xs font-bold rounded-xl hover:bg-emerald-600 transition-all shadow-md shadow-emerald-500/20">Finalize & Proceed to Documents</button>
                                        </div>
                                    </div>
                                )}
                                <div className="sticky bottom-0 mt-8 py-4 bg-[#f8fafc] border-t border-slate-200 flex justify-between items-center z-10">
                                    <button type="button" onClick={resetOnboardModal} className="px-6 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-900 transition-all">Cancel</button>
                                    <div className="flex gap-4">
                                        {onboardStep === 2 && profileTab === 'personal' && (
                                            <button form="profile-personal-form" type="submit" disabled={createLoading} className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 disabled:opacity-50">
                                                {createLoading ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        )}
                                        {onboardStep === 2 && profileTab === 'academic' && (
                                            <button type="button" onClick={() => setProfileTab('work')} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2">
                                                Proceed to Work Experience
                                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                            </button>
                                        )}
                                        {onboardStep === 2 && profileTab === 'family' && (
                                            <button type="button" onClick={proceedToDocuments} className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2">
                                                Proceed to Documents
                                                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : onboardStep === 3 ? (
                            /* STEP 3: Documents Summary Dashboard */
                            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300 pb-12 mt-4 font-serif">
                                <div className="bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-200 p-10 relative overflow-hidden">
                                    {/* Background Accents */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full filter blur-3xl -z-10 opacity-60" />
                                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-50 rounded-full filter blur-3xl -z-10 opacity-60" />

                                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 pb-8 border-b border-slate-100 gap-6">
                                        <div className="flex items-center gap-5">
                                            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                                <span className="material-symbols-outlined text-[28px]">folder_managed</span>
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-bold text-slate-900 tracking-tight font-display">Document Vault</h3>
                                                <p className="text-xs text-slate-500 font-medium">Verify required KYC and academic credentials to finalize onboarding.</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const userId = createdUser?.id || createdUser?.uid || createdUser?._id;
                                                if (userId) fetchUserDocuments(userId);
                                            }}
                                            disabled={docsLoading}
                                            className="px-5 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50 hover:shadow-sm"
                                        >
                                            <span className={`material-symbols-outlined text-[18px] ${docsLoading ? 'animate-spin' : ''}`}>sync</span>
                                            {docsLoading ? 'Syncing...' : 'Sync Profile'}
                                        </button>
                                    </div>

                                    {Object.keys(uploadMessages).length > 0 && (
                                        <div className="space-y-2 mb-8">
                                            {Object.entries(uploadMessages).map(([key, msg]) => (
                                                <div
                                                    key={key}
                                                    className={`rounded-2xl px-4 py-3 text-xs font-bold border ${msg.type === 'success'
                                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                        : msg.type === 'warning'
                                                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                                        }`}
                                                >
                                                    {msg.text}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Visual Completeness Bar */}
                                    {(() => {
                                        const allReqs = getProfileDocumentRequirements(newStudent);


                                        const total = allReqs.length;
                                        const uploaded = allReqs.filter(d => {
                                            const existingDoc = userDocuments.find(ud => ud.docType === d.type || ud.type === d.type);
                                            const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                            return Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));
                                        }).length;

                                        const percent = total > 0 ? Math.round((uploaded / total) * 100) : 0;

                                        return (
                                            <div className="space-y-6 mb-10">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vault Completeness</p>
                                                        <h4 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">{percent}% <span className="text-xs text-slate-500 font-semibold">({uploaded} of {total} documents uploaded)</span></h4>
                                                    </div>
                                                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wide ${percent === 100 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                                        {percent === 100 ? '🎉 All Set' : '⏳ Action Required'}
                                                    </div>
                                                </div>
                                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-0.5">
                                                    <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500 shadow-sm" style={{ width: `${percent}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Central Gorgeous Popup Button Call-to-Action */}
                                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-8 text-center space-y-6 mb-10 relative overflow-hidden group hover:border-indigo-200 hover:bg-indigo-50/5 transition-all">
                                        <div className="w-16 h-16 bg-white border border-slate-100 shadow-sm rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors mx-auto group-hover:scale-105 transition-transform duration-300">
                                            <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
                                        </div>
                                        <div className="max-w-md mx-auto">
                                            <h4 className="text-lg font-bold text-slate-900 leading-tight">Interactive Document Manager</h4>
                                            <p className="text-xs text-slate-500 font-semibold mt-2">Click below to open the dedicated upload workspace to manage primary student KYC and identity verification documents (Passport, Aadhaar and PAN).</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const allReqs = getProfileDocumentRequirements(newStudent);
                                                if (allReqs.length > 0) {
                                                    setSelectedDocType(allReqs[0].type);
                                                    setSelectedDocName(allReqs[0].name);

                                                    let cat: 'applicant' | 'father' | 'mother' | 'coapplicant' = 'applicant';
                                                    if (allReqs[0].type.startsWith('father_')) cat = 'father';
                                                    else if (allReqs[0].type.startsWith('mother_')) cat = 'mother';
                                                    else if (allReqs[0].type.startsWith('coapplicant_')) cat = 'coapplicant';
                                                    setSelectedDocCategory(cat);
                                                }
                                                setIsUploadModalOpen(true);
                                            }}
                                            className="px-8 py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/35 transition-all flex items-center gap-2.5 mx-auto"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                            Open Upload Documents Popup
                                        </button>
                                    </div>

                                    {/* Dynamic Document Directory Directory Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 mt-8">
                                        {/* Card 1: Student Identity & KYC */}
                                        {/* <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm hover:shadow-md transition-all">
                                                        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                                                            <span className="material-symbols-outlined text-[20px] text-indigo-600">fingerprint</span>
                                                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Student Identity & KYC</h4>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {getStudentDocumentRequirements(newStudent).filter(d => ['passport', 'national_id', 'pan'].includes(d.type)).map((doc, idx) => {
                                                                const existingDoc = userDocuments.find(ud => ud.docType === doc.type || ud.type === doc.type);
                                                                const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                                                const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));
                                                                return (
                                                                    <div key={idx} className="flex items-center justify-between p-3.5 bg-white border border-slate-200/60 rounded-xl hover:border-slate-300 transition-all shadow-sm">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className={`material-symbols-outlined text-[18px] ${isUploaded ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                                                {isUploaded ? 'check_circle' : 'circle'}
                                                                            </span>
                                                                            <div>
                                                                                <span className="text-xs font-semibold text-slate-800">{doc.name}</span>
                                                                                {!isUploaded && (
                                                                                    <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${doc.required ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                                                                                        {doc.required ? 'Required' : 'Optional'}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSelectedDocType(doc.type);
                                                                                setSelectedDocName(doc.name);
                                                                                setSelectedDocCategory('applicant');
                                                                                setIsUploadModalOpen(true);
                                                                            }}
                                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                                                                                isUploaded 
                                                                                    ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200' 
                                                                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100/50'
                                                                            }`}
                                                                        >
                                                                            <span className="material-symbols-outlined text-[13px]">{isUploaded ? 'rate_review' : 'cloud_upload'}</span>
                                                                            {isUploaded ? 'Review / Edit' : 'Upload'}
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div> */}

                                        {/* Card 2: Academic & Credentials */}
                                        {/* <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm hover:shadow-md transition-all">
                                                        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                                                            <span className="material-symbols-outlined text-[20px] text-indigo-600">school</span>
                                                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Academic & Credentials</h4>
                                                        </div>
                                                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                                                            {getStudentDocumentRequirements(newStudent).filter(d => ['marksheet_10', 'marksheet_12', 'ug_transcript', 'ug_degree', 'pg_transcript', 'pg_degree', 'english_test', 'aptitude_test', 'resume', 'work_letters'].includes(d.type)).map((doc, idx) => {
                                                                const existingDoc = userDocuments.find(ud => ud.docType === doc.type || ud.type === doc.type);
                                                                const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                                                const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));
                                                                return (
                                                                    <div key={idx} className="flex items-center justify-between p-3.5 bg-white border border-slate-200/60 rounded-xl hover:border-slate-300 transition-all shadow-sm">
                                                                        <div className="flex items-center gap-3">
                                                                            <span className={`material-symbols-outlined text-[18px] ${isUploaded ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                                                {isUploaded ? 'check_circle' : 'circle'}
                                                                            </span>
                                                                            <div>
                                                                                <span className="text-xs font-semibold text-slate-800">{doc.name}</span>
                                                                                {!isUploaded && (
                                                                                    <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${doc.required ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                                                                                        {doc.required ? 'Required' : 'Optional'}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSelectedDocType(doc.type);
                                                                                setSelectedDocName(doc.name);
                                                                                setSelectedDocCategory('applicant');
                                                                                setIsUploadModalOpen(true);
                                                                            }}
                                                                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                                                                                isUploaded 
                                                                                    ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200' 
                                                                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100/50'
                                                                            }`}
                                                                        >
                                                                            <span className="material-symbols-outlined text-[13px]">{isUploaded ? 'rate_review' : 'cloud_upload'}</span>
                                                                            {isUploaded ? 'Review / Edit' : 'Upload'}
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div> */}

                                        {/* Card 3: Father's Verification */}
                                        {/* {(() => {
                                                        const docs = getProfileDocumentRequirements(newStudent).filter(d => d.type.startsWith('father_'));
                                                        if (docs.length === 0) return null;
                                                        const fatherName = newStudent.family.fatherName || "Father";
                                                        return (
                                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm hover:shadow-md transition-all">
                                                                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                                                                    <span className="material-symbols-outlined text-[20px] text-indigo-600">hail</span>
                                                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">{fatherName}'s Documents</h4>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    {docs.map((doc, idx) => {
                                                                        const existingDoc = userDocuments.find(ud => ud.docType === doc.type || ud.type === doc.type);
                                                                        const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                                                        const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));
                                                                        return (
                                                                            <div key={idx} className="flex items-center justify-between p-3.5 bg-white border border-slate-200/60 rounded-xl hover:border-slate-300 transition-all shadow-sm">
                                                                                <div className="flex items-center gap-3">
                                                                                    <span className={`material-symbols-outlined text-[18px] ${isUploaded ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                                                        {isUploaded ? 'check_circle' : 'circle'}
                                                                                    </span>
                                                                                    <div>
                                                                                        <span className="text-xs font-semibold text-slate-800">{doc.name}</span>
                                                                                        {!isUploaded && (
                                                                                            <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${doc.required ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                                                                                                {doc.required ? 'Required' : 'Optional'}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setSelectedDocType(doc.type);
                                                                                        setSelectedDocName(doc.name);
                                                                                        setSelectedDocCategory('father');
                                                                                        setIsUploadModalOpen(true);
                                                                                    }}
                                                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                                                                                        isUploaded 
                                                                                            ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200' 
                                                                                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100/50'
                                                                                    }`}
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[13px]">{isUploaded ? 'rate_review' : 'cloud_upload'}</span>
                                                                                    {isUploaded ? 'Review / Edit' : 'Upload'}
                                                                                </button>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()} */}

                                        {/* Card 4: Mother's Verification */}
                                        {/* {(() => {
                                                        const docs = getProfileDocumentRequirements(newStudent).filter(d => d.type.startsWith('mother_'));
                                                        if (docs.length === 0) return null;
                                                        const motherName = newStudent.family.motherName || "Mother";
                                                        return (
                                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm hover:shadow-md transition-all">
                                                                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                                                                    <span className="material-symbols-outlined text-[20px] text-indigo-600">woman</span>
                                                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">{motherName}'s Documents</h4>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    {docs.map((doc, idx) => {
                                                                        const existingDoc = userDocuments.find(ud => ud.docType === doc.type || ud.type === doc.type);
                                                                        const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                                                        const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));
                                                                        return (
                                                                            <div key={idx} className="flex items-center justify-between p-3.5 bg-white border border-slate-200/60 rounded-xl hover:border-slate-300 transition-all shadow-sm">
                                                                                <div className="flex items-center gap-3">
                                                                                    <span className={`material-symbols-outlined text-[18px] ${isUploaded ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                                                        {isUploaded ? 'check_circle' : 'circle'}
                                                                                    </span>
                                                                                    <div>
                                                                                        <span className="text-xs font-semibold text-slate-800">{doc.name}</span>
                                                                                        {!isUploaded && (
                                                                                            <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${doc.required ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                                                                                                {doc.required ? 'Required' : 'Optional'}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setSelectedDocType(doc.type);
                                                                                        setSelectedDocName(doc.name);
                                                                                        setSelectedDocCategory('mother');
                                                                                        setIsUploadModalOpen(true);
                                                                                    }}
                                                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${isUploaded
                                                                                            ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                                                                                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100/50'
                                                                                        }`}
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[13px]">{isUploaded ? 'rate_review' : 'cloud_upload'}</span>
                                                                                    {isUploaded ? 'Review / Edit' : 'Upload'}
                                                                                </button>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()} */}

                                        {/* Card 5: Co-applicant Verification */}
                                        {/* {(() => {
                                                        const docs = getProfileDocumentRequirements(newStudent).filter(d => d.type.startsWith('coapplicant_'));
                                                        if (docs.length === 0) return null;
                                                        const coName = newStudent.coApplicant.name || "Co-applicant";
                                                        return (
                                                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm hover:shadow-md transition-all">
                                                                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-200">
                                                                    <span className="material-symbols-outlined text-[20px] text-indigo-600">group</span>
                                                                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">{coName}'s Documents</h4>
                                                                </div>
                                                                <div className="space-y-3">
                                                                    {docs.map((doc, idx) => {
                                                                        const existingDoc = userDocuments.find(ud => ud.docType === doc.type || ud.type === doc.type);
                                                                        const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                                                        const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));
                                                                        return (
                                                                            <div key={idx} className="flex items-center justify-between p-3.5 bg-white border border-slate-200/60 rounded-xl hover:border-slate-300 transition-all shadow-sm">
                                                                                <div className="flex items-center gap-3">
                                                                                    <span className={`material-symbols-outlined text-[18px] ${isUploaded ? 'text-emerald-500' : 'text-slate-400'}`}>
                                                                                        {isUploaded ? 'check_circle' : 'circle'}
                                                                                    </span>
                                                                                    <div>
                                                                                        <span className="text-xs font-semibold text-slate-800">{doc.name}</span>
                                                                                        {!isUploaded && (
                                                                                            <span className={`ml-2 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${doc.required ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                                                                                                {doc.required ? 'Required' : 'Optional'}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setSelectedDocType(doc.type);
                                                                                        setSelectedDocName(doc.name);
                                                                                        setSelectedDocCategory('coapplicant');
                                                                                        setIsUploadModalOpen(true);
                                                                                    }}
                                                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 ${
                                                                                        isUploaded 
                                                                                            ? 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200' 
                                                                                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100/50'
                                                                                    }`}
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[13px]">{isUploaded ? 'rate_review' : 'cloud_upload'}</span>
                                                                                    {isUploaded ? 'Review / Edit' : 'Upload'}
                                                                                </button>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()} */}
                                    </div>

                                    {/* Bottom Navigation Row */}
                                    {/* Bottom Navigation Row */}
                                    <div className="pt-8 border-t border-slate-100 flex justify-between items-center">
                                        <button type="button" onClick={() => setOnboardStep(2)} className="px-6 py-3.5 text-slate-600 font-bold text-xs uppercase tracking-widest hover:text-slate-900 transition-all flex items-center gap-2 bg-white border border-slate-200 rounded-2xl">
                                            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                                            Back to Profile
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleFinalOnboardSubmit}
                                            disabled={createLoading}
                                            className="px-8 py-3.5 bg-emerald-600 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 flex items-center gap-2 group disabled:opacity-50"
                                        >
                                            {createLoading ? 'Finalizing...' : 'Complete Onboarding'}
                                            {!createLoading && <span className="material-symbols-outlined text-[18px] group-hover:scale-110 transition-transform">verified</span>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : false ? (
                            /* STEP 3: Documents */
                            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-300 pb-12 mt-4">
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                                    <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                                <span className="material-symbols-outlined text-[24px]">folder_managed</span>
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold font-['Playfair_Display',serif] text-slate-900">Applicant Documents</h3>
                                                <p className="text-xs text-slate-500">Verify existing uploads or add missing documents.</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                const userId = createdUser?.id || createdUser?.uid || createdUser?._id;
                                                if (userId) fetchUserDocuments(userId);
                                            }}
                                            disabled={docsLoading}
                                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
                                        >
                                            <span className={`material-symbols-outlined text-[18px] ${docsLoading ? 'animate-spin' : ''}`}>sync</span>
                                            {docsLoading ? 'Syncing...' : 'Fetch from Student Profile'}
                                        </button>
                                    </div>

                                    <div className="space-y-10">
                                        {/* Category: Primary Applicant */}
                                        <div>
                                            <h4 className="text-[10px] font-bold font-['Playfair_Display',serif] uppercase tracking-widest text-emerald-600 mb-5 bg-emerald-50 px-3 py-1 rounded-full w-fit">Primary Applicant Documents</h4>
                                            <div className="space-y-3">
                                                {getStudentDocumentRequirements(newStudent).map((doc, i) => {
                                                    const existingDoc = userDocuments.find(ud => ud.docType === doc.type || ud.type === doc.type);
                                                    const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                                    const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));
                                                    return (
                                                        <div key={i} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isUploaded ? 'bg-emerald-50/30 border-emerald-100 shadow-sm' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                                            <div className="flex items-center gap-4">
                                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isUploaded ? 'bg-white text-emerald-500 border border-emerald-100' : 'bg-white border border-slate-200 text-slate-400'}`}>
                                                                    <span className="material-symbols-outlined text-[20px]">{isUploaded ? 'task_alt' : 'description'}</span>
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <h4 className="text-sm font-bold text-slate-900">{doc.name}</h4>
                                                                        {isUploaded && (
                                                                            <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded leading-none">In Profile</span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex items-center gap-3 mt-0.5">
                                                                        <p className="text-[10px] text-slate-500 font-medium">{doc.type.toUpperCase().replace('_', ' ')} • PDF/JPG/PNG</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                {isUploaded ? (
                                                                    <>
                                                                        <button onClick={() => viewFile(doc.type)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-2">
                                                                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                                                                            Review
                                                                        </button>
                                                                        <button
                                                                            onClick={async () => {
                                                                                try {
                                                                                    const userId = createdUser?.id || createdUser?.uid || createdUser?._id;
                                                                                    if (!userId) return;
                                                                                    await authApi.uploadDocument({
                                                                                        userId: userId,
                                                                                        docType: doc.type,
                                                                                        uploaded: true,
                                                                                        filePath: existingDoc.filePath
                                                                                    });
                                                                                    const meta = existingDoc.verificationMetadata;
                                                                                    if (meta) {
                                                                                        const extractedFields = meta.details?.extractedFields || meta.extractedFields || meta.ocrResult?.extractedFields || (typeof meta === 'object' ? meta : null);
                                                                                        if (extractedFields && Object.keys(extractedFields).length > 0) {
                                                                                            await autoFillFromOcr(doc.type, extractedFields);
                                                                                        }
                                                                                    }
                                                                                    alert(`✅ ${doc.name} verified and updated in user profile!`);
                                                                                    fetchUserDocuments(userId);
                                                                                } catch (e) {
                                                                                    console.error("Verification error:", e);
                                                                                    alert("Failed to update verification status");
                                                                                }
                                                                            }}
                                                                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-md shadow-emerald-600/10"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[16px]">verified</span>
                                                                            Verify
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="file"
                                                                            accept=".pdf,.jpg,.jpeg,.png"
                                                                            ref={el => {
                                                                                if (el) fileInputRefs.current[`applicant-${doc.type}`] = el;
                                                                            }}
                                                                            onChange={async (e) => {
                                                                                const file = e.target.files?.[0];
                                                                                if (file) {
                                                                                    await handleDocumentUpload(
                                                                                        file,
                                                                                        doc.type,
                                                                                        'applicant',
                                                                                        newStudent.firstName + ' ' + newStudent.lastName,
                                                                                        undefined
                                                                                    );
                                                                                    e.target.value = '';
                                                                                }
                                                                            }}
                                                                            hidden
                                                                        />
                                                                        <button
                                                                            onClick={() => fileInputRefs.current[`applicant-${doc.type}`]?.click()}
                                                                            disabled={uploadingDocs[`${doc.type}-applicant`] !== undefined}
                                                                            className="px-5 py-2.5 bg-white border border-indigo-100 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                        >
                                                                            <span className="material-symbols-outlined text-[16px]">
                                                                                {uploadingDocs[`${doc.type}-applicant`] !== undefined ? 'hourglass_top' : 'upload'}
                                                                            </span>
                                                                            {uploadingDocs[`${doc.type}-applicant`] !== undefined ?
                                                                                `${Math.round(uploadingDocs[`${doc.type}-applicant`])}%` :
                                                                                'Upload'
                                                                            }
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Category: Father's Documents */}
                                        <div className="pt-6 border-t border-slate-100">
                                            <div className="mb-5 flex items-center justify-between">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full w-fit">
                                                    {newStudent.coApplicant.isSameAsFather ? "Father & Co-applicant Documents" : "Father's Documents"} {newStudent.family.fatherName && `(${newStudent.family.fatherName})`}
                                                </h4>
                                                {!newStudent.family.fatherEmploymentType && (
                                                    <span className="text-[9px] text-slate-500 font-medium">📋 Select employment type to see required documents</span>
                                                )}
                                            </div>
                                            <div className="space-y-3">
                                                {newStudent.family.fatherEmploymentType ? (
                                                    getRequiredDocuments(newStudent.family.fatherEmploymentType, newStudent.family.fatherName || "Father", 'father').map((doc, i) => {
                                                        const existingDoc = userDocuments.find(ud => ud.docType === doc.type || ud.type === doc.type);
                                                        const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                                        const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));
                                                        return (
                                                            <div key={i} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isUploaded ? 'bg-emerald-50/30 border-emerald-100 shadow-sm' : doc.required ? 'bg-red-50/50 border-red-100' : 'bg-amber-50/50 border-amber-100'}`}>
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isUploaded ? 'bg-white text-emerald-500 border-emerald-100' : doc.required ? 'bg-white border-red-200 text-red-500' : 'bg-white border-amber-200 text-amber-500'}`}>
                                                                        <span className="material-symbols-outlined text-[20px]">{isUploaded ? 'task_alt' : doc.required ? 'exclamation' : 'info'}</span>
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="text-sm font-bold text-slate-900">{doc.name}</h4>
                                                                            {isUploaded && <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded leading-none">In Profile</span>}
                                                                            {!isUploaded && doc.required && <span className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black uppercase tracking-widest rounded leading-none">REQUIRED</span>}
                                                                            {!isUploaded && !doc.required && <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest rounded leading-none">OPTIONAL</span>}
                                                                        </div>
                                                                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">{doc.type.toUpperCase().replace(/_/g, ' ')} • PDF/JPG/PNG</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="file"
                                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                                        ref={el => {
                                                                            if (el) fileInputRefs.current[`father-${doc.type}`] = el;
                                                                        }}
                                                                        onChange={async (e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) {
                                                                                await handleDocumentUpload(
                                                                                    file,
                                                                                    doc.type,
                                                                                    'father',
                                                                                    newStudent.family.fatherName || 'Father',
                                                                                    newStudent.family.fatherEmploymentType
                                                                                );
                                                                                e.target.value = '';
                                                                            }
                                                                        }}
                                                                        hidden
                                                                    />
                                                                    <button
                                                                        onClick={() => fileInputRefs.current[`father-${doc.type}`]?.click()}
                                                                        disabled={uploadingDocs[`${doc.type}-father`] !== undefined}
                                                                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[11px] font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[16px]">
                                                                            {uploadingDocs[`${doc.type}-father`] !== undefined ? 'hourglass_top' : 'upload'}
                                                                        </span>
                                                                        {uploadingDocs[`${doc.type}-father`] !== undefined ?
                                                                            `${Math.round(uploadingDocs[`${doc.type}-father`])}%` :
                                                                            isUploaded ? 'Re-upload' : 'Upload'
                                                                        }
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center text-sm text-slate-600">
                                                        No documents required until employment type is selected in Profile
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Category: Mother's Documents */}
                                        <div className="pt-6 border-t border-slate-100">
                                            <div className="mb-5 flex items-center justify-between">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full w-fit">
                                                    {newStudent.coApplicant.isSameAsMother ? "Mother & Co-applicant Documents" : "Mother's Documents"} {newStudent.family.motherName && `(${newStudent.family.motherName})`}
                                                </h4>
                                                {!newStudent.family.motherEmploymentType && (
                                                    <span className="text-[9px] text-slate-500 font-medium">📋 Select employment type to see required documents</span>
                                                )}
                                            </div>
                                            <div className="space-y-3">
                                                {newStudent.family.motherEmploymentType ? (
                                                    getRequiredDocuments(newStudent.family.motherEmploymentType, newStudent.family.motherName || "Mother", 'mother').map((doc, i) => {
                                                        const existingDoc = userDocuments.find(ud => ud.docType === doc.type || ud.type === doc.type);
                                                        const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                                        const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));
                                                        return (
                                                            <div key={i} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isUploaded ? 'bg-emerald-50/30 border-emerald-100 shadow-sm' : doc.required ? 'bg-red-50/50 border-red-100' : 'bg-amber-50/50 border-amber-100'}`}>
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isUploaded ? 'bg-white text-emerald-500 border-emerald-100' : doc.required ? 'bg-white border-red-200 text-red-500' : 'bg-white border-amber-200 text-amber-500'}`}>
                                                                        <span className="material-symbols-outlined text-[20px]">{isUploaded ? 'task_alt' : doc.required ? 'exclamation' : 'info'}</span>
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="text-sm font-bold text-slate-900">{doc.name}</h4>
                                                                            {isUploaded && <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded leading-none">In Profile</span>}
                                                                            {!isUploaded && doc.required && <span className="px-1.5 py-0.5 bg-red-500 text-white text-[8px] font-black uppercase tracking-widest rounded leading-none">REQUIRED</span>}
                                                                            {!isUploaded && !doc.required && <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest rounded leading-none">OPTIONAL</span>}
                                                                        </div>
                                                                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">{doc.type.toUpperCase().replace(/_/g, ' ')} • PDF/JPG/PNG</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="file"
                                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                                        ref={el => {
                                                                            if (el) fileInputRefs.current[`mother-${doc.type}`] = el;
                                                                        }}
                                                                        onChange={async (e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) {
                                                                                await handleDocumentUpload(
                                                                                    file,
                                                                                    doc.type,
                                                                                    'mother',
                                                                                    newStudent.family.motherName || 'Mother',
                                                                                    newStudent.family.motherEmploymentType
                                                                                );
                                                                                e.target.value = '';
                                                                            }
                                                                        }}
                                                                        hidden
                                                                    />
                                                                    <button
                                                                        onClick={() => fileInputRefs.current[`mother-${doc.type}`]?.click()}
                                                                        disabled={uploadingDocs[`${doc.type}-mother`] !== undefined}
                                                                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[11px] font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[16px]">
                                                                            {uploadingDocs[`${doc.type}-mother`] !== undefined ? 'hourglass_top' : 'upload'}
                                                                        </span>
                                                                        {uploadingDocs[`${doc.type}-mother`] !== undefined ?
                                                                            `${Math.round(uploadingDocs[`${doc.type}-mother`])}%` :
                                                                            isUploaded ? 'Re-upload' : 'Upload'
                                                                        }
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center text-sm text-slate-600">
                                                        No documents required until employment type is selected in Profile
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Category: Other Co-applicant Documents */}
                                        <div className="pt-6 border-t border-slate-100">
                                            <div className="mb-5 flex items-center justify-between">
                                                <h4 className="text-[10px] font-black uppercase tracking-widest text-violet-600 bg-violet-50 px-3 py-1 rounded-full w-fit">Co-applicant Documents {newStudent.coApplicant.name && `(${newStudent.coApplicant.name})`}</h4>
                                                {!newStudent.coApplicant.employmentType && (
                                                    <span className="text-[9px] text-slate-500 font-medium">📋 Select employment type to see required documents</span>
                                                )}
                                            </div>
                                            <div className="space-y-3">
                                                {newStudent.coApplicant.employmentType ? (
                                                    [
                                                        ...getRequiredDocuments(newStudent.coApplicant.employmentType, newStudent.coApplicant.name || "Co-applicant", 'coapplicant')
                                                    ].map((doc, i) => {
                                                        const existingDoc = userDocuments.find(ud => ud.docType === doc.type || ud.type === doc.type);
                                                        const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                                        const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));
                                                        return (
                                                            <div key={i} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${isUploaded ? 'bg-emerald-50/30 border-emerald-100 shadow-sm' : doc.required ? 'bg-violet-50/50 border-violet-100' : 'bg-amber-50/50 border-amber-100'}`}>
                                                                <div className="flex items-center gap-4">
                                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isUploaded ? 'bg-white text-emerald-500 border-emerald-100' : doc.required ? 'bg-white border-violet-200 text-violet-500' : 'bg-white border-amber-200 text-amber-500'}`}>
                                                                        <span className="material-symbols-outlined text-[20px]">{isUploaded ? 'task_alt' : doc.required ? 'exclamation' : 'info'}</span>
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <h4 className="text-sm font-bold text-slate-900">{doc.name}</h4>
                                                                            {isUploaded && <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest rounded leading-none">In Profile</span>}
                                                                            {!isUploaded && doc.required && <span className="px-1.5 py-0.5 bg-violet-500 text-white text-[8px] font-black uppercase tracking-widest rounded leading-none">REQUIRED</span>}
                                                                            {!isUploaded && !doc.required && <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[8px] font-black uppercase tracking-widest rounded leading-none">OPTIONAL</span>}
                                                                        </div>
                                                                        <p className="text-[10px] text-slate-500 font-medium mt-0.5">{doc.type.toUpperCase().replace(/_/g, ' ')} • PDF/JPG/PNG</p>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="file"
                                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                                        ref={el => {
                                                                            if (el) fileInputRefs.current[`coapplicant-${doc.type}`] = el;
                                                                        }}
                                                                        onChange={async (e) => {
                                                                            const file = e.target.files?.[0];
                                                                            if (file) {
                                                                                await handleDocumentUpload(
                                                                                    file,
                                                                                    doc.type,
                                                                                    'coapplicant',
                                                                                    newStudent.coApplicant.name || 'Co-applicant',
                                                                                    newStudent.coApplicant.employmentType
                                                                                );
                                                                                e.target.value = '';
                                                                            }
                                                                        }}
                                                                        hidden
                                                                    />
                                                                    <button
                                                                        onClick={() => fileInputRefs.current[`coapplicant-${doc.type}`]?.click()}
                                                                        disabled={uploadingDocs[`${doc.type}-coapplicant`] !== undefined}
                                                                        className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-[11px] font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[16px]">
                                                                            {uploadingDocs[`${doc.type}-coapplicant`] !== undefined ? 'hourglass_top' : 'upload'}
                                                                        </span>
                                                                        {uploadingDocs[`${doc.type}-coapplicant`] !== undefined ?
                                                                            `${Math.round(uploadingDocs[`${doc.type}-coapplicant`])}%` :
                                                                            isUploaded ? 'Re-upload' : 'Upload'
                                                                        }
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                ) : (
                                                    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center text-sm text-slate-600">
                                                        No documents required until employment type is selected in Profile
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="sticky bottom-0 mt-8 py-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center z-10 px-8 rounded-b-2xl">
                                    <button type="button" onClick={() => setOnboardStep(2)} className="px-8 py-3.5 text-slate-600 font-bold text-[12px] uppercase tracking-widest hover:text-slate-900 transition-all flex items-center gap-2 bg-white border border-slate-200 rounded-2xl">
                                        <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                                        Back to Profile
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleFinalOnboardSubmit}
                                        disabled={createLoading}
                                        className="px-10 py-3.5 bg-emerald-600 text-white rounded-2xl font-bold text-[12px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 flex items-center gap-2 group disabled:opacity-50"
                                    >
                                        {createLoading ? 'Finalizing...' : 'Complete Onboarding'}
                                        {!createLoading && <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">verified</span>}
                                    </button>
                                </div>
                            </div>
                        ) : onboardStep === 4 ? (
                            /* STEP 4: Distribution / Sharing */
                            <div className="max-w-4xl mx-auto py-12 animate-in fade-in slide-in-from-bottom-8 duration-500">
                                <div className="text-center mb-12">
                                    <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[32px] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
                                        <span className="material-symbols-outlined text-[40px]">check_circle</span>
                                    </div>
                                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">Onboarding Distribution</h3>
                                    <p className="text-slate-500 text-sm font-medium mt-2 max-w-md mx-auto">
                                        Profile is finalized! You can now share the complete data bundle with the bank or the student.
                                    </p>
                                </div>

                                {!shareResult ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-6">
                                            <div className="flex items-center gap-4 mb-2">
                                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-[24px]">share</span>
                                                </div>
                                                <div>
                                                    <h4 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-900">Share Parameters</h4>
                                                    <p className="text-[10px] font-bold text-slate-400">Secure data distribution</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Recipient Type</label>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => { setShareTarget('bank'); setShareName(""); }}
                                                            className={`flex-1 py-3 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${shareTarget === 'bank' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                                                        >
                                                            🏦 Bank
                                                        </button>
                                                        {/* <button
                                                                        type="button"
                                                                        onClick={() => { setShareTarget('student'); setShareName(`${newStudent.firstName} ${newStudent.lastName}`); setShareEmail(newStudent.email); }}
                                                                        className={`flex-1 py-3 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${shareTarget === 'student' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
                                                                    >
                                                                        🎓 Student
                                                                    </button> */}
                                                    </div>
                                                </div>

                                                {shareTarget === 'bank' && (
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Bank Name</label>
                                                        <select value={shareName} onChange={e => handleBankSelect(e.target.value)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23475569' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', paddingRight: '2.5rem' }}>
                                                            <option value="">Select a bank</option>
                                                            {availableBanks.length > 0 ? (
                                                                availableBanks.map((b: any, idx: number) => (
                                                                    <option key={b.id || idx} value={b.name}>{b.name}</option>
                                                                ))
                                                            ) : (
                                                                <>
                                                                    <option value="IDFC FIRST Bank">IDFC FIRST Bank</option>
                                                                    <option value="Avanse Financial">Avanse Financial</option>
                                                                    <option value="Auxilo Finserve">Auxilo Finserve</option>
                                                                    <option value="HDFC Credila">HDFC Credila</option>
                                                                    <option value="Poonawalla Fincorp">Poonawalla Fincorp</option>
                                                                </>
                                                            )}
                                                        </select>
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Email Address</label>
                                                    <input type="email" value={shareEmail} onChange={e => setShareEmail(e.target.value)} placeholder="recipient@example.com" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Internal Note (Optional)</label>
                                                    <textarea value={shareMessage} onChange={e => setShareMessage(e.target.value)} rows={3} placeholder="Add a message for the recipient..." className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none" />
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleDistributionShare}
                                                disabled={isSharing || !shareEmail || (shareTarget === 'bank' && !shareName)}
                                                className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black text-[12px] uppercase tracking-widest hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 disabled:opacity-50"
                                            >
                                                {isSharing ? (shareTarget === 'student' ? 'Sharing with Student...' : 'Sharing with Bank...') : (shareTarget === 'student' ? 'Share with Student' : 'Share Complete Profile')}
                                                {!isSharing && <span className="material-symbols-outlined text-[20px]">send</span>}
                                            </button>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="bg-emerald-50/50 border border-emerald-100 p-8 rounded-[32px]">
                                                <h4 className="text-[12px] font-black uppercase tracking-[0.2em] text-emerald-700 mb-4 flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                                                    Security Protocol
                                                </h4>
                                                <ul className="space-y-4">
                                                    {[
                                                        { icon: 'lock', text: 'Secure unique access token generated per recipient' },
                                                        { icon: 'visibility', text: 'All documents shared in read-only format' },
                                                        { icon: 'history', text: 'Access is automatically logged for audit trail' },
                                                        { icon: 'timer', text: 'Link automatically expires after 30 days' },
                                                    ].map((item, i) => (
                                                        <li key={i} className="flex items-start gap-3">
                                                            <span className="material-symbols-outlined text-[16px] text-emerald-600 mt-0.5">{item.icon}</span>
                                                            <span className="text-[11px] font-bold text-slate-600 leading-relaxed">{item.text}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <button onClick={resetOnboardModal} className="w-full py-5 border-2 border-slate-200 text-slate-500 rounded-[24px] font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center justify-center gap-3">
                                                Finish Without Sharing
                                                <span className="material-symbols-outlined text-[18px]">close</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-white p-12 rounded-[40px] border border-slate-100 shadow-2xl text-center space-y-8 animate-in zoom-in-95 duration-500">
                                        <div className="w-24 h-24 bg-gradient-to-tr from-emerald-400 to-emerald-600 text-white rounded-[32px] flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20 rotate-6 hover:rotate-0 transition-all duration-300">
                                            <span className="material-symbols-outlined text-[48px]">check_circle</span>
                                        </div>
                                        <div>
                                            <h4 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Verification Complete</h4>
                                            <p className="text-slate-500 text-sm font-medium">The secure application has been successfully generated.</p>
                                        </div>

                                        {/* Clean & Premium Application ID Card */}
                                        <div className="max-w-sm mx-auto bg-gradient-to-br from-indigo-50/60 via-indigo-50/20 to-slate-50 border border-indigo-100 p-6 rounded-3xl shadow-sm space-y-4">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1.5 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px]">assignment</span>
                                                    Loan Application ID
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl font-black text-slate-900 font-mono tracking-tight bg-white px-4 py-2 border border-slate-100 rounded-2xl shadow-sm">
                                                        {shareResult.applicationNumber || shareResult.applicationId || "PENDING"}
                                                    </span>
                                                    {(shareResult.applicationNumber || shareResult.applicationId) && (
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(shareResult.applicationNumber || shareResult.applicationId || "");
                                                                alert("Application ID copied!");
                                                            }}
                                                            className="p-3 bg-white text-indigo-600 rounded-2xl hover:text-indigo-700 hover:shadow-md hover:bg-slate-50 transition-all border border-indigo-100 shadow-sm"
                                                            title="Copy Application ID"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px] block">content_copy</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Neat Access Link Distribution Section */}
                                        <div className="max-w-sm mx-auto space-y-3">
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(shareResult.url);
                                                    alert("Portal access link copied!");
                                                }}
                                                className="w-full py-4 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:shadow-lg hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">share_windows</span>
                                                Copy Secure Access Link
                                            </button>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em]">
                                                Expires on: {new Date(shareResult.expires).toLocaleDateString()}
                                            </p>
                                        </div>

                                        <div className="pt-4 border-t border-slate-100 flex gap-4 w-full max-w-sm mx-auto">
                                            <button onClick={() => setShareResult(null)} className="flex-1 py-4 border border-slate-200 text-slate-600 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-50 transition-all">
                                                Share Again
                                            </button>
                                            <button onClick={resetOnboardModal} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/20">
                                                Close Workflow
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>

                    {/* Step 1 Footer */}
                    {onboardStep === 1 && (
                        <div className="p-8 bg-slate-50 border-t border-slate-200 flex justify-end gap-4 shrink-0">
                            <button type="button" onClick={resetOnboardModal} className="px-8 py-3.5 text-slate-500 font-bold text-[12px] uppercase tracking-widest hover:text-slate-900 transition-all border border-slate-200 bg-white rounded-2xl hover:shadow-md">Cancel</button>
                            <button form="quick-register-form" type="submit" disabled={createLoading} className="px-10 py-3.5 bg-emerald-600 text-white rounded-2xl font-bold text-[12px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-3 group">
                                {createLoading ? <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : "Register Applicant"}
                                {!createLoading && <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">arrow_forward</span>}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {selectedApp && (
                <ApplicationDetailView
                    application={selectedApp}
                    onBack={() => setSelectedApp(null)}
                    sidebarOpen={sidebarOpen}
                    setSidebarOpen={setSidebarOpen}
                    onAadhaarSaved={(aadhaarNumber) => {
                        const appUserId = selectedApp.userId || selectedApp.applicantId;
                        const onboardUserId = createdUser?.id || createdUser?.uid || createdUser?._id;
                        if (appUserId && appUserId === onboardUserId) {
                            setNewStudent(prev => ({ ...prev, aadhaarNumber }));
                        }
                    }}
                    onApplicationUpdated={async () => {
                        await loadOverview();
                        // If we were viewing an app from the incoming queue and it was sent to bank,
                        // automatically navigate to Active Pipeline so staff sees the processed app
                        if (activeSection === 'incoming_queue') {
                            navigateToSection('applications');
                        } else {
                            await loadData();
                        }
                    }}
                />
            )
            }



            <SendEmailModal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                recipientEmail={emailModalRecipient}
                recipientName={emailModalRecipientName}
            />

            {/* Document Preview Modal / Right Side-Drawer */}
            {previewDoc && (
                <div className="fixed inset-0 z-[100] flex items-center justify-end p-0 bg-slate-900/60 backdrop-blur-md transition-all animate-in fade-in duration-300" onClick={() => setPreviewDoc(null)}>
                    <div
                        className="w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Document Vault Viewer</span>
                                <h3 className="text-lg font-bold font-['Playfair_Display',serif] text-slate-900 mt-0.5">{previewDoc.name}</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <a
                                    href={previewDoc.url}
                                    download
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center"
                                    title="Open / Download Full File"
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

                        {/* Content */}
                        <div className="flex-1 bg-slate-100/40 p-8 flex items-center justify-center overflow-auto">
                            {previewDoc.url.toLowerCase().includes('.pdf') ||
                                previewDoc.name.toLowerCase().includes('pdf') ||
                                !/\.(jpg|jpeg|png|webp|gif)/i.test(previewDoc.url.split('?')[0]) ? (
                                <iframe
                                    src={previewDoc.url}
                                    className="w-full h-full rounded-2xl border border-slate-200 bg-white shadow-xl"
                                    title={previewDoc.name}
                                />
                            ) : (
                                <div className="relative max-w-full max-h-full rounded-2xl overflow-hidden shadow-2xl bg-white p-4 border border-slate-200">
                                    <img
                                        src={previewDoc.url}
                                        alt={previewDoc.name}
                                        className="max-w-full max-h-[70vh] object-contain rounded-xl"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Premium Interactive Document Upload Modal Popup */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md transition-all animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-5xl h-[85vh] rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300">
                        {/* Header Section */}
                        <div className="px-8 py-6 border-b border-slate-100 bg-white shrink-0">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                                    <span className="material-symbols-outlined text-indigo-600 text-2xl">cloud_upload</span>
                                    Upload Documents
                                </h3>
                                <button
                                    onClick={() => setIsUploadModalOpen(false)}
                                    className="w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-all border border-slate-100 hover:scale-105"
                                >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>

                            {/* Simplified Info Banner */}
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                                <span className="material-symbols-outlined text-indigo-600 text-[18px]">verified_user</span>
                                <span>Primary identity & KYC documents are required for background verification.</span>
                            </div>
                        </div>

                        {/* Split-Screen Main Content Body */}
                        <div className="flex-1 overflow-hidden flex min-h-0">
                            {/* LEFT SIDEBAR PANEL: Interactive Documents List */}
                            <div className="w-5/12 bg-slate-50/50 border-r border-slate-100 flex flex-col min-h-0">
                                <div className="px-6 py-4 border-b border-slate-100 bg-white shrink-0 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-indigo-600 text-[18px]">folder_special</span>
                                    <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Document Vault Workspace</span>
                                </div>

                                {/* Dynamic Document Items List */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar bg-slate-50/30">
                                    {(() => {
                                        const groups = [
                                            {
                                                title: "Student KYC & Identity",
                                                icon: "fingerprint",
                                                items: getStudentDocumentRequirements(newStudent).filter(d => ['passport', 'national_id', 'pan'].includes(d.type)),
                                                category: 'applicant' as const
                                            },
                                            {
                                                title: "Student Academic Docs",
                                                icon: "school",
                                                items: getStudentDocumentRequirements(newStudent).filter(d => ['marksheet_10', 'marksheet_12', 'ug_transcript', 'ug_degree', 'pg_transcript', 'pg_degree', 'english_test', 'aptitude_test', 'resume', 'work_letters'].includes(d.type)),
                                                category: 'applicant' as const
                                            },
                                            {
                                                title: `${newStudent.family.fatherName || "Father"}'s Documents`,
                                                icon: "hail",
                                                items: getProfileDocumentRequirements(newStudent).filter(d => d.type.startsWith('father_')),
                                                category: 'father' as const
                                            },
                                            {
                                                title: `${newStudent.family.motherName || "Mother"}'s Documents`,
                                                icon: "woman",
                                                items: getProfileDocumentRequirements(newStudent).filter(d => d.type.startsWith('mother_')),
                                                category: 'mother' as const
                                            },
                                            {
                                                title: `${newStudent.coApplicant.name || "Co-applicant"}'s Documents`,
                                                icon: "group",
                                                items: getProfileDocumentRequirements(newStudent).filter(d => d.type.startsWith('coapplicant_')),
                                                category: 'coapplicant' as const
                                            }
                                        ];

                                        return groups.map((g, gIdx) => {
                                            if (g.items.length === 0) return null;

                                            return (
                                                <div key={gIdx} className="space-y-3">
                                                    <div className="flex items-center gap-1.5 px-1 py-1 shrink-0">
                                                        <span className="material-symbols-outlined text-slate-400 text-[15px]">{g.icon}</span>
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{g.title}</span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {g.items.map((doc, idx) => {
                                                            const existingDoc = userDocuments.find(ud => ud.docType === doc.type || ud.type === doc.type);
                                                            const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                                            const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));
                                                            const isActive = selectedDocType === doc.type;

                                                            let helper = "Required KYC / financial document";
                                                            if (doc.type === 'passport' || doc.type === 'national_id' || doc.type === 'pan') helper = "Fills identity and compliance details";
                                                            else if (doc.type === 'marksheet_10' || doc.type === 'marksheet_12' || doc.type === 'marksheet_ug' || doc.type === 'marksheet_pg') helper = "Fills fields of Academic qualifications";
                                                            else if (doc.type === 'resume') helper = "Fills fields of Work Experience Details";
                                                            else if (doc.type === 'english_test') helper = "Fills selected Tests Details";

                                                            return (
                                                                <div
                                                                    key={idx}
                                                                    onClick={() => {
                                                                        setSelectedDocType(doc.type);
                                                                        setSelectedDocName(doc.name);
                                                                        setSelectedDocCategory(g.category);
                                                                    }}
                                                                    className={`relative p-3.5 rounded-xl border transition-all cursor-pointer ${isActive
                                                                        ? 'bg-white border-indigo-600 shadow-md shadow-indigo-600/5'
                                                                        : isUploaded
                                                                            ? 'bg-emerald-50/20 border-emerald-100 hover:border-emerald-200'
                                                                            : 'bg-white border-slate-200/80 hover:border-slate-300'
                                                                        }`}
                                                                >
                                                                    {isActive && (
                                                                        <div className="absolute right-[-1px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[6px] border-r-indigo-600 z-10" />
                                                                    )}

                                                                    <div className="pr-1">
                                                                        <div className="flex items-start justify-between gap-2">
                                                                            <div>
                                                                                <h4 className="text-[11px] font-bold text-slate-800 leading-tight">{doc.name}</h4>
                                                                                <p className="text-[8px] text-slate-400 font-semibold mt-0.5 leading-normal">{helper}</p>
                                                                            </div>
                                                                            {isUploaded && (
                                                                                <span className="w-4.5 h-4.5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/10">
                                                                                    <span className="material-symbols-outlined text-[10px] font-black">check</span>
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {isUploaded && existingDoc && (
                                                                            <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-dashed border-slate-100 text-[8px] font-black uppercase tracking-wider" onClick={(e) => e.stopPropagation()}>
                                                                                <button
                                                                                    onClick={() => viewFile(doc.type)}
                                                                                    className="text-red-500 hover:text-red-600 hover:underline flex items-center gap-0.5 leading-none"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[11px] font-black">description</span>
                                                                                    Review File
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleDocumentDelete(doc.type, g.category, doc.name)}
                                                                                    className="text-slate-400 hover:text-rose-600 flex items-center gap-0.5 transition-colors leading-none"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-[12px]">delete</span>
                                                                                    Remove
                                                                                </button>
                                                                            </div>
                                                                        )}

                                                                        {doc.type === 'english_test' && (
                                                                            <div className="mt-2.5" onClick={(e) => e.stopPropagation()}>
                                                                                <div className="relative">
                                                                                    <select
                                                                                        value={selectedTestType}
                                                                                        onChange={(e) => setSelectedTestType(e.target.value)}
                                                                                        className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 pr-7 text-[9px] font-bold text-slate-600 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer"
                                                                                    >
                                                                                        <option value="Select Test">Select Test</option>
                                                                                        <option value="IELTS">IELTS</option>
                                                                                        <option value="TOEFL">TOEFL</option>
                                                                                        <option value="PTE">PTE Academic</option>
                                                                                        <option value="Duolingo">Duolingo Test</option>
                                                                                    </select>
                                                                                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[12px]">expand_more</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>

                            {/* RIGHT CONTENT PANEL: Active Upload Zone & Instructions */}
                            {(() => {
                                const docType = selectedDocType;
                                const personType = selectedDocCategory;
                                const uploadKey = `${docType}-${personType}`;
                                const isUploading = uploadingDocs[uploadKey] !== undefined;
                                const uploadProgress = uploadingDocs[uploadKey] ?? 0;
                                const uploadError = uploadErrors[uploadKey];
                                const uploadFeedback = uploadMessages[uploadKey];
                                const autofillFeedback = autofillMessages[uploadKey];

                                const existingDoc = userDocuments.find(ud => ud.docType === docType || ud.type === docType);
                                const existingStatus = String(existingDoc?.status || "").toLowerCase();
                                const isUploaded = Boolean(existingDoc?.uploaded || ["uploaded", "verified"].includes(existingStatus));

                                let personName = newStudent.firstName + ' ' + newStudent.lastName;
                                let employmentType = undefined;
                                if (personType === 'father') {
                                    personName = newStudent.family.fatherName || 'Father';
                                    employmentType = newStudent.family.fatherEmploymentType;
                                } else if (personType === 'mother') {
                                    personName = newStudent.family.motherName || 'Mother';
                                    employmentType = newStudent.family.motherEmploymentType;
                                } else if (personType === 'coapplicant') {
                                    personName = newStudent.coApplicant.name || 'Co-applicant';
                                    employmentType = newStudent.coApplicant.employmentType;
                                }

                                let customInstruction = "Merge the front and back pages of student's Passport and upload it as a single file.";
                                if (docType.includes('marksheet')) {
                                    customInstruction = `Provide all semesters / consolidated marksheet copies for student's ${selectedDocName}.`;
                                } else if (docType === 'resume') {
                                    customInstruction = "Upload student's detailed CV covering academics, projects and work milestones.";
                                } else if (docType.includes('pan')) {
                                    customInstruction = "Provide clear scanned copy of PAN Card with legible signature and photograph.";
                                } else if (docType.includes('aadhar')) {
                                    customInstruction = "Merge the front side and back side of Aadhaar card into a single PDF or image file.";
                                }

                                return (
                                    <div className="w-7/12 p-8 flex flex-col justify-between overflow-y-auto no-scrollbar bg-white">
                                        <div className="space-y-6">
                                            <div>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                                                    {personType.toUpperCase()} - {selectedDocName}
                                                </span>
                                                <h4 className="text-lg font-black text-slate-800 tracking-tight mt-2">{selectedDocName} Workspace</h4>
                                                <p className="text-xs text-slate-400 font-semibold mt-1">Upload, review and verify metadata using premium AI extraction.</p>
                                            </div>

                                            {(uploadFeedback || uploadError) && (
                                                <div
                                                    className={`rounded-2xl px-4 py-3 text-xs font-bold border animate-in fade-in slide-in-from-top-2 duration-200 ${uploadFeedback?.type === 'success'
                                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                        : uploadFeedback?.type === 'warning'
                                                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                                        }`}
                                                >
                                                    {uploadFeedback?.text || uploadError}
                                                </div>
                                            )}

                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png"
                                                ref={el => {
                                                    if (el) fileInputRefs.current[`modal-${uploadKey}`] = el;
                                                }}
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        await handleDocumentUpload(file, docType, personType, personName, employmentType);
                                                        e.target.value = '';
                                                    }
                                                }}
                                                hidden
                                            />

                                            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-3xl p-8 text-center transition-all bg-slate-50/50 flex flex-col items-center justify-center min-h-[220px]">
                                                {isUploaded && existingDoc ? (
                                                    <div className="space-y-4 animate-in fade-in duration-300">
                                                        <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center border border-emerald-100 shadow-md shadow-emerald-500/5 mx-auto">
                                                            <span className="material-symbols-outlined text-[32px] font-black">check</span>
                                                        </div>
                                                        <div>
                                                            <h5 className="text-sm font-bold text-slate-800 tracking-tight">{existingDoc.fileName || existingDoc.filename || `${selectedDocName}.pdf`}</h5>
                                                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-1">Upload Complete</p>
                                                            {uploadFeedback && (
                                                                <p className={`text-[10px] font-bold mt-2 max-w-sm mx-auto px-3 py-1.5 rounded-lg border ${uploadFeedback.type === 'success'
                                                                    ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                                                                    : uploadFeedback.type === 'warning'
                                                                        ? 'text-amber-700 bg-amber-50 border-amber-100'
                                                                        : 'text-rose-700 bg-rose-50 border-rose-100'
                                                                    }`}>
                                                                    {uploadFeedback.text}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-3 justify-center pt-2">
                                                            <button
                                                                onClick={() => viewFile(docType)}
                                                                className="px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl text-xs font-bold hover:bg-slate-50 hover:shadow-sm transition-all flex items-center gap-1.5"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">visibility</span>
                                                                Review File
                                                            </button>
                                                            <button
                                                                onClick={() => fileInputRefs.current[`modal-${uploadKey}`]?.click()}
                                                                className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold hover:shadow-sm transition-all flex items-center gap-1.5"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">replay</span>
                                                                Re-upload
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : isUploading ? (
                                                    <div className="space-y-4 animate-in fade-in duration-200">
                                                        <div className="relative w-16 h-16 rounded-full border-4 border-slate-100 border-t-indigo-600 animate-spin mx-auto flex items-center justify-center" />
                                                        <div>
                                                            <h5 className="text-xs font-bold text-slate-800">Uploading File...</h5>
                                                            <p className="text-[11px] font-bold text-indigo-600 mt-1">{Math.round(uploadProgress)}% Complete</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        onClick={() => fileInputRefs.current[`modal-${uploadKey}`]?.click()}
                                                        className="space-y-4 cursor-pointer hover:scale-[1.01] transition-transform duration-200 w-full py-4"
                                                    >
                                                        <div className="w-14 h-14 bg-white border border-slate-100 shadow-sm rounded-2xl flex items-center justify-center text-slate-400 mx-auto">
                                                            <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-700">Drag & drop student file here, or <span className="text-indigo-600 hover:underline">browse</span></p>
                                                            <p className="text-[10px] text-slate-400 font-semibold mt-1">Supports PDF, JPG, PNG files up to 5MB</p>
                                                        </div>
                                                        {uploadError && (
                                                            <p className="text-[10px] text-rose-500 font-bold bg-rose-50 px-3 py-1 rounded-md border border-rose-100 max-w-xs mx-auto">{uploadError}</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="border-t border-slate-100 pt-6 space-y-4">
                                                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                                                    <span className="material-symbols-outlined text-slate-400 text-[18px]">info</span>
                                                    Instructions:
                                                </h5>
                                                <ul className="text-[11px] text-slate-500 font-semibold space-y-2.5 list-disc pl-5 leading-relaxed">
                                                    <li>{customInstruction}</li>
                                                    <li>Maximum 2 successful file uploads per document</li>
                                                    <li>This functionality supports only .jpg, .png, and .pdf files.</li>
                                                    <li>This functionality supports files up to 5 MB.</li>
                                                    <li>This functionality supports one file at a time.</li>
                                                    <li>If you remove the document, you will lose the information in the corresponding section.</li>
                                                </ul>
                                            </div>
                                        </div>

                                        {autofillFeedback && (
                                            <div
                                                className={`mt-4 rounded-2xl px-4 py-3 text-xs font-bold border animate-in fade-in duration-200 ${autofillFeedback.type === 'success'
                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                                    }`}
                                            >
                                                {autofillFeedback.text}
                                            </div>
                                        )}

                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (!isUploaded || !existingDoc) {
                                                    setAutofillMessages(prev => ({
                                                        ...prev,
                                                        [uploadKey]: { type: 'error', text: 'Please upload the document first before using Autofill.' },
                                                    }));
                                                    return;
                                                }
                                                const userId = createdUser?.id || createdUser?.uid || createdUser?._id;
                                                if (!userId) return;

                                                const meta = existingDoc.verificationMetadata || existingDoc.metadata;
                                                let extractedFields = meta?.details?.extractedFields || meta?.extractedFields || meta?.ocrResult?.extractedFields;

                                                if ((!extractedFields || Object.keys(extractedFields).length === 0) && ocrResults[uploadKey]) {
                                                    extractedFields = ocrResults[uploadKey];
                                                }

                                                if (!extractedFields || Object.keys(extractedFields).length === 0) {
                                                    try {
                                                        const res: any = await documentApi.ocrReverify(userId, docType);
                                                        extractedFields = res?.data?.extractedFields || res?.data?.ocrResult?.extractedFields;
                                                        if (extractedFields && Object.keys(extractedFields).length > 0) {
                                                            await fetchUserDocuments(userId);
                                                        }
                                                    } catch (err: any) {
                                                        setAutofillMessages(prev => ({
                                                            ...prev,
                                                            [uploadKey]: {
                                                                type: 'error',
                                                                text: `OCR extraction failed: ${err?.message || 'Could not read document. Please re-upload a clear image.'}`,
                                                            },
                                                        }));
                                                        return;
                                                    }
                                                }

                                                if (extractedFields && Object.keys(extractedFields).length > 0) {
                                                    const result = await autoFillFromOcr(docType, extractedFields);
                                                    setAutofillMessages(prev => ({
                                                        ...prev,
                                                        [uploadKey]: {
                                                            type: result.filled ? 'success' : 'error',
                                                            text: result.filled ? `✨ ${result.message}` : result.message,
                                                        },
                                                    }));
                                                } else {
                                                    setAutofillMessages(prev => ({
                                                        ...prev,
                                                        [uploadKey]: {
                                                            type: 'error',
                                                            text: 'Could not extract data from this document. Please upload a clearer image or PDF.',
                                                        },
                                                    }));
                                                }
                                            }}
                                            className="w-full mt-6 py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.99] text-white rounded-2xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">magic_button</span>
                                            Autofill
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
