"use client";

import { useState, useEffect, useCallback, use, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
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
    ShieldCheck,
    Info,
    Eye,
    ChevronDown,
    Image as ImageIcon,
    RotateCcw
} from "lucide-react";

import { EmailRemoteResourceBanner } from "@/components/staff/mail/EmailRemoteResourceBanner";
import {
    ShowSourceModal,
    SummaryModal,
    HeadersModal,
    ImageLightboxModal
} from "@/components/staff/mail/MailModals";
import {
    exportEmailToEml,
    saveEmailAsCalendarEvent,
    formatOutlookDate
} from "@/components/staff/mail/mailUtils";

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

const SAMPLE_FALLBACKS: Record<string, Partial<MailDetailItem>> = {
    "sample-disbursal-aug": {
        id: "sample-disbursal-aug",
        from: "Anshul Mohan",
        to: "vamsikrishna@bmkconsultants.in",
        subject: "DISBURSAL DATA \\\\ AUG",
        date: new Date().toISOString(),
        size: 94208,
        read: true,
        snippet: "Please provide the sign & stamp",
        attachments: [
            { filename: "BMK AUG26.pdf", contentType: "application/pdf", size: 94208, content: "" },
            { filename: "Avanse_Partner_Stamp.png", contentType: "image/png", size: 42100, content: "" }
        ],
        text: "Dear Sir,\n\nPlease provide the sign & stamp\n\nThanks & Regards\nAnshul Mohan\nRelationship Manager\nStudent Lending - Channels\nAVANSE Financial Services LTD.",
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.6;padding:4px;"><p style="font-size:14px;margin-top:0;">Dear Sir,</p><p style="font-size:14px;margin:20px 0;">Please provide the sign &amp; stamp</p><div style="margin-top:36px;display:flex;align-items:flex-start;gap:20px;"><div style="width:140px;height:115px;background:#FFE3E3;border:1.5px dashed #FA5252;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:10px;box-sizing:border-box;"><div style="width:30px;height:30px;border-radius:50%;background:#E03131;color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;margin-bottom:4px;">A</div><span style="font-size:11px;font-weight:800;color:#C92A2A;text-transform:uppercase;letter-spacing:0.5px;">AVANSE</span><span style="font-size:9px;color:#E03131;font-weight:700;margin-top:2px;">Authorized Stamp</span><span style="font-size:8px;color:#868E96;margin-top:3px;">DISBURSAL UNIT</span></div><div style="border-left:3px solid #E03131;padding-left:16px;"><p style="margin:0;font-weight:700;color:#C92A2A;font-size:13px;">Thanks &amp; Regards</p><p style="margin:4px 0 0 0;font-weight:800;color:#C92A2A;font-size:15px;">Anshul Mohan</p><p style="margin:2px 0 0 0;font-style:italic;color:#C92A2A;font-size:12px;">Relationship Manager</p><p style="margin:2px 0 0 0;font-style:italic;color:#C92A2A;font-size:12px;">Student Lending - Channels</p><p style="margin:14px 0 0 0;font-weight:900;color:#1864AB;font-size:14px;letter-spacing:-0.2px;">AVANSE Financial Services LTD.</p></div></div></div>`,
        authResults: { spf: "pass", dkim: "pass", dmarc: "pass" }
    }
};

