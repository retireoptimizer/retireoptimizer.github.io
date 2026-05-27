import type { Plan } from '../../schemas/plan';

/** Pinned baseline for the golden test suite. Decoupled from the user-facing defaultPlan()
 *  so cosmetic changes to default values don't invalidate the snapshots. */
function goldenBase(): Plan {
  return {
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
      personA: {
        taxable: 240000,
        traditional: 420000,
        roth: 110000,
        annualContribution: 23000,
        contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 },
      },
      personB: {
        taxable: 180000,
        traditional: 260000,
        roth: 75000,
        annualContribution: 18000,
        contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 },
      },
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
    goals: [],
  };
}

/** Default Clarity Wealth example couple — taxfirst, no conversions, IL. */
export function planA_simple(): Plan {
  return goldenBase();
}

/** Single high-Trad-balance person, taxfirst, IL — exercises RMD logic. */
export function planB_largeTradSingle(): Plan {
  const p = goldenBase();
  return {
    ...p,
    personA: { ...p.personA, name: 'Solo', planToAge: 95, ssClaimAge: 67, ssPIA: 38000 },
    personB: undefined,
    portfolio: {
      personA: {
        taxable: 200000,
        traditional: 1_400_000,
        roth: 100000,
        annualContribution: 18000,
        contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 },
      },
      personB: undefined,
    },
    expenseStreams: [
      { id: 'core', description: 'Core', whose: 'A', startAge: 65, stopAge: 95, annualAmount: 75000, inflationPct: 0.025 },
    ],
    withdrawalStrategy: 'taxfirst',
    state: 'IL',
  };
}

/** Couple with high balances + aggressive bracket-fill conversions. */
export function planC_bracketFillConv(): Plan {
  const p = goldenBase();
  return {
    ...p,
    portfolio: {
      personA: {
        taxable: 350000,
        traditional: 700000,
        roth: 150000,
        annualContribution: p.portfolio.personA.annualContribution,
        contribSplit: p.portfolio.personA.contribSplit,
      },
      personB: {
        taxable: 250000,
        traditional: 500000,
        roth: 100000,
        annualContribution: p.portfolio.personB?.annualContribution ?? 0,
        contribSplit: p.portfolio.personB?.contribSplit ?? { taxable: 0.2, traditional: 0.4, roth: 0.4 },
      },
    },
    conversion: { mode: 'bracket-fill', startAge: 60, endAge: 73, autoAmount: 70000, bracketCeiling: 96950, manualSchedule: {} },
    withdrawalStrategy: 'taxfirst',
    state: 'IL',
  };
}
