import { useState } from 'react';
import { usePlanStore, useProjection } from '../store/usePlanStore';
import EffectiveTaxLine from '../components/charts/EffectiveTaxLine';
import IrmaaMagiLine from '../components/charts/IrmaaMagiLine';
import TaxDrag from '../components/charts/TaxDrag';
import RothVsRmd from '../components/charts/RothVsRmd';
import { STATE_PROFILES } from '../engine/stateTax';

type TaxTab = 'federal' | 'state' | 'irmaa';

export default function TaxPlanning() {
  const proj = useProjection();
  const plan = usePlanStore((s) => s.plan);
  const displayMode = usePlanStore((s) => s.displayMode);
  const real = displayMode === 'real';
  const stateProfile = STATE_PROFILES[plan.state] ?? STATE_PROFILES.IL;

  // Honor ?tab=… from legacy /irmaa redirect.
  const initialTab: TaxTab = (() => {
    if (typeof window === 'undefined') return 'federal';
    const q = new URLSearchParams(window.location.search).get('tab');
    return q === 'state' || q === 'irmaa' ? q : 'federal';
  })();
  const [tab, setTab] = useState<TaxTab>(initialTab);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Tax</div>
            <div className="page-title">Tax Planning</div>
            <div className="page-subtitle">Federal brackets · State tax · IRMAA tiers</div>
          </div>
          <div className="header-actions">
            <div className="toggle-group" role="tablist" aria-label="Tax view">
              <button className={`toggle-opt ${tab === 'federal' ? 'active' : ''}`} role="tab" aria-selected={tab === 'federal'} onClick={() => setTab('federal')}>Federal</button>
              <button className={`toggle-opt ${tab === 'state' ? 'active' : ''}`} role="tab" aria-selected={tab === 'state'} onClick={() => setTab('state')}>State</button>
              <button className={`toggle-opt ${tab === 'irmaa' ? 'active' : ''}`} role="tab" aria-selected={tab === 'irmaa'} onClick={() => setTab('irmaa')}>IRMAA</button>
            </div>
          </div>
        </div>
      </div>
      <div className="page-body">
        {tab === 'federal' && (
          <>
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel-header">
                <div className="panel-title"><div className="panel-title-dot"></div>2025 Federal Tax Brackets (MFJ)</div>
                <span className="badge badge-neutral">OBBBA · Pub. L. 119-21</span>
              </div>
              <div className="panel-body" style={{ padding: 0 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>MFJ Standard Deduction</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 600 }}>$31,500</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>OBBBA · Pub. L. 119-21</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>Senior Add-On (65+)</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 600 }}>$1,600/person</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Per qualifying spouse</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel-header">
                <div className="panel-title"><div className="panel-title-dot"></div>Effective Tax Rate Trajectory (%)</div>
              </div>
              <div className="panel-body">
                <EffectiveTaxLine proj={proj} height={240} />
              </div>
            </div>

            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel-header">
                <div className="panel-title"><div className="panel-title-dot"></div>Tax Drag Analysis ($)</div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Federal tax paid (bars) · Effective rate on taxable income (line)</span>
              </div>
              <div className="panel-body">
                <TaxDrag proj={proj} real={real} height={240} />
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div className="panel-title"><div className="panel-title-dot"></div>Roth Conversions vs RMDs ($)</div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Conversions concentrated pre-RMD · RMDs forced after age {plan.assumptions.rmdStartAge}</span>
              </div>
              <div className="panel-body">
                <RothVsRmd proj={proj} real={real} height={240} />
              </div>
            </div>
          </>
        )}

        {tab === 'state' && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>State Tax · {stateProfile.name}</div>
            </div>
            <div className="panel-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{ background: stateProfile.effectiveRate === 0 ? 'var(--success-light)' : 'var(--warning-light)', width: 52, height: 52, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  {stateProfile.effectiveRate === 0 ? '✓' : '$'}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Playfair Display',serif" }}>
                    {stateProfile.name}{stateProfile.effectiveRate === 0 ? ' — No State Income Tax' : ` — ${(stateProfile.effectiveRate * 100).toFixed(2)}%`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stateProfile.note}</div>
                </div>
              </div>
              <div className={`insight-card ${stateProfile.effectiveRate === 0 ? 'success' : 'warning'}`} style={{ margin: 0, borderRadius: 8 }}>
                <div className="insight-icon">{stateProfile.effectiveRate === 0 ? '✓' : '⚠'}</div>
                <div className="insight-content">
                  <div className="insight-title">
                    {stateProfile.effectiveRate === 0
                      ? 'No state-tax drag on retirement income'
                      : stateProfile.retirementExempt
                      ? 'Retirement distributions are exempt'
                      : 'Retirement distributions are taxed at the state rate'}
                  </div>
                  <div className="insight-body">
                    {stateProfile.retirementExempt
                      ? 'Wages and rental income (if any) are taxed; 401(k)/IRA/Roth/Pension/SS are not.'
                      : 'IRA, 401(k), and pension distributions count as taxable ordinary income. Consider a tax-free state for retirement.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'irmaa' && (
          <>
            <div className="insight-card warning" style={{ marginBottom: 20, borderRadius: 'var(--radius)' }}>
              <div className="insight-icon">⚕</div>
              <div className="insight-content">
                <div className="insight-title">Medicare premium surcharges kick in when MAGI exceeds Tier 1</div>
                <div className="insight-body">IRMAA is a 2-year lookback: today's MAGI affects premiums 2 years later. Roth conversions in low-bracket years can keep future MAGI below the next tier and save hundreds to thousands of dollars per year in Part B and Part D add-ons.</div>
              </div>
            </div>

            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel-header">
                <div className="panel-title"><div className="panel-title-dot"></div>2025 IRMAA Thresholds (MFJ)</div>
              </div>
              <div className="panel-body" style={{ padding: 0 }}>
                <div style={{ padding: '12px 24px', background: 'rgba(13,27,46,0.03)', borderBottom: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>
                  <div>MAGI (MFJ)</div><div>Part B Add</div><div>Part D Add</div><div>Status</div>
                </div>
                <div className="irmaa-tier">
                  <div>≤ $206,000</div><div className="td-mono">$0</div><div className="td-mono">$0</div>
                  <span className="badge badge-success">Base</span>
                </div>
                <div className="irmaa-tier">
                  <div>$206,001 – $258,000</div><div className="td-mono">+$838/yr</div><div className="td-mono">+$226/yr</div>
                  <span className="badge badge-warning">Tier 1</span>
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
                <div className="panel-title"><div className="panel-title-dot"></div>Projected MAGI vs IRMAA Thresholds ($)</div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Threshold lines are 2025 tiers in today's $</span>
              </div>
              <div className="panel-body">
                <IrmaaMagiLine proj={proj} real={real} height={300} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
