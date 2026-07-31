import { describe, it, expect } from 'vitest';
import { applyWithdrawalOrder } from './withdrawal';
import { FED_BRACKETS_MFJ } from './taxConstants';

const MFJ_12 = FED_BRACKETS_MFJ[1][0];

const base = {
  gap: 100_000,
  taxable: 500_000,
  traditional: 500_000,
  roth: 500_000,
  rmd: 0,
  baseOrdinaryIncome: 0,
  bracketCeiling: MFJ_12,
  stdD: 31500,
  inflationFactor: 1,
};

describe('applyWithdrawalOrder', () => {
  it('taxfirst pulls 100% from taxable', () => {
    const r = applyWithdrawalOrder({ ...base, strategy: 'taxfirst' });
    expect(r.wdTax).toBeCloseTo(100_000, 0);
    expect(r.wdTrd).toBe(0);
    expect(r.wdRth).toBe(0);
  });

  it('rothfirst pulls from roth first', () => {
    const r = applyWithdrawalOrder({ ...base, strategy: 'rothfirst' });
    expect(r.wdRth).toBeCloseTo(100_000, 0);
  });

  it('proportional roughly thirds when buckets equal', () => {
    const r = applyWithdrawalOrder({ ...base, strategy: 'proportional' });
    expect(r.wdTax + r.wdTrd + r.wdRth).toBeCloseTo(100_000, 0);
    expect(r.wdTax).toBeCloseTo(100_000 / 3, -2);
  });

  it('spills over when first bucket runs dry (taxfirst)', () => {
    const r = applyWithdrawalOrder({ ...base, strategy: 'taxfirst', taxable: 30_000, gap: 100_000 });
    expect(r.wdTax).toBeCloseTo(30_000, 0);
    expect(r.wdTrd).toBeCloseTo(70_000, 0);
  });

  it('bracketfill fills bracket with traditional up to ceiling minus std deduction', () => {
    const r = applyWithdrawalOrder({ ...base, strategy: 'bracketfill', gap: 200_000 });
    // ceiling MFJ_12 − std deduction $31,500 − baseOrdinaryIncome $0
    expect(r.wdTrd).toBeCloseTo(MFJ_12 - 31500, -2);
    expect(r.wdRth).toBeGreaterThan(0);
  });
});
