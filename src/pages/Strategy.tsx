import { useState } from 'react';
import * as Comlink from 'comlink';
import { usePlanStore, useProjection } from '../store/usePlanStore';
import { NumberInput } from '../components/inputs/NumberInput';
import type { Plan, ConversionParams } from '../schemas/plan';
import { USER_GOALS, type UserGoal } from '../engine/recommender';
import { describePolicy, type OptimizeResult } from '../engine/optimizer';
import { getEngineWorker, disposeEngineWorker } from '../engine/workerClient';
import { fmtUSD, fmtK, fmtM } from '../lib/format';
import RothVsRmd from '../components/charts/RothVsRmd';

type Tab = 'pick' | 'optimize';

interface StrategyOption {
  key: Plan['withdrawalStrategy'];
  label: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  description: string;
}

const STRATEGIES: StrategyOption[] = [
  { key: 'taxfirst', label: 'Taxable → Pre-tax → Roth', badge: 'Classic', badgeColor: '#7a5c10', badgeBg: '#c9a84c20',
    description: 'Spend taxable brokerage first (low LTCG tax), then pre-tax 401(k)/IRA, preserving Roth for last. Standard tax-efficient order.' },
  { key: 'rothfirst', label: 'Roth → Pre-tax → Taxable', badge: 'Roth-First', badgeColor: '#1a8a5a', badgeBg: '#1a8a5a20',
    description: 'Exhaust Roth first (zero tax cost). Useful when pre-tax balance is small or for Medicaid/benefit planning.' },
  { key: 'tradfirst', label: 'Pre-tax → Taxable → Roth', badge: 'Pre-Tax First', badgeColor: '#b8620a', badgeBg: '#b8620a20',
    description: 'Drain pre-tax 401(k)/IRA first to reduce future RMD exposure. Leaves Roth for heirs or late life.' },
  { key: 'proportional', label: 'Proportional (all buckets each year)', badge: 'Blended', badgeColor: '#3b5e8a', badgeBg: '#3b5e8a20',
    description: 'Each year withdraws from all three buckets proportional to their current balances.' },
  { key: 'bracketfill', label: 'Bracket-Fill (tax-aware blended)', badge: 'Advanced', badgeColor: '#7a5c10', badgeBg: '#7a5c1020',
    description: 'Take RMDs, fill the lowest tax bracket with pre-tax, then remaining need from Roth or Taxable.' },
];

const CONV_MODES: Array<{ value: ConversionParams['mode']; title: string; description: string }> = [
  { value: 'off', title: 'No Conversions', description: 'Baseline — no Roth conversions performed.' },
  { value: 'auto-window', title: 'Fixed Amount', description: 'Convert a fixed $ amount each year in a window (today\'s $). Engine inflates.' },
  { value: 'bracket-fill', title: 'Bracket Fill', description: 'Auto-convert to fill the chosen tax bracket each year. IRMAA-aware.' },
  { value: 'manual', title: 'Manual Schedule', description: 'Per-year custom amounts in today\'s $. Matches Excel exactly.' },
];

const BRACKET_OPTIONS = [
  { value: 23850, label: 'Top of 10% bracket ($23,850)' },
  { value: 96950, label: 'Top of 12% bracket ($96,950)' },
  { value: 206700, label: 'Top of 22% bracket ($206,700)' },
  { value: 394600, label: 'Top of 24% bracket ($394,600)' },
];

