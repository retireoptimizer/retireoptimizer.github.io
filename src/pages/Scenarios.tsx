import { useMemo, useState } from 'react';
import { usePlanStore, useProjection } from '../store/usePlanStore';
import { evaluateAll, type Scenario } from '../engine/scenario';
import { compareWithWithoutConversion } from '../engine/comparison';
import { fmtM, fmtK, fmtPct } from '../lib/format';
import CumulativeTaxCompare from '../components/charts/CumulativeTaxCompare';
import BalanceCompare from '../components/charts/BalanceCompare';

interface MetricDef {
  key: string;
  label: string;
  format: (v: number) => string;
  better: 'higher' | 'lower';
  pick: (proj: ReturnType<typeof useProjection>, plan: ReturnType<typeof usePlanStore.getState>['plan']) => number;
}

const METRICS: MetricDef[] = [
  { key: 'longevity', label: 'Plan Longevity', format: (v) => `Age ${Math.round(v)}`, better: 'higher',
    pick: (proj) => {
      let age = 0;
      for (const r of proj.rows) { age = r.ageA; if (r.phase === 'Retire' && r.endTotal <= 0) return age; }
      return age;
    },
  },
  { key: 'endReal', label: 'End Balance (Today\'s $)', format: fmtM, better: 'higher',
    pick: (proj) => proj.endTotalReal,
  },
  { key: 'endNominal', label: 'End Balance (Nominal)', format: fmtM, better: 'higher',
    pick: (proj) => proj.endTotalNominal,
  },
  { key: 'lifetimeTax', label: 'Lifetime Federal Tax', format: fmtM, better: 'lower',
    pick: (proj) => proj.lifetimeFedTax,
  },
  { key: 'lifetimeRMD', label: 'Lifetime RMDs', format: fmtM, better: 'lower',
    pick: (proj) => proj.lifetimeRMD,
  },
  { key: 'lifetimeConv', label: 'Lifetime Conversions', format: fmtM, better: 'higher',
    pick: (proj) => proj.lifetimeConversion,
  },
  { key: 'wdRate', label: 'Year-1 Withdrawal Rate', format: (v) => fmtPct(v, 2), better: 'lower',
    pick: (proj, plan) => {
      const r = proj.rows.find((x) => x.ageA === plan.personA.retirementAge);
      return r && r.endTotal > 0 ? r.totalWD / r.endTotal : 0;
    },
  },
  { key: 'ranOut', label: 'Plan Runs Out?', format: (v) => v > 0 ? 'Yes' : 'No', better: 'lower',
    pick: (proj) => proj.ranOut ? 1 : 0,
  },
];

/** Templates are functions of the current plan so retirement-age deltas stay correct
 *  no matter what the user's current retire age is. */
const buildOverrideTemplates = (plan: ReturnType<typeof usePlanStore.getState>['plan']) => {
  const retire = plan.personA.retirementAge;
  const pfA = plan.portfolio.personA;
  const pfB = plan.portfolio.personB;
  return [
    { id: 'retire-earlier', name: 'Retire 3 Years Earlier', overrides: { personA: { retirementAge: Math.max(50, retire - 3) } } },
    { id: 'retire-later', name: 'Retire 3 Years Later', overrides: { personA: { retirementAge: Math.min(80, retire + 3) } } },
    { id: 'lower-return', name: 'Lower Returns (4%)', overrides: { assumptions: { postRetReturn: 0.04 } } },
    { id: 'higher-inflation', name: 'Higher Inflation (4%)', overrides: { assumptions: { inflation: 0.04 } } },
    { id: 'higher-savings', name: 'Save +50%', overrides: {
        portfolio: {
          personA: { annualContribution: Math.round(pfA.annualContribution * 1.5) },
          ...(pfB ? { personB: { annualContribution: Math.round(pfB.annualContribution * 1.5) } } : {}),
        },
      } },
    { id: 'reduce-spending', name: 'Reduce Spending 20%', overrides: {
        expenseStreams: plan.expenseStreams.map((e) => ({ ...e, annualAmount: Math.round(e.annualAmount * 0.8) })),
      } },
  ];
};

