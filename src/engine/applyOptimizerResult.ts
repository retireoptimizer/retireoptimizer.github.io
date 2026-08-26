import type { Plan } from '../schemas/plan';
import type { OptimizeResult } from './optimizer';
import { shiftRetirementAge } from './retirementAgeShift';

/** Pure function that returns the plan as it would be after the optimizer runs.
 *  The caller is responsible for deciding whether to commit this to the plan store
 *  (via "Apply to Plan") or keep it ephemeral in useOptimizerStore.pendingPlan.
 *
 *  Contract: `runProjection(applyResultToPlan(plan, result))` must match
 *  `result.projection` to the dollar. The test in
 *  [src/engine/__tests__/optimizerApplyRoundtrip.test.ts] enforces this. */
export function applyResultToPlan(plan: Plan, result: OptimizeResult): Plan {
  const roundedPolicy = {
    ...result.policy,
    windows: result.policy.windows.map((w) => ({
      ...w,
      convAmt: w.convAmt != null ? Math.round(w.convAmt) : undefined,
    })),
  };
  let next: Plan = {
    ...plan,
    customPolicy: roundedPolicy,
    optimizedForGoal: result.goal,
    solvedSpendingMultiplier: result.goal !== 'max-sustainable-spending' ? undefined : plan.solvedSpendingMultiplier,
  };

  // max-sustainable-spending: scale all expense streams proportionally to the optimizer's
  // recommended annual spend. The caller always passes the clean plan store plan (never a
  // previously-scaled pending plan), so plan.expenseStreams is always the user's original values.
  const rec = result.recommendedAnnualSpend;
  if (result.goal === 'max-sustainable-spending' && typeof rec === 'number' && rec > 0) {
    const baseSum = plan.expenseStreams.reduce((s, e) => s + e.annualAmount, 0);
    next = {
      ...next,
      solvedSpendingMultiplier: baseSum > 0 ? rec / baseSum : undefined,
      expenseStreams: baseSum > 0
        ? plan.expenseStreams.map((e) => ({ ...e, annualAmount: e.annualAmount * rec / baseSum }))
        : [{
            id: '__spending__',
            description: 'Living expenses',
            whose: 'Household' as const,
            startAge: plan.personA.retirementAge,
            end: { mode: 'lastSurvivor' as const },
            survivorPct: 1,
            annualAmount: rec,
            inflationPct: { mode: 'cpi' as const },
          }],
    };
  }

  // min-retirement-age: shift retirement ages and expense startAges tied to the old retire age.
  if (
    result.goal === 'min-retirement-age' &&
    typeof result.solvedRetirementAge === 'number' &&
    result.solvedRetirementAge !== plan.personA.retirementAge
  ) {
    next = shiftRetirementAge(next, result.solvedRetirementAge);
  }

  return next;
}
