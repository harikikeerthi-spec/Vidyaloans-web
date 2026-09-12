"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface LeadRecord {
    id: string;
    studentName: string;
    email: string;
    phone: string;
    destination: string;
    intake: string;
    degree: string;
    loanBudget: string;
    leadSource: string;
    status: string;
    createdAt: string;
}

export default function MarketingLeadsPage() {
    const [selectedCountry, setSelectedCountry] = useState("all");
    const [selectedIntake, setSelectedIntake] = useState("all");
    const [selectedStatus, setSelectedStatus] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [dbCountries, setDbCountries] = useState<any[]>([]);
    const [allLeads, setAllLeads] = useState<LeadRecord[]>([]);
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
        const fetchLeads = async () => {
            try {
                setLoading(true);
                const params = new URLSearchParams();
                if (selectedCountry !== "all") params.append("country", selectedCountry);
                if (selectedIntake !== "all") params.append("intake", selectedIntake);
                if (selectedStatus !== "all") params.append("status", selectedStatus);
                if (searchQuery.trim()) params.append("search", searchQuery.trim());

                const res = await apiFetch<any>(`/api/marketing/leads?${params.toString()}`);
                if (res?.success && Array.isArray(res.leads)) {
                    setAllLeads(res.leads);
                }
            } catch (err) {
                console.error("Could not load dynamic leads", err);
            } finally {
                setLoading(false);
            }
        };

        const timeout = setTimeout(fetchLeads, 300);
        return () => clearTimeout(timeout);
    }, [selectedCountry, selectedIntake, selectedStatus, searchQuery]);

    const filteredLeads = allLeads;

    const handleExportAudience = () => {
        const headers = ["LeadID", "StudentName", "Email", "Phone", "Destination", "Intake", "Degree", "LoanBudget", "Source", "Status", "Date"].join(",");
        const rows = filteredLeads.map(l =>
            `"${l.id}","${l.studentName}","${l.email}","${l.phone}","${l.destination}","${l.intake}","${l.degree}","${l.loanBudget}","${l.leadSource}","${l.status}","${l.createdAt}"`
        );
        const csv = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
        const encoded = encodeURI(csv);
        const link = document.createElement("a");
        link.setAttribute("href", encoded);
        link.setAttribute("download", `marketing_leads_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-[#4F46E5] text-xs font-semibold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-sm">groups</span>
                        <span>Audience Segmentation & Lead Intelligence</span>
                    </div>
                    <h1 className="text-2xl font-bold text-[#0A2540] mt-1 font-display">Student Leads & Targeted Audiences</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Filter and segment prospective study abroad scholars for hyper-targeted automated email and WhatsApp broadcasts.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportAudience}
                        className="px-4 py-2 bg-[#4F46E5] hover:bg-indigo-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">download</span>
                        <span>Export Audience CSV ({filteredLeads.length})</span>
                    </button>

                    <Link
                        href="/marketing/dashboard"
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        <span>Overview</span>
                    </Link>
                </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-[220px]">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                        search
                    </span>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search student name, email, lead ID..."
                        className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-[#4F46E5] w-full"
                    />
                </div>

                {/* Country Filter */}
                <select
                    value={selectedCountry}
                    onChange={(e) => setSelectedCountry(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#4F46E5] cursor-pointer"
                >
                    <option value="all">All Destinations</option>
                    <option value="USA">United States</option>
                    <option value="UK">United Kingdom</option>
                    <option value="Canada">Canada</option>
                    <option value="Germany">Germany</option>
                    <option value="Ireland">Ireland</option>
                    <option value="Australia">Australia</option>
                </select>

                {/* Intake Filter */}
                <select
                    value={selectedIntake}
                    onChange={(e) => setSelectedIntake(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#4F46E5] cursor-pointer"
                >
                    <option value="all">All Intakes</option>
                    <option value="Fall 2025">Fall 2025</option>
                    <option value="Spring 2026">Spring 2026</option>
                    <option value="Fall 2026">Fall 2026</option>
                </select>

                {/* Status Filter */}
                <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#4F46E5] cursor-pointer"
                >
                    <option value="all">All Lead Statuses</option>
                    <option value="Active">Active Leads</option>
                    <option value="Incomplete">Docs Incomplete</option>
                    <option value="Verified">Docs Verified</option>
                    <option value="Sanction">Sanction Ready</option>
                    <option value="Disbursed">Disbursed</option>
                </select>
            </div>

            {/* Leads Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-[#0A2540]">
                        Matched Leads ({filteredLeads.length} Students)
                    </h2>
                    <span className="text-xs text-slate-400">Live database sync</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                            <tr>
                                <th className="py-2.5 px-3">Lead ID</th>
                                <th className="py-2.5 px-3">Student Name</th>
                                <th className="py-2.5 px-3">Email</th>
                                <th className="py-2.5 px-3">Destination</th>
                                <th className="py-2.5 px-3">Intake</th>
                                <th className="py-2.5 px-3">Loan Quantum</th>
                                <th className="py-2.5 px-3">Source Channel</th>
                                <th className="py-2.5 px-3">Lead Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        {loading ? "Searching leads database..." : "No leads found matching the selected filters."}
                                    </td>
                                </tr>
                            ) : (
                                filteredLeads.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-3 px-3 font-mono font-bold text-slate-700">{lead.id}</td>
                                        <td className="py-3 px-3 font-semibold text-slate-900">{lead.studentName}</td>
                                        <td className="py-3 px-3 text-slate-600 font-mono">{lead.email}</td>
                                        <td className="py-3 px-3 text-slate-700">{lead.destination}</td>
                                        <td className="py-3 px-3 text-slate-600">{lead.intake}</td>
                                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{lead.loanBudget}</td>
                                        <td className="py-3 px-3 text-slate-500">{lead.leadSource}</td>
                                        <td className="py-3 px-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                lead.status.includes("Sanction") || lead.status.includes("Disbursed")
                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                    : lead.status.includes("Incomplete")
                                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                                    : "bg-indigo-50 text-[#4F46E5] border border-indigo-200"
                                            }`}>
                                                {lead.status}
                                            </span>
                                        </td>
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
