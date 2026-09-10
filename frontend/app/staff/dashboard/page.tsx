"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { adminApi, staffProfileApi, mailApi } from "@/lib/api";
import ActivityLogWidget from "@/components/staff/ActivityLogWidget";

const convertToIST = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    let cleanDs = dateStr;
    if (typeof cleanDs === 'string' && !cleanDs.includes('Z') && !cleanDs.includes('+')) {
        if (cleanDs.includes('T') || cleanDs.includes(':')) {
            const formatted = cleanDs.replace(' ', 'T');
            cleanDs = formatted.includes('Z') ? formatted : formatted + 'Z';
        }
    }
    return new Date(cleanDs);
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
            hour12: true,
            timeZone: "Asia/Kolkata"
        });
    } catch {
        return "";
    }
};

const getFormattedDateHeader = (dateStr: string): string => {
    if (!dateStr) return "Earlier Activities";
    try {
        const date = convertToIST(dateStr);
        const now = new Date();
        
        const dDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffDays = Math.floor((dNow.getTime() - dDate.getTime()) / (1000 * 60 * 60 * 24));

        const formattedDate = date.toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata"
        });

        if (diffDays === 0) return `Today — ${formattedDate}`;
        if (diffDays === 1) return `Yesterday — ${formattedDate}`;
        if (diffDays > 1 && diffDays < 7) {
            const dayName = date.toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" });
            return `${dayName} — ${formattedDate}`;
        }
        return formattedDate;
    } catch {
        return "Earlier Activities";
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

const StatCard = ({ label, value, icon, color, trend, loading, hint, badge, ...props }: any) => {
    let colorScheme = {
        iconBg: 'bg-[#4F46E5]/10',
        iconText: 'text-[#4F46E5]',
        valueText: 'text-[#0A2540]',
        trendBg: 'bg-slate-100/80',
        trendText: 'text-slate-600'
    };

    if (color?.includes('blue')) {
        colorScheme = { iconBg: 'bg-blue-50/80 border border-blue-100', iconText: 'text-blue-600', valueText: 'text-[#0A2540]', trendBg: 'bg-blue-50/60', trendText: 'text-blue-700' };
    } else if (color?.includes('amber')) {
        colorScheme = { iconBg: 'bg-amber-50/80 border border-amber-100', iconText: 'text-amber-600', valueText: 'text-[#0A2540]', trendBg: 'bg-amber-50/80', trendText: 'text-amber-700' };
    } else if (color?.includes('green') || color?.includes('emerald')) {
        colorScheme = { iconBg: 'bg-emerald-50/80 border border-emerald-100', iconText: 'text-emerald-600', valueText: 'text-[#0A2540]', trendBg: 'bg-emerald-50/80', trendText: 'text-emerald-700' };
    } else if (color?.includes('purple') || color?.includes('indigo')) {
        colorScheme = { iconBg: 'bg-indigo-50/80 border border-indigo-100', iconText: 'text-[#4F46E5]', valueText: 'text-[#0A2540]', trendBg: 'bg-indigo-50/60', trendText: 'text-[#4F46E5]' };
    }

    return (
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-sm hover:shadow-md transition-all relative overflow-hidden group hover:border-[#4F46E5]/40 flex flex-col justify-between min-h-[140px]">
            {color?.includes('amber') && (
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
            )}

            <div className="flex justify-between items-start mb-2 relative z-10">
                <span className="text-slate-500 text-[11px] font-bold uppercase tracking-wider font-sans">{label}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colorScheme.iconBg} ${colorScheme.iconText} shadow-xs`}>
                    <span className="material-symbols-outlined text-[18px]">{icon}</span>
                </div>
            </div>

            <div className="mt-1 mb-3 relative z-10 flex items-center gap-3">
                <div className={`text-[36px] font-extrabold tracking-tight leading-none ${colorScheme.valueText}`}>
                    {loading ? <span className="h-9 bg-slate-100 animate-pulse rounded-lg block w-20" /> : value ?? "—"}
                </div>
                {badge && !loading && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-amber-700">{badge}</span>
                    </div>
                )}
            </div>

            <div className="mt-auto relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    {trend !== undefined && !loading && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${colorScheme.trendBg} ${colorScheme.trendText}`}>
                            {typeof trend === 'string' && (trend.includes('⏳') || trend.includes('📈')) ? null : (
                                <span className="material-symbols-outlined text-[13px]">
                                    {Number(trend) >= 0 ? 'trending_up' : 'trending_down'}
                                </span>
                            )}
                            {trend}
                        </div>
                    )}
                    {hint && !loading && (
                        <span className="text-[10px] font-semibold text-slate-400 border-l border-slate-200 pl-2 ml-1">
                            {hint}
                        </span>
                    )}
                </div>
                {props.footerAction && !loading && (
                    <button onClick={props.onFooterActionClick} className="text-[10px] font-bold text-slate-500 hover:text-[#4F46E5] transition-colors flex items-center gap-1">
                        {props.footerAction}
                    </button>
                )}
            </div>
        </div>
    );
};

