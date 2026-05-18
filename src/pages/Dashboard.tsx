import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Retirement Plan</div>
            <div className="page-title">My Retirement Overview</div>
            <div className="page-subtitle">Age — · Target retirement: —</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/projections')}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2" strokeWidth="2"/>
              </svg>
              Run Projections
            </button>
            <button className="btn btn-gold">+ New Scenario</button>
          </div>
        </div>
      </div>
      <div className="page-body">

        {/* Metrics Row */}
        <div className="metrics-grid">
          <div className="metric-card positive">
            <div className="metric-label">Projected Portfolio at 65</div>
            <div className="metric-value">$4.2<span className="metric-unit">M</span></div>
            <div className="metric-delta up">↑ On track</div>
            <div className="metric-sub">vs $3.8M target · Today's $</div>
          </div>
          <div className="metric-card positive">
            <div className="metric-label">Safe Withdrawal Rate</div>
            <div className="metric-value">3.8<span className="metric-unit">%</span></div>
            <div className="metric-delta up">Below 4% threshold</div>
            <div className="metric-sub">$159K/yr sustainable income</div>
          </div>
          <div className="metric-card warning">
            <div className="metric-label">Plan Longevity</div>
            <div className="metric-value">Age<span className="metric-unit"> </span>94</div>
            <div className="metric-delta neutral">1yr buffer at plan end</div>
            <div className="metric-sub">Plan horizon: age 95</div>
          </div>
          <div className="metric-card warning">
            <div className="metric-label">Roth Conversion Opportunity</div>
            <div className="metric-value">$42<span className="metric-unit">K</span></div>
            <div className="metric-delta neutral">12% bracket headroom</div>
            <div className="metric-sub">2025 · before RMDs begin</div>
          </div>
        </div>

        {/* Charts + Insights */}
        <div className="two-col">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Portfolio Trajectory</div>
              <div className="panel-actions">
                <div className="toggle-group" style={{ width: 180 }}>
                  <button className="toggle-opt active">Nominal $</button>
                  <button className="toggle-opt">Today's $</button>
                </div>
              </div>
            </div>
            <div className="panel-body">
              <div style={{ position: 'relative', height: 140 }}><canvas></canvas></div>
              <div className="chart-legend">
                <div className="legend-item"><div className="legend-dot" style={{ background: '#c9a84c' }}></div>With Roth Conv.</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: '#e8e0d0' }}></div>No Roth Conv.</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'rgba(26,138,90,0.3)', border: '1px dashed #1a8a5a' }}></div>Plan Target</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Plan Health Score</div>
              <span className="badge badge-success">Strong</span>
            </div>
            <div className="panel-body" style={{ paddingTop: 12 }}>
              <div className="health-gauge-wrap">
                <svg className="gauge-arc" width="160" height="90" viewBox="0 0 160 90">
                  <path d="M 15 85 A 65 65 0 0 1 145 85" fill="none" stroke="rgba(13,27,46,0.08)" strokeWidth="12" strokeLinecap="round"/>
                  <path d="M 15 85 A 65 65 0 0 1 145 85" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray="204" strokeDashoffset="27"/>
                  <defs>
                    <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#c9a84c"/>
                      <stop offset="60%" stopColor="#1a8a5a"/>
                    </linearGradient>
                  </defs>
                </svg>
                <div className="health-score">87</div>
                <div className="health-label">Very Strong Plan</div>
                <div className="health-sub">Top 18% of client plans</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
                <div style={{ padding: '10px 12px', background: 'var(--success-light)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Longevity</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: 'var(--success)' }}>94/100</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--warning-light)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Tax Efficiency</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: 'var(--warning)' }}>72/100</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'rgba(201,168,76,0.08)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#7a5c10', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Sequence Risk</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: '#7a5c10' }}>81/100</div>
                </div>
                <div style={{ padding: '10px 12px', background: 'var(--success-light)', borderRadius: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Goal Coverage</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: 'var(--success)' }}>91/100</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Income Sources + Insights */}
        <div className="two-col">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Retirement Income Sources (Age 65)</div>
            </div>
            <div className="panel-body">
              <div style={{ position: 'relative', height: 220 }}><canvas></canvas></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 20 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 4 }}>Portfolio WD</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>$88K</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>55%</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 4 }}>Social Security</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>$60K</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>38%</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 4 }}>Other Income</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>$11K</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>7%</div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Key Insights</div>
            </div>
            <div className="panel-body">
              <div className="insight-card success">
                <div className="insight-icon">✓</div>
                <div className="insight-content">
                  <div className="insight-title">Plan fully funded through age 94</div>
                  <div className="insight-body">Portfolio sustains $159K real spending with no shortfall in the base case.</div>
                </div>
              </div>
              <div className="insight-card warning">
                <div className="insight-icon">⚡</div>
                <div className="insight-content">
                  <div className="insight-title">$42K Roth conversion opportunity</div>
                  <div className="insight-body">Converting to top of 12% bracket before RMDs reduces lifetime tax by est. $31K.</div>
                </div>
              </div>
              <div className="insight-card warning">
                <div className="insight-icon">⚕</div>
                <div className="insight-content">
                  <div className="insight-title">IRMAA exposure at age 67–69</div>
                  <div className="insight-body">Projected MAGI of $206K exceeds Tier 1 threshold. Optimize Roth conversions to stay below.</div>
                </div>
              </div>
              <div className="insight-card info">
                <div className="insight-icon">💡</div>
                <div className="insight-content">
                  <div className="insight-title">SS delay increases lifetime benefit</div>
                  <div className="insight-body">Delaying SS to age 70 increases lifetime benefit by est. $87K in today's $.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Goal Tracker */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Goal Tracker</div>
            <button className="btn btn-outline">+ Add Goal</button>
          </div>
          <div className="panel-body" style={{ padding: '0 24px' }}>
            <div className="goal-item">
              <div>
                <div className="goal-name">Retire at 65 with $4M Portfolio</div>
                <div className="goal-detail">Projected: $4.2M · 105% funded</div>
              </div>
              <span className="badge badge-success">On Track</span>
              <div className="goal-bar-wrap"><div className="goal-bar-bg"><div className="goal-bar-fill on-track" style={{ width: '100%' }}></div></div></div>
            </div>
            <div className="goal-item">
              <div>
                <div className="goal-name">Fund College for 2 Children</div>
                <div className="goal-detail">$320K needed · $195K saved · 2028 &amp; 2030</div>
              </div>
              <span className="badge badge-warning">At Risk</span>
              <div className="goal-bar-wrap"><div className="goal-bar-bg"><div className="goal-bar-fill at-risk" style={{ width: '61%' }}></div></div></div>
            </div>
            <div className="goal-item">
              <div>
                <div className="goal-name">Purchase Beach Home (2030)</div>
                <div className="goal-detail">$650K · $410K saved · 5yr horizon</div>
              </div>
              <span className="badge badge-warning">At Risk</span>
              <div className="goal-bar-wrap"><div className="goal-bar-bg"><div className="goal-bar-fill at-risk" style={{ width: '63%' }}></div></div></div>
            </div>
            <div className="goal-item">
              <div>
                <div className="goal-name">Estate Transfer Goal</div>
                <div className="goal-detail">$500K bequest · Projected: $780K at age 90</div>
              </div>
              <span className="badge badge-success">On Track</span>
              <div className="goal-bar-wrap"><div className="goal-bar-bg"><div className="goal-bar-fill on-track" style={{ width: '100%' }}></div></div></div>
            </div>
          </div>
        </div>

        {/* Bucket Composition */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Bucket Composition Over Time</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stacked area · How Taxable / Traditional / Roth evolve year by year</span>
          </div>
          <div className="panel-body">
            <div style={{ position: 'relative', height: 200 }}><canvas></canvas></div>
            <div className="chart-legend" style={{ marginTop: 12 }}>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#1a8a5a' }}></div>Taxable</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#b8620a' }}></div>Traditional (Pre-Tax)</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#c9a84c' }}></div>Roth</div>
            </div>
          </div>
        </div>

        {/* Annual Cash Flows */}
        <div className="two-col" style={{ marginBottom: 20 }}>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Annual Cash Inflows</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Contributions · SS · Portfolio withdrawals</span>
            </div>
            <div className="panel-body">
              <div style={{ position: 'relative', height: 200 }}><canvas></canvas></div>
              <div className="chart-legend" style={{ marginTop: 10 }}>
                <div className="legend-item"><div className="legend-dot" style={{ background: '#c9a84c' }}></div>Contributions</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: '#1a8a5a' }}></div>Social Security</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: '#3b5e8a' }}></div>Portfolio Withdrawals</div>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Annual Cash Outflows</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Spending · Federal taxes · RMDs paid out</span>
            </div>
            <div className="panel-body">
              <div style={{ position: 'relative', height: 200 }}><canvas></canvas></div>
              <div className="chart-legend" style={{ marginTop: 10 }}>
                <div className="legend-item"><div className="legend-dot" style={{ background: '#c0392b' }}></div>Net Spending</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: '#b8620a' }}></div>Federal Taxes</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: '#7a96b0' }}></div>RMDs (reinvested/spent)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tax Drag */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Tax Drag Analysis</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Annual federal tax paid (bars) · Effective rate on taxable income (line)</span>
          </div>
          <div className="panel-body">
            <div style={{ position: 'relative', height: 200 }}><canvas></canvas></div>
            <div className="chart-legend" style={{ marginTop: 10 }}>
              <div className="legend-item"><div className="legend-dot" style={{ background: 'rgba(192,57,43,0.6)' }}></div>Federal Tax Paid ($)</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#c9a84c', borderRadius: 0, height: 2, width: 16 }}></div>Effective Rate (%)</div>
            </div>
          </div>
        </div>

        {/* Roth Conversions vs RMDs */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Roth Conversions vs RMDs</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Conversions concentrated in pre-RMD window · RMDs reduced as a result</span>
          </div>
          <div className="panel-body">
            <div style={{ position: 'relative', height: 200 }}><canvas></canvas></div>
            <div className="chart-legend" style={{ marginTop: 10 }}>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#3b5e8a' }}></div>Roth Conversion</div>
              <div className="legend-item"><div className="legend-dot" style={{ background: '#b8620a' }}></div>RMD Required</div>
            </div>
          </div>
        </div>

        {/* Scenario Comparison */}
        <div className="two-col" style={{ marginBottom: 20 }}>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Cumulative Tax: With vs Without Conversions</div>
            </div>
            <div className="panel-body">
              <div style={{ position: 'relative', height: 200 }}><canvas></canvas></div>
              <div className="chart-legend" style={{ marginTop: 10 }}>
                <div className="legend-item"><div className="legend-dot" style={{ background: '#c9a84c' }}></div>With Roth Conversions</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: '#7a96b0' }}></div>No Conversions</div>
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Portfolio Balance Comparison</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>With vs without conversions</span>
            </div>
            <div className="panel-body">
              <div style={{ position: 'relative', height: 200 }}><canvas></canvas></div>
              <div className="chart-legend" style={{ marginTop: 10 }}>
                <div className="legend-item"><div className="legend-dot" style={{ background: '#c9a84c' }}></div>With Conversions</div>
                <div className="legend-item"><div className="legend-dot" style={{ background: 'rgba(122,150,176,0.7)' }}></div>No Conversions</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
