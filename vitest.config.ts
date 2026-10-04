import { defineConfig, configDefaults } from 'vitest/config';

/** Test tiers (see CLAUDE.md "Testing workflow"):
 *   - `fast` — everything that doesn't run the optimizer. Seconds. Run after every change.
 *   - `opt`  — files that call `optimizeStrategy`. Minutes. Run when optimizer-area code changes.
 *  `pnpm test` runs both; `pnpm test:fast` / `pnpm test:opt` run one.
 *
 *  Heavy suites are opt-in via `pnpm test:heavy`:
 *   - `__study__/` — the conversion-algorithm comparison study. Research output
 *     (console tables, no assertions), not a regression check.
 *   - `__benchmarks__/` — optimality-gap benchmark, run on demand.
 *  Both run multi-minute optimizer sweeps. */
const HEAVY = process.env.HEAVY === '1';

const OPT_FILES = [
  'src/engine/optimizer.test.ts',
  'src/engine/optimizer.isolation.test.ts',
  'src/engine/optimizer.smoke.test.ts',
  'src/engine/optimizer.swl.test.ts',
  'src/engine/applyOptimizerResult.test.ts',
  'src/engine/conversionBenefit.test.ts',
];

const HEAVY_EXCLUDE = HEAVY ? [] : ['src/engine/__study__/**'];

export default defineConfig({
  test: {
    // Engine tests are pure computation, so node is the default — booting jsdom for
    // all ~28 files cost more than the assertions did. The two DOM-dependent files
    // opt back in with an `@vitest-environment jsdom` docblock.
    environment: 'node',
    globals: true,
    pool: 'threads',
    projects: [
      {
        extends: true,
        test: {
          name: 'fast',
          include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/**/*.test.ts'],
          exclude: [...configDefaults.exclude, ...OPT_FILES, 'src/engine/__study__/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'opt',
          include: [
            ...OPT_FILES,
            ...(HEAVY ? ['src/engine/__study__/**/*.test.ts', 'src/**/__benchmarks__/*.bench.ts'] : []),
          ],
          exclude: [...configDefaults.exclude, ...HEAVY_EXCLUDE],
        },
      },
    ],
  },
});
