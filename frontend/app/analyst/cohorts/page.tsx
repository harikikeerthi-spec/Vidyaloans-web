"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function AnalystCohortsPage() {
    const [activeTab, setActiveTab] = useState<"intakes" | "academics" | "degrees">("intakes");
    const [intakeCohorts, setIntakeCohorts] = useState<any[]>([]);
    const [degreeCohorts, setDegreeCohorts] = useState<any[]>([]);
    const [academicBands, setAcademicBands] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCohortData = async () => {
            try {
                setLoading(true);
                const res = await apiFetch<any>("/api/analyst/cohorts");
                if (res?.success) {
                    if (Array.isArray(res.intakes)) setIntakeCohorts(res.intakes);
                    if (Array.isArray(res.degrees)) setDegreeCohorts(res.degrees);
                    if (Array.isArray(res.academics)) setAcademicBands(res.academics);
                }
            } catch (err) {
                console.error("Could not fetch live cohorts telemetry", err);
            } finally {
                setLoading(false);
            }
        };

        fetchCohortData();
    }, []);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-[#4F46E5] text-xs font-semibold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-sm">group_work</span>
                        <span>Student Demographics & Profiles</span>
                    </div>
                    <h1 className="text-2xl font-bold text-[#0A2540] mt-1 font-display">Intake & Student Cohort Intelligence</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Segment applicants across admission seasons, academic qualifications, and target fields of study.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
                        <button
                            onClick={() => setActiveTab("intakes")}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                activeTab === "intakes" ? "bg-white text-[#0A2540] shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            Intake Seasons
                        </button>
                        <button
                            onClick={() => setActiveTab("academics")}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                activeTab === "academics" ? "bg-white text-[#0A2540] shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            Academic Tiers
                        </button>
                        <button
                            onClick={() => setActiveTab("degrees")}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                activeTab === "degrees" ? "bg-white text-[#0A2540] shadow-xs font-bold" : "text-slate-500 hover:text-slate-900"
                            }`}
                        >
                            Degree Domains
                        </button>
                    </div>

                    <Link
                        href="/analyst/dashboard"
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        <span>Overview</span>
                    </Link>
                </div>
            </div>

            {/* Tab 1: Intake Seasons */}
            {activeTab === "intakes" && (
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-[#0A2540]">Seasonality & Intake Sanction Performance</h2>
                        <span className="text-xs text-slate-400">Dynamic cohort analysis</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                                <tr>
                                    <th className="py-2.5 px-3">Admission Intake</th>
                                    <th className="py-2.5 px-3">Applicants</th>
                                    <th className="py-2.5 px-3">Sanction Volume</th>
                                    <th className="py-2.5 px-3">Approval Rate</th>
                                    <th className="py-2.5 px-3">Avg Loan Ticket</th>
                                    <th className="py-2.5 px-3">Disbursal Rate</th>
                                    <th className="py-2.5 px-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {intakeCohorts.map((row) => (
                                    <tr key={row.intake} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-3 px-3 font-semibold text-slate-900 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-400 text-sm">calendar_month</span>
                                            <span>{row.intake}</span>
                                        </td>
                                        <td className="py-3 px-3 font-mono text-slate-700">{row.applicants.toLocaleString()}</td>
                                        <td className="py-3 px-3 font-mono font-bold text-slate-900">₹{row.sanctionValueCr} Cr</td>
                                        <td className="py-3 px-3 font-mono font-bold text-[#4F46E5]">{row.approvalRate}%</td>
                                        <td className="py-3 px-3 font-mono text-slate-700">₹{row.avgTicketLakhs} Lakhs</td>
                                        <td className="py-3 px-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 rounded-full"
                                                        style={{ width: `${row.disbursalRate}%` }}
                                                    />
                                                </div>
                                                <span className="font-mono text-slate-700">{row.disbursalRate}%</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-3">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                                {row.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Tab 2: Academic Qualifications */}
            {activeTab === "academics" && (
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-[#0A2540]">Undergraduate Academic Score & Sanction Correlation</h2>
                        <span className="text-xs text-slate-400">Underwriting approval matrices</span>
                    </div>

                    <div className="space-y-4">
                        {academicBands.map((band) => (
                            <div key={band.band} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <div className="font-bold text-slate-900 text-sm">{band.band}</div>
                                    <div className="flex items-center gap-4 text-xs font-mono">
                                        <div>
                                            <span className="text-slate-500 mr-1.5">Applicant Pool:</span>
                                            <span className="font-bold text-slate-900">{band.share}%</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 mr-1.5">Sanction Probability:</span>
                                            <span className="font-bold text-emerald-700">{band.sanctionProb}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-xs text-slate-600 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-sm text-[#4F46E5]">check_circle</span>
                                    <span>Unsecured Loan Eligibility: <strong className="text-slate-900">{band.collateralFreeApproval}</strong></span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab 3: Degree Domains */}
            {activeTab === "degrees" && (
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-base font-bold text-[#0A2540]">Course Domain Distribution & Loan Ticket Size</h2>
                        <span className="text-xs text-slate-400">Risk rating by post-graduation employability</span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                                <tr>
                                    <th className="py-2.5 px-3">Field of Study</th>
                                    <th className="py-2.5 px-3">Share %</th>
                                    <th className="py-2.5 px-3">Sanctioned Volume</th>
                                    <th className="py-2.5 px-3">Average Loan Quantum</th>
                                    <th className="py-2.5 px-3">Sanction Probability</th>
                                    <th className="py-2.5 px-3">Credit Risk Tier</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {degreeCohorts.map((d) => (
                                    <tr key={d.category} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-3 px-3 font-semibold text-slate-900">{d.category}</td>
                                        <td className="py-3 px-3 font-mono text-slate-700">{d.share}%</td>
                                        <td className="py-3 px-3 font-mono font-bold text-slate-900">₹{d.volumeCr} Cr</td>
                                        <td className="py-3 px-3 font-mono text-slate-700">{d.avgTicket}</td>
                                        <td className="py-3 px-3 font-mono font-bold text-[#4F46E5]">{d.sanctionRate}</td>
                                        <td className="py-3 px-3">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                {d.riskRating}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
