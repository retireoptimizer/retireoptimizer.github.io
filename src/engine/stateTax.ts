/**
 * State income tax module — v1 covers IL, CA, NY, TX, FL, WA.
 *
 * Each profile defines:
 *  - A flat-rate or progressive top-of-bracket rate applied to NON-EXEMPT ordinary income.
 *  - Whether retirement distributions (401(k)/IRA/Roth/pension) are exempt.
 *  - Whether Social Security is exempt.
 *  - A per-person exemption subtracted before applying the rate (IL: $2,425/person, 2024 base).
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
  /** Per-person base exemption in today's dollars (0 if none or baked into effectiveRate). */
  personalExemptionPerPerson: number;
  /** Additional exemption per person aged 65+ in today's dollars (IL-specific). */
  over65ExemptionPerPerson: number;
  note: string;
}

export const STATE_PROFILES: Record<string, StateTaxProfile> = {
  IL: { code: 'IL', name: 'Illinois', effectiveRate: 0.0495, retirementExempt: true, ssExempt: true,
    personalExemptionPerPerson: 2925,   // 2026 IL personal exemption
    over65ExemptionPerPerson: 1000,     // 2026 IL additional exemption for age 65+
    note: 'Flat 4.95% after $2,925/person + $1,000/person (65+) exemption (2026) · Retirement distributions and SS fully exempt · Capital gains taxed as ordinary income' },
  CA: { code: 'CA', name: 'California', effectiveRate: 0.080, retirementExempt: false, ssExempt: true,
    personalExemptionPerPerson: 0, over65ExemptionPerPerson: 0,
    note: 'Progressive (avg ~8% at middle-high incomes) · SS exempt · Retirement distributions fully taxed' },
  NY: { code: 'NY', name: 'New York', effectiveRate: 0.065, retirementExempt: false, ssExempt: true,
    personalExemptionPerPerson: 0, over65ExemptionPerPerson: 0,
    note: 'Progressive (avg ~6.5%) · SS exempt · First $20K of retirement distributions exempt (simplified)' },
  TX: { code: 'TX', name: 'Texas', effectiveRate: 0, retirementExempt: true, ssExempt: true,
    personalExemptionPerPerson: 0, over65ExemptionPerPerson: 0,
    note: 'No state income tax' },
  FL: { code: 'FL', name: 'Florida', effectiveRate: 0, retirementExempt: true, ssExempt: true,
    personalExemptionPerPerson: 0, over65ExemptionPerPerson: 0,
    note: 'No state income tax' },
  WA: { code: 'WA', name: 'Washington', effectiveRate: 0, retirementExempt: true, ssExempt: true,
    personalExemptionPerPerson: 0, over65ExemptionPerPerson: 0,
    note: 'No state income tax (excluding 7% capital-gains tax on gains above ~$262K)' },
};

/**
 * Compute state tax.
 * @param numPersons - Number of living taxpayers (1 = single/survivor, 2 = couple).
 * @param numOver65 - Number of living taxpayers aged 65+ (for additional IL-style exemption).
 * @param inflationFactor - Cumulative inflation from plan start; scales nominal exemption amounts.
 */
export function stateTax(
  state: string,
  nonExemptOrdinaryIncome: number,
  retirementDistributions = 0,
  numPersons = 1,
  inflationFactor = 1,
  numOver65 = 0,
): number {
  const profile = STATE_PROFILES[state];
  if (!profile || profile.effectiveRate === 0) return 0;
  const grossTaxable = profile.retirementExempt
    ? Math.max(0, nonExemptOrdinaryIncome)
    : Math.max(0, nonExemptOrdinaryIncome + retirementDistributions);
  const exemption = (
    profile.personalExemptionPerPerson * numPersons +
    profile.over65ExemptionPerPerson * numOver65
  ) * inflationFactor;
  const taxable = Math.max(0, grossTaxable - exemption);
  return taxable * profile.effectiveRate;
}

export function listStates(): StateTaxProfile[] {
  return Object.values(STATE_PROFILES).sort((a, b) => a.name.localeCompare(b.name));
}
