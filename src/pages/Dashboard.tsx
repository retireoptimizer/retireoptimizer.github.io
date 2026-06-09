import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { usePlanStore, useProjection } from '../store/usePlanStore';
import { fmtM } from '../lib/format';
import GoalModal from '../components/GoalModal';
import WhatIfBar from '../components/WhatIfBar';
import ScenarioCompare from '../components/ScenarioCompare';
import StrategyChooser from '../components/StrategyChooser';
import type { Scenario } from '../engine/scenario';
import { evaluateGoals } from '../engine/goals';
import { depletionAge, initialWithdrawalRate } from '../engine/projection';
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

  // Find the row at the planned retirement age
  const retireRow = proj.rows.find((r) => r.ageA === A.retirementAge);
  const finalRow = proj.rows[proj.rows.length - 1];

  // Initial withdrawal rate — single source of truth (engine helper, matches the top bar).
  const wdRate = initialWithdrawalRate(proj);

  // Plan longevity: depletion age if the portfolio runs to zero, otherwise plan-to age.
  const depAge = depletionAge(proj);
  const longevityAge = depAge ?? A.planToAge;
  const planLasts = depAge === null;

  // Roth conversions only "active" once they move a meaningful amount of Traditional → Roth.
  const rothActive = proj.lifetimeConversion > 1000;

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
      <div className="page-body">

        <WhatIfBar />
        <StrategyChooser />

        {/* ── Plan Summary: one consolidated headline set (health + lifetime figures + Roth benefit) ── */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Plan Summary</div>
            <span className={`badge ${health.band === 'excellent' || health.band === 'good' ? 'badge-success' : health.band === 'improve' ? 'badge-warning' : 'badge-danger'}`}>
              {health.band === 'excellent' ? 'Excellent' : health.band === 'good' ? 'On Track' : health.band === 'improve' ? 'Improve' : 'At Risk'}
            </span>
          </div>
          <div className="panel-body">
            {/* Compact health strip: score + linear gauge + summary on one line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, flex: '0 0 auto' }}>
                <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 34, fontWeight: 700, color: 'var(--navy)', lineHeight: 1 }}>{health.overall}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/100</span>
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ height: 7, borderRadius: 4, background: 'rgba(13,27,46,0.08)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${health.overall}%`, borderRadius: 4, background: 'linear-gradient(90deg, #c9a84c, #1a8a5a)' }} />
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 5 }}>{health.summary}</div>
              </div>
            </div>

            {/* Headline figures */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
              <Stat label="End Balance" value={fmtM(real ? proj.endTotalReal : proj.endTotalNominal)} color="var(--success)" sub={planLasts ? `age ${A.planToAge} · ${real ? "today's $" : 'nominal $'}` : `⚠ runs out age ${longevityAge}`} />
              <Stat label="Initial WR" value={wdRate > 0 ? (wdRate * 100).toFixed(2) + '%' : '—'} sub="year-1 draw" />
              <Stat label="Lifetime Fed Tax" value={fmtM(proj.lifetimeFedTax)} color="var(--danger)" sub="nominal · all years" />
              <Stat label="Lifetime RMDs" value={fmtM(proj.lifetimeRMD)} color="var(--warning)" sub="forced draws" />
              <Stat label="Roth Conversions" value={fmtM(proj.lifetimeConversion)} color="var(--gold)" sub="lifetime" />
            </div>

            {/* Health sub-scores */}
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {health.subscores.map((s) => (
                <div key={s.key} className="subscore-row" title={s.detail}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: s.band === 'excellent' || s.band === 'good' ? 'var(--success)' : s.band === 'improve' ? 'var(--warning)' : 'var(--danger)' }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>/ 100</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Roth conversion benefit — at a glance */}
            <div style={{ marginTop: 16, padding: '11px 14px', borderRadius: 8, background: rothActive ? 'rgba(26,138,90,0.06)' : 'rgba(13,27,46,0.03)', border: '1px solid var(--border-light)' }}>
              {rothActive ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--success)' }}>Roth Conversion Benefit</span>
                  <Benefit label="End balance" delta={cmp.endBalanceDelta} goodWhen="positive" />
                  <Benefit label="Lifetime tax" delta={cmp.lifetimeTaxDelta} goodWhen="negative" />
                  <Benefit label="Lifetime RMDs" delta={cmp.lifetimeRMDDelta} goodWhen="negative" />
                  <Benefit label="Roth legacy" delta={cmp.endRothDelta} goodWhen="positive" />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>vs. no conversions (today's $)</span>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>No Roth conversions active.</strong> Model <strong>Bracket Fill</strong> on the ⚙ Customize sheet (Strategy Chooser above) to see the lifetime tax, RMD, and tax-free-legacy trade-off.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginBottom: 16 }}>
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

/** Compact headline figure used in the Plan Summary hero. */
function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Playfair Display',serif", color: color ?? 'var(--text-primary)', lineHeight: 1.15 }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

/** A single Roth-conversion benefit delta, colored by whether the change helps. */
function Benefit({ label, delta, goodWhen }: { label: string; delta: number; goodWhen: 'positive' | 'negative' }) {
  const beneficial = goodWhen === 'positive' ? delta > 0 : delta < 0;
  const color = Math.abs(delta) < 1000 ? 'var(--text-muted)' : beneficial ? 'var(--success)' : 'var(--danger)';
  return (
    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
      {label} <strong style={{ color, fontFamily: "'DM Mono', monospace" }}>{fmtCompactWithSign(delta)}</strong>
    </span>
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
