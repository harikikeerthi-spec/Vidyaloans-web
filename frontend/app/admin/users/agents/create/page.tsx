"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/api";

export default function CreateAgentPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<"general" | "partnership" | "documents">("general");

    const [formData, setFormData] = useState({
        // Identity & Contact
        firstName: "",
        lastName: "",
        email: "",
        mobile: "",
        // Partnership & Channel
        partnership: "Individual Consultant",
        percentage: "1.5",
        businessName: "",
        panNumber: "",
        gstin: "",
        officeAddress: "",
        profilePhoto: "",
        // Verification & Documents
        documents: [] as { name: string; type: string; url?: string; uploadedAt?: string }[]
    });

    const isStep1Complete = Boolean(
        formData.firstName.trim() &&
        formData.lastName.trim() &&
        formData.email.trim() &&
        formData.mobile.trim()
    );

    const isStep2Complete = Boolean(
        formData.partnership &&
        formData.percentage
    );

    const isStep3Complete = Boolean(
        formData.panNumber.trim().length === 10
    );

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, docType: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFormData(prev => {
            const filtered = prev.documents.filter(d => d.type !== docType);
            return {
                ...prev,
                documents: [
                    ...filtered,
                    {
                        name: file.name,
                        type: docType,
                        uploadedAt: new Date().toISOString()
                    }
                ]
            };
        });
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            setFormData(prev => ({ ...prev, profilePhoto: reader.result as string }));
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (isDraft = false) => {
        if (!formData.email || !formData.firstName) {
            alert("Please enter at least First Name and Email Address.");
            setActiveTab("general");
            return;
        }

        if (!isDraft && !formData.panNumber) {
            alert("Please enter the PAN Number before submitting and activating the Agent profile. Otherwise, you can click 'Save as Draft'.");
            setActiveTab("documents");
            return;
        }

        setLoading(true);
        try {
            const payload = {
                role: "agent",
                email: formData.email.trim(),
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                mobile: formData.mobile.trim(),
                partnership: formData.partnership,
                percentage: formData.percentage,
                businessName: formData.businessName.trim() || `${formData.firstName} Agency`,
                panNumber: formData.panNumber.trim().toUpperCase(),
                gstin: formData.gstin.trim().toUpperCase(),
                officeAddress: formData.officeAddress.trim(),
                profilePhoto: formData.profilePhoto,
                documents: formData.documents,
                isDraft
            };

            const res: any = await adminApi.createUser(payload);

            if (res.success && res.user?.id) {
                if (isDraft) {
                    alert("Agent profile saved as Draft successfully. An onboarding email will only be sent when the profile is submitted and activated.");
                } else {
                    alert(`Agent Partner profile created & activated! Congratulations welcome email with portal login link sent to: ${res.user.email || formData.email}`);
                }
                router.push("/admin/users/agents");
            } else {
                alert("Failed to create agent profile: " + (res.message || "Unknown error"));
            }
        } catch (err: any) {
            alert("Error creating agent profile: " + (err?.message || err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-800 pb-28 font-sans flex flex-col">
            {/* Top Navigation & Breadcrumbs */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.push("/admin/users/agents")}
                            className="w-9 h-9 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Back to Agent Partners"
                        >
                            <span className="material-symbols-outlined text-lg">arrow_back</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                                <Link href="/admin/dashboard" className="hover:text-indigo-600 transition-colors">Admin</Link>
                                <span>/</span>
                                <Link href="/admin/users/agents" className="hover:text-indigo-600 transition-colors">Agent Partners</Link>
                                <span>/</span>
                                <span className="text-slate-600">New Agent</span>
                            </div>
                            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
                                <span className="material-symbols-outlined text-amber-600 text-xl">support_agent</span>
                                Create Agent Partner Profile
                            </h1>
                        </div>
                    </div>

                    {/* Quick Header Actions */}
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            disabled={loading || !formData.email || !formData.firstName}
                            onClick={() => handleSubmit(true)}
                            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-base">save</span>
                            <span className="hidden sm:inline">Save as</span> Draft
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleSubmit(false)}
                            className="px-4 py-2 bg-slate-900 hover:bg-indigo-600 text-white rounded-md font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-60"
                        >
                            {loading ? (
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-base">check_circle</span>
                                    <span>Submit & Activate</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Form Body */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 flex-1 w-full space-y-6">

                {/* Refined Information Banner (SaaS Callout Pattern with left border) */}
                <div className="bg-amber-50/70 border-l-4 border-amber-500 rounded-r-md p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-start gap-3">
                    <span className="material-symbols-outlined text-amber-600 text-xl mt-0.5 shrink-0">info</span>
                    <div className="text-xs sm:text-[13px] text-amber-950 leading-relaxed">
                        <strong className="font-bold">Flexible Onboarding:</strong> Fill in the available information. If KYC documents or PAN details are pending, click <strong className="underline">Save as Draft</strong> to save progress without triggering the official congratulations email. Once completed, clicking <strong className="underline">Submit & Activate</strong> will verify the profile and email the agent portal login link.
                    </div>
                </div>

                {/* Upgraded Progress Stepper with Visual Connecting Lines & State Indicators */}
                <div className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-2 sm:p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 relative">
                        {/* Step 1 Tab */}
                        <button
                            type="button"
                            onClick={() => setActiveTab("general")}
                            className={`p-3 rounded-md text-left transition-all flex items-center justify-between border cursor-pointer ${
                                activeTab === "general"
                                    ? "bg-indigo-50/80 border-indigo-600 text-indigo-900 shadow-xs"
                                    : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"
                            }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                                    isStep1Complete
                                        ? "bg-emerald-500 text-white"
                                        : activeTab === "general"
                                        ? "bg-indigo-600 text-white"
                                        : "bg-slate-100 text-slate-500"
                                }`}>
                                    {isStep1Complete ? (
                                        <span className="material-symbols-outlined text-base">check</span>
                                    ) : (
                                        "1"
                                    )}
                                </span>
                                <div className="min-w-0">
                                    <p className={`text-xs font-bold truncate ${activeTab === "general" ? "text-indigo-900" : "text-slate-800"}`}>
                                        Personal & Contact
                                    </p>
                                    <p className="text-[11px] text-slate-400 truncate">Identity & Direct Channels</p>
                                </div>
                            </div>
                            {isStep1Complete && (
                                <span className="material-symbols-outlined text-emerald-600 text-lg shrink-0">check_circle</span>
                            )}
                        </button>

                        {/* Step 2 Tab */}
                        <button
                            type="button"
                            onClick={() => setActiveTab("partnership")}
                            className={`p-3 rounded-md text-left transition-all flex items-center justify-between border cursor-pointer ${
                                activeTab === "partnership"
                                    ? "bg-amber-50/80 border-amber-500 text-amber-900 shadow-xs"
                                    : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"
                            }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                                    isStep2Complete
                                        ? "bg-emerald-500 text-white"
                                        : activeTab === "partnership"
                                        ? "bg-amber-500 text-white"
                                        : "bg-slate-100 text-slate-500"
                                }`}>
                                    {isStep2Complete ? (
                                        <span className="material-symbols-outlined text-base">check</span>
                                    ) : (
                                        "2"
                                    )}
                                </span>
                                <div className="min-w-0">
                                    <p className={`text-xs font-bold truncate ${activeTab === "partnership" ? "text-amber-900" : "text-slate-800"}`}>
                                        Partnership & Commission
                                    </p>
                                    <p className="text-[11px] text-slate-400 truncate">Payouts & Business Model</p>
                                </div>
                            </div>
                            {isStep2Complete && (
                                <span className="material-symbols-outlined text-emerald-600 text-lg shrink-0">check_circle</span>
                            )}
                        </button>

                        {/* Step 3 Tab */}
                        <button
                            type="button"
                            onClick={() => setActiveTab("documents")}
                            className={`p-3 rounded-md text-left transition-all flex items-center justify-between border cursor-pointer ${
                                activeTab === "documents"
                                    ? "bg-emerald-50/80 border-emerald-600 text-emerald-900 shadow-xs"
                                    : "bg-white border-slate-100 hover:bg-slate-50 text-slate-700"
                            }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <span className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                                    isStep3Complete
                                        ? "bg-emerald-500 text-white"
                                        : activeTab === "documents"
                                        ? "bg-emerald-600 text-white"
                                        : "bg-slate-100 text-slate-500"
                                }`}>
                                    {isStep3Complete ? (
                                        <span className="material-symbols-outlined text-base">check</span>
                                    ) : (
                                        "3"
                                    )}
                                </span>
                                <div className="min-w-0">
                                    <p className={`text-xs font-bold truncate ${activeTab === "documents" ? "text-emerald-900" : "text-slate-800"}`}>
                                        Compliance & Documents
                                    </p>
                                    <p className="text-[11px] text-slate-400 truncate">PAN, Tax & KYC Verification</p>
                                </div>
                            </div>
                            {isStep3Complete && (
                                <span className="material-symbols-outlined text-emerald-600 text-lg shrink-0">check_circle</span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Form Card Container */}
                <div className="space-y-6">
                    {/* SECTION 1: Personal & Contact Details */}
                    <div className={`bg-white rounded-lg p-6 sm:p-8 border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] ${activeTab !== "general" ? "hidden" : "block"}`}>
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                            <div className="w-8 h-8 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                <span className="material-symbols-outlined text-lg">person</span>
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Personal & Contact Details</h2>
                                <p className="text-xs text-slate-400">Primary identity, direct communication channels, and profile photograph.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                    First Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.firstName}
                                    onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                    placeholder="E.g. Rajesh"
                                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                    Last Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.lastName}
                                    onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                    placeholder="E.g. Sharma"
                                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                />
                            </div>

                            <div>
                                <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                    Email Address <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="partner.email@consultancy.com"
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    />
                                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">mail</span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">Credentials & welcome portal link will be sent to this address.</p>
                            </div>

                            <div>
                                <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                    Mobile Number <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="tel"
                                        required
                                        value={formData.mobile}
                                        onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                                        placeholder="+91 98765 43210"
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    />
                                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">call</span>
                                </div>
                            </div>
                        </div>

                        {/* Profile Photo */}
                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-2">
                                Profile Photograph
                            </label>
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                <div className="w-14 h-14 rounded-md bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                                    {formData.profilePhoto ? (
                                        <img src={formData.profilePhoto} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="material-symbols-outlined text-slate-400 text-2xl">account_circle</span>
                                    )}
                                </div>
                                <div className="flex-1 flex flex-col sm:flex-row gap-2 w-full">
                                    <input
                                        type="text"
                                        value={formData.profilePhoto}
                                        onChange={e => setFormData({ ...formData, profilePhoto: e.target.value })}
                                        placeholder="Paste image URL (https://...)"
                                        className="flex-1 px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    />
                                    <label className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shrink-0">
                                        <span className="material-symbols-outlined text-base">cloud_upload</span>
                                        <span>Upload File</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handlePhotoUpload}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: Partnership & Commission */}
                    <div className={`bg-white rounded-lg p-6 sm:p-8 border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] ${activeTab !== "partnership" ? "hidden" : "block"}`}>
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                            <div className="w-8 h-8 rounded-md bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                                <span className="material-symbols-outlined text-lg">handshake</span>
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Partnership & Commission Terms</h2>
                                <p className="text-xs text-slate-400">Agreed commercial terms, payout percentages, and business entity registration.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                    Partnership Channel / Model <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={formData.partnership}
                                    onChange={e => setFormData({ ...formData, partnership: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all cursor-pointer"
                                >
                                    <option value="Individual Consultant">Individual Education Consultant</option>
                                    <option value="Study Abroad Consultancy">Study Abroad Consultancy / Firm</option>
                                    <option value="University Referral Partner">University Referral Partner</option>
                                    <option value="Corporate Channel Partner">Corporate Channel Partner</option>
                                    <option value="Financial Advisor">Financial Advisor / Direct Selling Agent (DSA)</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                    Agreed Commission Rate (%) <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        max="25"
                                        value={formData.percentage}
                                        onChange={e => setFormData({ ...formData, percentage: e.target.value })}
                                        placeholder="1.5"
                                        className="w-full pl-3 pr-8 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none select-none">%</span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">Payout calculated on the net disbursed education loan amount.</p>
                            </div>

                            <div>
                                <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                    Business / Agency Name
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.businessName}
                                        onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                                        placeholder="E.g. Global Scholars Overseas Education"
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                                    />
                                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">apartment</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                    Office City & Address
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.officeAddress}
                                        onChange={e => setFormData({ ...formData, officeAddress: e.target.value })}
                                        placeholder="E.g. 402, Pinnacle Tower, Banjara Hills, Hyderabad"
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                                    />
                                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">location_on</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: Compliance & KYC Documents */}
                    <div className={`bg-white rounded-lg p-6 sm:p-8 border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] ${activeTab !== "documents" ? "hidden" : "block"}`}>
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-6">
                            <div className="w-8 h-8 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                                <span className="material-symbols-outlined text-lg">verified</span>
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-slate-900">Compliance & Regulatory Identifiers</h2>
                                <p className="text-xs text-slate-400">Tax identifiers and KYC document verification. Can be saved as draft if pending.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                    PAN Number (Agent or Entity) <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        maxLength={10}
                                        value={formData.panNumber}
                                        onChange={e => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                                        placeholder="ABCDE1234F"
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-bold tracking-wider text-slate-900 uppercase focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                    />
                                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">badge</span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">Required for TDS compliance and verified commission disbursements.</p>
                            </div>

                            <div>
                                <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                    GSTIN / Registration Number (Optional)
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        maxLength={15}
                                        value={formData.gstin}
                                        onChange={e => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                                        placeholder="22AAAAA0000A1Z5"
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-bold tracking-wider text-slate-900 uppercase focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                    />
                                    <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">receipt_long</span>
                                </div>
                            </div>
                        </div>

                        {/* KYC Document Checklist */}
                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Verification Documents</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Attach document copies now or submit later.</p>
                                </div>
                                <span className="text-[11px] font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-600">
                                    {formData.documents.length} / 3 Attached
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {[
                                    { key: "pan_card", label: "PAN Card Copy", desc: "Front copy of PAN card", icon: "badge" },
                                    { key: "business_registration", label: "Business Registration / GST", desc: "Incorporation or GST certificate", icon: "corporate_fare" },
                                    { key: "signed_agreement", label: "Signed Partner Agreement", desc: "Executed referral agreement", icon: "draw" }
                                ].map(doc => {
                                    const attached = formData.documents.find(d => d.type === doc.key);
                                    return (
                                        <div
                                            key={doc.key}
                                            className={`p-4 rounded-md border transition-all flex flex-col justify-between ${
                                                attached
                                                    ? "bg-emerald-50/50 border-emerald-200 text-emerald-900 shadow-xs"
                                                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className={`w-8 h-8 rounded-md flex items-center justify-center ${attached ? "bg-emerald-100 text-emerald-700" : "bg-slate-50 text-slate-600 border border-slate-200"}`}>
                                                        <span className="material-symbols-outlined text-lg">{doc.icon}</span>
                                                    </div>
                                                    {attached && (
                                                        <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
                                                    )}
                                                </div>
                                                <h4 className="text-xs font-bold text-slate-900">{doc.label}</h4>
                                                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{doc.desc}</p>
                                            </div>

                                            <div className="mt-4 pt-3 border-t border-slate-100">
                                                {attached ? (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-semibold text-emerald-800 truncate max-w-[130px]" title={attached.name}>
                                                            {attached.name}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setFormData(prev => ({
                                                                ...prev,
                                                                documents: prev.documents.filter(d => d.type !== doc.key)
                                                            }))}
                                                            className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <label className="w-full py-1.5 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-md text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-2xs">
                                                        <span className="material-symbols-outlined text-sm">add_circle</span>
                                                        Attach File
                                                        <input
                                                            type="file"
                                                            className="hidden"
                                                            onChange={e => handleFileUpload(e, doc.key)}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Sticky Bottom Action Footer Bar */}
            <footer className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3.5 px-6 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] mt-8">
                <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
                    {/* Left: Previous / Cancel Navigation */}
                    <div>
                        {activeTab === "general" ? (
                            <button
                                type="button"
                                onClick={() => router.push("/admin/users/agents")}
                                className="px-4 py-2 border border-slate-200 rounded-md text-xs text-slate-600 hover:bg-slate-50 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        ) : activeTab === "partnership" ? (
                            <button
                                type="button"
                                onClick={() => setActiveTab("general")}
                                className="px-4 py-2 border border-slate-200 rounded-md text-xs text-slate-700 hover:bg-slate-50 font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-base">arrow_back</span>
                                Back: Personal & Contact
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setActiveTab("partnership")}
                                className="px-4 py-2 border border-slate-200 rounded-md text-xs text-slate-700 hover:bg-slate-50 font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-base">arrow_back</span>
                                Back: Partnership
                            </button>
                        )}
                    </div>

                    {/* Right: Next / Save / Submit Actions */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            disabled={loading || !formData.email || !formData.firstName}
                            onClick={() => handleSubmit(true)}
                            className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-base">save</span>
                            Save Draft
                        </button>

                        {activeTab === "general" && (
                            <button
                                type="button"
                                onClick={() => setActiveTab("partnership")}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                            >
                                <span>Next: Partnership</span>
                                <span className="material-symbols-outlined text-base">arrow_forward</span>
                            </button>
                        )}

                        {activeTab === "partnership" && (
                            <button
                                type="button"
                                onClick={() => setActiveTab("documents")}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                            >
                                <span>Next: Compliance & KYC</span>
                                <span className="material-symbols-outlined text-base">arrow_forward</span>
                            </button>
                        )}

                        {activeTab === "documents" && (
                            <button
                                type="button"
                                disabled={loading}
                                onClick={() => handleSubmit(false)}
                                className="px-6 py-2 bg-slate-900 hover:bg-indigo-600 text-white rounded-md font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer shadow-sm disabled:opacity-60"
                            >
                                {loading ? (
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-base">check_circle</span>
                                        <span>Submit & Activate</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </footer>
        </div>
    );
}
