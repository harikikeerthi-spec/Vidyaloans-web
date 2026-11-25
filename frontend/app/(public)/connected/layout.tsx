import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Connected Ecosystem & Banking Network",
    description: "Explore VidyaLoans connected ecosystem linking students, universities, and leading lending partners for transparent abroad education finance.",
    alternates: {
        canonical: "/connected",
    },
    openGraph: {
        title: "Connected Ecosystem & Banking Network | VidyaLoans",
        description: "Explore VidyaLoans connected ecosystem linking students, universities, and leading lending partners.",
        url: "https://vidyaloans.in/connected",
        images: [
            {
                url: "/images/og-image.png",
                width: 1200,
                height: 630,
                alt: "VidyaLoans Connected Network",
            },
        ],
    },
};

export default function ConnectedLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
