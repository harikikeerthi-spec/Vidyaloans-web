"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import ProfileGate from "@/components/ProfileGate";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading, isAdmin, isStaff, isBank, user } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        if (!isAuthenticated) {
            router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
            return;
        }

        // Keep portal sessions isolated: student routes are for student users only.
        if (isAdmin) {
            router.replace("/admin");
            return;
        }

        if (isBank) {
            router.replace("/bank/dashboard");
            return;
        }

        if (isStaff) {
            router.replace("/staff/dashboard");
            return;
        }

        if (user?.role === 'agent' || user?.role === 'partner_agent') {
            router.replace("/agent");
            return;
        }
    }, [isAuthenticated, isLoading, isAdmin, isStaff, isBank, user, router]);

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-transparent">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#6605c7]/20 border-t-[#6605c7] rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400 text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated || isAdmin || isStaff || isBank) return null;

    return <ProfileGate>{children}</ProfileGate>;
}
