import { describe, it, expect } from 'vitest';
import { householdSS } from './socialSecurity';
import { annualSSBenefit, benefitFactor } from './ssActuarial';

describe('ssActuarial', () => {
  it('FRA factor of 1.0 at age 67', () => {
    expect(benefitFactor(67)).toBe(1.0);
  });
  it('25% delayed credit at age 70', () => {
    expect(benefitFactor(70)).toBe(1.24);
  });
  it('30% early reduction at age 62', () => {
    expect(benefitFactor(62)).toBe(0.70);
  });
  it('no benefit before claim age', () => {
    expect(annualSSBenefit(40000, 67, 60)).toBe(0);
  });
  it('full benefit at claim age', () => {
    expect(annualSSBenefit(40000, 67, 67)).toBeCloseTo(40000, 0);
  });
});

describe('householdSS', () => {
  it('both alive, both claiming = sum', () => {
    const r = householdSS({
      piaA: 40000, claimAgeA: 67, ageA: 70, aliveA: true,
      piaB: 30000, claimAgeB: 67, ageB: 68, aliveB: true,
      inflationFactor: 1,
    });
    expect(r.total).toBeCloseTo(70000, 0);
  });

  it('B dies → A keeps larger benefit', () => {
    const r = householdSS({
      piaA: 30000, claimAgeA: 67, ageA: 75, aliveA: true,
      piaB: 50000, claimAgeB: 67, ageB: 73, aliveB: false,
      inflationFactor: 1,
    });
    expect(r.total).toBeCloseTo(50000, 0); // B's larger
  });

  it('inflation factor compounds COLA', () => {
    const r = householdSS({
      piaA: 40000, claimAgeA: 67, ageA: 67, aliveA: true,
      inflationFactor: 1.5,
    });
    expect(r.ssA).toBeCloseTo(60000, 0);
  });
});
