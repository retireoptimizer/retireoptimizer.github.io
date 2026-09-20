/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import type { Plan } from '../schemas/plan';
import { runMonteCarlo, runHistoricalSweep, type MonteCarloOptions, type MonteCarloResult, type HistoricalSweepResult } from './monteCarlo';
import { optimizeStrategy, type OptimizeResult } from './optimizer';
import { previewAllPresets, type PresetPreviewResult } from './presetPreview';
import type { UserGoal } from './recommender';

export interface OptimizeWorkerOptions {
  useNelderMead?: boolean;
  thorough?: boolean;
  mcAware?: boolean;
  equityPct?: number;
  mcPosture?: 'floor' | 'balanced' | 'growth';
  /** Fixed seed for the optimizer's bootstrap paths. Pass the same value across posture runs so
   *  all three are searched against identical market histories. */
  mcSeed?: number;
}

export interface EngineWorkerAPI {
  monteCarlo(plan: Plan, opts?: MonteCarloOptions): MonteCarloResult;
  historicalSweep(plan: Plan, opts?: { equityPct?: number }): HistoricalSweepResult;
  optimize(
    plan: Plan,
    goal: UserGoal,
    options?: OptimizeWorkerOptions,
    onProgress?: (frac: number, message?: string) => void,
  ): OptimizeResult;
  previewPresets(plan: Plan): PresetPreviewResult;
}

const api: EngineWorkerAPI = {
  monteCarlo(plan, opts) {
    return runMonteCarlo(plan, opts);
  },
  historicalSweep(plan, opts) {
    return runHistoricalSweep(plan, opts);
  },
  optimize(plan, goal, options, onProgress) {
    return optimizeStrategy(plan, goal, {
      useNelderMead: options?.useNelderMead,
      thorough: options?.thorough,
      mcAware: options?.mcAware,
      equityPct: options?.equityPct,
      mcPosture: options?.mcPosture,
      mcSeed: options?.mcSeed,
      onProgress: onProgress ? (frac, msg) => onProgress(frac, msg) : undefined,
    });
  },
  previewPresets(plan) {
    return previewAllPresets(plan);
  },
};

Comlink.expose(api);
