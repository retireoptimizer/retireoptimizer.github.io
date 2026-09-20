/**
 * State income tax module — v1 covers IL, CA, NY, TX, FL, WA.
 *
 * Each profile defines:
 *  - A flat-rate or progressive bracket table applied to state taxable income.
 *  - Whether retirement distributions (401(k)/IRA/Roth/pension) are exempt.
 *  - Whether Social Security is exempt.
 *  - A per-person exemption subtracted before applying the rate (IL: $2,925/person, 2026 base).
 *  - A per-person retirement income exclusion (NY: $20K/person before brackets apply).
 *  - A standard deduction split by filing status (NY: $8K single / $16,050 MFJ, 2025 law).
 *
 * The non-exempt vs exempt split is computed upstream in projection.ts: streams of type
 * Wages/Rental/Other contribute to non-exempt; SS / 401(k) WD / Pension / Roth do not.
 *
 * CA uses a simplified average effective rate (full brackets are a Phase 4 refinement).
 * NY uses actual progressive brackets with exact deductions.
 */

export interface StateTaxProfile {
  code: string;
  name: string;
  /** Effective flat tax rate on taxable income; ignored when brackets is non-null. */
  effectiveRate: number;
  retirementExempt: boolean;
  ssExempt: boolean;
  /** Per-person exemption in today's dollars (IL-style; inflation-indexed). */
  personalExemptionPerPerson: number;
  /** Additional exemption per person aged 65+ (IL-specific). */
  over65ExemptionPerPerson: number;
  /** Per-person retirement income exclusion before tax (NY: $20K/person; inflation-indexed). */
  retirementExemptionPerPerson: number;
  /** Standard deduction for single filers in today's dollars (filing-status indexed; inflation-indexed). */
  stdDeductionSingle: number;
  /** Standard deduction for MFJ filers in today's dollars (inflation-indexed). */
  stdDeductionMFJ: number;
  /**
   * Progressive bracket table: [topOfBracket, marginalRate].
   * Thresholds are in today's dollars and are scaled by inflationFactor at compute time.
   * null = use flat effectiveRate instead.
   */
  brackets: [number, number][] | null;
  note: string;
}

// NY 2025 brackets. Single and MFJ share the same thresholds; MFJ benefit comes from
// the larger standard deduction and doubled retirement exclusion.
const NY_BRACKETS: [number, number][] = [
  [17_150,     0.04  ],
  [23_600,     0.045 ],
  [27_900,     0.0525],
  [161_550,    0.0585],
  [323_200,    0.0625],
  [2_155_350,  0.0685],
  [Infinity,   0.0965],
];

export const STATE_PROFILES: Record<string, StateTaxProfile> = {
  NONE: {
    code: 'NONE', name: 'Exclude State Tax', effectiveRate: 0,
    retirementExempt: true, ssExempt: true,
    personalExemptionPerPerson: 0, over65ExemptionPerPerson: 0,
    retirementExemptionPerPerson: 0, stdDeductionSingle: 0, stdDeductionMFJ: 0, brackets: null,
    note: 'State income tax excluded from all calculations',
  },
  IL: {
    code: 'IL', name: 'Illinois', effectiveRate: 0.0495,
    retirementExempt: true, ssExempt: true,
    personalExemptionPerPerson: 2925, over65ExemptionPerPerson: 1000,
    retirementExemptionPerPerson: 0, stdDeductionSingle: 0, stdDeductionMFJ: 0, brackets: null,
    note: 'Flat 4.95% after $2,925/person + $1,000/person (65+) exemption (2026) · Retirement distributions and SS fully exempt · Capital gains taxed as ordinary income',
  },
  CA: {
    code: 'CA', name: 'California', effectiveRate: 0.080,
    retirementExempt: false, ssExempt: true,
    personalExemptionPerPerson: 0, over65ExemptionPerPerson: 0,
    retirementExemptionPerPerson: 0, stdDeductionSingle: 0, stdDeductionMFJ: 0, brackets: null,
    note: 'Progressive (avg ~8% at middle-high incomes, approximate) · SS exempt · Retirement distributions fully taxed',
  },
  NY: {
    code: 'NY', name: 'New York', effectiveRate: 0,
    retirementExempt: false, ssExempt: true,
    personalExemptionPerPerson: 0, over65ExemptionPerPerson: 0,
    retirementExemptionPerPerson: 20_000, stdDeductionSingle: 8_000, stdDeductionMFJ: 16_050,
    brackets: NY_BRACKETS,
    note: 'Progressive 4%–9.65% · SS exempt · $20K/person retirement exclusion · Std deduction $8K single / $16,050 MFJ (2025 law)',
  },
  TX: {
    code: 'TX', name: 'Texas', effectiveRate: 0,
    retirementExempt: true, ssExempt: true,
    personalExemptionPerPerson: 0, over65ExemptionPerPerson: 0,
    retirementExemptionPerPerson: 0, stdDeductionSingle: 0, stdDeductionMFJ: 0, brackets: null,
    note: 'No state income tax',
  },
  FL: {
    code: 'FL', name: 'Florida', effectiveRate: 0,
    retirementExempt: true, ssExempt: true,
    personalExemptionPerPerson: 0, over65ExemptionPerPerson: 0,
    retirementExemptionPerPerson: 0, stdDeductionSingle: 0, stdDeductionMFJ: 0, brackets: null,
    note: 'No state income tax',
  },
  WA: {
    code: 'WA', name: 'Washington', effectiveRate: 0,
    retirementExempt: true, ssExempt: true,
    personalExemptionPerPerson: 0, over65ExemptionPerPerson: 0,
    retirementExemptionPerPerson: 0, stdDeductionSingle: 0, stdDeductionMFJ: 0, brackets: null,
    note: 'No state income tax (excluding 7% capital-gains tax on gains above ~$262K)',
  },
  CUSTOM: {
    code: 'CUSTOM', name: 'Custom (Flat Rate)', effectiveRate: 0,
    retirementExempt: false, ssExempt: false,
    personalExemptionPerPerson: 0, over65ExemptionPerPerson: 0,
    retirementExemptionPerPerson: 0, stdDeductionSingle: 0, stdDeductionMFJ: 0, brackets: null,
    note: 'User-defined flat rate applied to all income including retirement distributions and SS',
  },
};

