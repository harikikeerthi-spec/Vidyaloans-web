export interface UniversityData {
    slug: string;
    name: string;
    shortName: string;
    location: string;
    country: string;
    countryCode: string;
    flag: string;
    founded: number;
    type: string; // Public / Private
    rank: number;
    rankBy: string; // QS, THE, etc.
    acceptanceRate: number;
    tuition: number;
    currency: string;
    description: string;
    heroImage: string;
    campusImages: string[];
    logo: string;
    primaryColor: string;
    gradient: string;
    badge: string;
    website: string;
    stats: {
        totalStudents: string;
        internationalStudents: string;
        facultyRatio: string;
        researchOutput: string;
        employmentRate: string;
        avgSalary: string;
    };
    programs: {
        name: string;
        degree: string;
        duration: string;
        tuition: string;
        icon: string;
    }[];
    topRecruiters: string[];
    requirements: {
        gpa: string;
        ielts: string;
        toefl: string;
        gre: string;
    };
    loanInfo: {
        availableLenders: string[];
        avgLoanAmount: string;
        collateralFree: boolean;
        fastTrack: boolean;
        notes: string;
    };
    pros: string[];
    campusFacilities: any[];
    funFacts?: string[];
    whyStudyHere?: string[];
    notableAlumni?: any[];
}

/**
 * Dynamic registry populated at runtime via AI search.
 * ZERO hardcoded university records in code.
 */
export const universities: Record<string, UniversityData> = {};
