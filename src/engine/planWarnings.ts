import type { Plan } from '../schemas/plan';
import { firstRetirementAgeA } from './streamWindow';
import { calendarYearAge } from '../lib/ageUtils';

/**
 * Ages (Person A's frame) with a non-zero manual Roth conversion that will actually run before the
 * first retirement year. Only `mode: 'manual'` reaches these years — auto-window and bracket-fill
 * are retirement-gated in `rothConversion()`, and `optimize: true` means the optimizer owns
 * conversions, which projection gates to 0 during accumulation.
 */
export function preRetirementConversionAges(plan: Plan): number[] {
  if (plan.conversion.mode !== 'manual') return [];
  if (plan.conversion.optimize ?? true) return [];
  const firstRetA = firstRetirementAgeA(plan);
  return Object.entries(plan.conversion.manualSchedule)
    .filter(([age, amt]) => amt > 0 && Number(age) < firstRetA)
    .map(([age]) => Number(age))
    .sort((a, b) => a - b);
}

export interface PlanWarning {
  id: string;
  severity: 'error' | 'warn';
  message: string;
}

export function computePlanWarnings(plan: Plan): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const hasB = !!plan.personB;

  const currentAgeA = calendarYearAge(plan.personA.dob);
  const currentAgeB = plan.personB ? calendarYearAge(plan.personB.dob) : undefined;

  if (plan.expenseStreams.length === 0) {
    warnings.push({ id: 'no-expenses', severity: 'warn', message: 'No expense streams — the plan will always appear fully funded.' });
  }

  // Pre-retirement Roth conversions are permitted, but their tax cannot be priced: the plan
  // models no wage income during accumulation (contributions are the only input), so the
  // conversion is taxed as if it were the household's entire income — full standard deduction
  // and bottom brackets. The reported federal tax is therefore understated, often by ~2x.
  const preRetConvAges = preRetirementConversionAges(plan);
  if (preRetConvAges.length > 0) {
    const range = preRetConvAges.length === 1
      ? `age ${preRetConvAges[0]}`
      : `ages ${preRetConvAges[0]}–${preRetConvAges[preRetConvAges.length - 1]}`;
    warnings.push({
      id: 'conv-pre-retirement-tax',
      severity: 'warn',
      message: `Roth conversions are scheduled before retirement (${range}). Tax on these is understated — no wage income is modeled during accumulation, so the conversion is taxed as the household's only income. Their tax is also funded by liquidating the brokerage account.`,
    });
  }

  for (const s of plan.incomeStreams) {
    if (s.whose === 'B' && !hasB) {
      warnings.push({ id: `inc-b-${s.id}`, severity: 'error', message: `"${s.description}" is tagged to Person B, but no Person B is configured.` });
    }
    if (s.end.mode === 'age' && s.end.age < s.startAge) {
      warnings.push({ id: `inc-order-${s.id}`, severity: 'warn', message: `"${s.description}": stop age (${s.end.age}) is before start age (${s.startAge}).` });
    }
    if (s.annualAmount === 0) {
      warnings.push({ id: `inc-zero-${s.id}`, severity: 'warn', message: `"${s.description}": amount is $0 — fill in the annual amount.` });
    }
    const ownerCurrentAge = s.whose === 'B' ? currentAgeB : currentAgeA;
    if (ownerCurrentAge !== undefined && s.startAge < ownerCurrentAge) {
      warnings.push({ id: `inc-past-${s.id}`, severity: 'warn', message: `"${s.description}": start age (${s.startAge}) is before the first simulation year (age ${ownerCurrentAge}) — earlier years are not modeled.` });
    }
    if (s.type === 'SS' && s.survivorPct > 0) {
      warnings.push({ id: `ss-surv-${s.id}`, severity: 'warn', message: `"${s.description}": SS survivor benefits are modeled separately — Survivor % should be 0.` });
    }
  }

  // For each person with multiple SS streams, at least one must be lastSurvivor
  const ssByOwner = new Map<string, typeof plan.incomeStreams>();
  for (const s of plan.incomeStreams) {
    if (s.type !== 'SS') continue;
    if (!ssByOwner.has(s.whose)) ssByOwner.set(s.whose, []);
    ssByOwner.get(s.whose)!.push(s);
  }
  for (const [whose, streams] of ssByOwner) {
    if (streams.length > 1 && !streams.some((s) => s.end.mode === 'lastSurvivor')) {
      const label = whose === 'B' ? (plan.personB?.name || 'Person B') : whose === 'A' ? (plan.personA.name || 'Person A') : 'Household';
      warnings.push({ id: `ss-no-permanent-${whose}`, severity: 'warn', message: `${label} has ${streams.length} SS streams but none ends at "Last survivor" — one should represent the permanent benefit.` });
    }
  }

  for (const s of plan.expenseStreams) {
    if (s.whose === 'B' && !hasB) {
      warnings.push({ id: `exp-b-${s.id}`, severity: 'error', message: `Expense "${s.description}" is tagged to Person B, but no Person B is configured.` });
    }
    if (s.end.mode === 'age' && s.end.age < s.startAge) {
      warnings.push({ id: `exp-order-${s.id}`, severity: 'warn', message: `Expense "${s.description}": stop age (${s.end.age}) is before start age (${s.startAge}).` });
    }
    if (s.annualAmount === 0) {
      warnings.push({ id: `exp-zero-${s.id}`, severity: 'warn', message: `Expense "${s.description}": amount is $0 — fill in the annual amount.` });
    }
    const ownerCurrentAge = s.whose === 'B' ? currentAgeB : currentAgeA;
    if (ownerCurrentAge !== undefined && s.startAge < ownerCurrentAge) {
      warnings.push({ id: `exp-past-${s.id}`, severity: 'warn', message: `Expense "${s.description}": start age (${s.startAge}) is before the first simulation year (age ${ownerCurrentAge}) — earlier years are not modeled.` });
    }
  }

  return warnings;
}
