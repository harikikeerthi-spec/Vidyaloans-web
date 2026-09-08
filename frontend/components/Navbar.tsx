"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";
import { useRouter } from "next/navigation";
import { authApi, referenceApi } from "@/lib/api";

interface DynamicPartner {
    slug: string;
    name: string;
    rate: string;
    initials: string;
    color: string;
    bgColor: string;
    logo?: string;
}

const DEFAULT_PARTNERS: DynamicPartner[] = [
    { slug: "idfc", name: "IDFC First Bank", rate: "From 10.25% p.a.", initials: "IF", color: "text-red-600", bgColor: "bg-red-500/10", logo: "/banks/idfc.png" },
    { slug: "auxilo", name: "Auxilo Finserve", rate: "From 10.50% p.a.", initials: "AX", color: "text-blue-600", bgColor: "bg-blue-500/10", logo: "/banks/auxilo.png" },
    { slug: "avanse", name: "Avanse Financial", rate: "From 10.50% p.a.", initials: "AV", color: "text-green-600", bgColor: "bg-green-500/10", logo: "/banks/avanse.png" },
    { slug: "credila", name: "Credila (HDFC)", rate: "From 10.25% p.a.", initials: "CR", color: "text-indigo-600", bgColor: "bg-indigo-500/10", logo: "/banks/credila.png" },
    { slug: "poonawalla", name: "Poonawalla Fincorp", rate: "From 11.00% p.a.", initials: "PF", color: "text-orange-600", bgColor: "bg-orange-500/10", logo: "/banks/poonawalla.jpg" },
];

const COLOR_CYCLE = [
    { color: "text-red-600", bgColor: "bg-red-500/10" },
    { color: "text-blue-600", bgColor: "bg-blue-500/10" },
    { color: "text-green-600", bgColor: "bg-green-500/10" },
    { color: "text-indigo-600", bgColor: "bg-indigo-500/10" },
    { color: "text-orange-600", bgColor: "bg-orange-500/10" },
    { color: "text-purple-600", bgColor: "bg-purple-500/10" },
];

