/**
 * ============================================================================
 * Production-Quality Internal EVV (Bank Statement Health / Eligibility Verification)
 * Calculation Engine for Vidya Loans Staff Portal
 *
 * Compliance Notice:
 * Internal EVV assessment only. Final lending decision is subject to lender
 * policy, independent credit appraisal, verified income, FOIR/EMI analysis,
 * bureau checks, documents, collateral where applicable, and manual review.
 *
 * Sampled-date balance averages must strictly be labeled "Internal Sampled AMB"
 * (never "official bank AMB").
 * ============================================================================
 */

export const MANDATORY_EVV_DISCLAIMER =
  "Internal EVV assessment only. Final lending decision is subject to lender policy, independent credit appraisal, verified income, FOIR/EMI analysis, bureau checks, documents, collateral where applicable, and manual review.";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Types & Data Contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface BankPolicy {
  id: string;
  bankName: string;
  accountType: string;
  minimumBalanceBenchmark: number; // M, e.g. 5000, 2000, 1000
  strongBalanceTarget: number;     // T, e.g. 50000 (defaults to 10 * M if not supplied)
  analysisMonths: number;          // default 6
  defaultDateMode: 'FIXED' | 'CUSTOM';
  fixedDays: number[];             // default [1, 5, 10, 15, 20, 25]
  fixedDates?: number[];           // backwards-compatible alias
  largeCashDepositThreshold: number; // default 50000
  largeCreditAbsoluteThreshold: number; // default 25000
  largeCreditMonthlyRatio: number; // default 0.25 (25% of avg monthly credits)
  largeCreditMonthlyRatioThreshold?: number; // backwards-compatible alias
  rapidOutflowDays: number;        // default 3
  rapidOutflowRatio: number;       // default 0.70 (70%)
  policyVersion: string;
  effectiveFrom: string;
}

export type ProfileType =
  | 'SALARIED'
  | 'SELF_EMPLOYED'
  | 'PENSIONER'
  | 'RENTAL_INCOME'
  | 'AGRICULTURAL'
  | 'FREELANCER_PROFESSIONAL'
  | 'FAMILY_SUPPORTED'
  | 'RETIRED_ANNUITY_INTEREST'
  | 'HOMEMAKER_NON_INCOME_CONTRIBUTOR'
  | 'UNKNOWN';

export interface FinancialProfile {
  profileType: ProfileType;
  isRepaymentIncomeContributor: 'YES' | 'NO' | 'UNKNOWN';
  declaredMonthlyIncome?: number;
  declaredEmployerOrBusiness?: string;
  primaryEarningCoApplicantId?: string;
  supportingDocuments: string[];
}

export interface NormalizedTransaction {
  id: string;
  date: string; // YYYY-MM-DD local calendar date
  descriptionRaw: string;
  descriptionNormalized: string;
  debitPaise: bigint;
  creditPaise: bigint;
  runningBalancePaise?: bigint;
  sourceOrder: number;
  reference?: string;
}

export interface DailyBalance {
  date: string; // YYYY-MM-DD
  closingBalancePaise: bigint;
  hasTransaction: boolean;
  lastTransactionId?: string;
}

export interface SelectedBalanceSample {
  month: string; // YYYY-MM
  requestedDay: number;
  targetDate: string; // YYYY-MM-DD
  actualDate: string; // YYYY-MM-DD
  closingBalancePaise: bigint;
  closingBalanceRupees: number;
  lastSourceTransactionId?: string;
}

export interface MonthlySampledAMB {
  month: string; // YYYY-MM
  monthLabel: string; // e.g. "March 2025"
  samplesCount: number;
  sampleBalancesRupees: number[];
  monthlySampledAMBPaise: bigint;
  monthlySampledAMBRupees: number;
  benchmarkMet: boolean;
  dailyAMBRupees: number;
  creditsRupees: number;
  debitsRupees: number;
  cashDepositsRupees: number;
  confirmedBouncesCount: number;
}

export type BounceClassification = 'CONFIRMED_BOUNCE' | 'REVIEW_REQUIRED' | 'NOT_A_BOUNCE';

export interface BounceCandidate {
  id: string;
  date: string;
  narration: string;
  amountPaise: bigint;
  amountRupees: number;
  linkedFeePaise?: bigint;
  classification: BounceClassification;
  notes?: string;
  matchedKeywords: string[];
}

export type CashClassification = 'CONFIRMED_CASH_DEPOSIT' | 'REVIEW_REQUIRED' | 'NOT_CASH_DEPOSIT';

export interface CashCandidate {
  id: string;
  date: string;
  narration: string;
  amountPaise: bigint;
  amountRupees: number;
  classification: CashClassification;
  notes?: string;
  isLargeDepositAlert: boolean;
}

export type PassThroughClassification =
  | 'EXPLAINED_ELIGIBLE'
  | 'OWN_ACCOUNT_TRANSFER'
  | 'DOCUMENTED_TUITION_OR_HOUSEHOLD_EXPENSE'
  | 'DOCUMENTED_BUSINESS_EXPENSE'
  | 'MEDICAL_OR_EXCEPTIONAL'
  | 'UNEXPLAINED'
  | 'SUSPECTED_TEMPORARY_FUNDING';

export interface PassThroughCandidate {
  id: string;
  creditDate: string;
  creditAmountRupees: number;
  debitWindowSumRupees: number;
  outflowRatio: number;
  narration: string;
  classification: PassThroughClassification;
  notes?: string;
}

export interface BalanceDropEvent {
  fromMonth: string;
  fromDate: string;
  toDate: string;
  fromBalanceRupees: number;
  toBalanceRupees: number;
  dropPercent: number;
  severity: 'MODERATE_DROP' | 'SEVERE_DROP' | 'CRITICAL_DROP';
}

export interface Component1Result {
  name: string;
  maxScore: 25;
  score: number;
  sixMonthSampledAMBPaise: bigint;
  sixMonthSampledAMBRupees: number;
  strongBalanceTargetRupees: number;
  basePoints: number;
  monthsMeetingBenchmarkCount: number;
  consistencyDeduction: number;
  previous3MAMBRupees: number;
  latest3MAMBRupees: number;
  trendPercent: number;
  trendDeduction: number;
  monthlyBreakdown: MonthlySampledAMB[];
  formulaExplanation: string;
}

export interface Component2Result {
  name: string;
  maxScore: 20;
  score: number;
  benchmarkMRupees: number;
  sampledLowCount: number;
  totalSampledCount: number;
  sampledLowRatio: number;
  dailyLowCount: number;
  totalDailyDays: number;
  dailyLowRatio: number;
  finalSafetyRatio: number;
  governingRatioType: 'SAMPLED' | 'DAILY';
  negativeBalanceDetected: boolean;
  overdraftDetected: boolean;
  datesBelow25PercentBenchmarkCount: number;
  datesBelowBenchmarkList: string[];
  formulaExplanation: string;
}

export interface Component3Result {
  name: string;
  maxScore: 20;
  score: number;
  candidates: BounceCandidate[];
  confirmedBouncesCount: number;
  recentBounceWithin30Days: boolean;
  formulaExplanation: string;
}

export interface Component4Result {
  name: string;
  maxScore: 15;
  score: number | 'N/A';
  isRepaymentIncomeContributor: 'YES' | 'NO' | 'UNKNOWN';
  profileType: ProfileType;
  verifiedInflowMonthsCount: number;
  baseScore: number;
  verificationCap: number;
  verificationStatusLabel: string;
  acceptedCredits: { date: string; narration: string; amountRupees: number; reason: string }[];
  excludedCredits: { date: string; narration: string; amountRupees: number; reason: string }[];
  formulaExplanation: string;
}

export interface Component5Result {
  name: string;
  maxScore: 10;
  score: number;
  candidates: CashCandidate[];
  totalConfirmedCashRupees: number;
  totalCreditsRupees: number;
  cashDepositRatio: number;
  largeCashAlertsCount: number;
  formulaExplanation: string;
}

