"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { adminApi, documentApi, referenceApi, mailApi } from "@/lib/api";
import { format } from "date-fns";

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { user } = useAuth();
    const { id: userId } = use(params);

    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState<any>(null);
    const [userApplications, setUserApplications] = useState<any[]>([]);
    const [userDocuments, setUserDocuments] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<"profile" | "applications" | "documents" | "bank_compare" | "mailbox">("profile");
    const [selectedApplication, setSelectedApplication] = useState<any>(null);

    // Dynamic Bank Partner & Comparison State
    const [bankPartners, setBankPartners] = useState<any[]>([]);
    const [comparedBankPartner, setComparedBankPartner] = useState<any>(null);
    const [updatingBank, setUpdatingBank] = useState(false);

    // Staff Operational & Mailbox Assignment State
    const [offices, setOffices] = useState<any[]>([]);
    const [s3Folders, setS3Folders] = useState<any[]>([]);
    const [showEditStaffModal, setShowEditStaffModal] = useState(false);
    const [savingStaff, setSavingStaff] = useState(false);
    const [staffForm, setStaffForm] = useState({
        staffId: "",
        firstName: "",
        lastName: "",
        phoneNumber: "",
        mailboxEmail: "",
        mailboxPrefix: "",
        canAccessSupport: false,
        officeId: "",
        officeLocation: "",
        isOnLeave: false,
        isResigned: false,
        department: "",
        designation: "",
    });

    useEffect(() => {
        const fetchUserDetails = async () => {
            setLoading(true);
            try {
                // Fetch user by ID first, fallback to list
                const [userRes, banksRes]: [any, any] = await Promise.all([
                    adminApi.getUserById(userId).catch(() => null),
                    referenceApi.getBanks().catch(() => ({ data: [] }))
                ]);
                let foundUser = userRes?.data || userRes?.user || userRes;
                if (!foundUser || !foundUser.id) {
                    const listRes: any = await adminApi.getUsers(200, 0).catch(() => ({ data: [] }));
                    foundUser = listRes.data?.find((u: any) => u.id === userId || u._id === userId);
                }
                
                const banks = banksRes.success && Array.isArray(banksRes.data) ? banksRes.data : [];
                setBankPartners(banks);

                if (foundUser) {
                    setUserData(foundUser);

                    const rawBank = (foundUser.bank || foundUser.partnerBank || foundUser.bankId || '').toString().trim();
                    const cleanBank = rawBank.toLowerCase().replace(/[^a-z0-9]/g, '');
                    
                    let matchedBank: any = null;
                    if (cleanBank && Array.isArray(banks) && banks.length > 0) {
                        matchedBank = banks.find((b: any) => {
                            const bShort = (b.shortName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                            const bName = (b.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                            const bId = (b.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                            return bShort === cleanBank || bName === cleanBank || bId === cleanBank ||
                                   cleanBank.includes(bShort) || (bShort && bShort.includes(cleanBank)) ||
                                   cleanBank.includes(bName) || (bName && bName.includes(cleanBank));
                        });
                    }

                    if (!matchedBank && foundUser.email && Array.isArray(banks) && banks.length > 0) {
                        const domain = (foundUser.email.split('@')[1] || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                        matchedBank = banks.find((b: any) => {
                            const bShort = (b.shortName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                            const bName = (b.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                            return (bShort && domain.includes(bShort)) || (bName && domain.includes(bName));
                        });
                    }

                    // Fuzzy match on user's name or email prefix (e.g. firstName: "idfc")
                    if (!matchedBank && Array.isArray(banks) && banks.length > 0) {
                        const nameParts = [foundUser.firstName, foundUser.lastName, (foundUser.email || '').split('@')[0]]
                            .filter(Boolean)
                            .join(' ')
                            .toLowerCase()
                            .replace(/[^a-z0-9\s]/g, '');
                        matchedBank = banks.find((b: any) => {
                            const bShort = (b.shortName || '').toLowerCase().trim();
                            const bName = (b.name || '').toLowerCase().trim();
                            return (bShort && bShort.length >= 3 && nameParts.includes(bShort)) ||
                                   (bName && bName.length >= 4 && nameParts.includes(bName));
                        });
                    }

                    if (!matchedBank && rawBank) {
                        const formattedName = rawBank
                            .split(/[-_]/)
                            .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
                            .join(' ');
                        matchedBank = {
                            id: rawBank,
                            name: formattedName,
                            shortName: rawBank.toUpperCase(),
                            type: 'Partner Bank Institution',
                            interestRateMin: 8.5,
                            interestRateMax: 13.5,
                            maxLoanAmount: '₹1.50 Cr',
                            collateralFreeLimit: '₹50 Lakhs',
                            processingTime: '3-5 Days',
                            processingFee: '0.5% - 1%',
                            features: ['Direct Sanction Line', 'Pre-Visa Disbursal', 'Competitive ROI']
                        };
                    }

                    if (!matchedBank && banks.length > 0 && (foundUser.role === 'bank' || foundUser.role === 'partner_bank')) {
                        matchedBank = banks[0];
                    }
                    setComparedBankPartner(matchedBank || null);

                    const isStaffUser = (foundUser.role || '').toLowerCase().includes('staff');
                    
                    // Fetch user's applications (applicant's loan submissions or staff's assigned cases)
                    try {
                        const appsRes = await adminApi.getApplications({ limit: '1000' }) as any;
                        const allApps = appsRes?.data || [];
                        if (isStaffUser) {
                            const staffApps = allApps.filter((app: any) => {
                                const sId = (app.assignedStaffId || '').toString().toLowerCase();
                                const uId = (userId || '').toLowerCase();
                                const stfId = (foundUser.staffId || '').toLowerCase();
                                const sEmail = (app.assignedStaffEmail || '').toString().toLowerCase();
                                const uEmail = (foundUser.email || '').toLowerCase();
                                return (sId && (sId === uId || sId === stfId)) ||
                                       (sEmail && sEmail === uEmail);
                            });
                            setUserApplications(staffApps);
                        } else {
                            const userApps = allApps.filter((app: any) => 
                                app.userId === userId || app.user_id === userId || app.applicantId === userId
                            );
                            setUserApplications(userApps);
                        }
                    } catch (e) {
                        console.error("Could not fetch applications:", e);
                    }

                    // Fetch user's documents if student
                    if (!isStaffUser) {
                        try {
                            const docsRes = await documentApi.getUsersDocuments(userId) as any;
                            setUserDocuments(docsRes.data || []);
                        } catch (e) {
                            console.log("Could not fetch documents:", e);
                        }
                    } else {
                        setUserDocuments([]);
                    }

                    // If staff user, fetch available offices and SES mailbox folders
                    if (isStaffUser) {
                        try {
                            const [offRes, foldersRes]: [any, any] = await Promise.all([
                                referenceApi.getOffices().catch(() => ({ data: [] })),
                                mailApi.getFolders().catch(() => ({ data: [] }))
                            ]);
                            const offList = offRes?.success && Array.isArray(offRes.data) ? offRes.data : (Array.isArray(offRes) ? offRes : []);
                            setOffices(offList);

                            const fList = foldersRes?.success && Array.isArray(foldersRes.data) ? foldersRes.data : [];
                            setS3Folders(fList);

                            setStaffForm({
                                staffId: foundUser.staffId || "",
                                firstName: foundUser.firstName || "",
                                lastName: foundUser.lastName || "",
                                phoneNumber: foundUser.phoneNumber || foundUser.mobile || "",
                                mailboxEmail: foundUser.mailboxEmail || "",
                                mailboxPrefix: foundUser.mailboxPrefix || "",
                                canAccessSupport: !!foundUser.canAccessSupport,
                                officeId: foundUser.officeId || "",
                                officeLocation: foundUser.officeLocation || (foundUser.office ? `${foundUser.office.name}, ${foundUser.office.city}` : ""),
                                isOnLeave: !!foundUser.isOnLeave,
                                isResigned: !!foundUser.isResigned,
                                department: foundUser.department || "Loan Verification & Operations",
                                designation: foundUser.designation || "Senior Education Loan Advisor",
                            });
                        } catch (err) {
                            console.warn("Could not load staff operational metadata:", err);
                        }
                    }
                }
            } catch (e) {
                console.error("Error fetching user details:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchUserDetails();
    }, [userId]);

    const handleUpdateBankAssignment = async (bankShortName: string) => {
        if (!userData) return;
        setUpdatingBank(true);
        try {
            await adminApi.updateUserDetails({
                email: userData.email,
                bank: bankShortName,
            } as any);
            const matched = bankPartners.find((b: any) => (b.shortName || '').toLowerCase() === bankShortName.toLowerCase()) || {
                id: bankShortName,
                name: bankShortName.toUpperCase(),
                shortName: bankShortName.toUpperCase(),
                type: 'Partner Bank Institution',
                interestRateMin: 8.5,
                interestRateMax: 14.5,
                maxLoanAmount: '₹1.50 Cr',
                collateralFreeLimit: '₹50 Lakhs',
                processingTime: '3-5 Days',
            };
            setComparedBankPartner(matched);
            setUserData((prev: any) => ({ ...prev, bank: bankShortName }));
            alert(`Lending Partner updated to "${bankShortName.toUpperCase()}" for ${userData.email}`);
        } catch (e: any) {
            alert("Failed to update bank partner assignment: " + (e.message || e));
        } finally {
            setUpdatingBank(false);
        }
    };

    const handleSaveStaffSettings = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!userData) return;
        setSavingStaff(true);
        try {
            let cleanPrefix = staffForm.mailboxPrefix ? staffForm.mailboxPrefix.trim() : "";
            if (cleanPrefix && !cleanPrefix.endsWith("/")) {
                cleanPrefix = `${cleanPrefix}/`;
            }

            const cleanEmail = staffForm.mailboxEmail ? staffForm.mailboxEmail.trim().toLowerCase() : "";

            const payload: any = {
                userId: userData.id,
                email: userData.email,
                firstName: staffForm.firstName,
                lastName: staffForm.lastName,
                phoneNumber: staffForm.phoneNumber,
                staffId: staffForm.staffId,
                mailboxEmail: cleanEmail,
                mailboxPrefix: cleanPrefix,
                canAccessSupport: staffForm.canAccessSupport,
                officeId: staffForm.officeId,
                officeLocation: staffForm.officeLocation,
                isOnLeave: staffForm.isOnLeave,
                isResigned: staffForm.isResigned,
                department: staffForm.department,
                designation: staffForm.designation,
            };

            const res: any = await adminApi.updateUserDetails(payload);
            if (res && res.success === false) {
                throw new Error(res.message || "Failed to update staff profile");
            }

            const matchedOffice = offices.find((o: any) => o.id === staffForm.officeId);

            setUserData((prev: any) => ({
                ...prev,
                ...payload,
                office: matchedOffice || prev?.office,
                officeLocation: matchedOffice ? `${matchedOffice.name}, ${matchedOffice.city}` : staffForm.officeLocation,
            }));

            setShowEditStaffModal(false);
            alert("Staff profile & mailbox configuration saved successfully!");
        } catch (err: any) {
            console.error("Error updating staff settings:", err);
            alert("Failed to update staff settings: " + (err.message || err));
        } finally {
            setSavingStaff(false);
        }
    };

    const handleAutoSuggestMailbox = () => {
        const cleanFirst = (staffForm.firstName || userData?.firstName || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        const cleanLast = (staffForm.lastName || userData?.lastName || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        if (!cleanFirst) {
            alert("Please enter a first name first.");
            return;
        }

        const alias = cleanLast ? `${cleanFirst}.${cleanLast}@vidyaloans.in` : `${cleanFirst}@vidyaloans.in`;

        const matched = s3Folders.find((f: any) => {
            const slug = (f.prefix || "").replace(/^staff\//, "").replace(/\/$/, "").toLowerCase();
            return slug === cleanFirst;
        });

        const prefix = matched ? matched.prefix : `${cleanFirst}/`;

        setStaffForm((prev: any) => ({
            ...prev,
            mailboxEmail: alias,
            mailboxPrefix: prefix,
        }));
    };

    const handleToggleLeaveQuick = async () => {
        if (!userData) return;
        const nextState = !userData.isOnLeave;
        const confirmMsg = nextState
            ? "Mark this staff member as On Leave? They will be temporarily skipped during round-robin auto-assignments."
            : "Mark this staff member as Available?";
        if (!window.confirm(confirmMsg)) return;

        try {
            await adminApi.updateUserDetails({
                userId: userData.id,
                email: userData.email,
                isOnLeave: nextState,
            } as any);
            setUserData((prev: any) => ({ ...prev, isOnLeave: nextState }));
            setStaffForm((prev: any) => ({ ...prev, isOnLeave: nextState }));
            alert(`Staff status updated: ${nextState ? 'On Leave' : 'Active & Ready'}`);
        } catch (err: any) {
            alert("Failed to update leave status: " + (err.message || err));
        }
    };

    const handleToggleResignedQuick = async () => {
        if (!userData) return;
        const nextState = !userData.isResigned;
        const confirmMsg = nextState
            ? "Mark this staff member as Resigned (Invalid)? They will be marked inactive and ineligible for assignments."
            : "Reinstate this staff member as Active?";
        if (!window.confirm(confirmMsg)) return;

        try {
            await adminApi.updateUserDetails({
                userId: userData.id,
                email: userData.email,
                isResigned: nextState,
            } as any);
            setUserData((prev: any) => ({ ...prev, isResigned: nextState }));
            setStaffForm((prev: any) => ({ ...prev, isResigned: nextState }));
            alert(`Staff status updated: ${nextState ? 'Resigned (Invalid)' : 'Active'}`);
        } catch (err: any) {
            alert("Failed to update status: " + (err.message || err));
        }
    };

    const handleBack = () => {
        router.back();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin" />
                    <p className="text-[11px] font-black tracking-widest text-slate-400 uppercase">Loading User Details...</p>
                </div>
            </div>
        );
    }

    if (!userData) {
        return (
            <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
                <div className="max-w-6xl mx-auto px-6 py-12 text-center">
                    <p className="text-slate-500">User not found</p>
                    <button
                        onClick={handleBack}
                        className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-4">
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 mb-4 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        Back to Dashboard
                    </button>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-black shadow-md border-4 border-white flex-shrink-0">
                                {(userData.firstName?.[0] || "U").toUpperCase()}{(userData.lastName?.[0] || "").toUpperCase()}
                            </div>
                            <div className="flex-1">
                                <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3 flex-wrap">
                                    <span>{userData.firstName || "—"} {userData.lastName || ""}</span>
                                    {userData.staffId && (
                                        <span className="font-mono text-xs px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-bold">
                                            {userData.staffId}
                                        </span>
                                    )}
                                </h1>
                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                    <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">
                                        ID: {userId}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                        userData.role?.includes("admin")
                                            ? "bg-slate-900 text-white border-slate-900"
                                            : userData.role?.includes("staff")
                                            ? "bg-blue-50 text-blue-700 border-blue-200"
                                            : userData.role?.includes("bank")
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                    }`}>
                                        {userData.role?.replace("_", " ") || "USER"}
                                    </span>
                                    {userData.mailboxEmail && (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded text-xs font-semibold">
                                            <span className="material-symbols-outlined text-[14px] text-blue-600">mail</span>
                                            <span className="font-mono">{userData.mailboxEmail}</span>
                                        </span>
                                    )}
                                    {comparedBankPartner && (userData.role?.includes("bank") || userData.bank) && (
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-xs font-black shadow-xs">
                                            {comparedBankPartner.logoUrl ? (
                                                <img src={comparedBankPartner.logoUrl} alt="" className="w-4 h-4 object-contain" />
                                            ) : (
                                                <span className="material-symbols-outlined text-[15px] text-emerald-600">account_balance</span>
                                            )}
                                            <span>Assigned Bank: {comparedBankPartner.name} ({comparedBankPartner.shortName})</span>
                                        </span>
                                    )}
                                    { (userData.createdAt || userData.created_at) && (
                                        <span className="text-[11px] font-medium text-slate-500">
                                            Joined: {new Date(userData.createdAt || userData.created_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })} IST (GMT+5:30)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {(userData.role || "").toLowerCase().includes("staff") && (
                            <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                                <button
                                    type="button"
                                    onClick={() => setShowEditStaffModal(true)}
                                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
                                    Assign Mail & Settings
                                </button>
                                {userData.mailboxPrefix && (
                                    <button
                                        type="button"
                                        onClick={() => window.open(`/staff/inbox?folder=${encodeURIComponent(userData.mailboxPrefix)}`, '_blank')}
                                        className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                                        title="Open Staff Inbox"
                                    >
                                        <span className="material-symbols-outlined text-[16px] text-indigo-600">inbox</span>
                                        Staff Inbox
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tab Navigation */}
                {(() => {
                    const isStaff = (userData?.role || "").toLowerCase().includes("staff");
                    const isBank = (userData?.role || "").toLowerCase().includes("bank");
                    const tabs = [
                        { id: "profile", label: isStaff ? "Staff Identity & Profile" : "Profile Information", icon: "badge" },
                        { id: "applications", label: isStaff ? "Assigned Applications & Leads" : "Applications", icon: "description", count: userApplications.length },
                        ...(isStaff ? [
                            { id: "mailbox", label: "Assigned Mailbox & Routing", icon: "mail" },
                        ] : [
                            { id: "documents", label: "Documents", icon: "folder", count: userDocuments.length },
                        ]),
                        ...(isBank ? [
                            { id: "bank_compare", label: "Bank Profile & Compare", icon: "account_balance" },
                        ] : []),
                    ];

                    return (
                        <div className="max-w-6xl mx-auto px-6 flex gap-8 border-t border-slate-200 overflow-x-auto">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`py-4 font-bold text-[13px] uppercase tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                                        activeTab === tab.id
                                            ? tab.id === "bank_compare" ? "border-emerald-600 text-emerald-600" : "border-indigo-600 text-indigo-600"
                                            : "border-transparent text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                                    {tab.label}
                                    {tab.count !== undefined && (
                                        <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    );
                })()}
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Profile Tab */}
                {activeTab === "profile" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* If bank user has no assigned bank yet, display quick assignment action */}
                        {!comparedBankPartner && (userData.role?.includes("bank") || userData.bank) && (
                            <div className="lg:col-span-2 bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-2xl border-2 border-dashed border-amber-300 p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-2xl shadow-xs flex-shrink-0">
                                        <span className="material-symbols-outlined text-[28px]">account_balance</span>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-amber-950">No Lending Partner Assigned</h3>
                                        <p className="text-xs text-amber-800 mt-1">Assign this bank representative to an authorized institutional partner to link loan underwriting.</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                                    <select
                                        disabled={updatingBank}
                                        onChange={(e) => {
                                            if (e.target.value) handleUpdateBankAssignment(e.target.value);
                                        }}
                                        defaultValue=""
                                        className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-sm transition-all focus:outline-none"
                                    >
                                        <option value="" disabled>+ Assign Bank Partner Institution</option>
                                        {bankPartners.map((bp: any) => (
                                            <option key={bp.id || bp.shortName} value={bp.shortName} className="bg-white text-slate-900">
                                                {bp.name} ({bp.shortName})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Assigned Lending Partner Institution Profile (for Bank Users) */}
                        {comparedBankPartner && (userData.role?.includes("bank") || userData.bank) && (
                            <div className="lg:col-span-2 bg-gradient-to-br from-emerald-50/90 via-teal-50/30 to-white rounded-2xl border-2 border-emerald-200 p-8 shadow-sm space-y-6 relative overflow-hidden">
                                <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-100/50 rounded-full blur-2xl pointer-events-none" />

                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-emerald-200/80 pb-5">
                                    <div className="flex items-center gap-4">
                                        {comparedBankPartner.logoUrl ? (
                                            <img
                                                src={comparedBankPartner.logoUrl}
                                                alt=""
                                                className="w-16 h-16 object-contain bg-white rounded-2xl p-2 border border-emerald-200 shadow-sm"
                                            />
                                        ) : (
                                            <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-2xl shadow-sm">
                                                <span className="material-symbols-outlined text-[32px]">account_balance</span>
                                            </div>
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                                    {comparedBankPartner.name}
                                                </h2>
                                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                                                    {comparedBankPartner.shortName}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mt-1 flex items-center gap-2">
                                                <span>{comparedBankPartner.type || 'Lending Partner Institution'}</span>
                                                <span>•</span>
                                                <span className="text-emerald-700 font-semibold">Assigned Underwriting Representative</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            onClick={() => setActiveTab("bank_compare")}
                                            className="px-3.5 py-2 bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-50 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs"
                                        >
                                            Switch / Compare
                                        </button>
                                    </div>
                                </div>

                                {/* Core Lending Parameters Grid */}
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-emerald-900 mb-3 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px] text-emerald-600">analytics</span>
                                        Lending Master Parameters
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                                        <div className="p-3.5 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">Interest Rate (ROI)</span>
                                            <p className="text-base font-black text-emerald-950 mt-0.5">
                                                {comparedBankPartner.interestRateMin || 8.5}% - {comparedBankPartner.interestRateMax || 14.5}%
                                            </p>
                                            <span className="text-[10px] font-semibold text-slate-500">per annum</span>
                                        </div>
                                        <div className="p-3.5 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">Max Sanction Cap</span>
                                            <p className="text-base font-black text-slate-900 mt-0.5">
                                                {comparedBankPartner.maxLoanAmount || '₹1.50 Cr'}
                                            </p>
                                            <span className="text-[10px] font-semibold text-slate-500">Maximum Limit</span>
                                        </div>
                                        <div className="p-3.5 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">Collateral-Free Limit</span>
                                            <p className="text-base font-black text-slate-900 mt-0.5">
                                                {comparedBankPartner.collateralFreeLimit || '₹50 Lakhs'}
                                            </p>
                                            <span className="text-[10px] font-semibold text-slate-500">Unsecured Threshold</span>
                                        </div>
                                        <div className="p-3.5 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">Turnaround / SLA</span>
                                            <p className="text-base font-black text-slate-900 mt-0.5">
                                                {comparedBankPartner.processingTime || '3-5 Days'}
                                            </p>
                                            <span className="text-[10px] font-semibold text-slate-500">Fee: {comparedBankPartner.processingFee || '0.5% - 1%'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Fields Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-emerald-100/70 text-xs">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Official Bank Code / ID</p>
                                        <p className="font-mono font-bold text-slate-900">{comparedBankPartner.shortName || comparedBankPartner.id || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Institution Category</p>
                                        <p className="font-semibold text-slate-900">{comparedBankPartner.type || 'Lending Partner'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Official Website</p>
                                        {comparedBankPartner.website ? (
                                            <a
                                                href={comparedBankPartner.website}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="font-bold text-emerald-700 hover:text-emerald-900 underline truncate block"
                                            >
                                                {comparedBankPartner.website.replace(/^https?:\/\/(www\.)?/, '')}
                                            </a>
                                        ) : (
                                            <p className="font-semibold text-slate-400">—</p>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Representative Email</p>
                                        <p className="font-semibold text-slate-900 truncate">{userData.email || comparedBankPartner.email || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Contact / Support</p>
                                        <p className="font-semibold text-slate-900">{comparedBankPartner.contactNumber || '1800-425-1800'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Collateral Requirement</p>
                                        <p className="font-semibold text-slate-900">
                                            {comparedBankPartner.collateralRequired ? 'Required above unsecured limit' : 'Collateral-free options available'}
                                        </p>
                                    </div>
                                </div>

                                {/* Key Features & Schemes */}
                                {Array.isArray(comparedBankPartner.features) && comparedBankPartner.features.length > 0 && (
                                    <div className="pt-2">
                                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">Approved Loan Products & Special Schemes</p>
                                        <div className="flex flex-wrap gap-2">
                                            {comparedBankPartner.features.map((f: string, i: number) => (
                                                <span key={i} className="px-3 py-1 bg-white border border-emerald-200 text-emerald-900 rounded-lg text-xs font-bold shadow-2xs">
                                                    ✓ {f}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Staff Operational & Assigned Mailbox Hero Card */}
                        {(userData.role || "").toLowerCase().includes("staff") && (
                            <div className="lg:col-span-2 bg-gradient-to-br from-indigo-50/90 via-slate-50 to-white rounded-2xl border-2 border-indigo-200 p-8 shadow-sm space-y-6 relative overflow-hidden">
                                <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-100/60 rounded-full blur-3xl pointer-events-none" />

                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-indigo-100 pb-5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-sm flex-shrink-0">
                                            <span className="material-symbols-outlined text-[32px]">badge</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                                    {userData.firstName} {userData.lastName}
                                                </h2>
                                                {userData.staffId && (
                                                    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-black font-mono uppercase tracking-wider bg-indigo-600 text-white shadow-xs">
                                                        {userData.staffId}
                                                    </span>
                                                )}
                                                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                                                    userData.isResigned 
                                                        ? "bg-rose-50 text-rose-700 border-rose-200" 
                                                        : userData.isOnLeave 
                                                        ? "bg-amber-50 text-amber-700 border-amber-200" 
                                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                }`}>
                                                    {userData.isResigned ? "Resigned" : (userData.isOnLeave ? "On Leave" : "Active Staff")}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider mt-1 flex items-center gap-2 flex-wrap">
                                                <span>{userData.designation || "Staff Operations"}</span>
                                                <span>•</span>
                                                <span className="text-slate-600 font-semibold">{userData.department || "Loan Verification & Operations"}</span>
                                                <span>•</span>
                                                <span className="text-indigo-700 font-semibold flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[14px]">location_on</span>
                                                    {userData.office?.name ? `${userData.office.name} (${userData.officeLocation || userData.office.city || ''})` : (userData.officeLocation || "Headquarters")}
                                                </span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <button
                                            type="button"
                                            onClick={() => setShowEditStaffModal(true)}
                                            className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">mail</span>
                                            Assign Mail & Settings
                                        </button>
                                        {userData.mailboxPrefix && (
                                            <button
                                                type="button"
                                                onClick={() => window.open(`/staff/inbox?folder=${encodeURIComponent(userData.mailboxPrefix)}`, '_blank')}
                                                className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                                                title="Open Staff S3 Mailbox"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">inbox</span>
                                                Staff Inbox
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* SES Mailbox & Routing Specs */}
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-indigo-900 mb-3 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px] text-indigo-600">mark_email_read</span>
                                        Assigned SES Mailbox & Storage Routing
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        <div className="p-4 bg-white/80 rounded-xl border border-indigo-100 shadow-2xs">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Official SES Mailbox</span>
                                            {userData.mailboxEmail ? (
                                                <div className="flex items-center gap-1.5 text-indigo-950 font-bold text-sm">
                                                    <span className="material-symbols-outlined text-[16px] text-indigo-600">mail</span>
                                                    <span className="font-mono text-xs">{userData.mailboxEmail}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-amber-600 text-xs font-bold">
                                                    <span className="material-symbols-outlined text-[14px]">warning</span>
                                                    <span>No Mailbox Assigned</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="p-4 bg-white/80 rounded-xl border border-indigo-100 shadow-2xs">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">S3 Mail Storage Prefix</span>
                                            {userData.mailboxPrefix ? (
                                                <div className="flex items-center gap-1.5 text-slate-900 font-bold text-sm">
                                                    <span className="material-symbols-outlined text-[16px] text-indigo-600">folder_shared</span>
                                                    <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{userData.mailboxPrefix}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 font-semibold">Default / Isolated</span>
                                            )}
                                        </div>

                                        <div className="p-4 bg-white/80 rounded-xl border border-indigo-100 shadow-2xs">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Shared Support Inbox</span>
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wide border ${
                                                userData.canAccessSupport 
                                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200" 
                                                    : "bg-slate-50 text-slate-600 border-slate-200"
                                            }`}>
                                                <span className="material-symbols-outlined text-[13px]">
                                                    {userData.canAccessSupport ? "check_circle" : "block"}
                                                </span>
                                                {userData.canAccessSupport ? "Full Team Access" : "Restricted / Own Only"}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Operational Parameters & Quick Controls */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-1 border-t border-indigo-100/60">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Staff ID</p>
                                        <p className="font-mono font-bold text-slate-900">{userData.staffId || "—"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Assigned Branch Office</p>
                                        <p className="font-semibold text-slate-900 truncate">
                                            {userData.office?.name || userData.officeLocation || "Headquarters"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Active Leads / Apps</p>
                                        <p className="font-bold text-indigo-700">{userApplications.length} assigned</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Quick Status Action</p>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={handleToggleLeaveQuick}
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                                                    userData.isOnLeave
                                                        ? "bg-amber-600 text-white border-amber-600"
                                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                                }`}
                                            >
                                                {userData.isOnLeave ? "On Leave" : "Set Leave"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleToggleResignedQuick}
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-all ${
                                                    userData.isResigned
                                                        ? "bg-rose-600 text-white border-rose-600"
                                                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                                }`}
                                            >
                                                {userData.isResigned ? "Resigned" : "Resign"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Personal Information */}
                        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined">person</span>
                                Personal Information
                            </h2>
                            <div className="grid grid-cols-2 gap-6">
                                {(userData.role || "").toLowerCase().includes("staff") && (
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Staff ID</p>
                                        <p className="text-[14px] font-bold font-mono text-indigo-600">{userData.staffId || "—"}</p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">First Name</p>
                                    <p className="text-[14px] font-semibold text-slate-900">{userData.firstName || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Last Name</p>
                                    <p className="text-[14px] font-semibold text-slate-900">{userData.lastName || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Login Email</p>
                                    <p className="text-[14px] font-semibold text-slate-900 lowercase">{userData.email || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Phone / Mobile</p>
                                    <p className="text-[14px] font-semibold text-slate-900">{userData.mobile || userData.phone || userData.phoneNumber || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Role</p>
                                    <p className="text-[14px] font-semibold text-slate-900 capitalize">{userData.role || "—"}</p>
                                </div>
                                {(userData.role || "").toLowerCase().includes("staff") ? (
                                    <>
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Designation</p>
                                            <p className="text-[14px] font-semibold text-slate-900">{userData.designation || "Staff Operations"}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Operational Department</p>
                                            <p className="text-[14px] font-semibold text-slate-900">{userData.department || "Loan Verification & Operations"}</p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Assigned Branch Office</p>
                                            <p className="text-[14px] font-semibold text-slate-900">
                                                {userData.office?.name ? `${userData.office.name} (${userData.officeLocation || userData.office.city || ''})` : (userData.officeLocation || "Headquarters / Main Branch")}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Official SES Mailbox</p>
                                            <p className="text-[14px] font-semibold text-indigo-700 font-mono">
                                                {userData.mailboxEmail || <span className="text-slate-400 font-sans">Not Assigned</span>}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">S3 Mail Storage Prefix</p>
                                            <p className="text-[14px] font-semibold text-slate-900 font-mono">
                                                {userData.mailboxPrefix || <span className="text-slate-400 font-sans">Default Isolated</span>}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Support Inbox Access</p>
                                            <p className="text-[14px] font-semibold text-slate-900">
                                                {userData.canAccessSupport ? "Shared Access (Full Support Team)" : "Restricted (Own Mailbox Only)"}
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Assigned Lending Bank</p>
                                        {comparedBankPartner ? (
                                            <div className="flex items-center gap-2">
                                                {comparedBankPartner.logoUrl && (
                                                    <img src={comparedBankPartner.logoUrl} alt="" className="w-5 h-5 object-contain" />
                                                )}
                                                <p className="text-[14px] font-bold text-slate-900">
                                                    {comparedBankPartner.name} <span className="text-emerald-700 font-black text-xs">({comparedBankPartner.shortName})</span>
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-[14px] font-semibold text-slate-400">—</p>
                                        )}
                                    </div>
                                )}
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Account Status</p>
                                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                        userData.isResigned 
                                            ? "bg-rose-50 text-rose-700 border-rose-200" 
                                            : userData.isOnLeave 
                                            ? "bg-amber-50 text-amber-700 border-amber-200" 
                                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`}>
                                        {userData.isResigned ? "Resigned" : (userData.isOnLeave ? "On Leave" : "Active")}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Security & Session Section */}
                        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
                            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <span className="material-symbols-outlined">security</span>
                                Security & Session
                            </h2>
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Last Login Location</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px] text-emerald-500">pin_drop</span>
                                        <p className="text-[14px] font-semibold text-slate-900">{userData.last_login_location || "Unknown"}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Last Login IP</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px] text-slate-500">router</span>
                                        <p className="text-[14px] font-semibold text-slate-900 font-mono tracking-tight">{userData.last_login_ip || "0.0.0.0"}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Last Login Device</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px] text-slate-500">devices</span>
                                        <p className="text-[14px] font-semibold text-slate-900">{userData.last_login_device || "Unknown"}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Last Login Timestamp</p>
                                    <div className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[14px] text-slate-500">schedule</span>
                                        <p className="text-[14px] font-semibold text-slate-900">
                                            {userData.last_login_at ? format(new Date(userData.last_login_at), "MMM d, yyyy 'at' hh:mm a") : "Never"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="space-y-4">
                            {(userData.role || "").toLowerCase() === "staff" ? (
                                <>
                                    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Staff Designation</p>
                                        <p className="text-xl font-black text-indigo-600 tracking-tight">{userData.designation || "Staff Operations"}</p>
                                    </div>
                                    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Availability Status</p>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2.5 h-2.5 rounded-full ${userData.isOnLeave ? 'bg-amber-500' : userData.isResigned ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                                            <p className="text-xl font-black text-slate-900">{userData.isOnLeave ? "On Leave" : (userData.isResigned ? "Resigned" : "Active & Ready")}</p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Applications</p>
                                        <p className="text-3xl font-black text-slate-900">{userApplications.length}</p>
                                    </div>
                                    <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Documents</p>
                                        <p className="text-3xl font-black text-slate-900">{userDocuments.length}</p>
                                    </div>
                                </>
                            )}
                            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-sm">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">{(userData.role || "").toLowerCase() === "staff" ? "Staff Member Since" : "Member Since"}</p>
                                <p className="text-sm font-semibold text-slate-900">
                                    {(userData.createdAt || userData.created_at) ? `${new Date(userData.createdAt || userData.created_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} IST (GMT+5:30)` : "—"}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Applications Tab */}
                {activeTab === "applications" && (userData.role || "").toLowerCase() !== "staff" && (
                    <>
                        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                            {userApplications.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                <th className="px-6 py-3">Application ID</th>
                                                <th className="px-6 py-3">Bank</th>
                                                <th className="px-6 py-3">Loan Type</th>
                                                <th className="px-6 py-3">Status</th>
                                                <th className="px-6 py-3">Created Date</th>
                                                <th className="px-6 py-3 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {userApplications.map((app, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4 text-[12px] font-bold text-slate-900">
                                                        {app.applicationNumber || app.id?.slice(0, 8).toUpperCase()}
                                                    </td>
                                                    <td className="px-6 py-4 text-[12px] font-semibold text-slate-700">{app.bank || "—"}</td>
                                                    <td className="px-6 py-4 text-[12px] font-semibold text-slate-700">{app.loanType || "—"}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                                            app.status === "approved"
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                : app.status === "rejected"
                                                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                                                : app.status === "processing"
                                                                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                                : "bg-amber-50 text-amber-700 border-amber-200"
                                                        }`}>
                                                            {app.status || "Pending"}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-[12px] font-semibold text-slate-500">
                                                        {app.createdAt ? format(new Date(app.createdAt), "MMM d, yyyy") : "—"}
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button onClick={() => setSelectedApplication(app)} className="w-8 h-8 rounded bg-slate-100 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 flex items-center justify-center transition-all" title="View">
                                                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="py-16 text-center">
                                    <span className="material-symbols-outlined text-[48px] text-slate-300 mx-auto block mb-4">inbox</span>
                                    <p className="text-slate-500 font-semibold">No applications found for this user</p>
                                </div>
                            )}
                        </div>

                        {/* Application Details Panel */}
                        {selectedApplication && (
                            <div className="mt-8 bg-white rounded-lg border border-slate-200 shadow-sm p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                        <span className="material-symbols-outlined">description</span>
                                        Application Details
                                    </h3>
                                    <button
                                        onClick={() => setSelectedApplication(null)}
                                        className="w-8 h-8 rounded bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all"
                                        title="Close"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Left Column - Basic Info */}
                                    <div className="space-y-6">
                                        <div className="border-b border-slate-200 pb-6">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Application ID</p>
                                            <p className="text-[16px] font-black text-slate-900">
                                                {selectedApplication.applicationNumber || selectedApplication.id?.slice(0, 8).toUpperCase()}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Bank/Lender</p>
                                            <p className="text-[14px] font-semibold text-slate-900">{selectedApplication.bank || "—"}</p>
                                        </div>

                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Loan Type</p>
                                            <p className="text-[14px] font-semibold text-slate-900">{selectedApplication.loanType || "—"}</p>
                                        </div>

                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Status</p>
                                            <span className={`inline-block px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wide border ${
                                                selectedApplication.status === "approved"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                    : selectedApplication.status === "rejected"
                                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                                    : selectedApplication.status === "processing"
                                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                            }`}>
                                                {selectedApplication.status || "Pending"}
                                            </span>
                                        </div>

                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Created Date</p>
                                            <p className="text-[14px] font-semibold text-slate-900">
                                                {selectedApplication.createdAt ? format(new Date(selectedApplication.createdAt), "MMMM d, yyyy 'at' hh:mm a") : "—"}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Right Column - Additional Details */}
                                    <div className="space-y-6">
                                        {selectedApplication.loanAmount && (
                                            <div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Loan Amount</p>
                                                <p className="text-[16px] font-black text-slate-900">₹{selectedApplication.loanAmount.toLocaleString()}</p>
                                            </div>
                                        )}

                                        {selectedApplication.tenure && (
                                            <div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Loan Tenure</p>
                                                <p className="text-[14px] font-semibold text-slate-900">{selectedApplication.tenure} months</p>
                                            </div>
                                        )}

                                        {selectedApplication.interestRate && (
                                            <div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Interest Rate</p>
                                                <p className="text-[14px] font-semibold text-slate-900">{selectedApplication.interestRate}%</p>
                                            </div>
                                        )}

                                        {selectedApplication.updatedAt && (
                                            <div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Last Updated</p>
                                                <p className="text-[14px] font-semibold text-slate-900">
                                                    {format(new Date(selectedApplication.updatedAt), "MMMM d, yyyy 'at' hh:mm a")}
                                                </p>
                                            </div>
                                        )}

                                        {selectedApplication.remarks && (
                                            <div>
                                                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Remarks</p>
                                                <p className="text-[13px] text-slate-700 bg-slate-50 border border-slate-200 rounded p-3">{selectedApplication.remarks}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Full Width Details */}
                                <div className="mt-8 pt-6 border-t border-slate-200 space-y-6">
                                    {selectedApplication.purpose && (
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Purpose</p>
                                            <p className="text-[13px] text-slate-700">{selectedApplication.purpose}</p>
                                        </div>
                                    )}

                                    {selectedApplication.documents && selectedApplication.documents.length > 0 && (
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3">Attached Documents</p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                {selectedApplication.documents.map((doc: any, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded">
                                                        <span className="material-symbols-outlined text-[18px] text-slate-400">description</span>
                                                        <span className="text-[12px] font-semibold text-slate-700">{doc.docType || doc}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Staff Assigned Applications Tab */}
                {activeTab === "applications" && (userData.role || "").toLowerCase().includes("staff") && (
                    <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[20px] text-indigo-600">assignment_ind</span>
                                    Applications & Leads Assigned to {userData.firstName} {userData.lastName}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Track student loan applications and applicant cases routed to this officer for verification and processing.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold border border-indigo-100">
                                    Total Assigned: {userApplications.length}
                                </span>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            {userApplications.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                <th className="px-6 py-3.5">Application ID</th>
                                                <th className="px-6 py-3.5">Borrower / Applicant</th>
                                                <th className="px-6 py-3.5">Bank Partner</th>
                                                <th className="px-6 py-3.5">Loan Type & Amount</th>
                                                <th className="px-6 py-3.5">Status</th>
                                                <th className="px-6 py-3.5">Assigned / Created</th>
                                                <th className="px-6 py-3.5 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {userApplications.map((app: any, idx: number) => {
                                                const applicantName = app.fullName || app.studentName || [app.firstName, app.lastName].filter(Boolean).join(" ") || "Applicant";
                                                const applicantContact = app.phone || app.mobile || app.email || "—";
                                                return (
                                                    <tr key={app.id || idx} className="hover:bg-indigo-50/30 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="font-mono text-xs font-bold text-slate-900">
                                                                {app.applicationNumber || app.id?.slice(0, 8).toUpperCase()}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-xs font-bold text-slate-900">{applicantName}</div>
                                                            <div className="text-[11px] text-slate-500">{applicantContact}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-semibold text-slate-700">
                                                            {app.bank || "General Pool"}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-xs font-bold text-slate-900">
                                                                {app.loanAmount ? `₹${Number(app.loanAmount).toLocaleString()}` : "—"}
                                                            </div>
                                                            <div className="text-[11px] text-slate-500">{app.loanType || "Education Loan"}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                                                app.status === "approved"
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                    : app.status === "rejected"
                                                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                                                    : app.status === "processing"
                                                                    ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                                            }`}>
                                                                {app.status || "Pending"}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-medium text-slate-500">
                                                            {app.createdAt ? format(new Date(app.createdAt), "MMM d, yyyy") : "—"}
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedApplication(app)}
                                                                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-500 inline-flex items-center justify-center transition-all cursor-pointer"
                                                                title="View Details"
                                                            >
                                                                <span className="material-symbols-outlined text-[16px]">visibility</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="py-20 text-center">
                                    <span className="material-symbols-outlined text-[48px] text-slate-300 mx-auto block mb-3">folder_open</span>
                                    <p className="text-slate-700 font-bold text-sm">No applications assigned yet</p>
                                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                        When student loan applications are assigned to this officer, they will appear here with full tracking history.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Staff Selected Application Details Drawer */}
                        {selectedApplication && (
                            <div className="bg-white rounded-2xl border border-indigo-200 shadow-md p-8 relative">
                                <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[22px]">description</span>
                                        </div>
                                        <div>
                                            <h3 className="text-base font-bold text-slate-900">
                                                Application {selectedApplication.applicationNumber || selectedApplication.id?.slice(0, 8).toUpperCase()}
                                            </h3>
                                            <p className="text-xs text-slate-500">Applicant: {selectedApplication.fullName || selectedApplication.studentName || selectedApplication.email || "—"}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedApplication(null)}
                                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                                        title="Close"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs">
                                    <div className="p-3 bg-slate-50 rounded-xl">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Lending Bank</span>
                                        <span className="font-bold text-slate-900">{selectedApplication.bank || "—"}</span>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Loan Amount</span>
                                        <span className="font-bold text-indigo-700 text-sm">
                                            {selectedApplication.loanAmount ? `₹${Number(selectedApplication.loanAmount).toLocaleString()}` : "—"}
                                        </span>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Loan Type</span>
                                        <span className="font-bold text-slate-900">{selectedApplication.loanType || "Education Loan"}</span>
                                    </div>
                                    <div className="p-3 bg-slate-50 rounded-xl">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Current Status</span>
                                        <span className="font-bold uppercase tracking-wider text-indigo-600">{selectedApplication.status || "Pending"}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Documents Tab */}
                {activeTab === "documents" && (userData.role || "").toLowerCase() !== "staff" && (
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                        {userDocuments.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
                                {userDocuments.map((doc, idx) => (
                                    <div key={idx} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="flex items-start gap-3 mb-3">
                                            <span className="material-symbols-outlined text-[24px] text-slate-400">description</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12px] font-bold text-slate-900 truncate">{doc.docType || doc.type || "Document"}</p>
                                                <p className="text-[10px] font-medium text-slate-500 truncate">{doc.fileName || "No filename"}</p>
                                            </div>
                                        </div>
                                        {doc.uploadedAt && (
                                            <p className="text-[10px] font-medium text-slate-400">
                                                {format(new Date(doc.uploadedAt), "MMM d, yyyy")}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="py-16 text-center">
                                <span className="material-symbols-outlined text-[48px] text-slate-300 mx-auto block mb-4">folder_open</span>
                                <p className="text-slate-500 font-semibold">No documents found for this user</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Bank Profile & Comparison Tab */}
                {activeTab === "bank_compare" && (
                    <div className="space-y-6">
                        {/* Comparison Switcher & Summary Bar */}
                        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-100 border border-emerald-200 rounded-2xl p-6 shadow-sm">
                            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-xs uppercase tracking-wider">
                                        <span className="material-symbols-outlined text-[20px] text-emerald-600">account_balance</span>
                                        Bank Profile vs Bank Partner Comparison Engine
                                    </div>
                                    <p className="text-xs text-emerald-900 font-medium mt-1">
                                        Compare this user identity & buffer workload against all active institutional lending partner configurations.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 w-full md:w-auto">
                                    <div className="relative flex-1 md:w-64">
                                        <select
                                            value={comparedBankPartner?.shortName || ""}
                                            onChange={(e) => {
                                                const partner = bankPartners.find(b => b.shortName === e.target.value);
                                                setComparedBankPartner(partner || null);
                                            }}
                                            className="w-full px-4 py-2.5 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer shadow-xs"
                                        >
                                            {bankPartners.map((bp: any) => (
                                                <option key={bp.id || bp.shortName} value={bp.shortName}>
                                                    {bp.name} ({bp.shortName.toUpperCase()})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Side by Side Comparison Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Left Box: User Identity & Profile Specs */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black">
                                                <span className="material-symbols-outlined text-[20px]">person</span>
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold text-slate-900">User Profile Identity</h3>
                                                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{userData.email}</p>
                                            </div>
                                        </div>
                                        <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider ${
                                            userData.role?.includes('bank') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {userData.role?.toUpperCase() || 'USER'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Full Legal Name</span>
                                            <p className="font-bold text-slate-900 mt-1">{userData.firstName || "—"} {userData.lastName || ""}</p>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Phone / Mobile</span>
                                            <p className="font-bold text-slate-900 mt-1 font-mono">{userData.mobile || userData.phone || userData.phoneNumber || "—"}</p>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Assigned Lending Partner</span>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className="material-symbols-outlined text-[16px] text-indigo-600">account_balance</span>
                                                <p className="font-black text-indigo-900">
                                                    {userData.bank ? userData.bank.toUpperCase() : "Default / Unassigned"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Application Queue</span>
                                            <p className="font-black text-slate-900 mt-1 text-sm">{userApplications.length} File{userApplications.length === 1 ? '' : 's'}</p>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Last Login IP</span>
                                            <p className="font-mono text-slate-700 mt-1">{userData.last_login_ip || "0.0.0.0"}</p>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Last Login Location</span>
                                            <p className="font-semibold text-slate-700 mt-1">{userData.last_login_location || "Unknown"}</p>
                                        </div>
                                    </div>
                                </div>

                                {comparedBankPartner && (
                                    <div className="mt-6 pt-4 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => handleUpdateBankAssignment(comparedBankPartner.shortName)}
                                            disabled={updatingBank || userData.bank === comparedBankPartner.shortName}
                                            className={`w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                                userData.bank === comparedBankPartner.shortName
                                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-[16px]">
                                                {userData.bank === comparedBankPartner.shortName ? 'check_circle' : 'link'}
                                            </span>
                                            {userData.bank === comparedBankPartner.shortName
                                                ? 'Assigned to This Lending Partner'
                                                : `Set Active Bank Partner to ${comparedBankPartner.shortName.toUpperCase()}`}
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Right Box: Master Bank Partner Parameters */}
                            <div className="bg-white rounded-2xl border-2 border-emerald-200 p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
                                <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-50 rounded-full blur-2xl pointer-events-none" />

                                {comparedBankPartner ? (
                                    <div>
                                        <div className="flex items-center justify-between pb-4 mb-5 border-b border-emerald-100">
                                            <div className="flex items-center gap-3">
                                                {comparedBankPartner.logoUrl ? (
                                                    <img src={comparedBankPartner.logoUrl} alt="" className="w-10 h-10 rounded-xl object-contain bg-slate-50 border border-slate-200 p-1" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                                                        <span className="material-symbols-outlined text-[20px]">account_balance</span>
                                                    </div>
                                                )}
                                                <div>
                                                    <h3 className="text-sm font-black text-slate-900 leading-tight">{comparedBankPartner.name}</h3>
                                                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">{comparedBankPartner.type || 'LENDING INSTITUTION'}</span>
                                                </div>
                                            </div>
                                            <span className="px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                                                {comparedBankPartner.shortName}
                                            </span>
                                        </div>

                                        <div className="space-y-4 text-xs">
                                            <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-100">
                                                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-800 block">Interest Rate Spread (ROI)</span>
                                                <p className="text-emerald-950 font-black text-base mt-0.5">
                                                    {comparedBankPartner.interestRateMin || 8.5}% - {comparedBankPartner.interestRateMax || 14.5}% <span className="text-xs font-semibold text-emerald-700">p.a.</span>
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Max Loan Limit</span>
                                                    <p className="font-black text-slate-900 mt-1">{comparedBankPartner.maxLoanAmount || '₹1.50 Cr'}</p>
                                                </div>
                                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Collateral-Free Cap</span>
                                                    <p className="font-black text-slate-900 mt-1">{comparedBankPartner.collateralFreeLimit || '₹50 Lakhs'}</p>
                                                </div>
                                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Turnaround SLA</span>
                                                    <p className="font-black text-slate-900 mt-1">{comparedBankPartner.processingTime || '3-5 Days'}</p>
                                                </div>
                                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Processing Fee</span>
                                                    <p className="font-black text-slate-900 mt-1">{comparedBankPartner.processingFee || '0.5% - 1%'}</p>
                                                </div>
                                            </div>

                                            {Array.isArray(comparedBankPartner.features) && comparedBankPartner.features.length > 0 && (
                                                <div>
                                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">Underwriting Scheme Highlights</span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {comparedBankPartner.features.slice(0, 5).map((feature: string, idx: number) => (
                                                            <span key={idx} className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg text-[10px] font-bold border border-emerald-100">
                                                                ✓ {feature}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-16">
                                        <span className="material-symbols-outlined text-4xl text-slate-300 block mb-2">account_balance</span>
                                        <p className="text-xs text-slate-400 font-bold">Select a Bank Partner from the dropdown to compare specifications.</p>
                                    </div>
                                )}

                                {comparedBankPartner?.website && (
                                    <div className="mt-6 pt-4 border-t border-slate-100">
                                        <a
                                            href={comparedBankPartner.website}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center justify-center gap-1.5"
                                        >
                                            <span>Visit Official {comparedBankPartner.name} Portal</span>
                                            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Staff Assigned Mailbox & Routing Tab */}
                {activeTab === "mailbox" && (
                    <div className="space-y-6">
                        {/* Mailbox Status & Hero Bar */}
                        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="space-y-2">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-wider text-indigo-100">
                                        <span className="material-symbols-outlined text-[16px]">verified</span>
                                        SES Real-Time Inbound Routing
                                    </div>
                                    <h2 className="text-2xl font-black tracking-tight">
                                        {userData.mailboxEmail || `${(userData.firstName || "staff").toLowerCase()}@vidyaloans.in`}
                                    </h2>
                                    <p className="text-indigo-100 text-xs max-w-xl leading-relaxed">
                                        Emails routed to this SES mailbox are automatically sorted into AWS S3 storage under prefix{" "}
                                        <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded font-bold">{userData.mailboxPrefix || "isolated/"}</span>.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditStaffModal(true)}
                                        className="px-4 py-2.5 bg-white text-indigo-900 hover:bg-indigo-50 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">tune</span>
                                        Configure Mailbox
                                    </button>
                                    {userData.mailboxPrefix && (
                                        <button
                                            type="button"
                                            onClick={() => window.open(`/staff/inbox?folder=${encodeURIComponent(userData.mailboxPrefix)}`, '_blank')}
                                            className="px-4 py-2.5 bg-indigo-500/40 hover:bg-indigo-500/60 text-white border border-white/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">launch</span>
                                            Open Inbox
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Mailbox Architecture & Permissions Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-4">
                                    <span className="material-symbols-outlined text-[20px]">alternate_email</span>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">SES Mailbox Identifier</span>
                                <p className="font-mono font-bold text-slate-900 text-sm truncate">
                                    {userData.mailboxEmail || "Not Assigned"}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-2">
                                    Used for sending/receiving borrower loan queries & correspondence.
                                </p>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold mb-4">
                                    <span className="material-symbols-outlined text-[20px]">folder_special</span>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">S3 Folder Storage Path</span>
                                <p className="font-mono font-bold text-slate-900 text-sm">
                                    {userData.mailboxPrefix ? `vidyaloans-incoming-emails/${userData.mailboxPrefix}` : "Default isolated"}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-2">
                                    Raw MIME messages and parsed JSON bodies are synced to this path.
                                </p>
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-4">
                                    <span className="material-symbols-outlined text-[20px]">groups</span>
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Support Team Access</span>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`w-2 h-2 rounded-full ${userData.canAccessSupport ? "bg-emerald-500" : "bg-slate-400"}`} />
                                    <span className="font-bold text-slate-900 text-sm">
                                        {userData.canAccessSupport ? "Shared Support Access" : "Isolated Folder Only"}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-2">
                                    {userData.canAccessSupport 
                                        ? "Can read shared incoming/ and support/ team queues." 
                                        : "Can only view their own assigned S3 folder."}
                                </p>
                            </div>
                        </div>

                        {/* S3 Buckets & Detected Folders */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[18px] text-indigo-600">cloud</span>
                                        Available S3 Storage Folders Detected in SES Bucket
                                    </h4>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Click any detected folder to assign it directly as this staff member's storage prefix.
                                    </p>
                                </div>
                                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
                                    {s3Folders.length} Folders Found
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                {s3Folders.map((folder: string, idx: number) => {
                                    const isCurrent = userData.mailboxPrefix === folder;
                                    return (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                                setStaffForm(prev => ({ ...prev, mailboxPrefix: folder }));
                                                setShowEditStaffModal(true);
                                            }}
                                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                                isCurrent
                                                    ? "bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs"
                                                    : "bg-slate-50/70 border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-xs"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="material-symbols-outlined text-[18px] text-slate-400">folder</span>
                                                {isCurrent && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-600 text-white">
                                                        Assigned
                                                    </span>
                                                )}
                                            </div>
                                            <span className="font-mono text-xs font-bold text-slate-800 truncate">{folder}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Edit Staff Settings & Mailbox Assignment Modal */}
            {showEditStaffModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-8 max-h-[90vh] overflow-y-auto space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-xs">
                                    <span className="material-symbols-outlined text-[24px]">manage_accounts</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                                        Staff Operational & Mailbox Settings
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Configure identity, SES inbound email routing, office branch, and status.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowEditStaffModal(false)}
                                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>

                        <div className="space-y-5">
                            {/* Staff ID & Names */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                                        Staff ID
                                    </label>
                                    <input
                                        type="text"
                                        value={staffForm.staffId}
                                        onChange={(e) => setStaffForm({ ...staffForm, staffId: e.target.value })}
                                        placeholder="e.g. VL-STF-001"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                                        First Name
                                    </label>
                                    <input
                                        type="text"
                                        value={staffForm.firstName}
                                        onChange={(e) => setStaffForm({ ...staffForm, firstName: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                                        Last Name
                                    </label>
                                    <input
                                        type="text"
                                        value={staffForm.lastName}
                                        onChange={(e) => setStaffForm({ ...staffForm, lastName: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Phone & Operational Department */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                                        Mobile / Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        value={staffForm.phoneNumber}
                                        onChange={(e) => setStaffForm({ ...staffForm, phoneNumber: e.target.value })}
                                        placeholder="e.g. +91 98765 43210"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                                        Operational Department
                                    </label>
                                    <input
                                        type="text"
                                        value={staffForm.department}
                                        onChange={(e) => setStaffForm({ ...staffForm, department: e.target.value })}
                                        placeholder="e.g. Loan Verification & Operations"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Designation & Office */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                                        Designation / Staff Role
                                    </label>
                                    <input
                                        type="text"
                                        value={staffForm.designation}
                                        onChange={(e) => setStaffForm({ ...staffForm, designation: e.target.value })}
                                        placeholder="e.g. Senior Underwriting Specialist"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                                        Assigned Branch Office
                                    </label>
                                    <select
                                        value={staffForm.officeId}
                                        onChange={(e) => setStaffForm({ ...staffForm, officeId: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                                    >
                                        <option value="">Headquarters / Main Branch</option>
                                        {offices.map((office: any) => (
                                            <option key={office.id} value={office.id}>
                                                {office.name} ({office.city || office.location || "Office"})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* SES Mailbox Assignment with Auto-Suggest */}
                            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-[11px] font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px] text-indigo-600">mail</span>
                                        Assigned SES Mailbox Email
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleAutoSuggestMailbox}
                                        className="text-[10px] font-black uppercase tracking-wider text-indigo-600 hover:text-indigo-800 bg-white px-2.5 py-1 rounded-md border border-indigo-200 cursor-pointer shadow-2xs hover:bg-indigo-50 transition-all flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-[12px]">auto_fix_high</span>
                                        Auto-Suggest
                                    </button>
                                </div>
                                <input
                                    type="email"
                                    value={staffForm.mailboxEmail}
                                    onChange={(e) => setStaffForm({ ...staffForm, mailboxEmail: e.target.value })}
                                    placeholder="e.g. laila@vidyaloans.in"
                                    className="w-full px-3.5 py-2.5 bg-white border border-indigo-200 rounded-xl text-xs font-mono font-bold text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                                <p className="text-[10px] text-indigo-800/80">
                                    Inbound mail sent to this address via AWS SES is delivered directly into this staff member's inbox.
                                </p>
                            </div>

                            {/* S3 Storage Prefix & Support Access */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                                        S3 Folder Storage Prefix
                                    </label>
                                    <div className="flex gap-2">
                                        <select
                                            value={s3Folders.includes(staffForm.mailboxPrefix) ? staffForm.mailboxPrefix : "custom"}
                                            onChange={(e) => {
                                                if (e.target.value !== "custom") {
                                                    setStaffForm({ ...staffForm, mailboxPrefix: e.target.value });
                                                }
                                            }}
                                            className="w-1/2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-semibold text-slate-900 focus:outline-none cursor-pointer"
                                        >
                                            <option value="">(Select Folder)</option>
                                            {s3Folders.map((f: string, i: number) => (
                                                <option key={i} value={f}>{f}</option>
                                            ))}
                                            <option value="custom">Custom...</option>
                                        </select>
                                        <input
                                            type="text"
                                            value={staffForm.mailboxPrefix}
                                            onChange={(e) => setStaffForm({ ...staffForm, mailboxPrefix: e.target.value })}
                                            placeholder="e.g. laila/"
                                            className="w-1/2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">S3 bucket folder path (must end with /)</p>
                                </div>

                                <div className="flex flex-col justify-center">
                                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100/70 transition-all cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={staffForm.canAccessSupport}
                                            onChange={(e) => setStaffForm({ ...staffForm, canAccessSupport: e.target.checked })}
                                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <div>
                                            <span className="text-xs font-bold text-slate-900 block">Support Team Shared Access</span>
                                            <span className="text-[10px] text-slate-500 block">Can read shared incoming/ & support/ folders</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Status Toggles (Leave / Resigned) */}
                            <div className="pt-2 border-t border-slate-100 flex items-center gap-4 flex-wrap">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={staffForm.isOnLeave}
                                        onChange={(e) => setStaffForm({ ...staffForm, isOnLeave: e.target.checked })}
                                        className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-700">Mark as On Leave</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={staffForm.isResigned}
                                        onChange={(e) => setStaffForm({ ...staffForm, isResigned: e.target.checked })}
                                        className="w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-700">Mark as Resigned</span>
                                </label>
                            </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setShowEditStaffModal(false)}
                                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={savingStaff}
                                onClick={handleSaveStaffSettings}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-50"
                            >
                                {savingStaff ? (
                                    <>
                                        <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[16px]">save</span>
                                        Save Operational Settings
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
