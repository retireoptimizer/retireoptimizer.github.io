import type { Plan } from '../schemas/plan';
import { runProjection } from './projection';
import { runMonteCarlo } from './monteCarlo';
import { compareWithWithoutConversion } from './comparison';

export interface SubScore {
  key: 'longevity' | 'taxEfficiency' | 'sequenceRisk' | 'goalCoverage';
  label: string;
  value: number;            // 0..100
  band: 'excellent' | 'good' | 'improve' | 'poor';
  detail: string;
}

export interface HealthResult {
  overall: number;            // 0..100 (average of sub-scores)
  band: 'excellent' | 'good' | 'improve' | 'poor';
  summary: string;
  subscores: SubScore[];
  actions: Array<{ priority: number; tone: 'success' | 'warning' | 'info'; title: string; body: string }>;
}

const bandFor = (v: number): SubScore['band'] => {
  if (v >= 90) return 'excellent';
  if (v >= 75) return 'good';
  if (v >= 55) return 'improve';
  return 'poor';
};

const clamp = (v: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, v));

/**
 * Compute Plan Health from a base projection + Monte Carlo + with/without conversion comparison.
 *
 *  Longevity      = 100 × MC success rate
 *  Tax Efficiency = 100 × (1 - lifetimeFedTax / lifetimeGrossIncome)
 *  Sequence Risk  = 100 × (mc p10 end-balance / mc p50 end-balance)
 *  Goal Coverage  = blended: planLasts + healthy real end balance
 */
export function computeHealth(plan: Plan): HealthResult {
  const proj = runProjection(plan);
  const mc = runMonteCarlo(plan, { trials: 250, stdDev: 0.10 });
  const cmp = compareWithWithoutConversion(plan);

  // ── Longevity ─────────────────────────────────────────────
  const longevity = clamp(mc.successRate * 100);

  // ── Tax Efficiency ────────────────────────────────────────
  // Lifetime gross income = SS + other + RMD + WD (real-$ sum across years).
  let lifetimeGross = 0;
  let lifetimeTaxReal = 0;
  for (const r of proj.rows) {
    lifetimeGross += (r.totalSS + r.otherIncome + r.totalWD) / r.inflationFactor;
    lifetimeTaxReal += (r.fedTax + r.stateTaxAmt + r.irmaa) / r.inflationFactor;
  }
  const effLifetimeRate = lifetimeGross > 0 ? lifetimeTaxReal / lifetimeGross : 0;
  // 0% effective → 100; 30% effective → 25 (rough mapping, scaled so 15% ~ 70).
  const taxEfficiency = clamp(100 - effLifetimeRate * 250);

  // ── Sequence Risk ─────────────────────────────────────────
  const seqRatio = mc.medianEndBalance > 0 ? mc.p10EndBalance / mc.medianEndBalance : 0;
  const sequenceRisk = clamp(seqRatio * 100);

  // ── Goal Coverage ────────────────────────────────────────
  // No goals engine yet — use "plan lasts horizon" + healthy real end-balance as proxy.
  const planLasts = !proj.ranOut;
  const endRealM = proj.endTotalReal / 1_000_000;
  const goalCoverage = clamp(planLasts ? 80 + Math.min(20, endRealM * 4) : 40 + Math.min(40, endRealM * 10));

  const subscores: SubScore[] = [
    {
      key: 'longevity',
      label: 'Longevity',
      value: Math.round(longevity),
      band: bandFor(longevity),
      detail: `Plan funds ${Math.round(mc.successRate * 100)}% of ${mc.trials} Monte Carlo trials through age ${plan.personA.planToAge}`,
    },
    {
      key: 'taxEfficiency',
      label: 'Tax Efficiency',
      value: Math.round(taxEfficiency),
      band: bandFor(taxEfficiency),
      detail: cmp.lifetimeTaxDelta < -5000
        ? `Active conversion strategy saves ${Math.round(Math.abs(cmp.lifetimeTaxDelta) / 1000)}K vs no conversions`
        : cmp.lifetimeTaxDelta > 5000
        ? `Active conversions add ${Math.round(cmp.lifetimeTaxDelta / 1000)}K in tax — consider reducing`
        : `Effective lifetime tax rate ${(effLifetimeRate * 100).toFixed(1)}% of gross income`,
    },
    {
      key: 'sequenceRisk',
      label: 'Sequence-of-Returns Risk',
      value: Math.round(sequenceRisk),
      band: bandFor(sequenceRisk),
      detail: `10th-percentile end balance is ${Math.round(seqRatio * 100)}% of the median outcome`,
    },
    {
      key: 'goalCoverage',
      label: 'Goal Coverage',
      value: Math.round(goalCoverage),
      band: bandFor(goalCoverage),
      detail: planLasts ? `Plan lasts horizon with ${endRealM.toFixed(1)}M (real $) at the end` : `Portfolio runs out before plan-to age — increase savings or reduce spending`,
    },
  ];

  const overall = Math.round(subscores.reduce((s, x) => s + x.value, 0) / subscores.length);
  const overallBand = bandFor(overall);

  const summary = overallBand === 'excellent'
    ? 'Well-funded, tax-efficient, and on track to meet all goals with margin.'
    : overallBand === 'good'
    ? 'On track overall with one or two areas worth tightening.'
    : overallBand === 'improve'
    ? 'Several meaningful gaps — review the priority actions below.'
    : 'Plan has material risk of failing to meet goals. Address top priority actions first.';

  // Build priority actions
  const actions: HealthResult['actions'] = [];
  if (longevity < 90) {
    actions.push({
      priority: 1,
      tone: 'warning',
      title: `Plan funds only ${Math.round(longevity)}% of trials — strengthen longevity`,
      body: 'Consider delaying retirement, increasing savings, or reducing planned spending. Each year of delay typically adds 5-8 points to this score.',
    });
  }
  if (cmp.lifetimeTaxDelta > -5000 && proj.lifetimeRMD > 100_000) {
    actions.push({
      priority: actions.length + 1,
      tone: 'warning',
      title: `Roth conversions could reduce ${Math.round(proj.lifetimeRMD / 1000)}K in lifetime RMDs`,
      body: 'Currently no significant conversions running. Try Fixed Amount or Bracket Fill on the Roth Conversions page to shift Traditional balance into Roth before RMDs begin.',
    });
  }
  if (sequenceRisk < 55) {
    actions.push({
      priority: actions.length + 1,
      tone: 'warning',
      title: 'Sequence-of-returns risk is elevated',
      body: 'A poor first decade of retirement could materially damage this plan. Consider building a 2-3 year cash buffer or shifting closer to retirement into more conservative assets.',
    });
  }
  if (plan.personB && plan.personB.ssClaimAge < 68 && plan.personB.ssPIA > 20_000) {
    actions.push({
      priority: actions.length + 1,
      tone: 'info',
      title: `Consider delaying ${plan.personB.name}'s Social Security`,
      body: `Claim age is currently ${plan.personB.ssClaimAge}. Delaying to age 70 typically adds significant lifetime benefit when at least one spouse expects to live past 80.`,
    });
  }
  if (actions.length === 0) {
    actions.push({
      priority: 1,
      tone: 'success',
      title: 'Plan is in excellent shape — maintain current trajectory',
      body: 'Continue your current savings rate and review annually. Re-run Monte Carlo after major market moves.',
    });
  }

  return { overall, band: overallBand, summary, subscores, actions };
}
