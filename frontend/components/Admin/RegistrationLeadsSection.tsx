"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Download,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ExternalLink,
  CheckCircle2,
  Clock,
  PhoneCall,
  MessageSquare,
  AlertCircle,
  Eye,
  Trash2,
  ChevronRight,
  GraduationCap,
  Sparkles,
  ArrowUpRight,
  X,
  Copy,
  Check,
  UserCheck,
  UserPlus,
  ShieldCheck,
  CheckSquare,
  Square,
  User,
} from "lucide-react";
import { staffProfileApi, adminApi } from "@/lib/api";

export interface LeadInquiry {
  id: string;
  name: string;
  email: string;
  mobile: string;
  universityName: string;
  type: string;
  status: string;
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
  assignedStaffEmail?: string | null;
  assignedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffOption {
  id: string;
  name: string;
  email: string;
  role?: string;
}

interface ParsedLeadInfo {
  country: string;
  amount: string;
  admissionStatus: string;
  loanStatus: string;
  city: string;
  source: string;
}

export default function RegistrationLeadsSection() {
  const [leads, setLeads] = useState<LeadInquiry[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<LeadInquiry | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null);

  // Bulk selection state
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkStaffId, setBulkStaffId] = useState<string>("");
  const [bulkAssigning, setBulkAssigning] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchLeads = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/university-inquiry");
      const json = await res.json();
      if (json && json.success && Array.isArray(json.data)) {
        setLeads(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch leads:", err);
    } finally {
      setLoading(false);
      if (isManual) {
        setTimeout(() => setRefreshing(false), 400);
        showToast("Leads refreshed successfully");
      }
    }
  };

  const fetchStaffMembers = async () => {
    try {
      const res: any = await staffProfileApi.getStaffMembersList();
      const list = res?.data || res || [];
      if (Array.isArray(list) && list.length > 0) {
        setStaffMembers(list);
      } else {
        const userRes: any = await adminApi.getUsers(200, 0, "", "");
        const users = userRes?.data || [];
        const staffOnly = users
          .filter((u: any) => u.role === "staff" || u.role === "staff_admin")
          .map((u: any) => ({
            id: u.id,
            name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
            email: u.email,
          }));
        setStaffMembers(staffOnly);
      }
    } catch (err) {
      console.error("Failed to fetch staff members:", err);
    }
  };

