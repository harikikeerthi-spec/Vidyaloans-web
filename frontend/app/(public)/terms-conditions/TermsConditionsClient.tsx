"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const sections = [
    { id: "acceptance", title: "1. Acceptance of Terms" },
    { id: "eligibility", title: "2. Student Eligibility" },
    { id: "platform-use", title: "3. Scope of Platform Services" },
    { id: "documents", title: "4. User Submissions & Integrity" },
    { id: "ip", title: "5. Intellectual Property Rights" },
    { id: "liability", title: "6. Limitation of Liability" },
    { id: "governing", title: "7. Governing Law & Jurisdiction" }
];

export default function TermsConditionsPage() {
    const [activeSection, setActiveSection] = useState("acceptance");

    useEffect(() => {
        const handleScroll = () => {
            const scrollPosition = window.scrollY + 200;
            for (const section of sections) {
                const el = document.getElementById(section.id);
                if (el) {
                    const top = el.offsetTop;
                    const height = el.offsetHeight;
                    if (scrollPosition >= top && scrollPosition < top + height) {
                        setActiveSection(section.id);
                        break;
                    }
                }
            }
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <div className="min-h-screen relative text-gray-900 overflow-hidden" style={{ background: 'linear-gradient(135deg, #ede0ff 0%, #f3eaff 25%, #fdf6ff 55%, #fef3e8 80%, #fde8c8 100%)' }}>
            
            {/* Elegant Background Decorators from Home Page */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full blur-[120px] opacity-50" style={{ background: 'radial-gradient(circle, #d8b4fe, transparent)' }} />
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px] opacity-40" style={{ background: 'radial-gradient(circle, #fed7aa, transparent)' }} />
                <div className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full blur-[80px] opacity-20" style={{ background: 'radial-gradient(circle, #c4b5fd, transparent)' }} />
                <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'radial-gradient(circle, #6605c7 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
            </div>

            {/* Hero Header */}
            <section className="pt-32 pb-16 px-6 relative z-10 text-center border-b border-black/5">
                <div className="max-w-4xl mx-auto">
                    <span className="inline-block px-4 py-1.5 rounded-xl bg-[#6605c7]/10 border border-[#6605c7]/15 text-[#6605c7] text-[11px] font-bold uppercase tracking-widest mb-4">
                        Legal Documentation
                    </span>
                    <h1 className="text-4xl md:text-6xl font-bold font-display tracking-tight mb-4 text-[#1a1626]">
                        Terms & Conditions
                    </h1>
                    <p className="text-gray-500 text-xs md:text-sm font-bold uppercase tracking-wider">
                        Last Updated: May 26, 2026 • Version 1.8
                    </p>
                </div>
            </section>

            {/* Main Content Layout */}
            <section className="py-20 px-6 relative z-10 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
                    
                    {/* Left Sticky Sidebar Navigation */}
                    <div className="lg:col-span-4">
                        <div className="sticky top-28 bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl p-8 shadow-xl">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-[#6605c7] mb-6">
                                Table of Contents
                            </h3>
                            <ul className="space-y-4">
                                {sections.map((sec) => (
                                    <li key={sec.id}>
                                        <a
                                            href={`#${sec.id}`}
                                            className={`text-[13px] font-semibold transition-all duration-200 block border-l-2 pl-4 ${
                                                activeSection === sec.id
                                                    ? "text-[#6605c7] border-[#6605c7] font-bold"
                                                    : "text-gray-400 border-transparent hover:text-gray-800 hover:border-gray-300"
                                            }`}
                                        >
                                            {sec.title}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                            
                            <div className="mt-8 pt-6 border-t border-black/5">
                                <p className="text-[11px] text-gray-500 leading-relaxed font-medium">
                                    Have concerns about our platform service conditions? Contact support:{" "}
                                    <a href="mailto:support@vidyaloan.in" className="text-[#6605c7] hover:underline font-bold">
                                        support@vidyaloan.in
                                    </a>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Side Clauses Content */}
                    <div className="lg:col-span-8 space-y-16">
                        
                        <div id="acceptance" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                1. Acceptance of Terms
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    By accessing or using the website, interface panels, dynamic web modules, or backend services of VidyaLoans, you agree to comply with and be legally bound by these Terms & Conditions.
                                </p>
                                <p>
                                    If you do not accept these Service Terms in their entirety, you must immediately terminate usage of this website and discontinue applying for education loans through our system.
                                </p>
                            </div>
                        </div>

                        <div id="eligibility" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                2. Student Eligibility
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    To register an active account, create matched profiles, and utilize the education loan acceleration features of VidyaLoans:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-gray-500">
                                    <li>You must be a citizen of India or a legally recognized resident of an eligible jurisdiction.</li>
                                    <li>You must be applying for studies at a qualified global university or domestic institution.</li>
                                    <li>You must have a co-applicant who meets baseline credit rating scores and has verified income sources under local taxation laws.</li>
                                </ul>
                            </div>
                        </div>

                        <div id="platform-use" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                3. Scope of Platform Services
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    VidyaLoans acts as a centralized matching and application consolidation helper platform:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-gray-500">
                                    <li>We consolidate interest rates, banking fees, and lending conditions based on bank specifications. Matching scores represent estimations, not final commitments from banking partners.</li>
                                    <li>Lenders reserve ultimate discretionary authority to sanction, approve, reject, or modify loan terms. VidyaLoans is not a direct banking institution or primary capital provider.</li>
                                    <li>All interactive software instruments, including the Grade Converter, EMI calculator, and Admit Predictor, are designed to assist estimation efforts. They do not constitute certified academic or financial counseling guarantees.</li>
                                </ul>
                            </div>
                        </div>

                        <div id="documents" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                4. User Submissions & Integrity
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    Students assume absolute responsibility for the integrity and legitimacy of all files submitted via the portal:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-gray-500">
                                    <li>You guarantee that all academic scorecards, identification cards, co-applicant salaries, and asset declarations are true, accurate, and completely unedited.</li>
                                    <li>Submitting forged documents, falsified bank records, or misleading credentials constitutes a severe violation of service terms and may lead to instant account termination and legal reporting to partner banks.</li>
                                </ul>
                            </div>
                        </div>

                        <div id="ip" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                5. Intellectual Property Rights
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    The software architectures, layout interfaces, algorithms, logo styles, source code, data trackers, and dynamic content on VidyaLoans are the sole property of VidyaLoan Inc. and are protected by domestic and global intellectual property laws.
                                </p>
                                <p>
                                    You agree not to reverse engineer, duplicate, crawl, extract, or scrape any software modules or database contents without written permission from VidyaLoan Inc.
                                </p>
                            </div>
                        </div>

                        <div id="liability" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                6. Limitation of Liability
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    VidyaLoans and its executives, directors, or banking developers shall not be liable for any indirect, incidental, special, or consequential damages resulting from:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-gray-500">
                                    <li>The denial, rejection, or delay of a loan application by any bank or NBFC.</li>
                                    <li>Temporary system outages, technical maintenance downtime, or database access failures.</li>
                                    <li>Any financial choices, interest rate fluctuations, or repayment commitments students finalize with external banks.</li>
                                </ul>
                            </div>
                        </div>

                        <div id="governing" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                7. Governing Law & Jurisdiction
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    These Terms & Conditions are governed and constructed in accordance with the laws of the Republic of India.
                                </p>
                                <p>
                                    Any legal disputes, claims, or regulatory arguments concerning VidyaLoans operations shall be submitted to the exclusive jurisdiction of the competent courts of Hyderabad, Telangana, India.
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* Quick Link Footer Card */}
            <section className="py-20 px-6 relative z-10 text-center max-w-4xl mx-auto border-t border-black/5">
                <h3 className="text-xl font-bold font-display mb-4 text-gray-900 font-display">Want to read our Cookie Policy?</h3>
                <p className="text-gray-500 text-[13px] max-w-xl mx-auto mb-8 font-medium leading-relaxed">
                    Learn about how we use cookies and tracking tokens to customize your matched educational journey.
                </p>
                <Link
                    href="/cookies"
                    className="inline-block px-8 py-3.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:-translate-y-0.5 transition-all text-xs uppercase tracking-wider shadow-sm"
                >
                    View Cookie Policy
                </Link>
            </section>
        </div>
    );
}
