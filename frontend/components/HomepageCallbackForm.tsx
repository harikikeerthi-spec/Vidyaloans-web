"use client";

import React, { useState } from "react";
import { universityApi } from "@/lib/api";

const INTAKE_OPTIONS = (() => {
  const cy = new Date().getFullYear();
  return [
    `Fall ${cy}`,
    `Spring ${cy + 1}`,
    `Fall ${cy + 1}`,
    `Spring ${cy + 2}`,
    "Immediate / Ongoing",
  ];
})();

export default function HomepageCallbackForm() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    intake: INTAKE_OPTIONS[0],
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = formData.name.trim();
    const cleanPhone = formData.phone.replace(/\D/g, "");

    if (!cleanName || cleanName.length < 2) {
      setError("Please enter your full name");
      return;
    }

    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setSubmitting(true);
    try {
      await universityApi.submitInquiry({
        name: cleanName,
        phone: cleanPhone,
        mobile: cleanPhone,
        intake: formData.intake,
        universityName: `Target Intake: ${formData.intake}`,
        type: "callback",
      });
      setSubmitted(true);
    } catch (err: any) {
      console.error("Failed to submit callback enquiry:", err);
      // Fallback direct POST to API
      try {
        const res = await fetch("/api/university-inquiry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: cleanName,
            phone: cleanPhone,
            mobile: cleanPhone,
            intake: formData.intake,
            universityName: `Target Intake: ${formData.intake}`,
            type: "callback",
          }),
        });
        if (res.ok) {
          setSubmitted(true);
          return;
        }
      } catch (fallbackErr) {
        // ignore
      }
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="relative overflow-hidden bg-white/90 backdrop-blur-xl border border-emerald-200/80 rounded-3xl p-8 md:p-10 shadow-2xl text-center animate-fade-in">
        <div className="w-16 h-16 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-emerald-500/25">
          <span className="material-symbols-outlined text-3xl font-black">check_circle</span>
        </div>
        <h3 className="text-2xl font-black text-gray-900 tracking-tight mb-2">
          Call Back Requested!
        </h3>
        <p className="text-sm text-gray-600 max-w-md mx-auto mb-6 leading-relaxed">
          Thanks <strong className="text-gray-900">{formData.name}</strong>. Our senior education loan counselor will reach you at{" "}
          <span className="font-mono font-bold text-[#6605c7]">+91 {formData.phone.slice(-10)}</span> within 15 minutes for your{" "}
          <span className="font-bold text-gray-800">{formData.intake}</span> intake.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          Enquiry logged directly in Live CRM
        </div>
        <div>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setFormData({ name: "", phone: "", intake: INTAKE_OPTIONS[0] });
            }}
            className="text-xs uppercase tracking-wider font-extrabold text-[#6605c7] hover:underline"
          >
            Submit Another Enquiry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-white/80 backdrop-blur-2xl border border-purple-200/70 rounded-3xl p-6 md:p-8 shadow-[0_20px_50px_rgba(102,5,199,0.12)]">
      {/* Decorative gradient glow */}
      <div className="absolute -top-24 -right-24 w-56 h-56 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6 relative z-10 pb-5 border-b border-gray-100">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6605c7]/10 text-[#6605c7] text-[10px] font-black uppercase tracking-widest mb-2 border border-[#6605c7]/20">
            <span className="material-symbols-outlined text-[13px] text-[#6605c7]">ring_volume</span>
            Quick Enquiry • Zero Hassle
          </div>
          <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
            Get a Call Back from a Loan Expert
          </h2>
          <p className="text-xs text-gray-500 font-medium mt-0.5">
            Skip the paperwork and login — talk directly to our loan advisors within 15 minutes.
          </p>
        </div>
        <div className="hidden lg:flex items-center gap-4 text-xs font-bold text-gray-500">
          <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl">
            <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
            100% Free
          </div>
          <div className="flex items-center gap-1.5 text-purple-700 bg-purple-50 border border-purple-200/80 px-3 py-1.5 rounded-xl">
            <span className="material-symbols-outlined text-sm text-[#6605c7]">speed</span>
            15-Min Response
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="relative z-10 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Field 1: Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="callback-name"
              className="text-[11px] font-black uppercase tracking-wider text-gray-700 flex items-center gap-1"
            >
              Full Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-lg pointer-events-none">
                person
              </span>
              <input
                id="callback-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Priya Sharma"
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 hover:border-gray-300 focus:border-[#6605c7] focus:ring-4 focus:ring-purple-100 rounded-2xl text-xs md:text-sm font-bold text-gray-900 placeholder:text-gray-400 outline-none transition-all shadow-xs"
              />
            </div>
          </div>

          {/* Field 2: Phone */}
          <div className="space-y-1.5">
            <label
              htmlFor="callback-phone"
              className="text-[11px] font-black uppercase tracking-wider text-gray-700 flex items-center gap-1"
            >
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none select-none text-xs font-bold text-gray-600">
                <span>🇮🇳</span>
                <span>+91</span>
              </div>
              <input
                id="callback-phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                maxLength={10}
                value={formData.phone}
                onChange={(e) =>
                  setFormData((p) => ({
                    ...p,
                    phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                  }))
                }
                placeholder="98765 43210"
                className="w-full pl-16 pr-4 py-3 bg-white border border-gray-200 hover:border-gray-300 focus:border-[#6605c7] focus:ring-4 focus:ring-purple-100 rounded-2xl text-xs md:text-sm font-bold text-gray-900 placeholder:text-gray-400 outline-none transition-all shadow-xs font-mono"
              />
            </div>
          </div>

          {/* Field 3: Intake */}
          <div className="space-y-1.5">
            <label
              htmlFor="callback-intake"
              className="text-[11px] font-black uppercase tracking-wider text-gray-700 flex items-center gap-1"
            >
              Target Intake <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="material-symbols-outlined text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 text-lg pointer-events-none">
                calendar_month
              </span>
              <select
                id="callback-intake"
                name="intake"
                required
                value={formData.intake}
                onChange={(e) => setFormData((p) => ({ ...p, intake: e.target.value }))}
                className="w-full pl-10 pr-9 py-3 bg-white border border-gray-200 hover:border-gray-300 focus:border-[#6605c7] focus:ring-4 focus:ring-purple-100 rounded-2xl text-xs md:text-sm font-bold text-gray-900 outline-none transition-all appearance-none cursor-pointer shadow-xs"
              >
                {INTAKE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 text-lg pointer-events-none">
                expand_more
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-bold flex items-center gap-2 animate-fade-in">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
            <span className="material-symbols-outlined text-sm text-emerald-600">lock</span>
            <span>Your details are 100% confidential. No spam guaranteed.</span>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-[#6605c7] to-[#8b24e5] hover:brightness-110 active:scale-95 text-white text-xs uppercase tracking-widest font-black rounded-2xl shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <span>Get a Call Back</span>
                <span className="material-symbols-outlined text-base">call_made</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
