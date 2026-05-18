// 2025 federal tax constants. Values match prototype's solveYearTax.
// All dollar thresholds are inflation-indexed at usage time (multiplied by inflF).

export const TAX_YEAR = 2025;

// 2025 Federal MFJ brackets — (upper bound, rate). Top bracket is open-ended.
export const FED_BRACKETS_MFJ: ReadonlyArray<readonly [number, number]> = [
  [23850, 0.10],
  [96950, 0.12],
  [206700, 0.22],
  [394600, 0.24],
  [501050, 0.32],
  [751600, 0.35],
  [Infinity, 0.37],
];

// 2025 Single brackets (surviving spouse after MFJ years)
export const FED_BRACKETS_SINGLE: ReadonlyArray<readonly [number, number]> = [
  [11925, 0.10],
  [48475, 0.12],
  [103350, 0.22],
  [197300, 0.24],
  [250525, 0.32],
  [626350, 0.35],
  [Infinity, 0.37],
];

export const STANDARD_DEDUCTION_MFJ = 31500;
export const STANDARD_DEDUCTION_SINGLE = 15750;
export const SENIOR_ADDON_MFJ = 1600; // per qualifying spouse 65+
export const SENIOR_ADDON_SINGLE = 2000;

// LTCG simplified — flat 15% (most retirees in the middle bracket).
export const LTCG_RATE = 0.15;

// Taxable basis assumption for taxable-account withdrawals (50% basis / 50% gain).
export const TAXABLE_BASIS_PCT = 0.5;

// SS taxability — 85% of benefits taxable (high-income retirees).
export const SS_TAXABLE_PCT = 0.85;

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

// IRMAA 2025 MFJ MAGI thresholds → per-person monthly Part B surcharge
// (per-spouse annual when both 65+, so the per-spouse multiplier handles it).
export const IRMAA_TIERS_MFJ_2025: ReadonlyArray<{ magiTop: number; monthlyPerPerson: number }> = [
  { magiTop: 212000, monthlyPerPerson: 0 },
  { magiTop: 266000, monthlyPerPerson: 74.0 },
  { magiTop: 334000, monthlyPerPerson: 185.0 },
  { magiTop: 400000, monthlyPerPerson: 295.9 },
  { magiTop: 750000, monthlyPerPerson: 406.9 },
  { magiTop: Infinity, monthlyPerPerson: 443.9 },
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