export default function Navbar() {
    const { user, isAuthenticated, logout } = useAuth();
    const { settings } = useSiteSettings();
    const router = useRouter();
    const [scrolled, setScrolled] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [hasApplied, setHasApplied] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        try {
            if (localStorage.getItem('has_applied_loan')) {
                localStorage.removeItem('has_applied_loan');
            }
            const raw = localStorage.getItem('recent_application_submitted');
            if (raw) {
                const parsed = JSON.parse(raw);
                if ((parsed.userId === user?.id || (user?.email && parsed.email === user.email)) && Date.now() - (parsed.timestamp || 0) < 2592000000) return true;
            }
        } catch { }
        return false;
    });
    const profileRef = useRef<HTMLDivElement>(null);
    const [lendingPartners, setLendingPartners] = useState<DynamicPartner[]>(DEFAULT_PARTNERS);

    useEffect(() => {
        let isMounted = true;
        const fetchPartners = async () => {
            try {
                const res: any = await referenceApi.getBanks();
                const list = res?.data || res || [];
                if (Array.isArray(list) && list.length > 0 && isMounted) {
                    const mapped: DynamicPartner[] = list.map((b: any, idx: number) => {
                        const style = COLOR_CYCLE[idx % COLOR_CYCLE.length];
                        const rateStr = b.interestRateMin ? `From ${b.interestRateMin}% p.a.` : (b.interestRate || "From 10.25% p.a.");
                        const slug = (b.shortName || b.name?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bank").toLowerCase();
                        const initials = (b.shortName ? b.shortName.slice(0, 2) : b.name?.slice(0, 2) || "BK").toUpperCase();
                        return {
                            slug,
                            name: b.name,
                            rate: rateStr,
                            initials,
                            color: style.color,
                            bgColor: style.bgColor,
                            logo: b.logoUrl || b.logo || (slug ? `/banks/${slug}.png` : undefined)
                        };
                    });
                    setLendingPartners(mapped);
                }
            } catch (err) {
                console.error("Failed to load dynamic bank partners in Navbar:", err);
            }
        };

        fetchPartners();
        return () => { isMounted = false; };
    }, []);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener("scroll", onScroll);
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setProfileOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        if (isAuthenticated && user?.id) {
            const hasUserApps = !!((user as any)?.applications && ((user as any).applications as any[]).length > 0) || !!((user as any)?.loanApplications && ((user as any).loanApplications as any[]).length > 0);
            if (hasUserApps) {
                setHasApplied(true);
            }

            const checkApplication = async () => {
                let hasRecentLocal = false;
                try {
                    if (localStorage.getItem('has_applied_loan')) {
                        localStorage.removeItem('has_applied_loan');
                    }
                    const raw = localStorage.getItem('recent_application_submitted');
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        if ((parsed.userId === user.id || (user?.email && parsed.email === user.email)) && (Date.now() - (parsed.timestamp || 0)) < 2592000000) {
                            hasRecentLocal = true;
                        }
                    }
                } catch { }

                if (hasRecentLocal) setHasApplied(true);

                try {
                    const res = await authApi.getDashboardData(user.id) as any;
                    const apps = res?.data?.applications || [];
                    const isApplied = apps.length > 0 || hasRecentLocal || hasUserApps;
                    setHasApplied(isApplied);
                } catch (err) {
                    console.error("Navbar failed to check application status:", err);
                    setHasApplied(hasRecentLocal || hasUserApps);
                }
            };
            checkApplication();

            const handleDataChange = () => checkApplication();
            window.addEventListener('dashboard-data-changed', handleDataChange);
            return () => {
                window.removeEventListener('dashboard-data-changed', handleDataChange);
            };
        } else {
            setHasApplied(false);
        }
    }, [isAuthenticated, user?.id]);

    const handleLogout = () => {
        logout();
        router.push("/login");
    };

    const displayName = user
        ? user.passportOriginalName || user.nameAsInPassport || (user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName || user.email)
        : "";

    return (
        <nav
            id="mainNav"
            className={`fixed top-0 w-full px-6 py-6 flex justify-center items-center z-50 transition-all duration-500 ${scrolled
                ? "bg-white/90 backdrop-blur-xl border-b border-black/5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] !py-4"
                : "bg-transparent"
                }`}
        >
            <div className="w-full max-w-7xl flex justify-between items-center">
                {/* Logo */}
                <div className="flex items-center gap-8 lg:gap-12">
                    <Link href="/" className="flex items-center gap-2 group cursor-pointer relative z-10">
                        <Image
                            src={settings?.logoLightUrl || "/images/vidyaloans-logo-transparent.png"}
                            alt={`${settings?.siteName || "VidyaLoans"} Logo`}
                            width={40}
                            height={40}
                            className="w-10 h-10 object-contain drop-shadow-sm"
                            priority
                        />
                        <span className="font-bold text-2xl tracking-tight font-display transition-colors duration-500 text-[#1a1626]">
                            <link rel="stylesheet" href="#" />
                            {settings?.siteName || "VidyaLoans"}
                        </span>
                    </Link>

                    {/* Desktop Nav Links */}
                    <div className="hidden lg:flex items-center gap-1">
                        {/* Loans Mega Menu */}
                        <div className="group/nav relative px-3 py-4">
                            <button className={`nav-link flex items-center gap-1 text-[13px] font-semibold uppercase tracking-wider transition-colors duration-500 text-[#190f23]/90`}>
                                Loans
                            </button>
                            <div className="absolute top-full left-0 w-[850px] pt-4 opacity-0 invisible translate-y-2 group-hover/nav:opacity-100 group-hover/nav:visible group-hover/nav:translate-y-0 transition-all duration-300 ease-out z-50">
                                <div className="bg-white/95 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-xl p-6">
                                    <div className="grid grid-cols-3 gap-6">
                                        {/* Column 1: Calculators */}
                                        <div>
                                            <h3 className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-4 pl-3">Calculators</h3>
                                            <NavItem href="/emi" icon="calculate" title="EMI Calculator" desc="Plan your monthly repayments" />
                                            <NavItem href="/loan-eligibility" icon="smart_toy" title="Eligibility Checker" desc="Check your approval chances" color="text-blue-500" />
                                        </div>

                                        {/* Column 2: Compare & Apply */}
                                        <div className="flex flex-col justify-between">
                                            <div>
                                                <h3 className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-4 pl-3">Compare & Apply</h3>
                                                <NavItem href="/compare-loans" icon="compare" title="Compare Loans" desc="Find the best interest rates" color="text-orange-500" />
                                                <NavItem href="/bank-reviews" icon="rate_review" title="Bank Reviews" desc="Real feedback from students" color="text-green-500" />
                                            </div>
                                            <Link href="/apply-loan" className="mt-4 flex items-center justify-center w-full py-2.5 bg-gradient-to-r from-primary to-purple-600 text-white text-[9px] font-bold uppercase tracking-widest rounded-lg hover:opacity-95 transition-all">
                                                Apply Now <span className="material-symbols-outlined text-xs ml-1">arrow_forward</span>
                                            </Link>
                                        </div>

                                        {/* Column 3: Our Lending Partners */}
                                        <div className="bg-gray-50/80 -mr-6 -my-6 p-6 border-l border-gray-100 rounded-r-3xl flex flex-col justify-between max-h-[420px] overflow-y-auto no-scrollbar">
                                            <div>
                                                <div className="flex items-center justify-between mb-4 pl-3 pr-2">
                                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Our Lending Partners</h3>
                                                    <span className="text-[9px] font-black text-[#6605c7] bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                                                        {lendingPartners.length} Partners
                                                    </span>
                                                </div>
                                                <div className="space-y-1">
                                                    {lendingPartners.map((p) => (
                                                        <PartnerItem
                                                            key={p.slug}
                                                            href={`/bank/${p.slug}`}
                                                            initials={p.initials}
                                                            name={p.name}
                                                            rate={p.rate}
                                                            color={p.color}
                                                            bgColor={p.bgColor}
                                                            logo={p.logo}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Services Mega Menu */}
                        <div className="group/nav relative px-3 py-4">
                            <button className={`nav-link flex items-center gap-1 text-[13px] font-semibold uppercase tracking-wider transition-colors duration-500 text-[#190f23]/90`}>
                                Services
                            </button>
                            <div className="absolute top-full left-0 w-[850px] pt-4 opacity-0 invisible translate-y-2 group-hover/nav:opacity-100 group-hover/nav:visible group-hover/nav:translate-y-0 transition-all duration-300 ease-out z-50">
                                <div className="bg-white/95 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-xl p-8">
                                    <div className="grid grid-cols-3 gap-8">
                                        <div>
                                            <h3 className="text-[9px] font-bold uppercase tracking-widest text-[#6605c7] mb-4 border-b border-primary/10 pb-2">Planning</h3>
                                            <NavItem href="/onboarding" icon="rocket_launch" title="Get Started" desc="Personalized loan journey" />
                                            <NavItem href="/repayment-stress" icon="monitoring" title="Stress Simulator" desc="Test repayment scenarios" />
                                            <NavItem href="/grade-converter" icon="grade" title="Grade Converter" desc="Convert GPA to percentage" />
                                        </div>
                                        <div>
                                            <h3 className="text-[9px] font-bold uppercase tracking-widest text-pink-500 mb-4 border-b border-pink-500/10 pb-2">Application</h3>
                                            <NavItem href="/sop-writer" icon="auto_fix_high" title="AI SOP Writer" desc="Generate statements instantly" color="text-pink-500" />
                                            <NavItem href="/sop-analyzer" icon="analytics" title="SOP Analyser" desc="Analyze your existing SOP" color="text-pink-500" />
                                            <NavItem href="/admit-predictor" icon="insights" title="Admit Predictor" desc="Chance of acceptance" color="text-pink-500" />
                                            {/* <NavItem href="/visa-mock" icon="record_voice_over" title="Visa Interview Prep" desc="AI mock visa interview" color="text-pink-500" /> */}
                                        </div>
                                        <div>
                                            <h3 className="text-[9px] font-bold uppercase tracking-widest text-purple-500 mb-4 border-b border-purple-500/10 pb-2">Research</h3>
                                            <NavItem href="/compare-universities" icon="school" title="Compare Universities" desc="Find your best fit" color="text-purple-500" />
                                            <NavItem href="/search-universities" icon="verified" title="Insights" desc="ROI & Data intelligence" color="text-purple-600 font-black" />
                                            <div className="px-3 opacity-50">
                                                <div className="flex items-center gap-2 mt-4">
                                                    <span className="material-symbols-outlined text-sm text-gray-400">paid</span>
                                                    <span className="text-[9px] font-bold uppercase text-gray-400">Scholarships</span>
                                                    <span className="text-[7px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded">SOON</span>


                                                </div>
                                                <div className="flex items-center gap-2 mt-4">
                                                    <span className="material-symbols-outlined text-sm text-gray-400">record_voice_over</span>
                                                    <span className="text-[9px] font-bold uppercase text-gray-400">Visa Interview Prep</span>
                                                    <span className="text-[7px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded">SOON</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Community */}
                        <div className="group/nav relative px-3 py-4">
                            <button className={`nav-link flex items-center gap-1 text-[13px] font-semibold uppercase tracking-wider transition-colors duration-500 text-[#190f23]/90`}>
                                Community
                            </button>
                            <div className="absolute top-full left-0 w-[500px] pt-4 opacity-0 invisible translate-y-2 group-hover/nav:opacity-100 group-hover/nav:visible group-hover/nav:translate-y-0 transition-all duration-300 ease-out z-50">
                                <div className="bg-white/95 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-xl overflow-hidden">
                                    <div className="grid grid-cols-5 h-full">
                                        <div className="col-span-2 bg-gradient-to-br from-primary to-purple-800 p-6 flex flex-col justify-between">
                                            <div>
                                                <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center text-white mb-4">
                                                    <span className="material-symbols-outlined text-xl">groups</span>
                                                </div>
                                                <h3 className="text-white font-display text-lg font-bold mb-2">Join the Club</h3>
                                                <p className="text-blue-100 text-[11px] leading-relaxed">Connect with 10k+ students worldwide.</p>
                                            </div>
                                            <Link href="/community" className="mt-6 px-4 py-2.5 bg-white text-[#6605c7] rounded-xl text-[10px] font-bold text-center hover:bg-gray-50 uppercase tracking-wider">
                                                Join Community
                                            </Link>
                                        </div>
                                        <div className="col-span-3 p-6 flex flex-col gap-2">
                                            <NavItem href="/community/discussions" icon="forum" title="Discussions" desc="Ask questions, get answers" color="text-yellow-500" />
                                            <Link href="/connected" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all group/item">
                                                <div className="w-9 h-9 rounded-lg bg-current/5 flex items-center justify-center text-orange-600 transition-all">
                                                    <span className="material-symbols-outlined text-lg">handshake</span>
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-gray-900 text-[13px] group-hover/item:text-[#6605c7] transition-colors flex items-center gap-1">
                                                        connectED <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 leading-tight mt-0.5">Exclusive offline community</div>
                                                </div>
                                            </Link>
                                            {/* <NavItem href="/community" icon="groups" title="Community Hub" desc="Mentors, events & stories" color="text-purple-500" /> */}
                                            <NavItem href="/blog" icon="article" title="Blogs" desc="Latest news and guides" color="text-blue-500" />
                                            {/* <NavItem href="/referral" icon="redeem" title="Refer & Earn" desc="Invite friends, get rewards" color="text-[#6605c7]" /> */}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Link href="/about-us" className={`nav-link px-3 py-4 text-[13px] font-semibold uppercase tracking-wider transition-colors duration-500 text-[#190f23]/90`}>Company</Link>
                    </div>
                </div>

                {/* Right side */}
                <div className="flex items-center gap-4">
                    {!isAuthenticated ? (
                        <div className="flex items-center gap-3">
                            <Link
                                href="/login"
                                className="px-5 py-2.5 text-[11px] font-bold bg-white text-[#6605c7] border border-gray-200 rounded-xl shadow-[0_4px_0_#e2e8f0] hover:-translate-y-0.5 hover:shadow-[0_5px_0_#cbd5e1] active:translate-y-0.5 active:shadow-none transition-all uppercase tracking-wider cursor-pointer"
                            >
                                Login
                            </Link>
                            <Link
                                href="/apply-loan"
                                className="hidden lg:flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-[#7c3aed] via-[#a855f7] to-[#f43f5e] text-white text-[11px] font-bold uppercase tracking-wider rounded-xl shadow-[0_4px_0_#4c1d95] hover:shadow-[0_8px_20px_rgba(124,58,237,0.35),0_6px_0_#4c1d95] border-t border-white/20 translate-y-0 hover:-translate-y-1 hover:brightness-105 active:translate-y-0.5 active:shadow-none transition-all duration-150 ease-out cursor-pointer"
                            >
                                Apply Now
                            </Link>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 bg-white/40 backdrop-blur-md p-1.5 rounded-full border border-purple-500/10 shadow-[0_8px_32px_rgba(102,5,199,0.08)] shrink-0 select-none">
                            {/* 3D Profile Pill Button */}
                            <div className="relative" ref={profileRef}>
                                <button
                                    onClick={() => setProfileOpen((p) => !p)}
                                    className={`relative flex items-center gap-2.5 px-4 py-2 rounded-full border transition-all duration-150 ease-out select-none group cursor-pointer ${profileOpen
                                        ? "bg-[#f4ebff] border-[#6605c7]/30 shadow-inner translate-y-0.5 scale-[0.98]"
                                        : "bg-white border-gray-200 shadow-[0_4px_0_#cbd5e1] translate-y-0 hover:-translate-y-1 hover:shadow-[0_5px_0_#cbd5e1] hover:border-[#6605c7]/20 active:translate-y-0.5 active:shadow-none"
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center font-bold text-xs shadow-md transition-all duration-300 ${profileOpen
                                        ? "bg-gradient-to-tr from-[#6605c7] to-[#8b24e5] scale-110 shadow-purple-500/30"
                                        : "bg-gradient-to-tr from-[#6605c7] via-[#a855f7] to-[#fbbf24] shadow-purple-500/10 group-hover:rotate-12 group-hover:scale-110"
                                        }`}>
                                        {(user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || "U")}{(user?.lastName?.[0] || "")}
                                    </div>
                                    <span className={`text-xs font-extrabold tracking-tight transition-colors duration-150 ${profileOpen ? "text-[#6605c7]" : "text-gray-800"
                                        }`}>
                                        {displayName && displayName.length > 15 ? `${displayName.substring(0, 12)}...` : displayName || "User"}
                                    </span>
                                </button>

                                {profileOpen && (
                                    <div className="absolute top-16 right-0 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 w-64 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-primary/5 to-purple-500/5">
                                            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">Logged in as</p>
                                            <p className="text-sm font-bold text-gray-900 truncate">{user?.email}</p>
                                        </div>
                                        <div className="py-2">
                                            <ProfileDropItem
                                                href={user?.role === 'bank' || user?.role === 'partner_bank' ? "/bank/dashboard" : "/dashboard"}
                                                icon="dashboard"
                                                label="Dashboard"
                                                iconClass="text-[#6605c7]"
                                            />
                                            <ProfileDropItem href="/support-tickets" icon="confirmation_number" label="Support Tickets" iconClass="text-indigo-500" />
                                            <ProfileDropItem href="/referral" icon="redeem" label="Refer & Earn" iconClass="text-pink-500" comingSoon />
                                            <ProfileDropItem href="/profile" icon="person" label="My Profile" iconClass="text-[#6605c7]" />
                                            {!(user?.firstName && user?.lastName && user?.phoneNumber && user?.dateOfBirth) && (
                                                <ProfileDropItem href="/user-details" icon="info" label="Complete Profile" iconClass="text-yellow-500" />
                                            )}
                                        </div>
                                        <div className="border-t border-gray-200 p-2">
                                            <button
                                                onClick={handleLogout}
                                                className="flex items-center justify-center gap-2 w-full px-4 py-2 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors uppercase tracking-wider border-0 cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-sm">logout</span>
                                                Sign Out
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* 3D Apply Now Button */}
                            {!hasApplied && (
                                <Link
                                    href="/apply-loan"
                                    className="relative px-5 py-2.5 bg-gradient-to-r from-[#7c3aed] via-[#a855f7] to-[#f43f5e] text-white text-[11px] font-extrabold uppercase tracking-widest rounded-full shadow-[0_4px_0_#4c1d95] hover:shadow-[0_8px_20px_rgba(124,58,237,0.35),0_6px_0_#4c1d95] border-t border-white/20 translate-y-0 hover:-translate-y-1 hover:brightness-105 active:translate-y-0.5 active:shadow-none transition-all duration-150 ease-out cursor-pointer select-none"
                                >
                                    Apply Now
                                </Link>
                            )}
                        </div>
                    )}

                    {/* Mobile hamburger */}
                    <button
                        className={`lg:hidden w-9 h-9 rounded-full flex items-center justify-center transition-colors bg-[#190f23]/5 text-[#190f23]`}
                        onClick={() => setMobileOpen((o) => !o)}
                        aria-label="Toggle menu"
                    >
                        <span className="material-symbols-outlined text-xl">{mobileOpen ? "close" : "menu"}</span>
                    </button>
                </div>
            </div>

            {/* Mobile menu panel */}
            {mobileOpen && (
                <div className="lg:hidden bg-white border-b border-gray-200 px-4 pt-3 pb-6 flex flex-col gap-2">
                    <MobileLink href="/" label="Home" onClick={() => setMobileOpen(false)} />
                    <MobileLink href="/emi" label="EMI Calculator" onClick={() => setMobileOpen(false)} />
                    <MobileLink href="/compare-loans" label="Compare Loans" onClick={() => setMobileOpen(false)} />
                    <MobileLink href="/community" label="Community" onClick={() => setMobileOpen(false)} />
                    <MobileLink href="/blog" label="Blog" onClick={() => setMobileOpen(false)} />
                    <MobileLink href="/sop-writer" label="AI Tools" onClick={() => setMobileOpen(false)} />
                    {isAuthenticated ? (
                        <>
                            <MobileLink
                                href={user?.role === 'bank' || user?.role === 'partner_bank' ? "/bank/dashboard" : "/dashboard"}
                                label="Dashboard"
                                onClick={() => setMobileOpen(false)}
                            />
                            <MobileLink href="/support-tickets" label="Support Tickets" onClick={() => setMobileOpen(false)} />
                            <button onClick={handleLogout} className="text-left text-red-500 font-bold text-sm">Sign Out</button>
                        </>
                    ) : (
                        <MobileLink href="/login" label="Login" onClick={() => setMobileOpen(false)} />
                    )}
                </div>
            )}
        </nav>
    );
}

function NavItem({ href, icon, title, desc, color = "text-[#6605c7]" }: {
    href: string; icon: string; title: string; desc: string; color?: string;
}) {
    return (
        <Link href={href} className="flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all group/item">
            <div className={`w-9 h-9 rounded-lg bg-current/5 flex items-center justify-center ${color} transition-all`}>
                <span className="material-symbols-outlined text-lg">{icon}</span>
            </div>
            <div>
                <div className={`font-semibold text-gray-900 text-[13px] group-hover/item:text-[#6605c7] transition-colors`}>{title}</div>
                <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{desc}</div>
            </div>
        </Link>
    );
}

function ProfileDropItem({ href, icon, label, iconClass, comingSoon }: {
    href: string; icon: string; label: string; iconClass?: string; comingSoon?: boolean;
}) {
    return (
        <Link
            href={comingSoon ? "#" : href}
            onClick={(e) => { if (comingSoon) e.preventDefault(); }}
            className={`flex items-center justify-between px-4 py-2.5 text-[13px] transition-colors ${comingSoon
                    ? "text-gray-400 bg-gray-50/50 cursor-not-allowed select-none"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
            title={comingSoon ? "Locked — Feature Coming Soon" : undefined}
        >
            <div className="flex items-center gap-3">
                <span className={`material-symbols-outlined text-lg ${comingSoon ? "text-gray-400" : iconClass}`}>{icon}</span>
                <span className="font-medium">{label}</span>
            </div>
            {comingSoon && (
                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200/90 px-2 py-0.5 rounded-full uppercase tracking-wider shadow-xs">
                    <span className="material-symbols-outlined text-[11px] text-amber-600">lock</span>
                    Locked
                </span>
            )}
        </Link>
    );
}

function MobileLink({ href, label, onClick }: { href: string; label: string; onClick: () => void }) {
    return (
        <Link href={href} onClick={onClick} className="text-gray-900 font-semibold text-[13px] py-2.5 border-b border-gray-50">
            {label}
        </Link>
    );
}

function PartnerItem({ href, initials, name, rate, color, bgColor, logo }: {
    href: string; initials: string; name: string; rate: string; color: string; bgColor: string; logo?: string;
}) {
    const [imgFailed, setImgFailed] = useState(false);

    return (
        <Link href={href} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white transition-all group/partner">
            <div className={`w-7 h-7 rounded bg-current/5 flex items-center justify-center flex-shrink-0 overflow-hidden ${color} ${bgColor}`}>
                {logo && !imgFailed ? (
                    <img
                        src={logo}
                        alt={name}
                        className="w-full h-full object-contain p-0.5"
                        onError={() => setImgFailed(true)}
                    />
                ) : (
                    <span className={`text-[9px] font-bold`}>{initials}</span>
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-gray-900 group-hover/partner:text-[#6605c7] transition-colors truncate">{name}</div>
                <div className="text-[9px] text-gray-400 font-medium">{rate}</div>
            </div>
        </Link>
    );
}
