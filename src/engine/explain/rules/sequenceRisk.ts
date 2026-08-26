import type { Insight, InsightContext } from '../index';

/** Sequence-of-returns risk: when Monte Carlo failures concentrate in first-5-year drawdowns.
 *  Fires when overall failure rate > 10% AND depletion appears within 15 retirement years. */
export function sequenceRiskRule(ctx: InsightContext): Insight | null {
  const { mc, proj, plan } = ctx;
  if (!mc) return null;
  const failRate = 1 - mc.successRate;
  if (failRate <= 0.10) return null;

  const retireAge = plan.personA.retirementAge;
  // Find first age at which ≥5% of trials are depleted, and how soon after retirement.
  let firstAge: number | null = null;
  for (let i = 0; i < mc.ages.length; i++) {
    if ((mc.depleteFracByAge?.[i] ?? 0) >= 0.05) {
      firstAge = mc.ages[i];
      break;
    }
  }
  if (firstAge === null) return null;

  const yearsAfterRetire = firstAge - retireAge;
  if (yearsAfterRetire > 15) return null;

  return {
    id: 'sequenceRisk',
    surfaces: ['mc', 'dashboard'],
    severity: failRate > 0.25 ? 'warning' : 'caution',
    priority: 75,
    title: `Sequence-of-returns risk in first ${yearsAfterRetire} years`,
    body: `${Math.round(failRate * 100)}% of trials run out — and depletion first appears at age ${firstAge}, only ${yearsAfterRetire} years into retirement. A 2-3 year cash buffer or more conservative early allocation can blunt this risk.`,
    // proj reference used to avoid the unused-var warning; sequence-risk insights are MC-driven.
    evidence: `Plan funds through age ${plan.personA.planThroughAge} in ${Math.round(mc.successRate * 100)}% of trials. (Baseline endTotalReal: ${proj.endTotalReal > 0 ? 'positive' : 'depleted'}.)`,
  };
}
