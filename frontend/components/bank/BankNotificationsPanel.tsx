"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { createPortal } from "react-dom";

interface BankNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  timestamp: string;
  metadata?: any;
  isRead?: boolean;
}

interface BankNotificationsPanelProps {
  showUnreadBadge?: boolean;
}

const getNotificationStyle = (type: string) => {
  const styles: Record<string, any> = {
    bank_application_received: {
      icon: "download",
      bgColor: "bg-violet-50",
      borderColor: "border-violet-200",
      textColor: "text-violet-700",
      badge: "bg-violet-500",
    },
    bank_chat_received: {
      icon: "forum",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      textColor: "text-emerald-700",
      badge: "bg-[#10b981]",
    },
    bank_file_logged: {
      icon: "fact_check",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-700",
      badge: "bg-blue-500",
    },
    bank_query_raised: {
      icon: "help_center",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      textColor: "text-amber-700",
      badge: "bg-amber-500",
    },
    bank_query_responded: {
      icon: "mark_chat_read",
      bgColor: "bg-teal-50",
      borderColor: "border-teal-200",
      textColor: "text-teal-700",
      badge: "bg-teal-500",
    },
    bank_sanctioned: {
      icon: "verified",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      textColor: "text-emerald-700",
      badge: "bg-emerald-500",
    },
    bank_conditional_sanctioned: {
      icon: "rule",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      textColor: "text-amber-700",
      badge: "bg-amber-500",
    },
    bank_counter_offer: {
      icon: "compare_arrows",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
      textColor: "text-purple-700",
      badge: "bg-purple-500",
    },
    bank_rejected: {
      icon: "cancel",
      bgColor: "bg-rose-50",
      borderColor: "border-rose-200",
      textColor: "text-rose-700",
      badge: "bg-rose-500",
    },
    bank_disbursed: {
      icon: "payments",
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
      textColor: "text-green-700",
      badge: "bg-green-500",
    },
    bank_sla_warning: {
      icon: "warning",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      textColor: "text-orange-700",
      badge: "bg-orange-500",
    },
    default: {
      icon: "notifications",
      bgColor: "bg-slate-50",
      borderColor: "border-slate-200",
      textColor: "text-slate-700",
      badge: "bg-slate-500",
    },
  };
  return styles[type] || styles.default;
};

const formatTime = (timestamp: string, referenceDate: Date = new Date()) => {
  if (!timestamp) return "";
  let safeTimestamp = timestamp;
  if (!timestamp.endsWith("Z") && !timestamp.includes("+") && !/-\d{2}:\d{2}$/.test(timestamp)) {
    safeTimestamp = timestamp + "Z";
  }
  const date = new Date(safeTimestamp);
  const originalTimeStr = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata'
  });

  const diffMs = referenceDate.getTime() - date.getTime();
  let relative = "";

  if (diffMs < 0) {
    relative = "1min ago";
  } else {
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      const mins = Math.max(1, diffMins);
      if (mins === 30) relative = "30 min ago";
      else relative = `${mins}min ago`;
    } else if (diffHours < 24) {
      if (diffHours === 1) relative = "1hour ago";
      else relative = `${diffHours} hours ago`;
    } else if (diffDays < 7) {
      if (diffDays === 1) relative = "1day ago";
      else relative = `${diffDays}days ago`;
    } else {
      relative = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Kolkata'
      });
    }
  }

  return `${relative} (${originalTimeStr})`;
};

