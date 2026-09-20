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

describe('stateTax (NY)', () => {
  it('NY single, $62K wages only: std ded $8K, taxable $54K → progressive brackets', () => {
    // 17150×4% + 6450×4.5% + 4300×5.25% + 26100×5.85%
    // = 686 + 290.25 + 225.75 + 1526.85 = 2728.85
    expect(stateTax('NY', 62000, 0, 1, 1, 0)).toBeCloseTo(2729, 0);
  });

  it('NY MFJ, $80K IRA WD only: $40K exclusion leaves $40K, std ded $16,050 → $23,950 taxable', () => {
    // 17150×4% + 6450×4.5% + 350×5.25% = 686 + 290.25 + 18.375 = 994.63
    expect(stateTax('NY', 0, 80000, 2, 1, 0)).toBeCloseTo(995, 0);
  });

  it('NY single, $50K wages + $40K IRA: ret exclusion $20K, gross $70K, std ded $8K → $62K taxable', () => {
    // 17150×4% + 6450×4.5% + 4300×5.25% + 34100×5.85%
    // = 686 + 290.25 + 225.75 + 1994.85 = 3196.85
    expect(stateTax('NY', 50000, 40000, 1, 1, 0)).toBeCloseTo(3197, 0);
  });

  it('NY MFJ: IRA WD below $40K exclusion → $0 retirement tax; below std ded → $0 total', () => {
    // $15K IRA: exclusion covers all → $0 retirement taxable; no wages → $0
    expect(stateTax('NY', 0, 15000, 2, 1, 0)).toBe(0);
  });

  it('NY: SS is exempt regardless of numPersons', () => {
    // SS income should not be added to state taxable for NY
    expect(stateTax('NY', 0, 0, 1, 1, 0, undefined, 50000)).toBe(0);
  });

  it('NY MFJ vs single: same wages but MFJ gets larger std ded → less tax', () => {
    const single = stateTax('NY', 80000, 0, 1, 1, 0);
    const mfj = stateTax('NY', 80000, 0, 2, 1, 0);
    // MFJ std ded $16,050 vs single $8,000 → MFJ taxable $63,950 vs single $72,000
    expect(mfj).toBeLessThan(single);
  });

  it('NY: inflationFactor scales both brackets and deductions', () => {
    const base = stateTax('NY', 50000, 0, 1, 1, 0);
    // With 2× inflation, all dollar amounts double so tax should ~double
    const inflated = stateTax('NY', 100000, 0, 1, 2, 0);
    expect(inflated).toBeCloseTo(base * 2, -2);
  });
});
