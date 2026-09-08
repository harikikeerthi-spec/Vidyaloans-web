"use client";

import { useState, useEffect, useCallback, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { mailApi } from "@/lib/api";
import { format } from "date-fns";
import {
    ArrowLeft,
    Reply,
    Forward,
    Star,
    Trash2,
    Printer,
    Download,
    FileText,
    Paperclip,
    Send,
    X,
    Maximize2,
    Minimize2,
    Tag,
    Clock,
    User,
    CheckCircle2,
    AlertCircle,
    Mail,
    ShieldAlert,
    ShieldCheck
} from "lucide-react";

interface MailAttachment {
    filename: string;
    contentType?: string;
    size: number;
    content?: string;
}

interface MailDetailItem {
    id: string;
    key: string;
    from: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    date: string;
    size: number;
    read: boolean;
    folder?: string;
    snippet?: string;
    html?: string;
    text?: string;
    replyTo?: string;
    attachments: MailAttachment[];
    isSpam?: boolean;
    spamScore?: number;
    spamVerdict?: 'PASS' | 'FAIL' | 'GRAY' | 'UNKNOWN';
    virusVerdict?: 'PASS' | 'FAIL' | 'UNKNOWN';
    spamReasons?: string[];
    authResults?: {
        spf?: string;
        dkim?: string;
        dmarc?: string;
    };
}

function EmailDetailPageContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const resolvedParams = use(paramsPromise);
    const emailId = resolvedParams.id;
    const currentFolder = searchParams.get("folder") || "support/";

    const [mail, setMail] = useState<MailDetailItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Star & Trash & Spam Local Storage State
    const [isStarred, setIsStarred] = useState(false);
    const [isMarkedSpam, setIsMarkedSpam] = useState(false);

    // Compose / Reply Modal
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [isComposeMinimized, setIsComposeMinimized] = useState(false);
    const [isComposeExpanded, setIsComposeExpanded] = useState(false);
    const [showCcBcc, setShowCcBcc] = useState(false);
    const [composeData, setComposeData] = useState({
        to: "",
        cc: "",
        bcc: "",
        subject: "",
        body: "",
        replyTo: "support@vidyaloans.in",
    });
    const [attachments, setAttachments] = useState<{ filename: string; contentType: string; size: number; content: string }[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // Mark as read and check starred & spam on mount
    useEffect(() => {
        try {
            const savedRead = localStorage.getItem("vidya_mail_read_ids");
            const readSet = new Set(savedRead ? JSON.parse(savedRead) : []);
            readSet.add(emailId);
            localStorage.setItem("vidya_mail_read_ids", JSON.stringify(Array.from(readSet)));

            const savedStarred = localStorage.getItem("vidya_mail_starred_ids");
            if (savedStarred) {
                const starSet = new Set(JSON.parse(savedStarred));
                setIsStarred(starSet.has(emailId));
            }

            const userSpam = localStorage.getItem("vidya_mail_user_spam_ids");
            const userNotSpam = localStorage.getItem("vidya_mail_user_not_spam_ids");
            const spamSet = new Set(userSpam ? JSON.parse(userSpam) : []);
            const notSpamSet = new Set(userNotSpam ? JSON.parse(userNotSpam) : []);
            if (spamSet.has(emailId)) setIsMarkedSpam(true);
            else if (notSpamSet.has(emailId)) setIsMarkedSpam(false);
        } catch { }
    }, [emailId]);

    // Load Mail details
    useEffect(() => {
        setLoading(true);
        setError(null);
        mailApi.getMail(emailId)
            .then((res: any) => {
                const mailData = res?.success && res.data ? res.data : (res?.from || res?.subject ? res : null);
                if (mailData) {
                    setMail(mailData);

                    // Sync DB state if present
                    if ((mailData as any).starred !== undefined) {
                        setIsStarred(Boolean((mailData as any).starred));
                    }
                    if ((mailData as any).userSpamOverride === true) {
                        setIsMarkedSpam(true);
                    } else if ((mailData as any).userSpamOverride === false) {
                        setIsMarkedSpam(false);
                    } else if (mailData.isSpam) {
                        setIsMarkedSpam(true);
                    }

                    // Mark as read in DB
                    mailApi.updateState(emailId, { isRead: true }).catch(() => { });
                } else {
                    setError("Unable to parse email payload.");
                }
            })
            .catch((err) => {
                console.error("Error loading email:", err);
                setError(err.message || "Email not found in S3 bucket.");
            })
            .finally(() => setLoading(false));
    }, [emailId]);

    // Spam toggle action
    const toggleMarkSpam = () => {
        try {
            const nextSpam = !isMarkedSpam;
            const userSpam = localStorage.getItem("vidya_mail_user_spam_ids");
            const userNotSpam = localStorage.getItem("vidya_mail_user_not_spam_ids");
            const spamSet = new Set(userSpam ? JSON.parse(userSpam) : []);
            const notSpamSet = new Set(userNotSpam ? JSON.parse(userNotSpam) : []);

            if (isMarkedSpam) {
                spamSet.delete(emailId);
                notSpamSet.add(emailId);
                setIsMarkedSpam(false);
                setToast({ type: "success", message: "Restored to Inbox (Marked as Not Spam)." });
            } else {
                notSpamSet.delete(emailId);
                spamSet.add(emailId);
                setIsMarkedSpam(true);
                setToast({ type: "error", message: "Reported as Spam / Moved to Junk folder." });
            }
            localStorage.setItem("vidya_mail_user_spam_ids", JSON.stringify(Array.from(spamSet)));
            localStorage.setItem("vidya_mail_user_not_spam_ids", JSON.stringify(Array.from(notSpamSet)));
            mailApi.updateState(emailId, { isSpam: nextSpam }).catch(() => { });
            setTimeout(() => setToast(null), 3500);
        } catch { }
    };

    // Star toggle action
    const toggleStar = () => {
        try {
            const willBeStarred = !isStarred;
            const savedStarred = localStorage.getItem("vidya_mail_starred_ids");
            const starSet = new Set(savedStarred ? JSON.parse(savedStarred) : []);
            if (isStarred) {
                starSet.delete(emailId);
                setIsStarred(false);
            } else {
                starSet.add(emailId);
                setIsStarred(true);
            }
            localStorage.setItem("vidya_mail_starred_ids", JSON.stringify(Array.from(starSet)));
            mailApi.updateState(emailId, { isStarred: willBeStarred }).catch(() => { });
        } catch { }
    };

    // Move to Trash and go back
    const handleMoveToTrash = () => {
        try {
            const savedTrashed = localStorage.getItem("vidya_mail_trashed_ids");
            const trashSet = new Set(savedTrashed ? JSON.parse(savedTrashed) : []);
            trashSet.add(emailId);
            localStorage.setItem("vidya_mail_trashed_ids", JSON.stringify(Array.from(trashSet)));
            mailApi.updateState(emailId, { isTrashed: true }).catch(() => { });
        } catch { }
        router.push(`/staff/inbox?folder=${encodeURIComponent(currentFolder)}`);
    };

    // Trigger Reply
    const handleReply = () => {
        if (!mail) return;
        const sender = mail.from.replace(/.*<(.+)>/, "$1").trim();
        const cleanSubj = mail.subject.startsWith("Re:") ? mail.subject : `Re: ${mail.subject}`;
        const quote = `\n\n\n--- On ${format(new Date(mail.date), "PPP 'at' p")}, ${mail.from} wrote ---\n> ${mail.text ? mail.text.replace(/\n/g, "\n> ") : ""}`;

        setComposeData({
            to: sender,
            cc: "",
            bcc: "",
            subject: cleanSubj,
            body: quote,
            replyTo: "support@vidyaloans.in",
        });
        setAttachments([]);
        setIsComposeOpen(true);
        setIsComposeMinimized(false);
    };

    // Trigger Forward
    const handleForward = () => {
        if (!mail) return;
        const cleanSubj = mail.subject.startsWith("Fwd:") ? mail.subject : `Fwd: ${mail.subject}`;
        const quote = `\n\n\n---------- Forwarded message ---------\nFrom: ${mail.from}\nDate: ${format(new Date(mail.date), "PPP 'at' p")}\nSubject: ${mail.subject}\nTo: ${mail.to}\n\n${mail.text || ""}`;

        setComposeData({
            to: "",
            cc: "",
            bcc: "",
            subject: cleanSubj,
            body: quote,
            replyTo: "support@vidyaloans.in",
        });
        const validAttachments = (mail.attachments || [])
            .filter((a) => typeof a.content === "string")
            .map((a) => ({
                filename: a.filename,
                contentType: a.contentType || "application/octet-stream",
                size: a.size,
                content: a.content as string,
            }));
        setAttachments(validAttachments);
        setIsComposeOpen(true);
        setIsComposeMinimized(false);
    };

    // Download attachment helper
    const handleDownloadAttachment = (att: MailAttachment) => {
        if (!att.content) {
            alert("Attachment content not available.");
            return;
        }
        try {
            const byteCharacters = atob(att.content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: att.contentType || "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = att.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Attachment download error", e);
            alert("Failed to download attachment.");
        }
    };

    // Handle send email inside Compose modal
    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!composeData.to || !composeData.subject) {
            alert("Recipient and Subject are required.");
            return;
        }

        setIsSending(true);
        try {
            const payload = {
                to: composeData.to.split(",").map((s) => s.trim()).filter(Boolean),
                cc: composeData.cc ? composeData.cc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                bcc: composeData.bcc ? composeData.bcc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                subject: composeData.subject,
                text: composeData.body,
                replyTo: composeData.replyTo || undefined,
                attachments: attachments.map((a) => ({
                    filename: a.filename,
                    content: a.content,
                    contentType: a.contentType,
                })),
            };

            await mailApi.sendMail(payload);
            setToast({ type: "success", message: "Email dispatched via SES SMTP!" });
            setTimeout(() => setToast(null), 4000);
            setIsComposeOpen(false);
            setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", replyTo: "support@vidyaloans.in" });
            setAttachments([]);
        } catch (err: any) {
            setToast({ type: "error", message: err.message || "Failed to dispatch email." });
            setTimeout(() => setToast(null), 6000);
        } finally {
            setIsSending(false);
        }
    };

    if (loading) {
        return (
            <div className="h-[calc(100vh-65px)] flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        Fetching raw email MIME stream from AWS S3...
                    </p>
                </div>
            </div>
        );
    }

    if (error || !mail) {
        return (
            <div className="h-[calc(100vh-65px)] flex items-center justify-center bg-slate-50 p-6">
                <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-md w-full text-center shadow-sm space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 mx-auto">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-800">Email Not Found</h3>
                        <p className="text-xs text-slate-500 mt-1">{error || "Could not retrieve the specified email."}</p>
                    </div>
                    <button
                        onClick={() => router.push(`/staff/inbox?folder=${encodeURIComponent(currentFolder)}`)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#4F46E5] text-white rounded-xl text-xs font-bold shadow-md hover:bg-indigo-700 transition-all cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Inbox
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-65px)] flex flex-col bg-slate-100 font-sans overflow-hidden">
            {/* Toast */}
            {toast && (
                <div
                    className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border text-sm font-semibold transition-all ${
                        toast.type === "success"
                            ? "bg-emerald-900 text-emerald-100 border-emerald-700"
                            : "bg-rose-900 text-rose-100 border-rose-700"
                    }`}
                >
                    {toast.type === "success" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-rose-400" />
                    )}
                    <span>{toast.message}</span>
                </div>
            )}

            {/* ── TOP ACTION BAR ── */}
            <header className="h-16 px-6 bg-white border-b border-slate-200/80 flex items-center justify-between gap-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push(`/staff/inbox?folder=${encodeURIComponent(currentFolder)}`)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to Inbox</span>
                    </button>

                    <div className="h-4 w-px bg-slate-200" />

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200/70 text-indigo-700 text-[11px] font-mono font-bold">
                        <Tag className="w-3 h-3 text-indigo-500" />
                        {mail.folder || currentFolder}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleReply}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all border border-indigo-200/70 cursor-pointer"
                    >
                        <Reply className="w-3.5 h-3.5" />
                        <span>Reply</span>
                    </button>

                    <button
                        onClick={handleForward}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                    >
                        <Forward className="w-3.5 h-3.5" />
                        <span>Forward</span>
                    </button>

                    <button
                        onClick={toggleStar}
                        className="p-2 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-slate-100 transition-colors cursor-pointer"
                        title={isStarred ? "Unstar" : "Star"}
                    >
                        <Star className={`w-4 h-4 ${isStarred ? "fill-amber-400 text-amber-400" : ""}`} />
                    </button>

                    <button
                        onClick={toggleMarkSpam}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            isMarkedSpam
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-600 border-slate-200 hover:text-rose-600 hover:bg-rose-50"
                        }`}
                        title={isMarkedSpam ? "Restore to Inbox (Mark as Not Spam)" : "Report as Spam / Junk"}
                    >
                        {isMarkedSpam ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                        <span>{isMarkedSpam ? "Not Spam" : "Spam"}</span>
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Print"
                    >
                        <Printer className="w-4 h-4" />
                    </button>

                    <button
                        onClick={handleMoveToTrash}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Move to Trash"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* ── EMAIL BODY DETAIL ── */}
            <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 max-w-5xl mx-auto w-full">
                {/* Security / Spam Warning Banner */}
                {isMarkedSpam && (
                    <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start justify-between gap-3 text-rose-900 shadow-sm">
                        <div className="flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-rose-900 flex items-center gap-2">
                                    <span>Warning: Flagged as Spam / Suspicious Email</span>
                                    {mail.spamScore !== undefined && (
                                        <span className="px-1.5 py-0.5 rounded bg-rose-200 text-rose-800 text-[10px] font-black">
                                            Score: {mail.spamScore}%
                                        </span>
                                    )}
                                </p>
                                <p className="text-[11px] text-rose-700 mt-1 leading-relaxed">
                                    {mail.spamReasons && mail.spamReasons.length > 0
                                        ? mail.spamReasons.join(" • ")
                                        : "This message failed authenticity checks or contained high-risk patterns. Exercise caution with any external links or attachments."}
                                </p>
                                {mail.authResults && (
                                    <div className="flex items-center gap-2 mt-2 text-[10px] font-mono">
                                        <span className={`px-2 py-0.5 rounded font-bold ${mail.authResults.spf === 'pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                            SPF: {mail.authResults.spf?.toUpperCase()}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded font-bold ${mail.authResults.dkim === 'pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                            DKIM: {mail.authResults.dkim?.toUpperCase()}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded font-bold ${mail.authResults.dmarc === 'pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                            DMARC: {mail.authResults.dmarc?.toUpperCase()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={toggleMarkSpam}
                            className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-800 text-xs font-bold hover:bg-rose-100 transition-colors shrink-0 cursor-pointer shadow-sm"
                        >
                            Not Spam
                        </button>
                    </div>
                )}

                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 md:p-8 space-y-6">
                    {/* Subject Header */}
                    <div className="border-b border-slate-100 pb-6 space-y-4">
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-snug">
                            {mail.subject || "(No Subject)"}
                        </h1>

                        <div className="flex flex-wrap items-start justify-between gap-4 text-xs">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-100 border-2 border-indigo-200/60 flex items-center justify-center font-black text-indigo-700 text-base shadow-sm">
                                    {mail.from.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-extrabold text-slate-900 text-sm">{mail.from}</p>
                                    </div>
                                    <p className="text-slate-500 text-xs mt-0.5">
                                        <span className="text-slate-400 font-medium">To:</span> {mail.to}
                                    </p>
                                    {mail.cc && (
                                        <p className="text-slate-400 text-[11px] mt-0.5">
                                            <span>Cc:</span> {mail.cc}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="text-right">
                                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-semibold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    {format(new Date(mail.date), "PPP 'at' p")}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Attachments Banner */}
                    {mail.attachments && mail.attachments.length > 0 && (
                        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                                <Paperclip className="w-4 h-4 text-indigo-600" />
                                <span>Attached Files ({mail.attachments.length})</span>
                            </div>

                            <div className="flex flex-wrap gap-2.5">
                                {mail.attachments.map((att, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-2.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm"
                                    >
                                        <FileText className="w-4 h-4 text-indigo-500" />
                                        <span className="truncate max-w-[200px] font-bold">{att.filename}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            ({Math.round(att.size / 1024)} KB)
                                        </span>
                                        {att.content && (
                                            <button
                                                onClick={() => handleDownloadAttachment(att)}
                                                className="p-1 hover:text-indigo-600 text-slate-400 transition-colors"
                                                title="Download Attachment"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* HTML body or Plain Text */}
                    <div className="pt-2">
                        {mail.html ? (
                            <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white p-2">
                                <iframe
                                    title="Email Message Preview"
                                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1e293b;line-height:1.6;padding:16px;margin:0;word-break:break-word;}img{max-width:100%;height:auto;}</style></head><body>${mail.html}</body></html>`}
                                    className="w-full min-h-[550px] border-none"
                                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                                />
                            </div>
                        ) : (
                            <div className="p-6 bg-slate-50/50 rounded-2xl border border-slate-200/60 font-sans text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                                {mail.text || "(Empty email body)"}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* ── COMPOSE MODAL ── */}
            {isComposeOpen && (
                <div
                    className={`fixed z-50 transition-all duration-200 ${
                        isComposeExpanded
                            ? "inset-4 sm:inset-10"
                            : isComposeMinimized
                            ? "bottom-0 right-8 w-80 h-12"
                            : "bottom-0 right-8 w-[580px] max-w-[calc(100vw-40px)] h-[580px] max-h-[calc(100vh-80px)]"
                    } bg-white rounded-t-2xl shadow-2xl border border-slate-300 flex flex-col overflow-hidden`}
                >
                    <div className="px-4 py-3 bg-[#0A2540] text-white flex items-center justify-between flex-shrink-0 cursor-pointer">
                        <span className="text-xs font-bold tracking-wide flex items-center gap-2">
                            <Send className="w-3.5 h-3.5 text-indigo-400" />
                            {composeData.subject ? composeData.subject : "New Message"}
                        </span>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsComposeMinimized(!isComposeMinimized)}
                                className="p-1 hover:text-indigo-300 text-slate-300 transition-colors"
                            >
                                <Minimize2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setIsComposeExpanded(!isComposeExpanded)}
                                className="p-1 hover:text-indigo-300 text-slate-300 transition-colors"
                            >
                                <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setIsComposeOpen(false)}
                                className="p-1 hover:text-rose-400 text-slate-300 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {!isComposeMinimized && (
                        <form onSubmit={handleSendEmail} className="flex-1 flex flex-col overflow-hidden bg-white">
                            <div className="p-3 border-b border-slate-100 space-y-2 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1 flex items-center gap-2">
                                        <span className="w-12 text-slate-400 font-bold uppercase text-[10px]">To</span>
                                        <input
                                            type="text"
                                            value={composeData.to}
                                            onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                                            required
                                            className="flex-1 px-2 py-1 text-xs font-semibold focus:outline-none border-b border-transparent focus:border-indigo-500"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowCcBcc(!showCcBcc)}
                                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                                    >
                                        {showCcBcc ? "Hide CC/BCC" : "CC / BCC"}
                                    </button>
                                </div>

                                {showCcBcc && (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="w-12 text-slate-400 font-bold uppercase text-[10px]">Cc</span>
                                            <input
                                                type="text"
                                                value={composeData.cc}
                                                onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
                                                className="flex-1 px-2 py-1 text-xs font-semibold focus:outline-none border-b border-transparent focus:border-indigo-500"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-12 text-slate-400 font-bold uppercase text-[10px]">Bcc</span>
                                            <input
                                                type="text"
                                                value={composeData.bcc}
                                                onChange={(e) => setComposeData({ ...composeData, bcc: e.target.value })}
                                                className="flex-1 px-2 py-1 text-xs font-semibold focus:outline-none border-b border-transparent focus:border-indigo-500"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="flex items-center gap-2">
                                    <span className="w-12 text-slate-400 font-bold uppercase text-[10px]">Subject</span>
                                    <input
                                        type="text"
                                        value={composeData.subject}
                                        onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                                        required
                                        className="flex-1 px-2 py-1 text-xs font-semibold focus:outline-none border-b border-transparent focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <textarea
                                placeholder="Type your response..."
                                value={composeData.body}
                                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                                className="flex-1 p-4 text-xs leading-relaxed font-sans focus:outline-none resize-none"
                            />

                            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setIsComposeOpen(false)}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200/60 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSending}
                                    className="inline-flex items-center gap-2 px-5 py-2 bg-[#4F46E5] text-white text-xs font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all cursor-pointer disabled:opacity-50"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>{isSending ? "Sending..." : "Send Email"}</span>
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}

export default function EmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-600 rounded-full animate-spin" /></div>}>
            <EmailDetailPageContent paramsPromise={params} />
        </Suspense>
    );
}
