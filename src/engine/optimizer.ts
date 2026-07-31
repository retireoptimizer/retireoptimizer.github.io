import type { Plan } from '../schemas/plan';
import type { BlendPolicy, BlendWindow } from './blendPolicy';
import { runProjection, type ProjectionResult } from './projection';
import { REC_GOALS, USER_GOALS, type RecGoal, type UserGoal } from './recommender';
import { nelderMead2D, nelderMead3D } from './nelderMead';
import { mulberry32, historicalBootstrap } from './returnModels';
import { FED_BRACKETS_MFJ } from './taxConstants';

const COARSE_STEPS = [0, 0.25, 0.5, 0.75, 1.0];
const FINE_STEPS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];
const CONV_COARSE = [0, 0.25, 0.5, 0.75, 1.0];
const CONV_FINE = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];

// 12% bracket top (today's $) — MFJ upper bound of the second bracket.
const BRACKET_12_TOP = FED_BRACKETS_MFJ[1][0];

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
  score: number;        // 'max-end' direction: higher endTotalReal is better
  ranOut: boolean;
}

/**
 * Inner optimizer. Scoring: max endTotalReal (inflation-adjusted), with ranOut
 * strictly worse than any non-depleting plan. Used as the per-evaluation goal
 * for all three user-facing outer goals.
 */
