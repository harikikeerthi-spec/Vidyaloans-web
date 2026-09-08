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
  supportEmail: "support@vidyaloans.com",
  contactEmail: "contact@vidyaloans.com",
  phone: "+91 8143797779",
  tollFree: "1800-123-4567",
  address: "VidyaLoans Financial Tower, Sector 44, Gurgaon, Haryana 122003, India",
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
  customHeadScripts: `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PSHKZ8FK');</script>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1Z8RYR9RBW"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-1Z8RYR9RBW');
</script>`,
  customBodyScripts: "",

  // Mobile App Download Banner defaults
  playStoreUrl: "https://play.google.com/store/apps/details?id=in.vidyaloans.app",
  appStoreUrl: "",
  enableAppBanner: true,
};

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
  const [settings, setSettings] = useState<PublicSiteSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(STORAGE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          return { ...DEFAULT_PUBLIC_SETTINGS, ...parsed };
        }
      } catch (e) {
        // ignore cache parse error
      }
    }
    return DEFAULT_PUBLIC_SETTINGS;
  });

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

      // 2. Dynamic Document Title (if metaTitle or siteName is provided)
      if (data.metaTitle) {
        document.title = data.metaTitle;
      } else if (data.siteName) {
        document.title = `${data.siteName}${data.tagline ? ` - ${data.tagline}` : ""}`;
      }

      // 3. Dynamic Meta Description & OG Tags
      if (data.metaDescription) {
        let metaDesc = document.querySelector("meta[name='description']");
        if (!metaDesc) {
          metaDesc = document.createElement("meta");
          metaDesc.setAttribute("name", "description");
          document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute("content", data.metaDescription);

        let ogDesc = document.querySelector("meta[property='og:description']");
        if (!ogDesc) {
          ogDesc = document.createElement("meta");
          ogDesc.setAttribute("property", "og:description");
          document.head.appendChild(ogDesc);
        }
        ogDesc.setAttribute("content", data.metaDescription);
      }

      if (data.siteName || data.metaTitle) {
        let ogTitle = document.querySelector("meta[property='og:title']");
        if (!ogTitle) {
          ogTitle = document.createElement("meta");
          ogTitle.setAttribute("property", "og:title");
          document.head.appendChild(ogTitle);
        }
        ogTitle.setAttribute("content", data.metaTitle || data.siteName);
      }

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
        const merged: PublicSiteSettings = {
          ...DEFAULT_PUBLIC_SETTINGS,
          ...res.data,
        };
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
      const merged: PublicSiteSettings = {
        ...settings,
        ...newSettings,
      };
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
    // Initial fetch on mount
    fetchSettings();

    // Initialize BroadcastChannel for cross-tab instantaneous sync
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        const channel = new BroadcastChannel("site_settings_sync");
        channel.onmessage = (event) => {
          if (event?.data?.data) {
            const merged: PublicSiteSettings = {
              ...DEFAULT_PUBLIC_SETTINGS,
              ...event.data.data,
            };
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
        const merged: PublicSiteSettings = {
          ...DEFAULT_PUBLIC_SETTINGS,
          ...event.detail,
        };
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
          const merged: PublicSiteSettings = {
            ...DEFAULT_PUBLIC_SETTINGS,
            ...parsed,
          };
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

