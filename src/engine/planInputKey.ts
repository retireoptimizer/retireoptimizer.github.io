import type { Plan } from '../schemas/plan';

/**
 * Returns the latest plan-to age across both persons, expressed in terms of Person A's age.
 * Ensures the projection and optimizer windows cover whichever person lives longer.
 */
export function householdPlanToAgeA(plan: Plan): number {
  const ptA = plan.personA.planToAge;
  if (!plan.personB) return ptA;
  const birthYearA = parseInt(plan.personA.dob.slice(0, 4), 10);
  const birthYearB = parseInt(plan.personB.dob.slice(0, 4), 10);
  // When B reaches planToAgeB, A's equivalent age = B.planToAge + (birthYearB - birthYearA)
  const bEndInATerms = plan.personB.planToAge + (birthYearB - birthYearA);
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
  });
}
