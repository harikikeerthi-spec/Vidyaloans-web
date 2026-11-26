"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import { bankApi, getToken } from "@/lib/api";

interface SharedApplication {
  id: string;
  studentName: string;
  email: string;
  loanAmount: number;
  status: string;
  bank: string;
  sharedAt: string;
  documents: number;
  progress: number;
}

interface BankDashboardActivityProps {
  bankId?: string;
  limit?: number;
}

const BankDashboardActivity = ({ bankId, limit = 15 }: BankDashboardActivityProps) => {
  const [sharedApplications, setSharedApplications] = useState<SharedApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    totalShared: 0,
    pendingReview: 0,
    inProgress: 0,
    completed: 0,
  });
  const socketRef = useRef<Socket | null>(null);

  // Load shared applications
  const loadSharedApplications = async () => {
    try {
      setLoading(true);
      const res: any = await bankApi.getIncomingFiles(limit);
      const files = Array.isArray(res) ? res : res?.data || [];

      const applications = files.map((file: any) => ({
        id: file.id,
        studentName: file.applicationNumber || file.studentName || "Unknown",
        email: file.email || "N/A",
        loanAmount: file.amount || 0,
        status: file.status || "pending",
        bank: file.bank || "N/A",
        sharedAt: file.createdAt || new Date().toISOString(),
        documents: file.documentCount || 0,
        progress: file.progress || 10,
      }));

      setSharedApplications(applications);

      // Calculate stats
      setStats({
        totalShared: applications.length,
        pendingReview: applications.filter((a: any) => a.status === "pending").length,
        inProgress: applications.filter((a: any) => a.status === "processing").length,
        completed: applications.filter((a: any) => a.status === "approved" || a.status === "rejected").length,
      });
    } catch (err) {
      console.error("Failed to load shared applications:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize WebSocket for real-time updates
  useEffect(() => {
    const token = getToken();

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
      console.log("[BankDashboardActivity] WebSocket connected");
    });

    socket.on("new_application_shared", (newApp: any) => {
      console.log("[BankDashboardActivity] New application shared:", newApp);
      const application: SharedApplication = {
        id: newApp.id || `app-${Date.now()}`,
        studentName: newApp.studentName || "New Student",
        email: newApp.email || "N/A",
        loanAmount: newApp.loanAmount || 0,
        status: newApp.status || "pending",
        bank: newApp.bank || "Our Bank",
        sharedAt: newApp.sharedAt || new Date().toISOString(),
        documents: newApp.documents || 0,
        progress: 25,
      };

      setSharedApplications((prev) => [application, ...prev].slice(0, limit));
      setStats((prev) => ({
        ...prev,
        totalShared: prev.totalShared + 1,
        pendingReview: prev.pendingReview + 1,
      }));
    });

    socket.on("application_status_updated", (update: any) => {
      console.log("[BankDashboardActivity] Application status updated:", update);
      setSharedApplications((prev) =>
        prev.map((app) =>
          app.id === update.applicationId
            ? {
                ...app,
                status: update.newStatus,
                progress: update.progress || app.progress,
              }
            : app
        )
      );
    });

    socket.on("disconnect", () => {
      console.log("[BankDashboardActivity] WebSocket disconnected");
    });

    socketRef.current = socket;

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [limit]);

  // Load initial data and set up polling
  useEffect(() => {
    loadSharedApplications();

    // Poll every 30 seconds
    const interval = setInterval(() => {
      loadSharedApplications();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const originalTimeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
      const now = new Date();
      const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      let relative = "";
      if (diffInSeconds < 60) relative = "Just now";
      else if (diffInSeconds < 3600) relative = `${Math.floor(diffInSeconds / 60)}m ago`;
      else if (diffInSeconds < 86400) relative = `${Math.floor(diffInSeconds / 3600)}h ago`;
      else relative = date.toLocaleDateString("en-IN");

      return `${relative} (${originalTimeStr})`;
    } catch {
      return "Recently";
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string; icon: string }> = {
      pending: { bg: "bg-amber-50", text: "text-amber-700", icon: "schedule" },
      processing: { bg: "bg-blue-50", text: "text-blue-700", icon: "hourglass_bottom" },
      approved: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "check_circle" },
      rejected: { bg: "bg-rose-50", text: "text-rose-700", icon: "cancel" },
    };
    return colors[status] || colors.pending;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-indigo-600">inbox</span>
          Shared Applications
        </h2>
        <button
          onClick={loadSharedApplications}
          className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2 transition-all"
        >
          <span className="material-symbols-outlined text-lg">refresh</span>
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Shared",
            value: stats.totalShared,
            icon: "inbox",
            color: "from-indigo-600 to-indigo-400",
            bg: "bg-indigo-50",
            border: "border-indigo-100",
          },
          {
            label: "Pending Review",
            value: stats.pendingReview,
            icon: "schedule",
            color: "from-amber-600 to-amber-400",
            bg: "bg-amber-50",
            border: "border-amber-100",
          },
          {
            label: "In Progress",
            value: stats.inProgress,
            icon: "hourglass_bottom",
            color: "from-blue-600 to-blue-400",
            bg: "bg-blue-50",
            border: "border-blue-100",
          },
          {
            label: "Completed",
            value: stats.completed,
            icon: "check_circle",
            color: "from-emerald-600 to-emerald-400",
            bg: "bg-emerald-50",
            border: "border-emerald-100",
          },
        ].map((stat, i) => (
          <div
            key={i}
            className={`relative overflow-hidden rounded-xl border ${stat.border} ${stat.bg} p-4 group hover:shadow-lg transition-all`}
          >
            <div className={`absolute -right-8 -top-8 w-24 h-24 bg-gradient-to-br ${stat.color} opacity-10 rounded-full blur-2xl`} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
                  {stat.label}
                </span>
                <span className={`material-symbols-outlined text-2xl text-transparent bg-clip-text bg-gradient-to-r ${stat.color}`}>
                  {stat.icon}
                </span>
              </div>
              <p className={`text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r ${stat.color}`}>
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Applications List */}
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-slate-600">
                  Student Name
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-slate-600">
                  Loan Amount
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-slate-600">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-slate-600">
                  Documents
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-slate-600">
                  Progress
                </th>
                <th className="px-6 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-slate-600">
                  Shared At
                </th>
                <th className="px-6 py-4 text-center text-[11px] font-bold uppercase tracking-widest text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-slate-100 border-t-slate-900 rounded-full animate-spin" />
                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">
                          Loading Applications...
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : sharedApplications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <span className="material-symbols-outlined text-5xl text-slate-200">
                          inbox
                        </span>
                        <p className="text-[13px] font-bold text-slate-400 uppercase tracking-widest">
                          No applications shared yet
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sharedApplications.map((app) => {
                    const statusColor = getStatusColor(app.status);
                    return (
                      <motion.tr
                        key={app.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-[13px] font-bold text-slate-900">
                              {app.studentName}
                            </p>
                            <p className="text-[11px] text-slate-500">{app.email}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[13px] font-bold text-slate-900">
                            {formatCurrency(app.loanAmount)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-widest ${statusColor.bg} ${statusColor.text} border`}>
                            <span className="material-symbols-outlined text-[14px]">
                              {statusColor.icon}
                            </span>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[13px] font-bold text-slate-900">
                            {app.documents} documents
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all"
                                style={{ width: `${app.progress}%` }}
                              />
                            </div>
                            <span className="text-[11px] font-bold text-slate-600 w-8 text-right">
                              {app.progress}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[12px] text-slate-600">
                            {formatDate(app.sharedAt)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[11px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors flex items-center gap-1 mx-auto">
                            <span className="material-symbols-outlined text-[14px]">
                              arrow_forward
                            </span>
                            Review
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Activity Indicator */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
        <p className="text-[12px] font-bold text-indigo-700">
          Real-time updates enabled · Applications are being shared in live time
        </p>
      </div>
    </div>
  );
};

export default BankDashboardActivity;
