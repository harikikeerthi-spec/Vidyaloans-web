/**
 * Single Source of Truth for Platform Statistics & Brand Metadata
 * Compliance with RBI Fair Practice Code & ASCI (Advertising Standards Council of India)
 *
 * All figures represent verified, substantiated metrics:
 * - Brand Name: VidyaLoans
 * - Students: 1,000+ verified scholars guided
 * - Lenders: 5+ partner banks & NBFCs (Auxilo, Poonawalla, Avanse, HDFC Credila, IDFC FIRST)
 * - Turnaround: 48 hours digital processing
 * - Countries: 30+ global study destinations
 * - Universities: 500+ verified partner institutions
 * - Referral Bonus: ₹3,000 per referral, ₹10,000 milestone bonus at 5 referrals
 * - Reviews: 4.9/5 from 2,000+ verified reviews (Source: Google Reviews)
 * - Disbursed: ₹100Cr+
 */

export const SITE_STATS = {
    brandName: "VidyaLoans",
    legalName: "VidyaLoans Financial Services",
    website: "https://www.vidyaloans.in",
    domain: "vidyaloans.in",

    // Platform Stats (Substantiated & Standardized)
    students: "1,000+",
    studentsCount: 1000,
    studentsLabel: "1,000+ Students Guided",

    lenders: "5+",
    lendersCount: 5,
    lendersLabel: "5+ Partner Banks & NBFCs",

    countries: "30+",
    countriesCount: 30,
    countriesLabel: "30+ Countries Covered",

    universities: "500+",
    universitiesCount: 500,
    universitiesLabel: "500+ Verified Universities",

    courses: "1,200+",
    coursesCount: 1200,
    coursesLabel: "1,200+ Courses Available",

    disbursed: "₹100Cr+",
    disbursedFloor: "₹100Cr+",

    approvalTime: "48 hours",
    approvalTimeShort: "48h",
    approvalTimeLabel: "48-Hour Digital Sanction",

    ratingScore: "4.9/5",
    ratingStars: "4.9/5 ★",
    ratingCount: "2,000+",
    ratingSource: "Google Reviews",
    ratingAttribution: "Based on 2,000+ Google Reviews",

    // Referral Program
    referralPerStudent: "₹3,000",
    referralBonusAt5: "₹10,000",
    referralBonusAt5Box: "₹10,000",
} as const;

export default SITE_STATS;
