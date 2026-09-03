/**
 * Optimizer optimality-gap and cliff-detection benchmark.
 *
 * Three test suites, each testing a different type of optimizer reliability:
 *
 *   1. Seed diversity        — does the result depend on where we start?
 *   2. ACA cliff detection   — does the optimizer find and preserve the ACA subsidy?
 *   3. IRMAA awareness       — does the optimizer correctly model and account for IRMAA?
 *
 * Usage (excluded from the default suite by vitest.config.ts — opt in with HEAVY=1):
 *   pnpm test:heavy src/engine/__benchmarks__/optimizerGap.bench.ts
 *
 * Set OPTIMIZER_NM=1 to include Nelder-Mead (3-4× slower, marginally more precise).
 */

import { describe, test, expect } from 'vitest';
import { measureOptimalityGap, optimizeStrategy, type OptimalityGapResult } from '../optimizer';
import { runProjection } from '../projection';
import { FPL_BASE, IRMAA_TIERS_SINGLE } from '../taxConstants';
import {
  planA_simple,
  planB_largeTradSingle,
  planC_bracketFillConv,
  planD_singleFIRE,
  planF_allTradCouple,
  planG_californiaCouple,
} from '../__golden/plans';
import type { Plan } from '../../schemas/plan';
import type { BlendPolicy } from '../blendPolicy';

const USE_NM = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.['OPTIMIZER_NM'] === '1';

// ─── Formatting ───────────────────────────────────────────────────────────────

const fmtM  = (n: number) => `$${(n / 1_000_000).toFixed(3)}M`;
const fmtK  = (n: number) => `$${Math.round(n / 1000)}K`;
const fmtPct = (n: number) => `${n.toFixed(2)}%`;
const fmtD  = (n: number) => `$${Math.round(n).toLocaleString()}`;

// ─── Suite 1: Seed diversity ──────────────────────────────────────────────────

const SEED_PLANS: Array<{ name: string; plan: Plan }> = [
  { name: 'A — couple taxfirst IL',          plan: planA_simple() },
  { name: 'B — single large-trad IL',        plan: planB_largeTradSingle() },
  { name: 'C — couple bracket-fill conv IL', plan: planC_bracketFillConv() },
  { name: 'D — single FIRE early retire',    plan: planD_singleFIRE() },
  { name: 'F — couple all-trad IL',          plan: planF_allTradCouple() },
  { name: 'G — CA couple ACA conversions',   plan: planG_californiaCouple() },
];

function printGapResult(name: string, r: OptimalityGapResult) {
  const winner = r.runs.find((x) => !x.ranOut && x.score === r.bestScore);
  const loser  = r.runs.find((x) => !x.ranOut && x.score === r.worstScore);
  console.log(`\n━━━ ${name} ━━━`);
  console.log(
    `  Spread: ${fmtPct(r.spreadPct).padEnd(8)}` +
    `  Best: ${fmtM(r.bestScore)} (${winner?.label ?? '—'})` +
    `  Worst: ${fmtM(r.worstScore)} (${loser?.label ?? '—'})` +
    `  Depleted: ${r.depletedCount}/${r.runs.length}`,
  );
  console.log('');
  console.log(`  ${'Seed'.padEnd(30)}  ${'Score'.padEnd(14)}  Evals`);
  for (const run of r.runs) {
    const marker = run.score === r.bestScore && !run.ranOut ? ' ✓' : '';
    const scoreStr = run.ranOut ? '— depleted —' : fmtM(run.score);
    console.log(`  ${run.label.padEnd(30)}  ${scoreStr.padEnd(14)}  ${run.evaluations}${marker}`);
  }
}

