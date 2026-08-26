/**
 * streamWindow.ts
 *
 * Resolves income/expense stream windows from the new EndRule discriminated union
 * into concrete start/stop ages, and computes the per-year stream factor
 * (1 = full, survivorPct = reduced after owner death, 0 = inactive).
 *
 * This module replaces the old inline `personAge < s.startAge || personAge > s.stopAge` guards
 * that were scattered through projection.ts and socialSecurity.ts.
 */

import type { IncomeStream, ExpenseStream } from '../schemas/plan';
import type { Plan } from '../schemas/plan';
import { resolveGrowthRate } from '../schemas/plan';

// ---------------------------------------------------------------------------
// AgeFrame
// ---------------------------------------------------------------------------

/**
 * Age-frame anchored to Person A's age as the primary axis.
 * All ages below are expressed in Person A's frame.
 */
export interface AgeFrame {
  /** Person A's age at plan start (year index 0). */
  startAgeA: number;
  /** Person B's age at plan start, or undefined if no Person B. */
  startAgeB: number | undefined;
  /**
   * deltaBA = startAgeB - startAgeA.
   * Positive if B is younger than A, negative if B is older.
   * To convert a B-frame age to A-frame: ageA = ageB - deltaBA
   * To convert an A-frame age to B-frame: ageB = ageA + deltaBA
   */
  deltaBA: number | undefined;
  /** Person A's own planThroughAge. */
  planThroughA: number;
  /** Person B's planThroughAge expressed in A-frame, or undefined. */
  planThroughB: number | undefined;
  /**
   * The projection horizon in A's frame:
   *   max(planThroughA, planThroughB-in-A-frame)
   * This is the last year index of the simulation.
   */
  horizonA: number;
}

export function householdAgeFrame(plan: Plan): AgeFrame {
  const birthYearA = parseInt(plan.personA.dob.slice(0, 4), 10);
  const startYear = new Date().getFullYear();
  const startAgeA = startYear - birthYearA;
  const planThroughA = plan.personA.planThroughAge;

  if (!plan.personB) {
    return { startAgeA, startAgeB: undefined, deltaBA: undefined, planThroughA, planThroughB: undefined, horizonA: planThroughA };
  }

  const birthYearB = parseInt(plan.personB.dob.slice(0, 4), 10);
  const startAgeB = startYear - birthYearB;
  const deltaBA = startAgeB - startAgeA;
  // B's planThroughAge in A-frame: B's own age → A's frame age
  // A-frame age = B-frame age - deltaBA
  const planThroughBInAFrame = plan.personB.planThroughAge - deltaBA;
  const horizonA = Math.max(planThroughA, planThroughBInAFrame);

  return {
    startAgeA,
    startAgeB,
    deltaBA,
    planThroughA,
    planThroughB: planThroughBInAFrame,
    horizonA,
  };
}

/**
 * Returns the projection horizon expressed in Person A's age frame.
 * Drop-in replacement for the old `householdPlanToAgeA`.
 */
export function householdPlanThroughAgeA(plan: Plan): number {
  return householdAgeFrame(plan).horizonA;
}

// ---------------------------------------------------------------------------
// ResolvedWindow
// ---------------------------------------------------------------------------

/**
 * A stream window after all EndRule modes have been resolved to concrete ages
 * in the owner's frame (Person A's age frame for Household/A streams,
 * or converted to A's frame for B streams).
 */
export interface ResolvedWindow {
  startAge: number;
  /** Inclusive stop age in Person A's frame. */
  stopAge: number;
  /** 'A' | 'B' | null (Household). Determines which person's alive flag governs. */
  owner: 'A' | 'B' | null;
  /**
   * Fraction of the stream that survives after the owner's death
   * (0 = stops on owner death; 1 = continues at full rate).
   */
  survivorPct: number;
  /**
   * Which person's age is used for the active-window check.
   * For Household streams this is 'A' (we use A's age as the primary axis).
   */
  ageOf: 'A' | 'B';
}

/**
 * Resolve an IncomeStream or ExpenseStream's EndRule into a concrete window.
 *
 * @param s          The raw stream
 * @param frame      The household age frame
 */
