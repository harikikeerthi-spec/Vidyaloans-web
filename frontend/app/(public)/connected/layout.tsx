import type { Metadata } from "next";

export const metadata: Metadata = {
    title: {
        absolute: "Connected Ecosystem & Banking Network | VidyaLoans",
    },
    description: "Explore VidyaLoans connected ecosystem linking students, universities, and leading lending partners for transparent abroad education finance.",
    alternates: {
        canonical: "https://vidyaloans.in/connected",
    },
    openGraph: {
        title: "Connected Ecosystem & Banking Network | VidyaLoans",
        description: "Explore VidyaLoans connected ecosystem linking students, universities, and leading lending partners.",
        url: "https://vidyaloans.in/connected",
        siteName: "VidyaLoans",
        type: "website",
        images: [
            {
                url: "https://vidyaloans.in/images/og-image.png",
                width: 1200,
                height: 630,
                alt: "VidyaLoans Connected Network",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Connected Ecosystem & Banking Network | VidyaLoans",
        description: "Explore VidyaLoans connected ecosystem linking students, universities, and leading lending partners.",
        images: ["https://vidyaloans.in/images/og-image.png"],
    },
};

export default function ConnectedLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
