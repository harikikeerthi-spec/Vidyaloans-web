"use client";

import { useState, useEffect } from "react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

const SESSION_KEY = "vidyaloans_app_popup_seen";
const DEFAULT_PACKAGE_ID = "in.vidyaloans.app";
const DEFAULT_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=in.vidyaloans.app";

function GooglePlayLogo({ className = "w-5 h-5" }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 466 512"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                fill="#EA4335"
                d="M199.9 237.8L1.4 470.17c7.22 24.57 30.16 41.81 55.8 41.81 11.16 0 20.93-2.79 29.3-8.37l244.16-139.46L199.9 237.8z"
            />
            <path
                fill="#FBBC04"
                d="M433.91 205.1l-104.65-60-111.61 110.22 113.01 108.83 104.64-58.6c18.14-9.77 30.7-29.3 30.7-50.23-1.4-20.93-13.95-40.46-32.09-50.22z"
            />
            <path
                fill="#34A853"
                d="M199.42 273.45L329.27 145.1 87.9 8.37C79.53 2.79 68.36 0 57.2 0 30.7 0 6.98 18.14 1.4 41.86l198.02 231.59z"
            />
            <path
                fill="#4285F4"
                d="M1.39 41.86C0 46.04 0 51.63 0 57.2v397.64c0 5.57 0 9.76 1.4 15.34l216.27-214.86L1.39 41.86z"
            />
        </svg>
    );
}

