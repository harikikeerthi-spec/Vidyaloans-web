"use client";

import React, { useState } from "react";

interface LenderLogoProps {
    name: string;
    logo?: string;
    className?: string;
    containerClassName?: string;
}

export default function LenderLogo({
    name,
    logo,
    className = "",
    containerClassName = "w-28 h-12"
}: LenderLogoProps) {
    const [hasError, setHasError] = useState(false);

    const initials = (name || "BK")
        .split(" ")
        .map((w: string) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase();

    if (!logo || hasError) {
        return (
            <div
                className={`rounded-lg bg-gradient-to-br from-purple-50 via-white to-purple-50/40 border border-purple-200/60 flex items-center justify-center gap-1.5 shadow-2xs select-none ${containerClassName} ${className}`}
                title={name}
            >
                <span className="material-symbols-outlined text-[16px] text-[#6605c7]">account_balance</span>
                <span className="text-[12px] font-black text-[#6605c7] tracking-tight">{initials}</span>
            </div>
        );
    }

    return (
        <div
            className={`flex items-center justify-center p-1.5 overflow-hidden transition-all duration-300 bg-white/70 rounded-lg border border-gray-100 shadow-2xs ${containerClassName} ${className}`}
        >
            <img
                src={logo}
                alt={name}
                className="w-full h-full object-contain"
                onError={() => setHasError(true)}
            />
        </div>
    );
}
