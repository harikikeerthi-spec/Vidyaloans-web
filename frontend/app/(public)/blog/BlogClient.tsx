"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { blogApi } from "@/lib/api";
import type { BlogPost } from "@/types";

const categories = ["All", "Tips & Guides", "Success Stories", "News & Updates", "USA", "UK", "Canada", "Australia"];

export default function BlogClient() {
    const [blogs, setBlogs] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [activeCategory, setActiveCategory] = useState("All");
    const [page, setPage] = useState(1);

    useEffect(() => {
        const loadBlogs = async () => {
            setLoading(true);
            try {
                const data = await blogApi.getAll(page, 12) as { blogs?: BlogPost[]; data?: BlogPost[] };
                setBlogs(data?.blogs || data?.data || []);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadBlogs();
    }, [page]);

    const filtered = blogs.filter((b) => {
        const matchesCategory = activeCategory === "All" || b.category === activeCategory || (b.tags && b.tags.includes(activeCategory));
        const matchesSearch = !search || b.title.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const normalizeSrc = (s?: string, fallback?: string) => {
        const def = fallback || `https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=60`;
        if (!s) return def;
        try {
            const str = String(s).trim();
            if (!str) return def;
            if (/^https?:\/\//i.test(str) || str.startsWith('data:')) return str;
            // ensure leading slash for public assets
            return str.startsWith('/') ? str : `/${str}`;
        } catch {
            return def;
        }
    };

    return (
        <div className="pt-28 pb-20 bg-transparent">
            {/* Hero */}
            <div className="bg-[#1a1626] text-white py-16 px-6 mb-12 relative overflow-hidden rounded-xl mx-6 shadow-2xl">
                <div className="absolute inset-0 opacity-5 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
                <div className="max-w-6xl mx-auto relative z-10">
                    <div className="max-w-2xl px-6">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-xl text-[10px] font-bold uppercase tracking-widest mb-6 border border-white/5 text-purple-200">
                            <span className="material-symbols-outlined text-[14px]">auto_stories</span>
                            Knowledge Hub
                        </span>
                        <h1 className="text-3xl md:text-5xl font-bold mb-6 leading-tight">
                            Insights & Resources for Your Study Abroad Journey
                        </h1>
                        <p className="text-[13px] text-white/60 mb-10 leading-relaxed max-w-xl">
                            Expert advice on education loans, financial planning, and inspiring student success stories to guide your global education path.
                        </p>
                        <div className="max-w-lg relative group">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-white transition-colors text-[20px]">search</span>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search articles, guides, tips..."
                                className="w-full pl-12 pr-6 py-3.5 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-[#6605c7]/50 transition-all font-medium text-[13px] outline-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6">
                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar mb-10 pb-2 border-b border-gray-50">
                    {categories.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => { setActiveCategory(cat); setPage(1); }}
                            className={`min-h-[44px] px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-widest whitespace-nowrap transition-all border inline-flex items-center justify-center cursor-pointer ${activeCategory === cat
                                ? "bg-[#6605c7] text-white border-[#6605c7] shadow-lg shadow-purple-500/20"
                                : "bg-white text-gray-400 border-transparent hover:text-gray-900 hover:bg-gray-50"
                                }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                {/* Loading State */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="bg-gray-50 rounded-xl animate-pulse h-80" />
                        ))}
                    </div>
                ) : !filtered.length ? (
                    <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <span className="material-symbols-outlined text-5xl text-gray-300 block mb-4">dynamic_feed</span>
                        <h3 className="text-lg font-bold mb-1 text-gray-900">No articles match your selection</h3>
                        <p className="text-[13px] text-gray-500">Try adjusting your search or switching categories</p>
                        <button onClick={() => { setSearch(""); setActiveCategory("All"); }} className="mt-6 text-[#6605c7] text-[11px] font-bold uppercase tracking-widest underline decoration-2 underline-offset-4">Reset all filters</button>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Featured Post */}
                        {page === 1 && activeCategory === "All" && !search && filtered[0] && (
                            <Link href={`/blog/${filtered[0].slug}`} className="group block bg-white rounded-[32px] overflow-hidden border border-slate-100 hover:border-purple-500/10 hover:shadow-2xl transition-all duration-500 shadow-sm">
                                <div className="grid md:grid-cols-2 gap-0">
                                    <div className="aspect-[16/10] md:aspect-auto relative overflow-hidden bg-slate-950">
                                        <Image
                                            src={normalizeSrc(filtered[0].featuredImage || filtered[0].coverImage)}
                                            alt={filtered[0].title}
                                            fill
                                            className="object-cover group-hover:scale-105 transition-transform duration-1000 filter brightness-95 group-hover:brightness-90"
                                        />
                                        <div className="absolute top-6 left-6 z-10">
                                            <span className="bg-[#6605c7] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-purple-500/20 border border-purple-400/20 flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                Featured Article
                                            </span>
                                        </div>
                                    </div>
                                    <div className="p-10 md:p-14 flex flex-col justify-center bg-gradient-to-br from-white to-slate-50/50">
                                        <div className="flex items-center gap-3 text-[11px] font-extrabold text-[#6605c7] uppercase tracking-widest mb-5">
                                            <span className="px-2.5 py-1 bg-purple-50 border border-purple-100 rounded-lg">{filtered[0].category || "Education"}</span>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                            <span className="text-slate-400">{new Date(filtered[0].createdAt).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}</span>
                                        </div>
                                        <h2 className="text-2xl md:text-3xl font-extrabold mb-5 group-hover:text-[#6605c7] transition-colors duration-300 leading-snug text-gray-900 tracking-tight">
                                            {filtered[0].title}
                                        </h2>
                                        <p className="text-gray-500 text-[13.5px] line-clamp-3 mb-8 leading-relaxed">
                                            {filtered[0].excerpt}
                                        </p>
                                        <div className="flex items-center gap-3.5 pt-6 border-t border-slate-100">
                                            <div className="w-11 h-11 bg-gradient-to-br from-[#6605c7]/10 to-purple-100 rounded-2xl flex items-center justify-center font-bold text-[#6605c7] text-base border border-purple-100 shadow-sm">
                                                {(filtered[0].authorName || filtered[0].author || "V")[0] || "V"}
                                            </div>
                                            <div>
                                                <p className="font-extrabold uppercase text-[9px] tracking-widest text-slate-400">Written by</p>
                                                <p className="text-slate-700 font-extrabold text-[13px]">{filtered[0].authorName || filtered[0].author || "VidyaLoan Team"}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )}

                        {/* Standard Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filtered.slice((page === 1 && activeCategory === "All" && !search) ? 1 : 0).map((blog) => (
                                <Link key={blog.id} href={`/blog/${blog.slug}`} className="group relative block h-[420px] rounded-3xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-500 border border-slate-100 hover:border-purple-500/20 bg-slate-950">
                                    {/* Cover Image Background */}
                                    <div className="absolute inset-0 z-0">
                                        <Image
                                            src={normalizeSrc(blog.featuredImage || blog.coverImage, `https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=600&q=60`)}
                                            alt={blog.title}
                                            fill
                                            className="object-cover transition-all duration-700 scale-100 group-hover:scale-105 filter brightness-[0.8] group-hover:brightness-[0.35] group-hover:blur-[0.5px]"
                                        />
                                    </div>

                                    {/* Float Category Badge */}
                                    {blog.category && (
                                        <div className="absolute top-5 left-5 z-20">
                                            <span className="bg-white/95 backdrop-blur-md text-gray-900 px-3 py-1.5 rounded-xl text-[9px] font-extrabold uppercase tracking-widest border border-gray-100/50 shadow-sm transition-all duration-300 group-hover:bg-[#6605c7] group-hover:text-white group-hover:border-[#6605c7]">
                                                {blog.category}
                                            </span>
                                        </div>
                                    )}

                                    {/* Text Content Overlay */}
                                    <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent">
                                        {/* Title (Always visible) */}
                                        <h2 className="text-[17px] font-extrabold text-white leading-snug mb-2 group-hover:text-purple-300 transition-colors duration-300 drop-shadow-md">
                                            {blog.title}
                                        </h2>

                                        {/* Hover Reveal Area */}
                                        <div className="max-h-0 opacity-0 overflow-hidden group-hover:max-h-[160px] group-hover:opacity-100 transition-all duration-500 ease-in-out">
                                            <p className="text-slate-300 text-[12.5px] leading-relaxed mb-5 line-clamp-3">
                                                {blog.excerpt}
                                            </p>
                                            <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center font-bold text-[11px] text-white border border-white/10">
                                                        {(blog.authorName || blog.author || "V")[0] || "V"}
                                                    </div>
                                                    <span className="text-[11.5px] font-bold text-slate-200">
                                                        {blog.authorName || blog.author || "VidyaLoan"}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                                    {new Date(blog.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Pagination */}
                {!loading && filtered.length > 0 && (
                    <div className="flex justify-center items-center gap-4 mt-16">
                        <button
                            onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            disabled={page === 1}
                            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-gray-100 disabled:opacity-30 hover:bg-gray-50 transition-all shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                        </button>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Page <span className="text-[#6605c7]">{page}</span></span>
                        <button
                            onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            className="w-10 h-10 flex items-center justify-center bg-white rounded-xl border border-gray-100 hover:bg-gray-50 transition-all shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Newsletter Section */}
            <div className="max-w-6xl mx-auto px-6 mt-24">
                <div className="bg-[#1a1a2e] rounded-xl p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <span className="material-symbols-outlined text-9xl text-white">mail</span>
                    </div>
                    <div className="relative z-10 max-w-xl mx-auto">
                        <span className="material-symbols-outlined text-4xl text-emerald-400 mb-6 block">email</span>
                        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                            Stay Ahead in Your Study Abroad Journey
                        </h2>
                        <p className="text-gray-400 text-[13px] mb-10 leading-relaxed">
                            Join 50,000+ students. Get the latest loan insights, university guides, and exclusive tips delivered to your inbox.
                        </p>
                        <form className="flex flex-col sm:flex-row gap-3 p-1.5 bg-white/5 backdrop-blur-md rounded-xl border border-white/10">
                            <input
                                type="email"
                                placeholder="Enter your email address"
                                className="flex-1 bg-transparent border-none px-5 py-3 text-white placeholder-gray-500 focus:ring-0 outline-none font-medium text-[13px]"
                                required
                            />
                            <button className="bg-[#6605c7] text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-[11px] hover:bg-[#5504a6] transition-all shadow-lg shadow-purple-500/10">
                                Subscribe Now
                            </button>
                        </form>
                        <p className="text-[10px] text-gray-500 mt-6 uppercase tracking-widest font-bold">Zero Spam. Unsubscribe at any time.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
