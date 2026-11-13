"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { communityApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Author {
    id?: string;
    firstName?: string;
    lastName?: string;
    name?: string;
    email?: string;
}

interface Comment {
    id: string;
    content: string;
    author?: Author | string;
    createdAt?: string;
    likeCount?: number;
    _count?: { likes?: number };
    replies?: Comment[];
    parentId?: string;
    isLiked?: boolean;
}

interface Post {
    id: string;
    title: string;
    content: string;
    category?: string;
    tags?: string[];
    author?: Author | string;
    createdAt?: string;
    updatedAt?: string;
    likeCount?: number;
    commentCount?: number;
    views?: number;
    isPinned?: boolean;
    isLiked?: boolean;
    isExpertOnly?: boolean;
    _count?: { likes?: number; comments?: number };
    comments?: Comment[];
}

interface SimilarPost {
    id: string;
    title: string;
    category?: string;
    createdAt?: string;
    commentCount?: number;
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

function authorName(a: Post["author"]): string {
    if (!a) return "Anonymous";
    if (typeof a === "string") return a;
    if ((a as any).firstName) return `${(a as any).firstName} ${(a as any).lastName || ""}`.trim();
    return (a as any).name || (a as any).email?.split("@")[0] || "Anonymous";
}

function authorInitial(a: Post["author"]): string {
    return authorName(a).charAt(0).toUpperCase();
}

// ─── Comment Component ────────────────────────────────────────────────────────
function CommentItem({
    comment,
    postId,
    depth = 0,
    onReplyPosted,
}: {
    comment: Comment;
    postId: string;
    depth?: number;
    onReplyPosted: () => void;
}) {
    const [showReply, setShowReply] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [posting, setPosting] = useState(false);
    const [liked, setLiked] = useState(comment.isLiked ?? false);
    const [likeCount, setLikeCount] = useState(comment.likeCount ?? comment._count?.likes ?? 0);

    const name = authorName(comment.author);

    const handleLike = async () => {
        try {
            await communityApi.likeForumComment(comment.id);
            setLiked((l) => !l);
            setLikeCount((c) => (liked ? c - 1 : c + 1));
        } catch {
            // ignore
        }
    };

    const submitReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim()) return;
        setPosting(true);
        try {
            await communityApi.addForumComment(postId, replyText.trim(), comment.id);
            setReplyText("");
            setShowReply(false);
            onReplyPosted();
        } catch {
            alert("Please log in to reply.");
        } finally {
            setPosting(false);
        }
    };

    return (
        <div className={`flex gap-4 mb-6 ${depth > 0 ? "ml-8 md:ml-12" : ""}`}>
            <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
            >
                {name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
                <div
                    className={`p-5 rounded-2xl relative ${depth > 0 ? "bg-white/40" : "bg-white/70"
                        } border border-white/50 backdrop-blur-sm`}
                >
                    <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-gray-900 text-sm">{name}</span>
                        <span className="text-[11px] text-gray-500 font-medium">
                            {comment.createdAt ? timeAgo(comment.createdAt) : ""}
                        </span>
                    </div>
                    <p className="text-[14.5px] text-gray-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>

                    <div className="flex items-center gap-6 mt-4">
                        <button
                            onClick={handleLike}
                            className={`flex items-center gap-2 text-[12px] font-bold transition-colors ${liked ? "text-[#7c3aed]" : "text-gray-400 hover:text-gray-600"
                                }`}
                        >
                            <span>👍</span>
                            <span>{likeCount > 0 ? likeCount : ""} Like</span>
                        </button>
                        {depth === 0 && (
                            <button
                                onClick={() => setShowReply((s) => !s)}
                                className="text-[12px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                Reply
                            </button>
                        )}
                    </div>
                </div>

                {showReply && (
                    <form onSubmit={submitReply} className="mt-4 flex gap-3">
                        <input
                            autoFocus
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Write a reply..."
                            className="flex-1 px-4 py-2 rounded-xl border border-white/50 bg-white/70 backdrop-blur-md text-sm outline-none focus:border-[#7c3aed]"
                        />
                        <button
                            type="submit"
                            disabled={posting}
                            className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6605c7] text-white font-bold text-xs"
                        >
                            {posting ? "..." : "Reply"}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowReply(false)}
                            className="px-3 py-2 rounded-xl border border-gray-200 text-gray-500"
                        >
                            ✕
                        </button>
                    </form>
                )}

                {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-4">
                        {comment.replies.map((reply) => (
                            <CommentItem
                                key={reply.id}
                                comment={reply}
                                postId={postId}
                                depth={depth + 1}
                                onReplyPosted={onReplyPosted}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DiscussionDetailPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { isAuthenticated } = useAuth();

    const [post, setPost] = useState<Post | null>(null);
    const [similarPosts, setSimilarPosts] = useState<SimilarPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const [comment, setComment] = useState("");
    const [postingComment, setPostingComment] = useState(false);
    const [commentError, setCommentError] = useState<string | null>(null);
    const commentInputRef = useRef<HTMLTextAreaElement>(null);

    const loadPost = async () => {
        try {
            const res: any = await communityApi.getForumPost(id);
            const data: Post = res?.data || res?.post || res;
            setPost(data);
            setLiked(data.isLiked ?? false);
            setLikeCount(data.likeCount ?? data._count?.likes ?? 0);

            // Load similar posts based on title
            if (data?.title) {
                communityApi.searchSimilarPosts(data.title).then((sRes: any) => {
                    const list = (sRes?.data || []).filter((p: any) => p.id !== id).slice(0, 3);
                    setSimilarPosts(list);
                });
            }
        } catch {
            setPost(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPost();
    }, [id]);

    const handleLike = async () => {
        if (!isAuthenticated) {
            router.push("/login");
            return;
        }
        try {
            await communityApi.likeForumPost(id);
            setLiked((l) => !l);
            setLikeCount((c) => (liked ? c - 1 : c + 1));
        } catch {
            // ignore
        }
    };

    const submitComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!comment.trim()) return;
        if (!isAuthenticated) {
            setCommentError("Please log in to post a reply.");
            return;
        }
        setPostingComment(true);
        setCommentError(null);
        try {
            await communityApi.addForumComment(id, comment.trim());
            setComment("");
            await loadPost();
        } catch (err: any) {
            setCommentError(err?.message || "Something went wrong. Please try again.");
        } finally {
            setPostingComment(false);
        }
    };

    const handleShare = () => {
        if (navigator.share && post) {
            navigator.share({ title: post.title, url: window.location.href }).catch(() => { });
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert("Link copied to clipboard!");
        }
    };

    if (loading) {
        return (
            <main className="min-h-screen pt-32 pb-20 bg-transparent">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12">
                    <div className="lg:col-span-8 space-y-8">
                        <div className="h-64 rounded-[2.5rem] bg-white/40 animate-pulse border border-white/50" />
                        <div className="h-96 rounded-[2.5rem] bg-white/40 animate-pulse border border-white/50" />
                    </div>
                </div>
            </main>
        );
    }

    if (!post) {
        return (
            <main className="min-h-screen pt-32 pb-20 flex items-center justify-center text-center bg-transparent">
                <div className="max-w-md px-6">
                    <div className="text-6xl mb-6">🔍</div>
                    <h2 className="text-3xl font-bold mb-4" style={{ fontFamily: "'Noto Serif', serif" }}>
                        Discussion Not Found
                    </h2>
                    <p className="text-gray-500 mb-8">
                        The discussion you're looking for might have been moved or removed by the moderator.
                    </p>
                    <Link
                        href="/community/discussions"
                        className="px-8 py-3 rounded-2xl bg-gradient-to-r from-[#7c3aed] to-[#6605c7] text-white font-bold inline-block"
                    >
                        Back to Community
                    </Link>
                </div>
            </main>
        );
    }

    const comments: Comment[] = post.comments || [];
    const topLevelComments = comments.filter((c) => !c.parentId);

    return (
        <main className="relative min-h-screen font-sans bg-transparent">
            <style>{`
                .det-glass { background: rgba(255,255,255,0.7); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.5); }
                .det-badge { display:inline-block; padding:3px 10px; border-radius:9999px; font-size:10.5px; font-weight:700; background:#f3e8ff; color:#7e22ce; }
                .det-action-btn { display:flex; align-items:center; gap:8px; padding:10px 20px; border-radius:99px; background:white; border:1.5px solid rgba(0,0,0,0.05); font-size:13px; font-weight:700; color:#4b5563; transition:all 0.2s; box-shadow:0 4px 10px rgba(0,0,0,0.02); }
                .det-action-btn:hover { border-color:#a855f7; color:#7c3aed; transform:translateY(-1px); }
                .det-action-btn.active { background:linear-gradient(135deg,#7c3aed,#6605c7); color:white; border-color:transparent; box-shadow:0 8px 20px rgba(102,5,199,0.3); }
                .post-btn { width:100%; padding:14px; border-radius:18px; background:linear-gradient(to right,#7c3aed,#6605c7); color:white; font-weight:700; font-size:14px; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:8px; transition:all 0.2s; box-shadow:0 6px 20px rgba(102,5,199,0.25); }
                .post-btn:hover { transform:translateY(-1px); box-shadow:0 10px 25px rgba(102,5,199,0.35); }
            `}</style>

            <div className="relative z-10 pt-32 pb-24 max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                    {/* ── Left Content (Post + Comments) ──────────────────────── */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Breadcrumbs */}
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                            <Link href="/community" className="hover:text-[#6605c7]">Community</Link>
                            <span>/</span>
                            <Link href="/community/discussions" className="hover:text-[#6605c7]">Discussions</Link>
                            {post.category && (
                                <>
                                    <span>/</span>
                                    <span className="text-[#6605c7]">{post.category}</span>
                                </>
                            )}
                        </div>

                        {/* Main Discussion Card */}
                        <div className="det-glass p-8 md:p-12 rounded-[3.5rem] relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex items-center gap-4 mb-8">
                                    <div
                                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl"
                                        style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
                                    >
                                        {authorInitial(post.author)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-lg">{authorName(post.author)}</h4>
                                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                                            Posted {post.createdAt ? timeAgo(post.createdAt) : ""}
                                        </p>
                                    </div>
                                    <div className="ml-auto flex items-center gap-2">
                                        {post.isExpertOnly && (
                                            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest" style={{ background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", color: "#6d28d9", border: "1px solid #c4b5fd" }}>
                                                🎓 Expert Only
                                            </span>
                                        )}
                                        {post.isPinned && (
                                            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold uppercase tracking-widest">
                                                📌 Pinned
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <h1
                                    className="text-3xl md:text-5xl font-bold mb-8 leading-tight text-gray-900"
                                    style={{ fontFamily: "'Noto Serif', serif" }}
                                >
                                    {post.title}
                                </h1>

                                <div className="text-[16px] md:text-lg text-gray-700 leading-relaxed space-y-6 mb-12 whitespace-pre-wrap">
                                    {post.content}
                                </div>

                                {/* Tags */}
                                {post.tags && post.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mb-10">
                                        {post.tags.map((t) => (
                                            <span key={t} className="px-4 py-1.5 rounded-full bg-white/50 border border-white/80 text-[11px] font-bold text-indigo-600">
                                                #{t}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Action Bar */}
                                <div className="flex flex-wrap items-center gap-4 pt-8 border-t border-black/5">
                                    <button
                                        className={`det-action-btn ${liked ? "active" : ""}`}
                                        onClick={handleLike}
                                    >
                                        <span>👍</span>
                                        <span>{likeCount} Likes</span>
                                    </button>
                                    <button
                                        className="det-action-btn"
                                        onClick={() => commentInputRef.current?.focus()}
                                    >
                                        <span>💬</span>
                                        <span>{post.commentCount ?? post._count?.comments ?? comments.length} Replies</span>
                                    </button>
                                    <button className="det-action-btn" onClick={handleShare}>
                                        <span>🔗</span>
                                        <span>Share</span>
                                    </button>
                                    <span className="ml-auto text-xs font-bold text-gray-400">
                                        👁 {post.views ?? 0} Views
                                    </span>
                                </div>
                            </div>

                            {/* Decorative blur */}
                            <div
                                className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px]"
                                style={{ background: "rgba(102,5,199,0.05)" }}
                            />
                        </div>

                        {/* Comments Section */}
                        <div className="det-glass p-8 md:p-12 rounded-[3.5rem]">
                            <h2
                                className="text-3xl font-bold mb-10"
                                style={{ fontFamily: "'Noto Serif', serif" }}
                            >
                                Community <span className="text-[#6605c7]">Insights</span>
                                <span className="text-sm text-gray-400 font-sans ml-4 font-bold uppercase tracking-widest">
                                    {comments.length} Replies
                                </span>
                            </h2>

                            {/* Post a Reply Form */}
                            {post.isExpertOnly ? (
                                <div className="mb-12 p-8 rounded-3xl text-center" style={{ background: "linear-gradient(135deg, #f5f3ff, #ede9fe)", border: "1.5px solid #c4b5fd" }}>
                                    <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-3xl" style={{ background: "linear-gradient(135deg, #7c3aed, #6605c7)" }}>
                                        🎓
                                    </div>
                                    <h3 className="font-bold text-lg text-gray-900 mb-2">Expert Only Question</h3>
                                    <p className="text-sm text-gray-600 mb-4">This question is marked for expert answers only. Only verified mentors can reply to this discussion.</p>
                                    <Link href="/community/mentors" className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-[#6605c7] font-bold text-sm hover:shadow-lg transition-all">
                                        <span>👥</span> Browse Our Mentors
                                    </Link>
                                </div>
                            ) : (
                                <form onSubmit={submitComment} className="mb-12 relative">
                                    <textarea
                                        ref={commentInputRef}
                                        value={comment}
                                        onChange={(e) => setComment(e.target.value)}
                                        placeholder="Share your thoughts, experiences, or a helpful answer..."
                                        className="w-full p-6 pb-20 rounded-3xl bg-white/50 border border-white/80 backdrop-blur-md outline-none focus:border-[#a855f7] transition-all text-gray-800 leading-relaxed resize-none"
                                        rows={4}
                                    />
                                    {commentError && (
                                        <p className="text-xs font-bold text-red-500 mt-2 ml-4">⚠️ {commentError}</p>
                                    )}
                                    <div className="absolute bottom-4 right-4">
                                        <button
                                            type="submit"
                                            disabled={postingComment || !comment.trim()}
                                            className="post-btn px-8"
                                        >
                                            {postingComment ? "..." : "📤 Post Reply"}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {/* Comments List */}
                            <div className="space-y-4">
                                {topLevelComments.length === 0 ? (
                                    <div className="text-center py-16 bg-white/30 rounded-[3rem] border border-dashed border-gray-200">
                                        <div className="text-5xl mb-4">💬</div>
                                        <h3 className="font-bold text-gray-400">No replies yet. Be the first!</h3>
                                    </div>
                                ) : (
                                    topLevelComments.map((c) => (
                                        <CommentItem key={c.id} comment={c} postId={id} onReplyPosted={loadPost} />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* ── Right Sidebar ─────────────────────────────────────── */}
                    <div className="lg:col-span-4 space-y-8 sticky top-32">
                        {/* Author Short Profile */}
                        <div className="det-glass p-8 rounded-[3rem] text-center overflow-hidden relative">
                            <div
                                className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-[#7c3aed] to-[#6605c7]"
                            />
                            <div
                                className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center text-white font-black text-3xl shadow-xl"
                                style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}
                            >
                                {authorInitial(post.author)}
                            </div>
                            <h3 className="font-bold text-xl mb-1">{authorName(post.author)}</h3>
                            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-4">Community Member</p>
                            <div className="grid grid-cols-2 gap-4 py-4 border-y border-black/5 mb-6">
                                <div>
                                    <div className="text-lg font-bold">--</div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Points</div>
                                </div>
                                <div>
                                    <div className="text-lg font-bold">--</div>
                                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Rank</div>
                                </div>
                            </div>
                            <button className="w-full py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-xs uppercase tracking-widest hover:bg-gray-200 transition-colors">
                                View Full Profile
                            </button>
                        </div>

                        {/* Similar Discussions */}
                        {similarPosts.length > 0 && (
                            <div className="det-glass p-8 rounded-[3rem]">
                                <h3 className="font-bold text-lg mb-6 flex items-center gap-2" style={{ fontFamily: "'Noto Serif', serif" }}>
                                    <span>🧩</span> Related Topics
                                </h3>
                                <div className="space-y-6">
                                    {similarPosts.map((p) => (
                                        <Link key={p.id} href={`/community/discussions/${p.id}`} className="block group">
                                            <h4 className="font-bold text-sm text-gray-800 leading-snug mb-2 group-hover:text-[#6605c7] transition-colors">
                                                {p.title}
                                            </h4>
                                            <div className="flex items-center justify-between text-[11px] font-bold text-gray-400">
                                                <span className="det-badge">{p.category || "General"}</span>
                                                <span>💬 {p.commentCount ?? 0}</span>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                                <Link
                                    href="/community/discussions"
                                    className="block text-center mt-8 text-xs font-bold text-[#6605c7] hover:underline"
                                >
                                    Browse All Discussions →
                                </Link>
                            </div>
                        )}

                        {/* Guidelines Widget */}
                        <div className="det-glass p-8 rounded-[3rem] bg-indigo-900/5 border-indigo-200">
                            <h3 className="font-bold text-lg mb-4 text-[#1e1b4b]" style={{ fontFamily: "'Noto Serif', serif" }}>
                                Community Guidelines
                            </h3>
                            <ul className="space-y-4 text-xs font-medium text-indigo-900/70">
                                <li className="flex gap-2">
                                    <span>✅</span>
                                    <span>Be respectful and helpful in your replies.</span>
                                </li>
                                <li className="flex gap-2">
                                    <span>✅</span>
                                    <span>Stay on topic (Education & Finance).</span>
                                </li>
                                <li className="flex gap-2">
                                    <span>❌</span>
                                    <span>No spam or promotional links allowed.</span>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
