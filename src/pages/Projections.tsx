import { useState } from 'react';
import { useProjection, usePlanStore } from '../store/usePlanStore';
import type { DisplayMode } from '../store/usePlanStore';
import { fmtUSD } from '../lib/format';
import CashFlowsBalanced from '../components/charts/CashFlowsBalanced';
import WhatIfBar from '../components/WhatIfBar';
import ChartFrame from '../components/charts/ChartFrame';

const fmt = (n: number, mode: DisplayMode, inflF: number): string => {
  if (!isFinite(n) || n === 0) return '—';
  const v = mode === 'real' ? n / inflF : n;
  return fmtUSD(v);
};

// Sticky-cell base style; per-column `left` offsets stack against each other.
const stickyTh = (left: number, bg = '#0d1b2e10', minWidth = 60): React.CSSProperties => ({
  position: 'sticky', left, background: bg, zIndex: 4, minWidth,
});
const stickyTd = (left: number, bg = '#fff', minWidth = 60): React.CSSProperties => ({
  position: 'sticky', left, background: bg, zIndex: 2, minWidth,
});

type Row = ReturnType<typeof useProjection>['rows'][number];
type GroupKey = 'income' | 'taxes' | 'balances';

interface Column {
  key: string;
  label: string;
  group: 'identity' | GroupKey;
  essential: boolean;
  fmt?: 'money' | 'pct' | 'raw';
  get: (r: Row) => number | string;
  bg: string;
}

