import { Injectable, BadRequestException } from '@nestjs/common';
import { OpenRouterService } from './openrouter.service';

interface GradeConversionInput {
  inputType: 'letterGrade' | 'percentage' | 'gpa' | 'cgpa' | 'marks';
  inputValue: string | number;
  totalMarks?: number; // For marks conversion
  outputType: 'letterGrade' | 'percentage' | 'gpa' | 'cgpa';
  gradingSystem?: 'US' | 'UK' | 'India' | 'Canada' | 'Australia';
  formula?: 'cbse' | 'direct' | 'vtu' | 'mumbai';
}

interface GradeConversionResult {
  inputGrade: string;
  outputGrade: string;
  percentage: number;
  gpa: number;
  cgpa: number;
  letterGrade: string;
  classification: string;
  formulaUsed?: string;
  internationalEquivalent: {
    US: string;
    UK: string;
    India: string;
    Germany?: string;
  };
  analysis: {
    strength: string;
    competitiveness: string;
    recommendations: string[];
  };
}

@Injectable()
export class GradeConversionService {
  constructor(private readonly openRouter: OpenRouterService) { }

  /**
   * Deterministic mathematical grade calculation across international standards
   */
  calculateDeterministicGrade(input: GradeConversionInput): GradeConversionResult {
    const rawVal = input.inputValue;
    const formula = input.formula || 'cbse';
    let percentage = 0;
    let formulaDesc = '';

    if (input.inputType === 'percentage') {
      percentage = Math.max(0, Math.min(100, Number(rawVal) || 0));
      formulaDesc = `Direct Percentage: ${percentage.toFixed(2)}%`;
    } else if (input.inputType === 'cgpa') {
      const cgpaVal = Math.max(0, Math.min(10, Number(rawVal) || 0));
      if (formula === 'direct') {
        percentage = cgpaVal * 10;
        formulaDesc = `Direct 10-Scale: ${cgpaVal} × 10 = ${percentage.toFixed(2)}%`;
      } else if (formula === 'vtu') {
        percentage = Math.max(0, (cgpaVal - 0.75) * 10);
        formulaDesc = `VTU/Anna Univ: (${cgpaVal} - 0.75) × 10 = ${percentage.toFixed(2)}%`;
      } else if (formula === 'mumbai') {
        percentage = Math.min(100, Math.max(0, (7.1 * cgpaVal) + 11));
        formulaDesc = `Mumbai University: (7.1 × ${cgpaVal}) + 11 = ${percentage.toFixed(2)}%`;
      } else {
        // CBSE Standard (9.5 multiplier) - National Standard for India
        percentage = cgpaVal * 9.5;
        formulaDesc = `CBSE Standard: ${cgpaVal} × 9.5 = ${percentage.toFixed(2)}%`;
      }
    } else if (input.inputType === 'gpa') {
      const gpaVal = Math.max(0, Math.min(4.0, Number(rawVal) || 0));
      if (gpaVal >= 4.0) percentage = 95.0;
      else if (gpaVal >= 3.7) percentage = 85.0 + ((gpaVal - 3.7) / 0.3) * 10.0;
      else if (gpaVal >= 3.3) percentage = 80.0 + ((gpaVal - 3.3) / 0.4) * 5.0;
      else if (gpaVal >= 3.0) percentage = 70.0 + ((gpaVal - 3.0) / 0.3) * 10.0;
      else if (gpaVal >= 2.7) percentage = 65.0 + ((gpaVal - 2.7) / 0.3) * 5.0;
      else if (gpaVal >= 2.3) percentage = 60.0 + ((gpaVal - 2.3) / 0.4) * 5.0;
      else if (gpaVal >= 2.0) percentage = 50.0 + ((gpaVal - 2.0) / 0.3) * 10.0;
      else percentage = Math.max(0, (gpaVal / 2.0) * 50.0);
      formulaDesc = `US 4.0 Scale Standard Mapping: ${gpaVal.toFixed(2)} -> ${percentage.toFixed(2)}%`;
    } else if (input.inputType === 'marks') {
      const marksObtained = Math.max(0, Number(rawVal) || 0);
      const totalMarks = Math.max(1, Number(input.totalMarks) || 100);
      percentage = Math.min(100, (marksObtained / totalMarks) * 100);
      formulaDesc = `Raw Marks: (${marksObtained} / ${totalMarks}) × 100 = ${percentage.toFixed(2)}%`;
    } else if (input.inputType === 'letterGrade') {
      const grade = String(rawVal).trim().toUpperCase();
      const gradeMap: Record<string, number> = {
        'O': 95, 'S': 95, 'A+': 92, 'A': 85, 'A-': 80,
        'B+': 75, 'B': 70, 'B-': 65,
        'C+': 60, 'C': 55, 'C-': 50,
        'D+': 45, 'D': 40, 'D-': 35, 'E': 40, 'F': 25
      };
      percentage = gradeMap[grade] ?? 60;
      formulaDesc = `Letter Grade ${grade} equivalent to ${percentage}%`;
    }

    percentage = Math.round(percentage * 100) / 100;

    // Standardized CGPA calculation from percentage
    let calculatedCgpa = 0;
    if (input.inputType === 'cgpa') {
      calculatedCgpa = Number(rawVal);
    } else {
      if (formula === 'direct') calculatedCgpa = Math.min(10.0, percentage / 10.0);
      else if (formula === 'vtu') calculatedCgpa = Math.min(10.0, (percentage / 10.0) + 0.75);
      else if (formula === 'mumbai') calculatedCgpa = Math.min(10.0, Math.max(0, (percentage - 11) / 7.1));
      else calculatedCgpa = Math.min(10.0, percentage / 9.5);
    }
    calculatedCgpa = Math.round(calculatedCgpa * 100) / 100;

    // Standardized US 4.0 GPA calculation from percentage
    let calculatedGpa = 0;
    if (input.inputType === 'gpa') {
      calculatedGpa = Number(rawVal);
    } else {
      if (percentage >= 90) calculatedGpa = 4.00;
      else if (percentage >= 85) calculatedGpa = Math.round((3.70 + ((percentage - 85) / 5) * 0.30) * 100) / 100;
      else if (percentage >= 80) calculatedGpa = Math.round((3.30 + ((percentage - 80) / 5) * 0.40) * 100) / 100;
      else if (percentage >= 75) calculatedGpa = Math.round((3.00 + ((percentage - 75) / 5) * 0.30) * 100) / 100;
      else if (percentage >= 70) calculatedGpa = Math.round((2.70 + ((percentage - 70) / 5) * 0.30) * 100) / 100;
      else if (percentage >= 65) calculatedGpa = Math.round((2.30 + ((percentage - 65) / 5) * 0.40) * 100) / 100;
      else if (percentage >= 60) calculatedGpa = Math.round((2.00 + ((percentage - 60) / 5) * 0.30) * 100) / 100;
      else if (percentage >= 55) calculatedGpa = Math.round((1.70 + ((percentage - 55) / 5) * 0.30) * 100) / 100;
      else if (percentage >= 50) calculatedGpa = Math.round((1.30 + ((percentage - 50) / 5) * 0.40) * 100) / 100;
      else if (percentage >= 40) calculatedGpa = Math.round((1.00 + ((percentage - 40) / 10) * 0.30) * 100) / 100;
      else calculatedGpa = 0.00;
    }

    // Letter grade
    let letterGrade = 'F';
    if (percentage >= 90) letterGrade = 'A+';
    else if (percentage >= 85) letterGrade = 'A';
    else if (percentage >= 80) letterGrade = 'A-';
    else if (percentage >= 75) letterGrade = 'B+';
    else if (percentage >= 70) letterGrade = 'B';
    else if (percentage >= 65) letterGrade = 'B-';
    else if (percentage >= 60) letterGrade = 'C+';
    else if (percentage >= 55) letterGrade = 'C';
    else if (percentage >= 50) letterGrade = 'C-';
    else if (percentage >= 40) letterGrade = 'D';
    else letterGrade = 'F';

    // Classification
    let classification = 'Fail';
    if (percentage >= 75) classification = 'First Class with Distinction';
    else if (percentage >= 60) classification = 'First Class';
    else if (percentage >= 50) classification = 'Second Class';
    else if (percentage >= 40) classification = 'Pass Class';

    // UK Classification
    let ukClass = 'Fail';
    if (percentage >= 70) ukClass = 'First Class Honours (1st)';
    else if (percentage >= 60) ukClass = 'Upper Second Class Honours (2:1)';
    else if (percentage >= 50) ukClass = 'Lower Second Class Honours (2:2)';
    else if (percentage >= 40) ukClass = 'Third Class Honours (3rd)';

    // German Grade (Bavarian Formula: 1 + 3 * ((100 - P) / (100 - 40)))
    const germanNum = Math.max(1.0, Math.min(5.0, 1.0 + 3.0 * ((100 - percentage) / 60.0)));
    const germanGrade = germanNum <= 1.5 ? `${germanNum.toFixed(2)} (Very Good / Sehr Gut)` :
      germanNum <= 2.5 ? `${germanNum.toFixed(2)} (Good / Gut)` :
      germanNum <= 3.5 ? `${germanNum.toFixed(2)} (Satisfactory / Befriedigend)` :
      germanNum <= 4.0 ? `${germanNum.toFixed(2)} (Sufficient / Ausreichend)` : `${germanNum.toFixed(2)} (Fail / Nicht Bestanden)`;

    // Output representation
    let outputGrade = `${percentage.toFixed(2)}%`;
    if (input.outputType === 'gpa') outputGrade = calculatedGpa.toFixed(2);
    else if (input.outputType === 'cgpa') outputGrade = calculatedCgpa.toFixed(2);
    else if (input.outputType === 'letterGrade') outputGrade = letterGrade;

    // Deterministic strength & recommendations based on academic tier
    let strength = 'Average academic standing with eligibility for foundational master\'s programs.';
    let competitiveness = 'Moderate';
    let recommendations = [
      'Maintain strong GRE/GMAT scores to boost profile strength for international admissions.',
      'Highlight industry projects, internships, and research papers in your Statement of Purpose.',
      'Seek letters of recommendation from senior professors who can vouch for your technical prowess.'
    ];

    if (percentage >= 80 || calculatedCgpa >= 8.5) {
      strength = 'Top-tier academic profile with high competitiveness for Tier 1 international universities and merit-based scholarships.';
      competitiveness = 'Highly Competitive (Top 10-15%)';
      recommendations = [
        'Eligible for prestigious university applications including US Top 50, UK Russell Group, and Canadian U15.',
        'Target graduate assistantships, dean\'s scholarships, and university fellowships.',
        'Tailor your SOP to focus on advanced research interests and long-term career impact.'
      ];
    } else if (percentage >= 70 || calculatedCgpa >= 7.5) {
      strength = 'Strong first-class record qualifying for prominent global universities across US, UK, Canada, and Australia.';
      competitiveness = 'Strong (Top 30%)';
      recommendations = [
        'Focus on writing an exceptional Statement of Purpose connecting your coursework to practical skills.',
        'Apply early in Round 1 for maximum consideration for merit and department scholarships.',
        'Secure clean academic transcripts and standardized test score reports (IELTS 7.0+ or TOEFL 95+).'
      ];
    } else if (percentage < 55) {
      strength = 'Satisfactory passing record. Consider supplementary credentials or post-graduate diploma routes.';
      competitiveness = 'Needs Support (Consider Pathway/Pre-Master Programs)';
      recommendations = [
        'Explore pathway and pre-master foundation courses offered by international universities.',
        'Gain 1-2 years of relevant professional work experience to compensate for academic score.',
        'Target universities offering holistic admissions where work experience and portfolios carry significant weight.'
      ];
    }

    return {
      inputGrade: String(input.inputValue),
      outputGrade,
      percentage,
      gpa: calculatedGpa,
      cgpa: calculatedCgpa,
      letterGrade,
      classification,
      formulaUsed: formulaDesc,
      internationalEquivalent: {
        US: `${calculatedGpa.toFixed(2)} / 4.0 (${letterGrade})`,
        UK: ukClass,
        India: `${percentage.toFixed(1)}% (${classification})`,
        Germany: germanGrade,
      },
      analysis: {
        strength,
        competitiveness,
        recommendations,
      },
    };
  }

