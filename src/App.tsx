import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import PersonalDetails from './pages/PersonalDetails';
import CashFlow from './pages/CashFlow';
import Portfolio from './pages/Portfolio';
import Projections from './pages/Projections';
import Strategy from './pages/Strategy';
import TaxPlanning from './pages/TaxPlanning';
import MonteCarlo from './pages/MonteCarlo';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          {/* First load lands on Personal Details, not the Dashboard. */}
          <Route index element={<Navigate to="/personal" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="personal" element={<PersonalDetails />} />
          <Route path="cash-flow" element={<CashFlow />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="projections" element={<Projections />} />
          <Route path="strategy" element={<Strategy />} />
          <Route path="taxes" element={<TaxPlanning />} />
          <Route path="montecarlo" element={<MonteCarlo />} />
          {/* Legacy URL redirects */}
          <Route path="income" element={<Navigate to="/cash-flow" replace />} />
          <Route path="expenses" element={<Navigate to="/cash-flow" replace />} />
          <Route path="scenarios" element={<Navigate to="/dashboard" replace />} />
          <Route path="compare" element={<Navigate to="/dashboard" replace />} />
          <Route path="withdrawal" element={<Navigate to="/strategy" replace />} />
          <Route path="roth" element={<Navigate to="/strategy" replace />} />
          <Route path="plan-health" element={<Navigate to="/dashboard" replace />} />
          <Route path="irmaa" element={<Navigate to="/taxes?tab=irmaa" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
