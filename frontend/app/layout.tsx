import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { SiteSettingsProvider } from "@/contexts/SiteSettingsContext";
import { UniversityProvider } from "@/context/UniversityContext";
import { DialogProvider } from "@/contexts/DialogContext";
import SelectedUniversityWidget from "@/components/SelectedUniversityWidget";
import ReferralTracker from "@/components/ReferralTracker";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import ProfileGate from "@/components/ProfileGate";

export const metadata: Metadata = {
  title: {
    default: "Vidya Loans - Fund Your Dream Education Abroad",
    template: "%s | Vidya Loans",
  },
  description:
    "Compare education loans from our curated network of top lending partners. Get the best rates, quick approvals, and expert guidance — all in one place.",
  keywords: [
    "education loan",
    "study abroad",
    "student loan India",
    "loan comparison",
    "overseas education",
  ],
  openGraph: {
    title: "Vidya Loans - Fund Your Dream Education Abroad",
    description:
      "Compare education loans from our curated network of top lending partners. Get the best rates, quick approvals, and expert guidance.",
    type: "website",
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
        {/* Google Tag Manager (Head Script) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
          }}
        />
        {/* Google tag (gtag.js) GA4 */}
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}');
            `,
          }}
        />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,100..900;1,100..900&family=Noto+Sans:ital,wght@0,100..900;1,100..900&family=Plus+Jakarta+Sans:wght@200..800&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=clash-display@200,300,400,500,600,700&f[]=cabinet-grotesk@100,200,300,400,500,700,800&f[]=satoshi@300,400,500,700,900,300italic,400italic,500italic,700italic,900italic&f[]=satoshi-mono@300,400,500,700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&family=JetBrains+Mono:ital,wght@0,100..800;1,100..800&display=swap"
        />
        <link
          rel="stylesheet"
          type="text/css"
          href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/style.css"
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
      </head>
      <body className="min-h-screen transition-colors duration-500 overflow-x-hidden bg-white">
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
                  <ProfileGate>
                    {children}
                    <SelectedUniversityWidget />
                    <CookieConsentBanner />
                  </ProfileGate>
                </UniversityProvider>
              </DialogProvider>
            </AuthProvider>
          </SiteSettingsProvider>
        </div>
      </body>
    </html>
  );
}
