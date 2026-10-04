import { test, expect, type Page } from '@playwright/test';
import { planA_simple } from '../src/engine/__golden/plans';
import { runProjection } from '../src/engine/projection';
import { fmtM } from '../src/lib/format';
import { PLAN_STORE_KEY } from '../src/store/planStoreVersion';
import type { Plan } from '../src/schemas/plan';
import { optimizedPlanA, seedPlan, heroStat, gotoDashboard } from './fixtures';

// The UI optimizer runs in a Web Worker; max-spending on planA takes ~5s in Node.
const OPTIMIZE_TIMEOUT = 60_000;

async function storedPlan(page: Page): Promise<Plan> {
  const raw = await page.evaluate((key) => localStorage.getItem(key), PLAN_STORE_KEY);
  return JSON.parse(raw!).state.plan;
}

const goalBadge = (page: Page, label: string) => page.locator('.badge', { hasText: `✓ ${label}` });
const pendingBanner = (page: Page) => page.getByText(/result ready/);

async function reoptimizeFor(page: Page, goal: string) {
  await page.getByRole('button', { name: goal, exact: true }).click();
  await page.getByRole('button', { name: /^↗ Re-optimize/ }).click();
  await expect(pendingBanner(page)).toBeVisible({ timeout: OPTIMIZE_TIMEOUT });
}

test('main pages render without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await seedPlan(page, optimizedPlanA());

  const pages: Array<[string, string]> = [
    ['inputs', 'Personal Details'],
    ['dashboard', 'Plan Summary'],
    ['projections', 'Year-by-Year Detail'],
    ['taxes', 'Your Projected Tax Trajectory'],
    ['montecarlo', 'Historical Sequence Analysis'],
  ];
  for (const [route, marker] of pages) {
    await page.goto(`/#/${route}`);
    await expect(page.getByText(marker, { exact: true }).first(), route).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('Build Plan (max end balance) saves the plan and opens the Dashboard with no pending banner', async ({ page }) => {
  await seedPlan(page, planA_simple());
  await page.goto('/#/inputs');
  await page.getByRole('button', { name: 'Build Plan →' }).click();
  await page.waitForURL('**/#/dashboard', { timeout: OPTIMIZE_TIMEOUT });

  await expect(goalBadge(page, 'Max End Balance')).toBeVisible();
  await expect(pendingBanner(page)).toHaveCount(0);
  await expect(page.getByText('explain optimization rationale →')).toBeVisible();
  // The worker run must match the Node run that seeds the other tests.
  await expect(heroStat(page, 'Gross End Balance')).toHaveText(fmtM(runProjection(optimizedPlanA()).endTotalReal));
  expect((await storedPlan(page)).optimizedForGoal).toBe('max-end-balance');
});

test('Re-optimize for max spending, then Apply saves the new strategy', async ({ page }) => {
  await seedPlan(page, optimizedPlanA());
  await gotoDashboard(page);
  await reoptimizeFor(page, 'Max Spending');

  await page.getByRole('button', { name: 'Apply to Plan' }).click();
  await expect(pendingBanner(page)).toHaveCount(0);
  await expect(goalBadge(page, 'Max Spending')).toBeVisible();
  expect((await storedPlan(page)).optimizedForGoal).toBe('max-sustainable-spending');
});

test('Re-optimize for max spending, then Discard leaves the saved plan unchanged', async ({ page }) => {
  const plan = optimizedPlanA();
  await seedPlan(page, plan);
  await gotoDashboard(page);
  const endBalance = fmtM(runProjection(plan).endTotalReal);
  await expect(heroStat(page, 'Gross End Balance')).toHaveText(endBalance);
  await reoptimizeFor(page, 'Max Spending');

  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(pendingBanner(page)).toHaveCount(0);
  await expect(goalBadge(page, 'Max End Balance')).toBeVisible();
  await expect(heroStat(page, 'Gross End Balance')).toHaveText(endBalance);
  expect(await storedPlan(page)).toEqual(plan);
});

test("Today's $ / Nominal $ toggle switches the end balance", async ({ page }) => {
  const plan = optimizedPlanA();
  const proj = runProjection(plan);
  expect(fmtM(proj.endTotalNominal)).not.toBe(fmtM(proj.endTotalReal));
  await seedPlan(page, plan);
  await gotoDashboard(page);

  await expect(heroStat(page, 'Gross End Balance')).toHaveText(fmtM(proj.endTotalReal));
  await page.getByRole('radio', { name: 'Nominal $' }).click();
  await expect(heroStat(page, 'Gross End Balance')).toHaveText(fmtM(proj.endTotalNominal));
  await page.getByRole('radio', { name: "Today's $" }).click();
  await expect(heroStat(page, 'Gross End Balance')).toHaveText(fmtM(proj.endTotalReal));
});

async function addIncomeStream(page: Page, amount: number) {
  await page.goto('/#/inputs');
  await page.getByRole('button', { name: '+ Add income stream' }).click();
  const amountInput = page.locator('.income-row').last().locator('.input-prefix-wrap input');
  await amountInput.fill(String(amount));
  await amountInput.blur();
}

test('an income change on Inputs updates the Plan Summary', async ({ page }) => {
  // No optimizer policy, so editing inputs does not gate the Dashboard.
  const base = planA_simple();
  await seedPlan(page, base);
  await addIncomeStream(page, 60_000);
  await page.getByRole('link', { name: 'Dashboard' }).click();

  const edited = await storedPlan(page);
  expect(edited.incomeStreams).toHaveLength(1);
  expect(edited.incomeStreams[0].annualAmount).toBe(60_000);
  const expected = fmtM(runProjection(edited).endTotalReal);
  expect(expected).not.toBe(fmtM(runProjection(base).endTotalReal));
  await expect(heroStat(page, 'Gross End Balance')).toHaveText(expected);
});

test('editing an input after optimizing gates the results pages', async ({ page }) => {
  await seedPlan(page, optimizedPlanA());
  await addIncomeStream(page, 60_000);
  await page.getByRole('link', { name: 'Dashboard' }).click();

  await expect(page.getByText('Your inputs have changed since the optimizer ran')).toBeVisible();
  await expect(page.getByText('Plan Summary', { exact: true })).toHaveCount(0);
});
