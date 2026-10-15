"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import LoginWall from "@/components/LoginWall";
import { usePathname } from "next/navigation";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isConnectedPage = pathname === "/connected";
    const isWhatsAppSimulatorPage = pathname === "/whatsapp-simulator";
    const isLandingPage = pathname === "/landing";
    const isRegistrationPage = pathname === "/registration";
    const showNavbar = !isConnectedPage && !isLandingPage && !isRegistrationPage;
    const showFooter = !isConnectedPage && !isWhatsAppSimulatorPage && !isRegistrationPage;

    return (
        <div className="min-h-screen text-gray-900 bg-transparent relative overflow-x-hidden">
            {showNavbar && <Navbar />}
            <main className="relative z-10">
                <LoginWall>
                    {children}
                </LoginWall>
            </main>
            {showFooter && <Footer />}
        </div>
    );
}
