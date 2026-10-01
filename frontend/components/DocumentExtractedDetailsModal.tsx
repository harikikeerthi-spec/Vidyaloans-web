"use client";

import { useState, useEffect } from "react";

export interface ExtractedFieldItem {
    key: string;
    label: string;
    value: string;
    icon: string;
    category: "identity" | "family" | "address" | "academic" | "other";
}

interface DocumentExtractedDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (confirmedFields: Record<string, any>) => Promise<void> | void;
    docType: string;
    docTitle: string;
    confidence?: number;
    extracted: Record<string, any>;
    isSaving?: boolean;
    readOnly?: boolean;
}

export default function DocumentExtractedDetailsModal({
    isOpen,
    onClose,
    onConfirm,
    docType,
    docTitle,
    confidence = 95,
    extracted = {},
    isSaving = false,
    readOnly = false,
}: DocumentExtractedDetailsModalProps) {
    const [editableFields, setEditableFields] = useState<Record<string, string>>({});
    const [activeTab, setActiveTab] = useState<"all" | "primary" | "other">("all");

    // Helper to normalize and categorize fields
    useEffect(() => {
        if (!isOpen) return;

        const initial: Record<string, string> = {};

        // Extract and flatten fields
        const raw = { ...extracted };

        // Normalize common fields
        const fullName = raw.full_name || raw.fullName || raw.name || raw.person_name || raw.holder_name || raw.applicant_name || raw.candidate_name || "";
        const docNum = raw.passport_number || raw.passportNo || raw.pan_number || raw.pan || raw.aadhar_number || raw.aadhaar_number || raw.id_number || raw.roll_number || raw.registration_number || "";
        const dob = raw.dob || raw.date_of_birth || raw.dateOfBirth || "";
        const gender = raw.gender || "";
        const fatherName = raw.father_name || raw.fatherName || raw.father_full_name || (typeof raw.care_of === "string" ? raw.care_of.replace(/^(c\/o|s\/o|d\/o|care\s+of)\s*[:\-\.]?\s*/i, "") : "") || "";
        const motherName = raw.mother_name || raw.motherName || raw.mother_full_name || "";
        const spouseName = raw.spouse_name || raw.spouseName || "";
        const address = typeof raw.address === "string" ? raw.address : (raw.address?.address1 ? `${raw.address.address1}, ${raw.address.city || ""}` : "");
        const institution = raw.institution_name || raw.school_name || raw.board_name || raw.university_name || "";
        const passingYear = raw.year_of_passing || raw.passing_year || raw.year || "";
        const score = raw.percentage || raw.marks || raw.cgpa || raw.grade || "";

        if (fullName) initial["fullName"] = String(fullName);
        if (docNum) initial["documentNumber"] = String(docNum);
        if (dob) initial["dob"] = String(dob);
        if (gender) initial["gender"] = String(gender);
        if (fatherName) initial["fatherName"] = String(fatherName);
        if (motherName) initial["motherName"] = String(motherName);
        if (spouseName) initial["spouseName"] = String(spouseName);
        if (address) initial["address"] = String(address);
        if (institution) initial["institution"] = String(institution);
        if (passingYear) initial["passingYear"] = String(passingYear);
        if (score) initial["score"] = String(score);

        // Include any other non-empty string or number fields that are not technical
        const ignoredKeys = new Set([
            "full_name", "fullName", "name", "person_name", "holder_name", "applicant_name", "candidate_name",
            "passport_number", "passportNo", "pan_number", "pan", "aadhar_number", "aadhaar_number", "id_number", "roll_number", "registration_number",
            "dob", "date_of_birth", "dateOfBirth", "gender", "father_name", "fatherName", "father_full_name", "care_of", "c_o", "guardian_name",
            "mother_name", "motherName", "mother_full_name", "spouse_name", "spouseName",
            "address", "institution_name", "school_name", "board_name", "university_name", "year_of_passing", "passing_year", "percentage", "marks", "cgpa", "grade",
            "ocr_issues", "missing_fields", "raw_text_summary", "error", "document_type", "confidence_score", "is_valid", "document_validation", "staffUploaded"
        ]);

        Object.entries(raw).forEach(([k, v]) => {
            if (!ignoredKeys.has(k) && typeof v !== "object" && typeof v !== "boolean" && v !== null && v !== undefined && String(v).trim()) {
                initial[k] = String(v);
            }
        });

        setEditableFields(initial);
    }, [isOpen, extracted]);

    if (!isOpen) return null;

    const isIdentitySlot = ['passport', 'national_id', 'aadhar', 'aadhaar'].includes((docType || '').toLowerCase());

    const handleInputChange = (key: string, value: string) => {
        if (isIdentitySlot && key === "fullName") return;
        setEditableFields(prev => ({ ...prev, [key]: value }));
    };

    const handleConfirm = () => {
        onConfirm(editableFields);
    };

    // Human-friendly field definitions
    const fieldDefinitions: Record<string, { label: string; icon: string; category: "identity" | "family" | "address" | "academic" | "other" }> = {
        fullName: { label: "Full Name", icon: "person", category: "identity" },
        documentNumber: { label: "Document / ID Number", icon: "badge", category: "identity" },
        dob: { label: "Date of Birth", icon: "cake", category: "identity" },
        gender: { label: "Gender", icon: "transgender", category: "identity" },
        fatherName: { label: "Father's Name", icon: "family_restroom", category: "family" },
        motherName: { label: "Mother's Name", icon: "female", category: "family" },
        spouseName: { label: "Spouse's Name", icon: "favorite", category: "family" },
        address: { label: "Address", icon: "home_pin", category: "address" },
        institution: { label: "Institution / Board", icon: "school", category: "academic" },
        passingYear: { label: "Year of Passing", icon: "calendar_today", category: "academic" },
        score: { label: "Marks / Percentage / CGPA", icon: "grade", category: "academic" },
    };

    const fieldEntries = Object.entries(editableFields);
    const hasFields = fieldEntries.length > 0;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-purple-100/80 animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-[#6605c7] via-[#7e22ce] to-[#9333ea] px-6 py-5 flex items-center justify-between text-white shrink-0 shadow-md">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/20 shadow-inner">
                            <span className="material-symbols-outlined text-[24px]">verified</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="font-extrabold text-[17px] text-white tracking-tight">
                                    {docTitle || "Document Extracted Details"}
                                </h2>
                                <span className="bg-emerald-500/25 border border-emerald-300/40 text-emerald-200 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                    {confidence}% AI Confidence
                                </span>
                            </div>
                            <p className="text-[11px] text-purple-100/90 font-medium mt-0.5">
                                Verified via AI OCR Engine • Review and confirm details below
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-colors text-white cursor-pointer"
                        title="Close"
                    >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
                    {/* Status Notice Banner */}
                    <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50/50 rounded-2xl border border-emerald-200/80 flex items-start gap-3.5 shadow-sm">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                            <span className="material-symbols-outlined text-[20px]">check_circle</span>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-[13px] font-bold text-emerald-950">
                                Document Uploaded & Processed Successfully!
                            </h4>
                            <p className="text-[11px] text-emerald-800/90 font-medium mt-0.5 leading-relaxed">
                                {readOnly
                                    ? "These details were automatically extracted and verified from this document."
                                    : "We extracted the following information from your uploaded file. Please review or adjust any details before confirming to sync them with your profile."}
                            </p>
                        </div>
                    </div>

                    {/* Extracted Details List */}
                    {hasFields ? (
                        <div className="space-y-3.5">
                            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-[16px] text-purple-600">fact_check</span>
                                    Extracted Fields ({fieldEntries.length})
                                </span>
                                {!readOnly && (
                                    <span className="text-[10px] text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                                        ✎ Editable before saving
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                {fieldEntries.map(([key, val]) => {
                                    const meta = fieldDefinitions[key] || {
                                        label: key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
                                        icon: "label",
                                        category: "other" as const,
                                    };

                                    const isMultiline = key === "address" || val.length > 50;
                                    const isLockedName = key === "fullName" && isIdentitySlot;

                                    return (
                                        <div
                                            key={key}
                                            className={`p-3.5 rounded-2xl border transition-all duration-150 ${
                                                readOnly
                                                    ? "bg-slate-50/70 border-slate-200"
                                                    : "bg-white border-slate-200 hover:border-purple-300 focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-100 shadow-sm"
                                            } ${isMultiline ? "md:col-span-2" : ""}`}
                                        >
                                            <div className="flex items-center gap-1.5 mb-1.5">
                                                <span className="material-symbols-outlined text-[15px] text-purple-600">
                                                    {meta.icon}
                                                </span>
                                                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">
                                                    {meta.label}
                                                </label>
                                            </div>

                                            {readOnly ? (
                                                <div className="text-[13px] font-bold text-slate-800 bg-white px-3 py-1.5 rounded-xl border border-slate-100 break-words">
                                                    {val || "—"}
                                                </div>
                                            ) : isLockedName ? (
                                                <div>
                                                    <div className="text-[13px] font-bold text-slate-900 bg-slate-100/90 px-3 py-2 rounded-xl border border-slate-200 flex items-center justify-between select-all cursor-not-allowed">
                                                        <span>{val || "—"}</span>
                                                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-purple-700 bg-purple-100/70 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                            <span className="material-symbols-outlined text-[13px]">lock</span>
                                                            Fixed
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 mt-1 font-medium">
                                                        Official name verified from document — locked to ensure identity consistency.
                                                    </p>
                                                </div>
                                            ) : isMultiline ? (
                                                <textarea
                                                    rows={2}
                                                    value={val}
                                                    onChange={e => handleInputChange(key, e.target.value)}
                                                    className="w-full text-[13px] font-semibold text-slate-900 bg-slate-50/50 hover:bg-slate-50 focus:bg-white rounded-xl px-3 py-2 border border-slate-200 focus:outline-none focus:border-purple-500 resize-none transition-colors"
                                                    placeholder={`Enter ${meta.label.toLowerCase()}`}
                                                />
                                            ) : (
                                                <input
                                                    type="text"
                                                    value={val}
                                                    onChange={e => handleInputChange(key, e.target.value)}
                                                    className="w-full text-[13px] font-semibold text-slate-900 bg-slate-50/50 hover:bg-slate-50 focus:bg-white rounded-xl px-3 py-1.5 border border-slate-200 focus:outline-none focus:border-purple-500 transition-colors"
                                                    placeholder={`Enter ${meta.label.toLowerCase()}`}
                                                />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <span className="material-symbols-outlined text-[36px] text-slate-400 mb-2">document_scanner</span>
                            <p className="text-xs font-bold text-slate-700">Document Authenticated</p>
                            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                                The document file was validated and stored securely in your vault. No textual metadata fields needed auto-synchronization for this document category.
                            </p>
                        </div>
                    )}

                    {/* Sync explanation footer box */}
                    {!readOnly && (
                        <div className="p-3.5 bg-purple-50/60 rounded-2xl border border-purple-100 flex items-center gap-3">
                            <span className="material-symbols-outlined text-[20px] text-purple-700 shrink-0">sync_alt</span>
                            <p className="text-[11px] text-purple-900 font-medium leading-relaxed">
                                Clicking <strong>Confirm & Save Details</strong> will update your student profile, lock your verified identity details, and sync across your active loan applications.
                            </p>
                        </div>
                    )}
                </div>

                {/* Modal Footer Actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 active:scale-95 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                        {readOnly ? "Close" : "Keep Document Only"}
                    </button>

                    {!readOnly && (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={isSaving}
                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#6605c7] to-[#8b5cf6] hover:from-[#5504a6] hover:to-[#7c3aed] text-white text-xs font-extrabold uppercase tracking-wider shadow-lg shadow-purple-600/25 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    <span>Saving Details...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[16px]">task_alt</span>
                                    <span>Confirm & Save Details</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
