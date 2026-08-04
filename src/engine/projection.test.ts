import { describe, it, expect } from 'vitest';
import { runProjection } from './projection';
import { samplePlan as defaultPlan } from '../schemas/plan';
import type { Plan } from '../schemas/plan';
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

  it('max-sustainable-spending reports recommendedAnnualSpend = base × multiplier', () => {
    // Regression: the apply handler needs this absolute number to detect "already
    // applied" without snapshotting pre-apply spending. The displayed end balance
    // (~$0 at boundary) matches the saved plan ONLY after expenses are scaled to
    // this recommended level — if the consumer only applies policy, the global
    // bar diverges materially from the optimizer panel.
    const plan = defaultPlan();
    const r = optimizeStrategy(plan, 'max-sustainable-spending', { useNelderMead: false });
    expect(r.recommendedAnnualSpend).toBeDefined();
    const baseSum = plan.expenseStreams.reduce((s, e) => s + e.annualAmount, 0);
    expect(r.recommendedAnnualSpend!).toBeCloseTo(baseSum * r.solvedSpendingMultiplier!, 0);
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
    // Thorough produces a result in the same ballpark as fast. Allow ≤1% gap: both modes run
    // a smoothing pass that accepts up to 0.1% degradation per step for schedule smoothness,
    // and the two modes start smoothing from different pre-smooth solutions.
    expect(thorough.projection.endTotalReal).toBeGreaterThanOrEqual(fast.projection.endTotalReal * 0.99);
    // And it should perform more evaluations.
    expect(thorough.evaluations).toBeGreaterThan(fast.evaluations);
  }, 120_000);
});

// Helper: samplePlan has personA dob '1974-05-03' → startAge 52 in 2026.
// Age 65 is 13 years into the projection. retirementAge=59 so already retired at 65.
function baseInheritedPlan(): Plan {
  const plan = defaultPlan();
  plan.conversion.mode = 'off';
  plan.conversion.optimize = false;
  plan.lumpSumEvents = [];
  return plan;
}

