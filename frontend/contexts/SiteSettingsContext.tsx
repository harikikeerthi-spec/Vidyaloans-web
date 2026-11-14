"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { siteSettingsApi } from "@/lib/api";

export interface PublicSiteSettings {
  siteName: string;
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  supportEmail: string;
  contactEmail: string;
  phone: string;
  tollFree: string;
  address: string;
  currency: string;
  timezone: string;
  copyrightText: string;

  // Social Links
  facebookUrl: string;
  instagramUrl: string;
  twitterUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
  whatsappNumber: string;
  telegramUrl: string;

  // Branding Assets
  logoLightUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
  appIconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  darkThemeBg: string;
  customCss: string;

  // Tracking & Analytics
  googleAnalyticsId: string;
  googleTagManagerId: string;
  facebookPixelId: string;
  customHeadScripts: string;
  customBodyScripts: string;

  // Mobile App Download Banner
  playStoreUrl?: string;
  appStoreUrl?: string;
  enableAppBanner?: boolean;
}

export const DEFAULT_PUBLIC_SETTINGS: PublicSiteSettings = {
  siteName: "VidyaLoans",
  tagline: "Overseas Education Financing & Study Abroad Loan Portal",
  metaTitle: "VidyaLoans - Instant Education Loans for Overseas Studies",
  metaDescription:
    "Compare and apply for top education loans with lowest interest rates, quick approval, and zero hidden charges.",
  supportEmail: "support@vidyaloans.in",
  contactEmail: "contact@vidyaloans.in",
  phone: "+91 81437 97779",
  tollFree: "+91 81437 97779",
  address: "Jyothi Bose Complex, Bus Stand Road (Opposite to Municipal Office), Nuzvid, Krishna District, Andhra Pradesh 521201, India",
  currency: "INR",
  timezone: "Asia/Kolkata",
  copyrightText: `© ${new Date().getFullYear()} VidyaLoans Inc. All rights reserved.`,

  facebookUrl: "https://facebook.com/vidyaloans",
  instagramUrl: "https://www.instagram.com/vidya_loans/",
  twitterUrl: "https://x.com/VidyaLoans07",
  linkedinUrl: "https://www.linkedin.com/company/vidyaloans/",
  youtubeUrl: "https://youtube.com/@vidyaloans",
  whatsappNumber: "+918143797779",
  telegramUrl: "https://t.me/vidyaloans",

  logoLightUrl: "/images/vidyaloans-logo-transparent.png",
  logoDarkUrl: "/images/vidyaloans-logo-transparent.png",
  faviconUrl: "/favicon.ico",
  appIconUrl: "/images/icon.png",
  primaryColor: "#6605c7",
  secondaryColor: "#4f46e5",
  darkThemeBg: "#0f172a",
  customCss: "",

  googleAnalyticsId: "G-1Z8RYR9RBW",
  googleTagManagerId: "GTM-PSHKZ8FK",
  facebookPixelId: "",
  customHeadScripts: "",
  customBodyScripts: "",

  // Mobile App Download Banner defaults
  playStoreUrl: "https://play.google.com/store/apps/details?id=in.vidyaloans.app",
  appStoreUrl: "",
  enableAppBanner: false,
};

