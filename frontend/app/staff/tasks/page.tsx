"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi, staffProfileApi } from "@/lib/api";
import { formatNoteTime } from "@/lib/utils";

interface FollowUp {
    date: string;
    time: string;
    studentName: string;
    appNumber: string;
    notes?: string;
}

export default function RemindersPage() {
    const router = useRouter();
    const { user } = useAuth();

    // Follow-up reminders
    const [followUps, setFollowUps] = useState<Record<string, FollowUp>>({});
    const [studentFollowUps, setStudentFollowUps] = useState<any[]>([]);
    const [filterUpcoming, setFilterUpcoming] = useState<"all" | "today" | "upcoming" | "overdue">("all");

    // Notes modal state
    const [selectedFollowUp, setSelectedFollowUp] = useState<any | null>(null);
    const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
    const [notesList, setNotesList] = useState<any[]>([]);
    const [loadingNotes, setLoadingNotes] = useState(false);
    const [newNoteText, setNewNoteText] = useState("");
    const [savingNote, setSavingNote] = useState(false);

    // Fetch comments/notes from active application
    const fetchApplicationNotes = async (appId?: string, currentFuNotes?: string) => {
        if (!appId) {
            setNotesList([]);
            setLoadingNotes(false);
            return;
        }
        setLoadingNotes(true);
        try {
            const res = await adminApi.getRemarks(appId) as any;
            let backendNotes: any[] = [];
            if (res && res.success && Array.isArray(res.data)) {
                backendNotes = res.data.filter((r: any) => r.isInternal === true || r.type === "note" || r.type === "admin_note" || r.type === "staff_note");
            } else if (Array.isArray(res)) {
                backendNotes = res.filter((r: any) => r.isInternal === true || r.type === "note" || r.type === "admin_note" || r.type === "staff_note");
            }

            // Sync current local follow-up notes to backend if they are missing
            if (currentFuNotes && currentFuNotes.trim()) {
                const alreadyExists = backendNotes.some(
                    (note: any) => (note.content || note.remark || "").trim() === currentFuNotes.trim()
                );
                if (!alreadyExists) {
                    try {
                        await adminApi.addRemark(appId, {
                            type: "note",
                            content: currentFuNotes.trim(),
                            authorName: "Staff Member",
                            isInternal: true,
                        } as any);

                        // Re-fetch remarks after syncing
                        const reRes = await adminApi.getRemarks(appId) as any;
                        if (reRes && reRes.success && Array.isArray(reRes.data)) {
                            backendNotes = reRes.data.filter((r: any) => r.isInternal === true || r.type === "note" || r.type === "admin_note" || r.type === "staff_note");
                        } else if (Array.isArray(reRes)) {
                            backendNotes = reRes.filter((r: any) => r.isInternal === true || r.type === "note" || r.type === "admin_note" || r.type === "staff_note");
                        }
                    } catch (syncErr) {
                        console.error("Failed to auto-sync local notes to backend:", syncErr);
                    }
                }
            }

            setNotesList(backendNotes);
        } catch (err) {
            console.error("Failed to fetch application notes:", err);
            setNotesList([]);
        } finally {
            setLoadingNotes(false);
        }
    };

    const handleOpenNotes = (fu: any) => {
        setSelectedFollowUp(fu);
        setIsNotesModalOpen(true);
        setNewNoteText("");
        fetchApplicationNotes(fu.appId, fu.notes);
    };

    const handleSaveNote = async () => {
        if (!selectedFollowUp || !newNoteText.trim()) return;
        setSavingNote(true);
        try {
            if (selectedFollowUp.appId) {
                // Save note to the application via backend
                await adminApi.addRemark(selectedFollowUp.appId, {
                    type: "note",
                    content: newNoteText.trim(),
                    authorName: "Staff Member",
                    isInternal: true,
                } as any);
            }

            if (selectedFollowUp.isStudent) {
                // Update the note in the student's follow-up list in local storage
                const staffId = user?.id || user?.email || "default";
                const studentId = selectedFollowUp.studentId;
                const key = `follow_ups_${staffId}_${studentId}`;
                const stored = localStorage.getItem(key);
                if (stored) {
                    try {
                        const parsed = JSON.parse(stored) as any[];
                        const updated = parsed.map(f => {
                            if (f.id === selectedFollowUp.id) {
                                return { ...f, notes: newNoteText.trim() };
                            }
                            return f;
                        });
                        localStorage.setItem(key, JSON.stringify(updated));
                    } catch (e) {
                        console.error(e);
                    }
                }
                loadAllReminders();
            } else {
                // Sync with local storage follow-up notes
                const updated = {
                    ...followUps,
                    [selectedFollowUp.appId]: {
                        ...followUps[selectedFollowUp.appId],
                        notes: newNoteText.trim()
                    }
                };
                setFollowUps(updated);
                localStorage.setItem(followUpKey, JSON.stringify(updated));
            }

            // Reload notes in the modal view
            setNewNoteText("");
            staffProfileApi.logActivity({
                type: "update",
                msg: `Updated follow-up task note for ${selectedFollowUp.studentName || 'Student'}`,
                icon: "event_available",
                color: "bg-indigo-50 text-indigo-700"
            }).catch(console.error);

            await fetchApplicationNotes(selectedFollowUp.appId);
        } catch (err) {
            console.error("Failed to save note:", err);
            alert("Failed to save note. Please try again.");
        } finally {
            setSavingNote(false);
        }
    };

    // Calendar state
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [calendarView, setCalendarView] = useState<"month" | "week" | "day">("month");

    const followUpKey = user?.id
        ? `staff_follow_up_dates_${user.id}`
        : user?.email
            ? `staff_follow_up_dates_${user.email}`
            : `staff_follow_up_dates_default`;

    // Load follow-up reminders
    const loadAllReminders = () => {
        try {
            const saved = localStorage.getItem(followUpKey);
            if (saved) {
                setFollowUps(JSON.parse(saved));
            } else {
                setFollowUps({});
            }
        } catch (e) {
            console.error(e);
        }

        try {
            const staffId = user?.id || user?.email || "default";
            const tempStudentFus: any[] = [];
            if (typeof window !== "undefined") {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(`follow_ups_${staffId}_`)) {
                        const studentId = key.substring(`follow_ups_${staffId}_`.length);
                        const stored = localStorage.getItem(key);
                        if (stored) {
                            try {
                                const parsed = JSON.parse(stored);
                                if (Array.isArray(parsed)) {
                                    parsed.forEach((fu: any) => {
                                        if (fu.status === "pending") {
                                            tempStudentFus.push({
                                                ...fu,
                                                studentId,
                                                isStudent: true
                                            });
                                        }
                                    });
                                }
                            } catch (e) {
                                console.error("Failed to parse student follow up:", e);
                            }
                        }
                    }
                }
            }
            setStudentFollowUps(tempStudentFus);
        } catch (e) {
            console.error("Failed to load student follow ups:", e);
        }
    };

    useEffect(() => {
        loadAllReminders();
    }, [followUpKey]);

    const clearFollowUp = (fu: any) => {
        if (fu.isStudent) {
            const staffId = user?.id || user?.email || "default";
            const studentId = fu.studentId;
            const key = `follow_ups_${staffId}_${studentId}`;
            const stored = localStorage.getItem(key);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored) as any[];
                    const updated = parsed.map(f => {
                        if (f.id === fu.id) {
                            return { ...f, status: "completed" };
                        }
                        return f;
                    });
                    localStorage.setItem(key, JSON.stringify(updated));
                } catch (e) {
                    console.error("Failed to update student follow-up status:", e);
                }
            }
            loadAllReminders();
        } else {
            const appId = fu.appId || fu.id;
            const updated = { ...followUps };
            delete updated[appId];
            setFollowUps(updated);
            localStorage.setItem(followUpKey, JSON.stringify(updated));
        }
    };

    // Classify follow-ups
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const appEntries = Object.entries(followUps).map(([appId, fu]) => {
        const timePart = fu.time && fu.time.includes(":") ? fu.time : "00:00";
        const d = new Date(`${fu.date}T${timePart}:00`);
        const dayOnly = new Date(fu.date + "T00:00:00");
        const isToday = dayOnly.getTime() === today.getTime();
        const isOverdue = dayOnly < today;
        const isUpcoming = dayOnly >= tomorrow;
        return {
            id: appId,
            appId,
            ...fu,
            dateObj: d,
            isToday,
            isOverdue,
            isUpcoming,
            isStudent: false
        };
    });

    const studEntries = studentFollowUps.map((fu) => {
        const timePart = fu.time && fu.time.includes(":") ? fu.time : "00:00";
        const d = new Date(`${fu.date}T${timePart}:00`);
        const dayOnly = new Date(fu.date + "T00:00:00");
        const isToday = dayOnly.getTime() === today.getTime();
        const isOverdue = dayOnly < today;
        const isUpcoming = dayOnly >= tomorrow;
        return {
            id: fu.id,
            studentId: fu.studentId,
            ...fu,
            dateObj: d,
            isToday,
            isOverdue,
            isUpcoming,
            isStudent: true
        };
    });

    const allFollowUpEntries = [...appEntries, ...studEntries].sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    const filteredFollowUps = allFollowUpEntries.filter(fu => {
        if (filterUpcoming === "today") return fu.isToday;
        if (filterUpcoming === "overdue") return fu.isOverdue;
        if (filterUpcoming === "upcoming") return fu.isUpcoming;
        return true;
    });

    const counts = {
        all: allFollowUpEntries.length,
        today: allFollowUpEntries.filter(f => f.isToday).length,
        overdue: allFollowUpEntries.filter(f => f.isOverdue).length,
        upcoming: allFollowUpEntries.filter(f => f.isUpcoming).length,
    };

    const formatDateLabel = (fu: typeof allFollowUpEntries[0]) => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const d = fu.dateObj;
        return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
    };

    const statusChip = (fu: typeof allFollowUpEntries[0]) => {
        if (fu.isOverdue) return { label: "Overdue", cls: "bg-rose-50 text-rose-700 border-rose-100" };
        if (fu.isToday) return { label: "Today", cls: "bg-amber-50 text-amber-700 border-amber-100" };
        return { label: "Upcoming", cls: "bg-emerald-50 text-emerald-700 border-emerald-100" };
    };

    // --- Calendar helpers ---
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const calYear = calendarDate.getFullYear();
    const calMonth = calendarDate.getMonth();

    const firstDayOfMonth = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(calYear, calMonth, 0).getDate();

    // Build follow-up map by date string "YYYY-MM-DD"
    const followUpsByDate: Record<string, typeof allFollowUpEntries> = {};
    allFollowUpEntries.forEach(fu => {
        const key = fu.date;
        if (!followUpsByDate[key]) followUpsByDate[key] = [];
        followUpsByDate[key].push(fu);
    });

    const toDateKey = (y: number, m: number, d: number) =>
        `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    const formatDateKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    // Dynamic Navigation handlers based on selected calendarView
    const handlePrev = () => {
        if (calendarView === "month") {
            setCalendarDate(new Date(calYear, calMonth - 1, Math.min(calendarDate.getDate(), 28)));
        } else if (calendarView === "week") {
            const nextD = new Date(calendarDate);
            nextD.setDate(nextD.getDate() - 7);
            setCalendarDate(nextD);
        } else {
            const nextD = new Date(calendarDate);
            nextD.setDate(nextD.getDate() - 1);
            setCalendarDate(nextD);
        }
    };

    const handleNext = () => {
        if (calendarView === "month") {
            setCalendarDate(new Date(calYear, calMonth + 1, Math.min(calendarDate.getDate(), 28)));
        } else if (calendarView === "week") {
            const nextD = new Date(calendarDate);
            nextD.setDate(nextD.getDate() + 7);
            setCalendarDate(nextD);
        } else {
            const nextD = new Date(calendarDate);
            nextD.setDate(nextD.getDate() + 1);
            setCalendarDate(nextD);
        }
    };

    const goToday = () => setCalendarDate(new Date());

    // Build calendar grid cells for Month View
    const cells: { day: number; month: "prev" | "current" | "next"; dateKey: string; dateObj: Date }[] = [];
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        const d = daysInPrevMonth - i;
        const m = calMonth - 1 < 0 ? 11 : calMonth - 1;
        const y = calMonth - 1 < 0 ? calYear - 1 : calYear;
        cells.push({ day: d, month: "prev", dateKey: toDateKey(y, m, d), dateObj: new Date(y, m, d) });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        cells.push({ day: d, month: "current", dateKey: toDateKey(calYear, calMonth, d), dateObj: new Date(calYear, calMonth, d) });
    }
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
        const m = calMonth + 1 > 11 ? 0 : calMonth + 1;
        const y = calMonth + 1 > 11 ? calYear + 1 : calYear;
        cells.push({ day: d, month: "next", dateKey: toDateKey(y, m, d), dateObj: new Date(y, m, d) });
    }

    const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate());

    // Week number helper
    const getWeekNumber = (d: Date) => {
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const diff = d.getTime() - startOfYear.getTime();
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        return Math.ceil((diff / oneWeek) + startOfYear.getDay() / 7);
    };

    // Calculate 7 days for Week View (Sunday to Saturday)
    const getWeekDays = (baseDate: Date) => {
        const d = new Date(baseDate);
        const dayOfWeek = d.getDay();
        const sun = new Date(d);
        sun.setDate(d.getDate() - dayOfWeek);
        const weekDays: Date[] = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(sun);
            day.setDate(sun.getDate() + i);
            weekDays.push(day);
        }
        return weekDays;
    };
    const weekDays = getWeekDays(calendarDate);
    const weekStart = weekDays[0];
    const weekEnd = weekDays[6];

    const currentWeekNum = getWeekNumber(calendarDate);
    const startWeek = getWeekNumber(new Date(calYear, calMonth, 1));
    const endWeek = getWeekNumber(new Date(calYear, calMonth, daysInMonth));

    // Dynamic header titles
    let headerTitle = `${MONTHS[calMonth]} ${calYear}`;
    let headerSub = `/ WEEK ${startWeek} – ${endWeek}`;

    if (calendarView === "week") {
        const startMonthName = MONTHS[weekStart.getMonth()].substring(0, 3);
        const endMonthName = MONTHS[weekEnd.getMonth()].substring(0, 3);
        headerTitle = `${startMonthName} ${weekStart.getDate()} – ${endMonthName} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
        headerSub = `/ WEEK ${currentWeekNum}`;
    } else if (calendarView === "day") {
        headerTitle = `${MONTHS[calMonth]} ${calendarDate.getDate()}, ${calYear}`;
        headerSub = `/ ${DAYS[calendarDate.getDay()].toUpperCase()}`;
    }

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-[28px] tracking-tight flex items-center gap-3 font-['Playfair_Display',serif] font-bold text-[#0d1b2a]">
                        Reminders
                        {counts.overdue > 0 && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-[11px] font-semibold text-rose-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                {counts.overdue} Overdue
                            </span>
                        )}
                    </h2>
                    <p className="text-slate-500 text-[13px] mt-1 font-medium">All your scheduled follow-ups in one place.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left 2 columns: Calendar */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {/* Calendar toolbar */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-indigo-500 text-[20px]">calendar_month</span>
                                <div>
                                    <span className="text-[13px] font-black text-slate-800 uppercase tracking-wider">
                                        {headerTitle}
                                    </span>
                                    <span className="ml-2 text-[10px] text-slate-400 font-semibold">
                                        {headerSub}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={handlePrev} title={`Previous ${calendarView}`} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-all cursor-pointer">
                                    <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                                </button>
                                <button onClick={goToday} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-widest border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 transition-all cursor-pointer">
                                    Today
                                </button>
                                <button onClick={handleNext} title={`Next ${calendarView}`} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 transition-all cursor-pointer">
                                    <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                </button>
                                <div className="flex border border-slate-200 rounded-lg overflow-hidden ml-2">
                                    {(["month", "week", "day"] as const).map(v => (
                                        <button key={v} onClick={() => setCalendarView(v)}
                                            className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wide transition-all cursor-pointer ${calendarView === v ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                                            {v}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="px-6 py-2 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Legend</span>
                                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
                                    <span className="w-2.5 h-2 rounded-full bg-rose-500" />
                                    Follow-up Schedules
                                </span>
                            </div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                {calendarView} view
                            </span>
                        </div>

                        {/* MONTH VIEW */}
                        {calendarView === "month" && (
                            <>
                                <div className="grid grid-cols-7 border-b border-slate-100">
                                    {DAYS.map(d => (
                                        <div key={d} className="py-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                                            {d}
                                        </div>
                                    ))}
                                </div>

                                <div className="grid grid-cols-7" style={{ minHeight: 420 }}>
                                    {cells.map((cell, idx) => {
                                        const isCurrentMonth = cell.month === "current";
                                        const isToday = cell.dateKey === todayKey;
                                        const isSelected = cell.dateKey === formatDateKey(calendarDate);
                                        const events = followUpsByDate[cell.dateKey] || [];
                                        return (
                                            <div
                                                key={idx}
                                                onClick={() => {
                                                    setCalendarDate(cell.dateObj);
                                                }}
                                                className={`min-h-[70px] p-1.5 border-b border-r border-slate-100 transition-all cursor-pointer ${isCurrentMonth ? (isSelected ? 'bg-indigo-50/40' : 'bg-white hover:bg-slate-50/80') : 'bg-slate-50/40'} ${idx % 7 === 6 ? 'border-r-0' : ''}`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <div className={`w-7 h-7 flex items-center justify-center rounded-full text-[12px] font-bold ${isToday ? 'bg-indigo-600 text-white' : isCurrentMonth ? 'text-slate-700' : 'text-slate-300'}`}>
                                                        {cell.day}
                                                    </div>
                                                    {events.length > 0 && (
                                                        <span className="w-2 h-2 rounded-full bg-rose-500" title={`${events.length} schedule(s)`} />
                                                    )}
                                                </div>
                                                <div className="space-y-0.5">
                                                    {events.slice(0, 3).map(ev => {
                                                        const displayId = ev.appNumber || ev.id;
                                                        return (
                                                            <button
                                                                key={ev.id}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (ev.isStudent) {
                                                                        router.push(`/staff/users/${ev.studentId}/follow-ups`);
                                                                    } else {
                                                                        router.push(`/staff/applications/${ev.appId}`);
                                                                    }
                                                                }}
                                                                title={`${ev.studentName ? ev.studentName + " — " : ""}${displayId}`}
                                                                className="w-full text-left px-1 py-0.5 rounded text-[8px] font-mono font-extrabold leading-tight flex items-start gap-1 bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 transition-all cursor-pointer shadow-2xs"
                                                            >
                                                                <span className="material-symbols-outlined text-[9px] shrink-0 text-rose-600">calendar_today</span>
                                                                <span className="break-all tracking-tighter leading-tight">{displayId}</span>
                                                            </button>
                                                        );
                                                    })}
                                                    {events.length > 3 && (
                                                        <span className="text-[8px] text-slate-400 font-bold pl-1 block">+{events.length - 3} more</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {/* WEEK VIEW */}
                        {calendarView === "week" && (
                            <>
                                <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/40">
                                    {weekDays.map(d => {
                                        const dateKey = formatDateKey(d);
                                        const isTodayDate = dateKey === todayKey;
                                        const isSelectedDate = dateKey === formatDateKey(calendarDate);
                                        return (
                                            <div
                                                key={d.toISOString()}
                                                onClick={() => setCalendarDate(d)}
                                                className={`py-2.5 text-center border-r border-slate-100 last:border-r-0 cursor-pointer transition-all ${isSelectedDate ? 'bg-indigo-50/60' : 'hover:bg-slate-100/50'}`}
                                            >
                                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{DAYS[d.getDay()]}</p>
                                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold mt-0.5 transition-all ${isTodayDate ? 'bg-indigo-600 text-white shadow-sm' : isSelectedDate ? 'bg-indigo-100 text-indigo-700' : 'text-slate-700'}`}>
                                                    {d.getDate()}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="grid grid-cols-7" style={{ minHeight: 420 }}>
                                    {weekDays.map((d) => {
                                        const dateKey = formatDateKey(d);
                                        const isTodayDate = dateKey === todayKey;
                                        const isSelectedDate = dateKey === formatDateKey(calendarDate);
                                        const events = followUpsByDate[dateKey] || [];
                                        return (
                                            <div
                                                key={dateKey}
                                                className={`min-h-[420px] p-2 border-r border-slate-100 last:border-r-0 transition-all ${isSelectedDate ? 'bg-indigo-50/15' : isTodayDate ? 'bg-slate-50/30' : 'bg-white'}`}
                                            >
                                                <div className="space-y-2">
                                                    {events.map(ev => (
                                                        <div
                                                            key={ev.id}
                                                            className="p-2 rounded-xl border bg-rose-50/90 border-rose-200 text-rose-900 shadow-sm space-y-1.5 transition-all hover:shadow"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[8px] font-black text-rose-600 flex items-center gap-0.5">
                                                                    <span className="material-symbols-outlined text-[10px]">schedule</span>
                                                                    {ev.time || "Follow-up"}
                                                                </span>
                                                                <span className="px-1.5 py-0.5 rounded text-[8.5px] font-mono font-extrabold bg-rose-100/90 border border-rose-300 text-rose-900 tracking-tighter shrink-0" title={ev.appNumber || ev.id}>
                                                                    {ev.appNumber || ev.id}
                                                                </span>
                                                            </div>
                                                            <p className="text-[10px] font-extrabold text-slate-800 truncate">{ev.studentName}</p>
                                                            {ev.notes && (
                                                                <p className="text-[9px] text-slate-600 font-medium line-clamp-2 bg-white/80 p-1 rounded border border-rose-100">
                                                                    {ev.notes}
                                                                </p>
                                                            )}
                                                            <div className="flex items-center gap-1 pt-1 border-t border-rose-200/60">
                                                                <button
                                                                    onClick={() => {
                                                                        if (ev.isStudent) {
                                                                            router.push(`/staff/users/${ev.studentId}/follow-ups`);
                                                                        } else {
                                                                            router.push(`/staff/applications/${ev.appId}`);
                                                                        }
                                                                    }}
                                                                    className="px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[8px] font-bold transition-all cursor-pointer"
                                                                >
                                                                    View
                                                                </button>
                                                                <button
                                                                    onClick={() => handleOpenNotes(ev)}
                                                                    className="px-1.5 py-0.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded text-[8px] font-bold transition-all cursor-pointer"
                                                                >
                                                                    Notes
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {events.length === 0 && (
                                                        <div className="py-12 text-center">
                                                            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300">No tasks</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {/* DAY VIEW */}
                        {calendarView === "day" && (() => {
                            const dateKey = formatDateKey(calendarDate);
                            const dayEvents = followUpsByDate[dateKey] || [];
                            const isTodayDate = dateKey === todayKey;

                            return (
                                <div className="p-6 space-y-6" style={{ minHeight: 420 }}>
                                    {/* Day Header Banner */}
                                    <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50 via-slate-50 to-white border border-indigo-100 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold ${isTodayDate ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-slate-800 border border-slate-200'}`}>
                                                <span className="text-[9px] uppercase font-black tracking-wider opacity-80">{DAYS[calendarDate.getDay()]}</span>
                                                <span className="text-lg leading-none font-black">{calendarDate.getDate()}</span>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-extrabold text-slate-900">
                                                    {MONTHS[calendarDate.getMonth()]} {calendarDate.getDate()}, {calendarDate.getFullYear()}
                                                </h4>
                                                <p className="text-[11px] text-slate-500 font-semibold">
                                                    {dayEvents.length} follow-up schedule{dayEvents.length !== 1 ? 's' : ''} for this date
                                                </p>
                                            </div>
                                        </div>
                                        {isTodayDate && (
                                            <span className="px-3 py-1 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm">
                                                Today
                                            </span>
                                        )}
                                    </div>

                                    {/* Event List for the Day */}
                                    <div className="space-y-3">
                                        {dayEvents.length === 0 ? (
                                            <div className="py-16 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                                                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2 block">event_available</span>
                                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">No Follow-ups Scheduled</p>
                                                <p className="text-[11px] text-slate-400 mt-1">No tasks or reminders set for this day.</p>
                                            </div>
                                        ) : (
                                            dayEvents.map(ev => {
                                                const chip = statusChip(ev);
                                                return (
                                                    <div
                                                        key={ev.id}
                                                        className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm transition-all space-y-3"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <h5 className="text-sm font-extrabold text-slate-900">{ev.studentName}</h5>
                                                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 tracking-tight">
                                                                    {ev.appNumber || ev.id}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {ev.time && (
                                                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-700 flex items-center gap-1">
                                                                        <span className="material-symbols-outlined text-[13px]">schedule</span>
                                                                        {ev.time}
                                                                    </span>
                                                                )}
                                                                <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase border ${chip.cls}`}>
                                                                    {chip.label}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {ev.notes && (
                                                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] text-slate-600 font-medium">
                                                                <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                                                                    <span className="material-symbols-outlined text-[12px] text-indigo-500">sticky_note_2</span>
                                                                    Notes
                                                                </p>
                                                                <p className="whitespace-pre-wrap">{ev.notes}</p>
                                                            </div>
                                                        )}

                                                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        if (ev.isStudent) {
                                                                            router.push(`/staff/users/${ev.studentId}/follow-ups`);
                                                                        } else {
                                                                            router.push(`/staff/applications/${ev.appId}`);
                                                                        }
                                                                    }}
                                                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                                    View Record
                                                                </button>
                                                                <button
                                                                    onClick={() => handleOpenNotes(ev)}
                                                                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                                                >
                                                                    <span className="material-symbols-outlined text-[14px]">edit_note</span>
                                                                    {ev.notes ? "Edit Note" : "Add Note"}
                                                                </button>
                                                            </div>
                                                            <button
                                                                onClick={() => clearFollowUp(ev)}
                                                                className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                                Mark Done
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                {/* Right column: Follow-up Schedule list */}
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        {/* Filter tabs */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[14px] font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                <span className="material-symbols-outlined text-indigo-500 text-[20px]">notifications_active</span>
                                Follow-up Schedule
                            </h3>
                        </div>

                        {/* Filter pills */}
                        <div className="flex flex-wrap gap-1 mb-4">
                            {(["all", "today", "overdue", "upcoming"] as const).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilterUpcoming(f)}
                                    className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border ${filterUpcoming === f
                                        ? 'bg-white border-indigo-300 text-indigo-600 shadow-sm'
                                        : 'border-slate-200 text-slate-400 hover:text-slate-600 bg-slate-50'}`}
                                >
                                    {f} {counts[f] > 0 && <span className={`${f === 'overdue' ? 'text-rose-500' : f === 'today' ? 'text-amber-500' : ''}`}>({counts[f]})</span>}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-3 max-h-[520px] overflow-y-auto pr-0.5" style={{ scrollbarWidth: 'thin' }}>
                            {filteredFollowUps.length === 0 ? (
                                <div className="py-12 text-center">
                                    <span className="material-symbols-outlined text-4xl text-slate-100 mb-3 block">event_available</span>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">No follow-ups {filterUpcoming !== "all" ? `for ${filterUpcoming}` : "scheduled"}</p>
                                    <p className="text-slate-300 text-[10px] mt-1">Set a follow-up from the Incoming Queue.</p>
                                </div>
                            ) : (
                                filteredFollowUps.map(fu => {
                                    const chip = statusChip(fu);
                                    return (
                                        <div
                                            key={fu.id}
                                            className={`p-3.5 border rounded-2xl transition-all hover:shadow-sm ${fu.isOverdue ? 'border-rose-100 bg-rose-50/30' : fu.isToday ? 'border-amber-100 bg-amber-50/20' : 'border-slate-200 bg-white hover:border-indigo-100'}`}
                                        >
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="min-w-0">
                                                    <p className="text-[13px] font-bold text-slate-800 truncate">{fu.studentName || "—"}</p>
                                                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100 tracking-tight">
                                                        {fu.appNumber || fu.id}
                                                    </span>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border flex-shrink-0 ${chip.cls}`}>{chip.label}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-semibold mb-3">
                                                <span className="flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                                                    {formatDateLabel(fu)}
                                                </span>
                                                {fu.time && (
                                                    <span className="flex items-center gap-1">
                                                        <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                        {fu.time}
                                                    </span>
                                                )}
                                            </div>
                                            {fu.notes ? (
                                                <div
                                                    onClick={() => handleOpenNotes(fu)}
                                                    className="bg-slate-50 border border-slate-100 hover:border-indigo-200 rounded-xl p-2.5 mb-3 cursor-pointer group transition-all"
                                                >
                                                    <div className="flex items-center justify-between gap-1 mb-1">
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-[12px] text-indigo-500 font-bold">sticky_note_2</span>
                                                            Follow-up Notes
                                                        </span>
                                                        <span className="material-symbols-outlined text-[12px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">edit</span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-600 font-semibold leading-relaxed line-clamp-2">{fu.notes}</p>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleOpenNotes(fu)}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 border border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/20 text-slate-400 hover:text-indigo-600 rounded-xl text-[9px] font-bold mb-3 transition-all cursor-pointer"
                                                >
                                                    <span className="material-symbols-outlined text-[12px]">add_comment</span>
                                                    Add Note
                                                </button>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (fu.isStudent) {
                                                            router.push(`/staff/users/${fu.studentId}/follow-ups`);
                                                        } else {
                                                            router.push(`/staff/applications/${fu.appId}`);
                                                        }
                                                    }}
                                                    className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-1"
                                                >
                                                    View
                                                    <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                                                </button>
                                                <button
                                                    onClick={() => handleOpenNotes(fu)}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1"
                                                    title="Internal Notes"
                                                >
                                                    <span className="material-symbols-outlined text-[12px]">sticky_note_2</span>
                                                    Notes
                                                </button>
                                                <button
                                                    onClick={() => clearFollowUp(fu)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg border border-slate-200 hover:border-rose-100 transition-all"
                                                    title="Clear reminder"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">close</span>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Internal Notes Modal */}
            <AnimatePresence>
                {isNotesModalOpen && selectedFollowUp && (
                    <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]"
                        >
                            {/* Modal Header */}
                            <div className="bg-gradient-to-r from-[#6605c7]/5 to-[#8b24e5]/5 border-b border-[#6605c7]/10 px-6 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-[#6605c7]/10 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[18px] text-[#6605c7]">sticky_note_2</span>
                                    </div>
                                    <div>
                                        <h3 className="text-[14px] font-black text-slate-800 uppercase tracking-wider">Internal Notes</h3>
                                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                            {selectedFollowUp.studentName} — {selectedFollowUp.appNumber}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsNotesModalOpen(false)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-6 overflow-y-auto space-y-5 flex-1" style={{ scrollbarWidth: 'thin' }}>
                                {/* Add Note Area */}
                                <div className="space-y-3 bg-slate-50/50 p-4 border border-slate-100 rounded-xl">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block font-sans">Add New Note</label>
                                    <textarea
                                        value={newNoteText}
                                        onChange={(e) => setNewNoteText(e.target.value)}
                                        placeholder="Type a new internal note (only visible to staff)..."
                                        rows={3}
                                        className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 focus:border-[#6605c7] resize-none placeholder:text-slate-400 placeholder:font-medium transition-all"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={handleSaveNote}
                                            disabled={savingNote || !newNoteText.trim()}
                                            className="px-4 py-1.5 text-[9px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#6605c7] to-[#8b24e5] hover:opacity-90 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-500/20"
                                        >
                                            {savingNote ? "Saving..." : "Save Note"}
                                        </button>
                                    </div>
                                </div>

                                {/* History Area */}
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 block font-sans">Note History</label>

                                    {loadingNotes ? (
                                        <div className="flex flex-col items-center justify-center py-8 gap-2">
                                            <div className="w-6 h-6 border-2 border-[#6605c7]/20 border-t-[#6605c7] rounded-full animate-spin" />
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Loading history...</span>
                                        </div>
                                    ) : notesList.length === 0 ? (
                                        <p className="text-[10px] text-slate-400 italic py-2 pl-1 font-semibold">No internal notes added yet.</p>
                                    ) : (
                                        <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                                            {notesList.map((note, idx) => {
                                                const isAdmin = (note.type || '').includes('admin') || (note.authorName || '').toLowerCase().includes('admin');
                                                return (
                                                    <div key={note.id || note._id || idx} className={`border rounded-xl p-3 space-y-2 ${isAdmin ? 'bg-purple-50/40 border-purple-200/80' : 'bg-slate-50/30 border-slate-100'}`}>
                                                        <div className="flex items-center justify-between text-[8px] font-bold">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-slate-700">{note.authorName || (isAdmin ? "Administrator" : "Staff Member")}</span>
                                                                <span className={`px-1.5 py-0.2 rounded text-[7.5px] font-extrabold uppercase ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                    {isAdmin ? 'ADMIN NOTE' : 'STAFF NOTE'}
                                                                </span>
                                                            </div>
                                                            <span className="text-slate-400">{note.createdAt || note.created_at ? formatNoteTime(note.createdAt || note.created_at) : ""}</span>
                                                        </div>
                                                        <p className="text-[11px] font-semibold text-slate-700 leading-relaxed whitespace-pre-wrap">{note.content || note.remark || ""}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
