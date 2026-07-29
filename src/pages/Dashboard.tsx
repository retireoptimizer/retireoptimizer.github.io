import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { usePlanStore, useProjection } from '../store/usePlanStore';
import { useOptimizerStore } from '../store/useOptimizerStore';
import { fmtM, fmtCompactWithSign } from '../lib/format';
import WhatIfBar from '../components/WhatIfBar';
import ScenarioCompare from '../components/ScenarioCompare';
import StrategyChooser from '../components/StrategyChooser';
import type { Scenario } from '../engine/scenario';
import { depletionAge, initialWithdrawalRate } from '../engine/projection';
import PortfolioTrajectory from '../components/charts/PortfolioTrajectory';
import BucketCompositionStacked from '../components/charts/BucketCompositionStacked';
import IncomeSourcesArea from '../components/charts/IncomeSourcesArea';
import CashFlowSankey from '../components/charts/CashFlowSankey';
import ChartFrame from '../components/charts/ChartFrame';
import { compareWithWithoutConversion } from '../engine/comparison';
import { explainPolicy } from '../engine/explain/optimizerRationale';

export default function Dashboard() {
  const navigate = useNavigate();
  const plan = usePlanStore((s) => s.plan);
  const proj = useProjection();
  const displayMode = usePlanStore((s) => s.displayMode);
  const real = displayMode === 'real';
  const addScenario = usePlanStore((s) => s.addScenario);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const optimizerResult = useOptimizerStore((s) => s.result);

  const cmp = useMemo(() => compareWithWithoutConversion(plan), [plan]);
  const rationale = useMemo(() => optimizerResult ? explainPolicy(plan, optimizerResult) : [], [plan, optimizerResult]);
  const A = plan.personA;

  const cmpEndBalanceDelta = real
    ? cmp.endBalanceDelta
    : cmp.withConv.endTotalNominal - cmp.noConv.endTotalNominal;
  const cmpLifetimeTaxDelta = real
    ? cmp.withConv.lifetimeFedTaxReal - cmp.noConv.lifetimeFedTaxReal
    : cmp.lifetimeTaxDelta;
  const cmpLifetimeRMDDelta = real
    ? cmp.withConv.lifetimeRMDReal - cmp.noConv.lifetimeRMDReal
    : cmp.lifetimeRMDDelta;
  const cmpEndRothDelta = real
    ? cmp.endRothDelta
    : (cmp.withConv.rows[cmp.withConv.rows.length - 1]?.endRoth ?? 0) -
      (cmp.noConv.rows[cmp.noConv.rows.length - 1]?.endRoth ?? 0);

  const retireRow = proj.rows.find((r) => r.ageA === A.retirementAge);
  const wdRate = initialWithdrawalRate(proj);
  const depAge = depletionAge(proj);
  const longevityAge = depAge ?? A.planToAge;
  const planLasts = depAge === null;

  const lifetimeSS = proj.rows.reduce((s, r) => s + (real ? r.totalSS / r.inflationFactor : r.totalSS), 0);
  const lifetimeAllInTax = proj.rows.reduce((s, r) => s + (real ? (r.fedTax + r.stateTaxAmt + r.irmaa) / r.inflationFactor : r.fedTax + r.stateTaxAmt + r.irmaa), 0);
  const lifetimeIRMAA = proj.rows.reduce((s, r) => s + (real ? r.irmaa / r.inflationFactor : r.irmaa), 0);
  const retirementYears = A.planToAge - A.retirementAge;
  const yearsFunded = planLasts ? retirementYears : (depAge ?? A.planToAge) - A.retirementAge;
  const rothActive = proj.lifetimeConversion > 1000;
  const retireRows = proj.rows.filter((r) => r.phase === 'Retire' || r.phase === 'Survivor');
  const initialRow = retireRows.find((r) => r.totalSS > 0) ?? retireRows[Math.floor(retireRows.length / 2)] ?? retireRow;
  const defaultYearIdx = Math.max(0, proj.rows.findIndex((r) => r.ageA === (initialRow?.ageA ?? A.retirementAge)));
  const [yearIdx, setYearIdx] = useState<number>(defaultYearIdx);
  const yearRow = proj.rows[Math.min(yearIdx, proj.rows.length - 1)] ?? proj.rows[0];

  return (
    <div className="page">
      <div className="page-body">

        {/* ── Plan Summary — compact dark banner ── */}
        <div style={{
          background: 'linear-gradient(135deg, #0d1b2e 0%, #16294a 100%)',
          borderRadius: 12,
          marginBottom: 14,
          padding: '18px 20px',
          border: '1px solid rgba(201,168,76,0.22)',
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          flexWrap: 'wrap',
        }}>
          {/* Label + status badge */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginRight: 24, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.4px', color: '#c9a84c', whiteSpace: 'nowrap' }}>
              Plan Summary
            </span>
            <span className={`badge ${planLasts ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: 11, padding: '4px 10px' }}>
              {planLasts ? '✓ Fully Funded' : `⚠ Funded through Age ${longevityAge}`}
            </span>
            {optimizerResult && (
              <button
                onClick={() => setRationaleOpen(true)}
                style={{ fontSize: 11, padding: 0, background: 'transparent', border: 'none', color: 'rgba(201,168,76,0.75)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              >
                explain optimization rationale →
              </button>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1, flexWrap: 'wrap' }}>
            <HeroStat label="End Balance" value={fmtM(real ? proj.endTotalReal : proj.endTotalNominal)} valueColor={planLasts ? '#4ade80' : '#fbbf24'} sub={`age ${A.planToAge} · ${real ? "today's $" : 'nominal'}`} />
            <Divider />
            <HeroStat label="Years Funded" value={`${yearsFunded} / ${retirementYears}`} valueColor={planLasts ? '#4ade80' : '#fbbf24'} sub="retirement yrs" />
            <Divider />
            <HeroStat label="Initial WR" value={wdRate > 0 ? (wdRate * 100).toFixed(2) + '%' : '—'} sub="year-1 draw" />
            <Divider />
            <HeroStat label="Lifetime SS" value={fmtM(lifetimeSS)} valueColor="#4ade80" sub={real ? "today's $" : 'nominal'} />
            <Divider />
            <HeroStat label="All-in Tax" value={fmtM(lifetimeAllInTax)} valueColor="#f87171" sub={`fed + state + IRMAA · ${real ? "today's $" : 'nominal'}`} />
            <Divider />
            <HeroStat label="Lifetime IRMAA" value={fmtM(lifetimeIRMAA)} valueColor="#fb923c" sub={real ? "today's $" : 'Medicare surcharge'} />
            <Divider />
            <HeroStat label="Lifetime RMDs" value={fmtM(real ? proj.lifetimeRMDReal : proj.lifetimeRMD)} valueColor="#fbbf24" sub={real ? "today's $" : 'forced draws'} />
            <Divider />
            <HeroStat label="Roth Converted" value={fmtM(real ? proj.lifetimeConversionReal : proj.lifetimeConversion)} valueColor="#c9a84c" sub={real ? "today's $" : 'lifetime'} />
          </div>
        </div>

        {/* Roth conversion benefit strip */}
        <div style={{ marginBottom: 14, padding: '11px 14px', borderRadius: 8, background: rothActive ? 'rgba(26,138,90,0.06)' : 'rgba(13,27,46,0.03)', border: '1px solid var(--border-light)' }}>
          {rothActive ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--success)' }}>Roth Conversion Benefit</span>
              <Benefit label="End balance" delta={cmpEndBalanceDelta} goodWhen="positive" />
              <Benefit label="Lifetime tax" delta={cmpLifetimeTaxDelta} goodWhen="negative" />
              <Benefit label="Lifetime RMDs" delta={cmpLifetimeRMDDelta} goodWhen="negative" />
              <Benefit label="Roth legacy" delta={cmpEndRothDelta} goodWhen="positive" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>vs. no conversions ({real ? "today's $" : 'nominal'})</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-secondary)' }}>No Roth conversions active.</strong> Model <strong>Bracket Fill</strong> on the ⚙ Customize sheet to see the lifetime tax, RMD, and tax-free-legacy trade-off.
            </div>
          )}
        </div>

        {/* Adjust Withdrawal Strategies */}
        <StrategyChooser />
        <WhatIfBar />

        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Portfolio Trajectory ({real ? "Today's $" : 'Nominal $'})</div>
            <span className="badge badge-neutral" style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)' }}>Stacked by bucket</span>
          </div>
          <div className="panel-body">
            <ChartFrame caption="Stacked balances by bucket over time. Hover for the year-by-year split.">
              <PortfolioTrajectory proj={proj} real={real} height={300} />
            </ChartFrame>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Bucket Composition Over Time (%)</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)' }}>How Taxable / Pre-tax / Roth mix evolves year by year</span>
          </div>
          <div className="panel-body">
            <BucketCompositionStacked proj={proj} height={240} />
          </div>
        </div>

        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Income Sources Over Time</div>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)' }}>Stacked by source</span>
          </div>
          <div className="panel-body">
            <ChartFrame caption="Where retirement spending will come from in each year.">
              <IncomeSourcesArea proj={proj} real={real} height={240} />
            </ChartFrame>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Cash Flow at Age {yearRow?.ageA}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', width: 220 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, whiteSpace: 'nowrap' }}>
                Age
              </label>
              <input type="range" min={0} max={proj.rows.length - 1} value={yearIdx}
                onChange={(e) => setYearIdx(parseInt(e.target.value, 10))}
                style={{ flex: 1, accentColor: 'var(--gold)' }} aria-label="Cash-flow year selector" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', minWidth: 28, textAlign: 'right' }}>
                {yearRow?.ageA}
              </span>
            </div>
          </div>
          <div className="panel-body">
            {yearRow ? (
              <ChartFrame caption="Sources flow into spending, taxes, and savings. Drag the age slider in the header to view a different year.">
                <CashFlowSankey row={yearRow} real={real} height={380} />
              </ChartFrame>
            ) : null}
          </div>
        </div>

        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Pinned Comparisons</div>
            <button className="btn btn-ghost" onClick={() => setShowTemplatePicker((v) => !v)} style={{ fontSize: 11, padding: '4px 10px', position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)' }}>
              {showTemplatePicker ? 'Close' : '+ Add From Template'}
            </button>
          </div>
          {showTemplatePicker && (
            <div className="panel-body" style={{ borderBottom: '1px solid var(--border-light)', padding: '12px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                Pre-built what-ifs. For free-form exploration, use the What-if bar above.
              </div>
              <div className="template-picker-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                {scenarioTemplates(plan).map((t) => (
                  <button
                    key={t.id}
                    className="btn btn-outline"
                    style={{ justifyContent: 'flex-start', padding: '10px 12px', textAlign: 'left', fontSize: 12 }}
                    onClick={() => {
                      const sc: Scenario = {
                        id: `${t.id}-${Date.now()}`,
                        name: t.name,
                        overrides: t.overrides,
                        createdAt: new Date().toISOString(),
                      };
                      addScenario(sc);
                      setShowTemplatePicker(false);
                    }}
                  >+ {t.name}</button>
                ))}
              </div>
            </div>
          )}
          <div className="panel-body" style={{ padding: 0 }}>
            <ScenarioCompare limit={3} metricKeys={['longevity', 'endReal', 'lifetimeTax', 'wdRate']} allowRemove />
          </div>
        </div>

        <div className="panel" style={{ marginTop: 20, background: 'rgba(13,27,46,0.02)', borderStyle: 'dashed' }}>
          <div className="panel-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px' }}>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Deep-dive: <strong style={{ color: 'var(--text)' }}>Projections</strong> · <strong style={{ color: 'var(--text)' }}>Taxes &amp; Roth</strong> · <strong style={{ color: 'var(--text)' }}>Monte Carlo</strong>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => navigate('/projections')} style={{ fontSize: 12 }}>Projections →</button>
              <button className="btn btn-ghost" onClick={() => navigate('/taxes')} style={{ fontSize: 12 }}>Taxes →</button>
            </div>
          </div>
        </div>

      </div>

      {/* Optimizer Rationale Modal */}
      {rationaleOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,27,46,0.55)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={() => setRationaleOpen(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: 14, maxWidth: 560, width: '100%', padding: '28px 32px', maxHeight: '80vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)' }}>Optimizer Rationale</div>
              <button onClick={() => setRationaleOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
            </div>
            {optimizerResult && (
              <>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                  Goal: <strong>{optimizerResult.headlineLabel}</strong> — {optimizerResult.headline}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                  {optimizerResult.evaluations.toLocaleString()} projections evaluated
                </div>
              </>
            )}
            {rationale.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
                {rationale.map((line, i) => (
                  <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>{line}</li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No rationale available for the current optimizer result.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HeroStat({ label, value, sub, valueColor }: { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 80, padding: '2px 8px' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'rgba(255,255,255,0.58)' }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: valueColor ?? 'rgba(255,255,255,0.95)', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Benefit({ label, delta, goodWhen }: { label: string; delta: number; goodWhen: 'positive' | 'negative' }) {
  const beneficial = goodWhen === 'positive' ? delta > 0 : delta < 0;
  const color = Math.abs(delta) < 1000 ? 'var(--text-muted)' : beneficial ? 'var(--success)' : 'var(--danger)';
  return (
    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
      {label} <strong style={{ color, fontFamily: "'DM Mono', monospace" }}>{fmtCompactWithSign(delta)}</strong>
    </span>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 44, background: 'rgba(255,255,255,0.12)', marginRight: 18, flexShrink: 0 }} />;
}


function scenarioTemplates(plan: ReturnType<typeof usePlanStore.getState>['plan']): Array<{
  id: string;
  name: string;
  overrides: Scenario['overrides'];
}> {
  const retire = plan.personA.retirementAge;
  const pfA = plan.portfolio.personA;
  const pfB = plan.portfolio.personB;
  return [
    { id: 'retire-earlier', name: 'Retire 3 Years Earlier', overrides: { personA: { retirementAge: Math.max(50, retire - 3) } } as Scenario['overrides'] },
    { id: 'retire-later',   name: 'Retire 3 Years Later',   overrides: { personA: { retirementAge: Math.min(80, retire + 3) } } as Scenario['overrides'] },
    { id: 'lower-return',   name: 'Lower Returns (4%)',     overrides: { assumptions: { taxableReturn: 0.04, tradReturn: 0.04, rothReturn: 0.04 } } as Scenario['overrides'] },
    { id: 'higher-inflation', name: 'Higher Inflation (4%)', overrides: { assumptions: { inflation: 0.04 } } as Scenario['overrides'] },
    { id: 'higher-savings', name: 'Save +50%', overrides: {
        portfolio: {
          personA: { annualContribution: Math.round(pfA.annualContribution * 1.5) },
          ...(pfB ? { personB: { annualContribution: Math.round(pfB.annualContribution * 1.5) } } : {}),
        },
      } as Scenario['overrides'] },
    { id: 'reduce-spending', name: 'Reduce Spending 20%', overrides: {
        expenseStreams: plan.expenseStreams.map((e) => ({ ...e, annualAmount: Math.round(e.annualAmount * 0.8) })),
      } as Scenario['overrides'] },
  ];
}
