"use client";

import { useState } from "react";
import Link from "next/link";

const steps = [
    {
        num: "01",
        title: "Create Profile & AI Matches",
        desc: "Fill in your academic and co-applicant details in under 5 minutes. Our AI instantly matches you with optimal lenders.",
        icon: "person_add",
        color: "from-purple-500 to-indigo-600",
        badge: "Fast Setup"
    },
    {
        num: "02",
        title: "Compare Real Offers",
        desc: "Compare dynamic interest rates, processing fees, and flexible repayment terms from India's premium public & private banks.",
        icon: "compare_arrows",
        color: "from-indigo-600 to-blue-500",
        badge: "Transparent"
    },
    {
        num: "03",
        title: "Secure Verification",
        desc: "Fetch documents instantly with DigiLocker or upload them directly. Our OCR system auto-validates entries to guarantee speedy reviews.",
        icon: "cloud_upload",
        color: "from-blue-500 to-emerald-500",
        badge: "Secure"
    },
    {
        num: "04",
        title: "Disbursal & Support",
        desc: "Get your digital sanction letter fast-tracked within days. Funds are disbursed directly to your university of choice.",
        icon: "verified_user",
        color: "from-emerald-500 to-[#6605c7]",
        badge: "Sanctioned"
    }
];

const faqs = [
    {
        q: "What is VidyaLoans and how does it help?",
        a: "VidyaLoans is a premium, AI-driven educational lending platform that helps students discover, compare, and apply for education loans. We integrate directly with major banks and financial partners to secure low interest rates, eliminate paper bottlenecks, and fast-track disbursals."
    },
    {
        q: "How long does it take to get a loan sanctioned?",
        a: "Normally, traditional loans take weeks. With VidyaLoans, our direct bank integrations, digital pre-verifications, and digital documents allow qualified profiles to receive sanction letters in as little as 2 to 5 business days."
    },
    {
        q: "Are there any service fees for using VidyaLoans?",
        a: "No! VidyaLoans is completely free for students. We do not charge hidden transaction fees, consultation fees, or application charges. Our primary goal is to help you achieve your global academic dreams transparently."
    },
    {
        q: "What documents do I need to prepare?",
        a: "Typically, you will need identity proof (Aadhaar/PAN), academic records (transcripts/marksheets), university admission letter, fee structure, and basic co-applicant income details. Most documents can be fetched instantly via our integrated DigiLocker callback."
    }
];