const COLUMNS: Column[] = [
  // Identity (always shown)
  { key: 'year', label: 'Yr', group: 'identity', essential: true, fmt: 'raw', get: (r) => r.year, bg: '#0d1b2e10' },
  { key: 'ageA', label: 'Age A', group: 'identity', essential: true, fmt: 'raw', get: (r) => r.ageA, bg: '#0d1b2e10' },
  { key: 'ageB', label: 'Age B', group: 'identity', essential: true, fmt: 'raw', get: (r) => r.ageB ?? '—', bg: '#0d1b2e10' },
  { key: 'phase', label: 'Phase', group: 'identity', essential: true, fmt: 'raw', get: (r) => r.phase, bg: '#0d1b2e10' },

  // Income
  { key: 'contribA', label: 'Contrib A', group: 'income', essential: false, fmt: 'money', get: (r) => r.contribA, bg: 'rgba(201,168,76,0.12)' },
  { key: 'contribB', label: 'Contrib B', group: 'income', essential: false, fmt: 'money', get: (r) => r.contribB, bg: 'rgba(201,168,76,0.12)' },
  { key: 'totalSS', label: 'Total SS', group: 'income', essential: true, fmt: 'money', get: (r) => r.totalSS, bg: 'rgba(26,138,90,0.1)' },
  { key: 'otherIncome', label: 'Other Inc', group: 'income', essential: true, fmt: 'money', get: (r) => r.otherIncome, bg: 'rgba(26,138,90,0.1)' },
  { key: 'lumpSumInject', label: 'Lump Sum', group: 'income', essential: true, fmt: 'money', get: (r) => (r.lumpSumInjectTaxable ?? 0) + (r.lumpSumInjectTrad ?? 0) + (r.lumpSumInjectRoth ?? 0), bg: 'rgba(26,138,90,0.1)' },
  { key: 'cashSurplus', label: 'Cash Surplus', group: 'income', essential: false, fmt: 'money', get: (r) => r.cashSurplus ?? 0, bg: 'rgba(26,138,90,0.1)' },
  { key: 'totalWD', label: 'Total WD', group: 'income', essential: true, fmt: 'money', get: (r) => r.totalWD, bg: 'rgba(192,57,43,0.08)' },
  { key: 'wdTax', label: 'WD Tax', group: 'income', essential: false, fmt: 'money', get: (r) => r.wdTax, bg: 'rgba(192,57,43,0.08)' },
  { key: 'wdTrd', label: 'WD Pre-tax', group: 'income', essential: false, fmt: 'money', get: (r) => r.wdTrd, bg: 'rgba(192,57,43,0.08)' },
  { key: 'wdRth', label: 'WD Roth', group: 'income', essential: false, fmt: 'money', get: (r) => r.wdRth, bg: 'rgba(192,57,43,0.08)' },
  { key: 'rmd', label: 'RMD', group: 'income', essential: false, fmt: 'money', get: (r) => r.rmd, bg: 'rgba(59,94,138,0.1)' },
  { key: 'rothConv', label: 'Roth Conv', group: 'income', essential: false, fmt: 'money', get: (r) => r.rothConv, bg: 'rgba(59,94,138,0.1)' },
  { key: 'netSpend', label: 'Net Spend', group: 'income', essential: false, fmt: 'money', get: (r) => r.netSpend, bg: 'rgba(192,57,43,0.08)' },
  { key: 'acaPremium', label: 'ACA Premium', group: 'income', essential: false, fmt: 'money', get: (r) => r.acaPremium, bg: 'rgba(192,57,43,0.08)' },

  // Taxes
  { key: 'fedTax', label: 'Fed Tax', group: 'taxes', essential: true, fmt: 'money', get: (r) => r.fedTax, bg: 'rgba(59,94,138,0.1)' },
  { key: 'stateTaxAmt', label: 'State Tax', group: 'taxes', essential: false, fmt: 'money', get: (r) => r.stateTaxAmt, bg: 'rgba(59,94,138,0.1)' },
  { key: 'irmaa', label: 'IRMAA', group: 'taxes', essential: false, fmt: 'money', get: (r) => r.irmaa, bg: 'rgba(59,94,138,0.1)' },
  { key: 'niit', label: 'NIIT', group: 'taxes', essential: false, fmt: 'money', get: (r) => r.niit, bg: 'rgba(59,94,138,0.1)' },
  { key: 'ordIncome', label: 'Ord Income', group: 'taxes', essential: false, fmt: 'money', get: (r) => r.ordIncome, bg: 'rgba(59,94,138,0.1)' },
  { key: 'ltcg', label: 'LTCG', group: 'taxes', essential: false, fmt: 'money', get: (r) => r.ltcg, bg: 'rgba(59,94,138,0.1)' },
  { key: 'effRate', label: 'Eff Rate', group: 'taxes', essential: false, fmt: 'pct', get: (r) => r.effRate * 100, bg: 'rgba(59,94,138,0.1)' },

  // Balances
  { key: 'endTotal', label: 'End Total', group: 'balances', essential: true, fmt: 'money', get: (r) => r.endTotal, bg: 'rgba(13,27,46,0.05)' },
  { key: 'begTaxable', label: 'Beg Tax', group: 'balances', essential: false, fmt: 'money', get: (r) => r.begTaxable, bg: 'rgba(13,27,46,0.05)' },
  { key: 'begTraditional', label: 'Beg Trd', group: 'balances', essential: false, fmt: 'money', get: (r) => r.begTraditional, bg: 'rgba(13,27,46,0.05)' },
  { key: 'begRoth', label: 'Beg Roth', group: 'balances', essential: false, fmt: 'money', get: (r) => r.begRoth, bg: 'rgba(13,27,46,0.05)' },
  { key: 'endTaxable', label: 'End Tax', group: 'balances', essential: false, fmt: 'money', get: (r) => r.endTaxable, bg: 'rgba(13,27,46,0.05)' },
  { key: 'endTraditional', label: 'End Trd', group: 'balances', essential: false, fmt: 'money', get: (r) => r.endTraditional, bg: 'rgba(13,27,46,0.05)' },
  { key: 'endRoth', label: 'End Roth', group: 'balances', essential: false, fmt: 'money', get: (r) => r.endRoth, bg: 'rgba(13,27,46,0.05)' },
];

const GROUP_LABELS: Record<GroupKey, string> = {
  income: 'Income & Withdrawals',
  taxes: 'Taxes',
  balances: 'Balances',
};

const STORAGE_KEY = 'fireopt-projections-expanded-v1';

const loadExpanded = (): Record<GroupKey, boolean> => {
  if (typeof window === 'undefined') return { income: false, taxes: false, balances: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* fall through */ }
  return { income: false, taxes: false, balances: false };
};

