import type { Plan } from '../../schemas/plan';
import type { OptimizeResult } from '../optimizer';
import type { DecisionTrace } from './decisionTrace';
import { runProjection } from '../projection';
import { fmtUSD } from '../../lib/format';
import { rmdStartAgeForDob } from '../rmd';
import { generateInsights, insightsForSurface } from './index';

export interface RationaleSection {
  kind: 'decision' | 'timing' | 'outcome' | 'insights';
  items: string[];
}

export interface PolicyRationale {
  /** One-liner: conversion decision + runner-up beat (if trace supplied). */
  headline: string;
  /** Supporting sections; empty sections are omitted. */
  sections: RationaleSection[];
}

/** Builds a structured rationale explaining the optimizer's policy choice.
 *  Template-driven, not LLM-generated — every sentence is anchored to a specific
 *  number in the plan or projection so it can be verified.
 *
 *  Pass `trace` (from `buildDecisionTrace`) so the headline can cite the runner-up
 *  and the conv-off counterfactual reuses the badge's baseline rather than re-deriving it.
 *  `trace` is optional: the function degrades gracefully without it. */
export function explainPolicy(plan: Plan, result: OptimizeResult, trace?: DecisionTrace): PolicyRationale {
  const rows = result.projection.rows;

  // Conversion benefit: prefer the trace's conv-off counterfactual (same source as the
  // Dashboard badge) to avoid a fourth independent baseline construction.
  // Fall back to a local run when no trace is available (e.g. pre-modal render).
  let convBenefit: number;
  const convOffCf = trace?.counterfactuals.find((c) => c.id === 'conv-off');
  if (convOffCf?.applicable) {
    // delta = cfScore − chosenScore; −delta = chosen − noConv = benefit of conversions
    convBenefit = -convOffCf.delta;
  } else {
    const noConvPlan: Plan = result.conversionBaselinePolicy
      ? { ...plan, customPolicy: result.conversionBaselinePolicy, conversion: { ...plan.conversion, mode: 'off' } }
      : { ...plan, customPolicy: undefined, conversion: { ...plan.conversion, mode: 'off' } };
    const noConvProj = runProjection(noConvPlan);
    convBenefit = result.projection.endTaxAdjustedReal - noConvProj.endTaxAdjustedReal;
  }

  // ── 1. Conversion decision section ──────────────────────────────────────────
  const decisionItems: string[] = [];
  const convWindows = result.policy.windows.filter((w) => (w.convAmt ?? 0) > 0);

  if (convWindows.length === 0) {
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
    decisionItems.push(`The optimizer recommends no Roth conversions${reasonText}.`);
  } else {
    const totalConverted = convWindows.reduce(
      (sum, w) => sum + (w.convAmt ?? 0) * (w.toAge - w.fromAge + 1), 0
    );
    const firstConvAge = convWindows[0].fromAge;
    const lastConvAge  = convWindows[convWindows.length - 1].toAge;
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
    decisionItems.push(
      `The plan converts roughly ${fmtUSD(totalConverted)} total (today's $) from age ${firstConvAge} to ${lastConvAge}${stopEvent}${benefitText}.`
    );
  }

  // ── 2. Timing drivers section ────────────────────────────────────────────────
  const timingItems: string[] = [];
  const drivers: string[] = [];

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

  const rmdAge  = rmdStartAgeForDob(plan.personA.dob);
  const peakRmdReal = Math.max(0, ...rows.map((r) => r.rmd / r.inflationFactor));
  if (peakRmdReal > 50_000) {
    drivers.push(
      `without conversions, RMDs would peak above ${fmtUSD(peakRmdReal)} (today's $) after age ${rmdAge}, pushing MAGI into higher brackets and IRMAA tiers`
    );
  }

  const tradTotal = plan.portfolio.personA.traditional + (plan.portfolio.personB?.traditional ?? 0);
  const totalStart = tradTotal +
    plan.portfolio.personA.taxable + (plan.portfolio.personB?.taxable ?? 0) +
    plan.portfolio.personA.roth + (plan.portfolio.personB?.roth ?? 0);
  if (tradTotal > 0 && totalStart > 0 && tradTotal / totalStart > 0.4) {
    drivers.push(
      `${Math.round((tradTotal / totalStart) * 100)}% of assets (${fmtUSD(tradTotal)}) sit in pre-tax accounts, creating a large future tax liability`
    );
  }

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
    timingItems.push(`Why this timing: ${joined}.`);
  }

  // ── 3. Outcome section ───────────────────────────────────────────────────────
  const outcomeItems: string[] = [];
  const endStr = fmtUSD(result.projection.endTotalReal);
  const taxStr = fmtUSD(result.projection.lifetimeFedTax);
  const fundedStr = result.projection.ranOut
    ? 'Note: plan still depletes — consider reducing spending or extending retirement age.'
    : `Plan funds through age ${plan.personA.planThroughAge}.`;
  outcomeItems.push(`Result: ${endStr} end balance (today's $) · ${taxStr} lifetime federal tax. ${fundedStr}`);

  // ── 4. Insights section ──────────────────────────────────────────────────────
  const insightItems: string[] = [];
  const ruleInsights = insightsForSurface(generateInsights(plan, result.projection), 'strategy');
  for (const ins of ruleInsights.slice(0, 2)) {
    insightItems.push(`${ins.title}: ${ins.body}`);
  }

  // ── 5. Counter-intuitive pattern callouts ───────────────────────────────────
  // These answer the questions users most often ask when they see unexpected output.
  const convWithTradWdYears = rows.filter((r) => r.rothConv > 100 && r.wdTrd > 100);
  if (convWithTradWdYears.length > 0) {
    const age = convWithTradWdYears[0].ageA;
    insightItems.push(
      `Conversions and pre-tax withdrawals in the same year (e.g. age ${age}): these are not in conflict. The conversion is sized first against bracket headroom; the withdrawal happens after and funds spending from whatever gap remains. Converting more would not reduce the withdrawal — it would increase it, because conversion tax is part of the same spending gap.`
    );
  }

  const convDuringRmdYears = rows.filter((r) => r.rothConv > 100 && r.rmd > 100);
  if (convDuringRmdYears.length > 0) {
    const age = convDuringRmdYears[0].ageA;
    insightItems.push(
      `Conversions continue into RMD years (starting age ${age}). The RMD is mandatory ordinary income that consumes bracket space before any conversion is sized — the conversion fills only the headroom that remains above the RMD. Even partial bracket use beats letting the pre-tax balance compound untouched.`
    );
  }

  const totalConverted = convWindows.reduce(
    (sum, w) => sum + (w.convAmt ?? 0) * (w.toAge - w.fromAge + 1), 0
  );
  if (totalConverted > 200_000 && plan.assumptions.taxAdjOrdRate >= 0.20) {
    insightItems.push(
      `High conversion volume is partly driven by the ${Math.round(plan.assumptions.taxAdjOrdRate * 100)}% terminal effective rate you assumed. Paying ordinary income tax now is worth it when the objective haircuts any remaining pre-tax balance at that rate — conversions are essentially a bet that paying now beats paying later.`
    );
  }

  // ── Assemble sections (drop empties) ────────────────────────────────────────
  const sections: RationaleSection[] = [];
  if (insightItems.length > 0) sections.push({ kind: 'insights', items: insightItems });
  if (decisionItems.length > 0) sections.push({ kind: 'decision', items: decisionItems });
  if (timingItems.length > 0)  sections.push({ kind: 'timing',   items: timingItems });
  if (outcomeItems.length > 0) sections.push({ kind: 'outcome',  items: outcomeItems });

  // ── Headline ─────────────────────────────────────────────────────────────────
  // Frames the co-optimization of withdrawal sequence + conversions, not conversions alone.
  let headline: string;
  if (convWindows.length === 0) {
    headline = 'The optimizer found no benefit to Roth conversions for this plan.';
    if (trace) {
      const runnerUp = trace.counterfactuals.find((c) => c.id === trace.runnerUpId && c.applicable);
      if (runnerUp && runnerUp.delta < 0) {
        headline += ` Best alternative was "${runnerUp.label}" — chosen plan wins by ${fmtUSD(Math.abs(runnerUp.delta))}.`;
      }
    }
  } else {
    const firstConvAge = convWindows[0].fromAge;
    const lastConvAge  = convWindows[convWindows.length - 1].toAge;
    headline = `Optimizer co-optimized withdrawal sequence and Roth conversions: ${fmtUSD(totalConverted)} converted age ${firstConvAge}–${lastConvAge}`;
    if (trace) {
      const runnerUp = trace.counterfactuals.find((c) => c.id === trace.runnerUpId && c.applicable);
      if (runnerUp && runnerUp.delta < 0) {
        headline += `; beats "${runnerUp.label}" by ${fmtUSD(Math.abs(runnerUp.delta))}`;
      }
    } else if (convBenefit > 1_000) {
      headline += `; conversions add ${fmtUSD(convBenefit)} vs no conversions`;
    }
    headline += '.';
  }

  return { headline, sections };
}
