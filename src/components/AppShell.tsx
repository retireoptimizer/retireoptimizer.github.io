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
  const [overflowOpen, setOverflowOpen] = useState(false);
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
    if (!window.confirm('Reset the entire plan to defaults? This clears every page’s inputs and can’t be undone.')) return;
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
          <button className="save-btn" onClick={onExport}>Export</button>
          <button
            className="appbar-overflow-btn btn btn-ghost"
            onClick={() => setOverflowOpen((o) => !o)}
            aria-label="More options"
            style={{ padding: '8px 12px', fontSize: 18, lineHeight: 1 }}
          >⋮</button>
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

      {overflowOpen && (
        <div
          style={{
            position: 'fixed', top: 60, right: 12,
            background: '#fff', border: '1px solid var(--border-light)',
            borderRadius: 10, boxShadow: 'var(--shadow-lg)',
            zIndex: 200, padding: '8px 0', minWidth: 160,
          }}
          onClick={() => setOverflowOpen(false)}
        >
          <div
            className="toggle-group"
            style={{ margin: '8px 14px', display: 'flex' }}
            role="radiogroup"
          >
            <button className={`toggle-opt ${displayMode === 'real' ? 'active' : ''}`} onClick={() => setDisplayMode('real')}>Today's $</button>
            <button className={`toggle-opt ${displayMode === 'nominal' ? 'active' : ''}`} onClick={() => setDisplayMode('nominal')}>Nominal $</button>
          </div>
          <button className="btn btn-ghost" onClick={() => setGuideOpen(true)}
            style={{ width: '100%', borderRadius: 0, padding: '10px 16px', textAlign: 'left', fontSize: 13 }}>
            How-to Guide
          </button>
          <button className="btn btn-ghost" onClick={onExport}
            style={{ width: '100%', borderRadius: 0, padding: '10px 16px', textAlign: 'left', fontSize: 13 }}>
            Export Plan
          </button>
          <button className="btn btn-ghost" onClick={onImportClick}
            style={{ width: '100%', borderRadius: 0, padding: '10px 16px', textAlign: 'left', fontSize: 13 }}>
            Import
          </button>
          <button className="btn btn-ghost" onClick={onResetPlan}
            style={{ width: '100%', borderRadius: 0, padding: '10px 16px', textAlign: 'left', fontSize: 13, color: 'var(--danger)' }}>
            Reset Plan
          </button>
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
