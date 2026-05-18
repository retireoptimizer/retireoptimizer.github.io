export default function IncomeStreams() {
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Inputs</div>
            <div className="page-title">Income Streams</div>
            <div className="page-subtitle">Social Security, pensions, rental, wages, annuities</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-gold">Save</button>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="insight-card warning" style={{ marginBottom: 20, borderRadius: 'var(--radius)', padding: '16px 20px' }}>
          <div className="insight-icon">⚡</div>
          <div className="insight-content">
            <div className="insight-title">Optimizing SS claim age could add $87K lifetime benefit</div>
            <div className="insight-body">Delaying to age 70 increases lifetime SS by ~$87K in today's $.</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Income Streams</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="tag">30 max streams</span>
              <button className="btn btn-gold" style={{ padding: '7px 14px', fontSize: 12 }}>+ Add Stream</button>
            </div>
          </div>
          <div className="panel-body" style={{ padding: '16px 24px' }}>
            <div className="stream-row income-row" style={{ padding: '6px 0', borderBottom: '2px solid var(--border-light)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Description</div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Whose</div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Type</div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Start Age</div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Stop Age</div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Annual Amt</div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Growth%</div>
              <div></div>
            </div>

            <div className="stream-row income-row">
              <input type="text" defaultValue="Person A Social Security" style={{ fontSize: 13 }} />
              <select style={{ fontSize: 13 }} defaultValue="A"><option value="A">Person A</option><option value="B">Person B</option><option value="HH">Household</option></select>
              <select style={{ fontSize: 13 }} defaultValue="SS"><option value="SS">SS</option><option value="Pension">Pension</option><option value="Wages">Wages</option><option value="Rental">Rental</option><option value="Annuity">Annuity</option><option value="Other">Other</option></select>
              <input type="number" defaultValue={67} style={{ fontSize: 13 }} />
              <input type="number" defaultValue={88} style={{ fontSize: 13 }} />
              <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" defaultValue={33600} style={{ fontSize: 13, paddingLeft: 22 }} /></div>
              <div className="input-suffix-wrap"><input type="number" defaultValue={2.5} style={{ fontSize: 13 }} /><span className="input-suffix">%</span></div>
              <button className="remove-btn">×</button>
            </div>

            <div className="stream-row income-row">
              <input type="text" defaultValue="Person B Social Security" style={{ fontSize: 13 }} />
              <select style={{ fontSize: 13 }} defaultValue="B"><option value="A">Person A</option><option value="B">Person B</option><option value="HH">Household</option></select>
              <select style={{ fontSize: 13 }} defaultValue="SS"><option value="SS">SS</option><option value="Pension">Pension</option><option value="Wages">Wages</option><option value="Rental">Rental</option><option value="Annuity">Annuity</option><option value="Other">Other</option></select>
              <input type="number" defaultValue={67} style={{ fontSize: 13 }} />
              <input type="number" defaultValue={90} style={{ fontSize: 13 }} />
              <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" defaultValue={26400} style={{ fontSize: 13, paddingLeft: 22 }} /></div>
              <div className="input-suffix-wrap"><input type="number" defaultValue={2.5} style={{ fontSize: 13 }} /><span className="input-suffix">%</span></div>
              <button className="remove-btn">×</button>
            </div>

            <div className="stream-row income-row">
              <input type="text" defaultValue="Consulting Income" style={{ fontSize: 13 }} />
              <select style={{ fontSize: 13 }} defaultValue="A"><option value="A">Person A</option><option value="B">Person B</option><option value="HH">Household</option></select>
              <select style={{ fontSize: 13 }} defaultValue="Wages"><option value="SS">SS</option><option value="Pension">Pension</option><option value="Wages">Wages</option><option value="Rental">Rental</option><option value="Annuity">Annuity</option><option value="Other">Other</option></select>
              <input type="number" defaultValue={65} style={{ fontSize: 13 }} />
              <input type="number" defaultValue={70} style={{ fontSize: 13 }} />
              <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" defaultValue={45000} style={{ fontSize: 13, paddingLeft: 22 }} /></div>
              <div className="input-suffix-wrap"><input type="number" defaultValue={0.0} style={{ fontSize: 13 }} /><span className="input-suffix">%</span></div>
              <button className="remove-btn">×</button>
            </div>

            <button className="add-row-btn">+ Add income stream</button>
          </div>
        </div>
      </div>
    </div>
  );
}
