import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell';
import InputsPage from './pages/InputsPage';
import Dashboard from './pages/Dashboard';
import Projections from './pages/Projections';
import TaxPlanning from './pages/TaxPlanning';
import MonteCarlo from './pages/MonteCarlo';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/inputs" replace />} />
          <Route path="inputs" element={<InputsPage />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="projections" element={<Projections />} />
          <Route path="taxes" element={<TaxPlanning />} />
          <Route path="montecarlo" element={<MonteCarlo />} />
          {/* Legacy URL redirects */}
          <Route path="personal" element={<Navigate to="/inputs" replace />} />
          <Route path="cash-flow" element={<Navigate to="/inputs" replace />} />
          <Route path="portfolio" element={<Navigate to="/inputs" replace />} />
          <Route path="strategy" element={<Navigate to="/inputs" replace />} />
          <Route path="income" element={<Navigate to="/inputs" replace />} />
          <Route path="expenses" element={<Navigate to="/inputs" replace />} />
          <Route path="scenarios" element={<Navigate to="/dashboard" replace />} />
          <Route path="compare" element={<Navigate to="/dashboard" replace />} />
          <Route path="withdrawal" element={<Navigate to="/inputs" replace />} />
          <Route path="roth" element={<Navigate to="/inputs" replace />} />
          <Route path="plan-health" element={<Navigate to="/dashboard" replace />} />
          <Route path="irmaa" element={<Navigate to="/taxes" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
