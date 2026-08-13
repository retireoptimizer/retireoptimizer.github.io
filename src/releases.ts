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
    version: '1.5.0',
    date: '2026-08-13',
    summary: 'Pay taxes from brokerage, ACA cliff optimizer, smarter retirement-age shift, Projections table overhaul, and accuracy fixes.',
    changes: [
      { kind: 'feature', text: 'Pay IRA withdrawal taxes from brokerage: new option on the Strategy page lets you source federal/state taxes from the taxable (brokerage) account first, rather than bundling them with spending in the withdrawal strategy. Degrades gracefully when brokerage is depleted.' },
      { kind: 'feature', text: 'ACA cliff-anchor step added to the optimizer: for each pre-Medicare year where projected MAGI is above the 400% FPL subsidy cliff, the optimizer now explicitly evaluates a withdrawal split targeting MAGI just below 399% FPL. This captures subsidy-preserving strategies that coordinate descent could miss.' },
      { kind: 'feature', text: 'Zero pre-Medicare conversions competitor: the optimizer now always evaluates a basin where all Roth conversions before age 65 are suppressed, then fully refines it. Prevents locking into an isolated pre-65 conversion that looks locally optimal but is worse than deferring to post-Medicare years.' },
      { kind: 'feature', text: 'Retirement-age shift now moves pinned expense-stream start ages: when the optimizer or what-if slider adjusts retirement age, expense streams whose start age was set to the old retirement age are automatically moved to the new one. All three code paths (optimizer trial loop, Apply-to-Plan, what-if slider) now use the same canonical shiftRetirementAge function.' },
      { kind: 'feature', text: 'Projections table redesigned: columns reorganized into Income, Withdrawals, Spending, Taxes, and Balances groups with distinct color bands. Sticky column headers now stay visible while scrolling horizontally and vertically. Qualified and ordinary dividend columns added.' },
      { kind: 'feature', text: 'Monte Carlo and historical sweep now respect What-If Bar overrides (retirement age, return rate, inflation, spending). Previously Monte Carlo always ran against the saved plan ignoring live slider adjustments.' },
      { kind: 'fix', text: 'Min-retirement-age optimizer no longer rejects early retirement solely because the unconstrained optimizer elected pre-59 traditional withdrawals for tax efficiency. It now re-verifies feasibility with pre-59 traditional locked to zero; only stops if the constrained plan also runs out.' },
      { kind: 'fix', text: 'Bracket-fill Roth conversion headroom now correctly allows negative ordinary income minus standard deduction to propagate (removed inner Math.max guard). This was under-converting when base income was below the standard deduction.' },
      { kind: 'fix', text: 'De-minimis traditional withdrawal artifact (<$100) from the safety-valve last-resort funding path is now zeroed out when the active blend window has pctTraditional=0. Prevents spurious "early traditional withdrawal" flags in the optimizer.' },
      { kind: 'fix', text: 'Standard deduction shown in Projections table now includes the senior bonus deduction ($6,000/person 65+), matching the tax calculation.' },
      { kind: 'fix', text: 'Dashboard Annual Spending stat now skips rows where netSpend=0, so it correctly reflects the first year with actual spending rather than an intermediate phase.' },
      { kind: 'fix', text: 'Apply-to-Plan flow: max-sustainable-spending and min-retirement-age goals now correctly show the pending banner after optimization, consistent with the behavior introduced in v1.4.0.' },
      { kind: 'fix', text: 'Dividend yield input now accepts two decimal places instead of one.' },
      { kind: 'cosmetic', text: 'Modal z-index raised to 200 on desktop for HowToGuide, ReleaseNotes, and Customize sheet — prevents content from rendering behind charts.' },
      { kind: 'cosmetic', text: 'NumberInput decimal-place guard: typing beyond the configured digit limit is now blocked at the input level instead of silently rounding.' },
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