describe('1 — Seed diversity (withdrawal splits × conversion levels)', () => {
  const collected: Array<{ name: string; r: OptimalityGapResult }> = [];

  console.log('\n────────────────────────────────────────────────────────────────');
  console.log('WHAT THIS TESTS:');
  console.log('  Each plan is optimized 14 times from different constant starting');
  console.log('  policies: 7 withdrawal-split seeds × 2 conversion levels (zero');
  console.log('  and ~$100K/yr starting amount). If all 14 converge to within a');
  console.log('  small % of each other, the landscape has no significant local');
  console.log('  optima — the optimizer is reliable regardless of starting point.');
  console.log('');
  console.log('WHAT IT DOES NOT TEST:');
  console.log('  Whether there is a qualitatively different strategy the optimizer');
  console.log('  has never tried at all. Seed diversity measures starting-point');
  console.log('  robustness, not exhaustive coverage of the full solution space.');
  console.log('────────────────────────────────────────────────────────────────\n');

  for (const { name, plan } of SEED_PLANS) {
    test(name, () => {
      const r = measureOptimalityGap(plan, { useNelderMead: USE_NM });
      printGapResult(name, r);
      collected.push({ name, r });
    }, 600_000);
  }

  test('Summary', () => {
    console.log('\n════════════════════════════════════════════════════════════════');
    console.log('  SEED DIVERSITY SUMMARY');
    console.log('════════════════════════════════════════════════════════════════');
    console.log(`  ${'Plan'.padEnd(38)}  Spread   Seeds  Verdict`);
    for (const { name, r } of collected) {
      const verdict = r.spreadPct < 1 ? 'smooth' : r.spreadPct < 5 ? 'ok' : r.spreadPct < 10 ? 'noisy' : '⚠ large';
      console.log(`  ${name.padEnd(38)}  ${fmtPct(r.spreadPct).padEnd(8)} ${r.runs.length}      ${verdict}`);
    }
    const spreads = collected.map((x) => x.r.spreadPct);
    console.log(`\n  Mean: ${fmtPct(spreads.reduce((a,b)=>a+b,0)/spreads.length)}    Max: ${fmtPct(Math.max(...spreads))}`);
    if (USE_NM) console.log('  [Nelder-Mead enabled]');
    console.log('════════════════════════════════════════════════════════════════\n');
  }, 10_000);
});

// ─── Suite 2: ACA cliff detection ────────────────────────────────────────────
//
// 400% FPL is a subsidy cliff: income above it loses the entire APTC subsidy.
// The optimizer has explicit cliff-anchor code (optimizer.ts ~line 288) that,
// after the coarse sweep, calculates the exact withdrawal split that places MAGI
// at 399% FPL and evaluates it as an additional candidate.
//
// This test verifies that code fires correctly on a plan where:
//   - expenses exceed 400% FPL single ($15,960 × 4 = $63,840 in 2026)
//   - a large Roth balance makes the subsidy-preserving strategy feasible
//   - the optimizer should shift spending from traditional to Roth to stay under cliff
//
// The comparison baseline forces all withdrawals from traditional, which puts MAGI
// above the cliff and loses the entire subsidy.

