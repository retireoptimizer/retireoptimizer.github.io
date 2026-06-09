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
    // Initial WR = first retirement-year portfolio withdrawals ÷ portfolio value
    // at the start of that year (the classic 4%-rule metric, shared with the top bar).
    // planA_simple draws ~$219K against a ~$3.74M at-retirement balance → ~5.9% (aggressive).
    const plan = planA_simple();
    const proj = runProjection(plan);
    const insight = wrRule({ plan, proj });
    expect(insight).not.toBeNull();
    expect(insight!.severity).toBe('warning');
    expect(insight!.title).toMatch(/Aggressive/);
  });

  it('reads a grown FIRE portfolio as healthy', () => {
    // FIRE plan retires at 45; the portfolio compounds to ~$1.94M by then, so the
    // real initial WR is ~3.4% — Healthy, not aggressive (the at-retirement balance
    // is what matters, not today's smaller balance).
    const plan = planD_singleFIRE();
    const proj = runProjection(plan);
    const insight = wrRule({ plan, proj });
    expect(insight).not.toBeNull();
    expect(insight!.severity).toBe('info');
  });
});
