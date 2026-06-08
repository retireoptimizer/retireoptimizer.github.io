import type { Plan } from '../schemas/plan';

/** Shared definition of the 5 built-in withdrawal-order presets. Sourced from
 *  the pre-refactor Strategy page's `STRATEGIES` array — moved here so the
 *  Dashboard StrategyChooser and any future surface can reuse the same data. */
export interface StrategyPreset {
  key: Plan['withdrawalStrategy'];
  /** Full label used in long-form prose (e.g., "Taxable → Pre-tax → Roth"). */
  label: string;
  /** Compact chip label for the Dashboard widget (≤ 14 chars). */
  shortLabel: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  /** Long description; appears in hover tooltips on the chip widget. */
  description: string;
}

export const STRATEGIES: StrategyPreset[] = [
  {
    key: 'taxfirst',
    label: 'Taxable → Pre-tax → Roth',
    shortLabel: 'Tax-first',
    badge: 'Classic',
    badgeColor: '#7a5c10',
    badgeBg: '#c9a84c20',
    description:
      'Spend taxable brokerage first (low LTCG tax), then pre-tax 401(k)/IRA, preserving Roth for last. Standard tax-efficient order.',
  },
  {
    key: 'rothfirst',
    label: 'Roth → Pre-tax → Taxable',
    shortLabel: 'Roth-first',
    badge: 'Roth-First',
    badgeColor: '#1a8a5a',
    badgeBg: '#1a8a5a20',
    description:
      'Exhaust Roth first (zero tax cost). Useful when pre-tax balance is small or for Medicaid/benefit planning.',
  },
  {
    key: 'tradfirst',
    label: 'Pre-tax → Taxable → Roth',
    shortLabel: 'Pre-tax First',
    badge: 'Pre-Tax First',
    badgeColor: '#b8620a',
    badgeBg: '#b8620a20',
    description:
      'Drain pre-tax 401(k)/IRA first to reduce future RMD exposure. Leaves Roth for heirs or late life.',
  },
  {
    key: 'proportional',
    label: 'Proportional (all buckets each year)',
    shortLabel: 'Proportional',
    badge: 'Blended',
    badgeColor: '#3b5e8a',
    badgeBg: '#3b5e8a20',
    description:
      'Each year withdraws from all three buckets proportional to their current balances.',
  },
  {
    key: 'bracketfill',
    label: 'Bracket-Fill (tax-aware blended)',
    shortLabel: 'Bracket-Fill',
    badge: 'Advanced',
    badgeColor: '#7a5c10',
    badgeBg: '#7a5c1020',
    description:
      'Take RMDs, fill the lowest tax bracket with pre-tax, then remaining need from Roth or Taxable.',
  },
];
