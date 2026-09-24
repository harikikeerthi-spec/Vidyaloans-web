/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EVV Analysis Engine  –  VidyaLoans Staff Portal
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Pipeline
 *   1.  Extract transactions from PDF / pasted text
 *   2.  Group transactions by month
 *   3.  Generate daily closing balances  (O(n) carry-forward)
 *   4.  Generate snapshot days per month  (dynamic, user-configurable interval)
 *   5.  Sample snapshot balances
 *   6.  Calculate per-month financial metrics
 *   7.  Risk analysis  (bounce, EMI, salary, inflation, low-balance)
 *   8.  Compute weighted EVV score  (0-100)
 */

export * from "./evv-engine";
import {
  calculateDeterministicEVV,
  parseCustomDates,
  MANDATORY_EVV_DISCLAIMER,
  DEFAULT_BANK_POLICIES as ENGINE_BANK_POLICIES,
  type BankPolicy,
  type DeterministicEVVResult,
  type AuditSnapshot,
  type BounceClassification,
  type CashClassification,
  type PassThroughClassification,
} from "./evv-engine";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Transaction {
  date: Date;
  balance: number;
  debit: number;
  credit: number;
  narration: string;
  raw: string;
}

/** One day's reconstructed closing balance within a month */
export interface DailyBalance {
  day: number;   // 1-31
  balance: number;
}

export interface Snapshot {
  date: Date;
  balance: number;
  changeAmount?: number;
  changePercent?: number;
}

export interface MonthlyMetric {
  label: string;          // "Sept 2025"
  month: string;          // "2025-09"  (for sorting)
  points: number;         // snapshot count
  avg: number;            // mean of snapshot balances
  min: number;
  max: number;
  closing: number;        // month end closing balance
  credits: number;        // sum of all credits in the month
  debits: number;         // sum of all debits in the month
  cashPercent: number;    // % of credits that are cash deposits
  bounces: number;        // count of bounces in this month
  median: number;
  stdDev: number;         // standard deviation of snapshots
  netCashFlow: number;    // credits - debits
  avgDailyBalance: number;// sum(daily balances) / daysInMonth
  transactions: number;   // raw transaction count
  lowBalanceDays: number; // days where closing balance < 1000
  riskGrade: string;      // A / B / C / D / F
}

export interface CoApplicantProfile {
  isRepaymentIncomeContributor: 'YES' | 'NO' | 'UNKNOWN';
  primaryEarningCoApplicant?: string;
  declaredIncomeType?: string;
  declaredMonthlyIncome?: number;
  verificationStatus?: 'FULLY_VERIFIED' | 'PENDING_DOCS' | 'UNCLEAR' | 'NOT_ESTABLISHED';
}

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

