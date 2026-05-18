import { usePlanStore } from '../store/usePlanStore';
import type { Plan } from '../schemas/plan';

interface StrategyOption {
  key: Plan['withdrawalStrategy'];
  label: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  description: string;
  tags?: { label: string; color: string }[];
}

const STRATEGIES: StrategyOption[] = [
  {
    key: 'taxfirst',
    label: 'Taxable → Traditional → Roth',
    badge: 'Classic', badgeColor: '#7a5c10', badgeBg: '#c9a84c20',
    description: 'Spend taxable brokerage first (low LTCG tax), then pre-tax, preserving Roth for last. Standard tax-efficient order for most retirees.',
    tags: [
      { label: 'Taxable 1st', color: '#0d1b2e' },
      { label: 'Traditional 2nd', color: '#0d1b2e' },
      { label: 'Roth last', color: '#0d1b2e' },
    ],
  },
  {
    key: 'rothfirst',
    label: 'Roth → Traditional → Taxable',
    badge: 'Roth-First', badgeColor: '#1a8a5a', badgeBg: '#1a8a5a20',
    description: 'Exhaust Roth first (zero tax cost). Useful when Traditional bucket is small or for specific Medicaid/benefit planning needs.',
  },
  {
    key: 'tradfirst',
    label: 'Traditional → Taxable → Roth',
    badge: 'Pre-Tax First', badgeColor: '#b8620a', badgeBg: '#b8620a20',
    description: 'Drain Traditional first to reduce future RMD exposure. Leaves Roth untouched for heirs or late-life spending. Best when large Traditional bucket creates RMD risk.',
  },
  {
    key: 'proportional',
    label: 'Proportional (all buckets each year)',
    badge: 'Blended', badgeColor: '#3b5e8a', badgeBg: '#3b5e8a20',
    description: 'Each year withdraws from all three buckets in proportion to their current balances. Keeps all accounts active, smooths tax exposure, and avoids depleting any single bucket prematurely.',
  },
  {
    key: 'bracketfill',
    label: 'Bracket-Fill (tax-aware blended)',
    badge: 'Advanced', badgeColor: '#7a5c10', badgeBg: '#7a5c1020',
    description: 'Each year: take RMDs, then fill the lowest tax bracket with Traditional withdrawals, then take remaining need from Roth or Taxable. Blends buckets dynamically to keep tax rate low every year.',
  },
];

export default function WithdrawalStrategy() {
  const currentStrategy = usePlanStore((s) => s.plan.withdrawalStrategy);
  const setStrategy = usePlanStore((s) => s.setWithdrawalStrategy);
  const activeOpt = STRATEGIES.find((s) => s.key === currentStrategy)!;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Strategy</div>
            <div className="page-title">Withdrawal Strategy</div>
            <div className="page-subtitle">Choose manually — projections update live</div>
          </div>
        </div>
      </div>
      <div className="page-body">

        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-body" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Pick a withdrawal order below. Phase 3 adds custom age-window blends and goal-directed optimization.
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Withdrawal Strategy</div>
            <span className="badge badge-neutral">{activeOpt.label}</span>
          </div>
          <div className="panel-body" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {STRATEGIES.map((opt) => {
                const active = opt.key === currentStrategy;
                return (
                  <label
                    key={opt.key}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                      borderRadius: 10,
                      border: active ? '2px solid var(--gold)' : '1px solid var(--border-light)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio" name="wd-strat"
                      checked={active}
                      onChange={() => setStrategy(opt.key)}
                      style={{ marginTop: 3, accentColor: 'var(--gold)' }}
                    />
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
      </div>
    </div>
  );
}
