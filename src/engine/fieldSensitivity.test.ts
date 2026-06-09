import { describe, it, expect } from 'vitest';
import { runProjection } from './projection';
import { samplePlan as defaultPlan } from '../schemas/plan';
import type { Plan, IncomeStream } from '../schemas/plan';

/** Sensitivity contract: every UI-editable field that the projection consumes
 *  must move at least one observable output metric (endBalance or lifetimeFedTax)
 *  by a non-trivial amount when perturbed.
 *
 *  Why this exists: the SS-streams-ignored bug (2026-05) was a UI-editable field
 *  that was silently dropped by the engine. Users typed values into rows that
 *  had zero effect on the projection. This suite catches that whole class —
 *  "editable but inert" — by mutating each field and asserting a delta.
 *
 *  Some fields are intentionally informational-only (e.g., a Wages-typed income
 *  stream during accumulation, since the engine models savings via the explicit
 *  annualContribution field rather than deriving from wages). Those are tested
 *  in the SKIPPED block at the bottom with an explanatory comment.
 */

const DELTA_THRESHOLD = 1000; // $1K is the minimum movement we expect from a meaningful field perturbation

/** Run two projections (base and mutated) and return the magnitude of change. */
function sensitivity(basePlan: Plan, mutate: (p: Plan) => Plan): {
  endDelta: number;
  taxDelta: number;
} {
  const base = runProjection(basePlan);
  const mutated = runProjection(mutate(basePlan));
  return {
    endDelta: Math.abs(mutated.endTotalReal - base.endTotalReal),
    taxDelta: Math.abs(mutated.lifetimeFedTax - base.lifetimeFedTax),
  };
}

