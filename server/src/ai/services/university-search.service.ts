import { Injectable } from '@nestjs/common';
import { OpenRouterService } from './openrouter.service';

export interface University {
  name: string;
  country: string;
  city?: string;
  ranking?: number;
  worldRanking?: number;
  type?: string;
  website?: string;
  description?: string;
  popularCourses?: string[];
  averageFees?: string;
  acceptanceRate?: number;
  scholarships?: boolean;
  logoUrl?: string;
  imageUrl?: string;
  isFeatured?: boolean;
}

export interface UniversityDetails extends University {
  admissionRequirements?: {
    minGPA?: string;
    testScores?: string[];
    languageRequirements?: string[];
  };
  programs?: Array<{
    name: string;
    description?: string;
    tuition?: string;
  }>;
  employmentStats?: {
    employmentRate?: number;
    averageSalary?: string;
    topEmployers?: string[];
  };
  facilities?: string[];
  funFacts?: string[];
  whyStudyHere?: string[];
  notableAlumni?: string[];
}

@Injectable()
export class UniversitySearchService {
  constructor(private readonly openRouterService: OpenRouterService) { }

  /**
   * Search universities by country using AI
   * @param countries Array of country names
   * @param limit Maximum number of universities to return per country
   * @returns Array of universities found
   */
  async searchUniversitiesByCountry(
    countries: string[],
    limit: number = 10,
  ): Promise<University[]> {
    if (!countries || countries.length === 0) {
      throw new Error('At least one country must be provided');
    }

    const countriesStr = countries.join(', ');

    const prompt = `You are an expert in international education and university rankings. Your task is to list REAL, ACCREDITED universities in the following countries: ${countriesStr}

For each country, list approximately ${limit} top universities that actually exist and are well-known.

Return a JSON object with a "universities" key. The value should be an array with this structure:
{
  "universities": [
    {
      "name": "Full University Name",
      "loc": "City, Country",
      "country": "Country Name",
      "rank": 15,
      "worldRanking": 150,
      "type": "Public/Private",
      "website": "https://example.com",
      "description": "Brief description of the university",
      "courses": ["Engineering", "Business", "Medicine"],
      "tuition": 25000,
      "accept": 15,
      "min_gpa": 7.5,
      "min_ielts": 6.5,
      "min_toefl": 90,
      "scholarships": true,
      "loan": true
    }
  ]
}

CRITICAL RULES:
1. ONLY include REAL universities that actually exist.
2. Numeric fields MUST be single integers. DO NOT use ranges like "351-400". If a range is known, use the middle or lower bound as a single integer.
3. "rank" and "worldRanking" MUST be integers.
4. "accept" MUST be an integer (e.g. 15 for 15%).
5. "tuition" MUST be an integer in USD.
6. Return ONLY valid JSON.`;

    try {
      const response = await this.openRouterService.getJson<any>(prompt);
      let universities = response.universities || (Array.isArray(response) ? response : []);

      // Robust Normalization Pass
      const validUniversities = universities.filter(uni =>
        uni && typeof uni === 'object' && uni.name && typeof uni.name === 'string'
      ).map(uni => {
        // Map common hallucinations or string numbers back to integers
        const toInt = (val: any) => {
          if (typeof val === 'number') return Math.floor(val);
          if (typeof val === 'string') {
            // Handle "351-400" -> 351
            const cleaned = val.split('-')[0].replace(/[^\d]/g, '');
            return parseInt(cleaned, 10) || 0;
          }
          return 0;
        };

        return {
          ...uni,
          rank: toInt(uni.rank || uni.worldRanking),
          worldRanking: toInt(uni.worldRanking || uni.rank),
          accept: toInt(uni.accept || uni.acceptanceRate),
          tuition: toInt(uni.tuition),
          min_gpa: parseFloat(String(uni.min_gpa || 7.0)),
          slug: uni.slug || uni.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          courses: Array.isArray(uni.courses) ? uni.courses : []
        };
      });

      return validUniversities;
    } catch (error) {
      console.error('University search failed:', error);
      throw new Error(`Failed to search universities: ${error.message}`);
    }
  }

