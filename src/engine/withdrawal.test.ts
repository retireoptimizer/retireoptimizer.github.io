import { describe, it, expect } from 'vitest';
import { applyWithdrawalOrder, applyBlendPolicy } from './withdrawal';
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

  it('bracketfill fills bracket with traditional so taxable ordinary = ceiling', () => {
    const r = applyWithdrawalOrder({ ...base, strategy: 'bracketfill', gap: 200_000 });
    // wdTrd + baseOrdIncome(0) - stdD = MFJ_12 → wdTrd = MFJ_12 + stdD = MFJ_12 + 31500
    expect(r.wdTrd).toBeCloseTo(MFJ_12 + 31500, -2);
    expect(r.wdRth).toBeGreaterThan(0);
  });
});

// Spill instrumentation: behavior-neutral (wdTax/wdTrd/wdRth unchanged), correct kind + amount
describe('spill instrumentation', () => {
  const policy = {
    windows: [{ fromAge: 65, toAge: 80, pctTaxable: 0, pctTraditional: 0.6, pctRoth: 0.4, tradCap: undefined }],
  };

  it('no-window: spill fires when age is outside all windows, wdAmounts unchanged', () => {
    const without = applyBlendPolicy({ policy, ageA: 85, gap: 50_000, taxable: 200_000, traditional: 200_000, roth: 200_000 });
    expect(without.spill?.kind).toBe('no-window');
    expect(without.spill?.amount).toBeCloseTo(50_000, 0);
    // amounts must be fully funded (fallback covers the gap)
    expect(without.wdTax + without.wdTrd + without.wdRth).toBeCloseTo(50_000, 0);
  });

  it('trad-cap: spill fires when tradCap clamps wdTrd, wdAmounts still cover gap', () => {
    const policyWithCap = {
      windows: [{ fromAge: 65, toAge: 80, pctTaxable: 0, pctTraditional: 1, pctRoth: 0, tradCap: 10_000 }],
    };
    const r = applyBlendPolicy({ policy: policyWithCap, ageA: 70, gap: 50_000, taxable: 200_000, traditional: 200_000, roth: 200_000 });
    expect(r.spill?.kind).toBe('trad-cap');
    expect(r.spill?.tradCap).toBe(10_000);
    expect(r.spill!.amount).toBeGreaterThan(0);
    expect(r.wdTax + r.wdTrd + r.wdRth).toBeCloseTo(50_000, 0);
  });

  it('pct-unhonorable: spill fires when balance constraints prevent honoring pcts', () => {
    // traditional balance is too small to honor 60% share; shortfall must spill elsewhere
    const r = applyBlendPolicy({ policy, ageA: 70, gap: 100_000, taxable: 200_000, traditional: 5_000, roth: 200_000 });
    expect(r.spill?.kind).toBe('pct-unhonorable');
    expect(r.spill!.amount).toBeGreaterThan(0);
    expect(r.wdTax + r.wdTrd + r.wdRth).toBeCloseTo(100_000, 0);
  });

  it('proportional pct-unhonorable: spill fires when all buckets exhausted below gap', () => {
    // total available < gap: proportional fill + spill-to-largest all exhaust, leftover > 0.01
    const r = applyWithdrawalOrder({ ...base, strategy: 'proportional', taxable: 20_000, traditional: 20_000, roth: 20_000, gap: 100_000 });
    expect(r.spill?.kind).toBe('pct-unhonorable');
    expect(r.spill!.amount).toBeCloseTo(40_000, 0);
    expect(r.wdTax + r.wdTrd + r.wdRth).toBeCloseTo(60_000, 0);
  });

  it('balance-exhausted: spill fires when ordered preset runs out of balance', () => {
    const r = applyWithdrawalOrder({ ...base, strategy: 'taxfirst', taxable: 10_000, traditional: 0, roth: 0, gap: 50_000 });
    expect(r.spill?.kind).toBe('balance-exhausted');
    expect(r.spill?.amount).toBeCloseTo(40_000, 0);
    // wdAmounts equal what was available
    expect(r.wdTax).toBeCloseTo(10_000, 0);
    expect(r.wdTrd).toBe(0);
    expect(r.wdRth).toBe(0);
  });

  it('no spill when gap fully covered without constraint violation', () => {
    const r = applyWithdrawalOrder({ ...base, strategy: 'taxfirst' });
    expect(r.spill).toBeUndefined();
  });
});
