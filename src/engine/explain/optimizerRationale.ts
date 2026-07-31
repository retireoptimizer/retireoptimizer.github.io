import type { Plan } from '../../schemas/plan';
import type { OptimizeResult } from '../optimizer';
import { fmtUSD } from '../../lib/format';
import { rmdStartAgeForDob } from '../rmd';
import { generateInsights, insightsForSurface } from './index';

/** Builds 2-4 plain-English sentences explaining the optimizer's policy choice.
 *  Inputs: the user's plan + the optimizer result. Output: one bullet per insight.
 *
 *  This is template-driven, not LLM-generated — every sentence is anchored to a
 *  specific number in the plan or projection so it can be verified. Phase 4's
 *  narrative engine will subsume this module; for now it's a focused helper. */
export function explainPolicy(plan: Plan, result: OptimizeResult): string[] {
  const out: string[] = [];

  // --- "What it does" — describe the conversion schedule in human terms ---
  const conv = result.policy.windows.filter((w) => (w.convAmt ?? 0) > 0);
  if (conv.length === 0) {
    out.push('The optimizer recommends no Roth conversions. Your tax-deferred balance is small enough or your low-bracket window is short enough that conversions don\'t improve the goal.');
  } else if (conv.length === 1) {
    const w = conv[0];
    out.push(`Convert ${fmtUSD(w.convAmt!)} per year from age ${w.fromAge} to ${w.toAge} (today's $).`);
  } else {
    const parts = conv.map((w) => `${fmtUSD(w.convAmt!)} at ages ${w.fromAge === w.toAge ? w.fromAge : `${w.fromAge}–${w.toAge}`}`);
    out.push(`Convert ${parts.slice(0, -1).join('; ')} and ${parts[parts.length - 1]} (today's $ per year).`);
  }

  // --- "Why" — pull plan-anchored reasons from the data ---
  const reasons: string[] = [];

  // Reason 1: large Pre-tax balance
  const tradTotal = plan.portfolio.personA.traditional + (plan.portfolio.personB?.traditional ?? 0);
  const totalStart = tradTotal +
    plan.portfolio.personA.taxable + (plan.portfolio.personB?.taxable ?? 0) +
    plan.portfolio.personA.roth + (plan.portfolio.personB?.roth ?? 0);
  if (tradTotal > 0 && totalStart > 0) {
    const tradPct = tradTotal / totalStart;
    if (tradPct > 0.4) {
      reasons.push(`your Pre-tax 401(k)/IRA balance is large (${fmtUSD(tradTotal)} — ${Math.round(tradPct * 100)}% of total)`);
    }
  }

  // Reason 2: low-bracket gap before SS
  const personAClaimAge = plan.personA.ssClaimAge;
  if (personAClaimAge >= 65 && plan.personA.retirementAge < personAClaimAge - 2) {
    reasons.push(`you have a low-tax window between retirement (age ${plan.personA.retirementAge}) and Social Security at age ${personAClaimAge}`);
  }

  // Reason 3: RMD-driven IRMAA risk
  const rmdAge = rmdStartAgeForDob(plan.personA.dob);
  const peakRmd = Math.max(0, ...result.projection.rows.map((r) => r.rmd / r.inflationFactor));
  if (peakRmd > 50000) {
    reasons.push(`deferring conversions would force RMDs above ${fmtUSD(peakRmd)} (today's $) after age ${rmdAge}, pushing future MAGI into higher IRMAA tiers`);
  }

  // Reason 4: pre-Medicare conversions are IRMAA-safe
  const conv63 = result.policy.windows.some((w) => (w.convAmt ?? 0) > 0 && w.toAge < 63);
  if (conv63) {
    reasons.push('conversions before age 63 don\'t affect Medicare premiums — there\'s no IRMAA 2-year lookback yet');
  }

  if (reasons.length > 0) {
    const joined = reasons.length === 1
      ? reasons[0]
      : reasons.slice(0, -1).join('; ') + '; and ' + reasons[reasons.length - 1];
    out.push(`The optimizer chose this because ${joined}.`);
  }

  // --- "Net effect" — quantify the win vs. doing nothing ---
  out.push(`Result: ${fmtUSD(result.projection.endTotalReal)} end balance (today's $) and ${fmtUSD(result.projection.lifetimeFedTax)} lifetime federal tax. ${result.projection.ranOut ? 'Note: plan still depletes — consider reducing spending or extending retirement age.' : 'Plan funds through age ' + plan.personA.planToAge + '.'}`);

  // --- Layered rule-driven insights from the narrative engine ---
  // Only surface the most actionable strategy-level ones (avoid stacking too many bullets).
  const ruleInsights = insightsForSurface(generateInsights(plan, result.projection), 'strategy');
  for (const ins of ruleInsights.slice(0, 2)) {
    out.push(`${ins.title}: ${ins.body}`);
  }

  return out;
}
