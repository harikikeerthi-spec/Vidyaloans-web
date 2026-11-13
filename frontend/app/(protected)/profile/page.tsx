"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import { authApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import DatePicker from "@/components/DatePicker";
import { formatPhone, isPhoneValid } from "@/lib/validation";
import UserSupportTicketsView from "@/components/UserSupportTicketsView";

export default function ProfilePage() {
    const { user, refreshUser } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [savedUniversities, setSavedUniversities] = useState<any[]>([]);
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        dateOfBirth: "",
    });

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

    // Keep form in sync whenever the user object updates (e.g. after user-details submission)
    useEffect(() => {
        if (user) {
            setForm({
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                phoneNumber: user.phoneNumber || "",
                dateOfBirth: formatDateToDdMmYyyy(user.dateOfBirth),
            });
        }
    }, [user]);

    // Auto-enter edit mode when ?edit=1 is present in the URL
    useEffect(() => {
        try {
            const edit = searchParams?.get?.('edit');
            if (edit === '1' || edit === 'true') {
                setEditing(true);
            }
        } catch (e) { }
    }, [searchParams]);

    // Fetch latest user details on profile page mount
    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    // Load saved universities from localStorage
    useEffect(() => {
        if (user?.id) {
            try {
                const stored = localStorage.getItem(`savedUniversities_${user.id}`);
                if (stored) {
                    setSavedUniversities(JSON.parse(stored));
                }
            } catch (e) { /* ignore */ }
        }
    }, [user?.id]);

    const removeSavedUniversity = (universityName: string) => {
        if (!user?.id) return;
        const key = `savedUniversities_${user.id}`;
        const updated = savedUniversities.filter(u => u.name !== universityName);
        localStorage.setItem(key, JSON.stringify(updated));
        setSavedUniversities(updated);
    };

    const handleSave = async () => {
        if (!user?.email) return;

        // Validate first name
        if (!form.firstName || form.firstName.trim().length < 3) {
            alert("First name must be at least 3 characters");
            return;
        }

        // Validate last name
        if (!form.lastName || form.lastName.trim().length < 1) {
            alert("Last name must be at least 1 character");
            return;
        }

        // Validate phone number
        if (form.phoneNumber && !isPhoneValid(form.phoneNumber)) {
            alert("Please enter a valid phone number");
            return;
        }

        setSaving(true);
        try {
            await authApi.updateDetails(user.email, {
                firstName: form.firstName,
                lastName: form.lastName,
                phoneNumber: form.phoneNumber,
                dateOfBirth: form.dateOfBirth,
            });
            await refreshUser();
            setSuccess(true);
            setEditing(false);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent">
            <Navbar />
            <div className="pt-32 pb-16 px-6">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-2xl font-bold font-display text-gray-900 mb-8">My Profile</h1>

                    {success && (
                        <div className="mb-6 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 text-xs font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">check_circle</span>
                            Profile updated successfully!
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        {/* Avatar */}
                        <div className="p-8 bg-gray-50 border-b border-gray-100 flex items-center gap-6">
                            <div className="w-16 h-16 bg-[#6605c7] rounded-lg flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-[#6605c7]/20">
                                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : "My Account"}
                                </h2>
                                <p className="text-gray-500 text-sm">{user?.email}</p>
                                <span className="inline-block mt-2 px-3 py-0.5 rounded-full bg-[#6605c7]/10 text-[#6605c7] text-[10px] font-bold uppercase tracking-widest">
                                    {user?.role || "user"}
                                </span>
                            </div>
                        </div>

                        <div className="p-8">
                            {!editing ? (
                                <div className="space-y-4">
                                    {[
                                        { label: "First Name", value: user?.firstName || "—" },
                                        { label: "Last Name", value: user?.lastName || "—" },
                                        { label: "Email", value: user?.email || "—" },
                                        { label: "Phone Number", value: user?.phoneNumber || "—" },
                                        { label: "Date of Birth", value: user?.dateOfBirth || "—" }

                                    ].map((f) => (
                                        <div key={f.label} className="flex justify-between items-center py-4 border-b border-gray-50 last:border-0">
                                            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{f.label}</span>
                                            <span className="text-[13px] font-semibold text-gray-900">{f.value}</span>
                                        </div>
                                    ))}
                                    <div className="pt-4">
                                        <button
                                            onClick={() => {
                                                setForm({
                                                    firstName: user?.firstName || "",
                                                    lastName: user?.lastName || "",
                                                    phoneNumber: user?.phoneNumber || "",
                                                    dateOfBirth: user?.dateOfBirth || "",
                                                });
                                                setEditing(true);
                                            }}
                                            className="px-5 py-2.5 bg-[#6605c7] text-white text-xs font-bold rounded-lg hover:bg-[#5504a8] transition-all shadow-sm"
                                        >
                                            Edit Profile
                                        </button>
                                    </div>

                                    {/* Study Abroad Preferences */}
                                    {/* <div className="mt-8 pt-8 border-t border-gray-100">
                                        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#6605c7] mb-6 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-sm">school</span>
                                            Study Abroad Preferences
                                        </h3>
                                        <div className="space-y-4">
                                            {[
                                                { label: "Goal", value: user?.goal || "—" },
                                                { label: "Destination", value: user?.studyDestination || "—" },
                                                { label: "University", value: user?.targetUniversity || "—" },
                                                { label: "Desired Course", value: user?.courseName || "—" },
                                                { label: "Target Intake", value: user?.intakeSeason || "—" },
                                                { label: "Undergrad major", value: user?.bachelorsDegree || "—" },
                                                { label: "GPA Score", value: user?.gpa ? `${user.gpa} / 10` : "—" },
                                                { label: "Experience", value: user?.workExp ? `${user.workExp} months` : "—" },
                                                { label: "Planning Budget", value: user?.budget || "—" },
                                            ].map((f) => (
                                                <div key={f.label} className="flex justify-between items-center py-4 border-b border-gray-50 last:border-0">
                                                    <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">{f.label}</span>
                                                    <span className="text-[13px] font-semibold text-gray-900">{f.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div> */}
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {[
                                        { key: "firstName", label: "First Name", type: "text", },
                                        { key: "lastName", label: "Last Name", type: "text" },
                                        { key: "phoneNumber", label: "Phone Number", type: "text", isLocked: true },
                                        { key: "dateOfBirth", label: "Date of Birth", type: "datepicker", isLocked: true },
                                    ].map((item: any) => {
                                        const { key, label, type, placeholder, pattern, isLocked } = item;
                                        return (
                                            <div key={key}>
                                                {type === "datepicker" ? (
                                                    <DatePicker
                                                        label={label}
                                                        value={form.dateOfBirth}
                                                        onChange={(val) => setForm(p => ({ ...p, dateOfBirth: val }))}
                                                        placeholder="DD-MM-YYYY"
                                                        disabled={isLocked}
                                                    />
                                                ) : (
                                                    <>
                                                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400 block mb-2">{label}</label>
                                                        <input
                                                            type={type}
                                                            placeholder={placeholder}
                                                            pattern={pattern}
                                                            value={form[key as keyof typeof form]}
                                                            onChange={(e) => {
                                                                let val = e.target.value;
                                                                if (key === 'phoneNumber') {
                                                                    val = formatPhone(val);
                                                                } else if (key === 'firstName' || key === 'lastName') {
                                                                    val = val.replace(/[^A-Za-z]/g, "");
                                                                }
                                                                setForm((p) => ({ ...p, [key]: val }));
                                                            }}
                                                            readOnly={isLocked}
                                                            maxLength={key === 'phoneNumber' ? 10 : (key === 'firstName' || key === 'lastName' ? 30 : undefined)}
                                                            className={`w-full px-4 py-2.5 border ${key === 'phoneNumber' && form.phoneNumber && !isPhoneValid(form.phoneNumber) ? 'border-rose-300 focus:border-rose-500' : 'border-gray-200 focus:border-[#6605c7]'} rounded-lg bg-gray-50/50 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                        />
                                                        {key === 'phoneNumber' && form.phoneNumber && !isPhoneValid(form.phoneNumber) && (
                                                            <div className="mt-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2">
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
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                    <div className="flex gap-3 pt-4">
                                        <button onClick={() => setEditing(false)} className="px-5 py-2.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg hover:bg-gray-200 transition-all">
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={saving || !!(form.phoneNumber && !isPhoneValid(form.phoneNumber))}
                                            className="flex-1 py-2.5 bg-[#6605c7] text-white text-xs font-bold rounded-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:bg-[#5504a8] transition-all shadow-sm"
                                        >
                                            {saving && <span className="material-symbols-outlined animate-spin text-sm">progress_activity</span>}
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Saved Universities Section */}
                    <div className="mt-8">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-6 bg-gray-50 border-b border-gray-100">
                                <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#6605c7] flex items-center gap-2">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#6605c7]">
                                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                                    </svg>
                                    Saved Universities
                                    {savedUniversities.length > 0 && (
                                        <span className="ml-2 px-2 py-0.5 rounded-full bg-[#6605c7]/10 text-[#6605c7] text-[10px]">
                                            {savedUniversities.length}
                                        </span>
                                    )}
                                </h3>
                            </div>
                            <div className="p-6">
                                {savedUniversities.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="text-3xl mb-3">🎓</div>
                                        <p className="text-sm text-gray-500 font-medium">No universities saved yet</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Complete the onboarding to discover and save universities matched to your profile.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {savedUniversities.map((uni, i) => (
                                            <div key={uni.name || i} className="flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-[#6605c7]/20 hover:shadow-sm transition-all group">
                                                <div className="w-10 h-10 bg-gradient-to-br from-[#6605c7]/10 to-[#a855f7]/10 rounded-lg flex items-center justify-center text-[#6605c7] font-bold text-sm flex-shrink-0">
                                                    {i + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-bold text-sm text-gray-900 truncate">{uni.name}</div>
                                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{uni.country || uni.loc}</span>
                                                        {uni.rank && (
                                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-500">
                                                                Rank #{uni.rank}
                                                            </span>
                                                        )}
                                                        {uni.tuition && (
                                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                                                                ${typeof uni.tuition === 'number' ? uni.tuition.toLocaleString() : uni.tuition}/yr
                                                            </span>
                                                        )}
                                                        {uni._score && (
                                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                                                                {uni._score}% match
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                    <button
                                                        onClick={() => {
                                                            const slug = uni.slug || uni.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                                                            router.push(`/university/${slug}`);
                                                        }}
                                                        className="px-3 py-1.5 text-[10px] font-bold text-[#6605c7] bg-[#6605c7]/5 rounded-lg hover:bg-[#6605c7]/10 transition-all"
                                                    >
                                                        View
                                                    </button>
                                                    <button
                                                        onClick={() => removeSavedUniversity(uni.name)}
                                                        className="p-1.5 text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Remove from saved"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <path d="M18 6L6 18M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Account & Data Management */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                                        <span className="material-symbols-outlined text-rose-500 text-lg">shield_person</span>
                                        Account & Data Management
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        Manage your personal data, data privacy requests, or permanently delete your account
                                    </p>
                                </div>
                                <Link
                                    href="/delete-account"
                                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors border border-rose-200 shadow-sm shrink-0"
                                >
                                    <span className="material-symbols-outlined text-sm">delete_forever</span>
                                    Delete Account
                                </Link>
                            </div>
                        </div>
                    </div>



                </div>
            </div>
        </div>
    );
}
