# Release 2.1 — Release Notes Draft

> Status: Draft. Edit and finalize before publishing.

---

## Roth Conversion Accuracy Fix

### What was wrong

The optimizer was recommending Roth conversions that accomplished nothing. In the same year it converted money *into* your Roth account, it was also withdrawing that same money *out* of it to cover spending. Converting $200,000 into Roth and then immediately pulling $200,000 out to pay bills is identical to just paying the bills from your pre-tax account — same taxes owed, same ending balances, nothing repositioned.

On some plans, this affected every single conversion year. The "Roth Converted" figure on the dashboard could show over a million dollars of activity that had zero real-world effect.

This also caused a second problem: because the optimizer was comparing a plan with phantom conversions against a plan with no conversions at all, it sometimes recommended the phantom-conversion plan even when the no-conversion plan would leave you with significantly more money.

### What changed

Two fixes were made, working together:

**1. Phantom conversions are now prevented at the source.**
Before the optimizer sizes a Roth conversion for a given year, it now estimates how much you will need to withdraw from Roth that same year to cover spending. If the answer is roughly as much as you would convert, the conversion is sized to zero — because it would just cancel itself out.

**2. A safety net was added.**
The optimizer already computed a "what if we skipped Roth conversions entirely" comparison to measure the conversion benefit. Now, if that no-conversion scenario scores higher than the with-conversion scenario, the optimizer ships the better result rather than ignoring it. Previously it computed this comparison and discarded it.

### What you will see in the app

- The **Roth Converted** figure on the dashboard now reflects only real repositioning — dollars moved from pre-tax to Roth that were not immediately withdrawn in the same year.
- If the optimizer determines that Roth conversions do not benefit your plan, it will now notify you: *"Conversions turned off — the optimizer found a higher balance without Roth conversions. Re-run any time to re-evaluate."*
- The **Roth Conversion Benefit** strip will no longer display a negative benefit, which was a sign that something had gone wrong with the calculation.
- A new warning appears if your withdrawal order is set to Roth-first while conversions are active, since that combination causes conversions to cancel themselves out regardless of amount.

**3. Conversion amounts now show only what you need to actually convert.**
The optimizer could recommend converting a large amount in a year when it also planned to spend from your Roth account. Converting $89,000 and then spending $48,000 out of Roth gives you exactly the same result as converting $41,000 and spending that $48,000 from your pre-tax account instead. Same tax, same ending balances. The plan now reports the smaller number, because that is the amount you have to go and move.

This is a reporting change, not a strategy change. Your projected balances and taxes stay the same. The conversion figures get substantially smaller on plans that draw from Roth during conversion years, in one case dropping from $906,575 to $31,609 over the life of the plan for an identical outcome.

### Who is affected

Plans that use bracket-fill or fixed Roth conversions alongside a withdrawal strategy that draws heavily from the Roth account in the same years as conversions. Plans with no conversions, or plans where the optimizer owns both conversions and withdrawal ordering, are not affected.

---

*Internal note: engine changes in `projection.ts` (net conversion sizing), `optimizer.ts` (baseline adoption guard), `applyOptimizerResult.ts` (landmine fix), and `planWarnings.ts` (new warning). Golden CSVs regenerated. All 309 engine tests pass. Cold build clean.*

---

## Pay IRA Taxes from Brokerage — Now on the Inputs Page

### What changed

The "Pay IRA withdrawal taxes from brokerage" option was previously only accessible on the dashboard. It is now also available on the inputs page, in the Optimization Goal section, directly above the end-balance effective tax rate fields.

This setting controls whether the taxes triggered by IRA/pre-tax withdrawals are sourced from your taxable brokerage account rather than bundled into the withdrawal itself. Keeping taxes outside the IRA withdrawal preserves more tax-deferred and Roth dollars, which is generally the better approach — so this option now **defaults to on** for all new plans.

Existing plans are not changed. If you previously had this turned off, your setting is preserved.

*Internal note: `src/schemas/plan.ts` default changed to `true` (Zod schema + `defaultPlan` + `samplePlan`). Checkbox added to `InputsPage.tsx` Optimization Goal panel. No migration bump needed — existing plans already carry an explicit value from the v20 migration.*
