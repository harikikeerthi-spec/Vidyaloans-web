"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { searchUniversitiesInstant, registerAiDiscoveredUniversities, fetchAiUniversities, FastUniversity } from "@/lib/universitySearchEngine";
import { aiApi } from "@/lib/api";

interface FastAiUniversityInputProps {
    value: string;
    onChange: (val: string) => void;
    country?: string;
    otherCountry?: string;
    onCountryChange?: (countryName: string) => void;
    error?: string;
    placeholder?: string;
    required?: boolean;
    label?: string;
    id?: string;
    className?: string;
}

export default function FastAiUniversityInput({
    value,
    onChange,
    country = "",
    otherCountry = "",
    onCountryChange,
    error,
    placeholder = "Search university by name or abbreviation...",
    required = false,
    label = "Full University / College Name",
    id = "university-search-input",
    className = "",
}: FastAiUniversityInputProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [isAiSearching, setIsAiSearching] = useState(false);
    const [autoCountryNotification, setAutoCountryNotification] = useState<string | null>(null);
    const [aiAugmentedList, setAiAugmentedList] = useState<FastUniversity[]>([]);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const notificationTimerRef = useRef<NodeJS.Timeout | null>(null);

    const effectiveCountry = useMemo(() => {
        if (!country || country === "Other") return (otherCountry || "").trim();
        return country.trim();
    }, [country, otherCountry]);

    // Proactive background prefetch for country whenever dropdown opens
    useEffect(() => {
        if (!isOpen) return;
        const cached = searchUniversitiesInstant("", effectiveCountry, 5);
        if (cached.length < 5) {
            setIsAiSearching(true);
            fetchAiUniversities("", effectiveCountry || "Any")
                .then(unis => {
                    if (unis && unis.length > 0) {
                        setAiAugmentedList(unis);
                    }
                })
                .catch(() => {})
                .finally(() => setIsAiSearching(false));
        }
    }, [isOpen, effectiveCountry]);

    // 0ms Instant Client-Side Fuzzy & Alias Matcher
    const instantResults = useMemo(() => {
        return searchUniversitiesInstant(value, effectiveCountry, 8);
    }, [value, effectiveCountry]);

    // Combined Results: Instant + AI-discovered
    const combinedResults = useMemo(() => {
        const list: FastUniversity[] = [...instantResults];
        const seenNames = new Set(list.map(u => u.name.toLowerCase()));

        for (const aiUni of aiAugmentedList) {
            if (!seenNames.has(aiUni.name.toLowerCase())) {
                seenNames.add(aiUni.name.toLowerCase());
                list.push(aiUni);
            }
        }
        return list.slice(0, 10);
    }, [instantResults, aiAugmentedList]);

    // Background Asynchronous Live AI Search (150ms debounce)
    useEffect(() => {
        const query = (value || "").trim();

        // If query is short, don't waste AI calls
        if (query.length < 2) {
            setAiAugmentedList([]);
            setIsAiSearching(false);
            return;
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        const controller = new AbortController();
        abortControllerRef.current = controller;

        const timer = setTimeout(async () => {
            setIsAiSearching(true);
            try {
                const res: any = await aiApi.aiSearch({
                    type: "university",
                    query,
                    country: effectiveCountry || "Any"
                });

                if (controller.signal.aborted) return;

                const aiUnis = res?.universities || res?.results || [];
                if (Array.isArray(aiUnis) && aiUnis.length > 0) {
                    registerAiDiscoveredUniversities(aiUnis, effectiveCountry);

                    const formatted: FastUniversity[] = aiUnis.map((u: any) => {
                        const name = typeof u === "string" ? u : (u.name || u.university || "");
                        const loc = typeof u === "object" ? (u.loc || u.location || effectiveCountry || "Global") : (effectiveCountry || "Global");
                        const c = typeof u === "object" ? (u.country || effectiveCountry || "Global") : (effectiveCountry || "Global");
                        const rank = typeof u === "object" && typeof u.rank === "number" ? u.rank : undefined;

                        return {
                            name,
                            loc,
                            country: c,
                            rank,
                            badge: rank && rank <= 500 ? `QS #${rank}` : "AI Match",
                            isAiDiscovered: true
                        };
                    }).filter((u: FastUniversity) => Boolean(u.name));

                    setAiAugmentedList(formatted);
                }
            } catch (err: any) {
                // Ignore abort errors
                if (err?.name !== "AbortError") {
                    console.debug("AI background search skipped:", err);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsAiSearching(false);
                }
            }
        }, 150);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [value, effectiveCountry]);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Handle selecting a university
    const handleSelectUniversity = useCallback((uni: FastUniversity) => {
        onChange(uni.name);
        setIsOpen(false);
        setHighlightedIndex(-1);

        // Auto-detect and sync destination country if different or unselected
        if (onCountryChange && uni.country && uni.country !== "Global") {
            const currentCountryClean = (effectiveCountry || "").toLowerCase().trim();
            const uniCountryClean = uni.country.toLowerCase().trim();

            if (!currentCountryClean || (currentCountryClean !== uniCountryClean && !uniCountryClean.includes(currentCountryClean))) {
                onCountryChange(uni.country);
                setAutoCountryNotification(`Study destination automatically set to ${uni.country}`);

                if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
                notificationTimerRef.current = setTimeout(() => {
                    setAutoCountryNotification(null);
                }, 4000);
            }
        }
    }, [onChange, onCountryChange, effectiveCountry]);

    // Keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen) {
            if (e.key === "ArrowDown" || e.key === "Enter") {
                setIsOpen(true);
            }
            return;
        }

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex(prev => (prev + 1 < combinedResults.length ? prev + 1 : 0));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : combinedResults.length - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < combinedResults.length) {
                handleSelectUniversity(combinedResults[highlightedIndex]);
            } else if (value.trim()) {
                setIsOpen(false);
            }
        } else if (e.key === "Escape") {
            setIsOpen(false);
        }
    };

    // Highlight matching query text
    const renderHighlightedName = (name: string, query: string) => {
        if (!query.trim()) return name;
        const q = query.trim();
        const idx = name.toLowerCase().indexOf(q.toLowerCase());
        if (idx === -1) return name;

        return (
            <>
                {name.substring(0, idx)}
                <span className="text-[#6605c7] bg-purple-100/80 font-black rounded px-0.5">
                    {name.substring(idx, idx + q.length)}
                </span>
                {name.substring(idx + q.length)}
            </>
        );
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Field Label & Indicators */}
            <div className="flex items-center justify-between mb-2">
                <label htmlFor={id} className="text-[11px] uppercase tracking-[0.2em] font-black text-gray-500 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-[#6605c7]">school</span>
                    {label}
                    {required && <span className="text-rose-500 font-black">*</span>}
                </label>

                {/* AI Status Badge */}
                <div className="flex items-center gap-1.5">
                    {isAiSearching ? (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-[#6605c7] text-[10px] font-bold animate-pulse">
                            <div className="w-2.5 h-2.5 border-2 border-[#6605c7] border-t-transparent rounded-full animate-spin" />
                            <span>AI Searching</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black tracking-wide">
                            <span className="material-symbols-outlined text-xs text-emerald-600">bolt</span>
                            <span>Instant AI Search</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Input Element */}
            <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#6605c7] transition-colors pointer-events-none flex items-center">
                    <span className="material-symbols-outlined text-xl">domain</span>
                </div>

                <input
                    ref={inputRef}
                    id={id}
                    type="text"
                    value={value}
                    onChange={(e) => {
                        onChange(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    className={`w-full pl-12 pr-11 py-3.5 bg-white border ${
                        error ? "border-rose-400 focus:ring-rose-200" : "border-gray-200 focus:border-[#6605c7] focus:ring-purple-100"
                    } rounded-2xl text-sm font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 transition-all shadow-sm`}
                />

                {/* Clear / AI action icon */}
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {value ? (
                        <button
                            type="button"
                            onClick={() => {
                                onChange("");
                                inputRef.current?.focus();
                                setIsOpen(true);
                            }}
                            className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors"
                            title="Clear university"
                        >
                            <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                    ) : (
                        <span className="material-symbols-outlined text-gray-300 text-lg">search</span>
                    )}
                </div>
            </div>

            {/* Auto-Country notification pill */}
            {autoCountryNotification && (
                <div className="mt-1.5 flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold rounded-xl animate-fade-in shadow-xs">
                    <span className="material-symbols-outlined text-xs text-emerald-600">check_circle</span>
                    <span>{autoCountryNotification}</span>
                </div>
            )}

            {/* Field Error Message */}
            {error && (
                <p className="text-rose-500 text-xs font-bold mt-1.5 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">warning</span>
                    {error}
                </p>
            )}

            {/* Ultra-Fast Instant Suggestions Dropdown */}
            {isOpen && (
                <div className="absolute z-50 left-0 right-0 mt-2 bg-white/98 backdrop-blur-xl border border-purple-100 rounded-2xl shadow-2xl overflow-hidden divide-y divide-gray-100 animate-fade-in-up">
                    {/* Header bar */}
                    <div className="px-4 py-2.5 bg-gradient-to-r from-purple-50 via-indigo-50/60 to-purple-50 flex items-center justify-between border-b border-purple-100/60 text-[11px]">
                        <div className="flex items-center gap-1.5 text-[#6605c7] font-black">
                            <span className="material-symbols-outlined text-sm">auto_awesome</span>
                            <span>Top AI University Matches</span>
                            {effectiveCountry && (
                                <span className="text-gray-500 font-semibold">• {effectiveCountry}</span>
                            )}
                        </div>
                        <span className="text-[10px] text-gray-400 font-medium select-none">
                            {combinedResults.length} instant results
                        </span>
                    </div>

                    {/* Universities List */}
                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                        {combinedResults.map((uni, idx) => {
                            const isSelected = highlightedIndex === idx;
                            return (
                                <button
                                    key={`${uni.name}-${idx}`}
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleSelectUniversity(uni);
                                    }}
                                    onMouseEnter={() => setHighlightedIndex(idx)}
                                    className={`w-full px-4 py-3 text-left flex items-center justify-between gap-3 transition-colors ${
                                        isSelected ? "bg-purple-50/80 text-[#6605c7]" : "hover:bg-purple-50/50 text-gray-800"
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                                            isSelected ? "bg-purple-600 text-white border-purple-600" : "bg-purple-50 text-[#6605c7] border-purple-100"
                                        } transition-colors`}>
                                            <span className="material-symbols-outlined text-base">school</span>
                                        </div>

                                        <div className="flex flex-col min-w-0">
                                            <div className="text-xs font-black text-gray-900 truncate flex items-center gap-2">
                                                <span>{renderHighlightedName(uni.name, value)}</span>
                                                {uni.badge && (
                                                    <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-[#6605c7] text-[9px] font-black uppercase tracking-wider shrink-0">
                                                        {uni.badge}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-medium flex items-center gap-1.5 truncate">
                                                <span>{uni.loc}</span>
                                                <span>•</span>
                                                <span className="font-bold text-gray-600">{uni.country}</span>
                                                {uni.rank && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="text-amber-600 font-bold">World #{uni.rank}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        <span className="material-symbols-outlined text-[#6605c7] text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                                            arrow_forward
                                        </span>
                                    </div>
                                </button>
                            );
                        })}

                        {/* Custom Typed Option */}
                        {value.trim().length >= 2 && !combinedResults.some(u => u.name.toLowerCase() === value.trim().toLowerCase()) && (
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    onChange(value.trim());
                                    setIsOpen(false);
                                }}
                                className="w-full px-4 py-3 text-left flex items-center gap-3 bg-gray-50/60 hover:bg-purple-50/60 text-gray-700 transition-colors"
                            >
                                <div className="w-8 h-8 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 text-gray-500">
                                    <span className="material-symbols-outlined text-base">edit_note</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-gray-900">Use &quot;{value.trim()}&quot; as custom university</span>
                                    <span className="text-[10px] text-gray-400 font-medium">Click to select exact typed institution name</span>
                                </div>
                            </button>
                        )}

                        {combinedResults.length === 0 && !isAiSearching && (
                            <div className="p-5 text-center text-gray-400 text-xs font-bold">
                                No matching institutions found. You can continue typing to specify your college.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