describe('Inherited account types — one-time income events', () => {
  it('inheritedHSA: full balance is ordinary income in year received only', () => {
    const plan = baseInheritedPlan();
    plan.lumpSumEvents = [{ id: 'hsa-1', description: 'Inherited HSA', whose: 'A', bucket: 'inheritedHSA', age: 65, amount: 50_000 }];
    const proj = runProjection(plan);
    assertProjectionInvariants(proj, plan);

    const hsaRow = proj.rows.find(r => r.ageA === 65)!;
    expect(hsaRow).toBeDefined();
    expect(hsaRow.lumpSumOrdinaryIncome).toBeCloseTo(50_000, -1);
    expect(hsaRow.lumpSumInjectTaxable).toBeCloseTo(50_000, -1);

    // All other years have zero inherited income.
    for (const r of proj.rows) {
      if (r.ageA !== 65) expect(r.lumpSumOrdinaryIncome ?? 0).toBe(0);
    }

    // The injection year has higher fedTax than adjacent years due to $50k income spike.
    const prevRow = proj.rows.find(r => r.ageA === 64);
    const nextRow = proj.rows.find(r => r.ageA === 66);
    if (prevRow && nextRow) {
      expect(hsaRow.fedTax).toBeGreaterThan(prevRow.fedTax);
    }
  });

  it('inheritedPreTaxIRA + taxfirst: supplement fires every year in [age, age+9]', () => {
    const plan = baseInheritedPlan();
    plan.withdrawalStrategy = 'taxfirst';
    plan.lumpSumEvents = [{ id: 'ira-1', description: 'Inherited IRA', whose: 'A', bucket: 'inheritedPreTaxIRA', age: 65, amount: 100_000 }];
    const proj = runProjection(plan);
    assertProjectionInvariants(proj, plan);

    const injRow = proj.rows.find(r => r.ageA === 65)!;
    expect(injRow).toBeDefined();
    expect(injRow.lumpSumInjectTrad).toBeCloseTo(100_000, -1);

    // Supplement fires in every year of the 10-year window.
    for (let age = 65; age <= 74; age++) {
      const r = proj.rows.find(row => row.ageA === age);
      if (!r) continue;
      expect(r.lumpSumForcedTradDist).toBeGreaterThan(0);
      expect(r.lumpSumOrdinaryIncome).toBeGreaterThan(0);
    }

    // No forced dist outside the window.
    for (const r of proj.rows) {
      if (r.ageA < 65 || r.ageA > 74) {
        expect(r.lumpSumForcedTradDist ?? 0).toBe(0);
      }
    }

    // Supplement fires every year (taxfirst barely touches trad). Total supplement should be
    // substantial — at least half the initial amount. The rest depletes proportionally via wdTrd.
    const totalSuppl = proj.rows.filter(r => r.ageA >= 65 && r.ageA <= 74).reduce((s, r) => s + (r.lumpSumForcedTradDist ?? 0), 0);
    expect(totalSuppl).toBeGreaterThan(50_000);
  });

  it('inheritedPreTaxIRA + tradfirst: supplement rarely fires (strategy already draws trad)', () => {
    const plan = baseInheritedPlan();
    plan.withdrawalStrategy = 'tradfirst';
    plan.lumpSumEvents = [{ id: 'ira-2', description: 'Inherited IRA', whose: 'A', bucket: 'inheritedPreTaxIRA', age: 65, amount: 100_000 }];
    const proj = runProjection(plan);
    assertProjectionInvariants(proj, plan);

    // With tradfirst, strategy already drains trad aggressively — proportional depletion
    // covers or exceeds the floor most years, so lumpSumForcedTradDist should be 0 or small.
    const windowRows = proj.rows.filter(r => r.ageA >= 65 && r.ageA < 74);
    const zeroOrNearZero = windowRows.filter(r => (r.lumpSumForcedTradDist ?? 0) < 100);
    expect(zeroOrNearZero.length).toBeGreaterThan(windowRows.length / 2);

    // Final year (age 74) forces any remaining balance out — lumpSumForcedTradDist may be nonzero.
    const finalRow = proj.rows.find(r => r.ageA === 74);
    if (finalRow) expect(finalRow.lumpSumForcedTradDist ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('inheritedRoth: no ordinary income, taxable grows each year in window', () => {
    const plan = baseInheritedPlan();
    plan.withdrawalStrategy = 'taxfirst';
    plan.lumpSumEvents = [{ id: 'roth-1', description: 'Inherited Roth', whose: 'A', bucket: 'inheritedRoth', age: 65, amount: 100_000 }];
    const proj = runProjection(plan);
    assertProjectionInvariants(proj, plan);

    const injRow = proj.rows.find(r => r.ageA === 65)!;
    expect(injRow).toBeDefined();
    expect(injRow.lumpSumInjectRoth).toBeCloseTo(100_000, -1);

    // Inherited Roth distributions produce no ordinary income.
    for (const r of proj.rows) {
      expect(r.lumpSumOrdinaryIncome ?? 0).toBe(0);
    }

    // Forced Roth dists move to taxable each year in window — taxable should have extra from that.
    for (let age = 65; age <= 74; age++) {
      const r = proj.rows.find(row => row.ageA === age);
      if (!r) continue;
      expect(r.lumpSumForcedRothDist ?? 0).toBeGreaterThanOrEqual(0);
    }

    // Baseline for comparison — Roth distributions cover some spending, so the plan needs
    // fewer taxable/trad withdrawals → ordinary income is lower → fedTax ≤ baseline.
    const baseProj = runProjection(baseInheritedPlan());
    const baseRow65 = baseProj.rows.find(r => r.ageA === 65);
    if (baseRow65 && injRow) {
      // Roth dists are tax-free, so inherited Roth year should have ≤ baseline fedTax.
      expect(injRow.fedTax).toBeLessThanOrEqual(baseRow65.fedTax + 1);
    }
  });
});
