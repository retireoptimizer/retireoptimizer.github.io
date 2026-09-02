import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Plan } from '../schemas/plan';
import type { OptimizeResult } from '../engine/optimizer';
import type { PolicyRationale } from '../engine/explain/optimizerRationale';
import type { DecisionTrace, Counterfactual, SettingImpact } from '../engine/explain/decisionTrace';
import type { YearDecision } from '../engine/explain/yearDecisions';
import { buildDiagnosticsMarkdown, copyDiagnosticsToClipboard } from '../engine/explain/diagnosticsMarkdown';
import { fmtM, fmtCompactWithSign } from '../lib/format';

const GOAL_LABELS: Record<string, string> = {
  'max-end-balance': 'Max End Balance',
  'max-sustainable-spending': 'Max Spending',
  'min-retirement-age': 'Earliest Retire',
};

const KIND_LABELS: Record<Counterfactual['kind'], string> = {
  conversion: 'Conversion alternatives',
  ordering: 'Withdrawal ordering',
  taxSourcing: 'Tax sourcing',
  assumption: 'Rate assumptions',
};

interface Props {
  plan: Plan;
  optimizerResult: OptimizeResult;
  rationale: PolicyRationale;
  trace: DecisionTrace | null;
  decisionNotes?: YearDecision[];
  onClose: () => void;
  onReoptimize?: (patch: Partial<Plan>) => void;
}

