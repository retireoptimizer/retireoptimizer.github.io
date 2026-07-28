import { test, expect } from '@playwright/test';
import { planA_simple } from '../src/engine/__golden/plans';

const STORAGE_KEY = 'fireopt-plan-v1';

/**
 * Page-level visual regression baseline.
 *
 *   First run:  `pnpm exec playwright test e2e/visual.spec.ts --update-snapshots`
 *               generates the baseline PNGs under e2e/visual.spec.ts-snapshots/.
 *   Later runs: any diff above maxDiffPixelRatio fails the test, surfacing
 *               unintended CSS or component-layout regressions.
 *
 * We load a fixture (planA_simple) so the rendered numbers are deterministic.
 */

test.describe('Visual regression', () => {
  test.beforeEach(async ({ page }) => {
    const plan = planA_simple();
    const persisted = JSON.stringify({ state: { plan, displayMode: 'real', setupDismissed: true }, version: 0 });
    await page.addInitScript(() => window.localStorage.clear());
    await page.addInitScript(
      ({ key, value }) => { window.localStorage.setItem(key, value); },
      { key: STORAGE_KEY, value: persisted },
    );
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  for (const [name, path] of [
    ['dashboard', '/dashboard'],
    ['inputs', '/inputs'],
    ['projections', '/projections'],
    ['taxes', '/taxes'],
    ['montecarlo', '/montecarlo'],
  ] as const) {
    test(`${name} page baseline`, async ({ page }) => {
      await page.goto(path);
      // Let any chart animations settle.
      await page.waitForTimeout(800);
      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
