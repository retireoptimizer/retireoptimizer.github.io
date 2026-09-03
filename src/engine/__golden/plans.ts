import type { Plan } from '../../schemas/plan';

/** Pinned baseline for the golden test suite. Decoupled from the user-facing defaultPlan()
 *  so cosmetic changes to default values don't invalidate the snapshots. */
function goldenBase(): Plan {
  return {
    personA: {
      name: 'Person A',
      dob: '1973-01-01',
      retirementAge: 65,
      planThroughAge: 90,
      ssPIA: 45000,
      ssClaimAge: 67,
    },
    personB: {
      name: 'Person B',
      dob: '1975-01-01',
      retirementAge: 63,
      planThroughAge: 92,
      ssPIA: 28000,
      ssClaimAge: 67,
    },
    assumptions: {
      taxableReturn: 0.065,
      taxableDivYield: 0,
      taxableQualifiedPct: 0.80,
      taxableExemptYield: 0,
      taxableExemptStatePct: 1,
      taxableDistributePct: 0,
      taxAdjOrdRate: 0.22,
      taxAdjLtcgRate: 0.15,
      legacyTargetTaxAdjReal: 0,
      tradReturn: 0.065,
      rothReturn: 0.065,
      inflation: 0.025,
      equityPct: 0.6,
      modelACA: false,
      acaHouseholdSize: 2,
      acaBenchmarkPremium: 0,
      acaNoSubsidy: false,
    },
    portfolio: {
      personA: {
        taxable: 240000,
        taxableBasis: 120000,
        traditional: 420000,
        roth: 110000,
        annualContribution: 23000,
        contribGrowth: { mode: 'fixed', rate: 0.03 },
        contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 },
      },
      personB: {
        taxable: 180000,
        taxableBasis: 90000,
        traditional: 260000,
        roth: 75000,
        annualContribution: 18000,
        contribGrowth: { mode: 'fixed', rate: 0.03 },
        contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 },
      },
    },
    incomeStreams: [],
    expenseStreams: [
      { id: 'core', description: 'Core Household Spending', whose: 'Household', startAge: 65, end: { mode: 'age' as const, age: 95 }, survivorPct: 1, annualAmount: 95000, inflationPct: { mode: 'fixed', rate: 0.025 } },
      { id: 'health', description: 'Healthcare', whose: 'Household', startAge: 65, end: { mode: 'age' as const, age: 95 }, survivorPct: 1, annualAmount: 28000, inflationPct: { mode: 'fixed', rate: 0.048 } },
      { id: 'travel', description: 'Travel & Leisure', whose: 'Household', startAge: 65, end: { mode: 'age' as const, age: 82 }, survivorPct: 1, annualAmount: 18000, inflationPct: { mode: 'fixed', rate: 0.03 } },
    ],
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    conversion: {
      mode: 'off',
      startAge: 65,
      endAge: 72,
      autoAmount: 70000,
      bracketCeiling: 211400,
      manualSchedule: {},
      optimize: false,
    },
    state: 'IL',
    goals: [],
    lumpSumEvents: [],
    payTaxFromBrokerage: false,
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
    personA: { ...p.personA, name: 'Solo', planThroughAge: 95, ssClaimAge: 67, ssPIA: 38000 },
    personB: undefined,
    portfolio: {
      personA: {
        taxable: 200000,
        taxableBasis: 100000,
        traditional: 1_400_000,
        roth: 100000,
        annualContribution: 18000,
        contribGrowth: { mode: 'fixed', rate: 0.03 },
        contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 },
      },
      personB: undefined,
    },
    expenseStreams: [
      { id: 'core', description: 'Core', whose: 'A', startAge: 65, end: { mode: 'age' as const, age: 95 }, survivorPct: 1, annualAmount: 75000, inflationPct: { mode: 'fixed', rate: 0.025 } },
    ],
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
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
        taxableBasis: 175000,
        traditional: 700000,
        roth: 150000,
        annualContribution: p.portfolio.personA.annualContribution,
        contribGrowth: p.portfolio.personA.contribGrowth,
        contribSplit: p.portfolio.personA.contribSplit,
      },
      personB: {
        taxable: 250000,
        taxableBasis: 125000,
        traditional: 500000,
        roth: 100000,
        annualContribution: p.portfolio.personB?.annualContribution ?? 0,
        contribGrowth: p.portfolio.personB?.contribGrowth ?? { mode: 'fixed' as const, rate: 0 },
        contribSplit: p.portfolio.personB?.contribSplit ?? { taxable: 0.2, traditional: 0.4, roth: 0.4 },
      },
    },
    conversion: { mode: 'bracket-fill', startAge: 60, endAge: 73, autoAmount: 70000, bracketCeiling: 100800, manualSchedule: {}, optimize: false },
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    state: 'IL',
  };
}