export default function Scenarios() {
  const plan = usePlanStore((s) => s.plan);
  const proj = useProjection();
  const scenarios = usePlanStore((s) => s.scenarios);
  const addScenario = usePlanStore((s) => s.addScenario);
  const removeScenario = usePlanStore((s) => s.removeScenario);
  const resetScenarios = usePlanStore((s) => s.resetScenarios);
  const [showAdd, setShowAdd] = useState(false);

  const results = useMemo(() => evaluateAll(plan, scenarios), [plan, scenarios]);
  const templates = useMemo(() => buildOverrideTemplates(plan), [plan]);
  const cmp = useMemo(() => compareWithWithoutConversion(plan), [plan]);

  const addFromTemplate = (tplId: string) => {
    const tpl = templates.find((t) => t.id === tplId);
    if (!tpl) return;
    const sc: Scenario = {
      id: `${tpl.id}-${Date.now()}`,
      name: tpl.name,
      overrides: tpl.overrides as Scenario['overrides'],
      createdAt: new Date().toISOString(),
    };
    addScenario(sc);
    setShowAdd(false);
  };

  // For each metric: find best/worst across base + scenarios
  const metricExtremes = useMemo(() => {
    const extremes: Record<string, { best: number; worst: number }> = {};
    for (const m of METRICS) {
      const vals = [m.pick(proj, plan), ...results.map((r) => m.pick(r.projection, r.effectivePlan))];
      extremes[m.key] = m.better === 'higher'
        ? { best: Math.max(...vals), worst: Math.min(...vals) }
        : { best: Math.min(...vals), worst: Math.max(...vals) };
    }
    return extremes;
  }, [results, proj, plan]);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">What-If</div>
            <div className="page-title">Scenario Manager</div>
            <div className="page-subtitle">Compare up to 10 named scenarios side by side</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-ghost" onClick={resetScenarios}>Reset to Defaults</button>
            <button className="btn btn-gold" onClick={() => setShowAdd(!showAdd)}>+ Add Scenario</button>
          </div>
        </div>
      </div>
      <div className="page-body">

        <div className="two-col" style={{ marginBottom: 20 }}>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Roth Conversion Impact · Cumulative Tax ($)</div>
            </div>
            <div className="panel-body">
              <CumulativeTaxCompare cmp={cmp} height={240} />
              <div style={{ marginTop: 10, fontSize: 12, color: cmp.lifetimeTaxDelta < 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                {cmp.lifetimeTaxDelta < 0
                  ? `Conversions save ${fmtK(Math.abs(cmp.lifetimeTaxDelta))} in lifetime federal tax`
                  : cmp.lifetimeTaxDelta > 1000
                  ? `Conversions add ${fmtK(cmp.lifetimeTaxDelta)} in lifetime federal tax — consider reducing scope`
                  : 'Conversion impact is currently minimal — enable a conversion mode on the Strategy page'}
              </div>
            </div>
          </div>
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Roth Conversion Impact · Portfolio Balance ($)</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>With vs Without conversions (today's $)</span>
            </div>
            <div className="panel-body">
              <BalanceCompare cmp={cmp} height={240} />
              <div style={{ marginTop: 10, fontSize: 12, color: cmp.endBalanceDelta > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                {cmp.endBalanceDelta > 1000
                  ? `End balance with conversions: +${fmtK(cmp.endBalanceDelta)} (today's $)`
                  : cmp.endBalanceDelta < -1000
                  ? `End balance with conversions: ${fmtK(cmp.endBalanceDelta)} (today's $)`
                  : 'Negligible end-balance impact — enable a conversion mode on the Strategy page'}
              </div>
            </div>
          </div>
        </div>

        {showAdd && (
          <div className="panel" style={{ marginBottom: 20 }}>
            <div className="panel-header">
              <div className="panel-title"><div className="panel-title-dot"></div>Add a Scenario</div>
              <button className="btn btn-outline" onClick={() => setShowAdd(false)} style={{ fontSize: 12, padding: '4px 10px' }}>Close</button>
            </div>
            <div className="panel-body">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                Pick a template (full editor coming soon — these mirror common what-ifs).
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {templates.map((t) => (
                  <button key={t.id} className="btn btn-outline" style={{ justifyContent: 'flex-start', padding: '12px 14px', textAlign: 'left' }} onClick={() => addFromTemplate(t.id)}>
                    + {t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflow: 'auto', maxHeight: '78vh' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 1100, fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: 'var(--cream)', zIndex: 3, padding: '12px 14px', textAlign: 'left', borderBottom: '2px solid var(--border)', minWidth: 200 }}>Metric</th>
                  <th style={{ background: 'var(--cream)', padding: '12px 14px', textAlign: 'right', borderBottom: '2px solid var(--border)', borderLeft: '2px solid var(--gold)', minWidth: 140 }}>
                    <div style={{ fontWeight: 700 }}>Base Plan</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>Current inputs</div>
                  </th>
                  {results.map((r) => (
                    <th key={r.id} style={{ background: 'var(--cream)', padding: '12px 14px', textAlign: 'right', borderBottom: '2px solid var(--border)', minWidth: 140 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 4 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{r.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>Overrides applied</div>
                        </div>
                        <button
                          onClick={() => removeScenario(r.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14, padding: 2 }}
                          title="Remove scenario"
                        >×</button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {METRICS.map((m) => {
                  const baseVal = m.pick(proj, plan);
                  const ext = metricExtremes[m.key];
                  return (
                    <tr key={m.key}>
                      <td style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 2, padding: '10px 14px', fontWeight: 600, borderBottom: '1px solid var(--border-light)' }}>
                        {m.label}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '1px solid var(--border-light)', borderLeft: '2px solid var(--gold)', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                        {m.format(baseVal)}
                      </td>
                      {results.map((r) => {
                        const v = m.pick(r.projection, r.effectivePlan);
                        const isBest = v === ext.best && ext.best !== ext.worst;
                        const isWorst = v === ext.worst && ext.best !== ext.worst;
                        return (
                          <td key={r.id} style={{
                            padding: '10px 14px',
                            textAlign: 'right',
                            borderBottom: '1px solid var(--border-light)',
                            fontFamily: "'DM Mono', monospace",
                            background: isBest ? 'rgba(26,138,90,0.08)' : isWorst ? 'rgba(192,57,43,0.08)' : undefined,
                            color: isBest ? 'var(--success)' : isWorst ? 'var(--danger)' : 'inherit',
                            fontWeight: isBest || isWorst ? 600 : 400,
                          }}>
                            {m.format(v)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 14px', fontSize: 11, color: 'var(--text-muted)', background: 'rgba(13,27,46,0.02)', borderTop: '1px solid var(--border-light)' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(26,138,90,0.4)', borderRadius: 2, verticalAlign: 'middle', marginRight: 6 }}></span>Best ·
            <span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(192,57,43,0.4)', borderRadius: 2, verticalAlign: 'middle', margin: '0 6px 0 12px' }}></span>Worst across scenarios for that metric.
          </div>
        </div>

        {scenarios.length === 0 && (
          <div className="panel" style={{ marginTop: 20, padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            No scenarios yet. Click <strong>+ Add Scenario</strong> to compare what-ifs side-by-side.
          </div>
        )}

      </div>
    </div>
  );
}

