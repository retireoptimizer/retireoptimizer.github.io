import type { Plan } from '../schemas/plan';
import { runProjection, type ProjectionResult } from './projection';

export interface ComparisonResult {
  withConv: ProjectionResult;
  noConv: ProjectionResult;
  lifetimeTaxDelta: number;       // negative = conversions save tax
  endBalanceDelta: number;        // positive = conversions leave more
  endRothDelta: number;           // positive = more in Roth at end
  lifetimeRMDDelta: number;       // negative = conversions reduce RMDs
  cumulativeTaxWith: number[];    // running sum per year (today's $)
  cumulativeTaxNo: number[];
  endTotalWith: number[];         // year-end balance (today's $)
  endTotalNo: number[];
}

/** Run the plan twice — once as-is, once with Roth conversions forced off — and diff.
 *  When a customPolicy is active (e.g. after the optimizer is applied) conversions are
 *  driven by per-window `convAmt`, which entirely bypasses `plan.conversion.mode`. To
 *  truly compare with-vs-without we must also zero every `convAmt` in customPolicy —
 *  keeping the blend (pctTaxable/Traditional/Roth) so the delta isolates conversions,
 *  not the withdrawal strategy. */
export function compareWithWithoutConversion(plan: Plan): ComparisonResult {
  const withConv = runProjection(plan);
  const planNoConv: Plan = {
    ...plan,
    conversion: { ...plan.conversion, mode: 'off' },
    customPolicy: plan.customPolicy
      ? { ...plan.customPolicy, windows: plan.customPolicy.windows.map((w) => ({ ...w, convAmt: 0 })) }
      : plan.customPolicy,
  };
  const noConv = runProjection(planNoConv);

  const cumulativeTaxWith: number[] = [];
  const cumulativeTaxNo: number[] = [];
  const endTotalWith: number[] = [];
  const endTotalNo: number[] = [];
  let cw = 0, cn = 0;
  const n = Math.min(withConv.rows.length, noConv.rows.length);
  for (let i = 0; i < n; i++) {
    cw += withConv.rows[i].fedTax / withConv.rows[i].inflationFactor;
    cn += noConv.rows[i].fedTax / noConv.rows[i].inflationFactor;
    cumulativeTaxWith.push(cw);
    cumulativeTaxNo.push(cn);
    endTotalWith.push(withConv.rows[i].endTotal / withConv.rows[i].inflationFactor);
    endTotalNo.push(noConv.rows[i].endTotal / noConv.rows[i].inflationFactor);
  }

  return {
    withConv,
    noConv,
    lifetimeTaxDelta: withConv.lifetimeFedTax - noConv.lifetimeFedTax,
    endBalanceDelta: withConv.endTotalReal - noConv.endTotalReal,
    endRothDelta:
      (withConv.rows[withConv.rows.length - 1]?.endRoth ?? 0) / (withConv.rows[withConv.rows.length - 1]?.inflationFactor ?? 1) -
      (noConv.rows[noConv.rows.length - 1]?.endRoth ?? 0) / (noConv.rows[noConv.rows.length - 1]?.inflationFactor ?? 1),
    lifetimeRMDDelta: withConv.lifetimeRMD - noConv.lifetimeRMD,
    cumulativeTaxWith,
    cumulativeTaxNo,
    endTotalWith,
    endTotalNo,
  };
}
