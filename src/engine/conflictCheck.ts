import type { Plan } from '../schemas/plan';
import { householdTotals } from '../schemas/plan';

export interface ConflictCheck {
  level: 'ok' | 'info' | 'warning';
  title: string;
  body: string;
}

/**
 * Heuristic compatibility check between the withdrawal strategy and the conversion mode.
 * Returns one or more findings; the highest level wins for badge display.
 */
export function checkStrategyConflicts(plan: Plan): ConflictCheck[] {
  const out: ConflictCheck[] = [];
  const wd = plan.withdrawalStrategy;
  const mode = plan.conversion.mode;
  const hasCustom = !!plan.customPolicy;
  const tradBalance = householdTotals(plan.portfolio).traditional;
  const retireAge = plan.personA.retirementAge;
  const rmdAge = plan.assumptions.rmdStartAge;
  const yearsBeforeRMD = Math.max(0, rmdAge - retireAge);

  if (!hasCustom) {
    if (wd === 'rothfirst' && (mode === 'auto-window' || mode === 'bracket-fill')) {
      out.push({
        level: 'warning',
        title: 'Roth-first withdrawals + active conversions',
        body: 'Conversions push Trad→Roth while you immediately withdraw from Roth. Net effect: paying conversion tax for no long-term Roth benefit.',
      });
    }
    if (wd === 'tradfirst' && (mode === 'auto-window' || mode === 'bracket-fill')) {
      out.push({
        level: 'warning',
        title: 'Traditional-first withdrawals + active conversions',
        body: 'Trad-first depletes the Traditional bucket quickly, leaving little to convert. Conversions become ineffective. Consider taxfirst or proportional withdrawals.',
      });
    }
  }

  if (mode === 'off' && tradBalance > 250_000 && yearsBeforeRMD >= 3) {
    out.push({
      level: 'info',
      title: 'Untapped Roth conversion opportunity',
      body: `You have ${Math.round(tradBalance / 1000)}K in Traditional and ${yearsBeforeRMD} years before RMDs begin. Filling the 12% bracket before then typically reduces lifetime tax meaningfully.`,
    });
  }

  if (mode === 'bracket-fill' && plan.conversion.bracketCeiling >= 394_600) {
    out.push({
      level: 'warning',
      title: 'Bracket Fill ceiling is very high',
      body: 'Filling the 24% bracket accelerates tax payments aggressively. The 12% ceiling ($96,950) is the sweet spot for most plans.',
    });
  }

  if (out.length === 0) {
    out.push({
      level: 'ok',
      title: 'No conflicts detected',
      body: 'Your withdrawal strategy and conversion mode are compatible.',
    });
  }

  return out;
}
