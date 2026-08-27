import { describe, it, expect } from 'vitest';
import { PlanSchema, defaultPlan, type Plan } from '../schemas/plan';
import { computePlanWarnings, preRetirementConversionAges } from './planWarnings';
import { firstRetirementAgeA } from './streamWindow';

const currentYear = new Date().getFullYear();
/** Person A turns 52 this year, Person B 49 — B is 3 years younger. */
const basePlan = (): Plan => {
  const p = defaultPlan();
  p.personA = { ...p.personA, dob: `${currentYear - 52}-05-03`, retirementAge: 59, planThroughAge: 95 };
  p.personB = { ...p.personA, name: 'B', dob: `${currentYear - 49}-08-26`, retirementAge: 56, planThroughAge: 95 };
  return PlanSchema.parse(p);
};

describe('firstRetirementAgeA', () => {
  it('converts the younger spouse\'s retirement age into A\'s frame', () => {
    const p = basePlan();
    // B retires at 56; B is 3 years younger, so that is A's age 59. A also retires at 59.
    expect(firstRetirementAgeA(p)).toBe(59);
  });

  it('uses whichever person retires first', () => {
    const p = basePlan();
    p.personB!.retirementAge = 50;   // B at 50 → A's age 53
    expect(firstRetirementAgeA(p)).toBe(53);
  });

  it('falls back to A alone when there is no Person B', () => {
    const p = basePlan();
    p.personB = undefined;
    expect(firstRetirementAgeA(p)).toBe(59);
  });
});

describe('pre-retirement conversion warning', () => {
  it('flags non-zero manual conversions scheduled before the first retirement year', () => {
    const p = basePlan();
    p.conversion = { ...p.conversion, mode: 'manual', optimize: false, manualSchedule: { '54': 200000, '55': 200000, '60': 50000 } };

    expect(preRetirementConversionAges(p)).toEqual([54, 55]);
    const w = computePlanWarnings(p).find((x) => x.id === 'conv-pre-retirement-tax');
    expect(w).toBeDefined();
    expect(w!.severity).toBe('warn');
    expect(w!.message).toContain('ages 54–55');
    expect(w!.message).toContain('understated');
  });

  it('renders a single age without a range', () => {
    const p = basePlan();
    p.conversion = { ...p.conversion, mode: 'manual', optimize: false, manualSchedule: { '54': 100000 } };
    expect(computePlanWarnings(p).find((x) => x.id === 'conv-pre-retirement-tax')!.message).toContain('age 54');
  });

  it('does not flag conversions at or after the first retirement year', () => {
    const p = basePlan();
    p.conversion = { ...p.conversion, mode: 'manual', optimize: false, manualSchedule: { '59': 200000, '65': 200000 } };
    expect(preRetirementConversionAges(p)).toEqual([]);
    expect(computePlanWarnings(p).some((x) => x.id === 'conv-pre-retirement-tax')).toBe(false);
  });

  it('ignores zero-amount schedule entries', () => {
    const p = basePlan();
    p.conversion = { ...p.conversion, mode: 'manual', optimize: false, manualSchedule: { '54': 0, '55': 0 } };
    expect(preRetirementConversionAges(p)).toEqual([]);
  });

  it('does not fire for retirement-gated modes, whose pre-retirement conversions are always 0', () => {
    const p = basePlan();
    for (const mode of ['off', 'auto-window', 'bracket-fill'] as const) {
      p.conversion = { ...p.conversion, mode, optimize: false, startAge: 54, manualSchedule: { '54': 200000 } };
      expect(preRetirementConversionAges(p)).toEqual([]);
    }
  });

  it('stays silent when the optimizer owns conversions, even with a stale manual mode', () => {
    const p = basePlan();
    // The leak case: user picked Manual, then switched to "Optimizer decides" (optimize:true).
    // The optimizer never converts before retirementAge, so the schedule must not run — and
    // must not be warned about either.
    p.conversion = { ...p.conversion, mode: 'manual', optimize: true, manualSchedule: { '54': 200000 } };
    expect(preRetirementConversionAges(p)).toEqual([]);
    expect(computePlanWarnings(p).some((x) => x.id === 'conv-pre-retirement-tax')).toBe(false);
  });

  it('tracks the earlier-retiring spouse', () => {
    const p = basePlan();
    p.personB!.retirementAge = 50;   // → A's age 53
    p.conversion = { ...p.conversion, mode: 'manual', optimize: false, manualSchedule: { '52': 200000, '54': 200000 } };
    // 54 is a semi-retirement year (B retired), so only 52 is an accumulation year.
    expect(preRetirementConversionAges(p)).toEqual([52]);
  });
});
