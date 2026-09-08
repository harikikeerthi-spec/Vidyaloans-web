"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { adminApi } from "@/lib/api";

const sections = [
    { id: "section-identity", label: "Institution Identity", icon: "domain", num: "1" },
    { id: "section-rates", label: "Base Rates & Parameters", icon: "percent", num: "2" },
    { id: "section-collateral", label: "Collateral (Secured) Loans", icon: "real_estate_agent", num: "3" },
    { id: "section-non-collateral", label: "Non-Collateral (Unsecured)", icon: "shield_person", num: "4" },
    { id: "section-schemes", label: "Loan Schemes & Toggles", icon: "tune", num: "5" },
    { id: "section-highlights", label: "Key Highlights & USPs", icon: "verified", num: "6" },
    { id: "section-uploads", label: "Web, Contact & Logo", icon: "cloud_upload", num: "7" },
];

const COLLATERAL_TYPE_OPTIONS = [
    "Residential Property (House, Flat, Apartment)",
    "Commercial Property (Shop, Office Building)",
    "Fixed Deposit (FD) / Liquid Securities",
    "Life Insurance Policies (Surrender Value)",
    "Govt Bonds / Mutual Funds / Shares",
    "Non-Agricultural Land / Plots"
];

const ELIGIBLE_COUNTRIES_OPTIONS = [
    "USA",
    "UK",
    "Canada",
    "Australia",
    "Ireland",
    "Germany",
    "Europe (Schengen)",
    "Global (All Approved)"
];

