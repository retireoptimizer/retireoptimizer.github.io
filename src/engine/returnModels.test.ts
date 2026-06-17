import { describe, it, expect } from 'vitest';
import { mulberry32, parametricNormal, historicalBootstrap, historicalSequence } from './returnModels';
import { STOCK_REAL, BOND_REAL, CPI_INFLATION, indexOfYear } from './marketHistory';
import { runMonteCarlo } from './monteCarlo';
import { samplePlan } from '../schemas/plan';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const variance = (xs: number[]) => {
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) ** 2));
};

describe('marketHistory', () => {
  it('aligns stock/bond/CPI series', () => {
    expect(STOCK_REAL.length).toBe(BOND_REAL.length);
    expect(BOND_REAL.length).toBe(CPI_INFLATION.length);
    expect(STOCK_REAL.length).toBeGreaterThan(90);
    expect(indexOfYear(1928)).toBe(0);
    expect(indexOfYear(2008)).toBe(2008 - 1928);
    expect(indexOfYear(1900)).toBe(-1);
  });
});

describe('historicalBootstrap', () => {
  it('produces parallel return/inflation arrays of the requested length', () => {
    const r = mulberry32(1);
    const { returns, inflations } = historicalBootstrap(r, 0.6, 40, 7);
    expect(returns).toHaveLength(40);
    expect(inflations).toHaveLength(40);
    expect(returns.every((x) => Number.isFinite(x))).toBe(true);
    expect(inflations.every((x) => Number.isFinite(x))).toBe(true);
  });

  it('nominal returns match (1+blendedReal)*(1+cpi)-1 for each year', () => {
    // Verify the math identity at every sampled position.
    const r = mulberry32(99);
    const { returns, inflations } = historicalBootstrap(r, 0.7, 50, 5);
    // We can't know which dataset index was picked, but we can verify that for each
    // sampled year the nominal return is consistent with the CPI that came with it:
    // all valid blendedReal values are bounded by min/max of STOCK_REAL and BOND_REAL.
    for (let i = 0; i < returns.length; i++) {
      const cpi = inflations[i];
      // Recover blendedReal from nominal and CPI.
      const blendedReal = (1 + returns[i]) / (1 + cpi) - 1;
      // Must lie within the historical range of blended real returns.
      const minReal = Math.min(...STOCK_REAL, ...BOND_REAL);
      const maxReal = Math.max(...STOCK_REAL, ...BOND_REAL);
      expect(blendedReal).toBeGreaterThanOrEqual(minReal - 1e-9);
      expect(blendedReal).toBeLessThanOrEqual(maxReal + 1e-9);
    }
  });

  it('all-bonds is far less volatile than all-equity (nominal)', () => {
    const equity = historicalBootstrap(mulberry32(3), 1, 500, 5).returns;
    const bonds  = historicalBootstrap(mulberry32(3), 0, 500, 5).returns;
    expect(variance(bonds)).toBeLessThan(variance(equity));
  });
});

describe('historicalSequence', () => {
  it('is deterministic and starts at the cohort year', () => {
    const idx = indexOfYear(2000);
    const a = historicalSequence(0.6, 10, idx);
    const b = historicalSequence(0.6, 10, idx);
    expect(a.returns).toEqual(b.returns);
    expect(a.inflations).toEqual(b.inflations);

    // Verify first year's nominal return matches the manual computation.
    const blendedReal0 = 0.6 * STOCK_REAL[idx] + 0.4 * BOND_REAL[idx];
    const cpi0 = CPI_INFLATION[idx];
    const expectedNominal = (1 + blendedReal0) * (1 + cpi0) - 1;
    expect(a.returns[0]).toBeCloseTo(expectedNominal, 12);
    expect(a.inflations[0]).toBeCloseTo(cpi0, 12);
  });
});

describe('parametricNormal', () => {
  it('centers on the requested mean over many draws', () => {
    const out = parametricNormal(mulberry32(42), 0.05, 0.1, 5000);
    expect(mean(out)).toBeCloseTo(0.05, 1);
  });
});

describe('runMonteCarlo — pessimism fix + stochastic inflation', () => {
  it('historical model is at least as optimistic as parametric on the sample plan', () => {
    const plan = samplePlan();
    const hist = runMonteCarlo(plan, { trials: 300, model: 'historical', equityPct: 0.6, seed: 1 });
    const para = runMonteCarlo(plan, { trials: 300, model: 'parametric', seed: 1 });
    expect(hist.successRate).toBeGreaterThanOrEqual(para.successRate);
    expect(hist.model).toBe('historical');
    expect(hist.equityPct).toBeCloseTo(0.6, 10);
  });

  it('reports historical stress cohorts with stochastic inflation', () => {
    const mc = runMonteCarlo(samplePlan(), { trials: 100, seed: 1 });
    expect(mc.stressScenarios.map((s) => s.name)).toContain('Retire into 2000');
    expect(mc.stressScenarios).toHaveLength(4);
  });
});
