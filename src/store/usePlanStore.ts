import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Plan, Person, Assumptions, PersonPortfolio, IncomeStream, ExpenseStream, ConversionParams, Goal } from '../schemas/plan';
import type { BlendPolicy } from '../engine/blendPolicy';
import { defaultPlan } from '../schemas/plan';
import { runProjection, type ProjectionResult } from '../engine/projection';
import type { Scenario } from '../engine/scenario';
import { defaultScenarios } from '../engine/scenario';
import { useWhatIfStore, applyWhatIf } from './useWhatIfStore';
import { disposeEngineWorker } from '../engine/workerClient';

export type DisplayMode = 'real' | 'nominal';

interface PlanState {
  plan: Plan;
  scenarios: Scenario[];
  displayMode: DisplayMode;
  setupDismissed: boolean;
  setSetupDismissed: (v: boolean) => void;
  setDisplayMode: (m: DisplayMode) => void;
  addScenario: (s: Scenario) => void;
  updateScenario: (id: string, patch: Partial<Scenario>) => void;
  removeScenario: (id: string) => void;
  resetScenarios: () => void;
  setPersonA: (patch: Partial<Person>) => void;
  setPersonB: (patch: Partial<Person>) => void;
  setAssumptions: (patch: Partial<Assumptions>) => void;
  setPersonAPortfolio: (patch: Partial<PersonPortfolio>) => void;
  setPersonBPortfolio: (patch: Partial<PersonPortfolio>) => void;
  setIncomeStreams: (streams: IncomeStream[]) => void;
  addIncomeStream: (s: IncomeStream) => void;
  updateIncomeStream: (id: string, patch: Partial<IncomeStream>) => void;
  removeIncomeStream: (id: string) => void;
  setExpenseStreams: (streams: ExpenseStream[]) => void;
  addExpenseStream: (s: ExpenseStream) => void;
  updateExpenseStream: (id: string, patch: Partial<ExpenseStream>) => void;
  removeExpenseStream: (id: string) => void;
  addPersonB: () => void;
  removePersonB: () => void;
  setWithdrawalStrategy: (s: Plan['withdrawalStrategy']) => void;
  setCustomPolicy: (policy: BlendPolicy) => void;
  /** Apply an entire next plan produced by applyResultToPlan (optimizer Apply).
   *  Atomic — sets customPolicy + optimizedForGoal + any mutated expense / personA / personB fields in one go. */
  applyOptimizerResult: (next: Plan) => void;
  clearCustomPolicy: () => void;
  setConversion: (patch: Partial<ConversionParams>) => void;
  setState: (state: string) => void;
  addGoal: (g: Goal) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  resetPlan: () => void;
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      plan: defaultPlan(),
      scenarios: defaultScenarios(),
      displayMode: 'real',
      setupDismissed: false,
      setSetupDismissed: (setupDismissed) => set({ setupDismissed }),
      setDisplayMode: (displayMode) => set({ displayMode }),
      addScenario: (s) => set((st) => ({ scenarios: [...st.scenarios, s] })),
      updateScenario: (id, patch) => set((st) => ({ scenarios: st.scenarios.map((x) => x.id === id ? { ...x, ...patch } : x) })),
      removeScenario: (id) => set((st) => ({ scenarios: st.scenarios.filter((x) => x.id !== id) })),
      resetScenarios: () => set({ scenarios: defaultScenarios() }),
      setPersonA: (patch) => set((s) => ({ plan: { ...s.plan, personA: { ...s.plan.personA, ...patch }, ...('retirementAge' in patch ? { basePersonA: undefined, basePersonB: undefined } : {}) } })),
      setPersonB: (patch) => set((s) => ({ plan: { ...s.plan, personB: s.plan.personB ? { ...s.plan.personB, ...patch } : undefined, ...('retirementAge' in patch ? { basePersonA: undefined, basePersonB: undefined } : {}) } })),
      addPersonB: () => set((s) => ({
        plan: {
          ...s.plan,
          personB: { name: 'Person B', dob: '1975-01-01', retirementAge: 65, planToAge: 90, passingAge: 90, ssPIA: 0, ssClaimAge: 67 },
          portfolio: { ...s.plan.portfolio, personB: { taxable: 0, traditional: 0, roth: 0, annualContribution: 0, contribGrowth: 0, contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 } } },
        },
      })),
      removePersonB: () => set((s) => ({
        plan: { ...s.plan, personB: undefined, portfolio: { ...s.plan.portfolio, personB: undefined } },
      })),
      setAssumptions: (patch) => set((s) => ({ plan: { ...s.plan, assumptions: { ...s.plan.assumptions, ...patch } } })),
      setPersonAPortfolio: (patch) => set((s) => ({
        plan: { ...s.plan, portfolio: { ...s.plan.portfolio, personA: { ...s.plan.portfolio.personA, ...patch } } },
      })),
      setPersonBPortfolio: (patch) => set((s) => ({
        plan: { ...s.plan, portfolio: { ...s.plan.portfolio, personB: s.plan.portfolio.personB ? { ...s.plan.portfolio.personB, ...patch } : undefined } },
      })),
      setIncomeStreams: (incomeStreams) => set((s) => ({ plan: { ...s.plan, incomeStreams } })),
      addIncomeStream: (stream) => set((s) => ({ plan: { ...s.plan, incomeStreams: [...s.plan.incomeStreams, stream] } })),
      updateIncomeStream: (id, patch) => set((s) => ({
        plan: { ...s.plan, incomeStreams: s.plan.incomeStreams.map(x => x.id === id ? { ...x, ...patch } : x) },
      })),
      removeIncomeStream: (id) => set((s) => ({ plan: { ...s.plan, incomeStreams: s.plan.incomeStreams.filter(x => x.id !== id) } })),
      setExpenseStreams: (expenseStreams) => set((s) => ({ plan: { ...s.plan, expenseStreams, baseExpenseStreams: undefined, solvedSpendingMultiplier: undefined } })),
      addExpenseStream: (stream) => set((s) => ({ plan: { ...s.plan, expenseStreams: [...s.plan.expenseStreams, stream], baseExpenseStreams: undefined, solvedSpendingMultiplier: undefined } })),
      updateExpenseStream: (id, patch) => set((s) => ({
        plan: { ...s.plan, expenseStreams: s.plan.expenseStreams.map(x => x.id === id ? { ...x, ...patch } : x), baseExpenseStreams: undefined, solvedSpendingMultiplier: undefined },
      })),
      removeExpenseStream: (id) => set((s) => ({ plan: { ...s.plan, expenseStreams: s.plan.expenseStreams.filter(x => x.id !== id), baseExpenseStreams: undefined, solvedSpendingMultiplier: undefined } })),
      setWithdrawalStrategy: (withdrawalStrategy) => set((s) => ({
        plan: { ...s.plan, withdrawalStrategy, customPolicy: undefined },
      })),
      setCustomPolicy: (policy) => set((s) => ({ plan: { ...s.plan, customPolicy: policy } })),
      applyOptimizerResult: (next) => set(() => ({ plan: next })),
      clearCustomPolicy: () => set((s) => ({ plan: { ...s.plan, customPolicy: undefined } })),
      setConversion: (patch) => set((s) => ({ plan: { ...s.plan, conversion: { ...s.plan.conversion, ...patch } } })),
      setState: (state) => set((s) => ({ plan: { ...s.plan, state } })),
      addGoal: (g) => set((s) => ({ plan: { ...s.plan, goals: [...(s.plan.goals ?? []), g] } })),
      updateGoal: (id, patch) => set((s) => ({ plan: { ...s.plan, goals: (s.plan.goals ?? []).map((x) => x.id === id ? { ...x, ...patch } : x) } })),
      removeGoal: (id) => set((s) => ({ plan: { ...s.plan, goals: (s.plan.goals ?? []).filter((x) => x.id !== id) } })),
      resetPlan: () => { disposeEngineWorker(); set({ plan: defaultPlan() }); },
    }),
    {
      name: 'fireopt-plan-v1',
      version: 7,
      migrate: (persistedState: unknown, fromVersion: number) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState as PlanState;
        const ps = persistedState as Record<string, unknown> & { plan?: Record<string, unknown> };
        // v7: replace preRetReturn/postRetReturn with per-bucket taxableReturn/tradReturn/rothReturn.
        // Remove any income streams with removed types Wages/Rental.
        if (fromVersion < 7 && ps.plan && typeof ps.plan === 'object') {
          const planObj = ps.plan as Record<string, unknown>;
          const asm = planObj.assumptions as Record<string, unknown> | undefined;
          if (asm) {
            const pre = typeof asm.preRetReturn === 'number' ? asm.preRetReturn : 0.065;
            const post = typeof asm.postRetReturn === 'number' ? asm.postRetReturn : 0.05;
            if (!('taxableReturn' in asm)) asm.taxableReturn = pre;
            if (!('tradReturn' in asm)) asm.tradReturn = pre;
            if (!('rothReturn' in asm)) asm.rothReturn = post;
            delete asm.preRetReturn;
            delete asm.postRetReturn;
          }
          const streams = planObj.incomeStreams;
          if (Array.isArray(streams)) {
            planObj.incomeStreams = streams.filter((s: Record<string, unknown>) => s.type !== 'Wages' && s.type !== 'Rental');
          }
        }
        // v6: equityPct (stock/bond split) added to assumptions for Monte Carlo.
        if (fromVersion < 6 && ps.plan && typeof ps.plan === 'object') {
          const asm = (ps.plan as Record<string, unknown>).assumptions as Record<string, unknown> | undefined;
          if (asm && !('equityPct' in asm)) asm.equityPct = 0.6;
        }
        // v5: contribGrowth moved from assumptions (household-wide) to each person's
        // portfolio. Copy the old single value onto both people so projections are
        // unchanged; persisted plans without it would otherwise yield NaN factors.
        if (fromVersion < 5 && ps.plan && typeof ps.plan === 'object') {
          const planObj = ps.plan as Record<string, unknown>;
          const asm = planObj.assumptions as Record<string, unknown> | undefined;
          const oldCg = asm && typeof asm.contribGrowth === 'number' ? asm.contribGrowth : 0;
          const pf = planObj.portfolio as { personA?: Record<string, unknown>; personB?: Record<string, unknown> } | undefined;
          if (pf?.personA && typeof pf.personA === 'object' && !('contribGrowth' in pf.personA)) pf.personA.contribGrowth = oldCg;
          if (pf?.personB && typeof pf.personB === 'object' && !('contribGrowth' in pf.personB)) pf.personB.contribGrowth = oldCg;
          if (asm && 'contribGrowth' in asm) delete asm.contribGrowth;
        }
        if (fromVersion < 4 && ps.plan && typeof ps.plan === 'object') {
          const assumptions = (ps.plan as Record<string, unknown>).assumptions as Record<string, unknown> | undefined;
          if (assumptions) {
            if (!('modelACA' in assumptions)) assumptions.modelACA = false;
            if (!('acaHouseholdSize' in assumptions)) assumptions.acaHouseholdSize = 2;
            if (!('acaBenchmarkPremium' in assumptions)) assumptions.acaBenchmarkPremium = 0;
            if (!('acaNoSubsidy' in assumptions)) assumptions.acaNoSubsidy = false;
          }
        }
        if (fromVersion < 3 && ps.plan && typeof ps.plan === 'object' && !Array.isArray((ps.plan as Record<string, unknown>).goals)) {
          (ps.plan as Record<string, unknown>).goals = [];
        }
        if (fromVersion < 2 && ps.plan && typeof ps.plan === 'object') {
          const oldPf = (ps.plan.portfolio ?? {}) as Record<string, number>;
          // Only migrate if it looks like the v1 flat shape
          if ('taxable' in oldPf || 'splitTaxable' in oldPf) {
            const split = {
              taxable: typeof oldPf.splitTaxable === 'number' ? oldPf.splitTaxable : 0.2,
              traditional: typeof oldPf.splitTraditional === 'number' ? oldPf.splitTraditional : 0.4,
              roth: typeof oldPf.splitRoth === 'number' ? oldPf.splitRoth : 0.4,
            };
            ps.plan.portfolio = {
              personA: {
                taxable: oldPf.taxable ?? 0,
                traditional: oldPf.traditional ?? 0,
                roth: oldPf.roth ?? 0,
                annualContribution: oldPf.contribA ?? 0,
                contribSplit: split,
              },
              personB: ps.plan.personB
                ? {
                    taxable: 0,
                    traditional: 0,
                    roth: 0,
                    annualContribution: oldPf.contribB ?? 0,
                    contribSplit: split,
                  }
                : undefined,
            };
          }
        }
        if (!('displayMode' in ps)) ps.displayMode = 'real';
        return ps as unknown as PlanState;
      },
    }
  )
);

/** Selector hook — returns a memoized projection result, re-run on every plan change.
 *  Engine is fast (~1-5ms per full 75y run), so we just run on every render.
 *
 *  Honors transient what-if overrides from `useWhatIfStore`: when the bar is active
 *  and any override is set, the projection is run against the overlaid plan instead.
 *  The saved plan in usePlanStore is never mutated. */
export function useProjection(): ProjectionResult {
  const plan = usePlanStore((s) => s.plan);
  const whatIf = useWhatIfStore();
  const effective = applyWhatIf(plan, whatIf);
  return runProjection(effective);
}
