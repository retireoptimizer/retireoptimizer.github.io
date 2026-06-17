import { usePlanStore } from '../store/usePlanStore';
import type { IncomeStream, ExpenseStream } from '../schemas/plan';
import { NumberInput } from '../components/inputs/NumberInput';
import { INCOME_TEMPLATES, EXPENSE_TEMPLATES } from '../engine/streamTemplates';

const headerStyle = { fontSize: 12, fontWeight: 700, letterSpacing: '0.3px', color: 'var(--text-secondary)' };

export default function CashFlow() {
  const incomeStreams = usePlanStore((s) => s.plan.incomeStreams);
  const expenseStreams = usePlanStore((s) => s.plan.expenseStreams);
  const nameA = usePlanStore((s) => s.plan.personA.name);
  const nameB = usePlanStore((s) => s.plan.personB?.name) ?? 'Person B';
  const retirementAge = usePlanStore((s) => s.plan.personA.retirementAge);
  const planToAge = usePlanStore((s) => s.plan.personA.planToAge);
  const addIncomeStream = usePlanStore((s) => s.addIncomeStream);
  const updateIncomeStream = usePlanStore((s) => s.updateIncomeStream);
  const removeIncomeStream = usePlanStore((s) => s.removeIncomeStream);
  const addExpenseStream = usePlanStore((s) => s.addExpenseStream);
  const updateExpenseStream = usePlanStore((s) => s.updateExpenseStream);
  const removeExpenseStream = usePlanStore((s) => s.removeExpenseStream);

  const addIncomeFromTemplate = (tplId: string) => {
    const tpl = INCOME_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    addIncomeStream(tpl.make({ retirementAge, planToAge }));
  };

  const addExpenseFromTemplate = (tplId: string) => {
    const tpl = EXPENSE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    addExpenseStream(tpl.make({ retirementAge, planToAge }));
  };

  return (
    <div className="page">
      <div className="page-body">
        {/* ── Income ───────────────────────────── */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header">
            <div className="form-section-title" style={{ marginBottom: 0 }}>
              <div className="section-number">1</div>Income Streams
            </div>
          </div>
          <div className="panel-body" style={{ padding: '14px 18px' }}>
            <div className="stream-row income-row" style={{ padding: '6px 0', borderBottom: '2px solid var(--border-light)' }}>
              <div style={headerStyle}>Description</div>
              <div style={headerStyle}>Whose</div>
              <div style={headerStyle}>Type</div>
              <div style={headerStyle}>Start age</div>
              <div style={headerStyle}>Stop age</div>
              <div style={headerStyle}>Annual amt</div>
              <div style={headerStyle}>Growth %</div>
              <div></div>
            </div>

            {incomeStreams.length === 0 && (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No income streams yet — add SS via Personal Details, or click "+ Add Stream" to add wages/pension/rental.
              </div>
            )}

            {incomeStreams.map((s) => (
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

            <button className="add-row-btn" onClick={() => addIncomeFromTemplate('blank')}>+ Add income stream</button>
          </div>
        </div>

        {/* ── Expenses ─────────────────────────── */}
        <div className="panel">
          <div className="panel-header">
            <div className="form-section-title" style={{ marginBottom: 0 }}>
              <div className="section-number">2</div>Expenses
            </div>
          </div>
          <div className="panel-body" style={{ padding: '14px 18px' }}>
            <div className="stream-row expense-row" style={{ padding: '6px 0', borderBottom: '2px solid var(--border-light)' }}>
              <div style={headerStyle}>Description</div>
              <div style={headerStyle}>Whose</div>
              <div style={headerStyle}>Start age</div>
              <div style={headerStyle}>Stop age</div>
              <div style={headerStyle}>Annual amt</div>
              <div style={headerStyle}>Infl %</div>
              <div></div>
            </div>

            {expenseStreams.map((s) => (
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

            <button className="add-row-btn" onClick={() => addExpenseFromTemplate('blank')}>+ Add expense category</button>
          </div>
        </div>
      </div>
    </div>
  );
}
