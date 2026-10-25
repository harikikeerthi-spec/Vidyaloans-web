"use client";

import React, { useState, useEffect } from "react";
import ImageLightbox from './ImageLightbox';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { universityApi } from "@/lib/api";

export interface UniversityData {
    slug: string;
    name: string;
    shortName: string;
    location: string;
    country: string;
    countryCode: string;
    flag: string;
    founded: number;
    type: string;
    rank: number;
    rankBy: string;
    acceptanceRate: number;
    tuition: number;
    currency: string;
    description: string;
    heroImage: string;
    campusImages: string[];
    logo: string;
    primaryColor: string;
    gradient: string;
    badge: string;
    website: string;
    stats: {
        totalStudents: string;
        internationalStudents: string;
        facultyRatio: string;
        researchOutput: string;
        employmentRate: string;
        avgSalary: string;
    };
    programs: {
        name: string;
        degree: string;
        duration: string;
        tuition: string;
        icon: string;
    }[];
    topRecruiters: string[];
    requirements: {
        gpa: string;
        ielts: string;
        toefl: string;
        gre: string;
    };
    loanInfo: {
        availableLenders: string[];
        avgLoanAmount: string;
        collateralFree: boolean;
        fastTrack: boolean;
        notes: string;
    };
    pros: string[];
    campusFacilities: any[];
    funFacts?: string[];
    whyStudyHere?: string[];
    notableAlumni?: any[];
}

const getTuitionInINR = (tuition?: number, country?: string) => {
  if (!tuition) return '—';
  const normalizedCountry = (country || '').toLowerCase().trim();
  let rate = 84; // Default USD rate
  if (normalizedCountry.includes('usa') || normalizedCountry.includes('united states') || normalizedCountry.includes('us')) {
    rate = 84;
  } else if (normalizedCountry.includes('canada') || normalizedCountry.includes('ca')) {
    rate = 61;
  } else if (normalizedCountry.includes('united kingdom') || normalizedCountry.includes('uk') || normalizedCountry.includes('gb') || normalizedCountry.includes('england')) {
    rate = 106;
  } else if (normalizedCountry.includes('germany') || normalizedCountry.includes('france') || normalizedCountry.includes('ireland') || normalizedCountry.includes('spain') || normalizedCountry.includes('europe') || normalizedCountry.includes('de') || normalizedCountry.includes('fr') || normalizedCountry.includes('ie') || normalizedCountry.includes('es')) {
    rate = 90;
  } else if (normalizedCountry.includes('australia') || normalizedCountry.includes('au')) {
    rate = 55;
  } else if (normalizedCountry.includes('singapore') || normalizedCountry.includes('sg')) {
    rate = 62;
  } else if (normalizedCountry.includes('uae') || normalizedCountry.includes('united arab emirates') || normalizedCountry.includes('ae')) {
    rate = 22.8;
  }
  const inr = tuition * rate;
  if (inr >= 100000) {
    const lakhs = inr / 100000;
    return `₹${lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(1)}L`;
  }
  return `₹${Math.round(inr).toLocaleString('en-IN')}`;
};

interface UniversityDetailViewProps {
    university: UniversityData;
    onApply?: (uni: UniversityData) => void;
    onClose?: () => void;
}

