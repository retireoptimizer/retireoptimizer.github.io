/**
 * External engine validation — independent arithmetic oracle.
 *
 * This file deliberately avoids importing shared utilities. Every expected value is
 * computed here from first principles so a bug in a shared helper cannot simultaneously
 * hide in the engine AND in the test. The engine under test is runProjection; the
 * validator is plain arithmetic in this file.
 *
 * Tests are grouped by the specific math invariant they verify.
 */
import { describe, it, expect } from 'vitest';
import { runProjection } from './projection';
import { STOCK_REAL, BOND_REAL, CPI_INFLATION, START_YEAR, N_YEARS, indexOfYear } from './marketHistory';
import { historicalBootstrap, historicalSequence, mulberry32 } from './returnModels';
import { defaultPlan } from '../schemas/plan';

// ---------------------------------------------------------------------------
// Helpers — implemented independently, not imported from engine/lib
// ---------------------------------------------------------------------------

/** Cumulative product: inflationFactor[i] = product of (1 + rates[0..i-1]), factor[0] = 1. */
function cumulativeFactors(rates: number[]): number[] {
  const factors: number[] = [1];
  for (const r of rates) factors.push(factors[factors.length - 1] * (1 + r));
  return factors; // length = rates.length + 1
}

/** Portfolio balance after growth and a single net withdrawal. */
function portfolioStep(balance: number, returnRate: number, netWithdrawal: number): number {
  return Math.max(0, balance * (1 + returnRate) - netWithdrawal);
}

