import type { Plan } from '../schemas/plan';
import { runProjection } from './projection';

export interface MonteCarloOptions {
  trials?: number;       // default 500
  meanReturn?: number;   // default plan.postRetReturn
  stdDev?: number;       // default 0.10
  seed?: number;         // optional deterministic seed
}

export interface MonteCarloResult {
  ages: number[];
  /** Real-$ portfolio totals by age, percentile bands (p10, p25, p50, p75, p90). */
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  successRate: number;          // fraction of trials where plan funds through plan-to age
  medianEndBalance: number;     // real $ at last age
  p10EndBalance: number;
  p90EndBalance: number;
  trials: number;
  /** Pre-defined stress scenarios: name, return shock, success rate, p10 ending balance. */
  stressScenarios: Array<{
    name: string;
    description: string;
    returnAdj: number;
    successRate: number;
    medianEnd: number;
  }>;
}

// Mulberry32 — small, deterministic PRNG.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box-Muller normal sample.
function normal(rand: () => number, mean: number, std: number): number {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * std;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

interface TrialOutput {
  endByAge: number[];   // real-$ portfolio at each year-index
  ranOut: boolean;
  endRealTotal: number;
}

function runTrial(plan: Plan, rand: () => number, meanReturn: number, stdDev: number, nYears: number): TrialOutput {
  const returns: number[] = [];
  for (let i = 0; i < nYears; i++) returns.push(normal(rand, meanReturn, stdDev));
  const proj = runProjection(plan, { returnOverrides: returns });
  return {
    endByAge: proj.rows.map((r) => r.endTotal / r.inflationFactor),
    ranOut: proj.ranOut,
    endRealTotal: proj.endTotalReal,
  };
}

export function runMonteCarlo(plan: Plan, opts: MonteCarloOptions = {}): MonteCarloResult {
  const trials = opts.trials ?? 500;
  const meanReturn = opts.meanReturn ?? plan.assumptions.postRetReturn;
  const stdDev = opts.stdDev ?? 0.10;
  const seed = opts.seed ?? 42;
  const rand = mulberry32(seed);

  // Baseline projection to determine year count + ages.
  const baseline = runProjection(plan);
  const nYears = baseline.rows.length;
  const ages = baseline.rows.map((r) => r.ageA);

  const matrix: number[][] = Array.from({ length: nYears }, () => []);
  let successCount = 0;
  const endTotals: number[] = [];

  for (let t = 0; t < trials; t++) {
    const out = runTrial(plan, rand, meanReturn, stdDev, nYears);
    if (!out.ranOut) successCount++;
    endTotals.push(out.endRealTotal);
    for (let i = 0; i < nYears; i++) matrix[i].push(out.endByAge[i] ?? 0);
  }

  const p10: number[] = [], p25: number[] = [], p50: number[] = [], p75: number[] = [], p90: number[] = [];
  for (const col of matrix) {
    const sorted = [...col].sort((a, b) => a - b);
    p10.push(quantile(sorted, 0.10));
    p25.push(quantile(sorted, 0.25));
    p50.push(quantile(sorted, 0.50));
    p75.push(quantile(sorted, 0.75));
    p90.push(quantile(sorted, 0.90));
  }

  const sortedEnd = [...endTotals].sort((a, b) => a - b);

  // Stress scenarios — deterministic with fewer trials per scenario.
  const stressScenarios = [
    { name: 'Severe Bear Market', description: '−2% mean return shock · year-1 −20%', returnAdj: -0.02, year1: -0.20 },
    { name: 'High Inflation Decade', description: '−1% real return shock through age 75', returnAdj: -0.01, yearsTo: 75 },
    { name: '2008-style Crash at Retirement', description: '−35% in retire year, recover slowly', returnAdj: 0, retireShock: -0.35 },
    { name: 'Lost Decade', description: 'Returns near zero for first 10 retirement years', returnAdj: 0, lostDecade: true },
  ].map((s) => {
    const stressRand = mulberry32(seed + 1);
    const subTrials = 100;
    let succ = 0;
    const endVals: number[] = [];
    for (let t = 0; t < subTrials; t++) {
      const overrides: number[] = [];
      for (let i = 0; i < nYears; i++) {
        const ageA = ages[i];
        let r = normal(stressRand, meanReturn + s.returnAdj, stdDev);
        if ('year1' in s && i === 0) r += s.year1!;
        if ('yearsTo' in s && ageA <= (s.yearsTo as number)) r -= 0.01;
        if ('retireShock' in s && ageA === plan.personA.retirementAge) r += s.retireShock!;
        if ('lostDecade' in s && ageA >= plan.personA.retirementAge && ageA < plan.personA.retirementAge + 10) r = 0.005;
        overrides.push(r);
      }
      const proj = runProjection(plan, { returnOverrides: overrides });
      if (!proj.ranOut) succ++;
      endVals.push(proj.endTotalReal);
    }
    endVals.sort((a, b) => a - b);
    return {
      name: s.name,
      description: s.description,
      returnAdj: s.returnAdj,
      successRate: succ / subTrials,
      medianEnd: quantile(endVals, 0.5),
    };
  });

  return {
    ages,
    p10, p25, p50, p75, p90,
    successRate: successCount / trials,
    medianEndBalance: quantile(sortedEnd, 0.5),
    p10EndBalance: quantile(sortedEnd, 0.10),
    p90EndBalance: quantile(sortedEnd, 0.90),
    trials,
    stressScenarios,
  };
}
