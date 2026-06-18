import type { Plan } from '../../schemas/plan';
import type { ProjectionRow, ProjectionResult } from '../projection';
import { runProjection } from '../projection';

/**
 * Per-row dollar-flow invariants. Each row's bucket motion is independently checked
 * so a violation points at the exact year + bucket where the math diverged.
 *
 * Returns a list of human-readable violations (empty if the row is clean).
 */
function checkRow(r: ProjectionRow, plan: Plan, tol: number, opts: { skipSpendingCoverage?: boolean } = {}): string[] {
  const out: string[] = [];

  // Derive retirement flags the same way projection.ts does.
  // Single-person: retiredB mirrors retiredA (no second earner) — matches projection.ts.
  const retiredA = r.ageA >= plan.personA.retirementAge;
  const retiredB = r.ageB !== undefined && plan.personB
    ? r.ageB >= plan.personB.retirementAge
    : retiredA;
  const semiRetired = retiredA || retiredB;
  const retired = retiredA && retiredB;
  const gRate = retired ? plan.assumptions.postRetReturn : plan.assumptions.preRetReturn;

  // Derive contributions per bucket from the plan's contribSplit and the row's contribA/contribB.
  const pfA = plan.portfolio.personA;
  const pfB = plan.portfolio.personB;
  const contribToTax = r.contribA * pfA.contribSplit.taxable + r.contribB * (pfB?.contribSplit.taxable ?? 0);
  const contribToTrad = r.contribA * pfA.contribSplit.traditional + r.contribB * (pfB?.contribSplit.traditional ?? 0);
  const contribToRoth = r.contribA * pfA.contribSplit.roth + r.contribB * (pfB?.contribSplit.roth ?? 0);

  // 1. NO-OVERDRAW: total outflow per bucket must not exceed what's available (growth + contrib).
  //    Catches phantom withdrawals — bucket-A drained while withdrawal still claimed cash.
  const tradAvail = r.begTraditional * (1 + gRate) + contribToTrad;
  const tradOutflow = r.wdTrd + r.rmd + r.rothConv;
  if (tradOutflow > tradAvail + tol) {
    out.push(`Trad OVERDRAW: outflow $${tradOutflow.toFixed(2)} > available $${tradAvail.toFixed(2)} (wdTrd=${r.wdTrd.toFixed(2)} + rmd=${r.rmd.toFixed(2)} + conv=${r.rothConv.toFixed(2)} vs begTrad*(1+g)+contribTrad)`);
  }
  const rothAvail = r.begRoth * (1 + gRate) + contribToRoth + r.rothConv;
  if (r.wdRth > rothAvail + tol) {
    out.push(`Roth OVERDRAW: wdRth $${r.wdRth.toFixed(2)} > available $${rothAvail.toFixed(2)}`);
  }
  const taxAvail = r.begTaxable * (1 + gRate) + contribToTax;
  if (r.wdTax > taxAvail + tol) {
    out.push(`Taxable OVERDRAW: wdTax $${r.wdTax.toFixed(2)} > available $${taxAvail.toFixed(2)}`);
  }

  // 2. MASS BALANCE: end-of-year balance must match the bucket-update arithmetic
  //    when no clamping occurred. Pinpoints both subtle update bugs and validates
  //    that the conversion symmetry (trad - conv = -delta, roth + conv = +delta) holds.
  const expectedEndTrad = Math.max(0, r.begTraditional * (1 + gRate) + contribToTrad - r.wdTrd - r.rmd - r.rothConv);
  if (Math.abs(r.endTraditional - expectedEndTrad) > tol) {
    out.push(`Trad MASS BALANCE: endTraditional $${r.endTraditional.toFixed(2)} != expected $${expectedEndTrad.toFixed(2)} (delta $${(r.endTraditional - expectedEndTrad).toFixed(2)})`);
  }
  const expectedEndRoth = Math.max(0, r.begRoth * (1 + gRate) + contribToRoth - r.wdRth + r.rothConv);
  if (Math.abs(r.endRoth - expectedEndRoth) > tol) {
    out.push(`Roth MASS BALANCE: endRoth $${r.endRoth.toFixed(2)} != expected $${expectedEndRoth.toFixed(2)}`);
  }
  const expectedEndTax = Math.max(0, r.begTaxable * (1 + gRate) + contribToTax - r.wdTax);
  if (Math.abs(r.endTaxable - expectedEndTax) > tol) {
    out.push(`Taxable MASS BALANCE: endTaxable $${r.endTaxable.toFixed(2)} != expected $${expectedEndTax.toFixed(2)}`);
  }

  // 3. endTotal consistency
  const expectedEndTotal = r.endTaxable + r.endTraditional + r.endRoth;
  if (Math.abs(r.endTotal - expectedEndTotal) > tol) {
    out.push(`endTotal MISMATCH: $${r.endTotal.toFixed(2)} != sum-of-buckets $${expectedEndTotal.toFixed(2)}`);
  }

  // 4. TAX SANITY
  if (r.fedTax < -tol) out.push(`fedTax negative: ${r.fedTax}`);
  if (r.stateTaxAmt < -tol) out.push(`stateTax negative: ${r.stateTaxAmt}`);
  if (r.irmaa < -tol) out.push(`irmaa negative: ${r.irmaa}`);
  if (r.effRate < -0.001 || r.effRate > 0.50) out.push(`effRate out of range: ${r.effRate}`);

  // 5. WITHDRAWAL / RMD non-negativity
  if (r.wdTax < -tol) out.push(`wdTax negative: ${r.wdTax}`);
  if (r.wdTrd < -tol) out.push(`wdTrd negative: ${r.wdTrd}`);
  if (r.wdRth < -tol) out.push(`wdRth negative: ${r.wdRth}`);
  if (r.rmd < -tol) out.push(`rmd negative: ${r.rmd}`);
  if (r.rothConv < -tol) out.push(`rothConv negative: ${r.rothConv}`);

  // 6. RMD must be 0 before rmdStartAge
  if (r.ageA < plan.assumptions.rmdStartAge && r.rmd > tol) {
    out.push(`RMD before rmdStartAge (${plan.assumptions.rmdStartAge}): ageA=${r.ageA}, rmd=${r.rmd}`);
  }

  // 7. SPENDING COVERAGE (when either person is retired and portfolio not depleted).
  //    In SemiRetire, working person's contributions offset expense draws, so the coverage
  //    check still holds. Allow 5% slack for gross-up convergence drift.
  if (semiRetired && r.endTotal > 1 && !opts.skipSpendingCoverage) {
    const cashIn = r.wdTax + r.wdTrd + r.wdRth + r.totalSS + r.otherIncome + r.rmd;
    const cashOut = r.netSpend + r.fedTax + r.stateTaxAmt + r.irmaa;
    // 5% slack: pathological first-retirement-year scenarios (high marginal-bracket
    // crossings combined with low starting balance) can have gross-up convergence
    // drift up to a few percent of cashOut. A missing tax category (e.g., forgetting
    // state tax in CA) would be >5%, so this slack still catches that class. Disable
    // via opts.skipSpendingCoverage in fuzz mode where pathological cases are common.
    const coverageSlack = Math.max(500, cashOut * 0.05);
    if (cashIn + coverageSlack < cashOut) {
      out.push(`SPENDING NOT COVERED: cash-in $${cashIn.toFixed(2)} < cash-out $${cashOut.toFixed(2)} (gap $${(cashOut - cashIn).toFixed(2)})`);
    }
  }

  // 8. Accum.-phase guard: when neither person is retired, no spend/withdrawals/conversions.
  //    SemiRetire (one retired) legitimately has netSpend, so gate on semiRetired.
  if (!semiRetired && (r.netSpend > tol || r.totalWD > tol || r.rothConv > tol)) {
    out.push(`Pre-retirement year has withdrawals/spend/conv: netSpend=${r.netSpend}, totalWD=${r.totalWD}, conv=${r.rothConv}`);
  }

  // 9. MAGI / IRMAA threshold sanity. IRMAA must be zero when nobody is 65+.
  const ageBOver65 = r.ageB !== undefined && r.ageB >= 65;
  const ageAOver65 = r.ageA >= 65;
  if (!ageAOver65 && !ageBOver65 && r.irmaa > tol) {
    out.push(`IRMAA nonzero when nobody is 65+: ageA=${r.ageA}, ageB=${r.ageB}, irmaa=${r.irmaa}`);
  }

  return out;
}

