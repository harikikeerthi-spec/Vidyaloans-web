"use client";

import { useUserDossier } from "../DossierContext";
import { useState, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { documentApi, staffProfileApi } from "@/lib/api";
import { getProfileDocumentRequirements, getDocumentRequirementName } from "@/lib/documentRequirements";

export const DOCUMENT_OPTIONS_GROUPED = [
    {
        group: "Parents Documents",
        options: [
            { value: "father_aadhar", label: "Father's Aadhaar Card" },
            { value: "father_pan", label: "Father's PAN Card" },
            { value: "mother_aadhar", label: "Mother's Aadhaar Card" },
            { value: "mother_pan", label: "Mother's PAN Card" },
            { value: "parent_aadhar", label: "Parent's Aadhaar Card" },
            { value: "parent_pan", label: "Parent's PAN Card" },
        ],
    },
    {
        group: "Co-Applicant Documents",
        options: [
            { value: "coapplicant_aadhar", label: "Co-Applicant's Aadhaar Card" },
            { value: "coapplicant_pan", label: "Co-Applicant's PAN Card" },
            { value: "coapplicant_income_proof", label: "Co-Applicant Income Proof (Salary Slips / Form 16)" },
            { value: "coapplicant_bank_statement", label: "Co-Applicant 6-Month Bank Statement" },
            { value: "coapplicant_itr", label: "Co-Applicant ITR (Income Tax Return)" },
        ],
    },
    {
        group: "Student Documents",
        options: [
            { value: "passport", label: "Passport (Front & Back)" },
            { value: "national_id", label: "National ID / Aadhaar Card" },
            { value: "pan", label: "PAN Card" },
            { value: "marksheet_10", label: "10th Marksheet" },
            { value: "marksheet_12", label: "12th / Diploma Marksheet" },
            { value: "degree_certificate", label: "Degree Certificate / CMM" },
            { value: "ug_transcript", label: "Undergraduate Transcript" },
            { value: "ug_degree", label: "Undergraduate Degree" },
            { value: "pg_transcript", label: "Postgraduate Transcript" },
            { value: "pg_degree", label: "Postgraduate Degree" },
            { value: "offer_letter", label: "Offer / Admission Letter" },
            { value: "visa", label: "Visa" },
            { value: "english_test", label: "IELTS / TOEFL / PTE Score Card" },
            { value: "aptitude_test", label: "GRE / GMAT / SAT Score Card" },
            { value: "lor", label: "Letter of Recommendation (LOR)" },
            { value: "sop", label: "Statement of Purpose (SOP)" },
        ],
    },
    {
        group: "Financial & Supporting Documents",
        options: [
            { value: "income_proof", label: "Income Proof" },
            { value: "bank_statement", label: "Bank Statement (6 Months)" },
            { value: "financial_statement", label: "Financial Statement" },
            { value: "loan_sanction", label: "Loan Sanction Letter" },
            { value: "collateral_docs", label: "Property / Collateral Documents" },
            { value: "insurance", label: "Insurance" },
            { value: "other", label: "Other Document (Specify Custom Name)" },
        ],
    },
];

const DOC_TYPE_LABELS: Record<string, string> = {
    // Parents
    father_aadhar: "Father's Aadhaar Card",
    father_pan: "Father's PAN Card",
    mother_aadhar: "Mother's Aadhaar Card",
    mother_pan: "Mother's PAN Card",
    parent_aadhar: "Parent's Aadhaar Card",
    parent_pan: "Parent's PAN Card",

    // Co-applicant
    coapplicant_aadhar: "Co-Applicant's Aadhaar Card",
    coapplicant_pan: "Co-Applicant's PAN Card",
    coapplicant_income_proof: "Co-Applicant Income Proof",
    coapplicant_bank_statement: "Co-Applicant 6-Month Bank Statement",
    coapplicant_itr: "Co-Applicant ITR",

    // Student
    passport: "Passport (Front & Back)",
    national_id: "National ID / Aadhaar Card",
    aadhar: "Aadhaar Card",
    aadhaar: "Aadhaar Card",
    pan: "PAN Card",
    marksheet_10: "10th Marksheet",
    marksheet_12: "12th / Diploma Marksheet",
    degree_certificate: "Degree Certificate / CMM",
    cmm: "Degree Certificate / CMM",
    consolidated_marks_memo: "Degree Certificate / CMM",
    ug_transcript: "Undergraduate Transcript",
    ug_degree: "Undergraduate Degree",
    pg_transcript: "Postgraduate Transcript",
    pg_degree: "Postgraduate Degree",
    offer_letter: "Offer / Admission Letter",
    visa: "Visa",
    english_test: "IELTS / TOEFL / PTE Score Card",
    ielts_toefl: "IELTS / TOEFL Score",
    aptitude_test: "GRE / GMAT / SAT Score Card",
    work_letters: "Work Experience Letters",
    lor: "Letter of Recommendation",
    sop: "Statement of Purpose",

    // Financial & Supporting
    income_proof: "Income Proof",
    bank_statement: "Bank Statement",
    financial_statement: "Financial Statement",
    loan_sanction: "Loan Sanction Letter",
    collateral_docs: "Property / Collateral Documents",
    insurance: "Insurance",
    other: "Other Document",
};

function getDocLabel(doc: any, userData?: any): string {
    if (doc.docName) return doc.docName;
    if (doc.verificationMetadata?.docName) return doc.verificationMetadata.docName;
    const t = (doc.docType || doc.type || doc.documentType || "other").toLowerCase();
    if (DOC_TYPE_LABELS[t]) return DOC_TYPE_LABELS[t];
    if (userData) {
        const dynName = getDocumentRequirementName(t, undefined, userData);
        if (dynName && dynName !== t) return dynName;
    }
    if (t.startsWith("custom_")) {
        return t.replace("custom_", "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
    }
    return t.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function getDocScope(docType: string): { label: string; color: string; icon: string; category: "parent" | "coapplicant" | "student" | "financial" } {
    const t = String(docType || "").toLowerCase();
    if (t.startsWith("father_") || t.startsWith("mother_") || t.startsWith("parent_")) {
        return { label: "Parent Document", color: "bg-amber-50 text-amber-700 border-amber-200", icon: "family_restroom", category: "parent" };
    }
    if (t.startsWith("coapplicant_")) {
        return { label: "Co-Applicant Document", color: "bg-purple-50 text-purple-700 border-purple-200", icon: "group", category: "coapplicant" };
    }
    if (t.includes("bank") || t.includes("income") || t.includes("financial") || t.includes("itr") || t.includes("salary") || t.includes("collateral")) {
        return { label: "Financial Document", color: "bg-blue-50 text-blue-700 border-blue-200", icon: "account_balance", category: "financial" };
    }
    return { label: "Student Document", color: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: "school", category: "student" };
}

function statusConfig(status: string, isUploaded: boolean) {
    if (!isUploaded) {
        return {
            label: "Required",
            className: "bg-red-50 text-red-600 border-red-100",
            icon: "priority_high",
            iconColor: "text-red-500",
        };
    }
    const s = (status || "").toLowerCase();
    if (s === "approved" || s === "verified") {
        return {
            label: "Verified",
            className: "bg-emerald-50 text-emerald-700 border-emerald-200",
            icon: "verified",
            iconColor: "text-emerald-600",
        };
    } else if (s === "rejected") {
        return {
            label: "Rejected",
            className: "bg-rose-50 text-rose-700 border-rose-200",
            icon: "block",
            iconColor: "text-rose-500",
        };
    } else {
        return {
            label: "Pending Review",
            className: "bg-amber-50 text-amber-700 border-amber-200",
            icon: "schedule",
            iconColor: "text-amber-600",
        };
    }
}

export default function DocumentsTab() {
    const { userId, userData, userDocuments, setUserDocuments, refreshData } = useUserDossier();
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewName, setPreviewName] = useState<string>("");
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [directUploadingDocId, setDirectUploadingDocId] = useState<string | null>(null);
    const [draggingDocType, setDraggingDocType] = useState<string | null>(null);

    // Upload modal state
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploadDocType, setUploadDocType] = useState("father_aadhar");
    const [uploadCustomType, setUploadCustomType] = useState("");
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reject modal state
    const [rejectDoc, setRejectDoc] = useState<any | null>(null);
    const [rejectReason, setRejectReason] = useState("");
    const [actionLoading, setActionLoading] = useState<string | null>(null); // docId being actioned

    // Direct upload handler for interactive dropzones
    const handleDirectUpload = async (docType: string, file: File, docName?: string) => {
        if (!file) return;
        setDirectUploadingDocId(docType);
        try {
            await documentApi.upload(userId, docType, file);
            await refreshData();
        } catch (err: any) {
            console.error("Direct upload error:", err);
            alert(err?.response?.data?.message || err?.message || "Failed to upload document");
        } finally {
            setDirectUploadingDocId(null);
        }
    };

    // Combine standard requirements (student + parents + coapplicant) with uploaded documents
    const allDocuments = useMemo(() => {
        const inferredReqs = getProfileDocumentRequirements(userData || {});

        const coAppObj = userData?.coApplicant || {};
        const coAppName = typeof coAppObj === "object" ? (coAppObj.name || coAppObj.coApplicantName || userData?.coApplicantName) : "";
        const parentOrCoAppLabel = coAppName ? `${coAppName} (Co-Applicant)` : "Parent / Co-Applicant";

        const standardReqs = [...inferredReqs];
        if (!standardReqs.some(r => r.type === "coapplicant_bank_statement")) {
            standardReqs.push({
                name: `${parentOrCoAppLabel}'s 6-Month Bank Statement`,
                label: `${parentOrCoAppLabel}'s 6-Month Bank Statement`,
                type: "coapplicant_bank_statement",
                category: "financial",
                required: true,
            });
        }
        if (!standardReqs.some(r => r.type === "coapplicant_income_proof")) {
            standardReqs.push({
                name: `${parentOrCoAppLabel}'s Income Proof (Salary Slips / Form 16 / ITR)`,
                label: `${parentOrCoAppLabel}'s Income Proof (Salary Slips / Form 16 / ITR)`,
                type: "coapplicant_income_proof",
                category: "financial",
                required: true,
            });
        }

        const normalizedType = (t: string) => {
            const s = (t || "").toLowerCase();
            if (s === "aadhar" || s === "aadhaar") return "national_id";
            if (s === "cmm" || s === "consolidated_marks_memo") return "degree_certificate";
            return s;
        };

        const result: any[] = [];
        const matchedUserDocIds = new Set<string>();

        // 1. Process standard requirements
        for (const req of standardReqs) {
            const reqNorm = normalizedType(req.type);
            const matchingDoc = userDocuments.find(d => {
                const docNorm = normalizedType(d.docType || d.type || "");
                return docNorm === reqNorm || docNorm === req.type.toLowerCase();
            });

            if (matchingDoc) {
                matchedUserDocIds.add(matchingDoc.id || matchingDoc._id || matchingDoc.docType);
                result.push({
                    ...matchingDoc,
                    docType: matchingDoc.docType || req.type,
                    docName: matchingDoc.docName || req.name,
                    category: req.category,
                    isRequirement: true,
                    uploaded: Boolean(matchingDoc.uploaded || matchingDoc.filePath),
                });
            } else {
                result.push({
                    id: `req-${req.type}`,
                    docType: req.type,
                    docName: req.name,
                    status: "pending",
                    uploaded: false,
                    category: req.category,
                    isRequirement: true,
                });
            }
        }

        // 2. Append any extra uploaded documents not in standard requirements
        for (const doc of userDocuments) {
            const docId = doc.id || doc._id || doc.docType;
            if (!matchedUserDocIds.has(docId)) {
                result.push({
                    ...doc,
                    isRequirement: false,
                    uploaded: Boolean(doc.uploaded || doc.filePath),
                });
            }
        }

        return result;
    }, [userData, userDocuments]);

    // Filter logic
    const filtered = useMemo(() => {
        return allDocuments.filter((doc) => {
            const label = getDocLabel(doc, userData).toLowerCase();
            const matchesSearch = label.includes(search.toLowerCase()) || (doc.docType || "").toLowerCase().includes(search.toLowerCase());
            
            const isUploaded = Boolean(doc.uploaded || doc.filePath);
            const status = (doc.status || "pending").toLowerCase();
            const isVerified = (status === "approved" || status === "verified") && isUploaded;
            const isRejected = status === "rejected";
            const isPending = !isVerified && !isRejected;

            const matchesStatus =
                filterStatus === "all" ||
                (filterStatus === "approved" && isVerified) ||
                (filterStatus === "rejected" && isRejected) ||
                (filterStatus === "pending" && isPending);

            return matchesSearch && matchesStatus;
        }).sort((a, b) => {
            const aUploaded = Boolean(a.uploaded || a.filePath);
            const bUploaded = Boolean(b.uploaded || b.filePath);
            if (aUploaded !== bUploaded) {
                return aUploaded ? -1 : 1;
            }
            const aTime = new Date(a.updatedAt || a.uploadedAt || a.createdAt || 0).getTime();
            const bTime = new Date(b.updatedAt || b.uploadedAt || b.createdAt || 0).getTime();
            return bTime - aTime;
        });
    }, [allDocuments, search, filterStatus, userData]);

    const stats = {
        total: allDocuments.length,
        verified: allDocuments.filter((d) => {
            const s = (d.status || "").toLowerCase();
            return (s === "approved" || s === "verified") && Boolean(d.uploaded || d.filePath);
        }).length,
        rejected: allDocuments.filter((d) => (d.status || "").toLowerCase() === "rejected").length,
        pending: allDocuments.filter((d) => {
            const s = (d.status || "").toLowerCase();
            const isVerified = (s === "approved" || s === "verified") && Boolean(d.uploaded || d.filePath);
            return !isVerified && s !== "rejected";
        }).length,
    };

    // Open upload modal with specific doc type pre-selected
    const openUploadModal = (docType?: string) => {
        if (docType) {
            setUploadDocType(docType);
        }
        setUploadError("");
        setUploadFile(null);
        setUploadCustomType("");
        setIsUploadOpen(true);
    };

    // ── Upload handler (Without OCR for Staff) ───────────────────────────
    const handleUpload = async () => {
        if (!uploadFile) return;

        let finalDocType = uploadDocType;
        let finalDocName: string | undefined = undefined;

        if (uploadDocType === "other") {
            if (!uploadCustomType.trim()) {
                setUploadError("Please specify the custom document type name.");
                return;
            }
            const cleanSlug = uploadCustomType.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
            finalDocType = `custom_${cleanSlug}`;
            finalDocName = uploadCustomType.trim();
        } else {
            finalDocName = DOC_TYPE_LABELS[uploadDocType] || uploadDocType;
        }

        setUploading(true);
        setUploadError("");
        try {
            // Staff upload: skipOcr=true ensures OCR processing and strict cross-validation are bypassed!
            const res = await documentApi.upload(
                userId,
                finalDocType,
                uploadFile,
                (pct) => setUploadProgress(pct),
                finalDocName,
                true // skipOcr = true
            ) as any;

            const docId = res?.data?.id || res?.data?._id;
            if (docId) {
                // Staff uploads go to verified directly
                await documentApi.accept(docId).catch(() => {});
            }

            // Log activity in DB
            const studentName = userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : 'student';
            staffProfileApi.logActivity({
                type: 'upload',
                msg: `Uploaded ${getDocLabel({ docType: finalDocType, docName: finalDocName }, userData)} for ${studentName} without OCR`,
                icon: 'upload_file',
                color: 'bg-purple-50 text-purple-700 border-purple-100'
            }).catch(console.error);

            setIsUploadOpen(false);
            setUploadFile(null);
            setUploadCustomType("");
            setUploadProgress(0);
            await refreshData();
        } catch (err: any) {
            setUploadError(err.message || "Upload failed. Please try again.");
        } finally {
            setUploading(false);
        }
    };

    // ── Approve handler ─────────────────────────────────────────────────
    const handleApprove = async (doc: any) => {
        const docId = doc.id || doc._id;
        if (!docId) return;
        setActionLoading(docId);
        try {
            await documentApi.accept(docId);
            // Optimistic update
            setUserDocuments(
                userDocuments.map((d) =>
                    (d.id || d._id) === docId ? { ...d, status: "verified" } : d
                )
            );

            // Log activity in DB
            const studentName = userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : 'student';
            staffProfileApi.logActivity({
                type: 'approved',
                msg: `Verified ${getDocLabel(doc, userData)} for ${studentName}`,
                icon: 'verified',
                color: 'bg-emerald-50 text-emerald-700 border-emerald-100'
            }).catch(console.error);

            await refreshData();
        } catch (err) {
            console.error("Failed to approve document:", err);
        } finally {
            setActionLoading(null);
        }
    };

    // ── Reject handler ──────────────────────────────────────────────────
    const handleReject = async () => {
        if (!rejectDoc) return;
        const docId = rejectDoc.id || rejectDoc._id;
        setActionLoading(docId);
        try {
            await documentApi.reject(docId, rejectReason);
            // Optimistic update
            setUserDocuments(
                userDocuments.map((d) =>
                    (d.id || d._id) === docId ? { ...d, status: "rejected", rejectionReason: rejectReason } : d
                )
            );

            // Log activity in DB
            const studentName = userData ? `${userData.firstName || ''} ${userData.lastName || ''}`.trim() : 'student';
            staffProfileApi.logActivity({
                type: 'rejected',
                msg: `Rejected ${getDocLabel(rejectDoc, userData)} for ${studentName}${rejectReason ? `: "${rejectReason}"` : ''}`,
                icon: 'block',
                color: 'bg-rose-50 text-rose-700 border-rose-100'
            }).catch(console.error);

            setRejectDoc(null);
            setRejectReason("");
            await refreshData();
        } catch (err) {
            console.error("Failed to reject document:", err);
        } finally {
            setActionLoading(null);
        }
    };

    // ── View Document Handler ───────────────────────────────────────────
    const handleView = async (doc: any) => {
        const docLabel = getDocLabel(doc, userData);
        try {
            const res = await documentApi.getPresignedView(userId, doc.docType) as any;
            if (res && res.url) {
                setPreviewUrl(res.url);
                setPreviewName(docLabel);
            } else {
                setPreviewUrl(`/api/documents/view/${userId}/${doc.docType}`);
                setPreviewName(docLabel);
            }
        } catch (err) {
            console.error("Failed to load view URL:", err);
            setPreviewUrl(`/api/documents/view/${userId}/${doc.docType}`);
            setPreviewName(docLabel);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                        Documents
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-normal">
                        Student, Parents &amp; Co-Applicant required documents for loan verification
                    </p>
                </div>
                <button
                    onClick={() => openUploadModal()}
                    className="flex items-center gap-2 px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer border-0"
                >
                    <span className="material-symbols-outlined text-[16px]">upload_file</span>
                    <span>Upload Document</span>
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: "Total Documents", value: stats.total, icon: "folder", bg: "bg-slate-100 text-slate-600" },
                    { label: "Verified", value: stats.verified, icon: "verified", bg: "bg-emerald-50 text-emerald-600" },
                    { label: "Required / Pending", value: stats.pending, icon: "schedule", bg: "bg-amber-50 text-amber-600" },
                    { label: "Rejected", value: stats.rejected, icon: "block", bg: "bg-rose-50 text-rose-600" },
                ].map((stat, i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-3.5">
                        <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                            <span className="material-symbols-outlined text-[20px]">{stat.icon}</span>
                        </div>
                        <div>
                            <p className="text-[11px] font-medium text-slate-500">{stat.label}</p>
                            <p className="text-xl font-bold text-slate-900 mt-0.5">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Search, Status Filters & View Switcher */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
                    <div className="relative flex-1 max-w-xs">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[18px] text-slate-400">search</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search document name..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all placeholder:text-slate-400"
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilterStatus(f)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                                    filterStatus === f
                                        ? "bg-white text-purple-700 shadow-xs font-bold"
                                        : "text-slate-500 hover:text-slate-800 hover:bg-white/50"
                                }`}
                            >
                                {f === "all" ? "All" : f === "approved" ? "Verified" : f === "pending" ? "Required / Pending" : "Rejected"}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid / List View Switcher */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/60 shrink-0">
                    <button
                        onClick={() => setViewMode("grid")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border-0 ${
                            viewMode === "grid"
                                ? "bg-white text-purple-700 shadow-xs font-bold"
                                : "text-slate-500 hover:text-slate-800"
                        }`}
                        title="Interactive Card Grid"
                    >
                        <span className="material-symbols-outlined text-[16px]">grid_view</span>
                        <span>Grid</span>
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border-0 ${
                            viewMode === "list"
                                ? "bg-white text-purple-700 shadow-xs font-bold"
                                : "text-slate-500 hover:text-slate-800"
                        }`}
                        title="Compact Administrative List"
                    >
                        <span className="material-symbols-outlined text-[16px]">view_list</span>
                        <span>List</span>
                    </button>
                </div>
            </div>

            {/* Documents Container */}
            {filtered.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-12 flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3 text-slate-400">
                        <span className="material-symbols-outlined text-[28px]">folder_off</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">
                        No Documents Found
                    </h3>
                    <p className="text-xs text-slate-500 font-normal mt-1 max-w-xs">
                        No documents match your current search or filter criteria.
                    </p>
                </div>
            ) : viewMode === "grid" ? (
                /* ── 1. The 'Interactive Dropzone' Card Grid Model ── */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((doc: any, idx: number) => {
                        const isUploaded = Boolean(doc.uploaded || doc.filePath);
                        const status = (doc.status || "pending").toLowerCase();
                        const isVerified = (status === "approved" || status === "verified") && isUploaded;
                        const isRejected = status === "rejected";

                        const { label, className, icon, iconColor } = statusConfig(doc.status, isUploaded);
                        const docLabel = getDocLabel(doc, userData);
                        const scopeInfo = getDocScope(doc.docType);
                        const uploadDate = doc.createdAt || doc.uploadedAt || doc.created_at;
                        const docId = doc.id || doc._id || doc.docType;
                        const isActioning = actionLoading === docId;
                        const isUploadingThis = directUploadingDocId === doc.docType;
                        const isDraggingThis = draggingDocType === doc.docType;

                        return (
                            <motion.div
                                key={docId || idx}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.02 }}
                                className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 hover:border-slate-300 transition-all duration-200 flex flex-col justify-between group"
                            >
                                <div>
                                    {/* Header (Top) */}
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            {/* Document Name at top left in strong, dark gray font */}
                                            <h4 className="text-slate-800 font-semibold text-sm leading-snug line-clamp-1" title={docLabel}>
                                                {docLabel}
                                            </h4>
                                            {/* Single Status Badge below document name */}
                                            <div>
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${className}`}>
                                                    <span className={`material-symbols-outlined text-[13px] ${iconColor}`}>{icon}</span>
                                                    {label}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Category Tag (Top Right): Subtle text label with small icon */}
                                        <div className="text-slate-400 text-xs font-medium flex items-center gap-1 shrink-0 pt-0.5" title={scopeInfo.label}>
                                            <span className="material-symbols-outlined text-[15px]">{scopeInfo.icon}</span>
                                            <span>{scopeInfo.label}</span>
                                        </div>
                                    </div>

                                    {/* Action Area (Middle) */}
                                    {!isUploaded ? (
                                        /* Unuploaded: Interactive Dashed Dropzone */
                                        <label
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDraggingDocType(doc.docType);
                                            }}
                                            onDragLeave={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDraggingDocType(null);
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDraggingDocType(null);
                                                const file = e.dataTransfer.files?.[0];
                                                if (file) handleDirectUpload(doc.docType, file, docLabel);
                                            }}
                                            className={`border-dashed border-2 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 block ${
                                                isDraggingThis
                                                    ? "border-purple-500 bg-purple-50"
                                                    : "border-slate-300 bg-slate-50 hover:border-purple-500 hover:bg-purple-50/40"
                                            }`}
                                        >
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleDirectUpload(doc.docType, file, docLabel);
                                                }}
                                            />

                                            {isUploadingThis ? (
                                                <div className="flex flex-col items-center justify-center py-2">
                                                    <span className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mb-2" />
                                                    <span className="text-xs font-medium text-slate-700">Uploading {docLabel}...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="material-symbols-outlined text-[32px] text-purple-500 mb-1.5 transition-transform group-hover:scale-105">
                                                        cloud_upload
                                                    </span>
                                                    <p className="text-xs font-medium text-slate-700">Drag &amp; drop file here</p>
                                                    <span className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 hover:underline mt-0.5">
                                                        or click to browse
                                                    </span>
                                                </>
                                            )}
                                        </label>
                                    ) : (
                                        /* Uploaded Document Info Card */
                                        <div className="space-y-2.5">
                                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                                                        <span className="material-symbols-outlined text-[18px]">description</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-semibold text-slate-800 truncate" title={doc.fileName || docLabel}>
                                                            {doc.fileName || doc.originalName || `${docLabel}.pdf`}
                                                        </p>
                                                        {uploadDate && (
                                                            <p className="text-[10px] text-slate-500">
                                                                Uploaded {new Date(uploadDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleView(doc)}
                                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                                                    title="Preview Document"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                    <span>View</span>
                                                </button>
                                            </div>

                                            {/* Rejection reason callout if rejected */}
                                            {isRejected && doc.rejectionReason && (
                                                <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-100">
                                                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider mb-0.5">Rejection Reason</p>
                                                    <p className="text-xs font-medium text-rose-700">{doc.rejectionReason}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Actions Footer (for Uploaded Documents) */}
                                {isUploaded && (
                                    <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                                        <div className="flex items-center gap-2">
                                            <a
                                                href={`/api/documents/view/${userId}/${doc.docType}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 transition-colors"
                                                title="Open in new tab"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                                <span>Tab</span>
                                            </a>

                                            <label className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 transition-colors cursor-pointer">
                                                <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                                                <span>Replace</span>
                                                <input
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleDirectUpload(doc.docType, file, docLabel);
                                                    }}
                                                />
                                            </label>
                                        </div>

                                        {/* Verification buttons */}
                                        {!isVerified && !isRejected && (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => handleApprove(doc)}
                                                    disabled={isActioning}
                                                    className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                                                >
                                                    {isActioning ? (
                                                        <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                    )}
                                                    Accept
                                                </button>
                                                <button
                                                    onClick={() => { setRejectDoc(doc); setRejectReason(""); }}
                                                    disabled={isActioning}
                                                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">block</span>
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            ) : (
                /* ── 2. The Compact Administrative List View ── */
                <div className="space-y-2">
                    {filtered.map((doc: any, idx: number) => {
                        const isUploaded = Boolean(doc.uploaded || doc.filePath);
                        const status = (doc.status || "pending").toLowerCase();
                        const isVerified = (status === "approved" || status === "verified") && isUploaded;
                        const isRejected = status === "rejected";
                        const { label, className, icon, iconColor } = statusConfig(doc.status, isUploaded);
                        const docLabel = getDocLabel(doc, userData);
                        const scopeInfo = getDocScope(doc.docType);
                        const uploadDate = doc.createdAt || doc.uploadedAt || doc.created_at;
                        const docId = doc.id || doc._id || doc.docType;
                        const isActioning = actionLoading === docId;
                        const isUploadingThis = directUploadingDocId === doc.docType;

                        return (
                            <div
                                key={docId || idx}
                                className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                            >
                                {/* Left: Document Name and Category Tag */}
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                        isUploaded ? "bg-purple-50 text-purple-600 border border-purple-100" : "bg-slate-100 text-slate-400 border border-slate-200"
                                    }`}>
                                        <span className="material-symbols-outlined text-[18px]">
                                            {isUploaded ? "description" : "upload_file"}
                                        </span>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="text-slate-800 font-semibold text-sm truncate" title={docLabel}>
                                                {docLabel}
                                            </h4>
                                            <div className="text-slate-400 text-xs font-medium flex items-center gap-1">
                                                <span>•</span>
                                                <span className="material-symbols-outlined text-[13px]">{scopeInfo.icon}</span>
                                                <span>{scopeInfo.label}</span>
                                            </div>
                                        </div>
                                        {isUploaded && uploadDate && (
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                Uploaded {new Date(uploadDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                {doc.fileName && <span className="font-mono ml-1 text-slate-400">({doc.fileName})</span>}
                                            </p>
                                        )}
                                        {isRejected && doc.rejectionReason && (
                                            <p className="text-[11px] text-rose-600 font-medium mt-0.5">
                                                Reason: {doc.rejectionReason}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Middle: Status Badge */}
                                <div className="flex items-center gap-2 shrink-0 md:w-36">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border ${className}`}>
                                        <span className={`material-symbols-outlined text-[14px] ${iconColor}`}>{icon}</span>
                                        {label}
                                    </span>
                                </div>

                                {/* Right: Outlined Upload or Actions */}
                                <div className="flex items-center gap-2 shrink-0 justify-end">
                                    {isUploaded ? (
                                        <>
                                            <button
                                                onClick={() => handleView(doc)}
                                                className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                <span>View</span>
                                            </button>
                                            <a
                                                href={`/api/documents/view/${userId}/${doc.docType}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1.5 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg text-xs transition-colors"
                                                title="Open in new tab"
                                            >
                                                <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                                            </a>
                                            <label className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer">
                                                <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
                                                <span>Replace</span>
                                                <input
                                                    type="file"
                                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleDirectUpload(doc.docType, file, docLabel);
                                                    }}
                                                />
                                            </label>
                                            {!isVerified && !isRejected && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(doc)}
                                                        disabled={isActioning}
                                                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">check_circle</span>
                                                        <span>Accept</span>
                                                    </button>
                                                    <button
                                                        onClick={() => { setRejectDoc(doc); setRejectReason(""); }}
                                                        disabled={isActioning}
                                                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">block</span>
                                                        <span>Reject</span>
                                                    </button>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        /* Clean, outlined "Upload" button (transparent background, purple border, purple text) */
                                        <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 border border-purple-600 text-purple-700 hover:bg-purple-50 rounded-lg text-xs font-semibold cursor-pointer transition-colors">
                                            {isUploadingThis ? (
                                                <span className="w-3.5 h-3.5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <span className="material-symbols-outlined text-[16px] text-purple-600">cloud_upload</span>
                                            )}
                                            <span>{isUploadingThis ? "Uploading..." : "Upload"}</span>
                                            <input
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleDirectUpload(doc.docType, file, docLabel);
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Upload Document Modal (OCR Bypassed for Staff) ─────────── */}
            <AnimatePresence>
                {isUploadOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                        onClick={() => !uploading && setIsUploadOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-white/40"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-gradient-to-r from-[#6605c7]/10 to-[#8b24e5]/10 border-b border-[#6605c7]/10 px-6 py-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-[#6605c7]/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[20px] text-[#6605c7]">upload_file</span>
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider">Upload Document</h3>
                                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Direct upload without OCR • Directly verified</p>
                                </div>
                                <button
                                    onClick={() => !uploading && setIsUploadOpen(false)}
                                    className="ml-auto w-8 h-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-all cursor-pointer border-0"
                                >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                {/* Doc Type with clean groupings */}
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                                        Document Type
                                    </label>
                                    <select
                                        value={uploadDocType}
                                        onChange={(e) => {
                                            setUploadDocType(e.target.value);
                                            if (e.target.value !== "other") {
                                                setUploadCustomType("");
                                            }
                                        }}
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 focus:border-[#6605c7] cursor-pointer transition-all"
                                    >
                                        {DOCUMENT_OPTIONS_GROUPED.map((grp) => (
                                            <optgroup key={grp.group} label={grp.group}>
                                                {grp.options.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                    </select>
                                </div>

                                {/* Custom Document Field when 'other' is selected */}
                                {uploadDocType === "other" && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-3"
                                    >
                                        <label className="block text-[9px] font-black uppercase tracking-wider text-[#6605c7] mb-1.5">
                                            Specify Document Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={uploadCustomType}
                                            onChange={(e) => {
                                                setUploadCustomType(e.target.value);
                                                if (uploadError) setUploadError("");
                                            }}
                                            placeholder="e.g. Electricity Bill, Property Tax Receipt, Experience Letter..."
                                            required
                                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 focus:border-[#6605c7] transition-all placeholder:text-slate-400 placeholder:text-[10px]"
                                        />
                                    </motion.div>
                                )}

                                {/* File Drop Zone */}
                                <div>
                                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">File</label>
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`relative w-full rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                                            uploadFile
                                                ? "border-[#6605c7] bg-[#6605c7]/5"
                                                : "border-slate-200 bg-slate-50 hover:border-[#6605c7]/50 hover:bg-[#6605c7]/5"
                                        }`}
                                    >
                                        <span className="material-symbols-outlined text-[32px] text-slate-300">cloud_upload</span>
                                        {uploadFile ? (
                                            <div className="text-center">
                                                <p className="text-[11px] font-black text-[#6605c7]">{uploadFile.name}</p>
                                                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">
                                                    {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="text-center">
                                                <p className="text-[11px] font-bold text-slate-600">Click to select a file</p>
                                                <p className="text-[9px] text-slate-400 font-semibold mt-0.5">PDF, JPG, PNG up to 10MB</p>
                                            </div>
                                        )}
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    setUploadFile(e.target.files[0]);
                                                    setUploadError("");
                                                }
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* OCR Bypass Notice Banner */}
                                <div className="flex items-center gap-2 px-3 py-2 bg-purple-50/70 border border-purple-100 rounded-xl text-purple-700">
                                    <span className="material-symbols-outlined text-[16px] text-purple-600 flex-shrink-0">verified_user</span>
                                    <p className="text-[9px] font-semibold leading-relaxed">
                                        Staff Upload Mode: OCR verification is bypassed. The document will be registered and marked as Verified immediately.
                                    </p>
                                </div>

                                {/* Progress bar */}
                                {uploading && (
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-[#6605c7] to-[#8b24e5] transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                )}

                                {/* Error */}
                                {uploadError && (
                                    <p className="text-[10px] font-bold text-rose-600 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
                                        {uploadError}
                                    </p>
                                )}
                            </div>

                            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
                                <button
                                    onClick={() => !uploading && setIsUploadOpen(false)}
                                    disabled={uploading}
                                    className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-all cursor-pointer border-0"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUpload}
                                    disabled={uploading || !uploadFile}
                                    className="flex items-center gap-1.5 px-5 py-2 text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-[#6605c7] to-[#8b24e5] hover:opacity-90 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-purple-500/20 border-0"
                                >
                                    <span className="material-symbols-outlined text-[15px]">upload</span>
                                    {uploading ? `Uploading ${Math.round(uploadProgress)}%...` : "Upload Document"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Reject Modal ───────────────────────────────────────────── */}
            <AnimatePresence>
                {rejectDoc && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                        onClick={() => setRejectDoc(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-white/40"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="bg-gradient-to-r from-rose-500/10 to-red-500/10 border-b border-rose-200 px-6 py-4 flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                                    <span className="material-symbols-outlined text-[20px] text-rose-600">block</span>
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wider">Reject Document</h3>
                                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{getDocLabel(rejectDoc, userData)}</p>
                                </div>
                            </div>

                            <div className="p-6">
                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-2">Rejection Reason</label>
                                <textarea
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="E.g. Document is blurry, expired, or doesn't match the required format. Please resubmit a clearer version..."
                                    rows={4}
                                    autoFocus
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 resize-none placeholder:text-slate-400 placeholder:text-[10px] transition-all"
                                />
                                <p className="text-[9px] text-slate-400 font-semibold mt-2">
                                    The student will see this reason and can resubmit.
                                </p>
                            </div>

                            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex justify-end gap-3">
                                <button
                                    onClick={() => setRejectDoc(null)}
                                    className="px-4 py-2 text-[10px] font-black uppercase tracking-wider text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-all cursor-pointer border-0"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={!rejectReason.trim() || !!actionLoading}
                                    className="px-5 py-2 text-[10px] font-black uppercase tracking-wider text-white bg-gradient-to-r from-rose-500 to-red-600 hover:opacity-90 rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-0"
                                >
                                    {actionLoading ? "Rejecting..." : "Confirm Rejection"}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Document Preview Modal ──────────────────────────────────── */}
            <AnimatePresence>
                {previewUrl && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                        onClick={() => setPreviewUrl(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.92, opacity: 0 }}
                            className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-3xl w-full max-h-[85vh] flex flex-col"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-[#6605c7]">description</span>
                                    <p className="text-[11px] font-black text-slate-800 uppercase tracking-wider">{previewName}</p>
                                </div>
                                <button
                                    onClick={() => setPreviewUrl(null)}
                                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-rose-500 hover:border-rose-200 transition-all cursor-pointer border-0"
                                >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-2 bg-slate-100 flex items-center justify-center min-h-[400px]">
                                {previewUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i) ? (
                                    <img src={previewUrl} alt={previewName} className="max-h-[65vh] max-w-full object-contain rounded-lg shadow" />
                                ) : (
                                    <iframe
                                        src={previewUrl}
                                        title={previewName}
                                        className="w-full h-[65vh] rounded-lg border-0"
                                    />
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
