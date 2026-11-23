"use client";

import { useState } from "react";
import SupportCenter from "@/components/Admin/SupportCenter";
import { useAuth } from "@/contexts/AuthContext";

const SUPPORT_TABS = [
    { section: "support_dashboard", icon: "dashboard", label: "Dashboard" },
    { section: "support_all", icon: "confirmation_number", label: "All Tickets" },
    { section: "support_open", icon: "radio_button_unchecked", label: "Open" },
    { section: "support_assigned", icon: "person", label: "Assigned" },
    { section: "support_waiting", icon: "hourglass_empty", label: "Waiting" },
    { section: "support_resolved", icon: "check_circle", label: "Resolved" },
    { section: "support_out_of_scope", icon: "cancel", label: "Out of Scope" },
    { section: "support_closed", icon: "lock", label: "Closed" },
    { section: "support_high", icon: "priority_high", label: "High Priority" },
    { section: "support_sla", icon: "timer", label: "SLA Monitor" },
    { section: "support_categories", icon: "category", label: "Categories" },
    { section: "support_teams", icon: "groups", label: "Teams" },
    { section: "support_analytics", icon: "bar_chart", label: "Analytics" },
    { section: "support_kb", icon: "menu_book", label: "Knowledge Base" },
    { section: "support_settings", icon: "settings", label: "Settings" },
];

export default function ITTicketsPage() {
    const { user } = useAuth();
    const [activeView, setActiveView] = useState("support_dashboard");

    return (
        <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in pb-16 font-sans">
            {/* Header & Sub-navigation Toolbar */}
            <div className="bg-white/90 backdrop-blur-xl rounded-2xl border border-purple-100/70 shadow-sm p-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
                            <span className="material-symbols-outlined text-2xl text-[#6605c7]">headset_mic</span>
                            IT Support Operations Center
                        </h2>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">
                            Enterprise ticket dispatching, SLA tracking, category rules, and team resolution
                        </p>
                    </div>
                </div>

                {/* Sub-nav tabs scrollable row */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pt-2 border-t border-purple-100/50 pb-1">
                    {SUPPORT_TABS.map((tab) => {
                        const isActive = activeView === tab.section;
                        return (
                            <button
                                key={tab.section}
                                onClick={() => setActiveView(tab.section)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                    isActive
                                        ? "bg-[#6605c7] text-white shadow-xs"
                                        : "bg-slate-50 text-slate-600 hover:bg-purple-50/60 hover:text-[#6605c7] border border-slate-200/60"
                                }`}
                            >
                                <span className={`material-symbols-outlined text-[16px] ${isActive ? "text-white" : "text-slate-500"}`}>
                                    {tab.icon}
                                </span>
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Support Center Main Container */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm min-h-[600px]">
                <SupportCenter
                    activeView={activeView}
                    setActiveSection={setActiveView}
                    user={user}
                />
            </div>
        </div>
    );
}
