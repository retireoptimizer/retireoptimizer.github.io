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

// Temporary senior bonus deduction (OBBBA, tax years 2025–2028). Thresholds are fixed by law.
export const SENIOR_BONUS_PER_PERSON = 6_000;
export const SENIOR_BONUS_FIRST_YEAR = 2025;
export const SENIOR_BONUS_LAST_YEAR = 2028;
export const SENIOR_BONUS_PHASEOUT_START_SINGLE = 75_000;
export const SENIOR_BONUS_PHASEOUT_START_MFJ = 150_000;
export const SENIOR_BONUS_PHASEOUT_RATE = 0.06;

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
// Retained for reference; no longer used in projection.ts (superseded by per-plan taxableBasis tracking).
export const TAXABLE_BASIS_PCT = 0.5;

// IRA contribution limits (IRC §219(b), 2026). Both the base limit and — since SECURE 2.0
// §108 — the age-50 catch-up are inflation-indexed, so the engine grows both by CPI.
// Used to cap spousal IRA contributions (§219(c)) for a retired spouse whose partner still works.
export const IRA_CONTRIB_LIMIT = 7_500;
export const IRA_CATCHUP = 1_100;
export const IRA_CATCHUP_AGE = 50;

// NIIT (IRC §1411) — 3.8% on lesser of NII or MAGI above threshold.
// Thresholds are NOT inflation-indexed (frozen since 2013, like SS provisional thresholds).
export const NIIT_RATE = 0.038;
export const NIIT_THRESHOLD_MFJ = 250_000;
export const NIIT_THRESHOLD_SINGLE = 200_000;

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

// IRMAA 2026 MAGI thresholds → per-person monthly surcharges for Part B and Part D (CMS/SSA POMS 2026).
// Part B and Part D use identical MAGI boundaries; surcharge dollar amounts are CMS-set annually.
// Thresholds are inflation-indexed at usage time (first 4 tiers CPI-adjusted annually; top tier
// frozen until 2028 per SECURE 2.0, but we project it with CPI as a conservative approximation).
export const IRMAA_TIERS_MFJ: ReadonlyArray<{ magiTop: number; partB: number; partD: number }> = [
  { magiTop: 218000, partB:   0.00, partD:  0.00 },
  { magiTop: 274000, partB:  81.20, partD: 14.50 },
  { magiTop: 342000, partB: 202.90, partD: 37.50 },
  { magiTop: 410000, partB: 324.60, partD: 60.40 },
  { magiTop: 750000, partB: 446.30, partD: 83.30 },
  { magiTop: Infinity, partB: 487.00, partD: 91.00 },
];
export const IRMAA_TIERS_SINGLE: ReadonlyArray<{ magiTop: number; partB: number; partD: number }> = [
  { magiTop: 109000, partB:   0.00, partD:  0.00 },
  { magiTop: 137000, partB:  81.20, partD: 14.50 },
  { magiTop: 171000, partB: 202.90, partD: 37.50 },
  { magiTop: 205000, partB: 324.60, partD: 60.40 },
  { magiTop: 500000, partB: 446.30, partD: 83.30 },
  { magiTop: Infinity, partB: 487.00, partD: 91.00 },
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

/**
 * SECURE Act 10-year rule: an inherited IRA/Roth must be empty by Dec 31 of the 10th year after
 * the year of death. ev.age is the beneficiary's age in the year of death (year 0), so the open
 * window is years 0..10 (11 calendar years) and year 10 is the deadline year.
 */
export const INHERITED_DEADLINE_YEARS = 10;

/**
 * IRS Single Life Table (26 CFR 1.401(a)(9)-9(b), effective 2022). Index = age; last entry is 120+.
 * Used for annual RMDs from an inherited IRA when the original owner had reached their RMD start age.
 */
export const SINGLE_LIFE_TABLE: readonly number[] = [
  84.6, 83.7, 82.8, 81.8, 80.8, 79.8, 78.8, 77.9, 76.9, 75.9, // 0-9
  74.9, 73.9, 72.9, 71.9, 70.9, 69.9, 69.0, 68.0, 67.0, 66.0, // 10-19
  65.0, 64.1, 63.1, 62.1, 61.1, 60.2, 59.2, 58.2, 57.3, 56.3, // 20-29
  55.3, 54.4, 53.4, 52.5, 51.5, 50.5, 49.6, 48.6, 47.7, 46.7, // 30-39
  45.7, 44.8, 43.8, 42.9, 41.9, 41.0, 40.0, 39.0, 38.1, 37.1, // 40-49
  36.2, 35.3, 34.3, 33.4, 32.5, 31.6, 30.6, 29.8, 28.9, 28.0, // 50-59
  27.1, 26.2, 25.4, 24.5, 23.7, 22.9, 22.0, 21.2, 20.4, 19.6, // 60-69
  18.8, 18.0, 17.2, 16.4, 15.6, 14.8, 14.1, 13.3, 12.6, 11.9, // 70-79
  11.2, 10.5, 9.9, 9.3, 8.7, 8.1, 7.6, 7.1, 6.6, 6.1, // 80-89
  5.7, 5.3, 4.9, 4.6, 4.3, 4.0, 3.7, 3.4, 3.2, 3.0, // 90-99
  2.8, 2.6, 2.5, 2.3, 2.2, 2.1, 2.1, 2.1, 2.0, 2.0, // 100-109
  2.0, 2.0, 2.0, 1.9, 1.9, 1.8, 1.8, 1.6, 1.4, 1.1, // 110-119
  1.0, // 120-120
];
