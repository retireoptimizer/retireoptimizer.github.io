import type { Insight, InsightContext } from '../index';
import { householdTotals } from '../../../schemas/plan';
import { fmtUSD } from '../../../lib/format';

/** Surfaces lifetime tax burden as % of starting net worth. Above 25% → conversion
 *  opportunity is likely material. */
export function taxRule(ctx: InsightContext): Insight | null {
  const { plan, proj } = ctx;
  const totals = householdTotals(plan.portfolio);
  const startBal = totals.taxable + totals.traditional + totals.roth;
  if (startBal <= 0) return null;

  // Lifetime federal tax in today's $.
  let lifetimeReal = 0;
  for (const r of proj.rows) lifetimeReal += r.fedTax / r.inflationFactor;

  const ratio = lifetimeReal / startBal;
  const pct = Math.round(ratio * 100);

  let severity: Insight['severity'];
  let title: string;
  let body: string;

  if (ratio < 0.10) {
    severity = 'info';
    title = `Lifetime tax is light (${pct}% of net worth)`;
    body = `Federal tax across the plan is ${fmtUSD(lifetimeReal)} (today's $) — about ${pct}% of starting balances. Little room to improve via tax strategy.`;
  } else if (ratio < 0.25) {
    severity = 'info';
    title = `Lifetime tax: ${pct}% of starting net worth`;
    body = `Federal tax across the plan is ${fmtUSD(lifetimeReal)} (today's $). Within typical range — modest conversion strategies could trim it further.`;
  } else {
    severity = 'caution';
    title = `Lifetime tax is heavy (${pct}% of net worth)`;
    body = `Federal tax across the plan is ${fmtUSD(lifetimeReal)} (today's $) — about ${pct}% of starting balances. This usually signals room for Roth conversion strategy before RMDs begin.`;
  }

  return {
    id: 'taxBurden',
    surfaces: ['dashboard', 'taxes', 'strategy'],
    severity,
    priority: 55,
    title,
    body,
  };
}
