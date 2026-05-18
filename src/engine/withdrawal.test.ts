import { describe, it, expect } from 'vitest';
import { applyWithdrawalOrder } from './withdrawal';

const base = {
  gap: 100_000,
  taxable: 500_000,
  traditional: 500_000,
  roth: 500_000,
  rmd: 0,
  ssA: 0, ssB: 0,
  ssTaxablePct: 0.85,
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

  it('bracketfill fills 12% bracket with traditional', () => {
    const r = applyWithdrawalOrder({ ...base, strategy: 'bracketfill', gap: 200_000 });
    // 12% bracket top = $96,950; with $31,500 std deduction, room is ~$65,450
    expect(r.wdTrd).toBeCloseTo(96950 - 31500, -2);
    expect(r.wdRth).toBeGreaterThan(0);
  });
});
