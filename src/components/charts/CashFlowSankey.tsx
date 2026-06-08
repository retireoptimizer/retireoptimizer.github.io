import { palette, fmtFull } from './setup';
import type { ProjectionRow } from '../../engine/projection';

interface Props {
  row: ProjectionRow;
  height?: number;
}

interface Node { id: string; label: string; value: number; color: string; }

/**
 * Lightweight custom-SVG cash-flow sankey for a single year.
 * Sources (left) → bus (middle) → Uses (right). Ribbon widths ∝ $ amount.
 */
export default function CashFlowSankey({ row, height = 320 }: Props) {
  const inf = row.inflationFactor;
  // Inflows (real $)
  const inflows: Node[] = [
    { id: 'wdTax', label: 'Withdrawal · Taxable', value: row.wdTax / inf, color: palette.success },
    { id: 'wdTrd', label: 'Withdrawal · Pre-tax', value: row.wdTrd / inf, color: palette.navy },
    { id: 'rmd',   label: 'RMD · Pre-tax', value: row.rmd / inf, color: palette.warning },
    { id: 'wdRth', label: 'Withdrawal · Roth', value: row.wdRth / inf, color: palette.gold },
    { id: 'ss',    label: 'Social Security', value: row.totalSS / inf, color: palette.goldLight },
    { id: 'oth',   label: 'Other Income', value: row.otherIncome / inf, color: palette.incomeOther },
  ].filter((n) => n.value > 0);

  const totalIn = inflows.reduce((s, n) => s + n.value, 0);

  const fedTax = row.fedTax / inf;
  const stateTax = row.stateTaxAmt / inf;
  const irmaa = row.irmaa / inf;
  const spending = row.netSpend / inf;
  const savings = Math.max(0, totalIn - spending - fedTax - stateTax - irmaa);

  const outflows: Node[] = [
    { id: 'spend',  label: 'Net Spending', value: spending, color: palette.danger },
    { id: 'fed',    label: 'Federal Tax', value: fedTax, color: palette.warning },
    { id: 'state',  label: 'State + IRMAA', value: stateTax + irmaa, color: palette.taxOther },
    { id: 'save',   label: 'Net Savings', value: savings, color: palette.success },
  ].filter((n) => n.value > 0);

  const totalOut = outflows.reduce((s, n) => s + n.value, 0);

  const width = 720;
  const padding = 16;
  const nodeWidth = 14;
  const usableH = height - padding * 2;
  const gap = 6;

  // Compute y-positions proportional to value
  const layoutColumn = (nodes: Node[], total: number, x: number) => {
    let y = padding;
    const totalGap = gap * Math.max(0, nodes.length - 1);
    const scale = (usableH - totalGap) / Math.max(total, 1);
    return nodes.map((n) => {
      const h = n.value * scale;
      const node = { ...n, x, y, h };
      y += h + gap;
      return node;
    });
  };

  const left = layoutColumn(inflows, totalIn, padding);
  const right = layoutColumn(outflows, totalOut, width - padding - nodeWidth);

  // For each source ribbon: distribute proportionally across uses
  const ribbons: Array<{ d: string; color: string; opacity: number; key: string; }> = [];
  // Track offsets on right side
  const rightOffsets = right.map((n) => ({ id: n.id, used: 0, y: n.y, h: n.h }));
  for (const src of left) {
    let srcOffset = 0;
    for (const dst of right) {
      // Amount flowing src→dst = src.value × (dst.value/totalOut)
      const amount = src.value * (dst.value / totalOut);
      if (amount <= 0) continue;
      const scale = src.h / src.value;
      const ribbonH = amount * scale;
      const srcY = src.y + srcOffset;
      const srcY2 = srcY + ribbonH;
      const rOff = rightOffsets.find((r) => r.id === dst.id)!;
      const dstY = rOff.y + rOff.used;
      const dstY2 = dstY + ribbonH;
      rOff.used += ribbonH;
      srcOffset += ribbonH;

      const x1 = src.x + nodeWidth;
      const x2 = right[0].x;
      const cx = (x1 + x2) / 2;
      const d = `M ${x1} ${srcY} C ${cx} ${srcY}, ${cx} ${dstY}, ${x2} ${dstY} L ${x2} ${dstY2} C ${cx} ${dstY2}, ${cx} ${srcY2}, ${x1} ${srcY2} Z`;
      ribbons.push({ d, color: src.color, opacity: 0.35, key: `${src.id}-${dst.id}` });
    }
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height }}>
        {ribbons.map((r) => (
          <path key={r.key} d={r.d} fill={r.color} opacity={r.opacity} />
        ))}
        {left.map((n) => (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={nodeWidth} height={n.h} fill={n.color} rx={2} />
            <text x={n.x - 6} y={n.y + n.h / 2} fontSize={11} textAnchor="end" dominantBaseline="middle" fill="#0d1b2e">
              {n.label}
            </text>
            <text x={n.x - 6} y={n.y + n.h / 2 + 14} fontSize={10} textAnchor="end" dominantBaseline="middle" fill={palette.textMuted}>
              {fmtFull(n.value)}
            </text>
          </g>
        ))}
        {right.map((n) => (
          <g key={n.id}>
            <rect x={n.x} y={n.y} width={nodeWidth} height={n.h} fill={n.color} rx={2} />
            <text x={n.x + nodeWidth + 6} y={n.y + n.h / 2} fontSize={11} textAnchor="start" dominantBaseline="middle" fill="#0d1b2e">
              {n.label}
            </text>
            <text x={n.x + nodeWidth + 6} y={n.y + n.h / 2 + 14} fontSize={10} textAnchor="start" dominantBaseline="middle" fill={palette.textMuted}>
              {fmtFull(n.value)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
