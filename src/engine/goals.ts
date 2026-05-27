import type { Goal, Plan } from '../schemas/plan';
import type { ProjectionResult } from './projection';

export interface GoalStatus {
  goal: Goal;
  projectedAmount: number;       // value at target year (today's $)
  percentFunded: number;         // 0..1+
  status: 'on-track' | 'at-risk' | 'off-track';
  detail: string;
}

const yearsBetween = (currentYear: number, targetYear: number): number => Math.max(0, targetYear - currentYear);

/**
 * Project an external goal (own savings account) to its target year.
 * Uses monthly contributions and expected return; converts to real $ via plan inflation.
 */
function projectExternal(goal: Goal, plan: Plan, currentYear: number): GoalStatus {
  const ext = goal.externalAccount;
  if (!ext) {
    return { goal, projectedAmount: 0, percentFunded: 0, status: 'off-track', detail: 'No external account defined' };
  }
  const years = yearsBetween(currentYear, goal.targetYear);
  const monthly = ext.monthlyContribution;
  const annualReturn = ext.expectedReturn;
  // Future value of starting balance + annuity (annual approximation)
  const r = annualReturn;
  let fv = ext.currentBalance;
  for (let i = 0; i < years; i++) {
    fv = fv * (1 + r) + monthly * 12;
  }
  // Convert to real $ using plan inflation
  const inflationFactor = Math.pow(1 + plan.assumptions.inflation, years);
  const realFv = fv / inflationFactor;
  const pct = goal.targetAmount > 0 ? realFv / goal.targetAmount : 0;
  const status: GoalStatus['status'] = pct >= 1 ? 'on-track' : pct >= 0.6 ? 'at-risk' : 'off-track';
  return {
    goal,
    projectedAmount: realFv,
    percentFunded: pct,
    status,
    detail: `External account: $${Math.round(realFv).toLocaleString()} projected at ${goal.targetYear} (today's $)`,
  };
}

/**
 * From-plan goal: a one-time draw from the portfolio at target year.
 * "Funded" if the portfolio at target year has enough headroom over forward years.
 */
function projectFromPlan(goal: Goal, _plan: Plan, proj: ProjectionResult, currentYear: number): GoalStatus {
  const yearsOut = yearsBetween(currentYear, goal.targetYear);
  const row = proj.rows[yearsOut];
  if (!row) {
    return { goal, projectedAmount: 0, percentFunded: 0, status: 'off-track', detail: 'Target year is past plan horizon' };
  }
  // Inflate target amount to nominal, compare to nominal portfolio
  const inflationFactor = row.inflationFactor;
  const targetNominal = goal.targetAmount * inflationFactor;
  const pct = row.endTotal > 0 ? Math.min(2, row.endTotal / targetNominal) : 0;
  // Status — also factor in plan's overall longevity
  const status: GoalStatus['status'] = (pct >= 1.5 && !proj.ranOut) ? 'on-track' : (pct >= 1.0 && !proj.ranOut) ? 'at-risk' : 'off-track';
  return {
    goal,
    projectedAmount: row.endTotal / inflationFactor,
    percentFunded: pct,
    status,
    detail: `Plan has $${Math.round(row.endTotal / inflationFactor).toLocaleString()} (today's $) at age ${row.ageA}; goal needs $${Math.round(goal.targetAmount).toLocaleString()}`,
  };
}

/**
 * Aspirational goal: tracked, but not funded by the plan. Shows the gap.
 */
function projectAspirational(goal: Goal, _plan: Plan, proj: ProjectionResult, currentYear: number): GoalStatus {
  const yearsOut = yearsBetween(currentYear, goal.targetYear);
  const row = proj.rows[yearsOut];
  const available = row ? row.endTotal / row.inflationFactor : 0;
  const pct = goal.targetAmount > 0 ? available / goal.targetAmount : 0;
  return {
    goal,
    projectedAmount: available,
    percentFunded: pct,
    status: 'at-risk',
    detail: `Aspirational: plan has $${Math.round(available).toLocaleString()} (today's $) available; would need $${Math.round(goal.targetAmount).toLocaleString()}`,
  };
}

export function evaluateGoals(plan: Plan, proj: ProjectionResult): GoalStatus[] {
  const currentYear = new Date().getFullYear();
  return (plan.goals ?? []).map((g) => {
    if (g.fundingMode === 'external') return projectExternal(g, plan, currentYear);
    if (g.fundingMode === 'from-plan') return projectFromPlan(g, plan, proj, currentYear);
    return projectAspirational(g, plan, proj, currentYear);
  });
}

/** Goal Coverage score: weighted % of goals funded (Essential=3, Important=2, Aspirational=1). */
export function goalCoverageScore(statuses: GoalStatus[]): number {
  if (statuses.length === 0) return 100;
  const weights: Record<Goal['priority'], number> = { Essential: 3, Important: 2, Aspirational: 1 };
  let totalWeight = 0;
  let fundedWeight = 0;
  for (const s of statuses) {
    const w = weights[s.goal.priority];
    totalWeight += w;
    fundedWeight += w * Math.min(1, s.percentFunded);
  }
  return totalWeight > 0 ? Math.round((fundedWeight / totalWeight) * 100) : 100;
}
