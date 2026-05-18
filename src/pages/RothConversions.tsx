export default function RothConversions() {
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Strategy</div>
            <div className="page-title">Roth Conversion Analysis</div>
            <div className="page-subtitle">Choose a conversion mode · review tax / IRMAA impact · check for strategy conflicts</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost">Apply &amp; Run</button>
          </div>
        </div>
      </div>
      <div className="page-body">

        {/* CONFLICT CHECK PANEL */}
        <div className="panel" style={{ marginBottom: '20px' }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Strategy Compatibility Check</div>
            <span className="badge">Analyzing…</span>
          </div>
          <div className="panel-body" style={{ padding: '16px 24px' }}>
            {/* Filled by JS */}
          </div>
        </div>

        {/* MODE SELECTOR */}
        <div className="panel" style={{ marginBottom: '20px' }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Conversion Mode</div>
          </div>
          <div className="panel-body" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>

              <label className="roth-mode" data-mode="off" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="radio" name="roth-mode" value="off" style={{ accentColor: 'var(--gold)' }} />
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>No Conversions</div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Baseline — no Roth conversions performed. Use to compare against active strategies.</div>
              </label>

              <label className="roth-mode" data-mode="auto-window" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', borderRadius: '10px', border: '2px solid var(--gold)', background: 'rgba(201,168,76,0.04)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="radio" name="roth-mode" value="auto-window" defaultChecked style={{ accentColor: 'var(--gold)' }} />
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Fixed Amount</div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Convert a fixed dollar amount each year within a conversion window (default $70K, ages 59-69).</div>
              </label>

              <label className="roth-mode" data-mode="bracket-fill" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="radio" name="roth-mode" value="bracket-fill" style={{ accentColor: 'var(--gold)' }} />
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Bracket Fill</div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Auto-convert each year to fill the chosen tax bracket (e.g., top of 12%). IRMAA-aware.</div>
              </label>

              <label className="roth-mode" data-mode="manual" style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="radio" name="roth-mode" value="manual" style={{ accentColor: 'var(--gold)' }} />
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Manual Schedule</div>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>Enter per-year custom amounts in today's $. System inflates to nominal. Matches Excel.</div>
              </label>

            </div>
          </div>
        </div>

        {/* AUTO-WINDOW MODE */}
        <div className="panel" style={{ marginBottom: '20px' }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Fixed Amount Settings</div>
          </div>
          <div className="panel-body" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px', display: 'block' }}>Annual Amount (today's $)</label>
                <input type="number" defaultValue={70000} step={5000}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px', display: 'block' }}>Start Age (Person A)</label>
                <input type="number" defaultValue={59} min={50} max={74}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px', display: 'block' }}>End Age (Person A)</label>
                <input type="number" defaultValue={69} min={55} max={75}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
            </div>
          </div>
        </div>

        {/* BRACKET-FILL MODE */}
        <div className="panel" style={{ marginBottom: '20px', display: 'none' }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Bracket Fill Settings</div>
          </div>
          <div className="panel-body" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px', display: 'block' }}>Target Bracket Ceiling</label>
                <select defaultValue="96950"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
                  <option value="23850">Top of 10% bracket ($23,850)</option>
                  <option value="96950">Top of 12% bracket ($96,950)</option>
                  <option value="206700">Top of 22% bracket ($206,700)</option>
                  <option value="394600">Top of 24% bracket ($394,600)</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px', display: 'block' }}>Start Age</label>
                <input type="number" defaultValue={59} min={50} max={74}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px', display: 'block' }}>End Age</label>
                <input type="number" defaultValue={74} min={55} max={75}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px' }} />
              </div>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Each year, the engine fills the chosen bracket from the top of current taxable income to the ceiling.
              For most plans, the 12% ceiling delivers the lowest lifetime tax. Higher ceilings reduce future RMDs faster but accelerate tax payments.
            </div>
          </div>
        </div>

        {/* MANUAL MODE */}
        <div className="panel" style={{ marginBottom: '20px', display: 'none' }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Manual Conversion Schedule</div>
            <div className="panel-actions">
              <button className="btn btn-outline" style={{ fontSize: '12px', padding: '6px 12px' }}>Clear All</button>
              <button className="btn btn-outline" style={{ fontSize: '12px', padding: '6px 12px' }}>Preset: $70K × 11yr</button>
              <button className="btn btn-outline" style={{ fontSize: '12px', padding: '6px 12px' }}>Preset: 12% bracket</button>
            </div>
          </div>
          <div className="panel-body" style={{ padding: '0' }}>
            <div style={{ padding: '12px 24px', background: 'rgba(13,27,46,0.03)', fontSize: '12px', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-light)' }}>
              Enter conversion amounts <strong>in today's dollars</strong> for each age. The engine will inflate them to nominal $ when running projections. Empty fields = no conversion that year.
            </div>
            <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
              <table className="data-table" style={{ margin: '0' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--cream)', zIndex: 2 }}>
                  <tr>
                    <th style={{ width: '80px' }}>Year</th>
                    <th style={{ width: '80px' }}>Age A</th>
                    <th style={{ width: '80px' }}>Age B</th>
                    <th>Conversion Amount (Today's $)</th>
                    <th style={{ width: '140px' }}>Est. Tax Cost</th>
                    <th style={{ width: '120px' }}>Notes</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
            <div style={{ padding: '12px 24px', background: 'rgba(201,168,76,0.05)', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: 'var(--text-secondary)' }}>Total scheduled conversions (today's $):</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: '22px', fontWeight: 700, color: 'var(--gold)' }}>$0</div>
            </div>
          </div>
        </div>

        {/* PREVIEW: CHART + KEY METRICS */}
        <div className="two-col">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Conversion Schedule Preview</div>
            </div>
            <div className="panel-body">
              <div style={{ position: 'relative', height: '220px' }}><canvas></canvas></div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Projected Impact</div>
            </div>
            <div className="panel-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Filled by JS */}
              </div>
            </div>
          </div>
        </div>

        {/* WITH VS WITHOUT COMPARISON */}
        <div className="panel" style={{ marginTop: '20px' }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>With vs Without Roth Conversions</div>
          </div>
          <div className="panel-body" style={{ padding: '0' }}>
            <table className="compare-table">
              <thead><tr><th>Metric</th><th>No Conversions</th><th>With Active Strategy</th><th>Delta</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
