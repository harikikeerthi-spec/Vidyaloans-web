/**
 * ============================================================================
 * Mandatory Test Suite for Deterministic EVV Calculation Engine
 * Covers all 15 specification test cases:
 *
 *  1. Fixed dates [1,5,10,15,20,25] repeat separately in every month.
 *  2. Custom date 31 maps to last day of April and February.
 *  3. Missing transaction on a target date uses prior day’s closing balance, never a future balance.
 *  4. Statement 1 March–3 September scores March–August only.
 *  5. Multiple same-day transactions use the final same-day balance.
 *  6. Monthly sampled AMB is arithmetic mean of selected-date balances, not sum and not daily AMB.
 *  7. C1 correctly applies target formula, consistency deductions and trend deductions.
 *  8. C2 uses the worse of daily-low and sampled-low ratio.
 *  9. A bounce plus return charge counts as one event.
 * 10. UPI/IMPS/NEFT credit is not classified as physical cash deposit.
 * 11. Large same-day credit and debit becomes a pass-through candidate, not automatically confirmed adverse event.
 * 12. Non-income-contributor status yields Component 4 = N/A, not 0.
 * 13. Every component is clamped to its maximum and minimum.
 * 14. Final score never exceeds 100.
 * 15. Custom date approval and score calculation are audit logged.
 * ============================================================================
 */

import {
  calculateDeterministicEVV,
  sampleBalancesForMonths,
  buildDailyBalances,
  normalizeTransactions,
  identifyCompletedMonths,
  parseCustomDates,
  DEFAULT_BANK_POLICIES,
  rupeesToPaise,
  type RawInputTransaction,
} from '../evv-engine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED] ${message}`);
  }
}

