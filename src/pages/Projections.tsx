import { useState, useRef, useEffect } from 'react';
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
const stickyTh = (left: number, bg = '#e2e4e6', minWidth = 60): React.CSSProperties => ({
  position: 'sticky', top: 0, left, background: bg, zIndex: 4, minWidth,
});
const stickyTd = (left: number, bg = '#fff', minWidth = 60): React.CSSProperties => ({
  position: 'sticky', left, background: bg, zIndex: 2, minWidth,
});

type Row = ReturnType<typeof useProjection>['rows'][number];
type GroupKey = 'income' | 'withdrawals' | 'spending' | 'taxes' | 'balances';

interface Column {
  key: string;
  label: string;
  group: 'identity' | GroupKey;
  essential: boolean;
  fmt?: 'money' | 'pct' | 'raw';
  get: (r: Row) => number | string;
  bg: string;
}

const BG: Record<'identity' | GroupKey, string> = {
  identity:    '#e2e4e6',
  income:      '#eee3c6',
  withdrawals: '#d4e8d8',
  spending:    '#e8d8ee',
  taxes:       '#ced7e2',
  balances:    '#d3d6d9',
};

const COLUMNS: Column[] = [
  // Identity (always shown, sticky)
  { key: 'year',  label: 'Yr',    group: 'identity', essential: true, fmt: 'raw', get: (r) => r.year,       bg: BG.identity },
  { key: 'ageA',  label: 'Age A', group: 'identity', essential: true, fmt: 'raw', get: (r) => r.ageA,       bg: BG.identity },
  { key: 'ageB',  label: 'Age B', group: 'identity', essential: true, fmt: 'raw', get: (r) => r.ageB ?? '—', bg: BG.identity },
  { key: 'phase', label: 'Phase', group: 'identity', essential: true, fmt: 'raw', get: (r) => r.phase,      bg: BG.identity },

  // Income — what flows in from outside accounts
  { key: 'totalSS',             label: 'Total SS',        group: 'income', essential: true,  fmt: 'money', get: (r) => r.totalSS,                                                                               bg: BG.income },
  { key: 'otherIncome',         label: 'Other Inc',       group: 'income', essential: true,  fmt: 'money', get: (r) => r.otherIncome,                                                                           bg: BG.income },
  { key: 'ordinaryDiv',         label: 'Ord Div',         group: 'income', essential: false, fmt: 'money', get: (r) => r.ordinaryDiv  ?? 0,                                                                     bg: BG.income },
  { key: 'qualifiedDiv',        label: 'Qual Div',        group: 'income', essential: false, fmt: 'money', get: (r) => r.qualifiedDiv ?? 0,                                                                     bg: BG.income },
  { key: 'lumpSumInject',       label: 'Lump Sum',        group: 'income', essential: true,  fmt: 'money', get: (r) => (r.lumpSumInjectTaxable ?? 0) + (r.lumpSumInjectTrad ?? 0) + (r.lumpSumInjectRoth ?? 0), bg: BG.income },
  { key: 'lumpSumOrdinaryIncome', label: 'Inherited Inc', group: 'income', essential: false, fmt: 'money', get: (r) => r.lumpSumOrdinaryIncome ?? 0,                                                            bg: BG.income },
  { key: 'contribA',            label: 'Contrib A',       group: 'income', essential: false, fmt: 'money', get: (r) => r.contribA,                                                                              bg: BG.income },
  { key: 'contribB',            label: 'Contrib B',       group: 'income', essential: false, fmt: 'money', get: (r) => r.contribB,                                                                              bg: BG.income },
  { key: 'cashSurplus',         label: 'Cash Surplus',    group: 'income', essential: false, fmt: 'money', get: (r) => r.cashSurplus ?? 0,                                                                      bg: BG.income },

  // Withdrawals — portfolio draws and conversion activity
  { key: 'totalWD',   label: 'Total WD',   group: 'withdrawals', essential: true,  fmt: 'money', get: (r) => r.totalWD,   bg: BG.withdrawals },
  { key: 'wdTax',     label: 'WD Taxable', group: 'withdrawals', essential: false, fmt: 'money', get: (r) => r.wdTax,     bg: BG.withdrawals },
  { key: 'wdTrd',     label: 'WD Pre-tax', group: 'withdrawals', essential: false, fmt: 'money', get: (r) => r.wdTrd,     bg: BG.withdrawals },
  { key: 'wdRth',     label: 'WD Roth',    group: 'withdrawals', essential: false, fmt: 'money', get: (r) => r.wdRth,     bg: BG.withdrawals },
  { key: 'rmd',       label: 'RMD',        group: 'withdrawals', essential: false, fmt: 'money', get: (r) => r.rmd,       bg: BG.withdrawals },
  { key: 'rothConv',  label: 'Roth Conv',  group: 'withdrawals', essential: false, fmt: 'money', get: (r) => r.rothConv,  bg: BG.withdrawals },

  // Spending — what you actually consume
  { key: 'netSpend',   label: 'Net Spend',   group: 'spending', essential: true,  fmt: 'money', get: (r) => r.netSpend,   bg: BG.spending },
  { key: 'acaPremium', label: 'ACA Premium', group: 'spending', essential: false, fmt: 'money', get: (r) => r.acaPremium, bg: BG.spending },

  // Taxes — inputs first (what creates the liability), then outputs (what you pay)
  { key: 'ordIncome',    label: 'Ord Income',  group: 'taxes', essential: true,  fmt: 'money', get: (r) => r.ordIncome,                              bg: BG.taxes },
  { key: 'ltcg',         label: 'LTCG',        group: 'taxes', essential: true,  fmt: 'money', get: (r) => r.ltcg,                                   bg: BG.taxes },
  { key: 'magi',         label: 'MAGI',        group: 'taxes', essential: false, fmt: 'money', get: (r) => r.magi,                                   bg: BG.taxes },
  { key: 'stdDeduction', label: 'Std Deduct',  group: 'taxes', essential: false, fmt: 'money', get: (r) => r.stdDeduction - r.seniorBonus,             bg: BG.taxes },
  { key: 'seniorBonus',  label: 'Senior Bonus',group: 'taxes', essential: false, fmt: 'money', get: (r) => r.seniorBonus,                              bg: BG.taxes },
  { key: 'taxableIncome',label: 'Taxable Inc', group: 'taxes', essential: false, fmt: 'money', get: (r) => Math.max(0, r.magi - r.stdDeduction),     bg: BG.taxes },
  { key: 'fedTax',       label: 'Fed Tax',     group: 'taxes', essential: true,  fmt: 'money', get: (r) => r.fedTax,                                 bg: BG.taxes },
  { key: 'stateTaxAmt',  label: 'State Tax',   group: 'taxes', essential: false, fmt: 'money', get: (r) => r.stateTaxAmt,                            bg: BG.taxes },
  { key: 'irmaa',        label: 'IRMAA',       group: 'taxes', essential: false, fmt: 'money', get: (r) => r.irmaa,                                  bg: BG.taxes },
  { key: 'niit',         label: 'NIIT',        group: 'taxes', essential: false, fmt: 'money', get: (r) => r.niit,                                   bg: BG.taxes },
  { key: 'effRate',      label: 'Eff Rate',    group: 'taxes', essential: false, fmt: 'pct',   get: (r) => r.effRate * 100,                          bg: BG.taxes },

  // Balances — end-of-year portfolio state
  { key: 'endTotal',       label: 'End Total', group: 'balances', essential: true,  fmt: 'money', get: (r) => r.endTotal,       bg: BG.balances },
  { key: 'begTaxable',     label: 'Beg Tax',   group: 'balances', essential: false, fmt: 'money', get: (r) => r.begTaxable,     bg: BG.balances },
  { key: 'begTraditional', label: 'Beg Trd',   group: 'balances', essential: false, fmt: 'money', get: (r) => r.begTraditional, bg: BG.balances },
  { key: 'begRoth',        label: 'Beg Roth',  group: 'balances', essential: false, fmt: 'money', get: (r) => r.begRoth,        bg: BG.balances },
  { key: 'endTaxable',     label: 'End Tax',   group: 'balances', essential: false, fmt: 'money', get: (r) => r.endTaxable,     bg: BG.balances },
  { key: 'endTraditional', label: 'End Trd',   group: 'balances', essential: false, fmt: 'money', get: (r) => r.endTraditional, bg: BG.balances },
  { key: 'endRoth',        label: 'End Roth',  group: 'balances', essential: false, fmt: 'money', get: (r) => r.endRoth,        bg: BG.balances },
];

