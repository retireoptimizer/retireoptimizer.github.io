import { useState } from 'react';
import { usePlanStore } from '../store/usePlanStore';
import { useOptimizerStore } from '../store/useOptimizerStore';
import { useWhatIfStore } from '../store/useWhatIfStore';
import { STRATEGIES } from '../engine/strategyPresets';
import { USER_GOALS, type UserGoal } from '../engine/recommender';
import type { ConversionParams } from '../schemas/plan';
import { applyResultToPlan } from '../engine/applyOptimizerResult';
import { getEngineWorker } from '../engine/workerClient';
import StrategyCustomizeSheet from './strategy/StrategyCustomizeSheet';
import { FED_BRACKETS_MFJ, FED_BRACKETS_SINGLE } from '../engine/taxConstants';
import { planInputKey } from '../engine/planInputKey';

const GOAL_SHORT_LABELS: Record<UserGoal, string> = {
  'max-end-balance': 'Max End Balance',
  'max-sustainable-spending': 'Max Spending',
  'min-retirement-age': 'Earliest Retire',
};

type ConvMode = ConversionParams['mode'];
const CONV_LABELS: Record<ConvMode, string> = {
  'off': 'None',
  'bracket-fill': 'Bracket-Fill',
  'auto-window': 'Fixed Amount',
  'manual': 'Manual',
};

type PillState = 'idle' | 'active' | 'pending';
const PILL_BORDER: Record<PillState, string> = {
  idle: '1px solid var(--border-light)', active: '2px solid var(--gold)', pending: '2px solid var(--warning)',
};
const PILL_BG: Record<PillState, string> = {
  idle: '#fff', active: 'rgba(201,168,76,0.08)', pending: 'var(--warning-light)',
};
const PILL_COLOR: Record<PillState, string> = {
  idle: 'var(--text-secondary)', active: '#7a5c10', pending: '#8a4a08',
};

// Pills and pill-styled selects share a fixed height so they align on one row.
const pillStyle = (state: PillState): React.CSSProperties => ({
  height: 34, boxSizing: 'border-box', padding: '0 13px',
  fontSize: 13, fontWeight: 600, borderRadius: 999,
  border: PILL_BORDER[state], background: PILL_BG[state], color: PILL_COLOR[state],
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  display: 'inline-flex', alignItems: 'center', gap: 5,
});
const selectPillStyle = (state: PillState): React.CSSProperties => ({
  height: 34, boxSizing: 'border-box', padding: '0 8px 0 12px',
  fontSize: 13, fontWeight: 600, borderRadius: 999,
  border: PILL_BORDER[state], background: PILL_BG[state], color: state === 'idle' ? 'var(--text-primary)' : PILL_COLOR[state],
  cursor: 'pointer', fontFamily: 'inherit',
  // Override the design system's global `select { width: 100% }`.
  width: 'fit-content', minWidth: 0,
});

const inlineLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
  color: 'var(--text-secondary)', flexShrink: 0, whiteSpace: 'nowrap',
};
const editLinkStyle: React.CSSProperties = {
  border: 'none', background: 'transparent', color: 'var(--gold)', cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, padding: '0 2px', whiteSpace: 'nowrap',
};
const Chk = () => <span style={{ color: 'var(--gold)', fontWeight: 800 }}>✓</span>;

