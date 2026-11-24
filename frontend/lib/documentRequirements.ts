export type DocumentCategory = "academic" | "financial" | "identity" | "other";

export type DocumentRequirement = {
  name: string;
  label: string;
  type: string;
  category: DocumentCategory;
  required: boolean;
};

const hasValue = (value: unknown) => String(value || "").trim().length > 0;

export function getDocumentCategory(docType: string): DocumentCategory {
  const type = String(docType || "").toLowerCase();
  if (type.includes("aadhar") || type.includes("aadhaar") || type.includes("pan") || type.includes("passport") || type.includes("identity") || type.includes("national_id") || type.includes("photo")) {
    return "identity";
  }
  if (type.includes("salary") || type.includes("bank") || type.includes("itr") || type.includes("business") || type.includes("balance") || type.includes("retirement") || type.includes("income") || type.includes("cost") || type.includes("fee")) {
    return "financial";
  }
  if (type.includes("marksheet") || type.includes("degree") || type.includes("transcript") || type.includes("test") || type.includes("resume") || type.includes("work") || type.includes("admission") || type.includes("offer")) {
    return "academic";
  }
  return "other";
}

function requirement(name: string, type: string, required = true, category?: DocumentCategory): DocumentRequirement {
  return {
    name,
    label: name,
    type,
    category: category || getDocumentCategory(type),
    required,
  };
}

export function getStudentDocumentRequirements(student: any = {}): DocumentRequirement[] {
  const academic = student.academic || student.student?.academic || {};
  const tests = student.tests || student.testScores || student.student?.tests || {};
  const workExperience = student.workExperience || student.student?.workExperience || [];
  const highestLevel = academic.highestLevel || student.highestLevel || student.courseLevel || student.bachelorsDegree;

  return [
    requirement("Passport (Front & Back)", "passport", true, "identity"),
    requirement("National ID / Aadhaar Card", "national_id", true, "identity"),
    requirement("PAN Card", "pan", true, "identity"),
    requirement("Passport Size Photograph", "photograph", true, "identity"),
    requirement("Admission / Offer Letter", "admission_letter", true, "academic"),
    requirement("Cost of Study / Fee Structure", "cost_of_study", true, "financial"),
    requirement("Standardized Test Score Card (IELTS / TOEFL / GRE / GMAT)", "test_score", true, "academic"),
    requirement("10th Marksheet", "marksheet_10", true, "academic"),
    requirement("12th / Diploma Marksheet", "marksheet_12", highestLevel !== "Grade 10", "academic"),
    requirement("Degree Certificate / CMM", "degree_certificate", true, "academic"),
    requirement("Undergraduate Transcript", "ug_transcript", ["Undergraduate", "Postgraduate"].includes(highestLevel), "academic"),
    requirement("Undergraduate Degree", "ug_degree", ["Undergraduate", "Postgraduate"].includes(highestLevel), "academic"),
    requirement("Postgraduate Transcript", "pg_transcript", highestLevel === "Postgraduate", "academic"),
    requirement("Postgraduate Degree", "pg_degree", highestLevel === "Postgraduate", "academic"),
    requirement("Work Experience Letters", "work_letters", Array.isArray(workExperience) && workExperience.some((exp) => hasValue(exp?.employer)), "academic"),
  ].filter((doc) => doc.required);
}

export function getPersonDocumentRequirements(
  employmentType: string,
  personName: string,
  personType: "father" | "mother" | "coapplicant",
  isCoApplicant: boolean = false,
): DocumentRequirement[] {
  const docs: DocumentRequirement[] = [];
  let baseRole = personType === "coapplicant" ? "Co-applicant" : personType[0].toUpperCase() + personType.slice(1);
  if (isCoApplicant && (personType === "father" || personType === "mother")) {
    baseRole = `${personType[0].toUpperCase() + personType.slice(1)} & Co-applicant`;
  }

  const cleanName = String(personName || "").trim();
  const name = cleanName && !["Father", "Mother", "Co-applicant"].includes(cleanName)
    ? `${cleanName} (${baseRole})`
    : baseRole;

  docs.push(requirement(`${name}'s Aadhaar Card`, `${personType}_aadhar`, true, "identity"));
  docs.push(requirement(`${name}'s PAN Card`, `${personType}_pan`, true, "identity"));

  return docs;
}

