import { describe, it, expect } from 'vitest';
import { federalOrdinaryTax, standardDeduction, yearFederalTax, taxableSocialSecurity } from './tax';
import {
  FED_BRACKETS_MFJ, FED_BRACKETS_SINGLE,
  STANDARD_DEDUCTION_MFJ, STANDARD_DEDUCTION_SINGLE,
  SENIOR_ADDON_MFJ, SENIOR_ADDON_SINGLE,
  LTCG_BRACKETS_MFJ,
} from './taxConstants';

const MFJ_10 = FED_BRACKETS_MFJ[0][0];   // top of 10% bracket, MFJ
const MFJ_12 = FED_BRACKETS_MFJ[1][0];   // top of 12% bracket, MFJ
const MFJ_22 = FED_BRACKETS_MFJ[2][0];   // top of 22% bracket, MFJ
const SGL_10 = FED_BRACKETS_SINGLE[0][0]; // top of 10% bracket, Single
const LTCG_0_MFJ = LTCG_BRACKETS_MFJ[0][0]; // top of 0% LTCG bracket, MFJ

describe('federalOrdinaryTax MFJ 2026', () => {
  it('zero on zero income', () => {
    expect(federalOrdinaryTax(0, 'MFJ', 1)).toBe(0);
  });

  it('full 10% bracket at ceiling', () => {
    // 10% × MFJ_10
    expect(federalOrdinaryTax(MFJ_10, 'MFJ', 1)).toBeCloseTo(MFJ_10 * 0.10, 0);
  });

  it('through 12% bracket at ceiling', () => {
    // 10%×MFJ_10 + 12%×(MFJ_12 - MFJ_10)
    const expected = MFJ_10 * 0.10 + (MFJ_12 - MFJ_10) * 0.12;
    expect(federalOrdinaryTax(MFJ_12, 'MFJ', 1)).toBeCloseTo(expected, 0);
  });

  it('through 22% bracket at ceiling', () => {
    // tax at MFJ_12 + 22%×(MFJ_22 - MFJ_12)
    const taxAt12 = MFJ_10 * 0.10 + (MFJ_12 - MFJ_10) * 0.12;
    const expected = taxAt12 + (MFJ_22 - MFJ_12) * 0.22;
    expect(federalOrdinaryTax(MFJ_22, 'MFJ', 1)).toBeCloseTo(expected, 0);
  });

  it('inflation indexes brackets', () => {
    // At inflF=2, $20k is still well within 10% bracket
    expect(federalOrdinaryTax(20000, 'MFJ', 2)).toBeCloseTo(2000, 0);
  });
});

describe('federalOrdinaryTax Single 2026', () => {
  it('full 10% bracket at ceiling', () => {
    // 10% × SGL_10
    expect(federalOrdinaryTax(SGL_10, 'Single', 1)).toBeCloseTo(SGL_10 * 0.10, 0);
  });

  it('Single brackets narrower than MFJ', () => {
    const singleTax = federalOrdinaryTax(100000, 'Single', 1);
    const mfjTax = federalOrdinaryTax(100000, 'MFJ', 1);
    expect(singleTax).toBeGreaterThan(mfjTax);
  });
});

describe('standardDeduction', () => {
  it('MFJ base', () => {
    expect(standardDeduction('MFJ', 50, 50, 1)).toBeCloseTo(STANDARD_DEDUCTION_MFJ, 0);
  });

  it('MFJ both 65+ adds 2 × senior add-on', () => {
    expect(standardDeduction('MFJ', 70, 68, 1)).toBeCloseTo(STANDARD_DEDUCTION_MFJ + 2 * SENIOR_ADDON_MFJ, 0);
  });

  it('MFJ only one 65+ adds 1 × senior add-on', () => {
    expect(standardDeduction('MFJ', 70, 60, 1)).toBeCloseTo(STANDARD_DEDUCTION_MFJ + SENIOR_ADDON_MFJ, 0);
  });

  it('Single 65+ = base + senior add-on', () => {
    expect(standardDeduction('Single', 70, undefined, 1)).toBeCloseTo(STANDARD_DEDUCTION_SINGLE + SENIOR_ADDON_SINGLE, 0);
  });

  it('scales by inflation factor', () => {
    expect(standardDeduction('MFJ', 50, 50, 1.5)).toBeCloseTo(STANDARD_DEDUCTION_MFJ * 1.5, 0);
  });
});

describe('yearFederalTax — LTCG stacked brackets', () => {
  it('LTCG in 0% bracket when ordinary income is low (MFJ)', () => {
    // ordIncome=0, ltcg stacks from 0 → all in 0% bracket
    const out = yearFederalTax({
      filingStatus: 'MFJ', inflationFactor: 1,
      ordinaryIncome: 0, ltcgIncome: 10000, standardDeduction: 31500,
    });
    expect(out.fedTax).toBe(0);
  });

  it('LTCG spills into 15% bracket when stacked income exceeds 0% threshold', () => {
    // taxableOrdinary = max(0, 100000 - 31500) = 68500
    // 0% LTCG room = max(0, LTCG_0_MFJ - 68500)
    // ordTax = 10%×MFJ_10 + 12%×(68500 - MFJ_10)
    const taxableOrd = 100000 - 31500;
    const ltcgRoom = Math.max(0, LTCG_0_MFJ - taxableOrd);
    const ltcgSpill = 40000 - ltcgRoom;
    const ordTax = MFJ_10 * 0.10 + (taxableOrd - MFJ_10) * 0.12;
    const out = yearFederalTax({
      filingStatus: 'MFJ', inflationFactor: 1,
      ordinaryIncome: 100000, ltcgIncome: 40000, standardDeduction: 31500,
    });
    expect(out.fedTax).toBeCloseTo(ordTax + ltcgSpill * 0.15, 0);
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
    expect(taxableSocialSecurity(500000, 40000, 'MFJ')).toBeCloseTo(34000, 0);
  });

  it('Single has lower thresholds ($25k base, $34k upper)', () => {
    expect(taxableSocialSecurity(25000, 20000, 'Single')).toBe(0);
    expect(taxableSocialSecurity(30000, 20000, 'Single')).toBeCloseTo(2500, 0);
  });
});
