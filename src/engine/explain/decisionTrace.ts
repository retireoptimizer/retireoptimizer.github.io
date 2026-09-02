import type { Plan } from '../../schemas/plan';
import type { ConversionParams } from '../../schemas/plan';
import { buildSettingsImpact } from './settingsImpact';
import type { BlendPolicy, BlendWindow } from '../blendPolicy';
import type { OptimizeResult } from '../optimizer';
import type { UserGoal } from '../recommender';
import { runProjection, depletionAge as calcDepletionAge } from '../projection';
import { compareWithWithoutConversion, hasComparableConversionBaseline } from '../comparison';
import { REC_GOALS } from '../recommender';
import { FED_BRACKETS_MFJ } from '../taxConstants';

export type CfKind = 'conversion' | 'ordering' | 'taxSourcing' | 'assumption';
export type CfAdaptation = 're-adapted' | 'policy-held' | 'rescored';

export interface Counterfactual {
  id: string;
  label: string;
  kind: CfKind;
  adaptation: CfAdaptation;
  applicable: boolean;
  note?: string;
  score: number;
  delta: number;
  endTotalReal: number;
  lifetimeFedTaxReal: number;
  lifetimeConversionReal: number;
  depletionAge: number | null;
  ranOut: boolean;
  reoptimizable?: boolean;
  planPatch?: Partial<Plan>;
}

export interface OrdRateSensitivity {
  activeRate: number;
  breakevenRate: number | null;
  robustAcrossBand: boolean;
  atMinus5pp: number;
  atActive: number;
  atPlus5pp: number;
}

export interface SettingImpact {
  id: string;
  label: string;
  value: string;
  effect: string;
  cfIds: string[];
  bestAlternative?: string;
  inert?: boolean;
  inertReason?: string;
}

export interface DecisionTrace {
  goal: UserGoal;
  scoreLabel: string;
  chosenScore: number;
  counterfactuals: Counterfactual[];
  runnerUpId: string | null;
  ordRate: OrdRateSensitivity | null;
  settings: SettingImpact[];
  degraded: string[];
}

const PRESET_LABELS: Record<string, string> = {
  taxfirst:     'Taxable → Traditional → Roth',
  rothfirst:    'Roth → Traditional → Taxable',
  tradfirst:    'Traditional → Taxable → Roth',
  proportional: 'Proportional (all buckets)',
  bracketfill:  'Bracket-fill withdrawal',
};

const PRESETS = ['taxfirst', 'rothfirst', 'tradfirst', 'proportional', 'bracketfill'] as const;

// MFJ bracket tops for the three ceiling counterfactuals (today's $, engine inflates at use time)
const CEIL_12 = FED_BRACKETS_MFJ[1][0];  // $100,800
const CEIL_22 = FED_BRACKETS_MFJ[2][0];  // $211,400
const CEIL_24 = FED_BRACKETS_MFJ[3][0];  // $403,550

/** Copy a policy's windows with convAmt absent so bracket-fill mode regains control.
 *  Never write convAmt: 0 here — it pins conversions to zero and makes all three
 *  ceiling counterfactuals identical (projection.ts:483 checks policyConv != null). */
function stripConv(policy: BlendPolicy): BlendPolicy {
  return {
    ...policy,
    windows: policy.windows.map(({ convAmt: _omit, ...rest }): BlendWindow => {
      void _omit;
      return rest;
    }),
  };
}

/** Pin the winning conversion schedule as a manual schedule so ordering counterfactuals
 *  isolate withdrawal ordering only. Uses perYearPolicy (not compact policy) for exact
 *  per-age values. Guards on retirementAge: the manual branch in conversion.ts fires
 *  before the !retired check (line 24), so accumulation-year ages must be excluded. */
function pinManual(perYearPolicy: BlendPolicy, plan: Plan): ConversionParams {
  const schedule: Record<string, number> = {};
  const retireAge = plan.personA.retirementAge;
  for (const w of perYearPolicy.windows) {
    for (let age = w.fromAge; age <= w.toAge; age++) {
      if (age >= retireAge) {
        schedule[String(age)] = w.convAmt ?? 0;
      }
    }
  }
  return {
    ...plan.conversion,
    mode: 'manual' as const,
    optimize: false,
    manualSchedule: schedule,
  };
}

type CfMetrics = Pick<
  Counterfactual,
  'score' | 'delta' | 'endTotalReal' | 'lifetimeFedTaxReal' | 'lifetimeConversionReal' | 'depletionAge' | 'ranOut'
