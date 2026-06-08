import type { Insight, InsightContext } from '../index';
import { IRMAA_TIERS_MFJ_2025 } from '../../taxConstants';
import { fmtUSD } from '../../../lib/format';

/** Reports the highest IRMAA tier the household crosses during the projection and
 *  the first age at which the crossing happens. Only fires when premium impact ≥ $1K/yr. */
export function irmaaRule(ctx: InsightContext): Insight | null {
  const { proj } = ctx;

  let maxTier = 0;
  let firstAgeAtTier: Record<number, number> = {};

  for (const r of proj.rows) {
    if (r.irmaa <= 0) continue;
    const magi = (r.ordIncome + r.ltcg);
    // Tier index: 0 means no surcharge; 1+ means surcharge applies.
    let tier = 0;
    for (let i = 0; i < IRMAA_TIERS_MFJ_2025.length; i++) {
      const top = IRMAA_TIERS_MFJ_2025[i].magiTop;
      const cap = top === Infinity ? Infinity : top * r.inflationFactor;
      if (magi <= cap) { tier = i; break; }
    }
    if (tier > 0 && firstAgeAtTier[tier] === undefined) firstAgeAtTier[tier] = r.ageA;
    if (tier > maxTier) maxTier = tier;
  }

  if (maxTier === 0) return null;

  const firstCrossAge = firstAgeAtTier[1] ?? firstAgeAtTier[maxTier];

  // Peak annual IRMAA in today's dollars across the projection.
  const peakIRMAAReal = Math.max(0, ...proj.rows.map((r) => r.irmaa / r.inflationFactor));
  if (peakIRMAAReal < 1000) return null;

  return {
    id: 'irmaaCrossing',
    surfaces: ['dashboard', 'strategy', 'taxes'],
    severity: maxTier >= 3 ? 'warning' : 'caution',
    priority: 70,
    title: `Crosses IRMAA tier ${maxTier} at age ${firstCrossAge}`,
    body: `Peak Medicare surcharge is ${fmtUSD(peakIRMAAReal)} per year (today's $). Income before age 63 doesn't affect IRMAA (2-year MAGI lookback), so earlier Roth conversions are surcharge-free.`,
    evidence: `${maxTier} of ${IRMAA_TIERS_MFJ_2025.length - 1} tiers crossed.`,
  };
}
