/**
 * Mail Utility functions for Outlook Features:
 * - EML file export
 * - iCalendar (.ics) event export
 * - Timestamp formatting (Outlook style: "Today 18:07", "Yesterday 15:43", etc.)
 * - AI / smart summary extraction
 */

import { format, isToday, isYesterday, isThisYear } from "date-fns";

export interface MailItemBase {
    id: string;
    from: string;
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    date: string;
    snippet?: string;
    text?: string;
    html?: string;
    attachments?: { filename: string; contentType?: string; size: number; content?: string }[];
    authResults?: {
        spf?: string;
        dkim?: string;
        dmarc?: string;
    };
    spamScore?: number;
    spamReasons?: string[];
}

export interface ParsedContact {
    displayName: string;
    email: string;
    initials: string;
}

export function parseEmailContact(raw: string): ParsedContact {
    if (!raw || typeof raw !== "string") {
        return { displayName: "Unknown", email: "", initials: "?" };
    }
    const trimmed = raw.trim();

    // Pattern: "Display Name <email@domain.com>" or Display Name <email@domain.com>
    const angleMatch = trimmed.match(/^(?:["']?([^"']+)["']?\s*)?<([^>]+)>$/);
    if (angleMatch) {
        const namePart = (angleMatch[1] || "").trim();
        const emailPart = (angleMatch[2] || "").trim();
        const displayName = namePart || emailPart.split("@")[0] || emailPart;
        return {
            displayName,
            email: emailPart,
            initials: getContactInitials(displayName)
        };
    }

    // Pattern: Just an email "user@domain.com"
    if (trimmed.includes("@")) {
        const emailPart = trimmed;
        const localPart = emailPart.split("@")[0].replace(/[._-]/g, " ");
        const formatted = localPart.replace(/\b\w/g, (c) => c.toUpperCase());
        return {
            displayName: formatted || emailPart,
            email: emailPart,
            initials: getContactInitials(formatted || emailPart)
        };
    }

    // Pattern: Just a name or title like "University HUB" or "Hostinger"
    return {
        displayName: trimmed,
        email: trimmed,
        initials: getContactInitials(trimmed)
    };
}

function getContactInitials(text: string): string {
    if (!text) return "??";
    const cleaned = text.replace(/[^a-zA-Z0-9\s]/g, " ").trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length === 1) {
        return parts[0].toUpperCase();
    }
    return "??";
}

export function getAvatarPalette(seed: string): { bg: string; text: string; border: string; ring: string } {
    const palettes = [
        { bg: "from-blue-600 to-indigo-700", text: "text-white", border: "border-blue-400/40", ring: "ring-blue-100" },
        { bg: "from-violet-600 to-purple-700", text: "text-white", border: "border-violet-400/40", ring: "ring-violet-100" },
        { bg: "from-emerald-600 to-teal-700", text: "text-white", border: "border-emerald-400/40", ring: "ring-emerald-100" },
        { bg: "from-amber-600 to-orange-600", text: "text-white", border: "border-amber-400/40", ring: "ring-amber-100" },
        { bg: "from-rose-600 to-pink-700", text: "text-white", border: "border-rose-400/40", ring: "ring-rose-100" },
        { bg: "from-cyan-600 to-blue-700", text: "text-white", border: "border-cyan-400/40", ring: "ring-cyan-100" },
        { bg: "from-indigo-600 to-violet-700", text: "text-white", border: "border-indigo-400/40", ring: "ring-indigo-100" },
        { bg: "from-teal-600 to-emerald-700", text: "text-white", border: "border-teal-400/40", ring: "ring-teal-100" },
    ];
    let hash = 0;
    for (let i = 0; i < (seed || "").length; i++) {
        hash = (hash << 5) - hash + seed.charCodeAt(i);
        hash |= 0;
    }
    return palettes[Math.abs(hash) % palettes.length];
}

/** Format timestamp like Outlook: "Today 18:07", "Yesterday 15:43", "Mon 14:02", or "15 Aug 2025" */
export function formatOutlookDate(dateStr: string): string {
    if (!dateStr) return "";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;

        if (isToday(d)) {
            return `Today ${format(d, "HH:mm")}`;
        }
        if (isYesterday(d)) {
            return `Yesterday ${format(d, "HH:mm")}`;
        }
        if (isThisYear(d)) {
            return format(d, "d MMM HH:mm");
        }
        return format(d, "dd/MM/yyyy HH:mm");
    } catch {
        return dateStr;
    }
}

