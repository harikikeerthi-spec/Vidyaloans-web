"use client";

import { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { format } from "date-fns";

const NavItem = ({ href, icon, label, badge, active, expanded }: any) => (
    <Link
        href={href}
        title={label}
        className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors text-sm font-semibold ${
            active
                ? "bg-indigo-500/10 text-indigo-400 font-bold"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        }`}
    >
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
            <span className={`material-symbols-outlined text-[18px] ${active ? "text-indigo-400" : "text-slate-400"}`}>
                {icon}
            </span>
        </div>
        <span
            className={`flex-1 transition-all duration-200 whitespace-nowrap truncate ${
                expanded ? "opacity-100" : "opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto"
            }`}
        >
            {label}
        </span>
        {badge !== undefined && (
            <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 transition-opacity duration-200 ${
                    active ? "bg-indigo-500 text-white" : "bg-slate-700 text-slate-300"
                } ${expanded ? "inline-flex" : "hidden group-hover/sidebar:inline-flex"}`}
            >
                {badge}
            </span>
        )}
    </Link>
);

const SECTION_TITLES: Record<string, string> = {
    "/analyst": "Executive Overview",
    "/analyst/dashboard": "Executive Overview",
    "/analyst/funnel": "Loan Conversion Funnel",
    "/analyst/banks": "Lenders & Bank SLA",
    "/analyst/cohorts": "Intake & Student Cohorts",
    "/analyst/forecasts": "Predictive Forecasts",
    "/analyst/reports": "MIS Reports & Exports",
};

