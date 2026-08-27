import type { Plan } from '../schemas/plan';

export interface PlanWarning {
  id: string;
  severity: 'error' | 'warn';
  message: string;
}

export function computePlanWarnings(plan: Plan): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const hasB = !!plan.personB;

  for (const s of plan.incomeStreams) {
    if (s.whose === 'B' && !hasB) {
      warnings.push({ id: `inc-b-${s.id}`, severity: 'error', message: `"${s.description}" is tagged to Person B, but no Person B is configured.` });
    }
    if (s.end.mode === 'age' && s.end.age < s.startAge) {
      warnings.push({ id: `inc-order-${s.id}`, severity: 'warn', message: `"${s.description}": stop age (${s.end.age}) is before start age (${s.startAge}).` });
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
  }

  return warnings;
}
