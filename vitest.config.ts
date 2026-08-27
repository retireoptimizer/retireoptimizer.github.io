import { defineConfig, configDefaults } from 'vitest/config';

/** Heavy suites are opt-in via `pnpm test:heavy`:
 *   - `__study__/` — the conversion-algorithm comparison study. Research output
 *     (console tables, no assertions), not a regression check.
 *   - `__benchmarks__/` — optimality-gap benchmark, run on demand.
 *  Both run multi-minute optimizer sweeps and were dominating `pnpm test`. */
const HEAVY = process.env.HEAVY === '1';

export default defineConfig({
  test: {
    // Engine tests are pure computation, so node is the default — booting jsdom for
    // all ~28 files cost more than the assertions did. The two DOM-dependent files
    // opt back in with an `@vitest-environment jsdom` docblock.
    environment: 'node',
    globals: true,
    pool: 'threads',
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'tests/**/*.test.ts',
      ...(HEAVY ? ['src/**/__benchmarks__/*.bench.ts'] : []),
    ],
    exclude: [
      ...configDefaults.exclude,
      ...(HEAVY ? [] : ['src/engine/__study__/**']),
    ],
  },
});
