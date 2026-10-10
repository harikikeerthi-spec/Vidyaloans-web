"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { AgentProvider, useAgent } from "./AgentContext";
import Link from "next/link";
import SupportTicketModal from "@/components/SupportTicketModal";

function AgentLayoutInner({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user } = useAuth();
    const { settings: siteSettings } = useSiteSettings();
    const [notificationsOpen, setNotificationsOpen] = React.useState(false);
    const [isSupportOpen, setIsSupportOpen] = React.useState(false);
    const {
        logout,
        toast,
        sidebarCollapsed, setSidebarCollapsed,
        sidebarOpen, setSidebarOpen,
        agentProfile,
        unreadChatCount
    } = useAgent();

    // Side navigation bar definition
    const navItems = [
        { section: "dashboard", icon: "space_dashboard", label: "Home Dashboard" },
        { section: "lead-submission", icon: "add_circle", label: "Submit Lead" },
        { section: "students", icon: "groups", label: "My Students" },
        { section: "documents", icon: "folder_shared", label: "Documents" },
        { section: "calendar", icon: "calendar_month", label: "Calendar" },
        { section: "commissions", icon: "account_balance_wallet", label: "Commissions" },
        { section: "profile", icon: "manage_accounts", label: "Profile & KYC" },
        { section: "analytics", icon: "monitoring", label: "Performance" },
        { section: "sub-agents", icon: "share_reviews", label: "Sub-Agents" },
        { section: "training", icon: "school", label: "LMS & Training" },
        { section: "alumni", icon: "diversity_3", label: "Alumni Referrals" },
        { section: "chat-staff", icon: "support_agent", label: "Staff RM Line", badge: unreadChatCount },
        { section: "support-tickets", icon: "confirmation_number", label: "Support Tickets" },
        { section: "chat-student", icon: "forum", label: "Student Line" },
        { section: "qr-code", icon: "qr_code_2", label: "QR Lead Capture" },
        { section: "tracking-links", icon: "link", label: "Tracking Links" },
        { section: "whatsapp-bot", icon: "chat_bubble", label: "WhatsApp Bot" },
        { section: "balance-transfer", icon: "swap_horiz", label: "Balance Transfer" },
    ];

    // Determine current section heading name
    const currentNavItem = navItems.find(item => pathname.startsWith(`/agent/${item.section}`));
    const sectionTitle = currentNavItem ? currentNavItem.label : "Agent Operations Hub";

    return (
        <div className="h-screen overflow-hidden bg-[#fcfaff] flex font-sans selection:bg-[#6605c7]/10 selection:text-[#6605c7]">
            {/* Toast Banner Alert */}
            {toast && (
                <div className="fixed top-8 right-8 z-[100] px-6 py-4 rounded-2xl shadow-xl bg-white border border-[#6605c7]/10 animate-fade-in-up flex items-center gap-3">
                    <span className={`material-symbols-outlined ${toast.type === 'success' ? 'text-emerald-500' : toast.type === 'warning' ? 'text-rose-500' : 'text-[#6605c7]'}`}>
                        {toast.type === 'success' ? 'check_circle' : toast.type === 'warning' ? 'warning' : 'info'}
                    </span>
                    <span className="text-xs font-bold text-gray-800">{toast.message}</span>
                </div>
            )}

            {/* Mobile backdrop overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar Navigation — Admin Dashboard UI Style */}
            <aside className={`fixed inset-y-0 left-0 z-50 bg-[#0f172a] text-slate-300 border-r border-slate-800 shadow-xl flex flex-col group/sidebar
                transition-all duration-300 ease-in-out overflow-hidden
                ${sidebarOpen
                    ? "w-[240px] translate-x-0"
                    : sidebarCollapsed
                        ? "w-[68px] lg:translate-x-0 -translate-x-full hover:w-[240px]"
                        : "w-[240px] lg:translate-x-0 -translate-x-full"
                }`}>
                <div className="flex flex-col h-full overflow-hidden relative">

                    {/* Brand Header Logo */}
                    <div className="h-14 px-4 flex items-center border-b border-slate-800 flex-shrink-0 gap-2.5 justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <img
                                src={siteSettings?.logoLightUrl || "/images/vidyaloans-logo-transparent.png"}
                                alt={`${siteSettings?.siteName || "VidyaLoans"} Logo`}
                                className="w-7 h-7 object-contain flex-shrink-0 cursor-pointer"
                                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            />
                            <span className={`font-semibold text-[13px] text-white tracking-wide whitespace-nowrap transition-all duration-200 ${!sidebarCollapsed ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                                {siteSettings?.siteName || "VidyaLoans"}<span className="text-indigo-400"> Agent</span>
                            </span>
                        </div>

                    </div>

                    {/* Nav Items List */}
                    <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
                        <div className={`px-3 mb-2 mt-1 text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none transition-all duration-200 whitespace-nowrap truncate ${!sidebarCollapsed ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>Main</div>

                        {navItems.map((item, idx) => {
                            const isActive = pathname.startsWith(`/agent/${item.section}`);
                            return (
                                <React.Fragment key={item.section}>
                                    {idx === 3 && <div className={`px-3 mb-2 mt-4 text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none border-t border-slate-800 pt-3 transition-all duration-200 whitespace-nowrap truncate ${!sidebarCollapsed ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>Backoffice</div>}
                                    {idx === 7 && <div className={`px-3 mb-2 mt-4 text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none border-t border-slate-800 pt-3 transition-all duration-200 whitespace-nowrap truncate ${!sidebarCollapsed ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>Grow Network</div>}
                                    {idx === 11 && <div className={`px-3 mb-2 mt-4 text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none border-t border-slate-800 pt-3 transition-all duration-200 whitespace-nowrap truncate ${!sidebarCollapsed ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>Live Support</div>}
                                    {idx === 13 && <div className={`px-3 mb-2 mt-4 text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-none border-t border-slate-800 pt-3 transition-all duration-200 whitespace-nowrap truncate ${!sidebarCollapsed ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>Smart Tools</div>}

                                    <Link
                                        href={`/agent/${item.section}`}
                                        onClick={() => setSidebarOpen(false)}
                                        className={`w-full text-left px-3 py-1.5 rounded flex items-center gap-3 transition-colors text-xs font-medium relative ${isActive ? "bg-indigo-500/10 text-indigo-400 font-bold" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"}`}
                                        title={item.label}
                                    >
                                        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 relative">
                                            <span className={`material-symbols-outlined text-[17px] ${isActive ? "text-indigo-400" : "text-slate-400"}`}>{item.icon}</span>
                                            {item.badge && item.badge > 0 && (
                                                <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${isActive ? 'bg-indigo-400' : 'bg-indigo-500'} ${!sidebarCollapsed ? 'hidden' : 'inline-block group-hover/sidebar:hidden'}`} />
                                            )}
                                        </div>
                                        <span className={`flex-1 transition-all duration-200 whitespace-nowrap truncate ${!sidebarCollapsed ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                                            {item.label}
                                        </span>
                                        {item.badge && item.badge > 0 && (
                                            <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-medium transition-all duration-200 shrink-0 ${isActive ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'} ${!sidebarCollapsed ? 'inline-block' : 'hidden group-hover/sidebar:inline-block'}`}>
                                                {item.badge}
                                            </span>
                                        )}
                                    </Link>
                                </React.Fragment>
                            );
                        })}
                    </nav>

                    {/* Agent Session Info Footer */}
                    <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex-shrink-0">
                        <div className="flex items-center gap-3 mb-3 p-1">
                            <img
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                                alt="Avatar"
                                className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 object-cover flex-shrink-0"
                            />
                            <div className={`min-w-0 flex-1 transition-all duration-200 whitespace-nowrap truncate ${!sidebarCollapsed ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                                <p className="text-[12px] font-medium text-slate-200 truncate">{user?.firstName ? `${user.firstName} ${user.lastName || ''}` : 'Agent Partner'}</p>
                                <p className="text-[10px] text-slate-500 capitalize truncate">{agentProfile?.businessName || 'DSA Partner'}</p>
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            className={`w-full px-3 py-2 rounded bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 text-slate-300 border border-slate-700 hover:border-rose-500/30 transition-all text-[11px] font-semibold flex items-center justify-center gap-2 cursor-pointer`}
                            title="Terminate Session"
                        >
                            <span className="material-symbols-outlined text-[16px] flex-shrink-0">logout</span>
                            <span className={`whitespace-nowrap transition-all duration-200 ${!sidebarCollapsed ? 'inline' : 'hidden group-hover/sidebar:inline'}`}>Sign Out</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Application Area */}
            <main className={`flex-1 p-6 min-w-0 flex flex-col h-full overflow-hidden transition-all duration-300 ${sidebarCollapsed ? "lg:pl-[84px]" : "lg:pl-[256px]"}`}>
                <div className="flex-1 bg-white rounded-[3rem] border border-[#6605c7]/5 shadow-[0_20px_50px_rgb(102,5,199,0.06)] overflow-hidden flex flex-col relative">

                    {/* Header bar */}
                    <header className="h-28 px-12 flex justify-between items-center sticky top-0 z-40 bg-white/70 backdrop-blur-3xl border-b border-[#6605c7]/5 flex-shrink-0">
                        <div className="flex items-center gap-10">
                            <button
                                onClick={() => {
                                    if (window.innerWidth >= 1024) {
                                        setSidebarCollapsed(!sidebarCollapsed);
                                    } else {
                                        setSidebarOpen(!sidebarOpen);
                                    }
                                }}
                                className="p-4 text-[#6605c7] hover:bg-[#6605c7]/5 rounded-2xl transition-all"
                                title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                            >
                                <span className="material-symbols-outlined">
                                    {sidebarCollapsed ? "menu_open" : "menu"}
                                </span>
                            </button>
                            <div>
                                <h1 className="text-3xl font-black font-display text-gray-900 capitalize tracking-tighter leading-none mb-1">
                                    {sectionTitle}
                                </h1>
                                <p className="text-[10px] font-bold text-[#6605c7]/40 uppercase tracking-[0.2em]">{agentProfile?.businessName || "VidyaLoan Agency"} | June 2026</p>
                            </div>
                        </div>

                        {/* Support Desk Quick Trigger Info */}
                        <div className="flex items-center gap-8">
                            <div className="hidden lg:flex items-center gap-6 pr-6 border-r border-gray-100">
                                <div className="text-right">
                                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.15em] mb-1">Assigned Staff RM</p>
                                    <p className="text-xs font-black text-[#6605c7]">Neha Sharma</p>
                                </div>
                                <Link href="/agent/chat-staff" className="w-10 h-10 rounded-xl bg-[#6605c7]/5 border border-[#6605c7]/10 flex items-center justify-center text-[#6605c7] hover:bg-[#6605c7] hover:text-white transition-all">
                                    <span className="material-symbols-outlined text-xl">contact_phone</span>
                                </Link>
                            </div>
                            <div className="relative">
                                <button
                                    onClick={() => setNotificationsOpen(!notificationsOpen)}
                                    className="relative w-12 h-12 flex items-center justify-center rounded-2xl bg-[#6605c7]/5 text-[#6605c7] hover:bg-[#6605c7]/10 transition-all border border-[#6605c7]/10"
                                >
                                    <span className="material-symbols-outlined">notifications</span>
                                    {unreadChatCount > 0 && (
                                        <div className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500 border-2 border-white" />
                                    )}
                                </button>

                                {notificationsOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                                        <div className="absolute right-0 mt-4 w-[480px] bg-white rounded-[2rem] shadow-[0_30px_60px_rgb(0,0,0,0.12)] border border-gray-100 overflow-hidden z-50 animate-fade-in-up">
                                            <div className="p-6 border-b border-gray-50 flex justify-between items-end bg-white">
                                                <div>
                                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Notifications</h3>
                                                    <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Last 24 Hours</p>
                                                </div>
                                                <button onClick={() => setNotificationsOpen(false)} className="text-[9px] font-black text-[#6605c7] uppercase tracking-widest hover:underline">
                                                    [Mark All as Read]
                                                </button>
                                            </div>

                                            <div className="max-h-[60vh] overflow-y-auto bg-white">
                                                <div className="p-5 hover:bg-gray-50/80 transition-colors border-b border-gray-50 flex gap-4 items-start cursor-pointer">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[11px] font-black text-gray-900">Priya Sharma: Loan Sanctioned ₹14L by SBI</span>
                                                            <span className="text-[9px] font-bold text-gray-400">13:02</span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 font-bold">Commission: ₹9,800</p>
                                                    </div>
                                                </div>

                                                <div className="p-5 bg-rose-50/30 hover:bg-rose-50/50 transition-colors border-b border-gray-50 flex gap-4 items-start cursor-pointer">
                                                    <div className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[11px] font-black text-gray-900">HDFC Query on Rahul Sinha</span>
                                                            <span className="text-[9px] font-bold text-gray-400">12:31</span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 font-bold mb-2">Deadline: Today 5 PM</p>
                                                        <span className="inline-block px-2.5 py-1 bg-rose-100 text-rose-700 rounded text-[9px] font-black uppercase tracking-widest">[Take Action]</span>
                                                    </div>
                                                </div>

                                                <div className="p-5 hover:bg-gray-50/80 transition-colors border-b border-gray-50 flex gap-4 items-start cursor-pointer">
                                                    <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[11px] font-black text-gray-900">Anjali Raju: Document verified by Staff</span>
                                                            <span className="text-[9px] font-bold text-gray-400">11:47</span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 font-bold">now pending bank submit</p>
                                                    </div>
                                                </div>

                                                <div className="p-5 hover:bg-gray-50/80 transition-colors border-b border-gray-50 flex gap-4 items-start cursor-pointer">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[11px] font-black text-gray-900">System: SBI raised loan limit</span>
                                                            <span className="text-[9px] font-bold text-gray-400">10:00</span>
                                                        </div>
                                                        <button className="text-[10px] text-[#6605c7] font-black uppercase tracking-widest hover:underline mt-1">[Link] Read product update</button>
                                                    </div>
                                                </div>

                                                <div className="p-5 hover:bg-gray-50/80 transition-colors flex gap-4 items-start cursor-pointer">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                                                    <div className="flex-1">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[11px] font-black text-gray-900">Venu Gopal: Loan Disbursed ₹12L</span>
                                                            <span className="text-[9px] font-bold text-gray-400">09:30</span>
                                                        </div>
                                                        <p className="text-[10px] text-gray-500 font-bold">Your commission pending payout</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 bg-gray-50/50 border-t border-gray-50 text-center">
                                                <button onClick={() => setNotificationsOpen(false)} className="text-[10px] font-black text-gray-900 uppercase tracking-widest hover:text-[#6605c7] transition-colors">
                                                    [View All Notifications]
                                                </button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </header>

                    {/* Scrollable modules render window */}
                    <div className={`flex-1 overflow-y-auto relative ${pathname.includes('/chat-') ? 'p-0' : 'p-12 space-y-12'}`}>
                        {/* Decorative mesh background blur */}
                        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#6605c7]/5 rounded-full blur-[150px] pointer-events-none" />
                        {children}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default function AgentLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading, isAuthenticated } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const isAgent = user?.role === 'agent' || user?.role === 'partner_agent' || user?.role === 'admin' || user?.role === 'super_admin';

    useEffect(() => {
        if (!isLoading && pathname !== "/agent/login") {
            if (!isAuthenticated) {
                router.replace("/agent/login?redirect=" + encodeURIComponent(pathname));
            } else if (!isAgent) {
                router.replace("/dashboard");
            }
        }
    }, [isAgent, isLoading, isAuthenticated, router, pathname]);

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-transparent">
                <div className="w-12 h-12 border-4 border-[#6605c7]/20 border-t-[#6605c7] rounded-full animate-spin" />
            </div>
        );
    }

    if (pathname === "/agent/login") return <>{children}</>;

    if (!isAuthenticated || !isAgent) return null;

    return (
        <AgentProvider>
            <AgentLayoutInner>{children}</AgentLayoutInner>
        </AgentProvider>
    );
}
