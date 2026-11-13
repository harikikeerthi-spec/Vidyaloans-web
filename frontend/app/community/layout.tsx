import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LoginWall from "@/components/LoginWall";
import ProfileGate from "@/components/ProfileGate";

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen relative overflow-x-hidden">
            <Navbar />
            <main className="relative z-10">
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
