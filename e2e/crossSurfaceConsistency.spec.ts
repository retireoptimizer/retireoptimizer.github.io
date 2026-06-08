import { test, expect } from '@playwright/test';
import { planA_simple } from '../src/engine/__golden/plans';

const STORAGE_KEY = 'fireopt-plan-v1';

/** Cross-surface consistency at the DOM level: the same underlying number must
 *  render identically wherever it appears.
 *
 *  Why this exists: each KPI today is computed inline at its render site (the
 *  LiveMetricsBar in AppShell.tsx, the metric-card tiles in Dashboard.tsx,
 *  the comparison rows in ScenarioCompare, etc.). Two independent computations
 *  of the same concept can drift — e.g. one uses `r.ageA >= retAge`, the other
 *  uses `r.ageA === retAge`. This suite locks them together. */

test.beforeEach(async ({ page }) => {
  const plan = planA_simple();
  const persisted = JSON.stringify({ state: { plan, displayMode: 'real', setupDismissed: true }, version: 0 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.addInitScript(
    ({ key, value }) => { window.localStorage.setItem(key, value); },
    { key: STORAGE_KEY, value: persisted },
  );
});

/** Read the value of a sticky LiveMetricsBar cell by its uppercase label
 *  ("PORTFOLIO @ RETIREMENT", "PLAN LASTS TO", "END BALANCE", "LIFETIME FED TAX",
 *  "INITIAL WITHDRAWAL RATE"). The cell renders <div label/><div value/><div sub/>. */
async function readLMBValue(page: import('@playwright/test').Page, label: string): Promise<string> {
  // The label div uses uppercase styling but inner text is title-case as authored.
  const labelDiv = page.locator('div', { hasText: new RegExp(`^${label}$`, 'i') }).first();
  const cell = labelDiv.locator('..');
  const value = await cell.locator('div').nth(1).textContent();
  return (value ?? '').trim();
}

/** Strip cosmetic decoration so we compare just the numeric meat.
 *  e.g. "Age 98" → "98"; "$5.21M" → "5.21M"; "3.6%" → "3.6". */
function normalizeNumeric(s: string): string {
  return s
    .replace(/^Age\s+/i, '')
    .replace(/^\$/, '')
    .replace(/\s+/g, '')
    .trim();
}

// Dashboard KPI tiles were removed in the chip-chooser refactor — they duplicated
// the global LiveMetricsBar. Cross-surface consistency between the two is now
// trivially preserved (only one rendering site), so the prior 4 tile-vs-LMB
// tests are gone. The remaining test below checks the *Lifetime Totals* panel
// (a different surface that still exists on Dashboard) against the LMB End Balance.

test('After toggling to Nominal, Dashboard End-of-Plan Balance === LiveMetricsBar End Balance (nominal $)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: /Nominal \$/i }).click();

  const lmb = await readLMBValue(page, 'End Balance');
  // Dashboard End-of-Plan Balance lives in the Lifetime Totals panel (not a
  // .metric-label tile). Look it up by its inline label.
  const dashEnd = await page.locator('div', { hasText: /^End-of-Plan Balance$/i }).first().locator('..').locator('div').nth(1).textContent();
  expect(normalizeNumeric(dashEnd ?? '')).toBe(normalizeNumeric(lmb));
});
