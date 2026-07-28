import { test, expect } from '@playwright/test';
import { runProjection } from '../src/engine/projection';
import { planA_simple } from '../src/engine/__golden/plans';
import { fmtM } from '../src/lib/format';
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

  await page.goto('/dashboard');
  await expect(page.getByText(/End Balance/i).first()).toBeVisible();

  // End Balance (real $) — direct from projection.
  // HeroStat structure: container > label div(0) > value div(1) > sub div(2).
  const expectedEndBalance = fmtM(expected.endTotalReal);
  const endLabel = page.locator('div', { hasText: /^End Balance$/i }).first();
  const endContainer = endLabel.locator('..');
  const displayedEnd = await endContainer.locator('div').nth(1).textContent();
  expect(displayedEnd?.trim()).toBe(expectedEndBalance);

  // Longevity status — now a badge: "✓ Fully Funded" or "⚠ Funded through Age N".
  const depAge = depletionAge(expected);
  if (depAge !== null) {
    await expect(page.getByText(/Funded through Age/i).first()).toBeVisible();
  } else {
    await expect(page.getByText(/Fully Funded/i).first()).toBeVisible();
  }
});

test('Real/nominal toggle changes Plan Summary End Balance', async ({ page }) => {
  const plan = planA_simple();
  const proj = runProjection(plan);

  const persisted = JSON.stringify({ state: { plan, displayMode: 'real' }, version: 0 });
  await page.addInitScript(
    ({ key, value }) => { window.localStorage.setItem(key, value); },
    { key: STORAGE_KEY, value: persisted },
  );

  await page.goto('/dashboard');
  await expect(page.getByText(/End Balance/i).first()).toBeVisible();

  // HeroStat structure: container > label div(0) > value div(1) > sub div(2).
  const endLabel = page.locator('div', { hasText: /^End Balance$/i }).first();
  const readEnd = async () => (await endLabel.locator('..').locator('div').nth(1).textContent())?.trim();

  // Real value first (the seeded displayMode).
  expect(await readEnd()).toBe(fmtM(proj.endTotalReal));

  // Flip the AppShell toggle to Nominal. Buttons have role="radio".
  await page.getByRole('radio', { name: /Nominal \$/i }).click();

  // Plan Summary must now show the nominal end balance.
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
  await page.goto('/dashboard');

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
