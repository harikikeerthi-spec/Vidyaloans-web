import type { Metadata } from "next";

export const metadata: Metadata = {
    title: {
        absolute: "Community Discussions & Peer Forum | VidyaLoans",
    },
    description: "Join discussions with mentors and fellow students on study abroad education loans, admissions, visas, and scholarships.",
    alternates: {
        canonical: "https://vidyaloans.in/community/discussions",
    },
    openGraph: {
        title: "Community Discussions & Peer Forum | VidyaLoans",
        description: "Join discussions with mentors and fellow students on study abroad education loans, admissions, visas, and scholarships.",
        url: "https://vidyaloans.in/community/discussions",
        siteName: "VidyaLoans",
        type: "website",
        images: [
            {
                url: "https://vidyaloans.in/images/og-image.png",
                width: 1200,
                height: 630,
                alt: "VidyaLoans Community Discussions",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Community Discussions & Peer Forum | VidyaLoans",
        description: "Join discussions with mentors and fellow students on study abroad education loans, admissions, visas, and scholarships.",
        images: ["https://vidyaloans.in/images/og-image.png"],
    },
};

export default function DiscussionsLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
