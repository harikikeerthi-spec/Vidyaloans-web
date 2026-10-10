"use client";

import Link from "next/link";
import Image from "next/image";
import JourneyPath from "../../components/JourneyPath";
import UniverseEcosystem from "../../components/UniverseEcosystem";
import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";

function AnimatedCounter({ value, duration = 2 }: { value: string | number; duration?: number }) {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    // once: false => resets and re-animates every time section enters viewport
    const isInView = useInView(ref, { once: false, amount: 0.5 });

    const strValue = String(value);
    const match = strValue.match(/^([₹$€]?)([0-9,.]+)(.*)$/);
    const prefix = match ? match[1] : "";
    const numericPart = match ? parseFloat(match[2].replace(/,/g, "")) : 0;
    const suffix = match ? match[3] : "";

    const decimalMatches = strValue.match(/\.(\d+)/);
    const decimalPlaces = decimalMatches ? decimalMatches[1].length : 0;

    useEffect(() => {
        let startTime: number;
        let animationFrame: number;

        if (isInView) {
            setCount(0); // reset to 0 before animating
            const end = numericPart;
            if (end === 0) {
                return;
            }

            const animate = (timestamp: number) => {
                if (!startTime) startTime = timestamp;
                const progress = timestamp - startTime;
                // Ease-out curve for snappier feel
                const linear = Math.min(progress / (duration * 1000), 1);
                const eased = 1 - Math.pow(1 - linear, 3);

                setCount(end * eased);

                if (linear < 1) {
                    animationFrame = requestAnimationFrame(animate);
                } else {
                    setCount(end); // ensure we land exactly on the end value
                }
            };

            animationFrame = requestAnimationFrame(animate);
        } else {
            setCount(0); // reset when out of view so it re-animates on next scroll
        }

        return () => {
            if (animationFrame) cancelAnimationFrame(animationFrame);
        };
    }, [isInView, numericPart, duration]);

    const displayNum = count.toLocaleString("en-IN", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
    });

    return (
        <span ref={ref} className="tabular-nums">
            {prefix}{displayNum}{suffix}
        </span>
    );
}

