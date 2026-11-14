"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { authApi } from "@/lib/api";

export default function DeleteAccountClient() {
    const { user, isAuthenticated, logout } = useAuth();
    const { settings } = useSiteSettings();

    const supportEmail = settings?.supportEmail || "support@vidyaloans.in";
    const phone = settings?.phone || "+91 81437 97779";
    const address = settings?.address || "Jyothi Bose Complex, Bus Stand Road (Opposite to Municipal Office), Nuzvid, Krishna District, Andhra Pradesh 521201, India";

    // Form state for public / web request
    const [email, setEmail] = useState("");
    const [mobile, setMobile] = useState("");
    const [reason, setReason] = useState("Completed or cancelled study abroad plans");
    const [details, setDetails] = useState("");
    const [confirmed, setConfirmed] = useState(false);

    // Submission states
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [referenceId, setReferenceId] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Direct deletion state for authenticated users
    const [showDirectDeleteModal, setShowDirectDeleteModal] = useState(false);
    const [directDeleting, setDirectDeleting] = useState(false);
    const [directDeleted, setDirectDeleted] = useState(false);
    const [directDeleteError, setDirectDeleteError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        const cleanEmail = (email || "").trim().toLowerCase();
        if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            setErrorMessage("Please enter a valid registered email address.");
            return;
        }

        if (!confirmed) {
            setErrorMessage("Please check the confirmation box before submitting your request.");
            return;
        }

        setSubmitting(true);
        try {
            const res: any = await authApi.requestAccountDeletion({
                email: cleanEmail,
                phone: mobile.trim() || undefined,
                reason,
                details: details.trim() || undefined,
            });

            if (res && res.success !== false) {
                const generatedRef = `DEL-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                setReferenceId(generatedRef);
                setSubmitted(true);
            } else {
                setErrorMessage(res?.message || "Failed to submit deletion request. Please try again or email support.");
            }
        } catch (err: any) {
            setErrorMessage(err?.message || "An unexpected error occurred. Please contact privacy@vidyaloans.in directly.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDirectDelete = async () => {
        setDirectDeleting(true);
        setDirectDeleteError(null);
        try {
            const res: any = await authApi.deleteAccount();
            if (res && res.success !== false) {
                setDirectDeleted(true);
                setShowDirectDeleteModal(false);
                setTimeout(() => {
                    logout();
                }, 3000);
            } else {
                setDirectDeleteError(res?.message || "Failed to delete account. Please try again or contact support.");
            }
        } catch (err: any) {
            setDirectDeleteError(err?.message || "Error deleting account. Please contact privacy@vidyaloans.in");
        } finally {
            setDirectDeleting(false);
        }
    };

    return (
        <div
            className="min-h-screen relative text-gray-900 overflow-hidden"
            style={{
                background:
                    "linear-gradient(135deg, #ede0ff 0%, #f3eaff 25%, #fdf6ff 55%, #fef3e8 80%, #fde8c8 100%)",
            }}
        >
            {/* Elegant Background Decorators */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <div
                    className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full blur-[120px] opacity-50"
                    style={{ background: "radial-gradient(circle, #d8b4fe, transparent)" }}
                />
                <div
                    className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-40"
                    style={{ background: "radial-gradient(circle, #fed7aa, transparent)" }}
                />
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage: "radial-gradient(circle, #6605c7 1px, transparent 1px)",
                        backgroundSize: "32px 32px",
                    }}
                />
            </div>

            {/* Hero Header */}
            <section className="pt-32 pb-12 px-6 relative z-10 text-center border-b border-black/5">
                <div className="max-w-4xl mx-auto space-y-4">
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        <span className="inline-block px-3.5 py-1 rounded-full bg-[#6605c7]/10 border border-[#6605c7]/15 text-[#6605c7] text-[11px] font-bold uppercase tracking-widest">
                            Data Safety & Privacy
                        </span>
                        <span className="inline-block px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-[11px] font-bold uppercase tracking-widest">
                            DPDP Act, 2023 Compliant
                        </span>
                        <span className="inline-block px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-700 text-[11px] font-bold uppercase tracking-widest">
                            Google Play Verified URL
                        </span>
                    </div>

                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display tracking-tight text-[#1a1626]">
                        Account & Data Deletion
                    </h1>

                    <p className="text-gray-600 text-[14px] md:text-[15px] font-medium max-w-2xl mx-auto leading-relaxed">
                        In accordance with Google Play Developer Policy and India&apos;s Digital Personal Data Protection
                        Act, 2023 (DPDP Act), you have full control over your account and personal data. Learn what is
                        deleted, what must be retained for statutory compliance, and submit your request below.
                    </p>
                </div>
            </section>

            {/* Main Content Layout */}
            <main className="max-w-6xl mx-auto px-6 py-12 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                    {/* Left Column: Policy Transparency & Statutory Info (7 Cols) */}
                    <div className="lg:col-span-7 space-y-8">

                        {/* Direct Deletion Card for Logged-In User */}
                        {isAuthenticated && user && (
                            <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200 rounded-3xl p-6 md:p-8 shadow-sm">
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-2xl">account_circle</span>
                                    </div>
                                    <div className="space-y-2 flex-1">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <h3 className="text-lg font-bold text-gray-900 font-display">
                                                Active Signed-In Session
                                            </h3>
                                            <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                                In-App Self-Service
                                            </span>
                                        </div>
                                        <p className="text-[13px] text-gray-600 font-medium">
                                            You are currently logged in as <strong className="text-gray-900">{user.email}</strong>.
                                            You can immediately delete your account and personal profile without submitting the external web form.
                                        </p>

                                        {directDeleted ? (
                                            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold animate-fade-in">
                                                ✓ Account deletion initiated. You will be signed out shortly.
                                            </div>
                                        ) : (
                                            <div className="pt-2">
                                                <button
                                                    onClick={() => setShowDirectDeleteModal(true)}
                                                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm shadow-rose-600/20"
                                                >
                                                    Delete My Account Now
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* What Data is Deleted */}
                        <div className="bg-white/70 backdrop-blur-md border border-white/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-purple-100 text-[#6605c7] flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-xl">delete_sweep</span>
                                </div>
                                <h3 className="text-xl font-bold font-display text-gray-900">
                                    1. Data Permanently Deleted
                                </h3>
                            </div>
                            <p className="text-[13.5px] text-gray-600 leading-relaxed font-medium">
                                When your deletion request is verified and executed, VidyaLoans permanently purges the following records from our primary production databases and cloud caches:
                            </p>
                            <ul className="space-y-2.5 text-[13px] text-gray-600 font-medium pl-2">
                                <li className="flex items-start gap-2.5">
                                    <span className="material-symbols-outlined text-emerald-500 text-base mt-0.5 shrink-0">check_circle</span>
                                    <span><strong>Credentials & Auth:</strong> Encrypted passwords, active login sessions, OAuth tokens, and phone OTP logs.</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <span className="material-symbols-outlined text-emerald-500 text-base mt-0.5 shrink-0">check_circle</span>
                                    <span><strong>Personal Profile:</strong> Full name, personal email, phone number, residential address, and date of birth.</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <span className="material-symbols-outlined text-emerald-500 text-base mt-0.5 shrink-0">check_circle</span>
                                    <span><strong>Educational Uploads:</strong> Marksheets, degrees, transcripts, entrance test scores (GRE/GMAT/IELTS), and CVs not bound to disbursed loans.</span>
                                </li>
                                <li className="flex items-start gap-2.5">
                                    <span className="material-symbols-outlined text-emerald-500 text-base mt-0.5 shrink-0">check_circle</span>
                                    <span><strong>Communication & Notes:</strong> In-app chat histories, community mentor requests, and support ticket threads.</span>
                                </li>
                            </ul>
                        </div>

                        {/* What Data is Retained & Statutory Basis */}
                        <div className="bg-white/70 backdrop-blur-md border border-white/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-xl">gavel</span>
                                </div>
                                <h3 className="text-xl font-bold font-display text-gray-900">
                                    2. Data Retained &amp; Statutory Legal Basis
                                </h3>
                            </div>
                            <p className="text-[13.5px] text-gray-600 leading-relaxed font-medium">
                                As a regulated education loan technology partner working alongside RBI-licensed banks and NBFCs, certain information cannot be immediately destroyed due to Indian statutory mandates:
                            </p>
                            <div className="space-y-3 pt-1">
                                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-1 text-[12.5px] text-gray-700 font-medium">
                                    <strong className="text-amber-900 block font-bold">RBI Master Directions &amp; PMLA, 2002:</strong>
                                    For loan applications that reached loan sanction or active fund disbursement, anti-money laundering (AML) and customer identification records must be preserved for <strong>5 to 7 years</strong> in encrypted cold archives.
                                </div>
                                <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200/80 space-y-1 text-[12.5px] text-gray-700 font-medium">
                                    <strong className="text-purple-900 block font-bold">Digital Personal Data Protection Act (DPDP Act, 2023):</strong>
                                    Audit trails of deletion requests (date, time, action taken, and reference token) are maintained for compliance and regulatory inspection to prove lawful processing.
                                </div>
                            </div>
                        </div>

                        {/* Processing Timeline & FAQ */}
                        <div className="bg-white/70 backdrop-blur-md border border-white/80 rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-xl">schedule</span>
                                </div>
                                <h3 className="text-xl font-bold font-display text-gray-900">
                                    3. Timeline &amp; Next Steps
                                </h3>
                            </div>
                            <ul className="space-y-2 text-[13px] text-gray-600 font-medium pl-2">
                                <li>• <strong>Review &amp; Verification:</strong> Within 48 hours, our data privacy team reviews the request against active loan commitments.</li>
                                <li>• <strong>Execution Window:</strong> Total deletion of eligible records completes within <strong>30 calendar days</strong>.</li>
                                <li>• <strong>Final Notification:</strong> A completion receipt is dispatched to your registered email address.</li>
                            </ul>
                        </div>

                    </div>

                    {/* Right Column: Web Deletion Request Form (5 Cols) */}
                    <div className="lg:col-span-5">
                        <div className="bg-white/80 backdrop-blur-xl border border-white/90 rounded-[2.5rem] p-6 md:p-8 shadow-xl sticky top-28 space-y-6">

                            <div>
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#6605c7] block mb-1">
                                    Public Web Portal
                                </span>
                                <h2 className="text-2xl font-bold font-display text-gray-900">
                                    Submit Deletion Request
                                </h2>
                                <p className="text-[12.5px] text-gray-500 font-medium mt-1">
                                    Use this form if you created an account through the Android app, iOS app, or website.
                                </p>
                            </div>

                            {submitted ? (
                                <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-4 animate-fade-in">
                                    <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                                        <span className="material-symbols-outlined text-3xl">task_alt</span>
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-lg font-bold font-display text-emerald-900">
                                            Request Submitted!
                                        </h3>
                                        <p className="text-xs text-emerald-800 font-medium">
                                            Your account deletion ticket has been logged into our privacy queue.
                                        </p>
                                    </div>

                                    <div className="p-3 bg-white rounded-xl border border-emerald-200 text-left space-y-1 font-mono text-xs">
                                        <div className="text-[10px] text-gray-400 uppercase font-sans font-bold">Reference ID</div>
                                        <div className="font-bold text-gray-800">{referenceId}</div>
                                        <div className="text-[10px] text-gray-400 uppercase font-sans font-bold pt-1">Target Account</div>
                                        <div className="text-gray-700">{email}</div>
                                    </div>

                                    <p className="text-[11.5px] text-gray-500 leading-relaxed font-medium">
                                        A confirmation message will be delivered to your registered email address once data sanitation is completed.
                                    </p>

                                    <button
                                        onClick={() => {
                                            setSubmitted(false);
                                            setEmail("");
                                            setMobile("");
                                            setDetails("");
                                            setConfirmed(false);
                                        }}
                                        className="text-xs font-bold text-[#6605c7] hover:underline"
                                    >
                                        Submit another request
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {errorMessage && (
                                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">error</span>
                                            <span>{errorMessage}</span>
                                        </div>
                                    )}

                                    {/* Email */}
                                    <div className="space-y-1.5">
                                        <label htmlFor="del-email" className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                                            Registered Email <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-lg">mail</span>
                                            <input
                                                id="del-email"
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="e.g. student@gmail.com"
                                                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 focus:border-[#6605c7] focus:ring-2 focus:ring-[#6605c7]/10 text-[13px] rounded-xl outline-none transition-all text-gray-900 font-medium shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Phone (Optional) */}
                                    <div className="space-y-1.5">
                                        <label htmlFor="del-phone" className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                                            Registered Mobile (Optional)
                                        </label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-lg">call</span>
                                            <input
                                                id="del-phone"
                                                type="tel"
                                                value={mobile}
                                                onChange={(e) => setMobile(e.target.value)}
                                                placeholder="e.g. +91 98765 43210"
                                                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 focus:border-[#6605c7] focus:ring-2 focus:ring-[#6605c7]/10 text-[13px] rounded-xl outline-none transition-all text-gray-900 font-medium shadow-sm"
                                            />
                                        </div>
                                    </div>

                                    {/* Reason Dropdown */}
                                    <div className="space-y-1.5">
                                        <label htmlFor="del-reason" className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                                            Primary Reason
                                        </label>
                                        <div className="relative">
                                            <select
                                                id="del-reason"
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                                className="w-full px-4 py-3 bg-white border border-gray-200 focus:border-[#6605c7] focus:ring-2 focus:ring-[#6605c7]/10 text-[13px] rounded-xl outline-none transition-all text-gray-900 font-medium appearance-none cursor-pointer shadow-sm"
                                            >
                                                <option value="Completed or cancelled study abroad plans">Completed or cancelled study abroad plans</option>
                                                <option value="Found alternative loan source">Found funding through another source</option>
                                                <option value="Privacy concerns about data storage">Privacy concerns about personal data</option>
                                                <option value="Duplicate or test account">Duplicate or test account</option>
                                                <option value="Too many notifications or emails">Too many notifications or marketing emails</option>
                                                <option value="Other">Other reason</option>
                                            </select>
                                            <span className="material-symbols-outlined text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 text-lg pointer-events-none">expand_more</span>
                                        </div>
                                    </div>

                                    {/* Additional details */}
                                    <div className="space-y-1.5">
                                        <label htmlFor="del-details" className="text-xs font-bold uppercase tracking-wider text-gray-700 block">
                                            Additional Notes (Optional)
                                        </label>
                                        <textarea
                                            id="del-details"
                                            rows={2}
                                            value={details}
                                            onChange={(e) => setDetails(e.target.value)}
                                            placeholder="Provide any application number or specifics..."
                                            className="w-full p-3 bg-white border border-gray-200 focus:border-[#6605c7] focus:ring-2 focus:ring-[#6605c7]/10 text-[13px] rounded-xl outline-none transition-all text-gray-900 font-medium resize-none shadow-sm"
                                        />
                                    </div>

                                    {/* Confirmation Checkbox */}
                                    <div className="pt-1">
                                        <label className="flex items-start gap-3 cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                checked={confirmed}
                                                onChange={(e) => setConfirmed(e.target.checked)}
                                                className="mt-1 h-4 w-4 rounded border-gray-300 text-[#6605c7] focus:ring-[#6605c7] cursor-pointer"
                                            />
                                            <span className="text-[12px] text-gray-600 font-medium leading-relaxed group-hover:text-gray-900 transition-colors">
                                                I understand that deleting my account is permanent and irreversible. Non-statutory data will be purged within 30 days.
                                            </span>
                                        </label>
                                    </div>

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="w-full py-3.5 bg-gradient-to-r from-[#6605c7] to-[#8b24e5] hover:opacity-95 text-white font-extrabold rounded-xl transition-all shadow-lg shadow-[#6605c7]/20 text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {submitting ? (
                                            <>
                                                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                <span>Submitting Request...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Submit Deletion Request</span>
                                                <span className="material-symbols-outlined text-sm">send</span>
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}

                            {/* Privacy officer contact footer */}
                            <div className="pt-4 border-t border-gray-100 space-y-1.5 text-center text-xs text-gray-500 font-medium">
                                <p>
                                    Need assistance with your data? Email our Grievance Desk at{" "}
                                    <a href={`mailto:${supportEmail}`} className="text-[#6605c7] font-bold hover:underline">
                                        {supportEmail}
                                    </a>
                                </p>
                                <p className="text-[11px] text-gray-400">
                                    Office: {address} • Phone: {phone}
                                </p>
                            </div>

                        </div>
                    </div>

                </div>
            </main>

            {/* Direct In-App Deletion Confirmation Modal */}
            {showDirectDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 border border-gray-100">
                        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                            <span className="material-symbols-outlined text-3xl">warning</span>
                        </div>

                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-bold font-display text-gray-900">
                                Are you absolutely sure?
                            </h3>
                            <p className="text-[13px] text-gray-600 leading-relaxed font-medium">
                                This will permanently delete your VidyaLoans account associated with{" "}
                                <strong className="text-gray-900">{user?.email}</strong>. Your profile, credentials, and non-statutory uploads will be immediately purged.
                            </p>
                        </div>

                        {directDeleteError && (
                            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                                {directDeleteError}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                disabled={directDeleting}
                                onClick={() => setShowDirectDeleteModal(false)}
                                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={directDeleting}
                                onClick={handleDirectDelete}
                                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5"
                            >
                                {directDeleting ? (
                                    <>
                                        <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <span>Yes, Delete Account</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