/**
 * Top-level invariant check for a finished projection. Throws on first failing row
 * with a message that names the bucket/value and the year — so a single failure
 * is enough to root-cause.
 *
 * Note: assumes default returns (no returnOverrides). Caller in Monte Carlo paths
 * should validate per-row with caller-supplied gRates instead.
 */
export function assertProjectionInvariants(
  proj: ProjectionResult,
  plan: Plan,
  opts?: { tolerance?: number; skipSpendingCoverage?: boolean },
): void {
  const tol = opts?.tolerance ?? 1;
  if (proj.rows.length === 0) throw new Error('Projection produced zero rows');

  // Per-row checks.
  for (const r of proj.rows) {
    const violations = checkRow(r, plan, tol, { skipSpendingCoverage: opts?.skipSpendingCoverage });
    if (violations.length > 0) {
      throw new Error(
        `Projection invariant(s) failed at year ${r.year} (ageA=${r.ageA}${r.ageB !== undefined ? `, ageB=${r.ageB}` : ''}, phase=${r.phase}):\n` +
        violations.map((v) => `  • ${v}`).join('\n')
      );
    }
  }

  // Cross-row: ages monotonic.
  for (let i = 1; i < proj.rows.length; i++) {
    if (proj.rows[i].ageA !== proj.rows[i - 1].ageA + 1) {
      throw new Error(`ageA not monotonic at row ${i}: ${proj.rows[i - 1].ageA} → ${proj.rows[i].ageA}`);
    }
    if (proj.rows[i].ageB !== undefined && proj.rows[i - 1].ageB !== undefined) {
      if (proj.rows[i].ageB !== proj.rows[i - 1].ageB! + 1) {
        throw new Error(`ageB not monotonic at row ${i}: ${proj.rows[i - 1].ageB} → ${proj.rows[i].ageB}`);
      }
    }
  }

  // Cross-row: lifetimeFedTax = sum of fedTax across rows.
  const sumFedTax = proj.rows.reduce((s, r) => s + r.fedTax, 0);
  if (Math.abs(proj.lifetimeFedTax - sumFedTax) > Math.max(tol, proj.rows.length * tol)) {
    throw new Error(`lifetimeFedTax aggregate inconsistent: ${proj.lifetimeFedTax} vs row-sum ${sumFedTax}`);
  }
  const sumRMD = proj.rows.reduce((s, r) => s + r.rmd, 0);
  if (Math.abs(proj.lifetimeRMD - sumRMD) > Math.max(tol, proj.rows.length * tol)) {
    throw new Error(`lifetimeRMD aggregate inconsistent: ${proj.lifetimeRMD} vs row-sum ${sumRMD}`);
  }
  const sumConv = proj.rows.reduce((s, r) => s + r.rothConv, 0);
  if (Math.abs(proj.lifetimeConversion - sumConv) > Math.max(tol, proj.rows.length * tol)) {
    throw new Error(`lifetimeConversion aggregate inconsistent: ${proj.lifetimeConversion} vs row-sum ${sumConv}`);
  }
}

/**
 * Determinism check: running the same plan twice produces byte-identical projection rows.
 * Catches any non-deterministic behavior introduced (Date.now(), Math.random(), iteration
 * order over Sets/Maps, etc.).
 */
export function assertDeterministic(plan: Plan, opts?: Parameters<typeof runProjection>[1]): void {
  const a = runProjection(plan, opts);
  const b = runProjection(plan, opts);
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  if (sa !== sb) {
    // Find the first diverging row to point at the issue.
    for (let i = 0; i < a.rows.length; i++) {
      if (JSON.stringify(a.rows[i]) !== JSON.stringify(b.rows[i])) {
        throw new Error(`Projection nondeterministic at row ${i} (year ${a.rows[i].year}):\n  A: ${JSON.stringify(a.rows[i])}\n  B: ${JSON.stringify(b.rows[i])}`);
      }
    }
    throw new Error('Projection nondeterministic in aggregates (rows identical)');
  }
}