function ReferCard() {
    return (
        <Link href="/referral" className="group relative block w-48 md:w-64 h-64 text-white transition-all duration-500 hover:-translate-y-2" aria-label="Refer and Earn">
            {/* The Polygon Card with Sharp Geometric Cuts */}
            <div
                className="relative h-full w-full bg-[#1a1626] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.5)] border-b-4 border-r-4 border-[#6605c7]"
                style={{ clipPath: 'polygon(0% 0%, 85% 0%, 100% 15%, 100% 100%, 15% 100%, 0% 85%)' }}
            >
                {/* Dynamic Gradient Layer */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#3b0768] to-[#1a1626] opacity-90" />

                {/* Geometric Pattern Overlay */}
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(30deg, #6605c7 12%, transparent 12.5%, transparent 87%, #6605c7 87.5%, #6605c7), linear-gradient(150deg, #6605c7 12%, transparent 12.5%, transparent 87%, #6605c7 87.5%, #6605c7), linear-gradient(30deg, #6605c7 12%, transparent 12.5%, transparent 87%, #6605c7 87.5%, #6605c7), linear-gradient(150deg, #6605c7 12%, transparent 12.5%, transparent 87%, #6605c7 87.5%, #6605c7), linear-gradient(60deg, #6605c7 25%, transparent 25.5%, transparent 75%, #6605c7 75%, #6605c7), linear-gradient(60deg, #6605c7 25%, transparent 25.5%, transparent 75%, #6605c7 75%, #6605c7)', backgroundSize: '20px 35px' }} />

                {/* Content Container */}
                <div className="relative z-20 h-full p-8 flex flex-col">
                    <div className="mt-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.4em] text-[#e0c389] mb-4 border-l-2 border-[#e0c389] pl-3">Exclusive Offer</div>
                        <div className="text-3xl md:text-4xl font-black leading-none mb-2 tracking-tighter">
                            EARN <br />
                            <span className="text-white text-5xl">₹1L</span>
                        </div>
                        <div className="text-[11px] text-purple-200/60 font-medium tracking-widest uppercase">Per Successful Referral</div>
                    </div>

                    <div className="mt-auto flex items-center justify-between">
                        <div className="bg-white/5 backdrop-blur-sm border-l border-t border-white/20 p-3 transform transition-all group-hover:border-[#e0c389]">
                            <span className="material-symbols-outlined text-[#e0c389] text-xl">qr_code_2</span>
                        </div>
                        <div className="flex-1 ml-4 py-3 bg-[#6605c7] text-center font-black text-[11px] uppercase tracking-[0.2em] transform -skew-x-12 group-hover:bg-[#e0c389] group-hover:text-black transition-all">
                            Invite Now
                        </div>
                    </div>
                </div>
            </div>

            {/* Sharp Square Badge */}
            <div className="absolute -top-6 -right-6 z-30 transition-all duration-700 group-hover:scale-110 group-hover:rotate-90">
                <div className="w-16 h-16 bg-[#e0c389] flex items-center justify-center shadow-[10px_10px_0px_rgba(102,5,199,0.3)] border-2 border-[#1a1626]">
                    <span className="text-2xl font-black text-[#1a1626]">1L</span>
                </div>
            </div>
        </Link>
    );
}
const lenders = [
    { name: "IDFC First Bank", badge: "Digital First", rate: "10.50% - 12.50%", time: "48 hours", fee: "1% + GST", logo: "/images/lenders/idfc-first-bank.jpg" },
    { name: "HDFC Credila", badge: "Most Popular", rate: "10.75% - 12.50%", time: "5-7 days", fee: "1% of loan", logo: "/images/lenders/hdfc-credila.png" },
    { name: "Auxilo Finserve", badge: "Fast Approval", rate: "11.25% - 13.50%", time: "3 days", fee: "1.5% + GST", logo: "/images/lenders/auxilo.png" },
    { name: "Avanse Financial", badge: "High Limits", rate: "10.99% - 13.00%", time: "4 days", fee: "1% + GST", logo: "/images/lenders/avanse.jpg" },
    { name: "Poonawalla Fincorp", badge: "Easy Process", rate: "11.50% - 14.50%", time: "3 days", fee: "1.5% + GST", logo: "/images/lenders/poonawalla.png" },
];

const features = [
    { icon: "hub", title: "Top Lender Network", desc: "Access India's best education loan marketplace with our curated network of premium banks and NBFCs." },
    { icon: "apartment", title: "University-Specific Offers", desc: "Get tailored loan offers based on your university, course, and country of study." },
    { icon: "handshake", title: "Guaranteed Best Rate", desc: "We negotiate with lenders to get you the lowest interest rates available in the market." },
    { icon: "devices", title: "Digital Application", desc: "Apply 100% online. Upload documents, e-sign, and track your application in real-time." },
    { icon: "psychology", title: "Free Expert Counseling", desc: "Free 1-on-1 guidance from education loan experts throughout your journey." },
    { icon: "bolt", title: "Quick Disbursement", desc: "Get your loan sanctioned in 48 hours and disbursed before your university deadline." },
];

function ToolCard({ href, bg, icon, title, desc, cta, large = false, border = false }: {
    href: string; bg: string; icon: string; title: string; desc: string; cta: string; large?: boolean; border?: boolean;
}) {
    return (
        <Link
            href={href}
            className={`flex ${large ? "flex-col md:flex-row md:items-center" : "flex-col"} p-8 rounded-xl ${bg} hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group border ${border ? "border-[#6605c7]/10" : "border-white/50"}`}
        >
            <div className={`flex items-start ${large ? "gap-8 mb-0" : "gap-6 mb-8"}`}>
                <div className={`${large ? "w-16 h-16" : "w-12 h-12"} rounded-xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden p-2.5`} style={{ background: 'rgba(255,255,255,0.85)' }}>
                    <img src={icon} alt={title} className="w-full h-full object-contain" style={{ filter: 'none' }} />
                </div>
                <div className="flex-1">
                    <h3 className={`${large ? "text-xl" : "text-[15px]"} font-bold mb-2 text-gray-900 leading-tight`}>{title}</h3>
                    <p className="text-gray-500 text-[13px] leading-relaxed font-medium">{desc}</p>
                </div>
            </div>
            <div className={`${large ? "mt-6 md:mt-0 md:ml-auto" : "mt-auto"} flex justify-end`}>
                <span className={`inline-flex items-center gap-2 text-[#6605c7] font-bold ${large ? "text-[13px]" : "text-[11px]"} uppercase tracking-widest group-hover:gap-3 transition-all`}>
                    {cta} <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </span>
            </div>
        </Link>
    );
}

function TestimonialsCarousel() {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);
    const itemsPerView = 3;
    const totalSlides = Math.ceil(testimonials.length / itemsPerView);

    useEffect(() => {
        if (!isAutoPlaying) return;
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % totalSlides);
        }, 5000);
        return () => clearInterval(interval);
    }, [isAutoPlaying, totalSlides]);

    const visibleTestimonials = () => {
        const start = currentIndex * itemsPerView;
        return testimonials.slice(start, start + itemsPerView);
    };

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsAutoPlaying(false)}
            onMouseLeave={() => setIsAutoPlaying(true)}
        >
            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[320px]">
                {visibleTestimonials().map((t, idx) => (
                    <motion.div
                        key={`${currentIndex}-${t.name}`}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                        className={`flex flex-col p-8 rounded-xl ${t.bg} hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 group border border-white/50`}
                    >
                        <div className="flex items-start gap-6 mb-8">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm overflow-hidden p-2.5" style={{ background: 'rgba(255,255,255,0.85)' }}>
                                <img src={t.icon} alt={t.name} className="w-full h-full object-contain" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-[15px] font-bold mb-2 text-gray-900 leading-tight">{t.name}</h3>
                                <p className="text-gray-500 text-[13px] leading-relaxed font-medium">{t.school}</p>
                            </div>
                        </div>
                        <p className="text-[13px] text-gray-500 leading-relaxed font-medium flex-1 mb-8">"{t.quote}"</p>
                        <div className="mt-auto flex justify-between items-center">
                            <div className="flex gap-0.5 text-amber-400">
                                {[...Array(5)].map((_, i) => (
                                    <span key={i} className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                ))}
                            </div>
                            <span className="inline-flex items-center gap-2 text-[#6605c7] font-bold text-[11px] uppercase tracking-widest group-hover:gap-3 transition-all">
                                Verified <span className="material-symbols-outlined text-sm">verified</span>
                            </span>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-center gap-6 mt-10">
                {/* Prev Button */}
                <button
                    onClick={() => setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides)}
                    className="w-10 h-10 rounded-full bg-white border border-[#6605c7]/10 flex items-center justify-center text-[#6605c7] hover:bg-[#6605c7] hover:text-white hover:border-[#6605c7] transition-all shadow-sm"
                >
                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>

                {/* Dots */}
                <div className="flex gap-2">
                    {Array.from({ length: totalSlides }).map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${idx === currentIndex
                                ? 'bg-[#6605c7] w-8'
                                : 'bg-[#6605c7]/20 hover:bg-[#6605c7]/40'
                                }`}
                        />
                    ))}
                </div>

                {/* Next Button */}
                <button
                    onClick={() => setCurrentIndex((prev) => (prev + 1) % totalSlides)}
                    className="w-10 h-10 rounded-full bg-white border border-[#6605c7]/10 flex items-center justify-center text-[#6605c7] hover:bg-[#6605c7] hover:text-white hover:border-[#6605c7] transition-all shadow-sm"
                >
                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
            </div>

            {/* Auto-play indicator */}
            <div className="flex justify-center mt-4">
                <span className={`text-[10px] font-bold uppercase tracking-widest transition-opacity ${isAutoPlaying ? 'text-[#6605c7]/40' : 'text-transparent'}`}>
                    Auto-playing
                </span>
            </div>
        </div>
    );
}
const testimonials = [
    { quote: `I recently used BMK Study Abroad Consultants for my application to Texas A&M University-Kingsville for my master's in Mechanical Engineering. They made the entire process, from university selection to visa approval, smooth and stress-free. I'm grateful for their help and highly recommend their services!`, name: "Akhil Sharma", school: "Texas A&M Univ-Kingsville", avatar: "akhil", bg: "bg-[#e7e1f7]", icon: "/images/testimonials/graduation-cap.png" },
    { quote: `My visa was approved with the Bmk consultancy. With the smooth and easy manner. My visa was approved to the university sacred heart University. Thank you very much Bmk consultancy.`, name: "Dudiki Anusha", school: "Sacred Heart University", avatar: "anusha", bg: "bg-[#fdfaf2]", icon: "/images/testimonials/money-bag.png" },
    { quote: `It was a very good experience, supportive and responsive counselors who can guide us for the visa interviews to get positive results. Special thanks to Vamsi Sir, who has good knowledge about University section. Thank you BMK Consultancy.`, name: "Priya Malladi", school: "USA Visa", avatar: "priya", bg: "bg-[#e1f0f7]", icon: "/images/testimonials/handshake.png" },
    { quote: `The best education consultancy for someone planning to study abroad. Their team was professional, patient, and extremely knowledgeable. They made the entire process of applying to universities and obtaining a visa seamless.`, name: "Dhevarapalli Vasanthi", school: "Study Abroad", avatar: "vasanthi", bg: "bg-[#f0e7f7]", icon: "/images/testimonials/ai.png" },
    { quote: `Got my Canada study visa approved successfully! BMK Consultants handled all my paperwork meticulously. Highly recommended for study abroad aspirants!`, name: "Swathi Reddy", school: "Canada Visa", avatar: "swathi", bg: "bg-[#e7f7e1]", icon: "/images/testimonials/time.png" },
    { quote: `Excellent service provided by BMK! They guide thoroughly from shortlisting universities to scheduling the visa interviews. A very transparent and well-organized team.`, name: "Kiran Kumar", school: "Masters in UK", avatar: "kiran", bg: "bg-[#f7e7e1]", icon: "/images/testimonials/university.png" },
];
const postAdmissionServices = [
    { icon: "💳", title: "Forex & Cards", desc: "Lock in the best exchange rates with zero-markup cards.", color: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)", link: "/forex", img: "/images/services/forex-cards.jpg" },
    { icon: "🏠", title: "Student Housing", desc: "Verified accommodations near top global universities.", color: "linear-gradient(135deg, #4c1d95 0%, #5b21b6 100%)", link: "/housing", img: "/images/services/student-housing.jpg" },
    { icon: "📅", title: "Visa Slot Booking", desc: "Priority assistance with automated alerts for availability.", color: "linear-gradient(135deg, #7c2d12 0%, #9a3412 100%)", link: "/visa-slots", img: "/images/services/visa-slot.jpg" },
    { icon: "🎙️", title: "Visa Interview", desc: "Practice with experts who have helped 10k+ students.", color: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)", link: "/apply-loan", img: "/images/services/visa-interview.jpg" },
    { icon: "📦", title: "Courier Services", desc: "Send documents globally with student discounts.", color: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)", link: "/courier", img: "/images/services/courier.jpg" },
    { icon: "🏦", title: "Bank Account", desc: "Global accounts with zero student fees.", color: "linear-gradient(135deg, #164e63 0%, #155e75 100%)", link: "/bank-account", img: "/images/services/bank-account.jpg" },
];
export default function HomeContent() {
    const [disbursedText, setDisbursedText] = useState("₹100Cr+");

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch("/api/reference/disbursed-amount");
                const json = await res.json();
                if (json?.success && json.data) {
                    setDisbursedText(json.data.formatted);
                }
            } catch (e) {
                console.error("Error fetching disbursed stats on client:", e);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="relative min-h-screen text-gray-900">
            <div className="relative z-10">
                {/* Floating Gift / Referral Icon */}
                <Link
                    href="/referral"
                    className="fixed left-6 top-[75%] -translate-y-1/2 z-50 group transition-all duration-300 hidden md:block"
                    title="Refer & Earn — Locked (Coming Soon)"
                >
                    <div className="relative flex items-center gap-0">
                        <span className="absolute left-16 whitespace-nowrap bg-[#1a1626] text-white text-[10px] font-black uppercase tracking-[0.3em] px-4 py-2 border-l-4 border-[#e0c389] shadow-2xl opacity-0 -translate-x-4 pointer-events-none group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-xs text-amber-400">lock</span>
                            <span>LOCKED — COMING SOON ⚡</span>
                        </span>
                        <div className="w-14 h-14 bg-[#6605c7] flex items-center justify-center text-white shadow-[8px_8px_0px_rgba(224,195,137,0.4)] border border-white/20 group-hover:translate-x-1 group-hover:translate-y-1 group-hover:shadow-none transition-all duration-200 relative overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent" />
                            <span className="material-symbols-outlined text-2xl relative z-10 transition-transform group-hover:scale-125">card_giftcard</span>
                            <div className="absolute -top-1 -right-1 z-20 w-5 h-5 bg-amber-600 text-white rounded-full flex items-center justify-center shadow-md border-2 border-white">
                                <span className="material-symbols-outlined text-[11px] font-bold">lock</span>
                            </div>
                        </div>
                    </div>
                </Link>

                {/* Hero Section */}
                <motion.section
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative min-h-screen flex items-center pt-8 overflow-hidden bg-transparent"
                >
                    <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center relative z-10 w-full">
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                        >
                            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full mb-8 border border-[#6605c7]/15 bg-white/60 backdrop-blur-sm" >
                                <span className="w-2 h-2 rounded-full bg-[#6605c7] animate-pulse flex-shrink-0" />
                                <span className="text-[#6605c7] text-[11px] font-black uppercase tracking-widest">Trusted by 10,000+ students across 20+ countries</span>
                            </div>

                            <h1 className="text-4xl md:text-5xl font-black leading-[1.1] mb-8 text-[#1a1626] tracking-tight uppercase">
                                Fund Your <span className="text-[#6605c7]">Dream</span> <br /> Education Abroad
                            </h1>

                            <p className="text-[15px] text-gray-500 mb-10 leading-relaxed font-medium max-w-lg">
                                Compare education loans from our top lending partners. Get the best rates, quick approvals, and expert guidance — all in one place.
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 mb-12">
                                <Link
                                    href="/apply-loan"
                                    className="px-8 py-4 bg-[#6605c7] text-white font-bold rounded-xl text-center text-[13px] uppercase tracking-widest whitespace-nowrap transition-all hover:-translate-y-1 hover:shadow-2xl hover:bg-[#5204a0]"
                                >
                                    Check Your Eligibility
                                </Link>
                                <Link
                                    href="/compare-loans"
                                    className="px-8 py-4 bg-white/60 backdrop-blur-sm border border-[#6605c7]/15 text-[#6605c7] font-bold rounded-xl text-center text-[13px] uppercase tracking-widest whitespace-nowrap transition-all hover:-translate-y-1 hover:shadow-xl"
                                >
                                    Compare Rates
                                </Link>
                            </div>

                            <div className="flex items-center gap-6 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-0.5 text-amber-400">
                                        {[...Array(5)].map((_, i) => <span key={i} className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>)}
                                    </div>
                                    <div className="text-[11px] text-gray-400 font-black uppercase tracking-widest">2,000+ reviews</div>
                                </div>
                                <div className="hidden sm:block w-px h-10 bg-gray-100" />
                                {[
                                    { val: '50+', label: 'Lenders' },
                                    { val: '48h', label: 'Approval' },
                                    { val: disbursedText, label: 'Disbursed' },
                                ].map(s => (
                                    <div key={s.label} className="text-left">
                                        <div className="text-[15px] font-black text-[#6605c7] leading-none mb-1">
                                            <AnimatedCounter value={s.val} />
                                        </div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
                            className="relative lg:pl-10"
                        >
                            <div className="absolute inset-x-0 bottom-[-10%] h-[100%] scale-105 rounded-xl blur-3xl opacity-20" style={{ background: 'linear-gradient(135deg, #d8b4fe, #fed7aa)' }} />
                            <div className="relative rounded-xl overflow-hidden shadow-2xl border-[6px] border-white/60 group">
                                <Image
                                    src="/images/hero/students-abroad.jpg"
                                    alt="Students studying abroad"
                                    width={1200}
                                    height={900}
                                    className="w-full h-auto object-cover transition-transform duration-1000 group-hover:scale-105"
                                    priority
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                            </div>

                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.6, duration: 0.5 }}
                                className="absolute -bottom-6 -left-4 flex items-center gap-4 px-6 py-4 rounded-xl shadow-2xl border border-white/50 bg-white/60 backdrop-blur-md"
                            >
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-[#6605c7]/10 border border-[#6605c7]/20">
                                    <span className="material-symbols-outlined text-[#6605c7] text-2xl" style={{ fontVariationSettings: '"FILL" 1' }}>verified</span>
                                </div>
                                <div>
                                    <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-0.5">Lowest Interest</div>
                                    <div className="text-2xl font-black text-gray-900 leading-none">8.5% <span className="text-[11px] font-bold text-gray-400">p.a.</span></div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 1.0, duration: 0.5 }}
                                className="absolute right-6 bottom-6 z-30"
                            >
                                <ReferCard />
                            </motion.div>

                            <motion.div
                                initial={{ y: -20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.8, duration: 0.5 }}
                                className="absolute -top-4 -right-4 flex items-center gap-4 px-5 py-3 rounded-xl shadow-2xl border border-white/50 bg-white/60 backdrop-blur-md"
                            >
                                <span className="text-3xl">⚡</span>
                                <div>
                                    <div className="text-[10px] text-gray-500 uppercase font-black tracking-widest mb-0.5">Speed</div>
                                    <div className="text-base font-black text-gray-900 leading-none">48 Hours</div>
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>
                </motion.section>

                {/* Trust Badges */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: false, amount: 0.3 }}
                    transition={{ duration: 0.6 }}
                    className="bg-white border-t border-gray-100 py-12 shadow-sm"
                >
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                            {[
                                { icon: "account_balance", num: "50+", label: "Lending Partners" },
                                { icon: "speed", num: "48hrs", label: "Quick Approval" },
                                { icon: "verified_user", num: "100%", label: "Secure & Trusted" },
                                { icon: "public", num: "30+", label: "Countries Covered" },
                            ].map((s, idx) => (
                                <motion.div
                                    key={s.label}
                                    initial={{ opacity: 0, x: idx % 2 === 0 ? -60 : 60 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.7, delay: idx * 0.12, ease: [0.16, 1, 0.3, 1] }}
                                    viewport={{ once: false, amount: 0.3 }}
                                    className="flex items-center gap-4 group cursor-default"
                                >
                                    <div className="w-10 h-10 bg-[#6605c7]/5 rounded-lg flex items-center justify-center text-[#6605c7] group-hover:bg-[#6605c7] group-hover:text-white group-hover:scale-110 transition-all duration-300">
                                        <span className="material-symbols-outlined text-2xl">{s.icon}</span>
                                    </div>
                                    <div>
                                        <div className="text-xl font-bold text-gray-900">
                                            <AnimatedCounter value={s.num} />
                                        </div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{s.label}</div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* Why Choose Us */}
                <motion.section
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: false, amount: 0.1 }}
                    transition={{ duration: 0.4 }}
                    className="py-24 bg-transparent overflow-hidden"
                >
                    <div className="max-w-7xl mx-auto px-6">
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                            viewport={{ once: false, amount: 0.3 }}
                            className="text-center mb-16"
                        >
                            <span className="text-[#6605c7] font-black text-[11px] tracking-widest uppercase mb-4 block">Benefits</span>
                            <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-6 uppercase tracking-tight">
                                Education Finance <br className="hidden md:block" />
                                <span className="text-[#6605c7]">Simplified</span> for You
                            </h2>
                            <p className="text-gray-500 text-[13px] font-medium max-w-2xl mx-auto">
                                We've removed the complexity from education loans. Access guaranteed best rates and expert guidance in one place.
                            </p>
                        </motion.div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {features.map((f, idx) => (
                                <motion.div
                                    key={f.title}
                                    initial={{
                                        opacity: 0,
                                        x: idx % 3 === 0 ? -70 : idx % 3 === 2 ? 70 : 0,
                                        y: idx % 3 === 1 ? 60 : 0
                                    }}
                                    whileInView={{ opacity: 1, x: 0, y: 0 }}
                                    transition={{ duration: 0.7, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                                    viewport={{ once: false, amount: 0.2 }}
                                    className="p-8 rounded-xl border border-white/50 bg-white/60 backdrop-blur-sm shadow-sm hover:shadow-2xl hover:-translate-y-2 hover:bg-white/80 hover:border-[#6605c7]/20 transition-all duration-400 group cursor-default"
                                >
                                    <div className="w-12 h-12 bg-[#6605c7]/5 rounded-xl flex items-center justify-center text-[#6605c7] mb-6 group-hover:bg-[#6605c7] group-hover:text-white group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                                        <span className="material-symbols-outlined text-2xl">{f.icon}</span>
                                    </div>
                                    <h3 className="text-[17px] font-black mb-3 text-gray-900 group-hover:text-[#6605c7] transition-colors duration-300">{f.title}</h3>
                                    <p className="text-[13px] text-gray-500 leading-relaxed font-medium">{f.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.section>

                <JourneyPath />

                {/* Study Abroad Universe */}
                <UniverseEcosystem />

                {/* AI Tools Section */}
                <motion.section
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: false, amount: 0.05 }}
                    transition={{ duration: 0.4 }}
                    className="py-24 bg-transparent overflow-hidden relative"
                >
                    <div className="max-w-7xl mx-auto px-6 relative z-10">
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: false, amount: 0.3 }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                            className="text-center mb-20"
                        >
                            <span className="inline-block px-4 py-2 rounded-full bg-[#6605c7]/5 text-[#6605c7] text-[10px] font-black uppercase tracking-widest mb-4 border border-[#6605c7]/10">Premium AI Ecosystem</span>
                            <h2 className="text-3xl md:text-5xl font-black mb-6 text-gray-900 uppercase tracking-tight">
                                Smart Tools for <span className="text-[#6605c7]">Global Success</span>
                            </h2>
                            <p className="text-[13px] text-gray-500 max-w-2xl mx-auto font-medium">Empowering your study abroad journey with data-driven insights and AI precision.</p>
                        </motion.div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <motion.div initial={{ opacity: 0, x: -70 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
                                    <ToolCard
                                        href="/sop-writer"
                                        bg="bg-[#e7e1f7]"
                                        icon="/images/tools/sop-writer.png"
                                        title="Automated SOP Writer"
                                        desc="Draft your Statement of Purpose evaluated on matter, grammar, and readability using AI."
                                        cta="Submit SOP"
                                    />
                                </motion.div>
                                <motion.div initial={{ opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
                                    <ToolCard
                                        href="/admit-predictor"
                                        bg="bg-[#fdfaf2]"
                                        icon="/images/tools/earnings.png"
                                        title="Estimate Future Earnings"
                                        desc="Project your potential future earnings and compare countries based on ROI."
                                        cta="Estimate Now"
                                    />
                                </motion.div>
                                <motion.div initial={{ opacity: 0, x: 70 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}>
                                    <ToolCard
                                        href="/compare-universities"
                                        bg="bg-[#e1f0f7]"
                                        icon="/images/tools/compare-uni.png"
                                        title="University Compare"
                                        desc="Get insights on income, employability, costs, and top recruiters of up to 4 universities."
                                        cta="Compare Now"
                                    />
                                </motion.div>
                            </div>

                            <div className="max-w-3xl mx-auto">
                                <motion.div initial={{ opacity: 0, scale: 0.92 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}>
                                    <ToolCard
                                        href="/admit-predictor"
                                        bg="bg-[#e7e1f7]"
                                        icon="/images/tools/admit-predictor.png"
                                        title="Admit Predictor"
                                        desc="Check the probability of your MS in US admission. Predict your admission chances with 98% accuracy."
                                        cta="Evaluate Now"
                                        large
                                    />
                                </motion.div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <motion.div initial={{ opacity: 0, x: -70 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
                                    <ToolCard
                                        href="/grade-converter"
                                        bg="bg-[#e1f0f7]"
                                        icon="/images/tools/calculator.png"
                                        title="Grade Converter"
                                        desc="Convert your percentage or 10-point CGPA to GPA score with just a single click."
                                        cta="Convert Now"
                                    />
                                </motion.div>
                                <motion.div initial={{ opacity: 0, y: 60 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}>
                                    <ToolCard
                                        href="/emi"
                                        bg="bg-white"
                                        icon="/images/tools/calculator.png"
                                        title="EMI Calculator"
                                        desc="Determine your EMIs and repayment schedules before committing to a student loan."
                                        cta="Calculate Now"
                                        border
                                    />
                                </motion.div>
                                <motion.div initial={{ opacity: 0, x: 70 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: false, amount: 0.2 }} transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}>
                                    <ToolCard
                                        href="/loan-eligibility"
                                        bg="bg-[#e7e1f7]"
                                        icon="/images/tools/loan-eligibility.png"
                                        title="Loan Eligibility Checker"
                                        desc="Find the best education loan for you in just 2 minutes with our intelligent checker."
                                        cta="Check Eligibility"
                                    />
                                </motion.div>
                            </div>
                        </div>

                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: false, amount: 0.3 }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                            className="mt-12 flex flex-wrap justify-center gap-12 text-center border-t border-black/5 pt-12"
                        >
                            {[
                                { num: "3,000+", label: "Universities Covered" },
                                { num: "98%", label: "Accuracy Rate" },
                                { num: "1000+", label: "Students Helped" }
                            ].map((s, idx) => (
                                <motion.div
                                    key={s.label}
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: false, amount: 0.3 }}
                                    transition={{ duration: 0.5, delay: idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    <div className="text-4xl font-bold text-gray-900">
                                        <AnimatedCounter value={s.num} />
                                    </div>
                                    <div className="text-xs text-gray-500 uppercase font-bold tracking-widest mt-1">{s.label}</div>
                                </motion.div>
                            ))}
                        </motion.div>
                    </div>
                </motion.section>

                {/* Testimonials */}
                <motion.section
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: false, amount: 0.1 }}
                    transition={{ duration: 0.4 }}
                    className="py-24 bg-transparent"
                >
                    <div className="max-w-7xl mx-auto px-6">
                        <motion.div
                            initial={{ opacity: 0, y: 40 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: false, amount: 0.3 }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                            className="text-center mb-16"
                        >
                            <span className="text-[#6605c7] font-black text-[11px] tracking-widest uppercase mb-4 block">Testimonials</span>
                            <h2 className="text-3xl md:text-5xl font-black text-gray-900 uppercase tracking-tight">Loved by <span className="text-[#6605c7]">10,000+</span> Students</h2>
                        </motion.div>
                        <TestimonialsCarousel />
                    </div>
                </motion.section>

                {/* Post Admission Services Section */}
                <motion.section
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: false, amount: 0.05 }}
                    transition={{ duration: 0.4 }}
                    className="py-24 bg-transparent overflow-hidden relative"
                >
                    <div className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-[#6605c7]/5 rounded-full blur-[100px] -mr-[10vw] -mt-[10vw] pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-blue-500/5 rounded-full blur-[100px] -ml-[10vw] -mb-[10vw] pointer-events-none" />

                    <div className="max-w-7xl mx-auto px-6 relative z-10">
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                            viewport={{ once: false, amount: 0.3 }}
                            className="text-center mb-16"
                        >
                            <span className="inline-block px-4 py-1.5 rounded-full bg-[#6605c7]/10 text-[#6605c7] text-[11px] font-black uppercase tracking-widest mb-4 border border-[#6605c7]/15">
                                VALUE ADDED SERVICES
                            </span>
                            <h2 className="text-3xl md:text-5xl font-black text-gray-900 leading-tight uppercase tracking-tight">
                                Beyond Admissions:<br />
                                <span style={{ background: 'linear-gradient(135deg, #6605c7, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Post-Admission Services</span>
                            </h2>
                            <p className="text-gray-500 text-[13px] mt-4 max-w-lg mx-auto leading-relaxed font-medium">
                                We stay with you even after you receive your offer letter. Complete your pre-departure checklist with our curated global services.
                            </p>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {postAdmissionServices.map((service, index) => (
                                <motion.div
                                    key={index}
                                    initial={{
                                        opacity: 0,
                                        x: index % 3 === 0 ? -70 : index % 3 === 2 ? 70 : 0,
                                        y: index % 3 === 1 ? 60 : 0
                                    }}
                                    whileInView={{ opacity: 1, x: 0, y: 0 }}
                                    transition={{ duration: 0.7, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                                    viewport={{ once: false, amount: 0.15 }}
                                    className="group relative overflow-hidden rounded-xl bg-white/60 backdrop-blur-sm border border-white/50 shadow-sm hover:shadow-2xl hover:-translate-y-2 hover:bg-white/80 hover:border-[#6605c7]/15 transition-all duration-400"
                                >
                                    <div className="h-40 overflow-hidden relative">
                                        <Image src={service.img} alt={service.title} fill className="object-cover group-hover:scale-110 transition-transform duration-700" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                        <div className="absolute bottom-4 left-4 flex items-center gap-2">
                                            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-xl">
                                                {service.icon}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-6">
                                        <h3 className="text-[17px] font-black mb-2 text-gray-900">{service.title}</h3>
                                        <p className="text-[13px] text-gray-500 mb-6 leading-relaxed font-medium line-clamp-2">
                                            {service.desc}
                                        </p>
                                        <Link
                                            href={service.link}
                                            className="text-[11px] font-black text-[#6605c7] inline-flex items-center gap-2 group-hover:gap-3 transition-all uppercase tracking-widest"
                                        >
                                            Learn More <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                        </Link>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </motion.section>

                {/* Final CTA */}
                <section className="py-24 bg-transparent mb-12">
                    <div className="max-w-5xl mx-auto px-6">
                        <motion.div
                            initial={{ opacity: 0, y: 50, scale: 0.97 }}
                            whileInView={{ opacity: 1, y: 0, scale: 1 }}
                            viewport={{ once: false, amount: 0.3 }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            className="bg-[#6605c7] rounded-xl p-12 md:p-20 text-center text-white relative overflow-hidden shadow-2xl hover:shadow-[0_30px_80px_-15px_#6605c760] transition-shadow duration-500"
                        >
                            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-[100px] -mr-48 -mt-48" />
                            <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/10 rounded-full blur-[100px] -ml-48 -mb-48" />
                            <h2 className="text-3xl md:text-5xl font-black mb-8 relative z-10 leading-[1.1] tracking-tight uppercase">Ready to Fund Your <span className="italic text-purple-200">Global Dreams?</span></h2>
                            <p className="text-[15px] text-white/80 mb-12 max-w-2xl mx-auto relative z-10 font-medium leading-relaxed">
                                Join 10,000+ students who have found their perfect education loan. <br className="hidden md:block" /> Get expert guidance and multiple offers in under 5 minutes.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-6 justify-center relative z-10">
                                <Link href="/apply-loan" className="px-10 py-5 bg-white text-[#6605c7] font-black rounded-xl shadow-xl hover:-translate-y-1 transition-all text-[13px] uppercase tracking-widest">Apply Online Now</Link>
                                <Link href="/emi" className="px-10 py-5 bg-[#6605c7]/20 text-white border border-white/30 font-black rounded-xl hover:bg-white/10 transition-all text-[13px] uppercase tracking-widest">Try EMI Calculator</Link>
                            </div>
                        </motion.div>
                    </div>
                </section>
            </div>
        </div>
    );
}
