"use client";

import { useState, useEffect } from "react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

const STORAGE_KEY = "vidyaloans_playstore_popup_dismissed";
const COOLDOWN_DAYS = 7;
const DEFAULT_PACKAGE_ID = "in.vidyaloans.app";
const DEFAULT_PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=in.vidyaloans.app&hl=en-US&ah=Vx9t8taW0pweH2uHyGVMktR2FLs`;

function GooglePlayLogo({ className = "w-4 h-4" }: { className?: string }) {
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
    const [isIOS, setIsIOS] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [installProgress, setInstallProgress] = useState(0);

    useEffect(() => {
        if (typeof window === "undefined") return;

        // Check if admin disabled the mobile app banner
        if (settings && (settings as any).enableAppBanner === false) {
            return;
        }

        // Check frequency capping: suppress if user dismissed within last 7 days (bypass in dev mode for testing)
        try {
            const dismissedAt = localStorage.getItem(STORAGE_KEY);
            if (dismissedAt && process.env.NODE_ENV === "production") {
                const diffMs = Date.now() - parseInt(dismissedAt, 10);
                const diffDays = diffMs / (1000 * 60 * 60 * 24);
                if (diffDays < COOLDOWN_DAYS) {
                    return;
                }
            }
        } catch {
            // Ignore localStorage errors
        }

        // Media query check: only mobile screens (< 768px)
        const mobileMediaQuery = window.matchMedia("(max-width: 767px)");

        // Check device type
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";
        const uaLower = ua.toLowerCase();
        const android = uaLower.includes("android");
        const ios = /iphone|ipad|ipod/.test(uaLower) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
        const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(uaLower);

        setIsAndroid(android);
        setIsIOS(ios);

        // Strict check: Must be a mobile device OR match mobile screen media query (< 768px)
        const isMobile = android || ios || isMobileUA || mobileMediaQuery.matches;

        if (!isMobile) {
            // Do not show on desktop / large screens
            setIsVisible(false);
            return;
        }

        // Slide down after brief delay like a real-time push notification
        const timer = setTimeout(() => {
            setIsVisible(true);
            // Gentle haptic vibration on mobile devices if supported
            if (typeof navigator !== "undefined" && "vibrate" in navigator) {
                try {
                    navigator.vibrate([40, 60, 40]);
                } catch {
                    // Ignore haptic errors
                }
            }
        }, 1200);

        // Dynamic listener in case screen is resized or DevTools device mode is toggled
        const handleMediaChange = (e: MediaQueryListEvent) => {
            if (!e.matches && !android && !ios && !isMobileUA) {
                setIsVisible(false);
            }
        };

        if (mobileMediaQuery.addEventListener) {
            mobileMediaQuery.addEventListener("change", handleMediaChange);
        } else {
            mobileMediaQuery.addListener(handleMediaChange);
        }

        return () => {
            clearTimeout(timer);
            if (mobileMediaQuery.removeEventListener) {
                mobileMediaQuery.removeEventListener("change", handleMediaChange);
            } else {
                mobileMediaQuery.removeListener(handleMediaChange);
            }
        };
    }, [settings]);

    const handleDismiss = () => {
        setIsVisible(false);
        try {
            localStorage.setItem(STORAGE_KEY, Date.now().toString());
        } catch {
            // Ignore
        }
    };

    const handleInstall = () => {
        const playUrl = (settings as any)?.playStoreUrl || DEFAULT_PLAY_STORE_URL;
        const iosUrl = (settings as any)?.appStoreUrl || playUrl;

        setIsInstalling(true);

        // Realistic fast downloading progress animation before opening store
        let progress = 15;
        const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 25) + 15;
            if (progress >= 100) {
                progress = 100;
                setInstallProgress(100);
                clearInterval(interval);

                setTimeout(() => {
                    if (isAndroid) {
                        const marketUrl = `market://details?id=${DEFAULT_PACKAGE_ID}`;
                        window.location.href = marketUrl;
                        setTimeout(() => {
                            window.open(playUrl, "_blank", "noopener,noreferrer");
                        }, 500);
                    } else if (isIOS && (settings as any)?.appStoreUrl) {
                        window.open(iosUrl, "_blank", "noopener,noreferrer");
                    } else {
                        window.open(playUrl, "_blank", "noopener,noreferrer");
                    }
                    handleDismiss();
                }, 400);
            } else {
                setInstallProgress(progress);
            }
        }, 120);
    };

    if (!isVisible) return null;

    return (
        <aside
            role="region"
            aria-label="Google Play Store Notification"
            className="md:hidden fixed top-3 inset-x-3 z-[99999] pointer-events-auto transition-all animate-in fade-in slide-in-from-top-8 duration-500 ease-out"
        >
            <div className="bg-[#1f1f23]/95 backdrop-blur-2xl border border-white/10 rounded-[26px] p-3.5 sm:p-4 text-white shadow-[0_16px_40px_rgba(0,0,0,0.45)] ring-1 ring-black/20 overflow-hidden relative">
                {/* Real-time notification header */}
                <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
                        {/* Official Google Play multicolor icon */}
                        <GooglePlayLogo className="w-4 h-4 shrink-0" />
                        <span className="font-semibold text-white tracking-tight">Google Play</span>
                        <span className="text-white/40">•</span>
                        <span className="text-emerald-400 font-medium text-[10.5px]">Recommended</span>
                        <span className="text-white/40">•</span>
                        <span className="text-slate-400 text-[10.5px]">now</span>
                    </div>

                    {/* Notification close button */}
                    <button
                        type="button"
                        onClick={handleDismiss}
                        aria-label="Dismiss notification"
                        className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-xs leading-none">close</span>
                    </button>
                </div>

                {/* App Content Body */}
                <div className="flex items-start gap-3">
                    {/* App Squircle Icon with Google Play Corner Badge */}
                    <div className="relative shrink-0">
                        <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#6605c7] to-[#4338ca] p-2 flex items-center justify-center shadow-lg shadow-purple-950/40 border border-white/15 overflow-hidden">
                            <img
                                src={settings?.appIconUrl || "/icon.png"}
                                alt="VidyaLoans App"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = "/favicon.ico";
                                }}
                            />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#1f1f23] p-0.5 shadow-md flex items-center justify-center border border-white/20">
                            <GooglePlayLogo className="w-3 h-3" />
                        </div>
                    </div>

                    {/* App Titles & Play Store Badges */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h4 className="text-xs font-bold text-white truncate tracking-tight">
                                VidyaLoans: Overseas Loans
                            </h4>
                        </div>

                        <p className="text-[11px] text-slate-300 mt-0.5 leading-tight line-clamp-1">
                            Instant sanction &amp; compare 15+ banks
                        </p>

                        {/* Rating, Size & Play Protect Badge */}
                        <div className="flex items-center gap-2 mt-1.5 text-[10.5px]">
                            <div className="flex items-center gap-0.5 font-bold text-amber-400">
                                <span>4.8</span>
                                <span className="text-[11px]">★</span>
                            </div>
                            <span className="text-white/30">•</span>
                            <span className="text-slate-300">18 MB</span>
                            <span className="text-white/30">•</span>
                            <div className="flex items-center gap-1 text-emerald-400 font-medium">
                                <svg className="w-3 h-3 fill-current shrink-0" viewBox="0 0 24 24">
                                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
                                </svg>
                                <span className="text-[10px]">Play Protect</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Progress bar if installing */}
                {isInstalling && (
                    <div className="mt-3">
                        <div className="flex items-center justify-between text-[10.5px] text-slate-300 mb-1">
                            <span className="text-emerald-400 font-medium animate-pulse">
                                {installProgress < 100 ? "Downloading..." : "Installing..."}
                            </span>
                            <span>{installProgress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-[#01875f] to-[#00c0fd] transition-all duration-150 ease-out"
                                style={{ width: `${installProgress}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Android / Play Store Action Buttons */}
                {!isInstalling && (
                    <div className="mt-3 pt-2.5 border-t border-white/[0.08] flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={handleDismiss}
                            className="px-3.5 py-1.5 rounded-full text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            Not now
                        </button>

                        <button
                            type="button"
                            onClick={handleInstall}
                            className="px-5 py-1.5 rounded-full bg-[#01875f] hover:bg-[#00704e] active:scale-95 text-white text-xs font-semibold shadow-md shadow-[#01875f]/30 flex items-center gap-2 transition-all cursor-pointer"
                        >
                            <GooglePlayLogo className="w-3.5 h-3.5 shrink-0" />
                            <span>Install</span>
                        </button>
                    </div>
                )}
            </div>
        </aside>
    );
}
