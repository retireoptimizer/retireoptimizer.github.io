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
 * - Renames `planToAge` → `planThroughAge` on personA and personB.
 * - Replaces `stopAge: number` → `end: { mode: 'age', age: N }` on every
 *   income and expense stream, and adds `survivorPct`.
 *   Income streams get `survivorPct: 0`; expense streams get `survivorPct: 1`.
 */
export function migratePlanToV24(raw: Record<string, unknown>): void {
  // --- persons ---
  const migratePersonThroughAge = (person: Record<string, unknown>) => {
    if ('planToAge' in person && !('planThroughAge' in person)) {
      person.planThroughAge = person.planToAge;
      delete person.planToAge;
    }
  };

  if (raw.personA && typeof raw.personA === 'object') {
    migratePersonThroughAge(raw.personA as Record<string, unknown>);
  }
  if (raw.personB && typeof raw.personB === 'object') {
    migratePersonThroughAge(raw.personB as Record<string, unknown>);
  }

  // --- income streams ---
  if (Array.isArray(raw.incomeStreams)) {
    for (const s of raw.incomeStreams as Record<string, unknown>[]) {
      if (typeof s.stopAge === 'number' && !('end' in s)) {
        s.end = { mode: 'age', age: s.stopAge };
        delete s.stopAge;
      }
      if (!('survivorPct' in s)) {
        s.survivorPct = 0;
      }
    }
  }

  // --- expense streams ---
  if (Array.isArray(raw.expenseStreams)) {
    for (const e of raw.expenseStreams as Record<string, unknown>[]) {
      if (typeof e.stopAge === 'number' && !('end' in e)) {
        e.end = { mode: 'age', age: e.stopAge };
        delete e.stopAge;
      }
      if (!('survivorPct' in e)) {
        e.survivorPct = 1;
      }
    }
  }
}