export default function MobileAppDownloadBanner() {
    const { settings } = useSiteSettings();
    const [isVisible, setIsVisible] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);

    const playStoreUrl = (settings as any)?.playStoreUrl || DEFAULT_PLAY_STORE_URL;

    useEffect(() => {
        if (typeof window === "undefined") return;

        // Check if admin explicitly disabled the app banner
        if (settings && (settings as any).enableAppBanner === false) {
            window.dispatchEvent(new CustomEvent("vidya_app_popup_resolved"));
            return;
        }

        // Detect mobile device or viewport (< 768px)
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";
        const uaLower = ua.toLowerCase();
        const android = uaLower.includes("android");
        const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(uaLower);
        const mobileMediaQuery = window.matchMedia("(max-width: 767px)");
        const isMobile = android || isMobileUA || mobileMediaQuery.matches;

        setIsAndroid(android);

        if (!isMobile) {
            // Not a mobile device; notify cookie banner to proceed immediately
            window.dispatchEvent(new CustomEvent("vidya_app_popup_resolved"));
            return;
        }

        // Frequency capping: don't annoy user on every single link click in the same session
        // (can test anytime with ?app_popup=true or in a new tab)
        const urlParams = new URLSearchParams(window.location.search);
        const forceShow = urlParams.get("app_popup") === "true";
        try {
            const seenInSession = sessionStorage.getItem(SESSION_KEY);
            if (seenInSession && !forceShow) {
                window.dispatchEvent(new CustomEvent("vidya_app_popup_resolved"));
                return;
            }
        } catch {
            // Ignore storage errors
        }

        // Show popup shortly after mobile load
        const timer = setTimeout(() => {
            setIsVisible(true);
            if ("vibrate" in navigator) {
                try {
                    navigator.vibrate([30, 40, 30]);
                } catch {
                    // Ignore haptic errors
                }
            }
        }, 900);

        return () => clearTimeout(timer);
    }, [settings]);

    const handleDismiss = () => {
        setIsVisible(false);
        try {
            sessionStorage.setItem(SESSION_KEY, "true");
        } catch {
            // Ignore
        }
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("vidya_app_popup_resolved"));
        }
    };

    const handleDownload = () => {
        try {
            sessionStorage.setItem(SESSION_KEY, "true");
        } catch {
            // Ignore
        }

        // On Android try direct market intent, fallback to Play Store URL
        if (isAndroid) {
            const marketUrl = `market://details?id=${DEFAULT_PACKAGE_ID}`;
            window.location.href = marketUrl;
            setTimeout(() => {
                window.open(playStoreUrl, "_blank", "noopener,noreferrer");
            }, 600);
        } else {
            window.open(playStoreUrl, "_blank", "noopener,noreferrer");
        }

        setIsVisible(false);
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("vidya_app_popup_resolved"));
        }
    };

    if (!isVisible) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-app-popup-title"
            className="md:hidden fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={(e) => {
                if (e.target === e.currentTarget) handleDismiss();
            }}
        >
            <div className="w-full max-w-sm bg-white rounded-[28px] sm:rounded-[32px] p-5 sm:p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] border border-purple-100/70 relative overflow-hidden animate-in slide-in-from-bottom-8 duration-300">
                {/* Decorative Top Accent Gradient */}
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-[#6605c7] via-[#8b24e5] to-[#01875f]" />

                {/* Header Row: Badge & Dismiss Button */}
                <div className="flex items-center justify-between mb-4 pt-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 border border-purple-100/80 text-[#6605c7] text-[10.5px] font-extrabold uppercase tracking-wider">
                        <span className="material-symbols-outlined text-[13px]">smartphone</span>
                        Official Mobile App
                    </span>

                    <button
                        type="button"
                        onClick={handleDismiss}
                        aria-label="Close mobile app popup"
                        className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 flex items-center justify-center transition-colors cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">close</span>
                    </button>
                </div>

                {/* App Brand Presentation */}
                <div className="flex items-start gap-3.5 mb-4">
                    <div className="relative shrink-0">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6605c7] to-[#3b0764] p-2 flex items-center justify-center shadow-lg shadow-purple-900/30 border border-white/20">
                            <img
                                src={settings?.appIconUrl || "/icon.png"}
                                alt="VidyaLoans Mobile App"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = "/favicon.ico";
                                }}
                            />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-white p-0.5 shadow-md flex items-center justify-center border border-gray-100">
                            <GooglePlayLogo className="w-3.5 h-3.5" />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 id="mobile-app-popup-title" className="text-base font-extrabold text-gray-900 tracking-tight leading-tight">
                            We Have a Mobile App!
                        </h3>
                        <p className="text-xs font-semibold text-[#6605c7] mt-0.5">
                            VidyaLoans: Overseas Loans
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-500 font-medium">
                            <span className="flex items-center text-amber-500 font-bold">★ 4.8</span>
                            <span>•</span>
                            <span>Free</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[12px]">verified</span>
                                Google Play
                            </span>
                        </div>
                    </div>
                </div>

                {/* Key Benefits List */}
                <div className="bg-gradient-to-br from-purple-50/60 to-slate-50 border border-purple-100/60 rounded-2xl p-3 mb-4 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-[#6605c7] flex items-center justify-center text-[11px] font-bold shrink-0">
                            ✓
                        </span>
                        <span>Compare <strong>5+ Partner Banks</strong> with instant quotes</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-[#6605c7] flex items-center justify-center text-[11px] font-bold shrink-0">
                            ✓
                        </span>
                        <span><strong>1-Tap Document Upload</strong> from your phone</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                        <span className="w-5 h-5 rounded-full bg-purple-100 text-[#6605c7] flex items-center justify-center text-[11px] font-bold shrink-0">
                            ✓
                        </span>
                        <span><strong>Live Status Tracking</strong> with push notifications</span>
                    </div>
                </div>

                {/* Primary CTA: Direct Download Link to Play Store */}
                <div className="space-y-2 pt-1">
                    <button
                        type="button"
                        onClick={handleDownload}
                        className="w-full min-h-[48px] px-5 py-3 rounded-2xl bg-[#01875f] hover:bg-[#00704e] active:scale-[0.98] text-white text-sm font-bold shadow-lg shadow-[#01875f]/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                    >
                        <GooglePlayLogo className="w-5 h-5 shrink-0" />
                        <span className="tracking-wide">Download on Google Play</span>
                        <span className="material-symbols-outlined text-base">arrow_forward</span>
                    </button>

                    {/* Secondary Action */}
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="w-full min-h-[44px] py-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors cursor-pointer text-center"
                    >
                        Continue to Website
                    </button>
                </div>
            </div>
        </div>
    );
}
