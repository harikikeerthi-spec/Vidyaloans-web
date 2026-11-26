import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import LoginWall from "@/components/LoginWall";
import ProfileGate from "@/components/ProfileGate";

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

const GRADRIGHT_ONBOARDING =
    "https://app.gradright.com/onboarding-flow?utm_source=Web&utm_source=Web&utm_source=Web&utm_medium=/&utm_medium=/&utm_medium=/&_gl=1*16ycscw*_gcl_au*MTY3NzM0MjQ0NC4xNzcxODI1MjM1*_ga*MTIwOTMyNzM3NS4xNzcxODI1MTk0*_ga_EYTYT4HGR8*czE3NzE4MjM3NTUkbzMwJGcxJHQxNzcxODI1MjUxJGo2MCRsMCRoMA..&_ga=2.72188819.1002705351.1771823755-193882490.1768800242";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen text-gray-900 bg-transparent relative overflow-x-hidden">
            <Navbar />

            <ProfileGate>
                <LoginWall>
                    {/* Small reference/banner for onboarding resources (static and external) */}
                    <div className="w-full bg-white/60 backdrop-blur-sm py-4">
                        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                            </div>
                        </div>
                    </div>

                    <main id="main-content" tabIndex={-1} className="relative z-10 focus:outline-none">{children}</main>
                </LoginWall>
            </ProfileGate>
        </div>
    );
}
