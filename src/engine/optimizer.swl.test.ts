import { describe, it, expect } from 'vitest';
import { planF_allTradCouple } from './__golden/plans';
import { optimizeCached } from './__testutil__/optimizeCached';

/** SWL: max-sustainable-spending with an after-tax legacy target.
 *  planF ($2.7M all-traditional couple): a max-spending search costs ~8s against ~80s for
 *  samplePlan, and the $500K / $800K targets are reachable. optimizeCached shares the
 *  unconstrained and $500K runs between tests. */
describe('optimizeStrategy legacy target (SWL)', () => {
  it('legacyTargetTaxAdjReal = 0 is unconstrained (no legacy fields on result)', () => {
    const plan = { ...planF_allTradCouple(), assumptions: { ...planF_allTradCouple().assumptions, legacyTargetTaxAdjReal: 0 } };
    const r = optimizeCached(plan, 'max-sustainable-spending', { useNelderMead: false });
    expect(r.legacyTargetTaxAdjReal).toBeUndefined();
    expect(r.achievedLegacyTaxAdjReal).toBeUndefined();
    expect(r.ranOut).toBe(false);
  }, 120_000);

  it('positive legacyTargetTaxAdjReal reduces spend and leaves endTaxAdjustedReal ≥ target', () => {
    const base = planF_allTradCouple();
    const unconstrained = optimizeCached(base, 'max-sustainable-spending', { useNelderMead: false });
    const target = 500_000;
    const constrained = optimizeCached(
      { ...base, assumptions: { ...base.assumptions, legacyTargetTaxAdjReal: target } },
      'max-sustainable-spending', { useNelderMead: false },
    );
    expect(constrained.recommendedAnnualSpend!).toBeLessThan(unconstrained.recommendedAnnualSpend!);
    expect(constrained.achievedLegacyTaxAdjReal!).toBeGreaterThanOrEqual(target * 0.9999);
  }, 120_000);

  it('higher legacy target produces non-increasing recommended spend (monotonicity)', () => {
    const base = planF_allTradCouple();
    // 500K shares its cached run with the test above; 0 → 500K is covered there too.
    const lo = optimizeCached(
      { ...base, assumptions: { ...base.assumptions, legacyTargetTaxAdjReal: 500_000 } },
      'max-sustainable-spending', { useNelderMead: false },
    );
    const hi = optimizeCached(
      { ...base, assumptions: { ...base.assumptions, legacyTargetTaxAdjReal: 800_000 } },
      'max-sustainable-spending', { useNelderMead: false },
    );
    expect(hi.recommendedAnnualSpend!).toBeLessThanOrEqual(lo.recommendedAnnualSpend! + 1);
  }, 120_000);

  it('unreachable legacy target reports shortfall headline and does not return unconstrained answer', () => {
    const base = planF_allTradCouple();
    const r = optimizeCached(
      { ...base, assumptions: { ...base.assumptions, legacyTargetTaxAdjReal: 100_000_000 } },
      'max-sustainable-spending', { useNelderMead: false },
    );
    expect(r.headlineLabel).toContain('unreachable');
    expect(r.headline).toContain('Cannot leave');
    expect(r.achievedLegacyTaxAdjReal).toBeUndefined();
  }, 120_000);
});
