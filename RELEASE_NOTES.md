# Release Notes

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
When one spouse retires before the other, the retired spouse can still contribute to an IRA using the working partner's earned income. FireOpt now models this: enter an annual amount in the retired person's portfolio section and choose whether it goes to a Traditional or Roth IRA. The tool enforces the IRS annual limit (including catch-up for age 50+) and the projections table shows the spousal IRA as its own line so you can see exactly when it kicks in and when it stops.

**32% bracket available in bracket-fill controls**
The 32% federal bracket is now selectable in both the withdrawal ordering and Roth conversion bracket-fill dropdowns, giving you finer control over how far into the brackets you want to draw or convert each year.

### Improvements

**More accurate Roth conversion benefit figure**
The Roth Conversion Benefit number and its chart now use a proper no-conversion comparison — one that re-adapts the withdrawal strategy, not just zeroes out conversions against an arbitrary baseline. The impact chart also switches to after-tax balances so the gap you see at the end of the plan matches the benefit figure exactly.

**Help guide opens in a new tab**
The ? button now opens the how-to guide in a separate browser tab so you can read it alongside the input form without losing your place.

**Expenses guidance**
A note under the Expenses section (and in the guide) clarifies that federal and state taxes, Medicare IRMAA surcharges, and ACA premiums should not be entered as expense rows — FireOpt calculates them automatically.

**Portfolio balance date clarified**
The Portfolio section header now shows "balances as of Jan 1, [year]" so it's clear that FireOpt models the full calendar year, and that your opening balances should be as of January 1.

---

## 1.8.0 and earlier

See git history.
