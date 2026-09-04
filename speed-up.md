# Max-sustainable-spending optimizer speed-up

Date: 2026-09-03. Baseline commit: `7aa163e` (feat(swl): max spending with after-tax legacy target constraint).

All timings are node/vitest on the dev machine. The browser worker runs **~4× faster** than node here
(a plan that took 100.3s in node showed ~25s in the app at a matching eval count), so app-facing numbers
are roughly node ÷ 4. Ratios carry; absolutes do not.

---

## 1. Problem

`optimizeStrategy(plan, 'max-sustainable-spending')` took 25+ seconds in the app on a real plan,
reporting 1,173,928 projections evaluated. The suspicion was that the legacy-target constraint
(`legacyTargetTaxAdjReal`, added in `eb3f9e1`/`7aa163e`) had caused the regression.

### 1.1 The legacy constraint was not the cause

Plan G (`planG_californiaCouple`), `{ useNelderMead: true, thorough: true }` — the options the
Dashboard sends:

| legacy target | time | evals |
|---|---|---|
| $0 | 11.1s | 140,127 |
| $500K | 10.7s | 140,364 |
| $2M | 11.6s | 153,971 |
| $50M (unreachable) | 4.0s | 83,496 |

The constraint costs ≤10%. Its only structural additions were a 4-probe halving loop (replacing a
2-probe one) and a stricter feasibility predicate.

### 1.2 The real cost is structural

The outer loop runs **~21 full `innerOptimize` calls**:

- 3 seed screens + 2 seed refinements
- up to 4 bracket probes (doubling up, or halving down)
- 14 bisection steps

Every one of those paid for the full inner pipeline — thorough sweeps, conversion smoothing,
withdrawal-split smoothing, and 3 Nelder-Mead sweeps — even though the bisection only needs a
**yes/no feasibility answer** per probe.

### 1.3 Where the evals go inside one `innerOptimize`

| phase | user plan (40 retirement yrs) | plan G (30 yrs) |
|---|---|---|
| coarse sweep (15 splits × 5 conv) | 3K | 2K |
| fine sweep (**45 splits × 9 conv = 405/yr**) | 16K | 2K |
| `thorough` (≤3 more fine sweeps) + smoothing | 49K | 2K |
| Nelder-Mead (3 sweeps) | 6K | 2K |
| **total** | **74K** | **8K** |

Two multipliers stack on the reported plan: 40 retirement years instead of 30, and a large traditional
balance so every year has conversion headroom, keeping the full 9×9 conversion grid live in all 40 years.

Measured single-`innerOptimize` cost on plan G — note the screen is **not** worse than the full run,
because the smoothing passes accept within-tolerance regressions:

| mode | evals | score |
|---|---|---|
| `screenOnly` (coarse+fine) | 1,741 | 6,134,569 |
| full (thorough + NM + smoothing) | 8,079 | 6,123,280 |
| full, no thorough | 5,438 | 6,120,312 |
| full, no NM | 4,455 | 6,114,812 |

The engine itself is not the bottleneck: ~78µs per projection, plain numbers, no `Decimal.js` in the
hot path. The only way to go faster is to run fewer projections.

---

## 2. Candidate changes

1. **Screen-only probes** — bracket and bisection probes run `screenOnly` (coarse+fine grid only);
   the seed uses the best screen directly instead of two full refinements.
2. **Bisection stop tolerance** — stop when `hi$ − lo$ ≤ max($500, 0.25% × lo$)`, typically 8–9 steps
   instead of always 14.
3. **Local fine sweep** — the fine pass refines within ±0.25 of the current best split / conversion
   fraction instead of re-scanning all 405 combinations. 405/yr → ~40/yr. **Not shipped** (see §5).
4. **Bounded-loss guard** — after the bracket closes, re-probe upward from the screened boundary with
   the *unmodified* full optimizer, promoting only on a real projection that meets the goal.

### 2.1 Why the error is one-sided

- **The tolerance stop is one-sided by construction.** `lo$` is always a *verified feasible* spend and
  `hi$` the lowest spend seen to fail; the reported answer is always `lo$`. Stopping early leaves `lo$`
  short by at most one tolerance — a bound, not an estimate.
- **Screening is one-sided by construction.** A weaker inner solution can only make a truly-feasible
  probe look infeasible, never the reverse: feasibility is decided by running an actual projection, so
  any probe marked feasible really is achievable by the returned policy. The *sign* is guaranteed; the
  *magnitude* is not, which is what the guard and the validation sweep address.
