import type { Plan } from '../schemas/plan';
import { defaultPlan, householdTotals } from '../schemas/plan';

export type SetupStepKey = 'personal' | 'portfolio' | 'income' | 'expenses' | 'strategy';

export interface SetupStep {
  key: SetupStepKey;
  label: string;
  route: string;
  done: boolean;
  hint?: string;
}

/** Evaluates which onboarding steps remain. A step is considered "done" when its
 *  section differs from the default-plan starting state — i.e. the user has
 *  meaningfully customized it. The default plan ships with demo data, so deep
 *  equality vs defaults is how we detect a fresh, untouched plan. */
export function evaluateSetup(plan: Plan): SetupStep[] {
  const dp = defaultPlan();

  const personSame =
    plan.personA.name === dp.personA.name &&
    plan.personA.dob === dp.personA.dob &&
    plan.personA.retirementAge === dp.personA.retirementAge &&
    plan.personA.planToAge === dp.personA.planToAge &&
    plan.personA.ssPIA === dp.personA.ssPIA;

  const totals = householdTotals(plan.portfolio);
  const dpTotals = householdTotals(dp.portfolio);
  const portfolioSame =
    totals.taxable === dpTotals.taxable &&
    totals.traditional === dpTotals.traditional &&
    totals.roth === dpTotals.roth &&
    totals.contribA === dpTotals.contribA &&
    totals.contribB === dpTotals.contribB;

  const incomeSame =
    plan.incomeStreams.length === dp.incomeStreams.length &&
    plan.incomeStreams.every((s, i) =>
      s.description === dp.incomeStreams[i]?.description &&
      s.annualAmount === dp.incomeStreams[i]?.annualAmount &&
      s.startAge === dp.incomeStreams[i]?.startAge
    );

  const expensesSame =
    plan.expenseStreams.length === dp.expenseStreams.length &&
    plan.expenseStreams.every((s, i) =>
      s.annualAmount === dp.expenseStreams[i]?.annualAmount &&
      s.inflationPct === dp.expenseStreams[i]?.inflationPct
    );

  const strategySame =
    plan.withdrawalStrategy === dp.withdrawalStrategy &&
    plan.conversion.mode === dp.conversion.mode &&
    !plan.customPolicy;

  return [
    {
      key: 'personal',
      label: 'Personal details',
      route: '/personal',
      done: !personSame,
      hint: 'Name, DOB, retirement age, SS',
    },
    {
      key: 'portfolio',
      label: 'Portfolio balances',
      route: '/portfolio',
      done: !portfolioSame,
      hint: 'Taxable, Pre-tax, Roth + contributions',
    },
    {
      key: 'income',
      label: 'Income streams',
      route: '/income',
      done: !incomeSame,
      hint: 'Pensions, wages, rental, annuities',
    },
    {
      key: 'expenses',
      label: 'Expenses',
      route: '/expenses',
      done: !expensesSame,
      hint: 'Core spending + healthcare',
    },
    {
      key: 'strategy',
      label: 'Strategy',
      route: '/strategy',
      done: !strategySame,
      hint: 'Withdrawal order + Roth conversions',
    },
  ];
}

export function setupCompletion(plan: Plan): { done: number; total: number } {
  const steps = evaluateSetup(plan);
  return { done: steps.filter((s) => s.done).length, total: steps.length };
}
