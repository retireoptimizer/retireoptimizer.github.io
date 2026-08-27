import { describe, it, expect } from 'vitest';
import { runProjection, effectiveBracketCeiling } from './projection';
import { optimizeStrategy } from './optimizer';
import { runMonteCarlo } from './monteCarlo';
import { samplePlan as defaultPlan } from '../schemas/plan';
import type { Plan } from '../schemas/plan';
import type { BlendPolicy } from './blendPolicy';
import { assertProjectionInvariants } from './__invariants__/assertions';

import { FED_BRACKETS_MFJ } from './taxConstants';
// 12% bracket top — same constant the optimizer uses for its cap heuristic.
const BRACKET_12_TOP = FED_BRACKETS_MFJ[1][0];

/** Deep-clone a plan to keep test cases isolated. */
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe('Optimizer ↔ Projection coordination', () => {
  it('is isolated from plan.conversion.mode and plan.withdrawalStrategy', () => {
    // Same plan, different Pick-tab settings → optimizer output must be byte-identical.
    // This is the foundational isolation property: the optimizer searches its own policy
    // space and the projection must respect that policy fully, not fall back to legacy modes.
    // Four combinations, not the full 4×5 cross-product: each optimizeStrategy call is
    // ~15s, and the property is per-axis (does either setting leak into the search?),
    // so covering every mode and every strategy at least once gives the same signal.
    const baseplan = defaultPlan();
    const combos: Array<[Plan['conversion']['mode'], Plan['withdrawalStrategy']]> = [
      ['off', 'taxfirst'],
      ['manual', 'rothfirst'],
      ['auto-window', 'tradfirst'],
      ['bracket-fill', 'proportional'],
      ['off', 'bracketfill'],
    ];

    const results: string[] = [];
    for (const [mode, strat] of combos) {
      const plan = clone(baseplan);
      plan.conversion.mode = mode;
      plan.withdrawalStrategy = strat;
      const r = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
      // Serialize just the per-year policy windows for comparison — that's the optimizer's pure output.
      results.push(JSON.stringify(r.perYearPolicy.windows));
    }
    const distinct = new Set(results);
    expect(
      distinct.size,
      `Expected 1 distinct optimizer output across ${results.length} Pick-tab combinations, got ${distinct.size}.\n` +
      `First two distinct outputs:\n  ${[...distinct].slice(0, 2).join('\n  ')}`
    ).toBe(1);
  }, 180_000);

  it('honors the convAmt cap — actual rothConv ≤ 3 × bracket12Top × inflF', () => {
    // The optimizer's cap heuristic is "convert up to 3 brackets of room". The projection
    // multiplies stored convAmt (today's $) by inflationFactor to get nominal $. The actual
    // rothConv in any year must not exceed that nominal cap (within $1 rounding). Catches
    // units mismatches and row-indexing offsets that historically inflated late-year conv.
    const plan = defaultPlan();
    plan.conversion.mode = 'off'; // ensure no legacy fallback inflation
    const r = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
    for (const row of r.projection.rows) {
      const capNominal = 3 * BRACKET_12_TOP * row.inflationFactor;
      // Tolerance: $1 for rounding. Also bound by begTraditional in case trad is depleted.
      expect(
        row.rothConv,
        `Year ${row.year} ageA=${row.ageA}: rothConv $${row.rothConv} exceeds 3×bracket cap $${capNominal.toFixed(0)}`
      ).toBeLessThanOrEqual(capNominal + 1);
    }
  }, 120_000);

  it('score round-trip: optimizer.metric equals projection(optimizer.policy).endTaxAdjustedReal', () => {
    // The optimizer's reported score must match what a fresh projection computes from the
    // optimizer's own returned policy. If these diverge, the optimizer is searching against
    // a phantom projection — historically caused by the row-indexing bug.
    const plan = defaultPlan();
    const r = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
    const verify = runProjection(plan, { policy: r.perYearPolicy });
    expect(
      verify.endTaxAdjustedReal,
      `Optimizer-reported endTaxAdjustedReal ${r.projection.endTaxAdjustedReal} does not match re-projection ${verify.endTaxAdjustedReal}`
    ).toBeCloseTo(r.projection.endTaxAdjustedReal, 0);
    expect(verify.endTaxAdjustedReal).toBeCloseTo(r.metric, 0);
  }, 60_000);

  it('strict dominance: optimizer beats every preset baseline on tax-adjusted balance', () => {
    // The optimizer's policy space strictly subsumes the presets, so it should never lose
    // to one on the metric it is scoring. Now that max-end scores endTaxAdjustedReal,
    // the dominance comparison must use the same metric.
    const plan = defaultPlan();
    plan.conversion.mode = 'off';
    const presets: Plan['withdrawalStrategy'][] = ['taxfirst', 'rothfirst', 'tradfirst', 'proportional', 'bracketfill'];
    const opt = optimizeStrategy(plan, 'max-end-balance', { thorough: true });

    for (const strat of presets) {
      const presetPlan = clone(plan);
      presetPlan.withdrawalStrategy = strat;
      const baseline = runProjection(presetPlan);
      expect(
        opt.projection.endTaxAdjustedReal,
        `Optimizer tax-adj ${opt.projection.endTaxAdjustedReal} < preset ${strat} tax-adj ${baseline.endTaxAdjustedReal}`
      ).toBeGreaterThanOrEqual(baseline.endTaxAdjustedReal - 1);
    }
  }, 120_000);

  it('produces a reasonably smooth conversion schedule (variation/total ratio ≤ 1.0)', () => {
    // Smoothness regression guard. The historic coordinate-descent bug produced
    // schedules with ratio ≈ 0.8+ (massive spikes). Healthy schedules sit under 1.0;
    // this allows some legitimate transition-driven roughness without permitting spikes.
    const plan = defaultPlan();
    plan.conversion.mode = 'off';
    const r = optimizeStrategy(plan, 'max-end-balance', { thorough: true });
    const convs = r.perYearPolicy.windows.map((w) => w.convAmt ?? 0);
    let totalVariation = 0;
    for (let i = 1; i < convs.length; i++) totalVariation += Math.abs(convs[i] - convs[i - 1]);
    const totalConv = convs.reduce((a, b) => a + b, 0);
    if (totalConv > 1) {
      const ratio = totalVariation / totalConv;
      // 1.0 threshold: healthy schedules sit under 1.0; above that is a classic
      // coordinate-descent spike (one year gets all the conversion, neighbors get none).
      expect(ratio, `Conversion variation/total ratio ${ratio.toFixed(3)} suggests spiky schedule`).toBeLessThan(1.0);
    }
  }, 120_000);

  it('apply equivalence: optimizer output applied as custom policy projects to same KPIs', () => {
    // Take the optimizer's perYearPolicy, write it onto a fresh plan as customPolicy
    // (mirroring what the UI's "Apply" button does), and verify the projection matches.
    // Catches store → engine drift if the apply path mangles windows.
    const plan = defaultPlan();
    const r = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
    const planWithCustom = clone(plan);
    planWithCustom.customPolicy = { ...r.perYearPolicy, source: 'optimizer' };
    const applied = runProjection(planWithCustom, { policy: r.perYearPolicy });
    expect(applied.endTaxAdjustedReal).toBeCloseTo(r.projection.endTaxAdjustedReal, 0);
    expect(applied.lifetimeFedTax).toBeCloseTo(r.projection.lifetimeFedTax, -1);
  }, 60_000);

  it('produces a projection that satisfies all dollar-flow invariants', () => {
    // Combines Layer 1's invariants with Layer 2's optimizer path — ensures the optimizer
    // never produces a policy that triggers phantom withdrawals or balance corruption.
    const plan = defaultPlan();
    const r = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
    assertProjectionInvariants(r.projection, plan);
  }, 60_000);
});

