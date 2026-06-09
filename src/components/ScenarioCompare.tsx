import { useMemo } from 'react';
import { usePlanStore, useProjection } from '../store/usePlanStore';
import { evaluateAll } from '../engine/scenario';
import { initialWithdrawalRate } from '../engine/projection';
import { fmtM, fmtPct } from '../lib/format';

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
    pick: (proj) => proj.endTotalReal },
  { key: 'lifetimeTax', label: 'Lifetime Federal Tax', format: fmtM, better: 'lower',
    pick: (proj) => proj.lifetimeFedTax },
  { key: 'lifetimeRMD', label: 'Lifetime RMDs', format: fmtM, better: 'lower',
    pick: (proj) => proj.lifetimeRMD },
  { key: 'wdRate', label: 'Year-1 Withdrawal Rate', format: (v) => fmtPct(v, 2), better: 'lower',
    pick: (proj) => initialWithdrawalRate(proj) },
  { key: 'ranOut', label: 'Plan Runs Out?', format: (v) => v > 0 ? 'Yes' : 'No', better: 'lower',
    pick: (proj) => proj.ranOut ? 1 : 0 },
];

interface Props {
  /** When set, show only the most-recent N scenarios. Use undefined for "show all". */
  limit?: number;
  /** Which metrics to display. Defaults to all. */
  metricKeys?: string[];
  /** Show the "remove" × button per column. Default: true. */
  allowRemove?: boolean;
}

/** Side-by-side metric comparison of the base plan + saved scenarios.
 *  Used full-screen on the Compare page and as an embedded "Pinned Comparisons"
 *  panel on the Dashboard (with limit=3 and a "see all" link). */
export default function ScenarioCompare({ limit, metricKeys, allowRemove = true }: Props) {
  const plan = usePlanStore((s) => s.plan);
  const proj = useProjection();
  const allScenarios = usePlanStore((s) => s.scenarios);
  const removeScenario = usePlanStore((s) => s.removeScenario);

  // Most-recent-first when limit is set so the newest saved scenario shows up first.
  const sorted = useMemo(() => {
    if (limit === undefined) return allScenarios;
    return [...allScenarios]
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .slice(0, limit);
  }, [allScenarios, limit]);

  const visibleMetrics = useMemo(
    () => metricKeys ? METRICS.filter((m) => metricKeys.includes(m.key)) : METRICS,
    [metricKeys],
  );

  const results = useMemo(() => evaluateAll(plan, sorted), [plan, sorted]);

  const metricExtremes = useMemo(() => {
    const extremes: Record<string, { best: number; worst: number }> = {};
    for (const m of visibleMetrics) {
      const vals = [m.pick(proj, plan), ...results.map((r) => m.pick(r.projection, r.effectivePlan))];
      extremes[m.key] = m.better === 'higher'
        ? { best: Math.max(...vals), worst: Math.min(...vals) }
        : { best: Math.min(...vals), worst: Math.max(...vals) };
    }
    return extremes;
  }, [results, proj, plan, visibleMetrics]);

  if (allScenarios.length === 0) {
    return (
      <div style={{ padding: 16, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
        No saved scenarios. Use the What-if bar above to tweak inputs and click <strong>Save as scenario</strong> to pin a comparison.
      </div>
    );
  }

  return (
    <div style={{ overflow: 'auto', maxHeight: limit ? 360 : '78vh' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 800, fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ position: 'sticky', left: 0, background: 'var(--cream)', zIndex: 3, padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid var(--border)', minWidth: 180 }}>Metric</th>
            <th style={{ background: 'var(--cream)', padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid var(--border)', borderLeft: '2px solid var(--gold)', minWidth: 130 }}>
              <div style={{ fontWeight: 700 }}>Base Plan</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>Current inputs</div>
            </th>
            {results.map((r) => (
              <th key={r.id} style={{ background: 'var(--cream)', padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid var(--border)', minWidth: 140 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 4 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{r.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>Overrides applied</div>
                  </div>
                  {allowRemove && (
                    <button
                      onClick={() => removeScenario(r.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14, padding: 2 }}
                      title="Remove scenario"
                    >×</button>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleMetrics.map((m) => {
            const baseVal = m.pick(proj, plan);
            const ext = metricExtremes[m.key];
            return (
              <tr key={m.key}>
                <td style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 2, padding: '8px 12px', fontWeight: 600, borderBottom: '1px solid var(--border-light)' }}>
                  {m.label}
                </td>
                <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid var(--border-light)', borderLeft: '2px solid var(--gold)', fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>
                  {m.format(baseVal)}
                </td>
                {results.map((r) => {
                  const v = m.pick(r.projection, r.effectivePlan);
                  const isBest = v === ext.best && ext.best !== ext.worst;
                  const isWorst = v === ext.worst && ext.best !== ext.worst;
                  return (
                    <td key={r.id} style={{
                      padding: '8px 12px',
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
      {limit !== undefined && allScenarios.length > limit && (
        <div style={{ padding: '10px 14px', textAlign: 'right', background: 'rgba(13,27,46,0.02)', borderTop: '1px solid var(--border-light)', fontSize: 11, color: 'var(--text-muted)' }}>
          Showing {limit} of {allScenarios.length} scenarios. Remove pinned scenarios to surface others.
        </div>
      )}
    </div>
  );
}
