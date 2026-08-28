import type { Plan } from '../schemas/plan';
import type { BlendPolicy, BlendWindow } from './blendPolicy';
import { runProjection, type ProjectionResult } from './projection';
import { householdPlanThroughAgeA } from './planInputKey';
import { REC_GOALS, USER_GOALS, type RecGoal, type UserGoal } from './recommender';
import { nelderMead2D, nelderMead3D } from './nelderMead';
import { mulberry32, historicalBootstrap } from './returnModels';
import { FED_BRACKETS_MFJ, FPL_BASE, FPL_INCREMENT } from './taxConstants';
import { shiftRetirementAge } from './retirementAgeShift';

const COARSE_STEPS = [0, 0.25, 0.5, 0.75, 1.0];
const FINE_STEPS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];
const CONV_COARSE = [0, 0.25, 0.5, 0.75, 1.0];
const CONV_FINE = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];

// 12% bracket top (today's $) — MFJ upper bound of the second bracket.
const BRACKET_12_TOP = FED_BRACKETS_MFJ[1][0];
// Scale for normalising convAmt deltas to the same magnitude as split-fraction deltas (both ≈ [0,1]).
const CONV_PENALTY_SCALE = 3 * BRACKET_12_TOP;

interface Split { tax: number; trad: number; roth: number; }

const buildSplits = (steps: number[]): Split[] => {
  const out: Split[] = [];
  for (const a of steps) {
    for (const b of steps) {
      const c = +(1 - a - b).toFixed(4);
      if (c >= -0.001 && c <= 1.001) {
        out.push({ tax: a, trad: b, roth: Math.max(0, Math.min(1, c)) });
      }
    }
  }
  return out;
};

const COARSE_SPLITS = buildSplits(COARSE_STEPS);
const FINE_SPLITS = buildSplits(FINE_STEPS);

export interface OptimizeResult {
  policy: BlendPolicy;          // Compacted (consecutive identical windows merged)
  perYearPolicy: BlendPolicy;   // Raw one-window-per-year policy used during search
  /** No-conversion counterfactual withdrawal ordering (max-end-balance only): the optimizer's
   *  best ordering with conversions disabled, re-adapted rather than inheriting the with-conversion
   *  splits. Undefined when the result has no conversions (benefit is 0) or for other goals.
   *  Consumed as the "without conversions" baseline for the Roth Conversion Benefit metric. */
  conversionBaselinePolicy?: BlendPolicy;
  metric: number;
  metricFormatted: string;
  ranOut: boolean;
  evaluations: number;
  goal: UserGoal;
  goalLabel: string;
  projection: ProjectionResult;

  // Outer-goal answers
  solvedSpendingMultiplier?: number;    // for 'max-sustainable-spending'
  /** Absolute sum of expense streams the optimizer recommends per year (today's $).
   *  Equals `originalAnnualSpend * solvedSpendingMultiplier`. Used by the apply
   *  handler to detect "already applied" without double-scaling. */
  recommendedAnnualSpend?: number;
  solvedRetirementAge?: number;         // for 'min-retirement-age'

  // Headline string shown in the UI (e.g. "$112,400/yr · today's $").
  headline: string;
  headlineLabel: string;
}

export interface OptimizeOptions {
  /** Run a Nelder-Mead refinement pass after coarse + fine grid. */
  useNelderMead?: boolean;
  /** Run backward/forward refinement passes after the initial forward sweeps.
   *  Roughly doubles inner-search runtime; typically improves end balance 1–5% on healthy plans,
   *  more on tight plans. The conversion decision benefits most. */
  thorough?: boolean;
  /** Use a Monte Carlo–averaged objective in the Nelder-Mead phase instead of the single
   *  deterministic assumed-return scenario. Evaluates each candidate policy across 15 seeded
   *  historical bootstrap paths, selecting the policy that maximises expected end balance
   *  across real return sequences rather than the assumed mean return. Requires useNelderMead.
   *  Adds ~15× cost to the NM phase; partially offset by fewer NM iters per year (~60–90s). */
  mcAware?: boolean;
  /** Progress callback (0..1). Called from outer + inner loops. Worker uses this. */
  onProgress?: (frac: number, message?: string) => void;
}

// ─── INNER SEARCH ─────────────────────────────────────────────────────────────
// Per-year coordinate descent over (pctTax, pctTrad, convFraction).
// convFraction ∈ [0,1] resolves to $ via convFraction × min(currentTradBalance, 3 × bracket12Top × inflF)
// computed dynamically each year from the projection rows (forward sweep).

const sameWindow = (a: BlendWindow, b: BlendWindow): boolean =>
  Math.abs(a.pctTaxable - b.pctTaxable) < 1e-4 &&
  Math.abs(a.pctTraditional - b.pctTraditional) < 1e-4 &&
  Math.abs(a.pctRoth - b.pctRoth) < 1e-4 &&
  Math.abs((a.convAmt ?? 0) - (b.convAmt ?? 0)) < 0.5;

const compact = (windows: BlendWindow[]): BlendWindow[] => {
  if (windows.length === 0) return [];
  const out: BlendWindow[] = [{ ...windows[0] }];
  for (let i = 1; i < windows.length; i++) {
    const last = out[out.length - 1];
    if (sameWindow(last, windows[i])) {
      last.toAge = windows[i].toAge;
    } else {
      out.push({ ...windows[i] });
    }
  }
  return out;
};

interface InnerEval {
  policy: BlendPolicy;
  proj: ProjectionResult;
  score: number;        // 'max-end' direction: higher endTaxAdjustedReal is better
  ranOut: boolean;
}

/** Total-variation penalty on split fractions and (normalised) convAmt.
 *  Purely ordinal — only used to break ties within the flat-ridge tolerance.
 *  Never appears in the reported metric or projection, so end-balance is never
 *  sacrificed for smoothness. */
const policyPenalty = (windows: BlendWindow[]): number => {
  let tv = 0;
  for (let i = 1; i < windows.length; i++) {
    tv += Math.abs(windows[i].pctTaxable - windows[i - 1].pctTaxable);
    tv += Math.abs(windows[i].pctTraditional - windows[i - 1].pctTraditional);
    tv += Math.abs((windows[i].convAmt ?? 0) - (windows[i - 1].convAmt ?? 0)) / CONV_PENALTY_SCALE;
  }
  return tv;
};

/** Compare two evaluations. Depletion-first; then within `tol` of each other prefer
 *  the smoother policy (lower TV penalty); otherwise prefer the higher score.
 *  `tol` defaults to 0 so callers that want strict score ordering get it without
 *  changing behaviour — only sweep and NM pass the flat-ridge tolerance. */
const isBetter = (a: InnerEval, b: InnerEval, tol = 0): boolean => {
  if (a.ranOut !== b.ranOut) return !a.ranOut;
  const diff = a.score - b.score;
  if (Math.abs(diff) > tol) return diff > 0;
  return policyPenalty(a.policy.windows) < policyPenalty(b.policy.windows);
};

// Build a flat per-year window array for retireAge..planToAge with a constant split.
// Respects the optimizeConversions flag: convAmt=0 when optimizer owns conversions,
// undefined when the plan's conversion mode owns them (CRITICAL — never write 0 in mode-owned mode).
const buildConstantSeed = (
  retireAge: number,
  planToAge: number,
  split: { tax: number; trad: number; roth: number },
  optimizeConversions: boolean,
): BlendWindow[] => {
  const windows: BlendWindow[] = [];
  for (let age = retireAge; age <= planToAge; age++) {
    windows.push({
      fromAge: age, toAge: age,
      pctTaxable: split.tax, pctTraditional: split.trad, pctRoth: split.roth,
      convAmt: optimizeConversions ? 0 : undefined,
    });
  }
  return windows;
};

