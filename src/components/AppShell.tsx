import { NavLink, Outlet } from 'react-router-dom';

export default function AppShell() {
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
          <div className="client-badge">
            <div className="avatar">SP</div>
            <div className="client-name">My Retirement Plan</div>
          </div>
          <button className="save-btn">Save Plan</button>
        </div>
      </div>

      <div className="app-shell">
        <div className="sidebar">
          <div className="sidebar-section-label">Overview</div>
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8"/>
            </svg>
            Dashboard
          </NavLink>
          <NavLink to="/plan-health" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 20l-7-7a4 4 0 1 1 5.66-5.66l1.34 1.34 1.34-1.34A4 4 0 1 1 19 13l-7 7z" strokeWidth="1.8"/>
            </svg>
            Plan Health
          </NavLink>

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

          <div className="sidebar-section-label">Analysis</div>
          <NavLink to="/projections" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2c2.76 0 5.26 1.12 7.07 2.93M22 2l-3.5 3.5M16 2h6v6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Projections
          </NavLink>
          <NavLink to="/withdrawal" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeWidth="1.8"/>
            </svg>
            Withdrawal Strategy
          </NavLink>
          <NavLink to="/roth" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Roth Conversions
          </NavLink>

          <div className="sidebar-section-label">Tax &amp; Risk</div>
          <NavLink to="/taxes" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.8"/>
              <path d="M9 14l2 2 4-5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Tax Planning
          </NavLink>
          <NavLink to="/irmaa" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            IRMAA Analysis
          </NavLink>
          <NavLink to="/montecarlo" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M18 20V10M12 20V4M6 20v-6" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Monte Carlo
          </NavLink>
          <NavLink to="/scenarios" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <svg className="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16M9 3v18M15 3v18" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Scenarios
          </NavLink>

          <div className="sidebar-spacer"></div>
          <div className="sidebar-footer">
            <div className="plan-version">v1.0 · <span>— Health Score</span></div>
          </div>
        </div>

        <div className="content">
          <Outlet />
        </div>
      </div>
    </>
  );
}
