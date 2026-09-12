"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface LenderStats {
    id: string;
    name: string;
    type: string;
    totalVolumeCr: number;
    filesAssigned: number;
    sanctionsIssued: number;
    sanctionRate: number;
    avgTatDays: number;
    targetSlaDays: number;
    slaBreachRate: number;
    avgRoi: string;
    collateralFreeLimit: string;
    topRejectionReason: string;
    status: string;
}

export default function AnalystBanksPage() {
    const [selectedLender, setSelectedLender] = useState("all");
    const [lenders, setLenders] = useState<LenderStats[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBanksData = async () => {
            try {
                setLoading(true);
                const res = await apiFetch<any>("/api/analyst/banks");
                if (res?.success && Array.isArray(res.lenders)) {
                    setLenders(res.lenders);
                }
            } catch (err) {
                console.error("Could not load dynamic banks data", err);
            } finally {
                setLoading(false);
            }
        };

        fetchBanksData();
    }, []);

    const filteredLenders = useMemo(() => {
        if (selectedLender === "all") return lenders;
        return lenders.filter(l => l.id === selectedLender || l.name.toLowerCase().includes(selectedLender.toLowerCase()));
    }, [lenders, selectedLender]);

    const totalNetworkVolume = lenders.reduce((sum, l) => sum + l.totalVolumeCr, 0).toFixed(1);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-[#4F46E5] text-xs font-semibold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-sm">account_balance</span>
                        <span>Lender Performance & SLA Monitoring</span>
                    </div>
                    <h1 className="text-2xl font-bold text-[#0A2540] mt-1 font-display">Bank SLA & Turnaround Benchmarks</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Track approval velocity, sanctioned volume, turnaround adherence, and credit rejection triggers per lender.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={selectedLender}
                        onChange={(e) => setSelectedLender(e.target.value)}
                        className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#4F46E5] cursor-pointer"
                    >
                        <option value="all">All Lenders ({lenders.length})</option>
                        {lenders.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
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

            {/* Macro Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Sanctioned Network Volume</span>
                    <div className="text-[28px] font-bold text-[#0A2540] mt-1.5 font-mono">
                        ₹{totalNetworkVolume} Cr
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Across {lenders.length} partner lending institutions</p>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fastest Turnaround Partner</span>
                    <div className="text-[26px] font-bold text-[#4F46E5] mt-1.5">
                        {lenders[0]?.name || "HDFC Credila"}
                    </div>
                    <p className="text-xs text-emerald-700 font-semibold mt-0.5">{lenders[0]?.avgTatDays || 4.2} days average turnaround</p>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Network SLA Breach Rate</span>
                    <div className="text-[28px] font-bold text-slate-900 mt-1.5 font-mono">
                        6.4%
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Files exceeding 5 business day underwriting target</p>
                </div>
            </div>

            {/* Lender Performance Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-[#0A2540]">Lender Operational SLA Matrix</h2>
                    <span className="text-xs text-slate-400">Live database integration</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                            <tr>
                                <th className="py-3 px-3">Lender Name</th>
                                <th className="py-3 px-3">Type</th>
                                <th className="py-3 px-3">Originated Volume</th>
                                <th className="py-3 px-3">Sanctions / Total</th>
                                <th className="py-3 px-3">Sanction Rate</th>
                                <th className="py-3 px-3">Avg TAT</th>
                                <th className="py-3 px-3">Collateral-Free Limit</th>
                                <th className="py-3 px-3">ROI Range</th>
                                <th className="py-3 px-3">Top Rejection Factor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredLenders.map((lender) => (
                                <tr key={lender.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="py-3.5 px-3 font-semibold text-slate-900 flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-[#4F46E5]">
                                            <span className="material-symbols-outlined text-[16px]">account_balance</span>
                                        </div>
                                        <div>
                                            <div className="font-bold">{lender.name}</div>
                                            <span className="text-[10px] text-slate-400">{lender.status}</span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-3 text-slate-600">{lender.type}</td>
                                    <td className="py-3.5 px-3 font-mono font-bold text-slate-900">₹{lender.totalVolumeCr} Cr</td>
                                    <td className="py-3.5 px-3 font-mono text-slate-700">{lender.sanctionsIssued} / {lender.filesAssigned}</td>
                                    <td className="py-3.5 px-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[#4F46E5] rounded-full"
                                                    style={{ width: `${lender.sanctionRate}%` }}
                                                />
                                            </div>
                                            <span className="font-mono font-bold text-slate-900">{lender.sanctionRate}%</span>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-3 font-mono font-bold text-slate-800">{lender.avgTatDays}d</td>
                                    <td className="py-3.5 px-3 font-semibold text-emerald-700">{lender.collateralFreeLimit}</td>
                                    <td className="py-3.5 px-3 font-mono text-slate-700">{lender.avgRoi}</td>
                                    <td className="py-3.5 px-3 text-slate-500 max-w-[200px] truncate" title={lender.topRejectionReason}>
                                        {lender.topRejectionReason}
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
