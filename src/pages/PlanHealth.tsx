export default function PlanHealth() {
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Overview</div>
            <div className="page-title">Plan Health Report</div>
            <div className="page-subtitle">Comprehensive plan assessment · Advisor summary</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost">Export PDF</button>
            <button className="btn btn-gold">Send to Client</button>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="two-col">
          <div className="panel">
            <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Overall Health Score</div></div>
            <div className="panel-body">
              <div className="health-gauge-wrap">
                <svg className="gauge-arc" width="200" height="110" viewBox="0 0 200 110">
                  <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(13,27,46,0.08)" strokeWidth="16" strokeLinecap="round" />
                  <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGrad2)" strokeWidth="16" strokeLinecap="round" strokeDasharray="251" strokeDashoffset="32" />
                  <defs>
                    <linearGradient id="gaugeGrad2" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#c0392b" />
                      <stop offset="30%" stopColor="#c9a84c" />
                      <stop offset="70%" stopColor="#1a8a5a" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="health-score" style={{ fontSize: '64px' }}>87</div>
                <div className="health-label" style={{ fontSize: '16px' }}>Very Strong Plan</div>
                <div className="health-sub" style={{ fontSize: '13px', maxWidth: '300px' }}>The Johnson-Barfield retirement plan is well-funded, tax-efficient, and on track to meet all primary goals with meaningful margin.</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="panel">
              <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Score Breakdown</div></div>
              <div className="panel-body" style={{ padding: '0' }}>
                <div style={{ padding: '14px 24px', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', alignItems: 'center', borderBottom: '1px solid var(--border-light)' }}>
                  <div><div style={{ fontSize: '13px', fontWeight: 600 }}>Longevity</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Portfolio survives 30yr horizon with buffer</div></div>
                  <div style={{ background: 'var(--success-light)', borderRadius: '8px', padding: '6px 14px', fontFamily: "'Playfair Display',serif", fontSize: '20px', fontWeight: 700, color: 'var(--success)' }}>94</div>
                  <span className="badge badge-success">Excellent</span>
                </div>
                <div style={{ padding: '14px 24px', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', alignItems: 'center', borderBottom: '1px solid var(--border-light)' }}>
                  <div><div style={{ fontSize: '13px', fontWeight: 600 }}>Tax Efficiency</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Roth conversion opportunity not fully utilized</div></div>
                  <div style={{ background: 'var(--warning-light)', borderRadius: '8px', padding: '6px 14px', fontFamily: "'Playfair Display',serif", fontSize: '20px', fontWeight: 700, color: 'var(--warning)' }}>72</div>
                  <span className="badge badge-warning">Improve</span>
                </div>
                <div style={{ padding: '14px 24px', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', alignItems: 'center', borderBottom: '1px solid var(--border-light)' }}>
                  <div><div style={{ fontSize: '13px', fontWeight: 600 }}>Sequence of Returns Risk</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Adequate diversification and cash buffer</div></div>
                  <div style={{ background: 'rgba(201,168,76,0.1)', borderRadius: '8px', padding: '6px 14px', fontFamily: "'Playfair Display',serif", fontSize: '20px', fontWeight: 700, color: '#7a5c10' }}>81</div>
                  <span className="badge badge-neutral">Good</span>
                </div>
                <div style={{ padding: '14px 24px', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px', alignItems: 'center' }}>
                  <div><div style={{ fontSize: '13px', fontWeight: 600 }}>Goal Coverage</div><div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>All primary goals on track; college partially funded</div></div>
                  <div style={{ background: 'var(--success-light)', borderRadius: '8px', padding: '6px 14px', fontFamily: "'Playfair Display',serif", fontSize: '20px', fontWeight: 700, color: 'var(--success)' }}>91</div>
                  <span className="badge badge-success">Excellent</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: '20px' }}>
          <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Priority Action Items</div></div>
          <div className="panel-body">
            <div className="insight-card warning"><div className="insight-icon">1</div><div className="insight-content"><div className="insight-title">Execute $42K Roth conversion in 2025</div><div className="insight-body">Convert $42K from Traditional IRA to Roth IRA this year to fill the 22% bracket. Use proceeds from brokerage account to pay the $9,240 tax cost.</div></div></div>
            <div className="insight-card warning"><div className="insight-icon">2</div><div className="insight-content"><div className="insight-title">Delay David's Social Security to age 70</div><div className="insight-body">Current plan has David claiming at 67. Delaying to 70 adds $87K in lifetime today's $ benefit. Bridge funding: withdraw from brokerage account ages 67–70.</div></div></div>
            <div className="insight-card info"><div className="insight-icon">3</div><div className="insight-content"><div className="insight-title">Increase college savings by $8K/year through 2028</div><div className="insight-body">Current 529 balance of $195K is $125K short for two college goals. Increase annual contributions to close the gap by each child's enrollment date.</div></div></div>
            <div className="insight-card success"><div className="insight-icon">4</div><div className="insight-content"><div className="insight-title">Retirement goal fully funded — no changes required</div><div className="insight-body">The primary retirement goal is funded at 105%. Maintain current savings rate and asset allocation. Review annually for market changes.</div></div></div>
          </div>
        </div>
      </div>
    </div>
  );
}
