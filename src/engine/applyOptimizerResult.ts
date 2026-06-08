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
  let next: Plan = { ...plan, customPolicy: result.policy, optimizedForGoal: result.goal };

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
    if (!alreadyApplied) {
      next = {
        ...next,
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
    next = { ...next, personA: { ...next.personA, retirementAge: targetA } };
    if (next.personB) {
      const targetB = Math.max(50, next.personB.retirementAge + deltaA);
      next = { ...next, personB: { ...next.personB, retirementAge: targetB } };
    }
  }

  return next;
}
