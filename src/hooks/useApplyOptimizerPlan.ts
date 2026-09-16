import { usePlanStore } from '../store/usePlanStore';
import { useOptimizerStore } from '../store/useOptimizerStore';
import { useWhatIfStore } from '../store/useWhatIfStore';
import type { Plan } from '../schemas/plan';

/** Returns a stable callback that commits an optimizer-produced plan to the store.
 *  Covers applyOptimizerResult + clearing pending state + resetting what-ifs. */
export function useApplyOptimizerPlan(): (plan: Plan) => void {
  const applyOptimizerResult = usePlanStore((s) => s.applyOptimizerResult);
  const setPendingPlan = useOptimizerStore((s) => s.setPendingPlan);
  const setPendingGoal = useOptimizerStore((s) => s.setPendingGoal);
  const setRobustnessPlan = useOptimizerStore((s) => s.setRobustnessPlan);
  const setRobustnessComparison = useOptimizerStore((s) => s.setRobustnessComparison);
  const resetWhatIf = useWhatIfStore((s) => s.reset);

  return (plan: Plan) => {
    applyOptimizerResult(plan);
    setPendingPlan(null);
    setPendingGoal(null);
    setRobustnessPlan(null);
    setRobustnessComparison(null);
    resetWhatIf();
  };
}
