import type { Plan } from '../schemas/plan';
import { runProjection, type ProjectionResult } from './projection';

export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export interface Scenario {
  id: string;
  name: string;
  notes?: string;
  overrides: DeepPartial<Plan>;
  createdAt: string;
}

export interface ScenarioResult {
  id: string;
  name: string;
  effectivePlan: Plan;
  projection: ProjectionResult;
}

/** Deep-merge an overrides object onto a Plan. Arrays are replaced, not merged. */
export function mergeOverrides<T>(base: T, overrides: DeepPartial<T>): T {
  if (overrides === undefined || overrides === null) return base;
  if (Array.isArray(base) || Array.isArray(overrides)) return overrides as T;
  if (typeof base !== 'object' || typeof overrides !== 'object') return overrides as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(overrides as Record<string, unknown>)) {
    const o = (overrides as Record<string, unknown>)[key];
    const b = (base as Record<string, unknown>)[key];
    out[key] = typeof o === 'object' && o !== null && !Array.isArray(o)
      ? mergeOverrides<Record<string, unknown>>((b ?? {}) as Record<string, unknown>, o as DeepPartial<Record<string, unknown>>)
      : o;
  }
  return out as T;
}

export function evaluateScenario(base: Plan, scenario: Scenario): ScenarioResult {
  let effectivePlan = mergeOverrides(base, scenario.overrides);

  const retireAChanged = scenario.overrides.personA?.retirementAge !== undefined
    && scenario.overrides.personA.retirementAge !== base.personA.retirementAge;
  const retireBChanged = base.personB !== undefined
    && scenario.overrides.personB?.retirementAge !== undefined
    && scenario.overrides.personB.retirementAge !== base.personB!.retirementAge;

  // Shift expense startAge anchored at the old retirement boundary so expenses start at the
  // correct new age — mirrors the same logic in applyWhatIf.
  if (retireAChanged || retireBChanged) {
    const birthYearA = parseInt(base.personA.dob.slice(0, 4));
    const ageDiff = base.personB ? parseInt(base.personB.dob.slice(0, 4)) - birthYearA : 0;
    const oldRetireA = base.personA.retirementAge;
    const newRetireA = effectivePlan.personA.retirementAge;
    const oldRetireB = base.personB?.retirementAge ?? oldRetireA;
    const newRetireB = effectivePlan.personB?.retirementAge ?? newRetireA;
    const oldFirstRetireA = Math.min(oldRetireA, oldRetireB + ageDiff);
    const newFirstRetireA = Math.min(newRetireA, newRetireB + ageDiff);
    effectivePlan = {
      ...effectivePlan,
      expenseStreams: effectivePlan.expenseStreams.map((s) => {
        if (s.whose === 'A' && s.startAge === oldRetireA) return { ...s, startAge: newRetireA };
        if (s.whose === 'B' && s.startAge === oldRetireB) return { ...s, startAge: newRetireB };
        if (s.whose === 'Household' && s.startAge === oldFirstRetireA) return { ...s, startAge: newFirstRetireA };
        return s;
      }),
    };
  }

  // Shift custom-policy windows by the same delta so the comparison stays apples-to-apples:
  // only retirement age changes, not retirement age + strategy window positions.
  if (retireAChanged && effectivePlan.customPolicy) {
    const delta = effectivePlan.personA.retirementAge - base.personA.retirementAge;
    effectivePlan = {
      ...effectivePlan,
      customPolicy: {
        ...effectivePlan.customPolicy,
        windows: effectivePlan.customPolicy.windows
          .map((w) => ({ ...w, fromAge: w.fromAge + delta, toAge: w.toAge + delta }))
          .filter((w) => w.fromAge <= w.toAge && w.toAge >= effectivePlan.personA.retirementAge),
      },
    };
  }

  // When the inflation assumption changes, update any CPI-indexed streams (those whose rate was
  // set to match the baseline inflation) so spending and income track the new rate.
  const inflationChanged = scenario.overrides.assumptions?.inflation !== undefined
    && scenario.overrides.assumptions.inflation !== base.assumptions.inflation;
  if (inflationChanged) {
    const oldRate = base.assumptions.inflation;
    const newRate = effectivePlan.assumptions.inflation;
    effectivePlan = {
      ...effectivePlan,
      expenseStreams: effectivePlan.expenseStreams.map((s) =>
        Math.abs(s.inflationPct - oldRate) < 1e-9 ? { ...s, inflationPct: newRate } : s
      ),
      incomeStreams: effectivePlan.incomeStreams.map((s) =>
        Math.abs(s.growthPct - oldRate) < 1e-9 ? { ...s, growthPct: newRate } : s
      ),
    };
  }

  const projection = runProjection(effectivePlan);
  return { id: scenario.id, name: scenario.name, effectivePlan, projection };
}

export function evaluateAll(base: Plan, scenarios: Scenario[]): ScenarioResult[] {
  return scenarios.map((s) => evaluateScenario(base, s));
}

/** Generate a quick "what-if" suite. Retirement-age scenarios are computed relative to the
 *  provided base plan so labels match reality regardless of the user's current retirement age. */
export function defaultScenarios(base?: Plan): Scenario[] {
  const baselineRetire = base?.personA.retirementAge ?? 65;
  return [
    { id: 'retire-earlier', name: 'Retire 3 Years Earlier', overrides: { personA: { retirementAge: Math.max(50, baselineRetire - 3) } }, createdAt: new Date().toISOString() },
    { id: 'retire-later', name: 'Retire 3 Years Later', overrides: { personA: { retirementAge: Math.min(80, baselineRetire + 3) } }, createdAt: new Date().toISOString() },
    { id: 'lower-return', name: 'Lower Returns (4%)', overrides: { assumptions: { taxableReturn: 0.04, tradReturn: 0.04, rothReturn: 0.04 } }, createdAt: new Date().toISOString() },
    { id: 'higher-inflation', name: 'Higher Inflation (4%)', overrides: { assumptions: { inflation: 0.04 } }, createdAt: new Date().toISOString() },
  ];
}