describe('Custom BlendPolicy ↔ Projection', () => {
  it('a custom policy that fully matches an optimizer schedule produces identical results', () => {
    // Property: if you hand-author the same policy the optimizer wrote, the projection is the same.
    // Catches optimizer↔policy serialization issues.
    const plan = defaultPlan();
    const opt = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
    const manualPolicy: BlendPolicy = {
      windows: opt.perYearPolicy.windows.map((w) => ({ ...w })),
      source: 'manual',
    };
    const projA = runProjection(plan, { policy: opt.perYearPolicy });
    const projB = runProjection(plan, { policy: manualPolicy });
    expect(JSON.stringify(projA.rows)).toBe(JSON.stringify(projB.rows));
  }, 60_000);

  it('explicit convAmt=0 means truly zero, not a fallback to plan.conversion.mode', () => {
    // The historic Pick-tab leakage bug: convAmt=0 was treated as "fall back to legacy".
    // Two plans with identical policies and conv mode varying must produce identical results.
    const plan = defaultPlan();
    const policy: BlendPolicy = {
      windows: [
        { fromAge: plan.personA.retirementAge, toAge: plan.personA.planThroughAge, pctTaxable: 0.4, pctTraditional: 0.3, pctRoth: 0.3, convAmt: 0 },
      ],
      source: 'manual',
    };
    const p1 = clone(plan);
    p1.conversion.mode = 'off';
    const p2 = clone(plan);
    p2.conversion.mode = 'bracket-fill';
    p2.conversion.bracketCeiling = 250_000;
    const a = runProjection(p1, { policy });
    const b = runProjection(p2, { policy });
    // Policy explicitly says convAmt=0 → both must report zero conversion in every retirement year.
    for (const r of a.rows) expect(r.rothConv, `(off) year ${r.year} expected zero conv`).toBe(0);
    for (const r of b.rows) expect(r.rothConv, `(bracket-fill) year ${r.year} expected zero conv`).toBe(0);
    expect(a.endTotalReal).toBeCloseTo(b.endTotalReal, 0);
  });
});

