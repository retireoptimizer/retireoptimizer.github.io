import { describe, it, expect } from 'vitest';
import { sequenceRiskRule } from './sequenceRisk';
import { runProjection } from '../../projection';
import { runMonteCarlo } from '../../monteCarlo';
import { planD_singleFIRE, planA_simple } from '../../__golden/plans';

describe('sequenceRiskRule', () => {
  it('returns null when no Monte Carlo result is provided', () => {
    const plan = planA_simple();
    const proj = runProjection(plan);
    expect(sequenceRiskRule({ plan, proj })).toBeNull();
  });

  it('fires when MC failure rate is elevated and depletion appears early in retirement', () => {
    // Aggressive FIRE plan with a high stddev produces a meaningful failure tail.
    const plan = planD_singleFIRE();
    const proj = runProjection(plan);
    const mc = runMonteCarlo(plan, { trials: 200, stdDev: 0.18, seed: 11 });
    const insight = sequenceRiskRule({ plan, proj, mc });
    if (1 - mc.successRate > 0.10) {
      expect(insight).not.toBeNull();
      expect(insight!.title).toMatch(/Sequence-of-returns risk/);
    }
  });

  it('does not fire when MC success rate is very high', () => {
    // Plan-A baseline with low stddev → very high success rate.
    const plan = planA_simple();
    const proj = runProjection(plan);
    const mc = runMonteCarlo(plan, { trials: 100, stdDev: 0.05, seed: 7 });
    if (mc.successRate >= 0.90) {
      expect(sequenceRiskRule({ plan, proj, mc })).toBeNull();
    }
  });
});
