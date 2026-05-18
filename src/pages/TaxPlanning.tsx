export default function TaxPlanning() {
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Tax &amp; Risk</div>
            <div className="page-title">Tax Planning</div>
            <div className="page-subtitle">Federal + state tax · Standard deduction · LTCG</div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="two-col">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>2025 Federal Tax Brackets (MFJ)</div>
              <span className="badge badge-neutral">OBBBA · Pub. L. 119-21</span>
            </div>
            <div className="panel-body" style={{ padding: '0' }}>
              <table className="data-table">
                <thead><tr><th>Rate</th><th>Income From</th><th>Income To</th><th>Your Exposure</th></tr></thead>
                <tbody>
                  <tr><td><strong>10%</strong></td><td className="td-mono">$0</td><td className="td-mono">$23,850</td><td><span className="badge badge-success">✓ In range</span></td></tr>
                  <tr><td><strong>12%</strong></td><td className="td-mono">$23,851</td><td className="td-mono">$96,950</td><td><span className="badge badge-success">✓ In range</span></td></tr>
                  <tr><td><strong>22%</strong></td><td className="td-mono">$96,951</td><td className="td-mono">$206,700</td><td><span className="badge badge-neutral">Current bracket</span></td></tr>
                  <tr><td><strong>24%</strong></td><td className="td-mono">$206,701</td><td className="td-mono">$394,600</td><td><span className="badge badge-warning">Roth boundary</span></td></tr>
                  <tr><td><strong>32%</strong></td><td className="td-mono">$394,601</td><td className="td-mono">$501,050</td><td>—</td></tr>
                  <tr><td><strong>35%</strong></td><td className="td-mono">$501,051</td><td className="td-mono">$751,600</td><td>—</td></tr>
                  <tr><td><strong>37%</strong></td><td className="td-mono">$751,601+</td><td className="td-mono">—</td><td>—</td></tr>
                </tbody>
              </table>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-light)', background: 'rgba(250,247,242,0.6)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>MFJ Standard Deduction</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '16px', fontWeight: 600 }}>$31,500</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>OBBBA · Pub. L. 119-21</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Senior Add-On (65+)</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '16px', fontWeight: 600 }}>$1,600/person</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Per qualifying spouse</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title"><div className="panel-title-dot"></div>State Tax</div>
              </div>
              <div className="panel-body">
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ background: 'var(--success-light)', width: '52px', height: '52px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>🤠</div>
                  <div>
                    <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>Texas — No State Income Tax</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Current &amp; planned retirement state</div>
                  </div>
                </div>
                <div className="insight-card success" style={{ margin: '0', borderRadius: '8px' }}>
                  <div className="insight-icon">🎉</div>
                  <div className="insight-content">
                    <div className="insight-title">State tax advantage: est. $148K lifetime savings</div>
                    <div className="insight-body">Versus living in California at your projected income levels. No action needed.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div className="panel-title"><div className="panel-title-dot"></div>Effective Tax Rate Trajectory</div>
              </div>
              <div className="panel-body">
                <div style={{ position: 'relative', height: '140px' }}><canvas></canvas></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
