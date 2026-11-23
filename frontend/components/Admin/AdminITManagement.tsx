"use client";

import { useState, useEffect } from "react";
import { itApi } from "@/lib/api";
import { format } from "date-fns";

interface ITUser {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
    mobile: string | null;
    role: string;
    createdAt: string;
    updatedAt?: string;
}

export default function AdminITManagement() {
    const [itUsers, setItUsers] = useState<ITUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Modal state for creating IT user
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newFirstName, setNewFirstName] = useState("");
    const [newLastName, setNewLastName] = useState("");
    const [newMobile, setNewMobile] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Modal state for resetting password
    const [showResetModal, setShowResetModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<ITUser | null>(null);
    const [resetPassword, setResetPassword] = useState("");
    const [resetLoading, setResetLoading] = useState(false);
    const [resetError, setResetError] = useState("");
    const [showResetPassword, setShowResetPassword] = useState(false);

    // Success notification banner
    const [successMessage, setSuccessMessage] = useState("");

    const loadITUsers = async () => {
        setLoading(true);
        try {
            const res: any = await itApi.getUsers();
            if (res && res.success && Array.isArray(res.data)) {
                setItUsers(res.data);
            }
        } catch (err: any) {
            console.error("Failed to load IT users:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadITUsers();
    }, []);

    const generateRandomPassword = () => {
        const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
        let pwd = "";
        for (let i = 0; i < 10; i++) {
            pwd += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return pwd;
    };

    const handleOpenCreateModal = () => {
        setNewEmail("");
        setNewPassword(generateRandomPassword());
        setNewFirstName("");
        setNewLastName("");
        setNewMobile("");
        setCreateError("");
        setShowNewPassword(true);
        setShowCreateModal(true);
    };

    const handleCreateITUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError("");

        const cleanEmail = newEmail.trim().toLowerCase();
        if (!cleanEmail) {
            setCreateError("Email is required.");
            return;
        }
        if (!newFirstName.trim()) {
            setCreateError("First name is required.");
            return;
        }
        if (!newPassword || newPassword.trim().length < 6) {
            setCreateError("Password must be at least 6 characters.");
            return;
        }

        setCreateLoading(true);
        try {
            const res: any = await itApi.createUser({
                email: cleanEmail,
                password: newPassword.trim(),
                firstName: newFirstName.trim(),
                lastName: newLastName.trim(),
                mobile: newMobile.trim(),
            });

            if (res && res.success) {
                setShowCreateModal(false);
                setSuccessMessage(`IT Member ${cleanEmail} created successfully! They can now log in at /it/login.`);
                setTimeout(() => setSuccessMessage(""), 7000);
                await loadITUsers();
            } else {
                setCreateError(res?.message || "Failed to create IT user.");
            }
        } catch (err: any) {
            console.error("Create IT User error:", err);
            setCreateError(err?.message || "Failed to create IT user.");
        } finally {
            setCreateLoading(false);
        }
    };

    const handleOpenResetModal = (user: ITUser) => {
        setSelectedUser(user);
        setResetPassword(generateRandomPassword());
        setResetError("");
        setShowResetPassword(true);
        setShowResetModal(true);
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;
        setResetError("");

        if (!resetPassword || resetPassword.trim().length < 6) {
            setResetError("Password must be at least 6 characters.");
            return;
        }

        setResetLoading(true);
        try {
            const res: any = await itApi.resetPassword(selectedUser.id, resetPassword.trim());
            if (res && res.success) {
                setShowResetModal(false);
                setSuccessMessage(`Password updated successfully for ${selectedUser.email}.`);
                setTimeout(() => setSuccessMessage(""), 5000);
            } else {
                setResetError(res?.message || "Failed to update password.");
            }
        } catch (err: any) {
            console.error("Reset password error:", err);
            setResetError(err?.message || "Failed to update password.");
        } finally {
            setResetLoading(false);
        }
    };

    const handleDeleteUser = async (user: ITUser) => {
        const confirmed = window.confirm(
            `Are you sure you want to revoke IT access for ${user.firstName || ""} ${user.lastName || ""} (${user.email})?`
        );
        if (!confirmed) return;

        try {
            const res: any = await itApi.deleteUser(user.id);
            if (res && res.success) {
                setSuccessMessage(`IT access revoked for ${user.email}.`);
                setTimeout(() => setSuccessMessage(""), 5000);
                await loadITUsers();
            } else {
                alert(res?.message || "Failed to remove IT user.");
            }
        } catch (err: any) {
            console.error("Delete IT user error:", err);
            alert(err?.message || "Failed to remove IT user.");
        }
    };

    const filteredUsers = itUsers.filter((u) => {
        const q = searchQuery.toLowerCase();
        const fullName = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase();
        const email = (u.email || "").toLowerCase();
        const id = (u.id || "").toLowerCase();
        return fullName.includes(q) || email.includes(q) || id.includes(q);
    });

    return (
        <div className="space-y-6">
            {/* Header with Title and Add Button */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6605c7]/10 border border-[#6605c7]/20 text-[#6605c7] text-xs font-bold uppercase tracking-wider mb-2">
                        <span className="material-symbols-outlined text-sm">terminal</span>
                        IT Operations Management
                    </div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                        IT Personnel & Access Control
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                        Authorize IT engineers and operations administrators with secure email and password credentials to manage support tickets, technical blogs, and platform operations.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <a
                        href="/it"
                        target="_blank"
                        rel="noreferrer"
                        className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
                        title="Open IT Dashboard in new tab"
                    >
                        <span className="material-symbols-outlined text-base text-slate-500">open_in_new</span>
                        Open IT Portal
                    </a>
                    <button
                        onClick={handleOpenCreateModal}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#6605c7] to-[#8b5cf6] hover:from-[#5504a6] hover:to-[#7c3aed] text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">person_add</span>
                        Add IT Member
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {successMessage && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-sm animate-fadeIn">
                    <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
                    <span>{successMessage}</span>
                </div>
            )}

            {/* Stats Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total IT Members</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{itUsers.length}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-[#6605c7]/10 text-[#6605c7] flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">badge</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dedicated Login URL</p>
                        <p className="text-xs font-mono font-bold text-[#6605c7] mt-2 truncate">/it/login</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">lock</span>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Authentication</p>
                        <p className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Email &amp; Password
                        </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">verified_user</span>
                    </div>
                </div>
            </div>

            {/* IT Members Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
                    <div className="relative flex-1 max-w-md">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
                            search
                        </span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search IT members by name, email, or ID..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#6605c7] focus:ring-1 focus:ring-[#6605c7]"
                        />
                    </div>
                    <div className="text-xs font-semibold text-slate-500 text-right">
                        Showing {filteredUsers.length} of {itUsers.length} members
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                                <th className="py-3 px-5">Member Name</th>
                                <th className="py-3 px-5">Login Email</th>
                                <th className="py-3 px-5">Role</th>
                                <th className="py-3 px-5">Phone / Mobile</th>
                                <th className="py-3 px-5">Created Date</th>
                                <th className="py-3 px-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-400">
                                        <div className="w-8 h-8 border-3 border-[#6605c7]/20 border-t-[#6605c7] rounded-full animate-spin mx-auto mb-2" />
                                        Loading IT members...
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-slate-400">
                                        <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">group_off</span>
                                        <p className="font-semibold text-slate-600">No IT members found</p>
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            {searchQuery ? "No matches for your search query." : "Click 'Add IT Member' above to create the first IT account."}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="py-3.5 px-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#6605c7] to-[#8b5cf6] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                                                    {(user.firstName || "I")[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-slate-900">
                                                        {user.firstName} {user.lastName || ""}
                                                    </p>
                                                    <p className="text-[10px] font-mono text-slate-400">{user.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-5">
                                            <span className="font-mono text-slate-700 font-medium">{user.email}</span>
                                        </td>
                                        <td className="py-3.5 px-5">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#6605c7]/10 text-[#6605c7] border border-[#6605c7]/20">
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#6605c7]"></span>
                                                {user.role === "it_admin" ? "IT Administrator" : "IT Operations"}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-5 text-slate-600">
                                            {user.mobile || user.phoneNumber || <span className="text-slate-400 italic">Not provided</span>}
                                        </td>
                                        <td className="py-3.5 px-5 text-slate-500">
                                            {user.createdAt ? format(new Date(user.createdAt), "dd MMM yyyy, HH:mm") : "N/A"}
                                        </td>
                                        <td className="py-3.5 px-5 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    onClick={() => handleOpenResetModal(user)}
                                                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 transition-all"
                                                    title="Change or reset password"
                                                >
                                                    <span className="material-symbols-outlined text-[15px] text-slate-500">key</span>
                                                    <span>Password</span>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user)}
                                                    className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs transition-all"
                                                    title="Revoke IT access"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create IT Member Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-scaleUp">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-xl">person_add</span>
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">Add New IT Member</h3>
                                    <p className="text-xs text-slate-500">Grant IT dashboard login with email &amp; password</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        {createError && (
                            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">error</span>
                                <span>{createError}</span>
                            </div>
                        )}

                        <form onSubmit={handleCreateITUser} className="space-y-4 mt-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        First Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={newFirstName}
                                        onChange={(e) => setNewFirstName(e.target.value)}
                                        placeholder="e.g. Rahul"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Last Name
                                    </label>
                                    <input
                                        type="text"
                                        value={newLastName}
                                        onChange={(e) => setNewLastName(e.target.value)}
                                        placeholder="e.g. Sharma"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Login Email <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    placeholder="e.g. rahul.it@vidyaloans.com"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-bold text-slate-700">
                                        Login Password <span className="text-rose-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setNewPassword(generateRandomPassword())}
                                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                    >
                                        Generate Strong Password
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        required
                                        minLength={6}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="Minimum 6 characters"
                                        className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <span className="material-symbols-outlined text-base">
                                            {showNewPassword ? "visibility_off" : "visibility"}
                                        </span>
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-1">
                                    Share this password with the IT member so they can sign in at /it/login.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Phone / Mobile Number (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={newMobile}
                                    onChange={(e) => setNewMobile(e.target.value)}
                                    placeholder="+91 98765 43210"
                                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createLoading}
                                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {createLoading ? "Creating IT Account..." : "Create IT Account"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetModal && selectedUser && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-scaleUp">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-xl">key</span>
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-slate-900">Reset IT Password</h3>
                                    <p className="text-xs text-slate-500">{selectedUser.email}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowResetModal(false)}
                                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
                            >
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>

                        {resetError && (
                            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">error</span>
                                <span>{resetError}</span>
                            </div>
                        )}

                        <form onSubmit={handleResetPassword} className="space-y-4 mt-5">
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-bold text-slate-700">
                                        New Password <span className="text-rose-500">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setResetPassword(generateRandomPassword())}
                                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                                    >
                                        Generate New
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type={showResetPassword ? "text" : "password"}
                                        required
                                        minLength={6}
                                        value={resetPassword}
                                        onChange={(e) => setResetPassword(e.target.value)}
                                        placeholder="Minimum 6 characters"
                                        className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowResetPassword(!showResetPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <span className="material-symbols-outlined text-base">
                                            {showResetPassword ? "visibility_off" : "visibility"}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowResetModal(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={resetLoading}
                                    className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    {resetLoading ? "Updating..." : "Update Password"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
