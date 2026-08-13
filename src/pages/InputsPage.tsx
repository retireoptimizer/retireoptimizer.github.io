import React, { useState, useEffect, useRef } from 'react';
import * as Comlink from 'comlink';
import { useNavigate } from 'react-router-dom';
import { usePlanStore } from '../store/usePlanStore';
import { useOptimizerStore } from '../store/useOptimizerStore';
import { useWhatIfStore } from '../store/useWhatIfStore';
import { householdTotals, resolveGrowthRate } from '../schemas/plan';
import type { IncomeStream, ExpenseStream, LumpSumEvent, PersonPortfolio, GrowthRate } from '../schemas/plan';
import { NumberInput } from '../components/inputs/NumberInput';
import { listStates } from '../engine/stateTax';
import { fmtM, fmtK } from '../lib/format';
import { useIsMobile } from '../hooks/useIsMobile';
import { INCOME_TEMPLATES, EXPENSE_TEMPLATES } from '../engine/streamTemplates';
import { getEngineWorker } from '../engine/workerClient';
import { applyResultToPlan } from '../engine/applyOptimizerResult';
import { planInputKey } from '../engine/planInputKey';
import { USER_GOALS, type UserGoal } from '../engine/recommender';
import { FED_BRACKETS_MFJ, FED_BRACKETS_SINGLE } from '../engine/taxConstants';

const headerStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' };

const inlineLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
  color: 'var(--text-secondary)', flexShrink: 0, whiteSpace: 'nowrap',
};

const GOAL_SHORT_LABELS: Record<UserGoal, string> = {
  'max-end-balance': 'Max End Balance',
  'max-sustainable-spending': 'Max Spending',
  'min-retirement-age': 'Earliest Retire',
};

const Chk = () => <span style={{ color: 'var(--gold)', fontWeight: 800 }}>✓</span>;

const inputPillStyle = (active: boolean): React.CSSProperties => ({
  height: 34, boxSizing: 'border-box', padding: '0 13px',
  fontSize: 13, fontWeight: 600, borderRadius: 999,
  border: active ? '2px solid var(--gold)' : '1px solid var(--border-light)',
  background: active ? 'rgba(201,168,76,0.08)' : '#fff',
  color: active ? '#7a5c10' : 'var(--text-secondary)',
  cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  display: 'inline-flex', alignItems: 'center', gap: 5,
});

const inputSelectPillStyle = (active: boolean): React.CSSProperties => ({
  height: 34, boxSizing: 'border-box', padding: '0 8px 0 12px',
  fontSize: 13, fontWeight: 600, borderRadius: 999,
  border: active ? '2px solid var(--gold)' : '1px solid var(--border-light)',
  background: active ? 'rgba(201,168,76,0.08)' : '#fff',
  color: active ? '#7a5c10' : 'var(--text-primary)',
  cursor: 'pointer', fontFamily: 'inherit',
  width: 'fit-content', minWidth: 0,
});

const stepperBtnStyle: React.CSSProperties = {
  width: 22, height: 32, border: 'none', background: 'rgba(13,27,46,0.06)',
  color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1,
  cursor: 'pointer', userSelect: 'none', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function GrowthRateInput({ value, inflation, onChange, disabled }: {
  value: GrowthRate;
  inflation: number;
  onChange: (gr: GrowthRate) => void;
  disabled?: boolean;
}) {
  const resolved = resolveGrowthRate(value, inflation);

  const handleMode = (mode: GrowthRate['mode']) => {
    if (mode === 'cpi') onChange({ mode: 'cpi' });
    else if (mode === 'offset') onChange({ mode: 'offset', delta: 0 });
    else onChange({ mode: 'fixed', rate: parseFloat(resolved.toFixed(3)) });
  };

  const nudge = (dir: 1 | -1) => {
    if (value.mode !== 'offset') return;
    onChange({ mode: 'offset', delta: parseFloat((value.delta + dir * 0.001).toFixed(3)) });
  };

  const selectFlex = value.mode === 'cpi' ? '1 1 auto' : '0 0 66px';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
      <select
        value={value.mode}
        disabled={disabled}
        onChange={(e) => handleMode(e.target.value as GrowthRate['mode'])}
        style={{ fontSize: 11, height: 32, flex: selectFlex, minWidth: 0, paddingLeft: 4, paddingRight: 2 }}
      >
        <option value="cpi">Tracks CPI</option>
        <option value="offset">CPI ± Adjust</option>
        <option value="fixed">Fixed Rate</option>
      </select>

      {value.mode === 'offset' && (
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-light)', borderRadius: 6, overflow: 'hidden', height: 32, flexShrink: 0 }}>
          <button style={stepperBtnStyle} onClick={() => nudge(-1)} disabled={disabled}>−</button>
          <div style={{ position: 'relative', width: 44 }}>
            <NumberInput
              value={value.delta}
              scale={100}
              digits={1}
              style={{ fontSize: 12, textAlign: 'center', padding: '0 12px 0 4px', border: 'none', borderRadius: 0, height: 32 }}
              disabled={disabled}
              onCommit={(v) => onChange({ mode: 'offset', delta: v })}
            />
            <span style={{ position: 'absolute', right: 3, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted)', pointerEvents: 'none' }}>%</span>
          </div>
          <button style={stepperBtnStyle} onClick={() => nudge(1)} disabled={disabled}>+</button>
        </div>
      )}

      {value.mode === 'fixed' && (
        <div className="input-suffix-wrap" style={{ flex: 1, minWidth: 0 }}>
          <NumberInput
            value={value.rate}
            scale={100}
            digits={1}
            style={{ fontSize: 13 }}
            disabled={disabled}
            onCommit={(v) => onChange({ mode: 'fixed', rate: v })}
          />
          <span className="input-suffix">%</span>
        </div>
      )}
    </div>
  );
}

