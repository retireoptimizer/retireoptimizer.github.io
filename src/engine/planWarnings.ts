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
