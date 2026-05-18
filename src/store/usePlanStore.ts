import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Plan, Person, Assumptions, Portfolio, IncomeStream, ExpenseStream, ConversionParams } from '../schemas/plan';
import { defaultPlan } from '../schemas/plan';
import { runProjection, type ProjectionResult } from '../engine/projection';

interface PlanState {
  plan: Plan;
  setPersonA: (patch: Partial<Person>) => void;
  setPersonB: (patch: Partial<Person>) => void;
  setAssumptions: (patch: Partial<Assumptions>) => void;
  setPortfolio: (patch: Partial<Portfolio>) => void;
  setIncomeStreams: (streams: IncomeStream[]) => void;
  addIncomeStream: (s: IncomeStream) => void;
  updateIncomeStream: (id: string, patch: Partial<IncomeStream>) => void;
  removeIncomeStream: (id: string) => void;
  setExpenseStreams: (streams: ExpenseStream[]) => void;
  addExpenseStream: (s: ExpenseStream) => void;
  updateExpenseStream: (id: string, patch: Partial<ExpenseStream>) => void;
  removeExpenseStream: (id: string) => void;
  setWithdrawalStrategy: (s: Plan['withdrawalStrategy']) => void;
  setConversion: (patch: Partial<ConversionParams>) => void;
  setState: (state: string) => void;
  resetPlan: () => void;
}

export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      plan: defaultPlan(),
      setPersonA: (patch) => set((s) => ({ plan: { ...s.plan, personA: { ...s.plan.personA, ...patch } } })),
      setPersonB: (patch) => set((s) => ({ plan: { ...s.plan, personB: s.plan.personB ? { ...s.plan.personB, ...patch } : undefined } })),
      setAssumptions: (patch) => set((s) => ({ plan: { ...s.plan, assumptions: { ...s.plan.assumptions, ...patch } } })),
      setPortfolio: (patch) => set((s) => ({ plan: { ...s.plan, portfolio: { ...s.plan.portfolio, ...patch } } })),
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
      setWithdrawalStrategy: (withdrawalStrategy) => set((s) => ({ plan: { ...s.plan, withdrawalStrategy } })),
      setConversion: (patch) => set((s) => ({ plan: { ...s.plan, conversion: { ...s.plan.conversion, ...patch } } })),
      setState: (state) => set((s) => ({ plan: { ...s.plan, state } })),
      resetPlan: () => set({ plan: defaultPlan() }),
    }),
    { name: 'fireopt-plan-v1' }
  )
);

/** Selector hook — returns a memoized projection result, re-run on every plan change.
 *  Engine is fast (~1-5ms per full 75y run), so we just run on every render. */
export function useProjection(): ProjectionResult {
  const plan = usePlanStore((s) => s.plan);
  return runProjection(plan);
}
