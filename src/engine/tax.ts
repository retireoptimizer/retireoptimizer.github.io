import {
  FED_BRACKETS_MFJ, FED_BRACKETS_SINGLE,
  STANDARD_DEDUCTION_MFJ, STANDARD_DEDUCTION_SINGLE,
  SENIOR_ADDON_MFJ, SENIOR_ADDON_SINGLE,
  SENIOR_BONUS_PER_PERSON, SENIOR_BONUS_FIRST_YEAR, SENIOR_BONUS_LAST_YEAR,
  SENIOR_BONUS_PHASEOUT_START_SINGLE, SENIOR_BONUS_PHASEOUT_START_MFJ, SENIOR_BONUS_PHASEOUT_RATE,
  LTCG_BRACKETS_MFJ, LTCG_BRACKETS_SINGLE,
  SS_PROVISIONAL_BASE_MFJ, SS_PROVISIONAL_UPPER_MFJ,
  SS_PROVISIONAL_BASE_SINGLE, SS_PROVISIONAL_UPPER_SINGLE,
} from './taxConstants';
import type { FilingStatus } from './filingStatus';

/** Federal progressive tax on ordinary taxable income. Thresholds × inflationFactor. */
export function federalOrdinaryTax(
  taxableIncome: number,
  filingStatus: FilingStatus,
  inflationFactor: number,
): number {
  if (taxableIncome <= 0) return 0;
  const brackets = filingStatus === 'MFJ' ? FED_BRACKETS_MFJ : FED_BRACKETS_SINGLE;
  let tax = 0;
  let prev = 0;
  for (const [top, rate] of brackets) {
    const cap = top === Infinity ? Infinity : top * inflationFactor;
    if (taxableIncome > prev) {
      tax += Math.min(taxableIncome - prev, cap - prev) * rate;
      prev = cap;
      if (taxableIncome <= prev) break;
    }
  }
  return tax;
}

/** Standard deduction with senior addons. Both 65+ get the addon (MFJ) or single's higher value. */
export function standardDeduction(
  filingStatus: FilingStatus,
  ageA: number,
  ageB: number | undefined,
  inflationFactor: number,
): number {
  if (filingStatus === 'MFJ') {
    const base = STANDARD_DEDUCTION_MFJ;
    const addons =
      (ageA >= 65 ? SENIOR_ADDON_MFJ : 0) +
      (ageB !== undefined && ageB >= 65 ? SENIOR_ADDON_MFJ : 0);
    return (base + addons) * inflationFactor;
  }
  const base = STANDARD_DEDUCTION_SINGLE;
  const addon = ageA >= 65 ? SENIOR_ADDON_SINGLE : 0;
  return (base + addon) * inflationFactor;
}

/**
 * Temporary $6,000/person senior bonus deduction (OBBBA, tax years 2025–2028).
 * Phases out at $0.06 per $1 of MAGI over the threshold (fixed thresholds, not inflation-indexed).
 */
export function seniorBonusDeduction(
  filingStatus: FilingStatus,
  ageA: number,
  ageB: number | undefined,
  magi: number,
  calendarYear: number,
): number {
  if (calendarYear < SENIOR_BONUS_FIRST_YEAR || calendarYear > SENIOR_BONUS_LAST_YEAR) return 0;
  const eligible = (ageA >= 65 ? 1 : 0) + (ageB !== undefined && ageB >= 65 ? 1 : 0);
  if (eligible === 0) return 0;
  const threshold = filingStatus === 'MFJ' ? SENIOR_BONUS_PHASEOUT_START_MFJ : SENIOR_BONUS_PHASEOUT_START_SINGLE;
  const reduction = Math.max(0, magi - threshold) * SENIOR_BONUS_PHASEOUT_RATE;
  return Math.max(0, eligible * SENIOR_BONUS_PER_PERSON - reduction);
}

/**
 * Taxable portion of Social Security benefits under IRC §86 provisional-income tiers.
 * Thresholds are fixed by law (not inflation-indexed).
 *
 * @param provisionalIncome  Non-SS AGI + 0.5 × gross SS benefits
 * @param grossSS            Total annual SS benefits received
 * @param filingStatus
 */
export function taxableSocialSecurity(
  provisionalIncome: number,
  grossSS: number,
  filingStatus: FilingStatus,
): number {
  if (grossSS <= 0) return 0;
  const base  = filingStatus === 'MFJ' ? SS_PROVISIONAL_BASE_MFJ  : SS_PROVISIONAL_BASE_SINGLE;
  const upper = filingStatus === 'MFJ' ? SS_PROVISIONAL_UPPER_MFJ : SS_PROVISIONAL_UPPER_SINGLE;

  if (provisionalIncome <= base) return 0;

  if (provisionalIncome <= upper) {
    return Math.min(0.5 * (provisionalIncome - base), 0.5 * grossSS);
  }

  // Above upper threshold: tier-1 amount plus 85% of excess above upper, capped at 85% × SS.
  const tier1 = Math.min(0.5 * (upper - base), 0.5 * grossSS);
  const tier2 = 0.85 * (provisionalIncome - upper);
  return Math.min(0.85 * grossSS, tier1 + tier2);
}

/**
 * LTCG / qualified-dividend tax using stacked brackets (LTCG sits on top of ordinary income).
 * Replaces the legacy flat-15% calculation.
 */
function stackedLtcgTax(
  ltcgIncome: number,
  taxableOrdinary: number,
  filingStatus: FilingStatus,
  inflationFactor: number,
): number {
  if (ltcgIncome <= 0) return 0;
  const brackets = filingStatus === 'MFJ' ? LTCG_BRACKETS_MFJ : LTCG_BRACKETS_SINGLE;
  let remaining = ltcgIncome;
  let tax = 0;
  let prevTop = 0;
  for (const [top, rate] of brackets) {
    const cap = top === Infinity ? Infinity : top * inflationFactor;
    // LTCG fills from where ordinary income ends; the "floor" is taxableOrdinary.
    const bracketRoom = Math.max(0, cap - Math.max(taxableOrdinary, prevTop));
    const inBracket = Math.min(remaining, bracketRoom);
    tax += inBracket * rate;
    remaining -= inBracket;
    if (remaining <= 0) break;
    prevTop = cap;
  }
  return tax;
}

export interface YearTaxInputs {
  filingStatus: FilingStatus;
  inflationFactor: number;
  ordinaryIncome: number;        // ordinary income before standard deduction
  ltcgIncome: number;            // LTCG/qualified-div income (taxed separately at flat 15%)
  standardDeduction: number;     // pre-computed (use standardDeduction() above)
}

export interface YearTaxOutputs {
  fedTax: number;
  taxableOrdinary: number;       // after std deduction
  effRate: number;               // fedTax / (ordinaryIncome + ltcgIncome)
}

/** Compute year's federal tax given final income components (no iteration). */
export function yearFederalTax(inp: YearTaxInputs): YearTaxOutputs {
  const taxableOrdinary = Math.max(0, inp.ordinaryIncome - inp.standardDeduction);
  const ordTax = federalOrdinaryTax(taxableOrdinary, inp.filingStatus, inp.inflationFactor);
  const ltcgTax = stackedLtcgTax(Math.max(0, inp.ltcgIncome), taxableOrdinary, inp.filingStatus, inp.inflationFactor);
  const fedTax = ordTax + ltcgTax;
  const totalIncome = inp.ordinaryIncome + inp.ltcgIncome;
  return {
    fedTax,
    taxableOrdinary,
    effRate: totalIncome > 0 ? fedTax / totalIncome : 0,
  };
}
