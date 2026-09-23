"use client";

import React from "react";
import { ShieldCheck, ShieldAlert, AlertCircle } from "lucide-react";

export interface EmailRemoteResourceBannerProps {
    isBlocked: boolean;
    onAllow: () => void;
    senderEmail?: string;
}

export function EmailRemoteResourceBanner({
    isBlocked,
    onAllow,
    senderEmail,
}: EmailRemoteResourceBannerProps) {
    if (!isBlocked) {
        return (
            <div className="mx-6 my-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-50/90 via-emerald-50/60 to-teal-50/60 border border-emerald-200/80 flex items-center justify-between text-xs text-emerald-900 shadow-2xs transition-all animate-in fade-in duration-200">
                <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <span className="font-semibold text-emerald-800">
                        Remote images &amp; external resources are allowed for this message.
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-6 my-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-50/95 via-amber-50/70 to-orange-50/60 border border-amber-200/90 flex items-center justify-between text-xs text-[#5C3B00] shadow-2xs transition-all">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-6 h-6 rounded-full bg-amber-100 border border-amber-300/80 flex items-center justify-center shrink-0 text-amber-800 font-black text-xs shadow-2xs">
                    !
                </div>
                <span className="font-semibold text-slate-800 truncate">
                    To protect your privacy remote resources have been blocked.
                </span>
            </div>

            <button
                type="button"
                onClick={onAllow}
                className="ml-3 px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl transition-all duration-200 shrink-0 cursor-pointer shadow-sm hover:shadow hover:-translate-y-0.5 active:translate-y-0"
            >
                Allow
            </button>
        </div>
    );
}
