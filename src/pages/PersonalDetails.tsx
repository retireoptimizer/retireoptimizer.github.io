import { useMemo } from 'react';
import { usePlanStore } from '../store/usePlanStore';
import { NumberInput } from '../components/inputs/NumberInput';
import InlineEcho from '../components/InlineEcho';
import { listStates } from '../engine/stateTax';
import { runProjection, depletionAge } from '../engine/projection';
import { fmtM } from '../lib/format';

const ageFromDob = (iso: string): number => {
  if (!iso || iso.length < 4) return 0;
  return new Date().getFullYear() - parseInt(iso.slice(0, 4), 10);
};

export default function PersonalDetails() {
  const plan = usePlanStore((s) => s.plan);
  const setPersonA = usePlanStore((s) => s.setPersonA);
  const setPersonB = usePlanStore((s) => s.setPersonB);
  const addPersonB = usePlanStore((s) => s.addPersonB);
  const removePersonB = usePlanStore((s) => s.removePersonB);
  const setAssumptions = usePlanStore((s) => s.setAssumptions);
  const setStateField = usePlanStore((s) => s.setState);

  const A = plan.personA;
  const B = plan.personB;
  const asm = plan.assumptions;

  // Lightweight derived facts to echo under the inputs. Memoized so we don't
  // re-run the engine on every keystroke into an unrelated field.
  const proj = useMemo(() => runProjection(plan), [plan]);
  const currentAgeA = ageFromDob(A.dob);
  const yearsToRetire = Math.max(0, A.retirementAge - currentAgeA);
  const retireRow = proj.rows.find((r) => r.ageA === A.retirementAge);
  const projectedAtRetire = retireRow ? retireRow.endTotal / retireRow.inflationFactor : 0;
  const dep = depletionAge(proj);
  const lasts = dep === null;
  const longevity = dep ?? A.planToAge;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Inputs</div>
            <div className="page-title">Personal Details</div>
            <div className="page-subtitle">Profile, ages, retirement timeline, and plan assumptions</div>
          </div>
          <div className="header-actions">
            <button className="btn btn-gold">Save Changes</button>
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="panel">
          <div className="panel-body">
            <div className="form-section">
              <div className="form-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="section-number">1</div>Client Profiles
                </div>
                {B ? (
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }} onClick={removePersonB}>
                    Remove Spouse / Partner
                  </button>
                ) : (
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px', background: 'transparent', color: 'var(--gold)', border: '1px solid var(--gold)' }} onClick={addPersonB}>
                    + Add Spouse / Partner
                  </button>
                )}
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{A.name || 'Person A'} — Full Name</label>
                  <input type="text" value={A.name} placeholder="Your name" onChange={(e) => setPersonA({ name: e.target.value })} />
                </div>
                {B && (
                  <div className="form-group">
                    <label>{B.name || 'Person B'} — Full Name</label>
                    <input type="text" value={B.name} placeholder="Spouse / partner name" onChange={(e) => setPersonB({ name: e.target.value })} />
                  </div>
                )}
                <div className="form-group">
                  <label>{A.name || 'Person A'} — Date of Birth</label>
                  <input
                    type="date"
                    value={A.dob}
                    onChange={(e) => { if (e.target.value) setPersonA({ dob: e.target.value }); }}
                  />
                  <div className="helper-text">Age {ageFromDob(A.dob)} · Born {A.dob.slice(0, 4)}</div>
                </div>
                {B && (
                  <div className="form-group">
                    <label>{B.name || 'Person B'} — Date of Birth</label>
                    <input
                      type="date"
                      value={B.dob}
                      onChange={(e) => { if (e.target.value) setPersonB({ dob: e.target.value }); }}
                    />
                    <div className="helper-text">Age {ageFromDob(B.dob)} · Born {B.dob.slice(0, 4)}</div>
                  </div>
                )}
                <div className="form-group">
                  <label>{A.name || 'Person A'} — Target Retirement Age</label>
                  <NumberInput value={A.retirementAge} digits={0} min={40} max={80} onCommit={(v) => setPersonA({ retirementAge: Math.round(v) })} />
                  <InlineEcho>
                    Retires in {yearsToRetire} year{yearsToRetire === 1 ? '' : 's'} · Projected portfolio at retirement: <strong>{fmtM(projectedAtRetire)}</strong> (today's $)
                  </InlineEcho>
                </div>
                {B && (
                  <div className="form-group">
                    <label>{B.name || 'Person B'} — Target Retirement Age</label>
                    <NumberInput value={B.retirementAge} digits={0} min={40} max={80} onCommit={(v) => setPersonB({ retirementAge: Math.round(v) })} />
                  </div>
                )}
                <div className="form-group">
                  <label>{A.name || 'Person A'} — Plan-To Age</label>
                  <NumberInput value={A.planToAge} digits={0} min={70} max={110} onCommit={(v) => setPersonA({ planToAge: Math.round(v) })} />
                  <div className="helper-text">Projection horizon</div>
                  <InlineEcho tone={lasts ? 'positive' : 'warning'}>
                    {lasts ? `Plan funds through age ${A.planToAge} ✓` : `Plan runs out at age ${longevity} ⚠`}
                  </InlineEcho>
                </div>
                {B && (
                  <div className="form-group">
                    <label>{B.name || 'Person B'} — Plan-To Age</label>
                    <NumberInput value={B.planToAge} digits={0} min={70} max={110} onCommit={(v) => setPersonB({ planToAge: Math.round(v) })} />
                  </div>
                )}
                <div className="form-group" style={{ gridColumn: '1 / -1', padding: '12px 14px', background: 'rgba(13,27,46,0.03)', border: '1px solid var(--border-light)', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 4 }}>Social Security</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    SS is entered as one or more rows on <a href="/income" style={{ color: 'var(--gold)', textDecoration: 'underline' }}>Income Streams</a> with type=SS — one row per claiming phase. Compute the per-phase amounts in your preferred SS-strategy tool and enter the results here.
                  </div>
                </div>
              </div>
            </div>

            <hr className="divider" />

            <div className="form-section">
              <div className="form-section-title"><div className="section-number">2</div>Survivor Assumptions</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{A.name || 'Person A'} — Expected Passing Age</label>
                  <NumberInput value={A.passingAge} digits={0} min={60} max={115} onCommit={(v) => setPersonA({ passingAge: Math.round(v) })} />
                  <div className="helper-text">Used for survivor SS and filing-status switch</div>
                </div>
                {B && (
                  <div className="form-group">
                    <label>{B.name || 'Person B'} — Expected Passing Age</label>
                    <NumberInput value={B.passingAge} digits={0} min={60} max={115} onCommit={(v) => setPersonB({ passingAge: Math.round(v) })} />
                  </div>
                )}
              </div>
            </div>

            <hr className="divider" />

            <div className="form-section">
              <div className="form-section-title"><div className="section-number">3</div>Market &amp; Inflation Assumptions</div>
              <div className="form-grid-4">
                <div className="form-group">
                  <label>Pre-Retirement Return</label>
                  <div className="input-suffix-wrap">
                    <NumberInput value={asm.preRetReturn} scale={100} digits={1} onCommit={(v) => setAssumptions({ preRetReturn: v })} />
                    <span className="input-suffix">%</span>
                  </div>
                  <div className="helper-text">Nominal annualized</div>
                </div>
                <div className="form-group">
                  <label>Post-Retirement Return</label>
                  <div className="input-suffix-wrap">
                    <NumberInput value={asm.postRetReturn} scale={100} digits={1} onCommit={(v) => setAssumptions({ postRetReturn: v })} />
                    <span className="input-suffix">%</span>
                  </div>
                </div>
                <div className="form-group">
                  <label>Inflation Rate</label>
                  <div className="input-suffix-wrap">
                    <NumberInput value={asm.inflation} scale={100} digits={1} onCommit={(v) => setAssumptions({ inflation: v })} />
                    <span className="input-suffix">%</span>
                  </div>
                </div>
                <div className="form-group">
                  <label>RMD Start Age</label>
                  <NumberInput value={asm.rmdStartAge} digits={0} min={70} max={80} onCommit={(v) => setAssumptions({ rmdStartAge: Math.round(v) })} />
                  <div className="helper-text">SECURE 2.0 (born 1960+)</div>
                </div>
                <div className="form-group">
                  <label>Contribution Growth</label>
                  <div className="input-suffix-wrap">
                    <NumberInput value={asm.contribGrowth} scale={100} digits={1} onCommit={(v) => setAssumptions({ contribGrowth: v })} />
                    <span className="input-suffix">%</span>
                  </div>
                </div>
              </div>
            </div>

            <hr className="divider" />

            <div className="form-section">
              <div className="form-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="section-number">4</div>
                  ACA Healthcare (Pre-Medicare)
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={asm.modelACA}
                    onChange={(e) => setAssumptions({ modelACA: e.target.checked })}
                    style={{ accentColor: 'var(--gold)', width: 15, height: 15 }}
                  />
                  Model ACA premiums
                </label>
              </div>
              {asm.modelACA ? (
                <div className="form-grid-4">
                  <div className="form-group">
                    <label>Annual Premium (today's $)</label>
                    <div className="input-suffix-wrap">
                      <span className="input-suffix" style={{ left: 0, right: 'auto', paddingLeft: 10 }}>$</span>
                      <NumberInput value={asm.acaBenchmarkPremium} digits={0} style={{ paddingLeft: 22 }} onCommit={(v) => setAssumptions({ acaBenchmarkPremium: v })} />
                    </div>
                    <div className="helper-text">{asm.acaNoSubsidy ? 'Full cost paid — inflation-scaled each year.' : 'SLCSP benchmark (healthcare.gov). Subsidy reduces your actual cost based on income each year.'}</div>
                  </div>
                  {!asm.acaNoSubsidy && (
                    <div className="form-group">
                      <label>Household Size</label>
                      <NumberInput value={asm.acaHouseholdSize} digits={0} min={1} max={8} onCommit={(v) => setAssumptions({ acaHouseholdSize: Math.round(v) })} />
                      <div className="helper-text">People on the plan</div>
                    </div>
                  )}
                  <div className="form-group" style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        checked={asm.acaNoSubsidy}
                        onChange={(e) => setAssumptions({ acaNoSubsidy: e.target.checked })}
                        style={{ accentColor: 'var(--gold)', width: 15, height: 15 }}
                      />
                      No subsidy (COBRA / full-cost coverage)
                    </label>
                  </div>
                </div>
              ) : (
                <p className="helper-text" style={{ margin: '4px 0 0' }}>
                  Enable to add pre-Medicare healthcare costs. Use ACA marketplace with income-based subsidy, or enter your full premium for COBRA / retiree coverage.
                </p>
              )}
            </div>

            <hr className="divider" />

            <div className="form-section">
              <div className="form-section-title"><div className="section-number">5</div>State of Residence</div>
              <div className="form-grid">
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Current State</label>
                  <select value={plan.state} onChange={(e) => setStateField(e.target.value)}>
                    {listStates().map((s) => (
                      <option key={s.code} value={s.code}>{s.name} ({s.code}) — {s.note}</option>
                    ))}
                  </select>
                  <div className="helper-text">Tax-free states (TX/FL/WA) are exact; CA/NY/IL use simplified flat-rate approximations.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
