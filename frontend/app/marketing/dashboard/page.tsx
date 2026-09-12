"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { campaignApi, adminApi, apiFetch } from "@/lib/api";

interface MarketingStats {
    totalLeads: number;
    blendedCac: number;
    emailOpenRate: number;
    whatsAppCtr: number;
    referralVolumeCr: number;
    activeCampaigns: number;
}

export default function MarketingDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [stats, setStats] = useState<MarketingStats>({
        totalLeads: 14280,
        blendedCac: 380,
        emailOpenRate: 41.2,
        whatsAppCtr: 28.4,
        referralVolumeCr: 98.4,
        activeCampaigns: 4,
    });
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [topReferrers, setTopReferrers] = useState<any[]>([]);

    const fetchMarketingData = useCallback(async () => {
        try {
            setRefreshing(true);
            const [statsRes, campRes, refRes, userStatsRes]: any = await Promise.all([
                campaignApi.getOverviewStats().catch(() => null),
                campaignApi.getAll(10, 0).catch(() => null),
                apiFetch<any>("/api/referral/leaderboard?limit=5").catch(() => null),
                adminApi.getUserStats().catch(() => null),
            ]);

            if (campRes?.data && Array.isArray(campRes.data)) {
                setCampaigns(campRes.data);
            } else if (Array.isArray(campRes)) {
                setCampaigns(campRes);
            }

            if (refRes?.leaderboard && Array.isArray(refRes.leaderboard)) {
                setTopReferrers(refRes.leaderboard);
            }

            const totalUsers = userStatsRes?.totalStudents || userStatsRes?.totalUsers || 14280;

            if (statsRes?.data) {
                const s = statsRes.data;
                setStats(prev => ({
                    ...prev,
                    totalLeads: Math.max(totalUsers, s.totalRecipients || prev.totalLeads),
                    activeCampaigns: s.totalCampaigns || campaigns.length || prev.activeCampaigns,
                    emailOpenRate: s.avgOpenRate ? Number(s.avgOpenRate.toFixed(1)) : prev.emailOpenRate,
                    whatsAppCtr: s.avgClickRate ? Number(s.avgClickRate.toFixed(1)) : prev.whatsAppCtr,
                }));
            } else {
                setStats(prev => ({
                    ...prev,
                    totalLeads: totalUsers,
                }));
            }

            setLastUpdated(new Date());
        } catch (err) {
            console.warn("Could not load dynamic marketing telemetry", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [campaigns.length]);

    useEffect(() => {
        fetchMarketingData();
        const interval = setInterval(fetchMarketingData, 30000);
        return () => clearInterval(interval);
    }, [fetchMarketingData]);

    const channelsBreakdown = [
        { channel: "Organic Search & SEO Guides", leads: 5426, share: 38, cac: "₹95", color: "bg-[#4F46E5]" },
        { channel: "Student & Alumni Referrals", leads: 3712, share: 26, cac: "₹226", color: "bg-indigo-600" },
        { channel: "WhatsApp Direct Broadcast", leads: 2150, share: 15, cac: "₹97", color: "bg-emerald-600" },
        { channel: "Meta Ads (Instagram Stories)", leads: 1850, share: 13, cac: "₹614", color: "bg-blue-600" },
        { channel: "Google Search Ads (Paid)", leads: 1142, share: 8, cac: "₹780", color: "bg-purple-600" },
    ];

    const displayCampaigns = useMemo(() => {
        if (campaigns.length > 0) {
            return campaigns.slice(0, 5).map((c) => ({
                id: c.id,
                name: c.name || c.title || "Targeted Student Blast",
                channel: c.channel || "Email & WhatsApp",
                audience: c.audienceCount ? `${c.audienceCount.toLocaleString()} Students` : "Target Cohort",
                openRate: c.openRate ? `${c.openRate}%` : "42.5%",
                status: c.status || "Active",
            }));
        }
        return [
            { id: "1", name: "HDFC Credila 9.5% Rate Drop", channel: "Email + WhatsApp", audience: "4,850 Students", openRate: "46.2%", status: "Active" },
            { id: "2", name: "DigiLocker KYC Fast-Track Reminder", channel: "In-App + Push", audience: "2,420 Students", openRate: "58.4%", status: "Active" },
            { id: "3", name: "US Visa Mock Interview Invite", channel: "Personal Email", audience: "1,240 Students", openRate: "51.0%", status: "Completed" },
            { id: "4", name: "Fall 2025 Scholarship & Forex Perks", channel: "Newsletter", audience: "9,600 Students", openRate: "34.8%", status: "Active" },
        ];
    }, [campaigns]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[#4F46E5] font-mono text-[11px] font-bold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] animate-ping" />
                            DYNAMIC GROWTH ENGINE
                        </span>
                        <span className="text-slate-400 text-xs">
                            Sync: {lastUpdated.toLocaleTimeString()}
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-[#0A2540] mt-1.5 tracking-tight font-display">
                        Acquisition, Campaigns & Growth Hub
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Omnichannel broadcast telemetry, CAC economics, audience cohorts, and student referral viral loop.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchMarketingData}
                        disabled={refreshing}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Reload live marketing telemetry"
                    >
                        <span className={`material-symbols-outlined text-base ${refreshing ? "animate-spin text-[#4F46E5]" : ""}`}>
                            refresh
                        </span>
                        <span className="hidden sm:inline">Refresh</span>
                    </button>

                    <Link
                        href="/marketing/campaigns"
                        className="px-4 py-2 bg-[#4F46E5] hover:bg-indigo-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">auto_awesome</span>
                        <span>Create Campaign</span>
                    </Link>
                </div>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1 */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Marketing Leads</span>
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5]">
                            <span className="material-symbols-outlined text-[18px]">groups</span>
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-[26px] font-bold text-[#0A2540] tracking-tight">
                            {stats.totalLeads.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 text-xs">
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold flex items-center text-[10px]">
                                <span className="material-symbols-outlined text-xs">trending_up</span> +22.4%
                            </span>
                            <span className="text-slate-500 text-[11px]">live registered pool</span>
                        </div>
                    </div>
                </div>

                {/* Metric 2 */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Blended CAC</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                            <span className="material-symbols-outlined text-[18px]">savings</span>
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-[26px] font-bold text-[#0A2540] tracking-tight">₹{stats.blendedCac}</div>
                        <div className="flex items-center gap-1.5 mt-2 text-xs">
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold flex items-center text-[10px]">
                                <span className="material-symbols-outlined text-xs">trending_down</span> -12.5%
                            </span>
                            <span className="text-slate-500 text-[11px]">per verified student lead</span>
                        </div>
                    </div>
                </div>

                {/* Metric 3 */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email Open Rate</span>
                        <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                            <span className="material-symbols-outlined text-[18px]">mark_email_read</span>
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-[26px] font-bold text-[#0A2540] tracking-tight">{stats.emailOpenRate}%</div>
                        <div className="flex items-center gap-1.5 mt-2 text-xs">
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold flex items-center text-[10px]">
                                <span className="material-symbols-outlined text-xs">trending_up</span> +5.8%
                            </span>
                            <span className="text-slate-500 text-[11px]">industry avg: 22%</span>
                        </div>
                    </div>
                </div>

                {/* Metric 4 */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Referral Sanctions</span>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                            <span className="material-symbols-outlined text-[18px]">share</span>
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-[26px] font-bold text-[#0A2540] tracking-tight">₹{stats.referralVolumeCr} Cr</div>
                        <div className="flex items-center gap-1.5 mt-2 text-xs">
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold flex items-center text-[10px]">
                                <span className="material-symbols-outlined text-xs">trending_up</span> +31.2%
                            </span>
                            <span className="text-slate-500 text-[11px]">via peer advocates</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Channels & Attribution Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Acquisition Channels (2 cols) */}
                <div className="lg:col-span-2 bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-base font-bold text-[#0A2540]">Acquisition Channel Attribution & CAC</h2>
                            <p className="text-xs text-slate-500">Student origination volume and cost efficiency per channel</p>
                        </div>
                        <Link href="/marketing/channels" className="text-xs text-[#4F46E5] font-semibold hover:underline flex items-center gap-1">
                            <span>Deep Attribution</span>
                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                    </div>

                    <div className="space-y-4">
                        {channelsBreakdown.map((ch) => (
                            <div key={ch.channel} className="space-y-1.5">
                                <div className="flex justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-900">{ch.channel}</span>
                                        <span className="text-slate-500">({ch.cac})</span>
                                    </div>
                                    <span className="font-mono text-slate-700 font-bold">
                                        {ch.leads.toLocaleString()} leads ({ch.share}%)
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full ${ch.color}`}
                                        style={{ width: `${ch.share}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Marketing Tools (1 col) */}
                <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm flex flex-col justify-between space-y-4">
                    <div>
                        <div className="flex items-center gap-2 mb-3 text-[#4F46E5] font-bold text-sm">
                            <span className="material-symbols-outlined">auto_awesome</span>
                            <span>Growth Playbooks</span>
                        </div>
                        <p className="text-xs text-slate-500 mb-4">
                            High-velocity marketing automation and broadcast workflows ready for 1-click launch.
                        </p>

                        <div className="space-y-2.5">
                            <Link
                                href="/marketing/campaigns"
                                className="w-full p-3 bg-slate-50 border border-slate-200/80 hover:border-indigo-300 rounded-xl flex items-center justify-between text-xs group transition-all"
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className="material-symbols-outlined text-[#4F46E5] text-lg">percent</span>
                                    <div>
                                        <div className="font-semibold text-slate-900 group-hover:text-[#4F46E5] transition-colors">Bank 9.5% Rate Drop</div>
                                        <div className="text-slate-400 text-[10px]">Reach 4,850 STEM students</div>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-0.5 transition-transform text-sm">arrow_forward</span>
                            </Link>

                            <Link
                                href="/marketing/referrals"
                                className="w-full p-3 bg-slate-50 border border-slate-200/80 hover:border-indigo-300 rounded-xl flex items-center justify-between text-xs group transition-all"
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className="material-symbols-outlined text-indigo-600 text-lg">redeem</span>
                                    <div>
                                        <div className="font-semibold text-slate-900 group-hover:text-[#4F46E5] transition-colors">₹5,000 Advocate Payout</div>
                                        <div className="text-slate-400 text-[10px]">Viral alumni incentive</div>
                                    </div>
                                </div>
                                <span className="material-symbols-outlined text-slate-400 group-hover:translate-x-0.5 transition-transform text-sm">arrow_forward</span>
                            </Link>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                        <Link
                            href="/marketing/leads"
                            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">filter_alt</span>
                            <span>Target Custom Audience Cohort</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Live Campaigns Table */}
            <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-base font-bold text-[#0A2540]">Recent Automated Campaigns & Blasts</h2>
                        <p className="text-xs text-slate-500">Live delivery metrics, open rates, and channel performance</p>
                    </div>
                    <Link href="/marketing/campaigns" className="text-xs text-[#4F46E5] font-semibold hover:underline flex items-center gap-1">
                        <span>All Campaigns</span>
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                            <tr>
                                <th className="py-2.5 px-3">Campaign Name</th>
                                <th className="py-2.5 px-3">Channel</th>
                                <th className="py-2.5 px-3">Target Audience</th>
                                <th className="py-2.5 px-3">Open / Engagement</th>
                                <th className="py-2.5 px-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {displayCampaigns.map((camp) => (
                                <tr key={camp.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="py-3 px-3 font-semibold text-slate-900">{camp.name}</td>
                                    <td className="py-3 px-3 text-slate-600">{camp.channel}</td>
                                    <td className="py-3 px-3 font-mono text-slate-700">{camp.audience}</td>
                                    <td className="py-3 px-3 font-mono font-bold text-[#4F46E5]">{camp.openRate}</td>
                                    <td className="py-3 px-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            camp.status === "Active" || camp.status === "running"
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                : "bg-slate-100 text-slate-600 border border-slate-200"
                                        }`}>
                                            {camp.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
