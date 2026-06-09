import type { Insight, InsightContext } from '../index';
import { initialWithdrawalRate } from '../../projection';

/** Initial Withdrawal Rate = first retirement-year portfolio withdrawals ÷
 *  portfolio value at the start of that year. Uses the shared engine helper so
 *  this insight always agrees with the top-bar figure (and reacts to the
 *  withdrawal strategy). Categorized against the 4% rule. */
export function wrRule(ctx: InsightContext): Insight | null {
  const { proj } = ctx;

  const wr = initialWithdrawalRate(proj);
  if (wr <= 0) return null;
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
