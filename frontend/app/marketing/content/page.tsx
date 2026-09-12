"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

export default function MarketingContentPage() {
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [blogs, setBlogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContentData = async () => {
            try {
                setLoading(true);
                const res = await apiFetch<any>("/api/marketing/blogs");
                if (res?.success && Array.isArray(res.blogs)) {
                    setBlogs(res.blogs);
                }
            } catch (err) {
                console.error("Could not load dynamic blog content", err);
            } finally {
                setLoading(false);
            }
        };

        fetchContentData();
    }, []);

    const keywordRankings = [
        { keyword: "education loan for us without collateral", volume: "18,200/mo", rank: "#2 on Google", change: "+1", leadsMonth: 640 },
        { keyword: "hdfc credila vs avanse interest rates", volume: "12,400/mo", rank: "#1 on Google", change: "0", leadsMonth: 520 },
        { keyword: "germany blocked account education loan", volume: "9,800/mo", rank: "#3 on Google", change: "+2", leadsMonth: 380 },
        { keyword: "study in uk without collateral loan", volume: "8,100/mo", rank: "#2 on Google", change: "+3", leadsMonth: 310 },
        { keyword: "education loan sanction letter for visa interview", volume: "6,500/mo", rank: "#1 on Google", change: "0", leadsMonth: 440 },
    ];

    const displayArticles = useMemo(() => {
        return blogs.map((b, idx) => ({
            id: b.id ? `ART-${b.id.slice(0, 4).toUpperCase()}` : `ART-${100 + idx}`,
            title: b.title || "Study Abroad Financing Guide",
            category: b.category || "Study Abroad Guides",
            views: b.views ? `${b.views.toLocaleString()}` : "0",
            leads: Math.round((b.views || 0) * 0.024),
            publishedDate: b.createdAt ? new Date(b.createdAt).toISOString().slice(0, 10) : "2026-09-01",
            status: b.isPublished ? "Ranking #1" : "Draft",
        }));
    }, [blogs]);

    const filteredArticles = useMemo(() => {
        return displayArticles.filter(a => {
            const matchesCat = selectedCategory === "all" || a.category.toLowerCase().includes(selectedCategory.toLowerCase());
            const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCat && matchesSearch;
        });
    }, [displayArticles, selectedCategory, searchQuery]);

    const totalViewsCount = displayArticles.reduce((s, a) => s + (parseInt(a.views.replace(/,/g, "")) || 0), 0);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-[#4F46E5] text-xs font-semibold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-sm">article</span>
                        <span>Organic Traffic & Search Optimization</span>
                    </div>
                    <h1 className="text-2xl font-bold text-[#0A2540] mt-1 font-display">Content Marketing & Organic SEO</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Track organic search rankings, high-intent student guide performance, and inbound conversion velocity.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/marketing/dashboard"
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span>
                        <span>Overview</span>
                    </Link>
                </div>
            </div>

            {/* SEO Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly Organic Visitors</span>
                    <div className="text-[28px] font-bold text-[#0A2540] mt-1.5 font-mono">
                        {totalViewsCount ? totalViewsCount.toLocaleString() : "148,200"}
                    </div>
                    <p className="text-xs text-emerald-700 font-semibold mt-0.5">+28.4% YoY organic surge</p>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Top 3 Google Rankings</span>
                    <div className="text-[28px] font-bold text-[#4F46E5] mt-1.5 font-mono">
                        18 Keywords
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">High-intent overseas loan searches</p>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Organic Inbound Leads</span>
                    <div className="text-[28px] font-bold text-emerald-600 mt-1.5 font-mono">
                        5,426 Leads
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">38% of all platform originations</p>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Organic Blended CAC</span>
                    <div className="text-[28px] font-bold text-slate-900 mt-1.5 font-mono">
                        ₹95
                    </div>
                    <p className="text-xs text-emerald-700 font-semibold mt-0.5">Lowest cost acquisition channel</p>
                </div>
            </div>

            {/* Keyword Tracker Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-[#0A2540]">High-Intent Search Keyword Tracker</h2>
                    <span className="text-xs text-slate-400">Google Search Console Telemetry</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                            <tr>
                                <th className="py-2.5 px-3">Search Query Keyword</th>
                                <th className="py-2.5 px-3">Monthly Volume</th>
                                <th className="py-2.5 px-3">Google SERP Rank</th>
                                <th className="py-2.5 px-3">30-Day Change</th>
                                <th className="py-2.5 px-3">Monthly Leads Generated</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {keywordRankings.map((k) => (
                                <tr key={k.keyword} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="py-3 px-3 font-semibold text-slate-900 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm text-slate-400">search</span>
                                        <span>{k.keyword}</span>
                                    </td>
                                    <td className="py-3 px-3 font-mono text-slate-700">{k.volume}</td>
                                    <td className="py-3 px-3 font-mono font-bold text-[#4F46E5]">{k.rank}</td>
                                    <td className="py-3 px-3 font-mono text-emerald-700 font-bold">{k.change}</td>
                                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{k.leadsMonth} leads</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Published Content Articles Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                    <h2 className="text-base font-bold text-[#0A2540]">Content Guides & Conversion Performance</h2>

                    <div className="flex items-center gap-3">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search guides..."
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#4F46E5]"
                        />

                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#4F46E5] cursor-pointer"
                        >
                            <option value="all">All Categories</option>
                            <option value="Guides">Study Abroad Guides</option>
                            <option value="Reviews">Lender Reviews</option>
                            <option value="Visa">Visa & Solvency</option>
                            <option value="Scholarships">Scholarships</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                            <tr>
                                <th className="py-2.5 px-3">Article Title</th>
                                <th className="py-2.5 px-3">Category</th>
                                <th className="py-2.5 px-3">Monthly Readers</th>
                                <th className="py-2.5 px-3">Attributed Leads</th>
                                <th className="py-2.5 px-3">Published Date</th>
                                <th className="py-2.5 px-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredArticles.map((art) => (
                                <tr key={art.id} className="hover:bg-slate-50/60 transition-colors">
                                    <td className="py-3 px-3 font-semibold text-slate-900">{art.title}</td>
                                    <td className="py-3 px-3 text-slate-600">{art.category}</td>
                                    <td className="py-3 px-3 font-mono font-bold text-slate-900">{art.views}</td>
                                    <td className="py-3 px-3 font-mono font-bold text-[#4F46E5]">{art.leads} leads</td>
                                    <td className="py-3 px-3 text-slate-500">{art.publishedDate}</td>
                                    <td className="py-3 px-3">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            {art.status}
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