/**
 * Inner optimizer. Scoring: max endTaxAdjustedReal (inflation-adjusted, after estimated
 * tax on pre-tax and unrealized-gain balances), with ranOut strictly worse than any
 * non-depleting plan. Used as the per-evaluation goal for all three user-facing outer goals.
 *
 * seedWindows: optional starting per-year policy. Each window is matched by fromAge;
 *   ages not covered fall back to the cold-start (taxable-first). Allows warm-starting
 *   from a nearby feasible solution to stay in the same objective basin.
 * screenOnly: skip thorough passes, smoothing, and Nelder-Mead — run coarse+fine only.
 *   Used to cheaply rank candidate seeds before committing to a full refinement.
 */
function innerOptimize(
  plan: Plan,
  opts: OptimizeOptions,
  evalCounter: { n: number },
  outerProgress?: () => void,
  seedWindows?: BlendWindow[],
  screenOnly?: boolean,
): InnerEval {
  const innerGoalKey: RecGoal = 'max-end';
  const spec = REC_GOALS[innerGoalKey];
  const retireAge = plan.personA.retirementAge;
  const planToAge = householdPlanThroughAgeA(plan);

  if (retireAge > planToAge) {
    throw new Error('Retirement age is after plan-to age.');
  }

  // When false, the optimizer does NOT search conversion amounts: it leaves every window's
  // convAmt `undefined` so projection falls back to plan.conversion.mode (per year, path-dependent).
  // CRITICAL: never write a numeric convAmt (0 included) in this mode — `0 != null` would take
  // projection's policy path and override the user's chosen conversion mode.
  const optimizeConversions = plan.conversion.optimize ?? true;

  // Build per-year start windows. For each age, prefer the matching seed window (by fromAge);
  // fall back to taxable-first cold start for any age not covered by the seed.
  const startWindows: BlendWindow[] = [];
  for (let age = retireAge; age <= planToAge; age++) {
    // Range match: handles both per-year seeds (fromAge===toAge===age, produced by innerOptimize
    // warm-starts) and compacted seeds (fromAge..toAge spans multiple years, produced by
    // applyResultToPlan storing result.policy). fromAge===age matching would only seed the first
    // year of each compacted window, leaving all other years in the range at cold-start.
    const seeded = seedWindows?.find((w) => age >= w.fromAge && age <= w.toAge);
    if (seeded) {
      // Copy verbatim. If optimizeConversions is false, preserve whatever convAmt the seed has
      // (could be undefined) — do NOT normalise to 0, which would violate the mode-owned invariant.
      startWindows.push({ ...seeded, toAge: age });
    } else {
      startWindows.push({ fromAge: age, toAge: age, pctTaxable: 1, pctTraditional: 0, pctRoth: 0, convAmt: optimizeConversions ? 0 : undefined });
    }
  }

  let bestWindows: BlendWindow[] = startWindows.map((w) => ({ ...w }));
  let bestPolicy: BlendPolicy = { windows: bestWindows, source: 'optimizer' };
  let bestProj = runProjection(plan, { policy: bestPolicy });
  let bestScore = spec.score(bestProj);
  evalCounter.n++;

  // For convAmt cap: per year, cap = min(tradBalance_today's_$, 3 × 12%-bracket-top).
  // convAmt is stored in today's $ (real) per BlendWindow's schema; projection inflates it.
  // So both terms of the cap must be in today's $: divide begTraditional (nominal) by inflF.
  //
  // IMPORTANT: bestWindows[yi] corresponds to age (retireAge + yi), but projection rows are
  // indexed from the plan's start year (current age, not retirement). The offset between
  // them is found by locating the row whose ageA matches retireAge.
  const retireRowOffset = bestProj.rows.findIndex((r) => r.ageA === retireAge);
  const convCapAtYear = (proj: ProjectionResult, yi: number): number => {
    const r = proj.rows[yi + retireRowOffset];
    if (!r) return 0;
    const ceiling = 3 * BRACKET_12_TOP;
    const tradReal = r.begTraditional / r.inflationFactor;
    return Math.max(0, Math.min(tradReal, ceiling));
  };

  /** Per-year coordinate descent over (splits × convFractions).
   *  When optimizeConversions is false, convFractions is ignored and convAmt stays undefined. */
  const sweep = (splits: Split[], convFractions: number[], direction: 'forward' | 'backward' = 'forward'): boolean => {
    let improvedAny = false;
    const total = bestWindows.length;
    const order = direction === 'forward'
      ? Array.from({ length: total }, (_, i) => i)
      : Array.from({ length: total }, (_, i) => total - 1 - i);
    for (const yi of order) {
      const baseW = bestWindows[yi];
      const cap = optimizeConversions ? convCapAtYear(bestProj, yi) : 0;
      const cfs: (number | null)[] = optimizeConversions && cap >= 1 ? convFractions : [null];
      let cur: InnerEval = { policy: bestPolicy, proj: bestProj, score: bestScore, ranOut: bestProj.ranOut };

      for (const s of splits) {
        for (const cf of cfs) {
          const newConvAmt = cf !== null ? Math.round(cf * cap) : undefined;
          const sameSplit = Math.abs(s.tax - baseW.pctTaxable) < 1e-4 &&
                            Math.abs(s.trad - baseW.pctTraditional) < 1e-4;
          const sameConv = newConvAmt === undefined
            ? true
            : Math.abs(newConvAmt - (baseW.convAmt ?? 0)) < 0.5;
          if (sameSplit && sameConv) continue;

          const trial = bestWindows.map((w, idx) => {
            if (idx !== yi) return w;
            const updated: BlendWindow = { ...w, pctTaxable: s.tax, pctTraditional: s.trad, pctRoth: s.roth };
            if (optimizeConversions) updated.convAmt = newConvAmt;
            return updated;
          });
          const trialPolicy: BlendPolicy = { windows: trial, source: 'optimizer' };
          const proj = runProjection(plan, { policy: trialPolicy });
          const score = spec.score(proj);
          evalCounter.n++;
          const candidate: InnerEval = { policy: trialPolicy, proj, score, ranOut: proj.ranOut };
          if (isBetter(candidate, cur)) cur = candidate;
        }
      }

      if (cur.policy !== bestPolicy) {
        bestWindows = cur.policy.windows;
        bestPolicy = cur.policy;
        bestProj = cur.proj;
        bestScore = cur.score;
        improvedAny = true;
      }
      outerProgress?.();
    }
    return improvedAny;
  };

  sweep(COARSE_SPLITS, CONV_COARSE, 'forward');

  // ACA cliff anchor: the 400% FPL cliff is a discontinuity — coordinate descent cannot
  // cross it organically. For each pre-Medicare year where the current best MAGI is above
  // the cliff, compute the withdrawal split that targets MAGI just below 399% FPL and
  // evaluate it as a single additional candidate. Accepts only if strictly better.
  if (plan.assumptions.modelACA && (plan.assumptions.acaBenchmarkPremium ?? 0) > 0 && !plan.assumptions.acaNoSubsidy) {
    const fpl = FPL_BASE + Math.max(0, plan.assumptions.acaHouseholdSize - 1) * FPL_INCREMENT;
    for (let yi = 0; yi < bestWindows.length; yi++) {
      const row = bestProj.rows[yi + retireRowOffset];
      if (!row || row.acaPremium <= 0) continue;

      const targetMAGI = 3.99 * fpl * row.inflationFactor;
      if (row.magi <= targetMAGI) continue;  // already in or below the subsidy band

      // Exact withdrawal amounts are on the row — no estimation needed.
      // Gain fraction: capital-gains portion of taxable withdrawal only (excludes qualified divs).
      const gainFrac = row.wdTax > 1 ? Math.max(0, Math.min(1, (row.ltcg - row.qualifiedDiv) / row.wdTax)) : 0;
      // Fixed MAGI: what remains with zero withdrawals and zero conversion (anchor sets convAmt=0).
      const fixedMAGI = Math.max(0, row.magi - row.wdTrd - row.wdTax * gainFrac - row.rothConv);
      if (fixedMAGI >= targetMAGI) continue;  // fixed income alone exceeds target; no split can help

      // With pctTaxable=0: only traditional withdrawals add variable MAGI (1:1 with ordIncome).
      const pctTrad = Math.max(0, Math.min(1, (targetMAGI - fixedMAGI) / Math.max(1, row.totalWD)));
      const trial = bestWindows.map((w, idx) => {
        if (idx !== yi) return w;
        const updated: BlendWindow = {
          ...w,
          pctTaxable: 0,
          pctTraditional: +pctTrad.toFixed(4),
          pctRoth: +(1 - pctTrad).toFixed(4),
        };
        if (optimizeConversions) updated.convAmt = 0;
        return updated;
      });
      const trialPolicy: BlendPolicy = { windows: trial, source: 'optimizer' };
      const proj = runProjection(plan, { policy: trialPolicy });
      const score = spec.score(proj);
      evalCounter.n++;
      const candidate: InnerEval = { policy: trialPolicy, proj, score, ranOut: proj.ranOut };
      if (isBetter(candidate, { policy: bestPolicy, proj: bestProj, score: bestScore, ranOut: bestProj.ranOut })) {
        bestWindows = trial;
        bestPolicy = trialPolicy;
        bestProj = proj;
        bestScore = score;
      }
    }
  }

  sweep(FINE_SPLITS, CONV_FINE, 'forward');

  // screenOnly: stop here — coarse+fine grid is sufficient for basin ranking.
  if (screenOnly) {
    return { policy: bestPolicy, proj: bestProj, score: bestScore, ranOut: bestProj.ranOut };
  }

  // Thorough mode: alternate backward / forward passes until no improvement.
  if (opts.thorough) {
    for (let pass = 0; pass < 3; pass++) {
      const direction = pass % 2 === 0 ? 'backward' : 'forward';
      if (!sweep(FINE_SPLITS, CONV_FINE, direction)) break;
    }
  }

  // Smoothing pass: redistribute conversion $ between adjacent years to break
  // coordinate-descent local optima that produce spiky schedules (e.g., $0/$0/$372K/$0).
  // Accepts redistributions whose endBalance is within a tight tolerance — preserves
  // solution quality, removes visual bumpiness, and often finds strictly better solutions
  // because the tax cost of a smooth schedule is lower than a spiky one.
  // Skipped entirely when conversions aren't optimized (convAmt stays undefined).
  if (optimizeConversions) {
    const spec = REC_GOALS[innerGoalKey];
    // Tolerance: 0.1% of bestScore, floored at $1000. Small enough that the
    // user wouldn't notice the end-balance change; large enough to traverse
    // near-flat ridges where the optimizer's grid quantization created spikes.
    const tol = Math.max(1000, Math.abs(bestScore) * 0.001);

    const tryConvs = (newConvs: number[]): boolean => {
      const trial = bestWindows.map((w, i) => ({ ...w, convAmt: Math.max(0, newConvs[i]) }));
      const trialPolicy: BlendPolicy = { windows: trial, source: 'optimizer' };
      const proj = runProjection(plan, { policy: trialPolicy });
      evalCounter.n++;
      if (proj.ranOut) return false;
      const trialScore = spec.score(proj);
      if (trialScore >= bestScore - tol) {
        bestWindows = trial;
        bestPolicy = trialPolicy;
        bestProj = proj;
        // Use the trial's actual score, not the prior peak — otherwise `metric` reports
        // a value that doesn't match the projection it's paired with (Layer 2's score
        // round-trip property catches this).
        bestScore = trialScore;
        return true;
      }
      return false;
    };

    for (let pass = 0; pass < 6; pass++) {
      let changed = false;

      // Pairwise leveling: try moving each (i, i+1) toward an equal split.
      for (let i = 0; i < bestWindows.length - 1; i++) {
        const c1 = bestWindows[i].convAmt ?? 0;
        const c2 = bestWindows[i + 1].convAmt ?? 0;
        const total = c1 + c2;
        if (total < 1000) continue;
        if (Math.abs(c1 - c2) < 500) continue;

        const convs = bestWindows.map((w) => w.convAmt ?? 0);
        const avg = convs.slice();
        avg[i] = total / 2;
        avg[i + 1] = total / 2;
        if (tryConvs(avg)) { changed = true; continue; }
        // Half-shift toward average (smaller step in case full level is too aggressive)
        const half = convs.slice();
        half[i] = (c1 + total / 2) / 2;
        half[i + 1] = (c2 + total / 2) / 2;
        if (tryConvs(half)) { changed = true; }
      }

      // 5-year window smearing: isolated spike surrounded by ≥4 low neighbors
      // (e.g., $0/$0/$372K/$0/$0). Try spreading across the entire window.
      for (let i = 2; i < bestWindows.length - 2; i++) {
        const cs = [-2, -1, 0, 1, 2].map((k) => bestWindows[i + k].convAmt ?? 0);
        const peak = cs[2];
        const neighborMax = Math.max(cs[0], cs[1], cs[3], cs[4]);
        if (peak < neighborMax + 20000) continue;

        const total = cs.reduce((a, b) => a + b, 0);
        const convs = bestWindows.map((w) => w.convAmt ?? 0);
        const uniform5 = convs.slice();
        for (let k = 0; k < 5; k++) uniform5[i - 2 + k] = total / 5;
        if (tryConvs(uniform5)) { changed = true; continue; }
        // Tent: peak at center but neighbors lifted
        const tent = convs.slice();
        const newPeak = peak * 0.5;
        const remainder = (total - newPeak) / 4;
        for (let k = 0; k < 5; k++) {
          tent[i - 2 + k] = k === 2 ? newPeak : remainder;
        }
        if (tryConvs(tent)) { changed = true; }
      }

      // Triple-smearing: for years with a conversion spike vs both neighbors,
      // try redistributing the trio. Targets the $0/$X/$0 pattern directly.
      for (let i = 1; i < bestWindows.length - 1; i++) {
        const c0 = bestWindows[i - 1].convAmt ?? 0;
        const c1 = bestWindows[i].convAmt ?? 0;
        const c2 = bestWindows[i + 1].convAmt ?? 0;
        if (c1 < Math.max(c0, c2) + 5000) continue;

        const total = c0 + c1 + c2;
        const convs = bestWindows.map((w) => w.convAmt ?? 0);
        const uniform = convs.slice();
        uniform[i - 1] = total / 3;
        uniform[i] = total / 3;
        uniform[i + 1] = total / 3;
        if (tryConvs(uniform)) { changed = true; continue; }
        // Half-spread: halve the spike, split the remainder evenly to neighbors
        const halfSpread = convs.slice();
        const peakHalved = c1 / 2;
        const extra = (c1 - peakHalved) / 2;
        halfSpread[i - 1] = c0 + extra;
        halfSpread[i] = peakHalved;
        halfSpread[i + 1] = c2 + extra;
        if (tryConvs(halfSpread)) { changed = true; }
      }

      if (!changed) break;
      outerProgress?.();
    }
  }

  // Withdrawal-split smoothing: flatten year-to-year taxable/Roth oscillations that arise
  // from coordinate-descent local optima on a near-flat objective landscape. pctTraditional
  // is kept fixed — it's sized for bracket/RMD interaction and has direct tax consequences.
  // We only swap between taxable and Roth within each year's remaining free budget (1 - trad).
  // Accepts reallocations within the same tight tolerance used for conversion smoothing.
  {
    const splitTol = Math.max(1000, Math.abs(bestScore) * 0.001);

    const trySplitWindows = (newWindows: BlendWindow[]): boolean => {
      const trialPolicy: BlendPolicy = { windows: newWindows, source: 'optimizer' };
      const proj = runProjection(plan, { policy: trialPolicy });
      evalCounter.n++;
      if (proj.ranOut) return false;
      const trialScore = spec.score(proj);
      if (trialScore >= bestScore - splitTol) {
        bestWindows = newWindows;
        bestPolicy = trialPolicy;
        bestProj = proj;
        bestScore = trialScore;
        return true;
      }
      return false;
    };

    for (let pass = 0; pass < 4; pass++) {
      let changed = false;

      // Pairwise leveling: average the taxable fraction of the non-trad budget between
      // adjacent years. Keeps pctTraditional unchanged; pctRoth absorbs the remainder.
      for (let i = 0; i < bestWindows.length - 1; i++) {
        const w0 = bestWindows[i];
        const w1 = bestWindows[i + 1];
        const free0 = 1 - w0.pctTraditional;
        const free1 = 1 - w1.pctTraditional;
        if (free0 < 0.01 || free1 < 0.01) continue;

        const taxFrac0 = free0 > 0 ? w0.pctTaxable / free0 : 0;
        const taxFrac1 = free1 > 0 ? w1.pctTaxable / free1 : 0;
        if (Math.abs(taxFrac0 - taxFrac1) < 0.05) continue; // already similar, skip

        const avgFrac = (taxFrac0 + taxFrac1) / 2;
        const trial = bestWindows.map((w, idx) => {
          if (idx !== i && idx !== i + 1) return w;
          const free = idx === i ? free0 : free1;
          return { ...w, pctTaxable: avgFrac * free, pctRoth: (1 - avgFrac) * free };
        });
        if (trySplitWindows(trial)) { changed = true; }
      }

      if (!changed) break;
    }
  }

  if (opts.useNelderMead) {
    // MC path pre-generation for mcAware mode.
    // 15 paths, seed=42 (same default as runMonteCarlo), so the NM objective
    // is aligned with what the Monte Carlo page displays.
    type MCPath = { returns: number[]; inflations: number[] };
    let mcPaths: MCPath[] | null = null;
    if (opts.mcAware) {
      const rand = mulberry32(42);
      const equityPct = plan.assumptions.equityPct;
      const nYears = bestProj.rows.length;
      mcPaths = Array.from({ length: 15 }, () =>
        historicalBootstrap(rand, equityPct, nYears, 3)
      );
    }

    // NM objective: single deterministic score (standard) or 15-path MC average (mcAware).
    // Returns value to minimise; depletion ⇒ 1e15 penalty.
    const nmObj = (windows: BlendWindow[]): number => {
      const policy: BlendPolicy = { windows, source: 'optimizer' };
      if (!mcPaths) {
        const proj = runProjection(plan, { policy });
        evalCounter.n++;
        return proj.ranOut ? 1e15 : -spec.score(proj);
      }
      let sum = 0;
      let anyRanOut = false;
      for (const path of mcPaths) {
        const proj = runProjection(plan, {
          policy,
          returnOverrides: path.returns,
          inflationOverrides: path.inflations,
        });
        evalCounter.n++;
        if (proj.ranOut) anyRanOut = true;
        else sum += spec.score(proj);
      }
      return anyRanOut ? 1e15 : -(sum / mcPaths.length);
    };

    // Fewer NM iters in mcAware mode — each eval costs ~15×.
    const nA = opts.mcAware ? 15 : 40;
    const nB = opts.mcAware ? 10 : 30;
    const nC = opts.mcAware ? 8 : 20;

    // Run Nelder-Mead for one retirement year and accept the result.
    // Standard mode: accept only if deterministically better.
    // MC mode: accept any non-depleting result — the MC objective drove the search;
    // a small deterministic trade-off is expected and intentional.
    const nmYear = (yi: number, maxIter: number): void => {
      const cur = bestWindows[yi];
      const cap = convCapAtYear(bestProj, yi);
      let newWindows: BlendWindow[];

      // Round NM output to 4 decimal places. sameWindow() uses 1e-4 tolerance, so values
      // within that band collapse to the same float, ensuring compact() merges them correctly
      // and result.projection matches the re-projected applied plan exactly (round-trip).
      const r4 = (x: number) => Math.round(x * 10000) / 10000;

      // 2-D withdrawal-only search when there's no conversion headroom (cap < 1) OR when
      // conversions aren't optimized (convAmt must stay undefined — never write it here).
      if (cap < 1 || !optimizeConversions) {
        const obj = (p: [number, number]): number => {
          const [tax, trad] = p;
          return nmObj(bestWindows.map((w, idx) =>
            idx === yi ? { ...w, pctTaxable: tax, pctTraditional: trad, pctRoth: Math.max(0, 1 - tax - trad) } : w
          ));
        };
        const nm = nelderMead2D([cur.pctTaxable, cur.pctTraditional], obj, { maxIter });
        const tax = r4(nm.x[0]), trad = r4(nm.x[1]);
        newWindows = bestWindows.map((w, idx) =>
          idx === yi ? { ...w, pctTaxable: tax, pctTraditional: trad, pctRoth: Math.max(0, r4(1 - tax - trad)) } : w
        );
      } else {
        const startCF = (cur.convAmt ?? 0) / cap;
        const obj = (p: [number, number, number]): number => {
          const [tax, trad, cf] = p;
          return nmObj(bestWindows.map((w, idx) =>
            idx === yi ? { ...w, pctTaxable: tax, pctTraditional: trad, pctRoth: Math.max(0, 1 - tax - trad), convAmt: cf * cap } : w
          ));
        };
        const nm = nelderMead3D([cur.pctTaxable, cur.pctTraditional, startCF], obj, { maxIter });
        const tax = r4(nm.x[0]), trad = r4(nm.x[1]);
        newWindows = bestWindows.map((w, idx) =>
          idx === yi ? {
            ...w,
            pctTaxable: tax,
            pctTraditional: trad,
            pctRoth: Math.max(0, r4(1 - tax - trad)),
            convAmt: Math.round(nm.x[2] * cap),
          } : w
        );
      }

      const trialPolicy: BlendPolicy = { windows: newWindows, source: 'optimizer' };
      const proj = runProjection(plan, { policy: trialPolicy });
      evalCounter.n++;
      const candidate: InnerEval = { policy: trialPolicy, proj, score: spec.score(proj), ranOut: proj.ranOut };
      const nmTol = Math.max(1000, Math.abs(bestScore) * 0.001);
      const accept = mcPaths
        ? !candidate.ranOut
        : isBetter(candidate, { policy: bestPolicy, proj: bestProj, score: bestScore, ranOut: bestProj.ranOut }, nmTol);
      if (accept) {
        bestWindows = newWindows;
        bestPolicy = trialPolicy;
        bestProj = proj;
        bestScore = candidate.score;
      }
    };

    // Phase 6a — backward sweep: start from final year, work toward first.
    // Correctly propagates the terminal-value signal backward so early Roth
    // conversions see their downstream RMD reduction benefit during search.
    for (let yi = bestWindows.length - 1; yi >= 0; yi--) {
      nmYear(yi, nA);
      outerProgress?.();
    }
    // Phase 6b — forward sweep: refine early years given updated later-year policies.
    for (let yi = 0; yi < bestWindows.length; yi++) {
      nmYear(yi, nB);
      outerProgress?.();
    }
    // Phase 6c — backward convergence pass: propagate any forward-pass changes back.
    for (let yi = bestWindows.length - 1; yi >= 0; yi--) {
      nmYear(yi, nC);
      outerProgress?.();
    }
  }

  // Canonicalize convAmts before returning. The smoothing passes can leave fractional
  // dollar values (e.g., 12345.67) because they average adjacent windows. compact() uses
  // a 0.5-dollar tolerance in sameWindow(), so two windows with $12345.26 and $12345.74
  // get merged — but applyResultToPlan rounds each independently and could produce different
  // integers. Rounding now ensures merged windows always produce the same integer and
  // result.projection is consistent with the applied plan's re-projection.
  const roundedWindows = bestWindows.map((w) => ({
    ...w,
    convAmt: w.convAmt != null ? Math.round(w.convAmt) : w.convAmt,
  }));
  if (roundedWindows.some((w, i) => w.convAmt !== bestWindows[i].convAmt)) {
    bestWindows = roundedWindows;
    bestPolicy = { windows: bestWindows, source: 'optimizer' };
    bestProj = runProjection(plan, { policy: bestPolicy });
    evalCounter.n++;
    bestScore = spec.score(bestProj);
  }

  return { policy: bestPolicy, proj: bestProj, score: bestScore, ranOut: bestProj.ranOut };
}

