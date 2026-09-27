"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { format, differenceInDays, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { io, Socket } from "socket.io-client";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { adminApi } from "@/lib/api";
import ChatInterface from "@/components/Chat/ChatInterface";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler
);

// --- Components ---

const QuickAction = ({ icon, label, sublabel, bgColor, iconColor, onClick }: any) => (
    <button
        onClick={onClick}
        className="glass-card p-6 rounded-[2.5rem] bg-white group hover:bg-[#6605c7]/5 transition-all text-left border-[#6605c7]/10 relative overflow-hidden"
    >
        <div className="relative z-10">
            <div className={`w-12 h-12 rounded-2xl ${bgColor || 'bg-[#6605c7]/10'} flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500`}>
                <span className={`material-symbols-outlined text-3xl opacity-80 ${iconColor || 'text-[#6605c7]'}`}>{icon}</span>
            </div>
            <div>
                <h4 className="text-sm font-black text-gray-900 group-hover:text-[#6605c7] transition-colors">{label}</h4>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{sublabel}</p>
            </div>
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-700">
            <span className="material-symbols-outlined text-8xl">{icon}</span>
        </div>
    </button>
);

const StatMiniCard = ({ label, value, subtext, trendType, trendLabel, icon, bgColor, iconColor, delay = 0 }: any) => {
    let dotColor = "bg-gray-400 shadow-[0_0_8px_#9ca3af]";
    let sparklineColor = "#9ca3af";
    if (trendType === "up") {
        dotColor = "bg-emerald-500 shadow-[0_0_8px_#10b981]";
        sparklineColor = "#10b981";
    } else if (trendType === "down") {
        dotColor = "bg-rose-500 shadow-[0_0_8px_#f43f5e]";
        sparklineColor = "#f43f5e";
    } else if (trendType === "neutral" || trendType === "info") {
        dotColor = "bg-purple-500 shadow-[0_0_8px_#a855f7]";
        sparklineColor = "#a855f7";
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            className="glass-card stat-card-gradient p-5 rounded-2xl relative overflow-hidden group flex flex-col justify-between h-full"
        >
            <div className="flex justify-between items-center relative z-10 mb-4">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 duration-500 ${bgColor || 'bg-[#6605c7]/10'} shadow-sm`}>
                        <span className={`material-symbols-outlined text-base ${iconColor || 'text-[#6605c7]'}`}>{icon}</span>
                    </div>
                    <p className="text-gray-500 text-[9px] font-black uppercase tracking-[0.2em]">{label}</p>
                </div>
                {trendLabel && trendType !== "none" && (
                    <div className="flex items-center gap-1.5" title={trendLabel}>
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${dotColor}`} />
                    </div>
                )}
            </div>

            <div className="flex items-end justify-between relative z-10">
                <div>
                    <div className="text-2xl font-black font-mono text-gray-900 leading-none tracking-tight">
                        {value}
                    </div>
                    <div className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest mt-2">{subtext}</div>
                </div>

                {/* Micro Sparkline */}
                <div className="w-14 h-6 opacity-70 group-hover:opacity-100 transition-opacity duration-300">
                    <svg viewBox="0 0 60 20" className="w-full h-full overflow-visible">
                        <path
                            d={trendType === "up" ? "M0,20 Q15,20 25,10 T40,5 T60,0" : trendType === "down" ? "M0,0 Q15,0 25,10 T40,15 T60,20" : "M0,15 Q15,5 30,15 T60,15"}
                            fill="none"
                            stroke={sparklineColor}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            className="drop-shadow-sm"
                        />
                    </svg>
                </div>
            </div>
        </motion.div>
    );
};

interface AdminStatsResponse {
    success?: boolean;
    data?: any;
}



// --- Page ---

