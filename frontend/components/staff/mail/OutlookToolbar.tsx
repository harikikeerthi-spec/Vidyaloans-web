"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    CheckSquare,
    ChevronDown,
    SlidersHorizontal,
    RefreshCw,
    Reply,
    ReplyAll,
    Forward,
    Trash2,
    Archive,
    Flame,
    Tag,
    MoreHorizontal,
    Printer,
    FileUp,
    FileDown,
    Edit3,
    Code,
    FolderInput,
    Copy,
    ExternalLink,
    Filter,
    Calendar,
    ChevronRight,
    Star,
    MailCheck,
    MailWarning,
    Check,
    ShieldAlert,
    ShieldCheck,
    Ban,
    Clock,
    PenTool,
    Sliders,
    Palette,
    RotateCcw
} from "lucide-react";

export interface OutlookToolbarProps {
    // Selection state
    selectedCount: number;
    totalCount: number;
    onSelectAll: () => void;
    onSelectNone: () => void;
    onSelectRead: () => void;
    onSelectUnread: () => void;
    onSelectStarred: () => void;

    // View state
    threadsEnabled?: boolean;
    onToggleThreads?: () => void;
    isCompactView: boolean;
    onToggleCompactView: () => void;
    sortOrder: "newest" | "oldest";
    onToggleSortOrder: () => void;

    // Refresh
    refreshing: boolean;
    onRefresh: () => void;

    // Actions on current/selected email
    hasActiveEmail: boolean;
    onReply?: () => void;
    onReplyAll?: () => void;
    onForward?: () => void;
    onDelete?: () => void;
    onArchive?: () => void;
    onJunk?: () => void;
    onMarkRead?: () => void;
    onMarkUnread?: () => void;
    onToggleStar?: () => void;

    // More dropdown actions
    onPrint?: () => void;
    onImport?: () => void;
    onExport?: () => void;
    onEditAsNew?: () => void;
    onShowSource?: () => void;
    onMoveToFolder?: (folder: string) => void;
    onCopyToFolder?: (folder: string) => void;
    onOpenInNewWindow?: () => void;
    onCreateFilter?: () => void;
    onSaveAsEvent?: () => void;

    // Advanced & Security Actions
    onBlockSender?: () => void;
    onSafeSender?: () => void;
    onOutOfOffice?: () => void;
    onSignatures?: () => void;
    onMailRules?: () => void;
    onConditionalFormatting?: () => void;

    // Spam & Trash context
    isSpamActive?: boolean;
    isTrashActive?: boolean;
    onRestore?: () => void;
    onDeletePermanently?: () => void;

    // Available folders for Move To / Copy To
    availableFolders?: { name: string; prefix: string }[];
}

