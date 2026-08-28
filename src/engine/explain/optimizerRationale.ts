import type { Plan } from '../../schemas/plan';
import type { OptimizeResult } from '../optimizer';
import { runProjection } from '../projection';
import { fmtUSD } from '../../lib/format';
import { rmdStartAgeForDob } from '../rmd';
import { generateInsights, insightsForSurface } from './index';

/** Builds 2–5 plain-English sentences explaining the optimizer's policy choice.
 *  Template-driven, not LLM-generated — every sentence is anchored to a specific
 *  number in the plan or projection so it can be verified. */
export function explainPolicy(plan: Plan, result: OptimizeResult): string[] {
  const out: string[] = [];
  const rows = result.projection.rows;

  // Run a no-conversion baseline so the summary can quantify the benefit. When the optimizer
  // produced a re-adapted no-conversion ordering, use it (best-vs-best) so this narrative agrees
  // with the Dashboard badge; otherwise fall back to dropping the policy entirely.
  const noConvPlan: Plan = result.conversionBaselinePolicy
    ? { ...plan, customPolicy: result.conversionBaselinePolicy, conversion: { ...plan.conversion, mode: 'off' } }
    : { ...plan, customPolicy: undefined, conversion: { ...plan.conversion, mode: 'off' } };
  const noConvProj = runProjection(noConvPlan);
  // Measure on after-tax (tax-adjusted) end balance — the optimizer's objective — so the narrative
  // agrees with the Dashboard badge and doesn't understate conversions on a raw-dollar basis.
  const convBenefit = result.projection.endTaxAdjustedReal - noConvProj.endTaxAdjustedReal;

  // ── 1. Conversion summary ────────────────────────────────────────────────
  const convWindows = result.policy.windows.filter((w) => (w.convAmt ?? 0) > 0);
  if (convWindows.length === 0) {
    // Plan-specific reasoning for zero conversions.
    const reasons: string[] = [];

    const tradTotal = plan.portfolio.personA.traditional + (plan.portfolio.personB?.traditional ?? 0);
    const totalStart = tradTotal +
      plan.portfolio.personA.taxable + (plan.portfolio.personB?.taxable ?? 0) +
      plan.portfolio.personA.roth + (plan.portfolio.personB?.roth ?? 0);
    const tradShare = totalStart > 0 ? tradTotal / totalStart : 0;

    if (tradShare < 0.30) {
      reasons.push(`only ${Math.round(tradShare * 100)}% of assets are in pre-tax accounts — not enough future RMD pressure to justify conversions`);
    }

    const peakRmdReal = Math.max(0, ...rows.map((r) => r.rmd / r.inflationFactor));
    if (peakRmdReal < 30_000) {
      reasons.push(`projected RMDs stay below ${fmtUSD(peakRmdReal)} — no meaningful bracket-push from required distributions`);
    }

    const largePension = (plan.incomeStreams ?? []).some(
      (s) => s.type === 'Pension' && s.annualAmount >= 40_000
    );
    if (largePension) {
      reasons.push('pension income already fills the lower brackets throughout retirement');
    }

    const reasonText = reasons.length > 0
      ? ` — ${reasons.join('; ')}`
      : '. Your tax-deferred balance or low-bracket window is small enough that conversions don\'t improve the goal';

    out.push(`The optimizer recommends no Roth conversions${reasonText}.`);
  } else {
    const totalConverted = convWindows.reduce(
      (sum, w) => sum + (w.convAmt ?? 0) * (w.toAge - w.fromAge + 1), 0
    );
    const firstConvAge = convWindows[0].fromAge;
    const lastConvAge  = convWindows[convWindows.length - 1].toAge;

    // Detect event immediately after the last conversion year.
    const stopAge = lastConvAge + 1;
    const rmdAge  = rmdStartAgeForDob(plan.personA.dob);
    let stopEvent = '';
    if (stopAge === rmdAge) {
      stopEvent = `, stopping just before RMDs begin at ${rmdAge}`;
    } else if (stopAge === 63) {
      stopEvent = ', stopping before the 2-year IRMAA lookback window opens at 63';
    } else if (stopAge === plan.personA.ssClaimAge) {
      stopEvent = `, stopping before Social Security begins at ${plan.personA.ssClaimAge}`;
    } else if (stopAge === plan.personA.planThroughAge) {
      stopEvent = ', running through end of plan';
    }

    const benefitText = convBenefit > 1_000
      ? ` — adding ${fmtUSD(convBenefit)} vs no conversions`
      : '';

    out.push(
      `The plan converts roughly ${fmtUSD(totalConverted)} total (today's $) from age ${firstConvAge} to ${lastConvAge}${stopEvent}${benefitText}.`
    );
  }

  // ── 2. Event-anchored timing drivers ────────────────────────────────────
  const drivers: string[] = [];

  // Driver A: MFJ → Single filing transition
  if (plan.personB) {
    for (let i = 1; i < rows.length; i++) {
      if (rows[i - 1].filingStatus === 'MFJ' && rows[i].filingStatus === 'Single') {
        const filingChangeAge = rows[i].ageA;
        const rateBefore = Math.round(rows[i - 1].effRate * 100);
        const rateAfter  = Math.round(rows[i].effRate * 100);
        if (rateAfter > rateBefore) {
          drivers.push(
            `Filing switches to Single at your age ${filingChangeAge} — effective rate rises from ${rateBefore}% to ${rateAfter}%; converting before then avoids the bracket compression`
          );
        }
        break;
      }
    }
  }

  // Driver B: RMD-driven bracket pressure
  const rmdAge  = rmdStartAgeForDob(plan.personA.dob);
  const peakRmdReal = Math.max(0, ...rows.map((r) => r.rmd / r.inflationFactor));
  if (peakRmdReal > 50_000) {
    drivers.push(
      `without conversions, RMDs would peak above ${fmtUSD(peakRmdReal)} (today's $) after age ${rmdAge}, pushing MAGI into higher brackets and IRMAA tiers`
    );
  }

  // Driver C: large pre-tax share
  const tradTotal = plan.portfolio.personA.traditional + (plan.portfolio.personB?.traditional ?? 0);
  const totalStart = tradTotal +
    plan.portfolio.personA.taxable + (plan.portfolio.personB?.taxable ?? 0) +
    plan.portfolio.personA.roth + (plan.portfolio.personB?.roth ?? 0);
  if (tradTotal > 0 && totalStart > 0 && tradTotal / totalStart > 0.4) {
    drivers.push(
      `${Math.round((tradTotal / totalStart) * 100)}% of assets (${fmtUSD(tradTotal)}) sit in pre-tax accounts, creating a large future tax liability`
    );
  }

  // Driver D: low-bracket gap before SS
  const ssStartAge = plan.personA.ssClaimAge;
  if (ssStartAge >= 65 && plan.personA.retirementAge < ssStartAge - 2) {
    drivers.push(
      `there's a low-income window from retirement (age ${plan.personA.retirementAge}) to Social Security at ${ssStartAge} — ideal for filling lower brackets cheaply`
    );
  }

  if (drivers.length > 0) {
    const joined = drivers.length === 1
      ? drivers[0]
      : drivers.slice(0, -1).join('; ') + '; and ' + drivers[drivers.length - 1];
    out.push(`Why this timing: ${joined}.`);
  }

  // ── 3. Net-effect summary ────────────────────────────────────────────────
  const endStr = fmtUSD(result.projection.endTotalReal);
  const taxStr = fmtUSD(result.projection.lifetimeFedTax);
  const fundedStr = result.projection.ranOut
    ? 'Note: plan still depletes — consider reducing spending or extending retirement age.'
    : `Plan funds through age ${plan.personA.planThroughAge}.`;
  out.push(`Result: ${endStr} end balance (today's $) · ${taxStr} lifetime federal tax. ${fundedStr}`);

  // ── 4. Rule-driven insights (strategy surface) ──────────────────────────
  const ruleInsights = insightsForSurface(generateInsights(plan, result.projection), 'strategy');
  for (const ins of ruleInsights.slice(0, 2)) {
    out.push(`${ins.title}: ${ins.body}`);
  }

  return out;
}
