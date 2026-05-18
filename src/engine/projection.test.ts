import { describe, it, expect } from 'vitest';
import { runProjection } from './projection';
import { defaultPlan } from '../schemas/plan';

describe('runProjection (smoke)', () => {
  const result = runProjection(defaultPlan());

  it('produces rows up to plan-to age', () => {
    expect(result.rows.length).toBeGreaterThan(30);
    expect(result.rows.length).toBeLessThanOrEqual(75);
  });

  it('first row is year 1 with accumulation phase', () => {
    expect(result.rows[0].year).toBe(1);
    expect(result.rows[0].phase).toBe('Accum.');
  });

  it('transitions to Retire at retirement age', () => {
    const retireIdx = result.rows.findIndex(r => r.phase === 'Retire');
    expect(retireIdx).toBeGreaterThan(0);
  });

  it('balances never go negative', () => {
    for (const row of result.rows) {
      expect(row.endTaxable).toBeGreaterThanOrEqual(0);
      expect(row.endTraditional).toBeGreaterThanOrEqual(0);
      expect(row.endRoth).toBeGreaterThanOrEqual(0);
    }
  });

  it('lifetimeFedTax > 0 (paying some tax in retirement)', () => {
    expect(result.lifetimeFedTax).toBeGreaterThan(0);
  });

  it('RMD kicks in at age 75 and not before', () => {
    const beforeRmd = result.rows.find(r => r.ageA === 74);
    const atRmd = result.rows.find(r => r.ageA === 75);
    if (beforeRmd) expect(beforeRmd.rmd).toBe(0);
    if (atRmd) expect(atRmd.rmd).toBeGreaterThan(0);
  });
});