export function resolveWindow(
  s: Pick<IncomeStream | ExpenseStream, 'whose' | 'startAge' | 'end' | 'survivorPct'>,
  frame: AgeFrame,
): ResolvedWindow {
  const owner: 'A' | 'B' | null = s.whose === 'A' ? 'A' : s.whose === 'B' ? 'B' : null;
  const ageOf: 'A' | 'B' = s.whose === 'B' ? 'B' : 'A';

  // Express startAge in A's frame. For B-tagged streams, startAge is in B's frame.
  const startAgeInAFrame =
    s.whose === 'B' && frame.deltaBA !== undefined ? s.startAge - frame.deltaBA : s.startAge;

  // planThroughAge in A's frame for the owning person (or horizon for Household)
  const planThroughInAFrame =
    s.whose === 'B' && frame.planThroughB !== undefined
      ? frame.planThroughB
      : frame.planThroughA;

  const horizonInAFrame = frame.horizonA;

  let stopAgeInAFrame: number;
  const end = s.end;

  switch (end.mode) {
    case 'life':
      stopAgeInAFrame = planThroughInAFrame;
      break;
    case 'lastSurvivor':
      stopAgeInAFrame = horizonInAFrame;
      break;
    case 'age': {
      // age is in the owner's frame (A-frame for Household/A, B-frame for B)
      const rawStop = end.age;
      stopAgeInAFrame =
        s.whose === 'B' && frame.deltaBA !== undefined ? rawStop - frame.deltaBA : rawStop;
      break;
    }
    case 'years':
      // period-certain: startAge + n - 1 (in owner's frame)
      stopAgeInAFrame = startAgeInAFrame + end.n - 1;
      break;
  }

  return {
    startAge: startAgeInAFrame,
    stopAge: stopAgeInAFrame,
    owner,
    survivorPct: s.survivorPct,
    ageOf,
  };
}

// ---------------------------------------------------------------------------
// windowActiveAt
// ---------------------------------------------------------------------------

/**
 * Returns true if the age window is active at `ageInAFrame`.
 * (Does NOT check alive flags — the caller handles that via streamFactor.)
 */
export function windowActiveAt(w: ResolvedWindow, ageInAFrame: number): boolean {
  const checkAge = w.ageOf === 'B' ? ageInAFrame : ageInAFrame;
  return checkAge >= w.startAge && checkAge <= w.stopAge;
}

// ---------------------------------------------------------------------------
// streamFactor
// ---------------------------------------------------------------------------

/**
 * Per-year stream factor: how much of the stream applies this year.
 *
 * **Phase 1 (this commit):** Window-only check.
 * A stream is active (factor = 1) whenever the age window is open, regardless of
 * alive status. This preserves the behaviour of the pre-EndRule engine where streams
 * ran for their full `[startAge, stopAge]` range unconditionally.
 *
 * **Phase 2 (Commit 2):** The `aliveA`/`aliveB` parameters and `w.survivorPct` will
 * activate the survivor-benefit logic below once the projection's alive gates are
 * updated to use the new semantic:
 *
 *   if (w.owner === null) return aliveA || aliveB ? 1 : 0;
 *   if (w.owner === 'A') { if (aliveA) return 1; if (aliveB) return w.survivorPct; return 0; }
 *   // owner === 'B': if (aliveB) return 1; if (aliveA) return w.survivorPct; return 0;
 *
 * @param w        Resolved window
 * @param ageA     Person A's age this year (primary axis)
 * @param _ageB    Person B's age this year — unused until Phase 2
 * @param _aliveA  Whether Person A is alive — unused until Phase 2
 * @param _aliveB  Whether Person B is alive — unused until Phase 2
 */
export function streamFactor(
  w: ResolvedWindow,
  ageA: number,
  _ageB: number | undefined,
  _aliveA: boolean,
  _aliveB: boolean,
): number {
  return windowActiveAt(w, ageA) ? 1 : 0;
}

// ---------------------------------------------------------------------------
// ResolvedIncome / ResolvedExpense
// ---------------------------------------------------------------------------

export interface ResolvedIncome {
  s: IncomeStream;
  w: ResolvedWindow;
  /** Resolved annual growth rate (decimal). */
  growthRate: number;
}

export interface ResolvedExpense {
  e: ExpenseStream;
  w: ResolvedWindow;
  /** Resolved annual growth rate (decimal). */
  growthRate: number;
  /** True when inflationPct is mode:'cpi' (enables fast-path CPI compounding). */
  cpiMode: boolean;
}

export function resolveIncomeStreams(
  streams: IncomeStream[],
  frame: AgeFrame,
  inflation: number,
): ResolvedIncome[] {
  return streams.map((s) => ({
    s,
    w: resolveWindow(s, frame),
    growthRate: resolveGrowthRate(s.growthPct, inflation),
  }));
}

export function resolveExpenseStreams(
  streams: ExpenseStream[],
  frame: AgeFrame,
  inflation: number,
): ResolvedExpense[] {
  return streams.map((e) => ({
    e,
    w: resolveWindow(e, frame),
    growthRate: resolveGrowthRate(e.inflationPct, inflation),
    cpiMode: e.inflationPct.mode === 'cpi',
  }));
}
