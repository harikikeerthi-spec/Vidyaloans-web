"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

export default function MobileFloatingActionBar() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            if (window.scrollY > 150) {
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    if (!isVisible) return null;

    return (
        <aside aria-label="Quick Action Bar" className="fixed bottom-3 inset-x-3 z-40 md:hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="bg-white/90 backdrop-blur-xl border border-purple-200/80 shadow-2xl rounded-2xl p-2 flex items-center justify-between gap-2 shadow-purple-950/15">
                {/* Check Eligibility / Apply Primary Action */}
                <Link
                    href="/loan-eligibility"
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl bg-gradient-to-r from-[#6605c7] to-[#8b24e5] text-white text-xs font-black shadow-md shadow-purple-600/30 active:scale-95 transition-all text-center"
                >
                    <span className="material-symbols-outlined text-base">verified</span>
                    <span>Check Eligibility</span>
                </Link>

                {/* Calculate EMI */}
                <Link
                    href="/emi"
                    className="flex items-center justify-center gap-1 py-3 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6605c7] text-xs font-black active:scale-95 transition-all border border-purple-100"
                    title="Calculate EMI"
                >
                    <span className="material-symbols-outlined text-base">calculate</span>
                    <span className="hidden xs:inline">EMI</span>
                </Link>

                {/* Refer & Earn (Locked) - Hidden until live */}
                {false && (
                <div
                    className="relative flex items-center justify-center p-3 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/80 cursor-default"
                    title="Refer & Earn — Locked (Coming Soon)"
                >
                    <span className="material-symbols-outlined text-base text-amber-600">card_giftcard</span>
                    <div className="absolute -top-1.5 -right-1 bg-amber-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold border border-white">
                        <span className="material-symbols-outlined text-[9px]">lock</span>
                    </div>
                </div>
                )}
            </div>
        </aside>
    );
}
