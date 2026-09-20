import { useState, useMemo, useEffect } from 'react';
import * as Comlink from 'comlink';
import { usePlanStore, useProjection } from '../store/usePlanStore';
import { useOptimizerStore } from '../store/useOptimizerStore';
import { useWhatIfStore, applyWhatIf } from '../store/useWhatIfStore';
import type { Plan } from '../schemas/plan';
import { getEngineWorker } from '../engine/workerClient';
import { applyResultToPlan } from '../engine/applyOptimizerResult';
import MonteCarloFan from '../components/charts/MonteCarloFan';
import HistoricalCohortChart from '../components/charts/HistoricalCohortChart';
import StressScenarioModal from '../components/StressScenarioModal';
import { fmtM, fmtK, fmtPct, fmtPtsWithSign } from '../lib/format';

import { generateInsights, insightsForSurface } from '../engine/explain';
import InsightCard from '../components/InsightCard';
import { useApplyOptimizerPlan } from '../hooks/useApplyOptimizerPlan';
import OptimizerBadge from '../components/OptimizerBadge';
import { useOptimizerApplied } from '../hooks/useOptimizerApplied';
import LearnMoreModal, { MC_SIMULATE_HELP, MC_OPTIMIZE_HELP } from '../components/LearnMoreModal';
import type { HelpTopic } from '../components/LearnMoreModal';
import { policyStatus } from '../engine/policyStatus';
import { planInputKey } from '../engine/planInputKey';
import { type McPosture } from '../engine/goalLabels';
import { loadEquityPct, saveEquityPct } from '../lib/mcPrefs';
import StalePlanGate from '../components/StalePlanGate';

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

/** Posture used for the robustness run. Measured on real plans, the three postures produce
 *  strategies that score within a rounding error of each other, so the page no longer asks the
 *  user to choose one. Balanced weighs the worst quarter of markets and the average equally. */
const ROBUSTNESS_POSTURE: McPosture = 'balanced';

/** Minimum success-rate gain, in percentage points, before the tuned strategy is worth offering.
 *  At 5,000 trials the standard error on a success rate near 85% is about 0.5 points, so anything
 *  under a full point is indistinguishable from sampling noise. */
const MIN_GAIN_PTS = 1.0;

/** Subtle inline help trigger placed beside a step heading. */
function LearnMoreLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        fontSize: 11, color: 'var(--text-muted)', textDecoration: 'underline',
        textUnderlineOffset: 2, whiteSpace: 'nowrap',
      }}
    >
      ⓘ Learn more
    </button>
  );
}

const bandColor = (t: RiskBand['tone']): string => {
  if (t === 'success') return 'var(--success)';
  if (t === 'good') return 'var(--success)';
  if (t === 'warning') return 'var(--warning)';
  return 'var(--danger)';
};

