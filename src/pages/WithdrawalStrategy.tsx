export default function WithdrawalStrategy() {
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Strategy</div>
            <div className="page-title">Withdrawal Strategy</div>
            <div className="page-subtitle">Choose manually or let the system recommend based on your goal</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost">Apply to Projections</button>
          </div>
        </div>
      </div>
      <div className="page-body">

        {/* Mode Selector */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-body" style={{ padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>Mode:</div>
              <div className="toggle-group" style={{ width: 340 }}>
                <button className="toggle-opt active">I'll choose a strategy</button>
                <button className="toggle-opt">✦ Recommend for me</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Select the withdrawal order below. It will apply to all projection years.
              </div>
            </div>
          </div>
        </div>

        {/* Strategy Selection */}
        <div className="two-col" style={{ marginBottom: 20 }}>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Withdrawal Strategy</div>
              <span className="badge badge-neutral">Taxable → Traditional → Roth</span>
            </div>
            <div className="panel-body" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 10, border: '2px solid var(--gold)', cursor: 'pointer' }}>
                  <input type="radio" name="wd-strat" defaultChecked style={{ marginTop: 3, accentColor: 'var(--gold)' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                      Taxable → Traditional → Roth <span style={{ fontSize: 10, background: '#c9a84c20', color: '#7a5c10', borderRadius: 4, padding: '2px 7px', marginLeft: 6 }}>Classic</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Spend taxable brokerage first (low LTCG tax), then pre-tax, preserving Roth for last. Standard tax-efficient order for most retirees.</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <span style={{ fontSize: 10, background: '#0d1b2e15', color: '#0d1b2e', borderRadius: 4, padding: '2px 7px' }}>Taxable 1st</span>
                      <span style={{ fontSize: 10, background: '#0d1b2e15', color: '#0d1b2e', borderRadius: 4, padding: '2px 7px' }}>Traditional 2nd</span>
                      <span style={{ fontSize: 10, background: '#0d1b2e15', color: '#0d1b2e', borderRadius: 4, padding: '2px 7px' }}>Roth last</span>
                    </div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                  <input type="radio" name="wd-strat" style={{ marginTop: 3, accentColor: 'var(--gold)' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                      Roth → Traditional → Taxable <span style={{ fontSize: 10, background: '#1a8a5a20', color: '#1a8a5a', borderRadius: 4, padding: '2px 7px', marginLeft: 6 }}>Roth-First</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Exhaust Roth first (zero tax cost). Useful when Traditional bucket is small or for specific Medicaid/benefit planning needs.</div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <span style={{ fontSize: 10, background: '#1a8a5a15', color: '#1a8a5a', borderRadius: 4, padding: '2px 7px' }}>Roth 1st</span>
                      <span style={{ fontSize: 10, background: '#0d1b2e15', color: '#0d1b2e', borderRadius: 4, padding: '2px 7px' }}>Traditional 2nd</span>
                      <span style={{ fontSize: 10, background: '#0d1b2e15', color: '#0d1b2e', borderRadius: 4, padding: '2px 7px' }}>Taxable last</span>
                    </div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                  <input type="radio" name="wd-strat" style={{ marginTop: 3, accentColor: 'var(--gold)' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                      Traditional → Taxable → Roth <span style={{ fontSize: 10, background: '#b8620a20', color: '#b8620a', borderRadius: 4, padding: '2px 7px', marginLeft: 6 }}>Pre-Tax First</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Drain Traditional first to reduce future RMD exposure. Leaves Roth untouched for heirs or late-life spending. Best when large Traditional bucket creates RMD risk.</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                  <input type="radio" name="wd-strat" style={{ marginTop: 3, accentColor: 'var(--gold)' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                      Proportional (all buckets each year) <span style={{ fontSize: 10, background: '#3b5e8a20', color: '#3b5e8a', borderRadius: 4, padding: '2px 7px', marginLeft: 6 }}>Blended</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Each year withdraws from all three buckets in proportion to their current balances. Keeps all accounts active, smooths tax exposure, and avoids depleting any single bucket prematurely.</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px', borderRadius: 10, border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                  <input type="radio" name="wd-strat" style={{ marginTop: 3, accentColor: 'var(--gold)' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                      Bracket-Fill (tax-aware blended) <span style={{ fontSize: 10, background: '#7a5c1020', color: '#7a5c10', borderRadius: 4, padding: '2px 7px', marginLeft: 6 }}>Advanced</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Each year: take RMDs, then fill the lowest tax bracket with Traditional withdrawals, then take remaining need from Roth or Taxable. Blends buckets dynamically to keep tax rate low every year.</div>
                  </div>
                </label>

              </div>
            </div>
          </div>

          {/* Preview panel */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Drawdown Sequence Preview</div>
            </div>
            <div className="panel-body">
              <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Select a strategy to see a preview of how withdrawals flow across buckets each year.</p>
            </div>
          </div>
        </div>

        {/* Recommend mode (hidden, shown when toggled) */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>What is your primary goal?</div>
          </div>
          <div className="panel-body" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 10, border: '2px solid var(--gold)', background: 'rgba(201,168,76,0.04)', cursor: 'pointer' }}>
                <input type="radio" name="wd-goal" defaultChecked style={{ marginTop: 2, accentColor: 'var(--gold)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Minimize Lifetime Taxes</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Choose the strategy that pays the least total federal tax over the plan horizon.</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 10, border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                <input type="radio" name="wd-goal" style={{ marginTop: 2, accentColor: 'var(--gold)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Maximize End-of-Plan Balance</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Leave the largest possible total portfolio at plan end. Prioritizes tax-free growth by withdrawing from taxable/traditional before Roth.</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 10, border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                <input type="radio" name="wd-goal" style={{ marginTop: 2, accentColor: 'var(--gold)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Minimize RMD Exposure</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Keep the Traditional (pre-tax) bucket as small as possible to reduce forced RMDs after age 75.</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 10, border: '1px solid var(--border-light)', cursor: 'pointer' }}>
                <input type="radio" name="wd-goal" style={{ marginTop: 2, accentColor: 'var(--gold)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>Preserve Roth for Heirs</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Protect the Roth bucket for inheritance. Withdraw from Taxable and Traditional first, treating Roth as last resort.</div>
                </div>
              </label>

            </div>

            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <button className="btn btn-gold" style={{ padding: '12px 32px', fontSize: 14 }}>
                ✦ Analyze &amp; Recommend
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