export function OutlookToolbar({
    selectedCount,
    totalCount,
    onSelectAll,
    onSelectNone,
    onSelectRead,
    onSelectUnread,
    onSelectStarred,
    threadsEnabled,
    onToggleThreads,
    isCompactView,
    onToggleCompactView,
    sortOrder,
    onToggleSortOrder,
    refreshing,
    onRefresh,
    hasActiveEmail,
    onReply,
    onReplyAll,
    onForward,
    onDelete,
    onArchive,
    onJunk,
    isSpamActive = false,
    isTrashActive = false,
    onRestore,
    onDeletePermanently,
    onMarkRead,
    onMarkUnread,
    onToggleStar,
    onPrint,
    onImport,
    onExport,
    onEditAsNew,
    onShowSource,
    onMoveToFolder,
    onCopyToFolder,
    onOpenInNewWindow,
    onCreateFilter,
    onSaveAsEvent,
    onBlockSender,
    onSafeSender,
    onOutOfOffice,
    onSignatures,
    onMailRules,
    onConditionalFormatting,
    availableFolders = [],
}: OutlookToolbarProps) {
    // Dropdown toggles
    const [selectMenuOpen, setSelectMenuOpen] = useState(false);
    const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
    const [markMenuOpen, setMarkMenuOpen] = useState(false);
    const [moreMenuOpen, setMoreMenuOpen] = useState(false);
    const [moveToSubmenuOpen, setMoveToSubmenuOpen] = useState(false);
    const [copyToSubmenuOpen, setCopyToSubmenuOpen] = useState(false);

    const selectRef = useRef<HTMLDivElement>(null);
    const optionsRef = useRef<HTMLDivElement>(null);
    const markRef = useRef<HTMLDivElement>(null);
    const moreRef = useRef<HTMLDivElement>(null);

    // Close menus when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (selectRef.current && !selectRef.current.contains(e.target as Node)) {
                setSelectMenuOpen(false);
            }
            if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
                setOptionsMenuOpen(false);
            }
            if (markRef.current && !markRef.current.contains(e.target as Node)) {
                setMarkMenuOpen(false);
            }
            if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
                setMoreMenuOpen(false);
                setMoveToSubmenuOpen(false);
                setCopyToSubmenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const folders = availableFolders.length > 0
        ? availableFolders
        : [
            { name: "Inbox", prefix: "support/" },
            { name: "Archive", prefix: "archive/" },
            { name: "Junk / Spam", prefix: "junk/" },
            { name: "Trash", prefix: "trash/" },
        ];

    return (
        <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/70 select-none sticky top-0 z-30 shadow-2xs transition-all">
            <div className="flex items-center justify-between px-3 sm:px-5 py-2 overflow-visible gap-2">
                {/* ── LEFT RIBBON GROUP ── */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Select Dropdown */}
                    <div className="relative" ref={selectRef}>
                        <button
                            type="button"
                            onClick={() => setSelectMenuOpen(!selectMenuOpen)}
                            className={`flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl transition-all duration-200 group cursor-pointer ${
                                selectedCount > 0 ? "bg-indigo-50/80 text-indigo-700" : "hover:bg-slate-100/80 text-slate-700"
                            }`}
                        >
                            <div className="flex items-center gap-1">
                                <CheckSquare className={`w-4 h-4 transition-colors ${selectedCount > 0 ? "text-indigo-600" : "text-slate-600 group-hover:text-indigo-600"}`} />
                                <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
                            </div>
                            <span className="text-[10px] font-semibold leading-tight mt-0.5">
                                {selectedCount > 0 ? `(${selectedCount})` : "Select"}
                            </span>
                        </button>

                        {selectMenuOpen && (
                            <div className="absolute left-0 top-full mt-1.5 w-48 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xl z-40 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-150">
                                <button
                                    onClick={() => { onSelectAll(); setSelectMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 font-medium transition-colors"
                                >
                                    Select All ({totalCount})
                                </button>
                                <button
                                    onClick={() => { onSelectNone(); setSelectMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 font-medium transition-colors"
                                >
                                    Select None
                                </button>
                                <div className="border-t border-slate-100/80 my-1" />
                                <button
                                    onClick={() => { onSelectUnread(); setSelectMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 font-medium transition-colors"
                                >
                                    Unread Only
                                </button>
                                <button
                                    onClick={() => { onSelectRead(); setSelectMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 font-medium transition-colors"
                                >
                                    Read Only
                                </button>
                                <button
                                    onClick={() => { onSelectStarred(); setSelectMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 font-medium transition-colors"
                                >
                                    Starred Only
                                </button>
                            </div>
                        )}
                    </div>


                    {/* Options Dropdown */}
                    <div className="relative" ref={optionsRef}>
                        <button
                            type="button"
                            onClick={() => setOptionsMenuOpen(!optionsMenuOpen)}
                            className="flex flex-col items-center justify-center px-2.5 py-1.5 hover:bg-slate-100/80 rounded-xl text-slate-700 transition-all duration-200 cursor-pointer"
                        >
                            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
                            <span className="text-[10px] font-semibold text-slate-600 leading-tight mt-0.5">Options</span>
                        </button>

                        {optionsMenuOpen && (
                            <div className="absolute left-0 top-full mt-1.5 w-52 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xl z-40 py-2 text-xs animate-in fade-in zoom-in-95 duration-150">
                                <div className="px-3.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Display Density
                                </div>
                                <button
                                    onClick={() => { onToggleCompactView(); setOptionsMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 flex items-center justify-between transition-colors"
                                >
                                    <span>Compact View</span>
                                    {isCompactView && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                                </button>

                                <div className="border-t border-slate-100/80 my-1.5" />
                                <div className="px-3.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Sort Order
                                </div>
                                <button
                                    onClick={() => { onToggleSortOrder(); setOptionsMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 flex items-center justify-between transition-colors"
                                >
                                    <span>{sortOrder === "newest" ? "Newest on Top" : "Oldest on Top"}</span>
                                    <span className="text-[10px] text-indigo-600 font-bold uppercase">{sortOrder}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Refresh */}
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={refreshing}
                        className="flex flex-col items-center justify-center px-2.5 py-1.5 hover:bg-slate-100/80 rounded-xl text-slate-700 transition-all duration-200 cursor-pointer"
                        title="Sync and Refresh Mailbox"
                    >
                        <RefreshCw className={`w-4 h-4 text-slate-600 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
                        <span className="text-[10px] font-semibold text-slate-600 leading-tight mt-0.5">Refresh</span>
                    </button>
                </div>

                {/* ── SEPARATOR ── */}
                <div className="h-7 w-px bg-slate-200/80 shrink-0 hidden sm:block" />

                {/* ── RIGHT RIBBON GROUP ── */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Reply */}
                    <button
                        type="button"
                        onClick={onReply}
                        disabled={!hasActiveEmail}
                        className="flex flex-col items-center justify-center px-2.5 py-1.5 hover:bg-slate-100/80 disabled:opacity-35 disabled:hover:bg-transparent rounded-xl text-slate-700 transition-all duration-200 cursor-pointer"
                        title="Reply to sender"
                    >
                        <Reply className="w-4 h-4 text-slate-600" />
                        <span className="text-[10px] font-semibold text-slate-600 leading-tight mt-0.5">Reply</span>
                    </button>

                    {/* Reply All */}
                    <button
                        type="button"
                        onClick={onReplyAll}
                        disabled={!hasActiveEmail}
                        className="flex flex-col items-center justify-center px-2.5 py-1.5 hover:bg-slate-100/80 disabled:opacity-35 disabled:hover:bg-transparent rounded-xl text-slate-700 transition-all duration-200 cursor-pointer"
                        title="Reply to all recipients"
                    >
                        <ReplyAll className="w-4 h-4 text-slate-600" />
                        <span className="text-[10px] font-semibold text-slate-600 leading-tight mt-0.5">Reply all</span>
                    </button>

                    {/* Forward */}
                    <button
                        type="button"
                        onClick={onForward}
                        disabled={!hasActiveEmail}
                        className="flex flex-col items-center justify-center px-2.5 py-1.5 hover:bg-slate-100/80 disabled:opacity-35 disabled:hover:bg-transparent rounded-xl text-slate-700 transition-all duration-200 cursor-pointer"
                        title="Forward email"
                    >
                        <Forward className="w-4 h-4 text-slate-600" />
                        <span className="text-[10px] font-semibold text-slate-600 leading-tight mt-0.5">Forward</span>
                    </button>

                    {/* Delete or Restore depending on Trash mode */}
                    {isTrashActive ? (
                        <>
                            <button
                                type="button"
                                onClick={onRestore}
                                disabled={!hasActiveEmail && selectedCount === 0}
                                className="flex flex-col items-center justify-center px-2.5 py-1.5 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-35 disabled:hover:bg-transparent rounded-xl text-emerald-700 font-bold transition-all duration-200 cursor-pointer"
                                title="Restore selected email(s) back to Inbox"
                            >
                                <RotateCcw className="w-4 h-4 text-emerald-600" />
                                <span className="text-[10px] font-bold leading-tight mt-0.5">Restore</span>
                            </button>
                            <button
                                type="button"
                                onClick={onDeletePermanently || onDelete}
                                disabled={!hasActiveEmail && selectedCount === 0}
                                className="flex flex-col items-center justify-center px-2.5 py-1.5 hover:bg-rose-50/80 hover:text-rose-600 disabled:opacity-35 disabled:hover:bg-transparent rounded-xl text-slate-700 transition-all duration-200 cursor-pointer"
                                title="Permanently delete email(s)"
                            >
                                <Trash2 className="w-4 h-4 text-slate-600 hover:text-rose-600" />
                                <span className="text-[10px] font-semibold leading-tight mt-0.5">Delete Forever</span>
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={onDelete}
                            disabled={!hasActiveEmail && selectedCount === 0}
                            className="flex flex-col items-center justify-center px-2.5 py-1.5 hover:bg-rose-50/80 hover:text-rose-600 disabled:opacity-35 disabled:hover:bg-transparent rounded-xl text-slate-700 transition-all duration-200 cursor-pointer"
                            title="Move to Trash"
                        >
                            <Trash2 className="w-4 h-4 text-slate-600 hover:text-rose-600" />
                            <span className="text-[10px] font-semibold leading-tight mt-0.5">Delete</span>
                        </button>
                    )}

                    {/* Archive */}
                    <button
                        type="button"
                        onClick={onArchive}
                        disabled={!hasActiveEmail && selectedCount === 0}
                        className="flex flex-col items-center justify-center px-2.5 py-1.5 hover:bg-slate-100/80 disabled:opacity-35 disabled:hover:bg-transparent rounded-xl text-slate-700 transition-all duration-200 cursor-pointer"
                        title="Move to Archive"
                    >
                        <Archive className="w-4 h-4 text-slate-600" />
                        <span className="text-[10px] font-semibold text-slate-600 leading-tight mt-0.5">Archive</span>
                    </button>

                    {/* Junk / Not Junk Toggle */}
                    <button
                        type="button"
                        onClick={onJunk}
                        disabled={!hasActiveEmail && selectedCount === 0}
                        className={`flex flex-col items-center justify-center px-2.5 py-1.5 rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-35 disabled:hover:bg-transparent ${
                            isSpamActive
                                ? "hover:bg-emerald-50 hover:text-emerald-700 text-emerald-700 font-bold"
                                : "hover:bg-rose-50/80 hover:text-rose-700 text-slate-700"
                        }`}
                        title={isSpamActive ? "Restore to Inbox (Mark as Not Spam)" : "Report as Junk / Spam"}
                    >
                        {isSpamActive ? (
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        ) : (
                            <Flame className="w-4 h-4 text-rose-500" />
                        )}
                        <span className={`text-[10px] font-semibold leading-tight mt-0.5 ${isSpamActive ? "text-emerald-700 font-bold" : "text-slate-600"}`}>
                            {isSpamActive ? "Not Junk" : "Junk"}
                        </span>
                    </button>

                    {/* Mark Dropdown */}
                    <div className="relative" ref={markRef}>
                        <button
                            type="button"
                            onClick={() => setMarkMenuOpen(!markMenuOpen)}
                            disabled={!hasActiveEmail && selectedCount === 0}
                            className="flex flex-col items-center justify-center px-2.5 py-1.5 hover:bg-slate-100/80 disabled:opacity-35 disabled:hover:bg-transparent rounded-xl text-slate-700 transition-all duration-200 cursor-pointer"
                        >
                            <Tag className="w-4 h-4 text-slate-600" />
                            <span className="text-[10px] font-semibold text-slate-600 leading-tight mt-0.5">Mark</span>
                        </button>

                        {markMenuOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-48 bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-xl z-40 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-150">
                                <button
                                    onClick={() => { onMarkRead?.(); setMarkMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 flex items-center gap-2.5 font-medium transition-colors"
                                >
                                    <MailCheck className="w-3.5 h-3.5 text-indigo-500" />
                                    <span>Mark as Read</span>
                                </button>
                                <button
                                    onClick={() => { onMarkUnread?.(); setMarkMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 flex items-center gap-2.5 font-medium transition-colors"
                                >
                                    <MailWarning className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Mark as Unread</span>
                                </button>
                                <button
                                    onClick={() => { onToggleStar?.(); setMarkMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 flex items-center gap-2.5 font-medium transition-colors"
                                >
                                    <Star className="w-3.5 h-3.5 text-amber-500" />
                                    <span>Toggle Star / Flag</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* More Dropdown (...) */}
                    <div className="relative" ref={moreRef}>
                        <button
                            type="button"
                            onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                            className="flex flex-col items-center justify-center px-2.5 py-1.5 hover:bg-slate-100/80 rounded-xl text-slate-700 transition-all duration-200 cursor-pointer"
                        >
                            <MoreHorizontal className="w-4 h-4 text-slate-600" />
                            <span className="text-[10px] font-semibold text-slate-600 leading-tight mt-0.5">More</span>
                        </button>

                        {moreMenuOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-64 max-h-[82vh] overflow-y-auto bg-white/98 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-2xl z-50 py-2 text-xs animate-in fade-in zoom-in-95 duration-150">
                                {/* Print this message */}
                                <button
                                    onClick={() => { onPrint?.(); setMoreMenuOpen(false); }}
                                    disabled={!hasActiveEmail}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 disabled:opacity-35 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                                >
                                    <Printer className="w-4 h-4 text-slate-500" />
                                    <span>Print this message</span>
                                </button>

                                {/* Import */}
                                <button
                                    onClick={() => { onImport?.(); setMoreMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                                >
                                    <FileUp className="w-4 h-4 text-slate-500" />
                                    <span>Import (.eml)</span>
                                </button>

                                {/* Export (.eml) */}
                                <button
                                    onClick={() => { onExport?.(); setMoreMenuOpen(false); }}
                                    disabled={!hasActiveEmail}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 disabled:opacity-35 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                                >
                                    <FileDown className="w-4 h-4 text-slate-500" />
                                    <span>Export (.eml)</span>
                                </button>

                                {/* Edit as new */}
                                <button
                                    onClick={() => { onEditAsNew?.(); setMoreMenuOpen(false); }}
                                    disabled={!hasActiveEmail}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 disabled:opacity-35 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                                >
                                    <Edit3 className="w-4 h-4 text-slate-500" />
                                    <span>Edit as new</span>
                                </button>

                                {/* Show source */}
                                <button
                                    onClick={() => { onShowSource?.(); setMoreMenuOpen(false); }}
                                    disabled={!hasActiveEmail}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 disabled:opacity-35 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                                >
                                    <Code className="w-4 h-4 text-slate-500" />
                                    <span>Show source</span>
                                </button>

                                <div className="border-t border-slate-100/80 my-1.5" />

                                {/* Move to... with inline folder accordion */}
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => setMoveToSubmenuOpen(!moveToSubmenuOpen)}
                                        disabled={!hasActiveEmail && selectedCount === 0}
                                        className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 disabled:opacity-35 flex items-center justify-between font-medium transition-colors cursor-pointer"
                                    >
                                        <span className="flex items-center gap-3">
                                            <FolderInput className="w-4 h-4 text-slate-500" />
                                            <span>Move to...</span>
                                        </span>
                                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${moveToSubmenuOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {moveToSubmenuOpen && (
                                        <div className="bg-slate-50/80 py-1 px-2 border-y border-slate-100/80 space-y-0.5">
                                            {folders.map((f) => (
                                                <button
                                                    key={f.prefix}
                                                    onClick={() => {
                                                        onMoveToFolder?.(f.prefix);
                                                        setMoveToSubmenuOpen(false);
                                                        setMoreMenuOpen(false);
                                                    }}
                                                    className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-white hover:text-indigo-600 rounded-lg font-medium truncate transition-colors text-[11px] flex items-center gap-2 cursor-pointer"
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                                    <span className="truncate">{f.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Copy to... with inline folder accordion */}
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => setCopyToSubmenuOpen(!copyToSubmenuOpen)}
                                        disabled={!hasActiveEmail && selectedCount === 0}
                                        className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 disabled:opacity-35 flex items-center justify-between font-medium transition-colors cursor-pointer"
                                    >
                                        <span className="flex items-center gap-3">
                                            <Copy className="w-4 h-4 text-slate-500" />
                                            <span>Copy to...</span>
                                        </span>
                                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${copyToSubmenuOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {copyToSubmenuOpen && (
                                        <div className="bg-slate-50/80 py-1 px-2 border-y border-slate-100/80 space-y-0.5">
                                            {folders.map((f) => (
                                                <button
                                                    key={f.prefix}
                                                    onClick={() => {
                                                        onCopyToFolder?.(f.prefix);
                                                        setCopyToSubmenuOpen(false);
                                                        setMoreMenuOpen(false);
                                                    }}
                                                    className="w-full px-3 py-1.5 text-left text-slate-700 hover:bg-white hover:text-indigo-600 rounded-lg font-medium truncate transition-colors text-[11px] flex items-center gap-2 cursor-pointer"
                                                >
                                                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                                                    <span className="truncate">{f.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="border-t border-slate-100/80 my-1.5" />

                                {/* Open in new window */}
                                <button
                                    onClick={() => { onOpenInNewWindow?.(); setMoreMenuOpen(false); }}
                                    disabled={!hasActiveEmail}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 disabled:opacity-35 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                                >
                                    <ExternalLink className="w-4 h-4 text-slate-500" />
                                    <span>Open in new window</span>
                                </button>

                                {/* Create filter */}
                                <button
                                    onClick={() => { onCreateFilter?.(); setMoreMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                                >
                                    <Filter className="w-4 h-4 text-slate-500" />
                                    <span>Create filter</span>
                                </button>

                                {/* Save as event */}
                                <button
                                    onClick={() => { onSaveAsEvent?.(); setMoreMenuOpen(false); }}
                                    disabled={!hasActiveEmail}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 disabled:opacity-35 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                                >
                                    <Calendar className="w-4 h-4 text-slate-500" />
                                    <span>Save as event</span>
                                </button>

                                <div className="border-t border-slate-100/80 my-1.5" />

                                {/* Block sender */}
                                <button
                                    onClick={() => { onBlockSender?.(); setMoreMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-rose-700 hover:bg-rose-50/80 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                                >
                                    <Ban className="w-4 h-4 text-rose-500" />
                                    <span>Block sender</span>
                                </button>

                                {/* Safe Senders */}
                                <button
                                    onClick={() => { onSafeSender?.(); setMoreMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-emerald-700 hover:bg-emerald-50/80 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                                >
                                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                    <span>Add to Safe Senders</span>
                                </button>

                                <div className="border-t border-slate-100/80 my-1.5" />

                                {/* Auto-reply / Out of office */}
                                <button
                                    onClick={() => { onOutOfOffice?.(); setMoreMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                                >
                                    <Clock className="w-4 h-4 text-amber-500" />
                                    <span>Auto-reply / Out of Office</span>
                                </button>

                                {/* Signatures */}
                                <button
                                    onClick={() => { onSignatures?.(); setMoreMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                                >
                                    <PenTool className="w-4 h-4 text-indigo-500" />
                                    <span>Email Signatures</span>
                                </button>

                                {/* Mail Rules & Automation */}
                                <button
                                    onClick={() => { onMailRules?.(); setMoreMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                                >
                                    <Sliders className="w-4 h-4 text-violet-500" />
                                    <span>Mail Rules & Filters</span>
                                </button>

                                {/* Conditional Formatting */}
                                <button
                                    onClick={() => { onConditionalFormatting?.(); setMoreMenuOpen(false); }}
                                    className="w-full px-3.5 py-2 text-left text-slate-700 hover:bg-indigo-50/80 hover:text-indigo-600 flex items-center gap-3 font-medium transition-colors cursor-pointer"
                                >
                                    <Palette className="w-4 h-4 text-pink-500" />
                                    <span>Conditional Formatting</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
