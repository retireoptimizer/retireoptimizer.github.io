/**
 * State income tax module — v1 covers IL, CA, NY, TX, FL, WA.
 *
 * Each profile defines:
 *  - A flat-rate or progressive top-of-bracket rate applied to NON-EXEMPT ordinary income.
 *  - Whether retirement distributions (401(k)/IRA/Roth/pension) are exempt.
 *  - Whether Social Security is exempt.
 *
 * The non-exempt vs exempt split is computed upstream in projection.ts: streams of type
 * Wages/Rental/Other contribute to non-exempt; SS / 401(k) WD / Pension / Roth do not.
 *
 * For states with progressive brackets (CA, NY), we use a simplified average effective rate
 * across the relevant taxable income — sufficient for plan-level guidance. Full brackets are a
 * Phase 4 refinement.
 */

export interface StateTaxProfile {
  code: string;
  name: string;
  /** Effective tax rate on non-exempt ordinary income (today's $-indexed, approximate). */
  effectiveRate: number;
  retirementExempt: boolean;   // 401(k)/IRA/Roth/Pension distributions exempt?
  ssExempt: boolean;
  note: string;
}

export const STATE_PROFILES: Record<string, StateTaxProfile> = {
  IL: { code: 'IL', name: 'Illinois', effectiveRate: 0.0495, retirementExempt: true, ssExempt: true,
    note: 'Flat 4.95% · Retirement distributions and SS fully exempt' },
  CA: { code: 'CA', name: 'California', effectiveRate: 0.080, retirementExempt: false, ssExempt: true,
    note: 'Progressive (avg ~8% at middle-high incomes) · SS exempt · Retirement distributions fully taxed' },
  NY: { code: 'NY', name: 'New York', effectiveRate: 0.065, retirementExempt: false, ssExempt: true,
    note: 'Progressive (avg ~6.5%) · SS exempt · First $20K of retirement distributions exempt (simplified)' },
  TX: { code: 'TX', name: 'Texas', effectiveRate: 0, retirementExempt: true, ssExempt: true,
    note: 'No state income tax' },
  FL: { code: 'FL', name: 'Florida', effectiveRate: 0, retirementExempt: true, ssExempt: true,
    note: 'No state income tax' },
  WA: { code: 'WA', name: 'Washington', effectiveRate: 0, retirementExempt: true, ssExempt: true,
    note: 'No state income tax (excluding 7% capital-gains tax on gains above ~$262K)' },
};

/**
 * Compute state tax. nonExemptOrdinaryIncome already excludes SS and retirement distributions
 * for IL (per the projection's stream classification). For CA/NY which tax retirement distributions,
 * we apply the rate to the union of non-exempt + retirement WD.
 */
export function stateTax(
  state: string,
  nonExemptOrdinaryIncome: number,
  retirementDistributions = 0,
): number {
  const profile = STATE_PROFILES[state];
  if (!profile || profile.effectiveRate === 0) return 0;
  const taxable = profile.retirementExempt
    ? Math.max(0, nonExemptOrdinaryIncome)
    : Math.max(0, nonExemptOrdinaryIncome + retirementDistributions);
  return taxable * profile.effectiveRate;
}

export function listStates(): StateTaxProfile[] {
  return Object.values(STATE_PROFILES).sort((a, b) => a.name.localeCompare(b.name));
}
