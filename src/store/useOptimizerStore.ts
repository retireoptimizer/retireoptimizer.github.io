import { create } from 'zustand';
import type { OptimizeResult } from '../engine/optimizer';
import type { UserGoal } from '../engine/recommender';
import type { Plan } from '../schemas/plan';

/** Ephemeral store for optimizer state. Non-persisted — resets on reload. */
interface OptimizerState {
  result: OptimizeResult | null;
  setResult: (r: OptimizeResult | null) => void;
  /** Fingerprint of the plan inputs at the time the optimizer last ran. */
  planKey: string | null;
  setPlanKey: (key: string | null) => void;
  /** The optimizer-applied plan, held ephemerally until the user clicks "Apply to Plan".
   *  Never written to the persisted plan store until explicitly committed. */
  pendingPlan: Plan | null;
  setPendingPlan: (plan: Plan | null) => void;
  /** Which goal produced the current pendingPlan. */
  pendingGoal: UserGoal | null;
  setPendingGoal: (goal: UserGoal | null) => void;
}

export const useOptimizerStore = create<OptimizerState>()((set) => ({
  result: null,
  setResult: (result) => set({ result }),
  planKey: null,
  setPlanKey: (planKey) => set({ planKey }),
  pendingPlan: null,
  setPendingPlan: (pendingPlan) => set({ pendingPlan }),
  pendingGoal: null,
  setPendingGoal: (pendingGoal) => set({ pendingGoal }),
}));
