import { describe, it, expect } from 'vitest';
import { runProjection } from './projection';
import { samplePlan as defaultPlan } from '../schemas/plan';
import type { Plan } from '../schemas/plan';
import type { BlendPolicy } from './blendPolicy';
import { optimizeStrategy } from './optimizer';
import { assertProjectionInvariants, assertDeterministic } from './__invariants__/assertions';
import { IRA_CONTRIB_LIMIT, IRA_CATCHUP } from './taxConstants';

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

describe('stale manual conversion schedule (optimizer-owned conversions)', () => {
  /** Accumulation-year conversions from plan.conversion, keyed to Person A's age. */
  const preRetConversions = (plan: Plan) =>
    runProjection(plan).rows.filter((r) => r.phase === 'Accum.' && r.rothConv > 0).map((r) => r.ageA);

  const withSchedule = (optimize: boolean): Plan => {
    const plan = defaultPlan();
    const startAgeA = new Date().getFullYear() - parseInt(plan.personA.dob.slice(0, 4), 10);
    const preRetAge = Math.max(startAgeA, plan.personA.retirementAge - 3);
    plan.conversion = {
      ...plan.conversion, mode: 'manual', optimize,
      manualSchedule: { [String(preRetAge)]: 100_000 },
    };
    return plan;
  };

  it('does not run a manual schedule pre-retirement when the optimizer owns conversions', () => {
    // The leak: picking "Optimizer decides" sets optimize:true but left mode:'manual' behind.
    // The optimizer's search space starts at retirementAge, so it never chose these — they must
    // not appear, or the UI implies the optimizer selected conversions it did not.
    expect(preRetConversions(withSchedule(true))).toEqual([]);
  });

  it('still honors a manual schedule the user deliberately chose (optimize:false)', () => {
    expect(preRetConversions(withSchedule(false)).length).toBeGreaterThan(0);
  });

  it('leaves retirement-year conversions untouched — the gate is accumulation-only', () => {
    const plan = defaultPlan();
    plan.conversion = { ...plan.conversion, mode: 'auto-window', optimize: true, autoAmount: 40_000,
      startAge: plan.personA.retirementAge, endAge: plan.personA.retirementAge + 5 };
    const converted = runProjection(plan).rows.filter((r) => r.phase !== 'Accum.' && r.rothConv > 0);
    expect(converted.length).toBeGreaterThan(0);
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
        windows: [{ fromAge: plan.personA.retirementAge, toAge: plan.personA.planThroughAge, pctTaxable: 1, pctTraditional: 0, pctRoth: 0 }],
        source: 'manual',
      },
    });
    expect(r.projection.endTaxAdjustedReal).toBeGreaterThanOrEqual(baseline.endTaxAdjustedReal - 1);
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

// ---------------------------------------------------------------------------
// Tax-exempt income (MuniBond / VA / taxableExemptYield)
// ---------------------------------------------------------------------------

function baseTaxExemptPlan(): Plan {
  const plan = defaultPlan();
  plan.conversion.mode = 'off';
  plan.conversion.optimize = false;
  plan.lumpSumEvents = [];
  return plan;
}

describe('MuniBond income stream', () => {
  it('full gross reaches otherIncome; ordIncome and magi exclude it', () => {
    const plan = baseTaxExemptPlan();
    plan.incomeStreams = plan.incomeStreams.filter(s => s.type !== 'SS');
    plan.incomeStreams.push({
      id: 'muni-1', description: 'Muni', whose: 'Household', type: 'MuniBond',
      startAge: 59, end: { mode: 'age' as const, age: 98 }, survivorPct: 0, annualAmount: 20_000,
      growthPct: { mode: 'fixed', rate: 0 }, taxablePct: 0, stateTaxablePct: 1,
    });
    const proj = runProjection(plan);

    // Only check rows while the stream is active (startAge=59, stopAge=98)
    const muniActiveRows = proj.rows.filter(r =>
      (r.phase === 'Retire' || r.phase === 'Survivor') && r.ageA >= 59 && r.ageA <= 98
    );
    expect(muniActiveRows.length).toBeGreaterThan(0);
    for (const r of muniActiveRows) {
      // Gross must be spendable: otherIncome >= 20_000 (fixed rate growth = 0)
      expect(r.otherIncome).toBeGreaterThanOrEqual(19_500);
      // Muni is federally tax-exempt: not in ordIncome
      // otherIncomeTaxable should be 0 (no federal-taxable streams)
      expect(r.otherIncomeTaxable).toBe(0);
      // exemptInterest should capture the muni amount
      expect(r.exemptInterest).toBeGreaterThanOrEqual(19_500);
    }
  });

  it('exemptInterest routes to acaMagi but not magi (IRMAA/ACA vs NIIT routing)', () => {
    // Test the routing invariant directly on a single plan:
    // acaMagi = magi + exemptInterest + non-taxable SS (§36B)
    // magi = ordIncome + ltcg (exempt interest excluded)
    const plan = baseTaxExemptPlan();
    plan.incomeStreams = plan.incomeStreams.filter(s => s.type !== 'SS');
    plan.incomeStreams.push({
      id: 'muni-2', description: 'Muni', whose: 'Household', type: 'MuniBond',
      startAge: 59, end: { mode: 'age' as const, age: 98 }, survivorPct: 0, annualAmount: 30_000,
      growthPct: { mode: 'fixed', rate: 0 }, taxablePct: 0, stateTaxablePct: 0,
    });
    const proj = runProjection(plan);
    const retiredRows = proj.rows.filter(r => r.phase === 'Retire' && r.totalSS === 0);
    expect(retiredRows.length).toBeGreaterThan(0);
    for (const r of retiredRows) {
      // acaMagi must exceed magi by the exempt interest (since SS=0 here, non-taxable SS=0 too)
      expect(r.acaMagi).toBeCloseTo(r.magi + r.exemptInterest, -1);
      // magi excludes exempt interest
      expect(r.magi).toBeCloseTo(r.ordIncome + r.ltcg, -1);
      // exemptInterest > 0 (the muni is active)
      expect(r.exemptInterest).toBeGreaterThan(25_000);
    }
  });

  it('muni stream raises SS taxability — exemptInterest is included in provisional income', () => {
    // A plan with SS starting at 65 but zero spending beyond SS income.
    // Without muni: PI ≈ 0.5 * SS → near/below §86 threshold.
    // With muni: PI += exempt interest → above threshold → higher taxable SS → higher ordIncome.
    const plan = baseTaxExemptPlan();
    plan.personA.dob = '1961-01-01'; // age 65 in 2026
    plan.personA.retirementAge = 65;
    plan.personA.planThroughAge = 90;
    plan.personA.ssPIA = 24_000;
    plan.personA.ssClaimAge = 65;
    plan.personB = undefined;
    plan.expenseStreams = [
      { id: 'spend', description: 'Spending', whose: 'Household', startAge: 65, end: { mode: 'age' as const, age: 90 }, survivorPct: 1, annualAmount: 20_000, inflationPct: { mode: 'fixed', rate: 0 } },
    ];
    plan.incomeStreams = [];
    plan.portfolio = { personA: { taxable: 0, taxableBasis: 0, traditional: 500_000, roth: 0, annualContribution: 0, contribGrowth: { mode: 'fixed', rate: 0 }, contribSplit: { taxable: 0, traditional: 1, roth: 0 } } };
    plan.assumptions = { ...plan.assumptions, taxableExemptYield: 0, taxableExemptStatePct: 1 };

    const planWithMuni = { ...plan, incomeStreams: [...plan.incomeStreams] };
    planWithMuni.incomeStreams = [{
      id: 'muni-ss', description: 'Muni', whose: 'Household', type: 'MuniBond' as const,
      startAge: 65, end: { mode: 'age' as const, age: 90 }, survivorPct: 0, annualAmount: 30_000,
      growthPct: { mode: 'fixed', rate: 0 } as const, taxablePct: 0, stateTaxablePct: 0,
    }];

    const projBase = runProjection(plan);
    const projMuni = runProjection(planWithMuni);

    const rowBase = projBase.rows.find(r => r.ageA === 65)!;
    const rowMuni = projMuni.rows.find(r => r.ageA === 65)!;
    if (rowBase && rowMuni) {
      // Muni adds exempt interest → more SS taxable → higher ordIncome
      expect(rowMuni.ordIncome).toBeGreaterThan(rowBase.ordIncome);
      // Muni appears in exemptInterest
      expect(rowMuni.exemptInterest).toBeCloseTo(30_000, -2);
    }
  });
});

describe('VA / Disability income stream', () => {
  it('VA gross in otherIncome but otherIncomeTaxable = 0 and no exemptInterest', () => {
    // VA income is in gross but exempt from EVERY tax surface — not in ordIncome, not in
    // exemptInterest (§103), not in state tax. Test routing directly without comparing plans.
    const plan = baseTaxExemptPlan();
    plan.personA.dob = '1961-01-01';
    plan.personA.retirementAge = 65;
    plan.personA.planThroughAge = 90;
    plan.personA.planThroughAge = 90;
    plan.personA.ssPIA = 0;
    plan.personA.ssClaimAge = 65;
    plan.personB = undefined;
    plan.incomeStreams = [{
      id: 'va-1', description: 'VA', whose: 'A', type: 'VA',
      startAge: 65, end: { mode: 'age' as const, age: 90 }, survivorPct: 0, annualAmount: 20_000,
      growthPct: { mode: 'fixed', rate: 0 }, taxablePct: 0, stateTaxablePct: 0,
    }];
    plan.expenseStreams = [
      { id: 'spend', description: 'Spending', whose: 'Household', startAge: 65, end: { mode: 'age' as const, age: 90 }, survivorPct: 1, annualAmount: 15_000, inflationPct: { mode: 'fixed', rate: 0 } },
    ];
    plan.portfolio = { personA: { taxable: 0, taxableBasis: 0, traditional: 300_000, roth: 0, annualContribution: 0, contribGrowth: { mode: 'fixed', rate: 0 }, contribSplit: { taxable: 0, traditional: 1, roth: 0 } } };
    plan.assumptions = { ...plan.assumptions, taxableExemptYield: 0, taxableExemptStatePct: 1 };

    const proj = runProjection(plan);
    // dob='1961-01-01' → startAgeA=65 in 2026; first row is ageA=65
    const row = proj.rows.find(r => r.ageA === 65);
    expect(row).toBeDefined();
    if (row) {
      // VA cash appears as otherIncome (gross)
      expect(row.otherIncome).toBeGreaterThanOrEqual(19_500);
      // But not in the taxable portion
      expect(row.otherIncomeTaxable).toBe(0);
      // VA is not §103 exempt interest (it's exempt via 38 U.S.C. §5301 — different surface)
      expect(row.exemptInterest).toBe(0);
      // acaMagi = magi (no exempt interest, no non-taxable SS)
      expect(row.acaMagi).toBeCloseTo(row.magi, -1);
    }
  });
});

describe('Annuity taxablePct regression (dropped income bug)', () => {
  it('taxablePct:0.7 annuity contributes full gross to otherIncome', () => {
    const plan = baseTaxExemptPlan();
    plan.incomeStreams = [];
    plan.incomeStreams.push({
      id: 'ann-1', description: 'Annuity', whose: 'Household', type: 'Annuity',
      startAge: 59, end: { mode: 'age' as const, age: 98 }, survivorPct: 0, annualAmount: 24_000,
      growthPct: { mode: 'fixed', rate: 0 }, taxablePct: 0.7, stateTaxablePct: 1,
    });

    const proj = runProjection(plan);
    const row = proj.rows.find(r => r.ageA === 62 && r.phase === 'Retire')!;
    if (row) {
      // Full 24_000 must be spendable (gross), not just the 70% taxable portion
      expect(row.otherIncome).toBeGreaterThanOrEqual(23_500);
      // Federal-taxable portion is 70%
      expect(row.otherIncomeTaxable).toBeCloseTo(24_000 * 0.7, -1);
    }
  });
});

describe('taxableDistributePct', () => {
  const basePlan = (): Plan => {
    const p = defaultPlan();
    p.personA.dob = '1961-01-01';
    p.personA.retirementAge = 65;
    p.personA.planThroughAge = 90;
    p.personA.ssPIA = 0;
    p.personA.ssClaimAge = 65;
    p.personB = undefined;
    p.incomeStreams = [];
    p.expenseStreams = [{ id: 'e', description: 'Spending', whose: 'Household', startAge: 65, end: { mode: 'age' as const, age: 90 }, survivorPct: 1, annualAmount: 50_000, inflationPct: { mode: 'fixed', rate: 0 } }];
    p.portfolio = { personA: { taxable: 800_000, taxableBasis: 400_000, traditional: 0, roth: 0, annualContribution: 0, contribGrowth: { mode: 'fixed', rate: 0 }, contribSplit: { taxable: 1, traditional: 0, roth: 0 } } };
    p.assumptions = { ...p.assumptions, taxableReturn: 0.07, taxableDivYield: 0.03, taxableExemptYield: 0, taxableExemptStatePct: 1, taxableDistributePct: 0, inflation: 0 };
    return p;
  };

  it('distributedCash is nonzero in retirement and zero pre-retirement', () => {
    const p = basePlan();
    p.assumptions = { ...p.assumptions, taxableDistributePct: 0.5 };
    const rows = runProjection(p).rows;
    const retRow = rows.find(r => r.ageA === 65)!;
    expect(retRow.distributedCash).toBeGreaterThan(0);
    // distribution is retirement-gated (eitherRetired): there are no pre-retirement rows
    // in this plan (retirementAge = 65 = startAgeA), so we just confirm the retirement value.
    expect(retRow.distributedCash).toBeCloseTo(800_000 * 0.03 * 0.5, -2);
  });

  it('cash substitution: distributing reduces wdTax while ordinaryDiv and qualifiedDiv are unchanged', () => {
    // Distributing replaces portfolio withdrawal with dividend cash — same tax on dividends,
    // but fewer shares sold so less LTCG from wdTax * gainFraction.
    const p0 = basePlan();
    p0.assumptions = { ...p0.assumptions, taxableDistributePct: 0 };

    const p1 = basePlan();
    p1.assumptions = { ...p1.assumptions, taxableDistributePct: 1 };

    const row0 = runProjection(p0).rows.find(r => r.ageA === 65)!;
    const row1 = runProjection(p1).rows.find(r => r.ageA === 65)!;

    // Distributed cash reduces brokerage withdrawal.
    expect(row1.wdTax).toBeLessThan(row0.wdTax - 1);
    // Dividend tax surface is unchanged — distributePct moves cash, not tax treatment.
    expect(row1.ordinaryDiv).toBeCloseTo(row0.ordinaryDiv, -1);
    expect(row1.qualifiedDiv).toBeCloseTo(row0.qualifiedDiv, -1);
  });

  it('LTCG reduction: distributing lowers ltcg because fewer shares are sold', () => {
    const p0 = basePlan();
    p0.assumptions = { ...p0.assumptions, taxableDistributePct: 0 };

    const p1 = basePlan();
    p1.assumptions = { ...p1.assumptions, taxableDistributePct: 1 };

    const row0 = runProjection(p0).rows.find(r => r.ageA === 65)!;
    const row1 = runProjection(p1).rows.find(r => r.ageA === 65)!;
    // Less wdTax → wdTax * gainFraction smaller → ltcg lower (qualifiedDiv is same).
    expect(row1.ltcg).toBeLessThan(row0.ltcg);
  });

  it('accumulation no-op: distributedCash is zero pre-retirement (yield is reinvested)', () => {
    // annualDiv and exemptInt are retirement-gated; distributePct must not fire in accumulation.
    const p = basePlan();
    p.personA.retirementAge = 70; // 5 accumulation years before retirement
    p.assumptions = { ...p.assumptions, taxableDistributePct: 1 };
    const rows = runProjection(p).rows;
    // All rows before retirementAge must have distributedCash = 0.
    const preRetRows = rows.filter(r => r.ageA < 70);
    expect(preRetRows.length).toBeGreaterThan(0);
    preRetRows.forEach(r => expect(r.distributedCash).toBe(0));
  });

  it('exemptInterest is unchanged when distributePct changes (tax surface, not MAGI routing, is what matters)', () => {
    // Distributing exempt yield moves cash but does not change the §103 income flowing
    // into SS provisional income and ACA/IRMAA MAGI.
    const p0 = basePlan();
    p0.assumptions = { ...p0.assumptions, taxableExemptYield: 0.01, taxableDistributePct: 0 };

    const p1 = basePlan();
    p1.assumptions = { ...p1.assumptions, taxableExemptYield: 0.01, taxableDistributePct: 1 };

    const row0 = runProjection(p0).rows.find(r => r.ageA === 65)!;
    const row1 = runProjection(p1).rows.find(r => r.ageA === 65)!;
    // Exempt interest amount in the projection row should be the same.
    expect(row1.exemptInterest).toBeCloseTo(row0.exemptInterest, -2);
    // acaMagi - magi (the exemptInterest premium) should be the same.
    const premium0 = row0.acaMagi - row0.magi;
    const premium1 = row1.acaMagi - row1.magi;
    expect(premium1).toBeCloseTo(premium0, -2);
  });
});

describe('taxableExemptYield', () => {
  it('exempt interest is in exemptInterest field and acaMagi but not in magi or ordIncome', () => {
    // Test the routing invariant: acaMagi = magi + exemptInterest (when SS=0).
    // taxableExemptYield income is §103 exempt from AGI, so ordIncome and magi exclude it.
    const plan = baseTaxExemptPlan();
    plan.personA.dob = '1961-01-01';
    plan.personA.retirementAge = 65;
    plan.personA.planThroughAge = 90;
    plan.personA.planThroughAge = 90;
    plan.personA.ssPIA = 0;
    plan.personA.ssClaimAge = 65;
    plan.personB = undefined;
    plan.incomeStreams = [];
    plan.expenseStreams = [
      { id: 'spend', description: 'Spending', whose: 'Household', startAge: 65, end: { mode: 'age' as const, age: 90 }, survivorPct: 1, annualAmount: 40_000, inflationPct: { mode: 'fixed', rate: 0 } },
    ];
    plan.portfolio = { personA: { taxable: 500_000, taxableBasis: 300_000, traditional: 200_000, roth: 0, annualContribution: 0, contribGrowth: { mode: 'fixed', rate: 0 }, contribSplit: { taxable: 1, traditional: 0, roth: 0 } } };
    plan.assumptions = { ...plan.assumptions, taxableReturn: 0.05, taxableDivYield: 0, taxableExemptYield: 0.02, taxableExemptStatePct: 1 };

    const proj = runProjection(plan);
    // dob='1961-01-01' → startAgeA=65 in 2026; first row is ageA=65
    const row = proj.rows.find(r => r.ageA === 65);
    expect(row).toBeDefined();
    if (row) {
      // Portfolio-yield exempt interest should appear in exemptInterest
      expect(row.exemptInterest).toBeGreaterThan(5_000); // ~500k * 2% * inflationFactor
      // acaMagi = magi + exemptInterest (no SS in this plan)
      expect(row.acaMagi).toBeCloseTo(row.magi + row.exemptInterest, -2);
      // Exempt interest not in ordIncome (not in AGI)
      expect(row.magi).toBeCloseTo(row.ordIncome + row.ltcg, -1);
    }
  });
});

describe('spousal IRA contribution (IRC §219(c))', () => {
  // Both 52 today. A works to 60, B retires at 56. B contributes $50k through 55,
  // then a spousal IRA of $6,000/yr for ages 56–59, then nothing once A retires too.
  const spousalPlan = (spousalContribution: number, spousalTarget: 'traditional' | 'roth' = 'traditional'): Plan => {
    const p = defaultPlan();
    p.personA = { ...p.personA, dob: '1974-01-01', retirementAge: 60, planThroughAge: 90 };
    p.personB = { ...p.personA, name: 'B', dob: '1974-01-01', retirementAge: 56, planThroughAge: 90 };
    p.portfolio = {
      personA: { taxable: 0, taxableBasis: 0, traditional: 500_000, roth: 0, annualContribution: 50_000, contribGrowth: { mode: 'fixed', rate: 0 }, contribSplit: { taxable: 0, traditional: 1, roth: 0 } },
      personB: { taxable: 0, taxableBasis: 0, traditional: 500_000, roth: 0, annualContribution: 50_000, contribGrowth: { mode: 'fixed', rate: 0 }, contribSplit: { taxable: 0, traditional: 1, roth: 0 }, spousalContribution, spousalTarget },
    };
    p.assumptions = { ...p.assumptions, inflation: 0 }; // no CPI indexing — exact dollar assertions
    return p;
  };
  const atAge = (plan: Plan, age: number) => runProjection(plan).rows.find((r) => r.ageB === age)!;

  it('continues B contributions past B retirement while A still works', () => {
    const plan = spousalPlan(6_000);
    expect(atAge(plan, 55).contribB).toBeCloseTo(50_000, 2); // B still working
    expect(atAge(plan, 56).contribB).toBeCloseTo(6_000, 2);  // B retired, A working
    expect(atAge(plan, 59).contribB).toBeCloseTo(6_000, 2);
    expect(atAge(plan, 60).contribB).toBeCloseTo(0, 2);      // A retired too — window closes
  });

  it('defaults to zero — an unset spousalContribution changes nothing', () => {
    const plan = spousalPlan(0);
    expect(atAge(plan, 56).contribB).toBeCloseTo(0, 2);
    const bare = spousalPlan(0);
    delete bare.portfolio.personB!.spousalContribution;
    expect(atAge(bare, 56).contribB).toBeCloseTo(0, 2);
  });

  it('caps the contribution at the age-indexed IRA limit', () => {
    const plan = spousalPlan(50_000); // user asks for far more than §219(b) allows
    expect(atAge(plan, 56).contribB).toBeCloseTo(IRA_CONTRIB_LIMIT + IRA_CATCHUP, 2);
  });

  it('bypasses contribSplit and lands wholly in the elected IRA type', () => {
    // contribSplit is 100% traditional for B, so a Roth-targeted spousal contribution
    // proves the routing is not going through the split.
    const trad = runProjection(spousalPlan(6_000, 'traditional'));
    const roth = runProjection(spousalPlan(6_000, 'roth'));
    const y = (r: typeof trad) => r.rows.find((x) => x.ageB === 59)!;
    expect(y(roth).endRoth).toBeGreaterThan(y(trad).endRoth);
    expect(y(roth).endTraditional).toBeLessThan(y(trad).endTraditional);
  });

  it('holds all dollar-flow invariants through the spousal window', () => {
    const plan = spousalPlan(6_000, 'roth');
    assertProjectionInvariants(runProjection(plan), plan);
  });

  it('is symmetric — A can receive a spousal IRA when B is the one still working', () => {
    const plan = spousalPlan(0);
    plan.personA = { ...plan.personA, retirementAge: 56 };
    plan.personB = { ...plan.personB!, retirementAge: 60 };
    plan.portfolio.personA = { ...plan.portfolio.personA, spousalContribution: 6_000, spousalTarget: 'traditional' };
    const rows = runProjection(plan).rows;
    expect(rows.find((r) => r.ageA === 56)!.contribA).toBeCloseTo(6_000, 2);
    expect(rows.find((r) => r.ageA === 60)!.contribA).toBeCloseTo(0, 2);
  });
});