export default function StrategyChooser() {
  const plan = usePlanStore((s) => s.plan);
  const setStrategy = usePlanStore((s) => s.setWithdrawalStrategy);
  const setWithdrawalBracketCeiling = usePlanStore((s) => s.setWithdrawalBracketCeiling);
  const clearCustomPolicy = usePlanStore((s) => s.clearCustomPolicy);
  const setConversion = usePlanStore((s) => s.setConversion);
  const applyOptimizerResult = usePlanStore((s) => s.applyOptimizerResult);
  const optimizedPlanKey = useOptimizerStore((s) => s.planKey);
  const setPlanKey = useOptimizerStore((s) => s.setPlanKey);
  const setOptimizerResult = useOptimizerStore((s) => s.setResult);
  const setPendingPlan = useOptimizerStore((s) => s.setPendingPlan);
  const setPendingGoal = useOptimizerStore((s) => s.setPendingGoal);
  const pendingPlan = useOptimizerStore((s) => s.pendingPlan);

  const resetWhatIf = useWhatIfStore((s) => s.reset);

  const [sheetMode, setSheetMode] = useState<null | 'blend' | 'conversion' | 'chart'>(null);
  const [optimizing, setOptimizing] = useState(false);

  // Derive active state from the pending plan (if one exists) or the committed plan store.
  const effectivePlan = pendingPlan ?? plan;
  const hasCustom = !!effectivePlan.customPolicy;
  const activeKey = plan.withdrawalStrategy;
  const activeGoal = effectivePlan.optimizedForGoal as UserGoal | undefined;
  const optimizerDriven = hasCustom && activeGoal != null;
  const handEdited = hasCustom && activeGoal == null;
  // True when plan store inputs changed since the optimizer last ran against them.
  const planInputsChanged = optimizedPlanKey != null && planInputKey(plan) !== optimizedPlanKey;
  const conv = effectivePlan.conversion;
  const optimizeOn = conv.optimize ?? true;

  const [approach, setApproach] = useState<'optimize' | 'manual'>(optimizerDriven ? 'optimize' : 'manual');
  // Snapshot conv at the moment re-optimization runs so we can detect mode drift afterward.
  const [convSnapshot, setConvSnapshot] = useState<Pick<ConversionParams, 'optimize' | 'mode' | 'bracketCeiling' | 'autoAmount' | 'startAge' | 'endAge'>>(() => ({
    optimize: conv.optimize, mode: conv.mode, bracketCeiling: conv.bracketCeiling,
    autoAmount: conv.autoAmount, startAge: conv.startAge, endAge: conv.endAge,
  }));
  // Pending conv selection in "Optimize for me" tab — not written to plan store until re-optimize runs.
  const [pendingConv, setPendingConv] = useState<Partial<ConversionParams> | null>(null);
  // When a tab is just entered via switchApproach, all pills show idle until user explicitly clicks one.
  const [tabFreshEntry, setTabFreshEntry] = useState<'none' | 'optimize' | 'manual'>('none');

  // Highlighted goal; null = no explicit selection yet (shows idle pills).
  const [selectedGoal, setSelectedGoal] = useState<UserGoal | null>(activeGoal ?? null);
  const [seenGoal, setSeenGoal] = useState<UserGoal | undefined>(activeGoal);
  // Sync when the active goal changes externally (e.g. pendingPlan updated by a different code path).
  if (activeGoal !== seenGoal) {
    setSeenGoal(activeGoal);
    setSelectedGoal(activeGoal ?? null);
  }

  const brackets = plan.personB ? FED_BRACKETS_MFJ : FED_BRACKETS_SINGLE;
  const wdBracketOptions = brackets.slice(0, 4).map(([top, rate]) => ({
    value: top, label: `${Math.round(rate * 100)}% ($${top.toLocaleString()})`,
  }));
  const convBracketOptions = brackets.slice(0, 4)
    .filter(([top]) => plan.withdrawalStrategy !== 'bracketfill' || top <= plan.withdrawalBracketCeiling)
    .map(([top, rate]) => ({ value: top, label: `${Math.round(rate * 100)}% ($${top.toLocaleString()})` }));

  const policyHasNumericConv = effectivePlan.customPolicy?.windows.some((w) => w.convAmt != null) ?? false;
  // Stale if optimize flag flipped vs policy, conv mode drifted since last run, or pending selection exists.
  const convModeDrifted = optimizerDriven && !optimizeOn && (
    conv.mode !== convSnapshot.mode ||
    conv.bracketCeiling !== convSnapshot.bracketCeiling ||
    conv.autoAmount !== convSnapshot.autoAmount ||
    conv.startAge !== convSnapshot.startAge ||
    conv.endAge !== convSnapshot.endAge
  );
  const convStale = optimizerDriven && (optimizeOn !== policyHasNumericConv || convModeDrifted || pendingConv !== null);
  const goalChanged = selectedGoal !== null && selectedGoal !== activeGoal;
  const canReOptimize = !optimizing && tabFreshEntry !== 'optimize' && (goalChanged || convStale || !hasCustom || planInputsChanged);

  const runReOptimize = async () => {
    setOptimizing(true);
    try {
      const worker = getEngineWorker();
      // Plan store is always the clean baseline — no base* restoration needed.
      let planForOptimize = plan;
      // Bake pending conv selection into the plan before sending to optimizer.
      if (pendingConv) planForOptimize = { ...planForOptimize, conversion: { ...planForOptimize.conversion, ...pendingConv } };
      const goalToUse = (selectedGoal ?? activeGoal ?? 'max-end-balance') as UserGoal;
      const r = await worker.optimize(planForOptimize, goalToUse, { useNelderMead: true, thorough: true });
      const appliedPlan = applyResultToPlan(planForOptimize, r);
      // planKey fingerprints planForOptimize (what the optimizer actually saw, including any pendingConv).
      setPlanKey(planInputKey(planForOptimize));
      setTabFreshEntry('none');
      setOptimizerResult(r);
      // Commit pending conv mode to the plan store — it's a user preference, not an optimizer output.
      if (pendingConv) { setConversion(pendingConv); setPendingConv(null); }
      const c = planForOptimize.conversion;
      setConvSnapshot({ optimize: c.optimize, mode: c.mode, bracketCeiling: c.bracketCeiling, autoAmount: c.autoAmount, startAge: c.startAge, endAge: c.endAge });
      // Only show the pending banner when the optimizer mutates input-visible fields.
      // max-end-balance: only updates customPolicy/optimizedForGoal — safe to auto-apply, no circularity.
      // max-sustainable-spending / min-retirement-age: scales expenses or changes retirementAge —
      // user must explicitly Apply so those mutations don't silently corrupt the baseline for other goals.
      const mutatesInputs = goalToUse === 'max-sustainable-spending' || goalToUse === 'min-retirement-age';
      if (mutatesInputs) {
        setPendingPlan(appliedPlan);
        setPendingGoal(goalToUse);
      } else {
        applyOptimizerResult(appliedPlan);
        setPendingPlan(null);
        setPendingGoal(null);
        // Clear any what-if overrides so the dashboard reflects the optimizer's actual inputs,
        // not stale slider positions from a prior what-if session.
        resetWhatIf();
      }
    } catch (err) {
      console.error('[StrategyChooser] Re-optimize failed:', err);
    } finally {
      setOptimizing(false);
    }
  };

  const switchApproach = (next: 'optimize' | 'manual') => {
    if (pendingConv) setPendingConv(null);
    // Preserve goal selection when returning to an active optimizer result; clear it otherwise.
    if (!hasCustom) setSelectedGoal(null);
    // Force idle on manual only when coming from an active optimizer result (hasCustom).
    // Force idle on optimize only when user actually engaged manual (customPolicy cleared).
    setTabFreshEntry(next === 'manual' ? (hasCustom ? 'manual' : 'none') : (hasCustom ? 'none' : 'optimize'));
    setApproach(next);
  };

  const pickWithdrawal = (key: typeof STRATEGIES[number]['key']) => {
    if (hasCustom) clearCustomPolicy();
    // User is explicitly choosing a manual strategy — discard any pending optimizer result so
    // effectivePlan (pendingPlan ?? plan) doesn't keep hasCustom = true via pendingPlan.customPolicy.
    setPendingPlan(null);
    setPendingGoal(null);
    setTabFreshEntry('none');
    setStrategy(key);
  };

  // ── Conversion row (shared) — each option is a column so its "Edit …" link sits under the pill.
  const conversionRow = (tab: 'optimize' | 'manual') => {
    if (tab === 'manual' && handEdited) {
      return (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Conversions are set per-year in your custom blend.{' '}
          <button style={editLinkStyle} onClick={() => setSheetMode('blend')}>Edit blend →</button>
        </div>
      );
    }

    // In "optimize" tab, pill selection writes to pendingConv (not the plan store) so projections
    // don't update until the user actually re-runs the optimizer.
    const effOptimizeOn = tab === 'optimize' && pendingConv !== null
      ? (pendingConv.optimize ?? false) : optimizeOn;
    const effMode = tab === 'optimize' && pendingConv !== null
      ? (pendingConv.mode ?? conv.mode) : conv.mode;
    const effCeiling = tab === 'optimize' && pendingConv !== null
      ? (pendingConv.bracketCeiling ?? conv.bracketCeiling) : conv.bracketCeiling;

    const isSel = (m: ConvMode) => tab === 'optimize'
      ? (!effOptimizeOn && effMode === m)
      : (tabFreshEntry !== 'manual' && !hasCustom && conv.mode === m);

    const stateFor = (m: ConvMode): PillState => {
      const sel = isSel(m);
      if (tab === 'optimize') {
        if (tabFreshEntry === 'optimize') return 'idle';
        // Pending selection wins: only the pending pill is amber, everything else idle.
        if (pendingConv !== null) return sel ? 'pending' : 'idle';
        // No pending: applied selection is gold-active (or amber if drift-stale from prior session).
        return sel && convStale ? 'pending' : sel ? 'active' : 'idle';
      }
      return sel ? 'active' : 'idle';
    };

    const selectMode = (m: ConvMode, extra?: Partial<ConversionParams>) => {
      if (tab === 'optimize') {
        setTabFreshEntry('none');
        setPendingConv({ optimize: false, mode: m, ...extra });
      } else {
        if (hasCustom) clearCustomPolicy();
        // Discard pending optimizer result for the same reason as pickWithdrawal.
        setPendingPlan(null);
        setPendingGoal(null);
        setTabFreshEntry('none');
        setConversion({ mode: m, ...extra });
      }
    };

    const editLink = (label: string) => (
      <button style={editLinkStyle} onClick={() => {
        // Commit pending conv selection so ConversionDetail reads real store state.
        // convModeDrifted will still mark the optimizer stale → re-run button stays active.
        if (tab === 'optimize' && pendingConv) { setConversion(pendingConv); setPendingConv(null); }
        setSheetMode('conversion');
      }}>{label} →</button>
    );
    const col = (key: string, pill: React.ReactNode, link?: React.ReactNode) => (
      <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>{pill}{link}</div>
    );
    const modePill = (m: ConvMode) => {
      const st = stateFor(m);
      return <button onClick={() => selectMode(m)} style={pillStyle(st)}>{st === 'active' && <Chk />}{CONV_LABELS[m]}</button>;
    };

    // "Optimizer decides" pill state
    const optDecidesSt: PillState = tab === 'optimize'
      ? (tabFreshEntry === 'optimize' ? 'idle' : (pendingConv !== null
        ? (pendingConv.optimize === true ? 'pending' : 'idle')
        : (optimizeOn && convStale ? 'pending' : optimizeOn ? 'active' : 'idle')))
      : 'idle';

    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        {tab === 'optimize' && col('auto',
          <button
            onClick={() => { setTabFreshEntry('none'); setPendingConv({ optimize: true }); }}
            title="The optimizer searches conversion amounts for you"
            style={pillStyle(optDecidesSt)}
          >
            {optDecidesSt === 'active' && <Chk />}🎯 Optimizer decides
          </button>
        )}
        {col('off', modePill('off'))}
        {col('bracket-fill',
          <select
            value={isSel('bracket-fill') ? effCeiling : ''}
            onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) selectMode('bracket-fill', { bracketCeiling: v }); }}
            style={selectPillStyle(stateFor('bracket-fill'))}
            aria-label="Bracket-Fill conversion ceiling"
          >
            <option value="">Bracket-Fill</option>
            {convBracketOptions.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>,
          isSel('bracket-fill') ? editLink('Edit age window') : undefined
        )}
        {col('auto-window', modePill('auto-window'), isSel('auto-window') ? editLink('Edit details') : undefined)}
        {col('manual', modePill('manual'), isSel('manual') ? editLink('Edit details') : undefined)}
      </div>
    );
  };

  return (
    <>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>

          {/* Vertical mode tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border-light)', flexShrink: 0 }}>
            {(['optimize', 'manual'] as const).map((tab) => {
              const active = approach === tab;
              return (
                <button key={tab} onClick={() => switchApproach(tab)} style={{
                  flex: 1, display: 'flex', alignItems: 'center',
                  padding: '0 18px', textAlign: 'left', border: 'none', whiteSpace: 'nowrap',
                  borderLeft: `4px solid ${active ? 'var(--gold)' : 'transparent'}`,
                  borderBottom: tab === 'optimize' ? '1px solid var(--border-light)' : 'none',
                  background: active ? '#fdf3dc' : 'rgba(13,27,46,0.04)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: active ? 13.5 : 13, fontWeight: active ? 700 : 400,
                  color: active ? '#7a4f00' : 'rgba(13,27,46,0.35)',
                }}>
                  {tab === 'optimize' ? '⚡ Optimize for me' : '✎ Set it myself'}
                </button>
              );
            })}
          </div>

          {/* Content grid: label col | pills col | actions col */}
          <div style={{
            flex: 1, padding: '12px 14px 12px 16px',
            display: 'grid',
            gridTemplateColumns: 'max-content 1fr auto',
            columnGap: 16, rowGap: 10,
            alignItems: 'start',
          }}>

            {approach === 'optimize' && (<>
              {/* Goal row */}
              <div style={{ ...inlineLabelStyle, paddingTop: 9 }}>Goal</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {(Object.keys(USER_GOALS) as UserGoal[]).map((key) => {
                  const selected = tabFreshEntry !== 'optimize' && key === selectedGoal;
                  const applied = optimizerDriven && key === activeGoal;
                  return (
                    <button key={key} onClick={() => { setTabFreshEntry('none'); setSelectedGoal(key); }} title={USER_GOALS[key].description}
                      style={pillStyle(selected ? 'active' : 'idle')}>
                      {applied && <Chk />}{GOAL_SHORT_LABELS[key]}
                    </button>
                  );
                })}
              </div>
              {/* Re-optimize button */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                <button onClick={runReOptimize} disabled={!canReOptimize}
                  style={{
                    height: 34, boxSizing: 'border-box', fontSize: 13, fontWeight: 600,
                    padding: '0 14px', borderRadius: 8, border: 'none',
                    background: canReOptimize ? 'var(--gold)' : 'rgba(13,27,46,0.06)',
                    color: canReOptimize ? 'var(--navy)' : 'var(--text-muted)',
                    cursor: canReOptimize ? 'pointer' : 'default', fontFamily: 'inherit', whiteSpace: 'nowrap',
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                  }}>
                  {(convStale || planInputsChanged) && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--warning)', display: 'inline-block' }} />}
                  {optimizing ? 'Optimizing…' : (convStale || planInputsChanged) ? '↗ Re-optimize · Apply' : '↗ Re-optimize'}
                </button>
                {planInputsChanged && !convStale && (
                  <div style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600 }}>Plan inputs changed — re-optimize recommended.</div>
                )}
              </div>

              {/* Roth row */}
              <div style={{ ...inlineLabelStyle, paddingTop: 9 }}>Roth conversions</div>
              <div>
                {conversionRow('optimize')}
                {convStale && <div style={{ fontSize: 11.5, color: 'var(--warning)', fontWeight: 600, marginTop: 8 }}>Takes effect when you re-optimize.</div>}
              </div>
              <div style={{ paddingTop: 9, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setSheetMode('chart')} style={{ ...editLinkStyle, fontSize: 12 }}>📊 Conversions vs RMDs →</button>
              </div>
            </>)}

            {approach === 'manual' && (<>
              {/* Withdrawal order row */}
              <div style={{ ...inlineLabelStyle, paddingTop: 9 }}>Withdrawal order</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {STRATEGIES.map((s) => {
                  const isActive = tabFreshEntry !== 'manual' && s.key === activeKey && !hasCustom;
                  if (s.key === 'bracketfill') {
                    return (
                      <select key={s.key} title={s.description}
                        value={isActive ? plan.withdrawalBracketCeiling : ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (isNaN(val)) return;
                          if (hasCustom) clearCustomPolicy();
                          setPendingPlan(null);
                          setPendingGoal(null);
                          setTabFreshEntry('none');
                          setStrategy('bracketfill');
                          setWithdrawalBracketCeiling(val);
                        }}
                        style={selectPillStyle(isActive ? 'active' : 'idle')}>
                        <option value="">Bracket-Fill</option>
                        {wdBracketOptions.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                      </select>
                    );
                  }
                  return (
                    <button key={s.key} onClick={() => pickWithdrawal(s.key)} title={s.description}
                      style={pillStyle(isActive ? 'active' : 'idle')}>
                      {isActive && <Chk />}{s.shortLabel}
                    </button>
                  );
                })}
                <button onClick={() => setSheetMode('blend')} title="Edit custom withdrawal blend by age window"
                  style={pillStyle(handEdited ? 'active' : 'idle')}>
                  {handEdited && <Chk />}✎ Custom blend
                </button>
              </div>
              <div style={{ paddingTop: 9, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setSheetMode('chart')} style={{ ...editLinkStyle, fontSize: 12 }}>📊 Conversions vs RMDs →</button>
              </div>

              {/* Roth conversions row */}
              <div>
                <span style={inlineLabelStyle}>Roth conversions</span>
                {!handEdited && <span style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--text-muted)', marginTop: 2 }}>· instant</span>}
              </div>
              <div>{conversionRow('manual')}</div>
              <div />
            </>)}

          </div>
        </div>
      </div>

      <StrategyCustomizeSheet
        open={sheetMode !== null}
        mode={sheetMode ?? 'blend'}
        onClose={() => setSheetMode(null)}
      />
    </>
  );
}
