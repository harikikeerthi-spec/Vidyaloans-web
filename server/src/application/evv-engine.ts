import { Injectable, Logger } from '@nestjs/common';
import { OpenRouterService } from '../ai/services/openrouter.service';

// ============================================================
// CORE INTERFACES
// ============================================================

/** Raw transaction as extracted from a bank statement */
export interface ExtractedTransaction {
  date: string;           // YYYY-MM-DD
  narration: string;      // Description / narration field
  debit: number;          // Debit amount (0 if credit)
  credit: number;         // Credit amount (0 if debit)
  balance: number;        // Running balance after transaction
  referenceNumber?: string;
  channel?: string;       // UPI | NEFT | RTGS | IMPS | CHEQUE | CASH | ATM | ONLINE
  utr?: string;           // UTR number
  mode?: string;          // Payment mode

  // Derived fields (computed post-extraction)
  amount: number;         // Max(debit, credit)
  type: 'credit' | 'debit';
  month: string;          // YYYY-MM (computed)
}

/** Backward-compat alias used by the old computeEvv path */
export interface Transaction {
  date: string;
  amount: number;
  type: 'credit' | 'debit';
  balance: number;
}

/** One record per calendar day */
export interface DailyBalance {
  date: string;           // YYYY-MM-DD
  balance: number;
  isTransactionDay: boolean;
}

/** Balance on a configurable snapshot day */
export interface SnapshotBalance {
  date: string;           // YYYY-MM-DD
  balance: number;
  month: string;          // YYYY-MM
  snapshotDay: number;    // 1, 5, 10, 15, 20, 25, or last-day-of-month
}

/** Full set of metrics for a single calendar month */
export interface MonthlyStatistics {
  month: string;          // YYYY-MM
  monthLabel: string;     // "Jan 2025"
  avgBalance: number;
  highestBalance: number;
  lowestBalance: number;
  medianBalance: number;
  avgDailyBalance: number;
  openingBalance: number;
  closingBalance: number;

  totalCredits: number;
  totalDebits: number;
  avgCredit: number;
  avgDebit: number;

  transactionCount: number;
  creditCount: number;
  debitCount: number;
  cashDepositCount: number;
  cashWithdrawalCount: number;
  upiCount: number;
  neftCount: number;
  rtgsCount: number;
  impsCount: number;
  chequeCount: number;
  bounceCount: number;
  chargeCount: number;
  emiCount: number;

  // Snapshot-based EVV (5-point: 1,10,15,20,25)
  snapshotAvg: number;
  snapshotMin: number;
  snapshotMax: number;
  snapshotPoints: number;
  evv: number;            // Legacy alias for snapshotAvg
}

/** Detected financial behaviour */
export interface FinancialBehaviour {
  type: string;
  label: string;
  detected: boolean;
  confidence: number;     // 0-1
  evidence: string;
  severity: 'positive' | 'neutral' | 'warning' | 'critical';
}

/** Detected risk flag */
export interface RiskFlag {
  type: string;
  label: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string;
  month?: string;
}

/** Data validation report */
export interface ValidationReport {
  isValid: boolean;
  confidenceScore: number;  // 0-100
  checks: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
  warnings: string[];
  errors: string[];
}

/** Weight-based EVV score breakdown */
export interface EVVWeightBreakdown {
  component: string;
  weight: number;           // e.g., 0.25
  rawScore: number;         // 0-100
  weightedScore: number;    // Points earned towards total
  evidence: string;
  maxPoints?: number;
}

/** Bank Policy configuration as required by the official 6-component EVV standard */
export interface BankPolicy {
  id: string;
  bankName: string;
  accountType: string;
  minimumBalanceBenchmark: number; // M e.g. 5000, 2000, 1000
  strongBalanceTarget: number;     // e.g. 50000 (10 * M)
  fixedDates: number[];            // [1, 5, 10, 15, 20, 25]
  analysisMonths: number;          // 6
  defaultDateMode: 'FIXED' | 'CUSTOM';
  largeCashDepositThreshold: number; // 50000
  largeCreditAbsoluteThreshold: number; // 25000
  largeCreditMonthlyRatioThreshold: number; // 0.25 (25%)
  rapidOutflowDays: number;        // 3
  rapidOutflowRatio: number;       // 0.70 (70%)
  policyVersion: string;
}

/** Co-applicant income profile */
export interface CoApplicantProfile {
  isRepaymentIncomeContributor: 'YES' | 'NO' | 'UNKNOWN';
  primaryEarningCoApplicant?: string;
  declaredIncomeType?: string;
  declaredMonthlyIncome?: number;
  verificationStatus?: 'FULLY_VERIFIED' | 'PENDING_DOCS' | 'UNCLEAR' | 'NOT_ESTABLISHED';
}

/** Detailed 6-Component EVV Underwriting Architecture */
export interface EVV6ComponentResult {
  component1: {
    name: string;
    maxScore: number;
    score: number;
    sixMonthSampledAMB: number;
    strongBalanceTarget: number;
    baseScore: number;
    consistencyDeduction: number;
    monthsMeetingBenchmark: number;
    trendDeduction: number;
    trendPercent: number;
    previous3MAmb: number;
    latest3MAmb: number;
    monthlySampledAMBs: { month: string; sampledAMB: number; benchmarkMet: boolean }[];
    evidence: string;
    formulaExplanation: string;
  };
  component2: {
    name: string;
    maxScore: number;
    score: number;
    benchmarkM: number;
    sampledLowRatio: number;
    dailyLowRatio: number;
    finalSafetyRatio: number;
    negativeBalanceDetected: boolean;
    overdraftDetected: boolean;
    lowBalanceDaysCount: number;
    totalDaysAnalysed: number;
    evidence: string;
    formulaExplanation: string;
  };
  component3: {
    name: string;
    maxScore: number;
    score: number;
    confirmedBounces: number;
    candidateCount: number;
    recentBounceWithin30Days: boolean;
    bouncesIn90Days: number;
    bounceEvents: Array<{ date: string; narration: string; amount: number; linkedFee?: number }>;
    evidence: string;
    formulaExplanation: string;
  };
  component4: {
    name: string;
    maxScore: number;
    score: number | 'N/A';
    isRepaymentIncomeContributor: 'YES' | 'NO' | 'UNKNOWN';
    profileType: string;
    recurringMonthsCount: number;
    baseScore: number;
    verificationCap: number;
    verificationCondition: string;
    evidence: string;
    formulaExplanation: string;
  };
  component5: {
    name: string;
    maxScore: number;
    score: number;
    totalCashDeposits: number;
    totalCredits: number;
    cashRatio: number;
    largeCashDeposits: Array<{ date: string; narration: string; amount: number }>;
    evidence: string;
    formulaExplanation: string;
  };
  component6: {
    name: string;
    maxScore: number;
    score: number;
    consecutiveDrops: Array<{ fromDate: string; toDate: string; fromBal: number; toBal: number; dropPercent: number; severity: string }>;
    passThroughEvents: Array<{ creditDate: string; creditAmount: number; debitedAmount: number; ratio: number }>;
    evidence: string;
    formulaExplanation: string;
  };
  bankPolicy: BankPolicy;
  rawTotalScore: number;
  finalTotalScore: number;
  statusBand: 'Green' | 'Amber' | 'Red';
  hardRiskFlags: string[];
  mandatoryDisclaimer: string;
}

/** Final 0-100 EVV score with grade */
export interface EVVScore {
  score: number;            // 0-100
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  gradeLabel: string;
  statusBand?: 'Green' | 'Amber' | 'Red';
  breakdown: EVVWeightBreakdown[];
  summary: string;
  evv6Components?: EVV6ComponentResult;
}

/** Underwriting decision */
export interface UnderwritingDecision {
  decision: 'APPROVE' | 'APPROVE_WITH_CONDITIONS' | 'MANUAL_REVIEW' | 'REJECT';
  decisionLabel: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
  conditions?: string[];
  supportingEvidence: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/** Complete EVV report — full audit trail */
export interface EVVReport {
  // Statement metadata
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  ifsc?: string;
  statementPeriod?: { from: string; to: string };
  openingBalance: number;
  closingBalance: number;

  // Extracted data
  transactions: ExtractedTransaction[];
  totalTransactions: number;

  // Validation
  validation: ValidationReport;

  // Computed series
  dailyBalances: DailyBalance[];
  snapshots: SnapshotBalance[];
  monthlyMetrics: MonthlyStatistics[];

  // Behaviours & risks
  behaviours: FinancialBehaviour[];
  riskFlags: RiskFlag[];

  // Scores
  evvScore: EVVScore;
  evv6Components?: EVV6ComponentResult;
  bankPolicy?: BankPolicy;
  overallEvv: number;          // Average monthly balance (rupees)
  period: { from: string; to: string } | null;
  status: 'COMPUTED' | 'FAILED' | 'MANUAL_REVIEW';
  disclaimer?: string;

  // Decision
  underwritingDecision: UnderwritingDecision;