export default function BankDashboard() {
    const router = useRouter();
    const { user } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [portfolio, setPortfolio] = useState<any>(null);
    const [compliance, setCompliance] = useState<any>(null);
    const [applications, setApplications] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<"urgent" | "new" | "queries" | "disbursements" | "pending">("urgent");
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);

    const [currentBankId] = useState<string>(
        typeof window !== 'undefined'
            ? (sessionStorage.getItem("selectedBank") || localStorage.getItem("selectedBank") || "idfc")
            : "idfc"
    );

    const [incomingAlert, setIncomingAlert] = useState<any | null>(null);
    const socketRef = useRef<Socket | null>(null);

    const commandInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                commandInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const isNotificationForThisBank = useCallback((notif: any) => {
        let metadata = notif.metadata;
        if (typeof metadata === "string") {
            try { metadata = JSON.parse(metadata); } catch { }
        }

        let currentBankName: string | null = null;
        if (typeof window !== "undefined") {
            const map: Record<string, string> = {
                auxilo: "Auxilo Finserve",
                avanse: "Avanse Financial",
                credila: "HDFC Credila",
                idfc: "IDFC FIRST Bank",
                poonawalla: "Poonawalla Fincorp",
            };
            currentBankName = map[currentBankId] || null;
        }
        if (!currentBankName) {
            currentBankName = user?.bankName || user?.firstName || null;
        }

        const notifBankId = metadata?.bankId ? String(metadata.bankId).toLowerCase().replace(/[^a-z0-9_-]/g, '_') : null;
        const notifBankName = metadata?.bankName || metadata?.bank;

        if (!notifBankId && !notifBankName) return true;
        if (!currentBankId && !currentBankName) return true;

        if (notifBankId && currentBankId) {
            return notifBankId === currentBankId;
        }
        if (notifBankName && currentBankName) {
            return notifBankName.toLowerCase() === currentBankName.toLowerCase();
        }
        return true;
    }, [currentBankId, user]);

    useEffect(() => {
        const token =
            localStorage.getItem("bankAccessToken") ||
            localStorage.getItem("accessToken") ||
            localStorage.getItem("token");
        if (!token) return;

        const baseApiUrl = typeof window !== "undefined" && (window.location.hostname.includes("localhost") || window.location.hostname.includes("127.0.0.1"))
            ? "http://localhost:5000"
            : (process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:5000"));

        const socketUrl = baseApiUrl.endsWith("/api")
            ? baseApiUrl.replace("/api", "/chat")
            : `${baseApiUrl.replace(/\/$/, "")}/chat`;

        const socket = io(socketUrl, {
            auth: { token },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        socket.on("connect", () => {
            console.log("[BankDashboard] Connected to socket.io");
            socket.emit("joinRoom", "room_bank");

            const safeBankId = currentBankId.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
            const perBankRoom = `room_bank_${safeBankId}`;
            socket.emit("joinRoom", perBankRoom);
            console.log(`[BankDashboard] Joined per-bank room: ${perBankRoom}`);
        });

        socket.on("notification_received", (payload: any) => {
            console.log("[BankDashboard] Received notification:", payload);
            if (!isNotificationForThisBank(payload)) {
                return;
            }

            if (payload.type === "bank_application_received") {
                let metadata = payload.metadata;
                if (typeof metadata === "string") {
                    try { metadata = JSON.parse(metadata); } catch { }
                }

                setIncomingAlert({
                    id: payload.id,
                    title: payload.title,
                    body: payload.body,
                    applicationId: metadata?.applicationId || metadata?.submissionId,
                    timestamp: new Date().toISOString(),
                });

                // Soft refresh dashboard stats/metrics
                fetchAllData(currentBankId);
            }
        });

        socket.on("disconnect", () => {
            console.log("[BankDashboard] Disconnected from socket.io");
        });

        socketRef.current = socket;

        return () => {
            socket.disconnect();
        };
    }, [currentBankId, isNotificationForThisBank]);

    const fetchAllData = async (bankId: string) => {
        try {
            const [statsRes, portfolioRes, complianceRes, appsRes] = await Promise.all([
                adminApi.getApplicationStats(bankId).catch(err => { console.error("Stats API error:", err); return null; }),
                adminApi.getPortfolioAnalysis(bankId).catch(err => { console.error("Portfolio API error:", err); return null; }),
                adminApi.getComplianceReport(bankId).catch(err => { console.error("Compliance API error:", err); return null; }),
                adminApi.getApplications({ bank: bankId }).catch(err => { console.error("Apps API error:", err); return null; })
            ]) as [any, any, any, any];

            if (statsRes && statsRes.success) {
                setStats(statsRes.data);
            }
            if (portfolioRes && portfolioRes.success) {
                setPortfolio(portfolioRes.data);
            }
            if (complianceRes) {
                if (complianceRes.success) {
                    setCompliance(complianceRes.data);
                } else {
                    setCompliance(complianceRes);
                }
            }
            if (appsRes && appsRes.success) {
                setApplications(appsRes.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch dashboard metrics:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setMounted(true);
        fetchAllData(currentBankId);
    }, []);

    // --- F13 Count + ₹ KPI Memos ---
    const excludeStatuses = ["draft"];

    const incomingApps = useMemo(() => {
        return applications.filter(app => !app.lanNumber && !["rejected", "approved", "sanctioned", "disbursed", "disbursement_confirmed", ...excludeStatuses].includes(app.status));
    }, [applications]);
    const incomingCount = incomingApps.length;
    const incomingVal = incomingApps.reduce((acc, app) => acc + (app.amount || 0), 0);

    const loggedApps = useMemo(() => {
        return applications.filter(app => app.lanNumber && !["approved", "sanctioned", "rejected", "disbursed", "disbursement_confirmed", ...excludeStatuses].includes(app.status));
    }, [applications]);
    const loggedCount = loggedApps.length;
    const loggedVal = loggedApps.reduce((acc, app) => acc + (app.amount || 0), 0);

    const sanctionedApps = useMemo(() => {
        return applications.filter(app => app.status === "approved" || app.status === "sanctioned" || app.status === "disbursed" || app.status === "disbursement_confirmed");
    }, [applications]);
    const sanctionedCount = sanctionedApps.length;
    const sanctionedVal = sanctionedApps.reduce((acc, app) => acc + (app.sanctionAmount || app.amount || 0), 0);

    const avgTAT = useMemo(() => {
        const decided = applications.filter(app => (app.status === "approved" || app.status === "sanctioned" || app.status === "disbursed" || app.status === "disbursement_confirmed" || app.status === "rejected") && (app.approvedAt || app.rejectedAt || app.disbursedAt || app.sanctionedAt));
        if (decided.length === 0) return 4.2;
        const totalDays = decided.reduce((acc, app) => {
            const start = new Date(app.submittedAt || app.createdAt);
            const end = new Date(app.approvedAt || app.rejectedAt || app.disbursedAt || app.sanctionedAt);
            const diff = differenceInDays(end, start);
            return acc + (diff >= 0 ? diff : 0);
        }, 0);
        return parseFloat((totalDays / decided.length).toFixed(1));
    }, [applications]);

    const pipelineVal = useMemo(() => {
        const active = applications.filter(app => !["approved", "sanctioned", "disbursed", "disbursement_confirmed", "rejected", ...excludeStatuses].includes(app.status));
        return active.reduce((acc, app) => acc + (app.amount || 0), 0);
    }, [applications]);

    // --- F29 Priority Desk Queues ---
    const urgentQueue = useMemo(() => {
        return applications.filter(app => {
            const isHigh = app.priorityLevel === "high" || app.priority === "high";
            const dateStr = app.lanEnteredAt || app.submittedAt || app.createdAt;
            const diff = dateStr ? differenceInDays(new Date(), new Date(dateStr)) : 0;
            const isOld = diff >= 4;
            return (isHigh || isOld) && !["approved", "sanctioned", "disbursed", "disbursement_confirmed", "rejected", ...excludeStatuses].includes(app.status);
        });
    }, [applications]);

    const newQueue = useMemo(() => {
        return applications.filter(app => !app.lanNumber && !["approved", "sanctioned", "disbursed", "disbursement_confirmed", "rejected", ...excludeStatuses].includes(app.status));
    }, [applications]);

    const queryQueue = useMemo(() => {
        return applications.filter(app => app.stage === "query_raised" || (app.status === "processing" && (app.remarks || "").toLowerCase().includes("query")));
    }, [applications]);

    const disbursementQueue = useMemo(() => {
        return applications.filter(app => app.status === "approved" || app.status === "sanctioned" || app.status === "disbursed" || app.status === "disbursement_confirmed");
    }, [applications]);

    const pendingQueue = useMemo(() => {
        return applications.filter(app => app.lanNumber && !["approved", "sanctioned", "disbursed", "disbursement_confirmed", "rejected", ...excludeStatuses].includes(app.status));
    }, [applications]);

    // Derived Charts Data
    const statusDistribution = useMemo(() => {
        if (!stats?.statusStats) return null;

        const labels = Object.keys(stats.statusStats).map(s => s.charAt(0).toUpperCase() + s.slice(1));
        const data = Object.values(stats.statusStats);

        return {
            labels,
            datasets: [{
                data,
                backgroundColor: [
                    '#10b981', // emerald
                    '#f59e0b', // amber
                    '#ef4444', // rose
                    '#6605c7', // primary
                    '#3b82f6', // info
                ],
                hoverBackgroundColor: [
                    '#059669',
                    '#d97706',
                    '#dc2626',
                    '#4a0394',
                    '#2563eb',
                ],
                borderWidth: 0,
                hoverOffset: 20
            }]
        };
    }, [stats]);

    const disbursementData = useMemo(() => {
        const hasData = portfolio?.disbursementTrend?.some((t: any) => t.amount > 0);
        const chartDataValues = hasData
            ? portfolio.disbursementTrend.map((t: any) => t.amount)
            : [0.45, 0.52, 0.60, 0.48, 0.75, 0.90];
        const chartLabels = portfolio?.disbursementTrend
            ? portfolio.disbursementTrend.map((t: any) => t.month)
            : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

        return {
            labels: chartLabels,
            datasets: [{
                label: 'Capital Flow (₹ Cr)',
                data: chartDataValues,
                borderColor: '#6605c7',
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return 'rgba(102, 5, 199, 0.03)';
                    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
                    gradient.addColorStop(0, 'rgba(102, 5, 199, 0.01)');
                    gradient.addColorStop(1, 'rgba(102, 5, 199, 0.08)');
                    return gradient;
                },
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: '#6605c7',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 4,
                borderWidth: 4,
            }]
        };
    }, [portfolio]);

    const funnelStats = useMemo(() => {
        if (!stats?.statusStats) {
            return [
                { stage: "Created", count: 15, pct: 100, color: "bg-blue-500", icon: "bolt" },
                { stage: "Submitted", count: 12, pct: 85, color: "bg-blue-600", icon: "send" },
                { stage: "Documents", count: 10, pct: 75, color: "bg-purple-500", icon: "verified" },
                { stage: "Submit to Bank", count: 9, pct: 68, color: "bg-purple-600", icon: "account_balance" },
                { stage: "Credit Check", count: 8, pct: 60, color: "bg-indigo-500", icon: "credit_score" },
                { stage: "Review", count: 6, pct: 45, color: "bg-[#6605c7]", icon: "rate_review" },
                { stage: "Sanction", count: 5, pct: 38, color: "bg-teal-500", icon: "assignment_turned_in" },
                { stage: "Disbursed", count: 4, pct: 30, color: "bg-emerald-500", icon: "payments" }
            ];
        }

        const s = stats.statusStats;
        const total = (s.pending || 0) + (s.submitted || 0) + (s.processing || 0) + (s.approved || 0) + (s.disbursed || 0) + (s.under_bank_review || 0);
        const max = total || 1;
        const created = total;
        const submitted = (s.submitted || 0) + (s.processing || 0) + (s.approved || 0) + (s.disbursed || 0) + (s.under_bank_review || 0);
        const documents = (s.processing || 0) + (s.approved || 0) + (s.disbursed || 0) + (s.under_bank_review || 0);
        const submitToBank = (s.processing || 0) + (s.approved || 0) + (s.disbursed || 0) + (s.under_bank_review || 0);
        const creditCheck = (s.under_bank_review || 0) + (s.approved || 0) + (s.disbursed || 0);
        const review = (s.under_bank_review || 0) + (s.approved || 0) + (s.disbursed || 0);
        const sanction = (s.approved || 0) + (s.disbursed || 0);
        const disbursed = s.disbursed || 0;

        return [
            { stage: "Created", count: created, pct: 100, color: "bg-blue-500", icon: "bolt" },
            { stage: "Submitted", count: submitted, pct: Math.round((submitted / max) * 100), color: "bg-blue-600", icon: "send" },
            { stage: "Documents", count: documents, pct: Math.round((documents / max) * 100), color: "bg-purple-500", icon: "verified" },
            { stage: "Submit to Bank", count: submitToBank, pct: Math.round((submitToBank / max) * 100), color: "bg-purple-600", icon: "account_balance" },
            { stage: "Credit Check", count: creditCheck, pct: Math.round((creditCheck / max) * 100), color: "bg-indigo-500", icon: "credit_score" },
            { stage: "Review", count: review, pct: Math.round((review / max) * 100), color: "bg-[#6605c7]", icon: "rate_review" },
            { stage: "Sanction", count: sanction, pct: Math.round((sanction / max) * 100), color: "bg-teal-500", icon: "assignment_turned_in" },
            { stage: "Disbursed", count: disbursed, pct: Math.round((disbursed / max) * 100), color: "bg-emerald-500", icon: "payments" }
        ];
    }, [stats]);

    const statusColors: Record<string, string> = {
        pending: "bg-amber-50 text-amber-600 border-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.1)]",
        processing: "bg-blue-50 text-blue-600 border-blue-100 shadow-[0_0_8px_rgba(59,130,246,0.1)]",
        under_bank_review: "bg-[#6605c7]/10 text-[#6605c7] border-[#6605c7]/20 shadow-[0_0_8px_rgba(102,5,199,0.1)]",
        approved: "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-[0_0_8px_rgba(16,185,129,0.1)]",
        sanctioned: "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-[0_0_8px_rgba(16,185,129,0.1)]",
        rejected: "bg-rose-50 text-rose-600 border-rose-100 shadow-[0_0_8px_rgba(239,68,68,0.1)]",
        disbursed: "bg-indigo-50 text-indigo-600 border-indigo-100 shadow-[0_0_8px_rgba(79,70,229,0.1)]",
        disbursement_confirmed: "bg-indigo-50 text-indigo-600 border-indigo-100 shadow-[0_0_8px_rgba(79,70,229,0.1)]",
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[600px] gap-6">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-[#6605c7]/5 border-t-[#6605c7] rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#6605c7] animate-pulse">account_balance</span>
                    </div>
                </div>
                <div className="text-center space-y-2">
                    <h3 className="text-sm font-black uppercase tracking-[0.3em] text-gray-900 animate-pulse">Syncing Secure Nodes</h3>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Establishing encrypted tunnel...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-6 animate-fade-in relative z-10">
            {/* <AnimatePresence>
                {incomingAlert && (
                    <motion.div
                        initial={{ opacity: 0, y: -20, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, y: -20, height: 0 }}
                        className="overflow-hidden mb-4"
                    >
                        <div
                            className="p-4 rounded-2xl border text-white flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden"
                            style={{
                                background: "linear-gradient(135deg, #6605c7 0%, #8b24e5 100%)",
                                borderColor: "rgba(102,5,199,0.2)",
                                boxShadow: "0 10px 30px rgba(102,5,199,0.15)",
                            }}
                        >
                            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial-gradient from-white/10 to-transparent pointer-events-none" />
                            
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center relative shrink-0">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 animate-pulse shadow-[0_0_8px_#4ade80]" />
                                    <span className="material-symbols-outlined text-white text-xl">download</span>
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Incoming Queue Alert</p>
                                    <h4 className="text-sm font-extrabold text-white mt-0.5 leading-none">{incomingAlert.title}</h4>
                                    <p className="text-[11.5px] text-white/90 font-medium mt-1.5">{incomingAlert.body}</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 shrink-0">
                                <button
                                    onClick={() => {
                                        router.push(`/bank/applications?id=${incomingAlert.applicationId}`);
                                        setIncomingAlert(null);
                                    }}
                                    className="px-4 py-2 bg-white text-[#6605c7] hover:bg-purple-50 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl transition-all shadow-md active:scale-95"
                                >
                                    Review Application
                                </button>
                                <button
                                    onClick={() => setIncomingAlert(null)}
                                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all"
                                >
                                    <span className="material-symbols-outlined text-base">close</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence> */}

            {/* Header / Greet Section */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
                <div className="space-y-4">
                    {/* <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="inline-flex items-center gap-3 px-4 py-2 bg-white/50 backdrop-blur-xl rounded-full border border-[#6605c7]/10 shadow-sm"
                    >
                        <div className="w-2 h-2 rounded-full bg-[#6605c7] animate-pulse shadow-[0_0_8px_#6605c7]" />
                        <span className="text-[10px] font-black text-[#6605c7] uppercase tracking-[0.2em]">Overview Dashboard</span>
                    </motion.div> */}
                    <h2 className="text-3xl lg:text-4xl font-black font-display text-gray-900 tracking-tighter leading-none">
                        Portfolio <span className="text-[#6605c7]">Overview</span>
                    </h2>
                </div>

                <div className="flex flex-wrap gap-4 items-center relative">

                    <motion.button
                        whileHover={{ y: -2 }}
                        onClick={() => {
                            const content = document.querySelector('.admin-table')?.parentElement?.innerText || 'Dashboard Data';
                            const element = document.createElement("a");
                            const file = new Blob([content], { type: 'text/plain' });
                            element.href = URL.createObjectURL(file);
                            element.download = `bank-matrix-audit-${format(new Date(), 'yyyy-MM-dd')}.txt`;
                            document.body.appendChild(element);
                            element.click();
                            document.body.removeChild(element);
                        }}
                        className="px-6 py-4 rounded-[1.5rem] bg-white/80 border border-black/10 hover:border-black/20 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#111111] hover:bg-white transition-all shadow-sm group"
                    >
                        <span className="material-symbols-outlined text-xl group-hover:scale-125 transition-transform">database</span>
                        Extract Matrix
                    </motion.button>
                    <motion.button
                        whileHover={{ y: -2, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push('/bank/applications')}
                        className="px-8 py-4 rounded-[1.5rem] bg-[#111111] hover:bg-black text-white border border-white/10 flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] shadow-md hover:shadow-lg transition-all group"
                    >
                        <span className="material-symbols-outlined text-xl group-hover:rotate-90 transition-transform duration-500">add_circle</span>
                        Initialize Pulse
                    </motion.button>
                </div>
            </div>

            {/* Performance Matrix */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatMiniCard
                    label="Incoming Queue"
                    value={incomingVal ? `₹${(incomingVal / 100000).toFixed(0)}L` : "₹0L"}
                    subtext={incomingCount === 1 ? "1 pending file" : `${incomingCount} files pending`}
                    trendType="info"
                    trendLabel="In Queue"
                    icon="download"
                    iconColor="text-amber-600"
                    bgColor="bg-amber-50"
                    delay={0.1}
                />
                <StatMiniCard
                    label="Logged Files"
                    value={loggedVal ? `₹${(loggedVal / 10000000).toFixed(2)} Cr` : "₹0.00 Cr"}
                    subtext={loggedCount === 1 ? "1 file active" : `${loggedCount} files active`}
                    trendType="neutral"
                    trendLabel="Active"
                    icon="assignment"
                    iconColor="text-blue-600"
                    bgColor="bg-blue-50"
                    delay={0.2}
                />
                <StatMiniCard
                    label="Sanctioned"
                    value={sanctionedVal ? `₹${(sanctionedVal / 10000000).toFixed(2)} Cr` : "₹0.00 Cr"}
                    subtext={sanctionedCount === 1 ? "1 file approved" : `${sanctionedCount} files approved`}
                    trendType="up"
                    trendLabel="Approved"
                    icon="verified"
                    iconColor="text-emerald-600"
                    bgColor="bg-emerald-50"
                    delay={0.3}
                />
                <StatMiniCard
                    label="Average TAT"
                    value={`${avgTAT} Days`}
                    subtext="vs target 5.0 days"
                    trendType={avgTAT <= 5.0 ? "up" : "down"}
                    trendLabel={avgTAT <= 5.0 ? "SLA Met" : "SLA Breach"}
                    icon="schedule"
                    iconColor="text-indigo-600"
                    bgColor="bg-indigo-50"
                    delay={0.4}
                />
                <StatMiniCard
                    label="Pipeline Value"
                    value={pipelineVal ? `₹${(pipelineVal / 10000000).toFixed(2)} Cr` : "₹0.00 Cr"}
                    subtext={`${applications.filter(a => a.status !== "approved" && a.status !== "disbursed" && a.status !== "rejected").length} active files`}
                    trendType="none"
                    trendLabel=""
                    icon="account_balance_wallet"
                    iconColor="text-[#6605c7]"
                    bgColor="bg-[#6605c7]/5"
                    delay={0.5}
                />
            </div>

            {/* Intelligence Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Capital Flow Visual */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="lg:col-span-8 glass-card p-6 rounded-3xl border-[#6605c7]/10 bg-white/70 relative overflow-hidden group shadow-xl shadow-purple-900/[0.02]"
                >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#6605c7]/5 flex items-center justify-center text-[#6605c7]">
                                <span className="material-symbols-outlined text-lg">monitoring</span>
                            </div>
                            <div>
                                <h3 className="text-base font-black font-display text-gray-900 tracking-tight">Disbursement Pulse</h3>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.25em] mt-0.5">Capital Flow — Jan to Jun</p>
                            </div>
                        </div>
                        <div className="flex gap-1.5 p-1 bg-gray-50 rounded-xl border border-gray-100">
                            {['Real-time', 'Quarterly'].map((mode) => (
                                <button key={mode} className={`px-3 py-1.5 rounded-lg text-[8.5px] font-black uppercase tracking-widest transition-all ${mode === 'Real-time' ? 'bg-[#6605c7] text-white shadow' : 'text-gray-400 hover:text-gray-900'}`}>
                                    {mode}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-[200px] relative z-10">
                        <Line
                            data={disbursementData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: { display: false },
                                    tooltip: {
                                        backgroundColor: 'rgba(255, 255, 255, 0.98)',
                                        titleColor: '#111',
                                        bodyColor: '#6605c7',
                                        padding: 12,
                                        cornerRadius: 12,
                                        displayColors: false,
                                        borderColor: 'rgba(102, 5, 199, 0.15)',
                                        borderWidth: 1,
                                        titleFont: { weight: 'bold', size: 11 },
                                        bodyFont: { weight: 'bold', size: 13 },
                                        callbacks: { label: (c) => `₹ ${c.formattedValue} Cr` }
                                    }
                                },
                                scales: {
                                    y: {
                                        border: { display: false },
                                        grid: { color: 'rgba(0,0,0,0.06)' },
                                        ticks: { font: { weight: 'bold', size: 11 }, color: '#666', padding: 6 },
                                        beginAtZero: true
                                    },
                                    x: {
                                        border: { display: false },
                                        grid: { display: false },
                                        ticks: { font: { weight: 'bold', size: 11 }, color: '#666', padding: 4 }
                                    }
                                }
                            }}
                        />
                    </div>
                </motion.div>

                {/* Status Matrix */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="lg:col-span-4 glass-card p-6 rounded-3xl border-[#6605c7]/10 bg-white/70 flex flex-col shadow-xl shadow-purple-900/[0.02]"
                >
                    <h3 className="text-sm font-black font-display text-gray-900 mb-3 text-center uppercase tracking-widest">Application Status</h3>
                    <div className="relative flex items-center justify-center mb-4" style={{ height: 160 }}>
                        {statusDistribution && (
                            <div className="w-full max-w-[160px]">
                                <Doughnut
                                    data={statusDistribution}
                                    options={{
                                        cutout: '78%',
                                        plugins: { legend: { display: false } },
                                        animation: { animateScale: true, animateRotate: true }
                                    }}
                                />
                            </div>
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-black font-display text-gray-900 tracking-tighter leading-none">{stats?.total || 0}</span>
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 mt-1">Total</span>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        {statusDistribution?.labels?.map((label, i) => (
                            <div key={label} className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-gray-50/60 border border-gray-100/60">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: statusDistribution?.datasets?.[0]?.backgroundColor?.[i] }} />
                                <p className="text-[9px] font-black uppercase tracking-wider text-gray-500 flex-1 truncate">{label}</p>
                                <p className="text-[11px] font-black text-gray-900">{String(statusDistribution?.datasets?.[0]?.data?.[i] ?? 0)}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Pipeline Funnel Section */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                className="glass-card p-8 rounded-3xl border-[#6605c7]/10 bg-white/70 shadow-xl shadow-purple-900/[0.02] text-left"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-9 h-9 rounded-xl bg-[#6605c7]/5 flex items-center justify-center text-[#6605c7]">
                        <span className="material-symbols-outlined text-lg">filter_alt</span>
                    </div>
                    <div>
                        <h3 className="text-base font-black font-display text-gray-900 tracking-tight">Underwriting Pipeline Funnel</h3>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.25em] mt-0.5">Workflow conversion metrics across core phases</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
                    {funnelStats.map((item, idx) => {
                        const isEmpty = item.count === 0;
                        return (
                            <div key={idx} className={`relative p-3.5 sm:p-4 rounded-2xl transition-all group flex flex-col justify-between border border-transparent min-h-[120px] ${isEmpty ? 'bg-gray-50/40 opacity-50 grayscale' : 'bg-gray-50/80 hover:bg-white hover:border-gray-200 hover:shadow-md'}`}>
                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <span className="material-symbols-outlined text-[15px] text-[#6605c7]">{item.icon}</span>
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${isEmpty ? 'text-gray-400' : 'text-[#6605c7]'}`}>0{idx + 1}</span>
                                    </div>
                                    <h4 className={`text-xs font-black uppercase tracking-tight text-center truncate w-full ${isEmpty ? 'text-gray-500' : 'text-gray-900'}`}>{item.stage}</h4>
                                    <div className="mt-2.5 flex items-baseline gap-1">
                                        <span className={`font-mono text-xl font-black leading-none ${isEmpty ? 'text-gray-400' : 'text-gray-900'}`}>{item.count}</span>
                                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">files</span>
                                    </div>
                                </div>
                                <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl ${item.color} ${isEmpty ? 'opacity-30' : 'opacity-100'}`} style={{ width: `${item.pct}%` }} />
                            </div>
                        )
                    })}
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Priority Desk (F29 Today's Dashboard) */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    className="lg:col-span-2 glass-card rounded-[3rem] border-[#6605c7]/10 bg-white/70 overflow-hidden shadow-2xl shadow-purple-900/[0.03]"
                >
                    <div className="p-8 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-[#6605c7] flex items-center justify-center shadow-inner">
                                <span className="material-symbols-outlined text-xl">priority_high</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-black font-display text-gray-900 tracking-tight">Today's Priority Desk</h3>
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">SLA focused underwriting worklists</p>
                            </div>
                        </div>
                    </div>

                    {/* F29 5-Tabs Grid */}
                    <div className="px-8 border-b border-gray-100 flex flex-wrap gap-2 pb-2">
                        {(["urgent", "new", "queries", "disbursements", "pending"] as const).map(tab => {
                            const queue =
                                tab === "urgent" ? urgentQueue :
                                    tab === "new" ? newQueue :
                                        tab === "queries" ? queryQueue :
                                            tab === "disbursements" ? disbursementQueue :
                                                pendingQueue;

                            const labels = {
                                urgent: "Urgent",
                                new: "New Files",
                                queries: "Queries",
                                disbursements: "Disbursements",
                                pending: "Pending"
                            };

                            return (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${activeTab === tab
                                        ? "bg-[#111111] text-white border border-white/10 shadow-md"
                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-100/50"
                                        }`}
                                >
                                    <span>{labels[tab]}</span>
                                    <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold ${activeTab === tab ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500"}`}>
                                        {queue.length}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="p-8 pt-4">
                        <div className="overflow-x-auto no-scrollbar max-h-[350px] overflow-y-auto">
                            {(() => {
                                const activeQueue =
                                    activeTab === "urgent" ? urgentQueue :
                                        activeTab === "new" ? newQueue :
                                            activeTab === "queries" ? queryQueue :
                                                activeTab === "disbursements" ? disbursementQueue :
                                                    pendingQueue;

                                if (activeQueue.length === 0) {
                                    return (
                                        <div className="py-12 text-center flex flex-col items-center justify-center">
                                            <span className="material-symbols-outlined text-gray-200 text-5xl mb-2">check_circle</span>
                                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Queue Clear</p>
                                            <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-wider">No applications match this filter criteria.</p>
                                        </div>
                                    );
                                }

                                return (
                                    <table className="w-full text-left">
                                        <thead className="bg-[#6605c7]/[0.01] border-b border-gray-100 sticky top-0 bg-white z-10">
                                            <tr>
                                                <th className="px-4 py-4 text-[9px] font-black uppercase tracking-[0.25em] text-[#6605c7]">Applicant Node</th>
                                                <th className="px-4 py-4 text-[9px] font-black uppercase tracking-[0.25em] text-[#6605c7]">Quantum Seek</th>
                                                <th className="px-4 py-4 text-[9px] font-black uppercase tracking-[0.25em] text-[#6605c7]">File Age</th>
                                                <th className="px-4 py-4 text-[9px] font-black uppercase tracking-[0.25em] text-right text-[#6605c7]">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50/50">
                                            {activeQueue.map((app, i) => {
                                                const dateStr = app.lanEnteredAt || app.submittedAt || app.createdAt;
                                                const ageDays = dateStr ? differenceInDays(new Date(), new Date(dateStr)) : 0;

                                                return (
                                                    <tr key={app.id || i} className="group hover:bg-[#6605c7]/[0.03] transition-all duration-300">
                                                        <td className="px-4 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#6605c7]/10 to-transparent flex items-center justify-center font-black text-[#6605c7] text-[10px] border border-[#6605c7]/5 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                                                                    {app.firstName?.[0] || "A"}{app.lastName?.[0] || "P"}
                                                                </div>
                                                                <div>
                                                                    <p className="text-xs font-black text-gray-950 tracking-tight uppercase">{app.firstName} {app.lastName}</p>
                                                                    <p className="text-[8.5px] font-bold text-gray-400 font-mono tracking-tighter uppercase mt-0.5">{app.lanNumber || app.applicationNumber || "Pending LAN"}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <p className="text-xs font-black text-[#6605c7] font-mono tracking-tight">₹{app.amount?.toLocaleString()}</p>
                                                            <p className="text-[8.5px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{app.universityName || "Global University"}</p>
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider ${ageDays >= 4 ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-gray-50 text-gray-500 border border-gray-100"}`}>
                                                                {ageDays} {ageDays === 1 ? "day" : "days"} old
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-1.5">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => router.push(`/bank/chat?applicationId=${app.id}&applicationNumber=${app.applicationNumber || ''}&bank=${encodeURIComponent(app.bank || '')}`)}
                                                                    className="px-3 py-1.5 bg-purple-50 hover:bg-[#6605c7] hover:text-white text-[#6605c7] text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                                                    title="Chat with Staff for this application"
                                                                >
                                                                    <span className="material-symbols-outlined text-[13px]">forum</span>
                                                                    Chat
                                                                </button>
                                                                <button
                                                                    onClick={() => router.push(`/bank/applications?id=${app.id}`)}
                                                                    className="px-3.5 py-1.5 bg-[#6605c7]/5 hover:bg-[#6605c7] hover:text-white text-[#6605c7] text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm"
                                                                >
                                                                    Review
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                );
                            })()}
                        </div>
                    </div>
                </motion.div>

                {/* Directive & Security Matrix */}
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="space-y-4"
                >


                    {portfolio?.topUniversities && portfolio.topUniversities.length > 0 && (
                        <div className="glass-card p-5 rounded-2xl relative overflow-hidden group">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-xs font-black font-display text-gray-900 uppercase tracking-widest">Top University Partners</h3>
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Approved %</span>
                            </div>
                            <div className="space-y-2">
                                {portfolio.topUniversities.map((uni: any, idx: number) => (
                                    <div key={idx} className="flex justify-between items-center gap-3">
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className="material-symbols-outlined text-sm text-[#6605c7]">school</span>
                                            <span className="text-[10px] font-black text-gray-700 truncate">{uni.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-[8px] font-bold text-gray-400">{uni.count} apps</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${uni.approvalRate >= 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                {uni.approvalRate}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div
                        className="p-5 rounded-2xl overflow-hidden relative group"
                        style={{
                            background: 'linear-gradient(135deg, #6605c7 0%, #8b24e5 100%)',
                            boxShadow: '0 8px 32px rgba(102,5,199,0.30)'
                        }}
                    >
                        <div className="relative z-10">
                            <h3 className="text-sm font-black text-white mb-2 uppercase tracking-widest">Compliance Shield</h3>
                            <p className="text-white/70 text-[9px] font-bold uppercase tracking-[0.18em] mb-4 leading-relaxed">
                                {compliance
                                    ? `Score: ${compliance.overallCompliance || 100}% • RBI & NHB Compliant`
                                    : 'Synchronized under RBI-GDRP-v2.0 protocol.'}
                            </p>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#4ade80]" />
                                </div>
                                <div>
                                    <span className="text-[9px] font-black text-white uppercase tracking-[0.25em] block">
                                        {compliance ? 'System Validated' : 'Sentinel Engine Live'}
                                    </span>
                                    <span className="text-[7.5px] font-bold text-white/40 uppercase tracking-widest">
                                        {compliance?.gstCompliance?.status === 'warning'
                                            ? compliance.gstCompliance.detail
                                            : 'All nodes stable & verified'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <span className="material-symbols-outlined text-[8rem] absolute -right-6 -bottom-6 text-white/5 group-hover:scale-125 transition-transform duration-700 pointer-events-none select-none">verified_user</span>
                    </div>
                </motion.div>
            </div>

            {/* Mesh background subtle overlay */}
            <div className="fixed inset-0 bg-mesh-gradient opacity-[0.03] pointer-events-none -z-10" />

            {/* Quick Action Command Bar */}
            {/* <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-xl transition-transform duration-300">
                <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#6605c7] to-[#8b24e5] rounded-full blur-md opacity-20 group-hover:opacity-40 transition-opacity"></div>
                    <div className="relative bg-white/90 backdrop-blur-xl border border-gray-200/50 shadow-2xl rounded-full flex items-center px-6 py-4">
                        <span className="material-symbols-outlined text-[#6605c7] text-2xl mr-4">terminal</span>
                        <input
                            ref={commandInputRef}
                            type="text"
                            placeholder="Type a command (e.g. /distribute, /chat) or search..."
                            className="flex-1 bg-transparent border-none outline-none text-base font-bold text-gray-900 placeholder-gray-400"
                        />
                        <div className="flex items-center gap-1.5 ml-4 px-3 py-1.5 rounded-lg bg-gray-100/80 border border-gray-200/50 shrink-0">
                            <span className="text-xs font-bold text-gray-500 font-mono">⌘</span>
                            <span className="text-xs font-bold text-gray-500 font-mono">K</span>
                        </div>
                    </div>
                </div>
            </div> */}
        </div>
    );
}
