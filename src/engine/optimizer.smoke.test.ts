import { describe, it, expect } from 'vitest';
import { runProjection } from './projection';
import { samplePlan as defaultPlan } from '../schemas/plan';
import type { Plan } from '../schemas/plan';
import { optimizeCached } from './__testutil__/optimizeCached';

// Calls go through optimizeCached: the thorough test reuses the max-end-balance run above.
// Related smoke tests live elsewhere so they share cached runs or run in parallel: samplePlan
// max-spending / min-retirement-age in applyOptimizerResult.test.ts, legacy targets in
// optimizer.swl.test.ts.

describe('optimizeStrategy (smoke)', () => {
  it('max-end-balance returns a non-empty policy and projection that survives or matches baseline', () => {
    const plan = defaultPlan();
    const r = optimizeCached(plan, 'max-end-balance', { useNelderMead: false });
    expect(r.policy.windows.length).toBeGreaterThan(0);
    expect(r.evaluations).toBeGreaterThan(0);
    // End balance should be >= a 100%-taxable baseline (the optimizer can't do worse than its starting point).
    const baseline = runProjection(plan, {
      policy: {
        windows: [{ fromAge: plan.personA.retirementAge, toAge: plan.personA.planThroughAge, pctTaxable: 1, pctTraditional: 0, pctRoth: 0 }],
        source: 'manual',
      },
    });
    expect(r.projection.endTaxAdjustedReal).toBeGreaterThanOrEqual(baseline.endTaxAdjustedReal - 1);
  }, 60_000);

  it('tight plan (sustainable < amortAbs × 0.25) returns a real answer, not the 50%-fallback', () => {
    // The pre-fix downward-halving bug: old code set lo$ = 0.25×amortAbs untested, so the
    // bisection never searched below that floor. The late-start pension inflates avgExternalReal,
    // pushing amortAbs well above the portfolio annuity value; the true answer falls below 25%.
    const base = defaultPlan();
    const tightPlan: Plan = {
      ...base,
      personA: { ...base.personA, dob: '1966-09-03', retirementAge: 60, planThroughAge: 92, ssPIA: 0 },
      personB: { ...base.personB!, dob: '1970-09-03', retirementAge: 56, planThroughAge: 92, ssPIA: 0 },
      portfolio: {
        personA: { ...base.portfolio.personA, taxable: 0, taxableBasis: 0, traditional: 50_000, roth: 0, annualContribution: 0 },
        personB: { ...base.portfolio.personB!, taxable: 0, taxableBasis: 0, traditional: 0, roth: 0, annualContribution: 0 },
      },
      incomeStreams: [
        { id: 'late-pension', description: 'Late Pension', whose: 'A' as const, type: 'Other' as const,
          startAge: 90, end: { mode: 'age' as const, age: 92 }, survivorPct: 0,
          annualAmount: 100_000, growthPct: { mode: 'cpi' as const }, taxablePct: 1, stateTaxablePct: 1 },
      ],
      expenseStreams: [
        { id: 'core', description: 'Core', whose: 'Household' as const,
          startAge: 60, end: { mode: 'age' as const, age: 92 }, survivorPct: 1,
          annualAmount: 30_000, inflationPct: { mode: 'cpi' as const } },
      ],
      assumptions: { ...base.assumptions, legacyTargetTaxAdjReal: 0 },
    };
    const r = optimizeCached(tightPlan, 'max-sustainable-spending', { useNelderMead: false });
    expect(r.headline).not.toContain('depletes even at 50%');
    expect(r.ranOut).toBe(false);
  }, 120_000);

  it('thorough mode is at least as good as non-thorough on the same plan', () => {
    const plan = defaultPlan();
    const fast = optimizeCached(plan, 'max-end-balance', { useNelderMead: false, thorough: false });
    const thorough = optimizeCached(plan, 'max-end-balance', { useNelderMead: false, thorough: true });
    // Thorough produces a result in the same ballpark as fast. Allow ≤1% gap: both modes run
    // a smoothing pass that accepts up to 0.1% degradation per step for schedule smoothness,
    // and the two modes start smoothing from different pre-smooth solutions.
    expect(thorough.projection.endTotalReal).toBeGreaterThanOrEqual(fast.projection.endTotalReal * 0.99);
    // And it should perform more evaluations.
    expect(thorough.evaluations).toBeGreaterThan(fast.evaluations);
  }, 120_000);
});
