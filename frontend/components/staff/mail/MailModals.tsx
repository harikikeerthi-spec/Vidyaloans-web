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
    ExternalLink,
    Ban,
    Clock,
    PenTool,
    Sliders,
    Palette,
    Plus,
    Trash2,
    Calendar,
    CheckCircle2,
    AlertCircle,
    Cloud,
    HardDrive,
    Database,
    Inbox,
    Send,
    Server
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

// ── 6. BLOCK SENDER (BLACKLIST) MODAL ──
export function BlockSenderModal({
    senderEmail,
    isOpen,
    onClose,
    onConfirmBlock,
}: {
    senderEmail: string;
    isOpen: boolean;
    onClose: () => void;
    onConfirmBlock: (target: string, type: "sender" | "domain", moveToJunk: boolean) => void;
}) {
    const domain = senderEmail?.includes("@") ? senderEmail.split("@")[1] : "";
    const [blockType, setBlockType] = useState<"sender" | "domain">("sender");
    const [moveToJunk, setMoveToJunk] = useState(true);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-200/80 overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-rose-700 to-rose-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center">
                            <Ban className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider">Block Sender & Domain</h3>
                            <p className="text-[10px] text-rose-100">Add to mailbox blacklist</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed">
                        Future incoming messages matching this rule will automatically be blocked or routed directly to your <strong>Junk / Spam</strong> folder.
                    </p>

                    <div className="space-y-2">
                        <label
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                blockType === "sender"
                                    ? "bg-rose-50/60 border-rose-300 shadow-2xs"
                                    : "border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                            <input
                                type="radio"
                                name="blockType"
                                checked={blockType === "sender"}
                                onChange={() => setBlockType("sender")}
                                className="mt-0.5 text-rose-600 focus:ring-rose-500"
                            />
                            <div>
                                <span className="text-xs font-bold text-slate-800 block">Block this specific sender</span>
                                <span className="text-[11px] font-mono text-slate-500 truncate block mt-0.5">{senderEmail}</span>
                            </div>
                        </label>

                        {domain && (
                            <label
                                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                    blockType === "domain"
                                        ? "bg-rose-50/60 border-rose-300 shadow-2xs"
                                        : "border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="blockType"
                                    checked={blockType === "domain"}
                                    onChange={() => setBlockType("domain")}
                                    className="mt-0.5 text-rose-600 focus:ring-rose-500"
                                />
                                <div>
                                    <span className="text-xs font-bold text-slate-800 block">Block entire domain</span>
                                    <span className="text-[11px] font-mono text-slate-500 truncate block mt-0.5">@{domain}</span>
                                </div>
                            </label>
                        )}
                    </div>

                    <label className="flex items-center gap-2 pt-2 border-t border-slate-100 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={moveToJunk}
                            onChange={(e) => setMoveToJunk(e.target.checked)}
                            className="rounded text-rose-600 focus:ring-rose-500"
                        />
                        <span className="text-xs font-medium text-slate-700">Move all existing messages from this sender to Junk</span>
                    </label>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            const target = blockType === "domain" && domain ? `@${domain}` : senderEmail;
                            onConfirmBlock(target, blockType, moveToJunk);
                            onClose();
                        }}
                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                    >
                        Confirm Block
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 7. SAFE SENDER (WHITELIST) MODAL ──
export function SafeSenderModal({
    senderEmail,
    isOpen,
    onClose,
    onConfirmSafe,
}: {
    senderEmail: string;
    isOpen: boolean;
    onClose: () => void;
    onConfirmSafe: (target: string, type: "sender" | "domain") => void;
}) {
    const domain = senderEmail?.includes("@") ? senderEmail.split("@")[1] : "";
    const [safeType, setSafeType] = useState<"sender" | "domain">("sender");

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-emerald-200/80 overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-emerald-700 to-teal-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-white/15 flex items-center justify-center">
                            <ShieldCheck className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider">Add to Safe Senders (Whitelist)</h3>
                            <p className="text-[10px] text-emerald-100">Never treat as junk/spam</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <p className="text-xs text-slate-600 leading-relaxed">
                        Emails from trusted senders bypass spam heuristics, are delivered straight to your primary inbox, and remote images can be automatically displayed.
                    </p>

                    <div className="space-y-2">
                        <label
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                safeType === "sender"
                                    ? "bg-emerald-50/60 border-emerald-300 shadow-2xs"
                                    : "border-slate-200 hover:bg-slate-50"
                            }`}
                        >
                            <input
                                type="radio"
                                name="safeType"
                                checked={safeType === "sender"}
                                onChange={() => setSafeType("sender")}
                                className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                            />
                            <div>
                                <span className="text-xs font-bold text-slate-800 block">Trust this specific sender</span>
                                <span className="text-[11px] font-mono text-slate-500 truncate block mt-0.5">{senderEmail}</span>
                            </div>
                        </label>

                        {domain && (
                            <label
                                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                    safeType === "domain"
                                        ? "bg-emerald-50/60 border-emerald-300 shadow-2xs"
                                        : "border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="safeType"
                                    checked={safeType === "domain"}
                                    onChange={() => setSafeType("domain")}
                                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                                />
                                <div>
                                    <span className="text-xs font-bold text-slate-800 block">Trust entire organization / domain</span>
                                    <span className="text-[11px] font-mono text-slate-500 truncate block mt-0.5">@{domain}</span>
                                </div>
                            </label>
                        )}
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            const target = safeType === "domain" && domain ? `@${domain}` : senderEmail;
                            onConfirmSafe(target, safeType);
                            onClose();
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                    >
                        Add to Safe Senders
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 8. OUT OF OFFICE (VACATION RESPONDER) MODAL ──
export function OutOfOfficeModal({
    isOpen,
    onClose,
    onSave,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: { isEnabled: boolean; startDate: string; endDate: string; subject: string; message: string }) => void;
}) {
    const today = new Date().toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const [isEnabled, setIsEnabled] = useState(false);
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(nextWeek);
    const [subject, setSubject] = useState("Automatic Reply: I am currently Out of Office");
    const [message, setMessage] = useState(
        "Thank you for contacting VidyaLoans. I am currently out of the office with limited access to email. If your inquiry is urgent regarding a pending education loan application, please contact support@vidyaloans.in or our escalation desk.\n\nWarm regards,\nVidyaLoans Team"
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider">Auto-reply / Out of Office</h3>
                            <p className="text-[10px] text-amber-100">Automatic vacation responder</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                    {/* Toggle */}
                    <div className="flex items-center justify-between p-3.5 bg-amber-50/60 rounded-xl border border-amber-200">
                        <div>
                            <span className="text-xs font-bold text-amber-950 block">Send automatic replies</span>
                            <span className="text-[11px] text-amber-800">Replies will be sent once to each sender within date range</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={(e) => setIsEnabled(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                        </label>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Start Date
                            </label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                End Date
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Subject */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Response Subject
                        </label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                    </div>

                    {/* Message Body */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Response Message
                        </label>
                        <textarea
                            rows={5}
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans leading-relaxed focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                        />
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onSave({ isEnabled, startDate, endDate, subject, message });
                            onClose();
                        }}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                    >
                        Save Auto-Reply Settings
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 9. EMAIL SIGNATURES MANAGEMENT MODAL ──
export function SignaturesModal({
    isOpen,
    onClose,
    onSaveSignature,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSaveSignature?: (signature: { name: string; html: string; isDefault: boolean }) => void;
}) {
    const [name, setName] = useState("Primary Official Signature");
    const [title, setTitle] = useState("Relationship Manager");
    const [phone, setPhone] = useState("+91 98765 43210");
    const [department, setDepartment] = useState("Student Lending Desk");

    if (!isOpen) return null;

    const signaturePreview = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; font-size: 13px; line-height: 1.5; border-left: 3px solid #4F46E5; padding-left: 12px; margin-top: 16px;">
  <p style="margin: 0; font-weight: 700; color: #0f172a; font-size: 14px;">VidyaLoans Support Team</p>
  <p style="margin: 2px 0 0 0; color: #4F46E5; font-weight: 600; font-size: 12px;">${title} &bull; ${department}</p>
  <p style="margin: 4px 0 0 0; color: #64748b; font-size: 11px;">Direct: ${phone} | Web: <a href="https://vidyaloans.in" style="color: #4F46E5; text-decoration: none;">vidyaloans.in</a></p>
  <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;">VidyaLoans &bull; Empowering Higher Education Globally</p>
</div>
    `.trim();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-indigo-700 via-indigo-600 to-violet-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
                            <PenTool className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider">Email Signatures</h3>
                            <p className="text-[10px] text-indigo-100">Configure your official HTML signature</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Designation / Title
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Department / Unit
                            </label>
                            <input
                                type="text"
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                            Contact Number / Phone
                        </label>
                        <input
                            type="text"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                            Live Signature Preview
                        </label>
                        <div
                            className="p-4 bg-slate-50 rounded-xl border border-slate-200"
                            dangerouslySetInnerHTML={{ __html: signaturePreview }}
                        />
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onSaveSignature?.({ name, html: signaturePreview, isDefault: true });
                            onClose();
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                    >
                        Save Signature
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 10. MAIL RULES & AUTOMATION MODAL ──
export function MailRulesModal({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const [rules, setRules] = useState([
        { id: "1", name: "Flag Disbursal Confirmations", field: "Subject contains 'DISBURSAL'", action: "Star & Apply Green Tag", active: true },
        { id: "2", name: "Route DigiLocker Verifications", field: "From contains 'digilocker'", action: "Move to Dossier/ Folder", active: true },
        { id: "3", name: "Filter Promotional Newsletters", field: "Subject contains 'discount' or 'deal'", action: "Move to Archive", active: true },
    ]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-violet-700 via-violet-600 to-indigo-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
                            <Sliders className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider">Mail Rules & Server Automation</h3>
                            <p className="text-[10px] text-violet-100">Automated incoming mail routing (Sieve / Server Rules)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Active Rules ({rules.length})
                        </span>
                    </div>

                    {rules.map((rule) => (
                        <div key={rule.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                            <div>
                                <span className="text-xs font-bold text-slate-800 block">{rule.name}</span>
                                <span className="text-[11px] font-mono text-indigo-600 block mt-0.5">{rule.field}</span>
                                <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">&rarr; {rule.action}</span>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                                ACTIVE
                            </span>
                        </div>
                    ))}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 11. CONDITIONAL FORMATTING MODAL ──
export function ConditionalFormattingModal({
    isOpen,
    onClose,
}: {
    isOpen: boolean;
    onClose: () => void;
}) {
    const [rules, setRules] = useState([
        { id: "urgent", label: "Urgent & High Priority Messages", style: "Rose badge with red border accent", enabled: true },
        { id: "disbursals", label: "Disbursal & Sanction Documents", style: "Emerald badge with green border accent", enabled: true },
        { id: "partners", label: "Bank & NBFC Partner Domain (@avanse, @hdfcbank)", style: "Gold badge with VIP star", enabled: true },
        { id: "internal", label: "VidyaLoans Internal Staff (@vidyaloans.in)", style: "Indigo badge with Team tag", enabled: true },
    ]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-pink-600 to-rose-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center">
                            <Palette className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider">Conditional Formatting</h3>
                            <p className="text-[10px] text-pink-100">Visual highlighting for high-priority emails</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed">
                        Customize visual color tags and priority badges shown directly in the inbox list:
                    </p>

                    {rules.map((rule) => (
                        <label
                            key={rule.id}
                            className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/60 transition-all"
                        >
                            <input
                                type="checkbox"
                                checked={rule.enabled}
                                onChange={() => {
                                    setRules(rules.map((r) => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
                                }}
                                className="mt-0.5 text-pink-600 focus:ring-pink-500 rounded"
                            />
                            <div>
                                <span className="text-xs font-bold text-slate-800 block">{rule.label}</span>
                                <span className="text-[10px] text-slate-500 block mt-0.5">{rule.style}</span>
                            </div>
                        </label>
                    ))}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                    >
                        Apply Formatting
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── 12. STORAGE & QUOTA MANAGEMENT MODAL ──
export interface StorageDetails {
    usedBytes: number;
    quotaBytes: number;
    inboxBytes: number;
    spamBytes: number;
    trashBytes: number;
    sentBytes?: number;
    percentage: number;
    totalEmails: number;
    bucketName?: string;
}

function formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return "0 KB";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function StorageManagementModal({
    isOpen,
    onClose,
    storage,
    onEmptyTrash,
    onEmptySpam,
}: {
    isOpen: boolean;
    onClose: () => void;
    storage: StorageDetails;
    onEmptyTrash?: () => void;
    onEmptySpam?: () => void;
}) {
    const [confirmAction, setConfirmAction] = useState<"trash" | "spam" | null>(null);

    if (!isOpen) return null;

    const usedFormatted = formatBytes(storage.usedBytes);
    const quotaFormatted = formatBytes(storage.quotaBytes);
    const freeBytes = Math.max(0, storage.quotaBytes - storage.usedBytes);
    const freeFormatted = formatBytes(freeBytes);

    // Calculate percentage breakdown for stacked progress bar
    const inboxPct = Math.max(1, (storage.inboxBytes / storage.quotaBytes) * 100);
    const sentPct = Math.max(0, ((storage.sentBytes || 0) / storage.quotaBytes) * 100);
    const spamPct = (storage.spamBytes / storage.quotaBytes) * 100;
    const trashPct = (storage.trashBytes / storage.quotaBytes) * 100;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="p-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20 shadow-inner">
                            <Cloud className="w-5 h-5 text-indigo-300" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                                Mailbox Cloud Storage & Quota
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Healthy
                                </span>
                            </h3>
                            <p className="text-[11px] text-indigo-200/80">
                                AWS S3 Standard Storage &bull; Enterprise Mail Quota
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
                    {/* Storage Summary Gauge Card */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/90 shadow-2xs space-y-3">
                        <div className="flex items-baseline justify-between">
                            <div>
                                <span className="text-2xl font-black text-slate-800 tracking-tight">
                                    {usedFormatted}
                                </span>
                                <span className="text-xs font-semibold text-slate-500 ml-1.5">
                                    of {quotaFormatted} used
                                </span>
                            </div>
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {storage.percentage.toFixed(1)}% Quota
                            </span>
                        </div>

                        {/* Multi-segment Progress Bar */}
                        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                            <div
                                style={{ width: `${Math.min(100, inboxPct)}%` }}
                                className="bg-indigo-600 transition-all duration-500"
                                title={`Inbox: ${formatBytes(storage.inboxBytes)}`}
                            />
                            <div
                                style={{ width: `${Math.min(100, sentPct)}%` }}
                                className="bg-blue-500 transition-all duration-500"
                                title={`Sent: ${formatBytes(storage.sentBytes || 0)}`}
                            />
                            <div
                                style={{ width: `${Math.min(100, spamPct)}%` }}
                                className="bg-amber-500 transition-all duration-500"
                                title={`Spam: ${formatBytes(storage.spamBytes)}`}
                            />
                            <div
                                style={{ width: `${Math.min(100, trashPct)}%` }}
                                className="bg-rose-500 transition-all duration-500"
                                title={`Trash: ${formatBytes(storage.trashBytes)}`}
                            />
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-600">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                                <span>Inbox ({formatBytes(storage.inboxBytes)})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                                <span>Sent ({formatBytes(storage.sentBytes || 0)})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                                <span>Spam ({formatBytes(storage.spamBytes)})</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                <span>Trash ({formatBytes(storage.trashBytes)})</span>
                            </div>
                            <div className="ml-auto text-slate-400 font-medium">
                                {freeFormatted} available
                            </div>
                        </div>
                    </div>

                    {/* Breakdown & Cleanup Actions */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                            Folder Breakdown & Space Recovery
                        </h4>
                        <div className="space-y-2">
                            {/* Inbox */}
                            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                        <Inbox className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">Inbox & Archives</p>
                                        <p className="text-[10px] text-slate-500">Active incoming conversations</p>
                                    </div>
                                </div>
                                <span className="text-xs font-mono font-bold text-slate-700">
                                    {formatBytes(storage.inboxBytes)}
                                </span>
                            </div>

                            {/* Sent */}
                            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50/50 transition-colors">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                        <Send className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">Sent Messages</p>
                                        <p className="text-[10px] text-slate-500">Outbound dispatch via SES</p>
                                    </div>
                                </div>
                                <span className="text-xs font-mono font-bold text-slate-700">
                                    {formatBytes(storage.sentBytes || 0)}
                                </span>
                            </div>

                            {/* Trash (With Clean up Action) */}
                            <div className="flex items-center justify-between p-3 rounded-xl border border-rose-100 bg-rose-50/30">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">Deleted Items (Trash)</p>
                                        <p className="text-[10px] text-slate-500">
                                            {formatBytes(storage.trashBytes)} stored
                                        </p>
                                    </div>
                                </div>
                                {confirmAction === "trash" ? (
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => {
                                                onEmptyTrash?.();
                                                setConfirmAction(null);
                                            }}
                                            className="px-2.5 py-1 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                                        >
                                            Confirm Empty
                                        </button>
                                        <button
                                            onClick={() => setConfirmAction(null)}
                                            className="px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200/70 rounded-lg cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setConfirmAction("trash")}
                                        disabled={storage.trashBytes === 0}
                                        className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100/70 rounded-lg border border-rose-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        Empty Trash
                                    </button>
                                )}
                            </div>

                            {/* Spam (With Clean up Action) */}
                            <div className="flex items-center justify-between p-3 rounded-xl border border-amber-100 bg-amber-50/30">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                                        <ShieldAlert className="w-3.5 h-3.5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">Junk / Spam</p>
                                        <p className="text-[10px] text-slate-500">
                                            {formatBytes(storage.spamBytes)} stored
                                        </p>
                                    </div>
                                </div>
                                {confirmAction === "spam" ? (
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            onClick={() => {
                                                onEmptySpam?.();
                                                setConfirmAction(null);
                                            }}
                                            className="px-2.5 py-1 text-[11px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors cursor-pointer shadow-2xs"
                                        >
                                            Confirm Clear
                                        </button>
                                        <button
                                            onClick={() => setConfirmAction(null)}
                                            className="px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-200/70 rounded-lg cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setConfirmAction("spam")}
                                        disabled={storage.spamBytes === 0}
                                        className="px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100/70 rounded-lg border border-amber-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        Clear Spam
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Cloud Storage Infrastructure Card */}
                    <div className="p-3.5 rounded-xl bg-slate-900 text-slate-200 text-xs space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="font-bold text-white flex items-center gap-1.5">
                                <Database className="w-3.5 h-3.5 text-indigo-400" />
                                Cloud Storage Infrastructure
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                S3 Encrypted
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
                            <div>
                                <span className="text-slate-400 block text-[10px]">Bucket Name</span>
                                <span className="font-mono font-semibold text-white truncate block">
                                    {storage.bucketName || "vidyaloans-incoming-emails"}
                                </span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[10px]">AWS Region</span>
                                <span className="font-semibold text-white">ap-south-1 (Mumbai)</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[10px]">Total Messages</span>
                                <span className="font-semibold text-white">{storage.totalEmails} objects</span>
                            </div>
                            <div>
                                <span className="text-slate-400 block text-[10px]">Auto-Retention</span>
                                <span className="font-semibold text-white">Trash purged in 30 days</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[11px] text-slate-500">
                        Need more storage? Contact system administrator.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}


