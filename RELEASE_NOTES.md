# Release Notes

## 2.0.0 — September 3, 2026

### New

**Set a legacy target when maximizing spending**
If your goal is "Maximize My Spending," you can now set a minimum amount you want to leave behind — measured in today's dollars, after estimated taxes. Retirement Optimizer finds the highest annual spending level that still meets your legacy target. If the target is out of reach given your plan, the tool tells you the gap and shows the best achievable amount so you can decide whether to adjust your goal or your inputs.

**Strategy explainer — year-by-year and overall rationale**
Two views to understand the plan Retirement Optimizer built. A year-by-year breakdown shows why each withdrawal and conversion amount was chosen — which bracket it was filling, what the tax cost was, and how each decision fits the overall plan. After running the optimizer, you can also open a rationale summary that walks through the strategy it chose and why — including whether a legacy constraint changed the recommended spending level and by how much.

### Fixes

**Medicare Part D surcharges were missing**
Higher-income retirees pay IRMAA surcharges on Part D (prescription drug) coverage, not just Part B. Retirement Optimizer was only including the Part B surcharge, which understated total Medicare costs for affected households. Both surcharges are now included.

**Medicare surcharge amounts now adjust for inflation**
IRMAA surcharge thresholds were already inflation-indexed, but the dollar amounts of the surcharges themselves were not. Both are now adjusted with CPI, so projected Medicare costs in future years are more accurate.

**Roth conversion amounts corrected when capital gains are taxed at higher rates**
In years where long-term capital gains are being taxed at higher-than-zero rates due to income level, the bracket-fill conversion was over-converting by roughly the amount of the age-65 standard deduction bonus. The calculation is now correct.

**Bracket-fill ceiling was cut in half for single filers**
The income ceiling used by the bracket-fill strategy — which determines how much to convert or withdraw before hitting the next tax bracket — was being calculated at half the correct value for single filers. This has been fixed.

**Exact age shown in plan summary**
The date-of-birth display now shows your exact age, and the wording on simulation-year alerts is clearer.

---

## 1.9.1 — August 31, 2026

### Fixes

**Manual conversion schedule extends through the survivor's end age**
For couples where Person B outlives Person A's plan-through age, the per-year manual Roth conversion entry table was stopping at Person A's age — rows for the survivor phase were missing. The table now runs through the full household horizon.

**Optimizer bracket-fill ceiling no longer restricted by withdrawal setting**
When withdrawal ordering was set to bracket-fill, the conversion bracket-fill dropdown in the "Optimize for me" tab was incorrectly filtered down to the same ceiling. The optimizer should always be free to search all brackets. Only the "Set it myself" conversion bracket respects the withdrawal ceiling limit.

---

## 1.9.0 — August 31, 2026

### New

**Spousal IRA contributions**
When one spouse retires before the other, the retired spouse can still contribute to an IRA using the working partner's earned income. Retirement Optimizer now models this: enter an annual amount in the retired person's portfolio section and choose whether it goes to a Traditional or Roth IRA. The tool enforces the IRS annual limit (including catch-up for age 50+) and the projections table shows the spousal IRA as its own line so you can see exactly when it kicks in and when it stops.

**32% bracket available in bracket-fill controls**
The 32% federal bracket is now selectable in both the withdrawal ordering and Roth conversion bracket-fill dropdowns, giving you finer control over how far into the brackets you want to draw or convert each year.

### Improvements

**More accurate Roth conversion benefit figure**
The Roth Conversion Benefit number and its chart now use a proper no-conversion comparison — one that re-adapts the withdrawal strategy, not just zeroes out conversions against an arbitrary baseline. The impact chart also switches to after-tax balances so the gap you see at the end of the plan matches the benefit figure exactly.

**Help guide opens in a new tab**
The ? button now opens the how-to guide in a separate browser tab so you can read it alongside the input form without losing your place.

**Expenses guidance**
A note under the Expenses section (and in the guide) clarifies that federal and state taxes, Medicare IRMAA surcharges, and ACA premiums should not be entered as expense rows — Retirement Optimizer calculates them automatically.

**Portfolio balance date clarified**
The Portfolio section header now shows "balances as of Jan 1, [year]" so it's clear that Retirement Optimizer models the full calendar year, and that your opening balances should be as of January 1.

---

## 1.8.0 and earlier

See git history.
