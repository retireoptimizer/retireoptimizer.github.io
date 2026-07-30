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