>;

function runCf(cfPlan: Plan, chosenScore: number): CfMetrics {
  const proj = runProjection(cfPlan);
  const score = REC_GOALS['max-end'].score(proj);
  return {
    score,
    delta: score - chosenScore,
    endTotalReal: proj.endTotalReal,
    lifetimeFedTaxReal: proj.lifetimeFedTaxReal,
    lifetimeConversionReal: proj.lifetimeConversionReal,
    depletionAge: calcDepletionAge(proj),
    ranOut: proj.ranOut,
  };
}

/** Compute analytic rate sensitivity — free because the objective is affine in taxAdjOrdRate.
 *  Requires the no-conv projection (from compareWithWithoutConversion) and the chosen projection.
 *  Returns null when the two plans' real trad balances are too similar to be meaningful (<$1 apart),
 *  or when the no-conv baseline is unavailable. */
function buildOrdRateSensitivity(
  chosenProj: ReturnType<typeof runProjection>,
  noConvProj: ReturnType<typeof runProjection>,
  activeRate: number,
  chosenScore: number,
  convOffScore: number,
): OrdRateSensitivity | null {
  const lastC = chosenProj.rows[chosenProj.rows.length - 1];
  const lastB = noConvProj.rows[noConvProj.rows.length - 1];
  if (!lastC || !lastB) return null;

  // Real end-traditional balances: score(o) = K − T·o, so T = endTrad / inflF
  const tC = lastC.endTraditional / lastC.inflationFactor;
  const tB = lastB.endTraditional / lastB.inflationFactor;
  const deltaTrad = tC - tB;  // typically negative (chosen has less trad, having converted some)

  // convAdvantage(o) = atActive + deltaTrad · (activeRate − o)
  const atActive = chosenScore - convOffScore;
  const atMinus = atActive + deltaTrad * 0.05;   // at activeRate − 0.05
  const atPlus  = atActive - deltaTrad * 0.05;   // at activeRate + 0.05

  let breakevenRate: number | null = null;
  if (Math.abs(deltaTrad) >= 1) {
    const raw = activeRate + atActive / deltaTrad;
    breakevenRate = Math.max(0, Math.min(0.6, raw));
  }

  return {
    activeRate,
    breakevenRate,
    robustAcrossBand: atMinus > 0 && atActive > 0 && atPlus > 0,
    atMinus5pp: atMinus,
    atActive,
    atPlus5pp: atPlus,
  };
}

/** Build the decision trace for the optimizer rationale modal.
 *  Pass `effectivePlan` (the What-If-aware plan), not the raw stored plan, so
 *  the trace and the Dashboard's Roth Conversion Benefit badge measure the same plan. */
