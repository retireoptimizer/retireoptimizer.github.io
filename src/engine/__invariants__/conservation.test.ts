import { describe, it, expect } from 'vitest';
import { runProjection, type ProjectionResult } from '../projection';
import { assertPortfolioConservation } from './assertions';
import type { Plan, LumpSumEvent } from '../../schemas/plan';
import * as G from '../__golden/plans';

/** Single filer, retires at 65 with a large taxable account so taxable money remains through
 *  the inheritance years (the case where the old engine created phantom money). */
function singlePlan(): Plan {
  const p = G.planB_largeTradSingle();
  p.portfolio.personA = { ...p.portfolio.personA, taxable: 1_500_000, taxableBasis: 900_000 };
  return p;
}

const inherit = (bucket: LumpSumEvent['bucket'], amount: number): LumpSumEvent =>
  ({ id: bucket, description: bucket, whose: 'A', bucket, age: 66, amount });

/** Rows the conservation check covers: retired, no contributions. */
const checkedRows = (proj: ProjectionResult, plan: Plan) =>
  proj.rows.filter((r) => r.ageA >= plan.personA.retirementAge && r.contribA === 0 && r.contribB === 0);

function run(plan: Plan): ProjectionResult {
  const proj = runProjection(plan);
  assertPortfolioConservation(proj, plan);
  return proj;
}

describe('portfolio conservation: inherited accounts', () => {
  const cases: [string, LumpSumEvent, Plan['withdrawalStrategy']][] = [
    ['inherited HSA', inherit('inheritedHSA', 50_000), 'taxfirst'],
    ['inherited pre-tax IRA (taxfirst)', inherit('inheritedPreTaxIRA', 100_000), 'taxfirst'],
    ['inherited pre-tax IRA (tradfirst)', inherit('inheritedPreTaxIRA', 100_000), 'tradfirst'],
    ['inherited Roth (taxfirst)', inherit('inheritedRoth', 100_000), 'taxfirst'],
    ['inherited Roth (tradfirst)', inherit('inheritedRoth', 100_000), 'tradfirst'],
  ];
  for (const [name, ev, strat] of cases) {
    it(name, () => {
      const p = singlePlan();
      p.withdrawalStrategy = strat;
      p.lumpSumEvents = [ev];
      const proj = run(p);
      // The inheritance years must actually be covered (taxable still funded, cash received).
      const inhRows = checkedRows(proj, p).filter((r) => r.ageA >= 66 && r.ageA <= 76);
      expect(inhRows.length).toBe(11);
      expect(inhRows[0].endTaxable).toBeGreaterThan(1000);
      const cash = inhRows.reduce((s, r) => s + (r.lumpSumOrdinaryIncome ?? 0) + (r.lumpSumForcedRothDist ?? 0), 0);
      expect(cash).toBeGreaterThan(ev.amount * 0.99);
    });
  }

  it('inherited HSA is not deposited to taxable and ends the plan lower than a taxable gift of the same size', () => {
    const hsa = singlePlan(); hsa.lumpSumEvents = [inherit('inheritedHSA', 50_000)];
    const gift = singlePlan(); gift.lumpSumEvents = [inherit('taxable', 50_000)];
    const hsaRow = run(hsa).rows.find((r) => r.ageA === 66)!;
    expect(hsaRow.lumpSumInjectTaxable).toBe(0);
    expect(run(hsa).rows.at(-1)!.endTotal).toBeLessThan(run(gift).rows.at(-1)!.endTotal);
  });
});

describe('portfolio conservation: Roth conversion + pay tax from brokerage', () => {
  it('bracket-fill conversion, single filer', () => {
    const p = singlePlan();
    p.conversion = { ...p.conversion, mode: 'bracket-fill', startAge: 65, endAge: 72 };
    p.payTaxFromBrokerage = true;
    const proj = run(p);
    const convRows = proj.rows.filter((r) => r.rothConv > 0);
    expect(convRows.length).toBeGreaterThan(3);
    expect(convRows.some((r) => r.taxFromBrokerage > 0)).toBe(true);
  });
});

describe('portfolio conservation: shortfall (depleting plans)', () => {
  for (const strat of ['taxfirst', 'tradfirst', 'rothfirst', 'proportional'] as const) {
    for (const fromBrok of [true, false]) {
      it(`${strat} payTaxFromBrokerage=${fromBrok}`, () => {
        const p = G.planA_simple();
        p.withdrawalStrategy = strat;
        p.payTaxFromBrokerage = fromBrok;
        p.expenseStreams = p.expenseStreams.map((e) => ({ ...e, annualAmount: e.annualAmount * 3 }));
        const proj = run(p);
        const a = p.assumptions;
        const sfRows = proj.rows.filter((r) => r.shortfall > 0);
        expect(sfRows.length).toBeGreaterThan(0);
        for (const r of sfRows) {
          // Unfunded need computed without the engine's withdrawal fields: everything the
          // portfolio could provide this year is gone, so the gap is need minus all cash.
          expect(r.endTotal).toBeLessThan(1);
          const available = r.begTaxable * (1 + a.taxableReturn) + r.begTraditional * (1 + a.tradReturn) + r.begRoth * (1 + a.rothReturn);
          const cash = r.totalSS + r.otherIncome + (r.lumpSumOrdinaryIncome ?? 0) + (r.lumpSumForcedRothDist ?? 0) - (r.lumpSumForcedTradDist ?? 0);
          const need = r.netSpend + r.fedTax + r.stateTaxAmt + r.irmaa + r.niit + (r.acaPremium ?? 0);
          expect(r.shortfall).toBeCloseTo(need - cash - available, 0);
        }
        expect(proj.rows.some((r) => r.ranOut)).toBe(true);
      });
    }
  }
});

describe('portfolio conservation: golden plans', () => {
  const plans = Object.entries(G).filter(([, f]) => typeof f === 'function') as [string, () => Plan][];
  for (const [name, make] of plans) {
    it(name, () => {
      const p = make();
      const proj = run(p);
      expect(checkedRows(proj, p).length).toBeGreaterThan(0);
      // No unfunded spending while money is still left in the portfolio.
      for (const r of proj.rows) {
        if (r.endTotal > 1) expect(r.shortfall, `age ${r.ageA}`).toBe(0);
      }
      if (!proj.rows.some((r) => r.ranOut)) expect(proj.lifetimeShortfallReal).toBe(0);
    });
  }
});
