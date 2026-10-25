"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { universities as staticUniversitiesDict } from "@/lib/universityData";

const POPULAR_COUNTRIES = [
    "All Countries",
    "United States",
    "United Kingdom",
    "Canada",
    "Australia",
    "Germany",
    "Singapore",
    "France",
    "Netherlands",
];

const TableHeader = ({ children }: { children: React.ReactNode }) => (
    <thead className="bg-slate-50/80 border-b border-slate-200/80 text-slate-500 text-[11px] uppercase tracking-wider font-sans font-bold text-left">
        <tr>{children}</tr>
    </thead>
);

export default function SearchUniversitiesClient() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCountry, setSelectedCountry] = useState("All Countries");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(15);
    const [loading, setLoading] = useState(false);
    const [dynamicResults, setDynamicResults] = useState<any[]>([]);

    // Convert static dictionary to array
    const staticList = useMemo(() => {
        return Object.values(staticUniversitiesDict);
    }, []);

    // Combine static and dynamic results
    const allUniversities = useMemo(() => {
        const combined = [...staticList];
        dynamicResults.forEach((dyn) => {
            if (!combined.some(u => u.name.toLowerCase() === dyn.name.toLowerCase())) {
                combined.push({
                    slug: dyn.slug || dyn.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                    name: dyn.name,
                    shortName: dyn.name.split(' ').map((w: string) => w[0]).join('').slice(0, 4),
                    location: dyn.city || dyn.country || "Global",
                    country: dyn.country || "International",
                    countryCode: dyn.countryCode || '',
                    flag: dyn.flag || '🌐',
                    founded: dyn.founded || 1900,
                    type: dyn.type || 'University',
                    rank: dyn.worldRanking || dyn.ranking || dyn.rank || 500,
                    rankBy: 'QS World Rankings',
                    acceptanceRate: dyn.acceptanceRate || dyn.accept || 25,
                    tuition: typeof dyn.tuition === 'number' ? dyn.tuition : (parseInt(String(dyn.averageFees || '25000').replace(/[^0-9]/g, '')) || 25000),
                    currency: dyn.currency || 'USD',
                    description: dyn.description || '',
                    heroImage: '',
                    campusImages: [],
                    logo: dyn.website ? `https://logo.clearbit.com/${dyn.website.replace(/^https?:\/\//, '')}` : '',
                    primaryColor: '#4F46E5',
                    gradient: '',
                    badge: '',
                    website: dyn.website || '',
                    stats: { totalStudents: '—', internationalStudents: '—', facultyRatio: '—', researchOutput: '—', employmentRate: '—', avgSalary: '—' },
                    programs: [],
                    topRecruiters: [],
                    requirements: { gpa: '3.0', ielts: '6.5', toefl: '80', gre: '300' },
                    loanInfo: { availableLenders: ['HDFC Credila', 'Avanse', 'IDFC FIRST'], avgLoanAmount: '$40,000', collateralFree: true, fastTrack: true, notes: '' },
                    pros: [],
                    campusFacilities: []
                });
            }
        });
        return combined;
    }, [staticList, dynamicResults]);

    const handleSearchClick = useCallback(async () => {
        setLoading(true);
        try {
            const countriesToSearch = selectedCountry === "All Countries" ? POPULAR_COUNTRIES.slice(1) : [selectedCountry];
            const res = await fetch("/api/university-search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ countries: countriesToSearch, limit: 50 })
            });
            const data = await res.json();
            if (data.results || data.universities) {
                setDynamicResults(data.results || data.universities || []);
            }
        } catch (e) {
            console.error("Failed to fetch university data:", e);
        } finally {
            setLoading(false);
        }
    }, [selectedCountry]);

    const filteredData = useMemo(() => {
        return allUniversities.filter((item) => {
            const query = searchQuery.toLowerCase();
            const matchesQuery = item.name.toLowerCase().includes(query) ||
                item.country.toLowerCase().includes(query) ||
                (item.location && item.location.toLowerCase().includes(query));

            const matchesCountry = selectedCountry === "All Countries" ||
                item.country.toLowerCase().includes(selectedCountry.toLowerCase()) ||
                (selectedCountry === "United States" && (item.country === "USA" || item.country === "United States"));

            return matchesQuery && matchesCountry;
        });
    }, [allUniversities, searchQuery, selectedCountry]);

    const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
    const pagedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredData.slice(start, start + itemsPerPage);
    }, [filteredData, currentPage, itemsPerPage]);

    const showingStart = filteredData.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const showingEnd = Math.min(currentPage * itemsPerPage, filteredData.length);

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto animate-fade-in pb-12 pt-28 px-4 sm:px-6 font-sans">
            {/* Header & Controls Bar */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#0A2540]">
                        Global Universities Directory
                    </h1>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">Explore 500+ verified institutions, global rankings, tuition &amp; study loan funding</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSearchClick}
                        disabled={loading}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                        <span className={`material-symbols-outlined text-[16px] ${loading ? "animate-spin" : ""}`}>refresh</span>
                        {loading ? "Refreshing..." : "Refresh"}
                    </button>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                            placeholder="Search university or country..."
                            className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 w-64 shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Country Filters Bar */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {POPULAR_COUNTRIES.map((c) => (
                    <button
                        key={c}
                        onClick={() => { setSelectedCountry(c); setCurrentPage(1); }}
                        className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shrink-0 cursor-pointer inline-flex items-center justify-center ${selectedCountry === c
                            ? "bg-[#4F46E5] text-white border-indigo-600 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                            }`}
                    >
                        {c}
                    </button>
                ))}
            </div>

            {/* Main Table Container */}
            <div className="rounded-[24px] border border-slate-100 overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <TableHeader>
                            <th className="px-6 py-4">Institution Profile</th>
                            <th className="px-6 py-4">Country & Location</th>
                            <th className="px-6 py-4">Global Rank</th>
                            <th className="px-6 py-4">Acceptance Rate</th>
                            <th className="px-6 py-4">Estimated Tuition</th>
                            <th className="px-6 py-4 text-center">Actions</th>
                        </TableHeader>
                        <tbody className={`divide-y divide-slate-50 ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
                            {pagedData.length > 0 ? (
                                pagedData.map((item) => {
                                    const rowId = item.slug || item.name;
                                    const initials = item.shortName || item.name.slice(0, 2).toUpperCase();

                                    return (
                                        <tr key={rowId} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-black text-xs text-[#4F46E5] shrink-0 overflow-hidden">
                                                        {item.logo ? (
                                                            <img
                                                                src={item.logo}
                                                                alt={item.name}
                                                                className="w-full h-full object-contain p-1"
                                                                onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                                            />
                                                        ) : (
                                                            <span>{initials}</span>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p
                                                            onClick={() => router.push(`/university/${item.slug}`)}
                                                            className="text-sm font-bold text-slate-950 hover:text-indigo-600 cursor-pointer transition-colors truncate max-w-[280px]"
                                                            title={item.name}
                                                        >
                                                            {item.name}
                                                        </p>
                                                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                                            {item.type || "University"} • Founded {item.founded || "—"}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="space-y-0.5">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#4F46E5]/10 text-[#4F46E5] border border-indigo-200">
                                                        {item.flag} {item.country}
                                                    </span>
                                                    <p className="text-[11px] text-slate-500 font-semibold">{item.location}</p>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                                                    <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                                                    QS #{item.rank || "N/A"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs text-slate-700 font-bold">
                                                    {item.acceptanceRate ? `${item.acceptanceRate}%` : "—"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-xs text-emerald-700 font-mono font-bold">
                                                    {item.tuition ? `${item.currency === "INR" ? "₹" : "$"}${Number(item.tuition).toLocaleString()}/yr` : "—"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => router.push(`/university/${item.slug}`)}
                                                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-all border border-indigo-200 cursor-pointer flex items-center gap-1 active:scale-95"
                                                        title="View full university details"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                        View Details
                                                    </button>
                                                    <button
                                                        onClick={() => router.push(`/apply-loan?university=${encodeURIComponent(item.name)}&country=${encodeURIComponent(item.country)}`)}
                                                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-all border border-emerald-200 cursor-pointer flex items-center gap-1 active:scale-95"
                                                        title="Apply for education loan"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">payments</span>
                                                        Apply Loan
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-8 py-24 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4 text-slate-400">
                                            <span className="material-symbols-outlined text-5xl">domain_disabled</span>
                                            <p className="text-[12px] font-black uppercase tracking-widest">No Universities Found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {filteredData.length > itemsPerPage && (
                    <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <p className="text-[11px] font-bold text-slate-700">
                            Showing <span className="text-indigo-600">{showingStart}-{showingEnd}</span> of {filteredData.length} entries
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={currentPage === 1 || loading}
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                                Previous
                            </button>
                            <button
                                disabled={currentPage >= totalPages || loading}
                                onClick={() => setCurrentPage(prev => prev + 1)}
                                className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                            >
                                Next
                                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
