import { describe, it, expect } from 'vitest';
import { stateTax } from './stateTax';

describe('stateTax (IL)', () => {
  it('IL: $50k wages = $2,475', () => {
    expect(stateTax('IL', 50000)).toBeCloseTo(2475, 0);
  });
  it('IL: $0 exempt income → $0', () => {
    expect(stateTax('IL', 0)).toBe(0);
  });
  it('non-IL state returns 0 (not yet modeled)', () => {
    expect(stateTax('TX', 100000)).toBe(0);
    expect(stateTax('CA', 100000)).toBe(0);
  });
});