  useEffect(() => {
    fetchLeads();
    fetchStaffMembers();
    // Auto-poll every 25 seconds for new leads
    const interval = setInterval(() => {
      fetchLeads();
    }, 25000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/university-inquiry/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json && json.success) {
        setLeads((prev) =>
          prev.map((item) => (item.id === id ? { ...item, status: newStatus } : item))
        );
        if (selectedLead && selectedLead.id === id) {
          setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : null));
        }
        showToast(`Lead status updated to ${newStatus}`);
      }
    } catch (err) {
      console.error("Failed to update lead status:", err);
      showToast("Failed to update status");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleAssignLead = async (leadId: string, staffId: string) => {
    setAssigningLeadId(leadId);
    try {
      const isUnassign = !staffId || staffId === "unassigned";
      const selectedStaff = staffMembers.find((s) => s.id === staffId);

      const payload = {
        staffId: isUnassign ? null : staffId,
        staffName: isUnassign ? null : selectedStaff?.name || null,
        staffEmail: isUnassign ? null : selectedStaff?.email || null,
      };

      const res = await fetch(`/api/university-inquiry/${leadId}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json && json.success) {
        const assignedAt = isUnassign ? null : new Date().toISOString();
        setLeads((prev) =>
          prev.map((item) =>
            item.id === leadId
              ? {
                  ...item,
                  assignedStaffId: payload.staffId,
                  assignedStaffName: payload.staffName,
                  assignedStaffEmail: payload.staffEmail,
                  assignedAt,
                }
              : item
          )
        );
        if (selectedLead && selectedLead.id === leadId) {
          setSelectedLead((prev) =>
            prev
              ? {
                  ...prev,
                  assignedStaffId: payload.staffId,
                  assignedStaffName: payload.staffName,
                  assignedStaffEmail: payload.staffEmail,
                  assignedAt,
                }
              : null
          );
        }
        showToast(
          isUnassign
            ? "Lead unassigned"
            : `Assigned to ${selectedStaff?.name || "staff"}`
        );
      } else {
        showToast("Failed to assign lead");
      }
    } catch (err) {
      console.error("Failed to assign lead:", err);
      showToast("Failed to assign lead");
    } finally {
      setAssigningLeadId(null);
    }
  };

  const handleBulkAssign = async () => {
    if (selectedLeadIds.length === 0) {
      showToast("Please select at least one lead");
      return;
    }
    if (!bulkStaffId) {
      showToast("Please choose a staff member to assign");
      return;
    }

    setBulkAssigning(true);
    try {
      const isUnassign = bulkStaffId === "unassigned";
      const selectedStaff = staffMembers.find((s) => s.id === bulkStaffId);

      const payload = {
        leadIds: selectedLeadIds,
        staffId: isUnassign ? null : bulkStaffId,
        staffName: isUnassign ? null : selectedStaff?.name || null,
        staffEmail: isUnassign ? null : selectedStaff?.email || null,
      };

      const res = await fetch("/api/university-inquiry/bulk-assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json && json.success) {
        const assignedAt = isUnassign ? null : new Date().toISOString();
        setLeads((prev) =>
          prev.map((item) =>
            selectedLeadIds.includes(item.id)
              ? {
                  ...item,
                  assignedStaffId: payload.staffId,
                  assignedStaffName: payload.staffName,
                  assignedStaffEmail: payload.staffEmail,
                  assignedAt,
                }
              : item
          )
        );
        showToast(
          isUnassign
            ? `Unassigned ${selectedLeadIds.length} leads`
            : `Assigned ${selectedLeadIds.length} leads to ${selectedStaff?.name || "staff"}`
        );
        setSelectedLeadIds([]);
        setBulkStaffId("");
      } else {
        showToast("Failed to bulk assign leads");
      }
    } catch (err) {
      console.error("Failed to bulk assign leads:", err);
      showToast("Failed to bulk assign leads");
    } finally {
      setBulkAssigning(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map((l) => l.id));
    }
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteLead = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this lead?")) return;
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/university-inquiry/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json && json.success) {
        setLeads((prev) => prev.filter((item) => item.id !== id));
        setSelectedLeadIds((prev) => prev.filter((item) => item !== id));
        if (selectedLead?.id === id) setSelectedLead(null);
        showToast("Lead removed successfully");
      }
    } catch (err) {
      console.error("Failed to delete lead:", err);
      showToast("Failed to delete lead");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Helper to parse lead info from the stored universityName string
  const parseLeadDetails = (text: string, type: string): ParsedLeadInfo => {
    const raw = text || "";
    let country = "Global / General";
    let amount = "Not Specified";
    let admissionStatus = "Planning";
    let loanStatus = "Required";
    let city = "Not Specified";
    let source = type === "registration_lead" ? "Registration Form" : "Knowledge Base / Blog";

    // Extract [amount]
    const amountMatch = raw.match(/\[(₹[^\]]+)\]/);
    if (amountMatch) amount = amountMatch[1];

    // Extract admission
    const admMatch = raw.match(/Admission:\s*([^|\]]+)/i);
    if (admMatch) admissionStatus = admMatch[1].trim();

    // Extract loan status
    const loanMatch = raw.match(/Loan(?:\s*Status)?:\s*([^|\]]+)/i);
    if (loanMatch) loanStatus = loanMatch[1].trim();

    // Extract city
    const cityMatch = raw.match(/City:\s*([^|\])]+)/i);
    if (cityMatch) city = cityMatch[1].trim();

    // Country extraction from beginning
    const firstPart = raw.split("[")[0].replace(/Country:\s*/i, "").trim();
    if (firstPart && firstPart.length > 1 && !firstPart.includes("Source:")) {
      country = firstPart;
    }

    if (raw.includes("Registration Form")) {
      source = "Registration Form";
    }

    return { country, amount, admissionStatus, loanStatus, city, source };
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        lead.name?.toLowerCase().includes(q) ||
        lead.email?.toLowerCase().includes(q) ||
        lead.mobile?.includes(q) ||
        lead.universityName?.toLowerCase().includes(q) ||
        lead.assignedStaffName?.toLowerCase().includes(q) ||
        lead.assignedStaffEmail?.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        lead.status?.toLowerCase() === statusFilter.toLowerCase();

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "registration" && lead.type === "registration_lead") ||
        (typeFilter === "blog" && lead.type === "blog_registration") ||
        (typeFilter === "callback" && lead.type === "callback");

      const matchesStaff =
        staffFilter === "all" ||
        (staffFilter === "unassigned" && (!lead.assignedStaffId || lead.assignedStaffId === "unassigned")) ||
        (staffFilter === "assigned" && !!lead.assignedStaffId && lead.assignedStaffId !== "unassigned") ||
        lead.assignedStaffId === staffFilter ||
        lead.assignedStaffEmail === staffFilter;

      return matchesSearch && matchesStatus && matchesType && matchesStaff;
    });
  }, [leads, searchQuery, statusFilter, typeFilter, staffFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = leads.length;
    const pending = leads.filter((l) => l.status === "pending" || !l.status).length;
    const contacted = leads.filter((l) => l.status === "contacted").length;
    const inProgress = leads.filter((l) => l.status === "in_progress").length;
    const converted = leads.filter((l) => l.status === "converted" || l.status === "approved").length;
    const registrationPageLeads = leads.filter((l) => l.type === "registration_lead").length;
    const assignedCount = leads.filter(
      (l) => !!l.assignedStaffId && l.assignedStaffId !== "unassigned"
    ).length;
    const unassignedCount = total - assignedCount;

    return {
      total,
      pending,
      contacted,
      inProgress,
      converted,
      registrationPageLeads,
      assignedCount,
      unassignedCount,
    };
  }, [leads]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredLeads.length === 0) {
      showToast("No leads to export");
      return;
    }

    const headers = [
      "Lead ID",
      "Student Name",
      "Email",
      "Mobile",
      "Country",
      "Loan Amount",
      "Admission Status",
      "Loan Status",
      "City",
      "Source",
      "Assigned Staff",
      "Assigned Staff Email",
      "Status",
      "Created At",
    ];

    const rows = filteredLeads.map((l) => {
      const p = parseLeadDetails(l.universityName, l.type);
      return [
        l.id,
        `"${l.name || ""}"`,
        `"${l.email || ""}"`,
        `"${l.mobile || ""}"`,
        `"${p.country}"`,
        `"${p.amount}"`,
        `"${p.admissionStatus}"`,
        `"${p.loanStatus}"`,
        `"${p.city}"`,
        `"${p.source}"`,
        `"${l.assignedStaffName || "Unassigned"}"`,
        `"${l.assignedStaffEmail || ""}"`,
        `"${l.status || "pending"}"`,
        `"${new Date(l.createdAt).toLocaleString()}"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `vidyaloans-leads-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV exported successfully");
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStatusBadge = (status: string) => {
    const s = (status || "pending").toLowerCase();
    switch (s) {
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            New / Pending
          </span>
        );
      case "contacted":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <PhoneCall className="w-3 h-3 text-blue-500" />
            Contacted
          </span>
        );
      case "in_progress":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Clock className="w-3 h-3 text-purple-500" />
            In Review
          </span>
        );
      case "converted":
      case "approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Converted
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <X className="w-3 h-3 text-rose-500" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-[1440px] mx-auto pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Top Banner / Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6605c7] to-indigo-600 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Registration Leads & Student Inquiries
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 border border-purple-200 tracking-wider">
                  Live CRM
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time capture from{" "}
                <code className="text-indigo-600 font-bold bg-indigo-50 px-1 py-0.5 rounded">
                  /registration
                </code>{" "}
                direct form and education loan inquiries
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 w-full lg:w-auto">
          <button
            onClick={() => fetchLeads(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs disabled:opacity-50"
            title="Refresh Leads List"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-purple-600" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            Export CSV
          </button>
          <a
            href="/registration"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#6605c7] to-indigo-600 hover:opacity-95 shadow-md shadow-purple-500/20 transition-all ml-auto lg:ml-0"
          >
            <span>Open Registration Form</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Leads */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Leads</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
          <p className="text-[11px] text-slate-500 mt-1">
            <span className="text-indigo-600 font-bold">{stats.registrationPageLeads}</span> from /registration form
          </p>
        </div>

        {/* Unassigned Leads */}
        <div className="bg-white p-5 rounded-2xl border border-purple-200/80 bg-gradient-to-br from-white to-purple-50/30 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Unassigned</span>
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-900">{stats.unassignedCount}</div>
          <p className="text-[11px] text-purple-700/80 mt-1 font-medium">Ready to assign to staff</p>
        </div>

        {/* Assigned to Staff */}
        <div className="bg-white p-5 rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-white to-indigo-50/30 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Assigned</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-900">{stats.assignedCount}</div>
          <p className="text-[11px] text-indigo-700/80 mt-1 font-medium">Under counselor handling</p>
        </div>

        {/* New / Pending */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 bg-gradient-to-br from-white to-amber-50/30 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">New Leads</span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-800">{stats.pending}</div>
          <p className="text-[11px] text-amber-700/80 mt-1 font-medium">Awaiting first follow-up</p>
        </div>

        {/* Converted */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/30 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Converted</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-900">{stats.converted}</div>
          <p className="text-[11px] text-emerald-700/80 mt-1 font-medium">Applied for loans</p>
        </div>
      </div>

      {/* Bulk Assignment Bar (Shows when 1 or more leads are selected) */}
      {selectedLeadIds.length > 0 && (
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-4 rounded-2xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 border border-purple-500/30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/30 font-bold text-xs">
              {selectedLeadIds.length}
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                {selectedLeadIds.length} Lead{selectedLeadIds.length > 1 ? "s" : ""} Selected
              </p>
              <p className="text-[11px] text-purple-200">
                Choose a staff member to assign the selected leads in bulk.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={bulkStaffId}
              onChange={(e) => setBulkStaffId(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-slate-900"
            >
              <option value="" className="text-slate-800">
                Select Staff Member...
              </option>
              <option value="unassigned" className="text-slate-800">
                -- Unassign Selected Leads --
              </option>
              {staffMembers.map((s) => (
                <option key={s.id} value={s.id} className="text-slate-800">
                  {s.name} ({s.email})
                </option>
              ))}
            </select>

            <button
              onClick={handleBulkAssign}
              disabled={bulkAssigning || !bulkStaffId}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white shadow-md transition-all flex items-center gap-1.5"
            >
              {bulkAssigning && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{bulkStaffId === "unassigned" ? "Unassign Selected" : "Assign to Staff"}</span>
            </button>

            <button
              onClick={() => setSelectedLeadIds([])}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-all"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col lg:flex-row gap-3 items-center justify-between">
        {/* Search Bar */}
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student, staff, email, phone..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-800 placeholder:text-slate-400 bg-slate-50/60"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns & Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Status Filters */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
            {[
              { id: "all", label: "All Status" },
              { id: "pending", label: "New" },
              { id: "contacted", label: "Contacted" },
              { id: "converted", label: "Converted" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === f.id
                    ? "bg-white text-slate-900 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Staff Filter Dropdown */}
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 max-w-[190px]"
          >
            <option value="all">Staff: All Leads</option>
            <option value="unassigned">⚠️ Unassigned Leads</option>
            <option value="assigned">👤 Assigned Leads</option>
            <optgroup label="Filter by Staff">
              {staffMembers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </optgroup>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="all">All Sources</option>
            <option value="registration">Registration Form (/registration)</option>
            <option value="blog">Blog Inquiries</option>
            <option value="callback">Callback Requests</option>
          </select>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-24 text-center">
            <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">Loading registration leads...</p>
          </div>
        ) : filteredLeads.length === 0 ? (
          <div className="py-24 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-3">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No matching leads found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all" || typeFilter !== "all" || staffFilter !== "all"
                ? "Try clearing your filters or search keywords."
                : "Submit a new student lead via http://localhost:3000/registration to test."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-purple-600 focus:outline-none flex items-center justify-center"
                      title={selectedLeadIds.length === filteredLeads.length ? "Deselect All" : "Select All"}
                    >
                      {selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-purple-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                    </button>
                  </th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Contact Info</th>
                  <th className="py-3.5 px-4">Destination & Amount</th>
                  <th className="py-3.5 px-4">Assigned Staff</th>
                  <th className="py-3.5 px-4">Registration Details</th>
                  <th className="py-3.5 px-4">Source</th>
                  <th className="py-3.5 px-4">Captured</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => {
                  const parsed = parseLeadDetails(lead.universityName, lead.type);
                  const createdDate = new Date(lead.createdAt);
                  const isRecent = Date.now() - createdDate.getTime() < 1000 * 60 * 60 * 24; // last 24h
                  const isSelected = selectedLeadIds.includes(lead.id);
                  const isLeadAssigned = !!lead.assignedStaffId && lead.assignedStaffId !== "unassigned";

                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-purple-50/30 transition-colors group cursor-pointer ${
                        isSelected ? "bg-purple-50/40" : ""
                      }`}
                      onClick={() => setSelectedLead(lead)}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => toggleSelectLead(lead.id)}
                          className="focus:outline-none flex items-center justify-center"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-purple-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-400" />
                          )}
                        </button>
                      </td>

                      {/* Student Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs">
                            {lead.name
                              ?.split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase() || "ST"}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {lead.name || "Anonymous Lead"}
                              {isRecent && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500" title="New Lead Today" />
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              ID: {lead.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <a
                              href={`mailto:${lead.email}`}
                              className="hover:text-purple-600 hover:underline truncate max-w-[170px]"
                              title={lead.email}
                            >
                              {lead.email}
                            </a>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <a
                              href={`tel:${lead.mobile}`}
                              className="font-medium hover:text-purple-600"
                            >
                              {lead.mobile}
                            </a>
                            <a
                              href={`https://wa.me/${lead.mobile.replace(/\D/g, "")}?text=Hi%20${encodeURIComponent(
                                lead.name
                              )},%20thank%20you%20for%20registering%20with%20VidyaLoans!%20How%20can%20we%20assist%20your%20education%20loan%20for%20${encodeURIComponent(
                                parsed.country
                              )}%3F`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors ml-1"
                              title="Chat on WhatsApp"
                            >
                              <MessageSquare className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Destination & Amount */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <GraduationCap className="w-3.5 h-3.5 text-purple-600" />
                            {parsed.country}
                          </div>
                          <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 inline-block">
                            {parsed.amount}
                          </div>
                        </div>
                      </td>

                      {/* Assigned Staff (Assignment Column) */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="relative inline-block w-full min-w-[150px]">
                          {isLeadAssigned ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                                {lead.assignedStaffName?.[0]?.toUpperCase() || "S"}
                              </div>
                              <select
                                value={lead.assignedStaffId || ""}
                                onChange={(e) => handleAssignLead(lead.id, e.target.value)}
                                disabled={assigningLeadId === lead.id}
                                className="w-full text-[11px] font-semibold py-1 px-2 rounded-lg border border-indigo-200 bg-indigo-50/50 text-indigo-900 hover:bg-indigo-50 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                                title={`Assigned: ${lead.assignedStaffName || lead.assignedStaffEmail}`}
                              >
                                <option value={lead.assignedStaffId || ""}>
                                  {lead.assignedStaffName || "Assigned Staff"}
                                </option>
                                <option value="unassigned">-- Unassign --</option>
                                <optgroup label="Reassign to Staff">
                                  {staffMembers.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name} ({s.email})
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <select
                                value=""
                                onChange={(e) => handleAssignLead(lead.id, e.target.value)}
                                disabled={assigningLeadId === lead.id}
                                className="w-full text-[11px] font-medium py-1 px-2.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-600 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-purple-500 transition-colors"
                              >
                                <option value="" disabled>
                                  + Assign to Staff
                                </option>
                                {staffMembers.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name} ({s.email})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {assigningLeadId === lead.id && (
                            <span className="text-[10px] text-indigo-600 animate-pulse font-medium block mt-0.5">
                              Updating assignment...
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Registration Details */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 text-[11px]">
                          <div className="text-slate-600">
                            <span className="font-semibold text-slate-800">Admission:</span>{" "}
                            {parsed.admissionStatus}
                          </div>
                          <div className="text-slate-600">
                            <span className="font-semibold text-slate-800">Loan Status:</span>{" "}
                            {parsed.loanStatus}
                          </div>
                          {parsed.city && parsed.city !== "Not Specified" && (
                            <div className="text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              {parsed.city}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
                            lead.type === "registration_lead" || parsed.source.includes("Registration")
                              ? "bg-purple-50 text-purple-700 border-purple-200"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {lead.type === "registration_lead" ? "Registration Form" : parsed.source}
                        </span>
                      </td>



                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        <div>{createdDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</div>
                        <div className="text-[10px] text-slate-400">
                          {createdDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedLead(lead)}
                            className="p-1.5 rounded-lg hover:bg-purple-50 text-slate-500 hover:text-purple-700 transition-colors"
                            title="View Lead Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <a
                            href={`https://wa.me/${lead.mobile.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-slate-500 hover:text-emerald-700 transition-colors"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare className="w-4 h-4" />
                          </a>
                          <button
                            onClick={() => handleDeleteLead(lead.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Lead Detail Popup */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600 text-white font-bold flex items-center justify-center text-sm">
                  {selectedLead.name?.[0]?.toUpperCase() || "L"}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">{selectedLead.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">Lead ID: {selectedLead.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLead(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            {(() => {
              const p = parseLeadDetails(selectedLead.universityName, selectedLead.type);
              const isAssigned =
                !!selectedLead.assignedStaffId && selectedLead.assignedStaffId !== "unassigned";

              return (
                <div className="py-5 space-y-4 text-xs">
                  {/* Status Banner */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="font-bold text-slate-700">Lead Status</span>
                    {getStatusBadge(selectedLead.status)}
                  </div>

                  {/* Staff Assignment Card */}
                  <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-indigo-900 flex items-center gap-1.5 text-xs">
                        <UserCheck className="w-4 h-4 text-indigo-600" />
                        Assigned Staff Member
                      </div>
                      {isAssigned ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                          Assigned
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                          Unassigned
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 pt-1">
                      {isAssigned && (
                        <div className="text-xs text-slate-700 flex items-center justify-between bg-white/80 p-2.5 rounded-lg border border-indigo-100/80">
                          <div>
                            <div className="font-bold text-slate-900">
                              {selectedLead.assignedStaffName || "Staff Member"}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {selectedLead.assignedStaffEmail || ""}
                            </div>
                          </div>
                          {selectedLead.assignedAt && (
                            <div className="text-[10px] text-slate-400 text-right">
                              Assigned on:
                              <br />
                              {new Date(selectedLead.assignedAt).toLocaleDateString("en-IN")}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Dropdown to change or assign */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">
                          {isAssigned ? "Reassign or Change Staff" : "Assign to Staff Member"}
                        </label>
                        <select
                          value={selectedLead.assignedStaffId || ""}
                          onChange={(e) => handleAssignLead(selectedLead.id, e.target.value)}
                          disabled={assigningLeadId === selectedLead.id}
                          className="w-full p-2 rounded-xl text-xs font-semibold bg-white border border-indigo-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- Choose Staff Member --</option>
                          {isAssigned && <option value="unassigned">-- Remove Assignment (Unassign) --</option>}
                          {staffMembers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.email})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
                      <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Mobile / WhatsApp</div>
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-purple-600" />
                        {selectedLead.mobile}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/60">
                      <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Email Address</div>
                      <div className="font-bold text-slate-800 truncate" title={selectedLead.email}>
                        {selectedLead.email}
                      </div>
                    </div>
                  </div>

                  {/* Academic & Financial Preferences */}
                  <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 space-y-2.5">
                    <div className="font-bold text-purple-900 flex items-center gap-1.5 text-xs mb-1">
                      <GraduationCap className="w-4 h-4 text-purple-700" />
                      Registration Submission Details
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-slate-700">
                      <div>
                        <span className="text-slate-400 font-semibold">Target Destination:</span>
                        <div className="font-bold text-slate-900 text-sm mt-0.5">{p.country}</div>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold">Loan Budget:</span>
                        <div className="font-bold text-emerald-700 text-sm mt-0.5">{p.amount}</div>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold">Admission Status:</span>
                        <div className="font-bold text-slate-800 mt-0.5">{p.admissionStatus}</div>
                      </div>
                      <div>
                        <span className="text-slate-400 font-semibold">Loan Status:</span>
                        <div className="font-bold text-slate-800 mt-0.5">{p.loanStatus}</div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 font-semibold">Current City / Location:</span>
                        <div className="font-bold text-slate-800 mt-0.5">{p.city}</div>
                      </div>
                    </div>
                  </div>

                  {/* Raw Descriptor info */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/60">
                    <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">Raw Payload Summary</div>
                    <p className="text-slate-600 text-[11px] break-words font-mono">
                      {selectedLead.universityName}
                    </p>
                  </div>

                  {/* Submission Timestamp */}
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Submitted on {new Date(selectedLead.createdAt).toLocaleString("en-IN")}
                  </div>

                  {/* Quick CTAs */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <a
                      href={`https://wa.me/${selectedLead.mobile.replace(/\D/g, "")}?text=Hi%20${encodeURIComponent(
                        selectedLead.name
                      )},%20this%20is%20VidyaLoans%20advisory%20team%20regarding%20your%20study%20abroad%20loan%20for%20${encodeURIComponent(
                        p.country
                      )}.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-xs"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Chat on WhatsApp
                    </a>
                    <button
                      onClick={() =>
                        copyToClipboard(
                          `Student: ${selectedLead.name}\nPhone: ${selectedLead.mobile}\nEmail: ${selectedLead.email}\nCountry: ${p.country}\nAmount: ${p.amount}\nAdmission: ${p.admissionStatus}\nLoan: ${p.loanStatus}\nCity: ${p.city}\nAssigned Staff: ${selectedLead.assignedStaffName || "Unassigned"}`,
                          selectedLead.id
                        )
                      }
                      className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
                    >
                      {copiedId === selectedLead.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      Copy Details
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