export interface Component6Result {
  name: string;
  maxScore: 10;
  score: number;
  balanceDropEvents: BalanceDropEvent[];
  passThroughCandidates: PassThroughCandidate[];
  confirmedAdverseDropsCount: number;
  confirmedAdversePassThroughCount: number;
  dropsScore: number;
  passThroughScore: number;
  formulaExplanation: string;
}

export interface CustomDateApprovalAudit {
  customDays: number[];
  reason: string;
  managerApproverId: string;
  approvedAt: string;
}

export interface DeterministicEVVResult {
  statementPeriod: { start: string; end: string };
  scoredMonthsPeriod: { start: string; end: string };
  completedCalendarMonths: string[]; // YYYY-MM
  isLimitedPeriod: boolean;
  periodWarning?: string;
  policyUsed: BankPolicy;
  profileUsed: FinancialProfile;
  customDateApproval?: CustomDateApprovalAudit;
  selectedSamples: SelectedBalanceSample[];
  dailyBalances: DailyBalance[];
  component1: Component1Result;
  component2: Component2Result;
  component3: Component3Result;
  component4: Component4Result;
  component5: Component5Result;
  component6: Component6Result;
  numericTotalScore: number; // 0-100 sum of numeric components
  effectiveScoreOutOf100: number; // For non-income contributor, keeps N/A intact in C4
  statusBand: 'GREEN' | 'AMBER' | 'RED';
  requiresManualReview: boolean;
  manualReviewReasons: string[];
  recommendedStaffActions: string[];
  disclaimer: string;
  calculatedAt: string;
  auditSnapshot: AuditSnapshot;
}