  /**
   * Get detailed information about a specific university
   * @param universityName Name of the university
   * @param country Country where the university is located
   * @returns Detailed university information
   */
  async getUniversityDetailsFull(
    universityName: string,
    country: string,
  ): Promise<UniversityDetails> {
    if (!universityName || !country) {
      throw new Error('University name and country are required');
    }

    const prompt = `You are an expert in international education. Provide comprehensive, accurate information about ${universityName} in ${country}.

Return detailed information as a JSON object with this structure:
{
  "name": "Full University Name",
  "country": "Country",
  "city": "City",
  "ranking": 15,
  "worldRanking": 150,
  "type": "Public/Private/Research",
  "website": "https://www.university-official-domain.edu",
  "description": "Detailed description",
  "popularCourses": ["Course1", "Course2", "Course3"],
  "averageFees": "Tuition range per year",
  "acceptanceRate": 15,
  "scholarships": true,
  "admissionRequirements": {
    "minGPA": "3.5 or equivalent",
    "testScores": ["GMAT", "GRE"],
    "languageRequirements": ["TOEFL 90+", "IELTS 6.5+"]
  },
  "programs": [
    { "name": "Program Name", "description": "Program details", "tuition": "Annual tuition" }
  ],
  "employmentStats": {
    "employmentRate": 95,
    "averageSalary": "Average graduate salary",
    "topEmployers": ["Company1", "Company2", "Company3"]
  },
  "facilities": ["Facility1", "Facility2"],
  "funFacts": ["Fact1", "Fact2"],
  "whyStudyHere": ["Reason1", "Reason2"],
  "notableAlumni": ["Alumni1", "Alumni2"]
}

CRITICAL: "website" MUST be the actual original official university domain (e.g. official .edu or .ac.uk domain).
Return ONLY valid JSON.`;

    try {
      const details = await this.openRouterService.getJson<UniversityDetails>(prompt);
      return details;
    } catch (error) {
      console.error('Failed to fetch university details:', error);
      throw new Error(`Failed to fetch details for ${universityName}: ${error.message}`);
    }
  }

  /**
   * Validate that universities are real and not fictional
   * @param universities Array of universities to validate
   * @returns Array of validated universities
   */
  async validateUniversityRealness(universities: University[]): Promise<University[]> {
    if (!universities || universities.length === 0) {
      return [];
    }

    // Create a validation prompt
    const universityNames = universities.map(u => `${u.name} (${u.country})`).join(', ');

    const prompt = `You are an expert in international education and university rankings.

Review the following list of universities and identify which ones are REAL, ACCREDITED institutions that actually exist:

${universityNames}

For each university, respond with ONLY a JSON array of objects with this structure:
[
  {
    "name": "University Name",
    "country": "Country",
    "isReal": true/false,
    "confidence": 0.95
  }
]

Return ONLY the JSON array with validation results. No other text.`;

    try {
      const validationResults = await this.openRouterService.getJson<
        Array<{ name: string; country: string; isReal: boolean; confidence: number }>
      >(prompt);

      // Filter universities based on validation
      const realUniversities = universities.filter(uni => {
        const validation = validationResults.find(
          v => v.name.toLowerCase() === uni.name.toLowerCase() &&
            v.country.toLowerCase() === uni.country.toLowerCase(),
        );
        return validation ? validation.isReal && validation.confidence > 0.8 : true; // Fail permissive
      });

      return realUniversities;
    } catch (error) {
      console.error('University validation failed:', error);
      // Fail permissive - return all if validation fails
      return universities;
    }
  }

  /**
   * Get list of popular countries for education
   * @returns Array of country names
   */
  async getPopularCountries(): Promise<string[]> {
    const prompt = `List the top 15 most popular countries for international students seeking higher education. Return a JSON object with a "countries" key.
    
    Example format:
    { "countries": ["United States", "United Kingdom", "Canada", "Australia"] }
    
    MUST respond ONLY with JSON.`;

    try {
      const response = await this.openRouterService.getJson<any>(prompt);
      const countries = response.countries || (Array.isArray(response) ? response : []);
      return Array.isArray(countries) ? countries : [];
    } catch (error) {
      console.error('Failed to fetch popular countries:', error);
      // Return default popular countries if AI fails
      return [
        'United States',
        'United Kingdom',
        'Canada',
        'Australia',
        'Germany',
        'France',
        'Netherlands',
        'Switzerland',
        'Singapore',
        'Japan',
        'New Zealand',
        'Sweden',
        'Ireland',
        'Spain',
        'Italy',
      ];
    }
  }
}
