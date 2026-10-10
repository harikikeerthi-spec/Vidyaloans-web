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
            className={`w-full text-left px-3.5 py-2 rounded-xl flex items-center gap-3 transition-colors text-sm font-semibold relative ${active
                ? "bg-indigo-500/10 text-indigo-400 font-bold"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
        >
            <span className={`material-symbols-outlined text-[19px] flex-shrink-0 ${active ? "text-indigo-400" : "text-slate-400"}`}>
                {icon}
            </span>

            <span className={`flex-1 tracking-wide whitespace-nowrap truncate font-sans transition-all duration-200 ${!collapsed ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                {label}
            </span>

            {(typeof badge === 'number' ? badge > 0 : !!badge) && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 transition-opacity duration-200 ${active
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-700 text-slate-300"
                    } ${!collapsed ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'}`}>
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </Link>
    );
};

export default function ITLayout({ children }: { children: React.ReactNode }) {
    const { user, isStaff, isAdmin, isLoading, logout } = useAuth();
    const { settings: siteSettings } = useSiteSettings();
    const router = useRouter();
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(true);

    const [openTicketsCount, setOpenTicketsCount] = useState(0);
    const [blogsCount, setBlogsCount] = useState(0);

    const displayUser = user || { firstName: "IT", lastName: "Admin", email: "it@vidyaloans.com", role: "it_admin" };

    useEffect(() => {
        if (!isLoading) {
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
    }, [isLoading]);

    const navItems = [
        { icon: "space_dashboard", label: "IT Overview", path: "/it" },
        { icon: "confirmation_number", label: "Support Tickets", path: "/it/tickets", badge: openTicketsCount },
        { icon: "newspaper", label: "Blog CMS", path: "/it/blogs", badge: blogsCount },
        { icon: "add_circle", label: "Create Blog Post", path: "/it/blogs?action=create" },
    ];

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-slate-900">
                <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-slate-50 font-sans">
            {/* IT Dedicated Sidebar with Hover Expand */}
            <aside className={`fixed inset-y-0 left-0 z-50 bg-[#0f172a] text-slate-300 border-r border-slate-800 shadow-xl flex flex-col group/sidebar transition-all duration-300 ease-in-out overflow-hidden ${collapsed ? "w-20 hover:w-64" : "w-64"}`}>
                {/* Header Logo */}
                <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800 flex-shrink-0 gap-3">
                    <Link href="/it" className="flex items-center gap-3 min-w-0">
                        <img
                            src={siteSettings?.logoLightUrl || "/images/vidyaloans-logo-transparent.png"}
                            alt={`${siteSettings?.siteName || "VidyaLoans"} Logo`}
                            className="w-8 h-8 object-contain shrink-0"
                        />
                        <span className={`font-bold text-sm text-white tracking-wide whitespace-nowrap transition-all duration-300 ${!collapsed ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                            {siteSettings?.siteName || "VidyaLoans"}<span className="text-indigo-400"> IT</span>
                        </span>
                    </Link>

                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className={`w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer ${!collapsed ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'}`}
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
                <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex-shrink-0">
                    <div className="flex items-center gap-3 mb-3 p-1">
                        <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                            {displayUser.firstName ? displayUser.firstName[0].toUpperCase() : 'I'}
                        </div>
                        <div className={`min-w-0 flex-1 transition-opacity duration-300 ${!collapsed ? 'opacity-100' : 'opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto'}`}>
                            <p className="text-xs font-bold text-slate-200 truncate">{displayUser.firstName} {displayUser.lastName || ''}</p>
                            <p className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wider">IT Operations</p>
                        </div>
                    </div>
                    <button
                        onClick={() => logout()}
                        className={`w-full px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 text-slate-300 border border-slate-700 hover:border-rose-500/30 transition-all text-xs font-bold flex items-center justify-center gap-2 cursor-pointer ${!collapsed ? 'opacity-100' : 'opacity-0 group-hover/sidebar:opacity-100'}`}
                        title="Sign Out"
                    >
                        <span className="material-symbols-outlined text-[18px]">logout</span>
                        <span className={`whitespace-nowrap transition-all duration-300 ${!collapsed ? 'inline' : 'hidden group-hover/sidebar:inline'}`}>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className={`flex-1 transition-all duration-300 ${collapsed ? "ml-20" : "ml-64"} min-h-screen p-6 md:p-8`}>
                {children}
            </main>
        </div>
    );
}
