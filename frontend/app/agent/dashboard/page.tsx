"use client";

import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { useAgent } from "../AgentContext";
import { HttpApiPaths } from "@/lib/http-api-paths";

export default function AgentDashboardOverview() {
    const {
        user,
        stats,
        pipeline,
        activityFeed,
        actionItems,
        applications,
        tasks,
        loading,
        token,
    } = useAgent();

    const [rmDiscussions, setRmDiscussions] = useState<any[]>([]);
    const [loadingChats, setLoadingChats] = useState(true);

    useEffect(() => {
        if (!token) return;
        
        const fetchChats = async () => {
            try {
                const res = await fetch(HttpApiPaths.chat.conversations('agent', undefined), {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (Array.isArray(data)) {
                    // Filter conversations of type agent_to_staff
                    const filtered = data.filter((c: any) => c.metadata?.type === 'agent_to_staff');
                    setRmDiscussions(filtered.slice(0, 3)); // show top 3 recent discussions
                }
            } catch (e) {
                console.error("Failed to fetch RM discussions for dashboard", e);
            } finally {
                setLoadingChats(false);
            }
        };

        fetchChats();
        // Set up poll interval
        const interval = setInterval(fetchChats, 15000);
        return () => clearInterval(interval);
    }, [token]);

    const agentName = user
        ? `${user.firstName || user.email?.split("@")[0] || "Agent"}`
        : "Agent";

    // Derive pipeline counts from context (API data) or fall back to applications state
    const pipelineDisplay = useMemo(() => {
        const total = stats?.total || applications.length;
        const active = pipeline.leads + pipeline.submitted + pipeline.bank_review;
        const bankSubmitted = pipeline.submitted + pipeline.bank_review;
        const sanctioned = pipeline.approved;
        const disbursed = pipeline.disbursed;
        return { total, active, bankSubmitted, sanctioned, disbursed };
    }, [stats, pipeline, applications]);

    // Derive from-applications fallback if pipeline is all zeros
    const fallbackPipeline = useMemo(() => {
        if (Object.values(pipeline).some(v => v > 0)) return null;
        return {
            leads: applications.filter(x => x.status === "pending").length,
            submitted: applications.filter(x => x.status === "processing").length,
            bank_review: applications.filter(x => x.status === "processing").length,
            approved: applications.filter(x => x.status === "approved").length,
            disbursed: applications.filter(x => x.status === "disbursed").length,
        };
    }, [pipeline, applications]);

    const activePipeline = fallbackPipeline || pipeline;
    const totalPipeline = Object.values(activePipeline).reduce((a, b) => a + b, 0) || applications.length;

    // Urgent / follow-up tasks from action items (API) or tasks state fallback
    const urgentItems = useMemo(() => {
        if (actionItems.length > 0) return actionItems.slice(0, 3);
        if (tasks.filter(t => !t.isCompleted && t.isOverdue).length > 0)
            return tasks.filter(t => !t.isCompleted && t.isOverdue).slice(0, 3);
        return [];
    }, [actionItems, tasks]);

    const followUpItems = useMemo(() => {
        const real = tasks.filter(t => !t.isCompleted && !t.isOverdue);
        if (real.length > 0) return real.slice(0, 3);
        return [];
    }, [tasks]);

    // Recent wins from disbursed applications
    const recentWins = useMemo(() => {
        return applications
            .filter(x => x.status === "disbursed" || x.status === "approved")
            .slice(0, 3);
    }, [applications]);

    const revenue = stats?.revenue ?? 0;
    const sanctionedCount = pipelineDisplay.sanctioned;
    const commissionGoal = 90000;
    const sanctionGoal = 15;
    const loanValueGoal = 18000000;
    const totalAmount = stats?.totalAmount ?? applications.reduce((a, c) => a + c.amount, 0);

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-36 bg-gray-100 rounded-[2.5rem]" />
                <div className="grid grid-cols-5 gap-4">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-[2rem]" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in-up space-y-12 relative z-10">

            {/* Welcome Bar — personalized from auth user */}
            <section className="p-8 rounded-[2.5rem] bg-gradient-to-br from-[#6605c7] to-[#8b24e5] text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-premium-noise pointer-events-none" />
                <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none group-hover:scale-110 transition-transform duration-700" />
                <div className="space-y-2.5 relative z-10">
                    <h2 className="text-3xl font-black font-display tracking-tight">👋 Good Morning, {agentName}</h2>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-white/80 font-medium">
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm text-amber-300">workspace_premium</span> Tier: <strong className="text-amber-300 uppercase tracking-widest font-black">Master</strong></span>
                        <span className="text-white/30">|</span>
                        <span className="flex items-center gap-1"><span className="material-symbols-outlined text-sm text-white/60">location_on</span> Territory: <strong className="text-white font-bold">Hyderabad, Secunderabad</strong></span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[11px] font-bold bg-white/10 px-3 py-1.5 rounded-xl">
                            <span className="material-symbols-outlined text-[13px] text-emerald-300">support_agent</span>
                            Your RM: <strong className="text-white ml-1">Neha Sharma</strong>
                        </span>
                        <a href="tel:+918143797779" className="flex items-center gap-1 text-[11px] font-bold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-all">
                            <span className="material-symbols-outlined text-[13px]">call</span> +91 81437 97779
                        </a>
                        <a href="https://wa.me/918143797779" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-black bg-emerald-500/80 hover:bg-emerald-500 px-3 py-1.5 rounded-xl transition-all">
                            <span className="material-symbols-outlined text-[13px]">chat</span> WhatsApp
                        </a>
                    </div>
                </div>
                <div className="flex flex-col xs:flex-row gap-4 items-stretch xs:items-center relative z-10 bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/10 shrink-0">
                    <div className="text-left space-y-1">
                        <p className="text-[9px] font-black uppercase text-white/50 tracking-widest">June 2026</p>
                        <p className="text-xs font-black text-white">{pipelineDisplay.total} Students in Network</p>
                        <p className="text-[10px] text-amber-300 font-bold">{Math.max(0, sanctionGoal - sanctionedCount)} sanctions to monthly target</p>
                    </div>
                    <div className="flex gap-2">
                        <Link href="/agent/chat-staff" className="px-4 py-2 bg-white text-[#6605c7] rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-[#6605c7]/10 hover:text-white transition-all flex items-center gap-1.5 shadow-sm">
                            <span className="material-symbols-outlined text-[14px]">forum</span> Chat RM
                        </Link>
                    </div>
                </div>
            </section>

            {/* KPI Summary Row — from API stats */}
            <section>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="bg-white border border-[#6605c7]/10 p-6 rounded-[2.5rem] shadow-sm flex flex-col justify-between min-h-[150px] hover:-translate-y-1 transition-all duration-300">
                        <div>
                            <p className="text-[#6605c7]/50 text-[9px] font-black uppercase tracking-widest mb-1">Total Students</p>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider bg-gray-50 px-2 py-0.5 rounded-full inline-block">All Time</span>
                        </div>
                        <p className="text-3xl font-black text-gray-900 font-display mt-4">{pipelineDisplay.total}</p>
                    </div>
                    <div className="bg-white border border-[#6605c7]/10 p-6 rounded-[2.5rem] shadow-sm flex flex-col justify-between min-h-[150px] hover:-translate-y-1 transition-all duration-300">
                        <div>
                            <p className="text-[#6605c7]/50 text-[9px] font-black uppercase tracking-widest mb-1">Active Pipeline</p>
                            <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-full inline-block">Ongoing</span>
                        </div>
                        <p className="text-3xl font-black text-gray-900 font-display mt-4">{activePipeline.leads + activePipeline.submitted + activePipeline.bank_review}</p>
                    </div>
                    <div className="bg-white border border-[#6605c7]/10 p-6 rounded-[2.5rem] shadow-sm flex flex-col justify-between min-h-[150px] hover:-translate-y-1 transition-all duration-300">
                        <div>
                            <p className="text-[#6605c7]/50 text-[9px] font-black uppercase tracking-widest mb-1">Submitted to Bank</p>
                            <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider bg-amber-50 px-2 py-0.5 rounded-full inline-block">In Review</span>
                        </div>
                        <p className="text-3xl font-black text-gray-900 font-display mt-4">{activePipeline.submitted + activePipeline.bank_review}</p>
                    </div>
                    <div className="bg-white border border-[#6605c7]/10 p-6 rounded-[2.5rem] shadow-sm flex flex-col justify-between min-h-[150px] hover:-translate-y-1 transition-all duration-300">
                        <div>
                            <p className="text-[#6605c7]/50 text-[9px] font-black uppercase tracking-widest mb-1">Sanctioned / Approved</p>
                            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full inline-block">Approved</span>
                        </div>
                        <p className="text-3xl font-black text-gray-900 font-display mt-4">{sanctionedCount} 🏆</p>
                    </div>
                    <div className="bg-white border border-[#6605c7]/10 p-6 rounded-[2.5rem] shadow-sm flex flex-col justify-between min-h-[150px] hover:-translate-y-1 transition-all duration-300">
                        <div>
                            <p className="text-[#6605c7]/50 text-[9px] font-black uppercase tracking-widest mb-1">Commission Earned</p>
                            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full inline-block">This Month</span>
                        </div>
                        <p className="text-3xl font-black text-emerald-600 font-display mt-4">₹{revenue.toLocaleString()}</p>
                    </div>
                </div>
            </section>

            {/* Monthly Target Progress Gauges — computed from API data */}
            <section className="p-8 rounded-[2.5rem] bg-white border border-[#6605c7]/10 shadow-sm space-y-6">
                <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                    <h3 className="font-display font-black text-xl text-gray-900 uppercase tracking-tight">Monthly Goals Progress</h3>
                    <span className="text-xs font-black text-[#6605c7] bg-[#6605c7]/5 px-4 py-1.5 rounded-full uppercase tracking-wider">Master tier</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        { label: "Target Sanctions", goal: sanctionGoal, achieved: sanctionedCount, unit: "" },
                        { label: "Target Loan Value", goal: loanValueGoal, achieved: totalAmount, unit: "₹", formatVal: (v: number) => `₹${(v / 1000000).toFixed(1)}Cr` },
                        { label: "Commission Goal", goal: commissionGoal, achieved: revenue, unit: "₹", formatVal: (v: number) => `₹${v.toLocaleString()}` },
                    ].map(({ label, goal, achieved, formatVal }) => {
                        const pct = Math.min(100, Math.round((achieved / goal) * 100));
                        return (
                            <div key={label} className="space-y-2">
                                <div className="flex justify-between text-xs font-bold text-gray-700">
                                    <span>{label}: {formatVal ? formatVal(goal) : goal}</span>
                                    <span className="text-[#6605c7]">{formatVal ? formatVal(achieved) : achieved} ({pct}%)</span>
                                </div>
                                <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[#6605c7] to-[#8b24e5] rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {sanctionedCount < sanctionGoal && (
                        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3 text-amber-800 text-xs font-medium items-center">
                            <span className="material-symbols-outlined text-amber-500 text-lg">notifications_active</span>
                            <p className="font-bold">📣 You need <strong>{sanctionGoal - sanctionedCount}</strong> more sanctions to hit your monthly target!</p>
                        </div>
                    )}
                    {applications.length > 0 && (
                        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 flex gap-3 text-rose-700 text-xs font-medium items-center">
                            <span className="material-symbols-outlined text-rose-500 text-lg">folder_open</span>
                            <p className="font-bold">🔔 Your pipeline is live — keep following up with your active leads.</p>
                        </div>
                    )}
                    {applications.length === 0 && (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex gap-3 text-emerald-700 text-xs font-medium items-center">
                            <span className="material-symbols-outlined text-emerald-500 text-lg">auto_awesome</span>
                            <p className="font-bold">🌟 Your dashboard is ready. New referrals will appear here automatically.</p>
                        </div>
                    )}
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8 flex flex-col">
                    {/* Action Items Panel — from API actionItems or tasks fallback */}
                    <div className="bg-white border border-[#6605c7]/10 p-8 rounded-[2.5rem] shadow-sm flex-1">
                        <h3 className="font-display font-black text-lg text-gray-900 mb-6 uppercase tracking-tight flex items-center gap-2">
                            <span className="material-symbols-outlined text-rose-500 animate-pulse">priority_high</span> Urgent Actions & Follow Ups
                        </h3>
                        <div className="space-y-6">
                            {urgentItems.length > 0 ? (
                                <div>
                                    <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3">🔴 ACTION REQUIRED</h4>
                                    <div className="space-y-3">
                                        {urgentItems.map((item: any) => (
                                            <div key={item.id} className="flex items-center justify-between p-4 bg-red-50/50 border border-red-100 rounded-2xl">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-gray-900">{item.studentName}</p>
                                                    <p className="text-xs text-gray-500">{item.notes || item.type}</p>
                                                </div>
                                                <Link
                                                    href={item.studentId ? `/agent/students/${item.studentId}` : "/agent/students"}
                                                    className="px-4 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-red-600 transition-all text-center shrink-0 ml-3"
                                                >
                                                    Resolve
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 text-center text-sm text-emerald-600 font-bold bg-emerald-50/50 rounded-2xl border border-emerald-100">
                                    ✅ No urgent follow-ups right now — your dashboard is clear and ready for new leads.
                                </div>
                            )}

                            {followUpItems.length > 0 && (
                                <div className="pt-4 border-t border-gray-100">
                                    <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-3">🟡 FOLLOW UP TODAY</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {followUpItems.map((t: any) => (
                                            <div key={t.id} className="p-4 bg-amber-50/30 border border-amber-100 rounded-2xl flex flex-col justify-between">
                                                <div>
                                                    <p className="text-sm font-black text-gray-900">{t.studentName}</p>
                                                    <p className="text-[11px] text-gray-500 mt-1">{t.notes}</p>
                                                </div>
                                                <Link href="/agent/calendar" className="mt-4 w-full py-2 bg-amber-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-amber-600 transition-all text-center">
                                                    View Calendar
                                                </Link>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {recentWins.length > 0 && (
                                <div className="pt-4 border-t border-gray-100">
                                    <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-3">✅ RECENT WINS</h4>
                                    <div className="space-y-2">
                                        {recentWins.map((app) => (
                                            <div key={app.id} className="flex items-center justify-between p-3.5 bg-emerald-50/30 border border-emerald-100 rounded-2xl text-xs">
                                                <span className="font-bold text-gray-800">🎉 {app.firstName} {app.lastName} → {app.status === "disbursed" ? "Disbursed" : "Sanctioned"} ₹{(app.amount / 100000).toFixed(0)}L {app.bank}</span>
                                                <span className="font-black text-emerald-600 shrink-0 ml-2">+₹{app.projectedCommission.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {urgentItems.length === 0 && followUpItems.length === 0 && recentWins.length === 0 && (
                                <div className="pt-4 border-t border-gray-100">
                                    <div className="p-4 rounded-2xl border border-dashed border-[#6605c7]/20 bg-[#f8f5ff] text-center text-sm text-[#6605c7] font-bold">
                                        ✨ Your action board is empty for now. New student follow-ups will appear here automatically.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RM Discussions Panel */}
                    <div className="bg-white border border-[#6605c7]/10 p-8 rounded-[2.5rem] shadow-sm">
                        <h3 className="font-display font-black text-lg text-gray-900 mb-6 uppercase tracking-tight flex items-center gap-2">
                            <span className="material-symbols-outlined text-[#6605c7]">chat_bubble_outline</span> RM Discussions
                        </h3>
                        {loadingChats ? (
                            <div className="py-8 text-center">
                                <div className="w-6 h-6 border-2 border-[#6605c7]/20 border-t-[#6605c7] rounded-full animate-spin mx-auto" />
                            </div>
                        ) : rmDiscussions.length > 0 ? (
                            <div className="space-y-4">
                                {rmDiscussions.map((chat: any) => {
                                    const studentName = chat.metadata?.studentName || chat.customerName || "Student Lead";
                                    const lastMsg = chat.lastMessage?.content || "No messages yet";
                                    const timeStr = chat.updatedAt 
                                        ? format(new Date(chat.updatedAt), "dd MMM, hh:mm a") 
                                        : "N/A";
                                    const unreadCount = chat.unreadCount || 0;
                                    
                                    return (
                                        <div key={chat.id} className="flex items-center justify-between p-4 bg-purple-50/10 border border-[#6605c7]/5 rounded-2xl hover:bg-purple-50/20 transition-all text-left">
                                            <div className="min-w-0 flex-1 pr-4">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-black text-gray-900 truncate">{studentName}</p>
                                                    {unreadCount > 0 && (
                                                        <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded-full leading-none">
                                                            {unreadCount}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 truncate mt-1">
                                                    {chat.lastMessage && ['agent', 'partner_agent'].includes(chat.lastMessage.senderType) ? 'You: ' : ''}
                                                    {lastMsg}
                                                </p>
                                                <p className="text-[9px] text-gray-400 mt-1 font-semibold">{timeStr}</p>
                                            </div>
                                            <Link
                                                href={`/agent/chat-staff?conversationId=${chat.id}`}
                                                className="px-4 py-2 bg-[#6605c7] text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-[#6605c7]/95 transition-all text-center shrink-0 shadow-sm"
                                            >
                                                Open Chat
                                            </Link>
                                        </div>
                                    );
                                })}
                                <Link 
                                    href="/agent/chat-staff" 
                                    className="w-full py-3 bg-gray-50 hover:bg-[#6605c7]/5 hover:text-[#6605c7] rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-500 transition-all text-center block mt-2"
                                >
                                    View All RM Discussions
                                </Link>
                            </div>
                        ) : (
                            <div className="py-8 text-center text-xs text-gray-500 font-bold bg-gray-50/50 rounded-2xl border border-dashed border-[#6605c7]/10">
                                💬 No RM discussions yet. Once you start working on leads, conversations will show up here.
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-8 flex flex-col">
                    {/* Pipeline Status Snapshot — from API pipeline counts */}
                    <div className="bg-[#fcfaff] rounded-[2.5rem] border border-[#6605c7]/5 p-8 relative overflow-hidden shadow-sm">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#6605c7]/50 mb-8">Pipeline Status Snapshot</h3>
                        <div className="space-y-4">
                            {[
                                { label: "New / Docs Pending", count: activePipeline.leads, color: "bg-indigo-500" },
                                { label: "Submitted to Bank", count: activePipeline.submitted, color: "bg-blue-500" },
                                { label: "Under Bank Review", count: activePipeline.bank_review, color: "bg-[#6605c7]" },
                                { label: "Approved / Sanctioned", count: activePipeline.approved, color: "bg-emerald-500" },
                                { label: "Disbursed ✅", count: activePipeline.disbursed, color: "bg-purple-500" },
                            ].map(({ label, count, color }) => {
                                const pct = totalPipeline > 0 ? Math.round((count / totalPipeline) * 100) : 0;
                                return (
                                    <div key={label} className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold text-gray-700">
                                            <span>{label}</span>
                                            <span>{count} students</span>
                                        </div>
                                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                            <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Live Activity Feed — from API activityFeed */}
                    <div className="bg-white border border-[#6605c7]/10 p-8 rounded-[2.5rem] shadow-sm flex-1">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#6605c7]/40 mb-6">⚡ RECENT ACTIVITY</h3>
                        {activityFeed.length > 0 ? (
                            <div className="space-y-4">
                                {activityFeed.slice(0, 6).map((item, i) => (
                                    <div key={item.id} className={`flex gap-4 items-start text-xs ${i > 0 ? "border-t border-gray-50 pt-3" : ""}`}>
                                        <span className="font-bold text-gray-400 shrink-0">
                                            {format(new Date(item.createdAt), "HH:mm")}
                                        </span>
                                        <span className="text-gray-800">
                                            <strong>{item.studentName}</strong>
                                            {" → "}
                                            {item.fromStatus} → <span className="text-[#6605c7] font-bold">{item.toStatus}</span>
                                            {item.changeReason ? ` (${item.changeReason})` : ""}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {applications.length > 0 ? applications.slice(0, 4).map((app, i) => (
                                    <div key={app.id} className={`flex gap-4 items-start text-xs ${i > 0 ? "border-t border-gray-50 pt-3" : ""}`}>
                                        <span className="font-bold text-gray-400 shrink-0">{app.lastUpdated}</span>
                                        <span className="text-gray-800">{app.firstName} {app.lastName} → <span className="text-[#6605c7] font-bold capitalize">{app.status}</span></span>
                                    </div>
                                )) : (
                                    <div className="rounded-2xl border border-dashed border-[#6605c7]/15 bg-[#f8f5ff] p-4 text-center text-xs text-gray-500 font-semibold">
                                        Activity will appear here as soon as new referrals move through the pipeline.
                                    </div>
                                )}
                            </div>
                        )}
                        <Link href="/agent/students" className="w-full mt-6 py-3 bg-gray-50 hover:bg-[#6605c7]/5 hover:text-[#6605c7] rounded-xl text-[10px] font-black uppercase tracking-wider text-gray-500 transition-all text-center block">View All Students</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
