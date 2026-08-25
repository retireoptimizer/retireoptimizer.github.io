import { z } from 'zod';
import { FED_BRACKETS_MFJ } from '../engine/taxConstants';

const BRACKET_12_TOP_MFJ = FED_BRACKETS_MFJ[1][0];

export const GrowthRateSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('cpi') }),
  z.object({ mode: z.literal('offset'), delta: z.number() }),
  z.object({ mode: z.literal('fixed'), rate: z.number() }),
]);
export type GrowthRate = z.infer<typeof GrowthRateSchema>;

export function resolveGrowthRate(gr: GrowthRate, inflation: number): number {
  if (gr.mode === 'cpi') return inflation;
  if (gr.mode === 'offset') return inflation + gr.delta;
  return gr.rate;
}

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
  /** Per-bucket expected annual growth rates. Replaces the old single preRetReturn/postRetReturn. */
  taxableReturn: z.number().default(0.055),
  /** Fraction of taxableReturn paid as dividends/interest each year (taxed annually, reinvested at cost basis). 0 = defer all gains until withdrawal. */
  taxableDivYield: z.number().min(0).max(1).default(0),
  /** Fraction of taxableDivYield that is qualified dividends (taxed at LTCG rates). Remainder is ordinary income. */
  taxableQualifiedPct: z.number().min(0).max(1).default(0.80),
  /** Fraction of the taxable balance paid as IRC §103 tax-exempt interest (munis held in the
   *  brokerage). Excluded from federal AGI but added back for SS provisional income, ACA MAGI,
   *  and IRMAA MAGI. Reinvested annually (adds to basis) like taxableDivYield. */
  taxableExemptYield: z.number().min(0).max(1).default(0),
  /** Share of taxableExemptYield interest taxable by the resident state.
   *  1 = out-of-state bonds (default); 0 = in-state / state-exempt. */
  taxableExemptStatePct: z.number().min(0).max(1).default(1),
  /** Share of the taxable account's annual yield (dividends + tax-exempt interest) paid out as
   *  spendable cash rather than reinvested. 0 = full DRIP (default); 1 = all yield swept to
   *  checking and spent before any shares are sold. Tax treatment is identical either way —
   *  this moves cash and cost basis, not taxable income. */
  taxableDistributePct: z.number().min(0).max(1).default(0),
  /** Blended effective rate assumed for pre-tax (401k/IRA) balances at liquidation.
   *  Applied to the entire traditional balance as a flat haircut — not a bracket calculation.
   *  Setting to 0 disables the tax-adjusted balance feature. */
  taxAdjOrdRate: z.number().min(0).max(0.6).default(0.22),
  /** Blended effective rate assumed for taxable unrealized gains at liquidation.
   *  Applied to gain above cost basis only — basis is already-taxed money and is untouched.
   *  Roth is never haircut. Setting to 0 along with taxAdjOrdRate disables tax-adjusted balance. */
  taxAdjLtcgRate: z.number().min(0).max(0.4).default(0.15),
  tradReturn: z.number().default(0.055),
  rothReturn: z.number().default(0.055),
  inflation: z.number(),
  /** Equity (stock) share of the portfolio, 0..1. Drives Monte Carlo stock/bond blend. */
  equityPct: z.number().min(0).max(1).default(0.6),
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
  /** Age at which Person A enters the ACA marketplace. Defaults to their retirement age.
   *  Set later than retirement age for COBRA or continued spouse/employer coverage. */
  acaStartAgeA: z.number().int().min(0).max(64).optional(),
  /** Age at which Person B enters the ACA marketplace. Defaults to their retirement age. */
  acaStartAgeB: z.number().int().min(0).max(64).optional(),
});
export type Assumptions = z.infer<typeof AssumptionsSchema>;

