import type { Insight, InsightContext } from '../index';
import { householdTotals } from '../../../schemas/plan';

/** Initial Withdrawal Rate = first-year net spend / starting portfolio. Categorize
 *  against the 4% rule with conservative/aggressive bands. */
export function wrRule(ctx: InsightContext): Insight | null {
  const { plan, proj } = ctx;
  const totals = householdTotals(plan.portfolio);
  const startBal = totals.taxable + totals.traditional + totals.roth;
  if (startBal <= 0) return null;

  // Solo plans never enter 'Retire' phase because aliveB === false → 'Survivor'.
  // Find the first year that's both retirement-phase AND has positive spending —
  // pre-spending survivor years (e.g. FIRE before expenses start) skew WR to zero.
  const firstRetire = proj.rows.find(
    (r) => (r.phase === 'Retire' || r.phase === 'Survivor') && r.netSpend > 0,
  );
  if (!firstRetire) return null;

  const spendReal = firstRetire.netSpend / firstRetire.inflationFactor;
  if (spendReal <= 0) return null;

  // Use real starting balance — startBal is already today's $.
  const wr = spendReal / startBal;
  const pct = (wr * 100).toFixed(1);

  let severity: Insight['severity'];
  let label: string;
  let body: string;

  if (wr < 0.03) {
    severity = 'info';
    label = 'Conservative';
    body = `Initial withdrawal rate is ${pct}% — below the 4% rule. Plan likely has slack for higher spending, larger legacy, or earlier retirement.`;
  } else if (wr <= 0.04) {
    severity = 'info';
    label = 'Healthy';
    body = `Initial withdrawal rate is ${pct}% — at or below the 4% rule-of-thumb. Considered safe across historical sequences.`;
  } else if (wr <= 0.045) {
    severity = 'caution';
    label = 'Borderline';
    body = `Initial withdrawal rate is ${pct}% — above the 4% rule. Consider Monte Carlo success rate and stress scenarios before treating as safe.`;
  } else {
    severity = 'warning';
    label = 'Aggressive';
    body = `Initial withdrawal rate is ${pct}% — well above the 4% rule. Sequence-of-returns risk is elevated; consider reducing spending or delaying retirement.`;
  }

  return {
    id: 'wrBand',
    surfaces: ['dashboard', 'mc'],
    severity,
    priority: 60,
    title: `Initial withdrawal rate: ${label}`,
    body,
  };
}
