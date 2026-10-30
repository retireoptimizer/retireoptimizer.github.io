import { annualSSBenefit, benefitFactor } from './ssActuarial';
import { windowActiveAt, type ResolvedIncome } from './streamWindow';
import type { Plan } from '../schemas/plan';

/** Age (in the person's own frame) at which they start Social Security: the earliest
 *  start age of their SS income streams ('Household' streams count as A's). Falls back
 *  to ssClaimAge only when the person has no SS stream; the UI never edits ssClaimAge. */
export function ssStartAge(
  plan: Pick<Plan, 'personA' | 'personB' | 'incomeStreams'>,
  whose: 'A' | 'B',
): number | undefined {
  const person = whose === 'A' ? plan.personA : plan.personB;
  if (!person) return undefined;
  const starts = plan.incomeStreams
    .filter((s) => s.type === 'SS' && (s.whose === whose || (whose === 'A' && s.whose === 'Household')))
    .map((s) => s.startAge);
  return starts.length > 0 ? Math.min(...starts) : person.ssClaimAge;
}

interface SSInput {
  piaA: number;
  claimAgeA: number;
  ageA: number;
  aliveA: boolean;
  piaB?: number;
  claimAgeB?: number;
  ageB?: number;
  aliveB?: boolean;
  inflationFactor: number; // (1+infl)^yearIndex applied to nominal benefit (COLA proxy)
  inflation: number;      // plan baseline inflation, used to resolve SS stream growthPct
  // Optional per-person SS overrides from `incomeStreams` with type='SS'.
  // When present, these supersede the PIA × claim-age actuarial calculation for
  // that person/year, because the user has explicitly modeled their expected SS.
  // The stream's growthPct is the COLA assumption for that stream; it replaces
  // the projection-level inflationFactor for that stream's contribution.
  ssStreams?: ResolvedIncome[];
  yearIndex?: number; // plan year index (0-based), used to grow stream amounts
  // Death ages in A-frame — used to clamp the window check when looking up the
  // deceased person's stream benefit for the survivor-max comparison.
  planThroughAgeA?: number;
  planThroughAgeB?: number; // B's planThroughAge converted to A-frame by caller
  // Retirement-phase gates — mirrors the gate in sumIncomeStreams so SS streams
  // don't fire during accumulation phase (same rule: A-tagged on retiredA,
  // B-tagged on retiredB, Household on retiredA||retiredB).
  retiredA?: boolean;
  retiredB?: boolean;
}

interface SSOutput {
  ssA: number;
  ssB: number;
  total: number;
}

/** True if any SS stream is configured for this person (regardless of active window).
 *  When true we trust the stream exclusively — 0 before the window opens is intentional,
 *  not a signal to fall back to the PIA-based actuarial calculation. */
function hasSSStreamFor(resolved: ResolvedIncome[], whose: 'A' | 'B'): boolean {
  return resolved.some(({ s }) =>
    s.type === 'SS' && (s.whose === whose || (whose === 'A' && s.whose === 'Household')),
  );
}

/** Sum of all active SS-typed streams for one person at one age, grown by each
 *  stream's growthPct over yearIndex years.
 *
 *  clampAge: when provided (survivor case), the A-frame age is clamped to this value
 *  before the window check. This lets us look up the deceased person's stream amount
 *  after their planThroughAge without the window returning zero. yearIndex is NOT
 *  clamped so COLA continues compounding. */
function ssFromStreams(
  resolved: ResolvedIncome[],
  whose: 'A' | 'B',
  ageA: number,
  yearIndex: number,
  clampAge?: number,
  retiredA = true,
  retiredB = true,
): number {
  const effectiveAge = clampAge !== undefined ? Math.min(ageA, clampAge) : ageA;
  let total = 0;
  for (const { s, w, growthRate } of resolved) {
    if (s.type !== 'SS') continue;
    // 'Household' SS streams default to person A's age (legacy default-plan shape).
    const matchWhose = s.whose === whose || (whose === 'A' && s.whose === 'Household');
    if (!matchWhose) continue;
    // Gate by retirement phase — same rule as sumIncomeStreams.
    const eligible = s.whose === 'A' ? retiredA : s.whose === 'B' ? retiredB : (retiredA || retiredB);
    if (!eligible) continue;
    // Use A's-frame age (effectiveAge) for the window check — resolveWindow already
    // converted B-frame startAge/stopAge into A-frame when building the ResolvedWindow.
    if (!windowActiveAt(w, effectiveAge)) continue;
    total += s.annualAmount * Math.pow(1 + growthRate, yearIndex);
  }
  return total;
}

/** Earliest age a widow(er) can claim a survivor benefit (no dependent children). */
const SURVIVOR_MIN_AGE = 60;
/** Survivor benefit as a fraction of the deceased's benefit when claimed at 60. */
const SURVIVOR_FACTOR_AT_60 = 0.715;
const SURVIVOR_FRA = 67;

/** Survivor-benefit reduction for the survivor's own age at claim: 71.5% at 60,
 *  rising linearly to 100% at FRA. */
function survivorAgeFactor(claimAgeOwn: number): number {
  if (claimAgeOwn >= SURVIVOR_FRA) return 1;
  const t = (claimAgeOwn - SURVIVOR_MIN_AGE) / (SURVIVOR_FRA - SURVIVOR_MIN_AGE);
  return SURVIVOR_FACTOR_AT_60 + (1 - SURVIVOR_FACTOR_AT_60) * t;
}