export function mergeValidPublicSettings(
  base: PublicSiteSettings,
  incoming?: Partial<PublicSiteSettings> | null
): PublicSiteSettings {
  if (!incoming || typeof incoming !== "object") return base;
  const merged: PublicSiteSettings = { ...base };

  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null) continue;

    if (typeof value === "string") {
      const trimmed = value.trim();
      // Stop empty strings from overwriting valid default identity/contact values
      if (!trimmed) {
        if (["phone", "tollFree", "supportEmail", "contactEmail", "address", "whatsappNumber", "siteName"].includes(key)) {
          continue;
        }
      }

      // Filter out known placeholder values
      if (key === "phone" && (trimmed.includes("1800-123-4567") || trimmed.includes("94945 68851"))) continue;
      if (key === "tollFree" && (trimmed.includes("1800-123-4567") || trimmed.includes("9494568851"))) continue;
      if ((key === "supportEmail" || key === "contactEmail") && trimmed.includes("@vidyaloans.com")) continue;
      if (key === "whatsappNumber" && trimmed.includes("9876543210")) continue;
      if (key === "address" && (trimmed.includes("Sector 44") || trimmed.includes("Gurgaon"))) continue;
      if (key === "instagramUrl" && (trimmed === "https://instagram.com/vidyaloans" || trimmed === "https://instagram.com/" || trimmed === "https://instagram.com")) continue;
      if (key === "twitterUrl" && (trimmed === "https://x.com/vidyaloans" || trimmed === "https://twitter.com/vidyaloans")) continue;
    }

    if (key === "enableAppBanner") {
      merged.enableAppBanner = false;
      continue;
    }

    (merged as any)[key] = value;
  }

  merged.enableAppBanner = false;
  return merged;
}

const STORAGE_KEY = "vidyaloans_site_settings";

