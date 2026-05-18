export default function Scenarios() {
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">What-If</div>
            <div className="page-title">Scenario Manager</div>
            <div className="page-subtitle">Compare up to 10 named scenarios side by side · names stay visible while scrolling</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost">Reset to Defaults</button>
            <button className="btn btn-gold">+ Add Scenario</button>
          </div>
        </div>
      </div>
      <div className="page-body">

        {/* SCENARIO TABLE — STICKY HEADER + STICKY METRIC COLUMN */}
        <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflow: 'auto', maxHeight: '78vh', position: 'relative' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: '0', width: '100%', minWidth: '1400px', fontSize: '13px' }}>
              <thead>
                {/* Filled by JS */}
              </thead>
              <tbody>
                {/* Filled by JS */}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
