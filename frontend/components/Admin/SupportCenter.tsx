"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supportApi } from "@/lib/api";
import { format, formatDistanceToNow, differenceInMinutes } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  priority: "critical" | "high" | "medium" | "low";
  status: string;
  createdByName: string;
  createdByEmail: string;
  createdByRole: string;
  assignedToId?: string;
  assignedToName?: string;
  teamName?: string;
  loanApplicationNum?: string;
  loanStage?: string;
  studentName?: string;
  universityName?: string;
  slaBreached: boolean;
  slaResponseAt?: string;
  slaResolveAt?: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  comments?: Comment[];
  activityLogs?: ActivityLog[];
  attachments?: any[];
  _count?: { comments: number; attachments: number };
}

interface Comment {
  id: string;
  authorName: string;
  authorRole: string;
  content: string;
  isInternal: boolean;
  type: string;
  createdAt: string;
}

interface ActivityLog {
  id: string;
  actorName: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PRIORITY_CONFIG = {
  critical: { label: "Critical", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", icon: "🔴" },
  high: { label: "High", color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500", icon: "🟠" },
  medium: { label: "Medium", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500", icon: "🔵" },
  low: { label: "Low", color: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500", icon: "🟢" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  open: { label: "Open", color: "bg-amber-100 text-amber-700 border-amber-200", icon: "radio_button_unchecked" },
  assigned: { label: "Assigned", color: "bg-blue-100 text-blue-700 border-blue-200", icon: "person" },
  in_progress: { label: "In Progress", color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: "autorenew" },
  waiting_customer: { label: "Waiting Customer", color: "bg-purple-100 text-purple-700 border-purple-200", icon: "hourglass_empty" },
  resolved: { label: "Resolved", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: "check_circle" },
  out_of_scope: { label: "Out of Scope", color: "bg-rose-100 text-rose-700 border-rose-200", icon: "cancel" },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-600 border-slate-200", icon: "lock" },
};

const DEFAULT_CATEGORIES = [
  "Loan Application", "Bank Statement", "EVV", "OCR", "Digilocker",
  "Document Verification", "University", "Visa", "Payment", "Disbursement",
  "EMI", "Authentication", "Profile", "API Error", "Technical Issue", "Others"
];

const parseISTDate = (dateVal: any): Date => {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  let s = String(dateVal).trim();
  if (!s.endsWith("Z") && !s.includes("+") && !s.includes("Z")) {
    s += "Z";
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
};

const formatIST = (dateVal: any, pattern: "full" | "short" | "time" | "relative" = "full"): string => {
  if (!dateVal) return "—";
  const d = parseISTDate(dateVal);

  if (pattern === "relative") {
    return formatDistanceToNow(d, { addSuffix: true });
  }

  const options: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  if (pattern === "short") {
    options.year = undefined;
  } else if (pattern === "time") {
    options.year = undefined;
    options.month = undefined;
    options.day = undefined;
  }

  return new Intl.DateTimeFormat("en-IN", options).format(d);
};

const getAttachmentUrl = (att: any) => {
  if (!att) return "#";
  const path = att.fileUrl || att.url || att.filePath || "";
  if (!path) return "#";
  if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("blob:") || path.startsWith("data:")) {
    return path;
  }
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  return `${apiBase.replace(/\/api$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
};

const isImageAttachment = (att: any) => {
  if (!att) return false;
  const mime = (att.mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  const nameOrPath = (att.fileName || att.filePath || att.fileUrl || att.url || "").toLowerCase();
  const cleanPath = nameOrPath.split("?")[0];
  return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(cleanPath) || nameOrPath.startsWith("data:image");
};

// ─── Utility Components ───────────────────────────────────────────────────────

const PriorityBadge = ({ priority }: { priority: string }) => {
  const cfg = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, color: "bg-slate-100 text-slate-600 border-slate-200", icon: "circle" };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
      <span className="material-symbols-outlined text-[11px]">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
};

const SLATimer = ({ slaResolveAt, status }: { slaResolveAt?: string; status: string }) => {
  const [remaining, setRemaining] = useState("");
  const [isBreached, setIsBreached] = useState(false);

  useEffect(() => {
    if (!slaResolveAt || ["resolved", "closed"].includes(status)) return;
    const update = () => {
      const deadline = new Date(slaResolveAt);
      const now = new Date();
      const diff = deadline.getTime() - now.getTime();
      setIsBreached(diff < 0);
      const absDiff = Math.abs(diff);
      const h = Math.floor(absDiff / 3600000);
      const m = Math.floor((absDiff % 3600000) / 60000);
      setRemaining(`${diff < 0 ? "-" : ""}${h}h ${m}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [slaResolveAt, status]);

  if (!slaResolveAt || ["resolved", "closed"].includes(status)) {
    return <span className="text-slate-400 text-[10px]">—</span>;
  }

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${isBreached ? "text-red-600" : "text-emerald-700"}`}>
      <span className="material-symbols-outlined text-[12px]">{isBreached ? "warning" : "schedule"}</span>
      {remaining}
    </span>
  );
};

const SkeletonRow = () => (
  <tr className="border-b border-slate-100">
    {Array.from({ length: 9 }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
      </td>
    ))}
  </tr>
);

const EmptyState = ({ icon, title, desc }: { icon: string; title: string; desc: string }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
      <span className="material-symbols-outlined text-[32px] text-indigo-400">{icon}</span>
    </div>
    <h3 className="text-slate-700 font-semibold text-sm mb-1">{title}</h3>
    <p className="text-slate-400 text-xs max-w-48">{desc}</p>
  </div>
);

const StatCard = ({ label, value, icon, color, sub }: any) => (
  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </div>
    </div>
    <div className="text-2xl font-bold text-slate-900 mb-0.5">{value ?? "—"}</div>
    <div className="text-[11px] font-medium text-slate-500">{label}</div>
    {sub && <div className="text-[10px] text-slate-400 mt-1">{sub}</div>}
  </div>
);

const MiniBarChart = ({ data, color = "#6366f1" }: { data: number[]; color?: string }) => {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-12">
      {data.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm transition-all duration-300"
          style={{ height: `${(v / max) * 100}%`, backgroundColor: color, opacity: 0.3 + (i / data.length) * 0.7 }}
          title={`${v}`}
        />
      ))}
    </div>
  );
};

const DonutChart = ({ data }: { data: { label: string; value: number; color: string }[] }) => {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let cum = 0;
  const R = 42, cx = 60, cy = 60, C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-4">
      <svg width={120} height={120} className="-rotate-90 flex-shrink-0">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f1f5f9" strokeWidth={16} />
        {data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * C;
          const gap = C - dash;
          const offset = cum * C;
          cum += frac;
          return <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={d.color}
            strokeWidth={16} strokeDasharray={`${dash} ${gap}`} strokeDashoffset={-offset} />;
        })}
      </svg>
      <div className="space-y-1.5 flex-1">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-[10px] text-slate-600 capitalize">{d.label}</span>
            </div>
            <span className="text-[11px] font-bold text-slate-800">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Sub-views ────────────────────────────────────────────────────────────────

// Dashboard View
const SupportDashboard = ({ onNavigate }: { onNavigate: (view: string) => void }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supportApi.getDashboard()
      .then((r: any) => setData(r.data || r))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats || {};
  const charts = data?.charts || {};
  const recent = data?.recentActivity || [];

  const priorityColors = {
    critical: "#ef4444", high: "#f97316", medium: "#6366f1", low: "#10b981",
  };

  const statusColors: Record<string, string> = {
    open: "#f59e0b", assigned: "#3b82f6", in_progress: "#8b5cf6",
    waiting_customer: "#a855f7", resolved: "#10b981", closed: "#94a3b8",
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
        {[
          { label: "Total Tickets", value: stats.totalTickets ?? (loading ? null : 0), icon: "confirmation_number", color: "bg-indigo-50 text-indigo-600" },
          { label: "Open", value: stats.openTickets ?? (loading ? null : 0), icon: "radio_button_unchecked", color: "bg-amber-50 text-amber-600" },
          { label: "In Progress", value: stats.inProgressTickets ?? (loading ? null : 0), icon: "autorenew", color: "bg-blue-50 text-blue-600" },
          { label: "Resolved Today", value: stats.resolvedToday ?? (loading ? null : 0), icon: "check_circle", color: "bg-emerald-50 text-emerald-600" },
        ].map((c, i) => (
          <div key={i} className={`bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow ${loading ? "animate-pulse" : ""}`}>
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${c.color}`}>
              <span className="material-symbols-outlined text-[18px]">{c.icon}</span>
            </div>
            <div className="text-2xl font-bold text-slate-900">{loading ? <span className="block w-12 h-7 bg-slate-100 rounded" /> : c.value}</div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* KPI Cards Row 2 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "Critical", value: stats.criticalTickets ?? (loading ? null : 0), icon: "priority_high", color: "bg-red-50 text-red-600" },
          { label: "Overdue", value: stats.overdueTickets ?? (loading ? null : 0), icon: "warning", color: "bg-orange-50 text-orange-600" },
          { label: "Avg Response", value: stats.avgFirstResponseHours ? `${stats.avgFirstResponseHours}h` : "—", icon: "timer", color: "bg-violet-50 text-violet-600" },
          { label: "Avg Resolution", value: stats.avgResolutionHours ? `${stats.avgResolutionHours}h` : "—", icon: "timelapse", color: "bg-sky-50 text-sky-600" },
          { label: "Satisfaction", value: stats.satisfactionScore ? `${stats.satisfactionScore}/5 ⭐` : "—", icon: "star", color: "bg-yellow-50 text-yellow-600" },
        ].map((c, i) => (
          <div key={i} className={`bg-white border border-slate-200 rounded-xl p-4 shadow-sm ${loading ? "animate-pulse" : ""}`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${c.color}`}>
              <span className="material-symbols-outlined text-[16px]">{c.icon}</span>
            </div>
            <div className="text-xl font-bold text-slate-900">{loading ? <span className="block w-10 h-6 bg-slate-100 rounded" /> : c.value}</div>
            <div className="text-[10px] text-slate-500 font-medium">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily Trend */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Ticket Trend (Last 7 Days)</h3>
            <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">Daily</span>
          </div>
          {loading ? (
            <div className="h-20 bg-slate-50 rounded animate-pulse" />
          ) : (
            <>
              <MiniBarChart data={(charts.dailyTrend || []).slice(-7).map((d: any) => d.count)} color="#6366f1" />
              <div className="flex justify-between mt-2">
                {(charts.dailyTrend || []).slice(-7).map((d: any, i: number) => (
                  <span key={i} className="text-[9px] text-slate-400">{format(new Date(d.date), "MM/dd")}</span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* By Priority Donut */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">By Priority</h3>
          {loading ? (
            <div className="h-24 bg-slate-50 rounded animate-pulse" />
          ) : (
            <DonutChart data={(charts.byPriority || []).map((d: any) => ({
              label: d.label,
              value: d.value,
              color: priorityColors[d.label as keyof typeof priorityColors] || "#94a3b8",
            }))} />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Status */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">By Status</h3>
          {loading ? (
            <div className="h-24 bg-slate-50 rounded animate-pulse" />
          ) : (
            <DonutChart data={(charts.byStatus || []).map((d: any) => ({
              label: d.label,
              value: d.value,
              color: statusColors[d.label] || "#94a3b8",
            }))} />
          )}
        </div>

        {/* By Category - Bar */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Top Categories (30 Days)</h3>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-5 bg-slate-50 rounded animate-pulse" />)}</div>
          ) : (
            <div className="space-y-2">
              {(charts.byCategory || []).slice(0, 6).map((c: any, i: number) => {
                const max = Math.max(...(charts.byCategory || []).map((x: any) => x.value), 1);
                const pct = (c.value / max) * 100;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-600 w-28 truncate">{c.label}</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
                      <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-700 w-6 text-right">{c.value}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800">Recent Tickets</h3>
          <button onClick={() => onNavigate("support_all")} className="text-[11px] text-indigo-600 hover:underline font-medium">View all →</button>
        </div>
        <div className="divide-y divide-slate-50">
          {loading ? Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3 animate-pulse">
              <div className="w-24 h-3 bg-slate-100 rounded" />
              <div className="flex-1 h-3 bg-slate-100 rounded" />
              <div className="w-16 h-3 bg-slate-100 rounded" />
            </div>
          )) : recent.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">No recent activity</div>
          ) : recent.map((t: any) => (
            <div key={t.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors group">
              <span className="font-mono text-[10px] text-indigo-600 font-bold w-20 flex-shrink-0">{t.ticketNumber}</span>
              <span className="flex-1 text-xs text-slate-700 font-medium truncate">{t.subject}</span>
              <PriorityBadge priority={t.priority} />
              <StatusBadge status={t.status} />
              <span className="text-[10px] text-slate-400 w-20 text-right flex-shrink-0">
                {formatDistanceToNow(parseISTDate(t.createdAt), { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── All Tickets Table View ───────────────────────────────────────────────────
const TicketTable = ({
  filter,
  onSelectTicket,
  user,
}: {
  filter?: Record<string, any>;
  onSelectTicket: (ticket: Ticket) => void;
  user: any;
}) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(filter?.status || "all");
  const [priorityFilter, setPriorityFilter] = useState(filter?.priority || "all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    setStatusFilter(filter?.status || "all");
    setPriorityFilter(filter?.priority || "all");
    setPage(1);
  }, [filter?.status, filter?.priority, filter?.assignedToId]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    subject: "", description: "", category: "Loan Application", priority: "medium",
    loanApplicationNum: "", studentName: "", universityName: "", loanStage: "",
  });
  const [createLoading, setCreateLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 25, sortBy, sortOrder };
      if (search) params.search = search;
      if (statusFilter !== "all") params.status = statusFilter;
      if (priorityFilter !== "all") params.priority = priorityFilter;
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (filter?.assignedToId) params.assignedToId = filter.assignedToId;

      const res: any = await supportApi.getTickets(params);
      const d = res.data || res;
      setTickets(Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []);
      setTotalPages(d.totalPages || 1);
      setTotal(d.total || 0);
    } catch (e) {
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, priorityFilter, categoryFilter, filter, sortBy, sortOrder]);

  useEffect(() => { load(); }, [load]);

  // Debounce search
  const searchRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setPage(1), 400);
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortOrder(o => o === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortOrder("desc"); }
    setPage(1);
  };

  const handleBulkStatusChange = async () => {
    if (!bulkStatus || selected.length === 0) return;
    setBulkLoading(true);
    try {
      await Promise.all(selected.map(id => supportApi.updateStatus(id, bulkStatus)));
      setSelected([]);
      setBulkStatus("");
      load();
    } catch { } finally { setBulkLoading(false); }
  };

  const [createProofFile, setCreateProofFile] = useState<File | null>(null);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.subject || !createForm.description) return;
    setCreateLoading(true);
    try {
      const res: any = await supportApi.createTicket(createForm);
      const newTicket = res.data || res;
      if (createProofFile && newTicket?.id) {
        try {
          await supportApi.uploadAttachment(newTicket.id, createProofFile);
        } catch (uploadErr: any) {
          console.error("Proof image upload warning:", uploadErr);
        }
      }
      setShowCreateModal(false);
      setCreateProofFile(null);
      setCreateForm({ subject: "", description: "", category: "Loan Application", priority: "medium", loanApplicationNum: "", studentName: "", universityName: "", loanStage: "" });
      load();
    } catch (e: any) {
      alert("Failed to create ticket: " + (e.message || "Unknown error"));
    } finally { setCreateLoading(false); }
  };

  const SortIcon = ({ col }: { col: string }) => (
    <span className="material-symbols-outlined text-[12px] ml-0.5 opacity-50">
      {sortBy === col ? (sortOrder === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
    </span>
  );

  const exportCSV = () => {
    const headers = ["Ticket ID", "Subject", "Category", "Priority", "Status", "Raised By", "Role", "Assigned To", "Created"];
    const rows = tickets.map(t => [
      t.ticketNumber, t.subject, t.category, t.priority, t.status,
      t.createdByName, t.createdByRole, t.assignedToName || "", t.createdAt
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "support-tickets.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-52">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[16px]">search</span>
          <input
            type="text" value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by ID, subject, user, email..."
            className="pl-8 pr-3 py-1.5 text-[12px] border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white"
          />
        </div>

        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="all">All Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>

        <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
          className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="all">All Priority</option>
          {Object.keys(PRIORITY_CONFIG).map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>

        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
          className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
          <option value="all">All Categories</option>
          {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          {selected.length > 0 && (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5">
              <span className="text-[11px] text-indigo-700 font-medium">{selected.length} selected</span>
              <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
                className="text-[11px] border border-indigo-200 rounded px-2 py-0.5 bg-white">
                <option value="">Change status...</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button onClick={handleBulkStatusChange} disabled={!bulkStatus || bulkLoading}
                className="text-[11px] bg-indigo-600 text-white px-2.5 py-0.5 rounded font-medium hover:bg-indigo-700 disabled:opacity-50">
                Apply
              </button>
            </div>
          )}
          <button onClick={exportCSV} className="flex items-center gap-1.5 text-[11px] text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 bg-white hover:bg-slate-50">
            <span className="material-symbols-outlined text-[14px]">download</span> CSV
          </button>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 text-[11px] bg-indigo-600 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-indigo-700 transition-colors">
            <span className="material-symbols-outlined text-[14px]">add</span> New Ticket
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" className="rounded"
                    checked={selected.length === tickets.length && tickets.length > 0}
                    onChange={e => setSelected(e.target.checked ? tickets.map(t => t.id) : [])} />
                </th>
                {[
                  { label: "Ticket ID", col: "ticketNumber" }, { label: "Subject", col: "subject" },
                  { label: "Category", col: "category" }, { label: "Priority", col: "priority" },
                  { label: "Status", col: "status" }, { label: "Raised By", col: "createdByName" },
                  { label: "Assigned To", col: "assignedToName" }, { label: "SLA", col: "slaResolveAt" },
                  { label: "Created", col: "createdAt" },
                ].map(({ label, col }) => (
                  <th key={col} className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px] cursor-pointer hover:text-slate-700 whitespace-nowrap"
                    onClick={() => toggleSort(col)}>
                    {label}<SortIcon col={col} />
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />) :
                tickets.length === 0 ? (
                  <tr><td colSpan={11}>
                    <EmptyState icon="confirmation_number" title="No tickets found" desc="Adjust your filters or create a new ticket" />
                  </td></tr>
                ) : tickets.map(ticket => (
                  <tr key={ticket.id} className={`hover:bg-indigo-50/30 transition-colors cursor-pointer ${ticket.slaBreached && !["resolved", "closed"].includes(ticket.status) ? "bg-red-50/30" : ""}`}
                    onClick={() => onSelectTicket(ticket)}>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="rounded" checked={selected.includes(ticket.id)}
                        onChange={e => setSelected(p => e.target.checked ? [...p, ticket.id] : p.filter(x => x !== ticket.id))} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-indigo-600 font-bold text-[11px]">{ticket.ticketNumber}</span>
                    </td>
                    <td className="px-4 py-3 max-w-56">
                      <div className="font-medium text-slate-800 truncate">{ticket.subject}</div>
                      <div className="text-[9.5px] text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span>💬 {ticket.comments?.length || ticket._count?.comments || 0}</span>
                        {((ticket.attachments && ticket.attachments.length > 0) || (ticket._count?.attachments ?? 0) > 0) && (() => {
                          const firstImg = (ticket.attachments || []).find((a: any) => isImageAttachment(a));
                          const imgUrl = firstImg ? getAttachmentUrl(firstImg) : null;
                          return (
                            <div className="flex items-center gap-1.5">
                              {imgUrl ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 text-[10px]">
                                  <img src={imgUrl} alt="Issue proof thumbnail" className="w-4 h-4 object-cover rounded" />
                                  1 Image
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-bold border border-indigo-100">
                                  📎 {ticket.attachments?.length || ticket._count?.attachments} File{(ticket.attachments?.length || ticket._count?.attachments || 1) > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-[10px] text-slate-600 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">{ticket.category}</span>
                    </td>
                    <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
                    <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-700">{ticket.createdByName}</div>
                      <div className="text-[9px] text-slate-400 capitalize">{ticket.createdByRole}</div>
                    </td>
                    <td className="px-4 py-3">
                      {ticket.assignedToName ? (
                        <div>
                          <div className="font-medium text-slate-700 text-[11px]">{ticket.assignedToName}</div>
                          {ticket.teamName && <div className="text-[9px] text-slate-400">{ticket.teamName}</div>}
                        </div>
                      ) : <span className="text-slate-300 text-[10px]">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3">
                      <SLATimer slaResolveAt={ticket.slaResolveAt} status={ticket.status} />
                      {ticket.slaBreached && !["resolved", "closed"].includes(ticket.status) && (
                        <div className="text-[9px] text-red-500 font-semibold mt-0.5">⚠ BREACHED</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-[10px] text-slate-400">
                      {formatDistanceToNow(parseISTDate(ticket.createdAt), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <button onClick={() => onSelectTicket(ticket)}
                        className="p-1 text-indigo-500 hover:bg-indigo-50 rounded transition-colors">
                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
            <span className="text-[10px] text-slate-500">{total} total tickets · Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-2.5 py-1 text-[11px] border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40">← Prev</button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`px-2.5 py-1 text-[11px] border rounded ${page === p ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 bg-white hover:bg-slate-50"}`}>{p}</button>
              ))}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-2.5 py-1 text-[11px] border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Create Support Ticket</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Subject *</label>
                <input required value={createForm.subject}
                  onChange={e => setCreateForm(p => ({ ...p, subject: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Brief description of the issue" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Description *</label>
                <textarea required value={createForm.description}
                  onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                  rows={4} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  placeholder="Detailed description of the issue..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Category</label>
                  <select value={createForm.category} onChange={e => setCreateForm(p => ({ ...p, category: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                    {DEFAULT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">Priority</label>
                  <select value={createForm.priority} onChange={e => setCreateForm(p => ({ ...p, priority: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Related Loan Context (Optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Loan Application #</label>
                    <input value={createForm.loanApplicationNum}
                      onChange={e => setCreateForm(p => ({ ...p, loanApplicationNum: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="APP-00001" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Student Name</label>
                    <input value={createForm.studentName}
                      onChange={e => setCreateForm(p => ({ ...p, studentName: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">University</label>
                    <input value={createForm.universityName}
                      onChange={e => setCreateForm(p => ({ ...p, universityName: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      placeholder="MIT, Stanford, etc." />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">Loan Stage</label>
                    <select value={createForm.loanStage}
                      onChange={e => setCreateForm(p => ({ ...p, loanStage: e.target.value }))}
                      className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                      <option value="">Select stage...</option>
                      <option value="Documents">Documents</option>
                      <option value="Verification">Verification</option>
                      <option value="Sanction">Sanction</option>
                      <option value="Disbursement">Disbursement</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  Proof Screenshot / Attachment (Optional, Uploads to S3)
                </label>
                <div className="border border-dashed border-indigo-200 hover:border-indigo-500 rounded-xl p-3 bg-indigo-50/30 transition-colors relative">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        setCreateProofFile(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {createProofFile ? (
                    <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-indigo-200 text-xs text-indigo-700 font-bold z-20 relative">
                      <span className="truncate flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">photo_library</span>
                        {createProofFile.name}
                      </span>
                      <button type="button" onClick={() => setCreateProofFile(null)} className="text-rose-500 hover:text-rose-700 p-0.5 border-0 bg-transparent cursor-pointer z-30">
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-600">
                      <span className="material-symbols-outlined text-base">cloud_upload</span>
                      <span>Click to attach issue proof image or screenshot</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={createLoading}
                  className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2">
                  {createLoading ? <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Creating...</> : "Create Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Ticket Detail View ───────────────────────────────────────────────────────
const TicketDetail = ({ ticket: initialTicket, onBack, user }: { ticket: Ticket; onBack: () => void; user: any }) => {
  const [ticket, setTicket] = useState<any>(initialTicket);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const [commentType, setCommentType] = useState<"public" | "internal">("public");
  const [commentLoading, setCommentLoading] = useState(false);
  const [assignName, setAssignName] = useState(ticket.assignedToName || "");
  const [assignTeam, setAssignTeam] = useState(ticket.teamName || "");
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const isAdmin = ["admin", "super_admin", "staff", "it", "support"].includes(user?.role || "");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingFile(true);
      try {
        await supportApi.uploadAttachment(ticket.id, file);
        await refreshTicket();
      } catch (err: any) {
        alert("Failed to upload image: " + (err?.message || "Error"));
      } finally {
        setUploadingFile(false);
      }
    }
  };

  const refreshTicket = async () => {
    setLoading(true);
    try {
      const res: any = await supportApi.getTicket(ticket.id);
      setTicket(res.data || res);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { refreshTicket(); }, [ticket.id]);

  const handleStatusChange = async (status: string) => {
    setActionLoading(true);
    try {
      await supportApi.updateStatus(ticket.id, status);
      await refreshTicket();
    } catch (e: any) { alert(e.message || "Failed"); } finally { setActionLoading(false); }
  };

  const handlePriorityChange = async (priority: string) => {
    setActionLoading(true);
    try {
      await supportApi.updatePriority(ticket.id, priority);
      await refreshTicket();
    } catch (e: any) { alert(e.message || "Failed"); } finally { setActionLoading(false); }
  };

  const handleAssign = async () => {
    setActionLoading(true);
    try {
      await supportApi.assignTicket(ticket.id, {
        assignedToName: assignName || null,
        teamName: assignTeam || null,
      });
      await refreshTicket();
    } catch (e: any) { alert(e.message || "Failed"); } finally { setActionLoading(false); }
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    setCommentLoading(true);
    try {
      if (commentType === "internal" && isAdmin) {
        await supportApi.addInternalNote(ticket.id, comment);
      } else {
        await supportApi.addComment(ticket.id, comment);
      }
      setComment("");
      await refreshTicket();
    } catch (err: any) {
      console.error("Failed to post note/reply:", err);
      alert(err?.message || "Failed to post comment");
    } finally { setCommentLoading(false); }
  };

  const STATUS_TRANSITIONS: Record<string, string[]> = {
    open: ["assigned", "in_progress", "resolved", "out_of_scope", "closed"],
    assigned: ["in_progress", "waiting_customer", "out_of_scope", "resolved", "closed"],
    in_progress: ["waiting_customer", "out_of_scope", "resolved", "closed"],
    waiting_customer: ["in_progress", "out_of_scope", "resolved", "closed"],
    resolved: ["closed", "open"],
    out_of_scope: ["open", "in_progress", "closed"],
    closed: ["open"],
  };
  const nextStatuses = STATUS_TRANSITIONS[ticket.status] || [];

  const slaRemaining = ticket.slaResolveAt ? (() => {
    const diff = new Date(ticket.slaResolveAt).getTime() - Date.now();
    if (diff < 0) return { text: "BREACHED", breached: true };
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return { text: `${h}h ${m}m remaining`, breached: false };
  })() : null;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-indigo-600 font-bold text-sm">{ticket.ticketNumber}</span>
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
            {ticket.slaBreached && <span className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">SLA BREACHED</span>}
          </div>
          <h2 className="text-base font-semibold text-slate-900 mt-0.5 truncate">{ticket.subject}</h2>
        </div>
      </div>

      {/* Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT — Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Description */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Description</h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Uploaded Problem Proof & Images */}
          {(() => {
            const hasAttachments = (ticket.attachments && ticket.attachments.length > 0) || (ticket as any).attachmentUrl;
            const creatorName = ticket.createdByName || ticket.studentName || "Ticket Creator";
            const creatorRole = (ticket.createdByRole || ticket.userRole || "User").toUpperCase();
            const itemsToRender = ticket.attachments && ticket.attachments.length > 0
              ? ticket.attachments
              : (ticket as any).attachmentUrl
                ? [{ fileName: `Issue_Proof_${ticket.ticketNumber || 'Screenshot'}.png`, filePath: (ticket as any).attachmentUrl }]
                : [];

            return (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 font-sans">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-indigo-600">image</span>
                      Uploaded Problem Proof & Images ({itemsToRender.length})
                    </h3>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      Raised by: <span className="text-indigo-600 font-bold">{creatorName}</span> ({creatorRole})
                    </p>
                  </div>

                  <label className="cursor-pointer text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 shadow-xs shrink-0">
                    {uploadingFile ? (
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-[15px]">add_a_photo</span>
                    )}
                    {uploadingFile ? "Uploading..." : "+ Upload Proof Image"}
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                    />
                  </label>
                </div>

                {hasAttachments ? (
                  <div className="space-y-4">
                    {itemsToRender.map((att: any, idx: number) => {
                      const url = getAttachmentUrl(att);
                      const isImage = isImageAttachment(att);
                      const isPdf = (att.mimeType || att.fileName || att.filePath || "").match(/\.pdf$/i);

                      if (isImage) {
                        return (
                          <div key={att.id || idx} className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 hover:border-indigo-200 transition-all">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="material-symbols-outlined text-indigo-600 text-sm">photo_library</span>
                                <span className="text-xs font-bold text-slate-800 truncate">
                                  {att.fileName || att.name || `Issue Screenshot Proof`}
                                </span>
                                <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-extrabold text-[9px] uppercase tracking-wide">
                                  {creatorRole} PROOF
                                </span>
                              </div>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-indigo-600 font-bold hover:underline inline-flex items-center gap-1 shrink-0"
                              >
                                View Full Image <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                              </a>
                            </div>

                            {/* Real Uploaded Image Container */}
                            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-950 group max-h-[450px] flex items-center justify-center p-2">
                              <img
                                src={url}
                                alt={att.fileName || "Uploaded issue screenshot"}
                                className="max-h-[420px] w-auto object-contain rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-[1.01]"
                              />
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1.5 backdrop-blur-[2px]"
                              >
                                <span className="material-symbols-outlined text-xl">zoom_in</span>
                                Click to Expand / Open Full Resolution Proof
                              </a>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <a
                          key={att.id || idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3.5 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded-xl transition-all group"
                        >
                          <div className="w-10 h-10 rounded-lg bg-indigo-100/70 border border-indigo-200/60 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform shrink-0">
                            <span className="material-symbols-outlined text-[22px]">
                              {isPdf ? "picture_as_pdf" : "description"}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 truncate transition-colors">
                              {att.fileName || att.name || "Uploaded Attachment"}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                              Uploaded by {creatorName} • Open File ↗
                            </p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                ) : (
                  <label className="block cursor-pointer p-6 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 border-dashed rounded-2xl text-center space-y-2 transition-all">
                    <span className="material-symbols-outlined text-indigo-500 text-3xl">add_photo_alternate</span>
                    <p className="text-xs font-bold text-slate-800">No proof screenshot uploaded with ticket submission</p>
                    <p className="text-[11px] text-indigo-600 font-semibold">Click here or the button above to upload the real issue image or screenshot proof directly to this ticket (Uploads to S3).</p>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={uploadingFile}
                    />
                  </label>
                )}
              </div>
            );
          })()}

          {/* Related Loan Context */}
          {(ticket.loanApplicationNum || ticket.studentName || ticket.universityName || ticket.loanStage) && (
            <div className="bg-indigo-50/80 border border-indigo-100 rounded-xl p-5 space-y-3 font-sans">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">account_balance</span>
                  Related Loan Context
                </h3>
                <span className="text-[10px] font-mono font-bold text-indigo-500 bg-white px-2 py-0.5 rounded border border-indigo-100">
                  Category: {ticket.category || "General"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Application #", value: ticket.loanApplicationNum },
                  { label: "Student", value: ticket.studentName },
                  { label: "University", value: ticket.universityName },
                  { label: "Loan Stage", value: ticket.loanStage },
                ].filter(r => r.value).map(r => (
                  <div key={r.label}>
                    <div className="text-[10px] text-indigo-400 font-semibold uppercase tracking-wide">{r.label}</div>
                    <div className="text-xs text-indigo-900 font-bold mt-0.5">{r.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conversation */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Conversation ({(ticket.comments || []).length})
              </h3>
            </div>
            <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin mx-auto" />
                </div>
              ) : (ticket.comments || []).length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">No comments yet. Be the first to reply.</div>
              ) : (ticket.comments || []).map((c: Comment) => (
                <div key={c.id} className={`px-5 py-4 ${c.isInternal ? "bg-amber-50 border-l-2 border-amber-300" : ""}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-[11px] font-bold text-indigo-600">{c.authorName.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-800">{c.authorName}</span>
                        <span className="text-[9px] text-slate-400 capitalize">{c.authorRole}</span>
                        {c.isInternal && (
                          <span className="text-[9px] font-semibold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-full">Internal Note</span>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-400">{formatIST(c.createdAt, "full")}</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed pl-9 whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}
            </div>

            {/* Reply Box */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              {isAdmin && (
                <div className="flex gap-2 mb-2">
                  {(["public", "internal"] as const).map(t => (
                    <button key={t} onClick={() => setCommentType(t)}
                      className={`text-[10px] px-2.5 py-1 rounded-full font-semibold border transition-colors ${commentType === t ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}>
                      {t === "public" ? "💬 Public Reply" : "🔒 Internal Note"}
                    </button>
                  ))}
                </div>
              )}
              <textarea
                value={comment} onChange={e => setComment(e.target.value)}
                rows={3} placeholder={commentType === "internal" ? "Write an internal note (only visible to admin team)..." : "Write a public reply..."}
                className={`w-full px-3 py-2 text-xs border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 ${commentType === "internal" ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}
              />
              <div className="flex justify-end mt-2">
                <button onClick={handleAddComment} disabled={!comment.trim() || commentLoading}
                  className="flex items-center gap-1.5 text-[11px] bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {commentLoading ? <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[14px]">send</span>}
                  {commentType === "internal" ? "Save Note" : "Send Reply"}
                </button>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Activity Log</h3>
            </div>
            <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
              {(ticket.activityLogs || []).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No activity yet</p>
              ) : (ticket.activityLogs || []).map((log: ActivityLog) => (
                <div key={log.id} className="flex items-start gap-2.5 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-300 mt-1.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-slate-700">{log.actorName}</span>
                    <span className="text-slate-500"> {log.action.replace(/_/g, " ")}</span>
                    {log.oldValue && log.newValue && (
                      <span className="text-slate-400"> · <span className="line-through">{log.oldValue}</span> → <span className="font-medium text-slate-700">{log.newValue}</span></span>
                    )}
                    <div className="text-[9px] text-slate-400 mt-0.5">{formatIST(log.createdAt, "short")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — Actions Panel */}
        <div className="space-y-4">
          {/* SLA Timer Card */}
          <div className={`border rounded-xl p-4 shadow-sm ${slaRemaining?.breached ? "bg-red-50 border-red-200" : "bg-white border-slate-200"}`}>
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">timer</span>SLA Timer
            </h3>
            <div className={`text-xl font-bold mb-1 ${slaRemaining?.breached ? "text-red-600" : "text-emerald-700"}`}>
              {slaRemaining ? slaRemaining.text : ["resolved", "closed"].includes(ticket.status) ? "Completed" : "—"}
            </div>
            {ticket.slaResolveAt && (
              <div className="text-[10px] text-slate-400">
                Deadline: {formatIST(ticket.slaResolveAt, "full")}
              </div>
            )}
            {ticket.firstResponseAt && (
              <div className="text-[10px] text-emerald-600 mt-1">
                ✓ First response: {formatIST(ticket.firstResponseAt, "time")}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          {isAdmin && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</h3>
              <div className="space-y-2">
                {nextStatuses.map(s => {
                  const cfg = STATUS_CONFIG[s];
                  return (
                    <button key={s} onClick={() => handleStatusChange(s)} disabled={actionLoading}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-medium border border-slate-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors text-slate-700 disabled:opacity-50">
                      <span className="material-symbols-outlined text-[14px]">{cfg?.icon || "radio_button_unchecked"}</span>
                      Move to {cfg?.label || s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Priority Change */}
          {isAdmin && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Priority</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                  <button key={key} onClick={() => handlePriorityChange(key)} disabled={actionLoading || ticket.priority === key}
                    className={`px-2 py-1.5 text-[10px] font-semibold rounded-lg border transition-all ${ticket.priority === key ? `${cfg.color} shadow-sm` : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"} disabled:opacity-60`}>
                    {cfg.icon} {cfg.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Assignment */}
          {isAdmin && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">Assignment</h3>
              <div className="space-y-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Engineer Name</label>
                  <input value={assignName} onChange={e => setAssignName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="John Smith" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">Team</label>
                  <select value={assignTeam} onChange={e => setAssignTeam(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                    <option value="">Select team...</option>
                    {["IT Team", "Finance Team", "OCR Team", "Integration Team", "Loan Processing Team", "Document Team"].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <button onClick={handleAssign} disabled={actionLoading}
                  className="w-full py-1.5 text-[11px] font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                  {actionLoading ? "Saving..." : "Save Assignment"}
                </button>
              </div>
            </div>
          )}

          {/* Ticket Info */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Ticket Info</h3>
            {[
              { label: "Created By", value: ticket.createdByName },
              { label: "Email", value: ticket.createdByEmail },
              { label: "Role", value: ticket.createdByRole },
              { label: "Category", value: ticket.category },
              { label: "Source", value: ticket.source },
              { label: "Created", value: formatIST(ticket.createdAt, "full") },
              { label: "Updated", value: formatDistanceToNow(parseISTDate(ticket.updatedAt), { addSuffix: true }) },
            ].map(r => (
              <div key={r.label} className="flex items-start justify-between gap-2">
                <span className="text-[10px] text-slate-400">{r.label}</span>
                <span className="text-[11px] font-medium text-slate-700 text-right capitalize max-w-36 truncate">{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── SLA Monitor View ─────────────────────────────────────────────────────────
const SLAMonitor = ({ onSelectTicket }: { onSelectTicket: (t: Ticket) => void }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supportApi.getTickets({ limit: 100, status: "all" })
      .then((r: any) => {
        const d = r.data || r;
        setTickets(Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : []);
      })
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  const categorized = {
    breached: tickets.filter(t => !["resolved", "closed"].includes(t.status) && t.slaResolveAt && new Date(t.slaResolveAt) < new Date()),
    critical: tickets.filter(t => !["resolved", "closed"].includes(t.status) && t.priority === "critical" && !t.slaBreached),
    warning: tickets.filter(t => {
      if (["resolved", "closed"].includes(t.status) || !t.slaResolveAt) return false;
      const remain = new Date(t.slaResolveAt).getTime() - Date.now();
      return remain > 0 && remain < 2 * 60 * 60 * 1000 && t.priority !== "critical";
    }),
    ok: tickets.filter(t => {
      if (["resolved", "closed"].includes(t.status) || !t.slaResolveAt) return false;
      const remain = new Date(t.slaResolveAt).getTime() - Date.now();
      return remain > 2 * 60 * 60 * 1000;
    }),
  };

  const SLARow = ({ t }: { t: Ticket }) => {
    const deadline = t.slaResolveAt ? new Date(t.slaResolveAt) : null;
    const remaining = deadline ? deadline.getTime() - Date.now() : null;
    const isCompleted = ["resolved", "closed"].includes(t.status);
    const breached = !isCompleted && remaining !== null && remaining < 0;
    return (
      <tr className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${breached ? "bg-red-50/50" : ""}`}
        onClick={() => onSelectTicket(t)}>
        <td className="px-4 py-3"><span className="font-mono text-indigo-600 font-bold text-[11px]">{t.ticketNumber}</span></td>
        <td className="px-4 py-3 max-w-48"><span className="text-xs text-slate-700 truncate block">{t.subject}</span></td>
        <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
        <td className="px-4 py-3"><span className="text-xs text-slate-600">{t.createdByName}</span></td>
        <td className="px-4 py-3">
          {deadline ? (
            <div>
              <div className={`text-[11px] font-bold ${isCompleted ? "text-slate-500" : breached ? "text-red-600" : remaining! < 3600000 ? "text-orange-600" : "text-emerald-700"}`}>
                {isCompleted ? "COMPLETED" : breached ? "⚠ BREACHED" : `${Math.floor(remaining! / 3600000)}h ${Math.floor((remaining! % 3600000) / 60000)}m`}
              </div>
              <div className="text-[9px] text-slate-400">{format(deadline, "MMM d, h:mm a")}</div>
            </div>
          ) : <span className="text-slate-300 text-xs">No SLA</span>}
        </td>
        <td className="px-4 py-3">{t.assignedToName || <span className="text-slate-300 text-xs">Unassigned</span>}</td>
      </tr>
    );
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* SLA Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "SLA Breached", count: categorized.breached.length, color: "bg-red-50 border-red-200 text-red-600" },
          { label: "Critical Active", count: categorized.critical.length, color: "bg-orange-50 border-orange-200 text-orange-600" },
          { label: "Warning (<2h)", count: categorized.warning.length, color: "bg-yellow-50 border-yellow-200 text-yellow-700" },
          { label: "On Track", count: categorized.ok.length, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-4 ${s.color}`}>
            <div className="text-2xl font-bold">{s.count}</div>
            <div className="text-[11px] font-medium mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* SLA Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Open Tickets — SLA Status</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Ticket", "Subject", "Priority", "Raised By", "SLA Remaining", "Assigned To"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...categorized.breached, ...categorized.critical, ...categorized.warning, ...categorized.ok].map(t => (
                <SLARow key={t.id} t={t} />
              ))}
              {tickets.length === 0 && (
                <tr><td colSpan={6}><EmptyState icon="verified" title="All SLAs on track!" desc="No open tickets with SLA concerns" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Analytics View ───────────────────────────────────────────────────────────
const AnalyticsView = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    supportApi.getAnalytics({ days })
      .then((r: any) => setData(r.data || r))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  const priorityColors = { critical: "#ef4444", high: "#f97316", medium: "#6366f1", low: "#10b981" };
  const statusColors: Record<string, string> = { open: "#f59e0b", assigned: "#3b82f6", in_progress: "#8b5cf6", waiting_customer: "#a855f7", resolved: "#10b981", closed: "#94a3b8" };
  const roleColors: Record<string, string> = { user: "#6366f1", staff: "#8b5cf6", agent: "#f59e0b", bank: "#10b981", admin: "#ef4444" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Support Analytics</h2>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none">
          <option value={7}>Last 7 Days</option>
          <option value={30}>Last 30 Days</option>
          <option value={90}>Last 90 Days</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-48 bg-slate-50 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[
            { title: "Tickets by Category", data: data?.byCategory, colors: null },
            { title: "Tickets by Priority", data: data?.byPriority, colors: priorityColors },
            { title: "Tickets by Status", data: data?.byStatus, colors: statusColors },
            { title: "Tickets by User Role", data: data?.byRole, colors: roleColors },
          ].map(({ title, data: chartData, colors }) => (
            <div key={title} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">{title}</h3>
              {chartData && chartData.length > 0 ? (
                <DonutChart data={chartData.map((d: any, i: number) => ({
                  label: d.label,
                  value: d.value,
                  color: (colors as any)?.[d.label] || ["#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e", "#f97316"][i % 6],
                }))} />
              ) : (
                <p className="text-xs text-slate-400 text-center py-6">No data for this period</p>
              )}
            </div>
          ))}

          {/* Trend Chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm lg:col-span-2">
            <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-4">Daily Ticket Volume</h3>
            {data?.dailyTrend?.length > 0 ? (
              <>
                <MiniBarChart data={data.dailyTrend.map((d: any) => d.count)} color="#6366f1" />
                <div className="flex justify-between mt-2">
                  {data.dailyTrend.filter((_: any, i: number) => i % Math.ceil(data.dailyTrend.length / 10) === 0).map((d: any, i: number) => (
                    <span key={i} className="text-[9px] text-slate-400">{format(new Date(d.date), "MM/dd")}</span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400 text-center py-6">No trend data available</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Settings View ────────────────────────────────────────────────────────────
const SettingsView = () => {
  const [slaConfig, setSlaConfig] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    supportApi.getSLA()
      .then((r: any) => setSlaConfig(Array.isArray(r.data) ? r.data : Array.isArray(r) ? r : []))
      .catch(() => setSlaConfig([
        { priority: "critical", responseMinutes: 30, resolveMinutes: 240 },
        { priority: "high", responseMinutes: 120, resolveMinutes: 480 },
        { priority: "medium", responseMinutes: 240, resolveMinutes: 1440 },
        { priority: "low", responseMinutes: 1440, resolveMinutes: 4320 },
      ]))
      .finally(() => setLoading(false));
  }, []);

  const handleSLAUpdate = async (priority: string, field: string, val: number) => {
    setSlaConfig(p => p.map(s => s.priority === priority ? { ...s, [field]: val } : s));
  };

  const saveSLA = async (priority: string) => {
    setSaving(priority);
    const sla = slaConfig.find(s => s.priority === priority);
    try {
      await supportApi.updateSLA(priority, { responseMinutes: sla.responseMinutes, resolveMinutes: sla.resolveMinutes });
    } catch { } finally { setSaving(null); }
  };

  const formatMinutes = (min: number) => {
    if (min < 60) return `${min}m`;
    if (min < 1440) return `${min / 60}h`;
    return `${min / 1440}d`;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">SLA Configuration</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Configure response and resolution time targets by priority</p>
        </div>
        <div className="p-5 space-y-4">
          {loading ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-slate-50 rounded-lg animate-pulse" />) :
            slaConfig.map(sla => {
              const cfg = PRIORITY_CONFIG[sla.priority as keyof typeof PRIORITY_CONFIG];
              return (
                <div key={sla.priority} className={`border rounded-xl p-4 ${cfg?.color || "border-slate-200"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${cfg?.dot || "bg-slate-400"}`} />
                      <span className="text-sm font-semibold text-slate-800 capitalize">{sla.priority}</span>
                    </div>
                    <button onClick={() => saveSLA(sla.priority)} disabled={saving === sla.priority}
                      className="text-[10px] bg-indigo-600 text-white px-2.5 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                      {saving === sla.priority ? "Saving..." : "Save"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Response Time (current: {formatMinutes(sla.responseMinutes)})</label>
                      <div className="flex items-center gap-1.5">
                        <input type="number" value={sla.responseMinutes} min={5}
                          onChange={e => handleSLAUpdate(sla.priority, "responseMinutes", Number(e.target.value))}
                          className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        <span className="text-[10px] text-slate-400">min</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Resolution Time (current: {formatMinutes(sla.resolveMinutes)})</label>
                      <div className="flex items-center gap-1.5">
                        <input type="number" value={sla.resolveMinutes} min={30}
                          onChange={e => handleSLAUpdate(sla.priority, "resolveMinutes", Number(e.target.value))}
                          className="flex-1 px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                        <span className="text-[10px] text-slate-400">min</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Auto-Assignment Rules */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Auto-Assignment Rules</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Tickets are automatically routed to teams based on category</p>
        </div>
        <div className="p-5 space-y-2">
          {[
            ["EVV", "Finance Team"], ["OCR", "OCR Team"], ["Digilocker", "Integration Team"],
            ["Technical Issue", "IT Team"], ["API Error", "IT Team"], ["Payment", "Finance Team"],
            ["Disbursement", "Finance Team"], ["Loan Application", "Loan Processing Team"],
            ["Document Verification", "Document Team"], ["Authentication", "IT Team"],
          ].map(([cat, team]) => (
            <div key={cat} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700">{cat}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-slate-300">arrow_forward</span>
                <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">{team}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Knowledge Base View ──────────────────────────────────────────────────────
const KnowledgeBaseView = () => {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: "", category: "General", content: "", isPublished: false });

  useEffect(() => {
    supportApi.getKBArticles()
      .then((r: any) => setArticles(Array.isArray(r.data) ? r.data : Array.isArray(r) ? r : []))
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supportApi.createKBArticle(form);
      setShowCreate(false);
      setForm({ title: "", category: "General", content: "", isPublished: false });
      // Refresh
      const r: any = await supportApi.getKBArticles();
      setArticles(Array.isArray(r.data) ? r.data : []);
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Knowledge Base</h2>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-[11px] bg-indigo-600 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-indigo-700">
          <span className="material-symbols-outlined text-[14px]">add</span> New Article
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 bg-slate-50 rounded-xl animate-pulse" />)}</div>
      ) : articles.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl">
          <EmptyState icon="menu_book" title="No articles yet" desc="Create your first knowledge base article to help users" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map(a => (
            <div key={a.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">{a.category}</span>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${a.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {a.isPublished ? "Published" : "Draft"}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-800 mb-1">{a.title}</h3>
              <p className="text-[11px] text-slate-500 line-clamp-2">{a.content.substring(0, 120)}...</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] text-slate-400">By {a.authorName}</span>
                <span className="text-[10px] text-slate-400">{a.views} views</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 overflow-hidden">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">New KB Article</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-slate-400"><span className="material-symbols-outlined text-[20px]">close</span></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Article title" />
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
                {["General", ...DEFAULT_CATEGORIES].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea required value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                rows={6} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Article content (supports markdown)..." />
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isPublished} onChange={e => setForm(p => ({ ...p, isPublished: e.target.checked }))}
                  className="rounded text-indigo-600" />
                <span className="text-xs text-slate-600">Publish immediately</span>
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-sm text-slate-600">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Create Article</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Categories View ──────────────────────────────────────────────────────────
const CategoriesView = () => {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", color: "#6366f1" });

  const load = () => {
    setLoading(true);
    supportApi.getCategories()
      .then((r: any) => setCategories(Array.isArray(r.data) ? r.data : Array.isArray(r) ? r : []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supportApi.createCategory(form);
      setShowCreate(false);
      setForm({ name: "", description: "", color: "#6366f1" });
      load();
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Ticket Categories</h2>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-[11px] bg-indigo-600 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-indigo-700">
          <span className="material-symbols-outlined text-[14px]">add</span> New Category
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {["Name", "Description", "Status"].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider text-[10px]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* Default categories */}
            {DEFAULT_CATEGORIES.map(cat => (
              <tr key={cat} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                    <span className="font-medium text-slate-700">{cat}</span>
                    <span className="text-[9px] text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">Default</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">Built-in category</td>
                <td className="px-4 py-3"><span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">Active</span></td>
              </tr>
            ))}
            {/* Custom categories from DB */}
            {loading ? null : categories.map(c => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color || "#6366f1" }} />
                    <span className="font-medium text-slate-700">{c.name}</span>
                    <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">Custom</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-500">{c.description || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${c.isActive ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-slate-500 bg-slate-100 border-slate-200"}`}>
                    {c.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
            <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm">New Category</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-slate-400"><span className="material-symbols-outlined text-[18px]">close</span></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3">
              <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Category name" />
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Description (optional)" />
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600">Color:</label>
                <input type="color" value={form.color} onChange={e => setForm(p => ({ ...p, color: e.target.value }))}
                  className="w-8 h-8 rounded cursor-pointer border border-slate-200" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Teams View ───────────────────────────────────────────────────────────────
const TeamsView = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", email: "", color: "#6366f1" });

  const load = () => {
    setLoading(true);
    supportApi.getTeams()
      .then((r: any) => setTeams(Array.isArray(r.data) ? r.data : Array.isArray(r) ? r : []))
      .catch(() => setTeams([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supportApi.createTeam(form);
      setShowCreate(false);
      load();
    } catch (e: any) { alert(e.message); }
  };

  const DEFAULT_TEAMS = [
    { name: "IT Team", description: "Technical issues, API errors, authentication", color: "#6366f1" },
    { name: "Finance Team", description: "EVV, Payment, Disbursement, EMI queries", color: "#10b981" },
    { name: "OCR Team", description: "OCR document processing issues", color: "#f97316" },
    { name: "Integration Team", description: "Digilocker, third-party integrations", color: "#a855f7" },
    { name: "Loan Processing Team", description: "Loan application queries", color: "#3b82f6" },
    { name: "Document Team", description: "Document verification and review", color: "#f59e0b" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Support Teams</h2>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-[11px] bg-indigo-600 text-white rounded-lg px-3 py-1.5 font-medium hover:bg-indigo-700">
          <span className="material-symbols-outlined text-[14px]">add</span> New Team
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DEFAULT_TEAMS.map(team => (
          <div key={team.name} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: team.color + "20", border: `1px solid ${team.color}30` }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: team.color }}>groups</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">{team.name}</h3>
                  <span className="text-[9px] text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">Default</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{team.description}</p>
              </div>
              <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100">Active</span>
            </div>
          </div>
        ))}
        {!loading && teams.map(team => (
          <div key={team.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (team.color || "#6366f1") + "20" }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: team.color || "#6366f1" }}>groups</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">{team.name}</h3>
                  <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">Custom</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{team.description || "—"}</p>
                {team.email && <p className="text-[10px] text-slate-400 mt-0.5">{team.email}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
            <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 text-sm">New Team</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-slate-400"><span className="material-symbols-outlined text-[18px]">close</span></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3">
              <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Team name" />
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Description" />
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Team email (optional)" />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-slate-200 rounded-lg text-xs text-slate-600">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main SupportCenter Component ─────────────────────────────────────────────
interface SupportCenterProps {
  activeView: string;
  setActiveSection: (section: string) => void;
  user: any;
}

export default function SupportCenter({ activeView, setActiveSection, user }: SupportCenterProps) {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
  };

  const handleBack = () => {
    setSelectedTicket(null);
  };

  const handleNavigate = (view: string) => {
    setSelectedTicket(null);
    setActiveSection(view);
  };

  // If a ticket is selected, always show detail view
  if (selectedTicket) {
    return (
      <TicketDetail
        ticket={selectedTicket}
        onBack={handleBack}
        user={user}
      />
    );
  }

  // Route to correct sub-view
  switch (activeView) {
    case "support_dashboard":
      return <SupportDashboard onNavigate={handleNavigate} />;

    case "support_all":
      return <TicketTable onSelectTicket={handleSelectTicket} user={user} />;

    case "support_open":
      return <TicketTable filter={{ status: "open" }} onSelectTicket={handleSelectTicket} user={user} />;

    case "support_assigned":
      return <TicketTable filter={{ assignedToId: user?.id }} onSelectTicket={handleSelectTicket} user={user} />;

    case "support_waiting":
      return <TicketTable filter={{ status: "waiting_customer" }} onSelectTicket={handleSelectTicket} user={user} />;

    case "support_resolved":
      return <TicketTable filter={{ status: "resolved" }} onSelectTicket={handleSelectTicket} user={user} />;

    case "support_out_of_scope":
      return <TicketTable filter={{ status: "out_of_scope" }} onSelectTicket={handleSelectTicket} user={user} />;

    case "support_closed":
      return <TicketTable filter={{ status: "closed" }} onSelectTicket={handleSelectTicket} user={user} />;

    case "support_high":
      return <TicketTable filter={{ priority: "critical" }} onSelectTicket={handleSelectTicket} user={user} />;

    case "support_sla":
      return <SLAMonitor onSelectTicket={handleSelectTicket} />;

    case "support_categories":
      return <CategoriesView />;

    case "support_teams":
      return <TeamsView />;

    case "support_analytics":
      return <AnalyticsView />;

    case "support_kb":
      return <KnowledgeBaseView />;

    case "support_settings":
      return <SettingsView />;

    default:
      return <SupportDashboard onNavigate={handleNavigate} />;
  }
}
