import { describe, it, expect } from 'vitest';
import { federalOrdinaryTax, standardDeduction, yearFederalTax, taxableSocialSecurity } from './tax';

describe('federalOrdinaryTax MFJ 2025', () => {
  it('zero on zero income', () => {
    expect(federalOrdinaryTax(0, 'MFJ', 1)).toBe(0);
  });

  it('full 10% bracket at $23,850', () => {
    // 10% of 23,850 = 2,385
    expect(federalOrdinaryTax(23850, 'MFJ', 1)).toBeCloseTo(2385, 0);
  });

  it('through 12% bracket at $96,950', () => {
    // 10%*23,850 + 12%*(96,950-23,850) = 2,385 + 8,772 = 11,157
    expect(federalOrdinaryTax(96950, 'MFJ', 1)).toBeCloseTo(11157, 0);
  });

  it('through 22% bracket at $206,700', () => {
    // 11,157 + 22% * (206,700-96,950) = 11,157 + 24,145 = 35,302
    expect(federalOrdinaryTax(206700, 'MFJ', 1)).toBeCloseTo(35302, 0);
  });

  it('inflation indexes brackets', () => {
    // At inflF=2, $20k is still well within 10% bracket (which now extends to $47,700)
    expect(federalOrdinaryTax(20000, 'MFJ', 2)).toBeCloseTo(2000, 0);
  });
});

describe('federalOrdinaryTax Single 2025', () => {
  it('full 10% bracket at $11,925', () => {
    expect(federalOrdinaryTax(11925, 'Single', 1)).toBeCloseTo(1192.5, 0);
  });

  it('Single brackets narrower than MFJ', () => {
    const singleTax = federalOrdinaryTax(100000, 'Single', 1);
    const mfjTax = federalOrdinaryTax(100000, 'MFJ', 1);
    expect(singleTax).toBeGreaterThan(mfjTax);
  });
});

describe('standardDeduction', () => {
  it('MFJ base = $31,500', () => {
    expect(standardDeduction('MFJ', 50, 50, 1)).toBeCloseTo(31500, 0);
  });

  it('MFJ both 65+ adds $3,200', () => {
    expect(standardDeduction('MFJ', 70, 68, 1)).toBeCloseTo(31500 + 3200, 0);
  });

  it('MFJ only one 65+ adds $1,600', () => {
    expect(standardDeduction('MFJ', 70, 60, 1)).toBeCloseTo(33100, 0);
  });

  it('Single 65+ = $15,750 + $2,000', () => {
    expect(standardDeduction('Single', 70, undefined, 1)).toBeCloseTo(17750, 0);
  });

  it('scales by inflation factor', () => {
    expect(standardDeduction('MFJ', 50, 50, 1.5)).toBeCloseTo(31500 * 1.5, 0);
  });
});

describe('yearFederalTax — LTCG stacked brackets', () => {
  it('LTCG in 0% bracket when ordinary income is low (MFJ)', () => {
    // ordIncome=0, taxableOrdinary=0, ltcg stacks from 0 → all in 0% bracket (<$94,050)
    const out = yearFederalTax({
      filingStatus: 'MFJ', inflationFactor: 1,
      ordinaryIncome: 0, ltcgIncome: 10000, standardDeduction: 31500,
    });
    expect(out.fedTax).toBe(0);
  });

  it('LTCG spills into 15% bracket when stacked income exceeds 0% threshold', () => {
    // taxableOrdinary = max(0, 90000 - 31500) = 58500
    // 0% LTCG room = max(0, 94050 - 58500) = 35550
    // LTCG in 0%: 35550; LTCG in 15%: 40000 - 35550 = 4450
    // ordTax = 10%*23850 + 12%*(58500-23850) = 2385 + 4158 = 6543
    // ltcgTax = 4450 * 0.15 = 667.50
    const out = yearFederalTax({
      filingStatus: 'MFJ', inflationFactor: 1,
      ordinaryIncome: 90000, ltcgIncome: 40000, standardDeduction: 31500,
    });
    expect(out.fedTax).toBeCloseTo(6543 + 667.5, 0);
  });

  it('ordinary income below std deduction → no ordinary tax', () => {
    const out = yearFederalTax({
      filingStatus: 'MFJ', inflationFactor: 1,
      ordinaryIncome: 25000, ltcgIncome: 0, standardDeduction: 31500,
    });
    expect(out.fedTax).toBe(0);
  });

  it('combined effective rate computed', () => {
    const out = yearFederalTax({
      filingStatus: 'MFJ', inflationFactor: 1,
      ordinaryIncome: 100000, ltcgIncome: 20000, standardDeduction: 31500,
    });
    expect(out.effRate).toBeGreaterThan(0);
    expect(out.effRate).toBeLessThan(0.25);
  });
});

describe('taxableSocialSecurity (IRC §86)', () => {
  it('zero when provisional income ≤ base (MFJ $32k)', () => {
    expect(taxableSocialSecurity(30000, 20000, 'MFJ')).toBe(0);
  });

  it('50% tier: PI between base and upper (MFJ $32k–$44k)', () => {
    // PI = 38000, base = 32000 → 50% of (38000-32000) = 3000, capped at 50% of 20000 = 10000
    expect(taxableSocialSecurity(38000, 20000, 'MFJ')).toBeCloseTo(3000, 0);
  });

  it('50% tier capped at 50% of SS', () => {
    // PI = 44000, base = 32000 → 50% of (44000-32000)=6000, but SS=5000 → cap at 0.5*5000=2500
    expect(taxableSocialSecurity(44000, 5000, 'MFJ')).toBeCloseTo(2500, 0);
  });

  it('85% tier: PI above upper (MFJ $44k)', () => {
    // PI = 60000: tier1 = min(0.5*(44000-32000), 0.5*24000) = min(6000,12000) = 6000
    // tier2 = 0.85*(60000-44000) = 13600; total = min(0.85*24000, 6000+13600) = min(20400, 19600) = 19600
    expect(taxableSocialSecurity(60000, 24000, 'MFJ')).toBeCloseTo(19600, 0);
  });

  it('caps at 85% of gross SS', () => {
    // High PI: should never exceed 85% of SS
    expect(taxableSocialSecurity(500000, 40000, 'MFJ')).toBeCloseTo(34000, 0);
  });

  it('Single has lower thresholds ($25k base, $34k upper)', () => {
    // PI = 25000: exactly at base → 0
    expect(taxableSocialSecurity(25000, 20000, 'Single')).toBe(0);
    // PI = 30000: 50% of (30000-25000)=2500
    expect(taxableSocialSecurity(30000, 20000, 'Single')).toBeCloseTo(2500, 0);
  });
});
