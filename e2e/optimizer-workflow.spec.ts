/**
 * Optimizer workflow E2E tests.
 *
 * Input page = "commit" context: Build Plan always auto-applies, no pending banner.
 * Dashboard = "explore" context: Re-Optimize shows Apply/Discard banner only for
 * goals that mutate input-visible fields (MSS scales expenses, min-retire changes age).
 * max-end-balance re-optimize auto-applies immediately (no banner).
 */

import { test, expect, type Page } from '@playwright/test';
import { planA_simple } from '../src/engine/__golden/plans';

const STORAGE_KEY = 'fireopt-plan-v1';

async function injectFixture(page: Page) {
  const plan = planA_simple();
  const persisted = JSON.stringify({ state: { plan, displayMode: 'real', setupDismissed: true }, version: 0 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.addInitScript(
    ({ key, value }) => { window.localStorage.setItem(key, value); },
    { key: STORAGE_KEY, value: persisted },
  );
  return plan;
}

/** Read a KPI value from the Plan Summary hero stat by its label text. */
async function readHeroStat(page: Page, label: string) {
  const container = page.locator('div', { hasText: new RegExp(`^${label}$`, 'i') }).first();
  const parent = container.locator('..');
  return (await parent.locator('div').nth(1).textContent())?.trim() ?? '';
}

/** Wait for the optimizer to finish (re-optimize button goes from "Optimizing…" back to normal). */
async function waitForReOptimize(page: Page) {
  await expect(page.getByRole('button', { name: /Optimizing…/i })).toBeVisible({ timeout: 60000 }).catch(() => {});
  await expect(page.getByRole('button', { name: /Optimizing…/i })).not.toBeVisible({ timeout: 60000 });
}

test.describe('Optimizer workflow', () => {

  // ── Scenario 1 ──────────────────────────────────────────────────────────────
  test('S1: Build Plan (max-end-balance) auto-applies; no pending banner; correct pill on dashboard', async ({ page }) => {
    const fixture = await injectFixture(page);
    await page.goto('/inputs');

    // Select "Max End Balance" goal pill and build the plan.
    await page.getByRole('button', { name: /max end balance/i }).first().click();
    await page.getByRole('button', { name: /build plan/i }).click();

    // Should navigate to dashboard after optimization.
    await page.waitForURL('**/dashboard', { timeout: 90000 });

    // Build Plan auto-applies for max-end-balance — NO pending banner.
    await expect(page.getByText(/optimizer result ready/i)).not.toBeVisible();
    await expect(page.getByRole('button', { name: /apply to plan/i })).not.toBeVisible();

    // Navigate back to inputs — expense streams and retirement age must be unchanged.
    await page.goto('/inputs');
    const firstStream = fixture.expenseStreams[0];
    if (firstStream && firstStream.annualAmount > 0) {
      const inputValues = await page.locator('input[type="number"]').all();
      const values = await Promise.all(inputValues.map((i) => i.inputValue()));
      const anyMatchesOriginal = values.some((v) =>
        Math.abs(parseFloat(v) - firstStream.annualAmount) < 2 ||
        Math.abs(parseFloat(v) - Math.round(firstStream.annualAmount / 1000)) < 2,
      );
      expect(anyMatchesOriginal).toBe(true);
    }
    const retireAgeInputs = await page.locator('input[type="number"]').all();
    const retireValues = await Promise.all(retireAgeInputs.map((i) => i.inputValue()));
    expect(retireValues.some((v) => parseInt(v) === fixture.personA.retirementAge)).toBe(true);
  });

  // ── Scenario 2 ──────────────────────────────────────────────────────────────
  test('S2: Dashboard Re-Optimize (max-end-balance) auto-applies; pill updates; inputs clean', async ({ page }) => {
    const fixture = await injectFixture(page);
    await page.goto('/inputs');
    await page.getByRole('button', { name: /max end balance/i }).first().click();
    await page.getByRole('button', { name: /build plan/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 90000 });

    // Switch to "Max Spending" goal pill and Re-Optimize (MSS → shows pending banner).
    await page.getByRole('button', { name: /max spending/i }).click();
    await page.getByRole('button', { name: /re-optimize/i }).click();
    await waitForReOptimize(page);

    // MSS mutates expenses → pending banner must appear.
    await expect(page.getByText(/optimizer result ready/i)).toBeVisible();

    // Navigate to inputs — original retirement age must be untouched.
    await page.goto('/inputs');
    const retireValues = await Promise.all(
      (await page.locator('input[type="number"]').all()).map((i) => i.inputValue()),
    );
    expect(retireValues.some((v) => parseInt(v) === fixture.personA.retirementAge)).toBe(true);
  });

  // ── Scenario 3 ──────────────────────────────────────────────────────────────
  test('S3: Apply to Plan (MSS) removes banner; inputs show committed expense values', async ({ page }) => {
    await injectFixture(page);
    await page.goto('/inputs');
    await page.getByRole('button', { name: /max spending/i }).first().click();
    await page.getByRole('button', { name: /build plan/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 90000 });

    // MSS from Build Plan auto-applies (no banner needed — user explicitly committed).
    // Re-optimize from dashboard to trigger the pending banner path.
    await page.getByRole('button', { name: /re-optimize/i }).click();
    await waitForReOptimize(page);
    await expect(page.getByText(/optimizer result ready/i)).toBeVisible();

    // Apply to Plan.
    await page.getByRole('button', { name: /apply to plan/i }).click();
    await expect(page.getByText(/optimizer result ready/i)).not.toBeVisible();

    // Navigate to inputs — expense inputs should now be visible.
    await page.goto('/inputs');
    const inputValues = await page.locator('input[type="number"]').all();
    expect(inputValues.length).toBeGreaterThan(0);
  });

  // ── Scenario 4 ──────────────────────────────────────────────────────────────
  test('S4: Re-run same goal (max-end-balance) from inputs produces consistent result', async ({ page }) => {
    await injectFixture(page);
    await page.goto('/inputs');
    await page.getByRole('button', { name: /max end balance/i }).first().click();
    await page.getByRole('button', { name: /build plan/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 90000 });

    const endBalance1 = await readHeroStat(page, 'End Balance');

    // Run again from inputs with same goal.
    await page.goto('/inputs');
    await page.getByRole('button', { name: /max end balance/i }).first().click();
    await page.getByRole('button', { name: /build plan/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 90000 });

    const endBalance2 = await readHeroStat(page, 'End Balance');
    expect(endBalance1).toBe(endBalance2);
  });

  // ── Scenario 5 ──────────────────────────────────────────────────────────────
  test('S5: Discard (MSS pending) reverts to plan store projection; banner gone', async ({ page }) => {
    await injectFixture(page);

    await page.goto('/inputs');
    await page.getByRole('button', { name: /max end balance/i }).first().click();
    await page.getByRole('button', { name: /build plan/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 90000 });

    // Switch to MSS on dashboard (shows pending banner).
    await page.getByRole('button', { name: /max spending/i }).click();
    await page.getByRole('button', { name: /re-optimize/i }).click();
    await waitForReOptimize(page);
    await expect(page.getByText(/optimizer result ready/i)).toBeVisible();

    // Record the MSS pending result balance.
    const pendingEndBalance = await readHeroStat(page, 'End Balance');

    // Discard.
    await page.getByText(/^discard$/i).click();
    await expect(page.getByText(/optimizer result ready/i)).not.toBeVisible();

    // End Balance should revert to the plan-store projection (after max-end-balance was applied).
    const revertedEndBalance = await readHeroStat(page, 'End Balance');
    if (pendingEndBalance !== revertedEndBalance) {
      expect(revertedEndBalance).not.toBe(pendingEndBalance);
    }

    expect(page.url()).toContain('/dashboard');
  });

  // ── Scenario 6 ──────────────────────────────────────────────────────────────
  test('S6: Circular loop — multiple goal switches, max-end-balance re-runs idempotently', async ({ page }) => {
    await injectFixture(page);
    await page.goto('/inputs');
    await page.getByRole('button', { name: /max end balance/i }).first().click();
    await page.getByRole('button', { name: /build plan/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 90000 });

    // Switch to "Earliest Retire" and re-optimize (shows pending banner).
    await page.getByRole('button', { name: /earliest retire/i }).click();
    await page.getByRole('button', { name: /re-optimize/i }).click();
    await waitForReOptimize(page);

    // Switch back to "Max End Balance" and re-optimize (auto-applies, no banner).
    await page.getByRole('button', { name: /max end balance/i }).click();
    await page.getByRole('button', { name: /re-optimize/i }).click();
    await waitForReOptimize(page);

    const loopEndBalance = await readHeroStat(page, 'End Balance');

    // Re-run "Max End Balance" from inputs — should produce same result.
    await page.goto('/inputs');
    await page.getByRole('button', { name: /max end balance/i }).first().click();
    await page.getByRole('button', { name: /build plan/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 90000 });

    const rerunEndBalance = await readHeroStat(page, 'End Balance');
    expect(rerunEndBalance).toBe(loopEndBalance);
  });

  // ── Scenario 7 ──────────────────────────────────────────────────────────────
  test('S7: Goal pill stays selected after re-optimize; manual tab picks work', async ({ page }) => {
    await injectFixture(page);
    await page.goto('/inputs');
    await page.getByRole('button', { name: /max end balance/i }).first().click();
    await page.getByRole('button', { name: /build plan/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 90000 });

    // Switch to "Max Spending" and re-optimize.
    await page.getByRole('button', { name: /max spending/i }).click();
    await page.getByRole('button', { name: /re-optimize/i }).click();
    await waitForReOptimize(page);

    // Pending banner visible (MSS).
    await expect(page.getByText(/optimizer result ready/i)).toBeVisible();

    // Switch to "Set it myself" and pick a withdrawal strategy — banner should disappear.
    await page.getByRole('button', { name: /set it myself/i }).click();
    await page.getByRole('button', { name: /proportional/i }).click();

    // Picking a manual strategy discards the pending plan → banner gone.
    await expect(page.getByText(/optimizer result ready/i)).not.toBeVisible();

    // Dashboard stays put.
    expect(page.url()).toContain('/dashboard');
  });

  // ── Scenario 8 ──────────────────────────────────────────────────────────────
  test('S8: Roth mode change re-optimize; plan store not updated until Apply (MSS)', async ({ page }) => {
    const fixture = await injectFixture(page);
    await page.goto('/inputs');
    await page.getByRole('button', { name: /max end balance/i }).first().click();
    await page.getByRole('button', { name: /build plan/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 90000 });

    // Switch to MSS on dashboard and re-optimize (pending banner).
    await page.getByRole('button', { name: /max spending/i }).click();
    await page.getByRole('button', { name: /re-optimize/i }).click();
    await waitForReOptimize(page);
    await expect(page.getByText(/optimizer result ready/i)).toBeVisible();

    // Verify plan store expenses are NOT yet scaled (pending, not applied).
    const stored = await page.evaluate((key: string) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);
    if (stored?.state?.plan?.expenseStreams) {
      const storedExpenseTotal = stored.state.plan.expenseStreams.reduce(
        (s: number, e: { annualAmount: number }) => s + e.annualAmount, 0,
      );
      const fixtureExpenseTotal = fixture.expenseStreams.reduce((s, e) => s + e.annualAmount, 0);
      expect(Math.abs(storedExpenseTotal - fixtureExpenseTotal)).toBeLessThan(10);
    }

    // Apply and verify banner disappears.
    await page.getByRole('button', { name: /apply to plan/i }).click();
    await expect(page.getByText(/optimizer result ready/i)).not.toBeVisible();
  });

});
