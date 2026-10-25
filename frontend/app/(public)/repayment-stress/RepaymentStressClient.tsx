"use client";

import { useState } from "react";

export default function RepaymentStressPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [formData, setFormData] = useState({
        salary: "",
        emi: "",
        living: "",
        country: ""
    });

    const handleRunTest = (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Simulation logic
        setTimeout(() => {
            const salary = Number(formData.salary);
            const emi = Number(formData.emi);
            const living = Number(formData.living);

            const totalOutgo = emi + living;
            const ratio = (totalOutgo / salary) * 100;
            const stressScore = Math.min(100, Math.floor(ratio));

            let status = "Healthy";
            let color = "bg-green-500";
            if (stressScore > 85) {
                status = "Critical";
                color = "bg-red-500";
            } else if (stressScore > 65) {
                status = "High Stress";
                color = "bg-orange-500";
            } else if (stressScore > 40) {
                status = "Moderate";
                color = "bg-yellow-500";
            }

            setResult({
                score: stressScore,
                status,
                color,
                ratio: stressScore.toFixed(0) + "%",
                summary: ratio > 100
                    ? "Insolvent: Your expenses exceed your income."
                    : ratio > 80
                        ? "High Risk: Almost no savings margin."
                        : "Survivable: You have a decent safety net.",
                drop: (salary * 0.8 - emi - living).toFixed(0),
                delay: (emi * 3).toFixed(0),
                recommendations: [
                    ratio > 70 ? "Increase loan tenure to reduce EMI" : "Consider a cheaper city/country",
                    "Build a 6-month buffer before starting repayment",
                    "Keep a credit card for extreme emergencies only"
                ]
            });
            setLoading(false);
        }, 1000);
    };

    return (
        <main className="relative z-10 pt-32 pb-24">
            <section className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
                    <div>
                        <span className="text-[#6605c7] font-bold text-[11px] tracking-[0.2em] uppercase mb-4 block">Survival Guide</span>
                        <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900 mb-8 leading-tight">
                            Repayment <span className="italic text-[#6605c7]">Stress Simulator</span>
                        </h1>
                        <p className="text-gray-500 text-[13px] leading-relaxed mb-10 max-w-xl">
                            Will you realistically survive the EMI if life goes wrong? Our simulator tests worst-case scenarios, not best-case dreams.
                        </p>

                        <form onSubmit={handleRunTest} className="bg-white p-8 border border-gray-100 rounded-xl shadow-xl space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Monthly Take-Home (₹)</label>
                                    <input type="number" required value={formData.salary} onChange={e => setFormData({ ...formData, salary: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/30 focus:border-[#6605c7] focus:ring-1 focus:ring-[#6605c7]/5 outline-none transition-all font-bold text-gray-900 text-[13px]" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Monthly EMI (₹)</label>
                                    <input type="number" required value={formData.emi} onChange={e => setFormData({ ...formData, emi: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/30 focus:border-[#6605c7] focus:ring-1 focus:ring-[#6605c7]/5 outline-none transition-all font-bold text-gray-900 text-[13px]" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Living Expenses (₹)</label>
                                    <input type="number" required value={formData.living} onChange={e => setFormData({ ...formData, living: e.target.value })} className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/30 focus:border-[#6605c7] focus:ring-1 focus:ring-[#6605c7]/5 outline-none transition-all font-bold text-gray-900 text-[13px]" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Country/City</label>
                                    <input type="text" value={formData.country} onChange={e => setFormData({ ...formData, country: e.target.value })} placeholder="Optional" className="w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/30 focus:border-[#6605c7] focus:ring-1 focus:ring-[#6605c7]/5 outline-none transition-all font-bold text-gray-900 text-[13px]" />
                                </div>
                            </div>
                            <button type="submit" disabled={loading} className="w-full py-4 bg-[#6605c7] text-white rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-[#5504a6] shadow-lg shadow-purple-500/10 transition-all disabled:opacity-50">
                                {loading ? "Running Stress Test..." : "Start Simulation"}
                            </button>
                        </form>
                    </div>

                    <div className="sticky top-32">
                        {!result ? (
                            <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-xl p-16 text-center shadow-xl">
                                <div className="w-24 h-24 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-8 border border-gray-100">
                                    <span className="material-symbols-outlined text-4xl text-gray-200">monitoring</span>
                                </div>
                                <h3 className="text-2xl font-display font-bold text-gray-900 mb-4">Outcome Awaited</h3>
                                <p className="text-gray-400 text-[13px] leading-relaxed max-w-xs mx-auto">Fill the details to see if your financial plan holds up against unexpected hits.</p>
                            </div>
                        ) : (
                            <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-xl p-10 shadow-2xl animate-fade-in-up space-y-10">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="text-3xl font-display font-bold text-gray-900 mb-1">Stress Level</h3>
                                        <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest">{result.status}</p>
                                    </div>
                                    <div className={`px-5 py-2 rounded-full text-white font-bold text-[11px] uppercase tracking-widest ${result.color}`}>
                                        {result.ratio}
                                    </div>
                                </div>

                                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-1000 ${result.color}`} style={{ width: result.ratio }} />
                                </div>

                                <div className="bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                                    <p className="text-gray-600 text-[13px] leading-relaxed"><strong className="text-gray-900">Summary:</strong> {result.summary}</p>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="p-6 bg-white border border-gray-100 rounded-xl shadow-sm">
                                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">Salary Hit (-20%)</h4>
                                        <p className="text-xl font-bold text-gray-900">₹{result.drop}/mo</p>
                                        <span className="text-[11px] text-gray-400">Remaining Balance</span>
                                    </div>
                                    <div className="p-6 bg-white border border-gray-100 rounded-xl shadow-sm">
                                        <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2">3mo Job Delay</h4>
                                        <p className="text-xl font-bold text-red-500">₹{result.delay}</p>
                                        <span className="text-[11px] text-gray-400">Buffer Needed</span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">AI Recommendations</h4>
                                    <ul className="space-y-3">
                                        {result.recommendations.map((rec: string, i: number) => (
                                            <li key={i} className="flex gap-3 text-[13px] text-gray-600 items-start">
                                                <span className="text-[#6605c7] mt-1">•</span>
                                                {rec}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}
