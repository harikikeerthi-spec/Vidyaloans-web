"use client";

import { useState } from "react";
import { useSiteSettings } from "@/contexts/SiteSettingsContext";

export default function ContactUsPage() {
    const { settings } = useSiteSettings();
    const siteName = settings?.siteName || "VidyaLoans";
    const supportEmail = settings?.supportEmail || "support@vidyaloans.com";
    const phone = settings?.phone || "+91 8143797779";
    const address = settings?.address || "Nuzvid, Krishna District, Andhra Pradesh";

    const offices = [
        { city: "Headquarters", role: "Headquarters & Counselor Center", address, phone },
    ];
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        subject: "Loan Eligibility",
        message: ""
    });
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const errors = {
        name: formData.name ? (formData.name.trim().length < 3 ? "Name must be at least 3 characters" : "") : "",
        email: formData.email ? (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) ? "" : "Please enter a valid email address") : "",
        phone: formData.phone ? (formData.phone.length === 10 ? "" : "Phone number must be exactly 10 digits") : "",
        message: formData.message ? (formData.message.trim().length >= 20 ? "" : `Message must be at least 20 characters (current: ${formData.message.trim().length}/20)`) : ""
    };

    const isFormValid = 
        formData.name.trim().length >= 3 &&
        !/[0-9]/.test(formData.name) &&
        formData.name.length <= 30 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
        formData.phone.length === 10 &&
        formData.message.trim().length >= 20;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setTouched({
            name: true,
            email: true,
            phone: true,
            message: true
        });

        if (!isFormValid) return;

        setIsSubmitting(true);

        // Simulate high-fidelity backend submit
        setTimeout(() => {
            setIsSubmitting(false);
            setIsSuccess(true);
            setFormData({ name: "", email: "", phone: "", subject: "Loan Eligibility", message: "" });
            setTouched({});
        }, 1800);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        let val = value;

        if (name === "name") {
            val = value.replace(/[0-9]/g, "").slice(0, 30);
        } else if (name === "phone") {
            val = value.replace(/\D/g, "").slice(0, 10);
        }

        setFormData(prev => ({
            ...prev,
            [name]: val
        }));

        setTouched(prev => ({
            ...prev,
            [name]: true
        }));
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name } = e.target;
        setTouched(prev => ({
            ...prev,
            [name]: true
        }));
    };

    const getInputClass = (name: 'name' | 'email' | 'phone' | 'message') => {
        const isMessage = name === 'message';
        const base = `w-full pl-12 pr-4 py-3.5 bg-white/40 hover:bg-white/60 border text-[13.5px] rounded-xl outline-none transition-all placeholder:text-gray-400 text-gray-900 font-medium shadow-sm ${isMessage ? 'resize-none' : ''}`;
        const val = formData[name];
        const hasError = touched[name] && !!errors[name];
        const isValid = touched[name] && val && !errors[name];

        if (hasError) {
            return `${base} border-rose-400 focus:border-rose-500 bg-rose-50/10 focus:bg-white`;
        }
        if (isValid) {
            return `${base} border-emerald-400 focus:border-emerald-500 bg-emerald-50/5 focus:bg-white`;
        }
        return `${base} border-gray-200 focus:border-[#6605c7]/50 focus:bg-white`;
    };

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
            <section className="pt-36 pb-16 px-6 relative z-10 text-center max-w-4xl mx-auto">
                <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#6605c7]/10 border border-[#6605c7]/15 text-[#6605c7] text-[11px] font-bold uppercase tracking-widest mb-6">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#6605c7] animate-pulse"></span>
                    Get In Touch
                </span>
                <h1 className="text-5xl md:text-7xl font-bold font-display mb-6 tracking-tight leading-tight text-[#1a1626]">
                    Contact Our <span className="text-[#6605c7]">Advisors</span>
                </h1>
                <p className="text-[16px] text-gray-500 max-w-2xl mx-auto font-medium leading-relaxed">
                    Have questions about dynamic matching rates, documentation criteria, or co-applicant profiles? Our financial counselors are always ready to assist.
                </p>
            </section>

            {/* Main Interactive Contact Split Layout */}
            <section className="py-12 pb-24 px-6 relative z-10 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">

                    {/* Left Column: Premium Interactive Contact Form */}
                    <div className="lg:col-span-7">
                        <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
                            {/* Glow accent */}
                            <div className="absolute -left-16 -top-16 w-36 h-36 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />

                            {isSuccess ? (
                                <div className="text-center py-16 animate-fade-in-up">
                                    <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-emerald-500/20 transform hover:scale-105 transition-transform">
                                        <span className="material-symbols-outlined text-4xl font-bold">check</span>
                                    </div>
                                    <h3 className="text-2xl font-bold font-display mb-4 text-[#1a1626]">Message Sent Successfully!</h3>
                                    <p className="text-gray-500 text-[13.5px] leading-relaxed max-w-md mx-auto mb-8 font-medium">
                                        Thank you for reaching out. A certified VidyaLoans financial advisor has received your query and will contact you via email or phone within the next 2 to 4 business hours.
                                    </p>
                                    <button
                                        onClick={() => setIsSuccess(false)}
                                        className="px-8 py-3.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-sm"
                                    >
                                        Send Another Message
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Name input */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6605c7]">Full Name</label>
                                                <span className="text-[9.5px] text-gray-400 font-extrabold">{formData.name.length}/30</span>
                                            </div>
                                            <div className="relative">
                                                <span className="material-symbols-outlined text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 text-lg">person</span>
                                                <input
                                                    type="text"
                                                    name="name"
                                                    required
                                                    value={formData.name}
                                                    onChange={handleChange}
                                                    onBlur={handleBlur}
                                                    placeholder="Enter your name"
                                                    className={getInputClass('name')}
                                                />
                                            </div>
                                            {touched.name && errors.name && (
                                                <p className="text-[11px] text-rose-500 font-bold mt-1 flex items-center gap-1 animate-fade-in">
                                                    <span className="material-symbols-outlined text-[13px] font-bold">error</span>
                                                    {errors.name}
                                                </p>
                                            )}
                                        </div>

                                        {/* Email input */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6605c7]">Email Address</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 text-lg">mail</span>
                                                <input
                                                    type="email"
                                                    name="email"
                                                    required
                                                    value={formData.email}
                                                    onChange={handleChange}
                                                    onBlur={handleBlur}
                                                    placeholder="Enter your email"
                                                    className={getInputClass('email')}
                                                />
                                            </div>
                                            {touched.email && errors.email && (
                                                <p className="text-[11px] text-rose-500 font-bold mt-1 flex items-center gap-1 animate-fade-in">
                                                    <span className="material-symbols-outlined text-[13px] font-bold">error</span>
                                                    {errors.email}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Phone input */}
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6605c7]">Phone Number</label>
                                                <span className="text-[9.5px] text-gray-400 font-extrabold">{formData.phone.length}/10</span>
                                            </div>
                                            <div className="relative">
                                                <span className="material-symbols-outlined text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 text-lg">call</span>
                                                <input
                                                    type="tel"
                                                    name="phone"
                                                    required
                                                    value={formData.phone}
                                                    onChange={handleChange}
                                                    onBlur={handleBlur}
                                                    placeholder="Enter 10-digit number"
                                                    className={getInputClass('phone')}
                                                />
                                            </div>
                                            {touched.phone && errors.phone && (
                                                <p className="text-[11px] text-rose-500 font-bold mt-1 flex items-center gap-1 animate-fade-in">
                                                    <span className="material-symbols-outlined text-[13px] font-bold">error</span>
                                                    {errors.phone}
                                                </p>
                                            )}
                                        </div>

                                        {/* Subject selector */}
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6605c7]">Primary Inquiry</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 text-lg">help</span>
                                                <select
                                                    name="subject"
                                                    value={formData.subject}
                                                    onChange={handleChange}
                                                    className="w-full pl-12 pr-8 py-3.5 bg-white/40 hover:bg-white/60 border border-gray-200 focus:border-[#6605c7]/50 focus:bg-white text-[13.5px] rounded-xl outline-none transition-all text-gray-900 font-medium appearance-none cursor-pointer shadow-sm"
                                                >
                                                    <option className="bg-white text-gray-900" value="Loan Eligibility">Loan Eligibility Help</option>
                                                    <option className="bg-white text-gray-900" value="Document Upload">DigiLocker / Document Upload</option>
                                                    <option className="bg-white text-gray-900" value="Bank Verification">Bank Partner Pre-Verification</option>
                                                    <option className="bg-white text-gray-900" value="Partner Integration">Lender Integrations Desk</option>
                                                    <option className="bg-white text-gray-900" value="General Inquiry">Other Questions</option>
                                                </select>
                                                <span className="material-symbols-outlined text-[#6605c7] absolute right-4 top-1/2 -translate-y-1/2 text-lg pointer-events-none">expand_more</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Message textarea */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#6605c7]">Your Message</label>
                                            <span className="text-[9.5px] text-gray-400 font-extrabold">{formData.message.length} chars (min 20)</span>
                                        </div>
                                        <div className="relative">
                                            <span className="material-symbols-outlined text-gray-400 absolute left-4 top-4 text-lg">chat</span>
                                            <textarea
                                                name="message"
                                                required
                                                rows={5}
                                                value={formData.message}
                                                onChange={handleChange}
                                                onBlur={handleBlur}
                                                placeholder="Detail your request, university intended, or application number (minimum 20 characters)..."
                                                className={getInputClass('message')}
                                            />
                                        </div>
                                        {touched.message && errors.message && (
                                            <p className="text-[11px] text-rose-500 font-bold mt-1 flex items-center gap-1 animate-fade-in">
                                                <span className="material-symbols-outlined text-[13px] font-bold">error</span>
                                                {errors.message}
                                            </p>
                                        )}
                                    </div>

                                    {/* Tactile 3D Submit Button */}
                                    <div className="pt-4">
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || !isFormValid}
                                            className="w-full relative group py-4.5 text-white font-extrabold rounded-xl transition-all shadow-[0_12px_36px_rgba(102,5,199,0.25)] active:translate-y-0.5 active:shadow-inner text-xs uppercase tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                            style={{ background: 'linear-gradient(135deg, #6605c7, #8b24e5)' }}
                                        >
                                            {isSubmitting ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                    </svg>
                                                    Processing...
                                                </div>
                                            ) : (
                                                <span className="flex items-center justify-center gap-1.5">
                                                    Send Message
                                                    <span className="material-symbols-outlined text-sm font-extrabold">send</span>
                                                </span>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Office Address Directories */}
                    <div className="lg:col-span-5 space-y-8">
                        {/* Direct Contacts Info Card */}
                        <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl p-8 space-y-6 shadow-xl">
                            <h3 className="text-lg font-bold font-display text-gray-900">Direct Contacts</h3>

                            <div className="space-y-4">
                                <a href={`mailto:${supportEmail}`} className="flex items-center gap-4 group p-3 bg-white/20 hover:bg-white/60 border border-gray-100 hover:border-purple-500/20 rounded-2xl transition-all shadow-sm">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-lg">mail</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block mb-0.5">Email Support</span>
                                        <span className="text-[13px] font-bold text-gray-900 group-hover:text-[#6605c7] transition-colors font-mono">{supportEmail}</span>
                                    </div>
                                </a>

                                <a href={`tel:${phone.replace(/\s+/g, '')}`} className="flex items-center gap-4 group p-3 bg-white/20 hover:bg-white/60 border border-gray-100 hover:border-purple-500/20 rounded-2xl transition-all shadow-sm">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-lg">call</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-widest block mb-0.5">Call Helpline</span>
                                        <span className="text-[13px] font-bold text-gray-900 group-hover:text-indigo-600 transition-colors font-mono">{phone}</span>
                                    </div>
                                </a>
                            </div>
                        </div>

                        {/* Physical Offices Card */}
                        <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl p-8 shadow-xl">
                            <h3 className="text-lg font-bold font-display text-gray-900 mb-6">Our Offices</h3>

                            <div className="space-y-6 max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                                {offices.map((office) => (
                                    <div
                                        key={office.city}
                                        className="relative group p-4 border border-gray-100 rounded-2xl bg-white/20 hover:bg-white hover:border-[#6605c7]/20 transition-all duration-300 shadow-sm"
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="material-symbols-outlined text-[#6605c7] text-xl mt-0.5">location_on</span>
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[14px] font-bold text-gray-900">{office.city}</span>
                                                    {office.city === "Nuzvid" && (
                                                        <span className="text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                                                            HQ
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-gray-400 font-bold block uppercase tracking-wider">{office.role}</span>
                                                <p className="text-[12px] text-gray-500 leading-relaxed font-medium pt-1">{office.address}</p>
                                                <a href={`tel:${office.phone.replace(/\s+/g, '')}`} className="text-[11px] font-bold text-[#6605c7] hover:text-[#8b24e5] inline-block pt-1 font-mono">
                                                    {office.phone}
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </section>
        </div>
    );
}
