import { useState, useEffect } from 'react';
import { usePlanStore } from '../store/usePlanStore';
import { STRATEGIES } from '../engine/strategyPresets';
import { USER_GOALS, type UserGoal } from '../engine/recommender';
import { applyResultToPlan } from '../engine/applyOptimizerResult';
import { getEngineWorker } from '../engine/workerClient';
import StrategyCustomizeSheet from './strategy/StrategyCustomizeSheet';

/** Dashboard's tactical strategy widget.
 *  Row 1 (Optimize For): goal chips — selecting one enables Re-optimize to run inline.
 *  Row 2 (Custom Strategy): 5 preset chips — clicking one clears customPolicy and
 *    de-selects row 1. Customize button at end of row 2 opens StrategyCustomizeSheet. */
const GOAL_SHORT_LABELS: Record<UserGoal, string> = {
  'max-end-balance': 'Max End Balance',
  'max-sustainable-spending': 'Max Spending',
  'min-retirement-age': 'Earliest Retire',
};

export default function StrategyChooser() {
  const plan = usePlanStore((s) => s.plan);
  const setStrategy = usePlanStore((s) => s.setWithdrawalStrategy);
  const clearCustomPolicy = usePlanStore((s) => s.clearCustomPolicy);
  const applyOptimizerResult = usePlanStore((s) => s.applyOptimizerResult);
  const [sheetMode, setSheetMode] = useState<null | 'blend' | 'conversion'>(null);
  const [optimizing, setOptimizing] = useState(false);

  const hasCustom = !!plan.customPolicy;
  const activeKey = plan.withdrawalStrategy;
  const activeGoal = plan.optimizedForGoal as UserGoal | undefined;

  // Tracks which goal the user has highlighted in row 1; null when a row-2 preset is active.
  const [pendingGoal, setPendingGoal] = useState<UserGoal | null>(activeGoal ?? null);

  // Sync pendingGoal when activeGoal changes (e.g. after optimizer applies result).
  useEffect(() => {
    if (activeGoal) setPendingGoal(activeGoal);
  }, [activeGoal]);

  const canReOptimize = pendingGoal !== null && !optimizing && !(hasCustom && pendingGoal === activeGoal);

  const runReOptimize = async () => {
    if (!pendingGoal) return;
    setOptimizing(true);
    try {
      const worker = getEngineWorker();
      // Always restore base snapshots before re-optimizing so each goal runs against
      // the user's original inputs — not amounts scaled by a prior max-spending run
      // or ages shifted by a prior min-retirement-age run.
      let planForOptimize = plan;
      if (plan.baseExpenseStreams) {
        planForOptimize = { ...planForOptimize, expenseStreams: plan.baseExpenseStreams };
      }
      if (plan.basePersonA) {
        planForOptimize = { ...planForOptimize, personA: plan.basePersonA };
        if (plan.basePersonB !== undefined) {
          planForOptimize = { ...planForOptimize, personB: plan.basePersonB };
        }
      }
      const r = await worker.optimize(planForOptimize, pendingGoal, { useNelderMead: true, thorough: true });
      applyOptimizerResult(applyResultToPlan(planForOptimize, r));
    } catch (err) {
      console.error('[StrategyChooser] Re-optimize failed:', err);
    } finally {
      setOptimizing(false);
    }
  };

  const reOptimizeBtnStyle: React.CSSProperties = {
    marginLeft: 'auto',
    fontSize: 12, fontWeight: 600,
    padding: '5px 10px',
    border: 'none', background: 'transparent',
    color: canReOptimize ? 'var(--gold)' : 'var(--text-muted)',
    cursor: canReOptimize ? 'pointer' : 'default',
    fontFamily: 'inherit',
    opacity: canReOptimize ? 1 : 0.45,
    whiteSpace: 'nowrap',
  };

  return (
    <>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div className="panel-title"><div className="panel-title-dot"></div>Adjust Withdrawal Strategies</div>
        </div>
        <div className="panel-body" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Row 1: Optimize For */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)', marginRight: 4, whiteSpace: 'nowrap' }}>
              Optimize For:
            </span>
            {(Object.keys(USER_GOALS) as UserGoal[]).map((key) => {
              const isSelected = key === pendingGoal;
              const isApplied = hasCustom && key === activeGoal;
              return (
                <button
                  key={key}
                  onClick={() => setPendingGoal(key)}
                  title={USER_GOALS[key].description}
                  style={{
                    fontSize: 12, fontWeight: 600,
                    padding: '5px 10px',
                    borderRadius: 999,
                    border: isSelected ? '2px solid var(--gold)' : '1px solid var(--border-light)',
                    background: isSelected ? 'var(--gold)' : 'transparent',
                    color: isSelected ? '#0d1b2e' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {isApplied && <span style={{ marginRight: 4 }}>✓</span>}
                  {GOAL_SHORT_LABELS[key]}
                </button>
              );
            })}
            <button
              onClick={runReOptimize}
              disabled={!canReOptimize}
              style={reOptimizeBtnStyle}
            >
              {optimizing ? 'Optimizing…' : '↗ Re-optimize'}
            </button>
          </div>

          {/* Row 2: Custom Strategy */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)', marginRight: 4, whiteSpace: 'nowrap' }}>
                Withdrawal:
              </span>
              {STRATEGIES.map((s) => {
                const isActive = s.key === activeKey && !hasCustom && pendingGoal === null;
                return (
                  <button
                    key={s.key}
                    onClick={() => {
                      if (hasCustom) clearCustomPolicy();
                      setStrategy(s.key);
                      setPendingGoal(null);
                    }}
                    title={s.description}
                    style={{
                      fontSize: 13, fontWeight: 600,
                      padding: '7px 14px',
                      borderRadius: 999,
                      border: isActive ? '2px solid var(--gold)' : '1px solid var(--border-light)',
                      background: isActive ? 'rgba(201,168,76,0.08)' : 'var(--bg-surface, #fff)',
                      color: isActive ? '#7a5c10' : 'var(--text-primary)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >{s.shortLabel}</button>
                );
              })}
              {/* Custom blend chip — active when a custom policy is in effect */}
              <button
                onClick={() => setSheetMode('blend')}
                title="Edit custom withdrawal blend by age window"
                style={{
                  fontSize: 13, fontWeight: 600,
                  padding: '7px 14px',
                  borderRadius: 999,
                  border: hasCustom && pendingGoal === null ? '2px solid var(--gold)' : '1px solid var(--border-light)',
                  background: hasCustom && pendingGoal === null ? 'rgba(201,168,76,0.08)' : 'var(--bg-surface, #fff)',
                  color: hasCustom && pendingGoal === null ? '#7a5c10' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >Custom</button>
            </div>
            <button
              onClick={() => !hasCustom && setSheetMode('conversion')}
              disabled={hasCustom}
              style={{
                fontSize: 12, fontWeight: 600,
                padding: '5px 10px',
                border: 'none', background: 'transparent',
                color: hasCustom ? 'var(--text-muted)' : 'var(--gold)',
                cursor: hasCustom ? 'default' : 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                opacity: hasCustom ? 0.45 : 1,
              }}
              title={hasCustom ? 'Overridden by Conv $/yr in your custom blend' : 'Configure Roth conversion mode'}
            >⚙ Roth Conversion Mode</button>
          </div>

        </div>
      </div>

      <StrategyCustomizeSheet open={sheetMode !== null} mode={sheetMode ?? 'blend'} onClose={() => setSheetMode(null)} />
    </>
  );
}
