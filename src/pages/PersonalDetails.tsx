import { usePlanStore } from '../store/usePlanStore';

const dobToDisplay = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
};
const displayToIso = (s: string): string | null => {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
};
const ageFromDob = (iso: string): number => {
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
                  <label>Person A — Full Name</label>
                  <input type="text" value={A.name} onChange={(e) => setPersonA({ name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Person B — Full Name</label>
                  <input type="text" value={B.name} onChange={(e) => setPersonB({ name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Person A — Date of Birth</label>
                  <input
                    type="text"
                    value={dobToDisplay(A.dob)}
                    onChange={(e) => {
                      const iso = displayToIso(e.target.value);
                      if (iso) setPersonA({ dob: iso });
                    }}
                  />
                  <div className="helper-text">Age {ageFromDob(A.dob)} · Born {A.dob.slice(0, 4)}</div>
                </div>
                <div className="form-group">
                  <label>Person B — Date of Birth</label>
                  <input
                    type="text"
                    value={dobToDisplay(B.dob)}
                    onChange={(e) => {
                      const iso = displayToIso(e.target.value);
                      if (iso) setPersonB({ dob: iso });
                    }}
                  />
                  <div className="helper-text">Age {ageFromDob(B.dob)} · Born {B.dob.slice(0, 4)}</div>
                </div>
                <div className="form-group">
                  <label>Person A — Target Retirement Age</label>
                  <input type="number" value={A.retirementAge} onChange={(e) => setPersonA({ retirementAge: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Person B — Target Retirement Age</label>
                  <input type="number" value={B.retirementAge} onChange={(e) => setPersonB({ retirementAge: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Person A — Plan-To Age</label>
                  <input type="number" value={A.planToAge} onChange={(e) => setPersonA({ planToAge: parseInt(e.target.value) || 0 })} />
                  <div className="helper-text">Projection horizon</div>
                </div>
                <div className="form-group">
                  <label>Person B — Plan-To Age</label>
                  <input type="number" value={B.planToAge} onChange={(e) => setPersonB({ planToAge: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                  <label>Person A — SS PIA (at FRA, $/yr)</label>
                  <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" value={A.ssPIA} style={{ paddingLeft: 22 }} onChange={(e) => setPersonA({ ssPIA: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <div className="form-group">
                  <label>Person B — SS PIA (at FRA, $/yr)</label>
                  <div className="input-prefix-wrap"><span className="input-prefix">$</span><input type="number" value={B.ssPIA} style={{ paddingLeft: 22 }} onChange={(e) => setPersonB({ ssPIA: parseFloat(e.target.value) || 0 })} /></div>
                </div>
                <div className="form-group">
                  <label>Person A — SS Claim Age</label>
                  <input type="number" value={A.ssClaimAge} min={62} max={70} onChange={(e) => setPersonA({ ssClaimAge: parseInt(e.target.value) || 67 })} />
                </div>
                <div className="form-group">
                  <label>Person B — SS Claim Age</label>
                  <input type="number" value={B.ssClaimAge} min={62} max={70} onChange={(e) => setPersonB({ ssClaimAge: parseInt(e.target.value) || 67 })} />
                </div>
              </div>
            </div>

            <hr className="divider" />

            <div className="form-section">
              <div className="form-section-title"><div className="section-number">2</div>Survivor Assumptions</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Person A — Expected Passing Age</label>
                  <input type="number" value={A.passingAge} onChange={(e) => setPersonA({ passingAge: parseInt(e.target.value) || 0 })} />
                  <div className="helper-text">Used for survivor SS and filing-status switch</div>
                </div>
                <div className="form-group">
                  <label>Person B — Expected Passing Age</label>
                  <input type="number" value={B.passingAge} onChange={(e) => setPersonB({ passingAge: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
            </div>

            <hr className="divider" />

            <div className="form-section">
              <div className="form-section-title"><div className="section-number">3</div>Market &amp; Inflation Assumptions</div>
              <div className="form-grid-4">
                <div className="form-group">
                  <label>Pre-Retirement Return</label>
                  <div className="input-suffix-wrap"><input type="number" step="0.1" value={(asm.preRetReturn * 100).toFixed(1)} onChange={(e) => setAssumptions({ preRetReturn: (parseFloat(e.target.value) || 0) / 100 })} /><span className="input-suffix">%</span></div>
                  <div className="helper-text">Nominal annualized</div>
                </div>
                <div className="form-group">
                  <label>Post-Retirement Return</label>
                  <div className="input-suffix-wrap"><input type="number" step="0.1" value={(asm.postRetReturn * 100).toFixed(1)} onChange={(e) => setAssumptions({ postRetReturn: (parseFloat(e.target.value) || 0) / 100 })} /><span className="input-suffix">%</span></div>
                </div>
                <div className="form-group">
                  <label>Inflation Rate</label>
                  <div className="input-suffix-wrap"><input type="number" step="0.1" value={(asm.inflation * 100).toFixed(1)} onChange={(e) => setAssumptions({ inflation: (parseFloat(e.target.value) || 0) / 100 })} /><span className="input-suffix">%</span></div>
                </div>
                <div className="form-group">
                  <label>RMD Start Age</label>
                  <input type="number" value={asm.rmdStartAge} onChange={(e) => setAssumptions({ rmdStartAge: parseInt(e.target.value) || 75 })} />
                  <div className="helper-text">SECURE 2.0 (born 1960+)</div>
                </div>
                <div className="form-group">
                  <label>Contribution Growth</label>
                  <div className="input-suffix-wrap"><input type="number" step="0.1" value={(asm.contribGrowth * 100).toFixed(1)} onChange={(e) => setAssumptions({ contribGrowth: (parseFloat(e.target.value) || 0) / 100 })} /><span className="input-suffix">%</span></div>
                </div>
              </div>
            </div>

            <hr className="divider" />

            <div className="form-section">
              <div className="form-section-title"><div className="section-number">4</div>State of Residence</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Current State</label>
                  <select value={plan.state} onChange={(e) => setStateField(e.target.value)}>
                    <option value="IL">Illinois (IL) — 4.95% (retirement income exempt)</option>
                    <option value="TX">Texas (TX) — No Income Tax</option>
                    <option value="FL">Florida (FL) — No Income Tax</option>
                    <option value="CA">California (CA) — not yet modeled</option>
                    <option value="NY">New York (NY) — not yet modeled</option>
                  </select>
                  <div className="helper-text">v1 fully models IL; other states tax-free in projection until Phase 3.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
