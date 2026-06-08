import { useState } from 'react';
import { usePlanStore } from '../store/usePlanStore';
import type { ExpenseStream } from '../schemas/plan';
import { fmtK } from '../lib/format';
import { NumberInput } from '../components/inputs/NumberInput';
import { EXPENSE_TEMPLATES } from '../engine/streamTemplates';

const headerStyle = { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '1px', color: 'var(--text-muted)' };

export default function Expenses() {
  const streams = usePlanStore((s) => s.plan.expenseStreams);
  const nameA = usePlanStore((s) => s.plan.personA.name);
  const nameB = usePlanStore((s) => s.plan.personB?.name) ?? 'Person B';
  const retirementAge = usePlanStore((s) => s.plan.personA.retirementAge);
  const planToAge = usePlanStore((s) => s.plan.personA.planToAge);
  const addExpenseStream = usePlanStore((s) => s.addExpenseStream);
  const updateExpenseStream = usePlanStore((s) => s.updateExpenseStream);
  const removeExpenseStream = usePlanStore((s) => s.removeExpenseStream);

  const [pickerOpen, setPickerOpen] = useState(false);

  const addFromTemplate = (tplId: string) => {
    const tpl = EXPENSE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    addExpenseStream(tpl.make({ retirementAge, planToAge }));
    setPickerOpen(false);
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
            <div style={{ position: 'relative' }}>
              <button className="btn btn-gold" style={{ padding: '7px 14px', fontSize: 12 }} onClick={() => setPickerOpen(!pickerOpen)}>
                + Add Category {pickerOpen ? '▴' : '▾'}
              </button>
              {pickerOpen && (
                <>
                  <div onClick={() => setPickerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: '#fff', border: '1px solid var(--border-light)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', padding: 6, zIndex: 20, minWidth: 260 }}>
                    {EXPENSE_TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => addFromTemplate(t.id)}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '8px 10px', background: 'transparent', border: 'none',
                          borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(201,168,76,0.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.hint}</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
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
                  <option value="A">{nameA}</option>
                  <option value="B">{nameB}</option>
                </select>
                <NumberInput value={s.startAge} digits={0} min={0} max={110} style={{ fontSize: 13 }} onCommit={(v) => updateExpenseStream(s.id, { startAge: Math.round(v) })} />
                <NumberInput value={s.stopAge} digits={0} min={0} max={115} style={{ fontSize: 13 }} onCommit={(v) => updateExpenseStream(s.id, { stopAge: Math.round(v) })} />
                <div className="input-prefix-wrap"><span className="input-prefix">$</span>
                  <NumberInput value={s.annualAmount} min={0} style={{ fontSize: 13, paddingLeft: 22 }} onCommit={(v) => updateExpenseStream(s.id, { annualAmount: v })} />
                </div>
                <div className="input-suffix-wrap">
                  <NumberInput value={s.inflationPct} scale={100} digits={1} style={{ fontSize: 13, paddingRight: 22 }} onCommit={(v) => updateExpenseStream(s.id, { inflationPct: v })} />
                  <span className="input-suffix">%</span>
                </div>
                <button className="remove-btn" onClick={() => removeExpenseStream(s.id)}>×</button>
              </div>
            ))}

            <button className="add-row-btn" onClick={() => addFromTemplate('blank')}>+ Add expense category</button>
          </div>
        </div>
      </div>
    </div>
  );
}
