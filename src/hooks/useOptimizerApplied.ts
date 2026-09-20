import { usePlanStore } from '../store/usePlanStore';
import { useOptimizerStore } from '../store/useOptimizerStore';
import { policyStatus } from '../engine/policyStatus';
import type { UserGoal } from '../engine/recommender';
import type { Plan } from '../schemas/plan';

/** Where the committed strategy came from. Absent on plans saved before provenance tracking. */
export type OptimizerSource = 'optimizer' | 'monte-carlo' | 'unknown';

export type OptimizerAppliedState =
  | { kind: 'none' }
  | { kind: 'pending'; goal: UserGoal | null }
  | { kind: 'stale'; goal: UserGoal; source: OptimizerSource; mcTuning: Plan['mcTuning'] }
  | { kind: 'applied'; goal: UserGoal; source: OptimizerSource; mcTuning: Plan['mcTuning'] }
  | { kind: 'hand-edited' };

/** Returns the optimizer applied state for the committed plan.
 *  Precedence: pending > applied/stale/hand-edited > none. */
export function useOptimizerApplied(): OptimizerAppliedState {
  const plan = usePlanStore((s) => s.plan);
  const pendingPlan = useOptimizerStore((s) => s.pendingPlan);
  const pendingGoal = useOptimizerStore((s) => s.pendingGoal);

  if (pendingPlan !== null) {
    return { kind: 'pending', goal: pendingGoal };
  }

  const status = policyStatus(plan);
  const { optimizedForGoal } = plan;

  if (status === 'none') return { kind: 'none' };
  if (status === 'hand-edited') return { kind: 'hand-edited' };

  // status is 'fresh' or 'stale' — customPolicy.source === 'optimizer'
  const goal = optimizedForGoal as UserGoal | undefined;
  if (!goal) return { kind: 'none' };
  const source: OptimizerSource = plan.optimizedBy ?? 'unknown';
  const { mcTuning } = plan;
  if (status === 'stale') return { kind: 'stale', goal, source, mcTuning };
  return { kind: 'applied', goal, source, mcTuning };
}
