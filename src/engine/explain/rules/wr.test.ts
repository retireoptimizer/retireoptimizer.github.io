import { describe, it, expect } from 'vitest';
import { wrRule } from './wr';
import { runProjection } from '../../projection';
import { planA_simple, planD_singleFIRE } from '../../__golden/plans';

describe('wrRule', () => {
  it('categorizes a moderate withdrawal rate plan', () => {
    const plan = planA_simple();
    const proj = runProjection(plan);
    const insight = wrRule({ plan, proj });
    expect(insight).not.toBeNull();
    expect(insight!.title).toMatch(/Initial withdrawal rate/);
    expect(['Conservative', 'Healthy', 'Borderline', 'Aggressive']).toContain(insight!.title.split(': ')[1]);
  });

  it('flags an aggressive WR with warning severity', () => {
    // FIRE plan: $55K spend on ~$1.2M starting balance → ~4.6% WR (aggressive).
    const plan = planD_singleFIRE();
    const proj = runProjection(plan);
    const insight = wrRule({ plan, proj });
    expect(insight).not.toBeNull();
    // FIRE WR is intentionally aggressive — should be 'caution' or 'warning'.
    expect(['caution', 'warning']).toContain(insight!.severity);
  });
});
