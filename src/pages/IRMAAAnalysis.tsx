export default function IRMAAAnalysis() {
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Tax &amp; Risk</div>
            <div className="page-title">IRMAA Analysis</div>
            <div className="page-subtitle">Medicare premium surcharges · MAGI optimization</div>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="insight-card warning" style={{ marginBottom: '20px', borderRadius: 'var(--radius)' }}>
          <div className="insight-icon">⚕</div>
          <div className="insight-content">
            <div className="insight-title">IRMAA exposure projected at ages 67–69 without Roth conversion strategy</div>
            <div className="insight-body">Projected MAGI of $206K–$214K exceeds the Tier 1 MFJ threshold of $206K, adding $838/year in Medicare surcharges. The recommended Roth conversion strategy reduces MAGI by est. $18K, keeping you below the threshold.</div>
          </div>
        </div>

        <div className="two-col">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>2025 IRMAA Thresholds (MFJ)</div>
            </div>
            <div className="panel-body" style={{ padding: '0' }}>
              <div style={{ padding: '12px 24px', background: 'rgba(13,27,46,0.03)', borderBottom: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>
                <div>MAGI (MFJ)</div><div>Part B Add</div><div>Part D Add</div><div>Status</div>
              </div>
              <div className="irmaa-tier">
                <div>≤ $206,000</div><div className="td-mono">$0</div><div className="td-mono">$0</div>
                <span className="badge badge-success">Base</span>
              </div>
              <div className="irmaa-tier active">
                <div>$206,001 – $258,000</div><div className="td-mono">+$838/yr</div><div className="td-mono">+$226/yr</div>
                <span className="badge badge-warning">⚠ Near</span>
              </div>
              <div className="irmaa-tier">
                <div>$258,001 – $322,000</div><div className="td-mono">+$2,092/yr</div><div className="td-mono">+$583/yr</div>
                <span className="badge badge-neutral">Tier 2</span>
              </div>
              <div className="irmaa-tier">
                <div>$322,001 – $386,000</div><div className="td-mono">+$3,346/yr</div><div className="td-mono">+$940/yr</div>
                <span className="badge badge-neutral">Tier 3</span>
              </div>
              <div className="irmaa-tier">
                <div>$386,001 – $750,000</div><div className="td-mono">+$4,600/yr</div><div className="td-mono">+$1,296/yr</div>
                <span className="badge badge-neutral">Tier 4</span>
              </div>
              <div className="irmaa-tier">
                <div>&gt; $750,000</div><div className="td-mono">+$5,854/yr</div><div className="td-mono">+$1,653/yr</div>
                <span className="badge badge-neutral">Tier 5</span>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Projected MAGI vs IRMAA Boundary</div>
            </div>
            <div className="panel-body">
              <div style={{ position: 'relative', height: '280px' }}><canvas></canvas></div>
              <div className="mc-band-legend">
                <div className="mc-band"><div className="mc-band-color" style={{ background: '#3b5e8a' }}></div>MAGI (No Conversions)</div>
                <div className="mc-band"><div className="mc-band-color" style={{ background: '#1a8a5a' }}></div>MAGI (With Conversions)</div>
                <div className="mc-band"><div className="mc-band-color" style={{ background: '#c0392b', opacity: 0.5 }}></div>Tier 1 Threshold $206K</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
