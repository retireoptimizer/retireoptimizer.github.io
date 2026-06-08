import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlanStore } from '../store/usePlanStore';
import { STRATEGIES } from '../engine/strategyPresets';
import { USER_GOALS, type UserGoal } from '../engine/recommender';
import StrategyCustomizeSheet from './strategy/StrategyCustomizeSheet';

/** Dashboard's tactical strategy widget.
 *  - Row 1 (only when a customPolicy is active): Goal breadcrumb showing which
 *    optimizer goal produced the active customPolicy. Clicking a *different*
 *    goal navigates to Set Goals (?goal=…); the active goal is highlighted.
 *  - Row 2: 5 preset chips. Clicking sets `plan.withdrawalStrategy` and clears
 *    any active customPolicy. When customPolicy is active, the chip row is
 *    dimmed with a Revert pill next to it.
 *  - Customize button opens StrategyCustomizeSheet (rich Conversion Mode UI +
 *    Custom Blend editor + RothVsRmd chart). */
const GOAL_SHORT_LABELS: Record<UserGoal, string> = {
  'max-end-balance': 'Max end balance',
  'max-sustainable-spending': 'Max spending',
  'min-retirement-age': 'Earliest retire',
};

export default function StrategyChooser() {
  const navigate = useNavigate();
  const plan = usePlanStore((s) => s.plan);
  const setStrategy = usePlanStore((s) => s.setWithdrawalStrategy);
  const clearCustomPolicy = usePlanStore((s) => s.clearCustomPolicy);
  const [sheetOpen, setSheetOpen] = useState(false);

  const hasCustom = !!plan.customPolicy;
  // The Goal breadcrumb only makes sense for *optimizer-produced* custom policies.
  // Hand-edited policies (source === 'manual', set via the Custom Blend editor)
  // weren't optimized for any specific goal so the row stays hidden.
  const isOptimizerPolicy = plan.customPolicy?.source === 'optimizer';
  const activeKey = plan.withdrawalStrategy;
  const activeGoal = plan.optimizedForGoal;

  return (
    <>
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-header">
          <div className="panel-title"><div className="panel-title-dot"></div>Strategy</div>
          <button
            className="btn btn-ghost"
            onClick={() => setSheetOpen(true)}
            style={{ fontSize: 11, padding: '4px 10px' }}
            title="Open advanced controls: Roth conversion mode, custom blend editor"
          >⚙ Customize…</button>
        </div>
        <div className="panel-body" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {isOptimizerPolicy && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginRight: 4 }}>
                Optimizing for:
              </span>
              {(Object.keys(USER_GOALS) as UserGoal[]).map((key) => {
                const isActive = key === activeGoal;
                return (
                  <button
                    key={key}
                    onClick={() => navigate(`/strategy?goal=${key}`)}
                    title={USER_GOALS[key].description}
                    style={{
                      fontSize: 12, fontWeight: 600,
                      padding: '5px 10px',
                      borderRadius: 999,
                      border: isActive ? '2px solid var(--gold)' : '1px solid var(--border-light)',
                      background: isActive ? 'var(--gold)' : 'transparent',
                      color: isActive ? '#0d1b2e' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    {isActive && <span style={{ marginRight: 4 }}>✓</span>}
                    {GOAL_SHORT_LABELS[key]}
                  </button>
                );
              })}
              {!activeGoal && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  (re-apply to highlight)
                </span>
              )}
              <button
                onClick={() => navigate('/strategy')}
                style={{
                  marginLeft: 'auto',
                  fontSize: 12, fontWeight: 600,
                  padding: '5px 10px',
                  border: 'none', background: 'transparent',
                  color: 'var(--gold)', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >↗ Re-optimize</button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', opacity: hasCustom ? 0.55 : 1 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginRight: 4 }}>
              Strategy:
            </span>
            {STRATEGIES.map((s) => {
              const isActive = s.key === activeKey && !hasCustom;
              return (
                <button
                  key={s.key}
                  onClick={() => {
                    if (hasCustom) clearCustomPolicy();
                    setStrategy(s.key);
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
            {hasCustom && (
              <button
                onClick={() => clearCustomPolicy()}
                title="Drop the optimized policy and return to the selected preset above."
                style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: 'rgba(201,168,76,0.12)',
                  border: '1px solid rgba(201,168,76,0.4)',
                  color: '#7a5c10',
                  cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  opacity: 1 / 0.55, /* counteract row's opacity:0.55 so the Revert affordance is fully visible */
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold)' }} />
                Custom policy active · Revert
              </button>
            )}
          </div>
        </div>
      </div>

      <StrategyCustomizeSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
