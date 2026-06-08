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
  planToAge: number;
}

const nid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export const INCOME_TEMPLATES: IncomeTemplate[] = [
  {
    id: 'blank',
    label: 'Blank stream',
    hint: 'Empty row — fill in everything yourself',
    make: () => ({
      id: nid('stream'), description: 'New Income Stream',
      whose: 'Household', type: 'Other',
      startAge: 65, stopAge: 90, annualAmount: 0, growthPct: 0.025, taxablePct: 1,
    }),
  },
  {
    id: 'pension',
    label: 'Pension',
    hint: 'Fully taxable, light COLA',
    make: ({ retirementAge, planToAge }) => ({
      id: nid('stream'), description: 'Pension',
      whose: 'Household', type: 'Pension',
      startAge: retirementAge, stopAge: planToAge,
      annualAmount: 30000, growthPct: 0.02, taxablePct: 1,
    }),
  },
  {
    id: 'wages',
    label: 'Wages / W-2',
    hint: 'Pre-retirement employment income',
    make: ({ retirementAge }) => ({
      id: nid('stream'), description: 'Wages',
      whose: 'A', type: 'Wages',
      startAge: 25, stopAge: Math.max(50, retirementAge - 1),
      annualAmount: 100000, growthPct: 0.03, taxablePct: 1,
    }),
  },
  {
    id: 'rental',
    label: 'Rental income',
    hint: 'Cash flow from a rental property',
    make: ({ planToAge }) => ({
      id: nid('stream'), description: 'Rental Income',
      whose: 'Household', type: 'Rental',
      startAge: 50, stopAge: planToAge,
      annualAmount: 24000, growthPct: 0.025, taxablePct: 0.7,
    }),
  },
  {
    id: 'annuity',
    label: 'Annuity',
    hint: 'Fixed annuity payout',
    make: ({ retirementAge, planToAge }) => ({
      id: nid('stream'), description: 'Annuity',
      whose: 'Household', type: 'Annuity',
      startAge: retirementAge, stopAge: planToAge,
      annualAmount: 18000, growthPct: 0, taxablePct: 0.7,
    }),
  },
];

export const EXPENSE_TEMPLATES: ExpenseTemplate[] = [
  {
    id: 'blank',
    label: 'Blank expense',
    hint: 'Empty row',
    make: ({ retirementAge, planToAge }) => ({
      id: nid('expense'), description: 'New Expense',
      whose: 'Household', startAge: retirementAge, stopAge: planToAge,
      annualAmount: 0, inflationPct: 0.025,
    }),
  },
  {
    id: 'healthcare',
    label: 'Healthcare (5.5% infl)',
    hint: 'Premiums + out-of-pocket; inflates faster than CPI',
    make: ({ retirementAge, planToAge }) => ({
      id: nid('expense'), description: 'Healthcare',
      whose: 'Household', startAge: retirementAge, stopAge: planToAge,
      annualAmount: 18000, inflationPct: 0.055,
    }),
  },
  {
    id: 'travel-decline',
    label: 'Travel (ends at 80)',
    hint: 'Higher early in retirement, ends mid-80s',
    make: ({ retirementAge }) => ({
      id: nid('expense'), description: 'Travel',
      whose: 'Household', startAge: retirementAge, stopAge: 80,
      annualAmount: 15000, inflationPct: 0.025,
    }),
  },
  {
    id: 'mortgage',
    label: 'Mortgage (payoff at 70)',
    hint: 'Fixed payment that ends at a specific age',
    make: ({ retirementAge }) => ({
      id: nid('expense'), description: 'Mortgage',
      whose: 'Household', startAge: retirementAge, stopAge: 70,
      annualAmount: 24000, inflationPct: 0,
    }),
  },
  {
    id: 'core',
    label: 'Core household',
    hint: 'Everything else — food, utilities, insurance, etc.',
    make: ({ retirementAge, planToAge }) => ({
      id: nid('expense'), description: 'Core Household Spending',
      whose: 'Household', startAge: retirementAge, stopAge: planToAge,
      annualAmount: 80000, inflationPct: 0.025,
    }),
  },
];
