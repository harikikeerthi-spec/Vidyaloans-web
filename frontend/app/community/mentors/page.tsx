"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { communityApi, chatApi } from "@/lib/api";

interface Mentor {
    id: string;
    name: string;
    university?: string;
    country?: string;
    expertise?: string[];
    bio?: string;
    image?: string;
    rating?: number;
    sessionsCompleted?: number;
}

export default function MentorsPage() {
    const [mentors, setMentors] = useState<Mentor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        communityApi.getMentors({ limit: 50 })
            .then((res: any) => {
                const list = Array.isArray(res) ? res : res?.data || [];
                setMentors(list);
            })
            .catch(() => setMentors([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <main className="relative min-h-screen font-sans bg-transparent">
            <style>{`
                .m-glass { background: rgba(255,255,255,0.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.5); }
                .mentor-card { background: rgba(255,255,255,0.8); border: 1px solid rgba(255,255,255,0.6); transition: all 0.3s cubic-bezier(0.16,1,0.3,1); }
                .mentor-card:hover { transform: translateY(-4px); background: white; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1); border-color: #6605c7; }
                .grad-text { background: linear-gradient(135deg, #7c3aed, #6605c7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            `}</style>

            <div className="relative z-10 pt-32 pb-24 max-w-7xl mx-auto px-6 text-center">
                <div className="mb-16">
                    <span className="inline-block px-4 py-2 rounded-full bg-[#6605c7]/10 text-[#6605c7] text-[10px] font-bold uppercase tracking-widest mb-4">Expert Guidance</span>
                    <h1 className="text-5xl md:text-7xl font-bold mb-6" style={{ fontFamily: "'Noto Serif', serif" }}>
                        Verified <span className="grad-text">Mentors</span>
                    </h1>
                    <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
                        Connect with students and professionals who have navigated the same path. Get insights on admits, loans, and campus life.
                    </p>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-64 rounded-[3rem] bg-white/40 animate-pulse border border-white/50" />
                        ))}
                    </div>
                ) : mentors.length === 0 ? (
                    <div className="det-glass p-16 rounded-[4rem] max-w-2xl mx-auto">
                        <div className="text-6xl mb-6">🎓</div>
                        <h3 className="text-2xl font-bold mb-2">Mentor search in progress</h3>
                        <p className="text-gray-500">We're onboarding new experts. Check back soon!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {mentors.map(m => (
                            <div key={m.id} className="mentor-card p-8 rounded-[3rem] text-center flex flex-col">
                                <div className="w-24 h-24 mx-auto mb-6 rounded-[2rem] bg-gradient-to-br from-[#7c3aed] to-[#6605c7] flex items-center justify-center text-white font-black text-3xl shadow-xl">
                                    {m.name.charAt(0)}
                                </div>
                                <h3 className="text-xl font-bold mb-1">{m.name}</h3>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">{m.university || 'University'}</p>

                                <div className="flex flex-wrap justify-center gap-2 mb-6 h-12 overflow-hidden">
                                    {(m.expertise || ['General']).slice(0, 2).map(exp => (
                                        <span key={exp} className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase">
                                            {exp}
                                        </span>
                                    ))}
                                </div>

                                <div className="mt-auto pt-6 border-t border-black/5 grid grid-cols-2">
                                    <div>
                                        <div className="text-sm font-bold">{m.sessionsCompleted || 0}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase">Sessions</div>
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold">⭐ {m.rating || "5.0"}</div>
                                        <div className="text-[10px] text-gray-400 font-bold uppercase">Rating</div>
                                    </div>
                                </div>
                                <button 
                                    onClick={async () => {
                                        try {
                                            const res = await chatApi.connect() as any;
                                            window.open(res.whatsappUrl, '_blank');
                                        } catch (e) {
                                            const rawNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_AWS_WHATSAPP_NUMBER || '+918143797779';
                                            const cleanNumber = rawNumber.replace('whatsapp:', '').replace(/\D/g, '');
                                            window.open(`https://wa.me/${cleanNumber}`, '_blank');
                                        }
                                    }}
                                    className="mt-6 w-full py-3 rounded-2xl bg-[#6605c7] text-white font-bold text-xs uppercase tracking-widest hover:shadow-lg transition-all"
                                >
                                    Chat via WhatsApp
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
