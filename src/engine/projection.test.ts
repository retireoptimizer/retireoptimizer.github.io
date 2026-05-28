import { describe, it, expect } from 'vitest';
import { runProjection } from './projection';
import { defaultPlan } from '../schemas/plan';
import type { BlendPolicy } from './blendPolicy';
import { optimizeStrategy } from './optimizer';
import { assertProjectionInvariants, assertDeterministic } from './__invariants__/assertions';

describe('runProjection (smoke)', () => {
  const result = runProjection(defaultPlan());

  it('satisfies all dollar-flow invariants on the default plan', () => {
    assertProjectionInvariants(result, defaultPlan());
  });

  it('is deterministic — same plan twice produces identical rows', () => {
    assertDeterministic(defaultPlan());
  });

  it('produces rows up to plan-to age', () => {
    expect(result.rows.length).toBeGreaterThan(30);
    expect(result.rows.length).toBeLessThanOrEqual(75);
  });

  it('first row is year 1 with accumulation phase', () => {
    expect(result.rows[0].year).toBe(1);
    expect(result.rows[0].phase).toBe('Accum.');
  });

  it('transitions to Retire at retirement age', () => {
    const retireIdx = result.rows.findIndex(r => r.phase === 'Retire');
    expect(retireIdx).toBeGreaterThan(0);
  });

  it('balances never go negative', () => {
    for (const row of result.rows) {
      expect(row.endTaxable).toBeGreaterThanOrEqual(0);
      expect(row.endTraditional).toBeGreaterThanOrEqual(0);
      expect(row.endRoth).toBeGreaterThanOrEqual(0);
    }
  });

  it('lifetimeFedTax > 0 (paying some tax in retirement)', () => {
    expect(result.lifetimeFedTax).toBeGreaterThan(0);
  });

  it('RMD kicks in at age 75 and not before', () => {
    const beforeRmd = result.rows.find(r => r.ageA === 74);
    const atRmd = result.rows.find(r => r.ageA === 75);
    if (beforeRmd) expect(beforeRmd.rmd).toBe(0);
    if (atRmd) expect(atRmd.rmd).toBeGreaterThan(0);
  });
});

describe('BlendPolicy convAmt override', () => {
  it('produces convAmt × inflationFactor in rothConv each year of the window, zero outside', () => {
    const plan = defaultPlan();
    // Force conv mode 'off' so the legacy path doesn't add conversions.
    plan.conversion.mode = 'off';
    const policy: BlendPolicy = {
      windows: [
        { fromAge: 65, toAge: 72, pctTaxable: 0.5, pctTraditional: 0.5, pctRoth: 0, convAmt: 50_000 },
        { fromAge: 73, toAge: 95, pctTaxable: 0.5, pctTraditional: 0.5, pctRoth: 0 },
      ],
      source: 'manual',
    };
    const proj = runProjection(plan, { policy });

    for (const r of proj.rows) {
      if (r.ageA >= 65 && r.ageA <= 72 && r.phase === 'Retire') {
        const expected = 50_000 * r.inflationFactor;
        // Capped by Traditional balance — assert "close to expected or capped lower".
        expect(r.rothConv).toBeGreaterThan(0);
        expect(r.rothConv).toBeLessThanOrEqual(expected + 1);
      }
      if (r.ageA >= 73 || r.phase !== 'Retire') {
        // Outside the conv window, no policy convAmt → legacy path with mode='off' → zero.
        if (r.phase === 'Retire' && r.ageA >= 73) {
          expect(r.rothConv).toBe(0);
        }
      }
    }
  });
});

describe('optimizeStrategy (smoke)', () => {
  it('max-end-balance returns a non-empty policy and projection that survives or matches baseline', () => {
    const plan = defaultPlan();
    const r = optimizeStrategy(plan, 'max-end-balance', { useNelderMead: false });
    expect(r.policy.windows.length).toBeGreaterThan(0);
    expect(r.evaluations).toBeGreaterThan(0);
    // End balance should be >= a 100%-taxable baseline (the optimizer can't do worse than its starting point).
    const baseline = runProjection(plan, {
      policy: {
        windows: [{ fromAge: plan.personA.retirementAge, toAge: plan.personA.planToAge, pctTaxable: 1, pctTraditional: 0, pctRoth: 0 }],
        source: 'manual',
      },
    });
    expect(r.projection.endTotalReal).toBeGreaterThanOrEqual(baseline.endTotalReal - 1);
  }, 60_000);

  it('max-sustainable-spending returns a multiplier and a strategy that does not deplete', () => {
    const plan = defaultPlan();
    const r = optimizeStrategy(plan, 'max-sustainable-spending', { useNelderMead: false });
    expect(r.solvedSpendingMultiplier).toBeDefined();
    if (r.solvedSpendingMultiplier! >= 0.5) {
      expect(r.ranOut).toBe(false);
    }
  }, 120_000);

  it('min-retirement-age returns an age <= the current retirement age', () => {
    const plan = defaultPlan();
    const r = optimizeStrategy(plan, 'min-retirement-age', { useNelderMead: false });
    expect(r.solvedRetirementAge).toBeDefined();
    expect(r.solvedRetirementAge!).toBeLessThanOrEqual(plan.personA.retirementAge);
  }, 120_000);

  it('thorough mode is at least as good as non-thorough on the same plan', () => {
    const plan = defaultPlan();
    const fast = optimizeStrategy(plan, 'max-end-balance', { useNelderMead: false, thorough: false });
    const thorough = optimizeStrategy(plan, 'max-end-balance', { useNelderMead: false, thorough: true });
    // Thorough should never lose ground vs the same forward sweep — it's a strict superset of passes.
    // Allow $1 numerical slack.
    expect(thorough.projection.endTotalReal).toBeGreaterThanOrEqual(fast.projection.endTotalReal - 1);
    // And it should perform more evaluations.
    expect(thorough.evaluations).toBeGreaterThan(fast.evaluations);
  }, 120_000);
});
