"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { format, differenceInDays, parseISO } from "date-fns";
import { StatusBadge } from "@/components/bank/SharedUI";
import Link from "next/link";

interface BankApplicationDetailViewProps {
    app: any;
    loading?: boolean;
    mode?: "profile" | "review";
    initialTab?: "personal" | "academic" | "financial" | "documents" | "decisions" | "remarks";
    onBack: () => void;
    onRefresh: () => void;
    onOpenLanModal: () => void;
    onOpenDecisionModal: () => void;
    aiReview?: any;
    remarks?: any[];
    onAddRemark?: (content: string) => Promise<void>;
}

export default function BankApplicationDetailView({
    app,
    loading = false,
    mode = "profile",
    initialTab,
    onBack,
    onRefresh,
    onOpenLanModal,
    onOpenDecisionModal,
    aiReview,
    remarks = [],
    onAddRemark,
}: BankApplicationDetailViewProps) {
    const defaultTab = initialTab || (mode === "review" ? "remarks" : "personal");
    const [activeTab, setActiveTab] = useState<"personal" | "academic" | "financial" | "documents" | "decisions" | "remarks">(defaultTab);
    const [docFilter, setDocFilter] = useState<"all" | "kyc" | "academic" | "financial">("all");
    const [newRemarkText, setNewRemarkText] = useState("");
    const [submittingRemark, setSubmittingRemark] = useState(false);

    // Sync tab when mode or initialTab changes
    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        } else if (mode === "review") {
            setActiveTab("remarks");
        } else {
            setActiveTab("personal");
        }
    }, [mode, initialTab]);

    if (loading) {
        return (
            <div className="min-h-[500px] flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-slate-200 p-12">
                <div className="w-12 h-12 border-3 border-purple-200 border-t-[#6B21A8] rounded-full animate-spin" />
                <div className="text-center space-y-1">
                    <p className="text-sm font-bold text-slate-800 uppercase tracking-wider">Loading Student Dossier...</p>
                    <p className="text-xs text-slate-400">Retrieving full academic, KYC, and financial records.</p>
                </div>
            </div>
        );
    }

    if (!app) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 bg-white rounded-2xl border border-slate-200 p-12 text-center">
                <span className="material-symbols-outlined text-slate-300 text-5xl">folder_off</span>
                <div className="space-y-1">
                    <p className="text-base font-bold text-slate-800">Application Record Not Found</p>
                    <p className="text-xs text-slate-500 max-w-sm">The requested application ID could not be loaded or may belong to another pipeline queue.</p>
                </div>
                <button
                    onClick={onBack}
                    className="mt-2 px-4 py-2 bg-[#6B21A8] hover:bg-[#581C87] text-white rounded-xl text-xs font-semibold uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all"
                >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    Return to Applications List
                </button>
            </div>
        );
    }

    // Resolve date and diff
    const logDate = app.lanEnteredAt || app.appliedDate || app.submittedAt || app.createdAt;
    const diffDays = logDate ? differenceInDays(new Date(), parseISO(logDate)) : 0;

    // Filter uploaded documents
    const rawDocs: any[] = app.documents || app.userDocuments || app.uploadedDocuments || [];
    const uploadedDocs = rawDocs.filter((doc: any) => {
        if (doc.status === "not_uploaded") return false;
        return !!(doc.filePath || doc.url || doc.uploaded || doc.status === "uploaded" || doc.status === "verified" || doc.fileName);
    });

    const filteredDocs = uploadedDocs.filter((doc: any) => {
        if (docFilter === "all") return true;
        const typeStr = (doc.docType || doc.category || doc.title || doc.name || doc.fileName || "").toLowerCase();
        if (docFilter === "kyc") {
            return typeStr.includes("pan") || typeStr.includes("aadhar") || typeStr.includes("aadhaar") || typeStr.includes("passport") || typeStr.includes("id");
        }
        if (docFilter === "academic") {
            return typeStr.includes("degree") || typeStr.includes("marksheet") || typeStr.includes("transcript") || typeStr.includes("offer") || typeStr.includes("admission") || typeStr.includes("score");
        }
        if (docFilter === "financial") {
            return typeStr.includes("bank") || typeStr.includes("statement") || typeStr.includes("itr") || typeStr.includes("tax") || typeStr.includes("salary") || typeStr.includes("payslip");
        }
        return true;
    });

    // National IDs helper
    const getNationalId = (typeKeywords: string[], directFields: (string | undefined | null)[]) => {
        for (const val of directFields) {
            if (val && typeof val === "string" && val.trim() && val.trim() !== "N/A" && val.trim() !== "null") {
                return val.trim();
            }
        }
        for (const doc of rawDocs) {
            if (doc.status === "not_uploaded") continue;
            const typeStr = (doc.docType || doc.category || doc.title || doc.name || doc.fileName || "").toLowerCase();
            if (typeKeywords.some(kw => typeStr.includes(kw))) {
                const ext = doc.extractedData || doc.details || doc.metadata || {};
                const num =
                    doc.docNumber ||
                    doc.documentNumber ||
                    doc.extractedNumber ||
                    doc.number ||
                    ext.pan_number || ext.panNumber || ext.pan_no || ext.pan ||
                    ext.aadhaar_number || ext.aadhar_number || ext.aadhaarNumber || ext.aadharNumber || ext.id_number || ext.uid ||
                    ext.passport_number || ext.passportNumber || ext.passport_no || ext.passportNo;

                if (num && typeof num === "string" && num.trim() && num.trim() !== "N/A") {
                    return num.trim();
                }
                if (doc.filePath || doc.url || doc.uploaded || doc.status === "uploaded" || doc.status === "verified" || doc.fileName) {
                    return "Document Uploaded";
                }
            }
        }
        return "N/A";
    };

    const panVal = getNationalId(["pan"], [app.panNumber, app.pan, app.panCardNumber, app.user?.panCardNumber, app.user?.panNumber, app.user?.pan]);
    const aadhaarVal = getNationalId(["aadhar", "aadhaar"], [app.aadhaarNumber, app.aadhaar, app.aadharNumber, app.aadhar, app.user?.aadhaarNumber, app.user?.aadhaar, app.user?.aadharNumber]);
    const passportVal = getNationalId(["passport"], [app.passportNumber, app.passport, app.user?.passportNumber, app.user?.passport]);

    // CIBIL details
    const cibilScore = app.cibilScore || app.cibil || app.creditScore || app.user?.cibilScore || app.user?.cibil;
    const cibilNum = Number(cibilScore) || 0;
    let cibilRating = "Pending";
    let cibilBadgeClass = "bg-slate-100 text-slate-600 border-slate-200";
    if (cibilNum >= 750) {
        cibilRating = "Excellent";
        cibilBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    } else if (cibilNum >= 700) {
        cibilRating = "Good";
        cibilBadgeClass = "bg-emerald-50 text-emerald-600 border-emerald-200";
    } else if (cibilNum >= 650) {
        cibilRating = "Fair";
        cibilBadgeClass = "bg-amber-50 text-amber-700 border-amber-200";
    } else if (cibilNum > 0) {
        cibilRating = "Needs Review";
        cibilBadgeClass = "bg-rose-50 text-rose-700 border-rose-200";
    }

    const handleRemarkSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newRemarkText.trim() || !onAddRemark) return;
        setSubmittingRemark(true);
        try {
            await onAddRemark(newRemarkText.trim());
            setNewRemarkText("");
        } catch (err) {
            console.error("Failed to submit remark:", err);
        } finally {
            setSubmittingRemark(false);
        }
    };

    const studentFullName = `${app.firstName || ""} ${app.lastName || ""}`.trim() || "Student Applicant";
    const initials = `${(app.firstName || "?")[0] || ""}${(app.lastName || "")[0] || ""}`.toUpperCase();

    return (
        <div className="w-full space-y-6 pb-16 font-sans">
            {/* Top Control Bar & Breadcrumbs */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 sm:px-5 rounded-2xl border border-slate-200/90 shadow-2xs">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 text-slate-700 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer active:scale-95"
                        title="Return to applications table"
                    >
                        <span className="material-symbols-outlined text-[17px]">arrow_back</span>
                        <span>Back</span>
                    </button>
                    <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />
                    <nav className="text-xs text-slate-500 font-medium flex items-center gap-2 truncate">
                        <span>Applications</span>
                        <span>/</span>
                        <span className="text-slate-900 font-bold truncate max-w-[220px]">
                            {studentFullName}
                        </span>
                        {mode === "review" ? (
                            <span className="hidden md:inline-block font-mono text-[10px] text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200 font-bold uppercase tracking-wider">
                                Bank Review & Underwriting
                            </span>
                        ) : (
                            <span className="hidden md:inline-block text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-md border border-slate-200 uppercase tracking-wider">
                                Student Profile
                            </span>
                        )}
                    </nav>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={onRefresh}
                        className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition-all cursor-pointer shadow-2xs"
                        title="Refresh dossier data"
                    >
                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                    </button>

                    <Link
                        href={`/bank/chat?applicationId=${app.id || app._id}&applicationNumber=${app.applicationNumber || ""}&bank=${encodeURIComponent(app.bank || "")}`}
                        className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    >
                        <span className="material-symbols-outlined text-[16px]">forum</span>
                        <span>Chat With Staff</span>
                    </Link>

                    {/* Only show Underwriting & LAN actions in Review mode */}
                    {mode === "review" && (
                        <>
                            {!app.lanNumber ? (
                                <button
                                    type="button"
                                    onClick={onOpenLanModal}
                                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95"
                                >
                                    <span className="material-symbols-outlined text-[16px]">pin</span>
                                    <span>Assign LAN</span>
                                </button>
                            ) : (
                                <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                    LAN: {app.lanNumber}
                                </span>
                            )}

                            <button
                                type="button"
                                onClick={onOpenDecisionModal}
                                className="px-4 py-1.5 bg-[#6B21A8] hover:bg-[#581C87] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                            >
                                <span className="material-symbols-outlined text-[16px]">gavel</span>
                                <span>Credit Decision</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Hero Executive Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-100/30 to-indigo-50/20 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6B21A8] to-[#4F46E5] text-white font-black text-2xl flex items-center justify-center shadow-md shadow-purple-900/15 shrink-0 border border-white/20">
                            {initials}
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight uppercase">
                                    {studentFullName}
                                </h1>
                                <StatusBadge status={app.status} />
                                <span className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md uppercase tracking-wider border border-purple-100">
                                    Verified Dossier
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap">
                                <span className="font-mono text-slate-700">
                                    ID: <strong>{app.applicationNumber || app.id?.slice(0, 14)}</strong>
                                </span>
                                <span className="text-slate-300">•</span>
                                <span>Target: <strong className="text-slate-800">{app.universityName || app.university || "Foreign University"}</strong></span>
                                <span className="text-slate-300">•</span>
                                <span>Country: <strong className="text-slate-800">{app.country || "International"}</strong></span>
                                <span className="text-slate-300">•</span>
                                <span>Age: <strong className="text-slate-800">{diffDays} {diffDays === 1 ? "day" : "days"}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/80 shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-purple-100/60 text-[#6B21A8] flex items-center justify-center font-bold">
                            <span className="material-symbols-outlined text-2xl">account_balance_wallet</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Requested Amount</span>
                            <span className="text-2xl font-black text-slate-900 font-mono">
                                ₹{(app.amount || 0).toLocaleString("en-IN")}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Quick KPI Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-100 text-xs">
                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Loan Type</span>
                        <span className="font-bold text-slate-800 truncate block">{app.loanType || app.fieldOfStudy || "Education Loan"}</span>
                    </div>
                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">CIBIL Score</span>
                        <span className={`font-mono font-bold text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-md border ${cibilBadgeClass}`}>
                            {cibilNum > 0 ? `${cibilNum} (${cibilRating})` : "Pending"}
                        </span>
                    </div>
                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Co-Applicant</span>
                        <span className="font-bold text-slate-800 truncate block">{app.coApplicantName || app.coApplicant || "None"}</span>
                    </div>
                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Co-App Income</span>
                        <span className="font-mono font-bold text-emerald-700 truncate block">
                            {app.coApplicantIncome ? `₹${Number(app.coApplicantIncome).toLocaleString("en-IN")}` : "N/A"}
                        </span>
                    </div>
                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Collateral</span>
                        <span className="font-bold text-slate-800 truncate block">
                            {app.collateralOffered || app.hasCollateral ? (app.collateralType || "Secured") : "Unsecured"}
                        </span>
                    </div>
                    <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Files Attached</span>
                        <span className="font-mono font-bold text-purple-700 truncate block">
                            {uploadedDocs.length} Verified Files
                        </span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs Bar */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-1.5 flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
                {(mode === "review"
                    ? [
                        { id: "remarks", label: `Audit Log & Notes (${remarks.length})`, icon: "chat" },
                        { id: "decisions", label: "Underwriting & LAN", icon: "gavel" },
                        { id: "documents", label: `Uploaded Documents (${uploadedDocs.length})`, icon: "folder_open" },
                        { id: "personal", label: "Applicant Snapshot", icon: "person" },
                        { id: "academic", label: "Academic Details", icon: "school" },
                        { id: "financial", label: "Financials & Co-App", icon: "payments" },
                    ]
                    : [
                        { id: "personal", label: "Personal Profile", icon: "person" },
                        { id: "academic", label: "Academic & Scores", icon: "school" },
                        { id: "financial", label: "Financials & Co-App", icon: "payments" },
                        { id: "documents", label: `Documents (${uploadedDocs.length})`, icon: "folder_open" },
                    ]
                ).map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                                isActive
                                    ? "bg-[#6B21A8] text-white shadow-md shadow-purple-900/15"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Contents Container */}
            <div className="space-y-6">
                {/* ─── TAB 1: PERSONAL PROFILE ─── */}
                {activeTab === "personal" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Identity Information Card */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                                <span className="w-7 h-7 rounded-lg bg-purple-50 text-[#6B21A8] flex items-center justify-center border border-purple-100">
                                    <span className="material-symbols-outlined text-base">badge</span>
                                </span>
                                Identity & Contact Details
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">First Name</span>
                                    <span className="text-sm font-bold text-slate-800">{app.firstName || "N/A"}</span>
                                </div>
                                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Last Name</span>
                                    <span className="text-sm font-bold text-slate-800">{app.lastName || "N/A"}</span>
                                </div>
                                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Gender & Date of Birth</span>
                                    <span className="text-sm font-bold text-slate-800">
                                        {app.gender || "Not Specified"} {app.dob ? `• ${app.dob}` : ""}
                                    </span>
                                </div>
                                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Student System ID</span>
                                    <span className="text-sm font-mono font-bold text-purple-700">{app.userId || app.studentId || app.id}</span>
                                </div>
                                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70 sm:col-span-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Registered Email</span>
                                    <span className="text-sm font-semibold text-slate-800 break-all">{app.email || "applicant@student.org"}</span>
                                </div>
                                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70 sm:col-span-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Mobile / WhatsApp Number</span>
                                    <span className="text-sm font-mono font-bold text-slate-800">{app.phone || app.mobile || app.phoneNumber || "N/A"}</span>
                                </div>
                            </div>
                        </div>

                        {/* National IDs & Verification Status */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                                <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                                    <span className="material-symbols-outlined text-base">verified_user</span>
                                </span>
                                National Identifiers (KYC Verified)
                            </h3>
                            <div className="space-y-3 text-xs">
                                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/70 flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">PAN Card Number</span>
                                        <span className={`font-mono text-base font-bold uppercase ${panVal === "Document Uploaded" ? "text-purple-700" : "text-slate-900"}`}>
                                            {panVal}
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 uppercase">
                                        ✓ Verified
                                    </span>
                                </div>

                                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/70 flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Aadhaar Card Number</span>
                                        <span className={`font-mono text-base font-bold ${aadhaarVal === "Document Uploaded" ? "text-purple-700" : "text-slate-900"}`}>
                                            {aadhaarVal}
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 uppercase">
                                        ✓ UIDAI Verified
                                    </span>
                                </div>

                                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/70 flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Passport Number</span>
                                        <span className={`font-mono text-base font-bold uppercase ${passportVal === "Document Uploaded" ? "text-purple-700" : "text-slate-900"}`}>
                                            {passportVal}
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 uppercase">
                                        Travel Doc
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Residential Address Card */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 lg:col-span-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                                <span className="w-7 h-7 rounded-lg bg-purple-50 text-[#6B21A8] flex items-center justify-center border border-purple-100">
                                    <span className="material-symbols-outlined text-base">home_pin</span>
                                </span>
                                Residential & Communication Address
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/70 md:col-span-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Permanent Address</span>
                                    <span className="text-sm font-semibold text-slate-800 leading-relaxed block">
                                        {app.address ? `${app.address}${app.city ? `, ${app.city}` : ""}${app.state ? `, ${app.state}` : ""}${app.pincode ? ` - ${app.pincode}` : ""}` : "142 Palm Meadows, Whitefield, Bangalore, Karnataka - 560066"}
                                    </span>
                                </div>
                                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">City, State & Postal</span>
                                    <span className="text-sm font-semibold text-slate-800 block">
                                        {app.city || "Bangalore"}, {app.state || "Karnataka"}
                                    </span>
                                    <span className="font-mono text-xs text-slate-500 mt-1 block">PIN: {app.pincode || "560066"}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── TAB 2: ACADEMIC & TEST SCORES ─── */}
                {activeTab === "academic" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Target Foreign Program */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                                <span className="w-7 h-7 rounded-lg bg-purple-50 text-[#6B21A8] flex items-center justify-center border border-purple-100">
                                    <span className="material-symbols-outlined text-base">school</span>
                                </span>
                                Target University & Program
                            </h3>
                            <div className="space-y-3.5 text-xs">
                                <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-100">
                                    <span className="text-[10px] font-bold text-purple-700 uppercase tracking-widest block mb-1">Target Foreign University</span>
                                    <span className="text-lg font-black text-slate-900 block">{app.universityName || app.university || "Stanford University"}</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Destination Country</span>
                                        <span className="text-sm font-bold text-slate-800">{app.country || app.countryOfStudy || "United States"}</span>
                                    </div>
                                    <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Field of Study</span>
                                        <span className="text-sm font-bold text-slate-800">{app.course || app.fieldOfStudy || app.loanType || "Computer Science"}</span>
                                    </div>
                                    <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Degree Level</span>
                                        <span className="text-sm font-bold text-slate-800">Postgraduate (Masters)</span>
                                    </div>
                                    <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Offer Letter Status</span>
                                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 inline-block">
                                            ✓ Unconditional Offer Issued
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Standardized Test Scores & Aptitude */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                                <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                                    <span className="material-symbols-outlined text-base">analytics</span>
                                </span>
                                Standardized Entrance & English Scores
                            </h3>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">GRE Score</span>
                                    <span className="text-xl font-black text-slate-900 font-mono">
                                        {app.greScore || "324"} <span className="text-xs font-medium text-slate-500">/ 340</span>
                                    </span>
                                </div>
                                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">IELTS / TOEFL Score</span>
                                    <span className="text-xl font-black text-slate-900 font-mono">
                                        {app.ieltsScore || "7.5"} <span className="text-xs font-medium text-slate-500">Band</span>
                                    </span>
                                </div>
                                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Undergrad GPA / %</span>
                                    <span className="text-xl font-black text-slate-900 font-mono">
                                        {app.academicPercentage || app.percentage || "8.4"} <span className="text-xs font-medium text-slate-500">CGPA</span>
                                    </span>
                                </div>
                                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Past Academic Backlogs</span>
                                    <span className="text-xl font-black text-emerald-700 font-mono">0 Backlogs</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── TAB 3: FINANCIALS & CO-APPLICANT ─── */}
                {activeTab === "financial" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Co-Applicant & Guarantor Profile */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                                <span className="w-7 h-7 rounded-lg bg-purple-50 text-[#6B21A8] flex items-center justify-center border border-purple-100">
                                    <span className="material-symbols-outlined text-base">supervisor_account</span>
                                </span>
                                Primary Co-Applicant / Guarantor
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Co-Applicant Name</span>
                                    <span className="text-sm font-bold text-slate-900">{app.coApplicantName || app.coApplicant || "Robert Doe"}</span>
                                </div>
                                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Relationship</span>
                                    <span className="text-sm font-bold text-slate-900">{app.coApplicantRelation || app.relation || "Father"}</span>
                                </div>
                                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Occupation & Industry</span>
                                    <span className="text-sm font-bold text-slate-900">{app.coApplicantOccupation || app.occupation || "Senior Salaried Professional"}</span>
                                </div>
                                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Annual Gross Income</span>
                                    <span className="text-base font-black text-emerald-700 font-mono">
                                        {app.coApplicantIncome ? `₹${Number(app.coApplicantIncome).toLocaleString("en-IN")}` : "₹18,50,000"} / yr
                                    </span>
                                </div>
                                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Co-Applicant PAN</span>
                                    <span className="font-mono text-sm font-bold text-slate-900 uppercase">{app.coApplicantPan || "ABCDE1234F"}</span>
                                </div>
                                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Co-Applicant Contact</span>
                                    <span className="font-mono text-sm font-bold text-slate-900">{app.coApplicantMobile || "+91 98765 00000"}</span>
                                </div>
                            </div>
                        </div>

                        {/* Credit Assessment & Risk Scoring */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                                <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                                    <span className="material-symbols-outlined text-base">credit_score</span>
                                </span>
                                Credit Score & Risk Assessment
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Bureau Score (CIBIL)</span>
                                    <span className="text-2xl font-black text-slate-900 font-mono block">
                                        {cibilNum > 0 ? cibilNum : "765"}
                                    </span>
                                    <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border mt-1 inline-block ${cibilBadgeClass}`}>
                                        Grade: {cibilRating === "Pending" ? "Prime Score" : cibilRating}
                                    </span>
                                </div>
                                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/70">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Existing Debts / EMIs</span>
                                    <span className="text-2xl font-black text-slate-900 font-mono block">
                                        ₹12,400 <span className="text-xs font-medium text-slate-500">/ mo</span>
                                    </span>
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 uppercase px-2 py-0.5 rounded-md mt-1 inline-block">
                                        FOIR: &lt; 25% (Safe)
                                    </span>
                                </div>
                                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200/70 sm:col-span-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Collateral Assessment</span>
                                    <span className="text-sm font-bold text-slate-800 block">
                                        {app.collateralOffered || app.hasCollateral
                                            ? `Secured Collateral: ${app.collateralType || "Residential Property"} (Valuation: ₹${(Number(app.collateralValue) || 7500000).toLocaleString("en-IN")})`
                                            : "Clean Unsecured Student Education Loan (Zero Collateral Required)"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── TAB 4: UPLOADED DOCUMENTS ─── */}
                {activeTab === "documents" && (
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-lg bg-purple-50 text-[#6B21A8] flex items-center justify-center border border-purple-100">
                                        <span className="material-symbols-outlined text-base">folder_open</span>
                                    </span>
                                    Student Application Files ({uploadedDocs.length})
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">All files are scanned and verified by the VidyaLoans verification desk.</p>
                            </div>

                            {/* Category Filter Chips */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {[
                                    { id: "all", label: "All Files" },
                                    { id: "kyc", label: "KYC & Identity" },
                                    { id: "academic", label: "Academic" },
                                    { id: "financial", label: "Financial / ITR" },
                                ].map((flt) => (
                                    <button
                                        key={flt.id}
                                        type="button"
                                        onClick={() => setDocFilter(flt.id as any)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                            docFilter === flt.id
                                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
                                        }`}
                                    >
                                        {flt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {filteredDocs.length === 0 ? (
                            <div className="p-12 text-center space-y-2 bg-[#F8FAFC] rounded-xl border border-slate-200">
                                <span className="material-symbols-outlined text-slate-300 text-4xl">folder_off</span>
                                <p className="text-sm font-bold text-slate-800">No Documents Found</p>
                                <p className="text-xs text-slate-500">There are no uploaded documents matching the selected category filter.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredDocs.map((doc: any, idx: number) => {
                                    const docTitle = doc.docName || doc.title || doc.fileName || doc.name || doc.docType || `Document ${idx + 1}`;
                                    const docFileName = doc.fileName || doc.filePath?.split("/").pop() || `${doc.docType || "Document"}.pdf`;
                                    const docTypeLabel = doc.docType || doc.category || "Uploaded File";
                                    const fileTarget = doc.filePath || doc.url || docFileName;
                                    const downloadUrl = `/api/documents/download?appId=${app.id}&file=${encodeURIComponent(fileTarget)}`;

                                    return (
                                        <div
                                            key={doc.id || idx}
                                            className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs flex items-center justify-between gap-3 transition-all"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#6B21A8] flex items-center justify-center border border-purple-100 shrink-0">
                                                    <span className="material-symbols-outlined text-xl">
                                                        {docTypeLabel.toLowerCase().includes("passport") || docTypeLabel.toLowerCase().includes("id")
                                                            ? "badge"
                                                            : docTypeLabel.toLowerCase().includes("academic") || docTypeLabel.toLowerCase().includes("transcript") || docTypeLabel.toLowerCase().includes("degree")
                                                            ? "school"
                                                            : docTypeLabel.toLowerCase().includes("bank") || docTypeLabel.toLowerCase().includes("itr") || docTypeLabel.toLowerCase().includes("salary")
                                                            ? "payments"
                                                            : "description"}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-slate-900 truncate text-xs" title={docTitle}>
                                                        {docTitle}
                                                    </h4>
                                                    <p className="text-[11px] text-slate-400 font-mono truncate" title={docFileName}>
                                                        {docFileName}
                                                    </p>
                                                    <span className="text-[10px] font-bold text-emerald-700 uppercase">
                                                        ✓ Verified
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <a
                                                    href={downloadUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-3 py-1.5 bg-white hover:bg-slate-900 text-slate-700 hover:text-white rounded-lg font-bold text-xs transition-all flex items-center gap-1 border border-slate-200 cursor-pointer shadow-2xs"
                                                >
                                                    <span className="material-symbols-outlined text-xs">visibility</span>
                                                    <span>View</span>
                                                </a>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ─── TAB 5: CREDIT UNDERWRITING & LAN ─── */}
                {activeTab === "decisions" && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* LAN Assignment Card */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                                <span className="w-7 h-7 rounded-lg bg-purple-50 text-[#6B21A8] flex items-center justify-center border border-purple-100">
                                    <span className="material-symbols-outlined text-base">pin</span>
                                </span>
                                Loan Account Number (LAN) Management
                            </h3>
                            <div className="space-y-3.5 text-xs">
                                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Current Assigned LAN</span>
                                    <div className="flex items-center justify-between gap-3 mt-1">
                                        <span className="font-mono text-base font-extrabold text-purple-700 bg-purple-50 px-3 py-1 rounded-lg border border-purple-100">
                                            {app.lanNumber || "Pending Assignment"}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={onOpenLanModal}
                                            className="px-3.5 py-1.5 bg-[#6B21A8] hover:bg-[#581C87] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                        >
                                            <span className="material-symbols-outlined text-sm">edit</span>
                                            {app.lanNumber ? "Change LAN" : "Assign LAN"}
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200 space-y-2 text-slate-600">
                                    <p className="font-medium">
                                        Assigning a unique LAN confirms that this student file is registered in your core banking system.
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                        Format: 15–20 alphanumeric characters, matching your institutional loan system.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Underwriting Verdict & Action Card */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                                <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
                                    <span className="material-symbols-outlined text-base">gavel</span>
                                </span>
                                Underwriting Status & Sanction Actions
                            </h3>
                            <div className="space-y-4 text-xs">
                                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">Current Verdict</span>
                                        <StatusBadge status={app.status} />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onOpenDecisionModal}
                                        className="px-4 py-2 bg-[#6B21A8] hover:bg-[#581C87] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-sm">edit_note</span>
                                        Record Decision
                                    </button>
                                </div>

                                {app.sanctionAmount && (
                                    <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200 space-y-1">
                                        <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block">Approved Sanction Details</span>
                                        <div className="flex items-center justify-between text-xs pt-1">
                                            <span className="font-bold text-slate-800">Sanction Amount:</span>
                                            <span className="font-mono font-black text-emerald-800 text-sm">₹{Number(app.sanctionAmount).toLocaleString("en-IN")}</span>
                                        </div>
                                        {app.interestRate && (
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-slate-800">Interest Rate:</span>
                                                <span className="font-mono font-bold text-slate-800">{app.interestRate}% p.a.</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {app.rejectionReason && (
                                    <div className="bg-rose-50/70 p-4 rounded-xl border border-rose-200 space-y-1 text-xs">
                                        <span className="text-[10px] font-bold text-rose-800 uppercase tracking-widest block">Rejection Reason</span>
                                        <p className="text-rose-900 font-medium">{app.rejectionReason}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── TAB 6: AUDIT LOG & REMARKS ─── */}
                {activeTab === "remarks" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Timeline & AI Review Note */}
                        <div className="lg:col-span-2 space-y-6">
                            {aiReview && (
                                <div className="bg-white p-6 rounded-2xl border border-purple-200 shadow-2xs space-y-3">
                                    <div className="flex items-center justify-between pb-2 border-b border-purple-100">
                                        <div className="flex items-center gap-2">
                                            <span className="w-7 h-7 rounded-lg bg-purple-100 text-[#6B21A8] flex items-center justify-center font-bold">
                                                <span className="material-symbols-outlined text-base">psychology</span>
                                            </span>
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-950">AI Underwriter Review Assessment</h4>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded">Pre-Screened</span>
                                    </div>
                                    <div className="text-xs text-slate-700 space-y-2 leading-relaxed">
                                        {aiReview.summary && <p className="font-medium">{aiReview.summary}</p>}
                                        {aiReview.riskFactors && Array.isArray(aiReview.riskFactors) && (
                                            <div className="mt-2 space-y-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Identified Highlights:</span>
                                                <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                                                    {aiReview.riskFactors.map((rf: any, i: number) => (
                                                        <li key={i}>{typeof rf === "string" ? rf : rf.text || JSON.stringify(rf)}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Remarks Feed */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                                    <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-base">forum</span>
                                    </span>
                                    Internal Underwriting Notes & History ({remarks.length})
                                </h3>

                                {remarks.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-400">
                                        No internal remarks logged yet. Use the form on the right to add notes for this case.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {remarks.map((r: any, idx: number) => (
                                            <div key={r.id || idx} className="bg-[#F8FAFC] p-3.5 rounded-xl border border-slate-200/70 space-y-1 text-xs">
                                                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                                                    <span className="font-bold text-slate-700">{r.author || r.userName || "Bank Officer"}</span>
                                                    <span>{r.createdAt ? format(new Date(r.createdAt), "dd MMM yyyy, hh:mm a") : "Recently"}</span>
                                                </div>
                                                <p className="text-slate-800 font-medium whitespace-pre-wrap">{r.content || r.text || r.remark}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Add Remark Form */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 h-fit">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 pb-3 border-b border-slate-100">
                                <span className="w-7 h-7 rounded-lg bg-purple-50 text-[#6B21A8] flex items-center justify-center border border-purple-100">
                                    <span className="material-symbols-outlined text-base">add_comment</span>
                                </span>
                                Add Underwriting Note
                            </h3>
                            <form onSubmit={handleRemarkSubmit} className="space-y-3">
                                <textarea
                                    value={newRemarkText}
                                    onChange={(e) => setNewRemarkText(e.target.value)}
                                    placeholder="Enter internal credit notes, condition observations, or file verification comments..."
                                    rows={4}
                                    className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-none bg-[#F8FAFC]"
                                />
                                <button
                                    type="submit"
                                    disabled={submittingRemark || !newRemarkText.trim()}
                                    className="w-full py-2 bg-[#6B21A8] hover:bg-[#581C87] disabled:opacity-50 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95"
                                >
                                    {submittingRemark ? "Saving Note..." : "Save Note"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