/** Single FIRE: retire at 45, no SS until 70, mostly taxable bucket (bridge period). */
export function planD_singleFIRE(): Plan {
  const p = goldenBase();
  return {
    ...p,
    personA: { ...p.personA, name: 'FIRE Solo', dob: '1985-01-01', retirementAge: 45, planThroughAge: 92, ssPIA: 32000, ssClaimAge: 70 },
    personB: undefined,
    assumptions: { ...p.assumptions, taxableReturn: 0.07, tradReturn: 0.07, rothReturn: 0.07 },
    portfolio: {
      personA: {
        taxable: 800000,
        taxableBasis: 400000,
        traditional: 250000,
        roth: 150000,
        annualContribution: 60000,
        contribGrowth: { mode: 'fixed', rate: 0.03 },
        contribSplit: { taxable: 0.5, traditional: 0.25, roth: 0.25 },
      },
      personB: undefined,
    },
    expenseStreams: [
      { id: 'core', description: 'FIRE Core', whose: 'A', startAge: 45, end: { mode: 'age' as const, age: 95 }, survivorPct: 1, annualAmount: 55000, inflationPct: { mode: 'fixed', rate: 0.025 } },
    ],
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
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
        taxableBasis: 0,
        traditional: 0,
        roth: 1_200_000,
        annualContribution: 14000,
        contribGrowth: { mode: 'fixed', rate: 0.03 },
        contribSplit: { taxable: 0, traditional: 0, roth: 1 },
      },
      personB: {
        taxable: 0,
        taxableBasis: 0,
        traditional: 0,
        roth: 800_000,
        annualContribution: 14000,
        contribGrowth: { mode: 'fixed', rate: 0.03 },
        contribSplit: { taxable: 0, traditional: 0, roth: 1 },
      },
    },
    withdrawalStrategy: 'rothfirst',
    withdrawalBracketCeiling: 100800,
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
        taxableBasis: 0,
        traditional: 1_800_000,
        roth: 0,
        annualContribution: 23000,
        contribGrowth: { mode: 'fixed', rate: 0.03 },
        contribSplit: { taxable: 0, traditional: 1, roth: 0 },
      },
      personB: {
        taxable: 0,
        taxableBasis: 0,
        traditional: 900_000,
        roth: 0,
        annualContribution: 18000,
        contribGrowth: { mode: 'fixed', rate: 0.03 },
        contribSplit: { taxable: 0, traditional: 1, roth: 0 },
      },
    },
    conversion: { mode: 'bracket-fill', startAge: 65, endAge: 74, autoAmount: 80000, bracketCeiling: 100800, manualSchedule: {}, optimize: false },
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    state: 'IL',
  };
}

/** CA resident: state taxes both retirement distributions and conversions at ~8%. */
export function planG_californiaCouple(): Plan {
  const p = goldenBase();
  return {
    ...p,
    portfolio: {
      personA: { taxable: 400000, taxableBasis: 200000, traditional: 800000, roth: 200000, annualContribution: 23000, contribGrowth: { mode: 'fixed', rate: 0.03 }, contribSplit: { taxable: 0.3, traditional: 0.35, roth: 0.35 } },
      personB: { taxable: 300000, taxableBasis: 150000, traditional: 500000, roth: 120000, annualContribution: 18000, contribGrowth: { mode: 'fixed', rate: 0.03 }, contribSplit: { taxable: 0.3, traditional: 0.35, roth: 0.35 } },
    },
    conversion: { mode: 'bracket-fill', startAge: 65, endAge: 73, autoAmount: 60000, bracketCeiling: 100800, manualSchedule: {}, optimize: false },
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    state: 'CA',
  };
}

