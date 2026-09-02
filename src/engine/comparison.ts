import type { Plan } from '../schemas/plan';
import { runProjection, type ProjectionResult } from './projection';

/** Returns false when an optimizer-authored customPolicy has no stored no-conversion baseline.
 *  In that case the ordering was co-optimized against the conversion schedule, so holding it
 *  fixed yields a meaningless counterfactual rather than a fair "conversions off" experiment. */
export function hasComparableConversionBaseline(plan: Plan): boolean {
  return !(plan.customPolicy?.source === 'optimizer' && plan.conversionBaselinePolicy == null);
}

export interface ComparisonResult {
  withConv: ProjectionResult;
  noConv: ProjectionResult;
  lifetimeTaxDelta: number;       // negative = conversions save tax
  endBalanceDelta: number;        // raw end balance (today's $): positive = conversions leave more
  endTaxAdjDelta: number;         // after-tax end balance (today's $) — matches the optimizer objective
  endTaxAdjDeltaNom: number;      // after-tax end balance (nominal $)
  endRothDelta: number;           // positive = more in Roth at end
  lifetimeRMDDelta: number;       // negative = conversions reduce RMDs
  cumulativeTaxWith: number[];    // running sum per year (today's $)
  cumulativeTaxNo: number[];
  cumulativeTaxWithNom: number[]; // running sum per year (nominal $)
  cumulativeTaxNoNom: number[];
  endTotalWith: number[];         // year-end raw balance (today's $)
  endTotalNo: number[];
  endTotalWithNom: number[];      // year-end raw balance (nominal $)
  endTotalNoNom: number[];
  endTaxAdjWith: number[];        // year-end after-tax balance (today's $) — matches the headline delta
  endTaxAdjNo: number[];
  endTaxAdjWithNom: number[];     // year-end after-tax balance (nominal $)
  endTaxAdjNoNom: number[];
}

/** Run the plan twice — once as-is, once with Roth conversions forced off — and diff.
 *
 *  Baseline construction depends on who authored the withdrawal ordering:
 *  - User-authored (preset or manual blend, or no customPolicy): hold the ordering fixed and only
 *    zero conversions. This is the correct controlled experiment — the ordering is the user's visible
 *    choice, so "what do conversions add, given my plan?" is the meaningful question.
 *  - Optimizer-authored (`customPolicy.source === 'optimizer'`): the ordering is co-optimized against
 *    the conversion schedule, so holding it fixed compares against an arbitrary counterfactual. Use
 *    the optimizer's re-adapted no-conversion ordering (`conversionBaselinePolicy`, computed at
 *    optimize time) instead — a best-vs-best comparison that is stable across withdrawal presets. */
export function compareWithWithoutConversion(plan: Plan): ComparisonResult {
  const withConv = runProjection(plan);
  const useOptimizedBaseline =
    plan.customPolicy?.source === 'optimizer' && plan.conversionBaselinePolicy != null;
  const planNoConv: Plan = {
    ...plan,
    conversion: { ...plan.conversion, mode: 'off' },
    customPolicy: useOptimizedBaseline
      ? plan.conversionBaselinePolicy   // no-conversion optimum; windows carry no convAmt → mode 'off' wins
      : plan.customPolicy
        ? { ...plan.customPolicy, windows: plan.customPolicy.windows.map((w) => ({ ...w, convAmt: 0 })) }
        : plan.customPolicy,
  };
  const noConv = runProjection(planNoConv);

  const cumulativeTaxWith: number[] = [];
  const cumulativeTaxNo: number[] = [];
  const cumulativeTaxWithNom: number[] = [];
  const cumulativeTaxNoNom: number[] = [];
  const endTotalWith: number[] = [];
  const endTotalNo: number[] = [];
  const endTotalWithNom: number[] = [];
  const endTotalNoNom: number[] = [];
  const endTaxAdjWith: number[] = [];
  const endTaxAdjNo: number[] = [];
  const endTaxAdjWithNom: number[] = [];
  const endTaxAdjNoNom: number[] = [];
  let cw = 0, cn = 0, cwn = 0, cnn = 0;
  const n = Math.min(withConv.rows.length, noConv.rows.length);
  for (let i = 0; i < n; i++) {
    const rw = withConv.rows[i], rn = noConv.rows[i];
    cw  += (rw.fedTax + rw.niit) / rw.inflationFactor;
    cn  += (rn.fedTax + rn.niit) / rn.inflationFactor;
    cwn += rw.fedTax + rw.niit;
    cnn += rn.fedTax + rn.niit;
    cumulativeTaxWith.push(cw);
    cumulativeTaxNo.push(cn);
    cumulativeTaxWithNom.push(cwn);
    cumulativeTaxNoNom.push(cnn);
    endTotalWith.push(rw.endTotal / rw.inflationFactor);
    endTotalNo.push(rn.endTotal / rn.inflationFactor);
    endTotalWithNom.push(rw.endTotal);
    endTotalNoNom.push(rn.endTotal);
    endTaxAdjWith.push(rw.endTaxAdjusted / rw.inflationFactor);
    endTaxAdjNo.push(rn.endTaxAdjusted / rn.inflationFactor);
    endTaxAdjWithNom.push(rw.endTaxAdjusted);
    endTaxAdjNoNom.push(rn.endTaxAdjusted);
  }

  return {
    withConv,
    noConv,
    lifetimeTaxDelta: withConv.lifetimeFedTax - noConv.lifetimeFedTax,
    endBalanceDelta: withConv.endTotalReal - noConv.endTotalReal,
    endTaxAdjDelta: withConv.endTaxAdjustedReal - noConv.endTaxAdjustedReal,
    endTaxAdjDeltaNom: withConv.endTaxAdjustedNominal - noConv.endTaxAdjustedNominal,
    endRothDelta:
      (withConv.rows[withConv.rows.length - 1]?.endRoth ?? 0) / (withConv.rows[withConv.rows.length - 1]?.inflationFactor ?? 1) -
      (noConv.rows[noConv.rows.length - 1]?.endRoth ?? 0) / (noConv.rows[noConv.rows.length - 1]?.inflationFactor ?? 1),
    lifetimeRMDDelta: withConv.lifetimeRMD - noConv.lifetimeRMD,
    cumulativeTaxWith,
    cumulativeTaxNo,
    cumulativeTaxWithNom,
    cumulativeTaxNoNom,
    endTotalWith,
    endTotalNo,
    endTotalWithNom,
    endTotalNoNom,
    endTaxAdjWith,
    endTaxAdjNo,
    endTaxAdjWithNom,
    endTaxAdjNoNom,
  };
}