export function getProfileDocumentRequirements(profile: any = {}): DocumentRequirement[] {
  const student = profile.student || profile.user || profile;
  const family = student.family || student.familyDetails || profile.family || profile.familyDetails || {};
  const coApplicant = student.coApplicant || profile.coApplicant || {};

  const fatherName = family.fatherName || profile.fatherName;
  const motherName = family.motherName || profile.motherName;

  // Dynamically determine relation and fallback co-applicant name
  const rawRelation = coApplicant.relation || coApplicant.coApplicantRelation || profile.coApplicantRelation || student.coApplicant || "";
  const relation = typeof rawRelation === "string" ? rawRelation : "";
  const normalizedRel = relation.toLowerCase().trim();
  const isNoCoApp = normalizedRel === "none" || normalizedRel === "no" || student.hasCoApplicant === false || profile.hasCoApplicant === false;

  const coappActualName = typeof coApplicant.name === 'string' ? coApplicant.name : (profile.coApplicantName || "");
  const relationLabel = relation && !isNoCoApp ? relation.charAt(0).toUpperCase() + relation.slice(1) : "";
  const coApplicantName = coappActualName || relationLabel;

  const isFatherCoApp = normalizedRel === "father" || (fatherName && coappActualName && fatherName.toLowerCase().trim() === coappActualName.toLowerCase().trim());
  const isMotherCoApp = normalizedRel === "mother" || (motherName && coappActualName && motherName.toLowerCase().trim() === coappActualName.toLowerCase().trim());

  const docs: DocumentRequirement[] = [...getStudentDocumentRequirements(student)];

  // Determine co-applicant display label
  const coAppDisplayRole = isFatherCoApp
    ? "Father & Co-Applicant"
    : isMotherCoApp
    ? "Mother & Co-Applicant"
    : relationLabel
    ? `${relationLabel} (Co-Applicant)`
    : "Parent / Co-Applicant";

  const coAppLabel = coApplicantName && !["Father", "Mother", "Co-applicant"].includes(coApplicantName)
    ? `${coApplicantName} (${coAppDisplayRole})`
    : coAppDisplayRole;

  // Lender-required Financial Co-Applicant documents
  docs.push(requirement(`${coAppLabel}'s Aadhaar Card`, "coapplicant_aadhar", true, "identity"));
  docs.push(requirement(`${coAppLabel}'s PAN Card`, "coapplicant_pan", true, "identity"));
  docs.push(requirement(`${coAppLabel}'s 6-Month Bank Statement`, "coapplicant_bank_statement", true, "financial"));
  docs.push(requirement(`${coAppLabel}'s Income Proof (Salary Slips / Form 16 / ITR)`, "coapplicant_income_proof", true, "financial"));
  docs.push(requirement(`${coAppLabel}'s Last 2 Years ITR / Form 16`, "coapplicant_itr", true, "financial"));

  // Always collect Father and Mother identity documents
  if (!isFatherCoApp && fatherName) {
    docs.push(requirement(`${fatherName} (Father)'s Aadhaar Card`, "father_aadhar", true, "identity"));
    docs.push(requirement(`${fatherName} (Father)'s PAN Card`, "father_pan", true, "identity"));
  }
  if (!isMotherCoApp && motherName) {
    docs.push(requirement(`${motherName} (Mother)'s Aadhaar Card`, "mother_aadhar", true, "identity"));
    docs.push(requirement(`${motherName} (Mother)'s PAN Card`, "mother_pan", true, "identity"));
  }

  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.type)) return false;
    seen.add(doc.type);
    return true;
  });
}