// ─── OUTER GOALS ──────────────────────────────────────────────────────────────

const fmtUSD = (n: number) => '$' + Math.round(n).toLocaleString();
const fmtM = (n: number) => '$' + (n / 1_000_000).toFixed(2) + 'M';

/**
 * Compute an amortization-based sustainable spending estimate.
 * Returns both the absolute real dollar amount and the multiplier relative to current expenses.
 * The absolute amount is used when baseSpend = 0 so the bisection has a meaningful base to scale.
 */
function amortizationSeed(plan: Plan): { absoluteReal: number; multiplier: number } {
  const retireAge = plan.personA.retirementAge;
  const planToAge = householdPlanThroughAgeA(plan);
  const n = Math.max(1, planToAge - retireAge + 1);
  const inf = plan.assumptions.inflation;
  const p = plan.portfolio;

  // Blended nominal return weighted by current bucket balances
  const totA = p.personA.taxable + p.personA.traditional + p.personA.roth;
  const totB = p.personB ? p.personB.taxable + p.personB.traditional + p.personB.roth : 0;
  const tot = totA + totB || 1;
  const blendA = totA > 0
    ? (p.personA.taxable * plan.assumptions.taxableReturn +
       p.personA.traditional * plan.assumptions.tradReturn +
       p.personA.roth * plan.assumptions.rothReturn) / totA
    : plan.assumptions.tradReturn;
  const blendB = totB > 0 && p.personB
    ? (p.personB.taxable * plan.assumptions.taxableReturn +
       p.personB.traditional * plan.assumptions.tradReturn +
       p.personB.roth * plan.assumptions.rothReturn) / totB
    : plan.assumptions.tradReturn;
  const blendNominal = (totA * blendA + totB * blendB) / tot;
  const realR = Math.max(0.001, (1 + blendNominal) / (1 + inf) - 1);

  // Quick projection to get at-retirement portfolio and external income in real (today's) dollars
  const proj = runProjection(plan);
  const retireRow = proj.rows.find((r) => r.ageA === retireAge);
  const inflF = retireRow ? retireRow.inflationFactor : 1;
  const portfolioRealAtRetire = retireRow
    ? (retireRow.begTaxable + retireRow.begTraditional + retireRow.begRoth) / inflF
    : tot;

  // Average annual external income in today's dollars across retirement rows
  const retRows = proj.rows.filter((r) => r.ageA >= retireAge);
  const avgExternalReal = retRows.length > 0
    ? retRows.reduce((s, r) => s + (r.totalSS + r.otherIncome) / r.inflationFactor, 0) / retRows.length
    : 0;

  // Annuity factor: PV of inflation-adjusted $1/yr at real rate for n years
  const annuityFactor = (1 - Math.pow(1 + realR, -n)) / realR;
  const portfolioWithdrawalReal = portfolioRealAtRetire / annuityFactor;
  const absoluteReal = Math.max(1, portfolioWithdrawalReal + avgExternalReal);

  const baseSpend = plan.expenseStreams.reduce((s, e) => s + e.annualAmount, 0);
  const multiplier = baseSpend > 0
    ? Math.max(0.3, Math.min(8.0, absoluteReal / baseSpend))
    : 1.0;

  return { absoluteReal, multiplier };
}

