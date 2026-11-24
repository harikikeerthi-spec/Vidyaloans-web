"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/bank/SharedUI";
import UserSupportTicketsView from "@/components/UserSupportTicketsView";
import Link from "next/link";

export default function BankSettings() {
    const [mounted, setMounted] = useState(false);
    const { user } = useAuth();

    // Tabs
    const [activeTab, setActiveTab] = useState<"preferences" | "tags" | "support">("preferences");

    // Existing preferences state
    const [emailAlerts, setEmailAlerts] = useState(true);
    const [smsAlerts, setSmsAlerts] = useState(false);
    const [autoAssign, setAutoAssign] = useState(true);
    const [slaThreshold, setSlaThreshold] = useState("48");
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

    // F38: Scheduled Reports Scheduler States
    const [reportFrequency, setReportFrequency] = useState("daily");
    const [reportDispatchHour, setReportDispatchHour] = useState("08:00");
    const [reportRecipients, setReportRecipients] = useState("auditor.sbi@vidyaloans.com, risk.committee@sbi.co.in");
    const [reportFormat, setReportFormat] = useState({ csv: true, pdf: false, xlsx: true });
    const [savingReports, setSavingReports] = useState(false);
    const [reportSaveStatus, setReportSaveStatus] = useState(false);

    // F41: Auto-Assignment States
    const [assignmentRules, setAssignmentRules] = useState([
        { id: "1", conditionType: "amount", operator: "gt", value: "₹15,00,000", targetOfficer: "Sarah Jenkins" },
        { id: "2", conditionType: "course", operator: "eq", value: "STEM Study Abroad", targetOfficer: "Vijay Kumar" },
        { id: "3", conditionType: "collateral", operator: "eq", value: "Property Deed", targetOfficer: "Rahul Verma" }
    ]);
    const [newRuleCondition, setNewRuleCondition] = useState("amount");
    const [newRuleOperator, setNewRuleOperator] = useState("gt");
    const [newRuleValue, setNewRuleValue] = useState("");
    const [newRuleOfficer, setNewRuleOfficer] = useState("Sarah Jenkins");

    // F43: Metadata & Tags States
    const [tags, setTags] = useState([
        { name: "High Net Worth", color: "#eab308", bg: "#fef9c3", text: "#854d0e", count: 12 },
        { name: "Urgent SLA", color: "#ef4444", bg: "#fee2e2", text: "#991b1b", count: 8 },
        { name: "STEM Program", color: "#22c55e", bg: "#dcfce7", text: "#166534", count: 24 },
        { name: "Documentation Pending", color: "#f97316", bg: "#ffedd5", text: "#9a3412", count: 15 },
        { name: "Collateral Verified", color: "#3b82f6", bg: "#dbeafe", text: "#1e40af", count: 19 },
    ]);
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState("#6605c7");

    // F24: Partnership Feedback Form States
    const [feedbackRating, setFeedbackRating] = useState(5);
    const [feedbackService, setFeedbackService] = useState("API Synch Speed");
    const [feedbackText, setFeedbackText] = useState("");
    const [feedbackRecommend, setFeedbackRecommend] = useState("Yes");
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

    // F25: SLA Ticket Wizard States
    const [faqSearch, setFaqSearch] = useState("");
    const [ticketSubject, setTicketSubject] = useState("");
    const [ticketPriority, setTicketPriority] = useState("Medium");
    const [ticketDescription, setTicketDescription] = useState("");
    const [ticketSubmitting, setTicketSubmitting] = useState(false);
    const [ticketSubmitted, setTicketSubmitted] = useState(false);
    const [ticketId, setTicketId] = useState("");

    useEffect(() => {
        setMounted(true);
    }, []);

    // Change operator list when condition type changes
    useEffect(() => {
        if (newRuleCondition === "amount") {
            setNewRuleOperator("gt");
        } else {
            setNewRuleOperator("eq");
        }
        setNewRuleValue("");
    }, [newRuleCondition]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setSaveStatus("idle");

        setTimeout(() => {
            setSaving(false);
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 3000);
        }, 1200);
    };

    // Helper label mapping
    const getCriteriaLabel = (c: string) => {
        if (c === "amount") return "Loan Amount (INR)";
        if (c === "course") return "Course Category";
        if (c === "collateral") return "Collateral Provided";
        return c;
    };

    const getOperatorLabel = (o: string) => {
        if (o === "gt") return "is Greater Than (>)";
        if (o === "lt") return "is Less Than (<)";
        if (o === "eq") return "Equals (=)";
        return o;
    };

    // Auto assignment action handlers
    const handleDeleteRule = (id: string) => {
        setAssignmentRules(prev => prev.filter(r => r.id !== id));
    };

    const handleAddRule = () => {
        if (!newRuleValue) return;

        const val = newRuleCondition === "amount" 
            ? Number(newRuleValue).toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 })
            : newRuleValue;

        const newRule = {
            id: String(Date.now()).slice(-4),
            conditionType: newRuleCondition,
            operator: newRuleOperator,
            value: val,
            targetOfficer: newRuleOfficer
        };

        setAssignmentRules(prev => [...prev, newRule]);
        setNewRuleValue("");
    };

    // Tag handlers
    const handleDeleteTag = (name: string) => {
        setTags(prev => prev.filter(t => t.name !== name));
    };

    const handleAddTag = () => {
        if (!newTagName) return;
        if (tags.some(t => t.name.toLowerCase() === newTagName.toLowerCase())) return;

        // Choose text/bg colors based on preset mapping
        let text = "#6605c7";
        let bg = "#f3e8ff";
        
        if (newTagColor === "#ef4444") {
            text = "#b91c1c";
            bg = "#fee2e2";
        } else if (newTagColor === "#22c55e") {
            text = "#047857";
            bg = "#dcfce7";
        } else if (newTagColor === "#3b82f6") {
            text = "#1d4ed8";
            bg = "#dbeafe";
        } else if (newTagColor === "#eab308") {
            text = "#a16207";
            bg = "#fef9c3";
        } else if (newTagColor === "#f97316") {
            text = "#c2410c";
            bg = "#ffedd5";
        }

        const newTag = {
            name: newTagName,
            color: newTagColor,
            bg,
            text,
            count: 0
        };

        setTags(prev => [...prev, newTag]);
        setNewTagName("");
    };

    // Scheduled reports save handler
    const handleSaveReports = (e: React.FormEvent) => {
        e.preventDefault();
        setSavingReports(true);
        setReportSaveStatus(false);
        setTimeout(() => {
            setSavingReports(false);
            setReportSaveStatus(true);
        }, 1000);
    };

    // Integration Feedback Submit
    const handleFeedbackSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFeedbackSubmitting(true);
        setFeedbackSubmitted(false);
        setTimeout(() => {
            setFeedbackSubmitting(false);
            setFeedbackSubmitted(true);
            setFeedbackText("");
        }, 1200);
    };

    // Support Ticket Submit
    const handleTicketSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setTicketSubmitting(true);
        setTicketSubmitted(false);
        setTimeout(() => {
            const generatedId = "#VL-TKT-" + Math.floor(10000 + Math.random() * 90000);
            setTicketSubmitting(false);
            setTicketSubmitted(true);
            setTicketId(generatedId);
            setTicketSubject("");
            setTicketDescription("");
        }, 1200);
    };

    const allFAQs = [
        {
            question: "How is the auto-assignment score calculated?",
            answer: "The auto-allocation engine checks loan parameters (e.g. quantum exceeding ₹15L, abroad STEM, or property-backed cases) and assigns to designated specialist roles to expedite processing."
        },
        {
            question: "What is the SLA response timeline for queries?",
            answer: "Queries raised by auditors default to a 48-hour resolution window. Using the 'Hold Application' toggle freezes the SLA countdown and displays a Hold status block."
        },
        {
            question: "How do we reverse processing fee waivers?",
            answer: "If a waiver is configured in the Underwriting Decisions screen, checking the waiver select dropdown triggers recalculation. Support tickets can manually trigger ledger adjustments."
        },
        {
            question: "Can tags be filtered globally across folders?",
            answer: "Yes, once custom metadata tags are configured, you can type or select them inside the Global Search popover in the top header layout."
        }
    ];

    const filteredFAQs = allFAQs.filter(faq => 
        faq.question.toLowerCase().includes(faqSearch.toLowerCase()) ||
        faq.answer.toLowerCase().includes(faqSearch.toLowerCase())
    );

    if (!mounted || !user) return null;

    // Sub-components layout tabs
    const renderPreferencesTab = () => (
        <div className="space-y-6">
            {/* System Preferences Form */}
            <form onSubmit={handleSave} className="glass-card bg-white/80 backdrop-blur-md border border-purple-50 p-6 rounded-3xl space-y-6 shadow-lg shadow-purple-900/[0.01]">
                <div className="flex items-center justify-between border-b border-purple-50/50 pb-4">
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-600">settings_suggest</span>
                        Audit System Preferences
                    </h3>
                </div>

                {/* Toggles */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center py-1">
                        <div>
                            <h4 className="text-xs font-black text-gray-800 uppercase tracking-wide">Email Transmissions</h4>
                            <p className="text-[9px] text-gray-400 mt-0.5">Send a digest of incoming application files daily.</p>
                        </div>
                        <button 
                            type="button"
                            onClick={() => setEmailAlerts(!emailAlerts)}
                            className={`w-10 h-6 rounded-full transition-all relative ${emailAlerts ? 'bg-[#6605c7]' : 'bg-gray-200'}`}
                        >
                            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${emailAlerts ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className="flex justify-between items-center py-1">
                        <div>
                            <h4 className="text-xs font-black text-gray-800 uppercase tracking-wide">SMS Security Alerts</h4>
                            <p className="text-[9px] text-gray-400 mt-0.5">Alert mobile phone when critical priority file is logged.</p>
                        </div>
                        <button 
                            type="button"
                            onClick={() => setSmsAlerts(!smsAlerts)}
                            className={`w-10 h-6 rounded-full transition-all relative ${smsAlerts ? 'bg-[#6605c7]' : 'bg-gray-200'}`}
                        >
                            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${smsAlerts ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    <div className="flex justify-between items-center py-1">
                        <div>
                            <h4 className="text-xs font-black text-gray-800 uppercase tracking-wide">Auto-Allocation Algorithm</h4>
                            <p className="text-[9px] text-gray-400 mt-0.5">Distribute incoming files to active credit officers automatically.</p>
                        </div>
                        <button 
                            type="button"
                            onClick={() => setAutoAssign(!autoAssign)}
                            className={`w-10 h-6 rounded-full transition-all relative ${autoAssign ? 'bg-[#6605c7]' : 'bg-gray-200'}`}
                        >
                            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all ${autoAssign ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>
                </div>

                {/* Select fields */}
                <div className="grid grid-cols-1 md:w-1/2 gap-4 border-t border-purple-50/50 pt-6">
                    <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">SLA Escalation Threshold</label>
                        <select 
                            value={slaThreshold}
                            onChange={(e) => setSlaThreshold(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                        >
                            <option value="24">24 Hours (Aggressive)</option>
                            <option value="48">48 Hours (Standard)</option>
                            <option value="72">72 Hours (Relaxed)</option>
                        </select>
                    </div>
                </div>

                <div className="flex justify-between items-center border-t border-purple-50/50 pt-6">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        {saveStatus === "success" && (
                            <span className="text-emerald-600 flex items-center gap-1 font-black">
                                <span className="material-symbols-outlined text-sm">check_circle</span>
                                Preferences saved
                            </span>
                        )}
                    </span>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-5 py-2.5 bg-[#6605c7] hover:bg-[#8b24e5] text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm font-black">save</span>
                        {saving ? "Saving..." : "Save Preferences"}
                    </button>
                </div>
            </form>

            {/* F38: Scheduled Reports Scheduler */}
            <form onSubmit={handleSaveReports} className="glass-card bg-white/80 backdrop-blur-md border border-purple-50 p-6 rounded-3xl space-y-6 shadow-lg shadow-purple-900/[0.01]">
                <div className="border-b border-purple-50/50 pb-4">
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-600">mail_lock</span>
                        Scheduled Email Reports
                    </h3>
                    <p className="text-[9px] text-gray-400 mt-0.5">Automate system analytical report dispatches to banking risk heads.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Dispatch Frequency</label>
                        <select 
                            value={reportFrequency}
                            onChange={(e) => setReportFrequency(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                        >
                            <option value="daily">Daily Summary (Every morning)</option>
                            <option value="weekly">Weekly Deep-Dive (Friday evening)</option>
                            <option value="monthly">Monthly Audit Compilation (End of month)</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Dispatch Time</label>
                        <input 
                            type="time"
                            value={reportDispatchHour}
                            onChange={(e) => setReportDispatchHour(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Email Recipients (comma separated)</label>
                    <input 
                        type="text"
                        value={reportRecipients}
                        onChange={(e) => setReportRecipients(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#6605c7] text-gray-700"
                        placeholder="recipient@sbi.co.in"
                    />
                </div>

                <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Report Attachments</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 font-bold">
                            <input 
                                type="checkbox"
                                checked={reportFormat.csv}
                                onChange={(e) => setReportFormat({...reportFormat, csv: e.target.checked})}
                                className="accent-[#6605c7]"
                            />
                            Excel CSV Format
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 font-bold">
                            <input 
                                type="checkbox"
                                checked={reportFormat.pdf}
                                onChange={(e) => setReportFormat({...reportFormat, pdf: e.target.checked})}
                                className="accent-[#6605c7]"
                            />
                            PDF Analytics Dossier
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 font-bold">
                            <input 
                                type="checkbox"
                                checked={reportFormat.xlsx}
                                onChange={(e) => setReportFormat({...reportFormat, xlsx: e.target.checked})}
                                className="accent-[#6605c7]"
                            />
                            XLSX Spreadsheet
                        </label>
                    </div>
                </div>

                <div className="flex justify-between items-center border-t border-purple-50/50 pt-6">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        {reportSaveStatus && (
                            <span className="text-emerald-600 flex items-center gap-1 font-black">
                                <span className="material-symbols-outlined text-sm">schedule_send</span>
                                Next run: Tomorrow at {reportDispatchHour}
                            </span>
                        )}
                    </span>
                    <button
                        type="submit"
                        disabled={savingReports}
                        className="px-5 py-2.5 bg-[#6605c7] hover:bg-[#8b24e5] text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm font-black">schedule</span>
                        {savingReports ? "Updating Schedule..." : "Set Dispatch Schedule"}
                    </button>
                </div>
            </form>

            {/* F41: Auto-Assignment Rule Builder */}
            <div className="glass-card bg-white/80 backdrop-blur-md border border-purple-50 p-6 rounded-3xl space-y-6 shadow-lg shadow-purple-900/[0.01]">
                <div className="border-b border-purple-50/50 pb-4">
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-600">split_decision</span>
                        Auto-Assignment Routing Rules
                    </h3>
                    <p className="text-[9px] text-gray-400 mt-0.5">Route applications dynamically based on loan amount, course, or collateral criteria.</p>
                </div>

                {/* Rules List */}
                <div className="space-y-2">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Active Assignment Logic</span>
                    {assignmentRules.length === 0 ? (
                        <div className="text-center py-6 border border-dashed border-gray-200 rounded-2xl text-xs text-gray-400">
                            No active assignment rules. All applications will fall back to manual allocation.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {assignmentRules.map((rule) => (
                                <div key={rule.id} className="flex items-center justify-between p-3 bg-[#6605c7]/[0.02] border border-[#6605c7]/10 rounded-xl">
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="px-2 py-0.5 bg-white text-purple-700 border border-purple-100 rounded-lg text-[9px] font-black uppercase tracking-wider">
                                            RULE #{rule.id}
                                        </span>
                                        <span className="text-gray-700 font-medium">
                                            If <strong className="text-purple-950 font-black">{getCriteriaLabel(rule.conditionType)}</strong> {getOperatorLabel(rule.operator)} <strong className="text-purple-950 font-black">{rule.value}</strong>
                                        </span>
                                        <span className="material-symbols-outlined text-[14px] text-gray-400">arrow_right_alt</span>
                                        <span className="text-gray-600">
                                            Assign to <strong className="text-purple-950 font-black">{rule.targetOfficer}</strong>
                                        </span>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => handleDeleteRule(rule.id)}
                                        className="text-gray-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded-lg transition-all"
                                        title="Delete Rule"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Add Rule Form */}
                <div className="border-t border-purple-50/50 pt-6 space-y-4">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Configure New Routing Logic</span>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Criteria</label>
                            <select 
                                value={newRuleCondition}
                                onChange={(e) => setNewRuleCondition(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                            >
                                <option value="amount">Loan Amount (INR)</option>
                                <option value="course">Course Category</option>
                                <option value="collateral">Collateral Provided</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Operator</label>
                            <select 
                                value={newRuleOperator}
                                onChange={(e) => setNewRuleOperator(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                            >
                                {newRuleCondition === "amount" ? (
                                    <>
                                        <option value="gt">Greater Than (&gt;)</option>
                                        <option value="lt">Less Than (&lt;)</option>
                                    </>
                                ) : (
                                    <option value="eq">Equals (=)</option>
                                )}
                            </select>
                        </div>

                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Trigger Value</label>
                            {newRuleCondition === "amount" ? (
                                <input 
                                    type="number"
                                    value={newRuleValue}
                                    onChange={(e) => setNewRuleValue(e.target.value)}
                                    placeholder="e.g. 1500000"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                />
                            ) : newRuleCondition === "course" ? (
                                <select
                                    value={newRuleValue}
                                    onChange={(e) => setNewRuleValue(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                >
                                    <option value="">Select Option</option>
                                    <option value="STEM Study Abroad">STEM Study Abroad</option>
                                    <option value="Domestic MBA">Domestic MBA</option>
                                    <option value="Medical Program">Medical Program</option>
                                </select>
                            ) : (
                                <select
                                    value={newRuleValue}
                                    onChange={(e) => setNewRuleValue(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                >
                                    <option value="">Select Option</option>
                                    <option value="Property Deed">Property Deed</option>
                                    <option value="FD Receipt">FD Receipt</option>
                                    <option value="Govt Bond">Govt Bond</option>
                                </select>
                            )}
                        </div>

                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Assign To Officer</label>
                            <select 
                                value={newRuleOfficer}
                                onChange={(e) => setNewRuleOfficer(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                            >
                                <option value="Sarah Jenkins">Sarah Jenkins (Senior)</option>
                                <option value="Vijay Kumar">Vijay Kumar (Abroad)</option>
                                <option value="Rahul Verma">Rahul Verma (Collateral)</option>
                                <option value="Priya Sharma">Priya Sharma (Auditor)</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={handleAddRule}
                            className="px-5 py-2.5 bg-gradient-to-r from-[#6605c7] to-[#8b24e5] hover:opacity-95 text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm font-black">add_circle</span>
                            Add Assignment Rule
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderTagsTab = () => (
        <div className="space-y-6">
            {/* F43: Folder Tagging Manager */}
            <div className="glass-card bg-white/80 backdrop-blur-md border border-purple-50 p-6 rounded-3xl space-y-6 shadow-lg shadow-purple-900/[0.01]">
                <div className="border-b border-purple-50/50 pb-4">
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-600">bookmarks</span>
                        Custom Folder Tag Library
                    </h3>
                    <p className="text-[9px] text-gray-400 mt-0.5">Define custom metadata tags to organize, highlight, and filter files across workspace folders.</p>
                </div>

                {/* Display Current Tags list */}
                <div className="space-y-3">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Active Metadata Tags</span>
                    <div className="flex flex-wrap gap-3">
                        {tags.map((tag) => (
                            <div 
                                key={tag.name} 
                                className="flex items-center gap-2 px-3 py-1.5 border rounded-2xl transition-all duration-300"
                                style={{ 
                                    backgroundColor: tag.bg, 
                                    color: tag.text,
                                    borderColor: tag.color + "30"
                                }}
                            >
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                                <span className="text-xs font-black uppercase tracking-wider">{tag.name}</span>
                                <span className="px-1.5 py-0.5 bg-white/50 border border-white text-[9px] font-bold rounded-lg leading-none">
                                    {tag.count} files
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteTag(tag.name)}
                                    className="p-0.5 hover:bg-white/60 rounded-md transition-all flex items-center"
                                    title="Delete Tag"
                                >
                                    <span className="material-symbols-outlined text-[12px]">close</span>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Create Tag Form */}
                <div className="border-t border-purple-50/50 pt-6 space-y-4">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">Create Custom Folder Tag</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Tag Label</label>
                            <input 
                                type="text"
                                value={newTagName}
                                onChange={(e) => setNewTagName(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                                placeholder="e.g. HNW Student, Priority SLA"
                            />
                        </div>

                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Preset Accent Color</label>
                            <div className="flex gap-2.5 items-center h-[34px]">
                                {[
                                    { hex: "#6605c7", name: "Purple" },
                                    { hex: "#ef4444", name: "Red" },
                                    { hex: "#22c55e", name: "Green" },
                                    { hex: "#3b82f6", name: "Blue" },
                                    { hex: "#eab308", name: "Gold" },
                                    { hex: "#f97316", name: "Orange" }
                                ].map((c) => (
                                    <button
                                        key={c.hex}
                                        type="button"
                                        onClick={() => setNewTagColor(c.hex)}
                                        className={`w-6 h-6 rounded-full border transition-all relative ${
                                            newTagColor === c.hex ? "scale-110 border-gray-900 shadow-md" : "border-transparent hover:scale-105"
                                        }`}
                                        style={{ backgroundColor: c.hex }}
                                        title={c.name}
                                    >
                                        {newTagColor === c.hex && (
                                            <span className="absolute inset-0 flex items-center justify-center text-white material-symbols-outlined text-[12px] font-black">
                                                check
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={handleAddTag}
                            className="px-5 py-2.5 bg-[#6605c7] hover:bg-[#8b24e5] text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm font-black">add_circle</span>
                            Add Tag to Library
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderSupportTab = () => (
        <div className="space-y-6">
            <div className="glass-card bg-white/90 border border-purple-50 p-6 rounded-3xl shadow-sm">
                <UserSupportTicketsView
                    userRole="bank"
                    userInfo={{
                        id: user?.id,
                        name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email,
                        email: user?.email,
                    }}
                />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* F45: Relationship Manager Contact Card */}
                <div className="glass-card bg-white/80 backdrop-blur-md border border-purple-50 p-6 rounded-3xl space-y-6 shadow-lg shadow-purple-900/[0.01] flex flex-col justify-between">
                    <div>
                        <div className="border-b border-purple-50/50 pb-4">
                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-purple-600">contact_mail</span>
                                Dedicated Support RM
                            </h3>
                            <p className="text-[9px] text-gray-400 mt-0.5">Direct contact card for your designated VidyaLoans manager.</p>
                        </div>

                        <div className="flex items-center gap-4 mt-6">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white flex items-center justify-center text-xl font-black shadow-md shadow-purple-500/25 shrink-0">
                                SK
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-gray-900 uppercase tracking-wide">Sneha Kapoor</h4>
                                <p className="text-[9px] text-[#6605c7] font-black uppercase tracking-widest mt-0.5">VidyaLoans Relationship Manager</p>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[8px] font-black uppercase tracking-widest mt-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Online & Available
                                </span>
                            </div>
                        </div>

                        <div className="border-t border-purple-50/50 mt-6 pt-6 space-y-2 text-xs">
                            <div className="flex items-center justify-between text-gray-600">
                                <span className="font-bold">Direct Email:</span>
                                <span className="text-[#6605c7] font-black">sneha.k@vidyaloans.com</span>
                            </div>
                            <div className="flex items-center justify-between text-gray-600">
                                <span className="font-bold">Direct Phone:</span>
                                <span className="font-bold text-gray-800">+91 99882 23344</span>
                            </div>
                            <div className="flex items-center justify-between text-gray-600">
                                <span className="font-bold">Avg. Query SLA:</span>
                                <span className="font-bold text-emerald-600">12.5 Minutes</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4">
                        <Link 
                            href="/bank/chat"
                            className="w-full py-2.5 bg-[#6605c7]/5 hover:bg-[#6605c7]/10 text-[#6605c7] border border-[#6605c7]/20 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm font-black">forum</span>
                            Open Direct Chat Stream
                        </Link>
                    </div>
                </div>

                {/* F46: Student NPS Ratings */}
                <div className="glass-card bg-white/80 backdrop-blur-md border border-purple-50 p-6 rounded-3xl space-y-6 shadow-lg shadow-purple-900/[0.01]">
                    <div>
                        <div className="border-b border-purple-50/50 pb-4">
                            <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                <span className="material-symbols-outlined text-purple-600">analytics</span>
                                Student NPS Rating
                            </h3>
                            <p className="text-[9px] text-gray-400 mt-0.5">Satisfaction score metrics representing student onboarding feedback.</p>
                        </div>

                        {/* NPS Circle Score & Stars */}
                        <div className="flex justify-between items-center mt-6">
                            <div className="text-center bg-[#6605c7]/[0.03] border border-purple-100/40 p-4 rounded-2xl w-1/2">
                                <span className="text-3xl font-black text-[#6605c7] tracking-tighter">+74</span>
                                <span className="text-[9px] font-black text-purple-700 block uppercase tracking-wider mt-1">Excellent NPS</span>
                            </div>
                            <div className="w-1/2 pl-6 space-y-1">
                                <div className="flex items-center gap-1 text-amber-500">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                        <span key={s} className="material-symbols-outlined text-sm">star</span>
                                    ))}
                                </div>
                                <span className="text-xs font-black text-gray-800 block">4.7 / 5.0 Rating</span>
                                <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wider">Based on 1,280 reviews</span>
                            </div>
                        </div>

                        {/* Bar Distribution */}
                        <div className="space-y-1.5 mt-6 border-t border-purple-50/50 pt-4">
                            <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block mb-2">Score Distribution</span>
                            {[
                                { stars: 5, pct: 76, color: "bg-[#6605c7]" },
                                { stars: 4, pct: 15, color: "bg-purple-400" },
                                { stars: 3, pct: 6, color: "bg-amber-400" },
                                { stars: 2, pct: 2, color: "bg-orange-400" },
                                { stars: 1, pct: 1, color: "bg-rose-400" },
                            ].map((bar) => (
                                <div key={bar.stars} className="flex items-center gap-2 text-[10px]">
                                    <span className="w-8 font-black text-gray-500">{bar.stars} Star</span>
                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div className={`h-full ${bar.color}`} style={{ width: `${bar.pct}%` }} />
                                    </div>
                                    <span className="w-6 font-bold text-gray-700 text-right">{bar.pct}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* F24: Partnership Feedback Form */}
            <form onSubmit={handleFeedbackSubmit} className="glass-card bg-white/80 backdrop-blur-md border border-purple-50 p-6 rounded-3xl space-y-6 shadow-lg shadow-purple-900/[0.01]">
                <div className="border-b border-purple-50/50 pb-4">
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-600">rate_review</span>
                        VidyaLoans Portal Integration Feedback
                    </h3>
                    <p className="text-[9px] text-gray-400 mt-0.5">Rate the digital integration performance and request support optimizations.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Integration Star Rating</label>
                        <div className="flex gap-1.5 text-amber-500">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setFeedbackRating(s)}
                                    className="focus:outline-none transform hover:scale-110 transition-transform"
                                >
                                    <span className="material-symbols-outlined text-2xl font-black">
                                        {feedbackRating >= s ? "star" : "star_border"}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Optimization Module Needed</label>
                        <select 
                            value={feedbackService}
                            onChange={(e) => setFeedbackService(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                        >
                            <option value="API Synch Speed">API Synchronization Speed</option>
                            <option value="Document Vault Retrieval">Document Vault Retrieval speed</option>
                            <option value="Query SLA Resolution">Query SLA Resolution times</option>
                            <option value="RM Communication">RM Communication latency</option>
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Provide Collaboration Suggestions</label>
                    <textarea 
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#6605c7] text-gray-700 h-20"
                        placeholder="Detail how we can improve our joint processing efficiency..."
                    />
                </div>

                <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Recommend VidyaLoans platform to other credit units?</label>
                    <div className="flex gap-4">
                        {["Yes", "Neutral", "No"].map((opt) => (
                            <label key={opt} className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 font-bold">
                                <input 
                                    type="radio"
                                    name="recommend"
                                    value={opt}
                                    checked={feedbackRecommend === opt}
                                    onChange={(e) => setFeedbackRecommend(e.target.value)}
                                    className="accent-[#6605c7]"
                                />
                                {opt}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-center border-t border-purple-50/50 pt-6">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                        {feedbackSubmitted && (
                            <span className="text-emerald-600 flex items-center gap-1 font-black">
                                <span className="material-symbols-outlined text-sm">verified_user</span>
                                Feedback Submitted (Ref ID: #FDB-9021)
                            </span>
                        )}
                    </span>
                    <button
                        type="submit"
                        disabled={feedbackSubmitting}
                        className="px-5 py-2.5 bg-[#6605c7] hover:bg-[#8b24e5] text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm font-black">send</span>
                        {feedbackSubmitting ? "Submitting..." : "Submit Integration Review"}
                    </button>
                </div>
            </form>

            {/* F25: Support Help Center ticket wizard */}
            <div className="glass-card bg-white/80 backdrop-blur-md border border-purple-50 p-6 rounded-3xl space-y-6 shadow-lg shadow-purple-900/[0.01]">
                <div className="border-b border-purple-50/50 pb-4">
                    <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                        <span className="material-symbols-outlined text-purple-600">help_center</span>
                        Help Center & SLA Ticket Wizard
                    </h3>
                    <p className="text-[9px] text-gray-400 mt-0.5">Search integration FAQs or raise technical escalation tickets to VidyaLoans engineering support.</p>
                </div>

                {/* FAQ Search Accordion */}
                <div className="space-y-4">
                    <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <span className="material-symbols-outlined text-sm">search</span>
                        </span>
                        <input
                            type="text"
                            value={faqSearch}
                            onChange={(e) => setFaqSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#6605c7] text-gray-700"
                            placeholder="Search support FAQs (e.g. Assignment, SLA, Hold)..."
                        />
                    </div>

                    <div className="space-y-2">
                        {filteredFAQs.map((faq, idx) => (
                            <FAQItem key={idx} question={faq.question} answer={faq.answer} />
                        ))}
                        {filteredFAQs.length === 0 && (
                            <p className="text-xs text-gray-400 text-center py-4">No matching FAQ found. Use the ticket wizard below to contact us.</p>
                        )}
                    </div>
                </div>

                {/* Raise Ticket Form */}
                <form onSubmit={handleTicketSubmit} className="border-t border-purple-50/50 pt-6 space-y-4">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">File SLA Escalation Ticket</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Subject</label>
                            <input 
                                type="text"
                                value={ticketSubject}
                                onChange={(e) => setTicketSubject(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#6605c7] text-gray-700"
                                placeholder="Brief summary of the issue..."
                                required
                            />
                        </div>

                        <div>
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Severity Category</label>
                            <select 
                                value={ticketPriority}
                                onChange={(e) => setTicketPriority(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#6605c7] text-gray-700"
                            >
                                <option value="Low">Low - System Question</option>
                                <option value="Medium">Medium - Optimization request</option>
                                <option value="High">High - Application delay SLA</option>
                                <option value="Urgent">Urgent - Integration breakdown</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Issue Description</label>
                        <textarea 
                            value={ticketDescription}
                            onChange={(e) => setTicketDescription(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-[#6605c7] text-gray-700 h-20"
                            placeholder="Detail the technical issue or SLA mismatch..."
                            required
                        />
                    </div>

                    <div className="flex justify-between items-center border-t border-purple-50/50 pt-6">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            {ticketSubmitted && (
                                <span className="text-emerald-600 flex items-center gap-1 font-black">
                                    <span className="material-symbols-outlined text-sm">support_agent</span>
                                    Ticket created: {ticketId} (Pending RM Review)
                                </span>
                            )}
                        </span>
                        <button
                            type="submit"
                            disabled={ticketSubmitting}
                            className="px-5 py-2.5 bg-[#6605c7] hover:bg-[#8b24e5] text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm font-black">support</span>
                            {ticketSubmitting ? "Generating..." : "Generate Support Ticket"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return (
        <div className="w-full space-y-8 relative z-10">
            {/* Page Header */}
            <PageHeader 
                title="Settings & Profile" 
                description="Manage your credit auditor account settings, configure automated task rules, and adjust notification preferences."
                moduleName="Settings & Profile"
                icon="settings"
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column Profile & Stats */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Profile Card */}
                    <div className="glass-card bg-white/80 backdrop-blur-md border border-purple-50 p-6 rounded-3xl text-center relative overflow-hidden shadow-lg shadow-purple-900/[0.01]">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-purple-600 to-indigo-600" />
                        
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#6605c7] to-[#8b24e5] text-white flex items-center justify-center text-2xl font-black mx-auto shadow-md shadow-purple-500/25 mb-4">
                            {user.firstName?.[0]}{user.lastName?.[0]}
                        </div>
                        
                        <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">
                            {user.firstName} {user.lastName}
                        </h3>
                        <p className="text-[9px] font-black text-[#6605c7] uppercase tracking-widest mt-1">
                            Bank Auditor Node
                        </p>
                        
                        <div className="border-t border-purple-50/50 mt-6 pt-6 text-left space-y-3">
                            <div>
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Email Address</span>
                                <span className="text-xs font-semibold text-gray-700 block truncate">{user.email}</span>
                            </div>
                            <div>
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Linked Institution</span>
                                <span className="text-xs font-bold text-gray-700 block">State Bank of India</span>
                            </div>
                            <div>
                                <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Security Protocol</span>
                                <span className="text-xs font-black text-emerald-600 flex items-center gap-1 mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    Active 2FA OTP
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Stats Widget */}
                    <div className="glass-card bg-white/80 backdrop-blur-md border border-purple-50 p-6 rounded-3xl relative overflow-hidden shadow-lg shadow-purple-900/[0.01] space-y-4">
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-purple-50/50 pb-2">
                            Auditor Stats
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs font-black text-[#6605c7] block">—</span>
                                <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wide">SLA Met</span>
                            </div>
                            <div>
                                <span className="text-xs font-black text-[#6605c7] block">—</span>
                                <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wide">Files Audited</span>
                            </div>
                            <div>
                                <span className="text-xs font-black text-[#6605c7] block">—</span>
                                <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wide">Avg Turnaround</span>
                            </div>
                            <div>
                                <span className="text-xs font-black text-emerald-600 block">Active</span>
                                <span className="text-[9px] text-gray-400 font-bold block uppercase tracking-wide">Status</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column containing the tabs */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Tabs Header */}
                    <div className="flex border-b border-purple-100/50 overflow-x-auto no-scrollbar gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab("preferences")}
                            className={`pb-4 px-4 text-[10px] font-black uppercase tracking-wider relative transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                activeTab === "preferences" ? "text-[#6605c7]" : "text-gray-400 hover:text-gray-600"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">tune</span>
                            Preferences & Routing
                            {activeTab === "preferences" && (
                                <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#6605c7]" />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("tags")}
                            className={`pb-4 px-4 text-[10px] font-black uppercase tracking-wider relative transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                activeTab === "tags" ? "text-[#6605c7]" : "text-gray-400 hover:text-gray-600"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">label</span>
                            Metadata & Tags
                            {activeTab === "tags" && (
                                <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#6605c7]" />
                            )}
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("support")}
                            className={`pb-4 px-4 text-[10px] font-black uppercase tracking-wider relative transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                activeTab === "support" ? "text-[#6605c7]" : "text-gray-400 hover:text-gray-600"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">chat_bubble</span>
                            Partnership & Support
                            {activeTab === "support" && (
                                <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#6605c7]" />
                            )}
                        </button>
                    </div>

                    {/* Tab Panels */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-6"
                        >
                            {activeTab === "preferences" && renderPreferencesTab()}
                            {activeTab === "tags" && renderTagsTab()}
                            {activeTab === "support" && renderSupportTab()}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border border-purple-100/50 rounded-2xl overflow-hidden bg-purple-50/10">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full px-4 py-3 flex justify-between items-center text-left hover:bg-purple-50/30 transition-all focus:outline-none"
            >
                <span className="text-xs font-black uppercase tracking-wide text-gray-800">{question}</span>
                <span className="material-symbols-outlined text-gray-400 transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }}>
                    expand_more
                </span>
            </button>
            {open && (
                <div className="px-4 pb-3 text-xs text-gray-600 leading-relaxed border-t border-purple-50/30 pt-2 font-medium">
                    {answer}
                </div>
            )}
        </div>
    );
}
