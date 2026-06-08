import { useState } from 'react';
import { usePlanStore, useProjection } from '../store/usePlanStore';
import type { MonteCarloResult } from '../engine/monteCarlo';
import { getEngineWorker } from '../engine/workerClient';
import MonteCarloFan from '../components/charts/MonteCarloFan';
import { fmtM, fmtPct } from '../lib/format';
import { generateInsights, insightsForSurface } from '../engine/explain';
import InsightCard from '../components/InsightCard';

interface RiskBand {
  label: string;
  body: string;
  tone: 'success' | 'good' | 'warning' | 'danger';
}

function riskBandFor(successRate: number): RiskBand {
  if (successRate >= 0.95) return { label: 'Robust', tone: 'success', body: 'Plan funds in nearly every market scenario.' };
  if (successRate >= 0.90) return { label: 'Healthy', tone: 'good', body: 'Solid funding probability across realistic markets.' };
  if (successRate >= 0.75) return { label: 'Watch', tone: 'warning', body: 'Meaningful failure tail — review sequence risk and spending.' };
  if (successRate >= 0.50) return { label: 'Strained', tone: 'warning', body: 'A significant share of trials run out before plan-to age.' };
  return { label: 'At risk', tone: 'danger', body: 'Most adverse trials deplete the portfolio — plan needs adjustment.' };
}

const bandColor = (t: RiskBand['tone']): string => {
  if (t === 'success') return 'var(--success)';
  if (t === 'good') return 'var(--success)';
  if (t === 'warning') return 'var(--warning)';
  return 'var(--danger)';
};

export default function MonteCarlo() {
  const plan = usePlanStore((s) => s.plan);
  const proj = useProjection();
  const [trials, setTrials] = useState(500);
  const [stdDev, setStdDev] = useState(10);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MonteCarloResult | null>(null);

  const run = async () => {
    setRunning(true);
    try {
      const worker = getEngineWorker();
      const mc = await worker.monteCarlo(plan, { trials, stdDev: stdDev / 100 });
      setResult(mc);
    } finally {
      setRunning(false);
    }
  };

  const successColor = (rate: number) => rate >= 0.9 ? 'var(--success)' : rate >= 0.75 ? 'var(--warning)' : 'var(--danger)';

  const band = result ? riskBandFor(result.successRate) : null;
  const insights = result ? insightsForSurface(generateInsights(plan, proj, result), 'mc') : [];

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Analysis</div>
            <div className="page-title">Monte Carlo Simulation</div>
            <div className="page-subtitle">Stochastic returns · probability of success across thousands of market scenarios</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-gold" onClick={run} disabled={running}>{running ? 'Running…' : '▶ Run Simulation'}</button>
          </div>
        </div>
      </div>
      <div className="page-body">

        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Probability of Success</div>
            <div className="metric-value" style={{ color: result ? successColor(result.successRate) : undefined }}>
              {result ? fmtPct(result.successRate, 0) : '—'}
            </div>
            <div className="metric-sub">{result ? `${result.trials} trials · ${stdDev}% σ` : 'Click Run Simulation'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Median Final Portfolio</div>
            <div className="metric-value">{result ? fmtM(result.medianEndBalance) : '—'}</div>
            <div className="metric-sub">Age {plan.personA.planToAge} · 50th percentile (real $)</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">10th Percentile Outcome</div>
            <div className="metric-value">{result ? fmtM(result.p10EndBalance) : '—'}</div>
            <div className="metric-sub">Adverse scenario (real $)</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">90th Percentile Outcome</div>
            <div className="metric-value">{result ? fmtM(result.p90EndBalance) : '—'}</div>
            <div className="metric-sub">Favorable scenario (real $)</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Portfolio Distribution{result ? ` — ${result.trials} Simulations` : ''}</div>
            <span className={`badge ${result ? 'badge-success' : 'badge-neutral'}`}>{running ? 'Running' : result ? 'Complete' : 'Idle'}</span>
          </div>
          <div className="panel-body">
            {band && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', marginBottom: 14, borderRadius: 8, background: 'rgba(13,27,46,0.04)', borderLeft: `4px solid ${bandColor(band.tone)}` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: bandColor(band.tone), textTransform: 'uppercase', letterSpacing: '1px' }}>{band.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{band.body}</span>
              </div>
            )}
            {result ? (
              <MonteCarloFan mc={result} height={320} />
            ) : (
              <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'rgba(13,27,46,0.03)', borderRadius: 8 }}>
                Run a simulation to see the percentile fan chart
              </div>
            )}
            {insights.length > 0 && (
              <div style={{ marginTop: 16 }}>
                {insights.map((i) => <InsightCard key={i.id} insight={i} />)}
              </div>
            )}
          </div>
        </div>

        <div className="three-col" style={{ marginTop: '20px' }}>
          <div className="panel">
            <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Stress Scenarios</div></div>
            <div className="panel-body" style={{ padding: '0' }}>
              <table className="data-table">
                <thead><tr><th>Scenario</th><th style={{ textAlign: 'right' }}>Success</th><th style={{ textAlign: 'right' }}>Median End</th></tr></thead>
                <tbody>
                  {result ? (
                    result.stressScenarios.map((s) => (
                      <tr key={s.name}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.description}</div>
                        </td>
                        <td className="td-mono" style={{ textAlign: 'right', color: successColor(s.successRate), fontWeight: 600 }}>{fmtPct(s.successRate, 0)}</td>
                        <td className="td-mono" style={{ textAlign: 'right' }}>{fmtM(s.medianEnd)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>Run simulation to populate</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel" style={{ gridColumn: '2/4' }}>
            <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Simulation Inputs</div></div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Number of Trials</label>
                  <input type="number" value={trials} min={50} max={2000} step={50} onChange={(e) => setTrials(parseInt(e.target.value, 10) || 500)} />
                </div>
                <div className="form-group">
                  <label>Return Std Dev %</label>
                  <input type="number" value={stdDev} min={1} max={30} step={0.5} onChange={(e) => setStdDev(parseFloat(e.target.value) || 10)} />
                </div>
                <div className="form-group">
                  <label>Mean Return (from plan)</label>
                  <input type="text" value={`${(plan.assumptions.postRetReturn * 100).toFixed(1)}%`} readOnly />
                </div>
                <div className="form-group">
                  <label>Plan Horizon (Age A)</label>
                  <input type="text" value={plan.personA.planToAge} readOnly />
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Each trial samples a random annual return from a normal distribution (mean from your plan, std dev configurable).
                Success = plan funds all spending through plan-to age. 500 trials runs in ~1–2 seconds in browser.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