interface SiteSettingsContextValue {
  settings: PublicSiteSettings;
  loading: boolean;
  refetch: () => Promise<void>;
  updateLocally: (newSettings: Partial<PublicSiteSettings>) => void;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  settings: DEFAULT_PUBLIC_SETTINGS,
  loading: false,
  refetch: async () => {},
  updateLocally: () => {},
});

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PublicSiteSettings>(DEFAULT_PUBLIC_SETTINGS);
  const [loading, setLoading] = useState(true);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const applyDomChanges = useCallback((data: PublicSiteSettings) => {
    if (typeof document === "undefined") return;

    try {
      // 1. Dynamic CSS Variables on :root
      const root = document.documentElement;
      if (data.primaryColor) {
        root.style.setProperty("--color-primary", data.primaryColor);
        root.style.setProperty("--brand-primary", data.primaryColor);
      }
      if (data.secondaryColor) {
        root.style.setProperty("--color-indigo", data.secondaryColor);
        root.style.setProperty("--brand-secondary", data.secondaryColor);
      }
      if (data.darkThemeBg) {
        root.style.setProperty("--dark-theme-bg", data.darkThemeBg);
      }

      // Note: Page title, meta description, and OpenGraph tags are handled by Next.js
      // server-side metadata on each route to ensure SEO optimization per page.
      // Do not overwrite them client-side across all routes.

      // 4. Dynamic Custom CSS Injection
      let styleTag = document.getElementById("dynamic-site-custom-css") as HTMLStyleElement | null;
      if (data.customCss && data.customCss.trim()) {
        if (!styleTag) {
          styleTag = document.createElement("style");
          styleTag.id = "dynamic-site-custom-css";
          document.head.appendChild(styleTag);
        }
        styleTag.textContent = data.customCss;
      } else if (styleTag) {
        styleTag.remove();
      }

      // 5. Dynamic Favicon & Apple Touch Icon
      if (data.faviconUrl) {
        let linkTag = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
        if (!linkTag) {
          linkTag = document.createElement("link");
          linkTag.rel = "icon";
          document.head.appendChild(linkTag);
        }
        linkTag.href = data.faviconUrl;
      }

      if (data.appIconUrl || data.faviconUrl) {
        let appleIconTag = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
        if (!appleIconTag) {
          appleIconTag = document.createElement("link");
          appleIconTag.rel = "apple-touch-icon";
          document.head.appendChild(appleIconTag);
        }
        appleIconTag.href = data.appIconUrl || data.faviconUrl;
      }

      // 6. Dynamic Custom Head Scripts
      if (data.customHeadScripts && data.customHeadScripts.trim()) {
        let headScriptContainer = document.getElementById("dynamic-site-head-scripts");
        if (!headScriptContainer) {
          headScriptContainer = document.createElement("div");
          headScriptContainer.id = "dynamic-site-head-scripts";
          document.head.appendChild(headScriptContainer);
        }
        if (headScriptContainer.dataset.content !== data.customHeadScripts) {
          headScriptContainer.dataset.content = data.customHeadScripts;
          headScriptContainer.innerHTML = data.customHeadScripts;
          const scripts = headScriptContainer.querySelectorAll("script");
          scripts.forEach((oldScript) => {
            const newScript = document.createElement("script");
            Array.from(oldScript.attributes).forEach((attr) => {
              newScript.setAttribute(attr.name, attr.value);
            });
            newScript.textContent = oldScript.textContent;
            oldScript.parentNode?.replaceChild(newScript, oldScript);
          });
        }
      }

      // Cache locally for instant next page renders
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn("Error applying DOM settings:", e);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await siteSettingsApi.getPublicSettings();
      if (res && res.data) {
        const merged = mergeValidPublicSettings(DEFAULT_PUBLIC_SETTINGS, res.data);
        setSettings(merged);
        applyDomChanges(merged);
      }
    } catch (err) {
      console.warn("Failed to fetch public site settings, using cached/defaults:", err);
    } finally {
      setLoading(false);
    }
  }, [applyDomChanges]);

  const updateLocally = useCallback(
    (newSettings: Partial<PublicSiteSettings>) => {
      const merged = mergeValidPublicSettings(settings, newSettings);
      setSettings(merged);
      applyDomChanges(merged);

      // Broadcast to other tabs
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("site-settings-updated", { detail: merged }));
        broadcastChannelRef.current?.postMessage({ type: "SETTINGS_UPDATED", data: merged });
      }
    },
    [settings, applyDomChanges]
  );

  useEffect(() => {
    // 1. Immediately hydrate cached settings from localStorage post-mount
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const merged = mergeValidPublicSettings(DEFAULT_PUBLIC_SETTINGS, parsed);
        setSettings(merged);
        applyDomChanges(merged);
      }
    } catch (e) {
      // ignore
    }

    // 2. Fetch fresh settings on mount
    fetchSettings();

    // Initialize BroadcastChannel for cross-tab instantaneous sync
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        const channel = new BroadcastChannel("site_settings_sync");
        channel.onmessage = (event) => {
          if (event?.data?.data) {
            const merged = mergeValidPublicSettings(DEFAULT_PUBLIC_SETTINGS, event.data.data);
            setSettings(merged);
            applyDomChanges(merged);
          }
        };
        broadcastChannelRef.current = channel;
      } catch (e) {
        // fallback
      }
    }

    // 1. Same-window custom event
    const handleSettingsUpdated = (event: any) => {
      if (event?.detail) {
        const merged = mergeValidPublicSettings(DEFAULT_PUBLIC_SETTINGS, event.detail);
        setSettings(merged);
        applyDomChanges(merged);
      } else {
        fetchSettings();
      }
    };

    // 2. Storage event (fires across other tabs when localStorage is modified)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          const merged = mergeValidPublicSettings(DEFAULT_PUBLIC_SETTINGS, parsed);
          setSettings(merged);
          applyDomChanges(merged);
        } catch (e) {
          // ignore
        }
      }
    };

    // 3. Tab Visibility change (refresh on tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchSettings();
      }
    };

    window.addEventListener("site-settings-updated", handleSettingsUpdated);
    window.addEventListener("storage", handleStorageChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("site-settings-updated", handleSettingsUpdated);
      window.removeEventListener("storage", handleStorageChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      broadcastChannelRef.current?.close();
    };
  }, [fetchSettings, applyDomChanges]);

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, refetch: fetchSettings, updateLocally }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const context = useContext(SiteSettingsContext);
  return (
    context || {
      settings: DEFAULT_PUBLIC_SETTINGS,
      loading: false,
      refetch: async () => {},
      updateLocally: () => {},
    }
  );
}

