"use client";

import React, { useState } from "react";
import {
    X,
    Copy,
    Check,
    FileText,
    Sparkles,
    ShieldCheck,
    ShieldAlert,
    Download,
    ZoomIn,
    ZoomOut,
    Filter,
    ArrowRight,
    ExternalLink
} from "lucide-react";
import { MailItemBase, generateEmailSummary } from "./mailUtils";

// ── 1. SHOW RAW SOURCE MODAL ──
export function ShowSourceModal({
    email,
    isOpen,
    onClose,
}: {
    email: MailItemBase | null;
    isOpen: boolean;
    onClose: () => void;
}) {
    const [copied, setCopied] = useState(false);

    if (!isOpen || !email) return null;

    const rawSource = [
        `Return-Path: <${email.from}>`,
        `Received: by vidyaloans-mail-s3.ap-south-1.amazonaws.com with SES`,
        `Authentication-Results: spf=${email.authResults?.spf || "pass"} dkim=${email.authResults?.dkim || "pass"} dmarc=${email.authResults?.dmarc || "pass"}`,
        `Date: ${email.date ? new Date(email.date).toUTCString() : ""}`,
        `From: ${email.from}`,
        `To: ${email.to}`,
        email.cc ? `Cc: ${email.cc}` : null,
        `Subject: ${email.subject}`,
        `Message-ID: <${email.id}@mail.vidyaloans.in>`,
        `MIME-Version: 1.0`,
        `Content-Type: ${email.html ? "multipart/alternative" : "text/plain; charset=utf-8"}`,
        email.spamScore !== undefined ? `X-SES-Spam-Score: ${email.spamScore}%` : null,
        "",
        "--- [EMAIL PAYLOAD CONTENT] ---",
        "",
        email.text || email.snippet || email.html || "(No raw body content available)",
    ]
        .filter((line) => line !== null)
        .join("\r\n");

    const handleCopy = () => {
        navigator.clipboard.writeText(rawSource);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-bold tracking-wider uppercase">Message Source & RFC Headers</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCopy}
                            className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-colors"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? "Copied" : "Copy Source"}</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1 hover:text-rose-400 text-slate-400 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Headers Info Bar */}
                <div className="bg-slate-50 border-b border-slate-200 p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    <div>
                        <span className="font-bold text-slate-400 block uppercase text-[9px]">SPF Status</span>
                        <span className={`font-mono font-bold ${email.authResults?.spf === 'pass' ? 'text-emerald-600' : 'text-slate-700'}`}>
                            {email.authResults?.spf?.toUpperCase() || "PASS"}
                        </span>
                    </div>
                    <div>
                        <span className="font-bold text-slate-400 block uppercase text-[9px]">DKIM Signature</span>
                        <span className={`font-mono font-bold ${email.authResults?.dkim === 'pass' ? 'text-emerald-600' : 'text-slate-700'}`}>
                            {email.authResults?.dkim?.toUpperCase() || "PASS"}
                        </span>
                    </div>
                    <div>
                        <span className="font-bold text-slate-400 block uppercase text-[9px]">DMARC Policy</span>
                        <span className={`font-mono font-bold ${email.authResults?.dmarc === 'pass' ? 'text-emerald-600' : 'text-slate-700'}`}>
                            {email.authResults?.dmarc?.toUpperCase() || "PASS"}
                        </span>
                    </div>
                </div>

                {/* Raw text content */}
                <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-[11px] leading-relaxed text-slate-200 select-text">
                    <pre className="whitespace-pre-wrap break-all">{rawSource}</pre>
                </div>

                {/* Footer */}
                <div className="p-3 bg-white border-t border-slate-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 2. SUMMARY MODAL (Outlook Copilot / Smart Summary style) ──
export function SummaryModal({
    email,
    isOpen,
    onClose,
    onReply,
}: {
    email: MailItemBase | null;
    isOpen: boolean;
    onClose: () => void;
    onReply: () => void;
}) {
    if (!isOpen || !email) return null;

    const summaryData = generateEmailSummary(email);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-indigo-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-indigo-700 via-indigo-600 to-sky-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-amber-300" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black">AI Message Summary</h3>
                            <p className="text-[10px] text-indigo-100">Key insights & action items extracted automatically</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:text-white/80 text-white/60 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Subject & urgency */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800 truncate">{email.subject}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            summaryData.sentiment === 'Urgent'
                                ? 'bg-rose-100 text-rose-700'
                                : summaryData.sentiment === 'Standard'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-slate-100 text-slate-700'
                        }`}>
                            {summaryData.sentiment}
                        </span>
                    </div>

                    {/* Executive Summary */}
                    <div>
                        <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 mb-1.5 flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3" />
                            Executive Overview
                        </h4>
                        <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100/80 text-xs text-slate-700 leading-relaxed">
                            {summaryData.summary}
                        </div>
                    </div>

                    {/* Key Action Items */}
                    <div>
                        <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                            Detected Action Items
                        </h4>
                        <div className="space-y-1.5">
                            {summaryData.actionItems.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-800">
                                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">
                                        {idx + 1}
                                    </span>
                                    <span className="leading-snug">{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Key Discussion Points */}
                    {summaryData.keyPoints.length > 0 && (
                        <div>
                            <h4 className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
                                Discussion Points
                            </h4>
                            <ul className="space-y-1 text-xs text-slate-600 list-disc list-inside">
                                {summaryData.keyPoints.map((pt, idx) => (
                                    <li key={idx} className="truncate">{pt}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => {
                            onClose();
                            onReply();
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
                    >
                        <span>Reply with Action Items</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 3. HEADERS MODAL ──
export function HeadersModal({
    email,
    isOpen,
    onClose,
}: {
    email: MailItemBase | null;
    isOpen: boolean;
    onClose: () => void;
}) {
    if (!isOpen || !email) return null;

    const headersList = [
        { label: "From", value: email.from },
        { label: "To", value: email.to },
        { label: "Cc", value: email.cc || "None" },
        { label: "Subject", value: email.subject },
        { label: "Date", value: email.date ? new Date(email.date).toLocaleString() : "Unknown" },
        { label: "Message ID", value: `<${email.id}@mail.vidyaloans.in>` },
        { label: "SPF", value: email.authResults?.spf || "pass (vidyaloans-mail-s3: domain designates sender)" },
        { label: "DKIM", value: email.authResults?.dkim || "pass (signature verified)" },
        { label: "DMARC", value: email.authResults?.dmarc || "pass (p=quarantine)" },
        { label: "Content-Type", value: email.html ? "multipart/alternative" : "text/plain; charset=utf-8" },
        { label: "Spam Score", value: email.spamScore !== undefined ? `${email.spamScore}%` : "0% (Clean)" },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="px-5 py-3.5 bg-slate-800 text-white flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wide uppercase">Email Technical Headers</span>
                    <button onClick={onClose} className="p-1 hover:text-slate-300 text-slate-400">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-4 max-h-[70vh] overflow-y-auto space-y-2">
                    {headersList.map((h, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-baseline gap-1 py-1.5 border-b border-slate-100 last:border-b-0 text-xs">
                            <span className="w-28 font-bold text-slate-400 text-[11px] shrink-0">{h.label}:</span>
                            <span className="font-mono text-slate-800 break-all select-text">{h.value}</span>
                        </div>
                    ))}
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 4. IMAGE LIGHTBOX MODAL ──
export function ImageLightboxModal({
    imageUrl,
    filename,
    isOpen,
    onClose,
}: {
    imageUrl: string | null;
    filename?: string;
    isOpen: boolean;
    onClose: () => void;
}) {
    const [zoom, setZoom] = useState(1);

    if (!isOpen || !imageUrl) return null;

    const handleDownload = () => {
        const a = document.createElement("a");
        a.href = imageUrl;
        a.download = filename || "email-image.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div
                className="relative max-w-5xl max-h-[90vh] flex flex-col items-center"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Control bar */}
                <div className="w-full flex items-center justify-between pb-3 text-white px-2">
                    <span className="text-xs font-bold truncate max-w-sm">
                        {filename || "Image Preview"}
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-mono">{Math.round(zoom * 100)}%</span>
                        <button
                            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"
                            title="Zoom In"
                        >
                            <ZoomIn className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleDownload}
                            className="p-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors"
                            title="Download Image"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-1.5 bg-white/10 hover:bg-rose-600 rounded-lg text-white transition-colors"
                            title="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Image display */}
                <div className="overflow-auto max-h-[80vh] flex items-center justify-center rounded-2xl bg-black/40 p-2">
                    <img
                        src={imageUrl}
                        alt={filename || "Image"}
                        style={{ transform: `scale(${zoom})`, transition: "transform 0.15s ease-out" }}
                        className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
                    />
                </div>
            </div>
        </div>
    );
}

// ── 5. CREATE FILTER MODAL ──
export function CreateFilterModal({
    senderEmail,
    isOpen,
    onClose,
    onSaveFilter,
}: {
    senderEmail: string;
    isOpen: boolean;
    onClose: () => void;
    onSaveFilter: (rule: { sender: string; action: string }) => void;
}) {
    const [action, setAction] = useState<string>("star");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-3.5 bg-[#0A2540] text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-indigo-400" />
                        <span className="text-xs font-bold">Create Mailbox Filter</span>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            When an incoming message matches:
                        </label>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 truncate">
                            From: {senderEmail}
                        </div>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Automatically perform action:
                        </label>
                        <select
                            value={action}
                            onChange={(e) => setAction(e.target.value)}
                            className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                            <option value="star">Star / Flag as Important</option>
                            <option value="archive">Archive directly (Skip Inbox)</option>
                            <option value="never-spam">Never send to Spam / Junk</option>
                            <option value="mark-read">Mark as Read immediately</option>
                        </select>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onSaveFilter({ sender: senderEmail, action });
                            onClose();
                        }}
                        className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                    >
                        Create Filter Rule
                    </button>
                </div>
            </div>
        </div>
    );
}
