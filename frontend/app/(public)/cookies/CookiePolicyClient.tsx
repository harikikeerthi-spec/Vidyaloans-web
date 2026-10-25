"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const cookieData = [
    { name: "session_token", type: "Essential", purpose: "Maintains active student session authentication states.", duration: "Session" },
    { name: "matched_lender_id", type: "Essential", purpose: "Saves pre-selected matching results during the session flow.", duration: "24 Hours" },
    { name: "visitor_analytics_id", type: "Analytical", purpose: "Tracks user browsing actions and features engagement rates to optimize user experiences.", duration: "2 Years" },
    { name: "marketing_funnel_state", type: "Marketing", purpose: "Enables customized retargeting efforts on external social networks.", duration: "1 Year" }
];

export default function CookiePolicyPage() {
    const [preferences, setPreferences] = useState({
        essential: true,
        analytical: true,
        marketing: false
    });
    const [isSaved, setIsSaved] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('cookie-preferences');
        if (saved) {
            try {
                setPreferences(JSON.parse(saved));
            } catch (e) {
                // Ignore parse error
            }
        }
    }, []);

    const togglePreference = (key: 'analytical' | 'marketing') => {
        setPreferences(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
        setIsSaved(false);
    };

    const handleSave = () => {
        localStorage.setItem('cookie-preferences', JSON.stringify(preferences));
        
        // Set actual cookies based on preferences
        document.cookie = "cookie_consent_answered=true; max-age=31536000; path=/";
        
        if (preferences.analytical) {
            document.cookie = "visitor_analytics_id=active; max-age=63072000; path=/";
        } else {
            document.cookie = "visitor_analytics_id=; max-age=0; path=/";
        }
        
        if (preferences.marketing) {
            document.cookie = "marketing_funnel_state=active; max-age=31536000; path=/";
        } else {
            document.cookie = "marketing_funnel_state=; max-age=0; path=/";
        }

        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 3000);
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
            <section className="pt-32 pb-16 px-6 relative z-10 text-center border-b border-black/5">
                <div className="max-w-4xl mx-auto">
                    <span className="inline-block px-4 py-1.5 rounded-xl bg-[#6605c7]/10 border border-[#6605c7]/15 text-[#6605c7] text-[11px] font-bold uppercase tracking-widest mb-4">
                        Cookies & Consent
                    </span>
                    <h1 className="text-4xl md:text-6xl font-bold font-display tracking-tight mb-4 text-[#1a1626]">
                        Cookie Policy
                    </h1>
                    <p className="text-gray-500 text-xs md:text-sm font-bold uppercase tracking-wider">
                        Last Updated: May 26, 2026 • Version 1.4
                    </p>
                </div>
            </section>

            {/* Content Layout */}
            <section className="py-20 px-6 relative z-10 max-w-5xl mx-auto space-y-16">
                
                {/* 1. What are cookies */}
                <div className="space-y-4">
                    <h2 className="text-2xl font-bold font-display flex items-center gap-3 text-gray-900">
                        <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                        What Are Cookies?
                    </h2>
                    <p className="text-gray-600 text-[13.5px] leading-relaxed font-medium">
                        Cookies are compact text parameters downloaded to your device whenever you browse web portals. They are highly instrumental in remembering authentication states, customizing matching search layouts, tracking operational speeds, and optimizing site experience features.
                    </p>
                    <p className="text-gray-600 text-[13.5px] leading-relaxed font-medium">
                        We leverage both transient session cookies (which expire the moment you close the browser window) and persistent cookies (which remain on the device until self-cleared or deleted).
                    </p>
                </div>

                {/* 2. Interactive Preferences Panel */}
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold font-display flex items-center gap-3 text-gray-900">
                        <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                        Manage Cookie Preferences
                    </h2>
                    <p className="text-gray-600 text-[13.5px] leading-relaxed font-medium mb-8">
                        Optimize your matched student loan journey by adjusting preferred tracking categories below:
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        
                        {/* Essential Toggle Card */}
                        <div className="relative bg-white/60 backdrop-blur-xl border border-purple-500/20 rounded-3xl p-6 flex flex-col justify-between shadow-lg shadow-purple-500/5">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="material-symbols-outlined text-[#6605c7] text-3xl font-bold">lock</span>
                                    <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                                        Required
                                    </span>
                                </div>
                                <h3 className="font-bold text-[15px] mb-2 text-gray-900">Essential Cookies</h3>
                                <p className="text-gray-500 text-[12px] leading-relaxed font-medium">
                                    Strictly necessary to enable student registration, login walls, and pre-selection logic.
                                </p>
                            </div>
                            <div className="mt-6 flex items-center justify-between">
                                <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Always Enabled</span>
                                <div className="w-12 h-6.5 bg-[#6605c7] rounded-full p-1 cursor-not-allowed flex items-center justify-end shadow-inner">
                                    <div className="w-4.5 h-4.5 bg-white rounded-full shadow-md" />
                                </div>
                            </div>
                        </div>

                        {/* Analytical Toggle Card */}
                        <div 
                            className={`relative bg-white/60 backdrop-blur-xl border rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 shadow-md ${
                                preferences.analytical ? 'border-indigo-500/30' : 'border-white/80'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className={`material-symbols-outlined text-3xl font-bold ${preferences.analytical ? 'text-indigo-600' : 'text-gray-400'}`}>
                                        bar_chart
                                    </span>
                                    <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                                        preferences.analytical ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {preferences.analytical ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <h3 className="font-bold text-[15px] mb-2 text-gray-900">Analytical Cookies</h3>
                                <p className="text-gray-500 text-[12px] leading-relaxed font-medium">
                                    Helps our engineers assess operational speeds, feature usages, and load parameters to refine counseling workflows.
                                </p>
                            </div>
                            <div className="mt-6 flex items-center justify-between">
                                <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">User Consent</span>
                                <button 
                                    onClick={() => togglePreference('analytical')}
                                    className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-300 flex items-center shadow-inner ${
                                        preferences.analytical ? 'bg-indigo-600 justify-end' : 'bg-gray-300 justify-start'
                                    }`}
                                >
                                    <div className="w-4.5 h-4.5 bg-white rounded-full shadow-md transition-transform duration-300" />
                                </button>
                            </div>
                        </div>

                        {/* Marketing Toggle Card */}
                        <div 
                            className={`relative bg-white/60 backdrop-blur-xl border rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 shadow-md ${
                                preferences.marketing ? 'border-emerald-500/30' : 'border-white/80'
                            }`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className={`material-symbols-outlined text-3xl font-bold ${preferences.marketing ? 'text-emerald-600' : 'text-gray-400'}`}>
                                        campaign
                                    </span>
                                    <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                                        preferences.marketing ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {preferences.marketing ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <h3 className="font-bold text-[15px] mb-2 text-gray-900">Marketing Cookies</h3>
                                <p className="text-gray-500 text-[12px] leading-relaxed font-medium">
                                    Used to match search preferences and deliver personalized banners on external study abroad forums.
                                </p>
                            </div>
                            <div className="mt-6 flex items-center justify-between">
                                <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">User Consent</span>
                                <button 
                                    onClick={() => togglePreference('marketing')}
                                    className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-300 flex items-center shadow-inner ${
                                        preferences.marketing ? 'bg-emerald-600 justify-end' : 'bg-gray-300 justify-start'
                                    }`}
                                >
                                    <div className="w-4.5 h-4.5 bg-white rounded-full shadow-md transition-transform duration-300" />
                                </button>
                            </div>
                        </div>

                    </div>

                    <div className="mt-6 flex flex-col sm:flex-row items-center gap-4 justify-between bg-white/60 backdrop-blur-xl border border-white/80 p-5 rounded-2xl shadow-sm">
                        <p className="text-[12px] text-gray-500 font-medium leading-relaxed text-center sm:text-left">
                            Your tracking settings are cached within the browser. Changing toggles takes effect immediately.
                        </p>
                        <button
                            onClick={handleSave}
                            className={`px-6 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs transition-all ${
                                isSaved 
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                    : 'bg-[#6605c7] hover:bg-[#8b24e5] text-white shadow-lg shadow-purple-500/20'
                            }`}
                        >
                            {isSaved ? 'Preferences Saved ✓' : 'Save Preferences'}
                        </button>
                    </div>
                </div>

                {/* 3. Cookie Table */}
                <div className="space-y-6">
                    <h2 className="text-2xl font-bold font-display flex items-center gap-3 text-gray-900">
                        <span className="w-1.5 h-6 bg-[#6605c7] rounded-full"></span>
                        Details of Stored Cookies
                    </h2>
                    <p className="text-gray-600 text-[13.5px] leading-relaxed font-medium">
                        Below is a list of first-party cookies utilized to process matched results and maintain platform health:
                    </p>

                    <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm bg-white/50 backdrop-blur-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th className="px-6 py-4.5 text-[11px] font-bold uppercase tracking-widest text-[#6605c7]">Cookie Name</th>
                                    <th className="px-6 py-4.5 text-[11px] font-bold uppercase tracking-widest text-[#6605c7]">Category</th>
                                    <th className="px-6 py-4.5 text-[11px] font-bold uppercase tracking-widest text-[#6605c7]">Core Purpose</th>
                                    <th className="px-6 py-4.5 text-[11px] font-bold uppercase tracking-widest text-[#6605c7]">Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-gray-600">
                                {cookieData.map((cookie, idx) => (
                                    <tr key={idx} className="hover:bg-white/40 transition-colors">
                                        <td className="px-6 py-4 font-bold text-[13px] text-gray-900 font-mono">{cookie.name}</td>
                                        <td className="px-6 py-4 text-[12px]">
                                            <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                cookie.type === 'Essential' 
                                                    ? 'bg-purple-100 text-purple-700' 
                                                    : cookie.type === 'Analytical' 
                                                        ? 'bg-indigo-100 text-indigo-700' 
                                                        : 'bg-emerald-100 text-emerald-700'
                                            }`}>
                                                {cookie.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-[12.5px] font-medium leading-relaxed">{cookie.purpose}</td>
                                        <td className="px-6 py-4 text-[12px] font-bold text-gray-400">{cookie.duration}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </section>

            {/* CTA section */}
            <section className="py-20 px-6 relative z-10 text-center max-w-4xl mx-auto border-t border-black/5">
                <h3 className="text-xl font-bold font-display mb-4 text-gray-900">Questions about cookie tracking?</h3>
                <p className="text-gray-500 text-[13px] max-w-xl mx-auto mb-8 font-medium leading-relaxed">
                    Our data protection counselors are always available. Get in touch with our help desk.
                </p>
                <Link
                    href="/contact"
                    className="inline-block px-8 py-3.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:-translate-y-0.5 transition-all text-xs uppercase tracking-wider shadow-sm"
                >
                    Contact Support
                </Link>
            </section>
        </div>
    );
}
