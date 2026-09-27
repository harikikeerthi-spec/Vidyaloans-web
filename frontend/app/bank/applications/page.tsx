"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInDays, parseISO } from "date-fns";
import { adminApi, bankApi, getToken } from "@/lib/api";
import { DataTable, StatusBadge, PriorityTag } from "@/components/bank/SharedUI";
import { useRouter } from "next/navigation";

import BankApplicationDetailView from "@/components/bank/BankApplicationDetailView";

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

    // Full-Page Student Dossier View State (No Popup)
    const [fullPageAppId, setFullPageAppId] = useState<string | null>(null);
    const [fullPageApp, setFullPageApp] = useState<any | null>(null);
    const [fullPageLoading, setFullPageLoading] = useState(false);
    const [remarksList, setRemarksList] = useState<any[]>([]);
    const [fullPageMode, setFullPageMode] = useState<"profile" | "review">("profile");
    const [pendingReviewAfterLan, setPendingReviewAfterLan] = useState<boolean>(false);

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

    // Load full-page application dossier
    const loadFullPageDossier = async (appId: string, initialRow?: any) => {
        if (!appId) return;
        setFullPageAppId(appId);
        setFullPageLoading(true);
        if (initialRow) {
            setFullPageApp(initialRow);
            setSelectedApp(initialRow);
        }

        try {
            const [detailRes, docsRes, appRes, remarksRes]: [any, any, any, any] = await Promise.all([
                bankApi.getFileDetail(appId).catch(() => null),
                bankApi.getDocuments(appId).catch(() => []),
                !initialRow ? adminApi.getApplication(appId).catch(() => null) : Promise.resolve(null),
                adminApi.getRemarks(appId).catch(() => ({ data: [] })),
            ]);

            const docsList = Array.isArray(docsRes) ? docsRes : (docsRes?.data || docsRes?.documents || []);
            const baseApp = initialRow || appRes?.data || appRes || applications.find(a => a.id === appId || a._id === appId || a.applicationNumber === appId) || {};
            const mergedApp = {
                ...baseApp,
                ...(detailRes || {}),
                documents: docsList.length > 0 ? docsList : (detailRes?.documents || baseApp?.documents || []),
            };
            setFullPageApp(mergedApp);
            setSelectedApp(mergedApp);

            // Remarks & AI review
            const rList = Array.isArray(remarksRes?.data) ? remarksRes.data : (Array.isArray(remarksRes) ? remarksRes : []);
            setRemarksList(rList);
            const aiNote = rList.find((n: any) => n.type === "ai_review");
            if (aiNote) {
                try {
                    setAiReview(JSON.parse(aiNote.content));
                } catch {
                    setAiReview(null);
                }
            }
        } catch (err) {
            console.error("Failed to load full page application dossier:", err);
        } finally {
            setFullPageLoading(false);
        }
    };

    // Read URL parameters for auto-selecting an application in Full Page view
    useEffect(() => {
        if (mounted && typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const appId = params.get("id");
            const modeParam = params.get("mode") as "profile" | "review" | null;
            if (appId) {
                setFullPageMode(modeParam === "review" ? "review" : "profile");
                const found = applications.find(a => a.id === appId || a._id === appId || a.applicationNumber === appId);
                loadFullPageDossier(appId, found);
            } else {
                setFullPageApp(null);
                setFullPageAppId(null);
            }
        }
    }, [mounted, applications]);

    // Handle browser back/forward buttons
    useEffect(() => {
        if (typeof window === "undefined") return;
        const onPopState = () => {
            const params = new URLSearchParams(window.location.search);
            const appId = params.get("id");
            const modeParam = params.get("mode") as "profile" | "review" | null;
            if (appId) {
                setFullPageMode(modeParam === "review" ? "review" : "profile");
                const found = applications.find(a => a.id === appId || a._id === appId || a.applicationNumber === appId);
                loadFullPageDossier(appId, found);
            } else {
                setFullPageApp(null);
                setFullPageAppId(null);
            }
        };
        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, [applications]);

    // Opens Student Profile full-page view (Underwriting & LAN and Audit Log tabs removed)
    const handleOpenStudentProfile = (row: any) => {
        if (!row) return;
        const appId = row.id || row._id || row.applicationNumber;
        setFullPageMode("profile");
        const newUrl = `${window.location.pathname}?id=${appId}&mode=profile`;
        window.history.pushState({ id: appId, mode: "profile" }, "", newUrl);
        loadFullPageDossier(appId, row);
    };

    // Review button: If no LAN, prompt LAN modal first. After LAN added (or if already exists), open review with audit log.
    const handleReviewClick = (row: any) => {
        if (!row) return;
        setSelectedApp(row);
        if (!row.lanNumber) {
            // First when the application comes, the LAN number should be added!
            setLanNumber("");
            setConfirmingLog(false);
            setPendingReviewAfterLan(true);
            setShowLanModal(true);
        } else {
            // LAN already assigned: directly open review view with audit log!
            openReviewDossier(row);
        }
    };

    const openReviewDossier = (row: any) => {
        const appId = row.id || row._id || row.applicationNumber;
        setFullPageMode("review");
        const newUrl = `${window.location.pathname}?id=${appId}&mode=review`;
        window.history.pushState({ id: appId, mode: "review" }, "", newUrl);
        loadFullPageDossier(appId, row);
    };

    const handleBackToTable = () => {
        setFullPageApp(null);
        setFullPageAppId(null);
        setSelectedApp(null);
        setPendingReviewAfterLan(false);
        window.history.pushState({}, "", window.location.pathname);
    };

    const handleAddFullPageRemark = async (content: string) => {
        const appId = fullPageAppId || fullPageApp?.id || fullPageApp?._id;
        if (!appId) return;
        try {
            await adminApi.addRemark(appId, {
                content,
                type: "underwriting_note",
            });
            loadFullPageDossier(appId, fullPageApp);
        } catch (err) {
            console.error("Failed to add remark:", err);
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
                // Refresh applications table
                handleRefresh();

                const updatedApp = {
                    ...(fullPageApp || selectedApp),
                    lanNumber: lanNumber.trim(),
                    status: "file_logged",
                    stage: "under_review"
                };

                // As requested: "after adding the lan number audit log should open"
                if (pendingReviewAfterLan || fullPageMode === "review" || !fullPageApp) {
                    setPendingReviewAfterLan(false);
                    openReviewDossier(updatedApp);
                } else if (fullPageAppId || fullPageApp) {
                    loadFullPageDossier(fullPageAppId || fullPageApp?.id, updatedApp);
                }
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
            if (fullPageAppId || fullPageApp) {
                loadFullPageDossier(fullPageAppId || fullPageApp?.id, optimisticApp);
            }
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

    const renderLanModal = () => (
        <AnimatePresence>
            {showLanModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans text-[#0F172A]">
                    <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => { setShowLanModal(false); setConfirmingLog(false); setPendingReviewAfterLan(false); }} />
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="bg-white rounded-2xl border border-[#E2E8F0] shadow-xl p-6 max-w-md w-full z-10 relative overflow-hidden"
                    >
                        <h3 className="text-2xl font-bold text-[#0F172A] mb-1 uppercase tracking-tight">Log File & Assign LAN</h3>
                        <p className="text-xs text-[#64748B] mb-6 font-medium">Assign the core banking Loan Account Number (LAN) to register this file and proceed to active audit review.</p>

                        <form onSubmit={handleLogFile} className="space-y-5">
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
                                        else {
                                            setShowLanModal(false);
                                            setPendingReviewAfterLan(false);
                                        }
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
    );

    const renderDecisionModal = () => (
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
    );

    if (!mounted) return null;

    // ─── FULL PAGE APPLICATION DOSSIER VIEW (NO POPUP) ────────────────
    if (fullPageAppId || fullPageApp) {
        return (
            <div className="w-full">
                <BankApplicationDetailView
                    app={fullPageApp}
                    loading={fullPageLoading}
                    mode={fullPageMode}
                    initialTab={fullPageMode === "review" ? "remarks" : "personal"}
                    onBack={handleBackToTable}
                    onRefresh={() => loadFullPageDossier(fullPageAppId || fullPageApp?.id, fullPageApp)}
                    onOpenLanModal={() => {
                        setSelectedApp(fullPageApp);
                        setShowLanModal(true);
                    }}
                    onOpenDecisionModal={() => {
                        setSelectedApp(fullPageApp);
                        if (fullPageApp?.amount) {
                            setSanctionAmount(fullPageApp.amount.toString());
                        }
                        setShowDecisionModal(true);
                    }}
                    aiReview={aiReview}
                    remarks={remarksList}
                    onAddRemark={handleAddFullPageRemark}
                />
                {renderLanModal()}
                {renderDecisionModal()}
            </div>
        );
    }

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
                                            onClick={() => handleOpenStudentProfile(row)}
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
                                                            handleOpenStudentProfile(row);
                                                        }}
                                                        className="text-[14.5px] font-bold text-slate-950 hover:text-indigo-600 hover:underline transition-colors cursor-pointer inline-flex items-center gap-1.5 group"
                                                        title="Click to view student profile (KYC, academics, finances, documents)"
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
                                                            handleOpenStudentProfile(row);
                                                        }}
                                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-purple-100 hover:text-purple-700 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                                        title="Click to view student profile"
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
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleReviewClick(row);
                                                        }}
                                                        className="px-3.5 py-1.5 bg-[#0F172A] hover:bg-[#6B21A8] text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer uppercase tracking-wider"
                                                        title="Open Review: Assign LAN and view Audit Log"
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

            {renderLanModal()}
            {renderDecisionModal()}
        </div>
    );
}
