import { describe, it, expect } from 'vitest';
import { federalOrdinaryTax, standardDeduction, yearFederalTax } from './tax';

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

describe('yearFederalTax', () => {
  it('LTCG taxed at 15%', () => {
    const out = yearFederalTax({
      filingStatus: 'MFJ', inflationFactor: 1,
      ordinaryIncome: 0, ltcgIncome: 10000, standardDeduction: 31500,
    });
    expect(out.fedTax).toBeCloseTo(1500, 0);
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
