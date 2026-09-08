"use client";

import React, { useState } from "react";
import Link from "next/link";

interface LenderItem {
    name: string;
    slug: string;
    rate: string;
    time: string;
    fee: string;
    logo: string;
    link?: string;
    badge?: string;
}

interface MobileLendersCardSliderProps {
    lenders: LenderItem[];
}

export default function MobileLendersCardSlider({ lenders }: MobileLendersCardSliderProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

    if (!lenders || lenders.length === 0) return null;

    const filtered = lenders.filter(l => {
        if (selectedCategory === "all") return true;
        if (selectedCategory === "fast") return l.time?.toLowerCase().includes("48") || l.time?.toLowerCase().includes("24") || l.time?.toLowerCase().includes("3");
        if (selectedCategory === "low_rate") return parseFloat(l.rate) <= 10.5;
        return true;
    });

    const activeList = filtered.length > 0 ? filtered : lenders;
    const current = activeList[Math.min(currentIndex, activeList.length - 1)] || activeList[0];

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % activeList.length);
    };

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + activeList.length) % activeList.length);
    };

    return (
        <div className="block md:hidden w-full my-6">
            {/* Category Filter Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 no-scrollbar px-1">
                {[
                    { id: "all", label: "All Lenders" },
                    { id: "low_rate", label: "Lowest Rates" },
                    { id: "fast", label: "Fast Approval (≤48h)" },
                ].map(cat => (
                    <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                            setSelectedCategory(cat.id);
                            setCurrentIndex(0);
                        }}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                            selectedCategory === cat.id
                                ? "bg-[#6605c7] text-white shadow-md shadow-[#6605c7]/25"
                                : "bg-white/80 text-gray-600 border border-gray-200/80"
                        }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Main Interactive Mobile Card */}
            <div className="relative bg-white rounded-2xl p-5 shadow-xl border border-purple-100/80 overflow-hidden mt-2">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#6605c7]/10 to-amber-500/10 rounded-full blur-2xl pointer-events-none" />

                {/* Top Row: Bank Info & Counter */}
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-16 h-12 bg-gray-50/80 rounded-xl p-1.5 flex items-center justify-center border border-gray-100 shadow-xs">
                            {current.logo && !imgErrors[current.name] ? (
                                <img
                                    src={current.logo}
                                    alt={current.name}
                                    className="w-full h-full object-contain"
                                    onError={() => setImgErrors(prev => ({ ...prev, [current.name]: true }))}
                                />
                            ) : (
                                <div className="w-9 h-9 rounded-lg bg-purple-100 text-[#6605c7] flex items-center justify-center font-black text-xs">
                                    {current.name.slice(0, 2).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="text-base font-black text-gray-900 leading-tight">{current.name}</h3>
                            <span className="text-[11px] font-bold text-gray-400">Education Loan</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-[11px] font-black text-[#6605c7] bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100">
                            {currentIndex + 1} / {activeList.length}
                        </span>
                    </div>
                </div>

                {/* Card Key Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 my-4">
                    <div className="bg-gradient-to-b from-purple-50/60 to-purple-50/20 p-3 rounded-xl border border-purple-100/50 text-center">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Interest Rate</span>
                        <span className="block text-sm font-black text-[#6605c7] mt-0.5">{current.rate}</span>
                    </div>
                    <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 text-center">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Approval Time</span>
                        <span className="block text-xs font-black text-gray-800 mt-0.5">{current.time}</span>
                    </div>
                    <div className="bg-gray-50/80 p-3 rounded-xl border border-gray-100 text-center">
                        <span className="block text-[9px] font-bold text-gray-400 uppercase tracking-wider">Processing Fee</span>
                        <span className="block text-xs font-black text-gray-800 mt-0.5">{current.fee}</span>
                    </div>
                </div>

                {/* Primary Action Button */}
                <Link
                    href={`/bank/${current.slug}`}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#6605c7] text-white text-xs font-black shadow-lg shadow-[#6605c7]/30 hover:bg-[#5504a8] active:scale-[0.98] transition-all"
                >
                    View Bank Details & Apply
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">arrow_forward</span>
                </Link>

                {/* Next / Previous Controls */}
                <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={handlePrev}
                        aria-label="Previous bank"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                        <span>Previous</span>
                    </button>

                    {/* Dot indicators */}
                    <div className="flex items-center gap-1">
                        {activeList.slice(0, Math.min(activeList.length, 6)).map((_, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => setCurrentIndex(i)}
                                className={`h-1.5 rounded-full transition-all ${
                                    currentIndex === i ? "w-4 bg-[#6605c7]" : "w-1.5 bg-gray-200"
                                }`}
                                aria-label={`Go to slide ${i + 1}`}
                            />
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={handleNext}
                        aria-label="Next bank"
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#0F172A] hover:bg-black text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
                    >
                        <span>Next Bank</span>
                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