function EmailDetailPageContent({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const staffMailbox = (user as any)?.mailboxEmail || (user?.email?.endsWith('@vidyaloans.in') ? user?.email : '') || user?.email || "support@vidyaloans.in";
    const resolvedParams = use(paramsPromise);
    const emailId = resolvedParams.id;
    const currentFolder = searchParams.get("folder") || "support/";

    const [mail, setMail] = useState<MailDetailItem | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Star & Spam Local Storage State
    const [isStarred, setIsStarred] = useState(false);
    const [isMarkedSpam, setIsMarkedSpam] = useState(false);

    // Outlook Reading Pane Features
    const [viewMode, setViewMode] = useState<"html" | "text">("html");
    const [remoteResourcesBlocked, setRemoteResourcesBlocked] = useState(true);
    const [activeAttachmentMenu, setActiveAttachmentMenu] = useState<number | null>(null);

    // Modals
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [showHeadersModal, setShowHeadersModal] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<{ url: string; filename?: string } | null>(null);

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
        replyTo: staffMailbox || "support@vidyaloans.in",
    });
    const [attachments, setAttachments] = useState<{ filename: string; contentType: string; size: number; content: string }[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [isTrashed, setIsTrashed] = useState(false);
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

            const savedTrash = localStorage.getItem("vidya_mail_trashed_ids");
            if (savedTrash) {
                const trashSet = new Set(JSON.parse(savedTrash));
                setIsTrashed(trashSet.has(emailId));
            }
        } catch { }
    }, [emailId]);

    // Load Mail details
    useEffect(() => {
        setLoading(true);
        setError(null);

        // Check fallback sample emails
        if (SAMPLE_FALLBACKS[emailId]) {
            setMail(SAMPLE_FALLBACKS[emailId] as MailDetailItem);
            setLoading(false);
            return;
        }

        mailApi.getMail(emailId)
            .then((res: any) => {
                const mailData = res?.success && res.data ? res.data : (res?.from || res?.subject ? res : null);
                if (mailData) {
                    setMail(mailData);

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

    // Spam toggle
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

    // Star toggle
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

    // Move to Trash
    const handleMoveToTrash = () => {
        try {
            const savedTrash = localStorage.getItem("vidya_mail_trashed_ids");
            const trashSet = new Set(savedTrash ? JSON.parse(savedTrash) : []);
            trashSet.add(emailId);
            localStorage.setItem("vidya_mail_trashed_ids", JSON.stringify(Array.from(trashSet)));
            const times = JSON.parse(localStorage.getItem("vidya_mail_trash_times") || "{}");
            times[emailId] = Date.now();
            localStorage.setItem("vidya_mail_trash_times", JSON.stringify(times));
            mailApi.updateState(emailId, { isTrashed: true }).catch(() => { });
            setIsTrashed(true);
            setToast({ type: "error", message: "Moved email to Trash. (Retained up to 60 days)" });
            setTimeout(() => setToast(null), 3000);
            router.push(`/staff/inbox?folder=${encodeURIComponent(currentFolder)}`);
        } catch { }
    };

    // Restore from Trash
    const handleRestoreFromTrash = () => {
        try {
            const savedTrash = localStorage.getItem("vidya_mail_trashed_ids");
            const trashSet = new Set(savedTrash ? JSON.parse(savedTrash) : []);
            trashSet.delete(emailId);
            localStorage.setItem("vidya_mail_trashed_ids", JSON.stringify(Array.from(trashSet)));
            const times = JSON.parse(localStorage.getItem("vidya_mail_trash_times") || "{}");
            delete times[emailId];
            localStorage.setItem("vidya_mail_trash_times", JSON.stringify(times));
            mailApi.updateState(emailId, { isTrashed: false }).catch(() => { });
            setIsTrashed(false);
            setToast({ type: "success", message: "Restored email to Inbox." });
            setTimeout(() => setToast(null), 3000);
        } catch { }
    };

    // Reply action - mail type section is empty as requested
    const handleReply = () => {
        if (!mail) return;
        const sender = mail.from.replace(/.*<(.+)>/, "$1").trim();
        const cleanSubj = mail.subject.startsWith("Re:") ? mail.subject : `Re: ${mail.subject}`;

        setComposeData({
            to: sender,
            cc: "",
            bcc: "",
            subject: cleanSubj,
            body: "", // Mail type section is empty when replying as requested
            replyTo: staffMailbox || "support@vidyaloans.in",
        });
        setAttachments([]);
        setIsComposeOpen(true);
        setIsComposeMinimized(false);
    };

    // Forward action
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
            replyTo: staffMailbox || "support@vidyaloans.in",
        });
        const forwardAttachments = (mail.attachments || [])
            .filter((a) => typeof a.content === "string")
            .map((a) => ({
                filename: a.filename,
                contentType: a.contentType || "application/octet-stream",
                size: a.size,
                content: a.content as string,
            }));
        setAttachments(forwardAttachments);
        setIsComposeOpen(true);
        setIsComposeMinimized(false);
    };

    // Attachment download
    const handleDownloadAttachment = (att: MailAttachment) => {
        if (!att.content) {
            const dummy = `File: ${att.filename}\nDownloaded from VidyaLoans Staff Mailbox.`;
            const blob = new Blob([dummy], { type: att.contentType || "application/pdf" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = att.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
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

    // Send email
    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!composeData.to || !composeData.subject) return;

        setIsSending(true);
        try {
            await mailApi.sendMail({
                to: composeData.to.split(",").map((s) => s.trim()).filter(Boolean),
                cc: composeData.cc ? composeData.cc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                bcc: composeData.bcc ? composeData.bcc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                subject: composeData.subject,
                text: composeData.body,
                replyTo: composeData.replyTo,
                attachments: attachments.map((a) => ({
                    filename: a.filename,
                    content: a.content,
                    contentType: a.contentType,
                })),
            });

            setToast({ type: "success", message: "Email sent successfully!" });
            setTimeout(() => setToast(null), 3500);
            setIsComposeOpen(false);
            setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", replyTo: staffMailbox || "support@vidyaloans.in" });
            setAttachments([]);
        } catch (err: any) {
            setToast({ type: "error", message: err.message || "Failed to dispatch email." });
            setTimeout(() => setToast(null), 5000);
        } finally {
            setIsSending(false);
        }
    };

    if (loading) {
        return (
            <div className="h-[calc(100vh-65px)] flex items-center justify-center bg-slate-50">
                <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
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

            {/* ── TOP OUTLOOK ACTION BAR ── */}
            <header className="h-14 px-6 bg-white border-b border-slate-200/90 flex items-center justify-between gap-4 shrink-0 select-none">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => router.push(`/staff/inbox?folder=${encodeURIComponent(currentFolder)}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                    </button>

                    <button
                        onClick={handleReply}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all border border-indigo-200/70 cursor-pointer"
                    >
                        <Reply className="w-3.5 h-3.5" />
                        <span>Reply</span>
                    </button>

                    <button
                        onClick={handleForward}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                    >
                        <Forward className="w-3.5 h-3.5" />
                        <span>Forward</span>
                    </button>

                    <button
                        onClick={toggleStar}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-slate-100 transition-colors cursor-pointer"
                        title={isStarred ? "Unstar" : "Star"}
                    >
                        <Star className={`w-4 h-4 ${isStarred ? "fill-amber-400 text-amber-400" : ""}`} />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={toggleMarkSpam}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            isMarkedSpam
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-600 border-slate-200 hover:text-rose-600 hover:bg-rose-50"
                        }`}
                    >
                        {isMarkedSpam ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                        <span>{isMarkedSpam ? "Not Spam" : "Spam"}</span>
                    </button>

                    <button
                        onClick={() => exportEmailToEml(mail)}
                        className="p-2 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Export (.eml)"
                    >
                        <Download className="w-4 h-4" />
                    </button>

                    <button
                        onClick={() => window.print()}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        title="Print"
                    >
                        <Printer className="w-4 h-4" />
                    </button>

                    {isTrashed ? (
                        <button
                            onClick={handleRestoreFromTrash}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-all cursor-pointer"
                            title="Restore email to Inbox"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Restore to Inbox</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleMoveToTrash}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Move to Trash"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </header>

            {/* ── EMAIL BODY DETAIL ── */}
            <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 max-w-5xl mx-auto w-full">
                {/* Trash Retention & Restore Notice Banner */}
                {isTrashed && (
                    <div className="p-4 rounded-2xl bg-rose-50/90 border border-rose-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-300 text-rose-800 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5 text-rose-600" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-rose-950">
                                    This message is in your Trash folder
                                </p>
                                <p className="text-[11px] text-rose-800/90 mt-0.5">
                                    Messages in Trash are retained for up to 60 days before being completely removed automatically.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleRestoreFromTrash}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore to Inbox</span>
                        </button>
                    </div>
                )}
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-6 md:p-8 space-y-5">
                    {/* Subject Header with External Indicator */}
                    <div className="border-b border-slate-100 pb-5 space-y-3">
                        <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-snug">
                            {mail.subject || "(No Subject)"}
                        </h1>

                        <div className="flex flex-wrap items-start justify-between gap-4 text-xs">
                            <div className="flex items-start gap-3.5">
                                <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0">
                                    <User className="w-5 h-5 text-slate-500" />
                                </div>
                                <div>
                                    <div className="flex items-baseline gap-2 text-xs">
                                        <span className="font-bold text-slate-900 w-10 shrink-0">From</span>
                                        <span className="text-sky-600 font-semibold truncate hover:underline cursor-pointer">
                                            {mail.from}
                                        </span>
                                    </div>

                                    <div className="flex items-baseline gap-2 text-xs mt-0.5">
                                        <span className="font-bold text-slate-900 w-10 shrink-0">To</span>
                                        <span className="text-sky-600 font-medium truncate hover:underline cursor-pointer">
                                            {mail.to}
                                        </span>
                                    </div>

                                    <div className="flex items-baseline gap-2 text-xs mt-0.5">
                                        <span className="font-bold text-slate-900 w-10 shrink-0">Date</span>
                                        <span className="text-slate-700 font-medium">
                                            {formatOutlookDate(mail.date)}
                                        </span>
                                    </div>

                                    {/* Quick Pills: ✉ Summary  ℹ Headers  📄 Plain text */}
                                    <div className="flex items-center gap-4 mt-2.5 text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setShowSummaryModal(true)}
                                            className="inline-flex items-center gap-1.5 text-sky-600 hover:text-sky-800 font-bold transition-colors cursor-pointer"
                                        >
                                            <Mail className="w-3.5 h-3.5" />
                                            <span>Summary</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setShowHeadersModal(true)}
                                            className="inline-flex items-center gap-1.5 text-sky-600 hover:text-sky-800 font-bold transition-colors cursor-pointer"
                                        >
                                            <Info className="w-3.5 h-3.5" />
                                            <span>Headers</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setViewMode(viewMode === "html" ? "text" : "html")}
                                            className="inline-flex items-center gap-1.5 text-sky-600 hover:text-sky-800 font-bold transition-colors cursor-pointer"
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            <span>{viewMode === "html" ? "Plain text" : "HTML format"}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Attachments Section */}
                    {mail.attachments && mail.attachments.length > 0 && (
                        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-wrap gap-2">
                            {mail.attachments.map((att, idx) => {
                                const isImg = att.contentType?.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(att.filename);

                                if (isImg) {
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => setLightboxImage({ url: att.content ? `data:${att.contentType || "image/png"};base64,${att.content}` : "https://api.dicebear.com/7.x/identicon/svg?seed=" + att.filename, filename: att.filename })}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-50 cursor-pointer transition-all"
                                        >
                                            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                                            <span className="truncate max-w-[160px]">{att.filename}</span>
                                            <span className="text-[10px] text-indigo-400 font-mono">(Image)</span>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={idx} className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setActiveAttachmentMenu(activeAttachmentMenu === idx ? null : idx)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs hover:border-indigo-300 transition-all cursor-pointer"
                                        >
                                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                                            <span className="truncate max-w-[200px]">{att.filename}</span>
                                            <span className="text-[10px] text-slate-400 font-mono">
                                                (~{Math.round(att.size / 1024)} KB)
                                            </span>
                                            <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
                                        </button>

                                        {activeAttachmentMenu === idx && (
                                            <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 text-xs">
                                                <button
                                                    onClick={() => {
                                                        handleDownloadAttachment(att);
                                                        setActiveAttachmentMenu(null);
                                                    }}
                                                    className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"
                                                >
                                                    <Download className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>Download attachment</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Remote Resources Privacy Banner */}
                    <EmailRemoteResourceBanner
                        isBlocked={remoteResourcesBlocked}
                        onAllow={() => {
                            setRemoteResourcesBlocked(false);
                            setToast({ type: "success", message: "Remote images & external content allowed." });
                            setTimeout(() => setToast(null), 3000);
                        }}
                    />

                    {/* HTML body or Plain Text */}
                    <div className="pt-2">
                        {viewMode === "html" && mail.html ? (
                            <div className="rounded-2xl border border-slate-100 bg-white p-2 min-h-[300px]">
                                <iframe
                                    title="Email HTML Preview"
                                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1e293b;line-height:1.6;padding:12px;margin:0;word-break:break-word;}img{max-width:100%;height:auto;${remoteResourcesBlocked ? "filter:blur(2px);opacity:0.6;" : ""}}</style></head><body>${mail.html}</body></html>`}
                                    className="w-full min-h-[480px] border-none rounded-xl"
                                    sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                                />
                            </div>
                        ) : (
                            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200/60 font-sans text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                                {mail.text || mail.snippet || "(Empty email body)"}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* ── MODALS ── */}
            <ShowSourceModal
                email={mail}
                isOpen={showSourceModal}
                onClose={() => setShowSourceModal(false)}
            />

            <SummaryModal
                email={mail}
                isOpen={showSummaryModal}
                onClose={() => setShowSummaryModal(false)}
                onReply={handleReply}
            />

            <HeadersModal
                email={mail}
                isOpen={showHeadersModal}
                onClose={() => setShowHeadersModal(false)}
            />

            <ImageLightboxModal
                imageUrl={lightboxImage?.url || null}
                filename={lightboxImage?.filename}
                isOpen={Boolean(lightboxImage)}
                onClose={() => setLightboxImage(null)}
            />

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
                    <div className="px-4 py-3 bg-[#0A2540] text-white flex items-center justify-between shrink-0">
                        <span className="text-xs font-bold tracking-wide flex items-center gap-2">
                            <Send className="w-3.5 h-3.5 text-indigo-400" />
                            {composeData.subject ? composeData.subject : "New Message"}
                        </span>

                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsComposeMinimized(!isComposeMinimized)} className="p-1 text-slate-300 hover:text-indigo-300">
                                <Minimize2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setIsComposeExpanded(!isComposeExpanded)} className="p-1 text-slate-300 hover:text-indigo-300">
                                <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setIsComposeOpen(false)} className="p-1 text-slate-300 hover:text-rose-400">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {!isComposeMinimized && (
                        <form onSubmit={handleSendEmail} className="flex-1 flex flex-col overflow-hidden bg-white">
                            <div className="p-3 border-b border-slate-100 space-y-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="w-12 text-slate-400 font-bold uppercase text-[10px]">To</span>
                                    <input
                                        type="text"
                                        value={composeData.to}
                                        onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                                        required
                                        className="flex-1 px-2 py-1 text-xs font-semibold focus:outline-none border-b border-transparent focus:border-indigo-500"
                                    />
                                </div>
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
                                value={composeData.body}
                                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                                className="flex-1 p-4 text-xs leading-relaxed font-sans focus:outline-none resize-none"
                            />

                            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
                                <button type="button" onClick={() => setIsComposeOpen(false)} className="px-3 py-1.5 text-xs text-slate-500">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSending}
                                    className="px-5 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50"
                                >
                                    {isSending ? "Sending..." : "Send"}
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
        <Suspense fallback={<div className="h-screen flex items-center justify-center bg-slate-100"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>}>
            <EmailDetailPageContent paramsPromise={params} />
        </Suspense>
    );
}