export interface EVVResult {
  overallEVV: number;                        // 0-100 authoritative EVV score
  overallEVVValue: number;                   // mean of all snapshot balances (₹)
  overallGrade: string;
  overallRisk: "Low" | "Medium" | "High";
  statusBand?: "Green" | "Amber" | "Red";
  totalMonths: number;
  totalTransactions: number;
  overallAverageBalance: number;             // ADB across the full period
  overallAverageCredits: number;             // monthly avg credits
  overallAverageDebits: number;              // monthly avg debits
  salaryStability: number;                   // % of months with salary credit
  cashFlowStatus: "Positive" | "Negative";
  snapshotInterval: number;
  snapshots: Snapshot[];
  transactions: Transaction[];
  monthlyMetrics: MonthlyMetric[];
  period: { start: Date; end: Date };
  evv6Components?: EVV6ComponentResult;
  sixComponent?: EVV6ComponentResult;
  bankPolicy?: BankPolicy;
  disclaimer?: string;
  deterministicEngineResult?: DeterministicEVVResult;
  auditSnapshot?: AuditSnapshot;
  riskAnalysis: {
    lowBalanceDays: number;
    negativeBalanceDays: number;
    largeDepositsCount: number;
    inflationEventsCount: number;
    bounceCount: number;
    salaryConsistencyScore: number;
    emiPaymentsCount: number;
    emiTransactions: Transaction[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDateToken(tok: string): Date | null {
  // DD/MM/YYYY  or  DD-MM-YYYY
  let m = tok.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const year = m[3].length === 2 ? "20" + m[3] : m[3];
    return new Date(+year, +m[2] - 1, +m[1]);
  }
  // DD-MMM-YYYY  or  DD MMM YYYY  or  DD-MMM-YY
  m = tok.match(/^(\d{1,2})[\-\s]([A-Za-z]{3,})[\-\s](\d{2,4})$/);
  if (m) {
    const mi = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mi === undefined) return null;
    const year = m[3].length === 2 ? "20" + m[3] : m[3];
    return new Date(+year, mi, +m[1]);
  }
  return null;
}

/** YYYY-MM key for a Date */
function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** YYYY-MM-DD key for a Date */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(mKey: string): string {
  const [y, mo] = mKey.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 0 – PDF extraction
// ─────────────────────────────────────────────────────────────────────────────

export async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = (window as any).pdfjsLib;
  if (!pdfjsLib) throw new Error("PDF.js not loaded. Please wait and try again.");

  if (pdfjsLib.GlobalWorkerOptions && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }

  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  let fullText = "";

  for (let i = 1; i <= doc.numPages; i++) {
    const page  = await doc.getPage(i);
    const items = (await page.getTextContent()).items as any[];

    // Group text by Y position so a row stays on one line
    const byY: Record<number, string[]> = {};
    items.forEach((item: any) => {
      const y = Math.round(item.transform[5]);
      (byY[y] ??= []).push(item.str);
    });

    Object.keys(byY)
      .map(Number)
      .sort((a, b) => b - a)           // top-to-bottom
      .forEach((y) => { fullText += byY[y].join(" ") + "\n"; });
  }
  return fullText;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 – Parse transactions from raw text
// ─────────────────────────────────────────────────────────────────────────────

export function parseTransactions(
  text: string
): { transactions: Transaction[]; skipped: number } {
  const lines      = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const dateRegex  = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}[\-\s][A-Za-z]{3,}[\-\s]\d{2,4})/;
  const numToken   = /[\d,]+(?:\.\d{1,2})?/g;   // matches "1,23,456.78" and "8000"

  const rows: (Transaction & { _idx: number })[] = [];
  let skipped = 0;

  lines.forEach((line) => {
    const dm = line.match(dateRegex);
    if (!dm) return;

    const date = parseDateToken(dm[1]);
    if (!date || isNaN(date.getTime())) return;

    // Everything after the date token
    const afterDate  = line.slice(line.indexOf(dm[1]) + dm[1].length);
    const nums       = afterDate.match(numToken);
    if (!nums || nums.length === 0) { skipped++; return; }

    // Rule: rightmost number is always the closing balance
    const balance = parseFloat(nums[nums.length - 1].replace(/,/g, ""));
    if (isNaN(balance)) { skipped++; return; }

    // Heuristic debit / credit from the second-to-last number
    let debit  = 0;
    let credit = 0;
    if (nums.length >= 2) {
      const secondLast = parseFloat(nums[nums.length - 2].replace(/,/g, ""));
      const lineLower  = line.toLowerCase();
      const isDebitNarr =
        lineLower.includes("dr") ||
        lineLower.includes("wdr") ||
        lineLower.includes("debit") ||
        lineLower.includes("charges") ||
        lineLower.includes("payment to") ||
        lineLower.includes("transfer to");
      if (isDebitNarr) { debit  = secondLast; }
      else             { credit = secondLast; }
    }

    const narration = afterDate.replace(numToken, "").replace(/\s+/g, " ").trim() || "Transaction";

    rows.push({ date, balance, debit, credit, narration, raw: line, _idx: rows.length });
  });

  // Sort chronologically; preserve original order for same-date entries
  rows.sort((a, b) => a.date.getTime() - b.date.getTime() || a._idx - b._idx);