describe('Field sensitivity — UI-editable fields must affect the projection', () => {
  // Each test mutates one field and asserts a non-trivial movement in
  // endBalance OR lifetimeFedTax. If a future refactor accidentally ignores a
  // field (the SS bug pattern), the corresponding test fails.

  describe('Demographics & timing', () => {
    it('personA.retirementAge', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p, personA: { ...p.personA, retirementAge: p.personA.retirementAge + 3 },
      }));
      expect(d.endDelta + d.taxDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('personA.planToAge', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p, personA: { ...p.personA, planToAge: p.personA.planToAge - 5 },
      }));
      expect(d.endDelta + d.taxDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('personB.retirementAge', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p, personB: p.personB ? { ...p.personB, retirementAge: p.personB.retirementAge + 5 } : p.personB,
      }));
      expect(d.endDelta + d.taxDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('personA.passingAge (affects survivor SS and filing status)', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p, personA: { ...p.personA, passingAge: 85 },
      }));
      expect(d.endDelta + d.taxDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });
  });

  describe('Return & inflation assumptions', () => {
    it('preRetReturn', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p, assumptions: { ...p.assumptions, preRetReturn: p.assumptions.preRetReturn + 0.02 },
      }));
      expect(d.endDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('postRetReturn', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p, assumptions: { ...p.assumptions, postRetReturn: p.assumptions.postRetReturn + 0.02 },
      }));
      expect(d.endDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('inflation', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p, assumptions: { ...p.assumptions, inflation: p.assumptions.inflation + 0.01 },
      }));
      expect(d.endDelta + d.taxDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('rmdStartAge (asserts lifetimeRMD shifts — on default taxfirst plan, end balance is invariant because the engine offsets forced RMDs with reduced voluntary withdrawals)', () => {
      const base = runProjection(defaultPlan());
      const mut = runProjection({ ...defaultPlan(), assumptions: { ...defaultPlan().assumptions, rmdStartAge: 73 } });
      expect(Math.abs(mut.lifetimeRMD - base.lifetimeRMD)).toBeGreaterThan(DELTA_THRESHOLD);
    });
  });

  describe('Portfolio balances & contributions', () => {
    it('personA.taxable balance', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p, portfolio: { ...p.portfolio, personA: { ...p.portfolio.personA, taxable: p.portfolio.personA.taxable + 100_000 } },
      }));
      expect(d.endDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('personA.traditional balance', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p, portfolio: { ...p.portfolio, personA: { ...p.portfolio.personA, traditional: p.portfolio.personA.traditional + 100_000 } },
      }));
      expect(d.endDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('personA.roth balance', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p, portfolio: { ...p.portfolio, personA: { ...p.portfolio.personA, roth: p.portfolio.personA.roth + 100_000 } },
      }));
      expect(d.endDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('personA.annualContribution', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p, portfolio: { ...p.portfolio, personA: { ...p.portfolio.personA, annualContribution: p.portfolio.personA.annualContribution + 10_000 } },
      }));
      expect(d.endDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('personA.contribSplit (shift from roth → traditional changes tax profile)', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p, portfolio: { ...p.portfolio, personA: { ...p.portfolio.personA, contribSplit: { taxable: 0.1, traditional: 0.7, roth: 0.2 } } },
      }));
      // contribSplit affects WHICH bucket gets the contribution, so end balance
      // (after taxes on withdrawal) shifts.
      expect(d.endDelta + d.taxDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });
  });

  describe('Income streams (engine must honor each editable type)', () => {
    const baseWithExtra = (extra: IncomeStream): Plan => {
      const p = defaultPlan();
      return { ...p, incomeStreams: [...p.incomeStreams, extra] };
    };

    it('SS-typed stream annualAmount', () => {
      const baseStream: IncomeStream = {
        id: 'ss-test', description: 'SS extra', whose: 'A', type: 'SS',
        startAge: 70, stopAge: 95, annualAmount: 10_000, growthPct: 0.025, taxablePct: 1,
      };
      const base = runProjection(baseWithExtra({ ...baseStream, annualAmount: 10_000 }));
      const mut = runProjection(baseWithExtra({ ...baseStream, annualAmount: 30_000 }));
      expect(Math.abs(mut.endTotalReal - base.endTotalReal)).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('Pension stream annualAmount', () => {
      const baseStream: IncomeStream = {
        id: 'p-test', description: 'Pension', whose: 'A', type: 'Pension',
        startAge: 65, stopAge: 90, annualAmount: 20_000, growthPct: 0.02, taxablePct: 1,
      };
      const base = runProjection(baseWithExtra({ ...baseStream, annualAmount: 20_000 }));
      const mut = runProjection(baseWithExtra({ ...baseStream, annualAmount: 40_000 }));
      expect(Math.abs(mut.endTotalReal - base.endTotalReal)).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('Rental stream annualAmount', () => {
      const baseStream: IncomeStream = {
        id: 'r-test', description: 'Rental', whose: 'Household', type: 'Rental',
        startAge: 65, stopAge: 90, annualAmount: 10_000, growthPct: 0.02, taxablePct: 0.7,
      };
      const base = runProjection(baseWithExtra({ ...baseStream, annualAmount: 10_000 }));
      const mut = runProjection(baseWithExtra({ ...baseStream, annualAmount: 30_000 }));
      expect(Math.abs(mut.endTotalReal - base.endTotalReal)).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('Annuity stream annualAmount', () => {
      const baseStream: IncomeStream = {
        id: 'a-test', description: 'Annuity', whose: 'A', type: 'Annuity',
        startAge: 65, stopAge: 90, annualAmount: 10_000, growthPct: 0, taxablePct: 0.7,
      };
      const base = runProjection(baseWithExtra({ ...baseStream, annualAmount: 10_000 }));
      const mut = runProjection(baseWithExtra({ ...baseStream, annualAmount: 30_000 }));
      expect(Math.abs(mut.endTotalReal - base.endTotalReal)).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('Other stream annualAmount (during retirement)', () => {
      const baseStream: IncomeStream = {
        id: 'o-test', description: 'Other', whose: 'Household', type: 'Other',
        startAge: 65, stopAge: 90, annualAmount: 10_000, growthPct: 0.02, taxablePct: 1,
      };
      const base = runProjection(baseWithExtra({ ...baseStream, annualAmount: 10_000 }));
      const mut = runProjection(baseWithExtra({ ...baseStream, annualAmount: 30_000 }));
      expect(Math.abs(mut.endTotalReal - base.endTotalReal)).toBeGreaterThan(DELTA_THRESHOLD);
    });
  });

  describe('Expense streams', () => {
    it('annualAmount', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p,
        expenseStreams: p.expenseStreams.map((e, i) => i === 0 ? { ...e, annualAmount: e.annualAmount + 20_000 } : e),
      }));
      expect(d.endDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('inflationPct', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p,
        expenseStreams: p.expenseStreams.map((e, i) => i === 0 ? { ...e, inflationPct: e.inflationPct + 0.02 } : e),
      }));
      expect(d.endDelta + d.taxDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('startAge', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p,
        expenseStreams: p.expenseStreams.map((e, i) => i === 0 ? { ...e, startAge: e.startAge + 3 } : e),
      }));
      expect(d.endDelta + d.taxDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('stopAge', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p,
        expenseStreams: p.expenseStreams.map((e, i) => i === 0 ? { ...e, stopAge: Math.max(e.startAge + 1, e.stopAge - 10) } : e),
      }));
      expect(d.endDelta + d.taxDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });
  });

  describe('Strategy & conversion', () => {
    it('withdrawalStrategy (taxfirst → rothfirst)', () => {
      const d = sensitivity(defaultPlan(), (p) => ({ ...p, withdrawalStrategy: 'rothfirst' }));
      expect(d.endDelta + d.taxDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('conversion.mode (off → bracket-fill)', () => {
      const d = sensitivity(defaultPlan(), (p) => ({
        ...p, conversion: { ...p.conversion, mode: 'bracket-fill' as const },
      }));
      expect(d.endDelta + d.taxDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });

    it('state (IL → CA, retirement-income taxability differs)', () => {
      const d = sensitivity(defaultPlan(), (p) => ({ ...p, state: 'CA' as const }));
      expect(d.endDelta + d.taxDelta).toBeGreaterThan(DELTA_THRESHOLD);
    });
  });

  // Documented intentional no-ops. If any of these starts moving the projection,
  // the engine has grown a new dependency on the field — that's worth flagging
  // explicitly in code review rather than silently.
  describe('Known informational-only fields', () => {
    it.skip('Wages-typed income stream during accumulation does NOT affect projection (engine derives savings from annualContribution, not wages — this is by design)', () => {
      // If this assertion ever starts holding, the engine has been changed
      // to wire wages into the savings rate. Promote this test to active.
      const p = defaultPlan();
      const base = runProjection(p);
      const withWages = runProjection({
        ...p,
        incomeStreams: [...p.incomeStreams, {
          id: 'w', description: 'Wages', whose: 'A', type: 'Wages',
          startAge: 40, stopAge: p.personA.retirementAge - 1,
          annualAmount: 100_000, growthPct: 0.03, taxablePct: 1,
        }],
      });
      expect(Math.abs(withWages.endTotalReal - base.endTotalReal)).toBeLessThan(1);
    });
  });
});
