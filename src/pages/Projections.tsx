import { useProjection, usePlanStore } from '../store/usePlanStore';
import type { DisplayMode } from '../store/usePlanStore';
import { fmtUSD } from '../lib/format';
import CashFlowsBalanced from '../components/charts/CashFlowsBalanced';

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

const COLUMNS: Array<{ key: string; label: string; get: (r: ReturnType<typeof useProjection>['rows'][number]) => number | string }> = [
  { key: 'year', label: 'Year', get: (r) => r.year },
  { key: 'ageA', label: 'Age A', get: (r) => r.ageA },
  { key: 'ageB', label: 'Age B', get: (r) => r.ageB ?? '' },
  { key: 'phase', label: 'Phase', get: (r) => r.phase },
  { key: 'contribA', label: 'Contrib A', get: (r) => r.contribA },
  { key: 'contribB', label: 'Contrib B', get: (r) => r.contribB },
  { key: 'ssA', label: 'SS A', get: (r) => r.ssA },
  { key: 'ssB', label: 'SS B', get: (r) => r.ssB },
  { key: 'totalSS', label: 'Total SS', get: (r) => r.totalSS },
  { key: 'otherIncome', label: 'Other Inc', get: (r) => r.otherIncome },
  { key: 'netSpend', label: 'Net Spend', get: (r) => r.netSpend },
  { key: 'wdTax', label: 'WD Taxable', get: (r) => r.wdTax },
  { key: 'wdTrd', label: 'WD Pre-tax', get: (r) => r.wdTrd },
  { key: 'wdRth', label: 'WD Roth', get: (r) => r.wdRth },
  { key: 'totalWD', label: 'Total WD', get: (r) => r.totalWD },
  { key: 'rmd', label: 'RMD', get: (r) => r.rmd },
  { key: 'rothConv', label: 'Roth Conv', get: (r) => r.rothConv },
  { key: 'ordIncome', label: 'Ord Income', get: (r) => r.ordIncome },
  { key: 'ltcg', label: 'LTCG', get: (r) => r.ltcg },
  { key: 'fedTax', label: 'Fed Tax', get: (r) => r.fedTax },
  { key: 'stateTaxAmt', label: 'State Tax', get: (r) => r.stateTaxAmt },
  { key: 'irmaa', label: 'IRMAA', get: (r) => r.irmaa },
  { key: 'effRate', label: 'Eff Rate %', get: (r) => +(r.effRate * 100).toFixed(2) },
  { key: 'begTaxable', label: 'Beg Taxable', get: (r) => r.begTaxable },
  { key: 'begTraditional', label: 'Beg Pre-tax', get: (r) => r.begTraditional },
  { key: 'begRoth', label: 'Beg Roth', get: (r) => r.begRoth },
  { key: 'endTaxable', label: 'End Taxable', get: (r) => r.endTaxable },
  { key: 'endTraditional', label: 'End Pre-tax', get: (r) => r.endTraditional },
  { key: 'endRoth', label: 'End Roth', get: (r) => r.endRoth },
  { key: 'endTotal', label: 'End Total', get: (r) => r.endTotal },
];

export default function Projections() {
  const mode = usePlanStore((s) => s.displayMode);
  const proj = useProjection();

  const downloadCSV = () => {
    const header = COLUMNS.map((c) => c.label).join(',');
    const rows = proj.rows.map((r) =>
      COLUMNS.map((c) => {
        const v = c.get(r);
        if (typeof v === 'number') {
          // Scale to display mode for $ columns; keep ages/years/effRate raw.
          const isMoney = !['year', 'ageA', 'ageB', 'effRate'].includes(c.key);
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
    a.download = `fireopt-projection-${mode === 'real' ? 'realdollars' : 'nominal'}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Projections</div>
            <div className="page-title">Year-by-Year Projections</div>
            <div className="page-subtitle">{proj.yearsCovered}-year detail · {mode === 'real' ? "Today's $" : 'Nominal $'} (set on Dashboard)</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost" onClick={downloadCSV}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Download CSV
            </button>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Annual Cash Flows ({mode === 'real' ? "Today's $" : 'Nominal $'})</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Income above zero · Spending &amp; tax below zero · Net change line</span>
          </div>
          <div className="panel-body">
            <CashFlowsBalanced proj={proj} real={mode === 'real'} height={320} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Year-by-Year Detail Table</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>First 4 columns stay visible while scrolling horizontally</span>
          </div>
          <div className="panel-body" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: 1800, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={stickyTh(0, '#0d1b2e10', 60)}>Yr</th>
                  <th style={stickyTh(60, '#0d1b2e10', 60)}>Age A</th>
                  <th style={stickyTh(120, '#0d1b2e10', 60)}>Age B</th>
                  <th style={stickyTh(180, '#0d1b2e10', 90)}>Phase</th>
                  <th style={{ background: 'rgba(201,168,76,0.12)' }}>Contrib A</th>
                  <th style={{ background: 'rgba(201,168,76,0.12)' }}>Contrib B</th>
                  <th style={{ background: 'rgba(26,138,90,0.1)' }}>SS A</th>
                  <th style={{ background: 'rgba(26,138,90,0.1)' }}>SS B</th>
                  <th style={{ background: 'rgba(26,138,90,0.1)' }}>Total SS</th>
                  <th style={{ background: 'rgba(26,138,90,0.1)' }}>Other Inc</th>
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>Net Spend</th>
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>WD Taxable</th>
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>WD Pre-tax</th>
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>WD Roth</th>
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>Total WD</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>RMD</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>Roth Conv</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>Ord Income</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>LTCG</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>Fed Tax</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>State Tax</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>IRMAA</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>Eff Rate</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>Beg Taxable</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>Beg Pre-tax</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>Beg Roth</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>End Taxable</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>End Pre-tax</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>End Roth</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)', fontWeight: 700 }}>End Total</th>
                </tr>
              </thead>
              <tbody>
                {proj.rows.map((r) => {
                  const f = (n: number) => fmt(n, mode, r.inflationFactor);
                  return (
                    <tr key={r.year}>
                      <td style={{ ...stickyTd(0), textAlign: 'center' }}>{r.year}</td>
                      <td style={{ ...stickyTd(60), textAlign: 'center' }}>{r.ageA}</td>
                      <td style={{ ...stickyTd(120), textAlign: 'center' }}>{r.ageB ?? '—'}</td>
                      <td style={{ ...stickyTd(180), textAlign: 'center' }}>{r.phase}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.contribA)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.contribB)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.ssA)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.ssB)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.totalSS)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.otherIncome)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.netSpend)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.wdTax)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.wdTrd)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.wdRth)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.totalWD)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.rmd)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.rothConv)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.ordIncome)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.ltcg)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.fedTax)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.stateTaxAmt)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.irmaa)}</td>
                      <td style={{ textAlign: 'right' }}>{(r.effRate * 100).toFixed(1)}%</td>
                      <td style={{ textAlign: 'right' }}>{f(r.begTaxable)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.begTraditional)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.begRoth)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.endTaxable)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.endTraditional)}</td>
                      <td style={{ textAlign: 'right' }}>{f(r.endRoth)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{f(r.endTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
