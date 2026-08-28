import { describe, it, expect, beforeEach } from 'vitest';
import { usePlanStore } from './usePlanStore';
import { samplePlan } from '../schemas/plan';
import type { BlendPolicy } from '../engine/blendPolicy';

const optimizerPolicy: BlendPolicy = {
  source: 'optimizer',
  windows: [{ fromAge: 59, toAge: 98, pctTaxable: 0.4, pctTraditional: 0.4, pctRoth: 0.2, convAmt: 50_000 }],
};
const baselinePolicy: BlendPolicy = {
  source: 'optimizer',
  windows: [{ fromAge: 59, toAge: 98, pctTaxable: 1, pctTraditional: 0, pctRoth: 0 }],
};

describe('setConversion invalidates a stale optimizer-authored withdrawal ordering', () => {
  beforeEach(() => {
    usePlanStore.setState({ plan: samplePlan() });
  });

  it('clears customPolicy and conversionBaselinePolicy when the policy is optimizer-authored', () => {
    usePlanStore.setState({
      plan: { ...samplePlan(), customPolicy: optimizerPolicy, conversionBaselinePolicy: baselinePolicy },
    });
    usePlanStore.getState().setConversion({ mode: 'auto-window', optimize: false });
    const plan = usePlanStore.getState().plan;
    expect(plan.customPolicy).toBeUndefined();
    expect(plan.conversionBaselinePolicy).toBeUndefined();
    expect(plan.conversion.mode).toBe('auto-window');
  });

  it('leaves a manual-authored policy untouched', () => {
    const manual: BlendPolicy = { ...optimizerPolicy, source: 'manual' };
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
