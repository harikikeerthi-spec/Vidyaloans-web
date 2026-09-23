"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { staffProfileApi, bankApi } from "@/lib/api";

interface ShareProfileToBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  studentDetails: any;
  onSuccess: (result: any) => void;
}

interface Bank {
  id: string;
  name: string;
  email: string;
  contact?: string;
  city?: string;
}

const ShareProfileToBankModal = ({
  isOpen,
  onClose,
  profile,
  studentDetails,
  onSuccess,
}: ShareProfileToBankModalProps) => {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  // Load available banks
  useEffect(() => {
    if (isOpen) {
      loadBanks();
    }
  }, [isOpen]);

  const loadBanks = async () => {
    setLoadingBanks(true);
    try {
      // Fetch banks from backend
      const res: any = await bankApi.getLoanProducts();
      const products = Array.isArray(res) ? res : res?.data || [];
      
      // Format banks list
      const banksList: Bank[] = products
        .map((product: any) => ({
          id: product.id || product.bankId,
          name: product.bankName || product.name,
          email: product.bankEmail || product.email || "",
          contact: product.contact,
          city: product.city,
        }))
        .filter((b: Bank) => b.name && b.email);

      // Remove duplicates
      const uniqueBanks = Array.from(
        new Map(banksList.map((b) => [b.email, b])).values()
      );

      setBanks(uniqueBanks);
    } catch (err) {
      console.error("Failed to load banks:", err);
      // Fallback: use common banks
      setBanks([
        {
          id: "avanse",
          name: "Avanse Financial Services",
          email: "support@avanse.com",
          contact: "+91-1800-123-789",
          city: "Mumbai",
        },
        {
          id: "auxilo",
          name: "Auxilo Finserve",
          email: "support@auxilo.com",
          contact: "+91-1800-123-456",
          city: "Mumbai",
        },
        {
          id: "poonawalla",
          name: "Poonawalla Fincorp",
          email: "contact@poonawallafincorp.com",
          contact: "+91-1800-266-3201",
          city: "Pune",
        },
        {
          id: "idfc",
          name: "IDFC FIRST Bank",
          email: "banker@idfcfirstbank.com",
          contact: "+91-1800-419-4332",
          city: "Mumbai",
        },
        {
          id: "credila",
          name: "HDFC Credila",
          email: "loan@hdfccredila.com",
          contact: "+91-1800-209-3636",
          city: "Mumbai",
        },
      ]);
    } finally {
      setLoadingBanks(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBank) {
      setStatus("error");
      setMessage("Please select a bank");
      return;
    }

    setSubmitting(true);
    setStatus("idle");
    setMessage("");

    try {
      const result: any = await staffProfileApi.shareProfile(profile.linkedUserId, {
        recipientType: "bank",
        recipientName: selectedBank.name,
        recipientEmail: selectedBank.email,
        studentDetails: studentDetails,
        sharedBy: "staff",
      });

      // Log activity
      await staffProfileApi.logActivity({
        type: "share",
        msg: `Shared complete profile for ${profile.linkedUser?.firstName} ${profile.linkedUser?.lastName} with ${selectedBank.name}`,
        icon: "send",
        color: "text-indigo-600 bg-indigo-50",
      }).catch(console.error);

      setStatus("success");
      setMessage(
        `✓ Profile successfully shared with ${selectedBank.name}! They will receive the complete application bundle.`
      );

      setTimeout(() => {
        onSuccess(result);
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error("Failed to share profile:", err);
      setStatus("error");
      setMessage(err.message || "Failed to share profile with bank");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[20px]">send</span>
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">Share Profile to Bank</h3>
              <p className="text-[11px] font-medium text-indigo-100 mt-0.5">Complete onboarding verification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Applicant Info Summary */}
          <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
              Applicant Information
            </h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-slate-600">Name:</span>
                <span className="text-[12px] font-bold text-slate-900">
                  {profile.linkedUser?.firstName} {profile.linkedUser?.lastName}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-slate-600">Email:</span>
                <span className="text-[12px] font-bold text-slate-900 truncate">
                  {profile.linkedUser?.email}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[12px] text-slate-600">Loan Type:</span>
                <span className="text-[12px] font-bold text-slate-900">
                  {profile.loanType || "Education Loan"}
                </span>
              </div>
              {studentDetails?.loanAmount && (
                <div className="flex justify-between items-center">
                  <span className="text-[12px] text-slate-600">Loan Amount:</span>
                  <span className="text-[12px] font-bold text-slate-900">
                    ₹{parseFloat(studentDetails.loanAmount).toLocaleString("en-IN")}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* What Will Be Shared */}
          <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
            <h4 className="text-[11px] font-black uppercase tracking-widest text-emerald-700 mb-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                What Will Be Shared
              </span>
            </h4>
            <ul className="space-y-2">
              <li className="text-[12px] text-emerald-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                Complete student profile with KYC details
              </li>
              <li className="text-[12px] text-emerald-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                All uploaded documents and certifications
              </li>
              <li className="text-[12px] text-emerald-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                Academic and employment verification
              </li>
              <li className="text-[12px] text-emerald-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                Financial information and family details
              </li>
            </ul>
          </div>

          {/* Bank Selection */}
          <div>
            <label className="text-[12px] font-black uppercase tracking-widest text-slate-600 block mb-3">
              Select Partner Bank <span className="text-red-500">*</span>
            </label>

            {loadingBanks ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {banks.map((bank) => (
                  <button
                    key={bank.id}
                    onClick={() => setSelectedBank(bank)}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                      selectedBank?.id === bank.id
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[13px] text-slate-900">{bank.name}</span>
                      {selectedBank?.id === bank.id && (
                        <span className="material-symbols-outlined text-indigo-600 text-[18px]">
                          check_circle
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">{bank.email}</p>
                    {bank.city && (
                      <p className="text-[10px] text-slate-400 mt-1">📍 {bank.city}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status Messages */}
          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-50 border border-emerald-200 rounded-lg p-4"
            >
              <p className="text-[12px] font-bold text-emerald-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                {message}
              </p>
            </motion.div>
          )}

          {status === "error" && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-50 border border-rose-200 rounded-lg p-4"
            >
              <p className="text-[12px] font-bold text-rose-700 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                {message}
              </p>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg text-[12px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !selectedBank || status === "success"}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-[12px] font-bold uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Sharing...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">send</span>
                Share Profile
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ShareProfileToBankModal;
