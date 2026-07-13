import { useMemo } from 'react';
import { usePlanStore } from '../store/usePlanStore';
import { NumberInput } from '../components/inputs/NumberInput';
import InlineEcho from '../components/InlineEcho';
import { listStates } from '../engine/stateTax';
import { runProjection, depletionAge } from '../engine/projection';
import { fmtM } from '../lib/format';
import { useIsMobile } from '../hooks/useIsMobile';

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
  const isMobile = useIsMobile();
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
              <div className="person-profile-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label>Your Name</label>
                  <input type="text" value={A.name} placeholder="Your name" onChange={(e) => setPersonA({ name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input
                    type="date"
                    value={A.dob}
                    onChange={(e) => { if (e.target.value) setPersonA({ dob: e.target.value }); }}
                  />
                  <div className="helper-text">Age {ageFromDob(A.dob)}</div>
                </div>
                <div className="form-group">
                  <label>Retirement Age</label>
                  <NumberInput value={A.retirementAge} digits={0} min={40} max={80} onCommit={(v) => setPersonA({ retirementAge: Math.round(v) })} />
                  <div className="helper-text">{yearsToRetire}y away · {fmtM(projectedAtRetire)} at retirement</div>
                </div>
                <div className="form-group">
                  <label>Plan-To Age</label>
                  <NumberInput value={A.planToAge} digits={0} min={70} max={110} onCommit={(v) => setPersonA({ planToAge: Math.round(v) })} />
                  <InlineEcho tone={lasts ? 'positive' : 'warning'}>
                    {lasts ? `Funds through ${A.planToAge} ✓` : `Runs out at ${longevity} ⚠`}
                  </InlineEcho>
                </div>
                <div className="form-group">
                  <label>Passing Age</label>
                  <NumberInput value={A.passingAge} digits={0} min={60} max={115} onCommit={(v) => setPersonA({ passingAge: Math.round(v) })} />
                  <div className="helper-text">Survivor SS &amp; filing-status</div>
                </div>
                {B && (<>
                  <div className="form-group">
                    <label>Spouse / Partner Name</label>
                    <input type="text" value={B.name} placeholder="Spouse / partner name" onChange={(e) => setPersonB({ name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input
                      type="date"
                      value={B.dob}
                      onChange={(e) => { if (e.target.value) setPersonB({ dob: e.target.value }); }}
                    />
                    <div className="helper-text">Age {ageFromDob(B.dob)}</div>
                  </div>
                  <div className="form-group">
                    <label>Retirement Age</label>
                    <NumberInput value={B.retirementAge} digits={0} min={40} max={80} onCommit={(v) => setPersonB({ retirementAge: Math.round(v) })} />
                  </div>
                  <div className="form-group">
                    <label>Plan-To Age</label>
                    <NumberInput value={B.planToAge} digits={0} min={70} max={110} onCommit={(v) => setPersonB({ planToAge: Math.round(v) })} />
                  </div>
                  <div className="form-group">
                    <label>Passing Age</label>
                    <NumberInput value={B.passingAge} digits={0} min={60} max={115} onCommit={(v) => setPersonB({ passingAge: Math.round(v) })} />
                  </div>
                </>)}
              </div>
            </div>


            <hr className="divider" />

            <div className="form-section">
              <div className="section-columns-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1px 1fr 1px 2fr', gap: '0 16px' }}>

                {/* Returns & Inflation */}
                <div>
                  <div className="form-section-title"><div className="section-number">2</div>Returns &amp; Inflation</div>
                  <div className="returns-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Pre-retirement return', value: asm.preRetReturn, key: 'preRetReturn' as const, hint: 'nominal, annual' },
                      { label: 'Post-retirement return', value: asm.postRetReturn, key: 'postRetReturn' as const, hint: 'nominal, annual' },
                      { label: 'Inflation rate', value: asm.inflation, key: 'inflation' as const, hint: 'annual CPI' },
                    ].map(({ label, value, key, hint }) => (
                      <div key={key} className="form-group">
                        <label>{label}</label>
                        <div className="input-suffix-wrap">
                          <NumberInput value={value} scale={100} digits={1} onCommit={(v) => setAssumptions({ [key]: v })} />
                          <span className="input-suffix">%</span>
                        </div>
                        {hint && <div className="helper-text">{hint}</div>}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="section-divider" style={{ background: 'rgba(13,27,46,0.12)' }} />

                {/* State */}
                <div>
                  <div className="form-section-title"><div className="section-number">3</div>State of Residence</div>
                  <div className="form-group">
                    <label>Current State</label>
                    <select value={plan.state} onChange={(e) => setStateField(e.target.value)}>
                      {listStates().map((s) => (
                        <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                    <div className="helper-text">TX/FL/WA exact; CA/NY/IL approx</div>
                  </div>
                </div>

                <div className="section-divider" style={{ background: 'rgba(13,27,46,0.12)' }} />

                {/* ACA Healthcare */}
                <div>
                  <div className="form-section-title" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="section-number">4</div>ACA Healthcare</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
                      <input type="checkbox" checked={asm.modelACA} onChange={(e) => setAssumptions({ modelACA: e.target.checked })} style={{ accentColor: 'var(--gold)', width: 13, height: 13 }} />
                      Model
                    </label>
                  </div>
                  {asm.modelACA ? (
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : (asm.acaNoSubsidy ? '1fr 1fr' : '1fr 1fr 1fr'), gap: 10 }}>
                      <div className="form-group">
                        <label>Annual Premium</label>
                        <div className="input-suffix-wrap">
                          <span className="input-suffix" style={{ left: 0, right: 'auto', paddingLeft: 10 }}>$</span>
                          <NumberInput value={asm.acaBenchmarkPremium} digits={0} style={{ paddingLeft: 22 }} onCommit={(v) => setAssumptions({ acaBenchmarkPremium: v })} />
                        </div>
                        <div className="helper-text">{asm.acaNoSubsidy ? 'Full cost, inflation-scaled' : 'SLCSP; subsidy by income'}</div>
                      </div>
                      {!asm.acaNoSubsidy && (
                        <div className="form-group">
                          <label>Household Size</label>
                          <NumberInput value={asm.acaHouseholdSize} digits={0} min={1} max={8} onCommit={(v) => setAssumptions({ acaHouseholdSize: Math.round(v) })} />
                          <div className="helper-text">People on the plan</div>
                        </div>
                      )}
                      <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginBottom: 0 }}>
                          <input type="checkbox" checked={asm.acaNoSubsidy} onChange={(e) => setAssumptions({ acaNoSubsidy: e.target.checked })} style={{ accentColor: 'var(--gold)', width: 13, height: 13 }} />
                          No subsidy (COBRA)
                        </label>
                      </div>
                    </div>
                  ) : (
                    <p className="helper-text" style={{ margin: '4px 0 0' }}>Enable to model pre-Medicare healthcare costs.</p>
                  )}
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
