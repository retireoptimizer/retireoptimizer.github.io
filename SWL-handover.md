# SWL — Spend With Legacy: analysis handover

_Analysis date: 2026-09-03. Branch `main` @ `78cd95e`. Steps 1–7 complete as of 2026-09-03._

**Execution plan:** `~/.claude/plans/read-spend-with-legacy-md-and-plan-parsed-thimble.md`
(ordered build steps, checkpoints, tests). This file is the *why*; that file is the *how*.

## Build status (2026-09-03)

| Step | Status | Notes |
|---|---|---|
| 1 — Schema + store | ✅ Done | `legacyTargetTaxAdjReal` on `AssumptionsSchema`; store bumped to v28 |
| 2 — Feasibility predicate | ✅ Done | `meetsGoal` + `bestLegacySeen` in optimizer; all 4 feasibility sites replaced |
| 3 — Bracketing fix | ✅ Done | Seed gross-up via `taxAdjustedValue` (3a); 4-probe halving loop replaces untested 0.25× floor (3b) |
| 4 — Result packaging | ✅ Done | `legacyTargetTaxAdjReal?` + `achievedLegacyTaxAdjReal?` on `OptimizeResult`; branched headlines for unreachable vs success |
| 5 — UI | ✅ Done | `LegacyTargetInput.tsx` new; InputsPage + StrategyChooser gated on max-spending goal; Dashboard banner + Tax-Adj HeroStat sub-line |
| 6 — Explain surfaces | ✅ Done | optimizerRationale outcome item; decisionTrace degraded note; HowToGuide row + bullet |
| 7 — Tests | ✅ Done | 5 new tests in projection.test.ts (zero-target, constraint binding, monotonicity, unreachable, tight-plan bracketing regression) |

---

## 1. What is being built

"Max Spending with a legacy target" — the existing `max-sustainable-spending` bisection with its
feasibility predicate tightened from *"doesn't deplete"* to *"doesn't deplete **and** ends ≥ target"*.

End balance is monotone-decreasing in spending, so the existing bracket-then-bisect stays valid. No new
search algorithm, and **no new `UserGoal` member** — it is a constraint on an existing goal, not a new
one.

---

## 2. Key decision: the target is TAX-ADJUSTED, not gross

`spend-with-legacy.md` §"One open decision" recommended measuring the target on gross `endTotalReal`.
**We are doing the opposite.** The floor is measured on `endTaxAdjustedReal`.

This is not a display preference. It changes how much code the feature needs:

