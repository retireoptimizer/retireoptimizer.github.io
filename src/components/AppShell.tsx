import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useRef, useState } from 'react';
import BottomTabBar from './BottomTabBar';
import HowToGuide from './HowToGuide';
import ReleaseNotes from './ReleaseNotes';
import { usePlanStore } from '../store/usePlanStore';
import { useOptimizerStore } from '../store/useOptimizerStore';
import { downloadPlan, importPlanFromJSON, readFileAsText } from '../storage/exportImport';
import { planInputKey } from '../engine/planInputKey';
import { getEngineWorker } from '../engine/workerClient';
import { applyResultToPlan } from '../engine/applyOptimizerResult';
import type { UserGoal } from '../engine/recommender';

export default function AppShell() {
  const plan = usePlanStore((s) => s.plan);
  const applyOptimizerResult = usePlanStore((s) => s.applyOptimizerResult);
  const displayMode = usePlanStore((s) => s.displayMode);
  const setDisplayMode = usePlanStore((s) => s.setDisplayMode);
  const resetPlan = usePlanStore((s) => s.resetPlan);
  const optimizedPlanKey = useOptimizerStore((s) => s.planKey);
  const setPlanKey = useOptimizerStore((s) => s.setPlanKey);
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [reoptimizing, setReoptimizing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const optimizerDriven = !!plan.customPolicy && plan.optimizedForGoal != null;
  const outputTabsGated = optimizerDriven && optimizedPlanKey != null && planInputKey(plan) !== optimizedPlanKey;

  const runOptimizeAndNavigate = async () => {
    setReoptimizing(true);
    try {
      const worker = getEngineWorker();
      const selectedGoal = (plan.optimizedForGoal as UserGoal) ?? 'max-end-balance';
      let planForOptimize = plan;
      if (plan.baseExpenseStreams) planForOptimize = { ...planForOptimize, expenseStreams: plan.baseExpenseStreams };
      if (plan.basePersonA) {
        planForOptimize = { ...planForOptimize, personA: plan.basePersonA };
        if (plan.basePersonB !== undefined) planForOptimize = { ...planForOptimize, personB: plan.basePersonB };
      }
      const r = await worker.optimize(planForOptimize, selectedGoal, { useNelderMead: true, thorough: true });
      setPlanKey(planInputKey(planForOptimize));
      applyOptimizerResult(applyResultToPlan(planForOptimize, r));
      navigate('/dashboard');
    } catch (err) {
      console.error('[AppShell] Re-optimize failed:', err);
      showToast('err', 'Optimization failed — try again');
    } finally {
      setReoptimizing(false);
    }
  };

  const showToast = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 2500);
  };

  const onExport = () => {
    downloadPlan(plan, `retirement-optimizer-${new Date().toISOString().slice(0, 10)}.json`);
    showToast('ok', 'Plan exported');
  };

  const onImportClick = () => fileRef.current?.click();

  const onResetPlan = () => {
    if (!window.confirm("Reset the entire plan to defaults? This clears every page's inputs and can't be undone.")) return;
    resetPlan();
    navigate('/inputs');
    showToast('ok', 'Plan reset to defaults');
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const result = importPlanFromJSON(text);
      if (!result.ok || !result.plan) {
        showToast('err', result.error || 'Import failed');
      } else {
        usePlanStore.setState({ plan: result.plan });
        showToast('ok', 'Plan imported');
      }
    } catch (err) {
      showToast('err', `Read error: ${(err as Error).message}`);
    }
    e.target.value = '';
  };

  return (
    <>
      <div className="appbar">
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={onFileChange} />
        <div className="logo">
          <div className="logo-mark">R</div>
          <div className="logo-text">Retirement Optimizer</div>
        </div>

        <nav className="app-nav" aria-label="Primary">
          <NavLink
            to="/inputs"
            className={({ isActive }) => `atab${isActive || location.pathname === '/' ? ' active' : ''}`}
          >
            Inputs
          </NavLink>
          <span className="nav-divider" aria-hidden="true" />
          {outputTabsGated ? (
            <>
              <button
                onClick={runOptimizeAndNavigate}
                disabled={reoptimizing}
                className="atab"
                style={{
                  background: reoptimizing ? 'rgba(13,27,46,0.06)' : 'var(--gold)',
                  color: reoptimizing ? 'var(--text-muted)' : 'var(--navy)',
                  border: 'none', cursor: reoptimizing ? 'default' : 'pointer',
                  fontFamily: 'inherit', fontWeight: 700,
                }}
              >
                {reoptimizing ? 'Optimizing…' : '↗ Optimize'}
              </button>
              {['Dashboard', 'Projections', 'Taxes & Roth Conversions', 'Monte Carlo'].map((label) => (
                <span
                  key={label}
                  className="atab"
                  style={{ opacity: 0.3, cursor: 'not-allowed', pointerEvents: 'none' }}
                  title="Inputs changed — run Optimize first"
                >
                  {label}
                </span>
              ))}
            </>
          ) : (
            [
              { to: '/dashboard', label: 'Dashboard' },
              { to: '/projections', label: 'Projections' },
              { to: '/taxes', label: 'Taxes & Roth Conversions' },
              { to: '/montecarlo', label: 'Monte Carlo' },
            ].map(({ to, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `atab${isActive ? ' active' : ''}`}>
                {label}
              </NavLink>
            ))
          )}
        </nav>

        <div className="app-right">
          <div className="toggle-group" role="radiogroup" aria-label="Dollar display mode">
            <button
              className={`toggle-opt ${displayMode === 'real' ? 'active' : ''}`}
              onClick={() => setDisplayMode('real')}
              role="radio"
              aria-checked={displayMode === 'real'}
              title="Show all charts in today's purchasing power"
            >Today's $</button>
            <button
              className={`toggle-opt ${displayMode === 'nominal' ? 'active' : ''}`}
              onClick={() => setDisplayMode('nominal')}
              role="radio"
              aria-checked={displayMode === 'nominal'}
              title="Show inflated nominal dollars"
            >Nominal $</button>
          </div>
          <button className="appbar-action-btn appbar-reset-btn" onClick={onResetPlan}>Reset</button>
          <button className="appbar-action-btn" onClick={onImportClick}>Import</button>
          <button className="appbar-action-btn" onClick={onExport}>Export</button>
          <button
            className="appbar-help-btn"
            onClick={() => setGuideOpen(true)}
            aria-label="How-to Guide"
            title="How-to Guide"
          >?</button>
        </div>
      </div>

      {toast && (
        <div style={{
          position: 'fixed', top: 80, right: 24, zIndex: 1000,
          padding: '10px 16px', borderRadius: 8,
          background: toast.kind === 'ok' ? 'var(--success)' : 'var(--danger)',
          color: '#fff', fontSize: 13, fontWeight: 600,
          boxShadow: 'var(--shadow-lg)',
        }}>
          {toast.text}
        </div>
      )}

      <div className="content">
        <Outlet />
        <div style={{
          margin: '32px 0 8px',
          padding: '12px 16px',
          borderTop: '1px solid var(--border-light)',
          fontSize: 11,
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          textAlign: 'center',
        }}>
          <div style={{ marginBottom: 6, color: 'var(--text-secondary)' }}>
            <span>v{__APP_VERSION__}</span>
            <span style={{ margin: '0 6px', opacity: 0.4 }}>·</span>
            <span>{__BUILD_DATE__}</span>
            <span style={{ margin: '0 6px', opacity: 0.4 }}>·</span>
            <button
              onClick={() => setReleaseOpen(true)}
              style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--gold, #c9a84c)', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 2 }}
            >Release notes</button>
          </div>
          <strong style={{ color: 'var(--text-secondary)' }}>Not financial advice.</strong>{' '}
          Retirement Optimizer is an educational planning tool for illustrative and informational purposes only.
          It does not constitute professional financial, tax, investment, or legal advice.
          Results are projections based on the assumptions you enter and are not guarantees of future performance.
          Consult a qualified financial advisor before making retirement planning decisions.
        </div>
      </div>

      <BottomTabBar />
      <HowToGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
      <ReleaseNotes open={releaseOpen} onClose={() => setReleaseOpen(false)} />
    </>
  );
}
