import { useState } from 'react';
import * as Comlink from 'comlink';
import { usePlanStore, useProjection } from '../store/usePlanStore';
import type { Plan } from '../schemas/plan';
import type { MonteCarloResult } from '../engine/monteCarlo';
import { getEngineWorker } from '../engine/workerClient';
import { applyResultToPlan } from '../engine/applyOptimizerResult';
import MonteCarloFan from '../components/charts/MonteCarloFan';
import HistoricalCohortChart from '../components/charts/HistoricalCohortChart';
import StressScenarioModal from '../components/StressScenarioModal';
import { fmtM, fmtK, fmtPct } from '../lib/format';
import type { HistoricalSweepResult } from '../engine/monteCarlo';
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
  const applyOptimizerResult = usePlanStore((s) => s.applyOptimizerResult);
  const displayMode = usePlanStore((s) => s.displayMode);
  // Robustness optimization is ephemeral until the user explicitly applies it.
  const [robustnessPlan, setRobustnessPlan] = useState<Plan | null>(null);
  const isRobustnessOptimized = !!robustnessPlan;
  const real = displayMode === 'real';
  const proj = useProjection();
  const [trials, setTrials] = useState(500);
  const [equityPct, setEquityPct] = useState(Math.round((plan.assumptions.equityPct ?? 0.6) * 100));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [detailScenario, setDetailScenario] = useState<number | null>(null);
  const [optimizingRobust, setOptimizingRobust] = useState(false);
  const [robustProgress, setRobustProgress] = useState<{ frac: number; msg?: string }>({ frac: 0 });
  const [historicalResult, setHistoricalResult] = useState<HistoricalSweepResult | null>(null);
  const [runningHistorical, setRunningHistorical] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      const worker = getEngineWorker();
      const mc = await worker.monteCarlo(robustnessPlan ?? plan, { trials, model: 'historical', equityPct: equityPct / 100 });
      setResult(mc);
    } finally {
      setRunning(false);
    }
  };

  const runHistorical = async () => {
    setRunningHistorical(true);
    try {
      const worker = getEngineWorker();
      const sweep = await worker.historicalSweep(robustnessPlan ?? plan, { equityPct: equityPct / 100 });
      setHistoricalResult(sweep);
    } finally {
      setRunningHistorical(false);
    }
  };

  const optimizeForRobustness = async () => {
    setOptimizingRobust(true);
    setRobustProgress({ frac: 0 });
    try {
      const worker = getEngineWorker();
      const onProgress = Comlink.proxy((frac: number, msg?: string) => {
        setRobustProgress({ frac, msg });
      });
      const goal = plan.optimizedForGoal ?? 'max-end-balance';
      const optResult = await worker.optimize(
        plan, goal,
        { useNelderMead: true, thorough: true, mcAware: true },
        onProgress,
      );
      const updatedPlan = applyResultToPlan(plan, optResult);
      setRobustnessPlan(updatedPlan);
      // Re-run MC with the robustness-optimized policy (ephemeral — not written to plan store).
      const mc = await worker.monteCarlo(updatedPlan, { trials, model: 'historical', equityPct: equityPct / 100 });
      setResult(mc);
    } finally {
      setOptimizingRobust(false);
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
        </div>
      </div>
      <div className="page-body">

        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-body" style={{ padding: '10px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'nowrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Equity %</label>
                <input
                  type="number"
                  value={equityPct}
                  min={0} max={100} step={5}
                  onChange={(e) => setEquityPct(Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                  style={{ width: 64 }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Bond %</label>
                <input type="text" value={`${100 - equityPct}`} readOnly style={{ width: 64, background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Trials</label>
                <input
                  type="number"
                  value={trials}
                  min={50} max={2000} step={50}
                  onChange={(e) => setTrials(parseInt(e.target.value, 10) || 500)}
                  style={{ width: 80 }}
                />
              </div>
              <div style={{ flex: 1 }} />
              {isRobustnessOptimized && (
                <>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', background: 'rgba(201,168,76,0.12)', borderRadius: 999, padding: '3px 10px', border: '1px solid rgba(201,168,76,0.3)', whiteSpace: 'nowrap' }}>
                    ✓ Robustness strategy (preview)
                  </span>
                  <button
                    onClick={() => { applyOptimizerResult(robustnessPlan!); setRobustnessPlan(null); }}
                    disabled={running || optimizingRobust}
                    style={{ fontSize: 11, fontWeight: 600, background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '4px 10px', whiteSpace: 'nowrap' }}
                  >
                    Apply to Plan
                  </button>
                  <button
                    onClick={() => { setRobustnessPlan(null); setResult(null); }}
                    disabled={running || optimizingRobust}
                    style={{ fontSize: 11, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px 6px', textDecoration: 'underline' }}
                  >
                    Discard
                  </button>
                </>
              )}
              <button className="btn btn-gold" onClick={run} disabled={running || optimizingRobust}>{running ? 'Running…' : '▶ Run Simulation'}</button>
              <button
                className="btn"
                onClick={optimizeForRobustness}
                disabled={running || optimizingRobust || !result}
                title={result ? 'Re-optimize the withdrawal strategy across 15 historical return sequences (~60–90s)' : 'Run a simulation first'}
              >
                {optimizingRobust ? 'Optimizing…' : 'Optimize for Robustness'}
              </button>
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Historical block bootstrap</strong> — randomly assembles 3-year blocks of real S&amp;P 500 + Treasury returns (1928–2023), blended {mixLabel} stock/bond, into 500 synthetic sequences.
              Each block preserves short-run volatility clustering, but long secular trends (e.g., the 16-year 1966–1982 stagflation era) get broken up and diluted.
              Result: a broad probability distribution over many possible futures. Tends to be somewhat optimistic for long retirements because it cannot reproduce multi-decade bear markets intact.
            </div>
          </div>
        </div>

        {optimizingRobust && (
          <div className="panel" style={{ marginBottom: 16 }}>
            <div className="panel-body">
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                {robustProgress.msg ?? 'Optimizing across 15 historical return sequences…'}
              </div>
              <div style={{ background: 'var(--surface-2)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round(Math.min(1, Math.max(0, robustProgress.frac)) * 100)}%`,
                  background: 'var(--gold)',
                  transition: 'width 200ms ease',
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, textAlign: 'right' }}>
                {Math.round(Math.min(1, Math.max(0, robustProgress.frac)) * 100)}%
              </div>
            </div>
          </div>
        )}

        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Probability of Success</div>
            <div className="metric-value" style={{ color: result ? successColor(result.successRate) : undefined }}>
              {result ? fmtPct(result.successRate, 0) : '—'}
            </div>
            <div className="metric-sub">{result ? `${result.trials} trials · ${Math.round(result.equityPct * 100)}/${100 - Math.round(result.equityPct * 100)}` : 'Configure inputs and run'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Median Final Portfolio</div>
            <div className="metric-value">{result ? fmtM(real ? result.medianEndBalance : result.medianEndBalanceNominal) : '—'}</div>
            <div className="metric-sub">50th percentile ({real ? "today's $" : 'nominal $'})</div>
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

        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Historical worst-case cohorts</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>Click a card to overlay on chart</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {result ? result.stressScenarios.map((s, idx) => {
            const isSelected = selectedScenario === idx;
            const accentColor = s.successRate === 0 ? '#c0392b' : s.successRate < 1 ? '#e67e22' : 'var(--success)';
            return (
              <div
                key={s.name}
                className={`stress-card${isSelected ? ' selected' : ''}`}
                onClick={() => setSelectedScenario(isSelected ? null : idx)}
                style={{ borderLeft: `4px solid ${accentColor}`, borderColor: isSelected ? accentColor : undefined }}
              >
                <div className="stress-card-body">
                  <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, marginBottom: 2 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.3 }}>
                    {s.description}
                    {s.coverageEndAge !== undefined && <span style={{ color: 'var(--warning)', marginLeft: 4 }}>· data ends age {s.coverageEndAge}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Success</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: accentColor }}>{fmtPct(s.successRate, 0)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>End balance</div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtM(real ? s.medianEnd : s.medianEndNominal)}</div>
                    </div>
                  </div>
                </div>
                <div
                  className="stress-card-footer"
                  onClick={(e) => { e.stopPropagation(); setDetailScenario(idx); }}
                >
                  <span>{isSelected ? '▶ Overlaid on chart' : 'Click to overlay'}</span>
                  <span>View details →</span>
                </div>
              </div>
            );
          }) : [1966, 1973, 2000, 1929].map((yr) => (
            <div key={yr} className="stress-card" style={{ borderLeft: '4px solid var(--border)', opacity: 0.4, pointerEvents: 'none' }}>
              <div className="stress-card-body">
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>Retire into {yr}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-muted)' }}>—</div>
              </div>
              <div className="stress-card-footer"><span>Run simulation</span></div>
            </div>
          ))}
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

        {/* ── Historical Sequence Analysis ────────────────────────── */}
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Historical Sequence Analysis</div>
            <span className={`badge ${historicalResult ? 'badge-success' : 'badge-neutral'}`}>
              {runningHistorical ? 'Running' : historicalResult ? `${historicalResult.fullCoverageCount} cohorts` : 'Idle'}
            </span>
          </div>
          <div className="panel-body">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Historical sequence analysis</strong> — runs your plan through every actual retirement cohort from 1928 to 2023 in order, using real sequential returns and CPI with no sampling or randomization.
                Someone who retired in 1966 gets the actual 1966–2000 return sequence, including all 16 years of stagflation intact.
                The historical success rate is the share of full-coverage cohorts that did not run out of money.
                More conservative than bootstrap for long retirements; red lines on the chart are the cohorts that failed.
              </div>
              <button className="btn btn-gold" onClick={runHistorical} disabled={runningHistorical || running || optimizingRobust}>
                {runningHistorical ? 'Running…' : '▶ Run Historical Sequences'}
              </button>
            </div>

            {historicalResult && (() => {
              const hr = historicalResult;
              const failed = hr.cohorts.filter((c) => c.fullCoverage && !c.survived);
              const worst = hr.cohorts.filter((c) => c.fullCoverage).sort((a, b) => a.endBalanceReal - b.endBalanceReal)[0];
              const hColor = hr.historicalSuccessRate >= 0.95 ? 'var(--success)' : hr.historicalSuccessRate >= 0.80 ? 'var(--warning)' : 'var(--danger)';
              return (
                <>
                  <div className="metrics-grid" style={{ marginBottom: 16 }}>
                    <div className="metric-card">
                      <div className="metric-label">Historical Success Rate</div>
                      <div className="metric-value" style={{ color: hColor }}>{fmtPct(hr.historicalSuccessRate, 0)}</div>
                      <div className="metric-sub">Full-coverage cohorts only</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Cohorts Tested</div>
                      <div className="metric-value">{hr.fullCoverageCount}</div>
                      <div className="metric-sub">Full retirement window covered</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Failed Cohorts</div>
                      <div className="metric-value" style={{ color: failed.length > 0 ? 'var(--danger)' : 'var(--success)' }}>{failed.length}</div>
                      <div className="metric-sub">{failed.length > 0 ? failed.map((c) => c.startYear).join(', ') : 'All survived'}</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Worst Cohort End Balance</div>
                      <div className="metric-value">{worst ? fmtK(worst.endBalanceReal) : '—'}</div>
                      <div className="metric-sub">{worst ? `Retire ${worst.startYear} · today's $` : ''}</div>
                    </div>
                  </div>

                  {/* Survival timeline */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5, display: 'flex', gap: 12 }}>
                      <span>Retirement start year</span>
                      <span style={{ color: '#1a8a5a' }}>■ Survived</span>
                      <span style={{ color: '#c0392b' }}>■ Failed</span>
                      <span style={{ color: 'rgba(13,27,46,0.2)' }}>■ Partial data</span>
                    </div>
                    <div style={{ display: 'flex', gap: 1 }}>
                      {hr.cohorts.map((c) => (
                        <div
                          key={c.startYear}
                          title={`Retire ${c.startYear}: ${!c.fullCoverage ? 'Partial data' : c.survived ? '✓ Survived' : '✗ Failed'}`}
                          style={{
                            width: 7, minWidth: 7, height: 20, borderRadius: 2, cursor: 'default',
                            background: !c.fullCoverage ? 'rgba(13,27,46,0.12)' : c.survived ? '#1a8a5a' : '#c0392b',
                          }}
                        />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 1, marginTop: 2 }}>
                      {hr.cohorts.map((c) => (
                        <div key={c.startYear} style={{ width: 7, minWidth: 7, textAlign: 'center', fontSize: 8, color: 'var(--text-muted)', lineHeight: 1 }}>
                          {c.startYear % 10 === 0 ? String(c.startYear).slice(2) : ''}
                        </div>
                      ))}
                    </div>
                  </div>

                  <HistoricalCohortChart result={hr} height={300} />
                </>
              );
            })()}

            {!historicalResult && (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', background: 'rgba(13,27,46,0.03)', borderRadius: 8 }}>
                Run historical sequences to see all {`1928–2023`} cohorts plotted against your plan
              </div>
            )}
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