function DeltaCell({ cf, isRunnerUp, onReoptimize }: {
  cf: Counterfactual;
  isRunnerUp: boolean;
  onReoptimize?: () => void;
}) {
  const { delta, reoptimizable } = cf;
  // Class B = reoptimizable (settings rows — positive deltas expected and permanent)
  // Class A = !reoptimizable (ordering + conv-off — positive delta is an optimizer miss)
  const isClassB = reoptimizable === true;
  const TIED_THRESHOLD = 500; // below this in today's $, treat as effectively tied
  const significant = Math.abs(delta) >= TIED_THRESHOLD;
  const chosenWins = delta <= 0;

  let color = 'var(--text-muted)';
  if (significant) {
    if (chosenWins) color = '#16a34a';       // green: chosen better
    else if (isClassB) color = '#d97706';    // amber: opportunity (expected for settings)
    else color = '#dc2626';                  // red: optimizer miss for Class A
  }

  const showReoptimize = reoptimizable && !chosenWins && significant && onReoptimize;

  return (
    <td style={{ fontSize: 12, textAlign: 'right', padding: '6px 8px', whiteSpace: 'nowrap' }}>
      <span style={{ color, fontWeight: isRunnerUp ? 700 : 400, fontFamily: "'DM Mono', monospace" }}>
        {significant ? fmtCompactWithSign(delta) : '≈ tied'}
      </span>
      {showReoptimize && (
        <button
          onClick={onReoptimize}
          style={{ marginLeft: 6, fontSize: 10, padding: '2px 6px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
        >
          Re-optimize →
        </button>
      )}
    </td>
  );
}

function LedgerTable({ cfs, runnerUpId, onReoptimize }: {
  cfs: Counterfactual[];
  runnerUpId: string | null;
  onReoptimize?: (patch: Partial<Plan>) => void;
}) {
  const kindOrder: Counterfactual['kind'][] = ['conversion', 'ordering', 'taxSourcing', 'assumption'];
  const groups = kindOrder
    .map((k) => ({ kind: k, rows: cfs.filter((c) => c.kind === k) }))
    .filter((g) => g.rows.length > 0);

  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-light)' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Alternative</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Tax-Adj End</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Fed Tax</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>Conversions</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>vs Chosen</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <React.Fragment key={g.kind}>
              <tr>
                <td colSpan={5} style={{ padding: '10px 8px 2px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-secondary)', background: '#f8f9fa' }}>
                  {KIND_LABELS[g.kind]}
                </td>
              </tr>
              {g.kind === 'ordering' && (
                <tr style={{ background: '#f8f9fa' }}>
                  <td colSpan={5} style={{ padding: '0 8px 6px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Conversions pinned to the chosen schedule — each row isolates only the draw order
                  </td>
                </tr>
              )}
              {g.rows.map((cf) => {
                const isRunnerUp = cf.id === runnerUpId;
                const dimmed = !cf.applicable;
                return (
                  <tr
                    key={cf.id}
                    style={{
                      borderBottom: '1px solid var(--border-light)',
                      background: isRunnerUp ? 'rgba(201,168,76,0.07)' : 'transparent',
                      opacity: dimmed ? 0.45 : 1,
                    }}
                  >
                    <td style={{ padding: '7px 8px', maxWidth: 280 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: isRunnerUp ? 600 : 400 }}>
                          {cf.label}
                        </span>
                        {isRunnerUp && (
                          <span style={{ fontSize: 10, color: 'var(--gold)', fontWeight: 700 }}>★ runner-up</span>
                        )}
                        {cf.id === 'conv-off' && cf.applicable && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>ordering re-optimized</span>
                        )}
                        {cf.applicable && cf.ranOut && (
                          <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>depletes</span>
                        )}
                      </div>
                      {dimmed && cf.note && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic', lineHeight: 1.4 }}>{cf.note}</div>
                      )}
                    </td>
                    {cf.applicable ? (
                      <>
                        <td style={{ fontSize: 12, textAlign: 'right', padding: '7px 8px', color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>{fmtM(cf.score)}</td>
                        <td style={{ fontSize: 12, textAlign: 'right', padding: '7px 8px', color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>{fmtM(cf.lifetimeFedTaxReal)}</td>
                        <td style={{ fontSize: 12, textAlign: 'right', padding: '7px 8px', color: 'var(--text-secondary)', fontFamily: "'DM Mono', monospace" }}>{fmtM(cf.lifetimeConversionReal)}</td>
                        <DeltaCell
                          cf={cf}
                          isRunnerUp={isRunnerUp}
                          onReoptimize={cf.planPatch && onReoptimize ? () => onReoptimize(cf.planPatch!) : undefined}
                        />
                      </>
                    ) : (
                      <td colSpan={4} />
                    )}
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        All figures in today's $. "Tax-Adj End" applies your assumed effective rates to remaining pre-tax and taxable gains — this is the optimizer's scoring objective.
      </div>
    </div>
  );
}

function RateSensitivitySection({ ordRate }: { ordRate: NonNullable<DecisionTrace['ordRate']> }) {
  const { activeRate, breakevenRate, robustAcrossBand, atMinus5pp, atActive, atPlus5pp } = ordRate;
  const signSwitches = (atMinus5pp > 0) !== (atPlus5pp > 0);

  const breakevenSentence = breakevenRate !== null
    ? `Conversions win as long as your future effective rate exceeds ${(breakevenRate * 100).toFixed(1)}%; you assumed ${(activeRate * 100).toFixed(0)}%.`
    : 'Rate sensitivity is negligible — both plans have similar end traditional balances.';

  const cells = [
    { label: `${((activeRate - 0.05) * 100).toFixed(0)}% rate`, val: atMinus5pp },
    { label: `${(activeRate * 100).toFixed(0)}% assumed`, val: atActive, isActive: true },
    { label: `${((activeRate + 0.05) * 100).toFixed(0)}% rate`, val: atPlus5pp, isLast: true },
  ];

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Terminal rate sensitivity</div>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>
        {breakevenSentence}
        {' '}
        {signSwitches
          ? <span style={{ color: '#d97706', fontWeight: 600 }}>Decision flips within the ±5pp band — rate-sensitive.</span>
          : robustAcrossBand
            ? <span style={{ color: '#16a34a' }}>Robust across the full ±5pp band.</span>
            : null}
      </p>
      <div style={{ display: 'flex', border: '1px solid var(--border-light)', borderRadius: 8, overflow: 'hidden' }}>
        {cells.map(({ label, val, isActive, isLast }) => (
          <div key={label} style={{
            flex: 1, padding: '10px 12px', textAlign: 'center',
            background: isActive ? '#f0f4f8' : 'transparent',
            borderRight: isLast ? 'none' : '1px solid var(--border-light)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: val > 0 ? '#16a34a' : '#dc2626' }}>
              {fmtCompactWithSign(val)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>conv advantage</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsImpactSection({ settings }: { settings: SettingImpact[] }) {
  const active = settings.filter((s) => !s.inert);
  if (active.length === 0) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Key settings that shaped this plan</div>
      <div style={{ border: '1px solid var(--border-light)', borderRadius: 8, overflow: 'hidden' }}>
        {active.map((s, i) => (
          <div
            key={s.id}
            style={{
              padding: '10px 14px',
              borderBottom: i < active.length - 1 ? '1px solid var(--border-light)' : 'none',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{s.label}</span>
              <span style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: 'var(--text-secondary)' }}>{s.value}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>{s.effect}</div>
            {s.bestAlternative && (
              <div style={{ fontSize: 11, color: '#d97706', marginTop: 3, fontWeight: 600 }}>
                Better result possible: {s.bestAlternative}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const SEVERITY_ORDER: Record<YearDecision['severity'], number> = { warning: 0, caution: 1, info: 2 };

function YearDecisionsSection({ notes, onClose }: { notes: YearDecision[]; onClose: () => void }) {
  const navigate = useNavigate();
  const notable = notes
    .filter((n) => n.binding && n.severity !== 'info')
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    .slice(0, 6);

  if (notable.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Year-by-year decisions</div>
      <div style={{ border: '1px solid var(--border-light)', borderRadius: 8, overflow: 'hidden' }}>
        {notable.map((n, i) => (
          <div
            key={`${n.year}-${n.code}`}
            style={{
              padding: '10px 14px',
              borderBottom: i < notable.length - 1 ? '1px solid var(--border-light)' : 'none',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: n.severity === 'warning' ? '#dc2626' : '#d97706', whiteSpace: 'nowrap', marginTop: 1 }}>
              Age {n.ageA}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.55, flex: 1 }}>{n.text}</span>
            <button
              onClick={() => { onClose(); navigate('/projections'); }}
              style={{ fontSize: 11, padding: '2px 8px', background: 'none', border: '1px solid var(--border-light)', borderRadius: 4, cursor: 'pointer', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontFamily: 'inherit', flexShrink: 0 }}
            >
              See in table →
            </button>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
        Binding constraints only — the factor that set the actual number in each year. See all years on the <button onClick={() => { onClose(); navigate('/projections'); }} style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>Projections page</button>.
      </div>
    </div>
  );
}

export default function OptimizerRationaleModal({ plan, optimizerResult, rationale, trace, decisionNotes, onClose, onReoptimize }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleCopy = useCallback(async () => {
    const md = buildDiagnosticsMarkdown(plan, optimizerResult, rationale, trace);
    await copyDiagnosticsToClipboard(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [plan, optimizerResult, rationale, trace]);

  const decisionSection = rationale.sections.find((s) => s.kind === 'decision');
  const timingSection = rationale.sections.find((s) => s.kind === 'timing');
  const insightSection = rationale.sections.find((s) => s.kind === 'insights');

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(13,27,46,0.55)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, maxWidth: 720, width: '100%', padding: '28px 32px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)' }}>Optimizer Rationale</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              Goal: <strong style={{ color: 'var(--text-secondary)' }}>{GOAL_LABELS[optimizerResult.goal] ?? optimizerResult.goal}</strong>
              {' · '}{optimizerResult.evaluations.toLocaleString()} projections evaluated
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: '0 0 0 8px' }}>×</button>
        </div>

        {/* 2. Headline + insights (key patterns surface first) */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)', marginBottom: 8, lineHeight: 1.4 }}>{rationale.headline}</div>
          {insightSection && insightSection.items.length > 0 && (
            <ul style={{ margin: '0 0 8px', paddingLeft: 20, lineHeight: 1.7 }}>
              {insightSection.items.map((item, i) => (
                <li key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>{item}</li>
              ))}
            </ul>
          )}
          {decisionSection?.items.map((item, i) => (
            <p key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 6px', lineHeight: 1.65 }}>{item}</p>
          ))}
          {timingSection?.items.map((item, i) => (
            <p key={i} style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 6px', lineHeight: 1.65 }}>{item}</p>
          ))}
        </div>

        {/* 3. What it beat */}
        {trace && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)', marginBottom: 2 }}>What it beat</div>
            <LedgerTable
              cfs={trace.counterfactuals}
              runnerUpId={trace.runnerUpId}
              onReoptimize={onReoptimize}
            />
          </div>
        )}

        {/* 4. Terminal rate sensitivity */}
        {trace?.ordRate && <RateSensitivitySection ordRate={trace.ordRate} />}

        {/* 5. Key settings — hidden for now; data preserved in trace.settings */}
        {/* {trace && trace.settings.length > 0 && <SettingsImpactSection settings={trace.settings} />} */}

        {/* 6. Year-by-year decisions */}
        {decisionNotes && decisionNotes.length > 0 && (
          <YearDecisionsSection notes={decisionNotes} onClose={onClose} />
        )}

        {/* 7. Footnotes */}
        {trace && trace.degraded.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 10, marginBottom: 16 }}>
            {trace.degraded.map((note, i) => (
              <p key={i} style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px', fontStyle: 'italic', lineHeight: 1.5 }}>{note}</p>
            ))}
          </div>
        )}

        {/* 8. Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
          <button
            onClick={handleCopy}
            className="btn btn-outline"
            style={{ fontSize: 13, minWidth: 148 }}
          >
            {copied ? 'Copied!' : 'Copy diagnostics'}
          </button>
          <button onClick={onClose} className="btn btn-outline" style={{ fontSize: 13 }}>Close</button>
        </div>
      </div>
    </div>
  );
}
