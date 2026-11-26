import type { Metadata } from "next";

export const metadata: Metadata = {
    title: {
        absolute: "Student Onboarding | VidyaLoans",
    },
    description: "Complete your onboarding profile to get matched with top study abroad education loan lenders.",
    alternates: {
        canonical: "https://vidyaloans.in/onboarding",
    },
    openGraph: {
        title: "Student Onboarding | VidyaLoans",
        description: "Complete your onboarding profile to get matched with top study abroad education loan lenders.",
        url: "https://vidyaloans.in/onboarding",
        siteName: "VidyaLoans",
        type: "website",
        images: [
            {
                url: "https://vidyaloans.in/images/og-image.png",
                width: 1200,
                height: 630,
                alt: "VidyaLoans Student Onboarding",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Student Onboarding | VidyaLoans",
        description: "Complete your onboarding profile to get matched with top study abroad education loan lenders.",
        images: ["https://vidyaloans.in/images/og-image.png"],
    },
};

export default function OnboardingRouteLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
