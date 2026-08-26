/**
 * planMigrations.ts
 *
 * Standalone migration helpers called by both the Zustand store (on load)
 * and exportImport.ts (on import).  Each function mutates the raw persisted
 * object in-place — Zod parses the result afterward.
 */

/**
 * v23 → v24
 *
 * Person ages — "preserve both intents" rule:
 *   per person: planThroughAge = max(retirementAge, passingAge)   [mortality age]
 *   if the new household horizon < old household horizon,
 *     extend the longest-lived person's planThroughAge back to the old horizon.
 *   delete passingAge; delete planToAge.
 *
 * Old data had three variants that may need handling:
 *   - Pre-v24: planToAge (horizon) + passingAge (mortality). Both present.
 *   - Mid-v24: planThroughAge (horizon-meaning) + passingAge (mortality). planToAge absent.
 *     (Produced by the commit-1 migration which only renamed planToAge → planThroughAge.)
 *   - v24+: only planThroughAge (mortality). Neither planToAge nor passingAge present.
 *
 * Streams: stopAge → { mode: 'age', age: N }; survivorPct backfill.
 */
export function migratePlanToV24(raw: Record<string, unknown>): void {
  // ── helper: parse birth year from ISO date ──────────────────────────────
  const birthYear = (dob: unknown): number =>
    typeof dob === 'string' && dob.length >= 4 ? parseInt(dob.slice(0, 4), 10) : 1970;

  // ── step 1: determine old horizon (before deleting planToAge) ─────────
  const pA = raw.personA as Record<string, unknown> | undefined;
  const pB = raw.personB as Record<string, unknown> | undefined;
  const byA = birthYear(pA?.dob);
  const byB = birthYear(pB?.dob);

  // Old horizon: max planToAge across persons, in A's frame.
  // planToAge was the planning horizon; planThroughAge (from the commit-1 rename) carried the same meaning.
  const oldPlanToAgeA = typeof pA?.planToAge === 'number' ? pA.planToAge as number
    : typeof pA?.planThroughAge === 'number' && !('passingAge' in (pA ?? {})) ? null
    : typeof pA?.planThroughAge === 'number' ? pA.planThroughAge as number : null;
  const oldPlanToAgeB = typeof pB?.planToAge === 'number' ? pB.planToAge as number
    : typeof pB?.planThroughAge === 'number' && !('passingAge' in (pB ?? {})) ? null
    : typeof pB?.planThroughAge === 'number' ? pB.planThroughAge as number : null;

  const bEndInAOld = oldPlanToAgeB !== null ? oldPlanToAgeB + (byB - byA) : null;
  const oldHorizonA = Math.max(oldPlanToAgeA ?? 0, bEndInAOld ?? 0) || null;

  // ── step 2: set planThroughAge = mortality age per person ─────────────
  const setMortalityAge = (p: Record<string, unknown>) => {
    if (!('passingAge' in p)) return; // already v24 — nothing to do
    const retireAge = typeof p.retirementAge === 'number' ? p.retirementAge as number : 60;
    const passing = typeof p.passingAge === 'number' ? p.passingAge as number : retireAge;
    p.planThroughAge = Math.min(115, Math.max(60, retireAge, passing));
    delete p.passingAge;
    delete p.planToAge;
  };

  if (pA) setMortalityAge(pA);
  if (pB) setMortalityAge(pB);

  // ── step 3: restore horizon if it shrank ──────────────────────────────
  if (oldHorizonA !== null && pA && pB) {
    const newA = typeof pA.planThroughAge === 'number' ? pA.planThroughAge as number : 0;
    const newB = typeof pB.planThroughAge === 'number' ? pB.planThroughAge as number : 0;
    const bEndInANew = newB + (byB - byA);
    const newHorizonA = Math.max(newA, bEndInANew);
    if (newHorizonA < oldHorizonA) {
      const shortfall = oldHorizonA - newHorizonA;
      // Extend the longer-lived person
      if (newA >= bEndInANew) {
        pA.planThroughAge = Math.min(115, newA + shortfall);
      } else {
        pB.planThroughAge = Math.min(115, newB + shortfall);
      }
    }
  } else if (oldHorizonA !== null && pA && !pB) {
    const newA = typeof pA.planThroughAge === 'number' ? pA.planThroughAge as number : 0;
    if (newA < oldHorizonA) {
      pA.planThroughAge = Math.min(115, oldHorizonA);
    }
  }

  // ── step 4: income streams — stopAge → end, survivorPct ──────────────
  if (Array.isArray(raw.incomeStreams)) {
    for (const s of raw.incomeStreams as Record<string, unknown>[]) {
      if (typeof s.stopAge === 'number' && !('end' in s)) {
        s.end = { mode: 'age', age: s.stopAge };
        delete s.stopAge;
      }
      if (!('survivorPct' in s)) s.survivorPct = 0;
    }
  }

  // ── step 5: expense streams ───────────────────────────────────────────
  if (Array.isArray(raw.expenseStreams)) {
    for (const e of raw.expenseStreams as Record<string, unknown>[]) {
      if (typeof e.stopAge === 'number' && !('end' in e)) {
        e.end = { mode: 'age', age: e.stopAge };
        delete e.stopAge;
      }
      if (!('survivorPct' in e)) e.survivorPct = 1;
    }
  }
}
