"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { supportApi, blogApi } from "@/lib/api";

const NavItem = ({ icon, label, path, active, collapsed, badge }: any) => {
    return (
        <Link
            href={path}
            title={label}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center gap-3 transition-all text-xs font-bold relative ${active
                ? "bg-gradient-to-r from-[#6605c7]/10 to-purple-500/10 text-[#6605c7] border border-[#6605c7]/20 shadow-2xs"
                : "text-slate-600 hover:text-[#6605c7] hover:bg-purple-50/60"
                }`}
        >
            <span className={`material-symbols-outlined text-[19px] flex-shrink-0 ${active ? "text-[#6605c7]" : "text-slate-500"}`}>
                {icon}
            </span>

            <span className={`flex-1 tracking-wide whitespace-nowrap truncate font-sans transition-all duration-200 ${!collapsed ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                {label}
            </span>

            {(typeof badge === 'number' ? badge > 0 : !!badge) && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 transition-opacity duration-200 ${active
                    ? "bg-[#6605c7] text-white shadow-2xs"
                    : "bg-slate-100 text-slate-600"
                    } ${!collapsed ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'}`}>
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </Link>
    );
};

export default function ITLayout({ children }: { children: React.ReactNode }) {
    const { user, isStaff, isAdmin, isAuthenticated, isLoading, logout } = useAuth();
    const { settings: siteSettings } = useSiteSettings();
    const router = useRouter();
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(true);

    const [openTicketsCount, setOpenTicketsCount] = useState(0);
    const [blogsCount, setBlogsCount] = useState(0);

    const isItAuthorized = Boolean(
        user &&
        (user.role === "it" ||
            user.role === "it_admin" ||
            user.role === "admin" ||
            user.role === "super_admin")
    );

    // Route guard: Redirect unauthorized visitors to /it/login
    useEffect(() => {
        if (!isLoading && pathname !== "/it/login") {
            if (!isAuthenticated || !isItAuthorized) {
                router.replace("/it/login");
            }
        }
    }, [isLoading, isAuthenticated, isItAuthorized, router, pathname]);

    useEffect(() => {
        if (!isLoading && isAuthenticated && isItAuthorized) {
            supportApi.getTickets()
                .then((res: any) => {
                    const list = res.data || [];
                    const open = list.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length;
                    setOpenTicketsCount(open);
                })
                .catch(() => { });

            blogApi.getAll(1, 100)
                .then((res: any) => {
                    setBlogsCount((res.data || []).length);
                })
                .catch(() => { });
        }
    }, [isLoading, isAuthenticated, isItAuthorized]);

    const navItems = [
        { icon: "space_dashboard", label: "IT Overview", path: "/it" },
        { icon: "confirmation_number", label: "Support Tickets", path: "/it/tickets", badge: openTicketsCount },
        { icon: "newspaper", label: "Blog CMS", path: "/it/blogs", badge: blogsCount },
        { icon: "add_circle", label: "Create Blog Post", path: "/it/blogs?action=create" },
    ];

    // If on IT login page, render clean login view without the dashboard shell
    if (pathname === "/it/login") {
        return <>{children}</>;
    }

    if (isLoading || (!isAuthenticated || !isItAuthorized)) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#f8f9ff] bg-mesh-gradient">
                <div className="w-12 h-12 border-4 border-[#6605c7]/20 border-t-[#6605c7] rounded-full animate-spin" />
            </div>
        );
    }

    const displayUser = user || { firstName: "IT", lastName: "Member", email: "it@vidyaloans.com", role: "it" };

    const handleSignOut = async () => {
        await logout();
        if (typeof window !== "undefined") {
            localStorage.removeItem("itAccessToken");
            localStorage.removeItem("itRefreshToken");
            localStorage.removeItem("itUserEmail");
            localStorage.removeItem("itUserId");
            localStorage.removeItem("itAuthUser");
            document.cookie = "itAccessToken=; path=/; max-age=0;";
        }
        router.replace("/it/login");
    };

    return (
        <div className="min-h-screen flex bg-[#f8f9ff] font-sans relative overflow-x-hidden bg-mesh-gradient text-slate-900">
            {/* Ambient Background Glows matching user dashboard */}
            <div className="fixed -top-32 -left-32 w-96 h-96 bg-[#6605c7]/10 rounded-full blur-[100px] pointer-events-none z-0" />
            <div className="fixed top-1/3 -right-32 w-96 h-96 bg-amber-400/10 rounded-full blur-[100px] pointer-events-none z-0" />
            <div className="fixed -bottom-32 left-1/3 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none z-0" />

            {/* IT Dedicated Sidebar with Hover Expand */}
            <aside className={`fixed inset-y-0 left-0 z-50 bg-white/90 backdrop-blur-xl border-r border-purple-100/80 shadow-[0_4px_30px_rgba(102,5,199,0.04)] flex flex-col group/sidebar transition-all duration-300 ease-in-out overflow-hidden ${collapsed ? "w-20 hover:w-64" : "w-64"}`}>
                {/* Header Logo */}
                <div className="h-16 px-4 flex items-center justify-between border-b border-purple-100/70 flex-shrink-0 gap-3">
                    <Link href="/it" className="flex items-center gap-3 min-w-0">
                        <img
                            src={siteSettings?.logoLightUrl || "/images/vidyaloans-logo-transparent.png"}
                            alt={`${siteSettings?.siteName || "VidyaLoans"} Logo`}
                            className="w-8 h-8 object-contain shrink-0"
                        />
                        <span className={`font-extrabold text-sm text-slate-900 tracking-tight whitespace-nowrap transition-all duration-300 ${!collapsed ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                            {siteSettings?.siteName || "VidyaLoans"}<span className="text-[#6605c7]"> IT</span>
                        </span>
                    </Link>

                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={`w-7 h-7 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#6605c7] border border-purple-100/80 flex items-center justify-center transition-all cursor-pointer ${!collapsed ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'}`}
                        title={collapsed ? "Pin Sidebar Open" : "Collapse Sidebar"}
                    >
                        <span className="material-symbols-outlined text-[18px]">
                            {collapsed ? "chevron_right" : "chevron_left"}
                        </span>
                    </button>
                </div>

                {/* Navigation Section */}
                <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => (
                        <NavItem
                            key={item.path}
                            {...item}
                            active={pathname === item.path || (item.path !== "/it" && pathname.startsWith(item.path))}
                            collapsed={collapsed}
                        />
                    ))}
                </nav>

                {/* Profile Footer */}
                <div className="p-3.5 border-t border-purple-100/70 bg-white/70 flex-shrink-0">
                    <div className="flex items-center gap-3 mb-3 p-1">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#6605c7] to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shrink-0 shadow-sm shadow-purple-500/20">
                            {displayUser.firstName ? displayUser.firstName[0].toUpperCase() : 'I'}
                        </div>
                        <div className={`min-w-0 flex-1 transition-opacity duration-300 ${!collapsed ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                            <p className="text-xs font-bold text-slate-900 truncate">{displayUser.firstName} {displayUser.lastName || ''}</p>
                            <p className="text-[10px] text-[#6605c7] font-bold uppercase tracking-wider">IT Operations</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className={`w-full px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200/80 hover:border-rose-200 transition-all text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-2xs ${!collapsed ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'}`}
                        title="Sign Out"
                    >
                        <span className="material-symbols-outlined text-[17px]">logout</span>
                        <span className={`whitespace-nowrap transition-all duration-300 ${!collapsed ? 'inline' : 'hidden group-hover/sidebar:inline'}`}>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className={`flex-1 transition-all duration-300 ${collapsed ? "ml-20" : "ml-64"} min-h-screen relative z-10 flex flex-col`}>
                {/* Top Navigation Bar matching user and bank dashboards */}
                <header className="sticky top-0 z-40 bg-white/75 backdrop-blur-xl border-b border-purple-100/60 px-6 py-3.5 flex items-center justify-between shadow-[0_2px_15px_rgba(102,5,199,0.02)]">
                    <div className="flex items-center gap-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-[11px] font-bold uppercase tracking-wider shadow-2xs">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            System Operational
                        </div>
                        <span className="hidden sm:inline-block text-xs text-slate-300 font-medium">&bull;</span>
                        <span className="hidden sm:inline-block text-xs font-semibold text-slate-600">
                            IT Operations Command Center
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/"
                            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-100 hover:bg-purple-50/50 text-slate-600 hover:text-[#6605c7] text-xs font-semibold transition-all"
                            title="View Public Site"
                        >
                            <span className="material-symbols-outlined text-[16px]">public</span>
                            <span>Public Site</span>
                        </Link>

                        {/* User profile pill matching user dashboard navbar */}
                        <div className="flex items-center gap-2.5 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-purple-500/10 shadow-[0_4px_16px_rgba(102,5,199,0.06)] shrink-0 select-none">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#6605c7] to-indigo-600 text-white font-extrabold text-[11px] flex items-center justify-center shadow-2xs">
                                {(displayUser.firstName || "I")[0].toUpperCase()}
                            </div>
                            <span className="text-xs font-bold text-slate-800">
                                {displayUser.firstName} {displayUser.lastName || ""}
                            </span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-6 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
