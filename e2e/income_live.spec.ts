import { test, expect } from '@playwright/test';

/** Regression: editing an in-retirement income stream must update the sticky
 *  LiveMetricsBar immediately. Reported 2026-05 — user could not tell whether
 *  income changes were flowing through to the projection. The wiring is correct;
 *  this test guards against regressions to the IncomeStream → store → projection
 *  → LiveMetricsBar path. (Pre-retirement Wages streams are intentionally
 *  excluded — see engine/projection.ts; they do not affect portfolio math.) */
test('Income changes update the LiveMetricsBar', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto('/income');

  await page.getByRole('button', { name: /Add Stream/i }).click();
  await page.locator('button').filter({ hasText: 'Fully taxable, light COLA' }).click();

  const endBalCell = page.locator('div').filter({ hasText: /^End Balance$/ }).first().locator('..');
  const before = await endBalCell.locator('div').nth(1).textContent();

  // Row inputs in DOM order: description, startAge, stopAge, annualAmount, growthPct.
  // (whose/type are <select> not <input>, so they don't count.) annualAmount is nth(3).
  const amtInput = page.locator('.stream-row.income-row').last().locator('input').nth(3);
  await amtInput.click({ clickCount: 3 });
  await amtInput.fill('120000');
  await amtInput.blur();
  await page.waitForTimeout(300);

  const after = await endBalCell.locator('div').nth(1).textContent();
  expect(after).not.toBe(before);
});