export function buildDecisionTrace(plan: Plan, result: OptimizeResult): DecisionTrace {
  const chosenScore = REC_GOALS['max-end'].score(result.projection);
  const goal = result.goal;
  const degraded: string[] = [];

  if (goal !== 'max-end-balance') {
    degraded.push(
      "Ledger scores all rows on tax-adjusted end balance (today's $) — the optimizer's inner objective. " +
      'This plan was optimized for a different goal, so deltas are a proxy metric, not the goal\'s own currency.'
    );
  }

  const counterfactuals: Counterfactual[] = [];

  // ── conv-off: delegate to compareWithWithoutConversion for badge consistency ──
  // Never re-derive the baseline here — a fourth independent construction guarantees drift.
  // Capture cmp at top level so the no-conv projection feeds rate sensitivity too.
  let cmp: ReturnType<typeof compareWithWithoutConversion> | null = null;
  if (hasComparableConversionBaseline(plan)) {
    cmp = compareWithWithoutConversion(plan);
    const score = REC_GOALS['max-end'].score(cmp.noConv);
    counterfactuals.push({
      id: 'conv-off',
      label: 'No Roth conversions',
      kind: 'conversion',
      adaptation: plan.customPolicy?.source === 'optimizer' ? 're-adapted' : 'policy-held',
      applicable: true,
      score,
      delta: score - chosenScore,
      endTotalReal: cmp.noConv.endTotalReal,
      lifetimeFedTaxReal: cmp.noConv.lifetimeFedTaxReal,
      lifetimeConversionReal: 0,
      depletionAge: calcDepletionAge(cmp.noConv),
      ranOut: cmp.noConv.ranOut,
    });
  } else {
    counterfactuals.push({
      id: 'conv-off',
      label: 'No Roth conversions',
      kind: 'conversion',
      adaptation: 'policy-held',
      applicable: false,
      note: 'Optimizer-authored ordering without a stored no-conversion baseline — holding the ordering fixed would measure a different plan, not just conversions off.',
      score: 0, delta: 0,
      endTotalReal: 0, lifetimeFedTaxReal: 0, lifetimeConversionReal: 0,
      depletionAge: null, ranOut: false,
    });
  }

  // ── 5 preset ordering counterfactuals (conversions pinned to winning schedule) ──
  // Pinning keeps conversion amounts identical across all preset rows so deltas
  // isolate ordering only, not the interaction between ordering and conversion sizing.
  const convPin = pinManual(result.perYearPolicy, plan);
  for (const preset of PRESETS) {
    const cfPlan: Plan = {
      ...plan,
      withdrawalStrategy: preset,
      customPolicy: undefined,
      conversion: convPin,
    };
    counterfactuals.push({
      id: `preset-${preset}`,
      label: PRESET_LABELS[preset],
      kind: 'ordering',
      adaptation: 'policy-held',
      applicable: true,
      ...runCf(cfPlan, chosenScore),
    });
  }

  // ── Bracket-ceiling counterfactuals (conversions re-released to bracket-fill mode) ──
  // Use the compacted policy (result.policy) stripped of convAmt values so the optimizer's
  // withdrawal splits are preserved while bracket-fill controls conversion sizing.
  // These are Class B (settings) — positive deltas are expected and permanent; they get a
  // re-optimize button (Phase 1b, Step 7). planPatch carries what that button applies.
  const strippedPolicy = stripConv(result.policy);
  const CEIL_ROWS: Array<{ id: string; label: string; ceiling: number }> = [
    { id: 'conv-ceil-12', label: 'Fill to 12% bracket top', ceiling: CEIL_12 },
    { id: 'conv-ceil-22', label: 'Fill to 22% bracket top', ceiling: CEIL_22 },
    { id: 'conv-ceil-24', label: 'Fill to 24% bracket top', ceiling: CEIL_24 },
  ];
  for (const { id, label, ceiling } of CEIL_ROWS) {
    const ceilConversion: ConversionParams = {
      ...plan.conversion,
      mode: 'bracket-fill',
      optimize: false,
      bracketCeiling: ceiling,
    };
    const cfPlan: Plan = {
      ...plan,
      customPolicy: strippedPolicy,
      conversion: ceilConversion,
    };
    counterfactuals.push({
      id,
      label,
      kind: 'conversion',
      adaptation: 'policy-held',
      applicable: true,
      reoptimizable: true,
      planPatch: { conversion: ceilConversion },
      ...runCf(cfPlan, chosenScore),
    });
  }

  // ── paytax-flip: Class B — positive delta means brokerage-sourced tax funding helps ──
  const flippedPayTax = !plan.payTaxFromBrokerage;
  counterfactuals.push({
    id: 'paytax-flip',
    label: flippedPayTax ? 'Switch: pay withdrawal tax from brokerage' : 'Switch: bundle withdrawal tax with spending',
    kind: 'taxSourcing',
    adaptation: 'policy-held',
    applicable: true,
    reoptimizable: true,
    planPatch: { payTaxFromBrokerage: flippedPayTax },
    ...runCf({ ...plan, payTaxFromBrokerage: flippedPayTax }, chosenScore),
  });

  // ── Analytic rate sensitivity (free — objective is affine in taxAdjOrdRate) ──
  const convOffCf = counterfactuals.find((c) => c.id === 'conv-off');
  const activeRate = plan.assumptions.taxAdjOrdRate ?? 0.22;
  const ordRate: OrdRateSensitivity | null =
    cmp && convOffCf?.applicable
      ? buildOrdRateSensitivity(result.projection, cmp.noConv, activeRate, chosenScore, convOffCf.score)
      : null;

  // Applicable rows sorted by delta desc (runner-up = closest to beating chosen);
  // inapplicable rows appended last so they render greyed but never omitted.
  const applicable = counterfactuals.filter((c) => c.applicable).sort((a, b) => b.delta - a.delta);
  const inapplicable = counterfactuals.filter((c) => !c.applicable);
  const runnerUpId = applicable[0]?.id ?? null;

  return {
    goal,
    scoreLabel: "Tax-adjusted end balance (today's $)",
    chosenScore,
    counterfactuals: [...applicable, ...inapplicable],
    runnerUpId,
    ordRate,
    settings: buildSettingsImpact(plan, result, [...applicable, ...inapplicable]),
    degraded,
  };
}
