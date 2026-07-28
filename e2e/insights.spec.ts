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

test('Dashboard Plan Summary shows financial health stats for an all-Trad plan', async ({ page }) => {
  await page.goto('/dashboard');
  // Plan Summary banner with key stats should be present.
  await expect(page.getByText('End Balance', { exact: true })).toBeVisible();
  await expect(page.getByText('Lifetime RMDs', { exact: true })).toBeVisible();
  // All-Trad plan should have substantial RMDs — projection is non-trivial.
  await expect(page.getByText('Roth Converted', { exact: true })).toBeVisible();
});

test('Tax Planning surfaces the tax trajectory panel', async ({ page }) => {
  await page.goto('/taxes');
  await expect(page.getByText(/Your Projected Tax Trajectory/i).first()).toBeVisible();
});

// The Roth conversion benefit is the primary output surface for tax optimization
// insights — confirm Tax Planning hosts it.
test('Tax Planning hosts the Roth conversion comparison panels', async ({ page }) => {
  await page.goto('/taxes');
  await expect(page.getByText(/Roth Conversion Impact/i).first()).toBeVisible({ timeout: 10_000 });
});
