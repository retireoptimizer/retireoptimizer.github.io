import React, { useMemo, useState } from 'react';
import { usePlanStore, useProjection } from '../store/usePlanStore';
import { useOptimizerStore } from '../store/useOptimizerStore';
import { useWhatIfStore } from '../store/useWhatIfStore';
import { planInputKey } from '../engine/planInputKey';
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
import TaxAdjustedBreakdown from '../components/TaxAdjustedBreakdown';

const GOAL_LABELS: Record<string, string> = {
  'max-end-balance': 'Max End Balance',
  'max-sustainable-spending': 'Max Spending',
  'min-retirement-age': 'Earliest Retire',
};

export default function Dashboard() {
  const plan = usePlanStore((s) => s.plan);
  const applyOptimizerResult = usePlanStore((s) => s.applyOptimizerResult);
  const displayMode = usePlanStore((s) => s.displayMode);
  const real = displayMode === 'real';
  const addScenario = usePlanStore((s) => s.addScenario);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [rationaleOpen, setRationaleOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const optimizerResult = useOptimizerStore((s) => s.result);
  const pendingPlan = useOptimizerStore((s) => s.pendingPlan);
  const pendingGoal = useOptimizerStore((s) => s.pendingGoal);
  const setPendingPlan = useOptimizerStore((s) => s.setPendingPlan);
  const setPendingGoal = useOptimizerStore((s) => s.setPendingGoal);
  const setPlanKey = useOptimizerStore((s) => s.setPlanKey);
  const setResult = useOptimizerStore((s) => s.setResult);
  const proj = useProjection(pendingPlan ?? undefined);

  const effectivePlan = pendingPlan ?? plan;
  const cmp = useMemo(() => compareWithWithoutConversion(effectivePlan), [effectivePlan]);
  const rationale = useMemo(() => optimizerResult ? explainPolicy(effectivePlan, optimizerResult) : [], [effectivePlan, optimizerResult]);
  const A = effectivePlan.personA;

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
  const firstRetireRow = proj.rows.find((r) => (r.phase === 'Retire' || r.phase === 'SemiRetire' || r.phase === 'Survivor') && r.netSpend > 0);
  const annualSpend = firstRetireRow
    ? (real ? firstRetireRow.netSpend / firstRetireRow.inflationFactor : firstRetireRow.netSpend)
    : 0;
  const wdRate = initialWithdrawalRate(proj);
  const depAge = depletionAge(proj);
  const longevityAge = depAge ?? A.planThroughAge;
  const planLasts = depAge === null;

  const lifetimeSS = proj.rows.reduce((s, r) => s + (real ? r.totalSS / r.inflationFactor : r.totalSS), 0);
  const lifetimeAllInTax = proj.rows.reduce((s, r) => s + (real ? (r.fedTax + r.stateTaxAmt + r.irmaa + r.niit) / r.inflationFactor : r.fedTax + r.stateTaxAmt + r.irmaa + r.niit), 0);
  const lifetimeIRMAA = proj.rows.reduce((s, r) => s + (real ? r.irmaa / r.inflationFactor : r.irmaa), 0);
  const retirementYears = A.planThroughAge - A.retirementAge;
  const yearsFunded = planLasts ? retirementYears : (depAge ?? A.planThroughAge) - A.retirementAge;
  const rothActive = proj.lifetimeConversion > 1000;
  const asm = effectivePlan.assumptions;
  const taxAdjActive = (asm.taxAdjOrdRate ?? 0.22) > 0 || (asm.taxAdjLtcgRate ?? 0) > 0;
  const lastRow = proj.rows[proj.rows.length - 1];
  const endAgeSub = (() => {
    if (!lastRow) return `age ${A.planThroughAge}`;
    const B = effectivePlan.personB;
    if (B && lastRow.phase === 'Survivor' && lastRow.ageB !== undefined)
      return `${B.name} age ${lastRow.ageB}`;
    return `age ${lastRow.ageA}`;
  })();
  const retireRows = proj.rows.filter((r) => r.phase === 'Retire' || r.phase === 'Survivor');
  const initialRow = retireRows.find((r) => r.totalSS > 0) ?? retireRows[Math.floor(retireRows.length / 2)] ?? retireRow;
  const defaultYearIdx = Math.max(0, proj.rows.findIndex((r) => r.ageA === (initialRow?.ageA ?? A.retirementAge)));
  const [yearIdx, setYearIdx] = useState<number>(defaultYearIdx);
  const yearRow = proj.rows[Math.min(yearIdx, proj.rows.length - 1)] ?? proj.rows[0];

  const resetWhatIf = useWhatIfStore((s) => s.reset);

  const handleApply = () => {
    if (!pendingPlan) return;
    applyOptimizerResult(pendingPlan);
    setPlanKey(planInputKey(pendingPlan));
    setPendingPlan(null);
    setPendingGoal(null);
    resetWhatIf();
  };

  const handleDiscard = () => {
    setPendingPlan(null);
    setPendingGoal(null);
    setResult(null);
  };

  return (
    <div className="page">
      <div className="page-body">

        {/* ── Pending optimizer result banner ── */}
        {pendingPlan && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 10,
            background: 'rgba(201,168,76,0.10)', border: '1px solid rgba(201,168,76,0.35)',
            borderRadius: 10, padding: '10px 18px', marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#7a5c10' }}>
                {pendingGoal ? GOAL_LABELS[pendingGoal] ?? pendingGoal : 'Optimizer'} result ready
              </span>
              <span style={{ fontSize: 12, color: '#9a7830' }}>— not yet saved to your plan</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={handleApply}
                className="btn btn-gold"
                style={{ fontSize: 12, padding: '5px 14px' }}
              >
                Apply to Plan
              </button>
              <button
                onClick={handleDiscard}
                style={{ background: 'none', border: 'none', fontSize: 12, color: '#9a7830', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', padding: 0 }}
              >
                Discard
              </button>
            </div>
          </div>
        )}

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
              {planLasts ? `✓ Fully Funded · ${retirementYears} yrs` : `⚠ Funded through Age ${longevityAge} · ${yearsFunded}/${retirementYears} yrs`}
            </span>
            {optimizerResult && (
              <button
                onClick={() => setRationaleOpen(true)}
                style={{ fontSize: 11, padding: 0, background: 'transparent', border: 'none', color: 'var(--gold)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', textDecoration: 'underline', fontWeight: 600 }}
              >
                explain optimization rationale →
              </button>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1, flexWrap: 'wrap' }}>
            <HeroStat label="End Balance" value={fmtM(real ? proj.endTotalReal : proj.endTotalNominal)} valueColor={planLasts ? '#4ade80' : '#fbbf24'} sub={`${endAgeSub} · ${real ? "today's $" : 'nominal $'}`} title="Ending portfolio value at the end of the plan horizon, before any adjustment for tax still owed on it." />
            {taxAdjActive && <>
              <Divider />
              <HeroStat
                label="Tax-Adj Balance"
                value={fmtM(real ? proj.endTaxAdjustedReal : proj.endTaxAdjustedNominal)}
                valueColor="#c9a84c"
                sub={<button onClick={() => setBreakdownOpen(true)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.72)', cursor: 'pointer', fontSize: 10, padding: 0, fontFamily: 'inherit', textDecoration: 'underline' }}>end bal after tax · breakdown →</button>}
                title="The same ending balance, less estimated tax still owed on pre-tax accounts and unrealized gains. Roth is untaxed. Click breakdown for detail."
              />
            </>}
            <Divider />
            <HeroStat label="Annual Spending" value={annualSpend > 0 ? fmtM(annualSpend) : '—'} sub={real ? "today's $" : 'nominal $'} />
            <Divider />
            <HeroStat label="Initial WR" value={wdRate > 0 ? (wdRate * 100).toFixed(2) + '%' : '—'} sub="year-1 draw" />
            <Divider />
            <HeroStat label="Lifetime SS" value={fmtM(lifetimeSS)} valueColor="#4ade80" sub={real ? "today's $" : 'nominal $'} />
            <Divider />
            <HeroStat label="All-in Tax" value={fmtM(lifetimeAllInTax)} valueColor="#f87171" sub={`fed + state + IRMAA + NIIT · ${real ? "today's $" : 'nominal $'}`} />
            <Divider />
            <HeroStat label="Lifetime IRMAA" value={fmtM(lifetimeIRMAA)} valueColor="#fb923c" sub={real ? "today's $" : 'Medicare surcharge'} />
            <Divider />
            <HeroStat label="Lifetime RMDs" value={fmtM(real ? proj.lifetimeRMDReal : proj.lifetimeRMD)} valueColor="#fbbf24" sub={real ? "today's $" : 'forced draws'} />
            <Divider />
            <HeroStat label="Roth Converted" value={fmtM(real ? proj.lifetimeConversionReal : proj.lifetimeConversion)} valueColor="#c9a84c" sub={real ? "today's $" : 'lifetime'} />
          </div>

          {/* Roth conversion benefit — integrated into Plan Summary banner */}
          <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.12)', marginTop: 14, paddingTop: 12 }}>
            {rothActive ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#c9a84c' }}>Roth Conversion Benefit</span>
                <BenefitDark label="End balance" delta={cmpEndBalanceDelta} goodWhen="positive" />
                <BenefitDark label="Lifetime tax" delta={cmpLifetimeTaxDelta} goodWhen="negative" />
                <BenefitDark label="Lifetime RMDs" delta={cmpLifetimeRMDDelta} goodWhen="negative" />
                <BenefitDark label="Roth legacy" delta={cmpEndRothDelta} goodWhen="positive" />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>vs. no conversions ({real ? "today's $" : 'nominal $'})</span>
              </div>
            ) : (
              <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.38)' }}>
                No Roth conversions active. Pick <strong style={{ color: 'rgba(255,255,255,0.55)' }}>Bracket-Fill</strong> under <strong style={{ color: 'rgba(255,255,255,0.55)' }}>Roth conversions</strong> in the Strategy panel to see the lifetime tax, RMD, and legacy trade-off.
              </div>
            )}
          </div>
        </div>

        {proj.overrideEvents.length > 0 && (() => {
          const first = proj.overrideEvents[0];
          const last = proj.overrideEvents[proj.overrideEvents.length - 1];
          const ageRange = first.age === last.age ? `age ${first.age}` : `ages ${first.age}–${last.age}`;
          return (
            <div style={{
              background: '#fff8e1', border: '1px solid #f59e0b', borderRadius: 6,
              padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#78350f',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 16, lineHeight: '18px' }}>⚠</span>
              <div>
                <strong>Bracket-fill ceiling overridden at {ageRange}</strong> — taxable and Roth accounts were depleted and spending could not be covered within the bracket-fill ceiling. Traditional draws exceeded the ceiling to prevent unfunded expenses. Without this override, the plan would stop funding retirement at age {first.age}.
              </div>
            </div>
          );
        })()}

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
            <BucketCompositionStacked proj={proj} real={real} height={240} />
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
                {scenarioTemplates(effectivePlan).map((t) => (
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

      </div>

      {/* Tax-Adjusted Breakdown Modal */}
      {breakdownOpen && taxAdjActive && (
        <TaxAdjustedBreakdown
          proj={proj}
          plan={effectivePlan}
          real={real}
          onClose={() => setBreakdownOpen(false)}
        />
      )}

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

function HeroStat({ label, value, sub, valueColor, title }: { label: string; value: string; sub?: React.ReactNode; valueColor?: string; title?: string }) {
  return (
    <div style={{ flex: 1, minWidth: 80, padding: '2px 8px' }} title={title}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'rgba(255,255,255,0.58)' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: valueColor ?? 'rgba(255,255,255,0.95)', lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.72)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function BenefitDark({ label, delta, goodWhen }: { label: string; delta: number; goodWhen: 'positive' | 'negative' }) {
  const beneficial = goodWhen === 'positive' ? delta > 0 : delta < 0;
  const color = Math.abs(delta) < 1000 ? 'rgba(255,255,255,0.35)' : beneficial ? '#4ade80' : '#f87171';
  return (
    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>
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
