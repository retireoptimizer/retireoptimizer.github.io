export default function MonteCarlo() {
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Analysis</div>
            <div className="page-title">Monte Carlo Simulation</div>
            <div className="page-subtitle">Stochastic returns · probability of success across thousands of market scenarios</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-gold">▶ Run Simulation</button>
          </div>
        </div>
      </div>
      <div className="page-body">

        {/* KPI Metrics */}
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">Probability of Success</div>
            <div className="metric-value">—</div>
            <div className="metric-sub">Click Run Simulation</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Median Final Portfolio</div>
            <div className="metric-value">—</div>
            <div className="metric-sub">Age 95 · 50th percentile</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">10th Percentile Outcome</div>
            <div className="metric-value">—</div>
            <div className="metric-sub">Age 95 · adverse scenario</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">90th Percentile Outcome</div>
            <div className="metric-value">—</div>
            <div className="metric-sub">Age 95 · favorable scenario</div>
          </div>
        </div>

        {/* Fan chart */}
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Portfolio Distribution — 0 Simulations</div>
            <span className="badge badge-neutral">Idle</span>
          </div>
          <div className="panel-body">
            <div style={{ position: 'relative', height: '300px' }}><canvas></canvas></div>
            <div className="mc-band-legend" style={{ marginTop: '16px' }}>
              <div className="mc-band"><div className="mc-band-color" style={{ background: 'rgba(26,138,90,0.15)' }}></div>10th–90th percentile band</div>
              <div className="mc-band"><div className="mc-band-color" style={{ background: 'rgba(26,138,90,0.35)' }}></div>25th–75th percentile band</div>
              <div className="mc-band"><div className="mc-band-color" style={{ background: '#1a8a5a' }}></div>Median (50th %ile)</div>
              <div className="mc-band"><div className="mc-band-color" style={{ background: '#c9a84c', border: '1px dashed' }}></div>Deterministic projection</div>
              <div className="mc-band"><div className="mc-band-color" style={{ background: '#c0392b', opacity: 0.5 }}></div>Ruin threshold ($0)</div>
            </div>
          </div>
        </div>

        {/* Inputs + Stress Scenarios */}
        <div className="three-col" style={{ marginTop: '20px' }}>
          <div className="panel">
            <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Stress Scenarios</div></div>
            <div className="panel-body" style={{ padding: '0' }}>
              <table className="data-table">
                <thead><tr><th>Scenario</th><th style={{ textAlign: 'right' }}>Success</th></tr></thead>
                <tbody>
                  <tr><td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>Run simulation to populate</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="panel" style={{ gridColumn: '2/4' }}>
            <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Simulation Inputs</div></div>
            <div className="panel-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Number of Trials</label>
                  <input type="number" defaultValue={1000} min={100} max={5000} step={100} />
                </div>
                <div className="form-group">
                  <label>Plan Horizon (Age A)</label>
                  <input type="number" defaultValue={95} min={80} max={115} />
                </div>
                <div className="form-group">
                  <label>Pre-Retire Return Mean %</label>
                  <input type="number" defaultValue={7.0} step={0.5} />
                </div>
                <div className="form-group">
                  <label>Pre-Retire Std Dev %</label>
                  <input type="number" defaultValue={15.0} step={0.5} />
                </div>
                <div className="form-group">
                  <label>Post-Retire Return Mean %</label>
                  <input type="number" defaultValue={5.5} step={0.5} />
                </div>
                <div className="form-group">
                  <label>Post-Retire Std Dev %</label>
                  <input type="number" defaultValue={10.0} step={0.5} />
                </div>
                <div className="form-group">
                  <label>Inflation Mean %</label>
                  <input type="number" defaultValue={2.5} step={0.25} />
                </div>
                <div className="form-group">
                  <label>Inflation Std Dev %</label>
                  <input type="number" defaultValue={1.2} step={0.25} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