/** Survivor mid-plan: personB passes at 75 (=year 12), MFJ→Single transition with 2-year window. */
export function planH_survivorMidPlan(): Plan {
  const p = goldenBase();
  return {
    ...p,
    personA: { ...p.personA, planThroughAge: 92 },
    personB: { ...p.personB!, planThroughAge: 75 },
    portfolio: {
      personA: { taxable: 300000, taxableBasis: 150000, traditional: 500000, roth: 150000, annualContribution: 23000, contribGrowth: { mode: 'fixed', rate: 0.03 }, contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 } },
      personB: { taxable: 200000, taxableBasis: 100000, traditional: 300000, roth: 100000, annualContribution: 18000, contribGrowth: { mode: 'fixed', rate: 0.03 }, contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 } },
    },
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    state: 'IL',
  };
}

/** Multi-stream income: wages bridge to SS, pension partway through, rental. */
export function planI_multiStreamIncome(): Plan {
  const p = goldenBase();
  return {
    ...p,
    incomeStreams: [
      { id: 'ssa', description: 'SS A', whose: 'A', type: 'SS', startAge: 67, end: { mode: 'age' as const, age: 95 }, survivorPct: 0, annualAmount: 32000, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1 },
      { id: 'ssb', description: 'SS B', whose: 'B', type: 'SS', startAge: 67, end: { mode: 'age' as const, age: 95 }, survivorPct: 0, annualAmount: 22000, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1 },
      { id: 'pension', description: 'A Pension', whose: 'A', type: 'Pension', startAge: 65, end: { mode: 'age' as const, age: 95 }, survivorPct: 0, annualAmount: 18000, growthPct: { mode: 'fixed', rate: 0.01 }, taxablePct: 1, stateTaxablePct: 1 },
      { id: 'rental', description: 'Rental Net', whose: 'Household', type: 'Other', startAge: 65, end: { mode: 'age' as const, age: 80 }, survivorPct: 0, annualAmount: 12000, growthPct: { mode: 'fixed', rate: 0.02 }, taxablePct: 1, stateTaxablePct: 1 },
    ],
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    state: 'IL',
  };
}

/** Person B with zero balances: mirrors the user's real-world plan that surfaced our bugs. */
export function planJ_personBZeroBalance(): Plan {
  const p = goldenBase();
  return {
    ...p,
    personA: { ...p.personA, dob: '1974-05-03', retirementAge: 58, planThroughAge: 90, ssPIA: 45000, ssClaimAge: 70 },
    personB: { ...p.personB!, dob: '1977-08-26', retirementAge: 55, planThroughAge: 92, ssPIA: 28000, ssClaimAge: 62 },
    assumptions: { ...p.assumptions, taxableReturn: 0.08, tradReturn: 0.08, rothReturn: 0.08, inflation: 0.025 },
    portfolio: {
      personA: { taxable: 585000, taxableBasis: 292500, traditional: 885000, roth: 615000, annualContribution: 60000, contribGrowth: { mode: 'fixed', rate: 0 }, contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 } },
      personB: { taxable: 0, taxableBasis: 0, traditional: 0, roth: 0, annualContribution: 40000, contribGrowth: { mode: 'fixed', rate: 0 }, contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 } },
    },
    expenseStreams: [
      { id: 'core', description: 'Core', whose: 'Household', startAge: 59, end: { mode: 'age' as const, age: 100 }, survivorPct: 1, annualAmount: 150000, inflationPct: { mode: 'fixed', rate: 0.025 } },
    ],
    incomeStreams: [
      { id: 'ssa', description: 'SS A', whose: 'A', type: 'SS', startAge: 70, end: { mode: 'age' as const, age: 100 }, survivorPct: 0, annualAmount: 55000, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1 },
      { id: 'ssb1', description: 'SS B early', whose: 'B', type: 'SS', startAge: 62, end: { mode: 'age' as const, age: 67 }, survivorPct: 0, annualAmount: 12000, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1 },
      { id: 'ssb2', description: 'SS B FRA', whose: 'B', type: 'SS', startAge: 67, end: { mode: 'age' as const, age: 100 }, survivorPct: 0, annualAmount: 15000, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1 },
    ],
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    conversion: { mode: 'off', startAge: 65, endAge: 72, autoAmount: 70000, bracketCeiling: 211400, manualSchedule: {}, optimize: false },
    state: 'IL',
  };
}