/** Survivor benefit from the deceased's SS streams.
 *
 *  If any stream is active at the death age, the deceased had claimed: those streams
 *  pay their own amounts. Otherwise the deceased died before claiming: the earliest
 *  future stream(s) pay the PIA implied by the stream (amount / benefitFactor(claim age))
 *  plus the delayed credits earned through death, so dying before FRA gives the survivor
 *  100% of PIA. deltaOwn converts A-frame ages to the deceased's own ages. */
function survivorFromStreams(
  resolved: ResolvedIncome[],
  whose: 'A' | 'B',
  deathAgeA: number,
  yearIndex: number,
  deltaOwn: number,
): number {
  const own = resolved.filter(({ s }) =>
    s.type === 'SS' && (s.whose === whose || (whose === 'A' && s.whose === 'Household')));
  const grown = ({ s, growthRate }: ResolvedIncome) => s.annualAmount * Math.pow(1 + growthRate, yearIndex);

  const claimed = own.filter(({ w }) => windowActiveAt(w, deathAgeA));
  if (claimed.length > 0) return claimed.reduce((t, r) => t + grown(r), 0);

  const future = own.filter(({ w }) => w.startAge > deathAgeA);
  if (future.length === 0) return 0;
  const claimAgeA = Math.min(...future.map(({ w }) => w.startAge));
  const claimOwn = claimAgeA + deltaOwn;
  const creditedOwn = Math.min(deathAgeA + 1 + deltaOwn, claimOwn);
  const scale = Math.max(1, benefitFactor(creditedOwn)) / benefitFactor(claimOwn);
  return future
    .filter(({ w }) => w.startAge === claimAgeA)
    .reduce((t, r) => t + grown(r) * scale, 0);
}

/** Survivor's reduced benefit this year: zero before the survivor can claim, otherwise
 *  the deceased's benefit scaled by the survivor's age when the benefit started
 *  (the year after death, or 60 if the survivor was younger). */
function survivorShare(deceasedBenefit: number, deathAgeSurvivorOwn: number, survivorAgeOwn: number): number {
  const claimAge = Math.max(SURVIVOR_MIN_AGE, deathAgeSurvivorOwn + 1);
  if (survivorAgeOwn < claimAge) return 0;
  return deceasedBenefit * survivorAgeFactor(claimAge);
}

/**
 * Household SS for a given plan-year. Survivor rule: when one spouse dies,
 * the surviving spouse receives the larger of their own benefit and the survivor
 * benefit based on the deceased's record.
 */
export function householdSS(input: SSInput): SSOutput {
  const streams = input.ssStreams ?? [];
  const yi = input.yearIndex ?? 0;
  const rA = input.retiredA ?? true;
  const rB = input.retiredB ?? true;

  const hasSSStreamA = hasSSStreamFor(streams, 'A');
  const hasSSStreamB = hasSSStreamFor(streams, 'B');

  // ssFromStreams uses A-frame ageA for all window checks (resolveWindow converts B-frame→A-frame).
  const streamA = input.aliveA ? ssFromStreams(streams, 'A', input.ageA, yi, undefined, rA, rB) : 0;
  const benefitA = !input.aliveA
    ? 0
    : hasSSStreamA
      ? streamA
      : annualSSBenefit(input.piaA, input.claimAgeA, input.ageA) * input.inflationFactor;

  const hasB = input.piaB !== undefined && input.claimAgeB !== undefined && input.ageB !== undefined;
  const streamB = hasB && input.aliveB && input.ageB !== undefined
    ? ssFromStreams(streams, 'B', input.ageA, yi, undefined, rA, rB)
    : 0;
  const benefitB = !hasB || !input.aliveB
    ? 0
    : hasSSStreamB
      ? streamB
      : annualSSBenefit(input.piaB!, input.claimAgeB!, input.ageB!) * input.inflationFactor;

  // Both alive (or no B) — straightforward.
  if (input.aliveA && (input.aliveB || !hasB)) {
    return { ssA: benefitA, ssB: benefitB, total: benefitA + benefitB };
  }

  // Survivor keeps the larger of their own benefit and the survivor benefit. Stream
  // benefits are valued at the deceased's planThroughAge (see survivorFromStreams).
  if (hasB) {
    const deltaBA = input.ageB! - input.ageA; // B's own age = A-frame age + deltaBA
    if (input.aliveA && !input.aliveB) {
      const bAtDeath = !hasSSStreamB
        ? annualSSBenefit(input.piaB!, input.claimAgeB!, input.ageB!) * input.inflationFactor
        : input.planThroughAgeB === undefined
          ? ssFromStreams(streams, 'B', input.ageA, yi, undefined, true, true)
          : survivorShare(
            survivorFromStreams(streams, 'B', input.planThroughAgeB, yi, deltaBA),
            input.planThroughAgeB, input.ageA);
      const surv = Math.max(benefitA, bAtDeath);
      return { ssA: surv, ssB: 0, total: surv };
    }
    if (!input.aliveA && input.aliveB) {
      const aAtDeath = !hasSSStreamA
        ? annualSSBenefit(input.piaA, input.claimAgeA, input.ageA) * input.inflationFactor
        : input.planThroughAgeA === undefined
          ? ssFromStreams(streams, 'A', input.ageA, yi, undefined, true, true)
          : survivorShare(
            survivorFromStreams(streams, 'A', input.planThroughAgeA, yi, 0),
            input.planThroughAgeA + deltaBA, input.ageB!);
      const surv = Math.max(benefitB, aAtDeath);
      return { ssA: 0, ssB: surv, total: surv };
    }
  }

  return { ssA: 0, ssB: 0, total: 0 };
}
