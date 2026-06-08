import { describe, it, expect } from 'vitest';
import { legacyRule } from './legacy';
import { runProjection } from '../../projection';
import { planE_allRothCouple, planA_simple } from '../../__golden/plans';

describe('legacyRule', () => {
  it('fires for an all-Roth couple with substantial ending balance', () => {
    const plan = planE_allRothCouple();
    const proj = runProjection(plan);
    const insight = legacyRule({ plan, proj });
    expect(insight).not.toBeNull();
    expect(insight!.title).toMatch(/Tax-free legacy/);
    // All-Roth couple: end Roth should be the dominant share.
    expect(insight!.body).toMatch(/Roth/);
  });

  it('returns a non-null insight as long as plan funds through with material end balance', () => {
    const plan = planA_simple();
    const proj = runProjection(plan);
    const insight = legacyRule({ plan, proj });
    if (!proj.ranOut && proj.endTotalReal >= 100_000) {
      expect(insight).not.toBeNull();
    }
  });
});