export default function CreateBankPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [activeSection, setActiveSection] = useState("section-identity");
    const [featureInput, setFeatureInput] = useState("");
    const [logoUploadMode, setLogoUploadMode] = useState<"file" | "url">("file");

    const [form, setForm] = useState({
        name: "",
        shortName: "",
        type: "NBFC",
        loanTypes: ["Education Loan"],
        educationLoan: true,
        interestRateMin: 10.25,
        interestRateMax: 14.5,
        maxLoanAmount: "No Limit",
        processingFee: "1% + GST",
        processingTime: "48 hours",

        // Collateral (Secured) Loan Configuration
        offersCollateral: true,
        collateralLimit: "₹2.0 Crore",
        collateralInterestRateMin: 8.5,
        collateralInterestRateMax: 11.5,
        acceptedCollateralTypes: [
            "Residential Property (House, Flat, Apartment)",
            "Commercial Property (Shop, Office Building)",
            "Fixed Deposit (FD) / Liquid Securities"
        ],
        collateralMarginMoney: "Nil for Premier, 5-10% Others",
        collateralProcessingTime: "7 - 12 business days",
        thirdPartyCollateralAllowed: true,

        // Non-Collateral (Unsecured) Loan Configuration
        offersNonCollateral: true,
        nonCollateralLimit: "50 Lakhs",
        nonCollateralInterestRateMin: 10.25,
        nonCollateralInterestRateMax: 14.5,
        nonCollateralMinCibil: "685+",
        nonCollateralMinIncome: "₹35,000 / month",
        nonCollateralEligibleCountries: [
            "USA",
            "UK",
            "Canada",
            "Australia",
            "Ireland",
            "Germany"
        ],
        preVisaDisbursal: true,

        features: [
            "100% Financing: Covers tuition fees, living costs, and travel expenses",
            "Pre-visa disbursement support available",
            "Quick digital sanction with minimal documentation"
        ],
        website: "",
        contactNumber: "",
        email: "",
        logoUrl: "",
        isPopular: false
    });

    const toggleCollateralType = (cType: string) => {
        setForm(prev => {
            const exists = prev.acceptedCollateralTypes.includes(cType);
            return {
                ...prev,
                acceptedCollateralTypes: exists
                    ? prev.acceptedCollateralTypes.filter(t => t !== cType)
                    : [...prev.acceptedCollateralTypes, cType]
            };
        });
    };

    const toggleEligibleCountry = (country: string) => {
        setForm(prev => {
            const exists = prev.nonCollateralEligibleCountries.includes(country);
            return {
                ...prev,
                nonCollateralEligibleCountries: exists
                    ? prev.nonCollateralEligibleCountries.filter(c => c !== country)
                    : [...prev.nonCollateralEligibleCountries, country]
            };
        });
    };

    // Scrollspy tracking
    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY + 160;
            for (let i = sections.length - 1; i >= 0; i--) {
                const el = document.getElementById(sections[i].id);
                if (el && el.offsetTop <= scrollPosition) {
                    setActiveSection(sections[i].id);
                    break;
                }
            }
        };

        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const scrollToSection = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            const yOffset = -90;
            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: "smooth" });
        }
    };

    const handleNameChange = (nameVal: string) => {
        setForm(prev => ({
            ...prev,
            name: nameVal,
            shortName: nameVal.toLowerCase().trim().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-")
        }));
    };

    const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            alert("File size exceeds 2MB limit. Please choose a smaller image.");
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setForm(prev => ({
                ...prev,
                logoUrl: reader.result as string
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleAddFeature = () => {
        if (!featureInput.trim()) return;
        setForm(prev => ({
            ...prev,
            features: [...prev.features, featureInput.trim()]
        }));
        setFeatureInput("");
    };

    const handleRemoveFeature = (index: number) => {
        setForm(prev => ({
            ...prev,
            features: prev.features.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if (!form.name.trim()) {
            alert("Please enter the Bank / NBFC Name");
            scrollToSection("section-identity");
            return;
        }
        if (!form.shortName.trim()) {
            alert("Please enter a valid Short Code / Slug");
            scrollToSection("section-identity");
            return;
        }
        if (Number(form.interestRateMin) <= 0 || Number(form.interestRateMax) <= 0) {
            alert("Interest rate must be greater than 0");
            scrollToSection("section-rates");
            return;
        }
        if (Number(form.interestRateMin) > Number(form.interestRateMax)) {
            alert("Minimum interest rate cannot be greater than Maximum interest rate");
            scrollToSection("section-rates");
            return;
        }

        if (form.offersCollateral && (Number(form.collateralInterestRateMin) <= 0 || Number(form.collateralInterestRateMax) <= 0)) {
            alert("Please enter valid Secured / Collateral Interest Rates");
            scrollToSection("section-collateral");
            return;
        }
        if (form.offersNonCollateral && (Number(form.nonCollateralInterestRateMin) <= 0 || Number(form.nonCollateralInterestRateMax) <= 0)) {
            alert("Please enter valid Unsecured / Non-Collateral Interest Rates");
            scrollToSection("section-non-collateral");
            return;
        }

        // Auto-generate key highlight bullets for collateral & non-collateral schemes if not already present
        const dynamicFeatures = [...form.features];
        if (form.offersNonCollateral) {
            const nonCollateralHighlight = `Non-Collateral (Unsecured): Up to ${form.nonCollateralLimit} without asset pledge (CIBIL ${form.nonCollateralMinCibil})`;
            if (!dynamicFeatures.some(f => f.toLowerCase().includes("non-collateral") || f.toLowerCase().includes("unsecured"))) {
                dynamicFeatures.push(nonCollateralHighlight);
            }
        }
        if (form.offersCollateral) {
            const collateralHighlight = `Secured Collateral: High-value sanction up to ${form.collateralLimit} starting at ${form.collateralInterestRateMin}% p.a.`;
            if (!dynamicFeatures.some(f => f.toLowerCase().includes("secured") || f.toLowerCase().includes("collateral:"))) {
                dynamicFeatures.push(collateralHighlight);
            }
        }

        const payload = {
            name: form.name.trim(),
            shortName: form.shortName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ""),
            type: form.type,
            country: "India",
            loanTypes: form.loanTypes,
            educationLoan: form.educationLoan,
            interestRateMin: Number(form.interestRateMin),
            interestRateMax: Number(form.interestRateMax),
            maxLoanAmount: form.maxLoanAmount.trim(),
            collateralRequired: !form.offersNonCollateral || form.offersCollateral,
            collateralFreeLimit: form.offersNonCollateral ? form.nonCollateralLimit.trim() : "None",
            processingFee: form.processingFee.trim(),
            processingTime: form.processingTime.trim(),
            features: dynamicFeatures,
            website: form.website.trim(),
            contactNumber: form.contactNumber.trim(),
            email: form.email.trim(),
            logoUrl: form.logoUrl.trim(),
            isPopular: form.isPopular,
            // Extended Collateral & Non-Collateral properties
            offersCollateral: form.offersCollateral,
            collateralLimit: form.collateralLimit.trim(),
            collateralInterestRateMin: Number(form.collateralInterestRateMin),
            collateralInterestRateMax: Number(form.collateralInterestRateMax),
            acceptedCollateralTypes: form.acceptedCollateralTypes,
            collateralMarginMoney: form.collateralMarginMoney.trim(),
            collateralProcessingTime: form.collateralProcessingTime.trim(),
            thirdPartyCollateralAllowed: form.thirdPartyCollateralAllowed,
            offersNonCollateral: form.offersNonCollateral,
            nonCollateralLimit: form.nonCollateralLimit.trim(),
            nonCollateralInterestRateMin: Number(form.nonCollateralInterestRateMin),
            nonCollateralInterestRateMax: Number(form.nonCollateralInterestRateMax),
            nonCollateralMinCibil: form.nonCollateralMinCibil.trim(),
            nonCollateralMinIncome: form.nonCollateralMinIncome.trim(),
            nonCollateralEligibleCountries: form.nonCollateralEligibleCountries,
            preVisaDisbursal: form.preVisaDisbursal
        };

        setLoading(true);
        try {
            const res: any = await adminApi.createBank(payload);
            if (res?.success) {
                alert(`Bank partner "${form.name}" has been created successfully!`);
                router.push("/admin/banks");
            } else {
                alert(res?.message || "Failed to create bank partner");
            }
        } catch (err: any) {
            alert(err?.message || "Error creating bank partner");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
            {/* Top Navigation & Breadcrumbs Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.push("/admin/banks")}
                            className="w-9 h-9 rounded-md border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Back to Bank Partners"
                        >
                            <span className="material-symbols-outlined text-lg">arrow_back</span>
                        </button>
                        <div>
                            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                                <Link href="/admin/dashboard" className="hover:text-indigo-600 transition-colors">Admin</Link>
                                <span>/</span>
                                <Link href="/admin/banks" className="hover:text-indigo-600 transition-colors">Bank Partners</Link>
                                <span>/</span>
                                <span className="text-slate-600">Add Partner</span>
                            </div>
                            <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2 mt-0.5">
                                <span className="material-symbols-outlined text-indigo-600 text-xl">account_balance</span>
                                Add Lending Bank Partner
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                            {form.name ? `Configuring: ${form.name}` : "New Institution Profile"}
                        </span>
                    </div>
                </div>
            </header>

            {/* Main Container with Left Sticky Scrollspy Sidebar & Right Form */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Left Sticky Sidebar Menu (Scrollspy) */}
                    <aside className="hidden lg:block lg:col-span-4 xl:col-span-3 sticky top-24 space-y-4">
                        <div className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-3.5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] px-3 mb-2.5">
                                Form Sections
                            </p>
                            <nav className="space-y-1">
                                {sections.map((sec) => {
                                    const isActive = activeSection === sec.id;
                                    return (
                                        <button
                                            key={sec.id}
                                            type="button"
                                            onClick={() => scrollToSection(sec.id)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-semibold transition-all text-left cursor-pointer ${
                                                isActive
                                                    ? "bg-indigo-50/80 text-indigo-700 border-l-4 border-indigo-600 font-bold"
                                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-l-4 border-transparent"
                                            }`}
                                        >
                                            <span className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold shrink-0 ${
                                                isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"
                                            }`}>
                                                {sec.num}
                                            </span>
                                            <span className="truncate">{sec.label}</span>
                                        </button>
                                    );
                                })}
                            </nav>
                        </div>

                        {/* Quick Partner Summary Card */}
                        <div className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-4 space-y-3">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                                Summary Preview
                            </p>
                            <div className="flex items-center gap-3 pt-1">
                                <div className="w-10 h-10 rounded-md border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                                    {form.logoUrl ? (
                                        <img src={form.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                                    ) : (
                                        <span className="material-symbols-outlined text-slate-400 text-xl">account_balance</span>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 truncate">
                                        {form.name || "Untitled Bank Partner"}
                                    </p>
                                    <p className="text-[11px] font-mono text-slate-400 truncate">
                                        {form.shortName || "slug-id"}
                                    </p>
                                </div>
                            </div>
                            <div className="border-t border-slate-100 pt-2.5 space-y-2 text-[11px]">
                                <div className="flex justify-between text-slate-500">
                                    <span>Type:</span>
                                    <span className="font-semibold text-slate-800">{form.type}</span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                    <span>Base ROI:</span>
                                    <span className="font-semibold text-slate-800">{form.interestRateMin}% - {form.interestRateMax}%</span>
                                </div>
                                <div className="p-2.5 rounded-md bg-blue-50/70 border border-blue-100 space-y-1">
                                    <div className="flex justify-between items-center text-blue-900 font-bold">
                                        <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                                            Collateral (Secured):
                                        </span>
                                        <span className={form.offersCollateral ? "text-blue-700 font-extrabold" : "text-slate-400 font-normal"}>
                                            {form.offersCollateral ? form.collateralLimit : "No"}
                                        </span>
                                    </div>
                                    {form.offersCollateral && (
                                        <p className="text-[10px] text-blue-600 font-medium">
                                            ROI: {form.collateralInterestRateMin}% - {form.collateralInterestRateMax}% p.a. • {form.acceptedCollateralTypes.length} asset type{form.acceptedCollateralTypes.length === 1 ? "" : "s"}
                                        </p>
                                    )}
                                </div>
                                <div className="p-2.5 rounded-md bg-emerald-50/70 border border-emerald-100 space-y-1">
                                    <div className="flex justify-between items-center text-emerald-900 font-bold">
                                        <span className="flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                            Non-Collateral:
                                        </span>
                                        <span className={form.offersNonCollateral ? "text-emerald-700 font-extrabold" : "text-slate-400 font-normal"}>
                                            {form.offersNonCollateral ? form.nonCollateralLimit : "No"}
                                        </span>
                                    </div>
                                    {form.offersNonCollateral && (
                                        <p className="text-[10px] text-emerald-600 font-medium">
                                            ROI: {form.nonCollateralInterestRateMin}% - {form.nonCollateralInterestRateMax}% p.a. • CIBIL {form.nonCollateralMinCibil}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Right Form Main Area */}
                    <main className="lg:col-span-8 xl:col-span-9 space-y-6">
                        <form id="bank-create-form" onSubmit={handleSubmit} className="space-y-6">
                            
                            {/* Section 1: Institution Identity & Code */}
                            <section id="section-identity" className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6">
                                <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
                                    <span className="w-7 h-7 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                        1
                                    </span>
                                    <div>
                                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                            Institution Identity & System Code
                                        </h2>
                                        <p className="text-[12px] text-slate-400">Official legal entity name, routing slug, and financial institution categorization</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                            Bank / NBFC Name <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={form.name}
                                            onChange={e => handleNameChange(e.target.value)}
                                            placeholder="e.g. HDFC Credila Financial Services"
                                            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                            Short Code / Slug (System ID) <span className="text-rose-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={form.shortName}
                                            onChange={e => setForm({ ...form, shortName: e.target.value })}
                                            placeholder="e.g. credila or hdfc-credila"
                                            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        />
                                        <p className="text-[11px] text-slate-400 mt-1">Unique slug used for routing applications and decisions.</p>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                            Institution Type
                                        </label>
                                        <select
                                            value={form.type}
                                            onChange={e => setForm({ ...form, type: e.target.value })}
                                            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                                        >
                                            <option value="NBFC">NBFC (Non-Banking Financial Company - e.g. Credila, Avanse, Auxilo, InCred)</option>
                                            <option value="Public">Public Sector Bank (PSB - e.g. SBI, Bank of Baroda, Canara Bank, Union Bank)</option>
                                            <option value="Private">Private Commercial Bank (e.g. ICICI Bank, Axis Bank, HDFC Bank, IDFC FIRST)</option>
                                            <option value="International">International Fintech / Cross-border (e.g. Prodigy Finance, MPOWER Financing)</option>
                                        </select>
                                    </div>
                                </div>
                            </section>

                            {/* Section 2: Interest Rates & Loan Parameters */}
                            <section id="section-rates" className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6">
                                <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
                                    <span className="w-7 h-7 rounded-md bg-purple-50 border border-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                                        2
                                    </span>
                                    <div>
                                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                            Interest Rates & Loan Parameters
                                        </h2>
                                        <p className="text-[12px] text-slate-400">Set underwriting ROI boundaries, borrowing capacity, and processing fees</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div>
                                        <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                            Min Interest Rate (% p.a.) <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                value={form.interestRateMin}
                                                onChange={e => setForm({ ...form, interestRateMin: parseFloat(e.target.value) || 0 })}
                                                className="w-full pl-3 pr-8 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none select-none">
                                                %
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                            Max Interest Rate (% p.a.) <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="0.01"
                                                required
                                                value={form.interestRateMax}
                                                onChange={e => setForm({ ...form, interestRateMax: parseFloat(e.target.value) || 0 })}
                                                className="w-full pl-3 pr-8 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none select-none">
                                                %
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                            Max Loan Amount
                                        </label>
                                        <input
                                            type="text"
                                            value={form.maxLoanAmount}
                                            onChange={e => setForm({ ...form, maxLoanAmount: e.target.value })}
                                            placeholder="e.g. ₹1.5 Crore or No Limit"
                                            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                            Processing Fee
                                        </label>
                                        <input
                                            type="text"
                                            value={form.processingFee}
                                            onChange={e => setForm({ ...form, processingFee: e.target.value })}
                                            placeholder="e.g. 1% + GST"
                                            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                            Processing Turnaround Time
                                        </label>
                                        <input
                                            type="text"
                                            value={form.processingTime}
                                            onChange={e => setForm({ ...form, processingTime: e.target.value })}
                                            placeholder="e.g. 48 hours, or 3 - 5 business days"
                                            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Section 3: Collateral (Secured) Loans */}
                            <section id="section-collateral" className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6">
                                <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
                                    <span className="w-7 h-7 rounded-md bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                                        3
                                    </span>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                                <span className="material-symbols-outlined text-blue-600 text-lg">real_estate_agent</span>
                                                Collateral (Secured) Loans
                                            </h2>
                                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${form.offersCollateral ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                                                {form.offersCollateral ? "Secured Scheme Active" : "Secured Scheme Inactive"}
                                            </span>
                                        </div>
                                        <p className="text-[12px] text-slate-400 mt-0.5">Financing backed by immovable property, fixed deposits, or liquid securities with higher loan caps</p>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    {/* Main Collateral Toggle Banner */}
                                    <div className="p-4 bg-blue-50/50 border border-blue-200/80 rounded-lg">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                                                    <span className="material-symbols-outlined text-xl">real_estate_agent</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-slate-900 block">
                                                        Offers Collateral (Secured) Loans
                                                    </span>
                                                    <p className="text-[11px] text-slate-600 mt-0.5">
                                                        Borrowers or co-signers pledge assets to obtain competitive interest rates and high sanction limits.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Toggle Switch */}
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={form.offersCollateral}
                                                onClick={() => setForm(prev => ({ ...prev, offersCollateral: !prev.offersCollateral }))}
                                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
                                                    form.offersCollateral ? "bg-blue-600" : "bg-slate-300"
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                                        form.offersCollateral ? "translate-x-5" : "translate-x-0"
                                                    }`}
                                                />
                                            </button>
                                        </div>

                                        {form.offersCollateral && (
                                            <div className="mt-5 pt-4 border-t border-blue-200/70 space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="text-[11px] font-bold uppercase tracking-wider text-blue-950 block mb-1">
                                                            Collateral Max Loan Limit
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={form.collateralLimit}
                                                            onChange={e => setForm({ ...form, collateralLimit: e.target.value })}
                                                            placeholder="e.g. ₹2.0 Crore or No Limit"
                                                            className="w-full px-3 py-2 bg-white border border-blue-300 rounded-md text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
                                                        />
                                                        <p className="text-[10px] text-blue-700 mt-1">Sanction ceiling for secured applications.</p>
                                                    </div>

                                                    <div>
                                                        <label className="text-[11px] font-bold uppercase tracking-wider text-blue-950 block mb-1">
                                                            Secured Min ROI (% p.a.)
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={form.collateralInterestRateMin}
                                                                onChange={e => setForm({ ...form, collateralInterestRateMin: parseFloat(e.target.value) || 0 })}
                                                                className="w-full pl-3 pr-7 py-2 bg-white border border-blue-300 rounded-md text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-400 pointer-events-none">%</span>
                                                        </div>
                                                        <p className="text-[10px] text-blue-700 mt-1">Typically starting at 8.5% - 9.5% p.a.</p>
                                                    </div>

                                                    <div>
                                                        <label className="text-[11px] font-bold uppercase tracking-wider text-blue-950 block mb-1">
                                                            Secured Max ROI (% p.a.)
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={form.collateralInterestRateMax}
                                                                onChange={e => setForm({ ...form, collateralInterestRateMax: parseFloat(e.target.value) || 0 })}
                                                                className="w-full pl-3 pr-7 py-2 bg-white border border-blue-300 rounded-md text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-blue-400 pointer-events-none">%</span>
                                                        </div>
                                                        <p className="text-[10px] text-blue-700 mt-1">Upper boundary for secured rates.</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                                    <div>
                                                        <label className="text-[11px] font-bold uppercase tracking-wider text-blue-950 block mb-1">
                                                            Margin Money Requirement
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={form.collateralMarginMoney}
                                                            onChange={e => setForm({ ...form, collateralMarginMoney: e.target.value })}
                                                            placeholder="e.g. Nil for Premier, 5-10% Others"
                                                            className="w-full px-3 py-2 bg-white border border-blue-300 rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-[11px] font-bold uppercase tracking-wider text-blue-950 block mb-1">
                                                            Legal &amp; Valuation TAT
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={form.collateralProcessingTime}
                                                            onChange={e => setForm({ ...form, collateralProcessingTime: e.target.value })}
                                                            placeholder="e.g. 7 - 12 business days"
                                                            className="w-full px-3 py-2 bg-white border border-blue-300 rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 shadow-xs"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Accepted Collateral Types */}
                                                <div>
                                                    <label className="text-[11px] font-bold uppercase tracking-wider text-blue-950 block mb-1.5">
                                                        Accepted Collateral Security Types
                                                    </label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {COLLATERAL_TYPE_OPTIONS.map((cType) => {
                                                            const isSelected = form.acceptedCollateralTypes.includes(cType);
                                                            return (
                                                                <button
                                                                    key={cType}
                                                                    type="button"
                                                                    onClick={() => toggleCollateralType(cType)}
                                                                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                                                                        isSelected
                                                                            ? "bg-blue-600 text-white border-blue-700 shadow-xs"
                                                                            : "bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/30"
                                                                    }`}
                                                                >
                                                                    <span className="material-symbols-outlined text-[14px]">
                                                                        {isSelected ? "check" : "add"}
                                                                    </span>
                                                                    {cType}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Third-Party Collateral Toggle */}
                                                <div className="flex items-center justify-between p-3 border border-blue-200 rounded-md bg-white">
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-900 block">Accepts Third-Party / Relative Collateral</span>
                                                        <span className="text-[11px] text-slate-500">Security pledged by parents, siblings, blood relatives, or legal guardians</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={form.thirdPartyCollateralAllowed}
                                                        onClick={() => setForm(prev => ({ ...prev, thirdPartyCollateralAllowed: !prev.thirdPartyCollateralAllowed }))}
                                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                            form.thirdPartyCollateralAllowed ? "bg-blue-600" : "bg-slate-300"
                                                        }`}
                                                    >
                                                        <span
                                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                                                form.thirdPartyCollateralAllowed ? "translate-x-4" : "translate-x-0"
                                                            }`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* Section 4: Non-Collateral (Unsecured) Loans */}
                            <section id="section-non-collateral" className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6">
                                <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
                                    <span className="w-7 h-7 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                                        4
                                    </span>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                                <span className="material-symbols-outlined text-emerald-600 text-lg">shield_person</span>
                                                Non-Collateral (Unsecured) Loans
                                            </h2>
                                            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${form.offersNonCollateral ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                                                {form.offersNonCollateral ? "Unsecured Scheme Active" : "Unsecured Scheme Inactive"}
                                            </span>
                                        </div>
                                        <p className="text-[12px] text-slate-400 mt-0.5">Merit-based education loans granted without pledging property, based on university tier and co-applicant income</p>
                                    </div>
                                </div>

                                <div className="space-y-5">
                                    {/* Main Non-Collateral Toggle Banner */}
                                    <div className="p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-lg">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-start gap-3">
                                                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                                                    <span className="material-symbols-outlined text-xl">shield_person</span>
                                                </div>
                                                <div>
                                                    <span className="text-xs font-bold text-slate-900 block">
                                                        Offers Non-Collateral (Unsecured) Loans
                                                    </span>
                                                    <p className="text-[11px] text-slate-600 mt-0.5">
                                                        Students can secure financing without pledging immovable property or asset collateral.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Toggle Switch */}
                                            <button
                                                type="button"
                                                role="switch"
                                                aria-checked={form.offersNonCollateral}
                                                onClick={() => setForm(prev => ({ ...prev, offersNonCollateral: !prev.offersNonCollateral }))}
                                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                                                    form.offersNonCollateral ? "bg-emerald-600" : "bg-slate-300"
                                                }`}
                                            >
                                                <span
                                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                                        form.offersNonCollateral ? "translate-x-5" : "translate-x-0"
                                                    }`}
                                                />
                                            </button>
                                        </div>

                                        {form.offersNonCollateral && (
                                            <div className="mt-5 pt-4 border-t border-emerald-200/70 space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                    <div>
                                                        <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-950 block mb-1">
                                                            Non-Collateral Max Limit
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={form.nonCollateralLimit}
                                                            onChange={e => setForm({ ...form, nonCollateralLimit: e.target.value })}
                                                            placeholder="e.g. ₹50 Lakhs or ₹75 Lakhs"
                                                            className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-md text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
                                                        />
                                                        <p className="text-[10px] text-emerald-700 mt-1">Maximum sanction without asset collateral.</p>
                                                    </div>

                                                    <div>
                                                        <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-950 block mb-1">
                                                            Unsecured Min ROI (% p.a.)
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={form.nonCollateralInterestRateMin}
                                                                onChange={e => setForm({ ...form, nonCollateralInterestRateMin: parseFloat(e.target.value) || 0 })}
                                                                className="w-full pl-3 pr-7 py-2 bg-white border border-emerald-300 rounded-md text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400 pointer-events-none">%</span>
                                                        </div>
                                                        <p className="text-[10px] text-emerald-700 mt-1">Starting rate for unsecured applicants.</p>
                                                    </div>

                                                    <div>
                                                        <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-950 block mb-1">
                                                            Unsecured Max ROI (% p.a.)
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                value={form.nonCollateralInterestRateMax}
                                                                onChange={e => setForm({ ...form, nonCollateralInterestRateMax: parseFloat(e.target.value) || 0 })}
                                                                className="w-full pl-3 pr-7 py-2 bg-white border border-emerald-300 rounded-md text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400 pointer-events-none">%</span>
                                                        </div>
                                                        <p className="text-[10px] text-emerald-700 mt-1">Max rate for non-collateral applications.</p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                                    <div>
                                                        <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-950 block mb-1">
                                                            Minimum Co-applicant CIBIL
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={form.nonCollateralMinCibil}
                                                            onChange={e => setForm({ ...form, nonCollateralMinCibil: e.target.value })}
                                                            placeholder="e.g. 685+ or 700+"
                                                            className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-950 block mb-1">
                                                            Min Monthly Co-Applicant Income
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={form.nonCollateralMinIncome}
                                                            onChange={e => setForm({ ...form, nonCollateralMinIncome: e.target.value })}
                                                            placeholder="e.g. ₹35,000 / month"
                                                            className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-md text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 shadow-xs"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Supported Non-Collateral Countries */}
                                                <div>
                                                    <label className="text-[11px] font-bold uppercase tracking-wider text-emerald-950 block mb-1.5">
                                                        Eligible Non-Collateral Study Destinations
                                                    </label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {ELIGIBLE_COUNTRIES_OPTIONS.map((country) => {
                                                            const isSelected = form.nonCollateralEligibleCountries.includes(country);
                                                            return (
                                                                <button
                                                                    key={country}
                                                                    type="button"
                                                                    onClick={() => toggleEligibleCountry(country)}
                                                                    className={`px-3 py-1.5 rounded-md text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer ${
                                                                        isSelected
                                                                            ? "bg-emerald-600 text-white border-emerald-700 shadow-xs"
                                                                            : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30"
                                                                    }`}
                                                                >
                                                                    <span className="material-symbols-outlined text-[14px]">
                                                                        {isSelected ? "check" : "add"}
                                                                    </span>
                                                                    {country}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Pre-Visa Disbursal Toggle */}
                                                <div className="flex items-center justify-between p-3 border border-emerald-200 rounded-md bg-white">
                                                    <div>
                                                        <span className="text-xs font-bold text-slate-900 block">Pre-Visa / Prior Sanction Disbursal Available</span>
                                                        <span className="text-[11px] text-slate-500">Allows sanction letter or advance fund release for German blocked account or US I-20 proof of funds</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        role="switch"
                                                        aria-checked={form.preVisaDisbursal}
                                                        onClick={() => setForm(prev => ({ ...prev, preVisaDisbursal: !prev.preVisaDisbursal }))}
                                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                            form.preVisaDisbursal ? "bg-emerald-600" : "bg-slate-300"
                                                        }`}
                                                    >
                                                        <span
                                                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                                                form.preVisaDisbursal ? "translate-x-4" : "translate-x-0"
                                                            }`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* Section 5: Loan Schemes & Visibility Toggles */}
                            <section id="section-schemes" className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6">
                                <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
                                    <span className="w-7 h-7 rounded-md bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                                        5
                                    </span>
                                    <div>
                                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                            Loan Schemes &amp; Visibility Toggles
                                        </h2>
                                        <p className="text-[12px] text-slate-400">Featured promotion and international education loan qualification</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex items-center justify-between p-3.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50/50 transition-colors">
                                        <div className="pr-3">
                                            <span className="text-xs font-bold text-slate-900 block">Popular / Featured Partner</span>
                                            <span className="text-[11px] text-slate-500">Highlights bank with featured badge on comparison cards</span>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={form.isPopular}
                                            onClick={() => setForm(prev => ({ ...prev, isPopular: !prev.isPopular }))}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                                                form.isPopular ? "bg-indigo-600" : "bg-slate-300"
                                            }`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                                    form.isPopular ? "translate-x-5" : "translate-x-0"
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between p-3.5 border border-slate-200 rounded-md bg-white hover:bg-slate-50/50 transition-colors">
                                        <div className="pr-3">
                                            <span className="text-xs font-bold text-slate-900 block">Offers Overseas Education Loans</span>
                                            <span className="text-[11px] text-slate-500">Qualifies for USA, UK, Canada, and global study destinations</span>
                                        </div>
                                        <button
                                            type="button"
                                            role="switch"
                                            aria-checked={form.educationLoan}
                                            onClick={() => setForm(prev => ({ ...prev, educationLoan: !prev.educationLoan }))}
                                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ${
                                                form.educationLoan ? "bg-indigo-600" : "bg-slate-300"
                                            }`}
                                        >
                                            <span
                                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                                    form.educationLoan ? "translate-x-5" : "translate-x-0"
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </section>

                            {/* Section 6: Key Highlights & Schemes */}
                            <section id="section-highlights" className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6">
                                <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
                                    <span className="w-7 h-7 rounded-md bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                                        6
                                    </span>
                                    <div>
                                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                            Key Highlights & USPs
                                        </h2>
                                        <p className="text-[12px] text-slate-400">Bullet points displayed to students during loan comparison</p>
                                    </div>
                                </div>

                                <div className="flex gap-2.5 mb-4">
                                    <input
                                        type="text"
                                        value={featureInput}
                                        onChange={e => setFeatureInput(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddFeature(); } }}
                                        placeholder="Add highlight (e.g. Zero margin money, living expenses covered)..."
                                        className="flex-1 px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleAddFeature}
                                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                                    >
                                        <span className="material-symbols-outlined text-sm">add</span>
                                        Add
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {form.features.map((feat, idx) => (
                                        <div key={idx} className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-800 font-medium">
                                            <span className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-emerald-500 text-[15px]">check_circle</span>
                                                {feat}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveFeature(idx)}
                                                className="text-slate-400 hover:text-red-600 transition-colors p-0.5"
                                                title="Remove highlight"
                                            >
                                                <span className="material-symbols-outlined text-sm">delete</span>
                                            </button>
                                        </div>
                                    ))}
                                    {form.features.length === 0 && (
                                        <p className="text-xs text-slate-400 italic py-1">No highlights added yet.</p>
                                    )}
                                </div>
                            </section>

                            {/* Section 7: Web, Contact & Bank Logo */}
                            <section id="section-uploads" className="bg-white rounded-lg border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6">
                                <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
                                    <span className="w-7 h-7 rounded-md bg-sky-50 border border-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0">
                                        7
                                    </span>
                                    <div>
                                        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                                            Contact, Web & Bank Logo Upload
                                        </h2>
                                        <p className="text-[12px] text-slate-400">Communication endpoints and official institutional branding</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                                    <div>
                                        <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                            Official Website URL
                                        </label>
                                        <input
                                            type="url"
                                            value={form.website}
                                            onChange={e => setForm({ ...form, website: e.target.value })}
                                            placeholder="https://www.bankwebsite.com"
                                            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                            Official Underwriting Email
                                        </label>
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={e => setForm({ ...form, email: e.target.value })}
                                            placeholder="underwriting@bankpartner.com"
                                            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="text-[12px] font-semibold uppercase tracking-wider text-[#64748B] block mb-1.5">
                                            Lender Helpline / Contact Number
                                        </label>
                                        <input
                                            type="tel"
                                            value={form.contactNumber}
                                            onChange={e => setForm({ ...form, contactNumber: e.target.value })}
                                            placeholder="+91 1800-XXX-XXXX"
                                            className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                        />
                                    </div>
                                </div>

                                {/* Bank Logo Upload Section */}
                                <div className="pt-4 border-t border-slate-100">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <label className="text-[12px] font-semibold uppercase tracking-wider text-slate-700 block">
                                                Bank Partner Logo <span className="text-slate-400 font-normal">(PNG, JPG, SVG, WebP)</span>
                                            </label>
                                            <p className="text-[11px] text-slate-400">Upload an image file from your device or specify an image URL</p>
                                        </div>
                                        <div className="flex bg-slate-100 p-0.5 rounded-md">
                                            <button
                                                type="button"
                                                onClick={() => setLogoUploadMode("file")}
                                                className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all cursor-pointer ${
                                                    logoUploadMode === "file" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
                                                }`}
                                            >
                                                Upload File
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setLogoUploadMode("url")}
                                                className={`px-2.5 py-1 text-[11px] font-bold rounded transition-all cursor-pointer ${
                                                    logoUploadMode === "url" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500 hover:text-slate-800"
                                                }`}
                                            >
                                                Image URL
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
                                        <div className="md:col-span-2">
                                            {logoUploadMode === "file" ? (
                                                <div className="border border-dashed border-slate-300 hover:border-indigo-400 rounded-md p-6 text-center bg-slate-50 hover:bg-indigo-50/20 transition-all">
                                                    <input
                                                        type="file"
                                                        id="bank-logo-upload"
                                                        accept="image/*"
                                                        onChange={handleLogoFileUpload}
                                                        className="hidden"
                                                    />
                                                    <label
                                                        htmlFor="bank-logo-upload"
                                                        className="cursor-pointer flex flex-col items-center justify-center"
                                                    >
                                                        <div className="w-10 h-10 rounded-md bg-white border border-slate-200 text-indigo-600 flex items-center justify-center shadow-xs mb-2">
                                                            <span className="material-symbols-outlined text-xl">cloud_upload</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-indigo-600 hover:underline">
                                                            Click to upload logo image
                                                        </span>
                                                        <span className="text-[11px] text-slate-400 mt-1">
                                                            PNG, JPG, SVG or WebP up to 2MB
                                                        </span>
                                                    </label>
                                                </div>
                                            ) : (
                                                <div>
                                                    <input
                                                        type="url"
                                                        value={form.logoUrl}
                                                        onChange={e => setForm({ ...form, logoUrl: e.target.value })}
                                                        placeholder="https://logo.clearbit.com/bankname.com"
                                                        className="w-full px-3 py-2 bg-white border border-[#E2E8F0] rounded-md text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                                    />
                                                    <p className="text-[10px] text-slate-400 mt-1">Enter a direct image link from Clearbit, Google, or official CDN.</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Logo Preview Box */}
                                        <div className="p-3 border border-slate-200 rounded-md bg-white text-center flex flex-col items-center justify-center min-h-[120px]">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Logo Preview</span>
                                            {form.logoUrl ? (
                                                <div className="relative group">
                                                    <div className="w-20 h-16 rounded border border-slate-200 p-1.5 bg-white flex items-center justify-center shadow-xs overflow-hidden">
                                                        <img
                                                            src={form.logoUrl}
                                                            alt="Logo Preview"
                                                            className="max-h-full max-w-full object-contain"
                                                            onError={(e) => {
                                                                (e.target as HTMLElement).style.display = "none";
                                                             }}
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setForm({ ...form, logoUrl: "" })}
                                                        className="mt-1.5 text-[11px] text-rose-500 hover:text-rose-700 font-bold flex items-center gap-0.5 mx-auto"
                                                    >
                                                        <span className="material-symbols-outlined text-xs">delete</span>
                                                        Remove
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="text-slate-300 flex flex-col items-center">
                                                    <span className="material-symbols-outlined text-3xl">image</span>
                                                    <span className="text-[10px] text-slate-400 mt-1">No logo selected</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </section>

                        </form>
                    </main>
                </div>
            </div>

            {/* Sticky Bottom Action Footer */}
            <footer className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3.5 px-6 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-xs font-semibold text-slate-600 hidden sm:inline">
                            {form.name ? `Configuring ${form.name}` : "New Lending Bank Partner Form"}
                        </span>
                        <span className="text-slate-300 hidden sm:inline">|</span>
                        <span className="text-[11px] text-slate-400">All changes pending creation</span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.push("/admin/banks")}
                            className="px-4 py-2 border border-slate-200 rounded-md text-xs text-slate-600 hover:bg-slate-50 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={loading || !form.name.trim() || !form.shortName.trim()}
                            onClick={() => handleSubmit()}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                        >
                            {loading ? (
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                    <span>Create Bank Partner</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    );
}