const GROUP_LABELS: Record<GroupKey, string> = {
  income:      'Income',
  withdrawals: 'Withdrawals',
  spending:    'Spending',
  taxes:       'Taxes',
  balances:    'Balances',
};

const GROUP_COLORS: Record<GroupKey, { bg: string; text: string }> = {
  income:      { bg: '#b8922a', text: '#fff' },
  withdrawals: { bg: '#2d6a4f', text: '#fff' },
  spending:    { bg: '#6a2d6a', text: '#fff' },
  taxes:       { bg: '#3b5e8a', text: '#fff' },
  balances:    { bg: '#0d1b2e', text: '#fff' },
};

function GroupCheckbox({ cols, visibleKeys, onToggle }: {
  cols: Column[]; visibleKeys: Set<string>; onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const allChecked = cols.every(c => visibleKeys.has(c.key));
  const someChecked = cols.some(c => visibleKeys.has(c.key));
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);
  return (
    <input ref={ref} type="checkbox" checked={allChecked} onChange={onToggle}
      style={{ accentColor: 'var(--navy)', cursor: 'pointer' }} />
  );
}

const STORAGE_KEY = 'fireopt-projections-cols-v4';

const DEFAULT_VISIBLE = new Set(COLUMNS.filter(c => c.essential || c.group === 'identity').map(c => c.key));

