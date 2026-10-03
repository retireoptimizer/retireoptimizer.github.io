# Change summary: inherited IRAs received before today, 10-year deadline fix, inherited-IRA annual RMDs, own-RMD base fix

Date: 2026-10-02. Branch: `main` (uncommitted at time of writing). Store version 31 → 32.

## Problem

One-time income events dated before the plan's first year were silently dropped. The engine
only injected an event when `personAge === ev.age`, and the simulation starts at today's age.
A retiree who inherited an IRA 3 years ago could not model the remaining 10-year drawdown.

## Behavior changes

### 1. Past inherited IRA / Roth events (new)
- Inherited Pre-Tax IRA and Inherited Roth events may be dated up to 10 years before today's age.
- For a past date, **Amount = balance on Jan 1 of the current year** (same date as Portfolio
  balances; reuses the existing `amount` field).
- The balance is added to the opening balance in year 0 (`tradA` / `tradB` / `roth`), not shown
  as a "Lump Sum" injection. It grows with the host account from year 0.
- The 10-year clock still runs from `ev.age`. Per-event depletion tracking is seeded with
  `remainingBal = amount`, `injected = true`.
- Inherited balances stay excluded from Roth conversion capacity (existing logic).
- Past **Taxable** and **Inherited HSA** events are still ignored (already in portfolio / already
  taxed). The UI blocks entering them; a plan warning flags any that exist.
- Past inherited events whose deadline has passed are ignored, with a plan warning.

### 2. 10-year deadline off by one (fixed)
- Rule: account must be empty by Dec 31 of the **10th year after the year of death**.
- `ev.age` now means **the beneficiary's age in the year of death** (year 0).
- Window is years 0..10 (11 calendar years). Year 10 forces out the remainder.
- Before: window was years 0..9 (one year too strict).
- Even-spread floor = `remainingBal / (11 - yearsElapsed)` (was `/ (10 - yearsElapsed)`).
- Effect on existing plans with future inherited events: one extra year of spreading, so
  slightly lower annual forced distributions and slightly lower per-year tax.
- Example: death 3 years ago → **8** years left including this year (not 7).

### 3. Nominal vs today's dollars (comment fix only)
- Comment at the injection block claimed amounts were in today's dollars and inflated. Code
  never inflated, and the UI asks for nominal dollars. Comment corrected; no behavior change.

### 4. Annual RMDs on inherited pre-tax IRAs (new, opt-in)
- New optional field `LumpSumEvent.ownerStartedRmds` (Inherited Pre-Tax IRA only). UI: checkbox
  under the row, "The original owner had already started required withdrawals".
- When checked, years 1..9 after death also owe an annual RMD (2024 final regs):
  `prior year-end inherited balance / (SingleLifeLE(ageInDeathYear + 1) − (yearsElapsed − 1))`,
  divisor floored at 1. Year 0 (death year) and year 10 (deadline) unchanged.
- Forced floor each year = **max(even spread, annual RMD)**. Strategy trad withdrawals still
  count toward it proportionally (existing logic).
- When the divisor reaches 1, the whole account is distributed that year (not just the prior
  balance), so no growth residue lingers until the deadline.
- Only matters when the beneficiary was about **81+ in the year of death** (life expectancy under
  10 years). Younger beneficiaries: even spread is always larger, results identical.
- Uses the beneficiary's life expectancy only. The rule allows the owner's remaining expectancy
  when longer (owner younger than beneficiary); ignoring it can only raise the RMD.
- Absent / unchecked = previous behavior. v32 migration is a no-op comment.
- Life table: IRS Single Life Table, 26 CFR 1.401(a)(9)-9(b), values checked against the
  Cornell LII copy of the regulation.

### 5. How-To guide: Taxable one-time events (doc fix)
- Guide said Taxable events are counted as ordinary income. The engine deposits them into the
  brokerage with full basis and **no tax**. Guide now says so and asks for the after-tax amount;
  examples changed to cash inheritances, home-sale proceeds, insurance payouts (dropped
  "business-sale proceeds" and "large bonuses", which are taxable).

### 6. Own RMD no longer includes the inherited balance (bug fix, pre-existing)
- Before: the beneficiary's own RMD was `tradA / divisor` (or `tradB`), and `tradA` also holds
  the inherited balance. Those RMD dollars did not reduce the inherited `remainingBal`, so for a
  beneficiary past their own RMD age the inherited money was counted in both RMDs and both
  floors were forced (over-distribution, extra tax).
- Now: own RMD base = `tradA − tracked inherited pre-tax balance in tradA` (same for B), the
  same exclusion the Roth conversion cap already used.
- Attribution: B events → `tradB`; A and Household events → `tradA`, or `tradB` once A has died
  (the death rollover moves `tradA` into `tradB`). Events no longer tracked (owner dead, or
  balance emptied) are not excluded.
- Effect: lower own RMD (and tax) during the inherited window for beneficiaries at or past their
  RMD start age. No effect on plans without inherited pre-tax events.

## Files changed

