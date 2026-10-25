"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { communityApi } from "@/lib/api";
import CreatePostModal from "@/components/CreatePostModal";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ForumPost {
    id: string;
    title: string;
    content: string;
    category?: string;
    tags?: string[];
    author?: { firstName?: string; lastName?: string; name?: string; email?: string } | string;
    createdAt?: string;
    _count?: { comments?: number };
    likeCount?: number;
    commentCount?: number;
    isPinned?: boolean;
}

interface Stats {
    mentors?: number;
    forumPosts?: number;
    stories?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(date: string) {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function authorName(a: ForumPost["author"]): string {
    if (!a) return "Anonymous";
    if (typeof a === "string") return a;
    if (a.firstName) return `${a.firstName} ${a.lastName || ""}`.trim();
    return a.name || a.email?.split("@")[0] || "Anonymous";
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CommunityHubPage() {
    const router = useRouter();
    const [posts, setPosts] = useState<ForumPost[]>([]);
    const [stats, setStats] = useState<Stats>({});
    const [postsLoading, setPostsLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [sort, setSort] = useState<"latest" | "popular">("latest");

    // Fetch discussions
    useEffect(() => {
        setPostsLoading(true);
        communityApi
            .getForumPosts({ sort, limit: 6 })
            .then((res: any) => {
                const list = Array.isArray(res) ? res : res?.data || [];
                setPosts(list);
            })
            .catch(() => setPosts([]))
            .finally(() => setPostsLoading(false));
    }, [sort]);

    // Fetch stats
    useEffect(() => {
        communityApi
            .getStats()
            .then((res: any) => setStats(res?.data || {}))
            .catch(() => { });
    }, []);

    const TRENDING_TAGS = [
        { label: "#Education", href: "/community/discussions?tag=Education" },
        { label: "#StudyAbroad", href: "/community/discussions?tag=StudyAbroad" },
        { label: "#StudentLoans", href: "/community/discussions?tag=StudentLoans" },
        { label: "#VisaUpdates", href: "/community/discussions?tag=VisaUpdates" },
        { label: "#Scholarships", href: "/community/discussions?tag=Scholarships" },
        { label: "#GREPrep", href: "/community/discussions?tag=GREPrep" },
        { label: "#Masters2026", href: "/community/discussions?category=General" },
        { label: "#Admissions", href: "/community/discussions?tag=Admissions" },
    ];

    return (
        <main className="relative min-h-screen bg-gray-50/50">
            {/* ── Background ─────────────────────────────────────────────────── */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-96 bg-[#6605c7]/[0.02]" />
            </div>

            {/* ── Styles ────────────────────────────────────────────────────── */}
            <style>{`
                .ch-glass { background: white; border: 1px solid #f3f4f6; }
                .ch-tag { display:inline-flex; padding:6px 14px; border-radius:8px; background:white; border:1px solid #e5e7eb; font-size:11px; font-weight:700; color:#4b5563; transition:all 0.2s; text-decoration:none; }
                .ch-tag:hover { border-color:#6605c7; color:#6605c7; transform:translateY(-1px); }
                .animated-text { color:#6605c7; }
                .ch-cat-item { position:relative; overflow:hidden; transition:all 0.4s cubic-bezier(0.4,0,0.2,1); border-radius:1rem; border: 1px solid #f3f4f6; }
                .ch-cat-item:hover { transform:translateY(-4px); border-color:rgba(102,5,199,0.2); }
                .ch-cat-img { transition:transform 1s ease; width:100%; height:100%; object-fit:cover; filter: grayscale(10%) contrast(90%); }
                .ch-cat-item:hover .ch-cat-img { transform:scale(1.05); }
                .ch-cat-overlay { background:linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, transparent 100%); position:absolute; inset:0; }
                .ch-stat-card { text-align:center; padding: 0 2rem; }
                .ch-post-card { background:white; border:1px solid #f3f4f6; border-radius:12px; padding:16px 18px; transition:all 0.2s; display:block; text-decoration:none; }
                .ch-post-card:hover { border-color:#e9d5ff; box-shadow:0 4px 12px rgba(102,5,199,0.04); }
                .ch-avatar { width:32px; height:32px; border-radius:8px; background:#6605c7; display:flex; align-items:center; justify-content:center; color:white; font-weight:800; font-size:12px; flex-shrink:0; }
                .ch-badge { display:inline-block; padding:2px 8px; border-radius:4px; font-size:9px; font-weight:800; background:#f3e8ff; color:#6605c7; text-transform: uppercase; letter-spacing: 0.05em; }
                .ch-sort-btn { padding:6px 14px; border-radius:8px; border:1px solid #e5e7eb; background:white; font-size:11px; font-weight:700; color:#4b5563; cursor:pointer; transition:all 0.2s; }
                .ch-sort-btn.active { background:#6605c7; color:white; border-color:#6605c7; }
                .skeleton { background:linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%); background-size:200% 100%; animation:shimmer 1.2s infinite; border-radius:8px; }
                @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
                .quick-topic { padding:6px 12px; border-radius:8px; background:white; border:1px solid #e5e7eb; font-size:11px; font-weight:700; color:#374151; text-decoration:none; transition:all 0.15s; display:inline-block; }
                .quick-topic:hover { border-color:#6605c7; color:#6605c7; background: #6605c7/5; }
            `}</style>

            <div className="relative z-10 pt-32 pb-24">
                <div className="max-w-7xl mx-auto px-6">

                    {/* ── Hero ──────────────────────────────────────────────── */}
                    <section className="text-center mb-24">
                        <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-6 bg-[#6605c7]/10 text-[#6605c7]">
                            Global Education Hub
                        </span>
                        <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-6 tracking-tight">
                            Join the <span className="animated-text">Community</span>
                        </h1>
                        <p className="text-gray-500 text-sm max-w-xl mx-auto mb-16">
                            Connect with thousands of students and experts who have walked your path.
                            Get answers to your loan, university, and visa questions in real-time.
                        </p>

                        {/* Stats Bar */}
                        <div className="flex flex-wrap items-center justify-center divide-x divide-gray-100 bg-white border border-gray-100 py-10 px-6 rounded-xl max-w-5xl mx-auto mb-16 shadow-sm">
                            {[
                                { label: "Members", value: "12.5k+" },
                                { label: "Daily Topics", value: "450+" },
                                { label: "Verified Mentors", value: `${stats.mentors || "85"}+` },
                                { label: "Success Stories", value: `${stats.stories ? `${stats.stories}+` : "2.1k+"}` },
                            ].map((s) => (
                                <div key={s.label} className="ch-stat-card">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                                        {s.label}
                                    </p>
                                    <h3 className="text-2xl font-bold text-gray-900">
                                        {s.value}
                                    </h3>
                                </div>
                            ))}
                        </div>

                        {/* Trending Tags */}
                        <div className="flex flex-wrap justify-center items-center gap-2 max-w-4xl mx-auto mb-16">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] mr-3">
                                Trending:
                            </span>
                            {TRENDING_TAGS.map((t) => (
                                <Link key={t.label} href={t.href} className="ch-tag">
                                    {t.label}
                                </Link>
                            ))}
                        </div>

                        {/* CTA Buttons */}
                        <div className="flex flex-wrap justify-center gap-3">
                            <button
                                onClick={() => setCreateOpen(true)}
                                className="px-6 py-3 bg-[#6605c7] rounded-lg text-white font-bold text-xs hover:bg-[#5504a8] transition-all shadow-sm"
                            >
                                Post a Question
                            </button>
                            <Link
                                href="/community/discussions"
                                className="px-6 py-3 bg-white border border-gray-200 rounded-lg text-gray-700 font-bold text-xs hover:bg-gray-50 transition-all shadow-sm"
                            >
                                Browse Discussions →
                            </Link>
                        </div>
                    </section>

                    {/* ── Trending Now + Live Feed ───────────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-24">

                        {/* Trending Now */}
                        <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 text-red-500">
                                        <span className="material-symbols-outlined text-[18px]">trending_up</span>
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900">Trending Now</h2>
                                </div>
                                <span className="px-2.5 py-1 rounded bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-widest animate-pulse">
                                    Live
                                </span>
                            </div>
                            <div className="space-y-6">
                                {[
                                    { n: "01", title: "Massive Visa Slot Opening - Mumbai Consulate", meta: "1.2k Active · 85+ New", href: "/community/discussions?tag=VisaUpdates" },
                                    { n: "02", title: "Avoiding Loan Rejection: Top 5 Mistakes", meta: "4.5k Views · 2m ago", href: "/community/discussions?tag=Loans" },
                                    { n: "03", title: "IELTS Speaking Topics - Feb 2026 Collection", meta: "⭐ Featured Topic", href: "/community/discussions?tag=IELTS" },
                                ].map((item) => (
                                    <Link key={item.n} href={item.href} className="block group border-b border-gray-50 last:border-0 pb-6 last:pb-0">
                                        <div className="flex items-start gap-5">
                                            <div className="w-9 h-9 flex-shrink-0 rounded-lg bg-gray-50 flex items-center justify-center font-bold text-sm text-gray-400 group-hover:bg-[#6605c7] group-hover:text-white transition-all">
                                                {item.n}
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-[13px] text-gray-900 mb-1 group-hover:text-[#6605c7] transition-colors leading-relaxed">
                                                    {item.title}
                                                </h4>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.meta}</p>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Discussions Feed */}
                        <div className="bg-white p-8 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50 text-blue-500">
                                        <span className="material-symbols-outlined text-[18px]">chat_bubble_outline</span>
                                    </div>
                                    <h2 className="text-lg font-bold text-gray-900">Latest Discussions</h2>
                                </div>
                                <div className="flex gap-1.5">
                                    {(["latest", "popular"] as const).map((s) => (
                                        <button
                                            key={s}
                                            className={`ch-sort-btn ${sort === s ? "active" : ""}`}
                                            onClick={() => setSort(s)}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3 flex-1">
                                {postsLoading ? (
                                    [1, 2, 3, 4].map((i) => (
                                        <div key={i} className="skeleton h-16" />
                                    ))
                                ) : posts.length === 0 ? (
                                    <div className="text-center py-12 rounded-xl bg-gray-50 border border-dashed border-gray-200">
                                        <div className="text-2xl mb-2">💬</div>
                                        <div className="text-[11px] font-black uppercase text-gray-400">No discussions found</div>
                                    </div>
                                ) : (
                                    posts.slice(0, 5).map((post) => (
                                        <Link key={post.id} href={`/community/discussions/${post.id}`} className="ch-post-card">
                                            <div className="flex items-start gap-4">
                                                <div className="ch-avatar">
                                                    {authorName(post.author).charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-[13px] text-gray-900 truncate leading-relaxed">
                                                        {post.title}
                                                    </h4>
                                                    <div className="flex items-center gap-3 mt-1.5">
                                                        {post.category && (
                                                            <span className="ch-badge">{post.category}</span>
                                                        )}
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                                                            <span className="material-symbols-outlined text-[11px]">chat_bubble</span>
                                                            {post.commentCount ?? post._count?.comments ?? 0}
                                                        </div>
                                                        {post.createdAt && (
                                                            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-tight">
                                                                {timeAgo(post.createdAt)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))
                                )}
                            </div>

                            <Link
                                href="/community/discussions"
                                className="block text-center mt-6 py-2.5 rounded-lg font-bold text-[11px] uppercase tracking-widest bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100 transition-all no-underline"
                            >
                                View All Discussions
                            </Link>
                        </div>
                    </div>

                    {/* ── AI Insights Banner ────────────────────────────────── */}
                    <section className="mb-24">
                        <div className="bg-[#6605c7] rounded-xl p-10 md:p-16 relative overflow-hidden flex flex-col lg:flex-row items-center gap-12 shadow-xl shadow-[#6605c7]/20">
                            {/* Decorative elements */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-32 -mt-32" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -ml-32 -mb-32" />

                            <div className="lg:w-3/5 space-y-6 relative z-10 text-center lg:text-left">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-white/10 text-white/90">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    AI Moderation Active
                                </div>
                                <h2 className="text-3xl md:text-4xl font-black leading-tight text-white tracking-tight">
                                    Quality Control, <span className="opacity-60 font-medium">Reimagined.</span>
                                </h2>
                                <p className="text-white/60 text-sm leading-relaxed max-w-xl">
                                    Our advanced AI algorithms continuously monitor and curate the community feed to ensure
                                    100% relevance to education loans, study abroad, and career growth.
                                </p>
                                <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                                    {[
                                        { icon: "verified", label: "Zero Noise" },
                                        { icon: "security", label: "Safe Space" },
                                    ].map((f) => (
                                        <div key={f.label} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                                            <span className="material-symbols-outlined text-white/60 text-sm">{f.icon}</span>
                                            <span className="text-[11px] font-bold text-white uppercase tracking-wider">{f.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="lg:w-2/5 grid grid-cols-2 gap-4 relative z-10 w-full">
                                {[
                                    { val: "99.8%", label: "Relevance" },
                                    { val: "24/7", label: "Active Guard" },
                                    { val: "5k+", label: "Filtered" },
                                    { val: "100%", label: "Verified" },
                                ].map((s) => (
                                    <div key={s.label} className="bg-white/5 border border-white/10 p-5 rounded-lg text-center backdrop-blur-sm">
                                        <div className="text-xl font-black text-white">{s.val}</div>
                                        <div className="text-[9px] font-black text-white/40 uppercase tracking-widest mt-1">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* ── Explore Hubs ─────────────────────────────────────── */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 tracking-tight">Explore Hubs</h2>
                            <p className="text-gray-400 text-sm">Find your tribe in specialized communities</p>
                        </div>
                        <Link href="/community/discussions" className="text-[11px] font-black uppercase tracking-widest text-[#6605c7] hover:underline flex items-center gap-1">
                            Browse All <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                        </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
                        {[
                            {
                                href: "/community/discussions?category=Education+Loans",
                                img: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=800&q=80",
                                icon: "payments",
                                title: "Loans & Finance",
                                desc: "Rates, banks, and guides.",
                            },
                            {
                                href: "/community/discussions?category=Universities",
                                img: "/images/university-default.jpg",
                                icon: "school",
                                title: "Universities",
                                desc: "Schools, life, and rankings.",
                            },
                            {
                                href: "/community/discussions?category=General",
                                img: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=800&q=80",
                                icon: "forum",
                                title: "Discussions",
                                desc: "Connect with everyone.",
                            },
                        ].map((cat) => (
                            <Link key={cat.title} href={cat.href} className="ch-cat-item h-[380px] group flex flex-col no-underline">
                                <img src={cat.img} className="ch-cat-img absolute inset-0 group-hover:scale-105 transition-transform duration-700" alt={cat.title} />
                                <div className="ch-cat-overlay" />
                                <div className="mt-auto p-8 relative z-10">
                                    <div className="w-10 h-10 rounded-lg bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white mb-4">
                                        <span className="material-symbols-outlined text-xl">{cat.icon}</span>
                                    </div>
                                    <h3 className="text-xl font-black text-white mb-2 leading-tight">{cat.title}</h3>
                                    <p className="text-white/60 text-xs line-clamp-2">{cat.desc}</p>
                                    <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400 group-hover:translate-x-1 transition-transform">
                                        Explore <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>

                    {/* ── Quick Topics ─────────────────────────────────────── */}
                    <section className="bg-white border border-gray-100 p-8 md:p-12 rounded-xl shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#6605c7]/[0.02] rounded-full -mr-16 -mt-16" />
                        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-12">
                            <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-[#6605c7]">
                                <span className="material-symbols-outlined text-xl">tag</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900 tracking-tight">Quick Topics</h2>
                                <p className="text-gray-400 text-xs">Jump directly to specialized discussion points</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
                            {[
                                {
                                    label: "Financial",
                                    icon: "wallet",
                                    topics: [
                                        { name: "EMI Planning", href: "/community/discussions?tag=EMI" },
                                        { name: "Bank Reviews", href: "/community/discussions?tag=Banks" },
                                        { name: "Rates", href: "/community/discussions?tag=Interest" },
                                    ],
                                },
                                {
                                    label: "Academic",
                                    icon: "history_edu",
                                    topics: [
                                        { name: "GRE Tips", href: "/community/discussions?category=GRE+%2F+GMAT" },
                                        { name: "SOP Review", href: "/community/discussions?tag=SOP" },
                                        { name: "IELTS", href: "/community/discussions?category=IELTS+%2F+TOEFL" },
                                    ],
                                },
                                {
                                    label: "Logistics",
                                    icon: "flight_takeoff",
                                    topics: [
                                        { name: "Visa Slots", href: "/community/discussions?category=Visa+%26+Immigration" },
                                        { name: "Housing", href: "/community/discussions?tag=Housing" },
                                        { name: "Departure", href: "/community/discussions?tag=Predeparture" },
                                    ],
                                },
                                {
                                    label: "Social",
                                    icon: "group",
                                    topics: [
                                        { name: "Meetups", href: "/community/discussions?tag=Meetups" },
                                        { name: "Part-time Jobs", href: "/community/discussions?category=Career+%26+Jobs" },
                                        { name: "Referral", href: "/referral" },
                                    ],
                                },
                            ].map((group) => (
                                <div key={group.label} className="space-y-4">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-[#6605c7] flex items-center gap-2 opacity-80">
                                        <span className="material-symbols-outlined text-sm">{group.icon}</span>
                                        {group.label}
                                    </h4>
                                    <div className="flex flex-wrap gap-1.5">
                                        {group.topics.map((t) => (
                                            <Link key={t.name} href={t.href} className="quick-topic">
                                                {t.name}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>

            {/* Create Post Modal */}
            <CreatePostModal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onCreated={() => {
                    setCreateOpen(false);
                    router.push("/community/discussions");
                }}
            />
        </main>
    );
}
