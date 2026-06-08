import { useState, useEffect } from 'react';
import * as Comlink from 'comlink';
import { usePlanStore } from '../store/usePlanStore';
import { USER_GOALS, type UserGoal } from '../engine/recommender';
import { type OptimizeResult } from '../engine/optimizer';
import { applyResultToPlan } from '../engine/applyOptimizerResult';
import { explainPolicy } from '../engine/explain/optimizerRationale';
import { getEngineWorker, disposeEngineWorker } from '../engine/workerClient';
import { fmtUSD, fmtK, fmtM } from '../lib/format';

/** Set Goals page (URL still /strategy for backwards-compat).
 *
 * Pure strategic-input surface: pick a goal, the optimizer recommends a withdrawal +
 * conversion schedule. Tactical knob-turning (preset + Roth conversion mode + custom
 * blend) lives on the Dashboard via StrategyChooser + StrategyCustomizeSheet. */
const GOAL_BADGES: Record<UserGoal, { badge: string; color: string; bg: string }> = {
  'max-end-balance':          { badge: 'Net Worth',  color: '#1a8a5a', bg: '#1a8a5a20' },
  'max-sustainable-spending': { badge: 'Spending',   color: '#7a5c10', bg: '#c9a84c20' },
  'min-retirement-age':       { badge: 'Retire Now', color: '#3b5e8a', bg: '#3b5e8a20' },
};

const VALID_GOALS: UserGoal[] = ['max-end-balance', 'max-sustainable-spending', 'min-retirement-age'];

export default function Strategy() {
  const plan = usePlanStore((s) => s.plan);
  const applyOptimizerResult = usePlanStore((s) => s.applyOptimizerResult);

  // Read ?goal=… so Dashboard breadcrumb links can pre-select and auto-run.
  const initialGoal: UserGoal = (() => {
    if (typeof window === 'undefined') return 'max-end-balance';
    const q = new URLSearchParams(window.location.search).get('goal');
    return VALID_GOALS.includes(q as UserGoal) ? (q as UserGoal) : 'max-end-balance';
  })();
  const [goal, setGoal] = useState<UserGoal>(initialGoal);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ frac: number; msg?: string }>({ frac: 0 });
  const [result, setResult] = useState<OptimizeResult | null>(null);

  /** Accepts an optional `goalOverride` because the goal-picker calls this synchronously
   *  after setGoal(), and React state is async. */
  const runOptimize = async (goalOverride?: UserGoal) => {
    const g = goalOverride ?? goal;
    setRunning(true);
    setResult(null);
    setProgress({ frac: 0 });
    try {
      const worker = getEngineWorker();
      const onProgress = Comlink.proxy((frac: number, msg?: string) => {
        setProgress({ frac, msg });
      });
      const r = await worker.optimize(plan, g, { useNelderMead: true, thorough: true }, onProgress);
      setResult(r);
    } finally {
      setRunning(false);
    }
  };

  // Auto-run when the page is opened with a ?goal=… param (typical when arriving
  // from the Dashboard's "Optimizing for: [Max spending]" breadcrumb link).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const q = new URLSearchParams(window.location.search).get('goal');
    if (VALID_GOALS.includes(q as UserGoal)) {
      runOptimize(q as UserGoal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reloadEngine = () => {
    disposeEngineWorker();
    setResult(null);
  };

  const applyOptimized = () => {
    if (!result) return;
    applyOptimizerResult(applyResultToPlan(plan, result));
  };

  const resetRec = () => {
    setResult(null);
    setRunning(false);
  };

  const showingResult = running || result !== null;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Goal</div>
            <div className="page-title">Set Goals</div>
            <div className="page-subtitle">Pick the outcome you want — the optimizer recommends a withdrawal and conversion schedule that hits it. Then play with strategy choices on the Dashboard.</div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button
            className="btn"
            onClick={reloadEngine}
            title="Force a fresh engine worker. Fixes 'Apply isn't updating' when dev-mode caching keeps the worker on stale engine code."
            style={{
              fontSize: 11, padding: '6px 12px',
              background: 'rgba(13,27,46,0.06)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
            }}
          >↻ Reload Engine</button>
        </div>

        {!showingResult && (
          <GoalSelectPanel goal={goal} setGoal={setGoal} runOptimize={runOptimize} />
        )}
        {showingResult && (
          <OptimizerResultPanel
            goal={goal}
            running={running}
            progress={progress}
            result={result}
            applyOptimized={applyOptimized}
            currentPolicyMatchesResult={
              !!plan.customPolicy && result
                ? result.goal === 'max-sustainable-spending'
                  ? false
                  : result.goal === 'min-retirement-age'
                    ? JSON.stringify(plan.customPolicy?.windows) === JSON.stringify(result.policy.windows)
                      && plan.personA.retirementAge === result.solvedRetirementAge
                    : JSON.stringify(plan.customPolicy?.windows) === JSON.stringify(result.policy.windows)
                : false
            }
            resetRec={resetRec}
            reloadEngine={reloadEngine}
          />
        )}
      </div>
    </div>
  );
}