/** Export email as standard RFC 822 .eml file */
export function exportEmailToEml(email: MailItemBase) {
    try {
        const boundary = `----=_Part_${Date.now()}`;
        const cleanFrom = email.from || "unknown@domain.com";
        const cleanTo = email.to || "recipient@domain.com";
        const cleanSubject = email.subject || "(No Subject)";
        const cleanDate = email.date ? new Date(email.date).toUTCString() : new Date().toUTCString();

        let emlContent = "";
        emlContent += `From: ${cleanFrom}\r\n`;
        emlContent += `To: ${cleanTo}\r\n`;
        if (email.cc) emlContent += `Cc: ${email.cc}\r\n`;
        emlContent += `Date: ${cleanDate}\r\n`;
        emlContent += `Subject: ${cleanSubject}\r\n`;
        emlContent += `MIME-Version: 1.0\r\n`;

        if (email.html) {
            emlContent += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;
            emlContent += `--${boundary}\r\n`;
            emlContent += `Content-Type: text/plain; charset="utf-8"\r\n\r\n`;
            emlContent += `${email.text || email.snippet || ""}\r\n\r\n`;
            emlContent += `--${boundary}\r\n`;
            emlContent += `Content-Type: text/html; charset="utf-8"\r\n\r\n`;
            emlContent += `${email.html}\r\n\r\n`;
            emlContent += `--${boundary}--\r\n`;
        } else {
            emlContent += `Content-Type: text/plain; charset="utf-8"\r\n\r\n`;
            emlContent += `${email.text || email.snippet || ""}\r\n`;
        }

        const blob = new Blob([emlContent], { type: "message/rfc822" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const safeTitle = (email.subject || "message").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 50);
        a.href = url;
        a.download = `${safeTitle}.eml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Failed to export EML", err);
        alert("Failed to export message as .eml");
    }
}

/** Export email as .ics Calendar Event */
export function saveEmailAsCalendarEvent(email: MailItemBase) {
    try {
        const now = new Date();
        const start = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
        const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 min duration

        const formatDateToIcs = (d: Date) =>
            d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

        const summary = `Follow-up: ${email.subject || "Email Task"}`;
        const description = `Regarding message from ${email.from}:\n\n${(email.snippet || email.text || "").substring(0, 300)}`;

        const icsData = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//VidyaLoans Staff Dashboard//Email Event//EN",
            "CALSCALE:GREGORIAN",
            "METHOD:REQUEST",
            "BEGIN:VEVENT",
            `UID:event-${Date.now()}@vidyaloans.in`,
            `DTSTAMP:${formatDateToIcs(now)}`,
            `DTSTART:${formatDateToIcs(start)}`,
            `DTEND:${formatDateToIcs(end)}`,
            `SUMMARY:${summary.replace(/\n/g, " ")}`,
            `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
            "STATUS:CONFIRMED",
            "END:VEVENT",
            "END:VCALENDAR",
        ].join("\r\n");

        const blob = new Blob([icsData], { type: "text/calendar;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const safeTitle = (email.subject || "event").replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 40);
        a.href = url;
        a.download = `${safeTitle}.ics`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error("Failed to generate ICS", err);
        alert("Failed to create calendar event");
    }
}

/** Generate an extractive summary and action items from email body */
export function generateEmailSummary(email: MailItemBase): {
    summary: string;
    keyPoints: string[];
    actionItems: string[];
    sentiment: "Urgent" | "Standard" | "Informational";
} {
    const text = (email.text || email.snippet || "").trim();
    const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 15 && !l.startsWith(">") && !l.startsWith("---"));

    // Key points
    const keyPoints = lines.slice(0, 3);
    if (keyPoints.length === 0) {
        keyPoints.push(email.subject || "Email correspondence");
    }

    // Action items detection
    const actionKeywords = ["please", "request", "kindly", "need", "require", "urgent", "action", "sign", "stamp", "verify", "submit", "approve", "disbursal", "review"];
    const actionItems: string[] = [];

    lines.forEach((line) => {
        const lower = line.toLowerCase();
        if (actionKeywords.some((kw) => lower.includes(kw))) {
            if (actionItems.length < 4 && !actionItems.includes(line)) {
                actionItems.push(line);
            }
        }
    });

    if (actionItems.length === 0) {
        actionItems.push("Review communication and respond if required.");
    }

    // Sentiment / urgency
    const isUrgent = /urgent|asap|immediate|critical|deadline|action required/i.test(email.subject + " " + text);
    const isDisbursal = /disbursal|loan|sanction|stamp|sign|bank/i.test(email.subject + " " + text);

    const sentiment = isUrgent ? "Urgent" : isDisbursal ? "Standard" : "Informational";

    return {
        summary: `Message regarding "${email.subject}" from ${email.from}. ${actionItems[0] ? `Primary request: ${actionItems[0]}` : ""}`,
        keyPoints,
        actionItems,
        sentiment,
    };
}