  async convertGrade(input: GradeConversionInput): Promise<GradeConversionResult> {
    // Input validation to enforce limits and return clear errors on bad input
    if (input.inputType === 'percentage') {
      const val = Number(input.inputValue);
      if (isNaN(val) || val < 0 || val > 100) {
        throw new BadRequestException('Percentage must be a number between 0 and 100');
      }
    }

    if (input.inputType === 'marks') {
      const val = Number(input.inputValue);
      const total = Number(input.totalMarks ?? 100);
      if (isNaN(val) || val < 0) {
        throw new BadRequestException('Marks must be a non-negative number');
      }
      if (isNaN(total) || total <= 0) {
        throw new BadRequestException('totalMarks must be a positive number');
      }
      if (val > total) {
        throw new BadRequestException(`Marks (${val}) cannot exceed total marks (${total})`);
      }
    }

    if (input.inputType === 'gpa') {
      const val = Number(input.inputValue);
      const maxGpa = 4.0;
      if (isNaN(val) || val < 0 || val > maxGpa) {
        throw new BadRequestException(`GPA must be a number between 0 and ${maxGpa}`);
      }
    }

    if (input.inputType === 'cgpa') {
      const val = Number(input.inputValue);
      const maxCgpa = 10.0;
      if (isNaN(val) || val < 0 || val > maxCgpa) {
        throw new BadRequestException(`CGPA must be a number between 0 and ${maxCgpa}`);
      }
    }

    // Always compute accurate deterministic mathematical values
    const exact = this.calculateDeterministicGrade(input);

    const prompt = `
    Analyze the following converted academic performance for an international study abroad student:
    - Input: ${input.inputValue} (${input.inputType})
    - Exact Percentage: ${exact.percentage}%
    - CGPA (10.0): ${exact.cgpa}
    - GPA (4.0): ${exact.gpa}
    - Classification: ${exact.classification}
    - Target Country/System: ${input.gradingSystem || 'Global'}

    Provide tailored, high-level qualitative academic insights in JSON:
    {
      "strength": "Detailed 1-2 sentence assessment of their academic competitiveness",
      "competitiveness": "High / Strong / Moderate / Needs Pathway",
      "scholarshipEligibility": "Likelihood of scholarships and recommendations for financial aid",
      "recommendations": ["Actionable step 1", "Actionable step 2", "Actionable step 3"]
    }
    `;

    try {
      const aiResponse = await this.openRouter.getJson<any>(prompt);
      if (aiResponse && aiResponse.recommendations && Array.isArray(aiResponse.recommendations)) {
        return {
          ...exact,
          analysis: {
            strength: aiResponse.strength || exact.analysis.strength,
            competitiveness: aiResponse.competitiveness || exact.analysis.competitiveness,
            recommendations: aiResponse.recommendations.length > 0 ? aiResponse.recommendations : exact.analysis.recommendations,
          },
        };
      }
      return exact;
    } catch (error) {
      console.warn('AI qualitative analysis fallback to deterministic insights:', error?.message || error);
      return exact;
    }
  }

