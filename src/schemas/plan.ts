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
  // ACA marketplace premium modeling (pre-Medicare gap years)
  modelACA: z.boolean().default(false),
  acaHouseholdSize: z.number().int().min(1).max(8).default(2),
  /** Annual benchmark (SLCSP) premium for the household at plan-start in today's dollars.
   *  Inflation-scaled each projection year. 0 = no ACA cost added.
   *  When acaNoSubsidy=true, this is the full premium paid with no subsidy applied. */
  acaBenchmarkPremium: z.number().nonnegative().default(0),
  /** When true, skip APTC calculation and use acaBenchmarkPremium as the full cost paid.
   *  Use for COBRA, employer retiree coverage, or income above subsidy range. */
  acaNoSubsidy: z.boolean().default(false),
});
export type Assumptions = z.infer<typeof AssumptionsSchema>;

export const PersonPortfolioSchema = z.object({
  taxable: z.number().nonnegative(),
  traditional: z.number().nonnegative(),
  roth: z.number().nonnegative(),
  annualContribution: z.number().nonnegative(),
  // How each year's contribution splits across buckets for this person (must sum to ~1)
  contribSplit: z.object({
    taxable: z.number().min(0).max(1),
    traditional: z.number().min(0).max(1),
    roth: z.number().min(0).max(1),
  }),
});
export type PersonPortfolio = z.infer<typeof PersonPortfolioSchema>;

export const PortfolioSchema = z.object({
  personA: PersonPortfolioSchema,
  personB: PersonPortfolioSchema.optional(),
});
export type Portfolio = z.infer<typeof PortfolioSchema>;

/** Derived household totals from per-person portfolios. */
export const householdTotals = (p: Portfolio) => {
  const a = p.personA;
  const b = p.personB;
  return {
    taxable: a.taxable + (b?.taxable ?? 0),
    traditional: a.traditional + (b?.traditional ?? 0),
    roth: a.roth + (b?.roth ?? 0),
    contribA: a.annualContribution,
    contribB: b?.annualContribution ?? 0,
  };
};

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

export const BlendWindowSchema = z.object({
  fromAge: z.number().int(),
  toAge: z.number().int(),
  pctTaxable: z.number().min(0).max(1),
  pctTraditional: z.number().min(0).max(1),
  pctRoth: z.number().min(0).max(1),
  tradCap: z.number().nonnegative().optional(),
  convAmt: z.number().nonnegative().optional(),
});
export const BlendPolicySchema = z.object({
  windows: z.array(BlendWindowSchema).min(1),
  source: z.enum(['optimizer', 'manual']).optional(),
  goal: z.string().optional(),
});
export type BlendPolicySchemaT = z.infer<typeof BlendPolicySchema>;

export const ConversionParamsSchema = z.object({
  mode: z.enum(['off', 'manual', 'auto-window', 'bracket-fill']),
  startAge: z.number().int().default(65),
  endAge: z.number().int().default(72),
  autoAmount: z.number().nonnegative().default(70000),
  bracketCeiling: z.number().nonnegative().default(96950),
  manualSchedule: z.record(z.string(), z.number()).default({}),
});
export type ConversionParams = z.infer<typeof ConversionParamsSchema>;

export const GoalSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetAmount: z.number().nonnegative(),
  targetYear: z.number().int(),
  priority: z.enum(['Essential', 'Important', 'Aspirational']),
  fundingMode: z.enum(['external', 'from-plan', 'aspirational']),
  externalAccount: z.object({
    currentBalance: z.number().nonnegative(),
    monthlyContribution: z.number().nonnegative(),
    expectedReturn: z.number(),
  }).optional(),
});
export type Goal = z.infer<typeof GoalSchema>;

