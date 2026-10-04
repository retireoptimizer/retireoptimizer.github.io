import { expect, type Page } from '@playwright/test';
import { planA_simple } from '../src/engine/__golden/plans';
import { optimizeStrategy } from '../src/engine/optimizer';
import { applyResultToPlan } from '../src/engine/applyOptimizerResult';
import { PLAN_STORE_KEY, PLAN_STORE_VERSION } from '../src/store/planStoreVersion';
import type { Plan } from '../src/schemas/plan';

export const BUILD_OPTIONS = { useNelderMead: true, thorough: true } as const;

let optimizedA: Plan | undefined;

/** planA_simple after a max-end-balance optimizer run with the UI's options: the plan Build Plan would save. */
export function optimizedPlanA(): Plan {
  optimizedA ??= applyResultToPlan(planA_simple(), optimizeStrategy(planA_simple(), 'max-end-balance', BUILD_OPTIONS));
  return structuredClone(optimizedA);
}

/** Seeds the persisted plan store once per tab, so later reloads keep changes made in the UI. */
export async function seedPlan(page: Page, plan: Plan, displayMode: 'real' | 'nominal' = 'real') {
  const value = JSON.stringify({ state: { plan, displayMode, setupDismissed: true }, version: PLAN_STORE_VERSION });
  await page.addInitScript(({ key, value }) => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    localStorage.clear();
    localStorage.setItem(key, value);
    sessionStorage.setItem('e2e-seeded', '1');
  }, { key: PLAN_STORE_KEY, value });
}

/** Value of a Plan Summary hero stat on the Dashboard, e.g. "Gross End Balance". */
export function heroStat(page: Page, label: string) {
  return page.getByText(label, { exact: true }).locator('xpath=following-sibling::div[1]');
}

export async function gotoDashboard(page: Page) {
  await page.goto('/#/dashboard');
  await expect(page.getByText('Plan Summary', { exact: true })).toBeVisible();
}
