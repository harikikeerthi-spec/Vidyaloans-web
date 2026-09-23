"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminApi, referenceApi } from "@/lib/api";
import { formatPhone, isPhoneValid } from "@/lib/validation";

export default function CreateBankOfficerPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [banksLoading, setBanksLoading] = useState(false);
    const [bankPartners, setBankPartners] = useState<any[]>([]);

    // Validation state matching staff and agent creation
    const [errors, setErrors] = useState<{
        firstName?: string;
        lastName?: string;
        email?: string;
        mobile?: string;
        bank?: string;
    }>({});
    const [touched, setTouched] = useState<{
        firstName?: boolean;
        lastName?: boolean;
        email?: boolean;
        mobile?: boolean;
        bank?: boolean;
    }>({});

    // Form state
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        mobile: "",
        bank: "",
        designation: "Underwriting Officer",
        officeLocation: "",
        employeeId: "",
    });

    // Load available bank partners
    const loadBankPartners = async () => {
        setBanksLoading(true);
        try {
            const res: any = await referenceApi.getBanks().catch(() => ({ data: [] }));
            if (res && Array.isArray(res.data)) {
                setBankPartners(res.data);
            } else if (Array.isArray(res)) {
                setBankPartners(res);
            }
        } catch (e) {
            console.error("Error loading bank partners:", e);
        } finally {
            setBanksLoading(false);
        }
    };

    useEffect(() => {
        loadBankPartners();
    }, []);

    // Validation helpers
    const isValidEmail = (email: string) => {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(email.trim()) && email.trim().length <= 100;
    };

    const validateEmailField = (email: string): string => {
        const trimmed = email.trim();
        if (!trimmed) return "Login email address is required.";
        if (/\s/.test(trimmed)) return "Email address cannot contain spaces.";
        if (!isValidEmail(trimmed)) return "Please enter a valid email address (e.g. officer@bankpartner.com).";
        return "";
    };

    const validatePhoneField = (phone: string): string => {
        const clean = phone.replace(/\D/g, "");
        if (!clean) return "Mobile number is required.";
        if (clean.length > 0 && clean[0] < "6") {
            return "Indian mobile numbers must start with 6, 7, 8, or 9.";
        }
        if (clean.length !== 10) {
            return `Mobile number must be exactly 10 digits (${clean.length}/10 entered).`;
        }
        if (!isPhoneValid(clean)) {
            return "Please enter a valid, realistic Indian mobile number.";
        }
        return "";
    };

    const handlePhoneChange = (raw: string) => {
        let val = raw;
        if (val.startsWith("+91")) {
            val = val.slice(3);
        } else if (val.startsWith("+")) {
            val = val.slice(1);
        }
        let digits = val.replace(/\D/g, "");
        if (digits.length === 12 && digits.startsWith("91")) {
            digits = digits.slice(2);
        } else if (digits.length === 11 && digits.startsWith("0")) {
            digits = digits.slice(1);
        }
        digits = formatPhone(digits);

        setFormData(prev => ({ ...prev, mobile: digits }));

        if (touched.mobile || digits.length === 10) {
            setErrors(prev => ({ ...prev, mobile: validatePhoneField(digits) }));
        } else if (errors.mobile) {
            setErrors(prev => ({ ...prev, mobile: undefined }));
        }
    };

    const handleEmailChange = (val: string) => {
        setFormData(prev => ({ ...prev, email: val }));
        if (touched.email) {
            setErrors(prev => ({ ...prev, email: validateEmailField(val) }));
        } else if (errors.email) {
            setErrors(prev => ({ ...prev, email: undefined }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: typeof errors = {};

        if (!formData.firstName.trim()) {
            newErrors.firstName = "First name is required.";
        }
        if (!formData.lastName.trim()) {
            newErrors.lastName = "Last name is required.";
        }

        const emailErr = validateEmailField(formData.email);
        if (emailErr) {
            newErrors.email = emailErr;
        }

        const phoneErr = validatePhoneField(formData.mobile);
        if (phoneErr) {
            newErrors.mobile = phoneErr;
        }

        if (!formData.bank) {
            newErrors.bank = "Please select an assigned lending bank partner.";
        }

        setErrors(newErrors);
        setTouched({
            firstName: true,
            lastName: true,
            email: true,
            mobile: true,
            bank: true,
        });

        if (Object.keys(newErrors).length > 0) {
            const firstKey = Object.keys(newErrors)[0];
            const targetId =
                firstKey === "firstName" ? "bank-officer-first-name" :
                firstKey === "lastName" ? "bank-officer-last-name" :
                firstKey === "email" ? "bank-officer-email" :
                firstKey === "mobile" ? "bank-officer-mobile" : "bank-officer-partner";
            document.getElementById(targetId)?.focus();
            return;
        }

        setLoading(true);
        try {
            const cleanDigits = formData.mobile.replace(/\D/g, "");
            const formattedMobile = `+91 ${cleanDigits}`;

            const payload = {
                role: "bank",
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim().toLowerCase(),
                mobile: formattedMobile,
                bank: formData.bank,
                designation: formData.designation.trim() || "Underwriting Officer",
                officeLocation: formData.officeLocation.trim() || undefined,
                employeeId: formData.employeeId.trim() || undefined,
            };

            const res: any = await adminApi.createUser(payload);

            if (res.success && (res.user?.id || res.user)) {
                alert(`Bank Officer profile created successfully for ${formData.firstName} ${formData.lastName}! Welcome invitation sent to: ${formData.email.toLowerCase()}`);
                router.push("/admin/users/banks");
            } else {
                const errMsg = res.error || res.message || "Unknown error";
                alert("Failed to create bank officer profile: " + errMsg);
            }
        } catch (err: any) {
            console.error("Bank officer creation failed:", err);
            alert("Error creating bank officer profile: " + (err.message || err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-800 pb-28 font-sans flex flex-col">
            {/* Top Navigation Bar */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.push("/admin/users/banks")}
                            className="w-9 h-9 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Back to Bank Officers"
                        >
                            <span className="material-symbols-outlined text-lg">arrow_back</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                                <Link href="/admin/dashboard" className="hover:text-indigo-600 transition-colors">Admin</Link>
                                <span>/</span>
                                <Link href="/admin/users/banks" className="hover:text-indigo-600 transition-colors">Bank Officers</Link>
                                <span>/</span>
                                <span className="text-slate-600">New Officer</span>
                            </div>
                            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
                                <span className="material-symbols-outlined text-emerald-600 text-[22px]">account_balance</span>
                                Create Bank Officer Profile
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => router.push("/admin/users/banks")}
                            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-transparent transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-md text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin text-sm">⏳</span>
                                    <span>Creating Officer Profile...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                                    <span>Create Bank Officer Profile</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Form Content */}
            <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 flex-1 w-full">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Card 1: Basic Identity & Portal Authentication */}
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-xs">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                                    1
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-slate-900">Identity & Portal Authentication</h2>
                                    <p className="text-[12px] text-slate-500">Legal name and login credentials used by the bank representative to access the lender portal.</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wider">
                                Mandatory
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="bank-officer-first-name" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                    First Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    id="bank-officer-first-name"
                                    type="text"
                                    value={formData.firstName}
                                    onChange={e => {
                                        setFormData({ ...formData, firstName: e.target.value });
                                        if (errors.firstName) setErrors(prev => ({ ...prev, firstName: undefined }));
                                    }}
                                    placeholder="E.g. Hari"
                                    className={`w-full px-3.5 py-2.5 bg-white border rounded-md text-sm font-medium text-slate-900 focus:outline-none transition-all placeholder:text-slate-400 ${
                                        errors.firstName
                                            ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                            : "border-[#E2E8F0] focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                    }`}
                                />
                                {errors.firstName && (
                                    <p className="text-[11px] font-medium text-rose-600 mt-1.5 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">error</span>
                                        {errors.firstName}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="bank-officer-last-name" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                    Last Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    id="bank-officer-last-name"
                                    type="text"
                                    value={formData.lastName}
                                    onChange={e => {
                                        setFormData({ ...formData, lastName: e.target.value });
                                        if (errors.lastName) setErrors(prev => ({ ...prev, lastName: undefined }));
                                    }}
                                    placeholder="E.g. Kalyan"
                                    className={`w-full px-3.5 py-2.5 bg-white border rounded-md text-sm font-medium text-slate-900 focus:outline-none transition-all placeholder:text-slate-400 ${
                                        errors.lastName
                                            ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                            : "border-[#E2E8F0] focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                    }`}
                                />
                                {errors.lastName && (
                                    <p className="text-[11px] font-medium text-rose-600 mt-1.5 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">error</span>
                                        {errors.lastName}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="bank-officer-email" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                    Login Email Address <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        id="bank-officer-email"
                                        type="email"
                                        value={formData.email}
                                        onChange={e => handleEmailChange(e.target.value)}
                                        onBlur={() => {
                                            setTouched(prev => ({ ...prev, email: true }));
                                            setErrors(prev => ({ ...prev, email: validateEmailField(formData.email) }));
                                        }}
                                        placeholder="officer@bankpartner.com"
                                        className={`w-full px-3.5 py-2.5 bg-white border rounded-md text-sm font-medium text-slate-900 focus:outline-none transition-all placeholder:text-slate-400 ${
                                            errors.email
                                                ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 pr-10"
                                                : formData.email && isValidEmail(formData.email)
                                                ? "border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 pr-10"
                                                : "border-[#E2E8F0] focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                        }`}
                                    />
                                    {formData.email && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
                                            {errors.email ? (
                                                <span className="material-symbols-outlined text-rose-500 text-lg">error</span>
                                            ) : isValidEmail(formData.email) ? (
                                                <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                                {errors.email ? (
                                    <p className="text-[11px] font-medium text-rose-600 mt-1.5 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">error</span>
                                        {errors.email}
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Used strictly for authentication and logging in to the Bank Partner Underwriting Portal.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="bank-officer-mobile" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                    Mobile Number (India) <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative flex rounded-md shadow-xs">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 border border-r-0 border-[#E2E8F0] rounded-l-md text-slate-700 text-xs font-bold select-none shrink-0">
                                        <span className="text-base leading-none">🇮🇳</span>
                                        <span>+91</span>
                                    </div>
                                    <input
                                        id="bank-officer-mobile"
                                        type="tel"
                                        maxLength={10}
                                        value={formData.mobile}
                                        onChange={e => handlePhoneChange(e.target.value)}
                                        onBlur={() => {
                                            setTouched(prev => ({ ...prev, mobile: true }));
                                            setErrors(prev => ({ ...prev, mobile: validatePhoneField(formData.mobile) }));
                                        }}
                                        placeholder="98765 43210"
                                        className={`flex-1 min-w-0 px-3 py-2.5 bg-white border rounded-r-md text-sm font-semibold tracking-wide text-slate-900 focus:outline-none transition-all placeholder:text-slate-400 ${
                                            errors.mobile
                                                ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 pr-10"
                                                : formData.mobile && isPhoneValid(formData.mobile)
                                                ? "border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 pr-10"
                                                : "border-[#E2E8F0] focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                        }`}
                                    />
                                    {formData.mobile && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
                                            {errors.mobile ? (
                                                <span className="material-symbols-outlined text-rose-500 text-lg">error</span>
                                            ) : isPhoneValid(formData.mobile) ? (
                                                <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                                {errors.mobile ? (
                                    <p className="text-[11px] font-medium text-rose-600 mt-1.5 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">error</span>
                                        {errors.mobile}
                                    </p>
                                ) : formData.mobile && isPhoneValid(formData.mobile) ? (
                                    <p className="text-[11px] font-medium text-emerald-600 mt-1.5 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                        Valid Indian mobile number (+91 {formData.mobile.slice(0, 5)} {formData.mobile.slice(5)})
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-slate-400 mt-1">10-digit Indian mobile number for two-factor authentication (OTP).</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Lending Bank Partner & Institutional Assignment */}
                    <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-xs">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                                    2
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-slate-900">Institutional Partner & Role Assignment</h2>
                                    <p className="text-[12px] text-slate-500">Designate the lending institution, official designation, and operational office.</p>
                                </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                                LENDER QUEUE
                            </span>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label htmlFor="bank-officer-partner" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                    Assigned Lending Bank Partner <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <select
                                        id="bank-officer-partner"
                                        value={formData.bank}
                                        onChange={e => {
                                            setFormData({ ...formData, bank: e.target.value });
                                            if (errors.bank) setErrors(prev => ({ ...prev, bank: undefined }));
                                        }}
                                        disabled={banksLoading}
                                        className={`w-full appearance-none pl-10 pr-10 py-2.5 bg-white border rounded-md text-sm font-semibold text-slate-900 focus:outline-none transition-all cursor-pointer ${
                                            errors.bank
                                                ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                                : "border-[#E2E8F0] focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                                        }`}
                                    >
                                        <option value="">
                                            {banksLoading ? "Loading bank partners..." : "-- Select an Assigned Lending Bank Partner --"}
                                        </option>
                                        {bankPartners && bankPartners.length > 0 ? (
                                            bankPartners.map(b => (
                                                <option key={b.id || b.shortName} value={b.shortName || b.id}>
                                                    {b.name} ({b.shortName?.toUpperCase() || b.type})
                                                </option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="avanse">Avanse Financial Services (AVANSE)</option>
                                                <option value="auxilo">Auxilo Finserve (AUXILO)</option>
                                                <option value="poonawalla">Poonawalla Fincorp (POONAWALLA)</option>
                                                <option value="idfc">IDFC FIRST Bank (IDFC)</option>
                                                <option value="credila">HDFC Credila (CREDILA)</option>
                                            </>
                                        )}
                                    </select>
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
                                        account_balance
                                    </span>
                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
                                        expand_more
                                    </span>
                                </div>
                                {errors.bank ? (
                                    <p className="text-[11px] font-medium text-rose-600 mt-1.5 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">error</span>
                                        {errors.bank}
                                    </p>
                                ) : (
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Links this representative to the selected bank’s application queue, credit evaluation desk, and disbursement milestones.
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                                <div>
                                    <label htmlFor="bank-officer-designation" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                        Officer Designation
                                    </label>
                                    <input
                                        id="bank-officer-designation"
                                        type="text"
                                        value={formData.designation}
                                        onChange={e => setFormData({ ...formData, designation: e.target.value })}
                                        placeholder="E.g. Senior Underwriting Manager"
                                        className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-md text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="bank-officer-location" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                        Branch / Office City
                                    </label>
                                    <input
                                        id="bank-officer-location"
                                        type="text"
                                        value={formData.officeLocation}
                                        onChange={e => setFormData({ ...formData, officeLocation: e.target.value })}
                                        placeholder="E.g. Mumbai (BKC HQ)"
                                        className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-md text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="bank-officer-empid" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                        Employee ID (Optional)
                                    </label>
                                    <input
                                        id="bank-officer-empid"
                                        type="text"
                                        value={formData.employeeId}
                                        onChange={e => setFormData({ ...formData, employeeId: e.target.value })}
                                        placeholder="E.g. BKC-9042"
                                        className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-md text-sm font-mono font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-all placeholder:text-slate-400"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </main>
        </div>
    );
}
