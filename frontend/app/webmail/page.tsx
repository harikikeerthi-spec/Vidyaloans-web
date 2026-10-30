"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Inbox,
  Send,
  Star,
  Trash2,
  Mail,
  PenSquare,
  Search,
  RefreshCw,
  LogOut,
  Paperclip,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Reply,
  Forward,
  X,
  ShieldCheck,
  Download,
  AlertCircle,
  FileText,
  User,
  ChevronDown,
  KeyRound,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Printer,
  Check,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Link2,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eraser,
  Save,
  RotateCcw,
  ShieldAlert,
  Info,
  Image as ImageIcon,
  Calendar,
  Ban,
  Filter,
} from "lucide-react";

import { OutlookToolbar } from "@/components/staff/mail/OutlookToolbar";
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
  ConditionalFormattingModal,
} from "@/components/staff/mail/MailModals";
import {
  MailItemBase,
  exportEmailToEml,
  saveEmailAsCalendarEvent,
  formatOutlookDate,
  getRelativeTimeAgo,
  parseEmailContact,
  getAvatarPalette,
} from "@/components/staff/mail/mailUtils";

type MailFolder = "inbox" | "sent" | "drafts" | "starred" | "trash";

const foldersList = [
  { name: "Inbox", prefix: "inbox" },
  { name: "Sent Mail", prefix: "sent" },
  { name: "Drafts", prefix: "drafts" },
  { name: "Starred", prefix: "starred" },
  { name: "Trash", prefix: "trash" },
];

interface WebmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  snippet: string;
  hasAttachments?: boolean;
  isRead?: boolean;
  isStarred?: boolean;
  isSpam?: boolean;
}

interface MessageDetail extends MailItemBase {
  isStarred?: boolean;
  isRead?: boolean;
  isTrashed?: boolean;
  isSpam?: boolean;
  attachments?: Array<{
    filename: string;
    contentType?: string;
    size: number;
    url?: string;
    content?: string;
  }>;
}

interface OfficialUser {
  id: string;
  email: string;
  name: string;
  title: string;
  s3Prefix: string;
}

interface WebmailStats {
  inbox: number;
  unread: number;
  sent: number;
  drafts: number;
  starred: number;
  trash: number;
}

