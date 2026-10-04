import { describe, it, expect } from 'vitest';
import { sequenceRiskRule } from './sequenceRisk';
import { runProjection } from '../../projection';
import { runMonteCarlo } from '../../monteCarlo';
import { planP_tightPlan, planA_simple } from '../../__golden/plans';

describe('sequenceRiskRule', () => {
  it('returns null when no Monte Carlo result is provided', () => {
    const plan = planA_simple();
    const proj = runProjection(plan);
    expect(sequenceRiskRule({ plan, proj })).toBeNull();
  });

  it('fires when MC failure rate is elevated and depletion appears early in retirement', () => {
    // planP with a high stddev fails in ~40% of trials, well past the rule's 10% threshold.
    const plan = planP_tightPlan();
    const proj = runProjection(plan);
    const mc = runMonteCarlo(plan, { trials: 200, stdDev: 0.18, seed: 11 });
    expect(1 - mc.successRate, 'fixture must fail in more than 10% of trials').toBeGreaterThan(0.10);
    const insight = sequenceRiskRule({ plan, proj, mc });
    expect(insight).not.toBeNull();
    expect(insight!.title).toMatch(/Sequence-of-returns risk/);
  });

  it('does not fire when MC success rate is very high', () => {
    // Plan-A baseline with low stddev → very high success rate.
    const plan = planA_simple();
    const proj = runProjection(plan);
    const mc = runMonteCarlo(plan, { trials: 100, stdDev: 0.05, seed: 7 });
    expect(mc.successRate, 'fixture must succeed in at least 90% of trials').toBeGreaterThanOrEqual(0.90);
    expect(sequenceRiskRule({ plan, proj, mc })).toBeNull();
  });
});
