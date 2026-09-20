import { create } from 'zustand';
import type { OptimizeResult } from '../engine/optimizer';
import type { UserGoal } from '../engine/recommender';
import type { Plan } from '../schemas/plan';
import type { MonteCarloResult, HistoricalSweepResult } from '../engine/monteCarlo';

export interface RobustComparison {
  before: number;
  after: number;
  trials: number;
  equityPct: number;
  seed: number;
}

/** Outcome of a robustness run. Exported so the store can hold it across navigation. */
export interface RobustOutcome {
  plan: Plan;
  optResult: OptimizeResult;
  before: MonteCarloResult;
  after: MonteCarloResult;
  gainPts: number;
  worthIt: boolean;
}

/** Ephemeral store for optimizer state. Non-persisted — resets on reload. */
interface OptimizerState {
  result: OptimizeResult | null;
  setResult: (r: OptimizeResult | null) => void;
  /** The optimizer-applied plan, held ephemerally until the user clicks "Apply to Plan".
   *  Never written to the persisted plan store until explicitly committed. */
  pendingPlan: Plan | null;
  setPendingPlan: (plan: Plan | null) => void;
  /** Which goal produced the current pendingPlan. */
  pendingGoal: UserGoal | null;
  setPendingGoal: (goal: UserGoal | null) => void;
  /** MC robustness-optimized plan preview. Survives navigation; discarded on Apply/Discard. */
  robustnessPlan: Plan | null;
  setRobustnessPlan: (plan: Plan | null) => void;
  /** Before/after success-rate comparison from the most recent Optimize for Robustness run. */
  robustnessComparison: RobustComparison | null;
  setRobustnessComparison: (c: RobustComparison | null) => void;
  /** MC simulation result — persists across navigation, cleared when plan inputs change. */
  mcResult: MonteCarloResult | null;
  setMcResult: (r: MonteCarloResult | null) => void;
  /** Historical sweep result — persists across navigation, cleared when plan inputs change. */
  mcHistoricalResult: HistoricalSweepResult | null;
  setMcHistoricalResult: (r: HistoricalSweepResult | null) => void;
  /** Outcome of the most recent Optimize for Robustness run. */
  mcRobustOutcome: RobustOutcome | null;
  setMcRobustOutcome: (o: RobustOutcome | null) => void;
  /** Number of trials used for the last run. Persists so the setting survives navigation. */
  mcTrials: number;
  setMcTrials: (n: number) => void;
  /** True when plan inputs have changed since the last simulation was run. */
  mcDirty: boolean;
  setMcDirty: (d: boolean) => void;
  /** planInputKey fingerprint at the time the last simulation ran. Used to detect cross-page
   *  input changes: if the current key differs on mount, results are stale and must be cleared. */
  mcPlanKey: string | null;
  setMcPlanKey: (key: string | null) => void;
  /** Clear all MC results — called when plan inputs change on any page. */
  clearMcResults: () => void;
}

export const useOptimizerStore = create<OptimizerState>()((set) => ({
  result: null,
  setResult: (result) => set({ result }),
  pendingPlan: null,
  setPendingPlan: (pendingPlan) => set({ pendingPlan }),
  pendingGoal: null,
  setPendingGoal: (pendingGoal) => set({ pendingGoal }),
  robustnessPlan: null,
  setRobustnessPlan: (robustnessPlan) => set({ robustnessPlan }),
  robustnessComparison: null,
  setRobustnessComparison: (robustnessComparison) => set({ robustnessComparison }),
  mcResult: null,
  setMcResult: (mcResult) => set({ mcResult }),
  mcHistoricalResult: null,
  setMcHistoricalResult: (mcHistoricalResult) => set({ mcHistoricalResult }),
  mcRobustOutcome: null,
  setMcRobustOutcome: (mcRobustOutcome) => set({ mcRobustOutcome }),
  mcTrials: 5000,
  setMcTrials: (mcTrials) => set({ mcTrials }),
  mcDirty: false,
  setMcDirty: (mcDirty) => set({ mcDirty }),
  mcPlanKey: null,
  setMcPlanKey: (mcPlanKey) => set({ mcPlanKey }),
  clearMcResults: () => set({
    mcResult: null,
    mcHistoricalResult: null,
    mcRobustOutcome: null,
    mcDirty: false,
    mcPlanKey: null,
    robustnessPlan: null,
    robustnessComparison: null,
  }),
}));
