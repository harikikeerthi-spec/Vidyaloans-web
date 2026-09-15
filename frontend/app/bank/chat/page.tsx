"use client";

import { useMemo, Suspense } from "react";
import ChatInterface from "@/components/Chat/ChatInterface";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

function BankChatContent() {
    const searchParams = useSearchParams();
    const { user } = useAuth();
    
    const applicationId = searchParams.get("applicationId");
    const applicationNumber = searchParams.get("applicationNumber");
    const bankParam = searchParams.get("bank") || searchParams.get("bankName");

    let bankNameKey = bankParam || "";
    if (typeof window !== "undefined") {
        bankNameKey = bankParam || 
            sessionStorage.getItem("selectedBankName") || 
            sessionStorage.getItem("selectedBank") || 
            localStorage.getItem("selectedBankName") || 
            localStorage.getItem("selectedBank") || 
            (user as any)?.bank || 
            user?.bankName || 
            (user?.role === 'bank' ? user?.firstName : "") || 
            "";
    }

    const initialBank = useMemo(() => {
        return bankNameKey ? {
            bankName: bankNameKey,
            applicationId: applicationId || undefined,
            applicationNumber: applicationNumber || undefined
        } : null;
    }, [applicationId, applicationNumber, bankNameKey]);

    const conversationId = searchParams.get("conversationId");

    return (
        <div className="h-[calc(100vh-64px)] flex flex-col bg-white">
            <ChatInterface
                role="bank"
                initialBank={initialBank}
                initialConversationId={conversationId || undefined}
                portalTitle="Bank Partner Communication Portal"
                className="flex flex-1 h-full border-0 rounded-none overflow-hidden bg-white shadow-none mt-0 animate-fade-in text-gray-900"
            />
        </div>
    );
}

export default function BankChatPage() {
    return (
        <Suspense fallback={
            <div className="h-[calc(100vh-64px)] flex flex-col bg-white items-center justify-center">
                <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Loading Bank Chat...</p>
            </div>
        }>
            <BankChatContent />
        </Suspense>
    );
}
