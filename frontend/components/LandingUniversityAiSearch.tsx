"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getAllCountries } from "@/lib/countriesData";
import { aiApi, referenceApi } from "@/lib/api";

const popularCountries = ["USA", "UK", "Canada", "Australia", "Germany", "Ireland", "New Zealand", "Other"];
const allCountries = getAllCountries();

interface UniversityItem {
    name: string;
    loc: string;
    country: string;
    slug: string;
    ranking?: string;
    popularCourse?: string;
}

export default function LandingUniversityAiSearch() {
    const [selectedCountry, setSelectedCountry] = useState<string>("USA");
    const [otherCountry, setOtherCountry] = useState<string>("");
    const [otherCountrySearch, setOtherCountrySearch] = useState<string>("");
    const [isOtherDropdownOpen, setIsOtherDropdownOpen] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [universities, setUniversities] = useState<UniversityItem[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [countryOptions, setCountryOptions] = useState<string[]>(popularCountries);
    const otherDropdownRef = useRef<HTMLDivElement>(null);

    // Load dynamic study destinations from backend
    useEffect(() => {
        referenceApi.getCountries()
            .then((res: any) => {
                if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
                    const activeNames: string[] = res.data
                        .filter((c: any) => c.isActive !== false && c.name)
                        .map((c: any) => c.name.trim());
                    if (activeNames.length > 0) {
                        const uniqueNames = Array.from(new Set(activeNames));
                        const filtered = uniqueNames.filter((n: string) => n !== "Other");
                        setCountryOptions([...filtered, "Other"]);
                    }
                }
            })
            .catch(() => {});
    }, []);

    // Close other country dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (otherDropdownRef.current && !otherDropdownRef.current.contains(e.target as Node)) {
                setIsOtherDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const effectiveCountry = selectedCountry === "Other" ? otherCountry : selectedCountry;

    // AI search effect
    useEffect(() => {
        let active = true;
        const queryText = searchQuery.trim();

        if (!effectiveCountry && !queryText) {
            setUniversities([]);
            return;
        }

        const delay = queryText.length === 0 ? 0 : 350;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = (await aiApi.aiSearch({
                    type: "university",
                    query: queryText,
                    country: effectiveCountry || "",
                })) as any;

                if (!active) return;

                const aiUnis = res?.universities || res?.results || [];
                const formatted: UniversityItem[] = [];

                aiUnis.forEach((u: any) => {
                    let uniName = "";
                    let uniLoc = "";
                    let uniCountry = "";
                    if (typeof u === "string") {
                        uniName = u;
                    } else if (u && typeof u === "object") {
                        uniName = u.name || u.university || "";
                        uniLoc = u.loc || u.location || "";
                        uniCountry = u.country || "";
                    }

                    if (uniName && !formatted.some((m) => m.name.toLowerCase() === uniName.toLowerCase())) {
                        formatted.push({
                            name: uniName,
                            loc: uniLoc || uniCountry || effectiveCountry || "Global",
                            country: uniCountry || effectiveCountry || "",
                            slug: uniName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                        });
                    }
                });

                setUniversities(formatted.slice(0, 8));
            } catch (err) {
                console.error("AI University Search Error:", err);
            } finally {
                if (active) setLoading(false);
            }
        }, delay);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [effectiveCountry, searchQuery]);

    const filteredOtherCountries = allCountries.filter((c) =>
        c.toLowerCase().includes(otherCountrySearch.toLowerCase())
    );

    return (
        <section className="py-20 bg-transparent relative overflow-hidden" id="explore-universities">
            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Header */}
                <div className="text-center mb-10">
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#6605c7]/10 text-[#6605c7] text-[11px] font-black uppercase tracking-widest mb-4 border border-[#6605c7]/15">
                        <span className="material-symbols-outlined text-sm">smart_toy</span>
                        AI University Explorer
                    </span>
                    <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4 leading-tight">
                        Find & Fund Your <span className="text-[#6605c7]">Target University</span>
                    </h2>
                    <p className="text-gray-500 text-[13px] font-medium max-w-xl mx-auto">
                        Powered by AI — explore top-ranked global universities, compare loan eligibility, and get pre-approved in minutes.
                    </p>
                </div>

                {/* Search & Country Bar Container */}
                <div className="max-w-4xl mx-auto bg-white/80 backdrop-blur-xl p-5 md:p-7 rounded-3xl border border-purple-100 shadow-xl shadow-purple-950/5 mb-10">
                    {/* Country Pills */}
                    <div className="mb-5">
                        <div className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-[#6605c7]">public</span>
                            Select Study Destination
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                            {countryOptions.map((c, idx) => (
                                <button
                                    key={`${c}-${idx}`}
                                    type="button"
                                    onClick={() => {
                                        setSelectedCountry(c);
                                        if (c !== "Other") {
                                            setOtherCountry("");
                                        } else {
                                            setIsOtherDropdownOpen(true);
                                        }
                                    }}
                                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                        selectedCountry === c
                                            ? "bg-[#6605c7] text-white shadow-md shadow-[#6605c7]/25 scale-105"
                                            : "bg-purple-50/60 hover:bg-purple-100/60 text-gray-700 border border-purple-100"
                                    }`}
                                >
                                    {c === "Other" && otherCountry ? `Other: ${otherCountry}` : c}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* If 'Other' is selected, show searchable all-countries dropdown */}
                    {selectedCountry === "Other" && (
                        <div className="relative mb-5" ref={otherDropdownRef}>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                Select from all countries ({allCountries.length} destinations)
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={isOtherDropdownOpen ? otherCountrySearch : otherCountry || otherCountrySearch}
                                    onChange={(e) => {
                                        setOtherCountrySearch(e.target.value);
                                        setIsOtherDropdownOpen(true);
                                    }}
                                    onFocus={() => setIsOtherDropdownOpen(true)}
                                    placeholder="Type to search any country (e.g. France, Sweden, Singapore)..."
                                    className="w-full pl-10 pr-10 py-3 bg-white rounded-xl border border-purple-200 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6605c7]/40 shadow-xs"
                                />
                                <span className="material-symbols-outlined absolute left-3 top-3 text-gray-400 text-lg">search</span>
                                {otherCountry && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOtherCountry("");
                                            setOtherCountrySearch("");
                                        }}
                                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 text-sm font-bold"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Dropdown Menu */}
                            {isOtherDropdownOpen && (
                                <div className="absolute left-0 right-0 top-full mt-1 max-h-60 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-2xl z-50 py-1">
                                    {filteredOtherCountries.length > 0 ? (
                                        filteredOtherCountries.map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => {
                                                    setOtherCountry(c);
                                                    setOtherCountrySearch("");
                                                    setIsOtherDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-purple-50 hover:text-[#6605c7] transition-colors flex items-center justify-between ${
                                                    otherCountry === c ? "bg-purple-50 text-[#6605c7]" : "text-gray-700"
                                                }`}
                                            >
                                                <span>{c}</span>
                                                {otherCountry === c && (
                                                    <span className="material-symbols-outlined text-sm text-[#6605c7]">check</span>
                                                )}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-4 py-3 text-xs text-gray-400 text-center font-medium">
                                            No matching country found
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* AI University Search Input */}
                    <div className="relative">
                        <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-4 text-[#6605c7] text-xl">auto_awesome</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder={
                                    effectiveCountry
                                        ? `Search universities in ${effectiveCountry} with AI (e.g. Stanford, Toronto, Oxford)...`
                                        : "Search any global university with AI..."
                                }
                                className="w-full pl-12 pr-12 py-3.5 bg-gray-50/80 hover:bg-white focus:bg-white rounded-2xl border border-purple-100 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6605c7]/40 shadow-inner transition-all"
                            />
                            {loading ? (
                                <div className="absolute right-4 w-5 h-5 border-2 border-[#6605c7] border-t-transparent rounded-full animate-spin" />
                            ) : searchQuery ? (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-4 text-gray-400 hover:text-gray-600 text-sm font-bold"
                                >
                                    ✕
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* Universities Grid */}
                {loading && universities.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="inline-block w-8 h-8 border-3 border-[#6605c7] border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-xs font-bold text-gray-400">AI is curating universities in {effectiveCountry || "all destinations"}...</p>
                    </div>
                ) : universities.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {universities.map((uni, idx) => (
                            <div
                                key={uni.name + idx}
                                className="group relative bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-purple-100/80 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-[#6605c7] shrink-0 group-hover:scale-110 transition-transform">
                                            <span className="material-symbols-outlined text-xl">school</span>
                                        </div>
                                        <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                                            100% Eligible
                                        </span>
                                    </div>

                                    <h4 className="text-sm font-black text-gray-900 leading-snug group-hover:text-[#6605c7] transition-colors line-clamp-2 mb-1.5">
                                        {uni.name}
                                    </h4>

                                    <p className="text-[11px] font-medium text-gray-500 flex items-center gap-1 mb-4">
                                        <span className="material-symbols-outlined text-xs text-gray-400">location_on</span>
                                        <span className="truncate">{uni.loc || uni.country}</span>
                                    </p>
                                </div>

                                <div className="pt-3 border-t border-gray-100 space-y-2">
                                    <Link
                                        href={`/apply-loan?university=${encodeURIComponent(uni.name)}&country=${encodeURIComponent(uni.country || effectiveCountry)}`}
                                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-gradient-to-r from-[#6605c7] to-[#8b24e5] text-white text-xs font-black shadow-md shadow-[#6605c7]/20 hover:opacity-95 active:scale-95 transition-all"
                                    >
                                        <span>Apply Loan</span>
                                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                                    </Link>

                                    <Link
                                        href={`/university/${uni.slug}`}
                                        className="w-full flex items-center justify-center py-1.5 text-[11px] font-bold text-gray-500 hover:text-[#6605c7] transition-colors"
                                    >
                                        View University Profile
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white/50 backdrop-blur-sm rounded-2xl border border-gray-100 max-w-lg mx-auto">
                        <span className="material-symbols-outlined text-4xl text-gray-300 mb-2">school</span>
                        <p className="text-sm font-bold text-gray-600">No universities found for this search.</p>
                        <p className="text-xs text-gray-400 mt-1">Try another country or search term.</p>
                    </div>
                )}
            </div>
        </section>
    );
}
