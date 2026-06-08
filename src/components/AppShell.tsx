import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useRef, useState } from 'react';
import LiveMetricsBar from './LiveMetricsBar';
import { usePlanStore } from '../store/usePlanStore';
import { downloadPlan, importPlanFromJSON, readFileAsText } from '../storage/exportImport';

export default function AppShell() {
  const plan = usePlanStore((s) => s.plan);
  const displayMode = usePlanStore((s) => s.displayMode);
  const setDisplayMode = usePlanStore((s) => s.setDisplayMode);
  const fileRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const navigate = useNavigate();

  const onBuildPlan = () => {
    navigate('/');
    setToast({ kind: 'ok', text: 'Plan built — viewing dashboard' });
    setTimeout(() => setToast(null), 2500);
  };

  const onExport = () => {
    downloadPlan(plan, `fireopt-${new Date().toISOString().slice(0, 10)}.json`);
    setToast({ kind: 'ok', text: 'Plan exported' });
    setTimeout(() => setToast(null), 2500);
  };

  const onImportClick = () => fileRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const result = importPlanFromJSON(text);
      if (!result.ok || !result.plan) {
        setToast({ kind: 'err', text: result.error || 'Import failed' });
      } else {
        // Overwrite plan via store internals — use the setter pattern
        usePlanStore.setState({ plan: result.plan });
        setToast({ kind: 'ok', text: 'Plan imported' });
      }
    } catch (err) {
      setToast({ kind: 'err', text: `Read error: ${(err as Error).message}` });
    }
    e.target.value = '';
    setTimeout(() => setToast(null), 3500);
  };

  return (
    <>
      <div className="topbar">
        <div className="logo">
          <div className="logo-mark">C</div>
          <div>
            <div className="logo-text">Clarity Wealth</div>
            <div className="logo-sub">Retirement Planning</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="toggle-group" role="radiogroup" aria-label="Dollar display mode" style={{ marginRight: 8 }}>
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
          <div className="client-badge">
            <div className="avatar">SP</div>
            <div className="client-name">My Retirement Plan</div>
          </div>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={onFileChange} />
          <button className="btn btn-ghost" onClick={onImportClick} style={{ padding: '8px 14px', fontSize: 12 }}>Import</button>
          <button className="save-btn" onClick={onExport}>Export Plan</button>
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

      <div className="app-shell">
        <div className="sidebar">
          <div className="sidebar-section-label">Inputs</div>
          <NavLink to="/personal" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="8" r="4" strokeWidth="1.8"/>
              <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" strokeWidth="1.8"/>
            </svg>
            Personal Details
          </NavLink>
          <NavLink to="/income" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 3v18M17 8H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H7" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Income Streams
          </NavLink>
          <NavLink to="/expenses" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M3 10h18M7 15h.01M11 15h.01M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" strokeWidth="1.8"/>
            </svg>
            Expenses
          </NavLink>
          <NavLink to="/portfolio" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M21 21H3V3M21 9l-5 5-4-4-5 5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Portfolio
          </NavLink>
          <NavLink to="/strategy" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeWidth="1.8"/>
            </svg>
            Set Goals
          </NavLink>

          <button
            className="btn btn-gold"
            onClick={onBuildPlan}
            style={{ margin: '12px 12px 8px 12px', justifyContent: 'center', fontSize: 13, padding: '10px 14px' }}
          >
            Build Plan →
          </button>

          <div className="sidebar-section-label">Results</div>
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8"/>
            </svg>
            Dashboard
          </NavLink>
          <NavLink to="/projections" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2c2.76 0 5.26 1.12 7.07 2.93M22 2l-3.5 3.5M16 2h6v6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Projections
          </NavLink>
          <NavLink to="/taxes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.8"/>
              <path d="M9 14l2 2 4-5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Tax Planning
          </NavLink>
          <NavLink to="/montecarlo" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M18 20V10M12 20V4M6 20v-6" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Monte Carlo
          </NavLink>

          <div className="sidebar-spacer"></div>
          <div className="sidebar-footer">
            <div className="plan-version">v1.0 · <span>— Health Score</span></div>
          </div>
        </div>

        <div className="content">
          <LiveMetricsBar />
          <Outlet />
        </div>
      </div>
    </>
  );
}
