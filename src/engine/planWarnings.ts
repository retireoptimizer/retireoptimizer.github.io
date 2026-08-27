import type { Plan } from '../schemas/plan';

export interface PlanWarning {
  id: string;
  severity: 'error' | 'warn';
  message: string;
}

export function computePlanWarnings(plan: Plan): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const hasB = !!plan.personB;

  const currentYear = new Date().getFullYear();
  const currentAgeA = currentYear - parseInt(plan.personA.dob.slice(0, 4), 10);
  const currentAgeB = plan.personB ? currentYear - parseInt(plan.personB.dob.slice(0, 4), 10) : undefined;

  if (plan.expenseStreams.length === 0) {
    warnings.push({ id: 'no-expenses', severity: 'warn', message: 'No expense streams — the plan will always appear fully funded.' });
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
      warnings.push({ id: `inc-past-${s.id}`, severity: 'warn', message: `"${s.description}": start age (${s.startAge}) is before current age (${ownerCurrentAge}) — only future years are simulated.` });
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
      warnings.push({ id: `exp-past-${s.id}`, severity: 'warn', message: `Expense "${s.description}": start age (${s.startAge}) is before current age (${ownerCurrentAge}) — only future years are simulated.` });
    }
  }

  return warnings;
}
