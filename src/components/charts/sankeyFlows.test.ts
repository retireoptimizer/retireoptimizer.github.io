import { describe, it, expect } from 'vitest';
import { buildSankeyFlows } from './sankeyFlows';
import { runProjection, type ProjectionRow } from '../../engine/projection';
import type { Plan, LumpSumEvent } from '../../schemas/plan';
import * as G from '../../engine/__golden/plans';

const golden = (Object.entries(G).filter(([, f]) => typeof f === 'function') as [string, () => Plan][])
  .map(([name, make]) => [name, make()] as [string, Plan]);

function singlePlan(): Plan {
  const p = G.planB_largeTradSingle();
  p.portfolio.personA = { ...p.portfolio.personA, taxable: 1_500_000, taxableBasis: 900_000 };
  return p;
}
const inherit = (bucket: LumpSumEvent['bucket'], amount: number): LumpSumEvent =>
  ({ id: bucket, description: bucket, whose: 'A', bucket, age: 66, amount });
const withEvents = (events: LumpSumEvent[], strat: Plan['withdrawalStrategy'] = 'taxfirst') => {
  const p = singlePlan(); p.withdrawalStrategy = strat; p.lumpSumEvents = events; return p;
};
const convBrok = () => {
  const p = singlePlan();
  p.conversion = { ...p.conversion, mode: 'bracket-fill', startAge: 65, endAge: 72 };
  p.payTaxFromBrokerage = true;
  return p;
};

const extra: [string, Plan][] = [
  ['inherited HSA', withEvents([inherit('inheritedHSA', 50_000)])],
  ['inherited IRA taxfirst', withEvents([inherit('inheritedPreTaxIRA', 100_000)])],
  ['inherited IRA tradfirst', withEvents([inherit('inheritedPreTaxIRA', 100_000)], 'tradfirst')],
  ['inherited Roth', withEvents([inherit('inheritedRoth', 100_000)])],
  ['taxable gift', withEvents([inherit('taxable', 50_000)])],
  ['conversion + pay tax from brokerage', convBrok()],
];

const TAX = new Set(['fed', 'state']);
const sum = (xs: { value: number }[]) => xs.reduce((s, n) => s + n.value, 0);

function checkRow(row: ProjectionRow, real: boolean) {
  const f = buildSankeyFlows(row, real);
  const sc = (n: number) => (real ? n / row.inflationFactor : n);
  const tag = `age ${row.ageA}`;

  // Sources total = uses total, and links account for every dollar on both sides.
  expect(Math.abs(sum(f.sources) - sum(f.uses)), tag).toBeLessThan(0.5);
  for (const s of f.sources) {
    const out = f.links.filter((l) => l.source === s.id).reduce((a, l) => a + l.amount, 0);
    expect(Math.abs(out - s.value), `${tag} ${s.id}`).toBeLessThan(0.05);
  }
  for (const u of f.uses) {
    const inn = f.links.filter((l) => l.target === u.id).reduce((a, l) => a + l.amount, 0);
    expect(Math.abs(inn - u.value), `${tag} ${u.id}`).toBeLessThan(0.05);
  }

  // Converted to Roth is the full conversion, fed only by the conversion.
  const toRoth = f.uses.find((u) => u.id === 'toRoth')?.value ?? 0;
  expect(toRoth, tag).toBeCloseTo(sc(row.rothConv), 6);
  for (const l of f.links.filter((l) => l.source === 'conv')) expect(l.target, tag).toBe('toRoth');

  // Brokerage tax payment feeds tax bars only.
  for (const l of f.links.filter((l) => l.source === 'brokTax')) expect(TAX.has(l.target), tag).toBe(true);

  // Roth withdrawals never feed a tax bar.
  expect(f.links.some((l) => l.source === 'wdRth' && TAX.has(l.target)), tag).toBe(false);

  // Net Savings ties to engine savings.
  const save = f.uses.find((u) => u.id === 'save')?.value ?? 0;
  expect(Math.abs(save - sc(row.cashSurplus + row.contribA + row.contribB)), tag).toBeLessThan(1);

  // The safety node should never appear for a valid plan.
  const draw = f.sources.find((s) => s.id === 'draw')?.value ?? 0;
  expect(draw, tag).toBeLessThan(1);
}

describe('buildSankeyFlows', () => {
  for (const [name, plan] of [...golden, ...extra]) {
    it(`${name}: ledger balances and ties to the engine every year`, () => {
      for (const row of runProjection(plan).rows) {
        checkRow(row, true);
        checkRow(row, false);
      }
    });
  }

  it('conversion + brokerage plan actually exercises the brokerage tax node', () => {
    const rows = runProjection(convBrok()).rows;
    const hits = rows.filter((r) => buildSankeyFlows(r).links.some((l) => l.source === 'brokTax'));
    expect(hits.length).toBeGreaterThan(0);
  });

  it('inheritance years show inherited cash as income', () => {
    const row = runProjection(extra[0][1]).rows.find((r) => r.ageA === 66)!;
    const inh = buildSankeyFlows(row, false).sources.find((s) => s.id === 'inh');
    expect(inh?.value).toBeCloseTo(50_000, 0);
  });

  it('depletion years route unfunded spending to Net Spending only', () => {
    const p = G.planA_simple();
    p.expenseStreams = p.expenseStreams.map((e) => ({ ...e, annualAmount: e.annualAmount * 3 }));
    const rows = runProjection(p).rows.filter((r) => r.shortfall > 0);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      checkRow(row, true);
      const gapLinks = buildSankeyFlows(row).links.filter((l) => l.source === 'gap');
      expect(gapLinks.map((l) => l.target)).toEqual(['spend']);
    }
  });
});
