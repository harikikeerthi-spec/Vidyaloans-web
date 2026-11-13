"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { communityApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
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
    views?: number;
    isExpertOnly?: boolean;
}

interface Mentor {
    id: string;
    name: string;
    university?: string;
    country?: string;
    expertise?: string[];
    image?: string;
}

interface Event {
    id: string;
    title: string;
    date?: string;
    time?: string;
    type?: string;
    isFree?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseUtcDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    if (dateStr.endsWith("Z") || /[+-]\d{2}(:\d{2})?$/.test(dateStr)) {
        return new Date(dateStr);
    }
    const normalized = dateStr.replace(" ", "T") + "Z";
    const parsed = new Date(normalized);
    return isNaN(parsed.getTime()) ? new Date(dateStr) : parsed;
}

function timeAgo(date: string) {
    if (!date) return "";
    const parsed = parseUtcDate(date);
    const diff = (Date.now() - parsed.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function authorName(a: ForumPost["author"]): string {
    if (!a) return "Anonymous";
    if (typeof a === "string") return a;
    if ((a as any).firstName) return `${(a as any).firstName} ${(a as any).lastName || ""}`.trim();
    return (a as any).name || (a as any).email?.split("@")[0] || "Anonymous";
}

const MENTOR_TIPS = [
    "Connect with alumni from top universities worldwide for insider perspectives.",
    "Ask specific questions to get the most useful answers from mentors.",
    "Share your loan journey — it helps others navigate the same path.",
    "Follow trending topics to stay updated on visa and admission news.",
];

// ─── Inner Component (uses useSearchParams) ───────────────────────────────────
function DiscussionsInner() {
    const searchParams = useSearchParams();
    const { isAuthenticated } = useAuth();
    const initialCategory = searchParams.get("category") || "all";
    const initialTag = searchParams.get("tag") || "";

    const [posts, setPosts] = useState<ForumPost[]>([]);
    const [mentors, setMentors] = useState<Mentor[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [postsLoading, setPostsLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [category, setCategory] = useState(initialCategory);
    const [sort, setSort] = useState<"latest" | "popular">("latest");
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [mentorTip, setMentorTip] = useState(MENTOR_TIPS[0]);
    const LIMIT = 15;

    const CATEGORIES = [
        { id: "all", label: "All Topics", emoji: "💬" },
        { id: "Education Loans", label: "Loans & Finance", emoji: "💰" },
        { id: "Visa & Immigration", label: "Visa", emoji: "🛂" },
        { id: "Universities", label: "Universities", emoji: "🎓" },
        { id: "GRE / GMAT", label: "GRE / GMAT", emoji: "📝" },
        { id: "IELTS / TOEFL", label: "IELTS / TOEFL", emoji: "🗣️" },
        { id: "Career & Jobs", label: "Career", emoji: "💼" },
        { id: "General", label: "General", emoji: "🌐" },
    ];

    const fetchPosts = useCallback(
        async (reset = false) => {
            const off = reset ? 0 : offset;
            reset ? setPostsLoading(true) : setLoadingMore(true);
            try {
                const res: any = await communityApi.getForumPosts({
                    category: category === "all" ? undefined : category,
                    sort,
                    limit: LIMIT,
                    offset: off,
                });
                const list: ForumPost[] = Array.isArray(res) ? res : res?.data || [];
                if (reset) {
                    setPosts(list);
                    setOffset(LIMIT);
                } else {
                    setPosts((prev) => [...prev, ...list]);
                    setOffset(off + LIMIT);
                }
                setHasMore(list.length === LIMIT);
            } catch {
                if (reset) setPosts([]);
            } finally {
                setPostsLoading(false);
                setLoadingMore(false);
            }
        },
        [category, sort, offset]
    );

    useEffect(() => {
        setMentorTip(MENTOR_TIPS[Math.floor(Math.random() * MENTOR_TIPS.length)]);
    }, []);

    useEffect(() => {
        fetchPosts(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [category, sort]);

    useEffect(() => {
        communityApi
            .getMentors({ limit: 3 })
            .then((res: any) => setMentors(Array.isArray(res) ? res : res?.data || []))
            .catch(() => { });
        communityApi
            .getEvents({ limit: 3 })
            .then((res: any) => setEvents(Array.isArray(res) ? res : res?.data || []))
            .catch(() => { });
    }, []);

    const TRENDING_TAGS = [
        "#Education", "#StudyAbroad", "#StudentLoans", "#VisaUpdates",
        "#Scholarships", "#GREPrep", "#Masters2026", "#Admissions", "#LoanInterest",
    ];

    return (
        <main className="relative min-h-screen font-sans bg-transparent">
            {/* ── Styles ───────────────────────────────────────────────────── */}
            <style>{`
                .eng-glass { background:rgba(255,255,255,0.7); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.5); }
                .eng-tag { padding:6px 16px; border-radius:99px; background:white; border:1px solid rgba(0,0,0,0.05); font-size:11px; font-weight:700; color:#4b5563; transition:all 0.3s cubic-bezier(0.16,1,0.3,1); box-shadow:0 2px 5px rgba(0,0,0,0.02); white-space:nowrap; text-decoration:none; display:inline-block; }
                .eng-tag:hover { transform:translateY(-2px); background:#6605c7; color:white; border-color:#6605c7; box-shadow:0 8px 15px rgba(102,5,199,0.2); }
                .eng-cat-pill { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:9999px; border:1.5px solid #e5e7eb; background:white; font-size:13px; font-weight:600; color:#4b5563; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
                .eng-cat-pill:hover { border-color:#a855f7; color:#7c3aed; background:#faf5ff; }
                .eng-cat-pill.active { background:linear-gradient(135deg,#7c3aed,#6605c7); color:white; border-color:transparent; box-shadow:0 4px 10px rgba(124,58,237,0.3); }
                .eng-post-card { background:rgba(255,255,255,0.85); border:1.5px solid rgba(255,255,255,0.6); border-radius:24px; padding:20px 22px; transition:all 0.25s cubic-bezier(0.4,0,0.2,1); display:block; text-decoration:none; backdrop-filter:blur(10px); }
                .eng-post-card:hover { border-color:rgba(99,102,241,0.3); box-shadow:0 20px 40px -5px rgba(0,0,0,0.1); transform:translateY(-4px); }
                .eng-post-card.pinned { border-color:#fcd34d; background:linear-gradient(135deg,rgba(255,251,235,0.9),rgba(255,255,255,0.9)); }
                .eng-post-card.expert-only { border-color:#c4b5fd; background:linear-gradient(135deg,rgba(245,243,255,0.95),rgba(237,233,254,0.9)); }
                .eng-avatar { border-radius:50%; background:linear-gradient(135deg,#7c3aed,#a855f7); display:flex; align-items:center; justify-content:center; color:white; font-weight:800; flex-shrink:0; }
                .eng-badge { display:inline-block; padding:3px 9px; border-radius:9999px; font-size:10.5px; font-weight:700; }
                .eng-cat-badge { background:#f3e8ff; color:#7e22ce; }
                .eng-pin-badge { background:#fef3c7; color:#b45309; }
                .eng-hash-badge { background:#f0fdf4; color:#15803d; }
                .eng-fab { position:fixed; bottom:28px; right:28px; background:linear-gradient(135deg,#0d9488,#c026d3); color:white; border:none; border-radius:9999px; padding:14px 24px; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 8px 24px rgba(102,5,199,0.35); display:flex; align-items:center; gap:8px; z-index:50; transition:all 0.2s; }
                .eng-fab:hover { transform:translateY(-2px); box-shadow:0 12px 32px rgba(102,5,199,0.45); }
                .skeleton { background:linear-gradient(90deg,rgba(255,255,255,0.6) 25%,rgba(255,255,255,0.3) 50%,rgba(255,255,255,0.6) 75%); background-size:200% 100%; animation:shimmer 1.2s infinite; border-radius:24px; }
                @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
                .load-more-btn { width:100%; padding:13px; border:1.5px solid #e9d5ff; background:#faf5ff; border-radius:12px; color:#7c3aed; font-weight:700; font-size:14px; cursor:pointer; transition:all 0.2s; margin-top:16px; }
                .load-more-btn:hover { background:#f3e8ff; }
                .sidebar-widget { background:rgba(255,255,255,0.7); backdrop-filter:blur(20px); border:1px solid rgba(255,255,255,0.5); border-radius:24px; padding:24px; }
                .sidebar-widget:hover { border-color:rgba(102,5,199,0.2); transition:border-color 0.2s; }
                .post-btn { width:100%; padding:12px; border-radius:14px; background:linear-gradient(to right,#0d9488,#c026d3); color:white; font-weight:700; font-size:14px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; box-shadow:0 4px 15px rgba(13,148,136,0.3); }
                .post-btn:hover { transform:translateY(-1px); box-shadow:0 8px 20px rgba(13,148,136,0.4); }
                .no-scrollbar { -ms-overflow-style:none; scrollbar-width:none; }
                .no-scrollbar::-webkit-scrollbar { display:none; }
                .live-dot { animation: ping 1s cubic-bezier(0,0,0.2,1) infinite; }
                @keyframes ping { 75%,100% { transform:scale(2); opacity:0; } }
            `}</style>

            <div className="relative z-10 pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">

                {/* ── Page Header ─────────────────────────────────────────── */}
                <div className="mb-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-2">
                            <Link
                                href="/community"
                                className="text-xs font-bold uppercase tracking-widest"
                                style={{ color: "#6605c7", textDecoration: "none" }}
                            >
                                ← Community Hub
                            </Link>
                            <h1
                                className="text-5xl md:text-6xl font-bold"
                                style={{
                                    fontFamily: "'Noto Serif', serif",
                                    background: "linear-gradient(to right,#111827,#4b5563)",
                                    WebkitBackgroundClip: "text",
                                    WebkitTextFillColor: "transparent",
                                }}
                            >
                                Discussions
                            </h1>
                            <p className="text-lg text-gray-600 max-w-2xl leading-relaxed">
                                Join the community — ask questions from mentors, share your journey, and help
                                others.
                            </p>
                        </div>

                        {/* Quick stats */}
                        <div className="flex gap-4">
                            <div className="eng-glass p-4 rounded-2xl min-w-[110px] text-center">
                                <span className="block text-2xl font-bold" style={{ color: "#0d9488", fontFamily: "'Noto Serif', serif" }}>
                                    {posts.length}+
                                </span>
                                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Loaded</span>
                            </div>
                            <div className="eng-glass p-4 rounded-2xl min-w-[110px] text-center">
                                <span className="block text-2xl font-bold" style={{ color: "#c026d3", fontFamily: "'Noto Serif', serif" }}>
                                    Live
                                </span>
                                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Updates</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Trending Tags ────────────────────────────────────────── */}
                <div className="flex items-center gap-4 mb-8 overflow-hidden">
                    <div
                        className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-2xl"
                        style={{ background: "rgba(102,5,199,0.1)", border: "1px solid rgba(102,5,199,0.2)" }}
                    >
                        <span style={{ color: "#6605c7" }}>🔥</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#6605c7" }}>
                            Trending
                        </span>
                    </div>
                    <div className="flex flex-wrap gap-3 overflow-x-auto no-scrollbar pb-1 flex-1">
                        {TRENDING_TAGS.map((tag) => (
                            <Link
                                key={tag}
                                href={`/community/discussions?tag=${tag.replace("#", "")}`}
                                className="eng-tag"
                            >
                                {tag}
                            </Link>
                        ))}
                    </div>
                </div>

                {/* ── Main 3-col Layout ────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* ─── Left Sidebar ──────────────────────────────────────── */}
                    <div className="hidden lg:block lg:col-span-3 sticky top-32 space-y-6">

                        {/* Post CTA */}
                        <div className="sidebar-widget relative overflow-hidden group">
                            <div className="text-center relative z-10">
                                <div
                                    className="w-16 h-16 mx-auto mb-4 rounded-full p-0.5"
                                    style={{ background: "linear-gradient(135deg,#0d9488,#c026d3)" }}
                                >
                                    <div
                                        className="w-full h-full bg-white rounded-full flex items-center justify-center"
                                        style={{ fontSize: 28 }}
                                    >
                                        ✍️
                                    </div>
                                </div>
                                <h3 className="font-bold text-gray-900 mb-1">Have a Question?</h3>
                                <p className="text-xs text-gray-500 mb-4">Get answers from mentors & peers</p>
                                <button
                                    className="post-btn"
                                    onClick={() => {
                                        if (!isAuthenticated) {
                                            window.location.href = "/login";
                                            return;
                                        }
                                        setCreateOpen(true);
                                    }}
                                >
                                    ✏️ Post a New Question
                                </button>
                            </div>
                            <div
                                className="absolute inset-0 rounded-3xl -z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                style={{ background: "linear-gradient(135deg,rgba(13,148,136,0.05),rgba(192,38,211,0.05))" }}
                            />
                        </div>

                        {/* Mentor Tips */}
                        <div className="sidebar-widget relative overflow-hidden group">
                            <div className="relative z-10">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-xl"
                                    style={{ background: "rgba(249,115,22,0.1)", color: "#ea580c" }}
                                >
                                    💡
                                </div>
                                <h3 className="font-bold text-lg mb-2" style={{ fontFamily: "'Noto Serif', serif" }}>
                                    Mentor Tips
                                </h3>
                                <p className="text-sm text-gray-600 leading-relaxed">{mentorTip}</p>
                            </div>
                            <div
                                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                style={{ background: "linear-gradient(135deg,rgba(13,148,136,0.05),rgba(192,38,211,0.05))" }}
                            />
                        </div>

                        {/* AI Moderator */}
                        <div className="sidebar-widget relative overflow-hidden">
                            <div
                                className="absolute inset-0"
                                style={{ background: "linear-gradient(135deg,rgba(13,148,136,0.03),transparent)" }}
                            />
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div
                                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                                        style={{ background: "rgba(13,148,136,0.1)", color: "#0d9488" }}
                                    >
                                        🧠
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-sm">AI Moderator</h3>
                                        <p className="text-[10px] text-green-500 font-bold uppercase tracking-wider">
                                            Active Curation
                                        </p>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    Every discussion is cross-checked by our AI to ensure it stays relevant to{" "}
                                    <strong>Education &amp; Loans</strong>.
                                </p>
                                <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                                    <div className="flex justify-between items-center text-[10px] font-bold text-gray-500">
                                        <span>Topic Relevance</span>
                                        <span style={{ color: "#0d9488" }}>99.8%</span>
                                    </div>
                                    <div
                                        className="w-full rounded-full mt-1.5 overflow-hidden"
                                        style={{ height: 4, background: "rgba(0,0,0,0.06)" }}
                                    >
                                        <div
                                            className="h-full rounded-full"
                                            style={{ width: "99.8%", background: "#0d9488" }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ─── Main Feed ─────────────────────────────────────────── */}
                    <div className="lg:col-span-6 space-y-6">

                        {/* Category pills */}
                        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }} className="no-scrollbar">
                            {CATEGORIES.map((c) => (
                                <button
                                    key={c.id}
                                    className={`eng-cat-pill ${category === c.id ? "active" : ""}`}
                                    onClick={() => setCategory(c.id)}
                                >
                                    <span>{c.emoji}</span>
                                    <span>{c.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Feed header + sort */}
                        <div className="flex items-center justify-between px-1">
                            <h2 className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: "'Noto Serif', serif", color: "#111827" }}>
                                Discussion Feed
                                <span className="flex h-2 w-2 relative">
                                    <span
                                        className="live-dot absolute inline-flex h-full w-full rounded-full"
                                        style={{ background: "#0d9488", opacity: 0.75 }}
                                    />
                                    <span
                                        className="relative inline-flex rounded-full h-2 w-2"
                                        style={{ background: "#0d9488" }}
                                    />
                                </span>
                            </h2>
                            <div className="flex gap-2">
                                {(["latest", "popular"] as const).map((s) => (
                                    <button
                                        key={s}
                                        className={`eng-cat-pill ${sort === s ? "active" : ""}`}
                                        style={{ padding: "6px 16px", fontSize: 12 }}
                                        onClick={() => setSort(s)}
                                    >
                                        {s.charAt(0).toUpperCase() + s.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Posts */}
                        <div className="space-y-4">
                            {postsLoading ? (
                                [1, 2, 3, 4].map((i) => (
                                    <div key={i} className="skeleton" style={{ height: 120 }} />
                                ))
                            ) : posts.length === 0 ? (
                                <div
                                    className="text-center py-16"
                                    style={{
                                        background: "rgba(255,255,255,0.7)",
                                        borderRadius: 24,
                                        border: "1.5px dashed #e9d5ff",
                                    }}
                                >
                                    <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                                    <div style={{ fontWeight: 700, color: "#4c1d95", fontSize: 18, marginBottom: 6 }}>
                                        No discussions yet in this topic
                                    </div>
                                    <div style={{ color: "#9ca3af", fontSize: 14, marginBottom: 20 }}>
                                        Be the first to start a conversation!
                                    </div>
                                    <button
                                        className="post-btn"
                                        style={{ display: "inline-flex", width: "auto", padding: "12px 24px" }}
                                        onClick={() => setCreateOpen(true)}
                                    >
                                        ✏️ Post a Question
                                    </button>
                                </div>
                            ) : (
                                [...posts].sort((a, b) => {
                                    // Pinned posts first
                                    if (a.isPinned && !b.isPinned) return -1;
                                    if (!a.isPinned && b.isPinned) return 1;
                                    // Expert-only posts second
                                    if (a.isExpertOnly && !b.isExpertOnly) return -1;
                                    if (!a.isExpertOnly && b.isExpertOnly) return 1;
                                    return 0;
                                }).map((post) => (
                                    <Link
                                        key={post.id}
                                        href={`/community/discussions/${post.id}`}
                                        className={`eng-post-card ${post.isPinned ? "pinned" : ""} ${post.isExpertOnly ? "expert-only" : ""}`}
                                    >
                                        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                                            <div
                                                className="eng-avatar"
                                                style={{ width: 44, height: 44, fontSize: 16 }}
                                            >
                                                {authorName(post.author).charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                {/* Tags row */}
                                                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                                                    {post.isPinned && (
                                                        <span className="eng-badge eng-pin-badge">📌 Pinned</span>
                                                    )}
                                                    {post.isExpertOnly && (
                                                        <span className="eng-badge" style={{ background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", color: "#6d28d9", border: "1px solid #c4b5fd" }}>🎓 Expert Only</span>
                                                    )}
                                                    {post.category && (
                                                        <span className="eng-badge eng-cat-badge">{post.category}</span>
                                                    )}
                                                    {post.tags?.slice(0, 2).map((t) => (
                                                        <span key={t} className="eng-badge eng-hash-badge">
                                                            #{t}
                                                        </span>
                                                    ))}
                                                </div>
                                                <h3
                                                    style={{
                                                        fontWeight: 700,
                                                        fontSize: 15,
                                                        color: "#1a1a2e",
                                                        lineHeight: 1.4,
                                                        marginBottom: 5,
                                                    }}
                                                >
                                                    {post.title}
                                                </h3>
                                                <p
                                                    style={{
                                                        fontSize: 13,
                                                        color: "#6b7280",
                                                        lineHeight: 1.55,
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: "vertical",
                                                        overflow: "hidden",
                                                        marginBottom: 10,
                                                    }}
                                                >
                                                    {post.content}
                                                </p>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 10,
                                                        fontSize: 12,
                                                        color: "#9ca3af",
                                                    }}
                                                >
                                                    <span style={{ fontWeight: 600, color: "#4b5563" }}>
                                                        {authorName(post.author)}
                                                    </span>
                                                    <span>·</span>
                                                    <span>{post.createdAt ? timeAgo(post.createdAt) : ""}</span>
                                                    <span>·</span>
                                                    <span>👍 {post.likeCount ?? 0}</span>
                                                    <span>·</span>
                                                    <span>
                                                        💬 {post.commentCount ?? post._count?.comments ?? 0}
                                                    </span>
                                                    {(post.views ?? 0) > 0 && (
                                                        <>
                                                            <span>·</span>
                                                            <span>👁 {post.views}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <svg
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="#d1d5db"
                                                strokeWidth="2"
                                                style={{ width: 18, height: 18, flexShrink: 0 }}
                                            >
                                                <path d="M9 18l6-6-6-6" />
                                            </svg>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>

                        {/* Load more */}
                        {hasMore && !postsLoading && posts.length > 0 && (
                            <button
                                className="load-more-btn"
                                onClick={() => fetchPosts(false)}
                                disabled={loadingMore}
                            >
                                {loadingMore ? "Loading…" : "Load more discussions"}
                            </button>
                        )}
                    </div>

                    {/* ─── Right Sidebar ─────────────────────────────────────── */}
                    <div className="lg:col-span-3 space-y-6">

                        {/* Top Mentors */}
                        {mentors.length > 0 && (
                            <div className="sidebar-widget">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-bold text-gray-900">Top Mentors</h3>
                                    <Link
                                        href="/community/mentors"
                                        className="text-xs font-bold hover:underline"
                                        style={{ color: "#0d9488" }}
                                    >
                                        View All
                                    </Link>
                                </div>
                                <div className="space-y-4">
                                    {mentors.map((m) => (
                                        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            <div
                                                className="eng-avatar"
                                                style={{ width: 40, height: 40, fontSize: 15 }}
                                            >
                                                {m.name.charAt(0)}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e" }}>
                                                    {m.name}
                                                </div>
                                                <div style={{ fontSize: 11.5, color: "#6b7280" }}>
                                                    {m.university || "University"} · {m.country}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Ask the Mentor Widget */}
                        <div className="sidebar-widget relative overflow-hidden group" style={{ background: "linear-gradient(135deg, rgba(102,5,199,0.03), rgba(13,148,136,0.03))" }}>
                            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] opacity-40" style={{ background: "linear-gradient(135deg, #7c3aed, #0d9488)" }} />
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div
                                        className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                                        style={{ background: "linear-gradient(135deg, #7c3aed, #6605c7)", boxShadow: "0 6px 20px rgba(102,5,199,0.3)" }}
                                    >
                                        🎓
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900" style={{ fontFamily: "'Noto Serif', serif" }}>
                                            Ask a Mentor
                                        </h3>
                                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#0d9488" }}>Expert Answers Only</p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                                    Get personalized guidance from verified students and alumni at top universities.
                                </p>
                                <ul className="space-y-2 mb-5">
                                    <li className="flex items-center gap-2 text-xs text-gray-600">
                                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: "rgba(102,5,199,0.1)", color: "#6605c7" }}>✓</span>
                                        Verified mentors only reply
                                    </li>
                                    <li className="flex items-center gap-2 text-xs text-gray-600">
                                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: "rgba(102,5,199,0.1)", color: "#6605c7" }}>✓</span>
                                        Priority in mentor queues
                                    </li>
                                    <li className="flex items-center gap-2 text-xs text-gray-600">
                                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]" style={{ background: "rgba(102,5,199,0.1)", color: "#6605c7" }}>✓</span>
                                        Expert-level insights
                                    </li>
                                </ul>
                                <button
                                    onClick={() => {
                                        if (!isAuthenticated) {
                                            window.location.href = "/login";
                                            return;
                                        }
                                        setCreateOpen(true);
                                    }}
                                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:-translate-y-0.5"
                                    style={{ background: "linear-gradient(135deg, #7c3aed, #6605c7)", color: "white", boxShadow: "0 4px 15px rgba(102,5,199,0.25)" }}
                                >
                                    <span>🎓</span> Ask an Expert Now
                                </button>
                                <p className="text-[10px] text-center text-gray-400 mt-3">
                                    Toggle "Ask the Expert" when posting
                                </p>
                            </div>
                        </div>

                        {/* Upcoming Events */}
                        {/* <div className="sidebar-widget">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span style={{ color: "#6605c7" }}>📅</span>
                                    <h3 className="font-bold text-gray-900" style={{ fontFamily: "'Noto Serif', serif" }}>
                                        Upcoming
                                    </h3>
                                </div>
                                <Link
                                    href="/community/events"
                                    className="text-xs font-bold hover:underline"
                                    style={{ color: "#6605c7" }}
                                >
                                    View All
                                </Link>
                            </div>
                            {events.length > 0 ? (
                                <div className="space-y-4">
                                    {events.map((ev) => (
                                        <Link
                                            key={ev.id}
                                            href="/community/events"
                                            style={{
                                                display: "flex",
                                                gap: 12,
                                                alignItems: "center",
                                                textDecoration: "none",
                                            }}
                                        >
                                            <div
                                                className="flex-shrink-0 text-center rounded-2xl p-2"
                                                style={{
                                                    width: 48,
                                                    background: "rgba(102,5,199,0.05)",
                                                    border: "1px solid rgba(102,5,199,0.1)",
                                                }}
                                            >
                                                <span
                                                    className="block text-[10px] font-bold uppercase tracking-wider"
                                                    style={{ color: "#6605c7" }}
                                                >
                                                    {ev.date
                                                        ? new Date(ev.date).toLocaleDateString("en-US", { month: "short" })
                                                        : "TBD"}
                                                </span>
                                                <span
                                                    className="block text-xl font-bold leading-none mt-0.5"
                                                    style={{ color: "#1a1a2e", fontFamily: "'Noto Serif', serif" }}
                                                >
                                                    {ev.date ? new Date(ev.date).getDate() : "--"}
                                                </span>
                                            </div>
                                            <div>
                                                <h4
                                                    style={{
                                                        fontSize: 13,
                                                        fontWeight: 700,
                                                        color: "#1a1a2e",
                                                        lineHeight: 1.4,
                                                        marginBottom: 3,
                                                    }}
                                                >
                                                    {ev.title}
                                                </h4>
                                                <p
                                                    style={{
                                                        fontSize: 11,
                                                        color: "#6b7280",
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 4,
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            width: 6,
                                                            height: 6,
                                                            borderRadius: "50%",
                                                            background: "#22c55e",
                                                            display: "inline-block",
                                                        }}
                                                    />
                                                    Online{ev.time ? ` · ${ev.time}` : ""}
                                                    {ev.isFree ? " · Free" : ""}
                                                </p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : (
                                <div
                                    style={{
                                        display: "flex",
                                        gap: 12,
                                        alignItems: "center",
                                    }}
                                >
                                    <div
                                        className="flex-shrink-0 text-center rounded-2xl p-2"
                                        style={{
                                            width: 48,
                                            background: "rgba(102,5,199,0.05)",
                                            border: "1px solid rgba(102,5,199,0.1)",
                                        }}
                                    >
                                        <span
                                            className="block text-[10px] font-bold uppercase tracking-wider"
                                            style={{ color: "#6605c7" }}
                                        >
                                            Mar
                                        </span>
                                        <span
                                            className="block text-xl font-bold leading-none mt-0.5"
                                            style={{ color: "#1a1a2e" }}
                                        >
                                            15
                                        </span>
                                    </div>
                                    <div>
                                        <h4 style={{ fontSize: 13, fontWeight: 700, color: "#1a1a2e", marginBottom: 3 }}>
                                            Study Abroad: Visa & Loan Webinar
                                        </h4>
                                        <p style={{ fontSize: 11, color: "#6b7280" }}>🟢 Online · Free</p>
                                    </div>
                                </div>
                            )}
                        </div> */}

                        {/* Explore More Topics */}
                        <div className="sidebar-widget">
                            <div className="flex items-center gap-3 mb-4">
                                <div
                                    className="p-3 rounded-2xl flex items-center justify-center text-xl"
                                    style={{ background: "linear-gradient(135deg,rgba(13,148,136,0.1),rgba(192,38,211,0.1))", color: "#0d9488" }}
                                >
                                    🗂️
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900" style={{ fontFamily: "'Noto Serif', serif" }}>
                                        More Topics
                                    </h3>
                                    <p className="text-xs text-gray-500">Explore all categories</p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                                Discover more communities, from university groups to scholarship discussions.
                            </p>
                            <Link
                                href="/community"
                                className="flex items-center justify-between w-full p-3 rounded-xl transition-all group"
                                style={{
                                    background: "rgba(102,5,199,0.04)",
                                    border: "1px solid rgba(102,5,199,0.1)",
                                    textDecoration: "none",
                                }}
                            >
                                <span className="text-sm font-bold text-gray-700">View Community Hub</span>
                                <span style={{ color: "#6605c7" }}>→</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Floating Action Button ──────────────────────────────────── */}
            <button className="eng-fab" onClick={() => setCreateOpen(true)}>
                ✏️ Post Question
            </button>

            {/* Create Post Modal */}
            <CreatePostModal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onCreated={() => {
                    setCreateOpen(false);
                    fetchPosts(true);
                }}
            />
        </main>
    );
}

// ─── Default export wrapped in Suspense (for useSearchParams) ─────────────────
export default function DiscussionsPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-transparent">
                <div style={{ width: 40, height: 40, border: "3px solid #e9d5ff", borderTopColor: "#6605c7", borderRadius: "50%", animation: "spin 0.9s linear infinite" }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
        }>
            <DiscussionsInner />
        </Suspense>
    );
}
