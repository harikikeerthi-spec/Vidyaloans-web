
import LoginWall from "@/components/LoginWall";
import ProfileGate from "@/components/ProfileGate";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function UniversityLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen bg-transparent">
            {/* Navbar and Footer are hidden to use the custom integrated ones in the university page */}
            <main className="relative z-10">
                <ProfileGate>
                    <LoginWall>
                        {children}
                    </LoginWall>
                </ProfileGate>
            </main>
        </div>
    );
}
