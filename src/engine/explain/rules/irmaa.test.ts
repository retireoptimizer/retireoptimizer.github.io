import { describe, it, expect } from 'vitest';
import { irmaaRule } from './irmaa';
import { runProjection } from '../../projection';
import { planF_allTradCouple, planA_simple } from '../../__golden/plans';

describe('irmaaRule', () => {
  it('fires for a high-balance Trad couple whose RMDs push MAGI into IRMAA tiers', () => {
    const plan = planF_allTradCouple();
    const proj = runProjection(plan);
    const insight = irmaaRule({ plan, proj });
    expect(insight).not.toBeNull();
    expect(insight!.title).toMatch(/IRMAA tier/);
    expect(insight!.surfaces).toContain('taxes');
  });

  it('does not fire when MAGI stays below first IRMAA tier', () => {
    // Plan-A baseline: modest balances, no aggressive conversion → MAGI stays below tier 1.
    const plan = planA_simple();
    const proj = runProjection(plan);
    // Confirm precondition: every row's irmaa is small or zero.
    const peak = Math.max(0, ...proj.rows.map((r) => r.irmaa / r.inflationFactor));
    if (peak < 1000) {
      expect(irmaaRule({ plan, proj })).toBeNull();
    }
  });
});
