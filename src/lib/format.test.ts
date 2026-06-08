import { describe, it, expect } from 'vitest';
import { fmtM, fmtK, fmtFull, fmtCompactWithSign, fmtPct, fmtUSD, formatWithCommas } from './format';

/** Locks the format contract so a refactor doesn't reintroduce inconsistent
 *  number rendering. Each surface's expected pattern is enforced here. */
describe('Number-format discipline', () => {
  describe('fmtM (compact, used in KPI tiles)', () => {
    it('renders large amounts as $X.XXM', () => {
      expect(fmtM(5_234_000)).toBe('$5.23M');
      expect(fmtM(1_000_000)).toBe('$1.00M');
    });
    it('falls through to fmtK below $1M', () => {
      expect(fmtM(540_000)).toBe('$540K');
    });
    it('returns em-dash for zero or NaN', () => {
      expect(fmtM(0)).toBe('—');
      expect(fmtM(NaN)).toBe('—');
    });
  });

  describe('fmtFull (full precision, used in tooltips/tables)', () => {
    it('always includes grouping commas', () => {
      expect(fmtFull(5_234_000)).toBe('$5,234,000');
      expect(fmtFull(540_500)).toBe('$540,500');
    });
    it('matches fmtUSD (alias)', () => {
      expect(fmtFull(123_456)).toBe(fmtUSD(123_456));
    });
    it('handles negative correctly', () => {
      expect(fmtFull(-12_345)).toBe('-$12,345');
    });
  });

  describe('fmtCompactWithSign (deltas)', () => {
    it('emits leading + on positive, - on negative', () => {
      expect(fmtCompactWithSign(5_234_000)).toBe('+$5.23M');
      expect(fmtCompactWithSign(-540_000)).toBe('-$540K');
    });
    it('returns $0 for exact zero', () => {
      expect(fmtCompactWithSign(0)).toBe('$0');
    });
  });

  describe('fmtK (thousands)', () => {
    it('rounds to nearest K', () => {
      expect(fmtK(540_500)).toBe('$541K');
      expect(fmtK(540_400)).toBe('$540K');
    });
  });

  describe('fmtPct', () => {
    it('renders as X.X%', () => {
      expect(fmtPct(0.036)).toBe('3.6%');
      expect(fmtPct(0.04)).toBe('4.0%');
    });
  });

  describe('formatWithCommas (NumberInput live formatter)', () => {
    it('groups integers and preserves decimals', () => {
      expect(formatWithCommas('5234000')).toBe('5,234,000');
      expect(formatWithCommas('5234000.5')).toBe('5,234,000.5');
    });
    it('passes through transitional input unchanged', () => {
      expect(formatWithCommas('')).toBe('');
      expect(formatWithCommas('-')).toBe('-');
      expect(formatWithCommas('.')).toBe('.');
    });
    it('handles negatives', () => {
      expect(formatWithCommas('-1234567')).toBe('-1,234,567');
    });
  });

  // Lint-style check: every formatter that returns a USD string must produce a $-prefixed token.
  describe('All USD formatters produce a $-prefixed token', () => {
    const cases: Array<[string, string]> = [
      ['fmtM', fmtM(5_234_000)],
      ['fmtK', fmtK(540_000)],
      ['fmtFull', fmtFull(1234)],
      ['fmtUSD', fmtUSD(1234)],
      ['fmtCompactWithSign', fmtCompactWithSign(1234)],
    ];
    for (const [name, val] of cases) {
      it(`${name} starts with optional sign then $`, () => {
        expect(val).toMatch(/^[+-]?\$/);
      });
    }
  });
});
