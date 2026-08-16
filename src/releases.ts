export type ChangeKind = 'feature' | 'fix' | 'cosmetic';

export interface Change {
  kind: ChangeKind;
  text: string;
}

export interface Release {
  version: string;
  date: string;
  summary?: string;
  changes: Change[];
}

export const RELEASES: Release[] = [
  {
    version: '1.6.0',
    date: '2026-08-16',
    summary: 'Marginal tax rate on charts, nominal-dollar inputs for conversions and blends, and a more accurate ACA subsidy calculation.',
    changes: [
      { kind: 'feature', text: 'Marginal tax rate now appears as a step-line on the Federal Tax Drag and State Tax Drag charts alongside the existing Effective Rate line. Shows the bracket your next dollar of income falls into, year by year — useful for spotting Roth conversion windows and RMD cliffs.' },
      { kind: 'feature', text: 'Custom Blend and Manual Conversion inputs now respect the Nominal/Real display toggle. When Nominal $ is selected, the Traditional Account Cap, Fixed Conversion Amount, and per-age manual conversion entries show and accept future nominal values; the engine converts them to today\'s dollars using your inflation assumption before running.' },
      { kind: 'feature', text: 'The optimizer now tests a bracket-fill withdrawal strategy with no Roth conversions as an explicit competitor. For plans with large traditional accounts, this catches cases where maximizing withdrawals from tax-deferred accounts beats a conversion-heavy approach that is locally optimal but not globally so.' },
      { kind: 'fix', text: 'ACA subsidies were overstated in plans with Social Security income. ACA MAGI must include non-taxable Social Security (IRS definition), while IRMAA MAGI does not. The engine now uses the correct definition for each calculation, which may modestly reduce projected ACA subsidies for plans relying on SS income.' },
      { kind: 'cosmetic', text: 'The MAGI column is removed from the Projections table. Instead, hovering over the ACA Premium and IRMAA columns shows a tooltip with the MAGI value used for that specific calculation.' },
      { kind: 'cosmetic', text: 'A warning banner now appears on the Dashboard and Projections table when the bracket-fill withdrawal ceiling has been overridden by a conflicting constraint.' },
      { kind: 'fix', text: 'The State Tax Drag chart was blank for plans using a custom flat-rate state tax. The chart now displays correctly and shows both effective and marginal state tax rates.' },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-08-13',
    summary: 'Tax sourcing from brokerage, smarter ACA subsidy optimization, retirement-age shift improvements, and a redesigned Projections table.',
    changes: [
      { kind: 'feature', text: 'Pay taxes from brokerage: a new option on the Strategy page lets you cover your tax bill from your taxable account first, keeping your IRA withdrawals focused on spending. Useful when you want to preserve tax-deferred growth or manage your taxable income more precisely.' },
      { kind: 'feature', text: 'The optimizer now actively hunts for the ACA subsidy sweet spot. If your projected income is above the 400% FPL cliff in the years before Medicare, it tests whether pulling slightly less from your IRA keeps you in the subsidy band — a strategy that can be worth thousands per year but is easy to miss.' },
      { kind: 'feature', text: 'The optimizer now compares deferring all Roth conversions to after age 65 against doing them earlier. This prevents it from settling on a pre-Medicare conversion that looks good in isolation but is worse than waiting until ACA constraints are no longer a factor.' },
      { kind: 'feature', text: 'Retirement-age adjustments — from the optimizer or the What-If slider — now automatically shift any expense streams you pinned to start at retirement. Your plan stays internally consistent without manual cleanup.' },
      { kind: 'feature', text: 'Projections table redesigned: columns are now grouped into Income, Withdrawals, Spending, Taxes, and Balances with color-coded sections. Column headers stay pinned as you scroll in any direction. Qualified and ordinary dividend columns added.' },
      { kind: 'feature', text: 'Monte Carlo and historical sequence tests now run with your What-If Bar settings applied. Previously they always used your saved plan, ignoring any live slider adjustments.' },
      { kind: 'fix', text: 'Early retirement feasibility check improved: the min-retirement-age optimizer now verifies whether you can cover spending from taxable and Roth accounts alone before concluding a given age is infeasible. Some retirement ages that were previously rejected are now correctly accepted.' },
      { kind: 'fix', text: 'Bracket-fill Roth conversions were under-converting in years where your income is below the standard deduction. The full available headroom up to your target bracket is now used correctly.' },
      { kind: 'fix', text: 'The standard deduction shown in the Projections table now includes the senior bonus deduction for taxpayers 65+, matching the actual tax calculation.' },
      { kind: 'fix', text: 'Annual Spending on the Dashboard now shows the correct first year of retirement spending, ignoring any gap years with zero spending before retirement income kicks in.' },
      { kind: 'fix', text: 'Running the optimizer with the Max Sustainable Spending or Min Retirement Age goal now correctly shows the pending Apply-to-Plan banner, consistent with the v1.4.0 behavior for other goals.' },
      { kind: 'cosmetic', text: 'Projections table has four new tax columns: MAGI, Standard Deduction, Senior Bonus Deduction, and Taxable Income — in that order, showing the full deduction waterfall before tax is calculated.' },
      { kind: 'cosmetic', text: 'Dividend yield can now be entered with two decimal places (e.g. 1.75%) instead of one.' },
      { kind: 'cosmetic', text: 'Monte Carlo trials capped at 10,000. The input now enforces this limit when typing.' },
      { kind: 'cosmetic', text: 'Side panels (How-To Guide, Release Notes, Customize sheet) no longer render behind chart content on desktop.' },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-08-10',
    summary: 'OBBBA senior deduction, ACA start age, stable max-spending optimizer, Apply-to-Plan flow, and UX cleanup.',
    changes: [
      { kind: 'feature', text: 'Senior bonus deduction (OBBBA): the engine now applies the $6,000/person above-the-line deduction for taxpayers 65+ for tax years 2025–2028. Phases out at $0.06 per dollar of MAGI above $75K (Single) / $150K (MFJ). Calculated automatically — no user input required.' },
      { kind: 'feature', text: 'ACA enrollment start age: when ACA modeling is on, you can now set the age each person enters the marketplace. Useful when a gap period is covered by COBRA or a spouse\'s employer plan before switching to ACA.' },
      { kind: 'feature', text: 'Apply-to-Plan flow: the optimizer result is now previewed on the Dashboard before being committed. An ⚡ banner shows the result is pending; click Apply to Plan to save it or Discard to abandon it. This lets you compare the projected outcome before overwriting your plan.' },
      { kind: 'feature', text: 'Annual Spending hero stat added to the Dashboard, showing first-retirement-year net spending in today\'s dollars (or nominal, matching the display mode toggle).' },
      { kind: 'feature', text: 'Roth conversion mode controls moved inline on the Inputs page alongside the goal selector — no longer buried in a separate panel. Optimizer decides / None / Bracket-Fill / Fixed Amount / Manual are all visible before running.' },
      { kind: 'fix', text: 'Max-sustainable-spending optimizer now produces consistent results across runs. It seeds from an amortization estimate (the real withdrawal that drains the portfolio to zero by plan-to age), eliminating the run-to-run variance caused by anchoring at 1× current spending.' },
      { kind: 'fix', text: 'Projection and optimizer windows now extend to whichever spouse lives longer. Previously the window was capped at Person A\'s plan-to age, cutting the projection short for couples where Person B is configured to live longer.' },
      { kind: 'fix', text: 'Importing a plan now correctly resets DOB fields for both spouses and clears the optimizer goal selection when the imported plan has no prior optimization result.' },
      { kind: 'fix', text: 'Navigation tabs (Dashboard, Projections, Taxes, Monte Carlo) are now always accessible. The gate that disabled them when inputs changed since the last optimizer run has been removed.' },
      { kind: 'cosmetic', text: 'What-If spending slider now shows absolute dollar amounts instead of a percentage multiplier. Range auto-scales to ±2.5× current expenses; step size is proportional to spending level.' },
      { kind: 'cosmetic', text: 'Income and expense start ages are now clamped to the relevant person\'s retirement age, preventing entries that predate retirement.' },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-08-06',
    summary: 'Dividend/interest yield modeling, per-person spousal RMD rollover, and smarter conversion explainer.',
    changes: [
      { kind: 'feature', text: 'Taxable account dividend and interest yield: enter the yield portion of your taxable return (e.g. 2%) and the qualified-dividend split. Dividends are taxed annually — ordinary dividends at your income rate, qualified dividends at LTCG rates — and the reinvested amount grows your cost basis, reducing future capital gains on withdrawal.' },
      { kind: 'feature', text: 'Spousal IRA rollover and per-person RMDs: when one spouse passes, their traditional IRA balance automatically rolls over to the survivor\'s account. RMDs are now calculated per-person using each individual\'s age and SECURE 2.0 start age, and stop for the deceased spouse immediately.' },
      { kind: 'feature', text: 'Optimizer explainer now quantifies the dollar benefit of your Roth conversion strategy versus doing no conversions at all, with plan-specific reasoning based on traditional account share, RMD exposure, and pension income.' },
      { kind: 'fix', text: 'Social Security benefit amounts in survivor scenarios corrected — inflation adjustment was missing from the SS stream calculation after one spouse\'s death.' },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-08-04',
    summary: 'CPI-linked growth rates, lump-sum inherited accounts, and How-To Guide expansion.',
    changes: [
      { kind: 'feature', text: 'Income and expense growth rate: three modes — Tracks CPI (grows with your plan\'s inflation assumption), CPI ± Adjust (inflation plus a fixed offset), and Fixed Rate (locked percentage independent of CPI).' },
      { kind: 'feature', text: 'Four new lump-sum account types: Inherited IRA, Inherited Roth IRA, Inherited Taxable, and Joint/Revocable Trust.' },
      { kind: 'cosmetic', text: 'How-To Guide expanded: growth rate mode comparison table for income and expenses, updated income stream examples reflecting CPI modes, updated lump-sum section covering all four new account types.' },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-08-02',
    summary: 'Lump-sum events, min-retirement-age optimizer, per-stream state tax, and accuracy fixes.',
    changes: [
      { kind: 'feature', text: 'Lump-sum events: schedule one-time deposits or withdrawals (inheritance, home sale, bonus, tuition) at any future age from the Portfolio page.' },
      { kind: 'feature', text: 'Per-stream state taxable %: override the taxable fraction for each income stream when using a custom flat-rate state tax.' },
      { kind: 'feature', text: 'Min-retirement-age optimizer now searches below age 55, applying penalty-free asset boundary logic to determine feasibility.' },
      { kind: 'feature', text: 'RMD start age derived from date of birth per SECURE Act / SECURE 2.0 thresholds (age 73 or 75 depending on birth year).' },
      { kind: 'fix', text: 'Surviving spouse now files Single in the year following death (not after an incorrect 2-year grace period).' },
      { kind: 'fix', text: 'Configurable bracket-fill withdrawal ceiling; Roth conversion gate corrected; stale 2025 federal tax constants removed.' },
      { kind: 'fix', text: 'Conversion bracket ceiling cap no longer incorrectly applied when withdrawal strategy is not bracket-fill.' },
      { kind: 'fix', text: 'Min-retirement-age search floored at the person\'s current age — the optimizer no longer suggests retiring in the past.' },
      { kind: 'fix', text: 'Re-optimize banner clears correctly after applying a saved plan (plan key stored on apply).' },
      { kind: 'fix', text: 'Input UX: default return rate normalized on load; label and spacing cleanup across input pages.' },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-07-30',
    summary: 'First public release.',
    changes: [
      { kind: 'feature', text: 'ACA marketplace premium and APTC subsidy shown as a distinct cash-flow line in charts and projections table.' },
      { kind: 'feature', text: 'Custom flat-rate state tax option for states not individually modeled.' },
      { kind: 'feature', text: 'Historical sequence analysis (cFIREsim-style) — stress-tests the plan against every rolling historical window since 1928.' },
      { kind: 'feature', text: 'Monte Carlo simulation with historical block-bootstrap, stochastic inflation, and stress-scenario detail modal.' },
      { kind: 'feature', text: 'Semi-retirement phase: staggered two-person retirement with different income stop dates.' },
      { kind: 'feature', text: 'Phase 1 accuracy: ACA subsidy math, Social Security provisional income taxation (50%/85% tiers), IRMAA Medicare lookback, and LTCG stacking against ordinary income.' },
      { kind: 'feature', text: 'What-If bar: live overlay sliders for retirement age, return rate, inflation, and spending multiplier without touching the saved plan.' },
      { kind: 'feature', text: 'Roth conversion modes: off, manual fixed amount, auto-window, and bracket-fill to top of a selected bracket.' },
      { kind: 'feature', text: 'Five withdrawal-ordering presets (tax-first, Roth-first, trad-first, proportional, bracket-fill) plus custom age-window blend policies.' },
      { kind: 'feature', text: 'Optimizer: multi-phase coordinate descent over withdrawal splits and Roth conversion amounts, evaluating up to 5,000 projections to maximize inflation-adjusted longevity.' },
      { kind: 'feature', text: 'Post-retirement return slider; 2026 federal tax brackets; filing-status-aware IRMAA tiers.' },
      { kind: 'feature', text: 'Scenario comparison: save and compare up to N named what-if scenarios side by side on the Dashboard.' },
      { kind: 'fix', text: 'DOB year validation prevents silent optimizer crash on implausible birth years.' },
      { kind: 'fix', text: 'Optimizer errors now surface in the UI instead of silently swallowing the exception.' },
      { kind: 'fix', text: 'IL state tax calculation corrected (three missing components restored).' },
      { kind: 'fix', text: 'Custom state tax rate now initializes to 5% instead of 0% when first selected.' },
      { kind: 'cosmetic', text: 'Mobile-first responsive layout with bottom tab bar and sheet-style modals.' },
      { kind: 'cosmetic', text: 'Clarity design system: consistent typography, spacing, and color tokens across all pages.' },
      { kind: 'cosmetic', text: 'Inputs consolidated into a single tabbed page; inflation moved to its own section; growth-rate labels renamed to Expected Returns.' },
    ],
  },
];
