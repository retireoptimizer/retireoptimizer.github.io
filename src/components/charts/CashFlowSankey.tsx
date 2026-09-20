import { palette, fmtFull } from './setup';
import type { ProjectionRow } from '../../engine/projection';

interface Props {
  row: ProjectionRow;
  real?: boolean;
  height?: number;
}

/** A source of money on the left. `taxBase` is the slice of this source that lands in
 *  federal taxable income, and it is what the tax allocation below is keyed off.
 *  `dedicated` pins a source to a single use instead of spreading it across all uses. */
interface Source {
  id: string;
  label: string;
  value: number;
  color: string;
  taxBase: number;
  dedicated?: string;
}

interface Use { id: string; label: string; value: number; color: string; }

/**
 * Lightweight custom-SVG cash-flow sankey for a single year.
 * Sources (left) → Uses (right). Ribbon widths ∝ $ amount.
 *
 * Ribbons are not spread evenly across every use. Tax dollars are allocated to each
 * source by that source's share of federal taxable income, so Roth withdrawals never
 * feed a tax node and pre-tax money carries the tax it actually generates. Everything
 * left over after tax flows to spending, premiums, and savings.
 */
export default function CashFlowSankey({ row, real = true, height = 320 }: Props) {
  const scale = (n: number) => real ? n / row.inflationFactor : n;

  // ---- Tax bases (nominal, scaled alongside the cash amounts below) ------------------
  // ordIncome = taxable SS + taxable other income + pre-tax draws + RMD + conversion
  //             + inherited ordinary income + ordinary dividends. Back out taxable SS,
  //             which the row does not carry on its own.
  const ordDriversExSS = row.otherIncomeTaxable + row.wdTrd + row.rmd + row.rothConv
    + row.lumpSumOrdinaryIncome + row.ordinaryDiv;
  const taxableSS = Math.max(0, row.ordIncome - ordDriversExSS);
  const realizedGains = Math.max(0, row.ltcg - row.qualifiedDiv);
  const dividendBase = row.ordinaryDiv + row.qualifiedDiv;
  const hasCashDividends = row.distributedCash > 0;

  const lumpTotal = (row.lumpSumInjectTaxable ?? 0) + (row.lumpSumInjectTrad ?? 0)
    + (row.lumpSumInjectRoth ?? 0) + (row.lumpSumForcedTradDist ?? 0) + (row.lumpSumForcedRothDist ?? 0);

  // ---- Sources --------------------------------------------------------------------
  const sources: Source[] = [
    { id: 'wdTax', label: 'Withdrawal · Taxable', value: scale(row.wdTax), color: palette.bucketTaxable,
      taxBase: scale(realizedGains + (hasCashDividends ? 0 : dividendBase)) },
    { id: 'wdTrd', label: 'Withdrawal · Pre-tax', value: scale(row.wdTrd), color: palette.bucketTrad,
      taxBase: scale(row.wdTrd) },
    { id: 'rmd',   label: 'RMD · Pre-tax', value: scale(row.rmd), color: palette.warning,
      taxBase: scale(row.rmd) },
    { id: 'wdRth', label: 'Withdrawal · Roth', value: scale(row.wdRth), color: palette.bucketRoth,
      taxBase: 0 },
    { id: 'conv',  label: 'Roth Conversion', value: scale(row.rothConv), color: palette.navyLight,
      taxBase: scale(row.rothConv), dedicated: 'toRoth' },
    { id: 'ss',    label: 'Social Security', value: scale(row.totalSS), color: palette.goldLight,
      taxBase: scale(taxableSS) },
    { id: 'oth',   label: 'Other Income', value: scale(row.otherIncome), color: palette.incomeOther,
      taxBase: scale(row.otherIncomeTaxable) },
    { id: 'div',   label: 'Dividends (paid out)', value: scale(row.distributedCash ?? 0), color: palette.goldPale,
      taxBase: hasCashDividends ? scale(dividendBase) : 0 },
    { id: 'lump',  label: 'One-Time & Inherited', value: scale(lumpTotal), color: palette.gold,
      taxBase: scale(row.lumpSumOrdinaryIncome ?? 0) },
    { id: 'gap',   label: 'Unfunded Spending', value: scale(row.shortfall ?? 0), color: palette.danger,
      taxBase: 0, dedicated: 'spend' },
  ].filter((n) => n.value > 0);

  // ---- Uses -------------------------------------------------------------------------
  const fedTax = scale(row.fedTax);
  const otherTax = scale(row.stateTaxAmt + row.irmaa + row.niit);
  const aca = scale(row.acaPremium ?? 0);
  const spending = scale(row.netSpend);

  // Allocate the whole tax bill across sources by share of federal taxable income,
  // never letting a source pay more tax than it brought in. Anything a capped source
  // cannot carry moves to the sources that still have room.
  const taxPool = fedTax + otherTax;
  const totalTaxBase = sources.reduce((s, n) => s + n.taxBase, 0);
  const taxAlloc = new Map<string, number>(sources.map((n) => [n.id, 0]));
  if (taxPool > 0 && totalTaxBase > 0) {
    let unplaced = taxPool;
    for (const n of sources) {
      const want = Math.min(taxPool * (n.taxBase / totalTaxBase), n.value);
      taxAlloc.set(n.id, want);
      unplaced -= want;
    }
    if (unplaced > 0.005) {
      const room = sources.map((n) => ({ id: n.id, free: n.value - taxAlloc.get(n.id)! }));
      const totalRoom = room.reduce((s, r) => s + Math.max(0, r.free), 0);
      if (totalRoom > 0) {
        for (const r of room) {
          if (r.free <= 0) continue;
          taxAlloc.set(r.id, taxAlloc.get(r.id)! + unplaced * (r.free / totalRoom));
        }
      }
    }
  }
  const placedTax = sources.reduce((s, n) => s + taxAlloc.get(n.id)!, 0);
  const fedShare = placedTax > 0 ? fedTax / placedTax : 0;

  // What is left of each source once its tax share is taken out.
  const afterTax = new Map<string, number>(
    sources.map((n) => [n.id, Math.max(0, n.value - taxAlloc.get(n.id)!)]),
  );

  const toRoth = sources.filter((n) => n.dedicated === 'toRoth')
    .reduce((s, n) => s + afterTax.get(n.id)!, 0);
  const fromGap = sources.filter((n) => n.dedicated === 'spend')
    .reduce((s, n) => s + afterTax.get(n.id)!, 0);
  const generalPool = sources.filter((n) => !n.dedicated)
    .reduce((s, n) => s + afterTax.get(n.id)!, 0);

  const spendFromGeneral = Math.max(0, spending - fromGap);
  let savings = generalPool - spendFromGeneral - aca;
  // Uses outrunning sources means the year drew on the portfolio in a way the row's
  // cash fields do not name. Show it rather than letting the two columns silently
  // scale to different totals.
  let otherDraw = 0;
  if (savings < -0.005) { otherDraw = -savings; savings = 0; }
  if (otherDraw > 0) {
    sources.push({ id: 'draw', label: 'Other Portfolio Draw', value: otherDraw, color: palette.textMuted, taxBase: 0 });
    taxAlloc.set('draw', 0);
    afterTax.set('draw', otherDraw);
  }

  const uses: Use[] = [
    { id: 'spend',  label: 'Net Spending', value: spending, color: palette.danger },
    { id: 'fed',    label: 'Federal Tax', value: fedTax, color: palette.warning },
    { id: 'state',  label: 'State + IRMAA + NIIT', value: otherTax, color: palette.taxOther },
    { id: 'aca',    label: 'ACA Premium', value: aca, color: palette.acaBar },
    { id: 'toRoth', label: 'To Roth (after conversion tax)', value: toRoth, color: palette.bucketRoth },
    { id: 'save',   label: 'Net Savings', value: savings, color: palette.success },
  ].filter((n) => n.value > 0.005);

  const totalIn = sources.reduce((s, n) => s + n.value, 0);
  const totalOut = uses.reduce((s, n) => s + n.value, 0);

  const width = 720;
  const padding = 16;
  const nodeWidth = 14;
  const usableH = height - padding * 2;
  const gap = 6;

  // Both columns share one scale so a balanced ledger reads as two equal stacks.
  const columnTotal = Math.max(totalIn, totalOut, 1);
  const layoutColumn = <T extends { value: number }>(nodes: T[], x: number) => {
    let y = padding;
    const maxCount = Math.max(sources.length, uses.length);
    const totalGap = gap * Math.max(0, maxCount - 1);
    const px = (usableH - totalGap) / columnTotal;
    return nodes.map((n) => {
      const h = n.value * px;
      const node = { ...n, x, y, h };
      y += h + gap;
      return node;
    });
  };

  const left = layoutColumn(sources, padding);
  const right = layoutColumn(uses, width - padding - nodeWidth);
  const rightById = new Map(right.map((n) => [n.id, n]));

  // Per-source ribbon targets, in right-column order so ribbons do not cross.
  const targetsFor = (src: Source): Array<{ id: string; amount: number }> => {
    const out: Array<{ id: string; amount: number }> = [];
    const rest = afterTax.get(src.id)!;
    const tax = taxAlloc.get(src.id)!;
    for (const u of uses) {
      if (u.id === 'fed') { out.push({ id: u.id, amount: tax * fedShare }); continue; }
      if (u.id === 'state') { out.push({ id: u.id, amount: tax * (1 - fedShare) }); continue; }
      if (src.dedicated) { if (u.id === src.dedicated) out.push({ id: u.id, amount: rest }); continue; }
      if (u.id === 'toRoth') continue;
      if (u.id === 'spend') { out.push({ id: u.id, amount: generalPool > 0 ? rest * (spendFromGeneral / generalPool) : 0 }); continue; }
      if (u.id === 'aca') { out.push({ id: u.id, amount: generalPool > 0 ? rest * (aca / generalPool) : 0 }); continue; }
      if (u.id === 'save') { out.push({ id: u.id, amount: generalPool > 0 ? rest * (savings / generalPool) : 0 }); continue; }
    }
    return out.filter((t) => t.amount > 0.005);
  };

  const ribbons: Array<{ d: string; color: string; opacity: number; key: string; }> = [];
  const rightOffsets = new Map(right.map((n) => [n.id, 0]));
  const x2 = width - padding - nodeWidth;
  for (const src of left) {
    let srcOffset = 0;
    const px = src.value > 0 ? src.h / src.value : 0;
    for (const t of targetsFor(src)) {
      const dstNode = rightById.get(t.id);
      if (!dstNode) continue;
      const ribbonH = t.amount * px;
      const srcY = src.y + srcOffset;
      const srcY2 = srcY + ribbonH;
      const used = rightOffsets.get(t.id)!;
      const dstY = dstNode.y + used;
      const dstY2 = dstY + ribbonH;
      rightOffsets.set(t.id, used + ribbonH);
      srcOffset += ribbonH;

      const x1 = src.x + nodeWidth;
      const cx = (x1 + x2) / 2;
      const d = `M ${x1} ${srcY} C ${cx} ${srcY}, ${cx} ${dstY}, ${x2} ${dstY} L ${x2} ${dstY2} C ${cx} ${dstY2}, ${cx} ${srcY2}, ${x1} ${srcY2} Z`;
      ribbons.push({ d, color: src.color, opacity: 0.35, key: `${src.id}-${t.id}` });
    }
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height }}>
        {ribbons.map((r) => (
          <path key={r.key} data-flow={r.key} d={r.d} fill={r.color} opacity={r.opacity} />
        ))}
        {left.map((n) => (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={nodeWidth} height={n.h} fill={n.color} rx={2} />
            {n.h >= 11 && (
              <text x={n.x - 6} y={n.y + n.h / 2} fontSize={11} textAnchor="end" dominantBaseline="middle" fill="#0d1b2e">
                {n.label}
              </text>
            )}
            {n.h >= 24 && (
              <text x={n.x - 6} y={n.y + n.h / 2 + 14} fontSize={10} textAnchor="end" dominantBaseline="middle" fill={palette.textMuted}>
                {fmtFull(n.value)}
              </text>
            )}
          </g>
        ))}
        {right.map((n) => (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={nodeWidth} height={n.h} fill={n.color} rx={2} />
            {n.h >= 11 && (
              <text x={n.x + nodeWidth + 6} y={n.y + n.h / 2} fontSize={11} textAnchor="start" dominantBaseline="middle" fill="#0d1b2e">
                {n.label}
              </text>
            )}
            {n.h >= 24 && (
              <text x={n.x + nodeWidth + 6} y={n.y + n.h / 2 + 14} fontSize={10} textAnchor="start" dominantBaseline="middle" fill={palette.textMuted}>
                {fmtFull(n.value)}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div style={{ fontSize: 10, color: palette.textMuted, lineHeight: 1.5, marginTop: 6 }}>
        Tax ribbons split the tax bill across sources by each source's share of taxable income.
        Roth withdrawals are tax free, so they never feed a tax bar. The split is a way of
        assigning a joint tax bill, not a line item ledger.
      </div>
    </div>
  );
}