/** Scale every expense stream's annualAmount by `s`. */
function scaleExpenses(plan: Plan, s: number): Plan {
  return {
    ...plan,
    expenseStreams: plan.expenseStreams.map((e) => ({ ...e, annualAmount: e.annualAmount * s })),
  };
}

/** Set retirement age for personA (and personB if present, capped at their original). */
function setRetirementAge(plan: Plan, ageA: number): Plan {
  return shiftRetirementAge(plan, ageA);
}

function packageResult(
  inner: InnerEval,
  goal: UserGoal,
  evals: number,
  extras: { solvedSpendingMultiplier?: number; recommendedAnnualSpend?: number; solvedRetirementAge?: number; headline: string; headlineLabel: string; conversionBaselinePolicy?: BlendPolicy },
): OptimizeResult {
  const spec = REC_GOALS['max-end'];
  return {
    policy: { ...inner.policy, windows: compact(inner.policy.windows), source: 'optimizer', goal },
    perYearPolicy: inner.policy,
    conversionBaselinePolicy: extras.conversionBaselinePolicy,
    metric: inner.score,
    metricFormatted: spec.format(inner.score),
    ranOut: inner.ranOut,
    evaluations: evals,
    goal,
    goalLabel: USER_GOALS[goal].label,
    projection: inner.proj,
    solvedSpendingMultiplier: extras.solvedSpendingMultiplier,
    recommendedAnnualSpend: extras.recommendedAnnualSpend,
    solvedRetirementAge: extras.solvedRetirementAge,
    headline: extras.headline,
    headlineLabel: extras.headlineLabel,
  };
}