export function isDocTypeMatchingRequirement(docTypeOrName: string, reqType: string, docName?: string): boolean {
  const normType = String(docTypeOrName || "").toLowerCase().trim();
  const normReq = String(reqType || "").toLowerCase().trim();
  const normName = String(docName || "").toLowerCase().trim();

  if (normType === normReq) return true;

  // Normalized base types
  if (normReq === "coapplicant_bank_statement" || normReq === "parent_bank_statement" || normReq === "bank_statement") {
    if (["bank_statement", "coapplicant_bank_statement", "parent_bank_statement", "father_bank_statement", "mother_bank_statement", "6_month_bank_statement", "bank_statements"].includes(normType)) return true;
    if (normType.includes("bank") && (normType.includes("statement") || normType.includes("passbook"))) return true;
    if (normName.includes("bank statement") || normName.includes("bank") || normName.includes("passbook")) return true;
  }

  if (normReq === "coapplicant_income_proof" || normReq === "parent_income_proof" || normReq === "income_proof") {
    if (["income_proof", "coapplicant_income_proof", "parent_income_proof", "father_income_proof", "mother_income_proof", "salary_slip", "salary_slips", "coapplicant_salary_slips", "parent_salary_slips", "salary"].includes(normType)) return true;
    if (normType.includes("income") || normType.includes("salary") || normType.includes("payslip")) return true;
    if (normName.includes("income proof") || normName.includes("salary") || normName.includes("payslip") || normName.includes("income")) return true;
  }

  if (normReq === "coapplicant_itr" || normReq === "parent_itr" || normReq === "itr") {
    if (["itr", "coapplicant_itr", "parent_itr", "father_itr", "mother_itr", "form_16", "form16", "income_tax_return"].includes(normType)) return true;
    if (normType.includes("itr") || normType.includes("form_16") || normType.includes("form16")) return true;
    if (normName.includes("itr") || normName.includes("tax return") || normName.includes("form 16")) return true;
  }

  if (normReq === "admission_letter") {
    if (["admission_letter", "offer_letter", "admit_card", "acceptance_letter"].includes(normType)) return true;
    if (normType.includes("admission") || normType.includes("offer")) return true;
    if (normName.includes("admission") || normName.includes("offer letter") || normName.includes("acceptance")) return true;
  }

  if (normReq === "cost_of_study") {
    if (["cost_of_study", "fee_structure", "fees_structure", "tuition_fee", "i20", "i_20"].includes(normType)) return true;
    if (normType.includes("cost") || normType.includes("fee") || normType.includes("tuition")) return true;
    if (normName.includes("cost of study") || normName.includes("fee structure") || normName.includes("tuition")) return true;
  }

  if (normReq === "photograph") {
    if (["photograph", "photo", "passport_photograph", "student_photo", "student_photograph"].includes(normType)) return true;
    if (normType.includes("photo")) return true;
    if (normName.includes("photo") || normName.includes("picture")) return true;
  }

  if (normReq === "test_score") {
    if (["test_score", "english_test", "aptitude_test", "ielts", "toefl", "gre", "gmat", "pte", "sat"].includes(normType)) return true;
    if (normType.includes("test") || normType.includes("ielts") || normType.includes("toefl") || normType.includes("gre") || normType.includes("gmat")) return true;
    if (normName.includes("ielts") || normName.includes("toefl") || normName.includes("gre") || normName.includes("gmat") || normName.includes("test score")) return true;
  }

  if (normReq === "passport") {
    if (["passport", "student_passport"].includes(normType)) return true;
    if (normType.includes("passport")) return true;
  }

  if (normReq === "national_id") {
    if (["national_id", "aadhar", "aadhaar", "student_aadhar", "student_aadhaar"].includes(normType)) return true;
  }

  if (normReq === "pan") {
    if (["pan", "student_pan"].includes(normType)) return true;
  }

  if (normReq === "coapplicant_aadhar" || normReq === "father_aadhar" || normReq === "mother_aadhar") {
    if (normType.includes("aadhar") || normType.includes("aadhaar")) {
      if (normReq.includes("coapplicant") && (normType.includes("coapplicant") || normType.includes("coapp") || normType.includes("parent"))) return true;
      if (normReq.includes("father") && normType.includes("father")) return true;
      if (normReq.includes("mother") && normType.includes("mother")) return true;
      if (normReq.includes("coapplicant")) return true;
    }
  }

  if (normReq === "coapplicant_pan" || normReq === "father_pan" || normReq === "mother_pan") {
    if (normType.includes("pan")) {
      if (normReq.includes("coapplicant") && (normType.includes("coapplicant") || normType.includes("coapp") || normType.includes("parent"))) return true;
      if (normReq.includes("father") && normType.includes("father")) return true;
      if (normReq.includes("mother") && normType.includes("mother")) return true;
      if (normReq.includes("coapplicant")) return true;
    }
  }

  return false;
}

export function getDocumentRequirementName(docType: string, fallback?: string, profile?: any): string {
  const match = getProfileDocumentRequirements(profile).find((doc) => doc.type === docType);
  return match?.name || fallback || docType.replace(/_/g, " ");
}