| File | Change |
|---|---|
| `src/engine/taxConstants.ts` | `INHERITED_DEADLINE_YEARS = 10`; `SINGLE_LIFE_TABLE` (ages 0..120+) |
| `src/engine/rmd.ts` | `singleLifeExpectancy(age)`, `inheritedRmdDivisor(ageInDeathYear, yearsElapsed)` |
| `src/schemas/plan.ts` | `LumpSumEventSchema.ownerStartedRmds: z.boolean().optional()` |
| `src/store/usePlanStore.ts` | Version 32 (comment-only migration) |
| `src/engine/projection.ts` | `isPastInheritedEvent()`; private `inheritedAnnualRmd()`; past events seeded into opening balances; window `> 10` exclusion and `11 - yearsElapsed` divisor; RMD-aware floor in both the pre-estimate loop and the depletion loop; own-RMD base excludes tracked inherited balance (`inheritedInTradA/B`); comment fix |
| `src/engine/planWarnings.ts` | Warnings `lump-past-<id>` (past taxable/HSA ignored) and `lump-expired-<id>` (deadline passed) |
| `src/pages/InputsPage.tsx` | Age min = today − 10 for inherited IRA/Roth, today for others; age clamped on Whose / Account change; per-row note for past inherited accounts; RMD checkbox on Inherited Pre-Tax IRA rows; helper text rewritten |
| `src/components/HowToGuide.tsx` | Corrected deadline wording and example ($250k ÷ 11 ≈ $22.7k, empty by age 75); RMD checkbox explained; Taxable event tax treatment corrected |
| `src/engine/rmd.test.ts` | Life table spot values; inherited divisor |
| `src/engine/projection.test.ts` | Existing inherited tests moved to window ending age 75 (taxfirst test now asserts the account is drawn each year rather than that the supplement fires each year); new suite "Inherited accounts received before plan start" (7 tests: past IRA, past Roth, ignored/expired, deadline year, 2 annual-RMD, own-RMD exclusion) |

Ages use calendar-year age (`currentYear − birthYear`), matching the engine.

## Manual test plan

Inputs page → One-Time Income Events.

1. **Past Inherited Pre-Tax IRA, 3 years ago, $100k, Whose = you.**
   - Note under the row: "Inherited 3 years ago ... emptied within 8 years, counting this year.
     Don't include this account in your Portfolio balances."
   - Projections: year-0 beginning Traditional is $100k higher than without the event;
     "Lump Sum" column is 0; "Inherited Inc" is > 0 in the first year and the account is
     empty after 8 years. (Some middle years can show 0 "Inherited Inc" if regular pre-tax
     withdrawals already cover the floor.)
2. **Past Inherited Roth, 5 years ago.** Forced Roth distributions only in the first 6 years;
   no ordinary income from them.
3. **Exactly 10 years ago.** Entire balance forced out in year 0.
4. **Age entry limits.** Inherited IRA/Roth age cannot go below today − 10. Switching the
   account to Taxable or HSA bumps the age up to today. Switching Whose to the other person
   re-clamps against that person's age.
5. **Future inherited IRA at age 65.** Forced distributions run ages 65–75 (previously 65–74).
6. **Warnings.** A stored past Taxable event (e.g. from an older saved plan) shows the
   `lump-past` warning; an inherited account more than 10 years back shows `lump-expired`.
7. **Household / Person B.** Household events use Person A's age; Person B events use B's age
   and seed `tradB`.
8. **RMD checkbox.** Only appears on Inherited Pre-Tax IRA rows.
   - Beneficiary age 86 now, owner died when they were 85, $200k, checked: first-year
     "Inherited Inc" ≈ $26,316 ($200k ÷ 7.6) vs ≈ $21,100 unchecked; account empty by age 93.
   - Younger beneficiary (e.g. 55): checking the box changes nothing.
9. **Old saved plan.** Loads without errors; inherited IRA rows show the checkbox unchecked.
10. **Own RMD exclusion.** Person age 80 (past RMD age), inherited IRA from 2 years ago, $300k.
    Projections year 0: "RMD" column equals the RMD with the event removed; beginning
    Traditional is $300k higher. Before the fix, RMD was about $300k ÷ 20.2 ≈ $14.9k higher.

## Test status

- `pnpm vitest run src/engine/rmd.test.ts src/engine/planWarnings.test.ts src/engine/projection.test.ts`:
  81/81 passed after all changes.
- Full `pnpm test` before the own-RMD fix: 394 passed, 1 skipped (38 files).
- Full `pnpm test` after the own-RMD fix: 395 passed, 1 skipped (38 files).
- `tsc -b --force`: clean.
- `pnpm lint`: 3 pre-existing errors in untouched files (`LearnMoreModal.tsx`, `optimizer.test.ts`).

## Known issues not addressed

- On an owner's death, a still-tracked A/B inherited balance rolls into the survivor's
  traditional account and stops being tracked (no successor-beneficiary 10-year rule), so it
  then counts toward the survivor's own RMD.
- Year-of-death RMD the decedent had not yet taken is not modeled.
- Eligible designated beneficiaries (spouse, minor child, disabled, not more than 10 years
  younger) are not modeled; everyone gets the 10-year rule.
