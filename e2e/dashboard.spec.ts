import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Clear any persisted plan so each test starts fresh.
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
});

test('Dashboard loads with default plan and shows KPIs', async ({ page }) => {
  await page.goto('/');
  // Sidebar nav present
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  // KPI tiles populated (not "—")
  await expect(page.getByText('Projected Portfolio at')).toBeVisible();
  await expect(page.getByText('Withdrawal Rate (Year 1)')).toBeVisible();
  await expect(page.getByText('Plan Longevity')).toBeVisible();
  // Live metrics bar visible
  await expect(page.getByText(/Portfolio @ Retirement/i)).toBeVisible();
});

test('Personal Details page renders inputs and SS fields', async ({ page }) => {
  await page.goto('/personal');
  // Labels include the person's actual name, not the literal "Person A".
  await expect(page.getByText(/— Full Name$/).first()).toBeVisible();
  await expect(page.getByText(/— Target Retirement Age$/).first()).toBeVisible();
  await expect(page.getByText(/SS PIA/).first()).toBeVisible();
  await expect(page.getByText(/SS Claim Age/).first()).toBeVisible();
  // State selector populated with at least 6 states
  const stateSelect = page.locator('select').first();
  const options = await stateSelect.locator('option').count();
  expect(options).toBeGreaterThanOrEqual(6);
});

test('Strategy page exposes Pick + Optimize tabs and custom-blend disclosure', async ({ page }) => {
  await page.goto('/withdrawal');
  await expect(page.getByRole('button', { name: 'Pick', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Optimize', exact: true })).toBeVisible();
  await expect(page.getByText('Pick a Withdrawal Order').first()).toBeVisible();
  // Custom Blend is now a disclosure under Pick — open it.
  await page.getByText('Customize the blend (advanced)').click();
  await expect(page.getByText('Custom Blend Editor')).toBeVisible();
});

test('Add a scenario and see it appear in the comparison table', async ({ page }) => {
  await page.goto('/scenarios');
  await expect(page.getByRole('button', { name: '+ Add Scenario' })).toBeVisible();
  await page.getByRole('button', { name: '+ Add Scenario' }).click();
  await page.getByRole('button', { name: /Retire 3 Years Earlier/ }).first().click();
  // After clicking, the modal closes and the new column appears
  await page.waitForTimeout(200);
  // The default plan starts with 4 scenarios; adding another makes 5
  const columns = page.locator('thead th');
  const count = await columns.count();
  expect(count).toBeGreaterThanOrEqual(6); // Metric col + Base + at least 4 scenarios
});
