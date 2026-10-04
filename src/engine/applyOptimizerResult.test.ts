import { describe, it, expect } from 'vitest';
import { optimizeCached } from './__testutil__/optimizeCached';
import { runProjection } from './projection';
import { applyResultToPlan } from './applyOptimizerResult';
import { samplePlan as defaultPlan } from '../schemas/plan';
import { planF_allTradCouple, planG_californiaCouple } from './__golden/plans';
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
// Calls go through optimizeCached: the idempotence and optimizedForGoal tests reuse the
// defaultPlan results from the round-trip loop instead of re-running the optimizer.
describe('Optimizer Apply round-trip — panel ≡ saved-plan projection', () => {
  const GOALS: UserGoal[] = ['max-end-balance', 'max-sustainable-spending', 'min-retirement-age'];

  for (const goal of GOALS) {
    it(`${goal} on defaultPlan: applied plan re-projects to result.projection`, () => {
      const plan = defaultPlan();
      const result = optimizeCached(plan, goal, { useNelderMead: false });
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
      const result = optimizeCached(plan, goal, { useNelderMead: false });
      const appliedPlan = applyResultToPlan(plan, result);
      const reproj = runProjection(appliedPlan);

      expect(reproj.endTotalReal).toBeCloseTo(result.projection.endTotalReal, 0);
      expect(reproj.lifetimeFedTax).toBeCloseTo(result.projection.lifetimeFedTax, 0);
      expect(reproj.ranOut).toBe(result.projection.ranOut);
    }, 180_000);
  }

  it('applyResultToPlan is idempotent for max-sustainable-spending (no double-scaling)', () => {
    const plan = defaultPlan();
    const result = optimizeCached(plan, 'max-sustainable-spending', { useNelderMead: false });

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
    const result = optimizeCached(plan, 'min-retirement-age', { useNelderMead: false });

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
    const result = optimizeCached(plan, 'max-end-balance', { useNelderMead: false });
    const applied = applyResultToPlan(plan, result);
    expect(applied.optimizedForGoal).toBe('max-end-balance');
  }, 120_000);

  it('planG (bracket-fill, optimize:false): applied plan re-projects to result.projection and no conversions are resurrected when adoption fires', () => {
    // Landmine regression: planG has conversion.mode='bracket-fill' and optimize:false. When the
    // adoption guard ships the no-conversion baseline, the applied plan's policy windows carry
    // convAmt:undefined. Without the conversion.mode override in applyResultToPlan, the projection
    // falls through to plan.conversion (bracket-fill) and resurrects ~$1.2M of conversions.
    const plan = planG_californiaCouple();
    const result = optimizeCached(plan, 'max-end-balance', { useNelderMead: false });
    const appliedPlan = applyResultToPlan(plan, result);
    const reproj = runProjection(appliedPlan);

    // Round-trip contract: applied plan must re-project identically to the optimizer's result.
    expect(reproj.endTotalReal).toBeCloseTo(result.projection.endTotalReal, 0);
    expect(reproj.lifetimeFedTax).toBeCloseTo(result.projection.lifetimeFedTax, 0);
    expect(reproj.ranOut).toBe(result.projection.ranOut);

    // If the adoption guard fired, conversions must stay off — no resurrection.
    if (result.conversionsDisabled) {
      expect(appliedPlan.conversion.mode).toBe('off');
      expect(reproj.lifetimeConversion).toBeLessThan(1000);
    }
  }, 180_000);
});

describe('optimizeStrategy (smoke) — samplePlan spending and retirement-age goals', () => {
  // Moved from optimizer.smoke.test.ts so they share the cached samplePlan runs above.
  it('max-sustainable-spending returns a multiplier and a strategy that does not deplete', () => {
    const plan = defaultPlan();
    const r = optimizeCached(plan, 'max-sustainable-spending', { useNelderMead: false });
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
    const r = optimizeCached(plan, 'max-sustainable-spending', { useNelderMead: false });
    expect(r.recommendedAnnualSpend).toBeDefined();
    const baseSum = plan.expenseStreams.reduce((s, e) => s + e.annualAmount, 0);
    expect(r.recommendedAnnualSpend!).toBeCloseTo(baseSum * r.solvedSpendingMultiplier!, 0);
  }, 120_000);

  it('min-retirement-age returns an age <= the current retirement age', () => {
    const plan = defaultPlan();
    const r = optimizeCached(plan, 'min-retirement-age', { useNelderMead: false });
    expect(r.solvedRetirementAge).toBeDefined();
    expect(r.solvedRetirementAge!).toBeLessThanOrEqual(plan.personA.retirementAge);
  }, 120_000);
});
