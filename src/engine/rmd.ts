import { RMD_DIVISORS } from './taxConstants';

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
