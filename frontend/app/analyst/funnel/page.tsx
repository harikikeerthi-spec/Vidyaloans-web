"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface FunnelStep {
    id: string;
    stepNumber: number;
    title: string;
    count: number;
    percentageOfTotal: number;
    dropOffRate: number;
    avgDaysInStage: number;
    bottleneckRisk: "Low" | "Medium" | "High";
    keyAction: string;
}

export default function AnalystFunnelPage() {
    const [selectedIntake, setSelectedIntake] = useState("all");
    const [selectedCountry, setSelectedCountry] = useState("all");
    const [dbCountries, setDbCountries] = useState<any[]>([]);
    const [funnelSteps, setFunnelSteps] = useState<FunnelStep[]>([]);
    const [totalRegistered, setTotalRegistered] = useState(0);
    const [finalDisbursed, setFinalDisbursed] = useState(0);
    const [conversionRate, setConversionRate] = useState(0);
    const [activeStepId, setActiveStepId] = useState<string>("docs_uploaded");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCountries = async () => {
            try {
                const countriesRes = await apiFetch<any>("/api/reference/countries").catch(() => null);
                if (countriesRes?.data && Array.isArray(countriesRes.data)) {
                    setDbCountries(countriesRes.data);
                }
            } catch (e) {
                console.warn("Could not load countries", e);
            }
        };
        fetchCountries();
    }, []);

    useEffect(() => {
        const loadFunnelData = async () => {
            try {
                setLoading(true);
                const res = await apiFetch<any>(`/api/analyst/funnel?country=${encodeURIComponent(selectedCountry)}&intake=${encodeURIComponent(selectedIntake)}`);
                if (res?.success && Array.isArray(res.steps)) {
                    setFunnelSteps(res.steps);
                    setTotalRegistered(res.totalRegistered || 0);
                    setFinalDisbursed(res.finalDisbursed || 0);
                    setConversionRate(res.conversionRate || 0);
                    if (res.steps.length > 0 && !res.steps.find((s: any) => s.id === activeStepId)) {
                        setActiveStepId(res.steps[0].id);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch live funnel telemetry", e);
            } finally {
                setLoading(false);
            }
        };

        loadFunnelData();
    }, [selectedCountry, selectedIntake]);

    const activeStep = funnelSteps.find(s => s.id === activeStepId) || funnelSteps[0] || {
        id: "none",
        stepNumber: 1,
        title: "No data available",
        count: 0,
        percentageOfTotal: 0,
        dropOffRate: 0,
        avgDaysInStage: 0,
        bottleneckRisk: "Low" as const,
        keyAction: "Awaiting applicant records",
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-[#4F46E5] text-xs font-semibold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-sm">filter_alt</span>
                        <span>Multi-Stage Conversion Telemetry</span>
                    </div>
                    <h1 className="text-2xl font-bold text-[#0A2540] mt-1 font-display">Loan Origination Conversion Funnel</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Track conversion velocity, drop-off rates, and procedural bottlenecks across all 8 lifecycle steps.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Destination filter */}
                    <select
                        value={selectedCountry}
                        onChange={(e) => setSelectedCountry(e.target.value)}
                        className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#4F46E5] cursor-pointer"
                    >
                        <option value="all">All Destinations</option>
                        {dbCountries.map((c) => (
                            <option key={c.id || c.code} value={c.name}>{c.name}</option>
                        ))}
                    </select>

                    {/* Intake Season filter */}
                    <select
                        value={selectedIntake}
                        onChange={(e) => setSelectedIntake(e.target.value)}
                        className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#4F46E5] cursor-pointer"
                    >
                        <option value="all">All Intakes</option>
                        <option value="Fall 2025">Fall 2025 (Peak)</option>
                        <option value="Spring 2026">Spring 2026</option>
                        <option value="Fall 2026">Fall 2026</option>
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

            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overall Funnel Conversion</span>
                    <div className="text-[28px] font-bold text-[#0A2540] mt-1.5 font-mono">
                        {funnelSteps[7]?.percentageOfTotal ?? conversionRate}%
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Registration to Disbursal completion ({finalDisbursed} of {totalRegistered})</p>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sanction Issuance Rate</span>
                    <div className="text-[28px] font-bold text-[#0A2540] mt-1.5 font-mono">
                        {funnelSteps[6]?.percentageOfTotal ?? 0}%
                    </div>
                    <p className="text-xs text-emerald-700 font-semibold mt-0.5">+4.2% higher than industry benchmark</p>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Primary Friction Stage</span>
                    <div className="text-[24px] font-bold text-rose-600 mt-1.5 truncate">
                        Stage 3: KYC Upload
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Drop-off tracked at document verification</p>
                </div>
            </div>

            {/* Funnel Visual Stack */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h2 className="text-base font-bold text-[#0A2540]">Step-by-Step Conversion Flow</h2>
                    <span className="text-xs text-slate-400">Click any step to inspect diagnostic notes</span>
                </div>

                <div className="space-y-3">
                    {funnelSteps.map((step) => {
                        const isSelected = activeStepId === step.id;
                        return (
                            <div
                                key={step.id}
                                onClick={() => setActiveStepId(step.id)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                                    isSelected
                                        ? "border-indigo-500 bg-indigo-50/20 shadow-xs"
                                        : "border-slate-200/70 hover:border-slate-300 bg-slate-50/40"
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                                            isSelected ? "bg-[#4F46E5] text-white" : "bg-slate-200 text-slate-700"
                                        }`}>
                                            {step.stepNumber}
                                        </div>
                                        <div>
                                            <span className="font-bold text-slate-900 text-sm">{step.title}</span>
                                            <span className="text-slate-400 text-xs ml-2 hidden md:inline">({step.keyAction})</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs font-mono">
                                        <div>
                                            <span className="text-slate-500 mr-1.5">Count:</span>
                                            <span className="font-bold text-slate-900">{step.count.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 mr-1.5">Share:</span>
                                            <span className="font-bold text-[#4F46E5]">{step.percentageOfTotal}%</span>
                                        </div>
                                        {step.dropOffRate > 0 && (
                                            <div className="text-rose-600 font-bold flex items-center gap-0.5">
                                                <span className="material-symbols-outlined text-xs">arrow_downward</span>
                                                <span>-{step.dropOffRate}%</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Progress Visual Bar */}
                                <div className="h-2 w-full bg-slate-200/60 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            step.bottleneckRisk === "High"
                                                ? "bg-rose-500"
                                                : step.bottleneckRisk === "Medium"
                                                ? "bg-amber-500"
                                                : "bg-[#4F46E5]"
                                        }`}
                                        style={{ width: `${step.percentageOfTotal}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Step Diagnostic Inspector */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#4F46E5] uppercase tracking-wider mb-2">
                    <span className="material-symbols-outlined text-base">troubleshoot</span>
                    <span>Diagnostic Deep Dive: {activeStep.title}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-xs text-slate-500 block">Average Time in Stage</span>
                        <span className="text-xl font-bold text-slate-900 font-mono mt-1 block">
                            {activeStep.avgDaysInStage} Days
                        </span>
                        <span className="text-[11px] text-slate-400 mt-1 block">Workflow processing cycle</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-xs text-slate-500 block">Bottleneck Risk Evaluation</span>
                        <span className={`text-xl font-bold mt-1 block ${
                            activeStep.bottleneckRisk === "High" ? "text-rose-600" : activeStep.bottleneckRisk === "Medium" ? "text-amber-600" : "text-emerald-600"
                        }`}>
                            {activeStep.bottleneckRisk} Friction Risk
                        </span>
                        <span className="text-[11px] text-slate-400 mt-1 block">Based on drop-off & TAT</span>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-xs text-slate-500 block">Automated Remediation</span>
                        <span className="text-sm font-semibold text-[#4F46E5] mt-1 block">
                            Trigger WhatsApp / SMS Nudge
                        </span>
                        <span className="text-[11px] text-slate-400 mt-1 block">1-click student reminder dispatch</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
