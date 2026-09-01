import { usePlanStore } from '../../store/usePlanStore';
import { NumberInput } from '../inputs/NumberInput';
import { calendarYearAge } from '../../lib/ageUtils';

/** Per-window withdrawal-blend editor (advanced). Extracted from the pre-refactor
 *  Strategy page; now lives inside the Dashboard "Customize" side sheet. */
export default function CustomBlendPanel() {
  const plan = usePlanStore((s) => s.plan);
  const displayMode = usePlanStore((s) => s.displayMode);
  const setCustomPolicy = usePlanStore((s) => s.setCustomPolicy);
  const clearCustomPolicy = usePlanStore((s) => s.clearCustomPolicy);
  const policy = plan.customPolicy;
  const retireAge = plan.personA.retirementAge;
  const planThroughAge = plan.personA.planThroughAge;
  const isNominal = displayMode === 'nominal';
  const inflation = plan.assumptions.inflation;
  const currentAgeA = calendarYearAge(plan.personA.dob);
  const inflFactor = (age: number) => Math.pow(1 + inflation, Math.max(0, age - currentAgeA));
  const toDisplay = (real: number, age: number) => Math.round(isNominal ? real * inflFactor(age) : real);
  const fromDisplay = (display: number, age: number) => isNominal ? display / inflFactor(age) : display;
  const dollarLabel = isNominal ? 'nominal $' : "today's $";

  const windows = policy?.windows ?? [{
    fromAge: retireAge, toAge: planThroughAge, pctTaxable: 1, pctTraditional: 0, pctRoth: 0,
  }];

  const commit = (next: typeof windows) => {
    setCustomPolicy({ windows: next, source: 'manual' });
  };

  const updateWindow = (idx: number, patch: Partial<typeof windows[number]>) => {
    commit(windows.map((w, i) => i === idx ? { ...w, ...patch } : w));
  };
  const addWindow = () => {
    const last = windows[windows.length - 1];
    if (last.toAge >= planThroughAge) return;
    const newFrom = last.toAge + 1;
    const next = [...windows, { fromAge: newFrom, toAge: planThroughAge, pctTaxable: 1, pctTraditional: 0, pctRoth: 0 }];
    if (windows[windows.length - 1].toAge >= newFrom) {
      next[next.length - 2] = { ...windows[windows.length - 1], toAge: newFrom - 1 };
    }
    commit(next);
  };
  const removeWindow = (idx: number) => {
    if (windows.length === 1) return;
    commit(windows.filter((_, i) => i !== idx));
  };
  const normalizeRow = (idx: number) => {
    const w = windows[idx];
    const sum = w.pctTaxable + w.pctTraditional + w.pctRoth;
    if (sum === 0) return;
    updateWindow(idx, {
      pctTaxable: w.pctTaxable / sum,
      pctTraditional: w.pctTraditional / sum,
      pctRoth: w.pctRoth / sum,
    });
  };
  const isValid = windows.every((w) => Math.abs(w.pctTaxable + w.pctTraditional + w.pctRoth - 1) < 0.01);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title"><div className="panel-title-dot"></div>Custom Blend Editor</div>
        <div className="panel-actions">
          {policy && <button className="btn btn-outline" onClick={() => clearCustomPolicy()} style={{ fontSize: 12, padding: '6px 12px' }}>Clear &amp; Use Preset</button>}
          <button className="btn btn-gold" onClick={addWindow} disabled={windows[windows.length - 1].toAge >= planThroughAge} style={{ fontSize: 12, padding: '6px 12px' }}>+ Add Window</button>
        </div>
      </div>
      <div className="panel-body" style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
          Define age windows with custom withdrawal percentages (must sum to 100%) and an optional yearly Roth conversion ({dollarLabel}).
          When a window has a conversion amount &gt; 0, it overrides the Roth Conversion Mode setting above.
        </div>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: 88 }}>From Age</th>
              <th style={{ width: 88 }}>To Age</th>
              <th style={{ minWidth: 95 }}>% Taxable</th>
              <th style={{ minWidth: 95 }}>% Pre-tax</th>
              <th style={{ minWidth: 95 }}>% Roth</th>
              <th style={{ width: 120 }}>Trad Cap ({dollarLabel})</th>
              <th style={{ width: 130 }}>Conv $/yr ({dollarLabel})</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {windows.map((w, idx) => {
              const sum = w.pctTaxable + w.pctTraditional + w.pctRoth;
              const sumOk = Math.abs(sum - 1) < 0.01;
              const inp: React.CSSProperties = { width: '100%', padding: '8px 10px' };
              return (
                <tr key={idx}>
                  <td style={{ padding: '8px 10px' }}><NumberInput value={w.fromAge} digits={0} min={retireAge} max={planThroughAge} onCommit={(v) => updateWindow(idx, { fromAge: Math.round(v) })} style={inp} /></td>
                  <td style={{ padding: '8px 10px' }}><NumberInput value={w.toAge} digits={0} min={retireAge} max={planThroughAge} onCommit={(v) => updateWindow(idx, { toAge: Math.round(v) })} style={inp} /></td>
                  <td style={{ padding: '8px 10px' }}><NumberInput value={w.pctTaxable} scale={100} digits={1} min={0} max={1} onCommit={(v) => updateWindow(idx, { pctTaxable: v })} style={{ ...inp, outline: sumOk ? undefined : '2px solid var(--danger)', borderRadius: 6 }} /></td>
                  <td style={{ padding: '8px 10px' }}><NumberInput value={w.pctTraditional} scale={100} digits={1} min={0} max={1} onCommit={(v) => updateWindow(idx, { pctTraditional: v })} style={{ ...inp, outline: sumOk ? undefined : '2px solid var(--danger)', borderRadius: 6 }} /></td>
                  <td style={{ padding: '8px 10px' }}><NumberInput value={w.pctRoth} scale={100} digits={1} min={0} max={1} onCommit={(v) => updateWindow(idx, { pctRoth: v })} style={{ ...inp, outline: sumOk ? undefined : '2px solid var(--danger)', borderRadius: 6 }} /></td>
                  <td style={{ padding: '8px 10px' }}><NumberInput value={toDisplay(w.tradCap ?? 0, w.fromAge)} min={0} onCommit={(v) => updateWindow(idx, { tradCap: v > 0 ? fromDisplay(v, w.fromAge) : undefined })} style={inp} /></td>
                  <td style={{ padding: '8px 10px' }}><NumberInput value={toDisplay(w.convAmt ?? 0, w.fromAge)} digits={0} min={0} onCommit={(v) => updateWindow(idx, { convAmt: v > 0 ? Math.round(fromDisplay(v, w.fromAge)) : undefined })} style={inp} /></td>
                  <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                    {!sumOk
                      ? <button className="btn btn-outline" onClick={() => normalizeRow(idx)} style={{ fontSize: 11, padding: '4px 7px' }} title="Normalize to 100%">⟳</button>
                      : windows.length > 1
                        ? <button className="btn btn-outline" onClick={() => removeWindow(idx)} style={{ fontSize: 13, padding: '4px 8px', color: 'var(--danger)', lineHeight: 1 }}>✕</button>
                        : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
        {!isValid && (
          <div style={{ marginTop: 12, padding: 10, background: 'var(--warning-light)', color: 'var(--warning)', borderRadius: 8, fontSize: 12 }}>
            ⚠ One or more windows do not sum to 100%. Click <strong>⟳</strong> on that row to auto-fix.
          </div>
        )}
        <div style={{ marginTop: 16, padding: 12, background: 'rgba(13,27,46,0.03)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Changes apply <strong>live</strong> to the projection. Want a starting point? Go to <strong>Set Goals</strong>, pick a goal, then <strong>Apply</strong> the result.
        </div>
      </div>
    </div>
  );
}