export default function BankNotificationsPanel({
  showUnreadBadge = true,
}: BankNotificationsPanelProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<BankNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [activeToast, setActiveToast] = useState<BankNotification | null>(null);
  const [isAllModalOpen, setIsAllModalOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const socketRef = useRef<Socket | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);

  // Time reference for dynamic relative time updates
  const [timeRef, setTimeRef] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => {
      setTimeRef(new Date());
    }, 15000); // Tick every 15 seconds to keep it fresh
    return () => clearInterval(timer);
  }, []);

  const isNotificationForThisBank = useCallback((notif: BankNotification) => {
    let metadata = notif.metadata;
    if (typeof metadata === "string") {
      try { metadata = JSON.parse(metadata); } catch { }
    }

    // Resolve the current bank's key and full name from storage
    let currentBankId: string | null = null;
    let currentBankName: string | null = null;
    if (typeof window !== "undefined") {
      const selected = sessionStorage.getItem("selectedBank") || localStorage.getItem("selectedBank");
      const map: Record<string, string> = {
        auxilo: "Auxilo Finserve",
        avanse: "Avanse Financial",
        credila: "HDFC Credila",
        idfc: "IDFC FIRST Bank",
        poonawalla: "Poonawalla Fincorp",
      };
      if (selected) {
        currentBankId = selected.toLowerCase();
        currentBankName = map[selected] || null;
      }
    }
    if (!currentBankName) {
      currentBankName = user?.bankName || user?.firstName || null;
    }

    const notifBankId = metadata?.bankId ? String(metadata.bankId).toLowerCase().replace(/[^a-z0-9_-]/g, '_') : null;
    const notifBankName = metadata?.bankName || metadata?.bank;

    // No bank context on notification → global, show to all
    if (!notifBankId && !notifBankName) return true;
    // Can't determine current bank → show to be safe
    if (!currentBankId && !currentBankName) return true;

    // Match by bankId first (most reliable)
    if (notifBankId && currentBankId) {
      return notifBankId === currentBankId;
    }

    // Fall back to bankName comparison
    if (notifBankName && currentBankName) {
      return notifBankName.toLowerCase() === currentBankName.toLowerCase();
    }

    return true;
  }, [user]);


  const fetchNotifications = useCallback(async () => {
    try {
      const data = await apiFetch<any>("/api/notifications");
      if (data && data.success && Array.isArray(data.items)) {
        const filtered = data.items.filter(isNotificationForThisBank);
        // Deduplicate by ID
        const seen = new Set<string>();
        const unique = filtered.filter((n: any) => {
          const key = n.id ? String(n.id) : `${n.title}-${n.timestamp}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setNotifications(unique.slice(0, 50));
        setUnreadCount(unique.filter((n: any) => !n.isRead).length);
      }
    } catch (err) {
      console.error("[BankNotificationsPanel] Fetch error:", err);
    }
  }, [isNotificationForThisBank]);

  useEffect(() => {
    const baseApiUrl =
      typeof window !== "undefined" &&
        (window.location.hostname.includes("localhost") ||
          window.location.hostname.includes("127.0.0.1"))
        ? "http://127.0.0.1:5000"
        : process.env.NEXT_PUBLIC_API_URL ||
        (typeof window !== "undefined"
          ? window.location.origin
          : "http://127.0.0.1:5000");

    const token =
      localStorage.getItem("bankAccessToken") ||
      localStorage.getItem("accessToken");

    const socketUrl = baseApiUrl.endsWith("/api")
      ? baseApiUrl.replace("/api", "/chat")
      : `${baseApiUrl.replace(/\/$/, "")}/chat`;

    socketRef.current = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current.on("connect", () => {
      console.log("[BankNotificationsPanel] Connected to socket.io");
      setIsConnected(true);
      socketRef.current?.emit("joinRoom", "room_bank");

      // Also join the per-bank room so this bank only receives its own notifications
      if (typeof window !== "undefined") {
        const selectedBankId = sessionStorage.getItem("selectedBank") || localStorage.getItem("selectedBank");
        if (selectedBankId) {
          const safeBankId = selectedBankId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
          const perBankRoom = `room_bank_${safeBankId}`;
          socketRef.current?.emit("joinRoom", perBankRoom);
          console.log(`[BankNotificationsPanel] Joined per-bank room: ${perBankRoom}`);
        }
      }
    });

    socketRef.current.on("notification_received", (payload: BankNotification) => {
      console.log("[BankNotificationsPanel] Received notification:", payload);
      if (!isNotificationForThisBank(payload)) {
        console.log("[BankNotificationsPanel] Ignored notification for another bank");
        return;
      }
      setNotifications((prev) => {
        const merged = [payload, ...prev];
        const seen = new Set<string>();
        const unique = merged.filter((n) => {
          const key = n.id ? String(n.id) : `${n.title}-${n.timestamp}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return unique.slice(0, 50);
      });
      setUnreadCount((prev) => prev + 1);

      // Show toast
      setActiveToast(payload);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setActiveToast(null), 7000);
    });

    socketRef.current.on("disconnect", () => {
      console.log("[BankNotificationsPanel] Disconnected");
      setIsConnected(false);
    });

    fetchNotifications();

    return () => {
      socketRef.current?.disconnect();
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, [fetchNotifications, isNotificationForThisBank]);

  // Polling fallback when disconnected
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (!isConnected) {
      fetchNotifications();
      interval = setInterval(fetchNotifications, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isConnected, fetchNotifications]);

  const handleNotificationClick = async (notification: BankNotification) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    if (!notification.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
      try {
        await apiFetch(`/api/notifications/${notification.id}/mark-read`, {
          method: "PUT",
        });
      } catch (err) {
        console.error("[BankNotificationsPanel] Failed to mark read:", err);
      }
    }

    setIsOpen(false);
    setIsAllModalOpen(false);

    // Navigate based on type/metadata
    try {
      let metadata = notification.metadata;
      if (typeof metadata === "string") {
        try { metadata = JSON.parse(metadata); } catch { }
      }

      const submissionId = metadata?.submissionId;
      const applicationId = metadata?.applicationId;

      if (
        notification.type === "bank_application_received" ||
        notification.type === "bank_file_logged"
      ) {
        router.push(submissionId ? `/bank/applications?id=${submissionId}` : "/bank/incoming");
      } else if (notification.type === "bank_chat_received") {
        router.push(metadata?.conversationId ? `/bank/chat?conversationId=${metadata.conversationId}` : "/bank/chat");
      } else if (notification.type === "bank_query_raised" || notification.type === "bank_query_responded") {
        router.push(applicationId ? `/bank/applications?id=${applicationId}` : "/bank/applications");
      } else if (
        notification.type === "bank_sanctioned" ||
        notification.type === "bank_conditional_sanctioned" ||
        notification.type === "bank_counter_offer"
      ) {
        router.push("/bank/decisions");
      } else if (notification.type === "bank_disbursed") {
        router.push("/bank/disbursements");
      } else if (notification.type === "bank_sla_warning") {
        router.push("/bank/analytics");
      } else if (applicationId) {
        router.push(`/bank/applications?id=${applicationId}`);
      } else {
        router.push("/bank/dashboard");
      }
    } catch (err) {
      console.error("[BankNotificationsPanel] Navigation error:", err);
    }
  };

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await apiFetch("/api/notifications/mark-all-read", {
        method: "PUT",
      });
    } catch (err) {
      console.error("[BankNotificationsPanel] Failed to mark all read:", err);
    }
  };

  const filterTabs = [
    { id: "all", label: "All" },
    { id: "bank_application_received", label: "New Files" },
    { id: "bank_query_raised", label: "Queries" },
    { id: "bank_sanctioned", label: "Decisions" },
    { id: "bank_sla_warning", label: "SLA Alerts" },
  ];

  const displayedNotifications = notifications.slice(0, 5);

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-xl bg-[#fbfbff] border border-purple-50 hover:bg-purple-50/40 text-gray-500 hover:text-[#6605c7] flex items-center justify-center relative transition-all"
        title="Notifications"
      >
        <span className="material-symbols-outlined text-lg">notifications</span>

        {showUnreadBadge && unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white font-black text-[9px] flex items-center justify-center shadow-md"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </motion.span>
        )}

        {/* Connection indicator dot */}
        {/* <div
          className={`absolute bottom-1 right-1 w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-gray-300"
            }`}
        /> */}
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full mt-2 w-96 max-h-[480px] bg-white rounded-2xl shadow-2xl border border-purple-50 z-50 overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div
                className="px-5 py-4 border-b border-gray-100"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(102,5,199,0.04) 0%, rgba(139,36,229,0.03) 100%)",
                }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-[#6605c7]">
                      notifications_active
                    </span>
                    Notifications
                  </h3>
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkAllRead();
                        }}
                        className="text-[10px] font-black text-[#6605c7] hover:underline uppercase tracking-wider"
                      >
                        Mark all read
                      </button>
                    )}
                    {!isConnected && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 rounded text-[9px] text-yellow-700 border border-yellow-100">
                        <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                        Offline
                      </div>
                    )}
                    {/* {isConnected && (
                      <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 rounded text-[9px] text-emerald-700 border border-emerald-100">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        Live
                      </div>
                    )} */}
                  </div>
                </div>
              </div>

              {/* Notification List */}
              <div className="overflow-y-auto flex-1">
                <AnimatePresence mode="popLayout">
                  {displayedNotifications.length > 0 ? (
                    displayedNotifications.map((notif, index) => {
                      const style = getNotificationStyle(notif.type);
                      return (
                        <motion.div
                          key={notif.id ? `panel-${notif.id}-${index}` : `panel-notif-${index}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          transition={{ duration: 0.25 }}
                          onClick={() => handleNotificationClick(notif)}
                          className="px-5 py-3.5 border-b border-gray-50 cursor-pointer hover:bg-purple-50/30 transition-colors group"
                        >
                          <div className="flex gap-3">
                            <div
                              className={`flex-shrink-0 w-10 h-10 rounded-xl ${style.bgColor} flex items-center justify-center`}
                            >
                              <span
                                className={`material-symbols-outlined text-[16px] ${style.textColor}`}
                              >
                                {style.icon}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-[12px] text-gray-900 line-clamp-1">
                                {notif.title}
                              </p>
                              <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">
                                {notif.body}
                              </p>
                              <p className="text-[9px] text-gray-400 mt-1.5 font-semibold">
                                {formatTime(notif.timestamp, timeRef)}
                              </p>
                            </div>
                            {!notif.isRead && (
                              <div
                                className={`w-2 h-2 rounded-full ${style.badge} flex-shrink-0 mt-1`}
                              />
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-gray-400">
                      <span className="material-symbols-outlined text-[40px] block mb-2 opacity-30">
                        notifications_off
                      </span>
                      <p className="text-[11px] font-bold">No notifications yet</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        You'll be notified about new files, queries & decisions
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-center">
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setIsAllModalOpen(true);
                    }}
                    className="text-[11px] font-black text-[#6605c7] hover:text-purple-800 transition-colors uppercase tracking-wider w-full"
                  >
                    View All Notifications
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Real-time Toast Popup */}
      {mounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {activeToast && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9, x: 100 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              exit={{ opacity: 0, y: 20, scale: 0.95, x: 100 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              onClick={() => {
                handleNotificationClick(activeToast);
                setActiveToast(null);
              }}
              className="fixed bottom-6 right-6 z-[9999] max-w-sm w-full rounded-2xl shadow-2xl border border-purple-50 p-4 cursor-pointer hover:shadow-[0_15px_40px_rgba(102,5,199,0.18)] transition-shadow"
              style={{
                background:
                  "linear-gradient(135deg, #ffffff 0%, rgba(248,244,255,0.98) 100%)",
                backdropFilter: "blur(20px)",
                borderColor: "rgba(102,5,199,0.15)",
                boxShadow: "0 10px 30px rgba(102,5,199,0.12)",
              }}
            >
              <div className="flex gap-3">
                {(() => {
                  const style = getNotificationStyle(activeToast.type);
                  return (
                    <>
                      {/* Accent bar */}
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
                        style={{ background: "linear-gradient(180deg, #6605c7, #8b24e5)" }}
                      />
                      <div
                        className={`flex-shrink-0 w-11 h-11 rounded-xl ${style.bgColor} flex items-center justify-center ml-1`}
                      >
                        <span
                          className={`material-symbols-outlined text-[20px] ${style.textColor}`}
                        >
                          {style.icon}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <p
                            className="font-black text-[9px] uppercase tracking-[0.15em] leading-none"
                            style={{ color: "#6605c7" }}
                          >
                            Live Bank Alert
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveToast(null);
                            }}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[15px]">close</span>
                          </button>
                        </div>
                        <h4 className="font-extrabold text-[13px] text-gray-900 mt-1 line-clamp-1">
                          {activeToast.title}
                        </h4>
                        <p className="text-[11px] text-gray-600 mt-1 line-clamp-2">
                          {activeToast.body}
                        </p>
                        <p
                          className="text-[9px] font-black mt-2 uppercase tracking-wider"
                          style={{ color: "#6605c7" }}
                        >
                          Tap to view details →
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* View All Modal */}
      {mounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isAllModalOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAllModalOpen(false)}
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-3xl shadow-2xl border border-purple-50 max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col relative z-10"
              >
                {/* Header */}
                <div
                  className="px-7 py-6 border-b border-gray-100"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(102,5,199,0.04) 0%, rgba(255,255,255,1) 100%)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                        <span
                          className="material-symbols-outlined text-[22px]"
                          style={{ color: "#6605c7" }}
                        >
                          notifications_active
                        </span>
                        Bank Notification Center
                      </h2>
                      <p className="text-[11px] text-gray-500 font-semibold mt-1">
                        Real-time alerts for files, queries, decisions &amp; SLA
                      </p>
                    </div>
                    <button
                      onClick={() => setIsAllModalOpen(false)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {filterTabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setSelectedFilter(tab.id)}
                        className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border"
                        style={
                          selectedFilter === tab.id
                            ? {
                              background: "linear-gradient(135deg, #6605c7, #8b24e5)",
                              color: "white",
                              borderColor: "#6605c7",
                              boxShadow: "0 4px 12px rgba(102,5,199,0.2)",
                            }
                            : {
                              background: "white",
                              color: "#6b7280",
                              borderColor: "#e5e7eb",
                            }
                        }
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-7 py-5 space-y-3">
                  {(() => {
                    const filtered =
                      selectedFilter === "all"
                        ? notifications
                        : notifications.filter((n) => n.type === selectedFilter);

                    return filtered.length > 0 ? (
                      filtered.map((notif, index) => {
                        const style = getNotificationStyle(notif.type);
                        return (
                          <div
                            key={notif.id ? `page-${notif.id}-${index}` : `page-notif-${index}`}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-md flex gap-4 relative overflow-hidden ${notif.isRead
                              ? "border-gray-100 opacity-70 hover:opacity-100"
                              : "border-purple-100 shadow-sm"
                              }`}
                          >
                            {!notif.isRead && (
                              <div
                                className="absolute left-0 top-0 bottom-0 w-1"
                                style={{
                                  background: "linear-gradient(180deg, #6605c7, #8b24e5)",
                                }}
                              />
                            )}
                            <div
                              className={`w-11 h-11 rounded-xl ${style.bgColor} flex items-center justify-center flex-shrink-0`}
                            >
                              <span
                                className={`material-symbols-outlined text-[18px] ${style.textColor}`}
                              >
                                {style.icon}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start gap-3">
                                <h4 className="font-extrabold text-[12.5px] text-gray-900 line-clamp-1">
                                  {notif.title}
                                </h4>
                                <span className="text-[9.5px] text-gray-400 font-bold flex-shrink-0">
                                  {formatTime(notif.timestamp, timeRef)}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-600 mt-1 leading-relaxed">
                                {notif.body}
                              </p>
                            </div>
                            {!notif.isRead && (
                              <div
                                className={`w-2.5 h-2.5 rounded-full ${style.badge} flex-shrink-0 self-center`}
                              />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-16 text-center text-gray-400">
                        <span className="material-symbols-outlined text-[48px] block mb-3 opacity-20">
                          notifications_off
                        </span>
                        <p className="text-sm font-bold">No notifications in this category</p>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Switch tabs to see other notifications
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-7 py-4 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {
                      (selectedFilter === "all"
                        ? notifications
                        : notifications.filter((n) => n.type === selectedFilter)
                      ).length
                    }{" "}
                    total
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl border transition-all"
                      style={{
                        color: "#6605c7",
                        borderColor: "rgba(102,5,199,0.2)",
                        background: "rgba(102,5,199,0.04)",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "rgba(102,5,199,0.08)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "rgba(102,5,199,0.04)")
                      }
                    >
                      Mark All as Read
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