const loadVisibleKeys = (): Set<string> => {
  if (typeof window === 'undefined') return DEFAULT_VISIBLE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* fall through */ }
  return DEFAULT_VISIBLE;
};

export default function Projections() {
  const mode = usePlanStore((s) => s.displayMode);
  const proj = useProjection();
  const [visibleKeys, setVisibleKeysState] = useState<Set<string>>(loadVisibleKeys);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top: number; right: number; maxHeight: number }>({ top: 0, right: 0, maxHeight: 400 });
  const pickerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  const openPicker = () => {
    if (buttonRef.current) {
      const r = buttonRef.current.getBoundingClientRect();
      setPickerPos({
        top: r.bottom + 4,
        right: window.innerWidth - r.right,
        maxHeight: window.innerHeight - r.bottom - 12,
      });
    }
    setPickerOpen(o => !o);
  };

  const save = (next: Set<string>) => {
    setVisibleKeysState(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
  };

  const toggleColumn = (key: string) => {
    const next = new Set(visibleKeys);
    if (next.has(key)) next.delete(key); else next.add(key);
    save(next);
  };

  const toggleGroup = (g: GroupKey) => {
    const cols = COLUMNS.filter(c => c.group === g);
    const allOn = cols.every(c => visibleKeys.has(c.key));
    const next = new Set(visibleKeys);
    cols.forEach(c => allOn ? next.delete(c.key) : next.add(c.key));
    save(next);
  };

  const visibleColumns = COLUMNS.filter(c => c.group === 'identity' || visibleKeys.has(c.key));

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
              <div style={{ position: 'relative' }}>
                <button
                  ref={buttonRef}
                  onClick={openPicker}
                  style={{
                    border: '1px solid var(--border-light)',
                    background: pickerOpen ? 'var(--navy)' : 'rgba(13,27,46,0.04)',
                    color: pickerOpen ? '#fff' : 'var(--text-secondary)',
                    fontSize: 11, padding: '4px 10px', borderRadius: 6,
                    cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <strong>Show / Hide Columns</strong>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor">
                    <path d="M2 3.5l3 3 3-3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                {pickerOpen && (
                  <div ref={pickerRef} style={{
                    position: 'fixed', top: pickerPos.top, right: pickerPos.right, zIndex: 1000,
                    background: '#fff', border: '1px solid var(--border-light)',
                    borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                    padding: '10px 0', minWidth: 220,
                    maxHeight: pickerPos.maxHeight, overflowY: 'auto',
                  }}>
                    {(Object.keys(GROUP_LABELS) as GroupKey[]).map(g => {
                      const cols = COLUMNS.filter(c => c.group === g);
                      const { bg, text } = GROUP_COLORS[g];
                      return (
                        <div key={g}>
                          <label style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '5px 14px', cursor: 'pointer', userSelect: 'none',
                            background: bg,
                          }}>
                            <GroupCheckbox cols={cols} visibleKeys={visibleKeys} onToggle={() => toggleGroup(g)} />
                            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: text, textTransform: 'uppercase' }}>
                              {GROUP_LABELS[g]}
                            </span>
                          </label>
                          {cols.map(c => (
                            <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 14px 3px 32px', cursor: 'pointer', userSelect: 'none' }}>
                              <input
                                type="checkbox"
                                checked={visibleKeys.has(c.key)}
                                onChange={() => toggleColumn(c.key)}
                                style={{ accentColor: 'var(--navy)', cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.label}</span>
                            </label>
                          ))}
                        </div>
                      );
                    })}
                    <div style={{ borderTop: '1px solid var(--border-light)', margin: '8px 0 4px' }} />
                    <button
                      onClick={() => save(DEFAULT_VISIBLE)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '3px 14px', fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                      Reset to defaults
                    </button>
                  </div>
                )}
              </div>
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
          <div className="panel-body" style={{ padding: 0, overflow: 'auto', maxHeight: 'calc(100vh - 380px)', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
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
                          : { position: 'sticky', top: 0, background: c.bg, fontWeight: c.key === 'endTotal' ? 700 : 600, zIndex: 3 }}
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
            Showing {visibleColumns.length} of {COLUMNS.length} columns · CSV export always includes all columns
          </div>
        </div>
      </div>
    </div>
  );
}
