import type { Metadata } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans, Noto_Serif } from "next/font/google";
import "@phosphor-icons/web/regular";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SiteSettingsProvider } from "@/contexts/SiteSettingsContext";
import { UniversityProvider } from "@/context/UniversityContext";
import { DialogProvider } from "@/contexts/DialogContext";
import SelectedUniversityWidget from "@/components/SelectedUniversityWidget";
import ReferralTracker from "@/components/ReferralTracker";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import MobileAppDownloadBanner from "@/components/MobileAppDownloadBanner";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  variable: "--font-noto-serif",
  display: "swap",
  weight: ["400", "600", "700"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.vidyaloans.in";

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
  alternates: {
    canonical: "./",
  },
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
    <html lang="en" className={`${plusJakartaSans.variable} ${notoSerif.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" href="/icon.png" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <meta name="google-play-app" content="app-id=in.vidyaloans.app" />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
        <link
          rel="stylesheet"
          type="text/css"
          href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css"
        />
        {/* PDF.js for EVV Test Agent */}
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== "undefined" && window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
              }
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
                    consent: { necessary: true, preferences: true, statistics: true, marketing: true },
                    consented: true,
                    declined: false,
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
      <body className="min-h-screen transition-colors duration-500 overflow-x-hidden bg-white">
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
              backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCSQJcRexkqlKu3kzwZCWIGdx9mSdhvK4Je6lxA9kVrWHQFg-ShCu6j3XLipgBh0waP45VYm3rBVD2Psy-FTMp2qLU946EXQwD2sIGZJLe5tw2ugWPYnnOTMWoTGM95X4u1epiDmYaEV_vVdH7tyv2ZlDuFjSMZlzWulHW3UyesMipUWi30MryHEiz-_Lje83ApXK-FpMUQdIEWe0M_ZFfiu3BcH1_opus8b5qOTiMh8tMBAX7ifzSLR_qpWnWtdB8obUzknDxLtfeP")',
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
