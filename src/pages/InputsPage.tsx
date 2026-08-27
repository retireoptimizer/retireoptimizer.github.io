import React, { useState, useEffect, useRef } from 'react';
import * as Comlink from 'comlink';
import { useNavigate } from 'react-router-dom';
import { usePlanStore } from '../store/usePlanStore';
import { useOptimizerStore } from '../store/useOptimizerStore';
import { useWhatIfStore } from '../store/useWhatIfStore';
import { householdTotals, resolveGrowthRate } from '../schemas/plan';
import type { IncomeStream, ExpenseStream, LumpSumEvent, PersonPortfolio, GrowthRate, EndRule } from '../schemas/plan';
import { computePlanWarnings } from '../engine/planWarnings';
import { NumberInput } from '../components/inputs/NumberInput';
import { listStates } from '../engine/stateTax';
import { fmtM, fmtK, fmtPct } from '../lib/format';
import { useIsMobile } from '../hooks/useIsMobile';
import { INCOME_TEMPLATES, EXPENSE_TEMPLATES } from '../engine/streamTemplates';
import { getEngineWorker } from '../engine/workerClient';
import { applyResultToPlan } from '../engine/applyOptimizerResult';
import { planInputKey } from '../engine/planInputKey';
import { USER_GOALS, type UserGoal } from '../engine/recommender';
import { FED_BRACKETS_MFJ, FED_BRACKETS_SINGLE } from '../engine/taxConstants';

const headerStyle: React.CSSProperties = { fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', whiteSpace: 'nowrap' };

function EndRuleControl({ end, startAge, onChange }: {
  end: EndRule;
  startAge: number;
  onChange: (end: EndRule) => void;
}) {
  const handleMode = (mode: EndRule['mode']) => {
    if (mode === 'age') onChange({ mode: 'age', age: end.mode === 'age' ? end.age : startAge + 25 });
    else if (mode === 'years') onChange({ mode: 'years', n: end.mode === 'years' ? end.n : 20 });
    else onChange({ mode } as EndRule);
  };
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center', minWidth: 0 }}>
      <select value={end.mode} style={{ fontSize: 12, flex: '1 1 auto', minWidth: 0 }} onChange={(e) => handleMode(e.target.value as EndRule['mode'])}>
        <option value="age">At age</option>
        <option value="life">End of life</option>
        <option value="lastSurvivor">Last survivor</option>
        <option value="years">For N yrs</option>
      </select>
      {end.mode === 'age' && (
        <NumberInput value={end.age} digits={0} min={0} max={115} style={{ fontSize: 13, width: 44, flexShrink: 0 }} onCommit={(v) => onChange({ mode: 'age', age: Math.round(v) })} />
      )}
      {end.mode === 'years' && (
        <NumberInput value={end.n} digits={0} min={1} max={60} style={{ fontSize: 13, width: 36, flexShrink: 0 }} onCommit={(v) => onChange({ mode: 'years', n: Math.round(v) })} />
      )}
    </div>
  );
}

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
  width: 18, height: 32, border: 'none', background: 'rgba(13,27,46,0.06)',
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

  const selectFlex = value.mode === 'cpi' ? '1 1 auto' : '0 0 58px';

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

/** Shown in both Income Streams and Portfolio when muni income is entered via both paths.
 *  `where` tailors the closing line to point at the *other* section. */
