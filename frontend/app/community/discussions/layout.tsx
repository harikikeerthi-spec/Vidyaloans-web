import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Community Discussions",
    description: "Join discussions with mentors and fellow students on study abroad education loans, admissions, visas, and scholarships.",
    alternates: {
        canonical: "/community/discussions",
    },
    openGraph: {
        title: "Community Discussions | VidyaLoans",
        description: "Join discussions with mentors and fellow students on study abroad education loans, admissions, visas, and scholarships.",
        url: "https://vidyaloans.in/community/discussions",
        images: [
            {
                url: "/images/og-image.png",
                width: 1200,
                height: 630,
                alt: "VidyaLoans Community Discussions",
            },
        ],
    },
};

export default function DiscussionsLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
