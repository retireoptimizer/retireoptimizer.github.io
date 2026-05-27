import { usePlanStore } from '../store/usePlanStore';
import { NumberInput } from '../components/inputs/NumberInput';
import { listStates } from '../engine/stateTax';

const ageFromDob = (iso: string): number => {
  if (!iso || iso.length < 4) return 0;
  return new Date().getFullYear() - parseInt(iso.slice(0, 4), 10);
};

export default function PersonalDetails() {
  const plan = usePlanStore((s) => s.plan);
  const setPersonA = usePlanStore((s) => s.setPersonA);
  const setPersonB = usePlanStore((s) => s.setPersonB);
  const setAssumptions = usePlanStore((s) => s.setAssumptions);
  const setStateField = usePlanStore((s) => s.setState);

  const A = plan.personA;
  const B = plan.personB!;
  const asm = plan.assumptions;

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
              <div className="form-section-title"><div className="section-number">1</div>Client Profiles</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{A.name} — Full Name</label>
                  <input type="text" value={A.name} onChange={(e) => setPersonA({ name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>{B.name} — Full Name</label>
                  <input type="text" value={B.name} onChange={(e) => setPersonB({ name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>{A.name} — Date of Birth</label>
                  <input
                    type="date"
                    value={A.dob}
                    onChange={(e) => { if (e.target.value) setPersonA({ dob: e.target.value }); }}
                  />
                  <div className="helper-text">Age {ageFromDob(A.dob)} · Born {A.dob.slice(0, 4)}</div>
                </div>
                <div className="form-group">
                  <label>{B.name} — Date of Birth</label>
                  <input
                    type="date"
                    value={B.dob}
                    onChange={(e) => { if (e.target.value) setPersonB({ dob: e.target.value }); }}
                  />
                  <div className="helper-text">Age {ageFromDob(B.dob)} · Born {B.dob.slice(0, 4)}</div>
                </div>
                <div className="form-group">
                  <label>{A.name} — Target Retirement Age</label>
                  <NumberInput value={A.retirementAge} digits={0} min={40} max={80} onCommit={(v) => setPersonA({ retirementAge: Math.round(v) })} />
                </div>
                <div className="form-group">
                  <label>{B.name} — Target Retirement Age</label>
                  <NumberInput value={B.retirementAge} digits={0} min={40} max={80} onCommit={(v) => setPersonB({ retirementAge: Math.round(v) })} />
                </div>
                <div className="form-group">
                  <label>{A.name} — Plan-To Age</label>
                  <NumberInput value={A.planToAge} digits={0} min={70} max={110} onCommit={(v) => setPersonA({ planToAge: Math.round(v) })} />
                  <div className="helper-text">Projection horizon</div>
                </div>
                <div className="form-group">
                  <label>{B.name} — Plan-To Age</label>
                  <NumberInput value={B.planToAge} digits={0} min={70} max={110} onCommit={(v) => setPersonB({ planToAge: Math.round(v) })} />
                </div>
                <div className="form-group">
                  <label>{A.name} — SS PIA (at FRA, $/yr)</label>
                  <div className="input-prefix-wrap"><span className="input-prefix">$</span>
                    <NumberInput value={A.ssPIA} min={0} style={{ paddingLeft: 22 }} onCommit={(v) => setPersonA({ ssPIA: v })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{B.name} — SS PIA (at FRA, $/yr)</label>
                  <div className="input-prefix-wrap"><span className="input-prefix">$</span>
                    <NumberInput value={B.ssPIA} min={0} style={{ paddingLeft: 22 }} onCommit={(v) => setPersonB({ ssPIA: v })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>{A.name} — SS Claim Age</label>
                  <NumberInput value={A.ssClaimAge} digits={0} min={62} max={70} onCommit={(v) => setPersonA({ ssClaimAge: Math.round(v) })} />
                </div>
                <div className="form-group">
                  <label>{B.name} — SS Claim Age</label>
                  <NumberInput value={B.ssClaimAge} digits={0} min={62} max={70} onCommit={(v) => setPersonB({ ssClaimAge: Math.round(v) })} />
                </div>
              </div>
            </div>

            <hr className="divider" />

            <div className="form-section">
              <div className="form-section-title"><div className="section-number">2</div>Survivor Assumptions</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>{A.name} — Expected Passing Age</label>
                  <NumberInput value={A.passingAge} digits={0} min={60} max={115} onCommit={(v) => setPersonA({ passingAge: Math.round(v) })} />
                  <div className="helper-text">Used for survivor SS and filing-status switch</div>
                </div>
                <div className="form-group">
                  <label>{B.name} — Expected Passing Age</label>
                  <NumberInput value={B.passingAge} digits={0} min={60} max={115} onCommit={(v) => setPersonB({ passingAge: Math.round(v) })} />
                </div>
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
              <div className="form-section-title"><div className="section-number">4</div>State of Residence</div>
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
