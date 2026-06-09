import { describe, it, expect } from 'vitest';
import { runProjection } from './projection';
import { optimizeStrategy } from './optimizer';
import { runMonteCarlo } from './monteCarlo';
import { samplePlan as defaultPlan } from '../schemas/plan';
import type { Plan } from '../schemas/plan';
import type { BlendPolicy } from './blendPolicy';
import { assertProjectionInvariants } from './__invariants__/assertions';

// 12% bracket top — same constant the optimizer uses for its cap heuristic.
const BRACKET_12_TOP = 96950;

/** Deep-clone a plan to keep test cases isolated. */
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

describe('Optimizer ↔ Projection coordination', () => {
  it('is isolated from plan.conversion.mode and plan.withdrawalStrategy', () => {
    // Same plan, different Pick-tab settings → optimizer output must be byte-identical.
    // This is the foundational isolation property: the optimizer searches its own policy
    // space and the projection must respect that policy fully, not fall back to legacy modes.
    const baseplan = defaultPlan();
    const modes: Plan['conversion']['mode'][] = ['off', 'manual', 'auto-window', 'bracket-fill'];
    const strategies: Plan['withdrawalStrategy'][] = ['taxfirst', 'rothfirst', 'tradfirst', 'proportional', 'bracketfill'];

    const results: string[] = [];
    for (const mode of modes) {
      for (const strat of strategies) {
        const plan = clone(baseplan);
        plan.conversion.mode = mode;
        plan.withdrawalStrategy = strat;
        const r = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
        // Serialize just the per-year policy windows for comparison — that's the optimizer's pure output.
        results.push(JSON.stringify(r.perYearPolicy.windows));
      }
    }
    const distinct = new Set(results);
    expect(
      distinct.size,
      `Expected 1 distinct optimizer output across ${results.length} Pick-tab combinations, got ${distinct.size}.\n` +
      `First two distinct outputs:\n  ${[...distinct].slice(0, 2).join('\n  ')}`
    ).toBe(1);
  }, 120_000);

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

  it('score round-trip: optimizer.metric equals projection(optimizer.policy).endTotalReal', () => {
    // The optimizer's reported score must match what a fresh projection computes from the
    // optimizer's own returned policy. If these diverge, the optimizer is searching against
    // a phantom projection — historically caused by the row-indexing bug.
    const plan = defaultPlan();
    const r = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
    const verify = runProjection(plan, { policy: r.perYearPolicy });
    expect(
      verify.endTotalReal,
      `Optimizer-reported endTotalReal ${r.projection.endTotalReal} does not match re-projection ${verify.endTotalReal}`
    ).toBeCloseTo(r.projection.endTotalReal, 0);
    expect(verify.endTotalReal).toBeCloseTo(r.metric, 0);
  }, 60_000);

  it('strict dominance: optimizer beats every preset baseline on the same plan', () => {
    // The optimizer's policy space strictly subsumes the presets, so it should never lose
    // to one. If it does, the optimizer has converged to a worse local optimum or its
    // evaluator disagrees with the projection.
    const plan = defaultPlan();
    plan.conversion.mode = 'off';
    const presets: Plan['withdrawalStrategy'][] = ['taxfirst', 'rothfirst', 'tradfirst', 'proportional', 'bracketfill'];
    const opt = optimizeStrategy(plan, 'max-end-balance', { thorough: true });

    for (const strat of presets) {
      const presetPlan = clone(plan);
      presetPlan.withdrawalStrategy = strat;
      const baseline = runProjection(presetPlan);
      expect(
        opt.projection.endTotalReal,
        `Optimizer ${opt.projection.endTotalReal} < preset ${strat} ${baseline.endTotalReal}`
      ).toBeGreaterThanOrEqual(baseline.endTotalReal - 1);
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
      // 0.5 threshold: a healthy optimizer run on this plan produces ~0.24; the
      // user-reported lumpy browser output produced 0.91. 0.5 is the regression
      // tripwire that fires if smoothing gets disabled or coordinate descent
      // re-introduces spikes.
      expect(ratio, `Conversion variation/total ratio ${ratio.toFixed(3)} suggests spiky schedule`).toBeLessThan(0.5);
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
    expect(applied.endTotalReal).toBeCloseTo(r.projection.endTotalReal, 0);
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
        { fromAge: plan.personA.retirementAge, toAge: plan.personA.planToAge, pctTaxable: 0.4, pctTraditional: 0.3, pctRoth: 0.3, convAmt: 0 },
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
