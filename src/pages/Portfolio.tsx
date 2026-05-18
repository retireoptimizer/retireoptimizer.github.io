import { usePlanStore } from '../store/usePlanStore';
import { fmtM, fmtK } from '../lib/format';

export default function Portfolio() {
  const plan = usePlanStore((s) => s.plan);
  const setPortfolio = usePlanStore((s) => s.setPortfolio);
  const setAssumptions = usePlanStore((s) => s.setAssumptions);
  const resetPlan = usePlanStore((s) => s.resetPlan);

  const p = plan.portfolio;
  const total = p.taxable + p.traditional + p.roth;
  const tradPct = total > 0 ? Math.round(p.traditional / total * 100) : 0;
  const rothPct = total > 0 ? Math.round(p.roth / total * 100) : 0;
  const taxPct = total > 0 ? Math.round(p.taxable / total * 100) : 0;
  const totalContrib = p.contribA + p.contribB;
  const allocSum = p.splitTaxable + p.splitTraditional + p.splitRoth;
  const allocBad = Math.abs(allocSum - 1) > 0.001;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Inputs</div>
            <div className="page-title">Portfolio</div>
            <div className="page-subtitle">Edit balances, allocations &amp; contributions — projections update live</div>
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
            <div className="metric-sub">All three buckets</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Pre-Tax (Traditional)</div>
            <div className="metric-value">{fmtK(p.traditional)}</div>
            <div className="metric-sub">{tradPct}% of total</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">After-Tax (Roth + Taxable)</div>
            <div className="metric-value">{fmtK(p.roth + p.taxable)}</div>
            <div className="metric-sub">{100 - tradPct}% of total</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Annual Contributions</div>
            <div className="metric-value">{fmtK(totalContrib)}</div>
            <div className="metric-sub">Person A + Person B</div>
          </div>
        </div>

        <div className="two-col">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title"><div className="panel-title-dot"></div>Bucket Balances</div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Combined household · today's $</span>
              </div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Taxable (Brokerage)</label>
                    <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" value={p.taxable} style={{ paddingLeft: 22 }} onChange={(e) => setPortfolio({ taxable: parseFloat(e.target.value) || 0 })} /></div>
                    <div className="helper-text">After-tax money · gains taxed at LTCG rate on withdrawal</div>
                  </div>
                  <div className="form-group">
                    <label>Traditional (401k / IRA)</label>
                    <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" value={p.traditional} style={{ paddingLeft: 22 }} onChange={(e) => setPortfolio({ traditional: parseFloat(e.target.value) || 0 })} /></div>
                    <div className="helper-text">Pre-tax · fully taxable on withdrawal · RMDs at age 75</div>
                  </div>
                  <div className="form-group">
                    <label>Roth (IRA / Roth 401k)</label>
                    <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" value={p.roth} style={{ paddingLeft: 22 }} onChange={(e) => setPortfolio({ roth: parseFloat(e.target.value) || 0 })} /></div>
                    <div className="helper-text">After-tax · tax-free growth &amp; withdrawals · no RMDs</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Bucket Mix</div></div>
              <div className="panel-body">
                <div className="alloc-bar">
                  <div className="alloc-seg" style={{ flex: tradPct, background: '#0d1b2e' }}></div>
                  <div className="alloc-seg" style={{ flex: rothPct, background: '#c9a84c' }}></div>
                  <div className="alloc-seg" style={{ flex: taxPct, background: '#1a8a5a' }}></div>
                </div>
                <div className="chart-legend" style={{ marginTop: '12px' }}>
                  <div className="legend-item"><div className="legend-dot" style={{ background: '#0d1b2e' }}></div><span>Traditional {tradPct}%</span></div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: '#c9a84c' }}></div><span>Roth {rothPct}%</span></div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: '#1a8a5a' }}></div><span>Taxable {taxPct}%</span></div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="panel">
              <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Annual Contributions</div></div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Person A — Annual Contribution</label>
                    <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" value={p.contribA} style={{ paddingLeft: 22 }} onChange={(e) => setPortfolio({ contribA: parseFloat(e.target.value) || 0 })} /></div>
                  </div>
                  <div className="form-group">
                    <label>Person B — Annual Contribution</label>
                    <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" value={p.contribB} style={{ paddingLeft: 22 }} onChange={(e) => setPortfolio({ contribB: parseFloat(e.target.value) || 0 })} /></div>
                  </div>
                  <div className="form-group">
                    <label>Contribution Growth Rate</label>
                    <div className="input-suffix-wrap"><input type="number" step="0.1" value={(plan.assumptions.contribGrowth * 100).toFixed(1)} onChange={(e) => setAssumptions({ contribGrowth: (parseFloat(e.target.value) || 0) / 100 })} /><span className="input-suffix">%</span></div>
                    <div className="helper-text">NOMINAL rate · set = inflation for real-constant contributions</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Contribution Allocation</div></div>
              <div className="panel-body">
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>How each year's contribution splits across buckets (must sum to 100%)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>→ Taxable %</label>
                    <div className="input-suffix-wrap"><input type="number" min={0} max={100} value={Math.round(p.splitTaxable * 100)} onChange={(e) => setPortfolio({ splitTaxable: (parseFloat(e.target.value) || 0) / 100 })} /><span className="input-suffix">%</span></div>
                  </div>
                  <div className="form-group">
                    <label>→ Traditional %</label>
                    <div className="input-suffix-wrap"><input type="number" min={0} max={100} value={Math.round(p.splitTraditional * 100)} onChange={(e) => setPortfolio({ splitTraditional: (parseFloat(e.target.value) || 0) / 100 })} /><span className="input-suffix">%</span></div>
                  </div>
                  <div className="form-group">
                    <label>→ Roth %</label>
                    <div className="input-suffix-wrap"><input type="number" min={0} max={100} value={Math.round(p.splitRoth * 100)} onChange={(e) => setPortfolio({ splitRoth: (parseFloat(e.target.value) || 0) / 100 })} /><span className="input-suffix">%</span></div>
                  </div>
                </div>
                {allocBad && <div style={{ fontSize: '12px', marginTop: '8px', color: 'var(--danger)' }}>⚠ Allocation must sum to 100% (currently {Math.round(allocSum * 100)}%)</div>}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Return &amp; Inflation</div></div>
              <div className="panel-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Return — Accumulation</label>
                    <div className="input-suffix-wrap"><input type="number" step="0.1" value={(plan.assumptions.preRetReturn * 100).toFixed(1)} onChange={(e) => setAssumptions({ preRetReturn: (parseFloat(e.target.value) || 0) / 100 })} /><span className="input-suffix">%</span></div>
                  </div>
                  <div className="form-group">
                    <label>Return — Retirement</label>
                    <div className="input-suffix-wrap"><input type="number" step="0.1" value={(plan.assumptions.postRetReturn * 100).toFixed(1)} onChange={(e) => setAssumptions({ postRetReturn: (parseFloat(e.target.value) || 0) / 100 })} /><span className="input-suffix">%</span></div>
                  </div>
                  <div className="form-group">
                    <label>Inflation Rate</label>
                    <div className="input-suffix-wrap"><input type="number" step="0.1" value={(plan.assumptions.inflation * 100).toFixed(1)} onChange={(e) => setAssumptions({ inflation: (parseFloat(e.target.value) || 0) / 100 })} /><span className="input-suffix">%</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