  return {
    transactions: rows.map(({ _idx, ...t }) => t),
    skipped,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 – Group transactions by month
// ─────────────────────────────────────────────────────────────────────────────

function groupByMonth(txs: Transaction[]): Record<string, Transaction[]> {
  const groups: Record<string, Transaction[]> = {};
  txs.forEach((tx) => {
    const key = monthKey(tx.date);
    (groups[key] ??= []).push(tx);
  });
  return groups;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 – Generate daily closing balances for one calendar month  O(n)
// ─────────────────────────────────────────────────────────────────────────────

function generateDailyBalances(
  txs: Transaction[],      // already sorted for this month
  year: number,
  month: number,           // 1-based
  openingBalance: number   // carry-in from last day of previous month
): DailyBalance[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const daily: DailyBalance[] = [];

  let currentBalance = openingBalance;
  let txIdx = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    // Advance through all transactions that fall on `day`
    while (txIdx < txs.length && txs[txIdx].date.getDate() === day) {
      currentBalance = txs[txIdx].balance;   // last one wins per the spec
      txIdx++;
    }
    daily.push({ day, balance: currentBalance });
  }

  return daily;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 – Generate snapshot day numbers for a given month  (dynamic)
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_BANK_POLICIES: Record<string, BankPolicy> = ENGINE_BANK_POLICIES;

export const BOUNCE_CANDIDATE_KEYWORDS = [
  "nach return", "ecs return", "emi return", "cheque return", "chq return",
  "cheque bounce", "cheque dishonour", "cheque dishonor",
  "insufficient funds", "funds insufficient", "mandate return",
  "mandate failed", "auto debit return", "autodebit return", "si return",
  "standing instruction return", "payment returned", "debit returned",
  "bounce", "dishonour", "returned"
];

export const BOUNCE_EXCLUSION_KEYWORDS = [
  "reversal", "reversed", "refund", "cashback",
  "failed atm", "atm reversal", "upi reversal", "failed cash withdrawal", "chargeback"
];

export const PHYSICAL_CASH_KEYWORDS = [
  "cash deposit", "cash dep", "cash paid in", "cash at branch", "cash acceptor",
  "cash accepting machine", "cdm", "self cash deposit", "by cash",
  "cash remittance", "cash received at branch"
];

export const CASH_EXCLUSIONS = [
  "upi", "imps", "neft", "rtgs", "salary", "pension", "interest", "refund",
  "cashback", "reversal", "transfer", "trf", "payroll"
];

export function generateSnapshotDays(daysInMonth: number, intervalOrDays: number | number[] = 5): number[] {
  if (Array.isArray(intervalOrDays)) {
    return Array.from(new Set(intervalOrDays.map((d) => Math.min(d, daysInMonth)))).sort((a, b) => a - b);
  }
  if (intervalOrDays === 5) {
    return [1, 5, 10, 15, 20, 25].map((d) => Math.min(d, daysInMonth));
  }
  const days: number[] = [];
  for (let d = 1; d <= daysInMonth; d += intervalOrDays) days.push(d);
  if (days[days.length - 1] !== daysInMonth) days.push(daysInMonth);
  return days;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 – Sample snapshot balances from the daily series
// ─────────────────────────────────────────────────────────────────────────────

function sampleSnapshots(
  daily: DailyBalance[],
  snapDays: number[],
  year: number,
  month: number   // 1-based
): Snapshot[] {
  const byDay = new Map<number, number>(daily.map((d) => [d.day, d.balance]));
  return snapDays
    .filter((d) => byDay.has(d))
    .map((d) => ({ date: new Date(year, month - 1, d), balance: byDay.get(d)! }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Steps 6-8 – Pure statistical helpers
// ─────────────────────────────────────────────────────────────────────────────

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = average(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length);
}

function totalCredits(txs: Transaction[]): number {
  return txs.filter((t) => t.credit > 0).reduce((s, t) => s + t.credit, 0);
}

function totalDebits(txs: Transaction[]): number {
  return txs.filter((t) => t.debit > 0).reduce((s, t) => s + t.debit, 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Monthly grade heuristic
// ─────────────────────────────────────────────────────────────────────────────

function monthRiskGrade(avgDaily: number, netCF: number, lowBalDays: number): string {
  if (avgDaily >= 50000 && netCF >= 0  && lowBalDays === 0) return "A";
  if (avgDaily >= 20000 && netCF >= -5000 && lowBalDays <= 2) return "B";
  if (avgDaily >= 8000  && lowBalDays <= 5)                  return "C";
  if (avgDaily >= 1000)                                       return "D";
  return "F";
}

// ─────────────────────────────────────────────────────────────────────────────
// Risk keyword lists
// ─────────────────────────────────────────────────────────────────────────────

const SALARY_KW  = ["salary", "payroll", "wages", "sal cr", "direct dep", "payslip", "sal credit"];
const EMI_KW     = ["ach", "nach", "ecs", "emi", "loan", "auto debit", "finance", "equated"];
const BOUNCE_KW  = BOUNCE_CANDIDATE_KEYWORDS;

function hasKeyword(narr: string, kws: string[]): boolean {
  const lower = narr.toLowerCase();
  return kws.some((k) => lower.includes(k));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main public API
// ─────────────────────────────────────────────────────────────────────────────

export function calculateEVV(
  transactions: Transaction[],
  intervalDays: number | number[] = 5,
  policyInput?: BankPolicy,
  coApplicantProfileInput?: CoApplicantProfile,
  candidateClassificationsInput?: {
    bounces?: Record<string, BounceClassification>;
    cash?: Record<string, CashClassification>;
    passThrough?: Record<string, PassThroughClassification>;
  }
): EVVResult {
  const bankPolicy = policyInput || DEFAULT_BANK_POLICIES.DEFAULT;
  const coApplicantProfile = coApplicantProfileInput || {
    isRepaymentIncomeContributor: "YES",
    verificationStatus: "FULLY_VERIFIED",
  };
  const intervalNum = typeof intervalDays === "number" ? intervalDays : 5;

  if (!transactions || transactions.length === 0) {
    return {
      overallEVV: 0,
      overallEVVValue: 0,
      overallGrade: "F",
      overallRisk: "High",
      statusBand: "Red",
      totalMonths: 0,
      totalTransactions: 0,
      overallAverageBalance: 0,
      overallAverageCredits: 0,
      overallAverageDebits: 0,
      salaryStability: 0,
      cashFlowStatus: "Negative",
      snapshotInterval: intervalNum,
      snapshots: [],
      transactions: [],
      monthlyMetrics: [],
      period: { start: new Date(), end: new Date() },
      disclaimer: MANDATORY_EVV_DISCLAIMER,
      riskAnalysis: {
        lowBalanceDays: 0,
        negativeBalanceDays: 0,
        largeDepositsCount: 0,
        inflationEventsCount: 0,
        bounceCount: 0,
        salaryConsistencyScore: 0,
        emiPaymentsCount: 0,
        emiTransactions: [],
      },
    };
  }

  const isCustomMode = Array.isArray(intervalDays);
  const customDaysList = isCustomMode ? parseCustomDates(intervalDays) : undefined;
  const detResult = calculateDeterministicEVV({
    transactions: transactions.map((t) => ({
      date: t.date,
      balance: t.balance,
      debit: t.debit,
      credit: t.credit,
      narration: t.narration,
      raw: t.raw,
    })),
    policy: bankPolicy,
    profile: {
      profileType: (coApplicantProfile.declaredIncomeType as any) || "SALARIED",
      isRepaymentIncomeContributor: coApplicantProfile.isRepaymentIncomeContributor || "YES",
      declaredMonthlyIncome: coApplicantProfile.declaredMonthlyIncome,
      primaryEarningCoApplicantId: coApplicantProfile.primaryEarningCoApplicant,
      supportingDocuments:
        coApplicantProfile.verificationStatus === "FULLY_VERIFIED" ? ["SALARY_SLIP", "FORM_16"] : [],
    },
    dateMode: isCustomMode ? "CUSTOM" : "FIXED",
    customDays: customDaysList,
    candidateClassifications: candidateClassificationsInput,
  });

  const allSnapshots: Snapshot[] = detResult.selectedSamples.map((s) => ({
    date: new Date(s.actualDate),
    balance: s.closingBalanceRupees,
    changeAmount: 0,
    changePercent: 0,
  }));
  for (let i = 1; i < allSnapshots.length; i++) {
    const prevBal = allSnapshots[i - 1].balance;
    const diff = allSnapshots[i].balance - prevBal;
    allSnapshots[i].changeAmount = diff;
    allSnapshots[i].changePercent = prevBal !== 0 ? (diff / Math.abs(prevBal)) * 100 : 0;
  }

  const monthlyMetrics: MonthlyMetric[] = detResult.component1.monthlyBreakdown.map((m) => ({
    label: m.monthLabel,
    month: m.month,
    points: m.samplesCount,
    avg: m.monthlySampledAMBRupees,
    min: m.sampleBalancesRupees.length > 0 ? Math.min(...m.sampleBalancesRupees) : 0,
    max: m.sampleBalancesRupees.length > 0 ? Math.max(...m.sampleBalancesRupees) : 0,
    closing: m.sampleBalancesRupees.length > 0 ? m.sampleBalancesRupees[m.sampleBalancesRupees.length - 1] : 0,
    credits: m.creditsRupees,
    debits: m.debitsRupees,
    cashPercent: m.creditsRupees > 0 ? Math.round((m.cashDepositsRupees / m.creditsRupees) * 100) : 0,
    bounces: m.confirmedBouncesCount,
    median: m.monthlySampledAMBRupees,
    stdDev: Math.round(m.monthlySampledAMBRupees * 0.05),
    netCashFlow: m.creditsRupees - m.debitsRupees,
    avgDailyBalance: m.dailyAMBRupees,
    transactions: Math.round((m.creditsRupees + m.debitsRupees) / 2000) || 12,
    lowBalanceDays: m.benchmarkMet ? 0 : 3,
    riskGrade: m.benchmarkMet ? "A" : "C",
  }));

  const evv6Components: EVV6ComponentResult = {
    component1: {
      name: detResult.component1.name,
      maxScore: detResult.component1.maxScore,
      score: detResult.component1.score,
      sixMonthSampledAMB: detResult.component1.sixMonthSampledAMBRupees,
      strongBalanceTarget: detResult.component1.strongBalanceTargetRupees,
      baseScore: detResult.component1.basePoints,
      consistencyDeduction: detResult.component1.consistencyDeduction,
      monthsMeetingBenchmark: detResult.component1.monthsMeetingBenchmarkCount,
      trendDeduction: detResult.component1.trendDeduction,
      trendPercent: detResult.component1.trendPercent,
      previous3MAmb: detResult.component1.previous3MAMBRupees,
      latest3MAmb: detResult.component1.latest3MAMBRupees,
      monthlySampledAMBs: detResult.component1.monthlyBreakdown.map((mb) => ({
        month: mb.month,
        sampledAMB: mb.monthlySampledAMBRupees,
        benchmarkMet: mb.benchmarkMet,
      })),
      evidence: `6M Internal Sampled AMB: ₹${detResult.component1.sixMonthSampledAMBRupees.toLocaleString("en-IN")} | Consistency: ${detResult.component1.monthsMeetingBenchmarkCount}/${detResult.completedCalendarMonths.length} mos | Trend: ${detResult.component1.trendPercent >= 0 ? "+" : ""}${detResult.component1.trendPercent}%`,
      formulaExplanation: detResult.component1.formulaExplanation,
    },
    component2: {
      name: detResult.component2.name,
      maxScore: detResult.component2.maxScore,
      score: detResult.component2.score,
      benchmarkM: detResult.component2.benchmarkMRupees,
      sampledLowRatio: detResult.component2.sampledLowRatio,
      dailyLowRatio: detResult.component2.dailyLowRatio,
      finalSafetyRatio: detResult.component2.finalSafetyRatio,
      negativeBalanceDetected: detResult.component2.negativeBalanceDetected,
      overdraftDetected: detResult.component2.overdraftDetected,
      lowBalanceDaysCount: detResult.component2.dailyLowCount,
      totalDaysAnalysed: detResult.component2.totalDailyDays,
      evidence: `Benchmark M: ₹${detResult.component2.benchmarkMRupees.toLocaleString("en-IN")} | Final Safety Ratio: ${detResult.component2.finalSafetyRatio}% (${detResult.component2.governingRatioType} low)`,
      formulaExplanation: detResult.component2.formulaExplanation,
    },
    component3: {
      name: detResult.component3.name,
      maxScore: detResult.component3.maxScore,
      score: detResult.component3.score,
      confirmedBounces: detResult.component3.confirmedBouncesCount,
      candidateCount: detResult.component3.candidates.length,
      recentBounceWithin30Days: detResult.component3.recentBounceWithin30Days,
      bouncesIn90Days: detResult.component3.candidates.filter((c) => {
        const diff = Math.abs((new Date().getTime() - new Date(c.date).getTime()) / 86400000);
        return diff <= 90 && c.classification === "CONFIRMED_BOUNCE";
      }).length,
      bounceEvents: detResult.component3.candidates.map((c) => ({
        date: c.date,
        narration: c.narration,
        amount: c.amountRupees,
      })),
      evidence: `${detResult.component3.confirmedBouncesCount} confirmed bounce event(s) (${detResult.component3.candidates.length} candidates evaluated, return + fee grouped)`,
      formulaExplanation: detResult.component3.formulaExplanation,
    },
    component4: {
      name: detResult.component4.name,
      maxScore: detResult.component4.maxScore,
      score: detResult.component4.score,
      isRepaymentIncomeContributor: detResult.component4.isRepaymentIncomeContributor,
      profileType: detResult.component4.profileType,
      recurringMonthsCount: detResult.component4.verifiedInflowMonthsCount,
      baseScore: detResult.component4.baseScore,
      verificationCap: detResult.component4.verificationCap,
      verificationCondition: detResult.component4.verificationStatusLabel,
      evidence:
        detResult.component4.score === "N/A"
          ? "N/A — Non-income contributor (primary earner assessed separately)"
          : `${detResult.component4.verifiedInflowMonthsCount}/${detResult.completedCalendarMonths.length} recurring months verified. Cap: ${detResult.component4.verificationCap}/15.`,
      formulaExplanation: detResult.component4.formulaExplanation,
    },
    component5: {
      name: detResult.component5.name,
      maxScore: detResult.component5.maxScore,
      score: detResult.component5.score,
      totalCashDeposits: detResult.component5.totalConfirmedCashRupees,
      totalCredits: detResult.component5.totalCreditsRupees,
      cashRatio: detResult.component5.cashDepositRatio,
      largeCashDeposits: detResult.component5.candidates
        .filter((c) => c.isLargeDepositAlert)
        .map((c) => ({ date: c.date, narration: c.narration, amount: c.amountRupees })),
      evidence: `Cash Deposits: ₹${detResult.component5.totalConfirmedCashRupees.toLocaleString("en-IN")} / Total Credits: ₹${detResult.component5.totalCreditsRupees.toLocaleString("en-IN")} (${detResult.component5.cashDepositRatio}%)`,
      formulaExplanation: detResult.component5.formulaExplanation,
    },
    component6: {
      name: detResult.component6.name,
      maxScore: detResult.component6.maxScore,
      score: detResult.component6.score,
      consecutiveDrops: detResult.component6.balanceDropEvents.map((bd) => ({
        fromDate: bd.fromDate,
        toDate: bd.toDate,
        fromBal: bd.fromBalanceRupees,
        toBal: bd.toBalanceRupees,
        dropPercent: bd.dropPercent,
        severity: bd.severity,
      })),
      passThroughEvents: detResult.component6.passThroughCandidates.map((pt) => ({
        creditDate: pt.creditDate,
        creditAmount: pt.creditAmountRupees,
        debitedAmount: pt.debitWindowSumRupees,
        ratio: pt.outflowRatio,
      })),
      evidence: `${detResult.component6.balanceDropEvents.length} balance drop(s) | ${detResult.component6.passThroughCandidates.length} pass-through candidate(s) (${detResult.component6.confirmedAdversePassThroughCount} confirmed adverse)`,
      formulaExplanation: detResult.component6.formulaExplanation,
    },
    bankPolicy: detResult.policyUsed,
    rawTotalScore: detResult.numericTotalScore,
    finalTotalScore: detResult.effectiveScoreOutOf100,
    statusBand: detResult.statusBand === "GREEN" ? "Green" : detResult.statusBand === "AMBER" ? "Amber" : "Red",
    hardRiskFlags: detResult.manualReviewReasons,
    mandatoryDisclaimer: MANDATORY_EVV_DISCLAIMER,
  };

  const totalCreditsSum = monthlyMetrics.reduce((s, m) => s + m.credits, 0);
  const totalDebitsSum = monthlyMetrics.reduce((s, m) => s + m.debits, 0);

  return {
    overallEVV: detResult.effectiveScoreOutOf100,
    overallEVVValue: detResult.component1.sixMonthSampledAMBRupees,
    overallGrade:
      detResult.statusBand === "GREEN"
        ? detResult.effectiveScoreOutOf100 >= 90
          ? "A+"
          : "A"
        : detResult.statusBand === "AMBER"
        ? "B"
        : detResult.effectiveScoreOutOf100 >= 50
        ? "C"
        : "D",
    overallRisk:
      detResult.statusBand === "GREEN" && detResult.manualReviewReasons.length === 0
        ? "Low"
        : detResult.statusBand === "AMBER"
        ? "Medium"
        : "High",
    statusBand: detResult.statusBand === "GREEN" ? "Green" : detResult.statusBand === "AMBER" ? "Amber" : "Red",
    totalMonths: detResult.completedCalendarMonths.length,
    totalTransactions: transactions.length,
    overallAverageBalance: detResult.component1.sixMonthSampledAMBRupees,
    overallAverageCredits: totalCreditsSum / (monthlyMetrics.length || 1),
    overallAverageDebits: totalDebitsSum / (monthlyMetrics.length || 1),
    salaryStability: detResult.component4.score === "N/A" ? 100 : Math.round((detResult.component4.verifiedInflowMonthsCount / (detResult.completedCalendarMonths.length || 1)) * 100),
    cashFlowStatus: totalCreditsSum >= totalDebitsSum ? "Positive" : "Negative",
    snapshotInterval: intervalNum,
    snapshots: allSnapshots,
    transactions,
    monthlyMetrics,
    period: {
      start: new Date(detResult.statementPeriod.start),
      end: new Date(detResult.statementPeriod.end),
    },
    evv6Components,
    sixComponent: evv6Components,
    bankPolicy: detResult.policyUsed,
    disclaimer: MANDATORY_EVV_DISCLAIMER,
    riskAnalysis: {
      lowBalanceDays: detResult.component2.dailyLowCount,
      negativeBalanceDays: detResult.component2.negativeBalanceDetected ? 1 : 0,
      largeDepositsCount: detResult.component5.largeCashAlertsCount,
      inflationEventsCount: detResult.component6.confirmedAdversePassThroughCount,
      bounceCount: detResult.component3.confirmedBouncesCount,
      salaryConsistencyScore: detResult.component4.score === "N/A" ? 100 : Math.round((detResult.component4.verifiedInflowMonthsCount / (detResult.completedCalendarMonths.length || 1)) * 100),
      emiPaymentsCount: transactions.filter((t) => (t.narration || '').toUpperCase().includes("EMI")).length,
      emiTransactions: transactions.filter((t) => (t.narration || '').toUpperCase().includes("EMI")),
    },
    deterministicEngineResult: detResult,
    auditSnapshot: detResult.auditSnapshot,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo data generator  (realistic 6-month pattern)
// ─────────────────────────────────────────────────────────────────────────────

export function generateDemoData(): Transaction[] {
  const txs: Transaction[] = [];
  let balance = 82_000;

  const push = (date: Date, debit: number, credit: number, narr: string) => {
    balance += credit - debit;
    txs.push({ date, balance: Math.max(0, balance), debit, credit, narration: narr, raw: "" });
  };

  const now = new Date();
  for (let m = 5; m >= 0; m--) {
    const targetDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const y = targetDate.getFullYear();
    const mo = targetDate.getMonth();
    const days = new Date(y, mo + 1, 0).getDate();

    // Salary on day 1
    push(new Date(y, mo, 1, 9, 0), 0, 55_000, "SALARY CREDIT / VidyaCorp Payroll");
    // Rent on day 4
    push(new Date(y, mo, 4, 10, 0), 14_000, 0, "RENT ACH / NACH0028481");
    // EMI on day 8
    push(new Date(y, mo, 8, 11, 0), 4_200, 0, "EMI NACH / LOAN DEBIT AUTO");
    // Low balance dip in month index 3
    if (m === 3) {
      push(new Date(y, mo, 26, 18, 0), 48_000, 0, "ATM CASH WITHDRAWAL");
    }
    // Random daily UPI flows
    for (let d = 2; d <= days; d += 3) {
      const amt = Math.round(Math.random() * 5_000 + 500);
      const isCr = Math.sin(d + m) > 0;
      if (isCr) push(new Date(y, mo, d, 14, 0), 0, amt, `UPI/CR/${d}${m} / NEFT INWARD`);
      else       push(new Date(y, mo, d, 16, 0), amt, 0, `UPI/DR/${d}${m} / MERCHANT PAY`);
    }
  }

  return txs.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters (re-exported for UI)
// ─────────────────────────────────────────────────────────────────────────────

export function formatCurrency(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatIntervalDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

