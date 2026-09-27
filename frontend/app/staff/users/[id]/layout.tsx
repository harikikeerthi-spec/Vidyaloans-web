"use client";

import { use, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { UserDossierProvider, useUserDossier } from "./DossierContext";
import { motion, AnimatePresence } from "framer-motion";
import ShareWithBankModal from "@/components/staff/ShareWithBankModal";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { adminApi } from "@/lib/api";

function DossierLayoutInner({ children }: { children: React.ReactNode }) {
    const {
        userId,
        userData,
        userApplications,
        setUserApplications,
        loading,
        actionLoading,
        openCoAppModal,
        isCoAppModalOpen,
        setIsCoAppModalOpen,
        coAppName,
        setCoAppName,
        coAppRelation,
        setCoAppRelation,
        coAppPhone,
        setCoAppPhone,
        coAppEmail,
        setCoAppEmail,
        coAppIncome,
        setCoAppIncome,
        handleSaveCoApp,
        routingApp,
        setRoutingApp,
        isShareModalOpen,
        setIsShareModalOpen
    } = useUserDossier();

    const router = useRouter();
    const pathname = usePathname();
    const [isRefreshing, setIsRefreshing] = useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        window.location.reload();
    };

    const handleBack = () => {
        router.push("/staff/users");
    };

    // Determine current active tab based on pathname
    let activeTab = "profile";
    if (pathname.endsWith("/documents")) {
        activeTab = "documents";
    } else if (pathname.endsWith("/evv")) {
        activeTab = "evv";
    } else if (pathname.endsWith("/credit-report") || pathname.endsWith("/credit-analysis")) {
        activeTab = "credit-report";
    } else if (pathname.endsWith("/applications")) {
        activeTab = "applications";
    } else if (pathname.endsWith("/follow-ups")) {
        activeTab = "follow-ups";
    } else if (pathname.endsWith("/notes")) {
        activeTab = "notes";
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-[30%] left-[30%] w-[300px] h-[300px] bg-[#6605c7]/5 rounded-full blur-[80px] animate-pulse" />
                </div>
                <div className="flex flex-col items-center gap-6 relative z-10">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 border-4 border-[#6605c7]/10 rounded-full" />
                        <div className="absolute inset-0 border-4 border-transparent border-t-[#6605c7] border-r-purple-400 rounded-full animate-spin" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-[#6605c7]/5 rounded-full animate-ping" />
                    </div>
                    <p className="text-[10px] font-black tracking-[0.25em] text-[#6605c7] uppercase animate-pulse">Initializing Secure Vault...</p>
                </div>
            </div>
        );
    }

    if (!userData) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 flex items-center justify-center relative">
                <div className="max-w-md w-full mx-6 p-8 rounded-2xl bg-white/70 border border-white/80 backdrop-blur-xl shadow-2xl text-center relative z-10">
                    <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-6 text-rose-500">
                        <span className="material-symbols-outlined text-[32px]">face_dissatisfied</span>
                    </div>
                    <h3 className="text-xl font-bold text-[#1a1626] mb-2">Subject Decryption Failed</h3>
                    <p className="text-sm text-gray-500 mb-8">The requested user profile could not be located in the active directory node.</p>
                    <button
                        onClick={handleBack}
                        className="w-full py-3 bg-gradient-to-r from-[#6605c7] to-[#8b24e5] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-purple-500/20 hover:shadow-purple-500/35 transition-all duration-300 cursor-pointer"
                    >
                        Return to Hub
                    </button>
                </div>
            </div>
        );
    }

    const isApplicationSentToBank = (app: any): boolean => {
        if (!app) return false;
        if (app.submittedToBankAt || app.bankSubmittedAt || app.routedToBankAt || app.fileLoggedAt || app.sentToBank || app.sharedWithBank) {
            return true;
        }
        const status = (app.status || '').toLowerCase().trim();
        const preBankStatuses = ['draft', 'submitted', 'pending', 'staff_review', 'staff_verified', 'under_review', 'in_progress', 'new', 'waiting', 'received'];
        const bankWorkflowStatuses = [
            'submitted_to_bank', 'submitting_to_bank', 'file_logged', 'under_bank_review',
            'in_bank_review', 'bank_review', 'query_raised', 'bank_approved', 'approved_by_bank',
            'sanctioned', 'conditional_sanction', 'partial_sanction', 'counter_offer', 'disbursed',
            'bank_rejected', 'rejected_by_bank'
        ];
        if (bankWorkflowStatuses.includes(status)) {
            return true;
        }
        const bankName = (app.bank || '').toLowerCase().trim();
        const isGenericBank = !bankName || bankName === 'any bank' || bankName === '—' || bankName === 'pending partner' || bankName === 'none';
        if (!preBankStatuses.includes(status) && !isGenericBank) {
            return true;
        }
        return false;
    };

    const activeBankAppsCount = (userApplications || []).filter(isApplicationSentToBank).length;

    const navigationTabs = [
        { id: "profile", label: "Profile Details", path: `/staff/users/${userId}` },
        { id: "documents", label: "Documents", path: `/staff/users/${userId}/documents` },
        { id: "evv", label: "EVV Verification", path: `/staff/users/${userId}/evv` },
        { id: "credit-report", label: "Credit Analysis Report", path: `/staff/users/${userId}/credit-report` },
        { id: "applications", label: "Bank Applications", path: `/staff/users/${userId}/applications`, badge: activeBankAppsCount > 0 ? activeBankAppsCount : undefined },
        { id: "follow-ups", label: "Follow-Ups", path: `/staff/users/${userId}/follow-ups` },
        { id: "notes", label: "Internal Notes", path: `/staff/users/${userId}/notes` }
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 w-full">
            {/* Top Global Header Bar (Edge-to-Edge Container) */}
            <div className="w-full bg-white border-b border-gray-200/80 shadow-2xs">
                {/* Top Action Breadcrumb Row */}
                <div className="max-w-7xl mx-auto px-6 pt-3 pb-2 flex items-center justify-between">
                    {/* <button
                        onClick={handleBack}
                        className="inline-flex items-center text-xs font-bold text-gray-500 hover:text-indigo-600 transition-colors uppercase tracking-wider cursor-pointer group"
                    >
                        <span className="mr-1.5 text-sm transition-transform group-hover:-translate-x-0.5">←</span> Back to Members
                    </button> */}
                    <div className="text-xs text-gray-400 font-medium">
                        Student ID: <span className="text-gray-800 font-mono font-bold">{userData.studentId || userData.customId || userData.id || userId}</span>
                    </div>
                </div>

                {/* Full-Width User Profile Hero Card */}
                <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {/* Avatar Ring */}
                        <div className="w-12 h-12 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-lg shadow-sm ring-4 ring-indigo-50 overflow-hidden shrink-0">
                            {userData.avatarUrl ? (
                                <img src={userData.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span>{(userData.firstName || "U").substring(0, 2).toUpperCase()}</span>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-xl font-bold text-gray-900 tracking-tight uppercase">
                                    {userData.firstName || "—"} {userData.lastName || ""}
                                </h1>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Registered: <span className="font-medium text-gray-700">{formatDate(userData.createdAt, "MMM d, yyyy")}</span>
                            </p>
                        </div>
                    </div>

                    {/* User Action Controls */}
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            title="Refresh Page"
                        >
                            <span className={`material-symbols-outlined text-[16px] text-gray-600 ${isRefreshing ? "animate-spin" : ""}`}>
                                refresh
                            </span>

                        </button>
                        <button
                            type="button"
                            onClick={openCoAppModal}
                            disabled={actionLoading}
                            className="px-3.5 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                        >
                            Change Co-Applicant
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                const targetId = userData.id || userData._id || userId;
                                const studentPhone = userData.phoneNumber || userData.mobile || userData.phone || "";
                                const studentEmail = userData.email || "";
                                const studentFirstName = userData.firstName || "";
                                const studentLastName = userData.lastName || "";
                                router.push(`/staff/chat-customer?userId=${targetId}&id=${targetId}&email=${encodeURIComponent(studentEmail)}&firstName=${encodeURIComponent(studentFirstName)}&lastName=${encodeURIComponent(studentLastName)}&phone=${encodeURIComponent(studentPhone)}`);
                            }}
                            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <span>Chat with Student</span>
                        </button>
                    </div>
                </div>

                {/* Edge-to-Edge Segmented Sub-Navigation Bar */}
                <div className="bg-gray-50/80 border-t border-gray-200/60">
                    <div className="max-w-7xl mx-auto px-6 flex items-center gap-1 overflow-x-auto text-xs font-semibold text-gray-600 py-1.5 scrollbar-hide">
                        {navigationTabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <Link
                                    key={tab.id}
                                    href={tab.path}
                                    className={`px-3.5 py-2 rounded-md transition-all whitespace-nowrap inline-flex items-center gap-1.5 cursor-pointer ${isActive
                                        ? "bg-white text-indigo-600 shadow-2xs font-bold border border-gray-200/80"
                                        : "hover:text-indigo-600 hover:bg-white"
                                        }`}
                                >
                                    <span>{tab.label}</span>
                                    {tab.badge && (
                                        <span className="px-1.5 py-0.2 text-[10px] bg-indigo-100 text-indigo-700 rounded-full font-bold">
                                            {tab.badge}
                                        </span>
                                    )}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Content Workspace Container (Padded Below) */}
            <main className="max-w-7xl mx-auto px-6 py-6">
                {children}
            </main>

            {/* Edit Co-applicant Details Modal */}
            {isCoAppModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-white/40"
                    >
                        <div className="bg-gradient-to-r from-indigo-500/10 to-[#6605c7]/10 border-b border-indigo-100 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                                    <span className="material-symbols-outlined text-[20px]">groups</span>
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-black text-[#1a1626] uppercase tracking-wider">Modify Co-applicant Profile</h3>
                                    <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Edit co-applicant information for user directory & active loan files</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Co-applicant Name</label>
                                <input
                                    type="text"
                                    value={coAppName}
                                    onChange={(e) => setCoAppName(e.target.value)}
                                    placeholder="Enter co-applicant full name"
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Relationship to Student</label>
                                    <select
                                        value={coAppRelation}
                                        onChange={(e) => setCoAppRelation(e.target.value)}
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer transition-all"
                                    >
                                        <option value="" disabled>Select relation...</option>
                                        <option value="Father">Father</option>
                                        <option value="Mother">Mother</option>
                                        <option value="Spouse">Spouse</option>
                                        <option value="Brother">Brother</option>
                                        <option value="Sister">Sister</option>
                                        <option value="Uncle">Uncle</option>
                                        <option value="Aunt">Aunt</option>
                                        <option value="Guardian">Guardian</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Annual Income (INR)</label>
                                    <input
                                        type="number"
                                        value={coAppIncome}
                                        onChange={(e) => setCoAppIncome(e.target.value)}
                                        placeholder="Example: 600000"
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Phone Number</label>
                                    <input
                                        type="tel"
                                        value={coAppPhone}
                                        onChange={(e) => setCoAppPhone(e.target.value)}
                                        placeholder="Enter 10-digit mobile number"
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
                                    <input
                                        type="email"
                                        value={coAppEmail}
                                        onChange={(e) => setCoAppEmail(e.target.value)}
                                        placeholder="example@mail.com"
                                        className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 flex justify-end gap-3">
                            <button
                                onClick={() => setIsCoAppModalOpen(false)}
                                disabled={actionLoading}
                                className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-gray-600 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveCoApp}
                                disabled={actionLoading || !coAppRelation}
                                className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-indigo-600 to-[#6605c7] hover:opacity-90 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-500/20"
                            >
                                Save Changes
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Share/Route to Bank Modal */}
            {isShareModalOpen && routingApp && (
                <ShareWithBankModal
                    applicationId={routingApp.id}
                    applicationNumber={routingApp.applicationNumber || ""}
                    studentName={`${userData.firstName || ""} ${userData.lastName || ""}`}
                    loanAmount={routingApp.amount || 1500000}
                    isOpen={isShareModalOpen}
                    onClose={() => {
                        setIsShareModalOpen(false);
                        setRoutingApp(null);
                    }}
                    onSuccess={async () => {
                        setIsShareModalOpen(false);
                        setRoutingApp(null);
                        // Refresh data to show routed status
                        try {
                            const appsRes = await adminApi.getApplications({}) as any;
                            const fetchedApps = appsRes.data || [];
                            const userApps = fetchedApps.filter((app: any) =>
                                app.userId === userId || app.user_id === userId || app.applicantId === userId || app.linkedUserId === userId ||
                                (userData && (app.userId === userData.id || app.user_id === userData.id || app.applicantId === userData.id))
                            );
                            setUserApplications(userApps);
                        } catch (e) {
                            console.error("Failed to refresh applications list:", e);
                        }
                    }}
                />
            )}
        </div>
    );
}

export default function UserDossierLayout({
    params,
    children
}: {
    params: Promise<{ id: string }>;
    children: React.ReactNode;
}) {
    const { id } = use(params);
    return (
        <UserDossierProvider userId={id}>
            <DossierLayoutInner>{children}</DossierLayoutInner>
        </UserDossierProvider>
    );
}
