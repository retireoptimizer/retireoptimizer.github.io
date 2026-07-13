import { NavLink } from 'react-router-dom';

const TABS = [
  {
    to: '/personal',
    label: 'Plan',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4" strokeWidth="1.8"/>
        <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" strokeWidth="1.8"/>
      </svg>
    ),
  },
  {
    to: '/cash-flow',
    label: 'Cash',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M12 3v18M17 8H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H7" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    to: '/portfolio',
    label: 'Portfolio',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M21 21H3V3M21 9l-5 5-4-4-5 5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    to: '/strategy',
    label: 'Goals',
    icon: (
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeWidth="1.8"/>
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
  return (
    <nav className="bottom-tab-bar" aria-label="Main navigation">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) => isActive ? 'bottom-tab-item active' : 'bottom-tab-item'}
        >
          {t.icon}
          <span>{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
