import { usePlanStore } from '../store/usePlanStore';
import { useWhatIfStore } from '../store/useWhatIfStore';
import { useOptimizerStore } from '../store/useOptimizerStore';
import type { DeepPartial } from '../engine/scenario';
import type { Plan } from '../schemas/plan';

function yearsToRetirement(dob: string, retirementAge: number): number {
  const currentYear = new Date().getFullYear();
  const birthYear = parseInt(dob.slice(0, 4), 10);
  const currentAge = currentYear - birthYear;
  return Math.max(0, retirementAge - currentAge);
}

/** Ephemeral what-if controls — a single inline bar: 4 sliders + Reset +
 *  Save-as-scenario all on one line. Sliders overlay the saved plan and trigger
 *  a fresh projection on every change; the saved plan is never mutated. Moving
 *  any slider implicitly activates the overlay (see useWhatIfStore.setOverride). */
export default function WhatIfBar() {
  const plan = usePlanStore((s) => s.plan);
  const displayMode = usePlanStore((s) => s.displayMode);
  const real = displayMode === 'real';
  const addScenario = usePlanStore((s) => s.addScenario);
  const active = useWhatIfStore((s) => s.active);
  const overrides = useWhatIfStore((s) => s.overrides);
  const setOverride = useWhatIfStore((s) => s.setOverride);
  const reset = useWhatIfStore((s) => s.reset);
  const pendingPlan = useOptimizerStore((s) => s.pendingPlan);

  // When a pending optimizer result is active, use it as the baseline for what-if sliders.
  const effectivePlan = pendingPlan ?? plan;

  // Live values fall back to the effective plan (pending or saved) when not overridden.
  const retireA = overrides.retirementAgeA ?? effectivePlan.personA.retirementAge;
  const retireB = overrides.retirementAgeB ?? effectivePlan.personB?.retirementAge ?? 0;
  // Use tradReturn as the representative rate for the single what-if slider.
  const returnRate = overrides.returnRate ?? effectivePlan.assumptions.tradReturn;
  const inflation = overrides.inflation ?? effectivePlan.assumptions.inflation;
  // Spending: show absolute dollars based on the effective plan's expense streams.
  const baseSum = effectivePlan.expenseStreams.reduce((s, e) => s + e.annualAmount, 0);
  const currentSum = baseSum;
  const spendDollars = overrides.spendingDollars ?? currentSum;
  const spendIsOverridden = overrides.spendingDollars !== undefined && Math.abs(overrides.spendingDollars - currentSum) > 1;

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
    if (overrides.spendingDollars !== undefined && baseSum > 0) {
      // Bake the dollar override into the snapshot by scaling base expenses proportionally.
      planOverrides.expenseStreams = effectivePlan.expenseStreams.map((s) => ({
        ...s,
        annualAmount: s.annualAmount * overrides.spendingDollars! / baseSum,
      }));
    }
    const labelParts: string[] = [];
    if (overrides.retirementAgeA !== undefined) labelParts.push(`${plan.personA.name} retire @${overrides.retirementAgeA}`);
    if (overrides.retirementAgeB !== undefined && plan.personB) labelParts.push(`${plan.personB.name} retire @${overrides.retirementAgeB}`);
    if (overrides.returnRate !== undefined) labelParts.push(`${(overrides.returnRate * 100).toFixed(1)}% return`);
    if (overrides.inflation !== undefined) labelParts.push(`${(overrides.inflation * 100).toFixed(1)}% infl`);
    if (spendIsOverridden) labelParts.push(`spend $${Math.round(overrides.spendingDollars! / 1000)}K`);
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
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: dirty ? 'var(--warning)' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
          What-If{dirty && ' · Active'}
          <span style={{ fontSize: 11, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)', marginLeft: 8 }}>
            live overlay · saved plan unchanged
          </span>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={reset}
            disabled={!dirty}
            style={{ fontSize: 12, padding: '6px 12px', opacity: dirty ? 1 : 0.4, background: 'rgba(13,27,46,0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}
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
        {currentSum > 0 && (
          <Slider
            label={`Spending${real ? '' : ' (nominal $)'}`}
            value={spendDollars}
            min={Math.max(0, Math.round(currentSum * 0.5 / 1000) * 1000)}
            max={Math.round(currentSum * 2.5 / 1000) * 1000}
            step={Math.max(1000, Math.round(currentSum / 50 / 1000) * 1000)}
            format={(v) => {
              if (real) return `$${Math.round(v / 1000)}K`;
              const infl = overrides.inflation ?? effectivePlan.assumptions.inflation;
              const yrs = yearsToRetirement(plan.personA.dob, retireA);
              const nominal = v * Math.pow(1 + infl, yrs);
              return `$${Math.round(nominal / 1000)}K`;
            }}
            onChange={(v) => setOverride('spendingDollars', v)}
            isOverridden={spendIsOverridden}
          />
        )}
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