  async comparePerformance(assessments: { name: string; percentage: number }[]): Promise<any> {
    if (!assessments || assessments.length === 0) {
      return {
        trend: 'Stable',
        averagePerformance: 0,
        bestPerformance: 'N/A',
        worstPerformance: 'N/A',
        progression: 'N/A'
      };
    }

    const total = assessments.reduce((acc, curr) => acc + curr.percentage, 0);
    const avg = Math.round((total / assessments.length) * 100) / 100;
    const sorted = [...assessments].sort((a, b) => b.percentage - a.percentage);
    const best = sorted[0]?.name || 'N/A';
    const worst = sorted[sorted.length - 1]?.name || 'N/A';

    const prompt = `
      Analyze the performance trend based on these assessments:
      ${JSON.stringify(assessments)}

      Return JSON:
      {
        "trend": "string (e.g. Upward, Downward, Stable)",
        "averagePerformance": number,
        "bestPerformance": "string (subject name)",
        "worstPerformance": "string (subject name)",
        "progression": "string (e.g. Improving, Declining)"
      }
      `;

    try {
      const res = await this.openRouter.getJson<any>(prompt);
      return {
        trend: res.trend || 'Stable',
        averagePerformance: res.averagePerformance || avg,
        bestPerformance: res.bestPerformance || best,
        worstPerformance: res.worstPerformance || worst,
        progression: res.progression || (avg >= 75 ? 'Strong' : 'Steady')
      };
    } catch (error) {
      return {
        trend: 'Stable',
        averagePerformance: avg,
        bestPerformance: best,
        worstPerformance: worst,
        progression: avg >= 75 ? 'Strong' : 'Steady'
      };
    }
  }
}