export default function UniversityDetailView({ university: initialUni, onApply, onClose }: UniversityDetailViewProps) {
    const router = useRouter();
    const normalizeUni = (data: any): UniversityData => {
        if (!data) return {} as UniversityData;
        return {
            ...data,
            shortName: data.shortName || (data.name ? data.name.split(' ')[0] : 'University'),
            location: data.location || data.loc || '',
            country: data.country || '',
            founded: data.founded || 1900,
            rank: data.rank || 0,
            rankBy: data.rankBy || 'QS',
            acceptanceRate: data.acceptanceRate || data.accept || 0,
            tuition: data.tuition || 0,
            currency: data.currency || 'USD',
            description: data.description || '',
            programs: (Array.isArray(data.programs) ? data.programs : (Array.isArray(data.courses) ? data.courses : [])).map((p: any) => {
                if (typeof p === 'string') return { name: p, degree: "Master's", duration: '2 Years', tuition: 'See Website', icon: 'school' };
                return {
                    name: p.name || p.title || 'Program',
                    degree: p.degree || "Master's",
                    duration: p.duration || '2 Years',
                    tuition: p.tuition || 'See Website',
                    icon: p.icon || 'auto_stories'
                };
            }),
            pros: Array.isArray(data.pros) ? data.pros : [],
            stats: {
                totalStudents: String(data.stats?.totalStudents || '—'),
                internationalStudents: String(data.stats?.internationalStudents || '—'),
                facultyRatio: String(data.stats?.facultyRatio || '—'),
                researchOutput: String(data.stats?.researchOutput || '—'),
                employmentRate: String(data.stats?.employmentRate || '—'),
                avgSalary: String(data.stats?.avgSalary || '—'),
            },
            requirements: {
                gpa: String(data.requirements?.gpa || '—'),
                ielts: String(data.requirements?.ielts || '—'),
                toefl: String(data.requirements?.toefl || '—'),
                gre: String(data.requirements?.gre || '—'),
            },
            loanInfo: {
                availableLenders: Array.isArray(data.loanInfo?.availableLenders) ? data.loanInfo.availableLenders : [],
                avgLoanAmount: data.loanInfo?.avgLoanAmount || '—',
                collateralFree: !!data.loanInfo?.collateralFree,
                fastTrack: !!data.loanInfo?.fastTrack,
                notes: data.loanInfo?.notes || '',
            },
            campusFacilities: Array.isArray(data.campusFacilities) ? data.campusFacilities : [],
            topRecruiters: Array.isArray(data.topRecruiters) ? data.topRecruiters : [],
            campusImages: Array.isArray(data.campusImages) ? data.campusImages : (Array.isArray(data.images) ? data.images : []),
            funFacts: Array.isArray(data.funFacts) ? data.funFacts : [],
            whyStudyHere: Array.isArray(data.whyStudyHere) ? data.whyStudyHere : [],
            notableAlumni: Array.isArray(data.notableAlumni) ? data.notableAlumni : [],
        };
    };

    const [u, setU] = useState<UniversityData>(normalizeUni(initialUni));

    useEffect(() => {
        setU(normalizeUni(initialUni));
    }, [initialUni]);
    const [loading, setLoading] = useState(false);
    const [activeSection, setActiveSection] = useState("overview");
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    // University Inquiry States
    const { user, isAuthenticated } = useAuth();
    const [hasInquiry, setHasInquiry] = useState<{ callback: boolean; fasttrack: boolean }>({
        callback: false,
        fasttrack: false
    });
    const [showInquiryModal, setShowInquiryModal] = useState(false);
    const [inquiryType, setInquiryType] = useState<'callback' | 'fasttrack'>('callback');
    const [formData, setFormData] = useState({ name: '', email: '', mobile: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        // Sync formData with user if authenticated
        if (isAuthenticated && user) {
            setFormData({
                name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                email: user.email,
                mobile: user.mobile || user.phoneNumber || ''
            });
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        const checkInquiries = async () => {
            if (!u.name) return;
            const email = user?.email || localStorage.getItem('guest_email');
            if (!email) return;

            try {
                const cb = await universityApi.checkInquiry(email, u.name, 'callback');
                const ft = await universityApi.checkInquiry(email, u.name, 'fasttrack');
                setHasInquiry({ callback: cb.exists, fasttrack: ft.exists });
            } catch (e) {
                console.error("Check inquiry error", e);
            }
        };

        checkInquiries();
    }, [u.name, user?.email]);

    const handleInquirySubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!formData.name || !formData.email || !formData.mobile) {
            alert("Please fill all details");
            return;
        }

        setIsSubmitting(true);
        try {
            await universityApi.submitInquiry({
                ...formData,
                universityName: u.name,
                type: inquiryType,
                userId: user?.id
            });

            // Persist guest email for future checks
            if (!isAuthenticated) {
                localStorage.setItem('guest_email', formData.email);
            }

            setHasInquiry(prev => ({ ...prev, [inquiryType]: true }));
            setSuccessMsg(`Your ${inquiryType} request has been sent!`);
            setTimeout(() => {
                setShowInquiryModal(false);
                setSuccessMsg('');
            }, 3000);
        } catch (error) {
            alert("Failed to submit inquiry. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openInquiry = (type: 'callback' | 'fasttrack') => {
        setInquiryType(type);
        if (isAuthenticated && user?.firstName && user?.mobile) {
            // Already have data, just submit
            const full_name = `${user.firstName} ${user.lastName || ''}`.trim();
            const email = user.email;
            const mobile = user.mobile || user.phoneNumber || '';

            setFormData({ name: full_name, email, mobile });

            // Auto submit if all details are present
            if (full_name && email && mobile) {
                // Actually, maybe better to show confirmation
                setShowInquiryModal(true);
            } else {
                setShowInquiryModal(true);
            }
        } else {
            setShowInquiryModal(true);
        }
    };

    const logoFallback = (() => {
        // Try Clearbit logo from website domain first, then fall back to initials
        if (u.website) {
            try {
                const domain = new URL(u.website).hostname.replace(/^www\./, '');
                return `https://logo.clearbit.com/${domain}`;
            } catch { /* ignore */ }
        }
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=6605c7&color=fff`;
    })();

    // AI enrichment is now handled by the parent UniversityPageClient

    const handleScroll = (id: string) => {
        setActiveSection(id);
        const el = document.getElementById(id);
        if (el) {
            const offset = 100;
            const bodyRect = document.body.getBoundingClientRect().top;
            const elementRect = el.getBoundingClientRect().top;
            const elementPosition = elementRect - bodyRect;
            const offsetPosition = elementPosition - offset;

            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth"
            });
        }
    };

    const navItems = [
        { id: 'overview', label: 'Overview', icon: 'info' },
        { id: 'programs', label: 'Programs', icon: 'auto_stories' },
        { id: 'admissions', label: 'Admissions', icon: 'assignment_turned_in' },
        { id: 'scholarships', label: 'Scholarships', icon: 'card_giftcard' },
        { id: 'campus-life', label: 'Campus life', icon: 'apartment' },
        { id: 'alumni', label: 'Alumni', icon: 'groups_3' },
        { id: 'admission-support', label: 'Admission Support', icon: 'support_agent' },
        { id: 'financing', label: 'Financing', icon: 'payments' },
    ];

    return (
        <div className="min-h-screen bg-[#fcfaff]">
            {/* ── HERO SECTION ── */}
            <section className="relative h-[70vh] min-h-[540px] flex items-end overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img
                        src={u.heroImage || "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1600&q=80"}
                        alt={u.name}
                        className="w-full h-full object-cover scale-105 transition-transform duration-[20s] hover:scale-110"
                        onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.onerror = null;
                            target.src = "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1600&q=80";
                        }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a0b2e] via-[#1a0b2e]/70 to-[#1a0b2e]/20" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#1a0b2e]/50 to-transparent" />
                    {/* Decorative mesh pattern */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
                </div>

                <button
                    onClick={() => onClose ? onClose() : router.back()}
                    className="absolute top-8 right-8 z-50 w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all shadow-2xl"
                >
                    <span className="material-symbols-outlined">close</span>
                </button>

                <div className="max-w-[1600px] mx-auto w-full px-8 pb-16 relative z-10 flex flex-col md:flex-row items-end justify-between gap-8">
                    <div className="flex-1 flex items-start gap-6">
                        <div className="w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center overflow-hidden border border-white/20 shadow-2xl ring-4 ring-white/5">
                            <img
                                src={u.logo || logoFallback}
                                alt={u.name}
                                className="w-full h-full object-contain p-1"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.onerror = null;
                                    target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=6605c7&color=fff&size=128`;
                                }}
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="px-3 py-1.5 bg-[#6605c7] text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-purple-500/30">{u.badge || 'AI Verified'}</span>
                                <span className="text-sm font-bold text-white/80">{u.country}</span>
                            </div>
                            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-4 tracking-tight leading-[1.05] drop-shadow-2xl" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>{u.name}</h1>
                            <div className="flex flex-wrap items-center gap-5 text-white/70 font-semibold text-sm">
                                <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#e0c389]">location_on</span>{u.location}, {u.country}</div>
                                <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#e0c389]">workspace_premium</span>Rank #{u.rank} ({u.rankBy} Rankings)</div>
                                <div className="flex items-center gap-2"><span className="material-symbols-outlined text-[#e0c389]">history_edu</span>Founded {u.founded}</div>
                            </div>
                            {u.website && (
                                <a href={u.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 mt-4 text-[#e0c389] hover:text-white transition-colors text-sm font-bold group">
                                    <span className="material-symbols-outlined text-sm">public</span>
                                    <span>{u.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</span>
                                    <span className="material-symbols-outlined text-xs group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">north_east</span>
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-5 shrink-0">
                        <div className="text-right px-6 py-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                            <div className="text-[#e0c389] text-[10px] font-black uppercase tracking-widest mb-1">Acceptance Rate</div>
                            <div className="text-3xl font-black text-white">{u.acceptanceRate}%</div>
                        </div>
                        <div className="text-right px-6 py-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                            <div className="text-[#e0c389] text-[10px] font-black uppercase tracking-widest mb-1">Avg. Tuition</div>
                            <div className="text-3xl font-black text-white">{getTuitionInINR(u.tuition, u.country)}</div>
                        </div>
                        <div className="ml-2 flex flex-col gap-3">
                            {u.website && (
                                <a href={u.website} target="_blank" rel="noreferrer" className="px-5 py-3 bg-white text-gray-900 font-black text-sm rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all text-center">Visit Website</a>
                            )}

                            <button
                                onClick={() => openInquiry('callback')}
                                disabled={hasInquiry.callback}
                                className={`px-5 py-3 font-black text-sm rounded-xl shadow-lg transition-all text-center flex items-center justify-center gap-2 ${hasInquiry.callback ? 'bg-green-100 text-green-700 border border-green-200 cursor-default' : 'bg-amber-500 text-white shadow-amber-500/30 hover:shadow-xl hover:-translate-y-0.5'}`}
                            >
                                <span className="material-symbols-outlined text-sm">{hasInquiry.callback ? 'check_circle' : 'call'}</span> 
                                {hasInquiry.callback ? 'Thanks for Requesting' : 'Request a Callback'}
                            </button>

                            <button
                                onClick={() => openInquiry('fasttrack')}
                                disabled={hasInquiry.fasttrack}
                                className={`px-5 py-3 font-black text-sm rounded-xl shadow-lg transition-all text-center flex items-center justify-center gap-2 ${hasInquiry.fasttrack ? 'bg-green-100 text-green-700 border border-green-200 cursor-default' : 'bg-indigo-600 text-white shadow-indigo-500/30 hover:shadow-xl hover:-translate-y-0.5'}`}
                            >
                                <span className="material-symbols-outlined text-sm">{hasInquiry.fasttrack ? 'check_circle' : 'bolt'}</span>
                                {hasInquiry.fasttrack ? 'Thanks for Fastracking' : 'Fastrack Application'}
                            </button>

                            <Link href={`/apply-loan?university=${encodeURIComponent(u.name)}&country=${encodeURIComponent(u.country)}`} className="px-5 py-3 bg-gradient-to-r from-[#6605c7] to-[#a855f7] text-white font-black text-sm rounded-xl shadow-lg shadow-purple-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all text-center">Start Loan Application</Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── STICKY NAVIGATION ── */}
            <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur-2xl border-b border-gray-100 px-6 py-2 shadow-sm hidden md:block">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleScroll(item.id)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-[0.15em] transition-all whitespace-nowrap ${activeSection === item.id
                                    ? "bg-[#1a0b2e] text-white shadow-lg shadow-purple-500/15"
                                    : "text-gray-400 hover:text-gray-900 hover:bg-gray-50"
                                    }`}
                            >
                                <span className="material-symbols-outlined text-base">{item.icon}</span>
                                {item.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => openInquiry('callback')}
                            disabled={hasInquiry.callback}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${hasInquiry.callback ? 'bg-green-50 text-green-600 border-green-200 cursor-default' : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'}`}
                        >
                            <span className="material-symbols-outlined text-sm">{hasInquiry.callback ? 'check_circle' : 'call'}</span>
                            {hasInquiry.callback ? 'Callback Sent' : 'Callback'}
                        </button>
                        <button
                            onClick={() => openInquiry('fasttrack')}
                            disabled={hasInquiry.fasttrack}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-2 ${hasInquiry.fasttrack ? 'bg-green-50 text-green-600 border-green-200 cursor-default' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'}`}
                        >
                            <span className="material-symbols-outlined text-sm">{hasInquiry.fasttrack ? 'check_circle' : 'bolt'}</span>
                            {hasInquiry.fasttrack ? 'Fastrack Sent' : 'Fastrack'}
                        </button>
                        <Link
                            href={`/apply-loan?university=${encodeURIComponent(u.name)}&country=${encodeURIComponent(u.country)}`}
                            className="px-6 py-3 bg-gradient-to-r from-[#6605c7] to-[#8b24e5] text-white font-bold text-xs uppercase tracking-[0.15em] rounded-xl shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 transition-all hover:-translate-y-0.5"
                        >
                            Apply Now
                        </Link>
                    </div>
                </div>
            </nav>

            {/* ── CONTENT GRID ── */}
            <div className="max-w-[1600px] mx-auto px-6 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                    {/* Left Main Content (8 cols) */}
                    <div className="lg:col-span-8 space-y-20">

                        {/* Overview Section */}
                        <section id="overview">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                                    <span className="material-symbols-outlined">info</span>
                                </div>
                                <h2 className="text-3xl font-display font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>University Overview</h2>
                            </div>
                            <div className="bg-white rounded-[2.5rem] p-10 shadow-xl shadow-purple-500/5 border border-purple-50 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <img src={u.logo || logoFallback} alt="" className="w-64 h-64 grayscale object-contain" />
                                </div>
                                <p className="text-gray-600 text-lg leading-relaxed mb-10 relative z-10">
                                    {u.description}
                                </p>

                                {u.whyStudyHere && u.whyStudyHere.length > 0 && (
                                    <div className="mb-10 relative z-10">
                                        <h4 className="text-sm font-black text-purple-600 uppercase tracking-widest mb-6">Why Study at {u.shortName}</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {u.whyStudyHere.map((reason, i) => (
                                                <div key={i} className="flex gap-4">
                                                    <span className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-xs flex-shrink-0">{i + 1}</span>
                                                    <p className="text-gray-600 text-sm font-medium leading-relaxed">{reason}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {/* Gallery */}
                                {u.campusImages && u.campusImages.length > 0 && (
                                    <div className="mb-10 relative z-10">
                                        <h4 className="text-sm font-black text-indigo-600 uppercase tracking-widest mb-6">Campus Gallery</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {u.campusImages.map((img: string, i: number) => (
                                                <button key={i} onClick={() => setLightboxImage(img)}
                                                    className="overflow-hidden rounded-2xl shadow-sm bg-white border border-gray-100 p-0">
                                                    <img src={img} alt={`${u.name} campus ${i + 1}`} className="w-full h-40 object-cover hover:scale-105 transition-transform" />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {lightboxImage && <ImageLightbox src={lightboxImage} onClose={() => setLightboxImage(null)} />}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                                    {u.pros?.map((pro, i) => (
                                        <div key={i} className="flex items-start gap-4 p-5 bg-purple-50/50 rounded-2xl border border-purple-100/50 group hover:bg-purple-50 transition-colors">
                                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 shrink-0">
                                                <span className="material-symbols-outlined text-sm">verified</span>
                                            </div>
                                            <span className="text-gray-700 font-bold text-sm leading-snug">{pro}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Fun Facts Section */}
                        {u.funFacts && u.funFacts.length > 0 && (
                            <section id="fun-facts">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                                        <span className="material-symbols-outlined text-2xl">lightbulb</span>
                                    </div>
                                    <h2 className="text-3xl font-display font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>University Highlights</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {u.funFacts.map((fact, i) => (
                                        <div key={i} className="p-8 bg-gradient-to-br from-amber-50 to-orange-50 rounded-[2rem] border border-amber-100 shadow-sm relative overflow-hidden group">
                                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
                                                <span className="material-symbols-outlined text-8xl text-amber-600">auto_awesome</span>
                                            </div>
                                            <p className="text-gray-800 text-sm font-bold leading-relaxed relative z-10">{fact}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Programs Grid */}
                        <section id="programs">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600">
                                        <span className="material-symbols-outlined">auto_stories</span>
                                    </div>
                                    <h2 className="text-3xl font-display font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>Top Programs</h2>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {u.programs?.map((p, i) => (
                                    <div key={i} className="group p-6 bg-white rounded-3xl border border-gray-100 hover:border-purple-200 hover:shadow-2xl hover:shadow-purple-500/10 transition-all duration-300 relative overflow-hidden">
                                        <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-50 rounded-full transition-transform duration-500 group-hover:scale-150" />
                                        <div className="relative z-10">
                                            <div
                                                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-white shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-3"
                                                style={{ background: u.gradient || 'linear-gradient(135deg, #6605c7, #8b5cf6)' }}
                                            >
                                                <span className="material-symbols-outlined text-2xl">{p.icon}</span>
                                            </div>
                                            <h3 className="text-xl font-black text-gray-900 mb-2">{p.name}</h3>
                                            <p className="text-gray-500 text-sm font-medium mb-6">{p.degree} • {p.duration}</p>
                                            <div className="flex items-center justify-between pt-6 border-t border-gray-50 text-xs font-black text-purple-600 uppercase tracking-widest">{p.tuition}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* Admissions Section */}
                        <section id="admissions">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                                    <span className="material-symbols-outlined">assignment_turned_in</span>
                                </div>
                                <h2 className="text-3xl font-display font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>Admission Criteria</h2>
                            </div>
                            <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                    <div>
                                        <h4 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">Documents</h4>
                                        <ul className="space-y-4">
                                            {["Academic Transcripts", "Statement of Purpose", "LORs", "Updated Resume", "Passport Copy"].map((doc, i) => (
                                                <li key={i} className="flex items-center gap-3 text-gray-600 font-bold text-sm">
                                                    <span className="material-symbols-outlined text-amber-500 text-lg">check_circle</span>
                                                    {doc}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="space-y-6">
                                        <h4 className="text-lg font-black text-gray-900">Minimum Requirements</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-gray-50 rounded-2xl">
                                                <div className="text-[10px] font-black text-gray-400 uppercase mb-1">GPA Req.</div>
                                                <div className="text-lg font-black text-gray-900">{u.requirements?.gpa || '—'}</div>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-2xl">
                                                <div className="text-[10px] font-black text-gray-400 uppercase mb-1">IELTS</div>
                                                <div className="text-lg font-black text-gray-900">{u.requirements?.ielts || '—'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Scholarships Section */}
                        <section id="scholarships">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                                    <span className="material-symbols-outlined">card_giftcard</span>
                                </div>
                                <h2 className="text-3xl font-display font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>Financial Aid</h2>
                            </div>
                            <div className="bg-emerald-50/50 rounded-[2.5rem] p-10 border border-emerald-100">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[
                                        { name: "Academic Merit", amount: "Up to 50%", desc: "Top 5% profiles." },
                                        { name: "International Excellence", amount: "Fixed amount", desc: "Holistic evaluation." }
                                    ].map((s, i) => (
                                        <div key={i} className="bg-white p-6 rounded-3xl border border-emerald-100 shadow-sm">
                                            <div className="text-xs font-black text-emerald-600 uppercase mb-1">{s.amount}</div>
                                            <h4 className="text-lg font-black text-gray-900 mb-2">{s.name}</h4>
                                            <p className="text-gray-500 text-sm font-medium">{s.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </section>

                        {/* Campus Facilities */}
                        {u.campusFacilities && u.campusFacilities.length > 0 && (
                            <section id="campus-life">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                                        <span className="material-symbols-outlined">apartment</span>
                                    </div>
                                    <h2 className="text-3xl font-display font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>Campus Facilities</h2>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {u.campusFacilities.map((fac, i) => {
                                        const name = typeof fac === 'string' ? fac : fac.name;
                                        const icon = typeof fac === 'string' ? 'apartment' : fac.icon;
                                        return (
                                            <div key={i} className="p-6 bg-white rounded-3xl border border-gray-100 flex flex-col items-center text-center hover:bg-indigo-50/50 transition-all">
                                                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-4">
                                                    <span className="material-symbols-outlined">{icon || 'apartment'}</span>
                                                </div>
                                                <span className="text-xs font-black text-gray-900 uppercase tracking-tight leading-tight">{name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Alumni Section */}
                        {u.notableAlumni && u.notableAlumni.length > 0 && (
                            <section id="alumni">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600">
                                        <span className="material-symbols-outlined">groups_3</span>
                                    </div>
                                    <h2 className="text-3xl font-display font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>Notable Alumni</h2>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                                    {u.notableAlumni.map((a: any, i: number) => (
                                        <div key={i} className="text-center group">
                                            <div className="w-24 h-24 mx-auto rounded-full overflow-hidden border-4 border-white shadow-lg mb-4 ring-2 ring-rose-50 transition-transform group-hover:scale-110">
                                                <img src={a.img || `https://i.pravatar.cc/150?u=${i + 10}`} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="text-sm font-black text-gray-900">{typeof a === 'string' ? a : a.name}</div>
                                            <div className="text-[10px] font-black text-rose-500 uppercase tracking-widest mt-1">{a.company || 'Distinguished Alumni'}</div>
                                            <div className="text-[9px] text-gray-400 font-bold uppercase">{a.role || 'Professional'}</div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Admission Support Cards */}
                        <section id="admission-support" className="scroll-mt-32">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600">
                                    <span className="material-symbols-outlined">support_agent</span>
                                </div>
                                <h2 className="text-3xl font-display font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>Admission Support</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Callback Card */}
                                <div className="relative group overflow-hidden bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-amber-500/5 hover:shadow-amber-500/10 transition-all duration-500">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-700" />
                                    <div className="relative z-10">
                                        <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-amber-500/20 transform group-hover:rotate-6 transition-transform">
                                            <span className="material-symbols-outlined text-3xl">call</span>
                                        </div>
                                        <h3 className="text-2xl font-black text-gray-900 mb-3">Expert Counseling</h3>
                                        <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">
                                            Get a dedicated counselor to help you navigate through the admission process of {u.shortName}.
                                        </p>
                                        <button 
                                            onClick={() => openInquiry('callback')}
                                            disabled={hasInquiry.callback}
                                            className={`w-full py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-3 ${
                                                hasInquiry.callback 
                                                ? 'bg-green-50 text-green-600 cursor-default border border-green-100' 
                                                : 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/20 hover:scale-[1.02]'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined">
                                                {hasInquiry.callback ? 'check_circle' : 'contact_support'}
                                            </span>
                                            {hasInquiry.callback ? 'Thanks for Requesting' : 'Request Callback'}
                                        </button>
                                        {hasInquiry.callback && (
                                            <p className="text-center text-[10px] font-black text-green-500 uppercase tracking-widest mt-4 animate-pulse">
                                                Our team will reach out shortly!
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Fastrack Card */}
                                <div className="relative group overflow-hidden bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-xl shadow-indigo-500/5 hover:shadow-indigo-500/10 transition-all duration-500">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-600/5 rounded-full -translate-y-12 translate-x-12 group-hover:scale-150 transition-transform duration-700" />
                                    <div className="relative z-10">
                                        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-indigo-600/20 transform group-hover:-rotate-6 transition-transform">
                                            <span className="material-symbols-outlined text-3xl">bolt</span>
                                        </div>
                                        <h3 className="text-2xl font-black text-gray-900 mb-3">Fastrack Admission</h3>
                                        <p className="text-gray-500 text-sm font-medium mb-8 leading-relaxed">
                                            Skip the long wait times. We'll directly coordinate with {u.shortName} to get your application prioritized.
                                        </p>
                                        <button 
                                            onClick={() => openInquiry('fasttrack')}
                                            disabled={hasInquiry.fasttrack}
                                            className={`w-full py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-3 ${
                                                hasInquiry.fasttrack 
                                                ? 'bg-green-50 text-green-600 cursor-default border border-green-100' 
                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 hover:scale-[1.02]'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined">
                                                {hasInquiry.fasttrack ? 'verified' : 'rocket_launch'}
                                            </span>
                                            {hasInquiry.fasttrack ? 'Thanks for Fastracking' : 'Start Fastrack'}
                                        </button>
                                        {hasInquiry.fasttrack && (
                                            <p className="text-center text-[10px] font-black text-green-500 uppercase tracking-widest mt-4 animate-pulse">
                                                Priority processing initiated!
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </section>
                        <section id="financing">
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600">
                                    <span className="material-symbols-outlined">analytics</span>
                                </div>
                                <h2 className="text-3xl font-display font-bold text-gray-900 tracking-tight" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>Financing & ROI</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-white p-8 rounded-[2.5rem] border border-purple-100 shadow-md">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 bg-[#6605c7] rounded-xl flex items-center justify-center text-white">
                                            <span className="material-symbols-outlined">verified</span>
                                        </div>
                                        <div className="text-lg font-black text-gray-900">VidyaLoans Insights</div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-purple-50 rounded-2xl">
                                            <div className="text-2xl font-black text-purple-600">{u.stats?.employmentRate || '—'}</div>
                                            <div className="text-[10px] text-purple-400 font-black uppercase tracking-widest mt-1">Employment Rate</div>
                                        </div>
                                        <div className="p-4 bg-emerald-50 rounded-2xl">
                                            <div className="text-2xl font-black text-emerald-600">4.5x</div>
                                            <div className="text-[10px] text-emerald-400 font-black uppercase tracking-widest mt-1">ROI Multiplier</div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-gray-900 p-8 rounded-[2.5rem] text-white flex flex-col justify-between">
                                    <h3 className="text-xl font-display font-bold mb-4" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>VidyaLoans Advantage</h3>
                                    <Link href={`/apply-loan?university=${encodeURIComponent(u.name)}&country=${encodeURIComponent(u.country)}`} className="block w-full py-5 bg-white text-gray-900 font-black rounded-2xl text-center shadow-xl hover:-translate-y-1 transition-all">Get Funding Now</Link>
                                    {u.loanInfo && (
                                        <div className="mt-6 text-sm text-gray-100">
                                            <div className="font-bold mb-2">Loan Info</div>
                                            <div className="text-xs">Lenders: {Array.isArray(u.loanInfo.availableLenders) ? u.loanInfo.availableLenders.join(', ') : u.loanInfo.availableLenders}</div>
                                            <div className="text-xs">Avg Loan: {u.loanInfo.avgLoanAmount}</div>
                                            <div className="text-xs">Collateral Free: {u.loanInfo.collateralFree ? 'Yes' : 'Usually No'}</div>
                                            <div className="text-xs">Fast-track: {u.loanInfo.fastTrack ? 'Available' : 'Standard'}</div>
                                            {u.loanInfo.notes && <div className="mt-2 text-xs italic">{u.loanInfo.notes}</div>}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>
                    </div>

                    {/* Right Sidebar (4 cols) */}
                    <div className="lg:col-span-4 space-y-8">
                        <div className="sticky top-28 space-y-8">
                            <div className="rounded-[2.5rem] p-10 text-white relative overflow-hidden group shadow-2xl" style={{ background: 'linear-gradient(135deg, #1a0b2e 0%, #2d1065 50%, #6605c7 100%)' }}>
                                {/* Decorative elements */}
                                <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                                <div className="absolute bottom-4 left-4 w-20 h-20 bg-white/5 rounded-full" />
                                <div className="relative z-10">
                                    <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#e0c389] mb-2">Exclusive Offer</div>
                                    <h3 className="text-2xl font-display font-bold mb-4" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>Instant Loan Check</h3>
                                    <p className="text-white/60 text-sm font-medium mb-10 leading-relaxed">
                                        Matched funding available for programs at {u.name}.
                                    </p>
                                    <Link href={`/apply-loan?university=${encodeURIComponent(u.name)}&country=${encodeURIComponent(u.country)}`} className="block w-full py-4 bg-white text-[#6605c7] font-bold rounded-2xl text-center shadow-xl hover:-translate-y-1 transition-all text-sm">Apply with VidyaLoans</Link>
                                </div>
                            </div>

                            <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-6">Key Stats</h3>
                                <div className="space-y-6">
                                    {[
                                        { label: 'Total Students', val: u.stats?.totalStudents || '—', icon: 'groups' },
                                        { label: 'International', val: u.stats?.internationalStudents || '—', icon: 'public' },
                                        { label: 'Faculty Ratio', val: u.stats?.facultyRatio || '—', icon: 'person_search' },
                                        { label: 'Avg Graduate Salary', val: u.stats?.avgSalary || '—', icon: 'payments' }
                                    ].map((stat, i) => (
                                        <div key={i} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-gray-400">{stat.icon}</span>
                                                <span className="text-sm font-bold text-gray-600">{stat.label}</span>
                                            </div>
                                            <span className="text-sm font-black text-gray-900">{stat.val}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {u.topRecruiters && u.topRecruiters.length > 0 && (
                                <div className="bg-white rounded-[2.5rem] p-6 border border-gray-100 shadow-sm">
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Top Recruiters</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {u.topRecruiters.map((r: string, i: number) => (
                                            <span key={i} className="px-3 py-2 bg-gray-50 rounded-full text-xs font-bold text-gray-700 border border-gray-100">{r}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── INQUIRY MODAL ── */}
            {showInquiryModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowInquiryModal(false)}
                    />
                    <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className={`p-8 ${inquiryType === 'callback' ? 'bg-amber-500' : 'bg-indigo-600'} text-white`}>
                            <h3 className="text-2xl font-black mb-2 flex items-center gap-3">
                                <span className="material-symbols-outlined">
                                    {inquiryType === 'callback' ? 'call' : 'bolt'}
                                </span>
                                {inquiryType === 'callback' ? 'Request a Callback' : 'Fastrack Application'}
                            </h3>
                            <p className="text-white/80 text-sm font-medium">
                                {inquiryType === 'callback'
                                    ? "Our counselor will call you within 24 hours to discuss your admission."
                                    : "Speed up your application process with our priority support."}
                            </p>
                        </div>

                        <div className="p-8">
                            {successMsg ? (
                                <div className="text-center py-10">
                                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="material-symbols-outlined text-4xl">check_circle</span>
                                    </div>
                                    <h4 className="text-xl font-black text-gray-900 mb-2">Success!</h4>
                                    <p className="text-gray-500">{successMsg}</p>
                                </div>
                            ) : (
                                <form onSubmit={handleInquirySubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Full Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-semibold"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Email Address</label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-semibold"
                                            placeholder="john@example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Mobile Number</label>
                                        <input
                                            type="tel"
                                            required
                                            value={formData.mobile}
                                            onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-semibold"
                                            placeholder="+91 9876543210"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`w-full py-4 mt-4 rounded-xl font-black text-white uppercase tracking-widest transition-all ${isSubmitting ? 'bg-gray-400 cursor-not-allowed' : (inquiryType === 'callback' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700')}`}
                                    >
                                        {isSubmitting ? 'Sending...' : 'Confirm Request'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
