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
  MoreVertical,
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
  Filter,
} from "lucide-react";

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
}

interface MessageDetail {
  id: string;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  date: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
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

export default function ExecutiveWebmailPage() {
  const router = useRouter();

  // Authentication State
  const [user, setUser] = useState<OfficialUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Mail View State
  const [activeFolder, setActiveFolder] = useState<"inbox" | "sent" | "starred" | "trash">("inbox");
  const [emails, setEmails] = useState<WebmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Selected Message for Reading
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [messageDetail, setMessageDetail] = useState<MessageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Compose Modal State
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeCc, setComposeCc] = useState("");
  const [composeBcc, setComposeBcc] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

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

  // Load emails when authenticated
  useEffect(() => {
    if (!token) return;
    fetchEmails();
  }, [token, activeFolder]);

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
    } catch (err) {
      console.error("Error fetching official emails:", err);
      showToast("Unable to fetch latest emails. Retrying...");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load specific message details
  const handleSelectEmail = async (id: string) => {
    setSelectedEmailId(id);
    setLoadingDetail(true);
    setMessageDetail(null);

    try {
      const res = await fetch(`/api/webmail/message/${encodeURIComponent(id)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => null);
      if (json?.success && json.data) {
        setMessageDetail(json.data);
        // Mark as read in local list
        setEmails((prev) =>
          prev.map((e) => (e.id === id ? { ...e, isRead: true } : e))
        );
      }
    } catch (err) {
      console.error("Error loading message details:", err);
      showToast("Failed to load message content.");
    } finally {
      setLoadingDetail(false);
    }
  };

  // Send an email via AWS SES SMTP
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !composeTo || !composeSubject) {
      showToast("Please provide recipient address and subject.");
      return;
    }

    setIsSending(true);

    try {
      const res = await fetch("/api/webmail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to: composeTo,
          cc: composeCc,
          bcc: composeBcc,
          subject: composeSubject,
          body: composeBody,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to dispatch email via AWS SES.");
      }

      showToast("Email dispatched successfully via AWS SES.");
      setIsComposeOpen(false);
      setComposeTo("");
      setComposeCc("");
      setComposeBcc("");
      setComposeSubject("");
      setComposeBody("");
      fetchEmails();
    } catch (err: any) {
      console.error("Error sending official email:", err);
      showToast(err.message || "Failed to send email. Check SMTP settings.");
    } finally {
      setIsSending(false);
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
      const res = await fetch("/api/webmail/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password.");
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
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Filtered emails based on search query
  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) return emails;
    const q = searchQuery.toLowerCase();
    return emails.filter(
      (e) =>
        (e.subject && e.subject.toLowerCase().includes(q)) ||
        (e.from && e.from.toLowerCase().includes(q)) ||
        (e.to && e.to.toLowerCase().includes(q)) ||
        (e.snippet && e.snippet.toLowerCase().includes(q))
    );
  }, [emails, searchQuery]);

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
      `\n\n--- Original Message ---\nFrom: ${messageDetail.from}\nDate: ${messageDetail.date}\nSubject: ${messageDetail.subject}\n\n${
        messageDetail.text || ""
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
      `\n\n--- Forwarded Message ---\nFrom: ${messageDetail.from}\nDate: ${messageDetail.date}\nSubject: ${messageDetail.subject}\n\n${
        messageDetail.text || ""
      }`
    );
    setIsComposeOpen(true);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <div className="w-10 h-10 border-3 border-purple-200 border-t-[#6605c7] rounded-full animate-spin mb-4" />
        <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
          Securing VidyaLoans Webmail Session...
        </span>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#faf8fd] text-slate-900 font-sans relative selection:bg-purple-100 selection:text-purple-900">
      
      {/* Signature VidyaLoans Mesh Background in Header & Accents */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden opacity-60">
        <div className="absolute inset-0 bg-[radial-gradient(at_0%_0%,rgba(102,5,199,0.18)_0px,transparent_50%),radial-gradient(at_100%_0%,rgba(224,195,137,0.22)_0px,transparent_50%),radial-gradient(at_100%_100%,rgba(139,192,232,0.18)_0px,transparent_50%),radial-gradient(at_0%_100%,rgba(102,5,199,0.12)_0px,transparent_50%)]" />
      </div>

      {/* ==================== TOP NAVIGATION BAR ==================== */}
      <header className="h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-6 flex items-center justify-between flex-shrink-0 z-30 shadow-xs">
        
        {/* Brand & Logo */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer transition-transform hover:scale-[1.01]">
            <Image
              src="/images/vidyaloans-logo-transparent.png"
              alt="VidyaLoans"
              width={36}
              height={36}
              className="w-9 h-9 object-contain drop-shadow-xs"
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight text-[#1a1626] flex items-center gap-1.5 leading-none">
                VidyaLoans
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-[#6605c7] border border-purple-200">
                  Webmail
                </span>
              </span>
              <span className="text-[10px] font-semibold text-purple-700 tracking-wider uppercase mt-0.5">
                Executive Gateway
              </span>
            </div>
          </Link>
        </div>

        {/* Global Mailbox Search Bar */}
        <div className="relative w-80 md:w-96 hidden md:block">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search official messages, senders, subjects..."
            className="w-full pl-10 pr-8 py-2 bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#6605c7] focus:ring-2 focus:ring-purple-100 transition-all"
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

        {/* Official User Profile, Change Password & Sign Out */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchEmails(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
            title="Refresh Mailbox"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-[#6605c7]" : ""}`} />
          </button>

          {/* Official Badge Pill */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#6605c7] via-[#7000FF] to-[#4318FF] text-white font-bold text-xs flex items-center justify-center shadow-xs">
              {user?.name?.[0] || "O"}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-bold text-[#1a1626] leading-tight">
                {user?.name}
              </span>
              <span className="text-[10px] text-purple-700 font-semibold font-mono">
                {user?.email}
              </span>
            </div>
          </div>

          {/* Change Password Button */}
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#6605c7] border border-purple-200 text-xs font-bold transition-all cursor-pointer"
            title="Change Official Password"
          >
            <KeyRound className="w-3.5 h-3.5 text-[#6605c7]" />
            <span>Password</span>
          </button>

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ==================== WORKSPACE (SIDEBAR + EMAIL LIST + DETAIL) ==================== */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar */}
        <aside className="w-60 bg-white/95 backdrop-blur-xl border-r border-slate-200/80 p-4 flex flex-col justify-between flex-shrink-0 z-20">
          <div className="space-y-4">
            
            {/* Compose Button */}
            <button
              onClick={() => setIsComposeOpen(true)}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#6605c7] via-[#7000FF] to-[#4318FF] hover:brightness-105 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <PenSquare className="w-4 h-4" />
              <span>Compose Email</span>
            </button>

            {/* Folder Navigation */}
            <nav className="space-y-1">
              {[
                { id: "inbox", label: "Inbox", icon: Inbox, badge: emails.length },
                { id: "sent", label: "Sent Mail", icon: Send, badge: 0 },
                { id: "starred", label: "Starred", icon: Star, badge: 0 },
                { id: "trash", label: "Trash", icon: Trash2, badge: 0 },
              ].map((folder) => {
                const Icon = folder.icon;
                const isActive = activeFolder === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => setActiveFolder(folder.id as any)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-purple-50 text-[#6605c7] border border-purple-200/90 shadow-2xs font-bold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? "text-[#6605c7]" : "text-slate-400"}`} />
                      <span>{folder.label}</span>
                    </div>
                    {folder.badge > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isActive ? "bg-purple-200/80 text-[#6605c7]" : "bg-slate-100 text-slate-600"}`}>
                        {folder.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Mailbox Storage Isolation Badge */}
          <div className="p-3.5 rounded-2xl bg-purple-50/60 border border-purple-100 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-[#6605c7] mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#6605c7]" />
              <span className="text-[11px] uppercase tracking-wider">Isolated Storage</span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono truncate">
              {user?.s3Prefix || "officials/mailbox/"}
            </p>
          </div>
        </aside>

        {/* Center: Email List */}
        <section className={`w-full md:w-96 lg:w-[420px] bg-white border-r border-slate-200/80 flex flex-col flex-shrink-0 z-10 ${selectedEmailId ? "hidden md:flex" : "flex"}`}>
          
          {/* List Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-[#1a1626] capitalize">
                {activeFolder}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-[#6605c7]">
                {filteredEmails.length}
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-400">
              AWS SES Mailbox
            </span>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
                <div className="w-6 h-6 border-2 border-purple-200 border-t-[#6605c7] rounded-full animate-spin" />
                <span>Reading official mailbox...</span>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-400">
                  <Mail className="w-6 h-6" />
                </div>
                <div className="font-bold text-slate-600 text-sm">No Messages</div>
                <p className="text-[11px] text-slate-400 max-w-[200px]">
                  {searchQuery ? "No emails match your search." : `Your ${activeFolder} folder is currently empty.`}
                </p>
              </div>
            ) : (
              filteredEmails.map((email) => {
                const isSelected = selectedEmailId === email.id;
                return (
                  <div
                    key={email.id}
                    onClick={() => handleSelectEmail(email.id)}
                    className={`p-4 cursor-pointer transition-all border-l-4 ${
                      isSelected
                        ? "bg-purple-50/80 border-l-[#6605c7] shadow-2xs"
                        : "bg-white hover:bg-slate-50/80 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={`text-xs truncate ${email.isRead ? "font-semibold text-slate-700" : "font-extrabold text-[#1a1626]"}`}>
                        {email.from}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {email.date ? new Date(email.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) : ""}
                      </span>
                    </div>

                    <div className={`text-xs truncate mb-1 ${email.isRead ? "text-slate-600 font-medium" : "text-[#1a1626] font-bold"}`}>
                      {email.subject || "(No Subject)"}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span className="truncate max-w-[240px] text-slate-500">
                        {email.snippet || "No text preview available."}
                      </span>
                      {email.hasAttachments && (
                        <Paperclip className="w-3.5 h-3.5 text-purple-500 shrink-0 ml-1" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right: Message Detail Pane */}
        <main className={`flex-1 bg-white flex flex-col overflow-hidden ${selectedEmailId ? "flex" : "hidden md:flex"}`}>
          {selectedEmailId ? (
            loadingDetail ? (
              <div className="flex-1 flex flex-col items-center justify-center text-xs text-slate-500 space-y-2">
                <div className="w-7 h-7 border-2 border-purple-200 border-t-[#6605c7] rounded-full animate-spin" />
                <span>Decrypting email payload...</span>
              </div>
            ) : messageDetail ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                
                {/* Detail Header / Actions Toolbar */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
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
                  </div>

                  <div className="flex items-center gap-1 text-slate-400">
                    <button className="p-2 rounded-xl hover:bg-slate-100 hover:text-amber-500 transition-colors" title="Star">
                      <Star className="w-4 h-4" />
                    </button>
                    <button className="p-2 rounded-xl hover:bg-slate-100 hover:text-rose-500 transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Email Body & Details Content */}
                <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
                  
                  {/* Subject */}
                  <h1 className="text-xl lg:text-2xl font-black text-[#1a1626] leading-tight">
                    {messageDetail.subject || "(No Subject)"}
                  </h1>

                  {/* Sender & Recipient Metadata Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6605c7] to-[#4318FF] text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
                        {messageDetail.from?.[0]?.toUpperCase() || "M"}
                      </div>
                      <div>
                        <div className="font-extrabold text-sm text-[#1a1626]">
                          {messageDetail.from}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          To: <span className="text-purple-700 font-semibold">{messageDetail.to}</span>
                          {messageDetail.cc && (
                            <span className="ml-2 text-slate-400">| Cc: {messageDetail.cc}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-xs text-slate-400 font-medium shrink-0">
                      {messageDetail.date ? new Date(messageDetail.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}
                    </div>
                  </div>

                  {/* Attachments Section */}
                  {messageDetail.attachments && messageDetail.attachments.length > 0 && (
                    <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 space-y-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#6605c7] uppercase tracking-wider">
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>Attachments ({messageDetail.attachments.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {messageDetail.attachments.map((att, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-3 shadow-2xs hover:border-purple-300 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <FileText className="w-4 h-4 text-[#6605c7] shrink-0" />
                              <div className="truncate">
                                <div className="text-xs font-bold text-slate-800 truncate">
                                  {att.filename}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {(att.size / 1024).toFixed(1)} KB
                                </div>
                              </div>
                            </div>
                            {att.url && (
                              <a
                                href={att.url}
                                download={att.filename}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-[#6605c7] transition-colors"
                                title="Download"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message Body Renderer */}
                  <div className="pt-2">
                    {messageDetail.html ? (
                      <div
                        className="prose prose-sm max-w-none text-slate-800 leading-relaxed overflow-x-auto"
                        dangerouslySetInnerHTML={{ __html: messageDetail.html }}
                      />
                    ) : (
                      <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">
                        {messageDetail.text || "No message content."}
                      </div>
                    )}
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
                  Choose a conversation from the left inbox list to inspect its contents, recipients, and attachments.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ==================== DOCKABLE COMPOSE MODAL ==================== */}
      {isComposeOpen && (
        <div className="fixed bottom-0 right-6 w-full max-w-lg bg-white rounded-t-2xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-200">
          
          {/* Compose Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-[#6605c7] via-[#7000FF] to-[#4318FF] text-white flex items-center justify-between">
            <span className="text-xs font-extrabold tracking-wide flex items-center gap-2">
              <PenSquare className="w-3.5 h-3.5" />
              New Official Message
            </span>
            <button
              onClick={() => setIsComposeOpen(false)}
              className="text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSendEmail} className="p-4 space-y-3 flex-1 flex flex-col">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-400 w-12">To:</span>
              <input
                type="email"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
                placeholder="recipient@example.com"
                required
                className="w-full text-xs font-semibold text-slate-900 focus:outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-400 w-12">Cc:</span>
              <input
                type="text"
                value={composeCc}
                onChange={(e) => setComposeCc(e.target.value)}
                placeholder="cc@example.com (optional)"
                className="w-full text-xs font-medium text-slate-900 focus:outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <span className="text-xs font-bold text-slate-400 w-12">Subject:</span>
              <input
                type="text"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Subject of the email"
                required
                className="w-full text-xs font-bold text-slate-900 focus:outline-none placeholder:text-slate-400"
              />
            </div>

            <textarea
              rows={8}
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              placeholder="Type your official response or memo here..."
              className="w-full flex-1 text-xs font-normal text-slate-800 focus:outline-none resize-none placeholder:text-slate-400 leading-relaxed pt-2"
            />

            {/* Compose Footer Toolbar */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
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

              <button
                type="button"
                onClick={() => {
                  setComposeTo("");
                  setComposeSubject("");
                  setComposeBody("");
                  setIsComposeOpen(false);
                }}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
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
                  <h3 className="font-extrabold text-base text-[#1a1626]">
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

      {/* Global Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a1626] text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