export default function StaffDashboardPage() {
    const router = useRouter();
    const { user, token } = useAuth();
    const [view, setView] = useState<"overview" | "activities">("overview");

    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>({});
    const [todayStats, setTodayStats] = useState<any>(null);
    const [mailStats, setMailStats] = useState<{
        total: number;
        unread: number;
        read: number;
        sent: number;
        drafts: number;
        starred: number;
        spam: number;
        trash: number;
    }>({
        total: 0,
        unread: 0,
        read: 0,
        sent: 0,
        drafts: 0,
        starred: 0,
        spam: 0,
        trash: 0,
    });

    // Audit Trail State
    const [fullActivities, setFullActivities] = useState<any[]>([]);
    const [activitiesLoading, setActivitiesLoading] = useState(false);
    const [activitiesTotal, setActivitiesTotal] = useState(0);
    const [activitiesPage, setActivitiesPage] = useState(1);
    const [activitiesFilter, setActivitiesFilter] = useState("all");
    const [activitiesSearch, setActivitiesSearch] = useState("");
    const [activitiesStaffId, setActivitiesStaffId] = useState("me");
    const [staffMembersList, setStaffMembersList] = useState<any[]>([]);
    const [activitiesLimit, setActivitiesLimit] = useState(100);

    const groupedActivities = useMemo(() => {
        const groups: { [header: string]: any[] } = {};
        (fullActivities || []).forEach(item => {
            const header = getFormattedDateHeader(item.createdAt || item.time);
            if (!groups[header]) {
                groups[header] = [];
            }
            groups[header].push(item);
        });
        return groups;
    }, [fullActivities]);

    useEffect(() => {
        staffProfileApi.getStaffMembersList()
            .then((res: any) => {
                const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
                setStaffMembersList(list);
            })
            .catch(console.error);
    }, []);

    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    const loadOverview = useCallback(async (silent?: boolean) => {
        if (!silent) setLoading(true);
        try {
            const [blogStats, appStats, userStats, todayRes, mailStatsRes]: [any, any, any, any, any] = await Promise.all([
                adminApi.getBlogStats().catch(() => ({ data: {} })),
                adminApi.getApplicationStats().catch(() => ({ data: {} })),
                adminApi.getUserStats().catch(() => ({ data: {} })),
                staffProfileApi.getTodayDashboard().catch(() => ({ data: {} })),
                mailApi.getStats().catch(() => ({ data: {} })),
            ]);

            setStats({
                blogs: blogStats.data || {},
                apps: appStats.data || {},
                users: userStats.data || {},
            });
            setTodayStats(todayRes?.data || todayRes || {});

            let localSentCount = 0;
            let localDraftsCount = 0;
            let localReadCount = 0;
            let localStarredCount = 0;
            try {
                const savedSent = localStorage.getItem("vidya_mail_sent_history");
                if (savedSent) localSentCount = JSON.parse(savedSent).length;
                const savedDrafts = localStorage.getItem("vidya_mail_drafts");
                if (savedDrafts) localDraftsCount = JSON.parse(savedDrafts).length;
                const savedRead = localStorage.getItem("vidya_mail_read_ids");
                if (savedRead) localReadCount = JSON.parse(savedRead).length;
                const savedStarred = localStorage.getItem("vidya_mail_starred_ids");
                if (savedStarred) localStarredCount = JSON.parse(savedStarred).length;
            } catch {}

            const s = mailStatsRes?.data || {};
            setMailStats({
                total: Number(s.total || 0),
                unread: Number(s.unread || 0),
                read: Math.max(Number(s.read || 0), localReadCount),
                sent: Math.max(Number(s.sent || 0), localSentCount),
                drafts: Math.max(Number(s.drafts || 0), localDraftsCount),
                starred: Math.max(Number(s.starred || 0), localStarredCount),
                spam: Number(s.spam || 0),
                trash: Number(s.trash || 0),
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadFullActivities = useCallback(async () => {
        setActivitiesLoading(true);
        try {
            const offset = (activitiesPage - 1) * activitiesLimit;
            const isPureStaff = user?.role === "staff";
            const effectiveStaffId = isPureStaff ? "me" : activitiesStaffId;

            const res: any = await staffProfileApi.getAllDashboardActivities({
                limit: activitiesLimit,
                offset,
                type: activitiesFilter,
                search: activitiesSearch,
                staffId: effectiveStaffId,
            });
            let items: any[] = Array.isArray(res?.data) ? res.data : [];
            let total = res?.total ?? items.length;

            setFullActivities(items.map((a: any) => ({
                ...a,
                time: formatRelativeTime(a.createdAt || a.time)
            })));
            setActivitiesTotal(total);
        } catch (err) {
            console.warn("Failed to load full activities:", err);
            setFullActivities([]);
            setActivitiesTotal(0);
        } finally {
            setActivitiesLoading(false);
        }
    }, [activitiesPage, activitiesFilter, activitiesSearch, activitiesStaffId, user]);

    // Initial overview load
    useEffect(() => {
        loadOverview();
    }, [loadOverview]);

    // Audit logs load
    useEffect(() => {
        if (view === "activities") {
            loadFullActivities();
        }
    }, [view, loadFullActivities]);

    const pendingCount = Number(stats.apps?.statusStats?.pending || 0) + Number(stats.apps?.statusStats?.processing || 0);
    const approvedCount = Number(stats.apps?.statusStats?.approved || 0) + Number(stats.apps?.statusStats?.disbursed || 0);
    const rejectedCount = Number(stats.apps?.statusStats?.rejected || 0) + Number(stats.apps?.statusStats?.cancelled || 0);
    const totalApps = Number(stats.apps?.total ?? 0);
    const approvalRate = totalApps > 0 ? Math.round((approvedCount / totalApps) * 100) : 0;

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto animate-fade-in pb-12">
            {view === "overview" && (
                <>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-[#0A2540] tracking-tight">Operational Overview</h2>
                            <p className="text-slate-500 text-[11px] mt-1 font-semibold flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[15px] text-[#4F46E5]">calendar_today</span>
                                Synced: {format(new Date(), 'MMM do, yyyy')}
                            </p>
                        </div>
                        <div className="flex gap-2.5">
                            <button
                                onClick={() => { loadOverview(); setLastRefresh(new Date()); }}
                                className="px-3.5 py-2 rounded-xl bg-white border border-slate-200/80 text-slate-700 font-bold text-[11px] hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[15px]">refresh</span>
                            </button>
                            <button onClick={() => router.push("/staff/onboarding")} className="px-4 py-2 rounded-xl bg-white border border-slate-200/80 text-slate-700 font-bold text-[11px] hover:bg-slate-50 hover:text-[#0A2540] transition-all flex items-center gap-2 shadow-xs cursor-pointer">
                                <span className="material-symbols-outlined text-[17px] text-[#4F46E5]">person_add</span> Add Student
                            </button>
                            <button onClick={() => router.push("/staff/tasks")} className="px-4 py-2 rounded-xl bg-[#0A2540] hover:bg-[#081d33] text-white font-bold text-[11px] transition-all flex items-center gap-2 shadow-md shadow-[#0A2540]/10 cursor-pointer">
                                <span className="material-symbols-outlined text-[17px]">calendar_month</span> View Calendar
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            label="Total Applications"
                            value={stats.apps?.total}
                            icon="description"
                            color="text-blue-600"
                            loading={loading}
                            hint={`${stats.apps?.total > pendingCount ? stats.apps.total - pendingCount : 0} Processed`}
                        />
                        <div className="cursor-pointer" onClick={() => router.push('/staff/incoming-queue')}>
                            <StatCard
                                label="Awaiting Review"
                                value={pendingCount}
                                icon="hourglass_empty"
                                color="text-amber-600"
                                loading={loading}
                                hint={pendingCount > 0 ? "Action Required" : "All caught up"}
                                badge={pendingCount > 0 ? `${pendingCount} Pending` : undefined}
                                trend="⏳ Pending"
                            />
                        </div>
                        <StatCard
                            label="Approval Rate"
                            value={`${approvalRate}%`}
                            icon="check_circle"
                            color="text-emerald-600"
                            loading={loading}
                            trend={stats.apps?.monthlyComparison?.change ? `📈 ${Number(stats.apps.monthlyComparison.change) > 0 ? '+' : ''}${stats.apps.monthlyComparison.change}% this month` : ''}
                        />
                        <StatCard
                            label="Total Users"
                            value={stats.users?.total ?? 0}
                            icon="group"
                            color="text-purple-600"
                            loading={loading}
                            hint={`${stats.users?.joinedToday || 0} joined today`}
                            onFooterActionClick={(e: any) => { e.stopPropagation(); router.push('/staff/users'); }}
                        />
                    </div>

                    {/* Today's Operational Summary */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
                            <div>
                                <h3 className="text-[12px] font-extrabold text-[#0A2540] uppercase tracking-wider flex items-center gap-2">
                                    <span className="material-symbols-outlined text-indigo-600 text-[20px]">mark_email_unread</span>
                                    Today's Operational Summary
                                </h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Real-time overview of incoming inquiries, read status, sent emails, drafts, and priority follow-ups
                                </p>
                            </div>
                            <button
                                onClick={() => router.push('/staff/inbox')}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-600 text-[11px] font-bold transition-all shadow-2xs group cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[16px] text-indigo-500 group-hover:scale-110 transition-transform">mail</span>
                                Open Staff Mailbox
                                <span className="material-symbols-outlined text-[14px] text-slate-400 group-hover:translate-x-0.5 transition-transform">arrow_forward</span>
                            </button>
                        </div>

                        {/* Mail & Communications Operational Boxes */}
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                            {/* Unread Mail */}
                            <div
                                className="p-4 rounded-2xl border border-amber-200/80 bg-amber-50/50 flex flex-col justify-between min-h-[95px] transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                                        Unread
                                    </span>
                                    <span className="material-symbols-outlined text-amber-500 text-[18px]">
                                        mark_email_unread
                                    </span>
                                </div>
                                <div className="mt-2 flex items-baseline justify-between">
                                    <span className="text-2xl font-black text-amber-900">{mailStats.unread}</span>
                                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded">
                                        {mailStats.unread > 0 ? "Requires Action" : "Caught up"}
                                    </span>
                                </div>
                            </div>

                            {/* Read Mail */}
                            <div
                                className="p-4 rounded-2xl border border-sky-200/80 bg-sky-50/50 flex flex-col justify-between min-h-[95px] transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-extrabold text-sky-800 uppercase tracking-wider flex items-center gap-1">
                                        Read
                                    </span>
                                    <span className="material-symbols-outlined text-sky-500 text-[18px]">
                                        mark_email_read
                                    </span>
                                </div>
                                <div className="mt-2 flex items-baseline justify-between">
                                    <span className="text-2xl font-black text-sky-900">{mailStats.read}</span>
                                    <span className="text-[10px] font-medium text-sky-600">Processed</span>
                                </div>
                            </div>

                            {/* Sent Mail */}
                            <div
                                className="p-4 rounded-2xl border border-indigo-200/80 bg-indigo-50/50 flex flex-col justify-between min-h-[95px] transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-extrabold text-indigo-800 uppercase tracking-wider flex items-center gap-1">
                                        Sent
                                    </span>
                                    <span className="material-symbols-outlined text-indigo-500 text-[18px]">
                                        send
                                    </span>
                                </div>
                                <div className="mt-2 flex items-baseline justify-between">
                                    <span className="text-2xl font-black text-indigo-900">{mailStats.sent}</span>
                                    <span className="text-[10px] font-medium text-indigo-600">Dispatched</span>
                                </div>
                            </div>

                            {/* Drafts */}
                            <div
                                className="p-4 rounded-2xl border border-purple-200/80 bg-purple-50/50 flex flex-col justify-between min-h-[95px] transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-extrabold text-purple-800 uppercase tracking-wider flex items-center gap-1">
                                        Drafts
                                    </span>
                                    <span className="material-symbols-outlined text-purple-500 text-[18px]">
                                        drafts
                                    </span>
                                </div>
                                <div className="mt-2 flex items-baseline justify-between">
                                    <span className="text-2xl font-black text-purple-900">{mailStats.drafts}</span>
                                    <span className="text-[10px] font-medium text-purple-600">Saved</span>
                                </div>
                            </div>

                            {/* Starred / Priority */}
                            <div
                                className="p-4 rounded-2xl border border-yellow-200/80 bg-amber-50/30 flex flex-col justify-between min-h-[95px] transition-all"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                                        Starred
                                    </span>
                                    <span className="material-symbols-outlined text-amber-500 text-[18px]">
                                        star
                                    </span>
                                </div>
                                <div className="mt-2 flex items-baseline justify-between">
                                    <span className="text-2xl font-black text-amber-900">{mailStats.starred}</span>
                                    <span className="text-[10px] font-medium text-amber-600">Priority</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Pipeline Breakdown */}
                        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-5 shadow-sm">
                            <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-400 text-[16px]">donut_large</span>
                                Application Pipeline
                            </h3>
                            <div className="space-y-3">
                                {Object.entries(stats.apps?.statusStats || {}).sort(([, a]: any, [, b]: any) => b - a).map(([status, value]: any) => {
                                    let color = "bg-slate-500", textColor = "text-slate-700", bg = "bg-slate-50";
                                    if (['approved', 'disbursed'].includes(status)) { color = "bg-emerald-500"; textColor = "text-emerald-700"; bg = "bg-emerald-50"; }
                                    else if (['pending', 'submitted', 'documents_pending', 'draft'].includes(status)) { color = "bg-amber-400"; textColor = "text-amber-700"; bg = "bg-amber-50"; }
                                    else if (status === 'processing') { color = "bg-indigo-500"; textColor = "text-indigo-700"; bg = "bg-indigo-50"; }
                                    else if (['rejected', 'cancelled'].includes(status)) { color = "bg-rose-500"; textColor = "text-rose-700"; bg = "bg-rose-50"; }
                                    const label = status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
                                    const total = totalApps || 1;
                                    return (
                                        <div key={label}>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[12px] font-medium text-slate-700">{label}</span>
                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${bg} ${textColor}`}>{value} / {total}</span>
                                            </div>
                                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                <div className={`${color} h-1.5 rounded-full transition-all duration-700`} style={{ width: `${Math.round((value / total) * 100)}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                                {Object.keys(stats.apps?.statusStats || {}).length === 0 && !loading && (
                                    <div className="text-[12px] font-medium text-slate-500 text-center py-2">No pipeline data available</div>
                                )}
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-slate-100">
                                <div className="text-center">
                                    <p className="text-lg font-semibold text-slate-900">{approvedCount + rejectedCount}</p>
                                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">Processed</p>
                                </div>
                                <div className="text-center border-x border-slate-100">
                                    <p className="text-lg font-semibold text-slate-900">{Number(stats.users?.total ?? 0)}</p>
                                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">Users</p>
                                </div>
                                <div className="text-center cursor-pointer hover:opacity-80 transition-opacity" onClick={() => router.push('/staff/inactive-pipeline')} title="View Inactive Pipeline">
                                    <p className="text-lg font-semibold text-rose-600">{rejectedCount + Number(stats.apps?.cancelled ?? 0)}</p>
                                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">Rejected</p>
                                </div>
                            </div>
                        </div>

                        {/* Activity Feed + Quick Actions */}
                        <div className="space-y-4 flex flex-col">
                            <div className="space-y-1.5">
                                <button onClick={() => router.push('/staff/chat-customer')} className="w-full text-left p-3 rounded border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all flex items-center gap-3 bg-white shadow-sm cursor-pointer">
                                    <span className="material-symbols-outlined text-indigo-500 text-[18px]">forum</span>
                                    <span className="text-[12px] font-semibold text-slate-800">Support Chat</span>
                                    <span className="material-symbols-outlined text-slate-300 ml-auto text-[14px]">arrow_forward_ios</span>
                                </button>
                                <button onClick={() => router.push('/staff/applications')} className="w-full text-left p-3 rounded border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all flex items-center gap-3 bg-white shadow-sm cursor-pointer">
                                    <span className="material-symbols-outlined text-emerald-500 text-[18px]">folder_open</span>
                                    <span className="text-[12px] font-semibold text-slate-800">Active Pipeline</span>
                                    <span className="material-symbols-outlined text-slate-300 ml-auto text-[14px]">arrow_forward_ios</span>
                                </button>
                                <button onClick={() => router.push('/staff/inactive-pipeline')} className="w-full text-left p-3 rounded border border-slate-200 hover:border-rose-300 hover:bg-rose-50/30 transition-all flex items-center gap-3 bg-white shadow-sm cursor-pointer">
                                    <span className="material-symbols-outlined text-rose-500 text-[18px]">archive</span>
                                    <span className="text-[12px] font-semibold text-slate-800">Inactive Pipeline</span>
                                    <span className="material-symbols-outlined text-slate-300 ml-auto text-[14px]">arrow_forward_ios</span>
                                </button>
                            </div>

                            {/* Activity Log Widget */}
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[350px]">
                                <ActivityLogWidget
                                    limit={6}
                                    refreshInterval={30000}
                                    showFullLog={false}
                                    onViewAll={() => setView('activities')}
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}

            {view === "activities" && (
                <div className="space-y-6 max-w-[1400px] mx-auto animate-fade-in pb-12">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-indigo-600 transition-colors" onClick={() => setView('overview')}>
                                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider">Back to Dashboard</span>
                            </div>
                            <h2 className="text-[26px] font-['Playfair_Display',serif] font-bold text-[#0d1b2a] tracking-tight flex items-center gap-3 mt-1">
                                Audit Trail & Logs
                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                    FULL HISTORY
                                </span>
                            </h2>
                            <p className="text-slate-500 text-[13px] mt-1 font-medium">Reviewing comprehensive administrative activity and system logs.</p>
                        </div>
                        <button
                            onClick={loadFullActivities}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                        >
                            <span className="material-symbols-outlined text-[16px]">refresh</span>
                            Refresh Logs
                        </button>
                    </div>

                    {/* Filters Bar */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col space-y-4">
                        {/* Top row: Staff Scope Selector & Search */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* Staff Scope Selector */}
                            {user?.role !== "staff" && (
                                <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                                    <button
                                        onClick={() => { setActivitiesStaffId("me"); setActivitiesPage(1); }}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                            activitiesStaffId === "me"
                                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-95"
                                                : "text-slate-600 hover:bg-slate-200/60"
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-[14px]">person</span>
                                        My History
                                    </button>
                                    <button
                                        onClick={() => { setActivitiesStaffId("all"); setActivitiesPage(1); }}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                            activitiesStaffId === "all"
                                                ? "bg-[#0f172a] text-white shadow-md shadow-slate-900/10 scale-95"
                                                : "text-slate-600 hover:bg-slate-200/60"
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-[14px]">groups</span>
                                        All Staff
                                    </button>
                                    {staffMembersList.length > 0 && (
                                        <div className="relative border-l border-slate-300/60 pl-2 ml-1">
                                            <select
                                                value={activitiesStaffId}
                                                onChange={(e) => { setActivitiesStaffId(e.target.value); setActivitiesPage(1); }}
                                                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                            >
                                                <option value="me">Logged-In Staff Only</option>
                                                <option value="all">All Staff Members</option>
                                                <optgroup label="Select Specific Staff">
                                                    {staffMembersList.map((m: any) => (
                                                        <option key={m.id} value={m.id}>
                                                            {m.name || m.email} ({m.activityCount || 0} events)
                                                        </option>
                                                    ))}
                                                </optgroup>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="relative flex-1 max-w-md">
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                                <input
                                    type="text"
                                    placeholder="Search activities by message or initiator..."
                                    value={activitiesSearch}
                                    onChange={(e) => { setActivitiesSearch(e.target.value); setActivitiesPage(1); }}
                                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-xl text-[12px] focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                />
                            </div>
                        </div>

                        {/* Event Category Filter Pills */}
                        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                            {[
                                { key: "all", label: "ALL EVENTS", icon: "select_all", color: "bg-slate-100 text-slate-700" },
                                { key: "new", label: "REGISTRATIONS", icon: "person_add", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
                                { key: "update", label: "DOSSIER SYNCS", icon: "sync", color: "bg-blue-50 text-blue-700 border-blue-100" },
                                { key: "upload", label: "UPLOADS", icon: "upload_file", color: "bg-purple-50 text-purple-700 border-purple-100" },
                                { key: "share", label: "DISTRIBUTION", icon: "send", color: "bg-indigo-50 text-indigo-700 border-indigo-100" },
                                { key: "approved", label: "APPROVALS", icon: "task_alt", color: "bg-emerald-50 text-emerald-700 border-emerald-100" },
                                { key: "rejected", label: "DELETIONS", icon: "delete", color: "bg-rose-50 text-rose-700 border-rose-100" },
                            ].map((badge) => (
                                <button
                                    key={badge.key}
                                    onClick={() => { setActivitiesFilter(badge.key); setActivitiesPage(1); }}
                                    className={`px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 transition-all border ${activitiesFilter === badge.key
                                        ? "bg-[#0f172a] text-white border-[#0f172a] shadow-md shadow-slate-900/10 scale-95"
                                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-[14px]">{badge.icon}</span>
                                    {badge.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Timeline Table/List Grouped by Date */}
                    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-slate-500 text-[18px]">event_note</span>
                                <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">Chronological Recent Activity Log</span>
                            </div>
                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">{activitiesTotal} System Records Found</span>
                        </div>
                        <div>
                            {activitiesLoading ? (
                                <div className="p-24 text-center">
                                    <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Loading secure database logs...</p>
                                </div>
                            ) : fullActivities.length > 0 ? (
                                Object.entries(groupedActivities).map(([dateGroup, items]) => (
                                    <div key={dateGroup} className="border-b border-slate-200/70 last:border-b-0">
                                        {/* Date Group Sticky Header */}
                                        <div className="bg-slate-100/90 backdrop-blur-md px-5 py-2.5 border-y border-slate-200/60 flex items-center justify-between sticky top-0 z-10">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-[16px] text-indigo-600">calendar_month</span>
                                                <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">{dateGroup}</span>
                                            </div>
                                            <span className="px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-[10px] font-extrabold text-indigo-700 shadow-xs">
                                                {items.length} {items.length === 1 ? 'event' : 'events'}
                                            </span>
                                        </div>

                                        {/* Items in this date group */}
                                        <div className="divide-y divide-slate-100 bg-white">
                                            {items.map((a, i) => (
                                                <div key={a.id || i} className="p-5 hover:bg-slate-50/60 transition-all group flex items-start gap-4">
                                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${a.color || 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                                                        <span className="material-symbols-outlined text-[20px]">{a.icon || 'history'}</span>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-col md:flex-row md:items-center justify-between mb-1.5 gap-2">
                                                            <p className="text-[14px] font-bold text-slate-900 leading-snug tracking-tight">{a.msg}</p>
                                                            <div className="text-left md:text-right shrink-0">
                                                                <span className="px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100/80 text-[11px] font-black text-indigo-700 font-mono inline-flex items-center gap-1 shadow-2xs">
                                                                    <span className="material-symbols-outlined text-[13px]">schedule</span>
                                                                    {a.createdAt ? formatAbsoluteDateTime(a.createdAt) : a.time}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-3 mt-2">
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-[9px] font-black uppercase tracking-wider text-slate-600">
                                                                TYPE: {a.type}
                                                            </span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300" />

                                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600">
                                                                <div className="w-4 h-4 rounded-full overflow-hidden bg-slate-100 border border-slate-200 flex-shrink-0">
                                                                    <img
                                                                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${a.actorEmail || a.actorName}`}
                                                                        alt=""
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                                <span>Staff: {a.actorName}</span>
                                                                {a.actorEmail && <span className="text-slate-400 font-medium">({a.actorEmail})</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-24 text-center">
                                    <span className="material-symbols-outlined text-6xl text-slate-200 mb-4 block">manage_search</span>
                                    <p className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400">No Auditable Actions Found</p>
                                    <p className="text-[11px] text-slate-400 mt-1">Try modifying search keywords or filters.</p>
                                </div>
                            )}
                        </div>

                        {activitiesTotal > activitiesLimit && (
                            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex flex-col">
                                    <p className="text-[11px] font-bold text-slate-700">
                                        Page <span className="text-indigo-600">{activitiesPage}</span> of {Math.ceil(activitiesTotal / activitiesLimit)}
                                        <span className="mx-2 text-slate-300">|</span>
                                        Total Records: <span className="text-slate-900">{activitiesTotal}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={activitiesPage === 1 || activitiesLoading}
                                        onClick={() => {
                                            setActivitiesPage(prev => Math.max(1, prev - 1));
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                                        Previous
                                    </button>
                                    <div className="flex items-center gap-1 mx-2">
                                        {(() => {
                                            const totalPages = Math.ceil(activitiesTotal / activitiesLimit);
                                            const maxVisiblePages = 5;
                                            let startPage = Math.max(1, activitiesPage - Math.floor(maxVisiblePages / 2));
                                            let endPage = startPage + maxVisiblePages - 1;

                                            if (endPage > totalPages) {
                                                endPage = totalPages;
                                                startPage = Math.max(1, endPage - maxVisiblePages + 1);
                                            }

                                            const pageButtons = [];
                                            for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
                                                pageButtons.push(
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => setActivitiesPage(pageNum)}
                                                        className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${activitiesPage === pageNum ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'}`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            }
                                            return (
                                                <>
                                                    {startPage > 1 && (
                                                        <>
                                                            <button
                                                                onClick={() => setActivitiesPage(1)}
                                                                className="w-8 h-8 rounded-lg text-[10px] font-black transition-all bg-white border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
                                                            >
                                                                1
                                                            </button>
                                                            {startPage > 2 && <span className="text-slate-400 text-[10px] font-black px-1">...</span>}
                                                        </>
                                                    )}
                                                    {pageButtons}
                                                    {endPage < totalPages && (
                                                        <>
                                                            {endPage < totalPages - 1 && <span className="text-slate-400 text-[10px] font-black px-1">...</span>}
                                                            <button
                                                                onClick={() => setActivitiesPage(totalPages)}
                                                                className="w-8 h-8 rounded-lg text-[10px] font-black transition-all bg-white border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
                                                            >
                                                                {totalPages}
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                    <button
                                        disabled={activitiesPage >= Math.ceil(activitiesTotal / activitiesLimit) || activitiesLoading}
                                        onClick={() => {
                                            setActivitiesPage(prev => prev + 1);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm"
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
        </div>
    );
}
