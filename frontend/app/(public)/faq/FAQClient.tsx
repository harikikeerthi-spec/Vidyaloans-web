"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

interface FAQItem {
    id: string;
    question: string;
    answer: string;
    category: string;
}

const FAQ_DATA: FAQItem[] = [
    // General
    {
        id: "gen-1",
        category: "general",
        question: "What is VidyaLoans and how does it help students?",
        answer: "VidyaLoans is a digital-first, AI-powered education loan platform. We help students compare, choose, and apply for study abroad education loans from top Indian banks and NBFCs, guaranteeing the lowest interest rates and a 100% digital, stress-free experience."
    },
    {
        id: "gen-2",
        category: "general",
        question: "Are VidyaLoans services free for students?",
        answer: "Yes, our services are 100% free. We are a direct channel partner of lending institutions, which allows us to assist you throughout the application, document collection, bank coordination, and final disbursement process at zero cost."
    },
    {
        id: "gen-3",
        category: "general",
        question: "Which countries are covered under VidyaLoans?",
        answer: "We support education loans for all major global study destinations, including the USA, Canada, United Kingdom, Australia, Germany, Ireland, Singapore, New Zealand, and more than 20 other countries."
    },
    // Eligibility
    {
        id: "elig-1",
        category: "eligibility",
        question: "What are the primary eligibility criteria for a study abroad education loan?",
        answer: "The primary criteria include: Indian citizenship, age 18 years or older, secured admission in a recognized university or college abroad, and a co-applicant (typically a parent, guardian, spouse, or sibling) with a stable income source. Strong academic records and standardized test scores (like GRE, GMAT, IELTS, TOEFL) also enhance your approval prospects."
    },
    {
        id: "elig-2",
        category: "eligibility",
        question: "Can I get an education loan without a co-applicant?",
        answer: "Generally, Indian banks require a financial co-applicant (typically a close relative) who acts as a guarantor. However, for top-tier global institutions (such as Ivy League colleges or top-50 business schools), certain private lenders and NBFCs can offer unsecured loans based purely on your academic profile and estimated future earning potential."
    },
    {
        id: "elig-3",
        category: "eligibility",
        question: "Does my co-applicant need to have a high salary?",
        answer: "A co-applicant's income is critical for unsecured loans, as lenders use it to assess the repayment capacity if a student is unable to secure a job immediately. However, for secured (collateralized) loans, the income requirement is much more flexible since the loan is backed by a tangible asset."
    },
    // Collateral
    {
        id: "col-1",
        category: "collateral",
        question: "What is the difference between secured and unsecured education loans?",
        answer: "Secured loans require collateral (such as residential property, fixed deposits, or liquid securities) and typically offer lower interest rates (starting at 8.5% p.a.), longer tenures, and higher loan amounts. Unsecured loans do not require collateral, but approval depends heavily on your university's ranking, test scores, and co-applicant's CIBIL score and income."
    },
    {
        id: "col-2",
        category: "collateral",
        question: "What assets are accepted as collateral for a secured loan?",
        answer: "Lenders accept physical assets like residential houses, apartments, commercial properties, and non-agricultural land. They also accept liquid assets (often called paper collateral) including Fixed Deposits (FDs), mutual funds, government bonds, and life insurance policies with cash surrender value."
    },
    {
        id: "col-3",
        category: "collateral",
        question: "Can I submit multiple properties or assets for a single loan?",
        answer: "Yes, you can combine multiple properties or mix physical and liquid collateral (e.g., a residential property plus a Fixed Deposit) to meet the total required value of the loan or to secure a lower interest rate."
    },
    // Disbursement
    {
        id: "disb-1",
        category: "disbursement",
        question: "How is the loan amount disbursed?",
        answer: "The tuition fee component is disbursed directly to your university's official bank account on a semester or yearly basis, aligned with their fee schedule. Living expenses, health insurance, and travel costs are either loaded onto a prepaid international Forex card or transferred directly to the student's personal bank account."
    },
    {
        id: "disb-2",
        category: "disbursement",
        question: "What is a moratorium period?",
        answer: "The moratorium period is a repayment holiday granted to students. It typically spans the entire duration of your course plus an additional 6 to 12 months. During this period, you are not required to repay the principal amount, though depending on the lender, simple interest or partial interest may accrue."
    },
    {
        id: "disb-3",
        category: "disbursement",
        question: "What happens if my university fees change mid-course?",
        answer: "Most banks allow for loan re-evaluation or increment requests. If your tuition fee increases or your exchange rate fluctuates significantly, you can submit the revised university fee structure to request additional disbursement, subject to the lender's approval."
    }
];