const ageFromDob = (iso: string): number => {
  if (!iso || iso.length < 4) return 0;
  const yr = parseInt(iso.slice(0, 4), 10);
  if (yr < 1900 || yr > new Date().getFullYear()) return 0;
  return new Date().getFullYear() - yr;
};

const isValidDob = (iso: string): boolean => {
  if (!iso || iso.length < 10) return false;
  const yr = parseInt(iso.slice(0, 4), 10);
  const age = new Date().getFullYear() - yr;
  return yr >= 1900 && age >= 10 && age <= 100;
};

export default function InputsPage() {
  const navigate = useNavigate();
  const plan = usePlanStore((s) => s.plan);
  const setPersonA = usePlanStore((s) => s.setPersonA);
  const setPersonB = usePlanStore((s) => s.setPersonB);
  const addPersonB = usePlanStore((s) => s.addPersonB);
  const removePersonB = usePlanStore((s) => s.removePersonB);
  const setAssumptions = usePlanStore((s) => s.setAssumptions);
  const setStateField = usePlanStore((s) => s.setState);
  const setCustomStateTaxRate = usePlanStore((s) => s.setCustomStateTaxRate);
  const setPersonAPortfolio = usePlanStore((s) => s.setPersonAPortfolio);
  const setPersonBPortfolio = usePlanStore((s) => s.setPersonBPortfolio);
  const addIncomeStream = usePlanStore((s) => s.addIncomeStream);
  const updateIncomeStream = usePlanStore((s) => s.updateIncomeStream);
  const removeIncomeStream = usePlanStore((s) => s.removeIncomeStream);
  const addLumpSumEvent = usePlanStore((s) => s.addLumpSumEvent);
  const updateLumpSumEvent = usePlanStore((s) => s.updateLumpSumEvent);
  const removeLumpSumEvent = usePlanStore((s) => s.removeLumpSumEvent);
  const addExpenseStream = usePlanStore((s) => s.addExpenseStream);
  const updateExpenseStream = usePlanStore((s) => s.updateExpenseStream);
  const removeExpenseStream = usePlanStore((s) => s.removeExpenseStream);
  const setConversion = usePlanStore((s) => s.setConversion);
  const applyOptimizerResult = usePlanStore((s) => s.applyOptimizerResult);
  const resetWhatIf = useWhatIfStore((s) => s.reset);
  const setOptimizerResult = useOptimizerStore((s) => s.setResult);
  const setPlanKey = useOptimizerStore((s) => s.setPlanKey);
  const setPendingPlan = useOptimizerStore((s) => s.setPendingPlan);
  const setPendingGoal = useOptimizerStore((s) => s.setPendingGoal);
  const pendingGoal = useOptimizerStore((s) => s.pendingGoal);

  const planGoal: UserGoal = pendingGoal ?? (plan.optimizedForGoal as UserGoal | undefined) ?? 'max-end-balance';
  const [selectedGoal, setSelectedGoal] = useState<UserGoal>(planGoal);
  const [seenGoal, setSeenGoal] = useState<UserGoal>(planGoal);
  if (planGoal !== seenGoal) { setSeenGoal(planGoal); setSelectedGoal(planGoal); }

  const [building, setBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildError, setBuildError] = useState<string | null>(null);

  const [dobA, setDobA] = useState(plan.personA.dob);
  const [seenDobA, setSeenDobA] = useState(plan.personA.dob);
  if (plan.personA.dob !== seenDobA) { setSeenDobA(plan.personA.dob); setDobA(plan.personA.dob); }

  const planDobB = plan.personB?.dob ?? '';
  const [dobB, setDobB] = useState(planDobB);
  const [seenDobB, setSeenDobB] = useState(planDobB);
  if (planDobB !== seenDobB) { setSeenDobB(planDobB); setDobB(planDobB); }

  const A = plan.personA;
  const B = plan.personB;
  const asm = plan.assumptions;
  const conv = plan.conversion;
  const brackets = B ? FED_BRACKETS_MFJ : FED_BRACKETS_SINGLE;
  const convBracketOptions = brackets.slice(0, 4).map(([top, rate]: readonly [number, number]) => ({
    value: top, label: `${Math.round(rate * 100)}% ($${top.toLocaleString()})`,
  }));
  const pf = plan.portfolio;
  const isMobile = useIsMobile();


  const totals = householdTotals(pf);
  const total = totals.taxable + totals.traditional + totals.roth;
  const nameA = A.name || 'Person A';
  const nameB = B?.name || 'Person B';
  const isRetiredA = isValidDob(A.dob) && ageFromDob(A.dob) >= A.retirementAge;
  const isRetiredB = B ? (isValidDob(B.dob) && ageFromDob(B.dob) >= B.retirementAge) : false;
  const splitPctA = Math.round((pf.personA.contribSplit.taxable + pf.personA.contribSplit.traditional + pf.personA.contribSplit.roth) * 100);
  const splitPctB = pf.personB ? Math.round((pf.personB.contribSplit.taxable + pf.personB.contribSplit.traditional + pf.personB.contribSplit.roth) * 100) : 100;
  const splitValidA = isRetiredA || pf.personA.annualContribution === 0 || splitPctA === 100;
  const splitValidB = !pf.personB || isRetiredB || pf.personB.annualContribution === 0 || splitPctB === 100;
  const canBuild = A.name.trim().length > 0 && (!B || B.name.trim().length > 0)
    && isValidDob(A.dob) && (!B || isValidDob(B.dob))
    && splitValidA && splitValidB;
  const retirementAge = A.retirementAge;
  const planToAge = A.planToAge;
  const minStartAge = (whose: string) => {
    if (whose === 'B' && B) return B.retirementAge;
    if (whose === 'Household' && B) return Math.min(A.retirementAge, B.retirementAge);
    return A.retirementAge;
  };

  const addIncomeFromTemplate = (tplId: string) => {
    const tpl = INCOME_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    addIncomeStream(tpl.make({ retirementAge, planToAge }));
  };

  const addExpenseFromTemplate = (tplId: string) => {
    const tpl = EXPENSE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    addExpenseStream(tpl.make({ retirementAge, planToAge }));
  };

  const onBuildPlan = async () => {
    setBuilding(true);
    setBuildProgress(0);
    setBuildError(null);
    try {
      const worker = getEngineWorker();
      const onProgress = Comlink.proxy((frac: number) => setBuildProgress(frac));
      const result = await worker.optimize(plan, selectedGoal, { useNelderMead: true, thorough: true }, onProgress);
      const appliedPlan = applyResultToPlan(plan, result);
      const mutatesInputs = selectedGoal === 'max-sustainable-spending' || selectedGoal === 'min-retirement-age';
      setOptimizerResult(result);
      setPlanKey(planInputKey(mutatesInputs ? plan : appliedPlan));
      if (mutatesInputs) {
        setPendingPlan(appliedPlan);
        setPendingGoal(selectedGoal);
      } else {
        applyOptimizerResult(appliedPlan);
        setPendingPlan(null);
        setPendingGoal(null);
      }
      resetWhatIf();
      window.scrollTo(0, 0);
      navigate('/dashboard');
    } catch (err) {
      console.error('[InputsPage] optimizer failed:', err);
      setBuildError(err instanceof Error ? err.message : String(err));
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div className="page">
      <div className="page-body" style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* ── Section 1: Personal Details ─────────────────── */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header" style={{ position: 'relative' }}>
            <div className="panel-title"><div className="panel-title-dot"></div>Personal Details</div>
            <div style={{ position: 'absolute', right: 16 }}>
              {B ? (
                <button className="btn btn-danger" style={{ fontSize: 12, padding: '4px 10px' }} onClick={removePersonB}>
                  Remove Spouse / Partner
                </button>
              ) : (
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 10px', color: 'var(--gold)', border: '1px solid var(--gold)' }} onClick={addPersonB}>
                  + Add Spouse / Partner
                </button>
              )}
            </div>
          </div>
          <div className="panel-body">
            {/* Person profiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div className="form-group">
                <label>Your Name</label>
                <input type="text" value={A.name} placeholder="Your name" onChange={(e) => setPersonA({ name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Date of Birth</label>
                <input type="date" value={dobA}
                  onChange={(e) => { setDobA(e.target.value); if (isValidDob(e.target.value)) setPersonA({ dob: e.target.value }); }}
                  onBlur={() => { if (!isValidDob(dobA)) setDobA(A.dob); }}
                />
                <div className="helper-text" style={{ color: isValidDob(dobA) ? undefined : 'var(--color-danger, #c0392b)' }}>
                  {isValidDob(dobA) ? `Age ${ageFromDob(dobA)}` : 'Invalid date'}
                </div>
              </div>
              <div className="form-group">
                <label>Retirement Age</label>
                <NumberInput value={A.retirementAge} digits={0} min={40} max={80} onCommit={(v) => setPersonA({ retirementAge: Math.round(v) })} />
              </div>
              <div className="form-group">
                <label>Plan-To Age</label>
                <NumberInput value={A.planToAge} digits={0} min={70} max={110} onCommit={(v) => setPersonA({ planToAge: Math.round(v) })} />
              </div>
              <div className="form-group">
                <label>Passing Age</label>
                <NumberInput value={A.passingAge} digits={0} min={60} max={115} onCommit={(v) => setPersonA({ passingAge: Math.round(v) })} />
              </div>
              {B && (<>
                <div className="form-group">
                  <label>Spouse / Partner Name</label>
                  <input type="text" value={B.name} placeholder="Spouse / partner name" onChange={(e) => setPersonB({ name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <input type="date" value={dobB}
                    onChange={(e) => { setDobB(e.target.value); if (isValidDob(e.target.value)) setPersonB({ dob: e.target.value }); }}
                    onBlur={() => { if (!isValidDob(dobB)) setDobB(B.dob); }}
                  />
                  <div className="helper-text" style={{ color: isValidDob(dobB) ? undefined : 'var(--color-danger, #c0392b)' }}>
                    {isValidDob(dobB) ? `Age ${ageFromDob(dobB)}` : 'Invalid date'}
                  </div>
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

            <hr className="divider" />

            {/* State + ACA row */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr', gap: 32 }}>
              <div>
                <div className="subsection-label">State of Residence</div>
                <div style={{ display: 'grid', gridTemplateColumns: plan.state === 'CUSTOM' ? '200px 132px' : '200px', rowGap: 4, columnGap: 16 }}>
                  <label>State</label>
                  {plan.state === 'CUSTOM' && <label>Flat Rate %</label>}
                  <select style={{ height: 38, boxSizing: 'border-box' }} value={plan.state} onChange={(e) => {
                    setStateField(e.target.value);
                    if (e.target.value === 'CUSTOM' && plan.customStateTaxRate == null) {
                      setCustomStateTaxRate(0.05);
                    }
                  }}>
                    {listStates().map((s) => (
                      <option key={s.code} value={s.code}>{s.code === 'CUSTOM' ? s.name : `${s.name} (${s.code})`}</option>
                    ))}
                  </select>
                  {plan.state === 'CUSTOM' && (
                    <NumberInput
                      value={(plan.customStateTaxRate ?? 0.05) * 100}
                      digits={2}
                      min={0}
                      max={20}
                      onCommit={(v) => setCustomStateTaxRate(v / 100)}
                    />
                  )}
                  <div className="helper-text">TX/FL/WA exact; CA/NY/IL approx</div>
                  {plan.state === 'CUSTOM' && <div className="helper-text">Incl. SS &amp; retirement</div>}
                </div>
              </div>
              <div style={{ justifySelf: 'end' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div className="subsection-label" style={{ marginBottom: 0 }}>ACA Healthcare</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={asm.modelACA} onChange={(e) => setAssumptions({ modelACA: e.target.checked })} style={{ accentColor: 'var(--gold)', width: 13, height: 13 }} />
                    Model pre-Medicare costs
                  </label>
                </div>
                {asm.modelACA && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: asm.acaNoSubsidy ? '150px auto' : '150px 100px auto', gap: 10, alignItems: 'start' }}>
                      <div className="form-group">
                        <label>Annual Premium</label>
                        <div className="input-prefix-wrap"><span className="input-prefix">$</span>
                          <NumberInput value={asm.acaBenchmarkPremium} digits={0} style={{ paddingLeft: 22 }} onCommit={(v) => setAssumptions({ acaBenchmarkPremium: v })} />
                        </div>
                        <div className="helper-text">{asm.acaNoSubsidy ? 'Full cost' : 'SLCSP; subsidy by income'}</div>
                      </div>
                      {!asm.acaNoSubsidy && (
                        <div className="form-group">
                          <label>Household Size</label>
                          <NumberInput value={asm.acaHouseholdSize} digits={0} min={1} max={8} onCommit={(v) => setAssumptions({ acaHouseholdSize: Math.round(v) })} />
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginBottom: 0, whiteSpace: 'nowrap' }}>
                          <input type="checkbox" checked={asm.acaNoSubsidy} onChange={(e) => setAssumptions({ acaNoSubsidy: e.target.checked })} style={{ accentColor: 'var(--gold)', width: 13, height: 13 }} />
                          No subsidy
                        </label>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: B ? '1fr 1fr' : '1fr', gap: 10, marginTop: 6 }}>
                      <div className="form-group">
                        <label>{A.name || 'Person A'} ACA start age</label>
                        <NumberInput
                          value={asm.acaStartAgeA ?? A.retirementAge}
                          digits={0} min={40} max={64}
                          onCommit={(v) => setAssumptions({ acaStartAgeA: Math.round(v) })}
                        />
                        <div className="helper-text">Default: retire age ({A.retirementAge})</div>
                      </div>
                      {B && (
                        <div className="form-group">
                          <label>{B.name || 'Person B'} ACA start age</label>
                          <NumberInput
                            value={asm.acaStartAgeB ?? B.retirementAge}
                            digits={0} min={40} max={64}
                            onCommit={(v) => setAssumptions({ acaStartAgeB: Math.round(v) })}
                          />
                          <div className="helper-text">Default: retire age ({B.retirementAge})</div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Income & Expenses ─────────────────── */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Income &amp; Expenses</div>
          </div>
          <div className="panel-body" style={{ padding: '14px 18px' }}>
            <div className="subsection-label">Income Streams</div>
            <div className="stream-rows-scroll">
              <div className="stream-row income-row" style={{ padding: '6px 0', borderBottom: '2px solid var(--border-light)' }}>
                <div style={headerStyle}>Description</div>
                <div style={headerStyle}>Whose</div>
                <div style={headerStyle}>Type</div>
                <div style={headerStyle}>Start age</div>
                <div style={headerStyle}>Stop age</div>
                <div style={headerStyle}>Annual amt</div>
                <div style={headerStyle}>Growth %</div>
                <div style={headerStyle}>State taxable % <span title="Only applies when using a Custom flat-rate state. Named states (IL, CA, NY…) apply their own built-in exemption rules regardless of this value." style={{ cursor: 'help', opacity: 0.55 }}>ⓘ</span></div>
                <div></div>
              </div>
              {plan.incomeStreams.length === 0 && (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No income streams yet — click "+ Add" to add SS, pension, annuity, or other income.
                </div>
              )}
              {plan.incomeStreams.map((s) => (
                <div key={s.id} className="stream-row income-row">
                  <input type="text" value={s.description} style={{ fontSize: 13 }} onChange={(e) => updateIncomeStream(s.id, { description: e.target.value })} />
                  <select value={s.whose} style={{ fontSize: 13 }} onChange={(e) => updateIncomeStream(s.id, { whose: e.target.value as IncomeStream['whose'] })}>
                    <option value="A">{nameA}</option>
                    <option value="B">{nameB}</option>
                    <option value="Household">Household</option>
                  </select>
                  <select value={s.type} style={{ fontSize: 13 }} onChange={(e) => updateIncomeStream(s.id, { type: e.target.value as IncomeStream['type'] })}>
                    <option value="SS">SS</option>
                    <option value="Pension">Pension</option>
                    <option value="Annuity">Annuity</option>
                    <option value="Other">Other</option>
                  </select>
                  <NumberInput value={s.startAge} digits={0} min={minStartAge(s.whose)} max={110} style={{ fontSize: 13 }} onCommit={(v) => updateIncomeStream(s.id, { startAge: Math.round(v) })} />
                  <NumberInput value={s.stopAge} digits={0} min={0} max={115} style={{ fontSize: 13 }} onCommit={(v) => updateIncomeStream(s.id, { stopAge: Math.round(v) })} />
                  <div className="input-prefix-wrap"><span className="input-prefix">$</span>
                    <NumberInput value={s.annualAmount} digits={0} min={0} style={{ fontSize: 13, paddingLeft: 22 }} onCommit={(v) => updateIncomeStream(s.id, { annualAmount: Math.round(v) })} />
                  </div>
                  <GrowthRateInput
                    value={s.growthPct}
                    inflation={asm.inflation}
                    onChange={(gr) => updateIncomeStream(s.id, { growthPct: gr })}
                  />
                  <div className="input-suffix-wrap">
                    <NumberInput value={s.stateTaxablePct ?? 1} scale={100} digits={0} min={0} max={100} style={{ fontSize: 13 }} onCommit={(v) => updateIncomeStream(s.id, { stateTaxablePct: v })} />
                    <span className="input-suffix">%</span>
                  </div>
                  <button className="remove-btn" onClick={() => removeIncomeStream(s.id)}>×</button>
                </div>
              ))}
            </div>
            <button className="add-row-btn" onClick={() => addIncomeFromTemplate('blank')}>+ Add income stream</button>

            <div className="subsection-label" style={{ marginTop: 24 }}>One-Time Income Events</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              Enter the nominal amount you expect to receive. For inherited IRAs and Roth accounts, the balance is added to your pre-tax or Roth portfolio and forced out over 10 years per SECURE Act rules — the optimizer decides timing to minimize taxes within that constraint. Inherited HSAs are fully taxable as ordinary income in the year received.
            </div>
            <div className="stream-rows-scroll">
              <div className="stream-row lumpsum-row" style={{ padding: '6px 0', borderBottom: '2px solid var(--border-light)' }}>
                <div style={headerStyle}>Description</div>
                <div style={headerStyle}>Whose</div>
                <div style={headerStyle}>Account</div>
                <div style={headerStyle}>At age</div>
                <div style={headerStyle}>Amount (nominal $)</div>
                <div></div>
              </div>
              {(plan.lumpSumEvents ?? []).length === 0 && (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No one-time events — click "+ Add" for home sale, insurance payouts, inherited IRA/HSA, etc.
                </div>
              )}
              {(plan.lumpSumEvents ?? []).map((ev) => (
                <div key={ev.id} className="stream-row lumpsum-row" style={{ flexWrap: 'wrap' }}>
                  <input type="text" value={ev.description} style={{ fontSize: 13 }} onChange={(e) => updateLumpSumEvent(ev.id, { description: e.target.value })} />
                  <select value={ev.whose} style={{ fontSize: 13 }} onChange={(e) => updateLumpSumEvent(ev.id, { whose: e.target.value as LumpSumEvent['whose'] })}>
                    <option value="A">{nameA}</option>
                    <option value="B">{nameB}</option>
                    <option value="Household">Household</option>
                  </select>
                  <select value={ev.bucket} style={{ fontSize: 13 }} onChange={(e) => updateLumpSumEvent(ev.id, { bucket: e.target.value as LumpSumEvent['bucket'] })}>
                    <option value="taxable">Taxable (home sale, insurance, etc.)</option>
                    <option value="inheritedPreTaxIRA">Inherited Pre-Tax IRA</option>
                    <option value="inheritedRoth">Inherited Roth IRA</option>
                    <option value="inheritedHSA">Inherited HSA</option>
                  </select>
                  <NumberInput value={ev.age} digits={0} min={0} max={115} style={{ fontSize: 13 }} onCommit={(v) => updateLumpSumEvent(ev.id, { age: Math.round(v) })} />
                  <div className="input-prefix-wrap"><span className="input-prefix">$</span>
                    <NumberInput value={ev.amount} min={0} style={{ fontSize: 13, paddingLeft: 22 }} onCommit={(v) => updateLumpSumEvent(ev.id, { amount: v })} />
                  </div>
                  <button className="remove-btn" onClick={() => removeLumpSumEvent(ev.id)}>×</button>
                </div>
              ))}
            </div>
            <button className="add-row-btn" onClick={() => addLumpSumEvent({ id: `lump-${Date.now()}`, description: 'New Event', whose: 'Household', bucket: 'taxable', age: A.retirementAge, amount: 0 })}>+ Add one-time event</button>

            <div className="subsection-label" style={{ marginTop: 24 }}>Expenses</div>
            <div className="stream-rows-scroll">
              <div className="stream-row expense-row" style={{ padding: '6px 0', borderBottom: '2px solid var(--border-light)' }}>
                <div style={headerStyle}>Description</div>
                <div style={headerStyle}>Whose</div>
                <div style={headerStyle}>Start age</div>
                <div style={headerStyle}>Stop age</div>
                <div style={headerStyle}>Annual amt</div>
                <div style={headerStyle}>Infl %</div>
                <div></div>
              </div>
              {plan.expenseStreams.map((s) => (
                <div key={s.id} className="stream-row expense-row">
                  <input type="text" value={s.description} style={{ fontSize: 13 }} onChange={(e) => updateExpenseStream(s.id, { description: e.target.value })} />
                  <select value={s.whose} style={{ fontSize: 13 }} onChange={(e) => updateExpenseStream(s.id, { whose: e.target.value as ExpenseStream['whose'] })}>
                    <option value="Household">Household</option>
                    <option value="A">{nameA}</option>
                    <option value="B">{nameB}</option>
                  </select>
                  <NumberInput value={s.startAge} digits={0} min={minStartAge(s.whose)} max={110} style={{ fontSize: 13 }} onCommit={(v) => updateExpenseStream(s.id, { startAge: Math.round(v) })} />
                  <NumberInput value={s.stopAge} digits={0} min={0} max={115} style={{ fontSize: 13 }} onCommit={(v) => updateExpenseStream(s.id, { stopAge: Math.round(v) })} />
                  <div className="input-prefix-wrap"><span className="input-prefix">$</span>
                    <NumberInput value={s.annualAmount} digits={0} min={0} style={{ fontSize: 13, paddingLeft: 22 }} onCommit={(v) => updateExpenseStream(s.id, { annualAmount: Math.round(v) })} />
                  </div>
                  <GrowthRateInput
                    value={s.inflationPct}
                    inflation={asm.inflation}
                    onChange={(gr) => updateExpenseStream(s.id, { inflationPct: gr })}
                  />
                  <button className="remove-btn" onClick={() => removeExpenseStream(s.id)}>×</button>
                </div>
              ))}
            </div>
            <button className="add-row-btn" onClick={() => addExpenseFromTemplate('blank')}>+ Add expense category</button>
          </div>
        </div>

        {/* ── Section 3: Portfolio ─────────────────── */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Portfolio</div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total: {fmtM(total)}</span>
          </div>
          <div className="panel-body">
            {/* Returns + Inflation on one row */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 20, flexDirection: isMobile ? 'column' : 'row' }}>
              <div style={{ flex: 3 }}>
                <div className="subsection-label">Expected Returns</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: 12 }}>
                  {[
                    { label: 'Taxable', key: 'taxableReturn' as const, hint: 'Brokerage' },
                    { label: 'Pre-tax', key: 'tradReturn' as const, hint: '401(k) / IRA' },
                    { label: 'Roth', key: 'rothReturn' as const, hint: 'Roth IRA / 401k' },
                  ].map(({ label, key, hint }) => (
                    <div key={key} className="form-group">
                      <label>{label}{hint && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {hint}</span>}</label>
                      <div className="input-suffix-wrap">
                        <NumberInput value={asm[key]} scale={100} digits={1} onCommit={(v) => setAssumptions({ [key]: v })} />
                        <span className="input-suffix">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                {asm.taxableReturn > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 10 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ color: 'var(--text-muted)' }}>↳ Div / Interest Yield</label>
                      <div className="input-suffix-wrap">
                        <NumberInput
                          value={asm.taxableDivYield ?? 0}
                          scale={100}
                          digits={2}
                          onCommit={(v) => setAssumptions({ taxableDivYield: Math.min(Math.max(v, 0), asm.taxableReturn) })}
                        />
                        <span className="input-suffix">%</span>
                      </div>
                      <div className="helper-text">included in total return above; reinvested annually</div>
                    </div>
                    {(asm.taxableDivYield ?? 0) > 0 && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ color: 'var(--text-muted)' }}>→ % Qualified</label>
                        <div className="input-suffix-wrap">
                          <NumberInput
                            value={asm.taxableQualifiedPct ?? 0.80}
                            scale={100}
                            digits={0}
                            onCommit={(v) => setAssumptions({ taxableQualifiedPct: Math.min(Math.max(v, 0), 1) })}
                          />
                          <span className="input-suffix">%</span>
                        </div>
                        <div className="helper-text">qualified dividends (LTCG rates); remainder is ordinary income</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ width: 1, background: 'rgba(13,27,46,0.12)', margin: isMobile ? '12px 0' : '0 24px', alignSelf: 'stretch' }} />

              <div style={{ flex: 1 }}>
                <div className="subsection-label">Expected Inflation</div>
                <div className="form-group">
                  <label>Annual Rate</label>
                  <div className="input-suffix-wrap">
                    <NumberInput value={asm.inflation} scale={100} digits={1} onCommit={(v) => setAssumptions({ inflation: v })} />
                    <span className="input-suffix">%</span>
                  </div>
                  <div className="helper-text">Annual CPI</div>
                </div>
              </div>
            </div>

            <hr className="divider" />

            {/* Person A + B bucket panels */}
            <div className="two-col" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 16, gap: 0 }}>
              <div style={{ paddingRight: 24, borderRight: '2px solid rgba(13,27,46,0.18)' }}>
                <PortfolioPersonSection name={nameA} data={pf.personA} onChange={setPersonAPortfolio} isRetired={isRetiredA} inflation={asm.inflation} />
              </div>
              {pf.personB ? (
                <div style={{ paddingLeft: 24 }}>
                  <PortfolioPersonSection name={nameB} data={pf.personB} onChange={setPersonBPortfolio} isRetired={isRetiredB} inflation={asm.inflation} />
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 16 }}>No second person on this plan.</div>
              )}
            </div>
          </div>
        </div>

        {/* ── Section 4: Optimization goal & Roth mode ─────────────────── */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="panel-header">
            <div className="panel-title"><div className="panel-title-dot"></div>Optimization Goal</div>
          </div>
          <div className="panel-body" style={{ padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={inlineLabelStyle}>Goal</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(Object.keys(USER_GOALS) as UserGoal[]).map((key) => {
                  const active = key === selectedGoal;
                  return (
                    <button key={key} onClick={() => setSelectedGoal(key)} title={USER_GOALS[key].description}
                      style={inputPillStyle(active)}>
                      {active && <Chk />}{GOAL_SHORT_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={inlineLabelStyle}>Roth conversions</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => setConversion({ optimize: true })}
                  title="The optimizer searches conversion amounts for you"
                  style={inputPillStyle(conv.optimize === true)}
                >
                  {conv.optimize === true && <Chk />}🎯 Optimizer decides
                </button>
                <button onClick={() => setConversion({ optimize: false, mode: 'off' })}
                  style={inputPillStyle(!conv.optimize && conv.mode === 'off')}>
                  {!conv.optimize && conv.mode === 'off' && <Chk />}None
                </button>
                <select
                  value={!conv.optimize && conv.mode === 'bracket-fill' ? conv.bracketCeiling : ''}
                  onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setConversion({ optimize: false, mode: 'bracket-fill', bracketCeiling: v }); }}
                  style={inputSelectPillStyle(!conv.optimize && conv.mode === 'bracket-fill')}
                  aria-label="Bracket-Fill conversion ceiling"
                >
                  <option value="">Bracket-Fill</option>
                  {convBracketOptions.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
                <button onClick={() => setConversion({ optimize: false, mode: 'auto-window' })}
                  style={inputPillStyle(!conv.optimize && conv.mode === 'auto-window')}>
                  {!conv.optimize && conv.mode === 'auto-window' && <Chk />}Fixed Amount
                </button>
                <button onClick={() => setConversion({ optimize: false, mode: 'manual' })}
                  style={inputPillStyle(!conv.optimize && conv.mode === 'manual')}>
                  {!conv.optimize && conv.mode === 'manual' && <Chk />}Manual
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ── Build Plan button ─────────────────── */}
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {building && (
            <div style={{ width: 320, height: 6, background: 'rgba(13,27,46,0.08)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(buildProgress * 100)}%`, height: '100%', background: 'var(--gold)', transition: 'width 200ms ease' }} />
            </div>
          )}
          <button
            className="btn btn-gold"
            onClick={onBuildPlan}
            disabled={building || !canBuild}
            style={{ fontSize: 15, padding: '14px 40px', borderRadius: 10, opacity: (building || !canBuild) ? 0.5 : 1 }}
          >
            {building ? `Optimizing… ${Math.round(buildProgress * 100)}%` : 'Build Plan →'}
          </button>
          <div style={{ fontSize: 12, color: !canBuild ? 'var(--color-danger, #c0392b)' : 'var(--text-muted)' }}>
            {!canBuild
              ? (!isValidDob(A.dob) || (B && !isValidDob(B.dob))
                  ? 'Fix the date of birth in Personal Details (year must be 1900–present).'
                  : (!splitValidA || !splitValidB)
                    ? 'Contribution mix must add up to 100% in Portfolio.'
                    : 'Enter names for all people in Personal Details to build your plan.')
              : 'Runs the optimizer for your selected goal, then opens your results dashboard.'}
          </div>
          {buildError && (
            <div style={{ fontSize: 12, color: 'var(--color-danger, #c0392b)', maxWidth: 400, textAlign: 'center' }}>
              Optimizer failed: {buildError}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function PortfolioPersonSection({ name, data, onChange, isRetired = false, inflation }: { name: string; data: PersonPortfolio; onChange: (patch: Partial<PersonPortfolio>) => void; isRetired?: boolean; inflation: number }) {
  const split = data.contribSplit;
  const splitPct = Math.round((split.taxable + split.traditional + split.roth) * 100);

  type BucketKey = 'taxable' | 'traditional' | 'roth';
  const [pctDraft, setPctDraft] = useState<Record<BucketKey, string>>({
    taxable: String(Math.round(split.taxable * 100)),
    traditional: String(Math.round(split.traditional * 100)),
    roth: String(Math.round(split.roth * 100)),
  });
  const editingRef = useRef(false);

  useEffect(() => {
    if (!editingRef.current) {
      setPctDraft({
        taxable: String(Math.round(split.taxable * 100)),
        traditional: String(Math.round(split.traditional * 100)),
        roth: String(Math.round(split.roth * 100)),
      });
    }
  }, [split.taxable, split.traditional, split.roth]);

  const commitBucket = (key: BucketKey) => {
    editingRef.current = false;
    const parsed = parseFloat(pctDraft[key]);
    const v = isNaN(parsed) ? split[key] * 100 : Math.max(0, Math.min(100, parsed));
    setPctDraft((prev) => ({ ...prev, [key]: String(v) }));
    onChange({ contribSplit: { ...split, [key]: v / 100 } });
  };

  return (
    <div>
      <div className="subsection-label">{name} <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>· {fmtK(data.taxable + data.traditional + data.roth)}</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: data.taxable > 0 ? 4 : 16 }}>
        <div className="form-group">
          <label>Taxable</label>
          <div className="input-prefix-wrap"><span className="input-prefix">$</span>
            <NumberInput value={data.taxable} min={0} style={{ paddingLeft: 22 }} onCommit={(v) => onChange({ taxable: v })} />
          </div>
        </div>
        <div className="form-group">
          <label>Pre-tax</label>
          <div className="input-prefix-wrap"><span className="input-prefix">$</span>
            <NumberInput value={data.traditional} min={0} style={{ paddingLeft: 22 }} onCommit={(v) => onChange({ traditional: v })} />
          </div>
        </div>
        <div className="form-group">
          <label>Roth</label>
          <div className="input-prefix-wrap"><span className="input-prefix">$</span>
            <NumberInput value={data.roth} min={0} style={{ paddingLeft: 22 }} onCommit={(v) => onChange({ roth: v })} />
          </div>
        </div>
      </div>
      {data.taxable > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ color: 'var(--text-muted)' }}>↳ Taxable Basis</label>
            <div className="input-prefix-wrap"><span className="input-prefix">$</span>
              <NumberInput
                value={data.taxableBasis ?? data.taxable * 0.5}
                min={0}
                style={{ paddingLeft: 22 }}
                onCommit={(v) => onChange({ taxableBasis: Math.min(v, data.taxable) })}
              />
            </div>
            <div className="helper-text">
              {Math.round(Math.max(0, (1 - (data.taxableBasis ?? data.taxable * 0.5) / data.taxable) * 100))}% unrealized gain
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div className="form-group">
          <label>Annual contribution</label>
          <div className="input-prefix-wrap"><span className="input-prefix">$</span>
            <NumberInput value={isRetired ? 0 : data.annualContribution} min={0} style={{ paddingLeft: 22 }} disabled={isRetired} onCommit={(v) => onChange({ annualContribution: v })} />
          </div>
          {isRetired && <div className="helper-text">Already retired</div>}
        </div>
        <div className="form-group">
          <label>Contribution growth</label>
          {isRetired
            ? <div className="input-suffix-wrap"><input type="number" value="0" disabled style={{}} /><span className="input-suffix">%</span></div>
            : <GrowthRateInput value={data.contribGrowth} inflation={inflation} onChange={(gr) => onChange({ contribGrowth: gr })} />
          }
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>Contribution mix</div>
        {!isRetired && (
          <span style={{ fontSize: 11, fontWeight: 700, color: splitPct === 100 ? 'var(--success)' : 'var(--warning)' }}>
            {splitPct === 100 ? '✓ 100%' : `⚠ ${splitPct}%`}
          </span>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {(['taxable', 'traditional', 'roth'] as const).map((k) => (
          <div key={k} className="form-group">
            <label>{k === 'taxable' ? 'Taxable' : k === 'traditional' ? 'Pre-tax' : 'Roth'}</label>
            <div className="input-suffix-wrap">
              <input
                type="text"
                inputMode="numeric"
                value={isRetired ? '0' : pctDraft[k]}
                disabled={isRetired}
                onFocus={() => { editingRef.current = true; }}
                onChange={(e) => setPctDraft((prev) => ({ ...prev, [k]: e.target.value }))}
                onBlur={() => commitBucket(k)}
              />
              <span className="input-suffix">%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
