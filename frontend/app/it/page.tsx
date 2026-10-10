"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supportApi, blogApi } from "@/lib/api";

export default function ITOverviewPage() {
    const [ticketStats, setTicketStats] = useState({
        total: 0,
        open: 0,
        resolved: 0,
        critical: 0
    });
    const [recentTickets, setRecentTickets] = useState<any[]>([]);
    const [blogs, setBlogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDashboard = async () => {
            setLoading(true);
            try {
                const [ticketsRes, dashRes, blogsRes]: [any, any, any] = await Promise.all([
                    supportApi.getTickets({ limit: 25, sortBy: "createdAt", sortOrder: "desc" }).catch(() => ({ data: [] })),
                    supportApi.getDashboard().catch(() => null),
                    blogApi.getAll(1, 10).catch(() => ({ data: [] }))
                ]);

                // Prefer dashboard stats (accurate server-side counts)
                if (dashRes?.stats) {
                    const s = dashRes.stats;
                    setTicketStats({
                        total: s.totalTickets || 0,
                        open: s.openTickets || 0,
                        resolved: (s.resolvedTickets || 0) + (s.closedTickets || 0),
                        critical: s.criticalTickets || 0,
                    });
                } else {
                    // Fallback to computing from ticket list
                    const tData = ticketsRes?.data || ticketsRes || {};
                    const ticketList = Array.isArray(tData.data) ? tData.data : Array.isArray(tData) ? tData : [];
                    const open = ticketList.filter((t: any) => t.status === "open" || t.status === "in_progress").length;
                    const resolved = ticketList.filter((t: any) => t.status === "resolved" || t.status === "closed").length;
                    const critical = ticketList.filter((t: any) => t.priority === "critical" || t.priority === "high").length;
                    setTicketStats({ total: ticketList.length, open, resolved, critical });
                }

                // Recent tickets for the table
                const tData = ticketsRes?.data || ticketsRes || {};
                const ticketList = Array.isArray(tData.data) ? tData.data : Array.isArray(tData) ? tData : [];
                setRecentTickets(ticketList.slice(0, 5));
                setBlogs(blogsRes?.data || []);
            } catch (e) {
                console.error("IT Dashboard error:", e);
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, []);

    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [ticketDetail, setTicketDetail] = useState<any | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [sendingReply, setSendingReply] = useState(false);

    const getAttachmentUrl = (att: any) => {
        if (!att) return "#";
        const path = att.fileUrl || att.url || att.filePath || "";
        if (!path) return "#";
        if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:") || path.startsWith("data:")) {
            return path;
        }
        const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
        return `${apiBase.replace(/\/api$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    const isImageAttachment = (att: any) => {
        if (!att) return false;
        const mime = (att.mimeType || "").toLowerCase();
        if (mime.startsWith("image/")) return true;
        const nameOrPath = (att.fileName || att.filePath || att.fileUrl || att.url || "").toLowerCase();
        const cleanPath = nameOrPath.split("?")[0];
        return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(cleanPath) || nameOrPath.startsWith("data:image");
    };

    const handleInspectTicket = async (t: any) => {
        setSelectedTicket(t);
        setLoadingDetail(true);
        try {
            const detailRes = await supportApi.getTicket(t.id || t._id) as any;
            setTicketDetail(detailRes?.data || detailRes);
        } catch {
            setTicketDetail(t);
        } finally {
            setLoadingDetail(false);
        }
    };

    const handleSendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replyText.trim() || !selectedTicket) return;
        setSendingReply(true);
        try {
            await supportApi.addComment(selectedTicket.id || selectedTicket._id, replyText.trim());
            setReplyText("");
            const updated = await supportApi.getTicket(selectedTicket.id || selectedTicket._id) as any;
            setTicketDetail(updated?.data || updated);
        } catch (err: any) {
            alert("Failed to send reply: " + (err?.message || "Unknown error"));
        } finally {
            setSendingReply(false);
        }
    };

    return (
        <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in pb-12">
            {/* Header banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden font-sans">
                <div className="relative z-10">

                    <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2">
                        Welcome to IT Dashboard
                    </h1>
                    <p className="text-slate-300 text-xs md:text-sm mt-1 max-w-xl">
                        Monitor platform Support Tickets, inspect user uploaded issue images & screenshots, resolve technical queries, and publish Blog CMS content in real-time.
                    </p>
                </div>
            </div>

            {/* Metrics cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-sans">
                <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Open Tickets</span>
                        <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center material-symbols-outlined text-[18px]">
                            confirmation_number
                        </span>
                    </div>
                    <p className="text-3xl font-extrabold text-slate-900">{ticketStats.open}</p>
                    <p className="text-[11px] text-slate-500 font-semibold mt-1">Requires IT response</p>
                </div>

                <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Critical Tickets</span>
                        <span className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center material-symbols-outlined text-[18px]">
                            warning
                        </span>
                    </div>
                    <p className="text-3xl font-extrabold text-rose-600">{ticketStats.critical}</p>
                    <p className="text-[11px] text-slate-500 font-semibold mt-1">High priority items</p>
                </div>

                <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resolved Tickets</span>
                        <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center material-symbols-outlined text-[18px]">
                            check_circle
                        </span>
                    </div>
                    <p className="text-3xl font-extrabold text-emerald-600">{ticketStats.resolved}</p>
                    <p className="text-[11px] text-slate-500 font-semibold mt-1">Successfully closed</p>
                </div>

                <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Blog Articles</span>
                        <span className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center material-symbols-outlined text-[18px]">
                            newspaper
                        </span>
                    </div>
                    <p className="text-3xl font-extrabold text-slate-900">{blogs.length}</p>
                    <p className="text-[11px] text-slate-500 font-semibold mt-1">Published CMS posts</p>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-sans">
                {/* Support Tickets Section */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Support Tickets Center</h3>
                            <p className="text-xs text-slate-500">Manage user and staff issues with proof screenshots</p>
                        </div>
                        <Link
                            href="/it/tickets"
                            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all"
                        >
                            View All Tickets →
                        </Link>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {loading ? (
                            <div className="py-8 text-center text-xs text-slate-400">Loading tickets...</div>
                        ) : recentTickets.length > 0 ? (
                            recentTickets.map((t: any) => {
                                const attachments = t.attachments || [];
                                const imgAtt = attachments.find((a: any) => isImageAttachment(a));
                                const imgUrl = imgAtt ? getAttachmentUrl(imgAtt) : null;

                                return (
                                    <div
                                        key={t.id || t._id}
                                        onClick={() => handleInspectTicket(t)}
                                        className="py-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 p-2 rounded-xl transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            {/* Image Proof Thumbnail if available */}
                                            {imgUrl ? (
                                                <div className="w-11 h-11 rounded-xl bg-slate-100 border border-indigo-200 overflow-hidden shrink-0 relative group-hover:scale-105 transition-transform shadow-xs">
                                                    <img src={imgUrl} alt="Uploaded issue proof" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-indigo-900/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="material-symbols-outlined text-white text-xs">zoom_in</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-lg">confirmation_number</span>
                                                </div>
                                            )}

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                                                        {t.subject || "Support Query"}
                                                    </p>
                                                    {imgUrl && (
                                                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-extrabold text-[9px] border border-indigo-200 shrink-0">
                                                            📷 Image Uploaded
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                    {t.category || "General"} • #{t.ticketNumber || (t.id || '').slice(-6)} • By {t.createdByName || "User"}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${t.status === 'open' ? 'bg-blue-50 text-blue-600 border border-blue-200' : t.status === 'resolved' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                {t.status || 'OPEN'}
                                            </span>
                                            <span className="material-symbols-outlined text-slate-400 group-hover:text-indigo-600 text-base">
                                                chevron_right
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="py-8 text-center text-xs text-slate-400">No support tickets found</div>
                        )}
                    </div>
                </div>

                {/* Blog CMS Section */}
                <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Blog CMS Management</h3>
                            <p className="text-xs text-slate-500">Publish & edit platform articles</p>
                        </div>
                        <Link
                            href="/it/blogs?action=create"
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all"
                        >
                            + New Blog Post
                        </Link>
                    </div>

                    <div className="divide-y divide-slate-100">
                        {loading ? (
                            <div className="py-8 text-center text-xs text-slate-400">Loading articles...</div>
                        ) : blogs.length > 0 ? (
                            blogs.slice(0, 5).map((b: any) => (
                                <div key={b.id || b._id} className="py-3 flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-900 truncate">{b.title}</p>
                                        <p className="text-[10px] text-slate-400">{b.category || "General"} • By {b.authorName || "IT Staff"}</p>
                                    </div>
                                    <Link
                                        href={`/it/blogs?action=edit&id=${b.id || b._id}`}
                                        className="text-xs text-indigo-600 hover:underline font-bold shrink-0"
                                    >
                                        Edit Article
                                    </Link>
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center text-xs text-slate-400">No blog posts found</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Ticket Inspection Modal with Uploaded Proof Images */}
            {selectedTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
                    <div
                        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
                        onClick={() => {
                            setSelectedTicket(null);
                            setTicketDetail(null);
                        }}
                    />

                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col z-10 animate-scale-up">
                        {/* Modal Header */}
                        <div className="p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex justify-between items-start shrink-0">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-indigo-300 font-extrabold text-sm">
                                        #{selectedTicket.ticketNumber || (selectedTicket.id || '').slice(-6)}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 border border-indigo-400/30 text-indigo-200">
                                        {selectedTicket.priority || 'medium'} PRIORITY
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 border border-emerald-400/30 text-emerald-200">
                                        {selectedTicket.status || 'OPEN'}
                                    </span>
                                </div>
                                <h2 className="text-xl font-extrabold text-white mt-1.5">
                                    {selectedTicket.subject}
                                </h2>
                                <p className="text-xs text-slate-300 mt-1">
                                    Category: {selectedTicket.category || 'General'} • Submitted by {selectedTicket.createdByName || 'User'}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedTicket(null);
                                    setTicketDetail(null);
                                }}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors border-0 cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        {/* Modal Content Scroll Area */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            {loadingDetail ? (
                                <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                                    <div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                                    <span>Fetching full ticket & uploaded images...</span>
                                </div>
                            ) : (
                                <>
                                    {/* Description */}
                                    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4.5 space-y-2">
                                        <h4 className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                            Issue Description
                                        </h4>
                                        <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                                            {ticketDetail?.description || selectedTicket.description || "No description provided."}
                                        </p>
                                    </div>

                                    {/* Uploaded Problem Proof & Images */}
                                    {(() => {
                                        const atts = ticketDetail?.attachments || selectedTicket?.attachments || [];
                                        const attachmentUrl = ticketDetail?.attachmentUrl || selectedTicket?.attachmentUrl;
                                        const allAtts = atts.length > 0 ? atts : attachmentUrl ? [{ fileName: "Uploaded Problem Screenshot", filePath: attachmentUrl }] : [];

                                        if (allAtts.length === 0) return null;

                                        return (
                                            <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-xs space-y-4">
                                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-indigo-600 text-lg">image</span>
                                                        Uploaded Proof Images & Attachments ({allAtts.length})
                                                    </h3>
                                                    <span className="text-[10px] text-slate-400 font-semibold">Stored in server storage</span>
                                                </div>

                                                <div className="space-y-4">
                                                    {allAtts.map((att: any, idx: number) => {
                                                        const url = getAttachmentUrl(att);
                                                        const isImage = isImageAttachment(att);

                                                        if (isImage) {
                                                            return (
                                                                <div key={att.id || idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-bold text-slate-800 truncate">
                                                                            {att.fileName || att.name || `Issue Screenshot #${idx + 1}`}
                                                                        </span>
                                                                        <a
                                                                            href={url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-xs"
                                                                        >
                                                                            <span className="material-symbols-outlined text-xs">open_in_new</span>
                                                                            Open Original High-Res
                                                                        </a>
                                                                    </div>

                                                                    {/* Large Inline Image Preview */}
                                                                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950 flex items-center justify-center p-2 group max-h-[420px]">
                                                                        <img
                                                                            src={url}
                                                                            alt="Uploaded issue screenshot"
                                                                            className="max-h-[390px] w-auto object-contain rounded-lg shadow-md"
                                                                        />
                                                                        <a
                                                                            href={url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-2 backdrop-blur-[2px]"
                                                                        >
                                                                            <span className="material-symbols-outlined text-2xl">zoom_in</span>
                                                                            Click to Open Full Screen Image
                                                                        </a>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <a
                                                                key={att.id || idx}
                                                                href={url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-3 p-3.5 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 rounded-xl transition-all"
                                                            >
                                                                <span className="material-symbols-outlined text-indigo-600 text-xl">description</span>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-xs font-bold text-slate-800 truncate">{att.fileName || "Uploaded File"}</p>
                                                                    <p className="text-[10px] text-slate-400">Click to view attachment ↗</p>
                                                                </div>
                                                            </a>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Conversation / Comments */}
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-indigo-600 text-base">forum</span>
                                            Replies & Updates ({(ticketDetail?.comments || []).length})
                                        </h4>

                                        <div className="divide-y divide-slate-100 bg-slate-50 border border-slate-200 rounded-2xl p-4 max-h-56 overflow-y-auto space-y-3">
                                            {(ticketDetail?.comments || []).length === 0 ? (
                                                <p className="text-xs text-slate-400 text-center py-4 font-medium">No replies added yet.</p>
                                            ) : (
                                                (ticketDetail?.comments || []).map((c: any) => (
                                                    <div key={c.id} className="pt-3 first:pt-0">
                                                        <div className="flex items-center justify-between text-[11px]">
                                                            <span className="font-bold text-slate-900">{c.authorName}</span>
                                                            <span className="text-slate-400">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}</span>
                                                        </div>
                                                        <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{c.content}</p>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* IT Reply Box */}
                                        <form onSubmit={handleSendReply} className="space-y-2">
                                            <textarea
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                placeholder="Write an IT resolution reply to the applicant..."
                                                rows={2}
                                                className="w-full p-3 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                            />
                                            <div className="flex justify-end">
                                                <button
                                                    type="submit"
                                                    disabled={!replyText.trim() || sendingReply}
                                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                                                >
                                                    {sendingReply ? "Sending..." : "Send Reply"}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
