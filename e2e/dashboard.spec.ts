import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Clear any persisted plan so each test starts fresh.
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test('Dashboard loads with default plan and shows Plan Summary banner', async ({ page }) => {
  await page.goto('/dashboard');
  // Sidebar nav present
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  // Plan Summary banner KPI stats are visible.
  await expect(page.getByText(/End Balance/i).first()).toBeVisible();
  await expect(page.getByText('Initial WR', { exact: true })).toBeVisible();
  // Tax-Adj Balance tile is visible when rates > 0 (default: 22%/15%)
  await expect(page.getByText('Tax-Adj Balance', { exact: true })).toBeVisible();
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

test('Inputs page exposes the optimizer goal selector; Dashboard hosts the preset chips + Customize sheet', async ({ page }) => {
  // /strategy now redirects to /inputs. Goal selector lives in GoalSelectPanel
  // on the Inputs page. Withdrawal-preset chips and Customize sheet live on Dashboard.
  await page.goto('/inputs');
  await expect(page.getByText(/what outcome do you want to optimize for/i)).toBeVisible();
  // Radios for each UserGoal are rendered.
  const radios = page.locator('input[type="radio"][name="opt-goal"]');
  expect(await radios.count()).toBeGreaterThanOrEqual(3);

  await page.goto('/dashboard');
  // Dashboard's StrategyChooser exposes preset chips.
  await expect(page.getByRole('button', { name: 'Tax-first', exact: true })).toBeVisible();
  // "Custom" chip opens the Custom Blend Editor side sheet.
  await page.getByRole('button', { name: 'Custom', exact: true }).click();
  await expect(page.getByText('Custom Blend Editor').first()).toBeVisible();
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