export default function Strategy() {
  const plan = usePlanStore((s) => s.plan);
  const currentStrategy = plan.withdrawalStrategy;
  const setStrategy = usePlanStore((s) => s.setWithdrawalStrategy);
  const setCustomPolicy = usePlanStore((s) => s.setCustomPolicy);
  const clearCustomPolicy = usePlanStore((s) => s.clearCustomPolicy);
  const hasCustomPolicy = !!plan.customPolicy;

  const [tab, setTab] = useState<Tab>(hasCustomPolicy ? 'optimize' : 'pick');
  const [goal, setGoal] = useState<UserGoal>('max-end-balance');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ frac: number; msg?: string }>({ frac: 0 });
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [useNM, setUseNM] = useState(true);
  const [thorough, setThorough] = useState(true);

  /** Accepts an optional `goalOverride` because the goal-picker calls this synchronously after
   *  setGoal(), and React state is async — without the explicit override, the call would fire
   *  with the previous render's `goal` value. */
  const runOptimize = async (goalOverride?: UserGoal) => {
    const g = goalOverride ?? goal;
    setRunning(true);
    setResult(null);
    setProgress({ frac: 0 });
    try {
      const worker = getEngineWorker();
      const onProgress = Comlink.proxy((frac: number, msg?: string) => {
        setProgress({ frac, msg });
      });
      const r = await worker.optimize(plan, g, { useNelderMead: useNM, thorough }, onProgress);
      setResult(r);
    } finally {
      setRunning(false);
    }
  };

  /** Force-recreate the engine worker. Use when dev-mode caching keeps the worker
   *  on stale bundled engine code despite source edits + page reloads. */
  const reloadEngine = () => {
    disposeEngineWorker();
    setResult(null);
  };

  const applyOptimized = () => {
    if (!result) return;
    setCustomPolicy(result.policy);
  };

  const resetRec = () => {
    setResult(null);
    setRunning(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Strategy</div>
            <div className="page-title">Strategy</div>
            <div className="page-subtitle">Withdrawals &amp; Roth conversions — pick a preset (and optionally customize) or let the optimizer choose</div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div style={{
          display: 'flex',
          gap: 0,
          background: 'var(--bg-surface, #fff)',
          border: '1px solid var(--border-light)',
          borderRadius: 10,
          padding: 4,
          marginBottom: 20,
          width: 'fit-content',
        }}>
          <button onClick={() => setTab('pick')} style={tabBtn(tab === 'pick')}>Pick</button>
          <button onClick={() => setTab('optimize')} style={tabBtn(tab === 'optimize')}>Optimize</button>
        </div>

        {hasCustomPolicy && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.03))',
            border: '1px solid rgba(201,168,76,0.4)',
            borderRadius: 10,
            padding: '12px 18px',
            marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#7a5c10' }}>
                Active: Optimized Custom Policy
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                {describePolicy(plan.customPolicy!)}
              </div>
            </div>
            <button className="btn btn-ghost" onClick={() => clearCustomPolicy()} style={{ background: 'rgba(13,27,46,0.06)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)' }}>
              Revert to Preset
            </button>
          </div>
        )}

        {tab === 'pick' && (
          <>
            <ChoosePanel currentStrategy={currentStrategy} setStrategy={setStrategy} />
            <details style={{ marginTop: 8, border: '1px solid var(--border-light)', borderRadius: 10, background: 'rgba(13,27,46,0.02)' }}>
              <summary style={{ cursor: 'pointer', padding: '12px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span><span style={{ marginRight: 8 }}>▸</span>Customize the blend (advanced)</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Override the preset with age-window percentages and Roth conversion amounts</span>
              </summary>
              <div style={{ padding: '0 12px 12px' }}>
                <CustomBlendPanel />
              </div>
            </details>
          </>
        )}
        {tab === 'optimize' && (
          <>
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginBottom: 12,
              gap: 8,
            }}>
              <button
                className="btn btn-ghost"
                onClick={reloadEngine}
                title="Force a fresh engine worker. Fixes 'Apply isn't updating' when dev-mode caching keeps the worker on stale engine code."
                style={{ fontSize: 11, padding: '6px 12px' }}
              >
                ↻ Reload Engine
              </button>
            </div>
            <RecommendPanel
            goal={goal}
            setGoal={setGoal}
            useNM={useNM}
            setUseNM={setUseNM}
            thorough={thorough}
            setThorough={setThorough}
            running={running}
            progress={progress}
            result={result}
            runOptimize={runOptimize}
            applyOptimized={applyOptimized}
            currentPolicyMatchesResult={
              hasCustomPolicy && result
                ? JSON.stringify(plan.customPolicy?.windows) === JSON.stringify(result.policy.windows)
                : false
            }
            resetRec={resetRec}
            reloadEngine={reloadEngine}
          />
          </>
        )}
      </div>
    </div>
  );
}

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '10px 22px',
  borderRadius: 8,
  border: 'none',
  background: active ? 'var(--navy, #0d1b2e)' : 'transparent',
  color: active ? '#fff' : 'var(--text-secondary)',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
});