export default function AnalystLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading, logout } = useAuth();
    const { settings: siteSettings } = useSiteSettings();
    const router = useRouter();
    const pathname = usePathname();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState("");
    const [dateRange, setDateRange] = useState("Last 30 Days");

    useEffect(() => {
        setCurrentTime(format(new Date(), "MMM dd, HH:mm:ss"));
        const interval = setInterval(() => {
            setCurrentTime(format(new Date(), "MMM dd, HH:mm:ss"));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const navLinks = useMemo(() => [
        { href: "/analyst/dashboard", icon: "insights", label: "Executive Overview" },
        { href: "/analyst/funnel", icon: "filter_alt", label: "Loan Conversion Funnel" },
        { href: "/analyst/banks", icon: "account_balance", label: "Lenders & Bank SLA", badge: "7 Banks" },
        { href: "/analyst/cohorts", icon: "group_work", label: "Intake & Cohorts" },
        { href: "/analyst/forecasts", icon: "trending_up", label: "Predictive Forecasts" },
        { href: "/analyst/reports", icon: "table_chart", label: "MIS Reports & Exports" },
    ], []);

    const isCurrentActive = (path: string) => {
        if (path === "/analyst/dashboard" && (pathname === "/analyst" || pathname === "/analyst/dashboard")) return true;
        return pathname.startsWith(path);
    };

    const currentTitle = SECTION_TITLES[pathname] || "Analyst Intelligence Panel";

    const handleLogout = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        try {
            await logout();
        } catch (err) {
            console.error("Logout error:", err);
        }
        router.push("/admin/login");
    };

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-[#f8fafc]">
                <div className="w-12 h-12 border-4 border-[#0A2540]/20 border-t-[#4F46E5] rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div
            className="analyst-dashboard-shell h-screen overflow-hidden flex bg-[#f8fafc] text-slate-900 text-sm font-sans"
            style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
        >
            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar — Admin / Staff UI Style */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 bg-[#0f172a] text-slate-300 flex flex-col py-0 px-0
                    shadow-xl border-r border-slate-800 group/sidebar
                    transition-all duration-300 ease-in-out overflow-hidden
                    ${sidebarOpen ? "w-[240px] translate-x-0" : "w-[68px] lg:translate-x-0 -translate-x-full hover:w-[240px]"}`}
            >
                {/* Header Logo */}
                <div className="h-14 px-4 flex items-center border-b border-slate-800 flex-shrink-0 gap-2.5">
                    <img
                        src={siteSettings?.logoLightUrl || "/images/vidyaloans-logo-transparent.png"}
                        alt={`${siteSettings?.siteName || "VidyaLoans"} Logo`}
                        className="w-7 h-7 object-contain flex-shrink-0"
                    />
                    <span
                        className={`font-semibold text-[14px] text-white tracking-wide whitespace-nowrap transition-all duration-300 ${
                            sidebarOpen ? "opacity-100" : "opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto"
                        }`}
                    >
                        {siteSettings?.siteName || "VidyaLoans"}<span className="text-indigo-400"> Analyst</span>
                    </span>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
                    <div
                        className={`px-3 mb-2 mt-1 text-[11px] font-semibold text-slate-500 uppercase tracking-widest leading-none whitespace-nowrap transition-all duration-300 ${
                            sidebarOpen ? "opacity-100" : "opacity-0 group-hover/sidebar:opacity-100"
                        }`}
                    >
                        Analytics Menu
                    </div>
                    {navLinks.map((item) => (
                        <NavItem
                            key={item.href}
                            {...item}
                            active={isCurrentActive(item.href)}
                            expanded={sidebarOpen}
                        />
                    ))}

                    <div
                        className={`px-3 mt-6 mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-widest leading-none whitespace-nowrap transition-all duration-300 ${
                            sidebarOpen ? "opacity-100" : "opacity-0 group-hover/sidebar:opacity-100"
                        }`}
                    >
                        Portals Switch
                    </div>
                    <Link
                        href="/admin"
                        title="Admin Dashboard"
                        className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    >
                        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-[18px] text-indigo-400">admin_panel_settings</span>
                        </div>
                        <span
                            className={`flex-1 transition-all duration-200 whitespace-nowrap truncate ${
                                sidebarOpen ? "opacity-100" : "opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto"
                            }`}
                        >
                            Admin Portal
                        </span>
                    </Link>
                    <Link
                        href="/staff"
                        title="Staff CRM"
                        className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    >
                        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-[18px] text-blue-400">support_agent</span>
                        </div>
                        <span
                            className={`flex-1 transition-all duration-200 whitespace-nowrap truncate ${
                                sidebarOpen ? "opacity-100" : "opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto"
                            }`}
                        >
                            Staff CRM
                        </span>
                    </Link>
                    <Link
                        href="/marketing"
                        title="Marketing Hub"
                        className="w-full text-left px-3 py-2 rounded-xl flex items-center gap-3 transition-colors text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    >
                        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                            <span className="material-symbols-outlined text-[18px] text-purple-400">campaign</span>
                        </div>
                        <span
                            className={`flex-1 transition-all duration-200 whitespace-nowrap truncate ${
                                sidebarOpen ? "opacity-100" : "opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto"
                            }`}
                        >
                            Marketing Hub
                        </span>
                    </Link>
                </nav>

                {/* Avatar + Sign-out Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex-shrink-0">
                    <div className="flex items-center gap-3 mb-3 p-1">
                        <img
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || "analyst"}`}
                            alt="Avatar"
                            className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 object-cover flex-shrink-0"
                        />
                        <div
                            className={`min-w-0 flex-1 transition-opacity duration-300 ${
                                sidebarOpen ? "opacity-100" : "opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto"
                            }`}
                        >
                            <p className="text-[12px] font-medium text-slate-200 truncate">
                                {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : (user?.email?.split("@")[0] || "Analyst Officer")}
                            </p>
                            <p className="text-[10px] text-indigo-400 font-mono truncate">Credit & Risk Analytics</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className={`w-full px-3 py-2 rounded bg-slate-800 hover:bg-rose-500/10 hover:text-rose-400 text-slate-300 border border-slate-700 hover:border-rose-500/30 transition-all text-[11px] font-semibold flex items-center justify-center gap-2 ${
                            sidebarOpen ? "opacity-100" : "opacity-0 group-hover/sidebar:opacity-100"
                        }`}
                        title="Sign Out"
                    >
                        <span className="material-symbols-outlined text-[16px]">logout</span>
                        <span className={`whitespace-nowrap transition-all duration-300 ${sidebarOpen ? "inline" : "hidden group-hover/sidebar:inline"}`}>
                            Sign Out
                        </span>
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main
                className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[#f8fafc] transition-all duration-300 ${
                    sidebarOpen ? "lg:pl-[240px]" : "lg:pl-[68px]"
                }`}
            >
                {/* Top Header Navbar — exact Admin/Staff styling */}
                <header className="h-[60px] bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-40 flex-shrink-0 shadow-sm">
                    {/* Left: Section Title */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="lg:hidden p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                            <span className="material-symbols-outlined text-[20px]">menu</span>
                        </button>
                        <div className="flex flex-col justify-center">
                            <span className="text-[12px] font-extrabold text-[#4F46E5] uppercase tracking-widest leading-none mb-1 font-mono">
                                VidyaLoans
                            </span>
                            <h1 className="text-[18px] sm:text-[20px] font-bold text-[#0A2540] tracking-tight leading-tight">
                                {currentTitle}
                            </h1>
                        </div>
                    </div>

                    {/* Right: Live Badge, Clock, Date Range, Actions */}
                    <div className="flex items-center gap-3">
                        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Live Telemetry</span>
                        </div>

                        {currentTime && (
                            <div className="hidden lg:block text-xs text-slate-500 font-mono">
                                {currentTime}
                            </div>
                        )}

                        <select
                            value={dateRange}
                            onChange={(e) => setDateRange(e.target.value)}
                            className="px-3 py-1.5 bg-slate-100/80 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#4F46E5] transition-colors cursor-pointer"
                        >
                            <option value="Today">Today</option>
                            <option value="Last 7 Days">Last 7 Days</option>
                            <option value="Last 30 Days">Last 30 Days</option>
                            <option value="This Quarter">This Quarter (Q3)</option>
                            <option value="Year to Date">Year to Date (YTD)</option>
                        </select>

                        <Link
                            href="/analyst/reports"
                            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#4F46E5] hover:bg-indigo-600 text-white text-xs font-semibold shadow-sm transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">download</span>
                            <span>Export MIS</span>
                        </Link>

                        <img
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email || "analyst"}`}
                            alt="Avatar"
                            className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 object-cover"
                        />
                    </div>
                </header>

                {/* Page Content Viewport */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {children}
                </div>
            </main>
        </div>
    );
}
