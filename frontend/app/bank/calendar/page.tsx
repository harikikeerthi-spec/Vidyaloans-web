"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi, bankApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    addMonths as addMonthsDate
} from "date-fns";

interface CalendarEvent {
    id: string;
    applicationId?: string | null;
    taskId?: string | null;
    studentName: string;
    lanNumber: string;
    amount: number;
    type: "expiry" | "sla" | "tranche" | "task";
    status?: string;
    assignedOfficer?: string;
    date: Date;
    label: string;
    details: string;
}

export default function CalendarViewPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [applications, setApplications] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [officers, setOfficers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [typeFilter, setTypeFilter] = useState<"all" | "task" | "sla" | "expiry" | "tranche">("all");

    // Add Event / Task modal
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newDesc, setNewDesc] = useState("");
    const [newDate, setNewDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
    const [newOfficer, setNewOfficer] = useState("");
    const [newAppId, setNewAppId] = useState("");
    const [savingEvent, setSavingEvent] = useState(false);

    const currentBankId = typeof window !== "undefined"
        ? (sessionStorage.getItem("selectedBank") || localStorage.getItem("selectedBank") || "idfc")
        : "idfc";

    useEffect(() => {
        setMounted(true);
        const fetchAll = async () => {
            setLoading(true);
            try {
                const [appRes, taskRes, offRes]: any[] = await Promise.all([
                    adminApi.getApplications({ bank: currentBankId }).catch(() => null),
                    bankApi.getTasks().catch(() => null),
                    bankApi.getOfficers().catch(() => null),
                ]);

                if (appRes && appRes.success) {
                    setApplications(appRes.data || []);
                }
                if (taskRes && taskRes.success) {
                    setTasks(taskRes.data || []);
                }
                if (Array.isArray(offRes)) {
                    setOfficers(offRes.map((o: any) => o.name || o));
                } else if (offRes && Array.isArray(offRes.data)) {
                    setOfficers(offRes.data.map((o: any) => o.name || o));
                }
            } catch (err) {
                console.error("Failed to load calendar data:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, [currentBankId]);

    const handleCreateEvent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTitle.trim()) return;
        setSavingEvent(true);
        try {
            const linkedApp = applications.find(a => a.id === newAppId);
            const res: any = await bankApi.createTask({
                title: newTitle.trim(),
                description: newDesc.trim(),
                dueDate: newDate,
                priority: newPriority,
                assignedOfficer: newOfficer || "Unassigned",
                stage: "pre_screening",
                eventType: "task",
                applicationId: linkedApp?.id || null,
                applicationNumber: linkedApp?.applicationNumber || null,
                studentName: linkedApp ? `${linkedApp.firstName || ""} ${linkedApp.lastName || ""}`.trim() : null,
            });
            if (res && res.success && res.data) {
                setTasks(prev => [res.data, ...prev]);
                setShowAddModal(false);
                setNewTitle("");
                setNewDesc("");
                setNewOfficer("");
                setNewAppId("");
                setSelectedDate(new Date(newDate));
            }
        } catch (err) {
            console.error("Failed to create calendar event:", err);
            alert("Failed to create event.");
        } finally {
            setSavingEvent(false);
        }
    };

    const handleToggleTask = async (taskId: string, currentStatus?: string) => {
        const nextStatus = currentStatus === "completed" ? "todo" : "completed";
        try {
            const res: any = await bankApi.updateTask(taskId, { status: nextStatus });
            if (res && res.success) {
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: nextStatus } : t));
            }
        } catch (err) {
            console.error("Failed to update task:", err);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        try {
            const res: any = await bankApi.deleteTask(taskId);
            if (res && res.success) {
                setTasks(prev => prev.filter(t => t.id !== taskId));
            }
        } catch (err) {
            console.error("Failed to delete task:", err);
        }
    };

    // Derive calendar events from applications + custom bank tasks
    const events: CalendarEvent[] = useMemo(() => {
        const derived: CalendarEvent[] = [];

        applications.forEach(app => {
            const studentName = `${app.firstName || ""} ${app.lastName || ""}`.trim() || "Anonymous Student";
            const lan = app.lanNumber || app.applicationNumber || "Pending LAN";
            const amt = app.amount || 0;

            // 1. SLA Dates (5 days from creation/submission for active review cases)
            const submitDateStr = app.submittedAt || app.createdAt;
            if (submitDateStr && app.status !== "approved" && app.status !== "disbursed" && app.status !== "rejected") {
                const submitDate = new Date(submitDateStr);
                const slaDate = addDays(submitDate, 5);
                derived.push({
                    id: `${app.id}-sla`,
                    applicationId: app.id,
                    studentName,
                    lanNumber: lan,
                    amount: amt,
                    type: "sla",
                    date: slaDate,
                    label: `SLA Deadline: ${studentName}`,
                    details: `Decision target milestone (5 days TAT limit) for ${lan}`
                });
            }

            // 2. Expiries (6 months from approval date)
            const approvedDateStr = app.approvedAt || app.sanctionDate;
            if (approvedDateStr && (app.status === "approved" || app.status === "disbursed")) {
                const approvedDate = new Date(approvedDateStr);
                const expiryDate = app.sanctionExpiry ? new Date(app.sanctionExpiry) : addMonthsDate(approvedDate, 6);
                derived.push({
                    id: `${app.id}-expiry`,
                    applicationId: app.id,
                    studentName,
                    lanNumber: lan,
                    amount: amt,
                    type: "expiry",
                    date: expiryDate,
                    label: `Sanction Expiry: ${studentName}`,
                    details: `Validity expiry of sanction terms for ${lan}`
                });
            }

            // 3. Disbursement Tranches (Scheduled disbursement payouts, e.g., 7 days after approval)
            if (approvedDateStr && app.status === "approved") {
                const approvedDate = new Date(approvedDateStr);
                const trancheDate = addDays(approvedDate, 7);
                derived.push({
                    id: `${app.id}-tranche`,
                    applicationId: app.id,
                    studentName,
                    lanNumber: lan,
                    amount: amt,
                    type: "tranche",
                    date: trancheDate,
                    label: `Tranche Dues: ${studentName}`,
                    details: `Scheduled fund transfer execution of ₹${(app.sanctionAmount || amt).toLocaleString()} for ${lan}`
                });
            }
        });

        // 4. Custom Bank Tasks / Scheduled Events
        tasks.forEach(t => {
            if (!t.dueDate) return;
            derived.push({
                id: `task-${t.id}`,
                taskId: t.id,
                applicationId: t.applicationId || null,
                studentName: t.title,
                lanNumber: t.applicationNumber || "Bank Task",
                amount: 0,
                type: "task",
                status: t.status,
                assignedOfficer: t.assignedOfficer,
                date: new Date(t.dueDate),
                label: t.title,
                details: t.description || (t.assignedOfficer ? `Assigned to ${t.assignedOfficer}` : "Scheduled bank task"),
            });
        });

        if (typeFilter === "all") return derived;
        return derived.filter(e => e.type === typeFilter);
    }, [applications, tasks, typeFilter]);

    // Calendar Grid helper variables
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = useMemo(() => {
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [startDate, endDate]);

    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const today = () => {
        setCurrentDate(new Date());
        setSelectedDate(new Date());
    };

    // Events filter by selected date
    const selectedDateEvents = useMemo(() => {
        if (!selectedDate) return [];
        return events.filter(e => isSameDay(e.date, selectedDate));
    }, [selectedDate, events]);

    if (!mounted) return null;

    return (
        <div className="w-full space-y-6 relative z-10">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-2">
                <div className="space-y-3">
                    <h2 className="text-3xl lg:text-4xl font-black font-display text-gray-900 tracking-tighter leading-none uppercase">
                        Calendar <span className="text-[#6605c7]">Scheduler</span>
                    </h2>
                    <p className="text-gray-400 font-bold uppercase tracking-[0.3em] text-[10px] flex items-center gap-2 pl-1">
                        Expiries, SLA warning dates, scheduled payouts, and bank tasks
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Filter Pills */}
                    <div className="flex gap-1 bg-white/70 border border-purple-50 p-1 rounded-2xl shadow-sm">
                        {(["all", "task", "sla", "expiry", "tranche"] as const).map(f => (
                            <button
                                key={f}
                                type="button"
                                onClick={() => setTypeFilter(f)}
                                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                    typeFilter === f
                                        ? "bg-[#6605c7] text-white shadow-sm"
                                        : "text-gray-500 hover:bg-purple-50"
                                }`}
                            >
                                {f === "all" ? "All" : f === "task" ? "Tasks" : f.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setNewDate(format(selectedDate || new Date(), "yyyy-MM-dd"));
                            setShowAddModal(true);
                        }}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-black uppercase tracking-wider rounded-2xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">add_task</span>
                        Add Task / Event
                    </button>

                    <div className="flex gap-2 bg-white/70 border border-purple-50 p-1 rounded-2xl shadow-sm">
                        <button onClick={prevMonth} aria-label="Previous month" className="p-2 hover:bg-purple-50/50 rounded-xl text-gray-600 transition-all flex items-center justify-center cursor-pointer">
                            <span className="material-symbols-outlined text-sm font-black" aria-hidden="true">chevron_left</span>
                        </button>
                        <span className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-800 min-w-[120px] text-center flex items-center justify-center">
                            {format(currentDate, "MMMM yyyy")}
                        </span>
                        <button onClick={nextMonth} aria-label="Next month" className="p-2 hover:bg-purple-50/50 rounded-xl text-gray-600 transition-all flex items-center justify-center cursor-pointer">
                            <span className="material-symbols-outlined text-sm font-black" aria-hidden="true">chevron_right</span>
                        </button>
                        <button onClick={today} className="px-4 py-2 bg-[#6605c7] hover:bg-[#5203a4] text-white text-[9px] font-black uppercase tracking-wider rounded-xl shadow-sm transition-all cursor-pointer">
                            Today
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="h-[400px] flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-gray-150 border-t-[#6605c7] rounded-full animate-spin" />
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest animate-pulse">Syncing calendar schedule...</span>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Left: Monthly Grid Calendar */}
                    <div className="lg:col-span-8 glass-card bg-white border border-purple-50 rounded-[3rem] p-6 shadow-sm overflow-hidden flex flex-col justify-between">
                        {/* Weekday headers */}
                        <div className="grid grid-cols-7 gap-1 text-center border-b border-gray-100 pb-3 mb-2">
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                                <span key={d} className="text-[9px] font-black uppercase tracking-widest text-[#6605c7]">{d}</span>
                            ))}
                        </div>

                        {/* Calendar cells */}
                        <div className="grid grid-cols-7 gap-1">
                            {days.map((day, idx) => {
                                const dayEvents = events.filter(e => isSameDay(e.date, day));
                                const isCurrentMonth = isSameMonth(day, currentDate);
                                const isSelected = selectedDate && isSameDay(day, selectedDate);
                                const isToday = isSameDay(day, new Date());

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => setSelectedDate(day)}
                                        className={`min-h-[90px] p-2 border rounded-2xl flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden group select-none ${
                                            isSelected 
                                                ? "border-[#6605c7] bg-purple-50/15" 
                                                : "border-gray-50/65 bg-white/70 hover:border-[#6605c7]/40 hover:bg-purple-50/5"
                                        } ${!isCurrentMonth ? "opacity-35" : ""}`}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className={`text-[10px] font-black leading-none ${
                                                isToday 
                                                    ? "w-5 h-5 rounded-full bg-[#6605c7] text-white flex items-center justify-center shadow" 
                                                    : isSelected
                                                        ? "text-[#6605c7] font-black"
                                                        : "text-gray-800"
                                            }`}>
                                                {format(day, "d")}
                                            </span>
                                        </div>

                                        {/* Color Dots Indicators for events */}
                                        <div className="space-y-1 mt-2">
                                            {dayEvents.slice(0, 2).map((e, index) => (
                                                <div 
                                                    key={index} 
                                                    className={`px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase tracking-wider truncate border ${
                                                        e.type === "sla" ? "bg-rose-50 text-rose-600 border-rose-100" :
                                                        e.type === "expiry" ? "bg-amber-50 text-amber-600 border-amber-100" :
                                                        e.type === "task" ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                                                        "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                    }`}
                                                >
                                                    {e.type === "sla" ? "SLA" : e.type === "expiry" ? "EXP" : e.type === "task" ? "TSK" : "TRN"} • {e.studentName.split(" ")[0]}
                                                </div>
                                            ))}
                                            {dayEvents.length > 2 && (
                                                <div className="text-[7px] font-bold text-gray-400 text-right pr-1">
                                                    +{dayEvents.length - 2} more
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Right: Sidebar displaying selected date's events list */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="glass-card bg-white border border-purple-50 rounded-[3rem] p-6 shadow-sm min-h-[300px] flex flex-col justify-between">
                            <div>
                                <div className="border-b border-gray-150 pb-4 mb-4 flex justify-between items-center">
                                    <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">
                                        {selectedDate ? format(selectedDate, "MMM dd, yyyy") : "Selected Events"}
                                    </h3>
                                    <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black bg-purple-50 text-[#6605c7]">
                                        {selectedDateEvents.length} Tasks
                                    </span>
                                </div>

                                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                                    {selectedDateEvents.length === 0 ? (
                                        <div className="py-16 text-center text-gray-450 uppercase tracking-widest text-[9px] font-bold">
                                            No bank events scheduled
                                        </div>
                                    ) : (
                                        selectedDateEvents.map(event => (
                                            <div 
                                                key={event.id}
                                                className={`p-4 border rounded-2xl space-y-2 relative transition-all group ${
                                                    event.type === "sla" ? "bg-rose-50/15 border-rose-100" :
                                                    event.type === "expiry" ? "bg-amber-50/15 border-amber-100" :
                                                    event.type === "task" ? "bg-indigo-50/20 border-indigo-100" :
                                                    "bg-emerald-50/15 border-emerald-100"
                                                }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className={`px-2 py-0.5 rounded-lg text-[7.5px] font-black uppercase tracking-wider border ${
                                                        event.type === "sla" ? "bg-rose-100 text-rose-700 border-rose-200" :
                                                        event.type === "expiry" ? "bg-amber-100 text-amber-700 border-amber-200" :
                                                        event.type === "task" ? "bg-indigo-100 text-indigo-700 border-indigo-200" :
                                                        "bg-emerald-100 text-emerald-700 border-emerald-200"
                                                    }`}>
                                                        {event.type}
                                                    </span>
                                                    {event.amount > 0 ? (
                                                        <span className="font-mono text-[9px] text-[#6605c7] font-black">₹{event.amount.toLocaleString()}</span>
                                                    ) : event.assignedOfficer ? (
                                                        <span className="text-[9px] font-bold text-indigo-600">{event.assignedOfficer}</span>
                                                    ) : null}
                                                </div>

                                                <h4 className={`text-xs font-black text-gray-900 uppercase tracking-tight leading-snug ${event.status === "completed" ? "line-through opacity-60" : ""}`}>
                                                    {event.studentName}
                                                </h4>
                                                <p className="text-[10px] text-gray-500 leading-relaxed font-semibold">{event.details}</p>

                                                <div className="flex gap-2">
                                                    {event.taskId && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleToggleTask(event.taskId!, event.status)}
                                                                className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-[9px] font-black uppercase tracking-widest text-emerald-700 border border-emerald-200 rounded-xl transition-all cursor-pointer"
                                                            >
                                                                {event.status === "completed" ? "Reopen" : "Mark Done"}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteTask(event.taskId!)}
                                                                aria-label="Delete task"
                                                                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl transition-all cursor-pointer"
                                                            >
                                                                <span className="material-symbols-outlined text-[13px]" aria-hidden="true">delete</span>
                                                            </button>
                                                        </>
                                                    )}
                                                    {event.applicationId && (
                                                        <button
                                                            onClick={() => router.push(`/bank/applications?id=${event.applicationId}`)}
                                                            className="flex-1 py-2 bg-white hover:bg-purple-50 text-[9px] font-black uppercase tracking-widest text-purple-700 border border-purple-100 rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                                                        >
                                                            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">search</span> Review Case
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Brief Ticker summary */}
                            <div className="border-t border-gray-150 pt-4 mt-6 text-[8px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                                SLA Compliance is verified. Review deadlines daily to avoid breach warnings.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Calendar Event / Task Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-[2rem] border border-gray-100 shadow-2xl p-8 max-w-md w-full z-10 relative overflow-hidden"
                        >
                            <h3 className="text-xl font-black text-gray-900 mb-1 uppercase tracking-tight">Schedule Bank Task</h3>
                            <p className="text-[9.5px] font-black text-[#6605c7] uppercase tracking-widest mb-5">
                                Synced with Task Matrix & Bank Calendar
                            </p>

                            <form onSubmit={handleCreateEvent} className="space-y-4">
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Title *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Disbursement tranche follow-up"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#6605c7] text-gray-800"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={newDate}
                                            onChange={(e) => setNewDate(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Priority</label>
                                        <select
                                            value={newPriority}
                                            onChange={(e) => setNewPriority(e.target.value as any)}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                        >
                                            <option value="high">High</option>
                                            <option value="medium">Medium</option>
                                            <option value="low">Low</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Assign Officer</label>
                                    <select
                                        value={newOfficer}
                                        onChange={(e) => setNewOfficer(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                    >
                                        <option value="">Unassigned</option>
                                        {officers.map(off => (
                                            <option key={off} value={off}>{off}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Link Application (Optional)</label>
                                    <select
                                        value={newAppId}
                                        onChange={(e) => setNewAppId(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                    >
                                        <option value="">None (General Calendar Event)</option>
                                        {applications.map(app => (
                                            <option key={app.id} value={app.id}>
                                                {app.applicationNumber || app.lanNumber || app.id} — {app.firstName} {app.lastName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Details</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Optional notes..."
                                        value={newDesc}
                                        onChange={(e) => setNewDesc(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#6605c7] text-gray-700"
                                    />
                                </div>

                                <div className="flex gap-4 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={savingEvent}
                                        className="flex-1 py-3 bg-[#6605c7] hover:bg-[#8b24e5] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all cursor-pointer"
                                    >
                                        {savingEvent ? "Saving..." : "Schedule"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
