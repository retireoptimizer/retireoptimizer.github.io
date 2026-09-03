import { IRMAA_TIERS_MFJ, IRMAA_TIERS_SINGLE } from './taxConstants';
import type { FilingStatus } from './filingStatus';

/** Lookup combined IRMAA monthly surcharge per person (Part B + Part D). Thresholds inflation-indexed. */
export function irmaaMonthlySurcharge(magi: number, inflationFactor: number, filingStatus: FilingStatus): number {
  const tiers = filingStatus === 'MFJ' ? IRMAA_TIERS_MFJ : IRMAA_TIERS_SINGLE;
  for (const tier of tiers) {
    if (magi < tier.magiTop * inflationFactor) return (tier.partB + tier.partD) * inflationFactor;
  }
  const last = tiers[tiers.length - 1];
  return (last.partB + last.partD) * inflationFactor;
}

/** Annual IRMAA cost (Part B + Part D) = monthly × 12 × number of spouses on Medicare (age ≥ 65). */
export function annualIRMAACost(magi: number, inflationFactor: number, numAt65Plus: number, filingStatus: FilingStatus): number {
  return irmaaMonthlySurcharge(magi, inflationFactor, filingStatus) * 12 * numAt65Plus;
}
