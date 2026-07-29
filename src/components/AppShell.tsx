import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useRef, useState } from 'react';
import BottomTabBar from './BottomTabBar';
import HowToGuide from './HowToGuide';
import { usePlanStore } from '../store/usePlanStore';
import { downloadPlan, importPlanFromJSON, readFileAsText } from '../storage/exportImport';

export default function AppShell() {
  const plan = usePlanStore((s) => s.plan);
  const displayMode = usePlanStore((s) => s.displayMode);
  const setDisplayMode = usePlanStore((s) => s.setDisplayMode);
  const resetPlan = usePlanStore((s) => s.resetPlan);
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
          {[
            { to: '/dashboard', label: 'Dashboard' },
            { to: '/projections', label: 'Projections' },
            { to: '/taxes', label: 'Taxes & Roth Conversions' },
            { to: '/montecarlo', label: 'Monte Carlo' },
          ].map(({ to, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `atab${isActive ? ' active' : ''}`}>
              {label}
            </NavLink>
          ))}
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
      </div>

      <BottomTabBar />
      <HowToGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </>
  );
}
