import fc from 'fast-check';
import type { Plan } from '../../schemas/plan';

/**
 * Plan-shape generators for property-based testing. The goal is to produce *valid*
 * plans (passes schema, no NaNs, no impossible age relationships) across a realistic
 * range of inputs — so the invariants and optimizer tests run on a wide cross-section
 * of plan shapes, not just the hand-crafted goldens.
 */

const STATES = ['IL', 'CA', 'NY', 'TX', 'FL', 'WA'] as const;
const STRATEGIES: Plan['withdrawalStrategy'][] = ['taxfirst', 'rothfirst', 'tradfirst', 'proportional', 'bracketfill'];
const CONV_MODES: Plan['conversion']['mode'][] = ['off', 'manual', 'auto-window', 'bracket-fill'];
const STREAM_TYPES = ['SS', 'Pension', 'Wages', 'Rental', 'Annuity', 'Other'] as const;
const EXPENSE_WHO = ['A', 'B', 'Household'] as const;

/** A contribSplit that sums to exactly 1.0 (within float epsilon). */
const contribSplit = () =>
  fc.tuple(fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }), fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }))
    .map(([a, b]) => {
      // Map two uniform [0,1] values to a 3-component split via a stick-breaking process.
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      return { taxable: lo, traditional: hi - lo, roth: 1 - hi };
    });

const personPortfolio = () =>
  fc.record({
    taxable: fc.integer({ min: 0, max: 3_000_000 }),
    traditional: fc.integer({ min: 0, max: 3_000_000 }),
    roth: fc.integer({ min: 0, max: 2_000_000 }),
    annualContribution: fc.integer({ min: 0, max: 75_000 }),
    contribGrowth: fc.double({ min: 0, max: 0.04, noNaN: true, noDefaultInfinity: true }),
    contribSplit: contribSplit(),
  });

const incomeStream = () =>
  fc.record({
    id: fc.string({ minLength: 4, maxLength: 12 }).map((s) => `stream-${s}`),
    description: fc.constant('FuzzStream'),
    whose: fc.constantFrom('A', 'B', 'Household'),
    type: fc.constantFrom(...STREAM_TYPES),
    startAge: fc.integer({ min: 50, max: 75 }),
    stopAge: fc.integer({ min: 70, max: 100 }),
    annualAmount: fc.integer({ min: 0, max: 80_000 }),
    growthPct: fc.double({ min: 0, max: 0.04, noNaN: true, noDefaultInfinity: true }),
    taxablePct: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
  })
    .filter((s) => s.stopAge > s.startAge);

const expenseStream = () =>
  fc.record({
    id: fc.string({ minLength: 4, maxLength: 12 }).map((s) => `exp-${s}`),
    description: fc.constant('Spending'),
    whose: fc.constantFrom(...EXPENSE_WHO),
    startAge: fc.integer({ min: 45, max: 80 }),
    stopAge: fc.integer({ min: 75, max: 105 }),
    annualAmount: fc.integer({ min: 20_000, max: 200_000 }),
    inflationPct: fc.double({ min: 0, max: 0.05, noNaN: true, noDefaultInfinity: true }),
  })
    .filter((e) => e.stopAge > e.startAge);

/** Generate a valid Plan. Couples vs singles, varied states, varied returns and balances. */
export const arbPlan = (): fc.Arbitrary<Plan> =>
  fc.record({
    ageDeltaB: fc.integer({ min: -10, max: 10 }),                       // personB age relative to personA
    aRetireAge: fc.integer({ min: 50, max: 70 }),
    aPlanToAge: fc.integer({ min: 80, max: 105 }),
    aPassingAge: fc.integer({ min: 70, max: 100 }),
    aSsPIA: fc.integer({ min: 0, max: 55_000 }),
    aSsClaimAge: fc.integer({ min: 62, max: 70 }),
    bSsPIA: fc.integer({ min: 0, max: 55_000 }),
    bSsClaimAge: fc.integer({ min: 62, max: 70 }),
    preRetReturn: fc.double({ min: 0.02, max: 0.10, noNaN: true, noDefaultInfinity: true }),
    postRetReturn: fc.double({ min: 0.02, max: 0.08, noNaN: true, noDefaultInfinity: true }),
    inflation: fc.double({ min: 0.005, max: 0.05, noNaN: true, noDefaultInfinity: true }),
    pfA: personPortfolio(),
    pfB: personPortfolio(),
    hasPersonB: fc.boolean(),
    state: fc.constantFrom(...STATES),
    strategy: fc.constantFrom(...STRATEGIES),
    convMode: fc.constantFrom(...CONV_MODES),
    expense: expenseStream(),
    incomes: fc.array(incomeStream(), { minLength: 0, maxLength: 3 }),
  })
    .filter((s) => s.aPlanToAge > s.aRetireAge + 5)
    .filter((s) => s.aPassingAge >= 70)
    .map((s): Plan => {
      const aBirthYear = 1970;
      const bBirthYear = aBirthYear + s.ageDeltaB;
      const bRetire = Math.max(50, Math.min(70, s.aRetireAge - s.ageDeltaB));
      const bPlanTo = Math.max(s.aPlanToAge, 80);
      const bPassing = Math.max(70, Math.min(100, s.aPassingAge - 1));
      return {
        personA: {
          name: 'A',
          dob: `${aBirthYear}-01-01`,
          retirementAge: s.aRetireAge,
          planToAge: s.aPlanToAge,
          passingAge: Math.min(s.aPassingAge, s.aPlanToAge),
          ssPIA: s.aSsPIA,
          ssClaimAge: s.aSsClaimAge,
        },
        personB: s.hasPersonB
          ? {
              name: 'B',
              dob: `${bBirthYear}-01-01`,
              retirementAge: bRetire,
              planToAge: bPlanTo,
              passingAge: Math.min(bPassing, bPlanTo),
              ssPIA: s.bSsPIA,
              ssClaimAge: s.bSsClaimAge,
            }
          : undefined,
        assumptions: {
          preRetReturn: s.preRetReturn,
          postRetReturn: s.postRetReturn,
          inflation: s.inflation,
          equityPct: 0.6,
          rmdStartAge: 75,
          modelACA: false,
          acaHouseholdSize: 2,
          acaBenchmarkPremium: 0,
          acaNoSubsidy: false,
        },
        portfolio: {
          personA: s.pfA,
          personB: s.hasPersonB ? s.pfB : undefined,
        },
        incomeStreams: s.incomes,
        expenseStreams: [s.expense],
        withdrawalStrategy: s.strategy,
        conversion: {
          mode: s.convMode,
          startAge: 65,
          endAge: 73,
          autoAmount: 70_000,
          bracketCeiling: 96_950,
          manualSchedule: {},
        },
        state: s.state,
        goals: [],
      };
    });
