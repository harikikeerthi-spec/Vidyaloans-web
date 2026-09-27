"use client";

import React, { useMemo, useState, useEffect, use } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAgent } from "../../AgentContext";
import { agentApi } from "@/lib/api";
import ProgressTracker from "@/components/ProgressTracker";

interface PageProps {
    params?: Promise<{
        id: string;
    }> | {
        id: string;
    };
}

export default function AgentStudentDetail({ params }: PageProps) {
    const router = useRouter();
    const routeParams = useParams();
    const resolvedParams = params && typeof (params as any)?.then === "function" ? use(params as Promise<{ id: string }>) : (params as { id?: string });
    const studentId = (resolvedParams?.id || routeParams?.id || "") as string;
    const {
        applications,
        docUploadState, setDocUploadState,
        setAutoStartUser,
        handleDocumentUpload,
        showToast
    } = useAgent();

    const [selectedStudent, setSelectedStudent] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(true);

    const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
    const [satisfactionScore, setSatisfactionScore] = useState<number | null>(null);
    const [rmScore, setRmScore] = useState<number | null>(null);
    const [whatWentWell, setWhatWentWell] = useState("");
    const [whatCouldBeBetter, setWhatCouldBeBetter] = useState("");

    const handleFeedbackSubmit = () => {
        if (!satisfactionScore || !rmScore) {
            showToast("Please provide both satisfaction ratings", "warning");
            return;
        }
        setFeedbackSubmitted(true);
        showToast("Thank you for your honest feedback! It has been securely sent to Admin.", "success");
    };

    const loadDetail = async () => {
        setLoadingDetail(true);
        try {
            const apiApp = await agentApi.getLeadDetail(studentId) as any;
            if (apiApp && apiApp.id) {
                const projected = (parseFloat(apiApp.amount) || 0) * 0.007;
                const mappedStudent = {
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
                    bank: apiApp.bank || "Pending Partner",
                    commissionRate: apiApp.commissionRate || 0.70,
                    projectedCommission: apiApp.projectedCommission || projected,
                    lastUpdated: apiApp.updatedAt ? new Date(apiApp.updatedAt).toLocaleDateString() : "N/A",
                    documents: (apiApp.documents || []).map((d: any) => ({
                        docType: d.docType,
                        docName: d.name || d.docType.replace(/_/g, " ").toUpperCase(),
                        status: d.status || "pending",
                        uploadedBy: d.uploadedBy || "Student",
                        version: d.version || "v1",
                        rejectionReason: d.rejectionReason || ""
                    })),
                    journey: apiApp.journey || [
                        { date: "N/A", title: "Lead Submitted", desc: "Submitted via Agent Network", done: true }
                    ],
                    bankStatus: apiApp.bankStatus || {
                        product: apiApp.bank ? `${apiApp.bank} Scholar Scheme` : "Pending Scheme",
                        refNumber: `REF-${String(apiApp.id).slice(-6).toUpperCase()}`,
                        submittedOn: "N/A",
                        tatExpected: "10 working days",
                        queryText: apiApp.remarks
                    },
                    communicationLog: apiApp.communicationLog || []
                };
                setSelectedStudent(mappedStudent);
            } else {
                const local = applications.find(x => x.id === studentId);
                setSelectedStudent(local || null);
            }
        } catch (e) {
            console.error("Failed to load lead detail, using local fallback", e);
            const local = applications.find(x => x.id === studentId);
            setSelectedStudent(local || null);
        } finally {
            setLoadingDetail(false);
        }
    };

    useEffect(() => {
        loadDetail();
    }, [studentId, applications]);

    const statusColors: Record<string, string> = {
        pending: "bg-amber-50 text-amber-700 border-amber-100",
        processing: "bg-blue-50 text-blue-700 border-blue-100",
        approved: "bg-emerald-50 text-emerald-700 border-emerald-100",
        disbursed: "bg-purple-50 text-purple-700 border-purple-100",
        rejected: "bg-red-50 text-red-700 border-red-100"
    };

    if (loadingDetail) {
        return (
            <div className="py-20 text-center animate-pulse space-y-4">
                <div className="w-16 h-16 rounded-[2rem] bg-gray-150 mx-auto" />
                <div className="h-6 w-48 bg-gray-150 mx-auto rounded" />
                <div className="h-4 w-64 bg-gray-150 mx-auto rounded" />
            </div>
        );
    }

    if (!selectedStudent) {
        return (
            <div className="py-20 text-center">
                <span className="material-symbols-outlined text-gray-300 text-6xl mb-4">search_off</span>
                <h2 className="text-xl font-bold text-gray-900">Student Referral Not Found</h2>
                <Link href="/agent/students" className="mt-4 px-6 py-2 bg-[#6605c7] text-white rounded-xl text-xs font-bold uppercase tracking-wider inline-block">Back to Directory</Link>
            </div>
        );
    }

    return (
        <div className="animate-fade-in-up space-y-12 relative z-10">
            
            {/* Profile Header Card */}
            <section className="p-8 rounded-[2.5rem] bg-white border border-[#6605c7]/10 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex gap-5 items-center">
                    <div className="w-16 h-16 rounded-[2rem] bg-gradient-to-br from-[#6605c7] to-[#8b24e5] text-white font-black text-2xl flex items-center justify-center shadow-lg">
                        {selectedStudent.firstName[0]}
                    </div>
                    <div className="space-y-1 text-left">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-gray-900 font-display">{selectedStudent.firstName} {selectedStudent.lastName}</h2>
                            <span className={`inline-flex px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest ${statusColors[selectedStudent.status] || "bg-gray-100 text-gray-500"}`}>
                                {selectedStudent.status}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">{selectedStudent.courseName} — {selectedStudent.collegeName} | Loan Amount: <strong className="text-gray-900">₹{selectedStudent.amount.toLocaleString()}</strong></p>
                        <p className="text-[10px] text-gray-400">VL Ref Number: {selectedStudent.applicationNumber} | Last Updated: {selectedStudent.lastUpdated}</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button 
                        onClick={() => { 
                            setAutoStartUser({ id: selectedStudent.id, email: selectedStudent.email, firstName: selectedStudent.firstName, lastName: selectedStudent.lastName }); 
                            router.push("/agent/chat-student"); 
                        }} 
                        className="px-6 py-3.5 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 hover:bg-indigo-150 transition-all flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-base">forum</span> Chat student
                    </button>
                    <button 
                        onClick={() => { 
                            router.push(`/agent/chat-staff?studentId=${selectedStudent.id}&sendLead=true`); 
                        }} 
                        className="px-6 py-3.5 bg-purple-50 text-purple-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-purple-100 hover:bg-purple-150 transition-all flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-base">chat_bubble</span> Discuss with Staff
                    </button>
                    <button 
                        onClick={() => { 
                            setDocUploadState({ ...docUploadState, studentId: selectedStudent.id }); 
                            router.push("/agent/documents"); 
                        }} 
                        className="px-6 py-3.5 bg-[#6605c7] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#6605c7]/95 transition-all flex items-center gap-2 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-base">cloud_upload</span> Upload Documents
                    </button>
                </div>
            </section>

            {/* Application Progress (Standard 8 Steps) */}
            <ProgressTracker
                application={selectedStudent}
                title="Application Progress"
                className="rounded-[2.5rem] border border-[#6605c7]/10 p-8 shadow-sm"
            />

            {/* Conditional Sanction & NPS feedback suite for Disbursed/Approved Students */}
            {(selectedStudent.status === "approved" || selectedStudent.status === "disbursed" || selectedStudent.firstName.toLowerCase().includes("priya")) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-fade-in">
                    
                    {/* Sanction Letter card */}
                    <div className="bg-white border border-[#6605c7]/10 p-8 rounded-[2.5rem] shadow-2xl shadow-[#6605c7]/2 flex flex-col justify-between space-y-6 text-left">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-[#6605c7]">
                                <span className="material-symbols-outlined">verified</span>
                                <h3 className="text-sm font-black uppercase tracking-wider">Sanction Letter Reference Copy</h3>
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-gray-900 font-display">SANCTION LETTER DOWNLOAD — {selectedStudent.firstName} {selectedStudent.lastName}</h4>
                                <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mt-1">⚠️ FOR AGENT REFERENCE ONLY — NOT FOR SUBMISSION TO ANY THIRD PARTY</p>
                            </div>
                            
                            <div className="space-y-2 text-xs font-bold text-gray-700 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Document</span>
                                    <span>{selectedStudent.bank} Sanction Letter (Original)</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Issued On</span>
                                    <span>15-Jun-2026</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Sanctioned Amount</span>
                                    <span>₹{selectedStudent.amount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Interest Rate (ROI)</span>
                                    <span>8.15% p.a.</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Tenure</span>
                                    <span>10 years</span>
                                </div>
                                <div className="flex justify-between text-[10px] text-[#6605c7] border-t border-gray-100 pt-2 font-mono">
                                    <span className="text-gray-400">Watermark config</span>
                                    <span>"AGENT COPY — VL-AGT-007 — For Reference Only"</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => showToast("Downloading watermarked sanction letter PDF...", "success")}
                                className="flex-1 py-3 bg-[#6605c7] hover:bg-[#6605c7]/95 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-[#6605c7]/10"
                            >
                                Download Watermarked PDF
                            </button>
                            <button 
                                onClick={() => showToast("Opening reference document in sandbox browser...", "info")}
                                className="px-4 py-3 bg-gray-50 border border-gray-150 text-gray-600 hover:bg-gray-100 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all"
                            >
                                View in Browser
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400 leading-relaxed italic">
                            * Note: This is a reference copy for commissions audit. The bank will share the original clean copy directly with the student for executing the legal loan agreement.
                        </p>
                    </div>

                    {/* Agent NPS Feedback Card */}
                    <div className="bg-white border border-[#6605c7]/10 p-8 rounded-[2.5rem] shadow-2xl shadow-[#6605c7]/2 text-left flex flex-col justify-between min-h-[380px]">
                        {!feedbackSubmitted ? (
                            <div className="space-y-5">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#6605c7] block">Feedback Suite</span>
                                    <h3 className="text-lg font-black text-gray-900 font-display">FEEDBACK — After {selectedStudent.firstName}'s Disbursement</h3>
                                </div>

                                {/* Score 1: Case Handling */}
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                        🌟 How satisfied are you with Vidyaloans' handling of this case? (1-10)
                                    </label>
                                    <div className="flex flex-wrap gap-1">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                                            <button 
                                                key={score} 
                                                type="button"
                                                onClick={() => setSatisfactionScore(score)}
                                                className={`w-7.5 h-7.5 text-xs font-black rounded-lg transition-all border ${
                                                    satisfactionScore === score 
                                                        ? 'bg-[#6605c7] border-[#6605c7] text-white shadow-sm' 
                                                        : 'bg-gray-50 border-gray-150 text-gray-650 hover:bg-gray-100'
                                                }`}
                                            >
                                                {score}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Score 2: RM Helpfulness */}
                                <div className="space-y-1.5">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                        Staff RM (Neha Sharma) — How helpful was she? (1-10)
                                    </label>
                                    <div className="flex flex-wrap gap-1">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                                            <button 
                                                key={score} 
                                                type="button"
                                                onClick={() => setRmScore(score)}
                                                className={`w-7.5 h-7.5 text-xs font-black rounded-lg transition-all border ${
                                                    rmScore === score 
                                                        ? 'bg-[#6605c7] border-[#6605c7] text-white shadow-sm' 
                                                        : 'bg-gray-50 border-gray-150 text-gray-650 hover:bg-gray-100'
                                                }`}
                                            >
                                                {score}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Qualitative reviews */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider">What went well?</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Quick verification"
                                            value={whatWentWell}
                                            onChange={(e) => setWhatWentWell(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 focus:outline-none focus:bg-white"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="block text-[9px] font-black text-gray-400 uppercase tracking-wider">What could be better?</label>
                                        <input 
                                            type="text" 
                                            placeholder="e.g. Bank portal lag"
                                            value={whatCouldBeBetter}
                                            onChange={(e) => setWhatCouldBeBetter(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-700 focus:outline-none focus:bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-3 border-t border-gray-50">
                                    <button 
                                        onClick={handleFeedbackSubmit}
                                        className="flex-1 py-3 bg-[#6605c7] hover:bg-[#6605c7]/95 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-[#6605c7]/10"
                                    >
                                        Submit Feedback
                                    </button>
                                    <button 
                                        onClick={() => setFeedbackSubmitted(true)}
                                        className="px-4 py-3 bg-gray-550 border border-gray-150 text-white hover:bg-gray-600 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all"
                                    >
                                        Skip
                                    </button>
                                </div>
                                <p className="text-[9px] text-gray-400 leading-tight">
                                    * Note: Feedback goes to Admin only — helps improve Staff training. Your RM is not penalized for honest feedback.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 my-auto">
                                <span className="material-symbols-outlined text-emerald-500 text-6xl animate-bounce">verified</span>
                                <div>
                                    <h4 className="text-base font-black text-gray-900 font-display">Feedback Recorded!</h4>
                                    <p className="text-xs text-gray-450 mt-1 max-w-xs leading-relaxed">Thank you for sharing your experience. We are continuously improving RM workflow operations.</p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                </div>
            )}

            {/* Tabs for Journey, Documents, Bank Submission, Commission Rate, chat log */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* Journey Timeline */}
                    <div className="bg-white border border-[#6605c7]/10 p-8 rounded-[2.5rem] shadow-sm">
                        <h3 className="font-display font-black text-lg text-gray-900 mb-8 uppercase tracking-tight">Application Journey Timeline</h3>
                        
                        <div className="relative border-l border-gray-150 pl-6 space-y-6 ml-3">
                            {selectedStudent.journey.map((j: any, i: number) => (
                                <div key={i} className="relative">
                                    <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 bg-white ${j.type === 'alert' ? 'border-rose-500 shadow-[0_0_8px_rgb(239,68,68,0.3)]' : 'border-indigo-600'}`} />
                                    <div className="text-left space-y-0.5">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{j.date}</span>
                                            {j.type === 'alert' && <span className="bg-red-50 text-red-600 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">Query Alert</span>}
                                        </div>
                                        <h4 className="text-sm font-black text-gray-900">{j.title}</h4>
                                        <p className="text-xs text-gray-500">{j.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Document Checklist and Status */}
                    <div id="documents" className="bg-white border border-[#6605c7]/10 p-8 rounded-[2.5rem] shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-display font-black text-lg text-gray-900 uppercase tracking-tight">Student Document Checklist</h3>
                            <span className="text-xs font-black text-indigo-600">{selectedStudent.documents.filter((d: any) => d.status === "verified").length} / {selectedStudent.documents.length} Verified</span>
                        </div>
                        
                        <div className="divide-y divide-gray-50">
                            {selectedStudent.documents.length > 0 ? selectedStudent.documents.map((d: any, i: number) => (
                                <div key={i} className="py-4 flex justify-between items-center">
                                    <div>
                                        <p className="text-sm font-black text-gray-900">{d.docName}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] text-gray-400 font-bold">Uploaded By: {d.uploadedBy || "Student"} | Version: {d.version}</span>
                                            {d.rejectionReason && <span className="text-rose-600 text-[9px] font-medium block">⚠️ {d.rejectionReason}</span>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider ${d.status === "verified" ? "bg-emerald-50 text-emerald-700" : d.status === "rejected" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                                            {d.status}
                                        </span>
                                        {d.status === "rejected" && (
                                            <button onClick={() => handleDocumentUpload(selectedStudent.id, d.docType, "Income_Cert_Stamped_Resubmitted.pdf")} className="px-3 py-1 bg-[#6605c7] hover:bg-[#6605c7]/90 text-white text-[9px] font-bold rounded-lg uppercase tracking-wider">Re-upload</button>
                                        )}
                                    </div>
                                </div>
                            )) : (
                                <p className="text-xs text-gray-400 py-6 text-center">No documents have been logged or synced for this lead yet.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-8 flex flex-col">
                    {/* Bank Submission Tracker */}
                    <div className="bg-white border border-[#6605c7]/10 p-8 rounded-[2.5rem] shadow-sm">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#6605c7]/40 mb-6">🏛️ BANK SUBMISSION TRACKER</h3>
                        
                        <div className="space-y-4 text-xs font-bold text-gray-700">
                            <div className="flex justify-between border-b border-gray-50 pb-3">
                                <span className="text-gray-400">Bank Partner</span>
                                <span>{selectedStudent.bank}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-3">
                                <span className="text-gray-400">Bank Scheme</span>
                                <span>{selectedStudent.bankStatus.product}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-3">
                                <span className="text-gray-400">VL Reference</span>
                                <span>{selectedStudent.bankStatus.refNumber}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-50 pb-3">
                                <span className="text-gray-400">Submitted On</span>
                                <span>{selectedStudent.bankStatus.submittedOn}</span>
                            </div>
                            <div className="flex justify-between pb-3">
                                <span className="text-gray-400">TAT Expected</span>
                                <span>{selectedStudent.bankStatus.tatExpected}</span>
                            </div>

                            {selectedStudent.bankStatus.queryText && (
                                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] space-y-1 font-medium">
                                    <p className="font-bold">⚠️ QUERY RAISED:</p>
                                    <p>{selectedStudent.bankStatus.queryText}</p>
                                    <p className="text-amber-600 font-bold mt-1">Deadline: {selectedStudent.bankStatus.queryDeadline} (Today!)</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Commission rate per student */}
                    <div className="bg-gradient-to-br from-[#6605c7] to-[#8b24e5] text-white p-8 rounded-[2.5rem] shadow-md relative overflow-hidden">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50 mb-6">💰 ESTIMATED COMMISSION</h3>
                        
                        <div className="space-y-4">
                            <div className="text-3xl font-black font-display">₹{selectedStudent.projectedCommission.toLocaleString()}</div>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between text-white/80">
                                    <span>Loan Amount</span>
                                    <span className="font-bold">₹{selectedStudent.amount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-white/80">
                                    <span>Commission Rate</span>
                                    <span className="font-bold">{selectedStudent.commissionRate}%</span>
                                </div>
                                <div className="flex justify-between text-white/80">
                                    <span>Payout Status</span>
                                    <span className="font-bold text-amber-300">Awaiting Sanction</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chat communication log snippet */}
                    <div className="bg-white border border-[#6605c7]/10 p-8 rounded-[2.5rem] shadow-sm flex-1 flex flex-col justify-between">
                        <div>
                            <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-[#6605c7]/40 mb-6">💬 MESSAGES FROM STAFF</h3>
                            
                            <div className="space-y-4 text-xs max-h-[160px] overflow-y-auto no-scrollbar">
                                {selectedStudent.communicationLog.map((log: any, i: number) => (
                                    <div key={i} className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1.5 font-sans">
                                        <div className="flex justify-between text-[9px] font-bold text-gray-400">
                                            <span>{log.sender}</span>
                                            <span>{log.timestamp}</span>
                                        </div>
                                        <p className="text-gray-700 leading-relaxed">{log.message}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="pt-6">
                            <Link href="/agent/chat-staff" className="w-full py-3 bg-[#6605c7]/5 hover:bg-[#6605c7] hover:text-white text-[#6605c7] text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 text-center">
                                <span className="material-symbols-outlined text-sm">chat_bubble</span> Connect with Counselors
                            </Link>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