export const PersonPortfolioSchema = z.object({
  taxable: z.number().nonnegative(),
  taxableBasis: z.number().nonnegative().default(0),
  traditional: z.number().nonnegative(),
  roth: z.number().nonnegative(),
  annualContribution: z.number().nonnegative(),
  // Annual % growth of this person's contribution while still working (e.g. 0.03 = +3%/yr).
  contribGrowth: GrowthRateSchema.default({ mode: 'cpi' }),
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
  type: z.enum(['SS', 'Pension', 'Annuity', 'MuniBond', 'VA', 'Other']),
  startAge: z.number().int().min(0).max(110),
  stopAge: z.number().int().min(0).max(115),
  annualAmount: z.number().nonnegative(),
  growthPct: GrowthRateSchema,
  taxablePct: z.number().min(0).max(1),
  stateTaxablePct: z.number().min(0).max(1).default(1),
});
export type IncomeStream = z.infer<typeof IncomeStreamSchema>;

export const LumpSumEventSchema = z.object({
  id: z.string(),
  description: z.string(),
  whose: z.enum(['A', 'B', 'Household']),
  bucket: z.enum(['taxable', 'inheritedPreTaxIRA', 'inheritedRoth', 'inheritedHSA']),
  age: z.number().int().min(0).max(115),
  amount: z.number().nonnegative(),
});
export type LumpSumEvent = z.infer<typeof LumpSumEventSchema>;

export const ExpenseStreamSchema = z.object({
  id: z.string(),
  description: z.string(),
  whose: z.enum(['A', 'B', 'Household']),
  startAge: z.number().int().min(0).max(110),
  stopAge: z.number().int().min(0).max(115),
  annualAmount: z.number().nonnegative(),
  inflationPct: GrowthRateSchema,
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
  bracketCeiling: z.number().nonnegative().default(BRACKET_12_TOP_MFJ),
  manualSchedule: z.record(z.string(), z.number()).default({}),
  // When true (default), the optimizer freely searches Roth conversion amounts, overriding `mode`.
  // When false, the optimizer leaves conversions to `mode` (skips the conversion search dimension).
  optimize: z.boolean().default(true),
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
  lumpSumEvents: z.array(LumpSumEventSchema).default([]),
  expenseStreams: z.array(ExpenseStreamSchema).default([]),
  withdrawalStrategy: z.enum(['taxfirst', 'rothfirst', 'tradfirst', 'proportional', 'bracketfill']),
  withdrawalBracketCeiling: z.number().nonnegative().default(BRACKET_12_TOP_MFJ),
  customPolicy: BlendPolicySchema.optional(),
  optimizedForGoal: z.enum(['max-end-balance', 'max-sustainable-spending', 'min-retirement-age']).optional(),
  /** The multiplier solved by the last max-sustainable-spending run (e.g. 1.33 = 133%).
   *  Drives the What-If Bar spending slider default so it reflects the optimized level. */
  solvedSpendingMultiplier: z.number().optional(),
  conversion: ConversionParamsSchema,
  /** When true, taxes arising from IRA withdrawals are sourced from the brokerage (taxable)
   *  account first, rather than being bundled with spending in the withdrawal strategy.
   *  Degrades gracefully to default behavior when brokerage is depleted. */
  payTaxFromBrokerage: z.boolean().default(false),
  state: z.string().default('IL'),
  customStateTaxRate: z.number().min(0).max(0.5).optional(),
  goals: z.array(GoalSchema).default([]),
});
export type Plan = z.infer<typeof PlanSchema>;

