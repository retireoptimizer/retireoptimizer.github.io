import { describe, it, expect } from 'vitest';
import { runAndCompare } from './harness';
import {
  planA_simple, planB_largeTradSingle, planC_bracketFillConv,
  planD_singleFIRE, planE_allRothCouple, planF_allTradCouple,
  planG_californiaCouple, planH_survivorMidPlan,
  planI_multiStreamIncome, planJ_personBZeroBalance,
} from './plans';

/**
 * Golden snapshot tests — capture the engine's current per-year output for the reference plans,
 * stored as CSV in this folder. Future changes that drift the output by >$2 in any column flag here.
 * Each plan also runs Layer 1's projection invariants via the harness.
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

  it('Plan D — Single FIRE, retire at 45, taxable bridge to SS at 70', () => {
    const r = runAndCompare('planD_singleFIRE', planD_singleFIRE());
    expect(r.ok, r.message).toBe(true);
  });

  it('Plan E — All-Roth couple, no RMD, rothfirst', () => {
    const r = runAndCompare('planE_allRothCouple', planE_allRothCouple());
    expect(r.ok, r.message).toBe(true);
  });

  it('Plan F — All-Trad couple, severe RMD, bracket-fill conversions', () => {
    const r = runAndCompare('planF_allTradCouple', planF_allTradCouple());
    expect(r.ok, r.message).toBe(true);
  });

  it('Plan G — California couple, state taxes retirement + conversions', () => {
    const r = runAndCompare('planG_californiaCouple', planG_californiaCouple());
    expect(r.ok, r.message).toBe(true);
  });

  it('Plan H — Survivor mid-plan, personB dies at 75 (MFJ→Single)', () => {
    const r = runAndCompare('planH_survivorMidPlan', planH_survivorMidPlan());
    expect(r.ok, r.message).toBe(true);
  });

  it('Plan I — Multi-stream income (SS + pension + rental)', () => {
    const r = runAndCompare('planI_multiStreamIncome', planI_multiStreamIncome());
    expect(r.ok, r.message).toBe(true);
  });

  it('Plan J — Person B with zero balances (real-world user shape)', () => {
    const r = runAndCompare('planJ_personBZeroBalance', planJ_personBZeroBalance());
    expect(r.ok, r.message).toBe(true);
  });
});
