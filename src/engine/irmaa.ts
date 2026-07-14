import { IRMAA_TIERS_MFJ, IRMAA_TIERS_SINGLE } from './taxConstants';
import type { FilingStatus } from './filingStatus';

/** Lookup IRMAA Part B monthly surcharge per person. Thresholds inflation-indexed by inflationFactor. */
export function irmaaMonthlySurcharge(magi: number, inflationFactor: number, filingStatus: FilingStatus): number {
  const tiers = filingStatus === 'MFJ' ? IRMAA_TIERS_MFJ : IRMAA_TIERS_SINGLE;
  for (const tier of tiers) {
    if (magi < tier.magiTop * inflationFactor) return tier.monthlyPerPerson;
  }
  return tiers[tiers.length - 1].monthlyPerPerson;
}

/** Annual IRMAA cost = monthly × 12 × number of spouses on Medicare (age ≥ 65). */
export function annualIRMAACost(magi: number, inflationFactor: number, numAt65Plus: number, filingStatus: FilingStatus): number {
  return irmaaMonthlySurcharge(magi, inflationFactor, filingStatus) * 12 * numAt65Plus;
}
