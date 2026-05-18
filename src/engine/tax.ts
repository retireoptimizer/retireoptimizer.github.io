import {
  FED_BRACKETS_MFJ, FED_BRACKETS_SINGLE,
  STANDARD_DEDUCTION_MFJ, STANDARD_DEDUCTION_SINGLE,
  SENIOR_ADDON_MFJ, SENIOR_ADDON_SINGLE,
  LTCG_RATE,
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
  const survivorAge = ageA; // by construction, only the survivor's age matters
  const addon = survivorAge >= 65 ? SENIOR_ADDON_SINGLE : 0;
  return (base + addon) * inflationFactor;
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
  const ltcgTax = Math.max(0, inp.ltcgIncome) * LTCG_RATE;
  const fedTax = ordTax + ltcgTax;
  const totalIncome = inp.ordinaryIncome + inp.ltcgIncome;
  return {
    fedTax,
    taxableOrdinary,
    effRate: totalIncome > 0 ? fedTax / totalIncome : 0,
  };
}
