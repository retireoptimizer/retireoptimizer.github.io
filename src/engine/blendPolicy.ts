/**
 * Level-2 blend policy: list of age windows, each with a 3-bucket split
 * (taxable / traditional / roth) that must sum to 100%. Optional Trad cap.
 * RMDs are always honored first by the withdrawal engine.
 */
export interface BlendWindow {
  fromAge: number;
  toAge: number;
  pctTaxable: number;       // 0..1
  pctTraditional: number;   // 0..1
  pctRoth: number;          // 0..1
  tradCap?: number;          // optional max $ from Trad in this window (today's $)
  convAmt?: number;          // optional Trad→Roth conversion each year in this window (today's $); engine inflates
}

export interface BlendPolicy {
  windows: BlendWindow[];
  source?: 'optimizer' | 'manual';
  goal?: string;
}

export type PresetKey = 'taxfirst' | 'rothfirst' | 'tradfirst' | 'proportional' | 'bracketfill';

/** Each preset is a single-window blend covering all ages. proportional/bracketfill
 *  are handled with special-case logic in withdrawal.ts (signaled by a sentinel). */
export const PRESETS: Record<PresetKey, { kind: 'ordered' | 'proportional' | 'bracketfill'; order?: ('tax' | 'trad' | 'roth')[]; label: string }> = {
  taxfirst:     { kind: 'ordered',      order: ['tax', 'trad', 'roth'], label: 'Taxable → Traditional → Roth' },
  rothfirst:    { kind: 'ordered',      order: ['roth', 'trad', 'tax'], label: 'Roth → Traditional → Taxable' },
  tradfirst:    { kind: 'ordered',      order: ['trad', 'tax', 'roth'], label: 'Traditional → Taxable → Roth' },
  proportional: { kind: 'proportional', label: 'Proportional (all buckets)' },
  bracketfill:  { kind: 'bracketfill',  label: 'Bracket-Fill (tax-aware blended)' },
};

export function findWindow(policy: BlendPolicy, age: number): BlendWindow | undefined {
  return policy.windows.find(w => age >= w.fromAge && age <= w.toAge);
}

export function validatePolicy(policy: BlendPolicy): string[] {
  const errors: string[] = [];
  for (const w of policy.windows) {
    const sum = w.pctTaxable + w.pctTraditional + w.pctRoth;
    if (Math.abs(sum - 1) > 0.001) {
      errors.push(`Window ${w.fromAge}-${w.toAge}: percentages sum to ${sum.toFixed(3)}, must be 1.0`);
    }
  }
  return errors;
}
