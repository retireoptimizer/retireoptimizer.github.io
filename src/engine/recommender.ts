import type { ProjectionResult } from './projection';

export type RecGoal = 'min-tax' | 'max-end' | 'min-rmd' | 'max-roth' | 'max-longevity';

export interface RecGoalSpec {
  key: RecGoal;
  label: string;
  description: string;
  direction: 'min' | 'max';
  score: (r: ProjectionResult) => number;
  format: (m: number) => string;
}

const fmtK = (n: number) => '$' + Math.round(n / 1000).toLocaleString() + 'K';

export const REC_GOALS: Record<RecGoal, RecGoalSpec> = {
  'min-tax': {
    key: 'min-tax',
    label: 'Minimize Lifetime Taxes',
    description: 'Sum of federal + state + IRMAA across all years.',
    direction: 'min',
    score: (r) => r.rows.reduce((s, x) => s + x.fedTax + x.stateTaxAmt + x.irmaa + x.niit, 0),
    format: fmtK,
  },
  'max-end': {
    key: 'max-end',
    label: 'Maximize Tax-Adjusted End Balance',
    description: 'Tax-adjusted portfolio value at plan-to age, in today\'s dollars. Pre-tax balances are haircut by your assumed effective rate; Roth is untouched. Set both rates to 0% in Portfolio settings to optimize gross balance instead.',
    direction: 'max',
    score: (r) => r.endTaxAdjustedReal,
    format: fmtK,
  },
  'min-rmd': {
    key: 'min-rmd',
    label: 'Minimize RMD Exposure',
    description: 'Sum of all required minimum distributions over plan life.',
    direction: 'min',
    score: (r) => r.lifetimeRMD,
    format: fmtK,
  },
  'max-roth': {
    key: 'max-roth',
    label: 'Preserve Roth For Heirs',
    description: 'Ending Roth balance at plan-to age.',
    direction: 'max',
    score: (r) => {
      const last = r.rows[r.rows.length - 1];
      return last ? last.endRoth / last.inflationFactor : 0;
    },
    format: fmtK,
  },
  'max-longevity': {
    key: 'max-longevity',
    label: 'Maximize Plan Longevity',
    description: 'How long the plan funds spending; ties broken by end balance.',
    direction: 'max',
    score: (r) => {
      let lastFundedAge = 0;
      for (const x of r.rows) if (x.endTotal > 0) lastFundedAge = x.ageA;
      return lastFundedAge * 1_000_000 + r.endTaxAdjustedReal;
    },
    format: (m) => `Age ${Math.floor(m / 1_000_000)}`,
  },
};

// ─── User-facing optimizer goals (linopt-style plain English) ──────────────────
// These wrap the inner optimizer. The inner search always uses the 'max-end' spec
// (so the inner picks the strategy that maximizes tax-adjusted ending balance, with
// depletion strictly worse). Outer loops vary spending or retirement age.

export type UserGoal = 'max-end-balance' | 'max-sustainable-spending' | 'min-retirement-age';

export interface UserGoalSpec {
  key: UserGoal;
  label: string;
  description: string;
}

export const USER_GOALS: Record<UserGoal, UserGoalSpec> = {
  'max-end-balance': {
    key: 'max-end-balance',
    label: 'Maximize final net worth',
    description: 'Given your retirement age and spending, find the withdrawal + conversion plan that leaves the most behind.',
  },
  'max-sustainable-spending': {
    key: 'max-sustainable-spending',
    label: 'Maximize sustainable spending',
    description: 'Find the largest constant real annual spending level that funds your plan-to age — and the strategy that supports it.',
  },
  'min-retirement-age': {
    key: 'min-retirement-age',
    label: 'Minimize retirement age',
    description: 'Find the earliest age you can retire and still fund your current spending plan — and the strategy that gets you there.',
  },
};
