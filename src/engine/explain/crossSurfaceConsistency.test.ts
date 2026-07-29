import { describe, it, expect } from 'vitest';
import { runProjection, initialWithdrawalRate } from '../projection';
import { runMonteCarlo } from '../monteCarlo';
import { householdTotals, defaultPlan } from '../../schemas/plan';
import { generateInsights } from './index';
import { planF_allTradCouple, planE_allRothCouple } from '../__golden/plans';

/** Cross-surface consistency: every concrete number rendered in an Insight body
 *  must equal the number it was derived from in the projection.
 *
 *  Why this exists: insights are derived from `proj`, but their bodies render
 *  formatted strings (e.g., "Lifetime tax is 25% of starting net worth"). If a
 *  rule's formula drifts from the projection it was supposed to summarize, the
 *  body silently becomes a lie. This suite extracts numbers from the body via
 *  regex and verifies them against direct computation from `proj`.
 *
 *  Pattern: for each rule that emits a numeric claim, find the insight, parse
 *  the number, compute the same quantity from `proj`, assert equality (within
 *  rounding tolerance — formatters use Math.round / .toFixed).
 */

/** Pull the first %-claim out of a body string. e.g. "rate is 3.6%" → 3.6 */
const extractPct = (s: string): number | null => {
  const m = s.match(/(\d+(?:\.\d+)?)%/);
  return m ? parseFloat(m[1]) : null;
};

/** Pull the first $-amount out of a body string. Handles "$1,234,000", "$540K", "$5.21M". */
const extractDollar = (s: string): number | null => {
  // Try compact suffixes first
  const m = s.match(/\$([\d,.]+)([KM])/);
  if (m) {
    const n = parseFloat(m[1].replace(/,/g, ''));
    return m[2] === 'M' ? n * 1_000_000 : n * 1_000;
  }
  // Fall back to full-precision "$1,234,000"
  const fm = s.match(/\$([\d,]+)/);
  if (fm) return parseFloat(fm[1].replace(/,/g, ''));
  return null;
};

describe('Insight bodies ↔ projection numerics', () => {
  it('wrRule body % matches the shared initialWithdrawalRate helper', () => {
    const plan = planE_allRothCouple();
    const proj = runProjection(plan);
    const insights = generateInsights(plan, proj);
    const wr = insights.find((i) => i.id === 'wrBand');
    expect(wr).toBeDefined();

    const claimedPct = extractPct(wr!.body)!;
    const actualPct = initialWithdrawalRate(proj) * 100;
    expect(claimedPct).toBeCloseTo(actualPct, 1);
  });

  it('irmaaRule body $ matches peak annual IRMAA in today\'s $', () => {
    const plan = planF_allTradCouple();
    const proj = runProjection(plan);
    const insights = generateInsights(plan, proj);
    const irmaa = insights.find((i) => i.id === 'irmaaCrossing');
    if (!irmaa) {
      // Rule may not fire on this plan — skip; we have a separate "fires" test
      // in irmaa.test.ts.
      return;
    }
    const claimedPeak = extractDollar(irmaa.body)!;
    const actualPeak = Math.max(0, ...proj.rows.map((r) => r.irmaa / r.inflationFactor));
    // Body uses fmtUSD (rounded to dollar); allow $1 slack for the parsed string.
    expect(Math.abs(claimedPeak - actualPeak)).toBeLessThan(1.5);
  });

  it('taxRule body % matches lifetime fed tax / starting net worth', () => {
    const plan = planF_allTradCouple();
    const proj = runProjection(plan);
    const insights = generateInsights(plan, proj);
    const tax = insights.find((i) => i.id === 'taxBurden');
    expect(tax).toBeDefined();

    // The body title has "X% of net worth"; pull it out.
    const claimedPct = extractPct(tax!.title)!;
    const totals = householdTotals(plan.portfolio);
    const startBal = totals.taxable + totals.traditional + totals.roth;
    let lifetimeReal = 0;
    for (const r of proj.rows) lifetimeReal += r.fedTax / r.inflationFactor;
    const actualPct = Math.round((lifetimeReal / startBal) * 100);
    expect(claimedPct).toBe(actualPct);
  });

  it('legacyRule body $ matches end Roth balance (real)', () => {
    const plan = planE_allRothCouple();
    const proj = runProjection(plan);
    const insights = generateInsights(plan, proj);
    const legacy = insights.find((i) => i.id === 'legacyRoth');
    if (!legacy) return; // doesn't fire on small end balances

    // First $-amount in body is the end Roth (real). fmtUSD rounds to nearest dollar.
    const claimed = extractDollar(legacy.body)!;
    const last = proj.rows[proj.rows.length - 1];
    const actual = last.endRoth / last.inflationFactor;
    expect(Math.abs(claimed - actual)).toBeLessThan(2);
  });

  it('sequenceRiskRule body % matches MC failure rate', () => {
    // Use a tight plan to actually trigger the rule.
    const plan = { ...planF_allTradCouple(), assumptions: { ...planF_allTradCouple().assumptions, taxableReturn: 0.03, tradReturn: 0.03, rothReturn: 0.03 } };
    const proj = runProjection(plan);
    const mc = runMonteCarlo(plan, { trials: 200, stdDev: 0.18, seed: 17 });
    const insights = generateInsights(plan, proj, mc);
    const seq = insights.find((i) => i.id === 'sequenceRisk');
    if (!seq) return; // rule may not trip even on this plan

    const claimedPct = extractPct(seq.body)!;
    const actualPct = Math.round((1 - mc.successRate) * 100);
    expect(claimedPct).toBe(actualPct);
  });

  it('bracketCliffRule body bracket rates match projection bracket transition', () => {
    const plan = planF_allTradCouple();
    const proj = runProjection(plan);
    const insights = generateInsights(plan, proj);
    const cliff = insights.find((i) => i.id === 'bracketCliff');
    if (!cliff) return;

    // Body says "steps from X% to Y%". Both must be valid federal bracket rates.
    const pcts = Array.from(cliff.body.matchAll(/(\d+)%/g)).map((m) => parseInt(m[1], 10));
    expect(pcts.length).toBeGreaterThanOrEqual(2);
    // The two are different (it's a cliff) and the second is higher (it's an upward step).
    expect(pcts[0]).not.toBe(pcts[1]);
    expect(pcts[1]).toBeGreaterThan(pcts[0]);
    // Federal bracket rates only.
    const VALID = new Set([10, 12, 22, 24, 32, 35, 37]);
    expect(VALID.has(pcts[0])).toBe(true);
    expect(VALID.has(pcts[1])).toBe(true);
  });
});

describe('Preset preview ↔ direct projection', () => {
  it('endBalance from previewAllPresets matches a direct run of each preset', async () => {
    // This is also covered in presetPreview.test.ts; the entry here documents
    // that it is part of the cross-surface consistency contract — preset cards
    // on Strategy must show numbers derivable from a direct runProjection.
    const { previewAllPresets } = await import('../presetPreview');
    const plan = defaultPlan();
    const preview = previewAllPresets(plan);
    for (const [preset, metrics] of Object.entries(preview)) {
      const direct = runProjection({ ...plan, withdrawalStrategy: preset as never, customPolicy: undefined });
      expect(metrics.endBalance).toBeCloseTo(direct.endTotalReal, 0);
      expect(metrics.lifetimeFedTax).toBeCloseTo(direct.lifetimeFedTax, 0);
    }
  });
});
