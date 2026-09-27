"use client";

import React, { useState } from "react";
import { useAgent } from "../AgentContext";

interface StudentTracker {
    id: string;
    leadId: string;
    studentName: string;
    course: string;
    university: string;
    amount: string;
    token: string;
    linkSent: string;
    lastViewed: string;
    views: number;
    status: string;
    currentStageIndex: number; // 0 to 7 matching: Created, Submitted, Documents, Submit to Bank, Credit Check, Review, Sanction, Disbursed
}

export default function AgentTrackingLinks() {
    const { showToast } = useAgent();

    // 14.3 Student Link Activity Directory
    const initialTrackers: StudentTracker[] = [
        {
            id: "ST-001",
            leadId: "LEAD-1092",
            studentName: "Priya Sharma",
            course: "B.Tech",
            university: "IIT Bombay",
            amount: "₹12,00,000",
            token: "token-abc",
            linkSent: "18-May-2026",
            lastViewed: "22-Jun 13:10",
            views: 12,
            status: "Active ✅",
            currentStageIndex: 5 // Review in Progress
        },
        {
            id: "ST-002",
            leadId: "LEAD-2041",
            studentName: "Rahul Kumar",
            course: "MBA",
            university: "Stanford University",
            amount: "₹35,00,000",
            token: "token-xyz",
            linkSent: "20-May-2026",
            lastViewed: "20-Jun 09:44",
            views: 8,
            status: "Active ✅",
            currentStageIndex: 2 // Documents
        },
        {
            id: "ST-003",
            leadId: "LEAD-3098",
            studentName: "Meena Pillai",
            course: "MS",
            university: "Boston University",
            amount: "₹25,00,000",
            token: "token-qrs",
            linkSent: "21-May-2026",
            lastViewed: "Not opened yet",
            views: 0,
            status: "⚠️ Never opened",
            currentStageIndex: 0 // Created
        }
    ];

    const [trackers, setTrackers] = useState<StudentTracker[]>(initialTrackers);
    const [selectedTracker, setSelectedTracker] = useState<StudentTracker>(initialTrackers[0]);

    // Stages matching the standard 8 application progress steps
    const trackingStages = [
        { label: "Created", desc: "Application registered and draft created", icon: "bolt" },
        { label: "Submitted", desc: "Application officially submitted for processing", icon: "send" },
        { label: "Documents", desc: "VidyaLoans KYC & document screening checks complete", icon: "verified" },
        { label: "Submit to Bank", desc: "Files forwarded directly to respective lender portals", icon: "account_balance" },
        { label: "Credit Check", desc: "Credit bureau score and borrower eligibility verification", icon: "credit_score" },
        { label: "Review", desc: "Current underwriting evaluation phase", icon: "rate_review" },
        { label: "Sanction", desc: "Bank sanction decision sign-off and offer issuance", icon: "assignment_turned_in" },
        { label: "Disbursed", desc: "Funds disbursement dispatch release", icon: "payments" }
    ];

    const getTrackingUrl = (leadId: string, token: string) => {
        return `https://track.vidyaloans.com/${leadId}/${token}`;
    };

    const getWhatsAppMessage = (name: string, leadId: string, token: string) => {
        return `Hi ${name}! You can track your loan application status anytime here: ${getTrackingUrl(leadId, token)} No login needed. Updates automatically.`;
    };

    const handleCopyLink = (leadId: string, token: string) => {
        navigator.clipboard.writeText(getTrackingUrl(leadId, token));
        showToast("Student status link copied to clipboard!", "success");
    };

    const handleSendWhatsApp = (name: string, leadId: string, token: string) => {
        const text = encodeURIComponent(getWhatsAppMessage(name, leadId, token));
        window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
        showToast("Opening WhatsApp Web...", "success");
    };

    const handleSendSMS = (name: string) => {
        showToast(`SMS status alert dispatch queued for ${name}!`, "success");
    };

    const handleSendReminder = (name: string, leadId: string, token: string) => {
        showToast(`Outreach reminder ping sent to ${name} via SMS/WhatsApp!`, "success");
        // Update views count to simulate dynamic activity check
        setTrackers(prev => prev.map(t => t.leadId === leadId ? { ...t, lastViewed: "Just now", views: t.views + 1, status: "Active ✅" } : t));
    };

    return (
        <div className="animate-fade-in-up space-y-8 relative z-10 text-left pb-12">
            
            {/* Header banner */}
            <section className="p-8 rounded-[2.5rem] bg-white border border-[#6605c7]/10 shadow-2xl shadow-[#6605c7]/2 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 font-display tracking-tight">Student Self-Tracking Link Generator</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1.5">Module 14 • Provide students a direct, password-less link to check their own milestone & document status</p>
                </div>
            </section>

            {/* Grid 1: Generator and Student Live View Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 14.1 Share Student Status Link */}
                <div className="bg-white border border-[#6605c7]/10 p-8 rounded-[2.5rem] shadow-2xl shadow-[#6605c7]/2 space-y-6 flex flex-col justify-between">
                    <div className="space-y-6">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6605c7] block">Share Status Link</span>
                            <h3 className="text-xl font-black font-display tracking-tight mt-0.5 text-gray-900">Share Student Status Link</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider">Select Student</label>
                                <select 
                                    value={selectedTracker.leadId} 
                                    onChange={(e) => {
                                        const found = trackers.find(t => t.leadId === e.target.value);
                                        if (found) setSelectedTracker(found);
                                    }} 
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-150 text-xs font-bold text-gray-700 focus:outline-none focus:bg-white focus:ring-4 focus:ring-[#6605c7]/5 transition-all"
                                >
                                    {trackers.map((t, idx) => (
                                        <option key={idx} value={t.leadId}>{t.studentName} ({t.leadId})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                    <span>Tracking URL Link</span>
                                    <span className="text-indigo-600 font-bold">Expiry: Never (auto-refreshes)</span>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="text" 
                                        readOnly 
                                        value={getTrackingUrl(selectedTracker.leadId, selectedTracker.token)} 
                                        className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-[10px] text-gray-600 focus:outline-none select-all font-mono" 
                                    />
                                    <button 
                                        onClick={() => handleCopyLink(selectedTracker.leadId, selectedTracker.token)}
                                        className="p-2 bg-[#6605c7] text-white rounded-lg hover:scale-105 transition-transform"
                                        title="Copy Link"
                                    >
                                        <span className="material-symbols-outlined text-sm">content_copy</span>
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider">Pre-built WhatsApp Message</label>
                                <textarea 
                                    rows={4} 
                                    readOnly
                                    value={getWhatsAppMessage(selectedTracker.studentName, selectedTracker.leadId, selectedTracker.token)} 
                                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-600 focus:outline-none select-all font-medium leading-relaxed"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 pt-4 border-t border-gray-50">
                        <button 
                            onClick={() => handleSendWhatsApp(selectedTracker.studentName, selectedTracker.leadId, selectedTracker.token)}
                            className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[9px] tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/10"
                        >
                            <span className="material-symbols-outlined text-sm">chat</span> WhatsApp
                        </button>
                        <button 
                            onClick={() => handleCopyLink(selectedTracker.leadId, selectedTracker.token)}
                            className="py-3 bg-gray-550 text-white hover:bg-gray-600 font-black uppercase text-[9px] tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-sm">content_copy</span> Copy Link
                        </button>
                        <button 
                            onClick={() => handleSendSMS(selectedTracker.studentName)}
                            className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[9px] tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-indigo-500/10"
                        >
                            <span className="material-symbols-outlined text-sm">sms</span> SMS Alert
                        </button>
                    </div>
                </div>

                {/* 14.2 What the Student Sees on Their Link */}
                <div className="bg-white border border-[#6605c7]/10 p-8 rounded-[2.5rem] shadow-2xl shadow-[#6605c7]/2 space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6605c7]">Live Student Preview Page</span>
                            <span className="text-[10px] font-mono text-gray-400 font-bold">Domain: track.vidyaloans.com</span>
                        </div>
                        <h3 className="text-xl font-black font-display tracking-tight text-gray-900 flex items-center gap-1.5">
                            📋 {selectedTracker.studentName} — Loan Application Status
                        </h3>
                        <p className="text-xs text-gray-500 font-bold mt-1 uppercase tracking-wider">
                            Course: {selectedTracker.course} • College: {selectedTracker.university} • Amount: {selectedTracker.amount}
                        </p>
                    </div>

                    {/* Timeline Journey milestones checklist */}
                    <div className="space-y-4 relative pl-4 border-l border-gray-150 py-2">
                        {trackingStages.map((stage, idx) => {
                            const isCompleted = idx < selectedTracker.currentStageIndex;
                            const isCurrent = idx === selectedTracker.currentStageIndex;
                            const isUpcoming = idx > selectedTracker.currentStageIndex;

                            return (
                                <div key={idx} className="relative space-y-0.5">
                                    {/* Bubble indicator */}
                                    <span className={`absolute -left-[27px] w-6 h-6 rounded-full flex items-center justify-center border font-bold text-[11px] shadow-sm transition-all ${
                                        isCompleted ? 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-500/20' :
                                        isCurrent ? 'bg-white text-[#6605c7] border-[#6605c7] shadow-[#6605c7]/20 scale-110' :
                                        'bg-white text-gray-300 border-gray-200'
                                    }`}>
                                        <span className={`material-symbols-outlined text-[13px] ${isCurrent ? 'animate-pulse' : ''}`}>
                                            {isCompleted ? "check" : stage.icon}
                                        </span>
                                    </span>
                                    
                                    <div className="pl-2">
                                        <h4 className={`text-xs font-black tracking-tight flex items-center gap-2 ${
                                            isCompleted ? 'text-gray-900' :
                                            isCurrent ? 'text-indigo-600' : 'text-gray-400 font-bold'
                                        }`}>
                                            {stage.label}
                                            {isCurrent && <span className="text-[9px] font-black uppercase tracking-widest text-[#6605c7] bg-indigo-50 px-2 py-0.5 rounded-md animate-pulse">Current Stage</span>}
                                        </h4>
                                        <p className={`text-[10px] ${
                                            isCompleted ? 'text-gray-500 font-medium' :
                                            isCurrent ? 'text-gray-600 font-semibold' : 'text-gray-400 font-normal'
                                        }`}>
                                            {stage.desc}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs text-gray-700 font-bold">
                        <span>📞 Need help or queries?</span>
                        <span className="text-[#6605c7] font-black font-mono">Call: +91-40-XXXX-XXXX</span>
                    </div>
                </div>

            </div>

            {/* 14.3 Agent Link Activity Log */}
            <div className="bg-white border border-[#6605c7]/10 p-8 rounded-[2.5rem] shadow-2xl shadow-[#6605c7]/2 space-y-6">
                <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6605c7] block">Outreach logs</span>
                    <h3 className="text-xl font-black font-display tracking-tight mt-0.5 text-gray-900">Student Link Activity</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-gray-50 text-gray-400 border-b border-gray-100 font-black uppercase tracking-wider text-[9px]">
                                <th className="p-4">Student Referral</th>
                                <th className="p-4">Link Sent Date</th>
                                <th className="p-4">Last Viewed</th>
                                <th className="p-4 text-center">Views Count</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 font-bold text-gray-700">
                            {trackers.map((t, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-4 text-gray-900 font-black">{t.studentName}</td>
                                    <td className="p-4 text-gray-500 font-normal">{t.linkSent}</td>
                                    <td className="p-4 text-gray-550 font-mono">{t.lastViewed}</td>
                                    <td className="p-4 text-center font-mono text-gray-600">{t.views} clicks</td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                            t.status.includes("✅") ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                            'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                                        }`}>
                                            {t.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex gap-2 justify-center">
                                            <button 
                                                onClick={() => setSelectedTracker(t)}
                                                className="px-3 py-1.5 bg-gray-50 border border-gray-150 text-gray-500 hover:text-[#6605c7] hover:bg-[#6605c7]/5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                                            >
                                                Preview Tracker
                                            </button>
                                            <button 
                                                onClick={() => handleSendReminder(t.studentName, t.leadId, t.token)}
                                                className="px-3 py-1.5 bg-[#6605c7] text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shadow-sm"
                                            >
                                                Send Reminder
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Sourcing alerts tips matching 14.3 */}
                <div className="flex flex-col sm:flex-row items-center justify-between p-4.5 bg-amber-50/50 border border-amber-100 rounded-2xl gap-4">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-2">
                        <span className="material-symbols-outlined text-base">warning</span> 
                        💡 Tip: Meena hasn't viewed her status — send a status tracking link reminder!
                    </span>
                    <button 
                        onClick={() => handleSendReminder("Meena Pillai", "LEAD-3098", "token-qrs")}
                        className="px-4 py-2 bg-[#6605c7] text-white text-[9px] font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-[#6605c7]/10"
                    >
                        Send Reminder → Meena
                    </button>
                </div>
            </div>

        </div>
    );
}
