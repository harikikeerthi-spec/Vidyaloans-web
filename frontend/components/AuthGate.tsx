"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface AuthGateProps {
    children: React.ReactNode;
    /** What kind of content is locked — used for the copy */
    contentLabel?: string;
}

export default function AuthGate({ children, contentLabel = "this content" }: AuthGateProps) {
    const { isAuthenticated, isLoading } = useAuth();
    const pathname = usePathname();
    const loginHref = `/login?redirect=${encodeURIComponent(pathname)}`;

    /* ── Loading skeleton ── */
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-14 h-14 border-4 border-[#6605c7]/20 border-t-[#6605c7] rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 text-sm font-medium">Loading…</p>
                </div>
            </div>
        );
    }

    /* ── Not authenticated — show lock screen ── */
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                {/* Blurred preview of content */}
                <div className="relative flex-1 overflow-hidden">
                    {/* Actual children rendered but fully blurred */}
                    <div className="pointer-events-none select-none blur-md opacity-40 scale-[1.02] origin-top">
                        {children}
                    </div>

                    {/* Overlay gate */}
                    <div className="absolute inset-0 flex items-center justify-center p-6" style={{ background: "linear-gradient(to bottom, rgba(249,250,251,0.3) 0%, rgba(249,250,251,0.96) 30%, rgba(249,250,251,1) 60%)" }}>
                        <div className="max-w-md w-full text-center">
                            {/* Lock icon */}
                            <div className="relative inline-flex mb-6">
                                <div className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl" style={{ background: "linear-gradient(135deg, #6605c7 0%, #a855f7 100%)" }}>
                                    <span className="material-symbols-outlined text-white text-5xl" style={{ fontVariationSettings: '"FILL" 1' }}>lock</span>
                                </div>
                                {/* Vidyaloan badge */}
                                <div className="absolute -top-2 -right-2 bg-white rounded-full px-2 py-1 shadow-lg border border-purple-100 flex items-center gap-1">
                                    <span className="text-[10px] font-black text-[#6605c7]">VidyaLoan</span>
                                </div>
                            </div>

                            {/* Headline */}
                            <h2 className="text-3xl font-black text-gray-900 mb-3 leading-tight">
                                Sign in to unlock<br />
                                <span style={{ background: "linear-gradient(135deg, #6605c7, #a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                                    {contentLabel}
                                </span>
                            </h2>
                            <p className="text-gray-500 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
                                Create a free VidyaLoans account to access university details, compare education loans, and get AI-matched to the best lenders.
                            </p>

                            {/* Perks list */}
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-7 text-left space-y-3">
                                {[
                                    { icon: "school", text: "Full university profiles & rankings" },
                                    { icon: "auto_awesome", text: "AI-powered loan eligibility check" },
                                    { icon: "compare_arrows", text: "Compare loans from 5+ partner lenders" },
                                    { icon: "payments", text: "Collateral-free loan up to ₹1 Cr" },
                                ].map((p) => (
                                    <div key={p.icon} className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                                            <span className="material-symbols-outlined text-[#6605c7] text-base" style={{ fontVariationSettings: '"FILL" 1' }}>{p.icon}</span>
                                        </div>
                                        <span className="text-sm font-medium text-gray-700">{p.text}</span>
                                    </div>
                                ))}
                            </div>

                            {/* CTA Buttons */}
                            <div className="flex flex-col gap-3">
                                <Link
                                    href={loginHref}
                                    className="w-full py-4 rounded-2xl text-white font-black text-base flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:opacity-95 transition-all"
                                    style={{ background: "linear-gradient(135deg, #6605c7 0%, #a855f7 100%)" }}
                                >
                                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: '"FILL" 1' }}>login</span>
                                    Login to VidyaLoan
                                </Link>
                                <Link
                                    href={`${loginHref}&signup=true`}
                                    className="w-full py-4 rounded-2xl text-[#6605c7] font-bold text-base border-2 border-[#6605c7]/20 bg-white hover:border-[#6605c7]/40 hover:bg-purple-50/50 transition-all flex items-center justify-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: '"FILL" 1' }}>person_add</span>
                                    Create Free Account
                                </Link>
                            </div>

                            <p className="text-gray-400 text-xs mt-5">
                                By signing up, you agree to VidyaLoan&apos;s{" "}
                                <Link href="/terms-conditions" className="text-[#6605c7] hover:underline">Terms</Link>
                                {" "}&amp;{" "}
                                <Link href="/privacy-policy" className="text-[#6605c7] hover:underline">Privacy Policy</Link>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    /* ── Authenticated — render normally ── */
    return <>{children}</>;
}
