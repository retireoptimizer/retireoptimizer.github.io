import { test, expect } from '@playwright/test';
import { planF_allTradCouple } from '../src/engine/__golden/plans';

const STORAGE_KEY = 'fireopt-plan-v1';

test.beforeEach(async ({ page }) => {
  // High-balance Trad couple — guaranteed to trigger bracket cliff and IRMAA insights.
  const plan = planF_allTradCouple();
  const persisted = JSON.stringify({ state: { plan, displayMode: 'real', setupDismissed: true }, version: 0 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.addInitScript(
    ({ key, value }) => { window.localStorage.setItem(key, value); },
    { key: STORAGE_KEY, value: persisted },
  );
});

test('Dashboard surfaces an Insights panel for an all-Trad plan', async ({ page }) => {
  await page.goto('/dashboard');
  // Insights panel header should be present.
  await expect(page.getByText(/^Insights$/).first()).toBeVisible();
});

test('Tax Planning surfaces a Tax Insights panel', async ({ page }) => {
  await page.goto('/taxes');
  await expect(page.getByText(/Tax Insights/i).first()).toBeVisible();
});

// The Strategy page no longer hosts an "Impact on Taxes" output panel — those
// charts moved to Tax Planning during the IA refactor. The strategy-surface
// insights still exist in the engine but currently have no host surface.
// Confirm Tax Planning hosts the Key Tax Insights panel where it now lives.
test('Tax Planning hosts the Key Tax Insights panel (engine output surface)', async ({ page }) => {
  await page.goto('/taxes');
  await expect(page.getByText(/key tax insights/i).first()).toBeVisible({ timeout: 10_000 });
});
