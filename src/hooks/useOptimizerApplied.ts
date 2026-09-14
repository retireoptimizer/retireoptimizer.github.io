import { usePlanStore } from '../store/usePlanStore';
import { useOptimizerStore } from '../store/useOptimizerStore';
import { planInputKey } from '../engine/planInputKey';
import type { UserGoal } from '../engine/recommender';

export type OptimizerAppliedState =
  | { kind: 'none' }
  | { kind: 'pending'; goal: UserGoal | null }
  | { kind: 'orphaned'; goal: UserGoal }
  | { kind: 'stale'; goal: UserGoal }
  | { kind: 'applied'; goal: UserGoal }
  | { kind: 'hand-edited' };

/** Returns the optimizer applied state for the committed plan.
 *  Precedence: pending > orphaned > applied/stale > hand-edited > none. */
export function useOptimizerApplied(): OptimizerAppliedState {
  const plan = usePlanStore((s) => s.plan);
  const pendingPlan = useOptimizerStore((s) => s.pendingPlan);
  const pendingGoal = useOptimizerStore((s) => s.pendingGoal);
  const planKey = useOptimizerStore((s) => s.planKey);

  if (pendingPlan !== null) {
    return { kind: 'pending', goal: pendingGoal };
  }

  const { customPolicy, optimizedForGoal } = plan;

  if (optimizedForGoal && !customPolicy) {
    // Policy was cleared (manual preset pick) but goal field persisted — orphaned.
    return { kind: 'orphaned', goal: optimizedForGoal as UserGoal };
  }

  if (optimizedForGoal && customPolicy?.source === 'optimizer') {
    if (planKey !== null && planInputKey(plan) !== planKey) {
      return { kind: 'stale', goal: optimizedForGoal as UserGoal };
    }
    return { kind: 'applied', goal: optimizedForGoal as UserGoal };
  }

  if (customPolicy && !optimizedForGoal) {
    return { kind: 'hand-edited' };
  }

  return { kind: 'none' };
}
