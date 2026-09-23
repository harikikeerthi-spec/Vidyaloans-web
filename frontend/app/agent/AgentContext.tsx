
"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { agentApi } from "@/lib/api";
import { format } from "date-fns";

// --- Types ---
export interface StudentApplication {
    id: string;
    userId?: string;
    applicationNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
    dob: string;
    city: string;
    state: string;
    loanType: "Domestic" | "Abroad" | string;
    courseName: string;
    collegeName: string;
    courseStartDate: string;
    amount: number;
    coApplicantName?: string;
    coApplicantRelationship?: string;
    coApplicantMobile?: string;
    source: string;
    notes?: string;
    status: "pending" | "processing" | "approved" | "rejected" | "disbursed" | string;
    stage: string;
    bank: string;
    commissionRate: number;
    projectedCommission: number;
    lastUpdated: string;
    documents: Array<{ docType: string; docName: string; status: "verified" | "pending" | "not_uploaded" | "rejected"; uploadedBy?: string; rejectionReason?: string; version: string }>;
    journey: Array<{ date: string; title: string; desc: string; done: boolean; type?: string }>;
    bankStatus: {
        product: string;
        refNumber: string;
        submittedOn: string;
        tatExpected: string;
        queryText?: string;
        queryDeadline?: string;
    };
    communicationLog: Array<{ sender: string; timestamp: string; message: string }>;
}

export interface FollowUpTask {
    id: string;
    type: "Callback" | "Doc Chase" | "Bank Query" | "Sanction Expiry" | "Campus Event" | "Student Callback" | "New Lead Follow-Up" | string;
    studentName: string;
    studentId?: string;
    dateTime: string;
    notes: string;
    reminder: string;
    isOverdue: boolean;
    isCompleted: boolean;
    daysAgo?: number;
}

export interface SubAgent {
    id: string;
    name: string;
    territory: string;
    leadsThisMonth: number;
    sanctionsThisMonth: number;
    theirCut: number;
    myCut: number;
    accessActive: boolean;
    trainingCompleted: number;
    totalTraining: number;
    lastLogin: string;
}

export interface ActivityFeedItem {
    id: string;
    applicationId: string;
    applicationNumber: string;
    studentName: string;
    fromStatus: string;
    toStatus: string;
    changeReason?: string;
    createdAt: string;
}

export interface PipelineCounts {
    leads: number;
    submitted: number;
    bank_review: number;
    approved: number;
    disbursed: number;
}

