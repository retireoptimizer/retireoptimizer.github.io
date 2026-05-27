import { describe, it, expect } from 'vitest';
import { runAndCompare } from './harness';
import { planA_simple, planB_largeTradSingle, planC_bracketFillConv } from './plans';

/**
 * Golden snapshot tests — capture the engine's current per-year output for 3 reference plans,
 * stored as CSV in this folder. Future changes that drift the output by >$2 in any column flag here.
 *
 * To regenerate intentionally: `UPDATE_GOLDENS=1 pnpm vitest run __golden`.
 *
 * NOTE: When real Excel-validated CSVs are available, replace the .csv files in this folder
 * to convert these from regression checks into Excel-parity checks.
 */
describe('Golden projection snapshots', () => {
  it('Plan A — Simple couple, taxfirst, IL', () => {
    const r = runAndCompare('planA_simple', planA_simple());
    expect(r.ok, r.message).toBe(true);
  });

  it('Plan B — Single, large Trad, RMDs dominate', () => {
    const r = runAndCompare('planB_largeTradSingle', planB_largeTradSingle());
    expect(r.ok, r.message).toBe(true);
  });

  it('Plan C — Couple, bracket-fill conversions through age 73', () => {
    const r = runAndCompare('planC_bracketFillConv', planC_bracketFillConv());
    expect(r.ok, r.message).toBe(true);
  });
});
