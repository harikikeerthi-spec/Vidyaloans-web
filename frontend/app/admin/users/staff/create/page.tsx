"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminApi, referenceApi, mailApi } from "@/lib/api";
import { formatPhone, isPhoneValid } from "@/lib/validation";

export default function CreateStaffPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [officesLoading, setOfficesLoading] = useState(false);
    const [offices, setOffices] = useState<any[]>([]);

    // Validation state
    const [errors, setErrors] = useState<{
        firstName?: string;
        lastName?: string;
        email?: string;
        mobile?: string;
        officeId?: string;
        mailboxEmail?: string;
    }>({});
    const [touched, setTouched] = useState<{
        firstName?: boolean;
        lastName?: boolean;
        email?: boolean;
        mobile?: boolean;
        mailboxEmail?: boolean;
    }>({});

    // S3 Folders state from AWS SES bucket
    const [s3Folders, setS3Folders] = useState<any[]>([]);
    const [loadingFolders, setLoadingFolders] = useState(false);

    // Form state
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "", // Login email
        mobile: "",
        officeId: "",
        officeLocation: "",
        mailboxEmail: "", // Official SES email
        mailboxPrefix: "", // S3 folder prefix
        canAccessSupport: false,
    });

    // Add office modal state
    const [showAddOfficeModal, setShowAddOfficeModal] = useState(false);
    const [createOfficeLoading, setCreateOfficeLoading] = useState(false);
    const [newOfficeData, setNewOfficeData] = useState({
        name: "",
        city: "",
        location: "",
        description: "",
    });

    // Load registered branches / offices
    const loadOffices = async () => {
        setOfficesLoading(true);
        try {
            const res: any = await referenceApi.getOffices();
            if (res && Array.isArray(res.data)) {
                setOffices(res.data);
            } else if (Array.isArray(res)) {
                setOffices(res);
            }
        } catch (e) {
            console.error("Error loading offices:", e);
        } finally {
            setOfficesLoading(false);
        }
    };

    // Load S3 folders from AWS SES incoming emails bucket
    const loadS3Folders = async () => {
        setLoadingFolders(true);
        try {
            const res: any = await mailApi.getFolders();
            if (res?.success && Array.isArray(res.data)) {
                setS3Folders(res.data);
            }
        } catch (e) {
            console.warn("Could not load S3 folders:", e);
        } finally {
            setLoadingFolders(false);
        }
    };

    useEffect(() => {
        loadOffices();
        loadS3Folders();
    }, []);

    // Selection handler for S3 folders
    const handleSelectFolder = (folder: any) => {
        const prefix = folder.prefix;
        const slug = prefix.replace(/^staff\//, "").replace(/\/$/, "");
        
        setFormData(prev => {
            let matchingEmail = prev.mailboxEmail;
            // If email is empty or ends with @vidyaloans.in, auto-match with the selected folder
            if (!prev.mailboxEmail || prev.mailboxEmail.endsWith("@vidyaloans.in")) {
                if (folder.assignedMailboxEmail) {
                    matchingEmail = folder.assignedMailboxEmail;
                } else if (slug && slug !== "support" && slug !== "incoming" && slug !== "info") {
                    matchingEmail = `${slug}@vidyaloans.in`;
                }
            }

            return {
                ...prev,
                mailboxPrefix: prefix,
                mailboxEmail: matchingEmail
            };
        });
    };



    // Helper to auto-suggest SES business email and match/select S3 prefix
    const handleAutoSuggestMailbox = () => {
        const cleanFirst = formData.firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const cleanLast = formData.lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!cleanFirst) return;

        const alias = cleanLast ? `${cleanFirst}.${cleanLast}@vidyaloans.in` : `${cleanFirst}@vidyaloans.in`;

        // Check if an S3 folder already exists for this name (e.g. 'abhi/' or 'staff/abhi/')
        const matched = s3Folders.find(f => {
            const slug = f.prefix.replace(/^staff\//, "").replace(/\/$/, "").toLowerCase();
            return slug === cleanFirst;
        });

        const prefix = matched ? matched.prefix : `${cleanFirst}/`;

        setFormData(prev => ({
            ...prev,
            mailboxEmail: alias,
            mailboxPrefix: prefix
        }));
    };

    // Quick handle for creating a new office directly from this page
    const handleCreateOffice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newOfficeData.name || !newOfficeData.city || !newOfficeData.location) {
            alert("Branch Name, City, and Location are required.");
            return;
        }

        setCreateOfficeLoading(true);
        try {
            const res: any = await referenceApi.createOffice(newOfficeData);
            if (res?.success) {
                setShowAddOfficeModal(false);
                setNewOfficeData({ name: "", city: "", location: "", description: "" });
                await loadOffices();
                if (res.data?.id) {
                    setFormData(prev => ({
                        ...prev,
                        officeId: res.data.id,
                        officeLocation: `${res.data.name} - ${res.data.city} (${res.data.location})`
                    }));
                }
            } else {
                alert("Failed to create office: " + (res?.message || "Unknown error"));
            }
        } catch (err: any) {
            alert("Error creating office: " + (err.message || err));
        } finally {
            setCreateOfficeLoading(false);
        }
    };

    // Validation helpers
    const isValidEmail = (email: string) => {
        const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return re.test(email.trim()) && email.trim().length <= 100;
    };

    const validateEmailField = (email: string): string => {
        const trimmed = email.trim();
        if (!trimmed) return "Login email address is required.";
        if (/\s/.test(trimmed)) return "Email address cannot contain spaces.";
        if (!isValidEmail(trimmed)) return "Please enter a valid email address (e.g. name@example.com).";
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

    const validateMailboxEmailField = (email: string): string => {
        const trimmed = email.trim();
        if (!trimmed) return "";
        if (/\s/.test(trimmed)) return "Official business email cannot contain spaces.";
        if (!isValidEmail(trimmed)) return "Please enter a valid email address (e.g. name@vidyaloans.in).";
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

    // Submit handler
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

        if (formData.mailboxEmail.trim()) {
            const mailboxErr = validateMailboxEmailField(formData.mailboxEmail);
            if (mailboxErr) {
                newErrors.mailboxEmail = mailboxErr;
            }
        }

        if (!formData.officeId) {
            newErrors.officeId = "Please select an assigned operational office / branch.";
        }

        setErrors(newErrors);
        setTouched({
            firstName: true,
            lastName: true,
            email: true,
            mobile: true,
            mailboxEmail: true,
        });

        if (Object.keys(newErrors).length > 0) {
            const firstKey = Object.keys(newErrors)[0];
            const targetId =
                firstKey === "firstName" ? "staff-first-name" :
                firstKey === "lastName" ? "staff-last-name" :
                firstKey === "email" ? "staff-login-email" :
                firstKey === "mobile" ? "staff-mobile" :
                firstKey === "officeId" ? "staff-office-select" : "staff-mailbox-email";
            document.getElementById(targetId)?.focus();
            return;
        }

        setLoading(true);
        try {
            const cleanPrefix = formData.mailboxPrefix.trim()
                ? (formData.mailboxPrefix.trim().endsWith("/") ? formData.mailboxPrefix.trim() : `${formData.mailboxPrefix.trim()}/`)
                : (formData.mailboxEmail.trim() ? `${formData.mailboxEmail.trim().split("@")[0].toLowerCase()}/` : undefined);

            const cleanDigits = formData.mobile.replace(/\D/g, "");
            const formattedMobile = `+91 ${cleanDigits}`;

            const payload = {
                role: "staff",
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim().toLowerCase(),
                mobile: formattedMobile,
                officeId: formData.officeId,
                officeLocation: formData.officeLocation,
                mailboxEmail: formData.mailboxEmail.trim().toLowerCase() || undefined,
                mailboxPrefix: cleanPrefix,
                canAccessSupport: Boolean(formData.canAccessSupport),
            };

            const res: any = await adminApi.createUser(payload);

            if (res.success && (res.user?.id || res.user)) {
                const finalStaffId = res.user?.staffId || res.user?.id || "Assigned";
                alert(`Staff Profile created successfully for ${formData.firstName} ${formData.lastName}! Generated Staff ID: ${finalStaffId}`);
                router.push("/admin/users/staff");
            } else {
                const errMsg = res.error || res.message || "Unknown error";
                alert("Failed to create staff profile: " + errMsg);
            }
        } catch (err: any) {
            console.error("Staff creation failed:", err);
            alert("Error creating staff profile: " + (err.message || err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] text-slate-800 pb-28 font-sans flex flex-col">
            {/* Top Navigation Bar */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.push("/admin/users/staff")}
                            className="w-9 h-9 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Back to Staff List"
                        >
                            <span className="material-symbols-outlined text-lg">arrow_back</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                                <Link href="/admin/dashboard" className="hover:text-indigo-600 transition-colors">Admin</Link>
                                <span>/</span>
                                <Link href="/admin/users/staff" className="hover:text-indigo-600 transition-colors">Staff Operations</Link>
                                <span>/</span>
                                <span className="text-slate-600">New Staff</span>
                            </div>
                            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
                                <span className="material-symbols-outlined text-indigo-600 text-[22px]">badge</span>
                                Create Staff Profile
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => router.push("/admin/users/staff")}
                            className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md border border-transparent transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <span className="animate-spin text-sm">⏳</span>
                                    <span>Creating Profile...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[16px]">person_add</span>
                                    <span>Create Staff Profile</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Form Content */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 flex-1 w-full">
                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                    {/* Left 2 Columns: Main Input Cards */}
                    <div className="lg:col-span-2 space-y-6">

                        {/* Card 1: Basic Identity & Portal Authentication */}
                        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-xs">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                                        1
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-slate-900">Identity & Portal Authentication</h2>
                                        <p className="text-[12px] text-slate-500">Legal name and normal credentials used by the staff member to log in.</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wider">
                                    Mandatory
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="staff-first-name" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                        First Name<span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="staff-first-name"
                                        type="text"
                                        value={formData.firstName}
                                        onChange={e => {
                                            setFormData({ ...formData, firstName: e.target.value });
                                            if (errors.firstName) setErrors(prev => ({ ...prev, firstName: undefined }));
                                        }}
                                        placeholder="E.g. Priya"
                                        className={`w-full px-3.5 py-2.5 bg-white border rounded-md text-sm font-medium text-slate-900 focus:outline-none transition-all placeholder:text-slate-400 ${
                                            errors.firstName
                                                ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                                : "border-[#E2E8F0] focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
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
                                    <label htmlFor="staff-last-name" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                        Last Name<span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="staff-last-name"
                                        type="text"
                                        value={formData.lastName}
                                        onChange={e => {
                                            setFormData({ ...formData, lastName: e.target.value });
                                            if (errors.lastName) setErrors(prev => ({ ...prev, lastName: undefined }));
                                        }}
                                        placeholder="E.g. Sharma"
                                        className={`w-full px-3.5 py-2.5 bg-white border rounded-md text-sm font-medium text-slate-900 focus:outline-none transition-all placeholder:text-slate-400 ${
                                            errors.lastName
                                                ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                                : "border-[#E2E8F0] focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
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
                                    <label htmlFor="staff-login-email" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                        Login Email Address<span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="staff-login-email"
                                            type="email"
                                            value={formData.email}
                                            onChange={e => handleEmailChange(e.target.value)}
                                            onBlur={() => {
                                                setTouched(prev => ({ ...prev, email: true }));
                                                setErrors(prev => ({ ...prev, email: validateEmailField(formData.email) }));
                                            }}
                                            placeholder="priya.personal@gmail.com"
                                            className={`w-full px-3.5 py-2.5 bg-white border rounded-md text-sm font-medium text-slate-900 focus:outline-none transition-all placeholder:text-slate-400 ${
                                                errors.email
                                                    ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 pr-10"
                                                    : formData.email && isValidEmail(formData.email)
                                                    ? "border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 pr-10"
                                                    : "border-[#E2E8F0] focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
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
                                            Used strictly for authentication and logging in at <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">/staff/login</code>.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="staff-mobile" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                        Mobile Number (India)<span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative flex rounded-md shadow-xs">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 border border-r-0 border-[#E2E8F0] rounded-l-md text-slate-700 text-xs font-bold select-none shrink-0">
                                            <span className="text-base leading-none">🇮🇳</span>
                                            <span>+91</span>
                                        </div>
                                        <input
                                            id="staff-mobile"
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
                                                    : "border-[#E2E8F0] focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
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
                                        <p className="text-[11px] text-slate-400 mt-1">10-digit Indian mobile number for OTP and internal escalation.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Card 2: AWS SES Mailbox & Folder Isolation */}
                        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-xs">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                                        2
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-slate-900">AWS SES Mailbox & S3 Folder Isolation</h2>
                                        <p className="text-[12px] text-slate-500">
                                            Assign an isolated S3 folder in <code className="bg-slate-100 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-bold text-[11px]">vidyaloans-incoming-emails</code> so this staff only accesses their incoming emails and sends from their registered business email.
                                        </p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                                    SES / S3 Routing
                                </span>
                            </div>

                            {/* S3 Folder Dropdown Selector */}
                            <div className="mb-5">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[13px] font-semibold text-slate-800 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-amber-500 text-[16px]">folder_open</span>
                                        Available Folders in AWS S3
                                        <code className="font-mono text-indigo-700 text-[11px] bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">vidyaloans-incoming-emails</code>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={loadS3Folders}
                                        disabled={loadingFolders}
                                        className="text-[11px] font-semibold text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors cursor-pointer"
                                        title="Refresh folders from S3"
                                    >
                                        <span className={`material-symbols-outlined text-[14px] ${loadingFolders ? "animate-spin text-indigo-500" : ""}`}>refresh</span>
                                        {loadingFolders ? "Loading..." : "Refresh"}
                                    </button>
                                </div>

                                {/* Dropdown */}
                                <div className="relative">
                                    <select
                                        value={formData.mailboxPrefix}
                                        onChange={e => {
                                            const selectedPrefix = e.target.value;
                                            if (!selectedPrefix) {
                                                setFormData(prev => ({ ...prev, mailboxPrefix: "", mailboxEmail: "" }));
                                                return;
                                            }
                                            const folder = s3Folders.find(f => f.prefix === selectedPrefix);
                                            if (folder) handleSelectFolder(folder);
                                            else setFormData(prev => ({ ...prev, mailboxPrefix: selectedPrefix }));
                                        }}
                                        disabled={loadingFolders}
                                        className="w-full appearance-none pl-10 pr-10 py-2.5 bg-white border border-[#E2E8F0] rounded-lg text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <option value="">
                                            {loadingFolders ? "Scanning S3 bucket…" : s3Folders.length === 0 ? "No folders found in bucket" : "— Select an S3 inbox folder —"}
                                        </option>
                                        {s3Folders.map(folder => {
                                            const slug = folder.prefix.replace(/^staff\//, "").replace(/\/$/, "");
                                            const emailHint = folder.assignedMailboxEmail || `${slug}@vidyaloans.in`;
                                            const countLabel = typeof folder.count === "number" ? `  ·  ${folder.count} email${folder.count === 1 ? "" : "s"}` : "";
                                            const assignedLabel = folder.assignedStaffName ? `  [${folder.assignedStaffName}]` : "";
                                            return (
                                                <option key={folder.prefix} value={folder.prefix}>
                                                    {folder.prefix}  →  {emailHint}{countLabel}{assignedLabel}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 pointer-events-none">
                                        {formData.mailboxPrefix ? "folder_special" : "folder_open"}
                                    </span>
                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400 pointer-events-none">
                                        expand_more
                                    </span>
                                </div>

                                {/* Selected folder confirmation strip */}
                                {formData.mailboxPrefix && (() => {
                                    const sel = s3Folders.find(f => f.prefix === formData.mailboxPrefix);
                                    const slug = formData.mailboxPrefix.replace(/^staff\//, "").replace(/\/$/, "");
                                    const email = sel?.assignedMailboxEmail || formData.mailboxEmail || `${slug}@vidyaloans.in`;
                                    return (
                                        <div className="mt-2 flex items-center flex-wrap gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px]">
                                            <span className="material-symbols-outlined text-emerald-600 text-[15px]">check_circle</span>
                                            <span className="text-emerald-800 font-medium">
                                                <code className="font-mono font-bold">{formData.mailboxPrefix}</code>
                                            </span>
                                            <span className="text-emerald-500">→</span>
                                            <span className="text-emerald-800 font-semibold">{email}</span>
                                            {sel?.count !== undefined && (
                                                <span className="ml-auto text-emerald-600 font-medium">{sel.count} email{sel.count === 1 ? "" : "s"}</span>
                                            )}
                                            {sel?.assignedStaffName && (
                                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-semibold text-[10px]">
                                                    {sel.assignedStaffName}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Form Inputs for Email & Prefix */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label htmlFor="staff-mailbox-email" className="text-[13px] font-medium text-slate-700 block">
                                            Official Business Email (SES)<span className="text-rose-500">*</span>
                                        </label>
                                        {formData.firstName && (
                                            <button
                                                type="button"
                                                onClick={handleAutoSuggestMailbox}
                                                className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                                            >
                                                + Auto-suggest
                                            </button>
                                        )}
                                    </div>
                                    <input
                                        id="staff-mailbox-email"
                                        type="email"
                                        value={formData.mailboxEmail}
                                        onChange={e => {
                                            const val = e.target.value;
                                            const slug = val.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "");
                                            const matched = s3Folders.find(f => {
                                                const fSlug = f.prefix.replace(/^staff\//, "").replace(/\/$/, "").toLowerCase();
                                                return fSlug === slug;
                                            });
                                            setFormData(prev => ({
                                                ...prev,
                                                mailboxEmail: val,
                                                mailboxPrefix: matched ? matched.prefix : (prev.mailboxPrefix && prev.mailboxPrefix !== `${slug}/` ? prev.mailboxPrefix : (slug ? `${slug}/` : ''))
                                            }));
                                            if (touched.mailboxEmail) {
                                                setErrors(prev => ({ ...prev, mailboxEmail: validateMailboxEmailField(val) }));
                                            } else if (errors.mailboxEmail) {
                                                setErrors(prev => ({ ...prev, mailboxEmail: undefined }));
                                            }
                                        }}
                                        onBlur={() => {
                                            if (formData.mailboxEmail) {
                                                setTouched(prev => ({ ...prev, mailboxEmail: true }));
                                                setErrors(prev => ({ ...prev, mailboxEmail: validateMailboxEmailField(formData.mailboxEmail) }));
                                            }
                                        }}
                                        placeholder="abhi@vidyaloans.in"
                                        className={`w-full px-3.5 py-2.5 bg-white border rounded-md text-sm font-medium text-slate-900 focus:outline-none transition-all placeholder:text-slate-400 ${
                                            errors.mailboxEmail
                                                ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                                : "border-[#E2E8F0] focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                        }`}
                                    />
                                    {errors.mailboxEmail && (
                                        <p className="text-[11px] font-medium text-rose-600 mt-1.5 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">error</span>
                                            {errors.mailboxEmail}
                                        </p>
                                    )}
                                    {formData.mailboxEmail && (
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            Outgoing emails will be sent from <span className="text-indigo-600 font-semibold font-mono">{formData.mailboxEmail}</span>
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label htmlFor="staff-mailbox-prefix" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                        Assigned S3 Folder Prefix<span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="staff-mailbox-prefix"
                                        type="text"
                                        required
                                        value={formData.mailboxPrefix}
                                        onChange={e => setFormData({ ...formData, mailboxPrefix: e.target.value })}
                                        placeholder="Select a folder above or type manually"
                                        className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-md text-sm font-mono font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                                    />
                                    {formData.mailboxPrefix && (
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            Folder <span className="font-mono text-indigo-600 font-bold">{formData.mailboxPrefix}</span> in <span className="font-mono text-slate-500">vidyaloans-incoming-emails</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Access Permission Toggle Box */}
                            <div className="mt-4 bg-slate-50 border border-[#E2E8F0] rounded-lg p-3.5 flex items-start gap-3">
                                <input
                                    id="staff-access-support"
                                    type="checkbox"
                                    checked={formData.canAccessSupport}
                                    onChange={e => setFormData({ ...formData, canAccessSupport: e.target.checked })}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer"
                                />
                                <label htmlFor="staff-access-support" className="text-xs text-slate-700 cursor-pointer">
                                    <span className="font-semibold block text-slate-800">Allow access to General Support Team Inbox (support/)</span>
                                    <span className="text-slate-500 block text-[11px] mt-0.5 leading-relaxed">
                                        When left unchecked (recommended), this staff member is strictly restricted to their designated folder (<code className="font-bold text-indigo-700 font-mono">{formData.mailboxPrefix || "assigned folder"}</code>) and cannot view, read, or intercept inquiries sent to support@vidyaloans.in or other staff mailboxes.
                                    </span>
                                </label>
                            </div>

                            {/* Architecture Explanation Box */}
                            <div className="mt-3.5 bg-blue-50/60 border border-blue-200/70 rounded-lg p-3 flex items-start gap-2.5">
                                <span className="material-symbols-outlined text-blue-600 text-[18px] shrink-0 mt-0.5">info</span>
                                <div className="text-[11px] text-blue-900 space-y-1 leading-relaxed">
                                    <p><strong>How AWS SES Routing works for this staff:</strong></p>
                                    <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                                        <li><strong>Inbound:</strong> AWS SES Receipt Rule for <code className="bg-blue-100/70 px-1 py-0.2 rounded font-mono text-[10px]">{formData.mailboxEmail || "email@vidyaloans.in"}</code> delivers to S3 prefix <code className="bg-blue-100/70 px-1 py-0.2 rounded font-mono text-[10px]">{formData.mailboxPrefix || "<folder>/"}</code>.</li>
                                        <li><strong>Outbound:</strong> Outgoing replies and composed emails are dispatched strictly using <code className="bg-blue-100/70 px-1 py-0.2 rounded font-mono text-[10px]">{formData.mailboxEmail || "email@vidyaloans.in"}</code> as the verified SES SMTP sender.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Card 3: Regional Office & Branch Allocation */}
                        <div className="bg-white border border-[#E2E8F0] rounded-xl p-6 shadow-xs">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-5">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm">
                                        3
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold text-slate-900">Regional Branch & Work Location</h2>
                                        <p className="text-[12px] text-slate-500">Determines loan queue assignment and physical operational branch.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAddOfficeModal(true)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-[14px]">add</span>
                                    Add New Branch
                                </button>
                            </div>

                            <div>
                                <label htmlFor="staff-office-select" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                    Operational Office Location<span className="text-rose-500">*</span>
                                </label>
                                <select
                                    id="staff-office-select"
                                    value={formData.officeId}
                                    onChange={e => {
                                        const selected = offices.find(o => o.id === e.target.value);
                                        setFormData({
                                            ...formData,
                                            officeId: e.target.value,
                                            officeLocation: selected ? `${selected.name} - ${selected.city} (${selected.location})` : ""
                                        });
                                        if (errors.officeId) setErrors(prev => ({ ...prev, officeId: undefined }));
                                    }}
                                    className={`w-full px-3.5 py-2.5 bg-white border rounded-md text-sm font-medium text-slate-900 focus:outline-none transition-all cursor-pointer ${
                                        errors.officeId
                                            ? "border-rose-400 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                            : "border-[#E2E8F0] focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600"
                                    }`}
                                >
                                    <option value="">-- Select Office Location ({offices.length} Registered Branches) --</option>
                                    {offices.map((off: any) => (
                                        <option key={off.id} value={off.id}>
                                            {off.name} · {off.city} ({off.location})
                                        </option>
                                    ))}
                                </select>
                                {errors.officeId && (
                                    <p className="text-[11px] font-medium text-rose-600 mt-1.5 flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px]">error</span>
                                        {errors.officeId}
                                    </p>
                                )}
                                {officesLoading && (
                                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                                        <span className="animate-spin text-xs">⏳</span> Loading branches...
                                    </p>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Right 1 Column: Summary & Live Identity Preview Card */}
                    <div className="space-y-6 lg:sticky lg:top-20">
                        {/* Live Staff Identity Card */}
                        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                                <span>Profile Preview</span>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                            </h3>

                            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-800 text-white font-bold text-base flex items-center justify-center shadow-xs uppercase">
                                    {formData.firstName ? formData.firstName.charAt(0) : "S"}
                                    {formData.lastName ? formData.lastName.charAt(0) : ""}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-slate-900 truncate">
                                        {formData.firstName || formData.lastName
                                            ? `${formData.firstName} ${formData.lastName}`.trim()
                                            : "Staff Member Name"}
                                    </h4>
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 mt-0.5">
                                        Loan Processing Officer
                                    </span>
                                </div>
                            </div>

                            <div className="pt-4 space-y-3 text-xs">
                                <div>
                                    <span className="text-slate-400 text-[11px] block font-medium">Portal Login Email:</span>
                                    <span className="text-slate-800 font-semibold truncate block">
                                        {formData.email || "—"}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-slate-400 text-[11px] block font-medium">Mobile Number:</span>
                                    <span className="text-slate-800 font-semibold truncate block">
                                        {formData.mobile ? `+91 ${formData.mobile.slice(0, 5)} ${formData.mobile.slice(5)}` : "—"}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-slate-400 text-[11px] block font-medium">Official SES Business Email:</span>
                                    <span className="text-indigo-700 font-semibold truncate block">
                                        {formData.mailboxEmail || "— (Will default to login email)"}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-slate-400 text-[11px] block font-medium">Assigned S3 Inbox Folder:</span>
                                    <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px] inline-block mt-0.5">
                                        {formData.mailboxPrefix || "—"}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-slate-400 text-[11px] block font-medium">General Support Inbox Access:</span>
                                    {formData.canAccessSupport ? (
                                        <span className="text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                            Enabled (Can view support/)
                                        </span>
                                    ) : (
                                        <span className="text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                                            <span className="material-symbols-outlined text-[14px]">lock</span>
                                            Isolated (Personal folder only)
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <span className="text-slate-400 text-[11px] block font-medium">Branch Location:</span>
                                    <span className="text-slate-800 font-medium block truncate">
                                        {formData.officeLocation || "— (Select office)"}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Checklist Card */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 text-xs text-slate-600 space-y-2.5">
                            <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[16px] text-indigo-600">checklist</span>
                                Next Steps After Creating
                            </h4>
                            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 leading-relaxed">
                                <li>The staff member can immediately log into the staff portal with their login email.</li>
                                <li>Add 1 AWS SES Receipt Rule for their business email to route to their assigned S3 prefix.</li>
                                <li>Any replies from students or banks will appear exclusively in their staff inbox dashboard.</li>
                            </ol>
                        </div>
                    </div>
                </form>
            </main>

            {/* Quick Add Office Modal */}
            {showAddOfficeModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                <span className="material-symbols-outlined text-indigo-600 text-lg">domain_add</span>
                                Add Regional Branch
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowAddOfficeModal(false)}
                                className="w-7 h-7 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center"
                            >
                                <span className="material-symbols-outlined text-base">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleCreateOffice} className="p-5 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-700 mb-1 block">Branch / Office Name*</label>
                                <input
                                    type="text"
                                    required
                                    value={newOfficeData.name}
                                    onChange={e => setNewOfficeData({ ...newOfficeData, name: e.target.value })}
                                    placeholder="E.g. South Regional Hub"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 mb-1 block">City*</label>
                                    <input
                                        type="text"
                                        required
                                        value={newOfficeData.city}
                                        onChange={e => setNewOfficeData({ ...newOfficeData, city: e.target.value })}
                                        placeholder="E.g. Hyderabad"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-700 mb-1 block">Location / Area*</label>
                                    <input
                                        type="text"
                                        required
                                        value={newOfficeData.location}
                                        onChange={e => setNewOfficeData({ ...newOfficeData, location: e.target.value })}
                                        placeholder="E.g. Hitec City"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-semibold text-slate-700 mb-1 block">Description (Optional)</label>
                                <textarea
                                    value={newOfficeData.description}
                                    onChange={e => setNewOfficeData({ ...newOfficeData, description: e.target.value })}
                                    placeholder="Operational notes, branch capacity..."
                                    rows={2}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowAddOfficeModal(false)}
                                    className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createOfficeLoading}
                                    className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                                >
                                    {createOfficeLoading ? "Saving..." : "Save Branch"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
