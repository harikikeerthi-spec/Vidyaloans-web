"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedNumber from "./AnimatedNumber";
import { SITE_STATS } from "../lib/siteStats";

interface ModalData {
    id: string;
    title: string;
    subtitle: string;
    desc: string;
}

export default function PostAdmissionServicesSection() {
    const [isOpen, setIsOpen] = useState(false);
    const [modalData, setModalData] = useState<ModalData>({
        id: "",
        title: "",
        subtitle: "",
        desc: ""
    });
    const [email, setEmail] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState("");

    const openModal = (id: string, title: string, subtitle: string, desc: string) => {
        setModalData({ id, title, subtitle, desc });
        setEmail("");
        setSubmitted(false);
        setError("");

        // Check if already subscribed in localStorage
        if (typeof window !== "undefined") {
            const hasSubscribed = localStorage.getItem(`subscribed_service_${id}`);
            if (hasSubscribed) {
                setEmail(hasSubscribed);
                setSubmitted(true);
            }
        }

        setIsOpen(true);
    };

    const closeModal = () => {
        setIsOpen(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            setError("Email is required.");
            return;
        }

        // Basic email regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError("Please enter a valid email address.");
            return;
        }

        setError("");
        setIsSubmitting(true);

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000));

        setIsSubmitting(false);
        setSubmitted(true);

        // Persist subscription in localStorage
        if (typeof window !== "undefined") {
            localStorage.setItem(`subscribed_service_${modalData.id}`, email);
        }
    };

    return (
        <section className="py-24 bg-transparent overflow-hidden relative">
            {/* Background elements */}
            <div className="absolute top-1/2 right-0 w-[40vw] h-[40vw] bg-[#6605c7]/[0.03] rounded-full blur-[140px] pointer-events-none -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-[30vw] h-[30vw] bg-purple-500/[0.03] rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-16">
                    <div>
                        <span className="inline-block px-4 py-1.5 rounded-full bg-[#6605c7]/10 text-[#6605c7] text-[11px] font-black uppercase tracking-widest mb-4 border border-[#6605c7]/15">
                            BEYOND LOANS 🎓
                        </span>
                        <h2 className="text-3xl md:text-5xl font-black text-gray-900 leading-tight">
                            Post-Admission <br />
                            <span style={{ background: 'linear-gradient(135deg, #6605c7, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Services</span>
                        </h2>
                        <p className="text-gray-500 text-[13px] mt-4 max-w-lg leading-relaxed font-medium">
                            Everything you need after getting your admit — banking, forex, and more
                        </p>
                    </div>
                    <button
                        onClick={() => openModal(
                            "all_services",
                            "All Value-Added Services",
                            "Unlock premium student services",
                            "Get early access to all of our post-admission services, including blocked accounts, student housing support, and zero-markup forex cards."
                        )}
                        className="flex-shrink-0 cursor-pointer inline-flex items-center gap-2 px-7 py-4 rounded-xl border-2 border-[#6605c7]/20 text-[#6605c7] font-black hover:bg-[#6605c7] hover:text-white hover:border-[#6605c7] transition-all group text-[11px] uppercase tracking-widest"
                    >
                        View All Services
                        <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform" aria-hidden="true">arrow_forward</span>
                    </button>
                </div>

                {/* Bento Grid */}
                <div className="grid grid-cols-12 gap-5">
                    {/* 1 — US Credit Card (large left) */}
                    <div
                        onClick={() => openModal(
                            "us_credit_card",
                            "US Credit Card",
                            "Start building US credit score from Day 1",
                            "Apply for a US student credit card prior to departure. No SSN or US credit history is required. Build credit from the day you land."
                        )}
                        className="col-span-12 lg:col-span-5 row-span-1 group relative overflow-hidden rounded-xl shadow-xl flex flex-col justify-end min-h-[320px] cursor-pointer hover:-translate-y-1.5 transition-all duration-300"
                        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)' }}
                    >
                        <div className="absolute inset-0 opacity-15" style={{ background: "url('/images/services/us-credit-card.jpg') center/cover" }} />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(30,58,138,0.97) 0%, rgba(30,58,138,0.3) 60%, transparent 100%)' }} />
                        <div className="absolute top-6 left-6 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest border border-white/20">
                                🇺🇸 USA
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 backdrop-blur-sm text-amber-300 text-[9px] font-black uppercase tracking-wider border border-amber-400/30">
                                🔒 Coming Soon
                            </span>
                        </div>
                        <div className="absolute top-4 right-4 w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform border border-white/20">
                            <span className="text-3xl">💳</span>
                        </div>
                        <div className="relative z-10 p-7">
                            <div className="text-4xl font-black text-white mb-1">Day 1</div>
                            <div className="text-white/50 text-[10px] uppercase tracking-widest font-black mb-3">Start Building Credit</div>
                            <h3 className="text-xl font-black text-white mb-2">US Credit Card</h3>
                            <p className="text-white/60 text-[13px] mb-5 leading-relaxed font-medium">Build your US credit score from day one with a student credit card — no SSN required to apply.</p>
                            <span className="inline-flex items-center gap-2 text-blue-300 font-bold text-[11px] uppercase tracking-widest group-hover:gap-3 transition-all">
                                Notify Me <span className="material-symbols-outlined text-sm text-blue-300 font-black" aria-hidden="true">notifications</span>
                            </span>
                        </div>
                    </div>

                    {/* 2 — German Blocked Account (top middle) */}
                    <div
                        onClick={() => openModal(
                            "german_blocked_account",
                            "German Blocked Account",
                            "Fast & fully compliant visa-approved account",
                            "Open your German blocked account with visa guarantee. Required balance setup made smooth and hassle-free for all student visas."
                        )}
                        className="col-span-12 sm:col-span-6 lg:col-span-4 row-span-1 group relative overflow-hidden rounded-xl shadow-xl flex flex-col justify-end min-h-[320px] cursor-pointer hover:-translate-y-1.5 transition-all duration-300"
                        style={{ background: 'linear-gradient(135deg, #1f2937 0%, #374151 100%)' }}
                    >
                        <div className="absolute inset-0 opacity-20" style={{ background: "url('/images/services/german-account.jpg') center/cover" }} />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(31,41,55,0.98) 0%, rgba(31,41,55,0.3) 60%, transparent 100%)' }} />
                        <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-400/20 backdrop-blur-sm text-yellow-200 text-[10px] font-black uppercase tracking-widest border border-yellow-400/20">
                                🇩🇪 Germany
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 backdrop-blur-sm text-amber-300 text-[9px] font-black uppercase tracking-wider border border-amber-400/30">
                                🔒 Coming Soon
                            </span>
                        </div>
                        <div className="relative z-10 p-6">
                            <div className="text-3xl font-black text-white mb-1">€11,208</div>
                            <div className="text-white/40 text-[10px] uppercase tracking-widest font-black mb-2">Required Balance</div>
                            <h3 className="text-lg font-black text-white mb-2">German Blocked Account</h3>
                            <p className="text-white/55 text-[13px] mb-4 leading-relaxed font-medium">Open your mandatory blocked account hassle-free for Germany visa application.</p>
                            <span className="inline-flex items-center gap-2 text-yellow-300 font-bold text-[11px] uppercase tracking-widest group-hover:gap-3 transition-all">
                                Notify Me <span className="material-symbols-outlined text-sm text-yellow-300 font-black" aria-hidden="true">notifications</span>
                            </span>
                        </div>
                    </div>

                    {/* 3 — Forex Card (top right) */}
                    <div
                        onClick={() => openModal(
                            "forex_card",
                            "Forex Card",
                            "Multi-currency student card with zero markup fee",
                            "Save on conversion fees. Get a globally accepted card with real-time interbank rates and zero markup fee on international transactions."
                        )}
                        className="col-span-12 sm:col-span-6 lg:col-span-3 row-span-1 group relative overflow-hidden rounded-xl shadow-xl flex flex-col justify-end min-h-[320px] cursor-pointer hover:-translate-y-1.5 transition-all duration-300"
                        style={{ background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}
                    >
                        <div className="absolute inset-0 opacity-15" style={{ background: "url('/images/services/forex-card.jpg') center/cover" }} />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(5,150,105,0.97) 0%, rgba(5,150,105,0.3) 70%, transparent 100%)' }} />
                        <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
                            <span className="text-3xl">🌍</span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 backdrop-blur-sm text-amber-300 text-[9px] font-black uppercase tracking-wider border border-amber-400/30">
                                🔒 Coming Soon
                            </span>
                        </div>
                        <div className="relative z-10 p-6">
                            <div className="text-3xl font-black text-white mb-1"><AnimatedNumber value="0%" /></div>
                            <div className="text-emerald-200/50 text-[10px] uppercase tracking-widest font-black mb-2">Markup Fee</div>
                            <h3 className="text-lg font-black text-white mb-2">Forex Card</h3>
                            <p className="text-white/55 text-[13px] mb-4 leading-relaxed font-medium">Multi-currency forex card with the best exchange rates.</p>
                            <span className="inline-flex items-center gap-2 text-emerald-300 font-bold text-[11px] uppercase tracking-widest group-hover:gap-3 transition-all">
                                Notify Me <span className="material-symbols-outlined text-sm text-emerald-300 font-black" aria-hidden="true">notifications</span>
                            </span>
                        </div>
                    </div>

                    {/* 4 — UK Bank Account - Hidden until live */}
                    {false && (
                    <div
                        onClick={() => openModal(
                            "uk_bank_account",
                            "UK Bank Account",
                            "Pre-arrival UK bank account opening",
                            "Open an active UK checking account before leaving India. Receive your debit card and account details prior to arrival, so you are ready on Day 1."
                        )}
                        className="col-span-12 sm:col-span-6 lg:col-span-5 row-span-1 group relative overflow-hidden rounded-xl shadow-xl flex flex-col justify-end min-h-[280px] cursor-pointer hover:-translate-y-1.5 transition-all duration-300"
                        style={{ background: 'linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)' }}
                    >
                        <div className="absolute inset-0 opacity-15" style={{ background: "url('/images/services/uk-bank.jpg') center/cover" }} />
                        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(124,45,18,0.97) 0%, rgba(124,45,18,0.3) 60%, transparent 100%)' }} />
                        <div className="absolute top-6 left-6 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest border border-white/20">
                                🇬🇧 UK
                            </span>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400/20 backdrop-blur-sm text-amber-300 text-[9px] font-black uppercase tracking-wider border border-amber-400/30">
                                🔒 Coming Soon
                            </span>
                        </div>
                        <div className="absolute top-4 right-4 w-14 h-14 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                            <span className="text-3xl">🏦</span>
                        </div>
                        <div className="relative z-10 p-7">
                            <div className="text-4xl font-black text-white mb-1">Pre-Arrival</div>
                            <div className="text-white/50 text-[10px] uppercase tracking-widest font-black mb-3">Account Opening</div>
                            <h3 className="text-xl font-black text-white mb-2">UK Bank Account</h3>
                            <p className="text-white/60 text-[13px] mb-5 leading-relaxed font-medium">Pre-arrival UK bank account opening for Indian students — be ready before you land.</p>
                            <span className="inline-flex items-center gap-2 text-orange-300 font-bold text-[11px] uppercase tracking-widest group-hover:gap-3 transition-all">
                                Notify Me <span className="material-symbols-outlined text-sm text-orange-300 font-black" aria-hidden="true">notifications</span>
                            </span>
                        </div>
                    </div>
                    )}
                </div>

                {/* Stats Bar */}
                <div className="mt-8 flex flex-wrap gap-4 justify-center">
                    {[
                        { icon: 'public', val: SITE_STATS.countries, label: 'Countries Covered' },
                        { icon: 'payments', val: '0%', label: 'Forex Markup' },
                        { icon: 'account_balance', val: 'Pre-Arrival', label: 'Bank Accounts' },
                        { icon: 'target', val: SITE_STATS.students, label: 'Students Helped' },
                    ].map(s => (
                        <div key={s.label} className="flex items-center gap-2.5 px-5 py-3 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group">
                            <span className="material-symbols-outlined text-[#6605c7] text-2xl group-hover:scale-125 transition-transform">{s.icon}</span>
                            <div>
                                <div className="font-black text-gray-900 text-[13px] leading-none"><AnimatedNumber value={s.val} /></div>
                                <div className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">{s.label}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Coming Soon Notification Modal */}
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
                        {/* Backdrop overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeModal}
                            className="absolute inset-0 bg-[#0c0414]/75 backdrop-blur-sm cursor-pointer"
                        />

                        {/* Modal dialog box */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 15 }}
                            transition={{ type: "spring", duration: 0.45 }}
                            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white p-6 md:p-8 shadow-2xl border border-purple-500/10 z-10 text-gray-900"
                        >
                            {/* Accent Glow lights */}
                            <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#6605c7]/5 rounded-full blur-[60px] pointer-events-none" />
                            <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/5 rounded-full blur-[60px] pointer-events-none" />

                            {/* Close Button */}
                            <button
                                onClick={closeModal}
                                className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-50 hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600 cursor-pointer"
                                aria-label="Close"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>

                            {/* Modal Header */}
                            <div className="mb-5">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#6605c7]/10 text-[#6605c7] text-[10px] font-black uppercase tracking-widest border border-[#6605c7]/15 mb-4">
                                    🔒 Coming Soon
                                </span>
                                <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight leading-tight">
                                    {modalData.title}
                                </h3>
                                <p className="text-[12px] text-gray-500 font-bold uppercase tracking-wider mt-1 text-purple-600">
                                    {modalData.subtitle}
                                </p>
                            </div>

                            {/* Modal Content */}
                            <div className="space-y-6">
                                <p className="text-[13px] text-gray-600 leading-relaxed font-medium">
                                    {modalData.desc} We are working hard to integrate this directly on VidyaLoans with the best partners. Subscribing ensures you get notified as soon as this launches.
                                </p>

                                {!submitted ? (
                                    <form onSubmit={handleSubmit} className="space-y-3.5">
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">mail</span>
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => {
                                                    setEmail(e.target.value);
                                                    setError("");
                                                }}
                                                placeholder="Enter your email address"
                                                className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-gray-200 text-[13px] font-semibold focus:outline-none focus:ring-2 focus:ring-[#6605c7] focus:border-[#6605c7] transition-all bg-gray-50/50 placeholder:text-gray-400"
                                            />
                                        </div>
                                        {error && (
                                            <p className="text-xs text-red-500 font-bold flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-sm">error</span> {error}
                                            </p>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={isSubmitting}
                                            className="w-full cursor-pointer py-3.5 bg-gradient-to-r from-[#6605c7] to-[#a855f7] hover:from-[#5504a6] hover:to-[#9333ea] text-white font-black text-[11px] uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed shadow-md shadow-purple-500/10 hover:shadow-purple-500/25"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    Notify Me
                                                    <span className="material-symbols-outlined text-sm">notifications</span>
                                                </>
                                            )}
                                        </button>
                                    </form>
                                ) : (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="p-5 rounded-xl bg-emerald-50 border border-emerald-100 text-center"
                                    >
                                        <span className="material-symbols-outlined text-3xl text-emerald-500 mb-1.5">check_circle</span>
                                        <h4 className="text-[14px] font-black text-emerald-950 mb-0.5">You're on the list!</h4>
                                        <p className="text-[11px] text-emerald-700 font-semibold leading-relaxed">
                                            We'll email you at <span className="font-bold underline">{email}</span> the moment {modalData.title} launches.
                                        </p>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </section>
    );
}
