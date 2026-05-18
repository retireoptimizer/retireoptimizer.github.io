import { z } from 'zod';

export const PersonSchema = z.object({
  name: z.string().min(1),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  retirementAge: z.number().int().min(40).max(80),
  planToAge: z.number().int().min(70).max(110),
  passingAge: z.number().int().min(60).max(115),
  ssPIA: z.number().nonnegative(),
  ssClaimAge: z.number().int().min(62).max(70),
});
export type Person = z.infer<typeof PersonSchema>;

export const AssumptionsSchema = z.object({
  preRetReturn: z.number(),
  postRetReturn: z.number(),
  inflation: z.number(),
  contribGrowth: z.number(),
  rmdStartAge: z.number().int().default(75),
});
export type Assumptions = z.infer<typeof AssumptionsSchema>;

export const PortfolioSchema = z.object({
  taxable: z.number().nonnegative(),
  traditional: z.number().nonnegative(),
  roth: z.number().nonnegative(),
  contribA: z.number().nonnegative(),
  contribB: z.number().nonnegative(),
  // How new contributions split across buckets (must sum to ~1)
  splitTaxable: z.number().min(0).max(1).default(0.2),
  splitTraditional: z.number().min(0).max(1).default(0.4),
  splitRoth: z.number().min(0).max(1).default(0.4),
});
export type Portfolio = z.infer<typeof PortfolioSchema>;

export const IncomeStreamSchema = z.object({
  id: z.string(),
  description: z.string(),
  whose: z.enum(['A', 'B', 'Household']),
  type: z.enum(['SS', 'Pension', 'Wages', 'Rental', 'Annuity', 'Other']),
  startAge: z.number().int().min(0).max(110),
  stopAge: z.number().int().min(0).max(115),
  annualAmount: z.number().nonnegative(),
  growthPct: z.number().min(-0.1).max(0.2),
  taxablePct: z.number().min(0).max(1),
});
export type IncomeStream = z.infer<typeof IncomeStreamSchema>;

export const ExpenseStreamSchema = z.object({
  id: z.string(),
  description: z.string(),
  whose: z.enum(['A', 'B', 'Household']),
  startAge: z.number().int().min(0).max(110),
  stopAge: z.number().int().min(0).max(115),
  annualAmount: z.number().nonnegative(),
  inflationPct: z.number(),
});
export type ExpenseStream = z.infer<typeof ExpenseStreamSchema>;

export const ConversionParamsSchema = z.object({
  mode: z.enum(['off', 'manual', 'auto-window', 'bracket-fill']),
  startAge: z.number().int().default(65),
  endAge: z.number().int().default(72),
  autoAmount: z.number().nonnegative().default(70000),
  bracketCeiling: z.number().nonnegative().default(206700),
  manualSchedule: z.record(z.string(), z.number()).default({}),
});
export type ConversionParams = z.infer<typeof ConversionParamsSchema>;

export const PlanSchema = z.object({
  personA: PersonSchema,
  personB: PersonSchema.optional(),
  assumptions: AssumptionsSchema,
  portfolio: PortfolioSchema,
  incomeStreams: z.array(IncomeStreamSchema).default([]),
  expenseStreams: z.array(ExpenseStreamSchema).default([]),
  withdrawalStrategy: z.enum(['taxfirst', 'rothfirst', 'tradfirst', 'proportional', 'bracketfill']),
  conversion: ConversionParamsSchema,
  state: z.string().default('IL'),
});
export type Plan = z.infer<typeof PlanSchema>;

export const defaultPlan = (): Plan => ({
  personA: {
    name: 'Person A',
    dob: '1973-01-01',
    retirementAge: 65,
    planToAge: 95,
    passingAge: 90,
    ssPIA: 45000,
    ssClaimAge: 67,
  },
  personB: {
    name: 'Person B',
    dob: '1975-01-01',
    retirementAge: 63,
    planToAge: 95,
    passingAge: 92,
    ssPIA: 28000,
    ssClaimAge: 67,
  },
  assumptions: {
    preRetReturn: 0.065,
    postRetReturn: 0.05,
    inflation: 0.025,
    contribGrowth: 0.03,
    rmdStartAge: 75,
  },
  portfolio: {
    taxable: 420000,
    traditional: 680000,
    roth: 185000,
    contribA: 23000,
    contribB: 18000,
    splitTaxable: 0.2,
    splitTraditional: 0.4,
    splitRoth: 0.4,
  },
  incomeStreams: [],
  expenseStreams: [
    { id: 'core', description: 'Core Household Spending', whose: 'Household', startAge: 65, stopAge: 95, annualAmount: 95000, inflationPct: 0.025 },
    { id: 'health', description: 'Healthcare', whose: 'Household', startAge: 65, stopAge: 95, annualAmount: 28000, inflationPct: 0.048 },
    { id: 'travel', description: 'Travel & Leisure', whose: 'Household', startAge: 65, stopAge: 82, annualAmount: 18000, inflationPct: 0.03 },
  ],
  withdrawalStrategy: 'taxfirst',
  conversion: {
    mode: 'off',
    startAge: 65,
    endAge: 72,
    autoAmount: 70000,
    bracketCeiling: 206700,
    manualSchedule: {},
  },
  state: 'IL',
});
