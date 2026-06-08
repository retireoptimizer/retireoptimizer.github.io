import { usePlanStore } from '../../store/usePlanStore';
import { NumberInput } from '../inputs/NumberInput';

/** Per-window withdrawal-blend editor (advanced). Extracted from the pre-refactor
 *  Strategy page; now lives inside the Dashboard "Customize" side sheet. */
export default function CustomBlendPanel() {
  const plan = usePlanStore((s) => s.plan);
  const setCustomPolicy = usePlanStore((s) => s.setCustomPolicy);
  const clearCustomPolicy = usePlanStore((s) => s.clearCustomPolicy);
  const policy = plan.customPolicy;
  const retireAge = plan.personA.retirementAge;
  const planToAge = plan.personA.planToAge;

  const windows = policy?.windows ?? [{
    fromAge: retireAge, toAge: planToAge, pctTaxable: 1, pctTraditional: 0, pctRoth: 0,
  }];

  const commit = (next: typeof windows) => {
    setCustomPolicy({ windows: next, source: 'manual' });
  };

  const updateWindow = (idx: number, patch: Partial<typeof windows[number]>) => {
    commit(windows.map((w, i) => i === idx ? { ...w, ...patch } : w));
  };
  const addWindow = () => {
    const last = windows[windows.length - 1];
    if (last.toAge >= planToAge) return;
    const newFrom = last.toAge + 1;
    const next = [...windows, { fromAge: newFrom, toAge: planToAge, pctTaxable: 1, pctTraditional: 0, pctRoth: 0 }];
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
          <button className="btn btn-gold" onClick={addWindow} disabled={windows[windows.length - 1].toAge >= planToAge} style={{ fontSize: 12, padding: '6px 12px' }}>+ Add Window</button>
        </div>
      </div>
      <div className="panel-body" style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
          Define age windows with custom withdrawal percentages (must sum to 100%) and an optional yearly Roth conversion (today's $).
          When a window has a conversion amount &gt; 0, it overrides the Roth Conversion Mode setting above.
        </div>
        <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ width: 80 }}>From Age</th>
              <th style={{ width: 80 }}>To Age</th>
              <th style={{ textAlign: 'right' }}>% Taxable</th>
              <th style={{ textAlign: 'right' }}>% Pre-tax</th>
              <th style={{ textAlign: 'right' }}>% Roth</th>
              <th style={{ textAlign: 'right', width: 70 }}>Sum</th>
              <th style={{ width: 110 }}>Trad Cap ($)</th>
              <th style={{ width: 130 }}>Conv $/yr (today's $)</th>
              <th style={{ width: 110 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {windows.map((w, idx) => {
              const sum = w.pctTaxable + w.pctTraditional + w.pctRoth;
              const sumOk = Math.abs(sum - 1) < 0.01;
              return (
                <tr key={idx}>
                  <td><NumberInput value={w.fromAge} digits={0} min={retireAge} max={planToAge} onCommit={(v) => updateWindow(idx, { fromAge: Math.round(v) })} /></td>
                  <td><NumberInput value={w.toAge} digits={0} min={retireAge} max={planToAge} onCommit={(v) => updateWindow(idx, { toAge: Math.round(v) })} /></td>
                  <td><NumberInput value={w.pctTaxable} scale={100} digits={1} min={0} max={1} onCommit={(v) => updateWindow(idx, { pctTaxable: v })} /></td>
                  <td><NumberInput value={w.pctTraditional} scale={100} digits={1} min={0} max={1} onCommit={(v) => updateWindow(idx, { pctTraditional: v })} /></td>
                  <td><NumberInput value={w.pctRoth} scale={100} digits={1} min={0} max={1} onCommit={(v) => updateWindow(idx, { pctRoth: v })} /></td>
                  <td style={{ textAlign: 'right', fontFamily: "'DM Mono', monospace", color: sumOk ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {Math.round(sum * 100)}%
                  </td>
                  <td><NumberInput value={w.tradCap ?? 0} min={0} onCommit={(v) => updateWindow(idx, { tradCap: v > 0 ? v : undefined })} /></td>
                  <td><NumberInput value={w.convAmt ?? 0} min={0} onCommit={(v) => updateWindow(idx, { convAmt: v > 0 ? v : undefined })} /></td>
                  <td>
                    {!sumOk && <button className="btn btn-outline" onClick={() => normalizeRow(idx)} style={{ fontSize: 11, padding: '4px 8px', marginRight: 4 }}>Normalize</button>}
                    {windows.length > 1 && <button className="btn btn-outline" onClick={() => removeWindow(idx)} style={{ fontSize: 11, padding: '4px 8px', color: 'var(--danger)' }}>✕</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isValid && (
          <div style={{ marginTop: 12, padding: 10, background: 'var(--warning-light)', color: 'var(--warning)', borderRadius: 8, fontSize: 12 }}>
            ⚠ One or more windows do not sum to 100%. Click <strong>Normalize</strong> to auto-fix.
          </div>
        )}
        <div style={{ marginTop: 16, padding: 12, background: 'rgba(13,27,46,0.03)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Changes apply <strong>live</strong> to the projection. Want a starting point? Go to <strong>Set Goals</strong>, pick a goal, then <strong>Apply</strong> the result.
        </div>
      </div>
    </div>
  );
}
