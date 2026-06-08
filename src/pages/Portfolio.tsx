import { usePlanStore } from '../store/usePlanStore';
import { householdTotals } from '../schemas/plan';
import type { PersonPortfolio } from '../schemas/plan';
import { fmtM, fmtK } from '../lib/format';
import { NumberInput } from '../components/inputs/NumberInput';
import BucketDonut from '../components/charts/BucketDonut';

interface PersonPanelProps {
  name: string;
  data: PersonPortfolio;
  onChange: (patch: Partial<PersonPortfolio>) => void;
}

function PersonPanel({ name, data, onChange }: PersonPanelProps) {
  const subtotal = data.taxable + data.traditional + data.roth;
  const split = data.contribSplit;

  // 2-input model: user controls Taxable % and Pre-tax %; Roth % is the auto-computed
  // remainder. Clamp so the two free inputs never sum above 100.
  const setSplit = (tax: number, trad: number) => {
    const cleanTax = Math.max(0, Math.min(1, tax));
    let cleanTrad = Math.max(0, Math.min(1 - cleanTax, trad));
    const roth = Math.max(0, 1 - cleanTax - cleanTrad);
    // Floating-point cleanup so the three values sum to exactly 1.
    cleanTrad = 1 - cleanTax - roth;
    onChange({ contribSplit: { taxable: cleanTax, traditional: cleanTrad, roth } });
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title"><div className="panel-title-dot"></div>{name}</div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Subtotal: {fmtK(subtotal)}</span>
      </div>
      <div className="panel-body">
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 8 }}>Bucket Balances</div>
        <div className="form-grid">
          <div className="form-group">
            <label>Taxable (Brokerage)</label>
            <div className="input-prefix-wrap"><span className="input-prefix">$</span>
              <NumberInput value={data.taxable} min={0} style={{ paddingLeft: 22 }} onCommit={(v) => onChange({ taxable: v })} />
            </div>
          </div>
          <div className="form-group">
            <label>Pre-tax 401(k) / IRA</label>
            <div className="input-prefix-wrap"><span className="input-prefix">$</span>
              <NumberInput value={data.traditional} min={0} style={{ paddingLeft: 22 }} onCommit={(v) => onChange({ traditional: v })} />
            </div>
          </div>
          <div className="form-group">
            <label>Roth (IRA / Roth 401k)</label>
            <div className="input-prefix-wrap"><span className="input-prefix">$</span>
              <NumberInput value={data.roth} min={0} style={{ paddingLeft: 22 }} onCommit={(v) => onChange({ roth: v })} />
            </div>
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginTop: 18, marginBottom: 8 }}>Annual Contribution</div>
        <div className="form-group">
          <label>Total Contribution / yr</label>
          <div className="input-prefix-wrap"><span className="input-prefix">$</span>
            <NumberInput value={data.annualContribution} min={0} style={{ paddingLeft: 22 }} onCommit={(v) => onChange({ annualContribution: v })} />
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginTop: 18, marginBottom: 8 }}>Contribution Mix</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group">
            <label>→ Taxable %</label>
            <div className="input-suffix-wrap">
              <NumberInput value={split.taxable} scale={100} digits={0} min={0} max={100} onCommit={(v) => setSplit(v, split.traditional)} />
              <span className="input-suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label>→ Pre-tax %</label>
            <div className="input-suffix-wrap">
              <NumberInput value={split.traditional} scale={100} digits={0} min={0} max={100} onCommit={(v) => setSplit(split.taxable, v)} />
              <span className="input-suffix">%</span>
            </div>
          </div>
        </div>
        {/* Roth is the auto-computed remainder, shown as a non-editable bar so users can see what's left. */}
        <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>→ Roth (auto)</span>
          <div style={{ flex: 1, height: 6, background: 'rgba(13,27,46,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(split.roth * 100)}%`, height: '100%', background: 'var(--gold)' }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold)', fontFamily: "'DM Mono', monospace", minWidth: 44, textAlign: 'right' }}>
            {Math.round(split.roth * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export default function Portfolio() {
  const plan = usePlanStore((s) => s.plan);
  const setPersonAPortfolio = usePlanStore((s) => s.setPersonAPortfolio);
  const setPersonBPortfolio = usePlanStore((s) => s.setPersonBPortfolio);
  const resetPlan = usePlanStore((s) => s.resetPlan);

  const pf = plan.portfolio;
  const totals = householdTotals(pf);
  const total = totals.taxable + totals.traditional + totals.roth;
  const tradPct = total > 0 ? Math.round(totals.traditional / total * 100) : 0;
  const totalContrib = totals.contribA + totals.contribB;
  const nameA = plan.personA.name;
  const nameB = plan.personB?.name ?? 'Person B';

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Inputs</div>
            <div className="page-title">Portfolio</div>
            <div className="page-subtitle">Per-person balances, contributions &amp; mix — projections update live</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost" onClick={resetPlan}>Reset Defaults</button>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="metrics-grid" style={{ marginBottom: '24px' }}>
          <div className="metric-card positive">
            <div className="metric-label">Total Portfolio Value</div>
            <div className="metric-value">{fmtM(total)}</div>
            <div className="metric-sub">All three buckets · household</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Pre-tax 401(k)/IRA</div>
            <div className="metric-value">{fmtK(totals.traditional)}</div>
            <div className="metric-sub">{tradPct}% of total</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">After-Tax (Roth + Taxable)</div>
            <div className="metric-value">{fmtK(totals.roth + totals.taxable)}</div>
            <div className="metric-sub">{100 - tradPct}% of total</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Annual Contributions</div>
            <div className="metric-value">{fmtK(totalContrib)}</div>
            <div className="metric-sub">{nameA} + {nameB}</div>
          </div>
        </div>

        <div className="two-col" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <PersonPanel name={nameA} data={pf.personA} onChange={setPersonAPortfolio} />
          {pf.personB ? (
            <PersonPanel name={nameB} data={pf.personB} onChange={setPersonBPortfolio} />
          ) : (
            <div className="panel">
              <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>{nameB}</div></div>
              <div className="panel-body" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                No second person on this plan.
              </div>
            </div>
          )}
        </div>

        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Household Bucket Mix</div></div>
          <div className="panel-body">
            <BucketDonut taxable={totals.taxable} traditional={totals.traditional} roth={totals.roth} height={220} />
          </div>
        </div>
      </div>
    </div>
  );
}