function buildACACliffPlan(): Plan {
  return {
    personA: {
      name: 'ACA Test',
      dob: '1971-01-01',  // age 55 in 2026; retires at 60; Medicare at 65 = 5 ACA years
      retirementAge: 60,
      planThroughAge: 88,
      ssPIA: 28000,       // SS at 67
      ssClaimAge: 67,
    },
    personB: undefined,
    assumptions: {
      taxableReturn: 0.065,
      taxableDivYield: 0,
      taxableQualifiedPct: 0.80,
      taxableExemptYield: 0,
      taxableExemptStatePct: 1,
      taxableDistributePct: 0,
      taxAdjOrdRate: 0.22,
      taxAdjLtcgRate: 0.15,
      legacyTargetTaxAdjReal: 0,
      tradReturn: 0.065,
      rothReturn: 0.065,
      inflation: 0.025,
      equityPct: 0.6,
      modelACA: true,
      acaHouseholdSize: 1,
      acaBenchmarkPremium: 16000,  // $16K/yr SLCSP — realistic single-person premium
      acaNoSubsidy: false,
    },
    portfolio: {
      personA: {
        taxable: 0,
        taxableBasis: 0,
        traditional: 750000,
        roth: 450000,        // large Roth pool to fund the gap below the ACA cliff
        annualContribution: 0,
        contribGrowth: { mode: 'fixed', rate: 0 },
        contribSplit: { taxable: 0, traditional: 0, roth: 1 },
      },
      personB: undefined,
    },
    incomeStreams: [],
    expenseStreams: [
      {
        id: 'core', description: 'Spending', whose: 'A',
        startAge: 60, end: { mode: 'age' as const, age: 90 }, survivorPct: 1,
        annualAmount: 68000,   // above 400% FPL single → need Roth to stay under cliff
        inflationPct: { mode: 'cpi' },
      },
    ],
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    conversion: { mode: 'off', startAge: 60, endAge: 64, autoAmount: 0, bracketCeiling: 211400, manualSchedule: {}, optimize: true },
    state: 'TX',     // no state tax — isolates the federal ACA calculation
    goals: [],
    lumpSumEvents: [],
    payTaxFromBrokerage: false,
  };
}

describe('2 — ACA cliff detection', () => {
  console.log('\n────────────────────────────────────────────────────────────────');
  console.log('WHAT THIS TESTS:');
  console.log('  Whether the optimizer correctly identifies that keeping MAGI');
  console.log('  below 400% FPL (by shifting spending to Roth) is better than');
  console.log('  taking all withdrawals from traditional and losing the ACA');
  console.log('  subsidy. This tests the explicit ACA cliff-anchor code, not');
  console.log('  just the general search. The anchor computes the exact split');
  console.log('  that targets 399% FPL and evaluates it as a candidate after');
  console.log('  the coarse sweep — it is a structural guarantee, not just');
  console.log('  an empirical observation that things happened to work out.');
  console.log('');
  console.log('WHAT IT DOES NOT TEST:');
  console.log('  Plans where the "correct" answer is to intentionally exceed');
  console.log('  the ACA cliff (e.g., because the conversion benefit far');
  console.log('  outweighs 5 years of lost subsidies). The cliff-anchor code');
  console.log('  only adds the below-cliff strategy as a candidate — it still');
  console.log('  loses if the above-cliff strategy is strictly better.');
  console.log('────────────────────────────────────────────────────────────────\n');

  test('optimizer finds ACA subsidy vs forced-trad-first baseline', () => {
    const plan = buildACACliffPlan();

    // Baseline: force all spending from traditional (worst case for ACA subsidy)
    const forcedTradPolicy: BlendPolicy = {
      windows: [{ fromAge: 60, toAge: 90, pctTaxable: 0, pctTraditional: 1, pctRoth: 0, convAmt: 0 }],
      source: 'manual',
    };
    const forcedProj = runProjection(plan, { policy: forcedTradPolicy });

    // Subsidy = benchmark premium (inflation-scaled) minus net premium paid.
    // acaPremium on the row is the net after APTC; the full benchmark is benchPremium * inflFactor.
    const benchPremium = plan.assumptions.acaBenchmarkPremium ?? 0;
    const rowSubsidy = (r: typeof forcedProj.rows[0]) =>
      Math.max(0, benchPremium * r.inflationFactor - r.acaPremium);

    const forcedSubsidy = forcedProj.rows
      .filter((r) => r.ageA >= 60 && r.ageA < 65)
      .reduce((s, r) => s + rowSubsidy(r), 0);

    // Optimizer result
    const result = optimizeStrategy(plan, 'max-end-balance', { useNelderMead: USE_NM });
    const optSubsidy = result.projection.rows
      .filter((r) => r.ageA >= 60 && r.ageA < 65)
      .reduce((s, r) => s + rowSubsidy(r), 0);

    // FPL cliff reference (nominal, unindexed)
    const fpl400 = 4 * (FPL_BASE);
    const preMediacareRows = result.projection.rows.filter((r) => r.ageA >= 60 && r.ageA < 65);
    const magiAboveCliff = preMediacareRows.filter((r) => r.magi > fpl400 * r.inflationFactor);

    console.log('\n  ACA Cliff Analysis (400% FPL single ≈ $63,840 in 2026)');
    console.log('  ─────────────────────────────────────────────────────');
    console.log(`  Forced trad-first ACA subsidy (5 yrs, nominal): ${fmtK(forcedSubsidy)}`);
    console.log(`  Optimizer ACA subsidy (5 yrs, nominal):         ${fmtK(optSubsidy)}`);
    console.log(`  Subsidy gained by optimizer:                     ${fmtK(optSubsidy - forcedSubsidy)}`);
    console.log(`  Pre-Medicare years with MAGI above cliff:        ${magiAboveCliff.length}/5`);
    console.log('');
    console.log(`  Forced trad-first end balance (real):  ${fmtM(forcedProj.endTotalReal)}`);
    console.log(`  Optimizer end balance (real):          ${fmtM(result.projection.endTotalReal)}`);
    console.log(`  Improvement:                           ${fmtK(result.projection.endTotalReal - forcedProj.endTotalReal)}`);
    console.log('');
    console.log('  Pre-Medicare year detail:');
    console.log(`    ${'Age'.padEnd(5)} ${'MAGI'.padEnd(12)} ${'Net Premium'.padEnd(14)} ${'Subsidy'.padEnd(12)} ${'Note'}`);
    for (const r of preMediacareRows) {
      const cliff = fpl400 * r.inflationFactor;
      const note = r.magi > cliff ? '⚠ above cliff' : '✓ below cliff';
      console.log(`    ${String(r.ageA).padEnd(5)} ${fmtD(r.magi).padEnd(12)} ${fmtD(r.acaPremium).padEnd(14)} ${fmtD(rowSubsidy(r)).padEnd(12)} ${note}`);
    }

    // The optimizer should always find more subsidy than the naive trad-first policy,
    // or at worst the same (if the plan is above the cliff no matter what).
    expect(result.projection.endTotalReal).toBeGreaterThanOrEqual(forcedProj.endTotalReal - 1);
    // And it should outperform forced trad-first in end balance
    expect(result.projection.endTotalReal).toBeGreaterThan(forcedProj.endTotalReal);
  }, 120_000);
});

