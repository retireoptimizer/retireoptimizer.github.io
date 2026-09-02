# Handover — Optimizer rationale reports facts, not decisions

Status: **Phase 2 complete.** All steps 9–15 done.

**Plan file:** [`~/.claude/plans/build-a-full-plan-abundant-journal.md`](../../.claude/plans/build-a-full-plan-abundant-journal.md)

---

## Problem statement

Every time a new plan is tested, the output raises questions the app cannot answer:

- Why are Roth conversions happening while pre-tax withdrawals are also being done?
- Why are conversions being run even during RMD years?
- How are the bracket-fill settings, conversion mode, pay-tax-from-taxable, and terminal tax rates impacting the decisions?

Asking these in a chat session — with the plan file and the CSV output attached — produces clear answers. The in-app **"explain optimization rationale"** link does not. It emits *facts*, not *decisions and rationale*.

### Root cause

[`explainPolicy`](src/engine/explain/optimizerRationale.ts) (159 lines) is a post-hoc template over the **winning** plan only. It restates what happened — "converts $X total from age A to B", "RMDs peak above $Y" — and returns a flat `string[]` rendered as an undifferentiated `<ul>` at [Dashboard.tsx:404-410](src/pages/Dashboard.tsx#L404-L410).

It never sees what the optimizer rejected. The optimizer evaluates 1,000–5,000 candidate policies per run and discards every one of them; only `conversionBaselinePolicy` ([optimizer.ts:46](src/engine/optimizer.ts#L46)) survives. Rationale = the chosen option **vs.** the rejected options **at a stated price**. Without the alternatives there is nothing to reason about, so the modal can only narrate.

Three layers are missing: a **counterfactual ledger**, a **settings-impact readout**, and **per-year decision attribution**.

---

## Investigation findings

Verified against source. Several contradict the obvious assumption and directly shape the design.

### Engine mechanics

1. **Year-loop ordering is RMD → conversion → withdrawal**, not RMD → withdrawal → conversion. [projection.ts:375-379](src/engine/projection.ts#L375-L379) (RMD), [:389 comment](src/engine/projection.ts#L389) and [:474-503](src/engine/projection.ts#L474-L503) (conversion), [:586-672](src/engine/projection.ts#L586-L672) (withdrawal split, inside a 16-iteration gross-up loop). **RMD is a spending resource** netted into the gap at [:598](src/engine/projection.ts#L598) — not a withdrawal, which is why it never appears in the withdrawal columns.

   This settles two of the three headline questions outright. A conversion and a pre-tax withdrawal in the same year are not in conflict: the conversion is sized first against remaining bracket headroom; the withdrawal happens after and funds spending. Converting *more* would not shrink the withdrawal — it would grow it, because conversion tax enters the same gap. And during RMD years the mandatory distribution consumes bracket space *before* any conversion is considered, so the conversion fills only what is left.

2. **Two independent bracket-ceiling fields, easily conflated.** `plan.conversion.bracketCeiling` ([plan.ts:204](src/schemas/plan.ts#L204)) drives only the Roth conversion path. `plan.withdrawalBracketCeiling` ([plan.ts:236](src/schemas/plan.ts#L236)) drives only the `bracketfill` withdrawal preset. `withdrawal.ts` names its local parameter `bracketCeiling`, which is the collision that makes them look shared. [usePlanStore.ts:131-132](src/store/usePlanStore.ts#L131-L132) clamps one from the other, but at the UI level only.

3. **`taxAdjOrdRate` never touches cash flow** — it is consumed solely by `taxAdjustedValue` on the final row ([projection.ts:275](src/engine/projection.ts#L275)/[:892](src/engine/projection.ts#L892)). Since the optimizer's objective is `endTaxAdjustedReal`, the objective is **affine** in this rate. Rate sensitivity and the conversion breakeven rate are therefore closed-form and cost zero extra projections.

4. **`customPolicy` binds ordering and conversions together** — [projection.ts:483](src/engine/projection.ts#L483): `if (eitherRetired && policyConv != null) conv = policyConv * inflationFactor`. The guard is `!= null`, so `convAmt: undefined` **releases** the conversion path while `convAmt: 0` **pins it to zero**. Any counterfactual that varies conversion sizing must use `undefined`.

5. **Several binding constraints are already live locals** at the row-push site and are free to capture: `headroomNominal` ([:459](src/engine/projection.ts#L459)), `ceilForConv` ([:435](src/engine/projection.ts#L435)), `maxConv` ([:473](src/engine/projection.ts#L473)), `taxAvail`/`tradAvail`/`rothAvail` ([:560-565](src/engine/projection.ts#L560-L565)).

6. **Withdrawal shortfalls are silently absorbed.** `WithdrawalOutputs` ([withdrawal.ts:16-21](src/engine/withdrawal.ts#L16-L21)) returns only the three amounts plus `bracketOverridden`. When a policy's requested split cannot be honored — no matching age window ([:97-103](src/engine/withdrawal.ts#L97-L103)), `tradCap` clamp ([:109-111](src/engine/withdrawal.ts#L109-L111)), buckets too small ([:113-125](src/engine/withdrawal.ts#L113-L125)) — the shortfall spills tax→trad→roth and nothing records it. This is why a user's declared split can silently not be what runs.

### Blast-radius facts

7. **`ProjectionOptions` already exists** ([projection.ts:193-208](src/engine/projection.ts#L193-L208)), so adding an `explain?: boolean` opt-in requires **zero** changes at ~115 call sites across 30 files — and the optimizer's thousands of projections never pay for it.
8. **Two whole-row `JSON.stringify` equality checks** ([assertions.ts:223](src/engine/__invariants__/assertions.ts#L223), [optimizer.test.ts:156](src/engine/optimizer.test.ts#L156)) constrain the design. The latter compares runs with differently-sourced policy objects, so per-year notes must live off `ProjectionRow`.
9. **Golden fixtures snapshot only 10 scalars** ([__golden/harness.ts:7-18](src/engine/__golden/harness.ts#L7-L18)) — safe for shape changes, not for engine-number changes.
10. **`presetPreview.ts` (43 lines) is the exact pattern to clone** for counterfactuals — loop plans, clear `customPolicy`, collect comparable metrics.
11. **Three independent no-conversion baseline constructions already exist** ([comparison.ts:37-49](src/engine/comparison.ts#L37-L49), [optimizerRationale.ts:17-24](src/engine/explain/optimizerRationale.ts#L17-L24), and the optimizer's stored `conversionBaselinePolicy`), and they differ in their fallback branch. A fourth would guarantee drift against the Dashboard's Roth Conversion Benefit badge.

### Bug found: ACA subsidies decay on inflation alone

[projection.ts:653-656](src/engine/projection.ts#L653-L656) passes a **nominal** MAGI and an **inflation-scaled** benchmark premium into [`acaNetPremium`](src/engine/aca.ts#L39-L57), which computes `fplRatio = magi / federalPovertyLevel(size)` with an **unindexed** FPL ([aca.ts:47-48](src/engine/aca.ts#L47-L48)). The ratio therefore climbs every year purely from inflation, and households spuriously cross the 400% FPL cliff and lose their subsidy for no economic reason.

[irmaa.ts:5](src/engine/irmaa.ts#L5) indexes its tier thresholds by `inflationFactor`, and [optimizer.ts:298](src/engine/optimizer.ts#L298) indexes FPL in its cliff-seeding heuristic. **ACA is the sole outlier**, and the engine and the optimizer's heuristic currently disagree with each other.

---

## Summary of recommendations

### 1. Counterfactual ledger — the core fix

After the optimizer converges, run ~11 named counterfactuals against the winning policy and record signed score deltas, so the modal can state *what was chosen, what it beat, and by how much*:

- conversions off (delegated to `compareWithWithoutConversion`, never re-derived)
- each of the 5 withdrawal presets, with the winning conversion schedule pinned so the row isolates ordering only
- conversion bracket ceiling at the 12% / 22% / 24% bracket tops
- `payTaxFromBrokerage` flipped
- `taxAdjOrdRate` ±5pp — **free**, via the affine re-score

Cost: ~110–280ms, on the main thread, gated on modal open.

### 2. Rate sensitivity and breakeven — the highest-value line

Because the objective is affine in `taxAdjOrdRate`, the breakeven rate is closed-form: *"conversions win as long as your future effective rate exceeds 14.8%; you assumed 22%."* A sign flip inside the ±5pp band is the direct answer to "how are terminal tax rates impacting the decisions?".

### 3. Settings-impact readout

One row per knob with a one-line "what it did in **this** plan" plus its delta. The `inert` flags carry most of the value: the conversion bracket ceiling is inert whenever the optimizer set conversion amounts directly ([projection.ts:483](src/engine/projection.ts#L483) short-circuits it), and the withdrawal preset is inert whenever a `customPolicy` is present. The two ceilings render as adjacent rows with an explicit disambiguator.

### 4. Close the loop on counterfactuals that win

Two classes, handled differently:

- **Ordering** counterfactuals live inside the optimizer's search space, so escalate them into optimizer seeds — generalising the existing hand-built Competitor 2 at [optimizer.ts:806-831](src/engine/optimizer.ts#L806-L831). After that, a positive delta on an ordering row is a **bug**, and asserting so across the 7 golden plans becomes a standing optimizer-quality guard the codebase currently lacks.
- **Settings** counterfactuals cannot be searched (they are plan fields needing an outer loop). Positive deltas here are expected and permanent — they get a **"Re-optimize with this setting"** button instead.

### 5. Per-year decision attribution

A `decisionNotes` array on `ProjectionResult` (deliberately **not** on `ProjectionRow`, to stay immune to the two structural-equality tests), naming the binding constraint for each year. Surfaced as a `Why` column on `/projections` with hover and click-to-expand, a condensed section in the rationale modal, and a CSV column.

### 6. Copy diagnostics

A button emitting the whole decision trace as self-contained, unit-labelled markdown — the direct replacement for the current paste-plan-JSON-and-CSV workflow. The narrative stays deterministic and template-driven; an LLM layer is optional on top and is not the fix.

### 7. Fix the ACA FPL indexing

Index the FPL lookup by `inflationFactor` and share one helper between the engine and the optimizer heuristic. This is an engine accuracy fix that **will move golden fixtures** for any plan with `modelACA: true` — land it as its own commit and read the diff rather than accepting it.

---

## Phasing

Full detail, file-by-file, in the plan file.

### Phase 1 — Counterfactual ledger + settings impact (~1,330 lines incl. tests)

| # | Status | Step | Key files |
|---|---|---|---|
| 1 | ✅ Done | `decisionTrace.ts`: conv-off (delegated) + 5 presets + `pinManual`; extract `hasComparableConversionBaseline` | `explain/decisionTrace.ts`, `comparison.ts`, `Dashboard.tsx` |
| 2 | ✅ Done | Ceiling rows + `stripConv` + `paytax-flip` | `explain/decisionTrace.ts` |
| 3 | ✅ Done | Analytic rate sensitivity + breakeven | `explain/decisionTrace.ts` |
| 4 | ✅ Done | `settingsImpact.ts` incl. the inert predicates | `explain/settingsImpact.ts`, `explain/decisionTrace.ts` |
| 5 | ✅ Done | `explainPolicy` → sectioned `PolicyRationale`; delete its duplicate baseline | `explain/optimizerRationale.ts` |
| 6 | ✅ Done | Modal extraction + ledger table | `components/OptimizerRationaleModal.tsx`, `Dashboard.tsx` |
| 7 | ✅ Done | Optimizer competitors + re-optimize button | `optimizer.ts`, modal |
| 8 | ✅ Done | `diagnosticsMarkdown.ts` + copy button | `explain/diagnosticsMarkdown.ts` |

No schema change, no store migration, no worker API change.

#### Post-step-8 UX refinements (applied after Phase 1 closed)

Several deviations from the original 1g spec — treat these as the authoritative current state:

| Area | Original spec | Shipped |
|---|---|---|
| Headline | Conversion-amount-led | "Optimizer co-optimized withdrawal sequence and Roth conversions: …" |
| Insights position | Section 6 (bottom) | Section 2 (top, merged with headline block) |
| Counter-intuitive patterns | Not in spec | Three new insight callouts: conv+trad-wd same year, conv during RMDs, high-volume conv driven by terminal rate |
| Adaptation chip | Per-row chip on all rows | Removed entirely; ordering group gets a one-line sub-caption; `conv-off` gets inline italic note |
| "End Bal" column | "End Bal" | "Tax-Adj End" with explanatory footnote |
| Settings section | All rows shown, inert ones dimmed at 50% | Inert rows hidden; section hidden when all settings are inert; title → "Key settings that shaped this plan" |
| Tax sourcing label | "Bundle with spending" / "Pay from brokerage" | "Embedded in withdrawal" / "Taxable account (separate)" with plain-English effect descriptions |
| Rate sensitivity title | "Rate sensitivity" | "Terminal rate sensitivity" |

### Phase 2 — Per-year decision attribution (~905 lines incl. tests)

| # | Status | Step | Key files |
|---|---|---|---|
| 9 | ✅ Done | Spill instrumentation (behavior-neutral, mergeable alone) | `withdrawal.ts` |
| 10 | ✅ Done | `yearDecisions.ts` types + pure builder | `explain/yearDecisions.ts` |
| 11 | ✅ Done | `explain` flag wiring + single store opt-in | `projection.ts`, `usePlanStore.ts` |
| 12 | ✅ Done | `Why` column + hover + expand + CSV + storage-key bump to `v5` | `Projections.tsx` |
| 13 | ✅ Done | Modal decisions section | `Dashboard.tsx`, `components/OptimizerRationaleModal.tsx` |
| 14 | ✅ Done | IRMAA / ACA headroom notes | `explain/headroom.ts` |
| 15 | ✅ Done | ACA FPL fix + golden re-baseline (own commit) | `aca.ts`, `projection.ts`, `optimizer.ts`, goldens |

---

## Pitfalls to carry into implementation

- Never write `convAmt: 0` in `stripConv` — it pins conversions to zero instead of releasing them, which would silently make all three ceiling counterfactuals identical. Comment the reason inline.
- Guard `pinManual` on `fromAge >= retirementAge`: the manual branch returns before the `!retired` check at [conversion.ts:24](src/engine/conversion.ts#L24), so an unguarded pin fires conversions in accumulation years.
- Pass `effectivePlan` (the What-If-aware plan the badge uses), not an internally re-derived one, or the modal and the badge will silently measure different plans.
- `taxFromBrok` is `const`-scoped **inside** the gross-up loop at [projection.ts:595](src/engine/projection.ts#L595) — hoist a `let` to capture it.
- Build per-year notes **after** the de-minimis clamp at [:689-692](src/engine/projection.ts#L689-L692), or a note can cite a pre-tax draw the row displays as `0`.
- Keep `DecisionTrace` structured-clonable (no `ProjectionResult`, no closures) so a later worker migration stays a ~6-line change.
- Always `tsc -b --force` before push — a warm `tsc -b` will hide the `PolicyRationale` signature break in `Dashboard.tsx`, which is exactly the shape of change that produces a false green.
