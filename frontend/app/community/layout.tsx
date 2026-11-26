import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LoginWall from "@/components/LoginWall";
import ProfileGate from "@/components/ProfileGate";

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen relative overflow-x-hidden">
            <Navbar />
            <main id="main-content" tabIndex={-1} className="relative z-10 focus:outline-none">
                <ProfileGate>
                    <LoginWall>
                        {children}
                    </LoginWall>
                </ProfileGate>
            </main>
            <Footer />
        </div>
    );
}
