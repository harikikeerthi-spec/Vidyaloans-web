"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function ProfileGate({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted || isLoading || !isAuthenticated || !user) return;

        // Bypass checks for staff, admin, bank, and agent roles
        const isStudent =
            user.role !== "admin" &&
            user.role !== "super_admin" &&
            user.role !== "staff" &&
            user.role !== "bank" &&
            user.role !== "partner_bank" &&
            user.role !== "agent" &&
            user.role !== "partner_agent";

        if (!isStudent) return;

        // Check if basic profile details are complete
        const hasAllDetails =
            user.firstName &&
            user.lastName &&
            user.phoneNumber &&
            user.dateOfBirth;

        if (!hasAllDetails && pathname !== "/user-details") {
            router.replace("/user-details");
        }
    }, [isAuthenticated, isLoading, user, pathname, router, mounted]);

    // Show a loading overlay while we check/redirect
    const isStudent =
        user &&
        user.role !== "admin" &&
        user.role !== "super_admin" &&
        user.role !== "staff" &&
        user.role !== "bank" &&
        user.role !== "partner_bank" &&
        user.role !== "agent" &&
        user.role !== "partner_agent";

    const hasAllDetails =
        user &&
        user.firstName &&
        user.lastName &&
        user.phoneNumber &&
        user.dateOfBirth;

    const isRedirecting =
        isAuthenticated &&
        isStudent &&
        !hasAllDetails &&
        pathname !== "/user-details";

    if (!mounted) {
        return <>{children}</>;
    }

    if (mounted && isRedirecting) {
        return (
            <div className="h-screen w-screen fixed inset-0 z-[9999] flex items-center justify-center bg-white">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#6605c7]/20 border-t-[#6605c7] rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 text-sm font-medium">Checking profile details...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
