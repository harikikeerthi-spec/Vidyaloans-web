require('dotenv').config();
const { Pool } = require('pg');
const crypto = require('crypto');

async function seedBanks() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const banks = [
    {
      name: "IDFC FIRST Bank",
      shortName: "idfc",
      country: "India",
      type: "Private",
      loanTypes: ["Education Loan"],
      educationLoan: true,
      interestRateMin: 10.25,
      interestRateMax: 13.5,
      maxLoanAmount: "₹1.5 Crore",
      collateralRequired: false,
      collateralFreeLimit: "50 Lakhs",
      processingFee: "1% + GST",
      processingTime: "48 hours",
      features: [
        "100% Financing: Covers tuition, living expenses, and travel",
        "Fast Digital Approval: Sanction within 48 to 72 hours",
        "No Collateral: Up to ₹50 Lakhs for premier universities"
      ],
      website: "https://www.idfcfirstbank.com",
      contactNumber: "1800 10 888",
      email: "educationloan@idfcfirstbank.com",
      logoUrl: "/banks/idfc.png",
      isPopular: true
    },
    {
      name: "HDFC Credila",
      shortName: "credila",
      country: "India",
      type: "NBFC",
      loanTypes: ["Education Loan"],
      educationLoan: true,
      interestRateMin: 10.25,
      interestRateMax: 13.75,
      maxLoanAmount: "No Limit",
      collateralRequired: false,
      collateralFreeLimit: "50 Lakhs",
      processingFee: "1% - 1.25% + GST",
      processingTime: "3-5 days",
      features: [
        "Specialist Education Lender: Customized loans for 35+ countries",
        "Pre-Visa Disbursal: Proof of funds before visa interview",
        "Flexible Co-borrower: Non-standard co-applicant flexibility"
      ],
      website: "https://www.hdfccredila.com",
      contactNumber: "1800 209 8840",
      email: "loan@hdfccredila.com",
      logoUrl: "/banks/credila.png",
      isPopular: true
    },
    {
      name: "Auxilo Finserve",
      shortName: "auxilo",
      country: "India",
      type: "NBFC",
      loanTypes: ["Education Loan"],
      educationLoan: true,
      interestRateMin: 10.5,
      interestRateMax: 14.0,
      maxLoanAmount: "₹1 Crore",
      collateralRequired: false,
      collateralFreeLimit: "50 Lakhs",
      processingFee: "1% + GST",
      processingTime: "48 hours",
      features: [
        "100% Financing of Total Cost of Education",
        "Zero margin money required for top universities",
        "Fast-track processing within 48 hours"
      ],
      website: "https://www.auxilo.com",
      contactNumber: "1800 266 4333",
      email: "support@auxilo.com",
      logoUrl: "/banks/auxilo.png",
      isPopular: true
    },
    {
      name: "Avanse Financial",
      shortName: "avanse",
      country: "India",
      type: "NBFC",
      loanTypes: ["Education Loan"],
      educationLoan: true,
      interestRateMin: 10.75,
      interestRateMax: 14.25,
      maxLoanAmount: "No Limit",
      collateralRequired: false,
      collateralFreeLimit: "50 Lakhs",
      processingFee: "1% - 1.5% + GST",
      processingTime: "3-5 days",
      features: [
        "High Loan Amounts with flexible collateral terms",
        "Living Expenses & Living Pre-requisite Funding",
        "Comprehensive coverage of global universities"
      ],
      website: "https://www.avanse.com",
      contactNumber: "1800 222 344",
      email: "response@avanse.com",
      logoUrl: "/banks/avanse.png",
      isPopular: true
    },
    {
      name: "Poonawalla Fincorp",
      shortName: "poonawalla",
      country: "India",
      type: "NBFC",
      loanTypes: ["Education Loan"],
      educationLoan: true,
      interestRateMin: 10.5,
      interestRateMax: 13.9,
      maxLoanAmount: "₹75 Lakhs",
      collateralRequired: false,
      collateralFreeLimit: "40 Lakhs",
      processingFee: "1% + GST",
      processingTime: "3-5 days",
      features: [
        "Minimal Documentation & quick turnaround",
        "Competitive ROI for STEM and Management programs",
        "Transparent fee structure with no hidden costs"
      ],
      website: "https://poonawallafincorp.com",
      contactNumber: "1800 208 0000",
      email: "customercare@poonawallafincorp.com",
      logoUrl: "/banks/poonawalla.jpg",
      isPopular: true
    }
  ];

  try {
    for (const b of banks) {
      const existing = await pool.query('SELECT id, name FROM "Bank" WHERE "shortName" = $1 OR "name" = $2', [b.shortName, b.name]);
      if (existing.rows.length === 0) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await pool.query(
          `INSERT INTO "Bank" (
            "id", "name", "shortName", "country", "type", "loanTypes", "educationLoan",
            "interestRateMin", "interestRateMax", "maxLoanAmount", "collateralRequired",
            "collateralFreeLimit", "processingFee", "processingTime", "features",
            "website", "contactNumber", "email", "logoUrl", "isPopular", "createdAt", "updatedAt"
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
          [
            id, b.name, b.shortName, b.country, b.type, b.loanTypes, b.educationLoan,
            b.interestRateMin, b.interestRateMax, b.maxLoanAmount, b.collateralRequired,
            b.collateralFreeLimit, b.processingFee, b.processingTime, b.features,
            b.website, b.contactNumber, b.email, b.logoUrl, b.isPopular, now, now
          ]
        );
        console.log(`Inserted bank: ${b.name}`);
      } else {
        console.log(`Bank already exists: ${b.name}`);
      }
    }
    console.log('Bank seeding completed successfully.');
  } catch (err) {
    console.error('Error seeding banks:', err);
  } finally {
    await pool.end();
  }
}

seedBanks();