// ─── MULTI-START INNER (max-end-balance) ──────────────────────────────────────
// Screens 3 diverse constant seeds (taxable-first, traditional-first, roth-first) with a cheap
// coarse+fine pass, fully refines the top-2, then runs several post-refinement competitors.
//
// Post-refinement competitors (same pattern as customPolicy — direct full refinement, no
// screening, so coordinate descent refines *within* an existing basin):
//   1. Prior cross-goal customPolicy (if present) — avoids feedback-loop drift on same goal.
//   2. Bracketfill preset with no conversions — catches plans where bracket-filling traditional
//      in early low-income years beats conversion-heavy strategies globally. Only triggered when
//      the bracketfill preset (one cheap projection) already outscores the multi-start best;
//      otherwise the 3-seed screening already found the right basin and adding this would be
//      wasted compute. Critical for plans like: large traditional ($1.2M+), modest fixed income
//      ($20K pension), RMD age 75 (born 1960+). For such plans the optimizer without this
//      check finds a local optimum with massive Roth conversions (~$80K/yr) that destroys $1M+
//      of wealth vs the bracketfill+no-conversion optimum.
//   3. Zero-pre-Medicare conversions — catches plans where coordinate descent locks into a
//      pre-65 conversion island that is worse than deferring all conversions post-Medicare.
function multiStartInner(plan: Plan, opts: OptimizeOptions, evalCounter: { n: number }, outerProgress?: () => void): InnerEval {
  const retireAge = plan.personA.retirementAge;
  const planToAge = householdPlanThroughAgeA(plan);
  const optimizeConversions = plan.conversion.optimize ?? true;

  const constantSeeds: BlendWindow[][] = [
    buildConstantSeed(retireAge, planToAge, { tax: 1, trad: 0, roth: 0 }, optimizeConversions), // taxable-first
    buildConstantSeed(retireAge, planToAge, { tax: 0, trad: 1, roth: 0 }, optimizeConversions), // traditional-first
    buildConstantSeed(retireAge, planToAge, { tax: 0, trad: 0, roth: 1 }, optimizeConversions), // roth-first
  ];

  // Screen 3 constant seeds with coarse+fine only, fully refine top-2.
  const screened = constantSeeds.map((seed) =>
    innerOptimize(plan, opts, evalCounter, outerProgress, seed, true)
  );
  screened.sort((a, b) => isBetter(a, b) ? -1 : isBetter(b, a) ? 1 : 0);
  const refined = screened.slice(0, 2).map((s) =>
    innerOptimize(plan, opts, evalCounter, outerProgress, s.policy.windows)
  );
  let best = refined.reduce((a, b) => isBetter(a, b) ? a : b);

  // Competitor 1: prior cross-goal customPolicy.
  if (plan.customPolicy?.windows?.length && plan.customPolicy.goal !== 'max-end-balance') {
    const priorRefined = innerOptimize(plan, opts, evalCounter, outerProgress, plan.customPolicy.windows);
    if (isBetter(priorRefined, best)) best = priorRefined;
  }

  // Competitor 2: bracketfill preset with no conversions.
  // One cheap projection establishes whether the bracketfill basin is globally better than the
  // multi-start result. Full refinement only fires when it is — no overhead for typical plans.
  if (optimizeConversions) {
    const bfCheckPlan: Plan = {
      ...plan,
      withdrawalStrategy: 'bracketfill',
      customPolicy: undefined,
      conversion: { ...plan.conversion, mode: 'off', optimize: false },
    };
    const bfCheckProj = runProjection(bfCheckPlan);
    if (!bfCheckProj.ranOut && REC_GOALS['max-end'].score(bfCheckProj) > best.score) {
      const bfSeed: BlendWindow[] = [];
      for (let age = retireAge; age <= planToAge; age++) {
        const row = bfCheckProj.rows.find((r) => r.ageA === age);
        const total = row ? row.wdTrd + row.wdRth + row.wdTax : 0;
        bfSeed.push(
          !row || total < 1
            ? { fromAge: age, toAge: age, pctTaxable: 1, pctTraditional: 0, pctRoth: 0, convAmt: 0 }
            : { fromAge: age, toAge: age, pctTaxable: row.wdTax / total, pctTraditional: row.wdTrd / total, pctRoth: row.wdRth / total, convAmt: 0 }
        );
      }
      const bfRefined = innerOptimize(plan, opts, evalCounter, outerProgress, bfSeed);
      if (isBetter(bfRefined, best)) best = bfRefined;
    }
  }

  // Competitor 3: zero-pre-Medicare conversions.
  if (optimizeConversions) {
    const noPreMedicareConvSeed = best.policy.windows.map((w) =>
      w.fromAge < 65 ? { ...w, convAmt: 0 } : w
    );
    const noPreMedRefined = innerOptimize(plan, opts, evalCounter, outerProgress, noPreMedicareConvSeed);
    if (isBetter(noPreMedRefined, best)) best = noPreMedRefined;
  }

  return best;
}

