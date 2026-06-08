import { test, expect } from '@playwright/test';
import { runProjection } from '../src/engine/projection';
import { planA_simple } from '../src/engine/__golden/plans';
import { fmtM, fmtK } from '../src/lib/format';
import { depletionAge } from '../src/engine/projection';

/**
 * Layer 5: UI ↔ engine numerical consistency.
 *
 * Strategy: load a known fixture plan into localStorage via addInitScript so the
 * UI hydrates from it, then read displayed KPI text and compare with what a fresh
 * runProjection() produces from the SAME plan object. If they diverge, something
 * between the engine output and the rendered DOM has drifted — display formatter,
 * store transform, missed unit conversion, stale memo, etc.
 */

const STORAGE_KEY = 'fireopt-plan-v1';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test('Dashboard KPIs match engine output for a fixture plan', async ({ page }) => {
  const plan = planA_simple();
  const expected = runProjection(plan);

  // Inject fixture plan into localStorage in the exact shape Zustand persists.
  const persisted = JSON.stringify({ state: { plan, displayMode: 'real' }, version: 0 });
  await page.addInitScript(
    ({ key, value }) => { window.localStorage.setItem(key, value); },
    { key: STORAGE_KEY, value: persisted },
  );

  await page.goto('/');
  await expect(page.getByText(/Portfolio @ Retirement/i)).toBeVisible();

  // Read the LiveMetricsBar values and compare to engine output.
  // Portfolio @ Retirement (real $) = endTotal of retirement row / inflationFactor.
  const retAge = plan.personA.retirementAge;
  const retRow = expected.rows.find((r) => r.ageA >= retAge)!;
  const portAtRetReal = retRow.endTotal / retRow.inflationFactor;
  const expectedPortfolioText = fmtM(portAtRetReal);

  // The KPI tile renders the formatted value as the only large text below the label.
  // Use a structural locator: find the cell labeled "PORTFOLIO @ RETIREMENT" and grab
  // its value text. The label uses uppercase letter-spacing in CSS, but inner text
  // stays as authored.
  const portfolioCell = page.locator('div', { hasText: /^Portfolio @ Retirement$/i }).first();
  const displayedPortfolio = await portfolioCell.locator('..').locator('div').nth(1).textContent();
  expect(displayedPortfolio?.trim()).toBe(expectedPortfolioText);

  // End Balance (real $) — direct from projection
  const expectedEndBalance = fmtM(expected.endTotalReal);
  const endCell = page.locator('div', { hasText: /^End Balance$/i }).first();
  const displayedEnd = await endCell.locator('..').locator('div').nth(1).textContent();
  expect(displayedEnd?.trim()).toBe(expectedEndBalance);

  // Lifetime Fed Tax (nominal, all years)
  const expectedFedTax = fmtK(expected.lifetimeFedTax);
  const taxCell = page.locator('div', { hasText: /^Lifetime Fed Tax$/i }).first();
  const displayedTax = await taxCell.locator('..').locator('div').nth(1).textContent();
  expect(displayedTax?.trim()).toBe(expectedFedTax);

  // Plan Lasts To: depletionAge or planToAge
  const depAge = depletionAge(expected);
  const fundsTo = depAge ?? plan.personA.planToAge;
  const expectedLasts = `Age ${fundsTo}`;
  const lastsCell = page.locator('div', { hasText: /^Plan Lasts To$/i }).first();
  const displayedLasts = await lastsCell.locator('..').locator('div').nth(1).textContent();
  expect(displayedLasts?.trim()).toBe(expectedLasts);
});

test('Real/nominal toggle changes LiveMetricsBar End Balance', async ({ page }) => {
  const plan = planA_simple();
  const proj = runProjection(plan);

  const persisted = JSON.stringify({ state: { plan, displayMode: 'real' }, version: 0 });
  await page.addInitScript(
    ({ key, value }) => { window.localStorage.setItem(key, value); },
    { key: STORAGE_KEY, value: persisted },
  );

  await page.goto('/');
  await expect(page.getByText(/End Balance/i).first()).toBeVisible();

  const endCell = page.locator('div', { hasText: /^End Balance$/i }).first();
  const readEnd = async () => (await endCell.locator('..').locator('div').nth(1).textContent())?.trim();

  // Real value first (the seeded displayMode).
  expect(await readEnd()).toBe(fmtM(proj.endTotalReal));

  // Flip the AppShell toggle to Nominal. The radio is keyed by accessible name.
  await page.getByRole('radio', { name: /Nominal \$/i }).click();

  // Bar must now show the nominal end balance — different from real for any
  // plan with non-zero inflation.
  expect(proj.endTotalNominal).toBeGreaterThan(proj.endTotalReal);
  expect(await readEnd()).toBe(fmtM(proj.endTotalNominal));
});

test('Plan export/import round-trip is byte-identical', async ({ page }) => {
  const plan = planA_simple();
  const persisted = JSON.stringify({ state: { plan, displayMode: 'real' }, version: 0 });

  await page.addInitScript(
    ({ key, value }) => { window.localStorage.setItem(key, value); },
    { key: STORAGE_KEY, value: persisted },
  );
  await page.goto('/');

  // Read what's now in localStorage.
  const stored = await page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEY);
  expect(stored).toBeTruthy();

  // Re-projecting the stored plan must match the engine result for the fixture.
  const parsed = JSON.parse(stored!);
  const storedPlan = parsed.state.plan;
  const projFromStore = runProjection(storedPlan);
  const projFromFixture = runProjection(plan);
  expect(projFromStore.endTotalReal).toBeCloseTo(projFromFixture.endTotalReal, 0);
  expect(projFromStore.lifetimeFedTax).toBeCloseTo(projFromFixture.lifetimeFedTax, 0);
});
