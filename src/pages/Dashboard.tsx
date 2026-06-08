import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { usePlanStore, useProjection } from '../store/usePlanStore';
import { fmtM, fmtK, fmtPct } from '../lib/format';
import GoalModal from '../components/GoalModal';
import WhatIfBar from '../components/WhatIfBar';
import ScenarioCompare from '../components/ScenarioCompare';
import StrategyChooser from '../components/StrategyChooser';
import type { Scenario } from '../engine/scenario';
import { evaluateGoals } from '../engine/goals';
import { depletionAge } from '../engine/projection';
import PortfolioTrajectory from '../components/charts/PortfolioTrajectory';
import BucketCompositionStacked from '../components/charts/BucketCompositionStacked';
import IncomeSourcesArea from '../components/charts/IncomeSourcesArea';
import CashFlowSankey from '../components/charts/CashFlowSankey';
import ChartFrame from '../components/charts/ChartFrame';
import { computeHealth } from '../engine/health';
import { compareWithWithoutConversion } from '../engine/comparison';
import { generateInsights, insightsForSurface } from '../engine/explain';
import InsightCard from '../components/InsightCard';
import { fmtCompactWithSign } from '../lib/format';

export default function Dashboard() {
  const navigate = useNavigate();
  const plan = usePlanStore((s) => s.plan);
  const proj = useProjection();
  const displayMode = usePlanStore((s) => s.displayMode);
  const real = displayMode === 'real';
  const addGoal = usePlanStore((s) => s.addGoal);
  const removeGoal = usePlanStore((s) => s.removeGoal);
  const addScenario = usePlanStore((s) => s.addScenario);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const health = useMemo(() => computeHealth(plan), [plan]);
  const cmp = useMemo(() => compareWithWithoutConversion(plan), [plan]);
  const insights = useMemo(() => insightsForSurface(generateInsights(plan, proj), 'dashboard').slice(0, 3), [plan, proj]);
  const goalStatuses = useMemo(() => evaluateGoals(plan, proj), [plan, proj]);
  const A = plan.personA;
  const startYear = new Date().getFullYear();
  const ageA = startYear - parseInt(A.dob.slice(0, 4), 10);

  // Find the row at the planned retirement age
  const retireRow = proj.rows.find((r) => r.ageA === A.retirementAge);
  const finalRow = proj.rows[proj.rows.length - 1];

  // Initial withdrawal rate — Year-1 WD ÷ portfolio at retirement (start-of-year).
  // endTotal is end-of-year so we add totalWD back to approximate start-of-year balance.
  // Same convention as LiveMetricsBar so the two cards always agree.
  let safeWR = 0;
  if (retireRow && (retireRow.endTotal + retireRow.totalWD) > 0) {
    safeWR = retireRow.totalWD / (retireRow.endTotal + retireRow.totalWD);
  }

  // Plan longevity: depletion age if the portfolio runs to zero, otherwise plan-to age.
  const depAge = depletionAge(proj);
  const longevityAge = depAge ?? A.planToAge;
  const planLasts = depAge === null;

  // Roth conversion opportunity: first year's 12% bracket headroom
  const yr1 = proj.rows[0];
  const inflF = yr1?.inflationFactor ?? 1;
  const bracket12Top = 96950 * inflF;
  const stdD = yr1?.stdDeduction ?? 31500;
  const baseInc = (yr1?.totalSS ?? 0) * 0.85 + (yr1?.otherIncome ?? 0) + (yr1?.rmd ?? 0);
  const convHeadroom = Math.max(0, bracket12Top - stdD - baseInc);

  // Cash-flow year (shared between donut and sankey). Default to the first retirement year
  // where SS is active so the donut doesn't render all-Withdrawals at retire age.
  const retireRows = proj.rows.filter((r) => r.phase === 'Retire' || r.phase === 'Survivor');
  const initialRow = retireRows.find((r) => r.totalSS > 0) ?? retireRows[Math.floor(retireRows.length / 2)] ?? retireRow;
  const defaultYearIdx = Math.max(0, proj.rows.findIndex((r) => r.ageA === (initialRow?.ageA ?? A.retirementAge)));
  const [yearIdx, setYearIdx] = useState<number>(defaultYearIdx);
  const yearRow = proj.rows[Math.min(yearIdx, proj.rows.length - 1)] ?? proj.rows[0];


  // Plan-derived "implicit" goals shown when no custom goals are defined
  const implicitGoals: Array<{ id?: string; name: string; detail: string; pct: number; status: 'on-track' | 'at-risk' | 'off-track' }> = [
    { name: `Retire at ${A.retirementAge}`, detail: `Projected: ${fmtM(retireRow?.endTotal ?? 0)} at age ${A.retirementAge}`, pct: planLasts ? 100 : 75, status: planLasts ? 'on-track' : 'at-risk' },
    { name: `Fund plan through age ${A.planToAge}`, detail: planLasts ? `Plan lasts full horizon` : `Runs out at age ${longevityAge}`, pct: planLasts ? 100 : Math.round(((longevityAge - A.retirementAge) / (A.planToAge - A.retirementAge)) * 100), status: planLasts ? 'on-track' : 'off-track' },
    { name: 'Tax-free legacy (Roth)', detail: `End Roth: ${fmtM((finalRow?.endRoth ?? 0) / (finalRow?.inflationFactor ?? 1))} (today's $)`, pct: Math.min(100, Math.round(((finalRow?.endRoth ?? 0) / (finalRow?.inflationFactor ?? 1) / 500_000) * 100)), status: 'on-track' },
  ];
  const customGoals = goalStatuses.map((g) => ({
    id: g.goal.id,
    name: g.goal.name,
    detail: g.detail,
    pct: Math.round(Math.min(1, g.percentFunded) * 100),
    status: g.status,
  }));
  const goals = [...implicitGoals, ...customGoals];

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
              View Projections
            </button>
          </div>
        </div>
      </div>
      <div className="page-body">

        <WhatIfBar defaultExpanded />
        <StrategyChooser />

        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Portfolio Trajectory ({real ? "Today's $" : 'Nominal $'})</div>
            <span className="badge badge-neutral">Stacked by bucket</span>
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
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>How Taxable / Pre-tax / Roth mix evolves year by year</span>
          </div>
          <div className="panel-body">
            <BucketCompositionStacked proj={proj} height={240} />
          </div>
        </div>

        {insights.length > 0 && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Insights</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>What the engine notices about your plan</span>
            </div>
            <div className="panel-body">
              {insights.map((i) => <InsightCard key={i.id} insight={i} />)}
            </div>
          </div>
        )}

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
                  {Math.abs(cmp.lifetimeTaxDelta) > 1000 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {fmtCompactWithSign(cmp.lifetimeTaxDelta)} vs. no conversions
                    </div>
                  )}
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
                  <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: 'var(--success)' }}>{fmtM(real ? proj.endTotalReal : proj.endTotalNominal)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {real ? "Today's $" : 'Nominal $'}
                    {Math.abs(cmp.endBalanceDelta) > 1000 && (
                      <> · {fmtCompactWithSign(cmp.endBalanceDelta)} vs. no conv</>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Plan Health</div>
              <span className={`badge ${health.band === 'excellent' || health.band === 'good' ? 'badge-success' : health.band === 'improve' ? 'badge-warning' : 'badge-danger'}`}>
                {health.band === 'excellent' ? 'Excellent' : health.band === 'good' ? 'On Track' : health.band === 'improve' ? 'Improve' : 'At Risk'}
              </span>
            </div>
            <div className="panel-body" style={{ paddingTop: 12 }}>
              <div className="health-gauge-wrap">
                <svg className="gauge-arc" width="160" height="90" viewBox="0 0 160 90">
                  <path d="M 15 85 A 65 65 0 0 1 145 85" fill="none" stroke="rgba(13,27,46,0.08)" strokeWidth="12" strokeLinecap="round"/>
                  <path d="M 15 85 A 65 65 0 0 1 145 85" fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round" strokeDasharray="204" strokeDashoffset={Math.max(0, 204 - (health.overall / 100) * 204)}/>
                  <defs>
                    <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#c9a84c"/>
                      <stop offset="60%" stopColor="#1a8a5a"/>
                    </linearGradient>
                  </defs>
                </svg>
                <div className="health-score">{health.overall}</div>
                <div className="health-label">{health.summary}</div>
              </div>
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {health.subscores.map((s) => (
                  <div key={s.key} className="subscore-row" title={s.detail}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: s.band === 'excellent' || s.band === 'good' ? 'var(--success)' : s.band === 'improve' ? 'var(--warning)' : 'var(--danger)' }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>/ 100</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Priority Actions from health engine */}
        {health.actions.length > 0 && (
          <div className="panel" style={{ marginTop: 20 }}>
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Priority Actions</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Top items to improve plan health</span>
            </div>
            <div className="panel-body">
              {health.actions.map((a) => (
                <div key={a.priority} className={`insight-card ${a.tone === 'success' ? 'success' : a.tone === 'warning' ? 'warning' : 'info'}`}>
                  <div className="insight-icon">{a.tone === 'success' ? '✓' : a.tone === 'warning' ? '⚠' : '💡'}</div>
                  <div className="insight-content">
                    <div className="insight-title">{a.title}</div>
                    <div className="insight-body">{a.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="two-col" style={{ marginTop: 20 }}>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Income Sources Over Time</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stacked by source</span>
            </div>
            <div className="panel-body">
              <ChartFrame caption="Where retirement spending will come from in each year. The line on the right uses a year-by-year breakdown.">
                <IncomeSourcesArea proj={proj} real={real} height={240} />
              </ChartFrame>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Cash Flow at Age {yearRow?.ageA}</div>
              <div className="panel-actions" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                  View age
                </label>
                <input type="range" min={0} max={proj.rows.length - 1} value={yearIdx}
                  onChange={(e) => setYearIdx(parseInt(e.target.value, 10))}
                  style={{ width: 180 }} aria-label="Cash-flow year selector" />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', minWidth: 28, textAlign: 'right' }}>
                  {yearRow?.ageA}
                </span>
              </div>
            </div>
            <div className="panel-body">
              {yearRow ? (
                <ChartFrame caption="Sources (left) flow into spending, taxes, and savings (right). Drag the slider to view a different year.">
                  <CashFlowSankey row={yearRow} height={240} />
                </ChartFrame>
              ) : null}
            </div>
          </div>
        </div>

        {/* Goal Tracker */}
        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Goal Tracker</div>
            <button className="btn btn-outline" onClick={() => setGoalModalOpen(true)} style={{ fontSize: 12, padding: '6px 12px' }}>+ Add Goal</button>
          </div>
          <div className="panel-body" style={{ padding: '8px 24px' }}>
            {goals.map((g) => (
              <div key={g.id ?? g.name} className="goal-item">
                <div>
                  <div className="goal-name">{g.name}</div>
                  <div className="goal-detail">{g.detail}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${g.status === 'on-track' ? 'badge-success' : 'badge-warning'}`}>
                    {g.status === 'on-track' ? 'On Track' : g.status === 'at-risk' ? 'At Risk' : 'Off Track'}
                  </span>
                  {g.id && (
                    <button onClick={() => removeGoal(g.id!)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14 }} title="Remove goal">×</button>
                  )}
                </div>
                <div className="goal-bar-wrap">
                  <div className="goal-bar-bg">
                    <div className={`goal-bar-fill ${g.status}`} style={{ width: `${Math.min(100, g.pct)}%` }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <GoalModal open={goalModalOpen} onClose={() => setGoalModalOpen(false)} onSave={(g) => { addGoal(g); setGoalModalOpen(false); }} />

        <div className="panel" style={{ marginTop: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Pinned Comparisons</div>
            <button className="btn btn-ghost" onClick={() => setShowTemplatePicker((v) => !v)} style={{ fontSize: 11, padding: '4px 10px' }}>
              {showTemplatePicker ? 'Close' : '+ Add From Template'}
            </button>
          </div>
          {showTemplatePicker && (
            <div className="panel-body" style={{ borderBottom: '1px solid var(--border-light)', padding: '12px 18px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
                Pre-built what-ifs. For free-form exploration, use the What-if bar above (or on Projections).
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
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
              Want to dig deeper? <strong style={{ color: 'var(--text)' }}>Tax Planning</strong> shows the tax drag and Roth-conversion impact · <strong style={{ color: 'var(--text)' }}>Portfolio</strong> shows balance impact · <strong style={{ color: 'var(--text)' }}>Projections</strong> has the full year-by-year math.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => navigate('/taxes')} style={{ fontSize: 12 }}>Tax →</button>
              <button className="btn btn-ghost" onClick={() => navigate('/projections')} style={{ fontSize: 12 }}>Projections →</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/** Inline templates for "+ Add From Template" in the Pinned Comparisons panel.
 *  Each template is a function of the current plan so retirement-age deltas
 *  stay correct no matter what the user's current retire age is. */
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
    { id: 'lower-return',   name: 'Lower Returns (4%)',     overrides: { assumptions: { postRetReturn: 0.04 } } as Scenario['overrides'] },
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