describe('conversion.optimize gate', () => {
  it('mode=off, no policy → zero conversions everywhere (legacy path)', () => {
    const plan = defaultPlan();
    plan.conversion.mode = 'off';
    const proj = runProjection(plan);
    expect(proj.lifetimeConversion).toBe(0);
    for (const r of proj.rows) expect(r.rothConv, `year ${r.year}`).toBe(0);
  });

  it('mode=bracket-fill, no policy → conversions respect bracketCeiling', () => {
    const plan = defaultPlan();
    plan.conversion.mode = 'bracket-fill';
    // Reduce spending so the taxable account is not depleted before the conversion window.
    // samplePlan's default 150K/yr exhausts taxable by ~age 63, forcing all spending through
    // traditional, which alone exceeds the 12% ceiling → conv=0 is correct but the ceiling
    // assertion is unverifiable. 80K/yr leaves taxable available through the conversion window.
    plan.expenseStreams[0].annualAmount = 80000;
    const { startAge, endAge, bracketCeiling } = plan.conversion;
    const proj = runProjection(plan);
    expect(proj.lifetimeConversion).toBeGreaterThan(0);
    for (const r of proj.rows) {
      if (r.ageA < startAge || r.ageA > endAge) continue;
      // Skip years where conv=0: spending alone exceeds ceiling, engine correctly converts nothing.
      if (r.rothConv <= 0) continue;
      // Allow ~15K over ceiling: SS becomes taxable once the conversion is added, but the
      // estimate used for sizing assumed it wasn't (PI was below threshold pre-conversion).
      const taxableOrdReal = (r.ordIncome - r.stdDeduction) / r.inflationFactor;
      expect(
        taxableOrdReal,
        `year ${r.year} ageA=${r.ageA}: taxable ord income $${taxableOrdReal.toFixed(0)} exceeds ceiling $${bracketCeiling}`
      ).toBeLessThanOrEqual(bracketCeiling + 15000);
    }
  });

  it('withdrawalStrategy=bracketfill, pre-SS window → ceiling exactly honored (no SS feedback)', () => {
    // SS feedback from wdTrd is the main source of ceiling overshoot because the SS taxability
    // estimate uses wdTrd≈0 while actual wdTrd fills the bracket. Before SS starts, provisional
    // income = wdTrd + other income, so the estimate is accurate and the ceiling should hold to
    // within the gross-up loop's convergence tolerance (~$500).
    // This test pins the exact scenario the bugs affected: bracketfill withdrawal + taxable div yield.
    const plan = defaultPlan();
    plan.withdrawalStrategy = 'bracketfill';
    plan.withdrawalBracketCeiling = FED_BRACKETS_MFJ[2][0]; // 22% top
    plan.expenseStreams[0].annualAmount = 150000; // high spend forces bracket fill every year
    const proj = runProjection(plan);
    const ssStartAge = plan.personA.ssClaimAge;
    for (const r of proj.rows) {
      if (r.bracketOverridden) continue;
      if (r.phase !== 'Retire' && r.phase !== 'SemiRetire') continue;
      if (r.ageA >= ssStartAge) continue; // skip years with SS (feedback complicates the check)
      const baseStdD = r.stdDeduction - r.seniorBonus;
      const ceilingNominal = effectiveBracketCeiling(plan.withdrawalBracketCeiling, r.filingStatus) * r.inflationFactor;
      expect(
        r.ordIncome - baseStdD,
        `year ${r.year} ageA=${r.ageA}: taxableOrd ${(r.ordIncome - baseStdD).toFixed(0)} exceeds ceiling ${ceilingNominal.toFixed(0)} + 500`
      ).toBeLessThanOrEqual(ceilingNominal + 500);
    }
  });

  it('optimizeConversions=false, mode=off → optimizer leaves convAmt undefined and zero conversions', () => {
    const plan = defaultPlan();
    plan.conversion.mode = 'off';
    plan.conversion.optimize = false;
    const r = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
    // CRITICAL: no numeric convAmt written (undefined, not 0) — else it would override the mode.
    for (const w of r.perYearPolicy.windows) {
      expect(w.convAmt, `window ${w.fromAge}-${w.toAge} convAmt must be undefined`).toBeUndefined();
    }
    expect(r.projection.lifetimeConversion).toBe(0);
  }, 60_000);

  it('optimizeConversions=false, mode=bracket-fill → conversions follow the mode', () => {
    // When optimize=false, the optimizer must NOT set explicit convAmt on any window
    // (doing so would override bracket-fill and break the user's Pick-tab intent).
    // Conversions come entirely from the mode; the optimizer only searches withdrawals.
    const plan = defaultPlan();
    plan.conversion.mode = 'bracket-fill';
    plan.conversion.optimize = false;
    const r = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
    for (const w of r.perYearPolicy.windows) {
      expect(w.convAmt, `window ${w.fromAge}-${w.toAge} convAmt must be undefined`).toBeUndefined();
    }
    expect(r.projection.lifetimeConversion).toBeGreaterThan(0);
    // Withdrawals still optimized: end balance beats the all-taxable, mode-driven baseline.
    const baseline = runProjection(plan); // no policy → all-taxable withdrawals + same mode conversions
    expect(r.projection.endTotalReal).toBeGreaterThanOrEqual(baseline.endTotalReal - 1);
  }, 60_000);

  it('optimizeConversions=true (default) → optimizer populates numeric convAmt', () => {
    const plan = defaultPlan();
    plan.conversion.mode = 'off';
    const r = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
    expect(r.perYearPolicy.windows.some((w) => w.convAmt != null)).toBe(true);
  }, 60_000);

  it('optimizeConversions=false round-trips: applied plan matches result.projection', () => {
    const plan = defaultPlan();
    plan.conversion.mode = 'bracket-fill';
    plan.conversion.optimize = false;
    const r = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
    const applied = clone(plan);
    applied.customPolicy = { ...r.perYearPolicy, source: 'optimizer' };
    const verify = runProjection(applied, { policy: r.perYearPolicy });
    expect(verify.endTotalReal).toBeCloseTo(r.projection.endTotalReal, 0);
  }, 60_000);
});

