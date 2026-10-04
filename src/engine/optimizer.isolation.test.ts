import { describe, it, expect } from 'vitest';
import { planF_allTradCouple } from './__golden/plans';
import type { Plan } from '../schemas/plan';
import { optimizeCached } from './__testutil__/optimizeCached';

/** Deep-clone a plan to keep test cases isolated. */
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

// Own file so its five optimizer runs execute in parallel with optimizer.test.ts.
describe('Optimizer ↔ Projection coordination', () => {
  it('is isolated from plan.conversion.mode and plan.withdrawalStrategy', () => {
    // Same plan, different Pick-tab settings → optimizer output must be byte-identical.
    // This is the foundational isolation property: the optimizer searches its own policy
    // space and the projection must respect that policy fully, not fall back to legacy modes.
    // Five combinations, not the full 4×5 cross-product: the property is per-axis (does either
    // setting leak into the search?), so covering every mode and every strategy at least once
    // gives the same signal. planF with conversion.optimize on: the optimizer converts heavily
    // (~$4M lifetime), so a leaking mode would show, and each run costs ~9s against ~37s for
    // samplePlan.
    const baseplan = planF_allTradCouple();
    baseplan.conversion.optimize = true;
    const combos: Array<[Plan['conversion']['mode'], Plan['withdrawalStrategy']]> = [
      ['off', 'taxfirst'],
      ['manual', 'rothfirst'],
      ['auto-window', 'tradfirst'],
      ['bracket-fill', 'proportional'],
      ['off', 'bracketfill'],
    ];

    const results: string[] = [];
    for (const [mode, strat] of combos) {
      const plan = clone(baseplan);
      plan.conversion.mode = mode;
      plan.withdrawalStrategy = strat;
      const r = optimizeCached(plan, 'max-end-balance', { thorough: false });
      // Serialize just the per-year policy windows for comparison — that's the optimizer's pure output.
      results.push(JSON.stringify(r.perYearPolicy.windows));
    }
    const distinct = new Set(results);
    expect(
      distinct.size,
      `Expected 1 distinct optimizer output across ${results.length} Pick-tab combinations, got ${distinct.size}.\n` +
      `First two distinct outputs:\n  ${[...distinct].slice(0, 2).join('\n  ')}`
    ).toBe(1);
  }, 180_000);
});
