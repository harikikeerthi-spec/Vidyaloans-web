"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";

type FormStep = 1 | 2 | 3 | 4 | 5 | 6;

interface RegistrationData {
  name: string;
  email: string;
  phone: string;
  admissionStatus: string;
  loanStatus: string;
  country: string;
  location: string;
  amount: string;
  source: string;
  blogTitle?: string;
  blogSlug?: string;
}

function RegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<FormStep>(1);
  const [formData, setFormData] = useState<RegistrationData>({
    name: "",
    email: "",
    phone: "",
    admissionStatus: "",
    loanStatus: "",
    country: "",
    location: "",
    amount: "₹25L - ₹50L",
    source: "registration_page",
  });

  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedLead, setSubmittedLead] = useState<RegistrationData | null>(null);

  // Pre-fill query parameters if navigated from a specific blog or campaign
  useEffect(() => {
    const qCountry = searchParams.get("country");
    const qAmount = searchParams.get("amount");
    const qSource = searchParams.get("source") || "registration_page";
    const qBlogTitle = searchParams.get("blogTitle");
    const qBlogSlug = searchParams.get("blogSlug");

    setFormData((prev) => ({
      ...prev,
      country: qCountry || prev.country,
      amount: qAmount || prev.amount,
      source: qSource,
      blogTitle: qBlogTitle || prev.blogTitle,
      blogSlug: qBlogSlug || prev.blogSlug,
    }));
  }, [searchParams]);

  const updateField = (key: keyof RegistrationData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrorMsg("");
  };

  // Step 1 Validation & Next
  const handleStep1Next = () => {
    const name = formData.name.trim();
    const email = formData.email.trim();
    const phone = formData.phone.trim().replace(/\D/g, "");

    if (!name) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (!phone || phone.length < 10) {
      setErrorMsg("Please enter a valid 10-digit mobile or WhatsApp number.");
      return;
    }

    setErrorMsg("");
    setStep(2);
  };

  // Tap-to-advance step handlers
  const handleAdmissionSelect = (val: string) => {
    updateField("admissionStatus", val);
    setTimeout(() => setStep(3), 160);
  };

  const handleLoanSelect = (val: string) => {
    updateField("loanStatus", val);
    setTimeout(() => setStep(4), 160);
  };

  const handleCountrySelect = (val: string) => {
    updateField("country", val);
    setTimeout(() => setStep(5), 160);
  };

  // Step 5 Submit handler -> Persists to PostgreSQL DB
  const handleSubmitFinal = async () => {
    const loc = formData.location.trim();
    if (!loc || loc.length < 2) {
      setErrorMsg("Please enter your current city or state.");
      return;
    }

    setErrorMsg("");
    setIsSubmitting(true);

    try {
      const payload = {
        name: formData.name.trim(),
        fullName: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        mobile: formData.phone.trim(),
        country: formData.country || "Study Abroad",
        targetCountry: formData.country,
        amount: formData.amount || "Not Specified",
        loanAmount: formData.amount,
        targetCourse: [
          formData.admissionStatus ? `Admission: ${formData.admissionStatus}` : "",
          formData.loanStatus ? `Loan Status: ${formData.loanStatus}` : "",
          loc ? `City: ${loc}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
        university: loc ? `City: ${loc}` : undefined,
        blogTitle: formData.blogTitle || "VidyaLoans Direct Registration",
        blogSlug: formData.blogSlug || "/registration",
        source: formData.source || "registration_page",
        details: {
          admissionStatus: formData.admissionStatus,
          loanStatus: formData.loanStatus,
          location: loc,
          loanAmount: formData.amount,
          submittedAt: new Date().toISOString(),
        },
      };

      const res = await fetch("/api/blogs/inquiry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok && !json?.success) {
        throw new Error(json?.message || "Failed to submit registration. Please check your network and try again.");
      }

      setSubmittedLead({ ...formData });
      setStep(6);
    } catch (err: any) {
      console.error("Registration error:", err);
      setErrorMsg(err.message || "Failed to submit registration. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const progressPercentage = step >= 6 ? 100 : ((step - 1) / 5) * 100 + 10;

  return (
    <div className="min-h-screen bg-transparent text-slate-900 flex flex-col justify-between relative selection:bg-purple-100 selection:text-purple-900">
      
      {/* Signature Main Page Background Structure */}
      <div className="fixed inset-0 -z-10 bg-white pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(at_0%_0%,rgba(102,5,199,0.4)_0px,transparent_50%),radial-gradient(at_100%_0%,rgba(224,195,137,0.5)_0px,transparent_50%),radial-gradient(at_100%_100%,rgba(139,192,232,0.4)_0px,transparent_50%),radial-gradient(at_0%_100%,rgba(102,5,199,0.3)_0px,transparent_50%)] opacity-90" />
        <div
          className="absolute inset-0 opacity-30 mix-blend-overlay"
          style={{
            backgroundImage:
              'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCSQJcRexkqlKu3kzwZCWIGdx9mSdhvK4Je6lxA9kVrWHQFg-ShCu6j3XLipgBh0waP45VYm3rBVD2Psy-FTMp2qLU946EXQwD2sIGZJLe5tw2ugWPYnnOTMWoTGM95X4u1epiDmYaEV_vVdH7tyv2ZlDuFjSMZlzWulHW3UyesMipUWi30MryHEiz-_Lje83ApXK-FpMUQdIEWe0M_ZFfiu3BcH1_opus8b5qOTiMh8tMBAX7ifzSLR_qpWnWtdB8obUzknDxLtfeP")',
            backgroundSize: "cover",
          }}
        />
        {/* Subtle ambient depth glows */}
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-b from-purple-300/30 via-indigo-200/20 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-[-10%] w-[420px] h-[420px] bg-purple-300/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[420px] h-[420px] bg-indigo-300/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-20 w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group cursor-pointer transition-transform hover:scale-[1.01]">
          <Image
            src="/images/vidyaloans-logo-transparent.png"
            alt="VidyaLoans"
            width={38}
            height={38}
            className="w-9 h-9 object-contain drop-shadow-sm"
            priority
          />
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight text-[#1a1626]">
              VidyaLoans
            </span>
            <span className="text-[10px] font-semibold text-purple-700 tracking-wider uppercase -mt-1">
              Education Financing
            </span>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <a
            href="tel:+918143797779"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-[#6605c7] transition-colors bg-white/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/60 shadow-xs"
          >
            <span className="material-symbols-outlined text-sm text-[#6605c7]">call</span>
            <span>+91 8143797779</span>
          </a>

          <Link
            href="/"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 bg-white/80 hover:bg-white backdrop-blur-md border border-white/80 shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 w-full max-w-xl mx-auto px-4 sm:px-6 my-auto py-4">
        <div className="bg-white/92 backdrop-blur-xl rounded-3xl shadow-[0_20px_60px_rgba(102,5,199,0.09)] border border-white/80 overflow-hidden transition-all duration-300">
          
          {/* Progress Bar Line */}
          <div className="h-1.5 w-full bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-[#6605c7] via-[#8b5cf6] to-[#6605c7] transition-all duration-300 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>

          <div className="p-6 sm:p-9">
            {/* Step Counter Indicator */}
            {step < 6 && (
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">
                <span className="text-[#6605c7] font-extrabold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#6605c7] animate-pulse" />
                  Step {step} of 5
                </span>
                <span>{Math.round(progressPercentage)}% completed</span>
              </div>
            )}

            {/* Error Message Alert */}
            {errorMsg && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-base shrink-0">error</span>
                <span className="flex-1">{errorMsg}</span>
              </div>
            )}

            {/* ==================== STEP 1 ==================== */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-[#1a1626] tracking-tight">
                    Let's get started
                  </h2>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Provide your contact details so our dedicated education loan counsellor can guide you through the lowest interest rates.
                  </p>
                </div>

                <div className="space-y-3.5 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleStep1Next()}
                      placeholder="Enter student full name"
                      autoFocus
                      className="w-full px-4 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#6605c7] focus:bg-white focus:ring-2 focus:ring-purple-100 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleStep1Next()}
                      placeholder="student@example.com"
                      className="w-full px-4 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#6605c7] focus:bg-white focus:ring-2 focus:ring-purple-100 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Mobile / WhatsApp Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                        +91
                      </span>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleStep1Next()}
                        placeholder="98765 43210"
                        maxLength={15}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#6605c7] focus:bg-white focus:ring-2 focus:ring-purple-100 transition-all"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStep1Next}
                  className="w-full mt-3 py-3.5 px-5 bg-gradient-to-r from-[#6605c7] to-[#7c3aed] hover:from-[#5804ad] hover:to-[#6d28d9] text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Continue</span>
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              </div>
            )}

            {/* ==================== STEP 2 ==================== */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-[#1a1626] tracking-tight">
                    Admission Status
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Select your current progress in university shortlisting and admissions.
                  </p>
                </div>

                <div className="space-y-2.5 pt-1">
                  {[
                    {
                      title: "Confirmed Admission / Offer Letter",
                      desc: "Received an official admit letter, I-20, CAS, or provisional university offer.",
                    },
                    {
                      title: "Applied & Awaiting Decisions",
                      desc: "University applications lodged; waiting for admission results and offer letters.",
                    },
                    {
                      title: "Preparing Applications",
                      desc: "Shortlisting target universities, completing tests (GRE/IELTS), and finalizing SOPs.",
                    },
                    {
                      title: "Planning for Upcoming Intake",
                      desc: "Early research stage; exploring universities and course options for future terms.",
                    },
                  ].map((opt) => {
                    const isSelected = formData.admissionStatus === opt.title;
                    return (
                      <button
                        key={opt.title}
                        type="button"
                        onClick={() => handleAdmissionSelect(opt.title)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-purple-50/70 border-[#6605c7] shadow-sm ring-1 ring-[#6605c7]"
                            : "bg-white border-slate-200 hover:bg-slate-50/70 hover:border-purple-200"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm text-[#1a1626]">{opt.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{opt.desc}</div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected ? "border-[#6605c7] bg-[#6605c7]" : "border-slate-300"
                          }`}
                        >
                          {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    <span>Back</span>
                  </button>
                </div>
              </div>
            )}

            {/* ==================== STEP 3 ==================== */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-[#1a1626] tracking-tight">
                    Education Loan Status
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    What is your current education loan requirement or application stage?
                  </p>
                </div>

                <div className="space-y-2.5 pt-1">
                  {[
                    {
                      title: "Looking to Apply for a New Loan",
                      desc: "Compare offers across 15+ partner banks & NBFCs to secure the lowest interest rates.",
                    },
                    {
                      title: "Application Already in Progress",
                      desc: "Already applied with a lender; seeking a faster sanction, lower interest rate, or co-applicant assistance.",
                    },
                    {
                      title: "Facing Delays or Rejection",
                      desc: "Need expert underwriting guidance, collateral restructuring, or non-collateral NBFC solutions.",
                    },
                    {
                      title: "Exploring Eligibility & Options",
                      desc: "Estimating borrow capacity, collateral vs non-collateral criteria, and projected monthly repayments.",
                    },
                  ].map((opt) => {
                    const isSelected = formData.loanStatus === opt.title;
                    return (
                      <button
                        key={opt.title}
                        type="button"
                        onClick={() => handleLoanSelect(opt.title)}
                        className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-purple-50/70 border-[#6605c7] shadow-sm ring-1 ring-[#6605c7]"
                            : "bg-white border-slate-200 hover:bg-slate-50/70 hover:border-purple-200"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm text-[#1a1626]">{opt.title}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{opt.desc}</div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            isSelected ? "border-[#6605c7] bg-[#6605c7]" : "border-slate-300"
                          }`}
                        >
                          {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    <span>Back</span>
                  </button>
                </div>
              </div>
            )}

            {/* ==================== STEP 4 ==================== */}
            {step === 4 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-[#1a1626] tracking-tight">
                    Target Country
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Select your primary destination for academic studies.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {[
                    {
                      name: "USA",
                      flagSvg: (
                        <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
                          <rect width="640" height="480" fill="#b22234" />
                          <path d="M0,37h640M0,111h640M0,185h640M0,259h640M0,333h640M0,407h640" stroke="#fff" strokeWidth="37" />
                          <rect width="256" height="259" fill="#3c3b6e" />
                          <g fill="#fff">
                            <circle cx="28" cy="26" r="6" />
                            <circle cx="70" cy="26" r="6" />
                            <circle cx="112" cy="26" r="6" />
                            <circle cx="154" cy="26" r="6" />
                            <circle cx="196" cy="26" r="6" />
                            <circle cx="238" cy="26" r="6" />
                            <circle cx="49" cy="52" r="6" />
                            <circle cx="91" cy="52" r="6" />
                            <circle cx="133" cy="52" r="6" />
                            <circle cx="175" cy="52" r="6" />
                            <circle cx="217" cy="52" r="6" />
                            <circle cx="28" cy="78" r="6" />
                            <circle cx="70" cy="78" r="6" />
                            <circle cx="112" cy="78" r="6" />
                            <circle cx="154" cy="78" r="6" />
                            <circle cx="196" cy="78" r="6" />
                            <circle cx="238" cy="78" r="6" />
                            <circle cx="49" cy="104" r="6" />
                            <circle cx="91" cy="104" r="6" />
                            <circle cx="133" cy="104" r="6" />
                            <circle cx="175" cy="104" r="6" />
                            <circle cx="217" cy="104" r="6" />
                            <circle cx="28" cy="130" r="6" />
                            <circle cx="70" cy="130" r="6" />
                            <circle cx="112" cy="130" r="6" />
                            <circle cx="154" cy="130" r="6" />
                            <circle cx="196" cy="130" r="6" />
                            <circle cx="238" cy="130" r="6" />
                            <circle cx="49" cy="156" r="6" />
                            <circle cx="91" cy="156" r="6" />
                            <circle cx="133" cy="156" r="6" />
                            <circle cx="175" cy="156" r="6" />
                            <circle cx="217" cy="156" r="6" />
                            <circle cx="28" cy="182" r="6" />
                            <circle cx="70" cy="182" r="6" />
                            <circle cx="112" cy="182" r="6" />
                            <circle cx="154" cy="182" r="6" />
                            <circle cx="196" cy="182" r="6" />
                            <circle cx="238" cy="182" r="6" />
                            <circle cx="49" cy="208" r="6" />
                            <circle cx="91" cy="208" r="6" />
                            <circle cx="133" cy="208" r="6" />
                            <circle cx="175" cy="208" r="6" />
                            <circle cx="217" cy="208" r="6" />
                            <circle cx="28" cy="234" r="6" />
                            <circle cx="70" cy="234" r="6" />
                            <circle cx="112" cy="234" r="6" />
                            <circle cx="154" cy="234" r="6" />
                            <circle cx="196" cy="234" r="6" />
                            <circle cx="238" cy="234" r="6" />
                          </g>
                        </svg>
                      ),
                    },
                    {
                      name: "United Kingdom",
                      flagSvg: (
                        <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
                          <path fill="#012169" d="M0 0h640v480H0z" />
                          <path fill="#fff" d="m75 0 245 180L565 0h75v50L400 240l240 180v60h-75L320 300 75 480H0v-50l240-190L0 60V0z" />
                          <path fill="#C8102E" d="m424 288 216 162v30h-38L378 300zm-208-96L0 30V0h38l224 180zm254-192L230 180h-48L432 0zm-290 480 240-180h48L218 480z" />
                          <path fill="#fff" d="M240 0h160v480H240zM0 160h640v160H0z" />
                          <path fill="#C8102E" d="M266 0h108v480H266zM0 186h640v108H0z" />
                        </svg>
                      ),
                    },
                    {
                      name: "Canada",
                      flagSvg: (
                        <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
                          <rect width="160" height="480" fill="#d52b1e" />
                          <rect x="160" width="320" height="480" fill="#ffffff" />
                          <rect x="480" width="160" height="480" fill="#d52b1e" />
                          <path fill="#d52b1e" d="M320 90l16 46 44-12-18 44 42 16-34 30 18 42-42-12-12 50-14-4-14 4-12-50-42 12 18-42-34-30 42-16-18-44 44 12z" />
                        </svg>
                      ),
                    },
                    {
                      name: "Australia",
                      flagSvg: (
                        <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
                          <rect width="640" height="480" fill="#00008b" />
                          <g transform="scale(0.5)">
                            <path fill="#012169" d="M0 0h640v480H0z" />
                            <path fill="#fff" d="m75 0 245 180L565 0h75v50L400 240l240 180v60h-75L320 300 75 480H0v-50l240-190L0 60V0z" />
                            <path fill="#C8102E" d="m424 288 216 162v30h-38L378 300zm-208-96L0 30V0h38l224 180zm254-192L230 180h-48L432 0zm-290 480 240-180h48L218 480z" />
                            <path fill="#fff" d="M240 0h160v480H240zM0 160h640v160H0z" />
                            <path fill="#C8102E" d="M266 0h108v480H266zM0 186h640v108H0z" />
                          </g>
                          <polygon fill="#fff" points="160,330 168,352 192,348 174,364 184,386 160,372 136,386 146,364 128,348 152,352" />
                          <circle cx="480" cy="120" r="12" fill="#fff" />
                          <circle cx="420" cy="220" r="12" fill="#fff" />
                          <circle cx="540" cy="220" r="12" fill="#fff" />
                          <circle cx="480" cy="340" r="16" fill="#fff" />
                          <circle cx="510" cy="265" r="8" fill="#fff" />
                        </svg>
                      ),
                    },
                    {
                      name: "Germany",
                      flagSvg: (
                        <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
                          <rect width="640" height="160" fill="#000000" />
                          <rect y="160" width="640" height="160" fill="#dd0000" />
                          <rect y="320" width="640" height="160" fill="#ffce00" />
                        </svg>
                      ),
                    },
                    {
                      name: "Ireland",
                      flagSvg: (
                        <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
                          <rect width="213.3" height="480" fill="#169b62" />
                          <rect x="213.3" width="213.4" height="480" fill="#ffffff" />
                          <rect x="426.7" width="213.3" height="480" fill="#ff883e" />
                        </svg>
                      ),
                    },
                    {
                      name: "India",
                      flagSvg: (
                        <svg viewBox="0 0 640 480" className="w-full h-full object-cover">
                          <rect width="640" height="160" fill="#ff9933" />
                          <rect y="160" width="640" height="160" fill="#ffffff" />
                          <rect y="320" width="640" height="160" fill="#128807" />
                          <circle cx="320" cy="240" r="48" fill="none" stroke="#000088" strokeWidth="6" />
                          <circle cx="320" cy="240" r="12" fill="#000088" />
                          <g stroke="#000088" strokeWidth="2.5">
                            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345].map((deg) => (
                              <line
                                key={deg}
                                x1="320"
                                y1="240"
                                x2={320 + 45 * Math.cos((deg * Math.PI) / 180)}
                                y2={240 + 45 * Math.sin((deg * Math.PI) / 180)}
                              />
                            ))}
                          </g>
                        </svg>
                      ),
                    },
                    {
                      name: "Other Countries",
                      flagSvg: (
                        <svg viewBox="0 0 640 480" className="w-full h-full bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600">
                          <circle cx="320" cy="240" r="160" fill="none" stroke="#ffffff" strokeWidth="16" opacity="0.9" />
                          <ellipse cx="320" cy="240" rx="80" ry="160" fill="none" stroke="#ffffff" strokeWidth="14" opacity="0.9" />
                          <line x1="160" y1="240" x2="480" y2="240" stroke="#ffffff" strokeWidth="16" opacity="0.9" />
                          <line x1="185" y1="160" x2="455" y2="160" stroke="#ffffff" strokeWidth="12" opacity="0.8" />
                          <line x1="185" y1="320" x2="455" y2="320" stroke="#ffffff" strokeWidth="12" opacity="0.8" />
                        </svg>
                      ),
                    },
                  ].map((c) => {
                    const isSelected = formData.country === c.name;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => handleCountrySelect(c.name)}
                        className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-purple-50/80 border-[#6605c7] shadow-sm ring-1 ring-[#6605c7]"
                            : "bg-white border-slate-200 hover:bg-slate-50 hover:border-purple-200"
                        }`}
                      >
                        <div className="w-8 h-6 rounded-[5px] shadow-xs border border-slate-200/90 overflow-hidden shrink-0 flex items-center justify-center bg-slate-50">
                          {c.flagSvg}
                        </div>
                        <span className="font-bold text-xs text-[#1a1626] truncate">{c.name}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    <span>Back</span>
                  </button>
                </div>
              </div>
            )}

            {/* ==================== STEP 5 ==================== */}
            {step === 5 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-[#1a1626] tracking-tight">
                    Location & Loan Amount
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Confirm your current city and estimated loan amount required.
                  </p>
                </div>

                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Which location are you in? (City, State) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => updateField("location", e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSubmitFinal()}
                      placeholder="e.g. Hyderabad, Telangana"
                      autoFocus
                      className="w-full px-4 py-3 bg-slate-50/70 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#6605c7] focus:bg-white focus:ring-2 focus:ring-purple-100 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Estimated Loan Amount Required
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {["₹10L - ₹25L", "₹25L - ₹50L", "₹50L - ₹75L", "₹75 Lakhs+"].map((amt) => {
                        const isSelected = formData.amount === amt;
                        return (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => updateField("amount", amt)}
                            className={`py-2.5 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                              isSelected
                                ? "bg-[#6605c7] text-white border-[#6605c7] shadow-sm"
                                : "bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {amt}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="p-3.5 bg-purple-50/50 rounded-2xl border border-purple-100 text-xs text-slate-600 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-500">Target Country:</span>
                      <span className="font-bold text-[#1a1626]">{formData.country || "Not specified"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-500">Admission Stage:</span>
                      <span className="font-bold text-[#1a1626]">{formData.admissionStatus || "Not specified"}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmitFinal}
                  className="w-full mt-3 py-3.5 px-5 bg-gradient-to-r from-[#6605c7] to-[#7c3aed] hover:from-[#5804ad] hover:to-[#6d28d9] text-white font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving Registration...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit & Request Expert Callback</span>
                      <span className="material-symbols-outlined text-base">check_circle</span>
                    </>
                  )}
                </button>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    <span>Back</span>
                  </button>
                </div>
              </div>
            )}

            {/* ==================== STEP 6 (CONFIRMATION) ==================== */}
            {step === 6 && submittedLead && (
              <div className="text-center py-2 space-y-5 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#6605c7] to-[#9333ea] text-white flex items-center justify-center mx-auto text-3xl font-black shadow-xl shadow-purple-600/25">
                  <span className="material-symbols-outlined text-3xl">check</span>
                </div>

                <div>
                  <span className="inline-block px-3 py-1 bg-purple-50 text-[#6605c7] text-[10px] font-black uppercase tracking-wider rounded-full mb-2 border border-purple-200">
                    Registration Saved
                  </span>
                  <h2 className="text-2xl font-black text-[#1a1626] tracking-tight">
                    Thanks, we got your details!
                  </h2>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto mt-2 leading-relaxed">
                    Hi <strong className="text-slate-900">{submittedLead.name}</strong>, your application has been safely stored in our system. A certified VidyaLoans advisor will contact you within <strong className="text-[#6605c7]">15 minutes</strong>.
                  </p>
                </div>

                {/* Lead Summary Capsule */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/90 text-left text-xs space-y-2 max-w-md mx-auto">
                  <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500 font-medium">Contact Number:</span>
                    <span className="font-bold text-[#1a1626]">+91 {submittedLead.phone}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500 font-medium">Target Destination:</span>
                    <span className="font-bold text-[#1a1626]">{submittedLead.country}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200/60 pb-1.5">
                    <span className="text-slate-500 font-medium">Loan Requirement:</span>
                    <span className="font-bold text-[#6605c7]">{submittedLead.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Location:</span>
                    <span className="font-bold text-[#1a1626]">{submittedLead.location}</span>
                  </div>
                </div>

                {/* Quick Action Links */}
                <div className="pt-2 space-y-2.5 max-w-md mx-auto">
                  <Link
                    href="/compare-loans"
                    className="block w-full py-3 bg-gradient-to-r from-[#6605c7] to-[#7c3aed] hover:from-[#5804ad] hover:to-[#6d28d9] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all text-center cursor-pointer"
                  >
                    Compare Lending Partners & Rates
                  </Link>

                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/blog"
                      className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-all text-center cursor-pointer"
                    >
                      Browse Articles
                    </Link>
                    <Link
                      href="/emi"
                      className="py-2.5 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition-all text-center cursor-pointer"
                    >
                      EMI Calculator
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        name: "",
                        email: "",
                        phone: "",
                        admissionStatus: "",
                        loanStatus: "",
                        country: "",
                        location: "",
                        amount: "₹25L - ₹50L",
                        source: "registration_page",
                      });
                      setStep(1);
                    }}
                    className="text-xs text-[#6605c7] hover:text-purple-900 font-bold underline cursor-pointer pt-2 block mx-auto"
                  >
                    + Submit Another Registration
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Trust Footer inside the card */}
          <div className="px-6 py-3.5 bg-slate-50/70 border-t border-slate-100 text-center">
            <p className="text-[11px] text-slate-500 font-medium flex items-center justify-center gap-2">
              <span className="text-[#6605c7]">🔒</span>
              <span>100% Free Service • No CIBIL Impact • Doorstep Support</span>
            </p>
          </div>
        </div>
      </main>

      {/* Simple Clean Footer */}
      <footer className="relative z-20 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} VidyaLoans Inc. All rights reserved.
      </footer>
    </div>
  );
}

export default function RegistrationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#faf8fd] flex items-center justify-center text-[#6605c7]">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 border-2 border-[#6605c7] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-bold text-slate-700">Loading Registration Form...</span>
          </div>
        </div>
      }
    >
      <RegistrationContent />
    </Suspense>
  );
}
