"use client";

import { useState, useEffect } from "react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

const STORAGE_KEY = "vidyaloans_playstore_popup_dismissed";
const COOLDOWN_DAYS = 7;
const DEFAULT_PACKAGE_ID = "in.vidyaloans.app";
const DEFAULT_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=in.vidyaloans.app&hl=en-US&ah=Vx9t8taW0pweH2uHyGVMktR2FLs`;

export default function MobileAppDownloadBanner() {
    const { settings } = useSiteSettings();
    const [isVisible, setIsVisible] = useState(false);
    const [isAndroid, setIsAndroid] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        // Check if admin disabled the mobile app banner
        if (settings && (settings as any).enableAppBanner === false) {
            return;
        }

        // Check frequency capping: suppress if user dismissed within last 7 days
        try {
            const dismissedAt = localStorage.getItem(STORAGE_KEY);
            if (dismissedAt) {
                const diffMs = Date.now() - parseInt(dismissedAt, 10);
                const diffDays = diffMs / (1000 * 60 * 60 * 24);
                if (diffDays < COOLDOWN_DAYS) {
                    return;
                }
            }
        } catch {
            // Ignore localStorage parse errors
        }

        // Check device type
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";
        const uaLower = ua.toLowerCase();
        const android = uaLower.includes("android");
        const ios = /iphone|ipad|ipod/.test(uaLower);
        const isMobileScreen = window.innerWidth < 768;

        setIsAndroid(android);
        setIsIOS(ios);

        // Only display if mobile device or small screen
        if (android || ios || isMobileScreen) {
            // Delay entrance by 1.8 seconds so it doesn't abruptly pop before page paint
            const timer = setTimeout(() => {
                setIsVisible(true);
            }, 1800);
            return () => clearTimeout(timer);
        }
    }, [settings]);

    const handleDismiss = () => {
        setIsVisible(false);
        try {
            localStorage.setItem(STORAGE_KEY, Date.now().toString());
        } catch {
            // Ignore
        }
    };

    const handleDownload = () => {
        const playUrl = (settings as any)?.playStoreUrl || DEFAULT_PLAY_STORE_URL;
        const iosUrl = (settings as any)?.appStoreUrl || playUrl;

        if (isAndroid) {
            // Try native market:// protocol first to launch Google Play Store app directly
            const marketUrl = `market://details?id=${DEFAULT_PACKAGE_ID}`;
            window.location.href = marketUrl;
            // Fallback timeout in case market:// isn't caught
            setTimeout(() => {
                window.open(playUrl, "_blank", "noopener,noreferrer");
            }, 500);
        } else if (isIOS && (settings as any)?.appStoreUrl) {
            window.open(iosUrl, "_blank", "noopener,noreferrer");
        } else {
            window.open(playUrl, "_blank", "noopener,noreferrer");
        }

        handleDismiss();
    };

    if (!isVisible) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Download VidyaLoans Mobile App"
            className="fixed inset-x-0 bottom-0 z-[9999] p-3 sm:p-4 pointer-events-none animate-in fade-in slide-in-from-bottom duration-500 ease-out"
        >
            <div className="max-w-md mx-auto bg-white/95 backdrop-blur-xl border border-slate-200/90 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] p-4 pointer-events-auto overflow-hidden relative">
                {/* Accent top gradient line */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500" />

                {/* Close Button */}
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="Close download app popup"
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
                >
                    <span className="material-symbols-outlined text-sm font-bold">close</span>
                </button>

                <div className="flex items-start gap-3.5 pr-6">
                    {/* App Icon */}
                    <div className="w-13 h-13 rounded-xl bg-gradient-to-br from-purple-700 to-indigo-900 p-2 flex items-center justify-center shrink-0 shadow-md shadow-purple-900/20 border border-white/20">
                        <img
                            src={settings?.appIconUrl || "/images/icon.png"}
                            alt="VidyaLoans App"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                (e.target as HTMLImageElement).src = "/favicon.ico";
                            }}
                        />
                    </div>

                    {/* App Meta & Rating */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">VidyaLoans: Overseas Loans</span>
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 text-[9.5px] font-bold shrink-0 border border-emerald-200">
                                <span className="material-symbols-outlined text-[11px]">verified</span>
                                Official
                            </span>
                        </div>

                        {/* Ratings & Downloads */}
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-medium">
                            <span className="flex items-center gap-0.5 font-bold text-amber-500">
                                <span>4.8</span>
                                <span className="material-symbols-outlined text-[13px] fill-current">star</span>
                            </span>
                            <span>•</span>
                            <span>50K+ Downloads</span>
                            <span>•</span>
                            <span className="text-emerald-600 font-semibold">Free</span>
                        </div>

                        <p className="text-[11.5px] text-slate-600 mt-1 leading-snug">
                            Get instant sanction, compare 15+ banks &amp; track your education loan on your phone.
                        </p>
                    </div>
                </div>

                {/* Call to Action Buttons */}
                <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="flex-1 py-2 px-3 text-center text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                    >
                        Continue in Browser
                    </button>

                    <button
                        type="button"
                        onClick={handleDownload}
                        className="flex-1 py-2 px-3.5 bg-gradient-to-r from-[#6605c7] to-[#4f46e5] hover:from-[#5504a7] hover:to-[#4338ca] text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                    >
                        {isIOS ? (
                            <>
                                <span className="material-symbols-outlined text-sm">download</span>
                                <span>App Store</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-3.5 h-3.5 fill-current shrink-0" viewBox="0 0 24 24">
                                    <path d="M3.609 1.814L13.792 12 3.61 22.186a2.408 2.408 0 0 1-.365-1.3V3.114c0-.495.132-.95.364-1.3zm1.468-.838L16.273 7.27l-2.481 2.481-8.715-8.775zm0 22.048l8.715-8.775 2.481 2.481-11.196 6.294zm12.355-10.428l2.673 1.503a1.767 1.767 0 0 1 0 3.076l-2.673 1.503-2.75-2.75 2.75-2.332z" />
                                </svg>
                                <span>Install App</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
