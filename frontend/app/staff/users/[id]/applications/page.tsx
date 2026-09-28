"use client";

import { useUserDossier } from "../DossierContext";
import { motion, AnimatePresence } from "framer-motion";
import { formatDate, parseUTCDate } from "@/lib/utils";
import { useState, useEffect, useRef, useMemo } from "react";
import { applicationApi, aiApi, staffProfileApi } from "@/lib/api";
import { getAllCountries } from "@/lib/countriesData";

const banksList = [
    { id: "idfc", name: "IDFC First Bank", rate: "10.5 - 12.5%" },
    { id: "hdfc", name: "HDFC Credila", rate: "10.75 - 12.5%" },
    { id: "auxilo", name: "Auxilo Finserve", rate: "11.25 - 13.5%" },
    { id: "avanse", name: "Avanse Financial", rate: "10.99 - 13.0%" },
    { id: "poonawalla", name: "Poonawalla Fincorp", rate: "11.5 - 14.5%" },
];

const loanTypes = ["Undergraduate Abroad", "Postgraduate Abroad", "Doctoral/PhD Abroad", "Professional Course"];
const courseTypes = ["B.Tech/B.E.", "MBA/PGDM", "MS/M.Tech", "MBBS/Medicine", "Law", "Architecture", "Arts & Humanities", "Other"];
const countries = ["USA", "UK", "Canada", "Australia", "Germany", "Ireland", "New Zealand", "Other"];
const relations = ["Father", "Mother", "Aunt", "Spouse", "Uncle", "Brother", "Other", "None"];

function getFileAge(dateString: string | Date | undefined): string {
    if (!dateString) return "—";
    try {
        const now = new Date();
        const created = parseUTCDate(dateString);
        const diffMs = now.getTime() - created.getTime();
        if (diffMs < 0) return "Just now";

        const diffMins = Math.floor(diffMs / (1000 * 60));
        if (diffMins < 60) return `${diffMins}m ago`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;

        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
    } catch {
        return "—";
    }
}

