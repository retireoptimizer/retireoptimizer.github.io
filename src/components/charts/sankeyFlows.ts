import { palette } from './setup';
import type { ProjectionRow } from '../../engine/projection';

/** Where a source's money may go.
 *  - general: pays its tax share, then spreads across spending, ACA, and savings
 *  - brokTax: pays tax first; anything left over joins the general pool
 *  - toRoth / deposit / spend / save: pinned to that single use */
export type SankeyRoute = 'general' | 'brokTax' | 'toRoth' | 'deposit' | 'spend' | 'save';

/** A source of money on the left. `taxBase` is the slice of this source that lands in
 *  taxable income, and it is what the tax allocation is keyed off. */
export interface SankeySource {
  id: string;
  label: string;
  value: number;
  color: string;
  taxBase: number;
  route: SankeyRoute;
}

export interface SankeyUse { id: string; label: string; value: number; color: string; }

export interface SankeyLink { source: string; target: string; amount: number; }

export interface SankeyFlows { sources: SankeySource[]; uses: SankeyUse[]; links: SankeyLink[]; }

const EPS = 0.005;

/**
 * Builds the single-year cash ledger behind the Sankey. Every dollar on the left lands
 * on exactly one use on the right, so both columns total the same.
 *
 * Tax is assigned in two steps. Money pulled from the brokerage account to pay tax goes
 * to the tax bars first. The rest of the bill is spread over the cash sources by their
 * share of taxable income, never more than a source brought in. The Roth conversion and
 * one-time deposits move money between accounts, so they carry no tax ribbon.
 */
