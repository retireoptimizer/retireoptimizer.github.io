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
  const splitPct = Math.round((split.taxable + split.traditional + split.roth) * 100);

  // All three bucket %s are editable. Editing one rebalances the other two
  // proportionally so the mix always sums to 100% — the engine multiplies each
  // contribution by these fractions, so a sum ≠ 1 would silently under/over-invest.
  const setBucket = (key: keyof typeof split, val: number) => {
    const v = Math.max(0, Math.min(1, val));
    const [o1, o2] = (['taxable', 'traditional', 'roth'] as const).filter((k) => k !== key);
    const rem = 1 - v;
    const osum = split[o1] + split[o2];
    const n1 = osum > 0 ? rem * (split[o1] / osum) : rem / 2;
    const next = { ...split };
    next[key] = v;
    next[o1] = n1;
    next[o2] = rem - n1;
    onChange({ contribSplit: next });
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title"><div className="panel-title-dot"></div>{name}</div>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Subtotal: {fmtK(subtotal)}</span>
      </div>
      <div className="panel-body">
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 8 }}>Bucket Balances</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <div className="form-group">
            <label>Taxable</label>
            <div className="input-prefix-wrap"><span className="input-prefix">$</span>
              <NumberInput value={data.taxable} min={0} style={{ paddingLeft: 22 }} onCommit={(v) => onChange({ taxable: v })} />
            </div>
            <div className="helper-text">Brokerage</div>
          </div>
          <div className="form-group">
            <label>Pre-tax</label>
            <div className="input-prefix-wrap"><span className="input-prefix">$</span>
              <NumberInput value={data.traditional} min={0} style={{ paddingLeft: 22 }} onCommit={(v) => onChange({ traditional: v })} />
            </div>
            <div className="helper-text">401(k) / IRA</div>
          </div>
          <div className="form-group">
            <label>Roth</label>
            <div className="input-prefix-wrap"><span className="input-prefix">$</span>
              <NumberInput value={data.roth} min={0} style={{ paddingLeft: 22 }} onCommit={(v) => onChange({ roth: v })} />
            </div>
            <div className="helper-text">IRA / Roth 401k</div>
          </div>
        </div>

        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginTop: 18, marginBottom: 8 }}>Annual Contribution</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="form-group">
            <label>Total Contribution / yr</label>
            <div className="input-prefix-wrap"><span className="input-prefix">$</span>
              <NumberInput value={data.annualContribution} min={0} style={{ paddingLeft: 22 }} onCommit={(v) => onChange({ annualContribution: v })} />
            </div>
          </div>
          <div className="form-group">
            <label>Annual growth</label>
            <div className="input-suffix-wrap">
              <NumberInput value={data.contribGrowth} scale={100} digits={1} min={0} onCommit={(v) => onChange({ contribGrowth: v })} />
              <span className="input-suffix">%</span>
            </div>
            <div className="helper-text">Raises while still working</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Contribution Mix</div>
          <span style={{ fontSize: 11, fontWeight: 700, color: splitPct === 100 ? 'var(--success)' : 'var(--warning)' }}>
            {splitPct === 100 ? '✓ 100%' : `⚠ ${splitPct}%`}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <div className="form-group">
            <label>Taxable</label>
            <div className="input-suffix-wrap">
              <NumberInput value={split.taxable} scale={100} digits={0} min={0} max={100} onCommit={(v) => setBucket('taxable', v)} />
              <span className="input-suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label>Pre-tax</label>
            <div className="input-suffix-wrap">
              <NumberInput value={split.traditional} scale={100} digits={0} min={0} max={100} onCommit={(v) => setBucket('traditional', v)} />
              <span className="input-suffix">%</span>
            </div>
          </div>
          <div className="form-group">
            <label>Roth</label>
            <div className="input-suffix-wrap">
              <NumberInput value={split.roth} scale={100} digits={0} min={0} max={100} onCommit={(v) => setBucket('roth', v)} />
              <span className="input-suffix">%</span>
            </div>
          </div>
        </div>
        <div className="helper-text" style={{ marginTop: 6 }}>Editing one bucket rebalances the others to total 100%.</div>
      </div>
    </div>
  );
}

export default function Portfolio() {
  const plan = usePlanStore((s) => s.plan);
  const setPersonAPortfolio = usePlanStore((s) => s.setPersonAPortfolio);
  const setPersonBPortfolio = usePlanStore((s) => s.setPersonBPortfolio);

  const pf = plan.portfolio;
  const totals = householdTotals(pf);
  const total = totals.taxable + totals.traditional + totals.roth;
  const tradPct = total > 0 ? Math.round(totals.traditional / total * 100) : 0;
  const totalContrib = totals.contribA + totals.contribB;
  const nameA = plan.personA.name;
  const nameB = plan.personB?.name ?? 'Person B';

  return (
    <div className="page">
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