// ─── OPTIMALITY GAP MEASUREMENT ───────────────────────────────────────────────

export interface OptimizerRunResult {
  label: string;
  score: number;
  evaluations: number;
  ranOut: boolean;
}

export interface OptimalityGapResult {
  runs: OptimizerRunResult[];
  /** Best tax-adjusted end-balance (endTaxAdjustedReal) among non-depleting runs. */
  bestScore: number;
  /** Worst tax-adjusted end-balance among non-depleting runs. */
  worstScore: number;
  /** (best − worst) / |best| × 100. How far the weakest start is from the best. */
  spreadPct: number;
  /** Count of seeds that depleted the portfolio before Plan-To Age. */
  depletedCount: number;
}

/**
 * Measures how consistent the inner optimizer is across diverse starting seeds.
 * Runs a full innerOptimize (coarse + fine + smoothing; NM if opts.useNelderMead) from
 * 7 constant starting policies covering every corner and edge midpoint of the allocation
 * simplex. The spread in final scores quantifies local-optima exposure.
 *
 * Small spreadPct (< 2%): landscape is smooth, optimizer is reliable.
 * Medium (2–10%):         multiple basins exist; starting point sometimes matters.
 * Large (> 10%):          significant local-optima problem; results vary by run.
 */
export function measureOptimalityGap(
  plan: Plan,
  opts: Pick<OptimizeOptions, 'useNelderMead' | 'thorough' | 'mcAware'> = {},
): OptimalityGapResult {
  const retireAge = plan.personA.retirementAge;
  const planToAge = householdPlanThroughAgeA(plan);
  const optimizeConversions = plan.conversion.optimize ?? true;

  const SPLIT_CONFIGS: Array<{ label: string; tax: number; trad: number; roth: number }> = [
    { label: 'taxable-first',   tax: 1,    trad: 0,    roth: 0    },
    { label: 'trad-first',      tax: 0,    trad: 1,    roth: 0    },
    { label: 'roth-first',      tax: 0,    trad: 0,    roth: 1    },
    { label: 'balanced',        tax: 1/3,  trad: 1/3,  roth: 1/3  },
    { label: 'tax+trad',        tax: 0.5,  trad: 0.5,  roth: 0    },
    { label: 'tax+roth',        tax: 0.5,  trad: 0,    roth: 0.5  },
    { label: 'trad+roth',       tax: 0,    trad: 0.5,  roth: 0.5  },
  ];

  // Two conversion starting levels: zero (all seeds start with no conversions) and a
  // substantial non-zero amount (BRACKET_12_TOP ≈ $100K/yr). This probes both sides of
  // any conversion-amount local optimum — a critical dimension the withdrawal-split seeds
  // alone miss entirely. The per-year cap inside innerOptimize clamps this to tradBalance,
  // so it is safe to pass the same ceiling regardless of plan size.
  const CONV_STARTS = optimizeConversions ? [0, BRACKET_12_TOP] : [0];

  const runs: OptimizerRunResult[] = [];
  for (const initConv of CONV_STARTS) {
    for (const { label, tax, trad, roth } of SPLIT_CONFIGS) {
      const seedWindows: BlendWindow[] = [];
      for (let age = retireAge; age <= planToAge; age++) {
        seedWindows.push({
          fromAge: age, toAge: age,
          pctTaxable: tax, pctTraditional: trad, pctRoth: roth,
          convAmt: optimizeConversions ? initConv : undefined,
        });
      }
      const counter = { n: 0 };
      const result = innerOptimize(plan, opts as OptimizeOptions, counter, undefined, seedWindows, false);
      const convLabel = initConv === 0 ? 'no-conv' : 'hi-conv';
      runs.push({ label: `${label} (${convLabel})`, score: result.score, evaluations: counter.n, ranOut: result.ranOut });
    }
  }

  const nonDepleted = runs.filter((r) => !r.ranOut);
  if (nonDepleted.length === 0) {
    return { runs, bestScore: 0, worstScore: 0, spreadPct: 0, depletedCount: runs.length };
  }

  const scores = nonDepleted.map((r) => r.score);
  const bestScore = Math.max(...scores);
  const worstScore = Math.min(...scores);
  const spreadPct = Math.abs(bestScore) > 1
    ? Math.abs(bestScore - worstScore) / Math.abs(bestScore) * 100
    : 0;

  return { runs, bestScore, worstScore, spreadPct, depletedCount: runs.length - nonDepleted.length };
}

