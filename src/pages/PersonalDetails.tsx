export default function PersonalDetails() {
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
                  <input type="text" defaultValue="David Johnson" />
                </div>
                <div className="form-group">
                  <label>Person B — Full Name</label>
                  <input type="text" defaultValue="Sarah Barfield" />
                </div>
                <div className="form-group">
                  <label>Person A — Date of Birth</label>
                  <input type="text" defaultValue="03/15/1973" />
                  <div className="helper-text">Age 52 · Born 1973 → RMD starts age 75 (SECURE 2.0)</div>
                </div>
                <div className="form-group">
                  <label>Person B — Date of Birth</label>
                  <input type="text" defaultValue="09/22/1975" />
                  <div className="helper-text">Age 50 · Born 1975 → RMD starts age 75 (SECURE 2.0)</div>
                </div>
                <div className="form-group">
                  <label>Person A — Target Retirement Age</label>
                  <input type="number" defaultValue={65} />
                </div>
                <div className="form-group">
                  <label>Person B — Target Retirement Age</label>
                  <input type="number" defaultValue={62} />
                </div>
                <div className="form-group">
                  <label>Person A — Plan-To Age</label>
                  <input type="number" defaultValue={95} />
                  <div className="helper-text">Projection horizon</div>
                </div>
                <div className="form-group">
                  <label>Person B — Plan-To Age</label>
                  <input type="number" defaultValue={95} />
                </div>
              </div>
            </div>

            <hr className="divider" />

            <div className="form-section">
              <div className="form-section-title"><div className="section-number">2</div>Survivor Assumptions</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Person A — Expected Passing Age</label>
                  <input type="number" defaultValue={88} />
                  <div className="helper-text">Used for survivor SS and income stream calculations</div>
                </div>
                <div className="form-group">
                  <label>Person B — Expected Passing Age</label>
                  <input type="number" defaultValue={90} />
                </div>
              </div>
            </div>

            <hr className="divider" />

            <div className="form-section">
              <div className="form-section-title"><div className="section-number">3</div>Market &amp; Inflation Assumptions</div>
              <div className="form-grid-4">
                <div className="form-group">
                  <label>Pre-Retirement Return</label>
                  <div className="input-suffix-wrap"><input type="number" defaultValue={7.0} /><span className="input-suffix">%</span></div>
                  <div className="helper-text">Nominal annualized</div>
                </div>
                <div className="form-group">
                  <label>Post-Retirement Return</label>
                  <div className="input-suffix-wrap"><input type="number" defaultValue={5.5} /><span className="input-suffix">%</span></div>
                </div>
                <div className="form-group">
                  <label>Inflation Rate</label>
                  <div className="input-suffix-wrap"><input type="number" defaultValue={2.5} /><span className="input-suffix">%</span></div>
                </div>
                <div className="form-group">
                  <label>RMD Start Age</label>
                  <input type="number" defaultValue={75} />
                  <div className="helper-text">SECURE 2.0 (born 1960+)</div>
                </div>
                <div className="form-group">
                  <label>LTCG Rate</label>
                  <div className="input-suffix-wrap"><input type="number" defaultValue={15.0} /><span className="input-suffix">%</span></div>
                </div>
                <div className="form-group">
                  <label>SS Taxable %</label>
                  <div className="input-suffix-wrap"><input type="number" defaultValue={85} /><span className="input-suffix">%</span></div>
                </div>
                <div className="form-group">
                  <label>Conversion End Age</label>
                  <input type="number" defaultValue={74} />
                  <div className="helper-text">Default: RMD age − 1</div>
                </div>
              </div>
            </div>

            <hr className="divider" />

            <div className="form-section">
              <div className="form-section-title"><div className="section-number">4</div>State of Residence</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Current State</label>
                  <select defaultValue="IL">
                    <option value="CA">California (CA) — 9.3%</option>
                    <option value="NY">New York (NY) — 6.85%</option>
                    <option value="TX">Texas (TX) — No Income Tax</option>
                    <option value="FL">Florida (FL) — No Income Tax</option>
                    <option value="WA">Washington (WA) — No Income Tax</option>
                    <option value="IL">Illinois (IL) — 4.95%</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Planned Retirement State</label>
                  <select defaultValue="IL">
                    <option value="CA">California (CA) — 9.3%</option>
                    <option value="NY">New York (NY) — 6.85%</option>
                    <option value="TX">Texas (TX) — No Income Tax</option>
                    <option value="FL">Florida (FL) — No Income Tax</option>
                    <option value="IL">Illinois (IL) — 4.95%</option>
                  </select>
                  <div className="helper-text">Affects long-term tax projections</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
