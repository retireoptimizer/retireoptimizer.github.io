import { describe, it, expect } from 'vitest';
import { householdSS, ssStartAge } from './socialSecurity';
import { annualSSBenefit, benefitFactor } from './ssActuarial';
import { runProjection } from './projection';
import { samplePlan, type IncomeStream, type Plan } from '../schemas/plan';

describe('ssActuarial', () => {
  it('FRA factor of 1.0 at age 67', () => {
    expect(benefitFactor(67)).toBe(1.0);
  });
  it('25% delayed credit at age 70', () => {
    expect(benefitFactor(70)).toBe(1.24);
  });
  it('30% early reduction at age 62', () => {
    expect(benefitFactor(62)).toBe(0.70);
  });
  it('no benefit before claim age', () => {
    expect(annualSSBenefit(40000, 67, 60)).toBe(0);
  });
  it('full benefit at claim age', () => {
    expect(annualSSBenefit(40000, 67, 67)).toBeCloseTo(40000, 0);
  });
});

describe('householdSS', () => {
  it('both alive, both claiming = sum', () => {
    const r = householdSS({
      piaA: 40000, claimAgeA: 67, ageA: 70, aliveA: true,
      piaB: 30000, claimAgeB: 67, ageB: 68, aliveB: true,
      inflationFactor: 1,
    });
    expect(r.total).toBeCloseTo(70000, 0);
  });

  it('B dies → A keeps larger benefit', () => {
    const r = householdSS({
      piaA: 30000, claimAgeA: 67, ageA: 75, aliveA: true,
      piaB: 50000, claimAgeB: 67, ageB: 73, aliveB: false,
      inflationFactor: 1,
    });
    expect(r.total).toBeCloseTo(50000, 0); // B's larger
  });

  it('inflation factor compounds COLA', () => {
    const r = householdSS({
      piaA: 40000, claimAgeA: 67, ageA: 67, aliveA: true,
      inflationFactor: 1.5,
    });
    expect(r.ssA).toBeCloseTo(60000, 0);
  });
});

describe('survivor benefit from SS streams', () => {
  const Y = new Date().getFullYear();
  const ssStream = (id: string, whose: 'A' | 'B', startAge: number, stopAge: number, annualAmount: number): IncomeStream => ({
    id, description: id, whose, type: 'SS', startAge, end: { mode: 'age', age: stopAge }, survivorPct: 0,
    annualAmount, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1,
  });
  /** A is 62 and claims at 70 ($55k = PIA × 1.24); B has a $20k own benefit. */
  const plan = (deathA: number, ageB: number, streams?: IncomeStream[]): Plan => {
    const p = samplePlan();
    p.personA = { ...p.personA, dob: `${Y - 62}-01-01`, planThroughAge: deathA };
    p.personB = { ...p.personB!, dob: `${Y - ageB}-01-01`, planThroughAge: 95 };
    p.incomeStreams = streams ?? [ssStream('a', 'A', 70, 95, 55000), ssStream('b', 'B', 62, 95, 20000)];
    return p;
  };
  const realSSB = (p: Plan, ageB: number) => {
    const row = runProjection(p).rows.find((r) => r.ageB === ageB)!;
    return row.ssB / row.inflationFactor;
  };
  const PIA_A = 55000 / 1.24;

  it('death before FRA, before claiming: survivor gets 100% of PIA', () => {
    expect(realSSB(plan(65, 66), 75)).toBeCloseTo(PIA_A, 0);
  });

  it('death after FRA, before claiming: PIA plus delayed credits earned through death', () => {
    expect(realSSB(plan(68, 66), 75)).toBeCloseTo(PIA_A * 1.16, 0);
    expect(realSSB(plan(69, 66), 75)).toBeCloseTo(55000, 0);
  });

  it('death after claiming is unchanged: survivor gets the claimed amount', () => {
    expect(realSSB(plan(80, 66), 85)).toBeCloseTo(55000, 0);
  });

  it('young survivor: nothing before 60, then 71.5% from 60', () => {
    const p = plan(65, 55, [ssStream('a', 'A', 70, 95, 55000)]);
    expect(realSSB(p, 59)).toBe(0);
    expect(realSSB(p, 60)).toBeCloseTo(PIA_A * 0.715, 0);
    expect(realSSB(p, 70)).toBeCloseTo(PIA_A * 0.715, 0);
  });

  it('survivor keeps own benefit when it is larger', () => {
    const p = plan(65, 66, [ssStream('a', 'A', 70, 95, 12000), ssStream('b', 'B', 62, 95, 30000)]);
    expect(realSSB(p, 75)).toBeCloseTo(30000, 0);
  });

  it('stepped streams: a claimed stream is not added to a later step', () => {
    // A claimed 62-67 at $15k, then a $40k step from 68. Dying at 64 pays only the claimed $15k.
    const p = plan(64, 66, [ssStream('a1', 'A', 62, 67, 15000), ssStream('a2', 'A', 68, 95, 40000), ssStream('b', 'B', 62, 95, 5000)]);
    expect(realSSB(p, 75)).toBeCloseTo(15000, 0);
  });
});

describe('ssStartAge', () => {
  it('uses the earliest SS stream start age, in the owner\'s own frame', () => {
    const p = samplePlan(); // A stream starts 70; B has 62 and 68 steps; ssClaimAge B is 62
    p.personB!.ssClaimAge = 67;
    expect(ssStartAge(p, 'A')).toBe(70);
    expect(ssStartAge(p, 'B')).toBe(62);
  });
  it('falls back to ssClaimAge without an SS stream', () => {
    const p = samplePlan();
    p.incomeStreams = p.incomeStreams.filter((s) => s.whose !== 'B');
    p.personB!.ssClaimAge = 67;
    expect(ssStartAge(p, 'B')).toBe(67);
    p.personB = undefined;
    expect(ssStartAge(p, 'B')).toBeUndefined();
  });
});
