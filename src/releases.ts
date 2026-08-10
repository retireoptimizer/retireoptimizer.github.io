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
    version: '1.4.0',
    date: '2026-08-07',
    summary: 'Stable max-sustainable-spending results and plan import fixes.',
    changes: [
      { kind: 'fix', text: 'Max-sustainable-spending optimizer now produces consistent results across runs. The bisection previously started from 1× current spending and doubled upward, landing in different local optima depending on prior optimizer history. It now starts from an amortization-based seed — the real annual withdrawal that drains the retirement portfolio to zero by plan-to age — which anchors the search in the same neighborhood every time.' },
      { kind: 'fix', text: 'Importing a plan now correctly resets date-of-birth fields for both spouses. Previously, the DOB inputs retained the prior plan\'s dates because the local input state was not re-synced when the plan store changed.' },
      { kind: 'fix', text: 'Importing a plan now correctly resets the optimizer goal selection on the Set Goals page. If the imported plan had no prior optimization result, the previously selected goal (max-end-balance, max-sustainable-spending, or min-retirement-age) would remain highlighted instead of clearing.' },
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
