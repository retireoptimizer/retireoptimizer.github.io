import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import PlanHealth from './pages/PlanHealth';
import PersonalDetails from './pages/PersonalDetails';
import IncomeStreams from './pages/IncomeStreams';
import Expenses from './pages/Expenses';
import Portfolio from './pages/Portfolio';
import Projections from './pages/Projections';
import WithdrawalStrategy from './pages/WithdrawalStrategy';
import RothConversions from './pages/RothConversions';
import TaxPlanning from './pages/TaxPlanning';
import IRMAAAnalysis from './pages/IRMAAAnalysis';
import MonteCarlo from './pages/MonteCarlo';
import Scenarios from './pages/Scenarios';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Dashboard />} />
          <Route path="plan-health" element={<PlanHealth />} />
          <Route path="personal" element={<PersonalDetails />} />
          <Route path="income" element={<IncomeStreams />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="projections" element={<Projections />} />
          <Route path="withdrawal" element={<WithdrawalStrategy />} />
          <Route path="roth" element={<RothConversions />} />
          <Route path="taxes" element={<TaxPlanning />} />
          <Route path="irmaa" element={<IRMAAAnalysis />} />
          <Route path="montecarlo" element={<MonteCarlo />} />
          <Route path="scenarios" element={<Scenarios />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
