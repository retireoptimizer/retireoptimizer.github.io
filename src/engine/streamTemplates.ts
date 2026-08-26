import type { IncomeStream, ExpenseStream } from '../schemas/plan';

/** A template captures sensible starting defaults for a common stream pattern.
 *  The user tunes individual fields after adding. `make()` is a factory because
 *  IDs must be unique per click and start/stop ages may reference a "now" age. */
export interface IncomeTemplate {
  id: string;
  label: string;
  hint: string;
  make: (ctx: TemplateCtx) => IncomeStream;
}

export interface ExpenseTemplate {
  id: string;
  label: string;
  hint: string;
  make: (ctx: TemplateCtx) => ExpenseStream;
}

export interface TemplateCtx {
  retirementAge: number;
  planThroughAge: number;
}

const nid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export const INCOME_TEMPLATES: IncomeTemplate[] = [
  {
    id: 'blank',
    label: 'Blank stream',
    hint: 'Empty row — fill in everything yourself',
    make: ({ retirementAge, planThroughAge }) => ({
      id: nid('stream'), description: 'Description',
      whose: 'Household', type: 'Other',
      startAge: retirementAge, end: { mode: 'age' as const, age: planThroughAge }, survivorPct: 0,
      annualAmount: 0, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1,
    }),
  },
  {
    id: 'pension',
    label: 'Pension',
    hint: 'Fully taxable, light COLA',
    make: ({ retirementAge, planThroughAge }) => ({
      id: nid('stream'), description: 'Pension',
      whose: 'Household', type: 'Pension',
      startAge: retirementAge, end: { mode: 'age' as const, age: planThroughAge }, survivorPct: 0,
      annualAmount: 30000, growthPct: { mode: 'fixed', rate: 0.02 }, taxablePct: 1, stateTaxablePct: 1,
    }),
  },
  {
    id: 'annuity',
    label: 'Annuity',
    hint: 'Fixed annuity payout',
    make: ({ retirementAge, planThroughAge }) => ({
      id: nid('stream'), description: 'Annuity',
      whose: 'Household', type: 'Annuity',
      startAge: retirementAge, end: { mode: 'age' as const, age: planThroughAge }, survivorPct: 0,
      annualAmount: 18000, growthPct: { mode: 'fixed', rate: 0 }, taxablePct: 0.7, stateTaxablePct: 1,
    }),
  },
  {
    id: 'muni',
    label: 'Muni Bond',
    hint: 'External bond ladder — federally tax-free; still counts toward SS taxability, ACA & IRMAA',
    make: ({ retirementAge, planThroughAge }) => ({
      id: nid('stream'), description: 'Muni Bond Interest',
      whose: 'Household', type: 'MuniBond',
      startAge: retirementAge, end: { mode: 'age' as const, age: planThroughAge }, survivorPct: 0,
      annualAmount: 10000, growthPct: { mode: 'fixed', rate: 0 }, taxablePct: 0, stateTaxablePct: 1,
    }),
  },
  {
    id: 'va',
    label: 'VA / Disability',
    hint: 'Fully exempt from federal and state tax (38 U.S.C. §5301); CPI-indexed',
    make: ({ retirementAge, planThroughAge }) => ({
      id: nid('stream'), description: 'VA Disability Compensation',
      whose: 'A', type: 'VA',
      startAge: retirementAge, end: { mode: 'age' as const, age: planThroughAge }, survivorPct: 0,
      annualAmount: 20000, growthPct: { mode: 'cpi' }, taxablePct: 0, stateTaxablePct: 0,
    }),
  },
];

export const EXPENSE_TEMPLATES: ExpenseTemplate[] = [
  {
    id: 'blank',
    label: 'Blank expense',
    hint: 'Empty row',
    make: ({ retirementAge, planThroughAge }) => ({
      id: nid('expense'), description: 'Description',
      whose: 'Household', startAge: retirementAge, end: { mode: 'age' as const, age: planThroughAge }, survivorPct: 1,
      annualAmount: 0, inflationPct: { mode: 'cpi' },
    }),
  },
  {
    id: 'healthcare',
    label: 'Healthcare (5.5% infl)',
    hint: 'Premiums + out-of-pocket; inflates faster than CPI',
    make: ({ retirementAge, planThroughAge }) => ({
      id: nid('expense'), description: 'Healthcare',
      whose: 'Household', startAge: retirementAge, end: { mode: 'age' as const, age: planThroughAge }, survivorPct: 1,
      annualAmount: 18000, inflationPct: { mode: 'fixed', rate: 0.055 },
    }),
  },
  {
    id: 'travel-decline',
    label: 'Travel (ends at 80)',
    hint: 'Higher early in retirement, ends mid-80s',
    make: ({ retirementAge }) => ({
      id: nid('expense'), description: 'Travel',
      whose: 'Household', startAge: retirementAge, end: { mode: 'age' as const, age: 80 }, survivorPct: 1,
      annualAmount: 15000, inflationPct: { mode: 'cpi' },
    }),
  },
  {
    id: 'mortgage',
    label: 'Mortgage (payoff at 70)',
    hint: 'Fixed payment that ends at a specific age',
    make: ({ retirementAge }) => ({
      id: nid('expense'), description: 'Mortgage',
      whose: 'Household', startAge: retirementAge, end: { mode: 'age' as const, age: 70 }, survivorPct: 1,
      annualAmount: 24000, inflationPct: { mode: 'fixed', rate: 0 },
    }),
  },
  {
    id: 'core',
    label: 'Core household',
    hint: 'Everything else — food, utilities, insurance, etc.',
    make: ({ retirementAge, planThroughAge }) => ({
      id: nid('expense'), description: 'Core Household Spending',
      whose: 'Household', startAge: retirementAge, end: { mode: 'age' as const, age: planThroughAge }, survivorPct: 1,
      annualAmount: 80000, inflationPct: { mode: 'cpi' },
    }),
  },
];
