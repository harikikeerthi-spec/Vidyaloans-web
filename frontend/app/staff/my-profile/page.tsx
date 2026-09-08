"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { adminApi, staffProfileApi } from "@/lib/api";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useActivityLog } from "@/hooks/useActivityLog";

export default function MyProfilePage() {
    const router = useRouter();
    const { user } = useAuth();
    const [applications, setApplications] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Activity log state
    const { activities, loading: activitiesLoading, fetchActivities } = useActivityLog({
        limit: 50,
        pollInterval: 15000,
        autoRefresh: true,
        staffId: 'me'
    });
    const [activeCategory, setActiveCategory] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");

    useEffect(() => {
        const loadProfileStats = async () => {
            setLoading(true);
            try {
                const res: any = await adminApi.getApplications({ limit: "1000" });
                if (res && res.data) {
                    setApplications(res.data);
                } else if (Array.isArray(res)) {
                    setApplications(res);
                }

                const savedTasks = localStorage.getItem("vidyaloans_staff_tasks");
                if (savedTasks) {
                    setTasks(JSON.parse(savedTasks));
                }
            } catch (e) {
                console.error("Failed to load profile stats", e);
            } finally {
                setLoading(false);
            }
        };
        loadProfileStats();
    }, []);

    const stats = useMemo(() => {
        const total = applications.length;
        const pending = applications.filter(app => ["pending", "processing", "submitted_to_bank"].includes(app.status?.toLowerCase())).length;
        const approved = applications.filter(app => ["approved", "verified", "disbursed", "disbursement_confirmed"].includes(app.status?.toLowerCase())).length;
        const rejected = applications.filter(app => app.status?.toLowerCase() === "rejected").length;
        const completedTasks = tasks.filter(t => t.completed).length;
        const pendingTasks = tasks.filter(t => !t.completed).length;

        return {
            total,
            pending,
            approved,
            rejected,
            completedTasks,
            pendingTasks
        };
    }, [applications, tasks]);

    const filteredActivities = useMemo(() => {
        return activities.filter(act => {
            const matchesType = activeCategory === "all" || act.type === activeCategory;
            const matchesQuery = !searchQuery.trim() || 
                (act.msg || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (act.actorName || "").toLowerCase().includes(searchQuery.toLowerCase());
            return matchesType && matchesQuery;
        });
    }, [activities, activeCategory, searchQuery]);

    return (
        <div className="space-y-8 max-w-[1400px] mx-auto animate-fade-in pb-12 font-sans">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-[28px] tracking-tight flex items-center gap-3 font-['Playfair_Display',serif] font-bold text-[#0d1b2a]">
                        My Profile
                    </h2>
                    <p className="text-slate-500 text-[13px] mt-1 font-medium">Staff account, credentials & support tickets</p>
                </div>
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => {
                            const slug = user?.email ? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '') : '';
                            router.push(slug ? `/staff/inbox?folder=staff/${slug}/` : '/staff/inbox');
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0A2540] hover:bg-[#1E293B] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[18px]">all_inbox</span>
                        Mail Inbox
                    </button>
                    <button
                        type="button"
                        onClick={() => router.push('/staff/support-tickets')}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-[18px]">support_agent</span>
                        Raise Support Ticket
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="bg-white rounded-2xl border border-slate-200/60 p-8 shadow-sm flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-2xl bg-slate-100 border-2 border-slate-200 overflow-hidden mb-5 shadow-lg">
                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} alt="Avatar" className="w-full h-full object-cover" />
                    </div>
                    <h3 className="text-[20px] font-black text-slate-900 tracking-tight">{user?.firstName || '—'} {user?.lastName || ''}</h3>
                    <p className="text-[11px] font-black uppercase tracking-widest text-indigo-600 mt-1">{user?.role?.replace('_', ' ') || 'Staff'}</p>
                    <p className="text-[13px] text-slate-500 mt-2 font-semibold font-mono">{user?.email}</p>

                    <div className="mt-6 w-full pt-6 border-t border-slate-100 space-y-3">
                        <div className="flex justify-between text-[12px]">
                            <span className="text-slate-400 font-bold uppercase tracking-wider">Status</span>
                            <span className="font-black text-emerald-600 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse inline-block" />
                                Active
                            </span>
                        </div>
                        <div className="flex justify-between text-[12px]">
                            <span className="text-slate-400 font-bold uppercase tracking-wider">Portal</span>
                            <span className="font-bold text-slate-700">CoreOps Staff</span>
                        </div>
                        <div className="flex justify-between text-[12px]">
                            <span className="text-slate-400 font-bold uppercase tracking-wider">AWS S3 Folder</span>
                            <span className="font-mono text-indigo-600 font-bold">staff/{user?.email ? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '') : 'staff'}/</span>
                        </div>
                        <div className="flex justify-between text-[12px]">
                            <span className="text-slate-400 font-bold uppercase tracking-wider">Session</span>
                            <span className="font-bold text-slate-700">{format(new Date(), 'MMM d, yyyy')}</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                const slug = user?.email ? user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '') : '';
                                router.push(slug ? `/staff/inbox?folder=staff/${slug}/` : '/staff/inbox');
                            }}
                            className="w-full mt-3 flex items-center justify-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-200/80 transition-all cursor-pointer shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[16px]">all_inbox</span>
                            Open Staff Mail Inbox
                        </button>
                    </div>
                </div>

                {/* Stats Summary */}
                <div className="lg:col-span-2 grid grid-cols-2 gap-5 content-start">
                    {[
                        { label: "Applications Managed", value: stats.total, icon: "description", color: "bg-indigo-50 text-indigo-600" },
                        { label: "Pending Review", value: stats.pending, icon: "hourglass_empty", color: "bg-amber-50 text-amber-600" },
                        { label: "Approved This Month", value: stats.approved, icon: "check_circle", color: "bg-emerald-50 text-emerald-600" },
                        { label: "Rejection Rate", value: stats.total > 0 ? `${Math.round((stats.rejected / stats.total) * 100)}%` : '0%', icon: "cancel", color: "bg-rose-50 text-rose-600" },
                        { label: "Tasks Completed", value: stats.completedTasks, icon: "fact_check", color: "bg-slate-100 text-slate-600" },
                        { label: "Tasks Pending", value: stats.pendingTasks, icon: "pending_actions", color: "bg-violet-50 text-violet-600" },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-xl border border-slate-200/60 p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${s.color} shrink-0`}>
                                <span className="material-symbols-outlined text-[22px]">{s.icon}</span>
                            </div>
                            <div>
                                <p className="text-[22px] font-black text-slate-900 leading-none">{loading ? '—' : s.value}</p>
                                <p className="text-[11px] text-slate-500 font-medium mt-1">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── My Personal Action History Audit Log (Stored in DB) ── */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-[20px] font-['Playfair_Display',serif] font-bold text-[#0d1b2a]">
                                My Action History & Audit Log
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                DB PERSISTED
                            </span>
                        </div>
                        <p className="text-slate-500 text-[12px] mt-0.5 font-medium">
                            Real-time database audit log tracking all actions performed by {user?.firstName || 'you'} across the staff portal.
                        </p>
                    </div>

                    <button
                        onClick={fetchActivities}
                        disabled={activitiesLoading}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 self-start md:self-auto cursor-pointer"
                    >
                        <span className={`material-symbols-outlined text-[16px] ${activitiesLoading ? 'animate-spin' : ''}`}>refresh</span>
                        Refresh Log
                    </button>
                </div>

                {/* Filter Tabs & Search Bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
                        {[
                            { id: "all", label: "All Actions", icon: "history" },
                            { id: "share", label: "Bank Shares", icon: "send" },
                            { id: "update", label: "Follow-ups & Notes", icon: "event" },
                            { id: "approved", label: "Approvals", icon: "check_circle" },
                            { id: "rejected", label: "Rejections", icon: "cancel" },
                            { id: "upload", label: "Documents", icon: "upload_file" },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveCategory(tab.id)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all whitespace-nowrap ${
                                    activeCategory === tab.id
                                        ? "bg-white text-indigo-700 shadow-sm border border-slate-200/60"
                                        : "text-slate-500 hover:text-slate-800"
                                }`}
                            >
                                <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full sm:w-64">
                        <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-[16px]">search</span>
                        <input
                            type="text"
                            placeholder="Search my actions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                    </div>
                </div>

                {/* Activity List */}
                <div className="space-y-3">
                    {activitiesLoading && activities.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 font-semibold text-xs flex flex-col items-center gap-2">
                            <span className="material-symbols-outlined text-2xl animate-spin">sync</span>
                            Loading database activity log...
                        </div>
                    ) : filteredActivities.length > 0 ? (
                        <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                            {filteredActivities.map((act) => (
                                <div key={act.id} className="p-4 hover:bg-white transition-all flex items-start gap-4">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${act.color || 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                        <span className="material-symbols-outlined text-[18px]">{act.icon || 'history'}</span>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[13px] font-bold text-slate-800 leading-snug">{act.msg}</p>
                                            <span className="text-[11px] font-semibold text-slate-400 shrink-0 font-mono">
                                                {act.time || (act.createdAt ? format(new Date(act.createdAt), 'MMM d, h:mm a') : 'Recently')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="px-2 py-0.5 rounded bg-slate-200/60 text-slate-600 text-[10px] font-black uppercase tracking-wider">
                                                {act.type || 'Action'}
                                            </span>
                                            <span className="text-[11px] text-slate-400 font-medium">
                                                By {act.actorName || user?.firstName || 'Staff'} ({act.actorEmail || user?.email || 'Me'})
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <span className="material-symbols-outlined text-3xl text-slate-300 mb-2">history_toggle_off</span>
                            <p className="text-sm font-bold text-slate-600">No activity history found</p>
                            <p className="text-xs text-slate-400 mt-1">Actions performed in the staff portal will be logged here automatically.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