function SearchableCountrySelect({
    value,
    onChange,
}: {
    value: string;
    onChange: (val: string) => void;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);
    const allCountries = useMemo(() => getAllCountries(), []);

    const filteredOptions = useMemo(() => {
        if (!search.trim()) return allCountries;
        return allCountries.filter(c => c.toLowerCase().includes(search.toLowerCase()));
    }, [allCountries, search]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={dropdownRef} className="relative">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Specify Country Name *
            </label>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer flex items-center justify-between hover:border-indigo-300 transition-all min-h-[38px]"
            >
                <span className={value ? "text-slate-800 font-bold" : "text-slate-400"}>
                    {value || "Select Country..."}
                </span>
                <span className="material-symbols-outlined text-[16px] text-slate-400">
                    {isOpen ? 'expand_less' : 'expand_more'}
                </span>
            </div>

            {isOpen && (
                <div className="absolute z-[110] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-hidden flex flex-col animate-fade-in">
                    <div className="p-2 border-b border-slate-100 bg-slate-50 sticky top-0 z-10 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[15px] text-slate-400">search</span>
                        <input
                            type="text"
                            autoFocus
                            placeholder="Search countries..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none placeholder:text-slate-400"
                        />
                    </div>

                    <div className="overflow-y-auto max-h-48 py-1 divide-y divide-slate-50">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => {
                                        onChange(c);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-600 transition-colors flex items-center justify-between ${
                                        value === c ? "bg-indigo-50/70 text-indigo-700 font-bold" : "text-slate-700"
                                    }`}
                                >
                                    <span>{c}</span>
                                    {value === c && (
                                        <span className="material-symbols-outlined text-[14px] text-indigo-600">check</span>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="p-3 text-center text-xs text-slate-400 italic">
                                No countries found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function checkCountryUniversityMatch(
    selectedCountry: string,
    universityName: string,
    selectedUniObj?: any,
    suggestedUnis?: any[]
): { isValid: boolean; error?: string } {
    if (!universityName || !universityName.trim()) {
        return { isValid: false, error: "University name is required." };
    }
    if (!selectedCountry) return { isValid: true };

    const genericWords = new Set([
        'university', 'universities', 'college', 'colleges', 'school', 'schools',
        'academy', 'academies', 'institute', 'institutes', 'institution', 'institutions',
        'polytechnic', 'polytechnics', 'hochschule', 'fachhochschule', 'campus',
        'education', 'educational', 'studies', 'study', 'center', 'centre',
        'of', 'and', '&', 'the', 'a', 'an', 'in', 'for', 'my', 'your', 'our', 'higher', 'degree'
    ]);
    const words = (universityName || '').toLowerCase().replace(/[\/\\.,\-_&()]/g, ' ').split(/\s+/).filter(Boolean);
    if (words.length > 0 && words.every(w => genericWords.has(w))) {
        return {
            isValid: false,
            error: `Validation Error: "${universityName}" is a generic term. Please specify a full university name.`
        };
    }

    const normalizeCountry = (c: string) => {
        const low = (c || '').toLowerCase().trim();
        if (low.includes('usa') || low.includes('united states') || low.includes('america')) return 'USA';
        if (low.includes('uk') || low.includes('united kingdom') || low.includes('britain') || low.includes('england') || low.includes('scotland') || low.includes('wales')) return 'UK';
        if (low.includes('canada')) return 'Canada';
        if (low.includes('australia')) return 'Australia';
        if (low.includes('germany') || low.includes('deutschland')) return 'Germany';
        if (low.includes('ireland')) return 'Ireland';
        if (low.includes('new zealand')) return 'New Zealand';
        if (low.includes('france')) return 'France';
        if (low.includes('singapore')) return 'Singapore';
        if (low.includes('india')) return 'India';
        return c.trim();
    };

    const normSelectedCountry = normalizeCountry(selectedCountry);

    // Explicit university selection match check
    if (selectedUniObj && (selectedUniObj.name || '').toLowerCase() === universityName.toLowerCase()) {
        const uniCountry = selectedUniObj.country || selectedUniObj.loc;
        if (uniCountry) {
            const normUniCountry = normalizeCountry(uniCountry);
            if (normUniCountry && normUniCountry !== normSelectedCountry) {
                return {
                    isValid: false,
                    error: `Validation Error: "${universityName}" is located in ${uniCountry}, which does not match your selected destination country (${selectedCountry}). Please select a university in ${selectedCountry} or change the destination country.`
                };
            }
        }
    }

    // Check suggestions list
    const foundInSuggestions = (suggestedUnis || []).find(
        u => (u.name || '').toLowerCase() === universityName.toLowerCase()
    );
    if (foundInSuggestions) {
        const uniCountry = foundInSuggestions.country || foundInSuggestions.loc;
        if (uniCountry) {
            const normUniCountry = normalizeCountry(uniCountry);
            if (normUniCountry && normUniCountry !== normSelectedCountry) {
                return {
                    isValid: false,
                    error: `Validation Error: "${universityName}" is located in ${uniCountry}, which does not match your selected destination country (${selectedCountry}). Please select a university in ${selectedCountry} or change the destination country.`
                };
            }
        }
    }

    // Keyword fallback check for popular universities
    const KNOWN_UNIVERSITIES: { country: string; keywords: string[] }[] = [
        {
            country: 'USA',
            keywords: [
                'harvard', 'stanford', 'mit', 'massachusetts institute of technology', 'columbia university',
                'nyu', 'new york university', 'cornell', 'yale', 'princeton', 'ucla', 'uc berkeley',
                'northeastern university', 'usc', 'university of southern california', 'carnegie mellon',
                'purdue', 'texas a&m', 'university of texas', 'georgia tech', 'penn state', 'northwestern',
                'johns hopkins', 'duke', 'chicago', 'arizona state', 'boston university'
            ],
        },
        {
            country: 'UK',
            keywords: [
                'oxford', 'cambridge', 'imperial college', 'ucl', 'university college london',
                'king\'s college london', 'kcl', 'university of edinburgh', 'university of manchester',
                'warwick', 'bristol', 'glasgow', 'birmingham', 'leeds', 'sheffield', 'nottingham'
            ],
        },
        {
            country: 'Canada',
            keywords: [
                'university of toronto', 'ubc', 'university of british columbia', 'mcgill',
                'waterloo', 'mcmaster', 'university of alberta', 'western university', 'simon fraser',
                'concordia', 'york university'
            ],
        },
        {
            country: 'Australia',
            keywords: [
                'university of melbourne', 'university of sydney', 'unsw', 'university of new south wales',
                'monash', 'university of queensland', 'anu', 'australian national university',
                'western australia', 'adelaide'
            ],
        },
        {
            country: 'Germany',
            keywords: [
                'tum', 'technical university of munich', 'lmu munich', 'rwth aachen',
                'heidelberg university', 'hu berlin', 'humboldt', 'free university of berlin',
                'university of stuttgart', 'tu darmstadt', 'tu dresden', 'bonn', 'karlsruhe'
            ],
        },
        {
            country: 'Ireland',
            keywords: [
                'trinity college dublin', 'tcd', 'university college dublin', 'ucd',
                'university of galway', 'university of limerick', 'dcu', 'dublin city university'
            ],
        },
    ];

    const uniLower = universityName.toLowerCase().trim();
    for (const group of KNOWN_UNIVERSITIES) {
        if (group.keywords.some(kw => uniLower.includes(kw))) {
            if (group.country !== normSelectedCountry) {
                return {
                    isValid: false,
                    error: `Validation Error: "${universityName}" is located in ${group.country}, which does not match your selected destination country (${selectedCountry}). Please select a university in ${selectedCountry} or update the destination country.`
                };
            }
        }
    }

    return { isValid: true };
}

export default function ApplicationsTab() {
    const { userId, userData, userApplications, refreshData, setRoutingApp, setIsShareModalOpen } = useUserDossier();
    const [isAddAppOpen, setIsAddAppOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");

    const [formData, setFormData] = useState({
        bank: "Any Bank",
        loanType: "Postgraduate Abroad",
        amount: "4000000",
        courseType: "MS/M.Tech",
        country: "USA",
        otherCountry: "",
        university: "",
        annualFee: "",
        livingCost: "",
        coApplicant: "none",
        otherRelation: "",
        income: "",
        collateral: "no",
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        dateOfBirth: "",
        address: "",
        pincode: "",
        notes: "",
        admissionStatus: "waiting",
        intakeSeason: "",
    });

    const [suggestedUniversities, setSuggestedUniversities] = useState<any[]>([]);
    const [selectedUniObj, setSelectedUniObj] = useState<any>(null);
    const [loadingUniversities, setLoadingUniversities] = useState(false);
    const [showUniversitySuggestions, setShowUniversitySuggestions] = useState(false);

    // Fetch popular universities for the selected country using AI backend
    useEffect(() => {
        const selectedCountry = formData.country === "Other" ? formData.otherCountry : formData.country;
        if (!selectedCountry || selectedCountry.trim().length < 2) {
            setSuggestedUniversities([]);
            return;
        }

        const delay = formData.university ? 350 : 0;
        const timer = setTimeout(async () => {
            setLoadingUniversities(true);
            try {
                const res = await aiApi.aiSearch({
                    type: "university",
                    query: formData.university || "",
                    country: selectedCountry
                }) as any;

                const universities = res?.universities || res?.results || [];
                const formatted = universities.map((u: any) => ({
                    name: typeof u === "string" ? u : (u?.name || u?.university || ""),
                    loc: typeof u === "object" ? (u?.loc || u?.location || u?.country || selectedCountry) : selectedCountry,
                    country: typeof u === "object" ? (u?.country || selectedCountry) : selectedCountry,
                    slug: typeof u === "object" ? u?.slug : "",
                })).filter((u: any) => Boolean(u.name));

                setSuggestedUniversities(formatted);
            } catch (err) {
                console.error("Failed to fetch universities via AI", err);
                setSuggestedUniversities([]);
            } finally {
                setLoadingUniversities(false);
            }
        }, delay);

        return () => clearTimeout(timer);
    }, [formData.country, formData.otherCountry, formData.university]);

    useEffect(() => {
        if (userData && isAddAppOpen) {
            setFormData(prev => ({
                ...prev,
                firstName: userData.firstName || "",
                lastName: userData.lastName || "",
                email: userData.email || "",
                phone: userData.phoneNumber || userData.mobile || userData.phone || "",
                dateOfBirth: userData.dateOfBirth ? (() => {
                    const raw = userData.dateOfBirth;
                    let dobDate: Date | null = null;
                    if (typeof raw === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(raw.trim())) {
                        const [dd, mm, yyyy] = raw.trim().split('-');
                        dobDate = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                    } else if (typeof raw === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(raw.trim())) {
                        const [dd, mm, yyyy] = raw.trim().split('/');
                        dobDate = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                    } else {
                        dobDate = new Date(raw);
                    }
                    if (!dobDate || isNaN(dobDate.getTime())) return "";
                    const yyyy = dobDate.getFullYear();
                    const mm = String(dobDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(dobDate.getDate()).padStart(2, '0');
                    return `${yyyy}-${mm}-${dd}`;
                })() : "",
                address: userData.permanentAddress || "",
                pincode: userData.pincode || "",
            }));
        }
    }, [userData, isAddAppOpen]);

    const isBankAlreadyApplied = (bankId: string) => {
        return userApplications.some(app => {
            const appBank = String(app.bank || '').toLowerCase().trim();
            if (bankId === 'hdfc' && (appBank.includes('hdfc') || appBank.includes('credila'))) return true;
            if (bankId === 'idfc' && appBank.includes('idfc')) return true;
            if (bankId === 'auxilo' && appBank.includes('auxilo')) return true;
            if (bankId === 'avanse' && appBank.includes('avanse')) return true;
            if (bankId === 'poonawalla' && appBank.includes('poonawalla')) return true;
            return false;
        });
    };

    const handleAddApplication = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError("");

        const selectedCountry = formData.country === "Other" ? formData.otherCountry?.trim() : formData.country?.trim();
        if (!selectedCountry) {
            setSubmitError(formData.country === "Other" ? "Please specify the destination country name." : "Please select a destination country.");
            return;
        }

        const trimmedUniversity = (formData.university || "").trim();
        if (!trimmedUniversity) {
            setSubmitError("University name is required. Please specify a university.");
            return;
        }

        if (trimmedUniversity.length < 2) {
            setSubmitError("Please enter a valid university name (at least 2 characters).");
            return;
        }

        const uniMatch = checkCountryUniversityMatch(selectedCountry, trimmedUniversity, selectedUniObj, suggestedUniversities);
        if (!uniMatch.isValid) {
            setSubmitError(uniMatch.error || "Country and university mismatch.");
            return;
        }

        if (formData.bank !== "Any Bank" && isBankAlreadyApplied(formData.bank)) {
            const selectedBankName = banksList.find(b => b.id === formData.bank)?.name || formData.bank;
            setSubmitError(`This student already has an active application with ${selectedBankName}. Direct duplicates are not allowed.`);
            return;
        }

        const parsedAmount = parseFloat(formData.amount) || 0;
        if (!parsedAmount || parsedAmount <= 0) {
            setSubmitError("Please enter a valid requested loan amount.");
            return;
        }
        if (parsedAmount > 15000000) {
            setSubmitError("Maximum loan amount cannot exceed ₹1,50,00,000 (1.5 Crore)");
            return;
        }

        setSubmitting(true);

        try {
            const bankName = banksList.find(b => b.id === formData.bank)?.name || formData.bank;
            
            // Inherit co-applicant details from student's first application if available
            const firstApp = userApplications?.[0];
            const coApplicantRel = firstApp?.coApplicantRelation || firstApp?.coApplicant || undefined;
            const coApplicantInc = firstApp?.coApplicantIncome || firstApp?.income || undefined;

            const payload = {
                ...formData,
                university: trimmedUniversity,
                universityName: trimmedUniversity,
                targetUniversity: trimmedUniversity,
                isStaff: true,
                creatorRole: "staff",
                hasCoApplicant: firstApp?.hasCoApplicant ?? (!!coApplicantRel && coApplicantRel !== "none"),
                coApplicantName: firstApp?.coApplicantName || null,
                coApplicantRelation: coApplicantRel || null,
                coApplicantIncome: coApplicantInc || undefined,
                coApplicant: coApplicantRel || null,
                country: selectedCountry,
                userId,
                bank: bankName,
                amount: parsedAmount,
                annualFee: formData.annualFee ? parseFloat(formData.annualFee) : undefined,
                livingCost: formData.livingCost ? parseFloat(formData.livingCost) : undefined,
                income: coApplicantInc || undefined,
                status: "pending",
            };

            const res: any = await applicationApi.create(payload);
            if (res && res.success === false) {
                setSubmitError(res.message || "Failed to create application.");
                setSubmitting(false);
                return;
            }

            // Log staff activity in DB
            const studentName = userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : 'student';
            staffProfileApi.logActivity({
                type: 'new',
                msg: `Added new ${formData.loanType || 'Loan'} application for ${studentName}`,
                icon: 'description',
                color: 'bg-indigo-50 text-indigo-700 border-indigo-100'
            }).catch(console.error);

            await refreshData();
            setIsAddAppOpen(false);

            // Reset state
            setFormData({
                bank: "Any Bank",
                loanType: "Postgraduate Abroad",
                amount: "4000000",
                courseType: "MS/M.Tech",
                country: "USA",
                otherCountry: "",
                university: "",
                annualFee: "",
                livingCost: "",
                coApplicant: "none",
                otherRelation: "",
                income: "",
                collateral: "no",
                firstName: userData?.firstName || "",
                lastName: userData?.lastName || "",
                email: userData?.email || "",
                phone: userData?.phoneNumber || userData?.mobile || userData?.phone || "",
                dateOfBirth: userData?.dateOfBirth ? (() => {
                    const raw = userData.dateOfBirth;
                    let dobDate: Date | null = null;
                    if (typeof raw === 'string' && /^\d{2}-\d{2}-\d{4}$/.test(raw.trim())) {
                        const [dd, mm, yyyy] = raw.trim().split('-');
                        dobDate = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                    } else if (typeof raw === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(raw.trim())) {
                        const [dd, mm, yyyy] = raw.trim().split('/');
                        dobDate = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
                    } else {
                        dobDate = new Date(raw);
                    }
                    if (!dobDate || isNaN(dobDate.getTime())) return "";
                    const yyyy = dobDate.getFullYear();
                    const mm = String(dobDate.getMonth() + 1).padStart(2, '0');
                    const dd = String(dobDate.getDate()).padStart(2, '0');
                    return `${yyyy}-${mm}-${dd}`;
                })() : "",
                address: userData?.permanentAddress || "",
                pincode: userData?.pincode || "",
                notes: "",
                admissionStatus: "waiting",
                intakeSeason: "",
            });
            alert("Loan application added successfully!");
        } catch (err: any) {
            console.error("Failed to add application:", err);
            setSubmitError(err.message || "Failed to create application");
        } finally {
            setSubmitting(false);
        }
    };

    const isApplicationSentToBank = (app: any): boolean => {
        if (!app) return false;
        if (app.submittedToBankAt || app.bankSubmittedAt || app.routedToBankAt || app.fileLoggedAt || app.sentToBank || app.sharedWithBank) {
            return true;
        }
        const status = (app.status || '').toLowerCase().trim();
        const preBankStatuses = ['draft', 'submitted', 'pending', 'staff_review', 'staff_verified', 'under_review', 'in_progress', 'new', 'waiting', 'received'];
        const bankWorkflowStatuses = [
            'submitted_to_bank', 'submitting_to_bank', 'file_logged', 'under_bank_review',
            'in_bank_review', 'bank_review', 'query_raised', 'bank_approved', 'approved_by_bank',
            'sanctioned', 'conditional_sanction', 'partial_sanction', 'counter_offer', 'disbursed',
            'bank_rejected', 'rejected_by_bank'
        ];
        if (bankWorkflowStatuses.includes(status)) {
            return true;
        }
        const bankName = (app.bank || '').toLowerCase().trim();
        const isGenericBank = !bankName || bankName === 'any bank' || bankName === '—' || bankName === 'pending partner' || bankName === 'none';
        if (!preBankStatuses.includes(status) && !isGenericBank) {
            return true;
        }
        return false;
    };

    const activeBankApps = (userApplications || []).filter(isApplicationSentToBank);
    const pendingRoutingApps = (userApplications || []).filter((app: any) => !isApplicationSentToBank(app));

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
        >
            {/* Header / Actions Card */}
            <div className="flex justify-between items-center bg-white/40 backdrop-blur-md p-4 rounded-2xl border border-white/60">
                <div>
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Bank Applications</h3>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{activeBankApps.length} active loan channels</p>
                </div>
                <button
                    onClick={() => setIsAddAppOpen(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                >
                    <span className="material-symbols-outlined text-[16px]">add_circle</span>
                    Add Loan Application
                </button>
            </div>

            {/* Applications Pending Bank Submission Card */}
            {pendingRoutingApps.length > 0 && (
                <div className="bg-amber-500/5 border border-amber-500/20 backdrop-blur-xl rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-amber-600 text-xl">pending_actions</span>
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Initiated Applications (Pending Bank Submission)</h4>
                                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                                    {pendingRoutingApps.length} application{pendingRoutingApps.length > 1 ? 's' : ''} recorded in system but not yet submitted to a partner bank
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pendingRoutingApps.map((app: any, idx: number) => (
                            <div key={idx} className="bg-white p-4 rounded-xl border border-amber-200/60 shadow-sm flex flex-col justify-between gap-3">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-mono font-bold text-[#6605c7]">
                                            {app.applicationNumber || `APP-${app.id?.slice?.(-6)?.toUpperCase() || 'NEW'}`}
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                            {app.status || 'Pending Bank Submission'}
                                        </span>
                                    </div>
                                    <div className="text-sm font-extrabold text-slate-900 mb-1">
                                        ₹{app.amount ? Number(app.amount).toLocaleString('en-IN') : '0'}
                                    </div>
                                    <div className="text-xs font-semibold text-slate-600 truncate">
                                        🎓 {app.universityName || app.university || app.targetUniversity || 'Target University Not Set'}
                                    </div>
                                    {app.loanType && (
                                        <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                                            {app.loanType} • {app.country || 'Destination Country Not Set'}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => {
                                        setRoutingApp(app);
                                        setIsShareModalOpen(true);
                                    }}
                                    className="w-full py-2.5 bg-gradient-to-r from-[#0F766E] to-[#115E59] hover:from-[#115E59] hover:to-[#0F766E] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                >
                                    <span className="material-symbols-outlined text-[15px]">send</span>
                                    Apply / Route to Bank
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Applications Table Card */}
            <div className="bg-white/60 border border-white/80 backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden">
                {activeBankApps.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-gray-100 bg-white/20">
                                    {["Application ID", "LAN Number", "Bank Node", "Loan Program", "Status", "File Age", "Timestamp"].map((header, idx) => (
                                        <th key={idx} className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-400">{header}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {activeBankApps.map((app, idx) => {
                                    const statusStyle = app.status === "approved"
                                        ? "bg-emerald-500/8 text-emerald-600 border-emerald-500/20"
                                        : app.status === "rejected"
                                            ? "bg-rose-500/8 text-rose-600 border-rose-500/20"
                                            : app.status === "processing"
                                                ? "bg-indigo-500/8 text-indigo-600 border-indigo-500/20"
                                                : "bg-amber-500/8 text-amber-600 border-amber-500/20";

                                    return (
                                        <tr key={idx} className="hover:bg-white/30 transition-colors duration-200">
                                            <td className="px-6 py-4 text-xs font-mono font-bold text-[#6605c7]" title={app.id}>
                                                {(app.applicationNumber && (app.applicationNumber.startsWith('VTU-APP-') || app.applicationNumber.startsWith('VTU-BNK-') || app.applicationNumber.startsWith('VL-APP-'))) ? (
                                                    app.applicationNumber
                                                ) : (
                                                    ""
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-mono font-semibold text-slate-800">
                                                {app.lanNumber ? (
                                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                                        {app.lanNumber}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 font-semibold italic">PENDING</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-semibold text-gray-700">
                                                {(!app.bank || app.bank === "Any Bank" || app.bank === "—" || app.bank === "Pending Partner") ? (
                                                    <button
                                                        onClick={() => {
                                                            setRoutingApp(app);
                                                            setIsShareModalOpen(true);
                                                        }}
                                                        className="px-3 py-1.5 rounded-xl bg-[#0F766E] hover:bg-[#115E59] text-[#FFFFFF] text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md hover:shadow-[#0F766E]/20 active:scale-95 cursor-pointer"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">account_balance</span>
                                                        Apply to Bank
                                                    </button>
                                                ) : (
                                                    <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                                                        <span className="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                                                        {app.bank}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-semibold text-gray-700">{app.loanType || "—"}</td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${statusStyle}`}>
                                                    <span className={`w-1 h-1 rounded-full ${app.status === "approved" ? "bg-emerald-500 animate-pulse" : app.status === "rejected" ? "bg-rose-500" : app.status === "processing" ? "bg-indigo-500 animate-pulse" : "bg-amber-500 animate-pulse"}`} />
                                                    {app.status || "Pending"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-xs font-semibold text-gray-500">
                                                {getFileAge(app.submittedAt || app.date)}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-semibold text-gray-500">
                                                {app.submittedToBankAt ? formatDate(app.submittedToBankAt, "MMM d, yyyy, h:mm a") : "—"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <span className="material-symbols-outlined text-4xl text-gray-300 mb-3">account_balance</span>
                        <p className="text-sm font-semibold text-gray-500">No applications submitted to bank yet</p>
                        <p className="text-xs text-gray-400 mt-1 font-medium">Applications will appear here once routed to a partner bank.</p>
                    </div>
                )}
            </div>

            {/* Add Application Form Modal */}
            <AnimatePresence>
                {isAddAppOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden border border-slate-100 flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-slate-855 text-lg">Add New Loan Application</h3>
                                    <p className="text-xs text-slate-400">Initiate a new education loan channel for this student</p>
                                </div>
                                <button
                                    onClick={() => setIsAddAppOpen(false)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            {/* Modal Body / Scrollable Form */}
                            <form onSubmit={handleAddApplication} className="flex-1 overflow-y-auto p-6 space-y-6">
                                {submitError && (
                                    <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px]">error</span>
                                        {submitError}
                                    </div>
                                )}

                                {/* SECTION 1: LOAN & TARGET BANK */}
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] mb-3">1. Loan & Target Bank</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Loan Category *</label>
                                            <select
                                                required
                                                value={formData.loanType}
                                                onChange={e => setFormData(prev => ({ ...prev, loanType: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 font-semibold"
                                            >
                                                {loanTypes.map(type => (
                                                    <option key={type} value={type}>{type}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Requested Amount (INR) *</label>
                                            <input
                                                required
                                                type="number"
                                                max="15000000"
                                                placeholder="e.g. 4000000"
                                                value={formData.amount}
                                                onChange={e => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* SECTION 2: ACADEMIC DETAILS */}
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#6605c7] mb-3">2. Academic Information</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Destination Country *</label>
                                            <select
                                                required
                                                value={formData.country}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        country: val,
                                                        otherCountry: val !== "Other" ? "" : prev.otherCountry
                                                    }));
                                                }}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 font-semibold"
                                            >
                                                {countries.map(c => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {formData.country === "Other" && (
                                            <SearchableCountrySelect
                                                value={formData.otherCountry}
                                                onChange={val => setFormData(prev => ({ ...prev, otherCountry: val }))}
                                            />
                                        )}

                                        <div
                                            className="relative"
                                            onFocus={() => setShowUniversitySuggestions(true)}
                                            onBlur={() => {
                                                setTimeout(() => setShowUniversitySuggestions(false), 200);
                                            }}
                                        >
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">University Name *</label>
                                            <input
                                                required
                                                type="text"
                                                placeholder="e.g. Stanford University"
                                                value={formData.university}
                                                onChange={e => {
                                                    setFormData(prev => ({ ...prev, university: e.target.value.replace(/\d/g, "") }));
                                                    if (submitError) setSubmitError("");
                                                }}
                                                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-semibold ${
                                                    submitError && !formData.university.trim()
                                                        ? "border-rose-400 focus:border-rose-500 ring-1 ring-rose-200"
                                                        : "border-slate-200 focus:border-indigo-500"
                                                }`}
                                            />

                                            {/* Loading Indicator */}
                                            {loadingUniversities && (
                                                <div className="absolute right-3 top-[32px] flex items-center gap-1.5 text-xs text-[#6605c7] font-bold select-none">
                                                    <div className="w-3.5 h-3.5 border-2 border-[#6605c7] border-t-transparent rounded-full animate-spin" />
                                                </div>
                                            )}

                                            {/* Suggestions Dropdown */}
                                            {showUniversitySuggestions && suggestedUniversities.length > 0 && (
                                                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                                                    {suggestedUniversities.map((uni) => (
                                                        <button
                                                            key={uni.name}
                                                            type="button"
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onClick={() => {
                                                                setFormData(prev => ({ ...prev, university: uni.name }));
                                                                setSelectedUniObj(uni);
                                                                setShowUniversitySuggestions(false);
                                                            }}
                                                            className="w-full px-4 py-2 text-left text-xs font-semibold text-slate-700 hover:text-[#6605c7] hover:bg-slate-50 transition-all flex flex-col"
                                                        >
                                                            <span className="font-bold text-slate-900">{uni.name}</span>
                                                            <span className="text-[10px] text-slate-400 font-normal">{uni.loc || uni.country || "Popular University"}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Admission Status *</label>
                                            <select
                                                required
                                                value={formData.admissionStatus}
                                                onChange={e => setFormData(prev => ({ ...prev, admissionStatus: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700 font-semibold"
                                            >
                                                <option value="waiting">Awaiting Admit Card</option>
                                                <option value="conditional">Conditional Offer</option>
                                                <option value="confirmed">Confirmed Admission / Letter Received</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>



                            </form>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
                                <button
                                    type="button"
                                    onClick={() => setIsAddAppOpen(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAddApplication}
                                    disabled={submitting}
                                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-750 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:scale-100 cursor-pointer"
                                >
                                    {submitting ? (
                                        <>
                                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[15px]">send</span>
                                            Create Application
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
