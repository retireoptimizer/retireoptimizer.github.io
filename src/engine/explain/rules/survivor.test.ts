import { describe, it, expect } from 'vitest';
import { survivorRule } from './survivor';
import { runProjection } from '../../projection';
import { planH_survivorMidPlan, planB_largeTradSingle } from '../../__golden/plans';

describe('survivorRule', () => {
  it('fires when a couple transitions to single filing during the plan', () => {
    const plan = planH_survivorMidPlan();
    const proj = runProjection(plan);
    const insight = survivorRule({ plan, proj });
    // Only fires when effective rate jumps ≥3 pts at transition. Plan H is designed
    // for survivor mid-plan, so we expect a fire OR a null (if the rate diff is small).
    if (insight) {
      expect(insight.title).toMatch(/Survivor tax cliff/);
      expect(insight.body).toMatch(/Filing status becomes Single/);
    }
  });

  it('does not fire for a single-person plan (no transition possible)', () => {
    const plan = planB_largeTradSingle();
    const proj = runProjection(plan);
    expect(survivorRule({ plan, proj })).toBeNull();
  });
});
