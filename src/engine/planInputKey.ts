import type { Plan } from '../schemas/plan';

/**
 * Returns the projection horizon expressed in Person A's age frame:
 * max(A.planThroughAge, B.planThroughAge-in-A-frame).
 * Drop-in replacement for the old `householdPlanToAgeA`.
 */
export function householdPlanThroughAgeA(plan: Plan): number {
  const ptA = plan.personA.planThroughAge;
  if (!plan.personB) return ptA;
  const birthYearA = parseInt(plan.personA.dob.slice(0, 4), 10);
  const birthYearB = parseInt(plan.personB.dob.slice(0, 4), 10);
  // When B reaches planThroughAgeB, A's equivalent age = B.planThroughAge + (birthYearB - birthYearA)
  const bEndInATerms = plan.personB.planThroughAge + (birthYearB - birthYearA);
  return Math.max(ptA, bEndInATerms);
}

/** Stable fingerprint of the plan fields that affect optimizer output.
 *  Excludes optimizer-output fields (customPolicy, optimizedForGoal, solvedSpendingMultiplier)
 *  so they don't create false positives. */
export function planInputKey(plan: Plan): string {
  return JSON.stringify({
    personA: plan.personA,
    personB: plan.personB,
    assumptions: plan.assumptions,
    portfolio: plan.portfolio,
    incomeStreams: plan.incomeStreams,
    lumpSumEvents: plan.lumpSumEvents,
    expenseStreams: plan.expenseStreams,
    withdrawalStrategy: plan.withdrawalStrategy,
    withdrawalBracketCeiling: plan.withdrawalBracketCeiling,
    conversion: plan.conversion,
    payTaxFromBrokerage: plan.payTaxFromBrokerage,
    state: plan.state,
    customStateTaxRate: plan.customStateTaxRate,
    goals: plan.goals,
  });
}
