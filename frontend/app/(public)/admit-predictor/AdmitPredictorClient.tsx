"use client";

import { useState, useEffect } from "react";
import { aiApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";

export default function AdmitPredictorPage() {
    const { isAuthenticated } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        targetUniversity: "",
        programLevel: "Masters",
        gpa: "",
        gpaScale: "4",
        testScoreType: "GRE",
        testScore: "",
        englishTestType: "IELTS",
        englishTestScore: "",
        experienceYears: "0",
        researchPapers: "0"
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("pending_admit_predictor_data");
            if (saved) {
                try {
                    setFormData(JSON.parse(saved));
                } catch (e) {
                    console.error("Failed to restore saved admit predictor data", e);
                }
                localStorage.removeItem("pending_admit_predictor_data");
            }
        }
    }, []);

    // Get score limits for Standardized Test
    const getTestScoreLimits = (type: string) => {
        switch (type) {
            case "GRE": return { min: 260, max: 340, step: 1, placeholder: "e.g. 320 (260-340)" };
            case "GMAT": return { min: 200, max: 800, step: 10, placeholder: "e.g. 710 (200-800)" };
            case "SAT": return { min: 400, max: 1600, step: 10, placeholder: "e.g. 1450 (400-1600)" };
            default: return { min: 0, max: 0, step: 1, placeholder: "N/A" };
        }
    };

    // Get score limits for English Test
    const getEnglishScoreLimits = (type: string) => {
        switch (type) {
            case "IELTS": return { min: 0, max: 9.0, step: 0.5, placeholder: "e.g. 7.5 (0-9)" };
            case "TOEFL": return { min: 0, max: 120, step: 1, placeholder: "e.g. 100 (0-120)" };
            case "PTE": return { min: 10, max: 90, step: 1, placeholder: "e.g. 75 (10-90)" };
            case "Duolingo": return { min: 10, max: 160, step: 5, placeholder: "e.g. 125 (10-160)" };
            default: return { min: 0, max: 0, step: 1, placeholder: "N/A" };
        }
    };

    const validateForm = () => {
        // Target University
        if (!formData.targetUniversity.trim()) {
            return "Please enter a Target University.";
        }
        if (formData.targetUniversity.trim().length > 100) {
            return "Target University name cannot exceed 100 characters.";
        }

        // GPA
        const gpaVal = parseFloat(formData.gpa);
        const maxGpa = formData.gpaScale === "10" ? 10.0 : 4.0;
        if (isNaN(gpaVal) || gpaVal < 0 || gpaVal > maxGpa) {
            return `GPA must be between 0 and ${maxGpa.toFixed(1)} on a ${formData.gpaScale}.0 scale.`;
        }

        // Standardized Test Score
        if (formData.testScoreType !== "None" && formData.testScore !== "") {
            const score = parseFloat(formData.testScore);
            const limits = getTestScoreLimits(formData.testScoreType);
            if (isNaN(score) || score < limits.min || score > limits.max) {
                return `${formData.testScoreType} score must be between ${limits.min} and ${limits.max}.`;
            }
        }

        // English Test Score
        if (formData.englishTestType !== "None" && formData.englishTestScore !== "") {
            const score = parseFloat(formData.englishTestScore);
            const limits = getEnglishScoreLimits(formData.englishTestType);
            if (isNaN(score) || score < limits.min || score > limits.max) {
                return `${formData.englishTestType} score must be between ${limits.min} and ${limits.max}.`;
            }
        }

        // Work Exp
        const exp = parseFloat(formData.experienceYears);
        if (isNaN(exp) || exp < 0 || exp > 50) {
            return "Work experience must be between 0 and 50 years.";
        }

        // Research Papers
        const papers = parseInt(formData.researchPapers, 10);
        if (isNaN(papers) || papers < 0 || papers > 50) {
            return "Research papers count must be between 0 and 50.";
        }

        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);

        const errMessage = validateForm();
        if (errMessage) {
            setValidationError(errMessage);
            return;
        }

        if (!isAuthenticated) {
            localStorage.setItem("pending_admit_predictor_data", JSON.stringify(formData));
            alert("To view your admission probability and detailed AI feedback, please login. You will be redirected to the login page.");
            router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
            return;
        }

        setLoading(true);
        try {
            const res = await aiApi.admitPredictor(formData) as any;
            setResult(res.prediction);
        } catch (err) {
            console.error(err);
            alert("Failed to predict admission chances");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setValidationError(null);

        if (name === "targetUniversity" && value.length > 100) return;

        if (name === "gpaScale") {
            const maxGpa = value === "10" ? 10.0 : 4.0;
            setFormData(prev => {
                const currentGpa = parseFloat(prev.gpa);
                return {
                    ...prev,
                    gpaScale: value,
                    gpa: !isNaN(currentGpa) && currentGpa > maxGpa ? maxGpa.toString() : prev.gpa
                };
            });
            return;
        }

        if (name === "experienceYears" || name === "researchPapers") {
            const num = parseFloat(value);
            if (!isNaN(num) && num > 50) return;
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const testLimits = getTestScoreLimits(formData.testScoreType);
    const englishLimits = getEnglishScoreLimits(formData.englishTestType);
    const maxGpaValue = formData.gpaScale === "10" ? 10.0 : 4.0;

    return (
        <main className="relative z-10 pt-32 pb-24">
            <section className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16">
                    <span className="text-[#6605c7] font-bold text-[11px] tracking-[0.2em] uppercase mb-3 block">AI-Powered Insights</span>
                    <h1 className="text-3xl md:text-5xl font-display font-black text-gray-900 mb-6">
                        Admission <span className="italic text-[#6605c7]">Predictor</span>
                    </h1>
                    <p className="text-gray-500 text-[13px] max-w-2xl mx-auto leading-relaxed">
                        Estimate your chances of getting into your dream university. Our AI analyzes your profile against
                        historical data to provide a detailed probability score.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-10 items-start">
                    <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-xl p-10 shadow-xl">
                        <form onSubmit={handleSubmit} className="space-y-8">
                            {validationError && (
                                <div className="p-4 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-700 text-[13px] font-medium animate-shake">
                                    <span className="material-symbols-outlined text-lg shrink-0">error</span>
                                    <span>{validationError}</span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Target University */}
                                <div className="col-span-full space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Target University</label>
                                        <span className="text-[10px] text-gray-400 font-medium">{formData.targetUniversity.length}/100 chars</span>
                                    </div>
                                    <input
                                        name="targetUniversity"
                                        type="text"
                                        maxLength={100}
                                        placeholder="e.g. Stanford University"
                                        required
                                        value={formData.targetUniversity}
                                        onChange={handleChange}
                                        className="w-full px-4 py-4 rounded-xl border-gray-100 bg-gray-50/50 focus:border-[#6605c7] focus:ring-0 transition-all font-bold text-gray-900 placeholder:text-gray-300 text-[13px]"
                                    />
                                </div>

                                {/* Program Level */}
                                <div className="space-y-2">
                                    <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Program Level</label>
                                    <select
                                        name="programLevel"
                                        value={formData.programLevel}
                                        onChange={handleChange}
                                        className="w-full px-4 py-4 rounded-xl border-gray-100 bg-gray-50/50 focus:border-[#6605c7] focus:ring-0 transition-all font-bold text-gray-900 text-[13px]"
                                    >
                                        <option value="Undergraduate">Undergraduate</option>
                                        <option value="Masters">Masters (MS/MA)</option>
                                        <option value="MBA">MBA</option>
                                        <option value="PhD">PhD</option>
                                    </select>
                                </div>

                                {/* GPA */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">GPA ({formData.gpaScale}.0 Scale)</label>
                                        <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">Max: {maxGpaValue.toFixed(1)}</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <input
                                            name="gpa"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            max={maxGpaValue}
                                            placeholder={`0.0 - ${maxGpaValue.toFixed(1)}`}
                                            required
                                            value={formData.gpa}
                                            onChange={handleChange}
                                            className="flex-1 px-4 py-4 rounded-xl border-gray-100 bg-gray-50/50 focus:border-[#6605c7] focus:ring-0 transition-all font-bold text-gray-900 text-[13px]"
                                        />
                                        <select
                                            name="gpaScale"
                                            value={formData.gpaScale}
                                            onChange={handleChange}
                                            className="w-24 px-4 py-4 rounded-xl border-gray-100 bg-gray-50/50 focus:border-[#6605c7] focus:ring-0 transition-all font-bold text-gray-900 text-[13px]"
                                        >
                                            <option value="4">4.0</option>
                                            <option value="10">10.0</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Standardized Test */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Standardized Test</label>
                                        {formData.testScoreType !== "None" && (
                                            <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                                Range: {testLimits.min} - {testLimits.max}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-4">
                                        <select
                                            name="testScoreType"
                                            value={formData.testScoreType}
                                            onChange={handleChange}
                                            className="w-28 px-4 py-4 rounded-xl border-gray-100 bg-gray-50/50 focus:border-[#6605c7] focus:ring-0 transition-all font-bold text-gray-900 text-[13px]"
                                        >
                                            <option value="None">None</option>
                                            <option value="GRE">GRE</option>
                                            <option value="GMAT">GMAT</option>
                                            <option value="SAT">SAT</option>
                                        </select>
                                        <input
                                            name="testScore"
                                            type="number"
                                            min={testLimits.min}
                                            max={testLimits.max}
                                            step={testLimits.step}
                                            disabled={formData.testScoreType === "None"}
                                            placeholder={testLimits.placeholder}
                                            value={formData.testScore}
                                            onChange={handleChange}
                                            className="flex-1 px-4 py-4 rounded-xl border-gray-100 bg-gray-50/50 focus:border-[#6605c7] focus:ring-0 transition-all font-bold text-gray-900 text-[13px] disabled:opacity-40"
                                        />
                                    </div>
                                </div>

                                {/* English Proficiency */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">English Proficiency</label>
                                        {formData.englishTestType !== "None" && (
                                            <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                                Range: {englishLimits.min} - {englishLimits.max}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-4">
                                        <select
                                            name="englishTestType"
                                            value={formData.englishTestType}
                                            onChange={handleChange}
                                            className="w-28 px-4 py-4 rounded-xl border-gray-100 bg-gray-50/50 focus:border-[#6605c7] focus:ring-0 transition-all font-bold text-gray-900 text-[13px]"
                                        >
                                            <option value="IELTS">IELTS</option>
                                            <option value="TOEFL">TOEFL</option>
                                            <option value="PTE">PTE</option>
                                            <option value="Duolingo">Duolingo</option>
                                            <option value="None">None</option>
                                        </select>
                                        <input
                                            name="englishTestScore"
                                            type="number"
                                            min={englishLimits.min}
                                            max={englishLimits.max}
                                            step={englishLimits.step}
                                            disabled={formData.englishTestType === "None"}
                                            placeholder={englishLimits.placeholder}
                                            value={formData.englishTestScore}
                                            onChange={handleChange}
                                            className="flex-1 px-4 py-4 rounded-xl border-gray-100 bg-gray-50/50 focus:border-[#6605c7] focus:ring-0 transition-all font-bold text-gray-900 text-[13px] disabled:opacity-40"
                                        />
                                    </div>
                                </div>

                                {/* Work Exp (Years) */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Work Exp (Years)</label>
                                        <span className="text-[10px] text-gray-400 font-medium">Max: 50 yrs</span>
                                    </div>
                                    <input
                                        name="experienceYears"
                                        type="number"
                                        min="0"
                                        max="50"
                                        step="0.5"
                                        value={formData.experienceYears}
                                        onChange={handleChange}
                                        className="w-full px-4 py-4 rounded-xl border-gray-100 bg-gray-50/50 focus:border-[#6605c7] focus:ring-0 transition-all font-bold text-gray-900 text-[13px]"
                                    />
                                </div>

                                {/* Research Papers */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Research Papers</label>
                                        <span className="text-[10px] text-gray-400 font-medium">Max: 50 papers</span>
                                    </div>
                                    <input
                                        name="researchPapers"
                                        type="number"
                                        min="0"
                                        max="50"
                                        step="1"
                                        value={formData.researchPapers}
                                        onChange={handleChange}
                                        className="w-full px-4 py-4 rounded-xl border-gray-100 bg-gray-50/50 focus:border-[#6605c7] focus:ring-0 transition-all font-bold text-gray-900 text-[13px]"
                                    />
                                </div>
                            </div>

                            <button type="submit" disabled={loading} className="w-full py-5 bg-[#6605c7] text-white rounded-xl font-bold uppercase tracking-widest text-[11px] hover:scale-[1.02] shadow-xl transition-all disabled:opacity-50">
                                {loading ? "Analyzing Profile..." : "Predict Chance"}
                            </button>
                        </form>
                    </div>

                    <div className="sticky top-32">
                        {!result ? (
                            <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-xl p-12 text-center shadow-xl">
                                <div className="w-20 h-20 bg-gray-50 rounded-xl flex items-center justify-center mx-auto mb-6 text-gray-300">
                                    <span className="material-symbols-outlined text-4xl">query_stats</span>
                                </div>
                                <h3 className="text-xl font-display font-bold text-gray-900 mb-2">Ready to crunch numbers</h3>
                                <p className="text-gray-400 text-[13px]">Fill out your profile details to see your<br />admission chances.</p>
                            </div>
                        ) : (
                            <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-xl p-10 shadow-xl space-y-8 animate-fade-in-up">
                                <div className="text-center">
                                    <h3 className="text-gray-400 font-bold uppercase tracking-widest text-[11px] mb-6">Admission Probability</h3>
                                    <div className="relative inline-flex items-center justify-center w-48 h-48 mx-auto">
                                        <svg className="transform -rotate-90 w-full h-full">
                                            <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-gray-100" />
                                            <circle cx="96" cy="96" r="80" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={502.4} strokeDashoffset={502.4 - (result.probability / 100 * 502.4)} className="text-[#6605c7] transition-all duration-1000 ease-out" strokeLinecap="round" />
                                        </svg>
                                        <span className="absolute text-5xl font-bold text-gray-900">{result.probability}%</span>
                                    </div>
                                    <p className="text-2xl font-display font-bold text-gray-900 mt-6">{formData.targetUniversity}</p>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-gray-900 border-b border-gray-100 pb-2 text-[13px] uppercase tracking-widest">Analysis & Feedback</h4>
                                    <ul className="space-y-4">
                                        {result.feedback?.map((item: string, i: number) => (
                                            <li key={i} className="flex items-start gap-4 text-[13px] text-gray-600">
                                                <span className="w-2 h-2 rounded-full bg-[#6605c7] mt-1.5 shrink-0" />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-6 rounded-xl bg-orange-50 border border-orange-100">
                                    <p className="text-[13px] text-orange-700 flex gap-3">
                                        <span className="material-symbols-outlined text-lg">info</span>
                                        <span>This prediction is based on historical data trends and is not an official guarantee.</span>
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}
