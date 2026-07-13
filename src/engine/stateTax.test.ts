import { describe, it, expect } from 'vitest';
import { stateTax } from './stateTax';

describe('stateTax (IL)', () => {
  it('IL single filer, $50k wages: applies $2,925 personal exemption', () => {
    // (50000 - 2925) * 0.0495 = 47075 * 0.0495 ≈ $2,330
    expect(stateTax('IL', 50000, 0, 1, 1, 0)).toBeCloseTo(2330, 0);
  });
  it('IL couple both 65+, $50k wages: $2,925×2 + $1,000×2 exemption', () => {
    // (50000 - 5850 - 2000) * 0.0495 = 42150 * 0.0495 ≈ $2,086
    expect(stateTax('IL', 50000, 0, 2, 1, 2)).toBeCloseTo(2086, 0);
  });
  it('IL: income below exemption → $0', () => {
    expect(stateTax('IL', 2000, 0, 1, 1, 0)).toBe(0);
  });
  it('IL: $0 taxable income → $0', () => {
    expect(stateTax('IL', 0)).toBe(0);
  });
  it('IL: retirement distributions are exempt — only non-exempt income taxed after exemption', () => {
    // $50k wages, $100k retirement WD: WD ignored for IL; (50000 - 2925) * 0.0495
    expect(stateTax('IL', 50000, 100000, 1, 1, 0)).toBeCloseTo(2330, 0);
  });
  it('TX/FL/WA — no state income tax', () => {
    expect(stateTax('TX', 100000)).toBe(0);
    expect(stateTax('FL', 100000)).toBe(0);
    expect(stateTax('WA', 100000)).toBe(0);
  });
  it('CA: taxes wages AND retirement distributions, no personal exemption (~8% effective)', () => {
    // $50K wages + $50K retirement WD → 8% of $100K = $8,000
    expect(stateTax('CA', 50000, 50000)).toBeCloseTo(8000, 0);
  });
});
