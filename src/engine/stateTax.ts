import { IL_TAX_RATE } from './taxConstants';

/**
 * State tax. v1 supports Illinois only — flat 4.95% on non-exempt ordinary income.
 * IL exempts 401(k)/IRA/Roth distributions, Social Security, and pensions.
 * Wages, rental, and other non-retirement ordinary income are taxable.
 */
export function stateTax(
  state: string,
  nonExemptOrdinaryIncome: number,
): number {
  if (state === 'IL') {
    return Math.max(0, nonExemptOrdinaryIncome) * IL_TAX_RATE;
  }
  // Other states: not yet modeled. Return 0 — TODO Phase 3.
  return 0;
}
