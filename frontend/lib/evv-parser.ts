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

export const DEFAULT_BANK_POLICIES: Record<string, BankPolicy> = {
  DEFAULT: {
    id: "POLICY-DEF-2026",
    bankName: "Standard Bank Benchmark",
    accountType: "Regular Savings Account",
    minimumBalanceBenchmark: 5000,
    strongBalanceTarget: 50000,
    fixedDates: [1, 5, 10, 15, 20, 25],
    analysisMonths: 6,
    defaultDateMode: "FIXED",
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 25000,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: "2026.1",
  },
  SBI: {
    id: "POLICY-SBI-2026",
    bankName: "State Bank of India",
    accountType: "Regular Savings",
    minimumBalanceBenchmark: 3000,
    strongBalanceTarget: 30000,
    fixedDates: [1, 5, 10, 15, 20, 25],
    analysisMonths: 6,
    defaultDateMode: "FIXED",
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 25000,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: "2026.1",
  },
  HDFC: {
    id: "POLICY-HDFC-2026",
    bankName: "HDFC Bank",
    accountType: "Savings Max / Regular",
    minimumBalanceBenchmark: 10000,
    strongBalanceTarget: 100000,
    fixedDates: [1, 5, 10, 15, 20, 25],
    analysisMonths: 6,
    defaultDateMode: "FIXED",
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 25000,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: "2026.1",
  },
  ICICI: {
    id: "POLICY-ICICI-2026",
    bankName: "ICICI Bank",
    accountType: "Privilege / Standard Savings",
    minimumBalanceBenchmark: 10000,
    strongBalanceTarget: 100000,
    fixedDates: [1, 5, 10, 15, 20, 25],
    analysisMonths: 6,
    defaultDateMode: "FIXED",
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 25000,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: "2026.1",
  },
  PNB: {
    id: "POLICY-PNB-2026",
    bankName: "Punjab National Bank",
    accountType: "General Savings",
    minimumBalanceBenchmark: 1000,
    strongBalanceTarget: 10000,
    fixedDates: [1, 5, 10, 15, 20, 25],
    analysisMonths: 6,
    defaultDateMode: "FIXED",
    largeCashDepositThreshold: 50000,
    largeCreditAbsoluteThreshold: 25000,
    largeCreditMonthlyRatioThreshold: 0.25,
    rapidOutflowDays: 3,
    rapidOutflowRatio: 0.70,
    policyVersion: "2026.1",
  },
};

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
  coApplicantProfileInput?: CoApplicantProfile
): EVVResult {
  const bankPolicy = policyInput || DEFAULT_BANK_POLICIES.DEFAULT;
  const coApplicantProfile = coApplicantProfileInput || {
    isRepaymentIncomeContributor: "YES",
    verificationStatus: "FULLY_VERIFIED",
  };
  const intervalNum = typeof intervalDays === "number" ? intervalDays : 5;

  const defaultEVV6: EVV6ComponentResult = {
    component1: {
      name: "Average Balance Trend", maxScore: 25, score: 0, sixMonthSampledAMB: 0,
      strongBalanceTarget: bankPolicy.strongBalanceTarget, baseScore: 0, consistencyDeduction: 0,
      monthsMeetingBenchmark: 0, trendDeduction: 0, trendPercent: 0, previous3MAmb: 0, latest3MAmb: 0,
      monthlySampledAMBs: [], evidence: "No data", formulaExplanation: "No transactions"
    },
    component2: {
      name: "Minimum-Balance Safety", maxScore: 20, score: 0, benchmarkM: bankPolicy.minimumBalanceBenchmark,
      sampledLowRatio: 0, dailyLowRatio: 0, finalSafetyRatio: 0, negativeBalanceDetected: false,
      overdraftDetected: false, lowBalanceDaysCount: 0, totalDaysAnalysed: 0,
      evidence: "No data", formulaExplanation: "No transactions"
    },
    component3: {
      name: "Bounce-Free Record", maxScore: 20, score: 0, confirmedBounces: 0, candidateCount: 0,
      recentBounceWithin30Days: false, bouncesIn90Days: 0, bounceEvents: [],
      evidence: "No data", formulaExplanation: "No transactions"
    },
    component4: {
      name: "Verified Financial Inflow Regularity", maxScore: 15, score: 0,
      isRepaymentIncomeContributor: "YES", profileType: "SALARIED", recurringMonthsCount: 0,
      baseScore: 0, verificationCap: 15, verificationCondition: "No data",
      evidence: "No data", formulaExplanation: "No transactions"
    },
    component5: {
      name: "Cash-Deposit Ratio", maxScore: 10, score: 0, totalCashDeposits: 0, totalCredits: 0,
      cashRatio: 0, largeCashDeposits: [], evidence: "No data", formulaExplanation: "No transactions"
    },
    component6: {
      name: "Withdrawal Discipline", maxScore: 10, score: 0, consecutiveDrops: [], passThroughEvents: [],
      evidence: "No data", formulaExplanation: "No transactions"
    },
    bankPolicy,
    rawTotalScore: 0,
    finalTotalScore: 0,
    statusBand: "Red",
    hardRiskFlags: [],
    mandatoryDisclaimer: "Internal EVV assessment — not an official bank sanction or automatic loan decision."
  };

  // ── Empty guard ────────────────────────────────────────────────────────────
  const empty = (): EVVResult => ({
    overallEVV: 0, overallEVVValue: 0, overallGrade: "F", overallRisk: "High", statusBand: "Red",
    totalMonths: 0, totalTransactions: 0, overallAverageBalance: 0,
    overallAverageCredits: 0, overallAverageDebits: 0,
    salaryStability: 0, cashFlowStatus: "Negative", snapshotInterval: intervalNum,
    snapshots: [], transactions: [], monthlyMetrics: [],
    period: { start: new Date(), end: new Date() },
    evv6Components: defaultEVV6,
    bankPolicy,
    disclaimer: defaultEVV6.mandatoryDisclaimer,
    riskAnalysis: {
      lowBalanceDays: 0, negativeBalanceDays: 0, largeDepositsCount: 0,
      inflationEventsCount: 0, bounceCount: 0, salaryConsistencyScore: 0,
      emiPaymentsCount: 0, emiTransactions: [],
    },
  });

  if (transactions.length === 0) return empty();

  // ── Step 2 – Group by month ────────────────────────────────────────────────
  const byMonth   = groupByMonth(transactions);
  const monthKeys = Object.keys(byMonth).sort();

  // ── Steps 3-6 – Per-month pipeline ────────────────────────────────────────
  const allSnapshots:     Snapshot[]      = [];
  const monthlyMetrics:   MonthlyMetric[] = [];
  let   carryBalance      = transactions[0].balance;

  for (const mKey of monthKeys) {
    const [year, month] = mKey.split("-").map(Number);
    const daysInMonth   = new Date(year, month, 0).getDate();
    const monthTxs      = byMonth[mKey];

    // Step 3 – daily closing balances
    const daily = generateDailyBalances(monthTxs, year, month, carryBalance);
    carryBalance = daily[daily.length - 1].balance;

    // Step 4 – snapshot day numbers using fixed dates or custom array
    const snapDays = generateSnapshotDays(daysInMonth, intervalDays);

    // Step 5 – sample
    const monthSnaps = sampleSnapshots(daily, snapDays, year, month);
    allSnapshots.push(...monthSnaps);

    const snapVals   = monthSnaps.map((s) => s.balance);
    const dailyVals  = daily.map((d) => d.balance);

    // Step 6 – financial metrics
    const credits        = totalCredits(monthTxs);
    const debits         = totalDebits(monthTxs);
    const netCashFlow    = credits - debits;
    const avgDailyBal    = average(dailyVals);
    const lowBalDays     = daily.filter((d) => d.balance < bankPolicy.minimumBalanceBenchmark).length;
    const closing        = daily.length > 0 ? daily[daily.length - 1].balance : (monthTxs.length > 0 ? monthTxs[monthTxs.length - 1].balance : 0);

    // Cash credits in month
    let monthCashCr = 0;
    for (const t of monthTxs) {
      if (t.credit > 0) {
        const narr = (t.narration + " " + t.raw).toLowerCase();
        const isPhysicalCash = PHYSICAL_CASH_KEYWORDS.some((k) => narr.includes(k));
        const isExcl = CASH_EXCLUSIONS.some((k) => narr.includes(k));
        if (isPhysicalCash && !isExcl) {
          monthCashCr += t.credit;
        }
      }
    }
    const cashPercent = credits > 0 ? Math.round((monthCashCr / credits) * 100) : 0;

    // Bounces in month
    const monthBounceCandidates = monthTxs.filter((t) => {
      const narr = (t.narration + " " + t.raw).toLowerCase();
      const isCand = BOUNCE_CANDIDATE_KEYWORDS.some((k) => narr.includes(k));
      const isExcl = BOUNCE_EXCLUSION_KEYWORDS.some((k) => narr.includes(k));
      return isCand && !isExcl;
    });
    const monthUniqueBounces: Transaction[] = [];
    for (const b of monthBounceCandidates) {
      const exists = monthUniqueBounces.some(
        (u) => Math.abs((u.date.getTime() - b.date.getTime()) / 86_400_000) <= 2
      );
      if (!exists) monthUniqueBounces.push(b);
    }
    const bounces = monthUniqueBounces.length;

    monthlyMetrics.push({
      label:           monthLabel(mKey),
      month:           mKey,
      points:          snapVals.length,
      avg:             average(snapVals),
      min:             snapVals.length > 0 ? Math.min(...snapVals) : 0,
      max:             snapVals.length > 0 ? Math.max(...snapVals) : 0,
      closing,
      credits,
      debits,
      cashPercent,
      bounces,
      median:          median(snapVals),
      stdDev:          standardDeviation(snapVals),
      netCashFlow,
      avgDailyBalance: avgDailyBal,
      transactions:    monthTxs.length,
      lowBalanceDays:  lowBalDays,
      riskGrade:       monthRiskGrade(avgDailyBal, netCashFlow, lowBalDays),
    });
  }

  // Calculate change vs. previous for interval snapshots
  allSnapshots.sort((a, b) => a.date.getTime() - b.date.getTime());
  for (let i = 0; i < allSnapshots.length; i++) {
    if (i === 0) {
      allSnapshots[i].changeAmount = 0;
      allSnapshots[i].changePercent = 0;
    } else {
      const prevBal = allSnapshots[i - 1].balance;
      const diff = allSnapshots[i].balance - prevBal;
      allSnapshots[i].changeAmount = diff;
      allSnapshots[i].changePercent = prevBal !== 0 ? (diff / Math.abs(prevBal)) * 100 : 0;
    }
  }

  // ── Step 7 – Global risk analysis ─────────────────────────────────────────
  const eodByDate: Record<string, number> = {};
  transactions.forEach((tx) => { eodByDate[dateKey(tx.date)] = tx.balance; });

  const startDate = new Date(
    transactions[0].date.getFullYear(),
    transactions[0].date.getMonth(),
    transactions[0].date.getDate()
  );
  const endDate = new Date(
    transactions[transactions.length - 1].date.getFullYear(),
    transactions[transactions.length - 1].date.getMonth(),
    transactions[transactions.length - 1].date.getDate()
  );

  let globalLowBalDays  = 0;
  let globalNegDays     = 0;
  let runBal            = transactions[0].balance;
  let globalBalSum      = 0;
  let totalDays         = 0;

  const cur = new Date(startDate);
  while (cur <= endDate) {
    const k = dateKey(cur);
    if (eodByDate[k] !== undefined) runBal = eodByDate[k];
    if (runBal < bankPolicy.minimumBalanceBenchmark) globalLowBalDays++;
    if (runBal < 0) globalNegDays++;
    globalBalSum += runBal;
    totalDays++;
    cur.setDate(cur.getDate() + 1);
  }

  const overallAverageBalance = totalDays > 0 ? globalBalSum / totalDays : 0;

  // Large cash deposits
  const largeDeposits = transactions.filter((t) => t.credit >= bankPolicy.largeCashDepositThreshold);

  // Temporary inflation
  let inflationCount = 0;
  for (let i = 0; i < transactions.length; i++) {
    if (transactions[i].credit < 20000) continue;
    for (let j = i + 1; j < transactions.length; j++) {
      const dayDiff = (transactions[j].date.getTime() - transactions[i].date.getTime()) / 86_400_000;
      if (dayDiff > 2) break;
      if (transactions[j].debit >= transactions[i].credit * 0.8) { inflationCount++; break; }
    }
  }

  // Bounce detection with grouping
  const candidateBounceTxs = transactions.filter((t) => {
    const narr = (t.narration + " " + t.raw).toLowerCase();
    const isCand = BOUNCE_CANDIDATE_KEYWORDS.some((k) => narr.includes(k));
    const isExcl = BOUNCE_EXCLUSION_KEYWORDS.some((k) => narr.includes(k));
    return isCand && !isExcl;
  });

  const uniqueBounceList: Transaction[] = [];
  for (const b of candidateBounceTxs) {
    const exists = uniqueBounceList.some(
      (u) => Math.abs((u.date.getTime() - b.date.getTime()) / 86_400_000) <= 2
    );
    if (!exists) uniqueBounceList.push(b);
  }
  const bounceCount = uniqueBounceList.length;

  // EMI / loan obligations
  const emiTxs = transactions.filter(
    (t) => t.debit > 0 && hasKeyword(t.narration + " " + t.raw, EMI_KW)
  );

  // Salary stability
  let salaryMonths = 0;
  monthKeys.forEach((mKey) => {
    const mTxs = byMonth[mKey];
    const hasSalary =
      mTxs.some((t) => t.credit >= 10000 && hasKeyword(t.narration + " " + t.raw, SALARY_KW)) ||
      mTxs.some((t) => t.credit >= 15000);
    if (hasSalary) salaryMonths++;
  });
  const salaryStability = monthKeys.length > 0
    ? Math.round((salaryMonths / monthKeys.length) * 100)
    : 100;

  // ── Step 8 – Authoritative 6-Component EVV Scoring ──────────────────────────
  const M = bankPolicy.minimumBalanceBenchmark;
  const strongTarget = bankPolicy.strongBalanceTarget || (10 * M);
  const hardRiskFlags: string[] = [];

  // Scored completed months (latest 6)
  const completedMonthKeys = monthKeys.slice(-6);

  // Component 1: Average Balance Trend (Max 25)
  const monthlySampledAMBs: { month: string; sampledAMB: number; benchmarkMet: boolean }[] = [];
  for (const mKey of completedMonthKeys) {
    const snapsInMonth = allSnapshots.filter((s) => monthKey(s.date) === mKey);
    const sampledAMB = snapsInMonth.length > 0
      ? Math.round(snapsInMonth.reduce((acc, s) => acc + s.balance, 0) / snapsInMonth.length)
      : 0;
    monthlySampledAMBs.push({
      month: mKey,
      sampledAMB,
      benchmarkMet: sampledAMB >= M,
    });
  }

  const sixMonthSampledAMB = monthlySampledAMBs.length > 0
    ? Math.round(monthlySampledAMBs.reduce((s, m) => s + m.sampledAMB, 0) / monthlySampledAMBs.length)
    : 0;

  const baseScore = Math.round(25 * Math.min(sixMonthSampledAMB / strongTarget, 1));
  const monthsMeetingBenchmark = monthlySampledAMBs.filter((m) => m.benchmarkMet).length;
  let consistencyDeduction = 0;
  if (monthsMeetingBenchmark === 6) consistencyDeduction = 0;
  else if (monthsMeetingBenchmark === 5) consistencyDeduction = 1;
  else if (monthsMeetingBenchmark === 4) consistencyDeduction = 3;
  else if (monthsMeetingBenchmark === 3) consistencyDeduction = 6;
  else consistencyDeduction = 10;

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

  // Component 2: Minimum-Balance Safety (Max 20)
  const sampledLowCount = allSnapshots.filter((s) => s.balance < M).length;
  const sampledLowRatio = allSnapshots.length > 0 ? (sampledLowCount / allSnapshots.length) * 100 : 0;
  const dailyLowRatio = totalDays > 0 ? (globalLowBalDays / totalDays) * 100 : 0;
  const finalSafetyRatio = Math.max(sampledLowRatio, dailyLowRatio);

  let comp2Score = 20;
  if (finalSafetyRatio === 0) comp2Score = 20;
  else if (finalSafetyRatio <= 5) comp2Score = 17;
  else if (finalSafetyRatio <= 10) comp2Score = 14;
  else if (finalSafetyRatio <= 20) comp2Score = 8;
  else if (finalSafetyRatio <= 35) comp2Score = 4;
  else comp2Score = 0;

  const negativeBalanceDetected = globalNegDays > 0;
  if (negativeBalanceDetected) {
    comp2Score = 0;
    hardRiskFlags.push("Negative balance or unauthorised overdraft detected (Component 2 forced to 0).");
  }

  // Component 3: Bounce-Free Record (Max 20)
  let comp3Score = 20;
  if (bounceCount === 0) comp3Score = 20;
  else if (bounceCount === 1) comp3Score = 10;
  else if (bounceCount === 2) comp3Score = 5;
  else comp3Score = 0;

  const lastTxDate = transactions[transactions.length - 1]?.date;
  let recentBounceWithin30Days = false;
  let bouncesIn90Days = 0;
  uniqueBounceList.forEach((b) => {
    const diffDays = Math.abs((lastTxDate.getTime() - b.date.getTime()) / 86_400_000);
    if (diffDays <= 30) recentBounceWithin30Days = true;
    if (diffDays <= 90) bouncesIn90Days++;
  });
  if (recentBounceWithin30Days) hardRiskFlags.push("Recent returned payment detected within the last 30 days of statement.");
  if (bouncesIn90Days >= 2) hardRiskFlags.push(`${bouncesIn90Days} payment return/bounce events detected in latest 90 days.`);

  // Component 4: Verified Financial Inflow Regularity (Max 15)
  let comp4Score: number | 'N/A' = 0;
  let recurringMonthsCount = 0;
  let c4BaseScore = 0;
  let verificationCap = 15;
  let verificationCondition = "Source, recurrence, and eligibility verified";

  const incomeRole = coApplicantProfile.isRepaymentIncomeContributor || "YES";
  if (incomeRole === "NO") {
    comp4Score = "N/A";
    verificationCondition = "Non-income contributor (co-applicant income not used for repayment/FOIR)";
  } else if (incomeRole === "UNKNOWN") {
    comp4Score = 0;
    verificationCondition = "Unknown repayment-income contributor role";
    hardRiskFlags.push("Repayment income contributor role is unconfirmed / unknown.");
  } else {
    for (const mKey of completedMonthKeys) {
      const mTxs = byMonth[mKey] || [];
      const hasEligibleCredit = mTxs.some((t) => {
        const narr = (t.narration + " " + t.raw).toLowerCase();
        const isCash = PHYSICAL_CASH_KEYWORDS.some((k) => narr.includes(k));
        const isExcl = ["reversal", "refund", "cashback", "own transfer", "self transfer", "loan disb"].some((k) => narr.includes(k));
        return !isCash && !isExcl && t.credit >= 5000;
      });
      if (hasEligibleCredit) recurringMonthsCount++;
    }

    if (recurringMonthsCount >= 6) c4BaseScore = 15;
    else if (recurringMonthsCount === 5) c4BaseScore = 13;
    else if (recurringMonthsCount === 4) c4BaseScore = 10;
    else if (recurringMonthsCount === 3) c4BaseScore = 6;
    else c4BaseScore = 0;

    const vStatus = coApplicantProfile.verificationStatus || "FULLY_VERIFIED";
    if (vStatus === "FULLY_VERIFIED") verificationCap = 15;
    else if (vStatus === "PENDING_DOCS") { verificationCap = 10; verificationCondition = "Statement pattern appears genuine; documents pending"; }
    else if (vStatus === "UNCLEAR") { verificationCap = 6; verificationCondition = "Recurring credits exist but source/eligibility unclear"; }
    else { verificationCap = 0; verificationCondition = "Source not established"; }

    comp4Score = Math.min(c4BaseScore, verificationCap);
  }

  // Component 5: Cash-Deposit Ratio (Max 10)
  let totalCrSum = 0;
  let totalCashSum = 0;
  const cashList: { date: string; narration: string; amount: number }[] = [];

  transactions.forEach((t) => {
    if (t.credit > 0) {
      totalCrSum += t.credit;
      const narr = (t.narration + " " + t.raw).toLowerCase();
      const isPhysicalCash = PHYSICAL_CASH_KEYWORDS.some((k) => narr.includes(k));
      const isExcl = CASH_EXCLUSIONS.some((k) => narr.includes(k));
      if (isPhysicalCash && !isExcl) {
        totalCashSum += t.credit;
        cashList.push({
          date: dateKey(t.date),
          narration: t.narration,
          amount: t.credit,
        });
      }
    }
  });

  const cashRatio = totalCrSum > 0 ? (totalCashSum / totalCrSum) * 100 : 0;
  let comp5Score = 10;
  if (cashRatio < 10) comp5Score = 10;
  else if (cashRatio <= 20) comp5Score = 7;
  else if (cashRatio <= 35) comp5Score = 4;
  else comp5Score = 0;

  const avgMoCredits = totalCrSum / (completedMonthKeys.length || 1);
  const largeCashAlertThreshold = Math.min(bankPolicy.largeCashDepositThreshold, 0.25 * avgMoCredits || 50000);
  const largeCashTxs = cashList.filter((c) => c.amount >= largeCashAlertThreshold);
  if (largeCashTxs.length > 0) {
    hardRiskFlags.push(`${largeCashTxs.length} large physical cash deposit(s) (≥₹${largeCashAlertThreshold.toLocaleString('en-IN')}) detected.`);
  }

  // Component 6: Withdrawal Discipline (Max 10)
  const consecutiveDrops: { fromDate: string; toDate: string; fromBal: number; toBal: number; dropPercent: number; severity: string }[] = [];
  let modDrops = 0;
  let sevDrops = 0;
  let critDrops = 0;

  for (let i = 1; i < allSnapshots.length; i++) {
    const prevSnap = allSnapshots[i - 1];
    const currSnap = allSnapshots[i];
    if (prevSnap.balance >= M && prevSnap.balance > currSnap.balance) {
      const dropPercent = ((prevSnap.balance - currSnap.balance) / prevSnap.balance) * 100;
      let severity = "NORMAL";
      if (dropPercent >= 90) { severity = "CRITICAL"; critDrops++; }
      else if (dropPercent >= 75) { severity = "SEVERE"; sevDrops++; }
      else if (dropPercent >= 50) { severity = "MODERATE"; modDrops++; }

      if (severity !== "NORMAL") {
        consecutiveDrops.push({
          fromDate: dateKey(prevSnap.date),
          toDate: dateKey(currSnap.date),
          fromBal: prevSnap.balance,
          toBal: currSnap.balance,
          dropPercent: Math.round(dropPercent),
          severity,
        });
      }
    }
  }

  const largeCreditThreshold = Math.max(bankPolicy.largeCreditAbsoluteThreshold || 25000, 0.25 * avgMoCredits);
  const passThroughEvents: { creditDate: string; creditAmount: number; debitedAmount: number; ratio: number }[] = [];

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    if (tx.credit >= largeCreditThreshold) {
      let debitsInWindow = 0;
      for (let j = i + 1; j < transactions.length; j++) {
        const nextTx = transactions[j];
        const daysDiff = (nextTx.date.getTime() - tx.date.getTime()) / 86_400_000;
        if (daysDiff > bankPolicy.rapidOutflowDays) break;
        if (nextTx.debit > 0) debitsInWindow += nextTx.debit;
      }
      const outflowRatio = (debitsInWindow / tx.credit) * 100;
      if (outflowRatio >= bankPolicy.rapidOutflowRatio * 100) {
        passThroughEvents.push({
          creditDate: dateKey(tx.date),
          creditAmount: tx.credit,
          debitedAmount: debitsInWindow,
          ratio: Math.round(outflowRatio),
        });
      }
    }
  }

  let dropsScore = 10;
  if (critDrops >= 1) dropsScore = 3;
  else if (sevDrops >= 2) dropsScore = 4;
  else if (sevDrops === 1 || modDrops >= 2) dropsScore = 6;
  else if (modDrops === 1) dropsScore = 8;
  else dropsScore = 10;

  let passThroughScore = 10;
  if (passThroughEvents.length >= 3) passThroughScore = 0;
  else if (passThroughEvents.length === 2) passThroughScore = 1;
  else if (passThroughEvents.length === 1) passThroughScore = 4;
  else passThroughScore = 10;

  const comp6Score = Math.min(dropsScore, passThroughScore);

  // Final Total Score and Status Band
  const rawTotalScore = comp1Score + comp2Score + comp3Score + (comp4Score === "N/A" ? 0 : comp4Score) + comp5Score + comp6Score;
  const finalTotalScore = comp4Score === "N/A" ? Math.min(100, Math.round((rawTotalScore / 85) * 100)) : Math.min(100, rawTotalScore);

  const statusBand: "Green" | "Amber" | "Red" =
    finalTotalScore >= 80 ? "Green" :
    finalTotalScore >= 60 ? "Amber" : "Red";

  const overallGrade =
    finalTotalScore >= 90 ? "A+" :
    finalTotalScore >= 80 ? "A" :
    finalTotalScore >= 65 ? "B" :
    finalTotalScore >= 50 ? "C" : "D";

  const overallRisk: "Low" | "Medium" | "High" =
    statusBand === "Green" && hardRiskFlags.length === 0 ? "Low" :
    statusBand === "Amber" ? "Medium" : "High";

  const evv6Components: EVV6ComponentResult = {
    component1: {
      name: "Average Balance Trend", maxScore: 25, score: comp1Score,
      sixMonthSampledAMB, strongBalanceTarget: strongTarget, baseScore, consistencyDeduction,
      monthsMeetingBenchmark, trendDeduction, trendPercent: Math.round(trendPercent * 10) / 10,
      previous3MAmb, latest3MAmb, monthlySampledAMBs,
      evidence: `6M AMB: ₹${sixMonthSampledAMB.toLocaleString("en-IN")} | Consistency: ${monthsMeetingBenchmark}/${monthlySampledAMBs.length} mos | Trend: ${trendPercent >= 0 ? "+" : ""}${trendPercent.toFixed(1)}%`,
      formulaExplanation: `Base Score = round(25 × min(${sixMonthSampledAMB}/${strongTarget}, 1)) = ${baseScore}. Consistency Deduction = ${consistencyDeduction}. Trend Deduction = ${trendDeduction}. Score = max(0, ${baseScore} - ${consistencyDeduction} - ${trendDeduction}) = ${comp1Score}/25.`,
    },
    component2: {
      name: "Minimum-Balance Safety", maxScore: 20, score: comp2Score, benchmarkM: M,
      sampledLowRatio: Math.round(sampledLowRatio * 10) / 10, dailyLowRatio: Math.round(dailyLowRatio * 10) / 10,
      finalSafetyRatio: Math.round(finalSafetyRatio * 10) / 10, negativeBalanceDetected,
      overdraftDetected: negativeBalanceDetected, lowBalanceDaysCount: globalLowBalDays, totalDaysAnalysed: totalDays,
      evidence: `Benchmark M: ₹${M.toLocaleString("en-IN")} | Final Safety Ratio: ${finalSafetyRatio.toFixed(1)}% (Sampled Low: ${sampledLowRatio.toFixed(1)}%, Daily Low: ${dailyLowRatio.toFixed(1)}%)`,
      formulaExplanation: `Final Safety Ratio = max(${sampledLowRatio.toFixed(1)}%, ${dailyLowRatio.toFixed(1)}%) = ${finalSafetyRatio.toFixed(1)}%. Score = ${comp2Score}/20.${negativeBalanceDetected ? " Negative balance detected: 0 override." : ""}`,
    },
    component3: {
      name: "Bounce-Free Record", maxScore: 20, score: comp3Score, confirmedBounces: bounceCount,
      candidateCount: candidateBounceTxs.length, recentBounceWithin30Days, bouncesIn90Days,
      bounceEvents: uniqueBounceList.map((b) => ({ date: dateKey(b.date), narration: b.narration, amount: b.debit || b.credit })),
      evidence: `${bounceCount} confirmed bounce/dishonour event(s) detected (${bouncesIn90Days} in last 90 days)`,
      formulaExplanation: `Evaluated all statement dates for NACH/ECS/EMI/Cheque return keywords. Unique grouped events: ${bounceCount}. Points: ${comp3Score}/20.`,
    },
    component4: {
      name: "Verified Financial Inflow Regularity", maxScore: 15, score: comp4Score,
      isRepaymentIncomeContributor: incomeRole, profileType: coApplicantProfile.declaredIncomeType || "SALARIED",
      recurringMonthsCount, baseScore: c4BaseScore, verificationCap, verificationCondition,
      evidence: incomeRole === "NO"
        ? "N/A — Non-income contributor (primary earning co-applicant assessed separately)"
        : `${recurringMonthsCount}/${completedMonthKeys.length} recurring months verified. Cap: ${verificationCap}/15. Condition: ${verificationCondition}`,
      formulaExplanation: incomeRole === "NO"
        ? "Component 4 marked N/A. Score scaled over 85 to 100."
        : `Recurrence Score: ${c4BaseScore}/15, Verification Cap: ${verificationCap}/15. Score: min(${c4BaseScore}, ${verificationCap}) = ${comp4Score}/15.`,
    },
    component5: {
      name: "Cash-Deposit Ratio", maxScore: 10, score: comp5Score, totalCashDeposits: totalCashSum,
      totalCredits: totalCrSum, cashRatio: Math.round(cashRatio * 10) / 10,
      largeCashDeposits: largeCashTxs,
      evidence: `Cash Deposits: ₹${totalCashSum.toLocaleString("en-IN")} / Total Credits: ₹${totalCrSum.toLocaleString("en-IN")} (${cashRatio.toFixed(1)}%)`,
      formulaExplanation: `Cash Deposit Ratio = (${totalCashSum}/${totalCrSum}) × 100 = ${cashRatio.toFixed(1)}%. Score = ${comp5Score}/10.${largeCashTxs.length > 0 ? ` ${largeCashTxs.length} large cash deposit(s) flagged.` : ""}`,
    },
    component6: {
      name: "Withdrawal Discipline", maxScore: 10, score: comp6Score,
      consecutiveDrops, passThroughEvents,
      evidence: `${consecutiveDrops.length} sharp balance drop(s) (Mod: ${modDrops}, Sev: ${sevDrops}, Crit: ${critDrops}) | ${passThroughEvents.length} rapid pass-through event(s)`,
      formulaExplanation: `Drop Score: ${dropsScore}/10, Pass-Through Score: ${passThroughScore}/10. Final Component 6 = min(${dropsScore}, ${passThroughScore}) = ${comp6Score}/10.`,
    },
    bankPolicy,
    rawTotalScore,
    finalTotalScore,
    statusBand,
    hardRiskFlags,
    mandatoryDisclaimer: "Internal EVV assessment — not an official bank sanction or automatic loan decision."
  };

  const snapBalances = allSnapshots.map((s) => s.balance);
  const snapshotAvg = average(snapBalances);
  const totalCr = monthlyMetrics.reduce((s, m) => s + m.credits, 0);
  const totalDb = monthlyMetrics.reduce((s, m) => s + m.debits, 0);
  const netCF = totalCr - totalDb;

  return {
    overallEVV: finalTotalScore,
    overallEVVValue: snapshotAvg,
    overallGrade,
    overallRisk,
    statusBand,
    totalMonths: monthKeys.length,
    totalTransactions: transactions.length,
    overallAverageBalance,
    overallAverageCredits: totalCr / (monthKeys.length || 1),
    overallAverageDebits: totalDb / (monthKeys.length || 1),
    salaryStability,
    cashFlowStatus: netCF >= 0 ? "Positive" : "Negative",
    snapshotInterval: intervalNum,
    snapshots: allSnapshots,
    transactions,
    monthlyMetrics,
    period: { start: transactions[0].date, end: transactions[transactions.length - 1].date },
    evv6Components,
    sixComponent: evv6Components,
    bankPolicy,
    disclaimer: evv6Components.mandatoryDisclaimer,
    riskAnalysis: {
      lowBalanceDays: globalLowBalDays,
      negativeBalanceDays: globalNegDays,
      largeDepositsCount: largeDeposits.length,
      inflationEventsCount: inflationCount,
      bounceCount,
      salaryConsistencyScore: salaryStability,
      emiPaymentsCount: emiTxs.length,
      emiTransactions: emiTxs,
    },
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

