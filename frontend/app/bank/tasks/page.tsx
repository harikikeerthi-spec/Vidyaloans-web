"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    format,
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    startOfWeek,
    endOfWeek,
    addMonths,
    subMonths,
    addDays,
    isSameMonth,
    isSameDay,
} from "date-fns";
import { adminApi, bankApi } from "@/lib/api";
import { PageHeader, PriorityTag, Spinner } from "@/components/bank/SharedUI";

// Kanban Columns mapping
const COLUMNS = [
    { id: "pre_screening", label: "Pre-Screening", icon: "assignment_ind", color: "border-t-blue-500" },
    { id: "verification", label: "Verification", icon: "verified_user", color: "border-t-purple-500" },
    { id: "risk_evaluation", label: "Risk Evaluation", icon: "analytics", color: "border-t-amber-500" },
    { id: "final_review", label: "Final Review", icon: "rate_review", color: "border-t-indigo-500" },
    { id: "disbursement", label: "Disbursement", icon: "payments", color: "border-t-emerald-500" }
];

export default function TaskMatrix() {
    const [mounted, setMounted] = useState(false);
    const [currentBankId, setCurrentBankId] = useState<string>("idfc");
    const [applications, setApplications] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [officers, setOfficers] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Dynamic Mini-Calendar state
    const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
    const [selectedCalDate, setSelectedCalDate] = useState<Date>(new Date());

    // Modal state for Add Task
    const [showAddTaskModal, setShowAddTaskModal] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newTaskStage, setNewTaskStage] = useState("pre_screening");
    const [newTaskPriority, setNewTaskPriority] = useState<"high" | "medium" | "low">("medium");
    const [newTaskDueDate, setNewTaskDueDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [newTaskOfficer, setNewTaskOfficer] = useState("");
    const [newTaskAppId, setNewTaskAppId] = useState("");
    const [creatingTask, setCreatingTask] = useState(false);

    // Modal state for task re-allocation
    const [selectedApp, setSelectedApp] = useState<any | null>(null);
    const [showReallocateModal, setShowReallocateModal] = useState(false);
    const [modalTab, setModalTab] = useState<"single" | "bulk">("single");

    // Single allocation inputs
    const [assignedOfficer, setAssignedOfficer] = useState("");
    const [allocationReason, setAllocationReason] = useState("load_balancing");

    // Bulk transfer inputs
    const [sourceOfficer, setSourceOfficer] = useState("");
    const [targetOfficer, setTargetOfficer] = useState("");
    const [bulkReason, setBulkReason] = useState("");
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("selectedBank") || localStorage.getItem("selectedBank");
            if (saved) setCurrentBankId(saved);
        }
    }, []);

    const fetchData = async (bankId: string) => {
        setLoading(true);
        try {
            const [appRes, taskRes, offRes]: any[] = await Promise.all([
                adminApi.getApplications({ bank: bankId }).catch(() => null),
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
            } else {
                setOfficers(["Aditya Varma", "Sneha Nair", "Vikram Rathore", "Karthik Raja", "Priya Sharma"]);
            }
        } catch (err) {
            console.error("Failed to load task matrix data:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (mounted) {
            fetchData(currentBankId);
        }
    }, [currentBankId, mounted]);

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;
        setCreatingTask(true);
        try {
            const linkedApp = applications.find(a => a.id === newTaskAppId);
            const res: any = await bankApi.createTask({
                title: newTaskTitle.trim(),
                description: newTaskDesc.trim(),
                stage: newTaskStage,
                priority: newTaskPriority,
                dueDate: newTaskDueDate,
                assignedOfficer: newTaskOfficer || "Unassigned",
                eventType: "task",
                applicationId: linkedApp?.id || null,
                applicationNumber: linkedApp?.applicationNumber || null,
                studentName: linkedApp ? `${linkedApp.firstName || ""} ${linkedApp.lastName || ""}`.trim() : null,
            });
            if (res && res.success && res.data) {
                setTasks(prev => [res.data, ...prev]);
                setShowAddTaskModal(false);
                setNewTaskTitle("");
                setNewTaskDesc("");
                setNewTaskStage("pre_screening");
                setNewTaskPriority("medium");
                setNewTaskOfficer("");
                setNewTaskAppId("");
            }
        } catch (err) {
            console.error("Failed to create task:", err);
            alert("Failed to create task.");
        } finally {
            setCreatingTask(false);
        }
    };

    const handleToggleTaskStatus = async (task: any) => {
        const nextStatus = task.status === "completed" ? "todo" : "completed";
        try {
            const res: any = await bankApi.updateTask(task.id, { status: nextStatus });
            if (res && res.success) {
                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: nextStatus } : t));
            }
        } catch (err) {
            console.error("Failed to update task status:", err);
        }
    };

    const handleMoveTaskStage = async (task: any, nextStage: string) => {
        try {
            const res: any = await bankApi.updateTask(task.id, { stage: nextStage });
            if (res && res.success) {
                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, stage: nextStage } : t));
            }
        } catch (err) {
            console.error("Failed to move task stage:", err);
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

    // Map application properties to column stages
    const mappedApplications = useMemo(() => {
        return applications.map(app => {
            let stage = "pre_screening";
            if (app.status === "disbursed") {
                stage = "disbursement";
            } else if (app.status === "approved") {
                stage = "final_review";
            } else if (app.status === "processing") {
                if (app.remarks && app.remarks.toLowerCase().includes("risk")) {
                    stage = "risk_evaluation";
                } else if (app.remarks && app.remarks.toLowerCase().includes("verify")) {
                    stage = "verification";
                } else {
                    stage = "verification";
                }
            } else if (app.lanNumber) {
                stage = "verification";
            }

            let officer = "Unassigned";
            if (app.remarks) {
                const match = app.remarks.match(/\[Officer:\s*([^\]]+)\]/);
                if (match && match[1]) {
                    officer = match[1];
                }
            }

            return {
                ...app,
                stage,
                officer
            };
        });
    }, [applications]);

    // Dynamic deadlines for the mini-calendar (combining application SLA/Expiries + custom tasks)
    const calendarDeadlines = useMemo(() => {
        const items: { id: string; date: Date; kind: "urgent" | "warning" | "task"; label: string }[] = [];

        applications.forEach(app => {
            const student = `${app.firstName || ""} ${app.lastName || ""}`.trim() || app.applicationNumber || "Student";
            const submitDateStr = app.submittedAt || app.createdAt;
            if (submitDateStr && !["approved", "disbursed", "rejected"].includes(app.status)) {
                items.push({
                    id: `${app.id}-sla`,
                    date: addDays(new Date(submitDateStr), 5),
                    kind: "urgent",
                    label: `SLA Deadline: ${student}`,
                });
            }
            const approvedDateStr = app.approvedAt || app.sanctionDate;
            if (approvedDateStr && (app.status === "approved" || app.status === "disbursed")) {
                items.push({
                    id: `${app.id}-exp`,
                    date: app.sanctionExpiry ? new Date(app.sanctionExpiry) : addMonths(new Date(approvedDateStr), 6),
                    kind: "warning",
                    label: `Sanction Expiry: ${student}`,
                });
            }
        });

        tasks.forEach(t => {
            if (t.dueDate && t.status !== "completed") {
                items.push({
                    id: `task-${t.id}`,
                    date: new Date(t.dueDate),
                    kind: t.priority === "high" ? "urgent" : "task",
                    label: `Task: ${t.title}${t.assignedOfficer && t.assignedOfficer !== "Unassigned" ? ` (${t.assignedOfficer})` : ""}`,
                });
            }
        });

        return items;
    }, [applications, tasks]);

    const miniCalDays = useMemo(() => {
        const mStart = startOfMonth(calendarMonth);
        const mEnd = endOfMonth(mStart);
        return eachDayOfInterval({ start: startOfWeek(mStart, { weekStartsOn: 1 }), end: endOfWeek(mEnd, { weekStartsOn: 1 }) });
    }, [calendarMonth]);

    const selectedDayDeadlines = useMemo(() => {
        return calendarDeadlines.filter(d => isSameDay(d.date, selectedCalDate));
    }, [calendarDeadlines, selectedCalDate]);

    // Filtered application cards & custom tasks per column
    const filteredBoardData = useMemo(() => {
        const board: Record<string, { apps: any[]; customTasks: any[] }> = {
            pre_screening: { apps: [], customTasks: [] },
            verification: { apps: [], customTasks: [] },
            risk_evaluation: { apps: [], customTasks: [] },
            final_review: { apps: [], customTasks: [] },
            disbursement: { apps: [], customTasks: [] }
        };

        const q = search.toLowerCase();

        mappedApplications.forEach(app => {
            const matchesSearch =
                (app.applicationNumber || "").toLowerCase().includes(q) ||
                (`${app.firstName || ""} ${app.lastName || ""}`).toLowerCase().includes(q) ||
                (app.lanNumber || "").toLowerCase().includes(q) ||
                (app.officer || "").toLowerCase().includes(q);

            if (matchesSearch) {
                if (board[app.stage]) {
                    board[app.stage].apps.push(app);
                } else {
                    board.pre_screening.apps.push(app);
                }
            }
        });

        tasks.forEach(t => {
            const matchesSearch =
                (t.title || "").toLowerCase().includes(q) ||
                (t.description || "").toLowerCase().includes(q) ||
                (t.assignedOfficer || "").toLowerCase().includes(q) ||
                (t.applicationNumber || "").toLowerCase().includes(q) ||
                (t.studentName || "").toLowerCase().includes(q);

            if (matchesSearch) {
                const col = board[t.stage] ? t.stage : "pre_screening";
                board[col].customTasks.push(t);
            }
        });

        return board;
    }, [mappedApplications, tasks, search]);

    const handleReallocateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedApp || !assignedOfficer) return;
        setUpdating(true);

        const reasonLabels: Record<string, string> = {
            load_balancing: "Caseload Load Balancing",
            leave_coverage: "Officer Leave Coverage",
            escalation: "Escalation to Senior Reviewer",
            re_verification: "Failed Verification Audit Re-Route"
        };

        try {
            let cleanRemarks = (selectedApp.remarks || "").replace(/\[Officer:\s*[^\]]+\]\s*/g, "");
            const selectedReasonLabel = reasonLabels[allocationReason] || "Caseload Transfer";
            const updatedRemarks = `[Officer: ${assignedOfficer}] ${cleanRemarks}\n[Task Matrix - ${format(new Date(), "MMM dd, HH:mm")}]: Reallocated to ${assignedOfficer}. Reason: ${selectedReasonLabel}`;

            const res: any = await adminApi.updateApplication(selectedApp.id, {
                remarks: updatedRemarks
            });

            if (res && res.success) {
                setShowReallocateModal(false);
                setSelectedApp(null);
                fetchData(currentBankId);
            }
        } catch (err) {
            console.error("Failed to reallocate task:", err);
            alert("Error reallocating task.");
        } finally {
            setUpdating(false);
        }
    };

    const handleBulkTransferSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sourceOfficer || !targetOfficer || sourceOfficer === targetOfficer) {
            alert("Please select distinct source and target officers");
            return;
        }
        setUpdating(true);

        const casesToTransfer = mappedApplications.filter(app => app.officer === sourceOfficer);
        if (casesToTransfer.length === 0) {
            alert(`No active cases found for ${sourceOfficer}`);
            setUpdating(false);
            return;
        }

        try {
            // Sequential updates for bulk simulation
            for (const app of casesToTransfer) {
                let cleanRemarks = (app.remarks || "").replace(/\[Officer:\s*[^\]]+\]\s*/g, "");
                const updatedRemarks = `[Officer: ${targetOfficer}] ${cleanRemarks}\n[Bulk Transfer - ${format(new Date(), "MMM dd, HH:mm")}]: Bulk caseload re-routed from ${sourceOfficer} due to: ${bulkReason || 'Absence/Leave coverage'}`;

                await adminApi.updateApplication(app.id, {
                    remarks: updatedRemarks
                });
            }

            alert(`Successfully batch-transferred ${casesToTransfer.length} files to ${targetOfficer}`);
            setShowReallocateModal(false);
            setSourceOfficer("");
            setTargetOfficer("");
            setBulkReason("");
            fetchData(currentBankId);
        } catch (err) {
            console.error("Failed executing bulk re-routing:", err);
            alert("An error occurred during bulk caseload re-routing.");
        } finally {
            setUpdating(false);
        }
    };

    if (!mounted) return null;

    return (
        <div className="w-full space-y-8 relative z-10">
            {/* Header */}
            <PageHeader
                title="Task Allocation Matrix"
                description="Monitor verification pipelines, reallocate caseloads, and track credit officer SLA performance in real-time."
                moduleName="Task Matrix"
                icon="assignment_add"
                actionSlot={
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Filter by student, LAN, officer, task..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 pr-4 py-2.5 w-full sm:w-64 bg-white/70 backdrop-blur-md border border-purple-100 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#6605c7] shadow-sm transition-all"
                            />
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base" aria-hidden="true">search</span>
                        </div>
                        <button
                            onClick={() => {
                                setNewTaskDueDate(format(selectedCalDate, "yyyy-MM-dd"));
                                setShowAddTaskModal(true);
                            }}
                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-xs" aria-hidden="true">add_task</span> Add Task
                        </button>
                        <button
                            onClick={() => {
                                setModalTab("bulk");
                                setSourceOfficer("");
                                setTargetOfficer("");
                                setShowReallocateModal(true);
                            }}
                            className="px-4 py-2.5 bg-[#6605c7] hover:bg-[#5203a4] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-xs" aria-hidden="true">group_add</span> Bulk Reallocate
                        </button>
                        <button
                            onClick={() => fetchData(currentBankId)}
                            className="px-4 py-2.5 border border-purple-100 bg-white/70 hover:bg-white text-[10px] font-black uppercase tracking-widest text-[#6605c7] rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-xs" aria-hidden="true">sync</span> Refresh Matrix
                        </button>
                    </div>
                }
            />

            {loading ? (
                <Spinner message="Synchronizing board channels..." />
            ) : (
                <div className="space-y-8 w-full">
                    {/* Workload Targets & Calendar Panel Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* F40: Officer Workload Targets */}
                        <div className="lg:col-span-1 glass-card bg-white/70 p-6 rounded-3xl border border-purple-50 shadow-sm space-y-4 text-left">
                            <div>
                                <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5 font-sans">
                                    <span className="material-symbols-outlined text-[#6605c7] text-base">analytics</span>
                                    Officer Caseload Quotas
                                </h3>
                                <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mt-0.5">Workload status versus monthly targets</p>
                            </div>
                            <div className="space-y-3.5">
                                {(() => {
                                    // Count actual cases + open tasks per officer
                                    const counts: Record<string, number> = {};
                                    officers.forEach(o => counts[o] = 0);
                                    mappedApplications.forEach(app => {
                                        if (app.officer !== "Unassigned" && counts[app.officer] !== undefined) {
                                            counts[app.officer]++;
                                        }
                                    });
                                    tasks.forEach(t => {
                                        if (t.status !== "completed" && t.assignedOfficer && counts[t.assignedOfficer] !== undefined) {
                                            counts[t.assignedOfficer]++;
                                        }
                                    });

                                    const palette = ["bg-[#6605c7]", "bg-indigo-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500"];

                                    return officers.map((off, idx) => {
                                        const cases = counts[off] || 0;
                                        const target = 15;
                                        const pct = Math.min(100, Math.round((cases / target) * 100));
                                        const color = palette[idx % palette.length];

                                        return (
                                            <div key={off} className="space-y-1">
                                                <div className="flex justify-between text-[10px] font-bold text-gray-700">
                                                    <span>{off}</span>
                                                    <span className="font-mono">{cases} / {target} items ({pct}%)</span>
                                                </div>
                                                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                                                    <div className={`${color} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        {/* F44: Dynamic Deadlines & Tasks Calendar Grid */}
                        <div className="lg:col-span-2 glass-card bg-white/70 p-6 rounded-3xl border border-purple-50 shadow-sm space-y-4 text-left">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-1.5 font-sans">
                                        <span className="material-symbols-outlined text-[#6605c7] text-base" aria-hidden="true">calendar_month</span>
                                        Appraisal Expiry & Task Deadlines
                                    </h3>
                                    <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mt-0.5">Live SLA milestones, expiries, and scheduled tasks</p>
                                </div>
                                <div className="flex items-center gap-1.5 bg-white border border-purple-100 rounded-xl p-1">
                                    <button
                                        type="button"
                                        onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
                                        aria-label="Previous month"
                                        className="p-1.5 hover:bg-purple-50 rounded-lg text-gray-600 transition-colors cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-xs" aria-hidden="true">chevron_left</span>
                                    </button>
                                    <span className="px-2.5 text-[10px] font-black uppercase tracking-wider text-gray-800 min-w-[95px] text-center">
                                        {format(calendarMonth, "MMM yyyy")}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                                        aria-label="Next month"
                                        className="p-1.5 hover:bg-purple-50 rounded-lg text-gray-600 transition-colors cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-xs" aria-hidden="true">chevron_right</span>
                                    </button>
                                </div>
                            </div>

                            {/* Dynamic Calendar Grid */}
                            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px]">
                                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                                    <span key={d} className="font-black text-gray-400 uppercase">{d}</span>
                                ))}
                                {miniCalDays.map((dayObj, idx) => {
                                    const dayItems = calendarDeadlines.filter(d => isSameDay(d.date, dayObj));
                                    const hasUrgent = dayItems.some(d => d.kind === "urgent");
                                    const hasWarning = dayItems.some(d => d.kind === "warning");
                                    const hasTask = dayItems.some(d => d.kind === "task");
                                    const isCurrMonth = isSameMonth(dayObj, calendarMonth);
                                    const isSel = isSameDay(dayObj, selectedCalDate);
                                    const isTodayDay = isSameDay(dayObj, new Date());

                                    return (
                                        <button
                                            type="button"
                                            key={idx}
                                            onClick={() => setSelectedCalDate(dayObj)}
                                            className={`p-2 rounded-xl border relative font-semibold transition-all cursor-pointer ${
                                                isSel
                                                    ? "border-[#6605c7] bg-purple-50 text-[#6605c7] font-black ring-1 ring-[#6605c7]/30"
                                                    : hasUrgent
                                                        ? "bg-rose-50 border-rose-200 text-rose-700 font-bold hover:bg-rose-100"
                                                        : hasWarning
                                                            ? "bg-amber-50 border-amber-200 text-amber-700 font-bold hover:bg-amber-100"
                                                            : hasTask
                                                                ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-bold hover:bg-indigo-100"
                                                                : "bg-white/60 border-purple-50 text-gray-700 hover:bg-white"
                                            } ${!isCurrMonth ? "opacity-35" : ""}`}
                                        >
                                            <span className={isTodayDay ? "underline decoration-2 decoration-[#6605c7]" : ""}>
                                                {format(dayObj, "d")}
                                            </span>
                                            {dayItems.length > 0 && (
                                                <span className={`absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ${
                                                    hasUrgent ? "bg-rose-500" : hasWarning ? "bg-amber-500" : "bg-indigo-500"
                                                }`} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Selected Date Inline Deadlines */}
                            <div className="pt-2 border-t border-purple-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="space-y-1 flex-1">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                                        {format(selectedCalDate, "MMM dd, yyyy")} • {selectedDayDeadlines.length} Item(s)
                                    </p>
                                    {selectedDayDeadlines.length === 0 ? (
                                        <p className="text-[11px] text-gray-500 font-medium">No deadlines or tasks scheduled for this date.</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1.5">
                                            {selectedDayDeadlines.slice(0, 4).map(item => (
                                                <span
                                                    key={item.id}
                                                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                                        item.kind === "urgent"
                                                            ? "bg-rose-50 text-rose-700 border-rose-200"
                                                            : item.kind === "warning"
                                                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                                                : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                                    }`}
                                                >
                                                    {item.label}
                                                </span>
                                            ))}
                                            {selectedDayDeadlines.length > 4 && (
                                                <span className="text-[10px] font-bold text-gray-400">+{selectedDayDeadlines.length - 4} more</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNewTaskDueDate(format(selectedCalDate, "yyyy-MM-dd"));
                                        setShowAddTaskModal(true);
                                    }}
                                    className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-[#6605c7] text-[9px] font-black uppercase tracking-wider rounded-xl border border-purple-200 transition-all shrink-0 cursor-pointer"
                                >
                                    + Add Task Here
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Board Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 overflow-x-auto pb-4 no-scrollbar">
                        {COLUMNS.map((col) => {
                            const colBucket = filteredBoardData[col.id] || { apps: [], customTasks: [] };
                            const cards = colBucket.apps;
                            const colTasks = colBucket.customTasks;
                            const totalCount = cards.length + colTasks.length;
                            return (
                                <div key={col.id} className="flex flex-col min-w-[240px] bg-white/40 border border-purple-100/40 rounded-3xl p-4 min-h-[500px]">
                                    {/* Column Header */}
                                    <div className="flex justify-between items-center mb-4 px-2">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-purple-600 text-sm" aria-hidden="true">{col.icon}</span>
                                            <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">{col.label}</span>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black bg-purple-50 text-[#6605c7]">
                                            {totalCount}
                                        </span>
                                    </div>

                                    {/* Cards Stack */}
                                    <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] no-scrollbar">
                                        {totalCount === 0 ? (
                                            <div className="h-28 border border-dashed border-purple-100 rounded-2xl flex flex-col items-center justify-center p-3 text-center">
                                                <span className="material-symbols-outlined text-gray-300 text-xl" aria-hidden="true">folder_off</span>
                                                <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mt-1">Empty Column</span>
                                            </div>
                                        ) : (
                                            <>
                                                {colTasks.map((task) => (
                                                    <motion.div
                                                        key={`task-${task.id}`}
                                                        whileHover={{ y: -2 }}
                                                        className={`p-3.5 rounded-2xl border-l-4 bg-white border border-indigo-100 transition-all shadow-sm space-y-2 ${task.status === "completed" ? "opacity-60 border-l-emerald-500" : "border-l-indigo-500"
                                                            }`}
                                                    >
                                                        <div className="flex justify-between items-start gap-2">
                                                            <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[8px] font-black uppercase tracking-wider border border-indigo-100">
                                                                Task
                                                            </span>
                                                            <PriorityTag priority={task.priority || "medium"} />
                                                        </div>
                                                        <h4 className={`text-xs font-black text-gray-900 leading-snug ${task.status === "completed" ? "line-through" : ""}`}>
                                                            {task.title}
                                                        </h4>
                                                        {task.description && (
                                                            <p className="text-[10px] text-gray-500 line-clamp-2">{task.description}</p>
                                                        )}
                                                        {task.applicationNumber && (
                                                            <p className="text-[9px] font-mono font-bold text-[#6605c7]">
                                                                {task.applicationNumber} {task.studentName ? `• ${task.studentName}` : ""}
                                                            </p>
                                                        )}
                                                        <div className="flex items-center justify-between text-[9px] text-gray-500 font-bold pt-1 border-t border-gray-100">
                                                            <span className="truncate">{task.assignedOfficer || "Unassigned"}</span>
                                                            {task.dueDate && <span>Due {format(new Date(task.dueDate), "MMM dd")}</span>}
                                                        </div>
                                                        <div className="flex items-center justify-between gap-1.5 pt-1">
                                                            <select
                                                                value={task.stage}
                                                                onChange={(e) => handleMoveTaskStage(task, e.target.value)}
                                                                aria-label="Move task stage"
                                                                className="text-[9px] font-bold bg-gray-50 border border-gray-200 rounded-lg px-1.5 py-1 text-gray-700 focus:outline-none"
                                                            >
                                                                {COLUMNS.map(c => (
                                                                    <option key={c.id} value={c.id}>{c.label}</option>
                                                                ))}
                                                            </select>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleTaskStatus(task)}
                                                                    title={task.status === "completed" ? "Reopen task" : "Mark completed"}
                                                                    className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[9px] font-black cursor-pointer"
                                                                >
                                                                    {task.status === "completed" ? "Reopen" : "Done"}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteTask(task.id)}
                                                                    title="Delete task"
                                                                    aria-label="Delete task"
                                                                    className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer"
                                                                >
                                                                    <span className="material-symbols-outlined text-[13px]" aria-hidden="true">delete</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                                {cards.map((app) => {
                                                    const isUrgent = app.officer === "Unassigned";
                                                    return (
                                                        <motion.div
                                                            key={app.id}
                                                            layoutId={`card-${app.id}`}
                                                            whileHover={{ y: -3, scale: 1.01 }}
                                                            className={`glass-card p-4 rounded-2xl border-l-4 bg-white/90 border border-purple-50 hover:border-purple-100/80 transition-all select-none ${col.color} cursor-pointer shadow-sm shadow-purple-955`}
                                                            onClick={() => {
                                                                setSelectedApp(app);
                                                                setAssignedOfficer(app.officer === "Unassigned" ? "" : app.officer);
                                                                setModalTab("single");
                                                                setShowReallocateModal(true);
                                                            }}
                                                        >
                                                            <div className="flex justify-between items-start gap-2 mb-2">
                                                                <span className="text-[9.5px] font-black text-gray-900 font-mono tracking-tight">{app.applicationNumber}</span>
                                                                <PriorityTag priority={isUrgent ? "high" : "medium"} />
                                                            </div>

                                                            <h4 className="text-xs font-black text-gray-800 uppercase tracking-tight truncate">
                                                                {app.firstName} {app.lastName}
                                                            </h4>
                                                            <p className="text-[9px] text-gray-405 font-semibold truncate mt-0.5">{app.universityName}</p>

                                                            <div className="border-t border-purple-50/50 mt-3 pt-3 flex justify-between items-center">
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <div className="w-5 h-5 rounded-full bg-[#6605c7]/10 flex items-center justify-center text-[#6605c7] text-[8px] font-black">
                                                                        {app.officer[0]}
                                                                    </div>
                                                                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider truncate">
                                                                        {app.officer}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[8px] font-black text-[#6605c7] shrink-0">
                                                                    ₹{app.amount ? Math.round(app.amount / 100000) : 0}L
                                                                </span>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Add Task Modal */}
            <AnimatePresence>
                {showAddTaskModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setShowAddTaskModal(false)} />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-[2rem] border border-gray-100 shadow-2xl p-8 max-w-lg w-full z-10 relative overflow-hidden"
                        >
                            <h3 className="text-xl font-black text-gray-900 mb-1 uppercase tracking-tight">Add Bank Task</h3>
                            <p className="text-[9.5px] font-black text-[#6605c7] uppercase tracking-widest mb-5">
                                Create an actionable task synced with Task Matrix & Calendar
                            </p>

                            <form onSubmit={handleCreateTask} className="space-y-4">
                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Task Title *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Verify co-applicant ITR & bank statement"
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#6605c7] text-gray-800"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Pipeline Stage</label>
                                        <select
                                            value={newTaskStage}
                                            onChange={(e) => setNewTaskStage(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                        >
                                            {COLUMNS.map(c => (
                                                <option key={c.id} value={c.id}>{c.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Priority</label>
                                        <select
                                            value={newTaskPriority}
                                            onChange={(e) => setNewTaskPriority(e.target.value as any)}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                        >
                                            <option value="high">High</option>
                                            <option value="medium">Medium</option>
                                            <option value="low">Low</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Assign Officer</label>
                                        <select
                                            value={newTaskOfficer}
                                            onChange={(e) => setNewTaskOfficer(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                        >
                                            <option value="">Unassigned</option>
                                            {officers.map(off => (
                                                <option key={off} value={off}>{off}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Due Date</label>
                                        <input
                                            type="date"
                                            required
                                            value={newTaskDueDate}
                                            onChange={(e) => setNewTaskDueDate(e.target.value)}
                                            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Link Application (Optional)</label>
                                    <select
                                        value={newTaskAppId}
                                        onChange={(e) => setNewTaskAppId(e.target.value)}
                                        className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                    >
                                        <option value="">None (General Bank Task)</option>
                                        {applications.map(app => (
                                            <option key={app.id} value={app.id}>
                                                {app.applicationNumber || app.lanNumber || app.id} — {app.firstName} {app.lastName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Notes</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Optional instructions or checklist details..."
                                        value={newTaskDesc}
                                        onChange={(e) => setNewTaskDesc(e.target.value)}
                                        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#6605c7] text-gray-700"
                                    />
                                </div>

                                <div className="flex gap-4 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddTaskModal(false)}
                                        className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={creatingTask}
                                        className="flex-1 py-3 bg-[#6605c7] hover:bg-[#8b24e5] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all cursor-pointer"
                                    >
                                        {creatingTask ? "Saving..." : "Create Task"}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Reallocate Task Modal */}
            <AnimatePresence>
                {showReallocateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm" onClick={() => setShowReallocateModal(false)} />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-[2rem] border border-gray-100 shadow-2xl p-8 max-w-md w-full z-10 relative overflow-hidden"
                        >
                            {/* Modal Tabs */}
                            <div className="flex border-b border-gray-150 mb-6 p-1 bg-gray-50 rounded-2xl">
                                <button
                                    type="button"
                                    onClick={() => setModalTab("single")}
                                    className={`flex-1 py-2 text-center text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${modalTab === "single"
                                        ? "bg-white text-[#6605c7] shadow-sm border border-purple-100/50"
                                        : "text-gray-400 hover:text-gray-600"
                                        }`}
                                >
                                    Single Allocation
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setModalTab("bulk")}
                                    className={`flex-1 py-2 text-center text-[10px] font-black uppercase tracking-wider rounded-xl transition-all ${modalTab === "bulk"
                                        ? "bg-white text-[#6605c7] shadow-sm border border-purple-100/50"
                                        : "text-gray-400 hover:text-gray-600"
                                        }`}
                                >
                                    Bulk transfer (Leave)
                                </button>
                            </div>

                            {modalTab === "single" && selectedApp && (
                                <>
                                    <h3 className="text-xl font-black text-gray-900 mb-1 uppercase tracking-tight">Allocate Single Operation</h3>
                                    <p className="text-[9.5px] font-black text-[#6605c7] uppercase tracking-widest mb-6 font-mono">
                                        File: {selectedApp.applicationNumber} • Amt: ₹{selectedApp.amount?.toLocaleString()}
                                    </p>

                                    <form onSubmit={handleReallocateSubmit} className="space-y-4">
                                        <div>
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Assign Credit Officer</label>
                                            <select
                                                required
                                                value={assignedOfficer}
                                                onChange={(e) => setAssignedOfficer(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                            >
                                                <option value="">Select Officer...</option>
                                                {officers.map((off) => (
                                                    <option key={off} value={off}>{off}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Transfer Reason Criterion</label>
                                            <select
                                                required
                                                value={allocationReason}
                                                onChange={(e) => setAllocationReason(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                            >
                                                <option value="load_balancing">Caseload Load Balancing</option>
                                                <option value="leave_coverage">Officer Absence / Leave Coverage</option>
                                                <option value="escalation">Escalation to Senior Reviewer</option>
                                                <option value="re_verification">Verification Audit Re-Route</option>
                                            </select>
                                        </div>

                                        <div className="flex gap-4 pt-3">
                                            <button
                                                type="button"
                                                onClick={() => setShowReallocateModal(false)}
                                                className="flex-1 py-3 border border-gray-200 text-gray-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all font-sans"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={updating}
                                                className="flex-1 py-3 bg-[#6605c7] hover:bg-[#8b24e5] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-500/10 transition-all flex items-center justify-center font-sans"
                                            >
                                                {updating ? "Allocating..." : "Assign Task"}
                                            </button>
                                        </div>
                                    </form>
                                </>
                            )}

                            {modalTab === "bulk" && (
                                <>
                                    <h3 className="text-xl font-black text-gray-900 mb-1 uppercase tracking-tight">Bulk Caseload Re-Routing</h3>
                                    <p className="text-[9.5px] font-black text-[#6605c7] uppercase tracking-widest mb-6">
                                        Batch re-route cases due to officer leaves or absence.
                                    </p>

                                    <form onSubmit={handleBulkTransferSubmit} className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Source Officer (On Leave)</label>
                                                <select
                                                    required
                                                    value={sourceOfficer}
                                                    onChange={(e) => setSourceOfficer(e.target.value)}
                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                                >
                                                    <option value="">Select...</option>
                                                    {officers.map((off) => (
                                                        <option key={off} value={off}>{off}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Target Recipient</label>
                                                <select
                                                    required
                                                    value={targetOfficer}
                                                    onChange={(e) => setTargetOfficer(e.target.value)}
                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                                >
                                                    <option value="">Select...</option>
                                                    {officers.filter(o => o !== sourceOfficer).map((off) => (
                                                        <option key={off} value={off}>{off}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Transfer Memo Reason</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Coverage for Sneha Nair's medical leave (2 weeks)"
                                                value={bulkReason}
                                                onChange={e => setBulkReason(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                            />
                                        </div>

                                        <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100/50 text-[9.5px] text-gray-550 font-semibold leading-relaxed">
                                            Warning: Re-routing bulk operations updates the active pipeline cards for all active folders currently assigned to the source officer.
                                        </div>

                                        <div className="flex gap-4 pt-3">
                                            <button
                                                type="button"
                                                onClick={() => setShowReallocateModal(false)}
                                                className="flex-1 py-3 border border-gray-200 text-gray-505 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all font-sans"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={updating}
                                                className="flex-1 py-3 bg-[#6605c7] hover:bg-[#8b24e5] text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-500/10 transition-all flex items-center justify-center font-sans"
                                            >
                                                {updating ? "Executing..." : "Execute Bulk Transfer"}
                                            </button>
                                        </div>
                                    </form>
                                </>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
