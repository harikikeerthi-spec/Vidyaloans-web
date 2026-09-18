"use client";

import { useUserDossier } from "../DossierContext";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminApi, staffProfileApi } from "@/lib/api";
import { formatNoteTime } from "@/lib/utils";

export default function NotesTab() {
    const { notes, setNotes, userApplications, actionLoading, setActionLoading } = useUserDossier();

    const [noteInput, setNoteInput] = useState("");
    const [isNoteInputVisible, setIsNoteInputVisible] = useState(false);
    const [loadingNotes, setLoadingNotes] = useState(false);

    const fetchNotes = async () => {
        const activeApp = userApplications[0];
        const appRefId = activeApp?.id || activeApp?._id;
        if (!appRefId) return;
        setLoadingNotes(true);
        try {
            const res = await adminApi.getRemarks(appRefId) as any;
            if (res && res.success && Array.isArray(res.data)) {
                setNotes(res.data.filter((r: any) => r.isInternal === true || r.type === "note" || r.type === "admin_note" || r.type === "staff_note"));
            } else if (Array.isArray(res)) {
                setNotes(res.filter((r: any) => r.isInternal === true || r.type === "note" || r.type === "admin_note" || r.type === "staff_note"));
            }
        } catch (err) {
            console.error("Failed to fetch notes:", err);
        } finally {
            setLoadingNotes(false);
        }
    };

    const handleAddNote = async () => {
        if (!noteInput.trim()) return;
        const activeApp = userApplications[0];
        const appRefId = activeApp?.id || activeApp?._id;
        if (!appRefId) return;

        setActionLoading(true);
        try {
            await adminApi.addRemark(appRefId, {
                type: "note",
                content: noteInput.trim(),
                authorName: "Staff Member",
                isInternal: true,
            } as any);

            const studentName = [activeApp?.student?.firstName || activeApp?.user?.firstName, activeApp?.student?.lastName || activeApp?.user?.lastName].filter(Boolean).join(' ') || "Student";
            staffProfileApi.logActivity({
                type: "note",
                msg: `Added internal note for ${studentName}: "${noteInput.trim().slice(0, 45)}..."`,
                icon: "sticky_note_2",
                color: "bg-purple-50 text-[#6605c7]"
            }).catch(console.error);

            setNoteInput("");
            setIsNoteInputVisible(false);
            await fetchNotes();
        } catch (err) {
            console.error("Failed to add note:", err);
        } finally {
            setActionLoading(false);
        }
    };


    const hasApplication = userApplications.length > 0;

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                        Internal Notes
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-semibold">
                        Private staff-only annotations — not visible to the student
                    </p>
                </div>
                {hasApplication && (
                    <button
                        onClick={() => setIsNoteInputVisible(true)}
                        disabled={isNoteInputVisible}
                        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#6605c7] to-[#8b24e5] hover:opacity-90 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md hover:shadow-purple-500/20 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <span className="material-symbols-outlined text-[16px]">add_comment</span>
                        Add Note
                    </button>
                )}
            </div>

            {/* Add Note Panel */}
            <AnimatePresence>
                {isNoteInputVisible && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.98 }}
                        className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
                    >
                        <div className="bg-gradient-to-r from-[#6605c7]/5 to-[#8b24e5]/5 border-b border-[#6605c7]/10 px-6 py-4 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#6605c7]/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-[18px] text-[#6605c7]">sticky_note_2</span>
                            </div>
                            <div>
                                <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-wider">New Internal Note</h3>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Only staff can see this note</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <textarea
                                value={noteInput}
                                onChange={(e) => setNoteInput(e.target.value)}
                                placeholder="Write an internal note about this student (e.g. 'Called student on July 12 — docs pending', 'Escalated to senior team'...)"
                                autoFocus
                                rows={4}
                                className="w-full p-4 bg-slate-50/80 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 focus:border-[#6605c7] resize-none placeholder:text-slate-400 placeholder:font-medium placeholder:text-xs transition-all"
                            />
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setIsNoteInputVisible(false);
                                        setNoteInput("");
                                    }}
                                    disabled={actionLoading}
                                    className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddNote}
                                    disabled={actionLoading || !noteInput.trim()}
                                    className="px-5 py-2 text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#6605c7] to-[#8b24e5] hover:opacity-90 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-500/20"
                                >
                                    {actionLoading ? "Saving..." : "Save Note"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Notes List */}
            <div className="space-y-4">
                {loadingNotes ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-10 h-10 border-4 border-[#6605c7]/20 border-t-[#6605c7] rounded-full animate-spin" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading notes...</p>
                        </div>
                    </div>
                ) : !hasApplication ? (
                    <div className="bg-white/60 border border-white/80 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-[32px] text-amber-400">info</span>
                        </div>
                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">No Application Found</h3>
                        <p className="text-xs text-slate-400 font-semibold mt-2 max-w-xs">
                            Internal notes are linked to loan applications. This user has no application on file yet.
                        </p>
                    </div>
                ) : notes.length === 0 ? (
                    <div className="bg-white/60 border border-white/80 rounded-2xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-[#6605c7]/5 border border-[#6605c7]/10 flex items-center justify-center mb-4">
                            <span className="material-symbols-outlined text-[32px] text-[#6605c7]/40">sticky_note_2</span>
                        </div>
                        <h3 className="text-sm font-black text-slate-700 uppercase tracking-wide">No Notes Yet</h3>
                        <p className="text-xs text-slate-400 font-semibold mt-2 max-w-xs">
                            Add your first internal note using the button above. Notes are private to staff only.
                        </p>
                    </div>
                ) : (
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-[27px] top-6 bottom-6 w-[2px] bg-gradient-to-b from-[#6605c7]/20 via-[#6605c7]/10 to-transparent rounded-full" />

                        <div className="space-y-4">
                            {notes.map((note: any, idx: number) => (
                                <motion.div
                                    key={note.id || note._id || idx}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="flex items-start gap-4"
                                >
                                    {/* Timeline dot */}
                                    <div className="flex-shrink-0 w-14 flex flex-col items-center mt-1">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6605c7] to-[#8b24e5] flex items-center justify-center shadow-md shadow-purple-500/20 z-10">
                                            <span className="material-symbols-outlined text-[14px] text-white">edit_note</span>
                                        </div>
                                    </div>

                                    {/* Card */}
                                    <div className="flex-1 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
                                        <div className="flex items-center justify-between px-5 py-3 bg-slate-50/80 border-b border-slate-100">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                                                    {note.authorName || (note.type === "admin_note" ? "Administrator" : "Staff Member")}
                                                </span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300" />
                                                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                                                    (note.type || '').includes('admin') || (note.authorName || '').toLowerCase().includes('admin')
                                                        ? 'text-purple-700 bg-purple-100 border-purple-200'
                                                        : 'text-[#6605c7] bg-[#6605c7]/5 border-[#6605c7]/10'
                                                }`}>
                                                    {(note.type || '').includes('admin') || (note.authorName || '').toLowerCase().includes('admin') ? 'ADMIN NOTE' : 'INTERNAL NOTE'}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-bold text-slate-400 font-mono">
                                                {note.createdAt || note.created_at ? formatNoteTime(note.createdAt || note.created_at) : "—"}
                                            </span>
                                        </div>
                                        <div className="px-5 py-4">
                                            <p className="text-sm font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
                                                {note.content || note.remark || note.message || "—"}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
