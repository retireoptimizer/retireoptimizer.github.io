// 2026 federal tax constants (Rev Proc 2025-32; OBBBA-permanent rate structure).
// All dollar thresholds are inflation-indexed at usage time (multiplied by inflF).

export const TAX_YEAR = 2026;

// 2026 Federal MFJ brackets — (upper bound, rate). Top bracket is open-ended.
export const FED_BRACKETS_MFJ: ReadonlyArray<readonly [number, number]> = [
  [24800,  0.10],
  [100800, 0.12],
  [211400, 0.22],
  [403550, 0.24],
  [512450, 0.32],
  [768700, 0.35],
  [Infinity, 0.37],
];

// 2026 Single brackets (surviving spouse after MFJ years)
export const FED_BRACKETS_SINGLE: ReadonlyArray<readonly [number, number]> = [
  [12400,  0.10],
  [50400,  0.12],
  [105700, 0.22],
  [201775, 0.24],
  [256225, 0.32],
  [640600, 0.35],
  [Infinity, 0.37],
];

export const STANDARD_DEDUCTION_MFJ = 32200;
export const STANDARD_DEDUCTION_SINGLE = 16100;
export const SENIOR_ADDON_MFJ = 1650; // per qualifying spouse 65+ (2026, inflation-adjusted)
export const SENIOR_ADDON_SINGLE = 2050;

// LTCG simplified — flat 15% (legacy; replaced by stacked brackets in yearFederalTax).
export const LTCG_RATE = 0.15;

// 2026 LTCG / qualified-dividend rate brackets (taxable income = ordinary + LTCG stacked).
// Inflation-indexed at usage time (multiplied by inflF).
export const LTCG_BRACKETS_MFJ: ReadonlyArray<readonly [number, number]> = [
  [98900,   0.00],
  [613700,  0.15],
  [Infinity, 0.20],
];
export const LTCG_BRACKETS_SINGLE: ReadonlyArray<readonly [number, number]> = [
  [49450,   0.00],
  [545500,  0.15],
  [Infinity, 0.20],
];

// Taxable basis assumption for taxable-account withdrawals (50% basis / 50% gain).
export const TAXABLE_BASIS_PCT = 0.5;

// SS taxability — 85% flat (legacy constant; used only for withdrawal-sizing in applyWithdrawalOrder).
// Actual taxable fraction is computed per-year via taxableSocialSecurity() in tax.ts.
export const SS_TAXABLE_PCT = 0.85;

// SS provisional income thresholds (IRC §86) — NOT inflation-indexed (frozen since 1983).
export const SS_PROVISIONAL_BASE_MFJ = 32000;
export const SS_PROVISIONAL_UPPER_MFJ = 44000;
export const SS_PROVISIONAL_BASE_SINGLE = 25000;
export const SS_PROVISIONAL_UPPER_SINGLE = 34000;

// ACA Federal Poverty Level 2026 (48 contiguous states + DC; HHS, effective Jan 14 2026).
export const FPL_BASE = 15960;     // 1-person household
export const FPL_INCREMENT = 5680; // per additional person

// ACA applicable percentage bands for 2026 (IRS Rev. Proc. 2025-25).
// Each entry: [fplLow, fplHigh, pctLow, pctHigh] — linearly interpolated within each band.
// Above 400% FPL: ARP/IRA enhanced subsidies expired Dec 31 2025 — cliff is restored, no APTC.
export const ACA_PCT_BANDS: ReadonlyArray<readonly [number, number, number, number]> = [
  [1.00, 1.33, 0.0210, 0.0210],
  [1.33, 1.50, 0.0314, 0.0419],
  [1.50, 2.00, 0.0419, 0.0660],
  [2.00, 2.50, 0.0660, 0.0844],
  [2.50, 3.00, 0.0844, 0.0996],
  [3.00, 4.00, 0.0996, 0.0996],
];

// IRS Uniform Lifetime Table (subset used by prototype).
export const RMD_DIVISORS: Readonly<Record<number, number>> = {
  73: 26.5, 74: 25.5,
  75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
  80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8, 85: 16.0,
  86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9,
  90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5,
  95: 8.9, 96: 8.4, 97: 7.8, 98: 7.3, 99: 6.8,
  100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9,
  105: 4.6,
};

// IRMAA 2026 MAGI thresholds → per-person monthly Part B surcharge (CMS 2026).
// Thresholds inflation-indexed at usage time; surcharge dollar amounts are CMS-set annually (not inflation-formulas).
// Single-filer thresholds are roughly half of MFJ at each tier boundary.
export const IRMAA_TIERS_MFJ: ReadonlyArray<{ magiTop: number; monthlyPerPerson: number }> = [
  { magiTop: 218000, monthlyPerPerson:   0.00 },
  { magiTop: 274000, monthlyPerPerson:  81.20 },
  { magiTop: 342000, monthlyPerPerson: 202.90 },
  { magiTop: 410000, monthlyPerPerson: 324.60 },
  { magiTop: 750000, monthlyPerPerson: 446.30 },
  { magiTop: Infinity, monthlyPerPerson: 487.00 },
];
export const IRMAA_TIERS_SINGLE: ReadonlyArray<{ magiTop: number; monthlyPerPerson: number }> = [
  { magiTop: 109000, monthlyPerPerson:   0.00 },
  { magiTop: 137000, monthlyPerPerson:  81.20 },
  { magiTop: 171000, monthlyPerPerson: 202.90 },
  { magiTop: 205000, monthlyPerPerson: 324.60 },
  { magiTop: 500000, monthlyPerPerson: 446.30 },
  { magiTop: Infinity, monthlyPerPerson: 487.00 },
];

// Illinois flat income-tax rate (4.95%). Retirement income (401k/IRA/Roth/SS/pension) is exempt.
export const IL_TAX_RATE = 0.0495;

// SSA actuarial table — benefit as multiple of PIA at each claim age, for FRA = 67.
// For early claim: 5/9% per month for first 36 months early, 5/12% beyond.
// For delayed claim: 8% per year credit, prorated monthly.
// We supply integer-age factors used by the prototype.
export const SS_FACTORS_FRA67: Readonly<Record<number, number>> = {
  62: 0.70, 63: 0.75, 64: 0.80, 65: 0.866, 66: 0.933,
  67: 1.00, 68: 1.08, 69: 1.16, 70: 1.24,
};
