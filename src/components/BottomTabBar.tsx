import { NavLink, useLocation } from 'react-router-dom';

const RESULT_ROUTES = ['/dashboard', '/projections', '/taxes', '/montecarlo'];

const TABS = [
  {
    to: '/inputs',
    label: 'Inputs',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="1.8"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="1.8"/>
      </svg>
    ),
  },
  {
    to: '/projections',
    label: 'Project',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2c2.76 0 5.26 1.12 7.07 2.93M22 2l-3.5 3.5M16 2h6v6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    to: '/taxes',
    label: 'Taxes',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.8"/>
        <path d="M9 14l2 2 4-5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    to: '/montecarlo',
    label: 'Simulate',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M18 20V10M12 20V4M6 20v-6" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function BottomTabBar() {
  const location = useLocation();
  const onResultsTab = RESULT_ROUTES.some((r) => location.pathname.startsWith(r));

  return (
    <nav className="bottom-tab-bar" aria-label="Main navigation">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) => {
            // "Inputs" tab is active when NOT on a results route
            if (t.to === '/inputs') return (!onResultsTab || isActive) ? 'bottom-tab-item active' : 'bottom-tab-item';
            return isActive ? 'bottom-tab-item active' : 'bottom-tab-item';
          }}
        >
          {t.icon}
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
