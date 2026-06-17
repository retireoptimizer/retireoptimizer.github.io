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

  // The top-of-panel template picker was removed; add a blank row via the inline
  // "+ Add income stream" button (it inserts an in-retirement, fully-taxable row).
  await page.getByRole('button', { name: /Add income stream/i }).click();

  // Probe the "Lifetime Fed Tax" cell: with the fresh-storage default plan the
  // portfolio is empty, so End Balance reads "—" regardless of income and is a poor
  // signal. Adding $120k of fully-taxable income deterministically moves lifetime
  // fed tax, so it's the robust witness that the income→projection→bar path is live.
  const taxCell = page.locator('div').filter({ hasText: /^Lifetime Fed Tax$/ }).first().locator('..');
  const before = await taxCell.locator('div').nth(1).textContent();

  // Row inputs in DOM order: description, startAge, stopAge, annualAmount, growthPct.
  // (whose/type are <select> not <input>, so they don't count.) annualAmount is nth(3).
  const amtInput = page.locator('.stream-row.income-row').last().locator('input').nth(3);
  await amtInput.click({ clickCount: 3 });
  await amtInput.fill('120000');
  await amtInput.blur();
  await page.waitForTimeout(300);

  const after = await taxCell.locator('div').nth(1).textContent();
  expect(after).not.toBe(before);
});