/**
 * Wide age gap: A born 1968 (RMD start 75), B born 1957 (RMD start 73).
 * B is 11 years older — B reaches RMD age before A, and both survivor phases are tested.
 */
export function planK_wideAgeGap(): Plan {
  const p = goldenBase();
  return {
    ...p,
    personA: { ...p.personA, dob: '1968-03-15', retirementAge: 65, planThroughAge: 90 },
    personB: { ...p.personB!, dob: '1957-06-01', retirementAge: 65, planThroughAge: 88 },
    portfolio: {
      personA: { taxable: 200000, taxableBasis: 100000, traditional: 600000, roth: 0, annualContribution: 23000, contribGrowth: { mode: 'fixed', rate: 0.03 }, contribSplit: { taxable: 0.2, traditional: 0.8, roth: 0 } },
      personB: { taxable: 200000, taxableBasis: 100000, traditional: 500000, roth: 0, annualContribution: 18000, contribGrowth: { mode: 'fixed', rate: 0.03 }, contribSplit: { taxable: 0.2, traditional: 0.8, roth: 0 } },
    },
    conversion: { mode: 'off', startAge: 65, endAge: 72, autoAmount: 70000, bracketCeiling: 211400, manualSchedule: {}, optimize: false },
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    state: 'IL',
  };
}

/**
 * Survivor: A dies first at 80, B is the long survivor to 90.
 * A: born 1962 (RMD start 75), B: born 1960 (RMD start 73).
 * After A dies, tradA merges into tradB; B continues RMDs on the full merged balance.
 */
export function planL_survivorARMD(): Plan {
  const p = goldenBase();
  return {
    ...p,
    personA: { ...p.personA, dob: '1962-01-01', retirementAge: 65, planThroughAge: 80 },
    personB: { ...p.personB!, dob: '1960-01-01', retirementAge: 65, planThroughAge: 90 },
    portfolio: {
      personA: { taxable: 100000, taxableBasis: 50000, traditional: 400000, roth: 0, annualContribution: 23000, contribGrowth: { mode: 'fixed', rate: 0.03 }, contribSplit: { taxable: 0.1, traditional: 0.9, roth: 0 } },
      personB: { taxable: 100000, taxableBasis: 50000, traditional: 600000, roth: 0, annualContribution: 18000, contribGrowth: { mode: 'fixed', rate: 0.03 }, contribSplit: { taxable: 0.1, traditional: 0.9, roth: 0 } },
    },
    conversion: { mode: 'off', startAge: 65, endAge: 72, autoAmount: 70000, bracketCeiling: 211400, manualSchedule: {}, optimize: false },
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    state: 'IL',
  };
}

/**
 * Survivor: B dies first at 78, A is the long survivor to 90.
 * A: born 1960 (RMD start 73), B: born 1962 (RMD start 75).
 * After B dies, tradB merges into tradA; A continues RMDs on the full merged balance.
 */
