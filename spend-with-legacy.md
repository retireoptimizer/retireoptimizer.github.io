# Max Spending with a Legacy Target — implementation analysis

_Analysis date: 2026-09-01. Codebase at commit `eecc7d5` (v1.9.1)._

## Concept

"Max Spending with legacy" = the same bisection, with the feasibility predicate tightened from
*"doesn't deplete"* to *"doesn't deplete **and** ends >= target (today's $)"*. End balance is
monotone-decreasing in spending, so the existing bracket-then-bisect stays valid — no new search
algorithm.

## Changes required

**1. Schema + store** — `src/schemas/plan.ts:195-254`
`legacyTargetReal: z.number().min(0).default(0)` (today's $) on `Assumptions` (or a new
`optimizerSettings` block). Migration version bump in `usePlanStore`. Default 0 => current behavior
byte-identical, golden fixtures unaffected.

**2. Feasibility predicate** — `src/engine/optimizer.ts:1036-1155`
```ts
const legacy = plan.assumptions.legacyTargetReal ?? 0;
const meetsGoal = (e: InnerEval) => !e.ranOut && e.proj.endTotalReal >= legacy;
```
Replace the four `!inner.ranOut` / `inner.ranOut` sites in the spending block (lines ~1100, 1109,
1117, 1130). Inner objective stays `max-end` — unchanged, and it's exactly the right inner search
(maximize achievable end balance, then ask if it clears the bar).

**3. Bracketing fixes (the real work)** — with a floor, `amortAbs` is usually infeasible, and
today's downward path probes 0.5x once, then sets `lo$ = 0.25x` *without testing it*, so
`bestFeasible` can stay null and you fall into the "depletes even at 50%" message. Needs:
- Seed net of legacy: amortize `portfolioRealAtRetire - legacy/(1+realR)^n` in `amortizationSeed`
  (`src/engine/optimizer.ts:690`) — otherwise the bracket starts far above the answer and 14
  bisection steps burn on infeasible probes.
- A real downward halving loop (3–4 probes) mirroring the existing upward doubling.

**4. Result packaging** — `OptimizeResult`: add `achievedLegacyReal` + `legacyTargetReal`; headline
sub-line "leaves $X (target $Y)". New unreachable message: "Cannot leave $X and fund any spending"
vs. the current depletion wording.

**5. UI** — goal label maps live in 4 files: `src/components/StrategyChooser.tsx:14`,
`src/pages/InputsPage.tsx:59`, `src/pages/Dashboard.tsx:28`,
`src/components/OptimizerRationaleModal.tsx:11`. Add one currency input, visible only when
goal = Max Spending, next to the Optimize button; show achieved-vs-target in the result pill.
Recommend **not** adding a new `UserGoal` enum member — it's a constraint on the existing goal, so
`optimizedForGoal` and the apply path (`src/engine/applyOptimizerResult.ts`) need no changes.

**6. Explain surfaces** — `src/engine/explain/optimizerRationale.ts` and
`src/engine/explain/decisionTrace.ts`: one line stating the legacy constraint is binding and its
price ("$18k/yr of spending buys $500k of legacy" — free from the bracket endpoints already
computed).

**7. Tests** — `src/engine/optimizer.test.ts`:
- target 0 identical to today's result;
- target > 0 => spending strictly lower and `endTotalReal >= target` within bisection tolerance;
- target above max achievable => graceful headline, no throw.
Plus a `HowToGuide.tsx` goal-table row.

## One open decision

Target measured on **gross** `endTotalReal` (matches the gross-default convention; user thinks in
"$1M to the kids") vs **`endTaxAdjustedReal`** (matches the inner objective; heirs actually inherit
a taxed IRA). Recommendation: gross, with the tax-adjusted number shown alongside — mixing bases in
a single constraint is where the gross/after-tax sign paradox bites.

## Effort

~300–400 LOC, ~1 day. Risk concentrated in step 3; steps 1/2/5 are mechanical.
Optional follow-on: apply the same predicate to `min-retirement-age` (~20 LOC once `meetsGoal`
exists).