- **`max-end-balance` is not one-sided.** Change 3 perturbs the grid, and a different grid can land
  either way (confirmed: planF came out +0.113%).

---

## 3. Validation sweep (all changes, before narrowing scope)

17 plans (16 golden fixtures + the reported real plan) × 48 goal/target combinations. Legacy targets
were set to 25% of that plan's own unconstrained max-end balance, so every target is reachable by
construction. Base ran 525s total, fast 64s.

| group | n | min | max | mean | median | median speedup |
|---|---|---|---|---|---|---|
| max-end-balance | 17 | −0.097% | **+0.113%** | −0.009% | 0.000% | 1.9× |
| SWL unconstrained | 17 | −0.603% | −0.091% | −0.282% | −0.228% | 9.0× |
| SWL + legacy target | 14 | −0.554% | −0.044% | −0.275% | −0.288% | 10.1× |

Sign counts across all 48: **36 worse, 1 better, 11 identical.** All 31 SWL rows negative, zero
exceptions — exactly as predicted. Worst case anywhere was −0.603% (planJ). Nothing pathological
appeared across depleting plans (L, M, P), wide age gaps (K), survivor-RMD cases (L, M), or large
pensions (O).

**Legacy integrity: 14/14 plans met the floor under both base and fast.** On several the fast path
overshoots by more than base does (planN: base $338,480, fast $363,288, target $337,176) — the
conservatism showing up as extra cushion.

---

## 4. What shipped

Changes **1 + 2 + 4** (screen-only probes, tolerance stop, bounded-loss guard). Change 3 was
excluded — see §5. Single file, `src/engine/optimizer.ts`, +55/−8.

New constants, all in the `max-sustainable-spending` search-tuning block:

```ts
const SWL_TOL_ABS = 500;       // bisection stop tolerance, absolute floor
const SWL_TOL_REL = 0.0025;    // bisection stop tolerance, relative
const SWL_BISECT_STEPS = 14;   // hard cap; the tolerance normally stops sooner
const SWL_GUARD_STEPS = 2;     // full-optimizer probes above the screened boundary
```

Guard mechanics: polish the winning level with a full `innerOptimize` first (keeping the screened
policy if smoothing drops it below the legacy floor), then climb — first probe at `hi$`, the lowest
spend the screen rejected; subsequent probes step up by one tolerance, since promoting `hi$` leaves no
known-infeasible bound. The loop breaks on the first failed promotion, so plans that never promote pay
for exactly one extra probe.

### 4.1 How much the guard recovers

31 SWL cases (17 plans × unconstrained + reachable legacy target):

| guard steps | mean delta vs base | worst | promoted | median speedup | recovery of mean loss |
|---|---|---|---|---|---|
| 0 | −0.257% | −0.598% | — | 4.4× | — |
| 1 | −0.160% | −0.421% | 13/31 | 3.1× | 38% |
| **2 (shipped)** | **−0.135%** | **−0.421%** | 13/31 | **2.8×** | **47%** |
| 3 | −0.126% | −0.421% | 13/31 | 2.7× | 51% |

Recovery concentrates in the cases that were worst without it:

| case | guard 0 | guard 1 | guard 2 |
|---|---|---|---|
| planN + legacy | −0.421% | −0.010% | −0.010% |
| planD + legacy | −0.420% | **+0.004%** | +0.004% |
| planA + legacy | −0.328% | −0.097% | −0.097% |
| planA | −0.228% | **+0.004%** | +0.004% |
| planB | −0.536% | −0.307% | −0.307% |
| planI | −0.541% | −0.310% | **−0.034%** |
| planF + legacy | −0.386% | −0.256% | **−0.006%** |
| planJ + legacy | −0.173% | **+0.028%** | +0.028% |

Four cases end up *better* than the unmodified optimizer — the climb finds genuinely feasible higher
levels the original bisection never probed. Step 2 was kept because it is nearly free (median evals
36.4K → 38.8K; only still-climbing plans pay) and fixes planI and planF+legacy. Step 3 buys 4 basis
points on one plan (planG, reaching +0.505%) and was left out.

**Legacy integrity: 14/14 cases met the floor at every guard level, including the shipped config.**

