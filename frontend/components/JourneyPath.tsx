'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

const steps = [
    {
        id: 1,
        label: 'Step 1',
        title: 'Exploration',
        subtitle: 'Find Your Dream University',
        desc: 'Identify your goals, shortlist universities, and understand the admission landscape with our AI-powered university matcher.',
        icon: '🔍',
        materialIcon: 'travel_explore',
        tip: 'Research at least 12 months before your intended departure. Early planning unlocks better financial options.',
        color: '#7c3aed',
        gradient: 'linear-gradient(135deg, #7c3aed, #a855f7)',
        cta: 'Find Universities',
        ctaHref: '/onboarding',
        stat: '500+ Unis',
    },
    {
        id: 2,
        label: 'Step 2',
        title: 'Preparation',
        subtitle: 'Ace Tests & Documents',
        desc: 'Prepare for GRE, IELTS/TOEFL, gather transcripts, and craft winning SOPs with our AI SOP Writer.',
        icon: '✏️',
        materialIcon: 'edit_calendar',
        tip: 'Students who take 3+ practice tests score 15% higher on average. Use our practice portal!',
        color: '#0ea5e9',
        gradient: 'linear-gradient(135deg, #0ea5e9, #38bdf8)',
        cta: 'Practice Now',
        ctaHref: '/',
        stat: 'AI-Powered',
    },
    {
        id: 3,
        label: 'Step 3',
        title: 'Application',
        subtitle: 'Submit with Confidence',
        desc: 'Craft a compelling SOP, request LORs, and submit your applications before deadlines. Our SOP analyzer gives instant AI feedback.',
        icon: '📋',
        materialIcon: 'description',
        tip: 'Personalize your SOP for each university. Generic SOPs are the #1 reason for rejections.',
        color: '#f59e0b',
        gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
        cta: 'AI SOP Writer',
        ctaHref: '/sop-writer',
        stat: '40% Admit Rate',
    },
    {
        id: 4,
        label: 'Step 4',
        title: 'Finance',
        subtitle: 'Secure Your Education Loan',
        desc: 'Things to know about financing your education: loan eligibility, approval, and more. Compare 50+ lenders in seconds.',
        icon: '💰',
        materialIcon: 'payments',
        tip: 'Check your pre-approved loan offers in under 2 minutes. Zero collateral loans up to ₹1 Crore.',
        color: '#6605c7',
        gradient: 'linear-gradient(135deg, #6605c7, #9333ea)',
        cta: 'Explore Now',
        ctaHref: '/apply-loan',
        stat: '₹1Cr Loans',
        featured: true,
    },
    {
        id: 5,
        label: 'Step 5',
        title: 'Visa Success',
        subtitle: 'Get Visa Approved',
        desc: 'Complete your documentation, prepare for consulate interviews, and get your visa stamped with our visa guidance resources.',
        icon: '🛂',
        materialIcon: 'verified_user',
        tip: 'Financial proof is the #1 thing consulate officers check. Your sanction letter from VidyaLoan is your best asset.',
        color: '#10b981',
        gradient: 'linear-gradient(135deg, #10b981, #34d399)',
        cta: 'Visa Guide',
        ctaHref: '/',
        stat: '98% Success',
    },
    {
        id: 6,
        label: 'Step 6',
        title: 'Departure',
        subtitle: 'Fly to Your Future',
        desc: 'Pack your bags and board your flight! Join our global student community of 10,000+ VidyaLoan scholars across 30+ countries.',
        icon: '✈️',
        materialIcon: 'flight_takeoff',
        tip: 'Join our pre-departure sessions to meet your future classmates and get city-specific tips from seniors.',
        color: '#ec4899',
        gradient: 'linear-gradient(135deg, #ec4899, #f472b6)',
        cta: 'Join Community',
        ctaHref: '/community-events',
        stat: '10K+ Alumni',
    },
];

// Arc Y positions for the 6 nodes (top = smaller idx, bottom = edges)
const arcY = [80, 30, 0, 0, 30, 80]; // percent offset downward from top