export default function ExecutiveWebmailPage() {
  const router = useRouter();

  // Authentication State
  const [user, setUser] = useState<OfficialUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Mailbox Stats & Folders
  const [activeFolder, setActiveFolder] = useState<MailFolder>("inbox");
  const [stats, setStats] = useState<WebmailStats>({
    inbox: 0,
    unread: 0,
    sent: 0,
    drafts: 0,
    starred: 0,
    trash: 0,
  });

  // Mail View State
  const [emails, setEmails] = useState<WebmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "unread" | "attachments">("all");
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Multi-Select & View Controls (from Staff Inbox)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isCompactView, setIsCompactView] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [, setSavedSignature] = useState<string>("");

  // Selected Message for Reading
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [messageDetail, setMessageDetail] = useState<MessageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Staff Inbox Reading Pane Features
  const [viewMode, setViewMode] = useState<"html" | "text">("html");
  const [activeAttachmentMenu, setActiveAttachmentMenu] = useState<number | null>(null);
  const [isMarkedSpam, setIsMarkedSpam] = useState(false);

  // Modals
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showHeadersModal, setShowHeadersModal] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; filename?: string } | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showBlockSenderModal, setShowBlockSenderModal] = useState(false);
  const [showSafeSenderModal, setShowSafeSenderModal] = useState(false);
  const [showOutOfOfficeModal, setShowOutOfOfficeModal] = useState(false);
  const [showSignaturesModal, setShowSignaturesModal] = useState(false);
  const [showMailRulesModal, setShowMailRulesModal] = useState(false);
  const [showConditionalFormattingModal, setShowConditionalFormattingModal] = useState(false);

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isMaximizedCompose, setIsMaximizedCompose] = useState(false);
  const [composeDraftId, setComposeDraftId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved" | "unsaved">("idle");
  const [lastSavedDraftAt, setLastSavedDraftAt] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");
  const [isCcBccOpen, setIsCcBccOpen] = useState(false);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composePriority, setComposePriority] = useState<"normal" | "high">("normal");
  const [composeAttachments, setComposeAttachments] = useState<
    Array<{ name: string; size: number; type: string; base64: string }>
  >([]);
  const [isSending, setIsSending] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type?: "success" | "info" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Change Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // User Profile Dropdown
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  // Verify Executive Authentication on Mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const savedToken = localStorage.getItem("vidyaloans_webmail_token");
    const savedUser = localStorage.getItem("vidyaloans_webmail_user");

    if (!savedToken || !savedUser) {
      router.push("/webmail/login");
      return;
    }

    try {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setToken(savedToken);
      setAuthChecking(false);
    } catch {
      localStorage.removeItem("vidyaloans_webmail_token");
      localStorage.removeItem("vidyaloans_webmail_user");
      router.push("/webmail/login");
    }
  }, [router]);

  // Fetch dynamic stats from backend
  const fetchStats = async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/webmail/stats", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json().catch(() => null);
      if (json?.success && json.data) {
        setStats(json.data);
      }
    } catch (err) {
      console.error("[Webmail] Failed to fetch stats:", err);
    }
  };

  // Load emails & stats when authenticated
  useEffect(() => {
    if (!token) return;
    fetchEmails();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeFolder]);

  // Periodic background stats poll (every 45s)
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      fetchStats();
    }, 45000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Fetch emails from isolated official mailbox
  const fetchEmails = async (isManualRefresh = false) => {
    if (!token) return;
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/webmail/inbox?folder=${activeFolder}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        handleSignOut();
        return;
      }

      const json = await res.json().catch(() => null);
      if (json?.success && Array.isArray(json.data)) {
        setEmails(json.data);
      } else {
        setEmails([]);
      }
      setLastRefreshed(new Date());
      fetchStats();
    } catch (err) {
      console.error("Error fetching official emails:", err);
      showToast("Unable to fetch latest emails. Retrying...", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load specific message details or open draft in composer
  const handleSelectEmail = async (id: string) => {
    if (activeFolder === "drafts") {
      try {
        setLoadingDetail(true);
        const res = await fetch(`/api/webmail/message/${encodeURIComponent(id)}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const json = await res.json().catch(() => null);
        const draft = json?.data;
        if (draft) {
          setComposeDraftId(draft.id);
          setComposeTo(draft.to || "");
          setComposeCc(draft.cc || "");
          setComposeBcc(draft.bcc || "");
          setComposeSubject(draft.subject || "");
          const bodyContent = draft.html || draft.text || "";
          setComposeBody(bodyContent);
          if (editorRef.current) {
            editorRef.current.innerHTML = bodyContent;
          }
          setDraftStatus("saved");
          setIsComposeOpen(true);
        }
      } catch (err) {
        console.error("Error opening draft for editing:", err);
        showToast("Unable to open draft.", "error");
      } finally {
        setLoadingDetail(false);
      }
      return;
    }

    setSelectedEmailId(id);
    setLoadingDetail(true);
    setMessageDetail(null);
    setViewMode("html");
    setActiveAttachmentMenu(null);

    try {
      const res = await fetch(`/api/webmail/message/${encodeURIComponent(id)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);
      if (json?.success && json.data) {
        setMessageDetail(json.data);
        setIsMarkedSpam(Boolean(json.data.isSpam));
        // Mark as read in local list
        setEmails((prev) =>
          prev.map((e) => (e.id === id ? { ...e, isRead: true } : e))
        );
        fetchStats();
      }
    } catch (err) {
      console.error("Error loading message details:", err);
      showToast("Failed to load message content.", "error");
    } finally {
      setLoadingDetail(false);
    }
  };

  // Star / Unstar Email
  const handleToggleStar = async (id: string, currentStarred: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextStarred = !currentStarred;

    // Optimistically update list
    setEmails((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isStarred: nextStarred } : item))
    );
    if (messageDetail && messageDetail.id === id) {
      setMessageDetail((prev) => (prev ? { ...prev, isStarred: nextStarred } : null));
    }

    try {
      let csrfToken = "";
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfJson = await csrfRes.json();
        if (csrfJson?.csrfToken) csrfToken = csrfJson.csrfToken;
      } catch { }

      await fetch(`/api/webmail/message/${encodeURIComponent(id)}/state`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({ starred: nextStarred }),
      });
      fetchStats();
    } catch (err) {
      console.error("Failed to toggle star:", err);
    }
  };

  // Delete / Trash Email
  const handleDeleteEmail = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmText =
      activeFolder === "trash"
        ? "Permanently delete this message? This cannot be undone."
        : "Move this message to trash?";

    if (!confirm(confirmText)) return;

    try {
      let csrfToken = "";
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfJson = await csrfRes.json();
        if (csrfJson?.csrfToken) csrfToken = csrfJson.csrfToken;
      } catch { }

      const res = await fetch(`/api/webmail/message/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
      });

      const json = await res.json().catch(() => null);
      if (json?.success) {
        showToast(
          activeFolder === "trash" ? "Message deleted permanently." : "Message moved to Trash.",
          "success"
        );
        setEmails((prev) => prev.filter((item) => item.id !== id));
        if (selectedEmailId === id) {
          setSelectedEmailId(null);
          setMessageDetail(null);
        }
        fetchStats();
      } else {
        showToast(json?.message || "Failed to delete message.", "error");
      }
    } catch (err) {
      console.error("Failed to delete email:", err);
      showToast("Error deleting email.", "error");
    }
  };

  // Handle Attachment Selection in Compose
  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    files.forEach((file) => {
      if (file.size > 15 * 1024 * 1024) {
        showToast(`File ${file.name} exceeds 15MB limit.`, "error");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const resStr = reader.result as string;
        const base64 = resStr.split(",")[1];
        setComposeAttachments((prev) => [
          ...prev,
          {
            name: file.name,
            size: file.size,
            type: file.type || "application/octet-stream",
            base64,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Remove Attachment
  const handleRemoveAttachment = (idx: number) => {
    setComposeAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Auto-save Draft with debounce
  useEffect(() => {
    if (!isComposeOpen) return;
    if (!composeTo && !composeSubject && !composeBody) {
      setDraftStatus("idle");
      return;
    }

    setDraftStatus("unsaved");

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      await saveDraftDirectly();
    }, 2200);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeTo, composeCc, composeBcc, composeSubject, composeBody, isComposeOpen]);

  // Synchronize rich text editor content when composeBody is updated externally
  useEffect(() => {
    if (isComposeOpen && editorRef.current) {
      if (editorRef.current.innerHTML !== composeBody) {
        editorRef.current.innerHTML = composeBody || "";
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComposeOpen]);

  // Explicit or auto-save draft handler
  const saveDraftDirectly = async (showManualToast = false) => {
    if (!token) return;
    if (!composeTo && !composeSubject && !composeBody) return;

    setDraftStatus("saving");
    try {
      let csrfToken = "";
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfJson = await csrfRes.json();
        if (csrfJson?.csrfToken) csrfToken = csrfJson.csrfToken;
      } catch { }

      // Get plain text from HTML
      let plainText = composeBody;
      if (typeof document !== "undefined") {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = composeBody;
        plainText = tempDiv.textContent || tempDiv.innerText || "";
      }

      const res = await fetch("/api/webmail/drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({
          id: composeDraftId || undefined,
          to: composeTo,
          cc: composeCc || undefined,
          bcc: composeBcc || undefined,
          subject: composeSubject,
          text: plainText,
          html: composeBody,
        }),
      });

      const json = await res.json().catch(() => null);
      if (json?.data?.id) {
        setComposeDraftId(json.data.id);
      }
      setDraftStatus("saved");
      setLastSavedDraftAt(new Date());
      fetchStats();
      if (activeFolder === "drafts") {
        fetchEmails();
      }
      if (showManualToast) {
        showToast("Draft saved successfully.", "success");
      }
    } catch (e) {
      console.error("Auto-save draft error:", e);
      setDraftStatus("unsaved");
      if (showManualToast) {
        showToast("Failed to save draft.", "error");
      }
    }
  };

  // Discard draft
  const handleDiscardDraft = async () => {
    if (composeDraftId) {
      try {
        let csrfToken = "";
        try {
          const csrfRes = await fetch("/api/csrf-token");
          const csrfJson = await csrfRes.json();
          if (csrfJson?.csrfToken) csrfToken = csrfJson.csrfToken;
        } catch { }

        await fetch(`/api/webmail/drafts/${encodeURIComponent(composeDraftId)}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          },
        });
      } catch { }
    }
    setComposeDraftId(null);
    setComposeTo("");
    setComposeCc("");
    setComposeBcc("");
    setComposeSubject("");
    setComposeBody("");
    if (editorRef.current) editorRef.current.innerHTML = "";
    setComposeAttachments([]);
    setDraftStatus("idle");
    setIsComposeOpen(false);
    fetchStats();
    if (activeFolder === "drafts") fetchEmails();
  };

  // Rich Text Editor Commands
  const executeFormatCommand = (command: string, value: string | undefined = undefined) => {
    if (typeof document === "undefined") return;
    document.execCommand(command, false, value);
    if (editorRef.current) {
      setComposeBody(editorRef.current.innerHTML);
    }
  };

  const handleInsertLink = () => {
    const url = prompt("Enter link URL (e.g. https://vidyaloans.com):");
    if (url) {
      executeFormatCommand("createLink", url);
    }
  };

  // Send an email via AWS SES SMTP
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !composeTo || !composeSubject) {
      showToast("Please provide recipient address and subject.", "error");
      return;
    }

    setIsSending(true);

    try {
      let csrfToken = "";
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfJson = await csrfRes.json();
        if (csrfJson?.csrfToken) csrfToken = csrfJson.csrfToken;
      } catch { }

      // Get plain text from HTML
      let plainText = composeBody;
      if (typeof document !== "undefined") {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = composeBody;
        plainText = tempDiv.textContent || tempDiv.innerText || "";
      }

      const payload = {
        to: composeTo,
        cc: composeCc || undefined,
        bcc: composeBcc || undefined,
        subject: composeSubject,
        body: composeBody,
        text: plainText,
        priority: composePriority,
        attachments: composeAttachments.map((att) => ({
          filename: att.name,
          contentType: att.type,
          content: att.base64,
        })),
      };

      const res = await fetch("/api/webmail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to dispatch official email.");
      }

      // If this was saved as a draft, clean it up after successful sending
      if (composeDraftId) {
        try {
          await fetch(`/api/webmail/drafts/${encodeURIComponent(composeDraftId)}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            },
          });
        } catch { }
      }

      showToast("Email dispatched successfully.", "success");
      setIsComposeOpen(false);
      setComposeDraftId(null);
      setDraftStatus("idle");
      setComposeTo("");
      setComposeCc("");
      setComposeBcc("");
      setComposeSubject("");
      setComposeBody("");
      if (editorRef.current) editorRef.current.innerHTML = "";
      setComposeAttachments([]);
      setComposePriority("normal");
      setIsMaximizedCompose(false);

      // Refresh both list and counts
      fetchEmails();
      fetchStats();
    } catch (err: unknown) {
      console.error("Error sending official email:", err);
      const msg = err instanceof Error ? err.message : "Failed to send email. Check SMTP settings.";
      showToast(msg, "error");
    } finally {
      setIsSending(false);
    }
  };

  // Restore Email from Trash
  const handleRestoreFromTrash = async (id: string) => {
    try {
      let csrfToken = "";
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfJson = await csrfRes.json();
        if (csrfJson?.csrfToken) csrfToken = csrfJson.csrfToken;
      } catch { }

      const res = await fetch(`/api/webmail/message/${encodeURIComponent(id)}/state`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({ trashed: false }),
      });

      const json = await res.json().catch(() => null);
      if (json?.success) {
        showToast("Email restored to Inbox.", "success");
        setEmails((prev) => prev.filter((item) => item.id !== id));
        if (selectedEmailId === id) {
          setSelectedEmailId(null);
          setMessageDetail(null);
        }
        fetchStats();
      } else {
        showToast(json?.message || "Failed to restore email.", "error");
      }
    } catch (err: unknown) {
      console.error("Failed to restore email:", err);
      showToast("Error restoring email.", "error");
    }
  };

  // Toggle Spam / Junk State
  const handleToggleSpam = async (id: string, currentSpam?: boolean) => {
    const nextSpam = !currentSpam;
    setIsMarkedSpam(nextSpam);

    try {
      let csrfToken = "";
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfJson = await csrfRes.json();
        if (csrfJson?.csrfToken) csrfToken = csrfJson.csrfToken;
      } catch { }

      await fetch(`/api/webmail/message/${encodeURIComponent(id)}/state`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({ isSpam: nextSpam }),
      });

      showToast(
        nextSpam ? "Reported as Spam / Moved to Junk folder." : "Restored to Inbox (Marked as Not Spam).",
        nextSpam ? "error" : "success"
      );
      fetchEmails();
      fetchStats();
    } catch (err) {
      console.error("Failed to toggle spam:", err);
    }
  };

  // Attachment Download
  const handleDownloadAttachment = (att: { filename: string; contentType?: string; size: number; url?: string; content?: string }) => {
    if (att.url) {
      window.open(att.url, "_blank");
      return;
    }
    if (!att.content) {
      showToast(`Attachment content for "${att.filename}" is not available.`, "error");
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
      showToast("Failed to download attachment.", "error");
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }

    setPasswordLoading(true);

    try {
      let csrfToken = "";
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfJson = await csrfRes.json();
        if (csrfJson?.csrfToken) csrfToken = csrfJson.csrfToken;
      } catch { }

      const res = await fetch("/api/webmail/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to change password.");
      }

      setPasswordSuccess("Password updated successfully!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordSuccess("");
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update password.";
      setPasswordError(msg);
    } finally {
      setPasswordLoading(false);
    }
  };

  // Sign out
  const handleSignOut = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("vidyaloans_webmail_token");
      localStorage.removeItem("vidyaloans_webmail_user");
    }
    router.push("/webmail/login");
  };

  // Helper toast notification
  const showToast = (text: string, type: "success" | "info" | "error" = "info") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4200);
  };

  // Filtered emails based on search query, tabs, and sortOrder
  const filteredEmails = useMemo(() => {
    let list = emails;

    // Filter tab
    if (filterTab === "unread") {
      list = list.filter((e) => !e.isRead);
    } else if (filterTab === "attachments") {
      list = list.filter((e) => e.hasAttachments);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          (e.subject && e.subject.toLowerCase().includes(q)) ||
          (e.from && e.from.toLowerCase().includes(q)) ||
          (e.to && e.to.toLowerCase().includes(q)) ||
          (e.snippet && e.snippet.toLowerCase().includes(q))
      );
    }

    // Sort order
    if (sortOrder === "oldest") {
      list = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      list = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return list;
  }, [emails, searchQuery, filterTab, sortOrder]);

  // Multi-Selection Controls (Staff Inbox)
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEmails.length && filteredEmails.length > 0) {
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

  // Bulk / Toolbar Actions
  const handleToolbarDelete = async () => {
    const idsToDelete = selectedIds.size > 0 ? Array.from(selectedIds) : selectedEmailId ? [selectedEmailId] : [];
    if (idsToDelete.length === 0) return;

    try {
      let csrfToken = "";
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfJson = await csrfRes.json();
        if (csrfJson?.csrfToken) csrfToken = csrfJson.csrfToken;
      } catch { }

      await Promise.all(
        idsToDelete.map((id) =>
          fetch(`/api/webmail/message/${encodeURIComponent(id)}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            },
          })
        )
      );

      setEmails((prev) => prev.filter((item) => !idsToDelete.includes(item.id)));
      if (selectedEmailId && idsToDelete.includes(selectedEmailId)) {
        setSelectedEmailId(null);
        setMessageDetail(null);
      }
      setSelectedIds(new Set());
      showToast(idsToDelete.length > 1 ? `${idsToDelete.length} messages moved to Trash.` : "Message moved to Trash.", "info");
      fetchStats();
    } catch (err) {
      console.error("Bulk delete failed:", err);
      showToast("Failed to delete selected messages.", "error");
    }
  };

  const handleToolbarMarkRead = async () => {
    const idsToUpdate = selectedIds.size > 0 ? Array.from(selectedIds) : selectedEmailId ? [selectedEmailId] : [];
    if (idsToUpdate.length === 0) return;

    try {
      let csrfToken = "";
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfJson = await csrfRes.json();
        if (csrfJson?.csrfToken) csrfToken = csrfJson.csrfToken;
      } catch { }

      await Promise.all(
        idsToUpdate.map((id) =>
          fetch(`/api/webmail/message/${encodeURIComponent(id)}/state`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            },
            body: JSON.stringify({ isRead: true }),
          })
        )
      );

      setEmails((prev) =>
        prev.map((item) => (idsToUpdate.includes(item.id) ? { ...item, isRead: true } : item))
      );
      if (messageDetail && idsToUpdate.includes(messageDetail.id)) {
        setMessageDetail((prev) => (prev ? { ...prev, isRead: true } : null));
      }
      setSelectedIds(new Set());
      showToast("Marked as read.", "success");
      fetchStats();
    } catch (err) {
      console.error("Mark read failed:", err);
    }
  };

  const handleToolbarMarkUnread = async () => {
    const idsToUpdate = selectedIds.size > 0 ? Array.from(selectedIds) : selectedEmailId ? [selectedEmailId] : [];
    if (idsToUpdate.length === 0) return;

    try {
      let csrfToken = "";
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfJson = await csrfRes.json();
        if (csrfJson?.csrfToken) csrfToken = csrfJson.csrfToken;
      } catch { }

      await Promise.all(
        idsToUpdate.map((id) =>
          fetch(`/api/webmail/message/${encodeURIComponent(id)}/state`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            },
            body: JSON.stringify({ isRead: false }),
          })
        )
      );

      setEmails((prev) =>
        prev.map((item) => (idsToUpdate.includes(item.id) ? { ...item, isRead: false } : item))
      );
      if (messageDetail && idsToUpdate.includes(messageDetail.id)) {
        setMessageDetail((prev) => (prev ? { ...prev, isRead: false } : null));
      }
      setSelectedIds(new Set());
      showToast("Marked as unread.", "info");
      fetchStats();
    } catch (err) {
      console.error("Mark unread failed:", err);
    }
  };

  const handleToolbarToggleStar = async () => {
    const idsToUpdate = selectedIds.size > 0 ? Array.from(selectedIds) : selectedEmailId ? [selectedEmailId] : [];
    if (idsToUpdate.length === 0) return;

    const firstItem = emails.find((e) => idsToUpdate.includes(e.id));
    const targetStarred = !firstItem?.isStarred;

    try {
      let csrfToken = "";
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfJson = await csrfRes.json();
        if (csrfJson?.csrfToken) csrfToken = csrfJson.csrfToken;
      } catch { }

      await Promise.all(
        idsToUpdate.map((id) =>
          fetch(`/api/webmail/message/${encodeURIComponent(id)}/state`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            },
            body: JSON.stringify({ isStarred: targetStarred }),
          })
        )
      );

      setEmails((prev) =>
        prev.map((item) => (idsToUpdate.includes(item.id) ? { ...item, isStarred: targetStarred } : item))
      );
      if (messageDetail && idsToUpdate.includes(messageDetail.id)) {
        setMessageDetail((prev) => (prev ? { ...prev, isStarred: targetStarred } : null));
      }
      setSelectedIds(new Set());
      showToast(targetStarred ? "Messages starred." : "Messages unstarred.", "success");
      fetchStats();
    } catch (err) {
      console.error("Toggle star failed:", err);
    }
  };

  const handleBulkRestore = async () => {
    const idsToRestore = selectedIds.size > 0 ? Array.from(selectedIds) : selectedEmailId ? [selectedEmailId] : [];
    if (idsToRestore.length === 0) return;

    try {
      let csrfToken = "";
      try {
        const csrfRes = await fetch("/api/csrf-token");
        const csrfJson = await csrfRes.json();
        if (csrfJson?.csrfToken) csrfToken = csrfJson.csrfToken;
      } catch { }

      await Promise.all(
        idsToRestore.map((id) =>
          fetch(`/api/webmail/message/${encodeURIComponent(id)}/state`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
            },
            body: JSON.stringify({ isTrash: false }),
          })
        )
      );

      setEmails((prev) => prev.filter((item) => !idsToRestore.includes(item.id)));
      if (selectedEmailId && idsToRestore.includes(selectedEmailId)) {
        setSelectedEmailId(null);
        setMessageDetail(null);
      }
      setSelectedIds(new Set());
      showToast("Restored to Inbox.", "success");
      fetchStats();
    } catch (err) {
      console.error("Restore failed:", err);
    }
  };

  const handleToolbarPrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleToolbarExport = () => {
    if (messageDetail) {
      exportEmailToEml(messageDetail);
    } else if (selectedEmailId) {
      const found = emails.find((e) => e.id === selectedEmailId);
      if (found) exportEmailToEml(found as MailItemBase);
    }
  };

  const handleSaveAsEvent = () => {
    if (messageDetail) {
      saveEmailAsCalendarEvent(messageDetail);
      showToast("Saved as Calendar Event (.ics)", "success");
    } else if (selectedEmailId) {
      const found = emails.find((e) => e.id === selectedEmailId);
      if (found) {
        saveEmailAsCalendarEvent(found as MailItemBase);
        showToast("Saved as Calendar Event (.ics)", "success");
      }
    }
  };

  const handleOpenInNewWindow = () => {
    if (messageDetail && typeof window !== "undefined") {
      const w = window.open("", "_blank", "width=850,height=720");
      if (w) {
        w.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${messageDetail.subject || "Email View"}</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 28px; color: #1e293b; background: #fff; margin: 0; }
                h1 { font-size: 20px; font-weight: 800; margin-top: 0; color: #0f172a; }
                .meta { font-size: 13px; color: #64748b; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; line-height: 1.6; }
                .meta strong { color: #334155; }
                .body-content { font-size: 14px; line-height: 1.65; }
              </style>
            </head>
            <body>
              <h1>${messageDetail.subject || "(No Subject)"}</h1>
              <div class="meta">
                <div><strong>From:</strong> ${messageDetail.from}</div>
                <div><strong>To:</strong> ${messageDetail.to}</div>
                <div><strong>Date:</strong> ${messageDetail.date}</div>
              </div>
              <div class="body-content">
                ${messageDetail.html || `<pre style="white-space: pre-wrap; font-family: inherit;">${messageDetail.text || messageDetail.snippet || ""}</pre>`}
              </div>
            </body>
          </html>
        `);
        w.document.close();
      }
    }
  };

  const handleBlockSender = async (target: string, type: "sender" | "domain", moveToJunk: boolean) => {
    showToast(`Blocked ${type === "domain" ? "domain" : "sender"} ${target}${moveToJunk ? " and moved emails to Junk" : ""}.`, "info");
    if (moveToJunk && messageDetail) {
      handleToggleSpam(messageDetail.id, false);
    }
  };

  const handleSafeSender = async (target: string, type: "sender" | "domain") => {
    showToast(`Added ${type === "domain" ? "domain" : "sender"} ${target} to Safe Senders whitelist.`, "success");
  };

  // Reply handler pre-populating Compose modal
  const handleReply = () => {
    if (!messageDetail) return;
    setComposeTo(messageDetail.from);
    setComposeSubject(
      messageDetail.subject.startsWith("Re:")
        ? messageDetail.subject
        : `Re: ${messageDetail.subject}`
    );
    setComposeBody(
      `\n\n--- Original Message ---\nFrom: ${messageDetail.from}\nDate: ${messageDetail.date}\nSubject: ${messageDetail.subject}\n\n${messageDetail.text || ""
      }`
    );
    setIsComposeOpen(true);
  };

  // Forward handler pre-populating Compose modal
  const handleForward = () => {
    if (!messageDetail) return;
    setComposeTo("");
    setComposeSubject(
      messageDetail.subject.startsWith("Fwd:")
        ? messageDetail.subject
        : `Fwd: ${messageDetail.subject}`
    );
    setComposeBody(
      `\n\n--- Forwarded Message ---\nFrom: ${messageDetail.from}\nDate: ${messageDetail.date}\nSubject: ${messageDetail.subject}\n\n${messageDetail.text || ""
      }`
    );
    setIsComposeOpen(true);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#faf8fd] flex flex-col items-center justify-center font-sans">
        <div className="relative flex items-center justify-center mb-6">
          <div className="w-14 h-14 border-3 border-purple-200 border-t-[#6605c7] rounded-full animate-spin" />
          <Image
            src="/images/vidyaloans-logo-transparent.png"
            alt="VidyaLoans"
            width={24}
            height={24}
            className="absolute w-6 h-6 object-contain"
          />
        </div>
        <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">
          Establishing Secure Webmail Session
        </span>
        <span className="text-[11px] text-slate-400 mt-1">
          VidyaLoans Higher Official Portal
        </span>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#faf8fd] text-slate-900 font-sans relative selection:bg-purple-100 selection:text-purple-900">

      {/* Signature VidyaLoans Mesh Background */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden opacity-50">
        <div className="absolute inset-0 bg-[radial-gradient(at_0%_0%,rgba(102,5,199,0.14)_0px,transparent_50%),radial-gradient(at_100%_0%,rgba(224,195,137,0.18)_0px,transparent_50%),radial-gradient(at_100%_100%,rgba(139,192,232,0.15)_0px,transparent_50%),radial-gradient(at_0%_100%,rgba(102,5,199,0.10)_0px,transparent_50%)]" />
      </div>

      {/* ==================== TOP NAVIGATION BAR ==================== */}
      <header className="h-16 bg-white/95 backdrop-blur-xl border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between flex-shrink-0 z-30 shadow-xs">

        {/* Brand & Logo */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer transition-transform hover:scale-[1.01]">
            <Image
              src="/images/vidyaloans-logo-transparent.png"
              alt="VidyaLoans"
              width={36}
              height={36}
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain drop-shadow-xs"
            />
            <div className="flex flex-col">
              <span className="font-black text-base sm:text-lg tracking-tight text-[#1a1626] flex items-center gap-1.5 leading-none">
                VidyaLoans
                {/* <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-[#6605c7] border border-purple-200">
                  Webmail
                </span> */}
              </span>
              {/* <span className="text-[9px] sm:text-[10px] font-bold text-purple-700 tracking-wider uppercase mt-0.5">
                Official Communication Gateway
              </span> */}
            </div>
          </Link>

          {/* Mailbox Status Indicator */}
          {/* <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Database Connected</span>
          </div> */}
        </div>

        {/* Global Mailbox Search Bar */}
        <div className="relative w-64 md:w-80 lg:w-96 hidden md:block">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search senders, recipients, subjects..."
            className="w-full pl-10 pr-8 py-2 bg-slate-50/90 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Controls & Profile Menu */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Refresh Mailbox Button */}
          <button
            onClick={() => {
              fetchEmails(true);
              fetchStats();
            }}
            disabled={refreshing}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh All Mail Folders"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-[#6605c7]" : "text-slate-600"}`} />

          </button>

          {/* User Profile Dropdown Pill */}
          <div className="relative">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#6605c7] via-[#7000FF] to-[#4318FF] text-white font-extrabold text-xs flex items-center justify-center shadow-xs">
                {user?.name?.[0]?.toUpperCase() || "O"}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-black text-[#1a1626] leading-tight">
                  {user?.name}
                </span>
                <span className="text-[10px] text-purple-700 font-semibold font-mono truncate max-w-[140px]">
                  {user?.email}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isProfileMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsProfileMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 py-2.5 border-b border-slate-100">
                    <p className="text-xs font-extrabold text-slate-900">{user?.name}</p>
                    <p className="text-[11px] text-purple-700 font-mono break-all mt-0.5">{user?.email}</p>
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-[10px] font-bold text-[#6605c7] border border-purple-200">
                      <ShieldCheck className="w-3 h-3" />
                      <span>{user?.title || "Executive Officer"}</span>
                    </div>
                  </div>

                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsPasswordModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-purple-50 hover:text-[#6605c7] transition-colors text-left cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-purple-600" />
                      <span>Change Password</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        handleSignOut();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── TOP OUTLOOK ACTION RIBBON (FROM STAFF INBOX) ── */}
      <OutlookToolbar
        selectedCount={selectedIds.size}
        totalCount={filteredEmails.length}
        onSelectAll={toggleSelectAll}
        onSelectNone={() => setSelectedIds(new Set())}
        onSelectRead={() => setSelectedIds(new Set(filteredEmails.filter((e) => e.isRead).map((e) => e.id)))}
        onSelectUnread={() => setSelectedIds(new Set(filteredEmails.filter((e) => !e.isRead).map((e) => e.id)))}
        onSelectStarred={() => setSelectedIds(new Set(filteredEmails.filter((e) => e.isStarred).map((e) => e.id)))}
        isCompactView={isCompactView}
        onToggleCompactView={() => setIsCompactView(!isCompactView)}
        sortOrder={sortOrder}
        onToggleSortOrder={() => setSortOrder(sortOrder === "newest" ? "oldest" : "newest")}
        refreshing={refreshing}
        onRefresh={() => {
          fetchEmails(true);
          fetchStats();
        }}
        hasActiveEmail={Boolean(messageDetail || selectedEmailId)}
        onReply={handleReply}
        onReplyAll={handleReply}
        onForward={handleForward}
        onDelete={handleToolbarDelete}
        onArchive={handleToolbarDelete}
        onJunk={() => {
          if (messageDetail) {
            handleToggleSpam(messageDetail.id, isMarkedSpam);
          }
        }}
        isSpamActive={isMarkedSpam}
        isTrashActive={activeFolder === "trash"}
        onRestore={handleBulkRestore}
        onDeletePermanently={handleToolbarDelete}
        onMarkRead={handleToolbarMarkRead}
        onMarkUnread={handleToolbarMarkUnread}
        onToggleStar={handleToolbarToggleStar}
        onPrint={handleToolbarPrint}
        onExport={handleToolbarExport}
        onEditAsNew={handleReply}
        onShowSource={() => setShowSourceModal(true)}
        onMoveToFolder={(f) => {
          showToast(`Moved to ${f}.`, "info");
        }}
        onCopyToFolder={(f) => {
          showToast(`Copied to ${f}.`, "info");
        }}
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

      {/* ==================== WORKSPACE (SIDEBAR + EMAIL LIST + DETAIL) ==================== */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left Sidebar */}
        <aside className="w-64 bg-white/95 backdrop-blur-xl border-r border-slate-200/90 p-4 flex flex-col justify-between flex-shrink-0 z-20">
          <div className="space-y-4">

            {/* Compose Button */}
            <button
              onClick={() => {
                setComposeDraftId(null);
                setDraftStatus("idle");
                setComposeTo("");
                setComposeCc("");
                setComposeBcc("");
                setComposeSubject("");
                setComposeBody("");
                if (editorRef.current) editorRef.current.innerHTML = "";
                setComposeAttachments([]);
                setIsComposeOpen(true);
              }}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#6605c7] via-[#7000FF] to-[#4318FF] hover:brightness-105 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-purple-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <PenSquare className="w-4 h-4" />
              <span>Compose Message</span>
            </button>

            {/* Folder Navigation with Dynamic Badge Counts */}
            <nav className="space-y-1">
              {[
                {
                  id: "inbox",
                  label: "Inbox",
                  icon: Inbox,
                  count: stats.inbox,
                  unread: stats.unread,
                },
                {
                  id: "sent",
                  label: "Sent Mail",
                  icon: Send,
                  count: stats.sent,
                  badgeLabel: "Sent",
                },
                {
                  id: "drafts",
                  label: "Drafts",
                  icon: FileText,
                  count: stats.drafts || 0,
                },
                {
                  id: "starred",
                  label: "Starred",
                  icon: Star,
                  count: stats.starred,
                },
                {
                  id: "trash",
                  label: "Trash",
                  icon: Trash2,
                  count: stats.trash,
                },
              ].map((folder) => {
                const Icon = folder.icon;
                const isActive = activeFolder === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setActiveFolder(folder.id as MailFolder);
                      setSelectedEmailId(null);
                      setMessageDetail(null);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${isActive
                      ? "bg-purple-50 text-[#6605c7] border border-purple-200/90 shadow-2xs font-bold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
                      }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? "text-[#6605c7]" : "text-slate-400"}`} />
                      <span>{folder.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {folder.id === "inbox" && (folder.unread ?? 0) > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#6605c7] text-white shadow-2xs">
                          {folder.unread}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive
                          ? "bg-purple-200/80 text-[#6605c7]"
                          : "bg-slate-100 text-slate-600"
                          }`}
                      >
                        {folder.count}
                      </span>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Database Synchronization Indicator */}
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-semibold text-slate-700">Encrypted DB Mailbox</span>
            </div>
          </div>
        </aside>

        {/* Center: Email List */}
        <section
          className={`w-full md:w-96 lg:w-[420px] bg-white border-r border-slate-200/90 flex flex-col flex-shrink-0 z-10 ${selectedEmailId ? "hidden md:flex" : "flex"
            }`}
        >
          {/* List Header & Filter Tabs */}
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-[#1a1626] capitalize">
                  {activeFolder === "sent" ? "Sent Mail" : activeFolder}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-[#6605c7]">
                  {filteredEmails.length}
                </span>
              </div>

              {/* <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                {activeFolder === "sent" ? "Dispatched" : "Database Synced"}
              </span> */}
            </div>

            {/* Sub-filter Tabs */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-200/60 rounded-lg text-[11px] font-semibold text-slate-600">
              <button
                onClick={() => setFilterTab("all")}
                className={`flex-1 py-1 rounded-md transition-all text-center ${filterTab === "all"
                  ? "bg-white text-[#6605c7] font-bold shadow-2xs"
                  : "hover:text-slate-900"
                  }`}
              >
                All ({emails.length})
              </button>
              <button
                onClick={() => setFilterTab("unread")}
                className={`flex-1 py-1 rounded-md transition-all text-center ${filterTab === "unread"
                  ? "bg-white text-[#6605c7] font-bold shadow-2xs"
                  : "hover:text-slate-900"
                  }`}
              >
                Unread ({emails.filter((e) => !e.isRead).length})
              </button>
              <button
                onClick={() => setFilterTab("attachments")}
                className={`flex-1 py-1 rounded-md transition-all text-center ${filterTab === "attachments"
                  ? "bg-white text-[#6605c7] font-bold shadow-2xs"
                  : "hover:text-slate-900"
                  }`}
              >
                Files ({emails.filter((e) => e.hasAttachments).length})
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-10 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
                <div className="w-7 h-7 border-2 border-purple-200 border-t-[#6605c7] rounded-full animate-spin" />
                <span className="font-semibold text-slate-600">Reading official mailbox...</span>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-400 shadow-2xs">
                  {activeFolder === "sent" ? (
                    <Send className="w-6 h-6 text-purple-400" />
                  ) : activeFolder === "drafts" ? (
                    <FileText className="w-6 h-6 text-[#6605c7]" />
                  ) : activeFolder === "starred" ? (
                    <Star className="w-6 h-6 text-amber-400" />
                  ) : (
                    <Mail className="w-6 h-6" />
                  )}
                </div>
                <div className="font-bold text-slate-700 text-sm">
                  {activeFolder === "sent"
                    ? "No Sent Emails Yet"
                    : activeFolder === "drafts"
                      ? "No Saved Drafts"
                      : activeFolder === "starred"
                        ? "No Starred Messages"
                        : "No Messages Found"}
                </div>
                <p className="text-[11px] text-slate-400 max-w-[220px] leading-relaxed">
                  {searchQuery
                    ? "No emails match your query. Try different keywords."
                    : activeFolder === "sent"
                      ? "Sent official communications will appear here."
                      : activeFolder === "drafts"
                        ? "Emails you start composing will automatically be saved here."
                        : `Your ${activeFolder} folder is currently empty.`}
                </p>
                {(activeFolder === "sent" || activeFolder === "drafts") && (
                  <button
                    onClick={() => {
                      setComposeDraftId(null);
                      setDraftStatus("idle");
                      setComposeTo("");
                      setComposeCc("");
                      setComposeBcc("");
                      setComposeSubject("");
                      setComposeBody("");
                      if (editorRef.current) editorRef.current.innerHTML = "";
                      setIsComposeOpen(true);
                    }}
                    className="mt-2 px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6605c7] font-bold text-xs border border-purple-200 transition-all cursor-pointer"
                  >
                    Compose Message
                  </button>
                )}
              </div>
            ) : (
              filteredEmails.map((email) => {
                const isSelected = selectedEmailId === email.id;
                const isSentFolder = activeFolder === "sent";
                const isDraftFolder = activeFolder === "drafts";
                const displayTitle = isDraftFolder
                  ? (email.to ? `Draft: ${email.to}` : "Draft (No recipient)")
                  : isSentFolder
                    ? `To: ${email.to}`
                    : email.from;
                const contact = parseEmailContact(displayTitle);
                const palette = getAvatarPalette(contact.displayName);

                return (
                  <div
                    key={email.id}
                    onClick={() => handleSelectEmail(email.id)}
                    className={`cursor-pointer transition-all border-l-4 group relative flex items-start gap-3 ${isCompactView ? "p-2.5" : "p-3.5"
                      } ${isSelected
                        ? "bg-purple-50/90 border-l-[#6605c7] shadow-2xs"
                        : email.isRead
                          ? "bg-white hover:bg-slate-50/80 border-l-transparent"
                          : "bg-purple-50/30 hover:bg-purple-50/60 border-l-purple-400 font-bold"
                      }`}
                  >
                    {/* Selection Checkbox */}
                    <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(email.id)}
                        onChange={() => { }}
                        onClick={(e) => toggleSelectOne(e, email.id)}
                        className="rounded text-[#6605c7] focus:ring-purple-500 cursor-pointer w-3.5 h-3.5 accent-[#6605c7]"
                      />
                    </div>

                    {/* Sender Avatar */}
                    {!isCompactView && (
                      <div
                        className={`w-8 h-8 rounded-full bg-gradient-to-tr ${palette.bg} ${palette.text} flex items-center justify-center font-bold text-[11px] shrink-0 shadow-2xs mt-0.5`}
                      >
                        {contact.initials}
                      </div>
                    )}

                    {/* Email Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          {!email.isRead && !isSentFolder && !isDraftFolder && (
                            <span className="w-2 h-2 rounded-full bg-[#6605c7] shrink-0" />
                          )}
                          <span
                            className={`text-xs truncate ${email.isRead
                              ? "font-semibold text-slate-700"
                              : "font-black text-[#1a1626]"
                              }`}
                          >
                            {contact.displayName}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isDraftFolder && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-purple-100 text-[#6605c7] border border-purple-200">
                              Draft
                            </span>
                          )}
                          {isSentFolder && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Sent
                            </span>
                          )}
                          <span suppressHydrationWarning className="text-[10px] text-slate-400 font-medium">
                            {formatOutlookDate(email.date)}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`text-xs truncate mb-1 ${email.isRead ? "text-slate-600 font-medium" : "text-[#1a1626] font-bold"
                          }`}
                      >
                        {email.subject || "(No Subject)"}
                      </div>

                      {!isCompactView && (
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="truncate max-w-[240px] text-slate-500">
                            {email.snippet || "No text preview available."}
                          </span>

                          <div className="flex items-center gap-1 shrink-0 ml-1">
                            {email.hasAttachments && (
                              <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                            )}
                            {email.isSpam && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-200 text-[9px] font-bold text-rose-700">
                                <ShieldAlert className="w-2.5 h-2.5 text-rose-500" />
                                SPAM
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Micro-Interaction: Hover Quick Action Icons (Reply, Star, Delete) */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-3 top-3 flex items-center gap-0.5 bg-white/95 backdrop-blur-xs px-1.5 py-1 rounded-xl shadow-md border border-slate-200/80 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
                    >
                      <button
                        onClick={() => {
                          setSelectedEmailId(email.id);
                          handleReply();
                        }}
                        className="p-1 text-slate-400 hover:text-purple-600 rounded-lg hover:bg-purple-50 transition-colors"
                        title="Reply"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => handleToggleStar(email.id, !!email.isStarred, e)}
                        className={`p-1 rounded-lg hover:bg-slate-50 transition-colors ${email.isStarred ? "text-amber-500" : "text-slate-400 hover:text-amber-500"
                          }`}
                        title={email.isStarred ? "Unstar" : "Star"}
                      >
                        <Star className={`w-3.5 h-3.5 ${email.isStarred ? "fill-amber-400" : ""}`} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteEmail(email.id, e)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right: Message Detail Pane */}
        <main
          className={`flex-1 bg-white flex flex-col overflow-hidden ${selectedEmailId ? "flex" : "hidden md:flex"
            }`}
        >
          {selectedEmailId ? (
            loadingDetail ? (
              <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-500 space-y-2">
                <div className="w-8 h-8 border-2 border-purple-200 border-t-[#6605c7] rounded-full animate-spin" />
                <span className="font-semibold text-slate-700">Loading email payload...</span>
              </div>
            ) : messageDetail ? (
              <div className="flex-1 flex flex-col overflow-hidden">

                {/* Detail Header / Actions Toolbar */}
                <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 select-none">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedEmailId(null)}
                      className="md:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-600 cursor-pointer"
                      title="Back to List"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleReply}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6605c7] border border-purple-200 text-xs font-bold transition-all cursor-pointer"
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
                      onClick={() => handleToggleStar(messageDetail.id, !!messageDetail.isStarred)}
                      className={`p-1.5 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-slate-100 transition-colors cursor-pointer ${messageDetail.isStarred ? "text-amber-500" : ""
                        }`}
                      title={messageDetail.isStarred ? "Unstar" : "Star"}
                    >
                      <Star
                        className={`w-4 h-4 ${messageDetail.isStarred ? "fill-amber-400 text-amber-400" : ""}`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleSpam(messageDetail.id, isMarkedSpam)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${isMarkedSpam
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        : "bg-slate-100 text-slate-600 border-slate-200 hover:text-rose-600 hover:bg-rose-50"
                        }`}
                    >
                      {isMarkedSpam ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5" />
                      )}
                      <span>{isMarkedSpam ? "Not Spam" : "Spam"}</span>
                    </button>

                    <button
                      onClick={() => exportEmailToEml(messageDetail)}
                      className="p-2 rounded-xl text-slate-400 hover:text-[#6605c7] hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Export (.eml)"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => window.print()}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                      title="Print Email"
                    >
                      <Printer className="w-4 h-4" />
                    </button>

                    {activeFolder === "trash" ? (
                      <button
                        onClick={() => handleRestoreFromTrash(messageDetail.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-all cursor-pointer"
                        title="Restore to Inbox"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Restore</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleDeleteEmail(messageDetail.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Move to Trash"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Email Content Container */}
                <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">

                  {/* Trash Retention & Restore Notice Banner */}
                  {activeFolder === "trash" && (
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
                        onClick={() => handleRestoreFromTrash(messageDetail.id)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6605c7] hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restore to Inbox</span>
                      </button>
                    </div>
                  )}

                  {/* Subject and Tags */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h1 className="text-xl lg:text-2xl font-black text-[#1a1626] leading-tight">
                      {messageDetail.subject || "(No Subject)"}
                    </h1>

                    {/* <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Verified & Secure</span>
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-[#6605c7] border border-purple-200">
                        TLS 1.3
                      </span>
                    </div> */}
                  </div>

                  {/* Sender & Recipient Metadata Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-slate-500" />
                      </div>
                      <div>
                        <div className="flex items-baseline gap-2 text-xs">
                          <span className="font-bold text-slate-900 w-10 shrink-0">From</span>
                          <span className="text-[#6605c7] font-semibold truncate hover:underline cursor-pointer">
                            {messageDetail.from}
                          </span>
                        </div>
                        <div className="flex items-baseline gap-2 text-xs mt-0.5">
                          <span className="font-bold text-slate-900 w-10 shrink-0">To</span>
                          <span className="text-[#6605c7] font-medium truncate hover:underline cursor-pointer">
                            {messageDetail.to}
                          </span>
                        </div>
                        {messageDetail.cc && (
                          <div className="flex items-baseline gap-2 text-xs mt-0.5">
                            <span className="font-bold text-slate-900 w-10 shrink-0">Cc</span>
                            <span className="text-slate-600 truncate">{messageDetail.cc}</span>
                          </div>
                        )}
                        {messageDetail.bcc && (
                          <div className="flex items-baseline gap-2 text-xs mt-0.5">
                            <span className="font-bold text-slate-900 w-10 shrink-0">Bcc</span>
                            <span className="text-slate-600 truncate">{messageDetail.bcc}</span>
                          </div>
                        )}
                        <div className="flex items-baseline gap-2 text-xs mt-0.5">
                          <span className="font-bold text-slate-900 w-10 shrink-0">Date</span>
                          <span suppressHydrationWarning className="text-slate-700 font-medium">
                            {formatOutlookDate(messageDetail.date)}
                          </span>
                        </div>

                        {/* Quick Pills: ✉ Summary  ℹ Headers  📄 Plain text / HTML format  🔍 Show Source */}
                        <div className="flex flex-wrap items-center gap-3.5 mt-3 text-xs">
                          <button
                            type="button"
                            onClick={() => setShowSummaryModal(true)}
                            className="inline-flex items-center gap-1.5 text-[#6605c7] hover:text-purple-800 font-bold transition-colors cursor-pointer"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>Summary</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowHeadersModal(true)}
                            className="inline-flex items-center gap-1.5 text-[#6605c7] hover:text-purple-800 font-bold transition-colors cursor-pointer"
                          >
                            <Info className="w-3.5 h-3.5" />
                            <span>Headers</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setViewMode(viewMode === "html" ? "text" : "html")}
                            className="inline-flex items-center gap-1.5 text-[#6605c7] hover:text-purple-800 font-bold transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{viewMode === "html" ? "Plain text" : "HTML format"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowSourceModal(true)}
                            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-bold transition-colors cursor-pointer"
                          >
                            <Search className="w-3.5 h-3.5" />
                            <span>Show Source</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleSaveAsEvent}
                            className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-bold transition-colors cursor-pointer"
                            title="Export email as iCal (.ics) event"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Save as Event</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowFilterModal(true)}
                            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-bold transition-colors cursor-pointer"
                          >
                            <Filter className="w-3.5 h-3.5" />
                            <span>Create Filter</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setShowBlockSenderModal(true)}
                            className="inline-flex items-center gap-1.5 text-rose-600 hover:text-rose-800 font-bold transition-colors cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Block Sender</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                      <div className="flex items-center gap-1.5 flex-wrap sm:justify-end">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-[#6605c7] border border-purple-200/80 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6605c7]"></span>
                          <span>{activeFolder === "inbox" ? "Inbox" : activeFolder === "sent" ? "Sent Mail" : activeFolder === "trash" ? "Trash" : activeFolder === "drafts" ? "Drafts" : "Starred"}</span>
                        </span>
                        {/* <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>TLS 1.3 Verified</span>
                        </span> */}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-semibold sm:justify-end">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{getRelativeTimeAgo(messageDetail.date) || formatOutlookDate(messageDetail.date)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Attachments Section */}
                  {messageDetail.attachments && messageDetail.attachments.length > 0 && (
                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-wrap gap-2">
                      {messageDetail.attachments.map((att, idx) => {
                        const isImg = att.contentType?.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/i.test(att.filename);

                        if (isImg) {
                          return (
                            <div
                              key={idx}
                              onClick={() => setLightboxImage({
                                url: att.url || (att.content ? `data:${att.contentType || "image/png"};base64,${att.content}` : ""),
                                filename: att.filename
                              })}
                              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-[#6605c7] shadow-2xs hover:bg-purple-50 cursor-pointer transition-all"
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
                              <span className="truncate max-w-[160px]">{att.filename}</span>
                              <span className="text-[10px] text-purple-400 font-mono">(Image)</span>
                            </div>
                          );
                        }

                        return (
                          <div key={idx} className="relative">
                            <button
                              type="button"
                              onClick={() => setActiveAttachmentMenu(activeAttachmentMenu === idx ? null : idx)}
                              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs hover:border-purple-300 transition-all cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 text-slate-500" />
                              <span className="truncate max-w-[200px]">{att.filename}</span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                (~{Math.round(att.size / 1024)} KB)
                              </span>
                              <ChevronDown className="w-3.5 h-3.5 text-[#6605c7]" />
                            </button>

                            {activeAttachmentMenu === idx && (
                              <div className="absolute left-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1 text-xs">
                                <button
                                  onClick={() => {
                                    handleDownloadAttachment(att);
                                    setActiveAttachmentMenu(null);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-purple-50 hover:text-[#6605c7] flex items-center gap-2 cursor-pointer"
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

                  {/* Message Body Renderer */}
                  <div className="pt-2">
                    {viewMode === "html" && messageDetail.html ? (
                      <div className="rounded-2xl border border-slate-100 bg-white p-2 min-h-[300px]">
                        <iframe
                          title="Email HTML Preview"
                          srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"/><style>body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1e293b;line-height:1.6;padding:12px;margin:0;word-break:break-word;}img{max-width:100%;height:auto;}</style></head><body>${messageDetail.html}</body></html>`}
                          className="w-full min-h-[480px] border-none rounded-xl"
                          sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin"
                        />
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-200/60 font-sans text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {messageDetail.text || messageDetail.snippet || "(Empty email body)"}
                      </div>
                    )}
                  </div>

                  {/* Bottom Action Footer (Replacing Quick Reply) */}
                  <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleReply}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6605c7] border border-purple-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        <Reply className="w-4 h-4" />
                        <span>Reply</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleForward}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        <Forward className="w-4 h-4" />
                        <span>Forward</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => exportEmailToEml(messageDetail)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-600 hover:text-[#6605c7] hover:bg-purple-50 text-xs font-semibold transition-all cursor-pointer"
                        title="Download .eml file"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export (.eml)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition-all cursor-pointer"
                        title="Print"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
                Message could not be loaded.
              </div>
            )
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-purple-50 flex items-center justify-center text-[#6605c7] shadow-xs">
                <Mail className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#1a1626]">
                  Select an email to view
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm leading-relaxed">
                  Choose an email from the left mailbox list to read its contents, inspect attachments, or dispatch a response via AWS SES.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ==================== DOCKABLE EXECUTIVE COMPOSE MODAL ==================== */}
      {isComposeOpen && (
        <div
          className={`fixed z-50 bg-white rounded-t-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200 ${isMaximizedCompose
            ? "inset-4 sm:inset-10 rounded-2xl max-w-none"
            : "bottom-0 right-4 sm:right-8 w-full max-w-2xl"
            }`}
        >
          {/* Compose Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-[#6605c7] via-[#7000FF] to-[#4318FF] text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-black tracking-wide flex items-center gap-2">
                <PenSquare className="w-3.5 h-3.5" />
                <span>{composeDraftId ? "Editing Saved Draft" : "Official Executive Dispatch"}</span>
              </span>

              {/* Live Draft Auto-Save Status Badge */}
              {draftStatus === "saving" && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold text-amber-200">
                  <div className="w-2.5 h-2.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Saving draft...</span>
                </span>
              )}
              {draftStatus === "saved" && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/30 text-[10px] font-bold text-emerald-100 border border-emerald-400/30">
                  <Check className="w-3 h-3 text-emerald-300" />
                  <span suppressHydrationWarning>Draft saved {lastSavedDraftAt ? lastSavedDraftAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</span>
                </span>
              )}
              {draftStatus === "unsaved" && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-medium text-purple-200">
                  <Clock className="w-3 h-3 text-purple-300" />
                  <span>Unsaved changes</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-white/80">
              <button
                type="button"
                onClick={() => setIsMaximizedCompose(!isMaximizedCompose)}
                className="hover:text-white transition-colors cursor-pointer"
                title={isMaximizedCompose ? "Restore Down" : "Maximize"}
              >
                {isMaximizedCompose ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsComposeOpen(false)}
                className="hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSendEmail} className="p-4 space-y-3 flex-1 flex flex-col overflow-y-auto">
            {/* Recipient Field */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-400 w-12">To:</span>
              <input
                type="email"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="recipient@domain.com"
                required
                className="w-full text-xs font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setIsCcBccOpen(!isCcBccOpen)}
                className="text-[11px] font-bold text-[#6605c7] hover:underline shrink-0 cursor-pointer"
              >
                {isCcBccOpen ? "Hide Cc/Bcc" : "Cc / Bcc"}
              </button>
            </div>

            {/* Expandable Cc & Bcc */}
            {isCcBccOpen && (
              <div className="space-y-2 border-b border-slate-100 pb-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-12">Cc:</span>
                  <input
                    type="text"
                    value={composeCc}
                    onChange={(e) => setComposeCc(e.target.value)}
                    placeholder="cc1@domain.com, cc2@domain.com"
                    className="w-full text-xs font-medium text-slate-900 focus:outline-none placeholder:text-slate-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 w-12">Bcc:</span>
                  <input
                    type="text"
                    value={composeBcc}
                    onChange={(e) => setComposeBcc(e.target.value)}
                    placeholder="bcc@domain.com"
                    className="w-full text-xs font-medium text-slate-900 focus:outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            {/* Subject */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-400 w-12">Subject:</span>
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Subject of official communication"
                required
                className="w-full text-xs font-bold text-slate-900 focus:outline-none placeholder:text-slate-400"
              />

              {/* Priority Selector */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setComposePriority(composePriority === "normal" ? "high" : "normal")
                  }
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer ${composePriority === "high"
                    ? "bg-rose-100 text-rose-700 border border-rose-200"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  title="Toggle High Priority"
                >
                  {composePriority === "high" ? "High Priority" : "Normal"}
                </button>
              </div>
            </div>

            {/* Attachments Chips */}
            {composeAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 pb-2 border-b border-slate-100">
                {composeAttachments.map((att, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-xs text-[#6605c7] font-semibold"
                  >
                    <Paperclip className="w-3 h-3" />
                    <span className="truncate max-w-[150px]">{att.name}</span>
                    <span className="text-[10px] text-purple-400">
                      ({(att.size / 1024).toFixed(0)} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(idx)}
                      className="text-purple-400 hover:text-rose-600 ml-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Rich Text Editor Formatting Toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 p-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-slate-700">
              <button
                type="button"
                onClick={() => executeFormatCommand("bold")}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-600 hover:text-[#6605c7] transition-colors cursor-pointer"
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeFormatCommand("italic")}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-600 hover:text-[#6605c7] transition-colors cursor-pointer"
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeFormatCommand("underline")}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-600 hover:text-[#6605c7] transition-colors cursor-pointer"
                title="Underline (Ctrl+U)"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeFormatCommand("strikeThrough")}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-600 hover:text-[#6605c7] transition-colors cursor-pointer"
                title="Strikethrough"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>

              <div className="w-[1px] h-4 bg-slate-200 mx-1" />

              <button
                type="button"
                onClick={() => executeFormatCommand("insertUnorderedList")}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-600 hover:text-[#6605c7] transition-colors cursor-pointer"
                title="Bullet List"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeFormatCommand("insertOrderedList")}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-600 hover:text-[#6605c7] transition-colors cursor-pointer"
                title="Numbered List"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeFormatCommand("formatBlock", "blockquote")}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-600 hover:text-[#6605c7] transition-colors cursor-pointer"
                title="Quote Block"
              >
                <Quote className="w-3.5 h-3.5" />
              </button>

              <div className="w-[1px] h-4 bg-slate-200 mx-1" />

              <button
                type="button"
                onClick={() => executeFormatCommand("justifyLeft")}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-600 hover:text-[#6605c7] transition-colors cursor-pointer"
                title="Align Left"
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeFormatCommand("justifyCenter")}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-600 hover:text-[#6605c7] transition-colors cursor-pointer"
                title="Align Center"
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeFormatCommand("justifyRight")}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-600 hover:text-[#6605c7] transition-colors cursor-pointer"
                title="Align Right"
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>

              <div className="w-[1px] h-4 bg-slate-200 mx-1" />

              <button
                type="button"
                onClick={handleInsertLink}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-600 hover:text-[#6605c7] transition-colors cursor-pointer"
                title="Insert Link"
              >
                <Link2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeFormatCommand("removeFormat")}
                className="p-1.5 rounded-lg hover:bg-white hover:shadow-2xs text-slate-600 hover:text-rose-600 transition-colors cursor-pointer"
                title="Clear Formatting"
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Rich ContentEditable Editor Surface */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => {
                setComposeBody(e.currentTarget.innerHTML);
              }}
              data-placeholder="Type your official response, letter or memorandum here..."
              className={`w-full ${isMaximizedCompose ? "min-h-[340px]" : "min-h-[160px]"
                } max-h-[460px] overflow-y-auto p-3 text-xs font-normal text-slate-800 bg-white border border-slate-200/90 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-[#6605c7] leading-relaxed relative empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none transition-all`}
            />

            {/* Official Signature Footnote */}
            <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>From: <strong className="text-purple-700 font-mono">{user?.email}</strong></span>
              <span className="text-[10px] text-emerald-600 font-semibold">● Database Secured</span>
            </div>

            {/* Compose Footer Toolbar */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSending}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#6605c7] via-[#7000FF] to-[#4318FF] hover:brightness-105 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-purple-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSending ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>

                {/* Save Draft Button */}
                <button
                  type="button"
                  onClick={() => saveDraftDirectly(true)}
                  disabled={draftStatus === "saving"}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-[#6605c7] font-semibold text-xs border border-slate-200/80 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Save Draft to Database"
                >
                  <Save className="w-3.5 h-3.5 text-purple-600" />
                  <span>Save Draft</span>
                </button>

                {/* File Attachment Button */}
                <input
                  type="file"
                  multiple
                  ref={fileInputRef}
                  onChange={handleAttachmentSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                  title="Attach Files (Max 15MB)"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
              </div>

              {/* Discard Draft Button */}
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Discard Draft"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== CHANGE PASSWORD MODAL ==================== */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-white/80 shadow-2xl relative">

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-[#6605c7]">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-base text-[#1a1626]">
                    Change Official Password
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Update credentials for {user?.email}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showOldPass ? "text" : "password"}
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#6605c7] focus:bg-white focus:ring-2 focus:ring-purple-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPass(!showOldPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showOldPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Enter new strong password"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#6605c7] focus:bg-white focus:ring-2 focus:ring-purple-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-type new password"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#6605c7] focus:bg-white focus:ring-2 focus:ring-purple-100"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#6605c7] to-[#4318FF] hover:brightness-105 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {passwordLoading ? "Updating..." : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff Inbox Mail Modals */}
      <ShowSourceModal
        email={messageDetail}
        isOpen={showSourceModal}
        onClose={() => setShowSourceModal(false)}
      />

      <SummaryModal
        email={messageDetail}
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        onReply={handleReply}
      />

      <HeadersModal
        email={messageDetail}
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
        senderEmail={messageDetail?.from ? parseEmailContact(messageDetail.from).email : ""}
        isOpen={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onSaveFilter={(rule) => {
          showToast(`Filter created for ${rule.sender}.`, "success");
        }}
      />

      <BlockSenderModal
        senderEmail={messageDetail?.from ? parseEmailContact(messageDetail.from).email : ""}
        isOpen={showBlockSenderModal}
        onClose={() => setShowBlockSenderModal(false)}
        onConfirmBlock={handleBlockSender}
      />

      <SafeSenderModal
        senderEmail={messageDetail?.from ? parseEmailContact(messageDetail.from).email : ""}
        isOpen={showSafeSenderModal}
        onClose={() => setShowSafeSenderModal(false)}
        onConfirmSafe={handleSafeSender}
      />

      <OutOfOfficeModal
        isOpen={showOutOfOfficeModal}
        onClose={() => setShowOutOfOfficeModal(false)}
        onSave={(cfg) => {
          showToast(
            cfg.isEnabled
              ? `Auto-reply enabled from ${cfg.startDate} to ${cfg.endDate}`
              : "Auto-reply disabled.",
            "success"
          );
        }}
      />

      <SignaturesModal
        isOpen={showSignaturesModal}
        onClose={() => setShowSignaturesModal(false)}
        onSaveSignature={(sig) => {
          setSavedSignature(sig.html);
          showToast("Email signature saved.", "success");
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

      {/* Global Toast Alert */}
      {toastMsg && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in duration-200 ${toastMsg.type === "error"
            ? "bg-rose-900 text-white border border-rose-700"
            : toastMsg.type === "success"
              ? "bg-emerald-900 text-white border border-emerald-700"
              : "bg-[#1a1626] text-white border border-slate-700"
            }`}
        >
          {toastMsg.type === "error" ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}
    </div>
  );
}
