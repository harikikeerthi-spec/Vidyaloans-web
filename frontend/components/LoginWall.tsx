"use client";

import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function LoginWall({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Prevent hydration mismatch
    if (!mounted) {
        return <>{children}</>;
    }

    // Skip pages that are meant to be fully public or are the login/signup flow
    const skipList = ["/", "/login", "/signup", "/api-test", "/test-admin-system", "/connected", "/referral", "/landing", "/apply-loan"];
    // Also skip static/marketing/bank detail pages without triggering login wall
    const alwaysPublic = [
        "/about-us",
        "/faq",
        "/terms-conditions",
        "/privacy-policy",
        "/contact",
        "/how-it-works",
        "/cookies",
        "/blog",
        "/community",
        "/community-events",
        "/discussion",
        "/sop-writer",
        "/sop-analyzer",
        "/admit-predictor",
        "/compare-universities",
        "/grade-converter",
        "/emi",
        "/loan-eligibility",
        "/bank",
        "/bank-reviews",
        "/compare-loans",
        "/find-university",
        "/university"
    ];

    if (skipList.includes(pathname) || alwaysPublic.some(p => pathname.startsWith(p))) {
        return <>{children}</>;
    }

    if (isLoading) {
        return <>{children}</>;
    }

    if (!isAuthenticated) {
        return (
            <div className="relative">
                {/* 30% viewable, rest blurred or masked */}
                <div className="max-h-[100vh] overflow-hidden relative group">
                    {children}

                    {/* Gradient Fade Overlay */}
                    <div
                        className="absolute inset-x-0 bottom-0 h-[70vh] z-20 pointer-events-none"
                        style={{
                            background: "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.7) 20%, rgba(255,255,255,0.95) 50%, #ffffff 100%)"
                        }}
                    />

                    {/* Login Prompt Card */}
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-full max-w-xl px-4">
                        <div className="bg-white/90 backdrop-blur-2xl rounded-[3rem] p-12 shadow-[0_32px_120px_-10px_rgba(102,5,199,0.3)] border border-purple-100 text-center animate-fade-in-up">
                            <div className="w-24 h-24 bg-gradient-to-br from-[#6605c7] to-purple-400 rounded-[2rem] flex items-center justify-center text-white mx-auto mb-10 shadow-2xl shadow-purple-500/30 transform hover:scale-110 transition-transform duration-300">
                                <span className="material-symbols-outlined text-5xl font-bold">lock_open</span>
                            </div>

                            <h2 className="text-4xl font-bold font-display text-[#1a1626] mb-4 tracking-tight">
                                Unlock <span className="text-[#6605c7] italic">Everything</span>
                            </h2>
                            <p className="text-gray-500 mb-10 leading-relaxed text-lg font-medium px-4">
                                Login for full access to 5+ lenders, quick sanctions, and AI-driven counseling.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-5">
                                <Link
                                    href={`/login?redirect=${encodeURIComponent(pathname)}`}
                                    className="flex-[2] px-8 py-5 bg-[#6605c7] text-white font-bold rounded-2xl hover:bg-[#8b24e5] transition-all shadow-lg shadow-purple-500/25 text-lg uppercase tracking-wider"
                                >
                                    Login / Sign Up
                                </Link>
                                <button
                                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                    className="flex-1 px-8 py-5 bg-white text-gray-700 font-bold rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all text-sm uppercase tracking-wide"
                                >
                                    Explore Top
                                </button>
                            </div>

                            <p className="mt-8 text-xs text-gray-400 font-bold uppercase tracking-[0.2em]">
                                Join 10,000+ students already funding their dreams
                            </p>
                        </div>
                    </div>
                </div>

                {/* Mask everything below the wall just in case */}
                <div className="h-screen bg-white" />
            </div>
        );
    }

    return <>{children}</>;
}