function GoalSelectPanel({ goal, setGoal, runOptimize }: {
  goal: UserGoal; setGoal: (g: UserGoal) => void;
  runOptimize: (goalOverride?: UserGoal) => void;
}) {
  const handlePick = (g: UserGoal) => {
    setGoal(g);
    runOptimize(g);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title"><div className="panel-title-dot"></div>What outcome do you want?</div>
        <span className="badge badge-neutral">Pick one to run</span>
      </div>
      <div className="panel-body" style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
          The optimizer jointly searches withdrawal mix <em>and</em> Roth conversion amount year by year — every retirement year is an independent decision evaluated by a full forward projection. Runs in a Web Worker so the UI stays responsive.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(Object.values(USER_GOALS) as Array<typeof USER_GOALS[UserGoal]>).map((g) => {
            const active = g.key === goal;
            const meta = GOAL_BADGES[g.key];
            return (
              <label key={g.key} onClick={() => handlePick(g.key)} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                borderRadius: 10,
                border: active ? '2px solid var(--gold)' : '1px solid var(--border-light)',
                cursor: 'pointer',
              }}>
                <input type="radio" name="opt-goal" checked={active} readOnly style={{ marginTop: 3, accentColor: 'var(--gold)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                    {g.label}
                    <span style={{ fontSize: 10, background: meta.bg, color: meta.color, borderRadius: 4, padding: '2px 7px', marginLeft: 6 }}>{meta.badge}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{g.description}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ResultPanelProps {
  goal: UserGoal;
  running: boolean;
  progress: { frac: number; msg?: string };
  result: OptimizeResult | null;
  applyOptimized: () => void;
  currentPolicyMatchesResult: boolean;
  resetRec: () => void;
  reloadEngine: () => void;
}

function OptimizerResultPanel({ goal, running, progress, result, applyOptimized, currentPolicyMatchesResult, resetRec, reloadEngine }: ResultPanelProps) {
  const plan = usePlanStore((s) => s.plan);
  const goalSpec = USER_GOALS[goal];
  const meta = GOAL_BADGES[goal];
  const rationale = result ? explainPolicy(plan, result) : [];

  return (
    <div className="panel">
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={resetRec} title="Back to goal selection" style={{
            background: 'rgba(13,27,46,0.06)', border: '1px solid var(--border-light)', borderRadius: 8,
            padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)',
            fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>← Back</button>
          <div className="panel-title" style={{ margin: 0 }}>
            <div className="panel-title-dot"></div>
            <span>Optimizing: {goalSpec.label}</span>
          </div>
        </div>
        <span style={{ fontSize: 10, background: meta.bg, color: meta.color, borderRadius: 4, padding: '3px 8px', fontWeight: 600 }}>{meta.badge}</span>
      </div>
      <div className="panel-body" style={{ padding: '18px 24px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{goalSpec.description}</div>

        {running && (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <div style={{ marginBottom: 12 }}>{progress.msg ?? 'Optimizing…'}</div>
            <div style={{ width: '60%', margin: '0 auto', height: 8, background: 'rgba(13,27,46,0.08)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.round(Math.min(1, Math.max(0, progress.frac)) * 100)}%`,
                height: '100%', background: 'var(--gold)', transition: 'width 200ms ease',
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              {Math.round(Math.min(1, Math.max(0, progress.frac)) * 100)}%
            </div>
          </div>
        )}

        {result && !running && (
          <div>
            <div style={{
              background: 'linear-gradient(135deg, rgba(26,138,90,0.08), rgba(26,138,90,0.02))',
              border: '1px solid rgba(26,138,90,0.35)',
              borderRadius: 10, padding: '16px 20px', marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 360px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#1a8a5a' }}>
                    {result.headlineLabel}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6, fontFamily: "'Playfair Display', serif" }}>
                    {result.headline}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {result.evaluations.toLocaleString()} projections evaluated · {result.ranOut ? <span style={{ color: 'var(--danger, #c0392b)' }}>⚠ plan runs out</span> : <span style={{ color: '#1a8a5a' }}>✓ plan fully funded</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                    End balance: <strong>{fmtM(result.projection.endTotalReal)}</strong> (today's $) ·
                    Lifetime fed tax: <strong>{fmtK(result.projection.lifetimeFedTax)}</strong>
                    {result.goal === 'max-sustainable-spending' && typeof result.solvedSpendingMultiplier === 'number' && Math.abs(result.solvedSpendingMultiplier - 1) > 1e-6 && (
                      <span style={{ marginLeft: 6, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                        (at recommended spending × {result.solvedSpendingMultiplier.toFixed(2)})
                      </span>
                    )}
                    {result.goal === 'min-retirement-age' && typeof result.solvedRetirementAge === 'number' && result.solvedRetirementAge !== plan.personA.retirementAge && (
                      <span style={{ marginLeft: 6, fontStyle: 'italic', color: 'var(--text-muted)' }}>
                        (retiring at age {result.solvedRetirementAge})
                      </span>
                    )}
                  </div>
                  {result.goal === 'max-sustainable-spending' && typeof result.solvedSpendingMultiplier === 'number' && Math.abs(result.solvedSpendingMultiplier - 1) > 1e-6 && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                      Applying this scales every expense stream by <strong>×{result.solvedSpendingMultiplier.toFixed(2)}</strong> so your plan reflects the recommended spending level.
                    </div>
                  )}
                  {result.goal === 'min-retirement-age' && typeof result.solvedRetirementAge === 'number' && result.solvedRetirementAge !== plan.personA.retirementAge && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                      Applying this lowers {plan.personA.name}'s retirement age to <strong>{result.solvedRetirementAge}</strong>{plan.personB ? <> (and shifts {plan.personB.name}'s by the same delta)</> : null} so your plan reflects the earliest feasible retirement.
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn btn-gold" onClick={applyOptimized} disabled={currentPolicyMatchesResult}
                    style={{ opacity: currentPolicyMatchesResult ? 0.5 : 1 }}>
                    {currentPolicyMatchesResult
                      ? 'Already Applied'
                      : result.goal === 'max-sustainable-spending' && typeof result.solvedSpendingMultiplier === 'number' && Math.abs(result.solvedSpendingMultiplier - 1) > 1e-6
                        ? 'Apply Policy & Spending'
                        : result.goal === 'min-retirement-age' && typeof result.solvedRetirementAge === 'number' && result.solvedRetirementAge !== plan.personA.retirementAge
                          ? 'Apply Policy & Retirement Age'
                          : 'Apply This Policy'}
                  </button>
                  <button className="btn" onClick={reloadEngine}
                    title="Force a fresh engine worker. Use if results look stale despite running optimizer + hard reload."
                    style={{
                      fontSize: 11, padding: '6px 10px',
                      background: 'rgba(13,27,46,0.06)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-light)',
                    }}>↻ Reload Engine</button>
                </div>
              </div>
            </div>

            {rationale.length > 0 && (
              <div style={{
                background: 'rgba(13,27,46,0.03)',
                border: '1px solid var(--border-light)',
                borderRadius: 10,
                padding: '14px 18px',
                marginBottom: 16,
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Why the optimizer picked this
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
                  {rationale.map((line, i) => (
                    <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 8 }}>
              Recommended Strategy By Age Window
            </div>
            <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Age Window</th>
                  <th style={{ textAlign: 'right' }}>Taxable</th>
                  <th style={{ textAlign: 'right' }}>Pre-tax</th>
                  <th style={{ textAlign: 'right' }}>Roth</th>
                  <th style={{ textAlign: 'right' }}>Conv $/yr (today's $)</th>
                </tr>
              </thead>
              <tbody>
                {result.policy.windows.map((w, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>Ages {w.fromAge}–{w.toAge}</td>
                    <td style={{ textAlign: 'right' }}>{Math.round(w.pctTaxable * 100)}%</td>
                    <td style={{ textAlign: 'right' }}>{Math.round(w.pctTraditional * 100)}%</td>
                    <td style={{ textAlign: 'right' }}>{Math.round(w.pctRoth * 100)}%</td>
                    <td style={{ textAlign: 'right' }}>{w.convAmt && w.convAmt > 0 ? fmtUSD(w.convAmt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
              The optimizer made independent decisions for every retirement year; consecutive years with the same blend are merged for display. RMDs (when applicable) are honored first; the blend covers the remaining gap.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
