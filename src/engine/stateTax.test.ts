import { describe, it, expect } from 'vitest';
import { stateTax } from './stateTax';

describe('stateTax (IL)', () => {
  it('IL: $50k wages = $2,475', () => {
    expect(stateTax('IL', 50000)).toBeCloseTo(2475, 0);
  });
  it('IL: $0 exempt income → $0', () => {
    expect(stateTax('IL', 0)).toBe(0);
  });
  it('TX/FL/WA — no state income tax', () => {
    expect(stateTax('TX', 100000)).toBe(0);
    expect(stateTax('FL', 100000)).toBe(0);
    expect(stateTax('WA', 100000)).toBe(0);
  });
  it('CA: taxes wages AND retirement distributions (~8% effective)', () => {
    // $50K wages + $50K retirement WD → ~8% of $100K
    expect(stateTax('CA', 50000, 50000)).toBeCloseTo(8000, 0);
  });
  it('IL: retirement distributions are exempt — only non-exempt wages taxed', () => {
    expect(stateTax('IL', 50000, 100000)).toBeCloseTo(2475, 0); // retirement WD ignored
  });
});
