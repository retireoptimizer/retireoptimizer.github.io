import { describe, it, expect } from 'vitest';
import { generateInsights } from '../engine/explain';
import { runProjection } from '../engine/projection';
import { previewAllPresets } from '../engine/presetPreview';
import { compareWithWithoutConversion } from '../engine/comparison';
import { planF_allTradCouple, planA_simple } from '../engine/__golden/plans';
import { samplePlan as defaultPlan } from '../schemas/plan';
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
          startAge: 70, end: { mode: 'age' as const, age: 95 }, survivorPct: 0, annualAmount: 40_000, growthPct: { mode: 'fixed', rate: 0.025 }, taxablePct: 1, stateTaxablePct: 1 } satisfies IncomeStream,
      ],
    };
    const baseEnd = runProjection(plan).endTotalReal;
    const withEnd = runProjection(planWithSS).endTotalReal;
    expect(Math.abs(withEnd - baseEnd)).toBeGreaterThan(10_000);
  });

  // Optimizer max-sustainable-spending apply round-trip (bug: the apply handler
  // persisted customPolicy but not the scaled expense streams, so the saved plan
  // kept original spending) is covered by applyOptimizerResult.test.ts, which runs
  // the same assertion across all three goals × two plans. Duplicating it here cost
  // ~30s per suite run for no additional signal.

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
    //
    // Test uses a manually-set conversion policy rather than the optimizer, because
    // whether the optimizer picks conversions for a given plan depends on whether they
    // genuinely improve endTotalReal — not something the stripping test should require.
    const plan = planF_allTradCouple();
    const appliedPlan = {
      ...plan,
      customPolicy: {
        windows: [{ fromAge: 65, toAge: 74, pctTaxable: 0, pctTraditional: 1, pctRoth: 0, convAmt: 30_000 }],
        source: 'optimizer' as const,
      },
    };
    const cmp = compareWithWithoutConversion(appliedPlan);
    // With $30K/yr convAmt set, the with/without lifetime-tax totals must differ.
    expect(Math.abs(cmp.lifetimeTaxDelta)).toBeGreaterThan(500);
  });

  // Optimizer min-retirement-age apply round-trip (bug: the apply handler did not
  // drop personA.retirementAge, so the saved plan retired at the original age) is
  // likewise covered by applyOptimizerResult.test.ts.
});
