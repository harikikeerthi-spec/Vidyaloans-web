"use client";

import { useState, useEffect, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { adminApi, documentApi, referenceApi } from "@/lib/api";
import { format } from "date-fns";

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { user } = useAuth();
    const { id: userId } = use(params);

    const [loading, setLoading] = useState(true);
    const [userData, setUserData] = useState<any>(null);
    const [userApplications, setUserApplications] = useState<any[]>([]);
    const [userDocuments, setUserDocuments] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<"profile" | "applications" | "documents" | "bank_compare">("profile");
    const [selectedApplication, setSelectedApplication] = useState<any>(null);

    // Dynamic Bank Partner & Comparison State
    const [bankPartners, setBankPartners] = useState<any[]>([]);
    const [comparedBankPartner, setComparedBankPartner] = useState<any>(null);
    const [updatingBank, setUpdatingBank] = useState(false);

    // Staff Operational Assignment State
    const [offices, setOffices] = useState<any[]>([]);
    const [showEditStaffModal, setShowEditStaffModal] = useState(false);
    const [savingStaff, setSavingStaff] = useState(false);
    const [staffForm, setStaffForm] = useState({
        staffId: "",
        firstName: "",
        lastName: "",
        phoneNumber: "",
        officeId: "",
        officeLocation: "",
        isOnLeave: false,
        isResigned: false,
        department: "",
        designation: "",
    });

    // Staff Assigned Applications & Leads Filters
    const [caseTypeFilter, setCaseTypeFilter] = useState<"all" | "application" | "lead">("all");
    const [caseSearchTerm, setCaseSearchTerm] = useState("");
    const [caseStatusFilter, setCaseStatusFilter] = useState("all");

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
                        const allApps = Array.isArray(appsRes?.data) ? appsRes.data : (Array.isArray(appsRes) ? appsRes : []);
                        if (isStaffUser) {
                            const staffApps = allApps.filter((app: any) => {
                                const sId = (app.assignedStaffId || app.assignedStaff?.id || app.assignedStaff?.staffId || '').toString().toLowerCase();
                                const uId = (userId || '').toLowerCase();
                                const stfId = (foundUser.staffId || '').toLowerCase();
                                const fUserId = (foundUser.id || '').toLowerCase();
                                const sEmail = (app.assignedStaffEmail || app.assignedStaff?.email || '').toString().toLowerCase();
                                const uEmail = (foundUser.email || '').toLowerCase();
                                const staffFullName = `${foundUser.firstName || ''} ${foundUser.lastName || ''}`.trim().toLowerCase();
                                const assignedName = (app.assignedStaffName || app.staffName || app.assignedOfficer || '').toString().trim().toLowerCase();

                                return (
                                    (sId && (sId === uId || sId === stfId || sId === fUserId)) ||
                                    (sEmail && uEmail && sEmail === uEmail) ||
                                    (staffFullName && assignedName && (assignedName === staffFullName || assignedName.includes(staffFullName)))
                                );
                            });
                            setUserApplications(staffApps);
                        } else {
                            const userApps = allApps.filter((app: any) =>
                                app.userId === userId || app.user_id === userId || app.applicantId === userId || app.studentId === userId
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

                    // If staff user, fetch available branch offices
                    if (isStaffUser) {
                        try {
                            const offRes: any = await referenceApi.getOffices().catch(() => ({ data: [] }));
                            const offList = offRes?.success && Array.isArray(offRes.data) ? offRes.data : (Array.isArray(offRes) ? offRes : []);
                            setOffices(offList);

                            setStaffForm({
                                staffId: foundUser.staffId || "",
                                firstName: foundUser.firstName || "",
                                lastName: foundUser.lastName || "",
                                phoneNumber: foundUser.phoneNumber || foundUser.mobile || "",
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

    // Helper to determine whether an assigned case is a bank application or an intake lead
    const isApplicationRecord = (app: any) => {
        const s = (app.status || "").toLowerCase();
        const bw = (app.bankWorkflowStatus || "").toUpperCase();
        return Boolean(
            app.submittedToBankAt ||
            app.bankSubmissionId ||
            (bw && bw !== "NONE" && bw !== "") ||
            ["submitted_to_bank", "routed_multiparty", "file_logged", "under_bank_review", "processing", "sanctioned", "approved", "disbursed", "disbursement_confirmed"].includes(s)
        );
    };

    const staffMetrics = useMemo(() => {
        let bankAppsCount = 0;
        let leadsCount = 0;
        let totalValue = 0;

        userApplications.forEach((app: any) => {
            if (isApplicationRecord(app)) {
                bankAppsCount++;
            } else {
                leadsCount++;
            }
            const amt = Number(app.amount || app.loanAmount || 0);
            if (!isNaN(amt)) {
                totalValue += amt;
            }
        });

        const formattedTotalValue = totalValue >= 10000000
            ? `₹${(totalValue / 10000000).toFixed(2)} Cr`
            : totalValue >= 100000
                ? `₹${(totalValue / 100000).toFixed(2)} Lakhs`
                : `₹${totalValue.toLocaleString('en-IN')}`;

        return {
            bankAppsCount,
            leadsCount,
            totalValue,
            formattedTotalValue,
        };
    }, [userApplications]);

    const filteredStaffCases = useMemo(() => {
        return userApplications.filter((app: any) => {
            const isApp = isApplicationRecord(app);
            if (caseTypeFilter === "application" && !isApp) return false;
            if (caseTypeFilter === "lead" && isApp) return false;

            if (caseStatusFilter !== "all") {
                const s = (app.status || "").toLowerCase();
                if (s !== caseStatusFilter.toLowerCase()) return false;
            }

            if (caseSearchTerm.trim()) {
                const q = caseSearchTerm.toLowerCase();
                const name = `${app.firstName || ''} ${app.lastName || ''} ${app.fullName || ''} ${app.studentName || ''}`.toLowerCase();
                const email = (app.email || app.user?.email || '').toLowerCase();
                const phone = (app.phone || app.mobile || app.user?.phoneNumber || '').toLowerCase();
                const appNum = (app.applicationNumber || app.id || '').toLowerCase();
                const uni = (app.universityName || app.college || '').toLowerCase();
                const bank = (app.bank || '').toLowerCase();

                if (!name.includes(q) && !email.includes(q) && !phone.includes(q) && !appNum.includes(q) && !uni.includes(q) && !bank.includes(q)) {
                    return false;
                }
            }

            return true;
        });
    }, [userApplications, caseTypeFilter, caseStatusFilter, caseSearchTerm]);

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
            const payload: any = {
                userId: userData.id,
                email: userData.email,
                firstName: staffForm.firstName,
                lastName: staffForm.lastName,
                phoneNumber: staffForm.phoneNumber,
                staffId: staffForm.staffId,
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
            alert("Staff profile & operational settings saved successfully!");
        } catch (err: any) {
            console.error("Error updating staff settings:", err);
            alert("Failed to update staff settings: " + (err.message || err));
        } finally {
            setSavingStaff(false);
        }
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
                                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${userData.role?.includes("admin")
                                        ? "bg-slate-900 text-white border-slate-900"
                                        : userData.role?.includes("staff")
                                            ? "bg-blue-50 text-blue-700 border-blue-200"
                                            : userData.role?.includes("bank")
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                        }`}>
                                        {userData.role?.replace("_", " ") || "USER"}
                                    </span>
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
                                    {(userData.createdAt || userData.created_at) && (
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
                                    Edit Staff Profile
                                </button>
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
                        { id: "applications", label: isStaff ? "Assigned Applications & Leads" : "Applications", icon: isStaff ? "assignment_ind" : "description", count: userApplications.length },
                        ...(!isStaff ? [
                            { id: "documents", label: "Documents", icon: "folder", count: userDocuments.length },
                        ] : []),
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
                                    className={`py-4 font-bold text-[13px] uppercase tracking-wide border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${activeTab === tab.id
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
                                                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${userData.isResigned
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
                                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">manage_accounts</span>
                                            Edit Staff Profile
                                        </button>
                                    </div>
                                </div>

                                {/* Dynamic Caseload & Assigned Portfolio Overview */}
                                <div>
                                    <h3 className="text-xs font-black uppercase tracking-widest text-indigo-900 mb-3 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[16px] text-indigo-600">analytics</span>
                                        Assigned Caseload & Portfolio Overview
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="p-4 bg-white/90 backdrop-blur rounded-xl border border-indigo-100 shadow-2xs">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Total Assigned Cases</span>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xl font-black text-slate-900">{userApplications.length}</span>
                                                <span className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-[18px]">assignment_ind</span>
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-indigo-600 font-semibold mt-1 block">Active total cases</span>
                                        </div>

                                        <div className="p-4 bg-white/90 backdrop-blur rounded-xl border border-indigo-100 shadow-2xs">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Active Loan Applications</span>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xl font-black text-indigo-700">{staffMetrics.bankAppsCount}</span>
                                                <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-[18px]">account_balance</span>
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-medium mt-1 block">In bank processing</span>
                                        </div>

                                        <div className="p-4 bg-white/90 backdrop-blur rounded-xl border border-indigo-100 shadow-2xs">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Assigned Leads & Intake</span>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xl font-black text-amber-600">{staffMetrics.leadsCount}</span>
                                                <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-[18px]">contact_mail</span>
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-medium mt-1 block">Pre-submission verification</span>
                                        </div>

                                        <div className="p-4 bg-white/90 backdrop-blur rounded-xl border border-indigo-100 shadow-2xs">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">Total Pipeline Value</span>
                                            <div className="flex items-center justify-between">
                                                <span className="text-base font-black text-emerald-700">{staffMetrics.formattedTotalValue}</span>
                                                <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                    <span className="material-symbols-outlined text-[18px]">payments</span>
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-500 font-medium mt-1 block">Assigned portfolio volume</span>
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
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Active Leads & Apps</p>
                                        <p className="font-bold text-indigo-700">{userApplications.length} cases ({staffMetrics.bankAppsCount} apps, {staffMetrics.leadsCount} leads)</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Quick Status Action</p>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={handleToggleLeaveQuick}
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-all ${userData.isOnLeave
                                                    ? "bg-amber-600 text-white border-amber-600"
                                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                                    }`}
                                            >
                                                {userData.isOnLeave ? "On Leave" : "Set Leave"}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleToggleResignedQuick}
                                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border cursor-pointer transition-all ${userData.isResigned
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
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Staff ID Code</p>
                                            <p className="text-[14px] font-semibold text-indigo-700 font-mono">
                                                {userData.staffId || <span className="text-slate-400 font-sans">Not Assigned</span>}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Assigned Cases Workload</p>
                                            <p className="text-[14px] font-bold text-slate-900">
                                                {userApplications.length} Cases ({staffMetrics.bankAppsCount} Apps, {staffMetrics.leadsCount} Leads)
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">Operational Availability</p>
                                            <p className="text-[14px] font-semibold text-slate-900">
                                                {userData.isResigned ? "Resigned / Inactive" : userData.isOnLeave ? "On Temporary Leave" : "Active & Processing Cases"}
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
                                    <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${userData.isResigned
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
                                                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${app.status === "approved"
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
                                            <span className={`inline-block px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wide border ${selectedApplication.status === "approved"
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

                {/* Staff Assigned Applications & Leads Tab */}
                {activeTab === "applications" && (userData.role || "").toLowerCase().includes("staff") && (
                    <div className="space-y-6">
                        {/* Header & KPI Summary */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[22px] text-indigo-600">assignment_ind</span>
                                    Applications & Leads Assigned to {userData.firstName} {userData.lastName}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    Track student loan cases and early intake leads routed to this officer with real-time status and financial parameters.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-xl text-xs font-bold border border-indigo-100 flex items-center gap-1.5 shadow-2xs">
                                    <span className="material-symbols-outlined text-[15px]">folder_shared</span>
                                    Total: {userApplications.length}
                                </span>
                                <span className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold border border-blue-100 flex items-center gap-1.5 shadow-2xs">
                                    <span className="material-symbols-outlined text-[15px]">account_balance</span>
                                    Apps: {staffMetrics.bankAppsCount}
                                </span>
                                <span className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold border border-amber-100 flex items-center gap-1.5 shadow-2xs">
                                    <span className="material-symbols-outlined text-[15px]">contact_mail</span>
                                    Leads: {staffMetrics.leadsCount}
                                </span>
                            </div>
                        </div>

                        {/* Filters & Search Controls */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                            {/* Segmented Filter Pills */}
                            <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                                <button
                                    type="button"
                                    onClick={() => setCaseTypeFilter("all")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${caseTypeFilter === "all"
                                        ? "bg-white text-indigo-600 shadow-xs"
                                        : "text-slate-600 hover:text-slate-900"
                                        }`}
                                >
                                    All Cases ({userApplications.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCaseTypeFilter("application")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${caseTypeFilter === "application"
                                        ? "bg-white text-blue-600 shadow-xs"
                                        : "text-slate-600 hover:text-slate-900"
                                        }`}
                                >
                                    Loan Applications ({staffMetrics.bankAppsCount})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCaseTypeFilter("lead")}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${caseTypeFilter === "lead"
                                        ? "bg-white text-amber-600 shadow-xs"
                                        : "text-slate-600 hover:text-slate-900"
                                        }`}
                                >
                                    Leads & Intake ({staffMetrics.leadsCount})
                                </button>
                            </div>

                            {/* Search and Status Dropdown */}
                            <div className="flex items-center gap-2 flex-1 sm:max-w-md justify-end">
                                <div className="relative flex-1">
                                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-slate-400">search</span>
                                    <input
                                        type="text"
                                        value={caseSearchTerm}
                                        onChange={(e) => setCaseSearchTerm(e.target.value)}
                                        placeholder="Search student, email, ID..."
                                        className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                    />
                                    {caseSearchTerm && (
                                        <button
                                            type="button"
                                            onClick={() => setCaseSearchTerm("")}
                                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                        </button>
                                    )}
                                </div>
                                <select
                                    value={caseStatusFilter}
                                    onChange={(e) => setCaseStatusFilter(e.target.value)}
                                    className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="submitted">Submitted</option>
                                    <option value="document_verification">Document Verification</option>
                                    <option value="processing">Processing</option>
                                    <option value="under_bank_review">Under Review</option>
                                    <option value="file_logged">File Logged</option>
                                    <option value="sanctioned">Sanctioned</option>
                                    <option value="approved">Approved</option>
                                    <option value="disbursed">Disbursed</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                        </div>

                        {/* Cases Data Table */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            {filteredStaffCases.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                <th className="px-6 py-3.5">Type & ID</th>
                                                <th className="px-6 py-3.5">Borrower / Applicant</th>
                                                <th className="px-6 py-3.5">University & Target</th>
                                                <th className="px-6 py-3.5">Bank Partner</th>
                                                <th className="px-6 py-3.5">Loan Amount</th>
                                                <th className="px-6 py-3.5">Status & Stage</th>
                                                <th className="px-6 py-3.5">Assigned Date</th>
                                                <th className="px-6 py-3.5 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {filteredStaffCases.map((app: any, idx: number) => {
                                                const isApp = isApplicationRecord(app);
                                                const applicantName = app.fullName || app.studentName || [app.firstName, app.lastName].filter(Boolean).join(" ") || (app.user?.firstName ? [app.user?.firstName, app.user?.lastName].filter(Boolean).join(" ") : "Applicant");
                                                const applicantEmail = app.email || app.user?.email || "—";
                                                const applicantPhone = app.phone || app.mobile || app.user?.phoneNumber || app.user?.mobile || "—";
                                                const rawAmount = Number(app.amount || app.loanAmount || 0);
                                                const formattedAmt = rawAmount > 0 ? `₹${rawAmount.toLocaleString('en-IN')}` : "—";
                                                const university = app.universityName || app.college || app.targetUniversity || "—";
                                                const country = app.country || app.studyDestination || "";
                                                const course = app.courseName || app.course || app.degree || app.loanType || "Education Loan";
                                                const appNum = app.applicationNumber || app.id?.slice(0, 8).toUpperCase();
                                                const isSelected = selectedApplication?.id === app.id;

                                                return (
                                                    <tr key={app.id || idx} className={`hover:bg-indigo-50/30 transition-colors ${isSelected ? "bg-indigo-50/50" : ""}`}>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${isApp
                                                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                                                    }`}>
                                                                    {isApp ? "Application" : "Lead"}
                                                                </span>
                                                            </div>
                                                            <div className="font-mono text-xs font-bold text-slate-900 mt-1">
                                                                {appNum}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-xs font-bold text-slate-900">{applicantName}</div>
                                                            <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{applicantEmail}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">{applicantPhone}</div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-xs font-semibold text-slate-900 line-clamp-1">{university}</div>
                                                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                                {country && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                                                                        {country}
                                                                    </span>
                                                                )}
                                                                <span className="truncate max-w-[140px]">{course}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-xs font-semibold text-slate-800 bg-slate-100/80 px-2.5 py-1 rounded-md border border-slate-200 inline-block">
                                                                {app.bank || "General Pool"}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-xs font-bold text-indigo-700">
                                                                {formattedAmt}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                                                                {app.loanType || "Education"}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border inline-block ${["approved", "sanctioned", "disbursed", "disbursement_confirmed"].includes(app.status)
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                : ["rejected", "cancelled"].includes(app.status)
                                                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                                                    : ["processing", "submitted_to_bank", "file_logged", "under_bank_review"].includes(app.status)
                                                                        ? "bg-blue-50 text-blue-700 border-blue-200"
                                                                        : "bg-amber-50 text-amber-700 border-amber-200"
                                                                }`}>
                                                                {(app.status || "Pending").replace(/_/g, " ")}
                                                            </span>
                                                            {app.stage && (
                                                                <div className="text-[10px] text-slate-400 mt-1 capitalize truncate max-w-[120px]">
                                                                    {app.stage.replace(/_/g, " ")}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4 text-xs font-medium text-slate-500 whitespace-nowrap">
                                                            {app.assignedAt ? format(new Date(app.assignedAt), "MMM d, yyyy") : (app.submittedAt || app.createdAt ? format(new Date(app.submittedAt || app.createdAt), "MMM d, yyyy") : "—")}
                                                        </td>
                                                        <td className="px-6 py-4 text-right whitespace-nowrap">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedApplication(app)}
                                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${isSelected
                                                                        ? "bg-indigo-600 text-white"
                                                                        : "bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-500"
                                                                        }`}
                                                                    title="View Case Details"
                                                                >
                                                                    <span className="material-symbols-outlined text-[16px]">visibility</span>
                                                                </button>
                                                                <Link
                                                                    href={`/admin/applications?search=${encodeURIComponent(app.applicationNumber || app.id)}`}
                                                                    className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                                                                    title="Open in Applications Manager"
                                                                >
                                                                    <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                                                </Link>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="py-20 text-center">
                                    <span className="material-symbols-outlined text-[48px] text-slate-300 mx-auto block mb-3">
                                        {userApplications.length === 0 ? "folder_open" : "filter_list_off"}
                                    </span>
                                    <p className="text-slate-700 font-bold text-sm">
                                        {userApplications.length === 0 ? "No applications or leads assigned yet" : "No matching assigned cases found"}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                        {userApplications.length === 0
                                            ? "When student loan applications or leads are assigned to this officer, they will appear here dynamically."
                                            : "Try adjusting your search criteria or filter tabs above."}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Staff Selected Application / Lead Details Drawer */}
                        {selectedApplication && (
                            <div className="bg-white rounded-2xl border-2 border-indigo-200 shadow-xl p-8 relative animate-in fade-in duration-200">
                                <div className="flex items-start justify-between mb-6 border-b border-slate-100 pb-5">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                                            <span className="material-symbols-outlined text-[24px]">
                                                {isApplicationRecord(selectedApplication) ? "account_balance" : "contact_mail"}
                                            </span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-lg font-black text-slate-900">
                                                    {selectedApplication.applicationNumber || selectedApplication.id?.slice(0, 8).toUpperCase()}
                                                </h3>
                                                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${isApplicationRecord(selectedApplication)
                                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                                    }`}>
                                                    {isApplicationRecord(selectedApplication) ? "Loan Application" : "Intake Lead"}
                                                </span>
                                                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
                                                    {(selectedApplication.status || "Pending").replace(/_/g, " ")}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                Applicant: <span className="font-bold text-slate-800">{selectedApplication.fullName || selectedApplication.studentName || [selectedApplication.firstName, selectedApplication.lastName].filter(Boolean).join(" ") || "Student Applicant"}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedApplication(null)}
                                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                                        title="Close"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                    </button>
                                </div>

                                {/* Quick Parameter Cards */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Lending Partner</span>
                                        <span className="font-bold text-slate-900 text-xs">{selectedApplication.bank || "General Pool"}</span>
                                    </div>
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Loan Amount</span>
                                        <span className="font-bold text-indigo-700 text-sm">
                                            {Number(selectedApplication.amount || selectedApplication.loanAmount || 0) > 0
                                                ? `₹${Number(selectedApplication.amount || selectedApplication.loanAmount).toLocaleString('en-IN')}`
                                                : "—"}
                                        </span>
                                    </div>
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Loan Type</span>
                                        <span className="font-bold text-slate-900 text-xs">{selectedApplication.loanType || "Education Loan"}</span>
                                    </div>
                                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Assigned Officer</span>
                                        <span className="font-bold text-slate-900 text-xs">{selectedApplication.assignedStaffName || `${userData.firstName} ${userData.lastName}`}</span>
                                    </div>
                                </div>

                                {/* Deep Dossier Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                                    {/* Borrower & Contact Details */}
                                    <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3">
                                        <h4 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
                                            <span className="material-symbols-outlined text-[16px] text-indigo-600">person</span>
                                            Borrower Contact & Personal Details
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Email</span>
                                                <span className="font-bold text-slate-800 break-all">{selectedApplication.email || selectedApplication.user?.email || "—"}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Phone</span>
                                                <span className="font-mono font-bold text-slate-800">{selectedApplication.phone || selectedApplication.mobile || selectedApplication.user?.phoneNumber || "—"}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Gender / DOB</span>
                                                <span className="font-medium text-slate-700">
                                                    {selectedApplication.gender || "—"} {selectedApplication.dateOfBirth ? `(${format(new Date(selectedApplication.dateOfBirth), "dd/MM/yyyy")})` : ""}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Location</span>
                                                <span className="font-medium text-slate-700">{selectedApplication.address || selectedApplication.city || "—"} {selectedApplication.pincode ? `(${selectedApplication.pincode})` : ""}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* University & Academics */}
                                    <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3">
                                        <h4 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
                                            <span className="material-symbols-outlined text-[16px] text-indigo-600">school</span>
                                            Academic & Study Destination
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-2">
                                                <span className="text-[10px] text-slate-400 uppercase font-semibold block">University Name</span>
                                                <span className="font-bold text-slate-800">{selectedApplication.universityName || selectedApplication.college || "—"}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Target Country</span>
                                                <span className="font-bold text-slate-800">{selectedApplication.country || selectedApplication.studyDestination || "—"}</span>
                                            </div>
                                            <div>
                                                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Course Name</span>
                                                <span className="font-semibold text-slate-800">{selectedApplication.courseName || selectedApplication.loanType || "—"}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Co-Applicant Profile */}
                                    {selectedApplication.hasCoApplicant && (
                                        <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3 md:col-span-2">
                                            <h4 className="font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-2">
                                                <span className="material-symbols-outlined text-[16px] text-indigo-600">group</span>
                                                Co-Applicant / Guarantor Information
                                            </h4>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <div>
                                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Co-Applicant Name</span>
                                                    <span className="font-bold text-slate-800">{selectedApplication.coApplicantName || "—"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Relation</span>
                                                    <span className="font-semibold text-slate-800 capitalize">{selectedApplication.coApplicantRelation || "—"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Contact Number</span>
                                                    <span className="font-mono text-slate-800">{selectedApplication.coApplicantPhone || "—"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Declared Income</span>
                                                    <span className="font-bold text-emerald-700">
                                                        {selectedApplication.coApplicantIncome ? `₹${Number(selectedApplication.coApplicantIncome).toLocaleString('en-IN')}` : "—"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Drawer Bottom Action */}
                                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-xs text-slate-400">
                                        Assigned: {selectedApplication.assignedAt ? format(new Date(selectedApplication.assignedAt), "MMM d, yyyy h:mm a") : "—"}
                                    </span>
                                    <Link
                                        href={`/admin/applications?search=${encodeURIComponent(selectedApplication.applicationNumber || selectedApplication.id)}`}
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-xs"
                                    >
                                        <span>Open Full Case File</span>
                                        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                    </Link>
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
                                        <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider ${userData.role?.includes('bank') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700'
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
                                            className={`w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${userData.bank === comparedBankPartner.shortName
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
            </div>

            {/* Edit Staff Settings Modal */}
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
                                        Staff Operational Profile & Branch Settings
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Configure identity, designations, operational department, and office assignment.
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