function MuniDoubleCountWarning({ exemptYield, where }: { exemptYield: number; where: 'income' | 'portfolio' }) {
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      background: 'var(--warning-light)',
      border: '1px solid var(--warning)',
      borderLeft: '4px solid var(--warning)',
      borderRadius: 6,
      padding: '10px 12px',
      // In Income the table follows, so leave a gap; in Portfolio this is the last child.
      marginBottom: where === 'income' ? 10 : 0,
    }}>
      <span style={{ fontSize: 16, lineHeight: '18px', flexShrink: 0 }}>⚠️</span>
      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--warning)' }}>
        <strong style={{ display: 'block', marginBottom: 2, fontSize: 13 }}>
          Muni income may be counted twice
        </strong>
        You have both a tax-exempt portfolio yield of <strong>{fmtPct(exemptYield, 2)}</strong> and a{' '}
        <strong>Tax-Exempt Income</strong> stream
        {where === 'income' ? ' below' : ' in Income & Expenses'}. Use the <em>Tax-Exempt Yield</em> in
        Portfolio for munis held inside the brokerage balance, and the stream only for bonds held
        outside it — not both for the same bonds.
      </div>
    </div>
  );
}

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

  // Auto-correct single SS streams that pre-date the locked-EndRule UI: if a person
  // has exactly one SS stream and its end mode is not lastSurvivor, fix it silently.
  useEffect(() => {
    const ssCounts: Record<string, number> = {};
    for (const s of plan.incomeStreams) {
      if (s.type === 'SS') ssCounts[s.whose] = (ssCounts[s.whose] ?? 0) + 1;
    }
    for (const s of plan.incomeStreams) {
      if (s.type === 'SS' && (ssCounts[s.whose] ?? 0) === 1 && s.end.mode !== 'lastSurvivor') {
        updateIncomeStream(s.id, { end: { mode: 'lastSurvivor' }, survivorPct: 0 });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const planThroughAge = A.planThroughAge;
  const planWarnings = computePlanWarnings(plan);
  const minStartAge = (whose: string) => {
    if (whose === 'B' && B) return B.retirementAge;
    if (whose === 'Household' && B) return Math.min(A.retirementAge, B.retirementAge);
    return A.retirementAge;
  };

  const addIncomeFromTemplate = (tplId: string) => {
    const tpl = INCOME_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    addIncomeStream(tpl.make({ retirementAge, planThroughAge }));
  };

  const addExpenseFromTemplate = (tplId: string) => {
    const tpl = EXPENSE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    addExpenseStream(tpl.make({ retirementAge, planThroughAge }));
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
      <div className="page-body" style={{ maxWidth: 1024, margin: '0 auto' }}>

        {planWarnings.length > 0 && (
          <div className="plan-warnings-strip">
            {planWarnings.map((w) => (
              <div key={w.id} className={`plan-warning ${w.severity}`}>
                {w.severity === 'error' ? '⚠' : '⚑'} {w.message}
              </div>
            ))}
          </div>
        )}

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
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div className="form-group">
                <label>Your Name</label>
                <input type="text" value={A.name} placeholder="Your name" onChange={(e) => setPersonA({ name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Date of Birth</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="date" value={dobA} style={{ flex: 1, minWidth: 0 }}
                    onChange={(e) => { setDobA(e.target.value); if (isValidDob(e.target.value)) setPersonA({ dob: e.target.value }); }}
                    onBlur={() => { if (!isValidDob(dobA)) setDobA(A.dob); }}
                  />
                  <span style={{ fontSize: 11, whiteSpace: 'nowrap', color: isValidDob(dobA) ? 'var(--text-muted)' : 'var(--color-danger, #c0392b)' }}>
                    {isValidDob(dobA) ? `Age ${ageFromDob(dobA)}` : 'Invalid'}
                  </span>
                </div>
              </div>
              <div className="form-group">
                <label>Retirement Age</label>
                <NumberInput value={A.retirementAge} digits={0} min={40} max={80} onCommit={(v) => setPersonA({ retirementAge: Math.round(v) })} />
              </div>
              <div className="form-group">
                <label>Plan Through Age</label>
                <NumberInput value={A.planThroughAge} digits={0} min={60} max={115} onCommit={(v) => setPersonA({ planThroughAge: Math.round(v) })} />
              </div>
              {B && (<>
                <div className="form-group">
                  <label>Spouse / Partner Name</label>
                  <input type="text" value={B.name} placeholder="Spouse / partner name" onChange={(e) => setPersonB({ name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Date of Birth</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input type="date" value={dobB} style={{ flex: 1, minWidth: 0 }}
                      onChange={(e) => { setDobB(e.target.value); if (isValidDob(e.target.value)) setPersonB({ dob: e.target.value }); }}
                      onBlur={() => { if (!isValidDob(dobB)) setDobB(B.dob); }}
                    />
                    <span style={{ fontSize: 11, whiteSpace: 'nowrap', color: isValidDob(dobB) ? 'var(--text-muted)' : 'var(--color-danger, #c0392b)' }}>
                      {isValidDob(dobB) ? `Age ${ageFromDob(dobB)}` : 'Invalid'}
                    </span>
                  </div>
                </div>
                <div className="form-group">
                  <label>Retirement Age</label>
                  <NumberInput value={B.retirementAge} digits={0} min={40} max={80} onCommit={(v) => setPersonB({ retirementAge: Math.round(v) })} />
                </div>
                <div className="form-group">
                  <label>Plan Through Age</label>
                  <NumberInput value={B.planThroughAge} digits={0} min={60} max={115} onCommit={(v) => setPersonB({ planThroughAge: Math.round(v) })} />
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
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <div className="subsection-label" style={{ marginBottom: 0 }}>ACA Healthcare</div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
                    <input type="checkbox" checked={asm.modelACA} onChange={(e) => setAssumptions({ modelACA: e.target.checked })} style={{ accentColor: 'var(--gold)', width: 13, height: 13 }} />
                    Model pre-Medicare costs
                  </label>
                </div>
                {asm.modelACA && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: asm.acaNoSubsidy ? '175px auto' : '175px 100px auto', gap: 10, alignItems: 'start' }}>
                      <div className="form-group">
                        <label>Annual Premium <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(per person)</span></label>
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
            <div className="helper-text" style={{ marginBottom: 8 }}>
              Enter income whose principal is <em>not</em> in your portfolio above — pensions, rental, external bond ladders. Dividends and interest from the brokerage balance are already modeled by the yield fields in Portfolio.
            </div>
            {(asm.taxableExemptYield ?? 0) > 0 && plan.incomeStreams.some((s) => s.type === 'MuniBond') && (
              <MuniDoubleCountWarning exemptYield={asm.taxableExemptYield ?? 0} where="income" />
            )}
            <div className="stream-rows-scroll">
              <div className="stream-row income-row" style={{ padding: '6px 0', borderBottom: '2px solid var(--border-light)' }}>
                <div style={headerStyle}>Description</div>
                <div style={headerStyle}>Whose</div>
                <div style={headerStyle}>Type</div>
                <div style={headerStyle}>Start age</div>
                <div style={headerStyle}>Until</div>
                <div style={headerStyle}>Annual amt</div>
                <div style={headerStyle}>Growth %</div>
                <div style={headerStyle}>Survivor %</div>
                <div style={headerStyle}>State Tax %</div>
                <div></div>
              </div>
              {plan.incomeStreams.length === 0 && (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  No income streams yet — click "+ Add" to add SS, pension, annuity, or other income.
                </div>
              )}
              {(() => {
                const ssCountByOwner = plan.incomeStreams.reduce<Record<string, number>>((acc, s) => {
                  if (s.type === 'SS') acc[s.whose] = (acc[s.whose] ?? 0) + 1;
                  return acc;
                }, {});
                return plan.incomeStreams.map((s) => {
                  const isSS = s.type === 'SS';
                  const lockedSS = isSS && (ssCountByOwner[s.whose] ?? 0) <= 1;
                  return (
                    <div key={s.id} className="stream-row income-row">
                      <input type="text" value={s.description} style={{ fontSize: 13 }} onChange={(e) => updateIncomeStream(s.id, { description: e.target.value })} />
                      <select value={s.whose} style={{ fontSize: 13 }} onChange={(e) => updateIncomeStream(s.id, { whose: e.target.value as IncomeStream['whose'] })}>
                        <option value="A">{nameA}</option>
                        {B && <option value="B">{nameB}</option>}
                        <option value="Household">Household</option>
                      </select>
                      <select value={s.type} style={{ fontSize: 13 }} onChange={(e) => {
                        const type = e.target.value as IncomeStream['type'];
                        const isExempt = type === 'MuniBond' || type === 'VA';
                        updateIncomeStream(s.id, {
                          type,
                          taxablePct: isExempt ? 0 : (s.taxablePct === 0 && !isExempt ? 1 : s.taxablePct),
                          ...(type === 'VA' ? { stateTaxablePct: 0 } : {}),
                          ...(type === 'SS' ? { end: { mode: 'lastSurvivor' as const }, survivorPct: 0 } : {}),
                        });
                      }}>
                        <option value="SS">SS</option>
                        <option value="Pension">Pension</option>
                        <option value="Annuity">Annuity</option>
                        <option value="MuniBond">Tax-Exempt Income</option>
                        <option value="VA">VA / Disability</option>
                        <option value="Other">Other</option>
                      </select>
                      <NumberInput value={s.startAge} digits={0} min={minStartAge(s.whose)} max={110} style={{ fontSize: 13 }} onCommit={(v) => updateIncomeStream(s.id, { startAge: Math.round(v) })} />
                      {lockedSS
                        ? <span style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 2 }} title="SS never stops — survivor benefit is built-in">Last survivor</span>
                        : <EndRuleControl end={s.end} startAge={s.startAge} onChange={(end) => updateIncomeStream(s.id, { end })} />
                      }
                      <div className="input-prefix-wrap"><span className="input-prefix">$</span>
                        <NumberInput value={s.annualAmount} digits={0} min={0} style={{ fontSize: 13, paddingLeft: 22 }} onCommit={(v) => updateIncomeStream(s.id, { annualAmount: Math.round(v) })} />
                      </div>
                      <GrowthRateInput value={s.growthPct} inflation={asm.inflation} onChange={(gr) => updateIncomeStream(s.id, { growthPct: gr })} />
                      {isSS
                        ? <div title="SS survivor benefits are modeled separately — not controlled here" style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 2 }}>Built-in</div>
                        : <div className="input-suffix-wrap">
                            <NumberInput value={s.survivorPct} scale={100} digits={0} min={0} max={100} style={{ fontSize: 13 }} onCommit={(v) => updateIncomeStream(s.id, { survivorPct: v })} />
                            <span className="input-suffix">%</span>
                          </div>
                      }
                      <div className="input-suffix-wrap" title={s.type === 'VA' ? '38 U.S.C. §5301: VA disability is fully exempt from state tax' : 'Only applies when using a Custom flat-rate state. Named states apply their own rules.'}>
                        <NumberInput value={s.stateTaxablePct ?? 1} scale={100} digits={0} min={0} max={100} style={{ fontSize: 13, opacity: s.type === 'VA' ? 0.45 : 1 }} disabled={s.type === 'VA'} onCommit={(v) => updateIncomeStream(s.id, { stateTaxablePct: v })} />
                        <span className="input-suffix">%</span>
                      </div>
                      <button className="remove-btn" onClick={() => removeIncomeStream(s.id)}>×</button>
                    </div>
                  );
                });
              })()}
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
                    {B && <option value="B">{nameB}</option>}
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
                <div style={headerStyle}>Until</div>
                <div style={headerStyle}>Annual amt</div>
                <div style={headerStyle}>Infl %</div>
                <div style={headerStyle}>Survivor %</div>
                <div></div>
              </div>
              {plan.expenseStreams.map((s) => (
                <div key={s.id} className="stream-row expense-row">
                  <input type="text" value={s.description} style={{ fontSize: 13 }} onChange={(e) => updateExpenseStream(s.id, { description: e.target.value })} />
                  <select value={s.whose} style={{ fontSize: 13 }} onChange={(e) => updateExpenseStream(s.id, { whose: e.target.value as ExpenseStream['whose'] })}>
                    <option value="Household">Household</option>
                    <option value="A">{nameA}</option>
                    {B && <option value="B">{nameB}</option>}
                  </select>
                  <NumberInput value={s.startAge} digits={0} min={minStartAge(s.whose)} max={110} style={{ fontSize: 13 }} onCommit={(v) => updateExpenseStream(s.id, { startAge: Math.round(v) })} />
                  <EndRuleControl end={s.end} startAge={s.startAge} onChange={(end) => updateExpenseStream(s.id, { end })} />
                  <div className="input-prefix-wrap"><span className="input-prefix">$</span>
                    <NumberInput value={s.annualAmount} digits={0} min={0} style={{ fontSize: 13, paddingLeft: 22 }} onCommit={(v) => updateExpenseStream(s.id, { annualAmount: Math.round(v) })} />
                  </div>
                  <GrowthRateInput value={s.inflationPct} inflation={asm.inflation} onChange={(gr) => updateExpenseStream(s.id, { inflationPct: gr })} />
                  <div className="input-suffix-wrap">
                    <NumberInput value={s.survivorPct} scale={100} digits={0} min={0} max={100} style={{ fontSize: 13 }} onCommit={(v) => updateExpenseStream(s.id, { survivorPct: v })} />
                    <span className="input-suffix">%</span>
                  </div>
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
                    <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                      <label>{label}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> · {hint}</span></label>
                      <div className="input-suffix-wrap">
                        <NumberInput value={asm[key]} scale={100} digits={1} onCommit={(v) => setAssumptions({ [key]: v })} />
                        <span className="input-suffix">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Taxable-return composition. Full-width strip so it uses the horizontal axis
                    instead of stacking under the Taxable column and leaving Pre-tax / Roth empty.
                    Anchored to the Taxable column by the caret + heading. */}
                {asm.taxableReturn > 0 && (() => {
                  const divYield = asm.taxableDivYield ?? 0;
                  const exemptYield = asm.taxableExemptYield ?? 0;
                  return (
                    <div style={{
                      marginTop: 10, padding: '10px 12px', borderRadius: 8,
                      background: 'rgba(13,27,46,0.03)',
                      border: '1px solid rgba(13,27,46,0.08)',
                      borderTop: '2px solid rgba(13,27,46,0.16)',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.02em' }}>
                        ↳ Yield breakdown
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
                        <div style={{ display: 'flex', gap: 10, flex: 1, width: isMobile ? '100%' : undefined }}>
                          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                            <label style={{ color: 'var(--text-muted)' }}>Div / Interest Yield</label>
                            <div className="input-suffix-wrap">
                              <NumberInput
                                value={divYield}
                                scale={100}
                                digits={2}
                                onCommit={(v) => setAssumptions({ taxableDivYield: Math.min(Math.max(v, 0), Math.max(0, asm.taxableReturn - exemptYield)) })}
                              />
                              <span className="input-suffix">%</span>
                            </div>
                            <div className="helper-text">taxable dividends &amp; interest</div>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0, flex: 1, opacity: divYield > 0 ? 1 : 0.45 }}>
                            <label style={{ color: 'var(--text-muted)' }}>→ % Qualified</label>
                            <div className="input-suffix-wrap">
                              <NumberInput
                                value={asm.taxableQualifiedPct ?? 0.80}
                                scale={100}
                                digits={0}
                                disabled={divYield === 0}
                                onCommit={(v) => setAssumptions({ taxableQualifiedPct: Math.min(Math.max(v, 0), 1) })}
                              />
                              <span className="input-suffix">%</span>
                            </div>
                            <div className="helper-text">of the yield at left — LTCG rates</div>
                          </div>
                        </div>

                        <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(13,27,46,0.12)', display: isMobile ? 'none' : 'block' }} />

                        <div style={{ display: 'flex', gap: 10, flex: 1, width: isMobile ? '100%' : undefined }}>
                          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                            <label style={{ color: 'var(--text-muted)' }}>Tax-Exempt Yield</label>
                            <div className="input-suffix-wrap">
                              <NumberInput
                                value={exemptYield}
                                scale={100}
                                digits={2}
                                onCommit={(v) => setAssumptions({ taxableExemptYield: Math.min(Math.max(v, 0), Math.max(0, asm.taxableReturn - divYield)) })}
                              />
                              <span className="input-suffix">%</span>
                            </div>
                            <div className="helper-text">muni interest — hits SS / ACA / IRMAA, not AGI</div>
                          </div>
                          <div className="form-group" style={{ marginBottom: 0, flex: 1, opacity: exemptYield > 0 ? 1 : 0.45 }}>
                            <label style={{ color: 'var(--text-muted)' }}>→ % State-taxable</label>
                            <div className="input-suffix-wrap">
                              <NumberInput
                                value={asm.taxableExemptStatePct ?? 1}
                                scale={100}
                                digits={0}
                                disabled={exemptYield === 0}
                                onCommit={(v) => setAssumptions({ taxableExemptStatePct: Math.min(Math.max(v, 0), 1) })}
                              />
                              <span className="input-suffix">%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Payout election — applies jointly to both yield types */}
                      {(divYield > 0 || exemptYield > 0) && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(13,27,46,0.10)' }}>
                          <div className="form-group" style={{ marginBottom: 0, flex: '0 0 120px' }}>
                            <label style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>→ % Reinvested</label>
                            <div className="input-suffix-wrap">
                              <NumberInput
                                value={1 - (asm.taxableDistributePct ?? 0)}
                                scale={100}
                                digits={0}
                                onCommit={(v) => setAssumptions({ taxableDistributePct: Math.min(Math.max(1 - v, 0), 1) })}
                              />
                              <span className="input-suffix">%</span>
                            </div>
                          </div>
                          <div className="helper-text" style={{ marginTop: 22, flex: 1 }}>
                            100% = full DRIP — yield compounds into cost basis. Lower values sweep dividends to checking before selling shares. Tax is the same either way.
                          </div>
                        </div>
                      )}

                      {exemptYield > 0 && plan.incomeStreams.some((s) => s.type === 'MuniBond') && (
                        <MuniDoubleCountWarning exemptYield={exemptYield} where="portfolio" />
                      )}
                    </div>
                  );
                })()}
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

            <div style={{
              padding: '10px 12px', borderRadius: 8,
              background: 'rgba(13,27,46,0.03)',
              border: '1px solid rgba(13,27,46,0.08)',
              borderTop: '2px solid rgba(13,27,46,0.16)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.02em' }}>
                ↳ End balance effective tax rates
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ marginBottom: 0, flex: '0 0 110px' }}>
                  <label style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>IRA / 401(k)</label>
                  <div className="input-suffix-wrap" title="Blended effective rate on the ending pre-tax balance — not a bracket, not used in year-by-year taxes.">
                    <NumberInput value={asm.taxAdjOrdRate ?? 0.22} scale={100} digits={1} min={0} max={60}
                      onCommit={(v) => setAssumptions({ taxAdjOrdRate: Math.min(0.6, Math.max(0, v)) })} />
                    <span className="input-suffix">%</span>
                  </div>
                  <div className="helper-text" style={{ whiteSpace: 'nowrap' }}>income tax when withdrawn</div>
                </div>
                <div className="form-group" style={{ marginBottom: 0, flex: '0 0 110px' }}>
                  <label style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Brokerage gains</label>
                  <div className="input-suffix-wrap" title="Blended effective rate on the ending brokerage gain above basis — not a bracket, not used in year-by-year taxes.">
                    <NumberInput value={asm.taxAdjLtcgRate ?? 0.15} scale={100} digits={1} min={0} max={40}
                      onCommit={(v) => setAssumptions({ taxAdjLtcgRate: Math.min(0.4, Math.max(0, v)) })} />
                    <span className="input-suffix">%</span>
                  </div>
                  <div className="helper-text" style={{ whiteSpace: 'nowrap' }}>capital gains on unrealized gains</div>
                </div>
                <div className="helper-text" style={{ alignSelf: 'center', flex: 1, minWidth: 160 }}>
                  Roth is worth face value. Pre-tax and brokerage gains still owe taxes — these rates let the optimizer score all three on equal footing. Set both to 0% for raw balances.
                </div>
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
