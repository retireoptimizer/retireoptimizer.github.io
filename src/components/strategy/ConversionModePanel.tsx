import { usePlanStore } from '../../store/usePlanStore';
import type { ConversionParams } from '../../schemas/plan';
import { NumberInput } from '../inputs/NumberInput';
import { fmtUSD } from '../../lib/format';
import { rmdStartAgeForDob } from '../../engine/rmd';
import { FED_BRACKETS_MFJ, FED_BRACKETS_SINGLE } from '../../engine/taxConstants';

/** 4-mode Roth conversion UI (Off / Fixed Amount / Bracket-Fill / Manual schedule).
 *  Extracted from the pre-refactor Strategy page so it can live inside the
 *  Dashboard "Customize" side sheet. Reads + writes plan.conversion via the store. */

const CONV_MODES: Array<{ value: ConversionParams['mode']; title: string; description: string }> = [
  { value: 'off', title: 'No Conversions', description: 'Baseline — no Roth conversions performed.' },
  { value: 'auto-window', title: 'Fixed Amount', description: 'Convert a fixed $ amount each year in a window (today\'s $). Engine inflates.' },
  { value: 'bracket-fill', title: 'Bracket Fill', description: 'Auto-convert to fill the chosen tax bracket each year. IRMAA-aware.' },
  { value: 'manual', title: 'Manual Schedule', description: 'Per-year custom amounts in today\'s $. Matches Excel exactly.' },
];

export default function ConversionModePanel() {
  const plan = usePlanStore((s) => s.plan);
  const setConversion = usePlanStore((s) => s.setConversion);

  const brackets = plan.personB ? FED_BRACKETS_MFJ : FED_BRACKETS_SINGLE;
  const convBracketOptions = brackets.slice(0, 4)
    .filter(([top]) => top <= plan.withdrawalBracketCeiling)
    .map(([top, rate]) => ({
      value: top,
      label: `Top of ${Math.round(rate * 100)}% bracket ($${top.toLocaleString()})`,
    }));
  const conv = plan.conversion;

  const startAgeA = new Date().getFullYear() - parseInt(plan.personA.dob.slice(0, 4), 10);
  const manualAges: number[] = [];
  for (let age = Math.max(startAgeA, plan.personA.retirementAge - 5); age <= rmdStartAgeForDob(plan.personA.dob); age++) manualAges.push(age);

  const setManualForAge = (age: number, value: number) => {
    setConversion({ manualSchedule: { ...conv.manualSchedule, [String(age)]: value } });
  };
  const clearManual = () => setConversion({ manualSchedule: {} });
  const presetManual70K = () => {
    const sched: Record<string, number> = {};
    for (let age = conv.startAge; age <= conv.endAge; age++) sched[String(age)] = 70000;
    setConversion({ manualSchedule: sched });
  };
  const manualTotal = Object.values(conv.manualSchedule).reduce((s, v) => s + (v || 0), 0);

  return (
    <>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div className="panel-title"><div className="panel-title-dot"></div>Roth Conversion Mode</div>
        </div>
        <div className="panel-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {CONV_MODES.map((m) => {
              const active = conv.mode === m.value;
              return (
                <label key={m.value} style={{
                  display: 'flex', flexDirection: 'column', gap: 6, padding: 14, borderRadius: 10,
                  border: active ? '2px solid var(--gold)' : '1px solid var(--border-light)',
                  background: active ? 'rgba(201,168,76,0.04)' : 'transparent',
                  cursor: 'pointer',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="radio" name="roth-mode" checked={active} onChange={() => setConversion({ mode: m.value })}
                      style={{ accentColor: 'var(--gold)' }} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{m.title}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{m.description}</div>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {conv.mode === 'auto-window' && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Fixed Amount Settings</div></div>
          <div className="panel-body" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Annual Amount (today's $)</label>
                <NumberInput value={conv.autoAmount} min={0} onCommit={(v) => setConversion({ autoAmount: v })} />
              </div>
              <div className="form-group">
                <label>Start Age ({plan.personA.name})</label>
                <NumberInput value={conv.startAge} digits={0} min={50} max={75} onCommit={(v) => setConversion({ startAge: Math.round(v) })} />
              </div>
              <div className="form-group">
                <label>End Age ({plan.personA.name})</label>
                <NumberInput value={conv.endAge} digits={0} min={55} max={80} onCommit={(v) => setConversion({ endAge: Math.round(v) })} />
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
              Each year between {conv.startAge} and {conv.endAge}, convert {fmtUSD(conv.autoAmount)} (today's $) from pre-tax 401(k)/IRA to Roth, capped by the pre-tax balance.
            </div>
          </div>
        </div>
      )}

      {conv.mode === 'bracket-fill' && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Bracket Fill Settings</div></div>
          <div className="panel-body" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Target Bracket Ceiling</label>
                <select value={conv.bracketCeiling} onChange={(e) => setConversion({ bracketCeiling: parseInt(e.target.value, 10) })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: '#fff' }}>
                  {convBracketOptions.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Start Age</label>
                <NumberInput value={conv.startAge} digits={0} min={50} max={75} onCommit={(v) => setConversion({ startAge: Math.round(v) })} />
              </div>
              <div className="form-group">
                <label>End Age</label>
                <NumberInput value={conv.endAge} digits={0} min={55} max={80} onCommit={(v) => setConversion({ endAge: Math.round(v) })} />
              </div>
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Each year, fill the chosen bracket from current taxable income up to the ceiling. The 12% ceiling delivers the lowest lifetime tax for most plans.
            </div>
          </div>
        </div>
      )}

      {conv.mode === 'manual' && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Manual Conversion Schedule</div>
            <div className="panel-actions">
              <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px' }} onClick={clearManual}>Clear All</button>
              <button className="btn btn-outline" style={{ fontSize: 12, padding: '6px 12px' }} onClick={presetManual70K}>Preset: $70K × range</button>
            </div>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <div style={{ padding: '12px 18px', background: 'rgba(13,27,46,0.03)', fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>
              Enter conversion amounts <strong>in today's dollars</strong>. Engine inflates to nominal $.
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--cream)', zIndex: 2 }}>
                  <tr><th>Age</th><th>Conversion (Today's $)</th></tr>
                </thead>
                <tbody>
                  {manualAges.map((age) => (
                    <tr key={age}>
                      <td><strong>{age}</strong></td>
                      <td><NumberInput value={conv.manualSchedule[String(age)] ?? 0} min={0} onCommit={(v) => setManualForAge(age, v)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 18px', background: 'rgba(201,168,76,0.05)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: 'var(--text-secondary)' }}>Total scheduled conversions (today's $):</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{fmtUSD(manualTotal)}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
