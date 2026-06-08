import type { Insight, InsightContext } from '../index';
import { fmtUSD } from '../../../lib/format';

/** Surfaces end-of-plan balances, separating Roth (tax-free legacy) from other buckets. */
export function legacyRule(ctx: InsightContext): Insight | null {
  const { proj } = ctx;
  if (proj.rows.length === 0 || proj.ranOut) return null;
  const last = proj.rows[proj.rows.length - 1];
  const endRothReal = last.endRoth / last.inflationFactor;
  const endTotalReal = proj.endTotalReal;
  if (endTotalReal < 100_000) return null;

  const rothPct = endTotalReal > 0 ? Math.round((endRothReal / endTotalReal) * 100) : 0;
  return {
    id: 'legacyRoth',
    surfaces: ['dashboard', 'strategy'],
    severity: 'info',
    priority: 40,
    title: `Tax-free legacy: ${fmtUSD(endRothReal)}`,
    body: `Plan ends with ${fmtUSD(endTotalReal)} total (today's $), of which ${fmtUSD(endRothReal)} is Roth — passed tax-free to heirs. That's ${rothPct}% of the ending balance.`,
  };
}
