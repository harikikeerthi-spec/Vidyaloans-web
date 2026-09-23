import { Controller, Post, Body, BadRequestException, Get, Param, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../chat/email.service';
import { EligibilityService } from './services/eligibility.service';
import { LoanRecommendationService } from './services/loan-recommendation.service';
import { SopAnalysisService } from './services/sop-analysis.service';
import { GradeConversionService } from './services/grade-conversion.service';
import { UniversityComparisonService } from './services/university-comparison.service';
import { AdmitPredictorService } from './services/admit-predictor.service';
import { OpenRouterService } from './services/openrouter.service';
import { UniversitySearchService, University, UniversityDetails } from './services/university-search.service';
import { VisaInterviewService, InterviewMessage, EvaluationResult } from './services/visa-interview.service';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('ai')
export class AiController {
  constructor(
    private readonly eligibilityService: EligibilityService,
    private readonly loanRecommendationService: LoanRecommendationService,
    private readonly sopAnalysisService: SopAnalysisService,
    private readonly gradeConversionService: GradeConversionService,
    private readonly universityComparisonService: UniversityComparisonService,
    private readonly admitPredictorService: AdmitPredictorService,
    private readonly openRouterService: OpenRouterService,
    private readonly universitySearchService: UniversitySearchService,
    private readonly visaInterviewService: VisaInterviewService,
    private readonly supabase: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) { }

  private async resolveUser(req: any, body: any): Promise<{ email: string; name: string } | null> {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader?.split(' ')[1];
      if (token) {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.configService.get('JWT_SECRET')
        });
        if (payload && payload.email) {
          return {
            email: payload.email,
            name: `${payload.firstName || ''} ${payload.lastName || ''}`.trim() || 'Student',
          };
        }
      }
    } catch (e) {
      // Ignore token verification errors (guest user flow)
    }

    const userId = body?.userId || body?.profile?.userId;
    if (userId) {
      try {
        const { data: dbUser } = await this.supabase.getClient()
          .from('User')
          .select('firstName, lastName, email')
          .eq('id', userId)
          .maybeSingle();

        if (dbUser?.email) {
          return {
            email: dbUser.email,
            name: `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim() || 'Student',
          };
        }
      } catch (e) {
        console.warn('Failed to resolve user from body userId:', e.message);
      }
    }

    return null;
  }

  @Post('eligibility-check')
  async checkEligibility(
    @Req() req: any,
    @Body()
    data: any,
  ) {
    const eligibilityResult = await this.eligibilityService.calculateEligibilityScore(data);

    const loanRecommendations = await this.loanRecommendationService.recommendLoans(
      eligibilityResult.score,
      data.credit,
      eligibilityResult.ratio,
      data.loan,
      data.coApplicant,
      data.collateral,
      data.study,
    );

    try {
      await this.eligibilityService.saveLog({
        age: Number(data.age) || 0,
        credit: Number(data.credit) || 0,
        income: Number(data.income) || 0,
        loan: Number(data.loan) || 0,
        employment: String(data.employment || 'unknown'),
        study: String(data.study || 'unknown'),
        coApplicant: String(data.coApplicant || 'no'),
        collateral: String(data.collateral || 'no'),
        score: eligibilityResult.score,
        status: eligibilityResult.status,
        rateRange: eligibilityResult.rateRange,
        coverage: eligibilityResult.coverage,
        recommendations: loanRecommendations,
        userId: data.userId || null,
      });
    } catch (e) {
      console.error('Failed to save loan eligibility record:', e);
    }

    const user = await this.resolveUser(req, data);
    if (user) {
      try {
        const emailHtml = this.buildEligibilityHtml(eligibilityResult, loanRecommendations);
        const textSummary = `Your VidyaLoan Eligibility score is ${eligibilityResult.score}/100. Status: ${eligibilityResult.status}. Recommended interest range: ${eligibilityResult.rateRange}.`;
        await this.emailService.sendAiToolResultEmail(
          user.email,
          user.name,
          'Loan Eligibility Checker',
          emailHtml,
          textSummary
        );
      } catch (err) {
        console.error('Failed to send eligibility result email:', err);
      }
    }

    return {
      success: true,
      eligibility: eligibilityResult,
      recommendations: loanRecommendations,
    };
  }

  @Post('sop-analysis')
  async analyzeSop(
    @Req() req: any,
    @Body()
    data: {
      text?: string;
      sop?: string;
      userId?: string;
    },
  ) {
    const sopText = data.text || data.sop || '';
    const result = await this.sopAnalysisService.analyzeSop(sopText);

    const user = await this.resolveUser(req, data);
    if (user && sopText.trim().length >= 50) {
      try {
        const emailHtml = this.buildSopAnalysisHtml(result);
        const textSummary = `Your SOP analysis score is ${result.totalScore}/100. Quality level: ${result.quality}. Plagiarism risk: ${result.plagiarismScore}%.`;
        await this.emailService.sendAiToolResultEmail(
          user.email,
          user.name,
          'SOP Analyzer',
          emailHtml,
          textSummary
        );
      } catch (err) {
        console.error('Failed to send SOP analysis result email:', err);
      }
    }

    return {
      success: true,
      analysis: result,
    };
  }

  @Post('humanize-sop')
  async humanizeSop(
    @Req() req: any,
    @Body()
    data: {
      text: string;
      userId?: string;
    },
  ) {
    const result = await this.sopAnalysisService.humanizeSop(data.text);

    const user = await this.resolveUser(req, data);
    if (user) {
      try {
        const emailHtml = this.buildHumanizeSopHtml(result);
        const textSummary = `Thank you for using the SOP Humanizer on VidyaLoan! We have successfully humanized your Statement of Purpose.`;
        await this.emailService.sendAiToolResultEmail(
          user.email,
          user.name,
          'SOP Writer & Humanizer',
          emailHtml,
          textSummary
        );
      } catch (err) {
        console.error('Failed to send SOP humanizer result email:', err);
      }
    }

    return {
      success: true,
      ...result,
    };
  }

  @Post('convert-grades')
  async convertGrades(
    @Body()
    data: {
      inputType: 'letterGrade' | 'percentage' | 'gpa' | 'cgpa' | 'marks';
      inputValue: string | number;
      totalMarks?: number;
      outputType: 'letterGrade' | 'percentage' | 'gpa' | 'cgpa';
      gradingSystem?: 'US' | 'UK' | 'India' | 'Canada' | 'Australia';
      formula?: 'cbse' | 'direct' | 'vtu' | 'mumbai';
    },
  ): Promise<any> {
    const result = await this.gradeConversionService.convertGrade(data);
    return {
      success: true,
      gradeConversion: result,
    };
  }

  @Post('analyze-grades')
  async analyzeGrades(
    @Body()
    data: {
      marks?: number[];
      subjects?: string[];
      totalMarks?: number;
      gpa?: number;
      percentage?: number;
      formula?: 'cbse' | 'direct' | 'vtu' | 'mumbai';
    },
  ): Promise<any> {
    // Validate marks if provided and compute overall percentage safely
    const marks = data.marks || [];
    const totalPerSubject = data.totalMarks || 100;

    if (marks.length > 0) {
      for (const m of marks) {
        if (typeof m !== 'number' || isNaN(m) || m < 0 || m > totalPerSubject) {
          throw new BadRequestException(`Each mark must be a number between 0 and ${totalPerSubject}`);
        }
      }
    }

    const percentage = marks.length
      ? (marks.reduce((a, b) => a + b, 0) / (marks.length * totalPerSubject)) * 100
      : (data.percentage ?? 0);

    const result = await this.gradeConversionService.convertGrade({
      inputType: 'percentage',
      inputValue: percentage,
      outputType: 'percentage',
      formula: data.formula || 'cbse',
    });

    // Enhanced analysis with marks breakdown
    const analysisData = {
      percentage: result.percentage,
      cgpa: result.cgpa,
      gpa: result.gpa,
      letterGrade: result.letterGrade,
      classification: result.classification,
      formulaUsed: result.formulaUsed,
      internationalEquivalent: result.internationalEquivalent,
      analysis: result.analysis,
      marksBreakdown: data.subjects
        ? data.subjects.map((subject, index) => ({
          subject,
          marks: data.marks?.[index] || 0,
          outOf: totalPerSubject,
        }))
        : null,
    };

    return {
      success: true,
      gradeAnalysis: analysisData,
    };
  }

  @Post('compare-grades')
  async compareGrades(
    @Body()
    data: {
      assessments: Array<{
        name: string;
        percentage: number;
      }>;
    },
  ): Promise<any> {
    const result = await this.gradeConversionService.comparePerformance(data.assessments);
    return {
      success: true,
      comparison: result,
    };
  }

  @Post('compare-universities')
  async compareUniversities(
    @Body()
    data: {
      uni1: string;
      uni2: string;
      program1?: string;
      program2?: string;
    },
  ) {
    const result = await this.universityComparisonService.compare(
      data.uni1,
      data.uni2,
      data.program1,
      data.program2
    );
    return {
      success: true,
      data: result,
    };
  }

  @Post('compare-shortlist')
  async compareShortlist(
    @Body()
    data: {
      shortlist: Array<{ name: string; course: string }>;
      profile: { bachelors?: string; workExp?: string; gpa?: string };
    },
  ) {
    const result = await this.universityComparisonService.compareShortlist(
      data.shortlist,
      data.profile
    );
    return {
      success: true,
      data: result,
    };
  }

  @Post('predict-admission')
  async predictAdmission(
    @Req() req: any,
    @Body() body: any
  ) {
    const result: any = await this.admitPredictorService.predict(body);

    const user = await this.resolveUser(req, body);
    if (user) {
      try {
        const emailHtml = this.buildPredictAdmissionHtml(result);
        const textSummary = `Your admission probability for ${result.university} is predicted to be ${result.probability}%.`;
        await this.emailService.sendAiToolResultEmail(
          user.email,
          user.name,
          'Admit Predictor',
          emailHtml,
          textSummary
        );
      } catch (err) {
        console.error('Failed to send admission prediction result email:', err);
      }
    }

    return {
      success: true,
      prediction: result
    };
  }

  @Post('check-relevance')
  async checkRelevance(@Body() data: { topic?: string; title?: string; content: string }) {
    const topicContext = data.topic || data.title || 'General Discussion';
    const contentToVerify = data.content || data.title || '';

    const prompt = `You are an AI moderator for a student community focused on international education and loans.
    Your goal is to ALLOW any content that is HELPFUL, RELEVANT, or EVEN LOOSELY RELATED to the following topics:
    - Education Loans (Eligibility, Application, Benefits, Interest Rates, EMI, Banks, NBFCs, etc.)
    - Study Abroad (Planning, Countries, Universities, Life as a student, Accommodation, etc.)
    - Admission Processes and Applications (SOP, LOR, Transcripts, GPA, etc.)
    - **Standardized Tests & Exam Preparation** (GRE, GMAT, SAT, IELTS, TOEFL, PTE, Duolingo, etc.)
      - This INCLUDES: exam eligibility, requirements, scores, preparation tips, study plans, coaching, mock tests, exam schedules, registration, cutoffs, percentiles, retakes, verbal/quant/analytical sections, test centers, etc.
      - Questions like "What are the requirements for GRE?" or "How to prepare for GMAT?" are ABSOLUTELY ALLOWED.
    - Visa Processes and Immigration (F1, H1B, OPT, CPT, DS-160, Embassy, etc.)
    - Scholarships, Financial Aid, and Funding
    - Career Discussions for Students (Internships, Placements, Work Permits, etc.)
    - Student Life, Housing, and Practical Tips for Study Abroad

    IMPORTANT: When in doubt, ALLOW the content. Only reject if the content is completely unrelated to education, student life, or careers (e.g., recipes, sports scores, entertainment gossip, politics).

    Context: "${topicContext}"
    Title/Content: "${contentToVerify}"

    Does this content belong in an education/loan/student community?

    Respond with strictly valid JSON:
    {
       "relevant": boolean,
       "reason": "Short explanation if rejected (optional)"
    }`;

    try {
      const result = await this.openRouterService.getJson<{ relevant: boolean; reason?: string }>(prompt);
      return {
        success: true,
        relevant: result.relevant,
        isRelevant: result.relevant,
        reason: result.reason
      };
    } catch (error) {
      console.error("AI Check Failed", error);
      // Fail permissive if AI is down
      return { success: true, relevant: true, isRelevant: true, reason: "AI Check Skipped due to error" };
    }
  }

  @Post('search')
  async search(@Body() data: any) {
    try {
      const type = data.type || 'university';
      const query = data.query || '';
      const country = data.country || data.context?.country;
      const course = data.course || data.context?.course;

      console.log(`AI Search requested: type=${type}, query="${query}", country=${country}`);

      // Case 1: Fetching top universities for a country (Initial load in onboarding)
      if (type === 'university' && !query && country) {
        const universities = await this.universitySearchService.searchUniversitiesByCountry([country], 12);
        return { success: true, universities };
      }

      // Case 2: General advice/search for universities or courses
      const results = await this.openRouterService.searchAdvice(query, type, data.context || data);

      if (type === 'university') {
        return { success: true, universities: results };
      }

      return { success: true, results };
    } catch (error) {
      console.error("AI Unified Search Failed", error);
      return { success: false, message: "Search failed", results: [], universities: [] };
    }
  }

  @Post('validate-university-country')
  async validateUniversityCountry(
    @Body() data: { university: string; country: string }
  ) {
    if (!data.university || !data.country) {
      throw new BadRequestException('University and country are required');
    }

    const universityName = data.university.trim();
    const countryName = data.country.trim();
    const uniLower = universityName.toLowerCase();
    const countryLower = countryName.toLowerCase();

    // 1. Generic name check (e.g., "university", "college", "school", "academy", "institute", "polytechnic")
    const genericWords = new Set([
      'university', 'universities', 'college', 'colleges', 'school', 'schools',
      'academy', 'academies', 'institute', 'institutes', 'institution', 'institutions',
      'polytechnic', 'polytechnics', 'hochschule', 'fachhochschule', 'campus',
      'education', 'educational', 'studies', 'study', 'center', 'centre',
      'of', 'and', '&', 'the', 'a', 'an', 'in', 'for', 'my', 'your', 'our', 'higher', 'degree'
    ]);

    const words = uniLower.replace(/[\/\\.,\-_&()]/g, ' ').split(/\s+/).filter(Boolean);
    const isGeneric = words.length === 0 || words.every(word => genericWords.has(word));

    if (isGeneric) {
      return {
        success: true,
        valid: false,
        message: `"${universityName}" is a generic term. Please enter a specific university or college name (e.g., Harvard University or Technical University of Munich).`,
        correctedCountry: null
      };
    }

    // 2. Famous university mapping for fast-pass validation and country mismatch detection
    const FAMOUS_UNIVERSITIES: { country: string; countryKey: string; keywords: string[] }[] = [
      {
        country: 'United States',
        countryKey: 'usa',
        keywords: [
          'harvard', 'stanford', 'massachusetts institute of technology', 'mit', 'caltech',
          'columbia university', 'carnegie mellon', 'cmu', 'nyu', 'new york university',
          'ucla', 'uc berkeley', 'cornell', 'yale', 'princeton', 'upenn', 'university of pennsylvania',
          'northwestern university', 'snhu', 'wgu', 'minerva', 'northeastern university',
          'georgia tech', 'purdue', 'texas a&m', 'university of texas', 'johns hopkins', 'duke',
          'university of california', 'boston university', 'usc', 'penn state', 'arizona state'
        ]
      },
      {
        country: 'United Kingdom',
        countryKey: 'uk',
        keywords: [
          'university of oxford', 'oxford university', 'oxford',
          'university of cambridge', 'cambridge university', 'cambridge',
          'imperial college london', 'imperial college', 'ucl', 'university college london',
          'king\'s college london', 'kcl', 'university of edinburgh', 'university of manchester',
          'warwick', 'bristol', 'glasgow', 'birmingham', 'leeds', 'sheffield', 'open university',
          'nottingham', 'southampton'
        ]
      },
      {
        country: 'Germany',
        countryKey: 'germany',
        keywords: [
          'tomorrow university', 'tomorrow university of applied sciences', 'tou',
          'iu international', 'iu university', 'srh', 'whu', 'bsbi', 'gisma',
          'constructor university', 'klu', 'frankfurt school', 'esmt', 'tum',
          'technical university of munich', 'rwth aachen', 'lmu munich', 'heidelberg university',
          'fau', 'humboldt university', 'free university of berlin', 'tu berlin', 'tu dresden', 'tu darmstadt'
        ]
      },
      {
        country: 'Canada',
        countryKey: 'canada',
        keywords: [
          'university of toronto', 'ubc', 'university of british columbia', 'mcgill',
          'university of waterloo', 'mcmaster', 'university of alberta', 'western university',
          'simon fraser', 'concordia university', 'york university'
        ]
      },
      {
        country: 'Australia',
        countryKey: 'australia',
        keywords: [
          'university of melbourne', 'university of sydney', 'unsw', 'university of new south wales',
          'monash university', 'university of queensland', 'anu', 'australian national university',
          'university of western australia', 'university of adelaide', 'uts', 'rmit'
        ]
      },
      {
        country: 'India',
        countryKey: 'india',
        keywords: [
          'iit', 'indian institute of technology', 'bits pilani', 'iim', 'delhi university',
          'anna university', 'vit', 'manipal university', 'srm university', 'iisc'
        ]
      }
    ];

    let targetCountryKey = '';
    if (countryLower.includes('germany') || countryLower.includes('deutschland')) targetCountryKey = 'germany';
    else if (countryLower.includes('usa') || countryLower.includes('united states') || countryLower.includes('america')) targetCountryKey = 'usa';
    else if (countryLower.includes('uk') || countryLower.includes('united kingdom') || countryLower.includes('britain') || countryLower.includes('england') || countryLower.includes('scotland') || countryLower.includes('wales')) targetCountryKey = 'uk';
    else if (countryLower.includes('canada')) targetCountryKey = 'canada';
    else if (countryLower.includes('australia')) targetCountryKey = 'australia';
    else if (countryLower.includes('india')) targetCountryKey = 'india';

    for (const group of FAMOUS_UNIVERSITIES) {
      const match = group.keywords.some(kw => {
        if (kw.length <= 3) {
          return words.includes(kw);
        }
        return uniLower.includes(kw);
      });

      if (match) {
        if (targetCountryKey && group.countryKey === targetCountryKey) {
          return {
            success: true,
            valid: true,
            correctedCountry: null
          };
        } else if (targetCountryKey && group.countryKey !== targetCountryKey) {
          return {
            success: true,
            valid: false,
            message: `"${universityName}" is located in ${group.country}, not ${countryName}.`,
            correctedCountry: group.country
          };
        }
      }
    }

    // 3. AI Verification Prompt for other institutions
    const prompt = `You are an expert global higher education verification system.
Task: Evaluate if "${universityName}" is a real, accredited higher education institution located in, accredited in, or operating in "${countryName}".

STRICT EVALUATION RULES:
1. GENERIC CHECK: If "${universityName}" is purely a generic term or list of generic terms (e.g. "university", "college", "school", "academy", "institute", "university/college/school/academy/institute"), return: { "valid": false, "correctedCountry": null }
2. COUNTRY VERIFICATION: Verify if "${universityName}" actually belongs to "${countryName}".
   - If "${universityName}" is a real university located in a DIFFERENT country, return: { "valid": false, "correctedCountry": "Actual Country Name" }
   - If "${universityName}" is NOT a real accredited university in "${countryName}", return: { "valid": false, "correctedCountry": null }
3. VALID MATCH: If "${universityName}" is a real, accredited, state-recognized, digital, online, or private higher education institution operating in "${countryName}", return: { "valid": true, "correctedCountry": null }

Respond strictly in valid JSON format:
{
  "valid": boolean,
  "correctedCountry": string | null
}`;

    try {
      const result = await this.openRouterService.getJson<{ valid: boolean; correctedCountry?: string }>(prompt);
      const finalValid = Boolean(result && result.valid);

      return {
        success: true,
        valid: finalValid,
        message: finalValid ? null : `"${universityName}" is not a recognized university in ${countryName}.`,
        correctedCountry: finalValid ? null : (result?.correctedCountry || null)
      };
    } catch (error) {
      console.error('AI University Country Check Failed:', error);
      return {
        success: true,
        valid: false,
        message: `Unable to verify "${universityName}" for ${countryName}. Please check the university name and country.`,
        correctedCountry: null
      };
    }
  }

  @Post('correct-country-name')
  async correctCountryName(
    @Body() data: { countryInput: string }
  ) {
    if (!data.countryInput) {
      throw new BadRequestException('Country input is required');
    }

    const prompt = `You are an expert in global geography and higher education.
    Task: Standardize and correct the spelling of the following country input: "${data.countryInput}".
    The input might contain typos, spelling errors, abbreviations (e.g. "US", "UK"), or specific city/state names instead of a country (e.g. "London", "New York", "Toronto").

    Analyze the input and return the correct, standard English name of the country.
    Also check if this country corresponds to one of these specific study destination options:
    - "USA"
    - "UK"
    - "Canada"
    - "Australia"
    - "Germany"
    - "Ireland"
    - "New Zealand"

    Rules:
    - If the input corresponds to one of the 7 options, set "isStandard" to true and "standardOption" to the exact option name (e.g. "USA").
    - If it's a valid country but not one of the 7 options, set "isStandard" to false and "standardOption" to null.
    - If the input is completely invalid (gibberish or doesn't map to any location), set "valid" to false.

    Respond with strictly valid JSON:
    {
      "valid": boolean,
      "correctedCountry": string,
      "isStandard": boolean,
      "standardOption": "USA" | "UK" | "Canada" | "Australia" | "Germany" | "Ireland" | "New Zealand" | null
    }`;

    try {
      const result = await this.openRouterService.getJson<{
        valid: boolean;
        correctedCountry: string;
        isStandard: boolean;
        standardOption: string | null;
      }>(prompt);

      return {
        success: true,
        valid: result.valid ?? false,
        correctedCountry: result.correctedCountry || null,
        isStandard: result.isStandard ?? false,
        standardOption: result.standardOption || null,
      };
    } catch (error) {
      console.error('AI Correct Country Name Check Failed:', error);
      return { success: false, valid: false, correctedCountry: null, isStandard: false, standardOption: null };
    }
  }

  @Post('search-advice')
  async searchAdvice(@Body() data: { query: string; type: 'university' | 'course' | 'ug_university'; context?: any }) {
    try {
      const results = await this.openRouterService.searchAdvice(data.query, data.type, data.context);
      return { success: true, results };
    } catch (error) {
      console.error("AI Search Failed", error);
      return { success: false, message: "Search failed", results: [] };
    }
  }

  @Post('suggest-tags')
  async suggestTags(@Body() data: { title: string }) {
    const prompt = `Based on the following forum post title, suggest up to 5 relevant tags that would help categorize this post in a student education and loan community. Focus on specific topics like universities, loans, visas, tests, etc.

    Title: "${data.title}"

    Respond with strictly valid JSON:
    {
       "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
    }`;

    try {
      const result = await this.openRouterService.getJson<{ tags: string[] }>(prompt);
      return { success: true, tags: result.tags || [] };
    } catch (error) {
      console.error("AI Tag Suggestion Failed", error);
      return { success: false, tags: ['education', 'loan'] };
    }
  }

  @Post('search-universities')
  async searchUniversities(
    @Body()
    data: any,
  ): Promise<{ success: boolean; universities: any[]; totalCount: number; source: string; message?: string }> {
    try {
      // If query is provided (including empty string)
      if (data && typeof data.query === 'string') {
        const degree = data.degree || "Master's";
        const country = data.country;
        
        // Determine search type: Indian colleges/universities for Bachelor's degree,
        // International universities for Master's/other degrees
        const type = (degree === "Bachelor's" || degree === 'bachelors' || degree === 'ug_university' || (country === 'India' && degree !== "Master's")) 
          ? 'ug_university' 
          : 'university';
          
        const context = {
          country,
          degree,
        };
        
        const universities = await this.openRouterService.searchAdvice(
          data.query,
          type,
          context,
        );

        // Normalize output locations for display on frontend
        const formatted = (universities || []).map((uni: any) => ({
          ...uni,
          location: uni.loc || uni.location || '',
          country: type === 'ug_university' ? 'India' : (uni.country || country || ''),
        }));
        
        return {
          success: true,
          universities: formatted,
          totalCount: formatted.length,
          source: 'ai',
        };
      }

      // Fallback: Search by country list
      let countries = data.countries;
      if (!countries && data.country) {
        countries = [data.country];
      }

      if (!countries || countries.length === 0) {
        throw new BadRequestException('At least one country is required');
      }

      const universities = await this.universitySearchService.searchUniversitiesByCountry(
        countries,
        data.limit || 10,
      );

      const validUniversities = await this.universitySearchService.validateUniversityRealness(universities);

      // Normalize locations for fallback search as well
      const formatted = (validUniversities || []).map((uni: any) => ({
        ...uni,
        location: uni.loc || uni.location || '',
      }));

      return {
        success: true,
        universities: formatted,
        totalCount: formatted.length,
        source: 'ai',
      };
    } catch (error) {
      console.error('University search failed:', error);
      return {
        success: false,
        message: error.message || 'Failed to search universities',
        universities: [],
        totalCount: 0,
        source: 'ai',
      };
    }
  }

  @Get('university-details/:name/:country')
  async getUniversityDetails(
    @Param('name') name: string,
    @Param('country') country: string,
  ): Promise<{ success: boolean; details?: UniversityDetails | null; message?: string }> {
    try {
      if (!name || !country) {
        throw new BadRequestException('University name and country are required');
      }

      const details = await this.universitySearchService.getUniversityDetailsFull(name, country);

      return {
        success: true,
        details,
      };
    } catch (error) {
      console.error('Failed to fetch university details:', error);
      return {
        success: false,
        message: error.message || 'Failed to fetch university details',
        details: null,
      };
    }
  }

  @Get('popular-countries')
  async getPopularCountries() {
    try {
      const countries = await this.universitySearchService.getPopularCountries();
      return {
        success: true,
        countries,
      };
    } catch (error) {
      console.error('Failed to fetch popular countries:', error);
      return {
        success: false,
        message: 'Failed to fetch popular countries',
        countries: [],
      };
    }
  }

  // ── Visa Interview Simulator Endpoints ──

  @Post('visa-interview/start')
  async startVisaInterview(
    @Body() data: { userProfile: Record<string, any>; visaType?: string; agentType?: string },
  ) {
    try {
      const result = await this.visaInterviewService.startInterview(
        data.userProfile || {},
        data.visaType || 'F1 Student Visa',
        data.agentType || 'agent_michael'
      );
      return {
        success: true,
        question: result.question,
        currentSection: result.currentSection || 'purpose',
        completedSections: result.completedSections || [],
        isInterviewOver: result.isInterviewOver || false,
        sections: this.visaInterviewService.getSections(),
      };
    } catch (error) {
      console.error('Visa interview start failed:', error);
      return { success: false, message: error.message || 'Failed to start interview' };
    }
  }

  @Post('visa-interview/continue')
  async continueVisaInterview(
    @Body()
    data: {
      userProfile: Record<string, any>;
      visaType?: string;
      agentType?: string;
      previousQuestion: string;
      transcript: string;
      currentSection: string;
      conversationHistory?: InterviewMessage[];
    },
  ) {
    try {
      const result = await this.visaInterviewService.continueInterview(
        data.userProfile || {},
        data.visaType || 'F1 Student Visa',
        data.previousQuestion,
        data.transcript,
        data.currentSection,
        data.conversationHistory || [],
        data.agentType || 'agent_michael',
      );
      return {
        success: true,
        question: result.question,
        currentSection: result.currentSection,
        completedSections: result.completedSections,
        isInterviewOver: result.isInterviewOver,
      };
    } catch (error) {
      console.error('Visa interview continue failed:', error);
      return { success: false, message: error.message || 'Failed to continue interview' };
    }
  }

  @Post('visa-interview/evaluate')
  async evaluateVisaAnswer(
    @Body()
    data: {
      visaType?: string;
      question: string;
      transcript: string;
    },
  ) {
    try {
      const evaluation = await this.visaInterviewService.evaluateAnswer(
        data.visaType || 'F1 Student Visa',
        data.question,
        data.transcript,
      );
      return { success: true, evaluation };
    } catch (error) {
      console.error('Visa answer evaluation failed:', error);
      return { success: false, message: error.message || 'Failed to evaluate answer' };
    }
  }

  @Post('visa-interview/final-report')
  async getVisaFinalReport(
    @Body()
    data: {
      visaType?: string;
      conversationHistory: InterviewMessage[];
      evaluations: EvaluationResult[];
    },
  ) {
    try {
      const report = await this.visaInterviewService.generateFinalReport(
        data.visaType || 'F1 Student Visa',
        data.conversationHistory || [],
        data.evaluations || [],
      );
      return { success: true, report };
    } catch (error) {
      console.error('Final report generation failed:', error);
      return { success: false, message: error.message || 'Failed to generate report' };
    }
  }

  @Post('visa-interview/save-report')
  async saveVisaReport(
    @Body()
    data: {
      userId?: string;
      visaType: string;
      agentType?: string;
      userProfile?: any;
      overallScore: number;
      overallRisk: string;
      approvalLikelihood: string;
      sectionScores: any;
      strengths: string[];
      weaknesses: string[];
      criticalIssues: string[];
      ds160Inconsistencies: string[];
      tips: string[];
      verdict: string;
      messages: any;
      evaluations: any;
    },
  ) {
    try {
      const { data: result, error } = await this.supabase.getClient().from('VisaMockInterviewResult').insert({
          userId: data.userId || null,
          visaType: data.visaType,
          agentType: data.agentType || null,
          userProfile: data.userProfile || null,
          overallScore: data.overallScore,
          overallRisk: data.overallRisk,
          approvalLikelihood: data.approvalLikelihood,
          sectionScores: data.sectionScores || {},
          strengths: data.strengths || [],
          weaknesses: data.weaknesses || [],
          criticalIssues: data.criticalIssues || [],
          ds160Inconsistencies: data.ds160Inconsistencies || [],
          tips: data.tips || [],
          verdict: data.verdict || '',
          messages: data.messages || [],
          evaluations: data.evaluations || [],
      }).select().single();
      if (error) throw error;
      return { success: true, result };
    } catch (error) {
      console.error('Failed to save visa interview result:', error);
      return { success: false, message: 'Failed to save result' };
    }
  }

  private buildEligibilityHtml(eligibility: any, recommendations: any): string {
    const statusColorMap = {
      eligible: { bg: '#d1fae5', text: '#065f46' },
      borderline: { bg: '#fef3c7', text: '#92400e' },
      unlikely: { bg: '#fee2e2', text: '#991b1b' },
    };
    const status = eligibility.status || 'borderline';
    const color = statusColorMap[status] || statusColorMap['borderline'];

    return `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <!-- Score and Status Banner -->
        <div style="text-align: center; padding: 20px; background-color: #f8fafc; border-radius: 8px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: bold;">Eligibility Score</div>
          <div style="font-size: 48px; font-weight: 800; color: #6605c7; margin: 8px 0;">${eligibility.score}<span style="font-size: 20px; color: #94a3b8; font-weight: normal;">/100</span></div>
          
          <span style="background-color: ${color.bg}; color: ${color.text}; padding: 6px 16px; border-radius: 50px; font-size: 13px; font-weight: bold; text-transform: uppercase;">
            ${status}
          </span>
        </div>

        <!-- Key Metrics -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;"><strong>Estimated APR:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 14px; text-align: right; font-weight: bold;">${eligibility.rateRange}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;"><strong>Funding Coverage:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 14px; text-align: right; font-weight: bold;">${eligibility.coverage}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 14px;"><strong>Debt-to-Income Ratio:</strong></td>
            <td style="padding: 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 14px; text-align: right; font-weight: bold;">${(eligibility.ratio * 100).toFixed(1)}%</td>
          </tr>
        </table>

        <!-- Summary -->
        <div style="margin-bottom: 25px;">
          <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #1e293b; font-weight: bold;">Analysis Summary</h4>
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #475569; background-color: #f8fafc; padding: 15px; border-left: 4px solid #6605c7; border-radius: 0 8px 8px 0;">
            ${eligibility.summary}
          </p>
        </div>

        <!-- Recommendations -->
        ${eligibility.recommendations && eligibility.recommendations.length > 0 ? `
        <div style="margin-bottom: 30px;">
          <h4 style="margin: 0 0 10px 0; font-size: 14px; color: #1e293b; font-weight: bold;">Recommendations to Improve</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #475569;">
            ${eligibility.recommendations.map((rec: string) => `<li style="margin-bottom: 8px;">${rec}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <!-- Recommended Loans -->
        ${recommendations ? `
        <div style="border-top: 1px solid #e2e8f0; padding-top: 25px;">
          <h4 style="margin: 0 0 15px 0; font-size: 15px; color: #1e293b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Recommended Loan Offers</h4>
          
          <!-- Primary Offer Card -->
          ${recommendations.primary ? `
          <div style="background: linear-gradient(to right, #f5f3ff, #faf5ff); border: 1.5px solid #ddd6fe; border-radius: 12px; padding: 20px; margin-bottom: 15px;">
            <table style="width: 100%; margin-bottom: 10px; border-collapse: collapse;">
              <tr>
                <td>
                  <div style="font-size: 11px; color: #6605c7; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">${recommendations.primary.offer.bank}</div>
                </td>
                <td style="text-align: right;">
                  <span style="background-color: #6605c7; color: white; font-size: 11px; font-weight: bold; padding: 3px 10px; border-radius: 30px; text-transform: uppercase;">
                    Best Fit (${recommendations.primary.fit}%)
                  </span>
                </td>
              </tr>
            </table>
            <div style="font-size: 18px; font-weight: bold; color: #1e293b; margin-bottom: 15px;">${recommendations.primary.offer.name}</div>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
              <tr>
                <td style="color: #64748b; padding: 4px 0;"><strong>Estimated APR:</strong></td>
                <td style="color: #1e293b; font-weight: bold; text-align: right; padding: 4px 0;">${recommendations.primary.offer.apr}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 4px 0;"><strong>Max Loan Amount:</strong></td>
                <td style="color: #1e293b; font-weight: bold; text-align: right; padding: 4px 0;">₹${(recommendations.primary.offer.maxLoan / 100000).toFixed(1)} Lakhs</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 4px 0;"><strong>Coverage:</strong></td>
                <td style="color: #1e293b; font-weight: bold; text-align: right; padding: 4px 0;">${recommendations.primary.offer.coverage}</td>
              </tr>
              <tr>
                <td style="color: #64748b; padding: 4px 0;"><strong>Key Benefit:</strong></td>
                <td style="color: #6605c7; font-weight: bold; text-align: right; padding: 4px 0;">${recommendations.primary.offer.bestFor}</td>
              </tr>
            </table>
          </div>
          ` : ''}

          <!-- Alternative Offers -->
          ${recommendations.alternatives && recommendations.alternatives.length > 0 ? `
            <div style="margin-top: 15px;">
              <h5 style="margin: 0 0 10px 0; font-size: 13px; color: #475569; font-weight: bold;">Alternative Options</h5>
              ${recommendations.alternatives.map((alt: any) => `
                <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                  <table style="width: 100%; margin-bottom: 5px; border-collapse: collapse;">
                    <tr>
                      <td><span style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">${alt.offer.bank}</span></td>
                      <td style="text-align: right;"><span style="background-color: #f1f5f9; color: #475569; font-size: 11px; font-weight: bold; padding: 2px 8px; border-radius: 12px;">Fit: ${alt.fit}%</span></td>
                    </tr>
                  </table>
                  <div style="font-size: 14px; font-weight: bold; color: #1e293b; margin-bottom: 8px;">${alt.offer.name}</div>
                  <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                    <tr>
                      <td style="color: #64748b; padding: 2px 0;"><strong>APR:</strong> ${alt.offer.apr}</td>
                      <td style="color: #64748b; padding: 2px 0; text-align: right;"><strong>Max Loan:</strong> ₹${(alt.offer.maxLoan / 100000).toFixed(1)}L</td>
                    </tr>
                  </table>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
        ` : ''}
      </div>
    `;
  }

  private buildSopAnalysisHtml(analysis: any): string {
    return `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <!-- Scores Grid -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 20px; text-align: center;">
          <tr>
            <td style="width: 33.3%; padding: 15px 10px; background-color: #faf5ff; border: 1px solid #f3e8ff; border-radius: 8px;">
              <div style="font-size: 11px; text-transform: uppercase; color: #7c3aed; font-weight: bold; letter-spacing: 0.5px;">Quality Score</div>
              <div style="font-size: 28px; font-weight: bold; color: #6b21a8; margin-top: 5px;">${analysis.totalScore}<span style="font-size: 12px; color: #a21caf; font-weight: normal;">/100</span></div>
              <div style="font-size: 11px; text-transform: capitalize; color: #7c3aed; font-weight: bold; margin-top: 5px;">${(analysis.quality || '').replace('-', ' ')}</div>
            </td>
            <td style="width: 33.3%; padding: 15px 10px; background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px;">
              <div style="font-size: 11px; text-transform: uppercase; color: #16a34a; font-weight: bold; letter-spacing: 0.5px;">Human Tone</div>
              <div style="font-size: 28px; font-weight: bold; color: #166534; margin-top: 5px;">${analysis.humanizeScore}%</div>
              <div style="font-size: 11px; color: #16a34a; font-weight: bold; margin-top: 5px;">
                ${analysis.humanizeScore >= 80 ? 'High' : analysis.humanizeScore >= 50 ? 'Moderate' : 'Low AI'}
              </div>
            </td>
            <td style="width: 33.3%; padding: 15px 10px; background-color: #fff5f5; border: 1px solid #fee2e2; border-radius: 8px;">
              <div style="font-size: 11px; text-transform: uppercase; color: #dc2626; font-weight: bold; letter-spacing: 0.5px;">Plagiarism</div>
              <div style="font-size: 28px; font-weight: bold; color: #991b1b; margin-top: 5px;">${analysis.plagiarismScore}%</div>
              <div style="font-size: 11px; color: #dc2626; font-weight: bold; margin-top: 5px;">
                ${analysis.plagiarismScore < 15 ? 'Safe' : analysis.plagiarismScore < 30 ? 'Caution' : 'High Risk'}
              </div>
            </td>
          </tr>
        </table>

        <!-- Summary -->
        <div style="margin-bottom: 25px; background-color: #f8fafc; padding: 15px; border-left: 4px solid #6605c7; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #475569;">
            <strong>Overall Assessment:</strong> ${analysis.summary}
          </p>
        </div>

        <!-- Category Scores -->
        ${analysis.categories && analysis.categories.length > 0 ? `
        <div style="margin-bottom: 25px;">
          <h4 style="margin: 0 0 15px 0; font-size: 14px; color: #1e293b; font-weight: bold;">Category Breakdown</h4>
          ${analysis.categories.map((cat: any) => {
            const percentage = (cat.score / 20) * 100;
            return `
              <div style="margin-bottom: 12px;">
                <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 4px;">
                  <tr>
                    <td style="color: #475569; font-weight: 500;">${cat.name}</td>
                    <td style="text-align: right; color: #1e293b; font-weight: bold;">${cat.score}/20</td>
                  </tr>
                </table>
                <div style="width: 100%; height: 8px; background-color: #e2e8f0; border-radius: 4px; overflow: hidden;">
                  <div style="width: ${percentage}%; height: 100%; background-color: #6605c7; border-radius: 4px;"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        ` : ''}

        <!-- Details -->
        <div style="margin-bottom: 25px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #1e293b; font-weight: bold;">Analysis Details</h4>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 12px;">
            <div style="font-size: 12px; color: #16a34a; font-weight: bold; text-transform: uppercase; margin-bottom: 6px;">AI Detection Feedback</div>
            <div style="font-size: 13px; line-height: 1.5; color: #475569;">${analysis.humanizeFeedback}</div>
          </div>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px;">
            <div style="font-size: 12px; color: #dc2626; font-weight: bold; text-transform: uppercase; margin-bottom: 6px;">Plagiarism & Originality Feedback</div>
            <div style="font-size: 13px; line-height: 1.5; color: #475569;">${analysis.plagiarismFeedback}</div>
          </div>
        </div>

        <!-- Improvement Plan -->
        ${analysis.weakAreas && analysis.weakAreas.length > 0 ? `
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <h4 style="margin: 0 0 15px 0; font-size: 14px; color: #1e293b; font-weight: bold;">Improvement Plan (${analysis.weakAreas.length} Action Items)</h4>
          ${analysis.weakAreas.map((wa: any, index: number) => `
            <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
              <div style="font-size: 13px; font-weight: bold; color: #b45309; margin-bottom: 4px;">Issue ${index + 1}: ${wa.issue}</div>
              <div style="font-size: 13px; line-height: 1.5; color: #78350f;"><strong>Recommendation:</strong> ${wa.recommendation}</div>
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
    `;
  }

  private buildHumanizeSopHtml(result: any): string {
    return `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <!-- Improvements list -->
        ${result.improvements && result.improvements.length > 0 ? `
        <div style="margin-bottom: 25px;">
          <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #1e293b; font-weight: bold;">Applied Enhancements</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6; color: #475569;">
            ${result.improvements.map((imp: string) => `<li style="margin-bottom: 6px;">${imp}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <!-- Rewritten SOP -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #1e293b; font-weight: bold;">Humanized Statement of Purpose</h4>
          <div style="background-color: #fafafb; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; font-family: Consolas, Monaco, monospace; font-size: 13px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${result.humanizedText}</div>
        </div>
      </div>
    `;
  }

  private buildPredictAdmissionHtml(prediction: any): string {
    return `
      <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <!-- Target University and Probability -->
        <div style="text-align: center; padding: 25px 20px; background-color: #f8fafc; border-radius: 12px; margin-bottom: 25px; border: 1px solid #e2e8f0;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: bold; margin-bottom: 5px;">Target Institution</div>
          <div style="font-size: 20px; font-weight: bold; color: #1e293b; margin-bottom: 15px;">
            ${prediction.university} 
            <span style="font-size: 11px; background-color: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 10px; font-weight: bold; vertical-align: middle; margin-left: 5px;">
              Tier ${prediction.tier}
            </span>
          </div>
          
          <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 5px;">Admission Probability</div>
          <div style="font-size: 44px; font-weight: 800; color: #6605c7; margin-bottom: 15px;">${prediction.probability}%</div>
          
          <div style="width: 80%; height: 8px; background-color: #e2e8f0; border-radius: 4px; overflow: hidden; margin: 0 auto;">
            <div style="width: ${prediction.probability}%; height: 100%; background-color: #6605c7; border-radius: 4px;"></div>
          </div>
        </div>

        <!-- Feedback -->
        ${prediction.feedback && prediction.feedback.length > 0 ? `
        <div>
          <h4 style="margin: 0 0 15px 0; font-size: 14px; color: #1e293b; font-weight: bold;">Strategic Admission Advice</h4>
          <table style="width: 100%; border-collapse: collapse;">
            ${prediction.feedback.map((item: string) => `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; width: 24px; vertical-align: top; color: #6605c7; font-size: 16px; font-weight: bold;">✓</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 13px; line-height: 1.5;">${item}</td>
              </tr>
            `).join('')}
          </table>
        </div>
        ` : ''}
      </div>
    `;
  }
}

