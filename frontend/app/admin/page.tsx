"use client";

import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { adminApi, assignmentApi, staffProfileApi, referenceApi } from "@/lib/api";
import { format, formatDistanceToNow } from "date-fns";
import ChatInterface from "@/components/Chat/ChatInterface";
import CampaignsDashboard from "@/components/Admin/CampaignsDashboard";
import AdminBanksSection from "@/components/Admin/AdminBanksSection";
import AdminCountriesSection from "@/components/Admin/AdminCountriesSection";
import SiteSettingsSection from "@/components/Admin/SiteSettingsSection";

// ─── Application Progress & Helpers ──────────────────────────────────────────────

const getApplicationDisplayProgress = (app: any): number => {
    const status = (app.status || "").toLowerCase();
    const stage = (app.stage || "").toLowerCase();
    const bankWorkflow = (app.bankWorkflowStatus || "").toUpperCase();

    if (status === "disbursed" || status === "disbursement_confirmed" || status === "closed" || bankWorkflow === "DISBURSED") return 100;
    if (status === "approved" || stage === "sanction" || stage === "sanctioned") return Math.max(app.progress ?? 0, 95);
    if (stage === "bank_review" || status === "under_bank_review" || status === "processing") return Math.max(app.progress ?? 0, 85);
    if (stage === "credit_check" || status === "query_raised") return Math.max(app.progress ?? 0, 70);
    if (stage === "submit_to_bank" || stage === "bank_submission" || status === "submitted_to_bank" || status === "file_logged") return Math.max(app.progress ?? 0, 50);
    if (stage === "document_verification" || stage === "documents_verification" || status === "staff_verified" || status === "docs_received" || status === "docs_uploaded" || status === "under_review") return Math.max(app.progress ?? 0, 35);
    if (status === "submitted" || stage === "application_submitted") return Math.max(app.progress ?? 0, 20);
    return app.progress ?? 10;
};

const getApplicationStageLabel = (app: any, progress: number): string => {
    if (app.currentStage) return app.currentStage;
    const status = (app.status || "").toLowerCase();
    if (status === "disbursed" || status === "disbursement_confirmed" || status === "closed") return "Disbursed";
    if (status === "approved") return "Sanction Approved";
    if (status === "rejected") return "Rejected";
    if (progress <= 15) return "Created";
    if (progress <= 25) return "Submitted";
    if (progress <= 40) return "Documents";
    if (progress <= 55) return "Submit to Bank";
    if (progress <= 75) return "Credit & Eligibility";
    if (progress <= 90) return "Bank Underwriting";
    if (progress <= 98) return "Sanction Offer";
    return "Disbursement";
};

const renderBankLogo = (name?: string, sizeClass: string = "h-5") => {
    if (!name) return <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] font-semibold">N/A</span>;
    const b = name.toLowerCase();
    if (b.includes('idfc')) return <img src="/images/lenders/idfc-first-bank.jpg" alt="IDFC" className={`${sizeClass} object-contain inline-block`} />;
    if (b.includes('avanse')) return <img src="/images/lenders/avanse.jpg" alt="Avanse" className={`${sizeClass} object-contain inline-block`} />;
    if (b.includes('auxilo')) return <img src="/images/lenders/auxilo.png" alt="Auxilo" className={`${sizeClass} object-contain inline-block`} />;
    if (b.includes('credila') || b.includes('hdfc')) return <img src="/images/lenders/hdfc-credila.png" alt="Credila" className={`${sizeClass} object-contain inline-block`} />;
    if (b.includes('poonawalla')) return <img src="/images/lenders/poonawalla.png" alt="Poonawalla" className={`${sizeClass} object-contain inline-block`} />;
    return <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 text-[9px] font-semibold border border-slate-200">{name}</span>;
};

// ─── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon, color, trend, loading }: any) => (
    <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm group hover:border-indigo-200 transition-colors">
        <div className="flex justify-between items-start mb-3">
            <div className={`w-8 h-8 rounded bg-slate-50 flex items-center justify-center border border-slate-100 ${color.includes('text-') ? color : 'text-slate-600'}`}>
                <span className="material-symbols-outlined text-[16px]">{icon}</span>
            </div>
            {trend !== undefined && !loading && (
                <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${trend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    <span className="material-symbols-outlined text-[12px]">{trend >= 0 ? 'trending_up' : 'trending_down'}</span>
                    {Math.abs(trend)}%
                </span>
            )}
        </div>
        <div>
            <p className="text-slate-500 text-[11px] font-medium mb-0.5">{label}</p>
            <div className="text-[20px] font-semibold text-slate-900 tracking-tight">
                {loading ? <span className="h-6 bg-slate-100 animate-pulse rounded block w-16" /> : value ?? "—"}
            </div>
        </div>
    </div>
);

const NavItem = ({ section, active, icon, label, badge, onClick, expanded }: any) => (
    <button
        onClick={() => onClick(section)}
        title={label}
        className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors text-xs font-medium ${active === section ? "bg-indigo-500/10 text-indigo-400 font-bold" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
    >
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
            <span className={`material-symbols-outlined text-[18px] ${active === section ? "text-indigo-400" : "text-slate-500"}`}>{icon}</span>
        </div>
        <span className={`flex-1 transition-all duration-200 whitespace-nowrap truncate ${expanded ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
            {label}
        </span>
        {badge > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 transition-opacity duration-200 ${active === section ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'} ${expanded ? 'inline-flex' : 'hidden group-hover/sidebar:inline-flex'}`}>
                {badge > 99 ? '99+' : badge}
            </span>
        )}
    </button>
);

const TableHeader = ({ children }: { children: React.ReactNode }) => (
    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider font-semibold">
        <tr>{children}</tr>
    </thead>
);

// ─── Mini Bar Chart ─────────────────────────────────────────────────────────
const MiniBarChart = ({ data, color = '#1d4ed8' }: { data: number[], color?: string }) => {
    const max = Math.max(...data, 1);
    return (
        <div className="flex items-end gap-1 h-16">
            {data.map((v, i) => (
                <div
                    key={i}
                    className="flex-1 rounded-t-sm transition-all duration-500 hover:opacity-80"
                    style={{ height: `${(v / max) * 100}%`, backgroundColor: color, opacity: 0.3 + (i / data.length) * 0.7 }}
                    title={`${v}`}
                />
            ))}
        </div>
    );
};