### 4.2 Result on the reported plan (as exported, legacy $1M)

| | before | after |
|---|---|---|
| node | 100.3s / 1,250,683 evals | **35.1s / 356,306 evals** |
| recommended spend | $173,834 | $173,659 (−0.10%) |
| legacy delivered | — | $1,018,374 against a $1,000,000 target |

Expected in-app: ~25s → **~9s**.

Note: this plan is the case where the guard is pure cost — it never promotes, so the 4 full probes add
~10s node (21.6s → 35.1s) and recover nothing. `SWL_GUARD_STEPS = 0` would give 21.6s / 4.4× at the
same −0.18% answer. The guard is insurance for the plan shapes where screening loss ran −0.4 to −0.6%.

### 4.3 Verification

- `npx tsc -b --force` — clean (a cold build caught a `TS7022` circular-inference error in the guard
  loop that the incremental build had masked; fixed with an explicit `const d: number`).
- `pnpm lint` — clean.
- `pnpm test` — 341 passed, 1 skipped, 33 files. **No golden fixture regeneration needed**: the golden
  CSVs are projection-level and this change only touches the SWL search.

---

## 5. Possible next steps

Roughly in order of value.

### 5.1 Local fine sweep (change 3) — the big one, deliberately deferred

The fine pass still scans all 405 split × conversion combinations per year, 40 years deep, on every
probe. Restricting it to ±0.25 around the current best (405/yr → ~40/yr) took the reported plan to
**5.5s / 70,821 evals** — a further 3–6× on top of what shipped, and it speeds up `max-end-balance`
too (1.4–3.2×, median 1.9×).

Deferred because it is the only piece that perturbs `max-end-balance` results and would require golden
fixture regeneration. Measured impact was −0.097% to +0.113% on max-end (8 identical, 8 slightly
negative, 1 positive) and it does not compromise legacy targets. A radius of 0.375 was also measured
and is strictly worse than 0.25 (8.0s vs 5.8s for no quality gain).

If revisited: consider making the radius shrink across passes (0.375 → 0.25 → 0.125) rather than fixed,
and gate it to probe runs only so `max-end-balance` keeps the exhaustive grid.

### 5.2 Secant / regula-falsi root finding

`f(d) = endTaxAdjustedReal(d) − legacy` is near-linear in `d`, and the legacy work already provides a
continuous residual instead of a binary `ranOut` flag. Bracket-safeguarded false position should reach
tolerance in ~4–5 probes instead of 8–9. Not prototyped. Caveat: below the boundary `ranOut` plans
report `endTaxAdjustedReal = 0`, so the residual is flat on the infeasible side — the interpolation
must use the two most recent *feasible* probes with bisection as the safeguard.

### 5.3 Adaptive `thorough`

`thorough` accounted for ~49K of the 74K evals in one full run on the reported plan and bought +0.1%
(2,752,367 vs 2,749,585). It repeats fine sweeps until no improvement, capped at 3 passes. An earlier
convergence test — stop when a pass improves by less than the smoothing tolerance — would likely cut
most of it with no measurable quality loss.

### 5.4 Worker pool for seed screening

The 3 amortization seed screens are independent and could run concurrently. Real but small (~5% of
total) and a meaningful architectural change to `workerClient.ts`, which is currently a singleton.

### 5.5 Not worth pursuing

- **Projection micro-optimization** — ~78µs per projection with no `Decimal.js` in the engine hot path.
  Little headroom without restructuring.
- **Memoizing `runProjection` by policy hash** — policies rarely repeat across probes.

---

## 6. Reproducing the measurements

The sweeps were scratch test files under `src/engine/`, driven by a temporary mutable tuning object and
a `globalThis` override for `SWL_GUARD_STEPS`, then reverted. To redo them:

1. Export `innerOptimize` and add a mutable tuning object in place of the `SWL_*` constants.
2. Iterate the golden plans via `import * as G from './__golden/plans'`, filtering `/^plan[A-P]_/`.
3. For each plan, run `max-end-balance` first and use 25% of its `endTaxAdjustedReal` as a reachable
   legacy target for the SWL cases.
4. Always run with `{ useNelderMead: true, thorough: true }` — that is what the Dashboard sends
   (`src/pages/Dashboard.tsx`).
5. Compare `recommendedAnnualSpend` for SWL and `projection.endTaxAdjustedReal` for max-end.