/** Blank starting plan — shown to new users. All values are placeholders to be replaced. */
export const defaultPlan = (): Plan => ({
  personA: {
    name: 'Person A',
    dob: '1975-01-01',
    retirementAge: 65,
    planToAge: 90,
    passingAge: 90,
    ssPIA: 0,
    ssClaimAge: 67,
  },
  personB: undefined,
  assumptions: {
    taxableReturn: 0.055,
    taxableDivYield: 0,
    taxableQualifiedPct: 0.80,
    taxableExemptYield: 0,
    taxableExemptStatePct: 1,
    taxableDistributePct: 0,
    taxAdjOrdRate: 0.22,
    taxAdjLtcgRate: 0.15,
    tradReturn: 0.055,
    rothReturn: 0.055,
    inflation: 0.025,
    equityPct: 0.6,
    modelACA: false,
    acaHouseholdSize: 1,
    acaBenchmarkPremium: 0,
    acaNoSubsidy: false,
  },
  portfolio: {
    personA: {
      taxable: 0,
      taxableBasis: 0,
      traditional: 0,
      roth: 0,
      annualContribution: 0,
      contribGrowth: { mode: 'cpi' },
      contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 },
    },
    personB: undefined,
  },
  incomeStreams: [
    { id: 'stream-default-1', description: 'New Income Stream', whose: 'Household', type: 'Other', startAge: 65, stopAge: 90, annualAmount: 0, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1 },
  ],
  lumpSumEvents: [],
  expenseStreams: [
    { id: 'expense-default-1', description: 'New Expense', whose: 'Household', startAge: 65, stopAge: 90, annualAmount: 0, inflationPct: { mode: 'cpi' } },
  ],
  withdrawalStrategy: 'taxfirst',
  withdrawalBracketCeiling: BRACKET_12_TOP_MFJ,
  conversion: {
    mode: 'off',
    startAge: 65,
    endAge: 72,
    autoAmount: 70000,
    bracketCeiling: BRACKET_12_TOP_MFJ,
    manualSchedule: {},
    optimize: true,
  },
  payTaxFromBrokerage: false,
  state: 'NONE',
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
    taxableReturn: 0.055,
    taxableDivYield: 0,
    taxableQualifiedPct: 0.80,
    taxableExemptYield: 0,
    taxableExemptStatePct: 1,
    taxableDistributePct: 0,
    taxAdjOrdRate: 0.22,
    taxAdjLtcgRate: 0.15,
    tradReturn: 0.055,
    rothReturn: 0.055,
    inflation: 0.025,
    equityPct: 0.6,
    modelACA: false,
    acaHouseholdSize: 2,
    acaBenchmarkPremium: 0,
    acaNoSubsidy: false,
  },
  portfolio: {
    personA: {
      taxable: 271000,
      taxableBasis: 135500,
      traditional: 779000,
      roth: 441000,
      annualContribution: 60000,
      contribGrowth: { mode: 'cpi' },
      contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 },
    },
    personB: {
      taxable: 315000,
      taxableBasis: 157500,
      traditional: 106000,
      roth: 171000,
      annualContribution: 40000,
      contribGrowth: { mode: 'cpi' },
      contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 },
    },
  },
  lumpSumEvents: [],
  incomeStreams: [
    { id: 'stream-ss-a', description: 'Person A SS', whose: 'A', type: 'SS', startAge: 70, stopAge: 98, annualAmount: 55000, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1 },
    { id: 'stream-ss-b-early', description: 'Person B SS early', whose: 'B', type: 'SS', startAge: 62, stopAge: 67, annualAmount: 12000, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1 },
    { id: 'stream-ss-b-late', description: 'Person B SS late', whose: 'B', type: 'SS', startAge: 68, stopAge: 98, annualAmount: 15000, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1 },
  ],
  expenseStreams: [
    { id: 'core', description: 'Core Household Spending', whose: 'Household', startAge: 59, stopAge: 98, annualAmount: 150000, inflationPct: { mode: 'cpi' } },
  ],
  withdrawalStrategy: 'taxfirst',
  withdrawalBracketCeiling: BRACKET_12_TOP_MFJ,
  conversion: {
    mode: 'off',
    startAge: 65,
    endAge: 72,
    autoAmount: 70000,
    bracketCeiling: BRACKET_12_TOP_MFJ,
    manualSchedule: {},
    optimize: true,
  },
  payTaxFromBrokerage: false,
  state: 'IL',
  goals: [],
});