function runAllTests() {
  console.log("================================================================================");
  console.log("Running Mandatory EVV Engine Tests (15 Test Cases)...");
  console.log("================================================================================");

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: Fixed dates [1,5,10,15,20,25] repeat separately in every month
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 1: Fixed dates repeat in every completed month (36 samples for 6 months)...");
    const txs: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 50000, narration: 'Opening' },
      { date: '2025-06-30', balance: 50000, narration: 'Closing' },
    ];
    const res = calculateDeterministicEVV({
      transactions: txs,
      policy: { analysisMonths: 6, fixedDays: [1, 5, 10, 15, 20, 25] },
    });

    assert(res.completedCalendarMonths.length === 6, "Expected 6 complete months Jan-Jun 2025");
    assert(res.selectedSamples.length === 36, `Expected 36 samples, got ${res.selectedSamples.length}`);

    // Verify all 6 months have 6 samples with days 1,5,10,15,20,25
    res.completedCalendarMonths.forEach((m) => {
      const monthSamples = res.selectedSamples.filter((s) => s.month === m);
      assert(monthSamples.length === 6, `Month ${m} must have 6 samples`);
      const days = monthSamples.map((s) => s.requestedDay);
      assert(JSON.stringify(days) === JSON.stringify([1, 5, 10, 15, 20, 25]), `Invalid days in ${m}`);
    });
    console.log("✓ TEST 1 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Custom date 31 maps to last day of April and February
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 2: Month-end clamping (day 31 -> Feb 28 in 2025, Apr 30)...");
    const txs: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 40000, narration: 'Opening' },
      { date: '2025-06-30', balance: 40000, narration: 'Closing' },
    ];
    const res = calculateDeterministicEVV({
      transactions: txs,
      dateMode: 'CUSTOM',
      customDays: [31],
    });

    const febSample = res.selectedSamples.find((s) => s.month === '2025-02');
    const aprSample = res.selectedSamples.find((s) => s.month === '2025-04');
    const marSample = res.selectedSamples.find((s) => s.month === '2025-03');

    assert(febSample?.targetDate === '2025-02-28', `Expected 2025-02-28, got ${febSample?.targetDate}`);
    assert(aprSample?.targetDate === '2025-04-30', `Expected 2025-04-30, got ${aprSample?.targetDate}`);
    assert(marSample?.targetDate === '2025-03-31', `Expected 2025-03-31, got ${marSample?.targetDate}`);
    console.log("✓ TEST 2 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: Missing transaction on a target date uses prior day’s closing balance, never future balance
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 3: Missing transaction carries forward prior day balance, never future balance...");
    const txs: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 10000, narration: 'Jan 1 bal' },
      { date: '2025-01-10', balance: 90000, narration: 'Jan 10 deposit' },
      { date: '2025-06-30', balance: 90000, narration: 'End' },
    ];
    const res = calculateDeterministicEVV({
      transactions: txs,
      policy: { fixedDays: [1, 5, 10] },
    });

    const sampleJan5 = res.selectedSamples.find((s) => s.targetDate === '2025-01-05');
    assert(sampleJan5 !== undefined, "Sample Jan 5 must exist");
    assert(
      sampleJan5!.closingBalanceRupees === 10000,
      `Expected Jan 5 to carry forward Jan 1 balance (₹10,000), not future Jan 10 (₹90,000). Got ₹${sampleJan5!.closingBalanceRupees}`
    );
    console.log("✓ TEST 3 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: Statement 1 March–3 September scores March–August only
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 4: Partial ending month exclusion (01-Mar to 03-Sep scores Mar-Aug only)...");
    const window = identifyCompletedMonths('2025-03-01', '2025-09-03', 6);
    assert(
      JSON.stringify(window.completedMonths) ===
        JSON.stringify(['2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08']),
      `Expected 2025-03 to 2025-08, got ${JSON.stringify(window.completedMonths)}`
    );
    assert(window.partialEndMonth === '2025-09', "September should be flagged as partialEndMonth");
    console.log("✓ TEST 4 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5: Multiple same-day transactions use final same-day balance
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 5: Final same-day balance used for daily closing...");
    const raw: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 5000, narration: 'Tx 1' },
      { date: '2025-01-01', balance: 25000, narration: 'Tx 2' },
      { date: '2025-01-01', balance: 45000, narration: 'Tx 3 final' },
      { date: '2025-06-30', balance: 45000, narration: 'Closing' },
    ];
    const norm = normalizeTransactions(raw);
    const daily = buildDailyBalances(norm);
    const jan1 = daily.find((d) => d.date === '2025-01-01');
    assert(
      jan1?.closingBalancePaise === rupeesToPaise(45000),
      `Expected Jan 1 balance ₹45,000, got ${jan1 ? Number(jan1.closingBalancePaise) / 100 : 'none'}`
    );
    console.log("✓ TEST 5 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 6: Monthly sampled AMB is arithmetic mean of selected-date balances, not sum and not daily AMB
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 6: Monthly sampled AMB is arithmetic mean of selected dates...");
    // Create month with known balances on 1, 5, 10, 15, 20, 25
    // 10k, 20k, 30k, 40k, 50k, 60k -> Sum = 210k -> Mean = 35,000
    const txs: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 10000, narration: 'D1' },
      { date: '2025-01-05', balance: 20000, narration: 'D5' },
      { date: '2025-01-10', balance: 30000, narration: 'D10' },
      { date: '2025-01-15', balance: 40000, narration: 'D15' },
      { date: '2025-01-20', balance: 50000, narration: 'D20' },
      { date: '2025-01-25', balance: 60000, narration: 'D25' },
      { date: '2025-06-30', balance: 60000, narration: 'End' },
    ];
    const res = calculateDeterministicEVV({
      transactions: txs,
      policy: { fixedDays: [1, 5, 10, 15, 20, 25] },
    });

    const janMetric = res.component1.monthlyBreakdown.find((m) => m.month === '2025-01');
    assert(janMetric !== undefined, "Jan metric must exist");
    assert(
      janMetric!.monthlySampledAMBRupees === 35000,
      `Expected Jan Sampled AMB to be ₹35,000. Got ₹${janMetric!.monthlySampledAMBRupees}`
    );
    console.log("✓ TEST 6 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 7: C1 correctly applies target formula, consistency deductions and trend deductions
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 7: C1 target formula, consistency deduction and trend deduction...");
    // 6 months where sampled AMB is consistently ₹50,000, Benchmark M=₹5,000, Target T=₹50,000
    // Base = 25 * min(50000/50000, 1) = 25
    // 6 of 6 meet M -> deduction 0
    // Stable trend -> deduction 0
    // C1 = 25
    const txsStable: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 50000, narration: 'Stable' },
      { date: '2025-06-30', balance: 50000, narration: 'Stable end' },
    ];
    const resStable = calculateDeterministicEVV({
      transactions: txsStable,
      policy: { minimumBalanceBenchmark: 5000, strongBalanceTarget: 50000 },
    });
    assert(resStable.component1.basePoints === 25, `Expected base 25, got ${resStable.component1.basePoints}`);
    assert(resStable.component1.consistencyDeduction === 0, "Expected 0 consistency deduction");
    assert(resStable.component1.trendDeduction === 0, "Expected 0 trend deduction");
    assert(resStable.component1.score === 25, `Expected C1 score 25, got ${resStable.component1.score}`);

    // Now test a declining trend of >40% and 4 months meeting benchmark
    // P3M = 60,000, L3M = 30,000 -> -50% decline -> trend deduction = 10
    // 4 of 6 meet benchmark -> consistency deduction = 3
    const txsDecline: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 60000, narration: 'High start' },
      { date: '2025-03-31', balance: 60000, narration: 'High end' },
      { date: '2025-04-01', balance: 30000, narration: 'Low start' },
      { date: '2025-06-30', balance: 30000, narration: 'Low end' },
    ];
    const resDecline = calculateDeterministicEVV({
      transactions: txsDecline,
      policy: { minimumBalanceBenchmark: 5000, strongBalanceTarget: 50000 },
    });
    assert(resDecline.component1.trendDeduction === 10, `Expected trend deduction 10, got ${resDecline.component1.trendDeduction}`);
    console.log("✓ TEST 7 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 8: C2 uses the worse of daily-low and sampled-low ratio
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 8: C2 uses conservative max(sampledLowRatio, dailyLowRatio)...");
    // Suppose sampled days never drop below M (sampledLow = 0%),
    // but on mid-month un-sampled days, balance drops below M for 15% of total days.
    const txs: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 20000, narration: 'D1 high' },
      // Drop between sampled dates 1 and 5
      { date: '2025-01-02', balance: 1000, narration: 'D2 dip below M' },
      { date: '2025-01-03', balance: 1000, narration: 'D3 dip below M' },
      { date: '2025-01-04', balance: 1000, narration: 'D4 dip below M' },
      { date: '2025-01-05', balance: 20000, narration: 'D5 recovered' },
      { date: '2025-06-30', balance: 20000, narration: 'Closing' },
    ];
    const res = calculateDeterministicEVV({
      transactions: txs,
      policy: { minimumBalanceBenchmark: 5000, fixedDays: [1, 5, 10, 15, 20, 25] },
    });

    assert(res.component2.sampledLowRatio === 0, `Sampled low ratio should be 0%, got ${res.component2.sampledLowRatio}`);
    assert(res.component2.dailyLowRatio > 0, `Daily low ratio should be > 0%, got ${res.component2.dailyLowRatio}`);
    assert(
      res.component2.finalSafetyRatio === res.component2.dailyLowRatio,
      "Final safety ratio must equal the daily ratio when daily ratio is worse"
    );
    assert(res.component2.governingRatioType === 'DAILY', "Governing ratio type should be DAILY");
    console.log("✓ TEST 8 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 9: A bounce plus return charge counts as one event
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 9: Bounce + linked return charge grouped as 1 unique bounce event...");
    const txs: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 30000, narration: 'Opening' },
      { date: '2025-02-14', debit: 5000, balance: 25000, narration: 'ECS RETURN UNPAID INSUFFICIENT FUNDS' },
      { date: '2025-02-14', debit: 590, balance: 24410, narration: 'RETURN CHARGES GST INCL' },
      { date: '2025-06-30', balance: 24410, narration: 'End' },
    ];
    const res = calculateDeterministicEVV({ transactions: txs });
    assert(
      res.component3.confirmedBouncesCount === 1,
      `Expected 1 confirmed bounce event after grouping return + charge, got ${res.component3.confirmedBouncesCount}`
    );
    assert(res.component3.score === 10, `Expected C3 score 10 for 1 bounce, got ${res.component3.score}`);
    console.log("✓ TEST 9 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 10: UPI/IMPS/NEFT credit is not classified as physical cash deposit
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 10: Digital UPI/IMPS/NEFT credits excluded from physical cash count...");
    const txs: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 10000, narration: 'Opening' },
      { date: '2025-01-10', credit: 50000, balance: 60000, narration: 'UPI/234982/SHOP PAYMENT' },
      { date: '2025-02-10', credit: 50000, balance: 110000, narration: 'NEFT CR-HDFC0001-SALARY TRF' },
      { date: '2025-03-10', credit: 50000, balance: 160000, narration: 'IMPS P2A TRANSFER' },
      { date: '2025-06-30', balance: 160000, narration: 'End' },
    ];
    const res = calculateDeterministicEVV({ transactions: txs });
    assert(
      res.component5.totalConfirmedCashRupees === 0,
      `Expected ₹0 cash deposits, got ₹${res.component5.totalConfirmedCashRupees}`
    );
    assert(res.component5.cashDepositRatio === 0, "Cash deposit ratio should be 0%");
    assert(res.component5.score === 10, `Expected C5 score 10/10, got ${res.component5.score}`);
    console.log("✓ TEST 10 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 11: Large same-day credit and debit becomes pass-through candidate, not automatically confirmed adverse
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 11: Rapid pass-through generates candidate requiring staff classification...");
    const txs: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 20000, narration: 'Opening' },
      { date: '2025-02-05', credit: 100000, balance: 120000, narration: 'CLIENT INVOICE PAYMENT' },
      { date: '2025-02-06', debit: 90000, balance: 30000, narration: 'COLLEGE TUITION FEE PAYMENT' },
      { date: '2025-06-30', balance: 30000, narration: 'End' },
    ];
    // Default engine flags candidate as UNEXPLAINED unless classified
    const resCandidate = calculateDeterministicEVV({ transactions: txs });
    assert(
      resCandidate.component6.passThroughCandidates.length === 1,
      "Expected 1 pass-through candidate to be detected"
    );

    // Now classify it as DOCUMENTED_TUITION_OR_HOUSEHOLD_EXPENSE
    const resClassified = calculateDeterministicEVV({
      transactions: txs,
      candidateClassifications: {
        passThrough: {
          pt_1: 'DOCUMENTED_TUITION_OR_HOUSEHOLD_EXPENSE',
        },
      },
    });
    assert(
      resClassified.component6.confirmedAdversePassThroughCount === 0,
      "Explained tuition fee must NOT be counted as confirmed adverse"
    );
    assert(resClassified.component6.passThroughScore === 10, "Pass-through score must be 10 for explained fee");
    console.log("✓ TEST 11 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 12: Non-income-contributor status yields Component 4 = N/A, not 0
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 12: Non-income-contributor yields C4 = N/A (not penalized as 0)...");
    const txs: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 50000, narration: 'Opening' },
      { date: '2025-06-30', balance: 50000, narration: 'End' },
    ];
    const res = calculateDeterministicEVV({
      transactions: txs,
      profile: {
        isRepaymentIncomeContributor: 'NO',
        profileType: 'HOMEMAKER_NON_INCOME_CONTRIBUTOR',
      },
    });
    assert(res.component4.score === 'N/A', `Expected C4 score to be 'N/A', got ${res.component4.score}`);
    console.log("✓ TEST 12 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 13: Every component is clamped to its maximum and minimum
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 13: Component score boundaries clamped to [0, max]...");
    const txs: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 1000000, narration: 'Huge balance' },
      { date: '2025-06-30', balance: 1000000, narration: 'Huge end' },
    ];
    const res = calculateDeterministicEVV({
      transactions: txs,
      policy: { strongBalanceTarget: 50000 },
    });
    assert(res.component1.score <= 25 && res.component1.score >= 0, "C1 must be 0-25");
    assert(res.component2.score <= 20 && res.component2.score >= 0, "C2 must be 0-20");
    assert(res.component3.score <= 20 && res.component3.score >= 0, "C3 must be 0-20");
    assert(res.component5.score <= 10 && res.component5.score >= 0, "C5 must be 0-10");
    assert(res.component6.score <= 10 && res.component6.score >= 0, "C6 must be 0-10");
    console.log("✓ TEST 13 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 14: Final score never exceeds 100
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 14: Final score never exceeds 100...");
    const txs: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 1000000, narration: 'Opening' },
      { date: '2025-01-15', credit: 200000, balance: 1200000, narration: 'SALARY JAN' },
      { date: '2025-02-15', credit: 200000, balance: 1400000, narration: 'SALARY FEB' },
      { date: '2025-03-15', credit: 200000, balance: 1600000, narration: 'SALARY MAR' },
      { date: '2025-04-15', credit: 200000, balance: 1800000, narration: 'SALARY APR' },
      { date: '2025-05-15', credit: 200000, balance: 2000000, narration: 'SALARY MAY' },
      { date: '2025-06-15', credit: 200000, balance: 2200000, narration: 'SALARY JUN' },
      { date: '2025-06-30', balance: 2200000, narration: 'End' },
    ];
    const res = calculateDeterministicEVV({
      transactions: txs,
      profile: {
        isRepaymentIncomeContributor: 'YES',
        supportingDocuments: ['SALARY_SLIP', 'FORM_16'],
      },
    });
    assert(res.numericTotalScore <= 100, `Expected total <= 100, got ${res.numericTotalScore}`);
    assert(res.numericTotalScore >= 0, `Expected total >= 0, got ${res.numericTotalScore}`);
    console.log("✓ TEST 14 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 15: Custom date approval and score calculation are audit logged
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 15: Custom date approval and audit snapshot persistence...");
    const txs: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 50000, narration: 'Opening' },
      { date: '2025-06-30', balance: 50000, narration: 'End' },
    ];
    const approval = {
      customDays: [3, 12, 22, 28],
      reason: 'Aligning with monthly salary cycle on 2nd of month',
      managerApproverId: 'MGR_SHRIRAM_902',
      approvedAt: '2026-03-20T10:00:00Z',
    };
    const res = calculateDeterministicEVV({
      transactions: txs,
      dateMode: 'CUSTOM',
      customDays: approval.customDays,
      customApproval: approval,
    });

    assert(res.customDateApproval?.managerApproverId === 'MGR_SHRIRAM_902', "Approver ID mismatch");
    assert(res.auditSnapshot !== undefined, "Audit snapshot must exist");
    assert(res.auditSnapshot.dateMode === 'CUSTOM', "Audit dateMode must be CUSTOM");
    assert(res.auditSnapshot.policy.policyVersion !== undefined, "Policy version must be in audit snapshot");
    assert(res.auditSnapshot.samples.length === 24, `Expected 24 samples (4 days * 6 months), got ${res.auditSnapshot.samples.length}`);
    console.log("✓ TEST 15 PASSED\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 16: Custom dates parsing ("1 to 31", "1-31", ranges) & EVV calculation
  // ─────────────────────────────────────────────────────────────────────────
  {
    console.log("TEST 16: Custom dates starting from 1 to 31, range parsing & EVV execution...");
    const parsedRange1 = parseCustomDates("1 to 31");
    assert(parsedRange1.length === 31, `Expected 31 dates, got ${parsedRange1.length}`);
    assert(parsedRange1[0] === 1, `Expected first date 1, got ${parsedRange1[0]}`);
    assert(parsedRange1[30] === 31, `Expected last date 31, got ${parsedRange1[30]}`);

    const parsedRange2 = parseCustomDates("1-31");
    assert(parsedRange2.length === 31, `Expected 31 dates for "1-31", got ${parsedRange2.length}`);

    const parsedCustom = parseCustomDates("1, 5, 10, 15, 20, 25");
    assert(parsedCustom.length === 6, `Expected 6 dates, got ${parsedCustom.length}`);
    assert(parsedCustom[0] === 1 && parsedCustom[5] === 25, `Expected 1..25, got ${parsedCustom}`);

    const txs: RawInputTransaction[] = [
      { date: '2025-01-01', balance: 35000, narration: 'Opening salary' },
      { date: '2025-01-15', balance: 32000, debit: 3000, narration: 'Utility bill' },
      { date: '2025-06-30', balance: 40000, credit: 8000, narration: 'Closing bal' },
    ];

    const resAllDays = calculateDeterministicEVV({
      transactions: txs,
      dateMode: 'CUSTOM',
      customDays: parsedRange1,
    });

    assert(resAllDays.selectedSamples.length > 0, "Selected samples must not be empty");
    // Verify each completed calendar month has unique dates (Feb should have 28, Apr 30, Jan/Mar/May 31)
    const febSamples = resAllDays.selectedSamples.filter((s) => s.month === '2025-02');
    const aprSamples = resAllDays.selectedSamples.filter((s) => s.month === '2025-04');
    const janSamples = resAllDays.selectedSamples.filter((s) => s.month === '2025-01');

    assert(febSamples.length === 28, `Expected 28 unique samples for Feb, got ${febSamples.length}`);
    assert(aprSamples.length === 30, `Expected 30 unique samples for Apr, got ${aprSamples.length}`);
    assert(janSamples.length === 31, `Expected 31 unique samples for Jan, got ${janSamples.length}`);

    assert(resAllDays.effectiveScoreOutOf100 > 0, `Expected positive score, got ${resAllDays.effectiveScoreOutOf100}`);
    console.log(`✓ TEST 16 PASSED (EVV Score with 1 to 31 custom dates: ${resAllDays.effectiveScoreOutOf100}/100, AMB: ₹${resAllDays.component1.sixMonthSampledAMBRupees})\n`);
  }

  console.log("================================================================================");
  console.log("ALL 16 UNIT TESTS PASSED SUCCESSFULLY! (100% Deterministic Engine)");
  console.log("================================================================================");
}

runAllTests();