// ─── Suite 3: IRMAA awareness ─────────────────────────────────────────────────
//
// IRMAA tiers are income thresholds that trigger Medicare Part B surcharges. Unlike
// ACA, there is NO explicit IRMAA cliff-avoidance code in the optimizer. The optimizer
// models IRMAA correctly in the projection (irmaa.ts), so its objective function sees
// the cost — but the general coordinate descent search may or may not find the exact
// income level that minimizes IRMAA exposure.
//
// This test makes IRMAA behavior visible: what income level does the optimizer land at,
// what IRMAA is paid, and how does it compare against a zero-conversion and max-conversion
// baseline? This does NOT prove the optimizer finds the IRMAA-optimal conversion level —
// it shows you the trade-off being evaluated so you can judge for yourself.

function buildIRMAAPlan(): Plan {
  // Single person, 70 years old, large traditional IRA → heavy RMDs.
  // At base income (SS + RMD, no conversion): MAGI ≈ $77K — below IRMAA tier 1 ($109K single).
  // Conversions push toward and past the tier 1 boundary.
  return {
    personA: {
      name: 'IRMAA Test',
      dob: '1956-01-01',   // age 70 in 2026
      retirementAge: 70,   // already retired
      planThroughAge: 90,
      ssPIA: 38000,        // $38K PIA → $47,120/yr at age-70 delay
      ssClaimAge: 70,
    },
    personB: undefined,
    assumptions: {
      taxableReturn: 0.065,
      taxableDivYield: 0,
      taxableQualifiedPct: 0.80,
      taxableExemptYield: 0,
      taxableExemptStatePct: 1,
      taxableDistributePct: 0,
      taxAdjOrdRate: 0.22,
      taxAdjLtcgRate: 0.15,
      legacyTargetTaxAdjReal: 0,
      tradReturn: 0.065,
      rothReturn: 0.065,
      inflation: 0.025,
      equityPct: 0.6,
      modelACA: false,
      acaHouseholdSize: 2,
      acaBenchmarkPremium: 0,
      acaNoSubsidy: false,
    },
    portfolio: {
      personA: {
        taxable: 50000,
        taxableBasis: 40000,
        traditional: 1_100_000,   // generates RMDs ≈ $40K/yr at 70; rises with growth
        roth: 150000,
        annualContribution: 0,
        contribGrowth: { mode: 'fixed', rate: 0 },
        contribSplit: { taxable: 0, traditional: 0, roth: 1 },
      },
      personB: undefined,
    },
    incomeStreams: [],
    expenseStreams: [
      {
        id: 'core', description: 'Spending', whose: 'A',
        startAge: 70, end: { mode: 'age' as const, age: 92 }, survivorPct: 1,
        annualAmount: 65000,
        inflationPct: { mode: 'cpi' },
      },
    ],
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    conversion: { mode: 'off', startAge: 70, endAge: 85, autoAmount: 0, bracketCeiling: 211400, manualSchedule: {}, optimize: true },
    state: 'TX',
    goals: [],
    lumpSumEvents: [],
    payTaxFromBrokerage: false,
  };
}

