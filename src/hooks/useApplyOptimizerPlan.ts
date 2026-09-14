import { usePlanStore } from '../store/usePlanStore';
import { useOptimizerStore } from '../store/useOptimizerStore';
import { useWhatIfStore } from '../store/useWhatIfStore';
import { planInputKey } from '../engine/planInputKey';
import type { Plan } from '../schemas/plan';

/** Returns a stable callback that commits an optimizer-produced plan to the store.
 *  Covers applyOptimizerResult + planKey fingerprint + clearing pending state + resetting what-ifs. */
export function useApplyOptimizerPlan(): (plan: Plan) => void {
  const applyOptimizerResult = usePlanStore((s) => s.applyOptimizerResult);
  const setPlanKey = useOptimizerStore((s) => s.setPlanKey);
  const setPendingPlan = useOptimizerStore((s) => s.setPendingPlan);
  const setPendingGoal = useOptimizerStore((s) => s.setPendingGoal);
  const resetWhatIf = useWhatIfStore((s) => s.reset);

  return (plan: Plan) => {
    applyOptimizerResult(plan);
    setPlanKey(planInputKey(plan));
    setPendingPlan(null);
    setPendingGoal(null);
    resetWhatIf();
  };
}
