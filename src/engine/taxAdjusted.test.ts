import { describe, it, expect } from 'vitest';
import { taxAdjustedRates, taxAdjustedValue } from './taxAdjusted';

describe('taxAdjustedRates', () => {
  it('returns defaults when called with undefined', () => {
    const r = taxAdjustedRates(undefined);
    expect(r.ordRate).toBe(0.22);
    expect(r.ltcgRate).toBe(0.15);
  });

  it('returns defaults when called with empty object', () => {
    const r = taxAdjustedRates({});
    expect(r.ordRate).toBe(0.22);
    expect(r.ltcgRate).toBe(0.15);
  });

  it('uses provided rates', () => {
    const r = taxAdjustedRates({ taxAdjOrdRate: 0.28, taxAdjLtcgRate: 0.20 });
    expect(r.ordRate).toBe(0.28);
    expect(r.ltcgRate).toBe(0.20);
  });

  it('zero rates are exactly zero (escape hatch)', () => {
    const r = taxAdjustedRates({ taxAdjOrdRate: 0, taxAdjLtcgRate: 0 });
    expect(r.ordRate).toBe(0);
    expect(r.ltcgRate).toBe(0);
  });
});

describe('taxAdjustedValue', () => {
  it('hand-computed closed form', () => {
    // taxable=100k, basis=60k, trad=200k, roth=50k, ordRate=0.22, ltcgRate=0.15
    // basis (clamped)=60k, gain=40k
    // = 50k + 60k + 40k*(1-0.15) + 200k*(1-0.22)
    // = 50k + 60k + 34k + 156k = 300k
    const result = taxAdjustedValue(100_000, 60_000, 200_000, 50_000, 0.22, 0.15);
    expect(result).toBeCloseTo(300_000, 2);
  });

  it('zero rates — tax-adjusted equals gross (identity / escape hatch)', () => {
    const taxable = 150_000;
    const basis = 80_000;
    const trad = 300_000;
    const roth = 100_000;
    const gross = taxable + trad + roth;
    const adj = taxAdjustedValue(taxable, basis, trad, roth, 0, 0);
    // With zero rates: basis-clamped=80k, gain=70k, all untaxed
    // = roth + basis + gain*(1-0) + trad*(1-0) = 100k + 80k + 70k + 300k = 550k = gross
    expect(adj).toBeCloseTo(gross, 2);
  });

  it('all-Roth portfolio — untouched regardless of rates', () => {
    const roth = 500_000;
    const adj = taxAdjustedValue(0, 0, 0, roth, 0.22, 0.15);
    expect(adj).toBeCloseTo(roth, 2);
  });

  it('all-traditional — full haircut at ordRate', () => {
    const trad = 400_000;
    const adj = taxAdjustedValue(0, 0, trad, 0, 0.22, 0.15);
    expect(adj).toBeCloseTo(trad * (1 - 0.22), 2);
  });

  it('basis-exceeds-balance clamp — tax-adjusted does not exceed gross', () => {
    // Low-return plan: basis has accreted but balance is very small
    const endTaxable = 10_000;
    const endTaxableBasis = 50_000; // basis > balance (legitimate on bad MC paths)
    const trad = 0;
    const roth = 0;
    const adj = taxAdjustedValue(endTaxable, endTaxableBasis, trad, roth, 0.22, 0.15);
    const gross = endTaxable;
    // clamped basis = min(50k, 10k) = 10k; gain = 0
    // adj = 10k + 0 = 10k = gross
    expect(adj).toBeLessThanOrEqual(gross + 1e-9);
    expect(adj).toBeCloseTo(10_000, 2);
  });

  it('rate monotonicity — higher rates produce lower tax-adjusted value', () => {
    const adj_low = taxAdjustedValue(100_000, 60_000, 200_000, 50_000, 0.12, 0.10);
    const adj_high = taxAdjustedValue(100_000, 60_000, 200_000, 50_000, 0.32, 0.20);
    expect(adj_high).toBeLessThan(adj_low);
  });

  it('tax-adjusted is always <= gross', () => {
    const endTaxable = 200_000;
    const endTaxableBasis = 100_000;
    const trad = 300_000;
    const roth = 150_000;
    const gross = endTaxable + trad + roth;
    const adj = taxAdjustedValue(endTaxable, endTaxableBasis, trad, roth, 0.22, 0.15);
    expect(adj).toBeLessThanOrEqual(gross + 1e-9);
  });

  it('two-sided lower bound: adj >= gross * (1 - max(ordRate, ltcgRate))', () => {
    const endTaxable = 200_000;
    const endTaxableBasis = 0; // worst case: all gain
    const trad = 0;
    const roth = 0;
    const ordRate = 0.22;
    const ltcgRate = 0.15;
    const gross = endTaxable + trad + roth;
    const adj = taxAdjustedValue(endTaxable, endTaxableBasis, trad, roth, ordRate, ltcgRate);
    expect(adj).toBeGreaterThanOrEqual(gross * (1 - Math.max(ordRate, ltcgRate)) - 1e-9);
  });
});