export default function MonteCarlo() {
  const plan = usePlanStore((s) => s.plan);
  const whatIf = useWhatIfStore();
  const pendingPlan = useOptimizerStore((s) => s.pendingPlan);
  const robustnessPlan = useOptimizerStore((s) => s.robustnessPlan);
  const setRobustnessPlan = useOptimizerStore((s) => s.setRobustnessPlan);
  const robustnessComparison = useOptimizerStore((s) => s.robustnessComparison);
  const setRobustnessComparison = useOptimizerStore((s) => s.setRobustnessComparison);
  const setOptimizerResult = useOptimizerStore((s) => s.setResult);
  const mcResult = useOptimizerStore((s) => s.mcResult);
  const setMcResult = useOptimizerStore((s) => s.setMcResult);
  const mcHistoricalResult = useOptimizerStore((s) => s.mcHistoricalResult);
  const setMcHistoricalResult = useOptimizerStore((s) => s.setMcHistoricalResult);
  const mcRobustOutcome = useOptimizerStore((s) => s.mcRobustOutcome);
  const setMcRobustOutcome = useOptimizerStore((s) => s.setMcRobustOutcome);
  const mcTrials = useOptimizerStore((s) => s.mcTrials);
  const setMcTrials = useOptimizerStore((s) => s.setMcTrials);
  const mcDirty = useOptimizerStore((s) => s.mcDirty);
  const setMcDirty = useOptimizerStore((s) => s.setMcDirty);
  const clearMcResults = useOptimizerStore((s) => s.clearMcResults);
  const mcPlanKey = useOptimizerStore((s) => s.mcPlanKey);
  const setMcPlanKey = useOptimizerStore((s) => s.setMcPlanKey);
  const displayMode = usePlanStore((s) => s.displayMode);
  const applyOptimizerPlan = useApplyOptimizerPlan();
  const optimizerAppliedState = useOptimizerApplied();

  // Unified analysed plan: what-if overrides applied on top of any pending optimizer plan.
  // optimizeForRobustness uses mcBase (not robustnessPlan ?? mcBase) so re-optimizing on a
  // preview doesn't compound, and applyResultToPlan gets an unscaled base for max-sustainable-spending.
  const mcBase = useMemo(
    () => applyWhatIf(pendingPlan ?? plan, whatIf),
    [pendingPlan, plan, whatIf],
  );

  const real = displayMode === 'real';
  const proj = useProjection(mcBase);

  const [equityPct, setEquityPct] = useState(loadEquityPct);
  // trials and dirty live in the store so they survive navigation; expose local aliases for brevity.
  const trials = mcTrials;
  const setTrials = setMcTrials;
  const result = mcResult;
  const setResult = setMcResult;
  const historicalResult = mcHistoricalResult;
  const setHistoricalResult = setMcHistoricalResult;
  const robustOutcome = mcRobustOutcome;
  const setRobustOutcome = setMcRobustOutcome;
  const dirty = mcDirty;
  const setDirty = setMcDirty;
  // The Apply bar requires both a preview plan and a result that earned it. The second clause
  // keeps a stale preview from outliving the run that produced it.
  const isRobustnessOptimized = !!robustnessPlan && (robustOutcome === null || robustOutcome.worthIt);
  const [running, setRunning] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<number | null>(null);
  const [detailScenario, setDetailScenario] = useState<number | null>(null);
  const [optimizingRobust, setOptimizingRobust] = useState(false);
  const [robustProgress, setRobustProgress] = useState<{ frac: number; msg?: string }>({ frac: 0 });
  const [runningHistorical, setRunningHistorical] = useState(false);
  // Fixed seed — deterministic results across re-runs.
  const seed = 42;
  // Holds the posture that was applied, so the confirmation keeps naming the right one even if
  // the user changes the posture picker afterwards. null = no confirmation showing.
  const [applySuccess, setApplySuccess] = useState<'floor' | 'balanced' | 'growth' | null>(null);
  const [helpTopic, setHelpTopic] = useState<HelpTopic | null>(null);

  // Track the plan fingerprint. On mount: if results exist but the stored key differs from the
  // current plan (user changed inputs on another page), clear before the user sees stale numbers.
  // While mounted: if the key changes reactively (What-If slider or equity % changes on this page),
  // clear immediately and mark dirty so the user knows to re-run.
  const planKey = planInputKey(mcBase);
  useEffect(() => {
    if (mcResult && mcPlanKey !== null && mcPlanKey !== planKey) {
      clearMcResults();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only: catch cross-page changes by comparing stored key vs current key

  useEffect(() => {
    if (mcPlanKey !== null && mcPlanKey !== planKey) {
      clearMcResults();
    }
  }, [planKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    setRunning(true);
    setDirty(false);
    setRobustnessComparison(null);
    setApplySuccess(null);
    try {
      const worker = getEngineWorker();
      const mc = await worker.monteCarlo(robustnessPlan ?? mcBase, { trials, model: 'historical', equityPct: equityPct / 100, seed });
      setResult(mc);
      setMcPlanKey(planKey);
    } finally {
      setRunning(false);
    }
  };

  const runHistorical = async () => {
    setRunningHistorical(true);
    try {
      const worker = getEngineWorker();
      const sweep = await worker.historicalSweep(robustnessPlan ?? mcBase, { equityPct: equityPct / 100 });
      setHistoricalResult(sweep);
    } finally {
      setRunningHistorical(false);
    }
  };

  const optimizeForRobustness = async () => {
    setOptimizingRobust(true);
    setRobustProgress({ frac: 0 });
    setRobustOutcome(null);
    setApplySuccess(null);
    try {
      const worker = getEngineWorker();
      const onProgress = Comlink.proxy((frac: number, msg?: string) => setRobustProgress({ frac, msg }));
      // Use mcBase as the base — never a previous preview, to avoid compounding.
      const goal = mcBase.optimizedForGoal ?? 'max-end-balance';
      const mcOpts = { trials, model: 'historical' as const, equityPct: equityPct / 100, seed };
      const before = await worker.monteCarlo(mcBase, mcOpts);
      const optResult = await worker.optimize(
        mcBase, goal,
        { useNelderMead: true, thorough: true, mcAware: true, equityPct: equityPct / 100, mcPosture: ROBUSTNESS_POSTURE, mcSeed: seed },
        onProgress,
      );
      const basePlan = applyResultToPlan(mcBase, optResult);
      // Out-of-sample score: the search used 32 bootstrap paths, so its own numbers are optimistic.
      const after = await worker.monteCarlo(basePlan, mcOpts);
      const gainPts = (after.successRate - before.successRate) * 100;
      const worthIt = gainPts >= MIN_GAIN_PTS;
      const plan: Plan = {
        ...basePlan,
        // Provenance, so the Dashboard can tell this apart from a goal-optimizer run.
        optimizedBy: 'monte-carlo',
        mcTuning: {
          posture: ROBUSTNESS_POSTURE,
          before: before.successRate,
          after: after.successRate,
          trials,
          equityPct: equityPct / 100,
        },
      };
      setRobustOutcome({ plan, optResult, before, after, gainPts, worthIt });
      // Only a gain worth acting on becomes a preview. A wash leaves the charts on today's plan,
      // so the page never implies a change the numbers do not support.
      if (worthIt) {
        setRobustnessPlan(plan);
        setResult(after);
        setOptimizerResult(optResult);
        setRobustnessComparison({ before: before.successRate, after: after.successRate, trials, equityPct: equityPct / 100, seed });
      } else {
        // Clear any preview a previous run left behind. Without this the Apply bar would linger
        // next to a "No meaningful gain" strip, offering a strategy this run did not endorse.
        setRobustnessPlan(null);
        setRobustnessComparison(null);
        setResult(before);
      }
    } finally {
      setOptimizingRobust(false);
    }
  };

  const handleApply = () => {
    if (!robustnessPlan) return;
    applyOptimizerPlan(robustnessPlan);
    setRobustnessPlan(null);
    setRobustnessComparison(null);
    setApplySuccess(robustnessPlan.mcTuning?.posture ?? ROBUSTNESS_POSTURE);
    setRobustOutcome(null);
  };

  const handleDiscard = () => {
    setRobustnessPlan(null);
    setRobustnessComparison(null);
    setResult(null);
    setRobustOutcome(null);
  };

  const mixLabel = `${equityPct}/${100 - equityPct}`;

  const successColor = (rate: number) => rate >= 0.9 ? 'var(--success)' : rate >= 0.75 ? 'var(--warning)' : 'var(--danger)';

  const band = result ? riskBandFor(result.successRate) : null;
  const insights = result ? insightsForSurface(generateInsights(plan, proj, result), 'mc') : [];

  const samplingRange = result
    ? (1.96 * Math.sqrt(result.successRate * (1 - result.successRate) / result.trials) * 100).toFixed(1)
    : null;

  if (policyStatus(plan) === 'stale' && pendingPlan === null) return <StalePlanGate />;

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
          <div className="panel-body" style={{ padding: 0 }}>
            {/* Two-step workflow in one container: Simulate → Optimize. */}
            <div style={{ display: 'flex', alignItems: 'stretch' }}>

              {/* ── Step 1 · Simulate ── */}
              <div style={{ flex: '0 0 42%', padding: '12px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', background: 'var(--gold)', color: '#000',
                    fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>1</span>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Simulate</span>
                  <LearnMoreLink onClick={() => setHelpTopic(MC_SIMULATE_HELP)} />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Equity %</label>
                    <input
                      type="number"
                      value={equityPct}
                      min={0} max={100} step={5}
                      onChange={(e) => { const v = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0)); setEquityPct(v); saveEquityPct(v); setDirty(true); setRobustnessComparison(null); }}
                      style={{ width: 60 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Bond %</label>
                    <input type="text" value={`${100 - equityPct}`} readOnly style={{ width: 60, background: 'var(--surface-2)', color: 'var(--text-muted)' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Trials</label>
                    <input
                      type="number"
                      value={trials}
                      min={50} max={20000} step={50}
                      onChange={(e) => { setTrials(Math.min(20000, parseInt(e.target.value, 10) || 5000)); setDirty(true); setRobustnessComparison(null); }}
                      style={{ width: 72 }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <button className="btn btn-gold" onClick={run} disabled={running || optimizingRobust}>
                    {running ? 'Running…' : '▶ Run Simulation'}
                  </button>
                  {whatIf.active && (
                    <span className="badge badge-warning" style={{ whiteSpace: 'nowrap' }}>What-if overrides active</span>
                  )}
                  <OptimizerBadge state={optimizerAppliedState} />
                </div>
              </div>

              {/* ── Connector ── */}
              <div style={{ flex: '0 0 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                <div style={{ width: 1, flex: 1, background: 'var(--border)' }} />
                <span style={{
                  fontSize: 12, color: result && !dirty ? 'var(--gold)' : 'var(--text-muted)',
                  background: 'var(--surface-1)', lineHeight: 1, padding: '3px 0',
                }}>▶</span>
                <div style={{ width: 1, flex: 1, background: 'var(--border)' }} />
              </div>

              {/* ── Step 2 · Optimize ── */}
              <div style={{
                flex: 1, padding: '12px 18px',
                background: result && !dirty ? 'rgba(212,175,55,0.045)' : 'rgba(13,27,46,0.03)',
                opacity: result && !dirty ? 1 : 0.65,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: result && !dirty ? 'var(--gold)' : 'var(--text-muted)',
                    color: result && !dirty ? '#000' : 'var(--surface-1)',
                    fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>2</span>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                    Optimize the strategy
                  </span>
                  <LearnMoreLink onClick={() => setHelpTopic(MC_OPTIMIZE_HELP)} />
                  {!result && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>(run a simulation first)</span>}
                  {result && dirty && <span style={{ fontSize: 11, color: 'var(--warning)' }}>(inputs changed, re-run first)</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                  <button
                    className={result && !dirty ? 'btn btn-gold' : 'btn'}
                    onClick={optimizeForRobustness}
                    disabled={running || optimizingRobust || !result || dirty}
                  >
                    {optimizingRobust ? 'Optimizing…' : '⚡ Optimize for Robustness'}
                  </button>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 430 }}>
                    Re-tunes your withdrawal order and Roth conversions against a bad run of markets, then
                    scores the result on {trials.toLocaleString()} fresh market histories.
                  </span>
                </div>

                {/* Outcome strip. A tuned strategy is only offered when it beats today's by more than
                    the simulation's own margin of error, so a wash reads as a wash. */}
                {robustOutcome && !optimizingRobust && (
                  <div style={{
                    marginTop: 10, padding: '8px 11px', borderRadius: 6, fontSize: 11.5, lineHeight: 1.55,
                    background: robustOutcome.worthIt ? 'rgba(26,138,90,0.09)' : 'var(--surface-2)',
                    border: `1px solid ${robustOutcome.worthIt ? 'rgba(26,138,90,0.4)' : 'var(--border)'}`,
                  }}>
                    <span style={{ fontWeight: 700, color: robustOutcome.worthIt ? 'var(--success)' : 'var(--text-secondary)' }}>
                      {robustOutcome.worthIt ? '✓ Found a better strategy' : 'No meaningful gain'}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {'  '}{fmtPct(robustOutcome.before.successRate, 1)} → {fmtPct(robustOutcome.after.successRate, 1)} chance of success
                      {'  ·  '}typical end balance {fmtM(real ? robustOutcome.before.medianEndBalance : robustOutcome.before.medianEndBalanceNominal)} → {fmtM(real ? robustOutcome.after.medianEndBalance : robustOutcome.after.medianEndBalanceNominal)}
                    </span>
                    {!robustOutcome.worthIt && (
                      <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                        Your withdrawal order and Roth conversions are already doing what they can here. The levers
                        that move this number are your spending, your retirement age, and your stock and bond mix.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {optimizingRobust && (
              <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {robustProgress.msg ?? 'Optimizing across historical return sequences…'}
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
            )}

            {/* ── Step 3 · Apply / discard the optimized strategy ── */}
            {isRobustnessOptimized && !optimizingRobust && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 18px', background: 'rgba(212,175,55,0.1)', borderTop: '1px solid rgba(212,175,55,0.4)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                    Optimized strategy ready — previewing below
                    {robustnessComparison && (
                      <span style={{ marginLeft: 8, fontWeight: 600, color: robustnessComparison.after >= robustnessComparison.before ? 'var(--success)' : 'var(--danger)' }}>
                        {fmtPct(robustnessComparison.before, 1)} → {fmtPct(robustnessComparison.after, 1)} · {fmtPtsWithSign(robustnessComparison.after - robustnessComparison.before, 1)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Applying will <strong>overwrite</strong> your current withdrawal ordering and Roth conversion settings across the whole plan.
                  </div>
                </div>
                <button
                  onClick={handleApply}
                  disabled={running || optimizingRobust}
                  style={{ fontSize: 12, fontWeight: 700, background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '7px 16px', whiteSpace: 'nowrap' }}
                >
                  Apply to Plan
                </button>
                <button
                  onClick={handleDiscard}
                  disabled={running || optimizingRobust}
                  style={{ fontSize: 11, background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '3px 6px', textDecoration: 'underline' }}
                >
                  Discard
                </button>
              </div>
            )}

            {applySuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'rgba(26,138,90,0.1)', borderTop: '1px solid rgba(26,138,90,0.4)', fontSize: 12 }}>
                <div style={{ flex: 1, lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700, color: 'var(--success)' }}>✓ Applied to your plan</span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {' '}Your withdrawal ordering and Roth conversion settings were replaced with the tuned strategy from this page and saved.
                    The Dashboard and Projections pages now show it, and the Dashboard badge reads &ldquo;Monte Carlo tuned&rdquo; so you can tell it apart from a goal optimizer run.
                  </span>
                </div>
                <button
                  onClick={() => setApplySuccess(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
                >
                  ✕
                </button>
              </div>
            )}

            <div style={{ padding: '8px 18px 10px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Success rates on this page usually read higher than the Dashboard. The Dashboard uses one fixed return every year. This page replays real market history from 1928 to 2023 at your {mixLabel} stock and bond mix.{' '}
              <LearnMoreLink onClick={() => setHelpTopic(MC_SIMULATE_HELP)} />
            </div>
          </div>
        </div>

        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Probability of Success</div>
            <div className="metric-value" style={{ color: result ? successColor(result.successRate) : undefined }}>
              {result ? fmtPct(result.successRate, 0) : '—'}
            </div>
            <div className="metric-sub">
              {result
                ? (
                  <>
                    {samplingRange && <span>±{samplingRange} pts sampling range · </span>}
                    {robustnessComparison
                      ? <span style={{ color: robustnessComparison.after >= robustnessComparison.before ? 'var(--success)' : 'var(--danger)' }}>{fmtPct(robustnessComparison.before, 1)} → {fmtPct(robustnessComparison.after, 1)} · {fmtPtsWithSign(robustnessComparison.after - robustnessComparison.before, 1)}</span>
                      : <span>{result.trials} trials · {Math.round(result.equityPct * 100)}/{100 - Math.round(result.equityPct * 100)}</span>
                    }
                  </>
                )
                : 'Configure inputs and run'
              }
            </div>
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
            <span className={`badge ${dirty ? 'badge-warning' : result ? 'badge-success' : 'badge-neutral'}`}>
              {running ? 'Running' : dirty ? 'Inputs changed' : result ? 'Complete' : 'Idle'}
            </span>
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

      {helpTopic && (
        <LearnMoreModal topic={helpTopic} onClose={() => setHelpTopic(null)} />
      )}
    </div>
  );
}
