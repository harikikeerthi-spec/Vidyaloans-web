"use client";

import React, { useState, useEffect } from "react";
import { referralApi } from "@/lib/api";

interface ReferralStats {
    totalReferrals: number;
    completedReferrals: number;
    signedUpReferrals: number;
    pendingReferrals: number;
    totalVisits: number;
    tier: string;
    nextTierAt: number | null;
    totalEarned?: number;
}

interface ReferralItem {
    id: string;
    refereeEmail: string;
    refereeName: string | null;
    status: string;
    reward: string | null;
    createdAt: string;
}

interface ReferralClientPageProps {
    initialData: {
        referralCode: string;
        stats: ReferralStats;
        referrals: ReferralItem[];
    };
    userEmail: string;
}

export default function ReferralClientPage({ initialData, userEmail }: ReferralClientPageProps) {
    const [referralCode, setReferralCode] = useState(initialData.referralCode);
    const [stats, setStats] = useState<ReferralStats>(initialData.stats);
    const [referrals, setReferrals] = useState<ReferralItem[]>(initialData.referrals);
    const [copied, setCopied] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteLoading, setInviteLoading] = useState(false);
    const [inviteMessage, setInviteMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const referralLink = typeof window !== "undefined" 
        ? `${window.location.origin}/apply-loan?ref=${referralCode}`
        : `https://vidyaloans.in/apply-loan?ref=${referralCode}`;

    // Polling logic: fetch every 45s
    useEffect(() => {
        const pollData = async () => {
            try {
                const res = await referralApi.getMe() as any;
                if (res && res.success) {
                    setReferralCode(res.referralCode);
                    setStats(res.stats);
                    setReferrals(res.referrals);
                }
            } catch (err) {
                console.warn("Silent referral poll failed:", err);
            }
        };

        const interval = setInterval(pollData, 45000);
        return () => clearInterval(interval);
    }, []);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSendInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;
        setInviteLoading(true);
        setInviteMessage(null);
        try {
            await referralApi.sendInvite(inviteEmail);
            setInviteMessage({ type: "success", text: `Invitation sent successfully to ${inviteEmail}!` });
            setInviteEmail("");
            // Refresh list
            const res = await referralApi.getMe() as any;
            if (res && res.success) {
                setReferrals(res.referrals);
                setStats(res.stats);
            }
        } catch (err: any) {
            setInviteMessage({ 
                type: "error", 
                text: err.message || "Failed to send invitation. Please try again." 
            });
        } finally {
            setInviteLoading(false);
        }
    };

    const shareWhatsApp = () => {
        const text = `Hey! I'm using VidyaLoans to check my study abroad education loan eligibility and get the best interest rates. Sign up using my link and we can both get rewards: ${referralLink}`;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    };

    const shareEmail = () => {
        const subject = "Get the best Education Loan with VidyaLoans";
        const body = `Hey,\n\nI recommend using VidyaLoans to secure your study abroad education loan. They match you with top lenders and offer priority support. Sign up using my unique referral link to get started:\n\n${referralLink}\n\nBest regards!`;
        window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, "_blank");
    };

    // Calculate progress towards 5 referral milestone
    const completedCount = stats.completedReferrals || 0;
    const progressPercent = Math.min((completedCount / 5) * 100, 100);

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0a051b] via-[#0f0b2a] to-[#090416] text-white pt-24 pb-16 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto space-y-8">
                
                {/* Hero Header */}
                <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#6605c7] to-[#9b00e8] p-8 sm:p-12 shadow-2xl shadow-purple-900/30">
                    <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-y-1/4 translate-x-1/4">
                        <span className="material-symbols-outlined text-[300px]">volunteer_activism</span>
                    </div>
                    <div className="max-w-2xl space-y-4">
                        <span className="px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold tracking-wider uppercase">Referral Program</span>
                        <h1 className="text-4xl sm:text-5xl font-extrabold font-display leading-tight">
                            Refer & Earn <span className="text-[#ffd700]">₹3,000</span>
                        </h1>
                        <p className="text-purple-100 text-lg">
                            Introduce your friends to VidyaLoans. Get ₹3,000 credited to your account the moment their loan is disbursed. Plus, unlock a massive <span className="font-bold text-white">₹10,000 bonus</span> on your 5th successful referral!
                        </p>
                    </div>
                </div>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-[#150f38] border border-purple-900/30 rounded-2xl p-6 flex flex-col justify-between hover:border-purple-500/30 transition-all">
                        <div className="text-purple-400 text-sm font-semibold uppercase tracking-wider">Total Earnings</div>
                        <div className="mt-4 flex items-baseline gap-2">
                            <span className="text-4xl font-extrabold text-[#ffd700]">₹{(stats.totalEarned || 0).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="mt-2 text-xs text-purple-300">Paid directly to your linked wallet</div>
                    </div>

                    <div className="bg-[#150f38] border border-purple-900/30 rounded-2xl p-6 flex flex-col justify-between hover:border-purple-500/30 transition-all">
                        <div className="text-purple-400 text-sm font-semibold uppercase tracking-wider">Successful Referrals</div>
                        <div className="mt-4 text-4xl font-extrabold text-white">{stats.completedReferrals}</div>
                        <div className="mt-2 text-xs text-purple-300">Loans disbursed successfully</div>
                    </div>

                    <div className="bg-[#150f38] border border-purple-900/30 rounded-2xl p-6 flex flex-col justify-between hover:border-purple-500/30 transition-all">
                        <div className="text-purple-400 text-sm font-semibold uppercase tracking-wider">Joined Friends</div>
                        <div className="mt-4 text-4xl font-extrabold text-white">{stats.signedUpReferrals}</div>
                        <div className="mt-2 text-xs text-purple-300">Signed up & processing loans</div>
                    </div>

                    <div className="bg-[#150f38] border border-purple-900/30 rounded-2xl p-6 flex flex-col justify-between hover:border-purple-500/30 transition-all">
                        <div className="text-purple-400 text-sm font-semibold uppercase tracking-wider">Referral Link Clicks</div>
                        <div className="mt-4 text-4xl font-extrabold text-white">{stats.totalVisits}</div>
                        <div className="mt-2 text-xs text-purple-300">Total clicks on your links</div>
                    </div>
                </div>

                {/* Milestone Progress Bar */}
                <div className="bg-[#150f38]/80 border border-purple-900/30 rounded-2xl p-6 sm:p-8 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#ffd700]">military_tech</span>
                                Milestone Progress: ₹10,000 Bonus
                            </h2>
                            <p className="text-sm text-purple-300 mt-1">Get 5 successful referrals to unlock the super bonus.</p>
                        </div>
                        <div className="text-right">
                            <span className="text-lg font-bold text-white">{completedCount}</span>
                            <span className="text-purple-400 text-sm"> / 5 referred</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="w-full bg-[#0a051b] rounded-full h-4 overflow-hidden border border-purple-900/50">
                            <div 
                                className="bg-gradient-to-r from-amber-500 to-[#ffd700] h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(245,158,11,0.5)]" 
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-purple-400">
                            <span>Start</span>
                            <span>5 Referrals (₹10,000 Extra credited)</span>
                        </div>
                    </div>
                    {completedCount >= 5 && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3">
                            <span className="material-symbols-outlined text-amber-400 text-2xl">workspace_premium</span>
                            <span className="text-amber-200 text-sm font-medium">Milestone Unlocked! An additional ₹10,000 has been credited to your rewards dashboard. Keep referring!</span>
                        </div>
                    )}
                </div>

                {/* Share Actions Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* Share Link Card */}
                    <div className="bg-[#150f38] border border-purple-900/30 rounded-2xl p-6 sm:p-8 space-y-6">
                        <h2 className="text-xl font-bold">Your Unique Referral Link</h2>
                        <p className="text-purple-300 text-sm">Share this link with your friends. When they check eligibility or apply, we automatically track them to your account.</p>
                        
                        <div className="flex items-center gap-2 bg-[#090416] p-3 rounded-xl border border-purple-900/50">
                            <input 
                                type="text" 
                                readOnly 
                                value={referralLink} 
                                className="bg-transparent border-none text-purple-200 text-sm w-full outline-none focus:ring-0"
                            />
                            <button 
                                onClick={copyToClipboard}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shrink-0 active:scale-95"
                            >
                                <span className="material-symbols-outlined text-sm">{copied ? "check" : "content_copy"}</span>
                                {copied ? "Copied" : "Copy"}
                            </button>
                        </div>

                        <div className="flex gap-4">
                            <button 
                                onClick={shareWhatsApp}
                                className="flex-1 py-3 px-4 bg-[#25d366] hover:bg-[#20ba5a] text-[#0f0b2a] font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                            >
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                    <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.333 4.982L2 22l5.233-1.371a9.936 9.936 0 004.779 1.218h.004c5.502 0 9.986-4.479 9.988-9.987a9.93 9.93 0 00-2.92-7.067A9.93 9.93 0 0012.012 2zm5.836 14.199c-.32.899-1.577 1.649-2.185 1.761-.55.101-1.272.186-3.704-.816-3.109-1.282-5.111-4.444-5.267-4.65-.152-.207-1.229-1.634-1.229-3.119 0-1.485.779-2.213 1.055-2.518.277-.306.607-.382.809-.382.203 0 .405.002.582.01.186.008.435-.072.68.52.253.612.868 2.116.944 2.269.077.153.128.331.026.536-.102.205-.153.332-.304.51-.153.18-.321.401-.458.538-.153.153-.313.32-.136.626.177.306.789 1.301 1.69 2.103.901.802 1.66 1.05 1.966 1.203.306.153.483.127.662-.077.177-.205.765-.89 1.019-1.272.253-.382.507-.318.854-.191.349.127 2.213 1.043 2.593 1.233.379.191.633.287.722.44.089.153.089.885-.231 1.785z"/>
                                </svg>
                                WhatsApp
                            </button>
                            <button 
                                onClick={shareEmail}
                                className="flex-1 py-3 px-4 bg-purple-900/50 hover:bg-purple-900/75 text-white font-bold rounded-xl border border-purple-500/30 flex items-center justify-center gap-2 transition-all"
                            >
                                <span className="material-symbols-outlined text-lg">mail</span>
                                Email Link
                            </button>
                        </div>
                    </div>

                    {/* Email Invite Form */}
                    <div className="bg-[#150f38] border border-purple-900/30 rounded-2xl p-6 sm:p-8 space-y-6">
                        <h2 className="text-xl font-bold">Invite via Email</h2>
                        <p className="text-purple-300 text-sm">Send a direct invitation email containing your link and loan eligibility matched tools directly to your friend.</p>
                        
                        <form onSubmit={handleSendInvite} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs text-purple-400 uppercase tracking-wider font-semibold">Friend's Email Address</label>
                                <input 
                                    type="email" 
                                    required
                                    placeholder="friend@university.com"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    className="w-full bg-[#090416] border border-purple-900/50 focus:border-purple-500 rounded-xl px-4 py-3 text-purple-200 outline-none transition-all text-sm"
                                />
                            </div>

                            <button 
                                type="submit"
                                disabled={inviteLoading}
                                className="w-full py-3 bg-[#6605c7] hover:bg-[#7c07f2] disabled:bg-purple-800/50 text-white font-bold rounded-xl transition-all shadow-md shadow-purple-900/20 flex items-center justify-center gap-2"
                            >
                                {inviteLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-lg">send</span>
                                        Send Invitation
                                    </>
                                )}
                            </button>
                        </form>

                        {inviteMessage && (
                            <div className={`p-4 rounded-xl text-sm border ${
                                inviteMessage.type === "success" 
                                    ? "bg-green-500/10 border-green-500/30 text-green-300" 
                                    : "bg-red-500/10 border-red-500/30 text-red-300"
                            }`}>
                                {inviteMessage.text}
                            </div>
                        )}
                    </div>
                </div>

                {/* Friend Referrals Table */}
                <div className="bg-[#150f38] border border-purple-900/30 rounded-2xl overflow-hidden">
                    <div className="p-6 sm:p-8 border-b border-purple-900/30">
                        <h2 className="text-xl font-bold">Referral Status Tracker</h2>
                        <p className="text-purple-300 text-sm mt-1">Track which friends have signed up and when rewards are disbursed.</p>
                    </div>

                    {referrals.length === 0 ? (
                        <div className="p-12 text-center text-purple-400/80">
                            <span className="material-symbols-outlined text-5xl mb-3 block">group</span>
                            No referrals logged yet. Share your link to get started!
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#0c0824] border-b border-purple-900/30 text-purple-400 text-xs font-semibold uppercase tracking-wider">
                                        <th className="px-6 py-4">Friend</th>
                                        <th className="px-6 py-4">Joined Date</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Earned Reward</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-purple-900/20">
                                    {referrals.map((ref) => (
                                        <tr key={ref.id} className="hover:bg-[#1c144a]/40 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-semibold text-white">
                                                    {ref.refereeName || "Registered User"}
                                                </div>
                                                <div className="text-xs text-purple-400">{ref.refereeEmail}</div>
                                            </td>
                                            <td className="px-6 py-4 text-purple-300 text-sm">
                                                {new Date(ref.createdAt).toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                                                    ref.status === "rewarded"
                                                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                                                        : ref.status === "completed" || ref.status === "paid"
                                                        ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                                                        : ref.status === "signed_up"
                                                        ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                                        : "bg-gray-500/10 border-gray-500/30 text-gray-400"
                                                }`}>
                                                    {ref.status === "rewarded" ? "Pending Payout" : 
                                                     ref.status === "completed" || ref.status === "paid" ? "Paid Out" : 
                                                     ref.status === "signed_up" ? "Joined" : "Pending"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-extrabold text-[#ffd700] text-sm">
                                                {ref.reward || "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