function applyBrackets(taxable: number, brackets: [number, number][], inflationFactor: number): number {
  let tax = 0;
  let prev = 0;
  for (const [top, rate] of brackets) {
    if (taxable <= prev) break;
    const cap = top === Infinity ? Infinity : top * inflationFactor;
    tax += Math.min(taxable - prev, cap - prev) * rate;
    prev = cap;
  }
  return tax;
}

/**
 * Compute state tax.
 * @param numPersons  1 = single/survivor, 2 = MFJ couple.
 * @param numOver65   Number of taxpayers aged 65+ (IL additional exemption).
 * @param inflationFactor  Cumulative inflation from plan start; scales all nominal thresholds.
 */
export function stateTax(
  state: string,
  nonExemptOrdinaryIncome: number,
  retirementDistributions = 0,
  numPersons = 1,
  inflationFactor = 1,
  numOver65 = 0,
  customRate?: number,
  ssIncome = 0,
): number {
  const profile = STATE_PROFILES[state];
  if (!profile) return 0;

  const effectiveRate = state === 'CUSTOM' ? (customRate ?? 0) : profile.effectiveRate;
  if (!profile.brackets && effectiveRate === 0) return 0;

  const isMFJ = numPersons >= 2;
  const stateSS = profile.ssExempt ? 0 : ssIncome;

  // Per-person retirement exclusion (NY: $20K × numPersons before applying brackets).
  const retExclusion = profile.retirementExemptionPerPerson * numPersons * inflationFactor;
  const taxableRetirement = profile.retirementExempt
    ? 0
    : Math.max(0, retirementDistributions - retExclusion);

  const grossIncome = nonExemptOrdinaryIncome + stateSS + taxableRetirement;

  // Standard deduction (NY-style, filing-status based).
  const stdDed = (isMFJ ? profile.stdDeductionMFJ : profile.stdDeductionSingle) * inflationFactor;

  // Per-person exemption (IL-style).
  const personalExemption = (
    profile.personalExemptionPerPerson * numPersons +
    profile.over65ExemptionPerPerson * numOver65
  ) * inflationFactor;

  const taxable = Math.max(0, grossIncome - stdDed - personalExemption);
  if (taxable <= 0) return 0;

  if (profile.brackets) {
    return applyBrackets(taxable, profile.brackets, inflationFactor);
  }
  return taxable * effectiveRate;
}

export function listStates(): StateTaxProfile[] {
  const [none, ...rest] = [STATE_PROFILES.NONE, ...Object.values(STATE_PROFILES).filter((s) => s.code !== 'NONE').sort((a, b) => a.name.localeCompare(b.name))];
  return [none, ...rest];
}
