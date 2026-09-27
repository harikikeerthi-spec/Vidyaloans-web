"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { bankApi, adminApi } from "@/lib/api";
import BankApplicationDetailView from "@/components/bank/BankApplicationDetailView";
import { motion, AnimatePresence } from "framer-motion";

export default function BankApplicationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [app, setApp] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [aiReview, setAiReview] = useState<any>(null);
    const [remarks, setRemarks] = useState<any[]>([]);

    // Decision & LAN Modal States
    const [showLanModal, setShowLanModal] = useState(false);
    const [showDecisionModal, setShowDecisionModal] = useState(false);
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
    const [counterAmount, setCounterAmount] = useState("");
    const [counterRate, setCounterRate] = useState("");
    const [counterTenure, setCounterTenure] = useState("");
    const [confirmingLog, setConfirmingLog] = useState(false);
    const [assignedOfficer, setAssignedOfficer] = useState("Sarah Jenkins (Senior Underwriter)");

    const fetchApplicationData = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [detailRes, docsRes, appRes, remarksRes]: [any, any, any, any] = await Promise.all([
                bankApi.getFileDetail(id).catch(() => null),
                bankApi.getDocuments(id).catch(() => []),
                adminApi.getApplication(id).catch(() => null),
                adminApi.getRemarks(id).catch(() => ({ data: [] })),
            ]);

            const docsList = Array.isArray(docsRes) ? docsRes : (docsRes?.data || docsRes?.documents || []);
            const baseApp = appRes?.data || appRes || {};
            const mergedApp = {
                ...baseApp,
                ...(detailRes || {}),
                documents: docsList.length > 0 ? docsList : (detailRes?.documents || baseApp?.documents || []),
            };
            setApp(mergedApp);

            // Parse remarks & AI review
            const remarksList = Array.isArray(remarksRes?.data) ? remarksRes.data : (Array.isArray(remarksRes) ? remarksRes : []);
            setRemarks(remarksList);
            const aiNote = remarksList.find((n: any) => n.type === "ai_review");
            if (aiNote) {
                try {
                    setAiReview(JSON.parse(aiNote.content));
                } catch {
                    setAiReview(null);
                }
            }
        } catch (err) {
            console.error("Failed to fetch application detail:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchApplicationData();
    }, [id]);

    const handleBack = () => {
        router.push("/bank/applications");
    };

    const handleAddRemark = async (content: string) => {
        const appId = app?.id || app?._id;
        if (!appId) return;
        try {
            await adminApi.addRemark(appId, {
                content,
                type: "underwriting_note",
            });
            fetchApplicationData();
        } catch (err) {
            console.error("Failed to add remark:", err);
        }
    };

    const handleLogFile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!app || !lanNumber.trim()) return;

        if (lanNumber.length < 15 || lanNumber.length > 20) {
            alert("LAN number must be between 15 and 20 characters long.");
            return;
        }

        try {
            const payload = {
                lanNumber: lanNumber.trim(),
                lanEnteredAt: new Date().toISOString(),
                stage: "under_review",
                status: "file_logged",
            };
            const appId = app.id || app._id;
            const res: any = await adminApi.updateApplication(appId, payload);
            if (res && res.success) {
                setShowLanModal(false);
                setLanNumber("");
                fetchApplicationData();
            }
        } catch (err) {
            console.error("Error logging file:", err);
            alert("Failed to log file");
        }
    };

    const handleDecision = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!app) return;

        try {
            if (decisionType === "sanctioned") {
                const sanctionVal = parseFloat(sanctionAmount) || app.amount;
                const roiBaseVal = parseFloat(roiBase) || parseFloat(sanctionedInterestRate) || 9.5;
                const roiEffectiveVal = parseFloat(roiEffective) || roiBaseVal;
                await bankApi.submitDecision({
                    applicationId: app.id,
                    decisionType: "sanction",
                    details: {
                        sanctionAmount: sanctionVal,
                        interestRate: roiEffectiveVal,
                        roiType: roiType,
                        tenure: 120,
                        remarks: `Sanctioned with ROI: ${roiEffectiveVal}%`
                    }
                });
            } else if (decisionType === "rejected") {
                await bankApi.submitDecision({
                    applicationId: app.id,
                    decisionType: "reject",
                    details: {
                        reason: rejectionReason.trim() || "Policy criteria not met",
                        remarks: rejectionReason.trim()
                    }
                });
            } else if (decisionType === "conditional") {
                await bankApi.conditionalSanction({
                    applicationId: app.id,
                    conditions: [conditions],
                    deadline: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
                    remarks: `Conditional Sanction: ${conditions}`
                });
            }
            setShowDecisionModal(false);
            fetchApplicationData();
        } catch (err) {
            console.error("Decision submission error:", err);
        }
    };

    return (
        <>
            <BankApplicationDetailView
                app={app}
                loading={loading}
                onBack={handleBack}
                onRefresh={fetchApplicationData}
                onOpenLanModal={() => setShowLanModal(true)}
                onOpenDecisionModal={() => setShowDecisionModal(true)}
                aiReview={aiReview}
                remarks={remarks}
                onAddRemark={handleAddRemark}
            />

            {/* LAN Assignment Modal */}
            <AnimatePresence>
                {showLanModal && app && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200"
                        >
                            <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight">Assign Loan Account Number (LAN)</h3>
                            <p className="text-xs text-slate-500 mt-1">Assign an official CBS LAN to register this file in underwriting.</p>
                            <form onSubmit={handleLogFile} className="mt-4 space-y-4">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">LAN Number</label>
                                    <input
                                        type="text"
                                        value={lanNumber}
                                        onChange={(e) => setLanNumber(e.target.value.toUpperCase())}
                                        placeholder="e.g. HDFC-EDU-2026-09876"
                                        className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 bg-[#F8FAFC]"
                                        required
                                    />
                                </div>
                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowLanModal(false)}
                                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-1.5 bg-[#6B21A8] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm"
                                    >
                                        Confirm LAN
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Credit Decision Modal */}
            <AnimatePresence>
                {showDecisionModal && app && (
                    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto"
                        >
                            <h3 className="text-base font-bold text-slate-900 uppercase tracking-tight">Record Underwriting Decision</h3>
                            <p className="text-xs text-slate-500 mt-1">Submit institutional credit decision for {app.firstName} {app.lastName}.</p>
                            <form onSubmit={handleDecision} className="mt-4 space-y-4 text-xs">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Decision Type</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: "sanctioned", label: "Approve (Sanction)" },
                                            { id: "conditional", label: "Conditional Offer" },
                                            { id: "counter", label: "Counter Offer" },
                                            { id: "rejected", label: "Reject File" },
                                        ].map((t) => (
                                            <button
                                                key={t.id}
                                                type="button"
                                                onClick={() => setDecisionType(t.id as any)}
                                                className={`p-2.5 rounded-xl font-bold uppercase tracking-wider text-center border transition-all ${
                                                    decisionType === t.id
                                                        ? "bg-purple-100 text-purple-900 border-purple-300 shadow-2xs"
                                                        : "bg-slate-50 text-slate-600 border-slate-200"
                                                }`}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {decisionType === "sanctioned" && (
                                    <>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Sanction Amount (₹)</label>
                                            <input
                                                type="number"
                                                value={sanctionAmount}
                                                onChange={(e) => setSanctionAmount(e.target.value)}
                                                placeholder={String(app.amount || 4500000)}
                                                className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 bg-[#F8FAFC]"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Effective ROI (% p.a.)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={roiEffective}
                                                onChange={(e) => setRoiEffective(e.target.value)}
                                                placeholder="9.75"
                                                className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 bg-[#F8FAFC]"
                                            />
                                        </div>
                                    </>
                                )}

                                {decisionType === "conditional" && (
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Pre-Sanction Conditions</label>
                                        <textarea
                                            value={conditions}
                                            onChange={(e) => setConditions(e.target.value)}
                                            placeholder="e.g. Valuation report clearance, Original property title deed verification..."
                                            rows={3}
                                            className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-[#F8FAFC]"
                                        />
                                    </div>
                                )}

                                {decisionType === "rejected" && (
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Rejection Reason</label>
                                        <textarea
                                            value={rejectionReason}
                                            onChange={(e) => setRejectionReason(e.target.value)}
                                            placeholder="Detail the credit policy reasons for declining this file..."
                                            rows={3}
                                            className="w-full text-xs p-3 rounded-xl border border-slate-200 bg-[#F8FAFC]"
                                            required
                                        />
                                    </div>
                                )}

                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowDecisionModal(false)}
                                        className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-1.5 bg-[#6B21A8] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm"
                                    >
                                        Submit Decision
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
