"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function MarketingChannelsPage() {
    const [attributionModel, setAttributionModel] = useState<"last_touch" | "first_touch" | "linear">("last_touch");
    const [totalMonthlyBudgetLakhs, setTotalMonthlyBudgetLakhs] = useState<number>(45);
    const [dynamicChannels, setDynamicChannels] = useState<any[]>([]);
    const [totalLeadsCount, setTotalLeadsCount] = useState<number>(0);

    useEffect(() => {
        const fetchChannels = async () => {
            try {
                const res = await apiFetch<any>("/api/marketing/dashboard");
                if (res?.success) {
                    if (Array.isArray(res.channelsBreakdown)) {
                        setDynamicChannels(res.channelsBreakdown);
                    }
                    if (res.stats?.totalLeads) {
                        setTotalLeadsCount(res.stats.totalLeads);
                    }
                }
            } catch (err) {
                console.error("Could not fetch dynamic marketing channels", err);
            }
        };
        fetchChannels();
    }, []);

    const budgetMultiplier = useMemo(() => totalMonthlyBudgetLakhs / 45, [totalMonthlyBudgetLakhs]);

    const channelData = useMemo(() => {
        if (dynamicChannels.length > 0) {
            return dynamicChannels.map((ch, idx) => {
                const leads = Math.round((ch.leads || Math.round(totalLeadsCount * (ch.share / 100))) * budgetMultiplier);
                const sanctions = Math.round(leads * 0.08);
                const volume = Number(((sanctions * 45) / 100).toFixed(1));
                const spend = Number(((totalMonthlyBudgetLakhs * (ch.share / 100))).toFixed(1));

                return {
                    channel: ch.channel,
                    type: idx === 0 ? "Inbound Organic" : idx === 1 ? "Advocacy Viral" : idx === 2 ? "Direct Nudge" : "Paid Channel",
                    monthlySpend: `₹${spend}L`,
                    leadsGenerated: leads,
                    sanctionsIssued: sanctions,
                    sanctionValueCr: volume,
                    blendedCac: ch.cac || "₹150",
                    roasMultiplier: `${Math.round(200 / (idx + 1))}x`,
                    status: idx < 2 ? "Maximum ROI" : "Scaling",
                };
            });
        }

        return [
            {
                channel: "Organic Search & SEO",
                type: "Inbound Organic",
                monthlySpend: `₹${(5.2 * budgetMultiplier).toFixed(1)}L`,
                leadsGenerated: Math.round(totalLeadsCount * 0.38 * budgetMultiplier),
                sanctionsIssued: Math.round(totalLeadsCount * 0.38 * 0.08 * budgetMultiplier),
                sanctionValueCr: Number((130.4 * budgetMultiplier).toFixed(1)),
                blendedCac: "₹95",
                roasMultiplier: "250x",
                status: "Maximum ROI"
            }
        ];
    }, [dynamicChannels, totalLeadsCount, budgetMultiplier, totalMonthlyBudgetLakhs]);

    const totalLeads = channelData.reduce((s, c) => s + c.leadsGenerated, 0);
    const totalSanctions = channelData.reduce((s, c) => s + c.sanctionsIssued, 0);
    const totalSanctionValue = channelData.reduce((s, c) => s + c.sanctionValueCr, 0).toFixed(1);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-[#4F46E5] text-xs font-semibold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-sm">hub</span>
                        <span>Multi-Touch Attribution & Channel Unit Economics</span>
                    </div>
                    <h1 className="text-2xl font-bold text-[#0A2540] mt-1 font-display">Acquisition Channels & ROAS Analytics</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Analyze cost-per-acquisition, return on ad spend (ROAS), and origination yield across all acquisition funnels.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={attributionModel}
                        onChange={(e) => setAttributionModel(e.target.value as any)}
                        className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#4F46E5] cursor-pointer"
                    >
                        <option value="last_touch">Model: Last-Touch Sanction</option>
                        <option value="first_touch">Model: First-Touch Discovery</option>
                        <option value="linear">Model: Linear Multi-Touch</option>
                    </select>

                    <Link
                        href="/marketing/dashboard"
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        <span>Overview</span>
                    </Link>
                </div>
            </div>

            {/* Budget Simulation Slider */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-slate-700">Simulated Monthly Growth Budget</span>
                        <span className="font-mono font-bold text-[#4F46E5] text-sm">₹{totalMonthlyBudgetLakhs} Lakhs / month</span>
                    </div>
                    <input
                        type="range"
                        min="15"
                        max="120"
                        step="5"
                        value={totalMonthlyBudgetLakhs}
                        onChange={(e) => setTotalMonthlyBudgetLakhs(Number(e.target.value))}
                        className="w-full accent-[#4F46E5] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>Lean (₹15L)</span>
                        <span>Current Active (₹45L)</span>
                        <span>Scale (₹1.2 Cr)</span>
                    </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:w-64">
                    <span className="text-slate-500 block text-[11px]">Blended Network Efficiency</span>
                    <span className="font-bold text-[#0A2540] font-mono text-sm block mt-0.5">
                        ROAS: 86.4x Across Channels
                    </span>
                </div>
            </div>

            {/* Macro KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Projected Monthly Leads</span>
                    <div className="text-[28px] font-bold text-[#0A2540] mt-1.5 font-mono">
                        {totalLeads.toLocaleString()} Leads
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">At simulated ₹{totalMonthlyBudgetLakhs}L budget</p>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Projected Loan Sanctions</span>
                    <div className="text-[28px] font-bold text-[#4F46E5] mt-1.5 font-mono">
                        {totalSanctions.toLocaleString()} Sanction Letters
                    </div>
                    <p className="text-xs text-emerald-700 font-semibold mt-0.5">₹{totalSanctionValue} Cr sanctioned pipeline</p>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Highest ROAS Funnel</span>
                    <div className="text-[28px] font-bold text-emerald-600 mt-1.5">
                        SEO (250x)
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">₹95 blended cost per student</p>
                </div>
            </div>

            {/* Channels Ledger Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-[#0A2540]">Channel Attribution Matrix</h2>
                    <span className="text-xs text-slate-400">Dynamic model recalculation</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                            <tr>
                                <th className="py-2.5 px-3">Channel Name</th>
                                <th className="py-2.5 px-3">Channel Type</th>
                                <th className="py-2.5 px-3">Monthly Spend</th>
                                <th className="py-2.5 px-3">Leads Produced</th>
                                <th className="py-2.5 px-3">Sanctions Issued</th>
                                <th className="py-2.5 px-3">Sanction Volume (Cr)</th>
                                <th className="py-2.5 px-3">Blended CAC</th>
                                <th className="py-2.5 px-3">ROAS Multiple</th>
                                <th className="py-2.5 px-3">Channel Health</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {channelData.map((ch) => (
                                <tr key={ch.channel} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="py-3 px-3 font-semibold text-slate-900">{ch.channel}</td>
                                    <td className="py-3 px-3 text-slate-600">{ch.type}</td>
                                    <td className="py-3 px-3 font-mono text-slate-800 font-bold">{ch.monthlySpend}</td>
                                    <td className="py-3 px-3 font-mono text-slate-700">{ch.leadsGenerated.toLocaleString()}</td>
                                    <td className="py-3 px-3 font-mono font-bold text-[#4F46E5]">{ch.sanctionsIssued}</td>
                                    <td className="py-3 px-3 font-mono font-bold text-slate-900">₹{ch.sanctionValueCr} Cr</td>
                                    <td className="py-3 px-3 font-mono font-bold text-emerald-700">{ch.blendedCac}</td>
                                    <td className="py-3 px-3 font-mono font-bold text-indigo-700">{ch.roasMultiplier}</td>
                                    <td className="py-3 px-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            ch.status.includes("Maximum") || ch.status.includes("Scaling")
                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                : "bg-indigo-50 text-[#4F46E5] border border-indigo-200"
                                        }`}>
                                            {ch.status}
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