// ─── CHOOSE PANEL ─────────────────────────────────────────────────────────────
function ChoosePanel({ currentStrategy, setStrategy }: { currentStrategy: Plan['withdrawalStrategy']; setStrategy: (s: Plan['withdrawalStrategy']) => void }) {
  const activeOpt = STRATEGIES.find((s) => s.key === currentStrategy)!;
  return (
    <>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div className="panel-title"><div className="panel-title-dot"></div>1. Pick a Withdrawal Order</div>
          <span className="badge badge-neutral">{activeOpt.label}</span>
        </div>
        <div className="panel-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {STRATEGIES.map((opt) => {
              const active = opt.key === currentStrategy;
              return (
                <label key={opt.key} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                  borderRadius: 10,
                  border: active ? '2px solid var(--gold)' : '1px solid var(--border-light)',
                  cursor: 'pointer',
                }}>
                  <input type="radio" name="wd-strat" checked={active} onChange={() => setStrategy(opt.key)}
                    style={{ marginTop: 3, accentColor: 'var(--gold)' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                      {opt.label}
                      <span style={{ fontSize: 10, background: opt.badgeBg, color: opt.badgeColor, borderRadius: 4, padding: '2px 7px', marginLeft: 6 }}>{opt.badge}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{opt.description}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <ConversionModePanel />
    </>
  );
}

// ─── CONVERSION MODE PANEL (legacy 4-mode UI lifted from old RothConversions page) ──
function ConversionModePanel() {
  const plan = usePlanStore((s) => s.plan);
  const setConversion = usePlanStore((s) => s.setConversion);
  const proj = useProjection();
  const conv = plan.conversion;

  const startAgeA = new Date().getFullYear() - parseInt(plan.personA.dob.slice(0, 4), 10);
  const manualAges: number[] = [];
  for (let age = Math.max(startAgeA, plan.personA.retirementAge - 5); age <= plan.assumptions.rmdStartAge; age++) manualAges.push(age);

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
          <div className="panel-title"><div className="panel-title-dot"></div>2. Pick a Roth Conversion Mode</div>
        </div>
        <div className="panel-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
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
                  {BRACKET_OPTIONS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
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
            <div style={{ padding: '12px 24px', background: 'rgba(13,27,46,0.03)', fontSize: 12, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>
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
            <div style={{ padding: '12px 24px', background: 'rgba(201,168,76,0.05)', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: 'var(--text-secondary)' }}>Total scheduled conversions (today's $):</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: 'var(--gold)' }}>{fmtUSD(manualTotal)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Conversions vs RMDs</div></div>
        <div className="panel-body"><RothVsRmd proj={proj} real height={240} /></div>
      </div>
    </>
  );
}

// ─── CUSTOM BLEND PANEL ───────────────────────────────────────────────────────
function CustomBlendPanel() {
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
          When a window has a conversion amount &gt; 0, it overrides the Roth Conversion Mode setting in the "I'll Choose" tab.
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
          Changes apply <strong>live</strong> to the projection. Want a starting point? Switch to the <strong>Optimize</strong> tab, pick a goal, then <strong>Apply</strong> the result.
        </div>
      </div>
    </div>
  );
}

// ─── RECOMMEND PANEL ──────────────────────────────────────────────────────────
const GOAL_BADGES: Record<UserGoal, { badge: string; color: string; bg: string }> = {
  'max-end-balance':          { badge: 'Net Worth',  color: '#1a8a5a', bg: '#1a8a5a20' },
  'max-sustainable-spending': { badge: 'Spending',   color: '#7a5c10', bg: '#c9a84c20' },
  'min-retirement-age':       { badge: 'Retire Now', color: '#3b5e8a', bg: '#3b5e8a20' },
};

interface RecPanelProps {
  goal: UserGoal;
  setGoal: (g: UserGoal) => void;
  useNM: boolean;
  setUseNM: (v: boolean) => void;
  thorough: boolean;
  setThorough: (v: boolean) => void;
  running: boolean;
  progress: { frac: number; msg?: string };
  result: OptimizeResult | null;
  runOptimize: (goalOverride?: UserGoal) => void;
  applyOptimized: () => void;
  currentPolicyMatchesResult: boolean;
  resetRec: () => void;
  reloadEngine: () => void;
}

function RecommendPanel(p: RecPanelProps) {
  const showingResult = p.running || p.result !== null;
  if (!showingResult) return <GoalSelectPanel goal={p.goal} setGoal={p.setGoal} useNM={p.useNM} setUseNM={p.setUseNM} thorough={p.thorough} setThorough={p.setThorough} runOptimize={p.runOptimize} />;
  return <OptimizerResultPanel {...p} />;
}

function GoalSelectPanel({ goal, setGoal, useNM, setUseNM, thorough, setThorough, runOptimize }: {
  goal: UserGoal; setGoal: (g: UserGoal) => void; useNM: boolean; setUseNM: (v: boolean) => void;
  thorough: boolean; setThorough: (v: boolean) => void; runOptimize: (goalOverride?: UserGoal) => void;
}) {
  const handlePick = (g: UserGoal) => {
    setGoal(g);
    runOptimize(g);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title"><div className="panel-title-dot"></div>What outcome do you want?</div>
        <span className="badge badge-neutral">Pick one to run</span>
      </div>
      <div className="panel-body" style={{ padding: '16px 20px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
          The optimizer jointly searches withdrawal mix <em>and</em> Roth conversion amount year by year — every retirement year is an independent decision evaluated by a full forward projection. Runs in a Web Worker so the UI stays responsive.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, padding: '10px 12px', background: 'rgba(13,27,46,0.03)', borderRadius: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={useNM} onChange={(e) => setUseNM(e.target.checked)} style={{ accentColor: 'var(--gold)' }} />
            <span><strong>Nelder-Mead refinement</strong> — continuous polish after the grid (+~1s)</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={thorough} onChange={(e) => setThorough(e.target.checked)} style={{ accentColor: 'var(--gold)' }} />
            <span><strong>Thorough optimization</strong> — alternate backward/forward passes until converged (~3× runtime, typically +1–5% on end balance, more on tight plans) <em>(recommended)</em></span>
          </label>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(Object.values(USER_GOALS) as Array<typeof USER_GOALS[UserGoal]>).map((g) => {
            const active = g.key === goal;
            const meta = GOAL_BADGES[g.key];
            return (
              <label key={g.key} onClick={() => handlePick(g.key)} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                borderRadius: 10,
                border: active ? '2px solid var(--gold)' : '1px solid var(--border-light)',
                cursor: 'pointer',
              }}>
                <input type="radio" name="opt-goal" checked={active} readOnly style={{ marginTop: 3, accentColor: 'var(--gold)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                    {g.label}
                    <span style={{ fontSize: 10, background: meta.bg, color: meta.color, borderRadius: 4, padding: '2px 7px', marginLeft: 6 }}>{meta.badge}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{g.description}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OptimizerResultPanel({ goal, running, progress, result, applyOptimized, currentPolicyMatchesResult, resetRec, reloadEngine }: RecPanelProps) {
  const goalSpec = USER_GOALS[goal];
  const meta = GOAL_BADGES[goal];

  return (
    <div className="panel">
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={resetRec} title="Back to goal selection" style={{
            background: 'rgba(13,27,46,0.06)', border: '1px solid var(--border-light)', borderRadius: 8,
            padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)',
            fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>← Back</button>
          <div className="panel-title" style={{ margin: 0 }}>
            <div className="panel-title-dot"></div>
            <span>Optimizing: {goalSpec.label}</span>
          </div>
        </div>
        <span style={{ fontSize: 10, background: meta.bg, color: meta.color, borderRadius: 4, padding: '3px 8px', fontWeight: 600 }}>{meta.badge}</span>
      </div>
      <div className="panel-body" style={{ padding: '18px 24px' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>{goalSpec.description}</div>

        {running && (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <div style={{ marginBottom: 12 }}>{progress.msg ?? 'Optimizing…'}</div>
            <div style={{
              width: '60%', margin: '0 auto', height: 8, background: 'rgba(13,27,46,0.08)', borderRadius: 4, overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.round(Math.min(1, Math.max(0, progress.frac)) * 100)}%`,
                height: '100%', background: 'var(--gold)', transition: 'width 200ms ease',
              }} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
              {Math.round(Math.min(1, Math.max(0, progress.frac)) * 100)}%
            </div>
          </div>
        )}

        {result && !running && (
          <div>
            <div style={{
              background: 'linear-gradient(135deg, rgba(26,138,90,0.08), rgba(26,138,90,0.02))',
              border: '1px solid rgba(26,138,90,0.35)',
              borderRadius: 10, padding: '16px 20px', marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 360px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: '#1a8a5a' }}>
                    {result.headlineLabel}
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginTop: 6, fontFamily: "'Playfair Display', serif" }}>
                    {result.headline}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {result.evaluations.toLocaleString()} projections evaluated · {result.ranOut ? <span style={{ color: 'var(--danger, #c0392b)' }}>⚠ plan runs out</span> : <span style={{ color: '#1a8a5a' }}>✓ plan fully funded</span>}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
                    End balance: <strong>{fmtM(result.projection.endTotalReal)}</strong> (today's $) ·
                    Lifetime fed tax: <strong>{fmtK(result.projection.lifetimeFedTax)}</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn btn-gold" onClick={applyOptimized} disabled={currentPolicyMatchesResult}
                    style={{ opacity: currentPolicyMatchesResult ? 0.5 : 1 }}>
                    {currentPolicyMatchesResult ? 'Already Applied' : 'Apply This Policy'}
                  </button>
                  <button className="btn btn-ghost" onClick={reloadEngine}
                    title="Force a fresh engine worker. Use if results look stale despite running optimizer + hard reload."
                    style={{ fontSize: 11, padding: '6px 10px' }}>
                    Reload Engine
                  </button>
                </div>
              </div>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 8 }}>
              Recommended Strategy By Age Window
            </div>
            <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Age Window</th>
                  <th style={{ textAlign: 'right' }}>Taxable</th>
                  <th style={{ textAlign: 'right' }}>Pre-tax</th>
                  <th style={{ textAlign: 'right' }}>Roth</th>
                  <th style={{ textAlign: 'right' }}>Conv $/yr (today's $)</th>
                </tr>
              </thead>
              <tbody>
                {result.policy.windows.map((w, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>Ages {w.fromAge}–{w.toAge}</td>
                    <td style={{ textAlign: 'right' }}>{Math.round(w.pctTaxable * 100)}%</td>
                    <td style={{ textAlign: 'right' }}>{Math.round(w.pctTraditional * 100)}%</td>
                    <td style={{ textAlign: 'right' }}>{Math.round(w.pctRoth * 100)}%</td>
                    <td style={{ textAlign: 'right' }}>{w.convAmt && w.convAmt > 0 ? fmtUSD(w.convAmt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.5 }}>
              The optimizer made independent decisions for every retirement year; consecutive years with the same blend are merged for display. RMDs (when applicable) are honored first; the blend covers the remaining gap.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
