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
  cumulativeTaxWithNom: number[]; // running sum per year (nominal $)
  cumulativeTaxNoNom: number[];
  endTotalWith: number[];         // year-end balance (today's $)
  endTotalNo: number[];
  endTotalWithNom: number[];      // year-end balance (nominal $)
  endTotalNoNom: number[];
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
  const cumulativeTaxWithNom: number[] = [];
  const cumulativeTaxNoNom: number[] = [];
  const endTotalWith: number[] = [];
  const endTotalNo: number[] = [];
  const endTotalWithNom: number[] = [];
  const endTotalNoNom: number[] = [];
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
    cumulativeTaxWithNom,
    cumulativeTaxNoNom,
    endTotalWith,
    endTotalNo,
    endTotalWithNom,
    endTotalNoNom,
  };
}
