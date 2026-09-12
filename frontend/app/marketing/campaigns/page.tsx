"use client";

import { useState } from "react";
import Link from "next/link";
import CampaignsDashboard from "@/components/Admin/CampaignsDashboard";

export default function MarketingCampaignsPage() {
    const [activeSubmenu, setActiveSubmenu] = useState<string>("campaigns_dashboard");

    const tabs = [
        { id: "campaigns_dashboard", label: "Overview", icon: "dashboard" },
        { id: "campaigns_create", label: "AI Campaign Creator", icon: "auto_awesome" },
        { id: "campaigns_student_emails", label: "Student Email Logs", icon: "mail" },
        { id: "campaigns_templates", label: "Templates", icon: "content_copy" },
        { id: "campaigns_audience", label: "Audience Target", icon: "groups" },
        { id: "campaigns_analytics", label: "Performance Analytics", icon: "analytics" },
    ];

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-[#4F46E5] text-xs font-semibold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-sm">campaign</span>
                        <span>Omnichannel Broadcast Studio</span>
                    </div>
                    <h1 className="text-2xl font-bold text-[#0A2540] mt-1 font-display">Growth & Automated Campaigns Hub</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Design, schedule, and trigger hyper-personalized loan approval notifications and rate drop announcements.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveSubmenu("campaigns_create")}
                        className="px-4 py-2 bg-[#4F46E5] hover:bg-indigo-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">auto_awesome</span>
                        <span>New AI Campaign</span>
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

            {/* Submenu Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {tabs.map((tab) => {
                    const active = activeSubmenu === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubmenu(tab.id)}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
                                active
                                    ? "bg-[#4F46E5] text-white shadow-sm"
                                    : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80 shadow-xs"
                            }`}
                        >
                            <span className="material-symbols-outlined text-base">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Campaign Dashboard Embedded Canvas */}
            <div className="bg-white text-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200/80 overflow-hidden">
                <CampaignsDashboard
                    activeSubmenu={activeSubmenu}
                    setActiveSubmenu={setActiveSubmenu}
                />
            </div>
        </div>
    );
}
