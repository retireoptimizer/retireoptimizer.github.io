import type { ConversionParams } from '../schemas/plan';

export interface ConversionInputs {
  params: ConversionParams;
  ageA: number;
  retired: boolean;
  inflationFactor: number;
  traditionalBalance: number;
  baseOrdinaryIncome: number;  // SS taxable portion + RMD (BEFORE conversion)
  stdDeduction: number;
}

/** Returns the Roth conversion amount for this year. Floored at 0, capped at Trad balance. */
export function rothConversion(inp: ConversionInputs): number {
  const { params, ageA, retired, inflationFactor, traditionalBalance, baseOrdinaryIncome, stdDeduction } = inp;
  if (params.mode === 'off') return 0;
  if (traditionalBalance <= 0) return 0;

  if (params.mode === 'manual') {
    const todaysDollars = params.manualSchedule[String(ageA)] ?? 0;
    return Math.min(traditionalBalance, todaysDollars * inflationFactor);
  }

  if (!retired) return 0;
  if (ageA < params.startAge || ageA > params.endAge) return 0;

  if (params.mode === 'auto-window') {
    return Math.min(traditionalBalance, params.autoAmount * inflationFactor);
  }

  if (params.mode === 'bracket-fill') {
    const ceiling = params.bracketCeiling * inflationFactor;
    const headroom = Math.max(0, ceiling - Math.max(0, baseOrdinaryIncome - stdDeduction));
    return Math.min(traditionalBalance, headroom);
  }

  return 0;
}
