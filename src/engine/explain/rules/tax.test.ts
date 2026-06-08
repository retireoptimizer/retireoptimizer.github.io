import { describe, it, expect } from 'vitest';
import { taxRule } from './tax';
import { runProjection } from '../../projection';
import { planA_simple, planE_allRothCouple } from '../../__golden/plans';

describe('taxRule', () => {
  it('emits an info-tier insight for a moderate plan', () => {
    const plan = planA_simple();
    const proj = runProjection(plan);
    const insight = taxRule({ plan, proj });
    expect(insight).not.toBeNull();
    expect(insight!.title).toMatch(/Lifetime tax/);
  });

  it('classifies all-Roth couple as light tax (Roth withdrawals are non-taxable)', () => {
    const plan = planE_allRothCouple();
    const proj = runProjection(plan);
    const insight = taxRule({ plan, proj });
    expect(insight).not.toBeNull();
    // All-Roth has almost no fed tax → severity should be info, not caution.
    expect(insight!.severity).toBe('info');
  });
});
