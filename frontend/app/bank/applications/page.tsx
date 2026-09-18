"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInDays, parseISO } from "date-fns";
import { adminApi, bankApi, getToken } from "@/lib/api";
import { DataTable, StatusBadge, PriorityTag } from "@/components/bank/SharedUI";
import { useRouter } from "next/navigation";

export default function ApplicationManagement() {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [currentBankId, setCurrentBankId] = useState<string>("idfc");
    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeTab, setActiveTab] = useState<"incoming" | "active" | "sanctioned" | "rejected">("incoming");
    const [selectedApp, setSelectedApp] = useState<any | null>(null);
    const [token, setToken] = useState<string>("");
    const [showLanModal, setShowLanModal] = useState(false);
    const [showDecisionModal, setShowDecisionModal] = useState(false);

    // Student All Details Dossier Modal state
    const [showUserDetailModal, setShowUserDetailModal] = useState(false);
    const [detailTab, setDetailTab] = useState<"personal" | "academic" | "financial" | "documents" | "decisions">("personal");
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Form states
    const [lanNumber, setLanNumber] = useState("");
    const [decisionType, setDecisionType] = useState<"sanctioned" | "conditional" | "counter" | "rejected">("sanctioned");
    const [sanctionAmount, setSanctionAmount] = useState("");
    const [sanctionedInterestRate, setSanctionedInterestRate] = useState("");
    const [roiType, setRoiType] = useState("floating");
    const [roiBase, setRoiBase] = useState("");
    const [roiSubsidy, setRoiSubsidy] = useState("0");
    const [roiEffective, setRoiEffective] = useState("");
    const [processingFee, setProcessingFee] = useState("");
    const [sanctionLetterUrl, setSanctionLetterUrl] = useState("");
    const [conditions, setConditions] = useState("");
    const [rejectionReason, setRejectionReason] = useState("");

    // Counter offer terms
    const [counterAmount, setCounterAmount] = useState("");
    const [counterRate, setCounterRate] = useState("");
    const [counterTenure, setCounterTenure] = useState("");

    // Message/remarks state
    const [newRemark, setNewRemark] = useState("");
    const [remarksLoading, setRemarksLoading] = useState(false);

    const [selectedTagFilter, setSelectedTagFilter] = useState("");
    const [newTagInput, setNewTagInput] = useState("");
    const [aiReview, setAiReview] = useState<any>(null);
    const [runningAi, setRunningAi] = useState(false);

    // Advanced Log File Modal states (Task 9)
    const [assignedOfficer, setAssignedOfficer] = useState("Sarah Jenkins (Senior Underwriter)");
    const [confirmingLog, setConfirmingLog] = useState(false);
    const [officers] = useState<string[]>([
        "Sarah Jenkins (Senior Underwriter)",
        "David Lee (Credit Analyst)",
        "Amanda Vance (Risk Assessor)",
        "Rajesh Patel (Loan Manager)"
    ]);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("selectedBank") || localStorage.getItem("selectedBank");
            if (saved) setCurrentBankId(saved);
            const fetchedToken = getToken();
            if (fetchedToken) setToken(fetchedToken);
        }
    }, []);

    const fetchApplications = async (bankId: string) => {
        setLoading(true);
        try {
            const res: any = await adminApi.getApplications({ bank: bankId });
            if (res && res.success) {
                setApplications(res.data || []);
            }
        } catch (err) {
            console.error("Failed to load applications:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (mounted) {
            fetchApplications(currentBankId);
        }
    }, [currentBankId, mounted]);

    // Read URL parameters for auto-selecting an application
    useEffect(() => {
        if (mounted && applications.length > 0 && typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const appId = params.get("id");
            if (appId) {
                const found = applications.find(a => a.id === appId);
                if (found) {
                    setSelectedApp(found);
                    // Clear the query parameter to prevent loop
                    window.history.replaceState({}, "", window.location.pathname);
                }
            }
        }
    }, [applications, mounted]);

    const handleOpenStudentDetail = async (row: any) => {
        if (!row) return;
        setSelectedApp(row);
        setShowUserDetailModal(true);
        setDetailTab("personal");
        setLoadingDetail(true);
        try {
            const appId = row.id || row._id;
            const [detailRes, docsRes]: [any, any] = await Promise.all([
                bankApi.getFileDetail(appId).catch(() => null),
                bankApi.getDocuments(appId).catch(() => [])
            ]);
            const docsList = Array.isArray(docsRes) ? docsRes : (docsRes?.data || docsRes?.documents || []);
            setSelectedApp((prev: any) => ({
                ...prev,
                ...(detailRes || {}),
                documents: docsList.length > 0 ? docsList : (detailRes?.documents || prev?.documents || [])
            }));
        } catch (err) {
            console.error("Error loading complete student details:", err);
        } finally {
            setLoadingDetail(false);
        }
    };

    // Load AI Review Note
    useEffect(() => {
        if (selectedApp) {
            adminApi.getRemarks(selectedApp.id).then((res: any) => {
                if (res && res.success && Array.isArray(res.data)) {
                    const aiNote = res.data.find((n: any) => n.type === "ai_review");
                    if (aiNote) {
                        try {
                            setAiReview(JSON.parse(aiNote.content));
                        } catch (e) {
                            console.error("Failed to parse AI review note:", e);
                            setAiReview(null);
                        }
                    } else {
                        setAiReview(null);
                    }
                } else if (Array.isArray(res)) {
                    const aiNote = res.find((n: any) => n.type === "ai_review");
                    if (aiNote) {
                        try {
                            setAiReview(JSON.parse(aiNote.content));
                        } catch (e) {
                            setAiReview(null);
                        }
                    } else {
                        setAiReview(null);
                    }
                } else {
                    setAiReview(null);
                }
            }).catch(err => {
                console.error("Failed to fetch application notes:", err);
                setAiReview(null);
            });
        } else {
            setAiReview(null);
        }
    }, [selectedApp]);

    const fetchSelectedAppDetails = async (appId: string) => {
        try {
            const [appRes, docsRes]: [any, any] = await Promise.all([
                bankApi.getFileDetail(appId),
                bankApi.getDocuments(appId)
            ]);
            if (appRes) {
                setSelectedApp({
                    ...appRes,
                    documents: docsRes || [],
                    statusHistory: appRes.statusHistory || []
                });
            }
        } catch (err) {
            console.error("Failed to fetch full application details:", err);
        }
    };

    // Fetch full application details (with complete documents) when selected
    useEffect(() => {
        if (selectedApp && !selectedApp.statusHistory) {
            fetchSelectedAppDetails(selectedApp.id);
        }
    }, [selectedApp]);

    // Handle updates in background or polling
    const handleRefresh = () => {
        fetchApplications(currentBankId);
        if (selectedApp) {
            fetchSelectedAppDetails(selectedApp.id);
        }
    };

    // Derived unique list of all tags present in current bank applications
    const allUniqueTags = useMemo(() => {
        const set = new Set<string>();
        applications.forEach(app => {
            if (app.tags) {
                app.tags.split(",").forEach((t: string) => {
                    const clean = t.trim();
                    if (clean) set.add(clean);
                });
            }
        });
        return Array.from(set);
    }, [applications]);

    // Filter applications
    const filteredApps = useMemo(() => {
        return applications.filter(app => {
            const matchesSearch =
                (app.applicationNumber || "").toLowerCase().includes(search.toLowerCase()) ||
                (`${app.firstName || ""} ${app.lastName || ""}`).toLowerCase().includes(search.toLowerCase()) ||
                (app.email || "").toLowerCase().includes(search.toLowerCase());

            if (!matchesSearch) return false;

            if (selectedTagFilter) {
                const tagsList = app.tags ? app.tags.split(",").map((t: string) => t.trim()) : [];
                if (!tagsList.includes(selectedTagFilter)) return false;
            }

            const hasLan = !!app.lanNumber;
            const status = app.status;
            const isPreForwarded = status === "draft";

            if (isPreForwarded) return false;

            if (activeTab === "incoming") {
                return !hasLan && status !== "rejected" && status !== "approved" && status !== "sanctioned" && status !== "disbursed" && status !== "disbursement_confirmed";
            }
            if (activeTab === "active") {
                return hasLan && status !== "rejected" && status !== "approved" && status !== "sanctioned" && status !== "disbursed" && status !== "disbursement_confirmed";
            }
            if (activeTab === "sanctioned") {
                return status === "approved" || status === "sanctioned" || status === "disbursed" || status === "disbursement_confirmed";
            }
            if (activeTab === "rejected") {
                return status === "rejected";
            }
            return true;
        });
    }, [applications, activeTab, search, selectedTagFilter]);

    // Group counts
    const tabCounts = useMemo(() => {
        const counts = { incoming: 0, active: 0, sanctioned: 0, rejected: 0 };
        applications.forEach(app => {
            const hasLan = !!app.lanNumber;
            const status = app.status;
            const isPreForwarded = status === "draft";

            if (isPreForwarded) return;

            if (!hasLan && status !== "rejected" && status !== "approved" && status !== "sanctioned" && status !== "disbursed" && status !== "disbursement_confirmed") {
                counts.incoming++;
            } else if (hasLan && status !== "rejected" && status !== "approved" && status !== "sanctioned" && status !== "disbursed" && status !== "disbursement_confirmed") {
                counts.active++;
            } else if (status === "approved" || status === "sanctioned" || status === "disbursed" || status === "disbursement_confirmed") {
                counts.sanctioned++;
            } else if (status === "rejected") {
                counts.rejected++;
            }
        });
        return counts;
    }, [applications]);

    const handleLogFile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedApp || !lanNumber.trim()) return;

        if (selectedApp.lanNumber) {
            alert("LAN number has already been assigned and cannot be changed.");
            return;
        }

        const lanRegex = /^[a-zA-Z0-9-]+$/;
        if (lanNumber.length < 15 || lanNumber.length > 20) {
            alert("LAN number must be between 15 and 20 characters long.");
            return;
        }
        if (!lanRegex.test(lanNumber)) {
            alert("LAN number can only contain letters, numbers, and hyphens (-).");
            return;
        }

        if (!confirmingLog) {
            setConfirmingLog(true);
            return;
        }

        try {
            const remarkText = `[Bank System - Logged]: Assigned LAN: ${lanNumber.trim()} to officer ${assignedOfficer}`;
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
                setShowLanModal(false);
                setLanNumber("");
                setConfirmingLog(false);
                // Refresh list & drawer
                handleRefresh();
            }
        } catch (err) {
            console.error("Error logging file:", err);
            alert("Failed to log file");
        }
    };

    const handleDecision = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedApp) return;

        // Calculate optimistic target status
        const targetStatus = decisionType === "sanctioned" ? "approved"
            : decisionType === "rejected" ? "rejected"
            : decisionType === "conditional" ? "conditional_sanction"
            : "counter_offer";

        const optimisticApp = {
            ...selectedApp,
            status: targetStatus,
            sanctionAmount: decisionType === "sanctioned" ? (parseFloat(sanctionAmount) || selectedApp.amount) : selectedApp.sanctionAmount,
            interestRate: decisionType === "sanctioned" ? (parseFloat(roiEffective) || parseFloat(roiBase) || 9.5) : selectedApp.interestRate,
            rejectionReason: decisionType === "rejected" ? rejectionReason.trim() : selectedApp.rejectionReason,
        };

        // ⚡ INSTANT OPTIMISTIC UI UPDATE: Close modal & update list/drawer immediately
        setShowDecisionModal(false);
        setSelectedApp(optimisticApp);
        setApplications(prev => prev.map(a => (a.id === selectedApp.id || a._id === selectedApp.id) ? optimisticApp : a));

        // Save field values before resetting state
        const currentSanctionAmount = sanctionAmount;
        const currentRoiBase = roiBase;
        const currentRoiEffective = roiEffective;
        const currentRoiSubsidy = roiSubsidy;
        const currentSanctionedInterestRate = sanctionedInterestRate;
        const currentProcessingFee = processingFee;
        const currentSanctionLetterUrl = sanctionLetterUrl;
        const currentConditions = conditions;
        const currentRejectionReason = rejectionReason;
        const currentCounterAmount = counterAmount;
        const currentCounterRate = counterRate;
        const currentCounterTenure = counterTenure;

        // Clear form fields
        setSanctionAmount("");
        setSanctionedInterestRate("");
        setRoiBase("");
        setRoiEffective("");
        setProcessingFee("");
        setSanctionLetterUrl("");
        setConditions("");
        setRejectionReason("");
        setCounterAmount("");
        setCounterRate("");
        setCounterTenure("");

        try {
            let res: any;
            if (decisionType === "sanctioned") {
                const sanctionVal = parseFloat(currentSanctionAmount) || selectedApp.amount;
                const roiBaseVal = parseFloat(currentRoiBase) || parseFloat(currentSanctionedInterestRate) || 9.5;
                const roiEffectiveVal = parseFloat(currentRoiEffective) || roiBaseVal;
                const roiSubsidyVal = parseFloat(currentRoiSubsidy) || 0;

                const feeAmt = parseFloat(currentProcessingFee) || 0;
                const gst = Math.round(feeAmt * 0.18);
                const totalFee = feeAmt + gst;
                const feePayload = {
                    feeAmount: feeAmt,
                    gstAmount: gst,
                    totalAmount: totalFee,
                    status: 'PENDING',
                    paymentMode: 'UPFRONT',
                    waiverReason: null
                };

                // Run auxiliary setRoi, setProcessingFee, uploadSanctionLetter concurrently
                const auxPromises: Promise<any>[] = [
                    bankApi.setRoi(selectedApp.id, {
                        roiType: roiType,
                        roiBase: roiBaseVal,
                        roiEffective: roiEffectiveVal,
                        roiSubsidy: roiSubsidyVal
                    }).catch(err => console.error("Error setting ROI:", err)),
                    bankApi.setProcessingFee(selectedApp.id, feePayload).catch(async () => {
                        await bankApi.updateProcessingFee(selectedApp.id, feePayload).catch(err => console.error("Error updating fee:", err));
                    })
                ];
                if (currentSanctionLetterUrl.trim()) {
                    auxPromises.push(bankApi.uploadSanctionLetter(selectedApp.id, currentSanctionLetterUrl.trim()).catch(err => console.error("Error uploading sanction letter:", err)));
                }

                await Promise.all(auxPromises);

                // Submit Decision
                res = await bankApi.submitDecision({
                    applicationId: selectedApp.id,
                    decisionType: "sanction",
                    details: {
                        sanctionAmount: sanctionVal,
                        interestRate: roiEffectiveVal,
                        roiType: roiType,
                        tenure: 120,
                        remarks: `Sanctioned with ROI: ${roiEffectiveVal}%, processing fee: ₹${totalFee}`
                    }
                });
            } else if (decisionType === "rejected") {
                res = await bankApi.submitDecision({
                    applicationId: selectedApp.id,
                    decisionType: "reject",
                    details: {
                        reason: currentRejectionReason.trim() || "Does not meet standard credit score criteria",
                        rejectionCategory: "POLICY",
                        remarks: currentRejectionReason.trim()
                    }
                });
            } else if (decisionType === "conditional") {
                res = await bankApi.conditionalSanction({
                    applicationId: selectedApp.id,
                    conditions: [currentConditions],
                    deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                    remarks: `Conditional Sanction: ${currentConditions}`
                });
            } else if (decisionType === "counter") {
                res = await bankApi.counterOffer({
                    applicationId: selectedApp.id,
                    offeredAmount: parseFloat(currentCounterAmount),
                    offeredRate: parseFloat(currentCounterRate),
                    offeredTenure: parseInt(currentCounterTenure),
                    remarks: `Counter Offer proposed: Amount ₹${currentCounterAmount}, Rate ${currentCounterRate}%, Tenure ${currentCounterTenure} months`
                });
            }

            // Sync with DB
            handleRefresh();
        } catch (err: any) {
            console.error("Error submitting decision:", err);
            alert(`Failed to submit decision: ${err.message || err}`);
            handleRefresh();
        }
    };

    const handleAddTag = async (tag: string) => {
        if (!selectedApp || !tag.trim()) return;
        const currentTags: string[] = selectedApp.tags
            ? selectedApp.tags.split(",").map((t: string) => t.trim()).filter((t: string) => !!t)
            : [];
        if (currentTags.includes(tag.trim())) return;
        const updated = [...currentTags, tag.trim()].join(",");
        try {
            const res: any = await adminApi.updateApplication(selectedApp.id, { tags: updated });
            if (res && res.success) {
                setSelectedApp({ ...selectedApp, tags: updated });
                handleRefresh();
            }
        } catch (err) {
            console.error("Failed to add tag:", err);
        }
    };

    const handleRemoveTag = async (tagToRemove: string) => {
        if (!selectedApp) return;
        const currentTags: string[] = selectedApp.tags
            ? selectedApp.tags.split(",").map((t: string) => t.trim()).filter((t: string) => !!t)
            : [];
        const updated = currentTags.filter((t: string) => t !== tagToRemove).join(",");
        try {
            const res: any = await adminApi.updateApplication(selectedApp.id, { tags: updated });
            if (res && res.success) {
                setSelectedApp({ ...selectedApp, tags: updated });
                handleRefresh();
            }
        } catch (err) {
            console.error("Failed to remove tag:", err);
        }
    };

    const handleRunAiAudit = async () => {
        if (!selectedApp) return;
        setRunningAi(true);
        try {
            const res: any = await adminApi.aiReviewApplication(selectedApp.id);
            if (res && res.success && res.data) {
                setAiReview(res.data);
                handleRefresh();
            }
        } catch (err) {
            console.error("Failed to run AI audit:", err);
            alert("AI Underwriting engine was unavailable or failed.");
        } finally {
            setRunningAi(false);
        }
    };

    const handleAddRemark = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedApp || !newRemark.trim()) return;
        setRemarksLoading(true);

        try {
            // update remarks in database
            const mergedRemarks = selectedApp.remarks
                ? `${selectedApp.remarks}\n[Bank Note - ${format(new Date(), 'MMM dd, HH:mm')}]: ${newRemark.trim()}`
                : `[Bank Note - ${format(new Date(), 'MMM dd, HH:mm')}]: ${newRemark.trim()}`;

            const res: any = await adminApi.updateApplication(selectedApp.id, { remarks: mergedRemarks });
            if (res && res.success) {
                setNewRemark("");
                // Refresh list & drawer
                handleRefresh();
            }
        } catch (err) {
            console.error("Error saving remark:", err);
        } finally {
            setRemarksLoading(false);
        }
    };

    if (!mounted) return null;

    return (
        <div className="w-full space-y-6">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[#0F172A] font-sans uppercase">
                        Application Management
                    </h2>
                    <p className="text-xs text-[#64748B] font-medium mt-0.5 font-sans">
                        Verify documents, log file numbers, and record credit underwriting decisions.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => fetchApplications(currentBankId)}
                        className="px-4 py-2 bg-white border border-[#CBD5E1] hover:border-[#94A3B8] rounded-xl text-xs font-semibold uppercase tracking-wider text-[#475569] hover:bg-[#F8FAFC] transition-all flex items-center gap-2 shadow-xs cursor-pointer active:scale-95 font-sans"
                    >
                        <span className="material-symbols-outlined text-[16px]">refresh</span>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Pipeline Tabs & Table Container */}
            <div className="rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm bg-white">
                {/* Pill Tabs Header */}
                <div className="p-4 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4 bg-white">
                    <div className="flex flex-wrap items-center gap-2.5">
                        {[
                            { key: "incoming", label: "INCOMING FILES", count: tabCounts.incoming },
                            { key: "active", label: "LOGGED / REVIEW", count: tabCounts.active },
                            { key: "sanctioned", label: "SANCTIONED QUEUE", count: tabCounts.sanctioned },
                            { key: "rejected", label: "REJECTED QUEUE", count: tabCounts.rejected },
                        ].map((tab) => {
                            const isActive = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key as any)}
                                    className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2.5 cursor-pointer font-sans ${isActive
                                        ? "bg-[#6B21A8] text-white shadow-md shadow-purple-900/20"
                                        : "bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] hover:bg-slate-100 border border-[#E2E8F0]"
                                        }`}
                                >
                                    <span>{tab.label}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-slate-200/80 text-[#64748B]"
                                        }`}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Table Area */}
                <div className="overflow-x-auto min-h-[350px]">
                    {loading ? (
                        <div className="h-[350px] flex flex-col items-center justify-center gap-3">
                            <div className="w-10 h-10 border-3 border-slate-100 border-t-[#6605c7] rounded-full animate-spin" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse font-sans">Syncing application pipeline...</span>
                        </div>
                    ) : filteredApps.length === 0 ? (
                        <div className="h-[300px] flex flex-col items-center justify-center text-center p-8">
                            <span className="material-symbols-outlined text-slate-300 text-5xl mb-3">inbox</span>
                            <h3 className="text-sm font-bold text-slate-800 mb-1 font-sans">Queue is empty</h3>
                            <p className="text-xs text-slate-400 max-w-xs font-sans">There are no files in this stage matching your filter criteria.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left font-sans">
                            <thead className="bg-[#F8FAFC] border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400">
                                <tr>
                                    <th className="px-6 py-4">LAN Number</th>
                                    <th className="px-6 py-4">Student</th>
                                    <th className="px-6 py-4">Requested Amt</th>
                                    <th className="px-6 py-4">File Age</th>
                                    <th className="px-6 py-4">Audit Verdict</th>
                                    <th className="px-6 py-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filteredApps.map((row) => {
                                    const rowId = row.id || row._id;
                                    const initials = `${(row.firstName || '?')[0]}${(row.lastName || '')[0] || ''}`;
                                    const logDate = row.lanEnteredAt || row.submittedAt || row.createdAt;
                                    const diffDays = logDate ? differenceInDays(new Date(), parseISO(logDate)) : 0;

                                    return (
                                        <tr
                                            key={rowId}
                                            onClick={() => setSelectedApp(row)}
                                            className="hover:bg-slate-50/40 transition-colors cursor-pointer"
                                        >
                                            <td className="px-6 py-4">
                                                <span className="font-mono font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-md uppercase text-[11.5px] border border-purple-100">
                                                    {row.lanNumber || "Pending"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <p
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenStudentDetail(row);
                                                        }}
                                                        className="text-[14.5px] font-bold text-slate-950 hover:text-indigo-600 hover:underline transition-colors cursor-pointer inline-flex items-center gap-1.5 group"
                                                        title="Click to view complete student profile and all details"
                                                    >
                                                        <span>{row.firstName} {row.lastName}</span>
                                                    </p>
                                                    <p className="text-xs text-slate-400 font-medium truncate max-w-[180px]">
                                                        {row.universityName || "Foreign University"}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-slate-900 text-[14px] font-mono">
                                                    ₹{(row.amount || 0).toLocaleString("en-IN")}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs text-slate-600 font-semibold">
                                                    {diffDays} {diffDays === 1 ? "day" : "days"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={row.status} />
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenStudentDetail(row);
                                                        }}
                                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                                        title="Click to view complete application profile"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                        Profile
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            router.push(`/bank/chat?applicationId=${row.id}&applicationNumber=${row.applicationNumber || ''}&bank=${encodeURIComponent(row.bank || '')}`);
                                                        }}
                                                        className="px-3 py-1.5 bg-purple-50 hover:bg-[#6605c7] hover:text-white text-[#6605c7] text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                                        title="Chat with Staff for this application"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">forum</span>
                                                        Chat
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedApp(row);
                                                        }}
                                                        className="px-3.5 py-1.5 bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer uppercase tracking-wider"
                                                    >
                                                        Review
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Sidebar Details Drawer */}

            {/* Floating Bottom Sheet Review Component */}
            <AnimatePresence>
                {selectedApp && (
                    <>
                        {/* Backdrop Blur overlay with fade animation */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="fixed inset-0 bg-black/45 backdrop-blur-md z-50 transition-opacity cursor-pointer"
                            onClick={() => setSelectedApp(null)}
                        />

                        {/* Floating Sheet Container Centered at Bottom */}
                        <div className="fixed inset-x-0 bottom-0 z-50 flex items-end justify-center p-2 sm:p-4 md:p-6 pointer-events-none">
                            <motion.div
                                initial={{ y: "100%", opacity: 0, scale: 0.96 }}
                                animate={{ y: 0, opacity: 1, scale: 1 }}
                                exit={{ y: "100%", opacity: 0, scale: 0.96 }}
                                transition={{ type: "spring", stiffness: 320, damping: 28, mass: 0.8 }}
                                className="pointer-events-auto w-full max-w-6xl bg-white rounded-2xl shadow-xl border border-[#E2E8F0] flex flex-col overflow-hidden max-h-[88vh] font-sans relative text-[#0F172A]"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Collapse handle bar at top center + Close button */}
                                <div className="bg-[#F8FAFC] border-b border-[#E2E8F0] px-6 py-2 flex items-center justify-between shrink-0 relative">
                                    <div className="flex-1 flex justify-center">
                                        <motion.button
                                            type="button"
                                            whileHover={{ scale: 1.08 }}
                                            whileTap={{ scale: 0.92 }}
                                            onClick={() => setSelectedApp(null)}
                                            className="group px-6 py-1 bg-slate-200/90 hover:bg-[#6B21A8] rounded-full transition-all cursor-pointer flex items-center gap-1 shadow-xs border-0"
                                            title="Collapse Bottom Sheet"
                                        >
                                            <span className="w-8 h-1 bg-slate-400 group-hover:bg-white rounded-full transition-colors block"></span>
                                            <span className="material-symbols-outlined text-xs text-slate-500 group-hover:text-white transition-colors animate-bounce">keyboard_arrow_down</span>
                                        </motion.button>
                                    </div>
                                    <motion.button
                                        type="button"
                                        whileHover={{ scale: 1.1, rotate: 90 }}
                                        whileTap={{ scale: 0.9 }}
                                        onClick={() => setSelectedApp(null)}
                                        className="w-8 h-8 rounded-full bg-white hover:bg-rose-50 text-[#64748B] hover:text-rose-600 border border-[#E2E8F0] transition-all flex items-center justify-center cursor-pointer shadow-xs"
                                        title="Close Review"
                                    >
                                        <span className="material-symbols-outlined text-base">close</span>
                                    </motion.button>
                                </div>

                                {/* Header Section */}
                                <div className="px-6 py-4 bg-white border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 shrink-0">
                                    <div>
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <h2
                                                onClick={() => handleOpenStudentDetail(selectedApp)}
                                                className="text-xl md:text-2xl font-bold tracking-tight text-[#0F172A] hover:text-[#6B21A8] hover:underline cursor-pointer uppercase inline-flex items-center gap-1.5 group"
                                                title="Click to view complete student profile and details"
                                            >
                                                <span>{selectedApp.firstName} {selectedApp.lastName}</span>
                                                <span className="material-symbols-outlined text-base text-[#6B21A8]">account_circle</span>
                                            </h2>
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-sm text-[#64748B] font-medium font-mono">
                                                App ID: {selectedApp.applicationNumber || `VTU-APP-2026-${(selectedApp.id || '00004').slice(-5).toUpperCase()}`}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenStudentDetail(selectedApp)}
                                            className="px-4 py-2 bg-white hover:bg-[#F8FAFC] hover:border-[#94A3B8] text-[#475569] border border-[#CBD5E1] font-semibold text-xs rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-1.5 shadow-xs"
                                            title="View full student profile and document dossier"
                                        >
                                            <span className="material-symbols-outlined text-sm">account_circle</span>
                                            View All Student Details
                                        </button>
                                        <StatusBadge status={selectedApp.status} />
                                        <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider bg-[#F8FAFC] px-3 py-1 rounded-lg border border-[#E2E8F0]">
                                            Stage: {selectedApp.currentStage || "Bank Review"}
                                        </span>
                                    </div>
                                </div>

                                {/* Content 4-Column Card Grid (Staggered Animation) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-5 overflow-y-auto max-h-[calc(88vh-160px)] custom-scrollbar bg-[#F8FAFC] flex-1">

                                    {/* Column 1: Applicant Snapshot */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.05, duration: 0.3 }}
                                        className="bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] p-5 rounded-xl shadow-xs hover:shadow-sm transition-all duration-200 space-y-4 flex flex-col justify-between"
                                    >
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 pb-2 border-b border-[#E2E8F0]">
                                                <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#6B21A8] flex items-center justify-center border border-purple-100">
                                                    <span className="material-symbols-outlined text-base">person</span>
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                                                    Applicant Snapshot
                                                </span>
                                            </div>

                                            <div className="space-y-3 text-xs font-sans">
                                                <div>
                                                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-0.5">Full Name</span>
                                                    <span className="text-[15px] font-semibold text-[#0F172A]">{selectedApp.firstName} {selectedApp.lastName}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-0.5">User ID / Student ID</span>
                                                    <span className="font-mono text-xs font-semibold text-[#0F172A]">{selectedApp.userId || selectedApp.studentId || selectedApp.id?.slice(0, 12) || "STD-2026-004"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-0.5">Email Address</span>
                                                    <span className="text-xs font-semibold text-[#0F172A] truncate block" title={selectedApp.email}>{selectedApp.email || "applicant@student.org"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-0.5">Phone Number</span>
                                                    <span className="text-xs font-semibold text-[#0F172A]">{selectedApp.phone || selectedApp.mobile || "+91 98765 43210"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-0.5">University</span>
                                                    <span className="text-xs font-semibold text-[#0F172A]">{selectedApp.universityName || "Heidelberg University"}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-0.5">Field of Study</span>
                                                    <span className="text-xs font-semibold text-[#0F172A]">
                                                        {(() => {
                                                            const val = selectedApp.loanType || selectedApp.fieldOfStudy || selectedApp.courseType || selectedApp.programFocus || selectedApp.courseName || selectedApp.course;
                                                            if (!val) return "Undergraduate Abroad";
                                                            const clean = String(val).trim();
                                                            if (/^undergraduate(\s*abroad)?$/i.test(clean)) return "Undergraduate Abroad";
                                                            if (/^postgraduate(\s*abroad)?$/i.test(clean)) return "Postgraduate Abroad";
                                                            if (/^(doctoral|doctorate|phd)(\s*abroad)?$/i.test(clean) || clean.toLowerCase() === "doctoral/phd abroad") return "Doctoral/PhD Abroad";
                                                            if (/^professional(\s*course)?$/i.test(clean)) return "Professional Course";
                                                            return clean;
                                                        })()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-0.5">Applied On</span>
                                                    <span className="text-xs font-semibold text-[#0F172A]">
                                                        {(() => {
                                                            const rawDate = selectedApp.appliedOn || selectedApp.appliedDate || selectedApp.submittedAt || selectedApp.createdAt || selectedApp.created_at || selectedApp.lanEnteredAt;
                                                            if (!rawDate) return "—";
                                                            try {
                                                                const parsed = new Date(rawDate);
                                                                return isNaN(parsed.getTime()) ? "—" : format(parsed, "dd MMM yyyy");
                                                            } catch {
                                                                return "—";
                                                            }
                                                        })()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* Column 2: Financial Summary */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.10, duration: 0.3 }}
                                        className="bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] p-5 rounded-xl shadow-xs hover:shadow-sm transition-all duration-200 space-y-4 flex flex-col justify-between"
                                    >
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 pb-2 border-b border-[#E2E8F0]">
                                                <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#6B21A8] flex items-center justify-center border border-purple-100">
                                                    <span className="material-symbols-outlined text-base">payments</span>
                                                </div>
                                                <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                                                    Financial Summary
                                                </span>
                                            </div>

                                            <div className="space-y-3 text-xs font-sans">
                                                <div>
                                                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-0.5">Requested Amount</span>
                                                    <span className="text-xl font-bold font-mono text-[#6B21A8] bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-100 mt-1 block">
                                                        ₹{(selectedApp.amount || 0).toLocaleString("en-IN")}
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-0.5">Co-Applicant & Relation</span>
                                                    <span className="text-xs font-semibold text-[#0F172A]">{selectedApp.coApplicantName || "Rajesh Sharma"} ({selectedApp.coApplicantRelation || "Father"})</span>
                                                </div>
                                                <div>
                                                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-0.5">Co-Applicant Annual Income</span>
                                                    <span className="text-xs font-semibold font-mono text-[#15803D]">₹{(selectedApp.coApplicantIncome || 1200000).toLocaleString("en-IN")} / year</span>
                                                </div>
                                                <div>
                                                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-0.5">Loan Purpose</span>
                                                    <span className="text-xs font-semibold text-[#0F172A]">Tuition Fees & Foreign Living Expenses</span>
                                                </div>
                                                <div>
                                                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-0.5">CIBIL Credit Score</span>
                                                    <span className="inline-flex items-center gap-1 font-semibold text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-full text-xs">
                                                        <span className="material-symbols-outlined text-xs">verified</span> 765 (Excellent)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* Column 3: Documents & Verification */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.15, duration: 0.3 }}
                                        className="bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] p-5 rounded-xl shadow-xs hover:shadow-sm transition-all duration-200 space-y-4 flex flex-col justify-between"
                                    >
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#15803D] flex items-center justify-center border border-emerald-100">
                                                        <span className="material-symbols-outlined text-base">verified_user</span>
                                                    </div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                                                        Documents & Status
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-2 text-xs font-sans">
                                                <div>
                                                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Verification Status</span>
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] text-xs font-semibold uppercase tracking-wider">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-[#15803D] animate-pulse"></span> Staff Verified & Audited
                                                    </span>
                                                </div>

                                                <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block pt-1">Document Package</span>

                                                {selectedApp.documents && selectedApp.documents.length > 0 ? (
                                                    <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar pr-1">
                                                        {selectedApp.documents.map((doc: any) => (
                                                            <div key={doc.id} className="p-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-slate-100/80 transition-colors flex items-center justify-between text-[11px]">
                                                                <div className="min-w-0 pr-2">
                                                                    <span className="font-semibold text-[#0F172A] block truncate">{doc.docType || "Document"}</span>
                                                                    <span className="text-[9px] text-[#15803D] font-semibold uppercase">{doc.status || "Verified"}</span>
                                                                </div>
                                                                <a
                                                                    href={`/api/applications/admin/${selectedApp.id}/documents/${doc.id}/view?token=${token}`}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="px-2 py-1 bg-white border border-[#CBD5E1] text-[#6B21A8] text-[9px] font-bold uppercase rounded hover:bg-purple-50 transition-colors shrink-0"
                                                                >
                                                                    View ↗
                                                                </a>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-1">
                                                        <div className="flex items-center justify-between text-[11px]">
                                                            <span className="font-semibold text-[#0F172A]">Aadhaar & KYC Card</span>
                                                            <span className="text-[9px] font-semibold text-[#15803D] uppercase">Verified</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-[11px]">
                                                            <span className="font-semibold text-[#0F172A]">University Offer Letter</span>
                                                            <span className="text-[9px] font-semibold text-[#15803D] uppercase">Verified</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-[11px]">
                                                            <span className="font-semibold text-[#0F172A]">Bank Statement 6M</span>
                                                            <span className="text-[9px] font-semibold text-[#15803D] uppercase">Verified</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* Column 4: Underwriting Notes & Activity */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 15 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.20, duration: 0.3 }}
                                        className="bg-white border border-[#E2E8F0] hover:border-[#CBD5E1] p-5 rounded-xl shadow-xs hover:shadow-sm transition-all duration-200 space-y-4 flex flex-col justify-between"
                                    >
                                        <div className="space-y-3 flex-1 flex flex-col justify-between">
                                            <div>
                                                <div className="flex items-center gap-2 pb-2 border-b border-[#E2E8F0] mb-3">
                                                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-[#B45309] flex items-center justify-center border border-amber-100">
                                                        <span className="material-symbols-outlined text-base">history_edu</span>
                                                    </div>
                                                    <span className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                                                        Underwriting Notes
                                                    </span>
                                                </div>

                                                {/* Scrollable activity feed */}
                                                {selectedApp.remarks ? (
                                                    <div className="bg-[#F8FAFC] rounded-xl p-3 max-h-36 overflow-y-auto space-y-2 border border-[#E2E8F0] text-xs custom-scrollbar">
                                                        {selectedApp.remarks.split('\n').map((rem: string, idx: number) => (
                                                            <div key={idx} className="text-[10px] font-medium text-[#0F172A] border-b border-[#E2E8F0] pb-1.5 last:border-0 leading-snug">
                                                                {rem}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-[#F8FAFC] rounded-xl text-center border border-[#E2E8F0]">
                                                        <span className="text-[10px] text-[#64748B] font-medium uppercase tracking-wider">No internal notes yet</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Note Input Box with Add Button */}
                                            <form onSubmit={handleAddRemark} className="space-y-2 mt-3 pt-2 border-t border-[#E2E8F0]">
                                                <textarea
                                                    rows={2}
                                                    placeholder="Type underwriting note or decision remark..."
                                                    value={newRemark}
                                                    onChange={(e) => setNewRemark(e.target.value)}
                                                    className="w-full p-2.5 border border-[#E2E8F0] rounded-xl text-xs focus:outline-none focus:border-[#6B21A8] focus:ring-2 focus:ring-[#6B21A8]/10 transition-all font-sans resize-none"
                                                />
                                                <div className="flex justify-end">
                                                    <motion.button
                                                        type="submit"
                                                        whileHover={{ scale: 1.05 }}
                                                        whileTap={{ scale: 0.95 }}
                                                        disabled={remarksLoading || !newRemark.trim()}
                                                        className="px-4 py-1.5 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-xl text-xs font-semibold uppercase tracking-wider shadow-sm transition-all flex items-center gap-1 disabled:opacity-40 cursor-pointer border-0"
                                                    >
                                                        {remarksLoading ? "Adding..." : "+ Add Note"}
                                                    </motion.button>
                                                </div>
                                            </form>
                                        </div>
                                    </motion.div>

                                </div>

                                {/* Floating Action Bar at Bottom */}
                                <div className="px-6 py-4 bg-white border-t border-[#E2E8F0] flex flex-wrap items-center justify-between gap-3 shrink-0">
                                    <div className="flex items-center gap-2">
                                        {!selectedApp.lanNumber ? (
                                            <motion.button
                                                whileHover={{ scale: 1.03 }}
                                                whileTap={{ scale: 0.97 }}
                                                onClick={() => setShowLanModal(true)}
                                                className="px-5 py-2.5 bg-purple-50 hover:bg-purple-100 text-[#6B21A8] border border-purple-200 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-base">note_add</span> Log File (Assign LAN)
                                            </motion.button>
                                        ) : (
                                            <span className="text-xs font-semibold text-[#64748B] font-mono">
                                                LAN: <span className="text-[#6B21A8] bg-purple-50 px-2 py-0.5 rounded border border-purple-100 font-bold">{selectedApp.lanNumber}</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-3">
                                        <motion.button
                                            type="button"
                                            whileHover={{ scale: 1.03 }}
                                            whileTap={{ scale: 0.97 }}
                                            onClick={() => router.push(`/bank/chat?applicationId=${selectedApp.id}&applicationNumber=${selectedApp.applicationNumber || ''}&bank=${encodeURIComponent(selectedApp.bank || '')}`)}
                                            className="px-5 py-2.5 bg-white hover:bg-[#F8FAFC] hover:border-[#94A3B8] text-[#475569] border border-[#CBD5E1] font-semibold text-sm rounded-xl cursor-pointer transition-all duration-200 flex items-center gap-2"
                                        >
                                            <span className="material-symbols-outlined text-base">forum</span>
                                            CHAT WITH STAFF
                                        </motion.button>

                                        {selectedApp.status !== "approved" && selectedApp.status !== "disbursed" && selectedApp.status !== "rejected" && (
                                            selectedApp.lanNumber ? (
                                                <motion.button
                                                    type="button"
                                                    whileHover={{ scale: 1.04, boxShadow: "0 10px 25px -5px rgba(107, 33, 168, 0.4)" }}
                                                    whileTap={{ scale: 0.96 }}
                                                    onClick={() => {
                                                        setSanctionAmount(selectedApp.amount.toString());
                                                        setShowDecisionModal(true);
                                                    }}
                                                    className="px-5 py-2.5 bg-[#6B21A8] hover:bg-[#581C87] text-white font-semibold text-sm rounded-xl border-0 shadow-md shadow-purple-900/20 cursor-pointer transition-all duration-200 flex items-center gap-2 uppercase tracking-wider"
                                                >
                                                    <span className="material-symbols-outlined text-base">gavel</span>
                                                    RECORD DECISION
                                                </motion.button>
                                            ) : (
                                                <div className="relative group">
                                                    <button
                                                        type="button"
                                                        disabled
                                                        className="px-5 py-2.5 bg-slate-200 text-slate-400 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 cursor-not-allowed opacity-60 select-none border-0"
                                                    >
                                                        <span className="material-symbols-outlined text-base">gavel</span>
                                                        RECORD DECISION
                                                        <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-[#FEF3C7] text-[#B45309] border border-amber-200 rounded uppercase tracking-wider">LAN Required</span>
                                                    </button>
                                                    <div className="absolute bottom-full right-0 mb-2 hidden group-hover:flex items-center gap-1.5 bg-[#0F172A] text-white text-[11px] font-semibold rounded-lg px-3 py-2 whitespace-nowrap shadow-xl z-50">
                                                        <span className="material-symbols-outlined text-[14px] text-amber-400">warning</span>
                                                        Assign a LAN number first before recording a decision
                                                        <div className="absolute top-full right-4 border-4 border-transparent border-t-[#0F172A]" />
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>

            {/* LAN Number Logging Modal */}
            <AnimatePresence>
                {showLanModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans text-[#0F172A]">
                        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => { setShowLanModal(false); setConfirmingLog(false); }} />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl p-6 max-w-md w-full z-10 relative overflow-hidden"
                        >
                            <h3 className="text-2xl font-bold text-[#0F172A] mb-1 uppercase tracking-tight">Log File & Assign LAN</h3>
                            <p className="text-xs text-[#64748B] mb-6 font-medium">Acknowledge receipt and assign the bank's internal Loan Account Number.</p>

                            <form onSubmit={handleLogFile} className="space-y-5">
                                {/* LAN Number */}
                                <div>
                                    <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Loan Account Number (LAN)</label>
                                    <input
                                        type="text"
                                        required
                                        minLength={15}
                                        maxLength={20}
                                        placeholder="e.g. LAN-BANK-0000000"
                                        value={lanNumber}
                                        onChange={(e) => setLanNumber(e.target.value.toUpperCase())}
                                        className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-sm font-semibold text-[#0F172A] focus:outline-none focus:border-[#6B21A8] focus:ring-2 focus:ring-[#6B21A8]/10 transition-all font-mono"
                                    />
                                </div>

                                {/* Confirmation Step */}
                                {confirmingLog && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        className="p-4 bg-purple-50 border border-purple-100 rounded-xl text-xs text-[#6B21A8] font-medium leading-relaxed"
                                    >
                                        <p className="font-bold uppercase tracking-wider text-[10px] mb-1">Confirm Configuration</p>
                                        <p>You are assigning LAN <span className="font-bold font-mono">{lanNumber}</span> to <strong>{assignedOfficer}</strong>. This file will move to active review.</p>
                                    </motion.div>
                                )}

                                <div className="flex gap-4 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (confirmingLog) setConfirmingLog(false);
                                            else setShowLanModal(false);
                                        }}
                                        className="flex-1 bg-white hover:bg-[#F8FAFC] hover:border-[#94A3B8] text-[#475569] border border-[#CBD5E1] font-semibold text-sm px-5 py-2.5 rounded-xl cursor-pointer transition-all duration-200"
                                    >
                                        {confirmingLog ? "Back" : "Cancel"}
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-[#6B21A8] hover:bg-[#581C87] text-white font-semibold text-sm px-5 py-2.5 rounded-xl border-0 shadow-md shadow-purple-900/20 cursor-pointer transition-all duration-200"
                                    >
                                        {confirmingLog ? "Confirm Log" : "Log File"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Decision Entry Modal */}
            <AnimatePresence>
                {showDecisionModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans text-[#0F172A]">
                        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setShowDecisionModal(false)} />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl p-6 max-w-lg w-full z-10 relative overflow-y-auto max-h-[90vh] custom-scrollbar"
                        >
                            <h3 className="text-2xl font-bold text-[#0F172A] mb-1 uppercase tracking-tight">Underwriting Decision Panel</h3>
                            <p className="text-xs text-[#64748B] mb-6 font-medium">Select the credit decision and enter rates/terms.</p>

                            <form onSubmit={handleDecision} className="space-y-5">
                                {/* Decision Selection */}
                                <div>
                                    <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-2">Decision Type</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            { id: "sanctioned", label: "Approve (Sanction)", icon: "check_circle" },
                                            { id: "conditional", label: "Conditional", icon: "pending" },
                                            { id: "counter", label: "Counter Offer", icon: "swap_horiz" },
                                            { id: "rejected", label: "Reject File", icon: "cancel" }
                                        ].map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setDecisionType(t.id as any)}
                                                className={`py-3 px-4 border rounded-xl flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-all ${decisionType === t.id
                                                    ? "border-[#6B21A8] bg-purple-50 text-[#6B21A8]"
                                                    : "border-[#CBD5E1] text-[#475569] hover:bg-[#F8FAFC]"
                                                    }`}
                                            >
                                                <span className="material-symbols-outlined text-base">{t.icon}</span>
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Conditionally Render Form Blocks */}
                                {decisionType === "sanctioned" && (
                                    <div className="space-y-4 border-t border-[#E2E8F0] pt-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Sanctioned Amount (₹)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    value={sanctionAmount}
                                                    onChange={(e) => setSanctionAmount(e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#6B21A8]"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Processing Fee (₹)</label>
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    value={processingFee}
                                                    onChange={(e) => setProcessingFee(e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#6B21A8]"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Rate type (ROI)</label>
                                                <select
                                                    value={roiType}
                                                    onChange={(e) => setRoiType(e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#6B21A8]"
                                                >
                                                    <option value="floating">Floating ROI</option>
                                                    <option value="fixed">Fixed ROI</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Base rate (%)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="e.g. 8.25"
                                                    value={roiBase}
                                                    onChange={(e) => setRoiBase(e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#6B21A8]"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Subsidy / Spread (%)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0.0"
                                                    value={roiSubsidy}
                                                    onChange={(e) => setRoiSubsidy(e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#6B21A8]"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Effective ROI (%)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    required
                                                    placeholder="e.g. 9.50"
                                                    value={roiEffective}
                                                    onChange={(e) => {
                                                        setRoiEffective(e.target.value);
                                                        setSanctionedInterestRate(e.target.value);
                                                    }}
                                                    className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#6B21A8]"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Sanction Letter URL / File</label>
                                            <input
                                                type="text"
                                                placeholder="/docs/sanction-letter-99.pdf"
                                                value={sanctionLetterUrl}
                                                onChange={(e) => setSanctionLetterUrl(e.target.value)}
                                                className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#6B21A8]"
                                            />
                                        </div>
                                    </div>
                                )}

                                {decisionType === "rejected" && (
                                    <div className="space-y-4 border-t border-[#E2E8F0] pt-4">
                                        <div>
                                            <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Rejection Reason</label>
                                            <textarea
                                                required
                                                rows={3}
                                                placeholder="Provide detailed reasons for decision analytics..."
                                                value={rejectionReason}
                                                onChange={(e) => setRejectionReason(e.target.value)}
                                                className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#6B21A8]"
                                            />
                                        </div>
                                    </div>
                                )}

                                {decisionType === "conditional" && (
                                    <div className="space-y-4 border-t border-[#E2E8F0] pt-4">
                                        <div>
                                            <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Outstanding Conditions</label>
                                            <textarea
                                                required
                                                rows={3}
                                                placeholder="Describe conditions student/staff must fulfill..."
                                                value={conditions}
                                                onChange={(e) => setConditions(e.target.value)}
                                                className="w-full px-4 py-3 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#6B21A8]"
                                            />
                                        </div>
                                    </div>
                                )}

                                {decisionType === "counter" && (
                                    <div className="space-y-4 border-t border-[#E2E8F0] pt-4">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div>
                                                <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Counter Amount (₹)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    value={counterAmount}
                                                    onChange={(e) => setCounterAmount(e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#6B21A8]"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Counter ROI (%)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    required
                                                    value={counterRate}
                                                    onChange={(e) => setCounterRate(e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#6B21A8]"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Counter Tenure (mo)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    placeholder="48"
                                                    value={counterTenure}
                                                    onChange={(e) => setCounterTenure(e.target.value)}
                                                    className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl text-xs font-semibold text-[#0F172A] focus:outline-none focus:border-[#6B21A8]"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-4 pt-3 border-t border-[#E2E8F0] mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowDecisionModal(false)}
                                        className="flex-1 bg-white hover:bg-[#F8FAFC] hover:border-[#94A3B8] text-[#475569] border border-[#CBD5E1] font-semibold text-sm px-5 py-2.5 rounded-xl cursor-pointer transition-all duration-200"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 bg-[#6B21A8] hover:bg-[#581C87] text-white font-semibold text-sm px-5 py-2.5 rounded-xl border-0 shadow-md shadow-purple-900/20 cursor-pointer transition-all duration-200"
                                    >
                                        RECORD DECISION
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Student Full Details Dossier Modal */}
            <AnimatePresence>
                {showUserDetailModal && selectedApp && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-y-auto font-sans">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            className="bg-white rounded-2xl shadow-xl max-w-4xl w-full overflow-hidden border border-[#E2E8F0] my-8 max-h-[92vh] flex flex-col font-sans text-[#0F172A]"
                        >
                            {/* Modal Executive Header Banner */}
                            <div className="bg-white px-6 py-5 border-b border-[#E2E8F0] flex flex-wrap items-center justify-between gap-4 shrink-0 font-sans">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-[#6B21A8] font-bold text-lg shadow-2xs">
                                        {(selectedApp.firstName || '?')[0]}{(selectedApp.lastName || '')[0] || ''}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <h2 className="text-2xl font-bold text-[#0F172A] tracking-tight uppercase">
                                                {selectedApp.firstName} {selectedApp.lastName}
                                            </h2>
                                            <span className="text-[10px] font-black text-[#6B21A8] bg-purple-50 px-2.5 py-0.5 rounded-md uppercase tracking-wider border border-purple-100">Application Profile</span>
                                            <StatusBadge status={selectedApp.status} />
                                        </div>
                                        <p className="text-sm text-[#64748B] font-mono mt-0.5 flex items-center gap-3">
                                            <span>LAN: <strong className="text-[#6B21A8] font-bold">{selectedApp.lanNumber || "Pending"}</strong></span>
                                            <span className="opacity-40">•</span>
                                            <span>App ID: <strong className="text-[#0F172A] font-bold">{selectedApp.applicationNumber || selectedApp.id?.slice(0, 14)}</strong></span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowUserDetailModal(false)}
                                        className="w-8 h-8 rounded-lg bg-[#F8FAFC] hover:bg-slate-200 text-[#64748B] hover:text-[#0F172A] transition-all flex items-center justify-center cursor-pointer border border-[#E2E8F0]"
                                        title="Close details viewer"
                                    >
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                </div>
                            </div>

                            {/* Modal Tabs Navigation */}
                            <div className="bg-white border-b border-[#E2E8F0] px-6 pt-2 flex items-center gap-1.5 overflow-x-auto shrink-0 custom-scrollbar font-sans">
                                {[
                                    { id: "personal", label: "Personal Profile", icon: "person" },
                                    { id: "academic", label: "Academic & Scores", icon: "school" },
                                    { id: "financial", label: "Co-Applicant & Finance", icon: "payments" },
                                    { id: "documents", label: "Uploaded Documents", icon: "folder" },
                                    { id: "decisions", label: "Bank Audit & Status", icon: "gavel" },
                                ].map((tab) => {
                                    const isActive = detailTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setDetailTab(tab.id as any)}
                                            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer border-b-2 ${isActive
                                                ? "bg-purple-50 text-[#6B21A8] border-[#6B21A8] font-bold shadow-2xs"
                                                : "text-[#64748B] hover:text-[#0F172A] border-transparent hover:bg-[#F8FAFC]"
                                                }`}
                                        >
                                            <span className="material-symbols-outlined text-base">{tab.icon}</span>
                                            <span>{tab.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Modal Body Container */}
                            <div className="p-6 overflow-y-auto flex-1 max-h-[calc(92vh-220px)] custom-scrollbar bg-[#F8FAFC] font-sans">
                                {loadingDetail ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-3">
                                        <div className="w-10 h-10 border-3 border-purple-200 border-t-[#6B21A8] rounded-full animate-spin" />
                                        <span className="text-xs font-semibold text-[#64748B]">Retrieving full student records & files...</span>
                                    </div>
                                ) : (
                                    <>
                                        {/* Tab 1: Personal Profile */}
                                        {detailTab === "personal" && (
                                            <div className="space-y-6">
                                                <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-all duration-200 space-y-4">
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 pb-3 border-b border-[#E2E8F0]">
                                                        <span className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                                                            <span className="material-symbols-outlined text-base">badge</span>
                                                        </span>
                                                        Identity & Contact Information
                                                    </h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                                        <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1">First Name</span>
                                                            <span className="text-sm font-semibold text-slate-800">{selectedApp.firstName || "N/A"}</span>
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1">Last Name</span>
                                                            <span className="text-sm font-semibold text-slate-800">{selectedApp.lastName || "N/A"}</span>
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1">Gender & DOB</span>
                                                            <span className="text-sm font-semibold text-slate-800">{selectedApp.gender || "N/A"} {selectedApp.dob ? `• ${selectedApp.dob}` : ""}</span>
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1">Email Address</span>
                                                            <span className="text-sm font-semibold text-slate-800 truncate block">{selectedApp.email || "N/A"}</span>
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1">Mobile / Phone</span>
                                                            <span className="text-sm font-semibold text-slate-800">{selectedApp.phone || selectedApp.mobile || selectedApp.phoneNumber || "N/A"}</span>
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1">Student System ID</span>
                                                            <span className="font-mono font-bold text-slate-900">{selectedApp.userId || selectedApp.studentId || selectedApp.id}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-all duration-200 space-y-4">
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569] flex items-center gap-2 pb-3 border-b border-[#E2E8F0]">
                                                        <span className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-[#6B21A8]">
                                                            <span className="material-symbols-outlined text-base">home_pin</span>
                                                        </span>
                                                        Address & National Identifiers
                                                    </h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                                        <div className="md:col-span-3 bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Permanent Residence Address</span>
                                                            <span className="text-[15px] font-semibold text-[#0F172A]">
                                                                {selectedApp.address ? `${selectedApp.address}${selectedApp.city ? `, ${selectedApp.city}` : ""}${selectedApp.state ? `, ${selectedApp.state}` : ""}${selectedApp.pincode ? ` - ${selectedApp.pincode}` : ""}` : "Not Provided"}
                                                            </span>
                                                        </div>
                                                        {(() => {
                                                            const rawDocs: any[] = selectedApp.documents || selectedApp.userDocuments || selectedApp.uploadedDocuments || [];
                                                            
                                                            const getNationalId = (
                                                                typeKeywords: string[],
                                                                directFields: (string | undefined | null)[]
                                                            ) => {
                                                                for (const val of directFields) {
                                                                    if (val && typeof val === 'string' && val.trim() && val.trim() !== 'N/A' && val.trim() !== 'null') {
                                                                        return val.trim();
                                                                    }
                                                                }
                                                                for (const doc of rawDocs) {
                                                                    if (doc.status === "not_uploaded") continue;
                                                                    const typeStr = (doc.docType || doc.category || doc.title || doc.name || doc.fileName || '').toLowerCase();
                                                                    if (typeKeywords.some(kw => typeStr.includes(kw))) {
                                                                        const ext = doc.extractedData || doc.details || doc.metadata || {};
                                                                        const num =
                                                                            doc.docNumber ||
                                                                            doc.documentNumber ||
                                                                            doc.extractedNumber ||
                                                                            doc.number ||
                                                                            ext.pan_number || ext.panNumber || ext.pan_no || ext.pan ||
                                                                            ext.aadhaar_number || ext.aadhar_number || ext.aadhaarNumber || ext.aadharNumber || ext.id_number || ext.uid ||
                                                                            ext.passport_number || ext.passportNumber || ext.passport_no || ext.passportNo;

                                                                        if (num && typeof num === 'string' && num.trim() && num.trim() !== 'N/A') {
                                                                            return num.trim();
                                                                        }
                                                                        if (doc.filePath || doc.url || doc.uploaded || doc.status === "uploaded" || doc.status === "verified" || doc.fileName) {
                                                                            return "Document Uploaded";
                                                                        }
                                                                    }
                                                                }
                                                                return "N/A";
                                                            };

                                                            const panVal = getNationalId(['pan'], [selectedApp.panNumber, selectedApp.pan, selectedApp.panCardNumber, selectedApp.user?.panCardNumber, selectedApp.user?.panNumber, selectedApp.user?.pan]);
                                                            const aadhaarVal = getNationalId(['aadhar', 'aadhaar'], [selectedApp.aadhaarNumber, selectedApp.aadhaar, selectedApp.aadharNumber, selectedApp.aadhar, selectedApp.user?.aadhaarNumber, selectedApp.user?.aadhaar, selectedApp.user?.aadharNumber]);
                                                            const passportVal = getNationalId(['passport'], [selectedApp.passportNumber, selectedApp.passport, selectedApp.user?.passportNumber, selectedApp.user?.passport]);

                                                            return (
                                                                <>
                                                                    <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                                        <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">PAN Card Number</span>
                                                                        <span className={`font-mono text-sm font-semibold uppercase ${panVal === 'Document Uploaded' ? 'text-[#6B21A8] font-bold' : 'text-[#0F172A]'}`}>{panVal}</span>
                                                                    </div>
                                                                    <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                                        <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Aadhaar Number</span>
                                                                        <span className={`font-mono text-sm font-semibold ${aadhaarVal === 'Document Uploaded' ? 'text-[#6B21A8] font-bold' : 'text-[#0F172A]'}`}>{aadhaarVal}</span>
                                                                    </div>
                                                                    <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                                        <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Passport Number</span>
                                                                        <span className={`font-mono text-sm font-semibold uppercase ${passportVal === 'Document Uploaded' ? 'text-[#6B21A8] font-bold' : 'text-[#0F172A]'}`}>{passportVal}</span>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Tab 2: Academic & Test Scores (DYNAMIC) */}
                                        {detailTab === "academic" && (
                                            <div className="space-y-6">
                                                <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-all duration-200 space-y-4">
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569] flex items-center gap-2 pb-3 border-b border-[#E2E8F0]">
                                                        <span className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-[#6B21A8]">
                                                            <span className="material-symbols-outlined text-base">school</span>
                                                        </span>
                                                        Target Program & Country
                                                    </h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                        <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                                                            <span className="text-[11px] font-semibold text-[#6B21A8] uppercase tracking-wider block mb-1">Target Foreign University</span>
                                                            <span className="font-bold text-[#0F172A] text-base">{selectedApp.universityName || selectedApp.university || selectedApp.targetUniversity || "Not Specified"}</span>
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Field of Study</span>
                                                            <span className="text-sm font-semibold text-[#0F172A]">
                                                                {(() => {
                                                                    const val = selectedApp.loanType || selectedApp.fieldOfStudy || selectedApp.courseType || selectedApp.programFocus || selectedApp.courseName || selectedApp.course;
                                                                    if (!val) return "Not Specified";
                                                                    const clean = String(val).trim();
                                                                    if (/^undergraduate(\s*abroad)?$/i.test(clean)) return "Undergraduate Abroad";
                                                                    if (/^postgraduate(\s*abroad)?$/i.test(clean)) return "Postgraduate Abroad";
                                                                    if (/^(doctoral|doctorate|phd)(\s*abroad)?$/i.test(clean) || clean.toLowerCase() === "doctoral/phd abroad") return "Doctoral/PhD Abroad";
                                                                    if (/^professional(\s*course)?$/i.test(clean)) return "Professional Course";
                                                                    return clean;
                                                                })()}
                                                            </span>
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Destination Country</span>
                                                            <span className="text-sm font-semibold text-[#0F172A]">{selectedApp.country || selectedApp.countryOfStudy || selectedApp.studyDestination || "Not Specified"}</span>
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Applied On</span>
                                                            <span className="text-sm font-semibold text-[#0F172A]">
                                                                {(() => {
                                                                    const rawDate = selectedApp.appliedOn || selectedApp.appliedDate || selectedApp.submittedAt || selectedApp.createdAt || selectedApp.created_at || selectedApp.lanEnteredAt;
                                                                    if (!rawDate) return "—";
                                                                    try {
                                                                        const parsed = new Date(rawDate);
                                                                        return isNaN(parsed.getTime()) ? "—" : format(parsed, "dd MMM yyyy");
                                                                    } catch {
                                                                        return "—";
                                                                    }
                                                                })()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-all duration-200 space-y-4">
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569] flex items-center gap-2 pb-3 border-b border-[#E2E8F0]">
                                                        <span className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-[#6B21A8]">
                                                            <span className="material-symbols-outlined text-base">analytics</span>
                                                        </span>
                                                        Prior Academics
                                                    </h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                        <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Academic % / GPA</span>
                                                            <span className="font-bold text-[#0F172A] text-base">
                                                                {selectedApp.academicPercentage || selectedApp.academicScore || selectedApp.percentage || (selectedApp.sscScore ? `SSC: ${selectedApp.sscScore}%` : null) || "N/A"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Tab 3: Co-Applicant & Financials (DYNAMIC) */}
                                        {detailTab === "financial" && (
                                            <div className="space-y-6">
                                                <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-all duration-200 space-y-4">
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569] flex items-center gap-2 pb-3 border-b border-[#E2E8F0]">
                                                        <span className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-[#6B21A8]">
                                                            <span className="material-symbols-outlined text-base">supervisor_account</span>
                                                        </span>
                                                        Co-Applicant / Guarantor Profile
                                                    </h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                                        <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1">Co-Applicant Name</span>
                                                            <span className="text-sm font-semibold text-slate-800">{selectedApp.coApplicantName || selectedApp.coApplicant || "N/A"}</span>
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1">Relationship</span>
                                                            <span className="text-sm font-semibold text-slate-800">{selectedApp.coApplicantRelation || selectedApp.relation || "N/A"}</span>
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1">Occupation</span>
                                                            <span className="text-sm font-semibold text-slate-800">{selectedApp.coApplicantOccupation || selectedApp.occupation || "N/A"}</span>
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1">Annual Income</span>
                                                            <span className="text-sm font-semibold text-emerald-700 font-mono">
                                                                {selectedApp.coApplicantIncome ? `₹${Number(selectedApp.coApplicantIncome).toLocaleString("en-IN")} / year` : "N/A"}
                                                            </span>
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1">Co-Applicant PAN</span>
                                                            <span className="font-mono text-sm font-semibold text-slate-800 uppercase">{selectedApp.coApplicantPan || "N/A"}</span>
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-3.5 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1">Co-Applicant Mobile</span>
                                                            <span className="text-sm font-semibold text-slate-800">{selectedApp.coApplicantMobile || selectedApp.coappPhone || "N/A"}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-all duration-200 space-y-4">
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569] flex items-center gap-2 pb-3 border-b border-[#E2E8F0]">
                                                        <span className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-[#6B21A8]">
                                                            <span className="material-symbols-outlined text-base">credit_score</span>
                                                        </span>
                                                        Loan Amount & Credit Rating
                                                    </h3>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                                        <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                                                            <span className="text-[11px] font-semibold text-[#6B21A8] uppercase tracking-wider block mb-1">Total Loan Requested</span>
                                                            <span className="font-bold text-[#6B21A8] text-xl font-mono">₹{(selectedApp.amount || 0).toLocaleString("en-IN")}</span>
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">CIBIL Credit Score</span>
                                                            {(() => {
                                                                const score = selectedApp.cibilScore || selectedApp.cibil || selectedApp.creditScore || selectedApp.user?.cibilScore || selectedApp.user?.cibil;
                                                                if (!score) {
                                                                    return <span className="font-semibold text-[#64748B] text-sm">Pending</span>;
                                                                }
                                                                const scoreNum = Number(score);
                                                                let rating = "Good";
                                                                let colorClass = "text-[#15803D]";
                                                                if (scoreNum >= 750) { rating = "Excellent"; colorClass = "text-[#15803D]"; }
                                                                else if (scoreNum >= 700) { rating = "Good"; colorClass = "text-emerald-600"; }
                                                                else if (scoreNum >= 650) { rating = "Fair"; colorClass = "text-[#B45309]"; }
                                                                else { rating = "Needs Improvement"; colorClass = "text-rose-600"; }

                                                                return (
                                                                    <span className={`font-bold text-xl font-mono flex items-center gap-1.5 ${colorClass}`}>
                                                                        <span className="material-symbols-outlined text-base">verified</span>
                                                                        {scoreNum} <span className="text-xs font-medium text-[#64748B]">({rating})</span>
                                                                    </span>
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0]">
                                                            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block mb-1">Collateral Offered</span>
                                                            <span className="text-sm font-semibold text-[#0F172A]">
                                                                {selectedApp.collateralOffered || selectedApp.hasCollateral
                                                                    ? `${selectedApp.collateralType || 'Property'} (₹${(Number(selectedApp.collateralValue) || 0).toLocaleString('en-IN')})`
                                                                    : "Unsecured Loan (No Collateral)"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Tab 4: Uploaded Documents (DYNAMIC - ONLY UPLOADED FILES) */}
                                        {detailTab === "documents" && (
                                            <div className="space-y-4 font-sans">
                                                {(() => {
                                                    const rawDocs: any[] = selectedApp.documents || selectedApp.userDocuments || selectedApp.uploadedDocuments || [];
                                                    const uploadedDocs = rawDocs.filter((doc: any) => {
                                                        if (doc.status === "not_uploaded") return false;
                                                        return !!(doc.filePath || doc.url || doc.uploaded || doc.status === "uploaded" || doc.status === "verified" || doc.fileName);
                                                    });

                                                    return (
                                                        <>
                                                            <div className="flex items-center justify-between">
                                                                <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                                                                    Attached Student Application Files ({uploadedDocs.length})
                                                                </h3>
                                                                <span className="text-xs text-[#64748B] font-medium">All documents verified by VidyaLoans Audit</span>
                                                            </div>

                                                            {uploadedDocs.length === 0 ? (
                                                                <div className="bg-white p-8 rounded-xl border border-[#E2E8F0] text-center space-y-2 my-2">
                                                                    <div className="w-12 h-12 rounded-xl bg-slate-100 text-[#64748B] mx-auto flex items-center justify-center">
                                                                        <span className="material-symbols-outlined text-2xl">folder_off</span>
                                                                    </div>
                                                                    <p className="text-sm font-bold text-[#0F172A]">No Uploaded Documents Found</p>
                                                                    <p className="text-xs text-[#64748B]">The student has not uploaded any document files for this application yet.</p>
                                                                </div>
                                                            ) : (
                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                                    {uploadedDocs.map((doc: any, idx: number) => {
                                                                        const docTitle = doc.docName || doc.title || doc.fileName || doc.name || doc.docType || `Uploaded Document ${idx + 1}`;
                                                                        const docFileName = doc.fileName || doc.filePath?.split("/").pop() || `${doc.docType || 'Document'}.pdf`;
                                                                        const docTypeLabel = doc.docType || doc.category || "Uploaded File";
                                                                        const fileTarget = doc.filePath || doc.url || docFileName;
                                                                        const downloadUrl = `/api/documents/download?appId=${selectedApp.id}&file=${encodeURIComponent(fileTarget)}`;

                                                                        return (
                                                                            <div key={doc.id || idx} className="bg-white p-4 rounded-xl border border-[#E2E8F0] hover:border-[#CBD5E1] shadow-2xs flex items-center justify-between gap-3 transition-all">
                                                                                <div className="flex items-center gap-3 min-w-0">
                                                                                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#6B21A8] flex items-center justify-center border border-purple-100 shrink-0">
                                                                                        <span className="material-symbols-outlined text-xl">
                                                                                            {docTypeLabel.toLowerCase().includes("passport") || docTypeLabel.toLowerCase().includes("id") ? "badge" :
                                                                                             docTypeLabel.toLowerCase().includes("academic") || docTypeLabel.toLowerCase().includes("transcript") || docTypeLabel.toLowerCase().includes("degree") || docTypeLabel.toLowerCase().includes("offer") ? "school" :
                                                                                             docTypeLabel.toLowerCase().includes("tax") || docTypeLabel.toLowerCase().includes("statement") || docTypeLabel.toLowerCase().includes("bank") || docTypeLabel.toLowerCase().includes("itr") ? "payments" : "description"}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="min-w-0">
                                                                                        <h4 className="font-semibold text-[#0F172A] truncate" title={docTitle}>{docTitle}</h4>
                                                                                        <p className="text-[11px] text-[#64748B] font-mono truncate" title={docFileName}>{docFileName}</p>
                                                                                    </div>
                                                                                </div>

                                                                                <a
                                                                                    href={downloadUrl}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="px-3 py-1.5 bg-[#F8FAFC] hover:bg-[#0F172A] text-[#475569] hover:text-white rounded-xl font-semibold text-xs transition-all flex items-center gap-1 shrink-0 border border-[#CBD5E1]"
                                                                                >
                                                                                    <span className="material-symbols-outlined text-xs">visibility</span>
                                                                                    View
                                                                                </a>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        {/* Tab 5: Bank Decisions & Actions */}
                                        {detailTab === "decisions" && (
                                            <div className="space-y-6">
                                                <div className="bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-xs hover:shadow-sm transition-all duration-200 space-y-4">
                                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#475569] flex items-center gap-2 pb-3 border-b border-[#E2E8F0]">
                                                        <span className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center text-[#6B21A8]">
                                                            <span className="material-symbols-outlined text-base">gavel</span>
                                                        </span>
                                                        Current Decision Status & Actions
                                                    </h3>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                                        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] space-y-2">
                                                            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">Assigned LAN Number</span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono font-bold text-[#6B21A8] text-sm bg-purple-50 px-3 py-1 rounded-lg border border-purple-100">
                                                                    {selectedApp.lanNumber || "Not Assigned"}
                                                                </span>
                                                                {!selectedApp.lanNumber && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setShowUserDetailModal(false);
                                                                            setShowLanModal(true);
                                                                        }}
                                                                        className="px-3 py-1 bg-[#6B21A8] hover:bg-[#581C87] text-white rounded-lg font-semibold text-xs transition-all border-0 shadow-sm"
                                                                    >
                                                                        Assign LAN
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <div className="bg-[#F8FAFC] p-4 rounded-xl border border-[#E2E8F0] space-y-2">
                                                            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider block">Audit Verdict</span>
                                                            <StatusBadge status={selectedApp.status} />
                                                        </div>
                                                    </div>

                                                    <div className="pt-2 flex flex-wrap gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setShowUserDetailModal(false);
                                                                setShowDecisionModal(true);
                                                            }}
                                                            className="bg-[#6B21A8] hover:bg-[#581C87] text-white font-semibold text-sm px-5 py-2.5 rounded-xl border-0 shadow-md shadow-purple-900/20 cursor-pointer transition-all duration-200 flex items-center gap-2 uppercase tracking-wider"
                                                        >
                                                            <span className="material-symbols-outlined text-base">gavel</span>
                                                            RECORD DECISION
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
