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

    // Bypass checks for non-student roles
    const isStudent =
        user &&
        user.role !== "admin" &&
        user.role !== "super_admin" &&
        user.role !== "staff" &&
        user.role !== "staff_admin" &&
        user.role !== "bank" &&
        user.role !== "partner_bank" &&
        user.role !== "agent" &&
        user.role !== "partner_agent" &&
        user.role !== "it" &&
        user.role !== "analyst" &&
        user.role !== "marketing";

    // Check if basic profile details are complete
    const hasAllDetails = Boolean(
        user?.firstName?.trim() &&
        user?.lastName?.trim() &&
        user?.phoneNumber?.trim() &&
        user?.dateOfBirth?.trim()
    );

    const isAllowedIncompletePath =
        pathname === "/user-details" ||
        pathname === "/login" ||
        pathname === "/delete-account";

    const isRedirecting =
        mounted &&
        !isLoading &&
        isAuthenticated &&
        Boolean(isStudent) &&
        !hasAllDetails &&
        !isAllowedIncompletePath;

    useEffect(() => {
        if (isRedirecting) {
            router.replace("/user-details");
        }
    }, [isRedirecting, router]);

    if (!mounted) {
        return <>{children}</>;
    }

    if (isRedirecting) {
        return (
            <div className="h-screen w-screen fixed inset-0 z-[9999] flex items-center justify-center bg-white">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#6605c7]/20 border-t-[#6605c7] rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 text-sm font-medium">Please complete your profile details to continue...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