  // Legacy monthly breakdown (backward compat)
  monthly_evv: EvvMonthBreakdown[];
  totalSnapshots: number;
}

/** Legacy month breakdown (backward compat with old frontend) */
export interface EvvMonthBreakdown {
  month: string;
  points: number;
  avg: number;
  min: number;
  max: number;
  evv: number;
  // New extended fields
  totalCredits?: number;
  totalDebits?: number;
  transactionCount?: number;
  creditCount?: number;
  debitCount?: number;
}

/** Legacy results shape (backward compat) */
export interface EvvResults {
  overall_evv: number;
  monthly_evv: EvvMonthBreakdown[];
  totalSnapshots: number;
  totalTransactions: number;
  period: { from: string; to: string } | null;
  status: 'COMPUTED' | 'FAILED' | 'MANUAL_REVIEW';
}

// ============================================================
// DEFAULT BANK POLICIES & KEYWORDS
// ============================================================

export const DEFAULT_BANK_POLICIES: Record<string, BankPolicy> = {
  DEFAULT: {
    id: 'POLICY-DEF-2026',
    bankName: 'Standard Bank Benchmark',
    accountType: 'Regular Savings Account',
    minimumBalanceBenchmark: 5000,
    strongBalanceTarget: 50000,
    fixedDates: [1, 5, 10, 15, 20, 25],
    analysisMonths: 6,
    defaultDateMode: 'FIXED',
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 25000,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: '2026.1',
  },
  SBI: {
    id: 'POLICY-SBI-2026',
    bankName: 'State Bank of India',
    accountType: 'Regular Savings',
    minimumBalanceBenchmark: 3000,
    strongBalanceTarget: 30000,
    fixedDates: [1, 5, 10, 15, 20, 25],
    analysisMonths: 6,
    defaultDateMode: 'FIXED',
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 25000,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: '2026.1',
  },
  HDFC: {
    id: 'POLICY-HDFC-2026',
    bankName: 'HDFC Bank',
    accountType: 'Savings Max / Regular',
    minimumBalanceBenchmark: 10000,
    strongBalanceTarget: 100000,
    fixedDates: [1, 5, 10, 15, 20, 25],
    analysisMonths: 6,
    defaultDateMode: 'FIXED',
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 25000,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: '2026.1',
  },
  ICICI: {
    id: 'POLICY-ICICI-2026',
    bankName: 'ICICI Bank',
    accountType: 'Privilege / Standard Savings',
    minimumBalanceBenchmark: 10000,
    strongBalanceTarget: 100000,
    fixedDates: [1, 5, 10, 15, 20, 25],
    analysisMonths: 6,
    defaultDateMode: 'FIXED',
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 25000,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: '2026.1',
  },
  PNB: {
    id: 'POLICY-PNB-2026',
    bankName: 'Punjab National Bank',
    accountType: 'General Savings',
    minimumBalanceBenchmark: 1000,
    strongBalanceTarget: 10000,
    fixedDates: [1, 5, 10, 15, 20, 25],
    analysisMonths: 6,
    defaultDateMode: 'FIXED',
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 25000,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: '2026.1',
  },
};

// 6-Component Weights & Caps
export const EVV_6_COMPONENT_MAX = {
  comp1_AverageBalanceTrend: 25,
  comp2_MinimumBalanceSafety: 20,
  comp3_BounceFreeRecord: 20,
  comp4_FinancialInflowRegularity: 15,
  comp5_CashDepositRatio: 10,
  comp6_WithdrawalDiscipline: 10,
};

// Minimum balance benchmark (₹ — fallback default)
const MIN_BALANCE_BENCHMARK = 5000;

// Candidate bounce keywords as specified in standard
export const BOUNCE_CANDIDATE_KEYWORDS = [
  'nach return', 'ecs return', 'emi return', 'cheque return', 'chq return',
  'cheque bounce', 'cheque dishonour', 'cheque dishonor',
  'insufficient funds', 'funds insufficient', 'mandate return',
  'mandate failed', 'auto debit return', 'autodebit return', 'si return',
  'standing instruction return', 'payment returned', 'debit returned',
  'bounce', 'dishonour', 'returned'
];

// Exclusions from bounce detection
export const BOUNCE_EXCLUSION_KEYWORDS = [
  'reversal', 'reversed', 'refund', 'cashback',
  'failed atm', 'atm reversal', 'upi reversal', 'failed cash withdrawal', 'chargeback'
];

// Physical cash deposit keywords
export const PHYSICAL_CASH_KEYWORDS = [
  'cash deposit', 'cash dep', 'cash paid in', 'cash at branch', 'cash acceptor',
  'cash accepting machine', 'cdm', 'self cash deposit', 'by cash',
  'cash remittance', 'cash received at branch'
];

// Excluded channels from cash deposits
export const CASH_EXCLUSIONS = [
  'upi', 'imps', 'neft', 'rtgs', 'salary', 'pension', 'interest', 'refund',
  'cashback', 'reversal', 'transfer', 'trf', 'payroll'
];

// ============================================================
// CHANNEL CLASSIFIERS
// ============================================================

const CASH_KEYWORDS = ['cash', 'atm', 'cdm', 'atm w/d', 'cash dep', 'cash wd', 'cash withdrawal', 'cash deposit', 'atm cash'];
const UPI_KEYWORDS = ['upi', 'upi/', '/upi', 'upi-', 'upi cr', 'upi dr', 'paytm', 'phonepe', 'gpay', 'google pay', 'bhim'];
const NEFT_KEYWORDS = ['neft', 'neft cr', 'neft dr', 'neft/'];
const RTGS_KEYWORDS = ['rtgs', 'rtgs/', 'rtgs cr', 'rtgs dr'];
const IMPS_KEYWORDS = ['imps', 'imps/', 'imps cr', 'imps dr'];
const CHEQUE_KEYWORDS = ['chq', 'cheque', 'clg', 'clearing', 'ecs', 'micr'];
const BOUNCE_KEYWORDS = BOUNCE_CANDIDATE_KEYWORDS;
const CHARGE_KEYWORDS = ['charge', 'fee', 'gst', 'service charge', 'annual fee', 'maintenance', 'sms charge', 'incidental charge'];
const EMI_KEYWORDS = ['emi', 'loan', 'instalment', 'installment', 'principal', 'interest', 'mandate', 'nach', 'auto debit', 'si-'];
const CREDIT_CARD_KEYWORDS = ['credit card', 'cc payment', 'hdfc cc', 'sbi card', 'icici card'];
const SALARY_KEYWORDS = ['salary', 'sal/', 'sal-', 'payroll', 'payroll cr', 'employer', 'wages', 'hysalary'];
const RENT_KEYWORDS = ['rent', 'rental', 'house rent', 'property rent', 'lease'];
const GOVT_KEYWORDS = ['govt', 'government', 'pm kisan', 'scholarship', 'scholarship cr', 'stipend', 'subsidy'];
const SCHOLARSHIP_KEYWORDS = ['scholarship', 'stipend', 'fellowship', 'grant'];


// ============================================================
// HELPER UTILITIES
// ============================================================

function detectChannel(narration: string): string {
  const n = narration.toLowerCase();
  if (UPI_KEYWORDS.some(k => n.includes(k))) return 'UPI';
  if (NEFT_KEYWORDS.some(k => n.includes(k))) return 'NEFT';
  if (RTGS_KEYWORDS.some(k => n.includes(k))) return 'RTGS';
  if (IMPS_KEYWORDS.some(k => n.includes(k))) return 'IMPS';
  if (CHEQUE_KEYWORDS.some(k => n.includes(k))) return 'CHEQUE';
  if (CASH_KEYWORDS.some(k => n.includes(k))) return 'CASH';
  return 'ONLINE';
}

function isBounceTx(narration: string): boolean {
  const n = narration.toLowerCase();
  return BOUNCE_KEYWORDS.some(k => n.includes(k));
}

function isChargeTx(narration: string): boolean {
  const n = narration.toLowerCase();
  return CHARGE_KEYWORDS.some(k => n.includes(k));
}

function isEmiTx(narration: string, debit: number): boolean {
  const n = narration.toLowerCase();
  return debit > 0 && EMI_KEYWORDS.some(k => n.includes(k));
}

function isSalaryTx(narration: string, credit: number): boolean {
  const n = narration.toLowerCase();
  return credit > 0 && SALARY_KEYWORDS.some(k => n.includes(k));
}

function isScholarshipTx(narration: string, credit: number): boolean {
  const n = narration.toLowerCase();
  return credit > 0 && SCHOLARSHIP_KEYWORDS.some(k => n.includes(k));
}

function isGovtTx(narration: string, credit: number): boolean {
  const n = narration.toLowerCase();
  return credit > 0 && GOVT_KEYWORDS.some(k => n.includes(k));
}

function isCashDeposit(narration: string, credit: number): boolean {
  const n = narration.toLowerCase();
  return credit > 0 && CASH_KEYWORDS.some(k => n.includes(k));
}

function isCashWithdrawal(narration: string, debit: number): boolean {
  const n = narration.toLowerCase();
  return debit > 0 && CASH_KEYWORDS.some(k => n.includes(k));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatPeriodDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    }).replace(/ /g, '-');
  } catch {
    return dateStr;
  }
}

function formatMonthLabel(monthStr: string): string {
  try {
    const [y, m] = monthStr.split('-');
    return new Date(parseInt(y), parseInt(m) - 1, 1)
      .toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  } catch {
    return monthStr;
  }
}

function clampScore(s: number): number {
  return Math.max(0, Math.min(100, Math.round(s)));
}

// ============================================================
// MAIN EVV ENGINE SERVICE
// ============================================================

@Injectable()
export class EvvEngineService {
  private readonly logger = new Logger(EvvEngineService.name);

  constructor(private readonly openRouter: OpenRouterService) {}

  // ──────────────────────────────────────────────────────────
  // 1. TRANSACTION EXTRACTION
  // ──────────────────────────────────────────────────────────

  async extractTransactions(
    fileBuffer: Buffer,
    mimetype: string,
    originalName?: string,
    seed?: string,
  ): Promise<ExtractedTransaction[]> {
    this.logger.log(`[EVV] Extracting transactions from ${originalName || 'statement'} (${mimetype})`);

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
      this.logger.warn(`[EVV] OpenRouter API key not configured — generating mock transactions.`);
      return this.generateMockTransactions(originalName, seed);
    }

    const base64Data = fileBuffer.toString('base64');
    const dataUrl = `data:${mimetype};base64,${base64Data}`;

    const prompt = `You are a specialized AI Bank Statement Underwriting Assistant powered by ChatGPT / OpenAI.

FIRST: Document Verification
Determine if this document is a genuine Bank Statement (bank passbook, e-statement, or transaction ledger).
If it is NOT a bank statement (e.g. it is a Passport, Aadhaar card, Marks Sheet, Resume, Invoice, or unrelated file), set "isBankStatement": false, set "docTypeDetected" to the detected type (e.g. "Passport"), and set "error": "Uploaded document is not a valid Bank Statement".

SECOND: Transaction & Metadata Extraction (for valid bank statements)
Extract ALL transaction rows with:
- date: string "YYYY-MM-DD"
- narration: string (full transaction description)
- debit: number (0 if credit)
- credit: number (0 if debit)
- balance: number (running balance after transaction)
- referenceNumber: string or ""
- channel: string (one of: UPI, NEFT, RTGS, IMPS, CHEQUE, CASH, ATM, ONLINE)

Respond ONLY with this exact JSON structure:
{
  "isBankStatement": true,
  "docTypeDetected": "Bank Statement",
  "metadata": {
    "openingBalance": 0,
    "closingBalance": 0,
    "accountNumber": "",
    "accountHolder": "",
    "ifsc": "",
    "bankName": "",
    "statementFrom": "",
    "statementTo": ""
  },
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "narration": "",
      "debit": 0,
      "credit": 0,
      "balance": 0,
      "referenceNumber": "",
      "channel": "ONLINE"
    }
  ],
  "error": ""
}`;

    try {
      const responseStr = await this.openRouter.chatWithVision(
        prompt,
        dataUrl,
        'openai/gpt-4o-mini',
      );
      this.logger.log(`[EVV] ChatGPT Vision AI response (first 400 chars): ${responseStr.slice(0, 400)}`);

      // Strip markdown fences
      let cleaned = responseStr.replace(/```json/g, '').replace(/```/g, '').trim();
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('No JSON found in AI response');
      }

