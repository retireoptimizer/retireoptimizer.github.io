import { SS_FACTORS_FRA67 } from './taxConstants';

/** Full retirement age (FRA) by birth year (SSA table, simplified). */
export function fullRetirementAge(birthYear: number): number {
  if (birthYear <= 1954) return 66;
  if (birthYear === 1955) return 66 + 2 / 12;
  if (birthYear === 1956) return 66 + 4 / 12;
  if (birthYear === 1957) return 66 + 6 / 12;
  if (birthYear === 1958) return 66 + 8 / 12;
  if (birthYear === 1959) return 66 + 10 / 12;
  return 67;
}

/**
 * Benefit factor for an integer claim age. Uses prototype's FRA-67 table.
 * Anyone with FRA != 67 still rounded via this lookup (acceptable for v1; tightens later).
 */
export function benefitFactor(claimAge: number): number {
  const a = Math.max(62, Math.min(70, Math.round(claimAge)));
  return SS_FACTORS_FRA67[a] ?? 1.0;
}

/** Annual benefit for a person given PIA, chosen claim age, current age. Zero before claim. */
export function annualSSBenefit(pia: number, claimAge: number, currentAge: number): number {
  if (currentAge < claimAge) return 0;
  return pia * benefitFactor(claimAge);
}
