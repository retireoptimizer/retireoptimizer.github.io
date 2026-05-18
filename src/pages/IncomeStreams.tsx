import { usePlanStore } from '../store/usePlanStore';
import type { IncomeStream } from '../schemas/plan';

const headerStyle = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px', color: 'var(--text-muted)' };

export default function IncomeStreams() {
  const streams = usePlanStore((s) => s.plan.incomeStreams);
  const addIncomeStream = usePlanStore((s) => s.addIncomeStream);
  const updateIncomeStream = usePlanStore((s) => s.updateIncomeStream);
  const removeIncomeStream = usePlanStore((s) => s.removeIncomeStream);

  const handleAdd = () => {
    const newStream: IncomeStream = {
      id: `stream-${Date.now()}`,
      description: 'New Income Stream',
      whose: 'Household',
      type: 'Other',
      startAge: 65,
      stopAge: 90,
      annualAmount: 0,
      growthPct: 0.025,
      taxablePct: 1.0,
    };
    addIncomeStream(newStream);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Inputs</div>
            <div className="page-title">Income Streams</div>
            <div className="page-subtitle">Pensions, rental, wages, annuities · SS handled in Personal Details</div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Income Streams</div>
            <button className="btn btn-gold" style={{ padding: '7px 14px', fontSize: 12 }} onClick={handleAdd}>+ Add Stream</button>
          </div>
          <div className="panel-body" style={{ padding: '16px 24px' }}>
            <div className="stream-row income-row" style={{ padding: '6px 0', borderBottom: '2px solid var(--border-light)' }}>
              <div style={headerStyle}>Description</div>
              <div style={headerStyle}>Whose</div>
              <div style={headerStyle}>Type</div>
              <div style={headerStyle}>Start Age</div>
              <div style={headerStyle}>Stop Age</div>
              <div style={headerStyle}>Annual Amt</div>
              <div style={headerStyle}>Growth%</div>
              <div></div>
            </div>

            {streams.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No income streams yet — add SS via Personal Details, or click "+ Add Stream" to add wages/pension/rental.
              </div>
            )}

            {streams.map((s) => (
              <div key={s.id} className="stream-row income-row">
                <input type="text" value={s.description} style={{ fontSize: 13 }} onChange={(e) => updateIncomeStream(s.id, { description: e.target.value })} />
                <select value={s.whose} style={{ fontSize: 13 }} onChange={(e) => updateIncomeStream(s.id, { whose: e.target.value as IncomeStream['whose'] })}>
                  <option value="A">Person A</option>
                  <option value="B">Person B</option>
                  <option value="Household">Household</option>
                </select>
                <select value={s.type} style={{ fontSize: 13 }} onChange={(e) => updateIncomeStream(s.id, { type: e.target.value as IncomeStream['type'] })}>
                  <option value="SS">SS</option>
                  <option value="Pension">Pension</option>
                  <option value="Wages">Wages</option>
                  <option value="Rental">Rental</option>
                  <option value="Annuity">Annuity</option>
                  <option value="Other">Other</option>
                </select>
                <input type="number" value={s.startAge} style={{ fontSize: 13 }} onChange={(e) => updateIncomeStream(s.id, { startAge: parseInt(e.target.value) || 0 })} />
                <input type="number" value={s.stopAge} style={{ fontSize: 13 }} onChange={(e) => updateIncomeStream(s.id, { stopAge: parseInt(e.target.value) || 0 })} />
                <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" value={s.annualAmount} style={{ fontSize: 13, paddingLeft: 22 }} onChange={(e) => updateIncomeStream(s.id, { annualAmount: parseFloat(e.target.value) || 0 })} /></div>
                <div className="input-suffix-wrap"><input type="number" step="0.1" value={(s.growthPct * 100).toFixed(1)} style={{ fontSize: 13 }} onChange={(e) => updateIncomeStream(s.id, { growthPct: (parseFloat(e.target.value) || 0) / 100 })} /><span className="input-suffix">%</span></div>
                <button className="remove-btn" onClick={() => removeIncomeStream(s.id)}>×</button>
              </div>
            ))}

            <button className="add-row-btn" onClick={handleAdd}>+ Add income stream</button>
          </div>
        </div>
      </div>
    </div>
  );
}
