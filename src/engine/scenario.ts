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
  const effectivePlan = mergeOverrides(base, scenario.overrides);
  // A customPolicy is calibrated to a specific retirement age (its windows reference absolute ages
  // starting at `base.personA.retirementAge`). If the scenario shifts retirement age, those windows
  // become meaningless — leave first/last years uncovered or include conversions that no longer fit.
  // Drop customPolicy in that case so the engine falls back to the preset withdrawalStrategy.
  const retireChanged = scenario.overrides.personA?.retirementAge !== undefined
    && scenario.overrides.personA.retirementAge !== base.personA.retirementAge;
  if (retireChanged) effectivePlan.customPolicy = undefined;
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
    { id: 'lower-return', name: 'Lower Returns (4% post-ret)', overrides: { assumptions: { postRetReturn: 0.04 } }, createdAt: new Date().toISOString() },
    { id: 'higher-inflation', name: 'Higher Inflation (4%)', overrides: { assumptions: { inflation: 0.04 } }, createdAt: new Date().toISOString() },
  ];
}