export function buildSankeyFlows(row: ProjectionRow, real = true): SankeyFlows {
  const scale = (n: number) => (real ? n / row.inflationFactor : n);

  // ---- Tax bases (nominal) -----------------------------------------------------------
  // ordIncome = taxable SS + taxable other income + pre-tax draws + RMD + conversion
  //             + inherited ordinary income + ordinary dividends. Back out taxable SS,
  //             which the row does not carry on its own.
  const ordDriversExSS = row.otherIncomeTaxable + row.wdTrd + row.rmd + row.rothConv
    + row.lumpSumOrdinaryIncome + row.ordinaryDiv;
  const taxableSS = Math.max(0, row.ordIncome - ordDriversExSS);
  const realizedGains = Math.max(0, row.ltcg - row.qualifiedDiv);

  const brokTaxPull = Math.min(row.taxFromBrokerage ?? 0, row.wdTax);
  const wdTaxNet = row.wdTax - brokTaxPull;
  const gainsOnWd = row.wdTax > 0 ? realizedGains * (wdTaxNet / row.wdTax) : 0;
  const inheritedCash = (row.lumpSumOrdinaryIncome ?? 0) + (row.lumpSumForcedRothDist ?? 0);
  const deposits = (row.lumpSumInjectTaxable ?? 0) + (row.lumpSumInjectTrad ?? 0) + (row.lumpSumInjectRoth ?? 0);
  const contributions = row.contribA + row.contribB;

  // ---- Sources -----------------------------------------------------------------------
  const raw: SankeySource[] = [
    { id: 'wdTax', label: 'Withdrawal · Taxable', value: wdTaxNet, color: palette.bucketTaxable,
      taxBase: gainsOnWd, route: 'general' },
    { id: 'brokTax', label: 'Brokerage · Tax payment', value: brokTaxPull, color: palette.warningLight,
      taxBase: 0, route: 'brokTax' },
    { id: 'wdTrd', label: 'Withdrawal · Pre-tax', value: row.wdTrd, color: palette.bucketTrad,
      taxBase: row.wdTrd, route: 'general' },
    { id: 'rmd', label: 'RMD · Pre-tax', value: row.rmd, color: palette.warning,
      taxBase: row.rmd, route: 'general' },
    { id: 'wdRth', label: 'Withdrawal · Roth', value: row.wdRth, color: palette.bucketRoth,
      taxBase: 0, route: 'general' },
    { id: 'ss', label: 'Social Security', value: row.totalSS, color: palette.goldLight,
      taxBase: taxableSS, route: 'general' },
    { id: 'oth', label: 'Other Income', value: row.otherIncome, color: palette.incomeOther,
      taxBase: row.otherIncomeTaxable, route: 'general' },
    { id: 'div', label: 'Dividends (paid out)', value: row.distributedCash ?? 0, color: palette.goldPale,
      taxBase: row.distributedDiv ?? 0, route: 'general' },
    { id: 'inh', label: 'Inherited account withdrawals', value: inheritedCash, color: palette.gold,
      taxBase: row.lumpSumOrdinaryIncome ?? 0, route: 'general' },
    { id: 'contrib', label: 'Contributions from pay', value: contributions, color: palette.successLight,
      taxBase: 0, route: 'save' },
    { id: 'conv', label: 'Roth Conversion', value: row.rothConv, color: palette.navyLight,
      taxBase: 0, route: 'toRoth' },
    { id: 'lump', label: 'One-time money received', value: deposits, color: palette.gold,
      taxBase: 0, route: 'deposit' },
    { id: 'gap', label: 'Unfunded Spending', value: row.shortfall ?? 0, color: palette.danger,
      taxBase: 0, route: 'spend' },
  ];
  const sources = raw
    .map((s) => ({ ...s, value: scale(s.value), taxBase: scale(s.taxBase) }))
    .filter((s) => s.value > EPS);

  // ---- Use totals --------------------------------------------------------------------
  const fedTax = scale(row.fedTax);
  const otherTax = scale(row.stateTaxAmt + row.irmaa + row.niit);
  const aca = scale(row.acaPremium ?? 0);
  const spending = scale(row.netSpend);
  const taxPool = fedTax + otherTax;
  const fedShare = taxPool > 0 ? fedTax / taxPool : 0;

  // ---- Tax allocation ----------------------------------------------------------------
  const taxAlloc = new Map<string, number>(sources.map((s) => [s.id, 0]));
  let unplaced = taxPool;

  // 1. Brokerage tax payment covers the bill first.
  for (const s of sources.filter((n) => n.route === 'brokTax')) {
    const t = Math.min(s.value, unplaced);
    taxAlloc.set(s.id, t);
    unplaced -= t;
  }

  // 2. The rest spreads over general cash sources by tax base, capped at each source's
  //    value. With no tax base left, spread by value. Overflow goes to sources with room.
  const general = sources.filter((n) => n.route === 'general');
  if (unplaced > EPS && general.length > 0) {
    const totalBase = general.reduce((s, n) => s + n.taxBase, 0);
    const key = (n: SankeySource) => (totalBase > 0 ? n.taxBase : n.value);
    const keyTotal = totalBase > 0 ? totalBase : general.reduce((s, n) => s + n.value, 0);
    const pool = unplaced;
    for (const n of general) {
      const want = keyTotal > 0 ? Math.min(pool * (key(n) / keyTotal), n.value) : 0;
      taxAlloc.set(n.id, want);
      unplaced -= want;
    }
    if (unplaced > EPS) {
      const room = general.map((n) => ({ id: n.id, free: Math.max(0, n.value - taxAlloc.get(n.id)!) }));
      const totalRoom = room.reduce((s, r) => s + r.free, 0);
      if (totalRoom > 0) {
        const spill = Math.min(unplaced, totalRoom);
        for (const r of room) taxAlloc.set(r.id, taxAlloc.get(r.id)! + spill * (r.free / totalRoom));
        unplaced -= spill;
      }
    }
  }
  unplaced = Math.max(0, unplaced);

  // ---- General pool ------------------------------------------------------------------
  const afterTax = (s: SankeySource) => Math.max(0, s.value - taxAlloc.get(s.id)!);
  const pooled = sources.filter((n) => n.route === 'general' || n.route === 'brokTax');
  const poolAfterTax = pooled.reduce((s, n) => s + afterTax(n), 0);
  const fromGap = sources.filter((n) => n.route === 'spend').reduce((s, n) => s + n.value, 0);
  const spendFromPool = Math.max(0, spending - fromGap);
  const savingsFromPool = poolAfterTax - spendFromPool - aca;

  // Safety node: uses outrunning sources means the row drew on the portfolio in a way its
  // cash fields do not name. It should never appear for a valid plan.
  const deficit = Math.max(0, -savingsFromPool);
  const otherDraw = unplaced + deficit;
  if (otherDraw > EPS) {
    const draw: SankeySource = { id: 'draw', label: 'Other Portfolio Draw', value: otherDraw,
      color: palette.textMuted, taxBase: 0, route: 'general' };
    sources.push(draw);
    pooled.push(draw);
    taxAlloc.set('draw', unplaced);
  }
  const pool = poolAfterTax + (otherDraw > EPS ? deficit : 0);
  const savings = Math.max(0, savingsFromPool);
  const toSave = sources.filter((n) => n.route === 'save').reduce((s, n) => s + n.value, 0);

  const uses: SankeyUse[] = [
    { id: 'spend', label: 'Net Spending', value: spending, color: palette.danger },
    { id: 'fed', label: 'Federal Tax', value: fedTax, color: palette.warning },
    { id: 'state', label: 'State + IRMAA + NIIT', value: otherTax, color: palette.taxOther },
    { id: 'aca', label: 'ACA Premium', value: aca, color: palette.acaBar },
    { id: 'toRoth', label: 'Converted to Roth', value: scale(row.rothConv), color: palette.bucketRoth },
    { id: 'deposit', label: 'Deposited to accounts', value: scale(deposits), color: palette.gold },
    { id: 'save', label: 'Net Savings', value: savings + toSave, color: palette.success },
  ].filter((n) => n.value > EPS);

  // ---- Links (per source, in right-column order so ribbons do not cross) -------------
  const poolShare = (target: string) => {
    if (pool <= 0) return 0;
    if (target === 'spend') return spendFromPool / pool;
    if (target === 'aca') return aca / pool;
    if (target === 'save') return savings / pool;
    return 0;
  };
  const links: SankeyLink[] = [];
  for (const src of sources) {
    const tax = taxAlloc.get(src.id) ?? 0;
    const rest = src.value - tax;
    for (const u of uses) {
      let amount = 0;
      if (src.route === 'general' || src.route === 'brokTax') {
        if (u.id === 'fed') amount = tax * fedShare;
        else if (u.id === 'state') amount = tax * (1 - fedShare);
        else amount = rest * poolShare(u.id);
      } else if (u.id === src.route) {
        amount = src.value;
      }
      if (amount > EPS) links.push({ source: src.id, target: u.id, amount });
    }
  }

  return { sources, uses, links };
}
