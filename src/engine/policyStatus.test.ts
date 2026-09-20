import { describe, it, expect } from 'vitest';
import { policyStatus } from './policyStatus';
import { planInputKey } from './planInputKey';
import { defaultPlan } from '../schemas/plan';
import type { BlendPolicy } from './blendPolicy';

const BASE_WINDOW: BlendPolicy['windows'][0] = {
  fromAge: 60, toAge: 95, pctTaxable: 0.5, pctTraditional: 0.3, pctRoth: 0.2,
};

describe('policyStatus', () => {
  it('returns none when customPolicy is absent', () => {
    const plan = defaultPlan();
    expect(policyStatus(plan)).toBe('none');
  });

  it('returns hand-edited when source is manual', () => {
    const plan = { ...defaultPlan(), customPolicy: { windows: [BASE_WINDOW], source: 'manual' as const } };
    expect(policyStatus(plan)).toBe('hand-edited');
  });

  it('returns hand-edited when source is absent', () => {
    const plan = { ...defaultPlan(), customPolicy: { windows: [BASE_WINDOW] } };
    expect(policyStatus(plan)).toBe('hand-edited');
  });

  it('returns fresh when inputKey matches planInputKey', () => {
    const base = defaultPlan();
    const key = planInputKey(base);
    const plan = { ...base, customPolicy: { windows: [BASE_WINDOW], source: 'optimizer' as const, inputKey: key } };
    expect(policyStatus(plan)).toBe('fresh');
  });

  it('returns stale when inputKey does not match', () => {
    const base = defaultPlan();
    const plan = { ...base, customPolicy: { windows: [BASE_WINDOW], source: 'optimizer' as const, inputKey: 'old-key' } };
    expect(policyStatus(plan)).toBe('stale');
  });

  it('returns stale when inputKey is undefined (unmitigated existing policy)', () => {
    const plan = { ...defaultPlan(), customPolicy: { windows: [BASE_WINDOW], source: 'optimizer' as const } };
    expect(policyStatus(plan)).toBe('stale');
  });

  it('detects stale after payTaxFromBrokerage flip', () => {
    const base = defaultPlan();
    const key = planInputKey(base);
    const applied = { ...base, customPolicy: { windows: [BASE_WINDOW], source: 'optimizer' as const, inputKey: key } };
    const afterToggle = { ...applied, payTaxFromBrokerage: !base.payTaxFromBrokerage };
    expect(policyStatus(afterToggle)).toBe('stale');
  });
});
