import { useState } from 'react';
import { useProjection } from '../store/usePlanStore';
import { fmtUSD } from '../lib/format';

type DisplayMode = 'nominal' | 'real';

const fmt = (n: number, mode: DisplayMode, inflF: number): string => {
  if (!isFinite(n) || n === 0) return '—';
  const v = mode === 'real' ? n / inflF : n;
  return fmtUSD(v);
};

export default function Projections() {
  const [mode, setMode] = useState<DisplayMode>('nominal');
  const proj = useProjection();

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Analysis</div>
            <div className="page-title">Year-by-Year Projections</div>
            <div className="page-subtitle">{proj.yearsCovered}-year detail · live from engine</div>
          </div>
          <div className="header-actions">
            <div className="toggle-group" style={{ width: '220px' }}>
              <button className={`toggle-opt ${mode === 'nominal' ? 'active' : ''}`} onClick={() => setMode('nominal')}>Nominal $</button>
              <button className={`toggle-opt ${mode === 'real' ? 'active' : ''}`} onClick={() => setMode('real')}>Today's $</button>
            </div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#0d1b2e20' }}></div>Identity</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(201,168,76,0.15)' }}></div>Contributions</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(26,138,90,0.15)' }}></div>Income</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(192,57,43,0.12)' }}></div>Outflows</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(59,94,138,0.12)' }}></div>Tax &amp; Conversions</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(13,27,46,0.05)' }}></div>Balances</div>
        </div>
        <div className="panel">
          <div className="panel-body" style={{ padding: '0', overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '1800px', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ background: '#0d1b2e10' }}>Yr</th>
                  <th style={{ background: '#0d1b2e10' }}>Age A</th>
                  <th style={{ background: '#0d1b2e10' }}>Age B</th>
                  <th style={{ background: '#0d1b2e10' }}>Phase</th>
                  <th style={{ background: 'rgba(201,168,76,0.12)' }}>Contrib A</th>
                  <th style={{ background: 'rgba(201,168,76,0.12)' }}>Contrib B</th>
                  <th style={{ background: 'rgba(26,138,90,0.1)' }}>SS A</th>
                  <th style={{ background: 'rgba(26,138,90,0.1)' }}>SS B</th>
                  <th style={{ background: 'rgba(26,138,90,0.1)' }}>Total SS</th>
                  <th style={{ background: 'rgba(26,138,90,0.1)' }}>Other Inc</th>
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>Net Spend</th>
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>WD Taxable</th>
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>WD Trad.</th>
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>WD Roth</th>
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>Total WD</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>RMD</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>Roth Conv.</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>Ord. Income</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>LTCG</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>Fed Tax</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>State Tax</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>IRMAA</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>Eff. Rate</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>Beg Taxable</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>Beg Trad.</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>Beg Roth</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>End Taxable</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>End Trad.</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>End Roth</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)', fontWeight: 700 }}>End Total</th>
                </tr>
              </thead>
              <tbody>
                {proj.rows.map((r) => {
                  const f = (n: number) => fmt(n, mode, r.inflationFactor);
                  return (
                    <tr key={r.year}>
                      <td style={{ textAlign: 'center' }}>{r.year}</td>
                      <td style={{ textAlign: 'center' }}>{r.ageA}</td>
                      <td style={{ textAlign: 'center' }}>{r.ageB ?? '—'}</td>
                      <td style={{ textAlign: 'center' }}>{r.phase}</td>
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