function innerOptimize(plan: Plan, opts: OptimizeOptions, evalCounter: { n: number }, outerProgress?: () => void): InnerEval {
  const innerGoalKey: RecGoal = 'max-end';
  const spec = REC_GOALS[innerGoalKey];
  const retireAge = plan.personA.retirementAge;
  const planToAge = plan.personA.planToAge;

  if (retireAge > planToAge) {
    throw new Error('Retirement age is after plan-to age.');
  }

  // Initial per-year windows: 100% taxable, no conversion.
  const startWindows: BlendWindow[] = [];
  for (let age = retireAge; age <= planToAge; age++) {
    startWindows.push({ fromAge: age, toAge: age, pctTaxable: 1, pctTraditional: 0, pctRoth: 0, convAmt: 0 });
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

  const isBetter = (a: InnerEval, b: InnerEval): boolean => {
    if (a.ranOut !== b.ranOut) return !a.ranOut;
    return a.score > b.score;
  };

  /** Sweep returns true if any year's decision improved during the sweep. */
  const sweep = (splits: Split[], convFractions: number[], direction: 'forward' | 'backward' = 'forward'): boolean => {
    let improvedAny = false;
    const total = bestWindows.length;
    const order = direction === 'forward'
      ? Array.from({ length: total }, (_, i) => i)
      : Array.from({ length: total }, (_, i) => total - 1 - i);
    for (const yi of order) {
      const baseW = bestWindows[yi];
      const cap = convCapAtYear(bestProj, yi);
      let cur: InnerEval = { policy: bestPolicy, proj: bestProj, score: bestScore, ranOut: bestProj.ranOut };

      for (const s of splits) {
        for (const cf of convFractions) {
          const newConv = cf * cap;
          if (Math.abs(s.tax - baseW.pctTaxable) < 1e-4 &&
              Math.abs(s.trad - baseW.pctTraditional) < 1e-4 &&
              Math.abs(newConv - (baseW.convAmt ?? 0)) < 0.5) continue;

          const trial = bestWindows.map((w, idx) =>
            idx === yi ? { ...w, pctTaxable: s.tax, pctTraditional: s.trad, pctRoth: s.roth, convAmt: newConv } : w
          );
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
  sweep(FINE_SPLITS, CONV_FINE, 'forward');

  // Thorough mode: alternate backward / forward refinement passes until no year improves.
  // Forward-greedy locks year N's decision before seeing year N+1..end; conversion in particular
  // has long forward dependencies (RMD reductions kick in 10+ years later) that benefit from this.
  // Capped at 3 extra passes; in practice converges in 1–2.
  if (opts.thorough) {
    for (let pass = 0; pass < 3; pass++) {
      const direction = pass % 2 === 0 ? 'backward' : 'forward';
      const improved = sweep(FINE_SPLITS, CONV_FINE, direction);
      if (!improved) break;
    }
  }

  // Smoothing pass: redistribute conversion $ between adjacent years to break
  // coordinate-descent local optima that produce spiky schedules (e.g., $0/$0/$372K/$0).
  // Accepts redistributions whose endBalance is within a tight tolerance — preserves
  // solution quality, removes visual bumpiness, and often finds strictly better solutions
  // because the tax cost of a smooth schedule is lower than a spiky one.
  {
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

      if (cap < 1) {
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
      const accept = mcPaths
        ? !candidate.ranOut
        : isBetter(candidate, { policy: bestPolicy, proj: bestProj, score: bestScore, ranOut: bestProj.ranOut });
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

/** Scale every expense stream's annualAmount by `s`. */
function scaleExpenses(plan: Plan, s: number): Plan {
  return {
    ...plan,
    expenseStreams: plan.expenseStreams.map((e) => ({ ...e, annualAmount: e.annualAmount * s })),
  };
}

/** Set retirement age for personA (and personB if present, capped at their original). */
function setRetirementAge(plan: Plan, ageA: number): Plan {
  const deltaA = ageA - plan.personA.retirementAge;
  return {
    ...plan,
    personA: { ...plan.personA, retirementAge: ageA },
    personB: plan.personB
      ? { ...plan.personB, retirementAge: Math.max(50, plan.personB.retirementAge + deltaA) }
      : plan.personB,
  };
}

function packageResult(
  inner: InnerEval,
  goal: UserGoal,
  evals: number,
  extras: { solvedSpendingMultiplier?: number; recommendedAnnualSpend?: number; solvedRetirementAge?: number; headline: string; headlineLabel: string },
): OptimizeResult {
  const spec = REC_GOALS['max-end'];
  return {
    policy: { ...inner.policy, windows: compact(inner.policy.windows), source: 'optimizer', goal },
    perYearPolicy: inner.policy,
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

export function optimizeStrategy(plan: Plan, goal: UserGoal, opts: OptimizeOptions = {}): OptimizeResult {
  const evalCounter = { n: 0 };

  if (goal === 'max-end-balance') {
    opts.onProgress?.(0, 'Optimizing withdrawals and conversions…');
    const inner = innerOptimize(plan, opts, evalCounter);
    opts.onProgress?.(1, 'Done');
    const endReal = inner.proj.endTotalReal;
    return packageResult(inner, goal, evalCounter.n, {
      headline: fmtM(endReal),
      headlineLabel: 'End balance (today\'s $)',
    });
  }

  if (goal === 'max-sustainable-spending') {
    // Bracket-then-bisect:
    //  1. Doubling search from s=1.0 to find a feasible/infeasible pair (avoids wasting bisection
    //     steps on impossibly-high multipliers when the true answer is near 1.0).
    //  2. Bisection inside the bracket to pin the boundary.
    let bestFeasible: { s: number; inner: InnerEval } | null = null;
    const tryAt = (s: number, label: string): InnerEval => {
      opts.onProgress?.(0, label);
      return innerOptimize(scaleExpenses(plan, s), opts, evalCounter);
    };

    // Probe s=1.0 first
    const innerOne = tryAt(1.0, 'Testing current spending plan…');
    if (!innerOne.ranOut) bestFeasible = { s: 1.0, inner: innerOne };

    let lo: number, hi: number;
    if (innerOne.ranOut) {
      // Current spending is infeasible — search downward by halving
      hi = 1.0;
      lo = 0.5;
      // Probe lo
      const innerLow = tryAt(lo, `Testing spending × ${lo.toFixed(2)}…`);
      if (!innerLow.ranOut) bestFeasible = { s: lo, inner: innerLow };
      else lo = 0.25; // extreme fallback
    } else {
      // Current spending is feasible — double upward to find infeasibility
      lo = 1.0;
      hi = 2.0;
      for (let probe = 0; probe < 4; probe++) {
        const innerHi = tryAt(hi, `Testing spending × ${hi.toFixed(2)}…`);
        if (innerHi.ranOut) break;
        bestFeasible = { s: hi, inner: innerHi };
        lo = hi;
        hi = hi * 2;
      }
    }

    // Bisection inside [lo, hi]
    const STEPS = 14;
    for (let i = 0; i < STEPS; i++) {
      const s = (lo + hi) / 2;
      opts.onProgress?.(i / STEPS, `Refining spending × ${s.toFixed(3)}…`);
      const inner = tryAt(s, `Refining spending × ${s.toFixed(3)}…`);
      if (!inner.ranOut) {
        bestFeasible = { s, inner };
        lo = s;
      } else {
        hi = s;
      }
    }
    opts.onProgress?.(1, 'Done');
    const baseAnnualSpend = plan.expenseStreams.reduce((sum, e) => sum + e.annualAmount, 0);
    if (!bestFeasible) {
      // Even at 0.5× the plan depletes — return that result with a warning.
      const inner = innerOptimize(scaleExpenses(plan, 0.5), opts, evalCounter);
      return packageResult(inner, goal, evalCounter.n, {
        solvedSpendingMultiplier: 0.5,
        recommendedAnnualSpend: baseAnnualSpend * 0.5,
        headline: 'Plan depletes even at 50% spending',
        headlineLabel: 'Max sustainable spending',
      });
    }
    const sustainable = baseAnnualSpend * bestFeasible.s;
    return packageResult(bestFeasible.inner, goal, evalCounter.n, {
      solvedSpendingMultiplier: bestFeasible.s,
      recommendedAnnualSpend: sustainable,
      headline: `${fmtUSD(sustainable)}/yr (today's $)`,
      headlineLabel: `Max sustainable spending — ${(bestFeasible.s * 100).toFixed(0)}% of current plan`,
    });
  }

  if (goal === 'min-retirement-age') {
    // Decrement search on personA.retirementAge, starting from current down to 55.
    const startAge = plan.personA.retirementAge;
    let bestFeasible: { age: number; inner: InnerEval } | null = null;
    const minAge = 55;
    const TOTAL = Math.max(1, startAge - minAge + 1);
    let step = 0;

    // Try current age first (must be feasible to anchor), then walk down.
    for (let age = startAge; age >= minAge; age--) {
      opts.onProgress?.(step / TOTAL, `Testing retirement at age ${age}…`);
      step++;
      const trialPlan = setRetirementAge(plan, age);
      const inner = innerOptimize(trialPlan, opts, evalCounter);
      if (!inner.ranOut) {
        bestFeasible = { age, inner };
      } else {
        // Once we hit infeasibility walking down, earlier ages will also be infeasible.
        break;
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
    return packageResult(bestFeasible.inner, goal, evalCounter.n, {
      solvedRetirementAge: bestFeasible.age,
      headline: `Age ${bestFeasible.age}`,
      headlineLabel: 'Earliest feasible retirement',
    });
  }

  throw new Error(`Unknown user goal: ${goal}`);
}


