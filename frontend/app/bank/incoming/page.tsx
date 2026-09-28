"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isWithinInterval, parseISO } from "date-fns";
import { adminApi, bankApi, getToken } from "@/lib/api";
import { PageHeader, DataTable, StatusBadge, PriorityTag, EmptyState, Spinner } from "@/components/bank/SharedUI";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function IncomingQueuePage() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [currentBankId, setCurrentBankId] = useState("idfc");
    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [officers, setOfficers] = useState<string[]>([
        "Sarah Jenkins (Senior Underwriter)",
        "David Lee (Credit Analyst)",
        "Amanda Vance (Risk Assessor)",
        "Rajesh Patel (Loan Manager)"
    ]);

    // Filters
    const [search, setSearch] = useState("");
    const [instType, setInstType] = useState("all");
    const [courseType, setCourseType] = useState("all");
    const [minAmount, setMinAmount] = useState("");
    const [maxAmount, setMaxAmount] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // Staged/Temporary Filter States for explicit Apply Filters action
    const [tempSearch, setTempSearch] = useState("");
    const [tempInstType, setTempInstType] = useState("all");
    const [tempCourseType, setTempCourseType] = useState("all");
    const [tempMinAmount, setTempMinAmount] = useState("");
    const [tempMaxAmount, setTempMaxAmount] = useState("");
    const [tempStartDate, setTempStartDate] = useState("");
    const [tempEndDate, setTempEndDate] = useState("");

    // Collapsible states
    const [isFiltersOpen, setIsFiltersOpen] = useState(false);
    const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);
    const [activeFilterChip, setActiveFilterChip] = useState<"all" | "high_value" | "sla_close">("all");

    // Context menu tracking state
    const [activeMenuAppId, setActiveMenuAppId] = useState<string | null>(null);

    // Modal state for Log File (F3)
    const [selectedApp, setSelectedApp] = useState<any | null>(null);
    const [showLogModal, setShowLogModal] = useState(false);
    const [lanNumber, setLanNumber] = useState("");
    const [priority, setPriority] = useState("medium");
    const [assignedOfficer, setAssignedOfficer] = useState("");
    const [confirmingLog, setConfirmingLog] = useState(false);
    const [savingLog, setSavingLog] = useState(false);

    // Send Mail state
    const [showSendMailModal, setShowSendMailModal] = useState(false);
    const [sendMailApp, setSendMailApp] = useState<any | null>(null);
    const [recipientEmail, setRecipientEmail] = useState("");
    const [sendingMail, setSendingMail] = useState(false);
    const [mailSentSuccess, setMailSentSuccess] = useState(false);

    // Drawer state for View Application
    const [showViewAppDrawer, setShowViewAppDrawer] = useState(false);
    const [token, setToken] = useState<string>("");
    const [loadingDetails, setLoadingDetails] = useState(false);

    const fetchSelectedAppDetails = async (appId: string) => {
        setLoadingDetails(true);
        try {
            const [appRes, docsRes]: [any, any] = await Promise.all([
                bankApi.getFileDetail(appId),
                bankApi.getDocuments(appId)
            ]);
            if (appRes) {
                let userObj: any = null;
                const targetUserId = appRes.userId || appRes.user_id || appRes.applicantId || selectedApp?.userId || selectedApp?.user_id;
                if (targetUserId) {
                    try {
                        const userRes: any = await adminApi.getUserById(targetUserId);
                        if (userRes && userRes.data) {
                            userObj = userRes.data;
                        }
                    } catch (e) {
                        console.error("Failed to fetch user for application drawer:", e);
                    }
                }
                setSelectedApp((prev: any) => ({
                    ...prev,
                    ...appRes,
                    _isDetailLoaded: true,
                    user: userObj || appRes.user || prev?.user,
                    documents: docsRes || [],
                    statusHistory: appRes.statusHistory || []
                }));
            }
        } catch (err) {
            console.error("Failed to fetch full application details:", err);
        } finally {
            setLoadingDetails(false);
        }
    };

    useEffect(() => {
        if (showViewAppDrawer && selectedApp?.id && !selectedApp._isDetailLoaded) {
            fetchSelectedAppDetails(selectedApp.id);
        }
    }, [showViewAppDrawer, selectedApp?.id, selectedApp?._isDetailLoaded]);

    const { user } = useAuth();

    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("selectedBank") || localStorage.getItem("selectedBank");
            const userBank = (user as any)?.selectedBank || user?.bankName || user?.firstName;
            if (saved) {
                setCurrentBankId(saved);
            } else if (userBank) {
                const lower = userBank.toLowerCase();
                if (lower.includes("auxilo")) setCurrentBankId("auxilo");
                else if (lower.includes("avanse")) setCurrentBankId("avanse");
                else if (lower.includes("credila") || lower.includes("hdfc")) setCurrentBankId("credila");
                else if (lower.includes("idfc")) setCurrentBankId("idfc");
                else if (lower.includes("poonawalla")) setCurrentBankId("poonawalla");
                else setCurrentBankId(userBank);
            }
            const fetchedToken = getToken();
            if (fetchedToken) setToken(fetchedToken);
        }
    }, [user]);

    const fetchApplications = async (bankId: string) => {
        setLoading(true);
        try {
            const res: any = await adminApi.getApplications({ bank: bankId });
            if (res && res.success) {
                const rawApps = res.data || [];
                setApplications(rawApps);
            }
        } catch (err) {
            console.error("Failed to load incoming applications:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (mounted) {
            fetchApplications(currentBankId);
        }
    }, [currentBankId, mounted]);

    // SLA & KPI stats calculations
    const incomingApps = useMemo(() => {
        return applications.filter((app) => {
            if (app.lanNumber) return false;
            if (["rejected", "approved", "sanctioned", "disbursed", "disbursement_confirmed", "draft"].includes(app.status)) return false;
            return true;
        });
    }, [applications]);

    const kpiTotalPending = useMemo(() => incomingApps.length, [incomingApps]);

    const kpiHighValue = useMemo(() => {
        return incomingApps.filter(app => (app.amount || 0) > 2500000).length;
    }, [incomingApps]);

    const kpiSlaBreached = useMemo(() => {
        const now = new Date();
        return incomingApps.filter(app => {
            if (!app.submittedAt) return false;
            const submittedDate = parseISO(app.submittedAt);
            const hoursDiff = (now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60);
            return hoursDiff > 24;
        }).length;
    }, [incomingApps]);

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (search) count++;
        if (instType !== "all") count++;
        if (courseType !== "all") count++;
        if (minAmount) count++;
        if (maxAmount) count++;
        if (startDate) count++;
        if (endDate) count++;
        return count;
    }, [search, instType, courseType, minAmount, maxAmount, startDate, endDate]);

    // Apply staged inputs
    const handleApplyFilters = () => {
        setSearch(tempSearch);
        setInstType(tempInstType);
        setCourseType(tempCourseType);
        setMinAmount(tempMinAmount);
        setMaxAmount(tempMaxAmount);
        setStartDate(tempStartDate);
        setEndDate(tempEndDate);
    };

    // Reset staged inputs
    const handleResetFilters = () => {
        setTempSearch("");
        setTempInstType("all");
        setTempCourseType("all");
        setTempMinAmount("");
        setTempMaxAmount("");
        setTempStartDate("");
        setTempEndDate("");

        setSearch("");
        setInstType("all");
        setCourseType("all");
        setMinAmount("");
        setMaxAmount("");
        setStartDate("");
        setEndDate("");
    };

    // Apply Filter Bar inputs (Task 6)
    const filteredApps = useMemo(() => {
        return applications.filter((app) => {
            // Must not have a LAN to be in "Incoming Queue"
            if (app.lanNumber) return false;
            if (["rejected", "approved", "sanctioned", "disbursed", "disbursement_confirmed", "draft"].includes(app.status)) return false;

            const matchesSearch =
                (app.applicationNumber || "").toLowerCase().includes(search.toLowerCase()) ||
                (`${app.firstName || ""} ${app.lastName || ""}`).toLowerCase().includes(search.toLowerCase()) ||
                (app.email || "").toLowerCase().includes(search.toLowerCase());

            if (!matchesSearch) return false;

            // Filter Chips constraints
            if (activeFilterChip === "high_value") {
                if ((app.amount || 0) <= 2500000) return false;
            } else if (activeFilterChip === "sla_close") {
                if (!app.submittedAt) return false;
                const now = new Date();
                const submittedDate = parseISO(app.submittedAt);
                const hoursDiff = (now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60);
                if (hoursDiff <= 24) return false;
            }

            // Institution type filter
            if (instType !== "all") {
                const uniName = (app.universityName || "").toLowerCase();
                const isInt = uniName.includes("university") || uniName.includes("college") || uniName.includes("institute");
                if (instType === "international" && !isInt) return false;
                if (instType === "private" && isInt) return false;
            }

            // Course type filter
            if (courseType !== "all") {
                const courseName = (app.courseName || "").toLowerCase();
                if (courseType === "stem" && !courseName.includes("science") && !courseName.includes("computer") && !courseName.includes("engineering") && !courseName.includes("technology")) return false;
                if (courseType === "mba" && !courseName.includes("mba") && !courseName.includes("business") && !courseName.includes("management")) return false;
                if (courseType === "ug" && courseName.includes("master")) return false;
                if (courseType === "pg" && !courseName.includes("master") && !courseName.includes("postgrad")) return false;
            }

            // Amount Range
            const amount = app.amount || 0;
            if (minAmount && amount < parseFloat(minAmount)) return false;
            if (maxAmount && amount > parseFloat(maxAmount)) return false;

            // Date Range
            if (startDate || endDate) {
                const appDate = app.submittedAt ? parseISO(app.submittedAt) : new Date();
                const start = startDate ? parseISO(startDate) : parseISO("2000-01-01");
                const end = endDate ? parseISO(endDate) : parseISO("2100-01-01");
                if (!isWithinInterval(appDate, { start, end })) return false;
            }

            return true;
        });
    }, [applications, search, activeFilterChip, instType, courseType, minAmount, maxAmount, startDate, endDate]);

    const handleOpenLogModal = (app: any) => {
        setSelectedApp(app);
        const bankCode = currentBankId.toUpperCase();
        const targetLen = 17;
        const prefixLen = 5 + bankCode.length;
        const digitsNeeded = Math.max(4, targetLen - prefixLen);
        const minRand = Math.pow(10, digitsNeeded - 1);
        const maxRand = Math.pow(10, digitsNeeded) - 1;
        const randNum = Math.floor(minRand + Math.random() * (maxRand - minRand));
        setLanNumber(`LAN-${bankCode}-${randNum}`);
        setPriority("medium");
        setAssignedOfficer(officers[0]);
        setConfirmingLog(false);
        setShowLogModal(true);
    };

    const handleSaveLogFile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedApp || !lanNumber.trim()) return;

        if (selectedApp.lanNumber) {
            alert("LAN number has already been assigned and cannot be changed.");
            return;
        }

        const lan = lanNumber.trim();
        if (lan.length < 15 || lan.length > 20) {
            alert("LAN number must be between 15 and 20 characters long.");
            return;
        }
        if (!/[a-zA-Z]/.test(lan) || !/\d/.test(lan) || !/-/.test(lan)) {
            alert("LAN number must contain a mix of letters, numbers, and the '-' character.");
            return;
        }

        if (!confirmingLog) {
            setConfirmingLog(true);
            return;
        }

        setSavingLog(true);
        try {
            const remarkText = `[Bank System - Logged]: Assigned LAN: ${lanNumber.trim()} (Priority: ${priority.toUpperCase()}) to officer ${assignedOfficer}`;
            const mergedRemarks = selectedApp.remarks
                ? `${selectedApp.remarks}\n${remarkText}`
                : remarkText;

            const payload = {
                lanNumber: lanNumber.trim(),
                lanEnteredAt: new Date().toISOString(),
                stage: "under_review",
                status: "file_logged",
                remarks: mergedRemarks
            };
            const appId = selectedApp.id || selectedApp._id;
            const res: any = await adminApi.updateApplication(appId, payload);
            if (res && res.success) {
                setShowLogModal(false);
                setSelectedApp(null);
                fetchApplications(currentBankId);
            }
        } catch (err) {
            console.error("Error logging application file:", err);
            alert("Failed to log file. Try again.");
        } finally {
            setSavingLog(false);
            setConfirmingLog(false);
        }
    };

    const handleSendMail = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!sendMailApp) return;
        if (!recipientEmail.trim()) {
            alert("Please enter a valid recipient email address.");
            return;
        }
        setSendingMail(true);
        try {
            const appId = sendMailApp.id || sendMailApp._id;
            const bankId = currentBankId;
            const bankName = sendMailApp.bank || currentBankId.toUpperCase();
            const res: any = await bankApi.sendApplicationEmail({
                applicationId: appId,
                bankId,
                bankName,
                sentBy: "Bank Staff",
                recipientEmail: recipientEmail.trim(),
            });
            if (res && res.success) {
                setMailSentSuccess(true);
                setTimeout(() => {
                    setShowSendMailModal(false);
                    setSendMailApp(null);
                    setMailSentSuccess(false);
                }, 2200);
            } else {
                alert(res?.message || "Failed to send mail. Please try again.");
            }
        } catch (err) {
            console.error("Error sending application email:", err);
            alert("Failed to send application email. Please try again.");
        } finally {
            setSendingMail(false);
        }
    };

    const columns = [
        {
            header: "Application ID",
            accessorKey: "applicationNumber",
            sortable: true,
            cell: (row: any) => (
                <span className="font-mono font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md uppercase text-[11.5px] border border-purple-100">
                    {row.applicationNumber || "Pending"}
                </span>
            )
        },
        {
            header: "Student Name",
            accessorKey: "firstName",
            sortable: true,
            cell: (row: any) => (
                <div>
                    <p className="text-[14.5px] font-bold text-slate-950 font-sans leading-tight">
                        {row.firstName} {row.lastName}
                    </p>
                    <p className="text-xs text-slate-400 font-medium font-sans mt-0.5">
                        {row.email}
                    </p>
                </div>
            )
        },
        {
            header: "Institution",
            accessorKey: "universityName",
            sortable: true,
            cell: (row: any) => (
                <div>
                    <p className="font-bold text-slate-900 text-[13.5px] truncate max-w-[180px] font-sans">
                        {row.universityName || "Foreign University"}
                    </p>
                    <p className="text-xs text-indigo-600 font-semibold uppercase tracking-wider mt-0.5 font-sans">
                        {row.courseName || "Master's Degree"}
                    </p>
                </div>
            )
        },
        {
            header: "Requested Amt",
            accessorKey: "amount",
            sortable: true,
            align: "right" as const,
            cell: (row: any) => (
                <span className="font-bold text-[14px] text-slate-900 font-mono pr-4 block text-right">
                    ₹{(row.amount || 0).toLocaleString("en-IN")}
                </span>
            )
        },
        {
            header: "Submitted Date",
            accessorKey: "submittedAt",
            sortable: true,
            cell: (row: any) => (
                <div>
                    <p className="font-semibold text-slate-800 text-[13px] font-sans">
                        {row.submittedAt ? format(parseISO(row.submittedAt), "dd MMM yyyy") : "N/A"}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {row.submittedAt ? format(parseISO(row.submittedAt), "HH:mm:ss") : ""}
                    </p>
                </div>
            )
        },
        {
            header: "Audit Verdict",
            accessorKey: "status",
            sortable: false,
            cell: (row: any) => <StatusBadge status={row.status || "pending"} />
        },
        {
            header: "Actions",
            accessorKey: "actions",
            sortable: false,
            cell: (row: any) => {
                const isMenuOpen = activeMenuAppId === row.id;
                return (
                    <div className="flex items-center gap-2 relative">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedApp(row);
                                setShowViewAppDrawer(true);
                                fetchSelectedAppDetails(row.id);
                            }}
                            className="px-3.5 py-1.5 border border-[#D1D5DB] text-[#374151] hover:bg-[#F8F9FA] hover:text-gray-900 hover:border-gray-400 text-[10.5px] font-bold uppercase tracking-wider rounded-md transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
                        >
                            <span className="material-symbols-outlined text-[13px] text-gray-500">visibility</span>
                            View Application
                        </button>

                        {/* Three-dot context menu */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuAppId(isMenuOpen ? null : row.id);
                                }}
                                className={`p-1.5 rounded-md border text-gray-500 hover:text-[#4F46E5] hover:bg-indigo-50/50 transition-all ${isMenuOpen ? "border-indigo-200 bg-indigo-50/30" : "border-gray-200"
                                    }`}
                            >
                                <span className="material-symbols-outlined text-base block">more_vert</span>
                            </button>

                            <AnimatePresence>
                                {isMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-45" onClick={() => setActiveMenuAppId(null)} />
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: -5 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: -5 }}
                                            className="absolute right-0 bottom-full mb-1.5 w-48 bg-white border border-gray-200 shadow-2xl rounded-xl z-50 py-1.5 overflow-hidden font-sans"
                                        >
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveMenuAppId(null);
                                                    router.push(`/bank/documents?id=${row.id}`);
                                                }}
                                                className="w-full text-left px-3.5 py-2 hover:bg-indigo-50/30 text-[10.5px] font-bold text-gray-700 hover:text-[#4F46E5] transition-colors flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-sm text-gray-450 font-normal">folder_open</span>
                                                View Documents
                                            </button>
                                            <div className="mx-3 border-t border-gray-100 my-1" />
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveMenuAppId(null);
                                                    setSendMailApp(row);
                                                    setRecipientEmail(`${currentBankId}bank01@gmail.com`);
                                                    setMailSentSuccess(false);
                                                    setShowSendMailModal(true);
                                                }}
                                                className="w-full text-left px-3.5 py-2 hover:bg-blue-50/40 text-[10.5px] font-bold text-gray-700 hover:text-blue-600 transition-colors flex items-center gap-2"
                                            >
                                                <span className="material-symbols-outlined text-sm text-blue-400 font-normal">send</span>
                                                Send Mail to Bank
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                );
            }
        }
    ];

    if (!mounted) return null;

    return (
        <div className="w-full space-y-8">

            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 font-sans">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[#0A2540]">
                        Incoming Loan Files
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                        Incoming loan portfolios from VidyaLoans system awaiting validation and assignation of LAN.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchApplications(currentBankId)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm cursor-pointer active:scale-95"
                    >
                        <span className="material-symbols-outlined text-[16px]">refresh</span>
                        Refresh
                    </button>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
                {/* KPI Card 1: Total Pending Reviews */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Pending Reviews</p>
                        <h3 className={`text-[28px] font-bold leading-none ${kpiTotalPending === 0 ? "text-slate-400" : "text-slate-900"}`}>{kpiTotalPending}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                        <span className="material-symbols-outlined text-xl">pending_actions</span>
                    </div>
                </div>

                {/* KPI Card 2: High Value Loans */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">High Value Loans (&gt; ₹25L)</p>
                        <h3 className={`text-[28px] font-bold leading-none ${kpiHighValue === 0 ? "text-slate-400" : "text-slate-900"}`}>{kpiHighValue}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                        <span className="material-symbols-outlined text-xl">payments</span>
                    </div>
                </div>

                {/* KPI Card 3: SLA Breached Soon */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">SLA Breached Soon (&gt; 24h)</p>
                        <h3 className={`text-[28px] font-bold leading-none ${kpiSlaBreached === 0 ? "text-slate-400" : "text-slate-900"}`}>{kpiSlaBreached}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
                        <span className="material-symbols-outlined text-xl">hourglass_bottom</span>
                    </div>
                </div>
            </div>

            {/* Main Table Card containing Search, Chips and Table */}
            <div className="rounded-[24px] border border-slate-100 overflow-hidden shadow-sm bg-white font-sans">
                {/* Filter Tabs Header */}
                <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-white">
                    <div className="flex flex-wrap items-center gap-2.5">
                        {[
                            { key: "all", label: "ALL PORTFOLIOS", count: incomingApps.length },
                            { key: "high_value", label: "HIGH VALUE (> ₹25L)", count: kpiHighValue },
                            { key: "sla_close", label: "SLA BREACHED", count: kpiSlaBreached },
                        ].map((chip) => {
                            const isActive = activeFilterChip === chip.key;
                            return (
                                <button
                                    key={chip.key}
                                    onClick={() => setActiveFilterChip(chip.key as any)}
                                    className={`px-4 py-2.5 rounded-xl text-[11.5px] font-black uppercase tracking-wider transition-all flex items-center gap-2.5 cursor-pointer ${isActive
                                        ? "bg-[#6605c7] text-white shadow-md shadow-purple-500/20"
                                        : "bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200/60"
                                        }`}
                                >
                                    <span>{chip.label}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-600"
                                        }`}>
                                        {chip.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Queue Data Table */}
                {loading ? (
                    <Spinner message="Retrieving incoming application pool..." />
                ) : (
                    <DataTable
                        data={filteredApps}
                        columns={columns}
                        emptyMessage="All clear! No incoming files in the queue needing LAN assignation."
                        defaultSortKey="submittedAt"
                    />
                )}
            </div>

            {/* Send Mail Confirmation Modal */}
            <AnimatePresence>
                {showSendMailModal && sendMailApp && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => { if (!sendingMail) { setShowSendMailModal(false); setSendMailApp(null); } }} />

                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-white rounded-[2rem] border border-gray-100 shadow-2xl p-8 max-w-md w-full z-10 relative overflow-hidden"
                        >
                            {/* Decorative gradient blob */}
                            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-blue-500/5 pointer-events-none" />

                            {mailSentSuccess ? (
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="flex flex-col items-center justify-center py-6 gap-4"
                                >
                                    <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-3xl text-emerald-500">check_circle</span>
                                    </div>
                                    <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight text-center">Mail Dispatched!</h3>
                                    <p className="text-xs text-gray-500 font-medium text-center">
                                        Application package for <strong>{sendMailApp.firstName} {sendMailApp.lastName}</strong> was sent to <strong className="text-blue-600 font-mono">{recipientEmail}</strong>.
                                    </p>
                                </motion.div>
                            ) : (
                                <form onSubmit={handleSendMail}>
                                    {/* Icon + title */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-xl text-blue-500">forward_to_inbox</span>
                                        </div>
                                        <div>
                                            <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">Send Application to Bank</h3>
                                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Email full application package</p>
                                        </div>
                                    </div>

                                    {/* Recipient Email Input Box */}
                                    <div className="mb-4 text-left">
                                        <label className="text-[9.5px] font-bold text-gray-600 uppercase tracking-wider block mb-1.5 font-sans">
                                            Recipient Email Address <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="email"
                                                required
                                                placeholder="Enter recipient bank email..."
                                                value={recipientEmail}
                                                onChange={(e) => setRecipientEmail(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans text-slate-800 placeholder-slate-400"
                                            />
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">mail</span>
                                        </div>
                                    </div>

                                    {/* Application summary preview */}
                                    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 mb-4 space-y-2">
                                        <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest mb-2">Package Contents Preview</p>
                                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                                            <div>
                                                <span className="text-[8.5px] text-gray-400 font-bold uppercase tracking-wider block">Student</span>
                                                <span className="font-bold text-gray-800">{sendMailApp.firstName} {sendMailApp.lastName}</span>
                                            </div>
                                            <div>
                                                <span className="text-[8.5px] text-gray-400 font-bold uppercase tracking-wider block">App No.</span>
                                                <span className="font-bold text-gray-800 font-mono">{sendMailApp.applicationNumber || "—"}</span>
                                            </div>
                                            <div>
                                                <span className="text-[8.5px] text-gray-400 font-bold uppercase tracking-wider block">Amount</span>
                                                <span className="font-bold text-gray-800">₹{(sendMailApp.amount || 0).toLocaleString("en-IN")}</span>
                                            </div>
                                            <div>
                                                <span className="text-[8.5px] text-gray-400 font-bold uppercase tracking-wider block">Bank</span>
                                                <span className="font-bold text-gray-800 uppercase">{sendMailApp.bank || currentBankId}</span>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="text-[8.5px] text-gray-400 font-bold uppercase tracking-wider block">University</span>
                                                <span className="font-bold text-gray-800">{sendMailApp.universityName || "—"}</span>
                                            </div>
                                        </div>
                                        <div className="mt-2.5 pt-2.5 border-t border-slate-200">
                                            <p className="text-[9px] text-gray-500 font-medium leading-relaxed">
                                                📎 Complete profile data, academic details, and attached document statuses will be sent to the email above.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => { setShowSendMailModal(false); setSendMailApp(null); }}
                                            disabled={sendingMail}
                                            className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={sendingMail}
                                            className="flex-1 py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                        >
                                            {sendingMail ? (
                                                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</>
                                            ) : (
                                                <><span className="material-symbols-outlined text-sm">send</span>Send Mail</>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Log File Modal (Task 9) */}
            <AnimatePresence>
                {showLogModal && selectedApp && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setShowLogModal(false)} />

                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-[2rem] border border-gray-100 shadow-2xl p-8 max-w-md w-full z-10 relative overflow-hidden"
                        >
                            <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight">Log File / Assign LAN</h3>
                            <p className="text-xs text-gray-400 mb-6 font-bold uppercase tracking-wider">Acknowledge file receipt and assign credit underwriting parameters.</p>

                            <form onSubmit={handleSaveLogFile} className="space-y-5">
                                {/* LAN Number */}
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Loan Account Number (LAN)</label>
                                    <input
                                        type="text"
                                        required
                                        value={lanNumber}
                                        onChange={(e) => setLanNumber(e.target.value.toUpperCase())}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-[#6605c7]"
                                    />
                                </div>

                                {/* Priority Level */}
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Priority Level</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {["low", "medium", "high"].map((p) => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => setPriority(p)}
                                                className={`py-2 px-3 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${priority === p
                                                    ? p === "high"
                                                        ? "border-rose-500 bg-rose-50 text-rose-600"
                                                        : p === "medium"
                                                            ? "border-amber-500 bg-amber-50 text-amber-600"
                                                            : "border-emerald-500 bg-emerald-50 text-emerald-600"
                                                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                                    }`}
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Officer Assignment */}
                                {/* <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Assign Credit Officer</label>
                                    <select
                                        value={assignedOfficer}
                                        onChange={(e) => setAssignedOfficer(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-[#6605c7]"
                                    >
                                        {officers.map((off) => (
                                            <option key={off} value={off}>
                                                {off}
                                            </option>
                                        ))}
                                    </select>
                                </div> */}

                                {/* Confirmation Step */}
                                {confirmingLog && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        className="p-4 bg-purple-50 border border-purple-100 rounded-2xl text-[11px] text-purple-700 font-medium leading-relaxed"
                                    >
                                        <p className="font-black uppercase tracking-wider text-[9px] mb-1">Confirm Configuration</p>
                                        <p>You are assigning LAN <span className="font-bold font-mono">{lanNumber}</span> to <strong>{assignedOfficer}</strong>. This file will move to active audit queues.</p>
                                    </motion.div>
                                )}

                                <div className="flex gap-4 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirmingLog) setConfirmingLog(false);
                                            else setShowLogModal(false);
                                        }}
                                        className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                                    >
                                        {confirmingLog ? "Back" : "Cancel"}
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingLog}
                                        className="flex-1 py-3 bg-[#6605c7] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#5203a4] shadow-lg shadow-purple-500/10 transition-all flex items-center justify-center"
                                    >
                                        {savingLog ? "Saving..." : confirmingLog ? "Confirm Log" : "Log File"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* View Application Drawer */}
            <AnimatePresence>
                {showViewAppDrawer && selectedApp && (
                    <>
                        {/* Backdrop */}
                        <div
                            className="fixed inset-0 bg-black/35 backdrop-blur-sm z-40"
                            onClick={() => {
                                setShowViewAppDrawer(false);
                                setSelectedApp(null);
                            }}
                        />
                        {/* Drawer body */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed right-0 top-0 bottom-0 w-full md:w-[480px] bg-white border-l border-gray-100 shadow-2xl z-50 overflow-y-auto p-8 flex flex-col justify-between font-sans"
                        >
                            <div className="space-y-6">
                                {/* Header */}
                                <div className="flex justify-between items-start border-b border-gray-100 pb-5">
                                    <div>
                                        <span className="text-[8px] font-black uppercase tracking-widest text-[#6605c7] bg-purple-50 px-2 py-1 rounded-md">
                                            {selectedApp.applicationNumber}
                                        </span>
                                        <h2 className="text-2xl font-black text-gray-900 mt-2 uppercase tracking-tight">
                                            {selectedApp.firstName} {selectedApp.lastName}
                                        </h2>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                            {selectedApp.email} | {selectedApp.phone || "No phone added"}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowViewAppDrawer(false);
                                            setSelectedApp(null);
                                        }}
                                        className="w-8 h-8 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all"
                                    >
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                </div>

                                {loadingDetails ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <div className="w-8 h-8 border-3 border-gray-100 border-t-[#6605c7] rounded-full animate-spin" />
                                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Fetching details...</span>
                                    </div>
                                ) : (
                                    <>
                                        {/* SECTION 1: LOAN & EDUCATION PROGRAM */}
                                        <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100/50 space-y-3 text-left">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-[#6605c7] block">Loan & Academic Program</span>
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Requested Amount</span>
                                                    <span className="font-semibold text-gray-900">₹{(selectedApp.amount || 0).toLocaleString("en-IN")}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Admission Status</span>
                                                    <span className="font-semibold text-gray-900 uppercase">{selectedApp.admissionStatus || "—"}</span>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">University Name</span>
                                                    <span className="font-semibold text-gray-900">{selectedApp.universityName || "University of Foreign Intake"}</span>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Course & Degree</span>
                                                    <span className="font-semibold text-gray-900">{selectedApp.courseName || "—"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Duration</span>
                                                    <span className="font-semibold text-gray-900">{selectedApp.courseDuration ? `${selectedApp.courseDuration} months` : "—"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Start Date</span>
                                                    <span className="font-semibold text-gray-900">{selectedApp.courseStartDate ? format(parseISO(selectedApp.courseStartDate), "dd MMM yyyy") : "—"}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* SECTION 2: STUDENT PROFILE & CONTACT */}
                                        <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100/50 space-y-3 text-left">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-[#6605c7] block">Student Profile & Contact</span>
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Full Name</span>
                                                    <span className="font-semibold text-gray-900">{selectedApp.firstName || selectedApp.user?.firstName || "—"} {selectedApp.lastName || selectedApp.user?.lastName || ""}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Gender</span>
                                                    <span className="font-semibold text-gray-900 capitalize">{selectedApp.gender || selectedApp.user?.gender || selectedApp.user?.personal?.gender || selectedApp.student?.gender || "—"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Date of Birth</span>
                                                    <span className="font-semibold text-gray-900">
                                                        {(() => {
                                                            const raw = selectedApp.dateOfBirth || selectedApp.user?.dateOfBirth || selectedApp.dob;
                                                            if (!raw) return "—";
                                                            let dobDate: Date | null = null;
                                                            if (typeof raw === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(raw.trim())) {
                                                                const [dd, mm, yyyy] = raw.trim().split('-');
                                                                dobDate = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                                                            } else if (typeof raw === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(raw.trim())) {
                                                                const [dd, mm, yyyy] = raw.trim().split('/');
                                                                dobDate = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                                                            } else {
                                                                dobDate = new Date(raw);
                                                            }
                                                            if (!dobDate || isNaN(dobDate.getTime())) return "—";
                                                            return format(dobDate, "dd MMM yyyy");
                                                        })()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Nationality</span>
                                                    <span className="font-semibold text-gray-900">
                                                        {(() => {
                                                            const raw = selectedApp.nationality || selectedApp.user?.nationality || selectedApp.student?.nationality;
                                                            if (!raw) return "Indian";
                                                            if (typeof raw === 'object' && raw !== null) return raw.name || raw.nationality || "Indian";
                                                            if (typeof raw === 'string') {
                                                                const trimmed = raw.trim();
                                                                if (!trimmed) return "Indian";
                                                                try {
                                                                    const parsed = JSON.parse(trimmed);
                                                                    if (typeof parsed === 'object' && parsed !== null) return parsed.name || parsed.nationality || "Indian";
                                                                } catch { }
                                                                return trimmed;
                                                            }
                                                            return "Indian";
                                                        })()}
                                                    </span>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Email Address</span>
                                                    <span className="font-semibold text-gray-900">{selectedApp.email || selectedApp.user?.email || "—"}</span>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Phone Number</span>
                                                    <span className="font-semibold text-gray-900">{selectedApp.phone || selectedApp.phoneNumber || selectedApp.user?.phoneNumber || selectedApp.user?.mobile || "—"}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* SECTION 3: RESIDENTIAL ADDRESS */}
                                        {(() => {
                                            let userPermAddr = selectedApp.user?.permanentAddress;
                                            if (typeof userPermAddr === 'object' && userPermAddr !== null) {
                                                userPermAddr = [userPermAddr.address1, userPermAddr.address2, userPermAddr.city, userPermAddr.state, userPermAddr.pincode].filter(Boolean).join(", ");
                                            } else if (typeof userPermAddr === 'string' && userPermAddr.startsWith('{')) {
                                                try {
                                                    const p = JSON.parse(userPermAddr);
                                                    userPermAddr = [p.address1, p.address2, p.city, p.state, p.pincode].filter(Boolean).join(", ");
                                                } catch (_) {}
                                            }

                                            let userMailAddr = selectedApp.user?.mailingAddress;
                                            if (typeof userMailAddr === 'object' && userMailAddr !== null) {
                                                userMailAddr = [userMailAddr.address1, userMailAddr.address2, userMailAddr.city, userMailAddr.state, userMailAddr.pincode].filter(Boolean).join(", ");
                                            } else if (typeof userMailAddr === 'string' && userMailAddr.startsWith('{')) {
                                                try {
                                                    const p = JSON.parse(userMailAddr);
                                                    userMailAddr = [p.address1, p.address2, p.city, p.state, p.pincode].filter(Boolean).join(", ");
                                                } catch (_) {}
                                            }

                                            let appAddr = selectedApp.address;
                                            if (typeof appAddr === 'object' && appAddr !== null) {
                                                appAddr = [appAddr.address1, appAddr.address2, appAddr.city, appAddr.state, appAddr.pincode].filter(Boolean).join(", ");
                                            }

                                            const fullAddr = appAddr || selectedApp.permanentAddress || userPermAddr || userMailAddr || selectedApp.mailingAddress || "";
                                            let pincode = selectedApp.pincode || selectedApp.user?.pincode || "";
                                            let city = selectedApp.city || selectedApp.user?.city || "";
                                            let state = selectedApp.state || selectedApp.user?.state || "";

                                            if (!pincode && fullAddr) {
                                                const pinMatch = String(fullAddr).match(/\b\d{6}\b/);
                                                if (pinMatch) pincode = pinMatch[0];
                                            }

                                            if ((!city || !state) && fullAddr) {
                                                const cleanAddr = String(fullAddr).replace(/\b\d{6}\b/, '').replace(/,\s*$/, '').trim();
                                                const parts = cleanAddr.split(',').map((p: string) => p.trim()).filter(Boolean);

                                                if (parts.length >= 2) {
                                                    if (!state) state = parts[parts.length - 1];
                                                    if (!city) city = parts[parts.length - 2];
                                                } else if (parts.length === 1) {
                                                    if (!city && !state) city = parts[0];
                                                }
                                            }

                                            const destCountry = selectedApp.country || selectedApp.studyDestination || selectedApp.countryOfEducation || selectedApp.user?.studyDestination || selectedApp.destinationCountry || "—";

                                            return (
                                                <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100/50 space-y-3 text-left">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-[#6605c7] block">Residential Address</span>
                                                    <div className="text-xs space-y-2">
                                                        <div>
                                                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Full Address</span>
                                                            <span className="font-semibold text-gray-900 block leading-normal">
                                                                {fullAddr || "—"}
                                                            </span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div>
                                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">City</span>
                                                                <span className="font-semibold text-gray-900">{city || "—"}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">State</span>
                                                                <span className="font-semibold text-gray-900">{state || "—"}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Pincode</span>
                                                                <span className="font-semibold text-gray-900">{pincode || "—"}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Destination Country</span>
                                                                <span className="font-semibold text-gray-900">{destCountry}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* SECTION 4: STUDENT EMPLOYMENT DETAILS */}
                                        <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100/50 space-y-3 text-left">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-[#6605c7] block">Employment & Income</span>
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Employment Type</span>
                                                    <span className="font-semibold text-gray-900 capitalize">{selectedApp.employmentType || "—"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Work Experience</span>
                                                    <span className="font-semibold text-gray-900">{selectedApp.workExperience ? `${selectedApp.workExperience} months` : "—"}</span>
                                                </div>
                                                <div className="col-span-2">
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Employer Name</span>
                                                    <span className="font-semibold text-gray-900">{selectedApp.employerName || "—"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Job Title</span>
                                                    <span className="font-semibold text-gray-900">{selectedApp.jobTitle || "—"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Annual Income</span>
                                                    <span className="font-semibold text-gray-900">
                                                        {selectedApp.annualIncome ? `₹${selectedApp.annualIncome.toLocaleString("en-IN")}` : "—"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* SECTION 5: CO-APPLICANT DETAILS */}
                                        {(() => {
                                            let parsedCoApp = selectedApp.coApplicant || selectedApp.user?.coApplicant;
                                            if (typeof parsedCoApp === 'string') {
                                                try { parsedCoApp = JSON.parse(parsedCoApp); } catch (_) {}
                                            }
                                            const parentsList = selectedApp.parents || selectedApp.user?.parents || [];
                                            const coAppParent = Array.isArray(parentsList) ? parentsList.find((p: any) => (p.relation || '').toLowerCase() === 'coapplicant') : null;

                                            const coName = selectedApp.coApplicantName || selectedApp.user?.coApplicantName || parsedCoApp?.name || parsedCoApp?.coApplicantName || coAppParent?.name || "";
                                            const coRelation = selectedApp.coApplicantRelation || selectedApp.user?.coApplicantRelation || parsedCoApp?.relation || parsedCoApp?.coApplicantRelation || coAppParent?.relation || "";
                                            const coEmail = selectedApp.coApplicantEmail || selectedApp.user?.coApplicantEmail || parsedCoApp?.email || parsedCoApp?.coApplicantEmail || coAppParent?.email || "";
                                            const coPhone = selectedApp.coApplicantPhone || selectedApp.user?.coApplicantPhone || parsedCoApp?.phone || parsedCoApp?.mobile || parsedCoApp?.phoneNumber || coAppParent?.phone || coAppParent?.mobile || "";
                                            const rawIncome = selectedApp.coApplicantIncome || parsedCoApp?.income || parsedCoApp?.annualIncome;
                                            const coIncome = rawIncome ? Number(rawIncome) : null;

                                            const hasCoApp = Boolean(selectedApp.hasCoApplicant || coName || coEmail || coPhone || parsedCoApp || coAppParent);

                                            return (
                                                <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100/50 space-y-3 text-left">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-[#6605c7] block">Co-Applicant details</span>
                                                    {hasCoApp ? (
                                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                                            <div>
                                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Name</span>
                                                                <span className="font-semibold text-gray-900">{coName || "—"}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Relationship</span>
                                                                <span className="font-semibold text-gray-900 capitalize">{coRelation || "—"}</span>
                                                            </div>
                                                            <div className="col-span-2">
                                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Email Address</span>
                                                                <span className="font-semibold text-gray-900">{coEmail || "—"}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Phone Number</span>
                                                                <span className="font-semibold text-gray-900">{coPhone || "—"}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Annual Income</span>
                                                                <span className="font-semibold text-gray-900">
                                                                    {coIncome ? `₹${coIncome.toLocaleString("en-IN")}` : "—"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic block">No co-applicant added to this profile.</span>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        {/* SECTION 6: PARENT DETAILS */}
                                        {(() => {
                                            let familyObj = selectedApp.family || selectedApp.user?.family;
                                            if (typeof familyObj === 'string') {
                                                try { familyObj = JSON.parse(familyObj); } catch (_) {}
                                            }
                                            const parentsList = selectedApp.parents || selectedApp.user?.parents || [];
                                            const fatherRec = Array.isArray(parentsList) ? parentsList.find((p: any) => (p.relation || '').toLowerCase() === 'father') : null;
                                            const motherRec = Array.isArray(parentsList) ? parentsList.find((p: any) => (p.relation || '').toLowerCase() === 'mother') : null;

                                            const fatherName = selectedApp.fatherName || selectedApp.user?.fatherName || familyObj?.fatherName || fatherRec?.name || "—";
                                            const fatherPhone = selectedApp.fatherPhone || familyObj?.fatherPhone || familyObj?.fatherMobile || fatherRec?.phone || fatherRec?.mobile || "";
                                            const fatherEmail = selectedApp.fatherEmail || familyObj?.fatherEmail || fatherRec?.email || "";

                                            const motherName = selectedApp.motherName || selectedApp.user?.motherName || familyObj?.motherName || motherRec?.name || "—";
                                            const motherPhone = selectedApp.motherPhone || familyObj?.motherPhone || familyObj?.motherMobile || motherRec?.phone || motherRec?.mobile || "";
                                            const motherEmail = selectedApp.motherEmail || familyObj?.motherEmail || motherRec?.email || "";

                                            return (
                                                <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100/50 space-y-3 text-left">
                                                    <span className="text-[9px] font-black uppercase tracking-widest text-[#6605c7] block">Parent Details</span>
                                                    <div className="grid grid-cols-1 gap-3 text-xs">
                                                        <div>
                                                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Father's Name</span>
                                                            <span className="font-semibold text-gray-900 block">{fatherName}</span>
                                                            {(fatherPhone || fatherEmail) && (
                                                                <span className="text-[10px] text-gray-500 block mt-0.5">
                                                                    {[fatherPhone, fatherEmail].filter(Boolean).join(" | ")}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="border-t border-gray-100 pt-2">
                                                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Mother's Name</span>
                                                            <span className="font-semibold text-gray-900 block">{motherName}</span>
                                                            {(motherPhone || motherEmail) && (
                                                                <span className="text-[10px] text-gray-500 block mt-0.5">
                                                                    {[motherPhone, motherEmail].filter(Boolean).join(" | ")}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* SECTION 7: COLLATERAL INFO */}
                                        {(selectedApp.hasCollateral || selectedApp.collateralType) && (
                                            <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100/50 space-y-3 text-left">
                                                <span className="text-[9px] font-black uppercase tracking-widest text-[#6605c7] block">Collateral Information</span>
                                                <div className="grid grid-cols-2 gap-3 text-xs">
                                                    <div>
                                                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Collateral Type</span>
                                                        <span className="font-semibold text-gray-900 capitalize">{selectedApp.collateralType || "—"}</span>
                                                    </div>
                                                    <div>
                                                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Collateral Value</span>
                                                        <span className="font-semibold text-gray-900">
                                                            {selectedApp.collateralValue ? `₹${selectedApp.collateralValue.toLocaleString("en-IN")}` : "—"}
                                                        </span>
                                                    </div>
                                                    <div className="col-span-2">
                                                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block">Collateral Details</span>
                                                        <span className="font-semibold text-gray-900 leading-normal block">{selectedApp.collateralDetails || "—"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Documents Package */}
                                        {/* <div className="space-y-3">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block pl-1">Document Package</span>
                                            {selectedApp.documents && selectedApp.documents.length > 0 ? (
                                                <div className="space-y-2">
                                                    {selectedApp.documents.map((doc: any) => (
                                                        <div
                                                            key={doc.id}
                                                            className="flex justify-between items-center p-3 rounded-xl border border-gray-100 bg-white shadow-sm hover:border-[#6605c7]/10 transition-all"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <span className="material-symbols-outlined text-gray-400 text-lg">description</span>
                                                                <div>
                                                                    <span className="text-[10px] font-black text-gray-700 block uppercase tracking-wider truncate max-w-[220px]">
                                                                        {doc.docType || "Uploaded Document"}
                                                                    </span>
                                                                    <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">
                                                                        Status: {doc.status || "uploaded"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            {doc.status !== 'not_uploaded' && (
                                                                <a
                                                                    href={`/api/applications/admin/${selectedApp.id}/documents/${doc.id}/view?token=${token}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="px-3 py-1.5 bg-gray-50 border border-gray-100 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-[#6605c7]/5 hover:text-[#6605c7] hover:border-[#6605c7]/10 transition-all flex items-center gap-1"
                                                                >
                                                                    <span className="material-symbols-outlined text-xs">download</span> View
                                                                </a>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-4 border border-dashed border-gray-100 rounded-xl text-center">
                                                    <span className="text-[10px] text-gray-400 uppercase tracking-widest">No documents found.</span>
                                                </div>
                                            )}
                                        </div> */}

                                        {/* Activity Notes/Remarks */}
                                        <div className="space-y-3 border-t border-gray-100 pt-5">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 block pl-1">Underwriting Activity Notes</span>
                                            {selectedApp.remarks ? (
                                                <div className="bg-gray-50 rounded-2xl p-4 max-h-40 overflow-y-auto space-y-3 border border-gray-100">
                                                    {selectedApp.remarks.split('\n').map((rem: string, idx: number) => (
                                                        <div key={idx} className="text-[10px] font-medium text-gray-600 border-b border-gray-100/50 pb-2 last:border-0 leading-relaxed">
                                                            {rem}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-4 bg-gray-50 rounded-xl text-center">
                                                    <span className="text-[10px] text-gray-400 uppercase tracking-widest">No internal notes.</span>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Action Buttons */}
                            {/* {!loadingDetails && (
                                <div className="border-t border-gray-100 pt-6 flex flex-col gap-3 mt-6">
                                    {!selectedApp.lanNumber && (
                                        <button
                                            onClick={() => {
                                                setShowViewAppDrawer(false);
                                                handleOpenLogModal(selectedApp);
                                            }}
                                            className="w-full py-4 bg-[#6605c7] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-purple-500/20 hover:bg-[#5203a4] transition-all flex items-center justify-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-lg">note_add</span> Log File (Enter LAN)
                                        </button>
                                    )}
                                </div>
                            )} */}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
