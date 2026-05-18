import { RMD_DIVISORS } from './taxConstants';

const SORTED_AGES = Object.keys(RMD_DIVISORS).map(Number).sort((a, b) => a - b);

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
