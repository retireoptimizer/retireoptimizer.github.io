import { test, expect } from '@playwright/test';
import { planA_simple } from '../src/engine/__golden/plans';
import { runProjection } from '../src/engine/projection';
import { fmtM } from '../src/lib/format';
import type { IncomeStream } from '../src/schemas/plan';

const STORAGE_KEY = 'fireopt-plan-v1';

/** Regression: income streams must flow through to the Dashboard projection.
 *  Tests the store → projection → Dashboard render pipeline by comparing two
 *  plans that differ only in an income stream, confirming the End Balance changes. */
test('Income changes update the Plan Summary', async ({ page }) => {
  const basePlan = planA_simple();

  const withIncome = {
    ...basePlan,
    incomeStreams: [
      ...basePlan.incomeStreams,
      {
        id: 'test-income',
        description: 'Test Income',
        whose: 'Household',
        type: 'Other',
        startAge: basePlan.personA.retirementAge,
        stopAge: basePlan.personA.planToAge,
        annualAmount: 120_000,
        growthPct: 0,
        taxablePct: 1,
      } satisfies IncomeStream,
    ],
  };

  // Confirm the two plans produce different End Balances in the engine.
  const projBase = runProjection(basePlan);
  const projWith = runProjection(withIncome);
  expect(projWith.endTotalReal).not.toBeCloseTo(projBase.endTotalReal, -3);

  // Load withIncome plan into the app and verify the Dashboard reflects it.
  const persisted = JSON.stringify({ state: { plan: withIncome, displayMode: 'real' }, version: 0 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.addInitScript(
    ({ key, value }) => { window.localStorage.setItem(key, value); },
    { key: STORAGE_KEY, value: persisted },
  );

  await page.goto('/dashboard');
  await expect(page.getByText('End Balance', { exact: true })).toBeVisible();

  const endLabel = page.locator('div', { hasText: /^End Balance$/ }).first();
  const displayed = await endLabel.locator('..').locator('div').nth(1).textContent();
  expect(displayed?.trim()).toBe(fmtM(projWith.endTotalReal));
});
