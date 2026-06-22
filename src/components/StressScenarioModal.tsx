import { useEffect } from 'react';
import type { MonteCarloResult } from '../engine/monteCarlo';
import StressReturnsChart from './charts/StressReturnsChart';
import { fmtM, fmtPct } from '../lib/format';

type Scenario = MonteCarloResult['stressScenarios'][number];

interface Props {
  s: Scenario;
  real: boolean;
  onClose: () => void;
}

export default function StressScenarioModal({ s, real, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const survived = s.successRate > 0;
  const accent = survived ? 'var(--warning)' : 'var(--danger)';
  const endAge = s.detail.at(-1)?.age;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(13,27,46,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, maxWidth: 720, width: '100%',
          maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>Stress Scenario</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, marginTop: 4 }}>{s.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{s.description}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: 24, marginBottom: 18, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>Outcome</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: accent, marginTop: 2 }}>{survived ? 'Survived' : 'Depleted'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>End Balance</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
                {fmtM(real ? s.medianEnd : s.medianEndNominal)}
                {endAge !== undefined && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' }}> · age {endAge}</span>}
              </div>
            </div>
            {s.coverageEndAge !== undefined && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>Data Coverage</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning)', marginTop: 4 }}>ends age {s.coverageEndAge}</div>
              </div>
            )}
          </div>

          <StressReturnsChart detail={s.detail} real={real} height={260} />

          <div style={{ marginTop: 18, maxHeight: 220, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th style={{ textAlign: 'right' }}>Age</th>
                  <th style={{ textAlign: 'right' }}>Return</th>
                  <th style={{ textAlign: 'right' }}>CPI</th>
                  <th style={{ textAlign: 'right' }}>Portfolio</th>
                </tr>
              </thead>
              <tbody>
                {s.detail.map((d) => (
                  <tr key={d.calendarYear}>
                    <td className="td-mono">{d.calendarYear}</td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{d.age}</td>
                    <td className="td-mono" style={{ textAlign: 'right', color: d.ret < 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>{fmtPct(d.ret, 1)}</td>
                    <td className="td-mono" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{fmtPct(d.cpi, 1)}</td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{fmtM(real ? d.portfolioReal : d.portfolioNominal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
