import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Clear any persisted plan so each test starts fresh.
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test('Dashboard loads with default plan and shows live metrics on the global ribbon', async ({ page }) => {
  await page.goto('/dashboard');
  // Sidebar nav present
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  // Live metrics bar visible — the Dashboard KPI tiles were dropped (they
  // duplicated the global ribbon).
  await expect(page.getByText(/Portfolio @ Retirement/i)).toBeVisible();
  // The standalone "Plan Lasts To" card was folded into the End Balance cell, whose
  // subtext now carries the longevity status.
  await expect(page.getByText(/End Balance/i).first()).toBeVisible();
  await expect(page.getByText('Initial Withdrawal Rate', { exact: true })).toBeVisible();
});

test('Personal Details page renders the client-profile inputs', async ({ page }) => {
  await page.goto('/personal');
  // After the redesign, fields use sentence-case labels (no "— Full Name" row
  // headers) and the SS PIA / SS Claim Age inputs + callout were removed (SS now
  // comes from the Income & Expenses page).
  await expect(page.getByText('Your Name', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Retirement Age', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Plan-To Age', { exact: true }).first()).toBeVisible();
  // State selector populated with at least 6 states
  const stateSelect = page.locator('select').first();
  const options = await stateSelect.locator('option').count();
  expect(options).toBeGreaterThanOrEqual(6);
});

test('Set Goals page exposes the optimizer goal selector; Dashboard hosts the preset chips + Customize sheet', async ({ page }) => {
  // After the Set Goals refactor, the /strategy page is now the focused goal-picker
  // (3 optimizer goals only). Withdrawal-preset selection moved to Dashboard's
  // StrategyChooser, and the rich Conversion + Custom Blend UI moved into a
  // Customize side sheet triggered from Dashboard.
  await page.goto('/strategy');
  await expect(page.getByText(/what outcome do you want/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pick', exact: true })).toHaveCount(0);

  await page.goto('/dashboard');
  // Dashboard's StrategyChooser exposes preset chips.
  await expect(page.getByRole('button', { name: 'Tax-first', exact: true })).toBeVisible();
  // Customize opens the side sheet with the Custom Blend Editor.
  await page.getByRole('button', { name: /Customize/ }).click();
  await expect(page.getByText('Custom Blend Editor')).toBeVisible();
});

test('Add a scenario from the Dashboard template picker and see it appear in Pinned Comparisons', async ({ page }) => {
  // After the IA refactor, the standalone /scenarios route is gone. The
  // "+ Add From Template" affordance lives inline on the Dashboard's Pinned
  // Comparisons panel.
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: '+ Add From Template' })).toBeVisible();
  await page.getByRole('button', { name: '+ Add From Template' }).click();
  await page.getByRole('button', { name: /Retire 3 Years Earlier/ }).first().click();
  await page.waitForTimeout(200);
  // Dashboard's ScenarioCompare is limit=3 so only 3 scenario columns show, but the
  // header row still has at least Metric + Base + 3 scenarios.
  const columns = page.locator('thead th');
  const count = await columns.count();
  expect(count).toBeGreaterThanOrEqual(5);
});