// ---------------------------------------------------------------------------
// 1. Real ↔ nominal math identity
// ---------------------------------------------------------------------------
describe('real ↔ nominal math identity', () => {
  it('(1+real)*(1+cpi)-1 == nominal for every year in the dataset', () => {
    // STOCK_REAL and BOND_REAL were derived from the nominal series and CPI.
    // Verify the inverse: re-inflating real with the same CPI recovers the original
    // nominal within floating-point tolerance. This is the identity that makes
    // blending real returns then re-inflating equivalent to blending nominal returns.
    for (let i = 0; i < N_YEARS; i++) {
      const nominalStock = (1 + STOCK_REAL[i]) * (1 + CPI_INFLATION[i]) - 1;
      const nominalBond  = (1 + BOND_REAL[i])  * (1 + CPI_INFLATION[i]) - 1;
      // Recover from a known historical year where we can spot-check:
      // 1928 (index 0): stock nominal +43.81%, bond nominal +0.84%, CPI -1.17%.
      if (i === 0) {
        expect(nominalStock).toBeCloseTo(0.4381, 4);
        expect(nominalBond).toBeCloseTo(0.0084, 4);
      }
      // For all years: real→nominal and back must be finite and self-consistent.
      const realStockBack = (1 + nominalStock) / (1 + CPI_INFLATION[i]) - 1;
      expect(realStockBack).toBeCloseTo(STOCK_REAL[i], 12);
      const realBondBack  = (1 + nominalBond)  / (1 + CPI_INFLATION[i]) - 1;
      expect(realBondBack).toBeCloseTo(BOND_REAL[i], 12);
    }
  });

  it('blending real then inflating == blending nominal directly', () => {
    // Proof: blendedReal = e*rS + (1-e)*rB  →  (1+blendedReal)*(1+cpi) - 1
    //        blendedNominal = e*nS + (1-e)*nB
    // These are equal because:
    //   (1 + e*rS + (1-e)*rB)*(1+cpi)
    //   = e*(1+rS)*(1+cpi) + (1-e)*(1+rB)*(1+cpi)  [distribute]
    //   = e*(1+nS) + (1-e)*(1+nB)                  [nX = (1+rX)*(1+cpi)-1]
    //   = 1 + blendedNominal  ✓
    const equityPcts = [0, 0.4, 0.6, 1];
    for (const e of equityPcts) {
      for (let i = 0; i < N_YEARS; i++) {
        const cpi = CPI_INFLATION[i];
        const nS  = (1 + STOCK_REAL[i]) * (1 + cpi) - 1;
        const nB  = (1 + BOND_REAL[i])  * (1 + cpi) - 1;
        const blendedNominal = e * nS + (1 - e) * nB;
        const blendedReal    = e * STOCK_REAL[i] + (1 - e) * BOND_REAL[i];
        const fromBlendedReal = (1 + blendedReal) * (1 + cpi) - 1;
        expect(fromBlendedReal).toBeCloseTo(blendedNominal, 12);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 2. historicalBootstrap / historicalSequence math
// ---------------------------------------------------------------------------
describe('returnModels math', () => {
  it('bootstrap nominal returns equal (1+blendedReal)*(1+cpi) - 1 for every sampled year', () => {
    // We sample at a known equityPct and then verify the relationship between the
    // returned nominal and the inflation for every position.
    const rand = mulberry32(7);
    const { returns, inflations } = historicalBootstrap(rand, 0.6, 30, 5);
    for (let i = 0; i < returns.length; i++) {
      const blendedReal = (1 + returns[i]) / (1 + inflations[i]) - 1;
      // blendedReal must be within the range of historical blended returns (not an exact
      // point check, because we don't know which year was sampled, but bounds are tight).
      const minBlended = Math.min(...Array.from({ length: N_YEARS }, (_, j) =>
        0.6 * STOCK_REAL[j] + 0.4 * BOND_REAL[j]));
      const maxBlended = Math.max(...Array.from({ length: N_YEARS }, (_, j) =>
        0.6 * STOCK_REAL[j] + 0.4 * BOND_REAL[j]));
      expect(blendedReal).toBeGreaterThanOrEqual(minBlended - 1e-9);
      expect(blendedReal).toBeLessThanOrEqual(maxBlended + 1e-9);
    }
  });

  it('historicalSequence year-0 matches dataset at start year', () => {
    const year = 1973;
    const idx  = indexOfYear(year);
    expect(idx).toBe(year - START_YEAR);
    const { returns, inflations } = historicalSequence(0.6, 5, idx);
    const expectedReal    = 0.6 * STOCK_REAL[idx] + 0.4 * BOND_REAL[idx];
    const expectedCpi     = CPI_INFLATION[idx];
    const expectedNominal = (1 + expectedReal) * (1 + expectedCpi) - 1;
    expect(returns[0]).toBeCloseTo(expectedNominal, 12);
    expect(inflations[0]).toBeCloseTo(expectedCpi, 12);
  });
});

// ---------------------------------------------------------------------------
// 3. Inflation factor accumulation in runProjection
// ---------------------------------------------------------------------------
describe('inflationFactor accumulation', () => {
  it('fixed-rate factor equals power law', () => {
    // Sanity-check the baseline: with no inflationOverrides, inflationFactor for year i
    // must equal (1 + planInflation)^i.
    const plan = defaultPlan();
    plan.personA.dob = `${new Date().getFullYear() - 50}-01-01`;
    plan.personA.retirementAge = 51; // retire immediately
    plan.personA.planToAge = 55;
    plan.assumptions.inflation = 0.03;
    plan.assumptions.tradReturn = 0.05;
    plan.expenseStreams = [{
      id: 'e1', description: 'spend', whose: 'A',
      startAge: 51, stopAge: 55, annualAmount: 10_000, inflationPct: 0.03,
    }];
    const proj = runProjection(plan);
    for (const row of proj.rows) {
      const year = row.year - 1; // 0-indexed
      const expected = Math.pow(1.03, year);
      expect(row.inflationFactor).toBeCloseTo(expected, 10);
    }
  });

  it('stochastic override accumulates as running product', () => {
    const plan = defaultPlan();
    plan.personA.dob = `${new Date().getFullYear() - 50}-01-01`;
    plan.personA.retirementAge = 51;
    plan.personA.planToAge = 55;
    plan.assumptions.inflation = 0.025;
    plan.assumptions.tradReturn = 0.05;
    plan.expenseStreams = [{
      id: 'e1', description: 'spend', whose: 'A',
      startAge: 51, stopAge: 55, annualAmount: 10_000, inflationPct: 0.025,
    }];
    // Five specific CPI overrides.
    const cpis = [0.07, 0.06, -0.02, 0.03, 0.04];
    // Pre-compute expected cumulative factors from scratch.
    const factors = cumulativeFactors(cpis); // factors[0]=1, factors[1]=1.07, …
    const proj = runProjection(plan, { returnOverrides: [0.05, 0.05, 0.05, 0.05, 0.05], inflationOverrides: cpis });
    for (const row of proj.rows) {
      const i = row.year - 1;
      expect(row.inflationFactor).toBeCloseTo(factors[i], 10);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Portfolio balance update
// ---------------------------------------------------------------------------
describe('portfolio balance update', () => {
  it('pre-retirement accumulation — no spending, no withdrawals', () => {
    // The simplest possible check: a single traditional account, no contributions,
    // no income, no spending. Each year the balance should be balance * (1 + r).
    const currentYear = new Date().getFullYear();
    const plan = defaultPlan();
    plan.personA.dob = `${currentYear - 45}-01-01`;
    plan.personA.retirementAge = 65; // still accumulating
    plan.personA.planToAge = 49;     // only 5 years (45..49 → 5 rows)
    plan.portfolio.personA.taxable = 0;
    plan.portfolio.personA.traditional = 1_000_000;
    plan.portfolio.personA.roth = 0;
    plan.portfolio.personA.annualContribution = 0;
    plan.assumptions.taxableReturn = 0;
    plan.assumptions.tradReturn = 0;
    plan.assumptions.rothReturn = 0;
    plan.assumptions.inflation = 0;
    plan.incomeStreams = [];
    plan.expenseStreams = [];

    const returns = [0.10, 0.05, -0.08, 0.12, 0.03];
    const proj = runProjection(plan, { returnOverrides: returns });

    // Independently compute the expected balance at end of each year.
    let expected = 1_000_000;
    for (const row of proj.rows) {
      const i = row.year - 1;
      expected = portfolioStep(expected, returns[i], 0);
      expect(row.endTraditional).toBeCloseTo(expected, 2);
    }
  });

  it('real end balance = nominal / inflationFactor', () => {
    const currentYear = new Date().getFullYear();
    const plan = defaultPlan();
    plan.personA.dob = `${currentYear - 50}-01-01`;
    plan.personA.retirementAge = 51;
    plan.personA.planToAge = 55;
    plan.portfolio.personA.traditional = 1_000_000;
    plan.portfolio.personA.taxable = 0;
    plan.portfolio.personA.roth = 0;
    plan.portfolio.personA.annualContribution = 0;
    plan.assumptions.tradReturn = 0.05;
    plan.assumptions.inflation = 0.03;
    plan.expenseStreams = [];
    plan.incomeStreams = [];
    plan.personA.ssPIA = 0;

    const cpis = [0.07, 0.04, 0.01, 0.06, 0.02];
    const proj = runProjection(plan, {
      returnOverrides: [0.08, 0.06, -0.05, 0.10, 0.04],
      inflationOverrides: cpis,
    });

    const factors = cumulativeFactors(cpis);
    for (const row of proj.rows) {
      const i = row.year - 1;
      const expectedReal = row.endTotal / factors[i];
      // The inflationFactor stored in the row should equal our cumulative product.
      expect(row.inflationFactor).toBeCloseTo(factors[i], 9);
      // Real balance = nominal / inflationFactor must hold.
      expect(row.endTotal / row.inflationFactor).toBeCloseTo(expectedReal, 6);
    }

    // The final endTotalReal from the result must equal the last row's check.
    const last = proj.rows[proj.rows.length - 1];
    expect(proj.endTotalReal).toBeCloseTo(last.endTotal / last.inflationFactor, 6);
  });
});

// ---------------------------------------------------------------------------
// 5. CPI-indexed expense streams track actual CPI (not fixed planning rate)
// ---------------------------------------------------------------------------
describe('CPI-indexed expense growth', () => {
  it('spending in year i equals base * cumulativeInflationFactor when inflationPct === planInflation', () => {
    const currentYear = new Date().getFullYear();
    const plan = defaultPlan();
    plan.personA.dob = `${currentYear - 50}-01-01`;
    plan.personA.retirementAge = 50; // retired immediately (startAgeA = 50)
    plan.personA.planToAge = 54;     // 5 years: ages 50..54
    plan.portfolio.personA.traditional = 100_000_000; // large so it never depletes
    plan.portfolio.personA.taxable = 0;
    plan.portfolio.personA.roth = 0;
    plan.portfolio.personA.annualContribution = 0;
    plan.assumptions.inflation = 0.025;
    plan.assumptions.tradReturn = 0.05;
    plan.personA.ssPIA = 0;
    plan.incomeStreams = [];

    const BASE_SPEND = 50_000;
    plan.expenseStreams = [{
      id: 'core', description: 'Core spending', whose: 'A',
      startAge: 50, stopAge: 54, annualAmount: BASE_SPEND, inflationPct: { mode: 'cpi' }, // CPI-indexed
    }];

    const cpis = [0.07, 0.06, -0.02, 0.04, 0.03];
    const factors = cumulativeFactors(cpis);
    const proj = runProjection(plan, {
      returnOverrides: [0.05, 0.05, 0.05, 0.05, 0.05],
      inflationOverrides: cpis,
    });

    for (const row of proj.rows) {
      const i = row.year - 1;
      const expectedSpend = BASE_SPEND * factors[i];
      // netSpend is the gross spending target for the year.
      expect(row.netSpend).toBeCloseTo(expectedSpend, 2);
    }
  });

  it('fixed-rate expense (inflationPct=0) is unaffected by inflationOverrides', () => {
    const currentYear = new Date().getFullYear();
    const plan = defaultPlan();
    plan.personA.dob = `${currentYear - 50}-01-01`;
    plan.personA.retirementAge = 50; // retired immediately (startAgeA = 50)
    plan.personA.planToAge = 53;     // 4 years: ages 50..53
    plan.portfolio.personA.traditional = 100_000_000;
    plan.portfolio.personA.taxable = 0;
    plan.portfolio.personA.roth = 0;
    plan.portfolio.personA.annualContribution = 0;
    plan.assumptions.inflation = 0.025;
    plan.assumptions.tradReturn = 0.05;
    plan.personA.ssPIA = 0;
    plan.incomeStreams = [];

    const BASE_SPEND = 40_000;
    plan.expenseStreams = [{
      id: 'fixed', description: 'Fixed expense', whose: 'A',
      startAge: 50, stopAge: 53, annualAmount: BASE_SPEND, inflationPct: { mode: 'fixed', rate: 0 }, // fixed nominal
    }];

    const proj = runProjection(plan, {
      returnOverrides: [0.05, 0.05, 0.05, 0.05],
      inflationOverrides: [0.07, 0.06, -0.02, 0.04],
    });

    for (const row of proj.rows) {
      // inflationPct = 0 → expense stays exactly at BASE_SPEND every year.
      expect(row.netSpend).toBeCloseTo(BASE_SPEND, 2);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Consistency: inflationFactor from row matches running product
// ---------------------------------------------------------------------------
describe('row-level consistency', () => {
  it('inflationFactor in each row matches the running product of prior inflationOverrides', () => {
    const plan = defaultPlan();
    plan.personA.dob = `${new Date().getFullYear() - 55}-01-01`;
    plan.personA.retirementAge = 56;
    plan.personA.planToAge = 60;
    plan.portfolio.personA.traditional = 5_000_000;
    plan.portfolio.personA.taxable = 0;
    plan.portfolio.personA.roth = 0;
    plan.portfolio.personA.annualContribution = 0;
    plan.assumptions.inflation = 0.025;
    plan.assumptions.tradReturn = 0.06;
    plan.personA.ssPIA = 0;
    plan.incomeStreams = [];
    plan.expenseStreams = [{
      id: 'e', description: 'spend', whose: 'A',
      startAge: 56, stopAge: 60, annualAmount: 80_000, inflationPct: 0.025,
    }];

    const cpis = [0.03, 0.07, 0.01, -0.01, 0.04];
    const proj = runProjection(plan, {
      returnOverrides: [0.07, 0.05, -0.04, 0.09, 0.06],
      inflationOverrides: cpis,
    });

    let expectedFactor = 1;
    for (const row of proj.rows) {
      expect(row.inflationFactor).toBeCloseTo(expectedFactor, 10);
      // Advance oracle factor using the CPI for this year.
      expectedFactor *= (1 + cpis[row.year - 1]);
    }
  });
});
