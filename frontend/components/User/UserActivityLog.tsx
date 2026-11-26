"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import { authApi, getToken } from "@/lib/api";

interface Activity {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  link?: string;
  icon?: string;
}

interface UserActivityLogProps {
  userId?: string;
  limit?: number;
  refreshInterval?: number;
  variant?: "sidebar" | "page";
}

const getActivityIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    forum_post: "forum",
    forum_comment: "chat_bubble",
    upload: "upload_file",
    application: "description",
    document_upload: "file_present",
    profile_update: "person",
    application_submitted: "send",
    document_verified: "verified",
    loan_approved: "check_circle",
    loan_rejected: "cancel",
    disbursement: "paid",
    bank_shared: "share",
    profile_created: "person_add",
  };
  return iconMap[type] || "notifications";
};

const getActivityColor = (type: string): { bg: string; text: string; border: string } => {
  const colorMap: Record<string, { bg: string; text: string; border: string }> = {
    forum_post: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100" },
    forum_comment: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
    upload: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-100" },
    document_upload: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-100" },
    application: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100" },
    application_submitted: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100" },
    profile_update: { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-100" },
    profile_created: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
    document_verified: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
    loan_approved: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
    loan_rejected: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-100" },
    disbursement: { bg: "bg-green-50", text: "text-green-700", border: "border-green-100" },
    bank_shared: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-100" },
  };
  return colorMap[type] || { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-100" };
};

const formatRelativeTime = (dateStr: string): string => {
  if (!dateStr) return "Just now";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return "Just now";
  }
};

export default function UserActivityLog({
  userId,
  limit = 10,
  refreshInterval = 30000,
  variant = "sidebar",
}: UserActivityLogProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch activities from backend
  const fetchActivities = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const res: any = await authApi.getDashboardData(userId);
      
      if (res?.data?.activity) {
        const data = Array.isArray(res.data.activity) ? res.data.activity : [];
        
        const formattedActivities = data
          .slice(0, limit)
          .map((activity: any, idx: number) => ({
            ...activity,
            id: activity.id || `act-${Date.now()}-${idx}`,
            timestamp: activity.timestamp || new Date().toISOString(),
            icon: activity.icon || getActivityIcon(activity.type),
          }));

        setActivities(formattedActivities);
      }
      setError(null);
    } catch (err) {
      console.error("Failed to fetch activities:", err);
      setError("Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  // Initialize WebSocket connection for real-time updates
  useEffect(() => {
    const token = getToken();
    if (!userId) return;

    const baseApiUrl = typeof window !== "undefined" && (window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1"))
      ? "http://localhost:5000"
      : (process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000"));

    const socketUrl = baseApiUrl.endsWith("/api")
      ? baseApiUrl.replace("/api", "/chat")
      : `${baseApiUrl.replace(/\/$/, "")}/chat`;

    const socket = io(socketUrl, {
      withCredentials: true,
      auth: token ? { token } : undefined,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log("[UserActivityLog] WebSocket connected");
    });

    socket.on("user_activity", (newActivity: Activity) => {
      console.log("[UserActivityLog] Received user activity:", newActivity);
      const formatted = {
        ...newActivity,
        id: newActivity.id || `act-${Date.now()}`,
        timestamp: newActivity.timestamp || new Date().toISOString(),
        icon: newActivity.icon || getActivityIcon(newActivity.type),
      };

      setActivities((prev) => [formatted, ...prev].slice(0, limit));
    });

    socket.on("disconnect", () => {
      console.log("[UserActivityLog] WebSocket disconnected");
    });

    socketRef.current = socket;

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [userId, limit]);

  // Setup polling for activities
  useEffect(() => {
    fetchActivities();

    pollIntervalRef.current = setInterval(() => {
      fetchActivities();
    }, refreshInterval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [userId, limit, refreshInterval]);

  if (variant === "page") {
    return (
      <div className="space-y-0">
        {/* Header */}
        <div className="flex items-center justify-between px-0 py-3 mb-6">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">history</span>
            Activity Timeline
          </h3>
          <div className="flex items-center gap-1.5">
            {loading && (
              <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            )}
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live" />
          </div>
        </div>

        {/* Activities List - Page Variant */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {activities.length === 0 ? (
              <div className="text-center py-12 px-4 bg-white rounded-xl border border-gray-100">
                <span className="material-symbols-outlined text-5xl text-slate-200 block mb-2">
                  history
                </span>
                <p className="text-[13px] font-medium text-slate-400">
                  No activities yet
                </p>
                <p className="text-[11px] text-slate-300 mt-1">
                  Your activities will appear here
                </p>
              </div>
            ) : (
              activities.map((activity, index) => {
                const styles = getActivityColor(activity.type);
                const relativeTime = formatRelativeTime(activity.timestamp);

                return (
                  <motion.div
                    key={activity.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className={`p-4 rounded-xl border ${styles.bg} ${styles.border} hover:shadow-md transition-all group cursor-pointer`}
                  >
                    <div className="flex gap-4">
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-lg flex-shrink-0 flex items-center justify-center ${styles.bg} border ${styles.border}`}>
                        <span className={`material-symbols-outlined text-[18px] ${styles.text}`}>
                          {activity.icon || getActivityIcon(activity.type)}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-semibold ${styles.text} line-clamp-1`}>
                          {activity.title}
                        </p>
                        <p className="text-[12px] text-gray-600 line-clamp-2 mt-1">
                          {activity.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[11px] text-slate-400">{relativeTime}</span>
                          {activity.link && (
                            <a
                              href={activity.link}
                              className="text-[10px] font-bold text-[#6605c7] hover:underline flex items-center gap-1"
                            >
                              View <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Badge */}
                      {index === 0 && (
                        <div className="flex-shrink-0">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-[9px] font-black uppercase ${styles.bg} ${styles.text}`}>
                            Latest
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })
            )}
          </AnimatePresence>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 mt-6">
            <p className="text-[12px] font-medium text-rose-600 flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]">error</span>
              {error}
            </p>
          </div>
        )}

        {/* Footer */}
        <button
          onClick={fetchActivities}
          className="w-full py-2 mt-4 text-[11px] font-bold uppercase tracking-widest text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[14px]">refresh</span>
          Refresh
        </button>
      </div>
    );
  }

  // Sidebar variant (compact)
  return (
    <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px]">history</span>
          Recent Activity
        </h3>
        <div className="flex items-center gap-1">
          {loading && (
            <div className="w-3 h-3 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          )}
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live" />
        </div>
      </div>

      {/* Activities List - Sidebar Variant */}
      <div className="max-h-[400px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {activities.length === 0 ? (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-3xl text-gray-200 mb-2 block">
                history
              </span>
              <p className="text-[11px] font-medium text-gray-400">
                No recent activity
              </p>
            </div>
          ) : (
            activities.map((activity, index) => {
              const styles = getActivityColor(activity.type);
              const relativeTime = formatRelativeTime(activity.timestamp);

              return (
                <motion.div
                  key={activity.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${styles.bg} border ${styles.border}`}>
                      <span className={`material-symbols-outlined text-[16px] ${styles.text}`}>
                        {activity.icon || getActivityIcon(activity.type)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] font-semibold ${styles.text} line-clamp-2`}>
                        {activity.title}
                      </p>
                      <p className="text-[11px] text-gray-500 line-clamp-1 mt-0.5">
                        {activity.description}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-gray-400">{relativeTime}</span>
                        {index === 0 && (
                          <span className={`text-[9px] font-black uppercase ${styles.text}`}>
                            Latest
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-3 bg-rose-50 border-t border-rose-100">
          <p className="text-[10px] font-medium text-rose-600 flex items-center gap-2">
            <span className="material-symbols-outlined text-[12px]">error</span>
            {error}
          </p>
        </div>
      )}

      {/* Footer */}
      <button
        onClick={fetchActivities}
        className="w-full py-2 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
      >
        <span className="material-symbols-outlined text-[12px]">refresh</span>
        Refresh
      </button>
    </div>
  );
}
