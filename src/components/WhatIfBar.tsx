import { useState } from 'react';
import { usePlanStore } from '../store/usePlanStore';
import { useWhatIfStore } from '../store/useWhatIfStore';
import type { DeepPartial } from '../engine/scenario';
import type { Plan } from '../schemas/plan';

/** Ephemeral what-if controls. Sliders overlay the saved plan and trigger a
 *  fresh projection on every change — saved plan is never mutated. Collapsed
 *  by default; expand reveals 4 sliders + reset + save-as-scenario actions.
 *  Surfaces that lean heavily on what-iffing (Projections) pass
 *  defaultExpanded={true} so the sliders are visible without a click. */
export default function WhatIfBar({ defaultExpanded = false }: { defaultExpanded?: boolean }) {
  const plan = usePlanStore((s) => s.plan);
  const addScenario = usePlanStore((s) => s.addScenario);
  const active = useWhatIfStore((s) => s.active);
  const overrides = useWhatIfStore((s) => s.overrides);
  const setActive = useWhatIfStore((s) => s.setActive);
  const setOverride = useWhatIfStore((s) => s.setOverride);
  const reset = useWhatIfStore((s) => s.reset);

  const [expanded, setExpanded] = useState(defaultExpanded);

  // Live values fall back to the saved plan when not overridden.
  const retireA = overrides.retirementAgeA ?? plan.personA.retirementAge;
  const preRet = overrides.preRetReturn ?? plan.assumptions.preRetReturn;
  const inflation = overrides.inflation ?? plan.assumptions.inflation;
  const spendMult = overrides.spendingMultiplier ?? 1;

  const dirty = active && (
    overrides.retirementAgeA !== undefined ||
    overrides.preRetReturn !== undefined ||
    overrides.inflation !== undefined ||
    (overrides.spendingMultiplier !== undefined && overrides.spendingMultiplier !== 1)
  );

  const saveAsScenario = () => {
    const id = `scn-${Date.now()}`;
    const planOverrides: DeepPartial<Plan> = {};
    if (overrides.retirementAgeA !== undefined) {
      planOverrides.personA = { retirementAge: overrides.retirementAgeA };
    }
    if (overrides.preRetReturn !== undefined || overrides.inflation !== undefined) {
      planOverrides.assumptions = {
        ...(overrides.preRetReturn !== undefined ? { preRetReturn: overrides.preRetReturn } : {}),
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
    if (overrides.retirementAgeA !== undefined) labelParts.push(`retire @${overrides.retirementAgeA}`);
    if (overrides.preRetReturn !== undefined) labelParts.push(`${(overrides.preRetReturn * 100).toFixed(1)}% return`);
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
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => { setExpanded(!expanded); if (!expanded) setActive(true); }}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: 'var(--text-primary)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: dirty ? 'var(--warning)' : 'var(--text-muted)' }}>
            What-if {dirty && '· Active'}
          </span>
          {!expanded && (
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Try a different retirement age, return, inflation, or spending — projections update live without changing your saved plan.
            </span>
          )}
        </span>
        <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '12px 18px 16px', borderTop: '1px solid var(--border-light)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <Slider
              label="Retirement age (A)"
              value={retireA}
              min={45}
              max={75}
              step={1}
              format={(v) => `age ${v}`}
              onChange={(v) => setOverride('retirementAgeA', v)}
              isOverridden={overrides.retirementAgeA !== undefined}
            />
            <Slider
              label="Pre-ret return"
              value={preRet * 100}
              min={0}
              max={12}
              step={0.1}
              format={(v) => `${v.toFixed(1)}%`}
              onChange={(v) => setOverride('preRetReturn', v / 100)}
              isOverridden={overrides.preRetReturn !== undefined}
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
              max={150}
              step={5}
              format={(v) => `${v.toFixed(0)}%`}
              onChange={(v) => setOverride('spendingMultiplier', v / 100)}
              isOverridden={overrides.spendingMultiplier !== undefined && overrides.spendingMultiplier !== 1}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
            <button
              className="btn btn-ghost"
              onClick={reset}
              disabled={!dirty}
              style={{ fontSize: 12, padding: '6px 14px', opacity: dirty ? 1 : 0.4 }}
            >
              Reset
            </button>
            <button
              className="btn btn-gold"
              onClick={saveAsScenario}
              disabled={!dirty}
              style={{ fontSize: 12, padding: '6px 14px', opacity: dirty ? 1 : 0.4 }}
            >
              Save as scenario
            </button>
          </div>
        </div>
      )}
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-muted)' }}>
          {label}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: isOverridden ? 'var(--warning)' : 'var(--text-primary)' }}>
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
        style={{ width: '100%', accentColor: isOverridden ? 'var(--warning)' : 'var(--gold)' }}
        aria-label={label}
      />
    </div>
  );
}
