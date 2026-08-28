import { describe, it, expect } from 'vitest';
import { optimizeStrategy } from './optimizer';
import { applyResultToPlan } from './applyOptimizerResult';
import { compareWithWithoutConversion } from './comparison';
import { runProjection } from './projection';
import { samplePlan } from '../schemas/plan';
import type { Plan } from '../schemas/plan';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const PRESETS: Plan['withdrawalStrategy'][] = ['taxfirst', 'rothfirst', 'tradfirst', 'proportional', 'bracketfill'];

describe('conversion-benefit baseline (optimizer-authored)', () => {
  it('is flat across all five withdrawal presets (invariance, not an absolute pin)', () => {
    // The optimizer-authored no-conversion baseline must be a function of plan economics only,
    // not of whichever withdrawal preset happens to be sitting in the plan as invisible UI history.
    const base = samplePlan();
    const baselineEnds: number[] = [];
    for (const preset of PRESETS) {
      const plan = clone(base);
      plan.withdrawalStrategy = preset;
      const result = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
      expect(result.conversionBaselinePolicy, `expected conversions on preset ${preset}`).toBeTruthy();
      const applied = applyResultToPlan(plan, result);
      const cmp = compareWithWithoutConversion(applied);
      baselineEnds.push(cmp.noConv.endTotalReal);
    }
    const spread = Math.max(...baselineEnds) - Math.min(...baselineEnds);
    expect(spread, `baseline swings ${spread.toFixed(0)} across presets: ${baselineEnds.map((v) => v.toFixed(0)).join(', ')}`).toBeLessThan(1_000);
  }, 180_000);

  it('computes a baseline for a fixed conversion schedule (optimize:false, mode-driven conversions)', () => {
    // Plan-B scenario: the optimizer owns only the withdrawal ordering; conversions come from
    // conversion.mode, so customPolicy windows carry no convAmt. The baseline must still be built —
    // keying "has conversions" off convAmt alone would skip it and reintroduce the +142K artifact.
    const plan = samplePlan();
    plan.conversion = { ...plan.conversion, mode: 'auto-window', optimize: false, startAge: 59, endAge: 82, autoAmount: 70_000 };
    const result = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
    expect(result.projection.lifetimeConversion, 'expected mode-driven conversions').toBeGreaterThan(1000);
    expect(result.policy.windows.every((w) => (w.convAmt ?? 0) === 0), 'convAmt is mode-owned, not on policy').toBe(true);
    expect(result.conversionBaselinePolicy, 'baseline must be computed for fixed-schedule plans').toBeTruthy();
  }, 120_000);

  it('uses the stored baseline, not the zeroed with-conversion ordering', () => {
    const plan = samplePlan();
    const result = optimizeStrategy(plan, 'max-end-balance', { thorough: false });
    const applied = applyResultToPlan(plan, result);
    expect(applied.conversionBaselinePolicy).toBeTruthy();

    const cmp = compareWithWithoutConversion(applied);

    // The stored baseline (re-adapted ordering) should differ from the naive counterfactual that
    // keeps the optimizer's with-conversion ordering and merely zeros convAmt.
    const zeroedPolicy = {
      ...applied.customPolicy!,
      windows: applied.customPolicy!.windows.map((w) => ({ ...w, convAmt: 0 })),
    };
    const zeroed = runProjection({ ...applied, customPolicy: zeroedPolicy, conversion: { ...applied.conversion, mode: 'off' } });
    expect(cmp.noConv.endTotalReal).not.toBeCloseTo(zeroed.endTotalReal, -2);
  }, 120_000);
});

describe('conversion-benefit baseline (user-authored — unchanged)', () => {
  it('preset-only plan uses the cheap controlled baseline and ignores any stored policy', () => {
    const plan = samplePlan();          // no customPolicy → state 1
    plan.conversion.mode = 'bracket-fill';
    plan.conversion.optimize = false;
    const cmp = compareWithWithoutConversion(plan);
    const expected = runProjection({ ...plan, conversion: { ...plan.conversion, mode: 'off' } });
    expect(cmp.noConv.endTotalReal).toBeCloseTo(expected.endTotalReal, -1);
  });

  it('manual-blend plan holds its ordering fixed (does not take the optimized-baseline path)', () => {
    const plan = samplePlan();
    plan.conversion.mode = 'auto-window';
    plan.customPolicy = {
      source: 'manual',
      windows: [{ fromAge: 59, toAge: 98, pctTaxable: 0.5, pctTraditional: 0.3, pctRoth: 0.2, convAmt: 40_000 }],
    };
    // A stray stored baseline must be ignored for manual policies.
    plan.conversionBaselinePolicy = {
      source: 'optimizer',
      windows: [{ fromAge: 59, toAge: 98, pctTaxable: 1, pctTraditional: 0, pctRoth: 0 }],
    };
    const cmp = compareWithWithoutConversion(plan);
    const heldFixed = runProjection({
      ...plan,
      conversion: { ...plan.conversion, mode: 'off' },
      customPolicy: { ...plan.customPolicy, windows: plan.customPolicy.windows.map((w) => ({ ...w, convAmt: 0 })) },
    });
    expect(cmp.noConv.endTotalReal).toBeCloseTo(heldFixed.endTotalReal, -1);
  });
});