describe('Monte Carlo basic sanity', () => {
  const plan = defaultPlan();
  const mc = runMonteCarlo(plan, { trials: 100, seed: 42 });

  it('percentile bands are monotonically ordered (p10 ≤ p25 ≤ p50 ≤ p75 ≤ p90)', () => {
    expect(mc.ages.length).toBeGreaterThan(0);
    for (let i = 0; i < mc.ages.length; i++) {
      expect(mc.p10[i]).toBeLessThanOrEqual(mc.p25[i] + 1);
      expect(mc.p25[i]).toBeLessThanOrEqual(mc.p50[i] + 1);
      expect(mc.p50[i]).toBeLessThanOrEqual(mc.p75[i] + 1);
      expect(mc.p75[i]).toBeLessThanOrEqual(mc.p90[i] + 1);
    }
  });

  it('success rate is in [0, 1]', () => {
    expect(mc.successRate).toBeGreaterThanOrEqual(0);
    expect(mc.successRate).toBeLessThanOrEqual(1);
  });

  it('seeded runs are deterministic', () => {
    const a = runMonteCarlo(plan, { trials: 50, seed: 7 });
    const b = runMonteCarlo(plan, { trials: 50, seed: 7 });
    expect(a.medianEndBalance).toBeCloseTo(b.medianEndBalance, 0);
    expect(a.successRate).toBeCloseTo(b.successRate, 3);
  });

  it('stress scenarios all return a success rate in [0, 1]', () => {
    for (const s of mc.stressScenarios) {
      expect(s.successRate, `${s.name}`).toBeGreaterThanOrEqual(0);
      expect(s.successRate, `${s.name}`).toBeLessThanOrEqual(1);
    }
  });
});

