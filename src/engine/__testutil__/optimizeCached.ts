import { optimizeStrategy, type OptimizeOptions, type OptimizeResult } from '../optimizer';
import type { Plan } from '../../schemas/plan';
import type { UserGoal } from '../recommender';

/** Memoized `optimizeStrategy` for tests.
 *
 *  The optimizer is deterministic for a given (plan, goal, options) and costs seconds per call,
 *  while many tests assert different properties of the same result. The cache key is the full
 *  plan JSON, so a test that changes any field gets its own run. Every call returns a deep copy,
 *  so one test can't mutate another's result. The cache is module-level, so with Vitest's
 *  per-file isolation it is shared within a test file only.
 *
 *  Use raw `optimizeStrategy` when the test itself is about determinism (two calls compared). */
const cache = new Map<string, OptimizeResult>();

/** Options that default to off: `{ thorough: false }`, `{ useNelderMead: false }` and `{}` are the same call. */
const DEFAULT_OFF = ['useNelderMead', 'thorough', 'mcAware'] as const;

export function optimizeCached(
  plan: Plan,
  goal: UserGoal,
  opts: Omit<OptimizeOptions, 'onProgress'> = {},
): OptimizeResult {
  if (opts.mcAware && opts.mcSeed === undefined) {
    throw new Error('optimizeCached: mcAware runs draw a random seed unless mcSeed is set');
  }
  const norm: Omit<OptimizeOptions, 'onProgress'> = { ...opts };
  for (const k of DEFAULT_OFF) if (!norm[k]) delete norm[k];
  const key = JSON.stringify([goal, norm, plan]);
  let hit = cache.get(key);
  if (!hit) {
    hit = optimizeStrategy(structuredClone(plan), goal, opts);
    cache.set(key, hit);
  }
  return structuredClone(hit);
}
