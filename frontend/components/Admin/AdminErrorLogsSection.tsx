"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { adminApi } from "@/lib/api";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Clock,
  Copy,
  Check,
  Trash2,
  ShieldAlert,
  Terminal,
  Activity,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Layers,
  ArrowUpDown,
  RotateCcw,
  CheckSquare,
  Square,
  FileText,
  User as UserIcon,
  Globe,
  ExternalLink,
} from "lucide-react";

interface ErrorLogItem {
  id: string;
  fingerprint: string;
  level: "CRITICAL" | "ERROR" | "WARN" | "INFO";
  name: string;
  message: string;
  statusCode?: number;
  endpoint?: string;
  method?: string;
  stack?: string;
  source: string;
  context?: string;
  metadata?: any;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  occurrences: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
}

interface ErrorStats {
  totalUnresolved: number;
  criticalCount: number;
  todayCount: number;
  weekCount: number;
  breakdownByLevel: Record<string, number>;
  breakdownBySource: Record<string, number>;
  dailyTrend: { date: string; count: number }[];
}

export default function AdminErrorLogsSection({
  onUnresolvedCountChange,
}: {
  onUnresolvedCountChange?: (count: number) => void;
}) {
  // State
  const [logs, setLogs] = useState<ErrorLogItem[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Pagination & Filtering
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"unresolved" | "resolved" | "all">("unresolved");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [statusCodeFilter, setStatusCodeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"lastSeenAt" | "occurrences">("lastSeenAt");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Active Detail Modal
  const [selectedLog, setSelectedLog] = useState<ErrorLogItem | null>(null);
  const [detailTab, setDetailTab] = useState<"stack" | "context" | "payload" | "resolution">("stack");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [resolutionNoteInput, setResolutionNoteInput] = useState("");

  // Auto-refresh interval (seconds: 0 = off, 15, 30, 60)
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await adminApi.getErrorLogStats();
      if (res?.success && res?.data) {
        setStats(res.data);
        if (onUnresolvedCountChange && typeof res.data.totalUnresolved === "number") {
          onUnresolvedCountChange(res.data.totalUnresolved);
        }
      }
    } catch (e) {
      console.error("[AdminErrorLogs] Failed to fetch stats:", e);
    } finally {
      setStatsLoading(false);
    }
  }, [onUnresolvedCountChange]);

  // Fetch Logs
  const fetchLogs = useCallback(
    async (isSilent = false) => {
      try {
        if (!isSilent) setLoading(true);

        const params: Record<string, any> = {
          page,
          limit,
          sortBy,
          sortOrder,
        };

        if (debouncedSearch.trim()) params.search = debouncedSearch.trim();

        if (statusFilter === "unresolved") params.isResolved = false;
        else if (statusFilter === "resolved") params.isResolved = true;

        if (levelFilter !== "all") params.level = levelFilter;
        if (statusCodeFilter !== "all") params.statusCode = Number(statusCodeFilter);
        if (sourceFilter !== "all") params.source = sourceFilter;

        if (timeFilter === "24h") {
          params.startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        } else if (timeFilter === "7d") {
          params.startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        } else if (timeFilter === "30d") {
          params.startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        }

        const res = await adminApi.getErrorLogs(params);
        if (res?.success) {
          setLogs(res.data || []);
          setTotalCount(res.total || 0);
          setTotalPages(res.totalPages || 1);
        }
      } catch (e) {
        console.error("[AdminErrorLogs] Failed to fetch logs:", e);
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [page, limit, sortBy, sortOrder, debouncedSearch, statusFilter, levelFilter, statusCodeFilter, sourceFilter, timeFilter]
  );

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Auto-refresh timer
  useEffect(() => {
    if (autoRefreshSec <= 0) return;
    const interval = setInterval(() => {
      fetchLogs(true);
      fetchStats();
    }, autoRefreshSec * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshSec, fetchLogs, fetchStats]);

  // Single Resolve / Unresolve
  const toggleResolve = async (log: ErrorLogItem, note?: string) => {
    try {
      setActionLoading(true);
      if (log.isResolved) {
        await adminApi.unresolveErrorLog(log.id);
      } else {
        await adminApi.resolveErrorLog(log.id, note || resolutionNoteInput || undefined);
      }
      // Update local state
      setLogs((prev) =>
        prev.map((item) =>
          item.id === log.id
            ? {
                ...item,
                isResolved: !item.isResolved,
                resolvedAt: !item.isResolved ? new Date().toISOString() : undefined,
                resolutionNote: !item.isResolved ? note || resolutionNoteInput : undefined,
              }
            : item
        )
      );
      if (selectedLog && selectedLog.id === log.id) {
        setSelectedLog((prev) =>
          prev
            ? {
                ...prev,
                isResolved: !prev.isResolved,
                resolvedAt: !prev.isResolved ? new Date().toISOString() : undefined,
                resolutionNote: !prev.isResolved ? note || resolutionNoteInput : undefined,
              }
            : null
        );
      }
      fetchStats();
    } catch (e) {
      console.error("[AdminErrorLogs] Failed to toggle resolve:", e);
    } finally {
      setActionLoading(false);
    }
  };

  // Bulk Resolve
  const handleBulkResolve = async () => {
    if (selectedIds.length === 0) return;
    try {
      setActionLoading(true);
      await adminApi.bulkResolveErrorLogs(selectedIds, "Bulk resolved via Admin Dashboard");
      setSelectedIds([]);
      fetchLogs();
      fetchStats();
    } catch (e) {
      console.error("[AdminErrorLogs] Bulk resolve error:", e);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Log
  const handleDeleteLog = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this error log?")) return;
    try {
      setActionLoading(true);
      await adminApi.deleteErrorLog(id);
      if (selectedLog?.id === id) setSelectedLog(null);
      fetchLogs();
      fetchStats();
    } catch (e) {
      console.error("[AdminErrorLogs] Failed to delete log:", e);
    } finally {
      setActionLoading(false);
    }
  };

  // Purge Resolved
  const handlePurgeResolved = async () => {
    if (!confirm("Purge all resolved error logs older than 14 days?")) return;
    try {
      setActionLoading(true);
      await adminApi.purgeErrorLogs(14);
      fetchLogs();
      fetchStats();
    } catch (e) {
      console.error("[AdminErrorLogs] Failed to purge logs:", e);
    } finally {
      setActionLoading(false);
    }
  };

  // Generate Diagnostic Markdown Report
  const generateDiagnosticReport = (log: ErrorLogItem): string => {
    return [
      `### [Bug Report] ${log.name}: ${log.message}`,
      `- **Status Code**: ${log.statusCode || "N/A"}`,
      `- **Level**: ${log.level}`,
      `- **Endpoint**: \`${log.method || "GET"} ${log.endpoint || "N/A"}\``,
      `- **Source / Context**: ${log.source} (${log.context || "N/A"})`,
      `- **First Seen**: ${log.firstSeenAt ? format(new Date(log.firstSeenAt), "yyyy-MM-dd HH:mm:ss") : "N/A"}`,
      `- **Last Seen**: ${log.lastSeenAt ? format(new Date(log.lastSeenAt), "yyyy-MM-dd HH:mm:ss") : "N/A"}`,
      `- **Occurrences**: ${log.occurrences}`,
      `- **User**: ${log.userEmail || log.userId || "Anonymous"} (${log.userRole || "guest"})`,
      `\n\`\`\`\n${log.stack || "No stack trace available"}\n\`\`\``,
      `\n**Sanitized Metadata:**\n\`\`\`json\n${JSON.stringify(log.metadata || {}, null, 2)}\n\`\`\``,
    ].join("\n");
  };

  // Selection toggle
  const toggleSelectAll = () => {
    if (selectedIds.length === logs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(logs.map((l) => l.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-[1550px] mx-auto pb-12">
      {/* ─── Top Header & Controls ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">System Error Logs & Diagnostics</h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  Live Monitor
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-0.5">
                Centralized telemetry capturing server exceptions, HTTP 5xx crashes, background worker failures, and client errors with automated deduplication.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-end md:self-auto">
          {/* Auto Refresh Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600">
            <Activity className={`w-3.5 h-3.5 ${autoRefreshSec > 0 ? "text-emerald-500 animate-pulse" : "text-slate-400"}`} />
            <span className="text-[11px] font-medium">Auto-refresh:</span>
            <select
              value={autoRefreshSec}
              onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
              className="bg-transparent border-0 font-semibold text-slate-800 text-xs focus:ring-0 cursor-pointer"
            >
              <option value={0}>Off</option>
              <option value={10}>Every 10s</option>
              <option value={30}>Every 30s</option>
              <option value={60}>Every 60s</option>
            </select>
          </div>

          {/* Purge Old Resolved */}
          <button
            onClick={handlePurgeResolved}
            disabled={actionLoading}
            className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
            title="Clean up resolved logs older than 14 days"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Purge Resolved</span>
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={() => {
              fetchLogs();
              fetchStats();
            }}
            disabled={loading}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── Metric Stat Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Unresolved Issues */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:border-rose-300 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Unresolved Issues</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900">
              {statsLoading ? "—" : stats?.totalUnresolved ?? 0}
            </span>
            <span className="text-[11px] font-medium text-rose-600">Needs review</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Active exceptions requiring developer triage
          </p>
        </div>

        {/* Critical Failures (5xx) */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:border-amber-300 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Critical (5xx) Crashes</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-amber-600">
              {statsLoading ? "—" : stats?.criticalCount ?? 0}
            </span>
            <span className="text-[11px] font-medium text-slate-500">Server errors</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <Terminal className="w-3 h-3" /> HTTP 500 or fatal unhandled exceptions
          </p>
        </div>

        {/* 24-Hour Volume */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:border-indigo-300 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">24-Hour Activity</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900">
              {statsLoading ? "—" : stats?.todayCount ?? 0}
            </span>
            <span className="text-[11px] font-medium text-slate-500">Logged today</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Unique error fingerprints seen in last 24h
          </p>
        </div>

        {/* 7-Day Total & Mini Trend */}
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm hover:border-slate-300 transition-colors">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">7-Day Total</span>
            <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-900">
              {statsLoading ? "—" : stats?.weekCount ?? 0}
            </span>
            <span className="text-[11px] font-medium text-slate-500">Past 7 days</span>
          </div>

          {/* Mini 7-day spark bars */}
          {stats?.dailyTrend && stats.dailyTrend.length > 0 ? (
            <div className="flex items-end gap-1 h-6 mt-2">
              {stats.dailyTrend.map((d, i) => {
                const max = Math.max(...stats.dailyTrend.map((x) => x.count), 1);
                const heightPct = Math.max(15, Math.round((d.count / max) * 100));
                return (
                  <div
                    key={i}
                    className="flex-1 bg-slate-200 hover:bg-indigo-500 rounded-t-sm transition-colors"
                    style={{ height: `${heightPct}%` }}
                    title={`${d.date}: ${d.count} occurrences`}
                  />
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 mt-2">No historical telemetry</p>
          )}
        </div>
      </div>

      {/* ─── Filter & Search Toolbar ──────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search error message, endpoint URL, error name, or user email..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start">
            <button
              onClick={() => {
                setStatusFilter("unresolved");
                setPage(1);
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                statusFilter === "unresolved"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Unresolved ({stats?.totalUnresolved ?? 0})
            </button>
            <button
              onClick={() => {
                setStatusFilter("resolved");
                setPage(1);
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                statusFilter === "resolved"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Resolved
            </button>
            <button
              onClick={() => {
                setStatusFilter("all");
                setPage(1);
              }}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                statusFilter === "all"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              All Logs
            </button>
          </div>
        </div>

        {/* Second Row: Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          {/* Level Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-400 font-medium">Severity:</span>
            <select
              value={levelFilter}
              onChange={(e) => {
                setLevelFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-0 font-semibold text-slate-700 text-xs focus:ring-0 cursor-pointer"
            >
              <option value="all">All Severities</option>
              <option value="CRITICAL">Critical (Fatal)</option>
              <option value="ERROR">Error</option>
              <option value="WARN">Warning</option>
              <option value="INFO">Info</option>
            </select>
          </div>

          {/* HTTP Status Code Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-400 font-medium">HTTP Code:</span>
            <select
              value={statusCodeFilter}
              onChange={(e) => {
                setStatusCodeFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-0 font-semibold text-slate-700 text-xs focus:ring-0 cursor-pointer"
            >
              <option value="all">All HTTP Codes</option>
              <option value="500">5xx Server Errors</option>
              <option value="400">4xx Client Errors</option>
              <option value="401">401 Unauthorized</option>
              <option value="403">403 Forbidden</option>
              <option value="404">404 Not Found</option>
            </select>
          </div>

          {/* Source Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-400 font-medium">Source:</span>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-0 font-semibold text-slate-700 text-xs focus:ring-0 cursor-pointer"
            >
              <option value="all">All Sources</option>
              <option value="backend">Backend API</option>
              <option value="frontend">Frontend React</option>
              <option value="webhook">Webhooks</option>
              <option value="worker">Background Workers</option>
            </select>
          </div>

          {/* Timeframe Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
            <span className="text-slate-400 font-medium">Timeframe:</span>
            <select
              value={timeFilter}
              onChange={(e) => {
                setTimeFilter(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-0 font-semibold text-slate-700 text-xs focus:ring-0 cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="24h">Past 24 Hours</option>
              <option value="7d">Past 7 Days</option>
              <option value="30d">Past 30 Days</option>
            </select>
          </div>

          {/* Sort By Filter */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 ml-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">Sort:</span>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split("-") as [any, any];
                setSortBy(sb);
                setSortOrder(so);
                setPage(1);
              }}
              className="bg-transparent border-0 font-semibold text-slate-700 text-xs focus:ring-0 cursor-pointer"
            >
              <option value="lastSeenAt-desc">Latest Activity (Newest)</option>
              <option value="lastSeenAt-asc">Oldest Activity</option>
              <option value="occurrences-desc">Highest Frequency (Most Occurrences)</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(levelFilter !== "all" ||
            statusCodeFilter !== "all" ||
            sourceFilter !== "all" ||
            timeFilter !== "all" ||
            search !== "") && (
            <button
              onClick={() => {
                setLevelFilter("all");
                setStatusCodeFilter("all");
                setSourceFilter("all");
                setTimeFilter("all");
                setSearch("");
                setPage(1);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Bulk Action Banner (When items selected) ────────────────────── */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white px-5 py-3 rounded-xl flex items-center justify-between shadow-md animate-fade-in text-xs">
          <div className="flex items-center gap-2 font-medium">
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>
              {selectedIds.length} error {selectedIds.length === 1 ? "issue" : "issues"} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkResolve}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Mark Selected as Resolved</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1.5 text-slate-300 hover:text-white transition-colors"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ─── Main Error Logs Data Table ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[10px] uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3 w-10 text-center">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-700">
                    {selectedIds.length > 0 && selectedIds.length === logs.length ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3">Severity & Status</th>
                <th className="px-4 py-3">Exception Details & Message</th>
                <th className="px-4 py-3">Endpoint / Source</th>
                <th className="px-4 py-3 text-center">Occurrences</th>
                <th className="px-4 py-3">User Context</th>
                <th className="px-4 py-3">Last Seen</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                    <div className="w-7 h-7 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3" />
                    <span className="text-xs font-medium">Loading telemetry logs...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-slate-400">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-3 border border-emerald-100">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">No error logs match your filter</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {statusFilter === "unresolved"
                        ? "Great news! There are currently no unresolved system errors."
                        : "Try adjusting your search or filter settings."}
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isSelected = selectedIds.includes(log.id);
                  const isCritical = log.level === "CRITICAL" || (log.statusCode && log.statusCode >= 500);

                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${
                        isSelected ? "bg-indigo-50/40" : ""
                      } ${log.isResolved ? "opacity-60 bg-slate-50/30" : ""}`}
                      onClick={() => setSelectedLog(log)}
                    >
                      {/* Checkbox */}
                      <td
                        className="px-4 py-3 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(log.id);
                        }}
                      >
                        <button className="text-slate-400 hover:text-slate-700">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Severity & Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                              isCritical
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : log.level === "WARN"
                                ? "bg-amber-100 text-amber-800 border border-amber-200"
                                : "bg-orange-100 text-orange-800 border border-orange-200"
                            }`}
                          >
                            {isCritical && <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />}
                            {log.level}
                          </span>

                          {log.isResolved ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Resolved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Open
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Exception & Message */}
                      <td className="px-4 py-3 max-w-[420px]">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-slate-900 text-xs tracking-tight">{log.name}</span>
                          {log.statusCode && (
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                                log.statusCode >= 500
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              HTTP {log.statusCode}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-600 text-xs line-clamp-2 leading-relaxed font-mono text-[11px] bg-slate-50/80 p-1.5 rounded border border-slate-100">
                          {log.message}
                        </p>
                      </td>

                      {/* Endpoint / Source */}
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          {log.endpoint ? (
                            <div className="flex items-center gap-1.5">
                              {log.method && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-mono font-bold uppercase">
                                  {log.method}
                                </span>
                              )}
                              <span
                                className="font-mono text-[11px] text-slate-700 truncate max-w-[200px] block"
                                title={log.endpoint}
                              >
                                {log.endpoint}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] italic">No endpoint recorded</span>
                          )}
                          <div className="flex items-center gap-1">
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[9px] rounded font-medium capitalize">
                              {log.source}
                            </span>
                            {log.context && (
                              <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                · {log.context}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Occurrences Counter */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold font-mono ${
                            log.occurrences > 10
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : log.occurrences > 1
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          x{log.occurrences}
                        </span>
                      </td>

                      {/* User Context */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.userEmail ? (
                          <div className="space-y-0.5">
                            <p className="text-xs font-medium text-slate-900 truncate max-w-[140px]" title={log.userEmail}>
                              {log.userEmail}
                            </p>
                            {log.userRole && (
                              <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 text-[9px] font-semibold uppercase">
                                {log.userRole}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Anonymous / System</span>
                        )}
                      </td>

                      {/* Last Seen */}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium text-slate-700">
                            {formatDistanceToNow(new Date(log.lastSeenAt), { addSuffix: true })}
                          </p>
                          <p className="text-[10px] text-slate-400 tabular-nums">
                            {format(new Date(log.lastSeenAt), "MMM d, HH:mm")}
                          </p>
                        </div>
                      </td>

                      {/* Actions */}
                      <td
                        className="px-4 py-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Quick Toggle Resolve */}
                          <button
                            onClick={() => toggleResolve(log)}
                            disabled={actionLoading}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              log.isResolved
                                ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                            }`}
                            title={log.isResolved ? "Reopen issue" : "Mark as resolved"}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>

                          {/* Inspect Details */}
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg transition-colors"
                            title="Inspect stack trace & metadata"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete log permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Pagination Footer ──────────────────────────────────────────── */}
        {totalCount > 0 && (
          <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span>Showing</span>
              <span className="font-semibold text-slate-900">
                {Math.min((page - 1) * limit + 1, totalCount)}—{Math.min(page * limit, totalCount)}
              </span>
              <span>of</span>
              <span className="font-semibold text-slate-900">{totalCount}</span>
              <span>error events</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-100 transition-colors disabled:opacity-40 flex items-center gap-1 shadow-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Previous
              </button>
              <span className="px-2 py-1 font-semibold text-slate-700 text-xs">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-40 flex items-center gap-1 shadow-sm"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Error Deep-Dive Slide-over / Modal ────────────────────────────── */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                      selectedLog.level === "CRITICAL"
                        ? "bg-rose-100 text-rose-800 border border-rose-200"
                        : selectedLog.level === "WARN"
                        ? "bg-amber-100 text-amber-800 border border-amber-200"
                        : "bg-orange-100 text-orange-800 border border-orange-200"
                    }`}
                  >
                    {selectedLog.level}
                  </span>
                  {selectedLog.statusCode && (
                    <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-xs">
                      HTTP {selectedLog.statusCode}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-xs">
                    {selectedLog.occurrences} {selectedLog.occurrences === 1 ? "occurrence" : "occurrences"}
                  </span>
                  {selectedLog.isResolved && (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                    </span>
                  )}
                </div>

                <h2 className="text-lg font-bold text-slate-900 mt-2 font-mono break-all">
                  {selectedLog.name}: {selectedLog.message}
                </h2>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                  <span>First Seen: {format(new Date(selectedLog.firstSeenAt), "yyyy-MM-dd HH:mm:ss")}</span>
                  <span>·</span>
                  <span>Last Seen: {format(new Date(selectedLog.lastSeenAt), "yyyy-MM-dd HH:mm:ss")}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Copy Diagnostic Report */}
                <button
                  onClick={() =>
                    handleCopy(generateDiagnosticReport(selectedLog), "diagnostic_report")
                  }
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                  title="Copy full markdown bug report for Slack / GitHub"
                >
                  {copiedKey === "diagnostic_report" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Report</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-2 px-6 border-b border-slate-200 bg-white">
              <button
                onClick={() => setDetailTab("stack")}
                className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  detailTab === "stack"
                    ? "border-slate-900 text-slate-900 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                Stack Trace
              </button>
              <button
                onClick={() => setDetailTab("context")}
                className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  detailTab === "context"
                    ? "border-slate-900 text-slate-900 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                Request Context
              </button>
              <button
                onClick={() => setDetailTab("payload")}
                className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  detailTab === "payload"
                    ? "border-slate-900 text-slate-900 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                Sanitized Metadata
              </button>
              <button
                onClick={() => setDetailTab("resolution")}
                className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
                  detailTab === "resolution"
                    ? "border-slate-900 text-slate-900 font-bold"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Resolution & Triage
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50/30">
              {/* TAB 1: Stack Trace */}
              {detailTab === "stack" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-700">Exception Call Stack</span>
                    {selectedLog.stack && (
                      <button
                        onClick={() => handleCopy(selectedLog.stack || "", "stack")}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1 transition-colors shadow-sm"
                      >
                        {copiedKey === "stack" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy Stack</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {selectedLog.stack ? (
                    <div className="bg-slate-950 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 shadow-inner max-h-[420px] custom-scrollbar">
                      {selectedLog.stack.split("\n").map((line, idx) => {
                        const isAt = line.trim().startsWith("at ");
                        const isAppFile = !line.includes("node_modules");
                        return (
                          <div
                            key={idx}
                            className={`py-0.5 ${
                              idx === 0
                                ? "text-rose-400 font-bold"
                                : isAppFile && isAt
                                ? "text-amber-300 font-semibold bg-white/5 px-1 rounded"
                                : "text-slate-400"
                            }`}
                          >
                            <span className="inline-block w-8 text-right pr-3 text-slate-600 select-none">
                              {idx + 1}
                            </span>
                            {line}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
                      <Terminal className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs">No stack trace captured for this error</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Request Context */}
              {detailTab === "context" && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">HTTP Request Details</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                        <dt className="text-slate-400 text-[10px] uppercase font-bold">Method & URL</dt>
                        <dd className="font-mono font-semibold text-slate-900 mt-1 break-all">
                          {selectedLog.method || "N/A"} {selectedLog.endpoint || "N/A"}
                        </dd>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                        <dt className="text-slate-400 text-[10px] uppercase font-bold">HTTP Status</dt>
                        <dd className="font-semibold text-slate-900 mt-1">{selectedLog.statusCode || "N/A"}</dd>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                        <dt className="text-slate-400 text-[10px] uppercase font-bold">Source & Context</dt>
                        <dd className="font-semibold text-slate-900 mt-1">
                          {selectedLog.source} · {selectedLog.context || "Global"}
                        </dd>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                        <dt className="text-slate-400 text-[10px] uppercase font-bold">Fingerprint Group</dt>
                        <dd className="font-mono text-[11px] text-slate-700 mt-1">{selectedLog.fingerprint}</dd>
                      </div>
                    </dl>
                  </div>

                  {/* User Information */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                      Impacted User Context
                    </h3>
                    {selectedLog.userEmail || selectedLog.userId ? (
                      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                          <dt className="text-slate-400 text-[10px] uppercase font-bold">Email Address</dt>
                          <dd className="font-semibold text-slate-900 mt-1">{selectedLog.userEmail || "N/A"}</dd>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                          <dt className="text-slate-400 text-[10px] uppercase font-bold">User Role</dt>
                          <dd className="font-semibold text-slate-900 mt-1 capitalize">{selectedLog.userRole || "User"}</dd>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded border border-slate-100">
                          <dt className="text-slate-400 text-[10px] uppercase font-bold">User ID</dt>
                          <dd className="font-mono text-[11px] text-slate-700 mt-1">{selectedLog.userId || "N/A"}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        Anonymous or unauthenticated client request.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Sanitized Metadata */}
              {detailTab === "payload" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-700">Request Headers, Query & Sanitized Body</span>
                    {selectedLog.metadata && (
                      <button
                        onClick={() =>
                          handleCopy(JSON.stringify(selectedLog.metadata, null, 2), "metadata")
                        }
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1 transition-colors shadow-sm"
                      >
                        {copiedKey === "metadata" ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span>Copy JSON</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {selectedLog.metadata ? (
                    <pre className="bg-slate-950 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 shadow-inner max-h-[420px] custom-scrollbar">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-center py-12 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-white">
                      <Layers className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs">No metadata or payload captured</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: Resolution & Triage */}
              {detailTab === "resolution" && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Issue Resolution Status</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Track bug fixes and mark this error group as handled.
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          selectedLog.isResolved
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {selectedLog.isResolved ? "Resolved" : "Open / Unresolved"}
                      </span>
                    </div>

                    {selectedLog.isResolved && (
                      <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-3.5 text-xs text-emerald-900 space-y-1">
                        <p className="font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Resolved by {selectedLog.resolvedBy || "Admin"} on{" "}
                          {selectedLog.resolvedAt
                            ? format(new Date(selectedLog.resolvedAt), "MMM d, yyyy · HH:mm")
                            : "N/A"}
                        </p>
                        {selectedLog.resolutionNote && (
                          <p className="text-emerald-800 mt-1 pl-5 italic font-mono text-[11px]">
                            "{selectedLog.resolutionNote}"
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <label className="block text-xs font-semibold text-slate-700">
                        Resolution Note (Optional)
                      </label>
                      <textarea
                        value={resolutionNoteInput}
                        onChange={(e) => setResolutionNoteInput(e.target.value)}
                        placeholder="e.g. Fixed null check in application controller; deployed in build v1.2..."
                        rows={3}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => toggleResolve(selectedLog, resolutionNoteInput)}
                        disabled={actionLoading}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm ${
                          selectedLog.isResolved
                            ? "bg-slate-900 hover:bg-slate-800 text-white"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{selectedLog.isResolved ? "Reopen Issue" : "Mark as Resolved"}</span>
                      </button>

                      <button
                        onClick={() => handleDeleteLog(selectedLog.id)}
                        disabled={actionLoading}
                        className="px-3 py-2 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg text-xs font-medium transition-colors"
                      >
                        Delete Log
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-white flex justify-between items-center text-xs">
              <span className="text-slate-400 font-mono text-[10px]">ID: {selectedLog.id}</span>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
