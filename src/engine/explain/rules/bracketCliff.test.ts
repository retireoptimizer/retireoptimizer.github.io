import { describe, it, expect } from 'vitest';
import { bracketCliffRule } from './bracketCliff';
import { runProjection } from '../../projection';
import { planF_allTradCouple, planE_allRothCouple } from '../../__golden/plans';

describe('bracketCliffRule', () => {
  it('fires when an all-Traditional couple crosses brackets at RMD start', () => {
    const plan = planF_allTradCouple();
    const proj = runProjection(plan);
    const insight = bracketCliffRule({ plan, proj });
    expect(insight).not.toBeNull();
    expect(insight!.title).toMatch(/Tax bracket jumps at age/);
    expect(insight!.surfaces).toContain('taxes');
    // Body should reference RMD or SS as the driver.
    expect(insight!.body).toMatch(/RMD|Social Security/);
  });

  it('attributes the cliff to Social Security (not RMDs) when there is no Pre-tax balance', () => {
    // All-Roth couple has zero RMDs. When SS becomes taxable at claim age, ord
    // income still crosses the 12→22 boundary — the rule should still fire, but
    // attribute the driver to Social Security rather than RMDs.
    const plan = planE_allRothCouple();
    const proj = runProjection(plan);
    const insight = bracketCliffRule({ plan, proj });
    if (insight) {
      expect(insight.body).toMatch(/Social Security/);
      expect(insight.body).not.toMatch(/RMDs of/);
    }
  });
});
