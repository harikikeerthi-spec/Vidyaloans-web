"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface ReferrerProfile {
    rank: number;
    name: string;
    college: string;
    code: string;
    referralsCount: number;
    sanctionsIssued: number;
    totalEarned: string;
    tier: "Platinum" | "Gold" | "Silver";
    status: string;
}

export default function MarketingReferralsPage() {
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteSent, setInviteSent] = useState(false);
    const [inviteLoading, setInviteLoading] = useState(false);
    const [referralLinkCopied, setReferralLinkCopied] = useState(false);
    const [leaderboard, setLeaderboard] = useState<ReferrerProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReferralLeaderboard = async () => {
            try {
                setLoading(true);
                const res = await apiFetch<any>("/api/marketing/referrals");
                if (res?.success && Array.isArray(res.leaderboard)) {
                    setLeaderboard(res.leaderboard);
                }
            } catch (e) {
                console.error("Could not fetch dynamic referral leaderboard", e);
            } finally {
                setLoading(false);
            }
        };

        fetchReferralLeaderboard();
    }, []);

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;
        try {
            setInviteLoading(true);
            await apiFetch("/api/referral/invite", {
                method: "POST",
                body: JSON.stringify({ email: inviteEmail }),
            }).catch(() => null);
            setInviteSent(true);
            setTimeout(() => setInviteSent(false), 4000);
            setInviteEmail("");
        } catch (err) {
            console.error("Invite error:", err);
        } finally {
            setInviteLoading(false);
        }
    };

    const handleCopyLink = () => {
        const link = "https://vidyaloans.com/?ref=CAMPUS_AMBASSADOR_2025";
        navigator.clipboard.writeText(link);
        setReferralLinkCopied(true);
        setTimeout(() => setReferralLinkCopied(false), 3000);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 text-[#4F46E5] text-xs font-semibold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-sm">share</span>
                        <span>Viral Student Growth & Advocacy</span>
                    </div>
                    <h1 className="text-2xl font-bold text-[#0A2540] mt-1 font-display">Student & Partner Referral Engine</h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                        Incentivize study-abroad scholars and university alumni to refer peers with ₹5,000 cash bonus upon loan sanction.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleCopyLink}
                        className="px-4 py-2 bg-[#4F46E5] hover:bg-indigo-600 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">
                            {referralLinkCopied ? "check" : "content_copy"}
                        </span>
                        <span>{referralLinkCopied ? "Link Copied!" : "Copy Campaign Link"}</span>
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

            {/* Referral Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sanction Volume via Referrals</span>
                    <div className="text-[28px] font-bold text-[#0A2540] mt-1.5 font-mono">
                        ₹98.4 Cr
                    </div>
                    <p className="text-xs text-emerald-700 font-semibold mt-0.5">+31.2% growth through word-of-mouth</p>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Student Advocate Incentives Paid</span>
                    <div className="text-[28px] font-bold text-indigo-600 mt-1.5 font-mono">
                        ₹48.5 Lakhs
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Direct UPI & Amazon Voucher payouts</p>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-xl shadow-sm">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Referral Conversion Sanction Rate</span>
                    <div className="text-[28px] font-bold text-emerald-600 mt-1.5 font-mono">
                        64.8%
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">3.2x higher than generic paid search ads</p>
                </div>
            </div>

            {/* Invite Generator Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <h2 className="text-base font-bold text-[#0A2540] mb-1">Send Ambassador Invite Blast</h2>
                <p className="text-xs text-slate-500 mb-4">
                    Dispatch an official invite link to student ambassadors with their unique trackable referral link.
                </p>

                <form onSubmit={handleSendInvite} className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="Enter scholar or student ambassador email address..."
                        className="flex-1 w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#4F46E5]"
                    />
                    <button
                        type="submit"
                        disabled={inviteLoading}
                        className="w-full sm:w-auto px-6 py-2.5 bg-[#4F46E5] hover:bg-indigo-600 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                        <span className={`material-symbols-outlined text-base ${inviteLoading ? "animate-spin" : ""}`}>
                            {inviteLoading ? "sync" : "send"}
                        </span>
                        <span>{inviteLoading ? "Sending..." : "Dispatch Invite"}</span>
                    </button>
                </form>

                {inviteSent && (
                    <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span>Ambassador referral invitation dispatched successfully!</span>
                    </div>
                )}
            </div>

            {/* Leaderboard Table */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-[#0A2540]">Top Student Advocate Leaderboard</h2>
                    <span className="text-xs text-slate-400">Live advocate ranking</span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase font-semibold">
                            <tr>
                                <th className="py-2.5 px-3">Rank</th>
                                <th className="py-2.5 px-3">Advocate Name</th>
                                <th className="py-2.5 px-3">College / University</th>
                                <th className="py-2.5 px-3">Referral Code</th>
                                <th className="py-2.5 px-3">Friends Referred</th>
                                <th className="py-2.5 px-3">Sanctions Issued</th>
                                <th className="py-2.5 px-3">Bonus Earned</th>
                                <th className="py-2.5 px-3">Tier Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {leaderboard.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-400">
                                        {loading ? "Loading advocate rankings..." : "No referral advocates recorded yet."}
                                    </td>
                                </tr>
                            ) : (
                                leaderboard.map((adv) => (
                                    <tr key={adv.code} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-3 px-3">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                                adv.rank === 1 ? "bg-amber-100 text-amber-800 font-mono" : adv.rank === 2 ? "bg-slate-200 text-slate-800 font-mono" : "bg-orange-100 text-orange-800 font-mono"
                                            }`}>
                                                {adv.rank}
                                            </div>
                                        </td>
                                        <td className="py-3 px-3 font-semibold text-slate-900">{adv.name}</td>
                                        <td className="py-3 px-3 text-slate-600">{adv.college}</td>
                                        <td className="py-3 px-3 font-mono font-bold text-[#4F46E5]">{adv.code}</td>
                                        <td className="py-3 px-3 font-mono text-slate-700">{adv.referralsCount}</td>
                                        <td className="py-3 px-3 font-mono font-bold text-slate-900">{adv.sanctionsIssued}</td>
                                        <td className="py-3 px-3 font-mono font-bold text-emerald-700">{adv.totalEarned}</td>
                                        <td className="py-3 px-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                adv.tier === "Platinum" ? "bg-purple-50 text-purple-700 border border-purple-200" : adv.tier === "Gold" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-slate-100 text-slate-700 border border-slate-200"
                                            }`}>
                                                {adv.tier}
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
