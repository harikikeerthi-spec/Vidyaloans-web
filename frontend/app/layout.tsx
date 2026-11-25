import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SiteSettingsProvider } from "@/contexts/SiteSettingsContext";
import { UniversityProvider } from "@/context/UniversityContext";
import { DialogProvider } from "@/contexts/DialogContext";
import SelectedUniversityWidget from "@/components/SelectedUniversityWidget";
import ReferralTracker from "@/components/ReferralTracker";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import MobileAppDownloadBanner from "@/components/MobileAppDownloadBanner";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://vidyaloans.in").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "VidyaLoans - Fund Your Dream Education Abroad",
    template: "%s | VidyaLoans",
  },
  description:
    "Compare education loans from our curated network of top lending partners. Get the best rates, quick approvals, and expert guidance — all in one place.",
  keywords: [
    "education loan",
    "study abroad",
    "student loan India",
    "loan comparison",
    "overseas education",
    "abroad education loan",
    "collateral free education loan",
  ],
  openGraph: {
    title: "VidyaLoans - Fund Your Dream Education Abroad",
    description:
      "Compare education loans from our curated network of top lending partners. Get the best rates, quick approvals, and expert guidance.",
    url: siteUrl,
    siteName: "VidyaLoans",
    locale: "en_IN",
    type: "website",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "VidyaLoans - Fund Your Dream Education Abroad",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VidyaLoans - Fund Your Dream Education Abroad",
    description:
      "Compare education loans from our curated network of top lending partners. Get the best rates, quick approvals, and expert guidance.",
    images: ["/images/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/icon.png",
  },
};

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-PSHKZ8FK";
const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-1Z8RYR9RBW";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/icon.png" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <meta name="google-play-app" content="app-id=in.vidyaloans.app" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,400&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&display=swap"
        />
        {/* DPDP / GDPR Google Consent Mode v2 Initialization (Prior-Consent Default) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              (function() {
                var stored = null;
                try {
                  var raw = localStorage.getItem('cookie-preferences');
                  if (raw) stored = JSON.parse(raw);
                } catch(e) {}
                var analyticsGranted = stored && stored.analytical ? 'granted' : 'denied';
                var marketingGranted = stored && stored.marketing ? 'granted' : 'denied';
                gtag('consent', 'default', {
                  'analytics_storage': analyticsGranted,
                  'ad_storage': marketingGranted,
                  'ad_user_data': marketingGranted,
                  'ad_personalization': marketingGranted,
                  'wait_for_update': 500
                });
              })();
            `,
          }}
        />
        {/* Suppress unauthorized Cookiebot injection from external GTM container (native CookieConsentBanner is used) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === "undefined") return;
                try {
                  window.Cookiebot = window.Cookiebot || {
                    consent: { necessary: true, preferences: false, statistics: false, marketing: false },
                    consented: false,
                    declined: true,
                    hasResponse: true,
                    show: function() {},
                    hide: function() {},
                    renew: function() {},
                    getScript: function() {}
                  };
                  var origCreate = document.createElement.bind(document);
                  document.createElement = function(tagName, options) {
                    var el = origCreate(tagName, options);
                    if (tagName && String(tagName).toLowerCase() === "script") {
                      var origSetAttribute = el.setAttribute.bind(el);
                      el.setAttribute = function(name, val) {
                        if (name === "src" && typeof val === "string" && val.indexOf("cookiebot.com") !== -1) {
                          return;
                        }
                        return origSetAttribute(name, val);
                      };
                      var origSrcDesc = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src");
                      if (origSrcDesc && origSrcDesc.set) {
                        Object.defineProperty(el, "src", {
                          set: function(val) {
                            if (typeof val === "string" && val.indexOf("cookiebot.com") !== -1) {
                              return;
                            }
                            origSrcDesc.set.call(this, val);
                          },
                          get: function() {
                            return origSrcDesc.get.call(this);
                          },
                          configurable: true
                        });
                      }
                    }
                    return el;
                  };
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen transition-colors duration-500 overflow-x-clip bg-white">
        {/* Google Tag Manager (Head / Interactive Script) */}
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
          }}
        />

        {/* Google tag (gtag.js) */}
        <Script
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        />
        <Script
          id="google-tag-gtag"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `,
          }}
        />

        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* Background Structure exactly like index.html - No Dark Mode */}
        <div className="fixed inset-0 z-0 bg-white pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(at_0%_0%,rgba(102,5,199,0.4)_0px,transparent_50%),radial-gradient(at_100%_0%,rgba(224,195,137,0.5)_0px,transparent_50%),radial-gradient(at_100%_100%,rgba(139,192,232,0.4)_0px,transparent_50%),radial-gradient(at_0%_100%,rgba(102,5,199,0.3)_0px,transparent_50%)] opacity-90"></div>
          <div
            className="absolute inset-0 opacity-30 mix-blend-overlay"
            style={{
              backgroundImage: 'url("/images/bg-noise-overlay.png")',
              backgroundSize: 'cover'
            }}
          ></div>
        </div>

        <div className="relative z-10">
          <SiteSettingsProvider>
            <AuthProvider>
              <DialogProvider>
                <ReferralTracker />
                <UniversityProvider>
                  {children}
                  <SelectedUniversityWidget />
                  <CookieConsentBanner />
                  <MobileAppDownloadBanner />
                </UniversityProvider>
              </DialogProvider>
            </AuthProvider>
          </SiteSettingsProvider>
        </div>
      </body>
    </html>
  );
}
