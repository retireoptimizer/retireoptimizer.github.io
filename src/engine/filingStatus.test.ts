import { describe, it, expect } from 'vitest';
import { filingStatusForYear } from './filingStatus';

describe('filingStatusForYear', () => {
  // Couple: A starts 52, dies at 88 (year 36). B starts 50, dies at 92.
  // A dies in year 36. MFJ allowed for years 36, 37, 38. Single from 39 onward.
  it('both alive → MFJ', () => {
    expect(filingStatusForYear(0, 52, 88, 50, 92)).toBe('MFJ');
    expect(filingStatusForYear(35, 52, 88, 50, 92)).toBe('MFJ');
  });

  it('year of death keeps MFJ', () => {
    expect(filingStatusForYear(36, 52, 88, 50, 92)).toBe('MFJ');
  });

  it('2 years after death still MFJ', () => {
    expect(filingStatusForYear(37, 52, 88, 50, 92)).toBe('MFJ');
    expect(filingStatusForYear(38, 52, 88, 50, 92)).toBe('MFJ');
  });

  it('3 years after death → Single', () => {
    expect(filingStatusForYear(39, 52, 88, 50, 92)).toBe('Single');
  });

  it('no spouse → always Single', () => {
    expect(filingStatusForYear(5, 60, 90)).toBe('Single');
  });

  it('both dead → Single', () => {
    expect(filingStatusForYear(50, 52, 88, 50, 92)).toBe('Single');
  });
});
