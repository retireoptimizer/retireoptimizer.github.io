import type { Plan } from '../schemas/plan';
import { runProjection, depletionAge, type ProjectionResult } from './projection';
import { householdPlanToAgeA } from './planInputKey';

const PRESETS: Array<Plan['withdrawalStrategy']> = [
  'taxfirst',
  'rothfirst',
  'tradfirst',
  'proportional',
  'bracketfill',
];

export interface PresetMetrics {
  endBalance: number;       // real (today's $) end-of-plan total
  lifetimeFedTax: number;   // nominal lifetime federal tax
  longevityAge: number;     // depletion age, or planToAge if never depleted
  lasts: boolean;           // true if plan never depletes
}

export type PresetPreviewResult = Record<Plan['withdrawalStrategy'], PresetMetrics>;

/** Runs the 5 preset strategies through the projection engine and returns
 *  comparable metrics for each. Used to show "End balance / Lifetime tax / Lasts to"
 *  estimates on each preset card so users can scan and compare without committing.
 *
 *  Important: each preview clears `customPolicy` so the preset truly drives the
 *  projection — otherwise an existing optimized policy would dominate every preset's
 *  output and the previews would all be identical. */
export function previewAllPresets(plan: Plan): PresetPreviewResult {
  const out = {} as PresetPreviewResult;
  for (const preset of PRESETS) {
    const presetPlan: Plan = { ...plan, withdrawalStrategy: preset, customPolicy: undefined };
    const proj: ProjectionResult = runProjection(presetPlan);
    const dep = depletionAge(proj);
    out[preset] = {
      endBalance: proj.endTotalReal,
      lifetimeFedTax: proj.lifetimeFedTax,
      longevityAge: dep ?? householdPlanToAgeA(plan),
      lasts: dep === null,
    };
  }
  return out;
}
