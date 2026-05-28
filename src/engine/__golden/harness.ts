import type { Plan } from '../../schemas/plan';
import { runProjection, type ProjectionRow } from '../projection';
import { assertProjectionInvariants } from '../__invariants__/assertions';
import fs from 'node:fs';
import path from 'node:path';

export interface GoldenRow {
  age: number;
  netSpend: number;
  totalWD: number;
  fedTax: number;
  rmd: number;
  rothConv: number;
  endTaxable: number;
  endTraditional: number;
  endRoth: number;
  endTotal: number;
}

export function projectionToGolden(rows: ProjectionRow[]): GoldenRow[] {
  return rows.map((r) => ({
    age: r.ageA,
    netSpend: Math.round(r.netSpend),
    totalWD: Math.round(r.totalWD),
    fedTax: Math.round(r.fedTax),
    rmd: Math.round(r.rmd),
    rothConv: Math.round(r.rothConv),
    endTaxable: Math.round(r.endTaxable),
    endTraditional: Math.round(r.endTraditional),
    endRoth: Math.round(r.endRoth),
    endTotal: Math.round(r.endTotal),
  }));
}

export function rowsToCSV(rows: GoldenRow[]): string {
  const header = 'age,netSpend,totalWD,fedTax,rmd,rothConv,endTaxable,endTraditional,endRoth,endTotal\n';
  const body = rows.map((r) =>
    [r.age, r.netSpend, r.totalWD, r.fedTax, r.rmd, r.rothConv, r.endTaxable, r.endTraditional, r.endRoth, r.endTotal].join(',')
  ).join('\n');
  return header + body + '\n';
}

export function csvToRows(csv: string): GoldenRow[] {
  const lines = csv.trim().split('\n');
  return lines.slice(1).map((line) => {
    const [age, netSpend, totalWD, fedTax, rmd, rothConv, endTaxable, endTraditional, endRoth, endTotal] = line.split(',').map(Number);
    return { age, netSpend, totalWD, fedTax, rmd, rothConv, endTaxable, endTraditional, endRoth, endTotal };
  });
}

/** Compare two GoldenRow arrays. Returns first mismatch description or null if equal within tolerance. */
export function diffGolden(actual: GoldenRow[], expected: GoldenRow[], tolerance = 2): string | null {
  if (actual.length !== expected.length) return `Length mismatch: actual ${actual.length} vs expected ${expected.length}`;
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i], e = expected[i];
    const cols: (keyof GoldenRow)[] = ['age', 'netSpend', 'totalWD', 'fedTax', 'rmd', 'rothConv', 'endTaxable', 'endTraditional', 'endRoth', 'endTotal'];
    for (const c of cols) {
      if (Math.abs(a[c] - e[c]) > tolerance) {
        return `Row ${i} (age ${a.age}): ${c}=${a[c]} but expected ${e[c]} (Δ=${a[c] - e[c]})`;
      }
    }
  }
  return null;
}

const goldenDir = path.dirname(new URL(import.meta.url).pathname);

export function loadGolden(name: string): GoldenRow[] | null {
  const file = path.join(goldenDir, `${name}.csv`);
  if (!fs.existsSync(file)) return null;
  return csvToRows(fs.readFileSync(file, 'utf8'));
}

export function saveGolden(name: string, rows: GoldenRow[]): void {
  const file = path.join(goldenDir, `${name}.csv`);
  fs.writeFileSync(file, rowsToCSV(rows));
}

export function runAndCompare(name: string, plan: Plan, opts: { regenerate?: boolean; tolerance?: number } = {}): { ok: boolean; message?: string } {
  const proj = runProjection(plan);

  // Invariants run before CSV comparison so a math violation surfaces with its own pointed
  // error message instead of being summarized as a generic "value drift" diff.
  try {
    assertProjectionInvariants(proj, plan);
  } catch (e) {
    return { ok: false, message: `Invariant violation in ${name}: ${(e as Error).message}` };
  }

  const actual = projectionToGolden(proj.rows);

  if (opts.regenerate || process.env.UPDATE_GOLDENS === '1') {
    saveGolden(name, actual);
    return { ok: true, message: `(regenerated ${name}.csv)` };
  }

  const expected = loadGolden(name);
  if (!expected) {
    saveGolden(name, actual);
    return { ok: true, message: `(created baseline ${name}.csv)` };
  }
  const diff = diffGolden(actual, expected, opts.tolerance ?? 2);
  return diff ? { ok: false, message: diff } : { ok: true };
}
