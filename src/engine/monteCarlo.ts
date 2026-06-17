import type { Plan } from '../schemas/plan';
import { runProjection } from './projection';
import { mulberry32, parametricNormal, historicalBootstrap, historicalSequence } from './returnModels';
import { indexOfYear } from './marketHistory';

export type ReturnModel = 'historical' | 'parametric';

export interface MonteCarloOptions {
  trials?: number;       // default 500
  model?: ReturnModel;   // default 'historical'
  equityPct?: number;    // default plan.assumptions.equityPct (0..1)
  blockYears?: number;   // historical bootstrap block length, default 7
  meanReturn?: number;   // parametric arithmetic mean; default plan.postRetReturn
  stdDev?: number;       // parametric std dev; default 0.10
  seed?: number;         // optional deterministic seed
}

export interface MonteCarloResult {
  ages: number[];
  /** Real (today's $) portfolio totals by age, percentile bands. */
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
  /** Nominal (future $) portfolio totals by age, percentile bands. */
  p10Nominal: number[];
  p25Nominal: number[];
  p50Nominal: number[];
  p75Nominal: number[];
  p90Nominal: number[];
  successRate: number;
  /** Fraction of trials with portfolio ≤ 0 by each age (one entry per age). */
  depleteFracByAge: number[];
  medianEndBalance: number;     // real $ at last age
  p10EndBalance: number;
  p90EndBalance: number;
  medianEndBalanceNominal: number;
  p10EndBalanceNominal: number;
  p90EndBalanceNominal: number;
  trials: number;
  model: ReturnModel;
  equityPct: number;
  /** Worst-case historical retirement-cohort stress tests. */
  stressScenarios: Array<{
    name: string;
    description: string;
    successRate: number;
    medianEnd: number;
    medianEndNominal: number;
  }>;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

interface TrialOutput {
  endByAge: number[];
  endByAgeNominal: number[];
  ranOut: boolean;
  endRealTotal: number;
  endNominalTotal: number;
}

function projectWithReturns(
  plan: Plan,
  returns: number[],
  inflationOverrides?: number[],
): TrialOutput {
  const proj = runProjection(plan, { returnOverrides: returns, inflationOverrides });
  return {
    endByAge: proj.rows.map((r) => r.endTotal / r.inflationFactor),
    endByAgeNominal: proj.rows.map((r) => r.endTotal),
    ranOut: proj.ranOut,
    endRealTotal: proj.endTotalReal,
    endNominalTotal: proj.rows.at(-1)?.endTotal ?? 0,
  };
}

export function runMonteCarlo(plan: Plan, opts: MonteCarloOptions = {}): MonteCarloResult {
  const trials = opts.trials ?? 500;
  const model: ReturnModel = opts.model ?? 'historical';
  const equityPct = opts.equityPct ?? plan.assumptions.equityPct ?? 0.6;
  const blockYears = opts.blockYears ?? 7;
  const meanReturn = opts.meanReturn ?? plan.assumptions.postRetReturn;
  const stdDev = opts.stdDev ?? 0.10;
  const seed = opts.seed ?? 42;
  const rand = mulberry32(seed);

  const baseline = runProjection(plan);
  const nYears = baseline.rows.length;
  const ages = baseline.rows.map((r) => r.ageA);

  // Historical model: joint-bootstrap returns + CPI, preserving stagflation correlation.
  // Parametric model: IID normal returns, fixed plan inflation (comparison baseline).
  const sampleReturns = () =>
    model === 'historical'
      ? historicalBootstrap(rand, equityPct, nYears, blockYears)
      : { returns: parametricNormal(rand, meanReturn, stdDev, nYears), inflations: undefined };

  const matrix: number[][] = Array.from({ length: nYears }, () => []);
  const matrixNominal: number[][] = Array.from({ length: nYears }, () => []);
  let successCount = 0;
  const endTotals: number[] = [];
  const endTotalsNominal: number[] = [];

  for (let t = 0; t < trials; t++) {
    const { returns, inflations } = sampleReturns();
    const out = projectWithReturns(plan, returns, inflations);
    if (!out.ranOut) successCount++;
    endTotals.push(out.endRealTotal);
    endTotalsNominal.push(out.endNominalTotal);
    for (let i = 0; i < nYears; i++) {
      matrix[i].push(out.endByAge[i] ?? 0);
      matrixNominal[i].push(out.endByAgeNominal[i] ?? 0);
    }
  }

  const p10: number[] = [], p25: number[] = [], p50: number[] = [], p75: number[] = [], p90: number[] = [];
  const p10Nominal: number[] = [], p25Nominal: number[] = [], p50Nominal: number[] = [], p75Nominal: number[] = [], p90Nominal: number[] = [];
  const depleteFracByAge: number[] = [];
  for (let c = 0; c < matrix.length; c++) {
    const sorted = [...matrix[c]].sort((a, b) => a - b);
    p10.push(quantile(sorted, 0.10));
    p25.push(quantile(sorted, 0.25));
    p50.push(quantile(sorted, 0.50));
    p75.push(quantile(sorted, 0.75));
    p90.push(quantile(sorted, 0.90));
    const sortedN = [...matrixNominal[c]].sort((a, b) => a - b);
    p10Nominal.push(quantile(sortedN, 0.10));
    p25Nominal.push(quantile(sortedN, 0.25));
    p50Nominal.push(quantile(sortedN, 0.50));
    p75Nominal.push(quantile(sortedN, 0.75));
    p90Nominal.push(quantile(sortedN, 0.90));
    const depleted = matrix[c].reduce((n, v) => n + (v <= 0 ? 1 : 0), 0);
    depleteFracByAge.push(depleted / matrix[c].length);
  }

  const sortedEnd = [...endTotals].sort((a, b) => a - b);
  const sortedEndNominal = [...endTotalsNominal].sort((a, b) => a - b);

  // Stress scenarios: real worst-case retirement cohorts. Each runs the full historical
  // return + CPI sequence from that year, preserving stagflation correlation.
  const cohorts = [
    { name: 'Retire into 1966', description: 'Stagflation decade — real returns near zero', year: 1966 },
    { name: 'Retire into 1973', description: 'Oil shock + 1973–74 bear market', year: 1973 },
    { name: 'Retire into 2000', description: 'Dot-com bust then the 2008 crash', year: 2000 },
    { name: 'Retire into 1929', description: 'Great Depression collapse', year: 1929 },
  ];
  const stressScenarios = cohorts.map((c) => {
    const startIdx = indexOfYear(c.year);
    const { returns, inflations } = startIdx >= 0
      ? historicalSequence(equityPct, nYears, startIdx)
      : { returns: parametricNormal(mulberry32(seed + 1), meanReturn, stdDev, nYears), inflations: undefined };
    const out = projectWithReturns(plan, returns, inflations);
    return {
      name: c.name,
      description: c.description,
      successRate: out.ranOut ? 0 : 1,
      medianEnd: out.endRealTotal,
      medianEndNominal: out.endNominalTotal,
    };
  });

  return {
    ages,
    p10, p25, p50, p75, p90,
    p10Nominal, p25Nominal, p50Nominal, p75Nominal, p90Nominal,
    successRate: successCount / trials,
    depleteFracByAge,
    medianEndBalance: quantile(sortedEnd, 0.5),
    p10EndBalance: quantile(sortedEnd, 0.10),
    p90EndBalance: quantile(sortedEnd, 0.90),
    medianEndBalanceNominal: quantile(sortedEndNominal, 0.5),
    p10EndBalanceNominal: quantile(sortedEndNominal, 0.10),
    p90EndBalanceNominal: quantile(sortedEndNominal, 0.90),
    trials,
    model,
    equityPct,
    stressScenarios,
  };
}
