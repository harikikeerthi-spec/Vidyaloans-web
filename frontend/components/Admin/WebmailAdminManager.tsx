"use client";

import React, { useState, useEffect, useMemo } from "react";
import { adminApi } from "@/lib/api";
import Swal from "sweetalert2";

interface WebmailUser {
  id: string;
  email: string;
  name?: string;
  title?: string;
  s3Prefix?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function WebmailAdminManager() {
  const [users, setUsers] = useState<WebmailUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Create Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    name: "",
    title: "",
    s3Prefix: "",
  });
  const [showCreatePassword, setShowCreatePassword] = useState<boolean>(false);
  const [submittingAdd, setSubmittingAdd] = useState<boolean>(false);

  // Reset Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<WebmailUser | null>(null);
  const [newPassword, setNewPassword] = useState<string>("");
  const [showResetPassword, setShowResetPassword] = useState<boolean>(false);
  const [submittingPassword, setSubmittingPassword] = useState<boolean>(false);

  // Fetch Users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res: any = await adminApi.getWebmailUsers();
      if (res && res.success && Array.isArray(res.data)) {
        setUsers(res.data);
      } else {
        setUsers([]);
      }
    } catch (err: any) {
      console.error("Failed to load webmail users:", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err?.message || "Failed to fetch webmail accounts",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.title && u.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.s3Prefix && u.s3Prefix.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" ? true : u.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [users, searchQuery, statusFilter]);

  // Handle Add User Submit
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.email.trim() || !createForm.password.trim()) {
      Swal.fire({
        icon: "warning",
        title: "Missing fields",
        text: "Please provide both an Email address and Password.",
      });
      return;
    }

    try {
      setSubmittingAdd(true);
      const res: any = await adminApi.createWebmailUser(createForm);
      if (res?.success) {
        Swal.fire({
          icon: "success",
          title: "Account Created",
          text: `Official mailbox for ${createForm.email} was added successfully!`,
          timer: 2500,
          showConfirmButton: false,
        });
        setIsAddModalOpen(false);
        setCreateForm({ email: "", password: "", name: "", title: "", s3Prefix: "" });
        fetchUsers();
      } else {
        throw new Error(res?.message || "Failed to create account");
      }
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Creation Failed",
        text: err?.message || "Could not create official mailbox",
      });
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Handle Password Reset Submit
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser || !newPassword.trim()) {
      return;
    }

    try {
      setSubmittingPassword(true);
      const res: any = await adminApi.updateWebmailPassword(passwordTargetUser.id, newPassword);
      if (res?.success) {
        Swal.fire({
          icon: "success",
          title: "Password Updated",
          text: `Password for ${passwordTargetUser.email} has been updated.`,
          timer: 2500,
          showConfirmButton: false,
        });
        setIsPasswordModalOpen(false);
        setPasswordTargetUser(null);
        setNewPassword("");
      } else {
        throw new Error(res?.message || "Failed to update password");
      }
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "Update Failed",
        text: err?.message || "Could not update password",
      });
    } finally {
      setSubmittingPassword(false);
    }
  };

  // Handle Status Toggle
  const handleToggleStatus = async (user: WebmailUser) => {
    const nextStatus = user.status === "active" ? "inactive" : "active";
    const confirm = await Swal.fire({
      title: `${nextStatus === "active" ? "Activate" : "Deactivate"} Account?`,
      text: `Are you sure you want to change status of ${user.email} to ${nextStatus}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: `Yes, ${nextStatus}`,
      cancelButtonText: "Cancel",
      confirmButtonColor: nextStatus === "active" ? "#10b981" : "#f59e0b",
    });

    if (confirm.isConfirmed) {
      try {
        const res: any = await adminApi.updateWebmailStatus(user.id, nextStatus);
        if (res?.success) {
          setUsers((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u))
          );
        }
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Status Update Failed",
          text: err?.message || "Could not toggle status",
        });
      }
    }
  };

  // Handle Delete
  const handleDeleteUser = async (user: WebmailUser) => {
    const confirm = await Swal.fire({
      title: "Delete Mailbox Account?",
      text: `This will remove webmail login access for ${user.email}. Are you sure?`,
      icon: "error",
      showCancelButton: true,
      confirmButtonText: "Yes, Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#ef4444",
    });

    if (confirm.isConfirmed) {
      try {
        const res: any = await adminApi.deleteWebmailUser(user.id);
        if (res?.success) {
          Swal.fire({
            icon: "success",
            title: "Deleted",
            text: `Mailbox account removed.`,
            timer: 2000,
            showConfirmButton: false,
          });
          setUsers((prev) => prev.filter((u) => u.id !== user.id));
        }
      } catch (err: any) {
        Swal.fire({
          icon: "error",
          title: "Delete Failed",
          text: err?.message || "Could not delete mailbox account",
        });
      }
    }
  };

  // Copy Email Helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    Swal.fire({
      toast: true,
      position: "top-end",
      icon: "success",
      title: "Copied to clipboard",
      showConfirmButton: false,
      timer: 1500,
    });
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-fade-in font-sans">
      {/* Top Banner / Stats */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md text-purple-300 material-symbols-outlined text-2xl">
                mark_email_unread
              </span>
              <h2 className="text-2xl font-bold tracking-tight">Official Webmail Accounts</h2>
            </div>
            <p className="text-purple-200/80 text-xs md:text-sm max-w-2xl leading-relaxed">
              Manage authorized higher official mailboxes for the <span className="text-white font-semibold">/webmail</span> portal.
              You can add any official company email (e.g., <code className="bg-white/10 px-1 py-0.5 rounded text-[11px]">@vidyaloans.in</code>)
              or external addresses (such as Gmail) with dedicated passwords.
            </p>
          </div>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-semibold text-xs tracking-wider uppercase transition-all shadow-lg shadow-purple-900/40 hover:scale-[1.02] active:scale-98 flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Add Official Mailbox
          </button>
        </div>

        {/* Quick KPI counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">Total Accounts</span>
            <p className="text-xl font-black mt-0.5">{users.length}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Active</span>
            <p className="text-xl font-black mt-0.5 text-emerald-400">
              {users.filter((u) => u.status === "active").length}
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Inactive</span>
            <p className="text-xl font-black mt-0.5 text-amber-400">
              {users.filter((u) => u.status !== "active").length}
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/10">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">Storage Target</span>
            <p className="text-xs font-semibold mt-1 text-slate-200 truncate">vidyaloans-incoming-emails</p>
          </div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by email, name, role, or S3 folder..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex-shrink-0"
        >
          <span className={`material-symbols-outlined text-[16px] ${loading ? "animate-spin" : ""}`}>
            refresh
          </span>
          Refresh
        </button>
      </div>

      {/* Main Mailbox Accounts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-purple-600/30 border-t-purple-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs font-medium">Loading official mailboxes...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">mail</span>
            <h3 className="text-sm font-bold text-slate-700">No Webmail Accounts Found</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? "No official mailbox matches your search criteria."
                : "No accounts have been registered yet. Click 'Add Official Mailbox' to register your first webmail user."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Official Mailbox</th>
                  <th className="py-3 px-4">Designation / Title</th>
                  <th className="py-3 px-4">S3 Folder Prefix</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Created Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* User Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 shadow-xs">
                          {u.name ? u.name.charAt(0) : u.email.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">
                            {u.name || u.email.split("@")[0]}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-slate-500 font-mono">{u.email}</span>
                            <button
                              onClick={() => copyToClipboard(u.email)}
                              title="Copy Email"
                              className="text-slate-400 hover:text-purple-600 transition-colors"
                            >
                              <span className="material-symbols-outlined text-[13px]">content_copy</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Title */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 border border-purple-100 font-medium text-[11px]">
                        <span className="material-symbols-outlined text-[13px]">badge</span>
                        {u.title || "Higher Official"}
                      </span>
                    </td>

                    {/* S3 Prefix */}
                    <td className="py-3 px-4">
                      <code className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-200">
                        {u.s3Prefix || `${u.email.split("@")[0]}/`}
                      </code>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          u.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                          }`}
                        />
                        {u.status}
                      </span>
                    </td>

                    {/* Created Date */}
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {/* Change Password */}
                        <button
                          onClick={() => {
                            setPasswordTargetUser(u);
                            setNewPassword("");
                            setIsPasswordModalOpen(true);
                          }}
                          title="Reset Password"
                          className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">key</span>
                        </button>

                        {/* Toggle Status */}
                        <button
                          onClick={() => handleToggleStatus(u)}
                          title={u.status === "active" ? "Deactivate Account" : "Activate Account"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            u.status === "active"
                              ? "text-slate-500 hover:text-amber-600 hover:bg-amber-50"
                              : "text-slate-500 hover:text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            {u.status === "active" ? "block" : "check_circle"}
                          </span>
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteUser(u)}
                          title="Delete Account"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── ADD MAILBOX MODAL ─── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">person_add</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Add Official Webmail Mailbox</h3>
                  <p className="text-[11px] text-slate-500">Provide login credentials for the Webmail portal</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              {/* Email */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Official Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="e.g. director@vidyaloans.in or official@gmail.com"
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Supports company domain (@vidyaloans.in) or external addresses (Gmail).
                </p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? "text" : "password"}
                    required
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Enter strong password (min 4 characters)"
                    className="w-full text-xs pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {showCreatePassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Name & Title (Side-by-side) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="e.g. Vamsi Krishna"
                    className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Designation / Title
                  </label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder="e.g. Executive Director"
                    className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>
              </div>

              {/* S3 Storage Prefix */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  S3 Inbound Folder Prefix <span className="text-slate-400 font-normal lowercase">(optional)</span>
                </label>
                <input
                  type="text"
                  value={createForm.s3Prefix}
                  onChange={(e) => setCreateForm({ ...createForm, s3Prefix: e.target.value })}
                  placeholder="e.g. vamsikrishna/ (auto-assigned from email if left blank)"
                  className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md shadow-purple-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submittingAdd && (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  Save Official Mailbox
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── RESET PASSWORD MODAL ─── */}
      {isPasswordModalOpen && passwordTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-xl">key</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Reset Mailbox Password</h3>
                  <p className="text-[11px] text-slate-500">Update Webmail login credentials</p>
                </div>
              </div>
              <button
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Official Account
                </label>
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-800">{passwordTargetUser.name || "Higher Official"}</p>
                  <p className="text-[11px] font-mono text-slate-600">{passwordTargetUser.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showResetPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 4 characters)"
                    className="w-full text-xs pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {showResetPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPassword}
                  className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-md shadow-purple-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submittingPassword && (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

