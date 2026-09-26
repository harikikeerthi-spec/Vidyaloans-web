"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { authApi, documentApi, onboardingApi, getCsrfToken, initializeCsrf } from "@/lib/api";
import Navbar from "@/components/Navbar";
import Link from "next/link";
import DigilockerConsentModal from "@/components/DigilockerConsentModal";
import AlertModal from "@/components/AlertModal";
import Swal from "sweetalert2";
import { getDocumentRequirementName, getProfileDocumentRequirements } from "@/lib/documentRequirements";

export default function DocumentVaultPage() {
    const { user, refreshUser } = useAuth();
    const [docs, setDocs] = useState<any[]>([]);
    const [profile, setProfile] = useState<any>(null);
    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadingDocs, setUploadingDocs] = useState<Record<string, boolean>>({});
    const [profileType, setProfileType] = useState<"salaried" | "self-employed">("salaried");
    const [coappRelation, setCoappRelation] = useState<string>("father");
    const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
    const [rejections, setRejections] = useState<Record<string, string>>({});
    const [showConsentModal, setShowConsentModal] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [alertState, setAlertState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: "success" | "error" | "info" | "warning";
    }>({
        isOpen: false,
        title: "",
        message: "",
        type: "info",
    });

    const [passportModalData, setPassportModalData] = useState<{
        isOpen: boolean;
        extracted?: {
            fatherName?: string;
            motherName?: string;
            fullName?: string;
            dob?: string;
            passportNo?: string;
            gender?: string;
            address?: string;
            raw?: any;
        };
    }>({ isOpen: false });

    const [parentDiscrepancyModalData, setParentDiscrepancyModalData] = useState<{
        isOpen: boolean;
        parentType?: 'father' | 'mother';
        docType?: string;
        extractedName?: string;
        existingName?: string;
        rawExtracted?: any;
    }>({ isOpen: false });

    const areNamesMatching = (name1?: string, name2?: string): boolean => {
        if (!name1 || !name2) return true;

        const cleanStr = (s: string) =>
            s.toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\b(mr|mrs|ms|dr|prof|shri|smt|shree|kumar|kumari)\b/g, '')
                .trim();

        const clean1 = cleanStr(name1);
        const clean2 = cleanStr(name2);

        if (!clean1 || !clean2) return true;
        if (clean1 === clean2) return true;

        const words1 = clean1.split(/\s+/).filter(Boolean);
        const words2 = clean2.split(/\s+/).filter(Boolean);

        // 1. Exact sorted token match (handles "BAPAIAH NAIDU CHEBROLU" vs "CHEBROLU BAPAIAH NAIDU")
        const sorted1 = [...words1].sort().join(' ');
        const sorted2 = [...words2].sort().join(' ');
        if (sorted1 === sorted2) return true;

        // 2. Token overlap check for names with initials or missing middle names
        const significant1 = words1.filter(w => w.length > 1);
        const significant2 = words2.filter(w => w.length > 1);

        if (significant1.length === 0 || significant2.length === 0) return true;

        const set1 = new Set(significant1);
        const set2 = new Set(significant2);

        let matches = 0;
        set1.forEach(w => {
            if (set2.has(w)) {
                matches++;
            } else {
                for (const w2 of set2) {
                    if (w.length >= 4 && w2.length >= 4 && (w.includes(w2) || w2.includes(w))) {
                        matches++;
                        break;
                    }
                }
            }
        });

        // If all significant words of either name exist in the other name, consider it a match
        const minSize = Math.min(set1.size, set2.size);
        if (matches >= minSize) return true;

        const matchRatio = matches / minSize;
        return matchRatio >= 0.6;
    };

    // Identity Document Requirement: Either Passport OR Aadhaar Card must be uploaded first
    const isPassportUploaded = docs.some(
        d => d.docType === 'passport' && (d.uploaded === true || d.status === 'uploaded' || d.status === 'verified')
    );
    const isAadhaarUploaded = docs.some(
        d => (d.docType === 'national_id' || d.docType === 'aadhar' || d.docType === 'aadhaar') && (d.uploaded === true || d.status === 'uploaded' || d.status === 'verified')
    );
    const hasIdentityDocUploaded = isPassportUploaded || isAadhaarUploaded;
    const isIdentityDocSlot = (type: string) => ['passport', 'national_id', 'aadhar', 'aadhaar'].includes(type.toLowerCase());

    // Parallel Bulk Upload State
    const [bulkQueue, setBulkQueue] = useState<Array<{
        id: string;
        file: File;
        docType: string;
        status: 'idle' | 'uploading' | 'success' | 'error';
        progress: number;
        error?: string;
    }>>([]);

    const guessDocType = (fileName: string): string => {
        const name = fileName.toLowerCase();
        if (name.includes("10th") || name.includes("ssc") || name.includes("marksheet_10")) return "marksheet_10";
        if (name.includes("12th") || name.includes("hsc") || name.includes("inter") || name.includes("marksheet_12")) return "marksheet_12";
        if (name.includes("ug") || name.includes("degree") || name.includes("univ") || name.includes("graduation")) return "ug_degree";
        if (name.includes("passport")) return "passport";

        const relations = ["father", "mother", "brother", "sister", "spouse", "coapplicant", "co_applicant", "guarantor", "guardian"];
        for (const rel of relations) {
            if (name.includes(rel)) {
                const normRel = rel === "co_applicant" ? "coapplicant" : rel;
                if (name.includes("aadhar") || name.includes("aadhaar")) return `${normRel}_aadhar`;
                if (name.includes("pan")) return `${normRel}_pan`;
            }
        }

        if (name.includes("pan")) return "pan";
        if (name.includes("aadhar") || name.includes("aadhaar") || name.includes("national_id")) return "national_id";
        return "";
    };

    const handleBulkFileChange = (files: FileList | null) => {
        if (!files) return;
        const newItems = Array.from(files).map(file => {
            const guessed = guessDocType(file.name);
            return {
                id: `${file.name}-${Date.now()}-${Math.random()}`,
                file,
                docType: guessed,
                status: 'idle' as const,
                progress: 0
            };
        });
        setBulkQueue(prev => [...prev, ...newItems]);
    };

    const removeQueueItem = (id: string) => {
        setBulkQueue(prev => prev.filter(item => item.id !== id));
    };

    const updateQueueItemDocType = (id: string, docType: string) => {
        setBulkQueue(prev => prev.map(item => item.id === id ? { ...item, docType } : item));
    };

    const clearBulkQueue = () => {
        setBulkQueue([]);
    };

    const handleParallelUpload = async () => {
        if (!hasIdentityDocUploaded) {
            showAlert("Identity Document Required First", "Please upload either your Passport or Aadhaar Card first before uploading other documents.", "warning");
            return;
        }

        const itemsToUpload = bulkQueue.filter(item => item.status === 'idle' || item.status === 'error');
        if (itemsToUpload.length === 0) return;

        setBulkQueue(prev => prev.map(item => {
            if (item.status === 'idle' || item.status === 'error') {
                return { ...item, status: 'uploading', progress: 0 };
            }
            return item;
        }));

        const token = localStorage.getItem("accessToken");

        const uploadPromises = itemsToUpload.map(async (item) => {
            if (!item.docType) {
                setBulkQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: "Select document type" } : q));
                return;
            }

            try {
                const formData = new FormData();
                formData.append('file', item.file);
                formData.append('userId', user?.id || "");
                formData.append('docType', item.docType);

                const existing = docs.find(d => d.docType === item.docType);
                const docName = existing?.docName || existing?.verificationMetadata?.docName || getDocumentRequirementName(item.docType, item.docType, getActiveProfile());
                if (docName) {
                    formData.append('docName', docName);
                }

                await new Promise<void>(async (resolve, reject) => {
                    let csrfToken = getCsrfToken();
                    if (!csrfToken) {
                        csrfToken = await initializeCsrf();
                    }

                    const xhr = new XMLHttpRequest();
                    xhr.withCredentials = true;
                    xhr.open('POST', '/api/documents/upload', true);
                    if (token) {
                        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
                    }
                    if (csrfToken) {
                        xhr.setRequestHeader('X-CSRF-Token', csrfToken);
                    }

                    xhr.upload.onprogress = (event) => {
                        if (event.lengthComputable) {
                            const progress = Math.round((event.loaded / event.total) * 100);
                            setBulkQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress } : q));
                        }
                    };

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            setBulkQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success', progress: 100 } : q));
                            resolve();
                        } else {
                            let errorMsg = `Server error: ${xhr.status}`;
                            try {
                                const responseJson = JSON.parse(xhr.responseText);
                                errorMsg = responseJson.message || responseJson.error || errorMsg;
                            } catch (e) { }
                            reject(new Error(errorMsg));
                        }
                    };

                    xhr.onerror = () => reject(new Error("Network error"));
                    xhr.send(formData);
                });
            } catch (err: any) {
                console.error("Parallel upload item error:", err);
                setBulkQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: err.message || "Upload failed" } : q));
            }
        });

        await Promise.all(uploadPromises);
        await loadDocs(true);

        const key = `dashboardDataUpdated_${user?.id}`;
        localStorage.setItem(key, String(Date.now()));
        // Success popup removed per user request: only show popups when rejected/failed
    };

    const showAlert = (title: string, message: string, type: "success" | "error" | "info" | "warning" = "info") => {
        // Only show popup alert when an error or warning occurs
        if (type === "success" || type === "info") return;

        Swal.fire({
            title: title,
            text: message,
            icon: type,
            confirmButtonColor: "#6605c7",
            customClass: {
                popup: "rounded-3xl shadow-2xl border border-purple-100 font-sans p-6",
                title: "text-lg font-black text-gray-900",
                htmlContainer: "text-xs font-medium text-gray-600",
                confirmButton: "px-6 py-2.5 bg-[#6605c7] hover:bg-[#5504a6] text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-purple-600/20 active:scale-95 cursor-pointer border-0",
            }
        });
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    const loadDocs = useCallback(async (silent = false) => {
        if (!user?.id) {
            setLoading(false);
            return;
        }
        if (!silent) {
            setLoading(true);
        }
        try {
            const res = await authApi.getDashboardData(user.id) as any;
            if (res.success) {
                setDocs(res.data.documents || []);
                setProfile(res.data.user || null);
                setApplications(res.data.applications || []);

                // Keep the salaried vs self-employed toggle in sync with the database
                const baseProfile = res.data.user || {};
                const coapp = baseProfile.coApplicant || {};
                const empType = coapp.employmentType || baseProfile.coApplicantEmploymentType || "";
                if (empType === "employed") {
                    setProfileType("salaried");
                } else if (empType.startsWith("self_employed")) {
                    setProfileType("self-employed");
                }

                // Sync co-applicant relation toggle
                const activeApp = res.data.applications?.[0] || null;
                const relation = coapp.relation || baseProfile.coApplicantRelation || activeApp?.coApplicantRelation || "father";
                setCoappRelation(relation);
            }
        } catch (e) {
            console.error("Error loading vault data:", e);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        loadDocs();
    }, [loadDocs]);

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const status = searchParams.get('status');
        const message = searchParams.get('message');

        if (status === 'success') {
            showAlert("Verification Success", message || "DigiLocker verification successful!", "success");
            window.history.replaceState({}, document.title, window.location.pathname);
            loadDocs();
        } else if (status === 'error') {
            showAlert("Verification Failed", message || "DigiLocker verification failed.", "error");
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [loadDocs]);

    const handleProfileTypeChange = async (type: "salaried" | "self-employed") => {
        setProfileType(type);
        if (!user?.id) return;

        // Merge this selection into the current user profile
        const baseProfile = profile || user || {};
        const coapp = baseProfile.coApplicant || {};
        const updatedCoApplicant = {
            ...coapp,
            employmentType: type === "salaried" ? "employed" : "self_employed_business",
            // Fallback name if co-applicant name isn't filled in yet
            name: coapp.name || baseProfile.coApplicantName || "Co-applicant"
        };

        const updatedProfile = {
            ...baseProfile,
            coApplicant: updatedCoApplicant
        };

        setProfile(updatedProfile);

        try {
            console.log("[VAULT] Syncing coapplicant employment type toggle to DB:", type);
            await onboardingApi.submit(updatedProfile);

            // Dispatch dynamic update event
            const key = `dashboardDataUpdated_${user.id}`;
            localStorage.setItem(key, String(Date.now()));
            window.dispatchEvent(new Event('dashboard-data-changed'));
        } catch (err) {
            console.error("Failed to persist coapplicant type toggle to database:", err);
        }
    };

    const handleCoappRelationChange = async (relation: string) => {
        setCoappRelation(relation);
        if (!user?.id) return;

        const baseProfile = profile || user || {};
        const coapp = baseProfile.coApplicant || {};
        const updatedCoApplicant = {
            ...coapp,
            relation: relation,
            name: relation === "father" ? (baseProfile.family?.fatherName || "Father") : relation === "mother" ? (baseProfile.family?.motherName || "Mother") : (coapp.name || relation.charAt(0).toUpperCase() + relation.slice(1))
        };

        const updatedProfile = {
            ...baseProfile,
            coApplicant: updatedCoApplicant
        };

        setProfile(updatedProfile);

        try {
            console.log("[VAULT] Syncing coapplicant relation toggle to DB:", relation);
            await onboardingApi.submit(updatedProfile);

            // Dispatch dynamic update event
            const key = `dashboardDataUpdated_${user.id}`;
            localStorage.setItem(key, String(Date.now()));
            window.dispatchEvent(new Event('dashboard-data-changed'));
        } catch (err) {
            console.error("Failed to persist coapplicant relation toggle to database:", err);
        }
    };

    const getActiveProfile = () => {
        const baseProfile = profile || user || {};

        // Ensure family details have defaults if not present so parent documents are shown
        let family = baseProfile.family || baseProfile.familyDetails || {};
        if (typeof family === 'string') {
            try { family = JSON.parse(family); } catch { family = {}; }
        }
        if (!family || typeof family !== 'object') family = {};

        const fatherName = family.fatherName || baseProfile.fatherName || "Father";
        const motherName = family.motherName || baseProfile.motherName || "Mother";
        const fatherEmploymentType = family.fatherEmploymentType || baseProfile.fatherEmploymentType || "employed";
        const motherEmploymentType = family.motherEmploymentType || baseProfile.motherEmploymentType || "employed";

        // Extract co-applicant details from the active application if available
        const activeApp = applications && applications.length > 0 ? applications[0] : null;
        const appCoappRelation = activeApp && activeApp.coApplicantRelation && activeApp.coApplicantRelation !== "none" ? activeApp.coApplicantRelation : "";

        // Ensure coApplicant has a default name and matches coappRelation
        let coapp = baseProfile.coApplicant || {};
        if (typeof coapp === 'string') {
            try { coapp = JSON.parse(coapp); } catch { coapp = {}; }
        }
        if (!coapp || typeof coapp !== 'object') coapp = {};

        const dbRelation = appCoappRelation || baseProfile.coApplicantRelation || coapp.relation || "";
        const fallbackName = dbRelation ? dbRelation.charAt(0).toUpperCase() + dbRelation.slice(1) : "Co-applicant";
        const coappName = coapp.name || baseProfile.coApplicantName || activeApp?.coApplicantName || fallbackName;

        return {
            ...baseProfile,
            family: {
                ...family,
                fatherName,
                motherName,
                fatherEmploymentType,
                motherEmploymentType
            },
            coApplicant: {
                ...coapp,
                name: coappName,
                relation: dbRelation || coappRelation,
                employmentType: coapp.employmentType || "employed"
            }
        };
    };

    const getDocIcon = (type: string) => {
        const t = type.toLowerCase();
        if (t.includes("passport")) return "travel_explore";
        if (t.includes("aadhar") || t.includes("national_id")) return "fingerprint";
        if (t.includes("pan")) return "credit_card";
        if (t.includes("marksheet") || t.includes("transcript") || t.includes("degree")) return "school";
        if (t.includes("test") || t.includes("score")) return "analytics";
        if (t.includes("offer") || t.includes("letter") || t.includes("cv") || t.includes("resume")) return "description";
        if (t.includes("salary") || t.includes("slip")) return "payments";
        if (t.includes("bank") || t.includes("statement")) return "account_balance";
        if (t.includes("itr") || t.includes("tax")) return "receipt_long";
        if (t.includes("business") || t.includes("license") || t.includes("udyam")) return "store";
        if (t.includes("balance") || t.includes("sheet") || t.includes("monitoring")) return "monitoring";
        if (t.includes("bill") || t.includes("electricity")) return "receipt_long";
        return "description";
    };

    const handleConfirmPassportDetails = async () => {
        if (!passportModalData?.extracted || !user?.id) return;
        const { fatherName, motherName, fullName, dob, gender, address } = passportModalData.extracted;

        const baseProfile = profile || user || {};
        let family = baseProfile.family || baseProfile.familyDetails || {};
        if (typeof family === 'string') {
            try { family = JSON.parse(family); } catch { family = {}; }
        }
        if (!family || typeof family !== 'object') family = {};

        let coapp = baseProfile.coApplicant || {};
        if (typeof coapp === 'string') {
            try { coapp = JSON.parse(coapp); } catch { coapp = {}; }
        }
        if (!coapp || typeof coapp !== 'object') coapp = {};

        const updatedFamily = {
            ...family,
            ...(fatherName ? { fatherName } : {}),
            ...(motherName ? { motherName } : {}),
            ...(fullName ? { passportOriginalName: fullName } : {}),
        };

        const rel = (coapp.relation || coappRelation || '').toLowerCase().trim();
        let updatedCoapp = { ...coapp };
        if (rel === 'father' && fatherName) {
            updatedCoapp.name = fatherName;
        } else if (rel === 'mother' && motherName) {
            updatedCoapp.name = motherName;
        }

        let parsedFirstName: string | undefined = undefined;
        let parsedLastName: string | undefined = undefined;
        if (fullName) {
            const parts = fullName.trim().split(/\s+/);
            if (parts.length === 1) {
                parsedFirstName = parts[0];
                parsedLastName = "";
            } else if (parts.length > 1) {
                parsedFirstName = parts.slice(0, -1).join(" ");
                parsedLastName = parts[parts.length - 1];
            }
        }

        const updatedProfile = {
            ...baseProfile,
            ...(parsedFirstName ? { firstName: parsedFirstName } : {}),
            ...(parsedLastName !== undefined ? { lastName: parsedLastName } : {}),
            ...(fullName ? { passportOriginalName: fullName, nameAsInPassport: fullName } : {}),
            ...(dob ? { dob, dateOfBirth: dob } : {}),
            ...(gender ? { gender } : {}),
            ...(address ? { address } : {}),
            family: updatedFamily,
            coApplicant: updatedCoapp
        };

        setProfile(updatedProfile);
        setPassportModalData(prev => ({ ...prev, isOpen: false }));

        try {
            await onboardingApi.submit(updatedProfile);
            const key = `dashboardDataUpdated_${user.id}`;
            localStorage.setItem(key, String(Date.now()));
            window.dispatchEvent(new Event('dashboard-data-changed'));
            showAlert("Profile Updated", "Your profile and family details have been updated from your Passport!", "success");
            await loadDocs(true);
        } catch (err: any) {
            console.error("Failed to update profile from passport details:", err);
            showAlert("Update Notice", "Saved Passport to vault, but profile autofill update encountered an issue.", "info");
        }
    };

    const handleOverwriteParentDetails = async () => {
        if (!parentDiscrepancyModalData?.extractedName || !user?.id) return;
        const { parentType, extractedName } = parentDiscrepancyModalData;

        const baseProfile = profile || user || {};
        let family = baseProfile.family || baseProfile.familyDetails || {};
        if (typeof family === 'string') {
            try { family = JSON.parse(family); } catch { family = {}; }
        }
        if (!family || typeof family !== 'object') family = {};

        let coapp = baseProfile.coApplicant || {};
        if (typeof coapp === 'string') {
            try { coapp = JSON.parse(coapp); } catch { coapp = {}; }
        }
        if (!coapp || typeof coapp !== 'object') coapp = {};

        const updatedFamily = {
            ...family,
            ...(parentType === 'father' ? { fatherName: extractedName } : { motherName: extractedName }),
        };

        const rel = (coapp.relation || coappRelation || '').toLowerCase().trim();
        let updatedCoapp = { ...coapp };
        if (rel === parentType) {
            updatedCoapp.name = extractedName;
        }

        const updatedProfile = {
            ...baseProfile,
            family: updatedFamily,
            coApplicant: updatedCoapp
        };

        setProfile(updatedProfile);
        setParentDiscrepancyModalData(prev => ({ ...prev, isOpen: false }));

        try {
            await onboardingApi.submit(updatedProfile);
            const key = `dashboardDataUpdated_${user.id}`;
            localStorage.setItem(key, String(Date.now()));
            window.dispatchEvent(new Event('dashboard-data-changed'));
            showAlert("Parent Details Updated", `${parentType === 'father' ? 'Father' : 'Mother'} name updated to "${extractedName}" in your profile.`, "success");
            await loadDocs(true);
        } catch (err: any) {
            console.error("Failed to update parent details:", err);
            showAlert("Update Notice", "Saved document to vault, but profile overwrite encountered an issue.", "info");
        }
    };

    const triggerFileInput = (docType: string) => {
        if (!isIdentityDocSlot(docType) && !hasIdentityDocUploaded) {
            showAlert("Identity Document Required First", "Please upload either your Passport or Aadhaar Card first to unlock all other document upload slots.", "warning");
            return;
        }
        const input = document.getElementById(`file-input-${docType}`) as HTMLInputElement;
        if (input) input.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, docType: string, docName?: string) => {
        if (!isIdentityDocSlot(docType) && !hasIdentityDocUploaded) {
            showAlert("Identity Document Required First", "Please upload either your Passport or Aadhaar Card first before uploading other documents.", "warning");
            return;
        }
        const file = e.target.files?.[0];
        if (!file || !user?.id) {
            showAlert("Information Missing", "File or user information is missing.", "warning");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            showAlert("File Too Large", "File size exceeds the 5MB limit.", "warning");
            return;
        }

        const validFileTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!validFileTypes.includes(file.type)) {
            showAlert("Invalid File Type", "File must be JPG, PNG, or PDF format.", "warning");
            return;
        }

        const fileNameLower = file.name.toLowerCase();
        const docTypeLower = docType.toLowerCase();

        if (docTypeLower.includes('aadhar') || docTypeLower.includes('aadhaar') || docTypeLower.includes('national_id')) {
            const nonAadhaarKeywords = ['pan', 'passport', 'marksheet', '10th', '12th', 'degree', 'graduation', 'transcript', 'certificate', 'salary', 'slip', 'bank', 'statement', 'passbook', 'cheque', 'voter', 'license', 'driving', 'bill', 'tax', 'itr'];
            const matchedKey = nonAadhaarKeywords.find(kw => fileNameLower.includes(kw));
            if (matchedKey) {
                showAlert(
                    "Wrong Document Type",
                    `You selected a "${file.name}" file for an Aadhaar Card slot. Only official Aadhaar Cards with a 12-digit Aadhaar number can be uploaded here.`,
                    "warning"
                );
                return;
            }
        }

        if (docTypeLower.includes('pan') && !docTypeLower.includes('company')) {
            const nonPanKeywords = ['aadhar', 'aadhaar', 'passport', 'marksheet', '10th', '12th', 'degree', 'graduation', 'transcript', 'certificate', 'salary', 'slip', 'bank', 'statement', 'passbook', 'cheque', 'voter', 'license', 'driving', 'bill'];
            const matchedKey = nonPanKeywords.find(kw => fileNameLower.includes(kw));
            if (matchedKey) {
                showAlert(
                    "Wrong Document Type",
                    `You selected a "${file.name}" file for a PAN Card slot. Only official Indian PAN Cards with a valid 10-character PAN number can be uploaded here.`,
                    "warning"
                );
                return;
            }
        }

        if (docTypeLower.includes('passport')) {
            const nonPassportKeywords = ['aadhar', 'aadhaar', 'pan', 'marksheet', '10th', '12th', 'degree', 'graduation', 'transcript', 'certificate', 'salary', 'slip', 'bank', 'statement', 'passbook', 'cheque', 'bill', 'tax', 'itr'];
            const matchedKey = nonPassportKeywords.find(kw => fileNameLower.includes(kw));
            if (matchedKey) {
                showAlert(
                    "Wrong Document Type",
                    `You selected a "${file.name}" file for a Passport slot. Only official Passports (containing both Front and Back pages) can be uploaded here.`,
                    "warning"
                );
                return;
            }
        }

        // Pre-upload check: Detect if the same file is already uploaded under ANOTHER document slot
        const duplicateSlotDoc = docs.find(
            d => d.docType.toLowerCase() !== docType.toLowerCase() &&
                (d.uploaded === true || d.status === 'uploaded' || d.status === 'verified') &&
                d.fileName && d.fileName.toLowerCase() === file.name.toLowerCase()
        );
        if (duplicateSlotDoc) {
            const slotTitle = duplicateSlotDoc.docName || duplicateSlotDoc.verificationMetadata?.docName || getDocumentRequirementName(duplicateSlotDoc.docType, duplicateSlotDoc.docType, activeProfile);
            showAlert(
                "Duplicate Document Selected",
                `The file "${file.name}" is already uploaded under "${slotTitle}". Please select the correct document file for ${docName || docType.replace(/_/g, ' ').toUpperCase()}.`,
                "warning"
            );
            e.target.value = "";
            return;
        }

        // Pre-upload check: Detect if this document is ALREADY uploaded for this specific user
        const existingDoc = docs.find(
            d => d.docType.toLowerCase() === docType.toLowerCase() && (d.uploaded === true || d.status === 'uploaded' || d.status === 'verified')
        );
        const isAlreadyUploaded = !!existingDoc;

        if (isAlreadyUploaded) {
            const documentTitle = docName || existingDoc?.docName || existingDoc?.verificationMetadata?.docName || docType.replace(/_/g, ' ').toUpperCase();
            const currentStatus = existingDoc?.status?.toUpperCase() || 'UPLOADED';

            const confirmOverwrite = window.confirm(
                `Notice: You have already uploaded a document for "${documentTitle}" (Status: ${currentStatus}).\n\n` +
                `Re-uploading will replace your previous document file. Do you want to overwrite it?`
            );

            if (!confirmOverwrite) {
                e.target.value = "";
                return;
            }
        }

        setUploadingDocs(prev => ({ ...prev, [docType]: true }));
        try {
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrls(prev => ({ ...prev, [docType]: objectUrl }));

            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', user.id);
            formData.append('docType', docType);
            if (docName) {
                formData.append('docName', docName);
            } else {
                const existing = docs.find(d => d.docType === docType);
                const name = existing?.docName || existing?.verificationMetadata?.docName;
                if (name) {
                    formData.append('docName', name);
                }
            }

            const token = localStorage.getItem("accessToken");
            let csrfToken = getCsrfToken();
            if (!csrfToken) {
                csrfToken = await initializeCsrf();
            }

            const headersObj: Record<string, string> = {};
            if (token) headersObj["Authorization"] = `Bearer ${token}`;
            if (csrfToken) headersObj["X-CSRF-Token"] = csrfToken;

            console.log("Starting file upload for docType:", docType, "file:", file.name, "size:", file.size);

            let response = await fetch(`/api/documents/upload`, {
                method: 'POST',
                credentials: 'include',
                headers: headersObj,
                body: formData
            });

            // Handle 403 CSRF mismatch retry once with a fresh token
            if (response.status === 403) {
                const freshCsrf = await initializeCsrf(true);
                if (freshCsrf) {
                    headersObj["X-CSRF-Token"] = freshCsrf;
                    response = await fetch(`/api/documents/upload`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: headersObj,
                        body: formData
                    });
                }
            }

            console.log("Upload response status:", response.status, response.statusText);

            if (!response.ok) {
                let errorMessage = `Server error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    if (errorData.message) {
                        errorMessage = errorData.message;
                    } else if (errorData.error) {
                        errorMessage = errorData.error;
                    }
                } catch (parseError) {
                    try {
                        const text = await response.text();
                        if (text) errorMessage = text;
                    } catch (textError) { }
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log("Upload successful:", result);

            await loadDocs(true);

            const key = `dashboardDataUpdated_${user.id}`;
            localStorage.setItem(key, String(Date.now()));
            window.dispatchEvent(new Event('dashboard-data-changed'));

            const extracted = result.data?.ocrResult?.extractedFields || result.data?.verification?.details?.extractedFields || {};

            if (isIdentityDocSlot(docType)) {
                const isPassport = docType.toLowerCase().includes('passport');
                const isAadhaar = docType.toLowerCase().includes('aadhar') || docType.toLowerCase().includes('aadhaar') || docType.toLowerCase().includes('national_id');

                const fatherName = extracted.father_name || extracted.fatherName || extracted.father_full_name;
                const motherName = extracted.mother_name || extracted.motherName || extracted.mother_full_name;
                const fullName = extracted.full_name || extracted.fullName || (extracted.given_names ? `${extracted.given_names} ${extracted.surname || ''}`.trim() : undefined) || extracted.person_name || extracted.holder_name || extracted.name || extracted.applicant_name;
                const dob = extracted.dob || extracted.date_of_birth;
                const docNum = extracted.passport_number || extracted.passportNo || extracted.aadhaarNumber || extracted.aadhar_number;
                const gender = extracted.gender;
                const address = typeof extracted.address === 'string' ? extracted.address : (extracted.address?.address1 ? `${extracted.address.address1}, ${extracted.address.city || ''}` : undefined);

                if (fatherName || motherName || fullName || dob || docNum) {
                    try {
                        const baseProfile = profile || user || {};
                        let family = baseProfile.family || baseProfile.familyDetails || {};
                        if (typeof family === 'string') { try { family = JSON.parse(family); } catch { family = {}; } }
                        if (!family || typeof family !== 'object') family = {};

                        const hasExistingPassport = !!(baseProfile.passportOriginalName || family.passportOriginalName);

                        const updatedFamily = {
                            ...family,
                            ...(isPassport && fatherName ? { fatherName } : {}),
                            ...(isPassport && motherName ? { motherName } : {}),
                            ...(isPassport && fullName ? { passportOriginalName: fullName } : {}),
                            ...(isAadhaar && fullName ? { aadhaarOriginalName: fullName } : {}),
                        };

                        let parsedFirstName: string | undefined = undefined;
                        let parsedLastName: string | undefined = undefined;
                        if (fullName && (isPassport || !hasExistingPassport)) {
                            const parts = fullName.trim().split(/\s+/);
                            if (parts.length === 1) {
                                parsedFirstName = parts[0];
                                parsedLastName = "";
                            } else if (parts.length > 1) {
                                parsedFirstName = parts.slice(0, -1).join(" ");
                                parsedLastName = parts[parts.length - 1];
                            }
                        }

                        const updatedProfile = {
                            ...baseProfile,
                            ...(parsedFirstName ? { firstName: parsedFirstName } : {}),
                            ...(parsedLastName !== undefined ? { lastName: parsedLastName } : {}),
                            ...(isPassport && fullName ? { passportOriginalName: fullName, nameAsInPassport: fullName } : {}),
                            ...(isAadhaar && fullName ? { aadhaarOriginalName: fullName } : {}),
                            ...(dob && (isPassport || !hasExistingPassport) ? { dob, dateOfBirth: dob } : {}),
                            ...(gender && (isPassport || !hasExistingPassport) ? { gender } : {}),
                            ...(address ? { address } : {}),
                            family: updatedFamily,
                            ...(isPassport && fatherName ? { fatherName } : {}),
                            ...(isPassport && motherName ? { motherName } : {})
                        };
                        setProfile(updatedProfile);
                        await onboardingApi.submit(updatedProfile);
                        if (user?.email && parsedFirstName) {
                            await authApi.updateDetails(user.email, {
                                firstName: parsedFirstName,
                                lastName: parsedLastName || "",
                                phoneNumber: user.phoneNumber || "",
                                dateOfBirth: user.dateOfBirth || ""
                            });
                        }
                        if (refreshUser) await refreshUser();
                    } catch (err) {
                        console.error("Auto identity profile update error:", err);
                    }
                }
            }

            const docTypeLower = docType.toLowerCase();
            const isCoappDoc = docTypeLower.includes('coapplicant') || docTypeLower.includes('coapp') || docTypeLower.includes('co_applicant');
            const isFatherDoc = docTypeLower.includes('father') && !isCoappDoc;
            const isMotherDoc = docTypeLower.includes('mother') && !isCoappDoc;
            const isStudentDoc = !isFatherDoc && !isMotherDoc && !isCoappDoc;

            if (isCoappDoc) {
                const extractedCoappName = extracted.full_name || extracted.fullName || extracted.person_name || extracted.holder_name || extracted.name || extracted.printed_name || extracted.applicant_name;
                const activeProf = getActiveProfile();
                const existingCoappName = (activeProf.coApplicant?.name || activeProf.coApplicantName || "").trim();

                const baseProfile = profile || user || {};
                let coapp = baseProfile.coApplicant || {};
                if (typeof coapp === 'string') { try { coapp = JSON.parse(coapp); } catch { coapp = {}; } }
                if (!coapp || typeof coapp !== 'object') coapp = {};

                const isGenericName = !existingCoappName || ['co-applicant', 'coapplicant', 'father', 'mother', 'spouse', 'sibling', 'uncle', 'aunt', 'grandparent', 'other', 'none', 'na', 'n/a'].includes(existingCoappName.toLowerCase().trim());

                if (extractedCoappName) {
                    if (isGenericName || areNamesMatching(extractedCoappName, existingCoappName)) {
                        const updatedCoapp = { ...coapp, name: extractedCoappName };
                        const updatedProfile = { ...baseProfile, coApplicant: updatedCoapp, coApplicantName: extractedCoappName };
                        setProfile(updatedProfile);
                        await onboardingApi.submit(updatedProfile);
                        if (refreshUser) await refreshUser();
                        await loadDocs(true);
                    } else {
                        const promptRes = await Swal.fire({
                            title: "Name Discrepancy Detected",
                            html: `<div class="text-left text-xs space-y-3 font-sans">
                                <p class="text-gray-600 font-medium">Your uploaded document <strong>(${docType.replace(/_/g, ' ').toUpperCase()})</strong> contains a different co-applicant's name than your existing record.</p>
                                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <span class="block text-[10px] font-bold text-slate-400 uppercase">Existing Record</span>
                                    <span class="font-extrabold text-slate-800">${existingCoappName}</span>
                                </div>
                                <div class="p-3 bg-purple-50 rounded-xl border border-purple-200">
                                    <span class="block text-[10px] font-bold text-[#6605c7] uppercase">Newly Uploaded Document Data</span>
                                    <span class="font-extrabold text-[#6605c7]">${extractedCoappName}</span>
                                </div>
                                <p class="text-slate-700 font-bold pt-1">Would you like to keep the old data or update to the new co-applicant's name?</p>
                            </div>`,
                            icon: "warning",
                            showCancelButton: true,
                            confirmButtonText: "ADD NEW DATA",
                            cancelButtonText: "KEEP OLD DATA",
                            confirmButtonColor: "#6605c7",
                            cancelButtonColor: "#475569",
                            customClass: {
                                popup: "rounded-3xl shadow-2xl border border-purple-100 font-sans p-6",
                                title: "text-lg font-black text-gray-900",
                                confirmButton: "px-5 py-2.5 bg-[#6605c7] hover:bg-[#5504a6] text-white font-black text-xs uppercase tracking-wider rounded-xl border-0 cursor-pointer shadow-md",
                                cancelButton: "px-5 py-2.5 bg-slate-600 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider rounded-xl border-0 cursor-pointer shadow-md"
                            }
                        });

                        if (promptRes.isConfirmed) {
                            const updatedCoapp = { ...coapp, name: extractedCoappName };
                            const updatedProfile = { ...baseProfile, coApplicant: updatedCoapp, coApplicantName: extractedCoappName };
                            setProfile(updatedProfile);
                            await onboardingApi.submit(updatedProfile);
                            if (refreshUser) await refreshUser();
                            await loadDocs(true);
                            showAlert("Details Updated", `Updated co-applicant's name to "${extractedCoappName}".`, "success");
                        }
                    }
                }
            } else if (isFatherDoc || isMotherDoc) {
                const parentType = isFatherDoc ? 'father' : 'mother';
                const extractedParentName = isFatherDoc
                    ? (extracted.full_name || extracted.fullName || extracted.person_name || extracted.holder_name || extracted.name || extracted.printed_name || extracted.applicant_name)
                    : (extracted.full_name || extracted.fullName || extracted.person_name || extracted.holder_name || extracted.name || extracted.printed_name || extracted.applicant_name || extracted.mother_name || extracted.motherName);

                const activeProf = getActiveProfile();
                const existingParentName = parentType === 'father'
                    ? (activeProf.family?.fatherName || activeProf.fatherName || "")
                    : (activeProf.family?.motherName || activeProf.motherName || "");

                if (extractedParentName && existingParentName && !areNamesMatching(extractedParentName, existingParentName)) {
                    const promptRes = await Swal.fire({
                        title: "Name Discrepancy Detected",
                        html: `<div class="text-left text-xs space-y-3 font-sans">
                            <p class="text-gray-600 font-medium">Your uploaded document <strong>(${docType.replace(/_/g, ' ').toUpperCase()})</strong> contains a different ${parentType}'s name than your existing record.</p>
                            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span class="block text-[10px] font-bold text-slate-400 uppercase">Existing Record (Passport / Profile)</span>
                                <span class="font-extrabold text-slate-800">${existingParentName}</span>
                            </div>
                            <div class="p-3 bg-purple-50 rounded-xl border border-purple-200">
                                <span class="block text-[10px] font-bold text-[#6605c7] uppercase">Newly Uploaded Document Data</span>
                                <span class="font-extrabold text-[#6605c7]">${extractedParentName}</span>
                            </div>
                            <p class="text-slate-700 font-bold pt-1">Would you like to keep the old data or add the new data in place of the old data?</p>
                        </div>`,
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonText: "ADD NEW DATA",
                        cancelButtonText: "KEEP OLD DATA",
                        confirmButtonColor: "#6605c7",
                        cancelButtonColor: "#475569",
                        customClass: {
                            popup: "rounded-3xl shadow-2xl border border-purple-100 font-sans p-6",
                            title: "text-lg font-black text-gray-900",
                            confirmButton: "px-5 py-2.5 bg-[#6605c7] hover:bg-[#5504a6] text-white font-black text-xs uppercase tracking-wider rounded-xl border-0 cursor-pointer shadow-md",
                            cancelButton: "px-5 py-2.5 bg-slate-600 hover:bg-slate-700 text-white font-black text-xs uppercase tracking-wider rounded-xl border-0 cursor-pointer shadow-md"
                        }
                    });

                    const baseProfile = profile || user || {};
                    let family = baseProfile.family || baseProfile.familyDetails || {};
                    if (typeof family === 'string') { try { family = JSON.parse(family); } catch { family = {}; } }
                    if (!family || typeof family !== 'object') family = {};

                    let coapp = baseProfile.coApplicant || {};
                    if (typeof coapp === 'string') { try { coapp = JSON.parse(coapp); } catch { coapp = {}; } }
                    if (!coapp || typeof coapp !== 'object') coapp = {};

                    const rel = (coapp.relation || coappRelation || '').toLowerCase().trim();

                    if (promptRes.isConfirmed) {
                        const updatedFamily = {
                            ...family,
                            ...(parentType === 'father' ? { fatherName: extractedParentName } : { motherName: extractedParentName }),
                        };
                        let updatedCoapp = { ...coapp };
                        if (rel === parentType) {
                            updatedCoapp.name = extractedParentName;
                        }
                        const updatedProfile = {
                            ...baseProfile,
                            family: updatedFamily,
                            coApplicant: updatedCoapp,
                            ...(parentType === 'father' ? { fatherName: extractedParentName } : { motherName: extractedParentName })
                        };
                        setProfile(updatedProfile);
                        await onboardingApi.submit(updatedProfile);
                        if (refreshUser) await refreshUser();
                        await loadDocs(true);
                        showAlert("Details Updated", `Added new ${parentType}'s name "${extractedParentName}" in place of old data.`, "success");
                    } else {
                        const updatedFamily = {
                            ...family,
                            ...(parentType === 'father' ? { fatherName: existingParentName } : { motherName: existingParentName }),
                        };
                        let updatedCoapp = { ...coapp };
                        if (rel === parentType) {
                            updatedCoapp.name = existingParentName;
                        }
                        const updatedProfile = {
                            ...baseProfile,
                            family: updatedFamily,
                            coApplicant: updatedCoapp,
                            ...(parentType === 'father' ? { fatherName: existingParentName } : { motherName: existingParentName })
                        };
                        setProfile(updatedProfile);
                        await onboardingApi.submit(updatedProfile);
                        if (refreshUser) await refreshUser();
                        await loadDocs(true);
                        showAlert("Record Retained", `Kept existing ${parentType}'s name "${existingParentName}".`, "info");
                    }
                }
            } else if (isStudentDoc && !isIdentityDocSlot(docType)) {
                const extractedStudentName = extracted.full_name || extracted.fullName || (extracted.given_names ? `${extracted.given_names} ${extracted.surname || ''}`.trim() : undefined) || extracted.person_name || extracted.holder_name || extracted.name;
                const activeProf = getActiveProfile();
                const existingStudentName = activeProf.passportOriginalName || activeProf.nameAsInPassport || (activeProf.firstName ? `${activeProf.firstName} ${activeProf.lastName || ''}`.trim() : "");

                if (extractedStudentName && existingStudentName && !areNamesMatching(extractedStudentName, existingStudentName)) {
                    // Reject upload & delete file from server!
                    try {
                        await documentApi.deleteFile(user.id, docType);
                        await loadDocs(true);
                    } catch (delErr) {
                        console.error("Failed to delete rejected student document:", delErr);
                    }

                    await Swal.fire({
                        title: "Upload Rejected - Name Mismatch",
                        html: `<div class="text-left text-xs space-y-3 font-sans">
                            <p class="text-rose-600 font-bold">The student name on this document does not match your registered profile record.</p>
                            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <span class="block text-[10px] font-bold text-slate-400 uppercase">Registered Record Name</span>
                                <span class="font-extrabold text-slate-800">${existingStudentName}</span>
                            </div>
                            <div class="p-3 bg-rose-50 rounded-xl border border-rose-200">
                                <span class="block text-[10px] font-bold text-rose-600 uppercase">Document Extracted Name</span>
                                <span class="font-extrabold text-rose-900">${extractedStudentName}</span>
                            </div>
                            <p class="text-slate-600 font-medium pt-1">For security & verification, student documents must match your registered name. This upload has been cancelled.</p>
                        </div>`,
                        icon: "error",
                        confirmButtonText: "OK, UNDERSTOOD",
                        confirmButtonColor: "#E11D48",
                        customClass: {
                            popup: "rounded-3xl shadow-2xl border border-rose-100 font-sans p-6",
                            title: "text-lg font-black text-rose-900",
                            confirmButton: "px-6 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl border-0 cursor-pointer shadow-md"
                        }
                    });

                    e.target.value = "";
                    return;
                }
            }
            // Success/Updated popups removed per user request: only show popups on rejection or failure

        } catch (e: any) {
            console.error("Upload error:", e.message || e);
            showAlert("Upload Failed", e.message || "Unknown error occurred.", "error");
        } finally {
            setUploadingDocs(prev => ({ ...prev, [docType]: false }));
        }
    };

    const handleDigilockerVerify = async (docType: string) => {
        if (!isIdentityDocSlot(docType) && !hasIdentityDocUploaded) {
            showAlert("Identity Document Required First", "Please upload either your Passport or Aadhaar Card first before using DigiLocker verification.", "warning");
            return;
        }
        if (!user?.id) {
            showAlert("User Identity Missing", "User identity not found. Please refresh the page.", "error");
            refreshUser();
            return;
        }
        window.location.href = `/api/digilocker/authorize?userId=${encodeURIComponent(user.id)}&docType=${encodeURIComponent(docType)}`;
    };

    const handleSyncFromDigilocker = async (docType: string) => {
        if (!isIdentityDocSlot(docType) && !hasIdentityDocUploaded) {
            showAlert("Identity Document Required First", "Please upload either your Passport or Aadhaar Card first before syncing other documents.", "warning");
            return;
        }
        if (!user?.id) return;
        setUploadingDocs(prev => ({ ...prev, [docType]: true }));
        try {
            const result: any = await documentApi.syncFromDigilocker(user.id, docType);
            if (result.success) {
                showAlert("Sync Success", "Successfully synced from DigiLocker!", "success");
                await loadDocs(true);
            } else {
                showAlert("Sync Failed", result.message || "Failed to sync document.", "error");
            }
        } catch (e) {
            console.error(e);
            showAlert("Sync Error", "An error occurred during sync.", "error");
        } finally {
            setUploadingDocs(prev => ({ ...prev, [docType]: false }));
        }
    };

    const handleView = (docType: string) => {
        const existing = docs.find(d => d.docType === docType);
        if (existing?.uploaded && user?.id) {
            const viewUrl = `/api/documents/view/${user.id}/${docType}`;
            window.open(viewUrl, '_blank');
        } else {
            showAlert("Document Unavailable", "Document file is not available.", "warning");
        }
    };

    const handleDelete = async (docType: string, deleteCard: boolean = false) => {
        if (!user?.id) return;
        if (!confirm(deleteCard ? "Are you sure you want to completely remove this custom document placeholder?" : "Are you sure you want to delete this uploaded document?")) return;

        setUploadingDocs(prev => ({ ...prev, [docType]: true }));
        try {
            if (deleteCard) {
                await documentApi.delete(user.id, docType);
            } else {
                await documentApi.deleteFile(user.id, docType);
            }
            await loadDocs(true);
            showAlert("Delete Success", deleteCard ? "Custom document placeholder removed." : "Document deleted successfully.", "success");
        } catch (e) {
            console.error(e);
            showAlert("Delete Failed", "Failed to delete document.", "error");
        } finally {
            setUploadingDocs(prev => ({ ...prev, [docType]: false }));
        }
    };

    const handleAddOtherDocument = async (category: "student" | "coapplicant" | "parent") => {
        if (!hasIdentityDocUploaded) {
            showAlert("Identity Document Required First", "Please upload either your Passport or Aadhaar Card first before adding other document slots.", "warning");
            return;
        }
        const docName = prompt("Enter the name of the document you want to add:");
        if (!docName || !docName.trim()) return;

        // Generate safe unique key
        const sanitized = docName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').trim();
        const docType = `${category}_other_${sanitized}_${Date.now()}`;

        setUploadingDocs(prev => ({ ...prev, adding_requirement: true }));
        try {
            if (!user?.id) throw new Error("User session expired. Please refresh.");
            await documentApi.addRequirement(user.id, docType, docName.trim());

            showAlert("Added Success", `Placeholder for ${docName.trim()} created successfully!`, "success");
            await loadDocs(true);

            const key = `dashboardDataUpdated_${user?.id}`;
            localStorage.setItem(key, String(Date.now()));
            window.dispatchEvent(new Event('dashboard-data-changed'));
        } catch (e: any) {
            console.error("Add requirement error:", e.message || e);
            showAlert("Failed", e.message || "Unknown error occurred.", "error");
        } finally {
            setUploadingDocs(prev => ({ ...prev, adding_requirement: false }));
        }
    };

    // Dynamically calculate requirements
    const activeProfile = getActiveProfile();
    const allRequiredDocs = getProfileDocumentRequirements(activeProfile);

    // Merge standard requirements with dynamically uploaded custom documents
    const studentDocs = [
        ...allRequiredDocs.filter(req =>
            !req.type.startsWith('coapplicant_') &&
            !req.type.startsWith('father_') &&
            !req.type.startsWith('mother_') &&
            !req.type.startsWith('parent_')
        ).map(req => ({
            type: req.type,
            label: req.label,
            icon: getDocIcon(req.type)
        })),
        ...docs.filter(doc => doc?.docType && (doc.docType.startsWith('student_other_') || doc.docType.startsWith('other_student_')) && !allRequiredDocs.some(req => req.type === doc.docType))
            .map(doc => ({
                type: doc.docType,
                label: doc.docName || doc.verificationMetadata?.docName || doc.docType.replace(/^(student_other_|other_student_)/, '').replace(/_/g, ' '),
                icon: "description"
            }))
    ];

    const coappDocs = [
        ...allRequiredDocs.filter(req =>
            req.type.startsWith('coapplicant_')
        ).map(req => ({
            type: req.type,
            label: req.label,
            icon: getDocIcon(req.type)
        })),
        ...docs.filter(doc => doc?.docType && (doc.docType.startsWith('coapplicant_other_') || doc.docType.startsWith('other_coapplicant_')) && !allRequiredDocs.some(req => req.type === doc.docType))
            .map(doc => ({
                type: doc.docType,
                label: doc.docName || doc.verificationMetadata?.docName || doc.docType.replace(/^(coapplicant_other_|other_coapplicant_)/, '').replace(/_/g, ' '),
                icon: "description"
            }))
    ];

    const parentDocs = [
        ...allRequiredDocs.filter(req =>
            req.type.startsWith('father_') ||
            req.type.startsWith('mother_') ||
            req.type.startsWith('parent_')
        ).map(req => ({
            type: req.type,
            label: req.label,
            icon: getDocIcon(req.type)
        })),
        ...docs.filter(doc => doc?.docType && (doc.docType.startsWith('parent_other_') || doc.docType.startsWith('other_parent_')) && !allRequiredDocs.some(req => req.type === doc.docType))
            .map(doc => ({
                type: doc.docType,
                label: doc.docName || doc.verificationMetadata?.docName || doc.docType.replace(/^(parent_other_|other_parent_)/, '').replace(/_/g, ' '),
                icon: "description"
            }))
    ];

    const staffRequestedDocs = docs
        .filter((doc) =>
            doc?.docType &&
            !allRequiredDocs.some((req) => req.type === doc.docType) &&
            !doc.docType.startsWith('student_other_') && !doc.docType.startsWith('other_student_') &&
            !doc.docType.startsWith('coapplicant_other_') && !doc.docType.startsWith('other_coapplicant_') &&
            !doc.docType.startsWith('parent_other_') && !doc.docType.startsWith('other_parent_')
        )
        .map((doc) => ({
            type: doc.docType,
            label: getDocumentRequirementName(doc.docType, doc.docName || doc.verificationMetadata?.docName || doc.docType, activeProfile),
            icon: "description",
        }));

    const uploadedCount = docs.filter(d => d.uploaded).length;

    const findDocForRequirement = (reqType: string) => {
        const direct = docs.find(d => d.docType === reqType);
        if (direct && direct.uploaded) return direct;

        const rel = String(activeProfile?.coApplicant?.relation || coappRelation || '').toLowerCase().trim();
        const fatherName = String(activeProfile?.family?.fatherName || '').toLowerCase().trim();
        const motherName = String(activeProfile?.family?.motherName || '').toLowerCase().trim();
        const coappName = String(activeProfile?.coApplicant?.name || '').toLowerCase().trim();

        const isFatherCoapp = rel === 'father' || (fatherName && coappName && fatherName === coappName);
        const isMotherCoapp = rel === 'mother' || (motherName && coappName && motherName === coappName);

        if (isFatherCoapp) {
            if (reqType === 'father_aadhar' || reqType === 'coapplicant_aadhar') {
                return docs.find(d => d.docType === 'father_aadhar' || d.docType === 'father_aadhaar' || d.docType === 'coapplicant_aadhar' || d.docType === 'coapplicant_aadhaar') || direct;
            }
            if (reqType === 'father_pan' || reqType === 'coapplicant_pan') {
                return docs.find(d => d.docType === 'father_pan' || d.docType === 'coapplicant_pan') || direct;
            }
        }
        if (isMotherCoapp) {
            if (reqType === 'mother_aadhar' || reqType === 'coapplicant_aadhar') {
                return docs.find(d => d.docType === 'mother_aadhar' || d.docType === 'mother_aadhaar' || d.docType === 'coapplicant_aadhar' || d.docType === 'coapplicant_aadhaar') || direct;
            }
            if (reqType === 'mother_pan' || reqType === 'coapplicant_pan') {
                return docs.find(d => d.docType === 'mother_pan' || d.docType === 'coapplicant_pan') || direct;
            }
        }

        return direct;
    };

    const renderDocGroup = (title: string, icon: string, docList: any[], onAddOther?: () => void) => {
        if (!docList || docList.length === 0) return null;
        return (
            <div className="mb-10">
                <div className="flex justify-between items-center mb-5">
                    <h2 className="text-[13px] font-bold flex items-center gap-2 text-gray-900 uppercase tracking-wider">
                        <div className="w-8 h-8 rounded-lg bg-[#6605c7]/[0.05] flex items-center justify-center">
                            <span className="material-symbols-outlined text-[18px] text-[#6605c7]">{icon}</span>
                        </div>
                        {title}
                    </h2>
                    {onAddOther && (
                        <button
                            onClick={onAddOther}
                            className="px-4 py-2 bg-[#6605c7] hover:bg-[#5504a6] text-white text-[11px] font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm shadow-purple-500/10 active:scale-95 animate-fade-in"
                        >
                            <span className="material-symbols-outlined text-[16px]">add_circle</span>
                            Add Other Documents
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {docList.map((req) => {
                        const existing = findDocForRequirement(req.type);
                        const isVerified = existing?.status === 'verified';
                        const isRejected = existing?.status === 'rejected';
                        const isPending = existing?.status === 'uploaded';
                        const isUploaded = existing?.uploaded === true;

                        return (
                            <div key={req.type} className={`bg-white rounded-xl p-5 border transition-all duration-200 ${isVerified ? 'border-emerald-100 bg-emerald-50/10' :
                                isRejected ? 'border-rose-100 bg-rose-50/5' :
                                    isPending ? 'border-amber-100 bg-amber-50/5' :
                                        'border-gray-100'
                                }`}>
                                <div className="flex justify-between items-start mb-5">
                                    <div className={`w-10 h-10 ${isVerified ? 'bg-emerald-100 text-emerald-600' :
                                        isRejected ? 'bg-rose-100 text-rose-600' :
                                            isPending ? 'bg-amber-100 text-[#d97706]' :
                                                'bg-[#6605c7]/[0.03] text-[#6605c7]'
                                        } rounded-xl flex items-center justify-center transition-colors`}>
                                        <span className="material-symbols-outlined text-[20px]">{req.icon}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isVerified && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500 text-white rounded-md text-[9px] font-bold uppercase tracking-wider">
                                                <span className="material-symbols-outlined text-[12px]">check_circle</span>
                                                Verified
                                            </div>
                                        )}
                                        {isRejected && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-rose-500 text-white rounded-md text-[9px] font-bold uppercase tracking-wider">
                                                <span className="material-symbols-outlined text-[12px]">cancel</span>
                                                Rejected
                                            </div>
                                        )}
                                        {isPending && (
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500 text-white rounded-md text-[9px] font-bold uppercase tracking-wider">
                                                <span className="material-symbols-outlined text-[12px]">hourglass_empty</span>
                                                Pending Review
                                            </div>
                                        )}
                                        {req.type.includes('_other_') && !isVerified && (
                                            <button
                                                onClick={() => handleDelete(req.type, true)}
                                                disabled={!!uploadingDocs[req.type]}
                                                className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50"
                                                title="Remove this custom document"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <h3 className="text-[13px] font-bold text-gray-900 mb-1">{req.label}</h3>
                                <p className="text-[11px] text-gray-500 mb-4">
                                    {isVerified ? "Document successfully verified and locked" :
                                        isPending ? "Document uploaded, awaiting staff review" :
                                            isRejected ? "Verification failed - please upload a new copy" :
                                                "Click to upload your original document"}
                                </p>

                                {isRejected && (
                                    <div className="mb-4 p-3 bg-rose-50 rounded-lg border border-rose-100 flex gap-2">
                                        <span className="material-symbols-outlined text-rose-500 text-[14px] shrink-0 mt-0.5">info</span>
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-wider text-rose-600 mb-0.5">Rejection Reason</p>
                                            <p className="text-[10px] text-rose-700 leading-normal font-medium">{existing?.verificationMetadata?.rejectionReason || existing?.rejectionReason || "Please upload a clearer document."}</p>
                                        </div>
                                    </div>
                                )}


                                <input
                                    id={`file-input-${req.type}`}
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => handleFileChange(e, req.type)}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                />

                                {isUploaded ? (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleView(req.type)}
                                            className="flex-1 py-2 bg-gray-50 text-gray-700 text-[11px] font-bold rounded-lg hover:bg-gray-100 transition-all flex items-center justify-center gap-2 border border-gray-100"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">visibility</span> View
                                        </button>
                                        {!isVerified && (
                                            <button
                                                onClick={() => handleDelete(req.type)}
                                                disabled={!!uploadingDocs[req.type]}
                                                className="w-9 h-9 bg-red-50 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-100 transition-all border border-red-100"
                                                title="Delete Document"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {existing?.status === 'available_in_digilocker' && !isUploaded ? (
                                            <div className="relative">
                                                <div className="absolute -top-2 -right-1 z-10">
                                                    <span className="bg-[#6605c7] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full shadow-sm border border-white uppercase tracking-tighter animate-pulse">
                                                        Found!
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={() => handleSyncFromDigilocker(req.type)}
                                                    disabled={!!uploadingDocs[req.type]}
                                                    className="w-full py-2.5 bg-[#6605c7] text-white text-[11px] font-bold rounded-lg hover:bg-[#5504a6] transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 active:scale-95 border border-[#6605c7]/20"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                                                    Sync to Vault
                                                </button>
                                            </div>
                                        ) : !hasIdentityDocUploaded && !isIdentityDocSlot(req.type) ? (
                                            <button
                                                disabled
                                                className="w-full py-2.5 bg-gray-100 text-gray-400 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 border border-gray-200 cursor-not-allowed"
                                                title="Please upload your Passport or Aadhaar Card first to unlock this document slot"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">lock</span>
                                                Locked (Passport or Aadhaar First)
                                            </button>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => triggerFileInput(req.type)}
                                                    disabled={!!uploadingDocs[req.type]}
                                                    className={`w-full py-2.5 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${([
                                                        'pan', 'coapplicant_pan', 'national_id', 'coapplicant_aadhar',
                                                        'marksheet_10', 'marksheet_12', 'passport',
                                                        'father_pan', 'mother_pan', 'father_aadhar', 'mother_aadhar'
                                                    ].includes(req.type))
                                                        ? 'bg-gray-50 text-black-500 border border-gray-200 hover:bg-gray-100'
                                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {uploadingDocs[req.type] ? (
                                                        <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[16px]">upload</span>
                                                    )}
                                                    {uploadingDocs[req.type] ? "Processing..." : ([
                                                        'pan', 'coapplicant_pan', 'national_id', 'coapplicant_aadhar',
                                                        'marksheet_10', 'marksheet_12', 'passport',
                                                        'father_pan', 'mother_pan', 'father_aadhar', 'mother_aadhar'
                                                    ].includes(req.type)) ? "Upload Manually" : "Upload to Vault"}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-transparent">
            <Navbar />
            <div className="max-w-6xl mx-auto px-6 pt-30 pb-16">
                {!loading && applications.length === 0 ? (
                    <div className="max-w-xl mx-auto my-12 animate-fade-in-up relative z-10 text-center">
                        <div className="bg-white/80 backdrop-blur-2xl rounded-[3rem] p-10 md:p-14 shadow-2xl border border-white relative overflow-hidden flex flex-col items-center">
                            <div className="absolute -top-32 -right-32 w-64 h-64 bg-[#6605c7]/10 rounded-full blur-3xl opacity-60 animate-pulse" />
                            <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl opacity-40 animate-pulse" />

                            <div className="w-24 h-24 bg-purple-50 border border-purple-100 rounded-[2rem] flex items-center justify-center text-[#6605c7] mb-8 shadow-sm relative group animate-bounce-slow">
                                <span className="material-symbols-outlined text-5xl">shield_lock</span>
                            </div>

                            <h1 className="text-3xl font-black text-gray-900 mb-4 tracking-tight" style={{ fontFamily: "'Noto Serif', 'Playfair Display', serif" }}>
                                Document Vault Locked
                            </h1>
                            <p className="text-gray-500 font-semibold text-sm leading-relaxed mb-10 max-w-sm">
                                You haven't submitted a loan application yet. Once you apply for a loan, your personalized Document Vault will unlock instantly to upload required files.
                            </p>

                            <Link href="/apply-loan" className="w-full py-4.5 bg-gradient-to-r from-[#6605c7] to-[#8b5cf6] text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-98 transition-all flex items-center justify-center gap-3">
                                <span className="material-symbols-outlined text-lg">bolt</span>
                                Apply for a Loan Now
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
                            <div className="flex items-center gap-4">
                                <Link href="/dashboard" className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-gray-100 shadow-sm hover:border-gray-200 transition-all">
                                    <span className="material-symbols-outlined text-gray-400 text-[20px]">arrow_back</span>
                                </Link>
                                <div>
                                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Document Vault</h1>
                                    <p className="text-gray-500 text-[13px] font-medium">Securely store and manage your loan documents</p>
                                </div>
                            </div>
                        </div>

                        {!hasIdentityDocUploaded && (
                            <div className="mb-10 p-6 bg-gradient-to-r from-purple-900/10 via-purple-500/10 to-indigo-500/10 border-2 border-dashed border-[#6605c7]/40 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl shadow-purple-500/5 animate-fade-in relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-[#6605c7]/10 rounded-full blur-2xl" />
                                <div className="flex items-center gap-4 relative z-10">
                                    <div className="w-14 h-14 rounded-2xl bg-[#6605c7] text-white flex items-center justify-center shrink-0 shadow-xl shadow-purple-500/30 animate-pulse">
                                        <span className="material-symbols-outlined text-[28px]">fingerprint</span>
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                                            Step 1 Mandatory Requirement: Upload Passport or Aadhaar Card First
                                            {/* <span className="px-2.5 py-0.5 bg-[#6605c7] text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-sm">Required Step 1</span> */}
                                        </h3>
                                        <p className="text-xs text-gray-600 font-medium mt-1 leading-relaxed max-w-2xl">
                                            To ensure identity verification and automatic detail extraction, you must upload either your <strong>Passport</strong> or <strong>Aadhaar Card</strong> first. All other document slots will unlock automatically once either your Passport or Aadhaar Card is uploaded.
                                        </p>
                                    </div>
                                </div>
                                {/* <button
                                    onClick={() => triggerFileInput("passport")}
                                    disabled={!!uploadingDocs["passport"]}
                                    className="px-6 py-3 bg-[#6605c7] hover:bg-[#5504a6] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-purple-500/30 shrink-0 flex items-center justify-center gap-2 active:scale-95 relative z-10"
                                >
                                    <span className="material-symbols-outlined text-[18px]">upload</span>
                                    Upload Identity Document
                                </button> */}
                            </div>
                        )}

                        {/* <div className="mb-12">
                    <div className="bg-gradient-to-br from-[#004791] to-[#0b84ff] rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl shadow-blue-500/20">
                        <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
                        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-900/30 rounded-full blur-3xl" />

                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div className="max-w-xl">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] mb-4 border border-white/10 backdrop-blur-md">
                                    <span className="material-symbols-outlined text-[14px]">bolt</span>
                                    Instant Import
                                </div>
                                <h2 className="text-2xl md:text-3xl font-black mb-3">One-Click Document Upload</h2>
                                <p className="text-white/70 text-[13px] font-medium leading-relaxed">
                                    Link your DigiLocker account to instantly fetch and verify your identity documents. 
                                    Faster processing, zero paperwork, and maximum security.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 shrink-0">
                                <Link
                                    href="/document-vault/digilocker"
                                    className="px-8 py-4 bg-white text-[#004791] rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-blue-50 transition-all flex items-center justify-center gap-3 shadow-xl shadow-black/10 active:scale-95 border border-blue-200"
                                >
                                    <span className="material-symbols-outlined text-[20px]">open_in_new</span>
                                    Open DigiLocker Portal
                                </Link>
                                <button
                                    onClick={() => handleDigilockerVerify('ALL_SYNC')}
                                    className="px-8 py-4 bg-emerald-500 text-white rounded-2xl text-[12px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 shadow-xl shadow-black/10 active:scale-95 group"
                                >
                                    <span className="material-symbols-outlined text-[20px] group-hover:rotate-180 transition-transform duration-700">sync</span>
                                    Instant Sync
                                </button>
                            </div>
                        </div>
                    </div>
                </div> */}

                        {docs.some(d => d.status === 'available_in_digilocker' && !d.uploaded) && (
                            <div className="mb-12 bg-gray-50/50 rounded-[32px] p-8 border border-dashed border-gray-200">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                                            <span className="material-symbols-outlined text-emerald-600">folder_zip</span>
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-gray-900">Fetched from DigiLocker</h2>
                                            <p className="text-gray-500 text-[11px] font-medium uppercase tracking-widest">Select documents to sync with your vault</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => loadDocs()}
                                        className="w-10 h-10 bg-white rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#6605c7] hover:border-[#6605c7] transition-all"
                                        title="Refresh"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">refresh</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {docs.filter(d => d.status === 'available_in_digilocker' && !d.uploaded).map(d => {
                                        const req = allRequiredDocs.find(rd => rd.type === d.docType);
                                        return (
                                            <div key={d.id || d.docType} className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm flex flex-col items-center text-center group hover:shadow-md transition-all">
                                                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                    <span className="material-symbols-outlined text-emerald-500">{getDocIcon(d.docType)}</span>
                                                </div>
                                                <h3 className="text-[13px] font-bold text-gray-900 mb-1 line-clamp-1">{req?.label || d.docType}</h3>
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md text-[8px] font-black uppercase tracking-tighter mb-4">
                                                    <span className="material-symbols-outlined text-[10px]">verified</span>
                                                    Verified Source
                                                </div>
                                                <button
                                                    onClick={() => handleSyncFromDigilocker(d.docType)}
                                                    disabled={!!uploadingDocs[d.docType]}
                                                    className="w-full py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                                                >
                                                    {uploadingDocs[d.docType] ? (
                                                        <span className="material-symbols-outlined animate-spin text-[14px]">progress_activity</span>
                                                    ) : (
                                                        <span className="material-symbols-outlined text-[14px]">sync</span>
                                                    )}
                                                    {uploadingDocs[d.docType] ? "Syncing..." : "Sync to Vault"}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="h-40 bg-gray-50 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : (
                            <>
                                {renderDocGroup("Student Documents", "person", studentDocs, () => handleAddOtherDocument("student"))}
                                {renderDocGroup(`Financial Co-Applicant (${(() => {
                                    const r = String(activeProfile.coApplicant?.relation || coappRelation || '').toLowerCase().trim();
                                    if (r === 'father') return 'Father & Co-applicant';
                                    if (r === 'mother') return 'Mother & Co-applicant';
                                    return r ? r.charAt(0).toUpperCase() + r.slice(1) : 'Co-applicant';
                                })()})`, "account_balance", coappDocs, () => handleAddOtherDocument("coapplicant"))}
                                {renderDocGroup("Father & Mother Documents", "family_restroom", parentDocs, () => handleAddOtherDocument("parent"))}
                                {staffRequestedDocs.length > 0 && renderDocGroup("Staff Requested Documents", "assignment", staffRequestedDocs)}
                            </>
                        )}

                        <div className="mt-12 bg-[#1a1a2e] rounded-xl p-8 text-white relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <span className="material-symbols-outlined text-9xl">shield_lock</span>
                            </div>
                            <div className="relative z-10 max-w-2xl">
                                <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest mb-4 border border-white/5">
                                    <span className="material-symbols-outlined text-[14px] text-emerald-400">lock</span>
                                    Security Choice
                                </div>
                                <h2 className="text-xl font-bold mb-4">Privacy & Data Protection</h2>
                                <p className="text-gray-400 text-[13px] leading-relaxed mb-6">
                                    Your documents are encrypted using AES-256 military-grade encryption before being stored.
                                    Only authorized bank officials can access them during your application review process.
                                    We never share your personal data with third parties.
                                </p>
                                <div className="flex flex-wrap gap-3">
                                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 text-[11px] font-bold uppercase tracking-wider">
                                        <span className="material-symbols-outlined text-emerald-400 text-[16px]">verified_user</span> 256-bit SSL
                                    </div>
                                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 text-[11px] font-bold uppercase tracking-wider">
                                        <span className="material-symbols-outlined text-emerald-400 text-[16px]">verified_user</span> GDPR Compliant
                                    </div>
                                    <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 text-[11px] font-bold uppercase tracking-wider">
                                        <span className="material-symbols-outlined text-emerald-400 text-[16px]">verified_user</span> ISO 27001
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {showConsentModal && user?.id && (
                <DigilockerConsentModal
                    userId={user.id}
                    onClose={() => setShowConsentModal(false)}
                />
            )}

        </div>
    );
}
