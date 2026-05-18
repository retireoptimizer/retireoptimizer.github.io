import { useNavigate } from 'react-router-dom';
import { usePlanStore, useProjection } from '../store/usePlanStore';
import { fmtM, fmtK, fmtPct } from '../lib/format';

export default function Dashboard() {
  const navigate = useNavigate();
  const plan = usePlanStore((s) => s.plan);
  const proj = useProjection();
  const A = plan.personA;
  const startYear = new Date().getFullYear();
  const ageA = startYear - parseInt(A.dob.slice(0, 4), 10);

  // Find the row at the planned retirement age
  const retireRow = proj.rows.find((r) => r.ageA === A.retirementAge);
  const finalRow = proj.rows[proj.rows.length - 1];

  // Safe withdrawal rate: first retirement-year withdrawals / portfolio at retirement
  let safeWR = 0;
  if (retireRow && retireRow.endTotal > 0) {
    safeWR = retireRow.totalWD / retireRow.endTotal;
  }

  // Plan longevity: last age before portfolio runs to zero (or planToAge)
  let longevityAge = A.planToAge;
  for (const row of proj.rows) {
    if (row.phase === 'Retire' && row.endTotal <= 0) {
      longevityAge = row.ageA;
      break;
    }
    longevityAge = row.ageA;
  }
  const planLasts = longevityAge >= A.planToAge;

  // Roth conversion opportunity: first year's 12% bracket headroom
  const yr1 = proj.rows[0];
  const inflF = yr1?.inflationFactor ?? 1;
  const bracket12Top = 96950 * inflF;
  const stdD = yr1?.stdDeduction ?? 31500;
  const baseInc = (yr1?.totalSS ?? 0) * 0.85 + (yr1?.otherIncome ?? 0) + (yr1?.rmd ?? 0);
  const convHeadroom = Math.max(0, bracket12Top - stdD - baseInc);

  // Income sources at retirement
  const yrAtRetire = retireRow ?? proj.rows.find((r) => r.phase === 'Retire');
  const srcWD = yrAtRetire?.totalWD ?? 0;
  const srcSS = yrAtRetire?.totalSS ?? 0;
  const srcOther = yrAtRetire?.otherIncome ?? 0;
  const srcTotal = srcWD + srcSS + srcOther;
  const pct = (n: number) => srcTotal > 0 ? Math.round((n / srcTotal) * 100) : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Retirement Plan</div>
            <div className="page-title">{A.name}'s Retirement Overview</div>
            <div className="page-subtitle">Age {ageA} · Target retirement: age {A.retirementAge} · Plan-to age: {A.planToAge}</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost" onClick={() => navigate('/projections')}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M22 12c0 5.52-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2" strokeWidth="2"/>
              </svg>
              Run Projections
            </button>
          </div>
        </div>
      </div>
      <div className="page-body">

        <div className="metrics-grid">
          <div className={`metric-card ${planLasts ? 'positive' : 'warning'}`}>
            <div className="metric-label">Projected Portfolio at {A.retirementAge}</div>
            <div className="metric-value">{retireRow ? fmtM(retireRow.endTotal) : '—'}</div>
            <div className={`metric-delta ${planLasts ? 'up' : 'neutral'}`}>{planLasts ? '↑ On track' : 'Below target'}</div>
            <div className="metric-sub">{retireRow ? `Real: ${fmtM(retireRow.endTotal / retireRow.inflationFactor)} · Today's $` : ''}</div>
          </div>
          <div className={`metric-card ${safeWR < 0.04 ? 'positive' : 'warning'}`}>
            <div className="metric-label">Withdrawal Rate (Year 1)</div>
            <div className="metric-value">{fmtPct(safeWR, 1).replace('%', '')}<span className="metric-unit">%</span></div>
            <div className={`metric-delta ${safeWR < 0.04 ? 'up' : 'neutral'}`}>{safeWR < 0.04 ? 'Below 4% threshold' : 'Above 4% threshold'}</div>
            <div className="metric-sub">{retireRow ? `${fmtK(retireRow.totalWD)}/yr from portfolio` : ''}</div>
          </div>
          <div className={`metric-card ${planLasts ? 'positive' : 'warning'}`}>
            <div className="metric-label">Plan Longevity</div>
            <div className="metric-value">Age<span className="metric-unit"> </span>{longevityAge}</div>
            <div className={`metric-delta ${planLasts ? 'up' : 'neutral'}`}>{planLasts ? 'Lasts full plan' : 'Runs out early'}</div>
            <div className="metric-sub">Plan horizon: age {A.planToAge}</div>
          </div>
          <div className="metric-card warning">
            <div className="metric-label">Roth Conversion Headroom</div>
            <div className="metric-value">{fmtK(convHeadroom)}</div>
            <div className="metric-delta neutral">12% bracket headroom</div>
            <div className="metric-sub">Year 1 · before RMDs</div>
          </div>
        </div>

        <div className="two-col">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Lifetime Totals</div>
            </div>
            <div className="panel-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, padding: '8px 0' }}>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Lifetime Federal Tax</div>
                  <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: 'var(--danger)' }}>{fmtM(proj.lifetimeFedTax)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Lifetime RMDs</div>
                  <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: 'var(--warning)' }}>{fmtM(proj.lifetimeRMD)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>Lifetime Roth Conversions</div>
                  <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: 'var(--gold)' }}>{fmtM(proj.lifetimeConversion)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>End-of-Plan Balance</div>
                  <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: 'var(--success)' }}>{fmtM(proj.endTotalNominal)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Today's $: {fmtM(proj.endTotalReal)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Plan Health</div>
              <span className={`badge ${planLasts ? 'badge-success' : 'badge-warning'}`}>{planLasts ? 'On Track' : 'At Risk'}</span>
            </div>
            <div className="panel-body" style={{ paddingTop: 12 }}>
              <div className="health-gauge-wrap">
                <svg className="gauge-arc" width="160" height="90" viewBox="0 0 160 90">
                  <path d="M 15 85 A 65 65 0 0 1 145 85" fill="none" stroke="rgba(13,27,46,0.08)" strokeWidth="12" strokeLinecap="round"/>
                  <path d="M 15 85 A 65 65 0 0 1 145 85" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray="204" strokeDashoffset={planLasts ? 27 : 90}/>
                  <defs>
                    <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#c9a84c"/>
                      <stop offset="60%" stopColor="#1a8a5a"/>
                    </linearGradient>
                  </defs>
                </svg>
                <div className="health-score">{planLasts ? Math.round(70 + (proj.endTotalReal / 1_000_000) * 5) : 50}</div>
                <div className="health-label">{planLasts ? 'Plan Lasts Horizon' : 'Funding Gap'}</div>
                <div className="health-sub">Phase 3 will add detailed sub-scores</div>
              </div>
            </div>
          </div>
        </div>

        <div className="two-col">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Retirement Income Sources (Age {A.retirementAge})</div>
            </div>
            <div className="panel-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 20 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 4 }}>Portfolio WD</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{fmtK(srcWD)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct(srcWD)}%</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 4 }}>Social Security</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{fmtK(srcSS)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct(srcSS)}%</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 4 }}>Other Income</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>{fmtK(srcOther)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct(srcOther)}%</div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Key Insights</div>
            </div>
            <div className="panel-body">
              {planLasts && (
                <div className="insight-card success">
                  <div className="insight-icon">✓</div>
                  <div className="insight-content">
                    <div className="insight-title">Plan fully funded through age {longevityAge}</div>
                    <div className="insight-body">Portfolio sustains target spending with no shortfall.</div>
                  </div>
                </div>
              )}
              {!planLasts && (
                <div className="insight-card" style={{ background: 'var(--danger-light)', borderLeft: '3px solid var(--danger)' }}>
                  <div className="insight-icon">⚠</div>
                  <div className="insight-content">
                    <div className="insight-title">Portfolio runs out at age {longevityAge}</div>
                    <div className="insight-body">Consider reducing spending, delaying retirement, or adjusting allocations.</div>
                  </div>
                </div>
              )}
              {convHeadroom > 10000 && (
                <div className="insight-card warning">
                  <div className="insight-icon">⚡</div>
                  <div className="insight-content">
                    <div className="insight-title">{fmtK(convHeadroom)} Roth conversion opportunity</div>
                    <div className="insight-body">Year 1 has room in 12% bracket. Converting before RMDs can reduce lifetime tax.</div>
                  </div>
                </div>
              )}
              {finalRow && finalRow.totalSS < 30000 && (
                <div className="insight-card info">
                  <div className="insight-icon">💡</div>
                  <div className="insight-content">
                    <div className="insight-title">Delaying SS may increase lifetime benefit</div>
                    <div className="insight-body">Phase 3 will add a Social Security claim-age optimizer.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