- The inner optimizer's objective is *already* `endTaxAdjustedReal` — `REC_GOALS['max-end'].score`
  ([recommender.ts:30](src/engine/recommender.ts#L30)), hard-wired as the only inner goal at
  [optimizer.ts:223-224](src/engine/optimizer.ts#L223-L224). Every `InnerEval.score` in the file is that
  number.
- So the predicate reads as *"the **maximum achievable** after-tax end balance at this spending level
  clears the bar"* — the inner search is exactly the right search for the constraint, and it costs zero
  extra projections (`inner.proj.endTaxAdjustedReal` is already computed).
- **Therefore the inner optimizer needs no changes at all.** Not the coarse/fine sweeps, the ACA cliff
  anchor, the smoothing passes ([411](src/engine/optimizer.ts#L411),
  [514](src/engine/optimizer.ts#L514)), or the Nelder-Mead acceptance
  ([651](src/engine/optimizer.ts#L651)). Those accept only score-improving candidates, and higher score =
  higher legacy. An earlier read of this suggested the constraint must be plumbed into the smoothing
  passes; it does not — the outer bisection re-checks the final result, so an inner run that lands just
  under the floor simply moves the bracket down, which is the correct answer.
- With a **gross** target the two would be misaligned: the inner search maximizes the after-tax number,
  so a policy clearing a gross floor could be discarded in favour of a lower-gross/higher-after-tax one,
  and the outer loop would mislabel a genuinely-feasible spending level as infeasible. That is a real
  correctness bug, not just an inconsistency.
- It is also the honest number. Heirs inherit a taxed IRA; $1M of traditional is not $1M of legacy.
  `endTotalReal` and `endTaxAdjustedReal` diverge substantially on traditional-heavy plans (a 22% haircut
  on the whole pre-tax balance).

Consistent with the project's gross-default convention: gross remains the display default everywhere;
tax-adjusted is used at *decision points*. This is one — the same reasoning that put it at the Roth
conversion decision.

**Rates:** reuse the existing `taxAdjOrdRate` (default 22%) / `taxAdjLtcgRate` assumptions. No separate
heir-tax rates. They are the retiree's own assumed liquidation rates, not the heirs' — disclosed by
co-locating the new input inside the existing "↳ End balance effective tax rates" block on the
Optimization Goal panel ([InputsPage.tsx:926-958](src/pages/InputsPage.tsx#L926-L958)).

Formula: `taxAdjustedValue` in [src/engine/taxAdjusted.ts:33-49](src/engine/taxAdjusted.ts#L33-L49) —
`endRoth + basis + unrealizedGain×(1−ltcg) + endTraditional×(1−ord)`. No state tax, IRMAA, or NIIT.

---

## 3. Other settled decisions

| Question | Decision |
|---|---|
| Scope | `max-sustainable-spending` only. `min-retirement-age` / `max-end-balance` unchanged. The doc's "optional follow-on" to `min-retirement-age` is explicitly out. |
| Unreachable target | Report the shortfall ("Cannot leave $X after tax — best achievable is $Y"). Never silently drop the constraint or return the unconstrained answer. |
| New goal enum member | **No.** Constraint on an existing goal. |
| Units | Today's dollars (real), after tax. |

---

## 4. Codebase findings that shape the work

### 4a. The doc's §5 (UI) is largely wrong now

Because there is no new `UserGoal` member, the four duplicated goal-label maps need **no changes**:
[StrategyChooser.tsx:14-18](src/components/StrategyChooser.tsx#L14-L18),
[InputsPage.tsx:57-61](src/pages/InputsPage.tsx#L57-L61),
[Dashboard.tsx:26-30](src/pages/Dashboard.tsx#L26-L30),
[OptimizerRationaleModal.tsx:11-15](src/components/OptimizerRationaleModal.tsx#L11-L15).
`USER_GOALS` ([recommender.ts:79-94](src/engine/recommender.ts#L79-L94)), `optimizedForGoal`, and
[applyOptimizerResult.ts](src/engine/applyOptimizerResult.ts) are likewise untouched (verified: apply
keys off `goal` + `recommendedAnnualSpend` only).

### 4b. `headline` / `headlineLabel` are dead plumbing

`OptimizeResult.headline` and `.headlineLabel` ([optimizer.ts:70-72](src/engine/optimizer.ts#L70-L72))
are **not rendered anywhere in the UI**. What the user actually sees for max-spending is:
- the pending-result banner, [Dashboard.tsx:163-197](src/pages/Dashboard.tsx#L163-L197);
- the "Annual Spending" HeroStat at [Dashboard.tsx:240](src/pages/Dashboard.tsx#L240), fed indirectly by
  the scaled expense streams.

Good news: the Dashboard **already** renders `proj.endTaxAdjustedReal` as a HeroStat
([Dashboard.tsx:232](src/pages/Dashboard.tsx#L232)) — the achieved legacy is already on screen. The UI
work is therefore just a target sub-line (`target $X ✓` / `short by $Y`), not a new readout. Keep the
headline strings correct anyway.

### 4c. The bracketing bug is real and pre-existing

The downward path at [optimizer.ts:1185-1191](src/engine/optimizer.ts#L1185-L1191) probes 0.5× once,
then sets `lo$ = amortAbs * 0.25` **without testing it**. `bestFeasible` can stay null with an unverified
bracket low end, and the run falls into the "depletes even at 50%" message. With a legacy floor `amortAbs`
is *usually* infeasible, so this path becomes the common case rather than the rare one.

This is a latent bug on tight plans **today**, with no legacy target. Fix it regardless. Replacement is a
4-probe halving loop mirroring the existing upward doubling
([1192-1203](src/engine/optimizer.ts#L1192-L1203)), with `lo$ = 0` as the deliberately-untested floor —
safe because the bisection loop ([1205-1213](src/engine/optimizer.ts#L1205-L1213)) only ever promotes a
probe that passed the predicate.

### 4d. Amortization seed needs a gross-up, not just a subtraction

`amortizationSeed` ([optimizer.ts:709-762](src/engine/optimizer.ts#L709-L762)) amortizes the portfolio
fully to zero. The doc's fix — subtract `legacy/(1+realR)^n` — is right in shape but wrong in units: the
target is *after-tax* while `portfolioRealAtRetire` is *gross*. Gross it up first using the plan's own
haircut at the current bucket mix (reuse `taxAdjustedValue`). It is only a seed; the bracket search
corrects any error, so a crude mix-based gross-up is sufficient.

The `multiplier` half of the seed's return value is unused by the max-spending block — leave it alone.

### 4e. Feasibility must keep the `!ranOut` half

`ranOut` is not "balance hit zero" — it is "the year's spending need could not be funded from the
portfolio", sticky once set ([projection.ts:884-888](src/engine/projection.ts#L884-L888)). A run can be
underfunded mid-plan and still end with a positive balance, so
`!e.ranOut && e.proj.endTaxAdjustedReal >= legacy` needs both conjuncts.

### 4f. Store migration is a no-op bump

`version: 27` at [usePlanStore.ts:145](src/store/usePlanStore.ts#L145). v27 itself is a comment-only
migration (lines 149–151) — exact precedent for adding an optional assumptions field where absent === 0
=== prior behavior. `setAssumptions` ([line 89](src/store/usePlanStore.ts#L89)) is the only mutation
action needed.

**Gotcha:** `PlanSchema.parse` is never called at runtime (documented at
[taxAdjusted.ts:3-7](src/engine/taxAdjusted.ts#L3-L7)). Zod `.default()` is documentation, not a runtime
guarantee — every read site must use `?? 0`.

### 4g. Test templates

- Goal-level optimizer tests live in
  [projection.test.ts:139-159](src/engine/projection.test.ts#L139-L159), not `optimizer.test.ts`.
- `optimizeStrategy` is called **synchronously** in tests (no worker), with an explicit long timeout as
  the 3rd `it` arg ([optimizer.test.ts:69](src/engine/optimizer.test.ts#L69)) — each call is ~15s.
- Golden fixtures under `src/engine/__golden__/` must be byte-unchanged at target 0.

---

## 5. Files touched

| File | Change |
|---|---|
| [src/schemas/plan.ts](src/schemas/plan.ts) | `legacyTargetTaxAdjReal` on `AssumptionsSchema` |
| [src/store/usePlanStore.ts](src/store/usePlanStore.ts) | version 27 → 28, comment-only migration |
| [src/engine/optimizer.ts](src/engine/optimizer.ts) | `meetsGoal` predicate, bracketing fix, seed gross-up, `OptimizeResult` fields, headlines |
| `src/components/inputs/LegacyTargetInput.tsx` | new — wraps `NumberInput` |
| [src/pages/InputsPage.tsx](src/pages/InputsPage.tsx) | input inside the tax-rates sub-block, goal-gated |
| [src/components/StrategyChooser.tsx](src/components/StrategyChooser.tsx) | same input under the goal pill row |
| [src/pages/Dashboard.tsx](src/pages/Dashboard.tsx) | target sub-line on the tax-adj HeroStat + pending banner |
| [src/engine/explain/optimizerRationale.ts](src/engine/explain/optimizerRationale.ts) | outcome line: constraint binding + its price |
| [src/engine/explain/decisionTrace.ts](src/engine/explain/decisionTrace.ts) | extend the existing `degraded` disclaimer |
| [src/components/HowToGuide.tsx](src/components/HowToGuide.tsx) | goal-table row + Strategy-panel bullet |
| [src/engine/projection.test.ts](src/engine/projection.test.ts) | 5 new tests (see plan Step 7) |

Effort: ~300–400 LOC. Risk concentrated in the bracketing (§4c/§4d); everything else is mechanical.
