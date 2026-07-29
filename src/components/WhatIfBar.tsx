import { usePlanStore } from '../store/usePlanStore';
import { useWhatIfStore } from '../store/useWhatIfStore';
import type { DeepPartial } from '../engine/scenario';
import type { Plan } from '../schemas/plan';

/** Ephemeral what-if controls — a single inline bar: 4 sliders + Reset +
 *  Save-as-scenario all on one line. Sliders overlay the saved plan and trigger
 *  a fresh projection on every change; the saved plan is never mutated. Moving
 *  any slider implicitly activates the overlay (see useWhatIfStore.setOverride). */
export default function WhatIfBar() {
  const plan = usePlanStore((s) => s.plan);
  const addScenario = usePlanStore((s) => s.addScenario);
  const active = useWhatIfStore((s) => s.active);
  const overrides = useWhatIfStore((s) => s.overrides);
  const setOverride = useWhatIfStore((s) => s.setOverride);
  const reset = useWhatIfStore((s) => s.reset);

  // Live values fall back to the saved plan when not overridden.
  const retireA = overrides.retirementAgeA ?? plan.personA.retirementAge;
  const retireB = overrides.retirementAgeB ?? plan.personB?.retirementAge ?? 0;
  // Use tradReturn as the representative rate for the single what-if slider.
  const returnRate = overrides.returnRate ?? plan.assumptions.tradReturn;
  const inflation = overrides.inflation ?? plan.assumptions.inflation;
  // Default to solvedSpendingMultiplier so slider reflects the optimizer result (e.g. 133%)
  // rather than always starting at 100% after a max-spending run.
  const spendMult = overrides.spendingMultiplier ?? plan.solvedSpendingMultiplier ?? 1;
  const spendIsOverridden = overrides.spendingMultiplier !== undefined &&
    (overrides.spendingMultiplier !== 1 || !!plan.baseExpenseStreams);

  const dirty = active && (
    overrides.retirementAgeA !== undefined ||
    overrides.retirementAgeB !== undefined ||
    overrides.returnRate !== undefined ||
    overrides.inflation !== undefined ||
    spendIsOverridden
  );

  const saveAsScenario = () => {
    const id = `scn-${Date.now()}`;
    const planOverrides: DeepPartial<Plan> = {};
    if (overrides.retirementAgeA !== undefined) {
      planOverrides.personA = { retirementAge: overrides.retirementAgeA };
    }
    if (overrides.retirementAgeB !== undefined && plan.personB) {
      planOverrides.personB = { retirementAge: overrides.retirementAgeB };
    }
    if (overrides.returnRate !== undefined || overrides.inflation !== undefined) {
      planOverrides.assumptions = {
        ...(overrides.returnRate !== undefined ? { taxableReturn: overrides.returnRate, tradReturn: overrides.returnRate, rothReturn: overrides.returnRate } : {}),
        ...(overrides.inflation !== undefined ? { inflation: overrides.inflation } : {}),
      };
    }
    if (overrides.spendingMultiplier !== undefined && overrides.spendingMultiplier !== 1) {
      // Spending multiplier isn't a single Plan field — snapshot current expenses
      // with the multiplier baked in. mergeOverrides replaces arrays wholesale.
      planOverrides.expenseStreams = plan.expenseStreams.map((s) => ({
        ...s,
        annualAmount: s.annualAmount * overrides.spendingMultiplier!,
      }));
    }
    const labelParts: string[] = [];
    if (overrides.retirementAgeA !== undefined) labelParts.push(`${plan.personA.name} retire @${overrides.retirementAgeA}`);
    if (overrides.retirementAgeB !== undefined && plan.personB) labelParts.push(`${plan.personB.name} retire @${overrides.retirementAgeB}`);
    if (overrides.returnRate !== undefined) labelParts.push(`${(overrides.returnRate * 100).toFixed(1)}% return`);
    if (overrides.inflation !== undefined) labelParts.push(`${(overrides.inflation * 100).toFixed(1)}% infl`);
    if (overrides.spendingMultiplier !== undefined && overrides.spendingMultiplier !== 1) labelParts.push(`spend ${Math.round(overrides.spendingMultiplier * 100)}%`);
    addScenario({
      id,
      name: labelParts.length > 0 ? `What-if · ${labelParts.join(' · ')}` : 'What-if · ' + new Date().toLocaleString('en-US', { month: 'short', day: 'numeric' }),
      overrides: planOverrides,
      createdAt: new Date().toISOString(),
    });
  };

  return (
    <div style={{
      background: dirty ? 'linear-gradient(135deg, rgba(184,98,10,0.06), rgba(184,98,10,0.01))' : 'rgba(13,27,46,0.02)',
      border: dirty ? '1px solid rgba(184,98,10,0.35)' : '1px solid var(--border-light)',
      borderRadius: 12,
      marginBottom: 16,
      padding: '10px 14px 12px',
    }}>
      {/* Header line: label + actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: dirty ? 'var(--warning)' : 'var(--text-secondary)' }}>
          What-if{dirty && ' · Active'}
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
            live overlay · saved plan unchanged
          </span>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={reset}
            disabled={!dirty}
            style={{ fontSize: 12, padding: '6px 12px', opacity: dirty ? 1 : 0.4 }}
          >
            Reset
          </button>
          <button
            className="btn btn-gold"
            onClick={saveAsScenario}
            disabled={!dirty}
            style={{ fontSize: 12, padding: '6px 12px', opacity: dirty ? 1 : 0.4, whiteSpace: 'nowrap' }}
          >
            Save as scenario
          </button>
        </div>
      </div>

      {/* Boxed sliders — wrap into 1–2 rows; each cell is self-contained so labels
          and values never blur into the neighboring control. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <Slider
          label={`${plan.personA.name} retire age`}
          value={retireA}
          min={45}
          max={75}
          step={1}
          format={(v) => `age ${v}`}
          onChange={(v) => setOverride('retirementAgeA', v)}
          isOverridden={overrides.retirementAgeA !== undefined}
        />
        {plan.personB && (
          <Slider
            label={`${plan.personB.name} retire age`}
            value={retireB}
            min={45}
            max={75}
            step={1}
            format={(v) => `age ${v}`}
            onChange={(v) => setOverride('retirementAgeB', v)}
            isOverridden={overrides.retirementAgeB !== undefined}
          />
        )}
        <Slider
          label="Portfolio return"
          value={returnRate * 100}
          min={0}
          max={12}
          step={0.1}
          format={(v) => `${v.toFixed(1)}%`}
          onChange={(v) => setOverride('returnRate', v / 100)}
          isOverridden={overrides.returnRate !== undefined}
        />
        <Slider
          label="Inflation"
          value={inflation * 100}
          min={0}
          max={6}
          step={0.1}
          format={(v) => `${v.toFixed(1)}%`}
          onChange={(v) => setOverride('inflation', v / 100)}
          isOverridden={overrides.inflation !== undefined}
        />
        <Slider
          label="Spending"
          value={spendMult * 100}
          min={50}
          max={200}
          step={5}
          format={(v) => `${v.toFixed(0)}%`}
          onChange={(v) => setOverride('spendingMultiplier', v / 100)}
          isOverridden={spendIsOverridden}
        />
      </div>
    </div>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  isOverridden: boolean;
}

function Slider({ label, value, min, max, step, format, onChange, isOverridden }: SliderProps) {
  return (
    <div style={{
      background: 'var(--white)',
      border: `1px solid ${isOverridden ? 'var(--warning)' : 'var(--border-light)'}`,
      borderRadius: 8,
      padding: '7px 11px 9px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: isOverridden ? 'var(--warning)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          {format(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: isOverridden ? 'var(--warning)' : 'var(--gold)', display: 'block' }}
        aria-label={label}
      />
    </div>
  );
}
