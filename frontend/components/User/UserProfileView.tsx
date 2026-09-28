"use client";

import { useState, useEffect } from "react";
import { authApi, documentApi } from "@/lib/api";
import DatePicker from "@/components/DatePicker";
import { formatPhone, isPhoneValid } from "@/lib/validation";
import { parseNumberFromWords } from "@/lib/academic-ocr";

interface UserProfileViewProps {
    user: any;
    data: any;
    firstApp: any;
    refreshUser: () => Promise<any>;
    loadData: () => Promise<any>;
}

export default function UserProfileView({
    user,
    data,
    firstApp,
    refreshUser,
    loadData
}: UserProfileViewProps) {
    const baseProfile = data?.profile || user || {};

    const getParsedObject = (value: any) => {
        if (!value) return {};
        if (typeof value === 'string') {
            try { return JSON.parse(value); } catch { return {}; }
        }
        return typeof value === 'object' ? value : {};
    };

    let familyObj = baseProfile.family || baseProfile.familyDetails;
    familyObj = getParsedObject(familyObj);

    let coappObj = baseProfile.coApplicant || baseProfile.coApplicantDetails;
    coappObj = getParsedObject(coappObj);

    const activeProfile = {
        ...baseProfile,
        family: familyObj || {},
        coApplicant: coappObj || {},
        parents: Array.isArray(baseProfile.parents) ? baseProfile.parents : (Array.isArray(data?.parents) ? data.parents : [])
    };

    const parentsList = Array.isArray(activeProfile.parents) ? activeProfile.parents : [];
    const getParentData = (relation: string) => {
        const target = relation.toLowerCase();
        return parentsList.find((p: any) => {
            const currentRelation = String(p?.relation || p?.relationship || '').trim().toLowerCase();
            return currentRelation === target || currentRelation === `${target}s` || currentRelation === `${target}s`;
        }) || null;
    };

    const fatherData = getParentData('father');
    const motherData = getParentData('mother');
    const coapplicantData = getParentData('coapplicant');

    const isDocTypeMatch = (docType: string, patterns: string[]) => {
        const dt = (docType || '').toLowerCase().trim();
        return patterns.some(p => dt === p || dt.includes(p));
    };

    const userDocs = data?.documents || user?.documents || [];
    const sscDoc = userDocs.find((d: any) => isDocTypeMatch(d.docType || d.type || d.documentType || d.name || d.docName || d.doc_type || d.category, ['marksheet_10', 'marksheet_10th', '10th', '10th_marksheet', 'ssc', 'ssc_marksheet', 'grade_10', 'grade10', 'secondary_school']));
    const hscDoc = userDocs.find((d: any) => isDocTypeMatch(d.docType || d.type || d.documentType || d.name || d.docName || d.doc_type || d.category, ['marksheet_12', 'marksheet_12th', '12th', '12th_marksheet', 'hsc', 'hsc_marksheet', 'intermediate', 'intermediate_marksheet', 'intermediate_certificate', 'inter', 'inter_marksheet', 'diploma', 'diploma_marksheet', 'diploma_certificate', 'grade_12', 'grade12', 'senior_secondary', 'puc', 'pu_college', 'plus2', 'plus_two']));
    const ugDoc = userDocs.find((d: any) => isDocTypeMatch(d.docType || d.type || d.documentType || d.name || d.docName || d.doc_type || d.category, ['marksheet_ug', 'ug_degree', 'ug_transcript', 'degree_certificate', 'graduation_degree', 'graduation_transcript', 'graduation_certificate', 'bachelors_degree', 'degree', 'graduation', 'undergrad', 'ug_', 'cmm', 'cmm_certificate', 'consolidated_marks_memo', 'consolidated']));
    const passportDoc = userDocs.find((d: any) => isDocTypeMatch(d.docType || d.type || d.documentType || d.name || d.docName || d.doc_type || d.category, ['passport']));

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

        // Special handling for compound full_name from given_names + surname
        if (names.some(n => ['full_name', 'fullName', 'name', 'holder_name', 'printed_name'].includes(n))) {
            const g = ext.given_names || ext.givenName || details.given_names || details.givenName || meta.given_names || docMeta.given_names;
            const s = ext.surname || ext.lastName || details.surname || details.lastName || meta.surname || docMeta.surname || '';
            if (g && String(g).trim()) {
                return `${String(g).trim()} ${String(s).trim()}`.trim();
            }
        }

        // Special handling for address object
        if (names.includes('address')) {
            const addrObj = ext.address || details.address || meta.address || docMeta.address;
            if (typeof addrObj === 'object' && addrObj !== null) {
                const parts = [addrObj.address1, addrObj.address2, addrObj.city, addrObj.state, addrObj.pincode, addrObj.country].filter(Boolean);
                if (parts.length > 0) return parts.join(', ');
            }
        }

        return null;
    };

    const isDocTypeMatchExact = (docType: string, targetType: string): boolean => {
        const type = (docType || '').toLowerCase().trim();
        const target = (targetType || '').toLowerCase().trim();
        if (!type || !target) return false;

        // Exact match
        if (type === target) return true;

        const relations = ['father', 'mother', 'coapplicant', 'co_applicant', 'coapp', 'brother', 'sister', 'spouse', 'guarantor'];
        const targetRelation = relations.find(r => target.includes(r));
        const typeRelation = relations.find(r => type.includes(r));

        if (targetRelation) {
            // Target is for a family member/coapplicant. The document MUST also have a matching relation prefix!
            if (!typeRelation) return false;
            return typeRelation === targetRelation || target.includes(typeRelation) || type.includes(targetRelation);
        }

        if (typeRelation) {
            // Document belongs to a family member (e.g. 'father_pan'), so it must NOT match student target 'pan'!
            return false;
        }

        return type.includes(target) || target.includes(type);
    };

    const getDocExtractedField = (docTypes: string[], fieldNames: string[]): string | undefined => {
        for (const dt of docTypes) {
            const doc = userDocs.find((d: any) => isDocTypeMatchExact(d.docType, dt));
            if (doc) {
                const val = getExtractedField(doc, fieldNames);
                if (val) return val;
            }
        }
        return undefined;
    };

    const formatPercentageValue = (rawPct?: any, doc?: any): string | undefined => {
        if (rawPct != null && String(rawPct).trim() !== "" && String(rawPct).trim() !== "—") {
            const str = String(rawPct).trim();
            const num = parseFloat(str.replace(/[^\d.]/g, ''));
            if (!isNaN(num)) {
                if (num <= 10 && num > 0) {
                    return `${Math.round(num * 9.5 * 10) / 10}%`;
                }
                if (num <= 100 && num > 0) {
                    return str.includes('%') ? str : `${Math.round(num * 10) / 10}%`;
                }
                if (num > 100) {
                    const inferredMax = num <= 500 ? 500 : num <= 600 ? 600 : 1000;
                    return `${Math.round((num / inferredMax) * 100 * 10) / 10}%`;
                }
            }
            return str;
        }

        if (doc) {
            const pctVal = getExtractedField(doc, [
                'percentage', 'overall_percentage', 'marks_percentage', 'aggregate_percentage', 
                'score', 'score_in_percentage', 'total_percentage', 'grade_percentage', 'marks_obtained_percentage',
                'gpa', 'cgpa', 'overall_gpa', 'overall_cgpa'
            ]);
            const secVal = getExtractedField(doc, ['total_marks_secured', 'marks_secured', 'marks_obtained', 'obtained_marks', 'secured_marks', 'total_marks', 'aggregate_marks', 'grand_total']);
            const maxVal = getExtractedField(doc, ['total_marks_maximum', 'maximum_marks', 'max_marks', 'total_max', 'out_of', 'max']);
            const wordsSecVal = getExtractedField(doc, ['marks_in_words', 'total_marks_in_words', 'secured_marks_in_words', 'marks_obtained_in_words']);
            const wordsMaxVal = getExtractedField(doc, ['max_marks_in_words', 'maximum_marks_in_words']);
            const cgpaVal = getExtractedField(doc, ['cgpa', 'gpa', 'overall_cgpa', 'overall_gpa', 'sgpa']);

            if (pctVal) {
                const pctNum = parseFloat(String(pctVal).replace(/[^\d.]/g, ''));
                if (!isNaN(pctNum) && pctNum > 0 && pctNum <= 100) {
                    return `${Math.round(pctNum * 10) / 10}%`;
                }
                if (!isNaN(pctNum) && pctNum > 100) {
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

    const getAcademicDetails = (doc: any, levelKey?: 'ssc' | 'hsc' | 'ug') => {
        const instKeys = [
            'institution', 'university', 'board', 'school_name', 'college_name', 'board_name', 'institution_name', 'university_name', 'examining_body', 'name_of_institution', 'awarding_body', 'degree_college', 'college', 'board_or_university', 'institute', 'school', 'name_of_the_board', 'name_of_the_university'
        ];
        const pctKeys = [
            'percentage', 'overall_percentage', 'marks_percentage', 'aggregate_percentage', 'score', 'score_in_percentage', 'total_percentage', 'grade_percentage', 'gpa', 'cgpa', 'overall_gpa', 'overall_cgpa', 'total_marks_secured', 'overall_score', 'cgpa_secured', 'gpa_secured', 'grade', 'marks', 'obtained_marks', 'result'
        ];
        const instFromDoc = getExtractedField(doc, instKeys);
        const pctFromDoc = getExtractedField(doc, pctKeys);

        let parsedAcademic: any = data?.academic || data?.user?.academic || user?.academic || (data as any)?.family?.academic || (data as any)?.user?.family?.academic || (user as any)?.family?.academic || (data as any)?.student?.academic || (user as any)?.student?.academic || data?.userAcademicProfile || user?.userAcademicProfile;
        if (typeof parsedAcademic === 'string') {
            try { parsedAcademic = JSON.parse(parsedAcademic); } catch { parsedAcademic = {}; }
        }
        if (!parsedAcademic || typeof parsedAcademic !== 'object') parsedAcademic = {};

        let instFallback: string | undefined = undefined;
        let pctFallback: string | undefined = undefined;

        if (levelKey === 'ssc') {
            instFallback = parsedAcademic.ssc?.institute || parsedAcademic.ssc?.school || parsedAcademic.grade10?.institute || parsedAcademic.grade10?.school || parsedAcademic['10th']?.institute || parsedAcademic['10th']?.school || parsedAcademic.marksheet_10?.institute;
            pctFallback = parsedAcademic.ssc?.percentage || parsedAcademic.ssc?.score || parsedAcademic.grade10?.percentage || parsedAcademic.grade10?.score || parsedAcademic['10th']?.percentage || parsedAcademic['10th']?.score || parsedAcademic.marksheet_10?.percentage;
        } else if (levelKey === 'hsc') {
            instFallback = parsedAcademic.hsc?.institute || parsedAcademic.hsc?.college || parsedAcademic.hsc?.school || parsedAcademic.intermediate?.institute || parsedAcademic.intermediate?.college || parsedAcademic.intermediate?.school || parsedAcademic['12th']?.institute || parsedAcademic['12th']?.college || parsedAcademic['12th']?.school || parsedAcademic.marksheet_12?.institute || parsedAcademic.marksheet_12?.college || parsedAcademic.grade12?.institute || parsedAcademic.grade12?.college || parsedAcademic.inter?.institute || parsedAcademic.inter?.college || (data as any)?.twelfthSchool || (user as any)?.twelfthSchool || (data as any)?.userAcademicProfile?.twelfthSchool || (user as any)?.userAcademicProfile?.twelfthSchool;
            pctFallback = parsedAcademic.hsc?.percentage || parsedAcademic.hsc?.score || parsedAcademic.intermediate?.percentage || parsedAcademic.intermediate?.score || parsedAcademic['12th']?.percentage || parsedAcademic['12th']?.score || parsedAcademic.marksheet_12?.percentage || parsedAcademic.marksheet_12?.score || parsedAcademic.grade12?.percentage || parsedAcademic.grade12?.score || parsedAcademic.inter?.percentage || parsedAcademic.inter?.score || (data as any)?.twelfthPercentage || (user as any)?.twelfthPercentage || (data as any)?.userAcademicProfile?.twelfthPercentage || (user as any)?.userAcademicProfile?.twelfthPercentage;
        } else if (levelKey === 'ug') {
            instFallback = parsedAcademic.ug?.institute || parsedAcademic.ug?.university || parsedAcademic.undergrad?.institute || parsedAcademic.undergrad?.university || data?.bachelorsDegree || data?.user?.bachelorsDegree || user?.bachelorsDegree || (data as any)?.userAcademicProfile?.bachelorsDegree || (user as any)?.userAcademicProfile?.bachelorsDegree;
            pctFallback = parsedAcademic.ug?.percentage || parsedAcademic.ug?.score || parsedAcademic.ug?.gpa || parsedAcademic.undergrad?.percentage || parsedAcademic.undergrad?.gpa || parsedAcademic.undergrad?.score || (data as any)?.userAcademicProfile?.gpa || (user as any)?.userAcademicProfile?.gpa;
        }

        const inst = instFromDoc || instFallback;
        const rawPct = pctFromDoc || pctFallback;
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
            institute: inst || "",
            percentage: finalPercentage,
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

    let parsedPassportObj: any = activeProfile?.passport;
    if (typeof parsedPassportObj === 'string') {
        try { parsedPassportObj = JSON.parse(parsedPassportObj); } catch { }
    }
    if (!parsedPassportObj || typeof parsedPassportObj !== 'object') parsedPassportObj = {};

    const passportNumber = parsedPassportObj.number || parsedPassportObj.passportNumber || parsedPassportObj.passport_number || parsedPassportObj.passportNo || activeProfile?.passportNumber || activeProfile?.passportNo || getDocExtractedField(['passport'], ['passport_number', 'passportNumber', 'passport_no', 'passportNo', 'document_number']);
    const passportIssueDate = parsedPassportObj.issueDate || parsedPassportObj.passportIssueDate || parsedPassportObj.issue_date || parsedPassportObj.date_of_issue || parsedPassportObj.dateOfIssue || activeProfile?.passportIssueDate || activeProfile?.issueDate || getDocExtractedField(['passport'], ['issue_date', 'date_of_issue', 'passport_issue_date', 'dateOfIssue', 'issueDate']);
    const passportExpiryDate = parsedPassportObj.expiryDate || parsedPassportObj.passportExpiry || parsedPassportObj.expiry_date || parsedPassportObj.dateOfExpiry || activeProfile?.passportExpiry || getDocExtractedField(['passport'], ['date_of_expiry', 'expiry_date', 'expiration_date', 'passport_expiry']);
    const passportIssueCountry = parsedPassportObj.issueCountry || parsedPassportObj.passportIssueCountry || parsedPassportObj.issue_country || activeProfile?.passportIssueCountry || getDocExtractedField(['passport'], ['issue_country', 'country_of_issue', 'issuing_country']);
    const passportBirthCity = parsedPassportObj.birthCity || parsedPassportObj.placeOfBirth || parsedPassportObj.birth_city || activeProfile?.birthCity || getDocExtractedField(['passport'], ['place_of_birth', 'birth_place', 'birth_city']);
    const passportBirthCountry = parsedPassportObj.birthCountry || parsedPassportObj.passportBirthCountry || parsedPassportObj.birth_country || parsedPassportObj.countryOfBirth || activeProfile?.passportBirthCountry || activeProfile?.birthCountry || getDocExtractedField(['passport'], ['birth_country', 'country_of_birth', 'passport_birth_country']);
    const passportFullName = parsedPassportObj.fullName || parsedPassportObj.full_name || activeProfile?.passportOriginalName || activeProfile?.nameAsInPassport || activeProfile?.family?.passportOriginalName || getDocExtractedField(['passport'], ['full_name', 'fullName', 'name', 'printed_name', 'holder_name']);

    const studentAadhaar = activeProfile?.aadharNumber || activeProfile?.aadhar || activeProfile?.aadhaarNumber || activeProfile?.aadhaar || getDocExtractedField(['aadhar', 'aadhaar', 'student_aadhar', 'student_aadhaar', 'national_id'], ['aadhaarNumber', 'aadharNumber', 'document_number', 'aadhaar_number', 'aadhar_number', 'id_number', 'uid', 'aadhaar_no', 'aadhar_no']);
    const studentPan = activeProfile?.panNumber || activeProfile?.pan || activeProfile?.panNo || getDocExtractedField(['pan', 'pancard', 'pan_card', 'student_pan'], ['panNumber', 'document_number', 'pan_number', 'pan', 'pan_no', 'id_number', 'taxpayer_id']);

    const getDerivedNationality = (): string => {
        const direct = activeProfile?.nationality || baseProfile?.nationality || user?.nationality || data?.nationality;
        if (direct && String(direct).trim() && String(direct).trim() !== "—" && String(direct).trim().toLowerCase() !== "not provided") {
            const d = String(direct).trim();
            return d.toLowerCase() === 'india' ? 'Indian' : d;
        }

        const docNat = getDocExtractedField(['passport', 'aadhar', 'aadhaar'], ['nationality', 'citizenship']);
        if (docNat && String(docNat).trim() && String(docNat).trim() !== "—" && String(docNat).trim().toLowerCase() !== "not provided") {
            const d = String(docNat).trim();
            return d.toLowerCase() === 'india' ? 'Indian' : d;
        }

        // Indian Indicators Check: 6-digit Indian Pincode, Aadhaar, PAN, +91 Phone, Passport India
        const pincodeVal = activeProfile?.pincode || user?.pincode || data?.pincode || activeProfile?.permanentAddress?.pincode || activeProfile?.mailingAddress?.pincode;
        const cleanPincode = String(pincodeVal || '').replace(/\D/g, '');
        const isIndianPincode = cleanPincode.length === 6;

        const phone = activeProfile?.phoneNumber || activeProfile?.mobile || user?.phoneNumber || user?.mobile || "";
        const cleanPhone = String(phone).replace(/\D/g, '');
        const isIndianPhone = cleanPhone.length === 10 || (cleanPhone.length === 12 && cleanPhone.startsWith('91'));

        if (isIndianPincode || studentAadhaar || studentPan || passportIssueCountry === 'India' || passportBirthCountry === 'India' || isIndianPhone) {
            return 'Indian';
        }

        // Derive from Address text (excluding study destination hints)
        let addr = activeProfile?.address || activeProfile?.currentAddress || activeProfile?.permanentAddress ||
            user?.address || data?.address || firstApp?.address || data?.applications?.[0]?.address ||
            getDocExtractedField(['aadhar', 'aadhaar', 'passport', 'national_id', 'voter_id'], ['address', 'residential_address', 'permanent_address', 'address_formatted']);

        if (typeof addr === 'object' && addr !== null) {
            const country = addr.country || addr.addressCountry || addr.countryName;
            if (country) {
                addr = `${addr.street || ''} ${addr.city || ''} ${addr.state || ''} ${country}`;
            } else {
                addr = JSON.stringify(addr);
            }
        }

        const addrText = String(addr || '').toLowerCase();
        if (addrText) {
            if (addrText.includes('india') || addrText.includes('bharat') || /\b\d{6}\b/.test(addrText)) {
                return 'Indian';
            }
            if (addrText.includes('united states') || addrText.includes('usa')) {
                return 'American';
            }
            if (addrText.includes('united kingdom') || addrText.includes('uk') || addrText.includes('britain')) {
                return 'British';
            }
            if (addrText.includes('canada')) {
                return 'Canadian';
            }
            if (addrText.includes('australia')) {
                return 'Australian';
            }
        }

        // Default fallback for student loans portal
        return "Indian";
    };

    const displayUserId = user?.id || "";

    const profileCompleteness = (() => {
        let count = 0;
        if (user?.id) count += 1;
        if (user?.firstName) count += 1;
        if (user?.lastName) count += 1;
        if (user?.phoneNumber) count += 1;
        if (user?.dateOfBirth) count += 1;
        return count * 20;
    })();

    const formatDob = (dobStr?: string) => {
        if (!dobStr) return null;
        try {
            const date = new Date(dobStr);
            if (isNaN(date.getTime())) return dobStr;
            return date.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
        } catch {
            return dobStr;
        }
    };

    const formatDateToDdMmYyyy = (dateStr?: string): string => {
        if (!dateStr) return "";
        try {
            if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
                return dateStr;
            }
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return "";
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}-${month}-${year}`;
        } catch {
            return "";
        }
    };

    // States
    const [editingCard, setEditingCard] = useState<string | null>(null);
    const [savingProfile, setSavingProfile] = useState(false);

    const [personalForm, setPersonalForm] = useState({
        firstName: "",
        lastName: "",
        phoneNumber: "",
        dateOfBirth: "",
        nationality: "",
        passportNumber: "",
        passportFullName: "",
        passportIssueDate: "",
        passportExpiryDate: "",
        passportIssueCountry: "",
        passportBirthCity: "",
        passportBirthCountry: "",
        aadharNumber: "",
        panNumber: "",
    });

    const [familyForm, setFamilyForm] = useState({
        fatherName: "",
        fatherAadhar: "",
        fatherPan: "",
        motherName: "",
        motherAadhar: "",
        motherPan: "",
        coApplicantName: "",
        coApplicantRelation: "",
        coApplicantPhone: "",
        coApplicantIncome: "",
        coApplicantAadhar: "",
        coApplicantPan: "",
    });

    const startPersonalEdit = () => {
        setPersonalForm({
            firstName: activeProfile?.firstName || "",
            lastName: activeProfile?.lastName || "",
            phoneNumber: activeProfile?.phoneNumber || "",
            dateOfBirth: formatDateToDdMmYyyy(activeProfile?.dateOfBirth || getDocExtractedField(['passport', 'aadhar', 'aadhaar', 'pan'], ['dob', 'date_of_birth', 'dateOfBirth'])),
            nationality: activeProfile?.nationality || getDerivedNationality() || "",
            passportNumber: passportNumber || "",
            passportFullName: passportFullName || (activeProfile?.firstName ? `${activeProfile.firstName} ${activeProfile.lastName || ''}`.trim() : ""),
            passportIssueDate: passportIssueDate || "",
            passportExpiryDate: passportExpiryDate || "",
            passportIssueCountry: passportIssueCountry || "",
            passportBirthCity: passportBirthCity || "",
            passportBirthCountry: passportBirthCountry || "",
            aadharNumber: studentAadhaar || "",
            panNumber: studentPan || "",
        });
        setEditingCard("personal");
    };

    const studentFullName = `${activeProfile?.firstName || ''} ${activeProfile?.lastName || ''}`.trim().toLowerCase();
    const isStudentName = (n?: string) => {
        if (!n || !n.trim()) return true;
        const lower = n.trim().toLowerCase();
        if (['mother', 'father', 'coapplicant', 'student', 'na', 'n/a', 'none', 'null', 'undefined', '—', 'enter name'].includes(lower)) return true;
        if (studentFullName && studentFullName.length > 2 && (lower === studentFullName || (lower.includes(studentFullName) && lower.length <= studentFullName.length + 3))) return true;
        if (activeProfile?.firstName && activeProfile.firstName.length > 2 && lower === activeProfile.firstName.trim().toLowerCase()) return true;
        return false;
    };

    const loadFamilyFormState = () => {
        const rawFather = fatherData?.name || activeProfile?.family?.fatherName || activeProfile?.fatherName;
        const passportFather = getDocExtractedField(['passport'], ['father_name', 'fatherName', 'father_full_name']);
        const validFather = (!isStudentName(rawFather) ? rawFather : undefined) || (!isStudentName(passportFather) ? passportFather : undefined) || "";

        const rawMother = motherData?.name || activeProfile?.family?.motherName || activeProfile?.motherName;
        const passportMother = getDocExtractedField(['passport'], ['mother_name', 'motherName', 'mother_full_name', 'name_of_mother']);
        const validMother = (!isStudentName(rawMother) ? rawMother : undefined) || (!isStudentName(passportMother) ? passportMother : undefined) || "";

        return {
            fatherName: validFather,
            fatherAadhar: fatherData?.aadharNumber || activeProfile?.family?.fatherAadhar || "",
            fatherPan: fatherData?.panNumber || activeProfile?.family?.fatherPan || "",
            motherName: validMother,
            motherAadhar: motherData?.aadharNumber || activeProfile?.family?.motherAadhar || "",
            motherPan: motherData?.panNumber || activeProfile?.family?.motherPan || "",
            coApplicantName: coapplicantData?.name || activeProfile?.coApplicant?.name || activeProfile?.coApplicantName || "",
            coApplicantRelation: firstApp?.coApplicantRelation || activeProfile?.coApplicant?.relation || activeProfile?.coApplicant?.relationship || activeProfile?.coApplicantRelation || "",
            coApplicantPhone: firstApp?.coApplicantPhone || activeProfile?.coApplicant?.mobile || activeProfile?.coApplicant?.phone || activeProfile?.coApplicantPhone || "",
            coApplicantIncome: firstApp?.coApplicantIncome?.toString() || activeProfile?.coApplicant?.monthlyIncome?.toString() || activeProfile?.coApplicantIncome?.toString() || "",
            coApplicantAadhar: coapplicantData?.aadharNumber || "",
            coApplicantPan: coapplicantData?.panNumber || "",
        };
    };

    const startFatherEdit = () => {
        setFamilyForm(loadFamilyFormState());
        setEditingCard("father");
    };

    const startMotherEdit = () => {
        setFamilyForm(loadFamilyFormState());
        setEditingCard("mother");
    };

    const startCoApplicantEdit = () => {
        setFamilyForm(loadFamilyFormState());
        setEditingCard("coapplicant");
    };



    const handleSavePersonal = async () => {
        if (!user?.email) return;

        if (!personalForm.firstName || personalForm.firstName.trim().length < 3) {
            alert("First name must be at least 3 characters");
            return;
        }

        if (!personalForm.lastName || personalForm.lastName.trim().length < 1) {
            alert("Last name must be at least 1 character");
            return;
        }

        if (personalForm.phoneNumber && !isPhoneValid(personalForm.phoneNumber)) {
            alert("Please enter a valid phone number");
            return;
        }

        if (!personalForm.dateOfBirth) {
            alert("Date of birth is required");
            return;
        }

        setSavingProfile(true);
        try {
            await authApi.updateDetails(user.email, {
                firstName: personalForm.firstName,
                lastName: personalForm.lastName,
                phoneNumber: personalForm.phoneNumber,
                dateOfBirth: personalForm.dateOfBirth,
                nationality: personalForm.nationality,
            });
            if (user?.id) {
                await documentApi.updateProfile(user.id, {
                    nationality: personalForm.nationality,
                    passport: {
                        ...(parsedPassportObj || {}),
                        number: personalForm.passportNumber,
                        fullName: personalForm.passportFullName,
                        full_name: personalForm.passportFullName,
                        issueDate: personalForm.passportIssueDate,
                        expiryDate: personalForm.passportExpiryDate,
                        issueCountry: personalForm.passportIssueCountry,
                        birthCity: personalForm.passportBirthCity,
                        birthCountry: personalForm.passportBirthCountry,
                    },
                    passportNumber: personalForm.passportNumber,
                    passportOriginalName: personalForm.passportFullName,
                    nameAsInPassport: personalForm.passportFullName,
                    passportIssueDate: personalForm.passportIssueDate,
                    passportExpiry: personalForm.passportExpiryDate,
                    passportExpiryDate: personalForm.passportExpiryDate,
                    passportIssueCountry: personalForm.passportIssueCountry,
                    passportBirthCity: personalForm.passportBirthCity,
                    passportBirthCountry: personalForm.passportBirthCountry,
                    aadharNumber: personalForm.aadharNumber,
                    panNumber: personalForm.panNumber,
                });
            }
            await refreshUser();
            await loadData();
            setEditingCard(null);
        } catch (e) {
            console.error(e);
            alert(e instanceof Error ? e.message : "Failed to save changes");
        } finally {
            setSavingProfile(false);
        }
    };

    const handleSaveFamily = async () => {
        if (!user?.id) return;

        setSavingProfile(true);
        try {
            const familyPayload = {
                fatherName: familyForm.fatherName || null,
                fatherAadhar: familyForm.fatherAadhar ? familyForm.fatherAadhar.replace(/\s+/g, '') : null,
                fatherPan: familyForm.fatherPan ? familyForm.fatherPan.toUpperCase().replace(/\s+/g, '') : null,
                motherName: familyForm.motherName || null,
                motherAadhar: familyForm.motherAadhar ? familyForm.motherAadhar.replace(/\s+/g, '') : null,
                motherPan: familyForm.motherPan ? familyForm.motherPan.toUpperCase().replace(/\s+/g, '') : null,
            };

            const parentsPayload = [
                {
                    relation: "father",
                    name: familyForm.fatherName || null,
                    aadharNumber: familyForm.fatherAadhar ? familyForm.fatherAadhar.replace(/\s+/g, '') : null,
                    panNumber: familyForm.fatherPan ? familyForm.fatherPan.toUpperCase().replace(/\s+/g, '') : null
                },
                {
                    relation: "mother",
                    name: familyForm.motherName || null,
                    aadharNumber: familyForm.motherAadhar ? familyForm.motherAadhar.replace(/\s+/g, '') : null,
                    panNumber: familyForm.motherPan ? familyForm.motherPan.toUpperCase().replace(/\s+/g, '') : null
                },
                {
                    relation: "coapplicant",
                    name: familyForm.coApplicantName || null,
                    aadharNumber: familyForm.coApplicantAadhar ? familyForm.coApplicantAadhar.replace(/\s+/g, '') : null,
                    panNumber: familyForm.coApplicantPan ? familyForm.coApplicantPan.toUpperCase().replace(/\s+/g, '') : null
                }
            ];

            const coAppPayload = {
                name: familyForm.coApplicantName || null,
                relation: familyForm.coApplicantRelation || null,
                mobile: familyForm.coApplicantPhone ? familyForm.coApplicantPhone.replace(/\s+/g, '') : null,
                monthlyIncome: familyForm.coApplicantIncome ? parseFloat(familyForm.coApplicantIncome) : null
            };

            if (user?.email) {
                await authApi.updateDetails(user.email, {
                    firstName: activeProfile?.firstName || user?.firstName || "",
                    lastName: activeProfile?.lastName || user?.lastName || "",
                    phoneNumber: activeProfile?.phoneNumber || user?.phoneNumber || "",
                    dateOfBirth: activeProfile?.dateOfBirth || user?.dateOfBirth || "",
                    family: familyPayload,
                    fatherName: familyForm.fatherName || null,
                    motherName: familyForm.motherName || null,
                    parents: parentsPayload,
                    coApplicant: coAppPayload
                });
            }

            await documentApi.updateProfile(user.id, {
                email: user.email,
                fatherName: familyForm.fatherName || null,
                motherName: familyForm.motherName || null,
                family: familyPayload,
                parents: parentsPayload,
                coApplicant: coAppPayload
            });

            await refreshUser();
            await loadData();
            setEditingCard(null);
        } catch (e) {
            console.error(e);
            alert(e instanceof Error ? e.message : "Failed to save changes");
        } finally {
            setSavingProfile(false);
        }
    };

    const formatAadhar = (val?: string) => {
        if (!val || val === "—") return null;
        return val;
    };

    const formatPan = (val?: string) => {
        if (!val || val === "—") return null;
        return val.toUpperCase();
    };

    const renderTableAadhar = (val?: string, _key?: string) => {
        const isEmpty = !val || val === "—" || val === "";
        if (isEmpty) return <div className="text-black-900 italic text-[13px]">Aadhaar: Not provided</div>;
        return (
            <div className="flex items-center gap-1.5 text-[14px]">
                <span className="text-[#64748B]">Aadhaar:</span>
                <span className="font-mono font-bold text-slate-800 tracking-wider">{val}</span>
            </div>
        );
    };

    const renderTablePan = (val?: string, _key?: string) => {
        const isEmpty = !val || val === "—" || val === "";
        if (isEmpty) return <div className="text-black-900 italic text-[13px]">PAN: Not provided</div>;
        return (
            <div className="flex items-center gap-1.5 text-[14px]">
                <span className="text-[#64748B]">PAN:</span>
                <span className="font-mono font-bold text-slate-800 uppercase tracking-wider">{val}</span>
            </div>
        );
    };

    const renderBentoField = (
        label: string,
        val: any,
        onEditClick: () => void,
        type: "text" | "aadhar" | "pan" = "text",
        _key?: string
    ) => {
        const isEmpty = !val || val === "—" || val === "" || val === "Not provided";
        const displayVal = isEmpty ? "Not provided" : val;

        if (type === "aadhar" || type === "pan") {
            if (isEmpty) {
                return (
                    <div className="mb-4 group/field relative">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</span>
                        <div className="flex items-center justify-between py-1 min-h-[28px]">
                            <span className="text-[15px] text-slate-400 italic">Not provided</span>
                        </div>
                    </div>
                );
            }
            const formatted = type === "aadhar" ? formatAadhar(val) : formatPan(val);
            return (
                <div className="mb-4 group/field relative">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</span>
                    <div className="flex items-center justify-between py-1 min-h-[28px]">
                        <span className="text-[15px] font-bold text-slate-800 font-mono tracking-wider">{formatted}</span>
                        <button
                            type="button"
                            onClick={onEditClick}
                            className="p-1 text-slate-400 hover:text-[#6605c7] transition-colors opacity-0 group-hover/field:opacity-100 border-0 bg-transparent flex items-center cursor-pointer"
                        >
                            <i className="ph ph-pencil-simple text-sm" />
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="mb-4 group/field relative">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</span>
                <div
                    onClick={isEmpty ? undefined : onEditClick}
                    className={`flex items-center justify-between py-1 min-h-[28px] ${isEmpty ? '' : 'cursor-pointer border-b border-transparent hover:border-slate-100 transition-all'}`}
                >
                    <span className={`text-[15px] font-medium leading-tight ${isEmpty ? 'text-slate-400 italic' : 'text-[#0F172A]'}`}>
                        {displayVal}
                    </span>
                    {!isEmpty && (
                        <i className="ph ph-pencil-simple text-slate-400 opacity-0 group-hover/field:opacity-100 transition-opacity text-sm ml-2" />
                    )}
                </div>
            </div>
        );
    };

    const coappIncomeVal = firstApp?.coApplicantIncome
        ? `₹${Number(firstApp.coApplicantIncome).toLocaleString('en-IN')}/yr`
        : activeProfile?.coApplicant?.monthlyIncome
            ? `₹${Number(activeProfile.coApplicant.monthlyIncome).toLocaleString('en-IN')}/mo`
            : activeProfile?.coApplicantIncome
                ? `₹${Number(activeProfile.coApplicantIncome).toLocaleString('en-IN')}/yr`
                : null;

    const isFatherValid = !savingProfile &&
        (!familyForm.fatherAadhar || familyForm.fatherAadhar.length === 12) &&
        (!familyForm.fatherPan || familyForm.fatherPan.length === 10);

    const isMotherValid = !savingProfile &&
        (!familyForm.motherAadhar || familyForm.motherAadhar.length === 12) &&
        (!familyForm.motherPan || familyForm.motherPan.length === 10);

    const isCoappValid = !savingProfile &&
        (!familyForm.coApplicantAadhar || familyForm.coApplicantAadhar.length === 12) &&
        (!familyForm.coApplicantPan || familyForm.coApplicantPan.length === 10) &&
        (!familyForm.coApplicantPhone || isPhoneValid(familyForm.coApplicantPhone));

    return (
        <div className="profile-command-center mt-6 space-y-6">
            {/* Premium Gamified Hero Card Header */}
            <div className="bg-white rounded-[16px] p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        {/* Avatar with circular progress ring */}
                        <div className="relative w-[100px] h-[100px] flex items-center justify-center shrink-0">
                            <svg className="absolute inset-0 w-full h-full -rotate-90">
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="44"
                                    className="stroke-slate-100"
                                    strokeWidth="5"
                                    fill="transparent"
                                />
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="44"
                                    className={`transition-all duration-700 ease-out ${profileCompleteness === 100 ? "stroke-emerald-500" : "stroke-[#6605c7]"
                                        }`}
                                    strokeWidth="5"
                                    fill="transparent"
                                    strokeDasharray="276.46"
                                    strokeDashoffset={276.46 - (276.46 * profileCompleteness) / 100}
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="w-[78px] h-[78px] rounded-full bg-[#0F172A] text-white text-2xl font-extrabold flex items-center justify-center relative overflow-hidden group/avatar">
                                {activeProfile?.firstName?.[0] || ""}{activeProfile?.lastName?.[0] || activeProfile?.email?.[0]?.toUpperCase() || "U"}
                                <button
                                    type="button"
                                    onClick={startPersonalEdit}
                                    className="absolute inset-0 bg-[#0F172A]/70 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center text-white text-[9px] font-black tracking-widest uppercase transition-opacity duration-300 cursor-pointer border-0"
                                >
                                    <i className="ph ph-pencil-simple text-sm mb-0.5" />
                                    EDIT
                                </button>
                            </div>
                        </div>

                        {/* User Details */}
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <h2 className="text-xl font-bold text-[#0F172A] tracking-tight">
                                    {passportFullName || activeProfile?.passportOriginalName || activeProfile?.nameAsInPassport || activeProfile?.aadhaarOriginalName || activeProfile?.nameAsInAadhaar || (activeProfile?.firstName && activeProfile?.lastName
                                        ? `${activeProfile.firstName} ${activeProfile.lastName}`
                                        : activeProfile?.firstName || activeProfile?.email?.split("@")[0])}
                                </h2>
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100/70 text-emerald-700 text-[10px] font-black tracking-wider uppercase">
                                    <i className="ph ph-shield-check text-xs text-emerald-600" />
                                    Verified Account
                                </span>
                            </div>
                            <p className="text-xs text-black-500 font-semibold truncate font-mono uppercase">
                                Student ID: {displayUserId}
                            </p>
                        </div>
                    </div>

                    {/* Gamified Setup Progress info */}
                    <div className="flex flex-col items-start md:items-end justify-center shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Profile Setup Completeness</span>
                        <div className="flex items-center gap-3">
                            <div className="w-28 bg-slate-100 rounded-full h-2">
                                <div
                                    className={`h-2 rounded-full transition-all duration-700 ${profileCompleteness === 100 ? "bg-emerald-500" : "bg-[#6605c7]"
                                        }`}
                                    style={{ width: `${profileCompleteness}%` }}
                                />
                            </div>
                            <span className={`text-2xl font-black ${profileCompleteness === 100 ? "text-emerald-500" : "text-[#0F172A]"
                                }`}>
                                {profileCompleteness}%
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bento Box Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                {/* Card 1: Personal Details Card (Spans 2 columns) */}
                <div className="bg-white rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 p-6 md:col-span-2 relative group">
                    <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100">
                        <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                            <i className="ph ph-user text-[#6605c7] text-lg shrink-0" />
                            Personal Details
                        </h3>
                        {editingCard !== "personal" && (
                            <button
                                type="button"
                                onClick={startPersonalEdit}
                                className="px-3 py-1.5 flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-[#6605c7] rounded-lg text-xs font-bold transition-all border-0 cursor-pointer"
                            >
                                <i className="ph ph-pencil-simple text-sm" />
                                Edit Profile
                            </button>
                        )}
                    </div>

                    {editingCard === "personal" ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">First Name</label>
                                    <input
                                        type="text"
                                        value={personalForm.firstName}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^A-Za-z\s]/g, "");
                                            setPersonalForm(p => ({ ...p, firstName: val }));
                                        }}
                                        maxLength={50}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Last Name</label>
                                    <input
                                        type="text"
                                        value={personalForm.lastName}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/[^A-Za-z\s]/g, "");
                                            setPersonalForm(p => ({ ...p, lastName: val }));
                                        }}
                                        maxLength={50}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date of Birth</label>
                                        {user?.dateOfBirth && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">🔒 Immutable</span>}
                                    </div>
                                    <DatePicker
                                        value={personalForm.dateOfBirth}
                                        onChange={(val: string) => setPersonalForm(p => ({ ...p, dateOfBirth: val }))}
                                        placeholder="Select DOB"
                                        disabled={!!user?.dateOfBirth}
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone Number</label>
                                        {(user?.phoneNumber || user?.mobile) && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">🔒 Immutable</span>}
                                    </div>
                                    <input
                                        type="tel"
                                        value={personalForm.phoneNumber}
                                        onChange={(e) => setPersonalForm(p => ({ ...p, phoneNumber: formatPhone(e.target.value) }))}
                                        disabled={!!(user?.phoneNumber || user?.mobile)}
                                        maxLength={10}
                                        inputMode="numeric"
                                        className={`w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all ${user?.phoneNumber || user?.mobile ? 'bg-slate-100/80 text-slate-500 cursor-not-allowed border-slate-200' : 'bg-slate-50/50 text-slate-700 border-slate-200'}`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nationality</label>
                                    <input
                                        type="text"
                                        value={personalForm.nationality}
                                        onChange={(e) => setPersonalForm(p => ({ ...p, nationality: e.target.value }))}
                                        placeholder="e.g. Indian"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Passport Number</label>
                                    <input
                                        type="text"
                                        value={personalForm.passportNumber}
                                        onChange={(e) => {
                                            const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                                            setPersonalForm(p => ({ ...p, passportNumber: val }));
                                        }}
                                        maxLength={12}
                                        placeholder="e.g. Z1234567"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50 uppercase font-mono font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Name as in Passport</label>
                                    <input
                                        type="text"
                                        value={personalForm.passportFullName}
                                        onChange={(e) => setPersonalForm(p => ({ ...p, passportFullName: e.target.value }))}
                                        placeholder="Full name as printed on passport"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50 font-semibold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Passport Issue Date</label>
                                    <input
                                        type="date"
                                        value={personalForm.passportIssueDate}
                                        onChange={(e) => setPersonalForm(p => ({ ...p, passportIssueDate: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Passport Expiry Date</label>
                                    <input
                                        type="date"
                                        value={personalForm.passportExpiryDate}
                                        onChange={(e) => setPersonalForm(p => ({ ...p, passportExpiryDate: e.target.value }))}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Country of Issue</label>
                                    <input
                                        type="text"
                                        value={personalForm.passportIssueCountry}
                                        onChange={(e) => setPersonalForm(p => ({ ...p, passportIssueCountry: e.target.value }))}
                                        placeholder="e.g. India"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Place of Birth (City)</label>
                                    <input
                                        type="text"
                                        value={personalForm.passportBirthCity}
                                        onChange={(e) => setPersonalForm(p => ({ ...p, passportBirthCity: e.target.value }))}
                                        placeholder="e.g. Hyderabad"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Country of Birth</label>
                                    <input
                                        type="text"
                                        value={personalForm.passportBirthCountry}
                                        onChange={(e) => setPersonalForm(p => ({ ...p, passportBirthCountry: e.target.value }))}
                                        placeholder="e.g. India"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50 font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Student Aadhaar Number</label>
                                    <input
                                        type="text"
                                        value={personalForm.aadharNumber}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, "").slice(0, 12);
                                            setPersonalForm(p => ({ ...p, aadharNumber: val }));
                                        }}
                                        maxLength={12}
                                        placeholder="12-digit Aadhaar Number"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50 font-mono font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Student PAN Number</label>
                                    <input
                                        type="text"
                                        value={personalForm.panNumber}
                                        onChange={(e) => {
                                            const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
                                            setPersonalForm(p => ({ ...p, panNumber: val }));
                                        }}
                                        maxLength={10}
                                        placeholder="10-character PAN Number"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50 uppercase font-mono font-bold"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setEditingCard(null)}
                                    className="px-5 py-2 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer bg-white"
                                    disabled={savingProfile}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSavePersonal}
                                    className="px-5 py-2 rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold shadow-md hover:shadow-lg hover:-translate-y-[2px] active:translate-y-0 active:shadow-md transition-all duration-300 border-0 flex items-center gap-1.5 cursor-pointer"
                                    disabled={savingProfile || !personalForm.firstName || personalForm.firstName.length < 3 || !personalForm.lastName || !personalForm.phoneNumber || !isPhoneValid(personalForm.phoneNumber)}
                                >
                                    {savingProfile ? (
                                        <>
                                            <i className="ph ph-spinner animate-spin text-sm" /> Saving...
                                        </>
                                    ) : (
                                        <>Save Changes</>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Passport Details Card Banner */}
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
                                {/* Header Section */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-4 mb-5 gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-semibold shrink-0">
                                            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h10M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"></path>
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="m-0 text-base font-semibold text-gray-900">Passport Information</h3>
                                            <p className="m-0 mt-0.5 text-xs text-gray-500">Official passport and identification details</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5">
                                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border inline-flex items-center gap-1 shrink-0 ${passportDoc?.uploaded || passportNumber
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                : "bg-amber-50 text-amber-700 border-amber-200"
                                            }`}>
                                            ● {passportDoc?.uploaded ? "Verified" : passportNumber ? "Details Available" : "Pending Upload"}
                                        </span>
                                        {(passportDoc?.uploaded || passportNumber || passportFullName) && (
                                            <button
                                                type="button"
                                                onClick={startPersonalEdit}
                                                className="bg-white border border-gray-300 text-gray-700 text-xs font-medium px-3.5 py-1.5 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Content Grid (3 Columns) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                                    <div>
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Passport Number</span>
                                        <span className="text-sm font-semibold text-gray-800">{passportNumber || "—"}</span>
                                    </div>

                                    <div>
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Full Name in Passport</span>
                                        <span className="text-sm font-semibold text-gray-800">{passportFullName || "—"}</span>
                                    </div>

                                    <div>
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Issue Country</span>
                                        <span className="text-sm font-semibold text-gray-800">{passportIssueCountry || "—"}</span>
                                    </div>

                                    <div>
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Issue Date</span>
                                        <span className="text-sm font-medium text-gray-700">{passportIssueDate || "—"}</span>
                                    </div>

                                    <div>
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Expiry Date</span>
                                        <span className="text-sm font-medium text-gray-700">{passportExpiryDate || "—"}</span>
                                    </div>

                                    <div>
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Country of Birth</span>
                                        <span className="text-sm font-medium text-gray-700">{passportBirthCountry || "—"}</span>
                                    </div>

                                    <div className="col-span-1 sm:col-span-2 md:col-span-3">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block mb-1">Place of Birth</span>
                                        <span className="text-sm font-medium text-gray-700">{passportBirthCity || "—"}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {renderBentoField("Email Address", activeProfile?.email, startPersonalEdit)}
                                {renderBentoField("Phone Number", activeProfile?.phoneNumber, startPersonalEdit)}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                {renderBentoField("Aadhaar Number", studentAadhaar, startPersonalEdit, "aadhar")}
                                {renderBentoField("PAN Number", studentPan, startPersonalEdit, "pan")}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                {renderBentoField("Date of Birth", formatDob(activeProfile?.dateOfBirth || getDocExtractedField(['passport', 'aadhar', 'aadhaar', 'pan'], ['dob', 'date_of_birth', 'dateOfBirth'])), startPersonalEdit)}
                                {renderBentoField("Nationality", activeProfile?.nationality || getDerivedNationality(), startPersonalEdit)}
                                {renderBentoField("Destination Country", activeProfile?.studyDestination || activeProfile?.country || firstApp?.country || firstApp?.destinationCountry || data?.applications?.[0]?.country, startPersonalEdit)}
                                {renderBentoField("Target University", activeProfile?.targetUniversity || activeProfile?.universityName || firstApp?.universityName || firstApp?.targetUniversity || data?.applications?.[0]?.universityName || data?.applications?.[0]?.targetUniversity, startPersonalEdit)}
                            </div>
                        </div>
                    )}
                </div>

                {/* Card 2: Academic Details Card (Double height on lg screens) */}
                <div className="bg-white rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 p-6 md:col-span-1 lg:row-span-2 relative">
                    <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-100">
                        <i className="ph ph-graduation-cap text-[#6605c7] text-lg shrink-0" />
                        <h3 className="text-sm font-bold text-[#0F172A]">Academic Details</h3>
                    </div>

                    <div className="space-y-4">
                        {/* 10th Standard */}
                        <div className="p-4 bg-slate-50/50 rounded-[12px] border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-[#6605c7] shrink-0">
                                    <i className="ph ph-book-open text-base" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-[#0F172A]">10th / SSC marksheets</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 truncate">{sscDetails.institute && sscDetails.institute !== "—" ? sscDetails.institute : "Institution pending"}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                    {sscDetails.percentage && sscDetails.percentage !== "—" && sscDetails.percentage !== "Missing" ? (
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black border border-emerald-100">{sscDetails.percentage}</span>
                                    ) : (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black">Missing</span>
                                    )}
                                </div>
                            </div>
                            {(sscDetails.secNum != null || sscDetails.wordsSecStr || sscDetails.tallyStatus !== 'none') && (
                                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 text-[10px]">
                                    <div className="flex items-center gap-2 truncate">
                                        {sscDetails.secNum != null && (
                                            <span className="text-slate-600 font-medium">Marks: <strong>{sscDetails.secNum}{sscDetails.maxNum ? `/${sscDetails.maxNum}` : ''}</strong></span>
                                        )}
                                        {sscDetails.wordsSecStr && (
                                            <span className="text-purple-700 italic truncate" title={`In words: ${sscDetails.wordsSecStr}`}>("{sscDetails.wordsSecStr}")</span>
                                        )}
                                    </div>
                                    {sscDetails.tallyStatus === 'matched' && (
                                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 shrink-0">✓ Tallied</span>
                                    )}
                                    {sscDetails.tallyStatus === 'discrepancy' && (
                                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 shrink-0" title={sscDetails.tallyMessage}>⚠ Mismatch</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 12th Standard */}
                        <div className="p-4 bg-slate-50/50 rounded-[12px] border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-[#6605c7] shrink-0">
                                    <i className="ph ph-book-bookmark text-base" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-[#0F172A]">12th / Intermediate marksheets</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 truncate">{hscDetails.institute && hscDetails.institute !== "—" ? hscDetails.institute : "Institution pending"}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                    {hscDetails.percentage && hscDetails.percentage !== "—" && hscDetails.percentage !== "Missing" ? (
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black border border-emerald-100">{hscDetails.percentage}</span>
                                    ) : (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black">Missing</span>
                                    )}
                                </div>
                            </div>
                            {(hscDetails.secNum != null || hscDetails.wordsSecStr || hscDetails.tallyStatus !== 'none') && (
                                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 text-[10px]">
                                    <div className="flex items-center gap-2 truncate">
                                        {hscDetails.secNum != null && (
                                            <span className="text-slate-600 font-medium">Marks: <strong>{hscDetails.secNum}{hscDetails.maxNum ? `/${hscDetails.maxNum}` : ''}</strong></span>
                                        )}
                                        {hscDetails.wordsSecStr && (
                                            <span className="text-purple-700 italic truncate" title={`In words: ${hscDetails.wordsSecStr}`}>("{hscDetails.wordsSecStr}")</span>
                                        )}
                                    </div>
                                    {hscDetails.tallyStatus === 'matched' && (
                                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 shrink-0">✓ Tallied</span>
                                    )}
                                    {hscDetails.tallyStatus === 'discrepancy' && (
                                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 shrink-0" title={hscDetails.tallyMessage}>⚠ Mismatch</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Graduation */}
                        <div className="p-4 bg-slate-50/50 rounded-[12px] border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-[#6605c7] shrink-0">
                                    <i className="ph ph-student text-base" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-bold text-[#0F172A]">Degree / Graduation</p>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 truncate">{ugDetails.institute && ugDetails.institute !== "—" ? ugDetails.institute : "Institution pending"}</p>
                                </div>
                                <div className="shrink-0 text-right">
                                    {ugDetails.percentage && ugDetails.percentage !== "—" && ugDetails.percentage !== "Pending" ? (
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-black border border-emerald-100">{ugDetails.percentage}</span>
                                    ) : (
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black">Pending</span>
                                    )}
                                </div>
                            </div>
                            {(ugDetails.secNum != null || ugDetails.wordsSecStr || ugDetails.tallyStatus !== 'none') && (
                                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 text-[10px]">
                                    <div className="flex items-center gap-2 truncate">
                                        {ugDetails.secNum != null && (
                                            <span className="text-slate-600 font-medium">Marks: <strong>{ugDetails.secNum}{ugDetails.maxNum ? `/${ugDetails.maxNum}` : ''}</strong></span>
                                        )}
                                        {ugDetails.wordsSecStr && (
                                            <span className="text-purple-700 italic truncate" title={`In words: ${ugDetails.wordsSecStr}`}>("{ugDetails.wordsSecStr}")</span>
                                        )}
                                    </div>
                                    {ugDetails.tallyStatus === 'matched' && (
                                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 shrink-0">✓ Tallied</span>
                                    )}
                                    {ugDetails.tallyStatus === 'discrepancy' && (
                                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 shrink-0" title={ugDetails.tallyMessage}>⚠ Mismatch</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Unified Family & Co-Applicant Details Card */}
                <div className="bg-white rounded-[16px] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 p-6 md:col-span-2 relative">
                    {editingCard === "father" ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-2">
                                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                                    <i className="ph ph-gender-male text-blue-500 text-lg shrink-0" />
                                    Edit Father Details
                                </h3>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                                <input
                                    type="text"
                                    value={familyForm.fatherName}
                                    onChange={(e) => setFamilyForm(p => ({ ...p, fatherName: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Aadhaar Number</label>
                                <input
                                    type="text"
                                    value={familyForm.fatherAadhar}
                                    onChange={(e) => setFamilyForm(p => ({ ...p, fatherAadhar: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                                    placeholder="12-digit number"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 font-mono bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">PAN Number</label>
                                <input
                                    type="text"
                                    value={familyForm.fatherPan}
                                    onChange={(e) => setFamilyForm(p => ({ ...p, fatherPan: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }))}
                                    placeholder="10-digit PAN"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 font-mono bg-slate-50/50"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingCard(null)}
                                    className="px-5 py-2 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer bg-white"
                                    disabled={savingProfile}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveFamily}
                                    className="px-5 py-2 rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold shadow-md hover:shadow-lg hover:-translate-y-[2px] active:translate-y-0 active:shadow-md transition-all duration-300 border-0 flex items-center gap-1.5 cursor-pointer"
                                    disabled={!isFatherValid}
                                >
                                    {savingProfile ? (
                                        <>
                                            <i className="ph ph-spinner animate-spin text-sm" /> Saving...
                                        </>
                                    ) : (
                                        <>Save</>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : editingCard === "mother" ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-2">
                                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                                    <i className="ph ph-gender-female text-pink-500 text-lg shrink-0" />
                                    Edit Mother Details
                                </h3>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Full Name</label>
                                <input
                                    type="text"
                                    value={familyForm.motherName}
                                    onChange={(e) => setFamilyForm(p => ({ ...p, motherName: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Aadhaar Number</label>
                                <input
                                    type="text"
                                    value={familyForm.motherAadhar}
                                    onChange={(e) => setFamilyForm(p => ({ ...p, motherAadhar: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                                    placeholder="12-digit number"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 font-mono bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">PAN Number</label>
                                <input
                                    type="text"
                                    value={familyForm.motherPan}
                                    onChange={(e) => setFamilyForm(p => ({ ...p, motherPan: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }))}
                                    placeholder="10-digit PAN"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 font-mono bg-slate-50/50"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingCard(null)}
                                    className="px-5 py-2 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer bg-white"
                                    disabled={savingProfile}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveFamily}
                                    className="px-5 py-2 rounded-full bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs font-bold shadow-md hover:shadow-lg hover:-translate-y-[2px] active:translate-y-0 active:shadow-md transition-all duration-300 border-0 flex items-center gap-1.5 cursor-pointer"
                                    disabled={!isMotherValid}
                                >
                                    {savingProfile ? (
                                        <>
                                            <i className="ph ph-spinner animate-spin text-sm" /> Saving...
                                        </>
                                    ) : (
                                        <>Save</>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : editingCard === "coapplicant" ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-[#6605c7]/15 mb-2">
                                <h3 className="text-sm font-bold text-[#6605c7] flex items-center gap-2">
                                    <i className="ph ph-shield-star text-lg shrink-0" />
                                    Edit Co-Applicant Details
                                </h3>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#6605c7] uppercase tracking-widest mb-1.5">Co-Applicant Name</label>
                                <input
                                    type="text"
                                    value={familyForm.coApplicantName}
                                    onChange={(e) => setFamilyForm(p => ({ ...p, coApplicantName: e.target.value }))}
                                    className="w-full px-3 py-2 border border-[#6605c7]/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#6605c7] uppercase tracking-widest mb-1.5">Co-Applicant Relation</label>
                                <select
                                    value={familyForm.coApplicantRelation}
                                    onChange={(e) => setFamilyForm(p => ({ ...p, coApplicantRelation: e.target.value }))}
                                    className="w-full px-3 py-2 border border-[#6605c7]/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-white"
                                >
                                    <option value="">Select Relation</option>
                                    <option value="Father">Father</option>
                                    <option value="Mother">Mother</option>
                                    <option value="Sibling">Sibling</option>
                                    <option value="Spouse">Spouse</option>
                                    <option value="Uncle">Uncle</option>
                                    <option value="Aunt">Aunt</option>
                                    <option value="Grandparent">Grandparent</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#6605c7] uppercase tracking-widest mb-1.5">Phone Number</label>
                                <input
                                    type="tel"
                                    value={familyForm.coApplicantPhone}
                                    onChange={(e) => setFamilyForm(p => ({ ...p, coApplicantPhone: formatPhone(e.target.value) }))}
                                    maxLength={10}
                                    className="w-full px-3 py-2 border border-[#6605c7]/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#6605c7] uppercase tracking-widest mb-1.5">Monthly/Annual Income (INR)</label>
                                <input
                                    type="number"
                                    value={familyForm.coApplicantIncome}
                                    onChange={(e) => setFamilyForm(p => ({ ...p, coApplicantIncome: e.target.value }))}
                                    placeholder="e.g. 978654"
                                    className="w-full px-3 py-2 border border-[#6605c7]/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#6605c7] uppercase tracking-widest mb-1.5">Aadhaar Number</label>
                                <input
                                    type="text"
                                    value={familyForm.coApplicantAadhar}
                                    onChange={(e) => setFamilyForm(p => ({ ...p, coApplicantAadhar: e.target.value.replace(/\D/g, '').slice(0, 12) }))}
                                    placeholder="12-digit number"
                                    className="w-full px-3 py-2 border border-[#6605c7]/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 font-mono bg-slate-50/50"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#6605c7] uppercase tracking-widest mb-1.5">PAN Number</label>
                                <input
                                    type="text"
                                    value={familyForm.coApplicantPan}
                                    onChange={(e) => setFamilyForm(p => ({ ...p, coApplicantPan: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }))}
                                    placeholder="10-digit PAN"
                                    className="w-full px-3 py-2 border border-[#6605c7]/20 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6605c7]/20 transition-all text-slate-700 font-mono bg-slate-50/50"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingCard(null)}
                                    className="px-5 py-2 rounded-full border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold transition-all duration-300 flex items-center gap-1.5 cursor-pointer bg-white"
                                    disabled={savingProfile}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveFamily}
                                    className="px-5 py-2 rounded-full bg-[#6605c7] hover:bg-[#5504a8] text-white text-xs font-bold shadow-md hover:shadow-lg hover:-translate-y-[2px] active:translate-y-0 active:shadow-md transition-all duration-300 border-0 flex items-center gap-1.5 cursor-pointer"
                                    disabled={!isCoappValid}
                                >
                                    {savingProfile ? (
                                        <>
                                            <i className="ph ph-spinner animate-spin text-sm" /> Saving...
                                        </>
                                    ) : (
                                        <>Save</>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="font-sans">
                            <div className="flex justify-between items-center mb-6 pb-3 border-b border-slate-100">
                                <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                                    <i className="ph ph-users text-[#6605c7] text-lg shrink-0" />
                                    Family & Co-Applicant Details
                                </h3>
                                {editingCard !== "father" && editingCard !== "mother" && editingCard !== "coapplicant" && (
                                    <div className="flex gap-2">
                                        {(() => {
                                            const fatherRaw = fatherData?.name || activeProfile?.family?.fatherName || activeProfile?.fatherName;
                                            const fatherDoc = getDocExtractedField(['father_aadhar', 'father_aadhaar', 'father_pan'], ['full_name', 'fullName', 'name', 'holder_name', 'father_name']);
                                            const fatherAadhaar = fatherData?.aadharNumber || activeProfile?.family?.fatherAadhar || activeProfile?.fatherAadhar;
                                            const fatherPan = fatherData?.panNumber || activeProfile?.family?.fatherPan || activeProfile?.fatherPan;
                                            const fatherHasData = !!((fatherRaw && !isStudentName(fatherRaw)) || fatherDoc || fatherAadhaar || fatherPan);

                                            const motherRaw = motherData?.name || activeProfile?.family?.motherName || activeProfile?.motherName;
                                            const motherDoc = getDocExtractedField(['mother_aadhar', 'mother_aadhaar', 'mother_pan'], ['full_name', 'fullName', 'name', 'holder_name', 'mother_name']);
                                            const motherAadhaar = motherData?.aadharNumber || activeProfile?.family?.motherAadhar || activeProfile?.motherAadhar;
                                            const motherPan = motherData?.panNumber || activeProfile?.family?.motherPan || activeProfile?.motherPan;
                                            const motherHasData = !!((motherRaw && !isStudentName(motherRaw)) || motherDoc || motherAadhaar || motherPan);

                                            const coappRaw = coapplicantData?.name || activeProfile?.coApplicant?.name || activeProfile?.coApplicantName;
                                            const coappAadhaar = activeProfile?.coApplicantAadhar || activeProfile?.coApplicant?.aadharNumber;
                                            const coappPan = activeProfile?.coApplicantPan || activeProfile?.coApplicant?.panNumber;
                                            const coappPhone = firstApp?.coApplicantPhone || activeProfile?.coApplicant?.mobile || activeProfile?.coApplicantPhone;
                                            const coappHasData = !!(coappRaw || coappAadhaar || coappPan || coappPhone);

                                            return (
                                                <>
                                                    {fatherHasData && (
                                                        <button
                                                            type="button"
                                                            onClick={startFatherEdit}
                                                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold uppercase transition-all border border-slate-200 cursor-pointer"
                                                        >
                                                            Edit Father
                                                        </button>
                                                    )}
                                                    {motherHasData && (
                                                        <button
                                                            type="button"
                                                            onClick={startMotherEdit}
                                                            className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold uppercase transition-all border border-slate-200 cursor-pointer"
                                                        >
                                                            Edit Mother
                                                        </button>
                                                    )}
                                                    {coappHasData && (
                                                        <button
                                                            type="button"
                                                            onClick={startCoApplicantEdit}
                                                            className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-[#6605c7] rounded-lg text-[10px] font-bold uppercase transition-all border-0 cursor-pointer"
                                                        >
                                                            Edit Co-Applicant
                                                        </button>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead className="bg-[#F8FAFC]">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left font-semibold text-[#64748B] uppercase tracking-wider text-xs">Role</th>
                                            <th scope="col" className="px-6 py-3 text-left font-semibold text-[#64748B] uppercase tracking-wider text-xs">Name</th>
                                            <th scope="col" className="px-6 py-3 text-left font-semibold text-[#64748B] uppercase tracking-wider text-xs">KYC Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-[#FFFFFF]">
                                        {/* Father Row */}
                                        <tr className="hover:bg-[#F8FAFC] transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-[#0F172A]">Father</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-[#0F172A] font-medium">
                                                {(() => {
                                                    const rawName = fatherData?.name || activeProfile?.family?.fatherName || activeProfile?.fatherName;
                                                    const passportFather = getDocExtractedField(['passport'], ['father_name', 'fatherName', 'father_full_name']);
                                                    const fatherDocName = getDocExtractedField(['father_aadhar', 'father_aadhaar', 'father_pan'], ['full_name', 'fullName', 'name', 'holder_name', 'printed_name', 'father_name', 'fatherName']);
                                                    const finalName = (!isStudentName(rawName) ? rawName : undefined) || (!isStudentName(passportFather) ? passportFather : undefined) || (!isStudentName(fatherDocName) ? fatherDocName : undefined) || "—";
                                                    const isFromPassport = !!passportFather && !isStudentName(passportFather) && finalName === passportFather;

                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <span>{finalName}</span>
                                                            {isFromPassport && (
                                                                <span className="px-1.5 py-0.5 bg-purple-50 text-[#6605c7] border border-purple-100 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                                                    <i className="ph ph-passport text-xs" /> Passport
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-[#0F172A] space-y-1.5">
                                                {renderTableAadhar(fatherData?.aadharNumber || activeProfile?.family?.fatherAadhar || activeProfile?.fatherAadhar || getDocExtractedField(['father_aadhar'], ['aadhaarNumber', 'aadharNumber', 'document_number', 'aadhaar_number', 'aadhar_number', 'id_number', 'uid', 'aadhaar_no', 'aadhar_no']), "father_aadhar")}
                                                {renderTablePan(fatherData?.panNumber || activeProfile?.family?.fatherPan || activeProfile?.fatherPan || getDocExtractedField(['father_pan'], ['panNumber', 'document_number', 'pan_number', 'pan', 'pan_no', 'id_number', 'taxpayer_id']), "father_pan")}
                                            </td>
                                        </tr>
                                        {/* Mother Row */}
                                        <tr className="hover:bg-[#F8FAFC] transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-[#0F172A]">Mother</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-[#0F172A] font-medium">
                                                {(() => {
                                                    const rawName = motherData?.name || activeProfile?.family?.motherName || activeProfile?.motherName;
                                                    const passportMother = getDocExtractedField(['passport'], ['mother_name', 'motherName', 'mother_full_name', 'name_of_mother']);
                                                    const motherDocName = getDocExtractedField(['mother_aadhar', 'mother_aadhaar', 'mother_pan'], ['full_name', 'fullName', 'name', 'holder_name', 'printed_name', 'mother_name', 'motherName']);
                                                    const finalName = (!isStudentName(rawName) ? rawName : undefined) || (!isStudentName(passportMother) ? passportMother : undefined) || (!isStudentName(motherDocName) ? motherDocName : undefined) || "—";
                                                    const isFromPassport = !!passportMother && !isStudentName(passportMother) && finalName === passportMother;

                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <span>{finalName}</span>
                                                            {isFromPassport && (
                                                                <span className="px-1.5 py-0.5 bg-purple-50 text-[#6605c7] border border-purple-100 rounded text-[9px] font-black uppercase tracking-widest flex items-center gap-1">
                                                                    <i className="ph ph-passport text-xs" /> Passport
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-[#0F172A] space-y-1.5">
                                                {renderTableAadhar(motherData?.aadharNumber || activeProfile?.family?.motherAadhar || activeProfile?.motherAadhar || getDocExtractedField(['mother_aadhar', 'mother_aadhaar'], ['aadhaarNumber', 'aadharNumber', 'document_number', 'aadhaar_number', 'aadhar_number', 'id_number', 'uid', 'aadhaar_no', 'aadhar_no']), "mother_aadhar")}
                                                {renderTablePan(motherData?.panNumber || activeProfile?.family?.motherPan || activeProfile?.motherPan || getDocExtractedField(['mother_pan'], ['panNumber', 'document_number', 'pan_number', 'pan', 'pan_no', 'id_number', 'taxpayer_id']), "mother_pan")}
                                            </td>
                                        </tr>
                                        {/* Co-Applicant Row */}
                                        <tr className="hover:bg-[#F8FAFC] transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap font-bold text-[#6605c7]">Primary Co-Applicant</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-[#0F172A] font-medium">
                                                {(() => {
                                                    const relVal = String(firstApp?.coApplicantRelation || activeProfile?.coApplicant?.relation || activeProfile?.coApplicant?.relationship || activeProfile?.coApplicantRelation || "—");
                                                    const isFatherCoApp = relVal.toLowerCase().trim() === 'father';
                                                    const isMotherCoApp = relVal.toLowerCase().trim() === 'mother';
                                                    const defaultCoAppName = isFatherCoApp ? (fatherData?.name || activeProfile?.family?.fatherName) : isMotherCoApp ? (motherData?.name || activeProfile?.family?.motherName) : undefined;
                                                    const coappName = coapplicantData?.name || activeProfile?.coApplicant?.name || activeProfile?.coApplicantName || defaultCoAppName || getDocExtractedField(['coapplicant_aadhar', 'coapplicant_pan', ...(isFatherCoApp ? ['father_aadhar', 'father_pan'] : []), ...(isMotherCoApp ? ['mother_aadhar', 'mother_pan'] : [])], ['full_name', 'name', 'holder_name']) || "—";

                                                    return (
                                                        <div>
                                                            <div className="font-bold text-[#0F172A]">{coappName}</div>
                                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                                                Relation: {relVal}
                                                            </div>
                                                            {coappIncomeVal && (
                                                                <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">
                                                                    Income: {coappIncomeVal}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-xs text-[#0F172A] space-y-1.5">
                                                {firstApp?.coApplicantPhone || activeProfile?.coApplicant?.mobile || activeProfile?.coApplicant?.phone || activeProfile?.coApplicantPhone ? (
                                                    <div className="flex items-center gap-1.5 text-[11px] mb-1">
                                                        <span className="text-[#64748B]">Phone:</span>
                                                        <span className="font-medium text-slate-800">{firstApp?.coApplicantPhone || activeProfile?.coApplicant?.mobile || activeProfile?.coApplicant?.phone || activeProfile?.coApplicantPhone}</span>
                                                    </div>
                                                ) : null}
                                                {firstApp?.coApplicantEmail || activeProfile?.coApplicant?.email || activeProfile?.coApplicantEmail ? (
                                                    <div className="flex items-center gap-1.5 text-[11px] mb-1">
                                                        <span className="text-[#64748B]">Email:</span>
                                                        <span className="font-medium text-slate-800">{firstApp?.coApplicantEmail || activeProfile?.coApplicant?.email || activeProfile?.coApplicantEmail}</span>
                                                    </div>
                                                ) : null}
                                                {(() => {
                                                    const relVal = String(firstApp?.coApplicantRelation || activeProfile?.coApplicant?.relation || activeProfile?.coApplicantRelation || '').toLowerCase().trim();
                                                    const isFatherCoApp = relVal === 'father';
                                                    const isMotherCoApp = relVal === 'mother';

                                                    const coappAadharVal = coapplicantData?.aadharNumber || activeProfile?.coApplicant?.aadhar || activeProfile?.coApplicantAadhar ||
                                                        (isFatherCoApp ? (fatherData?.aadharNumber || activeProfile?.family?.fatherAadhar || activeProfile?.fatherAadhar) : '') ||
                                                        (isMotherCoApp ? (motherData?.aadharNumber || activeProfile?.family?.motherAadhar || activeProfile?.motherAadhar) : '') ||
                                                        getDocExtractedField(['coapplicant_aadhar', ...(isFatherCoApp ? ['father_aadhar', 'father_aadhaar'] : []), ...(isMotherCoApp ? ['mother_aadhar', 'mother_aadhaar'] : [])], ['aadhaarNumber', 'aadharNumber', 'document_number', 'aadhaar_number', 'aadhar_number', 'id_number', 'uid', 'aadhaar_no', 'aadhar_no']);

                                                    const coappPanVal = coapplicantData?.panNumber || activeProfile?.coApplicant?.pan || activeProfile?.coApplicantPan ||
                                                        (isFatherCoApp ? (fatherData?.panNumber || activeProfile?.family?.fatherPan || activeProfile?.fatherPan) : '') ||
                                                        (isMotherCoApp ? (motherData?.panNumber || activeProfile?.family?.motherPan || activeProfile?.motherPan) : '') ||
                                                        getDocExtractedField(['coapplicant_pan', ...(isFatherCoApp ? ['father_pan'] : []), ...(isMotherCoApp ? ['mother_pan'] : [])], ['panNumber', 'document_number', 'pan_number', 'pan', 'pan_no', 'id_number', 'taxpayer_id']);

                                                    const aadharDocType = (isFatherCoApp && !userDocs.some((d: any) => d.docType === 'coapplicant_aadhar' && d.uploaded)) ? 'father_aadhar' : (isMotherCoApp && !userDocs.some((d: any) => d.docType === 'coapplicant_aadhar' && d.uploaded)) ? 'mother_aadhar' : 'coapp_aadhar';
                                                    const panDocType = (isFatherCoApp && !userDocs.some((d: any) => d.docType === 'coapplicant_pan' && d.uploaded)) ? 'father_pan' : (isMotherCoApp && !userDocs.some((d: any) => d.docType === 'coapplicant_pan' && d.uploaded)) ? 'mother_pan' : 'coapp_pan';

                                                    return (
                                                        <>
                                                            {renderTableAadhar(coappAadharVal, aadharDocType)}
                                                            {renderTablePan(coappPanVal, panDocType)}
                                                        </>
                                                    );
                                                })()}
                                            </td>
                                        </tr>
                                        {/* Dynamic Relatives Rows (Brother, Sister, Spouse, Guarantor, etc.) */}
                                        {(activeProfile?.parents || []).filter((p: any) => {
                                            const rel = String(p?.relation || '').toLowerCase();
                                            return rel && rel !== 'father' && rel !== 'mother' && rel !== 'coapplicant';
                                        }).map((rel: any) => {
                                            const relationKey = String(rel.relation || '').toLowerCase();
                                            const label = relationKey.charAt(0).toUpperCase() + relationKey.slice(1);
                                            const nameVal = rel.name || getDocExtractedField([`${relationKey}_aadhar`, `${relationKey}_aadhaar`, `${relationKey}_pan`], ['full_name', 'fullName', 'name', 'holder_name', 'printed_name']) || "—";
                                            const aadharVal = rel.aadharNumber || getDocExtractedField([`${relationKey}_aadhar`, `${relationKey}_aadhaar`], ['aadhaarNumber', 'aadharNumber', 'document_number', 'aadhaar_number', 'aadhar_number']);
                                            const panVal = rel.panNumber || getDocExtractedField([`${relationKey}_pan`], ['panNumber', 'document_number', 'pan_number', 'pan']);

                                            return (
                                                <tr key={relationKey} className="hover:bg-[#F8FAFC] transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-[#0F172A]">{label}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-[#0F172A] font-medium">{nameVal}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-[#0F172A] space-y-1.5">
                                                        {renderTableAadhar(aadharVal, `${relationKey}_aadhar`)}
                                                        {renderTablePan(panVal, `${relationKey}_pan`)}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
