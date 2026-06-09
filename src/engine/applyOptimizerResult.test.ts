import { describe, it, expect } from 'vitest';
import { optimizeStrategy } from './optimizer';
import { runProjection } from './projection';
import { applyResultToPlan } from './applyOptimizerResult';
import { samplePlan as defaultPlan } from '../schemas/plan';
import { planF_allTradCouple } from './__golden/plans';
import type { UserGoal } from './recommender';

/** Round-trip contract: for every UserGoal, the plan produced by applyResultToPlan
 *  must re-project to identical numbers as the optimizer's reported `result.projection`.
 *
 *  Why this exists: the optimizer for spending / retirement-age goals evaluates a
 *  MUTATED plan (scaled expenses or lowered retire age). If the apply handler only
 *  persists `customPolicy`, the saved plan no longer matches what the optimizer
 *  measured — the panel shows one number, the global LiveMetricsBar shows another.
 *  Reported by a user 2026-05-29; this suite locks the contract going forward.
 *
 *  Test pattern (mirror what users see on the UI):
 *    1. Pick a plan.
 *    2. Run optimizer for a goal.
 *    3. Apply via the same helper the React handler uses.
 *    4. Re-project the saved plan.
 *    5. Assert end-balance, lifetime tax, ranOut all match the optimizer's projection.
 */
describe('Optimizer Apply round-trip — panel ≡ saved-plan projection', () => {
  const GOALS: UserGoal[] = ['max-end-balance', 'max-sustainable-spending', 'min-retirement-age'];

  for (const goal of GOALS) {
    it(`${goal} on defaultPlan: applied plan re-projects to result.projection`, () => {
      const plan = defaultPlan();
      const result = optimizeStrategy(plan, goal, { useNelderMead: false });
      const appliedPlan = applyResultToPlan(plan, result);
      const reproj = runProjection(appliedPlan);

      // The optimizer's reported numbers MUST equal the saved-plan projection.
      expect(reproj.endTotalReal).toBeCloseTo(result.projection.endTotalReal, 0);
      expect(reproj.lifetimeFedTax).toBeCloseTo(result.projection.lifetimeFedTax, 0);
      expect(reproj.ranOut).toBe(result.projection.ranOut);
      expect(reproj.lifetimeRMD).toBeCloseTo(result.projection.lifetimeRMD, 0);
      expect(reproj.lifetimeConversion).toBeCloseTo(result.projection.lifetimeConversion, 0);
    }, 180_000);

    it(`${goal} on planF (high-Trad): applied plan re-projects to result.projection`, () => {
      const plan = planF_allTradCouple();
      const result = optimizeStrategy(plan, goal, { useNelderMead: false });
      const appliedPlan = applyResultToPlan(plan, result);
      const reproj = runProjection(appliedPlan);

      expect(reproj.endTotalReal).toBeCloseTo(result.projection.endTotalReal, 0);
      expect(reproj.lifetimeFedTax).toBeCloseTo(result.projection.lifetimeFedTax, 0);
      expect(reproj.ranOut).toBe(result.projection.ranOut);
    }, 180_000);
  }

  it('applyResultToPlan is idempotent for max-sustainable-spending (no double-scaling)', () => {
    const plan = defaultPlan();
    const result = optimizeStrategy(plan, 'max-sustainable-spending', { useNelderMead: false });

    const once = applyResultToPlan(plan, result);
    const twice = applyResultToPlan(once, result);

    // Spending should not double-scale on a second click — the recommendedAnnualSpend
    // marker tells the helper "you're already at the target spend level."
    const sumOnce = once.expenseStreams.reduce((s, e) => s + e.annualAmount, 0);
    const sumTwice = twice.expenseStreams.reduce((s, e) => s + e.annualAmount, 0);
    expect(sumTwice).toBeCloseTo(sumOnce, 0);
  }, 120_000);

  it('applyResultToPlan is idempotent for min-retirement-age (no double-drop)', () => {
    const plan = defaultPlan();
    const result = optimizeStrategy(plan, 'min-retirement-age', { useNelderMead: false });

    const once = applyResultToPlan(plan, result);
    const twice = applyResultToPlan(once, result);

    // Retirement age should not keep dropping on a second click.
    expect(twice.personA.retirementAge).toBe(once.personA.retirementAge);
    if (plan.personB) {
      expect(twice.personB?.retirementAge).toBe(once.personB?.retirementAge);
    }
  }, 180_000);

  it('applyResultToPlan records optimizedForGoal so the Dashboard goal breadcrumb can highlight it', () => {
    const plan = defaultPlan();
    const result = optimizeStrategy(plan, 'max-end-balance', { useNelderMead: false });
    const applied = applyResultToPlan(plan, result);
    expect(applied.optimizedForGoal).toBe('max-end-balance');
  }, 120_000);
});