      const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
      let parsed: any;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseErr: any) {
        this.logger.warn(`[EVV] JSON parse failed: ${parseErr.message}. Attempting salvage...`);
        const salvaged = this.salvageTransactions(responseStr);
        if (salvaged.length > 0) {
          this.logger.log(`[EVV] Salvaged ${salvaged.length} transactions.`);
          return salvaged;
        }
        throw parseErr;
      }

      // Check document type verification result
      if (parsed.isBankStatement === false) {
        const detectedType = parsed.docTypeDetected || 'non-bank document';
        this.logger.warn(`[EVV Document Verification] Uploaded file is NOT a bank statement (Detected: ${detectedType})`);
        throw new Error(`Uploaded document is not a valid Bank Statement (Detected: ${detectedType}). Please upload a customer bank statement PDF.`);
      }

      if (parsed.error && (!parsed.transactions || parsed.transactions.length === 0)) {
        this.logger.warn(`[EVV] AI reported error: ${parsed.error}`);
        return [];
      }

      const rawTxs: any[] = Array.isArray(parsed.transactions) ? parsed.transactions : [];
      return rawTxs.map((tx: any) => this.normaliseTransaction(tx));
    } catch (err: any) {
      this.logger.error(`[EVV] ChatGPT AI extraction failed: ${err.message}`);
      throw err;
    }
  }

  /** Normalise a raw AI-extracted row into ExtractedTransaction */
  private normaliseTransaction(tx: any): ExtractedTransaction {
    const debit = Math.abs(Number(tx.debit ?? tx.Debit ?? 0));
    const credit = Math.abs(Number(tx.credit ?? tx.Credit ?? 0));
    const balance = Number(tx.balance ?? tx.Balance ?? 0);
    const narration = String(tx.narration ?? tx.Narration ?? tx.description ?? '');
    const date = String(tx.date ?? tx.Date ?? '');
    const channel = tx.channel || detectChannel(narration);

    return {
      date,
      narration,
      debit,
      credit,
      balance,
      referenceNumber: String(tx.referenceNumber ?? ''),
      channel,
      utr: String(tx.utr ?? ''),
      mode: channel,
      amount: Math.max(debit, credit),
      type: credit > 0 ? 'credit' : 'debit',
      month: date.slice(0, 7),
    };
  }

  /** Regex-based salvage from malformed JSON */
  private salvageTransactions(content: string): ExtractedTransaction[] {
    const results: ExtractedTransaction[] = [];
    const braceRe = /\{[^{}]*\}/g;
    let match: RegExpExecArray | null;
    while ((match = braceRe.exec(content)) !== null) {
      try {
        const obj = JSON.parse(match[0]);
        const dateVal = obj.date || obj.Date;
        const debitVal = Number(obj.debit ?? obj.Debit ?? 0);
        const creditVal = Number(obj.credit ?? obj.Credit ?? 0);
        const balanceVal = Number(obj.balance ?? obj.Balance);
        const narration = String(obj.narration ?? obj.Narration ?? '');
        if (dateVal && (debitVal > 0 || creditVal > 0) && !isNaN(balanceVal)) {
          results.push(this.normaliseTransaction({ ...obj, date: dateVal, narration, debit: debitVal, credit: creditVal, balance: balanceVal }));
        }
      } catch { /* skip */ }
    }
    return results;
  }

  // ──────────────────────────────────────────────────────────
  // 2. DATA VALIDATION
  // ──────────────────────────────────────────────────────────

  validateExtractedData(
    transactions: ExtractedTransaction[],
    openingBalance: number,
    closingBalance: number,
  ): ValidationReport {
    const checks: { name: string; passed: boolean; detail: string }[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // Sort by date
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

    // Check 1: Non-empty
    const notEmpty = sorted.length > 0;
    checks.push({ name: 'Transactions Extracted', passed: notEmpty, detail: `${sorted.length} transactions found` });
    if (!notEmpty) errors.push('No transactions could be extracted from the statement');

    // Check 2: Valid dates
    const validDates = sorted.every(tx => /^\d{4}-\d{2}-\d{2}$/.test(tx.date));
    checks.push({ name: 'Valid Date Format', passed: validDates, detail: validDates ? 'All dates in YYYY-MM-DD format' : 'Some dates have invalid format' });
    if (!validDates) warnings.push('Some transaction dates could not be parsed correctly');

    // Check 3: No negative balances
    const negativeBalances = sorted.filter(tx => tx.balance < 0);
    const noNegativeBalance = negativeBalances.length === 0;
    checks.push({
      name: 'No Negative Balances',
      passed: noNegativeBalance,
      detail: noNegativeBalance ? 'All balances are non-negative' : `${negativeBalances.length} transaction(s) show negative balance`
    });
    if (!noNegativeBalance) warnings.push(`${negativeBalances.length} instances of negative balance detected`);

    // Check 4: Running balance continuity
    let balanceBreaks = 0;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const expectedBalance = prev.balance - curr.debit + curr.credit;
      const diff = Math.abs(curr.balance - expectedBalance);
      if (diff > 5) balanceBreaks++; // Allow ₹5 tolerance for rounding
    }
    const balanceContinuous = balanceBreaks === 0;
    checks.push({
      name: 'Running Balance Continuity',
      passed: balanceContinuous,
      detail: balanceContinuous ? 'Running balance is continuous' : `${balanceBreaks} balance discontinuity/ies detected`
    });
    if (!balanceContinuous) warnings.push(`Balance sequence broken at ${balanceBreaks} points — may indicate missing transactions`);

    // Check 5: No duplicate transactions (same date + amount + type)
    const txKeys = sorted.map(tx => `${tx.date}|${tx.amount}|${tx.type}`);
    const uniqueKeys = new Set(txKeys);
    const noDuplicates = uniqueKeys.size === txKeys.length;
    const dupCount = txKeys.length - uniqueKeys.size;
    checks.push({
      name: 'No Duplicate Transactions',
      passed: noDuplicates,
      detail: noDuplicates ? 'No duplicates detected' : `${dupCount} potential duplicate(s) found`
    });
    if (!noDuplicates) warnings.push(`${dupCount} potential duplicate transactions detected`);

    // Check 6: Closing balance match
    const lastTx = sorted[sorted.length - 1];
    const closingMatch = lastTx ? Math.abs(lastTx.balance - closingBalance) < 100 : false;
    checks.push({
      name: 'Closing Balance Match',
      passed: closingMatch || closingBalance === 0,
      detail: closingBalance > 0
        ? (closingMatch ? `Closing balance matches: ₹${closingBalance.toLocaleString('en-IN')}` : `Mismatch: extracted ₹${lastTx?.balance?.toLocaleString('en-IN')}, expected ₹${closingBalance.toLocaleString('en-IN')}`)
        : 'Closing balance not extracted'
    });
    if (!closingMatch && closingBalance > 0) warnings.push('Closing balance does not match last transaction balance');

    // Check 7: Missing date gaps (> 60 days)
    let hasBigGap = false;
    if (sorted.length > 1) {
      for (let i = 1; i < sorted.length; i++) {
        const d1 = new Date(sorted[i - 1].date);
        const d2 = new Date(sorted[i].date);
        const gapDays = (d2.getTime() - d1.getTime()) / 86400000;
        if (gapDays > 60) { hasBigGap = true; break; }
      }
    }
    checks.push({
      name: 'No Large Date Gaps',
      passed: !hasBigGap,
      detail: hasBigGap ? 'Transaction date gap > 60 days detected (possible missing pages)' : 'Transaction dates are reasonably continuous'
    });
    if (hasBigGap) warnings.push('Large gap between transactions detected — statement may have missing pages');

    const passCount = checks.filter(c => c.passed).length;
    const confidenceScore = Math.round((passCount / checks.length) * 100);

    return {
      isValid: errors.length === 0,
      confidenceScore,
      checks,
      warnings,
      errors,
    };
  }

  // ──────────────────────────────────────────────────────────
  // 3. DAILY BALANCE RECONSTRUCTION
  // ──────────────────────────────────────────────────────────

  reconstructDailyBalances(
    transactions: ExtractedTransaction[],
    openingBalance: number,
  ): DailyBalance[] {
    if (transactions.length === 0) return [];

    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    const firstDate = new Date(sorted[0].date);
    const lastDate = new Date(sorted[sorted.length - 1].date);

    // Build a map: date string → final balance on that day
    const dateBalanceMap = new Map<string, number>();
    for (const tx of sorted) {
      dateBalanceMap.set(tx.date, tx.balance); // Last tx of the day wins
    }

    const result: DailyBalance[] = [];
    const cursor = new Date(firstDate);
    let currentBalance = openingBalance > 0 ? openingBalance : sorted[0].balance;

    while (cursor <= lastDate) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const isTransactionDay = dateBalanceMap.has(dateStr);
      if (isTransactionDay) {
        currentBalance = dateBalanceMap.get(dateStr)!;
      }
      result.push({ date: dateStr, balance: currentBalance, isTransactionDay });
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  // ──────────────────────────────────────────────────────────
  // 4. SNAPSHOT CALCULATION
  // ──────────────────────────────────────────────────────────

  calculateSnapshots(
    dailyBalances: DailyBalance[],
    intervalOrDays: number | number[] = [1, 5, 10, 15, 20, 25],
  ): SnapshotBalance[] {
    if (dailyBalances.length === 0) return [];

    let snapshotDays: number[];
    if (typeof intervalOrDays === 'number') {
      const interval = intervalOrDays;
      if (interval === 1) {
        snapshotDays = Array.from({ length: 31 }, (_, i) => i + 1);
      } else if (interval === 5) {
        snapshotDays = [1, 5, 10, 15, 20, 25];
      } else if (interval === 7) {
        snapshotDays = [7, 14, 21, 28];
      } else if (interval === 10) {
        snapshotDays = [10, 20, 30];
      } else if (interval === 15) {
        snapshotDays = [15, 30];
      } else {
        snapshotDays = [];
        for (let d = interval; d <= 30; d += interval) {
          snapshotDays.push(d);
        }
      }
    } else {
      snapshotDays = intervalOrDays;
    }

    const balanceMap = new Map<string, number>();
    for (const db of dailyBalances) {
      balanceMap.set(db.date, db.balance);
    }

    const getBalance = (targetDateStr: string): number => {
      const target = new Date(targetDateStr);
      for (let i = 0; i <= 31; i++) {
        const d = new Date(target);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().slice(0, 10);
        if (balanceMap.has(ds)) return balanceMap.get(ds)!;
      }
      return dailyBalances[0]?.balance ?? 0;
    };

    const months = new Set<string>();
    for (const db of dailyBalances) months.add(db.date.slice(0, 7));

    const snapshots: SnapshotBalance[] = [];
    for (const month of Array.from(months).sort()) {
      const [y, m] = month.split('-').map(Number);
      const lastDay = daysInMonth(y, m);
      const uniqueDays = Array.from(new Set(snapshotDays.map(d => Math.min(d, lastDay)))).sort((a, b) => a - b);

      for (const day of uniqueDays) {
        const dateStr = `${month}-${String(day).padStart(2, '0')}`;
        const balance = getBalance(dateStr);
        snapshots.push({ date: dateStr, balance, month, snapshotDay: day });
      }
    }
    return snapshots.sort((a, b) => a.date.localeCompare(b.date));
  }

  // ──────────────────────────────────────────────────────────
  // 5. MONTHLY METRICS
  // ──────────────────────────────────────────────────────────

  calculateMonthlyMetrics(
    dailyBalances: DailyBalance[],
    transactions: ExtractedTransaction[],
    snapshots: SnapshotBalance[],
  ): MonthlyStatistics[] {
    if (dailyBalances.length === 0) return [];

    // Group daily balances by month
    const dailyByMonth = new Map<string, DailyBalance[]>();
    for (const db of dailyBalances) {
      const m = db.date.slice(0, 7);
      if (!dailyByMonth.has(m)) dailyByMonth.set(m, []);
      dailyByMonth.get(m)!.push(db);
    }

    // Group transactions by month
    const txByMonth = new Map<string, ExtractedTransaction[]>();
    for (const tx of transactions) {
      const m = tx.date.slice(0, 7);
      if (!txByMonth.has(m)) txByMonth.set(m, []);
      txByMonth.get(m)!.push(tx);
    }

    // Group snapshots by month
    const snap5ByMonth = new Map<string, SnapshotBalance[]>();
    for (const s of snapshots) {
      if (!snap5ByMonth.has(s.month)) snap5ByMonth.set(s.month, []);
      snap5ByMonth.get(s.month)!.push(s);
    }

    const months = Array.from(dailyByMonth.keys()).sort();
    const stats: MonthlyStatistics[] = [];

    for (const month of months) {
      const dayBalances = (dailyByMonth.get(month) || []).map(d => d.balance);
      const txList = txByMonth.get(month) || [];
      const snap5 = snap5ByMonth.get(month) || [];

      const credits = txList.filter(tx => tx.credit > 0).map(tx => tx.credit);
      const debits = txList.filter(tx => tx.debit > 0).map(tx => tx.debit);

      const avgBalance = dayBalances.length > 0
        ? Number((dayBalances.reduce((s, b) => s + b, 0) / dayBalances.length).toFixed(2))
        : 0;
      const snapshotBalances = snap5.map(s => s.balance);
      const snapshotAvg = snapshotBalances.length > 0
        ? Number((snapshotBalances.reduce((s, b) => s + b, 0) / snapshotBalances.length).toFixed(2))
        : avgBalance;
      const snapshotMin = snapshotBalances.length > 0
        ? Number(Math.min(...snapshotBalances).toFixed(2))
        : Number(Math.min(...dayBalances).toFixed(2));
      const snapshotMax = snapshotBalances.length > 0
        ? Number(Math.max(...snapshotBalances).toFixed(2))
        : Number(Math.max(...dayBalances).toFixed(2));

      // Classify each transaction
      let cashDepositCount = 0, cashWithdrawalCount = 0;
      let upiCount = 0, neftCount = 0, rtgsCount = 0, impsCount = 0, chequeCount = 0;
      let bounceCount = 0, chargeCount = 0, emiCount = 0;

      for (const tx of txList) {
        const n = tx.narration;
        if (isCashDeposit(n, tx.credit)) cashDepositCount++;
        if (isCashWithdrawal(n, tx.debit)) cashWithdrawalCount++;
        if (tx.channel === 'UPI') upiCount++;
        else if (tx.channel === 'NEFT') neftCount++;
        else if (tx.channel === 'RTGS') rtgsCount++;
        else if (tx.channel === 'IMPS') impsCount++;
        else if (tx.channel === 'CHEQUE') chequeCount++;
        if (isBounceTx(n)) bounceCount++;
        if (isChargeTx(n)) chargeCount++;
        if (isEmiTx(n, tx.debit)) emiCount++;
      }

      const totalCredits = credits.reduce((s, c) => s + c, 0);
      const totalDebits = debits.reduce((s, d) => s + d, 0);

      stats.push({
        month,
        monthLabel: formatMonthLabel(month),
        avgBalance,
        highestBalance: dayBalances.length > 0 ? Math.max(...dayBalances) : 0,
        lowestBalance: dayBalances.length > 0 ? Math.min(...dayBalances) : 0,
        medianBalance: median(dayBalances),
        avgDailyBalance: avgBalance,
        openingBalance: dayBalances[0] ?? 0,
        closingBalance: dayBalances[dayBalances.length - 1] ?? 0,

        totalCredits,
        totalDebits,
        avgCredit: credits.length > 0 ? Math.round(totalCredits / credits.length) : 0,
        avgDebit: debits.length > 0 ? Math.round(totalDebits / debits.length) : 0,

        transactionCount: txList.length,
        creditCount: credits.length,
        debitCount: debits.length,
        cashDepositCount,
        cashWithdrawalCount,
        upiCount,
        neftCount,
        rtgsCount,
        impsCount,
        chequeCount,
        bounceCount,
        chargeCount,
        emiCount,

        snapshotAvg,
        snapshotMin,
        snapshotMax,
        snapshotPoints: snap5.length,
        evv: snapshotAvg,
      });
    }

    return stats;
  }

  // ──────────────────────────────────────────────────────────
  // 6. FINANCIAL BEHAVIOUR DETECTION
  // ──────────────────────────────────────────────────────────

  detectFinancialBehaviour(
    transactions: ExtractedTransaction[],
    monthlyMetrics: MonthlyStatistics[],
  ): FinancialBehaviour[] {
    const behaviours: FinancialBehaviour[] = [];
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

    const totalCredits = transactions.reduce((s, tx) => s + tx.credit, 0);
    const totalCashCredits = transactions.filter(tx => isCashDeposit(tx.narration, tx.credit)).reduce((s, tx) => s + tx.credit, 0);
    const totalBounces = monthlyMetrics.reduce((s, m) => s + m.bounceCount, 0);
    const totalEMIs = monthlyMetrics.reduce((s, m) => s + m.emiCount, 0);
    const salaryTxs = sorted.filter(tx => isSalaryTx(tx.narration, tx.credit));
    const scholarshipTxs = sorted.filter(tx => isScholarshipTx(tx.narration, tx.credit));
    const govtTxs = sorted.filter(tx => isGovtTx(tx.narration, tx.credit));

    // ── Salary Pattern
    const salaryMonths = new Set(salaryTxs.map(tx => tx.date.slice(0, 7)));
    const salaryConsistency = monthlyMetrics.length > 0 ? salaryMonths.size / monthlyMetrics.length : 0;
    behaviours.push({
      type: 'SALARY_PATTERN',
      label: 'Regular Salary Credits',
      detected: salaryTxs.length > 0,
      confidence: salaryConsistency,
      evidence: salaryTxs.length > 0
        ? `${salaryTxs.length} salary-type credits detected across ${salaryMonths.size} months`
        : 'No salary-type credits detected',
      severity: salaryTxs.length > 0 ? 'positive' : 'warning',
    });

    // ── Business Income (high credit frequency)
    const avgCreditCount = monthlyMetrics.reduce((s, m) => s + m.creditCount, 0) / (monthlyMetrics.length || 1);
    const hasBusinessIncome = avgCreditCount > 8 && salaryTxs.length === 0;
    behaviours.push({
      type: 'BUSINESS_INCOME',
      label: 'Business / Freelance Income',
      detected: hasBusinessIncome,
      confidence: hasBusinessIncome ? 0.65 : 0.2,
      evidence: hasBusinessIncome
        ? `Avg ${avgCreditCount.toFixed(1)} credits/month without clear salary pattern — likely business income`
        : 'No clear business income pattern',
      severity: hasBusinessIncome ? 'positive' : 'neutral',
    });

    // ── Rental Income
    const rentTxs = sorted.filter(tx => RENT_KEYWORDS.some(k => tx.narration.toLowerCase().includes(k)) && tx.credit > 0);
    behaviours.push({
      type: 'RENTAL_INCOME',
      label: 'Rental Income',
      detected: rentTxs.length > 0,
      confidence: rentTxs.length > 0 ? 0.75 : 0,
      evidence: rentTxs.length > 0 ? `${rentTxs.length} rental income credits detected` : 'No rental income detected',
      severity: rentTxs.length > 0 ? 'positive' : 'neutral',
    });

    // ── Cash Intensive Account
    const cashRatio = totalCredits > 0 ? totalCashCredits / totalCredits : 0;
    const isCashIntensive = cashRatio > 0.4;
    behaviours.push({
      type: 'CASH_INTENSIVE',
      label: 'Cash-Intensive Account',
      detected: isCashIntensive,
      confidence: cashRatio,
      evidence: `${(cashRatio * 100).toFixed(1)}% of credits are cash deposits`,
      severity: isCashIntensive ? 'warning' : 'neutral',
    });

    // ── Circular Transactions (same amounts credit+debit within same month)
    const circularSets = new Set<number>();
    for (const m of monthlyMetrics) {
      const mTxs = sorted.filter(tx => tx.date.startsWith(m.month));
      const creditAmounts = new Set(mTxs.filter(tx => tx.credit > 0).map(tx => tx.credit));
      const debitAmounts = mTxs.filter(tx => tx.debit > 0).map(tx => tx.debit);
      for (const da of debitAmounts) {
        if (creditAmounts.has(da) && da > 5000) circularSets.add(da);
      }
    }
    const hasCircular = circularSets.size >= 2;
    behaviours.push({
      type: 'CIRCULAR_TRANSACTIONS',
      label: 'Circular Transactions',
      detected: hasCircular,
      confidence: hasCircular ? 0.7 : 0.1,
      evidence: hasCircular
        ? `${circularSets.size} amounts appear as both credit and debit within same month`
        : 'No circular transaction pattern',
      severity: hasCircular ? 'critical' : 'neutral',
    });

    // ── Large Withdrawals (single debit > ₹1 lakh)
    const largeWithdrawals = sorted.filter(tx => tx.debit >= 100000);
    behaviours.push({
      type: 'LARGE_WITHDRAWALS',
      label: 'Large Withdrawals',
      detected: largeWithdrawals.length > 0,
      confidence: largeWithdrawals.length > 0 ? 0.9 : 0,
      evidence: largeWithdrawals.length > 0
        ? `${largeWithdrawals.length} debit(s) ≥ ₹1,00,000`
        : 'No unusually large withdrawals',
      severity: largeWithdrawals.length > 0 ? 'warning' : 'neutral',
    });

    // ── Sudden Balance Spikes (credit > 3× previous month avg)
    let balanceSpikes = 0;
    for (let i = 1; i < monthlyMetrics.length; i++) {
      const prev = monthlyMetrics[i - 1].avgBalance;
      const curr = monthlyMetrics[i].avgBalance;
      if (prev > 0 && curr > prev * 3) balanceSpikes++;
    }
    behaviours.push({
      type: 'SUDDEN_BALANCE_SPIKES',
      label: 'Sudden Balance Spikes',
      detected: balanceSpikes > 0,
      confidence: balanceSpikes > 0 ? 0.8 : 0,
      evidence: balanceSpikes > 0
        ? `${balanceSpikes} month(s) show balance spike >3× previous month`
        : 'No sudden balance spikes detected',
      severity: balanceSpikes > 0 ? 'warning' : 'neutral',
    });

    // ── Account Draining (closing balance < 10% of month avg consistently)
    const drainingMonths = monthlyMetrics.filter(m => m.avgBalance > 10000 && m.closingBalance < m.avgBalance * 0.1);
    behaviours.push({
      type: 'ACCOUNT_DRAINING',
      label: 'Month-End Account Draining',
      detected: drainingMonths.length >= 2,
      confidence: drainingMonths.length / (monthlyMetrics.length || 1),
      evidence: drainingMonths.length > 0
        ? `${drainingMonths.length} month(s) show closing balance < 10% of monthly average`
        : 'No account draining pattern',
      severity: drainingMonths.length >= 2 ? 'critical' : 'neutral',
    });

    // ── Month-end Balance Inflation (large credit in last 3 days of month)
    const monthEndInflation = sorted.filter(tx => {
      const date = new Date(tx.date);
      const day = date.getDate();
      const lastDay = daysInMonth(date.getFullYear(), date.getMonth() + 1);
      return tx.credit > 50000 && day >= lastDay - 2;
    });
    behaviours.push({
      type: 'MONTH_END_INFLATION',
      label: 'Month-End Balance Inflation',
      detected: monthEndInflation.length >= 2,
      confidence: monthEndInflation.length / (monthlyMetrics.length || 1),
      evidence: monthEndInflation.length >= 2
        ? `${monthEndInflation.length} large credits (>₹50,000) in last 3 days of month`
        : 'No month-end inflation pattern',
      severity: monthEndInflation.length >= 2 ? 'critical' : 'neutral',
    });

    // ── Minimum Balance Violations
    const minBalViolations = monthlyMetrics.filter(m => m.lowestBalance < MIN_BALANCE_BENCHMARK);
    behaviours.push({
      type: 'MIN_BALANCE_VIOLATION',
      label: 'Minimum Balance Violations',
      detected: minBalViolations.length > 0,
      confidence: minBalViolations.length / (monthlyMetrics.length || 1),
      evidence: minBalViolations.length > 0
        ? `${minBalViolations.length} month(s) with balance below ₹${MIN_BALANCE_BENCHMARK.toLocaleString('en-IN')}`
        : 'Balance consistently above minimum',
      severity: minBalViolations.length > 0 ? 'warning' : 'positive',
    });

    // ── Frequent Overdrafts / Bounces
    behaviours.push({
      type: 'FREQUENT_BOUNCES',
      label: 'Returned / Bounced Payments',
      detected: totalBounces > 0,
      confidence: Math.min(1, totalBounces / 5),
      evidence: totalBounces > 0
        ? `${totalBounces} returned/bounced payment(s) across the statement period`
        : 'No returned or bounced payments',
      severity: totalBounces >= 3 ? 'critical' : totalBounces > 0 ? 'warning' : 'positive',
    });

    // ── Loan EMI Deductions
    behaviours.push({
      type: 'LOAN_EMI_DEDUCTIONS',
      label: 'Existing Loan EMI Payments',
      detected: totalEMIs > 0,
      confidence: Math.min(1, totalEMIs / monthlyMetrics.length),
      evidence: totalEMIs > 0
        ? `${totalEMIs} EMI/loan-linked debit(s) detected`
        : 'No existing EMI obligations detected',
      severity: totalEMIs > 0 ? 'warning' : 'positive',
    });

    // ── Scholarship / Government Credits
    const govtScholarship = [...scholarshipTxs, ...govtTxs];
    behaviours.push({
      type: 'SCHOLARSHIP_CREDITS',
      label: 'Scholarship / Government Credits',
      detected: govtScholarship.length > 0,
      confidence: govtScholarship.length > 0 ? 0.85 : 0,
      evidence: govtScholarship.length > 0
        ? `${scholarshipTxs.length} scholarship and ${govtTxs.length} government credit(s) detected`
        : 'No scholarship or government credits detected',
      severity: 'positive',
    });

    return behaviours;
  }

  // ──────────────────────────────────────────────────────────
  // 7. RISK FLAG DETECTION
  // ──────────────────────────────────────────────────────────

  detectRiskFlags(
    transactions: ExtractedTransaction[],
    behaviours: FinancialBehaviour[],
    monthlyMetrics: MonthlyStatistics[],
  ): RiskFlag[] {
    const flags: RiskFlag[] = [];
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    const getBehaviour = (type: string) => behaviours.find(b => b.type === type);

    // ── Round Tripping
    const circular = getBehaviour('CIRCULAR_TRANSACTIONS');
    if (circular?.detected) {
      flags.push({
        type: 'ROUND_TRIPPING',
        label: 'Round Tripping Detected',
        severity: 'high',
        description: 'Same amounts appearing as both credits and debits within the same month, suggesting artificial fund circulation.',
        evidence: circular.evidence,
      });
    }

    // ── Large Cash Deposits
    const largeCashDeposits = sorted.filter(tx => isCashDeposit(tx.narration, tx.credit) && tx.credit >= 50000);
    if (largeCashDeposits.length > 0) {
      flags.push({
        type: 'LARGE_CASH_DEPOSITS',
        label: 'Large Cash Deposits',
        severity: largeCashDeposits.length >= 3 ? 'critical' : 'high',
        description: 'Large single cash deposits (≥₹50,000) may indicate undisclosed income sources.',
        evidence: `${largeCashDeposits.length} cash deposit(s) each ≥ ₹50,000`,
      });
    }

    // ── Temporary Balance Inflation
    const monthEndInflation = getBehaviour('MONTH_END_INFLATION');
    if (monthEndInflation?.detected) {
      flags.push({
        type: 'TEMPORARY_BALANCE_INFLATION',
        label: 'Temporary Balance Inflation',
        severity: 'high',
        description: 'Large credits at month-end suggest artificial inflation of balance before statement generation.',
        evidence: monthEndInflation.evidence,
      });
    }

    // ── Salary Missing
    const salaryBehaviour = getBehaviour('SALARY_PATTERN');
    if (!salaryBehaviour?.detected && monthlyMetrics.length >= 3) {
      flags.push({
        type: 'SALARY_MISSING',
        label: 'No Salary Credit Detected',
        severity: 'medium',
        description: 'No recognizable salary credit pattern found in the statement. Income source unclear.',
        evidence: `Checked ${sorted.length} transactions — no salary-type credit found`,
      });
    }

    // ── High Cash Dependency
    const cashIntensive = getBehaviour('CASH_INTENSIVE');
    if (cashIntensive?.detected) {
      flags.push({
        type: 'HIGH_CASH_DEPENDENCY',
        label: 'High Cash Dependency',
        severity: 'medium',
        description: 'More than 40% of credits are cash-based, making income difficult to trace.',
        evidence: cashIntensive.evidence,
      });
    }

    // ── Multiple Inward Transfers per month
    const highInwardMonths = monthlyMetrics.filter(m => m.creditCount > 15);
    if (highInwardMonths.length >= 2) {
      flags.push({
        type: 'MULTIPLE_INWARD_TRANSFERS',
        label: 'Excessive Inward Transfers',
        severity: 'medium',
        description: 'Unusually high number of credit transactions per month (>15) suggesting fragmented fund sources.',
        evidence: `${highInwardMonths.length} month(s) with >15 credit transactions`,
      });
    }

    // ── Multiple Outward Transfers per month
    const highOutwardMonths = monthlyMetrics.filter(m => m.debitCount > 15);
    if (highOutwardMonths.length >= 2) {
      flags.push({
        type: 'MULTIPLE_OUTWARD_TRANSFERS',
        label: 'Excessive Outward Transfers',
        severity: 'low',
        description: 'High number of debit transactions per month may indicate fund distribution activity.',
        evidence: `${highOutwardMonths.length} month(s) with >15 debit transactions`,
      });
    }

    // ── Returned Transactions
    const totalBounces = monthlyMetrics.reduce((s, m) => s + m.bounceCount, 0);
    if (totalBounces >= 2) {
      flags.push({
        type: 'RETURNED_TRANSACTIONS',
        label: 'Returned / Bounced Payments',
        severity: totalBounces >= 5 ? 'critical' : 'high',
        description: 'Multiple returned or bounced payments indicate potential payment default risk.',
        evidence: `${totalBounces} returned/bounced transaction(s) detected`,
      });
    }

    // ── Account Draining
    const draining = getBehaviour('ACCOUNT_DRAINING');
    if (draining?.detected) {
      flags.push({
        type: 'ACCOUNT_DRAINING',
        label: 'Systematic Account Draining',
        severity: 'critical',
        description: 'Balance consistently drained to near-zero at month-end — strong indicator of financial distress.',
        evidence: draining.evidence,
      });
    }

    return flags;
  }

  // ──────────────────────────────────────────────────────────
  // 8. EVV SCORE CALCULATION (0-100)
  // ──────────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────────
  // 8. 6-COMPONENT EVV SCORE CALCULATION (0-100)
  // ──────────────────────────────────────────────────────────

  compute6ComponentEVV(
    monthlyMetrics: MonthlyStatistics[],
    dailyBalances: DailyBalance[],
    snapshots: SnapshotBalance[],
    transactions: ExtractedTransaction[],
    bankPolicy: BankPolicy = DEFAULT_BANK_POLICIES.DEFAULT,
    coApplicantProfile: CoApplicantProfile = { isRepaymentIncomeContributor: 'YES', verificationStatus: 'FULLY_VERIFIED' },
    riskFlags: RiskFlag[] = [],
  ): EVV6ComponentResult {
    // 1. Identify completed calendar months
    // A month is complete if its daily balances cover the 1st day to the last day
    const completedMonthsSet = new Set<string>();
    const monthsGroup = new Map<string, DailyBalance[]>();
    for (const d of dailyBalances) {
      const m = d.date.slice(0, 7);
      if (!monthsGroup.has(m)) monthsGroup.set(m, []);
      monthsGroup.get(m)!.push(d);
    }

    for (const [m, days] of Array.from(monthsGroup.entries())) {
      const [y, mo] = m.split('-').map(Number);
      const totalDaysInMo = daysInMonth(y, mo);
      const dayNums = new Set(days.map(d => parseInt(d.date.slice(8, 10), 10)));
      if (dayNums.has(1) && dayNums.has(totalDaysInMo)) {
        completedMonthsSet.add(m);
      }
    }

    // Take latest 6 completed months (or available completed months, up to 6)
    let completedMonths = Array.from(completedMonthsSet).sort();
    if (completedMonths.length > 6) {
      completedMonths = completedMonths.slice(-6);
    }

    // Fallback: If no month has 1st to last day fully populated, use the available months (up to 6)
    if (completedMonths.length === 0 && monthlyMetrics.length > 0) {
      completedMonths = monthlyMetrics.map(m => m.month).slice(-6);
    }

    const completedMetrics = monthlyMetrics.filter(m => completedMonths.includes(m.month));
    const completedSnapshots = snapshots.filter(s => completedMonths.includes(s.month));
    const completedDaily = dailyBalances.filter(d => completedMonths.includes(d.date.slice(0, 7)));
    const completedTxs = transactions.filter(t => completedMonths.includes(t.month || t.date.slice(0, 7)));

    const M = bankPolicy.minimumBalanceBenchmark || 5000;
    const strongTarget = bankPolicy.strongBalanceTarget || (10 * M);
    const hardRiskFlags: string[] = [];

    // =========================================================================
    // COMPONENT 1: Average Balance Trend (Max 25 points)
    // =========================================================================
    const monthlySampledAMBs: { month: string; sampledAMB: number; benchmarkMet: boolean }[] = [];
    for (const mo of completedMonths) {
      const moSnaps = completedSnapshots.filter(s => s.month === mo);
      const sampledAMB = moSnaps.length > 0
        ? Math.round(moSnaps.reduce((acc, s) => acc + s.balance, 0) / moSnaps.length)
        : Math.round(completedDaily.filter(d => d.date.startsWith(mo)).reduce((acc, d) => acc + d.balance, 0) / (completedDaily.filter(d => d.date.startsWith(mo)).length || 1));
      monthlySampledAMBs.push({
        month: mo,
        sampledAMB,
        benchmarkMet: sampledAMB >= M,
      });
    }

    const sixMonthSampledAMB = monthlySampledAMBs.length > 0
      ? Math.round(monthlySampledAMBs.reduce((s, m) => s + m.sampledAMB, 0) / monthlySampledAMBs.length)
      : 0;

    const baseScore = Math.round(25 * Math.min(sixMonthSampledAMB / strongTarget, 1));

    // Consistency deduction based on count of months meeting M
    const monthsMeetingBenchmark = monthlySampledAMBs.filter(m => m.benchmarkMet).length;
    let consistencyDeduction = 0;
    if (monthsMeetingBenchmark === 6) consistencyDeduction = 0;
    else if (monthsMeetingBenchmark === 5) consistencyDeduction = 1;
    else if (monthsMeetingBenchmark === 4) consistencyDeduction = 3;
    else if (monthsMeetingBenchmark === 3) consistencyDeduction = 6;
    else consistencyDeduction = 10;

    // Trend deduction (latest half vs previous half)
    let trendPercent = 0;
    let trendDeduction = 0;
    let previous3MAmb = 0;
    let latest3MAmb = 0;
    if (monthlySampledAMBs.length >= 4) {
      const mid = Math.floor(monthlySampledAMBs.length / 2);
      const prevList = monthlySampledAMBs.slice(0, mid);
      const nextList = monthlySampledAMBs.slice(mid);
      previous3MAmb = Math.round(prevList.reduce((s, m) => s + m.sampledAMB, 0) / prevList.length);
      latest3MAmb = Math.round(nextList.reduce((s, m) => s + m.sampledAMB, 0) / nextList.length);
      trendPercent = previous3MAmb > 0 ? ((latest3MAmb - previous3MAmb) / previous3MAmb) * 100 : 0;

      if (trendPercent >= -10) trendDeduction = 0;
      else if (trendPercent >= -24.999) trendDeduction = 2;
      else if (trendPercent >= -39.999) trendDeduction = 5;
      else trendDeduction = 10;
    }

    const comp1Score = Math.max(0, Math.min(25, baseScore - consistencyDeduction - trendDeduction));

    // =========================================================================
    // COMPONENT 2: Minimum-Balance Safety (Max 20 points)
    // =========================================================================
    const sampledLowCount = completedSnapshots.filter(s => s.balance < M).length;
    const sampledLowRatio = completedSnapshots.length > 0 ? (sampledLowCount / completedSnapshots.length) * 100 : 0;
    const dailyLowCount = completedDaily.filter(d => d.balance < M).length;
    const dailyLowRatio = completedDaily.length > 0 ? (dailyLowCount / completedDaily.length) * 100 : 0;
    const finalSafetyRatio = Math.max(sampledLowRatio, dailyLowRatio);

    let comp2Score = 20;
    if (finalSafetyRatio === 0) comp2Score = 20;
    else if (finalSafetyRatio <= 5) comp2Score = 17;
    else if (finalSafetyRatio <= 10) comp2Score = 14;
    else if (finalSafetyRatio <= 20) comp2Score = 8;
    else if (finalSafetyRatio <= 35) comp2Score = 4;
    else comp2Score = 0;

    // Hard Override: Negative balance or overdraft
    const negativeBalanceDetected = dailyBalances.some(d => d.balance < 0) || transactions.some(t => t.balance < 0);
    const overdraftDetected = dailyBalances.some(d => d.balance < 0);
    if (negativeBalanceDetected || overdraftDetected) {
      comp2Score = 0;
      hardRiskFlags.push('Negative balance or unauthorised overdraft detected (Component 2 forced to 0).');
    }

    // =========================================================================
    // COMPONENT 3: Bounce-Free Record (Max 20 points)
    // =========================================================================
    const candidateBounces: { date: string; narration: string; amount: number; linkedFee?: number }[] = [];
    const sortedTxs = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

    for (let i = 0; i < sortedTxs.length; i++) {
      const tx = sortedTxs[i];
      const narr = (tx.narration || '').toLowerCase();
      const isCandidate = BOUNCE_CANDIDATE_KEYWORDS.some(k => narr.includes(k));
      const isExcluded = BOUNCE_EXCLUSION_KEYWORDS.some(k => narr.includes(k));

      if (isCandidate && !isExcluded) {
        // Group adjacent return charge within 2 days as 1 single event
        let linkedFee = 0;
        for (let j = 0; j < sortedTxs.length; j++) {
          if (i === j) continue;
          const other = sortedTxs[j];
          const daysDiff = Math.abs((new Date(other.date).getTime() - new Date(tx.date).getTime()) / 86400000);
          if (daysDiff <= 2) {
            const otherNarr = (other.narration || '').toLowerCase();
            if ((otherNarr.includes('chg') || otherNarr.includes('charge') || otherNarr.includes('fee')) && (otherNarr.includes('ret') || otherNarr.includes('bounce') || otherNarr.includes('dishonor'))) {
              linkedFee = other.debit || other.amount || 0;
            }
          }
        }
        candidateBounces.push({ date: tx.date, narration: tx.narration, amount: tx.debit || tx.amount || 0, linkedFee });
      }
    }

    // De-duplicate candidate bounces that are grouped
    const uniqueBounceEvents: typeof candidateBounces = [];
    for (const cb of candidateBounces) {
      const exists = uniqueBounceEvents.some(u => {
        const diff = Math.abs((new Date(u.date).getTime() - new Date(cb.date).getTime()) / 86400000);
        return diff <= 2 && Math.abs(u.amount - cb.amount) < 100;
      });
      if (!exists) uniqueBounceEvents.push(cb);
    }

    const confirmedBounces = uniqueBounceEvents.length;
    let comp3Score = 20;
    if (confirmedBounces === 0) comp3Score = 20;
    else if (confirmedBounces === 1) comp3Score = 10;
    else if (confirmedBounces === 2) comp3Score = 5;
    else comp3Score = 0;

    const lastTxDate = sortedTxs[sortedTxs.length - 1]?.date ? new Date(sortedTxs[sortedTxs.length - 1].date) : new Date();
    let recentBounceWithin30Days = false;
    let bouncesIn90Days = 0;
    for (const b of uniqueBounceEvents) {
      const bDate = new Date(b.date);
      const daysSince = (lastTxDate.getTime() - bDate.getTime()) / 86400000;
      if (daysSince <= 30) recentBounceWithin30Days = true;
      if (daysSince <= 90) bouncesIn90Days++;
    }

    if (recentBounceWithin30Days) {
      hardRiskFlags.push('Recent returned payment detected within the last 30 days of statement.');
    }
    if (bouncesIn90Days >= 2) {
      hardRiskFlags.push(`${bouncesIn90Days} payment return/bounce events detected in the latest 90 days.`);
    }

    // =========================================================================
    // COMPONENT 4: Verified Financial Inflow Regularity (Max 15 points)
    // =========================================================================
    let comp4Score: number | 'N/A' = 0;
    let recurringMonthsCount = 0;
    let c4BaseScore = 0;
    let verificationCap = 15;
    let verificationCondition = 'Source, recurrence, and eligibility verified';

    const incomeRole = coApplicantProfile.isRepaymentIncomeContributor || 'YES';
    if (incomeRole === 'NO') {
      comp4Score = 'N/A';
      verificationCondition = 'Non-income contributor (co-applicant income not used for FOIR/repayment)';
    } else if (incomeRole === 'UNKNOWN') {
      comp4Score = 0;
      verificationCondition = 'Unknown repayment-income contributor role';
      hardRiskFlags.push('Repayment income contributor role is unconfirmed / unknown.');
    } else {
      // Income Contributor: Check recurring credits across completed months
      for (const mo of completedMonths) {
        const moTxs = completedTxs.filter(t => (t.month || t.date.slice(0, 7)) === mo && t.credit > 0);
        const hasEligibleCredit = moTxs.some(t => {
          const narr = (t.narration || '').toLowerCase();
          const isCash = PHYSICAL_CASH_KEYWORDS.some(k => narr.includes(k));
          const isExcl = ['reversal', 'refund', 'cashback', 'own transfer', 'self transfer', 'loan disb'].some(k => narr.includes(k));
          return !isCash && !isExcl && t.credit >= 5000;
        });
        if (hasEligibleCredit) recurringMonthsCount++;
      }

      if (recurringMonthsCount >= 6) c4BaseScore = 15;
      else if (recurringMonthsCount === 5) c4BaseScore = 13;
      else if (recurringMonthsCount === 4) c4BaseScore = 10;
      else if (recurringMonthsCount === 3) c4BaseScore = 6;
      else c4BaseScore = 0;

      const vStatus = coApplicantProfile.verificationStatus || 'FULLY_VERIFIED';
      if (vStatus === 'FULLY_VERIFIED') verificationCap = 15;
      else if (vStatus === 'PENDING_DOCS') { verificationCap = 10; verificationCondition = 'Statement pattern appears genuine; documents pending'; }
      else if (vStatus === 'UNCLEAR') { verificationCap = 6; verificationCondition = 'Recurring credits exist but source/eligibility unclear'; }
      else { verificationCap = 0; verificationCondition = 'Source not established'; }

      comp4Score = Math.min(c4BaseScore, verificationCap);
    }

    // =========================================================================
    // COMPONENT 5: Cash-Deposit Ratio (Max 10 points)
    // =========================================================================
    const cashDeposits: { date: string; narration: string; amount: number }[] = [];
    let totalCredits = 0;
    let totalCashDeposits = 0;

    for (const tx of completedTxs) {
      if (tx.credit > 0) {
        totalCredits += tx.credit;
        const narr = (tx.narration || '').toLowerCase();
        const isPhysicalCash = PHYSICAL_CASH_KEYWORDS.some(k => narr.includes(k));
        const isExcluded = CASH_EXCLUSIONS.some(k => narr.includes(k));
        if (isPhysicalCash && !isExcluded) {
          totalCashDeposits += tx.credit;
          cashDeposits.push({ date: tx.date, narration: tx.narration, amount: tx.credit });
        }
      }
    }

    const cashRatio = totalCredits > 0 ? (totalCashDeposits / totalCredits) * 100 : 0;
    let comp5Score = 10;
    if (cashRatio < 10) comp5Score = 10;
    else if (cashRatio <= 20) comp5Score = 7;
    else if (cashRatio <= 35) comp5Score = 4;
    else comp5Score = 0;

    // Single cash deposit alert (>= 50,000 or >= 25% avg monthly credits)
    const avgMonthlyCredits = totalCredits / (completedMonths.length || 1);
    const largeCashAlertThreshold = Math.min(bankPolicy.largeCashDepositThreshold, 0.25 * avgMonthlyCredits || 50000);
    const largeCashTxs = cashDeposits.filter(c => c.amount >= largeCashAlertThreshold);
    if (largeCashTxs.length > 0) {
      hardRiskFlags.push(`${largeCashTxs.length} large physical cash deposit(s) (≥₹${largeCashAlertThreshold.toLocaleString('en-IN')}) detected.`);
    }

    // =========================================================================
    // COMPONENT 6: Withdrawal Discipline (Max 10 points)
    // =========================================================================
    const consecutiveDrops: { fromDate: string; toDate: string; fromBal: number; toBal: number; dropPercent: number; severity: string }[] = [];
    let moderateDropsCount = 0;
    let severeDropsCount = 0;
    let criticalDropsCount = 0;

    for (let i = 1; i < completedSnapshots.length; i++) {
      const prevSnap = completedSnapshots[i - 1];
      const currSnap = completedSnapshots[i];
      if (prevSnap.balance >= M && prevSnap.balance > currSnap.balance) {
        const dropPercent = ((prevSnap.balance - currSnap.balance) / prevSnap.balance) * 100;
        let severity = 'NORMAL';
        if (dropPercent >= 90) { severity = 'CRITICAL'; criticalDropsCount++; }
        else if (dropPercent >= 75) { severity = 'SEVERE'; severeDropsCount++; }
        else if (dropPercent >= 50) { severity = 'MODERATE'; moderateDropsCount++; }

        if (severity !== 'NORMAL') {
          consecutiveDrops.push({
            fromDate: prevSnap.date,
            toDate: currSnap.date,
            fromBal: prevSnap.balance,
            toBal: currSnap.balance,
            dropPercent: Math.round(dropPercent),
            severity,
          });
        }
      }
    }

    const largeCreditThreshold = Math.max(bankPolicy.largeCreditAbsoluteThreshold || 25000, 0.25 * avgMonthlyCredits);
    const passThroughEvents: { creditDate: string; creditAmount: number; debitedAmount: number; ratio: number }[] = [];

    for (let i = 0; i < completedTxs.length; i++) {
      const tx = completedTxs[i];
      if (tx.credit >= largeCreditThreshold) {
        const creditDate = new Date(tx.date);
        let debitsInWindow = 0;
        for (let j = i + 1; j < completedTxs.length; j++) {
          const nextTx = completedTxs[j];
          const daysDiff = (new Date(nextTx.date).getTime() - creditDate.getTime()) / 86400000;
          if (daysDiff > bankPolicy.rapidOutflowDays) break;
          if (nextTx.debit > 0) {
            debitsInWindow += nextTx.debit;
          }
        }
        const outflowRatio = (debitsInWindow / tx.credit) * 100;
        if (outflowRatio >= (bankPolicy.rapidOutflowRatio * 100)) {
          passThroughEvents.push({
            creditDate: tx.date,
            creditAmount: tx.credit,
            debitedAmount: debitsInWindow,
            ratio: Math.round(outflowRatio),
          });
        }
      }
    }

    let dropsScore = 10;
    if (criticalDropsCount >= 1) dropsScore = 3;
    else if (severeDropsCount >= 2) dropsScore = 4;
    else if (severeDropsCount === 1 || moderateDropsCount >= 2) dropsScore = 6;
    else if (moderateDropsCount === 1) dropsScore = 8;
    else dropsScore = 10;

    let passThroughScore = 10;
    if (passThroughEvents.length >= 3) passThroughScore = 0;
    else if (passThroughEvents.length === 2) passThroughScore = 1;
    else if (passThroughEvents.length === 1) passThroughScore = 4;
    else passThroughScore = 10;

    const comp6Score = Math.min(dropsScore, passThroughScore);

    // =========================================================================
    // FINAL TOTAL SCORE & STATUS BAND
    // =========================================================================
    const rawTotalScore = comp1Score + comp2Score + comp3Score + (comp4Score === 'N/A' ? 0 : comp4Score) + comp5Score + comp6Score;
    const finalTotalScore = comp4Score === 'N/A' ? Math.min(100, Math.round((rawTotalScore / 85) * 100)) : Math.min(100, rawTotalScore);

    const statusBand: 'Green' | 'Amber' | 'Red' =
      finalTotalScore >= 80 ? 'Green' :
      finalTotalScore >= 60 ? 'Amber' : 'Red';

    const mandatoryDisclaimer = 'Internal EVV assessment — not an official bank sanction or automatic loan decision.';

    return {
      component1: {
        name: 'Average Balance Trend',
        maxScore: 25,
        score: comp1Score,
        sixMonthSampledAMB,
        strongBalanceTarget: strongTarget,
        baseScore,
        consistencyDeduction,
        monthsMeetingBenchmark,
        trendDeduction,
        trendPercent: Math.round(trendPercent * 10) / 10,
        previous3MAmb,
        latest3MAmb,
        monthlySampledAMBs,
        evidence: `6M AMB: ₹${sixMonthSampledAMB.toLocaleString('en-IN')} (Target ₹${strongTarget.toLocaleString('en-IN')}) | Consistency: ${monthsMeetingBenchmark}/${monthlySampledAMBs.length} mos | Trend: ${trendPercent >= 0 ? '+' : ''}${trendPercent.toFixed(1)}%`,
        formulaExplanation: `Base Score = round(25 × min(${sixMonthSampledAMB}/${strongTarget}, 1)) = ${baseScore}. Consistency Deduction = ${consistencyDeduction}. Trend Deduction = ${trendDeduction}. Score = max(0, ${baseScore} - ${consistencyDeduction} - ${trendDeduction}) = ${comp1Score}/25.`,
      },
      component2: {
        name: 'Minimum-Balance Safety',
        maxScore: 20,
        score: comp2Score,
        benchmarkM: M,
        sampledLowRatio: Math.round(sampledLowRatio * 10) / 10,
        dailyLowRatio: Math.round(dailyLowRatio * 10) / 10,
        finalSafetyRatio: Math.round(finalSafetyRatio * 10) / 10,
        negativeBalanceDetected,
        overdraftDetected,
        lowBalanceDaysCount: dailyLowCount,
        totalDaysAnalysed: completedDaily.length,
        evidence: `Benchmark M: ₹${M.toLocaleString('en-IN')} | Final Safety Ratio: ${finalSafetyRatio.toFixed(1)}% (Sampled Low: ${sampledLowRatio.toFixed(1)}%, Daily Low: ${dailyLowRatio.toFixed(1)}%)`,
        formulaExplanation: `Final Safety Ratio = max(${sampledLowRatio.toFixed(1)}%, ${dailyLowRatio.toFixed(1)}%) = ${finalSafetyRatio.toFixed(1)}%. Score tier = ${comp2Score}/20.${negativeBalanceDetected ? ' Negative balance detected: 0 pts override.' : ''}`,
      },
      component3: {
        name: 'Bounce-Free Record',
        maxScore: 20,
        score: comp3Score,
        confirmedBounces,
        candidateCount: candidateBounces.length,
        recentBounceWithin30Days,
        bouncesIn90Days,
        bounceEvents: uniqueBounceEvents,
        evidence: `${confirmedBounces} confirmed bounce/dishonour event(s) detected (${bouncesIn90Days} in last 90 days)`,
        formulaExplanation: `Evaluated all statement dates for NACH/ECS/EMI/Cheque return keywords. Unique grouped events: ${confirmedBounces}. Points: ${comp3Score}/20.`,
      },
      component4: {
        name: 'Verified Financial Inflow Regularity',
        maxScore: 15,
        score: comp4Score,
        isRepaymentIncomeContributor: incomeRole,
        profileType: coApplicantProfile.declaredIncomeType || 'SALARIED',
        recurringMonthsCount,
        baseScore: c4BaseScore,
        verificationCap,
        verificationCondition,
        evidence: incomeRole === 'NO'
          ? 'N/A — Non-income contributor (primary earning co-applicant assessed separately)'
          : `${recurringMonthsCount}/${completedMonths.length} recurring months verified. Cap: ${verificationCap}/15. Condition: ${verificationCondition}`,
        formulaExplanation: incomeRole === 'NO'
          ? 'Component 4 marked N/A. Scaled over 85 to 100.'
          : `Recurrence Score: ${c4BaseScore}/15, Verification Cap: ${verificationCap}/15. Score: min(${c4BaseScore}, ${verificationCap}) = ${comp4Score}/15.`,
      },
      component5: {
        name: 'Cash-Deposit Ratio',
        maxScore: 10,
        score: comp5Score,
        totalCashDeposits,
        totalCredits,
        cashRatio: Math.round(cashRatio * 10) / 10,
        largeCashDeposits: largeCashTxs,
        evidence: `Cash Deposits: ₹${totalCashDeposits.toLocaleString('en-IN')} / Total Credits: ₹${totalCredits.toLocaleString('en-IN')} (${cashRatio.toFixed(1)}%)`,
        formulaExplanation: `Cash Deposit Ratio = (${totalCashDeposits}/${totalCredits}) × 100 = ${cashRatio.toFixed(1)}%. Score = ${comp5Score}/10.${largeCashTxs.length > 0 ? ` ${largeCashTxs.length} large cash deposit(s) flagged.` : ''}`,
      },
      component6: {
        name: 'Withdrawal Discipline',
        maxScore: 10,
        score: comp6Score,
        consecutiveDrops,
        passThroughEvents,
        evidence: `${consecutiveDrops.length} sharp balance drop(s) (Mod: ${moderateDropsCount}, Sev: ${severeDropsCount}, Crit: ${criticalDropsCount}) | ${passThroughEvents.length} rapid pass-through event(s)`,
        formulaExplanation: `Drop Score: ${dropsScore}/10, Pass-Through Score: ${passThroughScore}/10. Final Component 6 = min(${dropsScore}, ${passThroughScore}) = ${comp6Score}/10.`,
      },
      bankPolicy,
      rawTotalScore,
      finalTotalScore,
      statusBand,
      hardRiskFlags,
      mandatoryDisclaimer,
    };
  }

  computeEVVScore(
    monthlyMetrics: MonthlyStatistics[],
    behaviours: FinancialBehaviour[],
    riskFlags: RiskFlag[],
    dailyBalances: DailyBalance[] = [],
    snapshots: SnapshotBalance[] = [],
    transactions: ExtractedTransaction[] = [],
    bankPolicy: BankPolicy = DEFAULT_BANK_POLICIES.DEFAULT,
    coApplicantProfile: CoApplicantProfile = { isRepaymentIncomeContributor: 'YES', verificationStatus: 'FULLY_VERIFIED' },
  ): EVVScore {
    if (monthlyMetrics.length === 0) {
      return {
        score: 0,
        grade: 'D',
        gradeLabel: 'Very Poor',
        statusBand: 'Red',
        breakdown: [],
        summary: 'Insufficient data to compute EVV score',
      };
    }

    // Run the authoritative 6-Component EVV engine
    const evv6 = this.compute6ComponentEVV(
      monthlyMetrics,
      dailyBalances,
      snapshots,
      transactions,
      bankPolicy,
      coApplicantProfile,
      riskFlags,
    );

    const breakdown: EVVWeightBreakdown[] = [
      {
        component: 'Component 1: Average Balance Trend',
        weight: 0.25,
        rawScore: Math.round((evv6.component1.score / 25) * 100),
        weightedScore: evv6.component1.score,
        evidence: evv6.component1.evidence,
        maxPoints: 25,
      },
      {
        component: 'Component 2: Minimum-Balance Safety',
        weight: 0.20,
        rawScore: Math.round((evv6.component2.score / 20) * 100),
        weightedScore: evv6.component2.score,
        evidence: evv6.component2.evidence,
        maxPoints: 20,
      },
      {
        component: 'Component 3: Bounce-Free Record',
        weight: 0.20,
        rawScore: Math.round((evv6.component3.score / 20) * 100),
        weightedScore: evv6.component3.score,
        evidence: evv6.component3.evidence,
        maxPoints: 20,
      },
      {
        component: 'Component 4: Verified Inflow Regularity',
        weight: 0.15,
        rawScore: evv6.component4.score === 'N/A' ? 100 : Math.round((evv6.component4.score / 15) * 100),
        weightedScore: evv6.component4.score === 'N/A' ? 0 : evv6.component4.score,
        evidence: evv6.component4.evidence,
        maxPoints: 15,
      },
      {
        component: 'Component 5: Cash-Deposit Ratio',
        weight: 0.10,
        rawScore: Math.round((evv6.component5.score / 10) * 100),
        weightedScore: evv6.component5.score,
        evidence: evv6.component5.evidence,
        maxPoints: 10,
      },
      {
        component: 'Component 6: Withdrawal Discipline',
        weight: 0.10,
        rawScore: Math.round((evv6.component6.score / 10) * 100),
        weightedScore: evv6.component6.score,
        evidence: evv6.component6.evidence,
        maxPoints: 10,
      },
    ];

    const totalScore = evv6.finalTotalScore;
    const grade =
      totalScore >= 90 ? 'A+' :
      totalScore >= 80 ? 'A' :
      totalScore >= 65 ? 'B' :
      totalScore >= 50 ? 'C' : 'D';

    const gradeLabel =
      grade === 'A+' ? 'Excellent' :
      grade === 'A'  ? 'Good' :
      grade === 'B'  ? 'Average' :
      grade === 'C'  ? 'Below Average' : 'Poor';

    return {
      score: totalScore,
      grade,
      gradeLabel,
      statusBand: evv6.statusBand,
      breakdown,
      summary: `${gradeLabel} financial profile (${evv6.statusBand} Band, ${totalScore}/100). C1=${evv6.component1.score}/25, C2=${evv6.component2.score}/20, C3=${evv6.component3.score}/20, C4=${evv6.component4.score}/15, C5=${evv6.component5.score}/10, C6=${evv6.component6.score}/10.`,
      evv6Components: evv6,
    };
  }

  // ──────────────────────────────────────────────────────────
  // 9. UNDERWRITING DECISION
  // ──────────────────────────────────────────────────────────

  generateUnderwritingDecision(
    evvScore: EVVScore,
    riskFlags: RiskFlag[],
    behaviours: FinancialBehaviour[],
    monthlyMetrics: MonthlyStatistics[],
    evv6Components?: EVV6ComponentResult,
  ): UnderwritingDecision {
    const criticalFlags = riskFlags.filter(f => f.severity === 'critical');
    const highFlags = riskFlags.filter(f => f.severity === 'high');
    const hardRiskFlags = evv6Components?.hardRiskFlags || [];
    const score = evvScore.score;
    const statusBand = evv6Components?.statusBand || (score >= 80 ? 'Green' : score >= 60 ? 'Amber' : 'Red');

    const reasons: string[] = [];
    const conditions: string[] = [];
    const supportingEvidence: string[] = [];

    // Score & policy context
    supportingEvidence.push(`Total EVV Score: ${score}/100 (Status: ${statusBand}, Grade: ${evvScore.grade} — ${evvScore.gradeLabel})`);
    if (evv6Components) {
      supportingEvidence.push(
        `6-Component Scores: C1(Trend)=${evv6Components.component1.score}/25, ` +
        `C2(Safety)=${evv6Components.component2.score}/20, ` +
        `C3(Bounces)=${evv6Components.component3.score}/20, ` +
        `C4(Inflow)=${evv6Components.component4.score}/15, ` +
        `C5(Cash)=${evv6Components.component5.score}/10, ` +
        `C6(Discipline)=${evv6Components.component6.score}/10`
      );
      supportingEvidence.push(`Bank Benchmark M: ₹${evv6Components.bankPolicy.minimumBalanceBenchmark.toLocaleString('en-IN')}`);
    }

    // Hard-risk triggers force MANUAL REVIEW, but never automatic rejection
    if (hardRiskFlags.length > 0) {
      reasons.push(`${hardRiskFlags.length} Hard Risk Trigger(s) require underwriter review:`);
      hardRiskFlags.forEach(f => reasons.push(`• ${f}`));
      conditions.push('Underwriter to review flagged events, verify source documents, and obtain manager override if eligible.');
      return {
        decision: 'MANUAL_REVIEW',
        decisionLabel: 'Manual Review Required (Hard Risk Override)',
        confidence: 'HIGH',
        reasons,
        conditions,
        supportingEvidence,
        riskLevel: 'HIGH',
      };
    }

    // Critical fraud/tampering flags or critically low score
    if (criticalFlags.length >= 2 || score < 30) {
      reasons.push(score < 30 ? `EVV score ${score}/100 is below minimum threshold.` : `${criticalFlags.length} critical statement risks detected.`);
      criticalFlags.forEach(f => reasons.push(`• ${f.label}: ${f.evidence}`));
      return {
        decision: 'REJECT',
        decisionLabel: 'Reject',
        confidence: 'HIGH',
        reasons,
        supportingEvidence,
        riskLevel: 'CRITICAL',
      };
    }

    // APPROVE conditions (Green Band 80-100)
    if (score >= 80 && statusBand === 'Green' && criticalFlags.length === 0 && highFlags.length === 0) {
      reasons.push(`Strong EVV score of ${score}/100 (${statusBand} Band, Grade ${evvScore.grade})`);
      reasons.push('Demonstrates consistent balance maintenance and clean payment record meeting bank benchmark.');
      return {
        decision: 'APPROVE',
        decisionLabel: 'Approve',
        confidence: 'HIGH',
        reasons,
        supportingEvidence,
        riskLevel: 'LOW',
      };
    }

    // APPROVE WITH CONDITIONS (Amber Band 60-79)
    if (score >= 60 && criticalFlags.length === 0) {
      reasons.push(`Satisfactory EVV score of ${score}/100 (${statusBand} Band) within acceptable risk tolerance.`);
      if (highFlags.length > 0) {
        conditions.push(`Provide satisfactory explanation for: ${highFlags.map(f => f.label).join(', ')}`);
      }
      if (evv6Components && evv6Components.component2.score < 14) {
        conditions.push(`Frequent low-balance periods (Safety Ratio: ${evv6Components.component2.finalSafetyRatio}%). Review alternative liquidity proof.`);
      }
      if (evv6Components && evv6Components.component5.score < 7) {
        conditions.push(`Cash deposit ratio is ${evv6Components.component5.cashRatio}%. Provide business receipts or source declaration.`);
      }
      return {
        decision: 'APPROVE_WITH_CONDITIONS',
        decisionLabel: 'Approve with Conditions',
        confidence: 'MEDIUM',
        reasons,
        conditions,
        supportingEvidence,
        riskLevel: 'MEDIUM',
      };
    }

    // MANUAL REVIEW (default / Red < 60)
    reasons.push(`EVV score of ${score}/100 (${statusBand} Band) requires manual underwriting evaluation.`);
    highFlags.forEach(f => reasons.push(`• ${f.label}: ${f.evidence}`));
    return {
      decision: 'MANUAL_REVIEW',
      decisionLabel: 'Manual Review Required',
      confidence: 'LOW',
      reasons,
      conditions,
      supportingEvidence,
      riskLevel: 'HIGH',
    };
  }

  // ──────────────────────────────────────────────────────────
  // 10. FULL EVV ORCHESTRATION
  // ──────────────────────────────────────────────────────────

  async computeFullEvv(
    fileBuffer: Buffer,
    mimetype: string,
    originalName?: string,
    seed?: string,
    bankPolicyInput?: BankPolicy,
    coApplicantProfileInput?: CoApplicantProfile,
  ): Promise<EVVReport> {
    this.logger.log(`[EVV Full] Starting full 6-component EVV computation for ${originalName}`);

    const bankPolicy = bankPolicyInput || DEFAULT_BANK_POLICIES.DEFAULT;
    const coApplicantProfile = coApplicantProfileInput || { isRepaymentIncomeContributor: 'YES', verificationStatus: 'FULLY_VERIFIED' };

    // Step 1: Extract
    const rawTransactions = await this.extractTransactions(fileBuffer, mimetype, originalName, seed);

    if (rawTransactions.length === 0) {
      return this.buildFailedReport('No transactions could be extracted from the statement.');
    }

    const transactions = rawTransactions.map(tx => ({
      ...tx,
      month: tx.date.slice(0, 7),
    }));

    // Step 2: Validate
    const openingBalance = 0;
    const closingBalance = 0;
    const validation = this.validateExtractedData(transactions, openingBalance, closingBalance);

    if (!validation.isValid && transactions.length < 3) {
      return this.buildFailedReport(`Validation failed: ${validation.errors.join('; ')}`);
    }

    // Step 3: Daily balances
    const dailyBalances = this.reconstructDailyBalances(transactions, openingBalance);

    // Step 4: Snapshots (Fixed dates [1, 5, 10, 15, 20, 25] as standard)
    const snapshots = this.calculateSnapshots(dailyBalances, bankPolicy.fixedDates || [1, 5, 10, 15, 20, 25]);

    // Step 5: Monthly metrics
    const monthlyMetrics = this.calculateMonthlyMetrics(dailyBalances, transactions, snapshots);

    // Step 6: Behaviours
    const behaviours = this.detectFinancialBehaviour(transactions, monthlyMetrics);

    // Step 7: Risk flags
    const riskFlags = this.detectRiskFlags(transactions, behaviours, monthlyMetrics);

    // Step 8: 6-Component EVV Score
    const evvScore = this.computeEVVScore(
      monthlyMetrics,
      behaviours,
      riskFlags,
      dailyBalances,
      snapshots,
      transactions,
      bankPolicy,
      coApplicantProfile,
    );

    // Step 9: Underwriting decision
    const underwritingDecision = this.generateUnderwritingDecision(
      evvScore,
      riskFlags,
      behaviours,
      monthlyMetrics,
      evvScore.evv6Components,
    );

    // Step 10: Overall EVV balance (average of all snapshots)
    const overallEvv = snapshots.length > 0
      ? Math.round(snapshots.reduce((s, b) => s + b.balance, 0) / snapshots.length)
      : 0;

    // Period
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    const period = sorted.length > 0
      ? { from: formatPeriodDate(sorted[0].date), to: formatPeriodDate(sorted[sorted.length - 1].date) }
      : null;

    // Legacy monthly_evv (backward compat)
    const monthly_evv: EvvMonthBreakdown[] = monthlyMetrics.map(m => ({
      month: m.month,
      points: m.snapshotPoints,
      avg: m.snapshotAvg,
      min: m.snapshotMin,
      max: m.snapshotMax,
      evv: m.snapshotAvg,
      totalCredits: m.totalCredits,
      totalDebits: m.totalDebits,
      transactionCount: m.transactionCount,
      creditCount: m.creditCount,
      debitCount: m.debitCount,
    }));

    const totalSnapshots = snapshots.length;

    return {
      bankName: bankPolicy.bankName,
      accountNumber: undefined,
      accountHolder: undefined,
      ifsc: undefined,
      statementPeriod: period
        ? { from: sorted[0].date, to: sorted[sorted.length - 1].date }
        : undefined,
      openingBalance,
      closingBalance,

      transactions,
      totalTransactions: transactions.length,

      validation,
      dailyBalances,
      snapshots,
      monthlyMetrics,
      behaviours,
      riskFlags,

      evvScore,
      evv6Components: evvScore.evv6Components,
      bankPolicy,
      overallEvv,
      period,
      status: evvScore.evv6Components?.hardRiskFlags && evvScore.evv6Components.hardRiskFlags.length > 0 ? 'MANUAL_REVIEW' : 'COMPUTED',
      disclaimer: evvScore.evv6Components?.mandatoryDisclaimer,

      underwritingDecision,
      monthly_evv,
      totalSnapshots,
    };
  }

  private buildFailedReport(reason: string): EVVReport {
    return {
      openingBalance: 0,
      closingBalance: 0,
      transactions: [],
      totalTransactions: 0,
      validation: { isValid: false, confidenceScore: 0, checks: [], warnings: [], errors: [reason] },
      dailyBalances: [],
      snapshots: [],
      monthlyMetrics: [],
      behaviours: [],
      riskFlags: [],
      evvScore: { score: 0, grade: 'D', gradeLabel: 'Poor', breakdown: [], summary: reason },
      overallEvv: 0,
      period: null,
      status: 'MANUAL_REVIEW',
      underwritingDecision: {
        decision: 'MANUAL_REVIEW',
        decisionLabel: 'Manual Review Required',
        confidence: 'LOW',
        reasons: [reason],
        supportingEvidence: [],
        riskLevel: 'HIGH',
      },
      monthly_evv: [],
      totalSnapshots: 0,
    };
  }

  // ──────────────────────────────────────────────────────────
  // LEGACY: computeEvv (backward compat — still used by simple path)
  // ──────────────────────────────────────────────────────────

  computeEvv(transactions: Transaction[]): EvvResults {
    if (!transactions || transactions.length === 0) {
      return { overall_evv: 0, monthly_evv: [], totalSnapshots: 0, totalTransactions: 0, period: null, status: 'FAILED' };
    }

    try {
      const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const monthsSet = new Set<string>();
      sorted.forEach(tx => { if (/^\d{4}-\d{2}-\d{2}$/.test(tx.date)) monthsSet.add(tx.date.slice(0, 7)); });
      const months = Array.from(monthsSet).sort();

      if (months.length === 0) {
        return { overall_evv: 0, monthly_evv: [], totalSnapshots: 0, totalTransactions: transactions.length, period: null, status: 'FAILED' };
      }

      const firstDate = sorted[0].date;
      const lastDate = sorted[sorted.length - 1].date;
      const monthlyBreakdown: EvvMonthBreakdown[] = [];
      let totalEvvSum = 0;
      let totalSnapshots = 0;

      const getBalanceOnDate = (targetDateStr: string): number => {
        const targetTime = new Date(targetDateStr).getTime();
        let lastTx: Transaction | null = null;
        for (const tx of sorted) {
          if (new Date(tx.date).getTime() <= targetTime) lastTx = tx;
          else break;
        }
        if (lastTx) return lastTx.balance;
        if (sorted.length > 0) {
          const f = sorted[0];
          return Math.max(0, f.balance + (f.type === 'credit' ? -f.amount : f.amount));
        }
        return 0;
      };

      for (const m of months) {
        const snapshotDays = [1, 10, 15, 20, 25];
        const snapshotBalances = snapshotDays.map(day => {
          const dayStr = String(day).padStart(2, '0');
          return getBalanceOnDate(`${m}-${dayStr}`);
        });
        const points = snapshotBalances.length;
        const avg = Math.round(snapshotBalances.reduce((s, b) => s + b, 0) / points);
        const min = Math.min(...snapshotBalances);
        const max = Math.max(...snapshotBalances);
        totalSnapshots += points;
        monthlyBreakdown.push({ month: m, points, avg, min, max, evv: avg });
        totalEvvSum += avg;
      }

      const overallEvv = Math.round(totalEvvSum / months.length);
      return {
        overall_evv: overallEvv,
        monthly_evv: monthlyBreakdown,
        totalSnapshots,
        totalTransactions: transactions.length,
        period: { from: formatPeriodDate(firstDate), to: formatPeriodDate(lastDate) },
        status: 'COMPUTED',
      };
    } catch (err: any) {
      this.logger.error(`[EVV Legacy] computeEvv error: ${err.message}`);
      return { overall_evv: 0, monthly_evv: [], totalSnapshots: 0, totalTransactions: 0, period: null, status: 'FAILED' };
    }
  }

  // ──────────────────────────────────────────────────────────
  // MOCK TRANSACTION GENERATOR (dev / no API key)
  // ──────────────────────────────────────────────────────────

  generateMockTransactions(fileName?: string, seed?: string): ExtractedTransaction[] {
    let numMonths = 6;
    const name = (fileName || '').toLowerCase();
    const match = name.match(/(\d+)\s*month/);
    if (match?.[1]) numMonths = parseInt(match[1], 10);
    else if (name.includes('3')) numMonths = 3;
    else if (name.includes('12')) numMonths = 12;

    const randSeed = seed || fileName || String(Math.random());
    const rand = this.getSeededRandom(randSeed);
    this.logger.log(`[EVV Mock] Generating ${numMonths} months with seed: ${randSeed}`);

    const currentDate = new Date();
    let balance = Math.round(30000 + rand() * 70000);
    const txs: ExtractedTransaction[] = [];

    const channels = ['UPI', 'NEFT', 'RTGS', 'IMPS', 'CASH', 'CHEQUE'] as const;
    const salaryNarrations = ['SALARY CREDIT', 'PAYROLL CR', 'SAL/EMP001'];
    const debitNarrations = ['UPI/FOOD DELIVERY', 'NEFT/EMI DEBIT', 'ATM WD', 'UPI/RENT', 'UPI/UTILITY'];
    const creditNarrations = ['NEFT/BUSINESS', 'UPI/FREELANCE', 'IMPS/TRANSFER'];

    for (let i = numMonths - 1; i >= 0; i--) {
      const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const y = d.getFullYear();
      const mo = d.getMonth();
      const monthStr = `${y}-${String(mo + 1).padStart(2, '0')}`;

      // Salary credit (1st week)
      const salaryAmt = Math.round(30000 + rand() * 20000);
      balance += salaryAmt;
      txs.push({
        date: `${monthStr}-03`, narration: salaryNarrations[Math.floor(rand() * salaryNarrations.length)],
        debit: 0, credit: salaryAmt, balance, amount: salaryAmt, type: 'credit',
        channel: 'NEFT', month: monthStr,
      });

      // EMI debit
      const emiAmt = Math.round(8000 + rand() * 5000);
      balance -= emiAmt;
      txs.push({
        date: `${monthStr}-05`, narration: 'EMI/LOAN DEBIT/NACH',
        debit: emiAmt, credit: 0, balance, amount: emiAmt, type: 'debit',
        channel: 'NACH', month: monthStr,
      });

      // Various credits and debits mid-month
      for (let d2 = 0; d2 < 3 + Math.floor(rand() * 3); d2++) {
        const isCredit = rand() > 0.55;
        const amt = Math.round(1000 + rand() * 12000);
        const day = String(8 + Math.floor(rand() * 12)).padStart(2, '0');
        if (isCredit) {
          balance += amt;
          txs.push({
            date: `${monthStr}-${day}`,
            narration: creditNarrations[Math.floor(rand() * creditNarrations.length)],
            debit: 0, credit: amt, balance, amount: amt, type: 'credit',
            channel: channels[Math.floor(rand() * channels.length)], month: monthStr,
          });
        } else {
          balance -= amt;
          txs.push({
            date: `${monthStr}-${day}`,
            narration: debitNarrations[Math.floor(rand() * debitNarrations.length)],
            debit: amt, credit: 0, balance, amount: amt, type: 'debit',
            channel: channels[Math.floor(rand() * channels.length)], month: monthStr,
          });
        }
      }

      // Month-end debit
      const endDebit = Math.round(2000 + rand() * 6000);
      balance -= endDebit;
      txs.push({
        date: `${monthStr}-28`, narration: 'UPI/MISC PAYMENT',
        debit: endDebit, credit: 0, balance, amount: endDebit, type: 'debit',
        channel: 'UPI', month: monthStr,
      });
    }

    return txs.sort((a, b) => a.date.localeCompare(b.date));
  }

  private getSeededRandom(seed: string) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
    return function () {
      h = Math.imul(h ^ h >>> 16, 2246822507) | 0;
      h = Math.imul(h ^ h >>> 13, 3266489909) | 0;
      return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
  }
}