export interface AuditSnapshot {
  version: string;
  timestamp: string;
  policy: BankPolicy;
  profile: FinancialProfile;
  selectedDays: number[];
  dateMode: 'FIXED' | 'CUSTOM';
  completedMonths: string[];
  sampleCount: number;
  samples: Array<{
    targetDate: string;
    closingBalancePaise: string;
    closingBalanceRupees: number;
  }>;
  components: {
    c1: { score: number; sixMonthSampledAMBRupees: number; trendPercent: number };
    c2: { score: number; finalSafetyRatio: number; governingRatio: string };
    c3: { score: number; confirmedBounces: number };
    c4: { score: number | 'N/A'; verifiedMonths: number; cap: number };
    c5: { score: number; cashRatio: number; confirmedCashRupees: number };
    c6: { score: number; dropsScore: number; passThroughScore: number };
  };
  finalScore: number;
  statusBand: 'GREEN' | 'AMBER' | 'RED';
  manualReview: boolean;
  manualReviewReasons: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Constants & Keywords
// ─────────────────────────────────────────────────────────────────────────────

export const HIGH_CONFIDENCE_BOUNCE_KEYWORDS = [
  'NACH RETURN',
  'ECS RETURN',
  'EMI RETURN',
  'CHEQUE RETURN',
  'CHQ RETURN',
  'CHEQUE BOUNCE',
  'CHEQUE DISHONOUR',
  'CHEQUE DISHONOR',
  'INSUFFICIENT FUNDS',
  'FUNDS INSUFFICIENT',
  'MANDATE RETURN',
  'MANDATE FAILED',
  'AUTO DEBIT RETURN',
  'AUTODEBIT RETURN',
  'SI RETURN',
  'STANDING INSTRUCTION RETURN',
  'PAYMENT RETURNED',
  'DEBIT RETURNED',
  'RETURN CHARGES',
  'BOUNCE CHG',
  'CHQ RET CHG',
];

export const BOUNCE_EXCLUSION_KEYWORDS = [
  'REVERSAL',
  'REVERSED',
  'REFUND',
  'CASHBACK',
  'FAILED ATM',
  'ATM REVERSAL',
  'UPI REVERSAL',
  'FAILED CASH WITHDRAWAL',
  'CHARGEBACK',
];

export const PHYSICAL_CASH_KEYWORDS = [
  'CASH DEPOSIT',
  'CASH DEP',
  'CASH PAID IN',
  'CASH AT BRANCH',
  'CASH ACCEPTOR',
  'CASH ACCEPTING MACHINE',
  'CDM',
  'SELF CASH DEPOSIT',
  'BY CASH',
  'CASH REMITTANCE',
  'CASH RECEIVED AT BRANCH',
];

export const CASH_EXCLUSION_KEYWORDS = [
  'UPI',
  'IMPS',
  'NEFT',
  'RTGS',
  'SALARY',
  'PENSION',
  'INTEREST',
  'REFUND',
  'CASHBACK',
  'REVERSAL',
  'OWN TRANSFER',
  'SELF TRANSFER',
  'INTERNAL TRF',
  'LOAN',
];

export const DEFAULT_BANK_POLICIES: Record<string, BankPolicy> = {
  DEFAULT: {
    id: 'VIDYA_STANDARD_2026',
    bankName: 'Vidya Standard Lending Partner Policy',
    accountType: 'Savings / Regular Current',
    minimumBalanceBenchmark: 5000,
    strongBalanceTarget: 50000,
    analysisMonths: 6,
    defaultDateMode: 'FIXED',
    fixedDays: [1, 5, 10, 15, 20, 25],
    fixedDates: [1, 5, 10, 15, 20, 25],
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 25000,
    largeCreditMonthlyRatio: 0.25,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: 'v2.1.0',
    effectiveFrom: '2026-01-01',
  },
  HDFC: {
    id: 'HDFC_EDU_SAVINGS_v2',
    bankName: 'HDFC Bank',
    accountType: 'Savings Regular',
    minimumBalanceBenchmark: 10000,
    strongBalanceTarget: 100000,
    analysisMonths: 6,
    defaultDateMode: 'FIXED',
    fixedDays: [1, 5, 10, 15, 20, 25],
    fixedDates: [1, 5, 10, 15, 20, 25],
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 30000,
    largeCreditMonthlyRatio: 0.25,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: 'v2.1.0',
    effectiveFrom: '2026-01-01',
  },
  ICICI: {
    id: 'ICICI_EDU_SAVINGS_v2',
    bankName: 'ICICI Bank',
    accountType: 'Advantage Savings',
    minimumBalanceBenchmark: 10000,
    strongBalanceTarget: 100000,
    analysisMonths: 6,
    defaultDateMode: 'FIXED',
    fixedDays: [1, 5, 10, 15, 20, 25],
    fixedDates: [1, 5, 10, 15, 20, 25],
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 30000,
    largeCreditMonthlyRatio: 0.25,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: 'v2.1.0',
    effectiveFrom: '2026-01-01',
  },
  SBI: {
    id: 'SBI_REG_SAVINGS_v2',
    bankName: 'State Bank of India (SBI)',
    accountType: 'Regular Savings',
    minimumBalanceBenchmark: 3000,
    strongBalanceTarget: 30000,
    analysisMonths: 6,
    defaultDateMode: 'FIXED',
    fixedDays: [1, 5, 10, 15, 20, 25],
    fixedDates: [1, 5, 10, 15, 20, 25],
    largeCashDepositThreshold: 40000,
    largeCreditAbsoluteThreshold: 20000,
    largeCreditMonthlyRatio: 0.25,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: 'v2.1.0',
    effectiveFrom: '2026-01-01',
  },
  AXIS: {
    id: 'AXIS_EASY_ACCESS_v2',
    bankName: 'Axis Bank',
    accountType: 'Easy Access Savings',
    minimumBalanceBenchmark: 10000,
    strongBalanceTarget: 100000,
    analysisMonths: 6,
    defaultDateMode: 'FIXED',
    fixedDays: [1, 5, 10, 15, 20, 25],
    fixedDates: [1, 5, 10, 15, 20, 25],
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 30000,
    largeCreditMonthlyRatio: 0.25,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: 'v2.1.0',
    effectiveFrom: '2026-01-01',
  },
  IDFC: {
    id: 'IDFC_FIRST_SAVINGS_v2',
    bankName: 'IDFC FIRST Bank',
    accountType: 'FIRST Savings',
    minimumBalanceBenchmark: 10000,
    strongBalanceTarget: 100000,
    analysisMonths: 6,
    defaultDateMode: 'FIXED',
    fixedDays: [1, 5, 10, 15, 20, 25],
    fixedDates: [1, 5, 10, 15, 20, 25],
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 25000,
    largeCreditMonthlyRatio: 0.25,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: 'v2.1.0',
    effectiveFrom: '2026-01-01',
  },
  PNB: {
    id: 'PNB_GEN_SAVINGS_v2',
    bankName: 'Punjab National Bank (PNB)',
    accountType: 'General Savings',
    minimumBalanceBenchmark: 2000,
    strongBalanceTarget: 20000,
    analysisMonths: 6,
    defaultDateMode: 'FIXED',
    fixedDays: [1, 5, 10, 15, 20, 25],
    fixedDates: [1, 5, 10, 15, 20, 25],
    largeCashDepositThreshold: 40000,
    largeCreditAbsoluteThreshold: 20000,
    largeCreditMonthlyRatio: 0.25,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: 'v2.1.0',
    effectiveFrom: '2026-01-01',
  },
  BOB: {
    id: 'BOB_SAVINGS_ADV_v2',
    bankName: 'Bank of Baroda',
    accountType: 'Baroda Advantage Savings',
    minimumBalanceBenchmark: 2000,
    strongBalanceTarget: 20000,
    analysisMonths: 6,
    defaultDateMode: 'FIXED',
    fixedDays: [1, 5, 10, 15, 20, 25],
    fixedDates: [1, 5, 10, 15, 20, 25],
    largeCashDepositThreshold: 40000,
    largeCreditAbsoluteThreshold: 20000,
    largeCreditMonthlyRatio: 0.25,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: 'v2.1.0',
    effectiveFrom: '2026-01-01',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Date & Decimal-Safe Money Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Convert rupees to integer paise (safe money arithmetic) */
export function rupeesToPaise(rupees: number): bigint {
  if (isNaN(rupees)) return BigInt(0);
  return BigInt(Math.round(rupees * 100));
}

/** Convert integer paise to rupees for display */
export function paiseToRupees(paise: bigint): number {
  return Number(paise) / 100;
}

/** Parse money text removing symbols, commas, DR/CR */
export function parseAmountToPaise(val: string | number): bigint {
  if (typeof val === 'number') {
    return rupeesToPaise(val);
  }
  if (!val) return BigInt(0);
  const cleaned = val
    .toString()
    .replace(/[₹$,\s]/g, '')
    .replace(/(cr|dr)/gi, '')
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? BigInt(0) : rupeesToPaise(num);
}

/** Parse any date representation into strict YYYY-MM-DD local string */
export function toLocalDateString(d: Date | string): string {
  if (typeof d === 'string') {
    const trimmed = d.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    // Attempt parsing dd/mm/yyyy or dd-mm-yyyy
    const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, '0');
      const month = dmyMatch[2].padStart(2, '0');
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } else if (d instanceof Date && !isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return '2026-01-01';
}

/** Get number of days in a given year and month (1-based month) */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Add calendar days to YYYY-MM-DD */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

/** Format currency in Indian Rupees format */
export function formatCurrencyRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Daily Closing Balance Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface RawInputTransaction {
  date: Date | string;
  narration?: string;
  description?: string;
  debit?: number | string;
  credit?: number | string;
  balance?: number | string;
  runningBalance?: number | string;
  raw?: string;
  reference?: string;
}

/**
 * Normalizes transactions, enforces chronological ordering,
 * and reconciles running balance where available.
 */
export function normalizeTransactions(
  rawTxs: RawInputTransaction[]
): NormalizedTransaction[] {
  const normalized: NormalizedTransaction[] = [];

  rawTxs.forEach((raw, idx) => {
    const localDate = toLocalDateString(raw.date);
    const rawDesc = (raw.narration || raw.description || raw.raw || 'Transaction').trim();
    const normDesc = rawDesc.toUpperCase().replace(/\s+/g, ' ');
    const debitPaise = parseAmountToPaise(raw.debit ?? 0);
    const creditPaise = parseAmountToPaise(raw.credit ?? 0);
    const balVal = raw.runningBalance ?? raw.balance;
    const runningBalancePaise =
      balVal !== undefined && balVal !== null && balVal !== ''
        ? parseAmountToPaise(balVal)
        : undefined;

    normalized.push({
      id: `tx_${idx + 1}`,
      date: localDate,
      descriptionRaw: rawDesc,
      descriptionNormalized: normDesc,
      debitPaise,
      creditPaise,
      runningBalancePaise,
      sourceOrder: idx,
      reference: raw.reference,
    });
  });

  // Sort chronologically, preserving source order within same date
  normalized.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.sourceOrder - b.sourceOrder;
  });

  return normalized;
}

/**
 * Builds continuous daily closing balances for every calendar day
 * from statement start date through end date.
 * Rule A: when running balance present, use final balance on that date.
 * Rule B: when running balance absent, compute from opening balance + credits - debits.
 */
export function buildDailyBalances(
  transactions: NormalizedTransaction[],
  openingBalancePaise: bigint = BigInt(0)
): DailyBalance[] {
  if (transactions.length === 0) return [];

  const startDate = transactions[0].date;
  const endDate = transactions[transactions.length - 1].date;

  // Group transactions by date
  const txByDate = new Map<string, NormalizedTransaction[]>();
  transactions.forEach((tx) => {
    const list = txByDate.get(tx.date) || [];
    list.push(tx);
    txByDate.set(tx.date, list);
  });

  const dailyBalances: DailyBalance[] = [];
  let currentBalancePaise = openingBalancePaise;

  // If the first day has a running balance, start with that
  const firstDayTxs = txByDate.get(startDate);
  if (firstDayTxs && firstDayTxs.length > 0) {
    const lastFirstDayTx = firstDayTxs[firstDayTxs.length - 1];
    if (lastFirstDayTx.runningBalancePaise !== undefined) {
      currentBalancePaise = lastFirstDayTx.runningBalancePaise;
    }
  }

  let curDate = startDate;
  while (curDate <= endDate) {
    const dayTxs = txByDate.get(curDate);
    if (dayTxs && dayTxs.length > 0) {
      const lastTx = dayTxs[dayTxs.length - 1];
      if (lastTx.runningBalancePaise !== undefined) {
        // Rule A
        currentBalancePaise = lastTx.runningBalancePaise;
      } else {
        // Rule B: net of credits and debits
        let dayCredit = BigInt(0);
        let dayDebit = BigInt(0);
        dayTxs.forEach((t) => {
          dayCredit += t.creditPaise;
          dayDebit += t.debitPaise;
        });
        currentBalancePaise = currentBalancePaise + dayCredit - dayDebit;
      }
      dailyBalances.push({
        date: curDate,
        closingBalancePaise: currentBalancePaise,
        hasTransaction: true,
        lastTransactionId: lastTx.id,
      });
    } else {
      // Carry forward previous calendar day's closing balance
      dailyBalances.push({
        date: curDate,
        closingBalancePaise: currentBalancePaise,
        hasTransaction: false,
      });
    }

    curDate = addDays(curDate, 1);
  }

  return dailyBalances;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Month Selection & Scoring Window
// ─────────────────────────────────────────────────────────────────────────────

export interface ScoredMonthWindow {
  completedMonths: string[]; // YYYY-MM sorted chronologically
  partialStartMonth?: string;
  partialEndMonth?: string;
  isLimitedPeriod: boolean;
  warning?: string;
}

/**
 * Determines completed calendar months available in statement.
 * Strictly scores latest 6 COMPLETE calendar months only.
 * Excludes partial starting and ending months.
 */
export function identifyCompletedMonths(
  startDateStr: string,
  endDateStr: string,
  requiredMonths: number = 6
): ScoredMonthWindow {
  const [startY, startM, startD] = startDateStr.split('-').map(Number);
  const [endY, endM, endD] = endDateStr.split('-').map(Number);

  const startMonthStr = `${startY}-${String(startM).padStart(2, '0')}`;
  const endMonthStr = `${endY}-${String(endM).padStart(2, '0')}`;

  const isStartMonthFull = startD === 1;
  const isEndMonthFull = endD === getDaysInMonth(endY, endM);

  const completedMonths: string[] = [];

  let curY = startY;
  let curM = startM;

  while (curY < endY || (curY === endY && curM <= endM)) {
    const mStr = `${curY}-${String(curM).padStart(2, '0')}`;
    const isFirstMonth = mStr === startMonthStr;
    const isLastMonth = mStr === endMonthStr;

    if (isFirstMonth && !isStartMonthFull) {
      // partial start month, skip from scoring
    } else if (isLastMonth && !isEndMonthFull) {
      // partial end month, skip from scoring
    } else {
      completedMonths.push(mStr);
    }

    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }

  // Score latest 6 completed months only
  const latestCompleted = completedMonths.slice(-requiredMonths);
  const isLimited = latestCompleted.length < requiredMonths;

  let warning: string | undefined;
  if (isLimited) {
    warning = `Insufficient statement period: Found ${latestCompleted.length} complete calendar months (minimum ${requiredMonths} required for standard EVV). Scoring on available full months as Limited-period EVV.`;
  }

  return {
    completedMonths: latestCompleted,
    partialStartMonth: !isStartMonthFull ? startMonthStr : undefined,
    partialEndMonth: !isEndMonthFull ? endMonthStr : undefined,
    isLimitedPeriod: isLimited,
    warning,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Date-Sampling Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Samples balances for each completed month.
 * Clamps target day to month length (e.g. day 31 -> Feb 28/29, Apr 30).
 * Uses daily balance on target date (incorporating carry-forward).
 */
export function sampleBalancesForMonths(
  dailyBalances: DailyBalance[],
  completedMonths: string[],
  requestedDays: number[]
): SelectedBalanceSample[] {
  const dailyMap = new Map<string, DailyBalance>();
  dailyBalances.forEach((d) => dailyMap.set(d.date, d));

  const samples: SelectedBalanceSample[] = [];

  completedMonths.forEach((mStr) => {
    const [year, month] = mStr.split('-').map(Number);
    const daysInThisMonth = getDaysInMonth(year, month);

    requestedDays.forEach((reqDay) => {
      const actualDay = Math.min(Math.max(1, reqDay), daysInThisMonth);
      const targetDate = `${year}-${String(month).padStart(2, '0')}-${String(actualDay).padStart(2, '0')}`;

      const dailyEntry = dailyMap.get(targetDate);
      const balancePaise = dailyEntry ? dailyEntry.closingBalancePaise : BigInt(0);

      samples.push({
        month: mStr,
        requestedDay: reqDay,
        targetDate,
        actualDate: targetDate,
        closingBalancePaise: balancePaise,
        closingBalanceRupees: paiseToRupees(balancePaise),
        lastSourceTransactionId: dailyEntry?.lastTransactionId,
      });
    });
  });

  return samples;
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Deterministic EVV Calculation Engine (Pure, Tested)
// ─────────────────────────────────────────────────────────────────────────────

export interface EVVEngineInput {
  transactions: RawInputTransaction[];
  policy?: Partial<BankPolicy>;
  profile?: Partial<FinancialProfile>;
  dateMode?: 'FIXED' | 'CUSTOM';
  customDays?: number[];
  customApproval?: CustomDateApprovalAudit;
  openingBalancePaise?: bigint;
  // Optional staff classifications for interactive review
  candidateClassifications?: {
    bounces?: Record<string, BounceClassification>;
    cash?: Record<string, CashClassification>;
    passThrough?: Record<string, PassThroughClassification>;
  };
}

export function calculateDeterministicEVV(input: EVVEngineInput): DeterministicEVVResult {
  const policy: BankPolicy = {
    ...DEFAULT_BANK_POLICIES.DEFAULT,
    ...(input.policy || {}),
  };

  // If strongBalanceTarget was omitted, use 10 * M
  if (!policy.strongBalanceTarget || policy.strongBalanceTarget <= 0) {
    policy.strongBalanceTarget = 10 * policy.minimumBalanceBenchmark;
  }

  const profile: FinancialProfile = {
    profileType: 'SALARIED',
    isRepaymentIncomeContributor: 'YES',
    supportingDocuments: [],
    ...(input.profile || {}),
  };

  const M = policy.minimumBalanceBenchmark;
  const T = policy.strongBalanceTarget;

  // 1. Normalize transactions
  const normalizedTxs = normalizeTransactions(input.transactions);

  if (normalizedTxs.length === 0) {
    throw new Error("Cannot calculate EVV: No valid transactions found in input statement.");
  }

  const startDateStr = normalizedTxs[0].date;
  const endDateStr = normalizedTxs[normalizedTxs.length - 1].date;

  // 2. Build continuous daily closing balance
  const dailyBalances = buildDailyBalances(normalizedTxs, input.openingBalancePaise || BigInt(0));

  // 3. Identify completed calendar months
  const monthWindow = identifyCompletedMonths(startDateStr, endDateStr, policy.analysisMonths);
  const completedMonths = monthWindow.completedMonths;

  // 4. Sample target dates
  const isCustomMode = input.dateMode === 'CUSTOM' && Array.isArray(input.customDays) && input.customDays.length > 0;
  const selectedDays = isCustomMode ? input.customDays! : policy.fixedDays;

  const samples = sampleBalancesForMonths(dailyBalances, completedMonths, selectedDays);

  // Group samples and daily balances by month
  const samplesByMonth = new Map<string, SelectedBalanceSample[]>();
  samples.forEach((s) => {
    const list = samplesByMonth.get(s.month) || [];
    list.push(s);
    samplesByMonth.set(s.month, list);
  });

  const dailyByMonth = new Map<string, DailyBalance[]>();
  dailyBalances.forEach((d) => {
    const mStr = d.date.substring(0, 7);
    if (completedMonths.includes(mStr)) {
      const list = dailyByMonth.get(mStr) || [];
      list.push(d);
      dailyByMonth.set(mStr, list);
    }
  });

  const txByMonth = new Map<string, NormalizedTransaction[]>();
  normalizedTxs.forEach((t) => {
    const mStr = t.date.substring(0, 7);
    if (completedMonths.includes(mStr)) {
      const list = txByMonth.get(mStr) || [];
      list.push(t);
      txByMonth.set(mStr, list);
    }
  });

  // Calculate Monthly Sampled AMBs
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthlyBreakdown: MonthlySampledAMB[] = completedMonths.map((mStr) => {
    const [y, m] = mStr.split('-').map(Number);
    const label = `${monthNames[m - 1]} ${y}`;
    const mSamples = samplesByMonth.get(mStr) || [];
    const mDaily = dailyByMonth.get(mStr) || [];
    const mTxs = txByMonth.get(mStr) || [];

    let sumSamplePaise = BigInt(0);
    mSamples.forEach((s) => (sumSamplePaise += s.closingBalancePaise));

    const avgSamplePaise = mSamples.length > 0 ? sumSamplePaise / BigInt(mSamples.length) : BigInt(0);
    const avgSampleRupees = paiseToRupees(avgSamplePaise);

    let sumDailyPaise = BigInt(0);
    mDaily.forEach((d) => (sumDailyPaise += d.closingBalancePaise));
    const dailyAMBRupees = mDaily.length > 0 ? paiseToRupees(sumDailyPaise / BigInt(mDaily.length)) : 0;

    let totalCrPaise = BigInt(0);
    let totalDrPaise = BigInt(0);
    let totalCashPaise = BigInt(0);
    let bounceCount = 0;

    mTxs.forEach((t) => {
      totalCrPaise += t.creditPaise;
      totalDrPaise += t.debitPaise;
      const isPhysicalCash = PHYSICAL_CASH_KEYWORDS.some((k) => t.descriptionNormalized.includes(k));
      const isCashExcl = CASH_EXCLUSION_KEYWORDS.some((k) => t.descriptionNormalized.includes(k));
      if (isPhysicalCash && !isCashExcl && t.creditPaise > BigInt(0)) {
        totalCashPaise += t.creditPaise;
      }
      const isBounceCand = HIGH_CONFIDENCE_BOUNCE_KEYWORDS.some((k) => t.descriptionNormalized.includes(k));
      const isBounceExcl = BOUNCE_EXCLUSION_KEYWORDS.some((k) => t.descriptionNormalized.includes(k));
      if (isBounceCand && !isBounceExcl) {
        bounceCount++;
      }
    });

    return {
      month: mStr,
      monthLabel: label,
      samplesCount: mSamples.length,
      sampleBalancesRupees: mSamples.map((s) => s.closingBalanceRupees),
      monthlySampledAMBPaise: avgSamplePaise,
      monthlySampledAMBRupees: Math.round(avgSampleRupees),
      benchmarkMet: avgSampleRupees >= M,
      dailyAMBRupees: Math.round(dailyAMBRupees),
      creditsRupees: Math.round(paiseToRupees(totalCrPaise)),
      debitsRupees: Math.round(paiseToRupees(totalDrPaise)),
      cashDepositsRupees: Math.round(paiseToRupees(totalCashPaise)),
      confirmedBouncesCount: bounceCount,
    };
  });

  const manualReviewReasons: string[] = [];

  // =========================================================================
  // COMPONENT 1 — AVERAGE BALANCE TREND (MAX 25)
  // =========================================================================
  let sum6MSamplePaise = BigInt(0);
  monthlyBreakdown.forEach((mb) => (sum6MSamplePaise += mb.monthlySampledAMBPaise));
  const sixMonthSampledAMBPaise = completedMonths.length > 0 ? sum6MSamplePaise / BigInt(completedMonths.length) : BigInt(0);
  const sixMonthSampledAMBRupees = Math.round(paiseToRupees(sixMonthSampledAMBPaise));

  // Base points = round(25 * min(sixMonthSampledAMB / T, 1))
  const ratioToTarget = Math.min(sixMonthSampledAMBRupees / (T || 1), 1.0);
  const c1BasePoints = Math.round(25 * ratioToTarget);

  // Consistency deduction
  const monthsMeetingBenchmark = monthlyBreakdown.filter((m) => m.benchmarkMet).length;
  let consistencyDeduction = 0;
  if (monthsMeetingBenchmark === 6) consistencyDeduction = 0;
  else if (monthsMeetingBenchmark === 5) consistencyDeduction = 1;
  else if (monthsMeetingBenchmark === 4) consistencyDeduction = 3;
  else if (monthsMeetingBenchmark === 3) consistencyDeduction = 6;
  else consistencyDeduction = 10;

  // Trend deduction
  let previous3MAMBRupees = 0;
  let latest3MAMBRupees = 0;
  let trendPercent = 0;
  let trendDeduction = 0;

  if (monthlyBreakdown.length >= 4) {
    const half = Math.floor(monthlyBreakdown.length / 2);
    const firstHalf = monthlyBreakdown.slice(0, half);
    const secondHalf = monthlyBreakdown.slice(half);

    const sumP3 = firstHalf.reduce((s, m) => s + m.monthlySampledAMBRupees, 0);
    const sumL3 = secondHalf.reduce((s, m) => s + m.monthlySampledAMBRupees, 0);

    previous3MAMBRupees = Math.round(sumP3 / firstHalf.length);
    latest3MAMBRupees = Math.round(sumL3 / secondHalf.length);

    if (previous3MAMBRupees === 0) {
      trendPercent = 0;
      trendDeduction = 0;
      manualReviewReasons.push("Initial 3-month AMB is zero; trend percentage cannot be computed safely.");
    } else {
      trendPercent = Math.round(((latest3MAMBRupees - previous3MAMBRupees) / previous3MAMBRupees) * 10000) / 100;
      if (trendPercent >= -10.0) {
        trendDeduction = 0;
      } else if (trendPercent >= -24.999) {
        trendDeduction = 2;
      } else if (trendPercent >= -39.999) {
        trendDeduction = 5;
      } else {
        trendDeduction = 10;
      }
    }
  }

  const c1FinalScore = Math.max(0, Math.min(25, c1BasePoints - consistencyDeduction - trendDeduction));

  const component1: Component1Result = {
    name: "Average Balance Trend",
    maxScore: 25,
    score: c1FinalScore,
    sixMonthSampledAMBPaise,
    sixMonthSampledAMBRupees,
    strongBalanceTargetRupees: T,
    basePoints: c1BasePoints,
    monthsMeetingBenchmarkCount: monthsMeetingBenchmark,
    consistencyDeduction,
    previous3MAMBRupees,
    latest3MAMBRupees,
    trendPercent,
    trendDeduction,
    monthlyBreakdown,
    formulaExplanation: `Base: 25 × min(${sixMonthSampledAMBRupees} / ${T}, 1) = ${c1BasePoints} pts. Benchmark Consistency: ${monthsMeetingBenchmark} of ${completedMonths.length} months met M=₹${M} (-${consistencyDeduction} pts). Trend: P3M=₹${previous3MAMBRupees}, L3M=₹${latest3MAMBRupees} (${trendPercent > 0 ? '+' : ''}${trendPercent}%, -${trendDeduction} pts). Final C1 = clamp(${c1BasePoints} - ${consistencyDeduction} - ${trendDeduction}) = ${c1FinalScore}/25.`,
  };

  // =========================================================================
  // COMPONENT 2 — MINIMUM-BALANCE SAFETY (MAX 20)
  // =========================================================================
  const benchmarkPaise = rupeesToPaise(M);
  const quarterBenchmarkPaise = benchmarkPaise / BigInt(4);

  let sampledLowCount = 0;
  let datesBelowQuarterBenchmarkCount = 0;
  const datesBelowBenchmarkList: string[] = [];

  samples.forEach((s) => {
    if (s.closingBalancePaise < benchmarkPaise) {
      sampledLowCount++;
      datesBelowBenchmarkList.push(s.targetDate);
    }
    if (s.closingBalancePaise < quarterBenchmarkPaise) {
      datesBelowQuarterBenchmarkCount++;
    }
  });

  const totalSamples = samples.length;
  const sampledLowRatio = totalSamples > 0 ? Math.round((sampledLowCount / totalSamples) * 10000) / 100 : 0;

  // Daily low ratio across completed months
  let dailyLowCount = 0;
  let totalDailyDays = 0;
  let negativeBalanceDetected = false;
  let overdraftDetected = false;

  completedMonths.forEach((mStr) => {
    const days = dailyByMonth.get(mStr) || [];
    days.forEach((d) => {
      totalDailyDays++;
      if (d.closingBalancePaise < benchmarkPaise) {
        dailyLowCount++;
      }
      if (d.closingBalancePaise < BigInt(0)) {
        negativeBalanceDetected = true;
      }
    });
  });

  const dailyLowRatio = totalDailyDays > 0 ? Math.round((dailyLowCount / totalDailyDays) * 10000) / 100 : 0;
  const finalSafetyRatio = Math.max(sampledLowRatio, dailyLowRatio);
  const governingRatioType: 'SAMPLED' | 'DAILY' = sampledLowRatio >= dailyLowRatio ? 'SAMPLED' : 'DAILY';

  let c2Score = 20;
  if (finalSafetyRatio === 0) c2Score = 20;
  else if (finalSafetyRatio <= 5.0) c2Score = 17;
  else if (finalSafetyRatio <= 10.0) c2Score = 14;
  else if (finalSafetyRatio <= 20.0) c2Score = 8;
  else if (finalSafetyRatio <= 35.0) c2Score = 4;
  else c2Score = 0;

  if (negativeBalanceDetected || overdraftDetected) {
    c2Score = 0;
    manualReviewReasons.push("Negative balance or unauthorized overdraft detected in statement period (C2 overridden to 0).");
  }

  if (datesBelowQuarterBenchmarkCount >= 3) {
    manualReviewReasons.push(`Balance fell below 25% of benchmark M (₹${Math.round(M * 0.25)}) on ${datesBelowQuarterBenchmarkCount} selected dates.`);
  }

  const component2: Component2Result = {
    name: "Minimum-Balance Safety",
    maxScore: 20,
    score: c2Score,
    benchmarkMRupees: M,
    sampledLowCount,
    totalSampledCount: totalSamples,
    sampledLowRatio,
    dailyLowCount,
    totalDailyDays,
    dailyLowRatio,
    finalSafetyRatio,
    governingRatioType,
    negativeBalanceDetected,
    overdraftDetected,
    datesBelow25PercentBenchmarkCount: datesBelowQuarterBenchmarkCount,
    datesBelowBenchmarkList,
    formulaExplanation: `Sampled low ratio: ${sampledLowCount}/${totalSamples} (${sampledLowRatio}%). Daily low ratio: ${dailyLowCount}/${totalDailyDays} (${dailyLowRatio}%). Governing conservative ratio: ${finalSafetyRatio}% (${governingRatioType}). Bracket score: ${c2Score}/20.${negativeBalanceDetected ? ' Overridden to 0 due to negative balance.' : ''}`,
  };

  // =========================================================================
  // COMPONENT 3 — BOUNCE-FREE RECORD (MAX 20)
  // =========================================================================
  const bounceCandidateList: BounceCandidate[] = [];
  const rawBounceEntries: NormalizedTransaction[] = [];

  normalizedTxs.forEach((tx) => {
    const isCand = HIGH_CONFIDENCE_BOUNCE_KEYWORDS.some((k) => tx.descriptionNormalized.includes(k));
    const isExcl = BOUNCE_EXCLUSION_KEYWORDS.some((k) => tx.descriptionNormalized.includes(k));
    if (isCand && !isExcl) {
      rawBounceEntries.push(tx);
    }
  });

  // Double-count prevention: group return and return-charge entry as ONE bounce event
  // Group by adjacent dates (within 2 days)
  const groupedBounceEvents: NormalizedTransaction[][] = [];
  rawBounceEntries.forEach((tx) => {
    const existingGroup = groupedBounceEvents.find((group) => {
      const gFirst = group[0];
      const dayDiff = Math.abs(
        (new Date(tx.date).getTime() - new Date(gFirst.date).getTime()) / 86400000
      );
      return dayDiff <= 2;
    });

    if (existingGroup) {
      existingGroup.push(tx);
    } else {
      groupedBounceEvents.push([tx]);
    }
  });

  groupedBounceEvents.forEach((group, idx) => {
    const primary = group[0];
    const feeTx = group.find((t) => t.id !== primary.id && t.descriptionNormalized.includes('CHG'));
    const matchedKw = HIGH_CONFIDENCE_BOUNCE_KEYWORDS.filter((k) => primary.descriptionNormalized.includes(k));
    const candidateId = `bounce_${idx + 1}`;

    const classificationOverride = input.candidateClassifications?.bounces?.[candidateId];
    const classification: BounceClassification = classificationOverride || 'CONFIRMED_BOUNCE';

    bounceCandidateList.push({
      id: candidateId,
      date: primary.date,
      narration: primary.descriptionRaw,
      amountPaise: primary.debitPaise > BigInt(0) ? primary.debitPaise : primary.creditPaise,
      amountRupees: paiseToRupees(primary.debitPaise > BigInt(0) ? primary.debitPaise : primary.creditPaise),
      linkedFeePaise: feeTx ? feeTx.debitPaise : undefined,
      classification,
      matchedKeywords: matchedKw,
    });
  });

  const confirmedBounces = bounceCandidateList.filter((b) => b.classification === 'CONFIRMED_BOUNCE');
  const confirmedBouncesCount = confirmedBounces.length;

  let c3Score = 20;
  if (confirmedBouncesCount === 0) c3Score = 20;
  else if (confirmedBouncesCount === 1) c3Score = 10;
  else if (confirmedBouncesCount === 2) c3Score = 5;
  else c3Score = 0;

  // Recent bounce check within 30 days of statement end
  let recentBounceWithin30Days = false;
  confirmedBounces.forEach((b) => {
    const diff = Math.abs((new Date(endDateStr).getTime() - new Date(b.date).getTime()) / 86400000);
    if (diff <= 30) {
      recentBounceWithin30Days = true;
    }
  });

  if (recentBounceWithin30Days) {
    manualReviewReasons.push("Recent confirmed EMI/NACH/ECS return detected within the last 30 days of the statement.");
  }

  const component3: Component3Result = {
    name: "Bounce-Free Record",
    maxScore: 20,
    score: c3Score,
    candidates: bounceCandidateList,
    confirmedBouncesCount,
    recentBounceWithin30Days,
    formulaExplanation: `Identified ${bounceCandidateList.length} candidate bounce events (${confirmedBouncesCount} confirmed, grouped return + charge entries). Score: ${c3Score}/20.`,
  };

  // =========================================================================
  // COMPONENT 4 — VERIFIED FINANCIAL INFLOW REGULARITY (MAX 15)
  // =========================================================================
  let c4Score: number | 'N/A' = 0;
  let c4BaseScore = 0;
  let verificationCap = 15;
  let verificationStatusLabel = "Fully documented source + lender-eligible";
  let verifiedInflowMonthsCount = 0;
  const acceptedCredits: { date: string; narration: string; amountRupees: number; reason: string }[] = [];
  const excludedCredits: { date: string; narration: string; amountRupees: number; reason: string }[] = [];

  const contributorRole = profile.isRepaymentIncomeContributor;

  if (contributorRole === 'NO') {
    c4Score = 'N/A';
    verificationStatusLabel = "N/A — Non-income contributor. Analyze primary earning co-applicant separately.";
  } else if (contributorRole === 'UNKNOWN') {
    c4Score = 0;
    verificationStatusLabel = "Role UNKNOWN: Manual Review flag assigned until confirmed by staff.";
    manualReviewReasons.push("Repayment income contributor status is UNKNOWN (C4=0 pending role confirmation).");
  } else {
    // Role is YES: Evaluate monthly recurring inflow across completed months
    completedMonths.forEach((mStr) => {
      const monthTxs = txByMonth.get(mStr) || [];
      const eligibleCreditsInMonth = monthTxs.filter((t) => {
        if (t.creditPaise <= BigInt(0)) return false;
        const norm = t.descriptionNormalized;
        const isCash = PHYSICAL_CASH_KEYWORDS.some((k) => norm.includes(k));
        const isExcluded = [
          'REVERSAL',
          'REFUND',
          'CASHBACK',
          'OWN TRANSFER',
          'SELF TRANSFER',
          'INTERNAL TRF',
          'LOAN DISB',
        ].some((k) => norm.includes(k));

        if (isCash || isExcluded) {
          excludedCredits.push({
            date: t.date,
            narration: t.descriptionRaw,
            amountRupees: paiseToRupees(t.creditPaise),
            reason: isCash ? "Physical Cash Deposit" : "Internal Transfer / Reversal / Non-recurring credit",
          });
          return false;
        }

        // Must meet minimum threshold (₹5,000 paise)
        if (t.creditPaise >= BigInt(500000)) {
          acceptedCredits.push({
            date: t.date,
            narration: t.descriptionRaw,
            amountRupees: paiseToRupees(t.creditPaise),
            reason: "Verified Recurring Eligible Financial Inflow",
          });
          return true;
        }
        return false;
      });

      if (eligibleCreditsInMonth.length > 0) {
        verifiedInflowMonthsCount++;
      }
    });

    if (verifiedInflowMonthsCount >= 6) c4BaseScore = 15;
    else if (verifiedInflowMonthsCount === 5) c4BaseScore = 13;
    else if (verifiedInflowMonthsCount === 4) c4BaseScore = 10;
    else if (verifiedInflowMonthsCount === 3) c4BaseScore = 6;
    else c4BaseScore = 0;

    // Check supporting documents cap
    const docs = profile.supportingDocuments || [];
    const hasOfficialProof = docs.some((d) =>
      ['SALARY_SLIP', 'FORM_16', 'ITR', 'GST', 'PPO', 'RENT_AGREEMENT'].some((k) => d.toUpperCase().includes(k))
    );

    if (hasOfficialProof) {
      verificationCap = 15;
      verificationStatusLabel = "Fully documented source + lender-eligible";
    } else if (verifiedInflowMonthsCount >= 4) {
      verificationCap = 10;
      verificationStatusLabel = "Pattern visible but supporting documents pending (cap 10)";
    } else if (verifiedInflowMonthsCount >= 3) {
      verificationCap = 6;
      verificationStatusLabel = "Recurring pattern visible but source/eligibility uncertain (cap 6)";
    } else {
      verificationCap = 0;
      verificationStatusLabel = "Source not established";
    }

    c4Score = Math.min(c4BaseScore, verificationCap);
  }

  const component4: Component4Result = {
    name: "Verified Financial Inflow Regularity",
    maxScore: 15,
    score: c4Score,
    isRepaymentIncomeContributor: contributorRole,
    profileType: profile.profileType,
    verifiedInflowMonthsCount,
    baseScore: c4BaseScore,
    verificationCap,
    verificationStatusLabel,
    acceptedCredits: acceptedCredits.slice(0, 15),
    excludedCredits: excludedCredits.slice(0, 15),
    formulaExplanation:
      c4Score === 'N/A'
        ? "Non-income contributor: C4 is N/A and not penalized as 0."
        : `Verified recurring inflows in ${verifiedInflowMonthsCount} of ${completedMonths.length} complete months. Base: ${c4BaseScore} pts. Cap applied: ${verificationCap} pts (${verificationStatusLabel}). Final C4 = ${c4Score}/15.`,
  };

  // =========================================================================
  // COMPONENT 5 — CASH-DEPOSIT RATIO (MAX 10)
  // =========================================================================
  const cashCandidateList: CashCandidate[] = [];
  let totalCreditsPaise = BigInt(0);
  let totalConfirmedCashPaise = BigInt(0);

  normalizedTxs.forEach((tx) => {
    const mStr = tx.date.substring(0, 7);
    if (!completedMonths.includes(mStr)) return;

    if (tx.creditPaise > BigInt(0)) {
      totalCreditsPaise += tx.creditPaise;
      const isCash = PHYSICAL_CASH_KEYWORDS.some((k) => tx.descriptionNormalized.includes(k));
      const isExcl = CASH_EXCLUSION_KEYWORDS.some((k) => tx.descriptionNormalized.includes(k));

      if (isCash && !isExcl) {
        const candidateId = `cash_${cashCandidateList.length + 1}`;
        const classificationOverride = input.candidateClassifications?.cash?.[candidateId];
        const classification: CashClassification = classificationOverride || 'CONFIRMED_CASH_DEPOSIT';

        const amountRupees = paiseToRupees(tx.creditPaise);
        const isLargeAlert = amountRupees >= policy.largeCashDepositThreshold;

        cashCandidateList.push({
          id: candidateId,
          date: tx.date,
          narration: tx.descriptionRaw,
          amountPaise: tx.creditPaise,
          amountRupees,
          classification,
          isLargeDepositAlert: isLargeAlert,
        });

        if (classification === 'CONFIRMED_CASH_DEPOSIT') {
          totalConfirmedCashPaise += tx.creditPaise;
        }
      }
    }
  });

  const totalCreditsRupees = Math.round(paiseToRupees(totalCreditsPaise));
  const totalConfirmedCashRupees = Math.round(paiseToRupees(totalConfirmedCashPaise));
  const cashDepositRatio =
    totalCreditsPaise > BigInt(0)
      ? Math.round((Number(totalConfirmedCashPaise * BigInt(10000) / totalCreditsPaise)) / 100)
      : 0;

  let c5Score = 10;
  if (cashDepositRatio < 10.0) c5Score = 10;
  else if (cashDepositRatio <= 20.0) c5Score = 7;
  else if (cashDepositRatio <= 35.0) c5Score = 4;
  else c5Score = 0;

  const largeCashAlerts = cashCandidateList.filter((c) => c.isLargeDepositAlert);
  if (largeCashAlerts.length > 0) {
    manualReviewReasons.push(
      `${largeCashAlerts.length} high-value cash deposit(s) (≥₹${policy.largeCashDepositThreshold.toLocaleString('en-IN')}) detected.`
    );
  }

  const component5: Component5Result = {
    name: "Cash-Deposit Ratio",
    maxScore: 10,
    score: c5Score,
    candidates: cashCandidateList,
    totalConfirmedCashRupees,
    totalCreditsRupees,
    cashDepositRatio,
    largeCashAlertsCount: largeCashAlerts.length,
    formulaExplanation: `Confirmed physical cash deposits = ₹${totalConfirmedCashRupees.toLocaleString('en-IN')} out of ₹${totalCreditsRupees.toLocaleString('en-IN')} total credits (${cashDepositRatio}%). Bracket score: ${c5Score}/10.`,
  };

  // =========================================================================
  // COMPONENT 6 — WITHDRAWAL DISCIPLINE (MAX 10)
  // =========================================================================
  const balanceDropEvents: BalanceDropEvent[] = [];
  let moderateDropsCount = 0;
  let severeDropsCount = 0;
  let criticalDropsCount = 0;

  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];

    // Only evaluate consecutive selected pairs where prior balance >= M
    if (prev.closingBalanceRupees >= M && prev.closingBalanceRupees > curr.closingBalanceRupees) {
      const dropPct = ((prev.closingBalanceRupees - curr.closingBalanceRupees) / prev.closingBalanceRupees) * 100;
      if (dropPct >= 50.0) {
        let severity: 'MODERATE_DROP' | 'SEVERE_DROP' | 'CRITICAL_DROP' = 'MODERATE_DROP';
        if (dropPct >= 90.0) {
          severity = 'CRITICAL_DROP';
          criticalDropsCount++;
        } else if (dropPct >= 75.0) {
          severity = 'SEVERE_DROP';
          severeDropsCount++;
        } else {
          moderateDropsCount++;
        }

        balanceDropEvents.push({
          fromMonth: prev.month,
          fromDate: prev.targetDate,
          toDate: curr.targetDate,
          fromBalanceRupees: Math.round(prev.closingBalanceRupees),
          toBalanceRupees: Math.round(curr.closingBalanceRupees),
          dropPercent: Math.round(dropPct * 10) / 10,
          severity,
        });
      }
    }
  }

  // Rapid pass-through analysis
  const avgMonthlyCreditsRupees = totalCreditsRupees / (completedMonths.length || 1);
  const largeCreditThresholdRupees = Math.max(
    policy.largeCreditAbsoluteThreshold,
    policy.largeCreditMonthlyRatio * avgMonthlyCreditsRupees
  );
  const largeCreditThresholdPaise = rupeesToPaise(largeCreditThresholdRupees);

  const passThroughCandidates: PassThroughCandidate[] = [];

  for (let i = 0; i < normalizedTxs.length; i++) {
    const tx = normalizedTxs[i];
    const mStr = tx.date.substring(0, 7);
    if (!completedMonths.includes(mStr)) continue;

    if (tx.creditPaise >= largeCreditThresholdPaise) {
      // Look at debits within next rapidOutflowDays
      let debitsInWindowPaise = BigInt(0);
      const creditDate = new Date(tx.date);

      for (let j = i + 1; j < normalizedTxs.length; j++) {
        const nextTx = normalizedTxs[j];
        const nextDate = new Date(nextTx.date);
        const dayDiff = (nextDate.getTime() - creditDate.getTime()) / 86400000;
        if (dayDiff > policy.rapidOutflowDays) break;
        if (nextTx.debitPaise > BigInt(0)) {
          debitsInWindowPaise += nextTx.debitPaise;
        }
      }

      const outflowRatio = Number(debitsInWindowPaise * BigInt(100) / tx.creditPaise) / 100;
      if (outflowRatio >= policy.rapidOutflowRatio) {
        const candidateId = `pt_${passThroughCandidates.length + 1}`;
        const classificationOverride = input.candidateClassifications?.passThrough?.[candidateId];
        const classification: PassThroughClassification = classificationOverride || 'UNEXPLAINED';

        passThroughCandidates.push({
          id: candidateId,
          creditDate: tx.date,
          creditAmountRupees: Math.round(paiseToRupees(tx.creditPaise)),
          debitWindowSumRupees: Math.round(paiseToRupees(debitsInWindowPaise)),
          outflowRatio: Math.round(outflowRatio * 100),
          narration: tx.descriptionRaw,
          classification,
        });
      }
    }
  }

  // Only confirmed UNEXPLAINED or SUSPECTED_TEMPORARY_FUNDING reduce score
  const confirmedAdversePassThrough = passThroughCandidates.filter(
    (pt) => pt.classification === 'UNEXPLAINED' || pt.classification === 'SUSPECTED_TEMPORARY_FUNDING'
  );
  const confirmedAdversePassThroughCount = confirmedAdversePassThrough.length;

  let dropsScore = 10;
  if (criticalDropsCount >= 1) dropsScore = 3;
  else if (severeDropsCount >= 2) dropsScore = 4;
  else if (severeDropsCount === 1 || moderateDropsCount >= 2) dropsScore = 6;
  else if (moderateDropsCount === 1) dropsScore = 8;
  else dropsScore = 10;

  let passThroughScore = 10;
  if (confirmedAdversePassThroughCount >= 3) passThroughScore = 0;
  else if (confirmedAdversePassThroughCount === 2) passThroughScore = 1;
  else if (confirmedAdversePassThroughCount === 1) passThroughScore = 4;
  else passThroughScore = 10;

  // Use lowest applicable score
  const c6FinalScore = Math.min(dropsScore, passThroughScore);

  if (criticalDropsCount > 0 || confirmedAdversePassThroughCount >= 2) {
    manualReviewReasons.push("Severe balance drops (≥90%) or multiple unexplained rapid pass-through outflows detected.");
  }

  const component6: Component6Result = {
    name: "Withdrawal Discipline",
    maxScore: 10,
    score: c6FinalScore,
    balanceDropEvents,
    passThroughCandidates,
    confirmedAdverseDropsCount: criticalDropsCount + severeDropsCount + moderateDropsCount,
    confirmedAdversePassThroughCount,
    dropsScore,
    passThroughScore,
    formulaExplanation: `Balance drops: ${moderateDropsCount} moderate, ${severeDropsCount} severe, ${criticalDropsCount} critical (drops score = ${dropsScore}/10). Rapid pass-through: ${passThroughCandidates.length} detected, ${confirmedAdversePassThroughCount} confirmed adverse (pass-through score = ${passThroughScore}/10). Final C6 = min(${dropsScore}, ${passThroughScore}) = ${c6FinalScore}/10.`,
  };

  // =========================================================================
  // 8. FINAL SCORE, STATUS, AND MANUAL REVIEW
  // =========================================================================
  const numericC4 = typeof c4Score === 'number' ? c4Score : 0;
  const numericTotalScore = Math.max(
    0,
    Math.min(100, c1FinalScore + c2Score + c3Score + numericC4 + c5Score + c6FinalScore)
  );

  const effectiveScoreOutOf100 = numericTotalScore;

  let statusBand: 'GREEN' | 'AMBER' | 'RED' = 'RED';
  if (effectiveScoreOutOf100 >= 80) statusBand = 'GREEN';
  else if (effectiveScoreOutOf100 >= 60) statusBand = 'AMBER';
  else statusBand = 'RED';

  const requiresManualReview = manualReviewReasons.length > 0;

  const recommendedStaffActions: string[] = [];
  if (requiresManualReview) {
    recommendedStaffActions.push("Review flagged manual-review events with applicant/co-applicant before proceeding to credit sanction.");
  }
  if (confirmedBouncesCount > 0) {
    recommendedStaffActions.push("Verify latest 3-month bank statement or bank certificate to ensure no active ECS/NACH mandate defaults.");
  }
  if (c4Score === 'N/A') {
    recommendedStaffActions.push("Assess primary earning co-applicant statement separately for repayment FOIR/EMI capacity.");
  }
  if (statusBand === 'GREEN' && !requiresManualReview) {
    recommendedStaffActions.push("EVV assessment clean. Proceed with standard credit underwriting and bureau check.");
  } else if (statusBand === 'AMBER') {
    recommendedStaffActions.push("Moderate EVV score. Review banking consistency, secondary documents, or consider additional collateral/guarantor.");
  } else if (statusBand === 'RED') {
    recommendedStaffActions.push("Sub-benchmark banking health. Detailed credit appraisal, salary/ITR reconciliation, and senior underwriter approval required.");
  }

  const calculatedAt = new Date().toISOString();

  // Audit snapshot export
  const auditSnapshot: AuditSnapshot = {
    version: policy.policyVersion,
    timestamp: calculatedAt,
    policy,
    profile,
    selectedDays,
    dateMode: isCustomMode ? 'CUSTOM' : 'FIXED',
    completedMonths,
    sampleCount: samples.length,
    samples: samples.map((s) => ({
      targetDate: s.targetDate,
      closingBalancePaise: s.closingBalancePaise.toString(),
      closingBalanceRupees: s.closingBalanceRupees,
    })),
    components: {
      c1: { score: c1FinalScore, sixMonthSampledAMBRupees, trendPercent },
      c2: { score: c2Score, finalSafetyRatio, governingRatio: governingRatioType },
      c3: { score: c3Score, confirmedBounces: confirmedBouncesCount },
      c4: { score: c4Score, verifiedMonths: verifiedInflowMonthsCount, cap: verificationCap },
      c5: { score: c5Score, cashRatio: cashDepositRatio, confirmedCashRupees: totalConfirmedCashRupees },
      c6: { score: c6FinalScore, dropsScore, passThroughScore },
    },
    finalScore: effectiveScoreOutOf100,
    statusBand,
    manualReview: requiresManualReview,
    manualReviewReasons,
  };

  return {
    statementPeriod: { start: startDateStr, end: endDateStr },
    scoredMonthsPeriod: {
      start: completedMonths[0] ? `${completedMonths[0]}-01` : startDateStr,
      end: completedMonths[completedMonths.length - 1]
        ? `${completedMonths[completedMonths.length - 1]}-${getDaysInMonth(
            Number(completedMonths[completedMonths.length - 1].split('-')[0]),
            Number(completedMonths[completedMonths.length - 1].split('-')[1])
          )}`
        : endDateStr,
    },
    completedCalendarMonths: completedMonths,
    isLimitedPeriod: monthWindow.isLimitedPeriod,
    periodWarning: monthWindow.warning,
    policyUsed: policy,
    profileUsed: profile,
    customDateApproval: input.customApproval,
    selectedSamples: samples,
    dailyBalances,
    component1,
    component2,
    component3,
    component4,
    component5,
    component6,
    numericTotalScore,
    effectiveScoreOutOf100,
    statusBand,
    requiresManualReview,
    manualReviewReasons,
    recommendedStaffActions,
    disclaimer: MANDATORY_EVV_DISCLAIMER,
    calculatedAt,
    auditSnapshot,
  };
}
