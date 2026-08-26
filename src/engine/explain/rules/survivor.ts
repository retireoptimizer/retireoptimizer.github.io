import type { Insight, InsightContext } from '../index';

/** Detects the MFJ → Single filing transition (one spouse passes) and the resulting
 *  effective-rate jump from compressed brackets. Only fires if effRate jumps ≥ 3 points. */
export function survivorRule(ctx: InsightContext): Insight | null {
  const { proj, plan } = ctx;
  if (!plan.personB) return null;

  let transitionIdx = -1;
  for (let i = 1; i < proj.rows.length; i++) {
    if (proj.rows[i - 1].filingStatus === 'MFJ' && proj.rows[i].filingStatus === 'Single') {
      transitionIdx = i;
      break;
    }
  }
  if (transitionIdx < 0) return null;

  const before = proj.rows[transitionIdx - 1];
  const after = proj.rows[transitionIdx];
  const rateBefore = before.effRate;
  const rateAfter = after.effRate;
  if (rateAfter - rateBefore < 0.03) return null;

  // Compare who outlives whom: convert B's planThroughAge to A's age-frame for comparison.
  const birthYearA = parseInt(plan.personA.dob.slice(0, 4), 10);
  const birthYearB = parseInt(plan.personB.dob.slice(0, 4), 10);
  const bEndInAFrame = plan.personB.planThroughAge + (birthYearB - birthYearA);
  const survivorIsA = plan.personA.planThroughAge >= bEndInAFrame;
  const passingName = survivorIsA ? plan.personB.name : plan.personA.name;

  return {
    id: 'survivorCliff',
    surfaces: ['dashboard', 'taxes', 'strategy'],
    severity: 'caution',
    priority: 65,
    title: `Survivor tax cliff after ${passingName} passes`,
    body: `Filing status becomes Single at age ${after.ageA}, compressing tax brackets. Effective federal rate jumps from ${Math.round(rateBefore * 100)}% to ${Math.round(rateAfter * 100)}% — completing Roth conversions while both are MFJ avoids this drag.`,
  };
}
