"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import FastAiUniversityInput from "@/components/FastAiUniversityInput";

const FIELD_LIMITS = {
    universityName: 100,
    courseName: 100,
    firstName: 50,
    lastName: 50,
    coApplicantName: 60,
    phone: 10,
    email: 80,
    minLoanAmount: 50000,
    maxLoanAmount: 100000000, // 10 Crores
    minIncome: 0,
    maxIncome: 500000000, // 50 Crores
    otp: 6,
};

function formatINR(valStr: string): string {
    const val = Number(valStr) || 0;
    if (val >= 10000000) {
        const cr = (val / 10000000).toFixed(2).replace(/\.00$/, "");
        return `₹${val.toLocaleString("en-IN")} (${cr} Cr)`;
    }
    if (val >= 100000) {
        const lk = (val / 100000).toFixed(2).replace(/\.00$/, "");
        return `₹${val.toLocaleString("en-IN")} (${lk} Lakhs)`;
    }
    return `₹${val.toLocaleString("en-IN")}`;
}

export default function ApplyLandingPage() {
    const router = useRouter();
    const { login } = useAuth();
    const { settings: siteSettings } = useSiteSettings();

    // Step state: 1 = Academic Details, 2 = Co-Applicant Details, 3 = User & Verification Details, 4 = Success
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

    // Form fields state
    // Step 1: Academic Details
    const [universityName, setUniversityName] = useState("");
    const [courseName, setCourseName] = useState("");
    const [country, setCountry] = useState("USA");
    const [courseDuration, setCourseDuration] = useState("2");
    const [loanAmount, setLoanAmount] = useState("1500000");
    const [admissionStatus, setAdmissionStatus] = useState("Applied");

    // Step 2: Co-Applicant Details
    const [hasCoApplicant, setHasCoApplicant] = useState(true);
    const [coApplicantName, setCoApplicantName] = useState("");
    const [coApplicantRelation, setCoApplicantRelation] = useState("Father");
    const [coApplicantPhone, setCoApplicantPhone] = useState("");
    const [coApplicantEmail, setCoApplicantEmail] = useState("");
    const [coApplicantIncome, setCoApplicantIncome] = useState("600000");

    // Step 3: Applicant Personal & Verification
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");

    // UI state
    const [otpSent, setOtpSent] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const [successData, setSuccessData] = useState<{
        applicationNumber: string;
        userEmail: string;
        amount: string;
        university: string;
    } | null>(null);

    // Resend countdown timer
    const [timer, setTimer] = useState(0);

    useEffect(() => {
        let interval: any = null;
        if (timer > 0) {
            interval = setInterval(() => setTimer((t) => t - 1), 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [timer]);

    // Validation handlers
    const validateStep1 = () => {
        setErrorMessage("");
        if (!universityName.trim()) {
            setErrorMessage("Please enter your target College/University name.");
            return false;
        }
        if (!courseName.trim()) {
            setErrorMessage("Please enter your Course or Degree name.");
            return false;
        }
        const parsedAmt = parseFloat(loanAmount);
        if (!loanAmount || isNaN(parsedAmt) || parsedAmt < FIELD_LIMITS.minLoanAmount) {
            setErrorMessage(`Please enter a valid loan amount (Minimum ${formatINR(String(FIELD_LIMITS.minLoanAmount))}).`);
            return false;
        }
        if (parsedAmt > FIELD_LIMITS.maxLoanAmount) {
            setErrorMessage(`Loan amount cannot exceed ${formatINR(String(FIELD_LIMITS.maxLoanAmount))}.`);
            return false;
        }
        return true;
    };

    const validateStep2 = () => {
        setErrorMessage("");
        if (hasCoApplicant) {
            if (!coApplicantName.trim()) {
                setErrorMessage("Please enter your Co-Applicant's full name.");
                return false;
            }
            const cleanPhone = coApplicantPhone.replace(/\D/g, "");
            if (!cleanPhone || cleanPhone.length !== 10) {
                setErrorMessage("Please enter a valid 10-digit mobile number for co-applicant.");
                return false;
            }
        }
        return true;
    };

    const handleSendOtp = async () => {
        setErrorMessage("");
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes("@")) {
            setErrorMessage("Please enter a valid email address.");
            return;
        }

        if (!firstName.trim() || !lastName.trim()) {
            setErrorMessage("Please enter your first and last name.");
            return;
        }

        const cleanPhone = phoneNumber.replace(/\D/g, "");
        if (!cleanPhone || cleanPhone.length !== 10) {
            setErrorMessage("Please enter a valid 10-digit mobile phone number.");
            return;
        }

        setSendingOtp(true);
        try {
            const res = (await authApi.sendOtp(email.trim())) as any;
            if (res.success) {
                setOtpSent(true);
                setTimer(60);
            } else {
                setErrorMessage(res.message || "Failed to send verification code.");
            }
        } catch (err: any) {
            setErrorMessage(err.message || "Error sending OTP code. Please try again.");
        } finally {
            setSendingOtp(false);
        }
    };

    const handleSubmitApplication = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage("");

        if (!otpSent) {
            setErrorMessage("Please click 'Send Verification Code' first to verify your email.");
            return;
        }
        if (!otp || otp.trim().length !== 6) {
            setErrorMessage("Please enter the 6-digit verification code sent to your email.");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                email: email.trim().toLowerCase(),
                otp: otp.trim(),
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phoneNumber: phoneNumber.trim(),
                dateOfBirth: dateOfBirth ? dateOfBirth.trim() : undefined,
                universityName: universityName.trim(),
                courseName: courseName.trim(),
                country,
                courseDuration,
                loanAmount: parseFloat(loanAmount),
                admissionStatus,
                hasCoApplicant,
                coApplicantName: hasCoApplicant ? coApplicantName.trim() : undefined,
                coApplicantRelation: hasCoApplicant ? coApplicantRelation : undefined,
                coApplicantPhone: hasCoApplicant ? coApplicantPhone.trim() : undefined,
                coApplicantEmail: hasCoApplicant ? coApplicantEmail.trim() : undefined,
                coApplicantIncome: hasCoApplicant ? parseFloat(coApplicantIncome || "0") : 0,
            };

            const res = (await authApi.submitLandingPageApplication(payload)) as any;

            if (res && res.success) {
                // Set tokens and log user in locally
                if (res.access_token && res.user) {
                    try {
                        localStorage.setItem("accessToken", res.access_token);
                        if (res.refresh_token) localStorage.setItem("refreshToken", res.refresh_token);
                        localStorage.setItem("userEmail", res.user.email);
                        localStorage.setItem("userId", res.user.id);
                        localStorage.setItem("authUser", JSON.stringify(res.user));
                        localStorage.setItem(
                            "recent_application_submitted",
                            JSON.stringify({
                                userId: res.user.id,
                                email: res.user.email,
                                timestamp: Date.now(),
                                applicationNumber: res.applicationNumber || res.applicationId,
                            })
                        );
                    } catch (e) { }
                }

                setSuccessData({
                    applicationNumber: res.applicationNumber || res.applicationId || "VDL-" + Math.floor(100000 + Math.random() * 900000),
                    userEmail: email,
                    amount: loanAmount,
                    university: universityName,
                });

                setStep(4);
            } else {
                setErrorMessage(res?.message || "Verification failed. Please check your OTP.");
            }
        } catch (err: any) {
            console.error("Landing page submit error:", err);
            setErrorMessage(err.message || "Failed to submit loan application. Please check your verification code.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-purple-500 selection:text-white pb-20">
            {/* Header with VidyaLoans Logo */}
            <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-purple-100 shadow-xs px-4 lg:px-8 py-3.5 flex justify-between items-center">
                <Link href="/" className="flex items-center gap-2.5 group">
                    <Image
                        src={siteSettings?.logoLightUrl || "/images/vidyaloans-logo-transparent.png"}
                        alt={`${siteSettings?.siteName || "VidyaLoans"} Logo`}
                        width={42}
                        height={42}
                        className="w-10 h-10 object-contain drop-shadow-xs group-hover:scale-105 transition-transform"
                        priority
                    />
                    <span className="font-extrabold text-2xl tracking-tight text-[#1a1626] font-display">
                        {siteSettings?.siteName || "VidyaLoans"}
                    </span>
                </Link>

                <div className="hidden sm:flex items-center gap-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
                        <span className="material-symbols-outlined text-base">verified_user</span>
                        <span>Official Partner Banks Connected</span>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="bg-gradient-to-br from-[#190f23] via-[#310c59] to-[#6605c7] text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>
                <div className="max-w-4xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-purple-200 text-xs font-semibold uppercase tracking-wider mb-4 backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        Fastest Education Loan Approvals
                    </div>
                    <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-4 font-display">
                        Apply for Your Overseas Education Loan in Minutes
                    </h1>
                    <p className="text-sm sm:text-lg text-purple-100/90 max-w-2xl mx-auto font-medium">
                        Instant pre-approval with leading public & private banks. No collateral options, competitive interest rates, and dedicated staff support.
                    </p>
                </div>
            </section>

            {/* Main Application Container */}
            <main className="max-w-3xl mx-auto px-4 sm:px-6 -mt-8 relative z-20">
                <div className="bg-white rounded-3xl shadow-xl border border-purple-100 overflow-hidden">

                    {/* Step Indicator Header (Steps 1 to 3) */}
                    {step < 4 && (
                        <div className="bg-slate-50/80 border-b border-slate-100 p-4 sm:p-6">
                            <div className="flex items-center justify-between max-w-md mx-auto">
                                {/* Step 1 Button */}
                                <div className="flex flex-col items-center gap-1.5 flex-1">
                                    <div
                                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${step === 1
                                                ? "bg-[#6605c7] text-white ring-4 ring-purple-100 shadow-md"
                                                : step > 1
                                                    ? "bg-emerald-500 text-white"
                                                    : "bg-slate-200 text-slate-500"
                                            }`}
                                    >
                                        {step > 1 ? <span className="material-symbols-outlined text-lg">check</span> : "1"}
                                    </div>
                                    <span className={`text-[11px] font-bold tracking-tight ${step === 1 ? "text-[#6605c7]" : "text-slate-500"}`}>
                                        Academic Details
                                    </span>
                                </div>

                                <div className={`h-0.5 flex-1 -mt-4 transition-colors ${step > 1 ? "bg-emerald-500" : "bg-slate-200"}`}></div>

                                {/* Step 2 Button */}
                                <div className="flex flex-col items-center gap-1.5 flex-1">
                                    <div
                                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${step === 2
                                                ? "bg-[#6605c7] text-white ring-4 ring-purple-100 shadow-md"
                                                : step > 2
                                                    ? "bg-emerald-500 text-white"
                                                    : "bg-slate-200 text-slate-500"
                                            }`}
                                    >
                                        {step > 2 ? <span className="material-symbols-outlined text-lg">check</span> : "2"}
                                    </div>
                                    <span className={`text-[11px] font-bold tracking-tight ${step === 2 ? "text-[#6605c7]" : "text-slate-500"}`}>
                                        Co-Applicant
                                    </span>
                                </div>

                                <div className={`h-0.5 flex-1 -mt-4 transition-colors ${step > 2 ? "bg-emerald-500" : "bg-slate-200"}`}></div>

                                {/* Step 3 Button */}
                                <div className="flex flex-col items-center gap-1.5 flex-1">
                                    <div
                                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all ${step === 3
                                                ? "bg-[#6605c7] text-white ring-4 ring-purple-100 shadow-md"
                                                : "bg-slate-200 text-slate-500"
                                            }`}
                                    >
                                        3
                                    </div>
                                    <span className={`text-[11px] font-bold tracking-tight ${step === 3 ? "text-[#6605c7]" : "text-slate-500"}`}>
                                        Verify & Submit
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error Banner */}
                    {errorMessage && (
                        <div className="mx-6 mt-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-3 animate-in fade-in">
                            <span className="material-symbols-outlined text-lg text-rose-500 flex-shrink-0">error</span>
                            <div className="flex-1">{errorMessage}</div>
                        </div>
                    )}

                    {/* Form Body */}
                    <div className="p-6 sm:p-8">

                        {/* STEP 1: Academic Details */}
                        {step === 1 && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#6605c7]">school</span>
                                        University & Academic Details
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">
                                        Tell us where you are planning to study to customize your loan options.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    {/* University Name */}
                                    <div className="sm:col-span-2">
                                        <FastAiUniversityInput
                                            value={universityName}
                                            onChange={(v) => setUniversityName(v)}
                                            country={country}
                                            onCountryChange={(detectedCountry) => setCountry(detectedCountry)}
                                            label="Target College / University Name"
                                            placeholder="e.g. Harvard, MIT, Oxford, University of Toronto..."
                                            required
                                        />
                                    </div>

                                    {/* Course Name */}
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                                                Course / Degree Name <span className="text-rose-500">*</span>
                                            </label>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {courseName.length}/{FIELD_LIMITS.courseName}
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            maxLength={FIELD_LIMITS.courseName}
                                            value={courseName}
                                            onChange={(e) => setCourseName(e.target.value)}
                                            placeholder="e.g. MS in Computer Science, MBA"
                                            className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 outline-none transition-all font-medium"
                                        />
                                    </div>

                                    {/* Country */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                            Destination Country
                                        </label>
                                        <select
                                            value={country}
                                            onChange={(e) => setCountry(e.target.value)}
                                            className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 outline-none transition-all font-medium bg-white"
                                        >
                                            <option value="USA">USA</option>
                                            <option value="UK">United Kingdom</option>
                                            <option value="Canada">Canada</option>
                                            <option value="Australia">Australia</option>
                                            <option value="Germany">Germany</option>
                                            <option value="Ireland">Ireland</option>
                                            <option value="India">India</option>
                                            <option value="Other">Other Country</option>
                                        </select>
                                    </div>

                                    {/* Course Duration */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                            Course Duration (Years)
                                        </label>
                                        <select
                                            value={courseDuration}
                                            onChange={(e) => setCourseDuration(e.target.value)}
                                            className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 outline-none transition-all font-medium bg-white"
                                        >
                                            <option value="1">1 Year</option>
                                            <option value="2">2 Years</option>
                                            <option value="3">3 Years</option>
                                            <option value="4">4 Years</option>
                                            <option value="5">5 Years</option>
                                        </select>
                                    </div>

                                    {/* Required Loan Amount */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                            Loan Amount Needed (₹ INR) <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            min={FIELD_LIMITS.minLoanAmount}
                                            max={FIELD_LIMITS.maxLoanAmount}
                                            step={50000}
                                            required
                                            value={loanAmount}
                                            onChange={(e) => setLoanAmount(e.target.value)}
                                            placeholder="e.g. 2000000"
                                            className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 outline-none transition-all font-medium"
                                        />
                                        {formatINR(loanAmount) && (
                                            <p className="text-[11px] font-extrabold text-[#6605c7] mt-1">
                                                Amount: {formatINR(loanAmount)}
                                            </p>
                                        )}
                                    </div>

                                    {/* Admission Status */}
                                    <div className="sm:col-span-2">
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                            Admission Status
                                        </label>
                                        <div className="grid grid-cols-3 gap-3">
                                            {["Admitted", "Applied", "Preparing"].map((status) => (
                                                <button
                                                    key={status}
                                                    type="button"
                                                    onClick={() => setAdmissionStatus(status)}
                                                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${admissionStatus === status
                                                            ? "border-[#6605c7] bg-purple-50 text-[#6605c7] shadow-xs"
                                                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                                        }`}
                                                >
                                                    {status === "Admitted" ? "Got Admit Letter" : status === "Applied" ? "Application Sent" : "Planning to Apply"}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (validateStep1()) setStep(2);
                                        }}
                                        className="w-full sm:w-auto px-8 py-3.5 bg-[#6605c7] hover:bg-[#5204a2] text-white font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <span>Next: Co-Applicant Details</span>
                                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: Co-Applicant Details */}
                        {step === 2 && (
                            <div className="space-y-6 animate-in fade-in duration-300">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#6605c7]">family_restroom</span>
                                        Co-Applicant Details
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">
                                        Banks require a co-applicant (Parent / Guardian / Spouse) for education loan processing.
                                    </p>
                                </div>

                                {/* Co-Applicant Toggle */}
                                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Do you have a Co-Applicant?</p>
                                        <p className="text-[11px] text-slate-500 font-medium">Father, Mother, Spouse, or Legal Guardian</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setHasCoApplicant(!hasCoApplicant)}
                                        className={`w-12 h-7 flex items-center rounded-full p-1 transition-colors cursor-pointer ${hasCoApplicant ? "bg-[#6605c7]" : "bg-slate-300"}`}
                                    >
                                        <div
                                            className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${hasCoApplicant ? "translate-x-5" : "translate-x-0"}`}
                                        />
                                    </button>
                                </div>

                                {hasCoApplicant && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
                                        {/* Co-Applicant Name */}
                                        <div className="sm:col-span-2">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                                                    Co-Applicant Full Name <span className="text-rose-500">*</span>
                                                </label>
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {coApplicantName.length}/{FIELD_LIMITS.coApplicantName}
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                maxLength={FIELD_LIMITS.coApplicantName}
                                                value={coApplicantName}
                                                onChange={(e) => setCoApplicantName(e.target.value)}
                                                placeholder="e.g. Ramesh Kumar"
                                                className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 outline-none transition-all font-medium"
                                            />
                                        </div>

                                        {/* Relationship */}
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                                Relationship
                                            </label>
                                            <select
                                                value={coApplicantRelation}
                                                onChange={(e) => setCoApplicantRelation(e.target.value)}
                                                className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 outline-none transition-all font-medium bg-white"
                                            >
                                                <option value="Father">Father</option>
                                                <option value="Mother">Mother</option>
                                                <option value="Spouse">Spouse</option>
                                                <option value="Brother">Brother</option>
                                                <option value="Sister">Sister</option>
                                                <option value="Guardian">Guardian</option>
                                            </select>
                                        </div>

                                        {/* Co-Applicant Mobile */}
                                        <div>
                                            <div className="flex justify-between items-center mb-1.5">
                                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                                                    Co-Applicant Mobile Number <span className="text-rose-500">*</span>
                                                </label>
                                                <span className="text-[10px] font-bold text-slate-400">
                                                    {coApplicantPhone.length}/{FIELD_LIMITS.phone}
                                                </span>
                                            </div>
                                            <input
                                                type="tel"
                                                required
                                                maxLength={FIELD_LIMITS.phone}
                                                value={coApplicantPhone}
                                                onChange={(e) => setCoApplicantPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                                placeholder="10-digit mobile number"
                                                className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 outline-none transition-all font-medium"
                                            />
                                        </div>

                                        {/* Co-Applicant Email */}
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                                Co-Applicant Email Address (Optional)
                                            </label>
                                            <input
                                                type="email"
                                                maxLength={FIELD_LIMITS.email}
                                                value={coApplicantEmail}
                                                onChange={(e) => setCoApplicantEmail(e.target.value.trim().toLowerCase())}
                                                placeholder="coapplicant@example.com"
                                                className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 outline-none transition-all font-medium"
                                            />
                                        </div>

                                        {/* Annual Income */}
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                                Approx. Annual Income (₹ INR)
                                            </label>
                                            <input
                                                type="number"
                                                min={FIELD_LIMITS.minIncome}
                                                max={FIELD_LIMITS.maxIncome}
                                                step={50000}
                                                value={coApplicantIncome}
                                                onChange={(e) => setCoApplicantIncome(e.target.value)}
                                                placeholder="e.g. 600000"
                                                className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 outline-none transition-all font-medium"
                                            />
                                            {formatINR(coApplicantIncome) && (
                                                <p className="text-[11px] font-extrabold text-[#6605c7] mt-1">
                                                    Income: {formatINR(coApplicantIncome)}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="pt-4 flex items-center justify-between gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (validateStep2()) setStep(3);
                                        }}
                                        className="px-8 py-3.5 bg-[#6605c7] hover:bg-[#5204a2] text-white font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all flex items-center gap-2 cursor-pointer"
                                    >
                                        <span>Next: Verify & Submit</span>
                                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: User Details & Email Verification */}
                        {step === 3 && (
                            <form onSubmit={handleSubmitApplication} className="space-y-6 animate-in fade-in duration-300">
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#6605c7]">mark_email_read</span>
                                        Student Details & Email Verification
                                    </h2>
                                    <p className="text-xs text-slate-500 mt-1 font-medium">
                                        Verify your email address to submit your loan application and save your profile in our system.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    {/* First Name */}
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                                                First Name <span className="text-rose-500">*</span>
                                            </label>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {firstName.length}/{FIELD_LIMITS.firstName}
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            maxLength={FIELD_LIMITS.firstName}
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value.replace(/[^a-zA-Z\s]/g, "").slice(0, FIELD_LIMITS.firstName))}
                                            placeholder="Your First Name"
                                            className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 outline-none transition-all font-medium"
                                        />
                                    </div>

                                    {/* Last Name */}
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                                                Last Name <span className="text-rose-500">*</span>
                                            </label>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {lastName.length}/{FIELD_LIMITS.lastName}
                                            </span>
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            maxLength={FIELD_LIMITS.lastName}
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value.replace(/[^a-zA-Z\s]/g, "").slice(0, FIELD_LIMITS.lastName))}
                                            placeholder="Your Last Name"
                                            className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 outline-none transition-all font-medium"
                                        />
                                    </div>

                                    {/* Phone Number */}
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                                                Mobile Phone Number <span className="text-rose-500">*</span>
                                            </label>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {phoneNumber.length}/{FIELD_LIMITS.phone}
                                            </span>
                                        </div>
                                        <input
                                            type="tel"
                                            required
                                            maxLength={FIELD_LIMITS.phone}
                                            value={phoneNumber}
                                            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                            placeholder="10-digit mobile number"
                                            className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 outline-none transition-all font-medium"
                                        />
                                    </div>

                                    {/* Date of Birth */}
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                            Date of Birth (DD-MM-YYYY)
                                        </label>
                                        <input
                                            type="text"
                                            maxLength={10}
                                            value={dateOfBirth}
                                            onChange={(e) => setDateOfBirth(e.target.value)}
                                            placeholder="15-08-2000"
                                            className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 outline-none transition-all font-medium"
                                        />
                                    </div>

                                    {/* Email Address & Verification Button */}
                                    <div className="sm:col-span-2">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                                                Email Address <span className="text-rose-500">*</span>
                                            </label>
                                            <span className="text-[10px] font-bold text-slate-400">
                                                {email.length}/{FIELD_LIMITS.email}
                                            </span>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <input
                                                type="email"
                                                required
                                                disabled={otpSent}
                                                maxLength={FIELD_LIMITS.email}
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
                                                placeholder="student@example.com"
                                                className="flex-1 px-4 py-3 text-sm rounded-xl border border-slate-200 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 outline-none transition-all font-medium disabled:bg-slate-100"
                                            />
                                            <button
                                                type="button"
                                                disabled={sendingOtp || timer > 0}
                                                onClick={handleSendOtp}
                                                className="px-5 py-3 bg-[#6605c7] hover:bg-[#5204a2] disabled:bg-slate-300 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                                            >
                                                {sendingOtp ? (
                                                    <span>Sending Code...</span>
                                                ) : timer > 0 ? (
                                                    <span>Resend in {timer}s</span>
                                                ) : otpSent ? (
                                                    <span>Resend OTP Code</span>
                                                ) : (
                                                    <span>Send Verification Code</span>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* OTP Input Field */}
                                    {otpSent && (
                                        <div className="sm:col-span-2 p-4 rounded-2xl bg-purple-50/70 border border-purple-200 animate-in fade-in">
                                            <label className="block text-xs font-bold uppercase tracking-wider text-[#6605c7] mb-1.5">
                                                Enter 6-Digit Email Verification Code <span className="text-rose-500">*</span>
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    required
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                                                    placeholder="123456"
                                                    className="w-48 px-4 py-3 text-center text-lg tracking-widest font-mono font-bold rounded-xl border border-purple-300 focus:border-[#6605c7] focus:ring-2 focus:ring-purple-200 outline-none bg-white"
                                                />
                                                <span className="text-xs text-slate-500 font-medium">
                                                    Check inbox / spam folder for code sent to <strong>{email}</strong>
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 flex items-center justify-between gap-4 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setStep(2)}
                                        className="px-6 py-3 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-8 py-3.5 bg-gradient-to-r from-[#6605c7] via-purple-600 to-pink-600 hover:opacity-95 text-white font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                    >
                                        {submitting ? (
                                            <>
                                                <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                                                <span>Submitting Application...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="material-symbols-outlined text-lg">verified</span>
                                                <span>Verify Email & Submit Loan</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* STEP 4: Success Screen State */}
                        {step === 4 && successData && (
                            <div className="py-8 text-center space-y-6 animate-in zoom-in-95 duration-300">
                                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                    <span className="material-symbols-outlined text-5xl">task_alt</span>
                                </div>

                                <div>
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-extrabold uppercase rounded-full tracking-wider mb-2">
                                        Application Submitted & Verified
                                    </div>
                                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-display">
                                        Congratulations, Application Received!
                                    </h2>
                                    <p className="text-sm text-slate-600 max-w-md mx-auto mt-2 font-medium">
                                        Your loan application has been created, verified, and sent directly to our dedicated loan specialists.
                                    </p>
                                </div>

                                {/* Application Card Box */}
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 max-w-md mx-auto text-left space-y-3">
                                    <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                                        <span className="text-xs font-bold uppercase text-slate-500">Application Reference</span>
                                        <span className="text-sm font-extrabold text-[#6605c7] font-mono">{successData.applicationNumber}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500 font-medium">Applicant Email</span>
                                        <span className="font-bold text-slate-900">{successData.userEmail}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500 font-medium">Target Institution</span>
                                        <span className="font-bold text-slate-900">{successData.university}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-slate-500 font-medium">Requested Loan Amount</span>
                                        <span className="font-extrabold text-emerald-700">₹{parseFloat(successData.amount).toLocaleString('en-IN')}</span>
                                    </div>
                                </div>

                                <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl max-w-md mx-auto text-left flex items-start gap-3">
                                    <span className="material-symbols-outlined text-[#6605c7] text-xl mt-0.5">support_agent</span>
                                    <p className="text-xs text-purple-950 font-medium leading-relaxed">
                                        <strong>What happens next?</strong> A dedicated VidyaLoans officer has been assigned to your case and will contact you via Phone/WhatsApp within 2 hours to process your bank approval.
                                    </p>
                                </div>

                                <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
                                    <Link
                                        href="/dashboard"
                                        className="px-8 py-3.5 bg-[#6605c7] hover:bg-[#5204a2] text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all"
                                    >
                                        Go to Student Dashboard
                                    </Link>
                                    <Link
                                        href="/"
                                        className="px-6 py-3.5 border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                                    >
                                        Return Home
                                    </Link>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </main>

            {/* Features & Trust Badges */}
            <section className="max-w-5xl mx-auto px-4 mt-16">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
                        <div className="w-12 h-12 rounded-xl bg-purple-50 text-[#6605c7] flex items-center justify-center mx-auto mb-3">
                            <span className="material-symbols-outlined text-2xl">bolt</span>
                        </div>
                        <h3 className="font-extrabold text-sm text-slate-900 mb-1">Instant Pre-Approval</h3>
                        <p className="text-xs text-slate-500 font-medium">Get conditional offer letters from top banks in under 24 hours.</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                            <span className="material-symbols-outlined text-2xl">percent</span>
                        </div>
                        <h3 className="font-extrabold text-sm text-slate-900 mb-1">Lowest Interest Rates</h3>
                        <p className="text-xs text-slate-500 font-medium">Compare options starting from 9.5% p.a. with zero hidden fees.</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-xs">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                            <span className="material-symbols-outlined text-2xl">lock</span>
                        </div>
                        <h3 className="font-extrabold text-sm text-slate-900 mb-1">100% Encrypted & Safe</h3>
                        <p className="text-xs text-slate-500 font-medium">Your personal & academic data is protected under RBI compliance rules.</p>
                    </div>
                </div>
            </section>
        </div>
    );
}
