import { describe, it, expect } from 'vitest';
import { rmdDivisor, requiredMinDistribution, rmdStartAgeForDob } from './rmd';

describe('rmdStartAgeForDob', () => {
  it('born before July 1 1949 → 70', () => expect(rmdStartAgeForDob('1948-12-31')).toBe(70));
  it('born June 30 1949 → 70', () => expect(rmdStartAgeForDob('1949-06-30')).toBe(70));
  it('born July 1 1949 → 72', () => expect(rmdStartAgeForDob('1949-07-01')).toBe(72));
  it('born Dec 31 1950 → 72', () => expect(rmdStartAgeForDob('1950-12-31')).toBe(72));
  it('born Jan 1 1951 → 73', () => expect(rmdStartAgeForDob('1951-01-01')).toBe(73));
  it('born Dec 31 1959 → 73', () => expect(rmdStartAgeForDob('1959-12-31')).toBe(73));
  it('born Jan 1 1960 → 75', () => expect(rmdStartAgeForDob('1960-01-01')).toBe(75));
  it('born 1974 → 75', () => expect(rmdStartAgeForDob('1974-05-03')).toBe(75));
});

describe('rmdDivisor', () => {
  it('age 75 = 24.6', () => expect(rmdDivisor(75)).toBe(24.6));
  it('age 80 = 20.2', () => expect(rmdDivisor(80)).toBe(20.2));
  it('age 90 = 12.2', () => expect(rmdDivisor(90)).toBe(12.2));
  it('age 100 = 6.4', () => expect(rmdDivisor(100)).toBe(6.4));
  it('age 87 (between table entries) uses age 87 directly', () => expect(rmdDivisor(87)).toBe(14.4));
  it('age below 73 returns Infinity (no RMD)', () => expect(rmdDivisor(50)).toBe(Infinity));
});

describe('requiredMinDistribution', () => {
  it('zero before RMD start age', () => {
    expect(requiredMinDistribution(70, 1_000_000)).toBe(0);
  });

  it('$1M at age 75 → ~$40,650', () => {
    expect(requiredMinDistribution(75, 1_000_000)).toBeCloseTo(1_000_000 / 24.6, 0);
  });

  it('zero with zero balance', () => {
    expect(requiredMinDistribution(80, 0)).toBe(0);
  });
});
