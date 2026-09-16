# Defects

Identified during tax-calculation audit on 2026-09-04.

---

## D1 — Marginal rate flips to 32% when bracket-fill conversion hits ceiling exactly ✅ FIXED

**File:** `src/engine/conversion.ts:33`
**Severity:** Display bug (actual fedTax correct; marginalRate field wrong)

When the bracket-fill conversion fills ordinary taxable income exactly to the 24%/32% bracket boundary (201,775 for single 2026), IEEE 754 cancellation leaves a sub-cent residual above the boundary. The `marginalRate` loop in `yearFederalTax` uses `taxableOrdinary <= cap`; a residual of ~5×10⁻¹¹ causes it to fall through to the 32% bracket. The TaxDrag chart then shows 32% marginal rate for every year where conversions are active, even though the last converted dollar is within 24%.

**Fix applied:** Floor the headroom to the nearest cent before returning it from `rothConversion`:
```ts
const headroom = Math.max(0, Math.floor((ceiling - (baseOrdinaryIncome - stdDeduction)) * 100) / 100);
```

---

## D2 — `stateTaxablePct` on SS income streams is silently ignored

**Files:** `src/engine/projection.ts:135`, `src/engine/stateTax.ts:24`
**Severity:** Correctness — SS state tax is always 0 regardless of stream or state settings

Two layers of dead code mean SS is **always** excluded from the state tax base:

1. **`computeOtherIncome` skips SS streams entirely** before reading `stateTaxablePct`:
   ```ts
   if (s.type === 'SS') continue;   // stf = s.stateTaxablePct is never reached
   ```

2. **`ssExempt` in `STATE_PROFILES` is never used** — `stateTax()` only branches on `retirementExempt`; the `ssExempt` field is declared but never read.

The CUSTOM state profile's note says *"applied to all income including SS"*, and its `ssExempt: false` — yet SS is silently excluded. A plan with CUSTOM state and `stateTaxablePct: 1` on the SS stream would produce understated state tax with no warning.

For the jocdoc plan (CUSTOM, `stateTaxablePct: 0`) the result is accidentally correct.

**Fix required:**
- In `computeOtherIncome`, add a `nonExemptSS: number` accumulator. For SS streams, compute `amount * (s.stateTaxablePct ?? 1)` and add it to `nonExemptSS` — do **not** add to `taxableAmt` (SS federal taxability uses the §86 provisional income formula separately).
- Return `nonExemptSS` from `computeOtherIncome` and thread it into both `stateTax()` calls in the gross-up loop (lines 600 and 664 of `projection.ts`) as part of `nonExemptOrdinaryIncome`.
- Optionally remove the dead `ssExempt` field from `STATE_PROFILES`, or wire it as the default when no per-stream `stateTaxablePct` is present.

---

## D3 — NIIT base excludes ordinary dividends (known approximation)

**File:** `src/engine/niit.ts:7`
**Severity:** Minor understatement (~$380/year on 10,003 ord div for jocdoc plan)

`annualNIIT` uses `ltcg` (qualified dividends + LTCG from taxable withdrawals) as the NII proxy. IRC §1411 includes ordinary dividends in net investment income. The function comment acknowledges this is a proxy.

**Fix required:** Pass `ordinaryDiv` to `annualNIIT` alongside `ltcg` and sum them as the NII base:
```ts
niit = annualNIIT(magi, ltcg + ordinaryDiv, filingStatus);
```
The `annualNIIT` signature already accepts a generic `netInvestmentIncome` parameter, so no interface change is needed. The impact is small for typical div yields but grows with large taxable-account balances.

---

## D4 — 5-year Roth conversion clock not modeled (latent)

**File:** `src/engine/projection.ts` (conversion sizing), `src/engine/tax.ts`
**Severity:** Latent — no golden plan triggers this path; it is not reachable in any current test fixture.

IRC §72(t)(2)(F) imposes a 10% early-distribution penalty on Roth converted principal withdrawn within 5 years of the conversion, if the owner is under 59½ at the time of withdrawal. The engine models the pre-59½ penalty on pre-tax withdrawals but does not track the 5-year seasoning clock on converted principal. A plan that converts before 59½ and then withdraws from Roth before the 5-year window closes would show no penalty when the actual liability could be significant.

**Why latent:** All degenerate-conversion years in the measured golden plans (F and G) are post-59½ (ageA ≥ 65). The only early-retirement plan (`planD_singleFIRE`) generates zero conversions. The pre-retirement conversion warning added in `planWarnings.ts` (`conv-pre-retirement-tax`) alerts users that pre-retirement conversions are not fully modeled, but does not mention the 5-year clock specifically.

**Fix required:** Add a per-conversion-year balance tracker (a rolling map of `{conversionYear → amount}`) inside the projection loop. When a Roth withdrawal occurs before age 59½, sum the portion of `wdRth` attributable to principal converted within the last 5 calendar years and apply a 10% penalty to that amount alongside the existing pre-59½ logic.
