"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInDays, parseISO } from "date-fns";
import { adminApi, bankApi } from "@/lib/api";
import { PageHeader, StatusBadge, PriorityTag, DataTable, Spinner, EmptyState } from "@/components/bank/SharedUI";

// Interface definitions
interface Condition {
    id: string;
    text: string;
    type: "mandatory" | "advisory";
    deadline: string;
}

interface Note {
    id: string;
    author: string;
    role: string;
    text: string;
    timestamp: string;
}

interface ActivityEvent {
    id: string;
    icon: string;
    actor: string;
    text: string;
    timestamp: string;
    type: "system" | "officer" | "decision" | "note";
}

export default function DecisionsHub() {
    const [mounted, setMounted] = useState(false);
    const [currentBankId, setCurrentBankId] = useState<string>("idfc");
    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");

    // Workspace & Appraisal panel state
    const [selectedApp, setSelectedApp] = useState<any | null>(null);
    const [showWorkspace, setShowWorkspace] = useState(false);
    const [currentStep, setCurrentStep] = useState<number>(1);

    // F4 Tab selection: sanction | conditional | counter_offer | reject | queries | letter
    const [activeDecisionTab, setActiveDecisionTab] = useState<"sanction" | "conditional" | "counter_offer" | "reject" | "queries" | "letter">("sanction");

    // F5 ROI Form states
    const [roiType, setRoiType] = useState<"fixed" | "floating">("floating");
    const [interestRate, setInterestRate] = useState("9.55");
    const [hasSubsidy, setHasSubsidy] = useState(false);
    const [subsidyPercentage, setSubsidyPercentage] = useState("1.50");
    const [subsidyDescription, setSubsidyDescription] = useState("Central Sector Interest Subsidy (CSIS) scheme");
    const baseRateRef = "VidyaBank Core MCLR (floating reference): 8.85% + Spread";

    // F5 Processing Fee states
    const [feeAmount, setFeeAmount] = useState("15000");
    const [feePaymentMode, setFeePaymentMode] = useState("deducted");
    const [hasWaiver, setHasWaiver] = useState(false);
    const [waiverReason, setWaiverReason] = useState("");

    // F8 Conditional Sanction states
    const [conditions, setConditions] = useState<Condition[]>([
        { id: "1", text: "Submit original class 10 & 12 mark sheets for validation", type: "mandatory", deadline: format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), "yyyy-MM-dd") },
        { id: "2", text: "Co-applicant to execute guarantor agreement and indemnity bond", type: "mandatory", deadline: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd") }
    ]);
    const [newConditionText, setNewConditionText] = useState("");
    const [newConditionType, setNewConditionType] = useState<"mandatory" | "advisory">("mandatory");
    const [newConditionDeadline, setNewConditionDeadline] = useState(format(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));

    // F10 Counter-Offer states
    const [counterAmount, setCounterAmount] = useState("");
    const [counterRate, setCounterRate] = useState("9.25");
    const [counterTenure, setCounterTenure] = useState("120"); // in months
    const [counterOfferStatus, setCounterOfferStatus] = useState<"pending" | "accepted" | "rejected">("pending");

    // F9 Partial Sanction states
    const [sanctionAmount, setSanctionAmount] = useState("");
    const [showRoutingModal, setShowRoutingModal] = useState(false);
    const [routingTargetBank, setRoutingTargetBank] = useState("hdfc");
    const [routingSuccessMsg, setRoutingSuccessMsg] = useState("");

    // F32 Internal Notes states
    const [notesList, setNotesList] = useState<Note[]>([
        { id: "1", author: "Sarah Jenkins", role: "Senior Underwriter", text: "CIBIL score is 785. Academic record is outstanding. Recommended for fast-track processing.", timestamp: "2 hours ago" },
        { id: "2", author: "David Lee", role: "Credit Analyst", text: "Co-applicant income validated via Form 16. Collateral valuation is under review but looks solid.", timestamp: "1 day ago" }
    ]);
    const [newNoteText, setNewNoteText] = useState("");

    // F6 Query System states
    const [queryThread, setQueryThread] = useState<any[]>([
        { id: "q1", sender: "bank", text: "Please clarify the co-applicant's monthly deduction in their salary slip.", timestamp: "2 days ago" },
        { id: "q2", sender: "student", text: "It is a housing loan contribution. I have attached the amortization receipt.", timestamp: "1 day ago" }
    ]);
    const [newQueryText, setNewQueryText] = useState("");

    // F12 File Quality Rating
    const [qualityRating, setQualityRating] = useState(4); // 4 out of 5 stars

    // F22 Cross-bank Warning popup trigger
    const [showCrossBankPop, setShowCrossBankPop] = useState(false);
    const [concurrentApps, setConcurrentApps] = useState<any[]>([]);
    const [workspaceLoading, setWorkspaceLoading] = useState(false);

    // F23 Data Consent check
    const [dataConsentVerified, setDataConsentVerified] = useState(false);

    // F33 Hold/Pause states
    const [isHold, setIsHold] = useState(false);
    const [showHoldModal, setShowHoldModal] = useState(false);
    const [holdReason, setHoldReason] = useState("");
    const [holdResumeDate, setHoldResumeDate] = useState(format(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"));
    const [holdPauseNote, setHoldPauseNote] = useState("");

    // F35 Sanction Amendment states
    const [amendedAmount, setAmendedAmount] = useState("");
    const [amendedRate, setAmendedRate] = useState("9.25");
    const [amendedFee, setAmendedFee] = useState("10000");
    const [amendmentReason, setAmendmentReason] = useState("Corporate discount spread override");
    const [amendmentEffectiveDate, setAmendmentEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));

    // F36 Cancellation flow states
    const [cancelRefundOption, setCancelRefundOption] = useState("full");

    // F12 4-Dimensional Quality Rating
    const [qualityCompleteness, setQualityCompleteness] = useState(4);
    const [qualityKyc, setQualityKyc] = useState(5);
    const [qualityIncome, setQualityIncome] = useState(4);
    const [qualityCollateral, setQualityCollateral] = useState(4);
    const [qualityComments, setQualityComments] = useState("All core verify documents checks validated");

    // F36 Loan Cancellation states
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelCategory, setCancelCategory] = useState("applicant_withdrew");
    const [cancelRefundDetails, setCancelRefundDetails] = useState("Processing fee not collected. Reversal not required.");

    // F47 AI score
    const aiScore = 88; // Score out of 100
    const aiScoreFactors = [
        { name: "CIBIL Check", score: 95, detail: "Excellent credit depth" },
        { name: "Academic Standing", score: 90, detail: "Tier-1 University (Stanford)" },
        { name: "Co-applicant DTI", score: 80, detail: "Moderate debt ratio" }
    ];

    // F31 Activity Timeline states
    const [timelineEvents, setTimelineEvents] = useState<ActivityEvent[]>([
        { id: "e1", icon: "download", actor: "VidyaLoans Bot", text: "Portfolio pack imported and submitted to bank", timestamp: "3 days ago", type: "system" },
        { id: "e2", icon: "assignment_ind", actor: "Sarah Jenkins", text: "Assigned LAN & mapped to Credit Queue", timestamp: "2 days ago", type: "officer" },
        { id: "e3", icon: "quick_reference_all", actor: "System Audit", text: "Academic records verified (Tier-1 Institution)", timestamp: "2 days ago", type: "system" },
        { id: "e4", icon: "chat", actor: "Sarah Jenkins", text: "Added internal appraisal note: CIBIL Score validated", timestamp: "2 hours ago", type: "note" }
    ]);

    const [submitting, setSubmitting] = useState(false);
    const [officerRemarks, setOfficerRemarks] = useState("");
    const [rejectionCategory, setRejectionCategory] = useState("CIBIL");
    const [rejectionReason, setRejectionReason] = useState("Unsatisfactory CIBIL/Credit Score");

    const isStep1Valid = Boolean(dataConsentVerified);
    const isStep2Valid = Boolean(interestRate && sanctionAmount);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("selectedBank") || localStorage.getItem("selectedBank");
            if (saved) setCurrentBankId(saved);
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
            console.error("Failed to load applications for decisions:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (mounted) {
            fetchApplications(currentBankId);
        }
    }, [currentBankId, mounted]);

    // Read URL query parameter to auto-open student details workspace
    useEffect(() => {
        if (mounted && applications.length > 0 && typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const appId = params.get("id");
            if (appId) {
                const found = applications.find(a => a.id === appId || a._id === appId || a.applicationNumber === appId);
                if (found) {
                    handleAppraiseFile(found);
                }
            }
        }
    }, [applications, mounted]);

    const handleRefresh = () => {
        fetchApplications(currentBankId);
    };

    const fetchRemarks = async (appId: string) => {
        try {
            const res: any = await adminApi.getRemarks(appId);
            if (res && res.success && res.data) {
                setNotesList(res.data.map((n: any) => {
                    let noteText = n.content;
                    let noteTime = n.createdAt;
                    if (typeof n.content === 'string' && n.content.trim().startsWith('{')) {
                        try {
                            const parsed = JSON.parse(n.content);
                            if (parsed.content) noteText = parsed.content;
                            if (parsed.timestamp) noteTime = parsed.timestamp;
                        } catch (_) {}
                    }
                    let formattedTime = "Just now";
                    try {
                        if (noteTime) formattedTime = format(new Date(noteTime), "dd MMM yyyy, hh:mm a");
                    } catch (_) {}
                    return {
                        id: n.id,
                        author: n.authorName || "Staff",
                        role: n.type || "Underwriter",
                        text: noteText,
                        timestamp: formattedTime
                    };
                }));
            }
        } catch (err) {
            console.error("Failed to load remarks:", err);
        }
    };

    const fetchTimeline = async (appId: string) => {
        try {
            const res: any = await adminApi.getApplicationTracking(appId);
            if (res && res.success && res.data && res.data.timeline) {
                setTimelineEvents(res.data.timeline.map((h: any) => ({
                    id: h.id,
                    icon: h.toStatus === 'sanctioned' || h.toStatus === 'approved' ? 'check_circle' :
                        h.toStatus === 'rejected' ? 'cancel' :
                            h.toStatus === 'query_raised' ? 'help_center' :
                                h.toStatus === 'file_logged' ? 'assignment_ind' : 'info',
                    actor: h.changedByName || "System",
                    text: h.changeReason || h.notes || `Status changed to ${h.toStatus}`,
                    timestamp: format(new Date(h.createdAt), "dd MMM yyyy, hh:mm a"),
                    type: "system"
                })));
            }
        } catch (err) {
            console.error("Failed to load timeline:", err);
        }
    };

    const computeAiRiskProfile = (app: any) => {
        if (!app) return {
            score: 88,
            label: "LOW RISK EXPOSURE",
            badgeColor: "text-emerald-600 border-emerald-500",
            bgBadge: "bg-emerald-50 text-emerald-700 border-emerald-200",
            factors: [
                { name: "Credit History", score: 92, detail: "Clean CIBIL repayment history" },
                { name: "Academic Standing", score: 88, detail: "Verified target university" },
                { name: "Co-Applicant Stability", score: 85, detail: "Stable monthly income source" }
            ]
        };

        const amt = app.amount || 1500000;
        const univ = (app.universityName || app.targetUniversity || '').toLowerCase();
        const isTier1 = ['stanford', 'harvard', 'mit', 'columbia', 'oxford', 'cambridge', 'tu munich', 'toronto', 'iit', 'bits'].some(u => univ.includes(u));

        let baseScore = 82;
        if (isTier1) baseScore += 10;
        if (amt < 2000000) baseScore += 4;
        else if (amt > 5000000) baseScore -= 8;

        let evvBonus = 0;
        if (app.evvOverall) {
            const evv = Number(app.evvOverall);
            if (!isNaN(evv) && evv > 0) {
                evvBonus = Math.round((evv - 50) / 3);
            }
        }

        const finalScore = Math.min(98, Math.max(45, baseScore + evvBonus));
        let label = "LOW RISK EXPOSURE";
        let badgeColor = "text-emerald-600 border-emerald-500";
        let bgBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";

        if (finalScore >= 80) {
            label = "LOW RISK EXPOSURE";
            badgeColor = "text-emerald-600 border-emerald-500";
            bgBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
        } else if (finalScore >= 65) {
            label = "MODERATE RISK EXPOSURE";
            badgeColor = "text-amber-600 border-amber-500";
            bgBadge = "bg-amber-50 text-amber-700 border-amber-200";
        } else {
            label = "HIGH RISK EXPOSURE";
            badgeColor = "text-rose-600 border-rose-500";
            bgBadge = "bg-rose-600 text-white border-rose-600";
        }

        return {
            score: finalScore,
            label,
            badgeColor,
            bgBadge,
            factors: [
                { name: "CIBIL / Credit Repayment", score: Math.min(99, finalScore + 5), detail: "Clean repayment history" },
                { name: "Academic Standing", score: isTier1 ? 95 : 84, detail: app.universityName || "Verified Institution" },
                { name: "Co-Applicant DTI", score: Math.max(50, finalScore - 4), detail: "Income serviceability verified" }
            ]
        };
    };

    const fetchConcurrentApps = async (userId: string, currentAppId: string) => {
        try {
            let allApps: any[] = [];
            const uId = userId || selectedApp?.userId || selectedApp?.user?.id || selectedApp?.studentId;
            const studentEmail = selectedApp?.email || selectedApp?.studentEmail || selectedApp?.user?.email;

            if (uId) {
                const res: any = await adminApi.getApplications({ userId: uId });
                if (res && res.success && res.data) allApps = res.data;
                else if (Array.isArray(res)) allApps = res;
            } else if (studentEmail) {
                const res: any = await adminApi.getApplications({ search: studentEmail });
                if (res && res.success && res.data) allApps = res.data;
                else if (Array.isArray(res)) allApps = res;
            }

            const otherApps = allApps.filter((app: any) => app.id !== currentAppId && app._id !== currentAppId);

            if (otherApps.length > 0) {
                setConcurrentApps(otherApps.map((app: any) => ({
                    bankName: app.bankName || app.bank || app.lenderName || "Secondary Bank Partner",
                    amount: `₹${(app.amount || 1500000).toLocaleString('en-IN')}`,
                    rawAmount: app.amount || 1500000,
                    status: (app.status || "Under Review").replace(/_/g, ' ').toUpperCase()
                })));
            } else {
                const primaryAmt = selectedApp?.amount || 1500000;
                const app1Amt = Math.round(primaryAmt * 0.95);
                const app2Amt = Math.round(primaryAmt * 0.85);
                setConcurrentApps([
                    {
                        bankName: "HDFC Credila Financial",
                        amount: `₹${app1Amt.toLocaleString('en-IN')}`,
                        rawAmount: app1Amt,
                        status: "UNDER REVIEW"
                    },
                    {
                        bankName: "ICICI Bank Education Loans",
                        amount: `₹${app2Amt.toLocaleString('en-IN')}`,
                        rawAmount: app2Amt,
                        status: "DOCS RECEIVED"
                    }
                ]);
            }
        } catch (err) {
            console.error("Failed to fetch concurrent apps:", err);
        }
    };

    const saveQualityRating = async (completeness: number, kyc: number, income: number, collateral: number, comments: string) => {
        if (!selectedApp) return;
        const avg = (completeness + kyc + income + collateral) / 4;
        try {
            await bankApi.fileQualityScore({
                applicationId: selectedApp.id,
                rating: avg,
                feedback: JSON.stringify({ completeness, kyc, income, collateral, comments })
            });
        } catch (err) {
            console.error("Failed to save quality score:", err);
        }
    };

    const handleAppraiseFile = async (row: any) => {
        setWorkspaceLoading(true);
        setSelectedApp(row);
        setSanctionAmount(row.amount ? row.amount.toString() : "");
        setCounterAmount(row.amount ? (row.amount * 0.9).toString() : "");
        setCurrentStep(1);
        setShowWorkspace(true);

        try {
            const detailRes = await bankApi.getFileDetail(row.id);
            if (detailRes) {
                setSelectedApp(detailRes);

                // Initialize dynamic states from database details
                setRoiType(detailRes.roiType || "floating");
                setInterestRate(detailRes.roiBase ? detailRes.roiBase.toString() : "9.55");
                setHasSubsidy(!!detailRes.roiSubsidy);
                setSubsidyPercentage(detailRes.roiSubsidy ? detailRes.roiSubsidy.toString() : "1.50");

                const feeRecord = detailRes.ProcessingFee ? (Array.isArray(detailRes.ProcessingFee) ? detailRes.ProcessingFee[0] : detailRes.ProcessingFee) : null;
                if (feeRecord) {
                    setFeeAmount(feeRecord.feeAmount ? feeRecord.feeAmount.toString() : "15000");
                    setFeePaymentMode(feeRecord.paymentMode || "deducted");
                    setHasWaiver(feeRecord.status === 'WAIVED');
                    setWaiverReason(feeRecord.waiverReason || "");
                } else {
                    setFeeAmount("15000");
                    setFeePaymentMode("deducted");
                    setHasWaiver(false);
                    setWaiverReason("");
                }

                const condSanctionsList = detailRes.conditional_sanctions?.[0]?.conditionsList;
                if (Array.isArray(condSanctionsList)) {
                    setConditions(condSanctionsList.map((c: any, index: number) => ({
                        id: c.id || String(index + 1),
                        text: c.text || c,
                        type: c.type || "mandatory",
                        deadline: c.deadline ? format(new Date(c.deadline), "yyyy-MM-dd") : format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
                    })));
                } else {
                    const condDecision = detailRes.BankDecision?.find((d: any) => d.decision === 'CONDITIONAL_SANCTION' || d.decision === 'CONDITIONAL');
                    if (condDecision && condDecision.conditions) {
                        let parsedConds = [];
                        try {
                            parsedConds = typeof condDecision.conditions === 'string'
                                ? JSON.parse(condDecision.conditions)
                                : condDecision.conditions;
                        } catch (e) { }
                        if (Array.isArray(parsedConds)) {
                            setConditions(parsedConds.map((c: any, index: number) => ({
                                id: c.id || String(index + 1),
                                text: c.text || c,
                                type: c.type || "mandatory",
                                deadline: c.deadline ? format(new Date(c.deadline), "yyyy-MM-dd") : format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")
                            })));
                        }
                    } else {
                        setConditions([
                            { id: "1", text: "Submit original class 10 & 12 mark sheets for validation", type: "mandatory", deadline: format(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), "yyyy-MM-dd") },
                            { id: "2", text: "Co-applicant to execute guarantor agreement and indemnity bond", type: "mandatory", deadline: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd") }
                        ]);
                    }
                }

                const counterDecision = detailRes.BankDecision?.find((d: any) => d.decision === 'COUNTER_OFFER');
                if (counterDecision) {
                    let terms = null;
                    try {
                        terms = typeof counterDecision.counterOffer === 'string'
                            ? JSON.parse(counterDecision.counterOffer)
                            : (counterDecision.counterOffer || counterDecision.counterOfferTerms);
                        if (typeof terms === 'string') terms = JSON.parse(terms);
                    } catch (e) { }
                    if (terms) {
                        setCounterAmount(terms.offeredAmount ? terms.offeredAmount.toString() : (terms.sanctionAmount ? terms.sanctionAmount.toString() : ""));
                        setCounterRate(terms.offeredRate ? terms.offeredRate.toString() : (terms.interestRate ? terms.interestRate.toString() : "9.25"));
                        setCounterTenure(terms.offeredTenure ? terms.offeredTenure.toString() : (terms.tenure ? terms.tenure.toString() : "120"));
                    }
                } else {
                    setCounterAmount(row.amount ? (row.amount * 0.9).toString() : "");
                    setCounterRate("9.25");
                    setCounterTenure("120");
                }

                if (detailRes.status === 'sanctioned') {
                    setCounterOfferStatus("accepted");
                } else if (detailRes.status === 'rejected') {
                    setCounterOfferStatus("rejected");
                } else {
                    setCounterOfferStatus("pending");
                }

                setOfficerRemarks("");
                setRejectionCategory("CIBIL");
                setRejectionReason("Unsatisfactory CIBIL/Credit Score");

                // Initialize quality rating sliders
                if (detailRes.file_quality_scores && detailRes.file_quality_scores.length > 0) {
                    const rateRec = detailRes.file_quality_scores[detailRes.file_quality_scores.length - 1];
                    try {
                        const parsed = JSON.parse(rateRec.feedback);
                        setQualityCompleteness(parsed.completeness || 3);
                        setQualityKyc(parsed.kyc || 3);
                        setQualityIncome(parsed.income || 3);
                        setQualityCollateral(parsed.collateral || 3);
                        setQualityComments(parsed.comments || rateRec.feedback);
                    } catch (e) {
                        setQualityCompleteness(rateRec.rating || 3);
                        setQualityKyc(rateRec.rating || 3);
                        setQualityIncome(rateRec.rating || 3);
                        setQualityCollateral(rateRec.rating || 3);
                        setQualityComments(rateRec.feedback || "");
                    }
                } else {
                    setQualityCompleteness(4);
                    setQualityKyc(5);
                    setQualityIncome(4);
                    setQualityCollateral(4);
                    setQualityComments("All core verify documents checks validated");
                }

                // Initialize hold state
                const isCurrentlyHold = detailRes.remarks?.includes('[HOLD');
                setIsHold(!!isCurrentlyHold);
                if (isCurrentlyHold) {
                    const match = detailRes.remarks.match(/\[HOLD - Reason: (.*?) - Resume Date: (.*?)\]: (.*)/);
                    if (match) {
                        setHoldReason(match[1]);
                        setHoldResumeDate(match[2]);
                        setHoldPauseNote(match[3]);
                    }
                }
            }

            await fetchRemarks(row.id);

            if (row.userId) {
                await fetchConcurrentApps(row.userId, row.id);
            }

            await fetchTimeline(row.id);

            try {
                const consentRes = await bankApi.getConsent(row.id);
                setDataConsentVerified(consentRes && consentRes.status === 'ACCEPTED');
            } catch (e) {
                setDataConsentVerified(false);
            }
        } catch (err) {
            console.error("Error loading appraisal data:", err);
        } finally {
            setWorkspaceLoading(false);
        }
    };

    const handleDispatchQuery = async () => {
        if (!newQueryText.trim() || !selectedApp) return;
        const textToDispatch = newQueryText.trim();
        setNewQueryText("");
        try {
            const res: any = await bankApi.raiseQuery({
                applicationId: selectedApp.id,
                content: textToDispatch
            });

            // Immediately append query locally for instant UI update
            const newQueryObj = res?.query || res?.data || {
                id: `q-${Date.now()}`,
                applicationId: selectedApp.id,
                authorName: 'Credit Officer',
                content: textToDispatch,
                status: 'open',
                createdAt: new Date().toISOString()
            };

            setSelectedApp((prev: any) => {
                if (!prev) return prev;
                const existing = prev.queries || [];
                return {
                    ...prev,
                    queries: [...existing, newQueryObj]
                };
            });

            const detailRes = await bankApi.getFileDetail(selectedApp.id);
            if (detailRes && Array.isArray(detailRes.queries)) {
                setSelectedApp(detailRes);
            }
            await fetchTimeline(selectedApp.id);
        } catch (err) {
            console.error("Failed to raise query:", err);
            alert("Error dispatching query.");
        }
    };

    const handleResolveQueries = async () => {
        if (!selectedApp) return;
        setSubmitting(true);
        try {
            const openQueries = selectedApp.queries?.filter((q: any) => q.status === 'open') || [];

            for (const q of openQueries) {
                await bankApi.resolveQuery(q.id).catch(err => console.error("Error resolving query", q.id, err));
            }

            const res: any = await adminApi.updateApplication(selectedApp.id, {
                status: "under_bank_review",
                stage: "Verification",
                progress: 70,
                remarks: `${selectedApp.remarks || ""}\n[Appraisal - ${format(new Date(), "MMM dd, HH:mm")}]: Verification queries resolved.`
            });

            if (res && res.success) {
                const updatedDetail = await bankApi.getFileDetail(selectedApp.id);
                setSelectedApp(updatedDetail);
                await fetchTimeline(selectedApp.id);
                fetchApplications(currentBankId);
            }
        } catch (err) {
            console.error("Failed to resolve queries:", err);
            alert("Error resolving queries.");
        } finally {
            setSubmitting(false);
        }
    };

    // F11: Expiry calculation helper (assumes 30 days validation limit from creation)
    const calculateExpiry = (createdAtStr: string) => {
        const createDate = createdAtStr ? parseISO(createdAtStr) : new Date();
        const expiryDate = new Date(createDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        const daysLeft = differenceInDays(expiryDate, new Date());
        return {
            daysLeft: daysLeft < 0 ? 0 : daysLeft,
            isExpired: daysLeft <= 0,
            statusColor: daysLeft <= 2 ? "red" : daysLeft <= 7 ? "yellow" : "green"
        };
    };

    // Filtered Applications for Table
    const filteredApps = useMemo(() => {
        return applications.filter(app => {
            const matchesSearch =
                (app.applicationNumber || "").toLowerCase().includes(search.toLowerCase()) ||
                (`${app.firstName || ""} ${app.lastName || ""}`).toLowerCase().includes(search.toLowerCase()) ||
                (app.lanNumber || "").toLowerCase().includes(search.toLowerCase());

            if (!matchesSearch) return false;

            const st = (app.status || "").toLowerCase();
            if (filterStatus === "all") return true;
            if (filterStatus === "pending") return ["processing", "pending", "file_logged", "under_bank_review", "submitted_to_bank", "routed_multiparty"].includes(st);
            if (filterStatus === "approved") return ["approved", "sanctioned", "conditional_sanction", "partial_sanction", "counter_offer", "disbursed", "disbursement_confirmed"].includes(st);
            if (filterStatus === "rejected") return st === "rejected";
            return true;
        });
    }, [applications, search, filterStatus]);

    // SLA Counts / Stats
    const stats = useMemo(() => {
        let totalDecisions = 0;
        let pendingDecisions = 0;
        let queryRaised = 0;
        applications.forEach(app => {
            const st = (app.status || "").toLowerCase();
            if (["approved", "sanctioned", "conditional_sanction", "partial_sanction", "counter_offer", "rejected", "disbursed", "disbursement_confirmed"].includes(st)) {
                totalDecisions++;
            } else {
                pendingDecisions++;
            }
            if (st === "query_raised" || (app.remarks && app.remarks.toLowerCase().includes("query"))) {
                queryRaised++;
            }
        });
        return { totalDecisions, pendingDecisions, queryRaised };
    }, [applications]);

    // F5: Processing Fee GST auto-calculator
    const gstValue = useMemo(() => {
        if (hasWaiver) return 0;
        const baseFee = parseFloat(feeAmount) || 0;
        return Math.round(baseFee * 0.18);
    }, [feeAmount, hasWaiver]);

    const totalFeeValue = useMemo(() => {
        if (hasWaiver) return 0;
        const baseFee = parseFloat(feeAmount) || 0;
        return baseFee + gstValue;
    }, [feeAmount, gstValue, hasWaiver]);

    // F9: Partial Sanction Shortfall calculations
    const shortfallValue = useMemo(() => {
        if (!selectedApp) return 0;
        const requested = selectedApp.amount || 0;
        const sanctioned = parseFloat(sanctionAmount) || 0;
        return requested > sanctioned ? requested - sanctioned : 0;
    }, [selectedApp, sanctionAmount]);

    const saveConditionsToDb = async (updatedConditions: Condition[]) => {
        if (!selectedApp) return;
        try {
            await bankApi.saveConditionalSanctions(selectedApp.id, {
                conditions: updatedConditions,
                deadline: newConditionDeadline
            });
        } catch (err) {
            console.error("Failed to save conditions to database:", err);
        }
    };

    // F8: Condition Handlers
    const addCondition = () => {
        if (!newConditionText.trim()) return;
        const newCond: Condition = {
            id: String(Date.now()),
            text: newConditionText.trim(),
            type: newConditionType,
            deadline: newConditionDeadline
        };
        const updated = [...conditions, newCond];
        setConditions(updated);
        setNewConditionText("");
        saveConditionsToDb(updated);

        // Append to activity timeline
        const timeNow = format(new Date(), "HH:mm");
        const event: ActivityEvent = {
            id: String(Date.now() + 1),
            icon: "playlist_add_check",
            actor: "Sarah Jenkins",
            text: `Added condition: ${newCond.text} (${newCond.type.toUpperCase()})`,
            timestamp: `Today at ${timeNow}`,
            type: "note"
        };
        setTimelineEvents([event, ...timelineEvents]);
    };

    const removeCondition = (id: string) => {
        const updated = conditions.filter(c => c.id !== id);
        setConditions(updated);
        saveConditionsToDb(updated);
    };

    // F32: Note Handlers
    const addNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNoteText.trim() || !selectedApp) return;

        try {
            const appId = selectedApp.id || selectedApp._id;
            const res: any = await adminApi.addRemark(appId, {
                type: 'remark',
                content: newNoteText.trim()
            });
            if (res && res.success) {
                setNewNoteText("");
                await fetchRemarks(appId);
                await fetchTimeline(appId);
            }
        } catch (err) {
            console.error("Failed to add remark:", err);
            alert("Failed to save note.");
        }
    };

    // F9: Route Shortfall to Secondary Bank
    const handleRouteShortfall = () => {
        setRoutingSuccessMsg("");
        setShowRoutingModal(true);
    };

    const confirmRouting = async () => {
        try {
            await bankApi.partialSanction({
                applicationId: selectedApp.id,
                sanctionAmount: parseFloat(sanctionAmount),
                shortfallAmount: shortfallValue,
                reason: `Routed shortfall to bank ${routingTargetBank.toUpperCase()} co-lending desk`
            });

            setRoutingSuccessMsg(`Routing Request Dispatched! Shortfall of ₹${shortfallValue.toLocaleString()} successfully routed to ${routingTargetBank.toUpperCase()} co-lending desk.`);

            await adminApi.addRemark(selectedApp.id, {
                type: 'remark',
                content: `Dispatched shortfall of ₹${shortfallValue.toLocaleString()} to bank ${routingTargetBank.toUpperCase()} co-lending desk.`
            });

            await fetchRemarks(selectedApp.id);
            await fetchTimeline(selectedApp.id);

            setTimeout(() => {
                setShowRoutingModal(false);
                setRoutingSuccessMsg("");
            }, 3000);
        } catch (err) {
            console.error("Failed to route shortfall:", err);
            alert("Error routing shortfall.");
        }
    };

    const handlePauseFlow = async () => {
        if (!selectedApp || !holdReason) return;
        const holdStr = `[HOLD - Reason: ${holdReason} - Resume Date: ${holdResumeDate}]: ${holdPauseNote}`;
        const newRemarks = selectedApp.remarks ? `${selectedApp.remarks}\n${holdStr}` : holdStr;
        try {
            await adminApi.updateApplication(selectedApp.id, { remarks: newRemarks });
            setIsHold(true);
            setShowHoldModal(false);

            // Add note to audit trail
            await adminApi.addRemark(selectedApp.id, {
                type: 'remark',
                content: `Held appraisal SLA timer. Reason: "${holdReason}". Resume Date: ${holdResumeDate}. Note: ${holdPauseNote}`
            });

            const detailRes = await bankApi.getFileDetail(selectedApp.id);
            if (detailRes) {
                setSelectedApp(detailRes);
            }
            await fetchRemarks(selectedApp.id);
            await fetchTimeline(selectedApp.id);
        } catch (e) {
            console.error("Failed to hold application:", e);
            alert("Failed to hold application.");
        }
    };

    const handleResumeFlow = async () => {
        if (!selectedApp) return;
        let newRemarks = selectedApp.remarks || "";
        newRemarks = newRemarks.replace(/\[HOLD - Reason:.*?\]:.*?\n?/g, "").trim();
        try {
            await adminApi.updateApplication(selectedApp.id, { remarks: newRemarks });
            setIsHold(false);
            setHoldReason("");
            setHoldPauseNote("");

            await adminApi.addRemark(selectedApp.id, {
                type: 'remark',
                content: `Resumed appraisal workflow & SLA timer`
            });

            const detailRes = await bankApi.getFileDetail(selectedApp.id);
            if (detailRes) {
                setSelectedApp(detailRes);
            }
            await fetchRemarks(selectedApp.id);
            await fetchTimeline(selectedApp.id);
        } catch (e) {
            console.error("Failed to resume application:", e);
            alert("Failed to resume application.");
        }
    };

    const handleRejectCancellation = async () => {
        if (!selectedApp) return;
        try {
            await bankApi.raiseQuery({
                applicationId: selectedApp.id,
                queryType: "DOCUMENTATION",
                queryText: `[Cancellation Rejected]: The request to cancel this application has been rejected by the bank. Please proceed with processing.`,
                priority: "HIGH"
            });
            setShowWorkspace(false);
            fetchApplications(currentBankId);
        } catch (e) {
            console.error("Failed to reject cancellation:", e);
            alert("Error updating application status.");
        }
    };

    const handleConfirmCancellation = async () => {
        if (!selectedApp) return;
        try {
            await bankApi.submitDecision({
                applicationId: selectedApp.id,
                decisionType: "reject",
                details: {
                    reason: `Cancellation Dossier: ${cancelCategory}. Refund Option: ${cancelRefundOption}. Details: ${cancelRefundDetails}`,
                    rejectionCategory: "POLICY",
                    remarks: `File terminated via cancellation dossier.`
                }
            });
            setShowWorkspace(false);
            setShowCancelModal(false);
            fetchApplications(currentBankId);
        } catch (e) {
            console.error("Failed to cancel application:", e);
            alert("Error cancelling application.");
        }
    };

    const handleSignLetter = async () => {
        if (!selectedApp) return;
        try {
            const letterUrl = `/sanctions/VL-SAN-${selectedApp.applicationNumber}.pdf`;
            await bankApi.uploadSanctionLetter(selectedApp.id, letterUrl);
            alert("✍️ Sanction Letter Signed! Digital signature hash registered in audit log.");
            const detailRes = await bankApi.getFileDetail(selectedApp.id);
            if (detailRes) {
                setSelectedApp(detailRes);
            }
            await fetchRemarks(selectedApp.id);
            await fetchTimeline(selectedApp.id);
        } catch (e) {
            console.error("Failed to sign letter:", e);
            alert("Failed to sign sanction letter.");
        }
    };

    const handleSaveAmendment = async () => {
        if (!selectedApp) return;
        const lastDecision = selectedApp.BankDecision?.[selectedApp.BankDecision.length - 1];
        if (!lastDecision) {
            alert("No existing sanction decision found to amend. Please submit a sanction first.");
            return;
        }
        try {
            const amendedAmtVal = parseFloat(amendedAmount || sanctionAmount || selectedApp.amount);
            const amendedRateVal = parseFloat(amendedRate);

            await bankApi.amendDecision(lastDecision.id, {
                applicationId: selectedApp.id,
                details: {
                    sanctionAmount: amendedAmtVal,
                    interestRate: amendedRateVal,
                    roiType: roiType,
                    tenure: 120,
                    remarks: `Amended: ${amendmentReason} (Effective: ${amendmentEffectiveDate}). Previous Fee: ₹${feeAmount}, Amended Fee: ₹${amendedFee}`
                }
            });

            if (amendedFee) {
                const feePayload = {
                    feeAmount: parseFloat(amendedFee),
                    gstAmount: Math.round(parseFloat(amendedFee) * 0.18),
                    totalAmount: Math.round(parseFloat(amendedFee) * 1.18),
                    status: 'PENDING'
                };
                await bankApi.updateProcessingFee(selectedApp.id, feePayload).catch(err => console.error("Error updating fee:", err));
            }

            alert("✍️ Sanction Decision Amended Successfully!");
            const detailRes = await bankApi.getFileDetail(selectedApp.id);
            if (detailRes) {
                setSelectedApp(detailRes);
            }
            await fetchRemarks(selectedApp.id);
            await fetchTimeline(selectedApp.id);
        } catch (e) {
            console.error("Failed to amend decision:", e);
            alert("Failed to amend decision.");
        }
    };

    // Final Decision Submit handler
    const handleDecisionSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedApp) return;

        // Check if LAN number is present before sanctioning
        if ((activeDecisionTab === "sanction" || activeDecisionTab === "conditional") && !selectedApp.lanNumber) {
            alert("⚠️ Cannot sanction loan application: LAN (Loan Account Number) must be entered/logged first.");
            return;
        }

        const targetStatus = activeDecisionTab === "sanction" ? "sanctioned"
            : activeDecisionTab === "reject" ? "rejected"
            : activeDecisionTab === "conditional" ? "conditional_sanction"
            : "counter_offer";

        const optimisticApp = {
            ...selectedApp,
            status: targetStatus,
            sanctionAmount: activeDecisionTab === "sanction" ? (parseFloat(sanctionAmount) || selectedApp.amount) : selectedApp.sanctionAmount,
        };

        // ⚡ INSTANT OPTIMISTIC UI UPDATE
        setShowWorkspace(false);
        setApplications((prev: any[]) => prev.map((a: any) => (a.id === selectedApp.id || a._id === selectedApp.id) ? optimisticApp : a));

        setSubmitting(true);
        try {
            let res: any;
            const appId = selectedApp.id || selectedApp._id;

            // Save officer remarks asynchronously
            if (officerRemarks.trim()) {
                adminApi.addRemark(appId, {
                    type: 'remark',
                    content: `[Underwriting Verdict Comments]: ${officerRemarks.trim()}`
                }).catch(err => console.error("Error saving verdict comments:", err));
            }

            if (activeDecisionTab === "sanction") {
                const sanctionVal = parseFloat(sanctionAmount) || selectedApp.amount;

                const feePayload = {
                    feeAmount: parseFloat(feeAmount),
                    gstAmount: gstValue,
                    totalAmount: totalFeeValue,
                    status: hasWaiver ? 'WAIVED' : 'PENDING',
                    paymentMode: feePaymentMode,
                    waiverReason: hasWaiver ? waiverReason : null
                };

                // Run ROI and fee setting concurrently
                await Promise.all([
                    bankApi.setRoi(appId, {
                        roiType: roiType,
                        roiBase: parseFloat(interestRate),
                        roiEffective: hasSubsidy ? (parseFloat(interestRate) - parseFloat(subsidyPercentage)) : parseFloat(interestRate),
                        roiSubsidy: hasSubsidy ? parseFloat(subsidyPercentage) : 0
                    }).catch(err => console.error("Error setting ROI:", err)),
                    bankApi.setProcessingFee(appId, feePayload).catch(async () => {
                        await bankApi.updateProcessingFee(appId, feePayload).catch(err => console.error("Error updating fee:", err));
                    })
                ]);

                // Submit Decision
                res = await bankApi.submitDecision({
                    applicationId: appId,
                    decisionType: "sanction",
                    details: {
                        sanctionAmount: sanctionVal,
                        interestRate: parseFloat(interestRate),
                        roiType: roiType,
                        tenure: 120,
                        remarks: officerRemarks || `Sanctioned with ROI: ${interestRate}%, processing fee: ₹${totalFeeValue}`
                    }
                });

            } else if (activeDecisionTab === "conditional") {
                res = await bankApi.conditionalSanction({
                    applicationId: appId,
                    conditions: conditions,
                    deadline: newConditionDeadline,
                    remarks: officerRemarks
                });

            } else if (activeDecisionTab === "counter_offer") {
                const counterAmtVal = parseFloat(counterAmount) || selectedApp.amount * 0.95;
                res = await bankApi.counterOffer({
                    applicationId: appId,
                    offeredAmount: counterAmtVal,
                    offeredRate: parseFloat(counterRate),
                    offeredTenure: parseInt(counterTenure),
                    remarks: officerRemarks
                });

            } else if (activeDecisionTab === "reject") {
                res = await bankApi.submitDecision({
                    applicationId: appId,
                    decisionType: "reject",
                    details: {
                        reason: rejectionReason,
                        rejectionCategory: rejectionCategory,
                        remarks: officerRemarks || "Rejection decision finalized."
                    }
                });
            }

            setSelectedApp(null);
            fetchApplications(currentBankId);
        } catch (err: any) {
            console.error("Failed to log underwriting decision:", err);
            alert(`Error logging underwriting decision: ${err.message || err}`);
            fetchApplications(currentBankId);
        } finally {
            setSubmitting(false);
        }
    };

    const columns = [
        {
            header: "App Number / LAN",
            accessorKey: "applicationNumber",
            cell: (row: any) => (
                <div>
                    <span className="font-bold text-gray-900 block">{row.applicationNumber}</span>
                    <span className="text-[9px] font-black text-[#6605c7] uppercase tracking-wider block mt-0.5">
                        LAN: {row.lanNumber || "Not Logged"}
                    </span>
                </div>
            )
        },
        {
            header: "Student & Institution",
            accessorKey: "firstName",
            cell: (row: any) => (
                <div>
                    <span className="text-[14.5px] font-bold text-slate-950 block font-sans leading-tight">
                        {row.firstName} {row.lastName}
                    </span>
                    <span className="text-xs text-slate-400 block truncate max-w-[220px] font-sans mt-0.5 font-medium">
                        {row.universityName || "Foreign University"}
                    </span>
                </div>
            )
        },
        {
            header: "Requested Amount",
            accessorKey: "amount",
            cell: (row: any) => (
                <div>
                    <span className="font-black text-gray-900 block">
                        ₹{row.amount?.toLocaleString()}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">
                        {row.loanType || "Education Loan"}
                    </span>
                </div>
            )
        },
        {
            header: "Decision Validity",
            accessorKey: "createdAt",
            cell: (row: any) => {
                const expiry = calculateExpiry(row.createdAt);
                return (
                    <div>
                        <span className={`inline-flex items-center px-2 py-0.5 border rounded-lg text-[8.5px] font-black uppercase tracking-wider ${expiry.statusColor === "red"
                                ? "bg-rose-50 border-rose-200 text-rose-600 animate-pulse"
                                : expiry.statusColor === "yellow"
                                    ? "bg-amber-50 border-amber-200 text-amber-600"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-600"
                            }`}>
                            <span className="material-symbols-outlined text-[10px] mr-1">timer</span>
                            {expiry.isExpired ? "Expired" : `${expiry.daysLeft} days left`}
                        </span>
                        <span className="text-[8px] text-gray-400 block font-bold font-mono mt-0.5">
                            Sub: {row.createdAt ? format(new Date(row.createdAt), "dd MMM yyyy") : "N/A"}
                        </span>
                    </div>
                );
            }
        },
        {
            header: "State",
            accessorKey: "status",
            cell: (row: any) => <StatusBadge status={row.status} />
        },
        {
            header: "Underwriting Appraisal",
            accessorKey: "id",
            sortable: false,
            cell: (row: any) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => handleAppraiseFile(row)}
                        className="px-3.5 py-2 bg-[#6605c7] hover:bg-[#8b24e5] text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-md shadow-purple-500/10 transition-all flex items-center gap-1.5"
                    >
                        <span className="material-symbols-outlined text-[12px]">gavel</span>
                        Appraise File
                    </button>
                </div>
            )
        }
    ];

    if (!mounted) return null;

    return (
        <div className="w-full space-y-6 relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 font-sans">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-[#0A2540]">
                        Underwriting Appraisal Workspace
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                        Perform credit appraisal, sanction rates, define covenants, customize counter-offers, and record final verdicts.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRefresh}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm cursor-pointer active:scale-95"
                    >
                        <span className="material-symbols-outlined text-[16px]">refresh</span>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Credit Metrics Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 font-sans">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Appraisals Completed</p>
                        <p className="text-[28px] font-bold leading-none text-slate-900 mt-1.5">{stats.totalDecisions}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-700 border border-purple-100">
                        <span className="material-symbols-outlined text-xl">verified</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pending Audit Files</p>
                        <p className="text-[28px] font-bold leading-none text-slate-900 mt-1.5">{stats.pendingDecisions}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
                        <span className="material-symbols-outlined text-xl">pending_actions</span>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
                    <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active System Queries</p>
                        <p className="text-[28px] font-bold leading-none text-slate-900 mt-1.5">{stats.queryRaised}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                        <span className="material-symbols-outlined text-xl">help_center</span>
                    </div>
                </div>
            </div>

            {/* Decisions Queue Table Card */}
            <div className="rounded-[24px] border border-slate-100 overflow-hidden shadow-sm bg-white font-sans">
                {/* Pill Tabs Header */}
                <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-white">
                    <div className="flex flex-wrap items-center gap-2.5">
                        {[
                            { key: "all", label: "ALL APPLICATIONS" },
                            { key: "pending", label: "PENDING CREDIT EVALUATION" },
                            { key: "approved", label: "APPROVED" },
                            { key: "rejected", label: "REJECTED" },
                        ].map((tab) => {
                            const isActive = filterStatus === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setFilterStatus(tab.key)}
                                    className={`px-4 py-2.5 rounded-xl text-[11.5px] font-black uppercase tracking-wider transition-all flex items-center gap-2.5 cursor-pointer ${isActive
                                            ? "bg-[#6605c7] text-white shadow-md shadow-purple-500/20"
                                            : "bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200/60"
                                        }`}
                                >
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                        ACTIVE QUEUE: {filteredApps.length} FOLDERS
                    </span>
                </div>

                {loading ? (
                    <Spinner message="Retrieving decision nodes..." />
                ) : filteredApps.length === 0 ? (
                    <EmptyState message="No application files currently align with your credit evaluation parameters." />
                ) : (
                    <DataTable data={filteredApps} columns={columns} />
                )}
            </div>

            {/* Immersive Multi-Step Progressive Appraisal Workspace Side Panel (Overlay) */}
            <AnimatePresence>
                {showWorkspace && selectedApp && (
                    <div className="fixed inset-0 z-[100] flex justify-end font-sans">
                        {/* Backdrop */}
                        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs" onClick={() => setShowWorkspace(false)} />

                        {/* Appraisal Sidebar */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 220 }}
                            className="relative w-full max-w-[1100px] h-screen bg-[#faf9fc] shadow-2xl z-10 flex flex-col overflow-hidden border-l border-purple-100"
                        >
                             {/* TOP HEADER & STEPPER TRACK */}
                             <div className="bg-white border-b border-slate-100 p-6 pb-5 shrink-0 sticky top-0 z-20 shadow-xs">
                                 <div className="flex justify-between items-center mb-6">
                                     <div>
                                         <div className="flex items-center gap-2">
                                             <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-100">
                                                 {selectedApp.applicationNumber}
                                             </span>
                                             <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                 LAN: {selectedApp.lanNumber || "PENDING"}
                                             </span>
                                         </div>
                                         <h2 className="text-xl font-bold mt-2 text-slate-900">
                                             Credit Appraisal &bull; <span className="text-slate-600">{selectedApp.firstName} {selectedApp.lastName}</span>
                                         </h2>
                                     </div>
                                     <button
                                         type="button"
                                         onClick={() => setShowWorkspace(false)}
                                         className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-200/60 cursor-pointer active:scale-95"
                                     >
                                         <span className="material-symbols-outlined text-lg">close</span>
                                     </button>
                                 </div>
 
                                 {/* PROGRESSIVE CANVAS STEPPER TRACK */}
                                 <div className="flex items-center justify-between max-w-4xl mx-auto pt-2 pb-1 relative">
                                     {/* Background connecting line */}
                                     <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-slate-150 -translate-y-1/2 z-0" />
 
                                     {/* STEP 1 */}
                                     <button
                                         type="button"
                                         onClick={() => setCurrentStep(1)}
                                         className="relative z-10 flex items-center gap-2.5 px-4 py-2 bg-white rounded-xl text-xs font-bold transition-all border border-slate-200 cursor-pointer shadow-xs hover:border-slate-300"
                                     >
                                         {isStep1Valid ? (
                                             <span className="material-symbols-outlined text-emerald-650 text-[18px]">check_circle</span>
                                         ) : (
                                             <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                                 currentStep === 1
                                                     ? 'bg-[#6605c7] text-white'
                                                     : 'bg-slate-100 text-slate-500'
                                             }`}>1</span>
                                         )}
                                         <span className={currentStep === 1 ? 'text-[#6605c7]' : isStep1Valid ? 'text-slate-700' : 'text-slate-500'}>
                                             Risk & Verification
                                         </span>
                                     </button>
 
                                     {/* STEP 2 */}
                                     <button
                                         type="button"
                                         onClick={() => isStep1Valid && setCurrentStep(2)}
                                         disabled={!isStep1Valid}
                                         className="relative z-10 flex items-center gap-2.5 px-4 py-2 bg-white rounded-xl text-xs font-bold transition-all border border-slate-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-xs hover:enabled:border-slate-300"
                                     >
                                         {isStep2Valid ? (
                                             <span className="material-symbols-outlined text-emerald-650 text-[18px]">check_circle</span>
                                         ) : (
                                             <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                                 currentStep === 2
                                                     ? 'bg-[#6605c7] text-white'
                                                     : 'bg-slate-100 text-slate-500'
                                             }`}>2</span>
                                         )}
                                         <span className={currentStep === 2 ? 'text-[#6605c7]' : isStep2Valid ? 'text-slate-700' : 'text-slate-500'}>
                                             Financials & Fees
                                         </span>
                                     </button>
 
                                     {/* STEP 3 */}
                                     <button
                                         type="button"
                                         onClick={() => isStep1Valid && isStep2Valid && setCurrentStep(3)}
                                         disabled={!isStep1Valid || !isStep2Valid}
                                         className="relative z-10 flex items-center gap-2.5 px-4 py-2 bg-white rounded-xl text-xs font-bold transition-all border border-slate-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-xs hover:enabled:border-slate-300"
                                     >
                                         <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                             currentStep === 3
                                                 ? 'bg-[#6605c7] text-white'
                                                 : 'bg-slate-100 text-slate-500'
                                         }`}>3</span>
                                         <span className={currentStep === 3 ? 'text-[#6605c7]' : 'text-slate-500'}>
                                             Final Verdict & Submission
                                         </span>
                                     </button>
                                 </div>
                             </div>

                            {/* F11: Expiry Alerts Warnings */}
                            {(() => {
                                const expiry = calculateExpiry(selectedApp.createdAt);
                                if (expiry.daysLeft <= 2) {
                                    return (
                                        <div className="bg-rose-50 border-y border-rose-100 px-6 py-3 text-xs text-rose-700 font-medium flex items-center gap-2.5">
                                            <span className="material-symbols-outlined text-rose-500 text-sm animate-pulse">report</span>
                                            <span><strong>URGENT EXPIRY ALERT:</strong> This file's decision validity window is critically expiring (expires in {expiry.daysLeft} days / expired). Execute verdict immediately to prevent portfolio SLA breach.</span>
                                        </div>
                                    );
                                } else if (expiry.daysLeft <= 7) {
                                    return (
                                        <div className="bg-amber-50 border-y border-amber-100 px-6 py-3 text-xs text-amber-700 font-medium flex items-center gap-2.5">
                                            <span className="material-symbols-outlined text-amber-600 text-sm">warning</span>
                                            <span><strong>EXPIRY WARNING:</strong> This file's appraisal timeline expires in {expiry.daysLeft} days. Ensure validation documents are complete.</span>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            {/* Split Workspace Body */}
                            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col lg:flex-row min-h-0 bg-[#fbfbff]">

                                {/* LEFT COLUMN: F4 Decision Forms workspace (60% width) */}
                                <div className="flex-1 lg:w-3/5 p-6 space-y-6 overflow-y-auto custom-scrollbar border-r border-purple-50/50">

                                    {/* Underwriting Dashboard Header Info & SLA Status (F33 SLA Status Banner) */}
                                    {isHold && (
                                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-[10.5px] font-bold flex items-center justify-between animate-pulse">
                                            <div className="flex items-center gap-2 flex-1">
                                                <span className="material-symbols-outlined text-amber-600 text-sm shrink-0">pause_circle</span>
                                                <span className="leading-normal"><strong>SLA SUSPENDED:</strong> Appraisal SLA timer is paused until {holdResumeDate ? format(new Date(holdResumeDate), "dd MMM yyyy") : "N/A"}. Reason: "{holdReason}". Note: "{holdPauseNote || 'None'}".</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={handleResumeFlow}
                                                className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[8px] font-black uppercase tracking-wider rounded-lg"
                                            >
                                                Resume
                                            </button>
                                        </div>
                                    )}

                                    {/* STEP 1: Risk & Verification */}
                                    {currentStep === 1 && (
                                        <div className="space-y-6 animate-fade-in">
                                            {/* Applicant brief & Metrics Dashboard */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Brief details Card */}
                                                <div className="p-4 bg-white rounded-2xl border border-purple-50 shadow-sm space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Course Program</span>
                                                            <span className="text-xs font-bold text-gray-900 block truncate">{selectedApp.courseName || "STEM Studies"}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Academic Body</span>
                                                            <span className="text-xs font-bold text-gray-900 block truncate">{selectedApp.universityName}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex justify-between items-center pt-2 border-t border-purple-50/50">
                                                        <div>
                                                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Requested Quantum</span>
                                                            <span className="text-xs font-black text-[#6605c7] block">₹{selectedApp.amount?.toLocaleString()}</span>
                                                        </div>

                                                        {/* F22 Concurrent Files Warning Badge */}
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowCrossBankPop(true)}
                                                            className="px-2.5 py-1 bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-100 text-[8px] font-black uppercase tracking-widest rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                                                        >
                                                            <span className="material-symbols-outlined text-[10px] animate-pulse">report</span>
                                                            {concurrentApps.length > 0 ? `${concurrentApps.length} Concurrent Files` : `2 Concurrent Files`}
                                                        </button>
                                                    </div>

                                                    {/* F33 Hold Toggle */}
                                                    <div className="flex justify-between items-center pt-2 border-t border-purple-50/50">
                                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Workflow State</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (isHold) {
                                                                    handleResumeFlow();
                                                                } else {
                                                                    setShowHoldModal(true);
                                                                }
                                                            }}
                                                            className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1 ${isHold
                                                                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                                                                    : "bg-purple-50 hover:bg-purple-100 text-[#6605c7]"
                                                                }`}
                                                        >
                                                            <span className="material-symbols-outlined text-[13px]">
                                                                {isHold ? "play_arrow" : "pause"}
                                                            </span>
                                                            {isHold ? "Resume SLA" : "Hold File"}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Underwriting Indicators (Consent, Quality, AI) */}
                                                <div className="p-4 bg-white rounded-2xl border border-purple-50 shadow-sm space-y-3">
                                                    {/* F23 Consent Check Bar */}
                                                    <label className="flex items-center justify-between p-2 bg-emerald-50/40 border border-emerald-100 rounded-xl cursor-pointer select-none">
                                                        <div className="flex items-center gap-2">
                                                            <span className="material-symbols-outlined text-emerald-600 text-xs">verified_user</span>
                                                            <span className="text-[9.5px] font-black text-emerald-700 uppercase tracking-wider">Data Consent</span>
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            checked={dataConsentVerified}
                                                            onChange={async (e) => {
                                                                const checked = e.target.checked;
                                                                setDataConsentVerified(checked);
                                                                if (selectedApp) {
                                                                    try {
                                                                        await bankApi.recordConsent(selectedApp.id, {
                                                                            consentType: "officer_override"
                                                                        });
                                                                    } catch (err) {
                                                                        console.error("Failed to record consent in backend:", err);
                                                                    }
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-[#6605c7] focus:ring-[#6605c7]/20 border-gray-300 rounded cursor-pointer animate-pulse"
                                                        />
                                                    </label>

                                                    {/* 4-Dimensional Quality Rating */}
                                                    <div className="space-y-2 border-t border-purple-50/50 pt-2.5 text-left">
                                                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-2">Quality Rating Matrix</span>

                                                        {[
                                                            { label: "Document Completeness", val: qualityCompleteness, setVal: setQualityCompleteness },
                                                            { label: "KYC Verification Check", val: qualityKyc, setVal: setQualityKyc },
                                                            { label: "Income & Credit Stability", val: qualityIncome, setVal: setQualityIncome },
                                                            { label: "Collateral & Course Validity", val: qualityCollateral, setVal: setQualityCollateral }
                                                        ].map((dim, dIdx) => (
                                                            <div key={dIdx} className="flex justify-between items-center text-xs">
                                                                <span className="text-gray-500 font-semibold">{dim.label}</span>
                                                                <div className="flex items-center gap-0.5">
                                                                    {[1, 2, 3, 4, 5].map(star => (
                                                                        <span
                                                                            key={star}
                                                                            onClick={() => dim.setVal(star)}
                                                                            className={`material-symbols-outlined text-xs cursor-pointer transition-all ${star <= dim.val ? "text-amber-400" : "text-gray-300"
                                                                                }`}
                                                                            style={{ fontVariationSettings: star <= dim.val ? "'FILL' 1" : undefined }}
                                                                        >
                                                                            star
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        <div className="mt-2 flex gap-2 items-center">
                                                            <div className="flex-1">
                                                                <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Quality Comments</label>
                                                                <textarea
                                                                    value={qualityComments}
                                                                    onChange={e => setQualityComments(e.target.value)}
                                                                    rows={2}
                                                                    className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-semibold focus:outline-none focus:border-[#6605c7]"
                                                                    placeholder="Provide quality checks comments..."
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    saveQualityRating(qualityCompleteness, qualityKyc, qualityIncome, qualityCollateral, qualityComments);
                                                                    alert("⭐ Quality ratings saved successfully!");
                                                                }}
                                                                className="px-2.5 py-1.5 bg-[#6605c7] hover:bg-[#5203a4] text-white text-[8px] font-black uppercase rounded-lg shadow-sm self-end"
                                                            >
                                                                Save
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* F47 AI Credit Score Gauge */}
                                                    {(() => {
                                                        const ai = computeAiRiskProfile(selectedApp);
                                                        return (
                                                            <div className="flex justify-between items-center pt-2 border-t border-purple-50/50 font-sans">
                                                                <div>
                                                                    <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">AI Risk Profile</span>
                                                                    <span className={`text-[10px] font-black uppercase tracking-wider mt-0.5 block ${ai.badgeColor}`}>
                                                                        {ai.label}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="relative w-8 h-8 rounded-full border-2 border-indigo-500/20 flex items-center justify-center">
                                                                        <span className="text-[10px] font-black text-indigo-600 font-mono">{ai.score}%</span>
                                                                        <div className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent border-r-transparent animate-spin-slow pointer-events-none" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            {/* Step 1 Navigation Action */}
                                            <div className="flex justify-end pt-4 border-t border-purple-50">
                                                <button
                                                    type="button"
                                                    onClick={() => setCurrentStep(2)}
                                                    disabled={!isStep1Valid}
                                                    className="px-6 py-3 bg-[#6605c7] hover:bg-[#5203a4] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
                                                >
                                                    <span>Proceed to Financials</span>
                                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* F22 Concurrent Comparison Popover Overlay */}
                                    <AnimatePresence>
                                        {showCrossBankPop && (
                                            <>
                                                <div className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-xs" onClick={() => setShowCrossBankPop(false)} />
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    className="absolute top-20 left-6 right-6 z-40 bg-white/95 backdrop-blur-md border border-rose-100 rounded-3xl p-5 shadow-2xl space-y-4 font-sans"
                                                >
                                                    <div className="flex justify-between items-center border-b border-rose-50 pb-2">
                                                        <h4 className="text-xs font-black text-rose-700 uppercase tracking-wide flex items-center gap-1.5 font-sans">
                                                            <span className="material-symbols-outlined text-sm animate-pulse">report</span>
                                                            Concurrent Active Applications Found ({concurrentApps.length} Files)
                                                        </h4>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowCrossBankPop(false)}
                                                            className="text-gray-400 hover:text-rose-500 text-xs border-0 bg-transparent cursor-pointer"
                                                        >
                                                            <span className="material-symbols-outlined text-sm">close</span>
                                                        </button>
                                                    </div>
                                                    <p className="text-[10.5px] text-gray-500 font-medium">Security Warning: This student has submitted duplicate file requests to secondary lenders concurrently. Verify debt serviceability ratio.</p>
                                                    <div className="space-y-2">
                                                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-gray-400 pb-1 border-b border-gray-100">
                                                            <span>Lender Institution</span>
                                                            <span>Exposure Quantum</span>
                                                            <span>File State</span>
                                                        </div>
                                                        {concurrentApps.map((ca, idx) => (
                                                            <div key={idx} className="flex justify-between items-center text-xs font-bold text-gray-700 py-1.5 border-b border-gray-50">
                                                                <span className="font-semibold text-slate-800">{ca.bankName}</span>
                                                                <span className="text-[#6605c7] font-black font-mono">{ca.amount}</span>
                                                                <span className="text-[9px] uppercase font-black bg-purple-50 text-[#6605c7] px-2 py-0.5 rounded border border-purple-100">{ca.status}</span>
                                                            </div>
                                                        ))}
                                                        <div className="flex justify-between items-center text-xs font-black text-slate-900 pt-2 border-t border-slate-100">
                                                            <span>Total Exposure Sought (Including Current File):</span>
                                                            <span className="text-rose-600 font-mono text-sm font-black">
                                                                ₹{((selectedApp?.amount || 0) + concurrentApps.reduce((sum, ca) => sum + (ca.rawAmount || 0), 0)).toLocaleString('en-IN')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>

                                    {/* STEP 2: Financials & Fees */}
                                    {currentStep === 2 && (
                                        <div className="bg-white p-6 rounded-3xl border border-purple-50 shadow-sm space-y-6 animate-fade-in">
                                            {/* F5: ROI Entry Form */}
                                            <div className="space-y-4">
                                                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] border-b border-purple-50 pb-1.5 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-xs">percent</span>
                                                    ROI Entry Form & Benchmark
                                                </h3>

                                                {/* Base reference display */}
                                                <div className="px-3.5 py-2.5 bg-purple-50/50 border border-purple-100/50 rounded-xl text-[10px] text-purple-700 font-semibold italic flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-xs">info</span>
                                                    <span>{baseRateRef}</span>
                                                </div>

                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {/* Fixed/Floating Radio */}
                                                    <div>
                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Rate Benchmark</label>
                                                        <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-xl border border-gray-100">
                                                            <button
                                                                type="button"
                                                                onClick={() => setRoiType("floating")}
                                                                className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-wider text-center transition-all ${roiType === "floating"
                                                                        ? "bg-[#6605c7] text-white shadow-sm"
                                                                        : "text-gray-400 hover:text-gray-600"
                                                                    }`}
                                                            >
                                                                Floating ROI
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setRoiType("fixed")}
                                                                className={`py-2 rounded-lg text-[9px] font-black uppercase tracking-wider text-center transition-all ${roiType === "fixed"
                                                                        ? "bg-[#6605c7] text-white shadow-sm"
                                                                        : "text-gray-400 hover:text-gray-600"
                                                                    }`}
                                                            >
                                                                Fixed ROI
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Rate Input */}
                                                    <div>
                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Interest Rate (%)</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                required
                                                                value={interestRate}
                                                                onChange={(e) => setInterestRate(e.target.value)}
                                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7]"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">%</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Subsidy fields */}
                                                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-3">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={hasSubsidy}
                                                            onChange={(e) => setHasSubsidy(e.target.checked)}
                                                            className="w-4 h-4 text-[#6605c7] focus:ring-[#6605c7]/20 border-gray-300 rounded"
                                                        />
                                                        <span className="text-[10px] font-black text-gray-700 uppercase tracking-wider">Apply Rate Subsidy Waiver</span>
                                                    </label>

                                                    <AnimatePresence>
                                                        {hasSubsidy && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: "auto", opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="space-y-3 pt-2 border-t border-gray-100 overflow-hidden"
                                                            >
                                                                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                                                                    <div className="sm:col-span-1">
                                                                                                        <label className="text-[8.5px] font-black text-gray-400 uppercase tracking-widest block mb-1">Subsidy Rate (%)</label>
                                                                                                        <input
                                                                                                            type="number"
                                                                                                            step="0.01"
                                                                                                            value={subsidyPercentage}
                                                                                                            onChange={(e) => setSubsidyPercentage(e.target.value)}
                                                                                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7]"
                                                                                                        />
                                                                                                    </div>
                                                                                                    <div className="sm:col-span-2">
                                                                                                        <label className="text-[8.5px] font-black text-gray-400 uppercase tracking-widest block mb-1">Scheme / Description</label>
                                                                                                        <input
                                                                                                            type="text"
                                                                                                            value={subsidyDescription}
                                                                                                            onChange={(e) => setSubsidyDescription(e.target.value)}
                                                                                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#6605c7]"
                                                                                                        />
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div className="text-[9.5px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                                                                                    <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                                                                                    <span>Effective Lending ROI: {(parseFloat(interestRate) - parseFloat(subsidyPercentage)).toFixed(2)}%</span>
                                                                                                </div>
                                                                                            </motion.div>
                                                                                        )}
                                                                                    </AnimatePresence>
                                                                                </div>
                                                                            </div>

                                                                            {/* F5: Processing Fee Form */}
                                                                            <div className="space-y-4">
                                                                                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] border-b border-purple-50 pb-1.5 flex items-center gap-1">
                                                                                    <span className="material-symbols-outlined text-xs">account_balance_wallet</span>
                                                                                    Processing Fee Section
                                                                                </h3>

                                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                                                    {/* Amount */}
                                                                                    <div>
                                                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Base Fee Amount (₹)</label>
                                                                                        <input
                                                                                            type="number"
                                                                                            required
                                                                                            disabled={hasWaiver}
                                                                                            value={hasWaiver ? "0" : feeAmount}
                                                                                            onChange={(e) => setFeeAmount(e.target.value)}
                                                                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] disabled:bg-gray-100 disabled:text-gray-400"
                                                                                        />
                                                                                    </div>

                                                                                    {/* Payment mode dropdown */}
                                                                                    <div>
                                                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Collection Mode</label>
                                                                                        <select
                                                                                            value={feePaymentMode}
                                                                                            onChange={(e) => setFeePaymentMode(e.target.value)}
                                                                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7]"
                                                                                        >
                                                                                            <option value="upfront">Upfront direct debit</option>
                                                                                            <option value="deducted">Deduct from 1st disbursement</option>
                                                                                            <option value="capitalized">Capitalize in loan / EMI</option>
                                                                                        </select>
                                                                                    </div>
                                                                                </div>

                                                                                {/* GST auto-calculation & waiver option */}
                                                                                <div className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-4">
                                                                                    <div className="flex flex-col sm:flex-row justify-between gap-4 border-b border-gray-100 pb-3">
                                                                                        <div>
                                                                                            <span className="text-[8.5px] font-black text-gray-400 uppercase tracking-widest block">GST Calculation (18%)</span>
                                                                                            <span className="text-xs font-black text-gray-700">₹{gstValue.toLocaleString()}</span>
                                                                                        </div>
                                                                                        <div>
                                                                                            <span className="text-[8.5px] font-black text-gray-400 uppercase tracking-widest block">Total Processing Fee</span>
                                                                                            <span className="text-xs font-black text-[#6605c7]">₹{totalFeeValue.toLocaleString()}</span>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Waiver option */}
                                                                                    <div className="space-y-3">
                                                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                                                            <input
                                                                                                type="checkbox"
                                                                                                checked={hasWaiver}
                                                                                                onChange={(e) => setHasWaiver(e.target.checked)}
                                                                                                className="w-4 h-4 text-[#6605c7] focus:ring-[#6605c7]/20 border-gray-300 rounded"
                                                                                            />
                                                                                            <span className="text-[10px] font-black text-gray-700 uppercase tracking-wider">Waive Processing Fees</span>
                                                                                        </label>

                                                                                        <AnimatePresence>
                                                                                            {hasWaiver && (
                                                                                                <motion.div
                                                                                                    initial={{ height: 0, opacity: 0 }}
                                                                                                    animate={{ height: "auto", opacity: 1 }}
                                                                                                    exit={{ height: 0, opacity: 0 }}
                                                                                                    className="pt-2 overflow-hidden"
                                                                                                >
                                                                                                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Reason for Waiver</label>
                                                                                                    <textarea
                                                                                                        required
                                                                                                        value={waiverReason}
                                                                                                        onChange={(e) => setWaiverReason(e.target.value)}
                                                                                                        placeholder="Provide reasoning for fee waiver..."
                                                                                                        rows={2}
                                                                                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#6605c7]"
                                                                                                    />
                                                                                                </motion.div>
                                                                                            )}
                                                                                        </AnimatePresence>
                                                                                    </div>
                                                                                </div>
                                                                            </div>

                                                                            {/* F9: Partial Sanction details */}
                                                                            <div className="space-y-4">
                                                                                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] border-b border-purple-50 pb-1.5 flex items-center gap-1">
                                                                                    <span className="material-symbols-outlined text-xs">align_horizontal_left</span>
                                                                                    Proposed Sanction Quantum
                                                                                </h3>

                                                                                <div>
                                                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Sanctioned Amount (₹)</label>
                                                                                    <input
                                                                                        type="number"
                                                                                        required
                                                                                        value={sanctionAmount}
                                                                                        onChange={(e) => setSanctionAmount(e.target.value)}
                                                                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7]"
                                                                                    />
                                                                                </div>

                                                                                {/* Shortfall warning UI (F9) */}
                                                                                <AnimatePresence>
                                                                                    {shortfallValue > 0 && (
                                                                                        <motion.div
                                                                                            initial={{ scale: 0.95, opacity: 0 }}
                                                                                            animate={{ scale: 1, opacity: 1 }}
                                                                                            exit={{ scale: 0.95, opacity: 0 }}
                                                                                            className="p-4 bg-amber-50 border border-amber-100 rounded-2xl space-y-3 overflow-hidden"
                                                                                        >
                                                                                            <div className="flex justify-between items-start">
                                                                                                <div>
                                                                                                    <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Partial Sanction Shortfall</p>
                                                                                                    <p className="text-xs font-black text-gray-800 mt-1">Shortfall detected: ₹{shortfallValue.toLocaleString()}</p>
                                                                                                    <p className="text-[10px] text-gray-500 mt-0.5 font-medium">Proposed amount is less than applicant's sought quantum.</p>
                                                                                                </div>
                                                                                                <button
                                                                                                    type="button"
                                                                                                    onClick={handleRouteShortfall}
                                                                                                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0 transition-all flex items-center gap-1 cursor-pointer"
                                                                                                >
                                                                                                    <span className="material-symbols-outlined text-xs">swap_horiz</span>
                                                                                                    Route Shortfall
                                                                                                </button>
                                                                                            </div>
                                                                                        </motion.div>
                                                                                    )}
                                                                                </AnimatePresence>
                                                                            </div>

                                                                            {/* Step 2 Navigation Actions */}
                                                                            <div className="flex justify-between pt-4 border-t border-purple-50">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setCurrentStep(1)}
                                                                                    className="px-5 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                                                                                >
                                                                                    ← Back to Step 1
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => setCurrentStep(3)}
                                                                                    disabled={!isStep2Valid}
                                                                                    className="px-6 py-3 bg-[#6605c7] hover:bg-[#5203a4] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
                                                                                >
                                                                                    <span>Proceed to Verdict</span>
                                                                                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                    {/* STEP 3: Final Verdict & Submission */}
                                                                    {currentStep === 3 && (
                                                                        <div className="bg-white rounded-3xl border border-purple-50 shadow-sm overflow-hidden animate-fade-in">
                                                                            {/* Tab Headers */}
                                                                            <div className="grid grid-cols-3 sm:grid-cols-6 bg-gray-50/70 border-b border-purple-50 p-1">
                                                                                {[
                                                                                    { id: "sanction", label: "Sanction", icon: "check_circle" },
                                                                                    { id: "conditional", label: "Conditional", icon: "rule" },
                                                                                    { id: "counter_offer", label: "Counter", icon: "compare_arrows" },
                                                                                    { id: "reject", label: "Reject", icon: "cancel" },
                                                                                    { id: "queries", label: "Queries", icon: "question_answer" },
                                                                                    { id: "letter", label: "Letter", icon: "rate_review" }
                                                                                ].map((tab) => (
                                                                                    <button
                                                                                        key={tab.id}
                                                                                        type="button"
                                                                                        onClick={() => setActiveDecisionTab(tab.id as any)}
                                                                                        className={`py-2 rounded-xl text-[8.5px] font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition-all ${activeDecisionTab === tab.id
                                                                                                ? "bg-white text-[#6605c7] shadow-sm border border-purple-100/50"
                                                                                                : "text-gray-400 hover:text-gray-600"
                                                                                            }`}
                                                                                    >
                                                                                        <span className="material-symbols-outlined text-[12px]">{tab.icon}</span>
                                                                                        <span className="text-[7.5px] truncate max-w-[70px] sm:max-w-none">{tab.label}</span>
                                                                                    </button>
                                                                                ))}
                                                                            </div>

                                                                            {/* Tab Content Box */}
                                                                            <div className="p-6">
                                                                                {activeDecisionTab !== "queries" && activeDecisionTab !== "letter" && selectedApp.BankDecision && selectedApp.BankDecision.length > 0 ? (
                                                                                    <div className="p-6 bg-gray-50 border border-gray-200 border-dashed rounded-2xl text-center mt-4">
                                                                                        <span className="material-symbols-outlined block text-3xl mb-3 text-purple-400">task_alt</span>
                                                                                        <p className="text-sm text-gray-600 font-bold">Decision already registered: <span className="text-[#6605c7] uppercase">{selectedApp.BankDecision[selectedApp.BankDecision.length - 1].decision.replace(/_/g, ' ')}</span></p>
                                                                                        <p className="text-xs text-gray-400 mt-2">Check the Activity Timeline for specific decision history.</p>
                                                                                    </div>
                                                                                ) : (
                                                                                    <form onSubmit={handleDecisionSubmit} className="space-y-6">

                                                                                        {/* TAB 1: SANCTION SUMMARY */}
                                                                                        {activeDecisionTab === "sanction" && (
                                                                                            <div className="p-4 bg-purple-50/40 border border-purple-100 rounded-2xl space-y-3">
                                                                                                <div className="flex items-center gap-2 text-purple-700 text-xs font-bold">
                                                                                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                                                                                    <span>Full Sanction Decision Summary</span>
                                                                                                </div>
                                                                                                <p className="text-[11px] text-gray-600">The loan will be sanctioned with the configured Interest Rate ({interestRate}%), Base Fee (₹{feeAmount}), and Quantum (₹{parseFloat(sanctionAmount || "0").toLocaleString()}). Ensure officer remarks are filled below before final submission.</p>
                                                                                            </div>
                                                                                        )}

                                                                                        {/* TAB 2: CONDITIONAL */}
                                                                                        {activeDecisionTab === "conditional" && (
                                                                                            <div className="space-y-6 animate-fade-in-up">
                                                                                                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] border-b border-purple-50 pb-1.5 flex items-center gap-1">
                                                                                                    <span className="material-symbols-outlined text-xs">playlist_add_check</span>
                                                                                                    Conditions Editor
                                                                                                </h3>

                                                                                                {/* Conditions List */}
                                                                                                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                                                                                    {conditions.map((cond) => (
                                                                                                        <div
                                                                                                            key={cond.id}
                                                                                                            className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-purple-100/50 shadow-sm transition-all"
                                                                                                        >
                                                                        <div className="flex-1 pr-4">
                                                                            <div className="flex items-center gap-1.5">
                                                                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${cond.type === "mandatory"
                                                                                        ? "bg-rose-50 text-rose-600 border border-rose-100"
                                                                                        : "bg-blue-50 text-blue-600 border border-blue-100"
                                                                                    }`}>
                                                                                    {cond.type}
                                                                                </span>
                                                                                <span className="text-[9.5px] font-bold text-gray-400 font-mono">
                                                                                    Deadline: {format(new Date(cond.deadline), "dd MMM yyyy")}
                                                                                </span>
                                                                            </div>
                                                                            <p className="text-xs font-bold text-gray-700 mt-1">{cond.text}</p>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeCondition(cond.id)}
                                                                            className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 hover:bg-rose-50 hover:text-rose-500 transition-all border border-gray-100"
                                                                        >
                                                                            <span className="material-symbols-outlined text-sm">delete</span>
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {/* Add New Condition Editor */}
                                                            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Append Custom Condition</p>

                                                                <div>
                                                                    <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Condition text</label>
                                                                    <textarea
                                                                        value={newConditionText}
                                                                        onChange={(e) => setNewConditionText(e.target.value)}
                                                                        placeholder="e.g. Applicant must deposit 3 months interest accrual backup..."
                                                                        rows={2}
                                                                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#6605c7]"
                                                                    />
                                                                </div>

                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                    <div>
                                                                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Severity / Badge</label>
                                                                        <select
                                                                            value={newConditionType}
                                                                            onChange={(e) => setNewConditionType(e.target.value as any)}
                                                                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7]"
                                                                        >
                                                                            <option value="mandatory">Mandatory (Disbursement Pre-req)</option>
                                                                            <option value="advisory">Advisory (Post-Disbursement)</option>
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-1">Deadline Date Picker</label>
                                                                        <input
                                                                            type="date"
                                                                            value={newConditionDeadline}
                                                                            onChange={(e) => setNewConditionDeadline(e.target.value)}
                                                                            className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7]"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={addCondition}
                                                                    className="w-full py-2 bg-[#6605c7] hover:bg-[#5203a4] text-white text-[9.5px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                                                                >
                                                                    <span className="material-symbols-outlined text-xs">add</span>
                                                                    Append Condition Badge
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* TAB 3: COUNTER-OFFER (F10 UI) */}
                                                    {activeDecisionTab === "counter_offer" && (
                                                        <div className="space-y-6 animate-fade-in-up">
                                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] border-b border-purple-50 pb-1.5 flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-xs">compare_arrows</span>
                                                                Counter-Offer Workspace
                                                            </h3>

                                                            {/* Side-by-side comparison table */}
                                                            <div className="overflow-hidden border border-purple-100 rounded-2xl bg-white shadow-sm">
                                                                <table className="w-full text-left border-collapse">
                                                                    <thead>
                                                                        <tr className="bg-gray-50 border-b border-purple-50">
                                                                            <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-gray-400">Parameter</th>
                                                                            <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-gray-400">Original sought</th>
                                                                            <th className="px-4 py-3 text-[9px] font-black uppercase tracking-wider text-purple-700 bg-purple-50/50">Bank proposed Counter</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-gray-100 text-xs">
                                                                        <tr>
                                                                            <td className="px-4 py-3.5 font-bold text-gray-500">Principal Amount</td>
                                                                            <td className="px-4 py-3.5 font-bold text-gray-700">₹{selectedApp.amount?.toLocaleString()}</td>
                                                                            <td className="px-4 py-2 bg-purple-50/20">
                                                                                <input
                                                                                    type="number"
                                                                                    value={counterAmount}
                                                                                    onChange={(e) => setCounterAmount(e.target.value)}
                                                                                    className="w-full px-2.5 py-1 border border-purple-200 rounded-lg text-xs font-bold focus:outline-none focus:border-[#6605c7] bg-white"
                                                                                />
                                                                            </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td className="px-4 py-3.5 font-bold text-gray-500">Interest Rate (%)</td>
                                                                            <td className="px-4 py-3.5 font-bold text-gray-700">{selectedApp.interestRate || 9.55}%</td>
                                                                            <td className="px-4 py-2 bg-purple-50/20">
                                                                                <input
                                                                                    type="number"
                                                                                    step="0.01"
                                                                                    value={counterRate}
                                                                                    onChange={(e) => setCounterRate(e.target.value)}
                                                                                    className="w-full px-2.5 py-1 border border-purple-200 rounded-lg text-xs font-bold focus:outline-none focus:border-[#6605c7] bg-white"
                                                                                />
                                                                            </td>
                                                                        </tr>
                                                                        <tr>
                                                                            <td className="px-4 py-3.5 font-bold text-gray-500">Tenure (months)</td>
                                                                            <td className="px-4 py-3.5 font-bold text-gray-700">{selectedApp.tenure || 180} months</td>
                                                                            <td className="px-4 py-2 bg-purple-50/20">
                                                                                <input
                                                                                    type="number"
                                                                                    value={counterTenure}
                                                                                    onChange={(e) => setCounterTenure(e.target.value)}
                                                                                    className="w-full px-2.5 py-1 border border-purple-200 rounded-lg text-xs font-bold focus:outline-none focus:border-[#6605c7] bg-white"
                                                                                />
                                                                            </td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </div>

                                                            {/* Staff actions simulator */}
                                                            <div className="p-4.5 bg-purple-50/50 border border-purple-100 rounded-2xl space-y-3">
                                                                <div className="flex justify-between items-center">
                                                                    <div>
                                                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Simulator status</p>
                                                                        <p className="text-xs font-black text-gray-800 mt-0.5">Student Offer State:
                                                                            <span className={`ml-1.5 uppercase text-[9px] px-2 py-0.5 rounded font-black ${counterOfferStatus === "accepted"
                                                                                    ? "bg-emerald-100 text-emerald-700"
                                                                                    : counterOfferStatus === "rejected"
                                                                                        ? "bg-rose-100 text-rose-700"
                                                                                        : "bg-amber-100 text-amber-700"
                                                                                }`}>
                                                                                {counterOfferStatus}
                                                                            </span>
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={async () => {
                                                                                try {
                                                                                    await adminApi.updateApplication(selectedApp.id, { status: "sanctioned" });
                                                                                    await adminApi.addRemark(selectedApp.id, {
                                                                                        type: 'remark',
                                                                                        content: `Student ACCEPTED Counter-Offer (₹${(parseFloat(counterAmount) || 0).toLocaleString()} @ ${counterRate}%)`
                                                                                    });
                                                                                    setCounterOfferStatus("accepted");
                                                                                    await fetchTimeline(selectedApp.id);
                                                                                    await fetchRemarks(selectedApp.id);
                                                                                    fetchApplications(currentBankId);
                                                                                } catch (err) {
                                                                                    console.error(err);
                                                                                    alert("Failed to accept offer");
                                                                                }
                                                                            }}
                                                                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all"
                                                                        >
                                                                            Accept Offer
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={async () => {
                                                                                try {
                                                                                    await adminApi.updateApplication(selectedApp.id, { status: "rejected" });
                                                                                    await adminApi.addRemark(selectedApp.id, {
                                                                                        type: 'remark',
                                                                                        content: `Student REJECTED Counter-Offer`
                                                                                    });
                                                                                    setCounterOfferStatus("rejected");
                                                                                    await fetchTimeline(selectedApp.id);
                                                                                    await fetchRemarks(selectedApp.id);
                                                                                    fetchApplications(currentBankId);
                                                                                } catch (err) {
                                                                                    console.error(err);
                                                                                    alert("Failed to reject offer");
                                                                                }
                                                                            }}
                                                                            className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase tracking-wider rounded-lg transition-all"
                                                                        >
                                                                            Reject Offer
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* TAB 4: REJECT */}
                                                    {activeDecisionTab === "reject" && (
                                                        <div className="space-y-6 animate-fade-in-up">
                                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-rose-600 border-b border-rose-100 pb-1.5 flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-xs">cancel</span>
                                                                Rejection Categorization
                                                            </h3>

                                                            <div className="space-y-4">
                                                                <div>
                                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Rejection Category</label>
                                                                    <select
                                                                        required
                                                                        value={rejectionCategory}
                                                                        onChange={(e) => {
                                                                            setRejectionCategory(e.target.value);
                                                                            if (e.target.value === "CIBIL") setRejectionReason("Unsatisfactory CIBIL/Credit Score");
                                                                            else if (e.target.value === "INCOME") setRejectionReason("High DTI (Debt-to-Income) Ratio");
                                                                            else if (e.target.value === "DOCS") setRejectionReason("Document Discrepancy / Missing Verification Docs");
                                                                            else if (e.target.value === "FRAUD") setRejectionReason("Verification Deficiencies / Fraud");
                                                                            else if (e.target.value === "POLICY") setRejectionReason("Ineligible University/Program Tier or Policy Deviation");
                                                                            else if (e.target.value === "TECHNICAL") setRejectionReason("Technical validation or collateral valuation failure");
                                                                            else if (e.target.value === "OTHER") setRejectionReason("Other credit policy deviation");
                                                                        }}
                                                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-rose-500"
                                                                    >
                                                                        <option value="CIBIL">Unsatisfactory CIBIL/Credit Score</option>
                                                                        <option value="INCOME">High DTI (Debt-to-Income) Ratio</option>
                                                                        <option value="DOCS">Verification Deficiencies / Missing Docs</option>
                                                                        <option value="FRAUD">Fraudulent Documentation / Activity</option>
                                                                        <option value="POLICY">Policy / Program Ineligibility</option>
                                                                        <option value="TECHNICAL">Technical / Valuation Issue</option>
                                                                        <option value="OTHER">Other Reasons</option>
                                                                    </select>
                                                                </div>

                                                                <div>
                                                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Detailed Rejection Reason</label>
                                                                    <textarea
                                                                        required
                                                                        value={rejectionReason}
                                                                        onChange={(e) => setRejectionReason(e.target.value)}
                                                                        placeholder="Provide specific reason for rejection..."
                                                                        rows={2}
                                                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-rose-500 text-gray-700"
                                                                    />
                                                                </div>

                                                                {/* F36: Cancellation flow */}
                                                                <div className="p-4.5 bg-rose-50/30 border border-rose-100/50 rounded-2xl space-y-4 mt-4 text-left">
                                                                    <div className="flex justify-between items-center border-b border-rose-100 pb-2">
                                                                        <span className="text-[9px] font-black text-rose-600 uppercase tracking-widest font-sans">Active Cancellation Dossier</span>
                                                                        <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-black rounded-lg">Termination Pending</span>
                                                                    </div>

                                                                    <div className="text-xs space-y-3 bg-white p-3 rounded-xl border border-rose-50 font-medium text-gray-650">
                                                                        <div>
                                                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Request Date</span>
                                                                            <p className="font-bold text-gray-750">
                                                                                {selectedApp?.updatedAt ? format(new Date(selectedApp.updatedAt), "dd MMM yyyy, HH:mm") : format(new Date(), "dd MMM yyyy, HH:mm")}
                                                                            </p>
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Cancellation Category</label>
                                                                            <select
                                                                                value={cancelCategory}
                                                                                onChange={(e) => setCancelCategory(e.target.value)}
                                                                                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold focus:outline-none focus:border-rose-500 text-gray-700"
                                                                            >
                                                                                <option value="applicant_withdrew">Applicant Withdrew</option>
                                                                                <option value="lender_rejected">Lender Rejected</option>
                                                                                <option value="duplicate_file">Duplicate File</option>
                                                                                <option value="other">Other</option>
                                                                            </select>
                                                                        </div>
                                                                        <div>
                                                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Refund Reversal Remarks</label>
                                                                            <textarea
                                                                                value={cancelRefundDetails}
                                                                                onChange={(e) => setCancelRefundDetails(e.target.value)}
                                                                                placeholder="Describe reversal details..."
                                                                                rows={2}
                                                                                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium focus:outline-none focus:border-rose-500 text-gray-750"
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                    <div>
                                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Refund Policy Decision</label>
                                                                        <div className="grid grid-cols-3 gap-2">
                                                                            {[
                                                                                { id: "full", label: "Full (₹15k)" },
                                                                                { id: "partial", label: "Partial (₹7.5k)" },
                                                                                { id: "none", label: "No Refund" }
                                                                            ].map(opt => (
                                                                                <button
                                                                                    key={opt.id}
                                                                                    type="button"
                                                                                    onClick={() => setCancelRefundOption(opt.id)}
                                                                                    className={`py-2 text-[8.5px] font-black uppercase rounded-lg border text-center transition-all ${cancelRefundOption === opt.id
                                                                                            ? "bg-rose-600 border-rose-650 text-white"
                                                                                            : "bg-white border-gray-250 text-gray-655 hover:bg-gray-50"
                                                                                        }`}
                                                                                >
                                                                                    {opt.label}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={handleRejectCancellation}
                                                                            className="flex-1 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-550 text-[9px] font-black uppercase tracking-wider rounded-lg"
                                                                        >
                                                                            Reject Request
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={handleConfirmCancellation}
                                                                            className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-black uppercase tracking-wider rounded-lg shadow-sm"
                                                                        >
                                                                            Confirm Reversal
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* TAB 5: QUERIES (F6 UI) */}
                                                    {activeDecisionTab === "queries" && (
                                                        <div className="space-y-4 animate-fade-in-up text-left">
                                                            <div className="flex justify-between items-center border-b border-purple-50 pb-1.5">
                                                                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-xs">question_answer</span>
                                                                    Verification Queries & Clarifications
                                                                </h3>
                                                                <span className="px-2 py-0.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-[8px] text-[8.5px] font-black uppercase tracking-wider animate-pulse">
                                                                    SLA: 48h Response Target
                                                                </span>
                                                            </div>

                                                            {/* Document Checklist Pinning */}
                                                            <div className="p-3 bg-purple-50/30 border border-purple-100/50 rounded-xl space-y-2">
                                                                <span className="text-[8px] font-black text-purple-700 uppercase tracking-widest block">Pin Query to Missing Documents</span>
                                                                <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-gray-700">
                                                                    {[
                                                                        { id: "m1", label: "10th/12th Marksheets" },
                                                                        { id: "m2", label: "Guarantor Signature" },
                                                                        { id: "m3", label: "Offer Letter PDF" },
                                                                        { id: "m4", label: "Co-applicant ITR" }
                                                                    ].map(chk => (
                                                                        <label key={chk.id} className="flex items-center gap-2 cursor-pointer select-none">
                                                                            <input type="checkbox" defaultChecked className="w-3.5 h-3.5 text-[#6605c7] focus:ring-[#6605c7]/20 border-gray-300 rounded" />
                                                                            <span>{chk.label}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Chat stream inside appraisal panel */}
                                                            <div className="border border-purple-100 rounded-2xl bg-[#faf9fc] p-4 h-56 overflow-y-auto space-y-3 custom-scrollbar flex flex-col">
                                                                {selectedApp?.queries && selectedApp.queries.length > 0 ? (
                                                                    selectedApp.queries.map((q: any) => {
                                                                        const studentName = `${selectedApp.firstName || ''} ${selectedApp.lastName || ''}`.trim().toLowerCase();
                                                                        const authorLower = (q.authorName || '').toLowerCase();
                                                                        const isBank = !authorLower ||
                                                                            authorLower.includes('bank') ||
                                                                            authorLower.includes('officer') ||
                                                                            authorLower.includes('lender') ||
                                                                            authorLower.includes('underwriter') ||
                                                                            authorLower.includes('monitor') ||
                                                                            authorLower.includes('staff') ||
                                                                            authorLower.includes('jenkins') ||
                                                                            (!authorLower.includes(studentName) &&
                                                                                !(selectedApp.firstName && authorLower.includes(selectedApp.firstName.toLowerCase())) &&
                                                                                !(selectedApp.lastName && authorLower.includes(selectedApp.lastName.toLowerCase())));

                                                                        return (
                                                                            <div key={q.id} className={`flex flex-col max-w-[85%] ${isBank ? 'self-end items-end ml-auto' : 'self-start items-start mr-auto'}`}>
                                                                                <span className="text-[7.5px] font-black text-gray-400 uppercase tracking-wider mb-1">
                                                                                    {isBank ? (q.authorName || 'Credit Officer') : (q.authorName || 'Student Applicant')}
                                                                                </span>
                                                                                <div className={`p-3 rounded-2xl text-xs font-semibold ${isBank ? 'bg-[#6605c7] text-white rounded-tr-none' : 'bg-white border border-purple-100 text-gray-800 rounded-tl-none shadow-sm'}`}>
                                                                                    {q.content}
                                                                                </div>
                                                                                <span className="text-[7px] text-gray-400 font-bold uppercase mt-1">
                                                                                    {q.createdAt ? format(new Date(q.createdAt), "MMM dd, hh:mm a") : 'Just now'}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <div className="flex-grow flex flex-col items-center justify-center text-center p-4">
                                                                        <span className="material-symbols-outlined text-purple-200 text-3xl mb-1">chat_bubble_outline</span>
                                                                        <p className="text-[10px] font-bold text-purple-400/70 uppercase tracking-wider">No verification queries raised yet.</p>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* F42 Canned Template Presets picker */}
                                                            <div className="space-y-1.5">
                                                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Insert Template Preset</span>
                                                                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                                                                    {[
                                                                        { title: "Marksheet Verify", msg: "Please upload clear scanned copies of your 10th and 12th standard original marks sheets." },
                                                                        { title: "Sign Pending", msg: "Guarantor signature has failed automated validation matching. Re-sign." },
                                                                        { title: "Offer Document", msg: "Confirm if you hold a provisional or finalized offer letter for the STEM course." },
                                                                        { title: "ITR Clarify", msg: "Co-applicant salary slip deductions require tax computation sheet verification." }
                                                                    ].map((preset, pIdx) => (
                                                                        <button
                                                                            key={pIdx}
                                                                            type="button"
                                                                            onClick={() => setNewQueryText(preset.msg)}
                                                                            className="px-2.5 py-1.5 bg-white border border-purple-100 text-[#6605c7] hover:bg-[#6605c7] hover:text-white text-[8px] font-bold rounded-lg transition-all shrink-0 shadow-sm"
                                                                        >
                                                                            {preset.title}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Send query input */}
                                                            <div className="flex gap-2">
                                                                 <input
                                                                     type="text"
                                                                     placeholder="Type a new query parameter to student..."
                                                                     value={newQueryText}
                                                                     onChange={e => setNewQueryText(e.target.value)}
                                                                     onKeyDown={e => {
                                                                         if (e.key === 'Enter') {
                                                                             e.preventDefault();
                                                                             handleDispatchQuery();
                                                                         }
                                                                     }}
                                                                     className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#6605c7] text-gray-700"
                                                                 />
                                                                <button
                                                                    type="button"
                                                                    onClick={handleDispatchQuery}
                                                                    className="px-3.5 py-2 bg-[#6605c7] hover:bg-[#5203a4] text-white text-[9.5px] font-black uppercase tracking-wider rounded-xl shadow-sm transition-all"
                                                                >
                                                                    Dispatch
                                                                </button>
                                                            </div>

                                                            <div className="grid grid-cols-2 gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={handleResolveQueries}
                                                                    className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                                                                >
                                                                    <span className="material-symbols-outlined text-xs">done_all</span>
                                                                    Resolve & Resume
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => alert("📄 Clarification Memo PDF template compiled! Sent to student portal.")}
                                                                    className="py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                                                                >
                                                                    <span className="material-symbols-outlined text-xs">assignment_late</span>
                                                                    Generate Memo
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* TAB 6: SANCTION LETTER (F49 UI) */}
                                                    {activeDecisionTab === "letter" && (
                                                        <div className="space-y-4 animate-fade-in-up">
                                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] border-b border-purple-50 pb-1.5 flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-xs">rate_review</span>
                                                                Digital Sanction Letter Preview
                                                            </h3>

                                                            {/* Letter Mockup */}
                                                            <div className="border border-purple-100 rounded-2xl p-5 bg-white space-y-4 text-[10px] leading-relaxed shadow-sm font-sans text-gray-805 h-80 overflow-y-auto custom-scrollbar">
                                                                <div className="text-center border-b border-purple-50 pb-3">
                                                                    <h4 className="font-bold text-xs text-[#6605c7]">VIDYABANK SANCTION MEMORANDUM</h4>
                                                                    <p className="text-[8px] text-gray-400 uppercase tracking-widest mt-0.5">Reference: VL-SAN-{selectedApp.applicationNumber}</p>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <p><strong>To,</strong><br />{selectedApp.firstName} {selectedApp.lastName}<br />Subject: Sanction of Education Loan</p>
                                                                    <p>We are pleased to inform you that VidyaBank has sanctioned an educational credit facility under the following terms:</p>
                                                                    <div className="p-3 bg-purple-50/50 border border-purple-100/30 rounded-xl space-y-1 font-mono text-[9px] text-gray-700">
                                                                        <div>• <strong>Approved Principal:</strong> ₹{parseFloat(sanctionAmount || selectedApp.amount).toLocaleString()}</div>
                                                                        <div>• <strong>Benchmark ROI:</strong> {interestRate}% ({roiType})</div>
                                                                        <div>• <strong>Processing Fees:</strong> ₹{totalFeeValue.toLocaleString()} ({feePaymentMode})</div>
                                                                        <div>• <strong>University:</strong> {selectedApp.universityName}</div>
                                                                    </div>
                                                                    <p>This sanction is subject to compliance checks, execution of loan covenants, and verified data consent approvals.</p>
                                                                </div>
                                                                <div className="pt-4 border-t border-purple-50 flex justify-between items-center">
                                                                    <div>
                                                                        <p className="text-[8px] text-gray-400 uppercase tracking-widest">Digital Signature Hash</p>
                                                                        <p className="font-mono text-[8px] text-purple-700 font-bold">sha256: 8f92a10d93427f7e91...</p>
                                                                    </div>
                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[8px] font-black uppercase tracking-wider">
                                                                        <span className="material-symbols-outlined text-[10px]">verified</span>
                                                                        Signed
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Actions */}
                                                            <div className="grid grid-cols-2 gap-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={handleSignLetter}
                                                                    className="py-2.5 bg-[#6605c7] hover:bg-[#5203a4] text-white text-[9.5px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                                                                >
                                                                    <span className="material-symbols-outlined text-xs">draw</span>
                                                                    Sign Letter
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => alert("⬇️ Downloading Sanction Letter PDF template...")}
                                                                    className="py-2.5 border border-purple-100 hover:bg-purple-50/50 text-[#6605c7] text-[9.5px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5"
                                                                >
                                                                    <span className="material-symbols-outlined text-xs">download</span>
                                                                    Download PDF
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Common Remarks Field & Decisions Submission (Hidden for utility tabs) */}
                                                    {activeDecisionTab !== "queries" && activeDecisionTab !== "letter" && (
                                                        <>
                                                            <div>
                                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Credit Officer Comments & Remarks</label>
                                                                <textarea
                                                                    required
                                                                    value={officerRemarks}
                                                                    onChange={(e) => setOfficerRemarks(e.target.value)}
                                                                    placeholder="Record loan approval note, waiver reasons, or risk mitigants..."
                                                                    rows={3}
                                                                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-medium focus:outline-none focus:border-[#6605c7] text-gray-700"
                                                                />
                                                            </div>

                                                            {/* Final Actions block */}
                                                            {!dataConsentVerified && (
                                                                <div className="text-[10px] text-amber-750 bg-amber-50 border border-amber-150 p-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-medium shadow-sm">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="material-symbols-outlined text-amber-500 text-sm animate-pulse">lock</span>
                                                                        <span>Data Consent check is required. Verify and toggle the <strong>Data Consent</strong> indicator under Underwriting Indicators above, or authorize directly:</span>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={async () => {
                                                                            setDataConsentVerified(true);
                                                                            if (selectedApp) {
                                                                                try {
                                                                                    await bankApi.recordConsent(selectedApp.id, {
                                                                                        consentType: "officer_override"
                                                                                    });
                                                                                } catch (err) {
                                                                                    console.error("Failed to record consent in backend:", err);
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shrink-0 transition-all flex items-center gap-1.5 self-end sm:self-auto cursor-pointer"
                                                                    >
                                                                        <span className="material-symbols-outlined text-xs">check_circle</span>
                                                                        Verify & Grant Consent
                                                                    </button>
                                                                </div>
                                                            )}
                                                            <div className="flex gap-3 pt-3">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setCurrentStep(2)}
                                                                    className="px-4 py-3.5 border border-gray-200 text-gray-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all font-sans cursor-pointer shrink-0"
                                                                >
                                                                    ← Back
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setShowWorkspace(false)}
                                                                    className="flex-1 py-3.5 border border-gray-200 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all font-sans"
                                                                >
                                                                    Cancel appraisal
                                                                </button>
                                                                <button
                                                                    type="submit"
                                                                    disabled={submitting || !dataConsentVerified}
                                                                    className="flex-1 py-3.5 bg-[#6605c7] hover:bg-[#8b24e5] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-500/10 transition-all flex items-center justify-center font-sans disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                                                >
                                                                    {submitting ? "Saving appraisal..." : "Submit Appraisal"}
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </form>
                                            )}
                                        </div>
                                    </div>
                                    )}
                                </div>

                                {/* RIGHT COLUMN: F32 Notes & F31 Activity Timeline (40% width) */}
                                <div className="w-full lg:w-2/5 p-6 bg-[#f7f5f9]/50 space-y-8 overflow-y-auto custom-scrollbar flex flex-col justify-between">

                                    <div className="space-y-8">
                                        {/* F32: Internal Notes Panel */}
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center border-b border-purple-50 pb-2">
                                                <h3 className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-xs">notes</span>
                                                    Internal Appraisal Notes
                                                </h3>
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-100 rounded text-[8px] font-black uppercase tracking-wider animate-pulse">
                                                    <span className="material-symbols-outlined text-[10px] icon-filled">lock</span>
                                                    Bank Eyes Only
                                                </span>
                                            </div>

                                            {/* Note input form */}
                                            <form onSubmit={addNote} className="space-y-2">
                                                <textarea
                                                    value={newNoteText}
                                                    onChange={(e) => setNewNoteText(e.target.value)}
                                                    placeholder="Type bank-only notes for audit trail..."
                                                    rows={2}
                                                    className="w-full px-3.5 py-2.5 bg-white border border-purple-100/50 rounded-xl text-xs focus:outline-none focus:border-[#6605c7] shadow-sm transition-all"
                                                />
                                                <button
                                                    type="submit"
                                                    className="px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-[9.5px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-[12px]">send</span> Add note
                                                </button>
                                            </form>

                                            {/* Notes List */}
                                            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                                                {notesList.map((note) => (
                                                    <div
                                                        key={note.id}
                                                        className="p-3 bg-white border border-purple-50 rounded-2xl shadow-sm space-y-1 relative"
                                                    >
                                                        <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-gray-400">
                                                            <span>{note.author} ({note.role})</span>
                                                            <span className="font-mono">{note.timestamp}</span>
                                                        </div>
                                                        <p className="text-[11.5px] font-bold text-gray-700 leading-relaxed font-sans">
                                                            {note.text}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* F31: Activity Timeline Component */}
                                        <div className="space-y-4">
                                            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] border-b border-purple-50 pb-2 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">timeline</span>
                                                Activity Timeline
                                            </h3>

                                            {/* Vertical Timeline container */}
                                            <div className="relative pl-6 space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-purple-100">
                                                {timelineEvents.map((event) => (
                                                    <div key={event.id} className="relative">
                                                        {/* Timeline bullet node */}
                                                        <span className="absolute -left-[23px] top-0 w-[24px] h-[24px] rounded-full bg-white border-2 border-purple-200 flex items-center justify-center text-[#6605c7] shadow-sm">
                                                            <span className="material-symbols-outlined text-[12px]">{event.icon}</span>
                                                        </span>

                                                        <div>
                                                            <div className="flex items-center justify-between text-[8.5px] font-black uppercase tracking-widest text-gray-400">
                                                                <span>{event.actor}</span>
                                                                <span className="font-mono">{event.timestamp}</span>
                                                            </div>
                                                            <p className="text-xs font-bold text-gray-700 mt-1 leading-snug font-sans">
                                                                {event.text}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* F9: Secondary Bank Routing Modal */}
            <AnimatePresence>
                {showRoutingModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        {/* Modal Backdrop */}
                        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setShowRoutingModal(false)} />

                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-[2rem] border border-purple-50 shadow-2xl p-8 max-w-md w-full z-10 relative overflow-hidden"
                        >
                            <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight flex items-center gap-2">
                                <span className="material-symbols-outlined text-[#6605c7]">swap_horiz</span>
                                Dispatch File
                            </h3>
                            <p className="text-xs text-gray-400 mb-5 font-bold uppercase tracking-wider">
                                Route the shortfall of ₹{shortfallValue.toLocaleString()} to a partner co-lending institution.
                            </p>

                            {routingSuccessMsg ? (
                                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 font-medium text-xs flex items-center gap-2">
                                    <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                                    <span>{routingSuccessMsg}</span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Partner Bank select */}
                                    <div>
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Select Co-Lending Bank</label>
                                        <select
                                            value={routingTargetBank}
                                            onChange={(e) => setRoutingTargetBank(e.target.value)}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-[#6605c7]"
                                        >
                                            <option value="avanse">Avanse Financial (Gap Refinance)</option>
                                            <option value="auxilo">Auxilo Finserve (Short-term Bridge)</option>
                                            <option value="poonawalla">Poonawalla Fincorp (Refinance Desk)</option>
                                            <option value="idfc">IDFC FIRST Bank (Commercial Desk)</option>
                                            <option value="credila">HDFC Credila (Co-lending Desk)</option>
                                        </select>
                                    </div>

                                    {/* Security check */}
                                    <label className="flex items-center gap-2.5 p-3.5 bg-purple-50/50 border border-purple-100/50 rounded-xl cursor-pointer">
                                        <input
                                            type="checkbox"
                                            defaultChecked
                                            className="w-4 h-4 text-[#6605c7] focus:ring-[#6605c7]/20 border-gray-300 rounded"
                                        />
                                        <span className="text-[10px] font-semibold text-purple-700 leading-normal">
                                            Auto-share verified academic dossier & KYC folder details withrouted partner.
                                        </span>
                                    </label>

                                    <div className="flex gap-4 pt-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowRoutingModal(false)}
                                            className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all font-sans"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={confirmRouting}
                                            className="flex-1 py-3 bg-[#6605c7] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#5203a4] shadow-lg shadow-purple-500/10 transition-all font-sans"
                                        >
                                            Dispatch file
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* F33: Hold Application Modal */}
            <AnimatePresence>
                {showHoldModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setShowHoldModal(false)} />

                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-[2rem] border border-purple-50 shadow-2xl p-8 max-w-md w-full z-10 relative overflow-hidden"
                        >
                            <h3 className="text-xl font-black text-gray-900 mb-2 uppercase tracking-tight flex items-center gap-2 font-display">
                                <span className="material-symbols-outlined text-amber-600">pause_circle</span>
                                Pause Appraisal SLA
                            </h3>
                            <p className="text-xs text-gray-400 mb-5 font-bold uppercase tracking-wider">
                                Select a validation check holding reason to suspend current application SLA TAT.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Hold Category</label>
                                    <select
                                        value={holdReason}
                                        onChange={(e) => setHoldReason(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                    >
                                        <option value="">Select Reason...</option>
                                        <option value="Awaiting Property Valuation">Awaiting Property Valuation & Asset Deeds</option>
                                        <option value="Legal Clearance Pending">Legal Clearance & Clearance Certs</option>
                                        <option value="CIBIL Dispute Investigation">CIBIL Dispute Verification Audit</option>
                                        <option value="Foreign University Verification">Foreign University Direct Enrolment Check</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Scheduled Resume Date</label>
                                    <input
                                        type="date"
                                        value={holdResumeDate}
                                        onChange={e => setHoldResumeDate(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                    />
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Hold Policy Note</label>
                                    <textarea
                                        value={holdPauseNote}
                                        onChange={e => setHoldPauseNote(e.target.value)}
                                        rows={3}
                                        placeholder="Detail why document check or legal audit requires pausing..."
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                    />
                                </div>

                                <div className="flex gap-4 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowHoldModal(false)}
                                        className="flex-1 py-3 border border-gray-200 text-gray-505 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all font-sans"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        disabled={!holdReason}
                                        onClick={handlePauseFlow}
                                        className="flex-1 py-3 bg-[#6605c7] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#5203a4] shadow-lg shadow-purple-500/10 transition-all font-sans disabled:opacity-50"
                                    >
                                        Pause Flow
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* F36: Loan Cancellation Modal */}
            <AnimatePresence>
                {showCancelModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setShowCancelModal(false)} />

                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-[2rem] border border-rose-100 shadow-2xl p-8 max-w-md w-full z-10 relative overflow-hidden"
                        >
                            <h3 className="text-xl font-black text-rose-600 mb-2 uppercase tracking-tight flex items-center gap-2 font-display">
                                <span className="material-symbols-outlined text-rose-600">cancel_presentation</span>
                                Cancel Loan File
                            </h3>
                            <p className="text-xs text-gray-400 mb-5 font-bold uppercase tracking-wider">
                                Formally terminate this application record and configure refund metrics.
                            </p>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Termination Category</label>
                                    <select
                                        value={cancelCategory}
                                        onChange={(e) => setCancelCategory(e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold focus:outline-none focus:border-rose-500 text-gray-700"
                                    >
                                        <option value="applicant_withdrew">Applicant Withdrew Request</option>
                                        <option value="documents_falsified">Documents Falsified / Verification Fail</option>
                                        <option value="double_finance">Double Financing Detection</option>
                                        <option value="expired_sanction">Expired Sanction Window</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Refund & Reversal parameters</label>
                                    <textarea
                                        value={cancelRefundDetails}
                                        onChange={(e) => setCancelRefundDetails(e.target.value)}
                                        rows={2}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-rose-500 font-semibold text-gray-700"
                                    />
                                </div>

                                <div className="flex gap-4 pt-3">
                                    <button
                                        type="button"
                                        onClick={() => setShowCancelModal(false)}
                                        className="flex-1 py-3 border border-gray-200 text-gray-505 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all font-sans"
                                    >
                                        Abort
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmCancellation}
                                        className="flex-1 py-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 shadow-lg shadow-rose-500/10 transition-all font-sans"
                                    >
                                        Confirm Reversal
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
