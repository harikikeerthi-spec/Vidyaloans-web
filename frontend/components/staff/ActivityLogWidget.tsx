"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import { staffProfileApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/utils";

interface Activity {
  id: string;
  type: string;
  msg: string;
  icon: string;
  color: string;
  actorName?: string;
  createdAt: string;
}

interface ActivityLogWidgetProps {
  limit?: number;
  refreshInterval?: number;
  showFullLog?: boolean;
  onViewAll?: () => void;
  staffId?: string;
}

const getActivityStyles = (type: string) => {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    doc_view: { bg: "bg-purple-50", text: "text-[#6605c7]", border: "border-purple-100" },
    evv: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
    status: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100" },
    share: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100" },
    note: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-100" },
    update: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
    link: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-100" },
    sync: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
  };
  return styles[type] || styles.update;
};

const formatOriginalTime = (dateStr: string): string => {
  if (!dateStr) return "";
  return formatDateTime(dateStr, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export default function ActivityLogWidget({ 
  limit = 10, 
  refreshInterval = 30000,
  showFullLog = false,
  onViewAll,
  staffId: propStaffId
}: ActivityLogWidgetProps) {
  const { user } = useAuth();
  const isPureStaff = user?.role === "staff";
  const [selectedStaffId, setSelectedStaffId] = useState<string>(propStaffId || "me");
  const [staffMembers, setStaffMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timestampIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load staff list for dropdown (admins only)
  useEffect(() => {
    if (isPureStaff) return;
    staffProfileApi.getStaffMembersList()
      .then((res: any) => {
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setStaffMembers(list);
      })
      .catch(err => console.error("Failed to load staff list:", err));
  }, [isPureStaff]);

  // Sync propStaffId if changed from parent
  useEffect(() => {
    if (propStaffId !== undefined) {
      setSelectedStaffId(propStaffId);
    }
  }, [propStaffId]);

  // Fetch activities from backend
  const fetchActivities = async () => {
    const token =
      localStorage.getItem("staffAccessToken") ||
      localStorage.getItem("adminAccessToken");
    if (!token) return;

    try {
      setLoading(true);
      const res: any = await staffProfileApi.getDashboardActivities(limit, isPureStaff ? "me" : selectedStaffId);
      const data = Array.isArray(res) ? res : res?.data || [];
      
      const formattedActivities = data.map((activity: any) => ({
        ...activity,
        id: activity.id || `act-${Date.now()}-${Math.random()}`,
        createdAt: activity.createdAt || new Date().toISOString(),
      }));

      setActivities(formattedActivities);
      setError(null);
    } catch (err: any) {
      if (err?.message?.includes("Invalid or expired token") || err?.message?.includes("401")) {
        console.warn("[ActivityLogWidget] Session expired while fetching activities.");
      } else {
        console.error("Failed to fetch activities:", err);
      }
      setError("Failed to load activities");
    } finally {
      setLoading(false);
    }
  };

  // Initialize WebSocket connection for real-time updates
  useEffect(() => {
    const token =
      localStorage.getItem("staffAccessToken") ||
      localStorage.getItem("adminAccessToken") ||
      localStorage.getItem("accessToken");
    if (!token) return;

    const baseApiUrl = typeof window !== "undefined" && (window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1"))
      ? "http://localhost:5000"
      : (process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000"));
    
    const socketUrl = baseApiUrl.endsWith("/api")
      ? baseApiUrl.replace("/api", "/chat")
      : `${baseApiUrl.replace(/\/$/, "")}/chat`;

    const socket = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      console.log("[ActivityLogWidget] WebSocket connected");
    });

    socket.on("user_activity", (newActivity: Activity) => {
      if (isPureStaff) {
        const myEmail = (user?.email || '').toLowerCase();
        const myId = (user?.id || '').toLowerCase();
        const actEmail = ((newActivity as any).actorEmail || newActivity.actorName || '').toLowerCase();
        const actId = ((newActivity as any).initiatedBy || '').toLowerCase();

        const isMine = (myEmail && actEmail.includes(myEmail)) || (myId && actId === myId);
        if (!isMine) return; // Skip activities of other staff members!
      }

      console.log("[ActivityLogWidget] Received staff activity:", newActivity);
      const formatted = {
        ...newActivity,
        id: newActivity.id || `act-${Date.now()}-${Math.random()}`,
        createdAt: newActivity.createdAt || new Date().toISOString(),
      };
      
      setActivities((prev) => [formatted, ...prev].slice(0, limit));
    });

    socket.on("disconnect", () => {
      console.log("[ActivityLogWidget] WebSocket disconnected");
    });

    socketRef.current = socket;

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [limit]);

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
  }, [limit, refreshInterval, selectedStaffId]);

  // Auto-refresh timestamp display every 10 seconds
  useEffect(() => {
    timestampIntervalRef.current = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 10000);

    return () => {
      if (timestampIntervalRef.current) {
        clearInterval(timestampIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="space-y-3 pb-2">
      {/* Header */}
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-600">history</span>
            Staff History
          </h3>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              {loading && (
                <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              )}
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live connection active" />
            </div>
            <button
              onClick={() => {
                fetchActivities();
                setRefreshKey(prev => prev + 1);
              }}
              className="p-1 hover:bg-slate-100 rounded transition-colors flex items-center"
              title="Refresh activities"
            >
              <span className="material-symbols-outlined text-[16px] text-slate-500">refresh</span>
            </button>
            <button
              onClick={() => {
                if (onViewAll) {
                  onViewAll();
                } else {
                  setIsModalOpen(true);
                }
              }}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors flex items-center gap-1 cursor-pointer"
              title="View full activity log"
            >
              View All
              <span className="material-symbols-outlined text-[12px]">arrow_forward_ios</span>
            </button>
          </div>
        </div>

        {/* Staff Filter Selector Sub-Bar (Admins Only) */}
        {!isPureStaff && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-200/50">
            <div className="flex bg-slate-200/60 p-0.5 rounded-lg text-[10px] font-bold">
              <button
                onClick={() => setSelectedStaffId("me")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  selectedStaffId === "me" 
                    ? "bg-white text-indigo-600 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                My Log
              </button>
              <button
                onClick={() => setSelectedStaffId("all")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  selectedStaffId === "all" 
                    ? "bg-white text-indigo-600 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Staff
              </button>
            </div>

            {staffMembers.length > 0 && (
              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="ml-auto text-[10px] font-semibold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[140px] truncate"
              >
                <option value="me">Logged In Staff</option>
                <option value="all">All Staff Members</option>
                <optgroup label="Individual Staff">
                  {staffMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name || member.email}
                    </option>
                  ))}
                </optgroup>
              </select>
            )}
          </div>
        )}
      </div>

      {/* Activities List */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto px-2" key={refreshKey}>
        <AnimatePresence mode="popLayout">
          {loading && activities.length === 0 ? (
            // Loading skeleton
            <>
              {[...Array(3)].map((_, i) => (
                <div key={`skeleton-${i}`} className="p-3 rounded-lg bg-slate-50 border border-slate-100 animate-pulse">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-200 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-3/4" />
                      <div className="h-3 bg-slate-200 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 px-4">
              <span className="material-symbols-outlined text-4xl text-slate-200 block mb-2">
                history
              </span>
              <p className="text-[12px] font-medium text-slate-400">
                No activities yet
              </p>
            </div>
          ) : (
            activities.map((activity, index) => {
              const styles = getActivityStyles(activity.type);
              const originalTime = formatOriginalTime(activity.createdAt);

              return (
                <motion.div
                  key={activity.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className={`p-3 rounded-lg border ${styles.bg} ${styles.border} hover:shadow-md transition-all group cursor-pointer`}
                >
                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${styles.bg} border ${styles.border}`}>
                      <span className={`material-symbols-outlined text-[16px] ${styles.text}`}>
                        {activity.icon || 'history'}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] font-semibold ${styles.text} line-clamp-2`}>
                        {activity.msg}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {activity.actorName && (
                          <span className="text-[10px] font-medium text-slate-500">
                            by {activity.actorName}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">{originalTime}</span>
                      </div>
                    </div>

                    {/* Badge for type */}
                    {index === 0 && (
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${styles.bg} ${styles.text}`}>
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
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 mx-2 mt-2">
          <p className="text-[11px] font-medium text-rose-600 flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">error</span>
            {error}
          </p>
        </div>
      )}

      {/* Full Activity Log Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden border border-slate-100 flex flex-col"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-600">history</span>
                    Recent Activity History Log
                  </h3>
                  <p className="text-xs text-slate-500">All recent activities grouped chronologically by date</p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {activities.length > 0 ? (
                  <div className="space-y-4">
                    {activities.map((act) => (
                      <div key={act.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-start gap-4 hover:bg-white transition-all">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${act.color || 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                          <span className="material-symbols-outlined text-[20px]">{act.icon || 'history'}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <p className="text-[14px] font-bold text-slate-900 leading-snug">{act.msg}</p>
                            <span className="px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-100 text-[11px] font-bold text-indigo-700 font-mono shrink-0">
                              {formatOriginalTime(act.createdAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider">
                              {act.type}
                            </span>
                            {act.actorName && (
                              <span className="text-[11px] font-medium text-slate-500">
                                by {act.actorName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-16 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2">manage_search</span>
                    <p className="text-sm font-bold">No activity records available</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
