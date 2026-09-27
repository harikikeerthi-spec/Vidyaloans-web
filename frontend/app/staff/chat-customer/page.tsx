"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import ChatInterface from "@/components/Chat/ChatInterface";
import { adminApi } from "@/lib/api";

function SupportChatContent() {
    const searchParams = useSearchParams();

    const userId = searchParams.get("userId") || searchParams.get("id");
    const email = searchParams.get("email");
    const firstName = searchParams.get("firstName");
    const lastName = searchParams.get("lastName");
    const phone = searchParams.get("phone") || searchParams.get("phoneNumber");
    const applicationId = searchParams.get("applicationId") || searchParams.get("appId");
    const applicationNumber = searchParams.get("applicationNumber") || searchParams.get("appNo");
    const rawBankName = searchParams.get("bankName") || searchParams.get("bank");
    const cleanBankName = rawBankName ? (rawBankName.includes(',') ? rawBankName.split(',')[0].trim() : rawBankName.trim()) : null;

    // Distinguish between student chat and bank chat
    const isStudentChat = Boolean(userId || (!cleanBankName && (email || phone || firstName)));
    const isBankChat = Boolean(cleanBankName && !userId);

    const [resolvedUser, setResolvedUser] = useState<any>(null);
    const [loading, setLoading] = useState(isStudentChat && !!userId && !phone);

    useEffect(() => {
        if (!isStudentChat) {
            setResolvedUser(null);
            setLoading(false);
            return;
        }

        if (userId && !phone) {
            setLoading(true);
            adminApi.getUserById(userId)
                .then((res: any) => {
                    const u = res?.data || res?.user || res;
                    if (u) {
                        setResolvedUser({
                            id: userId,
                            email: u.email || email || "",
                            firstName: u.firstName || firstName || "Student",
                            lastName: u.lastName || lastName || "",
                            phone: u.phoneNumber || u.mobile || u.phone || "",
                            phoneNumber: u.phoneNumber || u.mobile || u.phone || "",
                            applicationId: applicationId || undefined,
                            applicationNumber: applicationNumber || undefined
                        });
                    } else {
                        setResolvedUser({
                            id: userId,
                            email: email || "",
                            firstName: firstName || "Student",
                            lastName: lastName || "",
                            phone: "",
                            phoneNumber: "",
                            applicationId: applicationId || undefined,
                            applicationNumber: applicationNumber || undefined
                        });
                    }
                })
                .catch((err) => {
                    console.error("Failed to fetch user chat details:", err);
                    setResolvedUser({
                        id: userId,
                        email: email || "",
                        firstName: firstName || "Student",
                        lastName: lastName || "",
                        phone: "",
                        phoneNumber: "",
                        applicationId: applicationId || undefined,
                        applicationNumber: applicationNumber || undefined
                    });
                })
                .finally(() => {
                    setLoading(false);
                });
        } else if (userId || email || phone) {
            setResolvedUser({
                id: userId || "",
                email: email || "",
                firstName: firstName || "Student",
                lastName: lastName || "",
                phone: phone || "",
                phoneNumber: phone || "",
                applicationId: applicationId || undefined,
                applicationNumber: applicationNumber || undefined
            });
            setLoading(false);
        }
    }, [isStudentChat, userId, phone, email, firstName, lastName, applicationId, applicationNumber]);

    const initialBank = isBankChat ? {
        bankName: cleanBankName!,
        applicationId: applicationId || undefined,
        applicationNumber: applicationNumber || undefined
    } : null;

    if (loading) {
        return (
            <div className="h-[calc(100vh-56px)] flex flex-col bg-white items-center justify-center">
                <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Resolving Student Details...</p>
            </div>
        );
    }

    const conversationId = searchParams.get("conversationId");

    return (
        <div className="h-[calc(100vh-56px)] flex flex-col bg-white">
            <ChatInterface
                role="staff"
                initialUser={resolvedUser}
                initialBank={initialBank}
                initialConversationId={conversationId || undefined}
                className="flex flex-1 h-full border-0 rounded-none overflow-hidden bg-white shadow-none mt-0 animate-fade-in text-gray-900"
            />
        </div>
    );
}

export default function SupportChatPage() {
    return (
        <Suspense fallback={
            <div className="h-[calc(100vh-56px)] flex flex-col bg-white items-center justify-center">
                <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Loading Support Chat...</p>
            </div>
        }>
            <SupportChatContent />
        </Suspense>
    );
}
