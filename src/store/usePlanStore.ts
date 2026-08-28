import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useToastStore } from './useToastStore';
import { FED_BRACKETS_MFJ } from '../engine/taxConstants';
import type { Plan, Person, Assumptions, PersonPortfolio, IncomeStream, ExpenseStream, LumpSumEvent, ConversionParams, Goal } from '../schemas/plan';
import type { BlendPolicy } from '../engine/blendPolicy';
import { defaultPlan } from '../schemas/plan';
import { runProjection, type ProjectionResult } from '../engine/projection';
import type { Scenario } from '../engine/scenario';
import { defaultScenarios } from '../engine/scenario';
import { useWhatIfStore, applyWhatIf } from './useWhatIfStore';
import { useOptimizerStore } from './useOptimizerStore';
import { disposeEngineWorker } from '../engine/workerClient';
import { migratePlanToV24, migratePlanToV25 } from './planMigrations';

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
  addLumpSumEvent: (e: LumpSumEvent) => void;
  updateLumpSumEvent: (id: string, patch: Partial<LumpSumEvent>) => void;
  removeLumpSumEvent: (id: string) => void;
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
  setWithdrawalBracketCeiling: (v: number) => void;
  setState: (state: string) => void;
  setCustomStateTaxRate: (rate: number) => void;
  setPayTaxFromBrokerage: (v: boolean) => void;
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
      setPersonA: (patch) => set((s) => ({ plan: { ...s.plan, personA: { ...s.plan.personA, ...patch } } })),
      setPersonB: (patch) => set((s) => ({ plan: { ...s.plan, personB: s.plan.personB ? { ...s.plan.personB, ...patch } : undefined } })),
      addPersonB: () => set((s) => ({
        plan: {
          ...s.plan,
          personB: { name: 'Person B', dob: '1975-01-01', retirementAge: 65, planThroughAge: 90, ssPIA: 0, ssClaimAge: 67 },
          portfolio: { ...s.plan.portfolio, personB: { taxable: 0, taxableBasis: 0, traditional: 0, roth: 0, annualContribution: 0, contribGrowth: { mode: 'cpi' }, contribSplit: { taxable: 0.2, traditional: 0.4, roth: 0.4 } } },
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
      addLumpSumEvent: (e) => set((s) => ({ plan: { ...s.plan, lumpSumEvents: [...(s.plan.lumpSumEvents ?? []), e] } })),
      updateLumpSumEvent: (id, patch) => set((s) => ({ plan: { ...s.plan, lumpSumEvents: (s.plan.lumpSumEvents ?? []).map(x => x.id === id ? { ...x, ...patch } : x) } })),
      removeLumpSumEvent: (id) => set((s) => ({ plan: { ...s.plan, lumpSumEvents: (s.plan.lumpSumEvents ?? []).filter(x => x.id !== id) } })),
      setExpenseStreams: (expenseStreams) => set((s) => ({ plan: { ...s.plan, expenseStreams, solvedSpendingMultiplier: undefined } })),
      addExpenseStream: (stream) => set((s) => ({ plan: { ...s.plan, expenseStreams: [...s.plan.expenseStreams, stream], solvedSpendingMultiplier: undefined } })),
      updateExpenseStream: (id, patch) => set((s) => ({
        plan: { ...s.plan, expenseStreams: s.plan.expenseStreams.map(x => x.id === id ? { ...x, ...patch } : x), solvedSpendingMultiplier: undefined },
      })),
      removeExpenseStream: (id) => set((s) => ({ plan: { ...s.plan, expenseStreams: s.plan.expenseStreams.filter(x => x.id !== id), solvedSpendingMultiplier: undefined } })),
      setWithdrawalStrategy: (withdrawalStrategy) => set((s) => ({
        plan: { ...s.plan, withdrawalStrategy, customPolicy: undefined, conversionBaselinePolicy: undefined },
      })),
      setCustomPolicy: (policy) => set((s) => ({ plan: { ...s.plan, customPolicy: policy, conversionBaselinePolicy: undefined, optimizedForGoal: undefined } })),
      applyOptimizerResult: (next) => set(() => ({ plan: next })),
      clearCustomPolicy: () => set((s) => ({ plan: { ...s.plan, customPolicy: undefined, conversionBaselinePolicy: undefined } })),
      // Editing conversion settings invalidates an optimizer-authored withdrawal ordering, which was
      // co-optimized against the old conversion schedule. Discard it (revert to the preset) and tell
      // the user to re-run — otherwise the projection silently runs on a withdrawal plan they never
      // chose. Matches StrategyChooser's Manual tab, which already clears the policy first.
      setConversion: (patch) => set((s) => {
        if (s.plan.customPolicy?.source === 'optimizer') {
          useToastStore.getState().show('info', 'Withdrawal ordering reset — re-run the optimizer to co-optimize withdrawals and conversions.');
          return { plan: { ...s.plan, conversion: { ...s.plan.conversion, ...patch }, customPolicy: undefined, conversionBaselinePolicy: undefined } };
        }
        return { plan: { ...s.plan, conversion: { ...s.plan.conversion, ...patch } } };
      }),
      setWithdrawalBracketCeiling: (v: number) => set((s) => ({
        plan: {
          ...s.plan,
          withdrawalBracketCeiling: v,
          conversion: { ...s.plan.conversion, bracketCeiling: Math.min(s.plan.conversion.bracketCeiling, v) },
        },
      })),
      setState: (state) => set((s) => ({ plan: { ...s.plan, state } })),
      setCustomStateTaxRate: (rate) => set((s) => ({ plan: { ...s.plan, customStateTaxRate: rate } })),
      setPayTaxFromBrokerage: (v) => set((s) => ({ plan: { ...s.plan, payTaxFromBrokerage: v } })),
      addGoal: (g) => set((s) => ({ plan: { ...s.plan, goals: [...(s.plan.goals ?? []), g] } })),
      updateGoal: (id, patch) => set((s) => ({ plan: { ...s.plan, goals: (s.plan.goals ?? []).map((x) => x.id === id ? { ...x, ...patch } : x) } })),
      removeGoal: (id) => set((s) => ({ plan: { ...s.plan, goals: (s.plan.goals ?? []).filter((x) => x.id !== id) } })),
      resetPlan: () => { disposeEngineWorker(); set({ plan: defaultPlan() }); },
    }),
    {
      name: 'fireopt-plan-v1',
      version: 26,
      migrate: (persistedState: unknown, fromVersion: number) => {
        if (!persistedState || typeof persistedState !== 'object') return persistedState as PlanState;
        const ps = persistedState as Record<string, unknown> & { plan?: Record<string, unknown> };
        // v24: planToAge → planThroughAge; stopAge → end: EndRule; add survivorPct.
        if (fromVersion < 24 && ps.plan && typeof ps.plan === 'object') {
          migratePlanToV24(ps.plan as Record<string, unknown>);
        }
        // v25: upgrade streams with end.age === planThroughAge to semantic EndRule modes
        // (life / lastSurvivor) so they follow the owner's lifetime rather than a baked-in age.
        if (fromVersion < 25 && ps.plan && typeof ps.plan === 'object') {
          migratePlanToV25(ps.plan as Record<string, unknown>);
        }
        // v23: dividend payout election. Default 0 = full reinvestment (DRIP), preserving pre-v23 behavior.
        if (fromVersion < 23 && ps.plan?.assumptions && typeof ps.plan.assumptions === 'object') {
          const asm = ps.plan.assumptions as Record<string, unknown>;
          asm.taxableDistributePct ??= 0;
        }
        // v22: tax-adjusted balance rates. 22% / 15% are the new modeling defaults; the
        // pre-v22 behavior is exactly 0% / 0% (no tax adjustment).
        if (fromVersion < 22 && ps.plan?.assumptions && typeof ps.plan.assumptions === 'object') {
          const asm = ps.plan.assumptions as Record<string, unknown>;
          asm.taxAdjOrdRate  ??= 0.22;
          asm.taxAdjLtcgRate ??= 0.15;
        }
        // v21: tax-exempt income (MuniBond/VA streams + portfolio exempt yield). Defaults preserve existing behavior.
        if (fromVersion < 21 && ps.plan?.assumptions && typeof ps.plan.assumptions === 'object') {
          const asm = ps.plan.assumptions as Record<string, unknown>;
          asm.taxableExemptYield    ??= 0;
          asm.taxableExemptStatePct ??= 1;
        }
        // v20: add payTaxFromBrokerage (default false — preserves existing behavior).
        if (fromVersion < 20 && ps.plan && typeof ps.plan === 'object') {
          const planObj = ps.plan as Record<string, unknown>;
          if (!('payTaxFromBrokerage' in planObj)) planObj.payTaxFromBrokerage = false;
        }
        // v19: add acaStartAgeA / acaStartAgeB (optional; engine falls back to retirement age).
        // v18: remove base* snapshot fields (optimizer results are now ephemeral in useOptimizerStore).
        if (fromVersion < 18 && ps.plan && typeof ps.plan === 'object') {
          const planObj = ps.plan as Record<string, unknown>;
          delete planObj.baseExpenseStreams;
          delete planObj.basePersonA;
          delete planObj.basePersonB;
        }
        // v17: add taxableDivYield and taxableQualifiedPct to assumptions.
        if (fromVersion < 17 && ps.plan?.assumptions && typeof ps.plan.assumptions === 'object') {
          const asm = ps.plan.assumptions as Record<string, unknown>;
          asm.taxableDivYield    ??= 0;
          asm.taxableQualifiedPct ??= 0.80;
        }
        // v16: convert growthPct/inflationPct/contribGrowth from number to GrowthRate object.
        if (fromVersion < 16 && ps.plan && typeof ps.plan === 'object') {
          const planObj = ps.plan as Record<string, unknown>;
          const incomes = planObj.incomeStreams as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(incomes)) {
            for (const s of incomes) {
              if (typeof s.growthPct === 'number') s.growthPct = { mode: 'fixed', rate: s.growthPct };
            }
          }
          const expenses = planObj.expenseStreams as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(expenses)) {
            for (const e of expenses) {
              if (typeof e.inflationPct === 'number') e.inflationPct = { mode: 'fixed', rate: e.inflationPct };
            }
          }
          const pf = planObj.portfolio as Record<string, unknown> | undefined;
          const pA = pf?.personA as Record<string, unknown> | undefined;
          const pB = pf?.personB as Record<string, unknown> | undefined;
          if (pA && typeof pA.contribGrowth === 'number') pA.contribGrowth = { mode: 'fixed', rate: pA.contribGrowth };
          if (pB && typeof pB.contribGrowth === 'number') pB.contribGrowth = { mode: 'fixed', rate: pB.contribGrowth };
        }
        // v15: rename legacy bucket values 'trad'→'inheritedPreTaxIRA', 'roth'→'inheritedRoth'.
        if (fromVersion < 15 && ps.plan && typeof ps.plan === 'object') {
          const planObj = ps.plan as Record<string, unknown>;
          const events = planObj.lumpSumEvents as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(events)) {
            for (const ev of events) {
              if (ev.bucket === 'trad') ev.bucket = 'inheritedPreTaxIRA';
              else if (ev.bucket === 'roth') ev.bucket = 'inheritedRoth';
            }
          }
        }
        // v14: add lumpSumEvents array to plan.
        if (fromVersion < 14 && ps.plan && typeof ps.plan === 'object') {
          const planObj = ps.plan as Record<string, unknown>;
          if (!Array.isArray(planObj.lumpSumEvents)) planObj.lumpSumEvents = [];
        }
        // v13: backfill conversion.optimize = true (preserves prior optimizer-decides-conversions behavior).
        if (fromVersion < 13 && ps.plan && typeof ps.plan === 'object') {
          const planObj = ps.plan as Record<string, unknown>;
          const conv = planObj.conversion as Record<string, unknown> | undefined;
          if (conv && typeof conv === 'object' && conv.optimize == null) conv.optimize = true;
        }
        // v12: backfill stateTaxablePct = 1 on existing income streams.
        if (fromVersion < 12 && ps.plan && typeof ps.plan === 'object') {
          const planObj = ps.plan as Record<string, unknown>;
          const streams = planObj.incomeStreams as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(streams)) {
            for (const s of streams) {
              if (s.stateTaxablePct == null) s.stateTaxablePct = 1;
            }
          }
        }
        // v11: initialize taxableBasis to 50% of taxable balance (preserves prior 50% flat assumption).
        if (fromVersion < 11 && ps.plan && typeof ps.plan === 'object') {
          const planObj = ps.plan as Record<string, unknown>;
          const pf = planObj.portfolio as Record<string, unknown> | undefined;
          const pA = pf?.personA as Record<string, unknown> | undefined;
          const pB = pf?.personB as Record<string, unknown> | undefined;
          if (pA && pA.taxableBasis == null) pA.taxableBasis = ((pA.taxable as number) ?? 0) * 0.5;
          if (pB && pB.taxableBasis == null) pB.taxableBasis = ((pB.taxable as number) ?? 0) * 0.5;
        }
        // v10: migrate stale 2025 bracket thresholds → 2026 values (taxConstants update).
        if (fromVersion < 10 && ps.plan && typeof ps.plan === 'object') {
          const planObj = ps.plan as Record<string, unknown>;
          const OLD_TO_NEW: Record<number, number> = { 23850: 24800, 96950: 100800, 206700: 211400, 394600: 403550 };
          const wdCur = planObj.withdrawalBracketCeiling as number | undefined;
          if (wdCur !== undefined && OLD_TO_NEW[wdCur] !== undefined) planObj.withdrawalBracketCeiling = OLD_TO_NEW[wdCur];
          const conv = planObj.conversion as Record<string, unknown> | undefined;
          if (conv) {
            const convCur = conv.bracketCeiling as number | undefined;
            if (convCur !== undefined && OLD_TO_NEW[convCur] !== undefined) conv.bracketCeiling = OLD_TO_NEW[convCur];
          }
        }
        // v9: withdrawalBracketCeiling added (configurable bracket-fill ceiling for withdrawal ordering).
        if (fromVersion < 9 && ps.plan && typeof ps.plan === 'object') {
          const planObj = ps.plan as Record<string, unknown>;
          if (!('withdrawalBracketCeiling' in planObj)) planObj.withdrawalBracketCeiling = FED_BRACKETS_MFJ[1][0];
        }
        // v8: rmdStartAge removed from assumptions (now derived from personA.dob).
        if (fromVersion < 8 && ps.plan && typeof ps.plan === 'object') {
          const asm = (ps.plan as Record<string, unknown>).assumptions as Record<string, unknown> | undefined;
          if (asm) delete asm.rmdStartAge;
        }
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

/** Selector hook — returns a projection result, re-run on every plan change.
 *  Engine is fast (~1-5ms per full 75y run), so we just run on every render.
 *
 *  Accepts an optional planOverride (e.g. the pending optimizer plan on the Dashboard).
 *  When provided, what-if overrides are layered on top of it instead of the stored plan.
 *  The saved plan in usePlanStore is never mutated. */
export function useProjection(planOverride?: Plan): ProjectionResult {
  const plan = usePlanStore((s) => s.plan);
  const pendingPlan = useOptimizerStore((s) => s.pendingPlan);
  const whatIf = useWhatIfStore();
  // When the optimizer has a pending result (not yet applied), use it as the base so all
  // projection views reflect the optimizer's recommended plan without requiring Apply first.
  const effective = applyWhatIf(planOverride ?? pendingPlan ?? plan, whatIf);
  return runProjection(effective);
}
