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
      rmdStartAge: 75,
    },
    portfolio: {
      personA: {
        taxable: 240000,
        traditional: 420000,
        roth: 110000,
        annualContribution: 23000,
        contribGrowth: 0.03,
        contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 },
      },
      personB: {
        taxable: 180000,
        traditional: 260000,
        roth: 75000,
        annualContribution: 18000,
        contribGrowth: 0.03,
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
        contribGrowth: 0.03,
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
        contribGrowth: p.portfolio.personA.contribGrowth,
        contribSplit: p.portfolio.personA.contribSplit,
      },
      personB: {
        taxable: 250000,
        traditional: 500000,
        roth: 100000,
        annualContribution: p.portfolio.personB?.annualContribution ?? 0,
        contribGrowth: p.portfolio.personB?.contribGrowth ?? 0,
        contribSplit: p.portfolio.personB?.contribSplit ?? { taxable: 0.2, traditional: 0.4, roth: 0.4 },
      },
    },
    conversion: { mode: 'bracket-fill', startAge: 60, endAge: 73, autoAmount: 70000, bracketCeiling: 96950, manualSchedule: {} },
    withdrawalStrategy: 'taxfirst',
    state: 'IL',
  };
}

/** Single FIRE: retire at 45, no SS until 70, mostly taxable bucket (bridge period). */
export function planD_singleFIRE(): Plan {
  const p = goldenBase();
  return {
    ...p,
    personA: { ...p.personA, name: 'FIRE Solo', dob: '1985-01-01', retirementAge: 45, planToAge: 95, passingAge: 92, ssPIA: 32000, ssClaimAge: 70 },
    personB: undefined,
    assumptions: { ...p.assumptions, preRetReturn: 0.07, postRetReturn: 0.05 },
    portfolio: {
      personA: {
        taxable: 800000,
        traditional: 250000,
        roth: 150000,
        annualContribution: 60000,
        contribGrowth: 0.03,
        contribSplit: { taxable: 0.5, traditional: 0.25, roth: 0.25 },
      },
      personB: undefined,
    },
    expenseStreams: [
      { id: 'core', description: 'FIRE Core', whose: 'A', startAge: 45, stopAge: 95, annualAmount: 55000, inflationPct: 0.025 },
    ],
    withdrawalStrategy: 'taxfirst',
    state: 'TX',
  };
}

/** All-Roth couple: no RMD problem, conversion mostly a no-op. */
export function planE_allRothCouple(): Plan {
  const p = goldenBase();
  return {
    ...p,
    portfolio: {
      personA: {
        taxable: 0,
        traditional: 0,
        roth: 1_200_000,
        annualContribution: 14000,
        contribGrowth: 0.03,
        contribSplit: { taxable: 0, traditional: 0, roth: 1 },
      },
      personB: {
        taxable: 0,
        traditional: 0,
        roth: 800_000,
        annualContribution: 14000,
        contribGrowth: 0.03,
        contribSplit: { taxable: 0, traditional: 0, roth: 1 },
      },
    },
    withdrawalStrategy: 'rothfirst',
    state: 'IL',
  };
}

/** All-Trad couple: severe RMD problem, bracket-fill conversions valuable. */
export function planF_allTradCouple(): Plan {
  const p = goldenBase();
  return {
    ...p,
    portfolio: {
      personA: {
        taxable: 0,
        traditional: 1_800_000,
        roth: 0,
        annualContribution: 23000,
        contribGrowth: 0.03,
        contribSplit: { taxable: 0, traditional: 1, roth: 0 },
      },
      personB: {
        taxable: 0,
        traditional: 900_000,
        roth: 0,
        annualContribution: 18000,
        contribGrowth: 0.03,
        contribSplit: { taxable: 0, traditional: 1, roth: 0 },
      },
    },
    conversion: { mode: 'bracket-fill', startAge: 65, endAge: 74, autoAmount: 80000, bracketCeiling: 96950, manualSchedule: {} },
    withdrawalStrategy: 'taxfirst',
    state: 'IL',
  };
}

