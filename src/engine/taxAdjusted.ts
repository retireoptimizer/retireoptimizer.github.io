import type { Assumptions } from '../schemas/plan';

/**
 * Extract the two flat effective haircut rates from plan assumptions.
 * Uses Partial<> because PlanSchema.parse is never called at runtime —
 * Zod .default() is documentation here, not a runtime guarantee.
 */
export function taxAdjustedRates(
  a: Partial<Pick<Assumptions, 'taxAdjOrdRate' | 'taxAdjLtcgRate'>> | undefined,
): { ordRate: number; ltcgRate: number } {
  return {
    ordRate:  a?.taxAdjOrdRate  ?? 0.22,
    ltcgRate: a?.taxAdjLtcgRate ?? 0.15,
  };
}

/**
 * After-tax liquidation value of the portfolio.
 *
 * Formula:
 *   endRoth                                      — already clean; untouched
 *   + basis                                      — basis = min(endTaxableBasis, endTaxable); already-taxed money
 *   + (endTaxable − basis) × (1 − ltcgRate)      — unrealized gain net of cap-gains tax
 *   + endTraditional × (1 − ordRate)             — full pre-tax balance net of ordinary tax
 *
 * Rates are blended effective rates on whole balances — not brackets.
 * No state tax, IRMAA, or NIIT is included; the breakdown modal discloses this.
 *
 * Clamp: basis accretes unconditionally (dividends, exempt interest) while the
 * taxable balance can be zero or negative on low-return / bad Monte Carlo paths.
 * Without the clamp endTaxAdjusted can exceed endTotal, breaking invariants.
 */
export function taxAdjustedValue(
  endTaxable: number,
  endTaxableBasis: number,
  endTraditional: number,
  endRoth: number,
  ordRate: number,
  ltcgRate: number,
): number {
  const basis = Math.min(endTaxableBasis, endTaxable);
  const unrealizedGain = Math.max(0, endTaxable - basis);
  return (
    endRoth +
    basis +
    unrealizedGain * (1 - ltcgRate) +
    endTraditional * (1 - ordRate)
  );
}
