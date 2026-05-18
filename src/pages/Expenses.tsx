export default function Expenses() {
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Inputs</div>
            <div className="page-title">Expenses</div>
            <div className="page-subtitle">Spending categories with per-row inflation rates</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-gold">Save</button>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 20 }}>
          <div className="metric-card">
            <div className="metric-label">Total Annual Expenses (Year 1)</div>
            <div className="metric-value">$127<span className="metric-unit">K</span></div>
            <div className="metric-sub">At retirement (age 65)</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Healthcare Inflation Exposure</div>
            <div className="metric-value">$28<span className="metric-unit">K</span></div>
            <div className="metric-sub">+4.8%/yr projected · age 65+</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Real Spending Growth</div>
            <div className="metric-value">+1.2<span className="metric-unit">%</span></div>
            <div className="metric-sub">Above general inflation</div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Expense Streams</div>
            <button className="btn btn-gold" style={{ padding: '7px 14px', fontSize: 12 }}>+ Add Category</button>
          </div>
          <div className="panel-body" style={{ padding: '16px 24px' }}>
            <div className="stream-row expense-row" style={{ padding: '6px 0', borderBottom: '2px solid var(--border-light)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Description</div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Whose</div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Start Age</div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Stop Age</div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Annual Amt</div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>Infl %</div>
              <div></div>
            </div>

            <div className="stream-row expense-row">
              <input type="text" defaultValue="Core Household Spending" style={{ fontSize: 13 }} />
              <select style={{ fontSize: 13 }} defaultValue="HH"><option value="HH">Household</option><option value="A">Person A</option><option value="B">Person B</option></select>
              <input type="number" defaultValue={65} style={{ fontSize: 13 }} />
              <input type="number" defaultValue={95} style={{ fontSize: 13 }} />
              <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" defaultValue={95000} style={{ fontSize: 13, paddingLeft: 22 }} /></div>
              <div className="input-suffix-wrap"><input type="number" defaultValue={2.5} style={{ fontSize: 13 }} /><span className="input-suffix">%</span></div>
              <button className="remove-btn">×</button>
            </div>

            <div className="stream-row expense-row">
              <input type="text" defaultValue="Healthcare Premiums & OOP" style={{ fontSize: 13 }} />
              <select style={{ fontSize: 13 }} defaultValue="HH"><option value="HH">Household</option><option value="A">Person A</option><option value="B">Person B</option></select>
              <input type="number" defaultValue={65} style={{ fontSize: 13 }} />
              <input type="number" defaultValue={95} style={{ fontSize: 13 }} />
              <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" defaultValue={28000} style={{ fontSize: 13, paddingLeft: 22 }} /></div>
              <div className="input-suffix-wrap"><input type="number" defaultValue={4.8} style={{ fontSize: 13 }} /><span className="input-suffix">%</span></div>
              <button className="remove-btn">×</button>
            </div>

            <div className="stream-row expense-row">
              <input type="text" defaultValue="Travel & Leisure" style={{ fontSize: 13 }} />
              <select style={{ fontSize: 13 }} defaultValue="HH"><option value="HH">Household</option><option value="A">Person A</option><option value="B">Person B</option></select>
              <input type="number" defaultValue={65} style={{ fontSize: 13 }} />
              <input type="number" defaultValue={82} style={{ fontSize: 13 }} />
              <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" defaultValue={18000} style={{ fontSize: 13, paddingLeft: 22 }} /></div>
              <div className="input-suffix-wrap"><input type="number" defaultValue={3.0} style={{ fontSize: 13 }} /><span className="input-suffix">%</span></div>
              <button className="remove-btn">×</button>
            </div>

            <div className="stream-row expense-row">
              <input type="text" defaultValue="Long-Term Care Reserve" style={{ fontSize: 13 }} />
              <select style={{ fontSize: 13 }} defaultValue="HH"><option value="HH">Household</option><option value="A">Person A</option><option value="B">Person B</option></select>
              <input type="number" defaultValue={85} style={{ fontSize: 13 }} />
              <input type="number" defaultValue={95} style={{ fontSize: 13 }} />
              <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" defaultValue={36000} style={{ fontSize: 13, paddingLeft: 22 }} /></div>
              <div className="input-suffix-wrap"><input type="number" defaultValue={5.5} style={{ fontSize: 13 }} /><span className="input-suffix">%</span></div>
              <button className="remove-btn">×</button>
            </div>

            <button className="add-row-btn">+ Add expense category</button>
          </div>
        </div>
      </div>
    </div>
  );
}
