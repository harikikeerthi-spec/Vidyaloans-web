import Navbar from "@/components/Navbar";
import LoginWall from "@/components/LoginWall";
import ProfileGate from "@/components/ProfileGate";

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

                    <main className="relative z-10">{children}</main>
                </LoginWall>
            </ProfileGate>
        </div>
    );
}