export const PlanSchema = z.object({
  personA: PersonSchema,
  personB: PersonSchema.optional(),
  assumptions: AssumptionsSchema,
  portfolio: PortfolioSchema,
  incomeStreams: z.array(IncomeStreamSchema).default([]),
  expenseStreams: z.array(ExpenseStreamSchema).default([]),
  withdrawalStrategy: z.enum(['taxfirst', 'rothfirst', 'tradfirst', 'proportional', 'bracketfill']),
  customPolicy: BlendPolicySchema.optional(),
  optimizedForGoal: z.enum(['max-end-balance', 'max-sustainable-spending', 'min-retirement-age']).optional(),
  conversion: ConversionParamsSchema,
  state: z.string().default('IL'),
  goals: z.array(GoalSchema).default([]),
});
export type Plan = z.infer<typeof PlanSchema>;

/** Blank starting plan — shown to new users. All values are placeholders to be replaced. */
export const defaultPlan = (): Plan => ({
  personA: {
    name: '',
    dob: '1975-01-01',
    retirementAge: 65,
    planToAge: 90,
    passingAge: 90,
    ssPIA: 0,
    ssClaimAge: 67,
  },
  personB: undefined,
  assumptions: {
    preRetReturn: 0.065,
    postRetReturn: 0.05,
    inflation: 0.025,
    contribGrowth: 0,
    rmdStartAge: 75,
    modelACA: false,
    acaHouseholdSize: 1,
    acaBenchmarkPremium: 0,
    acaNoSubsidy: false,
  },
  portfolio: {
    personA: {
      taxable: 0,
      traditional: 0,
      roth: 0,
      annualContribution: 0,
      contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 },
    },
    personB: undefined,
  },
  incomeStreams: [],
  expenseStreams: [],
  withdrawalStrategy: 'taxfirst',
  conversion: {
    mode: 'off',
    startAge: 65,
    endAge: 72,
    autoAmount: 70000,
    bracketCeiling: 96950,
    manualSchedule: {},
  },
  state: 'IL',
  goals: [],
});

/** Rich sample plan used by tests that need a fully-configured plan with realistic data. */
export const samplePlan = (): Plan => ({
  personA: {
    name: 'Person A',
    dob: '1974-05-03',
    retirementAge: 59,
    planToAge: 98,
    passingAge: 100,
    ssPIA: 44000,
    ssClaimAge: 70,
  },
  personB: {
    name: 'Person B',
    dob: '1977-08-26',
    retirementAge: 56,
    planToAge: 98,
    passingAge: 100,
    ssPIA: 18000,
    ssClaimAge: 62,
  },
  assumptions: {
    preRetReturn: 0.065,
    postRetReturn: 0.05,
    inflation: 0.025,
    contribGrowth: 0,
    rmdStartAge: 75,
    modelACA: false,
    acaHouseholdSize: 2,
    acaBenchmarkPremium: 0,
    acaNoSubsidy: false,
  },
  portfolio: {
    personA: {
      taxable: 271000,
      traditional: 779000,
      roth: 441000,
      annualContribution: 60000,
      contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 },
    },
    personB: {
      taxable: 315000,
      traditional: 106000,
      roth: 171000,
      annualContribution: 40000,
      contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 },
    },
  },
  incomeStreams: [
    { id: 'stream-ss-a', description: 'Person A SS', whose: 'A', type: 'SS', startAge: 70, stopAge: 98, annualAmount: 55000, growthPct: 0.025, taxablePct: 1 },
    { id: 'stream-ss-b-early', description: 'Person B SS early', whose: 'B', type: 'SS', startAge: 62, stopAge: 67, annualAmount: 12000, growthPct: 0.025, taxablePct: 1 },
    { id: 'stream-ss-b-late', description: 'Person B SS late', whose: 'B', type: 'SS', startAge: 68, stopAge: 98, annualAmount: 15000, growthPct: 0.025, taxablePct: 1 },
  ],
  expenseStreams: [
    { id: 'core', description: 'Core Household Spending', whose: 'Household', startAge: 59, stopAge: 98, annualAmount: 150000, inflationPct: 0.025 },
  ],
  withdrawalStrategy: 'taxfirst',
  conversion: {
    mode: 'off',
    startAge: 65,
    endAge: 72,
    autoAmount: 70000,
    bracketCeiling: 96950,
    manualSchedule: {},
  },
  state: 'IL',
  goals: [],
});