const CATEGORIES = [
    { id: "all", label: "All Questions", icon: "help" },
    { id: "general", label: "General", icon: "info" },
    { id: "eligibility", label: "Eligibility", icon: "checklist" },
    { id: "collateral", label: "Collateral & Security", icon: "shield_lock" },
    { id: "disbursement", label: "Disbursement & Repayment", icon: "payments" }
];

export default function FAQPage() {
    const { settings } = useSiteSettings();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [expandedId, setExpandedId] = useState<string | null>("gen-1");

    const rawNumber = settings?.whatsappNumber || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_AWS_WHATSAPP_NUMBER || '+918143797779';
    const cleanNumber = rawNumber.replace(/[^0-9]/g, '');
    const siteName = settings?.siteName || "VidyaLoans";
    const prefilledMessage = encodeURIComponent(`Hi ${siteName} team! I have a question regarding education loans and would like to speak with an advisor.`);
    const whatsappUrl = `https://wa.me/${cleanNumber}?text=${prefilledMessage}`;

    // Filter FAQs based on category and search query
    const filteredFAQs = useMemo(() => {
        return FAQ_DATA.filter(faq => {
            const matchesCategory = selectedCategory === "all" || faq.category === selectedCategory;
            const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [selectedCategory, searchQuery]);

    const handleToggle = (id: string) => {
        setExpandedId(prev => (prev === id ? null : id));
    };

    return (
        <div className="min-h-screen relative text-gray-900 bg-transparent overflow-hidden">
            {/* Header / Background Glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full blur-[120px] opacity-40" style={{ background: 'radial-gradient(circle, #d8b4fe, transparent)' }} />
                <div className="absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-30" style={{ background: 'radial-gradient(circle, #fed7aa, transparent)' }} />
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, #6605c7 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            </div>

            <div className="max-w-4xl mx-auto px-6 pt-36 pb-24 relative z-10">
                {/* Header Section */}
                <div className="text-center mb-12">
                    <span className="inline-block px-4 py-1.5 rounded-full bg-[#6605c7]/10 text-[#6605c7] text-[11px] font-black uppercase tracking-widest mb-4 border border-[#6605c7]/15">
                        SUPPORT CENTER
                    </span>
                    <h1 className="text-3xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight leading-none">
                        Frequently Asked <span className="text-[#6605c7]">Questions</span>
                    </h1>
                    <p className="text-gray-500 text-[13px] font-semibold max-w-lg mx-auto leading-relaxed">
                        Got questions? We have got answers. Everything you need to know about financing your international education journey.
                    </p>
                </div>

                {/* Search Bar */}
                <div className="relative max-w-xl mx-auto mb-12">
                    <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 text-xl pointer-events-none">search</span>
                    <input
                        type="text"
                        id="faq-search-input"
                        placeholder="Search for questions (e.g., collateral, eligibility, moratorium...)"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-14 pr-6 py-4.5 bg-white border border-gray-100 rounded-2xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-[#6605c7]/5 focus:border-[#6605c7]/20 transition-all font-medium text-[13px] shadow-lg shadow-black/[0.02]"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors uppercase tracking-wider"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Categories Selectors */}
                <div className="flex gap-2 mb-10 overflow-x-auto no-scrollbar pb-2 justify-start md:justify-center">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.id}
                            id={`cat-btn-${cat.id}`}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`min-h-[44px] inline-flex items-center gap-2 px-5 py-3 rounded-full border text-[11px] font-black uppercase tracking-wider transition-all duration-150 ease-out select-none whitespace-nowrap cursor-pointer ${
                                selectedCategory === cat.id
                                    ? "bg-[#6605c7] border-[#6605c7] text-white shadow-[0_4px_12px_rgba(102,5,199,0.25)] -translate-y-0.5"
                                    : "bg-white border-gray-100 text-gray-500 shadow-sm hover:border-[#6605c7]/20 hover:text-gray-900"
                            }`}
                        >
                            <span className="material-symbols-outlined text-base leading-none">{cat.icon}</span>
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* FAQ list */}
                <div className="space-y-4 min-h-[300px]">
                    {filteredFAQs.length > 0 ? (
                        filteredFAQs.map((faq) => {
                            const isExpanded = expandedId === faq.id;
                            return (
                                <div
                                    key={faq.id}
                                    id={`faq-item-${faq.id}`}
                                    className={`bg-white/80 backdrop-blur-md rounded-2xl border transition-all duration-300 ease-out overflow-hidden group ${
                                        isExpanded
                                            ? "border-[#6605c7]/30 shadow-[0_8px_30px_rgba(102,5,199,0.04)]"
                                            : "border-gray-100 hover:border-gray-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.01)]"
                                    }`}
                                >
                                    {/* Question Header */}
                                    <button
                                        onClick={() => handleToggle(faq.id)}
                                        id={`faq-trigger-${faq.id}`}
                                        className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                                    >
                                        <span className={`text-[13px] font-black tracking-tight leading-relaxed transition-colors duration-150 ${
                                            isExpanded ? "text-[#6605c7]" : "text-gray-900 group-hover:text-[#6605c7]"
                                        }`}>
                                            {faq.question}
                                        </span>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                                            isExpanded ? "bg-[#6605c7] text-white rotate-180" : "bg-gray-50 text-gray-400 group-hover:bg-[#6605c7]/5 group-hover:text-[#6605c7]"
                                        }`}>
                                            <span className="material-symbols-outlined text-sm font-bold">keyboard_arrow_down</span>
                                        </div>
                                    </button>

                                    {/* Expandable Answer */}
                                    <div
                                        className={`transition-all duration-300 ease-out-in ${
                                            isExpanded ? "max-h-[500px] border-t border-gray-100" : "max-h-0"
                                        }`}
                                    >
                                        <div className="px-6 py-5">
                                            <p className="text-[13px] text-gray-500 font-medium leading-relaxed">
                                                {faq.answer}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-dashed border-gray-200 py-16 text-center">
                            <span className="material-symbols-outlined text-5xl text-gray-300 mb-4 block">question_mark</span>
                            <p className="text-gray-800 text-[13px] font-black mb-1">No matching questions found</p>
                            <p className="text-gray-400 text-[11px] font-medium px-4">We couldn't find any FAQs matching "{searchQuery}". Try adjusting your keywords.</p>
                        </div>
                    )}
                </div>

                {/* Bottom Call to Action */}
                <div className="mt-16 bg-gradient-to-br from-[#f8f5ff] to-[#fdfbf7] rounded-3xl p-8 md:p-12 border border-[#6605c7]/5 text-center relative overflow-hidden shadow-sm">
                    <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-[#6605c7]/5 rounded-full blur-[60px] pointer-events-none"></div>
                    
                    <span className="text-3xl mb-4 block animate-bounce">🙋‍♂️</span>
                    <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-2">Still have questions?</h3>
                    <p className="text-gray-500 text-[13px] font-semibold max-w-md mx-auto mb-8 leading-relaxed">
                        If you couldn't find what you are looking for, our friendly educational loan advisors are available to guide you directly.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <Link
                            href="/apply-loan"
                            className="relative px-8 py-3.5 bg-gradient-to-r from-[#7c3aed] via-[#a855f7] to-[#f43f5e] text-white text-[11px] font-extrabold uppercase tracking-widest rounded-full shadow-[0_4px_0_#4c1d95] hover:shadow-[0_8px_20px_rgba(124,58,237,0.35),0_6px_0_#4c1d95] border-t border-white/20 translate-y-0 hover:-translate-y-1 hover:brightness-105 active:translate-y-0.5 active:shadow-none transition-all duration-150 ease-out cursor-pointer select-none"
                        >
                            Apply Now
                        </Link>
                        
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-8 py-3.5 bg-white text-emerald-600 border border-gray-100 rounded-full font-extrabold text-[11px] uppercase tracking-widest shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer select-none"
                        >
                            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328 0 11.859 0c3.161.001 6.132 1.233 8.367 3.468s3.465 5.207 3.465 8.369c-.004 6.533-5.33 11.857-11.861 11.857-2.003-.001-3.972-.511-5.719-1.488L0 24zm6.59-4.846c1.6.95 3.168 1.449 4.809 1.45 5.511 0 9.995-4.484 9.998-9.995.002-2.67-1.038-5.18-2.929-7.07C16.634 1.649 14.12 0 11.45 0c-5.512 0-9.996 4.484-10 9.997-.002 1.815.49 3.587 1.42 5.161L1.8 21.057l6.59-1.726c.005.005.004-.002.247-.177zm11.237-7.652c-.31-.155-1.838-.907-2.124-1.01-.285-.104-.493-.155-.7.156-.207.31-.803.102-1.01.206-.207.103-.414.051-.724-.103-.31-.155-1.31-.483-2.495-1.54-.922-.822-1.544-1.838-1.725-2.148-.18-.31-.02-.477.136-.631.14-.139.31-.362.466-.543.155-.181.207-.31.31-.517.104-.207.052-.389-.026-.543-.078-.155-.7-.156-.958-2.316-.252-.612-.516-.53-.7-.54l-.6-.01c-.207 0-.544.078-.829.389-.285.31-1.088 1.062-1.088 2.59 0 1.528 1.114 3.004 1.27 3.212.155.207 2.193 3.349 5.313 4.698.742.32 1.32.512 1.77.656.745.236 1.423.203 1.96.123.597-.088 1.838-.75 2.097-1.449.259-.699.259-1.295.182-1.424-.078-.129-.285-.207-.596-.362z"/>
                            </svg>
                            WhatsApp Advisor
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
}
