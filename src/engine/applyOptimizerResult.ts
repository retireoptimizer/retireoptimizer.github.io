import type { Plan } from '../schemas/plan';
import type { OptimizeResult } from './optimizer';

/** Pure function that returns the plan as it would be after the user clicks
 *  "Apply" on the optimizer result panel. Mirrors what the React handler in
 *  [src/pages/Strategy.tsx] does, but with no store dependency so the
 *  round-trip can be unit-tested.
 *
 *  Contract: `runProjection(applyResultToPlan(plan, result))` must match
 *  `result.projection` to the dollar. The test in
 *  [src/engine/__tests__/optimizerApplyRoundtrip.test.ts] enforces this.
 *  Any goal that mutates more than `customPolicy` (e.g., scales expenses or
 *  drops retirement age) must mirror that mutation here. */
export function applyResultToPlan(plan: Plan, result: OptimizeResult): Plan {
  const roundedPolicy = {
    ...result.policy,
    windows: result.policy.windows.map((w) => ({
      ...w,
      convAmt: w.convAmt != null ? Math.round(w.convAmt) : undefined,
    })),
  };
  let next: Plan = { ...plan, customPolicy: roundedPolicy, optimizedForGoal: result.goal };

  // Clear snapshots that belong to a different goal — prevents stale metadata
  // from lingering in WhatIfBar or being used by the Dashboard re-optimizer after
  // the user switches goals.
  if (result.goal !== 'max-sustainable-spending') {
    next = { ...next, solvedSpendingMultiplier: undefined, baseExpenseStreams: undefined };
  }
  if (result.goal !== 'min-retirement-age') {
    next = { ...next, basePersonA: undefined, basePersonB: undefined };
  }

  // max-sustainable-spending: the optimizer evaluated against scaleExpenses(plan, m).
  // Reproduce by scaling each expense stream's annualAmount. Idempotent against the
  // recommendedAnnualSpend marker so the helper is safe to call twice.
  const m = result.solvedSpendingMultiplier;
  const rec = result.recommendedAnnualSpend;
  if (
    result.goal === 'max-sustainable-spending' &&
    typeof m === 'number' &&
    Math.abs(m - 1) > 1e-6
  ) {
    const currentSum = plan.expenseStreams.reduce((s, e) => s + e.annualAmount, 0);
    const alreadyApplied = typeof rec === 'number' && Math.abs(currentSum - rec) < 1;
    // Always update the solved multiplier so WhatIfBar reflects the latest run.
    next = { ...next, solvedSpendingMultiplier: m };
    if (!alreadyApplied) {
      next = {
        ...next,
        // Snapshot original amounts the first time spending is scaled, so the
        // Dashboard re-optimizer can restore them for non-spending goals.
        baseExpenseStreams: plan.baseExpenseStreams ?? plan.expenseStreams,
        expenseStreams: plan.expenseStreams.map((e) => ({ ...e, annualAmount: e.annualAmount * m })),
      };
    }
  }

  // min-retirement-age: the optimizer evaluated against setRetirementAge(plan, age),
  // which drops personA's retirementAge and shifts personB's by the same delta.
  if (
    result.goal === 'min-retirement-age' &&
    typeof result.solvedRetirementAge === 'number' &&
    result.solvedRetirementAge !== plan.personA.retirementAge
  ) {
    const targetA = result.solvedRetirementAge;
    const deltaA = targetA - plan.personA.retirementAge;
    next = {
      ...next,
      basePersonA: plan.basePersonA ?? plan.personA,
      basePersonB: plan.basePersonB ?? plan.personB,
      personA: { ...next.personA, retirementAge: targetA },
    };
    if (next.personB) {
      const targetB = Math.max(50, next.personB.retirementAge + deltaA);
      next = { ...next, personB: { ...next.personB, retirementAge: targetB } };
    }
  }

  return next;
}
