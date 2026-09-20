import { describe, it, expect, beforeEach } from 'vitest';
import { usePlanStore } from './usePlanStore';
import { samplePlan } from '../schemas/plan';
import { policyStatus } from '../engine/policyStatus';
import { planInputKey } from '../engine/planInputKey';
import type { BlendPolicy } from '../engine/blendPolicy';

const makeOptimizerPolicy = (plan: ReturnType<typeof samplePlan>): BlendPolicy => ({
  source: 'optimizer',
  windows: [{ fromAge: 59, toAge: 98, pctTaxable: 0.4, pctTraditional: 0.4, pctRoth: 0.2, convAmt: 50_000 }],
  inputKey: planInputKey(plan),
});

const baselinePolicy: BlendPolicy = {
  source: 'optimizer',
  windows: [{ fromAge: 59, toAge: 98, pctTaxable: 1, pctTraditional: 0, pctRoth: 0 }],
};

describe('setConversion invalidation behavior', () => {
  beforeEach(() => {
    usePlanStore.setState({ plan: samplePlan() });
  });

  it('leaves customPolicy in place but makes policyStatus stale when the policy is optimizer-authored', () => {
    const base = samplePlan();
    const policy = makeOptimizerPolicy(base);
    usePlanStore.setState({
      plan: { ...base, customPolicy: policy, conversionBaselinePolicy: baselinePolicy },
    });
    expect(policyStatus(usePlanStore.getState().plan)).toBe('fresh');

    usePlanStore.getState().setConversion({ mode: 'auto-window', optimize: false });
    const plan = usePlanStore.getState().plan;

    expect(plan.customPolicy).toBeDefined();
    expect(plan.conversionBaselinePolicy).toBeDefined();
    expect(plan.conversion.mode).toBe('auto-window');
    expect(policyStatus(plan)).toBe('stale');
  });

  it('leaves a manual-authored policy untouched', () => {
    const manual: BlendPolicy = { source: 'manual', windows: [{ fromAge: 59, toAge: 98, pctTaxable: 0.4, pctTraditional: 0.4, pctRoth: 0.2 }] };
    usePlanStore.setState({ plan: { ...samplePlan(), customPolicy: manual } });
    usePlanStore.getState().setConversion({ mode: 'auto-window' });
    expect(usePlanStore.getState().plan.customPolicy).toEqual(manual);
  });

  it('is a no-op on customPolicy when none is set', () => {
    usePlanStore.getState().setConversion({ mode: 'bracket-fill' });
    const plan = usePlanStore.getState().plan;
    expect(plan.customPolicy).toBeUndefined();
    expect(plan.conversion.mode).toBe('bracket-fill');
  });
});