export default function Projections() {
  const mode = usePlanStore((s) => s.displayMode);
  const proj = useProjection();
  const [expanded, setExpandedState] = useState<Record<GroupKey, boolean>>(loadExpanded);

  const setExpanded = (key: GroupKey, value: boolean) => {
    const next = { ...expanded, [key]: value };
    setExpandedState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  // Visible columns: identity always; group columns based on essential + expansion.
  const visibleColumns = COLUMNS.filter((c) => {
    if (c.group === 'identity') return true;
    if (c.essential) return true;
    return expanded[c.group];
  });

  const downloadCSV = () => {
    // CSV always includes every column regardless of UI expansion.
    const header = COLUMNS.map((c) => c.label).join(',');
    const rows = proj.rows.map((r) =>
      COLUMNS.map((c) => {
        const v = c.get(r);
        if (typeof v === 'number') {
          const isMoney = c.fmt === 'money';
          const scaled = isMoney && mode === 'real' ? v / r.inflationFactor : v;
          return Math.round(scaled);
        }
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `retirement-optimizer-projection-${mode === 'real' ? 'realdollars' : 'nominal'}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-body">
        <WhatIfBar />

        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Annual Cash Flows ({mode === 'real' ? "Today's $" : 'Nominal $'})</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Income above zero · Spending &amp; tax below zero · Portfolio total line on right axis</span>
          </div>
          <div className="panel-body">
            <ChartFrame caption="Use this to see the net cash flow each year and how taxes eat into income.">
              <CashFlowsBalanced proj={proj} real={mode === 'real'} height={320} />
            </ChartFrame>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Year-by-Year Detail</div>
            <div className="projections-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              {(Object.keys(GROUP_LABELS) as GroupKey[]).map((g) => (
                <button
                  key={g}
                  onClick={() => setExpanded(g, !expanded[g])}
                  style={{
                    border: '1px solid var(--border-light)',
                    background: expanded[g] ? 'var(--navy)' : 'rgba(13,27,46,0.04)',
                    color: expanded[g] ? '#fff' : 'var(--text-secondary)',
                    fontSize: 11,
                    padding: '4px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                  title={expanded[g] ? `Collapse ${GROUP_LABELS[g]}` : `Expand ${GROUP_LABELS[g]}`}
                >
                  {expanded[g] ? '−' : '+'} {GROUP_LABELS[g]}
                </button>
              ))}
              <span style={{ width: 1, height: 18, background: 'var(--border-light)', margin: '0 2px' }} />
              <button
                onClick={downloadCSV}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  border: '1px solid var(--border-light)',
                  background: 'rgba(201,168,76,0.12)',
                  color: 'var(--navy)',
                  fontSize: 11, fontWeight: 600,
                  padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                }}
                title="Download all columns as CSV (respects Today's $ / Nominal $ toggle)"
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Download CSV
              </button>
            </div>
          </div>
          <div className="panel-body" style={{ padding: 0, overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  {visibleColumns.map((c, i) => {
                    const sticky = c.group === 'identity';
                    const leftOffsets = [0, 60, 120, 180];
                    return (
                      <th
                        key={c.key}
                        style={sticky
                          ? stickyTh(leftOffsets[i] ?? 0, c.bg, c.key === 'phase' ? 90 : 60)
                          : { background: c.bg, fontWeight: c.key === 'endTotal' ? 700 : 600 }}
                      >
                        {c.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {proj.rows.map((r) => {
                  const leftOffsets = [0, 60, 120, 180];
                  return (
                    <tr key={r.year}>
                      {visibleColumns.map((c, i) => {
                        const sticky = c.group === 'identity';
                        const v = c.get(r);
                        let display: string | number;
                        if (typeof v === 'string') display = v;
                        else if (c.fmt === 'money') display = fmt(v, mode, r.inflationFactor);
                        else if (c.fmt === 'pct') display = `${v.toFixed(1)}%`;
                        else display = v;
                        const style: React.CSSProperties = sticky
                          ? { ...stickyTd(leftOffsets[i] ?? 0), textAlign: 'center' }
                          : { textAlign: 'right', fontWeight: c.key === 'endTotal' ? 700 : undefined };
                        return <td key={c.key} style={style}>{display}</td>;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 18px', fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border-light)' }}>
            Showing {visibleColumns.length} of {COLUMNS.length} columns. CSV export includes all columns regardless of toggles.
          </div>
        </div>
      </div>
    </div>
  );
}
