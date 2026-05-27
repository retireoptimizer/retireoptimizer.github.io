import { usePlanStore } from '../store/usePlanStore';
import type { IncomeStream } from '../schemas/plan';
import { NumberInput } from '../components/inputs/NumberInput';

const headerStyle = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px', color: 'var(--text-muted)' };

export default function IncomeStreams() {
  const streams = usePlanStore((s) => s.plan.incomeStreams);
  const nameA = usePlanStore((s) => s.plan.personA.name);
  const nameB = usePlanStore((s) => s.plan.personB?.name) ?? 'Person B';
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
                  <option value="A">{nameA}</option>
                  <option value="B">{nameB}</option>
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
                <NumberInput value={s.startAge} digits={0} min={0} max={110} style={{ fontSize: 13 }} onCommit={(v) => updateIncomeStream(s.id, { startAge: Math.round(v) })} />
                <NumberInput value={s.stopAge} digits={0} min={0} max={115} style={{ fontSize: 13 }} onCommit={(v) => updateIncomeStream(s.id, { stopAge: Math.round(v) })} />
                <div className="input-prefix-wrap"><span className="input-prefix">$</span>
                  <NumberInput value={s.annualAmount} min={0} style={{ fontSize: 13, paddingLeft: 22 }} onCommit={(v) => updateIncomeStream(s.id, { annualAmount: v })} />
                </div>
                <div className="input-suffix-wrap">
                  <NumberInput value={s.growthPct} scale={100} digits={1} style={{ fontSize: 13 }} onCommit={(v) => updateIncomeStream(s.id, { growthPct: v })} />
                  <span className="input-suffix">%</span>
                </div>
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
