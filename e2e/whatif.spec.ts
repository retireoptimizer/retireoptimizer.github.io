import { test, expect } from '@playwright/test';
import { planA_simple } from '../src/engine/__golden/plans';

const STORAGE_KEY = 'fireopt-plan-v1';

test.beforeEach(async ({ page }) => {
  const plan = planA_simple();
  const persisted = JSON.stringify({ state: { plan, displayMode: 'real', setupDismissed: true }, version: 0 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.addInitScript(
    ({ key, value }) => { window.localStorage.setItem(key, value); },
    { key: STORAGE_KEY, value: persisted },
  );
});

test('What-If bar is present and collapsible on Dashboard', async ({ page }) => {
  await page.goto('/');
  // The collapsed bar exposes a toggle/heading like "What-If" — find the trigger.
  const trigger = page.getByText(/What[-\s]?If/i).first();
  await expect(trigger).toBeVisible();
});

test('What-If bar is present on Projections', async ({ page }) => {
  await page.goto('/projections');
  const trigger = page.getByText(/What[-\s]?If/i).first();
  await expect(trigger).toBeVisible();
});

// Dashboard KPI tiles (and their comparative-anchor subtext) were removed in the
// chip-chooser refactor — they duplicated the LiveMetricsBar. The 4%-rule context
// now lives in the LMB Initial Withdrawal Rate cell subtext only.