describe('3 — IRMAA awareness', () => {
  console.log('\n────────────────────────────────────────────────────────────────');
  console.log('WHAT THIS TESTS:');
  console.log('  Whether the optimizer correctly models and accounts for IRMAA');
  console.log('  when sizing Roth conversions. Unlike ACA, there is NO explicit');
  console.log('  IRMAA cliff-avoidance code — the optimizer relies on the general');
  console.log('  coordinate descent to weigh IRMAA costs (which appear in the');
  console.log('  projection) against the long-run Roth benefit.');
  console.log('');
  console.log('  This test shows the IRMAA picture across three strategies:');
  console.log('  (a) no conversions — lowest IRMAA, highest future RMD burden');
  console.log('  (b) optimizer result — engine-chosen trade-off');
  console.log('  (c) max conversions — highest IRMAA, best Roth build-up');
  console.log('  The optimizer result should be between (a) and (c), and better');
  console.log('  than (a) on tax-adjusted end balance — the metric max-end-balance');
  console.log('  scores. It will often read LOWER on gross balance, because the');
  console.log('  conversion tax is paid up front.');
  console.log('');
  console.log('WHAT IT DOES NOT TEST:');
  console.log('  Whether the optimizer finds the exact conversion amount that');
  console.log('  minimizes lifetime IRMAA + tax cost simultaneously. IRMAA');
  console.log('  tiers are discontinuous, and the coarse grid (0/25/50/75/100%');
  console.log('  of conversion cap) may straddle a tier rather than land just');
  console.log('  below it. For plans where staying below a tier is the right');
  console.log('  answer, this could result in a suboptimal conversion amount.');
  console.log('────────────────────────────────────────────────────────────────\n');

  test('IRMAA exposure across no-conversion, optimized, and max-conversion strategies', () => {
    const plan = buildIRMAAPlan();
    const irmaaT1Single = IRMAA_TIERS_SINGLE[0].magiTop;   // $109K (single tier 1 starts here)

    // (a) No conversions
    const noConvPolicy: BlendPolicy = {
      windows: [{ fromAge: 70, toAge: 92, pctTaxable: 0.5, pctTraditional: 0.5, pctRoth: 0, convAmt: 0 }],
      source: 'manual',
    };
    const noConvProj = runProjection(plan, { policy: noConvPolicy });
    const noConvIRMAA = noConvProj.rows.reduce((s, r) => s + r.irmaa, 0);

    // (b) Optimizer result
    const result = optimizeStrategy(plan, 'max-end-balance', { useNelderMead: USE_NM });
    const optIRMAA = result.projection.rows.reduce((s, r) => s + r.irmaa, 0);

    // (c) Max conversions: force large convAmt every year
    const maxConvWindows = Array.from(
      { length: 92 - 70 + 1 },
      (_, i) => ({ fromAge: 70 + i, toAge: 70 + i, pctTaxable: 0.5, pctTraditional: 0.5, pctRoth: 0, convAmt: 100000 }),
    );
    const maxConvPolicy: BlendPolicy = { windows: maxConvWindows, source: 'manual' };
    const maxConvProj = runProjection(plan, { policy: maxConvPolicy });
    const maxConvIRMAA = maxConvProj.rows.reduce((s, r) => s + r.irmaa, 0);

    // Year-by-year IRMAA detail for optimizer result
    const rows65 = result.projection.rows.filter((r) => r.ageA >= 70 && r.ageA <= 85);

    console.log(`\n  IRMAA Tier 1 threshold (single, 2026): ${fmtD(irmaaT1Single)}`);
    console.log(`  (IRMAA is based on MAGI from 2 years prior)\n`);
    // Both metrics are printed: gross alone is misleading for conversion-heavy answers,
    // because paying conversion tax now lowers gross while raising after-tax value.
    console.log('  Strategy comparison (IRMAA lifetime nominal):');
    const cmpLine = (label: string, p: typeof noConvProj, irmaa: number) =>
      console.log(`    ${label.padEnd(17)}gross ${fmtM(p.endTotalReal)}  tax-adj ${fmtM(p.endTaxAdjustedReal)}  IRMAA ${fmtK(irmaa)}`);
    cmpLine('No conversions:', noConvProj, noConvIRMAA);
    cmpLine('Optimizer:', result.projection, optIRMAA);
    cmpLine('Max conversions:', maxConvProj, maxConvIRMAA);
    console.log('');
    console.log('  Optimizer year-by-year (ages 70–85):');
    console.log(`    ${'Age'.padEnd(5)} ${'MAGI'.padEnd(12)} ${'Conv'.padEnd(10)} ${'IRMAA/yr'.padEnd(10)} ${'Note'}`);
    for (const r of rows65) {
      const note = r.magi > irmaaT1Single * r.inflationFactor ? '⚠ tier 1+' : '✓ tier 0';
      const conv = r.rothConv;
      console.log(
        `    ${String(r.ageA).padEnd(5)} ${fmtD(r.magi).padEnd(12)} ${fmtD(conv).padEnd(10)} ${fmtD(r.irmaa).padEnd(10)} ${note}`,
      );
    }

    // Sanity assertion: the optimizer must beat the naive no-conversion baseline on
    // endTaxAdjustedReal — the metric max-end-balance actually scores (since 59af169).
    // Comparing gross endTotalReal here is wrong and gave a false failure: a conversion
    // -heavy answer deliberately trades gross balance for after-tax balance, so on this
    // plan the optimizer reads $1.978M gross vs the baseline's $2.090M while winning
    // $1.871M vs $1.835M tax-adjusted.
    expect(
      result.projection.endTaxAdjustedReal,
      `Optimizer tax-adj ${fmtM(result.projection.endTaxAdjustedReal)} did not beat ` +
      `no-conversion baseline ${fmtM(noConvProj.endTaxAdjustedReal)}`,
    ).toBeGreaterThan(noConvProj.endTaxAdjustedReal);
  }, 120_000);
});