/** CA resident: state taxes both retirement distributions and conversions at ~8%. */
export function planG_californiaCouple(): Plan {
  const p = goldenBase();
  return {
    ...p,
    portfolio: {
      personA: { taxable: 400000, traditional: 800000, roth: 200000, annualContribution: 23000, contribGrowth: 0.03, contribSplit: { taxable: 0.3, traditional: 0.35, roth: 0.35 } },
      personB: { taxable: 300000, traditional: 500000, roth: 120000, annualContribution: 18000, contribGrowth: 0.03, contribSplit: { taxable: 0.3, traditional: 0.35, roth: 0.35 } },
    },
    conversion: { mode: 'bracket-fill', startAge: 65, endAge: 73, autoAmount: 60000, bracketCeiling: 96950, manualSchedule: {} },
    withdrawalStrategy: 'taxfirst',
    state: 'CA',
  };
}

/** Survivor mid-plan: personB passes at 75 (=year 12), MFJ→Single transition with 2-year window. */
export function planH_survivorMidPlan(): Plan {
  const p = goldenBase();
  return {
    ...p,
    personA: { ...p.personA, planToAge: 95, passingAge: 92 },
    personB: { ...p.personB!, planToAge: 95, passingAge: 75 },
    portfolio: {
      personA: { taxable: 300000, traditional: 500000, roth: 150000, annualContribution: 23000, contribGrowth: 0.03, contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 } },
      personB: { taxable: 200000, traditional: 300000, roth: 100000, annualContribution: 18000, contribGrowth: 0.03, contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 } },
    },
    withdrawalStrategy: 'taxfirst',
    state: 'IL',
  };
}

/** Multi-stream income: wages bridge to SS, pension partway through, rental. */
export function planI_multiStreamIncome(): Plan {
  const p = goldenBase();
  return {
    ...p,
    incomeStreams: [
      { id: 'ssa', description: 'SS A', whose: 'A', type: 'SS', startAge: 67, stopAge: 95, annualAmount: 32000, growthPct: 0.025, taxablePct: 1 },
      { id: 'ssb', description: 'SS B', whose: 'B', type: 'SS', startAge: 67, stopAge: 95, annualAmount: 22000, growthPct: 0.025, taxablePct: 1 },
      { id: 'pension', description: 'A Pension', whose: 'A', type: 'Pension', startAge: 65, stopAge: 95, annualAmount: 18000, growthPct: 0.01, taxablePct: 1 },
      { id: 'rental', description: 'Rental Net', whose: 'Household', type: 'Rental', startAge: 65, stopAge: 80, annualAmount: 12000, growthPct: 0.02, taxablePct: 1 },
    ],
    withdrawalStrategy: 'taxfirst',
    state: 'IL',
  };
}

/** Person B with zero balances: mirrors the user's real-world plan that surfaced our bugs. */
export function planJ_personBZeroBalance(): Plan {
  const p = goldenBase();
  return {
    ...p,
    personA: { ...p.personA, dob: '1974-05-03', retirementAge: 58, planToAge: 100, passingAge: 90, ssPIA: 45000, ssClaimAge: 70 },
    personB: { ...p.personB!, dob: '1977-08-26', retirementAge: 55, planToAge: 100, passingAge: 92, ssPIA: 28000, ssClaimAge: 62 },
    assumptions: { ...p.assumptions, preRetReturn: 0.08, postRetReturn: 0.05, inflation: 0.025 },
    portfolio: {
      personA: { taxable: 585000, traditional: 885000, roth: 615000, annualContribution: 60000, contribGrowth: 0, contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 } },
      personB: { taxable: 0, traditional: 0, roth: 0, annualContribution: 40000, contribGrowth: 0, contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 } },
    },
    expenseStreams: [
      { id: 'core', description: 'Core', whose: 'Household', startAge: 59, stopAge: 100, annualAmount: 150000, inflationPct: 0.025 },
    ],
    incomeStreams: [
      { id: 'ssa', description: 'SS A', whose: 'A', type: 'SS', startAge: 70, stopAge: 100, annualAmount: 55000, growthPct: 0.025, taxablePct: 1 },
      { id: 'ssb1', description: 'SS B early', whose: 'B', type: 'SS', startAge: 62, stopAge: 67, annualAmount: 12000, growthPct: 0.025, taxablePct: 1 },
      { id: 'ssb2', description: 'SS B FRA', whose: 'B', type: 'SS', startAge: 67, stopAge: 100, annualAmount: 15000, growthPct: 0.025, taxablePct: 1 },
    ],
    withdrawalStrategy: 'taxfirst',
    conversion: { mode: 'off', startAge: 65, endAge: 72, autoAmount: 70000, bracketCeiling: 206700, manualSchedule: {} },
    state: 'IL',
  };
}
