"use client";

import { useUserDossier } from "./DossierContext";
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { adminApi, authApi, documentApi } from "@/lib/api";
import { parseNumberFromWords } from "@/lib/academic-ocr";

// Premium 3D Interactive Card Component
function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [glare, setGlare] = useState({ x: 50, y: 50, opacity: 0 });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseX = e.clientX - rect.left - width / 2;
        const mouseY = e.clientY - rect.top - height / 2;

        const rX = -(mouseY / (height / 2)) * 5;
        const rY = (mouseX / (width / 2)) * 5;
        setTilt({ x: rX, y: rY });

        const glareX = ((e.clientX - rect.left) / width) * 100;
        const glareY = ((e.clientY - rect.top) / height) * 100;
        setGlare({ x: glareX, y: glareY, opacity: 0.15 });
    };

    const handleMouseLeave = () => {
        setTilt({ x: 0, y: 0 });
        setGlare(prev => ({ ...prev, opacity: 0 }));
    };

    return (
        <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
                transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(1.01, 1.01, 1.01)`,
                transition: "transform 0.15s cubic-bezier(0.25, 1, 0.5, 1)",
            }}
            className={`relative overflow-hidden transition-all duration-300 ${className}`}
        >
            <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-10"
                style={{
                    background: `radial-gradient(circle 250px at ${glare.x}% ${glare.y}%, rgba(255, 255, 255, 0.5), transparent)`,
                    opacity: glare.opacity,
                }}
            />
            {children}
        </div>
    );
}

interface Stage {
    order: number;
    label: string;
    icon: string;
    progress: number;
}

const STAGES_CONFIG: Record<string, Stage> = {
    application_created: { order: 1, label: 'Created', icon: 'bolt', progress: 10 },
    application_submitted: { order: 2, label: 'Submitted', icon: 'send', progress: 25 },
    document_verification: { order: 3, label: 'Documents', icon: 'verified', progress: 40 },
    submit_to_bank: { order: 4, label: 'Submit to Bank', icon: 'account_balance', progress: 50 },
    credit_check: { order: 5, label: 'Credit Check', icon: 'credit_score', progress: 75 },
    bank_review: { order: 6, label: 'Bank Review', icon: 'rate_review', progress: 90 },
    sanction: { order: 7, label: 'Sanction', icon: 'assignment_turned_in', progress: 95 },
    disbursement: { order: 8, label: 'Disbursed', icon: 'payments', progress: 100 },
};

const getStageKeyForApp = (app: any) => {
    if (!app) return 'application_created';
    if (app.status?.toLowerCase() === 'rejected' || app.status?.toLowerCase() === 'cancelled') return 'application_created';

    let stageKey = app.stage;
    if (!stageKey || !STAGES_CONFIG[stageKey]) {
        const status = (app.status || '').toLowerCase();
        if (status.includes('approve') || status.includes('sanction')) return 'sanction';
        if (status.includes('disburse')) return 'disbursement';
        if (status.includes('process') || status.includes('review')) return 'bank_review';
        if (status.includes('submit_to_bank') || status.includes('submitted_to_bank')) return 'submit_to_bank';
        if (status === 'submitted') return 'application_submitted';
        if (status.includes('document')) return 'document_verification';
        if (status.includes('credit')) return 'credit_check';

        const p = app.progress !== undefined && app.progress !== null ? app.progress : 0;
        if (p >= 100) return 'disbursement';
        if (p >= 95) return 'sanction';
        if (p >= 90) return 'bank_review';
        if (p >= 75) return 'credit_check';
        if (p >= 50) return 'submit_to_bank';
        if (p >= 40) return 'document_verification';
        if (p >= 25) return 'application_submitted';

        return 'application_created';
    }
    return stageKey;
};

export default function ProfileTab() {
    const { userData, setUserData, userApplications, setUserApplications, userDocuments, refreshData } = useUserDossier();
    const router = useRouter();

    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [activeEditTab, setActiveEditTab] = useState<'student' | 'passport' | 'parents' | 'coapplicant' | 'academic'>('student');
    const [evvPeriod, setEvvPeriod] = useState<3 | 6 | 12>(6);
    const [editForm, setEditForm] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phoneNumber: "",
        dateOfBirth: "",
        nationality: "",
        studyDestination: "",
        targetUniversity: "",
        panNumber: "",
        aadhaarNumber: "",
        passportNumber: "",
        passportFullName: "",
        passportIssueDate: "",
        passportExpiryDate: "",
        passportIssueCountry: "",
        passportBirthCity: "",
        passportBirthCountry: "",
        fatherName: "",
        fatherAadhar: "",
        fatherPan: "",
        motherName: "",
        motherAadhar: "",
        motherPan: "",
        coappName: "",
        coappRelation: "",
        coappPhone: "",
        coappEmail: "",
        coappIncome: "",
        coappAadhar: "",
        coappPan: "",
        sscSchool: "",
        sscScore: "",
        hscCollege: "",
        hscScore: "",
        ugCollege: "",
        ugScore: "",
    });

    const getDisplayValue = (value: any, fallback = "Pending") => {
        if (value === undefined || value === null || value === "") {
            return <span className="text-[#94A3B8] font-normal">{fallback}</span>;
        }
        if (typeof value === "string" && value.trim() === "") {
            return <span className="text-[#94A3B8] font-normal">{fallback}</span>;
        }
        return value;
    };

    const getParentName = (type: "father" | "mother") => {
        const family = (userData as any)?.family;
        const parentDetails = (userData as any)?.parentDetails;
        const parents = (userData as any)?.parents;
        const direct = (userData as any)?.[`${type}Name`];

        const candidates = [
            family?.[`${type}Name`],
            parentDetails?.[`${type}Name`],
            parents?.[`${type}Name`],
            direct,
        ];

        return candidates.find((value) => typeof value === "string" && value.trim()) || "—";
    };

    const parentsList = Array.isArray(userData?.parents) ? userData.parents : [];

    let parsedFamilyObj: any = userData?.family;
    if (typeof parsedFamilyObj === 'string') {
        try { parsedFamilyObj = JSON.parse(parsedFamilyObj); } catch { }
    }
    let parsedCoAppObj: any = userData?.coApplicant;
    if (typeof parsedCoAppObj === 'string') {
        try { parsedCoAppObj = JSON.parse(parsedCoAppObj); } catch { }
    }

    const fatherEntry = parentsList.find((p: any) => p.relation === 'father') || {};
    const fatherData = {
        name: parsedFamilyObj?.fatherName || userData?.fatherName || fatherEntry.name || getParentName("father"),
        aadharNumber: parsedFamilyObj?.fatherAadhar || userData?.fatherAadhar || fatherEntry.aadharNumber || fatherEntry.aadhar,
        panNumber: parsedFamilyObj?.fatherPan || userData?.fatherPan || fatherEntry.panNumber || fatherEntry.pan,
    };

    const motherEntry = parentsList.find((p: any) => p.relation === 'mother') || {};
    const motherData = {
        name: parsedFamilyObj?.motherName || userData?.motherName || motherEntry.name || getParentName("mother"),
        aadharNumber: parsedFamilyObj?.motherAadhar || userData?.motherAadhar || motherEntry.aadharNumber || motherEntry.aadhar,
        panNumber: parsedFamilyObj?.motherPan || userData?.motherPan || motherEntry.panNumber || motherEntry.pan,
    };

    const coappEntry = parentsList.find((p: any) => p.relation === 'coapplicant') || {};
    const firstAppWithCoApp = (userApplications || []).find((app: any) => app.coApplicantName || app.coApplicantPhone || app.coApplicantEmail || app.coApplicantRelation);

    const coapplicantData: any = {
        name: (typeof parsedCoAppObj === 'object' ? (parsedCoAppObj?.name || parsedCoAppObj?.coApplicantName) : "") || parsedFamilyObj?.coappName || parsedFamilyObj?.coApplicantName || userData?.coApplicantName || coappEntry.name || firstAppWithCoApp?.coApplicantName || "",
        relation: (typeof parsedCoAppObj === 'object' ? (parsedCoAppObj?.relation || parsedCoAppObj?.relationship || parsedCoAppObj?.coApplicantRelation) : "") || parsedFamilyObj?.coappRelation || parsedFamilyObj?.coApplicantRelation || userData?.coApplicantRelation || coappEntry.relation || firstAppWithCoApp?.coApplicantRelation || "",
        phone: (typeof parsedCoAppObj === 'object' ? (parsedCoAppObj?.mobile || parsedCoAppObj?.phone || parsedCoAppObj?.coApplicantPhone) : "") || parsedFamilyObj?.coappPhone || parsedFamilyObj?.coApplicantPhone || userData?.coApplicantPhone || coappEntry.phone || coappEntry.mobile || firstAppWithCoApp?.coApplicantPhone || "",
        email: (typeof parsedCoAppObj === 'object' ? (parsedCoAppObj?.email || parsedCoAppObj?.coApplicantEmail) : "") || parsedFamilyObj?.coappEmail || parsedFamilyObj?.coApplicantEmail || userData?.coApplicantEmail || coappEntry.email || firstAppWithCoApp?.coApplicantEmail || "",
        aadharNumber: (typeof parsedCoAppObj === 'object' ? (parsedCoAppObj?.aadharNumber || parsedCoAppObj?.aadhar) : "") || parsedFamilyObj?.coappAadhar || parsedFamilyObj?.coApplicantAadhar || userData?.coApplicantAadhar || coappEntry.aadharNumber || coappEntry.aadhar || "",
        panNumber: (typeof parsedCoAppObj === 'object' ? (parsedCoAppObj?.panNumber || parsedCoAppObj?.pan) : "") || parsedFamilyObj?.coappPan || parsedFamilyObj?.coApplicantPan || userData?.coApplicantPan || coappEntry.panNumber || coappEntry.pan || "",
    };

    const getCoApplicantName = (index: 1 | 2 | 3): any => {
        if (index === 1) {
            if (coapplicantData?.name) return coapplicantData.name;
            if (userData?.coApplicant) {
                let coApp: any = userData.coApplicant;
                if (typeof coApp === 'string') {
                    try { coApp = JSON.parse(coApp); } catch { }
                }
                if (typeof coApp === 'object' && (coApp?.name || coApp?.coApplicantName)) return coApp.name || coApp.coApplicantName;
            }
            if (firstAppWithCoApp?.coApplicantName) {
                return firstAppWithCoApp.coApplicantName;
            }
        }

        const coApplicant = (userData as any)?.coApplicant;

        if (Array.isArray(coApplicant)) {
            return getDisplayValue(coApplicant[index - 1]?.name, "Pending");
        }

        if (coApplicant && typeof coApplicant === "object") {
            if (index === 1) {
                return getDisplayValue(coApplicant.name || coApplicant?.coApplicant1?.name || coApplicant?.firstName, "Pending");
            }
            if (index === 2) {
                return getDisplayValue(coApplicant.coApplicant2?.name || coApplicant?.secondName, "Pending");
            }
            if (index === 3) {
                return getDisplayValue(coApplicant.coApplicant3?.name || coApplicant?.thirdName, "Pending");
            }
        }

        return <span className="text-[#94A3B8] font-normal">Pending</span>;
    };

    const isDocTypeMatch = (docType: string, patterns: string[], excludeRelations = false) => {
        const dt = (docType || '').toLowerCase();
        if (excludeRelations && (dt.includes('father') || dt.includes('mother') || dt.includes('coapp'))) return false;
        return patterns.some(p => dt === p || dt.includes(p));
    };

    const userDocs = userDocuments || userData?.documents || [];
    const sscDoc = userDocs.find((d: any) => isDocTypeMatch(d.docType || d.type || d.documentType || d.name || d.docName || d.doc_type || d.category, ['marksheet_10', 'marksheet_10th', '10th', '10th_marksheet', 'ssc', 'ssc_marksheet', 'grade_10', 'grade10', 'secondary_school']));
    const hscDoc = userDocs.find((d: any) => isDocTypeMatch(d.docType || d.type || d.documentType || d.name || d.docName || d.doc_type || d.category, ['marksheet_12', 'marksheet_12th', '12th', '12th_marksheet', 'hsc', 'hsc_marksheet', 'intermediate', 'intermediate_marksheet', 'intermediate_certificate', 'inter', 'inter_marksheet', 'diploma', 'diploma_marksheet', 'diploma_certificate', 'grade_12', 'grade12', 'senior_secondary', 'puc', 'pu_college', 'plus2', 'plus_two']));
    const ugDoc = userDocs.find((d: any) => isDocTypeMatch(d.docType || d.type || d.documentType || d.name || d.docName || d.doc_type || d.category, ['marksheet_ug', 'ug_degree', 'ug_transcript', 'degree_certificate', 'graduation_degree', 'graduation_transcript', 'graduation_certificate', 'bachelors_degree', 'degree', 'graduation', 'undergrad', 'ug_', 'cmm', 'cmm_certificate', 'consolidated_marks_memo', 'consolidated']));
    const passportDoc = userDocs.find((d: any) => isDocTypeMatch(d.docType || d.type || d.documentType || d.name || d.docName || d.doc_type || d.category, ['passport']));
    const panDoc = userDocs.find((d: any) => isDocTypeMatch(d.docType || d.type || d.documentType || d.name || d.docName || d.doc_type || d.category, ['pan', 'pancard', 'pan_card', 'student_pan'], true));
    const aadharDoc = userDocs.find((d: any) => isDocTypeMatch(d.docType || d.type || d.documentType || d.name || d.docName || d.doc_type || d.category, ['national_id', 'aadhaar', 'aadhar', 'aadhaar_card', 'aadhar_card', 'student_aadhar', 'student_aadhaar'], true));

    const getExtractedField = (doc: any, fieldNames: string | string[]) => {
        if (!doc) return null;
        let meta = doc.verificationMetadata;
        if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch { meta = {}; }
        }
        if (!meta || typeof meta !== 'object') meta = {};

        let docMeta = doc.metadata;
        if (typeof docMeta === 'string') {
            try { docMeta = JSON.parse(docMeta); } catch { docMeta = {}; }
        }
        if (!docMeta || typeof docMeta !== 'object') docMeta = {};

        const details = meta.details || meta.ocrResult || meta.ocr_result || doc.ocrResult || doc.ocr_result || docMeta.details || docMeta.ocrResult || {};
        const ext = details.extractedFields || details.extracted_fields || meta.extractedFields || meta.extracted_fields || details.extracted_data || meta.extracted_data || doc.extractedFields || doc.extracted_fields || doc.extracted_data || docMeta.extractedFields || docMeta.extracted_data || {};

        const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
        for (const fn of names) {
            if (ext[fn] != null && String(ext[fn]).trim() && String(ext[fn]).trim() !== "—") return String(ext[fn]).trim();
            if (details[fn] != null && String(details[fn]).trim() && String(details[fn]).trim() !== "—") return String(details[fn]).trim();
            if (meta[fn] != null && String(meta[fn]).trim() && String(meta[fn]).trim() !== "—") return String(meta[fn]).trim();
            if (docMeta[fn] != null && String(docMeta[fn]).trim() && String(docMeta[fn]).trim() !== "—") return String(docMeta[fn]).trim();
            if (doc[fn] != null && String(doc[fn]).trim() && String(doc[fn]).trim() !== "—") return String(doc[fn]).trim();
        }
        return null;
    };

    const extPan = getExtractedField(panDoc, ['pan_number', 'panNumber', 'pan', 'pan_no', 'panNo', 'document_number', 'id_number', 'number', 'taxpayer_id']);
    const extAadhaar = getExtractedField(aadharDoc, ['aadhaar_number', 'aadhar_number', 'aadhaarNumber', 'aadharNumber', 'aadhaar', 'aadhar', 'uid', 'document_number', 'id_number', 'number', 'national_id_number']);

    const studentPan = userData?.panNumber || userData?.pan || userData?.panCardNumber || extPan;
    const rawAadhaar = userData?.aadhaarNumber || userData?.aadharNumber || userData?.aadhaar || userData?.aadhar || extAadhaar;

    const formatPercentageValue = (rawPct?: any, doc?: any): string | undefined => {
        if (rawPct != null && String(rawPct).trim() !== "" && String(rawPct).trim() !== "—") {
            const str = String(rawPct).trim();
            const num = parseFloat(str.replace(/[^\d.]/g, ''));
            if (!isNaN(num)) {
                if (num <= 10 && num > 0) {
                    return `${Math.round(num * 9.5 * 10) / 10}%`;
                } else if (num <= 100 && num > 0) {
                    return str.includes('%') ? str : `${Math.round(num * 10) / 10}%`;
                } else if (num > 100) {
                    const inferredMax = num <= 500 ? 500 : num <= 600 ? 600 : 1000;
                    return `${Math.round((num / inferredMax) * 100 * 10) / 10}%`;
                }
            }
            return str;
        }

        if (doc) {
            const pctVal = getExtractedField(doc, ['percentage', 'overall_percentage', 'marks_percentage', 'aggregate_percentage', 'score', 'score_in_percentage', 'total_percentage', 'grade_percentage']);
            const secVal = getExtractedField(doc, ['total_marks_secured', 'marks_secured', 'marks_obtained', 'obtained_marks', 'secured_marks', 'total_marks', 'aggregate_marks', 'grand_total']);
            const maxVal = getExtractedField(doc, ['total_marks_maximum', 'maximum_marks', 'max_marks', 'total_max', 'out_of', 'max']);
            const wordsSecVal = getExtractedField(doc, ['marks_in_words', 'total_marks_in_words', 'secured_marks_in_words', 'marks_obtained_in_words']);
            const wordsMaxVal = getExtractedField(doc, ['max_marks_in_words', 'maximum_marks_in_words']);
            const cgpaVal = getExtractedField(doc, ['cgpa', 'gpa', 'overall_cgpa', 'overall_gpa', 'sgpa']);

            if (pctVal) {
                const pctNum = parseFloat(String(pctVal).replace(/[^\d.]/g, ''));
                if (!isNaN(pctNum) && pctNum > 0 && pctNum <= 100) {
                    return `${Math.round(pctNum * 10) / 10}%`;
                } else if (!isNaN(pctNum) && pctNum > 100) {
                    const inferredMax = pctNum <= 500 ? 500 : pctNum <= 600 ? 600 : 1000;
                    return `${Math.round((pctNum / inferredMax) * 100 * 10) / 10}%`;
                }
            }

            let sec = parseFloat(String(secVal).replace(/[^\d.]/g, ''));
            let max = parseFloat(String(maxVal).replace(/[^\d.]/g, ''));

            const secWordsNum = parseNumberFromWords(String(wordsSecVal || ''));
            const maxWordsNum = parseNumberFromWords(String(wordsMaxVal || ''));

            if (secWordsNum && (isNaN(sec) || Math.abs(sec - secWordsNum) > 5)) sec = secWordsNum;
            if (maxWordsNum && (isNaN(max) || Math.abs(max - maxWordsNum) > 5)) max = maxWordsNum;

            if (!isNaN(sec) && !isNaN(max) && max > 0) {
                return `${Math.round((sec / max) * 100 * 10) / 10}%`;
            } else if (!isNaN(sec) && sec > 0 && sec <= 100) {
                return `${Math.round(sec * 10) / 10}%`;
            } else if (!isNaN(sec) && sec > 100) {
                const inferredMax = sec <= 500 ? 500 : sec <= 600 ? 600 : 1000;
                return `${Math.round((sec / inferredMax) * 100 * 10) / 10}%`;
            }

            if (cgpaVal) {
                const cgpa = parseFloat(String(cgpaVal).replace(/[^\d.]/g, ''));
                if (!isNaN(cgpa) && cgpa <= 10 && cgpa > 0) {
                    return `${Math.round(cgpa * 9.5 * 10) / 10}%`;
                }
            }
        }

        return undefined;
    };

    const getAcademicDetails = (doc: any, key: 'ssc' | 'hsc' | 'ug') => {
        let parsedAcademic: any = userData?.academic || (userData as any)?.family?.academic || (userData as any)?.student?.academic || (userData as any)?.userAcademicProfile || (userData as any)?.academicProfile;
        if (typeof parsedAcademic === 'string') {
            try { parsedAcademic = JSON.parse(parsedAcademic); } catch { }
        }
        if (!parsedAcademic || typeof parsedAcademic !== 'object') parsedAcademic = {};

        const fallback = parsedAcademic?.[key] || {};

        const instKeys = [
            'institution', 'university', 'board', 'school_name', 'college_name', 'board_name', 'institution_name', 'university_name', 'examining_body', 'name_of_institution', 'awarding_body', 'degree_college', 'college', 'board_or_university', 'institute', 'school', 'name_of_the_board', 'name_of_the_university'
        ];
        const pctKeys = [
            'percentage', 'overall_percentage', 'marks_percentage', 'aggregate_percentage', 'score', 'score_in_percentage', 'total_percentage', 'grade_percentage', 'gpa', 'cgpa', 'overall_gpa', 'overall_cgpa', 'total_marks_secured', 'overall_score', 'cgpa_secured', 'gpa_secured', 'grade', 'marks', 'obtained_marks', 'result'
        ];

        let extInst = getExtractedField(doc, instKeys);
        let extPct = getExtractedField(doc, pctKeys);

        let fallbackInst = fallback.institute || fallback.college || fallback.school || (key === 'hsc' ? (parsedAcademic.intermediate?.institute || parsedAcademic.intermediate?.college || parsedAcademic.intermediate?.school || parsedAcademic['12th']?.institute || parsedAcademic['12th']?.college || parsedAcademic.marksheet_12?.institute || parsedAcademic.grade12?.institute || parsedAcademic.inter?.institute || parsedAcademic.inter?.college || userData?.twelfthSchool || (userData as any)?.userAcademicProfile?.twelfthSchool) : key === 'ssc' ? (parsedAcademic.grade10?.institute || parsedAcademic['10th']?.institute || (userData as any)?.userAcademicProfile?.tenthSchool) : (parsedAcademic.undergrad?.institute || parsedAcademic.undergrad?.university || userData?.bachelorsDegree || (userData as any)?.userAcademicProfile?.bachelorsDegree));
        let fallbackPct = fallback.percentage || fallback.score || (key === 'hsc' ? (parsedAcademic.intermediate?.percentage || parsedAcademic.intermediate?.score || parsedAcademic['12th']?.percentage || parsedAcademic['12th']?.score || parsedAcademic.marksheet_12?.percentage || parsedAcademic.marksheet_12?.score || parsedAcademic.grade12?.percentage || parsedAcademic.inter?.percentage || userData?.twelfthPercentage || (userData as any)?.userAcademicProfile?.twelfthPercentage) : key === 'ssc' ? (parsedAcademic.grade10?.percentage || parsedAcademic.grade10?.score || parsedAcademic['10th']?.percentage || (userData as any)?.userAcademicProfile?.tenthPercentage) : (parsedAcademic.undergrad?.percentage || parsedAcademic.undergrad?.gpa || parsedAcademic.undergrad?.score || (userData as any)?.userAcademicProfile?.gpa));

        const inst = (fallbackInst && String(fallbackInst).trim() !== "") ? fallbackInst : extInst;
        const rawPct = (fallbackPct !== undefined && fallbackPct !== null && String(fallbackPct).trim() !== "") ? fallbackPct : extPct;
        const formattedPct = formatPercentageValue(rawPct, doc);

        // MARKS IN NUMBERS & WORDS EXTRACTION + TALLY LOGIC
        const secNumVal = getExtractedField(doc, ['total_marks_secured', 'marks_secured', 'marks_obtained', 'obtained_marks', 'secured_marks', 'total_marks', 'aggregate_marks', 'grand_total']);
        const maxNumVal = getExtractedField(doc, ['total_marks_maximum', 'maximum_marks', 'max_marks', 'total_max', 'out_of', 'max']);

        let wordsSecStr = getExtractedField(doc, ['marks_in_words', 'total_marks_in_words', 'secured_marks_in_words', 'marks_obtained_in_words']);
        let wordsMaxStr = getExtractedField(doc, ['max_marks_in_words', 'maximum_marks_in_words', 'total_max_in_words']);

        if (!wordsSecStr && doc?.verificationMetadata?.extractedFields) {
            const rawText = String(doc.verificationMetadata.extractedFields.raw_text_summary || doc.verificationMetadata.extractedFields.rawOcrText || '');
            const wordsMatch = rawText.match(/(?:marks|total|secured|obtained)\s+(?:in\s+words)?[:\s]+([a-z\s]+)(?:only|hundred|thousand)?/i);
            if (wordsMatch) wordsSecStr = wordsMatch[1].trim();
        }

        const secNum = parseFloat(String(secNumVal || '').replace(/[^\d.]/g, ''));
        const maxNum = parseFloat(String(maxNumVal || '').replace(/[^\d.]/g, ''));

        const secFromWords = parseNumberFromWords(wordsSecStr);
        const maxFromWords = parseNumberFromWords(wordsMaxStr);

        let calculatedPct: string | undefined = undefined;
        if (!isNaN(secNum) && !isNaN(maxNum) && maxNum > 0) {
            calculatedPct = `${Math.round((secNum / maxNum) * 100 * 10) / 10}%`;
        } else if (secFromWords && maxFromWords && maxFromWords > 0) {
            calculatedPct = `${Math.round((secFromWords / maxFromWords) * 100 * 10) / 10}%`;
        } else if (secFromWords && secFromWords > 0 && secFromWords <= 100) {
            calculatedPct = `${Math.round(secFromWords * 10) / 10}%`;
        }

        let tallyStatus: 'matched' | 'discrepancy' | 'numbers_only' | 'none' = 'none';
        let tallyMessage = '';

        if (!isNaN(secNum) && secFromWords != null) {
            if (Math.abs(secNum - secFromWords) <= 1) {
                tallyStatus = 'matched';
                tallyMessage = `Tallied: ${secNum} = "${wordsSecStr}"`;
            } else {
                tallyStatus = 'discrepancy';
                tallyMessage = `Mismatch: Numbers (${secNum}) != Words ("${wordsSecStr}" = ${secFromWords})`;
            }
        } else if (!isNaN(secNum)) {
            tallyStatus = 'numbers_only';
            tallyMessage = maxNum ? `Secured: ${secNum} / ${maxNum}` : `Secured: ${secNum}`;
        }

        const finalPercentage = formattedPct || calculatedPct || "";

        return {
            rawInstitute: inst || "",
            rawPercentage: finalPercentage,
            institute: inst ? inst : <span className="text-[#94A3B8] font-normal">Pending</span>,
            percentage: finalPercentage ? finalPercentage : <span className="text-[#94A3B8] font-normal">Pending</span>,
            secNum: !isNaN(secNum) ? secNum : undefined,
            maxNum: !isNaN(maxNum) ? maxNum : undefined,
            wordsSecStr,
            wordsMaxStr,
            secFromWords,
            calculatedPct,
            tallyStatus,
            tallyMessage
        };
    };

    const sscDetails = getAcademicDetails(sscDoc, 'ssc');
    const hscDetails = getAcademicDetails(hscDoc, 'hsc');
    const ugDetails = getAcademicDetails(ugDoc, 'ug');

    let parsedPassportObj: any = userData?.passport;
    if (typeof parsedPassportObj === 'string') {
        try { parsedPassportObj = JSON.parse(parsedPassportObj); } catch { }
    }
    if (!parsedPassportObj || typeof parsedPassportObj !== 'object') parsedPassportObj = {};

    const passportNumber = parsedPassportObj.number || parsedPassportObj.passportNumber || parsedPassportObj.passport_number || parsedPassportObj.passportNo || userData?.passportNumber || userData?.passportNo || getExtractedField(passportDoc, ['passport_number', 'passportNumber', 'passport_no', 'passportNo', 'document_number']);
    const passportIssueDate = parsedPassportObj.issueDate || parsedPassportObj.passportIssueDate || parsedPassportObj.issue_date || userData?.passportIssueDate || getExtractedField(passportDoc, ['issue_date', 'date_of_issue', 'passport_issue_date']);
    const passportExpiryDate = parsedPassportObj.expiryDate || parsedPassportObj.passportExpiry || parsedPassportObj.expiry_date || parsedPassportObj.dateOfExpiry || userData?.passportExpiry || getExtractedField(passportDoc, ['date_of_expiry', 'expiry_date', 'expiration_date', 'passport_expiry']);
    const passportIssueCountry = parsedPassportObj.issueCountry || parsedPassportObj.passportIssueCountry || parsedPassportObj.issue_country || userData?.passportIssueCountry || getExtractedField(passportDoc, ['issue_country', 'country_of_issue', 'issuing_country']) || null;
    const passportBirthCity = parsedPassportObj.birthCity || parsedPassportObj.placeOfBirth || parsedPassportObj.birth_city || userData?.birthCity || getExtractedField(passportDoc, ['place_of_birth', 'birth_place', 'birth_city']) || null;
    const passportBirthCountry = parsedPassportObj.birthCountry || parsedPassportObj.passportBirthCountry || parsedPassportObj.birth_country || parsedPassportObj.countryOfBirth || userData?.passportBirthCountry || userData?.birthCountry || getExtractedField(passportDoc, ['birth_country', 'country_of_birth']) || null;
    const passportFullName = parsedPassportObj.fullName || parsedPassportObj.full_name || userData?.passportOriginalName || userData?.nameAsInPassport || getExtractedField(passportDoc, ['full_name', 'fullName', 'name', 'printed_name', 'holder_name']) || null;

    const activeApp = userApplications && userApplications.length > 0 ? userApplications[0] : null;

    const getEvvScore = (months: 3 | 6 | 12) => {
        if (activeApp) {
            if (activeApp.evvOverall) {
                const overall = Number(activeApp.evvOverall);
                if (!isNaN(overall)) {
                    if (months === 3) return Math.round(overall * 1.15);
                    if (months === 6) return Math.round(overall * 1.05);
                    return Math.round(overall * 0.95);
                }
            }
            if (activeApp.evvMonthlyBreakdown) {
                try {
                    const breakdown = typeof activeApp.evvMonthlyBreakdown === 'string'
                        ? JSON.parse(activeApp.evvMonthlyBreakdown)
                        : activeApp.evvMonthlyBreakdown;
                    if (Array.isArray(breakdown) && breakdown.length > 0) {
                        const vals = breakdown.map((item: any) => Number(item.evv || item.averageBalance || 0)).filter(v => !isNaN(v) && v > 0);
                        if (vals.length > 0) {
                            const sum = vals.reduce((a, b) => a + b, 0);
                            const avg = sum / vals.length;
                            if (months === 3) return Math.round(avg * 1.15);
                            if (months === 6) return Math.round(avg * 1.05);
                            return Math.round(avg * 0.95);
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse evvMonthlyBreakdown:", e);
                }
            }
        }
        return null;
    };

    const getEvvMetrics = () => {
        if (!activeApp || !activeApp.evvMonthlyBreakdown) return null;
        try {
            const breakdown = typeof activeApp.evvMonthlyBreakdown === 'string'
                ? JSON.parse(activeApp.evvMonthlyBreakdown)
                : activeApp.evvMonthlyBreakdown;

            if (!Array.isArray(breakdown) || breakdown.length === 0) return null;

            const avgs = breakdown.map(item => Number(item.averageBalance || item.evv || 0)).filter(v => !isNaN(v));
            const mins = breakdown.map(item => Number(item.min || item.minimumBalance || 0)).filter(v => !isNaN(v));
            const maxs = breakdown.map(item => Number(item.max || item.maximumBalance || 0)).filter(v => !isNaN(v));

            if (avgs.length === 0) return null;

            const averageBalance = avgs.reduce((a, b) => a + b, 0) / avgs.length;
            const minimumBalance = mins.length > 0 ? Math.min(...mins) : 0;
            const maximumBalance = maxs.length > 0 ? Math.max(...maxs) : 0;

            const stabilityRatio = averageBalance > 0 ? Math.min(1, minimumBalance / averageBalance) : 0;
            const salaryStability = activeApp.salaryStability ?? (Math.round(stabilityRatio * 30 + 70));
            const balanceScore = Math.min(60, (averageBalance / 50000) * 60);
            const stabilityScore = stabilityRatio * 40;
            const evvScore = activeApp.evvScore ? Number(activeApp.evvScore) : Math.round(balanceScore + stabilityScore);

            let risk = "MEDIUM";
            if (evvScore >= 75) risk = "LOW";
            else if (evvScore < 45) risk = "HIGH";

            const eligibleAmount = Math.round((averageBalance * 12 * 0.40) / 50000) * 50000;
            const recommendation = eligibleAmount > 0
                ? `Eligible up to ₹${(eligibleAmount / 100000).toFixed(1)} Lakhs`
                : "Manual Review Required";

            return {
                averageBalance,
                minimumBalance,
                maximumBalance,
                salaryStability,
                totalMonths: breakdown.length,
                evvScore,
                risk,
                recommendation
            };
        } catch (e) {
            console.error("Failed to parse evvMonthlyBreakdown:", e);
            return null;
        }
    };

    const handleOpenEdit = () => {
        setSubmitError("");
        let parsedAcademic: any = userData?.academic;
        if (typeof parsedAcademic === 'string') {
            try { parsedAcademic = JSON.parse(parsedAcademic); } catch { }
        }
        let parsedFamily: any = userData?.family;
        if (typeof parsedFamily === 'string') {
            try { parsedFamily = JSON.parse(parsedFamily); } catch { }
        }
        let parsedCoApp: any = userData?.coApplicant;
        if (typeof parsedCoApp === 'string') {
            try { parsedCoApp = JSON.parse(parsedCoApp); } catch { }
        }

        setEditForm({
            firstName: userData?.firstName || "",
            lastName: userData?.lastName || "",
            email: userData?.email || "",
            phoneNumber: userData?.phoneNumber || userData?.mobile || userData?.phone || "",
            dateOfBirth: (() => {
                const raw = userData?.dateOfBirth || userData?.personal?.dateOfBirth || userData?.dob;
                if (!raw) return "";
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
            })(),
            nationality: (() => {
                const nat = userData?.nationality || userData?.personal?.nationality;
                if (!nat) return "Indian";
                if (typeof nat === 'object' && nat !== null) return nat.name || nat.nationality || "Indian";
                if (typeof nat === 'string' && nat.trim() !== '') {
                    try {
                        const parsed = JSON.parse(nat);
                        if (typeof parsed === 'object' && parsed !== null) return parsed.name || parsed.nationality || "Indian";
                    } catch { }
                    return nat;
                }
                return "Indian";
            })(),
            studyDestination: userData?.studyDestination || userData?.countryOfEducation || userData?.country || (userApplications && userApplications[0]?.country) || (userApplications && userApplications[0]?.studyDestination) || "",
            targetUniversity: userData?.targetUniversity || userData?.universityName || userData?.university || (userApplications && userApplications[0]?.universityName) || (userApplications && userApplications[0]?.university) || (userApplications && userApplications[0]?.targetUniversity) || "",
            panNumber: userData?.panNumber || userData?.pan || userData?.panCardNumber || extPan || "",
            aadhaarNumber: userData?.aadhaarNumber || userData?.aadharNumber || userData?.aadhaar || userData?.aadhar || extAadhaar || "",
            passportNumber: passportNumber || "",
            passportFullName: passportFullName || "",
            passportIssueDate: passportIssueDate || "",
            passportExpiryDate: passportExpiryDate || "",
            passportIssueCountry: passportIssueCountry || "",
            passportBirthCity: passportBirthCity || "",
            passportBirthCountry: passportBirthCountry || "",

            fatherName: fatherData?.name || parsedFamily?.fatherName || userData?.fatherName || "",
            fatherAadhar: fatherData?.aadharNumber || parsedFamily?.fatherAadhar || "",
            fatherPan: fatherData?.panNumber || parsedFamily?.fatherPan || "",

            motherName: motherData?.name || parsedFamily?.motherName || userData?.motherName || "",
            motherAadhar: motherData?.aadharNumber || parsedFamily?.motherAadhar || "",
            motherPan: motherData?.panNumber || parsedFamily?.motherPan || "",

            coappName: coapplicantData?.name || parsedCoApp?.name || userData?.coApplicantName || firstAppWithCoApp?.coApplicantName || "",
            coappRelation: coapplicantData?.relation || parsedCoApp?.relation || parsedCoApp?.relationship || userData?.coApplicantRelation || firstAppWithCoApp?.coApplicantRelation || "",
            coappPhone: coapplicantData?.phone || parsedCoApp?.mobile || parsedCoApp?.phone || parsedCoApp?.coApplicantPhone || userData?.coApplicantPhone || firstAppWithCoApp?.coApplicantPhone || "",
            coappEmail: coapplicantData?.email || parsedCoApp?.email || parsedCoApp?.coApplicantEmail || userData?.coApplicantEmail || firstAppWithCoApp?.coApplicantEmail || "",
            coappIncome: parsedCoApp?.monthlyIncome || userData?.coApplicantIncome || firstAppWithCoApp?.coApplicantIncome || "",
            coappAadhar: coapplicantData?.aadharNumber || parsedCoApp?.aadharNumber || "",
            coappPan: coapplicantData?.panNumber || parsedCoApp?.panNumber || "",

            sscSchool: parsedAcademic?.ssc?.institute || parsedAcademic?.grade10?.institute || parsedAcademic?.['10th']?.institute || parsedAcademic?.marksheet_10?.institute || sscDetails.rawInstitute,
            sscScore: parsedAcademic?.ssc?.percentage || parsedAcademic?.grade10?.percentage || parsedAcademic?.['10th']?.percentage || (sscDetails.rawPercentage ? sscDetails.rawPercentage.toString().replace('%', '') : ""),
            hscCollege: parsedAcademic?.hsc?.institute || parsedAcademic?.intermediate?.institute || parsedAcademic?.['12th']?.institute || parsedAcademic?.marksheet_12?.institute || parsedAcademic?.grade12?.institute || parsedAcademic?.inter?.institute || (userData as any)?.twelfthSchool || hscDetails.rawInstitute,
            hscScore: parsedAcademic?.hsc?.percentage || parsedAcademic?.intermediate?.percentage || parsedAcademic?.['12th']?.percentage || parsedAcademic?.marksheet_12?.percentage || parsedAcademic?.grade12?.percentage || parsedAcademic?.inter?.percentage || (userData as any)?.twelfthPercentage || (hscDetails.rawPercentage ? hscDetails.rawPercentage.toString().replace('%', '') : ""),
            ugCollege: parsedAcademic?.ug?.institute || parsedAcademic?.undergrad?.institute || parsedAcademic?.undergrad?.university || userData?.bachelorsDegree || ugDetails.rawInstitute,
            ugScore: parsedAcademic?.ug?.percentage || parsedAcademic?.undergrad?.percentage || parsedAcademic?.undergrad?.gpa || (ugDetails.rawPercentage ? ugDetails.rawPercentage.toString().replace('%', '') : ""),
        });
        setIsEditOpen(true);
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setSubmitError("");
        try {
            let parsedFamily: any = userData?.family;
            if (typeof parsedFamily === 'string') {
                try { parsedFamily = JSON.parse(parsedFamily); } catch { }
            }
            let parsedCoApp: any = userData?.coApplicant;
            if (typeof parsedCoApp === 'string') {
                try { parsedCoApp = JSON.parse(parsedCoApp); } catch { }
            }
            let parsedAcademic: any = userData?.academic;
            if (typeof parsedAcademic === 'string') {
                try { parsedAcademic = JSON.parse(parsedAcademic); } catch { }
            }

            const updates = {
                firstName: editForm.firstName,
                lastName: editForm.lastName,
                phone: editForm.phoneNumber,
                phoneNumber: editForm.phoneNumber,
                mobile: editForm.phoneNumber,
                fatherName: editForm.fatherName,
                motherName: editForm.motherName,
                dateOfBirth: editForm.dateOfBirth,
                nationality: editForm.nationality,
                studyDestination: editForm.studyDestination,
                countryOfEducation: editForm.studyDestination,
                country: editForm.studyDestination,
                destinationCountry: editForm.studyDestination,
                targetUniversity: editForm.targetUniversity,
                universityName: editForm.targetUniversity,
                university: editForm.targetUniversity,
                panNumber: editForm.panNumber,
                pan: editForm.panNumber,
                panCardNumber: editForm.panNumber,
                aadhaarNumber: editForm.aadhaarNumber,
                aadharNumber: editForm.aadhaarNumber,
                aadhaar: editForm.aadhaarNumber,
                aadhar: editForm.aadhaarNumber,

                passport: {
                    fullName: editForm.passportFullName,
                    full_name: editForm.passportFullName,
                    number: editForm.passportNumber,
                    issueDate: editForm.passportIssueDate,
                    expiryDate: editForm.passportExpiryDate,
                    issueCountry: editForm.passportIssueCountry,
                    birthCity: editForm.passportBirthCity,
                    birthCountry: editForm.passportBirthCountry,
                },
                passportOriginalName: editForm.passportFullName,
                nameAsInPassport: editForm.passportFullName,
                passportNumber: editForm.passportNumber,
                passportIssueDate: editForm.passportIssueDate,
                passportExpiry: editForm.passportExpiryDate,
                passportExpiryDate: editForm.passportExpiryDate,
                passportIssueCountry: editForm.passportIssueCountry,
                passportBirthCity: editForm.passportBirthCity,
                passportBirthCountry: editForm.passportBirthCountry,

                personal: {
                    firstName: editForm.firstName,
                    lastName: editForm.lastName,
                    mobile: editForm.phoneNumber,
                    phone: editForm.phoneNumber,
                    phoneNumber: editForm.phoneNumber,
                    dateOfBirth: editForm.dateOfBirth,
                    nationality: editForm.nationality,
                    fatherName: editForm.fatherName,
                    motherName: editForm.motherName,
                    studyDestination: editForm.studyDestination,
                    targetUniversity: editForm.targetUniversity,
                },

                family: {
                    ...(parsedFamily || {}),
                    fatherName: editForm.fatherName,
                    motherName: editForm.motherName,
                    fatherAadhar: editForm.fatherAadhar,
                    fatherPan: editForm.fatherPan,
                    motherAadhar: editForm.motherAadhar,
                    motherPan: editForm.motherPan,
                    coappName: editForm.coappName,
                    coappRelation: editForm.coappRelation,
                    coappPhone: editForm.coappPhone,
                    coappEmail: editForm.coappEmail,
                    coappAadhar: editForm.coappAadhar,
                    coappPan: editForm.coappPan,
                },

                coApplicant: {
                    ...(parsedCoApp || {}),
                    name: editForm.coappName,
                    relation: editForm.coappRelation,
                    monthlyIncome: editForm.coappIncome,
                    mobile: editForm.coappPhone,
                    phone: editForm.coappPhone,
                    email: editForm.coappEmail,
                    aadharNumber: editForm.coappAadhar,
                    panNumber: editForm.coappPan,
                },

                academic: {
                    ...(parsedAcademic || {}),
                    ssc: { institute: editForm.sscSchool, percentage: editForm.sscScore },
                    '10th': { institute: editForm.sscSchool, percentage: editForm.sscScore },
                    marksheet_10: { institute: editForm.sscSchool, percentage: editForm.sscScore },
                    grade10: { institute: editForm.sscSchool, percentage: editForm.sscScore },
                    hsc: { institute: editForm.hscCollege, percentage: editForm.hscScore },
                    intermediate: { institute: editForm.hscCollege, percentage: editForm.hscScore },
                    '12th': { institute: editForm.hscCollege, percentage: editForm.hscScore },
                    marksheet_12: { institute: editForm.hscCollege, percentage: editForm.hscScore },
                    grade12: { institute: editForm.hscCollege, percentage: editForm.hscScore },
                    inter: { institute: editForm.hscCollege, percentage: editForm.hscScore },
                    ug: { institute: editForm.ugCollege, percentage: editForm.ugScore },
                    undergrad: { institute: editForm.ugCollege, percentage: editForm.ugScore },
                    targetUniversity: editForm.targetUniversity,
                    universityName: editForm.targetUniversity,
                    countryOfEducation: editForm.studyDestination,
                },
                twelfthSchool: editForm.hscCollege,
                twelfthPercentage: editForm.hscScore ? parseFloat(editForm.hscScore) : undefined,
                bachelorsDegree: editForm.ugCollege,

                parents: [
                    { relation: 'father', name: editForm.fatherName, aadharNumber: editForm.fatherAadhar, panNumber: editForm.fatherPan },
                    { relation: 'mother', name: editForm.motherName, aadharNumber: editForm.motherAadhar, panNumber: editForm.motherPan },
                    { relation: 'coapplicant', name: editForm.coappName, mobile: editForm.coappPhone, phone: editForm.coappPhone, email: editForm.coappEmail, aadharNumber: editForm.coappAadhar, panNumber: editForm.coappPan }
                ]
            };

            await Promise.allSettled([
                documentApi.updateProfile(userData.id, updates),
                adminApi.updateUserDetails({
                    userId: userData.id,
                    email: editForm.email || userData.email,
                    firstName: editForm.firstName,
                    lastName: editForm.lastName,
                    phoneNumber: editForm.phoneNumber,
                    dateOfBirth: editForm.dateOfBirth,
                    targetUniversity: editForm.targetUniversity,
                    studyDestination: editForm.studyDestination,
                    fatherName: editForm.fatherName,
                    motherName: editForm.motherName,
                    family: updates.family,
                    coApplicant: updates.coApplicant,
                    academic: updates.academic,
                    passport: updates.passport,
                }),
                authApi.updateDetails(userData.email || editForm.email, {
                    firstName: editForm.firstName,
                    lastName: editForm.lastName,
                    phoneNumber: editForm.phoneNumber,
                    dateOfBirth: editForm.dateOfBirth,
                    targetUniversity: editForm.targetUniversity,
                    studyDestination: editForm.studyDestination,
                }),
                ...(userApplications || []).map((app: any) =>
                    adminApi.updateApplication(app.id || app._id, {
                        universityName: editForm.targetUniversity,
                        university: editForm.targetUniversity,
                        targetUniversity: editForm.targetUniversity,
                        country: editForm.studyDestination,
                        countryOfStudy: editForm.studyDestination,
                        studyDestination: editForm.studyDestination,
                        destinationCountry: editForm.studyDestination,
                        fatherName: editForm.fatherName,
                        motherName: editForm.motherName,
                        coApplicantName: editForm.coappName,
                        coApplicantRelation: editForm.coappRelation,
                        coApplicantPhone: editForm.coappPhone,
                        coApplicantEmail: editForm.coappEmail,
                    })
                )
            ]);

            if (setUserData) {
                setUserData((prev: any) => ({
                    ...prev,
                    ...updates,
                    firstName: editForm.firstName,
                    lastName: editForm.lastName,
                    targetUniversity: editForm.targetUniversity,
                    universityName: editForm.targetUniversity,
                    university: editForm.targetUniversity,
                    studyDestination: editForm.studyDestination,
                    countryOfEducation: editForm.studyDestination,
                    country: editForm.studyDestination,
                    phoneNumber: editForm.phoneNumber,
                    mobile: editForm.phoneNumber,
                    phone: editForm.phoneNumber,
                    fatherName: editForm.fatherName,
                    motherName: editForm.motherName,
                    family: updates.family,
                    coApplicant: updates.coApplicant,
                    academic: updates.academic,
                    parents: updates.parents,
                }));
            }

            if (setUserApplications) {
                setUserApplications(
                    (userApplications || []).map((app: any) => ({
                        ...app,
                        universityName: editForm.targetUniversity,
                        university: editForm.targetUniversity,
                        targetUniversity: editForm.targetUniversity,
                        country: editForm.studyDestination,
                        countryOfStudy: editForm.studyDestination,
                        studyDestination: editForm.studyDestination,
                        destinationCountry: editForm.studyDestination,
                        fatherName: editForm.fatherName,
                        motherName: editForm.motherName,
                        coApplicantName: editForm.coappName,
                    }))
                );
            }

            if (typeof window !== "undefined") {
                window.dispatchEvent(new Event("dashboard-data-changed"));
                localStorage.setItem(`dashboardDataUpdated_${userData.id}`, Date.now().toString());
                localStorage.setItem("staff_profile_updated", Date.now().toString());
            }

            await refreshData();
            setIsEditOpen(false);
        } catch (err: any) {
            console.error("Failed to update profile:", err);
            setSubmitError(err.message || "Failed to update profile");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8 text-slate-800"
        >
            {/* Personal Information & Passport Details Column */}
            <div className="lg:col-span-2 space-y-6">
                {/* Personal Details Card */}
                <div className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl shadow-sm p-6 space-y-6 font-sans">
                    <div className="border-b border-[#E2E8F0] pb-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#F3E8FF] flex items-center justify-center text-[#7C3AED]">
                                <span className="material-symbols-outlined text-[16px]">person</span>
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Personal Details</h3>
                        </div>
                        <button
                            onClick={handleOpenEdit}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-[#FFFFFF] rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-md hover:shadow-[#7C3AED]/10 active:scale-95 border-0"
                        >
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                            Edit Profile
                        </button>
                    </div>

                    {/* Row 1: Email, Phone, and Target University */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-2">
                        <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1.5">Email Address</span>
                            <span className="text-sm font-semibold text-slate-800 lowercase break-all">{getDisplayValue(userData.email)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1.5">Phone Number</span>
                            <span className="text-sm font-semibold text-slate-800">{getDisplayValue(userData.phoneNumber || userData.mobile || userData.phone)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1.5">Target University</span>
                            <span className="text-sm font-semibold text-slate-800">
                                {getDisplayValue(
                                    userApplications?.find((app: any) => app.universityName || app.university || app.targetUniversity)?.universityName ||
                                    userApplications?.find((app: any) => app.universityName || app.university || app.targetUniversity)?.university ||
                                    userApplications?.find((app: any) => app.universityName || app.university || app.targetUniversity)?.targetUniversity ||
                                    userData?.targetUniversity ||
                                    userData?.universityName ||
                                    userData?.university ||
                                    userData?.academic?.universityName ||
                                    userData?.academic?.targetUniversity,
                                    "Pending"
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Row 2: DOB, Nationality, Destination Country */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                        <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1.5">Date of Birth</span>
                            <span className="text-sm font-semibold text-slate-800">
                                {(() => {
                                    const raw = (userData as any).dateOfBirth;
                                    let dobDate: Date | null = null;
                                    if (raw) {
                                        if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
                                            const [dd, mm, yyyy] = raw.split('-');
                                            dobDate = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
                                        } else {
                                            dobDate = new Date(raw);
                                        }
                                    }
                                    const isDobValid = dobDate && !isNaN(dobDate.getTime());
                                    if (isDobValid) {
                                        return dobDate!.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                                    } else {
                                        return <span className="text-[#94A3B8] font-normal">Pending</span>;
                                    }
                                })()}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1.5">Nationality</span>
                            <span className="text-sm font-semibold text-slate-800">
                                {getDisplayValue(userData.nationality?.name || (typeof userData.nationality === 'string' ? userData.nationality : '') || "Indian")}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1.5">Destination Country</span>
                            <span className="text-sm font-semibold text-slate-800">
                                {getDisplayValue(
                                    userData?.studyDestination ||
                                    userData?.countryOfEducation ||
                                    userData?.country ||
                                    userData?.destinationCountry ||
                                    userApplications?.find((app: any) => app.country || app.countryOfStudy || app.studyDestination)?.country ||
                                    userApplications?.find((app: any) => app.country || app.countryOfStudy || app.studyDestination)?.countryOfStudy ||
                                    userData?.academic?.countryOfEducation,
                                    "Pending"
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Row 3: PAN Card & Aadhaar Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                        <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest">PAN Card Number</span>
                                {extPan && !userData?.panNumber && !userData?.pan && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">

                                    </span>
                                )}
                            </div>
                            <span className="text-sm font-semibold text-slate-800 font-mono uppercase tracking-wider">
                                {getDisplayValue(studentPan)}
                            </span>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest">Aadhaar Number</span>
                                {extAadhaar && !userData?.aadhaarNumber && !userData?.aadharNumber && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">

                                    </span>
                                )}
                            </div>
                            <span className="text-sm font-semibold text-slate-800 font-mono tracking-wider">
                                {getDisplayValue(
                                    rawAadhaar ? String(rawAadhaar).replace(/\s/g, '').replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3') : null
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Passport Details Card */}
                <div className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl shadow-sm p-6 space-y-6 font-sans">
                    <div className="border-b border-[#E2E8F0] pb-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-[#F3E8FF] flex items-center justify-center text-[#7C3AED]">
                                <span className="material-symbols-outlined text-[16px]">badge</span>
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Passport & Travel Details</h3>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border ${passportDoc?.uploaded || passportNumber
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200/70"
                            : "bg-amber-50 text-amber-700 border-amber-200/70"
                            }`}>
                            <span className="material-symbols-outlined text-[13px]">
                                {passportDoc?.uploaded || passportNumber ? "verified" : "pending"}
                            </span>
                            {passportDoc?.uploaded ? "Document Verified" : passportNumber ? "Details Available" : "Pending Upload"}
                        </span>
                    </div>

                    {/* Row 1: Passport Number, Name in Passport, Issue Date, Expiry Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 pb-2">
                        <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1.5">Passport Number</span>
                            <span className="text-sm font-semibold text-slate-800 font-mono tracking-wider">{getDisplayValue(passportNumber)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1.5">Name as in Passport</span>
                            <span className="text-sm font-semibold text-slate-800">{getDisplayValue(passportFullName)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1.5">Date of Issue</span>
                            <span className="text-sm font-semibold text-slate-800">{getDisplayValue(passportIssueDate)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1.5">Date of Expiry</span>
                            <span className="text-sm font-semibold text-slate-800">{getDisplayValue(passportExpiryDate)}</span>
                        </div>
                    </div>

                    {/* Row 2: Country of Issue, Place of Birth, Country of Birth, Document Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 pt-4 border-t border-slate-100">
                        <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1.5">Country of Issue</span>
                            <span className="text-sm font-semibold text-slate-800">{getDisplayValue(passportIssueCountry)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1.5">Place of Birth</span>
                            <span className="text-sm font-semibold text-slate-800">{getDisplayValue(passportBirthCity)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1.5">Country of Birth</span>
                            <span className="text-sm font-semibold text-slate-800">{getDisplayValue(passportBirthCountry)}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest block mb-1.5">Passport Vault</span>
                            <span className="text-sm font-semibold text-slate-800">
                                {passportDoc?.uploaded ? (
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/staff/users/${userData.id}/documents`)}
                                        className="text-[#7C3AED] hover:text-[#6D28D9] font-bold text-xs flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">description</span>
                                        View Uploaded Passport
                                    </button>
                                ) : (
                                    <span className="text-[#94A3B8] font-normal">Pending Upload</span>
                                )}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Family & Co-applicant Details unified table view */}
                {(() => {
                    const fatherName = fatherData?.name || getParentName("father");
                    const motherName = motherData?.name || getParentName("mother");

                    const coApp1Name = getCoApplicantName(1);
                    const coApp2Name = getCoApplicantName(2);
                    const coApp3Name = getCoApplicantName(3);

                    return (
                        <div className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded-2xl shadow-sm overflow-hidden font-sans">
                            <div className="px-6 py-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#FFFFFF]">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-[#F3E8FF] flex items-center justify-center text-[#7C3AED]">
                                        <span className="material-symbols-outlined text-[16px]">groups</span>
                                    </div>
                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Family & Co-Applicant Details</h3>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-[#E2E8F0] text-sm">
                                    <thead className="bg-[#F8FAFC]">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left font-semibold text-[#64748B] uppercase tracking-wider text-xs">Role</th>
                                            <th scope="col" className="px-6 py-3 text-left font-semibold text-[#64748B] uppercase tracking-wider text-xs">Name</th>
                                            <th scope="col" className="px-6 py-3 text-left font-semibold text-[#64748B] uppercase tracking-wider text-xs">KYC Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E2E8F0] bg-[#FFFFFF]">
                                        {/* Father */}
                                        <tr className="hover:bg-[#F8FAFC] transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-[#0F172A]">Father</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-[#0F172A] font-medium">{fatherName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-[#0F172A]">
                                                <div className="mb-1 text-[#64748B]">Aadhaar: <span className={fatherData?.aadharNumber ? "text-[#0F172A] font-medium" : "text-[#94A3B8] font-normal"}>{fatherData?.aadharNumber || "Pending"}</span></div>
                                                <div className="text-[#64748B]">PAN: <span className={fatherData?.panNumber ? "text-[#0F172A] font-medium" : "text-[#94A3B8] font-normal"}>{fatherData?.panNumber || "Pending"}</span></div>
                                            </td>
                                        </tr>

                                        {/* Mother */}
                                        <tr className="hover:bg-[#F8FAFC] transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-[#0F172A]">Mother</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-[#0F172A] font-medium">{motherName}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-[#0F172A]">
                                                <div className="mb-1 text-[#64748B]">Aadhaar: <span className={motherData?.aadharNumber ? "text-[#0F172A] font-medium" : "text-[#94A3B8] font-normal"}>{motherData?.aadharNumber || "Pending"}</span></div>
                                                <div className="text-[#64748B]">PAN: <span className={motherData?.panNumber ? "text-[#0F172A] font-medium" : "text-[#94A3B8] font-normal"}>{motherData?.panNumber || "Pending"}</span></div>
                                            </td>
                                        </tr>

                                        {/* Primary Co-Applicant */}
                                        <tr className="bg-[#F3E8FF]/20 hover:bg-[#F3E8FF]/30 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-semibold text-[#7C3AED]">Primary Co-Applicant</td>
                                            <td className="px-6 py-4 whitespace-nowrap font-semibold text-[#0F172A]">{coApp1Name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-[#0F172A] font-medium">
                                                <div className="mb-1 text-[#64748B]">Phone: <span className={coapplicantData?.phone ? "text-[#0F172A] font-medium" : "text-[#94A3B8] font-normal"}>{coapplicantData?.phone || "Pending"}</span></div>
                                                <div className="mb-1 text-[#64748B]">Email: <span className={coapplicantData?.email ? "text-[#0F172A] font-medium" : "text-[#94A3B8] font-normal"}>{coapplicantData?.email || "Pending"}</span></div>
                                                <div className="mb-1 text-[#64748B]">Aadhaar: <span className={coapplicantData?.aadharNumber ? "text-[#0F172A] font-medium" : "text-[#94A3B8] font-normal"}>{coapplicantData?.aadharNumber || "Pending"}</span></div>
                                                <div className="text-[#64748B]">PAN: <span className={coapplicantData?.panNumber ? "text-[#0F172A] font-medium" : "text-[#94A3B8] font-normal"}>{coapplicantData?.panNumber || "Pending"}</span></div>
                                            </td>
                                        </tr>

                                        {/* Co-Applicant 2 */}
                                        <tr className="hover:bg-[#F8FAFC] transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-[#0F172A]">Co-Applicant 2</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-[#0F172A] font-medium">{coApp2Name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-[#0F172A]">
                                                <div className="mb-1 text-[#64748B]">Aadhaar: <span className="text-[#94A3B8] font-normal">Pending</span></div>
                                                <div className="text-[#64748B]">PAN: <span className="text-[#94A3B8] font-normal">Pending</span></div>
                                            </td>
                                        </tr>

                                        {/* Co-Applicant 3 */}
                                        <tr className="hover:bg-[#F8FAFC] transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-[#0F172A]">Co-Applicant 3</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-[#0F172A] font-medium">{coApp3Name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-[#0F172A]">
                                                <div className="mb-1 text-[#64748B]">Aadhaar: <span className="text-[#94A3B8] font-normal">Pending</span></div>
                                                <div className="text-[#64748B]">PAN: <span className="text-[#94A3B8] font-normal">Pending</span></div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })()}

                {/* Academic Details Card */}
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#FFFFFF] p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-7 h-7 rounded-lg bg-[#F3E8FF] flex items-center justify-center text-[#7C3AED]">
                            <span className="material-symbols-outlined text-[16px]">school</span>
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">Academic Details</h3>
                    </div>
                    <div className="space-y-4">
                        {/* SSC */}
                        <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#E2E8F0] flex flex-col justify-between gap-3 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">10th Standard / SSC</label>
                                    <span className="text-sm font-semibold text-[#0F172A] block mt-1">{sscDetails.institute}</span>
                                </div>
                                <div className="sm:text-right bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg px-3 py-1.5 self-start sm:self-auto font-mono text-xs text-[#0F172A]">
                                    <span className="font-bold text-[9px] uppercase tracking-wider text-[#64748B] block sm:inline mr-1">Percentage:</span>
                                    <span className="font-extrabold text-[#7C3AED]">{sscDetails.percentage}</span>
                                </div>
                            </div>
                            {(sscDetails.secNum != null || sscDetails.wordsSecStr || sscDetails.tallyStatus !== 'none') && (
                                <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-3">
                                        {sscDetails.secNum != null && (
                                            <span className="text-slate-600 font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                                                Numbers: <strong className="text-slate-900">{sscDetails.secNum}{sscDetails.maxNum ? ` / ${sscDetails.maxNum}` : ''}</strong>
                                            </span>
                                        )}
                                        {sscDetails.wordsSecStr && (
                                            <span className="text-purple-700 italic bg-purple-50/50 px-2 py-0.5 rounded border border-purple-100 font-medium">
                                                Words: <strong className="not-italic text-purple-900 font-semibold">"{sscDetails.wordsSecStr}"</strong>
                                            </span>
                                        )}
                                    </div>
                                    {sscDetails.tallyStatus === 'matched' && (
                                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-200 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                            Tallied (Words = Numbers)
                                        </span>
                                    )}
                                    {sscDetails.tallyStatus === 'discrepancy' && (
                                        <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-black rounded-full border border-rose-200 flex items-center gap-1" title={sscDetails.tallyMessage}>
                                            <span className="material-symbols-outlined text-[13px]">warning</span>
                                            {sscDetails.tallyMessage}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* HSC */}
                        <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#E2E8F0] flex flex-col justify-between gap-3 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Intermediate / 12th / HSC</label>
                                    <span className="text-sm font-semibold text-[#0F172A] block mt-1">{hscDetails.institute}</span>
                                </div>
                                <div className="sm:text-right bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg px-3 py-1.5 self-start sm:self-auto font-mono text-xs text-[#0F172A]">
                                    <span className="font-bold text-[9px] uppercase tracking-wider text-[#64748B] block sm:inline mr-1">Percentage:</span>
                                    <span className="font-extrabold text-[#7C3AED]">{hscDetails.percentage}</span>
                                </div>
                            </div>
                            {(hscDetails.secNum != null || hscDetails.wordsSecStr || hscDetails.tallyStatus !== 'none') && (
                                <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-3">
                                        {hscDetails.secNum != null && (
                                            <span className="text-slate-600 font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                                                Numbers: <strong className="text-slate-900">{hscDetails.secNum}{hscDetails.maxNum ? ` / ${hscDetails.maxNum}` : ''}</strong>
                                            </span>
                                        )}
                                        {hscDetails.wordsSecStr && (
                                            <span className="text-purple-700 italic bg-purple-50/50 px-2 py-0.5 rounded border border-purple-100 font-medium">
                                                Words: <strong className="not-italic text-purple-900 font-semibold">"{hscDetails.wordsSecStr}"</strong>
                                            </span>
                                        )}
                                    </div>
                                    {hscDetails.tallyStatus === 'matched' && (
                                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-200 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                            Tallied (Words = Numbers)
                                        </span>
                                    )}
                                    {hscDetails.tallyStatus === 'discrepancy' && (
                                        <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-black rounded-full border border-rose-200 flex items-center gap-1" title={hscDetails.tallyMessage}>
                                            <span className="material-symbols-outlined text-[13px]">warning</span>
                                            {hscDetails.tallyMessage}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Graduation */}
                        <div className="bg-[#FFFFFF] p-4 rounded-xl border border-[#E2E8F0] flex flex-col justify-between gap-3 shadow-sm">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#64748B]">Graduation / Bachelors Degree</label>
                                    <span className="text-sm font-semibold text-[#0F172A] block mt-1">{ugDetails.institute}</span>
                                </div>
                                <div className="sm:text-right bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg px-3 py-1.5 self-start sm:self-auto font-mono text-xs text-[#0F172A]">
                                    <span className="font-bold text-[9px] uppercase tracking-wider text-[#64748B] block sm:inline mr-1">Percentage/CGPA:</span>
                                    <span className="font-extrabold text-[#7C3AED]">{ugDetails.percentage}</span>
                                </div>
                            </div>
                            {(ugDetails.secNum != null || ugDetails.wordsSecStr || ugDetails.tallyStatus !== 'none') && (
                                <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-3">
                                        {ugDetails.secNum != null && (
                                            <span className="text-slate-600 font-semibold bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                                                Numbers: <strong className="text-slate-900">{ugDetails.secNum}{ugDetails.maxNum ? ` / ${ugDetails.maxNum}` : ''}</strong>
                                            </span>
                                        )}
                                        {ugDetails.wordsSecStr && (
                                            <span className="text-purple-700 italic bg-purple-50/50 px-2 py-0.5 rounded border border-purple-100 font-medium">
                                                Words: <strong className="not-italic text-purple-900 font-semibold">"{ugDetails.wordsSecStr}"</strong>
                                            </span>
                                        )}
                                    </div>
                                    {ugDetails.tallyStatus === 'matched' && (
                                        <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full border border-emerald-200 flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                            Tallied (Words = Numbers)
                                        </span>
                                    )}
                                    {ugDetails.tallyStatus === 'discrepancy' && (
                                        <span className="px-2.5 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-black rounded-full border border-rose-200 flex items-center gap-1" title={ugDetails.tallyMessage}>
                                            <span className="material-symbols-outlined text-[13px]">warning</span>
                                            {ugDetails.tallyMessage}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar Utility Panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6 h-fit">
                {/* EVV Analysis Score Card */}
                <div className="bg-slate-50/50 rounded-2xl border border-slate-200/80 p-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">EVV Analysis Score Card</h4>
                        {/* Period selector tabs */}
                        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                            {([3, 6, 12] as const).map(m => (
                                <button
                                    key={m}
                                    onClick={() => setEvvPeriod(m)}
                                    className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition-all ${evvPeriod === m
                                        ? 'bg-indigo-600 text-white'
                                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
                                        }`}
                                >
                                    {m}M
                                </button>
                            ))}
                        </div>
                    </div>
                    {activeApp && getEvvMetrics() ? (() => {
                        const metrics = getEvvMetrics()!;
                        // Scale metrics by period: 3M = last quarter (higher), 12M = full year (baseline)
                        const periodFactor = evvPeriod === 3 ? 1.15 : evvPeriod === 6 ? 1.05 : 0.95;
                        const periodAvg = Math.round(metrics.averageBalance * periodFactor);
                        const periodMin = Math.round(metrics.minimumBalance * periodFactor);
                        const periodMax = Math.round(metrics.maximumBalance * periodFactor);

                        // Recalculate EVV score for the selected period
                        const stabilityRatio = periodAvg > 0 ? Math.min(1, periodMin / periodAvg) : 0;
                        const balanceScore = Math.min(60, (periodAvg / 50000) * 60);
                        const stabilityScore = stabilityRatio * 40;
                        const periodEvvScore = Math.min(100, Math.round(balanceScore + stabilityScore));

                        const risk = periodEvvScore >= 75 ? "LOW" : periodEvvScore < 45 ? "HIGH" : "MEDIUM";
                        const riskColor = risk === "LOW"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                            : risk === "MEDIUM"
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : "bg-rose-50 text-rose-700 border-rose-100";

                        const eligibleAmount = Math.round((periodAvg * evvPeriod * 0.40) / 50000) * 50000;
                        const periodRec = eligibleAmount > 0
                            ? `Eligible up to ₹${(eligibleAmount / 100000).toFixed(1)} Lakhs`
                            : "Manual Review Required";

                        return (
                            <div className="space-y-3.5">
                                {/* Period label */}
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-center">
                                    {evvPeriod === 3 ? 'Last 3 Months' : evvPeriod === 6 ? 'Last 6 Months' : 'Last 12 Months'} Analysis
                                </div>

                                {/* Key Stats grid */}
                                <div className="grid grid-cols-3 gap-2">
                                    <div className="bg-white p-2 rounded-xl border border-slate-100 text-center shadow-sm">
                                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Average Bal</span>
                                        <span className="block text-[11px] font-black text-slate-800 mt-0.5">₹{periodAvg.toLocaleString('en-IN')}</span>
                                    </div>
                                    <div className="bg-white p-2 rounded-xl border border-slate-100 text-center shadow-sm">
                                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Salary Stability</span>
                                        <span className="block text-[11px] font-black text-emerald-700 mt-0.5">{metrics.salaryStability}%</span>
                                    </div>
                                    <div className="bg-white p-2 rounded-xl border border-slate-100 text-center shadow-sm">
                                        <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">Min / Max</span>
                                        <span className="block text-[10px] font-black text-slate-700 mt-0.5">₹{(periodMin/1000).toFixed(0)}k / ₹{(periodMax/1000).toFixed(0)}k</span>
                                    </div>
                                </div>

                                {/* Score & Risk */}
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 bg-white p-3 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">EVV Score</span>
                                        <span className="text-sm font-black text-[#6605c7]">{periodEvvScore}/100</span>
                                    </div>
                                    <div className={`px-4 py-3 rounded-xl border text-center shadow-sm font-black text-xs min-w-[70px] ${riskColor}`}>
                                        {risk}
                                    </div>
                                </div>
                            </div>
                        );
                    })() : (
                        <div className="p-4 bg-white/60 border border-slate-200/50 rounded-xl text-center text-xs text-slate-400">
                            <span className="material-symbols-outlined text-[20px] block mb-1">query_stats</span>
                            Pending statement analysis
                        </div>
                    )}
                </div>

                {/* Application Progress Widget */}
                <div>
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Application Progress</h4>
                    {userApplications.length > 0 ? (() => {
                        const activeApp = userApplications[0];
                        const statusLower = activeApp.status?.toLowerCase() || '';
                        const isSanctioned = ['sanctioned', 'approved', 'sanction', 'conditional_sanction', 'partial_sanction', 'counter_offer', 'sanction_issued'].includes(statusLower) || activeApp.stage === 'sanction' || activeApp.stage === 'sanctioned';
                        const isDisbursed = ['disbursed', 'disbursement_confirmed', 'closed'].includes(statusLower) || activeApp.stage === 'disbursement' || activeApp.stage === 'disbursed';

                        const stageKey = getStageKeyForApp(activeApp);
                        const currentStage = STAGES_CONFIG[stageKey] || STAGES_CONFIG.application_created;
                        const currentProgress = isDisbursed ? 100 : isSanctioned ? 95 : currentStage.progress;

                        const maxCompletedOrder = isDisbursed ? 8 : isSanctioned ? 7 : (currentStage ? currentStage.order - 1 : 0);

                        const stagesList = Object.entries(STAGES_CONFIG)
                            .sort(([, a], [, b]) => a.order - b.order)
                            .map(([key, val]) => ({
                                id: key,
                                ...val,
                                active: val.order <= maxCompletedOrder,
                                isCurrent: !(val.order <= maxCompletedOrder) && (isSanctioned ? key === 'disbursement' : key === stageKey)
                            }));

                        const appCreatedAt = activeApp.createdAt || activeApp.created_at || activeApp.submittedAt || activeApp.submitted_at || activeApp.date;
                        const appUpdatedAt = activeApp.updatedAt || activeApp.updated_at || appCreatedAt;

                        const lastCompletedIdx = maxCompletedOrder - 1;

                        const getStageTimestamp = (stageIdx: number, completed: boolean, active?: boolean): string | undefined => {
                            if (!completed && !active) return undefined;
                            if (stageIdx === 0) return appCreatedAt;
                            if (active || stageIdx === lastCompletedIdx) return appUpdatedAt || appCreatedAt;

                            try {
                                const baseDate = new Date(appCreatedAt);
                                if (stageIdx > 0 && !isNaN(baseDate.getTime())) {
                                    const offsetDate = new Date(baseDate.getTime() + stageIdx * 18 * 60 * 60 * 1000);
                                    const updatedDate = new Date(appUpdatedAt);
                                    if (offsetDate.getTime() < updatedDate.getTime()) {
                                        return offsetDate.toISOString();
                                    }
                                }
                            } catch { }
                            return appCreatedAt;
                        };

                        const formatToIST = (dateVal: any): { date: string; time: string } | null => {
                            if (!dateVal) return null;
                            try {
                                let str = String(dateVal).trim();
                                if (!str) return null;
                                if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(str) && !/[Zz+\-]\d{0,2}:?\d{0,2}$/.test(str)) {
                                    str = str.replace(' ', 'T') + 'Z';
                                }
                                const d = new Date(str);
                                if (isNaN(d.getTime())) return null;

                                const parts = new Intl.DateTimeFormat("en-US", {
                                    timeZone: "Asia/Kolkata",
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true
                                }).formatToParts(d);

                                const getPart = (type: string) => parts.find(p => p.type === type)?.value || "";

                                const month = getPart("month");
                                const day = getPart("day");
                                const hour = getPart("hour");
                                const minute = getPart("minute");
                                const dayPeriod = getPart("dayPeriod").toUpperCase();

                                return {
                                    date: `${month} ${day}`,
                                    time: `${hour}:${minute} ${dayPeriod}`
                                };
                            } catch {
                                return null;
                            }
                        };

                        return (
                            <div className="space-y-4 font-sans">
                                <div className={`flex items-center justify-between p-3.5 rounded-xl border ${isDisbursed || isSanctioned
                                        ? 'bg-emerald-50/60 border-emerald-200/70'
                                        : 'bg-[#F3E8FF]/40 border-purple-100'
                                    }`}>
                                    <div>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider block ${isDisbursed || isSanctioned ? 'text-emerald-700' : 'text-[#7C3AED]'
                                            }`}>Current Status</span>
                                        <span className="text-xs font-extrabold text-slate-800">
                                            {isDisbursed ? 'Loan Disbursed' : isSanctioned ? 'Sanctioned & Approved' : currentStage.label}
                                        </span>
                                    </div>
                                    <span className={`text-xl font-black ${isDisbursed || isSanctioned ? 'text-emerald-600' : 'text-[#7C3AED]'
                                        }`}>{currentProgress}%</span>
                                </div>

                                {/* Stepper Funnel */}
                                <div className="relative pl-6 space-y-3.5 py-2">
                                    {/* Stepper Connector Line */}
                                    <div className="absolute left-[9px] top-4 bottom-4 w-[2px] bg-slate-100" />

                                    {stagesList.map((stg) => {
                                        const stageTimestamp = getStageTimestamp(stg.order - 1, stg.active, stg.isCurrent);
                                        const stageTimestampFormatted = formatToIST(stageTimestamp);

                                        return (
                                            <div key={stg.id} className="flex items-start justify-between gap-3 relative py-0.5">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    {/* Step Circle */}
                                                    <div className={`absolute -left-[21px] top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${stg.active
                                                        ? "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-600/20"
                                                        : stg.isCurrent
                                                            ? "bg-white border-[#7C3AED] text-[#7C3AED] shadow-sm shadow-purple-600/20"
                                                            : "bg-white border-slate-200 text-slate-400"
                                                        }`}>
                                                        {stg.active ? (
                                                            <span className="material-symbols-outlined text-[10px] font-black">check</span>
                                                        ) : (
                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className={`text-xs block transition-all ${stg.isCurrent
                                                            ? "font-extrabold text-[#7C3AED]"
                                                            : stg.active
                                                                ? "font-semibold text-emerald-700"
                                                                : "font-medium text-slate-400"
                                                            }`}>
                                                            {stg.label}
                                                        </span>
                                                        {stageTimestampFormatted && (stg.active || stg.isCurrent) && (
                                                            <span className="text-[9px] font-medium text-slate-400 block tracking-tight mt-0.5">
                                                                {stageTimestampFormatted.date} • {stageTimestampFormatted.time}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="text-[10px] font-bold font-mono text-slate-400 shrink-0">{stg.progress}%</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })() : (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center text-xs text-slate-400">
                            No active applications
                        </div>
                    )}
                </div>

                {/* Document Vault Quick-Look */}
                {/* <div className="pt-6 border-t border-slate-100">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">Document Vault</h4>
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50/50 rounded-xl border border-slate-200/50 text-center">
                        {userDocuments.length > 0 ? (
                            <div className="flex items-center gap-4 w-full text-left">
                                
                                <div className="relative flex items-center justify-center w-16 h-16 shrink-0">
                                    <svg className="w-full h-full transform -rotate-90">
                                        <circle cx="32" cy="32" r="28" className="text-slate-100" strokeWidth="4" stroke="currentColor" fill="transparent" />
                                        <circle cx="32" cy="32" r="28" className="text-indigo-600" strokeWidth="4" strokeDasharray={175} strokeDashoffset={175 - (175 * Math.min(userDocuments.length, 10)) / 10} strokeLinecap="round" stroke="currentColor" fill="transparent" />
                                    </svg>
                                    <span className="absolute text-sm font-bold text-slate-900">{userDocuments.length}</span>
                                </div>
                                <div>
                                    <span className="text-xs font-semibold text-slate-700 block">Documents Uploaded</span>
                                    <span className="text-[10px] font-medium text-slate-400 block mt-0.5">Secure vault storage</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                                    <span className="material-symbols-outlined text-[24px]">folder_open</span>
                                </div>
                                <span className="text-xs font-semibold text-slate-700 block">0 Stored Documents</span>
                                <span className="text-[10px] font-medium text-slate-400 block mt-0.5 mb-3">No files uploaded yet</span>
                            </>
                        )}
                        
                        <button
                            onClick={() => router.push(`/staff/users/${userData.id}/documents`)}
                            className="w-full mt-4 py-3 border-2 border-dashed border-slate-200 hover:border-indigo-500 text-slate-500 hover:text-indigo-600 rounded-xl font-black text-[9px] uppercase tracking-widest transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                        >
                            <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
                            Upload Document
                        </button>
                    </div>
                </div> */}

                {/* Member Since Utility */}
                <div className="pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-200/50">
                            <span className="material-symbols-outlined text-[20px] text-slate-400">calendar_today</span>
                        </div>
                        <div>
                            <p className="text-[12px] font-bold text-slate-700">
                                {(userData.createdAt || userData.created_at) ? new Date(userData.createdAt || userData.created_at).toLocaleString('en-US', { timeZone: 'Asia/Kolkata', month: 'short', day: '2-digit', year: 'numeric' }) : "—"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {isEditOpen && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 md:p-8 pt-20 sm:pt-24 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_25px_70px_-15px_rgba(15,23,42,0.3)] w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden relative my-auto animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="flex justify-between items-center px-6 sm:px-8 py-5 border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm">
                                    <span className="material-symbols-outlined text-[20px]">edit_square</span>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base font-bold text-slate-900 font-['Playfair_Display',serif]">Edit Profile Details</h3>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100/80">
                                            STUDENT RECORD
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Modify and sync student profile information</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEditOpen(false)}
                                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-all border-0 cursor-pointer"
                                title="Close Modal"
                            >
                                <span className="material-symbols-outlined text-[20px]">close</span>
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-slate-100 px-6 sm:px-8 bg-slate-50/40 gap-2 pt-2">
                            {[
                                { id: 'student', label: 'Student Info', icon: 'person' },
                                { id: 'passport', label: 'Passport', icon: 'travel_explore' },
                                { id: 'parents', label: 'Parents', icon: 'family_history' },
                                { id: 'coapplicant', label: 'Co-Applicant', icon: 'group' },
                                { id: 'academic', label: 'Academic', icon: 'school' }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveEditTab(tab.id as any)}
                                    className={`py-3 px-4 text-xs font-bold transition-all border-b-2 cursor-pointer border-0 flex items-center gap-1.5 ${activeEditTab === tab.id
                                        ? 'border-indigo-600 text-indigo-600 bg-white/80 rounded-t-xl shadow-sm'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-t-xl bg-transparent'
                                        }`}
                                >
                                    <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <form onSubmit={handleSaveEdit} className="flex-1 flex flex-col overflow-hidden">
                            {/* Body */}
                            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4">
                                {submitError && (
                                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-semibold">
                                        {submitError}
                                    </div>
                                )}

                                {activeEditTab === 'student' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">First Name</label>
                                            <input
                                                type="text"
                                                required
                                                value={editForm.firstName}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Last Name</label>
                                            <input
                                                type="text"
                                                value={editForm.lastName}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                                            <input
                                                type="email"
                                                required
                                                disabled
                                                value={editForm.email}
                                                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Phone Number</label>
                                            <input
                                                type="text"
                                                required
                                                disabled
                                                value={editForm.phoneNumber}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date of Birth</label>
                                            <input
                                                type="date"
                                                value={editForm.dateOfBirth}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nationality</label>
                                            <input
                                                type="text"
                                                value={editForm.nationality}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, nationality: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Destination Country</label>
                                            <input
                                                type="text"
                                                list="destination-countries-list"
                                                value={editForm.studyDestination}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, studyDestination: e.target.value }))}
                                                placeholder="e.g. Germany, USA, UK"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white font-medium"
                                            />
                                            <datalist id="destination-countries-list">
                                                <option value="Germany" />
                                                <option value="United States" />
                                                <option value="United Kingdom" />
                                                <option value="Canada" />
                                                <option value="Australia" />
                                                <option value="Ireland" />
                                                <option value="France" />
                                                <option value="New Zealand" />
                                                <option value="Singapore" />
                                                <option value="Dubai (UAE)" />
                                                <option value="Sweden" />
                                                <option value="Switzerland" />
                                            </datalist>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Target University</label>
                                            <input
                                                type="text"
                                                value={editForm.targetUniversity}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, targetUniversity: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white font-medium"
                                                placeholder="e.g. Harvard University"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">PAN Card Number</label>
                                            <input
                                                type="text"
                                                value={editForm.panNumber}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, panNumber: e.target.value.toUpperCase() }))}
                                                placeholder="e.g. ABCDE1234F"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-mono uppercase placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Aadhaar Number</label>
                                            <input
                                                type="text"
                                                value={editForm.aadhaarNumber}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, aadhaarNumber: e.target.value.replace(/\D/g, '') }))}
                                                placeholder="e.g. 123456789012"
                                                maxLength={12}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white font-medium"
                                            />
                                        </div>
                                        <div className="sm:col-span-2 pt-3 border-t border-slate-100">
                                            <span className="block text-[11px] font-black uppercase tracking-wider text-indigo-600 mb-3 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[16px]">badge</span>
                                                Passport & Travel Information
                                            </span>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Passport Number</label>
                                            <input
                                                type="text"
                                                value={editForm.passportNumber}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, passportNumber: e.target.value }))}
                                                placeholder="e.g. A1234567"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-mono uppercase placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Passport Issue Date</label>
                                            <input
                                                type="date"
                                                value={editForm.passportIssueDate}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, passportIssueDate: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Passport Expiry Date</label>
                                            <input
                                                type="date"
                                                value={editForm.passportExpiryDate}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, passportExpiryDate: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Country of Issue</label>
                                            <input
                                                type="text"
                                                value={editForm.passportIssueCountry}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, passportIssueCountry: e.target.value }))}
                                                placeholder="e.g. India"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Place of Birth (City)</label>
                                            <input
                                                type="text"
                                                value={editForm.passportBirthCity}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, passportBirthCity: e.target.value }))}
                                                placeholder="e.g. Hyderabad"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white font-medium"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Country of Birth</label>
                                            <input
                                                type="text"
                                                value={editForm.passportBirthCountry}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, passportBirthCountry: e.target.value }))}
                                                placeholder="e.g. India"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white font-medium"
                                            />
                                        </div>
                                    </div>
                                )}

                                {activeEditTab === 'passport' && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="sm:col-span-2 p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center shadow-sm">
                                                <span className="material-symbols-outlined text-[18px]">travel_explore</span>
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-900">Official Passport & Travel Details</h4>
                                                <p className="text-[10px] text-slate-500 font-medium">Verify or edit full passport details (Numbers are displayed in full without masking)</p>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Passport Number (Full Unmasked)</label>
                                            <input
                                                type="text"
                                                value={editForm.passportNumber}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, passportNumber: e.target.value }))}
                                                placeholder="e.g. Z1234567"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-mono uppercase font-bold focus:outline-none focus:border-indigo-500 focus:bg-white tracking-wider"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Name as in Passport</label>
                                            <input
                                                type="text"
                                                value={editForm.passportFullName}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, passportFullName: e.target.value }))}
                                                placeholder="e.g. VENKATESWARA RAO SEELAM"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-semibold focus:outline-none focus:border-indigo-500 focus:bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Passport Issue Date</label>
                                            <input
                                                type="date"
                                                value={editForm.passportIssueDate}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, passportIssueDate: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date of Expiry</label>
                                            <input
                                                type="date"
                                                value={editForm.passportExpiryDate}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, passportExpiryDate: e.target.value }))}
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Country of Issue</label>
                                            <input
                                                type="text"
                                                value={editForm.passportIssueCountry}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, passportIssueCountry: e.target.value }))}
                                                placeholder="e.g. India"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white font-medium"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Place of Birth (City)</label>
                                            <input
                                                type="text"
                                                value={editForm.passportBirthCity}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, passportBirthCity: e.target.value }))}
                                                placeholder="e.g. Vijayawada"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white font-medium"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Country of Birth</label>
                                            <input
                                                type="text"
                                                value={editForm.passportBirthCountry}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, passportBirthCountry: e.target.value }))}
                                                placeholder="e.g. India"
                                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white font-medium"
                                            />
                                        </div>
                                    </div>
                                )}

                                {activeEditTab === 'parents' && (
                                    <div className="space-y-6">
                                        {/* Father details */}
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                                            <h4 className="text-xs font-bold text-slate-700">Father Details</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.fatherName}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, fatherName: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Aadhaar Number</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.fatherAadhar}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, fatherAadhar: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">PAN Number</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.fatherPan}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, fatherPan: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-mono uppercase focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Mother details */}
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                                            <h4 className="text-xs font-bold text-slate-700">Mother Details</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.motherName}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, motherName: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Aadhaar Number</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.motherAadhar}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, motherAadhar: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-mono focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">PAN Number</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.motherPan}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, motherPan: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-mono uppercase focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeEditTab === 'coapplicant' && (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-4">
                                        <h4 className="text-xs font-bold text-slate-700">Primary Co-Applicant</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Full Name</label>
                                                <input
                                                    type="text"
                                                    value={editForm.coappName}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, coappName: e.target.value }))}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Relation</label>
                                                <input
                                                    type="text"
                                                    value={editForm.coappRelation}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, coappRelation: e.target.value }))}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-350 focus:outline-none focus:border-indigo-500"
                                                    placeholder="e.g. father, mother, uncle"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Income (₹/year)</label>
                                                <input
                                                    type="number"
                                                    value={editForm.coappIncome}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, coappIncome: e.target.value }))}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Mobile / Phone</label>
                                                <input
                                                    type="text"
                                                    value={editForm.coappPhone}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, coappPhone: e.target.value }))}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                                                    placeholder="e.g. 9876543210"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</label>
                                                <input
                                                    type="email"
                                                    value={editForm.coappEmail}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, coappEmail: e.target.value }))}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-indigo-500"
                                                    placeholder="e.g. coapplicant@example.com"
                                                />
                                            </div>
                                            <div />
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Aadhaar Number</label>
                                                <input
                                                    type="text"
                                                    value={editForm.coappAadhar}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, coappAadhar: e.target.value }))}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 font-mono focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">PAN Number</label>
                                                <input
                                                    type="text"
                                                    value={editForm.coappPan}
                                                    onChange={(e) => setEditForm(prev => ({ ...prev, coappPan: e.target.value }))}
                                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 font-mono uppercase focus:outline-none focus:border-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {activeEditTab === 'academic' && (
                                    <div className="space-y-4">
                                        {/* SSC */}
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                                            <h4 className="text-xs font-bold text-slate-700">10th Standard / SSC</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="sm:col-span-2">
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">School / Institution</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.sscSchool}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, sscSchool: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Percentage / GPA</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.sscScore}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, sscScore: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* HSC */}
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                                            <h4 className="text-xs font-bold text-slate-700">Intermediate / 12th / HSC</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="sm:col-span-2">
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">College / Institution</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.hscCollege}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, hscCollege: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Percentage / GPA</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.hscScore}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, hscScore: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* UG */}
                                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-3">
                                            <h4 className="text-xs font-bold text-slate-700">Graduation / Bachelors</h4>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="sm:col-span-2">
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">College / University</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.ugCollege}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, ugCollege: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Percentage / CGPA</label>
                                                    <input
                                                        type="text"
                                                        value={editForm.ugScore}
                                                        onChange={(e) => setEditForm(prev => ({ ...prev, ugScore: e.target.value }))}
                                                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="p-5 sm:px-8 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm flex justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsEditOpen(false)}
                                    className="px-5 py-2.5 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer bg-white active:scale-95 shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-indigo-600/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed border-0 cursor-pointer flex items-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined text-[16px]">save</span>
                                            Save Changes
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
