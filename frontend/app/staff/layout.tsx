"use client";

import { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { adminApi, staffProfileApi, apiFetch } from "@/lib/api";
import { format } from "date-fns";
import NotificationsPanel from "@/components/staff/NotificationsPanel";
import SupportTicketModal from "@/components/SupportTicketModal";
import { io } from "socket.io-client";

export const StaffLayoutContext = createContext<{
    onlineEmails: string[];
    socket: any;
    unreadChatCount: number;
    fetchBadgeStats: () => Promise<void>;
} | null>(null);

export const useStaffLayout = () => {
    const context = useContext(StaffLayoutContext);
    if (!context) {
        // Fallback for safety if not rendered inside Layout
        return {
            onlineEmails: [],
            socket: null,
            unreadChatCount: 0,
            fetchBadgeStats: async () => { }
        };
    }
    return context;
};

const DASHBOARD_SECTIONS = [
    "overview",
    "incoming_queue",
    "applications",
    "tasks",
    "performance",
    "users",
    "communications",
    "chat_customer",
    "my_profile",
    "onboarding",
] as const;

const getDashboardSection = (section: string | null) =>
    DASHBOARD_SECTIONS.includes(section as any) ? section as typeof DASHBOARD_SECTIONS[number] : "overview";

const NavItem = ({ section, icon, label, badge, active, expanded }: any) => {
    const isActive = active === section;
    const path = section === 'overview' ? '/staff' : `/staff/${section.replace('_', '-')}`;
    return (
        <Link
            href={path}
            title={label}
            className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors text-sm font-semibold ${isActive
                ? 'bg-indigo-500/10 text-indigo-400 font-bold'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
        >
            <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-indigo-400' : 'text-slate-400'}`}>{icon}</span>
            </div>
            <span className={`flex-1 transition-all duration-200 whitespace-nowrap truncate ${expanded ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                {label}
            </span>
            {badge > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 transition-opacity duration-200 ${isActive ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'} ${expanded ? 'inline-flex' : 'hidden group-hover/sidebar:inline-flex'}`}>
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </Link>
    );
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
    const { isStaff, isLoading, isAuthenticated, user, logout, token } = useAuth();
    const { settings: siteSettings } = useSiteSettings();
    const router = useRouter();
    const pathname = usePathname();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [nowTime, setNowTime] = useState<Date>(new Date());
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [incomingCount, setIncomingCount] = useState(0);
    const [pendingCount, setPendingCount] = useState(0);
    const [tasksCount, setTasksCount] = useState(0);
    const [remindersCount, setRemindersCount] = useState(0);

    // F30 Global Search States
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

    // WebSocket state
    const socketRef = useRef<any>(null);
    const [onlineEmails, setOnlineEmails] = useState<string[]>([]);
    const [isSupportOpen, setIsSupportOpen] = useState(false);

    // Authentication and authorization checks
    useEffect(() => {
        if (!isLoading && pathname !== "/staff/login") {
            if (!isAuthenticated) {
                router.replace("/staff/login?redirect=" + encodeURIComponent(pathname));
            } else if (!isStaff) {
                if (user?.role === 'admin' || user?.role === 'super_admin') {
                    router.replace("/admin/dashboard");
                } else {
                    router.replace("/dashboard");
                }
            }
        }
    }, [isStaff, isLoading, isAuthenticated, user, router, pathname]);

    // Update real-time clock
    useEffect(() => {
        const intervalId = setInterval(() => {
            setNowTime(new Date());
        }, 1000);
        return () => clearInterval(intervalId);
    }, []);

    // Determine active section based on Next.js routing path
    const activeSection = useMemo(() => {
        if (pathname.includes("/staff/inbox")) return "inbox";
        if (pathname.includes("/staff/inactive-pipeline")) return "inactive_applications";
        if (pathname.includes("/staff/incoming-queue")) return "incoming_queue";
        if (pathname.includes("/staff/applications")) return "applications";
        if (pathname.includes("/staff/users")) return "users";
        if (pathname.includes("/staff/performance")) return "performance";
        if (pathname.includes("/staff/tasks")) return "tasks";
        if (pathname.includes("/staff/communications")) return "communications";
        if (pathname.includes("/staff/chat-customer")) return "chat_customer";
        if (pathname.includes("/staff/support-tickets")) return "support_tickets";
        if (pathname.includes("/staff/my-profile")) return "my_profile";
        if (pathname.includes("/staff/onboarding")) return "onboarding";
        if (pathname.includes("/staff/dashboard")) return "dashboard";
        return "dashboard";
    }, [pathname]);

    // Fetch dashboard badge counts
    const fetchBadgeStats = useCallback(async () => {
        if (!token) return;
        try {
            const [appStats, conversationsRes]: [any, any] = await Promise.all([
                adminApi.getApplicationStats().catch(() => null),
                apiFetch<any[]>("/api/chat/conversations").catch(() => null),
            ]);

            if (appStats && appStats.data) {
                const statusStats = appStats.data.statusStats || {};
                setIncomingCount(Number(statusStats.submitted || 0));
                setPendingCount(Number(statusStats.pending || 0) + Number(statusStats.processing || 0));
            }

            if (Array.isArray(conversationsRes) && activeSection !== "chat_customer") {
                const totalUnread = conversationsRes.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
                setUnreadChatCount(totalUnread);
            } else if (activeSection === "chat_customer") {
                setUnreadChatCount(0);
            }

            if (typeof window !== "undefined") {
                try {
                    const saved = localStorage.getItem("vidyaloans_staff_tasks");
                    if (saved) {
                        const tasksList = JSON.parse(saved);
                        const activeTasks = Array.isArray(tasksList)
                            ? tasksList.filter((t: any) => !t.completed).length
                            : 0;
                        setTasksCount(activeTasks);
                    } else {
                        setTasksCount(0);
                    }
                } catch {
                    setTasksCount(0);
                }

                // Count follow-up reminders for this staff member
                try {
                    const staffId = user?.id || user?.email || 'default';
                    let count = 0;

                    const followUpKey = `staff_follow_up_dates_${staffId}`;
                    const savedFollowUps = localStorage.getItem(followUpKey);
                    if (savedFollowUps) {
                        try {
                            const followUps = JSON.parse(savedFollowUps);
                            count += Object.keys(followUps).length;
                        } catch (e) {
                            console.error(e);
                        }
                    }

                    if (typeof window !== "undefined") {
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.startsWith(`follow_ups_${staffId}_`)) {
                                const stored = localStorage.getItem(key);
                                if (stored) {
                                    try {
                                        const parsed = JSON.parse(stored);
                                        if (Array.isArray(parsed)) {
                                            count += parsed.filter((fu: any) => fu.status === "pending").length;
                                        }
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }
                            }
                        }
                    }

                    setRemindersCount(count);
                } catch {
                    setRemindersCount(0);
                }
            }
        } catch (err) {
            console.error("Failed to load badge stats:", err);
        }
    }, [token, activeSection, user?.email, user?.id]);

    // Poll badge counts periodically
    useEffect(() => {
        if (isLoading || !isAuthenticated || !isStaff) return;
        fetchBadgeStats();
        const interval = setInterval(fetchBadgeStats, 15000);
        return () => clearInterval(interval);
    }, [isLoading, isAuthenticated, isStaff, fetchBadgeStats]);

    // WebSocket implementation
    useEffect(() => {
        if (!token) return;

        const baseApiUrl = typeof window !== 'undefined' && (window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1'))
            ? 'http://localhost:5000'
            : (process.env.NEXT_PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000'));
        const socketUrl = baseApiUrl.endsWith('/api')
            ? baseApiUrl.replace('/api', '/chat')
            : `${baseApiUrl.replace(/\/$/, '')}/chat`;

        const socketInstance = io(socketUrl, {
            auth: { token }
        });

        socketRef.current = socketInstance;

        socketInstance.on('connect', () => {
            socketInstance.emit('request_presence');
            fetchBadgeStats();
        });

        socketInstance.on('presence_update', (emails: string[]) => {
            if (Array.isArray(emails)) {
                setOnlineEmails(emails);
            }
        });

        socketInstance.on('conversation_updated', () => {
            fetchBadgeStats();
        });

        socketInstance.on('new_message', () => {
            fetchBadgeStats();
        });

        return () => {
            socketInstance.disconnect();
        };
    }, [token, fetchBadgeStats]);

    // Global Search Logic
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

    const sectionTitles: Record<string, string> = {
        overview: 'Staff Dashboard Overview',
        incoming_queue: 'Incoming Applications Queue',
        applications: 'Loan Applications Management',
        inactive_applications: 'Archived Applications Vault',
        tasks: 'Reminders & Tasks',
        performance: 'Performance Analytics',
        users: 'Bank & Staff Members',
        communications: 'Outreach Center',
        inbox: 'Support & Staff Email Inbox',
        support_tickets: 'Support Desk Center',
        my_profile: 'My Staff Profile',
        chat_customer: 'Live Customer Support Chat',
        onboarding: 'Applicant Onboarding',
    };

    const navItems = [
        { section: "dashboard", path: "/staff/dashboard", icon: "dashboard", label: "Dashboard", badge: 0 },
        { section: "incoming_queue", path: "/staff/incoming-queue", icon: "move_to_inbox", label: "Incoming Queue", badge: incomingCount },
        { section: "applications", path: "/staff/applications", icon: "folder_open", label: "Active Pipeline", badge: pendingCount },
        { section: "inactive_applications", path: "/staff/inactive-pipeline", icon: "archive", label: "Inactive Pipeline", badge: 0 },
        { section: "users", path: "/staff/users", icon: "group", label: "Bank & Staff Members", badge: 0 },
        { section: "performance", path: "/staff/performance", icon: "insights", label: "Performance", badge: 0 },
        { section: "tasks", path: "/staff/tasks", icon: "notifications_active", label: "Reminders", badge: remindersCount },
        { section: "inbox", path: "/staff/inbox", icon: "all_inbox", label: "Email Inbox", badge: 0 },
        { section: "communications", path: "/staff/communications", icon: "mail", label: "Outreach Center", badge: 0 },
        { section: "chat_customer", path: "/staff/chat-customer", icon: "support_agent", label: "Support Chat", badge: unreadChatCount },
        { section: "support_tickets", path: "/staff/support-tickets", icon: "confirmation_number", label: "Support Tickets", badge: 0 },
        { section: "my_profile", path: "/staff/my-profile", icon: "badge", label: "My Profile", badge: 0 },
    ];

    const contextValue = useMemo(() => ({
        onlineEmails,
        socket: socketRef.current,
        unreadChatCount,
        fetchBadgeStats
    }), [onlineEmails, unreadChatCount, fetchBadgeStats]);

    const handleLogout = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        try {
            await logout();
        } catch (err) {
            console.error("Logout error:", err);
        }
        router.push("/staff/login");
    };

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#f8fafc]">
                <div className="w-12 h-12 border-4 border-[#0A2540]/20 border-t-[#4F46E5] rounded-full animate-spin" />
            </div>
        );
    }

    if (pathname === "/staff/login") return <>{children}</>;

    return (
        <StaffLayoutContext.Provider value={contextValue}>
            <div className="staff-dashboard-shell h-screen overflow-hidden flex bg-[#f8fafc] text-slate-900 text-sm font-sans" style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
                {/* Mobile overlay */}
                {sidebarOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
                )}

                {/* Sidebar — Admin Dashboard UI Style */}
                <aside className={`fixed inset-y-0 left-0 z-50 bg-[#0f172a] text-slate-300 flex flex-col py-0 px-0
                    shadow-xl border-r border-slate-800 group/sidebar
                    transition-all duration-300 ease-in-out overflow-hidden
                    ${sidebarOpen
                        ? 'w-[240px] translate-x-0'
                        : 'w-[68px] lg:translate-x-0 -translate-x-full hover:w-[240px]'
                    }`}>

                    {/* Header Logo */}
                    <div className="h-14 px-4 flex items-center border-b border-slate-800 flex-shrink-0 gap-2.5">
                        <img
                            src={siteSettings?.logoLightUrl || "/images/vidyaloans-logo-transparent.png"}
                            alt={`${siteSettings?.siteName || "VidyaLoans"} Logo`}
                            className="w-7 h-7 object-contain flex-shrink-0"
                        />
                        <span className={`font-semibold text-[14px] text-white tracking-wide whitespace-nowrap transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                            {siteSettings?.siteName || "VidyaLoans"}<span className="text-indigo-400"> Staff</span>
                        </span>
                    </div>

                    {/* Nav */}
                    <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
                        <div className={`px-3 mb-2 mt-1 text-[14px] font-semibold text-slate-500 uppercase tracking-widest leading-none whitespace-nowrap transition-all duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'}`}>Menu</div>
                        {navItems.map(item => (
                            <NavItem key={item.section} {...item} active={activeSection} expanded={sidebarOpen} />
                        ))}
                    </nav>

                    {/* Avatar + Sign-out Footer */}
                    <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex-shrink-0">
                        <div className="flex items-center gap-3 mb-3 p-1">
                            <img
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                                alt="Avatar"
                                className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 object-cover flex-shrink-0"
                            />
                            <div className={`min-w-0 flex-1 transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                                <p className="text-[12px] font-medium text-slate-200 truncate">{user?.firstName ? `${user.firstName} ${user.lastName || ''}` : 'Staff Member'}</p>
                                <p className="text-[10px] text-slate-500 capitalize truncate">{user?.role?.replace('_', ' ') || 'Staff'}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className={`w-full px-3 py-2 rounded bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 text-slate-300 border border-slate-700 hover:border-rose-500/30 transition-all text-[11px] font-semibold flex items-center justify-center gap-2 ${sidebarOpen ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'}`}
                            title="Sign Out"
                        >
                            <span className="material-symbols-outlined text-[16px]">logout</span>
                            <span className={`whitespace-nowrap transition-all duration-300 ${sidebarOpen ? 'inline' : 'hidden group-hover/sidebar:inline'}`}>Sign Out</span>
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#f8fafc] transition-all duration-300 ${sidebarOpen ? 'lg:pl-[240px]' : 'lg:pl-[68px]'}`}>
                    {/* Top Header Navbar */}
                    <header className="h-[60px] bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-40 flex-shrink-0 shadow-sm">
                        {/* Left: Section Title */}
                        <div className="flex flex-col justify-center">
                            <span className="text-[14px] font-extrabold text-[#4F46E5] uppercase tracking-widest leading-none mb-1 font-mono">VidyaLoans</span>
                            <h1 className="text-[20px] font-bold text-[#0A2540] tracking-tight leading-tight">
                                {sectionTitles[activeSection] || activeSection}
                            </h1>
                        </div>

                        {/* Center: Global Search */}
                        <div className="relative hidden md:block w-[320px] lg:w-[420px]">
                            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => handleGlobalSearch(e.target.value)}
                                onFocus={() => { if (searchResults.length > 0) setShowSearchSuggestions(true); }}
                                placeholder="Search email, phone, student ID, application ID..."
                                className="pl-10 pr-10 py-2 bg-slate-100/70 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] focus:bg-white w-full transition-all text-slate-800 placeholder:text-slate-400 shadow-none focus:shadow-sm"
                            />
                            {isSearching && (
                                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-slate-300 border-t-[#4F46E5] rounded-full animate-spin" />
                            )}
                            {showSearchSuggestions && searchResults.length > 0 && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowSearchSuggestions(false)} />
                                    <div className="absolute left-0 mt-2 w-[440px] max-h-[320px] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 space-y-1">
                                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1.5 border-b border-slate-100">
                                            Found {searchResults.length} Results
                                        </div>
                                        {searchResults.map(app => (
                                            <div
                                                key={app.id}
                                                onClick={() => {
                                                    setShowSearchSuggestions(false);
                                                    setSearchQuery("");
                                                    setSearchResults([]);
                                                    router.push(`/staff/users/${app.userId}`);
                                                }}
                                                className="p-3 hover:bg-slate-50 rounded-xl flex items-center justify-between cursor-pointer transition-colors group"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-slate-900 group-hover:text-[#4F46E5] truncate">{app.firstName} {app.lastName}</p>
                                                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5 truncate">{app.applicationNumber || app.id} • Student: {app.userId}</p>
                                                    <p className="text-[9.5px] text-slate-400 font-medium truncate mt-0.5">{app.email || "—"} • {app.phone || "—"}</p>
                                                </div>
                                                <div className="text-right flex-shrink-0 ml-3">
                                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${['approved', 'sanctioned', 'disbursed'].includes(app.status?.toLowerCase())
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : ['rejected', 'cancelled'].includes(app.status?.toLowerCase())
                                                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}>
                                                        {app.status || 'Draft'}
                                                    </span>
                                                    <p className="text-[10px] text-slate-700 mt-1 font-bold">₹{(app.amount || 0).toLocaleString('en-IN')}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Right: Notifications + Time + User Profile */}
                        <div className="flex items-center gap-3.5">
                            {/* Real-time IST Clock */}
                            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                                <span className="text-[16px] text-black font-mono">
                                    {format(nowTime, 'MMM dd, HH:mm:ss')}
                                </span>
                            </div>

                            <NotificationsPanel
                                staffId={user?.id}
                                maxDisplay={8}
                                showUnreadBadge={true}
                            />

                            <div className="h-5 w-px bg-slate-200" />

                            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => router.push('/staff/my-profile')}>
                                <img
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`}
                                    alt="Avatar"
                                    className="w-8 h-8 rounded-full bg-[#0A2540] border border-indigo-200 object-cover shadow-sm"
                                />
                                <div className="hidden sm:flex flex-col">
                                    <span className="text-[12px] font-bold text-[#0A2540] leading-none">{user?.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName[0] + '.' : ''}` : 'Staff'}</span>
                                    <span className="text-[10px] font-medium text-slate-400 capitalize leading-none mt-0.5">{user?.role?.replace('_', ' ') || 'Staff'}</span>
                                </div>
                            </div>

                            <button
                                onClick={handleLogout}
                                title="Sign Out"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border-0 bg-transparent cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[20px]">logout</span>
                            </button>
                        </div>
                    </header>

                    <div className={`staff-dashboard-body flex-1 ${(activeSection.startsWith('chat_') || activeSection === 'onboarding') ? 'p-0 overflow-hidden' : 'p-6 overflow-y-auto space-y-6 custom-scrollbar'} bg-[#f8fafc]`}>
                        {children}
                    </div>
                </main>
            </div>
        </StaffLayoutContext.Provider>
    );
}