export default function JourneyPath() {
    const [active, setActive] = useState(3); // 0-indexed, default = Finance (step 4)
    const [animating, setAnimating] = useState(false);

    const goTo = useCallback((idx: number) => {
        if (idx === active || animating) return;
        setAnimating(true);
        setTimeout(() => {
            setActive(idx);
            setAnimating(false);
        }, 200);
    }, [active, animating]);

    // Auto-advance every 4 seconds
    useEffect(() => {
        const timer = setInterval(() => {
            setActive(prev => (prev + 1) % steps.length);
        }, 4000);
        return () => clearInterval(timer);
    }, []);

    const step = steps[active];

    return (
        <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false, amount: 0.05 }}
            transition={{ duration: 0.4 }}
            className="py-28 bg-transparent relative overflow-hidden"
        >
            {/* Decorative blobs */}
            <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, #6605c7, transparent)' }} />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, #a855f7, transparent)' }} />

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, x: -60 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: false, amount: 0.3 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-7xl mx-auto px-6 text-center mb-16 relative z-10"
            >
                <span className="inline-block px-4 py-1.5 rounded-full bg-[#6605c7]/5 text-[#6605c7] text-[10px] font-bold uppercase tracking-widest mb-4 border border-[#6605c7]/10">
                    YOUR PATHWAY
                </span>
                <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
                    Study Abroad <span style={{ background: 'linear-gradient(135deg, #6605c7, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Journey</span>
                </h2>
                <p className="text-gray-500 max-w-xl mx-auto text-sm md:text-base font-normal">
                    6 milestones. One seamless platform. We guide you from first thought to first lecture.
                </p>
            </motion.div>

            {/* ── ARC NODE ROW (Desktop) ── */}
            <div className="hidden lg:block max-w-6xl mx-auto px-6 relative z-10" style={{ height: 280 }}>
                {/* Arc SVG behind nodes */}
                <svg className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" viewBox="0 0 1100 280" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#6605c7" stopOpacity="0.15" />
                            <stop offset="30%" stopColor="#7c3aed" stopOpacity="0.6" />
                            <stop offset="50%" stopColor="#a855f7" stopOpacity="0.9" />
                            <stop offset="70%" stopColor="#7c3aed" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="#6605c7" stopOpacity="0.15" />
                        </linearGradient>
                    </defs>
                    <path
                        d="M 80 240 C 300 20, 800 20, 1020 240"
                        fill="none"
                        stroke="url(#arcGrad)"
                        strokeWidth="3"
                        strokeDasharray="10 8"
                    />
                </svg>

                {/* Nodes */}
                {steps.map((s, idx) => {
                    const isActive = active === idx;
                    // Positions along the arc
                    const xPercents = [7, 22, 38, 55, 71, 87];
                    const yPx = [240, 130, 60, 60, 130, 240];
                    const x = xPercents[idx];
                    const y = yPx[idx];

                    return (
                        <button
                            key={s.id}
                            onClick={() => goTo(idx)}
                            className="absolute flex flex-col items-center group"
                            style={{ left: `${x}%`, top: y, transform: 'translate(-50%, -50%)' }}
                            aria-label={s.title}
                        >
                            {/* Node circle */}
                            <div
                                className="relative flex items-center justify-center rounded-full transition-all duration-500 shadow-lg"
                                style={{
                                    width: isActive ? 88 : 64,
                                    height: isActive ? 88 : 64,
                                    background: isActive ? s.gradient : 'white',
                                    border: isActive ? '3px solid rgba(255,255,255,0.5)' : '2px solid #e5e7eb',
                                    boxShadow: isActive ? `0 0 0 12px ${s.color}22, 0 8px 32px ${s.color}55` : '0 2px 12px rgba(0,0,0,0.08)',
                                    zIndex: isActive ? 20 : 10,
                                }}
                            >
                                {/* Outer pulse */}
                                {isActive && (
                                    <div className="absolute inset-0 rounded-full animate-ping opacity-30" style={{ background: s.gradient }} />
                                )}
                                <span className="text-2xl" style={{ filter: !isActive ? 'grayscale(0.3)' : 'none' }}>{s.icon}</span>

                                {/* Step badge */}
                                <div
                                    className="absolute -top-3 -right-3 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shadow"
                                    style={{ background: isActive ? 'white' : s.gradient, color: isActive ? s.color : 'white' }}
                                >
                                    {s.id}
                                </div>
                            </div>

                            {/* Label below node */}
                            <div
                                className="mt-3 text-[11px] font-semibold transition-all duration-300 whitespace-nowrap"
                                style={{ color: isActive ? s.color : '#9ca3af' }}
                            >
                                {s.title}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── DETAIL CARD ── */}
            <div className="max-w-4xl mx-auto px-6 mt-12 lg:mt-8 relative z-10">
                <div
                    key={active}
                    className="rounded-3xl p-8 md:p-10 relative overflow-hidden transition-all"
                    style={{
                        background: 'white',
                        boxShadow: `0 20px 80px -12px ${step.color}25, 0 4px 24px rgba(0,0,0,0.04)`,
                        border: `1px solid ${step.color}15`,
                    }}
                >
                    {/* Background tint */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ background: step.gradient }} />

                    <div className="relative z-10 flex flex-col md:flex-row gap-10 items-center">
                        {/* Left: Icon + Step Label */}
                        <div className="flex-shrink-0 text-center">
                            <div
                                className="w-24 h-24 md:w-32 md:h-32 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl relative"
                                style={{ background: step.gradient, boxShadow: `0 15px 45px ${step.color}40` }}
                            >
                                <div className="absolute inset-0 rounded-2xl animate-ping opacity-10" style={{ background: step.gradient }} />
                                <span className="text-4xl md:text-5xl">{step.icon}</span>
                            </div>
                            <span
                                className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                                style={{ background: `${step.color}10`, color: step.color }}
                            >
                                {step.label}
                            </span>
                        </div>

                        {/* Right: Content */}
                        <div className="flex-1 text-center md:text-left">
                            <p className="text-[11px] font-bold mb-1 uppercase tracking-wider" style={{ color: step.color }}>{step.subtitle}</p>
                            <h3 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3 tracking-tight">{step.title}</h3>
                            <p className="text-gray-600 text-sm md:text-base leading-relaxed mb-6">{step.desc}</p>

                            {/* Tip card */}
                            <div
                                className="flex items-start gap-3 p-4 rounded-xl mb-7 text-left"
                                style={{ background: `${step.color}05`, border: `1px solid ${step.color}10` }}
                            >
                                <span className="text-lg flex-shrink-0 mt-0.5">💡</span>
                                <p className="text-xs font-normal text-gray-600 leading-relaxed italic">{step.tip}</p>
                            </div>

                            {/* Stat + CTA */}
                            <div className="flex flex-col sm:flex-row items-center md:items-start gap-4">
                                <Link
                                    href={step.ctaHref}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-xs shadow-md transition-all hover:opacity-95 hover:-translate-y-0.5 hover:shadow-lg"
                                    style={{ background: step.gradient, boxShadow: `0 6px 18px ${step.color}30` }}
                                >
                                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>{step.materialIcon}</span>
                                    {step.cta}
                                </Link>
                                <div
                                    className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs"
                                    style={{ background: `${step.color}08`, color: step.color }}
                                >
                                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: '"FILL" 1' }}>verified</span>
                                    {step.stat}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── DOT NAVIGATION ── */}
            <div className="flex items-center justify-center gap-3 mt-10 relative z-10">
                {steps.map((s, idx) => (
                    <button
                        key={idx}
                        onClick={() => goTo(idx)}
                        className="transition-all duration-300 rounded-full"
                        style={{
                            width: active === idx ? 32 : 10,
                            height: 10,
                            background: active === idx ? s.gradient : '#d1d5db',
                        }}
                        aria-label={`Go to ${s.title}`}
                    />
                ))}
            </div>

            {/* ── MOBILE STEP PILLS ── */}
            <div className="lg:hidden flex gap-2 overflow-x-auto px-6 mt-8 pb-2 relative z-10 scrollbar-hide">
                {steps.map((s, idx) => (
                    <button
                        key={idx}
                        onClick={() => goTo(idx)}
                        className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all"
                        style={{
                            background: active === idx ? s.gradient : 'white',
                            color: active === idx ? 'white' : '#6b7280',
                            border: active === idx ? 'none' : '1.5px solid #e5e7eb',
                            boxShadow: active === idx ? `0 4px 16px ${s.color}40` : 'none',
                        }}
                    >
                        <span>{s.icon}</span>
                        {s.title}
                    </button>
                ))}
            </div>
        </motion.section>
    );
}
