import type { Plan } from '../../schemas/plan';
import type { ProjectionResult } from '../projection';
import type { MonteCarloResult } from '../monteCarlo';
import { bracketCliffRule } from './rules/bracketCliff';
import { irmaaRule } from './rules/irmaa';
import { survivorRule } from './rules/survivor';
import { wrRule } from './rules/wr';
import { taxRule } from './rules/tax';
import { legacyRule } from './rules/legacy';
import { sequenceRiskRule } from './rules/sequenceRisk';

export type InsightSurface = 'dashboard' | 'strategy' | 'mc' | 'taxes';
export type InsightSeverity = 'info' | 'caution' | 'warning';

export interface Insight {
  id: string;                  // stable id used as React key
  surfaces: InsightSurface[];  // which pages this can render on
  severity: InsightSeverity;
  title: string;               // ≤ ~8 words
  body: string;                // 1–2 sentences
  evidence?: string;           // optional drilldown (e.g. age, dollar amount)
  priority: number;            // higher = surface first
}

export interface InsightContext {
  plan: Plan;
  proj: ProjectionResult;
  mc?: MonteCarloResult;
}

type Rule = (ctx: InsightContext) => Insight | null;

const RULES: Rule[] = [
  bracketCliffRule,
  irmaaRule,
  survivorRule,
  wrRule,
  taxRule,
  legacyRule,
  sequenceRiskRule,
];

export function generateInsights(plan: Plan, proj: ProjectionResult, mc?: MonteCarloResult): Insight[] {
  const ctx: InsightContext = { plan, proj, mc };
  const all: Insight[] = [];
  for (const rule of RULES) {
    try {
      const i = rule(ctx);
      if (i) all.push(i);
    } catch {
      // Rules must never crash the page — skip any that throw.
    }
  }
  return all.sort((a, b) => b.priority - a.priority);
}

export function insightsForSurface(insights: Insight[], surface: InsightSurface): Insight[] {
  return insights.filter((i) => i.surfaces.includes(surface));
}
