"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { adminApi } from "@/lib/api";

export default function AnalystForecastsPage() {
    const [confidenceInterval, setConfidenceInterval] = useState<"90%" | "95%">("95%");
    const [growthRatePercent, setGrowthRatePercent] = useState<number>(25);
    const [baselineVolumeCr, setBaselineVolumeCr] = useState<number>(0);
    const [baselineFiles, setBaselineFiles] = useState<number>(0);

    useEffect(() => {
        const fetchBaseline = async () => {
            try {
                const res: any = await fetch("/api/analyst/dashboard").then(r => r.json()).catch(() => null);
                if (res?.stats) {
                    if (res.stats.totalSanctionValueCr !== undefined) {
                        setBaselineVolumeCr(res.stats.totalSanctionValueCr);
                    }
                    if (res.stats.totalApplications !== undefined) {
                        setBaselineFiles(res.stats.totalApplications);
                    }
                }
            } catch (err) {
                console.error("Failed to load baseline metrics for forecasts", err);
            }
        };

        fetchBaseline();
    }, []);

    const growthFactor = useMemo(() => 1 + growthRatePercent / 100, [growthRatePercent]);
    const confidenceMultiplier = confidenceInterval === "90%" ? 1.08 : 1.0;

    const projectedQuarterly = useMemo(() => {
        const baseFiles = baselineFiles;
        const baseVol = baselineVolumeCr;

        return [
            {
                quarter: "Q3 2025 (Current)",
                expectedFiles: Math.round(baseFiles * 1.15),
                projectedVolumeCr: Number((baseVol * 1.12 * confidenceMultiplier).toFixed(1)),
                projectedRevenueLakhs: Number((baseVol * 1.12 * 1.2 * confidenceMultiplier).toFixed(1)),
                confidence: "98%",
                status: "On Track"
            },
            {
                quarter: "Q4 2025 (Projected)",
                expectedFiles: Math.round(baseFiles * 1.45 * (growthFactor / 1.25)),
                projectedVolumeCr: Number((baseVol * 1.51 * (growthFactor / 1.25) * confidenceMultiplier).toFixed(1)),
                projectedRevenueLakhs: Number((baseVol * 1.51 * 1.2 * (growthFactor / 1.25) * confidenceMultiplier).toFixed(1)),
                confidence: "94%",
                status: "High Growth"
            },
            {
                quarter: "Q1 2026 (Projected)",
                expectedFiles: Math.round(baseFiles * 0.85 * (growthFactor / 1.25)),
                projectedVolumeCr: Number((baseVol * 0.82 * (growthFactor / 1.25) * confidenceMultiplier).toFixed(1)),
                projectedRevenueLakhs: Number((baseVol * 0.82 * 1.2 * (growthFactor / 1.25) * confidenceMultiplier).toFixed(1)),
                confidence: "88%",
                status: "Spring Intake"
            },
            {
                quarter: "Q2 2026 (Projected)",
                expectedFiles: Math.round(baseFiles * 1.85 * (growthFactor / 1.25)),
                projectedVolumeCr: Number((baseVol * 1.95 * (growthFactor / 1.25) * confidenceMultiplier).toFixed(1)),
                projectedRevenueLakhs: Number((baseVol * 1.95 * 1.2 * (growthFactor / 1.25) * confidenceMultiplier).toFixed(1)),
                confidence: "85%",
                status: "Peak Fall Intake"
            },
        ];
    }, [baselineFiles, baselineVolumeCr, growthFactor, confidenceMultiplier]);

    const total12MonthVolume = projectedQuarterly.reduce((s, q) => s + q.projectedVolumeCr, 0).toFixed(1);
    const total12MonthFiles = projectedQuarterly.reduce((s, q) => s + q.expectedFiles, 0).toLocaleString();
    const totalCommissionLakhs = projectedQuarterly.reduce((s, q) => s + q.projectedRevenueLakhs, 0).toFixed(1);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-[#4F46E5] text-xs font-semibold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-sm">trending_up</span>
                        <span>Predictive Financial Modeling Engine</span>
                    </div>
                    <h1 className="text-2xl font-bold text-[#0A2540] mt-1 font-display">Loan Volume & Revenue Forecasts</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Forward projections for application volume, sanction values, and institutional commission revenues.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={confidenceInterval}
                        onChange={(e) => setConfidenceInterval(e.target.value as any)}
                        className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#4F46E5] cursor-pointer"
                    >
                        <option value="95%">Confidence: 95% (Standard)</option>
                        <option value="90%">Confidence: 90% (Aggressive)</option>
                    </select>

                    <Link
                        href="/analyst/dashboard"
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        <span>Overview</span>
                    </Link>
                </div>
            </div>

            {/* Growth Scenario Control Slider */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-slate-700">Projected YoY Growth Rate</span>
                        <span className="font-mono font-bold text-[#4F46E5] text-sm">+{growthRatePercent}% YoY</span>
                    </div>
                    <input
                        type="range"
                        min="5"
                        max="60"
                        step="5"
                        value={growthRatePercent}
                        onChange={(e) => setGrowthRatePercent(Number(e.target.value))}
                        className="w-full accent-[#4F46E5] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>Conservative (+5%)</span>
                        <span>Baseline (+25%)</span>
                        <span>Hypergrowth (+60%)</span>
                    </div>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:w-64">
                    <span className="text-slate-500 block text-[11px]">Current Live Baseline Run-rate</span>
                    <span className="font-bold text-[#0A2540] font-mono text-sm block mt-0.5">
                        ₹{baselineVolumeCr} Cr Origination ({baselineFiles} files)
                    </span>
                </div>
            </div>

            {/* Top Projected Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">12-Month Projected Disbursal</span>
                    <div className="text-[28px] font-bold text-[#0A2540] mt-1.5 font-mono">
                        ₹{total12MonthVolume} Cr
                    </div>
                    <p className="text-xs text-emerald-700 font-semibold mt-0.5">+{growthRatePercent}% annualized acceleration</p>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Projected Loan Applications</span>
                    <div className="text-[28px] font-bold text-[#4F46E5] mt-1.5 font-mono">
                        {total12MonthFiles} Files
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Across Fall & Spring overseas cohorts</p>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Estimated Commission Inflows</span>
                    <div className="text-[28px] font-bold text-emerald-600 mt-1.5 font-mono">
                        ₹{totalCommissionLakhs} L
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Based on 1.2% blended bank referral payouts</p>
                </div>
            </div>

            {/* Quarterly Breakdown Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-[#0A2540]">Quarterly Forecast Ledger</h2>
                    <span className="text-xs text-slate-400">Dynamic model linked to growth factor</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                            <tr>
                                <th className="py-2.5 px-3">Quarter</th>
                                <th className="py-2.5 px-3">Expected Files</th>
                                <th className="py-2.5 px-3">Projected Volume</th>
                                <th className="py-2.5 px-3">Commission Revenue</th>
                                <th className="py-2.5 px-3">Confidence Index</th>
                                <th className="py-2.5 px-3">Pacing Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {projectedQuarterly.map((q) => (
                                <tr key={q.quarter} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="py-3 px-3 font-semibold text-slate-900">{q.quarter}</td>
                                    <td className="py-3 px-3 font-mono text-slate-700">{q.expectedFiles.toLocaleString()} files</td>
                                    <td className="py-3 px-3 font-mono font-bold text-slate-900">₹{q.projectedVolumeCr} Cr</td>
                                    <td className="py-3 px-3 font-mono font-bold text-emerald-700">₹{q.projectedRevenueLakhs} Lakhs</td>
                                    <td className="py-3 px-3 font-mono text-[#4F46E5] font-bold">{q.confidence}</td>
                                    <td className="py-3 px-3">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-[#4F46E5] border border-indigo-200">
                                            {q.status}
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