export function planM_survivorBRMD(): Plan {
  const p = goldenBase();
  return {
    ...p,
    personA: { ...p.personA, dob: '1960-01-01', retirementAge: 65, planThroughAge: 90 },
    personB: { ...p.personB!, dob: '1962-01-01', retirementAge: 65, planThroughAge: 78 },
    portfolio: {
      personA: { taxable: 100000, taxableBasis: 50000, traditional: 600000, roth: 0, annualContribution: 23000, contribGrowth: { mode: 'fixed', rate: 0.03 }, contribSplit: { taxable: 0.1, traditional: 0.9, roth: 0 } },
      personB: { taxable: 100000, taxableBasis: 50000, traditional: 400000, roth: 0, annualContribution: 18000, contribGrowth: { mode: 'fixed', rate: 0.03 }, contribSplit: { taxable: 0.1, traditional: 0.9, roth: 0 } },
    },
    conversion: { mode: 'off', startAge: 65, endAge: 72, autoAmount: 70000, bracketCeiling: 211400, manualSchedule: {}, optimize: false },
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    state: 'IL',
  };
}

/**
 * Short-lived A: personA retires at 62 and dies at 68 — only 6 joint MFJ years.
 * Tests algorithms that can express "convert heavily before death then stop."
 * PersonB is long-lived to 95.
 */
export function planN_shortLivedA(): Plan {
  const p = goldenBase();
  return {
    ...p,
    personA: { ...p.personA, dob: '1963-01-01', retirementAge: 62, planThroughAge: 68, ssPIA: 42000, ssClaimAge: 67 },
    personB: { ...p.personB!, dob: '1966-01-01', retirementAge: 62, planThroughAge: 92, ssPIA: 26000, ssClaimAge: 67 },
    portfolio: {
      personA: { taxable: 250000, taxableBasis: 125000, traditional: 750000, roth: 100000, annualContribution: 23000, contribGrowth: { mode: 'fixed', rate: 0.03 }, contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 } },
      personB: { taxable: 180000, taxableBasis: 90000, traditional: 350000, roth: 80000, annualContribution: 18000, contribGrowth: { mode: 'fixed', rate: 0.03 }, contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 } },
    },
    incomeStreams: [],
    expenseStreams: [
      { id: 'core', description: 'Core Household Spending', whose: 'Household', startAge: 62, end: { mode: 'age' as const, age: 95 }, survivorPct: 1, annualAmount: 100000, inflationPct: { mode: 'fixed', rate: 0.025 } },
    ],
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    conversion: { mode: 'off', startAge: 62, endAge: 72, autoAmount: 70000, bracketCeiling: 100800, manualSchedule: {}, optimize: false },
    state: 'IL',
  };
}

/**
 * Large pension: personA has $75K/yr pension that partially crowds conversion bracket room.
 * Tests algorithms that correctly find smaller or zero conversions.
 */
export function planO_largePension(): Plan {
  const p = goldenBase();
  return {
    ...p,
    personA: { ...p.personA, dob: '1973-01-01', retirementAge: 65, planThroughAge: 90, ssPIA: 35000, ssClaimAge: 67 },
    personB: { ...p.personB!, dob: '1975-01-01', retirementAge: 63, planThroughAge: 92, ssPIA: 22000, ssClaimAge: 67 },
    portfolio: {
      personA: { taxable: 300000, taxableBasis: 150000, traditional: 400000, roth: 150000, annualContribution: 23000, contribGrowth: { mode: 'fixed', rate: 0.03 }, contribSplit: { taxable: 0.3, traditional: 0.3, roth: 0.4 } },
      personB: { taxable: 200000, taxableBasis: 100000, traditional: 250000, roth: 100000, annualContribution: 18000, contribGrowth: { mode: 'fixed', rate: 0.03 }, contribSplit: { taxable: 0.3, traditional: 0.3, roth: 0.4 } },
    },
    incomeStreams: [
      { id: 'pension', description: 'Federal Pension', whose: 'A', type: 'Pension', startAge: 65, end: { mode: 'age' as const, age: 95 }, survivorPct: 0, annualAmount: 75000, growthPct: { mode: 'fixed', rate: 0.01 }, taxablePct: 1, stateTaxablePct: 1 },
      { id: 'ssa', description: 'SS A', whose: 'A', type: 'SS', startAge: 67, end: { mode: 'age' as const, age: 95 }, survivorPct: 0, annualAmount: 35000, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1 },
      { id: 'ssb', description: 'SS B', whose: 'B', type: 'SS', startAge: 67, end: { mode: 'age' as const, age: 95 }, survivorPct: 0, annualAmount: 22000, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1 },
    ],
    expenseStreams: [
      { id: 'core', description: 'Core Household Spending', whose: 'Household', startAge: 65, end: { mode: 'age' as const, age: 95 }, survivorPct: 1, annualAmount: 95000, inflationPct: { mode: 'fixed', rate: 0.025 } },
      { id: 'health', description: 'Healthcare', whose: 'Household', startAge: 65, end: { mode: 'age' as const, age: 95 }, survivorPct: 1, annualAmount: 28000, inflationPct: { mode: 'fixed', rate: 0.048 } },
      { id: 'travel', description: 'Travel & Leisure', whose: 'Household', startAge: 65, end: { mode: 'age' as const, age: 82 }, survivorPct: 1, annualAmount: 18000, inflationPct: { mode: 'fixed', rate: 0.03 } },
    ],
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    conversion: { mode: 'off', startAge: 65, endAge: 72, autoAmount: 70000, bracketCeiling: 100800, manualSchedule: {}, optimize: false },
    state: 'IL',
  };
}

