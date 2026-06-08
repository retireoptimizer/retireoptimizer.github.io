import { describe, it, expect } from 'vitest';
import { generateInsights } from '../engine/explain';
import { runProjection } from '../engine/projection';
import { previewAllPresets } from '../engine/presetPreview';
import { optimizeStrategy } from '../engine/optimizer';
import { applyResultToPlan } from '../engine/applyOptimizerResult';
import { compareWithWithoutConversion } from '../engine/comparison';
import { planF_allTradCouple, planA_simple } from '../engine/__golden/plans';
import { defaultPlan } from '../schemas/plan';
import type { IncomeStream } from '../schemas/plan';

/**
 * UX bug-replay regressions.
 *
 * Each entry is a single-test "this is the bug we fixed, here's what would
 * have caught it" record. New entries get appended as bugs are fixed.
 *
 * Style mirrors the engine layer's bug-replay test files (one focused assertion
 * per regression, named for the symptom).
 */

describe('UX regressions', () => {
  it('bracketCliff fires for the canonical 22→24 RMD step (FP-epsilon bug, fixed 2026-05)', () => {
    // Bug: rule used `< 0.02` as the minimum bracket-step threshold. JS computes
    // 0.24 - 0.22 as 0.0199999…, which is strictly less than 0.02, so the rule
    // never fired on the canonical RMD-driven 22→24 step. Floor lowered to 0.019.
    const plan = planF_allTradCouple();
    const proj = runProjection(plan);
    const insights = generateInsights(plan, proj);
    expect(insights.some((i) => i.id === 'bracketCliff')).toBe(true);
  });

  it('wrRule handles solo plans whose phase reads as "Survivor" (fixed 2026-05)', () => {
    // Bug: rule searched for r.phase === 'Retire', but solo (no personB) plans
    // never enter that phase because aliveB is always false → phase 'Survivor'.
    // wrRule returned null for every solo plan. Fixed by accepting Survivor + filtering on netSpend>0.
    const soloPlan = { ...planA_simple(), personB: undefined, portfolio: { personA: planA_simple().portfolio.personA } };
    const proj = runProjection(soloPlan);
    const insights = generateInsights(soloPlan, proj);
    expect(insights.some((i) => i.id === 'wrBand')).toBe(true);
  });

  it('previewAllPresets does not leak existing customPolicy (fixed 2026-05)', () => {
    // Bug: presetPreview originally inherited the active customPolicy, which
    // dominated every preset's projection — so all 5 cards showed identical numbers.
    // Fix: each preview now sets customPolicy: undefined before projecting.
    const plan = {
      ...planA_simple(),
      customPolicy: {
        windows: [{ fromAge: 65, toAge: 95, pctTaxable: 0, pctTraditional: 1, pctRoth: 0, convAmt: 0 }],
      },
    };
    const preview = previewAllPresets(plan);
    const values = Object.values(preview).map((m) => Math.round(m.endBalance / 1000));
    expect(new Set(values).size).toBeGreaterThan(1);
  });

  it('SS-typed income stream edits move the projection (fixed 2026-05-29)', () => {
    // Bug: engine had `if (s.type === 'SS') continue` in sumIncomeStreams,
    // silently discarding SS streams. The UI exposed SS in the dropdown and
    // the default plan seeded 3 SS streams, so users edited inputs that did
    // nothing to the projection. Fix: householdSS now accepts ssStreams and
    // uses them as authoritative per-person per-year (PIA fallback preserved).
    const plan = planA_simple();
    const planWithSS: typeof plan = {
      ...plan,
      incomeStreams: [
        ...plan.incomeStreams,
        { id: 'ss-test', description: 'SS A', whose: 'A', type: 'SS',
          startAge: 70, stopAge: 95, annualAmount: 40_000, growthPct: 0.025, taxablePct: 1 } satisfies IncomeStream,
      ],
    };
    const baseEnd = runProjection(plan).endTotalReal;
    const withEnd = runProjection(planWithSS).endTotalReal;
    expect(Math.abs(withEnd - baseEnd)).toBeGreaterThan(10_000);
  });

  it('Optimizer max-sustainable-spending: applied plan matches reported projection (fixed 2026-05-29)', () => {
    // Bug: optimizer measured a scaled-expense plan but the apply handler only
    // persisted customPolicy. Saved plan kept original spending → end balance
    // on the global LiveMetricsBar was ~$1.79M while the optimizer panel
    // reported ~$0. Fix: applyResultToPlan also scales expense streams by the
    // recommended multiplier.
    const plan = defaultPlan();
    const result = optimizeStrategy(plan, 'max-sustainable-spending', { useNelderMead: false });
    const applied = applyResultToPlan(plan, result);
    const reproj = runProjection(applied);
    expect(reproj.endTotalReal).toBeCloseTo(result.projection.endTotalReal, 0);
    expect(reproj.lifetimeFedTax).toBeCloseTo(result.projection.lifetimeFedTax, 0);
  }, 120_000);

  it('LiveMetricsBar honors displayMode (Real/Nominal toggle, fixed 2026-05-29)', () => {
    // Bug: LiveMetricsBar always rendered values in real (today's $) regardless
    // of the global displayMode toggle. Other surfaces (Dashboard KPI tiles,
    // PortfolioTrajectory chart) DID honor the toggle, so the sticky top bar
    // disagreed with everything else in nominal mode. Fixed by subscribing to
    // displayMode in LiveMetricsBar and switching portAtRet + endBalance.
    //
    // This is a UI bug, so this engine-side replay just pins the invariant: for
    // any plan with non-zero inflation, endTotalNominal must differ from
    // endTotalReal. The component-level wiring is covered by the e2e test in
    // consistency.spec.ts ("Real/nominal toggle changes LiveMetricsBar End Balance").
    const plan = defaultPlan();
    const proj = runProjection(plan);
    expect(proj.endTotalNominal).toBeGreaterThan(proj.endTotalReal);
  });

  it('compareWithWithoutConversion strips customPolicy convAmt (fixed 2026-05-29)', () => {
    // Bug: Compare page charts (CumulativeTaxCompare + BalanceCompare) showed zero
    // delta after the optimizer ran. compareWithWithoutConversion flipped
    // plan.conversion.mode to 'off' for the noConv projection, but the optimizer
    // had set customPolicy.windows[].convAmt — and the engine treats convAmt as
    // authoritative when present (it bypasses plan.conversion entirely). So both
    // projections ran the SAME conversions → identical lines.
    // Fix: noConv also zeroes every convAmt while preserving the blend so the
    // delta isolates the conversion effect, not the withdrawal-strategy effect.
    const plan = planF_allTradCouple();
    const result = optimizeStrategy(plan, 'max-end-balance', { useNelderMead: false });
    const applied = applyResultToPlan(plan, result);
    const cmp = compareWithWithoutConversion(applied);
    // The optimizer picked some non-zero conversions for this all-Trad couple, so
    // the with/without lifetime-tax totals must differ.
    expect(Math.abs(cmp.lifetimeTaxDelta)).toBeGreaterThan(1000);
  }, 120_000);

  it('Optimizer min-retirement-age: applied plan matches reported projection (fixed 2026-05-29)', () => {
    // Bug: optimizer searched on lowered retirementAge but the apply handler
    // only persisted customPolicy. Saved plan retired at original age → global
    // bar disagreed with panel. Fix: applyResultToPlan also drops personA.
    // retirementAge (and shifts personB's by the same delta).
    const plan = defaultPlan();
    const result = optimizeStrategy(plan, 'min-retirement-age', { useNelderMead: false });
    const applied = applyResultToPlan(plan, result);
    const reproj = runProjection(applied);
    expect(reproj.endTotalReal).toBeCloseTo(result.projection.endTotalReal, 0);
    expect(reproj.lifetimeFedTax).toBeCloseTo(result.projection.lifetimeFedTax, 0);
  }, 180_000);
});
