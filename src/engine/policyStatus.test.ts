import { describe, it, expect } from 'vitest';
import { policyStatus } from './policyStatus';
import { planInputKey, manualScheduleKey } from './planInputKey';
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

  it('stays fresh when only the manual conversion schedule changes', () => {
    const base = defaultPlan();
    const manual = { ...base, conversion: { ...base.conversion, mode: 'manual' as const, optimize: false, manualSchedule: { '60': 50_000 } } };
    const applied = { ...manual, customPolicy: { windows: [BASE_WINDOW], source: 'optimizer' as const, inputKey: planInputKey(manual) } };
    const edited = { ...applied, conversion: { ...applied.conversion, manualSchedule: { '60': 5, '61': 80_000 } } };
    expect(policyStatus(edited)).toBe('fresh');
  });

  it('goes stale when the conversion mode changes', () => {
    const base = defaultPlan();
    const applied = { ...base, customPolicy: { windows: [BASE_WINDOW], source: 'optimizer' as const, inputKey: planInputKey(base) } };
    const nextMode = base.conversion.mode === 'manual' ? 'bracket-fill' as const : 'manual' as const;
    expect(policyStatus({ ...applied, conversion: { ...base.conversion, mode: nextMode } })).toBe('stale');
  });

  it('manualScheduleKey ignores key order and detects amount edits', () => {
    const base = defaultPlan();
    const withSched = (m: Record<string, number>) => ({ ...base, conversion: { ...base.conversion, manualSchedule: m } });
    expect(manualScheduleKey(withSched({ '60': 1, '61': 2 }))).toBe(manualScheduleKey(withSched({ '61': 2, '60': 1 })));
    expect(manualScheduleKey(withSched({ '60': 1 }))).not.toBe(manualScheduleKey(withSched({ '60': 2 })));
    expect(manualScheduleKey(withSched({ '60': 1, '61': 0 }))).toBe(manualScheduleKey(withSched({ '60': 1 })));
  });
});
