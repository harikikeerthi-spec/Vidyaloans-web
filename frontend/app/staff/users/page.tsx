"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useStaffLayout } from "@/app/staff/layout";
import { adminApi } from "@/lib/api";
import { format } from "date-fns";
import SendEmailModal from "@/components/staff/SendEmailModal";

const IST_OFFSET = 5.5 * 60 * 60 * 1000;

const convertToIST = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    let cleanDs = dateStr;
    if (typeof cleanDs === 'string' && !cleanDs.includes('Z') && !cleanDs.includes('+')) {
        if (cleanDs.includes('T') || cleanDs.includes(':')) {
            const formatted = cleanDs.replace(' ', 'T');
            cleanDs = formatted.includes('Z') ? formatted : formatted + 'Z';
        }
    }
    const utcDate = new Date(cleanDs);
    return new Date(utcDate.getTime() + IST_OFFSET);
};

const TableHeader = ({ children }: { children: React.ReactNode }) => (
    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-widest font-['Playfair_Display',serif] font-bold text-left">
        <tr>{children}</tr>
    </thead>
);

export default function UserDirectoryPage() {
    const router = useRouter();
    const { onlineEmails } = useStaffLayout();

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [userRoleFilter, setUserRoleFilter] = useState("all");
    const [userSectionStats, setUserSectionStats] = useState<any>(null);
    const itemsPerPage = 15;

    // Email Modal
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailModalRecipient, setEmailModalRecipient] = useState("");
    const [emailModalRecipientName, setEmailModalRecipientName] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const offset = (currentPage - 1) * itemsPerPage;
            const roleParam = userRoleFilter === "all" ? "bank,staff,staff_admin" : userRoleFilter;
            const [usersRes, statsRes]: [any, any] = await Promise.all([
                adminApi.getUsers(itemsPerPage, offset, searchQuery, roleParam),
                adminApi.getUserStats().catch(() => null)
            ]);

            if (usersRes && usersRes.data) {
                const filtered = usersRes.data.filter((item: any) => {
                    const r = (item.role || '').toLowerCase();
                    return r !== 'student' && r !== 'user';
                });
                setData(filtered);
                setTotalItems(usersRes.total || filtered.length);
            } else {
                const list = Array.isArray(usersRes) ? usersRes.filter((item: any) => {
                    const r = (item.role || '').toLowerCase();
                    return r !== 'student' && r !== 'user';
                }) : [];
                setData(list);
                setTotalItems(list.length);
            }

            if (statsRes && statsRes.success) {
                setUserSectionStats(statsRes.data || statsRes);
            } else if (statsRes) {
                setUserSectionStats(statsRes);
            }
        } catch (e) {
            console.error("Failed to load user directory", e);
        } finally {
            setLoading(false);
        }
    }, [currentPage, searchQuery, userRoleFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const openEmailModal = (email: string, name: string) => {
        setEmailModalRecipient(email);
        setEmailModalRecipientName(name);
        setIsEmailModalOpen(true);
    };

    const userStatsData = useMemo(() => {
        const bankPartners = userSectionStats?.bank ?? 0;
        const staffMembers = userSectionStats?.staff ?? 0;
        return [
            { id: 'bank', label: 'Bank Partners', value: bankPartners, icon: 'account_balance', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', tag: 'ROLE' },
            { id: 'staff', label: 'Staff Members', value: staffMembers, icon: 'badge', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-100', tag: 'O_ADMIN' },
        ];
    }, [userSectionStats]);

    const startOnboarding = () => {
        router.push("/staff/onboarding");
    };

    const roleMap: Record<string, { label: string; color: string; dot: string }> = {
        user: { label: 'USER', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
        student: { label: 'STUDENT', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
        staff: { label: 'STAFF', color: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
        staff_admin: { label: 'STAFF', color: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
        bank: { label: 'BANK', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
        admin: { label: 'ADMIN', color: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
    };

    const getUserDisplayName = (item: any) => {
        const roleKey = item.role?.toLowerCase() || 'user';
        if (roleKey === 'bank') {
            const email = (item.email || '').toLowerCase();
            if (email.includes('hdfc') || email.includes('credila')) return 'HDFC Credila';
            if (email.includes('auxilo')) return 'Auxilo Finserve';
            if (email.includes('idfc')) return 'IDFC First Bank';
            if (email.includes('avanse')) return 'Avanse Financial';
            if (email.includes('poonawalla')) return 'Poonawalla Fincorp';

            const fullName = `${item.firstName || ''} ${item.lastName || ''}`.toLowerCase();
            if (fullName.includes('credila') || fullName.includes('hdfc')) return 'HDFC Credila';
            if (fullName.includes('auxilo')) return 'Auxilo Finserve';
            if (fullName.includes('idfc')) return 'IDFC First Bank';
            if (fullName.includes('avanse')) return 'Avanse Financial';
            if (fullName.includes('poonawalla')) return 'Poonawalla Fincorp';

            return 'Bank Partner';
        }
        return `${item.firstName || ''} ${item.lastName || ''}`.trim() || '—';
    };

    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const showingStart = (currentPage - 1) * itemsPerPage + 1;
    const showingEnd = Math.min(currentPage * itemsPerPage, totalItems);

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto animate-fade-in pb-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <p className="text-[10px] font-['Playfair_Display',serif] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-semibold text-indigo-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            STAFF & BANK MEMBER DIRECTORY
                        </span>
                    </p>
                    <h2 className="text-[28px] tracking-tight flex items-center gap-3 font-['Playfair_Display',serif] font-bold text-[#0d1b2a]">
                        User Directory
                    </h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={startOnboarding}
                        className="px-5 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">person_add</span>
                        Onboard Applicant
                    </button>
                    <button
                        onClick={loadData}
                        className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[16px]">refresh</span>
                        Refresh
                    </button>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            placeholder="Search bank or staff..."
                            className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-['Playfair_Display',serif] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 w-64 shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 mb-2">
                {userStatsData.map((c, i) => (
                    <button
                        key={i}
                        onClick={() => { setUserRoleFilter(prev => prev === c.id ? 'all' : c.id); setCurrentPage(1); }}
                        className={`bg-white rounded-xl border ${userRoleFilter === c.id ? 'ring-2 ring-indigo-500 border-indigo-200 shadow-md' : c.border} p-4 text-left transition-all hover:shadow-md active:scale-[0.98]`}
                    >
                        <div className="flex items-start justify-between mb-3">
                            <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.border} border flex items-center justify-center`}>
                                <span className={`material-symbols-outlined text-[18px] ${c.color}`}>{c.icon}</span>
                            </div>
                            <span className={`text-[11px] font-['Playfair_Display',serif] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${c.bg} ${c.color}`}>{c.tag}</span>
                        </div>
                        <p className="text-[32px] font-bold text-slate-900 leading-none mb-1">
                            {loading ? <span className="block w-8 h-6 bg-slate-100 animate-pulse rounded" /> : c.value}
                        </p>
                        <p className="text-[12px] font-['Playfair_Display',serif] font-bold text-slate-500 uppercase tracking-widest">{c.label}</p>
                    </button>
                ))}
            </div>

            {/* Users Table */}
            <div className="rounded-[24px] border border-slate-100 overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <TableHeader>
                            <th className="px-5 py-5"><span className="text-[12px] font-['Playfair_Display',serif] font-extrabold text-[#0d1b2a] uppercase tracking-widest">PROFILE</span></th>
                            <th className="px-5 py-5"><span className="text-[12px] font-['Playfair_Display',serif] font-extrabold text-[#0d1b2a] uppercase tracking-widest">CONTACT INFO</span></th>
                            <th className="px-5 py-5"><span className="text-[12px] font-['Playfair_Display',serif] font-extrabold text-[#0d1b2a] uppercase tracking-widest">ACCESS ROLE</span></th>
                            <th className="px-5 py-5"><span className="text-[12px] font-['Playfair_Display',serif] font-extrabold text-[#0d1b2a] uppercase tracking-widest">LAST ACTIVE</span></th>
                            <th className="px-5 py-5"><span className="text-[12px] font-['Playfair_Display',serif] font-extrabold text-[#0d1b2a] uppercase tracking-widest">REGISTERED</span></th>
                            <th className="px-5 py-5 text-center"><span className="text-[12px] font-['Playfair_Display',serif] font-extrabold text-[#0d1b2a] uppercase tracking-widest">ACTIONS</span></th>
                        </TableHeader>
                        <tbody className={`divide-y divide-slate-50 ${loading ? 'opacity-60 pointer-events-none transition-opacity duration-300' : 'transition-opacity duration-300'}`}>
                            {loading && data.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-8 py-32 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="w-10 h-10 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin" />
                                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Loading...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : data.length > 0 ? (
                                data.map((item, idx) => {
                                    const roleKey = item.role?.toLowerCase() || 'user';
                                    const roleInfo = roleMap[roleKey] || roleMap['user'];
                                    const initials = getUserDisplayName(item)[0] || '?';
                                    const avatarColors = ['bg-indigo-100 text-indigo-700', 'bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700', 'bg-rose-100 text-rose-700', 'bg-sky-100 text-sky-700'];
                                    const avatarColor = avatarColors[(item.email?.charCodeAt(0) || 0) % avatarColors.length];
                                    const isUserOnline = item.email && onlineEmails.map(e => e.toLowerCase()).includes(item.email.toLowerCase());

                                    return (
                                        <tr key={item.id || item._id || idx} className="group hover:bg-slate-50/30 transition-colors">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="relative flex-shrink-0">
                                                        <div className={`w-10 h-10 rounded-full overflow-hidden border-2 border-white shadow-sm ring-1 ring-slate-200 ${avatarColor} flex items-center justify-center font-bold text-[13px]`}>
                                                            <img
                                                                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${item.email}`}
                                                                alt={initials}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                            />
                                                        </div>
                                                        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${isUserOnline ? 'bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500/30' : 'bg-slate-300'}`} title={isUserOnline ? "Online now" : "Offline"} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[16px] font-bold text-[#0d1b2a] leading-tight">
                                                            {getUserDisplayName(item)}
                                                        </p>
                                                        <p className="text-[12px] text-slate-900 font-bold font-mono mt-1">
                                                            ID: {item.id || item._id || ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <p className="text-[15px] text-slate-700 font-medium">{item.email}</p>
                                                <p className="text-[13px] text-slate-500 font-bold flex items-center gap-1 mt-1">
                                                    <span className="material-symbols-outlined text-[12px]">phone_enabled</span>
                                                    {item.phone || item.mobile || item.phoneNumber || '—'}
                                                </p>
                                            </td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold uppercase tracking-wider border ${roleInfo.color}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${roleInfo.dot}`} />
                                                    {roleInfo.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                {item.last_login_at ? (
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-1.5 text-[14px] font-medium text-slate-700">
                                                            <span className="material-symbols-outlined text-[13px] text-emerald-500">pin_drop</span>
                                                            {item.last_login_location || 'Unknown location'}
                                                        </div>
                                                        <div className="flex items-center gap-3 text-[12px] text-slate-400">
                                                            <span className="flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-[11px]">devices</span>
                                                                {item.last_login_device?.split(' - ')[0] || 'Unknown'}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <span className="material-symbols-outlined text-[11px]">router</span>
                                                                {item.last_login_ip || '—'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                        <span className="text-[13px] font-semibold text-slate-400 uppercase tracking-widest">Never Logged In</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4">
                                                {(() => {
                                                    const regTime = item.registeredAtIndia || item.createdAt;
                                                    if (!regTime) return <span className="text-[12px] font-mono text-slate-400">NO_RECORD</span>;

                                                    try {
                                                        const dateObj = convertToIST(regTime);
                                                        if (!isNaN(dateObj.getTime())) {
                                                            return (
                                                                <>
                                                                    <p className="text-[14px] font-semibold text-slate-800">{format(dateObj, 'MMM d, yyyy').toUpperCase()}</p>
                                                                    <p className="text-[12px] text-slate-400 mt-0.5">{format(dateObj, 'hh:mm aa')}</p>
                                                                </>
                                                            );
                                                        }
                                                    } catch (e) {
                                                        console.error(e);
                                                    }
                                                    const displayTime = typeof regTime === 'string' ? regTime.replace(/\s*IST\s*$/i, '') : regTime;
                                                    return <span className="text-[13px] font-semibold text-slate-800">{displayTime}</span>;
                                                })()}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const uid = item.id || item._id;
                                                            const email = item.email;
                                                            window.open(`/staff/users/${uid}${email ? `?email=${email}` : ''}`, '_blank');
                                                        }}
                                                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 flex items-center justify-center transition-all shadow-sm"
                                                        title="View Profile"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">visibility</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            const email = item.email || '';
                                                            const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '');
                                                            window.open(`/staff/inbox?folder=staff/${slug}/&staffEmail=${email}`, '_blank');
                                                        }}
                                                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 flex items-center justify-center transition-all shadow-sm"
                                                        title="Open Staff S3 Mail Inbox"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">all_inbox</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (item.email) openEmailModal(item.email, getUserDisplayName(item));
                                                        }}
                                                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 flex items-center justify-center transition-all shadow-sm"
                                                        title="Send Email"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">mail</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10} className="px-8 py-24 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4 text-slate-400">
                                            <span className="material-symbols-outlined text-5xl">people_outline</span>
                                            <p className="text-[12px] font-black uppercase tracking-widest">No Users Found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalItems > itemsPerPage && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <p className="text-[11px] font-bold text-slate-700">
                            Showing <span className="text-indigo-600">{showingStart}-{showingEnd}</span> of {totalItems} entries
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={currentPage === 1 || loading}
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm"
                            >
                                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                                Previous
                            </button>
                            <button
                                disabled={currentPage >= totalPages || loading}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm"
                            >
                                Next
                                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <SendEmailModal
                isOpen={isEmailModalOpen}
                onClose={() => setIsEmailModalOpen(false)}
                recipientEmail={emailModalRecipient}
                recipientName={emailModalRecipientName}
            />
        </div>
    );
}