// ─── Donut Chart ─────────────────────────────────────────────────────────────
const DonutChart = ({ segments }: { segments: { label: string; value: number; color: string }[] }) => {
    const total = segments.reduce((a, b) => a + b.value, 0) || 1;
    let cumulative = 0;
    const SIZE = 120;
    const RADIUS = 45;
    const STROKE = 18;
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const circumference = 2 * Math.PI * RADIUS;

    return (
        <div className="flex items-center gap-6">
            <svg width={SIZE} height={SIZE} className="flex-shrink-0 -rotate-90">
                <circle cx={cx} cy={cy} r={RADIUS} fill="none" stroke="#f3f4f6" strokeWidth={STROKE} />
                {segments.map((seg, i) => {
                    const fraction = seg.value / total;
                    const dash = fraction * circumference;
                    const gap = circumference - dash;
                    const offset = cumulative * circumference;
                    cumulative += fraction;
                    return (
                        <circle
                            key={i}
                            cx={cx} cy={cy} r={RADIUS}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={STROKE}
                            strokeDasharray={`${dash} ${gap}`}
                            strokeDashoffset={-offset}
                            className="transition-all duration-700"
                        />
                    );
                })}
            </svg>
            <div className="space-y-2 flex-1">
                {segments.map((seg, i) => (
                    <div key={i} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
                            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">{seg.label}</span>
                        </div>
                        <span className="text-xs font-black text-gray-900">{seg.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Health Indicator ─────────────────────────────────────────────────────────
const HealthDot = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
        <span className="text-xs font-bold text-gray-600">{label}</span>
        <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-red-500 shadow-[0_0_6px_#ef4444]'} animate-pulse`} />
            <span className={`text-[10px] font-bold uppercase tracking-wider ${ok ? 'text-emerald-600' : 'text-red-500'}`}>
                {ok ? 'Online' : 'Degraded'}
            </span>
        </div>
    </div>
);



// ─── Announcement Banner ──────────────────────────────────────────────────────
const AnnouncementItem = ({ ann, onDelete }: { ann: any; onDelete: (id: string) => void }) => (
    <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-slate-200 shadow-sm transition-all group">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${ann.type === 'warning' ? 'bg-amber-50 text-amber-600' : ann.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
            <span className="material-symbols-outlined text-[16px]">
                {ann.type === 'warning' ? 'warning' : ann.type === 'error' ? 'error' : 'info'}
            </span>
        </div>
        <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-semibold text-slate-900 leading-tight">{ann.title}</p>
                <span className="text-[10px] text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded bg-slate-50 whitespace-nowrap">{formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{ann.message}</p>
            <div className="flex items-center justify-between mt-2">
                <span className={`text-[9px] font-medium px-2 py-0.5 rounded ${ann.target === 'all' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                    Target: {ann.target === 'all' ? 'System-wide' : ann.target}
                </span>
                <button onClick={() => onDelete(ann.id)} className="opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:text-rose-600 rounded transition-all">
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                </button>
            </div>
        </div>
    </div>
);

// ─── Section URL Route Mappings ────────────────────────────────────────────────
const sectionToPathMap: Record<string, string> = {
    overview: '/admin/dashboard',
    applications: '/admin/applications',
    users: '/admin/users',
    users_students: '/admin/users/students',
    users_staff: '/admin/users/staff',
    users_agents: '/admin/users/agents',
    users_banks: '/admin/users/banks',
    analytics: '/admin/analytics',
    system: '/admin/system',
    banks: '/admin/banks',
    countries: '/admin/countries',
    chat: '/admin/chat',
    community: '/admin/community',
    audit_logs: '/admin/audit-logs',
    blogs: '/admin/blogs',
    campaigns_dashboard: '/admin/campaigns',
    campaigns_create: '/admin/campaigns/create',
    campaigns_templates: '/admin/campaigns/templates',
    campaigns_audience: '/admin/campaigns/audience',
    campaigns_scheduled: '/admin/campaigns/scheduled',
    campaigns_queued: '/admin/campaigns/queued',
    campaigns_sent: '/admin/campaigns/sent',
    campaigns_analytics: '/admin/campaigns/analytics',
    campaigns_prompts: '/admin/campaigns/prompts',
    campaigns_settings: '/admin/campaigns/settings',
};

const pathToSectionMap: Record<string, string> = {
    '/admin': 'overview',
    '/admin/dashboard': 'overview',
    '/admin/applications': 'applications',
    '/admin/users': 'users_students',
    '/admin/users/students': 'users_students',
    '/admin/users/user': 'users_students',
    '/admin/users/staff': 'users_staff',
    '/admin/staff': 'users_staff',
    '/admin/users/agents': 'users_agents',
    '/admin/users/agent': 'users_agents',
    '/admin/agents': 'users_agents',
    '/admin/users/banks': 'users_banks',
    '/admin/users/bank': 'users_banks',
    '/admin/analytics': 'analytics',
    '/admin/system': 'system',
    '/admin/banks': 'banks',
    '/admin/countries': 'countries',
    '/admin/chat': 'chat',
    '/admin/community': 'community',
    '/admin/audit-logs': 'audit_logs',
    '/admin/blogs': 'blogs',
    '/admin/campaigns': 'campaigns_dashboard',
    '/admin/campaigns/create': 'campaigns_create',
    '/admin/campaigns/templates': 'campaigns_templates',
    '/admin/campaigns/audience': 'campaigns_audience',
    '/admin/campaigns/scheduled': 'campaigns_scheduled',
    '/admin/campaigns/queued': 'campaigns_queued',
    '/admin/campaigns/sent': 'campaigns_sent',
    '/admin/campaigns/analytics': 'campaigns_analytics',
    '/admin/campaigns/prompts': 'campaigns_prompts',
    '/admin/campaigns/settings': 'campaigns_settings',
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { user, logout } = useAuth();
    const { settings: siteSettings } = useSiteSettings();

    // Resolve initial activeSection from current URL path or search params
    const getInitialSection = () => {
        const querySec = searchParams ? searchParams.get('section') : null;
        if (querySec && sectionToPathMap[querySec]) return querySec;
        if (pathname && pathToSectionMap[pathname]) return pathToSectionMap[pathname];
        return 'overview';
    };

    const [activeSection, setActiveSectionState] = useState(getInitialSection);

    // Synchronize activeSection state when browser location path changes
    useEffect(() => {
        const querySec = searchParams ? searchParams.get('section') : null;
        if (querySec && sectionToPathMap[querySec]) {
            setActiveSectionState(querySec);
        } else if (pathname && pathToSectionMap[pathname]) {
            setActiveSectionState(pathToSectionMap[pathname]);
        }
    }, [pathname, searchParams]);

    // Custom setter that updates component state AND updates browser URL path
    const setActiveSection = useCallback((sec: string) => {
        setActiveSectionState(sec);
        const targetPath = sectionToPathMap[sec] || '/admin/dashboard';
        if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
            window.history.pushState(null, '', targetPath);
        }
    }, []);
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>({});
    const [data, setData] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [lastSearchQuery, setLastSearchQuery] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterBank, setFilterBank] = useState("all");
    const [filterLoanType, setFilterLoanType] = useState("all");
    const [filterStage, setFilterStage] = useState("all");
    const [filterStaff, setFilterStaff] = useState("all");
    const [appPage, setAppPage] = useState(1);
    const [staffMembers, setStaffMembers] = useState<any[]>([]);
    const [reassigningAppId, setReassigningAppId] = useState<string | null>(null);
    const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
    const [bulkTargetStaffId, setBulkTargetStaffId] = useState<string>("");
    const [bulkReassigning, setBulkReassigning] = useState<boolean>(false);
    const [filterFromDate, setFilterFromDate] = useState("");
    const [filterToDate, setFilterToDate] = useState("");
    const [filterBlogTime, setFilterBlogTime] = useState("all");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [usersExpanded, setUsersExpanded] = useState(true);
    const [supportExpanded, setSupportExpanded] = useState(false);
    const [marketingExpanded, setMarketingExpanded] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);

    // Application detail modal
    const [selectedApp, setSelectedApp] = useState<any>(null);
    const [actionRemarks, setActionRemarks] = useState("");
    const [actionLoading, setActionLoading] = useState(false);

    // Create user
    const [showCreateUserModal, setShowCreateUserModal] = useState(false);
    const [createUserLoading, setCreateUserLoading] = useState(false);
    const [newUserQuery, setNewUserQuery] = useState({
        email: "", firstName: "", lastName: "", middleName: "", mobile: "", role: "user", bank: "",
        officeId: "", officeLocation: "",
        mailboxEmail: "", mailboxPrefix: "", canAccessSupport: false,
        dob: "", gender: "", maritalStatus: "",
        mailingAddress: { address1: "", address2: "", city: "", state: "", country: "", pincode: "" },
        permanentAddress: { address1: "", address2: "", city: "", state: "", country: "", pincode: "" },
        passport: { number: "", issueDate: "", expiryDate: "", issueCountry: "", birthCity: "", birthCountry: "" },
        nationality: { name: "", citizenship: "", dualCitizenship: "No", dualNational: "", livingOtherCountry: "No", livingOtherCountryName: "" },
        background: { immigrationApplied: "No", immigrationAppliedCountry: "", medicalCondition: "No", medicalConditionDetails: "", visaRefusal: "No", visaRefusalDetails: "", criminalOffence: "No", criminalOffenceDetails: "" },
        emergencyContact: { name: "", phone: "", email: "", relation: "" },
        // Agent Partner specific fields
        partnership: "Individual Consultant",
        percentage: "1.5",
        panNumber: "",
        businessName: "",
        profilePhoto: "",
        gstin: "",
        officeAddress: "",
        documents: [] as { name: string; type: string; url?: string; uploadedAt?: string }[]
    });

    const openCreateUserModal = (defaultRole = "user") => {
        loadOffices();
        setNewUserQuery(prev => ({
            ...prev,
            role: defaultRole,
            bank: "",
            mailboxEmail: "",
            mailboxPrefix: "",
            canAccessSupport: false,
        }));
        setShowCreateUserModal(true);
    };

    const [editingUser, setEditingUser] = useState<any>(null);
    const [updateLoading, setUpdateLoading] = useState(false);

    // Email User Modal State
    const [emailModalUser, setEmailModalUser] = useState<any | null>(null);
    const [emailSubject, setEmailSubject] = useState<string>("");
    const [emailContent, setEmailContent] = useState<string>("");
    const [sendingEmail, setSendingEmail] = useState<boolean>(false);

    // AI Review
    const [aiReview, setAiReview] = useState<any>(null);
    const [aiReviewLoading, setAiReviewLoading] = useState(false);
    const [drawerTab, setDrawerTab] = useState<'details' | 'documents' | 'notes' | 'history' | 'ai_review'>('details');

    // Analytics
    const [analyticsData, setAnalyticsData] = useState<any>({});
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    // System / Announcements
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [newAnnouncement, setNewAnnouncement] = useState({ title: "", message: "", type: "info", target: "all" });
    const [annLoading, setAnnLoading] = useState(false);
    const [maintenanceMode, setMaintenanceMode] = useState(false);

    // Bank Partners & User Management Dropdown State
    const [bankPartners, setBankPartners] = useState<any[]>([]);
    const [bankPartnerFilter, setBankPartnerFilter] = useState<string>("all");
    const [comparedBankPartner, setComparedBankPartner] = useState<any>(null);
    const [userProfileTab, setUserProfileTab] = useState<'credentials' | 'applications' | 'bank_compare'>('credentials');
    const [updatingUserBank, setUpdatingUserBank] = useState(false);

    // Resolve assigned bank partner helper with authoritative metadata
    const getAssignedBank = useCallback((userObj: any) => {
        if (!userObj) return null;
        const rawBank = (userObj.bank || userObj.partnerBank || userObj.bankId || '').toString().trim();
        const cleanBank = rawBank.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        if (cleanBank && Array.isArray(bankPartners) && bankPartners.length > 0) {
            const directMatch = bankPartners.find((b: any) => {
                const bShort = (b.shortName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const bName = (b.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const bId = (b.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                return bShort === cleanBank || bName === cleanBank || bId === cleanBank ||
                       cleanBank.includes(bShort) || (bShort && bShort.includes(cleanBank)) ||
                       cleanBank.includes(bName) || (bName && bName.includes(cleanBank));
            });
            if (directMatch) return directMatch;
        }

        if (userObj.email && Array.isArray(bankPartners) && bankPartners.length > 0) {
            const domain = (userObj.email.split('@')[1] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const emailMatch = bankPartners.find((b: any) => {
                const bShort = (b.shortName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                const bName = (b.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                return (bShort && domain.includes(bShort)) || (bName && domain.includes(bName));
            });
            if (emailMatch) return emailMatch;
        }

        // Fuzzy match on user's name or email prefix (e.g. firstName: "idfc" or "auxilo")
        if (Array.isArray(bankPartners) && bankPartners.length > 0) {
            const nameParts = [userObj.firstName, userObj.lastName, (userObj.email || '').split('@')[0]]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '');
            const nameMatch = bankPartners.find((b: any) => {
                const bShort = (b.shortName || '').toLowerCase().trim();
                const bName = (b.name || '').toLowerCase().trim();
                return (bShort && bShort.length >= 3 && nameParts.includes(bShort)) ||
                       (bName && bName.length >= 4 && nameParts.includes(bName));
            });
            if (nameMatch) return nameMatch;
        }

        if (rawBank) {
            const formattedName = rawBank
                .split(/[-_]/)
                .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
                .join(' ');
            return {
                id: rawBank,
                name: formattedName,
                shortName: rawBank.toUpperCase(),
                type: 'Partner Bank Institution',
                interestRateMin: 8.5,
                interestRateMax: 13.5,
                maxLoanAmount: '₹1.50 Cr',
                collateralFreeLimit: '₹50 Lakhs',
                processingTime: '3-5 Days',
                processingFee: '0.5% - 1%',
                features: ['Direct Sanction Line', 'Pre-Visa Disbursal', 'Competitive ROI']
            };
        }

        return null;
    }, [bankPartners]);

    // Portal control - filter + bulk
    const [roleFilter, setRoleFilter] = useState("all");
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(30);
    const [totalItems, setTotalItems] = useState(0);

    // Full Audit Logs
    const [auditPage, setAuditPage] = useState(1);
    const [auditFilter, setAuditFilter] = useState("all");
    const [allAuditLogs, setAllAuditLogs] = useState<any[]>([]);

    // Community Features
    const [mentors, setMentors] = useState<any[]>([]);
    const [communityStats, setCommunityStats] = useState<any>({});
    const [activeUsersCount, setActiveUsersCount] = useState(0);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [communityResources, setCommunityResources] = useState<any[]>([]);

    // Real-time updates
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
    const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);

    // User Profile Modal State
    const [selectedUserProfile, setSelectedUserProfile] = useState<any>(null);
    const [userLoans, setUserLoans] = useState<any[]>([]);
    const [userCredentials, setUserCredentials] = useState<any>(null);
    const [userProfileLoading, setUserProfileLoading] = useState(false);
    const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);

    // ── Resignation Handover Modal ────────────────────────────────────────────
    const [resignModal, setResignModal] = useState<{
        open: boolean;
        staffId: string;
        staffName: string;
        staffEmail: string;
        staffAvatar: string;
        applications: any[];
        loadingApps: boolean;
    } | null>(null);
    const [resignTargetStaff, setResignTargetStaff] = useState<string>('auto');
    const [resignSubmitting, setResignSubmitting] = useState(false);

    // ── Office & Work Location Management ─────────────────────────────────────
    const [offices, setOffices] = useState<any[]>([]);
    const [officesLoading, setOfficesLoading] = useState(false);
    const [showAddOfficeModal, setShowAddOfficeModal] = useState(false);
    const [newOfficeData, setNewOfficeData] = useState({ name: "", city: "", location: "" });
    const [createOfficeLoading, setCreateOfficeLoading] = useState(false);

    const loadOffices = useCallback(async () => {
        setOfficesLoading(true);
        try {
            const res: any = await referenceApi.getOffices();
            if (res && res.success && Array.isArray(res.data)) {
                setOffices(res.data);
            }
        } catch (e) {
            console.error("Error loading offices:", e);
        } finally {
            setOfficesLoading(false);
        }
    }, []);

    const handleCreateOffice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOfficeData.name || !newOfficeData.city || !newOfficeData.location) {
            alert("Please provide Office Name, City, and Location.");
            return;
        }
        setCreateOfficeLoading(true);
        try {
            const res: any = await referenceApi.createOffice(newOfficeData);
            if (res && res.success) {
                alert("Office location created successfully!");
                setNewOfficeData({ name: "", city: "", location: "" });
                await loadOffices();
                setShowAddOfficeModal(false);
            } else {
                alert("Failed to create office: " + (res?.message || "Unknown error"));
            }
        } catch (err: any) {
            alert("Error creating office: " + (err.message || err));
        } finally {
            setCreateOfficeLoading(false);
        }
    };

    const handleDeleteOffice = async (officeId: string, officeName: string) => {
        if (!confirm(`Are you sure you want to remove office "${officeName}"?`)) return;
        try {
            const res: any = await referenceApi.deleteOffice(officeId);
            if (res && res.success) {
                setOffices(prev => prev.filter(o => o.id !== officeId));
                alert("Office removed successfully.");
            }
        } catch (err: any) {
            alert("Failed to delete office: " + (err.message || err));
        }
    };

    // ─── Data loaders ──────────────────────────────────────────────────────────

    const loadCommunityData = useCallback(async () => {
        try {
            const [mentorData, statsData, resourcesData]: [any, any, any] = await Promise.all([
                adminApi.getMentors().catch(() => ({ data: [] })),
                adminApi.getCommunityStats().catch(() => ({ data: {} })),
                adminApi.getCommunityResources().catch(() => ({ data: [] }))
            ]);
            setMentors(mentorData.data || []);
            setCommunityStats(statsData.data || {});
            setCommunityResources(resourcesData.data || []);
        } catch (e) {
            console.error("Error loading community data:", e);
        }
    }, []);

    const loadOverview = useCallback(async () => {
        setLoading(true);
        try {
            const [blogStats, appStats, users, logs, banksRes]: [any, any, any, any, any] = await Promise.all([
                adminApi.getBlogStats().catch(() => ({ data: {} })),
                adminApi.getApplicationStats().catch(() => ({ data: {} })),
                adminApi.getUsers().catch(() => ({ data: [] })),
                adminApi.getAuditLogs(10).catch(() => ({ data: [] })),
                referenceApi.getBanks().catch(() => ({ data: [] }))
            ]);
            const userList = users.data || [];
            if (banksRes?.success && Array.isArray(banksRes.data)) {
                setBankPartners(banksRes.data);
            }
            setStats({
                blogs: blogStats.data || {},
                apps: appStats.data || {},
                totalAmount: appStats.data?.totalAmount || 0,
                disbursedAmount: appStats.data?.disbursedAmount || 0,
                disbursedCount: appStats.data?.statusStats?.disbursed || 0,
                appCount: appStats.data?.total || 0,
                userCount: userList.length,
                studentCount: userList.filter((u: any) => u.role === 'user' || u.role === 'student').length,
                staffCount: userList.filter((u: any) => u.role === 'staff' || u.role === 'staff_admin').length,
                bankCount: userList.filter((u: any) => u.role === 'bank' || u.role === 'partner_bank').length,
                agentCount: userList.filter((u: any) => u.role === 'agent' || u.role === 'partner_agent').length,
                activeAdmins: userList.filter((u: any) => u.role === 'admin' || u.role === 'super_admin').length,
            });
            setAuditLogs(logs.data || []);
            // Count pending applications for notification badge
            const appData: any = await adminApi.getApplications({ status: 'pending' }).catch(() => ({ data: [] }));
            setPendingCount((appData.data || []).length);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadData = useCallback(async (isSilent = false) => {
        if (activeSection === "overview") return;
        if (!isSilent) {
            setLoading(true);
            setData([]);
        }
        try {
            // Always ensure bank partners and office locations are loaded
            referenceApi.getBanks().then((res: any) => {
                if (res?.success && Array.isArray(res.data)) setBankPartners(res.data);
            }).catch(() => {});
            referenceApi.getOffices().then((res: any) => {
                if (res?.success && Array.isArray(res.data)) setOffices(res.data);
            }).catch(() => {});

            let res: any;
            const isUserSection = activeSection === "users" || activeSection === "users_students" || activeSection === "users_staff" || activeSection === "users_agents" || activeSection === "users_banks";
            if (isUserSection) {
                const offset = (currentPage - 1) * itemsPerPage;
                let queryRole = "";
                if (activeSection === "users_students") queryRole = "student";
                else if (activeSection === "users_staff") queryRole = "staff";
                else if (activeSection === "users_agents") queryRole = "agent";
                else if (activeSection === "users_banks") queryRole = "bank";
                else if (activeSection === "users") {
                    queryRole = roleFilter === "all" ? "" : roleFilter;
                }
                res = await adminApi.getUsers(itemsPerPage, offset, lastSearchQuery, queryRole);
                if (res && res.data) {
                    setData(res.data || []);
                    setTotalItems(res.total || res.data.length);
                } else {
                    setData(Array.isArray(res) ? res : []);
                    setTotalItems(Array.isArray(res) ? res.length : 0);
                }
            } else if (activeSection === "blogs") {
                const params: any = { limit: '100' };
                if (filterBlogTime !== 'all') params.timeRange = filterBlogTime;
                res = await adminApi.getBlogs(params);
                setData(res.data || []);
            } else if (activeSection === "applications") {
                const params: any = { limit: '1000' };
                if (filterStatus !== "all") params.status = filterStatus;
                if (filterBank !== "all") params.bank = filterBank;
                if (filterLoanType !== "all") params.loanType = filterLoanType;
                if (filterStage !== "all") params.stage = filterStage;
                if (filterFromDate) params.fromDate = filterFromDate;
                if (filterToDate) params.toDate = filterToDate;
                if (searchQuery) params.search = searchQuery;

                const [appRes, staffRes]: [any, any] = await Promise.all([
                    adminApi.getApplications(params).catch(() => ({ data: [] })),
                    adminApi.getUsers(500, 0, "", "").catch(() => ({ data: [] }))
                ]);
                const allUsers = staffRes.data || [];
                const staffOnly = allUsers.filter((u: any) => u.role === 'staff' || u.role === 'staff_admin');
                setData(appRes.data || []);
                setStaffMembers(staffOnly);
            } else if (activeSection === "community") {
                res = await adminApi.getForumPosts(50);
                setData(res.data || []);
            } else if (activeSection === "analytics") {
                if (!isSilent) setAnalyticsLoading(true);
                const [aStats, uData]: [any, any] = await Promise.all([
                    adminApi.getApplicationStats().catch(() => ({ data: {} })),
                    adminApi.getUsers().catch(() => ({ data: [] }))
                ]);
                const userList = uData.data || [];
                setAnalyticsData({
                    appStats: aStats.data || {},
                    usersByRole: {
                        student: userList.filter((u: any) => u.role === 'user').length,
                        staff: userList.filter((u: any) => u.role === 'staff').length,
                        bank: userList.filter((u: any) => u.role === 'bank').length,
                        agent: userList.filter((u: any) => u.role === 'agent').length,
                        admin: userList.filter((u: any) => u.role === 'admin' || u.role === 'super_admin').length,
                    },
                    recentUsers: userList.slice(-7).map((u: any) => userList.indexOf(u) + 1),
                });
                if (!isSilent) setAnalyticsLoading(false);
            } else if (activeSection === "audit_logs") {
                const logs: any = await adminApi.getAuditLogs(100).catch(() => ({ data: [] }));
                setAllAuditLogs(logs.data || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [activeSection, filterStatus, filterBank, filterLoanType, filterStage, filterFromDate, filterToDate, lastSearchQuery, filterBlogTime, currentPage, roleFilter]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setLastSearchQuery(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        if (activeSection === "users" || activeSection === "users_students" || activeSection === "users_staff" || activeSection === "users_agents" || activeSection === "users_banks") {
            setCurrentPage(1);
        }
        if (activeSection === "applications") {
            setAppPage(1);
        }
    }, [roleFilter, lastSearchQuery, activeSection, searchQuery, filterStaff, filterStatus, filterBank, filterLoanType]);

    useEffect(() => {
        if (activeSection === "overview") loadOverview();
        else loadData();
    }, [activeSection, loadOverview, loadData]);

    // ─── Auto-refresh for real-time updates ────────────────────────────────────
    useEffect(() => {
        // Set up intervals for different data types
        if (activeSection === "overview") {
            // Refresh overview every 30 seconds
            autoRefreshInterval.current = setInterval(() => {
                loadOverview();
                setLastRefresh(new Date());
            }, 30000);
        } else if (activeSection === "community") {
            // Refresh community data every 20 seconds
            autoRefreshInterval.current = setInterval(() => {
                loadCommunityData();
                loadData(true);
                setLastRefresh(new Date());
            }, 20000);
        } else if (activeSection === "applications") {
            // Refresh applications every 15 seconds for real-time updates silently
            if (autoRefreshEnabled) {
                autoRefreshInterval.current = setInterval(() => {
                    loadData(true);
                    setLastRefresh(new Date());
                }, 15000);
            }
        } else if (activeSection === "analytics") {
            // Refresh analytics every 60 seconds
            autoRefreshInterval.current = setInterval(() => {
                loadData(true);
                setLastRefresh(new Date());
            }, 60000);
        }

        return () => {
            if (autoRefreshInterval.current) clearInterval(autoRefreshInterval.current);
        };
    }, [activeSection, loadOverview, loadData, loadCommunityData, autoRefreshEnabled]);

    useEffect(() => {
        const userCountInterval = setInterval(() => {
            const count = Math.floor(Math.random() * (stats.userCount || 1) * 0.3) + 1;
            setActiveUsersCount(count);
        }, 15000);

        return () => {
            clearInterval(userCountInterval);
        };
    }, [stats.userCount]);

    // Initial load of community data
    useEffect(() => {
        if (activeSection === "community") {
            loadCommunityData();
        }
    }, [activeSection, loadCommunityData]);

    // ─── Handlers ──────────────────────────────────────────────────────────────

    // Handler to view user credentials, comparison, and all their loans
    const handleViewUserProfile = useCallback(async (applicant: any, defaultTab?: 'credentials' | 'applications' | 'bank_compare') => {
        setUserProfileLoading(true);
        try {
            // Fetch user details specifically for this applicant
            const userRes: any = await adminApi.getUsers(1, 0, applicant.email).catch(() => ({ data: [] }));
            const selectedUser = (userRes.data || []).find((u: any) => u.email === applicant.email);
            const currentUser = selectedUser || applicant;
            
            // Fetch all applications for this user
            const appsRes: any = await adminApi.getApplications({ search: applicant.email }).catch(() => ({ data: [] }));
            
            setSelectedUserProfile(currentUser);
            setUserCredentials(selectedUser);
            setUserLoans(appsRes.data || []);

            // Auto-detect matching bank partner
            const userBankKey = (currentUser?.bank || currentUser?.bankId || currentUser?.partnerBank || currentUser?.firstName || '').toLowerCase().trim();
            let matchedPartner = bankPartners.find((b: any) => 
                b.shortName?.toLowerCase() === userBankKey ||
                b.name?.toLowerCase().includes(userBankKey) ||
                (userBankKey && userBankKey.includes(b.shortName?.toLowerCase()))
            );
            if (!matchedPartner && bankPartners.length > 0) {
                matchedPartner = bankPartners[0];
            }
            setComparedBankPartner(matchedPartner || null);

            if (defaultTab) {
                setUserProfileTab(defaultTab);
            } else if (currentUser?.role === 'bank' || currentUser?.role === 'partner_bank') {
                setUserProfileTab('bank_compare');
            } else {
                setUserProfileTab('credentials');
            }
        } catch (e) {
            console.error('Error loading user profile:', e);
        } finally {
            setUserProfileLoading(false);
        }
    }, [bankPartners]);

    const handleUpdateUserBank = async (userId: string, email: string, bankShortName: string) => {
        setUpdatingUserBank(true);
        try {
            await adminApi.updateUserDetails({
                email: email,
                bank: bankShortName,
            } as any);
            alert(`Bank Partner updated to "${bankShortName.toUpperCase()}" for ${email}`);
            if (selectedUserProfile) {
                setSelectedUserProfile((prev: any) => ({ ...prev, bank: bankShortName }));
            }
            loadData(true);
        } catch (err: any) {
            alert("Failed to update bank partner association: " + (err.message || err));
        } finally {
            setUpdatingUserBank(false);
        }
    };

    const handleBlogStatus = async (blogId: string, currentStatus: boolean) => {
        try {
            await adminApi.bulkUpdateBlogStatus([blogId], !currentStatus);
            loadData();
            loadOverview();
        } catch { alert("Failed to update blog status"); }
    };

    const handleDeleteBlog = async (blogId: string) => {
        if (!confirm("Are you sure you want to delete this blog?")) return;
        try {
            await adminApi.deleteBlog(blogId);
            loadData(); loadOverview();
        } catch { alert("Failed to delete blog"); }
    };

    const handleTogglePin = async (id: string, isPinned: boolean) => {
        try {
            await adminApi.togglePinForumPost(id, !isPinned);
            loadData();
        } catch (e: any) {
            alert("Failed to pin post: " + e.message);
        }
    };

    const handleModeratePost = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this post?")) return;
        try {
            await adminApi.deleteForumPost(id);
            loadData();
        } catch (e: any) {
            alert("Failed to moderate post: " + e.message);
        }
    };

    const handleRevokeMentor = async (id: string) => {
        if (!window.confirm("Are you sure you want to revoke this mentor's access?")) return;
        try {
            await adminApi.deleteMentor(id);
            loadCommunityData();
        } catch (e: any) {
            alert("Failed to revoke mentor: " + e.message);
        }
    };

    const handleDeleteResource = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this resource?")) return;
        try {
            await adminApi.deleteCommunityResource(id);
            loadCommunityData();
        } catch (e: any) {
            alert("Failed to delete resource: " + e.message);
        }
    };

    const handleAppStatus = async (appId: string, status: string) => {
        setActionLoading(true);
        try {
            const remarks = aiReview
                ? `[AI Score: ${aiReview.overallScore}/100 | Rec: ${aiReview.recommendation}] ${actionRemarks || ''}`
                : actionRemarks || undefined;
            await adminApi.updateApplicationStatus(appId, {
                status, remarks,
                rejectionReason: status === 'rejected' ? (actionRemarks || aiReview?.aiSummary) : undefined,
            });
            setSelectedApp(null); setActionRemarks(""); setAiReview(null); setDrawerTab('details');
            loadData(); loadOverview();
        } catch { alert("Failed to update application status"); }
        finally { setActionLoading(false); }
    };

    const handleReassignStaff = async (loanId: string, newStaffId: string) => {
        if (!newStaffId) return;
        try {
            setReassigningAppId(loanId);
            await assignmentApi.reassign(loanId, newStaffId, 'Admin manual assignment');
            const targetStaff = staffMembers.find((s: any) => s.id === newStaffId || s.email === newStaffId);
            const staffName = targetStaff ? `${targetStaff.firstName || ''} ${targetStaff.lastName || ''}`.trim() : newStaffId;
            alert(`Application successfully assigned to ${staffName}.`);
            if (selectedApp && (selectedApp.id === loanId || selectedApp.applicationNumber === loanId)) {
                setSelectedApp((prev: any) => ({
                    ...prev,
                    assignedStaffId: newStaffId,
                    staffName: staffName,
                    staffEmail: targetStaff?.email || ''
                }));
            }
            loadData();
        } catch (e: any) {
            alert("Failed to reassign staff: " + (e.message || e));
        } finally {
            setReassigningAppId(null);
        }
    };

    const handleAutoAssignAll = async () => {
        if (!window.confirm("Auto-assign all unassigned applications to active staff members via round-robin?")) return;
        try {
            setLoading(true);
            const res: any = await assignmentApi.assignAllUnassigned();
            alert(res?.data?.message || res?.message || "Round-robin assignment process executed.");
            loadData();
        } catch (e: any) {
            alert("Auto-assignment failed: " + (e.message || e));
        } finally {
            setLoading(false);
        }
    };

    const handleToggleResigned = async (staffId: string, currentResigned: boolean) => {
        // If REINSTATING (already resigned → active), just do a simple confirm
        if (currentResigned) {
            if (!window.confirm("Reinstate this staff member as Active? They will be eligible for new application assignments.")) return;
            try {
                await staffProfileApi.toggleStaffResignation(staffId, false);
                staffProfileApi.getStaffMembersList().then((res: any) => {
                    const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
                    setStaffMembers(list);
                }).catch(console.error);
                loadData();
            } catch (err: any) {
                console.error("Failed to reinstate staff:", err);
                alert("Failed to reinstate staff: " + (err.message || err));
            }
            return;
        }

        // MARKING AS RESIGNED: open handover modal
        const staffMember = staffMembers.find((s: any) => s.id === staffId || s.linkedUserId === staffId);
        const staffName = staffMember ? `${staffMember.firstName || ''} ${staffMember.lastName || ''}`.trim() || staffMember.email : staffId;
        const staffEmail = staffMember?.email || '';
        const staffAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${staffEmail || staffId}`;

        setResignTargetStaff('auto');
        setResignModal({
            open: true,
            staffId,
            staffName,
            staffEmail,
            staffAvatar,
            applications: [],
            loadingApps: true,
        });

        // Fetch applications assigned to this staff member
        try {
            const appsRes: any = await assignmentApi.getMyApplications(staffId);
            const allApps: any[] = Array.isArray(appsRes) ? appsRes : (Array.isArray(appsRes?.data) ? appsRes.data : []);
            // Exclude sanctioned/disbursed/approved apps (those cannot be reassigned)
            const sanctionedStatuses = ['sanctioned', 'conditional_sanction', 'partial_sanction', 'disbursed', 'partially_disbursed', 'approved', 'disbursement_confirmed', 'closed'];
            const pendingApps = allApps.filter((app: any) => !sanctionedStatuses.includes((app.status || '').toLowerCase()));
            setResignModal(prev => prev ? { ...prev, applications: pendingApps, loadingApps: false } : null);
        } catch (err) {
            console.error('[handleToggleResigned] Failed to fetch staff applications:', err);
            setResignModal(prev => prev ? { ...prev, applications: [], loadingApps: false } : null);
        }
    };

    const handleConfirmResignHandover = async (skipReassign = false) => {
        if (!resignModal) return;
        setResignSubmitting(true);
        try {
            // Step 1: Mark staff as resigned/invalid
            await staffProfileApi.toggleStaffResignation(resignModal.staffId, true);

            // Step 2: Bulk-reassign pending apps (unless admin skips)
            if (!skipReassign && resignModal.applications.length > 0) {
                const appIds = resignModal.applications.map((a: any) => a.id).filter(Boolean);
                if (appIds.length > 0) {
                    await assignmentApi.bulkReassign(appIds, resignTargetStaff, 'staff_resigned_handover');
                }
            }

            // Refresh staff list and data
            const res: any = await staffProfileApi.getStaffMembersList();
            const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setStaffMembers(list);
            loadData();
            setResignModal(null);
        } catch (err: any) {
            console.error('[handleConfirmResignHandover] Error:', err);
            alert('Handover failed: ' + (err.message || err));
        } finally {
            setResignSubmitting(false);
        }
    };

    const handleToggleLeave = async (staffId: string, currentOnLeave: boolean) => {
        const nextOnLeave = !currentOnLeave;
        const confirmMsg = nextOnLeave
            ? "Mark this staff member as On Leave? They will be temporarily skipped during round-robin auto-assignments."
            : "Mark this staff member as Available?";
        if (!window.confirm(confirmMsg)) return;

        try {
            await assignmentApi.updateStaffAvailability(staffId, { isOnLeave: nextOnLeave });
            loadData();
            alert(`Staff status updated: ${nextOnLeave ? 'On Leave' : 'Available'}`);
        } catch (err: any) {
            console.error("Failed to update staff leave status:", err);
            alert("Failed to update leave status: " + (err.message || err));
        }
    };

    const toggleSelectAll = (itemsToSelect: any[]) => {
        const allIds = itemsToSelect.map((item) => item.id).filter(Boolean);
        const isAllSelected = allIds.every((id) => selectedAppIds.includes(id));
        if (isAllSelected) {
            setSelectedAppIds((prev) => prev.filter((id) => !allIds.includes(id)));
        } else {
            setSelectedAppIds((prev) => Array.from(new Set([...prev, ...allIds])));
        }
    };

    const toggleSelectApp = (id: string) => {
        setSelectedAppIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const handleBulkReassign = async () => {
        if (selectedAppIds.length === 0) return;
        if (!bulkTargetStaffId) {
            alert("Please select a target staff member or Auto Round-Robin from the dropdown.");
            return;
        }

        const targetStaffObj = staffMembers.find((s: any) => s.id === bulkTargetStaffId || s.email === bulkTargetStaffId);
        const staffLabel = bulkTargetStaffId === 'auto'
            ? 'Auto Round-Robin Distribution'
            : (targetStaffObj ? `${targetStaffObj.firstName || ''} ${targetStaffObj.lastName || ''}`.trim() || targetStaffObj.email : bulkTargetStaffId);

        if (!window.confirm(`Reassign ${selectedAppIds.length} selected application(s) to ${staffLabel}?`)) return;

        try {
            setBulkReassigning(true);
            const res: any = await assignmentApi.bulkReassign(selectedAppIds, bulkTargetStaffId, 'Admin bulk reassignment');
            alert(res?.message || res?.data?.message || `Successfully reassigned ${selectedAppIds.length} application(s).`);
            setSelectedAppIds([]);
            setBulkTargetStaffId("");
            loadData();
        } catch (e: any) {
            alert("Bulk reassignment failed: " + (e.message || e));
        } finally {
            setBulkReassigning(false);
        }
    };

    const handleAutoAssignUnassigned = async () => {
        const unassignedCount = data.filter((a: any) => {
            const sid = (a.assignedStaffId || '').trim();
            if (!sid || sid === 'unassigned' || sid === 'null' || sid === 'undefined') return true;
            // Check if sid matches any active staff member in staffMembers
            const matchesStaff = staffMembers.some((s: any) => {
                if (!s) return false;
                const sId = String(s.id || '').toLowerCase();
                const sLink = String(s.linkedUserId || '').toLowerCase();
                const sEmail = String(s.email || '').toLowerCase();
                const targetId = sid.toLowerCase();
                return sId === targetId || sLink === targetId || sEmail === targetId;
            });
            return !matchesStaff;
        }).length;

        if (unassignedCount === 0) {
            alert("All applications are currently assigned to active staff members.");
            return;
        }
        if (!window.confirm(`Auto-assign ${unassignedCount} unassigned/unallocated application(s) across all active staff members using Round-Robin?`)) return;

        try {
            setLoading(true);
            const res: any = await assignmentApi.autoAssignAllUnassigned();
            const countMsg = res?.data?.assigned !== undefined ? `Assigned ${res.data.assigned} application(s).` : '';
            alert(res?.data?.message || res?.message || `Applications assigned successfully via Round-Robin. ${countMsg}`);
            loadData();
        } catch (e: any) {
            alert("Auto-assign failed: " + (e.message || e));
        } finally {
            setLoading(false);
        }
    };


    const handleAIReview = async (appId: string) => {
        setAiReviewLoading(true); setAiReview(null); setDrawerTab('ai_review');
        try {
            const result: any = await adminApi.aiReviewApplication(appId);
            setAiReview(result.data);
        } catch (e: any) {
            alert(`AI Review failed: ${e.message || 'Please try again.'}`);
        } finally { setAiReviewLoading(false); }
    };

    const handleUserRole = async (email: string, role: string) => {
        if (!confirm(`Are you sure you want to change the access tier for ${email} to ${role.toUpperCase()}?`)) {
            return;
        }
        try {
            await adminApi.updateUserRole(email, role);
            alert(`User role updated to ${role}`);
            loadData();
        } catch (e: any) {
            alert(`Failed to update user role: ${e.message || e}`);
        }
    };

    const handleCreateUser = async (e?: React.FormEvent, isDraft = false) => {
        if (e) e.preventDefault();
        if (newUserQuery.role === 'bank' && (!newUserQuery.bank || !newUserQuery.bank.trim())) {
            alert("Error: Please select an Assigned Lending Bank Partner before creating the Bank Representative profile.");
            return;
        }
        setCreateUserLoading(true);
        try {
            const cleanPrefix = newUserQuery.mailboxPrefix
                ? (newUserQuery.mailboxPrefix.trim().endsWith('/') ? newUserQuery.mailboxPrefix.trim() : `${newUserQuery.mailboxPrefix.trim()}/`)
                : "";
            const payload = {
                ...newUserQuery,
                mailboxPrefix: cleanPrefix,
                mailboxEmail: newUserQuery.mailboxEmail ? newUserQuery.mailboxEmail.trim().toLowerCase() : "",
                isDraft
            };
            const res: any = await adminApi.createUser(payload);
            if (res.success && res.user?.id) {
                const roleLabels: Record<string, string> = {
                    bank: "Bank Representative",
                    staff: "Staff Member",
                    agent: "Agent Partner",
                    user: "Student",
                    student: "Student"
                };
                const label = roleLabels[newUserQuery.role] || "User";
                if (isDraft) {
                    alert(`Agent profile saved as Draft successfully. An onboarding email will only be sent when the profile is submitted and activated.`);
                } else if (newUserQuery.role === 'agent') {
                    alert(`Agent Partner profile created & activated! Congratulations welcome email with portal link sent to: ${res.user.email || ''}`);
                } else {
                    alert(`New ${label} account created successfully: ${res.user.email || ''}`);
                }
                setShowCreateUserModal(false);
                setNewUserQuery({
                    email: "", firstName: "", lastName: "", middleName: "", mobile: "", role: "user", bank: "",
                    officeId: "", officeLocation: "",
                    mailboxEmail: "", mailboxPrefix: "", canAccessSupport: false,
                    dob: "", gender: "", maritalStatus: "",
                    mailingAddress: { address1: "", address2: "", city: "", state: "", country: "", pincode: "" },
                    permanentAddress: { address1: "", address2: "", city: "", state: "", country: "", pincode: "" },
                    passport: { number: "", issueDate: "", expiryDate: "", issueCountry: "", birthCity: "", birthCountry: "" },
                    nationality: { name: "", citizenship: "", dualCitizenship: "No", dualNational: "", livingOtherCountry: "No", livingOtherCountryName: "" },
                    background: { immigrationApplied: "No", immigrationAppliedCountry: "", medicalCondition: "No", medicalConditionDetails: "", visaRefusal: "No", visaRefusalDetails: "", criminalOffence: "No", criminalOffenceDetails: "" },
                    emergencyContact: { name: "", phone: "", email: "", relation: "" },
                    partnership: "Individual Consultant",
                    percentage: "1.5",
                    panNumber: "",
                    businessName: "",
                    profilePhoto: "",
                    gstin: "",
                    officeAddress: "",
                    documents: []
                });
                await loadData();
            } else {
                alert("Failed to create profile: " + (res.message || "Unknown error"));
            }
        } catch (e: any) {
            alert("Failed to create profile: " + e.message);
        } finally { setCreateUserLoading(false); }
    };

    const handleUpdateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser.email || !editingUser.email.trim()) {
            alert("Email Address is required.");
            return;
        }
        setUpdateLoading(true);
        try {
            await adminApi.updateUserDetails({
                userId: editingUser.id,
                email: editingUser.email.trim(),
                firstName: editingUser.firstName,
                lastName: editingUser.lastName,
                phoneNumber: editingUser.phoneNumber || editingUser.mobile || "",
                dateOfBirth: editingUser.dateOfBirth || "",
                officeId: editingUser.officeId,
                officeLocation: editingUser.officeLocation
            });
            alert("User updated successfully.");
            setEditingUser(null);
            loadData();
        } catch (e: any) {
            alert("Failed to update user: " + e.message);
        } finally { setUpdateLoading(false); }
    };

    const handleOpenEmailModal = (user: any) => {
        setEmailModalUser(user);
        setEmailSubject(`Important update from VidyaLoans Admin regarding your account`);
        setEmailContent(`Dear ${user.firstName || 'User'},\n\nWe are reaching out regarding your profile and active services on the VidyaLoans platform.\n\nPlease feel free to reply to this email or reach out to your assigned representative if you have any questions.\n\nBest regards,\nVidyaLoans Admin Team`);
    };

    const handleSelectTemplate = (type: string) => {
        if (!emailModalUser) return;
        const name = emailModalUser.firstName || 'User';
        switch (type) {
            case 'status':
                setEmailSubject(`Status Update: Your Education Loan Application`);
                setEmailContent(`Dear ${name},\n\nYour application status has been reviewed and updated by our underwriting team. Please log in to your dashboard to review the latest milestones and next steps.\n\nDashboard: https://vidyaloans.in/dashboard\n\nWarm regards,\nVidyaLoans Operations Team`);
                break;
            case 'docs':
                setEmailSubject(`Action Required: Verification Documents Requested`);
                setEmailContent(`Dear ${name},\n\nTo proceed with your application, additional KYC / financial documentation is required. Please upload the requested files through your portal account at your earliest convenience.\n\nIf you have any difficulty uploading, reply to this email with the attachments.\n\nWarm regards,\nVidyaLoans Verification Desk`);
                break;
            case 'welcome':
                setEmailSubject(`Welcome to VidyaLoans: Getting Started`);
                setEmailContent(`Dear ${name},\n\nWelcome to VidyaLoans! Your profile has been successfully configured. You can now access all portal features and track your loan proposals in real time.\n\nPortal: https://vidyaloans.in\n\nBest regards,\nVidyaLoans Support`);
                break;
            default:
                break;
        }
    };

    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!emailModalUser) return;
        if (!emailSubject.trim() || !emailContent.trim()) {
            alert("Subject and content are required.");
            return;
        }

        setSendingEmail(true);
        try {
            const res: any = await adminApi.sendEmail({
                to: emailModalUser.email,
                subject: emailSubject.trim(),
                content: emailContent.trim(),
            });
            if (res?.success) {
                alert(`Email successfully dispatched to ${emailModalUser.email}!`);
                setEmailModalUser(null);
            } else {
                alert(res?.message || "Failed to send email");
            }
        } catch (err: any) {
            alert("Error sending email: " + (err?.message || err));
        } finally {
            setSendingEmail(false);
        }
    };

    const handleDeleteUser = async (userId: string, userName: string) => {
        const confirmDelete = window.confirm(`Are you sure you want to delete ${userName}? This action cannot be undone.`);
        if (!confirmDelete) return;

        try {
            await adminApi.deleteUser(userId);
            alert("User deleted successfully.");
            loadData();
        } catch (e: any) {
            alert("Failed to delete user: " + e.message);
        }
    };

    // Announcements (client-side for demo — integrate with backend if needed)
    const addAnnouncement = () => {
        if (!newAnnouncement.title || !newAnnouncement.message) { alert("Title and message required"); return; }
        setAnnouncements(prev => [{ ...newAnnouncement, id: Date.now().toString(), createdAt: new Date().toISOString() }, ...prev]);
        setNewAnnouncement({ title: "", message: "", type: "info", target: "all" });
    };

    const deleteAnnouncement = (id: string) => setAnnouncements(prev => prev.filter(a => a.id !== id));

    // Bulk actions
    const toggleUserSelect = (id: string) => {
        setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    // ─── Filtering ─────────────────────────────────────────────────────────────

    const filteredData = data.filter(item => {
        const query = searchQuery.toLowerCase();

        if (activeSection === 'users' || activeSection === 'users_students' || activeSection === 'users_staff' || activeSection === 'users_agents' || activeSection === 'users_banks') {
            if (bankPartnerFilter !== 'all') {
                const target = bankPartnerFilter.toLowerCase();
                const bankField = (item.bank || item.bankId || item.partnerBank || item.targetUniversity || '').toLowerCase();
                const emailField = (item.email || '').toLowerCase();
                const nameField = `${item.firstName || ''} ${item.lastName || ''}`.toLowerCase();
                return bankField.includes(target) || emailField.includes(target) || nameField.includes(target);
            }
            return true;
        }
        if (activeSection === 'blogs') {
            return item.title?.toLowerCase().includes(query) || item.authorName?.toLowerCase().includes(query);
        }
        if (activeSection === 'applications') {
            const matchesQuery = !query || (
                item.applicationNumber?.toLowerCase().includes(query) ||
                item.id?.toLowerCase().includes(query) ||
                item.firstName?.toLowerCase().includes(query) ||
                item.lastName?.toLowerCase().includes(query) ||
                item.bank?.toLowerCase().includes(query) ||
                item.email?.toLowerCase().includes(query) ||
                item.staffName?.toLowerCase().includes(query) ||
                item.processingStaff?.toLowerCase().includes(query) ||
                item.targetUniversity?.toLowerCase().includes(query) ||
                item.universityName?.toLowerCase().includes(query)
            );
            if (!matchesQuery) return false;

            if (filterStatus !== 'all') {
                const status = (item.status || '').toLowerCase();
                if (filterStatus === 'pending' && status !== 'pending' && status !== 'submitted') return false;
                if (filterStatus === 'processing' && status !== 'processing' && status !== 'in_progress' && status !== 'under_review') return false;
                if (filterStatus === 'approved' && status !== 'approved' && status !== 'sanctioned' && status !== 'conditional_sanction') return false;
                if (filterStatus === 'disbursed' && status !== 'disbursed' && status !== 'partially_disbursed') return false;
                if (filterStatus === 'rejected' && status !== 'rejected' && status !== 'cancelled') return false;
            }

            if (filterBank !== 'all') {
                const bank = (item.bank || '').toLowerCase();
                if (!bank.includes(filterBank.toLowerCase())) return false;
            }

            if (filterLoanType !== 'all') {
                const type = (item.loanType || '').toLowerCase();
                if (filterLoanType === 'unsecured' && !type.includes('unsecured') && !type.includes('abroad')) return false;
                if (filterLoanType === 'secured' && !type.includes('secured') && !type.includes('property')) return false;
            }

            if (filterStaff === 'unassigned') {
                return !item.assignedStaffId || item.assignedStaffId === 'unassigned' || item.assignedStaffId === 'null';
            } else if (filterStaff !== 'all') {
                return (
                    item.assignedStaffId === filterStaff ||
                    item.staffName === filterStaff ||
                    item.processingStaff === filterStaff ||
                    item.staffEmail === filterStaff
                );
            }
            return true;
        }
        return true;
    });

    const sortedApplications = activeSection === 'applications'
        ? [...filteredData].sort((a, b) => {
            const timeA = new Date(a.submittedAt || a.createdAt || a.date || a.submitted_at || 0).getTime();
            const timeB = new Date(b.submittedAt || b.createdAt || b.date || b.submitted_at || 0).getTime();
            return timeB - timeA; // Newest applications at top of Page 1, oldest on last page
        })
        : filteredData;

    const APP_PAGE_SIZE = 20;
    const totalAppPages = Math.ceil(sortedApplications.length / APP_PAGE_SIZE) || 1;
    const currentAppPage = Math.min(appPage, totalAppPages);
    const pagedApplications = activeSection === 'applications'
        ? sortedApplications.slice((currentAppPage - 1) * APP_PAGE_SIZE, currentAppPage * APP_PAGE_SIZE)
        : filteredData;

    const filteredAuditLogs = allAuditLogs.filter(log => {
        if (auditFilter === 'all') return true;
        return log.action === auditFilter;
    });

    const pagedAuditLogs = filteredAuditLogs.slice((auditPage - 1) * 20, auditPage * 20);

    const statusColors: Record<string, string> = {
        pending: "bg-amber-100 text-amber-700 border-amber-200",
        processing: "bg-blue-100 text-blue-700 border-blue-200",
        approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
        rejected: "bg-red-100 text-red-600 border-red-200",
        disbursed: "bg-purple-100 text-purple-700 border-purple-200",
        cancelled: "bg-gray-100 text-gray-600 border-gray-200",
        draft: "bg-gray-100 text-gray-500 border-gray-200",
    };

    const roleColors: Record<string, string> = {
        user: 'bg-blue-100 text-blue-700',
        staff: 'bg-indigo-100 text-indigo-700',
        agent: 'bg-amber-100 text-amber-700',
        bank: 'bg-emerald-100 text-emerald-700',
        admin: 'bg-slate-100 text-slate-700',
        super_admin: 'bg-red-100 text-red-700',
    };

    const navItems = [
        { section: "overview", icon: "dashboard", label: "Dashboard", badge: 0 },
        { section: "analytics", icon: "analytics", label: "Platform Analytics", badge: 0 },
        { section: "applications", icon: "description", label: "Applications", badge: pendingCount },
        { section: "system", icon: "admin_panel_settings", label: "System Control", badge: announcements.length },
        { section: "banks", icon: "account_balance", label: "Bank Partners", badge: 0 },
        { section: "countries", icon: "public", label: "Study Countries", badge: 0 },
        { section: "chat", icon: "forum", label: "Student Chat", badge: 0 },
        { section: "community", icon: "groups", label: "Community", badge: 0 },
        { section: "site_settings", icon: "settings_suggest", label: "Site Settings", badge: 0 },
        { section: "audit_logs", icon: "policy", label: "Audit Logs", badge: 0 },
    ];

    // User Directory sub-nav items
    const userNavItems = [
        { section: "users_students", icon: "school", label: "Students / Users" },
        { section: "users_staff", icon: "badge", label: "Staff Operations" },
        { section: "users_agents", icon: "support_agent", label: "Agents & Partners" },
        { section: "users_banks", icon: "account_balance", label: "Bank Representatives" },
    ];

    const isUserSection = activeSection === "users_students" || activeSection === "users_staff" || activeSection === "users_agents" || activeSection === "users_banks" || activeSection === "users";

    // Marketing sub-nav items
    const marketingNavItems = [
        { section: "campaigns_dashboard", icon: "dashboard", label: "Dashboard" },
        { section: "campaigns_create", icon: "add_circle", label: "Create Campaign" },
        { section: "campaigns_student_emails", icon: "mark_email_read", label: "Sent Student Emails" },
        { section: "campaigns_templates", icon: "style", label: "Campaign Templates" },
        { section: "campaigns_audience", icon: "group", label: "Audience Builder" },
        { section: "campaigns_scheduled", icon: "schedule", label: "Scheduled Campaigns" },
        { section: "campaigns_queued", icon: "hourglass_empty", label: "Queued Campaigns" },
        { section: "campaigns_sent", icon: "send", label: "Sent Campaigns" },
        { section: "campaigns_analytics", icon: "bar_chart", label: "Analytics" },
        { section: "campaigns_prompts", icon: "history", label: "AI Prompt History" },
        { section: "campaigns_settings", icon: "settings", label: "Settings" },
    ];

    // ─── Section Title Map ──────────────────────────────────────────────────────
    const sectionTitles: Record<string, string> = {
        overview: 'Dashboard',
        analytics: 'Platform Analytics',
        applications: 'Applications',
        system: 'System Control',
        site_settings: 'Site Settings & Platform Configuration',
        users: 'User Directory · All Users',
        users_students: 'User Directory · Students & Users',
        users_staff: 'User Directory · Staff Operations',
        users_agents: 'User Directory · Agents & Partners',
        users_banks: 'User Directory · Bank Representatives',
        banks: 'Bank Partners Management',
        countries: 'Supported Study Destinations',
        blogs: 'Blog Management',
        chat: 'Student Chat',
        community: 'Community Forum',
        audit_logs: 'Audit Logs',

        // Marketing/Campaigns
        campaigns_dashboard: 'Email Campaigns · Dashboard',
        campaigns_create: 'Email Campaigns · Create Campaign',
        campaigns_templates: 'Email Campaigns · Templates',
        campaigns_audience: 'Email Campaigns · Audience Builder',
        campaigns_scheduled: 'Email Campaigns · Scheduled',
        campaigns_queued: 'Email Campaigns · Queued',
        campaigns_sent: 'Email Campaigns · Sent',
        campaigns_analytics: 'Email Campaigns · Analytics',
        campaigns_prompts: 'Email Campaigns · AI Prompt History',
        campaigns_settings: 'Email Campaigns · Settings',
        // Support Center
        support_dashboard: 'Support Center · Dashboard',
        support_all: 'Support Center · All Tickets',
        support_open: 'Support Center · Open Tickets',
        support_assigned: 'Support Center · Assigned To Me',
        support_waiting: 'Support Center · Waiting For Customer',
        support_resolved: 'Support Center · Resolved',
        support_closed: 'Support Center · Closed',
        support_high: 'Support Center · High Priority',
        support_sla: 'Support Center · SLA Monitor',
        support_categories: 'Support Center · Categories',
        support_teams: 'Support Center · Teams',
        support_analytics: 'Support Center · Analytics',
        support_kb: 'Support Center · Knowledge Base',
        support_settings: 'Support Center · Settings',
    };

    // Helper component for rendering detail rows in the drawer
    const DetailRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            <span className={`text-[14px] font-bold ${highlight ? 'text-indigo-600' : 'text-slate-900'}`}>
                {value}
            </span>
        </div>
    );

    return (
        <div className="h-screen overflow-hidden flex bg-slate-50 text-slate-900 font-sans text-sm selection:bg-indigo-100 selection:text-indigo-900">
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`fixed inset-y-0 left-0 z-50 bg-[#0f172a] text-slate-300 flex flex-col py-0 px-0
                shadow-xl border-r border-slate-800 group/sidebar
                transition-all duration-300 ease-in-out overflow-hidden
                ${sidebarOpen
                    ? 'w-[240px] translate-x-0'
                    : 'w-[68px] lg:translate-x-0 -translate-x-full hover:w-[240px]'
                }`}>
                <div className="h-14 px-4 flex items-center border-b border-slate-800 flex-shrink-0 gap-2.5">
                    <img
                        src={siteSettings?.logoLightUrl || "/images/vidyaloans-logo-transparent.png"}
                        alt={`${siteSettings?.siteName || "VidyaLoans"} Logo`}
                        className="w-7 h-7 object-contain flex-shrink-0"
                    />
                    <span className={`font-semibold text-[13px] text-white tracking-wide whitespace-nowrap transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                        {siteSettings?.siteName || "VidyaLoans"}<span className="text-indigo-400"> Admin</span>
                    </span>
                </div>

                <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
                    <div className={`px-3 mb-2 mt-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none whitespace-nowrap transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'}`}>Menu</div>
                    
                    {/* Top menu items before users */}
                    {navItems.slice(0, 4).map(item => (
                        <NavItem key={item.section} {...item} active={activeSection} onClick={setActiveSection} expanded={sidebarOpen} />
                    ))}

                    {/* ── User Directory & Sub-roles ── */}
                    <div className="px-1 mt-1 mb-1">
                        <button
                            onClick={() => { setUsersExpanded(e => !e); if (!usersExpanded && !isUserSection) setActiveSection('users_students'); }}
                            title="User Management"
                            className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors text-xs font-medium ${isUserSection ? 'bg-indigo-500/10 text-indigo-400 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                        >
                            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                                <span className={`material-symbols-outlined text-[18px] ${isUserSection ? 'text-indigo-400' : 'text-slate-500'}`}>people</span>
                            </div>
                            <span className={`flex-1 transition-all duration-200 whitespace-nowrap truncate ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                                User Management
                            </span>
                            <span className={`material-symbols-outlined text-[14px] opacity-50 transition-opacity duration-200 ${sidebarOpen ? 'inline-block' : 'hidden group-hover/sidebar:inline-block'}`}>
                                {usersExpanded || isUserSection ? 'expand_less' : 'expand_more'}
                            </span>
                        </button>
                        {(usersExpanded || isUserSection) && (
                            <div className={`ml-3 mt-0.5 space-y-0.5 border-l border-slate-700/50 pl-2 transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                                {userNavItems.map(item => (
                                    <button
                                        key={item.section}
                                        onClick={() => setActiveSection(item.section)}
                                        className={`w-full text-left px-2 py-1 rounded flex items-center gap-2 transition-colors text-[11px] ${
                                            activeSection === item.section ? 'bg-indigo-500/10 text-indigo-400 font-semibold' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                                        }`}
                                    >
                                        <span className={`material-symbols-outlined text-[13px] ${activeSection === item.section ? 'text-indigo-400' : 'text-slate-500'}`}>{item.icon}</span>
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Remaining menu items */}
                    {navItems.slice(4).map(item => (
                        <NavItem key={item.section} {...item} active={activeSection} onClick={setActiveSection} expanded={sidebarOpen} />
                    ))}

                    {/* ── Marketing & Email Campaigns ── */}
                    <div className="px-1 mt-4 mb-1">
                        <div className="border-t border-slate-800 pt-3" />
                        <button
                            onClick={() => { setMarketingExpanded(e => !e); if (!marketingExpanded) setActiveSection('campaigns_dashboard'); }}
                            title="Email Campaigns"
                            className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors text-xs font-medium ${activeSection.startsWith('campaigns_') ? 'bg-indigo-500/10 text-indigo-400 font-bold' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                        >
                            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                                <span className={`material-symbols-outlined text-[18px] ${activeSection.startsWith('campaigns_') ? 'text-indigo-400' : 'text-slate-500'}`}>campaign</span>
                            </div>
                            <span className={`flex-1 transition-all duration-200 whitespace-nowrap truncate ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                                Email Campaigns
                            </span>
                            <span className={`material-symbols-outlined text-[14px] opacity-50 transition-opacity duration-200 ${sidebarOpen ? 'inline-block' : 'hidden group-hover/sidebar:inline-block'}`}>
                                {marketingExpanded || activeSection.startsWith('campaigns_') ? 'expand_less' : 'expand_more'}
                            </span>
                        </button>
                        {(marketingExpanded || activeSection.startsWith('campaigns_')) && (
                            <div className={`ml-3 mt-0.5 space-y-0.5 border-l border-slate-700/50 pl-2 transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                                {marketingNavItems.map(item => (
                                    <button
                                        key={item.section}
                                        onClick={() => setActiveSection(item.section)}
                                        className={`w-full text-left px-2 py-1 rounded flex items-center gap-2 transition-colors text-[11px] ${
                                            activeSection === item.section ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
                                        }`}
                                    >
                                        <span className={`material-symbols-outlined text-[13px] ${activeSection === item.section ? 'text-indigo-400' : 'text-slate-500'}`}>{item.icon}</span>
                                        <span>{item.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </nav>

                <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex-shrink-0">
                    <div className="flex items-center gap-3 mb-3 p-1">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} alt="Avatar" className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 object-cover flex-shrink-0" />
                        <div className={`min-w-0 flex-1 transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                            <p className="text-[12px] font-medium text-slate-200 truncate">{user?.firstName || 'Admin'}</p>
                            <p className="text-[10px] text-slate-500 capitalize truncate">{user?.role?.replace('_', ' ')}</p>
                        </div>
                    </div>
                    <button onClick={logout} className={`w-full px-3 py-2 rounded bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 text-slate-300 border border-slate-700 hover:border-rose-500/30 transition-all text-[11px] font-semibold flex items-center justify-center gap-2 ${sidebarOpen ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'}`}>
                        <span className="material-symbols-outlined text-[14px]">logout</span>
                        <span className={`whitespace-nowrap transition-all duration-300 ${sidebarOpen ? 'inline' : 'hidden group-hover/sidebar:inline'}`}>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300 bg-slate-50 rounded-tl-xl border-l border-t border-slate-200/60 shadow-inner mt-2 lg:mt-0 lg:rounded-none lg:border-none lg:shadow-none ${sidebarOpen ? 'lg:pl-[240px]' : 'lg:pl-[68px]'}`}>
                {/* Header */}
                <header className="h-14 bg-white border-b border-slate-200 px-5 flex justify-between items-center sticky top-0 z-40 flex-shrink-0 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1.5 text-slate-500 hover:bg-slate-100 rounded transition-all">
                            <span className="material-symbols-outlined text-[20px]">menu</span>
                        </button>
                        <h1 className="text-[14px] font-semibold text-slate-800 flex items-center gap-2">
                            {sectionTitles[activeSection] || activeSection}
                            <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 tracking-wide">Live</span>
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative hidden md:block">
                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-[12px] focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-56 transition-all text-slate-700 placeholder:text-slate-400"
                            />
                        </div>

                        <div className="relative">
                            <button
                                onClick={() => setNotifOpen(!notifOpen)}
                                className="relative p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-all flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined text-[18px]">notifications</span>
                                {pendingCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 border-2 border-white shadow-sm" />}
                            </button>
                            {notifOpen && (
                                <div className="absolute right-0 top-full mt-1 w-72 bg-white rounded-lg shadow-lg shadow-slate-200/50 border border-slate-200 z-50 overflow-hidden py-1">
                                    <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80"><h4 className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">Notifications</h4></div>
                                    {pendingCount > 0 ? (
                                        <button className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-all flex items-start gap-3 border-b border-slate-50">
                                            <div className="w-8 h-8 rounded bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5 border border-amber-100"><span className="material-symbols-outlined text-[16px]">assignment</span></div>
                                            <div><p className="text-[12px] font-semibold text-slate-800">{pendingCount} Pending Applications</p><p className="text-[11px] text-slate-500 mt-0.5">Awaiting review</p></div>
                                        </button>
                                    ) : <div className="p-6 text-center text-slate-400 bg-white"><span className="material-symbols-outlined text-2xl mb-1 text-slate-300">task_alt</span><p className="text-[11px]">All caught up</p></div>}
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="p-6 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
                    {activeSection === "overview" && (
                        <div className="space-y-6 max-w-[1400px] mx-auto animate-fade-in">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">System Matrix</h2>
                                    <p className="text-slate-500 text-[11px] mt-1 font-medium flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                                        Synced: {format(new Date(), 'MMM do, yyyy')}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setShowCreateUserModal(true)} className="px-3 py-1.5 rounded bg-white border border-slate-200 text-slate-700 font-medium text-[11px] hover:bg-slate-50 hover:text-slate-900 transition-all flex items-center gap-1.5 shadow-sm">
                                        <span className="material-symbols-outlined text-[16px]">person_add</span> User Node
                                    </button>
                                    <Link href="/admin/blogs/create" className="px-3 py-1.5 bg-indigo-600 text-white rounded text-[11px] font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px]">add</span> Post
                                    </Link>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatCard label="Capital Portfolio" value={`₹${(stats.totalAmount || 0).toLocaleString('en-IN')}`} icon="account_balance_wallet" color="text-indigo-600" loading={loading} trend={12} />
                                <StatCard label="Disbursed Pulse" value={`₹${(stats.disbursedAmount || 0).toLocaleString('en-IN')}`} icon="electric_bolt" color="text-emerald-600" loading={loading} trend={-5} />
                                <StatCard label="Active Transmission" value={stats.appCount || 0} icon="receipt_long" color="text-amber-600" loading={loading} trend={8} />
                                <StatCard label="Total Nodes" value={stats.userCount || 0} icon="public" color="text-blue-600" loading={loading} trend={24} />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatCard
                                    label="Avg Unit Size"
                                    value={`₹${Math.round((stats.totalAmount || 0) / (stats.appCount || 1)).toLocaleString('en-IN')}`}
                                    icon="analytics"
                                    color="text-indigo-600"
                                    loading={loading}
                                />
                                <StatCard
                                    label="Conversion Rate"
                                    value={`${Math.round(((stats.disbursedCount || 0) / (stats.appCount || 1)) * 100)}%`}
                                    icon="trending_up"
                                    color="text-emerald-600"
                                    loading={loading}
                                />
                                <StatCard label="Protocol Managers" value={stats.staffCount} icon="badge" color="text-slate-600" loading={loading} />
                                <StatCard label="Banking Partners" value={stats.bankCount} icon="account_balance" color="text-slate-600" loading={loading} />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Recent Activity */}
                                <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                                    <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50/50 text-[12px]">
                                        <div>
                                            <h3 className="font-semibold text-slate-900 tracking-wide text-sm">System Audit Log</h3>
                                        </div>
                                        <button onClick={loadOverview} className="p-1 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded shadow-sm transition-colors">
                                            <span className="material-symbols-outlined text-[14px]">refresh</span>
                                        </button>
                                    </div>
                                    <div className="p-0 flex-1 overflow-y-auto max-h-[360px] custom-scrollbar">
                                        <table className="w-full text-left border-collapse">
                                            <tbody className="divide-y divide-slate-100">
                                                {auditLogs.length > 0 ? auditLogs.map((log: any, i: number) => (
                                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-4 py-2.5 w-10">
                                                            <div className={`w-6 h-6 rounded flex items-center justify-center text-white ${log.action === 'update' ? 'bg-blue-500' : log.action === 'create' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                                                                <span className="material-symbols-outlined text-[12px]">
                                                                    {log.action === 'update' ? 'edit' : log.action === 'create' ? 'add' : 'delete'}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <p className="font-medium text-slate-800 text-[12px] capitalize leading-snug">{log.action} {log.entityType}</p>
                                                            <p className="text-[10px] text-slate-500 leading-snug mt-0.5">By <span className="font-medium text-slate-600">{log.initiator?.firstName || 'System'}</span></p>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <div className="bg-slate-100/60 rounded px-1.5 py-0.5 text-[9px] font-mono text-slate-600 border border-slate-200/60 inline-block w-20 truncate">
                                                                {log.entityId}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                                                        </td>
                                                    </tr>
                                                )) : (
                                                    <tr>
                                                        <td colSpan={4} className="text-center py-10 text-slate-400">
                                                            <span className="material-symbols-outlined text-3xl mb-2 opacity-30">history</span>
                                                            <p className="text-xs">No activity detected</p>
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Quick Actions */}
                                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden p-4">
                                        <h3 className="text-xs font-semibold text-slate-900 mb-3 ml-1">Direct Commands</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { href: '/admin/blogs/create', label: 'Write Post', icon: 'post_add' },
                                                { section: 'users', label: 'Users', icon: 'people' },
                                                { section: 'applications', label: 'Review Apps', icon: 'receipt_long' },
                                                { section: 'system', label: 'Settings', icon: 'settings' },
                                            ].map((action, i) => (
                                                action.href ? (
                                                    <Link key={i} href={action.href} className="p-3 rounded border border-slate-100 bg-slate-50 hover:bg-slate-100 hover:border-slate-200 transition-colors flex flex-col gap-2 items-start justify-center group">
                                                        <span className={`material-symbols-outlined text-[18px] text-indigo-500`}>{action.icon}</span>
                                                        <h4 className="text-[11px] font-medium text-slate-700">{action.label}</h4>
                                                    </Link>
                                                ) : (
                                                    <button key={i} onClick={() => setActiveSection(action.section!)} className="p-3 rounded border border-slate-100 bg-slate-50 hover:bg-slate-100 hover:border-slate-200 transition-colors flex flex-col gap-2 items-start justify-center group text-left">
                                                        <span className={`material-symbols-outlined text-[18px] text-indigo-500`}>{action.icon}</span>
                                                        <h4 className="text-[11px] font-medium text-slate-700">{action.label}</h4>
                                                    </button>
                                                )
                                            ))}
                                        </div>
                                    </div>

                                    {/* System Health */}
                                    <div className="bg-slate-900 rounded-lg p-5 text-white shadow-sm overflow-hidden relative border border-slate-800">
                                        <div className="relative z-10">
                                            <h3 className="text-xs font-semibold mb-3 tracking-wide rounded">System Status</h3>
                                            <div className="space-y-0.5 mt-2 bg-slate-800/50 rounded-lg border border-slate-700/50 p-2">
                                                <HealthDot ok={true} label="API Core" />
                                                <HealthDot ok={true} label="Database" />
                                                <HealthDot ok={true} label="Auth Node" />
                                                <HealthDot ok={!maintenanceMode} label="Public API" />
                                            </div>
                                            <div className="flex items-center gap-2 mt-4 ml-1">
                                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                <span className="text-[9px] font-medium tracking-widest uppercase text-slate-300">Operational</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === "analytics" && (
                        <div className="space-y-8 animate-fade-in max-w-[1400px] mx-auto">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Performance Matrix</h2>
                                    <p className="text-slate-500 text-[11px] mt-1 font-medium flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">analytics</span>
                                        Real-time insights across the platform ecosystem
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 flex-wrap">
                                    <button onClick={() => { setAnalyticsLoading(true); loadData(); }} disabled={analyticsLoading} className="px-5 py-3 rounded-xl border border-slate-200/50 bg-white text-slate-600 font-bold text-[11px] uppercase tracking-wider hover:bg-white transition-all flex items-center gap-2 disabled:opacity-50">
                                        <span className={`material-symbols-outlined text-[18px] ${analyticsLoading ? 'animate-spin' : ''}`}>refresh</span>
                                        Refresh
                                    </button>
                                    <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 shadow-sm">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></span>
                                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Live Syncing</span>
                                    </div>
                                </div>
                            </div>

                            {analyticsLoading || loading ? (
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-slate-100 animate-pulse rounded-lg" />)}
                                </div>
                            ) : (
                                <>
                                    {/* Key Performance Metrics */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm relative overflow-hidden group">
                                            <p className="text-[11px] font-medium text-slate-500 mb-0.5">Total Loan Value</p>
                                            <p className="text-[20px] font-semibold text-slate-900 tracking-tight">₹{(analyticsData.appStats?.totalAmount || 0).toLocaleString('en-IN')}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">Across all applications</p>
                                        </div>
                                        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm relative overflow-hidden group">
                                            <p className="text-[11px] font-medium text-slate-500 mb-0.5">Disbursed Amount</p>
                                            <p className="text-[20px] font-semibold text-slate-900 tracking-tight">₹{(analyticsData.appStats?.disbursedAmount || 0).toLocaleString('en-IN')}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">{analyticsData.appStats?.total ? Math.round(((analyticsData.appStats?.disbursedAmount || 0) / (analyticsData.appStats?.totalAmount || 1)) * 100) : 0}% of total</p>
                                        </div>
                                        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm relative overflow-hidden group">
                                            <p className="text-[11px] font-medium text-slate-500 mb-0.5">Approval Rate</p>
                                            <p className="text-[20px] font-semibold text-slate-900 tracking-tight">{analyticsData.appStats?.total ? Math.round(((analyticsData.appStats?.approved || 0 + analyticsData.appStats?.disbursed || 0) / analyticsData.appStats?.total) * 100) : 0}%</p>
                                            <p className="text-[10px] text-slate-400 mt-1">{(analyticsData.appStats?.approved || 0) + (analyticsData.appStats?.disbursed || 0)} approved</p>
                                        </div>
                                        <div className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm relative overflow-hidden group">
                                            <p className="text-[11px] font-medium text-slate-500 mb-0.5">Pending Review</p>
                                            <p className="text-[20px] font-semibold text-slate-900 tracking-tight">{analyticsData.appStats?.pending || 0}</p>
                                            <p className="text-[10px] text-slate-400 mt-1">{analyticsData.appStats?.total ? Math.round(((analyticsData.appStats?.pending || 0) / analyticsData.appStats?.total) * 100) : 0}% of pipeline</p>
                                        </div>
                                    </div>

                                    {/* Application status breakdown */}
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm lg:col-span-2">
                                            <h3 className="text-sm font-semibold text-slate-900 mb-1">Application Distribution</h3>
                                            <p className="text-[11px] text-slate-500 mb-5">Global processing statistics</p>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                {[
                                                    { label: 'Pending', value: analyticsData.appStats?.pending || 0, color: 'bg-amber-400', style: 'bg-amber-50 border-amber-100 text-amber-700' },
                                                    { label: 'Processing', value: analyticsData.appStats?.processing || 0, color: 'bg-blue-400', style: 'bg-blue-50 border-blue-100 text-blue-700' },
                                                    { label: 'Approved', value: analyticsData.appStats?.approved || 0, color: 'bg-emerald-400', style: 'bg-emerald-50 border-emerald-100 text-emerald-700' },
                                                    { label: 'Rejected', value: analyticsData.appStats?.rejected || 0, color: 'bg-rose-400', style: 'bg-rose-50 border-rose-100 text-rose-700' },
                                                    { label: 'Disbursed', value: analyticsData.appStats?.disbursed || 0, color: 'bg-slate-600', style: 'bg-slate-50 border-slate-200 text-slate-700' },
                                                    { label: 'Total', value: analyticsData.appStats?.total || 0, color: 'bg-indigo-400', style: 'bg-indigo-50 border-indigo-100 text-indigo-700' },
                                                ].map((item, i) => {
                                                    const percentage = analyticsData.appStats?.total ? Math.round((item.value / analyticsData.appStats?.total) * 100) : 0;
                                                    return (
                                                        <div key={i} className={`p-3 rounded border flex flex-col gap-1 ${item.style}`}>
                                                            <div className={`w-4 h-1 rounded flex-shrink-0 ${item.color}`} />
                                                            <p className="text-xl font-semibold leading-none mt-1">{item.value}</p>
                                                            <p className="text-[10px] font-medium uppercase tracking-wider opacity-80">{item.label}</p>
                                                            {item.label !== 'Total' && <p className="text-[9px] font-medium opacity-70">{percentage}%</p>}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* User role donut */}
                                        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                                            <h3 className="text-sm font-semibold text-slate-900 mb-1">User Segmentation</h3>
                                            <p className="text-[11px] text-slate-500 mb-5">By assigned personnel role</p>
                                            <DonutChart segments={[
                                                { label: 'Students', value: analyticsData.usersByRole?.student || 0, color: '#3b82f6' },
                                                { label: 'Staff', value: analyticsData.usersByRole?.staff || 0, color: '#6366f1' },
                                                { label: 'Bank', value: analyticsData.usersByRole?.bank || 0, color: '#10b981' },
                                                { label: 'Agent', value: analyticsData.usersByRole?.agent || 0, color: '#f59e0b' },
                                                { label: 'Admin', value: analyticsData.usersByRole?.admin || 0, color: '#0f172a' },
                                            ]} />
                                            <div className="mt-4 space-y-1.5 text-[11px] font-medium text-slate-600">
                                                <div className="flex justify-between">
                                                    <span>Students:</span> <span>{analyticsData.usersByRole?.student || 0}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Staff:</span> <span>{analyticsData.usersByRole?.staff || 0}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Banks:</span> <span>{analyticsData.usersByRole?.bank || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* User growth mini chart */}
                                    <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-sm font-semibold text-slate-900">Platform Overview</h3>
                                                <p className="text-[11px] text-slate-500 mt-1">Key metrics snapshot - Last updated {lastRefresh.toLocaleTimeString('en-IN')}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                            <div className="p-3 bg-slate-50 rounded border border-slate-100">
                                                <p className="text-[10px] font-medium text-slate-500 uppercase mb-0.5">Total Users</p>
                                                <p className="text-lg font-semibold text-slate-900">{(analyticsData.usersByRole?.student || 0) + (analyticsData.usersByRole?.staff || 0) + (analyticsData.usersByRole?.bank || 0) + (analyticsData.usersByRole?.agent || 0) + (analyticsData.usersByRole?.admin || 0)}</p>
                                            </div>
                                            <div className="p-3 bg-indigo-50 rounded border border-indigo-100">
                                                <p className="text-[10px] font-medium text-indigo-600 uppercase mb-0.5">Active Apps</p>
                                                <p className="text-lg font-semibold text-indigo-700">{analyticsData.appStats?.total || 0}</p>
                                            </div>
                                            <div className="p-3 bg-emerald-50 rounded border border-emerald-100">
                                                <p className="text-[10px] font-medium text-emerald-600 uppercase mb-0.5">Successful</p>
                                                <p className="text-lg font-semibold text-emerald-700">{(analyticsData.appStats?.disbursed || 0)}</p>
                                            </div>
                                            <div className="p-3 bg-amber-50 rounded border border-amber-100">
                                                <p className="text-[10px] font-medium text-amber-600 uppercase mb-0.5">In Review</p>
                                                <p className="text-lg font-semibold text-amber-700">{(analyticsData.appStats?.processing || 0) + (analyticsData.appStats?.pending || 0)}</p>
                                            </div>
                                            <div className="p-3 bg-blue-50 rounded border border-blue-100">
                                                <p className="text-[10px] font-medium text-blue-600 uppercase mb-0.5">Avg Loan</p>
                                                <p className="text-lg font-semibold text-blue-700">₹{analyticsData.appStats?.total ? Math.round((analyticsData.appStats?.totalAmount || 0) / analyticsData.appStats?.total / 100000) * 100000 : 0}</p>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* ─── PORTAL CONTROL CENTER ────────────────────────────────── */}

                    {/* ─── SYSTEM CONTROL ───────────────────────────────────────── */}
                    {activeSection === "system" && (
                        <div className="space-y-6 animate-fade-in max-w-[1400px] mx-auto">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">System Control Domain</h2>
                                    <p className="text-slate-500 text-[11px] mt-1 font-medium flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">settings</span>
                                        Platform-wide node controls and broadcasts
                                    </p>
                                </div>
                                <div className={`px-2.5 py-1 rounded border flex items-center gap-1.5 ${maintenanceMode ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${maintenanceMode ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse`}></span>
                                    <span className="text-[10px] font-semibold uppercase tracking-wider">{maintenanceMode ? 'Maintenance Mode' : 'System Live'}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Maintenance & Feature Flags */}
                                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-5">
                                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] text-slate-400">tune</span>
                                        Platform Logic
                                    </h3>

                                    <div className="space-y-3">
                                    {[
                                        {
                                            label: 'Maintenance Mode',
                                            description: 'Disable public access to the student portal',
                                            icon: 'construction',
                                            active: maintenanceMode,
                                            toggle: () => setMaintenanceMode(!maintenanceMode)
                                        },
                                        {
                                            label: 'AI Review Engine',
                                            description: 'Enable automated application scoring',
                                            icon: 'psychology',
                                            active: true,
                                            toggle: () => alert('AI Review toggle requires backend configuration')
                                        },
                                        {
                                            label: 'DigiLocker Integration',
                                            description: 'Direct document verification gateway',
                                            icon: 'folder_managed',
                                            active: true,
                                            toggle: () => alert('DigiLocker toggle requires backend configuration')
                                        },
                                        {
                                            label: 'Community Forum',
                                            description: 'Enable social and peer-to-peer modules',
                                            icon: 'forum',
                                            active: true,
                                            toggle: () => alert('Forum toggle requires backend configuration')
                                        },
                                    ].map((feature, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded border border-slate-100 hover:border-slate-200 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm`}>
                                                    <span className="material-symbols-outlined text-[16px]">{feature.icon}</span>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-900 leading-tight">{feature.label}</p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">{feature.description}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={feature.toggle}
                                                className={`relative inline-flex w-8 h-4 rounded-full transition-colors ${feature.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                            >
                                                <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${feature.active ? 'translate-x-4.5' : 'translate-x-0.5'}`} style={{ transform: feature.active ? 'translateX(16px)' : 'translateX(2px)' }} />
                                            </button>
                                        </div>
                                    ))}
                                    </div>
                                </div>

                                {/* Announcements */}
                                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col">
                                    <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] text-slate-400">campaign</span>
                                        System Broadcasts
                                    </h3>

                                    <div className="space-y-3 mb-6">
                                        <input
                                            type="text"
                                            value={newAnnouncement.title}
                                            onChange={e => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                                            placeholder="Announcement title..."
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                                        />
                                        <textarea
                                            value={newAnnouncement.message}
                                            onChange={e => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
                                            placeholder="Detailed messaging..."
                                            rows={2}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all resize-none"
                                        />
                                        <div className="grid grid-cols-2 gap-2">
                                            <select
                                                value={newAnnouncement.type}
                                                onChange={e => setNewAnnouncement({ ...newAnnouncement, type: e.target.value })}
                                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                                            >
                                                <option value="info">ℹ Standard</option>
                                                <option value="warning">⚠ Caution</option>
                                                <option value="error">🔴 Critical</option>
                                            </select>
                                            <select
                                                value={newAnnouncement.target}
                                                onChange={e => setNewAnnouncement({ ...newAnnouncement, target: e.target.value })}
                                                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                                            >
                                                <option value="all">Every Portal</option>
                                                <option value="staff">Internal (Staff)</option>
                                                <option value="bank">Banking Nodes</option>
                                                <option value="user">Public (Users)</option>
                                            </select>
                                        </div>
                                        <button
                                            onClick={addAnnouncement}
                                            disabled={annLoading}
                                            className="w-full bg-slate-900 text-white py-2.5 rounded text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">send</span>
                                            Publish Broadcast
                                        </button>
                                    </div>

                                    <div className="space-y-2 flex-1 overflow-y-auto min-h-[160px] custom-scrollbar">
                                        {announcements.length === 0 ? (
                                            <div className="text-center py-8 text-slate-400 border border-dashed border-slate-200 rounded bg-slate-50">
                                                <span className="material-symbols-outlined text-2xl block mb-1 opacity-50">notifications_none</span>
                                                <p className="text-[10px] font-medium uppercase tracking-wider">No active broadcasts</p>
                                            </div>
                                        ) : announcements.map(ann => (
                                            <AnnouncementItem key={ann.id} ann={ann} onDelete={deleteAnnouncement} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ─── FULL AUDIT LOGS ──────────────────────────────────────── */}
                    {activeSection === "audit_logs" && (
                        <div className="space-y-6 animate-fade-in max-w-[1400px] mx-auto">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">System Audit Catalog</h2>
                                    <p className="text-slate-500 text-[11px] mt-1 font-medium flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">history</span>
                                        Complete ledger of authenticated node operations
                                    </p>
                                </div>
                                <div className="flex gap-2 flex-wrap text-sm">
                                    {['all', 'create', 'update', 'delete'].map(f => (
                                        <button
                                            key={f}
                                            onClick={() => { setAuditFilter(f); setAuditPage(1); }}
                                            className={`px-3 py-1.5 rounded transition-colors text-xs font-medium border ${auditFilter === f ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            {f.charAt(0).toUpperCase() + f.slice(1)}
                                        </button>
                                    ))}
                                    <button onClick={() => loadData()} className="ml-1 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors bg-white border border-slate-200 rounded shadow-sm">
                                        <span className="material-symbols-outlined text-[16px]">refresh</span>
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <TableHeader>
                                            <th className="px-4 py-3">Timestamp</th>
                                            <th className="px-4 py-3">Operation</th>
                                            <th className="px-4 py-3">Context</th>
                                            <th className="px-4 py-3">Entity Ref</th>
                                            <th className="px-4 py-3">Initiator</th>
                                        </TableHeader>
                                        <tbody className="divide-y divide-slate-100">
                                            {loading ? (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                                                        <div className="w-6 h-6 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-2" />
                                                        <span className="text-[11px] font-medium">Loading...</span>
                                                    </td>
                                                </tr>
                                            ) : pagedAuditLogs.length > 0 ? pagedAuditLogs.map((log: any, i: number) => (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors text-xs">
                                                    <td className="px-4 py-3 text-slate-500 tabular-nums">
                                                        {format(new Date(log.createdAt), 'MMM d, yyyy · HH:mm')}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize ${log.action === 'create' ? 'bg-emerald-50 text-emerald-700' : log.action === 'delete' ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                                                            {log.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-slate-700 font-medium capitalize text-[11px] bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                                                            {log.entityType}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <code className="text-[10px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                            {log.entityId?.substring(0, 12)}
                                                        </code>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="text-xs font-medium text-slate-900">{log.initiator?.firstName || 'System'}</span>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400 text-xs">No matching events</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {filteredAuditLogs.length > 20 && (
                                    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                                        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                                            {Math.min((auditPage - 1) * 20 + 1, filteredAuditLogs.length)}—{Math.min(auditPage * 20, filteredAuditLogs.length)} of {filteredAuditLogs.length}
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                                                disabled={auditPage === 1}
                                                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded text-[11px] font-medium disabled:opacity-50 hover:bg-slate-50 transition-colors shadow-sm"
                                            >
                                                Previous
                                            </button>
                                            <button
                                                onClick={() => setAuditPage(p => Math.min(Math.ceil(filteredAuditLogs.length / 20), p + 1))}
                                                disabled={auditPage >= Math.ceil(filteredAuditLogs.length / 20)}
                                                className="px-3 py-1.5 bg-slate-900 text-white rounded text-[11px] font-medium disabled:opacity-50 hover:bg-slate-800 transition-colors shadow-sm"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── CHAT ─────────────────────────────────────────────────── */}
                    {activeSection === "chat" && <ChatInterface role="staff" />}

                    {/* ─── CAMPAIGNS ──────────────────────────────────────────────── */}
                    {activeSection.startsWith("campaigns_") && (
                        <CampaignsDashboard activeSubmenu={activeSection} setActiveSubmenu={setActiveSection} />
                    )}

                    {/* ─── COMMUNITY FORUM MANAGEMENT ────────────────────────── */}
                    {activeSection === "community" && (
                        <div className="space-y-6 animate-fade-in max-w-[1400px] mx-auto">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Community Governance</h2>
                                    <p className="text-slate-500 text-[11px] mt-1 font-medium flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">forum</span>
                                        Mentorship oversight and resource distribution
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={loadCommunityData} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all bg-white border border-slate-200 rounded-lg">
                                        <span className="material-symbols-outlined text-[20px]">refresh</span>
                                    </button>
                                </div>
                            </div>

                            {/* Community Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <StatCard label="Active Mentors" value={communityStats.activeMentors || 0} icon="workspace_premium" color="text-slate-900" loading={loading} />
                                <StatCard label="Social Signals" value={communityStats.totalPosts || 0} icon="forum" color="text-slate-900" loading={loading} />
                                <StatCard label="Appreciation" value={communityStats.totalEngagement || 0} icon="favorite" color="text-slate-900" loading={loading} />
                                <StatCard label="Resources" value={communityStats.resourcesCount || 0} icon="library_books" color="text-slate-900" loading={loading} />
                            </div>

                            {/* Mentors Management Section */}
                            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-6">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[16px] text-slate-400">workspace_premium</span>
                                            Mentorship Council
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-1">{mentors.length} specialists actively broadcasting guidance</p>
                                    </div>
                                    <button className="px-4 py-2 bg-slate-900 text-white rounded text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-800 transition-colors shadow-sm">
                                        <span className="material-symbols-outlined text-[14px]">person_add</span>
                                        Onboard Specialist
                                    </button>
                                </div>

                                {mentors.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {mentors.map((mentor: any, i: number) => (
                                            <div key={i} className="p-4 rounded border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors group relative overflow-hidden">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                                        <div className="w-10 h-10 rounded overflow-hidden border border-slate-200 bg-white flex-shrink-0 shadow-sm">
                                                            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${mentor.email || mentor.id}`} alt="" className="w-full h-full object-cover" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-slate-900 truncate tracking-tight">{mentor.name || `${mentor.firstName} ${mentor.lastName}`}</p>
                                                            <p className="text-[10px] text-slate-500 truncate">{mentor.expertise || 'General Specialist'}</p>
                                                        </div>
                                                    </div>
                                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-semibold uppercase tracking-wider rounded border border-emerald-100">Live</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 mb-4">
                                                    <div className="p-2 bg-white border border-slate-100 rounded">
                                                        <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">Mentees</p>
                                                        <p className="text-[12px] font-semibold text-slate-900">{mentor.menteeCount || '15+'}</p>
                                                    </div>
                                                    <div className="p-2 bg-white border border-slate-100 rounded">
                                                        <p className="text-[9px] font-medium text-slate-500 uppercase tracking-wider mb-0.5">Rating</p>
                                                        <p className="text-[12px] font-semibold text-slate-900">{mentor.rating || '4.9'}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button className="flex-1 px-2 py-1.5 rounded bg-white hover:bg-slate-50 text-[10px] font-medium text-slate-600 transition-colors border border-slate-200 shadow-sm">Profile</button>
                                                    <button onClick={() => handleRevokeMentor(mentor.id)} className="flex-1 px-2 py-1.5 rounded text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-[10px] font-medium transition-colors border border-transparent">Revoke</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-20 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
                                        <span className="material-symbols-outlined text-5xl text-slate-200 block mb-3">supervisor_account</span>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No active specialists registered</p>
                                    </div>
                                )}
                            </div>

                            {/* Forum Posts Section */}
                            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[16px] text-slate-400">forum</span>
                                            Recent Social Broadcasts
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-1">Live monitoring of community interaction layers</p>
                                    </div>
                                    <div className="flex items-center gap-2 px-2 py-1 bg-slate-50 rounded border border-slate-100">
                                        <span className="text-[9px] font-medium text-slate-500 uppercase tracking-wider tabular-nums">Sync: {lastRefresh.toLocaleTimeString()}</span>
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    </div>
                                </div>

                                {filteredData.length > 0 ? (
                                    <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                                        {filteredData.slice(0, 10).map((post: any, i: number) => (
                                            <div key={i} className="p-4 rounded border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-colors group">
                                                <div className="flex items-start justify-between gap-4 mb-3">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-slate-900 line-clamp-2 leading-snug">{post.title}</p>
                                                        <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5">
                                                            <span className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center text-[9px] font-semibold text-slate-600">
                                                                {(post.author?.firstName || post.authorName || 'U')[0]}
                                                            </span>
                                                            Broadcast by <span className="font-semibold">{post.author?.firstName || post.authorName}</span>
                                                        </p>
                                                    </div>
                                                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 ${post.isPinned ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                                        {post.isPinned ? 'Anchor' : 'Relay'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-[10px] font-medium text-slate-400 mb-3 tabular-nums">
                                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">favorite</span> {post.likesCount || 0}</span>
                                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">chat_bubble</span> {post.comments?.length || 0}</span>
                                                    <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">visibility</span> {post.views || 0}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleTogglePin(post.id, post.isPinned)} className={`px-3 py-1.5 rounded border text-[10px] font-medium transition-colors shadow-sm ${post.isPinned ? 'bg-amber-100 border-amber-200 text-amber-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                                        {post.isPinned ? 'Unpin' : 'Pin to Top'}
                                                    </button>
                                                    <button onClick={() => handleModeratePost(post.id)} className="px-3 py-1.5 rounded bg-white border border-rose-100 text-rose-600 hover:bg-rose-50 text-[10px] font-medium transition-colors shadow-sm">Moderate</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded">
                                        <span className="material-symbols-outlined text-3xl text-slate-300 block mb-2">forum</span>
                                        <p className="text-[11px] font-medium text-slate-500">No active forum discussions detected</p>
                                    </div>
                                )}
                            </div>

                            {/* Community Resources Section */}
                            <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
                                <div className="mb-6">
                                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] text-slate-400">library_books</span>
                                        Asset Repository
                                    </h3>
                                    <p className="text-[11px] text-slate-500 mt-1">Managed literature and instructional documentation</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {communityResources.length > 0 ? communityResources.map((resource: any, i: number) => (
                                        <div key={i} className="p-4 rounded border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-colors group relative">
                                            <div className="flex items-start gap-3 mb-3">
                                                <div className="w-8 h-8 rounded bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-500 flex-shrink-0 group-hover:text-slate-900 transition-colors">
                                                    <span className="material-symbols-outlined text-[16px]">
                                                        {resource.type === 'guide' ? 'article' : resource.type === 'video' ? 'movie_edit' : 'description'}
                                                    </span>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider leading-none mb-1">{resource.type || 'Resource'}</p>
                                                    <p className="text-xs font-semibold text-slate-900 leading-snug truncate">{resource.title}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between text-[10px] font-medium text-slate-500 mb-4 tabular-nums">
                                                <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">download</span> {resource.downloads || 0} Units</span>
                                                {resource.isFeatured && <span className="text-amber-600 flex items-center gap-1">★ Featured</span>}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => window.open(resource.fileUrl || resource.downloadUrl, '_blank')} className="flex-1 px-3 py-1.5 rounded bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold hover:bg-slate-50 transition-colors shadow-sm">Access</button>
                                                <button onClick={() => handleDeleteResource(resource.id)} className="w-8 h-8 flex items-center justify-center rounded border border-rose-100 text-rose-600 hover:bg-rose-50 transition-colors">
                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="col-span-full py-12 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                            <p className="text-[11px] text-slate-500">No managed resources found</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeSection === "banks" && (
                        <AdminBanksSection />
                    )}

                    {activeSection === "countries" && (
                        <AdminCountriesSection />
                    )}

                    {activeSection === "site_settings" && (
                        <SiteSettingsSection />
                    )}

                    {/* ─── USERS MANAGEMENT DASHBOARD ──────────────────────────────────────── */}
                    {isUserSection && (
                        <div className="space-y-6 animate-fade-in max-w-[1400px] mx-auto">
                            {/* Section Header */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight flex items-center gap-2.5">
                                        <span className="material-symbols-outlined text-indigo-600 text-[24px]">
                                            {activeSection === "users_students" ? "school" :
                                             activeSection === "users_staff" ? "badge" :
                                             activeSection === "users_agents" ? "support_agent" :
                                             activeSection === "users_banks" ? "account_balance" : "groups"}
                                        </span>
                                        {activeSection === "users_students" ? "Students & User Accounts" :
                                         activeSection === "users_staff" ? "Staff & Operations Team" :
                                         activeSection === "users_agents" ? "Channel Agents & Partners" :
                                         activeSection === "users_banks" ? "Bank Representatives & Officers" : "User Identity Directory"}
                                    </h2>
                                    <p className="text-slate-500 text-[11px] mt-1 font-medium flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">info</span>
                                        {activeSection === "users_students" ? `Managing ${stats.studentCount || 0} registered student accounts and study abroad applicants` :
                                         activeSection === "users_staff" ? `Managing ${stats.staffCount || 0} loan processing officers, underwriters, and operations staff` :
                                         activeSection === "users_agents" ? `Managing ${stats.agentCount || 0} referral partners, consultants, and channel agents` :
                                         activeSection === "users_banks" ? `Managing ${stats.bankCount || 0} bank partner accounts and financial institution officers` :
                                         `Managing ${stats.userCount || 0} authenticated platform identity nodes`}
                                    </p>
                                </div>
                                <div className="flex gap-2 items-center">
                                    {activeSection === "users_staff" && (
                                        <button 
                                            onClick={() => {
                                                loadOffices();
                                                setShowAddOfficeModal(true);
                                            }} 
                                            className="px-3.5 py-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 rounded-lg text-xs font-semibold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                                            title="Register new office location (Location, City, Office)"
                                        >
                                            <span className="material-symbols-outlined text-[16px] text-indigo-600">domain_add</span>
                                            Add Office
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => {
                                            if (activeSection === "users_agents") {
                                                router.push("/admin/users/agents/create");
                                            } else if (activeSection === "users_staff") {
                                                router.push("/admin/users/staff/create");
                                            } else {
                                                openCreateUserModal(
                                                    activeSection === "users_banks" ? "bank" : "user"
                                                );
                                            }
                                        }} 
                                        className="px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">person_add</span>
                                        {activeSection === "users_students" ? "Create Student Profile" :
                                         activeSection === "users_staff" ? "Create Staff Profile" :
                                         activeSection === "users_agents" ? "Create Agent Profile" :
                                         activeSection === "users_banks" ? "Create Bank Officer Profile" : "Create Student Profile"}
                                    </button>
                                </div>
                            </div>

                            {/* Dynamic Stat Cards */}
                            {activeSection === "users" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                    <StatCard label="Total Nodes" value={stats.userCount || 0} icon="group" color="text-slate-900" loading={loading} />
                                    <StatCard label="Students / Users" value={stats.studentCount || 0} icon="school" color="text-indigo-600" loading={loading} />
                                    <StatCard label="Operations Staff" value={stats.staffCount || 0} icon="badge" color="text-blue-600" loading={loading} />
                                    <StatCard label="Bank Officers" value={stats.bankCount || 0} icon="account_balance" color="text-emerald-600" loading={loading} />
                                    <StatCard label="Agent Partners" value={stats.agentCount || 0} icon="support_agent" color="text-amber-600" loading={loading} />
                                </div>
                            )}

                            {activeSection === "users_students" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard label="Registered Students" value={stats.studentCount || 0} icon="school" color="text-indigo-600" loading={loading} />
                                    <StatCard label="Total Applications" value={stats.appCount || 0} icon="receipt_long" color="text-blue-600" loading={loading} />
                                    <StatCard label="Disbursed Loans" value={stats.disbursedCount || 0} icon="electric_bolt" color="text-emerald-600" loading={loading} />
                                    <StatCard label="Active Students" value={activeUsersCount || 1} icon="insights" color="text-amber-600" loading={loading} />
                                </div>
                            )}

                            {activeSection === "users_staff" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard label="Total Staff Members" value={stats.staffCount || 0} icon="badge" color="text-indigo-600" loading={loading} />
                                    <StatCard label="Active on Duty" value={data.filter((u: any) => !u.isResigned && u.status !== 'resigned' && !u.isOnLeave).length} icon="task_alt" color="text-emerald-600" loading={loading} />
                                    <StatCard label="Currently On Leave" value={data.filter((u: any) => u.isOnLeave).length} icon="beach_access" color="text-amber-600" loading={loading} />
                                    <StatCard label="Resigned Staff" value={data.filter((u: any) => u.isResigned || u.status === 'resigned').length} icon="person_off" color="text-rose-600" loading={loading} />
                                </div>
                            )}

                            {activeSection === "users_agents" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard label="Total Agent Partners" value={stats.agentCount || 0} icon="support_agent" color="text-amber-600" loading={loading} />
                                    <StatCard label="Active Logins" value={data.filter((u: any) => u.last_login_at).length} icon="login" color="text-indigo-600" loading={loading} />
                                    <StatCard label="Referral Channels" value={stats.agentCount || 0} icon="share" color="text-emerald-600" loading={loading} />
                                    <StatCard label="Connected Nodes" value={stats.agentCount || 0} icon="hub" color="text-blue-600" loading={loading} />
                                </div>
                            )}

                            {activeSection === "users_banks" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard label="Bank Representatives" value={stats.bankCount || 0} icon="account_balance" color="text-emerald-600" loading={loading} />
                                    <StatCard label="Active Sessions" value={data.filter((u: any) => u.last_login_at).length} icon="verified_user" color="text-indigo-600" loading={loading} />
                                    <StatCard label="Banking Nodes" value={stats.bankCount || 0} icon="domain" color="text-blue-600" loading={loading} />
                                    <StatCard label="Partner Institutions" value={stats.bankCount || 0} icon="account_balance_wallet" color="text-amber-600" loading={loading} />
                                </div>
                            )}
                            
                            {/* Entity Registry Table */}
                            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                                <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-900">
                                            {activeSection === "users_students" ? "Student Registry" :
                                             activeSection === "users_staff" ? "Staff Operations Roster" :
                                             activeSection === "users_agents" ? "Agent Partner Directory" :
                                             activeSection === "users_banks" ? "Bank Officers Directory" : "Entity Registry"}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 mt-1">{totalItems} records active in current buffer</p>
                                    </div>
                                    <div className="flex flex-wrap gap-3 items-center">
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[14px]">search</span>
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                placeholder="Query identity..."
                                                className="pl-8 pr-4 py-1.5 bg-white border border-slate-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48 transition-all"
                                            />
                                        </div>
                                        {activeSection === "users" && (
                                            <div className="flex bg-white rounded border border-slate-200 overflow-hidden shadow-sm">
                                                {['all', 'user', 'student', 'staff', 'bank', 'agent'].map(r => (
                                                    <button
                                                        key={r}
                                                        onClick={() => setRoleFilter(r)}
                                                        className={`px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider transition-colors border-r last:border-r-0 border-slate-100 cursor-pointer ${roleFilter === r ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                                                    >
                                                        {r}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {(activeSection === "users_banks" || activeSection === "users") && bankPartners.length > 0 && (
                                            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded px-2.5 py-1 shadow-xs">
                                                <span className="material-symbols-outlined text-[15px] text-emerald-600">account_balance</span>
                                                <select
                                                    value={bankPartnerFilter}
                                                    onChange={e => setBankPartnerFilter(e.target.value)}
                                                    className="text-[11px] font-semibold text-slate-700 bg-transparent focus:outline-none cursor-pointer"
                                                >
                                                    <option value="all">All Bank Partners ({bankPartners.length})</option>
                                                    {bankPartners.map((bp: any) => (
                                                        <option key={bp.id || bp.shortName} value={bp.shortName}>
                                                            {bp.name} ({bp.shortName})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        {selectedUsers.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const firstSelected = (filteredData || []).find((u: any) => selectedUsers.includes(u.id));
                                                    if (firstSelected) handleOpenEmailModal(firstSelected);
                                                }}
                                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-semibold uppercase tracking-wider cursor-pointer shadow-xs transition-all flex items-center gap-1.5"
                                                title="Send email to selected user"
                                            >
                                                <span className="material-symbols-outlined text-[13px]">mail</span>
                                                Email ({selectedUsers.length})
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                                            <tr>
                                                <th className="px-5 py-3 w-10">
                                                    <input type="checkbox" onChange={e => setSelectedUsers(e.target.checked ? filteredData.map((u: any) => u.id) : [])} className="rounded border-slate-300" />
                                                </th>
                                                <th className="px-5 py-3">User Identity</th>
                                                {activeSection === "users_banks" && (
                                                    <>
                                                        <th className="px-5 py-3">Assigned Bank Partner</th>
                                                        <th className="px-5 py-3">Lending Parameters (ROI & Limits)</th>
                                                    </>
                                                )}
                                                <th className="px-5 py-3">Access Tier</th>
                                                <th className="px-5 py-3">Registration</th>
                                                <th className="px-5 py-3">Security / Activity</th>
                                                <th className="px-5 py-3 text-right">Commands</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {loading ? (
                                                <tr><td colSpan={activeSection === "users_banks" ? 8 : 6} className="px-6 py-16 text-center">
                                                    <div className="w-8 h-8 border-2 border-slate-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                                                </td></tr>
                                            ) : (filteredData.length > 0 ? (
                                                filteredData.map((item: any, idx: number) => {
                                                    const itemAssignedBank = getAssignedBank(item);
                                                    return (
                                                    <tr key={idx} className={`group hover:bg-slate-50/50 transition-all ${selectedUsers.includes(item.id) ? 'bg-indigo-50/30' : ''}`}>
                                                        <td className="px-5 py-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedUsers.includes(item.id)}
                                                                onChange={() => toggleUserSelect(item.id)}
                                                                className="rounded border-slate-300"
                                                            />
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <button 
                                                                onClick={() => window.open(`/admin/user-details/${item.id}`, '_blank')}
                                                                className="flex items-center gap-3 cursor-pointer hover:bg-indigo-50 p-2 rounded -m-2 transition-all group w-full text-left"
                                                            >
                                                                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-slate-200">
                                                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${item.email}`} alt="" className="w-full h-full object-cover" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-[12px] font-semibold text-slate-900 group-hover:text-indigo-600 underline transition-colors flex items-center gap-1.5 flex-wrap">
                                                                        {item.firstName} {item.lastName}
                                                                        {(item.isResigned || item.status === 'resigned') && (
                                                                            <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">Resigned (Invalid)</span>
                                                                        )}
                                                                        {item.isOnLeave && (
                                                                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">On Leave</span>
                                                                        )}
                                                                        {(item.role === 'agent' || item.isDraft || item.status === 'draft') && (
                                                                            item.isDraft || item.status === 'draft' ? (
                                                                                <span className="text-[9px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                                                    <span className="material-symbols-outlined text-[10px]">edit_document</span>
                                                                                    Draft
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                                                    <span className="material-symbols-outlined text-[10px]">verified</span>
                                                                                    Active Partner
                                                                                </span>
                                                                            )
                                                                        )}
                                                                    </p>
                                                                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                                                        <p className="text-[10px] text-slate-500 font-medium">{item.email}</p>
                                                                        {itemAssignedBank && (
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs" title={`Assigned Bank: ${itemAssignedBank.name}`}>
                                                                                {itemAssignedBank.logoUrl ? (
                                                                                    <img src={itemAssignedBank.logoUrl} alt="" className="w-3 h-3 object-contain" />
                                                                                ) : (
                                                                                    <span className="material-symbols-outlined text-[11px] text-emerald-600">account_balance</span>
                                                                                )}
                                                                                {itemAssignedBank.name} ({itemAssignedBank.shortName})
                                                                            </span>
                                                                        )}
                                                                        {(item.officeLocation || item.officeId) && (
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100" title={`Assigned Office: ${item.officeLocation || item.officeId}`}>
                                                                                <span className="material-symbols-outlined text-[11px] text-indigo-500">apartment</span>
                                                                                {item.officeLocation ? item.officeLocation.split(' - ')[0] : 'Office'}
                                                                            </span>
                                                                        )}
                                                                        {item.role === 'agent' && (item.partnership || item.percentage) && (
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                                                                <span className="material-symbols-outlined text-[11px] text-amber-600">handshake</span>
                                                                                {item.partnership || 'Partner'} {item.percentage ? `· ${item.percentage}%` : ''}
                                                                            </span>
                                                                        )}
                                                                        {item.role === 'agent' && item.panNumber && (
                                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-100 text-slate-700 border border-slate-200" title="PAN Number">
                                                                                PAN: {item.panNumber}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </button>
                                                        </td>
                                                        {activeSection === "users_banks" && (
                                                            <>
                                                                <td className="px-5 py-3">
                                                                    {itemAssignedBank ? (
                                                                        <div className="flex items-center gap-2.5">
                                                                            {itemAssignedBank.logoUrl ? (
                                                                                <img src={itemAssignedBank.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain bg-white border border-slate-200 p-1 shadow-xs flex-shrink-0" />
                                                                            ) : (
                                                                                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs flex-shrink-0">
                                                                                    <span className="material-symbols-outlined text-[16px]">account_balance</span>
                                                                                </div>
                                                                            )}
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                                    <span className="text-[12px] font-bold text-slate-900 leading-tight">
                                                                                        {itemAssignedBank.name}
                                                                                    </span>
                                                                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                                                                                        {itemAssignedBank.shortName}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                                                                        {itemAssignedBank.type || 'Lending Partner'}
                                                                                    </p>
                                                                                    {bankPartners.length > 0 && (
                                                                                        <select
                                                                                            disabled={updatingUserBank}
                                                                                            value={(itemAssignedBank.shortName || '').toLowerCase()}
                                                                                            onChange={(e) => {
                                                                                                if (e.target.value) handleUpdateUserBank(item.id, item.email, e.target.value);
                                                                                            }}
                                                                                            className="text-[9px] font-semibold text-slate-500 hover:text-emerald-700 bg-transparent border-0 underline cursor-pointer p-0 focus:outline-none"
                                                                                            title="Reassign Partner Bank"
                                                                                        >
                                                                                            {bankPartners.map((bp: any) => (
                                                                                                <option key={bp.id || bp.shortName} value={bp.shortName}>
                                                                                                    Reassign: {bp.name}
                                                                                                </option>
                                                                                            ))}
                                                                                        </select>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex items-center gap-2">
                                                                            <select
                                                                                disabled={updatingUserBank}
                                                                                onChange={(e) => {
                                                                                    if (e.target.value) handleUpdateUserBank(item.id, item.email, e.target.value);
                                                                                }}
                                                                                defaultValue=""
                                                                                className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg px-2.5 py-1 cursor-pointer transition-colors shadow-xs"
                                                                            >
                                                                                <option value="" disabled>+ Assign Bank Partner</option>
                                                                                {bankPartners.map((bp: any) => (
                                                                                    <option key={bp.id || bp.shortName} value={bp.shortName}>
                                                                                        {bp.name} ({bp.shortName})
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-5 py-3">
                                                                    {itemAssignedBank ? (
                                                                        <div className="space-y-1">
                                                                            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                                                                <span className="material-symbols-outlined text-[13px]">percent</span>
                                                                                <span>ROI: {itemAssignedBank.interestRateMin || 8.5}% - {itemAssignedBank.interestRateMax || 14.5}% p.a.</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1.5 text-[9px] font-semibold text-slate-600 flex-wrap">
                                                                                <span className="px-1.5 py-0.5 bg-slate-50 rounded border border-slate-200" title="Max Loan Cap">
                                                                                    Cap: {itemAssignedBank.maxLoanAmount || '₹1.50 Cr'}
                                                                                </span>
                                                                                <span className="px-1.5 py-0.5 bg-slate-50 rounded border border-slate-200" title="Collateral Free Limit">
                                                                                    Collateral-Free: {itemAssignedBank.collateralFreeLimit || '₹50 L'}
                                                                                </span>
                                                                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200" title="Turnaround SLA">
                                                                                    SLA: {itemAssignedBank.processingTime || '3-5 Days'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-[10px] font-medium text-slate-400 italic">Assign bank to view parameters</span>
                                                                    )}
                                                                </td>
                                                            </>
                                                        )}
                                                        <td className="px-5 py-3">
                                                            <div className="relative inline-block min-w-[125px]">
                                                                <select
                                                                    value={item.role || 'user'}
                                                                    onChange={(e) => handleUserRole(item.email, e.target.value)}
                                                                    className={`w-full px-2 py-0.5 pr-6 rounded text-[9px] font-bold uppercase tracking-widest border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all ${
                                                                        item.role === 'admin' ? 'bg-slate-900 text-white border-slate-900' :
                                                                        item.role === 'super_admin' ? 'bg-indigo-900 text-white border-indigo-900' :
                                                                        item.role === 'staff' ? 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100/50' :
                                                                        item.role === 'bank' ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100/50' :
                                                                        item.role === 'agent' ? 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100/50' :
                                                                        item.role === 'student' ? 'bg-indigo-50 text-indigo-700 border-indigo-100 hover:bg-indigo-100/50' :
                                                                        'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                                                    }`}
                                                                >
                                                                    <option value="user" className="bg-white text-slate-900 font-medium">User</option>
                                                                    <option value="student" className="bg-white text-slate-900 font-medium">Student</option>
                                                                    <option value="staff" className="bg-white text-slate-900 font-medium">Staff</option>
                                                                    <option value="bank" className="bg-white text-slate-900 font-medium">Bank</option>
                                                                    <option value="agent" className="bg-white text-slate-900 font-medium">Agent</option>
                                                                </select>
                                                                <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[12px] pointer-events-none text-slate-400">
                                                                    arrow_drop_down
                                                                </span>
                                                            </div>
                                                            {(item.role === 'staff' || item.role === 'staff_admin') && (
                                                                <div className="flex items-center gap-1 mt-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleToggleResigned(item.id, !!(item.isResigned || item.status === 'resigned'))}
                                                                        className={`px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded border transition-all cursor-pointer ${
                                                                            (item.isResigned || item.status === 'resigned')
                                                                                ? "bg-rose-600 text-white border-rose-700 shadow-xs"
                                                                                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-600"
                                                                        }`}
                                                                        title={(item.isResigned || item.status === 'resigned') ? "Staff member is Resigned (Invalid). Click to reinstate." : "Click to mark staff member as Resigned (Invalid)"}
                                                                    >
                                                                        {(item.isResigned || item.status === 'resigned') ? '⛔ Resigned' : 'Resign'}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleToggleLeave(item.id, !!item.isOnLeave)}
                                                                        className={`px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded border transition-all cursor-pointer ${
                                                                            item.isOnLeave
                                                                                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                                                                                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                                        }`}
                                                                        title={item.isOnLeave ? "Staff member is On Leave. Click to mark available." : "Click to mark staff member On Leave"}
                                                                    >
                                                                        {item.isOnLeave ? '🏖️ On Leave' : 'Leave'}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 text-[11px] font-medium text-slate-500 tabular-nums">
                                                            {item.createdAt ? format(new Date(item.createdAt), 'MMM d, yyyy') : '—'}
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            {item.last_login_at ? (
                                                                <div className="flex flex-col gap-1.5">
                                                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                                                                        <span className="material-symbols-outlined text-[13px] text-indigo-500">location_on</span>
                                                                        {item.last_login_location || 'Unknown'}
                                                                    </div>
                                                                    <div className="flex flex-wrap gap-1.5 text-[8px] font-black tracking-widest uppercase text-slate-500">
                                                                        <span className="px-1.5 py-0.5 bg-slate-50 rounded border border-slate-200 flex items-center gap-1">
                                                                            {item.last_login_device?.split(' - ')[0] || 'Device'}
                                                                        </span>
                                                                        <span className="px-1.5 py-0.5 bg-slate-50 rounded border border-slate-200 flex items-center gap-1">
                                                                            {item.last_login_ip || '0.0.0.0'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">Never Logged In</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 text-right">
                                                            <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <button
                                                                    onClick={() => window.open(`/admin/user-details/${item.id}`, '_blank')}
                                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100 cursor-pointer"
                                                                    title="View Identity Profile"
                                                                >
                                                                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenEmailModal(item)}
                                                                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100 cursor-pointer"
                                                                    title="Send Email to User"
                                                                >
                                                                    <span className="material-symbols-outlined text-[16px]">mail</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => setEditingUser({ ...item })}
                                                                    className="p-1.5 text-slate-400 hover:text-slate-900 rounded hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200 cursor-pointer"
                                                                    title="Edit User"
                                                                >
                                                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteUser(item.id, `${item.firstName} ${item.lastName}`)}
                                                                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-all border border-transparent hover:border-rose-100 cursor-pointer"
                                                                    title="Delete User"
                                                                >
                                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                            ) : (
                                                <tr>
                                                    <td colSpan={activeSection === "users_banks" ? 8 : 6} className="px-6 py-12 text-center">
                                                        <span className="material-symbols-outlined text-2xl text-slate-300 block mb-2">database_off</span>
                                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No matching identity nodes</p>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {totalItems > itemsPerPage && (
                                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                                        <div className="flex flex-col">
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Navigation Console</p>
                                            <p className="text-[11px] font-bold text-slate-700">
                                                Page <span className="text-indigo-600">{currentPage}</span> of {Math.ceil(totalItems / itemsPerPage)}
                                                <span className="mx-2 text-slate-300">|</span>
                                                Total Records: <span className="text-slate-900">{totalItems}</span>
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={currentPage === 1 || loading}
                                                onClick={() => {
                                                    setCurrentPage(prev => Math.max(1, prev - 1));
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                                                Previous
                                            </button>
                                            <div className="flex items-center gap-1 mx-2">
                                                {[...Array(Math.min(5, Math.ceil(totalItems / itemsPerPage)))].map((_, i) => {
                                                    const pageNum = i + 1;
                                                    return (
                                                        <button
                                                            key={pageNum}
                                                            onClick={() => setCurrentPage(pageNum)}
                                                            className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all cursor-pointer ${currentPage === pageNum ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'}`}
                                                        >
                                                            {pageNum}
                                                        </button>
                                                    );
                                                })}
                                                {Math.ceil(totalItems / itemsPerPage) > 5 && <span className="text-slate-400 text-[10px] font-black px-1">...</span>}
                                            </div>
                                            <button
                                                disabled={currentPage >= Math.ceil(totalItems / itemsPerPage) || loading}
                                                onClick={() => {
                                                    setCurrentPage(prev => prev + 1);
                                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                                }}
                                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                                            >
                                                Next
                                                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── APPLICATIONS DASHBOARD ──────────────────────────────────────── */}
                    {activeSection === "applications" && (
                        <div className="space-y-6 animate-fade-in max-w-[1400px] mx-auto">
                            {/* Header with Title and Actions */}
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Applications & Staff Operations Control</h2>
                                    <p className="text-slate-500 text-[11px] mt-1 font-medium flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                                        Unified tracking of all applications, staff assignments, progress stages & overall details
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold ${autoRefreshEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${autoRefreshEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                            {autoRefreshEnabled ? 'LIVE SYNC' : 'PAUSED'}
                                        </span>
                                    </p>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    <button 
                                        onClick={handleAutoAssignAll}
                                        className="px-3 py-1.5 rounded font-semibold text-[10px] bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-1.5 shadow-sm"
                                        title="Assign all unassigned applications to staff via round-robin"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">autorenew</span>
                                        Auto-Assign Unassigned
                                    </button>
                                    <button 
                                        onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
                                        className={`px-3 py-1.5 rounded font-semibold text-[10px] transition-colors flex items-center gap-1.5 shadow-sm border ${autoRefreshEnabled ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'}`}
                                    >
                                        <span className="material-symbols-outlined text-[14px]">{autoRefreshEnabled ? 'sync' : 'sync_disabled'}</span>
                                        {autoRefreshEnabled ? 'Live' : 'Paused'}
                                    </button>
                                    <button onClick={() => loadData()} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded font-semibold text-[10px] hover:bg-slate-200 transition-colors flex items-center gap-1.5 shadow-sm">
                                        <span className="material-symbols-outlined text-[14px]">refresh</span>Now
                                    </button>
                                </div>
                            </div>

                            {/* Staff Workload Overview & Assignment Matrix */}
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-indigo-600 text-[18px]">badge</span>
                                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Staff Assignment & Workload Overview</h3>
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                        Total: <strong className="text-slate-900">{data.length}</strong> applications across <strong className="text-indigo-600">{staffMembers.length}</strong> active staff
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-1">
                                    {/* Unassigned Card */}
                                    {(() => {
                                        const unassignedCount = data.filter((a: any) => !a.assignedStaffId || a.assignedStaffId === 'unassigned' || a.assignedStaffId === 'null').length;
                                        return (
                                            <button
                                                onClick={() => setFilterStaff(filterStaff === 'unassigned' ? 'all' : 'unassigned')}
                                                className={`p-2.5 rounded border text-left transition-all ${filterStaff === 'unassigned' ? 'bg-amber-100 border-amber-300 ring-2 ring-amber-400' : 'bg-amber-50/60 border-amber-200 hover:bg-amber-100/60'}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700">Unassigned</span>
                                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                                                </div>
                                                <div className="text-base font-extrabold text-amber-900 mt-1">{unassignedCount}</div>
                                                <p className="text-[9px] text-amber-600 mt-0.5 truncate">Needs allocation</p>
                                            </button>
                                        );
                                    })()}

                                    {/* Staff Cards */}
                                    {staffMembers.map((staff: any) => {
                                        const staffName = `${staff.firstName || ''} ${staff.lastName || ''}`.trim() || staff.email;
                                        const assignedCount = data.filter((a: any) =>
                                            a.assignedStaffId === staff.id ||
                                            a.staffName === staffName ||
                                            a.processingStaff === staffName ||
                                            a.staffEmail === staff.email
                                        ).length;
                                        const isActive = filterStaff === staff.id || filterStaff === staffName || filterStaff === staff.email;

                                        return (
                                            <button
                                                key={staff.id}
                                                onClick={() => setFilterStaff(isActive ? 'all' : staff.id)}
                                                className={`p-2.5 rounded border text-left transition-all group ${isActive ? 'bg-indigo-100 border-indigo-300 ring-2 ring-indigo-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
                                            >
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${staff.email}`} alt="" className="w-5 h-5 rounded-full border border-slate-300 flex-shrink-0" />
                                                    <span className="text-[10px] font-bold text-slate-800 truncate group-hover:text-indigo-600" title={staffName}>{staffName}</span>
                                                </div>
                                                <div className="text-base font-extrabold text-slate-900 leading-tight">{assignedCount}</div>
                                                <p className="text-[9px] text-slate-400 truncate mt-0.5">{staff.email}</p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Pipeline Status Metric Overview */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                <div className="bg-white p-4 rounded border border-slate-200 hover:border-amber-300 transition-colors group shadow-sm">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-8 h-8 bg-amber-50 rounded flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                                            <span className="material-symbols-outlined text-[16px] text-amber-600">pending_actions</span>
                                        </div>
                                        <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Pending Review</span>
                                    </div>
                                    <p className="text-xl font-bold text-slate-900">{data.filter((a: any) => a.status === 'pending').length}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Initial submission stage</p>
                                </div>

                                <div className="bg-white p-4 rounded border border-slate-200 hover:border-blue-300 transition-colors group shadow-sm">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-8 h-8 bg-blue-50 rounded flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                            <span className="material-symbols-outlined text-[16px] text-blue-600">hourglass_bottom</span>
                                        </div>
                                        <span className="text-[9px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">Processing</span>
                                    </div>
                                    <p className="text-xl font-bold text-slate-900">{data.filter((a: any) => a.status === 'processing').length}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Under active processing</p>
                                </div>

                                <div className="bg-white p-4 rounded border border-slate-200 hover:border-emerald-300 transition-colors group shadow-sm">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-8 h-8 bg-emerald-50 rounded flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                                            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                                        </div>
                                        <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Sanctioned / Approved</span>
                                    </div>
                                    <p className="text-xl font-bold text-slate-900">{data.filter((a: any) => a.status === 'approved').length}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Ready for disbursement</p>
                                </div>

                                <div className="bg-white p-4 rounded border border-slate-200 hover:border-indigo-300 transition-colors group shadow-sm">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="w-8 h-8 bg-indigo-50 rounded flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                                            <span className="material-symbols-outlined text-[16px] text-indigo-600">account_balance_wallet</span>
                                        </div>
                                        <span className="text-[9px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Disbursed</span>
                                    </div>
                                    <p className="text-xl font-bold text-slate-900">{data.filter((a: any) => a.status === 'disbursed').length}</p>
                                    <p className="text-[10px] text-slate-500 mt-1">Fully completed loans</p>
                                </div>
                            </div>

                            {/* Search and Filters Bar */}
                            <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                                <div className="flex flex-col md:flex-row gap-4 items-end">
                                    {/* Search */}
                                    <div className="flex-1 w-full">
                                        <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Quick Search</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
                                                placeholder="Search by name, email, app ID, staff..."
                                                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs focus:outline-none focus:border-slate-400 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {/* Filters */}
                                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 w-full md:w-auto">
                                        <div>
                                            <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Assigned Staff</label>
                                            <select value={filterStaff} onChange={e => setFilterStaff(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-slate-50 focus:outline-none focus:border-slate-400 transition-colors">
                                                <option value="all">All Staff</option>
                                                <option value="unassigned">⚠️ Unassigned Only</option>
                                                {staffMembers.map((s: any) => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.firstName || s.email} {s.lastName || ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Status</label>
                                            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-slate-50 focus:outline-none focus:border-slate-400 transition-colors">
                                                <option value="all">All Statuses</option>
                                                <option value="pending">Pending</option>
                                                <option value="processing">Processing</option>
                                                <option value="approved">Approved</option>
                                                <option value="disbursed">Disbursed</option>
                                                <option value="rejected">Rejected</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Bank Partner</label>
                                            <select value={filterBank} onChange={e => setFilterBank(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-slate-50 focus:outline-none focus:border-slate-400 transition-colors">
                                                <option value="all">All Banks</option>
                                                <option value="credila">HDFC Credila</option>
                                                <option value="idfc">IDFC First Bank</option>
                                                <option value="avanse">Avanse</option>
                                                <option value="auxilo">Auxilo</option>
                                                <option value="poonawalla">Poonawalla</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Loan Type</label>
                                            <select value={filterLoanType} onChange={e => setFilterLoanType(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs bg-slate-50 focus:outline-none focus:border-slate-400 transition-colors">
                                                <option value="all">All Types</option>
                                                <option value="unsecured">Unsecured</option>
                                                <option value="secured">Secured</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block opacity-0 text-[10px] mb-1.5">Action</label>
                                            <button
                                                onClick={() => {
                                                    setFilterStatus("all");
                                                    setFilterBank("all");
                                                    setFilterLoanType("all");
                                                    setFilterStaff("all");
                                                    setSearchQuery("");
                                                }}
                                                className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-semibold text-slate-600 hover:bg-slate-200 transition-colors uppercase tracking-wider"
                                            >
                                                Clear
                                            </button>
                                        </div>

                                        <div>
                                            <label className="block opacity-0 text-[10px] mb-1.5">Auto-Assign</label>
                                            <button
                                                onClick={handleAutoAssignUnassigned}
                                                className="w-full px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded text-[10px] transition-colors uppercase tracking-wider flex items-center justify-center gap-1 shadow-xs cursor-pointer whitespace-nowrap"
                                                title="Distribute all unassigned applications evenly across active staff members"
                                            >
                                                <span className="material-symbols-outlined text-[13px]">published_with_changes</span>
                                                Auto-Assign
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bulk Action Toolbar */}
                            {selectedAppIds.length > 0 && (
                                <div className="mb-3 p-3 bg-slate-900 text-white rounded-lg shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-indigo-600 text-white px-2.5 py-1 rounded-full text-xs font-bold font-mono">
                                            {selectedAppIds.length} Selected
                                        </span>
                                        <span className="text-xs font-medium text-slate-200">
                                            Bulk reassign selected applications
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={bulkTargetStaffId}
                                            onChange={(e) => setBulkTargetStaffId(e.target.value)}
                                            className="px-3 py-1.5 text-xs font-semibold bg-white text-slate-800 border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer shadow-sm"
                                        >
                                            <option value="" disabled>-- Select Target Staff --</option>
                                            <option value="auto">⚡ Auto Round-Robin (Distribute Evenly)</option>
                                            {staffMembers.map((s: any) => (
                                                <option key={s.id} value={s.id}>
                                                    👤 {s.firstName || s.email} {s.lastName || ''} ({s.email})
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={handleBulkReassign}
                                            disabled={bulkReassigning || !bulkTargetStaffId}
                                            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-md shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                                        >
                                            {bulkReassigning ? (
                                                <>
                                                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                                                    Reassigning...
                                                </>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                                                    Bulk Reassign
                                                </>
                                            )}
                                        </button>
                                        <button
                                            onClick={() => setSelectedAppIds([])}
                                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-md transition-colors cursor-pointer"
                                        >
                                            Deselect All
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Comprehensive Applications Table */}
                            <div className="rounded-lg border border-slate-200 shadow-sm bg-white overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                            <tr>
                                                <th className="px-4 py-2.5 font-bold text-slate-600 text-[9px] uppercase tracking-wider">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded cursor-pointer accent-indigo-600 w-3.5 h-3.5"
                                                        checked={pagedApplications.length > 0 && pagedApplications.every((item: any) => selectedAppIds.includes(item.id))}
                                                        onChange={() => toggleSelectAll(pagedApplications)}
                                                        title="Select / Deselect All"
                                                    />
                                                </th>
                                                <th className="px-4 py-2.5 font-bold text-slate-600 text-[9px] uppercase tracking-wider">Application Ref</th>
                                                <th className="px-4 py-2.5 font-bold text-slate-600 text-[9px] uppercase tracking-wider">Applicant & Target</th>
                                                <th className="px-4 py-2.5 font-bold text-slate-600 text-[9px] uppercase tracking-wider">Assigned Staff</th>
                                                <th className="px-4 py-2.5 font-bold text-slate-600 text-[9px] uppercase tracking-wider">Lender & Loan</th>
                                                <th className="px-4 py-2.5 font-bold text-slate-600 text-[9px] uppercase tracking-wider">Progress & Stage</th>
                                                <th className="px-4 py-2.5 font-bold text-slate-600 text-[9px] uppercase tracking-wider">Priority</th>
                                                <th className="px-4 py-2.5 font-bold text-slate-600 text-[9px] uppercase tracking-wider">Applied</th>
                                                <th className="px-4 py-2.5 font-bold text-slate-600 text-[9px] uppercase tracking-wider text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {loading ? (
                                                <tr><td colSpan={9} className="px-6 py-12 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
                                                        <p className="text-[12px] font-bold text-slate-500">Loading applications database...</p>
                                                    </div>
                                                </td></tr>
                                            ) : pagedApplications.length > 0 ? pagedApplications.map((item: any, idx: number) => {
                                                const progress = getApplicationDisplayProgress(item);
                                                const stageLabel = getApplicationStageLabel(item, progress);
                                                const priorityLevel = item.priority || 'normal';
                                                
                                                // Resolve assigned staff member info
                                                const assignedStaffId = (item.assignedStaffId || '').trim();
                                                const assignedStaffEmail = (item.assignedStaffEmail || '').trim().toLowerCase();
                                                const targetName = (item.assignedStaffName || item.staffName || item.processingStaff || '').trim().toLowerCase();

                                                const matchedStaff = staffMembers.find((s: any) => {
                                                    if (!s) return false;
                                                    const sId = String(s.id || '').toLowerCase();
                                                    const sLink = String(s.linkedUserId || '').toLowerCase();
                                                    const sEmail = String(s.email || '').toLowerCase();
                                                    const sName = `${s.firstName || ''} ${s.lastName || ''}`.trim().toLowerCase();
                                                    const targetId = assignedStaffId.toLowerCase();

                                                    return (
                                                        (targetId && (sId === targetId || sLink === targetId || sEmail === targetId)) ||
                                                        (assignedStaffEmail && sEmail === assignedStaffEmail) ||
                                                        (targetName && (sName === targetName || sEmail === targetName))
                                                    );
                                                });
                                                const staffDisplayName = matchedStaff
                                                    ? `${matchedStaff.firstName || ''} ${matchedStaff.lastName || ''}`.trim() || matchedStaff.email
                                                    : (item.assignedStaffName || item.staffName || item.processingStaff || 'Unassigned');
                                                const isUnassigned = (!assignedStaffId || assignedStaffId === 'unassigned' || assignedStaffId === 'null') && !matchedStaff && !item.assignedStaffName && !item.staffName;

                                                return (
                                                <tr key={idx} className={`hover:bg-slate-50/70 transition-colors group ${selectedAppIds.includes(item.id) ? 'bg-indigo-50/60' : (isUnassigned ? 'bg-amber-50/20' : '')}`}>
                                                    <td className="px-4 py-3">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded cursor-pointer accent-indigo-600 w-3.5 h-3.5"
                                                            checked={selectedAppIds.includes(item.id)}
                                                            onChange={() => toggleSelectApp(item.id)}
                                                        />
                                                    </td>
                                                    
                                                    {/* App ID & Ref */}
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-0.5">
                                                            {(item.applicationNumber && (item.status === 'submitted_to_bank' || item.bankWorkflowStatus || item.status === 'under_bank_review' || item.status === 'approved' || item.status === 'disbursed')) ? (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <code className="text-[11px] font-bold text-indigo-700 font-mono bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{item.applicationNumber}</code>
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <code className="text-[11px] font-semibold text-slate-600 font-mono">{item.id?.substring(0, 8)}</code>
                                                                    <span className="text-[9px] text-amber-600 font-medium truncate" title="Application has not been submitted to bank yet. VL-APP ID generates on bank submission.">Pre-bank submission</span>
                                                                </>
                                                            )}
                                                            {item.referenceId && <span className="text-[9px] text-slate-400 font-medium truncate max-w-[90px]" title={item.referenceId}>Ref: {item.referenceId}</span>}
                                                        </div>
                                                    </td>
                                                    
                                                    {/* Applicant & Target Details */}
                                                    <td className="px-4 py-3 max-w-[180px]">
                                                        <button
                                                            onClick={() => handleViewUserProfile(item)}
                                                            className="flex flex-col cursor-pointer hover:bg-indigo-50/80 p-1.5 rounded -m-1.5 transition-all group w-full text-left"
                                                            title="Click to view applicant credentials & full profile"
                                                        >
                                                            <p className="font-bold text-slate-900 text-xs truncate group-hover:text-indigo-700 transition-colors flex items-center gap-1">
                                                                {item.firstName} {item.lastName}
                                                                <span className="material-symbols-outlined text-[11px] opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
                                                            </p>
                                                            <p className="text-[10px] text-slate-500 truncate" title={item.email}>{item.email}</p>
                                                            {(item.targetUniversity || item.universityName || item.studyDestination || item.country) && (
                                                                <span className="text-[9px] text-slate-500 font-medium truncate mt-0.5 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 w-fit">
                                                                    🎓 {item.targetUniversity || item.universityName || 'Uni'} ({item.studyDestination || item.country || 'Global'})
                                                                </span>
                                                            )}
                                                        </button>
                                                    </td>
                                                    
                                                    {/* Assigned Staff Member & Inline Reassignment */}
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-1 min-w-[140px]">
                                                            <div className="flex items-center gap-1.5">
                                                                <img
                                                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${matchedStaff?.email || staffDisplayName}`}
                                                                    alt=""
                                                                    className="w-5 h-5 rounded-full border border-slate-200 flex-shrink-0"
                                                                />
                                                                <span className={`text-[11px] font-bold truncate ${isUnassigned ? 'text-amber-700' : 'text-slate-800'}`}>
                                                                    {staffDisplayName}
                                                                </span>
                                                            </div>
                                                            {['sanctioned', 'conditional_sanction', 'partial_sanction', 'disbursed', 'partially_disbursed', 'approved'].includes((item.status || '').toLowerCase()) ? (
                                                                <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1 w-fit" title="Sanctioned application — staff assignment is permanently locked">
                                                                    🔒 Locked (Sanctioned)
                                                                </span>
                                                            ) : (
                                                                <select
                                                                    value={matchedStaff ? matchedStaff.id : (assignedStaffId || '')}
                                                                    disabled={reassigningAppId === item.id}
                                                                    onChange={(e) => handleReassignStaff(item.id, e.target.value)}
                                                                    className="px-2 py-0.5 text-[9px] font-semibold bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-600 cursor-pointer shadow-xs"
                                                                >
                                                                    <option value="" disabled>-- Reassign Staff --</option>
                                                                    {staffMembers.map((s: any) => {
                                                                        const isResigned = s.isResigned || s.status === 'resigned' || s.status === 'inactive' || s.status === 'invalid';
                                                                        const name = `${s.firstName || s.email} ${s.lastName || ''}`.trim();
                                                                        const label = isResigned && !name.includes('(Invalid)') ? `${name} (Invalid)` : name;
                                                                        return (
                                                                            <option key={s.id} value={s.id}>
                                                                                {label}
                                                                            </option>
                                                                        );
                                                                    })}
                                                                </select>
                                                            )}
                                                        </div>
                                                    </td>
                                                    
                                                    {/* Lender & Amount */}
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col text-[10px]">
                                                            <div className="flex items-center gap-1 mb-0.5">
                                                                {renderBankLogo(item.bank)}
                                                                <span className="font-bold text-slate-900 text-xs">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(item.amount || 0)}</span>
                                                            </div>
                                                            <span className="text-[9px] text-slate-500 font-medium capitalize">{item.loanType || 'unsecured'} loan</span>
                                                        </div>
                                                    </td>
                                                    
                                                    {/* Progress & Stage */}
                                                    <td className="px-4 py-3 min-w-[150px]">
                                                        <div className="space-y-1">
                                                            <div className="flex justify-between items-center text-[10px]">
                                                                <span className="font-bold text-slate-800">{stageLabel}</span>
                                                                <span className="font-bold text-indigo-600 tabular-nums">{progress}%</span>
                                                            </div>
                                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                                        progress >= 100 ? 'bg-emerald-500' :
                                                                        progress >= 75 ? 'bg-indigo-600' :
                                                                        progress >= 40 ? 'bg-blue-500' :
                                                                        'bg-amber-500'
                                                                    }`}
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Priority */}
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${
                                                            priorityLevel === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                            priorityLevel === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                            'bg-slate-50 text-slate-600 border-slate-200'
                                                        }`}>
                                                            {priorityLevel}
                                                        </span>
                                                    </td>
                                                    
                                                    {/* Applied Date */}
                                                    <td className="px-4 py-3 text-[10px] text-slate-500 whitespace-nowrap tabular-nums">
                                                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : '—'}
                                                    </td>
                                                    
                                                    {/* Actions */}
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex gap-1 justify-end">
                                                            <button
                                                                onClick={() => { setSelectedApp(item); }}
                                                                className="px-2 py-1 bg-slate-900 text-white rounded text-[10px] font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1"
                                                                title="View Profile"
                                                            >
                                                                <span className="material-symbols-outlined text-[13px]">visibility</span>
                                                                Profile
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                );
                                            }) : (
                                                <tr>
                                                    <td colSpan={9} className="px-6 py-16 text-center">
                                                        <span className="material-symbols-outlined text-4xl mb-3 opacity-20 block">folder_off</span>
                                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">No matching applications found</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Applications Pagination Bar */}
                                {!loading && sortedApplications.length > 0 && (
                                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                                        <div className="text-slate-600 font-medium text-[11px]">
                                            Showing <strong className="text-slate-900">{(currentAppPage - 1) * 20 + 1}</strong> to{' '}
                                            <strong className="text-slate-900">{Math.min(currentAppPage * 20, sortedApplications.length)}</strong> of{' '}
                                            <strong className="text-indigo-600">{sortedApplications.length}</strong> applications
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <button
                                                onClick={() => setAppPage(p => Math.max(1, p - 1))}
                                                disabled={currentAppPage <= 1}
                                                className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer shadow-2xs text-[11px]"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">chevron_left</span>
                                                Previous
                                            </button>

                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: totalAppPages }, (_, i) => i + 1)
                                                    .filter(p => p === 1 || p === totalAppPages || Math.abs(p - currentAppPage) <= 1)
                                                    .map((p, idx, arr) => {
                                                        const prevP = arr[idx - 1];
                                                        const showEllipsis = prevP && p - prevP > 1;
                                                        return (
                                                            <Fragment key={p}>
                                                                {showEllipsis && <span className="px-1 text-slate-400 text-xs">...</span>}
                                                                <button
                                                                    onClick={() => setAppPage(p)}
                                                                    className={`w-7 h-7 rounded-md font-bold text-xs transition-all cursor-pointer ${
                                                                        p === currentAppPage
                                                                            ? 'bg-indigo-600 text-white shadow-xs'
                                                                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                                                                    }`}
                                                                >
                                                                    {p}
                                                                </button>
                                                            </Fragment>
                                                        );
                                                    })}
                                            </div>

                                            <button
                                                onClick={() => setAppPage(p => Math.min(totalAppPages, p + 1))}
                                                disabled={currentAppPage >= totalAppPages}
                                                className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer shadow-2xs text-[11px]"
                                            >
                                                Next
                                                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ─── BLOGS DASHBOARD ──────────────────────────────────────── */}
                    {activeSection === "blogs" && (
                        <div className="space-y-6 animate-fade-in max-w-[1400px] mx-auto">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Editorial Domain</h2>
                                    <p className="text-slate-500 text-[11px] mt-1 font-medium flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">history_edu</span>
                                        Manage platform publications and editorial timeline
                                    </p>
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                    <div className="flex bg-white rounded border border-slate-200 overflow-hidden shadow-sm">
                                        <button onClick={() => setFilterBlogTime('all')} className={`px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider transition-colors ${filterBlogTime === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>All Time</button>
                                        <button onClick={() => setFilterBlogTime('week')} className={`px-3 py-1.5 border-l border-slate-200 text-[9px] font-semibold uppercase tracking-wider transition-colors ${filterBlogTime === 'week' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Weekly</button>
                                        <button onClick={() => setFilterBlogTime('month')} className={`px-3 py-1.5 border-l border-slate-200 text-[9px] font-semibold uppercase tracking-wider transition-colors ${filterBlogTime === 'month' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Monthly</button>
                                        <button onClick={() => setFilterBlogTime('year')} className={`px-3 py-1.5 border-l border-slate-200 text-[9px] font-semibold uppercase tracking-wider transition-colors ${filterBlogTime === 'year' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>Yearly</button>
                                    </div>
                                    <button onClick={() => window.location.href = '/admin/blogs/create'} className="px-3 py-1.5 bg-slate-900 text-white rounded font-semibold text-[10px] hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-sm">
                                        <span className="material-symbols-outlined text-[14px]">add</span>New Post
                                    </button>
                                    <button onClick={() => loadData()} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all bg-white border border-slate-200 rounded-lg shadow-sm">
                                        <span className="material-symbols-outlined text-[20px]">refresh</span>
                                    </button>
                                </div>
                            </div>

                            <div className="rounded border border-slate-200 shadow-sm bg-white overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-2 font-semibold text-slate-600 text-[9px] uppercase tracking-wider">Post Metadata</th>
                                                <th className="px-4 py-2 font-semibold text-slate-600 text-[9px] uppercase tracking-wider w-32">Status</th>
                                                <th className="px-4 py-2 font-semibold text-slate-600 text-[9px] uppercase tracking-wider w-40">Created</th>
                                                <th className="px-4 py-2 font-semibold text-slate-600 text-[9px] uppercase tracking-wider w-32 text-right">Engagement</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {loading ? (
                                                <tr><td colSpan={4} className="px-6 py-12 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <div className="w-10 h-10 border-4 border-[#6605c7]/10 border-t-[#6605c7] rounded-full animate-spin mb-3" />
                                                        <p className="text-[12px] font-bold text-slate-500">Loading publications...</p>
                                                    </div>
                                                </td></tr>
                                            ) : filteredData.length > 0 ? filteredData.map((item: any, idx: number) => (
                                                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                                    <td className="px-4 py-2.5">
                                                        <p className="text-xs font-semibold text-slate-900 leading-tight mb-0.5">{item.title}</p>
                                                        <p className="text-[10px] text-slate-500">Writer: {item.authorName}</p>
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border ${item.isPublished ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                                                            {item.isPublished ? 'Live' : 'Draft'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-[10px] text-slate-500">
                                                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-IN') : '—'}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right font-semibold text-slate-900 text-xs tabular-nums">
                                                        {item.views || 0} UITS
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={4} className="px-6 py-16 text-center">
                                                        <span className="material-symbols-outlined text-4xl mb-3 opacity-20 block">history_edu</span>
                                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">No matching posts found</p>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

            {/* ─── Application Detail Drawer ────────────────────────────────── */}
            {selectedApp && (
                <div className="fixed inset-0 z-[100] flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in" onClick={() => { setSelectedApp(null); setAiReview(null); setDrawerTab('details'); }} />
                    <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-slide-in-right border-l border-slate-200">
                        <div className="sticky top-0 z-20 bg-white border-b border-slate-100 px-8 py-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-900/20">
                                            <span className="material-symbols-outlined text-[20px]">description</span>
                                        </div>
                                        <div>
                                            <h2 className="text-[20px] font-bold text-slate-900 tracking-tight">Application Profile</h2>
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Ref: {selectedApp.applicationNumber || selectedApp.id?.substring(0, 12)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${selectedApp.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                            selectedApp.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                                'bg-blue-50 text-blue-700 border-blue-100'
                                        }`}>{selectedApp.status}</span>
                                    <button onClick={() => { setSelectedApp(null); setAiReview(null); setDrawerTab('details'); }} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all border border-transparent hover:border-slate-100">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-8 overflow-x-auto pb-2">
                                <button onClick={() => setDrawerTab('details')} className={`whitespace-nowrap pb-3 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all ${drawerTab === 'details' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>Applicant Info</button>
                                <button onClick={() => setDrawerTab('documents')} className={`whitespace-nowrap pb-3 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${drawerTab === 'documents' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                                    <span className="material-symbols-outlined text-[14px]">description</span>
                                    Documents
                                </button>
                                <button onClick={() => setDrawerTab('notes')} className={`whitespace-nowrap pb-3 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${drawerTab === 'notes' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                                    <span className="material-symbols-outlined text-[14px]">note</span>
                                    Admin Notes
                                </button>
                                <button onClick={() => setDrawerTab('history')} className={`whitespace-nowrap pb-3 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${drawerTab === 'history' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                                    <span className="material-symbols-outlined text-[14px]">timeline</span>
                                    Timeline
                                </button>
                                <button onClick={() => { if (!aiReview) handleAIReview(selectedApp.id); else setDrawerTab('ai_review'); }} className={`whitespace-nowrap pb-3 text-[11px] font-black uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 ${drawerTab === 'ai_review' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                                    <span className="material-symbols-outlined text-[14px]">psychology</span>
                                    AI Review
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                            {drawerTab === 'details' ? (
                                <>
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="material-symbols-outlined text-purple-600 text-[20px]">person</span>
                                            <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">Applicant Details</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-4 gap-x-6 bg-purple-50/30 p-6 rounded-lg border border-purple-100">
                                            <DetailRow label="Full Name" value={`${selectedApp.firstName || ''} ${selectedApp.lastName || ''}`.trim() || '—'} />
                                            <DetailRow label="Email Address" value={selectedApp.email || '—'} />
                                            <DetailRow label="Phone Number" value={selectedApp.phone || '—'} />
                                            <DetailRow label="Date of Birth" value={selectedApp.dateOfBirth ? format(new Date(selectedApp.dateOfBirth), 'dd MMM yyyy') : '—'} />
                                            <div className="col-span-2">
                                                <DetailRow label="Address" value={selectedApp.address || '—'} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="material-symbols-outlined text-purple-600 text-[20px]">account_balance</span>
                                            <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">Loan Details</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-y-4 gap-x-6 bg-purple-50/30 p-6 rounded-lg border border-purple-100">
                                            <DetailRow label="Bank Partner" value={selectedApp.bank || '—'} />
                                            <DetailRow label="Loan Type" value={selectedApp.loanType || '—'} />
                                            <DetailRow label="Loan Amount" value={selectedApp.amount ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(selectedApp.amount) : '—'} highlight />
                                            <DetailRow label="University" value={selectedApp.universityName || '—'} />
                                            <DetailRow label="Country" value={selectedApp.country || '—'} />
                                            <DetailRow label="Applied On" value={selectedApp.createdAt ? format(new Date(selectedApp.createdAt), 'dd MMM yyyy') : '—'} />
                                        </div>
                                    </div>

                                    {/* Application Metadata & Source */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="material-symbols-outlined text-blue-600 text-[20px]">info</span>
                                            <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">Application Source & Metadata</h3>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4 bg-blue-50/30 p-6 rounded-lg border border-blue-100">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Application ID</span>
                                                    <span className="text-[13px] font-bold text-blue-600 font-mono">{selectedApp.applicationNumber || selectedApp.id?.substring(0, 12) || '—'}</span>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference ID</span>
                                                    <span className="text-[13px] font-bold text-slate-900">{selectedApp.referenceId || '—'}</span>
                                                </div>
                                            </div>

                                            <div className="pt-4 border-t border-blue-100 grid grid-cols-1 gap-4">
                                                {/* Staff Information */}
                                                <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-blue-100">
                                                    <span className="material-symbols-outlined text-blue-600 text-[20px] flex-shrink-0">person</span>
                                                    <div className="flex-1">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Processing Staff</p>
                                                            {['sanctioned', 'conditional_sanction', 'partial_sanction', 'disbursed', 'partially_disbursed', 'approved'].includes((selectedApp.status || '').toLowerCase()) ? (
                                                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1" title="Sanctioned application — staff assignment is locked">
                                                                    🔒 Locked (Sanctioned)
                                                                </span>
                                                            ) : (
                                                                (() => {
                                                                    const drawerMatchedStaff = staffMembers.find((s: any) =>
                                                                        s.id === selectedApp.assignedStaffId ||
                                                                        s.linkedUserId === selectedApp.assignedStaffId ||
                                                                        s.email === selectedApp.assignedStaffId ||
                                                                        `${s.firstName || ''} ${s.lastName || ''}`.trim() === selectedApp.staffName
                                                                    );
                                                                    return (
                                                                        <select
                                                                            value={drawerMatchedStaff ? drawerMatchedStaff.id : (selectedApp.assignedStaffId || '')}
                                                                            disabled={reassigningAppId === selectedApp.id}
                                                                            onChange={(e) => handleReassignStaff(selectedApp.id, e.target.value)}
                                                                            className="px-2 py-0.5 text-[10px] font-semibold bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 cursor-pointer"
                                                                        >
                                                                            <option value="" disabled>-- Reassign Staff --</option>
                                                                            {staffMembers.map((s: any) => {
                                                                                const isResigned = s.isResigned || s.status === 'resigned' || s.status === 'inactive' || s.status === 'invalid';
                                                                                const name = `${s.firstName || s.email} ${s.lastName || ''}`.trim();
                                                                                const label = isResigned && !name.includes('(Invalid)') ? `${name} (Invalid)` : name;
                                                                                return (
                                                                                    <option key={s.id} value={s.id}>
                                                                                        {label}
                                                                                    </option>
                                                                                );
                                                                            })}
                                                                        </select>
                                                                    );
                                                                })()
                                                            )}
                                                        </div>
                                                        {(() => {
                                                            const drawerMatchedStaff = staffMembers.find((s: any) =>
                                                                s.id === selectedApp.assignedStaffId ||
                                                                s.linkedUserId === selectedApp.assignedStaffId ||
                                                                s.email === selectedApp.assignedStaffId ||
                                                                `${s.firstName || ''} ${s.lastName || ''}`.trim() === selectedApp.staffName
                                                            );
                                                            const name = drawerMatchedStaff ? `${drawerMatchedStaff.firstName || ''} ${drawerMatchedStaff.lastName || ''}`.trim() || drawerMatchedStaff.email : (selectedApp.staffName || selectedApp.processingStaff || 'Unassigned');
                                                            return <p className="text-[12px] font-bold text-slate-900">{name}</p>;
                                                        })()}
                                                        {selectedApp.staffId && <p className="text-[10px] text-slate-500 font-medium mt-1">Staff ID: {selectedApp.staffId}</p>}
                                                        {selectedApp.staffEmail && <p className="text-[10px] text-slate-500 font-medium">{selectedApp.staffEmail}</p>}
                                                    </div>
                                                </div>

                                                {/* Region Information */}
                                                <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-green-100">
                                                    <span className="material-symbols-outlined text-green-600 text-[20px] flex-shrink-0">location_on</span>
                                                    <div className="flex-1">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Region / Location</p>
                                                        <p className="text-[12px] font-bold text-slate-900">{selectedApp.region || selectedApp.state || 'N/A'}</p>
                                                        {selectedApp.city && <p className="text-[10px] text-slate-500 font-medium mt-1">City: {selectedApp.city}</p>}
                                                        {selectedApp.country && <p className="text-[10px] text-slate-500 font-medium">Country: {selectedApp.country}</p>}
                                                    </div>
                                                </div>

                                                {/* Counselor Information */}
                                                <div className="flex items-start gap-3 p-4 bg-white rounded-lg border border-amber-100">
                                                    <span className="material-symbols-outlined text-amber-600 text-[20px] flex-shrink-0">support_agent</span>
                                                    <div className="flex-1">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Assigned Counselor</p>
                                                        <p className="text-[12px] font-bold text-slate-900">{selectedApp.counselorName || selectedApp.counselor || 'Not Assigned'}</p>
                                                        {selectedApp.counselorEmail && <p className="text-[10px] text-slate-500 font-medium mt-1">{selectedApp.counselorEmail}</p>}
                                                        {selectedApp.counselorPhone && <p className="text-[10px] text-slate-500 font-medium">{selectedApp.counselorPhone}</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Multi-Bank Application Priority Management */}
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="material-symbols-outlined text-purple-600 text-[20px]">hub</span>
                                            <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">Multi-Bank Priority</h3>
                                        </div>
                                        <div className="bg-purple-50 p-6 rounded-lg border border-purple-100">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <p className="text-[12px] font-bold text-gray-900">Applicant has 3 active bank applications</p>
                                                    <p className="text-[10px] text-gray-600 font-medium mt-1">Set priority to streamline the approval process</p>
                                                </div>
                                                <span className="material-symbols-outlined text-amber-500 text-[28px]">warning</span>
                                            </div>
                                            <div className="space-y-3 mt-4">
                                                <p className="text-[11px] font-bold text-gray-700 uppercase tracking-wide mb-3">Set Priority Level</p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <button className="flex flex-col items-center justify-center p-3 bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 transition-all group cursor-pointer">
                                                        <span className="material-symbols-outlined text-red-600 text-[24px] group-hover:scale-110 transition-transform">arrow_upward</span>
                                                        <p className="text-[10px] font-bold text-red-700 mt-1 uppercase">High</p>
                                                    </button>
                                                    <button className="flex flex-col items-center justify-center p-3 bg-amber-50 border-2 border-amber-200 rounded-lg hover:bg-amber-100 transition-all group cursor-pointer">
                                                        <span className="material-symbols-outlined text-amber-600 text-[24px] group-hover:scale-110 transition-transform">remove</span>
                                                        <p className="text-[10px] font-bold text-amber-700 mt-1 uppercase">Medium</p>
                                                    </button>
                                                    <button className="flex flex-col items-center justify-center p-3 bg-gray-50 border-2 border-gray-200 rounded-lg hover:bg-gray-100 transition-all group cursor-pointer">
                                                        <span className="material-symbols-outlined text-gray-600 text-[24px] group-hover:scale-110 transition-transform">arrow_downward</span>
                                                        <p className="text-[10px] font-bold text-gray-700 mt-1 uppercase">Normal</p>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-4 border-t border-purple-200">
                                                <p className="text-[10px] text-gray-600 font-medium"><span className="font-bold">High Priority:</span> Process first, allocate dedicated reviewer</p>
                                                <p className="text-[10px] text-gray-600 font-medium mt-1"><span className="font-bold">Medium:</span> Process in standard queue, standard review</p>
                                                <p className="text-[10px] text-gray-600 font-medium mt-1"><span className="font-bold">Normal:</span> Queue as received, batch review</p>
                                            </div>
                                        </div>

                                        {/* Related Applications */}
                                        <div className="bg-white p-6 rounded-lg border border-gray-200">
                                            <p className="text-[12px] font-bold text-gray-900 mb-4 uppercase tracking-wide">Related Bank Applications</p>
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div>
                                                        <p className="text-[11px] font-bold text-gray-900">HDFC Bank</p>
                                                        <p className="text-[10px] text-gray-600 font-medium">₹7,50,000 • Pending</p>
                                                    </div>
                                                    <span className="inline-flex items-center px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-[9px] font-bold">App ID: HD234</span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border-2 border-purple-300">
                                                    <div>
                                                        <p className="text-[11px] font-bold text-gray-900">ICICI Bank (Current)</p>
                                                        <p className="text-[10px] text-gray-600 font-medium">₹7,50,000 • Processing</p>
                                                    </div>
                                                    <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-[9px] font-bold">✓ Selected</span>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div>
                                                        <p className="text-[11px] font-bold text-gray-900">SBI</p>
                                                        <p className="text-[10px] text-gray-600 font-medium">₹7,50,000 • Pending</p>
                                                    </div>
                                                    <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-[9px] font-bold">App ID: SB567</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : drawerTab === 'documents' ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="material-symbols-outlined text-purple-600 text-[20px]">description</span>
                                        <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">Attached Documents</h3>
                                    </div>
                                    <div className="space-y-3">
                                        {[
                                            { name: '10th Marksheet', status: 'verified', date: '2024-01-15' },
                                            { name: '12th Marksheet', status: 'verified', date: '2024-01-15' },
                                            { name: 'Passport/ID', status: 'verified', date: '2024-01-15' },
                                            { name: 'Bank Statements', status: 'pending', date: '2024-01-16' },
                                            { name: 'Income Certificate', status: 'rejected', date: '2024-01-16' },
                                        ].map((doc, i) => (
                                            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-all">
                                                <div className="flex items-center gap-3">
                                                    <span className="material-symbols-outlined text-gray-400 text-[20px]">article</span>
                                                    <div>
                                                        <p className="text-[12px] font-bold text-gray-900">{doc.name}</p>
                                                        <p className="text-[10px] text-gray-500 font-medium">{doc.date}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`inline-flex items-center px-2 py-1 text-[9px] font-bold uppercase rounded-full ${
                                                        doc.status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                                                        doc.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-red-100 text-red-700'
                                                    }`}>
                                                        {doc.status === 'verified' && '✓ Verified'}
                                                        {doc.status === 'pending' && '⏳ Pending'}
                                                        {doc.status === 'rejected' && '✗ Rejected'}
                                                    </span>
                                                    <button className="p-2 text-gray-400 hover:text-purple-600 transition-all">
                                                        <span className="material-symbols-outlined">download</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : drawerTab === 'notes' ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="material-symbols-outlined text-purple-600 text-[20px]">note</span>
                                        <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">Admin Notes</h3>
                                    </div>
                                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-100 mb-4">
                                        <textarea placeholder="Add internal notes here..." rows={4} className="w-full px-4 py-3 bg-white border border-purple-100 rounded-lg text-[12px] font-medium focus:outline-none focus:ring-2 focus:ring-purple-600/10 focus:border-purple-600/30 transition-all resize-none" />
                                        <button className="mt-3 px-4 py-2 bg-purple-600 text-white text-[11px] font-bold rounded hover:bg-purple-700 transition-all">Save Note</button>
                                    </div>
                                    <div className="space-y-3">
                                        <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">Recent Notes</p>
                                        {[
                                            { author: 'Admin John', note: 'Applicant called to confirm address', date: '2 hours ago' },
                                            { author: 'Admin Sarah', note: 'Requested additional bank statements', date: '1 day ago' },
                                        ].map((item, i) => (
                                            <div key={i} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                                                <div className="flex items-start justify-between mb-2">
                                                    <p className="text-[12px] font-bold text-gray-900">{item.author}</p>
                                                    <p className="text-[10px] text-gray-500 font-medium">{item.date}</p>
                                                </div>
                                                <p className="text-[12px] text-gray-700">{item.note}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : drawerTab === 'history' ? (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="material-symbols-outlined text-purple-600 text-[20px]">timeline</span>
                                        <h3 className="text-[13px] font-bold text-gray-900 uppercase tracking-wide">Application Timeline</h3>
                                    </div>
                                    <div className="relative">
                                        {[
                                            { status: 'Application Submitted', date: '2024-01-10', time: '10:30 AM', icon: 'check' },
                                            { status: 'Documents Received', date: '2024-01-11', time: '02:15 PM', icon: 'description' },
                                            { status: 'AI Review Completed', date: '2024-01-12', time: '09:00 AM', icon: 'psychology' },
                                            { status: 'Pending Admin Review', date: '2024-01-13', time: 'In Progress', icon: 'hourglass_bottom' },
                                        ].map((item, i) => (
                                            <div key={i} className="flex gap-4 mb-6 last:mb-0 relative">
                                                <div className="relative z-10 flex flex-col items-center">
                                                    <div className="w-10 h-10 rounded-full bg-purple-100 border-2 border-purple-600 flex items-center justify-center text-purple-600">
                                                        <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                                                    </div>
                                                    {i < 3 && <div className="w-1 h-12 bg-purple-200 my-2" />}
                                                </div>
                                                <div className="pt-2">
                                                    <p className="text-[12px] font-bold text-gray-900">{item.status}</p>
                                                    <p className="text-[11px] text-gray-500 font-medium">{item.date} at {item.time}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {aiReviewLoading ? (
                                        <div className="flex flex-col items-center justify-center py-24 bg-purple-50 rounded-lg border border-dashed border-purple-200">
                                            <div className="w-12 h-12 border-4 border-purple-100 border-t-purple-600 rounded-full animate-spin mb-6" />
                                            <p className="text-[11px] font-black uppercase tracking-widest text-purple-400 animate-pulse">Running AI Analysis...</p>
                                        </div>
                                    ) : aiReview ? (
                                        <>
                                            <div className="p-6 rounded-lg bg-gradient-to-r from-purple-900 to-purple-800 text-white shadow-lg relative overflow-hidden">
                                                <div className="relative z-10">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-300 mb-1">AI Recommendation</p>
                                                            <h3 className="text-[16px] font-bold text-white">{aiReview.recommendation?.replace(/_/g, ' ').toUpperCase()}</h3>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[28px] font-bold leading-none tabular-nums">{aiReview.overallScore}%</p>
                                                            <p className="text-[9px] font-bold uppercase tracking-widest text-purple-300">Score</p>
                                                        </div>
                                                    </div>
                                                    <p className="text-[12px] text-purple-100 font-medium">"{aiReview.aiSummary}"</p>
                                                </div>
                                                <span className="material-symbols-outlined absolute -right-4 top-1/2 -translate-y-1/2 text-[100px] text-white/5 pointer-events-none">psychology</span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                                                    <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2">Risk Level</p>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2.5 h-2.5 rounded-full ${aiReview.creditAssessment?.riskLevel === 'low' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                        <span className="text-[12px] font-bold text-gray-900 uppercase">{aiReview.creditAssessment?.riskLevel}</span>
                                                    </div>
                                                </div>
                                                <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                                                    <p className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mb-2">Completeness</p>
                                                    <p className="text-[12px] font-bold text-gray-900">{aiReview.completenessCheck?.percentage || 85}% Verified</p>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="text-center py-16">
                                            <button onClick={() => handleAIReview(selectedApp.id)} className="px-6 py-3 bg-purple-600 text-white text-[11px] font-bold rounded-lg hover:bg-purple-700 transition-all inline-flex items-center gap-2 shadow-md">
                                                <span className="material-symbols-outlined text-[16px]">psychology</span>
                                                Run AI Review
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="sticky bottom-0 bg-gray-50 p-6 pt-4 border-t border-gray-200">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-slate-600 text-[18px]">info</span>
                                <h3 className="text-[12px] font-bold text-gray-900 uppercase tracking-wide">Application Information</h3>
                            </div>
                            <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-[11px] font-medium text-blue-900">
                                    To take action on this application (Approve, Reject, Send Back, Add Remarks, or Assign Mentor), use the 
                                    <span className="font-bold text-blue-700"> Application Management Panel</span> from the admin dashboard.
                                </p>
                            </div>
                            <p className="text-[9px] text-gray-500 text-center font-bold uppercase tracking-tighter mt-4">
                                This is a read-only preview
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .animate-slide-in-right {
                    animation: slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in {
                    animation: fadeIn 0.4s ease-out forwards;
                }
            `}</style>

            {/* ─── Create User / Staff Modal ─────────────────────────────── */}
            {/* ─── Create User / Staff Modal ─────────────────────────────── */}
            {showCreateUserModal && (
                (newUserQuery.role === 'staff' || newUserQuery.role === 'staff_admin') ? (
                    <div 
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="create-staff-modal-title"
                        className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
                    >
                        <div 
                            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" 
                            onClick={() => setShowCreateUserModal(false)} 
                        />
                        <div className="relative w-full max-w-[540px] bg-white rounded-xl shadow-2xl overflow-hidden border border-[#E2E8F0] flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                            {/* 1. Header (Left-Aligned with 1px Divider) */}
                            <div className="px-6 py-5 border-b border-[#E2E8F0] shrink-0 flex items-start justify-between gap-4 bg-white">
                                <div className="min-w-0">
                                    <h3 id="create-staff-modal-title" className="text-lg font-bold text-slate-900 tracking-tight">
                                        Create Staff Profile
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                        Register and onboard a new loan processing officer, verification staff, or team lead.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateUserModal(false)}
                                    aria-label="Close dialog"
                                    className="w-8 h-8 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                                >
                                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
                                </button>
                            </div>

                            {/* 2 & 3. Form Area (Unified Pure White Background, 4-6px inputs, no icons, tight asterisks) */}
                            <div className="overflow-y-auto p-6 bg-white flex-1">
                                <form id="staff-creation-form" onSubmit={handleCreateUser} className="space-y-6">
                                    {/* Section 1: Basic Information */}
                                    <div>
                                        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
                                            Basic Information
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="create-staff-first-name" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                                    First Name<span className="text-rose-500">*</span>
                                                </label>
                                                <input 
                                                    id="create-staff-first-name"
                                                    required 
                                                    type="text" 
                                                    value={newUserQuery.firstName} 
                                                    onChange={e => setNewUserQuery({ ...newUserQuery, firstName: e.target.value })} 
                                                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-[6px] text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400" 
                                                    placeholder="E.g. Hari" 
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="create-staff-last-name" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                                    Last Name<span className="text-rose-500">*</span>
                                                </label>
                                                <input 
                                                    id="create-staff-last-name"
                                                    required 
                                                    type="text" 
                                                    value={newUserQuery.lastName} 
                                                    onChange={e => setNewUserQuery({ ...newUserQuery, lastName: e.target.value })} 
                                                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-[6px] text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400" 
                                                    placeholder="E.g. Kalyan" 
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <div>
                                                <label htmlFor="create-staff-email" className="text-[13px] font-medium text-slate-700 mb-1 block">
                                                    Login Email Address<span className="text-rose-500">*</span>
                                                </label>
                                                <input 
                                                    id="create-staff-email"
                                                    required 
                                                    type="email" 
                                                    value={newUserQuery.email} 
                                                    onChange={e => setNewUserQuery({ ...newUserQuery, email: e.target.value })} 
                                                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-[6px] text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400" 
                                                    placeholder="staff.personal@gmail.com" 
                                                />
                                                <p className="text-[11px] text-slate-400 mt-1">Normal email used to log into the staff portal.</p>
                                            </div>
                                            <div>
                                                <label htmlFor="create-staff-mobile" className="text-[13px] font-medium text-slate-700 mb-1 block">
                                                    Mobile Number<span className="text-rose-500">*</span>
                                                </label>
                                                <input 
                                                    id="create-staff-mobile"
                                                    required 
                                                    type="tel" 
                                                    value={newUserQuery.mobile} 
                                                    onChange={e => setNewUserQuery({ ...newUserQuery, mobile: e.target.value })} 
                                                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-[6px] text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400" 
                                                    placeholder="+91 98765 43210" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Standard 1px Section Divider */}
                                    <div className="border-t border-[#E2E8F0]" />

                                    {/* Section 2: AWS SES Mailbox & Folder Isolation */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                                AWS SES Mailbox & S3 Folder Isolation
                                            </div>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                Inbox Routing
                                            </span>
                                        </div>
                                        <p className="text-[12px] text-slate-500 mb-3.5">
                                            Assign an isolated business address and S3 inbox folder. When this staff sends mail, it goes from this address, and their inbox will strictly load from this folder.
                                        </p>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label htmlFor="create-staff-mailbox-email" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                                    Official Business Email (SES)
                                                </label>
                                                <input 
                                                    id="create-staff-mailbox-email"
                                                    type="email" 
                                                    value={newUserQuery.mailboxEmail} 
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        const slug = val.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
                                                        setNewUserQuery(prev => ({ 
                                                            ...prev, 
                                                            mailboxEmail: val,
                                                            // Only auto-suggest prefix if prefix was previously empty or matches auto-generated slug
                                                            mailboxPrefix: (!prev.mailboxPrefix || prev.mailboxPrefix.startsWith('staff/')) && slug ? `${slug}/` : prev.mailboxPrefix
                                                        }));
                                                    }} 
                                                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-[6px] text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400" 
                                                    placeholder="priya@vidyaloans.in" 
                                                />
                                                {newUserQuery.firstName && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const cleanFirst = newUserQuery.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
                                                            const cleanLast = (newUserQuery.lastName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                                                            const alias = cleanLast ? `${cleanFirst}.${cleanLast}@vidyaloans.in` : `${cleanFirst}@vidyaloans.in`;
                                                            const prefix = `${cleanFirst}/`;
                                                            setNewUserQuery(prev => ({
                                                                ...prev,
                                                                mailboxEmail: alias,
                                                                mailboxPrefix: prev.mailboxPrefix || prefix
                                                            }));
                                                        }}
                                                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 mt-1 cursor-pointer block"
                                                    >
                                                        + Auto-suggest: {newUserQuery.firstName.toLowerCase()}@vidyaloans.in
                                                    </button>
                                                )}
                                            </div>

                                            <div>
                                                <label htmlFor="create-staff-mailbox-prefix" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                                    Assigned S3 Folder Prefix
                                                </label>
                                                <input 
                                                    id="create-staff-mailbox-prefix"
                                                    type="text" 
                                                    value={newUserQuery.mailboxPrefix} 
                                                    onChange={e => setNewUserQuery({ ...newUserQuery, mailboxPrefix: e.target.value })} 
                                                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-[6px] text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400" 
                                                    placeholder="abhi/ or support/" 
                                                />
                                                <p className="text-[11px] text-slate-400 mt-1">S3 path matching AWS SES Receipt Rule prefix (e.g. <code>abhi/</code>).</p>
                                            </div>
                                        </div>

                                        <div className="mt-3.5 bg-slate-50 border border-[#E2E8F0] rounded-[6px] p-3 flex items-start gap-3">
                                            <input
                                                id="create-staff-access-support"
                                                type="checkbox"
                                                checked={newUserQuery.canAccessSupport}
                                                onChange={e => setNewUserQuery({ ...newUserQuery, canAccessSupport: e.target.checked })}
                                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer"
                                            />
                                            <label htmlFor="create-staff-access-support" className="text-xs text-slate-700 cursor-pointer">
                                                <span className="font-semibold block text-slate-800">Allow access to General Support Inbox (support/)</span>
                                                <span className="text-slate-500 block text-[11px] mt-0.5">
                                                    When unchecked (recommended), this staff member can only view and manage emails in their assigned folder.
                                                </span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Standard 1px Section Divider */}
                                    <div className="border-t border-[#E2E8F0]" />

                                    {/* Section 2: Office & Work Location */}
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <label htmlFor="create-staff-office" className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                                                Office & Work Location<span className="text-rose-500">*</span>
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    loadOffices();
                                                    setShowAddOfficeModal(true);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-white border border-[#CBD5E1] rounded-[6px] hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900 transition-colors cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">add</span>
                                                Add Office
                                            </button>
                                        </div>

                                        <select
                                            id="create-staff-office"
                                            required
                                            value={newUserQuery.officeId || ""}
                                            onChange={e => {
                                                const selected = offices.find(o => o.id === e.target.value);
                                                setNewUserQuery({
                                                    ...newUserQuery,
                                                    officeId: e.target.value,
                                                    officeLocation: selected ? `${selected.name} - ${selected.city} (${selected.location})` : ""
                                                });
                                            }}
                                            className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-[6px] text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 cursor-pointer"
                                        >
                                            <option value="">-- Select Office Location ({offices.length} Registered) --</option>
                                            {offices.map((off: any) => (
                                                <option key={off.id} value={off.id}>
                                                    {off.name} · {off.city} ({off.location})
                                                </option>
                                            ))}
                                        </select>

                                        {/* 4. Inline Alert Box for Helper Text */}
                                        <div className="bg-slate-50 border border-[#E2E8F0] rounded-[4px] p-3 flex items-start gap-2.5 mt-3">
                                            <span className="material-symbols-outlined text-slate-400 text-[18px] shrink-0 mt-0.5">info</span>
                                            <p className="text-[12px] text-slate-600 leading-relaxed">
                                                Assigns the staff member to an operational branch and sets their queue allocation. Staff can log in directly at <code className="bg-slate-200/70 px-1 py-0.5 rounded text-slate-800 font-mono text-[11px]">/staff/login</code>.
                                            </p>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            {/* 5. Sticky Action Footer (Right-Aligned Buttons) */}
                            <div className="sticky bottom-0 bg-white border-t border-[#E2E8F0] px-6 py-4 flex items-center justify-end gap-3 z-10 shrink-0">
                                <button 
                                    type="button" 
                                    onClick={() => setShowCreateUserModal(false)} 
                                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-[6px] transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    form="staff-creation-form" 
                                    type="submit" 
                                    disabled={createUserLoading} 
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-sm font-medium rounded-[6px] shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {createUserLoading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        <span>Create Staff Profile</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                <div 
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="create-user-modal-title"
                    className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
                >
                    <div 
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity" 
                        onClick={() => setShowCreateUserModal(false)} 
                    />
                    <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200/80 flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="p-6 sm:p-8 pb-5 border-b border-slate-100 shrink-0 flex items-start justify-between gap-4 bg-slate-50/50">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0 shadow-xs">
                                    <span className="material-symbols-outlined text-2xl">
                                        {newUserQuery.role === 'staff' || newUserQuery.role === 'staff_admin' ? 'badge' :
                                         newUserQuery.role === 'agent' ? 'support_agent' :
                                         newUserQuery.role === 'bank' ? 'account_balance' : 'school'}
                                    </span>
                                </div>
                                <div>
                                    <h3 id="create-user-modal-title" className="text-xl sm:text-2xl font-bold font-display text-slate-900 tracking-tight flex items-center gap-2">
                                        {newUserQuery.role === 'staff' || newUserQuery.role === 'staff_admin' ? 'Create Staff Profile' :
                                         newUserQuery.role === 'agent' ? 'Create Agent Partner Profile' :
                                         newUserQuery.role === 'bank' ? 'Create Bank Representative Profile' : 'Create Student Profile'}
                                    </h3>
                                    <p className="text-xs sm:text-sm font-normal text-slate-500 mt-0.5">
                                        {newUserQuery.role === 'staff' || newUserQuery.role === 'staff_admin' ? 'Register and onboard a new loan processing officer, verification staff, or team lead.' :
                                         newUserQuery.role === 'agent' ? 'Register a new education consultant or referral channel partner.' :
                                         newUserQuery.role === 'bank' ? 'Register a new lending partner officer or bank representative.' :
                                         'Comprehensive registration and account setup for study abroad student applicants.'}
                                    </p>
                                </div>
                            </div>

                            {/* Accessible Large Close Button (48x48px target) outside form inputs */}
                            <button
                                type="button"
                                onClick={() => setShowCreateUserModal(false)}
                                aria-label="Close dialog"
                                className="w-12 h-12 -mr-2 -mt-2 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shrink-0"
                            >
                                <span className="material-symbols-outlined text-2xl" aria-hidden="true">close</span>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto no-scrollbar p-6 sm:p-8 space-y-6">
                            <form id="student-creation-form" onSubmit={handleCreateUser} className="space-y-6">
                                <section>
                                    <div className="inline-flex items-center gap-2 mb-5 text-indigo-600 font-bold text-xs uppercase tracking-widest leading-none">
                                        <span className="material-symbols-outlined text-base">face</span>
                                        <span>Basic Information</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                        <div>
                                            <label htmlFor="create-user-first-name" className="text-xs font-bold text-slate-700 mb-1.5 block">
                                                First Name <span className="text-rose-500">*</span>
                                            </label>
                                            <input 
                                                id="create-user-first-name"
                                                required 
                                                type="text" 
                                                value={newUserQuery.firstName} 
                                                onChange={e => setNewUserQuery({ ...newUserQuery, firstName: e.target.value })} 
                                                className="w-full min-h-[48px] px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400" 
                                                placeholder="E.g. Hari" 
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="create-user-last-name" className="text-xs font-bold text-slate-700 mb-1.5 block">
                                                Last Name <span className="text-rose-500">*</span>
                                            </label>
                                            <input 
                                                id="create-user-last-name"
                                                required 
                                                type="text" 
                                                value={newUserQuery.lastName} 
                                                onChange={e => setNewUserQuery({ ...newUserQuery, lastName: e.target.value })} 
                                                className="w-full min-h-[48px] px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400" 
                                                placeholder="E.g. Kalyan" 
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-4">
                                        <div>
                                            <label htmlFor="create-user-email" className="text-xs font-bold text-slate-700 mb-1.5 block">
                                                Email Address <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative flex items-center">
                                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none text-slate-400">
                                                    <span className="material-symbols-outlined text-[18px]">mail</span>
                                                    <span className="w-px h-4 bg-slate-300"></span>
                                                </div>
                                                <input 
                                                    id="create-user-email"
                                                    required 
                                                    type="email" 
                                                    value={newUserQuery.email} 
                                                    onChange={e => setNewUserQuery({ ...newUserQuery, email: e.target.value })} 
                                                    className="w-full min-h-[48px] pl-12 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400" 
                                                    placeholder={newUserQuery.role === 'staff' ? 'staff.name@vidyaloans.com' : newUserQuery.role === 'bank' ? 'officer@bank.com' : 'example@gmail.com'} 
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="create-user-mobile" className="text-xs font-bold text-slate-700 mb-1.5 block">
                                                Mobile Number <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="relative flex items-center">
                                                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none text-slate-400">
                                                    <span className="material-symbols-outlined text-[18px]">call</span>
                                                    <span className="w-px h-4 bg-slate-300"></span>
                                                </div>
                                                <input 
                                                    id="create-user-mobile"
                                                    required 
                                                    type="tel" 
                                                    value={newUserQuery.mobile} 
                                                    onChange={e => setNewUserQuery({ ...newUserQuery, mobile: e.target.value })} 
                                                    className="w-full min-h-[48px] pl-12 pr-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400" 
                                                    placeholder="+91 98765 43210" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Office Location for Staff */}
                                    {newUserQuery.role === 'staff' && (
                                        <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-indigo-50/70 border border-indigo-100/90 space-y-3">
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <label htmlFor="create-staff-office" className="text-xs font-bold text-indigo-950 block">
                                                        Office & Work Location <span className="text-rose-500">*</span>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            loadOffices();
                                                            setShowAddOfficeModal(true);
                                                        }}
                                                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 shadow-2xs hover:bg-indigo-50 transition-all cursor-pointer"
                                                    >
                                                        <span className="material-symbols-outlined text-[15px]">add_circle</span>
                                                        Add Office
                                                    </button>
                                                </div>
                                                <select
                                                    id="create-staff-office"
                                                    value={newUserQuery.officeId || ""}
                                                    onChange={e => {
                                                        const selected = offices.find(o => o.id === e.target.value);
                                                        setNewUserQuery({
                                                            ...newUserQuery,
                                                            officeId: e.target.value,
                                                            officeLocation: selected ? `${selected.name} - ${selected.city} (${selected.location})` : ""
                                                        });
                                                    }}
                                                    className="w-full min-h-[48px] px-4 py-3 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer shadow-xs"
                                                >
                                                    <option value="">-- Select Office Location ({offices.length} Registered) --</option>
                                                    {offices.map((off: any) => (
                                                        <option key={off.id} value={off.id}>
                                                            {off.name} · {off.city} ({off.location})
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="flex items-start gap-2 pt-1">
                                                <span className="material-symbols-outlined text-indigo-600 text-base mt-0.5 shrink-0">info</span>
                                                <p className="text-xs text-indigo-900/80 font-medium leading-relaxed">
                                                    Assigns the staff member to an operational branch and sets their queue allocation. Staff can log in directly at <code className="bg-indigo-100 px-1 py-0.5 rounded text-indigo-800 font-mono">/staff/login</code>.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Agent Partner Specific Details */}
                                    {newUserQuery.role === 'agent' && (
                                        <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-amber-50/90 border border-amber-200/80 space-y-5 shadow-xs">
                                            <div className="flex items-center justify-between border-b border-amber-200/60 pb-3">
                                                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase tracking-wider">
                                                    <span className="material-symbols-outlined text-amber-600 text-lg">handshake</span>
                                                    Channel Partnership & Compliance Setup
                                                </div>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                                    Draft Enabled
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                                <div>
                                                    <label htmlFor="create-agent-partnership" className="text-xs font-bold text-slate-800 mb-1.5 block">
                                                        Partnership Type / Channel <span className="text-rose-500">*</span>
                                                    </label>
                                                    <select
                                                        id="create-agent-partnership"
                                                        value={newUserQuery.partnership || "Individual Consultant"}
                                                        onChange={e => setNewUserQuery({ ...newUserQuery, partnership: e.target.value })}
                                                        className="w-full min-h-[48px] px-4 py-3 bg-white border border-amber-300/80 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 cursor-pointer shadow-xs"
                                                    >
                                                        <option value="Individual Consultant">Individual Education Consultant</option>
                                                        <option value="Study Abroad Consultancy">Study Abroad Consultancy / Firm</option>
                                                        <option value="University Referral Partner">University Referral Partner</option>
                                                        <option value="Corporate Channel Partner">Corporate Channel Partner</option>
                                                        <option value="Financial Advisor">Financial Advisor / DSA</option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label htmlFor="create-agent-percentage" className="text-xs font-bold text-slate-800 mb-1.5 block">
                                                        Commission Rate (%) <span className="text-rose-500">*</span>
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            id="create-agent-percentage"
                                                            type="number"
                                                            step="0.1"
                                                            min="0"
                                                            max="25"
                                                            value={newUserQuery.percentage || "1.5"}
                                                            onChange={e => setNewUserQuery({ ...newUserQuery, percentage: e.target.value })}
                                                            className="w-full min-h-[48px] pl-4 pr-11 py-3 bg-white border border-amber-300/80 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 shadow-xs"
                                                            placeholder="1.5"
                                                        />
                                                        <span className="material-symbols-outlined absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">percent</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 mt-1">Agreed payout % on disbursed student loan value.</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                                <div>
                                                    <label htmlFor="create-agent-pan" className="text-xs font-bold text-slate-800 mb-1.5 block">
                                                        Agent / Company PAN Number <span className="text-rose-500">*</span>
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            id="create-agent-pan"
                                                            type="text"
                                                            maxLength={10}
                                                            value={newUserQuery.panNumber || ""}
                                                            onChange={e => setNewUserQuery({ ...newUserQuery, panNumber: e.target.value.toUpperCase() })}
                                                            className="w-full min-h-[48px] pl-11 pr-4 py-3 bg-white border border-amber-300/80 rounded-xl text-sm font-semibold tracking-wider text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-amber-500/30 shadow-xs"
                                                            placeholder="ABCDE1234F"
                                                        />
                                                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-600 text-lg pointer-events-none">badge</span>
                                                    </div>
                                                </div>

                                                <div>
                                                    <label htmlFor="create-agent-business" className="text-xs font-bold text-slate-800 mb-1.5 block">
                                                        Business / Consultancy Name
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            id="create-agent-business"
                                                            type="text"
                                                            value={newUserQuery.businessName || ""}
                                                            onChange={e => setNewUserQuery({ ...newUserQuery, businessName: e.target.value })}
                                                            className="w-full min-h-[48px] pl-11 pr-4 py-3 bg-white border border-amber-300/80 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 shadow-xs"
                                                            placeholder="E.g. Global EdTech Advisors"
                                                        />
                                                        <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">business</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                                <div>
                                                    <label htmlFor="create-agent-gstin" className="text-xs font-bold text-slate-800 mb-1.5 block">
                                                        GSTIN / Registration No. (Optional)
                                                    </label>
                                                    <input
                                                        id="create-agent-gstin"
                                                        type="text"
                                                        value={newUserQuery.gstin || ""}
                                                        onChange={e => setNewUserQuery({ ...newUserQuery, gstin: e.target.value.toUpperCase() })}
                                                        className="w-full min-h-[48px] px-4 py-3 bg-white border border-amber-300/80 rounded-xl text-sm font-medium uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 shadow-xs"
                                                        placeholder="22AAAAA0000A1Z5"
                                                    />
                                                </div>

                                                <div>
                                                    <label htmlFor="create-agent-photo" className="text-xs font-bold text-slate-800 mb-1.5 block">
                                                        Profile Photo URL or File
                                                    </label>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-xl border border-amber-200 bg-white overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                                                            {newUserQuery.profilePhoto ? (
                                                                <img src={newUserQuery.profilePhoto} alt="Preview" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="material-symbols-outlined text-amber-500 text-2xl">account_circle</span>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 flex gap-2">
                                                            <input
                                                                id="create-agent-photo"
                                                                type="text"
                                                                value={newUserQuery.profilePhoto || ""}
                                                                onChange={e => setNewUserQuery({ ...newUserQuery, profilePhoto: e.target.value })}
                                                                className="flex-1 min-h-[48px] px-3 py-2 bg-white border border-amber-300/80 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 shadow-xs"
                                                                placeholder="https://... or upload"
                                                            />
                                                            <label className="min-h-[48px] px-3.5 bg-white hover:bg-amber-50 text-amber-800 border border-amber-300/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-all shrink-0">
                                                                <span className="material-symbols-outlined text-sm">upload</span>
                                                                <span>Upload</span>
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="hidden"
                                                                    onChange={e => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            const reader = new FileReader();
                                                                            reader.onload = () => {
                                                                                setNewUserQuery(prev => ({ ...prev, profilePhoto: reader.result as string }));
                                                                            };
                                                                            reader.readAsDataURL(file);
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Document Checklist & Uploads */}
                                            <div className="pt-2">
                                                <label className="text-xs font-bold text-slate-800 mb-2 block flex items-center justify-between">
                                                    <span>Agent KYC & Agreement Documents</span>
                                                    <span className="text-[10px] font-normal text-slate-500">Attach now or Save as Draft to complete later</span>
                                                </label>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                    {[
                                                        { key: 'pan_card', label: 'PAN Card Copy' },
                                                        { key: 'business_registration', label: 'Registration / GST' },
                                                        { key: 'signed_agreement', label: 'Partner Agreement' }
                                                    ].map(doc => {
                                                        const isUploaded = (newUserQuery.documents || []).some(d => d.type === doc.key);
                                                        return (
                                                            <label 
                                                                key={doc.key}
                                                                className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                                                                    isUploaded 
                                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                                                                        : 'bg-white border-dashed border-amber-300 hover:border-amber-400 text-slate-600'
                                                                }`}
                                                            >
                                                                <span className="material-symbols-outlined text-xl">
                                                                    {isUploaded ? 'task_alt' : 'note_add'}
                                                                </span>
                                                                <span className="text-xs font-bold text-center leading-tight">{doc.label}</span>
                                                                <span className="text-[10px] text-slate-400">
                                                                    {isUploaded ? 'Attached ✓' : 'Click to attach'}
                                                                </span>
                                                                <input
                                                                    type="file"
                                                                    className="hidden"
                                                                    onChange={e => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            setNewUserQuery(prev => {
                                                                                const updatedDocs = (prev.documents || []).filter(d => d.type !== doc.key);
                                                                                return {
                                                                                    ...prev,
                                                                                    documents: [
                                                                                        ...updatedDocs,
                                                                                        {
                                                                                            name: file.name,
                                                                                            type: doc.key,
                                                                                            uploadedAt: new Date().toISOString()
                                                                                        }
                                                                                    ]
                                                                                };
                                                                            });
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="p-3 bg-amber-100/60 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                                                <span className="material-symbols-outlined text-amber-700 text-base mt-0.5 shrink-0">info</span>
                                                <p className="leading-relaxed">
                                                    <strong>Draft Mode:</strong> If documents or PAN details are not yet complete, select <strong>"Save as Draft"</strong>. No email will be sent until the agent profile is formally submitted and activated.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {newUserQuery.role === 'bank' && (
                                        <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-4">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-slate-700 text-lg">account_balance</span>
                                                    <label htmlFor="create-bank-select" className="text-xs font-bold text-slate-900 block">
                                                        Assigned Lending Bank Partner <span className="text-rose-500">*</span>
                                                    </label>
                                                </div>
                                                <select
                                                    id="create-bank-select"
                                                    required
                                                    value={newUserQuery.bank || ""}
                                                    onChange={e => {
                                                        const selected = bankPartners.find(b => b.shortName === e.target.value);
                                                        setNewUserQuery({
                                                            ...newUserQuery,
                                                            bank: e.target.value,
                                                            firstName: newUserQuery.firstName || (selected?.shortName || e.target.value)
                                                        });
                                                    }}
                                                    className={`w-full min-h-[48px] px-4 py-3 bg-white rounded-xl text-sm font-semibold text-slate-900 focus:outline-none transition-all cursor-pointer shadow-2xs ${
                                                        !newUserQuery.bank
                                                            ? 'border-2 border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                                                            : 'border border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20'
                                                    }`}
                                                >
                                                    <option value="">-- Select Bank Partner ({bankPartners.length} Active Partners) --</option>
                                                    {bankPartners.map((bp: any) => (
                                                        <option key={bp.id || bp.shortName} value={bp.shortName}>
                                                            {bp.name} ({bp.shortName.toUpperCase()}) · {bp.type} · ROI {bp.interestRateMin}% - {bp.interestRateMax}%
                                                        </option>
                                                    ))}
                                                </select>
                                                {!newUserQuery.bank && (
                                                    <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1.5 pt-0.5">
                                                        <span className="material-symbols-outlined text-[14px]">warning</span>
                                                        Selecting a bank partner is required before submitting.
                                                    </p>
                                                )}
                                            </div>

                                            {/* Informational Helper Callout */}
                                            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/70 text-blue-900 text-xs flex items-start gap-2.5">
                                                <span className="material-symbols-outlined text-blue-600 text-base mt-0.5 shrink-0">info</span>
                                                <p className="leading-relaxed font-medium">
                                                    Links the officer profile to the selected lender's underwriting portal, auto-allocation queue, and decision system.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </form>
                        </div>

                        {/* Modal Footer with 48px min-height buttons */}
                        <div className="p-5 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-3 shrink-0">
                            <button 
                                type="button" 
                                onClick={() => setShowCreateUserModal(false)} 
                                className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-white hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs uppercase tracking-wider border border-slate-200 transition-all cursor-pointer text-center"
                            >
                                Cancel
                            </button>

                            {/* Save as Draft Button for Agents */}
                            {newUserQuery.role === 'agent' && (
                                <button
                                    type="button"
                                    disabled={createUserLoading || !newUserQuery.email || !newUserQuery.firstName}
                                    onClick={() => handleCreateUser(undefined, true)}
                                    className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-xl font-bold text-xs uppercase tracking-wider border border-amber-300 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                                    title="Save agent information with incomplete details as Draft without sending notification email"
                                >
                                    <span className="material-symbols-outlined text-base">save</span>
                                    Save as Draft
                                </button>
                            )}

                            <button 
                                form="student-creation-form" 
                                type="submit" 
                                disabled={
                                    createUserLoading || 
                                    (newUserQuery.role === 'bank' && (
                                        !newUserQuery.bank || 
                                        !newUserQuery.firstName?.trim() || 
                                        !newUserQuery.lastName?.trim() || 
                                        !newUserQuery.email?.trim() || 
                                        !newUserQuery.mobile?.trim()
                                    ))
                                } 
                                className="w-full sm:flex-1 min-h-[48px] bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 active:scale-[0.99] transition-all cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none disabled:active:scale-100"
                            >
                                {createUserLoading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-lg">check_circle</span>
                                        {newUserQuery.role === 'staff' || newUserQuery.role === 'staff_admin' ? 'Create Staff Profile' :
                                         newUserQuery.role === 'agent' ? 'Submit & Activate Agent Profile' :
                                         newUserQuery.role === 'bank' ? 'Create Bank Officer Profile' : 'Create Student Profile'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
                )
            )}

            {/* ─── Edit User Modal ─────────────────────────────────────────── */}
            {editingUser && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={() => setEditingUser(null)} />
                    <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[20px]">person_edit</span>
                                </div>
                                <div>
                                    <h3 className="text-[18px] font-bold text-slate-900 tracking-tight">Identity Modification</h3>
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">Target: {editingUser.email}</p>
                                </div>
                            </div>

                            <form onSubmit={handleUpdateUser} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">First Name</label>
                                        <input required type="text" value={editingUser.firstName} onChange={e => setEditingUser({ ...editingUser, firstName: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-400 transition-all" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Last Name</label>
                                        <input required type="text" value={editingUser.lastName} onChange={e => setEditingUser({ ...editingUser, lastName: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-400 transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Contact Phone Number</label>
                                    <input type="tel" value={editingUser.phoneNumber || editingUser.mobile || ""} onChange={e => setEditingUser({ ...editingUser, phoneNumber: e.target.value, mobile: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-400 transition-all" placeholder="+91 XXXX-XXXXXX" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Email Address</label>
                                    <input required type="email" value={editingUser.email || ""} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" placeholder="user@example.com" />
                                </div>
                                {(editingUser.role === 'staff' || editingUser.role === 'staff_admin') && (
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                                            Assigned Office & Location
                                        </label>
                                        <select
                                            value={editingUser.officeId || ""}
                                            onChange={e => {
                                                const sel = offices.find(o => o.id === e.target.value);
                                                setEditingUser({
                                                    ...editingUser,
                                                    officeId: e.target.value,
                                                    officeLocation: sel ? `${sel.name} - ${sel.city} (${sel.location})` : ""
                                                });
                                            }}
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/5 focus:border-slate-400 transition-all cursor-pointer"
                                        >
                                            <option value="">-- Select Office Location --</option>
                                            {offices.map((off: any) => (
                                                <option key={off.id} value={off.id}>
                                                    {off.name} · {off.city} ({off.location})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="pt-4 flex gap-4">
                                    <button type="button" onClick={() => setEditingUser(null)} className="flex-1 px-6 py-3 bg-slate-50 text-slate-400 rounded-lg font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 hover:text-slate-600 transition-all border border-slate-100">Cancel</button>
                                    <button type="submit" disabled={updateLoading} className="flex-[2] bg-slate-900 text-white py-3 rounded-lg font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 active:scale-95 transition-all">
                                        {updateLoading ? "SYNCING..." : "Commit Changes"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Send Email Modal ─────────────────────────────────────────── */}
            {emailModalUser && (
                <div className="fixed inset-0 z-[125] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" onClick={() => setEmailModalUser(null)} />
                    <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200 my-auto">
                        {/* Header */}
                        <div className="px-6 sm:px-8 pt-7 pb-5 bg-gradient-to-br from-indigo-50/70 via-slate-50 to-white border-b border-slate-100">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                                        <span className="material-symbols-outlined text-[22px]">outgoing_mail</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                            Send Email Message
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Direct Dispatch</span>
                                        </h3>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                                            Communicate directly with this account holder
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEmailModalUser(null)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>

                            {/* Recipient summary card */}
                            <div className="mt-4 p-3 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                                        {((emailModalUser.firstName?.[0] || '') + (emailModalUser.lastName?.[0] || 'U')).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-900">
                                                {emailModalUser.firstName} {emailModalUser.lastName}
                                            </span>
                                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                                {emailModalUser.role || 'user'}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[12px] text-slate-400">mail</span>
                                            {emailModalUser.email}
                                        </div>
                                    </div>
                                </div>
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                    Verified Target
                                </span>
                            </div>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleSendEmail} className="p-6 sm:p-8 space-y-5">
                            {/* Quick Template Selector */}
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block flex items-center justify-between">
                                    <span>Quick Preset Templates</span>
                                    <span className="text-slate-400 font-normal">Click to auto-fill</span>
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleSelectTemplate('status')}
                                        className="text-left p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                                    >
                                        <div className="text-[11px] font-bold text-slate-800 group-hover:text-indigo-700 flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[14px] text-indigo-500">sync_alt</span>
                                            Status Update
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">Application review note</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSelectTemplate('docs')}
                                        className="text-left p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                                    >
                                        <div className="text-[11px] font-bold text-slate-800 group-hover:text-indigo-700 flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[14px] text-amber-500">upload_file</span>
                                            Request Docs
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">KYC / Missing files</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSelectTemplate('welcome')}
                                        className="text-left p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                                    >
                                        <div className="text-[11px] font-bold text-slate-800 group-hover:text-indigo-700 flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[14px] text-emerald-500">waving_hand</span>
                                            Welcome Note
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-0.5 truncate">Onboarding greeting</div>
                                    </button>
                                </div>
                            </div>

                            {/* Subject Line */}
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                                    Email Subject <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    required
                                    type="text"
                                    value={emailSubject}
                                    onChange={e => setEmailSubject(e.target.value)}
                                    placeholder="Enter concise email subject..."
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all"
                                />
                            </div>

                            {/* Body Message */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                                        Message Body <span className="text-rose-500">*</span>
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        {emailContent.length} chars
                                    </span>
                                </div>
                                <textarea
                                    required
                                    rows={6}
                                    value={emailContent}
                                    onChange={e => setEmailContent(e.target.value)}
                                    placeholder="Type your message here..."
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all resize-y font-sans leading-relaxed"
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="pt-2 flex items-center gap-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setEmailModalUser(null)}
                                    disabled={sendingEmail}
                                    className="flex-1 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-bold text-xs tracking-wider uppercase transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={sendingEmail}
                                    className="flex-[2] px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white rounded-lg font-bold text-xs tracking-wider uppercase transition-all shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {sendingEmail ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                            Sending Email...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[16px]">send</span>
                                            Send Email Message
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Add Office Modal ──────────────────────────────────────── */}
            {showAddOfficeModal && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowAddOfficeModal(false)} />
                    <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh] border border-slate-200">
                        {/* Modal Header */}
                        <div className="p-6 sm:p-8 pb-4 border-b border-slate-100 shrink-0 bg-slate-50/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[22px]">domain_add</span>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-slate-900 tracking-tight">Add Office & Location</h3>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                                            Define new branches, cities, and physical office locations for staff deployment
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAddOfficeModal(false)}
                                    className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="overflow-y-auto p-6 sm:p-8 space-y-6">
                            <form id="add-office-form" onSubmit={handleCreateOffice} className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                                            Office / Branch Name *
                                        </label>
                                        <input
                                            required
                                            type="text"
                                            value={newOfficeData.name}
                                            onChange={e => setNewOfficeData({ ...newOfficeData, name: e.target.value })}
                                            placeholder="e.g. VidyaLoans HQ / South Hub"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                                            City *
                                        </label>
                                        <input
                                            required
                                            type="text"
                                            value={newOfficeData.city}
                                            onChange={e => setNewOfficeData({ ...newOfficeData, city: e.target.value })}
                                            placeholder="e.g. Hyderabad, Bengaluru, Mumbai"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 block">
                                        Location / Address Details *
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        value={newOfficeData.location}
                                        onChange={e => setNewOfficeData({ ...newOfficeData, location: e.target.value })}
                                        placeholder="e.g. Cyber Towers, Phase 2, HITEC City"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    />
                                </div>
                            </form>

                            {/* Existing Offices List */}
                            <div className="pt-4 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px] text-indigo-600">apartment</span>
                                        Registered Offices ({offices.length})
                                    </h4>
                                    {officesLoading && (
                                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                                    )}
                                </div>

                                {offices.length === 0 ? (
                                    <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                        <span className="material-symbols-outlined text-3xl text-slate-300 block mb-1">domain</span>
                                        <p className="text-xs text-slate-500 font-medium">No offices registered yet. Fill out the form above to add the first office.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                        {offices.map((off: any) => (
                                            <div key={off.id} className="p-3 bg-slate-50 hover:bg-indigo-50/40 border border-slate-200 rounded-xl flex items-center justify-between transition-colors">
                                                <div className="flex items-start gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shrink-0 mt-0.5">
                                                        <span className="material-symbols-outlined text-[16px]">location_on</span>
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs font-bold text-slate-900">{off.name}</p>
                                                            <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[9px] font-bold">
                                                                {off.city}
                                                            </span>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 mt-0.5">{off.location}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteOffice(off.id, off.name)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Delete office"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowAddOfficeModal(false)}
                                className="flex-1 px-6 py-3 bg-white text-slate-600 rounded-xl font-bold text-xs hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                form="add-office-form"
                                type="submit"
                                disabled={createOfficeLoading}
                                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
                            >
                                {createOfficeLoading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[16px]">save</span>
                                        Save Office
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── User Profile & Credentials Modal ─────────────────────────────────────────── */}
            {selectedUserProfile && (
                <div className="fixed inset-0 z-[110] flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-fade-in" onClick={() => { setSelectedUserProfile(null); setUserCredentials(null); setUserLoans([]); }} />
                    <div className="relative w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-slide-in-right border-l border-slate-200 overflow-hidden">
                        <div className="sticky top-0 z-20 bg-white border-b border-slate-100 px-8 py-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg">
                                            <span className="material-symbols-outlined text-[24px]">person</span>
                                        </div>
                                        <div>
                                            <h2 className="text-[20px] font-bold text-slate-900 tracking-tight">{selectedUserProfile.firstName} {selectedUserProfile.lastName}</h2>
                                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{selectedUserProfile.email}</p>
                                                {(() => {
                                                    const assignedBank = getAssignedBank(selectedUserProfile);
                                                    return assignedBank ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold shadow-2xs">
                                                            {assignedBank.logoUrl ? (
                                                                <img src={assignedBank.logoUrl} alt="" className="w-3.5 h-3.5 object-contain" />
                                                            ) : (
                                                                <span className="material-symbols-outlined text-[13px] text-emerald-600">account_balance</span>
                                                            )}
                                                            {assignedBank.name} ({assignedBank.shortName})
                                                        </span>
                                                    ) : null;
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => { setSelectedUserProfile(null); setUserCredentials(null); setUserLoans([]); }} className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all border border-transparent hover:border-slate-100">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="flex gap-4 overflow-x-auto pb-2">
                                <button
                                    onClick={() => setUserProfileTab('credentials')}
                                    className={`whitespace-nowrap pb-3 text-[11px] font-black uppercase tracking-widest border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                                        userProfileTab === 'credentials'
                                            ? 'border-indigo-600 text-indigo-600'
                                            : 'border-transparent text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[14px]">badge</span>
                                    Credentials
                                </button>
                                <button
                                    onClick={() => setUserProfileTab('applications')}
                                    className={`whitespace-nowrap pb-3 text-[11px] font-black uppercase tracking-widest border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                                        userProfileTab === 'applications'
                                            ? 'border-indigo-600 text-indigo-600'
                                            : 'border-transparent text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[14px]">description</span>
                                    Applications ({userLoans.length})
                                </button>
                                <button
                                    onClick={() => setUserProfileTab('bank_compare')}
                                    className={`whitespace-nowrap pb-3 text-[11px] font-black uppercase tracking-widest border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
                                        userProfileTab === 'bank_compare'
                                            ? 'border-emerald-600 text-emerald-600'
                                            : 'border-transparent text-slate-400 hover:text-emerald-600'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[14px]">account_balance</span>
                                    Bank Profile & Compare
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                            {userProfileLoading ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="w-12 h-12 border-3 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                                    <p className="text-[12px] font-bold text-slate-500">Loading user profile...</p>
                                </div>
                            ) : userProfileTab === 'bank_compare' ? (
                                /* ─── Bank Profile vs Bank Partner Comparison View ─── */
                                <div className="space-y-6">
                                    {/* Partner Selector Header */}
                                    <div className="p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 rounded-2xl border border-emerald-200 shadow-sm">
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-[11px] uppercase tracking-wider">
                                                    <span className="material-symbols-outlined text-[18px] text-emerald-600">compare_arrows</span>
                                                    Bank Partner Comparison Engine
                                                </div>
                                                <p className="text-[12px] text-emerald-900 font-medium mt-0.5">
                                                    Compare this user profile against active institutional lending partners.
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="relative min-w-[200px]">
                                                    <select
                                                        value={comparedBankPartner?.shortName || ""}
                                                        onChange={(e) => {
                                                            const partner = bankPartners.find(b => b.shortName === e.target.value);
                                                            setComparedBankPartner(partner || null);
                                                        }}
                                                        className="w-full px-3.5 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer shadow-xs"
                                                    >
                                                        {bankPartners.map((bp: any) => (
                                                            <option key={bp.id || bp.shortName} value={bp.shortName}>
                                                                {bp.name} ({bp.shortName.toUpperCase()})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Side by Side Comparison Grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        {/* Left Box: User / Officer Profile */}
                                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs">
                                            <div>
                                                <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                                                            <span className="material-symbols-outlined text-[16px]">person</span>
                                                        </div>
                                                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">User Identity Profile</h4>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                                        selectedUserProfile.role === 'bank' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                                                    }`}>
                                                        {selectedUserProfile.role?.toUpperCase() || 'USER'}
                                                    </span>
                                                </div>

                                                <div className="space-y-3 text-[11px]">
                                                    <div>
                                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Full Name</span>
                                                        <p className="font-bold text-slate-900 text-sm mt-0.5">{selectedUserProfile.firstName} {selectedUserProfile.lastName}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Email & Mobile</span>
                                                        <p className="font-semibold text-slate-800">{selectedUserProfile.email}</p>
                                                        <p className="text-slate-500 font-mono text-[10px]">{selectedUserProfile.mobile || selectedUserProfile.phone || '—'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Current Assigned Bank</span>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="material-symbols-outlined text-[15px] text-indigo-500">account_balance</span>
                                                            <span className="font-black text-indigo-900 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-[10px]">
                                                                {selectedUserProfile.bank ? selectedUserProfile.bank.toUpperCase() : 'Default / Not Assigned'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">Active Applications In Buffer</span>
                                                        <p className="font-black text-slate-900 text-sm mt-0.5">{userLoans.length} Application{userLoans.length === 1 ? '' : 's'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-slate-400 font-bold uppercase text-[9px] block">System ID</span>
                                                        <code className="bg-slate-200/70 px-1.5 py-0.5 rounded text-[9px] font-mono text-slate-700">
                                                            {selectedUserProfile.id || 'N/A'}
                                                        </code>
                                                    </div>
                                                </div>
                                            </div>

                                            {comparedBankPartner && (
                                                <div className="mt-5 pt-4 border-t border-slate-200">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateUserBank(selectedUserProfile.id, selectedUserProfile.email, comparedBankPartner.shortName)}
                                                        disabled={updatingUserBank || selectedUserProfile.bank === comparedBankPartner.shortName}
                                                        className={`w-full py-2.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                                            selectedUserProfile.bank === comparedBankPartner.shortName
                                                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-default'
                                                                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                                                        }`}
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">
                                                            {selectedUserProfile.bank === comparedBankPartner.shortName ? 'check_circle' : 'link'}
                                                        </span>
                                                        {selectedUserProfile.bank === comparedBankPartner.shortName 
                                                            ? 'Currently Assigned to This Bank' 
                                                            : `Link User to ${comparedBankPartner.shortName.toUpperCase()}`}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Box: Bank Partner Master Parameters */}
                                        <div className="bg-white border-2 border-emerald-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden">
                                            <div className="absolute -top-6 -right-6 w-24 h-24 bg-emerald-50 rounded-full blur-xl pointer-events-none" />
                                            
                                            {comparedBankPartner ? (
                                                <div>
                                                    <div className="flex items-center justify-between pb-3 mb-4 border-b border-emerald-100">
                                                        <div className="flex items-center gap-2.5">
                                                            {comparedBankPartner.logoUrl ? (
                                                                <img src={comparedBankPartner.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-200 p-0.5" />
                                                            ) : (
                                                                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                                                                    <span className="material-symbols-outlined text-[18px]">account_balance</span>
                                                                </div>
                                                            )}
                                                            <div>
                                                                <h4 className="text-xs font-black text-slate-900 leading-tight">{comparedBankPartner.name}</h4>
                                                                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">{comparedBankPartner.type || 'LENDING PARTNER'}</span>
                                                            </div>
                                                        </div>
                                                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                                                            {comparedBankPartner.shortName}
                                                        </span>
                                                    </div>

                                                    <div className="space-y-3 text-[11px]">
                                                        <div className="p-2.5 bg-emerald-50/70 rounded-xl border border-emerald-100">
                                                            <span className="text-emerald-800 font-black uppercase text-[9px] block">Interest Rate (ROI)</span>
                                                            <p className="text-emerald-950 font-black text-sm mt-0.5">
                                                                {comparedBankPartner.interestRateMin || comparedBankPartner.minRoi || 8.5}% - {comparedBankPartner.interestRateMax || comparedBankPartner.maxRoi || 14.5}% <span className="text-[10px] font-semibold text-emerald-700">p.a.</span>
                                                            </p>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                                <span className="text-slate-400 font-bold uppercase text-[8px] block">Max Loan Limit</span>
                                                                <p className="font-extrabold text-slate-900 text-xs mt-0.5">{comparedBankPartner.maxLoanAmount || '₹1.50 Cr'}</p>
                                                            </div>
                                                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                                <span className="text-slate-400 font-bold uppercase text-[8px] block">Collateral-Free</span>
                                                                <p className="font-extrabold text-slate-900 text-xs mt-0.5">{comparedBankPartner.collateralFreeLimit || '₹50 Lakhs'}</p>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                                <span className="text-slate-400 font-bold uppercase text-[8px] block">Processing SLA</span>
                                                                <p className="font-extrabold text-slate-900 text-xs mt-0.5">{comparedBankPartner.processingTime || '3-5 Days'}</p>
                                                            </div>
                                                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                                <span className="text-slate-400 font-bold uppercase text-[8px] block">Processing Fee</span>
                                                                <p className="font-extrabold text-slate-900 text-xs mt-0.5">{comparedBankPartner.processingFee || '0.5% - 1%'}</p>
                                                            </div>
                                                        </div>

                                                        {Array.isArray(comparedBankPartner.features) && comparedBankPartner.features.length > 0 && (
                                                            <div>
                                                                <span className="text-slate-400 font-bold uppercase text-[9px] block mb-1">Key Schemes & Highlights</span>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {comparedBankPartner.features.slice(0, 4).map((f: string, idx: number) => (
                                                                        <span key={idx} className="px-2 py-0.5 bg-emerald-50 text-emerald-800 rounded text-[9px] font-bold border border-emerald-100">
                                                                            ✓ {f}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-12">
                                                    <span className="material-symbols-outlined text-3xl text-slate-300 block mb-2">account_balance</span>
                                                    <p className="text-xs text-slate-400 font-bold">Select a Bank Partner above to compare</p>
                                                </div>
                                            )}

                                            {comparedBankPartner?.website && (
                                                <div className="mt-4 pt-3 border-t border-slate-100">
                                                    <a
                                                        href={comparedBankPartner.website}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center justify-center gap-1"
                                                    >
                                                        <span>Visit Official {comparedBankPartner.name} Portal</span>
                                                        <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : userProfileTab === 'applications' ? (
                                /* ─── Applications Tab ─── */
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="material-symbols-outlined text-emerald-600 text-[20px]">account_balance</span>
                                        <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wide">Loan Applications ({userLoans.length})</h3>
                                    </div>
                                    
                                    {userLoans.length > 0 ? (
                                        <div className="space-y-3">
                                            {userLoans.map((loan: any, idx: number) => (
                                                <div key={idx} className="p-4 border border-slate-100 rounded-lg hover:border-slate-200 hover:bg-slate-50/50 transition-all group">
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex-1">
                                                            <p className="text-[12px] font-bold text-slate-900">
                                                                {loan.bank} - {loan.loanType?.toUpperCase()}
                                                            </p>
                                                            <p className="text-[10px] text-slate-500 mt-1">
                                                                App ID: <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-mono">{loan.applicationNumber || loan.id?.substring(0, 8)}</code>
                                                            </p>
                                                        </div>
                                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                                                            loan.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                            loan.status === 'processing' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                            loan.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                                            loan.status === 'disbursed' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                                            loan.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                                            'bg-slate-50 text-slate-600 border-slate-100'
                                                        }`}>
                                                            {loan.status}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="text-[10px]">
                                                            <span className="text-slate-500 font-medium">Amount</span>
                                                            <p className="text-[12px] font-bold text-slate-900 mt-0.5">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(loan.amount || 0)}</p>
                                                        </div>
                                                        <div className="text-[10px]">
                                                            <span className="text-slate-500 font-medium">Applied On</span>
                                                            <p className="text-[12px] font-bold text-slate-900 mt-0.5">{loan.createdAt ? new Date(loan.createdAt).toLocaleDateString('en-IN') : '—'}</p>
                                                        </div>
                                                    </div>
                                                    {loan.universityName && (
                                                        <p className="text-[10px] text-slate-500 mt-3">
                                                            <span className="font-medium">University:</span> {loan.universityName} {loan.country && `(${loan.country})`}
                                                        </p>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setSelectedApp(loan);
                                                            setSelectedUserProfile(null);
                                                        }}
                                                        className="mt-3 w-full px-3 py-2 bg-slate-900 text-white rounded text-[10px] font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors flex items-center justify-center gap-1.5"
                                                    >
                                                        <span className="material-symbols-outlined text-[12px]">open_in_full</span>
                                                        View Full Details
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                            <span className="material-symbols-outlined text-3xl text-slate-300 block mb-2">folder_off</span>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">No loan applications</p>
                                        </div>
                                    )}

                                    {/* Summary Statistics */}
                                    <div className="space-y-6 pt-6 border-t border-slate-200">
                                        <div className="flex items-center gap-3 mb-4">
                                            <span className="material-symbols-outlined text-blue-600 text-[20px]">analytics</span>
                                            <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wide">Application Summary</h3>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-center">
                                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Total Loans</p>
                                                <p className="text-[18px] font-black text-blue-700 mt-1">{userLoans.length}</p>
                                            </div>
                                            <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
                                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Approved</p>
                                                <p className="text-[18px] font-black text-emerald-700 mt-1">{userLoans.filter((l: any) => l.status === 'approved' || l.status === 'disbursed').length}</p>
                                            </div>
                                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100 text-center">
                                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pending</p>
                                                <p className="text-[18px] font-black text-amber-700 mt-1">{userLoans.filter((l: any) => l.status === 'pending' || l.status === 'processing').length}</p>
                                            </div>
                                        </div>
                                        {userLoans.length > 0 && (
                                            <div className="p-4 bg-slate-900 text-white rounded-lg">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300 mb-1">Total Loan Value Requested</p>
                                                <p className="text-[24px] font-black text-white">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(userLoans.reduce((sum: number, l: any) => sum + (l.amount || 0), 0))}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* ─── Credentials Tab ─── */
                                <div className="space-y-6">
                                    {/* If Bank Officer or has Assigned Bank, show rich Assigned Lending Partner Institution Card */}
                                    {(() => {
                                        const assignedBank = getAssignedBank(selectedUserProfile);
                                        if (!assignedBank && selectedUserProfile?.role !== 'bank') return null;
                                        const bankObj = assignedBank || {
                                            name: (selectedUserProfile?.bank || 'Lending Partner').toUpperCase(),
                                            shortName: (selectedUserProfile?.bank || 'BANK').toUpperCase(),
                                            type: 'Lending Partner Institution',
                                            interestRateMin: 8.5,
                                            interestRateMax: 14.5,
                                            maxLoanAmount: '₹1.50 Cr',
                                            collateralFreeLimit: '₹50 Lakhs',
                                            processingTime: '3-5 Days',
                                            processingFee: '0.5% - 1%',
                                            features: ['Direct Sanction Line', 'Pre-Visa Disbursal', 'Competitive ROI']
                                        };
                                        return (
                                            <div className="p-5 bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-white rounded-2xl border-2 border-emerald-200 shadow-sm space-y-4">
                                                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3 flex-wrap gap-3">
                                                    <div className="flex items-center gap-3">
                                                        {bankObj.logoUrl ? (
                                                            <img src={bankObj.logoUrl} alt="" className="w-12 h-12 object-contain bg-white rounded-xl p-1.5 border border-emerald-200 shadow-xs" />
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-base shadow-xs">
                                                                <span className="material-symbols-outlined text-[24px]">account_balance</span>
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="text-[15px] font-black text-slate-900">{bankObj.name}</h4>
                                                                <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[9px] font-black uppercase tracking-wider shadow-xs">
                                                                    {bankObj.shortName}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mt-0.5 flex items-center gap-1.5">
                                                                <span>{bankObj.type || 'Lending Partner Institution'}</span>
                                                                <span>•</span>
                                                                <span className="text-emerald-700">Assigned Bank Representative</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setUserProfileTab('bank_compare')}
                                                            className="px-2.5 py-1.5 bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                                                        >
                                                            Switch Bank
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                                                    <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-xs">
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">Interest Rate (ROI)</span>
                                                        <span className="text-sm font-black text-emerald-950 mt-0.5 block">{bankObj.interestRateMin || 8.5}% - {bankObj.interestRateMax || 14.5}%</span>
                                                        <span className="text-[9px] text-slate-500 font-medium">p.a. floating / fixed</span>
                                                    </div>
                                                    <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-xs">
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">Max Sanction Limit</span>
                                                        <span className="text-sm font-black text-slate-900 mt-0.5 block">{bankObj.maxLoanAmount || '₹1.50 Cr'}</span>
                                                        <span className="text-[9px] text-slate-500 font-medium">Sanction Cap</span>
                                                    </div>
                                                    <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-xs">
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">Collateral-Free Limit</span>
                                                        <span className="text-sm font-black text-slate-900 mt-0.5 block">{bankObj.collateralFreeLimit || '₹50 Lakhs'}</span>
                                                        <span className="text-[9px] text-slate-500 font-medium">Unsecured threshold</span>
                                                    </div>
                                                    <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-xs">
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">Processing SLA</span>
                                                        <span className="text-sm font-black text-slate-900 mt-0.5 block">{bankObj.processingTime || '3-5 Days'}</span>
                                                        <span className="text-[9px] text-slate-500 font-medium">Fee: {bankObj.processingFee || '0.5% - 1%'}</span>
                                                    </div>
                                                </div>

                                                {Array.isArray(bankObj.features) && bankObj.features.length > 0 && (
                                                    <div className="pt-1">
                                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Approved Lending Products & Schemes</span>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {bankObj.features.map((f: string, idx: number) => (
                                                                <span key={idx} className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-900 rounded-md text-[9px] font-bold shadow-2xs">
                                                                    ✓ {f}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="material-symbols-outlined text-indigo-600 text-[20px]">security</span>
                                        <h3 className="text-[13px] font-bold text-slate-900 uppercase tracking-wide">Personal Information</h3>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 bg-indigo-50 p-6 rounded-lg border border-indigo-100">
                                        <DetailRow label="Full Name" value={`${userCredentials?.firstName || selectedUserProfile.firstName} ${userCredentials?.lastName || selectedUserProfile.lastName}`} highlight />
                                        <DetailRow label="Email" value={userCredentials?.email || selectedUserProfile.email} />
                                        <DetailRow label="Phone" value={userCredentials?.mobile || userCredentials?.phoneNumber || '—'} />
                                        <DetailRow label="Role" value={userCredentials?.role?.toUpperCase() || '—'} />
                                        <DetailRow 
                                            label="Assigned Bank" 
                                            value={(() => {
                                                const b = getAssignedBank(selectedUserProfile);
                                                return b ? `${b.name} (${b.shortName})` : (selectedUserProfile.bank ? selectedUserProfile.bank.toUpperCase() : '—');
                                            })()} 
                                            highlight={!!selectedUserProfile.bank} 
                                        />
                                        <DetailRow label="Date of Birth" value={userCredentials?.dob ? format(new Date(userCredentials.dob), 'dd MMM yyyy') : '—'} />
                                        <DetailRow label="Gender" value={userCredentials?.gender || '—'} />
                                        {userCredentials?.createdAt && (
                                            <DetailRow label="Member Since" value={format(new Date(userCredentials.createdAt), 'dd MMM yyyy')} />
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
                </div>

            </main>

            {/* ── Staff Resignation & Application Handover Modal ─────────────────── */}
            {resignModal?.open && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(6px)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-rose-600 to-rose-500 px-6 py-4 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-white text-[20px]">person_off</span>
                            </div>
                            <div>
                                <h2 className="text-white font-bold text-[15px] leading-tight">Staff Resignation & Application Handover</h2>
                                <p className="text-rose-100 text-[11px] mt-0.5">This action will permanently mark the staff member as Resigned (Invalid)</p>
                            </div>
                            <button onClick={() => setResignModal(null)} className="ml-auto p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-all">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>

                        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                            {/* Staff Info Card */}
                            <div className="flex items-center gap-4 p-4 bg-rose-50 border border-rose-100 rounded-xl">
                                <img src={resignModal.staffAvatar} alt="" className="w-12 h-12 rounded-full border-2 border-rose-200 object-cover flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-slate-900 text-[14px]">{resignModal.staffName}</p>
                                    <p className="text-slate-500 text-[12px]">{resignModal.staffEmail}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    {resignModal.loadingApps ? (
                                        <div className="h-7 w-20 bg-rose-100 animate-pulse rounded" />
                                    ) : (
                                        <>
                                            <p className="text-[22px] font-black text-rose-600">{resignModal.applications.length}</p>
                                            <p className="text-[10px] text-slate-500 font-medium">pending app{resignModal.applications.length !== 1 ? 's' : ''} to reassign</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Warning Message */}
                            <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <span className="material-symbols-outlined text-amber-600 text-[18px] flex-shrink-0 mt-0.5">warning</span>
                                <p className="text-[12px] text-amber-800 leading-relaxed">
                                    <strong>Important:</strong> Once marked as Resigned, this staff member will be excluded from all future application assignments and labeled as Invalid across the portal.
                                    {resignModal.applications.length > 0
                                        ? ` Their ${resignModal.applications.length} pending application(s) must be reassigned to continue processing.`
                                        : ' They currently have no pending applications that need reassignment.'}
                                </p>
                            </div>

                            {/* Reassign Target Selector */}
                            {!resignModal.loadingApps && resignModal.applications.length > 0 && (
                                <div className="space-y-3">
                                    <label className="block text-[12px] font-semibold text-slate-700">
                                        Reassign {resignModal.applications.length} application(s) to:
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={resignTargetStaff}
                                            onChange={e => setResignTargetStaff(e.target.value)}
                                            className="w-full px-3 py-2.5 pr-8 rounded-lg border border-slate-200 bg-white text-[13px] text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 appearance-none cursor-pointer shadow-sm transition-all"
                                        >
                                            <option value="auto">🔄 Auto Round-Robin — distribute evenly across active staff</option>
                                            {staffMembers
                                                .filter((s: any) => {
                                                    const isResigned = s.isResigned || ['resigned', 'inactive', 'invalid'].includes((s.status || '').toLowerCase());
                                                    return !isResigned && s.id !== resignModal.staffId && s.linkedUserId !== resignModal.staffId && (s.role === 'staff' || s.role === 'staff_admin');
                                                })
                                                .map((s: any) => {
                                                    const name = `${s.firstName || ''} ${s.lastName || ''}`.trim() || s.email;
                                                    const workload = s.currentWorkload ?? '?';
                                                    return (
                                                        <option key={s.id} value={s.linkedUserId || s.id}>
                                                            {name} — {s.email} ({workload} active apps)
                                                        </option>
                                                    );
                                                })}
                                        </select>
                                        <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
                                    </div>
                                </div>
                            )}

                            {/* Applications List */}
                            {resignModal.loadingApps ? (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Loading applications...</p>
                                    {[1,2,3].map(i => (
                                        <div key={i} className="h-10 bg-slate-100 animate-pulse rounded-lg" />
                                    ))}
                                </div>
                            ) : resignModal.applications.length > 0 ? (
                                <div className="space-y-2">
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px]">assignment</span>
                                        Applications to be reassigned ({resignModal.applications.length})
                                    </p>
                                    <div className="rounded-xl border border-slate-200 overflow-hidden max-h-52 overflow-y-auto">
                                        {resignModal.applications.map((app: any, idx: number) => (
                                            <div key={app.id || idx} className={`flex items-center gap-3 px-4 py-2.5 ${idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'} border-b border-slate-100 last:border-0`}>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] font-semibold text-slate-800 truncate">{app.applicationNumber || app.id}</p>
                                                    <p className="text-[10px] text-slate-500 truncate">{[app.firstName, app.lastName].filter(Boolean).join(' ') || app.email || '—'}</p>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">{app.bank || 'No Bank'}</span>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                        (app.status || '').toLowerCase() === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                        (app.status || '').toLowerCase() === 'processing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}>{app.status || 'Draft'}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                                    <span className="material-symbols-outlined text-emerald-600 text-[22px]">check_circle</span>
                                    <div>
                                        <p className="text-[13px] font-semibold text-emerald-800">No pending applications</p>
                                        <p className="text-[11px] text-emerald-600 mt-0.5">This staff member has no active applications that need to be reassigned.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                            <button
                                onClick={() => setResignModal(null)}
                                disabled={resignSubmitting}
                                className="px-4 py-2 text-[12px] font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-all disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <div className="flex items-center gap-2">
                                {resignModal.applications.length > 0 && !resignModal.loadingApps && (
                                    <button
                                        onClick={() => handleConfirmResignHandover(true)}
                                        disabled={resignSubmitting}
                                        className="px-4 py-2 text-[12px] font-semibold text-slate-500 hover:text-slate-700 transition-all disabled:opacity-50 underline underline-offset-2"
                                    >
                                        Mark Resigned Without Reassigning
                                    </button>
                                )}
                                <button
                                    onClick={() => handleConfirmResignHandover(false)}
                                    disabled={resignSubmitting || resignModal.loadingApps}
                                    className="flex items-center gap-2 px-5 py-2 text-[12px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-all disabled:opacity-50 shadow-sm"
                                >
                                    {resignSubmitting ? (
                                        <>
                                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[15px]">person_off</span>
                                            {resignModal.applications.length > 0 ? `Confirm Resignation & Reassign ${resignModal.applications.length} App${resignModal.applications.length !== 1 ? 's' : ''}` : 'Confirm Resignation'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

}

// ─── Helper Components ───────────────────────────────────────────────────────

// This is a helper function defined outside the component to render detail rows in the drawer
// Move it to be accessible to the admin component
