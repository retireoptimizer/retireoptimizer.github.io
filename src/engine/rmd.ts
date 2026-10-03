import { RMD_DIVISORS, SINGLE_LIFE_TABLE } from './taxConstants';

const SORTED_AGES = Object.keys(RMD_DIVISORS).map(Number).sort((a, b) => a - b);

/** Statutory RMD start age derived from date of birth per SECURE Act / SECURE 2.0. */
export function rmdStartAgeForDob(dob: string): number {
  const [y, m, d] = dob.split('-').map(Number);
  const born = new Date(y, m - 1, d);
  if (born < new Date(1949, 6, 1))  return 70; // before July 1, 1949 (pre-SECURE)
  if (born <= new Date(1950, 11, 31)) return 72; // Jul 1 1949 – Dec 31 1950 (SECURE 1.0)
  if (born <= new Date(1959, 11, 31)) return 73; // Jan 1 1951 – Dec 31 1959 (SECURE 2.0)
  return 75;                                      // Jan 1 1960+ (SECURE 2.0)
}

/** Lookup the Uniform Lifetime divisor for a given age. Steps down across ages. */
export function rmdDivisor(age: number): number {
  if (age < SORTED_AGES[0]) return Infinity;
  let div = RMD_DIVISORS[SORTED_AGES[0]];
  for (const a of SORTED_AGES) {
    if (age >= a) div = RMD_DIVISORS[a];
    else break;
  }
  return div;
}

/** RMD = traditional balance / divisor. Zero if below RMD start age. */
export function requiredMinDistribution(
  age: number,
  traditionalBalance: number,
  rmdStartAge = 75,
): number {
  if (age < rmdStartAge) return 0;
  if (traditionalBalance <= 0) return 0;
  return traditionalBalance / rmdDivisor(age);
}

/** Single Life Table expectancy for a beneficiary's age (120+ uses the last entry). */
export function singleLifeExpectancy(age: number): number {
  return SINGLE_LIFE_TABLE[Math.max(0, Math.min(age, SINGLE_LIFE_TABLE.length - 1))];
}

/**
 * Divisor for the annual RMD from an inherited IRA whose owner had reached their RMD start age.
 * Set from the beneficiary's age in the year after death, then reduced by 1 each year (not
 * recalculated). Applies in years 1..9 after death; year 10 is the full-distribution deadline.
 * Uses the beneficiary's expectancy only. The rule allows the owner's remaining expectancy when
 * longer (owner younger than beneficiary); ignoring it can only raise the RMD.
 */
export function inheritedRmdDivisor(ageInDeathYear: number, yearsElapsed: number): number {
  return Math.max(1, singleLifeExpectancy(ageInDeathYear + 1) - (yearsElapsed - 1));
}