export default function HowItWorksPage() {
    const [activeFaq, setActiveFaq] = useState<number | null>(null);

    return (
        <div className="min-h-screen relative text-gray-900 overflow-hidden" style={{ background: 'linear-gradient(135deg, #ede0ff 0%, #f3eaff 25%, #fdf6ff 55%, #fef3e8 80%, #fde8c8 100%)' }}>
            
            {/* Elegant Background Decorators from Home Page */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full blur-[120px] opacity-50" style={{ background: 'radial-gradient(circle, #d8b4fe, transparent)' }} />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-40" style={{ background: 'radial-gradient(circle, #fed7aa, transparent)' }} />
                <div className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full blur-[80px] opacity-20" style={{ background: 'radial-gradient(circle, #c4b5fd, transparent)' }} />
                <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, #6605c7 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            </div>
            
            {/* Hero Section */}
            <section className="pt-36 pb-20 px-6 relative z-10 text-center max-w-5xl mx-auto">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#6605c7]/10 border border-[#6605c7]/15 text-[#6605c7] text-[11px] font-bold uppercase tracking-widest mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6605c7] animate-pulse"></span>
                    Simple & Powerful Flow
                </span>
                <h1 className="text-5xl md:text-7xl font-bold font-display mb-6 tracking-tight leading-tight text-[#1a1626]">
                    How <span className="text-[#6605c7]">VidyaLoans</span> Works
                </h1>
                <p className="text-[17px] text-gray-500 max-w-2xl mx-auto font-medium leading-relaxed">
                    We've eliminated the endless queues, complex bank terminology, and paperwork delays. Discover how we fast-track your global educational journey in four steps.
                </p>
            </section>

            {/* Stepped Process Cards Section */}
            <section className="py-16 px-6 relative z-10 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {steps.map((step, idx) => (
                        <div 
                            key={step.num}
                            className="group relative bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl p-8 hover:border-[#6605c7]/30 transition-all duration-500 flex flex-col justify-between hover:shadow-[0_20px_50px_rgba(102,5,199,0.08)] hover:-translate-y-2 overflow-hidden"
                            style={{
                                transformStyle: "preserve-3d",
                                perspective: "1000px"
                            }}
                        >
                            {/* Decorative Glow on Hover */}
                            <div className={`absolute -right-16 -top-16 w-36 h-36 bg-gradient-to-br ${step.color} opacity-0 group-hover:opacity-10 rounded-full blur-2xl transition-opacity duration-500`} />

                            <div>
                                {/* Step Header */}
                                <div className="flex items-center justify-between mb-8">
                                    <span className="text-4xl font-extrabold font-display text-gray-200 group-hover:text-purple-200 transition-colors">
                                        {step.num}
                                    </span>
                                    <span className="text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md bg-gray-50 text-gray-500 group-hover:bg-purple-100 group-hover:text-purple-700 transition-all">
                                        {step.badge}
                                    </span>
                                </div>

                                {/* Step Icon Box */}
                                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                                    <span className="material-symbols-outlined text-3xl font-bold">{step.icon}</span>
                                </div>

                                {/* Step Content */}
                                <h3 className="text-xl font-bold mb-3 tracking-tight text-gray-900 group-hover:text-[#6605c7] transition-colors">
                                    {step.title}
                                </h3>
                                <p className="text-gray-500 text-[13px] leading-relaxed mb-6 font-medium">
                                    {step.desc}
                                </p>
                            </div>

                            {/* Arrow Indicator (except last step) */}
                            {idx < 3 && (
                                <div className="hidden lg:block absolute top-[40%] right-[-16px] z-20 text-gray-200 group-hover:text-[#6605c7]/40 translate-x-1.5 transition-colors">
                                    <span className="material-symbols-outlined text-3xl font-bold">arrow_forward_ios</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* AI Highlight Banner */}
            <section className="py-12 px-6 relative z-10 max-w-5xl mx-auto">
                <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-[2.5rem] p-10 md:p-12 text-center relative overflow-hidden shadow-xl">
                    <div className="absolute inset-0 bg-premium-noise opacity-5" />
                    <div className="absolute top-[-50%] left-[-20%] w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute bottom-[-50%] right-[-20%] w-[300px] h-[300px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none" />

                    <div className="relative z-10 max-w-2xl mx-auto">
                        <span className="material-symbols-outlined text-[#6605c7] text-5xl mb-4 font-bold">psychology</span>
                        <h2 className="text-2xl md:text-3xl font-bold font-display mb-4 text-[#1a1626]">
                            Powered by Smart matching engine
                        </h2>
                        <p className="text-gray-500 text-[14px] leading-relaxed mb-8 font-medium">
                            Our backend algorithm cross-analyzes eligibility parameters from major public, private, and NBFC lenders in real-time, matching you with the lowest rate loan for which you qualify.
                        </p>
                        <div className="flex flex-wrap justify-center gap-4">
                            <Link 
                                href="/loan-eligibility"
                                className="px-6 py-3 text-white font-bold rounded-xl hover:-translate-y-0.5 transition-all text-xs uppercase tracking-wider shadow-lg shadow-purple-500/25"
                                style={{ background: 'linear-gradient(135deg, #6605c7, #8b24e5)' }}
                            >
                                Check Eligibility
                            </Link>
                            <Link 
                                href="/compare-loans"
                                className="px-6 py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:-translate-y-0.5 transition-all text-xs uppercase tracking-wider shadow-sm"
                            >
                                Compare Rates
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Interactive FAQs Accordion */}
            <section className="py-24 px-6 relative z-10 max-w-3xl mx-auto">
                <div className="text-center mb-16">
                    <span className="text-[#6605c7] font-bold text-[11px] uppercase tracking-widest block mb-3">Frequently Asked</span>
                    <h2 className="text-3xl md:text-4xl font-bold font-display text-[#1a1626]">Got Questions?</h2>
                </div>

                <div className="space-y-4">
                    {faqs.map((faq, idx) => {
                        const isOpen = activeFaq === idx;
                        return (
                            <div 
                                key={idx}
                                className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl overflow-hidden transition-all duration-300 hover:border-purple-500/20 shadow-sm"
                            >
                                <button
                                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                                    className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none transition-colors"
                                >
                                    <span className="font-bold text-[15px] pr-4 text-gray-800 hover:text-[#6605c7] transition-colors">
                                        {faq.q}
                                    </span>
                                    <span className={`material-symbols-outlined text-[#6605c7] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
                                        expand_more
                                    </span>
                                </button>
                                
                                <div 
                                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                                        isOpen ? 'max-h-60 border-t border-gray-100' : 'max-h-0'
                                    }`}
                                >
                                    <p className="px-6 py-5 text-gray-500 text-[13px] leading-relaxed font-medium bg-purple-50/30">
                                        {faq.a}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Elegant Call to Action */}
            <section className="py-20 px-6 relative z-10 text-center max-w-4xl mx-auto border-t border-black/5">
                <h2 className="text-3xl md:text-5xl font-bold font-display mb-6 tracking-tight leading-tight text-[#1a1626]">
                    Ready to fund your <span className="text-[#6605c7] italic">Global Dream</span>?
                </h2>
                <p className="text-gray-500 text-[14px] max-w-xl mx-auto mb-10 leading-relaxed font-medium">
                    Create your profile in 5 minutes and check matched offers from 5+ major banking partners.
                </p>
                <div className="flex justify-center">
                    <Link
                        href="/apply-loan"
                        className="relative group px-10 py-4.5 text-white font-extrabold rounded-xl transition-all shadow-[0_12px_40px_rgba(102,5,199,0.25)] hover:scale-105 active:scale-95 text-xs uppercase tracking-wider"
                        style={{ background: 'linear-gradient(135deg, #6605c7, #8b24e5)' }}
                    >
                        Apply Now
                    </Link>
                </div>
            </section>
        </div>
    );
}