/** No-conversion counterfactual for the Roth Conversion Benefit metric (max-end-balance only).
 *  Re-runs the optimizer with conversions disabled so the withdrawal ordering re-adapts to the
 *  no-conversion world (the with-conversion ordering is co-optimized against a conversion schedule
 *  and is the wrong ordering here). Warm-starts a competitor from the with-conversion ordering
 *  (conversions stripped) so the baseline never lands worse than a hand-reachable solution.
 *  Returns undefined when the result has no conversions — benefit is then definitionally ~0 and
 *  the cheap zeroed-policy baseline in comparison.ts suffices, so the second optimize is skipped. */
function computeConversionBaseline(
  plan: Plan,
  opts: OptimizeOptions,
  evalCounter: { n: number },
  withConvInner: InnerEval,
): BlendPolicy | undefined {
  // "Has conversions" must reflect what the projection actually converted, not just the optimizer's
  // per-window convAmt: when conversion.optimize is false the optimizer owns only the withdrawal
  // ordering and conversions flow from conversion.mode (auto-window / bracket-fill / manual), landing
  // in the projection but never in customPolicy.convAmt. Keying off convAmt alone would skip the
  // baseline for exactly the "optimized ordering + fixed conversion schedule" plans that need it.
  if (withConvInner.proj.lifetimeConversion <= 1000) return undefined;

  const baselinePlan: Plan = {
    ...plan,
    customPolicy: undefined,
    conversion: { ...plan.conversion, mode: 'off', optimize: false },
  };
  // Robust baseline: full multi-start (cheaper than the with-conversion run — the conversion
  // search dimension is off — and flat across withdrawal presets because it overwrites the seed).
  let baseline = multiStartInner(baselinePlan, opts, evalCounter);
  // Warm-start competitor from the with-conversion ordering, conversions stripped. optimizeConversions
  // is false here, so convAmt must be undefined (never 0) to honour the mode-owned invariant.
  const warmSeed = withConvInner.policy.windows.map((w) => ({ ...w, convAmt: undefined }));
  const warm = innerOptimize(baselinePlan, opts, evalCounter, undefined, warmSeed);
  if (isBetter(warm, baseline)) baseline = warm;

  return { windows: compact(baseline.policy.windows), source: 'optimizer', goal: 'max-end-balance' };
}

