
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { blogApi } from "@/lib/api";
import type { BlogPost } from "@/types";

export default function BlogPostPage() {
    const params = useParams();
    const slug = params?.slug;
    const rawSlug = Array.isArray(slug) ? slug[0] : slug;
    const cleanSlug = rawSlug ? decodeURIComponent(rawSlug) : "";
    const [blog, setBlog] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchBlog = async () => {
            if (!cleanSlug) return;
            setLoading(true);
            setError(null);
            try {
                // Try fetching by slug first
                const res = await blogApi.getBySlug(cleanSlug) as { success: boolean; data: BlogPost };
                if (res?.success && res.data) {
                    setBlog(res.data);
                    return;
                } else if ((res as any)?.data) {
                    setBlog((res as any).data);
                    return;
                }
                
                // Fallback: try by ID if slug might be a UUID
                const fallback = await blogApi.getById(cleanSlug) as any;
                if (fallback?.success && fallback.data) {
                    setBlog(fallback.data);
                    return;
                }
                setError("Blog not found");
            } catch (err) {
                // Secondary attempt with getById
                try {
                    const fallback = await blogApi.getById(cleanSlug) as any;
                    if (fallback?.success && fallback.data) {
                        setBlog(fallback.data);
                        return;
                    }
                } catch (_) {}
                console.error("Error fetching blog:", err);
                setError("Failed to load blog post");
            } finally {
                setLoading(false);
            }
        };
        fetchBlog();
    }, [cleanSlug]);

    if (loading) {
        return (
            <div className="min-h-screen pt-32 pb-20 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading article...</p>
            </div>
        );
    }

    if (error || !blog) {
        return (
            <div className="min-h-screen pt-32 pb-20 flex flex-col items-center justify-center px-6 text-center">
                <span className="material-symbols-outlined text-6xl text-rose-400 mb-6">error_outline</span>
                <h1 className="text-2xl font-bold mb-3 text-gray-900">{error || "Blog not found"}</h1>
                <p className="text-gray-500 text-sm max-w-md mb-6">The article you requested could not be located or may have moved.</p>
                <Link href="/blog" className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 hover:bg-purple-700 transition-all text-sm">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    Back to all blogs
                </Link>
            </div>
        );
    }

    const normalizeSrc = (s?: string) => {
        if (!s) return "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1200";
        if (/^https?:\/\//i.test(s) || s.startsWith('data:')) return s;
        return s.startsWith('/') ? s : `/${s}`;
    };

    return (
        <article className="pt-24 pb-32 bg-white">
            {/* Header / Hero */}
            <div className="max-w-4xl mx-auto px-6 mb-12">
                <Link href="/blog" className="inline-flex items-center gap-2 text-gray-400 hover:text-purple-600 transition-colors mb-12 group">
                    <span className="material-symbols-outlined text-[20px] group-hover:-translate-x-1 transition-transform">arrow_back</span>
                    <span className="text-[11px] font-black uppercase tracking-[0.3em]">Back to Hub</span>
                </Link>

                <div className="flex items-center gap-3 text-[11px] font-black text-purple-600 uppercase tracking-[0.4em] mb-8">
                    <span>{blog.category || "Education"}</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                    <span>{blog.readTime || 5} min read</span>
                </div>

                <h1 className="text-4xl md:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight mb-4 font-display">
                    {blog.title}
                </h1>

                {(blog.subtitle || (blog as any).excerpt) && (
                    <p className="text-lg md:text-xl text-gray-500 font-medium leading-relaxed mb-8">
                        {blog.subtitle || (blog as any).excerpt}
                    </p>
                )}

                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center font-bold text-purple-600 text-lg">
                        {(blog.authorName || blog.author || "V")[0] || "V"}
                    </div>
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400">Written by</p>
                        <p className="text-gray-900 font-black text-[13px]">{blog.authorName || blog.author || "VidyaLoan Team"}</p>
                    </div>
                    <div className="ml-auto text-right">
                        <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400">Published</p>
                        <p className="text-gray-900 font-black text-[13px]">
                            {new Date(blog.publishedAt || blog.createdAt).toLocaleDateString("en-IN", { month: "long", day: "numeric", year: "numeric" })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Featured Image */}
            <div className="max-w-6xl mx-auto px-6 mb-20">
                <div className="relative aspect-[21/9] rounded-[3rem] overflow-hidden shadow-2xl bg-slate-100 border border-slate-100">
                    <img
                        src={normalizeSrc(blog.featuredImage || blog.coverImage)}
                        alt={blog.title}
                        className="w-full h-full object-cover"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="max-w-3xl mx-auto px-6">
                <div
                    className="prose prose-lg prose-purple max-w-none 
                    prose-headings:font-display prose-headings:italic prose-headings:font-black prose-headings:tracking-tight
                    prose-p:text-gray-600 prose-p:leading-relaxed
                    prose-strong:text-gray-900 prose-strong:font-black
                    prose-img:rounded-[2rem] prose-img:shadow-xl
                    prose-a:text-purple-600 prose-a:font-bold prose-a:no-underline hover:prose-a:underline
                    "
                    dangerouslySetInnerHTML={{ __html: blog.content }}
                />

                {/* Tags */}
                {blog.tags && blog.tags.length > 0 && (
                    <div className="mt-20 pt-10 border-t border-gray-100 flex flex-wrap gap-3">
                        {blog.tags.map((tag: string) => (
                            <span key={tag} className="px-4 py-2 bg-gray-50 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 border border-gray-100">
                                #{tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Newsletter CTA */}
            <div className="max-w-4xl mx-auto px-6 mt-32">
                <div className="bg-[#1a1a2e] rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <span className="material-symbols-outlined text-9xl text-white">mail</span>
                    </div>
                    <div className="relative z-10 max-w-xl mx-auto">
                        <h2 className="text-3xl font-black text-white mb-6 font-display">
                            LIKE WHAT YOU READ?
                        </h2>
                        <p className="text-gray-400 text-lg mb-10 leading-relaxed font-medium">
                            Join 50,000+ students receiving expert loan insights and university guides weekly.
                        </p>
                        <form className="flex flex-col sm:flex-row gap-4">
                            <input
                                type="email"
                                placeholder="Your email address"
                                className="flex-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold"
                            />
                            <button className="bg-purple-600 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-[0.3em] text-[11px] hover:bg-purple-700 transition-all shadow-xl shadow-purple-500/20">
                                Subscribe
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </article>
    );
}
