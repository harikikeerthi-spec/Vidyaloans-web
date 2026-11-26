"use client";

import Link from "next/link";

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen relative text-gray-900 overflow-hidden" style={{ background: 'linear-gradient(135deg, #eae5f5 0%, #fbf9f5 50%, #e5edf5 100%)' }}>
            {/* Header Hero Section */}
            <section className="pt-32 pb-16 px-6 relative z-10 text-center border-b border-black/5">
                <div className="max-w-4xl mx-auto">
                    <span className="inline-block px-4 py-1.5 rounded-xl bg-[#6605c7]/10 border border-[#6605c7]/15 text-[#6605c7] text-[11px] font-bold uppercase tracking-widest mb-4">
                        Digital Personal Data Protection Act (DPDP Act 2023) Notice
                    </span>
                    <h1 className="text-4xl md:text-6xl font-bold font-display tracking-tight mb-4 text-[#1a1626]">
                        Privacy Policy & Data Protection Notice
                    </h1>
                    <p className="text-gray-500 text-xs md:text-sm font-bold uppercase tracking-wider">
                        Last Updated: November 25, 2026 • Version 2.2
                    </p>
                </div>
            </section>

            {/* Main Content Layout */}
            <section className="py-20 px-6 relative z-10 max-w-4xl mx-auto">
                <div className="space-y-16">

                        {/* 1. Introduction & Legal Framework */}
                        <div id="intro" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                1. Introduction & Legal Framework
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    Welcome to VidyaLoans (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). VidyaLoans operates an enterprise student loan marketplace and financial education platform connecting students and co-applicants with curated banking institutions and NBFCs.
                                </p>
                                <p>
                                    This Privacy Notice is published in strict compliance with the <strong>Digital Personal Data Protection Act, 2023 (&ldquo;DPDP Act 2023&rdquo;)</strong>, the <strong>Information Technology Act, 2000</strong>, the <strong>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011</strong>, and applicable regulatory directives issued by the <strong>Reserve Bank of India (RBI)</strong> and the <strong>Unique Identification Authority of India (UIDAI)</strong>.
                                </p>
                                <p>
                                    Under the DPDP Act 2023, VidyaLoans operates as a <strong>Data Fiduciary</strong> with respect to personal data collected directly from you (the <strong>Data Principal</strong>). By accessing our services, creating a student profile, or initiating loan applications, you provide informed, unconditional, and freely given consent to the collection, processing, and transfer of your personal data as defined herein.
                                </p>
                            </div>
                        </div>

                        {/* 2. Personal Data We Collect */}
                        <div id="collect" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                2. Personal Data We Collect
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    In adherence to the principle of <em>Data Minimization</em> under Section 6 of the DPDP Act 2023, we only collect personal data strictly required to evaluate loan eligibility, match you with lending partners, and process your applications:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-gray-600">
                                    <li>
                                        <strong className="text-gray-900 font-bold">Identity & Officially Valid Documents (OVDs):</strong> Name, date of birth, gender, nationality, PAN card number, Passport details, Voter ID, Driving Licence, or voluntarily provided Masked Aadhaar (where the first 8 digits are redacted pursuant to UIDAI circulars).
                                    </li>
                                    <li>
                                        <strong className="text-gray-900 font-bold">Contact & Residential Information:</strong> Email address, mobile telephone number, permanent residential address, and current correspondence address.
                                    </li>
                                    <li>
                                        <strong className="text-gray-900 font-bold">Academic & University Credentials:</strong> Secondary and senior secondary marksheets (10th/12th), undergraduate/postgraduate degree certificates, university admission offer letters, test scorecards (GRE, GMAT, IELTS, TOEFL), and course curriculum details.
                                    </li>
                                    <li>
                                        <strong className="text-gray-900 font-bold">Financial & Income Records:</strong> Student and co-applicant/guarantor banking account statements, salary slips, Form 16, Income Tax Returns (ITR), existing debt obligations, and property/collateral documentation where applicable.
                                    </li>
                                    <li>
                                        <strong className="text-gray-900 font-bold">Co-Applicant & Guarantor Details:</strong> Personal, contact, occupational, and KYC details of parents, guardians, or financial co-signers who explicitly consent to support the education loan.
                                    </li>
                                    <li>
                                        <strong className="text-gray-900 font-bold">Technical & Usage Telemetry:</strong> IP addresses, browser agent specifications, device identifiers, session timestamps, and consent telemetry logs.
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* 3. Purposes of Processing & Lawful Basis */}
                        <div id="use" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                3. Purposes of Processing & Lawful Basis
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    Pursuant to Section 4 and Section 6 of the DPDP Act 2023, all processing activities are governed by explicit consent and legitimate use for specified purposes:
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[#6605c7] text-[18px]">account_balance</span>
                                            Loan Underwriting & Dispatch
                                        </h4>
                                        <p className="text-[12px] text-gray-600 leading-normal">
                                            Evaluating loan eligibility, checking debt-to-income ratios, computing EMIs, and transmitting application dossiers to applicant-selected banks and NBFCs.
                                        </p>
                                    </div>
                                    <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[#6605c7] text-[18px]">verified_user</span>
                                            KYC & Identity Verification
                                        </h4>
                                        <p className="text-[12px] text-gray-600 leading-normal">
                                            Verifying student authenticity, performing OCR parsing on academic transcripts, and paperless e-KYC integration via Government-notified repositories (DigiLocker).
                                        </p>
                                    </div>
                                    <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[#6605c7] text-[18px]">notifications_active</span>
                                            Application Tracking & Support
                                        </h4>
                                        <p className="text-[12px] text-gray-600 leading-normal">
                                            Sending transactional SMS/email updates on application sanction status, lender queries, and customer support ticket resolutions.
                                        </p>
                                    </div>
                                    <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-4 shadow-sm">
                                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-[#6605c7] text-[18px]">gavel</span>
                                            Statutory & Regulatory Audit
                                        </h4>
                                        <p className="text-[12px] text-gray-600 leading-normal">
                                            Complying with anti-money laundering (PMLA 2002) reporting, cybersecurity incident logging under CERT-In, and legal audit trials.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. Authorised Data Processors */}
                        <div id="processors" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                4. Authorised Data Processors & Sub-Processors
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    Under Section 8(2) of the DPDP Act 2023, a Data Fiduciary may engage Data Processors to process personal data on its behalf only under a valid, legally binding contract. We engage the following verified sub-processors under strict confidentiality and data-protection terms:
                                </p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden bg-white/80">
                                        <thead className="bg-purple-50/70 text-slate-900 font-bold border-b border-slate-200">
                                            <tr>
                                                <th className="p-3">Processor</th>
                                                <th className="p-3">Category</th>
                                                <th className="p-3">Purpose</th>
                                                <th className="p-3">Data Location</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                            <tr>
                                                <td className="p-3 font-semibold">Google Identity Services</td>
                                                <td className="p-3">Authentication</td>
                                                <td className="p-3">Single Sign-On (OAuth 2.0) verification for student login</td>
                                                <td className="p-3">Global / India</td>
                                            </tr>
                                            <tr>
                                                <td className="p-3 font-semibold">Google Analytics 4 & GTM</td>
                                                <td className="p-3">Analytics</td>
                                                <td className="p-3">Pseudonymized web traffic, engagement telemetry & error monitoring</td>
                                                <td className="p-3">Global / India</td>
                                            </tr>
                                            <tr>
                                                <td className="p-3 font-semibold">Native DPDP Consent Banner</td>
                                                <td className="p-3">Consent Management</td>
                                                <td className="p-3">Capturing, logging, and persisting cookie and processing consents</td>
                                                <td className="p-3">India (Client-Side)</td>
                                            </tr>
                                            <tr>
                                                <td className="p-3 font-semibold">Google Gemini API / OCR</td>
                                                <td className="p-3">AI & Document Processing</td>
                                                <td className="p-3">Intelligent optical character recognition (OCR) on marksheets and statements</td>
                                                <td className="p-3">India / Enterprise Sandbox</td>
                                            </tr>
                                            <tr>
                                                <td className="p-3 font-semibold">Amazon Web Services (AWS)</td>
                                                <td className="p-3">Cloud Storage & Mail</td>
                                                <td className="p-3">Encrypted S3 document vault storage and transactional email delivery (SES)</td>
                                                <td className="p-3">India (ap-south-1 Mumbai)</td>
                                            </tr>
                                            <tr>
                                                <td className="p-3 font-semibold">Supabase / PostgreSQL</td>
                                                <td className="p-3">Database Host</td>
                                                <td className="p-3">Encrypted database storage for loan dossiers and user profiles</td>
                                                <td className="p-3">Asia-Pacific (Encrypted)</td>
                                            </tr>
                                            <tr>
                                                <td className="p-3 font-semibold">DigiLocker (NeGD / MeitY)</td>
                                                <td className="p-3">Government e-KYC</td>
                                                <td className="p-3">Direct, user-consented retrieval of verified academic and identity records</td>
                                                <td className="p-3">India (Government Cloud)</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* 5. Information Sharing with Lending Partners */}
                        <div id="sharing" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                5. Information Sharing with Lending Partners
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    VidyaLoans maintains an uncompromising <strong>No-Sale Policy</strong>. We do not sell, rent, trade, or monetize your personal data to unsolicited third parties, lead aggregators, or marketing firms.
                                </p>
                                <p>
                                    Your loan dossier (including identity credentials, academic achievements, and financial income proofs) is transmitted <strong>solely to the specific lending institutions you elect to apply to</strong>. Our curated network includes RBI-regulated entities such as:
                                </p>
                                <div className="p-4 bg-white/70 border border-slate-200 rounded-2xl">
                                    <p className="text-xs text-gray-700 leading-relaxed font-semibold">
                                        Partner Lenders: Auxilo Finserve, Avanse Financial Services, HDFC Credila, IDFC FIRST Bank, InCred Financial Services, Poonawalla Fincorp, and other participating Scheduled Commercial Banks and RBI-registered NBFCs.
                                    </p>
                                </div>
                                <p>
                                    Once shared with a lender at your request, the lender processes your information in their capacity as an independent Data Fiduciary subject to RBI regulations, credit bureau guidelines (CIBIL, Experian, Equifax, CRIF High Mark), and their respective privacy policies.
                                </p>
                            </div>
                        </div>

                        {/* 6. Data Security & Storage */}
                        <div id="security" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                6. Data Security & Storage
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    We employ bank-grade security protocols to protect your personal and financial data against unauthorized access, loss, alteration, or disclosure:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-gray-600">
                                    <li><strong className="text-gray-900 font-bold">Cryptographic Protection:</strong> All data in transit is encrypted using modern TLS 1.3 protocol. Sensitive documents in the storage vault are encrypted at rest using industry-standard AES-256 encryption.</li>
                                    <li><strong className="text-gray-900 font-bold">Time-Limited Access:</strong> Stored documents are served only via short-lived, presigned S3 URLs that expire within 60 minutes.</li>
                                    <li><strong className="text-gray-900 font-bold">Role-Based Access Control (RBAC):</strong> Access to user records is strictly restricted to assigned loan officers, compliance auditors, and system administrators with multi-factor authentication (MFA).</li>
                                    <li><strong className="text-gray-900 font-bold">Data Residency:</strong> All primary personal data and document vaults are hosted on secure infrastructure located within the Republic of India (AWS Mumbai ap-south-1). Any cross-border data transfer complies strictly with notifications of the Central Government under Section 16 of the DPDP Act 2023.</li>
                                </ul>
                            </div>
                        </div>

                        {/* 7. Data Retention & Erasure Schedule */}
                        <div id="retention" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                7. Data Retention & Erasure Schedule
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    Under Section 8(7) of the DPDP Act 2023, we retain personal data only for as long as necessary to fulfill the specified purposes for which it was collected, or to satisfy statutory legal and regulatory retention obligations:
                                </p>
                                <div className="space-y-3">
                                    <div className="p-4 bg-white/80 border border-slate-200 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-xs text-gray-900">Submitted Loan Dossiers & KYC Records</span>
                                            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">8 Years Retention</span>
                                        </div>
                                        <p className="text-[12px] text-gray-600">
                                            Retained for the life of the loan application plus 8 years following application resolution, sanction, or rejection in strict accordance with the <strong>Prevention of Money Laundering Act (PMLA), 2002</strong> and <strong>RBI KYC Master Directions</strong>.
                                        </p>
                                    </div>

                                    <div className="p-4 bg-white/80 border border-slate-200 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-xs text-gray-900">Incomplete Draft Applications</span>
                                            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">180 Days</span>
                                        </div>
                                        <p className="text-[12px] text-gray-600">
                                            Drafts or enquiries not completed or submitted within 180 days are permanently flagged for automated database purging and vault shredding.
                                        </p>
                                    </div>

                                    <div className="p-4 bg-white/80 border border-slate-200 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-xs text-gray-900">Server Logs & Access Telemetry</span>
                                            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">180 Days</span>
                                        </div>
                                        <p className="text-[12px] text-gray-600">
                                            System and access logs are retained for 180 days in compliance with statutory directions issued by the <strong>Indian Computer Emergency Response Team (CERT-In)</strong>.
                                        </p>
                                    </div>

                                    <div className="p-4 bg-white/80 border border-slate-200 rounded-xl">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="font-bold text-xs text-gray-900">Consent & Grievance Logs</span>
                                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">5 Years</span>
                                        </div>
                                        <p className="text-[12px] text-gray-600">
                                            Consent audit records and grievance redressal tickets are retained for 5 years to demonstrate evidentiary proof of compliance under Section 6(10) of the DPDP Act 2023.
                                        </p>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-500 italic">
                                    Upon expiry of the designated retention schedule or valid approval of an erasure request, personal data is permanently destroyed using cryptographic shredding techniques.
                                </p>
                            </div>
                        </div>

                        {/* 8. Your Rights & Consent Withdrawal */}
                        <div id="rights" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                8. Your Rights & Consent Withdrawal
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    Under Chapter III of the DPDP Act 2023, you enjoy statutory rights as a Data Principal:
                                </p>
                                <ul className="list-disc pl-6 space-y-2.5 text-gray-600">
                                    <li>
                                        <strong className="text-gray-900 font-bold">Right to Access Information (Section 11):</strong> You may request a summary of personal data processed, identities of all third-party Data Fiduciaries/Processors with whom data has been shared, and related processing details.
                                    </li>
                                    <li>
                                        <strong className="text-gray-900 font-bold">Right to Correction & Erasure (Section 12):</strong> You can review, update, or rectify inaccurate or outdated personal credentials directly inside your student dashboard, or request data deletion subject to statutory audit requirements.
                                    </li>
                                    <li>
                                        <strong className="text-gray-900 font-bold">Right to Withdraw Consent (Section 6(4)):</strong> You may withdraw your consent to data processing at any time. The statute mandates that the ease of withdrawal must be comparable to the ease with which consent was granted.
                                    </li>
                                    <li>
                                        <strong className="text-gray-900 font-bold">Right to Nominate (Section 14):</strong> You have the right to nominate an individual who, in the event of death or incapacity, shall exercise your data protection rights.
                                    </li>
                                </ul>

                                <div className="p-5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl mt-4 space-y-3">
                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[#6605c7] text-[18px]">toggle_on</span>
                                        How to Exercise Consent Withdrawal
                                    </h4>
                                    <p className="text-xs text-gray-700 leading-relaxed">
                                        You can initiate consent withdrawal at any time through either of the following routes:
                                    </p>
                                    <ol className="list-decimal pl-5 text-xs text-gray-700 space-y-1.5">
                                        <li>Via your Student Portal: Navigate to <strong>Settings &rarr; Privacy &rarr; Manage Consent Preferences</strong> to toggle processing preferences.</li>
                                        <li>Via Email: Send a formal written notice from your registered email address to <a href="mailto:privacy@vidyaloans.in" className="text-[#6605c7] font-bold underline">privacy@vidyaloans.in</a> with the subject line <em>&ldquo;Consent Withdrawal Request - [Your Name / Application ID]&rdquo;</em>.</li>
                                    </ol>
                                    <p className="text-[11px] text-gray-500 pt-1">
                                        <strong>Consequences of Withdrawal:</strong> Upon receiving your withdrawal request, VidyaLoans will cease processing your personal data within 72 hours, except where retention is strictly required by statutory financial regulations (PMLA/RBI). Please note that withdrawal will terminate ongoing loan application evaluation with partner lenders that depend on such data.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 9. Grievance Redressal & DPO */}
                        <div id="grievance" className="scroll-mt-28">
                            <h2 className="text-2xl font-bold font-display text-gray-900 mb-6 flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                                9. Grievance Redressal & Data Protection Officer
                            </h2>
                            <div className="text-gray-600 text-[13.5px] leading-relaxed space-y-4 font-medium">
                                <p>
                                    Pursuant to Section 8(9) and Section 13 of the DPDP Act 2023, VidyaLoans has established an effective and prompt Grievance Redressal Mechanism headed by a designated officer:
                                </p>

                                <div className="bg-white/80 backdrop-blur-xl border border-purple-100 rounded-2xl p-6 shadow-sm space-y-4">
                                    <div className="border-b border-slate-100 pb-3">
                                        <span className="text-[10px] font-bold text-[#6605c7] uppercase tracking-widest block">Designated Statutory Officer</span>
                                        <h3 className="text-base font-bold text-gray-900 mt-0.5">Abhiram Madasu</h3>
                                        <p className="text-xs text-gray-500 font-medium">Grievance Redressal Officer & Head of Data Protection</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                        <div>
                                            <span className="text-gray-400 block font-semibold mb-0.5">Email Address:</span>
                                            <a href="mailto:grievance@vidyaloans.in" className="text-[#6605c7] font-bold hover:underline">
                                                grievance@vidyaloans.in
                                            </a>
                                            <span className="text-gray-400 block text-[11px] mt-0.5">(Copy: privacy@vidyaloans.in)</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 block font-semibold mb-0.5">Telephone Hotline:</span>
                                            <span className="text-gray-900 font-bold">+91 81437 97779</span>
                                            <span className="text-gray-400 block text-[11px] mt-0.5">(Mon–Fri, 10:00 AM – 6:00 PM IST)</span>
                                        </div>
                                        <div className="md:col-span-2">
                                            <span className="text-gray-400 block font-semibold mb-0.5">Office / Postal Address:</span>
                                            <span className="text-gray-800 font-medium">
                                                VidyaLoans Inc. / Operational Head Office, Jyothi Bose Complex, Bus Stand Road (Opposite to Municipal Office), Nuzvid, Krishna District, Andhra Pradesh 521201, India
                                            </span>
                                        </div>
                                    </div>

                                    <div className="border-t border-slate-100 pt-3 text-xs text-gray-600 space-y-2">
                                        <p>
                                            <strong>Redressal Timelines:</strong> Your grievance will be formally acknowledged within <strong>24 to 48 business hours</strong> with a unique tracking number, and completely investigated and resolved within <strong>30 calendar days</strong>.
                                        </p>
                                        <p className="text-[11.5px] text-gray-500">
                                            <strong>Escalation to Data Protection Board of India (DPBI):</strong> In accordance with Section 13(3) of the DPDP Act 2023, if you are unsatisfied with the resolution provided by our Grievance Redressal Officer, or if no response is received within 30 days, you have the statutory right to escalate your complaint directly to the <strong>Data Protection Board of India</strong> via its designated portal.
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
