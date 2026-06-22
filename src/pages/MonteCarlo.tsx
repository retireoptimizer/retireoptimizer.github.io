import { useState } from 'react';
import { usePlanStore, useProjection } from '../store/usePlanStore';
import type { MonteCarloResult, ReturnModel } from '../engine/monteCarlo';
import { getEngineWorker } from '../engine/workerClient';
import MonteCarloFan from '../components/charts/MonteCarloFan';
import StressScenarioModal from '../components/StressScenarioModal';
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
  const displayMode = usePlanStore((s) => s.displayMode);
  const real = displayMode === 'real';
  const proj = useProjection();
  const [trials, setTrials] = useState(500);
  const [stdDev, setStdDev] = useState(10);
  const [model, setModel] = useState<ReturnModel>('historical');
  const [equityPct, setEquityPct] = useState(Math.round((plan.assumptions.equityPct ?? 0.6) * 100));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [detailScenario, setDetailScenario] = useState<number | null>(null);

  const run = async () => {
    setRunning(true);
    try {
      const worker = getEngineWorker();
      const mc = await worker.monteCarlo(plan, { trials, model, equityPct: equityPct / 100, stdDev: stdDev / 100 });
      setResult(mc);
    } finally {
      setRunning(false);
    }
  };

  const mixLabel = `${equityPct}/${100 - equityPct}`;

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
            <div className="metric-sub">{result ? `${result.trials} trials · ${result.model === 'historical' ? 'historical bootstrap' : 'parametric'} · ${Math.round(result.equityPct * 100)}/${100 - Math.round(result.equityPct * 100)}` : 'Click Run Simulation'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Median Final Portfolio</div>
            <div className="metric-value">{result ? fmtM(real ? result.medianEndBalance : result.medianEndBalanceNominal) : '—'}</div>
            <div className="metric-sub">Age {plan.personA.planToAge} · 50th percentile ({real ? "today's $" : 'nominal $'})</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">10th Percentile Outcome</div>
            <div className="metric-value">{result ? fmtM(real ? result.p10EndBalance : result.p10EndBalanceNominal) : '—'}</div>
            <div className="metric-sub">Adverse scenario ({real ? "today's $" : 'nominal $'})</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">90th Percentile Outcome</div>
            <div className="metric-value">{result ? fmtM(real ? result.p90EndBalance : result.p90EndBalanceNominal) : '—'}</div>
            <div className="metric-sub">Favorable scenario ({real ? "today's $" : 'nominal $'})</div>
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
              <MonteCarloFan mc={real ? result : {
                ...result,
                p10: result.p10Nominal, p25: result.p25Nominal, p50: result.p50Nominal,
                p75: result.p75Nominal, p90: result.p90Nominal,
              }} height={320} overlay={selectedScenario !== null ? {
                label: result.stressScenarios[selectedScenario].name,
                data: real
                  ? result.stressScenarios[selectedScenario].portfolioByAge
                  : result.stressScenarios[selectedScenario].portfolioByAgeNominal,
                color: result.stressScenarios[selectedScenario].successRate === 0 ? '#c0392b' : '#e67e22',
              } : undefined} />
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
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Stress Scenarios</div>
              {selectedScenario !== null && result && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click scenario again to deselect</span>
              )}
            </div>
            <div className="panel-body" style={{ padding: '0' }}>
              <table className="data-table">
                <thead><tr><th>Scenario</th><th style={{ textAlign: 'right' }}>Success</th><th style={{ textAlign: 'right' }}>End Balance</th></tr></thead>
                <tbody>
                  {result ? (
                    result.stressScenarios.map((s, idx) => {
                      const isSelected = selectedScenario === idx;
                      return (
                        <tr
                          key={s.name}
                          onClick={() => setSelectedScenario(isSelected ? null : idx)}
                          style={{
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(13,27,46,0.07)' : undefined,
                            borderLeft: isSelected
                              ? `3px solid ${s.successRate === 0 ? '#c0392b' : '#e67e22'}`
                              : '3px solid transparent',
                            transition: 'background 0.15s',
                          }}
                        >
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ fontWeight: 600 }}>{s.name}</div>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDetailScenario(idx); }}
                                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, fontSize: 10, padding: '2px 7px', color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                Details
                              </button>
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {s.description}
                              {s.coverageEndAge !== undefined && (
                                <span style={{ color: 'var(--warning)', marginLeft: 4 }}>· data ends age {s.coverageEndAge}</span>
                              )}
                            </div>
                          </td>
                          <td className="td-mono" style={{ textAlign: 'right', color: successColor(s.successRate), fontWeight: 600 }}>{fmtPct(s.successRate, 0)}</td>
                          <td className="td-mono" style={{ textAlign: 'right' }}>
                            {fmtM(real ? s.medianEnd : s.medianEndNominal)}
                            {s.coverageEndAge !== undefined && (
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>age {s.coverageEndAge}</div>
                            )}
                          </td>
                        </tr>
                      );
                    })
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
                  <label>Return Model</label>
                  <select value={model} onChange={(e) => setModel(e.target.value as ReturnModel)}>
                    <option value="historical">Historical bootstrap</option>
                    <option value="parametric">Parametric normal</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Equity Allocation %</label>
                  <input type="number" value={equityPct} min={0} max={100} step={5} onChange={(e) => setEquityPct(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))} />
                </div>
                <div className="form-group">
                  <label>Number of Trials</label>
                  <input type="number" value={trials} min={50} max={2000} step={50} onChange={(e) => setTrials(parseInt(e.target.value, 10) || 500)} />
                </div>
                {model === 'parametric' ? (
                  <div className="form-group">
                    <label>Return Std Dev %</label>
                    <input type="number" value={stdDev} min={1} max={30} step={0.5} onChange={(e) => setStdDev(parseFloat(e.target.value) || 10)} />
                  </div>
                ) : (
                  <div className="form-group">
                    <label>Bond Allocation %</label>
                    <input type="text" value={`${100 - equityPct}%`} readOnly />
                  </div>
                )}
                <div className="form-group">
                  <label>Plan Horizon (Age A)</label>
                  <input type="text" value={plan.personA.planToAge} readOnly />
                </div>
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {model === 'historical'
                  ? `Each trial stitches together random multi-year blocks of real S&P 500 + Treasury returns (1928–2023), blended ${mixLabel} stock/bond. Contiguous blocks preserve mean reversion and sequence-of-returns risk — closer to how real markets behave.`
                  : `Each trial samples independent annual returns from a normal distribution (arithmetic mean ${(plan.assumptions.postRetReturn * 100).toFixed(1)}% from your plan, std dev configurable). Independent draws ignore mean reversion and tend to be pessimistic.`}
                {' '}Success = plan funds all spending through plan-to age. 500 trials runs in ~1–2 seconds.
              </div>
            </div>
          </div>
        </div>
      </div>

      {detailScenario !== null && result && (
        <StressScenarioModal
          s={result.stressScenarios[detailScenario]}
          real={real}
          onClose={() => setDetailScenario(null)}
        />
      )}
    </div>
  );
}