/**
 * Tight plan: portfolio is tight relative to spending — plan depletes around age 88–90.
 * Tests that conversion algorithms don't over-convert and accelerate depletion.
 */
export function planP_tightPlan(): Plan {
  const p = goldenBase();
  return {
    ...p,
    personA: { ...p.personA, dob: '1968-01-01', retirementAge: 62, planThroughAge: 90, ssPIA: 28000, ssClaimAge: 67 },
    personB: { ...p.personB!, dob: '1971-01-01', retirementAge: 60, planThroughAge: 92, ssPIA: 22000, ssClaimAge: 67 },
    assumptions: { taxableReturn: 0.055, taxableDivYield: 0, taxableQualifiedPct: 0.80, taxableExemptYield: 0, taxableExemptStatePct: 1, taxableDistributePct: 0, taxAdjOrdRate: 0.22, taxAdjLtcgRate: 0.15, legacyTargetTaxAdjReal: 0, tradReturn: 0.055, rothReturn: 0.055, inflation: 0.025, equityPct: 0.6, modelACA: false, acaHouseholdSize: 2, acaBenchmarkPremium: 0, acaNoSubsidy: false },
    portfolio: {
      personA: { taxable: 150000, taxableBasis: 75000, traditional: 450000, roth: 50000, annualContribution: 23000, contribGrowth: { mode: 'fixed', rate: 0 }, contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 } },
      personB: { taxable: 100000, taxableBasis: 50000, traditional: 300000, roth: 50000, annualContribution: 18000, contribGrowth: { mode: 'fixed', rate: 0 }, contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 } },
    },
    incomeStreams: [
      { id: 'ssa', description: 'SS A', whose: 'A', type: 'SS', startAge: 67, end: { mode: 'age' as const, age: 95 }, survivorPct: 0, annualAmount: 28000, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1 },
      { id: 'ssb', description: 'SS B', whose: 'B', type: 'SS', startAge: 67, end: { mode: 'age' as const, age: 95 }, survivorPct: 0, annualAmount: 22000, growthPct: { mode: 'cpi' }, taxablePct: 1, stateTaxablePct: 1 },
    ],
    expenseStreams: [
      { id: 'core', description: 'Core Household Spending', whose: 'Household', startAge: 62, end: { mode: 'age' as const, age: 95 }, survivorPct: 1, annualAmount: 130000, inflationPct: { mode: 'fixed', rate: 0.025 } },
    ],
    withdrawalStrategy: 'taxfirst',
    withdrawalBracketCeiling: 100800,
    conversion: { mode: 'off', startAge: 62, endAge: 72, autoAmount: 70000, bracketCeiling: 100800, manualSchedule: {}, optimize: false },
    state: 'IL',
  };
}
