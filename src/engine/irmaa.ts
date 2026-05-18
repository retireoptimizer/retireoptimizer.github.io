import { IRMAA_TIERS_MFJ_2025 } from './taxConstants';

/**
 * Lookup IRMAA Part B monthly surcharge per person for given MAGI (MFJ).
 * Thresholds inflation-indexed by inflationFactor.
 */
export function irmaaMonthlySurcharge(magi: number, inflationFactor: number): number {
  for (const tier of IRMAA_TIERS_MFJ_2025) {
    if (magi < tier.magiTop * inflationFactor) return tier.monthlyPerPerson;
  }
  return IRMAA_TIERS_MFJ_2025[IRMAA_TIERS_MFJ_2025.length - 1].monthlyPerPerson;
}

/** Annual IRMAA cost = monthly × 12 × number of spouses on Medicare (age ≥ 65). */
export function annualIRMAACost(magi: number, inflationFactor: number, numAt65Plus: number): number {
  return irmaaMonthlySurcharge(magi, inflationFactor) * 12 * numAt65Plus;
}
