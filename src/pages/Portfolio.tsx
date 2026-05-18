export default function Portfolio() {
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
            <button className="btn btn-ghost">Reset Defaults</button>
            <button className="btn btn-gold">Apply &amp; Re-Run</button>
          </div>
        </div>
      </div>
      <div className="page-body">
        {/* Live summary metrics */}
        <div className="metrics-grid" style={{ marginBottom: '24px' }}>
          <div className="metric-card positive">
            <div className="metric-label">Total Portfolio Value</div>
            <div className="metric-value">$2.08<span className="metric-unit">M</span></div>
            <div className="metric-sub">All three buckets</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Pre-Tax (Traditional)</div>
            <div className="metric-value">$885<span className="metric-unit">K</span></div>
            <div className="metric-sub">42% of total</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">After-Tax (Roth + Taxable)</div>
            <div className="metric-value">$1.20<span className="metric-unit">M</span></div>
            <div className="metric-sub">58% of total</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Annual Contributions</div>
            <div className="metric-value">$100<span className="metric-unit">K</span></div>
            <div className="metric-sub">Person A + Person B</div>
          </div>
        </div>

        <div className="two-col">
          {/* Left: Bucket Balances (editable) */}
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
                    <div className="input-prefix-wrap">
                      <span className="input-prefix">$</span>
                      <input type="number" defaultValue={585000} />
                    </div>
                    <div className="helper-text">After-tax money · gains taxed at LTCG rate on withdrawal</div>
                  </div>
                  <div className="form-group">
                    <label>Traditional (401k / IRA)</label>
                    <div className="input-prefix-wrap">
                      <span className="input-prefix">$</span>
                      <input type="number" defaultValue={885000} />
                    </div>
                    <div className="helper-text">Pre-tax · fully taxable on withdrawal · RMDs at age 75</div>
                  </div>
                  <div className="form-group">
                    <label>Roth (IRA / Roth 401k)</label>
                    <div className="input-prefix-wrap">
                      <span className="input-prefix">$</span>
                      <input type="number" defaultValue={612000} />
                    </div>
                    <div className="helper-text">After-tax · tax-free growth &amp; withdrawals · no RMDs</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bucket allocation bar (live) */}
            <div className="panel">
              <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Bucket Mix</div></div>
              <div className="panel-body">
                <div className="alloc-bar">
                  <div className="alloc-seg" style={{ flex: 42, background: '#0d1b2e' }}></div>
                  <div className="alloc-seg" style={{ flex: 29, background: '#c9a84c' }}></div>
                  <div className="alloc-seg" style={{ flex: 29, background: '#1a8a5a' }}></div>
                </div>
                <div className="chart-legend" style={{ marginTop: '12px' }}>
                  <div className="legend-item"><div className="legend-dot" style={{ background: '#0d1b2e' }}></div><span>Traditional 42%</span></div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: '#c9a84c' }}></div><span>Roth 29%</span></div>
                  <div className="legend-item"><div className="legend-dot" style={{ background: '#1a8a5a' }}></div><span>Taxable 29%</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Contributions & Allocation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="panel">
              <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Annual Contributions</div></div>
              <div className="panel-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Person A — Annual Contribution</label>
                    <div className="input-prefix-wrap">
                      <span className="input-prefix">$</span>
                      <input type="number" defaultValue={60000} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Person B — Annual Contribution</label>
                    <div className="input-prefix-wrap">
                      <span className="input-prefix">$</span>
                      <input type="number" defaultValue={40000} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Contribution Growth Rate</label>
                    <div className="input-suffix-wrap">
                      <input type="number" defaultValue={2.5} step={0.1} />
                      <span className="input-suffix">%</span>
                    </div>
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
                    <div className="input-suffix-wrap">
                      <input type="number" defaultValue={20} min={0} max={100} />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>→ Traditional %</label>
                    <div className="input-suffix-wrap">
                      <input type="number" defaultValue={40} min={0} max={100} />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>→ Roth %</label>
                    <div className="input-suffix-wrap">
                      <input type="number" defaultValue={40} min={0} max={100} />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '12px', marginTop: '8px', display: 'none', color: 'var(--danger)' }}>⚠ Allocation must sum to 100%</div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Return &amp; Inflation</div></div>
              <div className="panel-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>Return — Accumulation</label>
                    <div className="input-suffix-wrap">
                      <input type="number" defaultValue={7.0} step={0.1} />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Return — Retirement</label>
                    <div className="input-suffix-wrap">
                      <input type="number" defaultValue={5.0} step={0.1} />
                      <span className="input-suffix">%</span>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Inflation Rate</label>
                    <div className="input-suffix-wrap">
                      <input type="number" defaultValue={2.5} step={0.1} />
                      <span className="input-suffix">%</span>
                    </div>
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
