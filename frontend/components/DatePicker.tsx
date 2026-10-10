"use client";

import { useState, useRef, useEffect } from "react";
import { format, getDaysInMonth, startOfMonth, getDay } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface DatePickerProps {
    value: string; // Expected format: DD-MM-YYYY
    onChange: (date: string) => void;
    label?: string;
    placeholder?: string;
    error?: string;
    required?: boolean;
    disabled?: boolean;
}

type Step = "year" | "month" | "day";

export default function DatePicker({
    value,
    onChange,
    label = "DATE OF BIRTH",
    placeholder = "Select Date",
    error,
    required,
    disabled
}: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState<Step>("year");
    
    // Decade Window State (e.g. 1990 - 2005)
    const [decadeStartYear, setDecadeStartYear] = useState<number>(1990);
    
    // Selected Date State
    const [selectedYear, setSelectedYear] = useState<number>(1998);
    const [selectedMonth, setSelectedMonth] = useState<number>(7); // 0-indexed (7 = Aug)
    const [selectedDay, setSelectedDay] = useState<number>(14);

    const containerRef = useRef<HTMLDivElement>(null);

    const today = new Date();
    const currentYear = today.getFullYear();
    const MIN_AGE = 18;
    const MAX_AGE = 40;

    // Parse incoming value (DD-MM-YYYY or DD/MM/YYYY)
    useEffect(() => {
        if (value) {
            const cleaned = value.replace(/\s+/g, "").replace(/\//g, "-");
            if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
                const [d, m, y] = cleaned.split("-").map(Number);
                setSelectedYear(y);
                setSelectedMonth(m - 1);
                setSelectedDay(d);
                
                // Adjust decade range to contain the selected year
                const start = Math.floor((y - 1970) / 16) * 16 + 1970;
                setDecadeStartYear(start > 0 ? start : 1990);
            }
        } else {
            // Default window centered around 1990 - 2005
            setDecadeStartYear(1990);
            setSelectedYear(1998);
            setSelectedMonth(7);
            setSelectedDay(14);
        }
    }, [value]);

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setCurrentStep("year");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Format value for display: "14 Aug 1998"
    const getDisplayValue = (): string => {
        if (!value) return "";
        const cleaned = value.replace(/\s+/g, "").replace(/\//g, "-");
        if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
            const [d, m, y] = cleaned.split("-").map(Number);
            const dateObj = new Date(y, m - 1, d);
            return format(dateObj, "dd MMM yyyy");
        }
        return value;
    };

    // Calculate real-time age
    const calculateAge = (): number | null => {
        if (!selectedYear || selectedMonth === null || !selectedDay) return null;
        const dob = new Date(selectedYear, selectedMonth, selectedDay);
        const ageMs = today.getTime() - dob.getTime();
        if (isNaN(ageMs)) return null;
        return new Date(ageMs).getUTCFullYear() - 1970;
    };

    const currentAge = calculateAge();
    const isAgeEligible = currentAge !== null && currentAge >= MIN_AGE && currentAge <= MAX_AGE;

    // Handle day click: set date immediately, notify parent, and close
    const handleSelectDay = (day: number) => {
        setSelectedDay(day);
        const dateObj = new Date(selectedYear, selectedMonth, day);
        const formatted = format(dateObj, "dd-MM-yyyy");
        onChange(formatted);
        setIsOpen(false);
        setCurrentStep("year");
    };

    // Month Abbreviation Array
    const monthAbbrs = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    // Generate 16 years for grid (e.g. 1990 to 2005)
    const yearGrid = Array.from({ length: 16 }, (_, i) => decadeStartYear + i);

    // Days grid calculation
    const viewDate = new Date(selectedYear, selectedMonth, 1);
    const daysInMonth = getDaysInMonth(viewDate);
    const firstDayOfMonth = getDay(startOfMonth(viewDate));
    const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const dayBlanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);

    return (
        <div className="dob-selector-card space-y-2 relative" ref={containerRef}>
            {/* Input Trigger Field */}
            <div className="field-group">
                {label && (
                    <label className="field-label text-[11px] font-bold text-slate-500 tracking-wider uppercase flex items-center justify-between mb-1.5 ml-0.5">
                        <span>{label} {required && <span className="text-rose-500 font-bold">*</span>}</span>
                        {disabled && (
                            <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 flex items-center gap-1">
                                <span className="material-symbols-outlined text-[11px]">lock</span>
                                Locked
                            </span>
                        )}
                    </label>
                )}

                <div
                    onClick={() => {
                        if (!disabled) {
                            setIsOpen(!isOpen);
                            if (!isOpen) setCurrentStep("year");
                        }
                    }}
                    className={`field-input flex justify-between items-center bg-slate-50/70 border-1.5 border-slate-200 rounded-xl px-4 py-3 cursor-pointer transition-all duration-200 ${
                        disabled ? "opacity-60 cursor-not-allowed" : ""
                    } ${
                        isOpen
                            ? "active border-[#6c2bd9] bg-white ring-4 ring-[#6c2bd9]/10 shadow-md shadow-[#6c2bd9]/5"
                            : "hover:border-[#6c2bd9]/60 hover:bg-white"
                    } ${error ? "border-rose-300 ring-2 ring-rose-500/10" : ""}`}
                >
                    <span className={`field-value text-sm font-semibold ${value ? "text-slate-900" : "text-slate-400"}`}>
                        {getDisplayValue() || placeholder}
                    </span>
                    <div className="flex items-center gap-2">
                        {value && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-50 text-[#6c2bd9] border border-purple-100">
                                DOB
                            </span>
                        )}
                        <span className="calendar-icon text-base">📅</span>
                    </div>
                </div>
            </div>

            {error && <p className="text-rose-500 text-[10px] font-semibold ml-1">{error}</p>}

            {/* Popover / Embedded Selector Panel */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 4, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.96 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="selector-panel absolute z-[100] left-0 right-0 md:left-auto md:w-96 bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-2xl p-4 shadow-2xl shadow-[#6c2bd9]/15 text-slate-800 space-y-4"
                    >
                        {/* Panel Header with Selection Breadcrumbs */}
                        <div className="panel-header flex justify-between items-center pb-3 border-b border-slate-100">
                            {/* Selected Breadcrumbs */}
                            <div className="selected-breadcrumbs flex items-center gap-1.5 text-xs font-semibold">
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep("year")}
                                    className={`crumb hover:text-[#6c2bd9] transition-colors ${
                                        currentStep === "year" ? "active-crumb text-[#6c2bd9] font-bold underline decoration-2 underline-offset-4" : "text-slate-500"
                                    }`}
                                >
                                    {selectedYear}
                                </button>
                                <span className="crumb-separator text-slate-300 text-xs">/</span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep("month")}
                                    className={`crumb hover:text-[#6c2bd9] transition-colors ${
                                        currentStep === "month" ? "active-crumb text-[#6c2bd9] font-bold underline decoration-2 underline-offset-4" : "text-slate-500"
                                    }`}
                                >
                                    {monthAbbrs[selectedMonth]}
                                </button>
                                <span className="crumb-separator text-slate-300 text-xs">/</span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep("day")}
                                    className={`crumb hover:text-[#6c2bd9] transition-colors ${
                                        currentStep === "day" ? "active-crumb text-[#6c2bd9] font-bold underline decoration-2 underline-offset-4" : "text-slate-500"
                                    }`}
                                >
                                    {selectedDay}
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-slate-700 text-xs font-bold transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* ── YEAR SELECTOR GRID ── */}
                        {currentStep === "year" && (
                            <motion.div
                                key="year-section"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 8 }}
                                transition={{ duration: 0.15 }}
                                className="view-section space-y-2.5"
                            >
                                <div className="section-header flex justify-between items-center">
                                    <span className="section-title text-[10px] font-bold text-slate-500 tracking-widest uppercase">
                                        SELECT YEAR
                                    </span>
                                    <div className="decade-nav flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => setDecadeStartYear((prev) => prev - 16)}
                                            className="nav-btn border-none bg-slate-100 hover:bg-purple-100 hover:text-[#6c2bd9] rounded-md px-2 py-0.5 font-bold text-xs transition-colors"
                                        >
                                            &lt;
                                        </button>
                                        <span className="decade-label text-xs font-semibold text-slate-700">
                                            {decadeStartYear} - {decadeStartYear + 15}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setDecadeStartYear((prev) => prev + 16)}
                                            className="nav-btn border-none bg-slate-100 hover:bg-purple-100 hover:text-[#6c2bd9] rounded-md px-2 py-0.5 font-bold text-xs transition-colors"
                                        >
                                            &gt;
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-years grid-cols-4 gap-2">
                                    {yearGrid.map((yr) => {
                                        const isSelected = selectedYear === yr;
                                        const isEligible = yr >= currentYear - MAX_AGE - 1 && yr <= currentYear - MIN_AGE;
                                        return (
                                            <button
                                                type="button"
                                                key={yr}
                                                onClick={() => {
                                                    setSelectedYear(yr);
                                                    setCurrentStep("month");
                                                }}
                                                className={`grid-item border rounded-xl py-2 px-1 text-xs font-semibold transition-all duration-150 text-center ${
                                                    isSelected
                                                        ? "selected bg-gradient-to-r from-[#6c2bd9] to-[#9333ea] text-white border-transparent shadow-md shadow-[#6c2bd9]/25 scale-105 font-bold"
                                                        : isEligible
                                                        ? "bg-white border-slate-200 text-slate-700 hover:border-[#6c2bd9] hover:text-[#6c2bd9] hover:bg-[#6c2bd9]/5"
                                                        : "bg-slate-50 border-slate-200 text-slate-400 opacity-60"
                                                }`}
                                            >
                                                {yr}
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {/* ── MONTH SELECTOR GRID ── */}
                        {currentStep === "month" && (
                            <motion.div
                                key="month-section"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 8 }}
                                transition={{ duration: 0.15 }}
                                className="view-section space-y-2.5"
                            >
                                <div className="section-header flex justify-between items-center">
                                    <span className="section-title text-[10px] font-bold text-slate-500 tracking-widest uppercase">
                                        SELECT MONTH ({selectedYear})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep("year")}
                                        className="text-[10px] font-bold text-[#6c2bd9] hover:underline"
                                    >
                                        ← Change Year
                                    </button>
                                </div>

                                <div className="grid grid-months grid-cols-4 gap-2">
                                    {monthAbbrs.map((mName, idx) => {
                                        const isSelected = selectedMonth === idx;
                                        return (
                                            <button
                                                type="button"
                                                key={mName}
                                                onClick={() => {
                                                    setSelectedMonth(idx);
                                                    setCurrentStep("day");
                                                }}
                                                className={`grid-item border rounded-xl py-2.5 px-1 text-xs font-semibold transition-all duration-150 text-center ${
                                                    isSelected
                                                        ? "selected bg-gradient-to-r from-[#6c2bd9] to-[#9333ea] text-white border-transparent shadow-md shadow-[#6c2bd9]/25 scale-105 font-bold"
                                                        : "bg-white border-slate-200 text-slate-700 hover:border-[#6c2bd9] hover:text-[#6c2bd9] hover:bg-[#6c2bd9]/5"
                                                }`}
                                            >
                                                {mName}
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {/* ── DAY SELECTOR GRID ── */}
                        {currentStep === "day" && (
                            <motion.div
                                key="day-section"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 8 }}
                                transition={{ duration: 0.15 }}
                                className="view-section space-y-2.5"
                            >
                                <div className="section-header flex justify-between items-center">
                                    <span className="section-title text-[10px] font-bold text-slate-500 tracking-widest uppercase">
                                        SELECT DATE ({monthAbbrs[selectedMonth]} {selectedYear})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep("month")}
                                        className="text-[10px] font-bold text-[#6c2bd9] hover:underline"
                                    >
                                        ← Change Month
                                    </button>
                                </div>

                                <div className="grid grid-days grid-cols-7 gap-1.5">
                                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                                        <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase py-1">
                                            {d}
                                        </div>
                                    ))}
                                    {dayBlanks.map((i) => (
                                        <div key={`blank-${i}`} className="h-8" />
                                    ))}
                                    {monthDays.map((d) => {
                                        const isSelected = selectedDay === d;
                                        return (
                                            <button
                                                type="button"
                                                key={d}
                                                onClick={() => handleSelectDay(d)}
                                                className={`day-item border rounded-xl h-8 flex items-center justify-center text-xs font-semibold transition-all duration-150 ${
                                                    isSelected
                                                        ? "selected bg-gradient-to-r from-[#6c2bd9] to-[#9333ea] text-white border-transparent shadow-md shadow-[#6c2bd9]/25 scale-110 font-bold"
                                                        : "bg-white border-slate-200 text-slate-700 hover:border-[#6c2bd9] hover:text-[#6c2bd9] hover:bg-[#6c2bd9]/5"
                                                }`}
                                            >
                                                {d}
                                            </button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}

                        {/* Informational Panel Footer */}
                        <div className="panel-footer flex justify-between items-center pt-2.5 border-t border-slate-100 text-xs">
                            <div className="age-validation flex items-center gap-1.5 font-semibold">
                                <span className={`status-dot w-2 h-2 rounded-full ${isAgeEligible ? "green bg-emerald-500" : "bg-amber-500"}`}></span>
                                <span className={isAgeEligible ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>
                                    {currentAge !== null ? `Age: ${currentAge} Yrs ${isAgeEligible ? "(Eligible)" : "(Min 18 required)"}` : "Click date to select"}
                                </span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-medium">Click date to set</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
