import { annualSSBenefit } from './ssActuarial';

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
}

interface SSOutput {
  ssA: number;
  ssB: number;
  total: number;
}

/**
 * Household SS for a given plan-year. Survivor rule: when one spouse dies,
 * the surviving spouse receives the larger of the two benefits going forward.
 */
export function householdSS(input: SSInput): SSOutput {
  const benefitA = input.aliveA ? annualSSBenefit(input.piaA, input.claimAgeA, input.ageA) * input.inflationFactor : 0;
  const hasB = input.piaB !== undefined && input.claimAgeB !== undefined && input.ageB !== undefined;
  const benefitB = hasB && input.aliveB
    ? annualSSBenefit(input.piaB!, input.claimAgeB!, input.ageB!) * input.inflationFactor
    : 0;

  // Both alive (or no B) — straightforward.
  if (input.aliveA && (input.aliveB || !hasB)) {
    return { ssA: benefitA, ssB: benefitB, total: benefitA + benefitB };
  }

  // Survivor keeps the larger of the two
  if (hasB) {
    if (input.aliveA && !input.aliveB) {
      // A survives; takes max of own vs B's pre-death benefit
      const bAtDeath = annualSSBenefit(input.piaB!, input.claimAgeB!, input.ageB!) * input.inflationFactor;
      const surv = Math.max(benefitA, bAtDeath);
      return { ssA: surv, ssB: 0, total: surv };
    }
    if (!input.aliveA && input.aliveB) {
      const aAtDeath = annualSSBenefit(input.piaA, input.claimAgeA, input.ageA) * input.inflationFactor;
      const surv = Math.max(benefitB, aAtDeath);
      return { ssA: 0, ssB: surv, total: surv };
    }
  }

  return { ssA: 0, ssB: 0, total: 0 };
}
