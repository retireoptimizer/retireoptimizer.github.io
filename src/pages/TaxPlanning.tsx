import { useMemo, useState } from 'react';
import { usePlanStore, useProjection } from '../store/usePlanStore';
import IrmaaMagiLine from '../components/charts/IrmaaMagiLine';
import TaxDrag from '../components/charts/TaxDrag';
import CumulativeTaxCompare from '../components/charts/CumulativeTaxCompare';
import BalanceCompare from '../components/charts/BalanceCompare';
import StateTaxDrag from '../components/charts/StateTaxDrag';
import ChartFrame from '../components/charts/ChartFrame';
import { STATE_PROFILES } from '../engine/stateTax';
import { compareWithWithoutConversion } from '../engine/comparison';
import { fmtK } from '../lib/format';

type TaxTab = 'federal' | 'state' | 'irmaa';

export default function TaxPlanning() {
  const proj = useProjection();
  const plan = usePlanStore((s) => s.plan);
  const displayMode = usePlanStore((s) => s.displayMode);
  const real = displayMode === 'real';
  const stateProfile = STATE_PROFILES[plan.state] ?? STATE_PROFILES.IL;
  const actualStateRate = plan.state === 'CUSTOM' ? (plan.customStateTaxRate ?? 0) : stateProfile.effectiveRate;

  // Honor ?tab=… from legacy /irmaa redirect.
  const initialTab: TaxTab = (() => {
    if (typeof window === 'undefined') return 'federal';
    const q = new URLSearchParams(window.location.search).get('tab');
    return q === 'state' || q === 'irmaa' ? q : 'federal';
  })();
  const [tab, setTab] = useState<TaxTab>(initialTab);
  const cmp = useMemo(() => compareWithWithoutConversion(plan), [plan]);
  const taxDelta = real
    ? (cmp.cumulativeTaxWith.at(-1) ?? 0) - (cmp.cumulativeTaxNo.at(-1) ?? 0)
    : (cmp.cumulativeTaxWithNom.at(-1) ?? 0) - (cmp.cumulativeTaxNoNom.at(-1) ?? 0);
  const balDelta = real
    ? (cmp.endTotalWith.at(-1) ?? 0) - (cmp.endTotalNo.at(-1) ?? 0)
    : (cmp.endTotalWithNom.at(-1) ?? 0) - (cmp.endTotalNoNom.at(-1) ?? 0);
  const dollarLabel = real ? "today's $" : 'nominal $';

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Tax</div>
            <div className="page-title">Tax Planning</div>
            <div className="page-subtitle">Your projected federal trajectory, state tax exposure, and Medicare IRMAA crossings</div>
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
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Your Projected Tax Trajectory</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Federal tax paid (bars, left axis) · Effective rate (line, right axis)</span>
            </div>
            <div className="panel-body">
              <ChartFrame caption="Bars are dollars of federal tax paid each year; the line is what % of taxable income that represents. To change the shape of this curve, adjust your withdrawal or Roth conversion strategy on the Strategy page.">
                <TaxDrag proj={proj} real={real} height={300} />
              </ChartFrame>
            </div>
          </div>
        )}

        {tab === 'state' && (
          <div className="panel" style={{ marginBottom: 20 }}>
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
                    {stateProfile.code === 'NONE'
                      ? 'State Tax Excluded'
                      : `${stateProfile.name}${actualStateRate === 0 ? ' — No State Income Tax' : ` — ${(actualStateRate * 100).toFixed(2)}%`}`}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{stateProfile.note}</div>
                </div>
              </div>
              <div className={`insight-card ${actualStateRate === 0 ? 'success' : 'warning'}`} style={{ margin: 0, borderRadius: 8 }}>
                <div className="insight-icon">{actualStateRate === 0 ? '✓' : '⚠'}</div>
                <div className="insight-content">
                  <div className="insight-title">
                    {actualStateRate === 0
                      ? 'No state-tax drag on retirement income'
                      : stateProfile.retirementExempt
                      ? 'Retirement distributions are exempt'
                      : 'Retirement distributions are taxed at the state rate'}
                  </div>
                  <div className="insight-body">
                    {stateProfile.retirementExempt
                      ? 'Wages and rental income (if any) are taxed; 401(k)/IRA/Roth/Pension/SS are not.'
                      : 'IRA, 401(k), and pension distributions count as taxable ordinary income.'}
                  </div>
                </div>
              </div>
              {actualStateRate > 0 && (
                <div style={{ marginTop: 20 }}>
                  <ChartFrame caption="Bars are dollars of state tax paid each year; the line is state tax as a % of total income (MAGI).">
                    <StateTaxDrag proj={proj} real={real} height={260} />
                  </ChartFrame>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'irmaa' && (
          <>
            <div className="panel" style={{ marginBottom: 20 }}>
              <div className="panel-header">
                <div className="panel-title"><div className="panel-title-dot"></div>Projected MAGI vs IRMAA Thresholds</div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>2026 tier ceilings in {dollarLabel}</span>
              </div>
              <div className="panel-body">
                <ChartFrame caption={`Dashed lines are 2026 IRMAA tier ceilings in ${dollarLabel}. Where your MAGI line crosses one, Medicare premiums step up two years later.`}>
                  <IrmaaMagiLine proj={proj} real={real} height={320} />
                </ChartFrame>
              </div>
            </div>
            <div className="insight-card warning" style={{ marginBottom: 20, borderRadius: 'var(--radius)' }}>
              <div className="insight-icon">⚕</div>
              <div className="insight-content">
                <div className="insight-title">Medicare premium surcharges kick in when MAGI exceeds Tier 1</div>
                <div className="insight-body">IRMAA is a 2-year lookback: today's MAGI affects premiums 2 years later. Roth conversions in low-bracket years can keep future MAGI below the next tier and save hundreds to thousands of dollars per year in Part B and Part D add-ons.</div>
              </div>
            </div>
          </>
        )}


        <div className="panel">
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Roth Conversion Impact · Cumulative Tax</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>With vs Without conversions</span>
          </div>
          <div className="panel-body">
            <ChartFrame caption="With vs without Roth conversions. The gap is your lifetime federal tax delta from the conversion strategy.">
              <CumulativeTaxCompare cmp={cmp} real={real} height={260} />
            </ChartFrame>
            <div style={{ marginTop: 10, fontSize: 12, color: taxDelta < 0 ? 'var(--success)' : 'var(--text-muted)' }}>
              {taxDelta < 0
                ? `Conversions save ${fmtK(Math.abs(taxDelta))} in lifetime federal tax (${dollarLabel})`
                : taxDelta > 1000
                ? `Conversions add ${fmtK(taxDelta)} in lifetime federal tax (${dollarLabel}) — consider reducing scope`
                : 'Conversion impact is currently minimal — enable a conversion mode on the Strategy page'}
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Roth Conversion Impact · Portfolio Balance</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>With vs Without conversions</span>
          </div>
          <div className="panel-body">
            <ChartFrame caption="Higher line = more end-of-plan wealth retained after the conversion strategy plays out.">
              <BalanceCompare cmp={cmp} real={real} height={260} />
            </ChartFrame>
            <div style={{ marginTop: 10, fontSize: 12, color: balDelta > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
              {balDelta > 1000
                ? `End balance with conversions: +${fmtK(balDelta)} (${dollarLabel})`
                : balDelta < -1000
                ? `End balance with conversions: ${fmtK(balDelta)} (${dollarLabel})`
                : 'Negligible end-balance impact — enable a conversion mode on the Strategy page'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
