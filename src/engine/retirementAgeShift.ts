import type { Plan } from '../schemas/plan';

/**
 * Returns a new plan with personA's retirement age set to `newAgeA`, personB's
 * shifted by the same delta, and expense streams whose startAge was pinned to
 * the old first-retire age moved to the new first-retire age.
 *
 * This is the canonical implementation — used by the optimizer trial loop,
 * applyResultToPlan, and the what-if slider so all three see the same world.
 */
export function shiftRetirementAge(plan: Plan, newAgeA: number): Plan {
  const oldAgeA = plan.personA.retirementAge;
  const deltaA = newAgeA - oldAgeA;

  if (plan.personB) {
    const birthYearA = parseInt(plan.personA.dob.slice(0, 4));
    const birthYearB = parseInt(plan.personB.dob.slice(0, 4));
    const ageDiff = birthYearB - birthYearA;
    const newAgeB = Math.max(40, plan.personB.retirementAge + deltaA);
    const ageA_when_oldB_retires = plan.personB.retirementAge + ageDiff;
    const ageA_when_newB_retires = newAgeB + ageDiff;
    const oldFirstRetireA = Math.min(oldAgeA, ageA_when_oldB_retires);
    const newFirstRetireA = Math.min(newAgeA, ageA_when_newB_retires);
    return {
      ...plan,
      personA: { ...plan.personA, retirementAge: newAgeA },
      personB: { ...plan.personB, retirementAge: newAgeB },
      expenseStreams: plan.expenseStreams.map((s) => {
        if (s.whose === 'A' && s.startAge === oldAgeA) return { ...s, startAge: newAgeA };
        if (s.whose === 'B' && s.startAge === plan.personB!.retirementAge) return { ...s, startAge: newAgeB };
        if (s.whose === 'Household' && s.startAge === oldFirstRetireA) return { ...s, startAge: newFirstRetireA };
        return s;
      }),
    };
  }

  return {
    ...plan,
    personA: { ...plan.personA, retirementAge: newAgeA },
    expenseStreams: plan.expenseStreams.map((s) =>
      s.startAge === oldAgeA ? { ...s, startAge: newAgeA } : s
    ),
  };
}
