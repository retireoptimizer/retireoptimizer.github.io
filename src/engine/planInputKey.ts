import type { Plan } from '../schemas/plan';

/** Stable fingerprint of the plan fields that affect optimizer output.
 *  Excludes optimizer-output fields (customPolicy, optimizedForGoal, base* snapshots)
 *  so they don't create false positives. */
export function planInputKey(plan: Plan): string {
  return JSON.stringify({
    personA: plan.personA,
    personB: plan.personB,
    assumptions: plan.assumptions,
    portfolio: plan.portfolio,
    incomeStreams: plan.incomeStreams,
    lumpSumEvents: plan.lumpSumEvents,
    expenseStreams: plan.baseExpenseStreams ?? plan.expenseStreams,
    withdrawalStrategy: plan.withdrawalStrategy,
    withdrawalBracketCeiling: plan.withdrawalBracketCeiling,
    conversion: plan.conversion,
    state: plan.state,
  });
}
