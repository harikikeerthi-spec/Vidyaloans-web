"use client";

import { useState, useEffect } from "react";
import { aiApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { normalizeSopAnalysis } from "@/lib/sopAnalysisFormatter";

export default function SOPAnalyzerPage() {
    const { isAuthenticated } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(false);
    const [humanizing, setHumanizing] = useState(false);
    const [sopText, setSopText] = useState("");
    const [result, setResult] = useState<any>(null);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("pending_sop_analyzer_text");
            if (saved) {
                setSopText(saved);
                localStorage.removeItem("pending_sop_analyzer_text");
            }
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sopText.trim()) return;

        if (!isAuthenticated) {
            localStorage.setItem("pending_sop_analyzer_text", sopText);
            alert("To view your SOP quality score and analysis, please login. You will be redirected to the login page.");
            router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
            return;
        }

        setLoading(true);
        try {
            const res = await aiApi.sopReview({ text: sopText }) as any;
            const analysisPayload = res?.analysis ?? res;
            setResult(normalizeSopAnalysis(analysisPayload));
        } catch (err) {
            console.error(err);
            alert("Failed to analyze SOP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleHumanize = async () => {
        if (!sopText.trim()) return;

        if (!isAuthenticated) {
            localStorage.setItem("pending_sop_analyzer_text", sopText);
            alert("To humanize your SOP and view analysis, please login. You will be redirected to the login page.");
            router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
            return;
        }

        setHumanizing(true);
        try {
            const res = await aiApi.sopHumanize(sopText) as any;
            if (res.success && res.text) {
                setSopText(res.text);
                // Re-analyze after humanizing
                const analysisRes = await aiApi.sopReview({ text: res.text }) as any;
                const analysisPayload = analysisRes?.analysis ?? analysisRes;
                setResult(normalizeSopAnalysis(analysisPayload));
            }
        } catch (err) {
            console.error(err);
            alert("Failed to humanize SOP.");
        } finally {
            setHumanizing(false);
        }
    };

    return (
        <div className="min-h-screen bg-transparent">
            <main className="relative z-10 pt-32 pb-24">
                <section className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <span className="text-[#6605c7] font-bold text-[11px] tracking-[0.2em] uppercase mb-4 block">Document Intelligence</span>
                        <h1 className="text-5xl md:text-6xl font-display font-bold text-gray-900 mb-6">
                            SOP <span className="italic text-[#6605c7]">Analyser</span>
                        </h1>
                        <p className="text-gray-500 text-lg max-w-3xl mx-auto leading-relaxed">
                            Evaluate your Statement of Purpose against global university standards.
                            Our AI analyzes clarity, financial justification, and authentic narrative quality.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                        {/* Editor Section */}
                        <div className="lg:col-span-7">
                            <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-[2.5rem] p-8 shadow-xl">
                                <div className="mb-6">
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Your Statement of Purpose</label>
                                    <textarea
                                        value={sopText}
                                        onChange={(e) => setSopText(e.target.value)}
                                        placeholder="Paste your complete SOP here (minimum 100 words recommended)..."
                                        className="w-full h-80 px-6 py-5 rounded-3xl border-gray-100 bg-gray-50/50 text-gray-900 focus:ring-2 focus:ring-[#6605c7] focus:border-transparent transition-all overflow-y-auto resize-none font-medium leading-relaxed"
                                        required
                                    />
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    <button
                                        type="submit"
                                        disabled={loading || !sopText.trim()}
                                        className="flex-1 min-w-[180px] py-4 bg-[#6605c7] text-white rounded-full font-bold uppercase tracking-widest text-xs hover:scale-[1.02] shadow-xl shadow-[#6605c7]/20 transition-all disabled:opacity-50"
                                    >
                                        {loading ? "Analyzing Accuracy..." : "Analyze SOP Quality"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleHumanize}
                                        disabled={humanizing || !sopText.trim()}
                                        className="px-8 py-4 bg-[#e0c389] text-gray-900 rounded-full font-bold uppercase tracking-widest text-xs hover:scale-[1.02] shadow-xl transition-all disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-sm">person_check</span>
                                        {humanizing ? "Refining..." : "Humanize SOP"}
                                    </button>
                                    <button
                                        type="reset"
                                        onClick={() => { setSopText(""); setResult(null); }}
                                        className="px-8 py-4 border border-gray-200 text-gray-500 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-gray-50:bg-white/5 transition-all"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </form>
                        </div>

                        {/* Results Section */}
                        <div className="lg:col-span-5">
                            <div className="bg-white/80 backdrop-blur-xl border border-gray-100 rounded-[2.5rem] p-10 shadow-xl sticky top-32">
                                {!result ? (
                                    <div className="text-center py-10">
                                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <span className="material-symbols-outlined text-gray-300 text-4xl">analytics</span>
                                        </div>
                                        <h3 className="text-xl font-display font-bold text-gray-900 mb-2">Awaiting Assessment</h3>
                                        <p className="text-gray-400 text-sm">Paste your SOP and click evaluate to see your quality score and detailed breakdown.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-8 animate-fade-in-up">
                                        <div className="flex items-center justify-between border-b border-gray-100 pb-6">
                                            <div>
                                                <h3 className="text-2xl font-display font-bold text-gray-900 mb-1">Quality Score</h3>
                                                <p className="text-gray-400 text-xs">Based on university acceptance criteria</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-5xl font-bold text-[#6605c7]">{result.score || 0}</div>
                                                <div className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">/ 100</div>
                                            </div>
                                        </div>

                                        {/* Dynamic Scores */}
                                        <div className="space-y-6">
                                            <ScoreBar label="Authenticity / Human Score" score={result.humanScore || 85} color="bg-blue-500" />
                                            <ScoreBar label="Originality Score" score={result.originalityScore || 92} color="bg-green-500" />
                                        </div>

                                        <div className="space-y-4">
                                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Analysis Breakdown</h4>
                                            <div className="grid grid-cols-1 gap-3">
                                                {Object.entries(result.categories || {}).map(([key, val]: [string, any], i) => (
                                                    <div key={i} className="bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="font-bold text-gray-900 text-xs capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                                                            <span className="text-[10px] font-bold text-[#6605c7]">{Number(val) || 0}%</span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-[#6605c7] transition-all duration-1000" style={{ width: `${Number(val) || 0}%` }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-gray-100">
                                            <h4 className="flex items-center gap-2 text-[#6605c7] font-bold uppercase tracking-widest text-[10px] mb-4">
                                                <span className="material-symbols-outlined text-sm">warning</span>
                                                Areas to Strengthen
                                            </h4>
                                            <ul className="space-y-3">
                                                 {(result.weakAreas || ["Detailed research goals could be more specific.", "Financial planning section needs better justification."]).map((w: any, i: number) => {
                                                     const text = typeof w === 'string'
                                                         ? w
                                                         : w?.recommendation
                                                         ? `${w.issue ? `${w.issue}: ` : ''}${w.recommendation}`
                                                         : (w?.issue || w?.suggestion || w?.point || 'Needs improvement');
                                                     return (
                                                         <li key={i} className="text-xs text-gray-600 flex gap-2">
                                                             <span className="text-[#6605c7]">•</span> {text}
                                                         </li>
                                                     );
                                                 })}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
    return (
        <div className="p-5 rounded-2xl border border-gray-100 bg-gray-50/30">
            <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
                <span className="text-sm font-bold text-gray-900">{score}%</span>
            </div>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${score}%` }} />
            </div>
        </div>
    );
}
