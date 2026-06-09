import { create } from 'zustand';
import type { Plan } from '../schemas/plan';

/** Ephemeral overrides to overlay on the saved plan for "what-if" exploration.
 *  These do NOT persist and never mutate the underlying plan — they exist only
 *  in memory and reset on page reload. The Plan returned by `applyOverrides`
 *  is a shallow-copied projection input. */
export interface WhatIfOverrides {
  retirementAgeA?: number;     // overrides plan.personA.retirementAge
  retirementAgeB?: number;     // overrides plan.personB.retirementAge (ignored if no person B)
  preRetReturn?: number;       // overrides plan.assumptions.preRetReturn
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
  const hasAny = o.retirementAgeA !== undefined || o.retirementAgeB !== undefined || o.preRetReturn !== undefined || o.inflation !== undefined || (o.spendingMultiplier !== undefined && o.spendingMultiplier !== 1);
  if (!hasAny) return plan;

  let next: Plan = plan;
  if (o.retirementAgeA !== undefined) {
    next = { ...next, personA: { ...next.personA, retirementAge: o.retirementAgeA } };
  }
  if (o.retirementAgeB !== undefined && next.personB) {
    next = { ...next, personB: { ...next.personB, retirementAge: o.retirementAgeB } };
  }
  if (o.preRetReturn !== undefined || o.inflation !== undefined) {
    next = {
      ...next,
      assumptions: {
        ...next.assumptions,
        preRetReturn: o.preRetReturn ?? next.assumptions.preRetReturn,
        inflation: o.inflation ?? next.assumptions.inflation,
      },
    };
  }
  if (o.spendingMultiplier !== undefined && o.spendingMultiplier !== 1) {
    next = {
      ...next,
      expenseStreams: next.expenseStreams.map((s) => ({
        ...s,
        annualAmount: s.annualAmount * o.spendingMultiplier!,
      })),
    };
  }
  return next;
}