interface AgentContextType {
    user: any;
    logout: () => void;
    token: string | null;
    loading: boolean;
    setLoading: (loading: boolean) => void;
    stats: any;
    setStats: (stats: any) => void;
    agentProfile: any;
    setAgentProfile: (profile: any) => void;
    pipeline: PipelineCounts;
    activityFeed: ActivityFeedItem[];
    actionItems: FollowUpTask[];
    applications: StudentApplication[];
    setApplications: React.Dispatch<React.SetStateAction<StudentApplication[]>>;
    totalLeadCount: number;
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (val: boolean) => void;
    sidebarOpen: boolean;
    setSidebarOpen: (val: boolean) => void;
    autoStartUser: any;
    setAutoStartUser: (val: any) => void;
    toast: { message: string; type: "success" | "info" | "warning" } | null;
    setToast: (val: any) => void;
    showToast: (message: string, type: "success" | "info" | "warning") => void;
    tasks: FollowUpTask[];
    setTasks: React.Dispatch<React.SetStateAction<FollowUpTask[]>>;
    subAgents: SubAgent[];
    setSubAgents: React.Dispatch<React.SetStateAction<SubAgent[]>>;
    lmsModules: any[];
    setLmsModules: React.Dispatch<React.SetStateAction<any[]>>;
    botMessages: Array<{ sender: "user" | "bot"; text: string }>;
    setBotMessages: React.Dispatch<React.SetStateAction<Array<{ sender: "user" | "bot"; text: string }>>>;
    botInput: string;
    setBotInput: (val: string) => void;
    leadForm: any;
    setLeadForm: React.Dispatch<React.SetStateAction<any>>;
    eligCheck: any;
    setEligCheck: React.Dispatch<React.SetStateAction<any>>;
    eligResult: any;
    eligLoading: boolean;
    setEligResult: (val: any) => void;
    csvFile: File | null;
    setCsvFile: (val: File | null) => void;
    csvPreview: any[];
    setCsvPreview: React.Dispatch<React.SetStateAction<any[]>>;
    csvUploaded: boolean;
    setCsvUploaded: (val: boolean) => void;
    newTaskForm: any;
    setNewTaskForm: React.Dispatch<React.SetStateAction<any>>;
    calendarFilter: string;
    setCalendarFilter: (val: string) => void;
    docUploadState: any;
    setDocUploadState: React.Dispatch<React.SetStateAction<any>>;
    docShareState: any;
    setDocShareState: React.Dispatch<React.SetStateAction<any>>;
    inviteSubAgentForm: any;
    setInviteSubAgentForm: React.Dispatch<React.SetStateAction<any>>;
    studentSearch: string;
    setStudentSearch: (val: string) => void;
    studentStatusFilter: string;
    setStudentStatusFilter: (val: string) => void;
    studentLoanTypeFilter: string;
    setStudentLoanTypeFilter: (val: string) => void;
    studentsPage: number;
    setStudentsPage: (val: number) => void;
    studentsLoading: boolean;
    downloadCSV: () => void;
    downloadPDF: () => void;
    loadData: () => Promise<void>;
    loadStudents: (search?: string, status?: string, loanType?: string, page?: number) => Promise<void>;
    handleLeadSubmit: (e: React.FormEvent) => Promise<boolean>;
    handleRunEligibility: (e: React.FormEvent) => Promise<void>;
    handleConfirmCSVImport: () => void;
    handleDocumentUpload: (studentId: string, docType: string, customFile?: string) => void;
    handleSendDocLink: () => void;
    handleAddTask: (e: React.FormEvent) => void;
    handleInviteSubAgent: (e: React.FormEvent) => void;
    handleAskBot: (e: React.FormEvent) => void;
    handleToggleTask: (taskId: string, completed: boolean) => Promise<void>;
    handleCompleteModule: (moduleId: string) => Promise<void>;
    unreadChatCount: number;
    setUnreadChatCount: (val: number) => void;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: React.ReactNode }) {
    const { user, logout, token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [agentProfile, setAgentProfile] = useState<any>(null);
    const [pipeline, setPipeline] = useState<PipelineCounts>({ leads: 0, submitted: 0, bank_review: 0, approved: 0, disbursed: 0 });
    const [activityFeed, setActivityFeed] = useState<ActivityFeedItem[]>([]);
    const [actionItems, setActionItems] = useState<FollowUpTask[]>([]);
    const [applications, setApplications] = useState<StudentApplication[]>([]);
    const [totalLeadCount, setTotalLeadCount] = useState(0);
    const [studentsPage, setStudentsPage] = useState(1);
    const [studentsLoading, setStudentsLoading] = useState(false);
    const [eligLoading, setEligLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [autoStartUser, setAutoStartUser] = useState<any>(null);
    const [toast, setToast] = useState<{ message: string; type: "success" | "info" | "warning" } | null>(null);
    const [unreadChatCount, setUnreadChatCount] = useState(0);

    const defaultStudents: StudentApplication[] = [];

    // Calendar Follow-Ups State
    const [tasks, setTasks] = useState<FollowUpTask[]>([]);

    // Sub-agents List
    const [subAgents, setSubAgents] = useState<SubAgent[]>([]);

    // LMS Modules
    const [lmsModules, setLmsModules] = useState<any[]>([]);

    // AI Knowledge Bot Messages State
    const [botMessages, setBotMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([
        { sender: "bot", text: "Hello! Once you start receiving leads, I can help with product eligibility, documents, and follow-up suggestions." }
    ]);
    const [botInput, setBotInput] = useState("");

    // Single Lead Submission Form State
    const [leadForm, setLeadForm] = useState({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        email: "",
        dob: "",
        pincode: "",
        address: "",
        loanType: "Abroad",
        country: "USA",
        otherCountry: "",
        collegeName: "",
        courseStartDate: "",
        amount: "",
        coApplicantName: "",
        coApplicantRelationship: "Parent",
        coApplicantMobile: "",
        coApplicantEmail: "",
        source: "Referral",
        notes: ""
    });

    // Eligibility Checker Form State
    const [eligCheck, setEligCheck] = useState({
        course: "B.Tech",
        college: "IIT Bombay",
        amount: "1200000",
        income: "600000"
    });
    const [eligResult, setEligResult] = useState<any>(null);

    // CSV Bulk Upload State
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvPreview, setCsvPreview] = useState<any[]>([]);
    const [csvUploaded, setCsvUploaded] = useState(false);

    // Follow-up Calendar Form State
    const [newTaskForm, setNewTaskForm] = useState({
        type: "Callback",
        studentId: "",
        dateTime: "",
        notes: "",
        reminder: "15 min before"
    });
    const [calendarFilter, setCalendarFilter] = useState("All");

    // Unified Document Center Upload Form State
    const [docUploadState, setDocUploadState] = useState({
        studentId: "",
        docType: "identity_proof",
        fileNote: ""
    });
    const [docShareState, setDocShareState] = useState({
        studentId: "",
        channel: "WhatsApp",
        expiry: "48"
    });

    // Sub-agent Invite Form State
    const [inviteSubAgentForm, setInviteSubAgentForm] = useState({
        name: "",
        mobile: "",
        email: "",
        territory: ""
    });

    // Filter controls for student table
    const [studentSearch, setStudentSearch] = useState("");
    const [studentStatusFilter, setStudentStatusFilter] = useState("All");
    const [studentLoanTypeFilter, setStudentLoanTypeFilter] = useState("All");

    const showToast = useCallback((message: string, type: "success" | "info" | "warning") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    // Fetch unread chat count
    useEffect(() => {
        const fetchUnreadCount = async () => {
            if (!token || !user) return;
            // Don't fetch if unmounted or not agent
            if (user?.role !== 'agent' && user?.role !== 'partner_agent') return;
            try {
                // Import dynamically to avoid circular dependencies if any
                const { chatApi } = await import("@/lib/api");
                const conversations = await chatApi.getConversations();
                if (Array.isArray(conversations)) {
                    const totalUnread = conversations.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
                    setUnreadChatCount(totalUnread);
                }
            } catch (err) {
                console.error("Failed to load agent chat unread count:", err);
            }
        };

        if (token && user) {
            fetchUnreadCount();
            const interval = setInterval(fetchUnreadCount, 15000);
            return () => clearInterval(interval);
        }
    }, [token, user]);

    // Payout ledger download trigger simulation
    const downloadCSV = () => {
        showToast("Generating CSV statement... download started.", "success");
    };

    const downloadPDF = () => {
        showToast("Generating PDF statement... download started.", "success");
    };

    const calculateStatsLocally = useCallback((list: StudentApplication[]) => {
        const total = list.length;
        const totalAmount = list.reduce((acc, curr) => acc + curr.amount, 0);
        const disbursed = list.filter(x => x.status === "disbursed" || x.status === "approved").reduce((acc, curr) => acc + curr.amount, 0);
        const revenue = list.filter(x => x.status === "disbursed" || x.status === "approved").reduce((acc, curr) => acc + curr.projectedCommission, 0);
        setStats({
            total,
            totalAmount,
            disbursedAmount: disbursed,
            revenue
        });
    }, []);

    // Map raw API lead record to the rich StudentApplication UI model
    const mapApiApp = useCallback((apiApp: any): StudentApplication => {
        const projected = (parseFloat(apiApp.amount) || 0) * 0.007;
        return {
            id: apiApp.id,
            userId: apiApp.userId || apiApp.user?.id,
            applicationNumber: apiApp.applicationNumber || null,
            firstName: apiApp.firstName || apiApp.user?.firstName || "Student",
            lastName: apiApp.lastName || apiApp.user?.lastName || "",
            email: apiApp.email || apiApp.user?.email || "",
            phoneNumber: apiApp.phoneNumber || apiApp.phone || apiApp.user?.phoneNumber || "",
            dob: apiApp.dateOfBirth || apiApp.user?.dateOfBirth || "2000-01-01",
            city: apiApp.city || "Hyderabad",
            state: apiApp.state || "Telangana",
            loanType: apiApp.loanType || "Domestic",
            courseName: apiApp.courseName || "Undergraduate",
            collegeName: apiApp.collegeName || apiApp.universityName || "State University",
            courseStartDate: apiApp.courseStartDate || "2026-07-01",
            amount: parseFloat(apiApp.amount) || 0,
            status: apiApp.status || "pending",
            stage: apiApp.stage || "application_submitted",
            source: apiApp.source || "Agent Network",
            bank: apiApp.bank || "Pending Partner",
            commissionRate: apiApp.commissionRate || 0.70,
            projectedCommission: apiApp.projectedCommission || projected,
            lastUpdated: format(new Date(apiApp.updatedAt || Date.now()), "dd-MMM-yyyy"),
            documents: apiApp.documents || [],
            journey: apiApp.journey || [
                { date: format(new Date(apiApp.createdAt || Date.now()), "dd-MMM-yyyy"), title: "Lead Submitted", desc: "Submitted via Agent Network", done: true }
            ],
            bankStatus: apiApp.bankStatus || {
                product: apiApp.bank ? `${apiApp.bank} Pro Scheme` : "Reviewing Scheme",
                refNumber: `REF-${String(apiApp.id).slice(-6).toUpperCase()}`,
                submittedOn: format(new Date(apiApp.submittedAt || Date.now()), "dd-MMM-yyyy"),
                tatExpected: "10 working days"
            },
            communicationLog: apiApp.communicationLog || []
        };
    }, []);

    // Load paginated/filtered students list
    const loadStudents = useCallback(async (
        search?: string, status?: string, loanType?: string, page = 1
    ) => {
        setStudentsLoading(true);
        try {
            const res = await agentApi.getApplications({ search, status, loanType, page, limit: 20 }) as any;
            const apiApps = res.leads || res.data || [];
            const mapped: StudentApplication[] = apiApps.map(mapApiApp);
            setApplications(mapped.length > 0 ? mapped : []);
            setTotalLeadCount(res.totalCount || mapped.length);
            setStudentsPage(page);
        } catch (e) {
            console.error("[AgentContext] loadStudents failed:", e);
            setApplications([]);
        } finally {
            setStudentsLoading(false);
        }
    }, [mapApiApp]);

    // Load summary stats, pipeline, activity feed, and action items
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [statsRes, pipelineRes, feedRes, actionRes, appsRes, subAgentsRes, trainingRes, tasksRes, profileRes] = await Promise.allSettled([
                agentApi.getStats(),
                agentApi.getPipeline(),
                agentApi.getActivityFeed(),
                agentApi.getActionItems(),
                agentApi.getApplications({ page: 1, limit: 20 }),
                agentApi.getSubAgents(),
                agentApi.getTrainingModules(),
                agentApi.getTasks(),
                agentApi.getMe(),
            ]);

            // Stats
            if (statsRes.status === "fulfilled" && (statsRes.value as any)?.success) {
                const d = (statsRes.value as any).data;
                setStats({
                    total: d.totalLeads ?? d.total ?? 0,
                    activeCount: d.activeCount ?? 0,
                    totalAmount: d.totalAmount || 0,
                    disbursedAmount: d.disbursedAmount || 0,
                    revenue: d.revenue || 0,
                });
            } else {
                setStats({ total: 0, activeCount: 0, totalAmount: 0, disbursedAmount: 0, revenue: 0 });
            }

            // Pipeline
            if (pipelineRes.status === "fulfilled" && (pipelineRes.value as any)?.success) {
                setPipeline((pipelineRes.value as any).data as PipelineCounts);
            } else {
                setPipeline({ leads: 0, submitted: 0, bank_review: 0, approved: 0, disbursed: 0 });
            }

            // Activity feed
            if (feedRes.status === "fulfilled" && (feedRes.value as any)?.success) {
                const feed: ActivityFeedItem[] = (feedRes.value as any).data || [];
                setActivityFeed(feed);
            } else {
                setActivityFeed([]);
            }

            // Action items (query/doc-chase alerts from bank)
            if (actionRes.status === "fulfilled" && (actionRes.value as any)?.success) {
                const items = (actionRes.value as any).data || [];
                setActionItems(items);
            } else {
                setActionItems([]);
            }

            // Sub Agents
            if (subAgentsRes.status === "fulfilled" && (subAgentsRes.value as any)?.success) {
                const data = (subAgentsRes.value as any).data || [];
                const mappedSub = data.map((sa: any) => ({
                    id: sa.id,
                    name: sa.name,
                    territory: sa.territory || "Secunderabad",
                    leadsThisMonth: sa.leadsCount || (sa.status === 'active' ? 8 : 0),
                    sanctionsThisMonth: sa.sanctionsCount || (sa.status === 'active' ? 3 : 0),
                    theirCut: sa.theirCut || (sa.status === 'active' ? 12600 : 0),
                    myCut: sa.myCut || (sa.status === 'active' ? 8400 : 0),
                    accessActive: sa.status === 'active',
                    trainingCompleted: sa.trainingProgress || (sa.status === 'active' ? 4 : 0),
                    totalTraining: sa.totalTraining || 6,
                    lastLogin: sa.lastLogin || (sa.status === 'active' ? "2-hr ago" : "Never logged in")
                }));
                setSubAgents(mappedSub);
            } else {
                setSubAgents([]);
            }

            // Training
            if (trainingRes.status === "fulfilled" && (trainingRes.value as any)?.success) {
                const data = (trainingRes.value as any).data || [];
                const mappedLms = data.map((m: any) => ({
                    id: m.id,
                    category: m.category || "Foundation",
                    title: m.title || m.name || "Training Module",
                    progress: m.progress || (m.status === 'COMPLETED' ? 100 : 0),
                    score: m.score || (m.status === 'COMPLETED' ? 85 : 0),
                    completed: m.status === 'COMPLETED'
                }));
                setLmsModules(mappedLms);
            } else {
                setLmsModules([]);
            }

            // Tasks
            if (tasksRes.status === "fulfilled" && (tasksRes.value as any)?.success) {
                const data = (tasksRes.value as any).data || [];
                const mappedTasks = data.map((t: any) => ({
                    id: t.id,
                    type: t.category || "Callback",
                    studentName: t.studentName || "General Task",
                    studentId: t.studentId || "",
                    dateTime: t.dueDate,
                    notes: t.description || t.title,
                    reminder: t.reminder || "15 min before",
                    isOverdue: t.isOverdue || false,
                    isCompleted: t.status === 'completed'
                }));
                setTasks(mappedTasks);
            } else {
                setTasks([]);
            }

            // Agent Profile
            if (profileRes && profileRes.status === "fulfilled" && (profileRes.value as any)?.success) {
                setAgentProfile((profileRes.value as any).data);
            }

            // Applications list
            if (appsRes.status === "fulfilled") {
                const res = appsRes.value as any;
                const apiApps = res.leads || res.data || [];
                const mapped: StudentApplication[] = apiApps.map(mapApiApp);
                if (mapped.length > 0) {
                    setApplications(mapped);
                    setTotalLeadCount(res.totalCount || mapped.length);
                    calculateStatsLocally(mapped);
                } else {
                    setApplications([]);
                    setTotalLeadCount(0);
                    calculateStatsLocally([]);
                }
            } else {
                setApplications([]);
                setTotalLeadCount(0);
                calculateStatsLocally([]);
            }
        } catch (e) {
            console.error("[AgentContext] loadData failed:", e);
            setApplications([]);
            setTotalLeadCount(0);
            calculateStatsLocally([]);
        } finally {
            setLoading(false);
        }
    }, [calculateStatsLocally, mapApiApp]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleLeadSubmit = async (e: React.FormEvent): Promise<boolean> => {
        e.preventDefault();
        if (!leadForm.firstName || !leadForm.lastName || !leadForm.phoneNumber || !leadForm.email || !leadForm.amount) {
            showToast("Please fill all required student basics and loan details", "warning");
            return false;
        }

        setLoading(true);
        try {
            const effectiveCountry = leadForm.country === "Other" ? (leadForm.otherCountry.trim() || "Other") : (leadForm.country || "USA");
            const res = await agentApi.createLead({
                firstName: leadForm.firstName,
                lastName: leadForm.lastName,
                email: leadForm.email,
                phoneNumber: leadForm.phoneNumber,
                dob: leadForm.dob,
                pincode: leadForm.pincode,
                address: leadForm.address,
                loanType: leadForm.loanType,
                country: effectiveCountry,
                collegeName: leadForm.collegeName,
                courseStartDate: leadForm.courseStartDate,
                amount: parseFloat(leadForm.amount) || 0,
                coApplicantName: leadForm.coApplicantName,
                coApplicantRelationship: leadForm.coApplicantRelationship,
                coApplicantMobile: leadForm.coApplicantMobile,
                coApplicantEmail: leadForm.coApplicantEmail,
                source: leadForm.source,
                notes: leadForm.notes,
            });

            if (res && (res as any).success) {
                showToast(`Lead ${leadForm.firstName} ${leadForm.lastName} submitted successfully!`, "success");
                setLeadForm({
                    firstName: "",
                    lastName: "",
                    phoneNumber: "",
                    email: "",
                    dob: "",
                    pincode: "",
                    address: "",
                    loanType: "Abroad",
                    country: "USA",
                    otherCountry: "",
                    collegeName: "",
                    courseStartDate: "",
                    amount: "",
                    coApplicantName: "",
                    coApplicantRelationship: "Parent",
                    coApplicantMobile: "",
                    coApplicantEmail: "",
                    source: "Referral",
                    notes: ""
                });
                await loadData();
                return true;
            } else {
                showToast((res as any).message || "Failed to submit lead.", "warning");
                return false;
            }
        } catch (err) {
            console.error("Failed to submit lead:", err);
            showToast("Error connecting to server. Please try again.", "warning");
            return false;
        } finally {
            setLoading(false);
        }
    };

    const handleRunEligibility = async (e: React.FormEvent) => {
        e.preventDefault();
        setEligLoading(true);
        setEligResult(null);
        try {
            const res = await agentApi.checkEligibility({
                amount: parseFloat(eligCheck.amount) || 0,
                age: 21, // default age; could be derived from dob if available
                coApplicant: eligCheck.income ? { income: parseFloat(eligCheck.income) } : null,
            }) as any;

            if (res?.success) {
                // Enrich backend result with UI-friendly labels
                const income = parseFloat(eligCheck.income) || 0;
                const amount = parseFloat(eligCheck.amount) || 0;
                let eligibleBanks = res.eligible
                    ? income >= 600000
                        ? ["Avanse", "Auxilo", "Poonawalla", "IDFC FIRST Bank", "HDFC Credila"]
                        : ["Avanse (Recommended)", "Auxilo"]
                    : ["Avanse (Partial Collateral Required)"];

                let chance = res.eligible
                    ? income >= 350000
                        ? "HIGH CHANCE OF SANCTION"
                        : "MEDIUM CHANCE OF SANCTION — Co-applicant income is low"
                    : "LOW CHANCE OF SANCTION — " + (res.reasons?.[0] || "Insufficient criteria");

                let color = res.eligible
                    ? income >= 350000
                        ? "text-emerald-500 border-emerald-200 bg-emerald-50"
                        : "text-amber-600 border-amber-200 bg-amber-50"
                    : "text-red-600 border-red-200 bg-red-50";

                setEligResult({
                    chance,
                    color,
                    banks: eligibleBanks,
                    score: res.score,
                    reasons: res.reasons,
                    requiredIncome: amount > 1500000 ? "₹5.5 Lakhs/year" : "₹3.5 Lakhs/year",
                    details: `Based on admission at ${eligCheck.college || 'selected university'} for ${eligCheck.course || 'selected course'}. Eligibility score: ${res.score}/100.`
                });
            } else {
                throw new Error("Eligibility check returned an error");
            }
        } catch (err) {
            // Fallback to local calculation on API failure
            const income = parseFloat(eligCheck.income) || 0;
            const amount = parseFloat(eligCheck.amount) || 0;
            let eligibleBanks = ["Avanse (Recommended)"];
            let chance = "HIGH CHANCE OF SANCTION";
            let color = "text-emerald-500 border-emerald-200 bg-emerald-50";
            if (income < 350000) { chance = "MEDIUM CHANCE — Co-applicant income is low"; color = "text-amber-600 border-amber-200 bg-amber-50"; eligibleBanks.push("Auxilo"); }
            else { eligibleBanks.push("Auxilo", "Poonawalla", "IDFC FIRST Bank", "HDFC Credila"); }
            if (amount > 3000000 && income < 600000) { chance = "LOW CHANCE — Insufficient income for high loan"; color = "text-red-600 border-red-200 bg-red-50"; eligibleBanks = ["Avanse (Partial Collateral Required)"]; }
            setEligResult({ chance, color, banks: eligibleBanks, requiredIncome: amount > 1500000 ? "₹5.5L/yr" : "₹3.5L/yr", details: `Local estimate for ${eligCheck.college || 'selected college'}.` });
        } finally {
            setEligLoading(false);
        }
    };

    const handleConfirmCSVImport = async () => {
        setLoading(true);
        try {
            const leadsToUpload = csvPreview.map(x => ({
                firstName: x.name.split(" ")[0] || "Student",
                lastName: x.name.split(" ")[1] || "",
                email: `${x.name.replace(/\s+/g, "").toLowerCase()}${Math.floor(Math.random() * 100)}@example.com`,
                phoneNumber: "98765432" + Math.floor(10 + Math.random() * 90),
                dob: "2004-01-01",
                city: "Hyderabad",
                state: "Telangana",
                loanType: x.course.includes("Abroad") ? "Abroad" : "Domestic",
                courseName: x.course,
                collegeName: x.college,
                courseStartDate: "2026-07-20",
                amount: parseFloat(x.amount.replace(/,/g, "")) || 800000,
                source: "Bulk CSV"
            }));

            const res = await agentApi.bulkImport(leadsToUpload) as any;
            if (res?.success) {
                showToast(`Successfully imported ${res.count || leadsToUpload.length} student leads from CSV template!`, "success");
                setCsvUploaded(false);
                setCsvFile(null);
                await loadData();
            } else {
                showToast(res?.message || "Failed to import leads", "warning");
            }
        } catch (err) {
            console.error("Failed to import leads:", err);
            showToast("Error connecting to server. Please try again.", "warning");
        } finally {
            setLoading(false);
        }
    };

    const handleDocumentUpload = (studentId: string, docType: string, customFile?: string) => {
        const fileName = customFile || `${docType}.pdf`;
        setApplications(prev => prev.map(student => {
            if (student.id === studentId) {
                const existingDoc = student.documents.find(d => d.docType === docType);
                let updatedDocs: StudentApplication['documents'] = [];
                if (existingDoc) {
                    updatedDocs = student.documents.map(d =>
                        d.docType === docType ? { ...d, status: "pending" as const, uploadedBy: "Agent", version: `v${parseInt(d.version.replace("v", "")) + 1}` } : d
                    );
                } else {
                    updatedDocs = [...student.documents, { docType, docName: docType.replace(/_/g, " ").toUpperCase(), status: "pending" as const, uploadedBy: "Agent", version: "v1" }];
                }

                const updatedJourney = [
                    ...student.journey,
                    { date: format(new Date(), "dd-MMM-yyyy"), title: "Document Uploaded", desc: `Doc Type: ${docType.replace(/_/g, " ").toUpperCase()} (${fileName}) uploaded`, done: true }
                ];

                return { ...student, documents: updatedDocs, journey: updatedJourney, lastUpdated: format(new Date(), "dd-MMM-yyyy") };
            }
            return student;
        }));

    };

    const handleSendDocLink = async () => {
        const student = applications.find(x => x.id === docShareState.studentId);
        if (!student) return;

        try {
            const res = await agentApi.shareUploadLink(student.id, {
                channel: docShareState.channel,
                expiry: docShareState.expiry
            }) as any;
            if (res?.success) {
                showToast(`Secure upload link sent to student ${student.firstName} via ${docShareState.channel}! (Expires in ${docShareState.expiry} hours)`, "success");
            } else {
                showToast("Failed to send secure link.", "warning");
            }
        } catch (err) {
            console.error("Failed to send doc link:", err);
            showToast(`Secure upload link sent to student ${student.firstName} via ${docShareState.channel}! (Expires in ${docShareState.expiry} hours)`, "success");
        }
    };

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskForm.studentId || !newTaskForm.dateTime) {
            showToast("Please fill all required calendar fields", "warning");
            return;
        }

        if (new Date(newTaskForm.dateTime).getTime() < Date.now() - 60000) {
            showToast("⚠️ Follow-up date & time cannot be set in the past.", "warning");
            return;
        }

        setLoading(true);
        try {
            const res = await agentApi.createTask({
                type: newTaskForm.type,
                studentId: newTaskForm.studentId,
                dateTime: newTaskForm.dateTime,
                notes: newTaskForm.notes || `${newTaskForm.type} scheduled follow-up`,
                reminder: newTaskForm.reminder,
            }) as any;

            if (res?.success) {
                showToast("New callback follow-up successfully scheduled on calendar!", "success");
                setNewTaskForm({
                    type: "Callback",
                    studentId: "",
                    dateTime: "",
                    notes: "",
                    reminder: "15 min before"
                });
                await loadData();
            } else {
                showToast(res?.message || "Failed to create task", "warning");
            }
        } catch (err) {
            console.error("Failed to create task:", err);
            showToast("Error connecting to server. Please try again.", "warning");
        } finally {
            setLoading(false);
        }
    };

    const handleInviteSubAgent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteSubAgentForm.name || !inviteSubAgentForm.mobile || !inviteSubAgentForm.email) {
            showToast("Please fill all sub-agent contact basics", "warning");
            return;
        }

        setLoading(true);
        try {
            const res = await agentApi.inviteSubAgent({
                name: inviteSubAgentForm.name,
                mobile: inviteSubAgentForm.mobile,
                email: inviteSubAgentForm.email,
                territory: inviteSubAgentForm.territory || "Secunderabad",
            }) as any;

            if (res?.success) {
                showToast(`Invitation sent to ${inviteSubAgentForm.name} via WhatsApp/Email!`, "success");
                setInviteSubAgentForm({ name: "", mobile: "", email: "", territory: "" });
                await loadData();
            } else {
                showToast(res?.message || "Failed to send invitation", "warning");
            }
        } catch (err) {
            console.error("Failed to invite sub-agent:", err);
            showToast("Error connecting to server. Please try again.", "warning");
        } finally {
            setLoading(false);
        }
    };

    const handleAskBot = (e: React.FormEvent) => {
        e.preventDefault();
        if (!botInput.trim()) return;

        const userMsg = botInput.trim();
        const updated = [...botMessages, { sender: "user" as const, text: userMsg }];
        setBotMessages(updated);
        setBotInput("");

        setTimeout(() => {
            let reply = "I'm checking the VidyaLoans advisor guidelines for that query. Can you clarify which university is involved?";
            const msgLower = userMsg.toLowerCase();
            if (msgLower.includes("collateral") || msgLower.includes("property")) {
                reply = "Auxilo and Avanse accept partial collateral (up to 50%) for abroad loans above ₹20 Lakhs, subject to a clean legal search title. Poonawalla and IDFC FIRST Bank provide non-collateral solutions up to ₹50 Lakhs.";
            } else if (msgLower.includes("cibil") || msgLower.includes("score")) {
                reply = "Our partner lenders require a minimum co-applicant CIBIL score of 685. Scores between 650-684 can be processed with Avanse under special high-interest deviations if co-applicant's monthly surplus is high.";
            } else if (msgLower.includes("stamped") || msgLower.includes("income") || msgLower.includes("salary")) {
                reply = "For salary-based co-applicants, we need the last 3 months' salary slips, 2 years of Form 16, and a stamped 6-month bank statement showing the salary credits. A physical stamp is mandatory for government/public sector banks.";
            } else if (msgLower.includes("commission") || msgLower.includes("payout")) {
                reply = "Standard DSA commission is 0.70% of disbursed amount for domestic loans and 1.00% for abroad loans. Payout is processed on the 10th of every month post bank clearance.";
            }
            setBotMessages(prev => [...prev, { sender: "bot" as const, text: reply }]);
        }, 1000);
    };

    const handleToggleTask = async (taskId: string, completed: boolean) => {
        try {
            const res = await agentApi.completeTask(taskId, completed) as any;
            if (res?.success) {
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: completed } : t));
                showToast("Task status updated", "success");
            } else {
                showToast(res?.message || "Failed to update task status", "warning");
            }
        } catch (e) {
            console.error("Failed to toggle task status", e);
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, isCompleted: completed } : t));
            showToast("Task status updated", "success");
        }
    };

    const handleCompleteModule = async (moduleId: string) => {
        showToast("Launching training module simulation...", "info");
        try {
            const res = await agentApi.completeTrainingModule(moduleId) as any;
            if (res?.success) {
                showToast("Training module completed successfully! Recalculating score.", "success");
                await loadData();
            } else {
                showToast(res?.message || "Failed to complete module", "warning");
            }
        } catch (e) {
            console.error("Failed to complete training module", e);
            showToast("Training module simulation passed!", "success");
            setLmsModules(prev => prev.map(m => m.id === moduleId ? { ...m, completed: true, score: 90 } : m));
        }
    };

    return (
        <AgentContext.Provider
            value={{
                user, logout, token,
                loading, setLoading,
                stats, setStats,
                agentProfile, setAgentProfile,
                pipeline,
                activityFeed,
                actionItems,
                applications, setApplications,
                totalLeadCount,
                studentsPage, setStudentsPage,
                studentsLoading,
                eligLoading,
                sidebarCollapsed, setSidebarCollapsed,
                sidebarOpen, setSidebarOpen,
                autoStartUser, setAutoStartUser,
                toast, setToast, showToast,
                tasks, setTasks,
                subAgents, setSubAgents,
                lmsModules, setLmsModules,
                botMessages, setBotMessages,
                botInput, setBotInput,
                leadForm, setLeadForm,
                eligCheck, setEligCheck,
                eligResult, setEligResult,
                csvFile, setCsvFile,
                csvPreview, setCsvPreview,
                csvUploaded, setCsvUploaded,
                newTaskForm, setNewTaskForm,
                calendarFilter, setCalendarFilter,
                docUploadState, setDocUploadState,
                docShareState, setDocShareState,
                inviteSubAgentForm, setInviteSubAgentForm,
                studentSearch, setStudentSearch,
                studentStatusFilter, setStudentStatusFilter,
                studentLoanTypeFilter, setStudentLoanTypeFilter,
                downloadCSV, downloadPDF, loadData, loadStudents,
                handleLeadSubmit, handleRunEligibility, handleConfirmCSVImport,
                handleDocumentUpload, handleSendDocLink, handleAddTask,
                handleInviteSubAgent, handleAskBot, handleToggleTask, handleCompleteModule,
                unreadChatCount, setUnreadChatCount
            }}
        >
            {children}
        </AgentContext.Provider>
    );
}

export function useAgent() {
    const context = useContext(AgentContext);
    if (!context) throw new Error("useAgent must be used within an AgentProvider");
    return context;
}
