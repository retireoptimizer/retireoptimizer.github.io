import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Plan, Person, Assumptions, PersonPortfolio, IncomeStream, ExpenseStream, ConversionParams, Goal } from '../schemas/plan';
import type { BlendPolicy } from '../engine/blendPolicy';
import { defaultPlan } from '../schemas/plan';
import { runProjection, type ProjectionResult } from '../engine/projection';
import type { Scenario } from '../engine/scenario';
import { defaultScenarios } from '../engine/scenario';

export type DisplayMode = 'real' | 'nominal';

interface PlanState {
  plan: Plan;
  scenarios: Scenario[];
  displayMode: DisplayMode;
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
  setWithdrawalStrategy: (s: Plan['withdrawalStrategy']) => void;
  setCustomPolicy: (policy: BlendPolicy) => void;
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
      setDisplayMode: (displayMode) => set({ displayMode }),
      addScenario: (s) => set((st) => ({ scenarios: [...st.scenarios, s] })),
      updateScenario: (id, patch) => set((st) => ({ scenarios: st.scenarios.map((x) => x.id === id ? { ...x, ...patch } : x) })),
      removeScenario: (id) => set((st) => ({ scenarios: st.scenarios.filter((x) => x.id !== id) })),
      resetScenarios: () => set({ scenarios: defaultScenarios() }),
      setPersonA: (patch) => set((s) => ({ plan: { ...s.plan, personA: { ...s.plan.personA, ...patch } } })),
      setPersonB: (patch) => set((s) => ({ plan: { ...s.plan, personB: s.plan.personB ? { ...s.plan.personB, ...patch } : undefined } })),
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
      setExpenseStreams: (expenseStreams) => set((s) => ({ plan: { ...s.plan, expenseStreams } })),
      addExpenseStream: (stream) => set((s) => ({ plan: { ...s.plan, expenseStreams: [...s.plan.expenseStreams, stream] } })),
      updateExpenseStream: (id, patch) => set((s) => ({
        plan: { ...s.plan, expenseStreams: s.plan.expenseStreams.map(x => x.id === id ? { ...x, ...patch } : x) },
      })),
      removeExpenseStream: (id) => set((s) => ({ plan: { ...s.plan, expenseStreams: s.plan.expenseStreams.filter(x => x.id !== id) } })),
      setWithdrawalStrategy: (withdrawalStrategy) => set((s) => ({
        plan: { ...s.plan, withdrawalStrategy, customPolicy: undefined },
      })),
      setCustomPolicy: (policy) => set((s) => ({ plan: { ...s.plan, customPolicy: policy } })),
      clearCustomPolicy: () => set((s) => ({ plan: { ...s.plan, customPolicy: undefined } })),
      setConversion: (patch) => set((s) => ({ plan: { ...s.plan, conversion: { ...s.plan.conversion, ...patch } } })),
      setState: (state) => set((s) => ({ plan: { ...s.plan, state } })),
      addGoal: (g) => set((s) => ({ plan: { ...s.plan, goals: [...(s.plan.goals ?? []), g] } })),
      updateGoal: (id, patch) => set((s) => ({ plan: { ...s.plan, goals: (s.plan.goals ?? []).map((x) => x.id === id ? { ...x, ...patch } : x) } })),
      removeGoal: (id) => set((s) => ({ plan: { ...s.plan, goals: (s.plan.goals ?? []).filter((x) => x.id !== id) } })),
      resetPlan: () => set({ plan: defaultPlan() }),
    }),
    {
      name: 'fireopt-plan-v1',
      version: 3,
      migrate: (persistedState: unknown, fromVersion: number) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState as PlanState;
        const ps = persistedState as Record<string, unknown> & { plan?: Record<string, unknown> };
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
 *  Engine is fast (~1-5ms per full 75y run), so we just run on every render. */
export function useProjection(): ProjectionResult {
  const plan = usePlanStore((s) => s.plan);
  return runProjection(plan);
}
