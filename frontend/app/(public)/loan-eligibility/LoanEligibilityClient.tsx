"use client";

import { useState, useEffect } from "react";
import { aiApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";

export default function LoanEligibilityPage() {
    const { isAuthenticated } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            setUserId(localStorage.getItem("userId"));
        }
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("pending_loan_eligibility_data");
            if (saved) {
                try {
                    setFormData(JSON.parse(saved));
                } catch (e) {
                    console.error("Failed to restore saved loan eligibility data", e);
                }
                localStorage.removeItem("pending_loan_eligibility_data");
            }
        }
    }, []);

    const [formData, setFormData] = useState({
        age: 22,
        credit: 750,
        income: 600000,
        loan: 2000000,
        employment: "student",
        study: "masters",
        coApplicant: "yes",
        collateral: "no"
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.age < 18 || formData.age > 40) {
            alert("Age must be between 18 and 40 years for loan eligibility.");
            return;
        }

        if (formData.credit < 300 || formData.credit > 900) {
            alert("CIBIL score must be between 300 and 900.");
            return;
        }

        if (!isAuthenticated) {
            localStorage.setItem("pending_loan_eligibility_data", JSON.stringify(formData));
            alert("To view your eligibility score, rate estimates, and pre-approved offers, please login. You will be redirected to the login page.");
            router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
            return;
        }

        setLoading(true);
        try {
            const data = await aiApi.loanEligibility({ ...formData, userId });
            setResult(data);
        } catch (err) {
            console.error(err);
            alert("Failed to check eligibility");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === "number" ? Number(value) : value
        }));
    };

    return (
        <main className="relative z-10 pt-28 pb-20 bg-transparent">
            <section className="max-w-6xl mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 items-start">
                    <div>
                        <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#6605c7]/[0.05] rounded-xl text-[10px] font-bold uppercase tracking-widest mb-6 text-[#6605c7] border border-[#6605c7]/[0.1]">
                            <span className="material-symbols-outlined text-[14px]">psychology</span>
                            AI Powered Analysis
                        </span>
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                            Instant Education Loan <br />
                            <span className="text-gray-400">Eligibility Pre-Check</span>
                        </h1>
                        <p className="text-gray-500 text-[13px] leading-relaxed mb-8 max-w-xl">
                            Our AI analyzes your profile against hundreds of lending criteria to provide an instant eligibility estimate, expected interest rates, and customized recommendations.
                        </p>

                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-white border border-gray-100 rounded-xl p-8 shadow-sm">
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Age</label>
                                <input
                                    name="age"
                                    type="number"
                                    min={18}
                                    max={40}
                                    value={formData.age}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 rounded-xl border-gray-100 focus:border-[#6605c7] focus:ring-0 transition-all font-medium text-gray-900 bg-gray-50/50 text-[13px]"
                                />
                                {(formData.age < 18 || formData.age > 40) && (
                                    <p className="text-[10px] font-bold text-rose-500 flex items-center gap-1 mt-1">
                                        <span className="material-symbols-outlined text-[13px]">warning</span>
                                        Age must be between 18 and 40 years for loan eligibility
                                    </p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">CIBIL Score</label>
                                <input
                                    name="credit"
                                    type="number"
                                    min={300}
                                    max={900}
                                    value={formData.credit}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 rounded-xl border-gray-100 focus:border-[#6605c7] focus:ring-0 transition-all font-medium text-gray-900 bg-gray-50/50 text-[13px]"
                                />
                                {formData.credit < 300 || formData.credit > 900 ? (
                                    <p className="text-[10px] font-bold text-rose-500 flex items-center gap-1 mt-1">
                                        <span className="material-symbols-outlined text-[13px]">warning</span>
                                        CIBIL score must be between 300 and 900
                                    </p>
                                ) : formData.credit <= 700 ? (
                                    <p className="text-[10px] font-bold text-rose-500 flex items-center gap-1 mt-1">
                                        <span className="material-symbols-outlined text-[13px]">warning</span>
                                        CIBIL score must be &gt; 700 for loan eligibility
                                    </p>
                                ) : null}
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Annual Income (₹)</label>
                                <input name="income" type="number" value={formData.income} onChange={handleChange} required className="w-full px-4 py-3 rounded-xl border-gray-100 focus:border-[#6605c7] focus:ring-0 transition-all font-medium text-gray-900 bg-gray-50/50 text-[13px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Loan Amount (₹)</label>
                                <input name="loan" type="number" value={formData.loan} onChange={handleChange} required className="w-full px-4 py-3 rounded-xl border-gray-100 focus:border-[#6605c7] focus:ring-0 transition-all font-medium text-gray-900 bg-gray-50/50 text-[13px]" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Employment</label>
                                <select name="employment" value={formData.employment} onChange={handleChange} required className="w-full px-4 py-3 rounded-xl border-gray-100 focus:border-[#6605c7] focus:ring-0 transition-all font-medium text-gray-900 bg-gray-50/50 text-[13px]">
                                    <option value="employed">Employed</option>
                                    <option value="self">Self-employed</option>
                                    <option value="student">Student</option>
                                    <option value="unemployed">Unemployed</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Study Level</label>
                                <select name="study" value={formData.study} onChange={handleChange} required className="w-full px-4 py-3 rounded-xl border-gray-100 focus:border-[#6605c7] focus:ring-0 transition-all font-medium text-gray-900 bg-gray-50/50 text-[13px]">
                                    <option value="undergrad">Undergraduate</option>
                                    <option value="masters">Masters</option>
                                    <option value="doctoral">Doctoral</option>
                                    <option value="diploma">Diploma</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Co-applicant</label>
                                <select name="coApplicant" value={formData.coApplicant} onChange={handleChange} required className="w-full px-4 py-3 rounded-xl border-gray-100 focus:border-[#6605c7] focus:ring-0 transition-all font-medium text-gray-900 bg-gray-50/50 text-[13px]">
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Collateral</label>
                                <select name="collateral" value={formData.collateral} onChange={handleChange} required className="w-full px-4 py-3 rounded-xl border-gray-100 focus:border-[#6605c7] focus:ring-0 transition-all font-medium text-gray-900 bg-gray-50/50 text-[13px]">
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                </select>
                            </div>
                            <div className="md:col-span-2 mt-4">
                                <button type="submit" disabled={loading} className="w-full py-4 bg-[#6605c7] text-white rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-[#5504a6] shadow-lg shadow-purple-500/10 transition-all disabled:opacity-50">
                                    {loading ? "Analyzing Profile..." : "Calculate Eligibility"}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="sticky top-38 bg-gray-50/50 border border-gray-100 rounded-xl p-8">
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-lg font-bold text-gray-900">Eligibility Report</h3>
                            <span className={`text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-md border ${!result ? "bg-white text-gray-400 border-gray-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"}`}>
                                {!result ? "Pending Input" : result.eligibility?.status}
                            </span>
                        </div>

                        {!result ? (
                            <div className="text-center py-12">
                                <div className="w-16 h-16 bg-white rounded-xl border border-gray-100 flex items-center justify-center mx-auto mb-6 text-gray-300 shadow-sm">
                                    <span className="material-symbols-outlined text-3xl">query_stats</span>
                                </div>
                                <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Complete the form to see your<br />personalized eligibility score</p>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-fade-in-up">
                                <div>
                                    <div className="flex items-center justify-between text-[11px] mb-3">
                                        <span className="font-bold text-gray-400 uppercase tracking-widest">Eligibility Score</span>
                                        <span className="font-bold text-[#6605c7]">{result.eligibility?.score} / 100</span>
                                    </div>
                                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#6605c7] transition-all duration-1000" style={{ width: `${result.eligibility?.score}%` }}></div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-gray-900 font-bold text-[13px] leading-snug">{result.eligibility?.summary}</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1 tracking-widest">Interest Range</span>
                                            <span className="font-bold text-[#6605c7] text-[13px]">{result.eligibility?.rateRange}</span>
                                        </div>
                                        <div className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1 tracking-widest">Loan Coverage</span>
                                            <span className="font-bold text-[#6605c7] text-[13px]">{result.eligibility?.coverage}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Actionable Insights</h4>
                                    <ul className="space-y-3">
                                        {result.eligibility?.recommendations?.map((rec: string, i: number) => (
                                            <li key={i} className="flex items-start gap-3 text-[13px] text-gray-600">
                                                <span className="material-symbols-outlined text-emerald-500 text-[18px]">check_circle</span>
                                                {rec}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {/* <div className="p-6 bg-[#6605c7]/[0.02] rounded-xl border border-[#6605c7]/[0.05]">
                                    <h4 className="text-[10px] font-bold text-[#6605c7] uppercase tracking-widest mb-4">Best Financial Match</h4>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="font-bold text-gray-900 text-[13px]">{result.recommendations?.primary?.offer?.bank}</div>
                                        <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">{result.recommendations?.primary?.fit}% Match</div>
                                    </div>
                                    <div className="text-[11px] text-gray-500 mb-5">{result.recommendations?.primary?.offer?.name}</div>
                                    <a href="/apply-loan" className="block w-full py-3 bg-[#6605c7] text-white text-center rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-[#5504a6] transition-all shadow-lg shadow-purple-500/10">Start Application</a>
                                </div> */}
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}
