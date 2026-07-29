import { create } from 'zustand';
import type { Plan } from '../schemas/plan';

/** Ephemeral overrides to overlay on the saved plan for "what-if" exploration.
 *  These do NOT persist and never mutate the underlying plan — they exist only
 *  in memory and reset on page reload. The Plan returned by `applyOverrides`
 *  is a shallow-copied projection input. */
export interface WhatIfOverrides {
  retirementAgeA?: number;     // overrides plan.personA.retirementAge
  retirementAgeB?: number;     // overrides plan.personB.retirementAge (ignored if no person B)
  returnRate?: number;         // overrides all three bucket returns uniformly
  inflation?: number;          // overrides plan.assumptions.inflation
  spendingMultiplier?: number; // multiplies every expense stream's annualAmount
}

interface WhatIfState {
  active: boolean;             // when false, overrides are ignored
  overrides: WhatIfOverrides;
  setActive: (v: boolean) => void;
  setOverride: <K extends keyof WhatIfOverrides>(key: K, value: WhatIfOverrides[K]) => void;
  reset: () => void;
}

export const useWhatIfStore = create<WhatIfState>()((set) => ({
  active: false,
  overrides: {},
  setActive: (active) => set({ active }),
  setOverride: (key, value) => set((s) => ({
    overrides: { ...s.overrides, [key]: value },
    // First override flip activates the bar implicitly.
    active: s.active || value !== undefined,
  })),
  reset: () => set({ active: false, overrides: {} }),
}));

/** Apply the active what-if overrides to a plan and return a derived plan suitable
 *  for `runProjection`. Returns the input plan unchanged when no overrides are active. */
export function applyWhatIf(plan: Plan, w: WhatIfState): Plan {
  if (!w.active) return plan;
  const o = w.overrides;
  // When baseExpenseStreams exists (max-spending was applied), treat spendingMultiplier=1 as
  // meaningful (user explicitly wants original-level expenses instead of scaled ones).
  const hasSpending = o.spendingMultiplier !== undefined &&
    (o.spendingMultiplier !== 1 || plan.baseExpenseStreams !== undefined);
  const hasAny = o.retirementAgeA !== undefined || o.retirementAgeB !== undefined || o.returnRate !== undefined || o.inflation !== undefined || hasSpending;
  if (!hasAny) return plan;

  let next: Plan = plan;
  if (o.retirementAgeA !== undefined) {
    const oldAge = plan.personA.retirementAge;
    const newAge = o.retirementAgeA;
    if (next.personB) {
      const birthYearA = parseInt(next.personA.dob.slice(0, 4));
      const birthYearB = parseInt(next.personB.dob.slice(0, 4));
      const ageDiff = birthYearB - birthYearA;
      const ageA_when_B_retires = next.personB.retirementAge + ageDiff;
      const oldFirstRetireA = Math.min(oldAge, ageA_when_B_retires);
      const newFirstRetireA = Math.min(newAge, ageA_when_B_retires);
      next = {
        ...next,
        personA: { ...next.personA, retirementAge: newAge },
        expenseStreams: next.expenseStreams.map((s) => {
          if (s.whose === 'A' && s.startAge === oldAge) return { ...s, startAge: newAge };
          if (s.whose === 'Household' && s.startAge === oldFirstRetireA) return { ...s, startAge: newFirstRetireA };
          return s;
        }),
      };
    } else {
      next = {
        ...next,
        personA: { ...next.personA, retirementAge: newAge },
        expenseStreams: next.expenseStreams.map((s) =>
          s.startAge === oldAge ? { ...s, startAge: newAge } : s
        ),
      };
    }
  }
  if (o.retirementAgeB !== undefined && next.personB) {
    const oldAge = plan.personB!.retirementAge;
    const newAge = o.retirementAgeB;
    const birthYearA = parseInt(next.personA.dob.slice(0, 4));
    const birthYearB = parseInt(next.personB.dob.slice(0, 4));
    const ageDiff = birthYearB - birthYearA;
    const ageA_when_oldB_retires = oldAge + ageDiff;
    const ageA_when_newB_retires = newAge + ageDiff;
    const ageA_retires = next.personA.retirementAge;
    const oldFirstRetireA = Math.min(ageA_retires, ageA_when_oldB_retires);
    const newFirstRetireA = Math.min(ageA_retires, ageA_when_newB_retires);
    next = {
      ...next,
      personB: { ...next.personB, retirementAge: newAge },
      expenseStreams: next.expenseStreams.map((s) => {
        if (s.whose === 'B' && s.startAge === oldAge) return { ...s, startAge: newAge };
        if (s.whose === 'Household' && s.startAge === oldFirstRetireA) return { ...s, startAge: newFirstRetireA };
        return s;
      }),
    };
  }
  if (o.returnRate !== undefined || o.inflation !== undefined) {
    next = {
      ...next,
      assumptions: {
        ...next.assumptions,
        taxableReturn: o.returnRate ?? next.assumptions.taxableReturn,
        tradReturn: o.returnRate ?? next.assumptions.tradReturn,
        rothReturn: o.returnRate ?? next.assumptions.rothReturn,
        inflation: o.inflation ?? next.assumptions.inflation,
      },
    };
  }
  if (hasSpending) {
    // Apply against original expenses (baseExpenseStreams when available) so the slider
    // is an absolute multiplier vs the user's configured spending — not double-stacked
    // on top of a prior max-sustainable-spending scaling.
    const baseExpenses = plan.baseExpenseStreams ?? next.expenseStreams;
    next = {
      ...next,
      expenseStreams: baseExpenses.map((s) => ({
        ...s,
        annualAmount: s.annualAmount * (o.spendingMultiplier ?? 1),
      })),
    };
  }
  return next;
}
