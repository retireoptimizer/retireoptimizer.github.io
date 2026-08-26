import type { Insight, InsightContext } from '../index';
import { FED_BRACKETS_MFJ, FED_BRACKETS_SINGLE, SS_TAXABLE_PCT } from '../../taxConstants';
import { fmtUSD } from '../../../lib/format';

/** Detects a year where the household crosses from one marginal bracket to a higher
 *  one — typically because RMDs and SS taxable portion stack on top of withdrawals.
 *  Reports the first crossing only (the most actionable). */
export function bracketCliffRule(ctx: InsightContext): Insight | null {
  const { proj } = ctx;
  if (proj.rows.length < 2) return null;

  let prevBracket = -1;
  let firstCrossAge: number | null = null;
  let toRate = 0;
  let fromRate = 0;
  let driverRmd = 0;

  for (const r of proj.rows) {
    if (r.phase === 'Accum.') continue;
    // Survivor phase counts as retirement-side here (single-filer years).
    const brackets = r.filingStatus === 'MFJ' ? FED_BRACKETS_MFJ : FED_BRACKETS_SINGLE;
    const taxable = Math.max(0, r.ordIncome - r.stdDeduction);
    let bIdx = 0;
    for (let i = 0; i < brackets.length; i++) {
      const cap = brackets[i][0] === Infinity ? Infinity : brackets[i][0] * r.inflationFactor;
      if (taxable <= cap) { bIdx = i; break; }
    }
    if (prevBracket >= 0 && bIdx > prevBracket && firstCrossAge === null) {
      firstCrossAge = r.ageA;
      fromRate = brackets[prevBracket][1];
      toRate = brackets[bIdx][1];
      driverRmd = r.rmd / r.inflationFactor;
    }
    prevBracket = bIdx;
  }

  // FP epsilon: bracket rates like 0.24 - 0.22 = 0.0199999… so use a sub-2% floor
  // to ensure a true 2pp step (22→24 or 12→22) always fires.
  if (firstCrossAge === null || toRate - fromRate < 0.019) return null;

  const ssCausedByConv = proj.rows.some((r) => r.ageA === firstCrossAge && r.rothConv > 0);
  const driverPhrase = driverRmd > 25_000
    ? `RMDs of ${fmtUSD(driverRmd)} (today's $)`
    : ssCausedByConv
      ? 'Roth conversions stacking on Social Security'
      : 'Social Security becoming taxable';

  return {
    id: 'bracketCliff',
    surfaces: ['dashboard', 'strategy', 'taxes'],
    severity: 'caution',
    priority: 80,
    title: `Tax bracket jumps at age ${firstCrossAge}`,
    body: `Marginal rate steps from ${Math.round(fromRate * 100)}% to ${Math.round(toRate * 100)}% — driven by ${driverPhrase}. Pre-${firstCrossAge} Roth conversions can spread this income into the lower bracket.`,
    evidence: `Taxable SS portion is ${Math.round(SS_TAXABLE_PCT * 100)}% of benefits.`,
  };
}
