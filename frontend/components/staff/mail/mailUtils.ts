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
