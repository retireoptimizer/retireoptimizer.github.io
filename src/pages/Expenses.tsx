import { usePlanStore } from '../store/usePlanStore';
import type { ExpenseStream } from '../schemas/plan';
import { fmtK } from '../lib/format';

const headerStyle = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px', color: 'var(--text-muted)' };

export default function Expenses() {
  const streams = usePlanStore((s) => s.plan.expenseStreams);
  const addExpenseStream = usePlanStore((s) => s.addExpenseStream);
  const updateExpenseStream = usePlanStore((s) => s.updateExpenseStream);
  const removeExpenseStream = usePlanStore((s) => s.removeExpenseStream);

  const handleAdd = () => {
    const newStream: ExpenseStream = {
      id: `expense-${Date.now()}`,
      description: 'New Expense',
      whose: 'Household',
      startAge: 65,
      stopAge: 95,
      annualAmount: 0,
      inflationPct: 0.025,
    };
    addExpenseStream(newStream);
  };

  const totalYr1 = streams.reduce((sum, s) => sum + s.annualAmount, 0);
  const healthcare = streams.find((s) => /health/i.test(s.description));
  const wavg = streams.reduce((sum, s) => sum + s.annualAmount * s.inflationPct, 0) / Math.max(1, totalYr1);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Inputs</div>
            <div className="page-title">Expenses</div>
            <div className="page-subtitle">Spending categories with per-row inflation rates</div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
          <div className="metric-card">
            <div className="metric-label">Total Annual Expenses (Year 1)</div>
            <div className="metric-value">{fmtK(totalYr1)}</div>
            <div className="metric-sub">At retirement start</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Healthcare Inflation Exposure</div>
            <div className="metric-value">{fmtK(healthcare?.annualAmount ?? 0)}</div>
            <div className="metric-sub">{healthcare ? `+${(healthcare.inflationPct * 100).toFixed(1)}%/yr projected` : '— no healthcare line'}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Weighted Inflation</div>
            <div className="metric-value">{(wavg * 100).toFixed(1)}<span className="metric-unit">%</span></div>
            <div className="metric-sub">Across all expense lines</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Expense Streams</div>
            <button className="btn btn-gold" style={{ padding: '7px 14px', fontSize: 12 }} onClick={handleAdd}>+ Add Category</button>
          </div>
          <div className="panel-body" style={{ padding: '16px 24px' }}>
            <div className="stream-row expense-row" style={{ padding: '6px 0', borderBottom: '2px solid var(--border-light)' }}>
              <div style={headerStyle}>Description</div>
              <div style={headerStyle}>Whose</div>
              <div style={headerStyle}>Start Age</div>
              <div style={headerStyle}>Stop Age</div>
              <div style={headerStyle}>Annual Amt</div>
              <div style={headerStyle}>Infl %</div>
              <div></div>
            </div>

            {streams.map((s) => (
              <div key={s.id} className="stream-row expense-row">
                <input type="text" value={s.description} style={{ fontSize: 13 }} onChange={(e) => updateExpenseStream(s.id, { description: e.target.value })} />
                <select value={s.whose} style={{ fontSize: 13 }} onChange={(e) => updateExpenseStream(s.id, { whose: e.target.value as ExpenseStream['whose'] })}>
                  <option value="Household">Household</option>
                  <option value="A">Person A</option>
                  <option value="B">Person B</option>
                </select>
                <input type="number" value={s.startAge} style={{ fontSize: 13 }} onChange={(e) => updateExpenseStream(s.id, { startAge: parseInt(e.target.value) || 0 })} />
                <input type="number" value={s.stopAge} style={{ fontSize: 13 }} onChange={(e) => updateExpenseStream(s.id, { stopAge: parseInt(e.target.value) || 0 })} />
                <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" value={s.annualAmount} style={{ fontSize: 13, paddingLeft: 22 }} onChange={(e) => updateExpenseStream(s.id, { annualAmount: parseFloat(e.target.value) || 0 })} /></div>
                <div className="input-suffix-wrap"><input type="number" step="0.1" value={(s.inflationPct * 100).toFixed(1)} style={{ fontSize: 13 }} onChange={(e) => updateExpenseStream(s.id, { inflationPct: (parseFloat(e.target.value) || 0) / 100 })} /><span className="input-suffix">%</span></div>
                <button className="remove-btn" onClick={() => removeExpenseStream(s.id)}>×</button>
              </div>
            ))}

            <button className="add-row-btn" onClick={handleAdd}>+ Add expense category</button>
          </div>
        </div>
      </div>
    </div>
  );
}
