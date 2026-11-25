"use client";

import { useUserDossier } from "../DossierContext";
import { EVVTestAgent } from "@/components/staff/EVVTestAgent";
import { motion } from "framer-motion";
import { type EVVResult } from "@/lib/evv-parser";
import { adminApi } from "@/lib/api";

export default function EvvTab() {
    const { userId, userApplications, userDocuments, refreshData } = useUserDossier();
    
    // Bind it to the first active application
    const activeApp = userApplications && userApplications.length > 0 ? userApplications[0] : null;

    const handleEVVComplete = async (result: EVVResult) => {
        if (!activeApp) return;
        try {
            const isBlockedOrManualReview = Boolean(result.isScoreBlocked || result.requiresManualReview || result.statusBand !== "Green");
            const payload = {
                evvOverall: isBlockedOrManualReview ? 0 : result.overallEVV,
                evvStatus: isBlockedOrManualReview ? "NEEDS_MANUAL_REVIEW" : "COMPUTED",
                evvMonthlyBreakdown: result.monthlyMetrics.map(m => ({
                    label: m.label,
                    points: m.points,
                    averageBalance: m.avg,
                    min: m.min,
                    max: m.max,
                    evv: m.avg
                }))
            };
            await adminApi.updateApplication(activeApp.id || activeApp._id, payload);
            console.log("EVV Analysis Complete and stored on DB:", result);
            await refreshData();
        } catch (err) {
            console.error("Failed to save EVV analysis to DB:", err);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
        >
            {activeApp ? (
                // EVV Test Agent - S3 Vault & AI Processing
                <EVVTestAgent
                    userId={userId}
                    applicationId={activeApp?.id || activeApp?._id}
                    application={activeApp}
                    userDocuments={userDocuments}
                    onComplete={handleEVVComplete}
                    onRefreshDocs={refreshData}
                />
            ) : (
                // No Application
                <div className="bg-white/40 border border-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-xl p-12 text-center max-w-4xl mx-auto">
                    <span className="material-symbols-outlined text-4xl text-slate-300 mb-3">payments</span>
                    <p className="text-sm font-semibold text-slate-500 font-sans">No applications found. EVV analysis requires an active application file.</p>
                </div>
            )}
        </motion.div>
    );
}
