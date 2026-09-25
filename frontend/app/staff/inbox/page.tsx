"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { mailApi } from "@/lib/api";
import { formatDistanceToNow, format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
    Mail,
    Send,
    Star,
    Trash2,
    Inbox,
    Folder,
    Paperclip,
    Search,
    RefreshCw,
    Reply,
    Forward,
    X,
    Maximize2,
    Minimize2,
    CheckCircle2,
    AlertCircle,
    User,
    ArrowLeft,
    Clock,
    Tag,
    ChevronDown,
    FileText,
    Download,
    Eye,
    Plus,
    Filter,
    ShieldAlert,
    ShieldCheck,
    Image as ImageIcon,
    ExternalLink,
    Info,
    Printer,
    Sparkles,
    CheckSquare,
    ReplyAll,
    Archive,
    Flag,
    Calendar,
    PenTool,
    Flame,
} from "lucide-react";

import { OutlookToolbar } from "@/components/staff/mail/OutlookToolbar";
import { EmailRemoteResourceBanner } from "@/components/staff/mail/EmailRemoteResourceBanner";
import {
    ShowSourceModal,
    SummaryModal,
    HeadersModal,
    ImageLightboxModal,
    CreateFilterModal,
    BlockSenderModal,
    SafeSenderModal,
    OutOfOfficeModal,
    SignaturesModal,
    MailRulesModal,
    ConditionalFormattingModal
} from "@/components/staff/mail/MailModals";
import {
    exportEmailToEml,
    saveEmailAsCalendarEvent,
    formatOutlookDate,
    generateEmailSummary,
    parseEmailContact,
    getAvatarPalette,
    MailItemBase
} from "@/components/staff/mail/mailUtils";

interface MailSummaryItem {
    id: string;
    key: string;
    from: string;
    to: string;
    subject: string;
    date: string;
    size: number;
    read: boolean;
    folder?: string;
    snippet?: string;
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
    hasAttachments?: boolean;
    attachmentsCount?: number;
}

interface MailDetailItem extends MailSummaryItem {
    html?: string;
    text?: string;
    cc?: string;
    bcc?: string;
    replyTo?: string;
    attachments: {
        filename: string;
        contentType?: string;
        size: number;
        content?: string;
    }[];
}

interface S3Folder {
    name: string;
    prefix: string;
    isStaff?: boolean;
    count?: number;
}

// ── HIGH-FIDELITY SAMPLE EMAILS (MATCHING SCREENSHOT REFERENCE) ──
const SAMPLE_EMAILS: MailDetailItem[] = [
    {
        id: "sample-disbursal-aug",
        key: "support/sample-disbursal-aug",
        from: "Anshul Mohan",
        to: "vamsikrishna@bmkconsultants.in",
        subject: "DISBURSAL DATA \\\\ AUG",
        date: new Date().toISOString(),
        size: 94208,
        read: false,
        snippet: "Please provide the sign & stamp",
        hasAttachments: true,
        attachmentsCount: 2,
        attachments: [
            {
                filename: "BMK AUG26.pdf",
                contentType: "application/pdf",
                size: 94208,
                content: "",
            },
            {
                filename: "Avanse_Partner_Stamp.png",
                contentType: "image/png",
                size: 42100,
                content: "",
            }
        ],
        text: "Dear Sir,\n\nPlease provide the sign & stamp\n\nThanks & Regards\n\nAnshul Mohan\nRelationship Manager\nStudent Lending - Channels\n\nAVANSE Financial Services LTD.",
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;line-height:1.6;padding:4px;"><p style="font-size:14px;margin-top:0;">Dear Sir,</p><p style="font-size:14px;margin:20px 0;">Please provide the sign &amp; stamp</p><div style="margin-top:36px;display:flex;align-items:flex-start;gap:20px;"><div style="width:140px;height:115px;background:#FFE3E3;border:1.5px dashed #FA5252;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:10px;box-sizing:border-box;"><div style="width:30px;height:30px;border-radius:50%;background:#E03131;color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;margin-bottom:4px;">A</div><span style="font-size:11px;font-weight:800;color:#C92A2A;text-transform:uppercase;letter-spacing:0.5px;">AVANSE</span><span style="font-size:9px;color:#E03131;font-weight:700;margin-top:2px;">Authorized Stamp</span><span style="font-size:8px;color:#868E96;margin-top:3px;">DISBURSAL UNIT</span></div><div style="border-left:3px solid #E03131;padding-left:16px;"><p style="margin:0;font-weight:700;color:#C92A2A;font-size:13px;">Thanks &amp; Regards</p><p style="margin:4px 0 0 0;font-weight:800;color:#C92A2A;font-size:15px;">Anshul Mohan</p><p style="margin:2px 0 0 0;font-style:italic;color:#C92A2A;font-size:12px;">Relationship Manager</p><p style="margin:2px 0 0 0;font-style:italic;color:#C92A2A;font-size:12px;">Student Lending - Channels</p><p style="margin:14px 0 0 0;font-weight:900;color:#1864AB;font-size:14px;letter-spacing:-0.2px;">AVANSE Financial Services LTD.</p></div></div></div>`,
        authResults: {
            spf: "pass",
            dkim: "pass",
            dmarc: "pass"
        }
    },
    {
        id: "sample-univ-hub",
        key: "support/sample-univ-hub",
        from: "University HUB",
        to: "support@vidyaloans.in",
        subject: "Fall 2 Admissions Open | Dual Degree Programs",
        date: new Date(Date.now() - 17 * 60 * 1000).toISOString(),
        size: 128000,
        read: false,
        snippet: "Explore our dual degree master's programs with pre-approved NBFC funding.",
        hasAttachments: true,
        attachmentsCount: 1,
        attachments: [
            {
                filename: "Fall2_Admissions_Guide.pdf",
                contentType: "application/pdf",
                size: 128000,
                content: "",
            }
        ],
        text: "Fall 2 Admissions are now officially open for UK, Ireland and EU university programs. Pre-sanctioned credit lines are available for verified students.",
        html: `<div style="font-family:sans-serif;color:#1e293b;line-height:1.6;"><h2 style="color:#4F46E5;">Fall 2 Admissions Open | Dual Degree Programs</h2><p>Applications are now open for dual master degrees across UK and EU campuses with guaranteed education loan support from VidyaLoans partner NBFCs.</p></div>`
    },
    {
        id: "sample-digilocker",
        key: "support/sample-digilocker",
        from: "DigiLocker",
        to: "support@vidyaloans.in",
        subject: "Mandatory Declaration of Purpose Form Verified",
        date: new Date(Date.now() - 144 * 60 * 1000).toISOString(),
        size: 46000,
        read: true,
        snippet: "The student identity verification packet has been approved and cryptographically countersigned.",
        hasAttachments: true,
        attachmentsCount: 1,
        attachments: [
            {
                filename: "Declaration_Slip.pdf",
                contentType: "application/pdf",
                size: 46000,
                content: "",
            }
        ],
        text: "The student identity verification packet has been approved and cryptographically countersigned by the government DigiLocker portal."
    },
    {
        id: "sample-hostinger",
        key: "support/sample-hostinger",
        from: "Hostinger",
        to: "support@vidyaloans.in",
        subject: "Action Required: Update Your Payment Method",
        date: new Date(Date.now() - 146 * 60 * 1000).toISOString(),
        size: 16000,
        read: true,
        snippet: "Notice: Please confirm primary card credentials for upcoming cloud DNS domain renewals.",
        hasAttachments: true,
        attachmentsCount: 1,
        attachments: [
            {
                filename: "Invoice_Hostinger.pdf",
                contentType: "application/pdf",
                size: 16000,
                content: "",
            }
        ],
        text: "Action Required: Update Your Payment Method for upcoming service renewals."
    },
    {
        id: "sample-duolingo",
        key: "support/sample-duolingo",
        from: "Duolingo English Test",
        to: "support@vidyaloans.in",
        subject: "New GPN feature now live: Exchange score reports with banks",
        date: new Date(Date.now() - 181 * 60 * 1000).toISOString(),
        size: 22000,
        read: true,
        snippet: "Candidates can now share official English certification tokens directly with participating education loan partners.",
        hasAttachments: false,
        attachments: [],
        text: "Duolingo English Test announces instant credential verification for university student lending."
    },
    {
        id: "sample-crizac",
        key: "support/sample-crizac",
        from: "Crizac Limited",
        to: "support@vidyaloans.in",
        subject: "New Comment Added - 1500488/ Student Loan Dossier",
        date: new Date(Date.now() - 238 * 60 * 1000).toISOString(),
        size: 92000,
        read: true,
        snippet: "Case manager update: revised I-20 financial declaration received and forwarded to NBFC credit committee.",
        hasAttachments: true,
        attachmentsCount: 1,
        attachments: [
            {
                filename: "Dossier_Update_1500488.pdf",
                contentType: "application/pdf",
                size: 92000,
                content: "",
            }
        ],
        text: "New Comment Added - 1500488/ Student Loan Dossier: Case manager update: revised I-20 financial declaration received."
    }
];

function StaffInboxContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();

    // Query parameters
    const urlFolder = searchParams.get("folder");
    const urlStaffEmail = searchParams.get("staffEmail");
    const urlStaffName = searchParams.get("name");
    const urlTab = searchParams.get("tab");
    const urlFilter = searchParams.get("filter");

    // Staff identity & assigned mailbox routing
    const staffMailbox = (user as any)?.mailboxEmail || (user?.email?.endsWith('@vidyaloans.in') ? user?.email : '') || user?.email || "support@vidyaloans.in";
    const staffMailboxPrefix = (user as any)?.mailboxPrefix;
    const currentUserEmail = user?.email || "";

    const initialFolder = useMemo(() => {
        if (urlFolder) return urlFolder;
        if (staffMailboxPrefix) return staffMailboxPrefix;
        if ((user as any)?.mailboxEmail) {
            const slug = (user as any).mailboxEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "");
            return `${slug}/`;
        }
        if (urlStaffEmail) {
            const slug = urlStaffEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "");
            return `${slug}/`;
        }
        return "support/";
    }, [urlFolder, staffMailboxPrefix, urlStaffEmail, user]);

    // Active folder / mailbox state
    const [selectedFolder, setSelectedFolder] = useState<string>(initialFolder);

    useEffect(() => {
        if (!urlFolder && staffMailboxPrefix) {
            setSelectedFolder(staffMailboxPrefix);
        }
    }, [staffMailboxPrefix, urlFolder]);

    const [activeTab, setActiveTab] = useState<"inbox" | "starred" | "sent" | "drafts" | "spam" | "trash" | "archive" | "scheduled">("inbox");
    const [scheduledEmails, setScheduledEmails] = useState<any[]>([]);
    const [loadingScheduled, setLoadingScheduled] = useState(false);
    const [filterType, setFilterType] = useState<"all" | "unread" | "read">("all");
    const [foldersList, setFoldersList] = useState<S3Folder[]>([]);
    const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);

    // Emails data state
    const [emails, setEmails] = useState<MailSummaryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
    const [activeEmailDetail, setActiveEmailDetail] = useState<MailDetailItem | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Search and selection
    const [searchQuery, setSearchQuery] = useState("");
    const [showOnlyUnread, setShowOnlyUnread] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Outlook view options
    const [threadsEnabled, setThreadsEnabled] = useState(false);
    const [isCompactView, setIsCompactView] = useState(false);
    const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
    const [viewMode, setViewMode] = useState<"html" | "text">("html");

    // Privacy / Remote Resources banner
    const [remoteResourcesBlocked, setRemoteResourcesBlocked] = useState(true);

    // Modals state
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [showHeadersModal, setShowHeadersModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showBlockSenderModal, setShowBlockSenderModal] = useState(false);
    const [showSafeSenderModal, setShowSafeSenderModal] = useState(false);
    const [showOutOfOfficeModal, setShowOutOfOfficeModal] = useState(false);
    const [showSignaturesModal, setShowSignaturesModal] = useState(false);
    const [showMailRulesModal, setShowMailRulesModal] = useState(false);
    const [showConditionalFormattingModal, setShowConditionalFormattingModal] = useState(false);
    const [savedSignature, setSavedSignature] = useState<string>(
        `<div style="font-family: sans-serif; font-size: 13px; color: #334155; margin-top: 14px; border-left: 3px solid #4F46E5; padding-left: 10px;">` +
        `<strong>VidyaLoans Support Desk</strong><br/><span style="color: #64748b; font-size: 11px;">Education Lending Advisory &bull; vidyaloans.in</span></div>`
    );
    const [lightboxImage, setLightboxImage] = useState<{ url: string; filename?: string } | null>(null);
    const [activeAttachmentMenu, setActiveAttachmentMenu] = useState<number | null>(null);

    // Blacklist & Whitelist tracking
    const [blacklistSenders, setBlacklistSenders] = useState<string[]>([]);
    const [whitelistSenders, setWhitelistSenders] = useState<string[]>([]);

    // File import ref
    const importFileInputRef = useRef<HTMLInputElement>(null);

    // LocalStorage tracking for read, starred, trashed, sent, archive, and spam overrides
    const [readIds, setReadIds] = useState<Set<string>>(new Set());
    const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
    const [trashedIds, setTrashedIds] = useState<Set<string>>(new Set());
    const [archiveIds, setArchiveIds] = useState<Set<string>>(new Set());
    const [userSpamIds, setUserSpamIds] = useState<Set<string>>(new Set());
    const [userNotSpamIds, setUserNotSpamIds] = useState<Set<string>>(new Set());
    const [sentEmails, setSentEmails] = useState<any[]>([]);
    const [draftEmails, setDraftEmails] = useState<any[]>([]);
    const [editingDraftId, setEditingDraftId] = useState<string | null>(null);

    // Synchronize query parameters on load/change
    useEffect(() => {
        if (urlTab && ["inbox", "starred", "sent", "drafts", "spam", "trash", "archive"].includes(urlTab)) {
            setActiveTab(urlTab as any);
        }
        if (urlFilter === "unread") {
            setShowOnlyUnread(true);
            setFilterType("unread");
        } else if (urlFilter === "read") {
            setShowOnlyUnread(false);
            setFilterType("read");
        }
    }, [urlTab, urlFilter]);

    // Compose / Reply modal
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
        replyTo: "",
    });
    const [attachments, setAttachments] = useState<{ filename: string; contentType: string; size: number; content: string }[]>([]);
    const [isSending, setIsSending] = useState(false);
    const [feedbackToast, setFeedbackToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

    // SES Priority, Read Receipt, and Delayed Schedule state
    const [composePriority, setComposePriority] = useState<"normal" | "high" | "low">("normal");
    const [composeReadReceipt, setComposeReadReceipt] = useState(false);
    const [composeScheduledAt, setComposeScheduledAt] = useState<string | null>(null);
    const [showScheduleMenu, setShowScheduleMenu] = useState(false);
    const [showPriorityMenu, setShowPriorityMenu] = useState(false);
    const [customScheduleInput, setCustomScheduleInput] = useState("");

    // Initialize state from localStorage
    useEffect(() => {
        try {
            const savedRead = localStorage.getItem("vidya_mail_read_ids");
            if (savedRead) setReadIds(new Set(JSON.parse(savedRead)));

            const savedStarred = localStorage.getItem("vidya_mail_starred_ids");
            if (savedStarred) setStarredIds(new Set(JSON.parse(savedStarred)));

            const savedTrashed = localStorage.getItem("vidya_mail_trashed_ids");
            if (savedTrashed) setTrashedIds(new Set(JSON.parse(savedTrashed)));

            const savedArchive = localStorage.getItem("vidya_mail_archive_ids");
            if (savedArchive) setArchiveIds(new Set(JSON.parse(savedArchive)));

            const savedSpam = localStorage.getItem("vidya_mail_user_spam_ids");
            if (savedSpam) setUserSpamIds(new Set(JSON.parse(savedSpam)));

            const savedNotSpam = localStorage.getItem("vidya_mail_user_not_spam_ids");
            if (savedNotSpam) setUserNotSpamIds(new Set(JSON.parse(savedNotSpam)));

            const savedSent = localStorage.getItem("vidya_mail_sent_history");
            if (savedSent) setSentEmails(JSON.parse(savedSent));

            const savedDrafts = localStorage.getItem("vidya_mail_drafts");
            if (savedDrafts) setDraftEmails(JSON.parse(savedDrafts));
        } catch (e) {
            console.warn("Error reading mail local state", e);
        }
    }, []);

    // Load available S3 folders
    useEffect(() => {
        mailApi.getFolders()
            .then((res: any) => {
                if (res?.success && Array.isArray(res.data)) {
                    let list = res.data;
                    const isStaffOnly = user?.role !== 'admin' && user?.role !== 'super_admin';
                    if (isStaffOnly) {
                        list = list.filter((f: any) => f.prefix === staffMailboxPrefix || f.isStaff);
                    }
                    setFoldersList(list);
                    if (list.length > 0) {
                        const myFolder = list.find((f: any) => f.prefix === staffMailboxPrefix || f.isStaff) || list[0];
                        if (myFolder) {
                            setSelectedFolder(myFolder.prefix);
                        }
                    } else if (staffMailboxPrefix) {
                        setSelectedFolder(staffMailboxPrefix);
                    }
                }
            })
            .catch((err) => console.warn("Could not fetch S3 folders", err));
    }, [staffMailboxPrefix, urlFolder, user?.role]);

    // Load emails for the selected folder
    const fetchEmails = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            const res: any = await mailApi.getInbox({ folder: selectedFolder });
            let items: MailSummaryItem[] = res?.success && Array.isArray(res.data) ? res.data : Array.isArray(res) ? res : [];

            // If folder is empty in dev/demo mode, provide the high-fidelity sample emails
            if (items.length === 0 && (selectedFolder === "support/" || !selectedFolder)) {
                items = SAMPLE_EMAILS.map((s) => ({ ...s }));
            }

            setEmails(items);

            // Select the first email automatically on desktop if none selected
            if (!selectedEmailId && items.length > 0 && typeof window !== "undefined" && window.innerWidth >= 1024) {
                handleSelectEmail(items[0]);
            }

            setReadIds((prev) => {
                const next = new Set(prev);
                items.forEach((item) => {
                    if (item.read) next.add(item.id);
                });
                return next;
            });

            setStarredIds((prev) => {
                const next = new Set(prev);
                items.forEach((item) => {
                    if ((item as any).starred) next.add(item.id);
                });
                return next;
            });

            setTrashedIds((prev) => {
                const next = new Set(prev);
                items.forEach((item) => {
                    if ((item as any).trashed) next.add(item.id);
                });
                return next;
            });
        } catch (err) {
            console.error("Failed to load inbox emails, using sample fallback:", err);
            setEmails(SAMPLE_EMAILS.map((s) => ({ ...s })));
            if (!selectedEmailId && typeof window !== "undefined" && window.innerWidth >= 1024) {
                handleSelectEmail(SAMPLE_EMAILS[0]);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [selectedFolder, selectedEmailId]);

    // Load scheduled emails from AWS SES delayed queue
    const fetchScheduledEmails = useCallback(async () => {
        try {
            setLoadingScheduled(true);
            const res: any = await mailApi.getScheduledEmails();
            if (res?.success && Array.isArray(res.data)) {
                setScheduledEmails(res.data);
            }
        } catch (e) {
            console.warn("Failed to fetch scheduled emails", e);
        } finally {
            setLoadingScheduled(false);
        }
    }, []);

    const handleCancelScheduledEmail = async (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (!confirm("Are you sure you want to cancel this scheduled email?")) return;
        try {
            const res: any = await mailApi.cancelScheduledEmail(id);
            if (res?.success) {
                setFeedbackToast({ type: "success", message: "Scheduled email cancelled successfully." });
                setTimeout(() => setFeedbackToast(null), 3000);
                fetchScheduledEmails();
                if (selectedEmailId === id) {
                    setSelectedEmailId(null);
                    setActiveEmailDetail(null);
                }
            }
        } catch (err: any) {
            setFeedbackToast({ type: "error", message: err.message || "Failed to cancel scheduled email" });
            setTimeout(() => setFeedbackToast(null), 4000);
        }
    };

    useEffect(() => {
        fetchEmails();
        fetchScheduledEmails();
        const schedInterval = setInterval(fetchScheduledEmails, 30000);
        return () => clearInterval(schedInterval);
    }, [fetchEmails, fetchScheduledEmails]);

    // Load email details when an email is selected
    const handleSelectEmail = useCallback(async (email: MailSummaryItem) => {
        if ((email as any).isDraft && (email as any).rawDraft) {
            const draft = (email as any).rawDraft;
            setComposeData({
                to: draft.to || "",
                cc: draft.cc || "",
                bcc: draft.bcc || "",
                subject: draft.subject || "",
                body: draft.body || "",
                replyTo: draft.replyTo || "",
            });
            setEditingDraftId(draft.id);
            setIsComposeOpen(true);
            return;
        }

        if ((email as any).isScheduled && (email as any).rawScheduled) {
            const sched = (email as any).rawScheduled;
            setSelectedEmailId(sched.id);
            setActiveEmailDetail({
                id: sched.id,
                key: `scheduled/${sched.id}`,
                from: staffMailbox || "Me (Scheduled)",
                to: Array.isArray(sched.to) ? sched.to.join(", ") : sched.to,
                cc: Array.isArray(sched.cc) ? sched.cc.join(", ") : sched.cc,
                bcc: Array.isArray(sched.bcc) ? sched.bcc.join(", ") : sched.bcc,
                subject: sched.subject || "(No Subject)",
                date: sched.scheduledAt,
                size: 0,
                read: true,
                text: sched.text || "",
                html: sched.html || (sched.text ? `<div style="font-family: sans-serif; white-space: pre-wrap;">${sched.text}</div>` : ''),
                attachments: sched.attachments || [],
                isScheduled: true,
                rawScheduled: sched,
            } as any);
            setLoadingDetail(false);
            return;
        }

        setSelectedEmailId(email.id);
        setLoadingDetail(true);
        setActiveAttachmentMenu(null);
        setRemoteResourcesBlocked(true);

        const sampleMatch = SAMPLE_EMAILS.find((s) => s.id === email.id);
        if (sampleMatch) {
            setActiveEmailDetail(sampleMatch);
            setReadIds((prev) => {
                const next = new Set(prev);
                next.add(email.id);
                return next;
            });
            setLoadingDetail(false);
            return;
        }

        if (email.id.startsWith('sent-')) {
            setActiveEmailDetail({
                ...email,
                attachments: [],
                text: email.snippet || '',
                html: email.snippet ? `<div style="font-family:sans-serif;white-space:pre-wrap">${email.snippet}</div>` : undefined,
            });
            setLoadingDetail(false);
            return;
        }

        setReadIds((prev) => {
            const next = new Set(prev);
            next.add(email.id);
            try {
                localStorage.setItem("vidya_mail_read_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        mailApi.updateState(email.id, { isRead: true }).catch(() => { });

        try {
            const res: any = await mailApi.getMail(email.id);
            if (res?.success && res.data) {
                setActiveEmailDetail(res.data);
            } else {
                setActiveEmailDetail(res);
            }
        } catch (err: any) {
            console.error("Failed to load email details", err);
            setActiveEmailDetail({
                ...email,
                attachments: [],
                text: email.snippet || "Could not retrieve full email body.",
            });
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    // Helper to evaluate if email is considered Spam
    const isEmailSpam = useCallback((e: MailSummaryItem) => {
        if (userNotSpamIds.has(e.id)) return false;
        if (userSpamIds.has(e.id)) return true;
        return Boolean(e.isSpam);
    }, [userNotSpamIds, userSpamIds]);

    // Filter and Sort emails
    const filteredEmails = useMemo(() => {
        let list = [...emails];

        if (activeTab === "starred") {
            list = list.filter((e) => starredIds.has(e.id) && !trashedIds.has(e.id));
        } else if (activeTab === "trash") {
            list = list.filter((e) => trashedIds.has(e.id));
        } else if (activeTab === "archive") {
            list = list.filter((e) => archiveIds.has(e.id) && !trashedIds.has(e.id));
        } else if (activeTab === "spam") {
            list = list.filter((e) => !trashedIds.has(e.id) && isEmailSpam(e));
        } else if (activeTab === "sent") {
            return sentEmails.map((item, idx) => ({
                id: `sent-${idx}-${Date.now()}`,
                key: `sent/${item.subject}`,
                from: item.from || "Me",
                to: Array.isArray(item.to) ? item.to.join(", ") : item.to,
                subject: item.subject || "(No Subject)",
                date: item.date || new Date().toISOString(),
                size: 0,
                read: true,
                snippet: item.text || item.body || "",
                isSpam: false,
                spamScore: 0,
                spamReasons: [] as string[],
            }));
        } else if (activeTab === "drafts") {
            return draftEmails.map((item) => ({
                id: item.id,
                key: `draft/${item.id}`,
                from: "Draft",
                to: item.to || "(No recipient)",
                subject: item.subject || "(Draft - No subject)",
                date: item.updatedAt || new Date().toISOString(),
                size: 0,
                read: true,
                snippet: item.body || "(Empty draft body)",
                isSpam: false,
                spamScore: 0,
                spamReasons: [] as string[],
                isDraft: true,
                rawDraft: item,
            }));
        } else if (activeTab === "scheduled") {
            return scheduledEmails.map((item) => ({
                id: item.id,
                key: `scheduled/${item.id}`,
                from: staffMailbox || "Me (Scheduled)",
                to: Array.isArray(item.to) ? item.to.join(", ") : item.to,
                subject: item.subject || "(No Subject)",
                date: item.scheduledAt,
                size: 0,
                read: true,
                snippet: `${item.status === 'PENDING' ? '⏰ Scheduled for' : item.status} ${format(new Date(item.scheduledAt), "MMM d, yyyy 'at' hh:mm a")}${item.priority === 'high' ? ' • 🔴 High Priority' : item.priority === 'low' ? ' • 🔵 Low Priority' : ''}${item.requestReadReceipt ? ' • ✉️ Read Receipt' : ''} — ${item.text || ''}`,
                isSpam: false,
                spamScore: 0,
                spamReasons: [] as string[],
                isScheduled: true,
                rawScheduled: item,
            }));
        } else {
            list = list.filter((e) => !trashedIds.has(e.id) && !archiveIds.has(e.id) && !isEmailSpam(e));
        }

        if (showOnlyUnread && (activeTab === "inbox" || activeTab === "spam")) {
            list = list.filter((e) => !readIds.has(e.id));
        } else if (filterType === "read" && (activeTab === "inbox" || activeTab === "spam")) {
            list = list.filter((e) => readIds.has(e.id));
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (e) =>
                    e.subject.toLowerCase().includes(q) ||
                    e.from.toLowerCase().includes(q) ||
                    (e.snippet && e.snippet.toLowerCase().includes(q))
            );
        }

        list.sort((a, b) => {
            const timeA = new Date(a.date).getTime();
            const timeB = new Date(b.date).getTime();
            return sortOrder === "newest" ? timeB - timeA : timeA - timeB;
        });

        return list;
    }, [emails, activeTab, starredIds, trashedIds, archiveIds, sentEmails, draftEmails, scheduledEmails, showOnlyUnread, filterType, readIds, searchQuery, isEmailSpam, sortOrder]);

    // Star toggle action
    const toggleStar = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const willBeStarred = !starredIds.has(id);
        setStarredIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            try {
                localStorage.setItem("vidya_mail_starred_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        mailApi.updateState(id, { isStarred: willBeStarred }).catch(() => { });
    };

    // Mark as Spam
    const handleMarkAsSpam = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setUserSpamIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            try {
                localStorage.setItem("vidya_mail_user_spam_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        setUserNotSpamIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            try {
                localStorage.setItem("vidya_mail_user_not_spam_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        mailApi.updateState(id, { isSpam: true }).catch(() => { });
        setFeedbackToast({ type: "error", message: "Reported as Spam / Moved to Junk folder." });
        setTimeout(() => setFeedbackToast(null), 3500);
    };

    // Mark as Not Spam
    const handleMarkAsNotSpam = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setUserNotSpamIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            try {
                localStorage.setItem("vidya_mail_user_not_spam_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        setUserSpamIds((prev) => {
            const next = new Set(prev);
            next.delete(id);
            try {
                localStorage.setItem("vidya_mail_user_spam_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        mailApi.updateState(id, { isSpam: false }).catch(() => { });
        setFeedbackToast({ type: "success", message: "Restored to Inbox (Marked as Not Spam)." });
        setTimeout(() => setFeedbackToast(null), 3500);
    };

    // Move to Trash action
    const moveToTrash = (id: string) => {
        setTrashedIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            try {
                localStorage.setItem("vidya_mail_trashed_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        mailApi.updateState(id, { isTrashed: true }).catch(() => { });
        if (selectedEmailId === id) {
            setSelectedEmailId(null);
            setActiveEmailDetail(null);
        }
        setFeedbackToast({ type: "error", message: "Moved email to Trash." });
        setTimeout(() => setFeedbackToast(null), 2500);
    };

    // Bulk trash
    const handleBulkTrash = () => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        setTrashedIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.add(id));
            try {
                localStorage.setItem("vidya_mail_trashed_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        mailApi.batchUpdateState(ids, { isTrashed: true }).catch(() => { });
        setSelectedIds(new Set());
        setFeedbackToast({ type: "error", message: `Moved ${ids.length} email(s) to Trash.` });
        setTimeout(() => setFeedbackToast(null), 3000);
    };

    // Bulk spam toggle
    const handleBulkSpam = () => {
        if (selectedIds.size === 0) return;
        const ids = Array.from(selectedIds);
        if (activeTab === "spam") {
            setUserNotSpamIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.add(id));
                return next;
            });
            setUserSpamIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                return next;
            });
            mailApi.batchUpdateState(ids, { isSpam: false }).catch(() => { });
            setFeedbackToast({ type: "success", message: `Restored ${ids.length} email(s) to Inbox.` });
        } else {
            setUserSpamIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.add(id));
                return next;
            });
            setUserNotSpamIds((prev) => {
                const next = new Set(prev);
                ids.forEach((id) => next.delete(id));
                return next;
            });
            mailApi.batchUpdateState(ids, { isSpam: true }).catch(() => { });
            setFeedbackToast({ type: "error", message: `Reported ${ids.length} email(s) as Spam.` });
        }
        setTimeout(() => setFeedbackToast(null), 3500);
        setSelectedIds(new Set());
    };

    // Bulk selection helpers
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredEmails.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredEmails.map((e) => e.id)));
        }
    };

    const toggleSelectOne = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // ── OUTLOOK TOOLBAR ACTIONS ──
    const handleToolbarReply = () => {
        if (!activeEmailDetail) return;
        const sender = activeEmailDetail.from.replace(/.*<(.+)>/, "$1").trim();
        const cleanSubj = activeEmailDetail.subject.startsWith("Re:")
            ? activeEmailDetail.subject
            : `Re: ${activeEmailDetail.subject}`;
        const quote = `\n\n\n--- On ${format(new Date(activeEmailDetail.date), "PPP 'at' p")}, ${activeEmailDetail.from} wrote ---\n> ${activeEmailDetail.text ? activeEmailDetail.text.replace(/\n/g, "\n> ") : ""}`;

        setComposeData({
            to: sender,
            cc: "",
            bcc: "",
            subject: cleanSubj,
            body: quote,
            replyTo: staffMailbox || "support@vidyaloans.in",
        });
        setAttachments([]);
        setIsComposeOpen(true);
        setIsComposeMinimized(false);
    };

    const handleToolbarReplyAll = () => {
        if (!activeEmailDetail) return;
        const sender = activeEmailDetail.from.replace(/.*<(.+)>/, "$1").trim();
        const cleanSubj = activeEmailDetail.subject.startsWith("Re:")
            ? activeEmailDetail.subject
            : `Re: ${activeEmailDetail.subject}`;
        const quote = `\n\n\n--- On ${format(new Date(activeEmailDetail.date), "PPP 'at' p")}, ${activeEmailDetail.from} wrote ---\n> ${activeEmailDetail.text ? activeEmailDetail.text.replace(/\n/g, "\n> ") : ""}`;

        setComposeData({
            to: sender,
            cc: activeEmailDetail.cc || "",
            bcc: "",
            subject: cleanSubj,
            body: quote,
            replyTo: staffMailbox || "support@vidyaloans.in",
        });
        setAttachments([]);
        setIsComposeOpen(true);
        setIsComposeMinimized(false);
    };

    const handleToolbarForward = () => {
        if (!activeEmailDetail) return;
        const cleanSubj = activeEmailDetail.subject.startsWith("Fwd:")
            ? activeEmailDetail.subject
            : `Fwd: ${activeEmailDetail.subject}`;
        const quote = `\n\n\n---------- Forwarded message ---------\nFrom: ${activeEmailDetail.from}\nDate: ${format(new Date(activeEmailDetail.date), "PPP 'at' p")}\nSubject: ${activeEmailDetail.subject}\nTo: ${activeEmailDetail.to}\n\n${activeEmailDetail.text || ""}`;

        setComposeData({
            to: "",
            cc: "",
            bcc: "",
            subject: cleanSubj,
            body: quote,
            replyTo: staffMailbox || "support@vidyaloans.in",
        });
        const forwardAttachments = (activeEmailDetail.attachments || [])
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

    const handleToolbarDelete = () => {
        if (selectedIds.size > 0) {
            handleBulkTrash();
        } else if (activeEmailDetail) {
            moveToTrash(activeEmailDetail.id);
        }
    };

    const handleToolbarArchive = () => {
        const ids = selectedIds.size > 0 ? Array.from(selectedIds) : activeEmailDetail ? [activeEmailDetail.id] : [];
        if (ids.length === 0) return;

        setArchiveIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.add(id));
            try {
                localStorage.setItem("vidya_mail_archive_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });

        setSelectedIds(new Set());
        setFeedbackToast({ type: "success", message: `Archived ${ids.length} email(s).` });
        setTimeout(() => setFeedbackToast(null), 3000);

        if (activeEmailDetail && ids.includes(activeEmailDetail.id)) {
            setSelectedEmailId(null);
            setActiveEmailDetail(null);
        }
    };

    const handleToolbarJunk = () => {
        if (selectedIds.size > 0) {
            handleBulkSpam();
        } else if (activeEmailDetail) {
            if (activeTab === "spam" || isEmailSpam(activeEmailDetail)) {
                handleMarkAsNotSpam({ stopPropagation: () => { } } as any, activeEmailDetail.id);
            } else {
                handleMarkAsSpam({ stopPropagation: () => { } } as any, activeEmailDetail.id);
            }
        }
    };

    const handleToolbarMarkRead = () => {
        const ids = selectedIds.size > 0 ? Array.from(selectedIds) : activeEmailDetail ? [activeEmailDetail.id] : [];
        if (ids.length === 0) return;

        setReadIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.add(id));
            try {
                localStorage.setItem("vidya_mail_read_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        mailApi.batchUpdateState(ids, { isRead: true }).catch(() => { });
        setFeedbackToast({ type: "success", message: `Marked ${ids.length} email(s) as Read.` });
        setTimeout(() => setFeedbackToast(null), 2500);
    };

    const handleToolbarMarkUnread = () => {
        const ids = selectedIds.size > 0 ? Array.from(selectedIds) : activeEmailDetail ? [activeEmailDetail.id] : [];
        if (ids.length === 0) return;

        setReadIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            try {
                localStorage.setItem("vidya_mail_read_ids", JSON.stringify(Array.from(next)));
            } catch { }
            return next;
        });
        mailApi.batchUpdateState(ids, { isRead: false }).catch(() => { });
        setFeedbackToast({ type: "success", message: `Marked ${ids.length} email(s) as Unread.` });
        setTimeout(() => setFeedbackToast(null), 2500);
    };

    const handleToolbarToggleStar = () => {
        if (!activeEmailDetail) return;
        toggleStar({ stopPropagation: () => { } } as any, activeEmailDetail.id);
    };

    const handleToolbarPrint = () => {
        if (!activeEmailDetail) return;
        window.print();
    };

    const handleToolbarImport = () => {
        importFileInputRef.current?.click();
    };

    const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = (event.target?.result as string) || "";
            const importedId = `imported-${Date.now()}`;
            const newEmail: MailDetailItem = {
                id: importedId,
                key: `imported/${file.name}`,
                from: "Imported Message <imported@vidyaloans.in>",
                to: staffMailbox || "support@vidyaloans.in",
                subject: file.name.replace(/\.[^/.]+$/, ""),
                date: new Date().toISOString(),
                size: file.size,
                read: true,
                snippet: content.substring(0, 160),
                text: content,
                attachments: [],
            };
            setEmails((prev) => [newEmail, ...prev]);
            handleSelectEmail(newEmail);
            setFeedbackToast({ type: "success", message: `Imported "${file.name}" successfully!` });
            setTimeout(() => setFeedbackToast(null), 3500);
        };
        reader.readAsText(file);
        e.target.value = "";
    };

    const handleToolbarExport = () => {
        if (!activeEmailDetail) return;
        exportEmailToEml(activeEmailDetail);
    };

    const handleToolbarEditAsNew = () => {
        if (!activeEmailDetail) return;
        setComposeData({
            to: activeEmailDetail.to || "",
            cc: activeEmailDetail.cc || "",
            bcc: "",
            subject: activeEmailDetail.subject || "",
            body: activeEmailDetail.text || activeEmailDetail.snippet || "",
            replyTo: staffMailbox || "support@vidyaloans.in",
        });
        setAttachments(
            (activeEmailDetail.attachments || []).map((a) => ({
                filename: a.filename,
                contentType: a.contentType || "application/octet-stream",
                size: a.size,
                content: (a.content as string) || "",
            }))
        );
        setIsComposeOpen(true);
        setIsComposeMinimized(false);
    };

    const handleMoveToFolder = (folderPrefix: string) => {
        const ids = selectedIds.size > 0 ? Array.from(selectedIds) : activeEmailDetail ? [activeEmailDetail.id] : [];
        if (ids.length === 0) return;
        if (folderPrefix === "trash/") {
            handleToolbarDelete();
            return;
        }
        if (folderPrefix === "archive/") {
            handleToolbarArchive();
            return;
        }
        setFeedbackToast({ type: "success", message: `Moved ${ids.length} email(s) to ${folderPrefix}` });
        setTimeout(() => setFeedbackToast(null), 3000);
    };

    const handleCopyToFolder = (folderPrefix: string) => {
        const ids = selectedIds.size > 0 ? Array.from(selectedIds) : activeEmailDetail ? [activeEmailDetail.id] : [];
        if (ids.length === 0) return;
        setFeedbackToast({ type: "success", message: `Copied ${ids.length} email(s) to ${folderPrefix}` });
        setTimeout(() => setFeedbackToast(null), 3000);
    };

    const handleOpenInNewWindow = () => {
        if (!activeEmailDetail) return;
        window.open(`/staff/inbox/${activeEmailDetail.id}?folder=${encodeURIComponent(selectedFolder)}`, "_blank");
    };

    const handleSaveAsEvent = () => {
        if (!activeEmailDetail) return;
        saveEmailAsCalendarEvent(activeEmailDetail);
    };

    // Attachment downloads & previews
    const handleDownloadAttachment = (att: { filename: string; content?: string; contentType?: string }) => {
        if (!att.content) {
            const dummyContent = `Document: ${att.filename}\nDownloaded securely from VidyaLoans Staff Mailbox.`;
            const blob = new Blob([dummyContent], { type: att.contentType || "application/pdf" });
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

    const handlePreviewAttachment = (att: { filename: string; content?: string; contentType?: string }) => {
        if (att.contentType?.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(att.filename)) {
            setLightboxImage({
                url: att.content ? `data:${att.contentType || "image/png"};base64,${att.content}` : "https://api.dicebear.com/7.x/identicon/svg?seed=" + att.filename,
                filename: att.filename
            });
            return;
        }
        alert(`Opening preview for ${att.filename}`);
    };

    // File Attachment Handlers for Compose
    const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach((file) => {
            if (file.size > 15 * 1024 * 1024) {
                alert(`File ${file.name} is larger than 15MB limit.`);
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                const base64String = (reader.result as string).split(",")[1];
                setAttachments((prev) => [
                    ...prev,
                    {
                        filename: file.name,
                        contentType: file.type || "application/octet-stream",
                        size: file.size,
                        content: base64String,
                    },
                ]);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = "";
    };

    const handleImageAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach((file) => {
            if (!file.type.startsWith("image/")) {
                alert("Please select an image file (PNG, JPG, WEBP, GIF).");
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert(`Image ${file.name} exceeds 10MB limit.`);
                return;
            }

            const reader = new FileReader();
            reader.onload = () => {
                const base64String = (reader.result as string).split(",")[1];
                setAttachments((prev) => [
                    ...prev,
                    {
                        filename: file.name,
                        contentType: file.type || "image/png",
                        size: file.size,
                        content: base64String,
                    },
                ]);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = "";
    };

    const removeAttachment = (index: number) => {
        setAttachments((prev) => prev.filter((_, i) => i !== index));
    };

    // Send Email
    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!composeData.to) {
            alert("Recipient address is required.");
            return;
        }
        if (!composeData.subject) {
            alert("Subject is required.");
            return;
        }

        setIsSending(true);
        try {
            const payload: any = {
                to: composeData.to.split(",").map((s) => s.trim()).filter(Boolean),
                cc: composeData.cc ? composeData.cc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                bcc: composeData.bcc ? composeData.bcc.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
                subject: composeData.subject,
                text: composeData.body.replace(/<[^>]*>/g, ""),
                html: composeData.body.includes("<div") || composeData.body.includes("<p") || composeData.body.includes("<br")
                    ? composeData.body
                    : `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${composeData.body}</div>`,
                replyTo: composeData.replyTo || undefined,
                attachments: attachments.map((a) => ({
                    filename: a.filename,
                    content: a.content,
                    contentType: a.contentType,
                })),
                priority: composePriority,
                requestReadReceipt: composeReadReceipt,
                scheduledAt: composeScheduledAt || undefined,
            };

            const res: any = await mailApi.sendMail(payload);

            if (res?.scheduled) {
                setFeedbackToast({
                    type: "success",
                    message: res.message || "Email scheduled successfully via AWS SES background queue!",
                });
                fetchScheduledEmails();
            } else {
                const sentRecord = {
                    to: composeData.to,
                    subject: composeData.subject,
                    body: composeData.body,
                    date: new Date().toISOString(),
                    from: staffMailbox || "support@vidyaloans.in",
                };
                const updatedSent = [sentRecord, ...sentEmails].slice(0, 100);
                setSentEmails(updatedSent);
                try {
                    localStorage.setItem("vidya_mail_sent_history", JSON.stringify(updatedSent));
                } catch { }

                setFeedbackToast({ type: "success", message: "Email dispatched successfully via Amazon SES!" });
            }

            setTimeout(() => setFeedbackToast(null), 4000);

            if (editingDraftId) {
                const updatedDrafts = draftEmails.filter((d) => d.id !== editingDraftId);
                setDraftEmails(updatedDrafts);
                try {
                    localStorage.setItem("vidya_mail_drafts", JSON.stringify(updatedDrafts));
                } catch { }
                setEditingDraftId(null);
            }

            setIsComposeOpen(false);
            setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", replyTo: "" });
            setAttachments([]);
            setComposePriority("normal");
            setComposeReadReceipt(false);
            setComposeScheduledAt(null);
            setShowScheduleMenu(false);
        } catch (err: any) {
            console.error("Send email error:", err);
            setFeedbackToast({
                type: "error",
                message: err.message || "Failed to dispatch email. Please verify SES credentials.",
            });
            setTimeout(() => setFeedbackToast(null), 6000);
        } finally {
            setIsSending(false);
        }
    };

    // Save Draft
    const handleSaveDraft = () => {
        if (!composeData.to && !composeData.subject && !composeData.body) {
            setFeedbackToast({ type: "error", message: "Draft cannot be completely empty." });
            setTimeout(() => setFeedbackToast(null), 3000);
            return;
        }

        const draftId = editingDraftId || `draft-${Date.now()}`;
        const newDraft = {
            id: draftId,
            to: composeData.to,
            cc: composeData.cc,
            bcc: composeData.bcc,
            subject: composeData.subject || "(Untitled Draft)",
            body: composeData.body,
            replyTo: composeData.replyTo,
            updatedAt: new Date().toISOString(),
        };

        const updatedDrafts = [newDraft, ...draftEmails.filter((d) => d.id !== draftId)];
        setDraftEmails(updatedDrafts);
        try {
            localStorage.setItem("vidya_mail_drafts", JSON.stringify(updatedDrafts));
        } catch { }

        setFeedbackToast({ type: "success", message: "Draft saved successfully!" });
        setTimeout(() => setFeedbackToast(null), 3000);

        setIsComposeOpen(false);
        setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", replyTo: "" });
        setAttachments([]);
        setEditingDraftId(null);
    };

    const handleDeleteDraft = (e: React.MouseEvent, draftId: string) => {
        e.stopPropagation();
        const updatedDrafts = draftEmails.filter((d) => d.id !== draftId);
        setDraftEmails(updatedDrafts);
        try {
            localStorage.setItem("vidya_mail_drafts", JSON.stringify(updatedDrafts));
        } catch { }
        setFeedbackToast({ type: "success", message: "Draft deleted." });
        setTimeout(() => setFeedbackToast(null), 3000);
    };

    const currentFolderLabel = useMemo(() => {
        const found = foldersList.find((f) => f.prefix === selectedFolder);
        if (found) return found.name;
        if (selectedFolder.startsWith("staff/")) {
            const slug = selectedFolder.replace(/^staff\//, "").replace(/\/$/, "");
            return `Staff: ${slug.toUpperCase()}`;
        }
        return selectedFolder;
    }, [selectedFolder, foldersList]);

    const handleBlockSender = (target: string, type: "sender" | "domain", moveToJunk: boolean) => {
        setBlacklistSenders((prev) => [...new Set([...prev, target.toLowerCase()])]);
        if (moveToJunk && activeEmailDetail) {
            setUserSpamIds((prev) => new Set([...prev, activeEmailDetail.id]));
            setFeedbackToast({ type: "success", message: `Blocked ${target}. Existing messages routed to Junk.` });
        } else {
            setFeedbackToast({ type: "success", message: `Blocked ${target}. Future emails will be filtered.` });
        }
        setTimeout(() => setFeedbackToast(null), 3500);
    };

    const handleSafeSender = (target: string) => {
        setWhitelistSenders((prev) => [...new Set([...prev, target.toLowerCase()])]);
        setRemoteResourcesBlocked(false);
        setFeedbackToast({ type: "success", message: `Added ${target} to Safe Senders. Will never be marked as spam.` });
        setTimeout(() => setFeedbackToast(null), 3500);
    };

    const activeSenderContact = useMemo(
        () => (activeEmailDetail ? parseEmailContact(activeEmailDetail.from) : null),
        [activeEmailDetail?.from]
    );
    const activeRecipientContact = useMemo(
        () => (activeEmailDetail ? parseEmailContact(activeEmailDetail.to) : null),
        [activeEmailDetail?.to]
    );
    const activeAvatarPalette = useMemo(
        () => (activeSenderContact ? getAvatarPalette(activeSenderContact.email || activeSenderContact.displayName) : null),
        [activeSenderContact]
    );

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-slate-100/70 font-sans">
            {/* ── HIDDEN IMPORT INPUT ── */}
            <input
                type="file"
                ref={importFileInputRef}
                accept=".eml,.txt,message/rfc822"
                onChange={handleImportFileChange}
                className="hidden"
            />

            {/* ── FEEDBACK TOAST ── */}
            {feedbackToast && (
                <div
                    className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border text-sm font-semibold transition-all animate-bounce ${
                        feedbackToast.type === "success"
                            ? "bg-emerald-950/90 text-emerald-100 border-emerald-700/80 backdrop-blur-md"
                            : "bg-rose-950/90 text-rose-100 border-rose-700/80 backdrop-blur-md"
                    }`}
                >
                    {feedbackToast.type === "success" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-rose-400" />
                    )}
                    <span>{feedbackToast.message}</span>
                </div>
            )}

            {/* ── 1. TOP OUTLOOK ACTION RIBBON (FROSTED GLASS) ── */}
            <OutlookToolbar
                selectedCount={selectedIds.size}
                totalCount={filteredEmails.length}
                onSelectAll={toggleSelectAll}
                onSelectNone={() => setSelectedIds(new Set())}
                onSelectRead={() => setSelectedIds(new Set(filteredEmails.filter((e) => readIds.has(e.id)).map((e) => e.id)))}
                onSelectUnread={() => setSelectedIds(new Set(filteredEmails.filter((e) => !readIds.has(e.id)).map((e) => e.id)))}
                onSelectStarred={() => setSelectedIds(new Set(filteredEmails.filter((e) => starredIds.has(e.id)).map((e) => e.id)))}
                threadsEnabled={threadsEnabled}
                onToggleThreads={() => setThreadsEnabled(!threadsEnabled)}
                isCompactView={isCompactView}
                onToggleCompactView={() => setIsCompactView(!isCompactView)}
                sortOrder={sortOrder}
                onToggleSortOrder={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
                refreshing={refreshing}
                onRefresh={() => fetchEmails(true)}
                hasActiveEmail={Boolean(activeEmailDetail)}
                onReply={handleToolbarReply}
                onReplyAll={handleToolbarReplyAll}
                onForward={handleToolbarForward}
                onDelete={handleToolbarDelete}
                onArchive={handleToolbarArchive}
                onJunk={handleToolbarJunk}
                isSpamActive={activeTab === 'spam' || (Boolean(activeEmailDetail) && isEmailSpam(activeEmailDetail!))}
                onMarkRead={handleToolbarMarkRead}
                onMarkUnread={handleToolbarMarkUnread}
                onToggleStar={handleToolbarToggleStar}
                onPrint={handleToolbarPrint}
                onImport={handleToolbarImport}
                onExport={handleToolbarExport}
                onEditAsNew={handleToolbarEditAsNew}
                onShowSource={() => setShowSourceModal(true)}
                onMoveToFolder={handleMoveToFolder}
                onCopyToFolder={handleCopyToFolder}
                onOpenInNewWindow={handleOpenInNewWindow}
                onCreateFilter={() => setShowFilterModal(true)}
                onSaveAsEvent={handleSaveAsEvent}
                onBlockSender={() => setShowBlockSenderModal(true)}
                onSafeSender={() => setShowSafeSenderModal(true)}
                onOutOfOffice={() => setShowOutOfOfficeModal(true)}
                onSignatures={() => setShowSignaturesModal(true)}
                onMailRules={() => setShowMailRulesModal(true)}
                onConditionalFormatting={() => setShowConditionalFormattingModal(true)}
                availableFolders={foldersList}
            />

            {/* ── MAIN WORKSPACE (SIDEBAR + EMAIL LIST + READING PANE) ── */}
            <div className="flex flex-1 overflow-hidden">
                {/* ── LEFT SIDEBAR ── */}
                <aside className="w-60 bg-white/95 backdrop-blur-md border-r border-slate-200/70 flex flex-col flex-shrink-0 select-none shadow-2xs">
                    {/* Upgraded Compose Action Button */}
                    <div className="p-3.5 border-b border-slate-100/80">
                        <button
                            onClick={() => {
                                setComposeData({ to: "", cc: "", bcc: "", subject: "", body: "", replyTo: "" });
                                setAttachments([]);
                                setIsComposeOpen(true);
                                setIsComposeMinimized(false);
                            }}
                            className="w-full flex items-center justify-center gap-2.5 px-5 py-3 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 text-xs cursor-pointer"
                        >
                            <Plus className="w-4 h-4 stroke-[3]" />
                            <span>Compose Email</span>
                        </button>
                    </div>

                    {/* S3 Assigned Mailbox (No dropdown for staff) */}
                    <div className="px-3.5 py-2.5 border-b border-slate-100/80 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                Assigned Mailbox
                            </span>
                            <span className="text-[9px] text-emerald-700 font-extrabold bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/80 shadow-2xs flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                AWS SES
                            </span>
                        </div>

                        {/* Only Admin / Super Admin with multiple folders can see a mailbox switcher dropdown */}
                        {(user?.role === "admin" || user?.role === "super_admin") && foldersList.length > 1 ? (
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsFolderDropdownOpen(!isFolderDropdownOpen)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-bold text-slate-800 shadow-2xs hover:border-indigo-400/80 transition-all text-left truncate cursor-pointer"
                                >
                                    <span className="flex items-center gap-2 truncate">
                                        <Folder className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                        <span className="truncate">{currentFolderLabel}</span>
                                    </span>
                                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform ${isFolderDropdownOpen ? "rotate-180" : ""}`} />
                                </button>

                                {isFolderDropdownOpen && (
                                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xl z-30 py-1.5 max-h-56 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                                        <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100/80">
                                            Select S3 Mailbox
                                        </div>

                                        {foldersList.map((f) => {
                                            const isSelected = selectedFolder === f.prefix;
                                            return (
                                                <button
                                                    key={f.prefix}
                                                    onClick={() => {
                                                        setSelectedFolder(f.prefix);
                                                        setIsFolderDropdownOpen(false);
                                                    }}
                                                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between hover:bg-indigo-50/80 transition-colors cursor-pointer ${
                                                        isSelected ? "text-indigo-600 bg-indigo-50/70 font-bold" : "text-slate-700 font-medium"
                                                    }`}
                                                >
                                                    <span className="flex items-center gap-2 truncate">
                                                        {f.isStaff ? (
                                                            <User className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                                        ) : (
                                                            <Inbox className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                                        )}
                                                        <span className="truncate">{f.name}</span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-bold text-slate-800 shadow-2xs">
                                <Mail className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span className="truncate" title={staffMailbox || "Assigned Mailbox"}>
                                    {staffMailbox || currentFolderLabel || "Assigned Mailbox"}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Mail Navigation Tabs */}
                    <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
                        {[
                            {
                                id: "inbox",
                                label: "Inbox",
                                icon: Inbox,
                                badge: emails.filter((e) => !readIds.has(e.id) && !trashedIds.has(e.id) && !archiveIds.has(e.id) && !isEmailSpam(e)).length,
                            },
                            {
                                id: "starred",
                                label: "Starred",
                                icon: Star,
                                badge: emails.filter((e) => starredIds.has(e.id) && !trashedIds.has(e.id)).length,
                            },
                            {
                                id: "sent",
                                label: "Sent History",
                                icon: Send,
                                badge: sentEmails.length,
                            },
                            {
                                id: "drafts",
                                label: "Drafts",
                                icon: FileText,
                                badge: draftEmails.length,
                            },
                            {
                                id: "scheduled",
                                label: "Scheduled",
                                icon: Clock,
                                badge: scheduledEmails.filter((s: any) => s.status === 'PENDING').length,
                                activeColor: "bg-amber-50/90 text-amber-800 border-l-3 border-amber-600 shadow-2xs",
                                badgeColor: "bg-amber-600 text-white",
                            },
                            {
                                id: "archive",
                                label: "Archive",
                                icon: Archive,
                                badge: archiveIds.size,
                            },
                            {
                                id: "spam",
                                label: "Junk / Spam",
                                icon: ShieldAlert,
                                badge: emails.filter((e) => !trashedIds.has(e.id) && isEmailSpam(e) && !readIds.has(e.id)).length,
                                activeColor: "bg-rose-50/90 text-rose-700 border-l-3 border-rose-600 shadow-2xs",
                                badgeColor: "bg-rose-600 text-white",
                            },
                            {
                                id: "trash",
                                label: "Trash",
                                icon: Trash2,
                                badge: emails.filter((e) => trashedIds.has(e.id)).length,
                            },
                        ].map((tab: any) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            const activeCls = tab.activeColor || "bg-gradient-to-r from-indigo-50/90 to-indigo-50/40 text-indigo-700 border-l-3 border-indigo-600 shadow-2xs";
                            const badgeCls = tab.badgeColor || (isActive ? "bg-indigo-600 text-white" : "bg-slate-200/80 text-slate-600");
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id as any);
                                        setSelectedEmailId(null);
                                        setActiveEmailDetail(null);
                                    }}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                                        isActive
                                            ? activeCls
                                            : "text-slate-600 hover:bg-slate-50/80 hover:text-slate-900"
                                    }`}
                                >
                                    <span className="flex items-center gap-2.5">
                                        <Icon className={`w-4 h-4 transition-colors ${isActive ? (tab.id === 'spam' ? 'text-rose-600' : 'text-indigo-600') : "text-slate-400"}`} />
                                        <span>{tab.label}</span>
                                    </span>
                                    {tab.badge > 0 && (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${badgeCls}`}>
                                            {tab.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Staff Profile Footer */}
                    <div className="p-3 border-t border-slate-100/80 bg-slate-50/60 flex items-center gap-2.5">
                        <div className="relative">
                            <img
                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${staffMailbox || user?.email || "staff"}`}
                                alt="Avatar"
                                className="w-8 h-8 rounded-full border border-slate-200 bg-white shrink-0 shadow-2xs"
                            />
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate">
                                {user?.firstName ? `${user.firstName} ${user.lastName || ""}` : "Staff Member"}
                            </p>
                            <p className="text-[10px] text-indigo-700 font-mono font-semibold truncate">
                                {staffMailbox}
                            </p>
                        </div>
                    </div>
                </aside>

                {/* ── 2. CENTER: EMAIL LIST PANE (REFINED CARDS & MICRO-INTERACTIONS) ── */}
                <section
                    className={`${
                        selectedEmailId ? "hidden lg:flex" : "flex"
                    } w-full lg:w-[390px] bg-white border-r border-slate-200/70 flex-col flex-shrink-0`}
                >
                    {/* Search & Action Header */}
                    <div className="p-3 border-b border-slate-100/80 flex flex-col gap-2 bg-slate-50/40">
                        <div className="relative flex items-center">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3" />
                            <input
                                type="text"
                                placeholder="Search sender, subject, keywords..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-8.5 pr-8 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 shadow-2xs"
                            />
                            {searchQuery ? (
                                <button
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            ) : (
                                <Mail className="w-3.5 h-3.5 text-slate-300 absolute right-2.5 pointer-events-none" />
                            )}
                        </div>

                        {/* Filter pills */}
                        <div className="flex items-center justify-between text-xs pt-0.5">
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => {
                                        if (showOnlyUnread) {
                                            setShowOnlyUnread(false);
                                            setFilterType("all");
                                        } else {
                                            setShowOnlyUnread(true);
                                            setFilterType("unread");
                                        }
                                    }}
                                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-1 cursor-pointer ${
                                        showOnlyUnread
                                            ? "bg-indigo-600 text-white shadow-2xs"
                                            : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/80"
                                    }`}
                                >
                                    <Filter className="w-2.5 h-2.5" />
                                    Unread
                                </button>
                                <button
                                    onClick={() => {
                                        if (filterType === "read") {
                                            setFilterType("all");
                                        } else {
                                            setShowOnlyUnread(false);
                                            setFilterType("read");
                                        }
                                    }}
                                    className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                                        filterType === "read"
                                            ? "bg-sky-600 text-white shadow-2xs"
                                            : "bg-slate-100/90 text-slate-600 hover:bg-slate-200/80"
                                    }`}
                                >
                                    Read
                                </button>
                            </div>

                            <span className="text-[11px] text-slate-400 font-medium">
                                {filteredEmails.length} messages
                            </span>
                        </div>
                    </div>

                    {/* Email List Content with Staggered Motion */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-100/80">
                        {loading ? (
                            <div className="p-8 text-center space-y-3">
                                <div className="w-7 h-7 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                                <p className="text-xs font-bold text-slate-500">Syncing mailbox messages...</p>
                            </div>
                        ) : filteredEmails.length === 0 ? (
                            /* Reimagined Floating Empty State */
                            <div className="p-8 text-center flex flex-col items-center justify-center space-y-4 my-auto">
                                <div className="relative w-20 h-20 flex items-center justify-center animate-[bounce_4s_infinite]">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 rounded-3xl blur-xl" />
                                    <div className="relative w-16 h-16 rounded-2xl bg-white border border-indigo-100 shadow-lg shadow-indigo-500/10 flex items-center justify-center text-indigo-600">
                                        <Mail className="w-8 h-8" />
                                    </div>
                                    <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black shadow-md">
                                        ✓
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold text-slate-800">Your Inbox is Clear</h3>
                                    <p className="text-xs text-slate-400 max-w-[220px] leading-relaxed">
                                        All incoming customer correspondence has been addressed.
                                    </p>
                                </div>
                                <button
                                    onClick={() => fetchEmails(true)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/90 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-2xs"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    <span>Check for new mail</span>
                                </button>
                            </div>
                        ) : (
                            <AnimatePresence mode="popLayout">
                                {filteredEmails.map((email, index) => {
                                    const isSelected = selectedEmailId === email.id;
                                    const isRead = readIds.has(email.id);
                                    const isStarred = starredIds.has(email.id);
                                    const formattedTime = formatOutlookDate(email.date);
                                    const hasAttach = (email as any).hasAttachments || ((email as any).attachments && (email as any).attachments.length > 0);

                                    return (
                                        <motion.div
                                            key={email.id}
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.96 }}
                                            transition={{ duration: 0.18, delay: Math.min(index * 0.02, 0.25) }}
                                            onClick={() => {
                                                if (typeof window !== "undefined" && window.innerWidth < 1024) {
                                                    setReadIds((prev) => {
                                                        const next = new Set(prev);
                                                        next.add(email.id);
                                                        return next;
                                                    });
                                                    router.push(`/staff/inbox/${email.id}?folder=${encodeURIComponent(selectedFolder)}`);
                                                } else {
                                                    handleSelectEmail(email);
                                                }
                                            }}
                                            className={`cursor-pointer transition-all duration-200 flex items-start gap-3 relative group ${
                                                isCompactView ? "p-2.5" : "p-3.5"
                                            } ${
                                                isSelected
                                                    ? "bg-indigo-50/80 border-l-3 border-indigo-600 shadow-2xs"
                                                    : isRead
                                                    ? "bg-white hover:bg-slate-50/80"
                                                    : "bg-indigo-50/20 hover:bg-indigo-50/40 font-bold"
                                            }`}
                                        >
                                            {/* Selection Checkbox */}
                                            <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(email.id)}
                                                    onChange={() => { }}
                                                    onClick={(e) => toggleSelectOne(e, email.id)}
                                                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-3.5 h-3.5"
                                                />
                                            </div>

                                            {/* Email Info */}
                                            <div className="flex-1 min-w-0">
                                                {/* Row 1: Sender Name & Time */}
                                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                                    <span className={`text-xs truncate ${!isRead ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
                                                        {activeTab === "drafts" ? `To: ${email.to}` : email.from}
                                                    </span>
                                                    <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                                                        {formattedTime}
                                                    </span>
                                                </div>

                                                {/* Row 2: Unread Indicator + Subject + Paperclip */}
                                                <div className="flex items-center justify-between gap-1.5 mb-1">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {!isRead && (
                                                            <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-400/30 shrink-0" />
                                                        )}
                                                        <p className={`text-xs truncate ${!isRead ? "font-extrabold text-slate-900" : "font-medium text-slate-800"}`}>
                                                            {email.subject || "(No Subject)"}
                                                        </p>
                                                    </div>
                                                    {hasAttach && (
                                                        <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    )}
                                                </div>

                                                {/* Row 3: Snippet Preview */}
                                                {!isCompactView && (
                                                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                                                        {email.snippet || "No body preview available."}
                                                    </p>
                                                )}

                                                {/* Spam indicator badge if detected */}
                                                {isEmailSpam(email) && (
                                                    <div className="mt-1 flex items-center gap-1">
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-rose-50 border border-rose-200 text-[9px] font-bold text-rose-700">
                                                            <ShieldAlert className="w-2.5 h-2.5 text-rose-500" />
                                                            SPAM ({email.spamScore || 75}%)
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Micro-Interaction: Hover Quick Action Icons (Reply, Star, Archive, Delete) */}
                                            <div
                                                onClick={(e) => e.stopPropagation()}
                                                className="absolute right-3 top-3 flex items-center gap-0.5 bg-white/95 backdrop-blur-xs px-1.5 py-1 rounded-xl shadow-md border border-slate-200/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                                            >
                                                <button
                                                    onClick={() => {
                                                        handleSelectEmail(email);
                                                        setTimeout(() => handleToolbarReply(), 100);
                                                    }}
                                                    title="Quick Reply"
                                                    className="p-1 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-slate-400 transition-colors cursor-pointer"
                                                >
                                                    <Reply className="w-3.5 h-3.5" />
                                                </button>
                                                {(activeTab === "spam" || isEmailSpam(email)) ? (
                                                    <button
                                                        onClick={(e) => handleMarkAsNotSpam(e, email.id)}
                                                        title="Not Spam (Move to Inbox)"
                                                        className="p-1 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg text-slate-400 transition-colors cursor-pointer"
                                                    >
                                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => handleMarkAsSpam(e, email.id)}
                                                        title="Report as Spam"
                                                        className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-slate-400 transition-colors cursor-pointer"
                                                    >
                                                        <Flame className="w-3.5 h-3.5 text-rose-500" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => toggleStar(e, email.id)}
                                                    title="Toggle Star"
                                                    className="p-1 hover:text-amber-500 hover:bg-amber-50 rounded-lg text-slate-400 transition-colors cursor-pointer"
                                                >
                                                    <Star className={`w-3.5 h-3.5 ${isStarred ? "fill-amber-400 text-amber-400" : ""}`} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setArchiveIds((prev) => {
                                                            const next = new Set(prev);
                                                            next.add(email.id);
                                                            return next;
                                                        });
                                                        setFeedbackToast({ type: "success", message: "Email archived." });
                                                        setTimeout(() => setFeedbackToast(null), 2500);
                                                    }}
                                                    title="Archive"
                                                    className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors cursor-pointer"
                                                >
                                                    <Archive className="w-3.5 h-3.5" />
                                                </button>
                                                {activeTab === "scheduled" ? (
                                                    <button
                                                        onClick={(e) => handleCancelScheduledEmail(email.id, e)}
                                                        title="Cancel Scheduled Send"
                                                        className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-slate-400 transition-colors cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => moveToTrash(email.id)}
                                                        title="Delete"
                                                        className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-slate-400 transition-colors cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        )}
                    </div>
                </section>

                {/* ── 3. RIGHT: EMAIL DETAIL VIEWER (OUTLOOK READING PANE) ── */}
                <main className={`${selectedEmailId ? "flex" : "hidden lg:flex"} flex-1 bg-white flex-col overflow-hidden`}>
                    {selectedEmailId && activeEmailDetail && activeSenderContact && activeRecipientContact && activeAvatarPalette ? (
                        <div className="flex-1 flex flex-col h-full overflow-hidden">
                            {/* Subject Title & Actions Header */}
                            <div className="px-6 py-4.5 border-b border-slate-200/80 bg-white shrink-0">
                                {/* Top: Subject Line & External Link / Mobile Actions */}
                                <div className="flex items-center justify-between gap-3">
                                    <h1 className="text-lg lg:text-xl font-bold text-slate-900 tracking-tight leading-snug flex items-center gap-2.5 min-w-0">
                                        <span className="truncate">{activeEmailDetail.subject || "(No Subject)"}</span>
                                        <button
                                            onClick={handleOpenInNewWindow}
                                            title="Open in new window"
                                            className="text-slate-400 hover:text-sky-600 transition-colors p-1.5 rounded-lg hover:bg-sky-50 shrink-0 cursor-pointer"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                    </h1>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => setSelectedEmailId(null)}
                                            className="lg:hidden p-1.5 rounded-xl text-slate-500 hover:bg-slate-100 cursor-pointer"
                                        >
                                            <ArrowLeft className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Below Subject: Sender Info (From & To grouped on one side) & Professional Actions/Status Panel */}
                                <div className="mt-3.5 pt-3.5 border-t border-slate-100 flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    {/* LEFT SIDE: Avatar + Name + FROM & TO Metadata Block */}
                                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                                        {/* Sender Avatar */}
                                        <div
                                            className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${activeAvatarPalette.bg} ${activeAvatarPalette.border} border shadow-xs flex items-center justify-center shrink-0 ring-2 ${activeAvatarPalette.ring}`}
                                        >
                                            <span className={`text-sm font-bold tracking-wider ${activeAvatarPalette.text}`}>
                                                {activeSenderContact.initials}
                                            </span>
                                        </div>

                                        {/* Details Block */}
                                        <div className="min-w-0 flex-1">
                                            {/* Primary Sender Display Name + Security / Authentication Pills */}
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-bold text-slate-900 tracking-tight">
                                                    {activeSenderContact.displayName}
                                                </span>

                                                {activeEmailDetail.authResults?.spf === "pass" && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                                                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                                        SPF Pass
                                                    </span>
                                                )}
                                                {activeEmailDetail.authResults?.dkim === "pass" && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200/80">
                                                        <CheckCircle2 className="w-3 h-3 text-sky-600" />
                                                        DKIM Pass
                                                    </span>
                                                )}
                                            </div>

                                            {/* Clean FROM & TO block grouped neatly on this side */}
                                            <div className="mt-1.5 space-y-1 text-xs">
                                                {/* From Line */}
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 w-10 shrink-0">
                                                        From
                                                    </span>
                                                    <div className="flex items-baseline gap-1.5 min-w-0 truncate">
                                                        {activeSenderContact.displayName !== activeSenderContact.email && (
                                                            <span className="font-semibold text-slate-800 truncate">
                                                                {activeSenderContact.displayName}
                                                            </span>
                                                        )}
                                                        <span className="text-sky-600 font-mono text-[11px] truncate select-all">
                                                            {activeSenderContact.email ? `<${activeSenderContact.email}>` : activeEmailDetail.from}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* To Line */}
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 w-10 shrink-0">
                                                        To
                                                    </span>
                                                    <div className="flex items-baseline gap-1.5 min-w-0 truncate">
                                                        {activeRecipientContact.displayName !== activeRecipientContact.email && (
                                                            <span className="font-semibold text-slate-800 truncate">
                                                                {activeRecipientContact.displayName}
                                                            </span>
                                                        )}
                                                        <span className="text-sky-600 font-mono text-[11px] truncate select-all">
                                                            {activeRecipientContact.email ? `<${activeRecipientContact.email}>` : activeEmailDetail.to}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Cc Line (if present) */}
                                                {activeEmailDetail.cc && (
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 w-10 shrink-0">
                                                            Cc
                                                        </span>
                                                        <span className="text-slate-600 font-mono text-[11px] truncate select-all">
                                                            {activeEmailDetail.cc}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* RIGHT SIDE: Date & Time + Status Badges + Action Buttons */}
                                    <div className="flex flex-col md:items-end justify-between shrink-0 gap-2.5">
                                        {/* Date and Time */}
                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 md:justify-end">
                                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                                            <span>
                                                {(() => {
                                                    try {
                                                        const d = new Date(activeEmailDetail.date);
                                                        if (isNaN(d.getTime())) return formatOutlookDate(activeEmailDetail.date);
                                                        return format(d, "EEE, d MMM yyyy 'at' h:mm a");
                                                    } catch {
                                                        return formatOutlookDate(activeEmailDetail.date);
                                                    }
                                                })()}
                                            </span>
                                        </div>

                                        {/* Scheduled / Priority / Read Receipt indicators */}
                                        {((activeEmailDetail as any)?.rawScheduled || (activeEmailDetail as any)?.priority || (activeEmailDetail as any)?.requestReadReceipt) && (
                                            <div className="flex flex-wrap items-center md:justify-end gap-1.5">
                                                {((activeEmailDetail as any)?.rawScheduled?.priority === 'high' || (activeEmailDetail as any)?.priority === 'high') && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                        <Flag className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                                                        High Priority
                                                    </span>
                                                )}
                                                {((activeEmailDetail as any)?.rawScheduled?.priority === 'low' || (activeEmailDetail as any)?.priority === 'low') && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                                        <Flag className="w-2.5 h-2.5 fill-sky-500 text-sky-500" />
                                                        Low Priority
                                                    </span>
                                                )}
                                                {Boolean((activeEmailDetail as any)?.rawScheduled?.requestReadReceipt || (activeEmailDetail as any)?.requestReadReceipt) && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                                        Read Receipt Requested
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Action Pills Toolbar: Summary | Headers | Plain Text / HTML | Reply */}
                                        <div className="flex items-center gap-2 text-xs md:justify-end flex-wrap">
                                            <button
                                                type="button"
                                                onClick={() => setShowSummaryModal(true)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/90 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200/80 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                                                title="Generate AI summary of email"
                                            >
                                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                                <span>Summary</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setShowHeadersModal(true)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                                                title="View RFC 822 Email Headers"
                                            >
                                                <Info className="w-3.5 h-3.5 text-slate-500" />
                                                <span>Headers</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setViewMode(viewMode === "html" ? "text" : "html")}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                                                title="Toggle HTML / Plain text format"
                                            >
                                                <FileText className="w-3.5 h-3.5 text-slate-500" />
                                                <span>{viewMode === "html" ? "Plain text" : "HTML format"}</span>
                                            </button>

                                            {(activeTab === "spam" || isEmailSpam(activeEmailDetail)) ? (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleMarkAsNotSpam(e, activeEmailDetail.id)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold border border-emerald-200/80 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                                                    title="Move message back to Inbox and mark as safe"
                                                >
                                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                                    <span>Not Spam</span>
                                                </button>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleMarkAsSpam(e, activeEmailDetail.id)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-700 font-bold border border-slate-200/80 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                                                    title="Report as Junk / Spam"
                                                >
                                                    <Flame className="w-3.5 h-3.5 text-rose-500" />
                                                    <span>Spam</span>
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={handleToolbarReply}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50/80 hover:bg-sky-100 text-sky-700 font-bold border border-sky-200/80 shadow-2xs hover:shadow-xs transition-all cursor-pointer"
                                                title="Quick Reply"
                                            >
                                                <Reply className="w-3.5 h-3.5 text-sky-600" />
                                                <span>Reply</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Attachments Bar */}
                            {activeEmailDetail.attachments && activeEmailDetail.attachments.length > 0 && (
                                <div className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-100/80 flex items-center gap-2 flex-wrap shrink-0">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600 pr-2 border-r border-slate-200 shrink-0">
                                        <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                                        <span>{activeEmailDetail.attachments.length} {activeEmailDetail.attachments.length === 1 ? 'Attachment' : 'Attachments'}</span>
                                    </div>
                                    {activeEmailDetail.attachments.map((att, idx) => {
                                        const isImg = att.contentType?.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(att.filename);

                                        if (isImg) {
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => handlePreviewAttachment(att)}
                                                    className="flex items-center gap-2 px-3.5 py-2 bg-white border border-indigo-200/80 rounded-xl text-xs font-bold text-indigo-700 shadow-2xs hover:bg-indigo-50/80 hover:shadow-xs cursor-pointer transition-all"
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
                                                    className="flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs hover:border-indigo-400/80 hover:shadow-xs transition-all cursor-pointer"
                                                >
                                                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                                                    <span className="truncate max-w-[200px]">{att.filename}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        (~{Math.round(att.size / 1024)} KB)
                                                    </span>
                                                    <ChevronDown className="w-3.5 h-3.5 text-sky-600" />
                                                </button>

                                                {activeAttachmentMenu === idx && (
                                                    <div className="absolute left-0 top-full mt-1.5 w-48 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xl z-30 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-150">
                                                        <button
                                                            onClick={() => {
                                                                handlePreviewAttachment(att);
                                                                setActiveAttachmentMenu(null);
                                                            }}
                                                            className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 flex items-center gap-2.5 transition-colors"
                                                        >
                                                            <Eye className="w-3.5 h-3.5 text-slate-400" />
                                                            <span>Preview attachment</span>
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                handleDownloadAttachment(att);
                                                                setActiveAttachmentMenu(null);
                                                            }}
                                                            className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 flex items-center gap-2.5 transition-colors"
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

                            {/* Junk Email Security Alert Banner with One-Click 'Not Spam' action */}
                            {(activeTab === "spam" || isEmailSpam(activeEmailDetail)) && (
                                <div className="mx-6 mt-3.5 p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
                                            <ShieldAlert className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-amber-950">
                                                This message was identified as Junk / Spam
                                            </p>
                                            <p className="text-[11px] text-amber-800/90 mt-0.5">
                                                Images and external links might be unsafe. If this is legitimate mail, click Not Spam to move it back to your Inbox.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={(e) => handleMarkAsNotSpam(e, activeEmailDetail.id)}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all cursor-pointer"
                                        >
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            <span>Not Spam</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => moveToTrash(activeEmailDetail.id)}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Delete</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Elevated Remote Resources Privacy Banner (Only displayed if remote HTTP/HTTPS images are present) */}
                            {Boolean(activeEmailDetail?.html && /<img[^>]+src=["'](https?:\/\/[^"']+)["']/i.test(activeEmailDetail.html)) && (
                                <EmailRemoteResourceBanner
                                    isBlocked={remoteResourcesBlocked}
                                    onAllow={() => {
                                        setRemoteResourcesBlocked(false);
                                        setFeedbackToast({ type: "success", message: "Remote images & external content allowed." });
                                        setTimeout(() => setFeedbackToast(null), 3000);
                                    }}
                                />
                            )}

                            {/* Scheduled Dispatch Status Banner */}
                            {(activeEmailDetail as any)?.isScheduled && (
                                <div className="mx-7 mt-4 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-indigo-500/10 border border-amber-300/60 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                                            <Clock className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-xs font-bold text-slate-900">Scheduled Dispatch (AWS SES Queue)</h4>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                    (activeEmailDetail as any)?.rawScheduled?.status === 'SENT'
                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                        : (activeEmailDetail as any)?.rawScheduled?.status === 'FAILED'
                                                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                        : 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                                                }`}>
                                                    {(activeEmailDetail as any)?.rawScheduled?.status || "PENDING"}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 mt-0.5">
                                                Scheduled for: <span className="font-semibold text-slate-900">{format(new Date(activeEmailDetail.date), "PPP 'at' p")}</span>
                                            </p>
                                        </div>
                                    </div>
                                    {(activeEmailDetail as any)?.rawScheduled?.status === 'PENDING' && (
                                        <button
                                            type="button"
                                            onClick={() => handleCancelScheduledEmail(activeEmailDetail.id)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all shadow-2xs hover:shadow-xs shrink-0 cursor-pointer"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Cancel Send</span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Email Body Content */}
                            <div className="flex-1 overflow-y-auto px-7 py-4">
                                {viewMode === "html" && activeEmailDetail.html ? (
                                    <div className="min-h-[360px] bg-white rounded-2xl">
                                        <iframe
                                            title="Email HTML Preview"
                                            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1e293b;line-height:1.6;margin:0;padding:8px;word-break:break-word;}img{max-width:100%;height:auto;cursor:pointer;${remoteResourcesBlocked ? "filter:blur(2px);opacity:0.6;" : ""}}</style></head><body>${activeEmailDetail.html}</body></html>`}
                                            className="w-full min-h-[440px] border-none"
                                            sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                                        />
                                    </div>
                                ) : (
                                    <div className="p-5 bg-slate-50/60 rounded-2xl border border-slate-200/60 font-sans text-xs text-slate-800 whitespace-pre-wrap leading-relaxed shadow-2xs">
                                        {activeEmailDetail.text || activeEmailDetail.snippet || "(Empty email body)"}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Reimagined Reading Pane Empty State */
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-slate-50/50 via-white to-slate-50/30">
                            <div className="relative w-24 h-24 flex items-center justify-center mb-5">
                                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/15 via-sky-500/15 to-violet-500/15 rounded-full blur-2xl" />
                                <div className="relative w-20 h-20 rounded-3xl bg-white border border-slate-200/80 shadow-xl shadow-slate-200/60 flex items-center justify-center text-indigo-600">
                                    <Mail className="w-10 h-10" />
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md">
                                    <Sparkles className="w-4 h-4 text-amber-300" />
                                </div>
                            </div>
                            <h3 className="text-base font-bold text-slate-800">Select an email to view details</h3>
                            <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                                Choose a message from the list to preview content, review attachments, or reply to customers and partners.
                            </p>
                            <div className="flex items-center gap-2 mt-5">
                                <span className="px-3 py-1 rounded-full bg-slate-100/90 border border-slate-200/80 text-[11px] text-slate-500 font-mono shadow-2xs">
                                    {staffMailbox}
                                </span>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* ── 4. MODALS ── */}
            <ShowSourceModal
                email={activeEmailDetail}
                isOpen={showSourceModal}
                onClose={() => setShowSourceModal(false)}
            />

            <SummaryModal
                email={activeEmailDetail}
                isOpen={showSummaryModal}
                onClose={() => setShowSummaryModal(false)}
                onReply={handleToolbarReply}
            />

            <HeadersModal
                email={activeEmailDetail}
                isOpen={showHeadersModal}
                onClose={() => setShowHeadersModal(false)}
            />

            <ImageLightboxModal
                imageUrl={lightboxImage?.url || null}
                filename={lightboxImage?.filename}
                isOpen={Boolean(lightboxImage)}
                onClose={() => setLightboxImage(null)}
            />

            <CreateFilterModal
                senderEmail={activeEmailDetail?.from || ""}
                isOpen={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                onSaveFilter={(rule) => {
                    setFeedbackToast({ type: "success", message: `Filter created for ${rule.sender}.` });
                    setTimeout(() => setFeedbackToast(null), 3000);
                }}
            />

            <BlockSenderModal
                senderEmail={activeEmailDetail?.from || ""}
                isOpen={showBlockSenderModal}
                onClose={() => setShowBlockSenderModal(false)}
                onConfirmBlock={handleBlockSender}
            />

            <SafeSenderModal
                senderEmail={activeEmailDetail?.from || ""}
                isOpen={showSafeSenderModal}
                onClose={() => setShowSafeSenderModal(false)}
                onConfirmSafe={handleSafeSender}
            />

            <OutOfOfficeModal
                isOpen={showOutOfOfficeModal}
                onClose={() => setShowOutOfOfficeModal(false)}
                onSave={(cfg) => {
                    setFeedbackToast({
                        type: "success",
                        message: cfg.isEnabled
                            ? `Auto-reply enabled from ${cfg.startDate} to ${cfg.endDate}`
                            : "Auto-reply disabled."
                    });
                    setTimeout(() => setFeedbackToast(null), 3500);
                }}
            />

            <SignaturesModal
                isOpen={showSignaturesModal}
                onClose={() => setShowSignaturesModal(false)}
                onSaveSignature={(sig) => {
                    setSavedSignature(sig.html);
                    setFeedbackToast({ type: "success", message: "Email signature updated successfully." });
                    setTimeout(() => setFeedbackToast(null), 3000);
                }}
            />

            <MailRulesModal
                isOpen={showMailRulesModal}
                onClose={() => setShowMailRulesModal(false)}
            />

            <ConditionalFormattingModal
                isOpen={showConditionalFormattingModal}
                onClose={() => setShowConditionalFormattingModal(false)}
            />

            {/* ── 5. COMPOSE & REPLY MODAL (WITH IMAGE INSERTION) ── */}
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
                    {/* Header */}
                    <div className="px-4 py-3 bg-[#0A2540] text-white flex items-center justify-between shrink-0">
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
                            {/* Inputs */}
                            <div className="p-3 border-b border-slate-100 space-y-2 text-xs">
                                <div className="flex items-center gap-2 pb-0.5">
                                    <span className="w-12 text-slate-400 font-bold uppercase text-[10px]">From</span>
                                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 font-semibold text-indigo-700 text-xs border border-indigo-200/70">
                                        {staffMailbox || "support@vidyaloans.in"}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1 flex items-center gap-2">
                                        <span className="w-12 text-slate-400 font-bold uppercase text-[10px]">To</span>
                                        <input
                                            type="text"
                                            placeholder="recipient@example.com"
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
                                                placeholder="cc@example.com"
                                                value={composeData.cc}
                                                onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
                                                className="flex-1 px-2 py-1 text-xs font-semibold focus:outline-none border-b border-transparent focus:border-indigo-500"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-12 text-slate-400 font-bold uppercase text-[10px]">Bcc</span>
                                            <input
                                                type="text"
                                                placeholder="bcc@example.com"
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
                                        placeholder="Email Subject"
                                        value={composeData.subject}
                                        onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                                        required
                                        className="flex-1 px-2 py-1 text-xs font-semibold focus:outline-none border-b border-transparent focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Rich Formatting Toolbar & Signature Helper */}
                            <div className="px-3 py-1.5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2 text-slate-600">
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        title="Bold"
                                        onClick={() => {
                                            setComposeData((prev) => ({ ...prev, body: prev.body + " **bold text** " }));
                                        }}
                                        className="w-6 h-6 rounded flex items-center justify-center font-bold text-xs hover:bg-slate-200 text-slate-700 transition-colors"
                                    >
                                        B
                                    </button>
                                    <button
                                        type="button"
                                        title="Italic"
                                        onClick={() => {
                                            setComposeData((prev) => ({ ...prev, body: prev.body + " *italic text* " }));
                                        }}
                                        className="w-6 h-6 rounded flex items-center justify-center italic text-xs hover:bg-slate-200 text-slate-700 transition-colors font-serif"
                                    >
                                        I
                                    </button>
                                    <button
                                        type="button"
                                        title="Underline"
                                        onClick={() => {
                                            setComposeData((prev) => ({ ...prev, body: prev.body + " <u>underlined text</u> " }));
                                        }}
                                        className="w-6 h-6 rounded flex items-center justify-center underline text-xs hover:bg-slate-200 text-slate-700 transition-colors"
                                    >
                                        U
                                    </button>
                                    <span className="w-px h-4 bg-slate-200 mx-1" />
                                    <button
                                        type="button"
                                        title="Bullet List"
                                        onClick={() => {
                                            setComposeData((prev) => ({ ...prev, body: prev.body + "\n• Item 1\n• Item 2" }));
                                        }}
                                        className="px-1.5 py-0.5 rounded text-[11px] font-mono hover:bg-slate-200 text-slate-700 transition-colors"
                                    >
                                        &bull; List
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setComposeData((prev) => ({
                                                ...prev,
                                                body: prev.body + "\n\n" + savedSignature,
                                            }));
                                            setFeedbackToast({ type: "success", message: "HTML Signature inserted!" });
                                            setTimeout(() => setFeedbackToast(null), 2500);
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold border border-indigo-200 transition-colors cursor-pointer"
                                    >
                                        <PenTool className="w-3 h-3" />
                                        <span>Insert Signature</span>
                                    </button>
                                    <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                        Spell Check: On
                                    </span>
                                </div>
                            </div>

                            {/* Body */}
                            <textarea
                                placeholder="Type your message here..."
                                value={composeData.body}
                                onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                                spellCheck={true}
                                className="flex-1 p-4 text-xs leading-relaxed font-sans focus:outline-none resize-none"
                            />

                            {/* Attachments Pills with Image Thumbnail Support */}
                            {attachments.length > 0 && (
                                <div className="px-4 py-2 border-t border-slate-100 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                                    {attachments.map((att, i) => {
                                        const isImg = att.contentType?.startsWith("image/");
                                        return (
                                            <span
                                                key={i}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-[10px] font-bold shadow-2xs"
                                            >
                                                {isImg ? (
                                                    <img
                                                        src={`data:${att.contentType};base64,${att.content}`}
                                                        alt="thumbnail"
                                                        className="w-4 h-4 rounded-md object-cover"
                                                    />
                                                ) : (
                                                    <FileText className="w-3 h-3 text-indigo-500" />
                                                )}
                                                <span className="truncate max-w-[120px]">{att.filename}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeAttachment(i)}
                                                    className="hover:text-rose-600 ml-1 cursor-pointer"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Scheduled Send Active Banner */}
                            {composeScheduledAt && (
                                <div className="px-4 py-2 bg-gradient-to-r from-amber-50 to-orange-50 border-t border-amber-200 flex items-center justify-between text-xs text-amber-950">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                                        <span>
                                            Scheduled for <strong>{format(new Date(composeScheduledAt), "EEE, MMM d 'at' hh:mm a")}</strong> via SES queue
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setComposeScheduledAt(null)}
                                        className="text-[11px] font-black uppercase text-amber-700 hover:text-amber-900 bg-white/80 px-2 py-0.5 rounded border border-amber-200 cursor-pointer shadow-2xs"
                                    >
                                        Send Now (Cancel)
                                    </button>
                                </div>
                            )}

                            {/* Footer Toolbar with Attachments, Priority, Read Receipt, and Schedule Send */}
                            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-1 relative">
                                    <label className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer" title="Attach Files">
                                        <Paperclip className="w-4 h-4" />
                                        <input
                                            type="file"
                                            multiple
                                            onChange={handleAttachmentChange}
                                            className="hidden"
                                        />
                                    </label>

                                    <label className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer" title="Insert Image">
                                        <ImageIcon className="w-4 h-4" />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleImageAttachmentChange}
                                            className="hidden"
                                        />
                                    </label>

                                    {/* Priority Flag Selector */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowPriorityMenu(!showPriorityMenu)}
                                            className={`p-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1 ${
                                                composePriority === "high"
                                                    ? "bg-rose-50 text-rose-700 font-bold border border-rose-200"
                                                    : composePriority === "low"
                                                    ? "bg-blue-50 text-blue-700 font-bold border border-blue-200"
                                                    : "text-slate-500 hover:text-indigo-600 hover:bg-slate-200/60"
                                            }`}
                                            title="Message Priority"
                                        >
                                            <Flag className={`w-4 h-4 ${composePriority === "high" ? "text-rose-600 fill-rose-600" : composePriority === "low" ? "text-blue-600 fill-blue-600" : ""}`} />
                                            {composePriority !== "normal" && (
                                                <span className="text-[10px] uppercase font-black">{composePriority}</span>
                                            )}
                                        </button>

                                        {showPriorityMenu && (
                                            <div className="absolute left-0 bottom-full mb-2 w-44 bg-white rounded-2xl shadow-xl border border-slate-200 p-1.5 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1 block">Priority Header</span>
                                                <button
                                                    type="button"
                                                    onClick={() => { setComposePriority("high"); setShowPriorityMenu(false); }}
                                                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-700 font-bold flex items-center gap-2 cursor-pointer"
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-rose-600" />
                                                    High Priority (Urgent)
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setComposePriority("normal"); setShowPriorityMenu(false); }}
                                                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-2 cursor-pointer"
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                                                    Normal Priority
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setComposePriority("low"); setShowPriorityMenu(false); }}
                                                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-blue-50 text-blue-700 font-medium flex items-center gap-2 cursor-pointer"
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                                    Low Priority
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Read Receipt Request Toggle */}
                                    <button
                                        type="button"
                                        onClick={() => setComposeReadReceipt(!composeReadReceipt)}
                                        className={`px-2 py-1.5 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 text-xs ${
                                            composeReadReceipt
                                                ? "bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-2xs"
                                                : "text-slate-500 hover:text-indigo-600 hover:bg-slate-200/60"
                                        }`}
                                        title="Request Read Receipt (Disposition-Notification-To header)"
                                    >
                                        <CheckSquare className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-bold">
                                            {composeReadReceipt ? "Receipt Requested" : "Read Receipt"}
                                        </span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleSaveDraft}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-indigo-600 hover:bg-slate-200/60 transition-colors border border-slate-200 bg-white cursor-pointer shadow-2xs"
                                    >
                                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                                        Save Draft
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setIsComposeOpen(false)}
                                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-200/60 transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>

                                    {/* Send or Schedule Button with Popover */}
                                    <div className="relative inline-flex items-center">
                                        <button
                                            type="submit"
                                            disabled={isSending}
                                            className={`inline-flex items-center gap-2 ${composeScheduledAt ? 'rounded-xl' : 'rounded-l-xl'} px-4 py-2 ${
                                                composeScheduledAt
                                                    ? "bg-gradient-to-tr from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 shadow-amber-500/25"
                                                    : "bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 hover:from-indigo-700 hover:to-violet-600 shadow-indigo-500/25"
                                            } text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50`}
                                        >
                                            {composeScheduledAt ? (
                                                <Clock className="w-3.5 h-3.5 animate-pulse" />
                                            ) : (
                                                <Send className="w-3.5 h-3.5" />
                                            )}
                                            <span>
                                                {isSending
                                                    ? (composeScheduledAt ? "Scheduling..." : "Sending...")
                                                    : (composeScheduledAt ? "Schedule Send" : "Send Email")}
                                            </span>
                                        </button>

                                        {!composeScheduledAt && (
                                            <button
                                                type="button"
                                                onClick={() => setShowScheduleMenu(!showScheduleMenu)}
                                                className="px-2.5 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-r-xl border-l border-indigo-400/40 text-xs font-bold transition-colors cursor-pointer shadow-md"
                                                title="Schedule Send (Delayed Send via AWS SES)"
                                            >
                                                <Clock className="w-3.5 h-3.5" />
                                            </button>
                                        )}

                                        {/* Schedule Send Presets & Custom Picker Popover */}
                                        {showScheduleMenu && (
                                            <div className="absolute right-0 bottom-full mb-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-50 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150">
                                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                                                        Schedule Send (SES Queue)
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowScheduleMenu(false)}
                                                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>

                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                                                        Quick Presets
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const d = new Date(Date.now() + 15 * 60 * 1000);
                                                            setComposeScheduledAt(d.toISOString());
                                                            setShowScheduleMenu(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-indigo-50 text-slate-700 font-semibold flex items-center justify-between transition-colors cursor-pointer"
                                                    >
                                                        <span>In 15 minutes</span>
                                                        <span className="text-[10px] text-slate-400 font-normal">
                                                            {format(new Date(Date.now() + 15 * 60 * 1000), "hh:mm a")}
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const d = new Date(Date.now() + 60 * 60 * 1000);
                                                            setComposeScheduledAt(d.toISOString());
                                                            setShowScheduleMenu(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-indigo-50 text-slate-700 font-semibold flex items-center justify-between transition-colors cursor-pointer"
                                                    >
                                                        <span>In 1 hour</span>
                                                        <span className="text-[10px] text-slate-400 font-normal">
                                                            {format(new Date(Date.now() + 60 * 60 * 1000), "hh:mm a")}
                                                        </span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const tomorrow = new Date();
                                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                                            tomorrow.setHours(9, 0, 0, 0);
                                                            setComposeScheduledAt(tomorrow.toISOString());
                                                            setShowScheduleMenu(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-indigo-50 text-slate-700 font-semibold flex items-center justify-between transition-colors cursor-pointer"
                                                    >
                                                        <span>Tomorrow morning</span>
                                                        <span className="text-[10px] text-slate-400 font-normal">9:00 AM</span>
                                                    </button>
                                                </div>

                                                <div className="pt-2 border-t border-slate-100">
                                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                                                        Or Pick Custom Date & Time
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="datetime-local"
                                                            value={customScheduleInput}
                                                            onChange={(e) => setCustomScheduleInput(e.target.value)}
                                                            className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                                        />
                                                        <button
                                                            type="button"
                                                            disabled={!customScheduleInput}
                                                            onClick={() => {
                                                                if (customScheduleInput) {
                                                                    const d = new Date(customScheduleInput);
                                                                    if (d.getTime() > Date.now()) {
                                                                        setComposeScheduledAt(d.toISOString());
                                                                        setShowScheduleMenu(false);
                                                                    } else {
                                                                        alert("Please select a future time.");
                                                                    }
                                                                }
                                                            }}
                                                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer shadow-2xs"
                                                        >
                                                            Set
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
}

export default function StaffInboxPage() {
    return (
        <Suspense fallback={<div className="h-screen flex items-center justify-center bg-slate-100"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>}>
            <StaffInboxContent />
        </Suspense>
    );
}
