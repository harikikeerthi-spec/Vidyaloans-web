"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";

export default function UserProfileEdit({ params }: { params?: Promise<{ id: string }> | { id: string } }) {
    const router = useRouter();
    const routeParams = useParams();
    const resolvedParams = params && typeof (params as any)?.then === "function" ? use(params as Promise<{ id: string }>) : (params as { id?: string });
    const userId = (resolvedParams?.id || routeParams?.id || "") as string;

    // State management
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeStep, setActiveStep] = useState(1);
    const [activeTab, setActiveTab] = useState("personal");
    const [userData, setUserData] = useState<any>(null);

    const [form, setForm] = useState({
        firstName: "", middleName: "", lastName: "",
        validPassport: "Yes", passportNo: "", passportExpiry: "", issueCountry: "",
        email: "", secondaryEmail: "", primaryContact: "", phone2: "",
        dob: "", gender: "", maritalStatus: "", firstLanguage: "English",
        address1: "", address2: "", country: "", state: "", city: "", zip: "",
        sameAsMailing: false
    });

    // Fetch user data on component mount
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                setLoading(true);
                // Get the admin token from localStorage
                const token = typeof window !== 'undefined'
                    ? (localStorage.getItem('adminAccessToken') || localStorage.getItem('staffAccessToken') || localStorage.getItem('accessToken') || '')
                    : '';
                const response = await fetch(`/api/users/admin/${userId}`, {
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                });
                if (!response.ok) {
                    throw new Error("Failed to fetch user data");
                }
                const resJson = await response.json();
                const data = resJson.data || resJson.user || resJson;
                setUserData(data);
                
                // Populate form with user data
                setForm(prev => ({
                    ...prev,
                    firstName: data.firstName || "",
                    lastName: data.lastName || "",
                    email: data.email || "",
                    primaryContact: data.phoneNumber || data.mobile || "",
                    dob: data.dateOfBirth || "",
                }));
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load user data");
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [userId]);

    // Format date helper function
    const formatDate = (dateString: string | null | undefined) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
            });
        } catch {
            return 'N/A';
        }
    };

    // Format time ago helper function
    const formatTimeAgo = (dateString: string | null | undefined) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            const diffMonths = Math.floor(diffDays / 30);
            const diffYears = Math.floor(diffMonths / 12);

            if (diffYears > 0) return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`;
            if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`;
            if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            return 'Today';
        } catch {
            return 'N/A';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            {/* Error Banner */}
            {error && (
                <div className="bg-red-50 border-b border-red-200 px-6 py-3">
                    <div className="max-w-7xl mx-auto flex items-center gap-3 text-red-700">
                        <span className="material-symbols-outlined">error</span>
                        <p className="text-sm font-bold">{error}</p>
                    </div>
                </div>
            )}

            {/* Header / Breadcrumbs */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-2 text-sm font-medium text-slate-500">
                    <Link 
                        href={
                            userData?.role === 'bank' ? "/admin/users/banks" :
                            userData?.role === 'staff' ? "/admin/users/staff" :
                            userData?.role === 'agent' ? "/admin/users/agents" : "/admin/users/students"
                        } 
                        className="hover:text-indigo-600 transition-colors"
                    >
                        {userData?.role === 'bank' ? "Bank Partners" :
                         userData?.role === 'staff' ? "Staff Operations" :
                         userData?.role === 'agent' ? "Agent Partners" : "Students"}
                    </Link>
                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    <span className="text-slate-900 font-bold">{form.firstName || "Loading..."} {form.lastName}</span>
                </div>
                
                <div className="max-w-7xl mx-auto px-6 pb-6 pt-2 flex items-start justify-between">
                    <div className="flex items-center gap-5">
                        <button onClick={() => router.back()} className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer">
                            <span className="material-symbols-outlined">arrow_back</span>
                        </button>
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-black shadow-md border-4 border-white">
                            {(form.firstName?.[0] || "U").toUpperCase()}{(form.lastName?.[0] || "").toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                                {loading ? (
                                    <div className="h-8 w-48 bg-slate-200 rounded animate-pulse"></div>
                                ) : (
                                    `${form.firstName || (userData?.role === 'bank' ? 'Bank Representative' : 'User')} ${form.lastName || ''}`
                                )}
                            </h1>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                {loading ? (
                                    <div className="flex gap-2">
                                        <div className="h-6 w-32 bg-slate-200 rounded animate-pulse"></div>
                                        <div className="h-6 w-40 bg-slate-200 rounded animate-pulse"></div>
                                    </div>
                                ) : (
                                    <>
                                        <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                                            ID: {userId}
                                        </span>
                                        <span className="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-emerald-200 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            Member Since {formatDate(userData?.createdAt)}
                                        </span>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded border flex items-center gap-1 ${
                                            userData?.role === 'admin' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                            userData?.role === 'staff' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
                                            userData?.role === 'bank' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                            userData?.role === 'agent' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                            'bg-blue-50 text-blue-600 border-blue-200'
                                        }`}>
                                            {userData?.role ? userData.role.toUpperCase() : 'USER'}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <button className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-lg shadow hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">save</span>
                        Save Profile
                    </button>
                </div>
                
                {/* Steps Menu */}
                <div className="max-w-7xl mx-auto px-6 flex gap-8">
                    {[
                        { id: 1, label: "Profile" },
                        { id: 2, label: "Applications" },
                        { id: 3, label: "Documents" },
                    ].map(step => (
                        <button
                            key={step.id}
                            onClick={() => setActiveStep(step.id)}
                            className={`pb-3 font-bold text-[13px] uppercase tracking-wide border-b-2 transition-colors flex items-center gap-2 ${activeStep === step.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            <div className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center border ${activeStep === step.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                                {step.id}
                            </div>
                            {step.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {activeStep === 1 ? (
                    <div className="flex gap-8 items-start">
                        {/* Sidebar Tabs */}
                        <div className="w-64 shrink-0 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm sticky top-48">
                            {[
                                { id: "personal", label: "Personal Information", icon: "badge" },
                                { id: "account", label: "Account Details", icon: "security" },
                                { id: "academic", label: "Academic Qualifications", icon: "school" },
                                { id: "work", label: "Work Experience", icon: "work" },
                                { id: "tests", label: "Tests", icon: "quiz" },
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full text-left px-5 py-4 font-bold text-sm flex items-center gap-3 transition-colors border-l-4 ${activeTab === tab.id ? 'bg-indigo-50/50 border-indigo-600 text-indigo-700' : 'border-transparent bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
                                >
                                    <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm p-8 pb-12">
                            {activeTab === "account" && (
                                <div className="space-y-8">
                                    {/* Account Overview Card */}
                                    <section>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-100 pb-3 flex items-center gap-2">
                                            <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
                                            Account Overview
                                        </h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            {/* User ID */}
                                            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-lg p-5">
                                                <p className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-2">User ID</p>
                                                <p className="text-lg font-black text-blue-900 font-mono">{userData?.id || 'N/A'}</p>
                                            </div>

                                            {/* Member Since */}
                                            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-lg p-5">
                                                <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-2">Member Since</p>
                                                <p className="text-lg font-black text-emerald-900">{formatDate(userData?.createdAt)}</p>
                                                <p className="text-xs text-emerald-700 font-semibold mt-1">{formatTimeAgo(userData?.createdAt)}</p>
                                            </div>

                                            {/* Role */}
                                            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 border border-purple-200 rounded-lg p-5">
                                                <p className="text-[11px] font-bold text-purple-600 uppercase tracking-wider mb-2">User Role</p>
                                                <p className="text-lg font-black text-purple-900 capitalize">{userData?.role || 'user'}</p>
                                                <div className="mt-2 inline-block">
                                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                                        userData?.role === 'admin' ? 'bg-purple-200 text-purple-700' :
                                                        userData?.role === 'staff' ? 'bg-indigo-200 text-indigo-700' :
                                                        'bg-slate-200 text-slate-700'
                                                    }`}>
                                                        {userData?.role?.charAt(0).toUpperCase() + (userData?.role?.slice(1) || 'User')}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Account Status */}
                                            <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-lg p-5">
                                                <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-2">Account Status</p>
                                                <p className="text-lg font-black text-amber-900">Active</p>
                                                <div className="mt-2 inline-flex items-center gap-1.5">
                                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                                    <span className="text-xs font-bold text-emerald-700">Verified</span>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Contact Information */}
                                    <section>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-100 pb-3 flex items-center gap-2">
                                            <span className="w-1.5 h-4 bg-cyan-500 rounded-full"></span>
                                            Contact Information
                                        </h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</p>
                                                <p className="text-sm font-black text-slate-900 break-all">{userData?.email || 'N/A'}</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</p>
                                                <p className="text-sm font-black text-slate-900">{userData?.phoneNumber || <span className="text-slate-400 font-semibold">Not provided</span>}</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Date of Birth</p>
                                                <p className="text-sm font-black text-slate-900">{userData?.dateOfBirth || <span className="text-slate-400 font-semibold">Not provided</span>}</p>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Registration Details */}
                                    <section>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-100 pb-3 flex items-center gap-2">
                                            <span className="w-1.5 h-4 bg-pink-500 rounded-full"></span>
                                            Registration Details
                                        </h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Registration Date</p>
                                                <p className="text-sm font-black text-slate-900">{formatDate(userData?.createdAt)}</p>
                                                <p className="text-xs text-slate-600 mt-1">{formatTimeAgo(userData?.createdAt)}</p>
                                            </div>
                                            <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Last Updated</p>
                                                <p className="text-sm font-black text-slate-900">{formatDate(userData?.updatedAt)}</p>
                                                <p className="text-xs text-slate-600 mt-1">{formatTimeAgo(userData?.updatedAt)}</p>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}
                            {activeTab === "personal" && (
                                <div className="space-y-10">
                                    {/* Personal Details */}
                                    <section>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-100 pb-3 flex items-center gap-2">
                                            <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                                            Personal Details
                                        </h3>
                                        <div className="grid grid-cols-3 gap-6">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">First Name</label>
                                                <input type="text" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Middle Name</label>
                                                <input type="text" value={form.middleName} onChange={e => setForm({...form, middleName: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Last Name</label>
                                                <input type="text" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Valid Passport</label>
                                                <select value={form.validPassport} onChange={e => setForm({...form, validPassport: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all appearance-none">
                                                    <option>Yes</option>
                                                    <option>No</option>
                                                </select>
                                            </div>
                                            {form.validPassport === 'Yes' && (
                                                <>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Passport No</label>
                                                        <input type="text" value={form.passportNo} onChange={e => setForm({...form, passportNo: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Passport Expiry</label>
                                                        <input type="date" value={form.passportExpiry} onChange={e => setForm({...form, passportExpiry: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all text-slate-500" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Issue Country</label>
                                                        <input type="text" value={form.issueCountry} onChange={e => setForm({...form, issueCountry: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </section>
                                    
                                    {/* Contact Structure */}
                                    <section>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-100 pb-3 flex items-center gap-2">
                                            <span className="w-1.5 h-4 bg-teal-500 rounded-full"></span>
                                            Contact Structure
                                        </h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
                                                <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Secondary Email</label>
                                                <input type="email" value={form.secondaryEmail} onChange={e => setForm({...form, secondaryEmail: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Primary Contact</label>
                                                <input type="tel" value={form.primaryContact} onChange={e => setForm({...form, primaryContact: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Phone 2 (Optional)</label>
                                                <input type="tel" value={form.phone2} onChange={e => setForm({...form, phone2: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                            </div>
                                        </div>
                                    </section>

                                    {/* Demographics */}
                                    <section>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-100 pb-3 flex items-center gap-2">
                                            <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span>
                                            Demographics
                                        </h3>
                                        <div className="grid grid-cols-4 gap-6">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Date of Birth</label>
                                                <input type="date" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all text-slate-500" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Gender</label>
                                                <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all appearance-none">
                                                    <option value="">Select Gender</option>
                                                    <option>Male</option>
                                                    <option>Female</option>
                                                    <option>Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Marital Status</label>
                                                <select value={form.maritalStatus} onChange={e => setForm({...form, maritalStatus: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all appearance-none">
                                                    <option value="">Select Status</option>
                                                    <option>Single</option>
                                                    <option>Married</option>
                                                    <option>Divorced</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">First Language</label>
                                                <select value={form.firstLanguage} onChange={e => setForm({...form, firstLanguage: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all appearance-none">
                                                    <option>English</option>
                                                    <option>Hindi</option>
                                                    <option>Telugu</option>
                                                    <option>Tamil</option>
                                                    <option>Other</option>
                                                </select>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Mailing Address */}
                                    <section>
                                        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-100 pb-3 flex items-center gap-2">
                                            <span className="w-1.5 h-4 bg-emerald-500 rounded-full"></span>
                                            Mailing Address
                                        </h3>
                                        <div className="grid grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Address line 1</label>
                                                <input type="text" value={form.address1} onChange={e => setForm({...form, address1: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Address line 2</label>
                                                <input type="text" value={form.address2} onChange={e => setForm({...form, address2: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Country</label>
                                                <input type="text" value={form.country} onChange={e => setForm({...form, country: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">State / Province</label>
                                                <input type="text" value={form.state} onChange={e => setForm({...form, state: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">City</label>
                                                <input type="text" value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Zip/Postal code</label>
                                                <input type="text" value={form.zip} onChange={e => setForm({...form, zip: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition-all" />
                                            </div>
                                        </div>
                                        <div className="mt-6 flex items-center gap-3 bg-slate-50 p-4 rounded-lg border border-slate-100">
                                            <input 
                                                type="checkbox" 
                                                id="sameAsMailing" 
                                                checked={form.sameAsMailing}
                                                onChange={e => setForm({...form, sameAsMailing: e.target.checked})}
                                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" 
                                            />
                                            <label htmlFor="sameAsMailing" className="text-sm font-bold text-slate-700">Same as mailing address for Permanent Address</label>
                                        </div>
                                    </section>
                                </div>
                            )}
                            {activeTab !== "personal" && activeTab !== "account" && (
                                <div className="text-center py-20 text-slate-400">
                                    <span className="material-symbols-outlined text-[48px] mb-4 opacity-50">construction</span>
                                    <p className="text-sm font-bold uppercase tracking-widest">Section Under Construction</p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm h-96 flex flex-col items-center justify-center text-slate-400">
                        <span className="material-symbols-outlined text-[64px] mb-4 opacity-50">pending</span>
                        <p className="text-sm font-bold uppercase tracking-widest">More detailed views coming soon</p>
                    </div>
                )}
            </div>
        </div>
    );
}