export function optimizeStrategy(plan: Plan, goal: UserGoal, opts: OptimizeOptions = {}): OptimizeResult {
  const evalCounter = { n: 0 };

  if (goal === 'max-end-balance') {
    opts.onProgress?.(0, 'Optimizing withdrawals and conversions…');
    // Multi-start: screen 3 diverse seeds, fully refine top-2, take the best.
    // Prevents coordinate descent from being stuck in a single local basin.
    const inner = multiStartInner(plan, opts, evalCounter);
    opts.onProgress?.(0.9, 'Measuring conversion benefit…');
    const conversionBaselinePolicy = computeConversionBaseline(plan, opts, evalCounter, inner);
    opts.onProgress?.(1, 'Done');
    const endTaxAdj = inner.proj.endTaxAdjustedReal;
    return packageResult(inner, goal, evalCounter.n, {
      headline: fmtM(endTaxAdj),
      headlineLabel: 'Tax-adjusted balance (today\'s $)',
      conversionBaselinePolicy,
    });
  }

  if (goal === 'max-sustainable-spending') {
    // Bracket-then-bisect:
    //  1. Doubling search from s=1.0 to find a feasible/infeasible pair (avoids wasting bisection
    //     steps on impossibly-high multipliers when the true answer is near 1.0).
    //  2. Bisection inside the bracket to pin the boundary.
    // Warm-start: every probe is seeded from bestFeasible's per-year windows so the search
    // stays in the same objective basin. A feasible policy at spending ≤ probe is always a
    // valid starting point; a genuinely-feasible level can no longer be mislabelled infeasible.
    // Cross-goal seed: use customPolicy from a different goal as first-probe fallback.
    // Excluded when customPolicy is from this same goal to prevent feedback-loop drift.
    const baseAnnualSpend = plan.expenseStreams.reduce((sum, e) => sum + e.annualAmount, 0);
    const { absoluteReal: amortAbs } = amortizationSeed(plan);

    // Bisect over absolute spending dollars so the result is independent of how large
    // or small the plan's current expense streams are. A $1 or $0 base would make
    // multiplier-based bisection useless — the seed would be clamped and the search
    // would never reach the true sustainable level.
    // For plans with expenses, scaleTo(dollars) scales each stream proportionally so
    // their relative sizes are preserved. For zero-expense plans, a proxy stream is
    // used so the projection sees real spending (the proxy is not persisted — apply
    // skips the scaling step when baseAnnualSpend = 0 and recommendedAnnualSpend
    // serves as the user-facing dollar reference).
    const basePlan = baseAnnualSpend > 0 ? plan : {
      ...plan,
      expenseStreams: [{
        id: '__amort_proxy__',
        description: 'Spending',
        whose: 'Household' as const,
        startAge: plan.personA.retirementAge,
        end: { mode: 'lastSurvivor' as const },
        survivorPct: 1,
        annualAmount: 1,
        inflationPct: { mode: 'cpi' as const },
      }],
    };
    const scaleBase = baseAnnualSpend > 0 ? baseAnnualSpend : 1;
    const scaleTo = (dollars: number) => scaleExpenses(basePlan, dollars / scaleBase);

    let bestFeasible: { dollars: number; inner: InnerEval } | null = null;
    const tryAtDollars = (dollars: number, label: string): InnerEval => {
      opts.onProgress?.(0, label);
      return innerOptimize(scaleTo(dollars), opts, evalCounter, undefined, bestFeasible?.inner.policy.windows);
    };

    // Amortization seed: screen 3 diverse constant seeds + existing customPolicy (any goal).
    // Taking the best of all screens ensures we always reach the highest-quality basin
    // available. Including customPolicy regardless of its goal means each run is
    // monotonically improving — the result can only stay the same or get better.
    opts.onProgress?.(0, `Testing ${fmtUSD(amortAbs)}/yr (amortization seed)…`);
    {
      const amortPlan = scaleTo(amortAbs);
      const retA = plan.personA.retirementAge;
      const ptA = householdPlanThroughAgeA(plan);
      const optConv = plan.conversion.optimize ?? true;
      const amortSeeds: BlendWindow[][] = [
        buildConstantSeed(retA, ptA, { tax: 1, trad: 0, roth: 0 }, optConv),
        buildConstantSeed(retA, ptA, { tax: 0, trad: 1, roth: 0 }, optConv),
        buildConstantSeed(retA, ptA, { tax: 0, trad: 0, roth: 1 }, optConv),
      ];
      if (plan.customPolicy?.windows?.length) amortSeeds.push(plan.customPolicy.windows);
      const screened = amortSeeds.map((seed) => innerOptimize(amortPlan, opts, evalCounter, undefined, seed, true));
      screened.sort((a, b) => (isBetter(a, b) ? -1 : isBetter(b, a) ? 1 : 0));
      const refined = screened.slice(0, 2).map((s) => innerOptimize(amortPlan, opts, evalCounter, undefined, s.policy.windows));
      const innerSeed = isBetter(refined[0], refined[1]) ? refined[0] : refined[1];
      if (!innerSeed.ranOut) bestFeasible = { dollars: amortAbs, inner: innerSeed };
    }

    let lo$: number, hi$: number;
    if (!bestFeasible) {
      // Seed is infeasible — search downward
      hi$ = amortAbs;
      lo$ = amortAbs * 0.5;
      const innerLow = tryAtDollars(lo$, `Testing ${fmtUSD(lo$)}/yr…`);
      if (!innerLow.ranOut) bestFeasible = { dollars: lo$, inner: innerLow };
      else lo$ = amortAbs * 0.25;
    } else {
      // Seed is feasible — expand upward to bracket the infeasible side
      lo$ = amortAbs;
      hi$ = amortAbs * 1.5;
      for (let probe = 0; probe < 4; probe++) {
        const innerHi = tryAtDollars(hi$, `Testing ${fmtUSD(hi$)}/yr…`);
        if (innerHi.ranOut) break;
        bestFeasible = { dollars: hi$, inner: innerHi };
        lo$ = hi$;
        hi$ = hi$ * 2;
      }
    }

    // Bisection inside [lo$, hi$]
    const STEPS = 14;
    for (let i = 0; i < STEPS; i++) {
      const d = (lo$ + hi$) / 2;
      opts.onProgress?.(i / STEPS, `Refining ${fmtUSD(d)}/yr…`);
      const inner = tryAtDollars(d, `Refining ${fmtUSD(d)}/yr…`);
      if (!inner.ranOut) { bestFeasible = { dollars: d, inner }; lo$ = d; }
      else hi$ = d;
    }
    opts.onProgress?.(1, 'Done');

    if (!bestFeasible) {
      const fallbackDollars = amortAbs * 0.5;
      const inner = innerOptimize(scaleTo(fallbackDollars), opts, evalCounter);
      return packageResult(inner, goal, evalCounter.n, {
        solvedSpendingMultiplier: baseAnnualSpend > 0 ? fallbackDollars / baseAnnualSpend : NaN,
        recommendedAnnualSpend: fallbackDollars,
        headline: 'Plan depletes even at 50% of estimated sustainable spending',
        headlineLabel: 'Max sustainable spending',
      });
    }
    const sustainable = bestFeasible.dollars;
    const solvedMultiplier = baseAnnualSpend > 0 ? sustainable / baseAnnualSpend : NaN;
    return packageResult(bestFeasible.inner, goal, evalCounter.n, {
      solvedSpendingMultiplier: solvedMultiplier,
      recommendedAnnualSpend: sustainable,
      headline: `${fmtUSD(sustainable)}/yr (today's $)`,
      headlineLabel: baseAnnualSpend > 0
        ? `Max sustainable spending — ${(solvedMultiplier * 100).toFixed(0)}% of current plan`
        : 'Max sustainable spending',
    });
  }

  if (goal === 'min-retirement-age') {
    // Walk personA's retirement age down until either:
    //   (a) the plan runs out of money, or
    //   (b) funding spending requires trad withdrawals before age 59 (10% penalty territory).
    // The earliest age where neither condition fires is returned.
    // Warm-start: each step seeds from the previous (older) age's feasible policy. The shared
    // years inherit a tested solution; the new younger year at the front defaults to taxable-first.
    const startAge = plan.personA.retirementAge;
    // Cross-goal seed: use customPolicy from a different goal as first-step fallback.
    const priorSeedMRA = plan.customPolicy?.goal !== 'min-retirement-age' ? plan.customPolicy?.windows : undefined;
    let bestFeasible: { age: number; inner: InnerEval } | null = null;
    // Floor: never suggest retiring before the person's current age.
    const currentAgeA = new Date().getFullYear() - parseInt(plan.personA.dob.slice(0, 4), 10);
    const minAge = Math.max(currentAgeA, 40);
    const TOTAL = Math.max(1, startAge - minAge + 1);
    let step = 0;
    let stopReason: 'ran-out' | 'early-trad' | 'floor' = 'floor';

    for (let age = startAge; age >= minAge; age--) {
      opts.onProgress?.(step / TOTAL, `Testing retirement at age ${age}…`);
      step++;
      const trialPlan = setRetirementAge(plan, age);
      const inner = innerOptimize(trialPlan, opts, evalCounter, undefined, bestFeasible?.inner.policy.windows ?? priorSeedMRA);
      if (inner.ranOut) {
        stopReason = 'ran-out';
        break;
      }
      // The unconstrained optimizer may elect traditional withdrawals before 59 for tax
      // efficiency even when taxable+Roth suffices — the projection doesn't model the 10%
      // penalty. When that happens, re-verify feasibility with pctTraditional locked to 0
      // for all pre-59 windows. If the constrained plan still survives, it's a viable age
      // (the user avoids the penalty by drawing from taxable/Roth first). Only break if
      // the constrained plan also runs out — meaning trad genuinely cannot be avoided.
      const needsEarlyTrad = inner.proj.rows.some(r => r.ageA < 59 && r.netSpend > 0 && r.wdTrd > 1);
      if (needsEarlyTrad) {
        const clampedPolicy: BlendPolicy = {
          ...inner.policy,
          windows: inner.policy.windows.map((w) =>
            w.fromAge < 59 ? { ...w, pctTraditional: 0, pctRoth: w.pctRoth + w.pctTraditional } : w
          ),
        };
        const clampedProj = runProjection(trialPlan, { policy: clampedPolicy });
        if (clampedProj.ranOut) {
          stopReason = 'early-trad';
          break;
        }
        bestFeasible = {
          age,
          inner: { policy: clampedPolicy, proj: clampedProj, score: REC_GOALS['max-end'].score(clampedProj), ranOut: false },
        };
      } else {
        bestFeasible = { age, inner };
      }
    }
    opts.onProgress?.(1, 'Done');
    if (!bestFeasible) {
      const inner = innerOptimize(plan, opts, evalCounter);
      return packageResult(inner, goal, evalCounter.n, {
        solvedRetirementAge: startAge,
        headline: `Age ${startAge} (current — earlier ages infeasible)`,
        headlineLabel: 'Earliest feasible retirement',
      });
    }
    const headlineLabel =
      stopReason === 'early-trad' ? 'Earliest retirement on penalty-free assets' :
      stopReason === 'floor'      ? `Earliest feasible retirement — age ${minAge} floor reached` :
                                    'Earliest feasible retirement';
    return packageResult(bestFeasible.inner, goal, evalCounter.n, {
      solvedRetirementAge: bestFeasible.age,
      headline: `Age ${bestFeasible.age}`,
      headlineLabel,
    });
  }

  throw new Error(`Unknown user goal: ${goal}`);
}


