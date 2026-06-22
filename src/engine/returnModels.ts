/**
 * Return-series samplers for Monte Carlo.
 *
 * Each historical sampler produces a `ReturnSeries` — parallel arrays of per-year
 * nominal portfolio returns and per-year CPI inflation rates. Both arrays are consumed
 * by runProjection: `returnOverrides` drives portfolio growth and `inflationOverrides`
 * drives the deflator and CPI-indexed expense streams.
 *
 * Math identity (verified by engineValidation.test.ts):
 *   blendedNominal = (1 + blendedReal) * (1 + cpi) - 1
 * where blendedReal = equityPct * STOCK_REAL + (1-equityPct) * BOND_REAL.
 * Blending real returns then re-inflating with the same CPI produces exactly the same
 * result as blending nominal returns directly — because the CPI factor cancels linearly.
 */

import { STOCK_REAL, BOND_REAL, CPI_INFLATION, N_YEARS } from './marketHistory';

/** Per-year nominal return and CPI pairs emitted by historical samplers. */
export interface ReturnSeries {
  /** Nominal portfolio return each year — goes into runProjection({ returnOverrides }). */
  returns: number[];
  /** Annual CPI rate each year — goes into runProjection({ inflationOverrides }). */
  inflations: number[];
}

/** Mulberry32 — small, deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller normal sample. */
export function normal(rand: () => number, mean: number, std: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return mean + z * std;
}

/**
 * Parametric model: independent normal draws (the original behaviour).
 * Returns only nominal returns; no inflation overrides (projection uses plan's fixed inflation).
 */
export function parametricNormal(
  rand: () => number,
  mean: number,
  std: number,
  nYears: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < nYears; i++) out.push(normal(rand, mean, std));
  return out;
}

/**
 * Historical block bootstrap. Randomly picks contiguous multi-year blocks from the
 * historical dataset (1928–2023), blending stock/bond real returns by `equityPct`,
 * then re-inflates each year with its actual historical CPI.
 *
 * Contiguous blocks preserve serial return correlation (mean reversion, volatility
 * clustering) and the stock/bond/CPI co-movement that drives stagflation risk.
 * The returned `inflations` array is the actual per-year CPI for each sampled year —
 * it will be passed as `inflationOverrides` so the projection deflator and CPI-indexed
 * expenses track actual historical inflation rather than a fixed rate.
 */
export function historicalBootstrap(
  rand: () => number,
  equityPct: number,
  nYears: number,
  blockYears = 7,
): ReturnSeries {
  const e = Math.max(0, Math.min(1, equityPct));
  const block = Math.max(1, Math.floor(blockYears));
  const returns: number[] = [];
  const inflations: number[] = [];
  while (returns.length < nYears) {
    const start = Math.floor(rand() * N_YEARS);
    for (let k = 0; k < block && returns.length < nYears; k++) {
      const idx = (start + k) % N_YEARS;
      const blendedReal = e * STOCK_REAL[idx] + (1 - e) * BOND_REAL[idx];
      const cpi = CPI_INFLATION[idx];
      // Nominal = (1 + blendedReal) * (1 + cpi) - 1
      // This is identical to blending nominal returns directly (proven in engineValidation.test.ts).
      returns.push((1 + blendedReal) * (1 + cpi) - 1);
      inflations.push(cpi);
    }
  }
  return { returns, inflations };
}

/**
 * Deterministic historical sequence from a fixed start index — used for worst-case
 * retirement-cohort stress tests. Returns both the nominal returns and the actual CPI.
 */
/** Returns only as many years as the dataset covers from startIdx — no wrap-around.
 *  Callers that need a full-length array must pad beyond yearsAvailable themselves. */
export function historicalSequence(
  equityPct: number,
  nYears: number,
  startIdx: number,
): ReturnSeries & { yearsAvailable: number } {
  const e = Math.max(0, Math.min(1, equityPct));
  const returns: number[] = [];
  const inflations: number[] = [];
  const yearsAvailable = Math.min(nYears, N_YEARS - startIdx);
  for (let i = 0; i < yearsAvailable; i++) {
    const idx = startIdx + i;
    const blendedReal = e * STOCK_REAL[idx] + (1 - e) * BOND_REAL[idx];
    const cpi = CPI_INFLATION[idx];
    returns.push((1 + blendedReal) * (1 + cpi) - 1);
    inflations.push(cpi);
  }
  return { returns, inflations, yearsAvailable };
}
