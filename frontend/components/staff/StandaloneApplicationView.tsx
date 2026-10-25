"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { adminApi } from "@/lib/api";
import ApplicationDetailView from "@/components/staff/ApplicationDetailView";

interface StandaloneApplicationViewProps {
    id: string;
    activeTab?: "application_details" | "student" | "exams" | "bankdecisions" | "ai_underwriting" | string;
}

export default function StandaloneApplicationView({ id, activeTab = "application_details" }: StandaloneApplicationViewProps) {
    const router = useRouter();
    const { token, user, isLoading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [application, setApplication] = useState<any>(null);

    const fetchApplicationDetails = async () => {
        setLoading(true);
        try {
            const res = await adminApi.getApplication(id) as any;
            if (res && res.success && res.data) {
                setApplication(res.data);
            }
        } catch (e) {
            console.error("Error fetching application details in standalone view:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && token) {
            fetchApplicationDetails();
        }
    }, [id, authLoading, token]);

    useEffect(() => {
        if (!loading && !authLoading && application) {
            const targetUserId = application.userId || application.studentId || application.user?.id || application.user_id || application.applicantId;
            if (targetUserId) {
                router.replace(`/staff/users/${targetUserId}/applications`);
            } else {
                router.replace("/staff/users");
            }
        }
    }, [application, loading, authLoading, router]);

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin" />
                    <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">Loading Application...</p>
                </div>
            </div>
        );
    }

    if (!application) {
        return (
            <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center gap-4" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <p className="text-slate-500 font-semibold">Application not found</p>
                <button
                    onClick={() => router.push("/staff/incoming-queue")}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-md"
                >
                    Go Back to Incoming Queue
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <div className="flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin" />
                <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">Redirecting to User Applications...</p>
            </div>
        </div>
    );
}
