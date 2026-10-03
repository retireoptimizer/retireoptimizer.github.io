import { palette, fmtFull } from './setup';
import type { ProjectionRow } from '../../engine/projection';
import { buildSankeyFlows } from './sankeyFlows';

interface Props {
  row: ProjectionRow;
  real?: boolean;
  height?: number;
}

/**
 * Lightweight custom-SVG cash-flow sankey for a single year.
 * Sources (left) → Uses (right). Ribbon widths ∝ $ amount.
 * The ledger itself is built in `sankeyFlows.ts`; this component only lays it out.
 */
export default function CashFlowSankey({ row, real = true, height = 320 }: Props) {
  const { sources, uses, links } = buildSankeyFlows(row, real);

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

  const linksBySource = new Map<string, typeof links>();
  for (const l of links) linksBySource.set(l.source, [...(linksBySource.get(l.source) ?? []), l]);

  const ribbons: Array<{ d: string; color: string; opacity: number; key: string; }> = [];
  const rightOffsets = new Map(right.map((n) => [n.id, 0]));
  const x2 = width - padding - nodeWidth;
  for (const src of left) {
    let srcOffset = 0;
    const px = src.value > 0 ? src.h / src.value : 0;
    for (const t of linksBySource.get(src.id) ?? []) {
      const dstNode = rightById.get(t.target);
      if (!dstNode) continue;
      const ribbonH = t.amount * px;
      const srcY = src.y + srcOffset;
      const srcY2 = srcY + ribbonH;
      const used = rightOffsets.get(t.target)!;
      const dstY = dstNode.y + used;
      const dstY2 = dstY + ribbonH;
      rightOffsets.set(t.target, used + ribbonH);
      srcOffset += ribbonH;

      const x1 = src.x + nodeWidth;
      const cx = (x1 + x2) / 2;
      const d = `M ${x1} ${srcY} C ${cx} ${srcY}, ${cx} ${dstY}, ${x2} ${dstY} L ${x2} ${dstY2} C ${cx} ${dstY2}, ${cx} ${srcY2}, ${x1} ${srcY2} Z`;
      ribbons.push({ d, color: src.color, opacity: 0.35, key: `${src.id}-${t.target}` });
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
        Tax ribbons share the year's tax bill among the money sources. Money taken from the
        brokerage account to pay tax goes straight to the tax bars. The rest of the bill is
        split by how much taxable income each source adds, so Roth withdrawals never feed a
        tax bar. The Roth conversion and one-time money move between accounts and carry no tax.
      </div>
    </div>
  );
}
