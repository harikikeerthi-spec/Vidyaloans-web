"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi, apiFetch } from "@/lib/api";
import { BankWorkflowAPI } from "@/lib/bank-workflow-api";
import { useAuth } from "@/contexts/AuthContext";

interface ShareWithBankModalProps {
  applicationId: string;
  applicationNumber: string;
  studentName: string;
  loanAmount: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  isMultiBank?: boolean;
  targetBank?: string;
}

// Bank names must exactly match the key→name map in BankNotificationsPanel.isNotificationForThisBank
// so that per-bank notification filtering works correctly.
const BANKS = [
  { id: "auxilo", name: "Auxilo Finserve" },
  { id: "avanse", name: "Avanse Financial" },
  { id: "credila", name: "HDFC Credila" },
  { id: "idfc", name: "IDFC FIRST Bank" },
  { id: "poonawalla", name: "Poonawalla Fincorp" },
];

export default function ShareWithBankModal({
  applicationId,
  applicationNumber,
  studentName,
  loanAmount,
  isOpen,
  onClose,
  onSuccess,
  isMultiBank = false,
  targetBank = "",
}: ShareWithBankModalProps) {
  const { user } = useAuth();
  const [selectedBank, setSelectedBank] = useState("");
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submissionId, setSubmissionId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [priorities, setPriorities] = useState<{ priority: number; bankName: string }[]>([]);

  const targetBankStr = targetBank || "";
  const targetBanksList = targetBankStr && 
    targetBankStr.toLowerCase().replace(/\s+/g, '') !== 'anybank' &&
    targetBankStr.toLowerCase().replace(/\s+/g, '') !== 'pendingpartner'
    ? targetBankStr.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  const filteredBanks = targetBanksList.length > 0
    ? BANKS.filter(bank =>
      targetBanksList.some((name: string) =>
        name.includes(bank.id) ||
        bank.name.toLowerCase().includes(name) ||
        name.includes(bank.name.toLowerCase())
      )
    )
    : BANKS;

  const selectedBankName = BANKS.find((b) => b.id === selectedBank)?.name || "";

  // Fetch priorities and preselect top 3 active ones
  React.useEffect(() => {
    if (isOpen && isMultiBank) {
      const fetchPriorities = async () => {
        try {
          const res = await apiFetch("/api/bank/workflow/priorities") as any;
          if (res?.success && res.data) {
            const activePriorities = res.data.filter((p: any) => p.status === 'Active');
            setPriorities(activePriorities);

            const top3BankNames = activePriorities.slice(0, 3).map((p: any) => p.bankName.toLowerCase());
            const preselectedIds: string[] = [];

            BANKS.forEach(bank => {
              const matches = top3BankNames.some((name: string) =>
                name.includes(bank.id) ||
                bank.name.toLowerCase().includes(name) ||
                name.includes(bank.name.toLowerCase())
              );
              if (matches) {
                preselectedIds.push(bank.id);
              }
            });
            setSelectedBanks(preselectedIds);
          }
        } catch (err) {
          console.error("Failed to fetch bank priorities:", err);
        }
      };
      fetchPriorities();
    }
  }, [isOpen, isMultiBank]);

  const handleShare = useCallback(async () => {
    if (isMultiBank && selectedBanks.length === 0) {
      setError("Please select at least one bank");
      return;
    }
    if (!isMultiBank && !selectedBank) {
      setError("Please select a bank");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const staffName = user
        ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email
        : "Staff";

      if (isMultiBank) {
        const selectedBanksList = BANKS.filter(b => selectedBanks.includes(b.id)).map(b => ({
          bankId: b.id,
          bankName: b.name
        }));

        const res: any = await apiFetch("/api/bank/workflow/submit-multiple", {
          method: "POST",
          body: JSON.stringify({
            applicationId,
            banks: selectedBanksList,
            submittedBy: staffName
          })
        });

        if (res?.submissions?.[0]?.id) {
          setSubmissionId(res.submissions[0].id);
        } else {
          setSubmissionId(`MULT-${applicationId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`);
        }

        // Auto-create chat conversations for each submitted bank in multi-bank mode
        for (const b of selectedBanksList) {
          try {
            await apiFetch("/api/chat/bank-start", {
              method: "POST",
              body: JSON.stringify({
                bankName: b.bankName,
                applicationId,
                applicationNumber,
              }),
            });
          } catch (chatErr) {
            console.warn(`[ShareWithBankModal] Failed to create bank chat for ${b.bankName}:`, chatErr);
          }
        }
      } else {
        // Submit to bank workflow — this creates the BankSubmission record,
        // sets bank, submittedToBankAt, bankWorkflowStatus, status='submitted_to_bank',
        // and generates the VL-APP application number.
        let realSubmissionId = "";
        let workflowRes: any;
        const submitPayload = JSON.stringify({
          applicationId,
          bankId: selectedBank,
          bankName: selectedBankName,
          submittedBy: staffName,
          remarks: remarks || `Application routed to ${selectedBankName}`,
        });

        try {
          workflowRes = await apiFetch("/api/bank/workflow/submit", {
            method: "POST",
            body: submitPayload,
          });
        } catch (e1) {
          try {
            workflowRes = await apiFetch("/api/bank/submit", {
              method: "POST",
              body: submitPayload,
            });
          } catch (e2) {
            workflowRes = await BankWorkflowAPI.submitToBank({
              applicationId,
              bankId: selectedBank,
              bankName: selectedBankName,
              submittedBy: staffName,
            });
          }
        }

        if (workflowRes?.data?.id) {
          realSubmissionId = workflowRes.data.id;
        } else if (workflowRes?.submission?.id) {
          realSubmissionId = workflowRes.submission.id;
        } else if (!workflowRes?.success && workflowRes?.message) {
          throw new Error(workflowRes.message);
        }

        // Store submission reference for the success UI
        const submissionRef =
          realSubmissionId ||
          `SUB-${applicationId.slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
        setSubmissionId(submissionRef);

        // Auto-create a bank chat conversation so it shows in staff BANKS tab
        try {
          await apiFetch("/api/chat/bank-start", {
            method: "POST",
            body: JSON.stringify({
              bankName: selectedBankName,
              applicationId,
              applicationNumber,
            }),
          });
        } catch (chatErr) {
          // Non-fatal: chat creation failure should not block the submission success
          console.warn("[ShareWithBankModal] Failed to create bank chat conversation:", chatErr);
        }
      }

      setSuccess(true);

      // Auto-close after 2.5 seconds and notify parent
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 2500);
    } catch (err: any) {
      setError(err.message || "An error occurred while sharing application");
    } finally {
      setLoading(false);
    }
  }, [isMultiBank, selectedBanks, selectedBank, selectedBankName, applicationId, remarks, onClose, onSuccess, user]);

  // Reset state when modal opens/closes
  const handleClose = () => {
    if (!loading) {
      setSelectedBank("");
      setSelectedBanks([]);
      setError("");
      setSuccess(false);
      setSubmissionId("");
      setRemarks("");
      onClose();
    }
  };

  const studentInitials = (studentName || 'Student')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
          >
            {/* LEFT PANE: The "Dossier" (Brand Violet Background) */}
            <div className="w-full md:w-1/3 bg-[#6605c7] p-8 flex flex-col justify-between border-r border-[#5204a1] text-white shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-8">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs">
                    {studentInitials}
                  </div>
                  <span className="text-purple-100 text-xs font-semibold tracking-wider uppercase">Student Profile</span>
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-2 leading-tight">{studentName}</h2>
                <p className="text-purple-200 text-xs mb-8">Application #{applicationNumber}</p>
                
                <div className="bg-white/10 rounded-xl p-5 border border-white/20">
                  <p className="text-[10px] font-semibold text-purple-200 tracking-wider mb-1 uppercase">Requested Loan</p>
                  <p className="text-2xl font-extrabold text-white">₹{(loanAmount || 0).toLocaleString("en-IN")}</p>
                </div>
              </div>
              
              <div className="mt-8 text-purple-300 text-[10px] font-medium tracking-wide flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                Secure Bank Transfer Protocol
              </div>
            </div>

            {/* RIGHT PANE: Interactive Actions */}
            <div className="w-full md:w-2/3 flex flex-col min-h-[400px] md:h-auto bg-white relative">
                
                {/* Close Button */}
                {!success && (
                  <button
                    onClick={handleClose}
                    className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 transition-colors border-0 bg-transparent cursor-pointer z-10 flex items-center justify-center w-8 h-8 rounded-full hover:bg-slate-100"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                )}

                {/* Scrollable content area */}
                <div className="p-8 pb-28 overflow-y-auto flex-1 max-h-[calc(90vh-10px)]">
                  {!success ? (
                    <>
                      <h3 className="text-base font-bold text-slate-800 mb-6">Select Bank Partners</h3>
                      
                      {/* Bank Grid */}
                      <div className="mb-8">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                          Select {isMultiBank ? "Target Banks" : "Bank"}
                        </label>

                        {isMultiBank ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {filteredBanks.map((bank) => {
                              const isChecked = selectedBanks.includes(bank.id);
                              return (
                                <button
                                  key={bank.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedBanks(prev => {
                                      if (prev.includes(bank.id)) {
                                        return prev.filter(id => id !== bank.id);
                                      } else {
                                        if (prev.length >= 3) {
                                          alert("You can select a maximum of 3 target banks.");
                                          return prev;
                                        }
                                        return [...prev, bank.id];
                                      }
                                    });
                                  }}
                                  className={`p-4 border-2 rounded-xl flex items-center gap-3 relative select-none cursor-pointer duration-200 transition-all ${isChecked
                                    ? "border-[#6605c7] bg-purple-50/50 text-[#6605c7] shadow-sm"
                                    : "border-slate-100 bg-white text-slate-600 hover:border-purple-300"
                                    }`}
                                >
                                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-bold text-xs transition-colors duration-200 ${isChecked ? "bg-purple-200 text-[#6605c7]" : "bg-slate-100 text-slate-500"}`}>
                                    {bank.name.charAt(0)}
                                  </div>
                                  <span className="font-semibold text-xs text-left truncate flex-1 pr-6">{bank.name}</span>
                                  <div className="absolute right-4">
                                    {isChecked ? (
                                      <span className="material-symbols-outlined text-[18px] text-[#6605c7]">check_circle</span>
                                    ) : (
                                      <span className="w-4 h-4 rounded-full border border-slate-300 bg-white shrink-0 block" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {filteredBanks.map((bank) => {
                              const isChecked = selectedBank === bank.id;
                              return (
                                <button
                                  key={bank.id}
                                  type="button"
                                  onClick={() => setSelectedBank(bank.id)}
                                  className={`p-4 border-2 rounded-xl flex items-center gap-3 relative select-none cursor-pointer duration-200 transition-all ${isChecked
                                    ? "border-[#6605c7] bg-purple-50/50 text-[#6605c7] shadow-sm"
                                    : "border-slate-100 bg-white text-slate-600 hover:border-purple-300"
                                    }`}
                                >
                                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center font-bold text-xs transition-colors duration-200 ${isChecked ? "bg-purple-200 text-[#6605c7]" : "bg-slate-100 text-slate-500"}`}>
                                    {bank.name.charAt(0)}
                                  </div>
                                  <span className="font-semibold text-xs text-left truncate flex-1">{bank.name}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Remarks Input */}
                      <div>
                        <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">Submission Remarks</h3>
                        <textarea
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="Add internal remarks about document verification or routing details..."
                          className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#6605c7] focus:border-[#6605c7] outline-none transition-all resize-none text-slate-700 placeholder-slate-400 text-xs font-medium focus:ring-offset-2"
                          rows={3}
                        />
                      </div>

                      {/* Error Message */}
                      {error && (
                        <motion.div
                          className="p-3 bg-red-50 border border-red-200 rounded-lg mt-4"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <p className="text-xs text-red-700 font-bold">{error}</p>
                        </motion.div>
                      )}
                    </>
                  ) : (
                    // Success State
                    <motion.div
                      className="text-center py-12"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <motion.div
                        className="w-16 h-16 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl"
                        style={{ background: "linear-gradient(135deg, rgba(102,5,199,0.1), rgba(139,36,229,0.15))" }}
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.5 }}
                      >
                        <span className="material-symbols-outlined text-4xl" style={{ color: "#6605c7" }}>
                          verified
                        </span>
                      </motion.div>
                      <h3 className="text-lg font-black text-slate-900 mb-2">
                        Application Sent!
                      </h3>
                      <p className="text-sm text-slate-600 mb-4">
                        Application has been successfully sent to{" "}
                        <span className="font-bold" style={{ color: "#6605c7" }}>
                          {isMultiBank ? `${selectedBanks.length} partner banks` : selectedBankName}
                        </span>.
                      </p>
                      <div className="bg-purple-50 rounded-xl p-3 border border-purple-100 max-w-sm mx-auto">
                        <p className="text-xs text-purple-700 font-semibold flex items-center justify-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px]">notifications_active</span>
                          The bank portals have been updated in real-time.
                        </p>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-3">
                        Submission Ref: <span className="font-bold">{submissionId}</span>
                      </p>
                    </motion.div>
                  )}
                </div>

                {/* Fixed Footer for Actions */}
                {!success && (
                  <div className="absolute bottom-0 left-0 right-0 px-8 py-5 bg-white/95 backdrop-blur-md border-t border-slate-100 flex justify-end items-center gap-4 z-10">
                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={loading}
                      className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors border-0 bg-transparent cursor-pointer disabled:opacity-50"
                    >
                      CANCEL
                    </button>
                    <button
                      type="button"
                      onClick={handleShare}
                      disabled={(isMultiBank ? selectedBanks.length === 0 : !selectedBank) || loading}
                      className="px-8 py-2.5 text-sm font-semibold text-white bg-[#6605c7] hover:bg-[#5204a1] rounded-lg shadow-lg shadow-[#6605c7]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {loading ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          SENDING...
                        </>
                      ) : (
                        <>
                          {isMultiBank ? "ROUTE APPLICATION" : "SEND TO BANK"}
                          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