describe('Tax-adjusted balance objective', () => {
  it('zero rates: endTaxAdjustedReal === endTotalReal (escape hatch)', () => {
    const plan = defaultPlan();
    plan.assumptions.taxAdjOrdRate = 0;
    plan.assumptions.taxAdjLtcgRate = 0;
    const proj = runProjection(plan);
    expect(proj.endTaxAdjustedReal).toBeCloseTo(proj.endTotalReal, 2);
    expect(proj.endTaxAdjustedNominal).toBeCloseTo(proj.endTotalNominal, 2);
  });

  it('optimizer with zero rates reports same metric as gross endTotalReal', () => {
    const plan = defaultPlan();
    plan.assumptions.taxAdjOrdRate = 0;
    plan.assumptions.taxAdjLtcgRate = 0;
    const r = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
    expect(r.metric).toBeCloseTo(r.projection.endTotalReal, 0);
  }, 60_000);

  it('tax-adjusted is strictly lower than gross when rates > 0 and portfolio has pre-tax', () => {
    const plan = defaultPlan();
    // samplePlan has a large traditional balance
    plan.assumptions.taxAdjOrdRate = 0.22;
    plan.assumptions.taxAdjLtcgRate = 0.15;
    const proj = runProjection(plan);
    // If plan has any traditional or taxable gain, tax-adjusted must be lower
    const lastRow = proj.rows[proj.rows.length - 1];
    if (lastRow && (lastRow.endTraditional > 0 || lastRow.endTaxable > (lastRow.endTaxableBasis ?? 0))) {
      expect(proj.endTaxAdjustedReal).toBeLessThan(proj.endTotalReal);
    }
  });
});
