import { usePlanStore } from '../../store/usePlanStore';
import { NumberInput } from '../inputs/NumberInput';
import { fmtUSD } from '../../lib/format';
import { FED_BRACKETS_MFJ, FED_BRACKETS_SINGLE } from '../../engine/taxConstants';
import { firstRetirementAgeA, householdPlanThroughAgeA } from '../../engine/streamWindow';
import { preRetirementConversionAges } from '../../engine/planWarnings';

/** Data-entry detail for the active Roth conversion mode, shown inside the Dashboard side sheet.
 *  Mode SELECTION lives inline as pills in StrategyChooser; this renders only the fields the chosen
 *  mode needs — Fixed Amount (amount + window), Bracket-Fill (ceiling + window), Manual (per-year table).
 *  For 'off' there's nothing to enter. Store-driven. */
export default function ConversionDetail() {
  const plan = usePlanStore((s) => s.plan);
  const displayMode = usePlanStore((s) => s.displayMode);
  const setConversion = usePlanStore((s) => s.setConversion);
  const conv = plan.conversion;

  const brackets = plan.personB ? FED_BRACKETS_MFJ : FED_BRACKETS_SINGLE;
  const convBracketOptions = brackets.slice(0, 5)
    .filter(([top]) => plan.withdrawalStrategy !== 'bracketfill' || top <= plan.withdrawalBracketCeiling)
    .map(([top, rate]) => ({
      value: top,
      label: `Top of ${Math.round(rate * 100)}% bracket ($${top.toLocaleString()})`,
    }));

  const startAgeA = new Date().getFullYear() - parseInt(plan.personA.dob.slice(0, 4), 10);
  const isNominal = displayMode === 'nominal';
  const inflation = plan.assumptions.inflation;
  const inflFactor = (age: number) => Math.pow(1 + inflation, Math.max(0, age - startAgeA));
  const toDisplay = (real: number, age: number) => Math.round(isNominal ? real * inflFactor(age) : real);
  const fromDisplay = (display: number, age: number) => isNominal ? display / inflFactor(age) : display;
  const dollarLabel = isNominal ? 'nominal $' : "today's $";
  const manualAges: number[] = [];
  const horizonA = householdPlanThroughAgeA(plan);
  for (let age = Math.max(startAgeA, plan.personA.retirementAge - 5); age <= horizonA; age++) manualAges.push(age);
  // Accumulation years are offered (pre-retirement conversions are a real strategy) but their tax
  // is understated — no wages are modeled, so the conversion is taxed as the only income.
  // Same "will this actually run" test the plan warning uses: nothing runs pre-retirement when
  // the optimizer owns conversions, so don't warn about a schedule that is inert.
  const firstRetA = firstRetirementAgeA(plan);
  const preRetScheduled = preRetirementConversionAges(plan);

  const setManualForAge = (age: number, displayValue: number) => {
    setConversion({ manualSchedule: { ...conv.manualSchedule, [String(age)]: fromDisplay(displayValue, age) } });
  };
  const clearManual = () => setConversion({ manualSchedule: {} });
const manualTotal = manualAges.reduce((s, age) => s + toDisplay(conv.manualSchedule[String(age)] ?? 0, age), 0);

  if (conv.mode === 'off') {
    return (
      <div className="panel">
        <div className="panel-body" style={{ padding: '16px 20px', fontSize: 13, color: 'var(--text-secondary)' }}>
          No conversions are scheduled. Choose <strong>Bracket-Fill</strong>, <strong>Fixed Amount</strong>, or <strong>Manual</strong> on the dashboard to configure a strategy.
        </div>
      </div>
    );
  }

  return (
    <>
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
                <NumberInput value={conv.endAge} digits={0} min={55} onCommit={(v) => setConversion({ endAge: Math.round(v) })} />
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
                <NumberInput value={conv.endAge} digits={0} min={55} onCommit={(v) => setConversion({ endAge: Math.round(v) })} />
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
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <div style={{ padding: '10px 18px', background: 'rgba(13,27,46,0.03)', fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span>Enter conversion amounts <strong>in {dollarLabel}</strong>.{isNominal ? '' : ' Engine inflates to nominal $.'}</span>
              <button className="btn btn-outline" style={{ fontSize: 11, padding: '4px 10px' }} onClick={clearManual}>Clear All</button>
            </div>
            {preRetScheduled.length > 0 && (
              <div style={{
                background: '#fff8e1', borderBottom: '1px solid #f59e0b',
                padding: '10px 18px', fontSize: 12.5, color: '#78350f', lineHeight: 1.6,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 15, lineHeight: '20px' }}>⚠</span>
                <div>
                  <strong>Tax on pre-retirement conversions is understated.</strong> The plan models no wage
                  income before retirement (age {firstRetA}) — only contributions — so a conversion at{' '}
                  {preRetScheduled.length === 1 ? `age ${preRetScheduled[0]}` : `ages ${preRetScheduled[0]}–${preRetScheduled[preRetScheduled.length - 1]}`}{' '}
                  is taxed as the household's only income, getting the full standard deduction and the
                  bottom brackets. Real cost is typically ~2× the figure shown. The tax is also paid by
                  liquidating the brokerage account.
                </div>
              </div>
            )}
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--cream)', zIndex: 2 }}>
                  <tr><th>Age</th><th>Conversion ({isNominal ? 'Nominal $' : "Today's $"})</th></tr>
                </thead>
                <tbody>
                  {manualAges.map((age) => (
                    <tr key={age}>
                      <td>
                        <strong>{age}</strong>
                        {age < firstRetA && (
                          <span title="Accumulation year — conversion tax is understated (no wages modeled)"
                            style={{ marginLeft: 6, fontSize: 10, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>
                            pre-ret
                          </span>
                        )}
                      </td>
                      <td><NumberInput value={toDisplay(conv.manualSchedule[String(age)] ?? 0, age)} min={0} onCommit={(v) => setManualForAge(age, v)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 18px', background: 'rgba(201,168,76,0.05)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: 'var(--text-secondary)' }}>Total scheduled conversions ({dollarLabel}):</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{fmtUSD(manualTotal)}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
