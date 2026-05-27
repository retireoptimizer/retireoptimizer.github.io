import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import PersonalDetails from './pages/PersonalDetails';
import IncomeStreams from './pages/IncomeStreams';
import Expenses from './pages/Expenses';
import Portfolio from './pages/Portfolio';
import Projections from './pages/Projections';
import Strategy from './pages/Strategy';
import TaxPlanning from './pages/TaxPlanning';
import MonteCarlo from './pages/MonteCarlo';
import Scenarios from './pages/Scenarios';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="personal" element={<PersonalDetails />} />
          <Route path="income" element={<IncomeStreams />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="projections" element={<Projections />} />
          <Route path="strategy" element={<Strategy />} />
          <Route path="taxes" element={<TaxPlanning />} />
          <Route path="montecarlo" element={<MonteCarlo />} />
          <Route path="scenarios" element={<Scenarios />} />
          {/* Legacy URL redirects */}
          <Route path="withdrawal" element={<Navigate to="/strategy" replace />} />
          <Route path="roth" element={<Navigate to="/strategy" replace />} />
          <Route path="plan-health" element={<Navigate to="/" replace />} />
          <Route path="irmaa" element={<Navigate to="/taxes?tab=irmaa" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
