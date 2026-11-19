"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CookieConsentBanner() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        // Check if user has already answered the cookie consent
        const hasAnswered = document.cookie.includes("cookie_consent_answered=true");
        if (hasAnswered) return;

        const isMobile = window.matchMedia("(max-width: 767px)").matches;
        let appPopupSeen = false;
        try {
            appPopupSeen = !!sessionStorage.getItem("vidyaloans_app_popup_seen");
        } catch {
            // Ignore storage errors
        }

        if (isMobile && !appPopupSeen) {
            // On mobile, show after app popup is dismissed or resolved so they never overlap
            const handleResolved = () => {
                setTimeout(() => setIsVisible(true), 600);
            };
            window.addEventListener("vidya_app_popup_resolved", handleResolved, { once: true });
            return () => window.removeEventListener("vidya_app_popup_resolved", handleResolved);
        } else {
            // Desktop or app popup already handled, display slim banner shortly after load
            const timer = setTimeout(() => setIsVisible(true), 800);
            return () => clearTimeout(timer);
        }
    }, []);

    const markConsentResolved = () => {
        setIsVisible(false);
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("vidya_cookie_consent_settled"));
        }
    };

    const acceptAll = () => {
        const prefs = { essential: true, analytical: true, marketing: true };
        localStorage.setItem('cookie-preferences', JSON.stringify(prefs));
        
        document.cookie = "cookie_consent_answered=true; max-age=31536000; path=/";
        document.cookie = "visitor_analytics_id=active; max-age=63072000; path=/";
        document.cookie = "marketing_funnel_state=active; max-age=31536000; path=/";

        if (typeof window !== "undefined" && (window as any).gtag) {
            (window as any).gtag('consent', 'update', {
                analytics_storage: 'granted',
                ad_storage: 'granted',
                ad_user_data: 'granted',
                ad_personalization: 'granted'
            });
        }
        
        markConsentResolved();
    };

    const rejectAll = () => {
        const prefs = { essential: true, analytical: false, marketing: false };
        localStorage.setItem('cookie-preferences', JSON.stringify(prefs));
        
        document.cookie = "cookie_consent_answered=true; max-age=31536000; path=/";
        document.cookie = "visitor_analytics_id=; max-age=0; path=/";
        document.cookie = "marketing_funnel_state=; max-age=0; path=/";

        if (typeof window !== "undefined" && (window as any).gtag) {
            (window as any).gtag('consent', 'update', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied'
            });
        }
        
        markConsentResolved();
    };

    if (!isVisible) return null;

    return (
        <aside
            role="region"
            aria-label="Cookie consent banner"
            className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-purple-100 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] py-3 px-4 sm:px-6 transition-all animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
        >
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-center sm:text-left">
                    <span className="material-symbols-outlined text-[#6605c7] text-xl shrink-0 hidden sm:inline-block" aria-hidden="true">cookie</span>
                    <p className="text-[13px] text-gray-700 font-medium leading-snug">
                        We use cookies to personalize your experience and analyze traffic in accordance with DPDP regulations. Manage your choices or accept all cookies below. Read our{" "}
                        <Link href="/cookies" className="text-[#6605c7] font-bold hover:underline">
                            Cookie Policy
                        </Link>.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <Link
                        href="/cookies"
                        onClick={markConsentResolved}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl border border-gray-300 text-gray-700 font-bold text-[12px] uppercase tracking-wider hover:bg-gray-50 transition-colors inline-flex items-center justify-center text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6605c7]"
                    >
                        Customize
                    </Link>
                    <button
                        type="button"
                        onClick={rejectAll}
                        className="min-h-[44px] px-4 py-2 rounded-xl border border-gray-300 text-gray-800 font-bold text-[12px] uppercase tracking-wider hover:bg-gray-100 transition-colors cursor-pointer inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6605c7]"
                    >
                        Reject All
                    </button>
                    <button
                        type="button"
                        onClick={acceptAll}
                        className="min-h-[44px] px-4 py-2 rounded-xl bg-[#6605c7] text-white font-bold text-[12px] uppercase tracking-wider hover:bg-[#8b24e5] transition-colors shadow-sm cursor-pointer inline-flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6605c7]"
                    >
                        Accept All
                    </button>
                </div>
            </div>
        </aside>
    );
}
