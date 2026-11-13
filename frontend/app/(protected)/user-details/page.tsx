"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { authApi } from "@/lib/api";
import { formatPhone, isPhoneValid } from "@/lib/validation";


import DatePicker from "@/components/DatePicker";


export default function UserDetailsPage() {
    const { user, token, refreshUser } = useAuth();
    const router = useRouter();

    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        dateOfBirth: "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const formatDateToDdMmYyyy = (dateStr?: string): string => {
        if (!dateStr) return "";
        try {
            if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
                return dateStr;
            }
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return "";
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        } catch {
            return "";
        }
    };

    useEffect(() => {
        if (user && !success) {
            const hasAll = Boolean(
                user.firstName?.trim() &&
                user.lastName?.trim() &&
                user.phoneNumber?.trim() &&
                user.dateOfBirth?.trim()
            );
            if (hasAll) {
                // already completed; redirect somewhere sensible
                router.replace("/");
                return;
            }

            setForm({
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                phoneNumber: user.phoneNumber || "",
                dateOfBirth: formatDateToDdMmYyyy(user.dateOfBirth),
            });
        }
    }, [user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.email) return;

        // Validate first name
        if (!form.firstName || form.firstName.trim().length < 3) {
            setError("First name must be at least 3 characters");
            return;
        }
        if (/[^A-Za-z\s.-]/.test(form.firstName)) {
            setError("First name must only contain letters, spaces, dots, or hyphens");
            return;
        }
        
        // Validate last name
        if (!form.lastName || !form.lastName.trim()) {
            setError("Last name is required");
            return;
        }
        if (/[^A-Za-z\s.-]/.test(form.lastName)) {
            setError("Last name must only contain letters, spaces, dots, or hyphens");
            return;
        }
        
        // Validate phone number
        if (!form.phoneNumber || !isPhoneValid(form.phoneNumber)) {
            setError("Please enter a valid phone number");
            return;
        }

        // Validate date of birth (must be 18–40 years old)
        if (!form.dateOfBirth) {
            setError("Date of birth is required");
            return;
        } else {
            const [dd, mm, yyyy] = form.dateOfBirth.split("-").map(Number);
            const dob = new Date(yyyy, mm - 1, dd);
            const today = new Date();
            const ageMs = today.getTime() - dob.getTime();
            const age = new Date(ageMs).getUTCFullYear() - 1970;
            if (age < 18) {
                setError("You must be at least 18 years old to apply for a loan");
                return;
            }
            if (age > 40) {
                setError("Applicants above 40 years are not eligible for this loan");
                return;
            }
        }
        
        setSaving(true);
        setError(null);

        try {
            const res = await authApi.updateDetails(user.email, {
                firstName: form.firstName,
                lastName: form.lastName,
                phoneNumber: form.phoneNumber,
                dateOfBirth: form.dateOfBirth,
            }) as any;

            if (res && res.success === false) {
                setError(res.message || "Failed to update profile. Please check your information.");
                return;
            }

            const updatedProfile = {
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                phoneNumber: form.phoneNumber.trim(),
                dateOfBirth: form.dateOfBirth.trim(),
                ...(typeof res === 'object' ? res : {})
            };

            await refreshUser(updatedProfile);
            setSuccess(true);
            // brief delay so user sees the success message
            setTimeout(() => {
                router.replace("/");
            }, 800);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent">
            <Navbar />
            <div className="pt-32 pb-16 px-6">
                <div className="max-w-md mx-auto">
                    <div className="bg-white rounded-2xl p-8 shadow-xl shadow-black/[0.03] border border-gray-100">
                        <h1 className="text-2xl font-bold font-display mb-1.5 tracking-tight text-gray-900">
                            Complete Your Profile
                        </h1>
                        <p className="text-gray-500 text-[13px] mb-8 font-normal">Please provide your details to continue</p>
                        
                        {error && (
                            <div className="mb-6 px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs font-medium flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">error</span>
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="mb-6 px-4 py-2.5 bg-green-50 border border-green-100 rounded-xl text-green-600 text-xs font-medium flex items-center gap-2">
                                <span className="material-symbols-outlined text-base">check_circle</span>
                                Profile completed successfully!
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1">
                                        First Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="John"
                                        value={form.firstName}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^A-Za-z\s.-]/g, "");
                                            setForm((p) => ({ ...p, firstName: val }));
                                        }}
                                        required
                                        maxLength={50}
                                        className={`w-full px-4 py-3 bg-gray-50/50 border ${form.firstName && (form.firstName.length < 3 || /[^A-Za-z\s.-]/.test(form.firstName)) ? 'border-rose-300 focus:border-rose-500' : 'border-gray-100 focus:border-[#6605c7]'} rounded-xl text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#6605c7]/5 transition-all`}
                                    />
                                    {form.firstName && (form.firstName.length < 3 || /[^A-Za-z\s.-]/.test(form.firstName)) && (
                                        <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
                                            <span className="material-symbols-outlined text-rose-600 text-sm">error</span>
                                            <span className="text-rose-600 text-xs font-medium">
                                                {form.firstName.length < 3 
                                                    ? "First name must be at least 3 characters" 
                                                    : "Only letters, spaces, dots, and hyphens allowed"}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1">
                                        Last Name
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Doe"
                                        value={form.lastName}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^A-Za-z\s.-]/g, "");
                                            setForm((p) => ({ ...p, lastName: val }));
                                        }}
                                        required
                                        maxLength={50}
                                        className={`w-full px-4 py-3 bg-gray-50/50 border ${form.lastName && /[^A-Za-z\s.-]/.test(form.lastName) ? 'border-rose-300 focus:border-rose-500' : 'border-gray-100 focus:border-[#6605c7]'} rounded-xl text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#6605c7]/5 transition-all`}
                                    />
                                    {form.lastName && /[^A-Za-z\s.-]/.test(form.lastName) && (
                                        <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
                                            <span className="material-symbols-outlined text-rose-600 text-sm">error</span>
                                            <span className="text-rose-600 text-xs font-medium">
                                                Only letters, spaces, dots, and hyphens allowed
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 ml-1">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    placeholder="+91 9876543210"
                                    value={form.phoneNumber}
                                    onChange={(e) =>
                                        setForm((p) => ({ ...p, phoneNumber: formatPhone(e.target.value) }))
                                    }
                                    required
                                    readOnly={!!user?.phoneNumber}
                                    maxLength={10}
                                    inputMode="numeric"
                                    className={`w-full px-4 py-3 bg-gray-50/50 border ${form.phoneNumber && !isPhoneValid(form.phoneNumber) ? 'border-rose-300 focus:border-rose-500' : 'border-gray-100 focus:border-[#6605c7]'} rounded-xl text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#6605c7]/5 transition-all ${!!user?.phoneNumber ? 'opacity-60 cursor-not-allowed' : ''}`}
                                />
                                {form.phoneNumber && !isPhoneValid(form.phoneNumber) && (
                                    <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
                                        <span className="material-symbols-outlined text-rose-600 text-sm">error</span>
                                        <span className="text-rose-600 text-xs font-medium">
                                            {form.phoneNumber.length < 10 
                                                ? "Phone number must be 10 digits" 
                                                : form.phoneNumber[0] < '6'
                                                ? "Phone number must start with 6, 7, 8, or 9"
                                                : "This phone number is not realistic"}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <DatePicker
                                label="Date of Birth"
                                value={form.dateOfBirth}
                                onChange={(val) => setForm(p => ({ ...p, dateOfBirth: val }))}
                                required
                                disabled={!!user?.dateOfBirth}
                                placeholder="Select DOB"
                            />

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full py-3.5 bg-[#6605c7] text-white rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-[#5a04b1] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-[#6605c7]/20 mt-4"
                            >
                                {saving ? "Updating..." : "Complete Profile"}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
