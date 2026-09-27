
export interface BankData {
    name: string;
    slug: string;
    logo: string;
    rating: string;
    description: string;
    interestRate: string;
    maxLoan: string;
    approvalTime: string;
    primaryColor: string;
    gradient: string;
    stats: {
        studentsFunded: string;
        universitiesCovered: string;
        countriesSupported: string;
        customerRating: string;
    };
    features: {
        icon: string;
        title: string;
        desc: string;
        iconColor: string;
        bgColor: string;
    }[];
    specifications: {
        label: string;
        value: string;
    }[];
    eligibility: {
        title: string;
        desc: string;
    }[];
    documents: {
        icon: string;
        title: string;
        desc: string;
        color: string;
    }[];
    courses: {
        icon: string;
        title: string;
        color: string;
    }[];
    uniqueFeatures: {
        icon: string;
        title: string;
        desc: string;
    }[];
}

export const banks: Record<string, BankData> = {
    "idfc": {
        name: "IDFC First Bank",
        slug: "idfc",
        logo: "/banks/idfc.png",
        rating: "4.5",
        description: "Achieve your study abroad dreams with IDFC First Bank's flexible education loans. Competitive rates starting at 10.5% p.a. with up to ₹40 lakhs coverage.",
        interestRate: "10.25%",
        maxLoan: "₹40L",
        approvalTime: "48h",
        primaryColor: "#EC1C24",
        gradient: "linear-gradient(135deg, #EC1C24 0%, #B71519 100%)",
        stats: {
            studentsFunded: "25,000+",
            universitiesCovered: "800+",
            countriesSupported: "35+",
            customerRating: "4.5★"
        },
        features: [
            { icon: "percent", title: "Competitive Rates", desc: "Starting at 10.5% p.a. with flexible tenure options", iconColor: "text-red-500", bgColor: "bg-red-500/10" },
            { icon: "account_balance", title: "High Loan Amount", desc: "Up to ₹40 lakhs without collateral", iconColor: "text-blue-500", bgColor: "bg-blue-500/10" },
            { icon: "schedule", title: "Quick Processing", desc: "Sanction letter in as quick as 48 hours", iconColor: "text-green-500", bgColor: "bg-green-500/10" },
            { icon: "payments", title: "Flexible Repayment", desc: "Moratorium period during course + 1 year", iconColor: "text-orange-500", bgColor: "bg-orange-500/10" }
        ],
        specifications: [
            { label: "Interest Rate", value: "10.25% p.a." },
            { label: "Loan Amount", value: "Up to ₹40 Lakhs" },
            { label: "Repayment Tenure", value: "Up to 15 years" },
            { label: "Moratorium Period", value: "Course + 12 months" },
            { label: "Collateral", value: "Not required up to ₹40L" }
        ],
        eligibility: [
            { title: "Admission Confirmed", desc: "From recognized university abroad" },
            { title: "Co-Applicant Required", desc: "Parent or guardian with income proof" },
            { title: "Age Limit", desc: "18-35 years for the student" },
            { title: "Academic Record", desc: "Good academic track record required" }
        ],
        documents: [
            { icon: "badge", title: "Identity Proof", desc: "Passport, Aadhaar, PAN Card", color: "red" },
            { icon: "school", title: "Admission Letter", desc: "From the university/college", color: "blue" },
            { icon: "history_edu", title: "Academic Records", desc: "10th, 12th, UG marksheets", color: "green" },
            { icon: "account_balance_wallet", title: "Income Proof", desc: "Salary slips, ITR, statements", color: "purple" },
            { icon: "flight", title: "Visa & Travel", desc: "Valid passport, visa (if available)", color: "orange" },
            { icon: "receipt_long", title: "Fee Structure", desc: "Detailed breakdown from uni", color: "pink" }
        ],
        courses: [
            { icon: "computer", title: "MS in CS", color: "red" },
            { icon: "business", title: "MBA", color: "blue" },
            { icon: "biotech", title: "MS in Data Science", color: "green" },
            { icon: "engineering", title: "MS Engineering", color: "purple" },
            { icon: "local_hospital", title: "MBBS / MD", color: "orange" },
            { icon: "gavel", title: "LLM / Law", color: "pink" }
        ],
        uniqueFeatures: [
            { icon: "speed", title: "48-Hour Fast Track", desc: "One of the fastest processing times in the industry. Get sanctioned in just 2 working days." },
            { icon: "savings", title: "Zero Margin Money", desc: "No upfront margin money required. 100% of tuition and living expenses covered." },
            { icon: "support_agent", title: "Dedicated RM", desc: "Personal loan advisor who guides you through every step from application to disbursement." }
        ]
    },
    "auxilo": {
        name: "Auxilo Finserve",
        slug: "auxilo",
        logo: "/banks/auxilo.png",
        rating: "4.4",
        description: "Auxilo is a next-gen education finance company providing customized loan solutions for students aspiring to study in India and overseas.",
        interestRate: "10.25%",
        maxLoan: "No Limit",
        approvalTime: "72h",
        primaryColor: "#005CAB",
        gradient: "linear-gradient(135deg, #005CAB 0%, #003D73 100%)",
        stats: {
            studentsFunded: "15,000+",
            universitiesCovered: "1000+",
            countriesSupported: "40+",
            customerRating: "4.4★"
        },
        features: [
            { icon: "history_edu", title: "100% Financing", desc: "Covering tuition, living, travel and even laptop costs", iconColor: "text-blue-500", bgColor: "bg-blue-500/10" },
            { icon: "verified", title: "Customized Loans", desc: "Tailored to your specific course and financial needs", iconColor: "text-purple-500", bgColor: "bg-purple-500/10" },
            { icon: "bolt", title: "Fast Disbursement", desc: "Quick fund transfer once sanction letter is issued", iconColor: "text-yellow-500", bgColor: "bg-yellow-500/10" },
            { icon: "public", title: "Global Coverage", desc: "Support for 900+ global universities across 20 countries", iconColor: "text-green-500", bgColor: "bg-green-500/10" }
        ],
        specifications: [
            { label: "Interest Rate", value: "10.25% p.a." },
            { label: "Loan Amount", value: "No Upper Limit" },
            { label: "Repayment Tenure", value: "Up to 10 years" },
            { label: "Moratorium Period", value: "Course Duration + 6 months" },
            { label: "Collateral", value: "Both Secured & Unsecured" }
        ],
        eligibility: [
            { title: "Indian Citizenship", desc: "Applicant must be an Indian citizen" },
            { title: "Admission Proof", desc: "Confimed admission in recognized institute" },
            { title: "Co-Applicant", desc: "Parent/Guardian/Spouse with stable income" },
            { title: "Academic Record", desc: "Consistently good academic performance" }
        ],
        documents: [
            { icon: "badge", title: "KYC Documents", desc: "Aadhaar, PAN, Passport", color: "blue" },
            { icon: "school", title: "Academic Details", desc: "Marksheets, Entrance scores", color: "purple" },
            { icon: "description", title: "Admission Letter", desc: "Cost of study breakdown", color: "green" },
            { icon: "account_balance", title: "Bank Statements", desc: "Last 6 months of co-applicant", color: "orange" },
            { icon: "receipt", title: "Income Proof", desc: "Latest ITR and Salary Slips", color: "red" },
            { icon: "photo_camera", title: "Photographs", desc: "Passport size photos", color: "teal" }
        ],
        courses: [
            { icon: "science", title: "STEM Programs", color: "blue" },
            { icon: "trending_up", title: "Management / MBA", color: "green" },
            { icon: "medical_services", title: "Medical Studies", color: "red" },
            { icon: "palette", title: "Creative Arts", color: "purple" },
            { icon: "psychology", title: "Social Sciences", color: "orange" },
            { icon: "law", title: "Law Programs", color: "indigo" }
        ],
        uniqueFeatures: [
            { icon: "handshake", title: "Holistic Assessment", desc: "We look beyond just scores, considering your potential and career trajectory." },
            { icon: "payments", title: "Pre-Admission Sanction", desc: "Get your loan sanctioned even before you get your final admission letter." },
            { icon: "support", title: "Student-First approach", desc: "Dedicated support team to help with visa documentation and fund transfers." }
        ]
    },
    // Adding other banks with summarized info for now to keep it concise but functional
    "avanse": {
        name: "Avanse Financial",
        slug: "avanse",
        logo: "/banks/avanse.png",
        rating: "4.6",
        description: "Avanse Financial Services is a leading education-focused NBFC that provides hyper-personalized, 100% collateral-free education loans with fast approval and global support.",
        interestRate: "10.25%",
        maxLoan: "No Limit",
        approvalTime: "72h",
        primaryColor: "#0091DA",
        gradient: "linear-gradient(135deg, #0091DA 0%, #005CAB 100%)",
        stats: {
            studentsFunded: "20,000+",
            universitiesCovered: "1,200+",
            countriesSupported: "45+",
            customerRating: "4.6★"
        },
        features: [
            { icon: "bolt", title: "Fast Sanctions", desc: "Get conditional approval in just 3 working days", iconColor: "text-blue-500", bgColor: "bg-blue-500/10" },
            { icon: "history_edu", title: "100% Funding", desc: "Covers tuition fees, living costs, and travel expenses", iconColor: "text-purple-500", bgColor: "bg-purple-500/10" },
            { icon: "verified", title: "Pre-Admission Letter", desc: "Sanction letters available prior to final admission", iconColor: "text-green-500", bgColor: "bg-green-500/10" },
            { icon: "payments", title: "Tailored Repayments", desc: "Customized grace periods and interest options", iconColor: "text-orange-500", bgColor: "bg-orange-500/10" }
        ],
        specifications: [
            { label: "Interest Rate", value: "10.25% p.a." },
            { label: "Loan Amount", value: "No Upper Limit" },
            { label: "Repayment Tenure", value: "Up to 15 years" },
            { label: "Moratorium Period", value: "Course Duration + 6 months" },
            { label: "Collateral", value: "Not required up to ₹50L" }
        ],
        eligibility: [
            { title: "Academic Profile", desc: "A strong academic record and standardized test scores (GRE/GMAT/IELTS)" },
            { title: "Admitted Status", desc: "Admission confirmation letter from a recognized foreign institution" },
            { title: "Co-Applicant Income", desc: "Financial co-applicant (parents/spouse) with proof of steady income" },
            { title: "Financial Health", desc: "Clean credit history and satisfactory CIBIL rating of co-applicant" }
        ],
        documents: [
            { icon: "badge", title: "Identity & Address", desc: "Aadhaar, Passport, Utility bills", color: "blue" },
            { icon: "school", title: "Academic Transcripts", desc: "Graduation, 12th, 10th and test scores", color: "purple" },
            { icon: "description", title: "Admission Details", desc: "University offer letter and tuition cost schedule", color: "green" },
            { icon: "account_balance", title: "Bank Statements", desc: "Last 6 months statements of main co-applicant", color: "orange" },
            { icon: "receipt", title: "Income Records", desc: "ITR (last 2 years), form 16, salary slips", color: "red" },
            { icon: "photo_camera", title: "Applicant Photo", desc: "Recent passport size photographs", color: "teal" }
        ],
        courses: [
            { icon: "science", title: "STEM Programs", color: "blue" },
            { icon: "trending_up", title: "Management & MBA", color: "green" },
            { icon: "medical_services", title: "Medical Studies", color: "red" },
            { icon: "palette", title: "Liberal Arts & Design", color: "purple" },
            { icon: "psychology", title: "Social Sciences", color: "orange" },
            { icon: "engineering", title: "IT & Engineering", color: "indigo" }
        ],
        uniqueFeatures: [
            { icon: "payments", title: "100% Funding No Margin", desc: "Zero margin money required. Avanse will fund 100% of all eligible costs." },
            { icon: "description", title: "Pre-Visa Disbursement", desc: "Ensures immediate release of funds required for your visa application process." },
            { icon: "support_agent", title: "Hyper-Personalized Solutions", desc: "Tailors interest rates and repayment plans based on the applicant's future earning potential." }
        ]
    },
    "credila": {
        name: "HDFC Credila",
        slug: "credila",
        logo: "/banks/credila.png",
        rating: "4.8",
        description: "HDFC Credila is India's first dedicated education loan provider. Get customized loans with flexible terms, high limits, and fast-track processing for 2,500+ global universities.",
        interestRate: "10.25%",
        maxLoan: "No Limit",
        approvalTime: "5 days",
        primaryColor: "#004B8D",
        gradient: "linear-gradient(135deg, #004B8D 0%, #002D54 100%)",
        stats: {
            studentsFunded: "50,000+",
            universitiesCovered: "2,500+",
            countriesSupported: "50+",
            customerRating: "4.8★"
        },
        features: [
            { icon: "verified", title: "Dedicated Specialist", desc: "Specialized team dealing only with education loans", iconColor: "text-blue-500", bgColor: "bg-blue-500/10" },
            { icon: "account_balance", title: "No Upper Limit", desc: "Higher loan amounts sanctioned based on profile", iconColor: "text-purple-500", bgColor: "bg-purple-500/10" },
            { icon: "history_edu", title: "Tax Benefits", desc: "Tax deduction benefits under Section 80E of Income Tax Act", iconColor: "text-green-500", bgColor: "bg-green-500/10" },
            { icon: "payments", title: "Flexible Repayment", desc: "Up to 15 years loan tenure with flexible EMI options", iconColor: "text-orange-500", bgColor: "bg-orange-500/10" }
        ],
        specifications: [
            { label: "Interest Rate", value: "10.25% p.a." },
            { label: "Loan Amount", value: "No Upper Limit" },
            { label: "Repayment Tenure", value: "Up to 15 years" },
            { label: "Moratorium Period", value: "Course Duration + 12 months" },
            { label: "Collateral", value: "Both Secured & Unsecured" }
        ],
        eligibility: [
            { title: "Confirmed Admission", desc: "Offer letter from a recognized university/college abroad" },
            { title: "Creditworthy Co-Applicant", desc: "Parents/siblings with stable income and good credit score" },
            { title: "Academic Merit", desc: "Consistent academic record throughout high school & college" },
            { title: "Eligible Courses", desc: "STEM, Management, and professional degree courses" }
        ],
        documents: [
            { icon: "badge", title: "KYC & Identity", desc: "PAN, Aadhaar, Passport copies", color: "indigo" },
            { icon: "school", title: "Admission Letter", desc: "University offer letter and fee schedule", color: "blue" },
            { icon: "history_edu", title: "Academic Records", desc: "10th/12th marksheets, Degree certificate", color: "green" },
            { icon: "account_balance_wallet", title: "Co-Applicant Income", desc: "Salary slips, Form 16, Bank statements", color: "purple" },
            { icon: "flight", title: "Travel Documents", desc: "Passport and Visa copy (when available)", color: "orange" },
            { icon: "receipt_long", title: "Asset Proof", desc: "Property documents for secured loans (if applicable)", color: "pink" }
        ],
        courses: [
            { icon: "computer", title: "MS Computer Science", color: "indigo" },
            { icon: "business", title: "MBA", color: "blue" },
            { icon: "engineering", title: "Engineering & Tech", color: "green" },
            { icon: "science", title: "Data Science & Biotech", color: "purple" },
            { icon: "palette", title: "Design & Architecture", color: "orange" },
            { icon: "gavel", title: "LLM / Law Programs", color: "pink" }
        ],
        uniqueFeatures: [
            { icon: "home_work", title: "Doorstep Services", desc: "Get documents collected and processed from your doorstep by a dedicated HDFC advisor." },
            { icon: "payments", title: "100% Cost Coverage", desc: "Funding covers 100% tuition fee, living expenses, flight ticket, and computer equipment." },
            { icon: "verified_user", title: "Pre-Visa Disbursement", desc: "Hassle-free pre-visa funds disbursement for country-specific visa requirements." }
        ]
    },
    "poonawalla": {
        name: "Poonawalla Fincorp",
        slug: "poonawalla",
        logo: "/banks/poonawalla.jpg",
        rating: "4.3",
        description: "Poonawalla Fincorp offers quick, hassle-free education loans with competitive interest rates, minimum paperwork, and end-to-end digital processing.",
        interestRate: "10.25%",
        maxLoan: "₹50L",
        approvalTime: "3 days",
        primaryColor: "#F47920",
        gradient: "linear-gradient(135deg, #F47920 0%, #C85911 100%)",
        stats: {
            studentsFunded: "10,000+",
            universitiesCovered: "500+",
            countriesSupported: "25+",
            customerRating: "4.3★"
        },
        features: [
            { icon: "speed", title: "Paperless Process", desc: "100% digital journey from application to approval", iconColor: "text-orange-500", bgColor: "bg-orange-50/10" },
            { icon: "percent", title: "Attractive Rates", desc: "Flexible rates based on candidate profile", iconColor: "text-blue-500", bgColor: "bg-blue-500/10" },
            { icon: "description", title: "Minimal Documents", desc: "Requires only essential KYC and academic proofs", iconColor: "text-green-500", bgColor: "bg-green-500/10" },
            { icon: "payments", title: "Flexible Tenure", desc: "Repayment structures that align with post-study income", iconColor: "text-red-500", bgColor: "bg-red-500/10" }
        ],
        specifications: [
            { label: "Interest Rate", value: "10.25% p.a." },
            { label: "Loan Amount", value: "Up to ₹50 Lakhs" },
            { label: "Repayment Tenure", value: "Up to 10 years" },
            { label: "Moratorium Period", value: "Course Duration + 6 months" },
            { label: "Collateral", value: "Unsecured up to ₹50L" }
        ],
        eligibility: [
            { title: "Age & Nationality", desc: "Applicant must be an Indian citizen, aged between 18-35 years" },
            { title: "Admission Confirmation", desc: "Must have a secured seat at an approved overseas institution" },
            { title: "Co-Applicant Status", desc: "Financial co-applicant (parents/spouse) with stable salary or business income" },
            { title: "Credit Score", desc: "Co-applicant must have a clean repayment history and solid CIBIL rating" }
        ],
        documents: [
            { icon: "badge", title: "Identity Proof", desc: "Aadhaar, Passport, PAN Card", color: "orange" },
            { icon: "school", title: "Admission Letter", desc: "Official admission confirmation and cost breakdown", color: "blue" },
            { icon: "history_edu", title: "Academic Records", desc: "Mark sheets of highest qualified degree", color: "green" },
            { icon: "account_balance_wallet", title: "Co-Applicant Income", desc: "Last 3 months salary slips, ITR, and Bank Statements", color: "purple" },
            { icon: "flight", title: "Visa Copy", desc: "Visa approval copy (required prior to disbursement)", color: "red" },
            { icon: "receipt_long", title: "Fee Invoice", desc: "Official fee structure from the university", color: "pink" }
        ],
        courses: [
            { icon: "computer", title: "MS Computer Science", color: "red" },
            { icon: "business", title: "MBA / Business", color: "blue" },
            { icon: "biotech", title: "Data Science & Biotech", color: "green" },
            { icon: "engineering", title: "Engineering Programs", color: "purple" },
            { icon: "local_hospital", title: "Healthcare Admin", color: "orange" },
            { icon: "gavel", title: "LLM & Public Policy", color: "pink" }
        ],
        uniqueFeatures: [
            { icon: "smartphone", title: "100% Digital Execution", desc: "Seamless digital flow allows you to upload, review, and execute agreements entirely online." },
            { icon: "savings", title: "Zero Collateral up to ₹50L", desc: "No collateral required for premier list of colleges and universities globally." },
            { icon: "support_agent", title: "Dedicated Relationship Expert", desc: "Assigned advisor to handhold you and your parents through the entire cycle." }
        ]
    }
};
