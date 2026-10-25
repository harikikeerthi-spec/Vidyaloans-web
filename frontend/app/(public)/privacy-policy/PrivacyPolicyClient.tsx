"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const sections = [
    { id: "intro", title: "1. Introduction" },
    { id: "collect", title: "2. Information We Collect" },
    { id: "use", title: "3. How We Use Your Data" },
    { id: "sharing", title: "4. Information Sharing & Disclosure" },
    { id: "security", title: "5. Data Security & Storage" },
    { id: "rights", title: "6. Your Rights & Choices" },
    { id: "contact", title: "7. Contact Data Privacy Officer" }
];

export default function PrivacyPolicyPage() {
    const [activeSection, setActiveSection] = useState("intro");

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
                        Privacy Policy
                    </h1>
                    <p className="text-gray-500 text-xs md:text-sm font-bold uppercase tracking-wider">
                        Last Updated: May 26, 2026 • Version 2.1
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
                                            className={`text-[13px] font-semibold transition-all duration-200 block border-l-2 pl-4 ${activeSection === sec.id
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
                                    Have immediate data privacy concerns? Email us at{" "}
                                    <a href="mailto:privacy@vidyaloan.in" className="text-[#6605c7] hover:underline font-bold">
                                        privacy@vidyaloan.in
                                    </a>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Side Clauses Content */}
                    <div className="lg:col-span-8 space-y-16">

                        <div id="intro" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                1. Introduction
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    Welcome to VidyaLoans (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). We are highly committed to protecting your personal information and ensuring absolute privacy transparency. This Privacy Policy details how we gather, utilize, protect, and handle your data when you interact with our website, platforms, application features, and integrated lending software.
                                </p>
                                <p>
                                    By accessing or using VidyaLoans, you agree to the collection and use of information in accordance with this policy. If you do not agree with any terms within this document, please refrain from submitting information or completing active loan profiles.
                                </p>
                            </div>
                        </div>

                        <div id="collect" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                2. Information We Collect
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    To evaluate your loan application profile and provide high-fidelity automated matching services, we collect several categories of information:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-gray-500">
                                    <li><strong className="text-gray-800 font-bold">Personal Identifiers:</strong> Legal names, date of birth, contact numbers, active email addresses, permanent address, and PAN card / Aadhaar details.</li>
                                    <li><strong className="text-gray-800 font-bold">Academic Details:</strong> Intended university of study, global country selection, GRE/IELTS/TOEFL test scores, academic marksheets, and university offer letters.</li>
                                    <li><strong className="text-gray-800 font-bold">Co-Applicant & Financial Data:</strong> Income records, salary slips, active bank statements, income tax returns (ITRs), and overall family asset/liability profiles.</li>
                                    <li><strong className="text-gray-800 font-bold">Device & Usage Statistics:</strong> Log files, IP addresses, browser specifications, operating system versions, and page interaction timestamps.</li>
                                </ul>
                            </div>
                        </div>

                        <div id="use" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                3. How We Use Your Data
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    We utilize your personal information strictly to deliver, optimize, and evaluate our student education loan services, specifically for:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-gray-500">
                                    <li>Matching your unique student profile with eligible educational lenders and public/private banking partners.</li>
                                    <li>Verifying documents automatically through OCR and DigiLocker systems to fast-track bank review.</li>
                                    <li>Assisting you with automated tools (e.g., dynamic SOP suggestions, EMI calculators, and stress testing simulators).</li>
                                    <li>Sending alerts regarding active loan application status updates, counseling details, and verification stages.</li>
                                    <li>Preventing fraud, mitigating operational risks, and fulfilling legal/regulatory obligations.</li>
                                </ul>
                            </div>
                        </div>

                        <div id="sharing" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                4. Information Sharing & Disclosure
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    VidyaLoans does not sell or lease student database records to third-party marketing companies. We share information only under the following situations:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-gray-500">
                                    <li><strong className="text-gray-800 font-bold">With Banking Partners:</strong> We transmit your profiles and uploaded documents directly to partner banks and NBFCs *only* after you explicitly select and authorize application submissions.</li>
                                    <li><strong className="text-gray-800 font-bold">With Service Providers:</strong> To facilitate specialized features such as secure document fetching, SMS notification updates, and automated OCR processing.</li>
                                    <li><strong className="text-gray-800 font-bold">For Legal Compliance:</strong> When compelled by active judicial orders, public regulations, or governmental laws to prevent potential fraud or financial crimes.</li>
                                </ul>
                            </div>
                        </div>

                        <div id="security" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                5. Data Security & Storage
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    We enforce cutting-edge industry security measures to keep your data secure. All transmission pipelines use secure HTTPS protocols and AES-256 data encryption schemes. Documents retrieved through our integration channels are held within high-security cloud firewalls.
                                </p>
                                <p>
                                    Although we leverage enterprise-grade security tools, no platform transmission over the public internet can be guaranteed 100% secure. You are highly encouraged to safeguard your login details and active profile tokens.
                                </p>
                            </div>
                        </div>

                        <div id="rights" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                6. Your Rights & Choices
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    As a student applying through our platform, you have specific control features over your personal data:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-gray-500">
                                    <li><strong className="text-gray-800 font-bold">Access & Review:</strong> You can review all elements of your application, co-applicant details, and uploaded files inside your student profile dashboard.</li>
                                    <li><strong className="text-gray-800 font-bold">Update & Rectify:</strong> You can correct incomplete entries directly or contact support to request swift changes.</li>
                                    <li><strong className="text-gray-800 font-bold">Data Deletion:</strong> You can request complete termination of your active loan profile and deletion of stored records from our archives, subject to active legal or lending auditing mandates.</li>
                                </ul>
                            </div>
                        </div>

                        <div id="contact" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                7. Contact Data Privacy Officer
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    If you have questions, comments, or data handling complaints regarding this Privacy Policy, please reach out to our dedicated Data Privacy Team:
                                </p>
                                <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-2xl p-6 mt-4 space-y-2.5 shadow-sm">
                                    <p className="text-[13px] text-gray-500 font-medium">
                                        <span className="text-gray-950 font-bold">Email:</span> privacy@vidyaloan.in
                                    </p>
                                    <p className="text-[13px] text-gray-500 font-medium">
                                        <span className="text-gray-950 font-bold">Address:</span> Nuzvid
                                    </p>
                                    <p className="text-[13px] text-gray-500 font-medium">
                                        <span className="text-gray-950 font-bold">Phone:</span> +91 9240209000
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* Quick Link Footer Card */}
            <section className="py-20 px-6 relative z-10 text-center max-w-4xl mx-auto border-t border-black/5">
                <h3 className="text-xl font-bold font-display mb-4 text-gray-900">Want to read our Service Terms?</h3>
                <p className="text-gray-500 text-[13px] max-w-xl mx-auto mb-8 font-medium leading-relaxed">
                    Read the terms and student obligations to ensure complete alignment before completing applications.
                </p>
                <Link
                    href="/terms-conditions"
                    className="inline-block px-8 py-3.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:-translate-y-0.5 transition-all text-xs uppercase tracking-wider shadow-sm"
                >
                    View Terms & Conditions
                </Link>
            </section>
        </div>
    );
}
