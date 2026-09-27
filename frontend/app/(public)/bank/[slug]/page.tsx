
import { banks } from "@/lib/bankData";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchTopGoogleReviews } from "@/lib/googleReviews";

interface Props {
    params: Promise<{
        slug: string;
    }>;
}

async function getDynamicBankBySlug(slug: string) {
    try {
        const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:5000";
        const res = await fetch(`${backendUrl}/api/reference/banks/slug/${slug}`, { next: { revalidate: 60 } });
        const json = await res.json();
        if (json?.success && json.data) {
            return json.data;
        }
    } catch (e) {
        console.error(`Error fetching dynamic bank ${slug}:`, e);
    }
    return null;
}

export async function generateMetadata({ params }: Props) {
    const { slug } = await params;
    const dbBank = await getDynamicBankBySlug(slug);
    const name = dbBank ? dbBank.name : (banks[slug]?.name || "Bank Not Found");
    const description = dbBank ? (dbBank.features?.[0] || `Get customized education loans from ${dbBank.name}.`) : (banks[slug]?.description || "");

    return {
        title: `${name} Education Loan - VidyaLoan`,
        description: description,
    };
}

export default async function BankPage({ params }: Props) {
    const { slug } = await params;
    const dbBank = await getDynamicBankBySlug(slug);
    let bank = banks[slug];

    if (dbBank) {
        const roiStr = dbBank.interestRateMin === dbBank.interestRateMax
            ? `${dbBank.interestRateMin}%`
            : `${dbBank.interestRateMin}% - ${dbBank.interestRateMax}%`;

        const dbFeatures = dbBank.features && dbBank.features.length > 0 ? dbBank.features.map((feat: string, i: number) => {
            const colors = [
                { iconColor: "text-red-500", bgColor: "bg-red-500/10", icon: "percent" },
                { iconColor: "text-blue-500", bgColor: "bg-blue-500/10", icon: "account_balance" },
                { iconColor: "text-green-500", bgColor: "bg-green-500/10", icon: "schedule" },
                { iconColor: "text-orange-500", bgColor: "bg-orange-500/10", icon: "payments" }
            ];
            const parts = feat.split(":");
            const title = parts[0]?.trim() || "Feature";
            const desc = parts.slice(1).join(":")?.trim() || feat;
            const style = colors[i % colors.length];
            return {
                icon: style.icon,
                title,
                desc,
                iconColor: style.iconColor,
                bgColor: style.bgColor
            };
        }) : [];

        if (bank) {
            bank = {
                ...bank,
                name: dbBank.name,
                logo: dbBank.logoUrl || bank.logo || "",
                interestRate: roiStr,
                maxLoan: dbBank.maxLoanAmount,
                approvalTime: dbBank.processingTime,
                description: dbBank.features?.[0] || bank.description,
                features: dbFeatures.length > 0 ? dbFeatures : bank.features,
                specifications: [
                    { label: "Interest Rate", value: `${roiStr} p.a.` },
                    { label: "Loan Amount", value: dbBank.maxLoanAmount },
                    { label: "Repayment Tenure", value: bank.specifications?.find(s => s.label === "Repayment Tenure")?.value || "Up to 15 years" },
                    { label: "Moratorium Period", value: bank.specifications?.find(s => s.label === "Moratorium Period")?.value || "Course + 12 months" },
                    { label: "Collateral", value: dbBank.collateralRequired ? "Required" : `Not required up to ${dbBank.collateralFreeLimit || '₹40L'}` }
                ]
            };
        } else {
            bank = {
                name: dbBank.name,
                slug: dbBank.shortName || slug,
                logo: dbBank.logoUrl || "",
                rating: "4.5",
                description: dbBank.features?.[0] || `Get customized education loans from ${dbBank.name}.`,
                interestRate: roiStr,
                maxLoan: dbBank.maxLoanAmount,
                approvalTime: dbBank.processingTime,
                primaryColor: "#6605c7",
                gradient: "linear-gradient(135deg, #6605c7 0%, #4f0496 100%)",
                stats: {
                    studentsFunded: "10,000+",
                    universitiesCovered: "500+",
                    countriesSupported: "20+",
                    customerRating: "4.5★"
                },
                features: dbFeatures,
                specifications: [
                    { label: "Interest Rate", value: `${roiStr} p.a.` },
                    { label: "Loan Amount", value: dbBank.maxLoanAmount },
                    { label: "Repayment Tenure", value: "Up to 15 years" },
                    { label: "Moratorium Period", value: "Course + 12 months" },
                    { label: "Collateral", value: dbBank.collateralRequired ? "Required" : `Not required up to ${dbBank.collateralFreeLimit || '₹40L'}` }
                ],
                eligibility: [
                    { title: "Admission Confirmed", desc: "From recognized university abroad" },
                    { title: "Co-Applicant Required", desc: "Parent or guardian with income proof" }
                ],
                documents: [
                    { icon: "badge", title: "Identity Proof", desc: "Passport, Aadhaar, PAN Card", color: "red" },
                    { icon: "school", title: "Admission Letter", desc: "From the university/college", color: "blue" }
                ],
                courses: [
                    { icon: "computer", title: "MS in CS", color: "red" },
                    { icon: "business", title: "MBA", color: "blue" }
                ],
                uniqueFeatures: []
            };
        }
    }

    if (!bank) {
        notFound();
    }

    const dynamicTestimonials = await fetchTopGoogleReviews();

    const howItWorksSteps = [
        { icon: "checklist", title: "Check Eligibility", desc: "Use our free tool to verify your eligibility and receive conditional loan offers instantly." },
        { icon: "support_agent", title: "Talk to Experts", desc: "Connect with our dedicated loan counselor for better understanding of the process." },
        { icon: "upload_file", title: "Upload Documents", desc: "Submit your documents for bank verification and evaluation through our portal." },
        { icon: "handshake", title: "Get Best Rates", desc: "Our experts negotiate to secure competitive interest rates and highest loan amount." },
        { icon: "verified", title: "Loan Disbursement", desc: "Receive your final approval and sanction letter with prompt fund disbursement." }
    ];

    const faqs = [
        { q: `What is the maximum loan amount from ${bank.name}?`, a: `${bank.name} offers education loans up to ${bank.maxLoan} for study abroad programs. The exact amount depends on your course, university, and profile.` },
        { q: `What is the interest rate for ${bank.name} education loan?`, a: `Interest rates start from ${bank.interestRate} p.a. The final rate depends on your profile, collateral, and loan amount.` },
        { q: `Is collateral required for ${bank.name} education loan?`, a: `Both secured and unsecured loan options are available. Unsecured loans are available for select universities and courses.` },
        { q: `How long does ${bank.name} take to process education loans?`, a: `Through VidyaLoan, the typical processing time is ${bank.approvalTime}. Direct applications may take longer.` },
        { q: `Can I get pre-visa disbursement from ${bank.name}?`, a: `Yes, ${bank.name} offers pre-visa disbursement for eligible applicants through VidyaLoan's facilitation.` }
    ];

    return (
        <main className="relative z-10 pt-32 pb-24">
            <div className="max-w-7xl mx-auto px-6">
                {/* Breadcrumb */}
                <nav className="mb-8">
                    <ol className="flex items-center gap-2 text-sm text-gray-500">
                        <li><Link href="/" className="hover:text-[#6605c7]">Home</Link></li>
                        <li><span className="material-symbols-outlined text-xs">chevron_right</span></li>
                        <li><Link href="/bank-reviews" className="hover:text-[#6605c7]">Education Loans</Link></li>
                        <li><span className="material-symbols-outlined text-xs">chevron_right</span></li>
                        <li className="text-gray-900 font-medium">{bank.name}</li>
                    </ol>
                </nav>

                {/* Hero Section */}
                <section className="mb-16">
                    <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-8 lg:p-12 shadow-lg">
                        <div className="flex flex-col lg:flex-row gap-8 items-start">
                            <div className="w-28 h-28 rounded-2xl bg-white flex items-center justify-center p-4 border border-gray-100 shadow-sm overflow-hidden flex-shrink-0">
                                <img src={bank.logo} alt={bank.name} className="w-full h-auto object-contain" />
                            </div>
                            <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-4 mb-4">
                                    <h1 className="text-3xl md:text-4xl font-bold font-display text-gray-900">
                                        {bank.name} Education Loan
                                    </h1>
                                    <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
                                        <span className="material-symbols-outlined text-green-600 text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                        <span className="text-sm font-bold text-green-700">{bank.rating}</span>
                                    </div>
                                    <span className="px-3 py-1 bg-[#6605c7]/10 text-[#6605c7] rounded-full text-xs font-bold uppercase tracking-wider">Verified Partner</span>
                                </div>
                                <p className="text-lg text-gray-600 leading-relaxed mb-8 max-w-3xl">
                                    {bank.description}
                                </p>

                                {/* Quick Stats Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                                    <div className="bg-gradient-to-br from-[#6605c7]/5 to-[#6605c7]/10 p-5 rounded-2xl border border-[#6605c7]/10">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined text-[#6605c7] text-lg">percent</span>
                                            <span className="text-xs font-bold text-[#6605c7] uppercase tracking-wider">Interest Rate</span>
                                        </div>
                                        <p className="text-2xl font-bold text-gray-900">{bank.interestRate}</p>
                                        <p className="text-xs text-gray-500 mt-1">p.a. onwards</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-green-50 to-green-100/50 p-5 rounded-2xl border border-green-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined text-green-600 text-lg">account_balance</span>
                                            <span className="text-xs font-bold text-green-600 uppercase tracking-wider">Max Loan</span>
                                        </div>
                                        <p className="text-2xl font-bold text-gray-900">{bank.maxLoan}</p>
                                        <p className="text-xs text-gray-500 mt-1">100% coverage</p>
                                    </div>
                                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 p-5 rounded-2xl border border-blue-100">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined text-blue-600 text-lg">schedule</span>
                                            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Approval</span>
                                        </div>
                                        <p className="text-2xl font-bold text-gray-900">{bank.approvalTime}</p>
                                        <p className="text-xs text-gray-500 mt-1">fast-track</p>
                                    </div>
                                </div>

                                {/* CTA Buttons */}
                                <div className="flex flex-wrap gap-4">
                                    <Link href={`/apply-loan?bank=${bank.slug}`} className="px-8 py-4 rounded-xl font-bold text-white shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-wider flex items-center gap-2" style={{ background: bank.gradient }}>
                                        <span className="material-symbols-outlined">send</span>
                                        Apply Now
                                    </Link>
                                    <Link href="/loan-eligibility" className="px-8 py-4 bg-white border-2 border-[#6605c7]/20 rounded-xl font-bold text-[#6605c7] hover:bg-[#6605c7]/5 hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined">verified_user</span>
                                        Check Eligibility
                                    </Link>
                                    {/* <Link href="/referral" className="px-8 py-4 bg-gradient-to-r from-[#e0c389] to-[#d4a743] rounded-xl font-bold text-gray-900 shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-sm uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined">card_giftcard</span>
                                        Refer & Earn ₹3,000
                                    </Link> */}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* How It Works Section */}
                <section className="mb-20">
                    <div className="text-center mb-12">
                        <span className="text-[#6605c7] font-bold text-xs tracking-[0.2em] uppercase mb-3 block">Simple Process</span>
                        <h2 className="text-4xl font-bold font-display text-gray-900 mb-4">How It Works</h2>
                        <p className="text-gray-500 max-w-2xl mx-auto">Simple 5-step digital process to get your education loan approved</p>
                    </div>
                    <div className="relative">
                        {/* Connection Line */}
                        <div className="hidden lg:block absolute top-24 left-[10%] right-[10%] h-0.5 bg-gradient-to-r from-[#6605c7]/20 via-[#6605c7] to-[#6605c7]/20" />
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
                            {howItWorksSteps.map((step, i) => (
                                <div key={i} className="relative bg-white/80 backdrop-blur-xl border border-gray-100 p-6 rounded-2xl text-center hover:shadow-xl transition-all hover:-translate-y-2 group">
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-[#6605c7] text-white text-sm font-bold flex items-center justify-center shadow-lg">
                                        {i + 1}
                                    </div>
                                    <div className="w-16 h-16 bg-[#6605c7]/10 rounded-2xl flex items-center justify-center mx-auto mb-4 mt-4 group-hover:scale-110 group-hover:bg-[#6605c7]/20 transition-all">
                                        <span className="material-symbols-outlined text-3xl text-[#6605c7]">{step.icon}</span>
                                    </div>
                                    <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                                    <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Stats Counter Section */}
                <section className="mb-20">
                    <div className="rounded-3xl p-10 text-white relative overflow-hidden" style={{ background: bank.gradient }}>
                        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80')] opacity-10 bg-cover bg-center" />
                        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-8">
                            {[
                                { label: "Students Funded", value: bank.stats.studentsFunded, icon: "groups" },
                                { label: "Universities", value: bank.stats.universitiesCovered, icon: "school" },
                                { label: "Countries", value: bank.stats.countriesSupported, icon: "public" },
                                { label: "Rating", value: bank.stats.customerRating, icon: "star" }
                            ].map((stat, i) => (
                                <div key={i} className="text-center">
                                    <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <span className="material-symbols-outlined text-2xl">{stat.icon}</span>
                                    </div>
                                    <p className="text-4xl font-bold font-display mb-1">{stat.value}</p>
                                    <p className="text-sm opacity-80 uppercase tracking-wider">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Loan Overview Table */}
                <section className="mb-20">
                    <div className="text-center mb-12">
                        <span className="text-[#6605c7] font-bold text-xs tracking-[0.2em] uppercase mb-3 block">Complete Details</span>
                        <h2 className="text-4xl font-bold font-display text-gray-900">Loan Overview</h2>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl overflow-hidden shadow-lg">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-100" style={{ background: `linear-gradient(135deg, ${bank.primaryColor}10 0%, ${bank.primaryColor}05 100%)` }}>
                                        <th className="text-left p-6 font-bold text-gray-900 uppercase text-xs tracking-wider">Parameter</th>
                                        <th className="text-left p-6 font-bold text-gray-900 uppercase text-xs tracking-wider">Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bank.specifications.filter(spec => !spec.label.toLowerCase().includes("processing")).map((spec, i) => (
                                        <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                            <td className="p-6 text-gray-600 font-medium">{spec.label}</td>
                                            <td className="p-6 font-bold text-gray-900">{spec.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="mb-20">
                    <div className="text-center mb-12">
                        <span className="text-[#6605c7] font-bold text-xs tracking-[0.2em] uppercase mb-3 block">Key Benefits</span>
                        <h2 className="text-4xl font-bold font-display text-gray-900">Why Choose {bank.name}?</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {bank.features.map((feature, i) => (
                            <div key={i} className="bg-white/80 backdrop-blur-xl border border-gray-100 p-8 rounded-2xl hover:shadow-2xl transition-all hover:-translate-y-2 group">
                                <div className={`w-16 h-16 ${feature.bgColor} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                                    <span className={`material-symbols-outlined text-3xl ${feature.iconColor}`}>{feature.icon}</span>
                                </div>
                                <h3 className="font-bold text-gray-900 text-lg mb-3">{feature.title}</h3>
                                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Eligibility & Documents Grid */}
                <section className="mb-20">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Eligibility Criteria */}
                        <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-8 shadow-lg">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-2xl text-green-600">task_alt</span>
                                </div>
                                <h2 className="text-2xl font-bold font-display">Eligibility Criteria</h2>
                            </div>
                            <div className="space-y-4">
                                {bank.eligibility.map((item, i) => (
                                    <div key={i} className="flex items-start gap-4 p-4 bg-gray-50/50 rounded-xl hover:bg-green-50/50 transition-colors group">
                                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-green-200 transition-colors">
                                            <span className="material-symbols-outlined text-green-600 text-lg">check</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-900 mb-1">{item.title}</p>
                                            <p className="text-sm text-gray-500">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Documents Required */}
                        <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl p-8 shadow-lg">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-2xl text-blue-600">folder_open</span>
                                </div>
                                <h2 className="text-2xl font-bold font-display">Documents Required</h2>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {bank.documents.map((doc, i) => (
                                    <div key={i} className="flex items-start gap-3 p-4 bg-gray-50/50 rounded-xl hover:bg-blue-50/50 transition-colors group">
                                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                            <span className="material-symbols-outlined text-xl" style={{ color: bank.primaryColor }}>{doc.icon}</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-gray-900">{doc.title}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{doc.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* The VidyaLoan Effect - Comparison Table */}
                <section className="mb-20">
                    <div className="text-center mb-12">
                        <span className="text-[#6605c7] font-bold text-xs tracking-[0.2em] uppercase mb-3 block">Why Apply Through Us</span>
                        <h2 className="text-4xl font-bold font-display text-gray-900">The VidyaLoan Effect</h2>
                        <p className="text-gray-500 mt-4 max-w-2xl mx-auto">See why thousands of students choose to apply through VidyaLoan</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-3xl overflow-hidden shadow-lg">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gradient-to-r from-[#6605c7]/5 to-transparent">
                                    <th className="text-left p-6 font-bold text-gray-900 uppercase text-xs tracking-wider">Comparison</th>
                                    <th className="text-center p-6">
                                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#6605c7] text-white rounded-full text-sm font-bold">
                                            <span className="material-symbols-outlined text-lg">verified</span>
                                            With VidyaLoan
                                        </div>
                                    </th>
                                    <th className="text-center p-6 text-gray-500 font-medium text-sm">Direct Application</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { feature: "Processing Time", withUs: bank.approvalTime, without: "15-30 days" },
                                    { feature: "Personalized Document Checklist", withUs: "Yes", without: "No" },
                                    { feature: "Branch Visits Required", withUs: "1-2", without: "5-8" },
                                    { feature: "Pre-visa Disbursement", withUs: "Easy", without: "Difficult" },
                                    { feature: "Dedicated Loan Expert", withUs: "Yes", without: "No" },
                                    { feature: "Rate Negotiation", withUs: "Yes", without: "No" },
                                    { feature: "Application Tracking", withUs: "Real-time", without: "Manual follow-up" },
                                    { feature: "Service Cost", withUs: "100% Free", without: "N/A" }
                                ].map((row, i) => (
                                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                        <td className="p-6 font-medium text-gray-700">{row.feature}</td>
                                        <td className="p-6 text-center">
                                            <span className="inline-flex items-center gap-2 text-green-600 font-bold">
                                                <span className="material-symbols-outlined text-lg">check_circle</span>
                                                {row.withUs}
                                            </span>
                                        </td>
                                        <td className="p-6 text-center text-gray-400">{row.without}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Refer & Earn Banner */}
                <section className="mb-20">
                    <div className="bg-gradient-to-r from-[#e0c389] to-[#d4a743] rounded-3xl p-8 lg:p-12 relative overflow-hidden shadow-xl">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24 blur-3xl" />
                        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 bg-white/30 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                                    <span className="material-symbols-outlined text-5xl text-gray-900">campaign</span>
                                </div>
                                <div>
                                    <h3 className="text-3xl font-bold font-display text-gray-900 mb-2">Refer & Earn Unlimited!</h3>
                                    <p className="text-gray-800 text-lg">Earn <span className="font-bold">₹3,000</span> for every successful referral. Plus, get a <span className="font-bold">₹10,000 bonus</span> every time you hit 5 referrals.</p>
                                    <p className="text-gray-700 mt-2">No limits! Keep referring. Keep earning.</p>
                                </div>
                            </div>
                            {/* <Link href="/referral" className="px-10 py-5 bg-gray-900 text-white rounded-xl font-bold text-lg hover:bg-gray-800 hover:scale-105 active:scale-95 transition-all shadow-xl uppercase tracking-wider flex items-center gap-3 whitespace-nowrap">
                                <span className="material-symbols-outlined text-xl">card_giftcard</span>
                                Refer Now
                            </Link> */}
                        </div>
                    </div>
                </section>

                {/* Popular Courses Section */}
                <section className="mb-20">
                    <div className="text-center mb-12">
                        <span className="text-[#6605c7] font-bold text-xs tracking-[0.2em] uppercase mb-3 block">Covered Programs</span>
                        <h2 className="text-4xl font-bold font-display text-gray-900">Popular Courses Funded</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {bank.courses.map((course, i) => (
                            <div key={i} className="bg-white/80 border border-gray-100 p-6 rounded-2xl text-center hover:shadow-lg transition-all hover:scale-105 cursor-default group">
                                <div className="w-14 h-14 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform" style={{ backgroundColor: `${bank.primaryColor}10` }}>
                                    <span className="material-symbols-outlined text-3xl" style={{ color: bank.primaryColor }}>{course.icon}</span>
                                </div>
                                <p className="font-bold text-xs uppercase tracking-wider text-gray-700">{course.title}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* FAQ Section */}
                <section className="mb-20">
                    <div className="text-center mb-12">
                        <span className="text-[#6605c7] font-bold text-xs tracking-[0.2em] uppercase mb-3 block">Got Questions?</span>
                        <h2 className="text-4xl font-bold font-display text-gray-900">Frequently Asked Questions</h2>
                    </div>
                    <div className="max-w-4xl mx-auto space-y-4">
                        {faqs.map((faq, i) => (
                            <details key={i} className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-2xl overflow-hidden group">
                                <summary className="p-6 cursor-pointer font-bold text-gray-900 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                    <span className="flex items-center gap-4">
                                        <span className="w-8 h-8 bg-[#6605c7]/10 rounded-lg flex items-center justify-center text-[#6605c7] font-bold text-sm">{i + 1}</span>
                                        {faq.q}
                                    </span>
                                    <span className="material-symbols-outlined text-gray-400 group-open:rotate-180 transition-transform">expand_more</span>
                                </summary>
                                <div className="px-6 pb-6 pt-2 text-gray-600 leading-relaxed ml-12">
                                    {faq.a}
                                </div>
                            </details>
                        ))}
                    </div>
                </section>

                {/* Customer Testimonials Placeholder */}
                <section className="mb-20">
                    <div className="text-center mb-12">
                        <span className="text-[#6605c7] font-bold text-xs tracking-[0.2em] uppercase mb-3 block">Success Stories</span>
                        <h2 className="text-4xl font-bold font-display text-gray-900">Our Customers. Our Pride.</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {dynamicTestimonials.slice(0, 3).map((testimonial, i) => (
                            <div key={i} className="bg-white/80 backdrop-blur-xl border border-gray-100 p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#6605c7] to-[#8b2fd6] flex items-center justify-center text-white text-xl font-bold">
                                        {testimonial.name.charAt(0)}
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">{testimonial.name}</p>
                                        <p className="text-sm text-[#6605c7]">{testimonial.school || "Student"}</p>
                                    </div>
                                </div>
                                <p className="text-gray-600 mb-4">"{testimonial.quote}"</p>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                    <span className="material-symbols-outlined text-lg">star</span>
                                    {testimonial.highlight || "5 Stars"}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Final CTA Section */}
                <section>
                    <div className="rounded-3xl p-12 lg:p-16 text-white text-center relative overflow-hidden shadow-2xl" style={{ background: bank.gradient }}>
                        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1541339907198-e08759df9a73?auto=format&fit=crop&w=1200&q=80')] opacity-10 bg-cover bg-center" />
                        <div className="relative z-10">
                            <h2 className="text-4xl md:text-5xl font-bold font-display mb-6">Ready to Study Abroad?</h2>
                            <p className="text-xl opacity-90 mb-10 max-w-2xl mx-auto leading-relaxed">
                                Start your journey today. Apply through VidyaLoan for faster processing and best rates with {bank.name}.
                            </p>
                            <div className="flex flex-wrap gap-6 justify-center mb-10">
                                <Link href={`/apply-loan?bank=${bank.slug}`} className="px-12 py-5 bg-white text-gray-900 rounded-xl font-bold text-base hover:shadow-2xl hover:scale-105 active:scale-95 transition-all uppercase tracking-wider">
                                    Start Application
                                </Link>
                                <Link href="/loan-eligibility" className="px-12 py-5 bg-white/20 backdrop-blur-md border border-white/40 text-white rounded-xl font-bold text-base hover:bg-white/30 transition-all uppercase tracking-wider">
                                    Check Eligibility
                                </Link>
                                {/* <Link href="/referral" className="px-12 py-5 bg-gradient-to-r from-[#e0c389] to-[#d4a743] text-gray-900 rounded-xl font-bold text-base hover:shadow-2xl hover:scale-105 active:scale-95 transition-all uppercase tracking-wider flex items-center gap-2">
                                    <span className="material-symbols-outlined">card_giftcard</span>
                                    Refer & Earn
                                </Link> */}
                            </div>
                            <div className="flex flex-wrap justify-center gap-8 items-center opacity-80 text-sm font-medium">
                                <span className="flex items-center gap-2"><span className="material-symbols-outlined text-lg">verified</span> 100% Free Service</span>
                                <span className="flex items-center gap-2"><span className="material-symbols-outlined text-lg">verified</span> No Hidden Fees</span>
                                <span className="flex items-center gap-2"><span className="material-symbols-outlined text-lg">verified</span> Dedicated Support</span>
                                <span className="flex items-center gap-2"><span className="material-symbols-outlined text-lg">verified</span> Tax Benefits</span>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
