import type { Plan } from '../schemas/plan';
import { PlanSchema } from '../schemas/plan';
import { migratePlanToV24, migratePlanToV25 } from '../store/planMigrations';

export interface ExportPayload {
  app: 'retirement-optimizer';
  version: 1;
  exportedAt: string;
  plan: Plan;
}

export function exportPlanToJSON(plan: Plan): string {
  const payload: ExportPayload = {
    app: 'retirement-optimizer',
    version: 1,
    exportedAt: new Date().toISOString(),
    plan,
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadPlan(plan: Plan, filename = 'retirement-optimizer-plan.json'): void {
  const json = exportPlanToJSON(plan);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ImportResult {
  ok: boolean;
  plan?: Plan;
  error?: string;
}

export function importPlanFromJSON(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  // Support both wrapped (with metadata) and raw plan shapes
  const candidate = (parsed as { plan?: unknown }).plan ?? parsed;
  // Run all migrations before Zod parsing (safe to apply to any version — each is idempotent).
  if (candidate && typeof candidate === 'object') {
    migratePlanToV24(candidate as Record<string, unknown>);
    migratePlanToV25(candidate as Record<string, unknown>);
  }
  const result = PlanSchema.safeParse(candidate);
  if (!result.success) {
    return { ok: false, error: result.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
  }
  return { ok: true, plan: result.data };
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsText(file);
  });
}
