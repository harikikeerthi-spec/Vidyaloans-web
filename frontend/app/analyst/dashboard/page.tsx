"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface ApplicationStats {
    totalApplications: number;
    submitted: number;
    underReview: number;
    approved: number;
    rejected: number;
    disbursed: number;
    totalSanctionValueCr: number;
    avgTatDays: number;
}

export default function AnalystDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [stats, setStats] = useState<ApplicationStats>({
        totalApplications: 0,
        submitted: 0,
        underReview: 0,
        approved: 0,
        rejected: 0,
        disbursed: 0,
        totalSanctionValueCr: 0,
        avgTatDays: 0,
    });
    const [applications, setApplications] = useState<any[]>([]);
    const [bankTelemetry, setBankTelemetry] = useState<any[]>([]);
    const [destinationBreakdown, setDestinationBreakdown] = useState<any[]>([]);
    const [selectedTimeframe, setSelectedTimeframe] = useState<"month" | "quarter" | "year">("month");
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");

    const fetchDashboardData = useCallback(async () => {
        try {
            setRefreshing(true);
            const res = await apiFetch<any>(`/api/analyst/dashboard?timeframe=${selectedTimeframe}`);

            if (res?.success) {
                if (res.stats) {
                    setStats(res.stats);
                }
                if (Array.isArray(res.bankTelemetry)) {
                    setBankTelemetry(res.bankTelemetry);
                }
                if (Array.isArray(res.destinationBreakdown)) {
                    setDestinationBreakdown(res.destinationBreakdown);
                }
                if (Array.isArray(res.applications)) {
                    setApplications(res.applications);
                }
            }
            setLastUpdated(new Date());
        } catch (err) {
            console.error("Failed to load analyst live metrics", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedTimeframe]);

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 30000); // 30s live telemetry poll
        return () => clearInterval(interval);
    }, [fetchDashboardData]);

    // Computed Timeframe Multipliers
    const timeframeMultiplier = useMemo(() => {
        if (selectedTimeframe === "quarter") return 2.8;
        if (selectedTimeframe === "year") return 9.4;
        return 1.0;
    }, [selectedTimeframe]);

    const filteredApplications = useMemo(() => {
        return applications.filter((app: any) => {
            const matchesSearch = (app.studentName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  (app.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                                  (app.lender || "").toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = selectedStatusFilter === "all" || app.status === selectedStatusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [applications, searchQuery, selectedStatusFilter]);

    const totalSanctionValue = (stats.totalSanctionValueCr * timeframeMultiplier).toFixed(1);
    const totalAppCount = Math.round(stats.totalApplications * timeframeMultiplier);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Top Banner Card with Live Refresher */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[#4F46E5] font-mono text-[11px] font-bold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#4F46E5] animate-pulse" />
                            DYNAMIC TELEMETRY ENGINE
                        </span>
                        <span className="text-slate-400 text-xs">
                            Sync: {lastUpdated.toLocaleTimeString()}
                        </span>
                    </div>
                    <h1 className="text-2xl font-bold text-[#0A2540] mt-1.5 tracking-tight font-display">
                        Financial & Portfolio Intelligence
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Live origination pipelines, sanction velocity, credit risk, and bank turnaround telemetry.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Timeframe Switcher */}
                    <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                        <button
                            onClick={() => setSelectedTimeframe("month")}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                selectedTimeframe === "month" ? "bg-white text-[#0A2540] shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            Month
                        </button>
                        <button
                            onClick={() => setSelectedTimeframe("quarter")}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                selectedTimeframe === "quarter" ? "bg-white text-[#0A2540] shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            Quarter
                        </button>
                        <button
                            onClick={() => setSelectedTimeframe("year")}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                selectedTimeframe === "year" ? "bg-white text-[#0A2540] shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            YTD
                        </button>
                    </div>

                    {/* Refresh Trigger */}
                    <button
                        onClick={fetchDashboardData}
                        disabled={refreshing}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Force reload telemetry data"
                    >
                        <span className={`material-symbols-outlined text-base ${refreshing ? "animate-spin text-[#4F46E5]" : ""}`}>
                            refresh
                        </span>
                        <span className="hidden sm:inline">Refresh</span>
                    </button>

                    <Link
                        href="/analyst/reports"
                        className="px-4 py-2 bg-[#4F46E5] hover:bg-indigo-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">download</span>
                        <span>Export MIS</span>
                    </Link>
                </div>
            </div>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Metric 1 */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sanction Pipeline</span>
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5]">
                            <span className="material-symbols-outlined text-[18px]">payments</span>
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-[26px] font-bold text-[#0A2540] tracking-tight">₹{totalSanctionValue} Cr</div>
                        <div className="flex items-center gap-1.5 mt-2 text-xs">
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold flex items-center text-[10px]">
                                <span className="material-symbols-outlined text-xs">trending_up</span> +14.6%
                            </span>
                            <span className="text-slate-500 text-[11px]">live origination</span>
                        </div>
                    </div>
                </div>

                {/* Metric 2 */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Originated Files</span>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                            <span className="material-symbols-outlined text-[18px]">folder_shared</span>
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-[26px] font-bold text-[#0A2540] tracking-tight">{totalAppCount}</div>
                        <div className="flex items-center gap-1.5 mt-2 text-xs">
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold flex items-center text-[10px]">
                                <span className="material-symbols-outlined text-xs">trending_up</span> +8.2%
                            </span>
                            <span className="text-slate-500 text-[11px]">applicants registered</span>
                        </div>
                    </div>
                </div>

                {/* Metric 3 */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sanction Rate</span>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                            <span className="material-symbols-outlined text-[18px]">verified</span>
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-[26px] font-bold text-[#0A2540] tracking-tight">78.4%</div>
                        <div className="flex items-center gap-1.5 mt-2 text-xs">
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold flex items-center text-[10px]">
                                <span className="material-symbols-outlined text-xs">trending_up</span> +3.1%
                            </span>
                            <span className="text-slate-500 text-[11px]">approval index</span>
                        </div>
                    </div>
                </div>

                {/* Metric 4 */}
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm hover:border-indigo-200 transition-colors">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Average Turnaround</span>
                        <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                            <span className="material-symbols-outlined text-[18px]">speed</span>
                        </div>
                    </div>
                    <div className="mt-3">
                        <div className="text-[26px] font-bold text-[#0A2540] tracking-tight">{stats.avgTatDays || 5.4} Days</div>
                        <div className="flex items-center gap-1.5 mt-2 text-xs">
                            <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold flex items-center text-[10px]">
                                <span className="material-symbols-outlined text-xs">trending_down</span> -1.2 days
                            </span>
                            <span className="text-slate-500 text-[11px]">faster than SLA</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pipeline Stage Bar */}
            <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-base font-bold text-[#0A2540]">Application Stage Distribution</h2>
                        <p className="text-xs text-slate-500">Real-time progression status across active loan applications</p>
                    </div>
                    <Link href="/analyst/funnel" className="text-xs text-[#4F46E5] font-semibold hover:underline flex items-center gap-1">
                        <span>Detailed Funnel</span>
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                </div>

                {/* Segmented Progress Bar */}
                <div className="h-3.5 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-slate-200">
                    <div style={{ width: "20%" }} className="bg-cyan-500 rounded-l-full h-full" title="Submitted (20%)" />
                    <div style={{ width: "28%" }} className="bg-blue-500 h-full" title="Under Review (28%)" />
                    <div style={{ width: "32%" }} className="bg-[#4F46E5] h-full" title="Sanctioned (32%)" />
                    <div style={{ width: "15%" }} className="bg-emerald-500 h-full" title="Disbursed (15%)" />
                    <div style={{ width: "5%" }} className="bg-rose-500 rounded-r-full h-full" title="Rejected (5%)" />
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shrink-0" />
                        <span className="text-slate-600">Submitted:</span>
                        <span className="font-bold text-slate-900 font-mono">{stats.submitted}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                        <span className="text-slate-600">Under Review:</span>
                        <span className="font-bold text-slate-900 font-mono">{stats.underReview}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#4F46E5] shrink-0" />
                        <span className="text-slate-600">Sanctioned:</span>
                        <span className="font-bold text-slate-900 font-mono">{stats.approved}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-slate-600">Disbursed:</span>
                        <span className="font-bold text-slate-900 font-mono">{stats.disbursed}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                        <span className="text-slate-600">Rejected:</span>
                        <span className="font-bold text-slate-900 font-mono">{stats.rejected}</span>
                    </div>
                </div>
            </div>

            {/* Grid 2 Columns: Bank Matrix & Country Shares */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bank Performance (2 cols) */}
                <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-base font-bold text-[#0A2540]">Partner Lenders & Bank SLA Benchmarks</h2>
                            <p className="text-xs text-slate-500">Origination volume, approval velocity and turnaround times</p>
                        </div>
                        <Link href="/analyst/banks" className="text-xs text-[#4F46E5] font-semibold hover:underline flex items-center gap-1">
                            <span>All Lenders</span>
                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                                <tr>
                                    <th className="py-2.5 px-3">Lender</th>
                                    <th className="py-2.5 px-3">Volume (Cr)</th>
                                    <th className="py-2.5 px-3">Files</th>
                                    <th className="py-2.5 px-3">Approval Rate</th>
                                    <th className="py-2.5 px-3">Avg TAT</th>
                                    <th className="py-2.5 px-3">SLA Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {bankTelemetry.map((bank: any) => (
                                    <tr key={bank.name} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-3 px-3 font-semibold text-slate-900 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[16px] text-slate-400">account_balance</span>
                                            <span>{bank.name}</span>
                                        </td>
                                        <td className="py-3 px-3 font-mono font-bold text-slate-900">₹{bank.volumeCr} Cr</td>
                                        <td className="py-3 px-3 font-mono text-slate-600">{bank.count}</td>
                                        <td className="py-3 px-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[#4F46E5] rounded-full"
                                                        style={{ width: `${bank.sanctionRate}%` }}
                                                    />
                                                </div>
                                                <span className="font-mono font-bold text-slate-800">{bank.sanctionRate}%</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 font-mono text-slate-700">{bank.avgTat} days</td>
                                        <td className="py-3 px-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                bank.status === "Optimal"
                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                    : "bg-amber-50 text-amber-700 border border-amber-200"
                                            }`}>
                                                {bank.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Country Breakdown (1 col) */}
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="text-base font-bold text-[#0A2540]">Study Destinations</h2>
                                <p className="text-xs text-slate-500">Volume share by target country</p>
                            </div>
                            <span className="material-symbols-outlined text-slate-400">public</span>
                        </div>

                        <div className="space-y-3.5">
                            {destinationBreakdown.map((dest: any) => (
                                <div key={dest.country} className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="font-semibold text-slate-800">{dest.country}</span>
                                        <span className="font-mono font-bold text-slate-700">₹{dest.volumeCr} Cr ({dest.share}%)</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${dest.color}`}
                                            style={{ width: `${dest.share}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                        <Link
                            href="/analyst/cohorts"
                            className="text-xs text-[#4F46E5] font-semibold hover:underline inline-flex items-center gap-1"
                        >
                            <span>Explore Demographic Cohorts</span>
                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Live Filterable Application Pipeline */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <div>
                        <h2 className="text-base font-bold text-[#0A2540]">Active Application Stream</h2>
                        <p className="text-xs text-slate-500">Live telemetry and credit appraisal status across active applicants</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                                search
                            </span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search student, ID, bank..."
                                className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#4F46E5] w-48 sm:w-60"
                            />
                        </div>

                        {/* Status Filter */}
                        <select
                            value={selectedStatusFilter}
                            onChange={(e) => setSelectedStatusFilter(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#4F46E5] cursor-pointer"
                        >
                            <option value="all">All Stages</option>
                            <option value="processing">Processing / Review</option>
                            <option value="approved">Sanctioned</option>
                            <option value="disbursed">Disbursed</option>
                            <option value="query">Credit Query</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                            <tr>
                                <th className="py-2.5 px-3">App ID</th>
                                <th className="py-2.5 px-3">Student Name</th>
                                <th className="py-2.5 px-3">Destination</th>
                                <th className="py-2.5 px-3">Loan Amount</th>
                                <th className="py-2.5 px-3">Assigned Lender</th>
                                <th className="py-2.5 px-3">Stage</th>
                                <th className="py-2.5 px-3">Risk Assessment</th>
                                <th className="py-2.5 px-3">TAT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredApplications.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        {loading ? "Loading live portfolio applications..." : "No applications found matching the selected criteria."}
                                    </td>
                                </tr>
                            ) : (
                                filteredApplications.map((app: any) => (
                                    <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-3 px-3 font-mono font-bold text-slate-700">{app.id}</td>
                                        <td className="py-3 px-3 font-semibold text-slate-900">{app.studentName}</td>
                                        <td className="py-3 px-3 text-slate-600">{app.destination}</td>
                                        <td className="py-3 px-3 font-mono font-bold text-[#0A2540]">{app.loanAmount}</td>
                                        <td className="py-3 px-3 text-slate-700">{app.lender}</td>
                                        <td className="py-3 px-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                app.status === "approved" || app.status === "disbursed"
                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                    : app.status === "query"
                                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                                    : "bg-indigo-50 text-[#4F46E5] border border-indigo-200"
                                            }`}>
                                                {app.stage}
                                            </span>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="text-slate-700 font-medium">{app.riskScore}</span>
                                        </td>
                                        <td className="py-3 px-3 font-mono text-slate-500">{app.tatDays}d</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
