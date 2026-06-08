import { annualSSBenefit } from './ssActuarial';
import type { IncomeStream } from '../schemas/plan';

interface SSInput {
  piaA: number;
  claimAgeA: number;
  ageA: number;
  aliveA: boolean;
  piaB?: number;
  claimAgeB?: number;
  ageB?: number;
  aliveB?: boolean;
  inflationFactor: number; // (1+infl)^yearIndex applied to nominal benefit (COLA proxy)
  // Optional per-person SS overrides from `incomeStreams` with type='SS'.
  // When present, these supersede the PIA × claim-age actuarial calculation for
  // that person/year, because the user has explicitly modeled their expected SS.
  // The stream's growthPct is the COLA assumption for that stream; it replaces
  // the projection-level inflationFactor for that stream's contribution.
  ssStreams?: IncomeStream[];
  yearIndex?: number; // plan year index (0-based), used to grow stream amounts
}

interface SSOutput {
  ssA: number;
  ssB: number;
  total: number;
}

/** Sum of all active SS-typed streams for one person at one age, grown by each
 *  stream's growthPct over yearIndex years. Returns 0 if no stream applies — the
 *  caller falls back to the PIA-based actuarial calculation. */
function ssFromStreams(streams: IncomeStream[], whose: 'A' | 'B', personAge: number, yearIndex: number): number {
  let total = 0;
  for (const s of streams) {
    if (s.type !== 'SS') continue;
    // 'Household' SS streams default to person A's age (legacy default-plan shape).
    const matchWhose = s.whose === whose || (whose === 'A' && s.whose === 'Household');
    if (!matchWhose) continue;
    if (personAge < s.startAge || personAge > s.stopAge) continue;
    total += s.annualAmount * Math.pow(1 + s.growthPct, yearIndex);
  }
  return total;
}

/**
 * Household SS for a given plan-year. Survivor rule: when one spouse dies,
 * the surviving spouse receives the larger of the two benefits going forward.
 */
export function householdSS(input: SSInput): SSOutput {
  // Per-person SS this year: if the user has SS-typed streams active for this
  // person/age, use that explicit value (it overrides the PIA-based calc).
  // Otherwise compute from PIA × claim-age multiplier × COLA.
  const streams = input.ssStreams ?? [];
  const yi = input.yearIndex ?? 0;

  const streamA = input.aliveA ? ssFromStreams(streams, 'A', input.ageA, yi) : 0;
  const benefitA = !input.aliveA
    ? 0
    : streamA > 0
      ? streamA
      : annualSSBenefit(input.piaA, input.claimAgeA, input.ageA) * input.inflationFactor;

  const hasB = input.piaB !== undefined && input.claimAgeB !== undefined && input.ageB !== undefined;
  const streamB = hasB && input.aliveB && input.ageB !== undefined
    ? ssFromStreams(streams, 'B', input.ageB, yi)
    : 0;
  const benefitB = !hasB || !input.aliveB
    ? 0
    : streamB > 0
      ? streamB
      : annualSSBenefit(input.piaB!, input.claimAgeB!, input.ageB!) * input.inflationFactor;

  // Both alive (or no B) — straightforward.
  if (input.aliveA && (input.aliveB || !hasB)) {
    return { ssA: benefitA, ssB: benefitB, total: benefitA + benefitB };
  }

  // Survivor keeps the larger of the two. When SS streams exist, use the
  // stream's value at the deceased spouse's current age; else use PIA.
  if (hasB) {
    if (input.aliveA && !input.aliveB) {
      const bStream = ssFromStreams(streams, 'B', input.ageB!, yi);
      const bAtDeath = bStream > 0
        ? bStream
        : annualSSBenefit(input.piaB!, input.claimAgeB!, input.ageB!) * input.inflationFactor;
      const surv = Math.max(benefitA, bAtDeath);
      return { ssA: surv, ssB: 0, total: surv };
    }
    if (!input.aliveA && input.aliveB) {
      const aStream = ssFromStreams(streams, 'A', input.ageA, yi);
      const aAtDeath = aStream > 0
        ? aStream
        : annualSSBenefit(input.piaA, input.claimAgeA, input.ageA) * input.inflationFactor;
      const surv = Math.max(benefitB, aAtDeath);
      return { ssA: 0, ssB: surv, total: surv };
    }
  }

  return { ssA: 0, ssB: 0, total: 0 };
}
