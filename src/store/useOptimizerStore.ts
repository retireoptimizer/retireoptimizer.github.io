import { create } from 'zustand';
import type { OptimizeResult } from '../engine/optimizer';

/** Ephemeral store for the last optimizer result. Non-persisted — resets on reload.
 *  Used by the Dashboard's "View Optimizer Rationale" modal. */
interface OptimizerState {
  result: OptimizeResult | null;
  setResult: (r: OptimizeResult | null) => void;
}

export const useOptimizerStore = create<OptimizerState>()((set) => ({
  result: null,
  setResult: (result) => set({ result }),
}));
