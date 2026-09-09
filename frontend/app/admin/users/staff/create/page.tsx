"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminApi, referenceApi } from "@/lib/api";

export default function CreateStaffPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [officesLoading, setOfficesLoading] = useState(false);
    const [offices, setOffices] = useState<any[]>([]);

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

    useEffect(() => {
        loadOffices();
    }, []);

    // Helper to auto-suggest SES business email and S3 prefix
    const handleAutoSuggestMailbox = () => {
        const cleanFirst = formData.firstName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const cleanLast = formData.lastName.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!cleanFirst) return;

        const alias = cleanLast ? `${cleanFirst}.${cleanLast}@vidyaloans.in` : `${cleanFirst}@vidyaloans.in`;
        const prefix = `staff/${cleanFirst}/`;

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

    // Submit handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.firstName.trim() || !formData.lastName.trim()) {
            alert("Please enter both First Name and Last Name.");
            return;
        }

        if (!formData.email.trim()) {
            alert("Please enter a valid Login Email Address.");
            return;
        }

        if (!formData.mobile.trim()) {
            alert("Please enter a Mobile Number.");
            return;
        }

        if (!formData.officeId) {
            alert("Please select an Assigned Operational Office / Branch.");
            return;
        }

        setLoading(true);
        try {
            const cleanPrefix = formData.mailboxPrefix.trim()
                ? (formData.mailboxPrefix.trim().endsWith("/") ? formData.mailboxPrefix.trim() : `${formData.mailboxPrefix.trim()}/`)
                : (formData.mailboxEmail.trim() ? `staff/${formData.mailboxEmail.trim().split("@")[0].toLowerCase()}/` : undefined);

            const payload = {
                role: "staff",
                firstName: formData.firstName.trim(),
                lastName: formData.lastName.trim(),
                email: formData.email.trim(),
                mobile: formData.mobile.trim(),
                officeId: formData.officeId,
                officeLocation: formData.officeLocation,
                mailboxEmail: formData.mailboxEmail.trim() || undefined,
                mailboxPrefix: cleanPrefix,
                canAccessSupport: Boolean(formData.canAccessSupport),
            };

            const res: any = await adminApi.createUser(payload);

            if (res.success && res.user?.id) {
                alert(`Staff Profile created successfully for ${formData.firstName} ${formData.lastName}! Generated Staff ID: ${res.user.staffId || "Assigned"}`);
                router.push("/admin/users/staff");
            } else {
                alert("Failed to create staff profile: " + (res.message || "Unknown error"));
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
                                        required
                                        value={formData.firstName}
                                        onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                        placeholder="E.g. Priya"
                                        className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-md text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="staff-last-name" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                        Last Name<span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="staff-last-name"
                                        type="text"
                                        required
                                        value={formData.lastName}
                                        onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                        placeholder="E.g. Sharma"
                                        className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-md text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                                    />
                                </div>

                                <div>
                                    <label htmlFor="staff-login-email" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                        Login Email Address<span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="staff-login-email"
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="priya.personal@gmail.com"
                                        className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-md text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Used strictly for authentication and logging in at <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">/staff/login</code>.
                                    </p>
                                </div>

                                <div>
                                    <label htmlFor="staff-mobile" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                        Mobile Number<span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="staff-mobile"
                                        type="tel"
                                        required
                                        value={formData.mobile}
                                        onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                                        placeholder="+91 98765 43210"
                                        className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-md text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">Direct contact for OTP, notifications and internal escalation.</p>
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
                                        <p className="text-[12px] text-slate-500">Isolate incoming and outgoing mail so this officer never sends from support@.</p>
                                    </div>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                                    Mailbox Isolation
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label htmlFor="staff-mailbox-email" className="text-[13px] font-medium text-slate-700 block">
                                            Official Business Email (SES)
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
                                            setFormData({
                                                ...formData,
                                                mailboxEmail: val,
                                                mailboxPrefix: slug ? `staff/${slug}/` : formData.mailboxPrefix
                                            });
                                        }}
                                        placeholder="priya@vidyaloans.in"
                                        className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-md text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Outgoing emails composed by this staff will show <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">From: {formData.mailboxEmail || "name@vidyaloans.in"}</code>.
                                    </p>
                                </div>

                                <div>
                                    <label htmlFor="staff-mailbox-prefix" className="text-[13px] font-medium text-slate-700 mb-1.5 block">
                                        Assigned S3 Folder Prefix
                                    </label>
                                    <input
                                        id="staff-mailbox-prefix"
                                        type="text"
                                        value={formData.mailboxPrefix}
                                        onChange={e => setFormData({ ...formData, mailboxPrefix: e.target.value })}
                                        placeholder="staff/priya/"
                                        className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-md text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all placeholder:text-slate-400"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-1">
                                        Folder inside bucket <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">vidyaloans-incoming-emails</code> for SES receipt rules.
                                    </p>
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
                                        When left unchecked (recommended), this staff member is strictly restricted to their designated folder and cannot view, read, or intercept inquiries sent to support@vidyaloans.in.
                                    </span>
                                </label>
                            </div>

                            {/* Architecture Explanation Box */}
                            <div className="mt-3.5 bg-blue-50/60 border border-blue-200/70 rounded-lg p-3 flex items-start gap-2.5">
                                <span className="material-symbols-outlined text-blue-600 text-[18px] shrink-0 mt-0.5">info</span>
                                <div className="text-[11px] text-blue-900 space-y-1 leading-relaxed">
                                    <p><strong>How AWS SES Routing works for this staff:</strong></p>
                                    <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                                        <li><strong>Inbound:</strong> Add an AWS SES Receipt Rule for <code className="bg-blue-100/70 px-1 py-0.2 rounded font-mono text-[10px]">{formData.mailboxEmail || "email@vidyaloans.in"}</code> pointing to S3 Prefix <code className="bg-blue-100/70 px-1 py-0.2 rounded font-mono text-[10px]">{formData.mailboxPrefix || "staff/<name>/"}</code>.</li>
                                        <li><strong>Outbound:</strong> Outgoing replies automatically use <code className="bg-blue-100/70 px-1 py-0.2 rounded font-mono text-[10px]">{formData.mailboxEmail || "email@vidyaloans.in"}</code> via SES SMTP with verified domain credentials.</li>
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
                                    required
                                    value={formData.officeId}
                                    onChange={e => {
                                        const selected = offices.find(o => o.id === e.target.value);
                                        setFormData({
                                            ...formData,
                                            officeId: e.target.value,
                                            officeLocation: selected ? `${selected.name} - ${selected.city} (${selected.location})` : ""
                                        });
                                    }}
                                    className="w-full px-3.5 py-2.5 bg-white border border-[#E2E8F0] rounded-md text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 cursor-pointer"
                                >
                                    <option value="">-- Select Office Location ({offices.length} Registered Branches) --</option>
                                    {offices.map((off: any) => (
                                        <option key={off.id} value={off.id}>
                                            {off.name} · {off.city} ({off.location})
                                        </option>
                                    ))}
                                </select>
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
