import type { Plan, LumpSumEvent, PersonPortfolio } from '../schemas/plan';
import { householdTotals, resolveGrowthRate } from '../schemas/plan';
import { taxAdjustedRates, taxAdjustedValue } from './taxAdjusted';
import {
  householdAgeFrame,
  resolveIncomeStreams,
  resolveExpenseStreams,
  streamFactor,
  type ResolvedIncome,
  type ResolvedExpense,
} from './streamWindow';
import { filingStatusForYear, type FilingStatus } from './filingStatus';
import { rmdDivisor, rmdStartAgeForDob, inheritedRmdDivisor } from './rmd';
import { allocateQcd, qcdAvailable, qcdEligible, qcdLimit } from './qcd';
import { allocateHsaContribution, hsaContribEligible, hsaLastResortDraw, hsaPayAge, hsaQualifiedPayment, HSA_MEDICARE_AGE } from './hsa';
import { resolveTipsLadder, tipsLadderYear, type TipsYear } from './tipsLadder';
import { householdSS, ssStartAge } from './socialSecurity';
import { yearFederalTax, standardDeduction, taxableSocialSecurity, seniorBonusDeduction } from './tax';
import { FED_BRACKETS_MFJ, FED_BRACKETS_SINGLE, IRA_CONTRIB_LIMIT, IRA_CATCHUP, IRA_CATCHUP_AGE, INHERITED_DEADLINE_YEARS, OBBBA_NONITEMIZER_CHARITY, OBBBA_NONITEMIZER_CHARITY_FIRST_YEAR } from './taxConstants';
import { rothConversion } from './conversion';
import { applyWithdrawalOrder, applyBlendPolicy, type SpillKind, type WithdrawalOutputs } from './withdrawal';
import { resolveStrategy } from './strategy/resultSettings';
import type { BlendPolicy } from './blendPolicy';
import { findWindow } from './blendPolicy';
import { annualIRMAACost } from './irmaa';
import { annualNIIT } from './niit';
import { stateTax, STATE_PROFILES, HSA_NONCONFORMING_STATES } from './stateTax';
import { acaNetPremium } from './aca';
import { buildYearDecisions, type YearDecision } from './explain/yearDecisions';
import { irmaaHeadroomNote, acaCliffNote } from './explain/headroom';

export interface ProjectionRow {
  year: number;            // 1-indexed plan year
  ageA: number;
  ageB?: number;
  phase: 'Accum.' | 'SemiRetire' | 'Retire' | 'Survivor';
  filingStatus: FilingStatus;
  inflationFactor: number;
  // Contributions
  contribA: number;
  contribB: number;
  // Subset of contribA/contribB that is a spousal IRA contribution (retired person, working
  // spouse). Broken out so the contributions column can explain the drop at the retirement
  // boundary — a $50k salary deferral and an $8.6k spousal IRA are not the same thing.
  spousalA: number;
  spousalB: number;
  // Income
  ssA: number;
  ssB: number;
  totalSS: number;
  otherIncome: number;     // pension, wages, rental, etc. (gross spendable)
  otherIncomeTaxable: number;  // federal-taxable portion of otherIncome (excl. exempt interest)
  otherIncomeNonExempt: number; // subset of otherIncomeTaxable that is NOT IL/pension-exempt (wages, rental)
  exemptInterest: number;  // total §103 exempt interest (muni streams + portfolio yield); in SS PI, ACA & IRMAA MAGI
  // Spending
  netSpend: number;
  // Withdrawals
  wdTax: number;
  wdTrd: number;
  wdRth: number;
  totalWD: number;
  bracketOverridden: boolean;
  // Tax / conversions
  rmd: number;
  rothConv: number;
  ordIncome: number;       // taxable ordinary income (pre-deduction gross)
  ltcg: number;           // taxable LTCG + qualified dividends (net of any retiree HSA deduction ordinary income could not absorb)
  ordinaryDiv: number;     // ordinary (non-qualified) dividends from taxable account
  qualifiedDiv: number;    // qualified dividends from taxable account (subset of ltcg)
  distributedCash: number; // yield paid out in cash (not reinvested); taxed same as reinvested yield
  distributedDiv?: number; // taxable dividend part of distributedCash (excludes tax-exempt interest)
  fedTax: number;
  stateTaxAmt: number;
  irmaa: number;
  niit: number;
  effRate: number;
  marginalRate: number;         // top federal bracket rate on last dollar of taxable ordinary income
  stateMarginalRate: number;    // flat state rate when taxable state income > 0, else 0
  stdDeduction: number;  // base standard deduction + senior bonus combined
  seniorBonus: number;   // senior bonus deduction portion only ($6k/person 65+, OBBBA)
  magi: number;          // MAGI = ordIncome + ltcg (pre-deduction; NIIT and OBBBA senior bonus base)
  acaMagi: number;       // ACA MAGI = surchargeMAGI + non-taxable SS (IRC §36B definition)
  irmaaMagi: number;     // IRMAA MAGI actually used (2-year lookback; surchargeMAGI from year i-2)
  acaPremium: number;    // net ACA premium after APTC (0 when modelACA=false or post-Medicare)
  // One-time events & surplus
  lumpSumInjectTaxable: number; // direct account injections from lump-sum events (taxable bucket)
  lumpSumInjectTrad: number;
  lumpSumInjectRoth: number;
  lumpSumOrdinaryIncome: number;   // ordinary income from inheritedPreTaxIRA dists + inheritedHSA
  lumpSumForcedTradDist: number;   // required minimum from inheritedPreTaxIRA, outside wdTrd
  lumpSumForcedRothDist: number;   // required minimum from inheritedRoth, outside wdRth
  inheritedTradFromWd: number;     // part of wdTrd drawn from inherited pre-tax accounts
  inheritedRothFromWd: number;     // part of wdRth drawn from inherited Roth accounts
  inheritedBegBal: number;         // start-of-year balance in inherited pre-tax + Roth accounts
  inheritedBal: number;            // year-end balance left in inherited pre-tax + Roth accounts
  inheritedRothBegBal: number;     // Roth part of inheritedBegBal
  inheritedRothBal: number;        // Roth part of inheritedBal
  cashSurplus: number;          // after-tax income surplus swept to taxable
  // Balances
  begTaxable: number;
  begTraditional: number;
  begRoth: number;
  endTaxable: number;
  endTraditional: number;
  endRoth: number;
  endTotal: number;
  endTaxableBasis: number;
  endTaxAdjusted: number;
  ranOut: boolean;          // true from the first year spending could not be funded from the portfolio
  shortfall: number;        // unfunded spending gap this year (nominal $, scaled to real at lifetimeShortfallReal)
  taxFromBrokerage: number;   // amount pulled from taxable to cover taxes (taxFromBrokFinal)
  // Spending by category tag (subsets of netSpend). Informational until the HSA/QCD features read them.
  medicalSpend: number;       // expense rows tagged 'medical'
  charitableSpend: number;    // expense rows tagged 'charitable'
  // QCD: charitable giving paid straight from an IRA. `rmd` stays the gross RMD; `qcd` is the part of
  // it (and of any excess) sent to charity untaxed, and `qcdBeyondRmd` is the excess over the RMD.
  qcd: number;
  qcdBeyondRmd: number;
  qcdB: number;               // part of qcd paid from Person B's IRA (the rest is A's)
  qcdTaxable: number;         // part of qcd taxed as income under §408(d)(8)(A) (deductible IRA contributions from 70½)
  charityDeduction: number;   // OBBBA non-itemizer deduction included in stdDeduction
  // Owned HSA (both persons combined). Zero on plans without one; kept out of the bit-exact whitelist.
  begHSA: number;
  endHSA: number;             // included in endTotal
  hsaContrib: number;         // contributions this year (working ones come from outside the portfolio)
  hsaContribRet: number;      // part of hsaContrib paid by a retiree out of the portfolio (cash need, tax deduction)
  hsaQualifiedWD: number;     // paid tax-free to qualified medical spending and IRMAA; counts as cash in
  hsaReceiptsBal: number;     // household pool of medical bills paid elsewhere, still claimable tax-free
  // Last-resort HSA draws, used only after taxable, pre-tax and Roth money is gone.
  hsaReimbursed: number;      // receipts reimbursed tax-free
  hsaNonQualWD: number;       // non-qualified draw: ordinary income (in magi, ACA, state tax)
  hsaPenalty: number;         // 20% penalty on the part of hsaNonQualWD taken by an owner under 65
  // TIPS ladder sleeve. Zero on plans without a ladder; kept out of the bit-exact whitelist. The sleeve
  // is part of endTotal but not of endTaxable/endTraditional/endRoth, and it follows CPI only.
  begTips: number;            // sleeve value at the start of the year (all accounts)
  endTipsTaxable: number;     // year-end sleeve value held in taxable
  endTipsTrad: number;        // ... in pre-tax (IRA) accounts
  endTipsRoth: number;        // ... in Roth
  tipsCoupon: number;         // coupons paid this year (all accounts)
  tipsAccrual: number;        // indexation of principal (signed; taxable rungs owe tax on it, no cash)
  tipsMaturity: number;       // principal paid at maturity this year (includes tipsFloorBonus)
  tipsFloorBonus: number;     // part of the maturity above indexed principal (deflation floor)
  tipsCash: number;           // coupons + maturities from taxable rungs: cash to the household
  tipsToTrad: number;         // coupons + maturities from pre-tax rungs, returned to the IRAs
  tipsToRoth: number;         // coupons + maturities from Roth rungs, returned to the Roth
  tipsOrdInc: number;         // federal ordinary income from taxable rungs (state-exempt); counted once someone has retired
  tipsGain: number;           // capital gain realized as taxable rungs mature: the part of them the entered basis didn't cover (in ltcg)
  rmdUnmet: number;           // RMD that the liquid IRA balance could not cover (ladder rungs are illiquid)
  rmdUnmetB: number;          // part of rmdUnmet that is Person B's
}

export interface ProjectionResult {
  rows: ProjectionRow[];
  // Aggregates for KPI cards
  lifetimeFedTax: number;
  lifetimeFedTaxReal: number;
  lifetimeRMD: number;
  lifetimeRMDReal: number;
  lifetimeConversion: number;
  lifetimeConversionReal: number;
  endTotalNominal: number;
  endTotalReal: number;
  endTaxAdjustedNominal: number;
  endTaxAdjustedReal: number;
  yearsCovered: number;
  lifetimeShortfallReal: number;  // cumulative unfunded spending, today's $
  ranOut: boolean;          // true if portfolio hit zero before plan-to age
  overrideEvents: { age: number; reason: string }[];  // bracket-fill ceiling overrides
  decisionNotes: YearDecision[];  // per-year attribution; populated only when opts.explain is true
}

const ageAt = (dob: string, planStartYear: number): number => {
  const birthYear = parseInt(dob.slice(0, 4), 10);
  return planStartYear - birthYear;
};

const sumIncomeStreams = (
  resolved: ResolvedIncome[],
  ageA: number,
  ageB: number | undefined,
  yearIndex: number,
  aliveA: boolean,
  aliveB: boolean,
  retiredA = true,
  retiredB = true,
): { gross: number; taxableAmt: number; exemptInterest: number; nonExempt: number; pensionAmt: number; nonExemptSS: number } => {
  let gross = 0, taxableAmt = 0, exemptInterest = 0, nonExempt = 0, pensionAmt = 0, nonExemptSS = 0;
  for (const { s, w, growthRate } of resolved) {
    const eligible = s.whose === 'A' ? retiredA : s.whose === 'B' ? retiredB : (retiredA || retiredB);
    if (!eligible) continue;
    const factor = streamFactor(w, ageA, ageB, aliveA, aliveB);
    if (factor === 0) continue;
    const amount = s.annualAmount * factor * Math.pow(1 + growthRate, yearIndex);
    if (s.type === 'SS') {
      // SS gross/federal-taxable handled separately via PIA + §86 provisional-income formula.
      // Accumulate state-taxable portion here so stateTax() can apply it when ssExempt=false.
      nonExemptSS += amount * (s.stateTaxablePct ?? 1);
      continue;
    }
    const taxablePortion = amount * s.taxablePct;
    gross += amount;
    taxableAmt += taxablePortion;
    const stf = s.stateTaxablePct ?? 1;
    switch (s.type) {
      case 'VA': break; // fully exempt from federal + state tax; spendable via gross
      case 'MuniBond':
        // §103 exempt interest: in SS PI, ACA MAGI, IRMAA MAGI; out of AGI
        exemptInterest += amount - taxablePortion;
        // out-of-state munis are state-taxable (stf=1); in-state munis stf=0
        nonExempt += amount * stf;
        break;
      case 'Other': nonExempt += taxablePortion * stf; break;
      case 'Pension': case 'Annuity':
        // IL exempts pension/annuity; CA/NY do not — tracked separately so stateTax()
        // can apply per-state retirementExempt logic alongside IRA/401(k) distributions.
        pensionAmt += taxablePortion * stf; break;
    }
  }
  return { gross, taxableAmt, exemptInterest, nonExempt, pensionAmt, nonExemptSS };
};

/** Annual spending split by category tag. `total` is the sum of every active row (unchanged);
 *  `medical` and `charitable` are the tagged subsets of it. Untagged rows count as 'general'.
 *  `charitableQcd` is the part of `charitable` eligible for a QCD (rows not marked `qcd: false`). */
interface ExpenseSums { total: number; medical: number; charitable: number; charitableQcd: number }
const NO_EXPENSES: ExpenseSums = { total: 0, medical: 0, charitable: 0, charitableQcd: 0 };

/** Every ladder quantity for a plan without one: adding these zeros leaves the arithmetic untouched. */
const NO_TIPS: TipsYear = {
  beg: 0, begTradA: 0, begTradB: 0, coupon: 0, accrual: 0, maturity: 0, maturedTaxablePrincipal: 0, floorBonus: 0,
  cash: 0, toTradA: 0, toTradB: 0, toRoth: 0, ordInc: 0, endTaxable: 0, endTrad: 0, endRoth: 0,
};

const sumExpenseStreams = (
  resolved: ResolvedExpense[],
  ageA: number,
  ageB: number | undefined,
  yearIndex: number,
  aliveA: boolean,
  aliveB: boolean,
  cumulativeInflationFactor?: number,
  retiredA = true,
  retiredB = true,
): ExpenseSums => {
  let total = 0, medical = 0, charitable = 0, charitableQcd = 0;
  for (const { e, w, growthRate, cpiMode } of resolved) {
    // Gate by whose retirement: A-tagged flows when A retires, B-tagged when B retires,
    // Household when EITHER retires (working person's contributions offset the draw).
    const eligible = e.whose === 'A' ? retiredA : e.whose === 'B' ? retiredB : (retiredA || retiredB);
    if (!eligible) continue;
    const factor = streamFactor(w, ageA, ageB, aliveA, aliveB);
    if (factor === 0) continue;
    // CPI-mode streams (mode:'cpi') use the actual cumulative inflation factor in Monte Carlo
    // so they track stochastic CPI rather than the fixed planning rate. All other modes
    // compound at their own resolved rate as before.
    const isCpiIndexed = cumulativeInflationFactor !== undefined && cpiMode;
    const growthFactor = isCpiIndexed
      ? cumulativeInflationFactor
      : Math.pow(1 + growthRate, yearIndex);
    const amt = e.annualAmount * factor * growthFactor;
    total += amt;
    if (e.category === 'medical') medical += amt;
    else if (e.category === 'charitable') {
      charitable += amt;
      if (e.qcd !== false) charitableQcd += amt;
    }
  }
  return { total, medical, charitable, charitableQcd };
};

/**
 * Run the full 75-year projection. Year 0 = plan start (today's $ baseline).
 * Returns one row per year for ages startAgeA..startAgeA+74 (max plan span).
 */
export interface ProjectionOptions {
  /** Override the active withdrawal policy without mutating the plan. */
  policy?: BlendPolicy;
  /** Per-year nominal return overrides (length matches projection years). Used by Monte Carlo. */
  returnOverrides?: number[];
  /**
   * Per-year CPI inflation rate overrides (same length as returnOverrides). When provided:
   * - The inflation factor (deflator) compounds these rates rather than plan.assumptions.inflation.
   * - Expense streams with inflationPct.mode === 'cpi' (CPI-indexed lifestyle spending) track
   *   actual CPI instead of the fixed planning rate.
   * - All other scalars that use inflationFactor (SS, std deduction, IRMAA, ACA, conversions)
   *   automatically follow the stochastic path via the updated inflationFactor.
   * Omit for deterministic projections and the parametric MC model.
   */
  inflationOverrides?: number[];
  /** Build per-year decision notes on the returned ProjectionResult. Off by default so the
   * optimizer's thousands of projections never pay for it. */
  explain?: boolean;
  /** Pay charitable gifts as ordinary spending instead of QCDs. Counterfactual for the "tax saved by
   *  QCD" comparison; not a plan field. */
  disableQCD?: boolean;
  /** Per-year nominal Roth conversions to use instead of the plan's (still capped at what the IRA holds).
   *  Holds another run's conversions fixed in a counterfactual, as the "tax saved by QCD" comparison does;
   *  not a plan field. */
  conversionOverrides?: number[];
  /** Test hook: when given, the number of gross-up iterations used each year is appended to
   *  `grossUpIters`. Never set in app code. */
  stats?: { grossUpIters: number[] };
}

/** Map a stored MFJ bracket-fill ceiling to its Single equivalent by bracket index. */
// The stored bracketCeiling is always the filing-status-appropriate bracket top, because
// the UI dropdowns use FED_BRACKETS_MFJ for MFJ plans and FED_BRACKETS_SINGLE for Single plans.
// No remapping needed — return the stored value directly.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function effectiveBracketCeiling(storedCeiling: number, _fs: FilingStatus): number {
  return storedCeiling;
}

/** Marginal rate of the bracket whose top equals the user-selected fill ceiling. */
function rateAtBracketCeiling(ceilingMFJ: number, fs: FilingStatus): number {
  const brackets = fs === 'MFJ' ? FED_BRACKETS_MFJ : FED_BRACKETS_SINGLE;
  const effCeiling = effectiveBracketCeiling(ceilingMFJ, fs);
  for (const [top, rate] of brackets) {
    if (top >= effCeiling) return rate;
  }
  return brackets[brackets.length - 1][1];
}

/** Annual RMD owed on an inherited pre-tax IRA in years 1..9 (0 when the owner had not started RMDs). */
function inheritedAnnualRmd(ev: LumpSumEvent, priorYearEndBal: number, yearsElapsed: number): number {
  if (ev.bucket !== 'inheritedPreTaxIRA' || !ev.ownerStartedRmds) return 0;
  if (yearsElapsed < 1 || yearsElapsed >= INHERITED_DEADLINE_YEARS) return 0;
  return priorYearEndBal / inheritedRmdDivisor(ev.age, yearsElapsed);
}

/** Inherited IRA/Roth received before plan start with part of its 10-year window still open. */
export function isPastInheritedEvent(ev: LumpSumEvent, ageNow: number): boolean {
  if (ev.bucket !== 'inheritedPreTaxIRA' && ev.bucket !== 'inheritedRoth') return false;
  const yearsElapsed = ageNow - ev.age;
  return yearsElapsed > 0 && yearsElapsed <= INHERITED_DEADLINE_YEARS;
}

export function runProjection(livePlan: Plan, opts?: ProjectionOptions): ProjectionResult {
  const plan = resolveStrategy(livePlan);
  const activePolicy: BlendPolicy | undefined = opts?.policy ?? (plan.customPolicy as BlendPolicy | undefined);
  const startYear = new Date().getFullYear();
  const startAgeA = ageAt(plan.personA.dob, startYear);
  const startAgeB = plan.personB ? ageAt(plan.personB.dob, startYear) : undefined;
  const passingA = plan.personA.planThroughAge;
  const passingB = plan.personB?.planThroughAge;
  // B's death age in A-frame: used by householdSS for survivor stream clamping.
  const passingBInAFrame = passingB !== undefined && startAgeB !== undefined
    ? passingB + (startAgeA - startAgeB)
    : undefined;
  const retireAgeA = plan.personA.retirementAge;
  const retireAgeB = plan.personB?.retirementAge ?? retireAgeA;
  const frame = householdAgeFrame(plan);
  const planToAge = frame.horizonA;

  const totals = householdTotals(plan.portfolio);
  let taxable = totals.taxable;
  let tradA = plan.portfolio.personA.traditional;
  let tradB = plan.portfolio.personB?.traditional ?? 0;
  let roth = totals.roth;
  const pfA = plan.portfolio.personA;
  const pfB = plan.portfolio.personB;
  let taxableBasis = (pfA.taxableBasis ?? 0) + (pfB?.taxableBasis ?? 0);
  // Owned HSAs, one per person. hasHSA gates every HSA step so a plan without one skips them all
  // and its arithmetic is untouched.
  let hsaA = pfA.hsa ?? 0;
  let hsaB = pfB?.hsa ?? 0;
  const hasHSA = hsaA > 0 || hsaB > 0 || (pfA.hsaContribution ?? 0) > 0 || (pfB?.hsaContribution ?? 0) > 0;
  // Claiming SS enrolls a worker in Medicare Part A, which ends HSA contributions.
  const ssStartA = ssStartAge(plan, 'A');
  const ssStartB = ssStartAge(plan, 'B');
  // Medical bills the HSA did not pay are kept as receipts: reimbursable tax-free later (D4).
  let hsaReceipts = hasHSA ? (pfA.hsaReceipts ?? 0) + (pfB?.hsaReceipts ?? 0) : 0;
  const hsaPayFromAge = hasHSA ? hsaPayAge(plan.portfolio) : 0;
  // TIPS ladder (D10): by default the entered balances already contain the bonds, so their value is
  // carved out of each account here and tracked in a separate sleeve that follows CPI, not returns.
  // hasTips gates every ladder step; without one nothing below changes.
  const tipsLadder = resolveTipsLadder(plan.portfolio, startYear);
  const hasTips = tipsLadder !== null;
  // Taxable rungs take basis dollar for dollar. Any part the entered basis can't cover is unrealized gain
  // held in the rungs: it is realized as capital gain, pro rata to principal, as those rungs mature, so
  // the carve-out never erases a gain (their cash otherwise comes back at full basis).
  let tipsGainPerPrincipal = 0;
  if (tipsLadder) {
    taxable -= tipsLadder.carve.taxable;
    roth -= tipsLadder.carve.roth;
    tradA -= tipsLadder.carve.tradA;
    tradB -= tipsLadder.carve.tradB;
    if (tipsLadder.carve.taxable > taxableBasis) tipsGainPerPrincipal = (tipsLadder.carve.taxable - taxableBasis) / tipsLadder.carve.taxable;
    taxableBasis = Math.max(0, taxableBasis - tipsLadder.carve.taxable);
  }

  const rows: ProjectionRow[] = [];
  const decisionNotes: YearDecision[] = [];
  let lifetimeFedTax = 0, lifetimeRMD = 0, lifetimeConversion = 0;
  let lifetimeFedTaxReal = 0, lifetimeRMDReal = 0, lifetimeConversionReal = 0;
  let lifetimeShortfallReal = 0;
  let ranOut = false;

  const inheritedState: Array<{ ev: LumpSumEvent; remainingBal: number; injected: boolean }> =
    (plan.lumpSumEvents ?? [])
      .filter(ev => ev.bucket === 'inheritedPreTaxIRA' || ev.bucket === 'inheritedRoth')
      .map(ev => ({ ev, remainingBal: 0, injected: false }))
      // Earliest deadline first, so strategy withdrawals drain the most urgent account first.
      .sort((a, b) => a.ev.age - b.ev.age);
  // Inherited before plan start: ev.amount is the balance today. Seed it into the opening
  // balance so it grows like any held account; the 10-year clock still runs from ev.age.
  // Past events whose deadline has passed (or past taxable/HSA events) contribute nothing.
  for (const s of inheritedState) {
    const ageNow = s.ev.whose === 'B' ? startAgeB : startAgeA;
    if (ageNow === undefined || !isPastInheritedEvent(s.ev, ageNow)) continue;
    if (s.ev.bucket === 'inheritedPreTaxIRA') {
      if (s.ev.whose === 'B') tradB += s.ev.amount; else tradA += s.ev.amount;
    } else roth += s.ev.amount;
    s.remainingBal = s.ev.amount;
    s.injected = true;
  }
  const filingStatusHistory: FilingStatus[] = [];

  const maxYears = Math.min(80, planToAge - startAgeA + 1);
  const rmdStartAgeA = rmdStartAgeForDob(plan.personA.dob);
  const rmdStartAgeB = plan.personB ? rmdStartAgeForDob(plan.personB.dob) : rmdStartAgeA;
  const planInflation = plan.assumptions.inflation;
  const rIncome = resolveIncomeStreams(plan.incomeStreams, frame, planInflation);
  const rExpense = resolveExpenseStreams(plan.expenseStreams, frame, planInflation);
  // True when any charitable row can be paid as a QCD. Hoisted so plans without one skip the QCD step.
  const charitableOn = rExpense.some(({ e }) => e.category === 'charitable' && e.qcd !== false);
  const qcdOn = !opts?.disableQCD && charitableOn;
  // §408(d)(8)(A) anti-abuse rule: deductible IRA contributions made for years from 70½ on reduce the
  // excludable QCD, one dollar per dollar, until used up. The only deductible IRA contribution the engine
  // models is a spousal one to a traditional IRA (working-year contributions are treated as employer-plan
  // deferrals, which don't count), so plans without one skip the step.
  const qcdOffsetOn = qcdOn && [pfA, pfB].some((pf) => (pf?.spousalContribution ?? 0) > 0 && pf?.spousalTarget !== 'roth');
  // Per-person running total of those contributions not yet used to reduce a QCD.
  let qcdOffsetA = 0, qcdOffsetB = 0;
  const convOverrides = opts?.conversionOverrides;
  const taxableDivYield    = plan.assumptions.taxableDivYield    ?? 0;
  const taxableQualifiedPct = plan.assumptions.taxableQualifiedPct ?? 0.80;
  const taxableExemptYield  = plan.assumptions.taxableExemptYield  ?? 0;
  const exemptStatePct      = plan.assumptions.taxableExemptStatePct ?? 1;
  const distributePct       = plan.assumptions.taxableDistributePct ?? 0;
  const taxAdjRates = taxAdjustedRates(plan.assumptions);
  // Per-year MAGI + filing-status history for IRMAA 2-year lookback.
  // Stores surchargeMAGI (magi + exemptIncome) per 42 U.S.C. §1395r(i)(4).
  const surchargeMagiHistory: number[] = [];
  // Running inflation factor — compounded from per-year CPI overrides when provided,
  // otherwise from the plan's fixed inflation rate. Year 0 is always 1 (base year).
  let runningInflationFactor = 1;
  const overrideEvents: { age: number; reason: string }[] = [];

  for (let i = 0; i < maxYears; i++) {
    const ageA = startAgeA + i;
    const ageB = startAgeB !== undefined ? startAgeB + i : undefined;
    const inflationFactor = runningInflationFactor;
    const aliveA = ageA <= passingA;
    const aliveB = startAgeB !== undefined && passingB !== undefined ? ageB! <= passingB : false;
    const retiredA = ageA >= retireAgeA;
    // Single-person: mirror retiredA so the OR-gate in sumExpenseStreams doesn't fire early.
    const retiredB = ageB !== undefined ? ageB >= retireAgeB : retiredA;
    const retired = retiredA && retiredB;

    const filingStatus = filingStatusForYear(i, startAgeA, passingA, startAgeB, passingB);

    let phase: ProjectionRow['phase'];
    if (!aliveA || !aliveB) phase = 'Survivor';
    else if (retired) phase = 'Retire';
    else if (retiredA || retiredB) phase = 'SemiRetire';
    else phase = 'Accum.';

    // Contributions during working years — each person's contribution grows at their
    // own rate (contribGrowth lives on the per-person portfolio).
    const cgFactorA = Math.pow(1 + resolveGrowthRate(pfA.contribGrowth, planInflation), i);
    const cgFactorB = pfB ? Math.pow(1 + resolveGrowthRate(pfB.contribGrowth, planInflation), i) : 1;
    // A person contributes their own annualContribution while working. Once they retire, they
    // can still receive a spousal IRA contribution for as long as the OTHER spouse is working
    // (IRC §219(c)) — but only the amount the user explicitly entered, capped at the IRA limit.
    // Default 0 means opting out (or being barred by the MAGI phaseouts) is the no-op case.
    const workingA = !retiredA && aliveA;
    const workingB = !!plan.personB && !!pfB && !retiredB && aliveB;
    const iraCap = (age: number) =>
      (IRA_CONTRIB_LIMIT + (age >= IRA_CATCHUP_AGE ? IRA_CATCHUP : 0)) * inflationFactor;
    const spousalA = (aliveA && !workingA && workingB)
      ? Math.min((pfA.spousalContribution ?? 0) * inflationFactor, iraCap(ageA)) : 0;
    const spousalB = (!!plan.personB && !!pfB && aliveB && !workingB && workingA && ageB !== undefined)
      ? Math.min((pfB.spousalContribution ?? 0) * inflationFactor, iraCap(ageB)) : 0;
    const contribA = workingA ? pfA.annualContribution * cgFactorA : spousalA;
    const contribB = workingB ? pfB!.annualContribution * cgFactorB : spousalB;

    // Per-person, per-bucket contribution amounts. Working-year contributions follow that
    // person's contribSplit; spousal IRA contributions bypass it entirely and land wholly in
    // the elected IRA type. Everything downstream reads these instead of re-deriving from
    // contribX * split, so the two routings can never drift apart.
    const bucketize = (pf: PersonPortfolio | undefined, working: boolean, own: number, spousal: number) => {
      if (!pf) return { tax: 0, trad: 0, roth: 0 };
      if (working) return { tax: own * pf.contribSplit.taxable, trad: own * pf.contribSplit.traditional, roth: own * pf.contribSplit.roth };
      // Default target is traditional (the deductible-IRA case) when unset.
      return { tax: 0, trad: pf.spousalTarget === 'roth' ? 0 : spousal, roth: pf.spousalTarget === 'roth' ? spousal : 0 };
    };
    const cA = bucketize(pfA, workingA, contribA, spousalA);
    const cB = bucketize(pfB, workingB, contribB, spousalB);
    // TIPS sleeve for the year. Coupons and maturities from IRA and Roth rungs flow back into those
    // accounts like a contribution; taxable ones are household cash (see tips.cash below).
    const tips = hasTips
      ? tipsLadderYear(tipsLadder, startYear + i, inflationFactor,
          inflationFactor * (1 + (opts?.inflationOverrides?.[i] ?? plan.assumptions.inflation)), aliveA, aliveB)
      : NO_TIPS;
    // Ladder income is taxed once someone has retired, the same rule as portfolio dividends: the engine
    // models no working-year income taxes, and the phantom (non-cash) part has nothing to pay the tax from.
    const tipsTaxed = (retiredA || retiredB) ? tips.ordInc : 0;
    const tipsGain = tipsGainPerPrincipal > 0 && (retiredA || retiredB) ? tips.maturedTaxablePrincipal * tipsGainPerPrincipal : 0;
    const contribToTax  = cA.tax  + cB.tax;
    const contribToTrad = cA.trad + cB.trad + tips.toTradA + tips.toTradB;
    const contribToRoth = cA.roth + cB.roth + tips.toRoth;

    // HSA contributions. A working person (still under Medicare) adds them from outside the
    // portfolio like a payroll deduction, so they never pass through contribA/B or contribSplit.
    // A retired person who elected to keep contributing (on an HSA-eligible ACA plan, before 65) pays
    // from the portfolio instead: a cash need that is also an above-the-line deduction.
    // The household shares one family limit when either spouse is on family coverage (§223(b)(5)).
    let hsaContribExtA = 0, hsaContribExtB = 0, hsaContribRetA = 0, hsaContribRetB = 0;
    if (hasHSA) {
      const hsaAsk = (pf: PersonPortfolio | undefined, age: number | undefined, claimAge: number | undefined, alive: boolean, retired: boolean) =>
        pf && alive && age !== undefined && claimAge !== undefined
          && hsaContribEligible({ age, retired, ssClaimAge: claimAge, contribInRetirement: pf.hsaContribInRetirement ?? false })
          ? (pf.hsaContribution ?? 0) * inflationFactor : 0;
      const alloc = allocateHsaContribution(
        inflationFactor,
        { ask: hsaAsk(pfA, ageA, ssStartA, aliveA, retiredA), coverage: aliveA ? pfA.hsaCoverage : undefined, age: ageA },
        pfB && ageB !== undefined
          ? { ask: hsaAsk(pfB, ageB, ssStartB, aliveB, retiredB), coverage: aliveB ? pfB.hsaCoverage : undefined, age: ageB }
          : undefined,
      );
      hsaContribExtA = retiredA ? 0 : alloc.a; hsaContribRetA = retiredA ? alloc.a : 0;
      hsaContribExtB = retiredB ? 0 : alloc.b; hsaContribRetB = retiredB ? alloc.b : 0;
    }
    // `let`: cancelled in the top-up loop if only the HSA itself could fund it.
    let hsaContribRet = hsaContribRetA + hsaContribRetB;
    // Above-the-line deduction for the retiree contribution. It lowers AGI, so it drives Social
    // Security taxability, MAGI, IRMAA, ACA and the senior bonus. It comes off ordinary income first
    // and any part ordinary income cannot absorb comes off capital gains (hsaDedLtcg; both take the
    // ordinary income before the deduction). State tax gets it too, except in non-conforming states.
    const hsaDed = (ordinary: number): number => hsaContribRet > 0 ? Math.max(0, ordinary - hsaContribRet) : ordinary;
    const hsaDedLtcg = (ordinary: number, ltcg: number): number =>
      hsaContribRet > ordinary ? Math.max(0, ltcg - (hsaContribRet - ordinary)) : ltcg;
    const hsaStateDed = (): number => (hsaContribRet > 0 && !HSA_NONCONFORMING_STATES.has(plan.state) ? hsaContribRet : 0);

    // Social Security. If the user has SS-typed income streams, they override
    // the PIA-based actuarial calc per person/year (so editing the stream's
    // annualAmount on the Income page moves the projection).
    const ss = householdSS({
      piaA: plan.personA.ssPIA,
      claimAgeA: plan.personA.ssClaimAge,
      ageA, aliveA,
      piaB: plan.personB?.ssPIA,
      claimAgeB: plan.personB?.ssClaimAge,
      ageB, aliveB,
      inflationFactor,
      inflation: planInflation,
      ssStreams: rIncome,
      yearIndex: i,
      planThroughAgeA: passingA,
      planThroughAgeB: passingBInAFrame,
      retiredA,
      retiredB,
    });

    // Other income streams — gated by retirement, same as expenses
    const other = sumIncomeStreams(rIncome, ageA, ageB, i, aliveA, aliveB, retiredA, retiredB);

    // Expenses start when either person retires (semi-retirement or full retirement).
    // Per-whose gate inside sumExpenseStreams: A-tagged on retiredA, B-tagged on retiredB,
    // Household on retiredA||retiredB. Working person's contributions offset the portfolio draw.
    const spend = (retiredA || retiredB) ? sumExpenseStreams(
      rExpense, ageA, ageB, i,
      aliveA, aliveB,
      opts?.inflationOverrides ? inflationFactor : undefined,
      retiredA, retiredB,
    ) : NO_EXPENSES;
    const netSpend = spend.total;

    // Spousal rollover: merge deceased person's traditional balance into the survivor's IRA.
    // Handles both death orders. Self-extinguishing once the balance reaches zero.
    if (!aliveA && tradA > 0) { tradB += tradA; tradA = 0; }
    if (plan.personB && !aliveB && tradB > 0) { tradA += tradB; tradB = 0; }
    const trad = tradA + tradB;
    // An HSA passes to a surviving spouse as their own account.
    if (hasHSA) {
      if (!aliveA && hsaA > 0) { hsaB += hsaA; hsaA = 0; }
      if (plan.personB && !aliveB && hsaB > 0) { hsaA += hsaB; hsaB = 0; }
    }

    // Inherited pre-tax balances still being tracked sit inside tradA/tradB but follow the
    // inherited-account rules, so they are excluded from the owner's own RMD base. A/Household
    // events live in tradA, or in tradB once A has died and the balance rolled over.
    let inheritedInTradA = 0, inheritedInTradB = 0, inheritedBegBal = 0, inheritedRothBegBal = 0;
    for (const s of inheritedState) {
      if (!s.injected || s.remainingBal <= 0) continue;
      const tracked = s.ev.whose === 'A' ? aliveA : s.ev.whose === 'B' ? aliveB : (aliveA || aliveB);
      if (!tracked) continue;
      inheritedBegBal += s.remainingBal;
      if (s.ev.bucket !== 'inheritedPreTaxIRA') { inheritedRothBegBal += s.remainingBal; continue; }
      if (s.ev.whose === 'B' || !aliveA) inheritedInTradB += s.remainingBal;
      else inheritedInTradA += s.remainingBal;
    }

    // Per-year growth rates. Hoisted above the RMD block so the QCD/HSA/TIPS steps can read them.
    const override = opts?.returnOverrides?.[i];
    const gRateTaxYear  = override ?? plan.assumptions.taxableReturn;
    const gRateTradYear = override ?? plan.assumptions.tradReturn;
    const gRateRothYear = override ?? plan.assumptions.rothReturn;
    const gRateHsaYear  = override ?? (plan.assumptions.hsaReturn ?? plan.assumptions.tradReturn);

    // Per-person RMD — each governed by their own age and SECURE 2.0 start age.
    // A person's pre-tax ladder rungs count in the RMD base (the IRA balance includes the bonds).
    let rmdA = (aliveA && ageA >= rmdStartAgeA) ? (Math.max(0, tradA - inheritedInTradA) + tips.begTradA) / rmdDivisor(ageA) : 0;
    let rmdB = (aliveB && ageB !== undefined && ageB >= rmdStartAgeB)
      ? (Math.max(0, tradB - inheritedInTradB) + tips.begTradB) / rmdDivisor(ageB) : 0;
    // The bonds cannot be distributed in cash. When the RMD is larger than the liquid IRA money, the
    // RMD is clamped to it and the rest is recorded as unmet (D11); in-kind distributions are not modeled.
    let rmdUnmet = 0, rmdUnmetB = 0;
    if (hasTips) {
      const liqA = qcdAvailable(tradA, inheritedInTradA, gRateTradYear, cA.trad, tips.toTradA);
      const liqB = qcdAvailable(tradB, inheritedInTradB, gRateTradYear, cB.trad, tips.toTradB);
      if (rmdA > liqA) { rmdUnmet += rmdA - liqA; rmdA = liqA; }
      if (rmdB > liqB) { rmdUnmetB = rmdB - liqB; rmdUnmet += rmdUnmetB; rmdB = liqB; }
    }
    const rmdAmt = rmdA + rmdB;
    lifetimeRMD += rmdAmt;
    lifetimeRMDReal += rmdAmt / inflationFactor;

    // QCD: charitable giving paid straight from each owner's IRA. It satisfies the RMD first
    // (excluded from income), and any excess leaves the IRA too. Without a QCD every alias below
    // equals the plain RMD, so the no-QCD path is unchanged to the last bit.
    //   rmdTaxable: RMD that reaches the household as taxable income
    //   trdForced:  traditional money that must leave the IRA this year (cash or direct to charity)
    //   forcedA:    A's share of trdForced (per-person balance split)
    let qcdA = 0, qcdB = 0;
    if (qcdOn && spend.charitableQcd > 0) {
      const q = allocateQcd(
        spend.charitableQcd, qcdLimit(inflationFactor),
        { eligible: aliveA && qcdEligible(plan.personA.dob, ageA), rmd: rmdA, available: qcdAvailable(tradA, inheritedInTradA, gRateTradYear, cA.trad, tips.toTradA) },
        plan.personB
          ? { eligible: aliveB && ageB !== undefined && qcdEligible(plan.personB.dob, ageB), rmd: rmdB, available: qcdAvailable(tradB, inheritedInTradB, gRateTradYear, cB.trad, tips.toTradB) }
          : undefined,
      );
      qcdA = q.qcdA; qcdB = q.qcdB;
    }
    const qcdTotal = qcdA + qcdB;
    const rmdTaxable = qcdTotal > 0 ? Math.max(0, rmdA - qcdA) + Math.max(0, rmdB - qcdB) : rmdAmt;
    // The part of the QCD the anti-abuse rule makes taxable. It still leaves the IRA for the charity and still
    // counts toward the RMD; it is just not excluded from income.
    let qcdTaxable = 0;
    if (qcdOffsetOn) {
      if (!workingA && cA.trad > 0 && qcdEligible(plan.personA.dob, ageA)) qcdOffsetA += cA.trad;
      if (plan.personB && ageB !== undefined && !workingB && cB.trad > 0 && qcdEligible(plan.personB.dob, ageB)) qcdOffsetB += cB.trad;
      const tA = Math.min(qcdA, qcdOffsetA), tB = Math.min(qcdB, qcdOffsetB);
      qcdOffsetA -= tA; qcdOffsetB -= tB;
      qcdTaxable = tA + tB;
    }
    // IRA distributions taxed as income this year: the taxable RMD plus any QCD the rule above made taxable.
    const rmdIncome = qcdTaxable > 0 ? rmdTaxable + qcdTaxable : rmdTaxable;
    const forcedA = qcdTotal > 0 ? Math.max(rmdA, qcdA) : rmdA;
    const trdForced = qcdTotal > 0 ? forcedA + Math.max(rmdB, qcdB) : rmdAmt;

    // HSA money available this year to pay qualified spending: each owner's balance after growth and
    // this year's contribution, but only once that owner reaches the policy age (D4).
    const hsaAvailA = hasHSA && aliveA && ageA >= hsaPayFromAge ? Math.max(0, hsaA * (1 + gRateHsaYear) + hsaContribExtA + hsaContribRetA) : 0;
    const hsaAvailB = hasHSA && plan.personB && aliveB && ageB !== undefined && ageB >= hsaPayFromAge
      ? Math.max(0, hsaB * (1 + gRateHsaYear) + hsaContribExtB + hsaContribRetB) : 0;
    const hsaAvail = hsaAvailA + hsaAvailB;
    // Medicare premiums (IRMAA) are qualified only from an owner 65 or over (Pub 969).
    const hsaOwnerA = { avail: hsaAvailA, medicare: ageA >= HSA_MEDICARE_AGE };
    const hsaOwnerB = { avail: hsaAvailB, medicare: ageB !== undefined && ageB >= HSA_MEDICARE_AGE };

    // Standard deduction this year. For Single filers where B is the survivor, use B's age.
    const filerAge = (filingStatus === 'Single' && !aliveA && aliveB && ageB !== undefined) ? ageB : ageA;
    const stdD = standardDeduction(filingStatus, filerAge, ageB, inflationFactor);
    const calYear = startYear + i;
    // OBBBA non-itemizer charitable deduction (IRC §170(p), tax years 2026+): cash gifts to public
    // charities that a QCD did not cover, up to $1,000 ($2,000 joint). Below the line, so it never
    // enters MAGI or the senior-bonus phase-out. Donor-advised-fund gifts (qcd:false) don't qualify.
    // Computed even when disableQCD is set, so the no-QCD counterfactual gets the deduction it would.
    const charDed = charitableOn && calYear >= OBBBA_NONITEMIZER_CHARITY_FIRST_YEAR
      ? Math.min(Math.max(0, spend.charitableQcd - qcdTotal), filingStatus === 'MFJ' ? OBBBA_NONITEMIZER_CHARITY.mfj : OBBBA_NONITEMIZER_CHARITY.single)
      : 0;
    const stdDEff = charDed > 0 ? stdD + charDed : stdD;
    let seniorBonus = 0;

    // Roth conversion (BEFORE withdrawals — increases ord income for the year).
    // If the active blend policy's window has an explicit convAmt (including 0), that is
    // authoritative — it represents a fully-specified strategy. Fall back to plan.conversion
    // (the Pick-tab "mode") only when convAmt is undefined (e.g., a hand-edited custom blend
    // with a cleared cell). The optimizer always sets convAmt explicitly, so its trials never
    // hit the fallback — keeping the search independent of the Pick-tab settings.
    // Two-pass estimate of the traditional withdrawal that conversion sizing must account for.
    // Taxfirst/tradfirst pull from traditional when taxable is exhausted; when payTaxFromBrokerage
    // is true, conversion taxes also draw from taxable — reducing spending capacity and forcing
    // more traditional draws. Both effects tighten the headroom available for the conversion.
    const taxAvailEst   = Math.max(0, taxable * (1 + plan.assumptions.taxableReturn) + contribToTax);
    const tradAvailForEst = Math.max(0, trad * (1 + plan.assumptions.tradReturn) + contribToTrad - trdForced);
    const rothAvailForEst = Math.max(0, roth * (1 + plan.assumptions.rothReturn) + contribToRoth);
    // Exempt interest estimate (gated on retirement like the actual value).
    // other.exemptInterest is gated by the stream's own age window (not retirement) by design —
    // a muni stream correctly hits ACA MAGI for a pre-retirement marketplace enrollee.
    const exemptIntEst = (retiredA || retiredB) ? taxable * taxableExemptYield : 0;
    const exemptIncomeEst = other.exemptInterest + exemptIntEst;
    const annualDivEstForDist = (retiredA || retiredB) ? taxable * taxableDivYield : 0;
    const exemptIntEstForDist = (retiredA || retiredB) ? taxable * taxableExemptYield : 0;
    const distributedCashEst  = (annualDivEstForDist + exemptIntEstForDist) * distributePct;
    // Estimate of what the HSA will pay (medical only; IRMAA is not known until the loop runs).
    const hsaQualEst = hasHSA ? Math.min(hsaAvail, spend.medical) : 0;
    const spendingGapEst = Math.max(0, netSpend - ss.total - other.gross - trdForced - distributedCashEst - hsaQualEst + hsaContribRet - tips.cash);
    // Ordinary dividends from the taxable account are ordinary income (eat bracket space) but are
    // reinvested — not a spending resource. Estimate them here so baseOrdIncForConv is complete.
    const annualDivEst = (retiredA || retiredB) ? taxable * taxableDivYield : 0;
    const ordDivEst    = annualDivEst * (1 - taxableQualifiedPct);
    // Active policy window is needed here to pick the right withdrawal blend for the wdTrd estimate.
    const policyWindow = activePolicy ? findWindow(activePolicy, ageA) : undefined;
    // Strategy-aware wdTrd estimate: how much traditional the actual withdrawal will draw.
    // Uses the policy's pctTraditional when convAmt is absent (blend set, but not conv amount).
    // Otherwise mirrors the plan's withdrawal strategy. taxAvail parameter varies by pass.
    const _wdTrdEst = (gap: number, avTax: number): number => {
      if (policyWindow != null && policyWindow.convAmt == null)
        return policyWindow.pctTraditional * gap;
      const total = avTax + tradAvailForEst + rothAvailForEst;
      if (plan.withdrawalStrategy === 'tradfirst') return Math.min(tradAvailForEst, gap);
      if (plan.withdrawalStrategy === 'proportional') return total > 0 ? (tradAvailForEst / total) * gap : 0;
      // rothfirst and bracketfill (withdrawal) exhaust taxable + roth before touching traditional
      if (plan.withdrawalStrategy === 'rothfirst' || plan.withdrawalStrategy === 'bracketfill')
        return Math.max(0, gap - avTax - rothAvailForEst);
      return Math.max(0, gap - avTax); // taxfirst
    };
    // Strategy-aware wdRth estimate: mirrors _wdTrdEst for the Roth bucket.
    // Used to net anticipated same-year Roth draws from the conversion headroom — converting $X
    // then immediately withdrawing $X from Roth repositions nothing (same taxable income,
    // same ending balances as just drawing $X from pre-tax).
    const _wdRthEst = (gap: number, avTax: number): number => {
      if (policyWindow != null && policyWindow.convAmt == null)
        return policyWindow.pctRoth * gap;
      const total = avTax + tradAvailForEst + rothAvailForEst;
      if (plan.withdrawalStrategy === 'proportional') return total > 0 ? (rothAvailForEst / total) * gap : 0;
      if (plan.withdrawalStrategy === 'rothfirst' || plan.withdrawalStrategy === 'bracketfill')
        return Math.min(rothAvailForEst, Math.max(0, gap - avTax));
      // taxfirst and tradfirst both exhaust Roth last
      return Math.max(0, gap - avTax - tradAvailForEst);
    };
    // Realized gains are in AGI, so they count toward §86 provisional income: estimate the taxable
    // draw as the part of the gap the pre-tax and Roth estimates leave.
    const gainFractionEst = taxAvailEst > 0 ? Math.max(0, Math.min(1, 1 - taxableBasis / taxAvailEst)) : 0;
    const gainsEstFor = (gap: number, avTax: number, wdT: number, wdR: number): number =>
      Math.min(avTax, Math.max(0, gap - wdT - wdR)) * gainFractionEst + tipsGain;
    // Pass 1 — wdTrd estimate ignoring conversion taxes on taxable
    const wdTrdEst1  = _wdTrdEst(spendingGapEst, taxAvailEst);
    const wdRthEst1  = _wdRthEst(spendingGapEst, taxAvailEst);
    const piEst1     = other.taxableAmt + exemptIncomeEst + rmdIncome + wdTrdEst1 + annualDivEst + gainsEstFor(spendingGapEst, taxAvailEst, wdTrdEst1, wdRthEst1) + 0.5 * ss.total - hsaContribRet + tipsTaxed;
    const baseOrdEst1 = hsaDed(taxableSocialSecurity(piEst1, ss.total, filingStatus) + rmdIncome + other.taxableAmt + wdTrdEst1 + wdRthEst1 + ordDivEst + tipsTaxed);
    const ceilForConv = effectiveBracketCeiling(plan.conversion.bracketCeiling, filingStatus) * inflationFactor;
    // Inherited pre-tax IRAs cannot be converted to Roth — exclude their tracked balance.
    const inheritedTradBal = inheritedState
      .filter(s => s.injected && s.remainingBal > 0 && s.ev.bucket === 'inheritedPreTaxIRA')
      .reduce((sum, s) => {
        const alive = s.ev.whose === 'A' ? aliveA : s.ev.whose === 'B' ? aliveB : (aliveA || aliveB);
        return alive ? sum + s.remainingBal : sum;
      }, 0);
    const maxConvEst  = Math.max(0, (trad - inheritedTradBal) * (1 + plan.assumptions.tradReturn) + contribToTrad - trdForced);
    // Senior bonus MAGI must include the conversion and LTCG from taxable withdrawals to correctly
    // model the OBBBA phase-out. Using pre-conversion ordinary income alone massively underestimates
    // MAGI (e.g. $38k vs $260k in taxfirst), causing the conversion to be oversized by ~the full
    // senior bonus. Two-pass: size conversion with no bonus to estimate post-conv MAGI, then resolve.
    const convEstNoSB = Math.min(maxConvEst, Math.max(0, ceilForConv - (baseOrdEst1 - stdDEff)));
    const qualDivEst = annualDivEst * taxableQualifiedPct;
    const ltcgEst = spendingGapEst * gainFractionEst + qualDivEst;
    const magiEstPostConv = baseOrdEst1 + convEstNoSB + ltcgEst;
    const seniorBonusEst = seniorBonusDeduction(filingStatus, filerAge, ageB, magiEstPostConv, calYear);
    const convEst    = Math.min(maxConvEst, Math.max(0, ceilForConv - (baseOrdEst1 - stdDEff - seniorBonusEst)));
    // Pass 2 — taxes on convEst also draw from taxable (payTaxFromBrokerage), leaving less for spending
    const convBracketRate = rateAtBracketCeiling(plan.conversion.bracketCeiling, filingStatus);
    const convTaxFromBrok = (plan.payTaxFromBrokerage ?? false)
      ? Math.min(convBracketRate * convEst, taxAvailEst) : 0;
    const taxAvailForSpendingEst = Math.max(0, taxAvailEst - convTaxFromBrok);
    const wdTrdEstForConv = _wdTrdEst(spendingGapEst, taxAvailForSpendingEst);
    const wdRthEstForConv = _wdRthEst(spendingGapEst, taxAvailForSpendingEst);
    const gainsEstForConv = gainsEstFor(spendingGapEst, taxAvailForSpendingEst, wdTrdEstForConv, wdRthEstForConv);
    const piForConv = other.taxableAmt + exemptIncomeEst + rmdIncome + wdTrdEstForConv + annualDivEst + gainsEstForConv + 0.5 * ss.total - hsaContribRet + tipsTaxed;
    const taxableSSForConv = taxableSocialSecurity(piForConv, ss.total, filingStatus);
    const baseOrdIncForConv0 = hsaDed(taxableSSForConv + rmdIncome + other.taxableAmt + wdTrdEstForConv + wdRthEstForConv + ordDivEst + tipsTaxed);
    // Pass 3 — SS taxability feedback: if the conversion itself pushes PI above the 85% tier,
    // SS becomes more taxable, adding to ordIncome. Compute SS gain at full headroom and absorb
    // it into the base so rothConversion sizes conv to stay within the ceiling after the flip.
    const headroomNominal = Math.max(0, ceilForConv - (baseOrdIncForConv0 - stdDEff - seniorBonusEst));
    const piWithFullConv = other.taxableAmt + exemptIncomeEst + rmdIncome + wdTrdEstForConv + headroomNominal + annualDivEst + gainsEstForConv + 0.5 * ss.total - hsaContribRet + tipsTaxed;
    const taxableSSWithFullConv = taxableSocialSecurity(piWithFullConv, ss.total, filingStatus);
    const ssGain = Math.max(0, taxableSSWithFullConv - taxableSSForConv);
    const baseOrdIncForConv = baseOrdIncForConv0 + ssGain;
    const policyConv = policyWindow?.convAmt;
    // True conversion cap: what's actually available in Trad AFTER growth + contrib
    // and AFTER RMD has been satisfied. Capping at the bare begin-of-year balance
    // (`trad`) let the optimizer pick conv values that, combined with rmd, exceeded
    // post-growth available — surfacing as a Trad OVERDRAW invariant violation.
    const maxConv = Math.max(0, (trad - inheritedTradBal) * (1 + gRateTradYear) + contribToTrad - trdForced);
    let conv: number;
    const eitherRetired = retiredA || retiredB;
    // Portfolio tax-exempt yield (munis held in brokerage). Gated on retirement like dividends.
    // Basis grows unconditionally (reinvested during accumulation too, same as annualDivForBasis).
    const exemptIntForBasis = taxable * taxableExemptYield;
    const exemptInt = eitherRetired ? exemptIntForBasis : 0;
    // Total §103 exempt interest: stream contributions + portfolio yield.
    // other.exemptInterest is gated by the stream's own age window (not retirement) by design.
    const exemptIncome = other.exemptInterest + exemptInt;
    if (convOverrides) {
      conv = Math.min(maxConv, convOverrides[i] ?? 0);
    } else if (eitherRetired && policyConv != null) {
      conv = Math.min(maxConv, policyConv * inflationFactor);
    } else if (!eitherRetired && (plan.conversion.optimize ?? true)) {
      // The optimizer owns conversions (`conversion.optimize`), and its search space starts at
      // retirementAge — it never schedules an accumulation-year conversion. Without this gate,
      // a mode left at 'manual' from an earlier session keeps firing its schedule here, because
      // the pre-retirement fallback below reads plan.conversion directly. That produced
      // conversions the optimizer never chose while the UI read "Optimizer decides".
      // A deliberately chosen mode always carries optimize:false (see StrategyChooser.selectMode).
      conv = 0;
    } else {
      conv = rothConversion({
        params: { ...plan.conversion, bracketCeiling: effectiveBracketCeiling(plan.conversion.bracketCeiling, filingStatus) },
        ageA,
        retired: eitherRetired,
        inflationFactor,
        traditionalBalance: maxConv,
        baseOrdinaryIncome: baseOrdIncForConv,
        stdDeduction: stdDEff + seniorBonusEst,
      });
    }
    lifetimeConversion += conv;
    lifetimeConversionReal += conv / inflationFactor;

    // Pre-estimate inherited account income for gross-up loop sizing.
    // HSA: deterministic (event amount, no circularity). InheritedPreTaxIRA/Roth: the required
    // minimum from prior-year remainingBal (or ev.amount in the injection year); matches the
    // depletion step below exactly.
    let lumpSumHSAIncomeEst = 0, lumpSumForcedTradDistEst = 0, lumpSumTaxFreeEst = 0;
    // Forced distributions from inherited balances already held in the accounts (not this year's
    // injections, which arrive after the draws). Reserved out of tradAvail/rothAvail so strategy
    // draws can't take the money the forced distribution must pay out.
    let heldForcedTradEst = 0, heldForcedRothEst = 0;
    for (const ev of (plan.lumpSumEvents ?? []) as LumpSumEvent[]) {
      const evAge = ev.whose === 'A' ? ageA : ev.whose === 'B' ? (ageB ?? -1) : ageA;
      const evAlive = ev.whose === 'A' ? aliveA : ev.whose === 'B' ? aliveB : (aliveA || aliveB);
      if (!evAlive) continue;
      if (ev.bucket === 'inheritedHSA' && evAge === ev.age) lumpSumHSAIncomeEst += ev.amount;
    }
    for (const s of inheritedState) {
      const evAge = s.ev.whose === 'A' ? ageA : s.ev.whose === 'B' ? (ageB ?? -1) : ageA;
      const evAlive = s.ev.whose === 'A' ? aliveA : s.ev.whose === 'B' ? aliveB : (aliveA || aliveB);
      if (!evAlive) continue;
      const yearsElapsedEst = evAge - s.ev.age;
      if (yearsElapsedEst < 0 || yearsElapsedEst > INHERITED_DEADLINE_YEARS) continue;
      const balEst = s.injected ? s.remainingBal : (evAge === s.ev.age ? s.ev.amount : 0);
      if (balEst <= 0) continue;
      const gRateEst = s.ev.bucket === 'inheritedPreTaxIRA' ? gRateTradYear : gRateRothYear;
      const rmdEst = inheritedAnnualRmd(s.ev, balEst, yearsElapsedEst);
      const grownEst = yearsElapsedEst > 0 ? balEst * (1 + gRateEst) : balEst;
      const floorEst = rmdEst > 0 && rmdEst >= balEst
        ? grownEst
        : Math.min(grownEst, Math.max(grownEst / (INHERITED_DEADLINE_YEARS + 1 - yearsElapsedEst), rmdEst));
      if (s.ev.bucket === 'inheritedPreTaxIRA') lumpSumForcedTradDistEst += floorEst;
      else lumpSumTaxFreeEst += floorEst;
      if (s.injected) {
        if (s.ev.bucket === 'inheritedPreTaxIRA') heldForcedTradEst += floorEst;
        else heldForcedRothEst += floorEst;
      }
    }
    const lumpSumOrdIncomeEst = lumpSumHSAIncomeEst + lumpSumForcedTradDistEst;

    // Base ordinary income for withdrawal bracket-fill sizing (conv now known; wdTrd unknown).
    const piForWd = other.taxableAmt + exemptIncomeEst + rmdIncome + conv + lumpSumOrdIncomeEst + annualDivEst + tipsGain + 0.5 * ss.total - hsaContribRet + tipsTaxed;
    const taxableSSForWd = taxableSocialSecurity(piForWd, ss.total, filingStatus);
    // Include ordinary dividends so bracketfill withdrawal sees the correct pre-wdTrd taxable income.
    const baseOrdIncForWd = hsaDed(taxableSSForWd + rmdIncome + conv + other.taxableAmt + lumpSumOrdIncomeEst
      + (eitherRetired ? taxable * taxableDivYield * (1 - taxableQualifiedPct) : 0) + tipsTaxed);

    // Per-bucket "available to withdraw" caps. All three buckets are debited by the
    // end-of-year update `bucket = max(0, bucket*(1+g) + contrib +/- credits - withdrawal)`,
    // so the withdrawal must respect what that update would actually leave non-negative —
    // otherwise wdX exceeds the cap, the bucket clamps to zero, and the projection silently
    // funds the spending gap with phantom cash (the historic bug class). Same cap formula
    // applied to both withdrawal code paths (legacy preset + custom blend policy).
    // gRateThisYear is declared earlier (for the conv cap); contribToTax/Trad/Roth at the top of the year.
    // Annual dividends/interest from taxable account.
    // Basis grows unconditionally (dividends are reinvested during accumulation too).
    // Tax impact is gated on retirement — the engine does not model working-year income taxes.
    const annualDivForBasis = taxable * taxableDivYield;
    const annualDiv    = eitherRetired ? annualDivForBasis : 0;
    const ordinaryDiv  = annualDiv * (1 - taxableQualifiedPct);
    const qualifiedDiv = annualDiv * taxableQualifiedPct;
    // Payout election: distributed yield leaves the account as cash instead of compounding.
    // Tax treatment is unchanged — only cash flow and basis are affected.
    const divDistributed    = annualDiv * distributePct;
    const exemptDistributed = exemptInt * distributePct;
    const distributedCash   = divDistributed + exemptDistributed;
    // taxAvail reduced by distributed cash — it's already out of the account.
    const taxAvail = Math.max(0, taxable * (1 + gRateTaxYear) + contribToTax - distributedCash);
    // Only the reinvested portion adds to basis; distributed cash does not compound.
    const preBasisThisYear = taxableBasis + contribToTax + (annualDiv - divDistributed) + (exemptInt - exemptDistributed);
    const gainFraction = taxAvail > 0 ? Math.max(0, Math.min(1, 1 - preBasisThisYear / taxAvail)) : 0;
    const tradAvail = Math.max(0, trad * (1 + gRateTradYear) + contribToTrad - trdForced - conv - heldForcedTradEst);
    const rothAvail = Math.max(0, roth * (1 + gRateRothYear) + contribToRoth + conv - heldForcedRothEst);

    // Gross-up loop: solve withdrawals to fund netSpend + fedTax + state + irmaa.
    // SS, other income, RMD, and conversions (which come from Trad → Roth, no cash to user)
    // are accounted for as resources. Conversion CREATES tax; loop sizes withdrawals to cover it.
    let prevTax = 0, prevIRMAA = 0, prevNIIT = 0, prevStateAmt = 0, prevACA = 0;
    let wdTax = 0, wdTrd = 0, wdRth = 0, fedTax = 0, ordIncomeFinal = 0, ltcgFinal = 0, effRate = 0, marginalRate = 0;
    let irmaa = 0, niit = 0, acaPremiumYear = 0, taxableSSFinal = 0, irmaaMAGIFinal = 0;
    let gap = 0;
    let taxFromBrokFinal = 0;
    let lastSpill: { kind: SpillKind; amount: number; tradCap?: number } | undefined;
    let overrideFiredThisYear = false;

    const numAt65Plus = (aliveA && ageA >= 65 ? 1 : 0) + (aliveB && ageB !== undefined && ageB >= 65 ? 1 : 0);
    // State tax — depends on state profile.
    // For IL/TX/FL/WA: only non-retirement non-exempt income is taxable.
    // For CA/NY: retirement withdrawals + conversions are also taxable.
    // We compute it once per iter pass (after withdrawal sizing) to capture CA/NY retirement-tax dependence.
    const numPersons = (aliveA ? 1 : 0) + (aliveB ? 1 : 0);
    let stateAmt = stateTax(plan.state, other.nonExempt + exemptInt * exemptStatePct + ordinaryDiv + lumpSumHSAIncomeEst, other.pensionAmt + lumpSumForcedTradDistEst, numPersons, inflationFactor, numAt65Plus, plan.customStateTaxRate, other.nonExemptSS, hsaStateDed()); // initial pass; ltcg unknown until loop iter 1

    // ACA marketplace premium (pre-Medicare years when the user has opted in).
    const acaPremiumFor = (surchargeMAGI: number, taxableSS: number): number => {
      if (!plan.assumptions.modelACA || plan.assumptions.acaBenchmarkPremium <= 0) return 0;
      const acaStartA = plan.assumptions.acaStartAgeA ?? retireAgeA;
      const acaStartB = plan.assumptions.acaStartAgeB ?? retireAgeB;
      const preMedicareCount = (aliveA && ageA >= acaStartA && ageA < 65 ? 1 : 0) + (aliveB && ageB !== undefined && ageB >= acaStartB && ageB < 65 ? 1 : 0);
      if (preMedicareCount === 0) return 0;
      const scaledPremium = plan.assumptions.acaBenchmarkPremium * inflationFactor * preMedicareCount;
      return plan.assumptions.acaNoSubsidy
        ? scaledPremium  // full cost, no APTC applied
        : acaNetPremium({ magi: surchargeMAGI + (ss.total - taxableSS), householdSize: plan.assumptions.acaHouseholdSize, annualBenchmarkPremium: scaledPremium, inflationFactor });
    };

    // 16 iterations: 8 was enough for IL/TX plans but CA/NY (which tax retirement + conversions)
    // need more to fully converge fedTax + irmaa + stateAmt jointly.
    let itersUsed = 0;
    for (let iter = 0; iter < 16; iter++) {
      itersUsed = iter + 1;
      // Cash needed from withdrawals: spending + all taxes/surcharges, less RMD/SS/other/inherited-dist cash.
      const taxBurden = prevTax + stateAmt + prevIRMAA + prevNIIT + prevACA;
      // When payTaxFromBrokerage is on, only pull the tax shortfall that income surplus cannot
      // cover. Pulling the full burden when income already covers taxes generates unnecessary
      // LTCG on the brokerage draw, which then increases the tax bill (NIIT, fed).
      // Qualified HSA payments cover medical bills and (at 65+) the IRMAA surcharge, so they reduce
      // the cash the rest of the portfolio has to produce.
      const hsaQualIter = hasHSA ? hsaQualifiedPayment(spend.medical, prevIRMAA, hsaOwnerA, hsaOwnerB).total : 0;
      const incomeAvailForTax = Math.max(0,
        ss.total + other.gross + distributedCash + trdForced + lumpSumOrdIncomeEst + lumpSumTaxFreeEst - netSpend + hsaQualIter - hsaContribRet + tips.cash
      );
      const taxFromBrok = (plan.payTaxFromBrokerage ?? false)
        ? Math.min(Math.max(0, taxBurden - incomeAvailForTax), taxAvail)
        : 0;
      taxFromBrokFinal = taxFromBrok;
      gap = Math.max(0, netSpend - ss.total - other.gross - distributedCash - trdForced - lumpSumOrdIncomeEst - lumpSumTaxFreeEst + taxBurden - taxFromBrok - hsaQualIter + hsaContribRet - tips.cash);
      const w = activePolicy
        ? applyBlendPolicy({ policy: activePolicy, ageA, gap, taxable: taxAvail - taxFromBrok, traditional: tradAvail, roth: rothAvail })
        : applyWithdrawalOrder({
            strategy: plan.withdrawalStrategy,
            gap, taxable: taxAvail - taxFromBrok, traditional: tradAvail, roth: rothAvail,
            rmd: rmdAmt, baseOrdinaryIncome: baseOrdIncForWd,
            bracketCeiling: effectiveBracketCeiling(plan.withdrawalBracketCeiling, filingStatus),
            stdD: stdDEff + seniorBonus, inflationFactor,
          });
      wdTax = w.wdTax + taxFromBrok; wdTrd = w.wdTrd; wdRth = w.wdRth;
      lastSpill = w.spill;
      if (w.bracketOverridden) overrideFiredThisYear = true;

      const gains = wdTax * gainFraction + qualifiedDiv + tipsGain;
      // SS taxability via IRC §86 provisional-income tiers (replaces flat 0.85).
      // Provisional income starts from AGI, so dividends, realized gains (qualified dividends are in
      // annualDiv, not gains) and §103 exempt interest all count per IRC §86.
      const provisionalIncome = other.taxableAmt + exemptIncome + wdTrd + rmdIncome + conv + lumpSumOrdIncomeEst + annualDiv + wdTax * gainFraction + tipsGain + 0.5 * ss.total - hsaContribRet + tipsTaxed;
      const taxableSS = taxableSocialSecurity(provisionalIncome, ss.total, filingStatus);
      // ordinaryDiv is ordinary income; qualifiedDiv is captured in ltcg (LTCG stack path).
      const ordPreDed = taxableSS + other.taxableAmt + wdTrd + rmdIncome + conv + lumpSumOrdIncomeEst + ordinaryDiv + tipsTaxed;
      const ordIncome = hsaDed(ordPreDed);
      const ltcg = hsaDedLtcg(ordPreDed, gains);  // taxable gains after any HSA deduction left over
      const magi = ordIncome + ltcg;  // NIIT + OBBBA senior bonus: exempt interest excluded
      const surchargeMAGI = magi + exemptIncome;  // IRMAA (§1395r(i)(4)) + ACA (§36B(d)(2)(B))
      seniorBonus = seniorBonusDeduction(filingStatus, filerAge, ageB, magi, calYear);
      const t = yearFederalTax({
        filingStatus,
        inflationFactor,
        ordinaryIncome: ordIncome,
        ltcgIncome: ltcg,
        standardDeduction: stdDEff + seniorBonus,
      });
      fedTax = t.fedTax; ordIncomeFinal = ordIncome; ltcgFinal = ltcg; effRate = t.effRate; marginalRate = t.marginalRate;
      taxableSSFinal = taxableSS;
      // IRMAA 2-year lookback: year i's surcharge is based on surchargeMAGI from year i-2.
      // For the first two years, fall back to the current year's surchargeMAGI.
      const irmaaMAGI = i >= 2 ? surchargeMagiHistory[i - 2] : surchargeMAGI;
      irmaaMAGIFinal = irmaaMAGI;
      const irmaaFS = i >= 2 ? filingStatusHistory[i - 2] : filingStatus;
      irmaa = numAt65Plus > 0 ? annualIRMAACost(irmaaMAGI, inflationFactor, numAt65Plus, irmaaFS) : 0;
      // The deduction lowers MAGI, not the investment income itself.
      niit = annualNIIT(magi, gains + ordinaryDiv + tipsTaxed, filingStatus);

      // Refine state tax to include retirement distributions for states that tax them.
      // Include stateAmt in the convergence check — for CA/NY plans, state tax is a
      // material gross-up term and ignoring its delta caused ~$15 spending shortfalls
      // (caught by Layer-1's SPENDING COVERAGE invariant on planG_californiaCouple).
      // ltcg goes into nonExemptOrdinaryIncome so IL (retirementExempt:true) still taxes it —
      // IL exempts retirement distributions but NOT capital gains.
      stateAmt = stateTax(plan.state, other.nonExempt + exemptInt * exemptStatePct + ordinaryDiv + gains + lumpSumHSAIncomeEst, wdTrd + rmdIncome + conv + other.pensionAmt + lumpSumForcedTradDistEst, numPersons, inflationFactor, numAt65Plus, plan.customStateTaxRate, other.nonExemptSS, hsaStateDed());

      acaPremiumYear = acaPremiumFor(surchargeMAGI, taxableSS);

      if (
        Math.abs(fedTax - prevTax) < 1 &&
        Math.abs(irmaa - prevIRMAA) < 1 &&
        Math.abs(niit - prevNIIT) < 1 &&
        Math.abs(stateAmt - prevStateAmt) < 1 &&
        Math.abs(acaPremiumYear - prevACA) < 1
      ) break;
      prevTax = fedTax;
      prevIRMAA = irmaa;
      prevNIIT = niit;
      prevStateAmt = stateAmt;
      prevACA = acaPremiumYear;
    }

    opts?.stats?.grossUpIters.push(itersUsed);

    // Collect bracket-fill ceiling override events (once per age, retirement phase only).
    if (overrideFiredThisYear && !activePolicy && retired &&
        !overrideEvents.some(e => e.age === ageA)) {
      const ceiling = effectiveBracketCeiling(plan.withdrawalBracketCeiling, filingStatus);
      const ceilingFmt = `$${Math.round(ceiling).toLocaleString()}`;
      overrideEvents.push({
        age: ageA,
        reason: `Bracket-fill ceiling (${ceilingFmt}) overridden — spending required traditional draws beyond the ceiling`,
      });
    }

    // Clamp de-minimis traditional spill: when the active blend window sets pctTraditional=0,
    // a tiny wdTrd is a floating-point artifact from the safety-valve (last-resort funding when
    // preferred sources are depleted near end-of-plan). Apply after the gross-up loop so tax
    // convergence is unaffected; only the output values and balance update are cleaned up.
    let trdClamped = false;
    if (activePolicy) {
      const bw = findWindow(activePolicy, ageA);
      if (bw && bw.pctTraditional === 0 && wdTrd > 0 && wdTrd < 100) { wdTrd = 0; trdClamped = true; }
    }

    // What the HSA actually pays this year: medical first, then the converged IRMAA surcharge.
    const hsaPay = hasHSA ? hsaQualifiedPayment(spend.medical, irmaa, hsaOwnerA, hsaOwnerB) : { total: 0, a: 0, b: 0 };
    const hsaQualFinal = hsaPay.total;

    // Per-year decision attribution (gated on opts.explain so the optimizer never pays for it).
    // Build after the de-minimis clamp so notes cite the same values that appear in the row.
    if (opts?.explain) {
      const isActiveBracketfill = !activePolicy && plan.withdrawalStrategy === 'bracketfill';
      const wdBracketCeilNominal = effectiveBracketCeiling(plan.withdrawalBracketCeiling, filingStatus) * inflationFactor;
      // Mirror roomInBracket from withdrawal.ts:58 — uses the withdrawal ceiling, not ceilForConv.
      const bracketfillRoom = isActiveBracketfill
        ? Math.max(0, wdBracketCeilNominal + (stdDEff + seniorBonus) - baseOrdIncForWd - wdTrd)
        : 0;
      const activeWindow = activePolicy ? findWindow(activePolicy, ageA) : undefined;
      const spillWindow = activeWindow
        ? { pctTaxable: activeWindow.pctTaxable, pctTraditional: activeWindow.pctTraditional, pctRoth: activeWindow.pctRoth }
        : undefined;
      // Use final resolved seniorBonus and ordIncomeFinal for accurate WHY-note display.
      // headroomNominal was estimated before convergence (uses seniorBonusEst); the final
      // seniorBonus can differ materially when OBBBA phase-out depends on actual conv size.
      const baseOrdIncDisplay = ordIncomeFinal - conv;
      const headroomNominalDisplay = Math.max(0, ceilForConv - (baseOrdIncDisplay - stdDEff - seniorBonus));
      const notes = buildYearDecisions({
        year: i + 1,
        ageA,
        conv,
        convPolicyZero: policyConv === 0,
        convOptimizerSet: policyConv != null,
        headroomNominal: headroomNominalDisplay,
        maxConv,
        ceilForConv,
        baseOrdIncome: baseOrdIncDisplay,
        tradBalance: maxConv,
        wdTax: wdTax - taxFromBrokFinal,  // show only the withdrawal portion, not the tax-from-brok pull
        wdTrd,
        wdRth,
        gap,
        rmdTaxable,
        rmdGross: rmdAmt,
        qcd: qcdTotal,
        qcdBeyondRmd: qcdTotal > 0 ? trdForced - rmdAmt : 0,
        qcdTaxable,
        bracketOverridden: overrideFiredThisYear,
        spill: lastSpill,
        spillWindow,
        isActiveBracketfill,
        bracketfillRoom,
      });
      decisionNotes.push(...notes);
    }

    // Update balances. Withdrawals were sized to cover all cash needs.
    // Per-bucket contribution amounts (cA/cB, contribToTax/Trad/Roth) were computed at the top
    // of the year — they already account for the spousal-IRA routing.
    const begTaxable = taxable, begTrad = trad, begRoth = roth;
    const begHSA = hsaA + hsaB;

    taxable = Math.max(0, taxable * (1 + gRateTaxYear) + contribToTax - wdTax - distributedCash);
    // Split withdrawals and conversions pro-rata by each person's trad balance.
    // Combined max(0, ...) preserves the single-pool mass-balance invariant; tradANext
    // is clamped to [0, tradCombined] so tradA+tradB == tradCombined exactly even when
    // one person's RMD rate differs from the other's (different ages → per-person overdraft).
    const totalTradBeg = tradA + tradB;
    const ratioA = totalTradBeg > 0 ? tradA / totalTradBeg : 0;
    // Inherited IRAs can't be converted (maxConv excludes them), so a conversion comes out of each
    // spouse's own balance; a pro-rata split would take the inherited money its forced distribution needs.
    const ownTradA = Math.max(0, tradA - inheritedInTradA), ownTradB = Math.max(0, tradB - inheritedInTradB);
    const convRatioA = inheritedTradBal > 0 && ownTradA + ownTradB > 0 ? ownTradA / (ownTradA + ownTradB) : ratioA;
    const tradANext = convRatioA === ratioA
      ? tradA * (1 + gRateTradYear) + cA.trad + tips.toTradA - forcedA - (wdTrd + conv) * ratioA
      : tradA * (1 + gRateTradYear) + cA.trad + tips.toTradA - forcedA - wdTrd * ratioA - conv * convRatioA;
    const tradCombined = Math.max(0, totalTradBeg * (1 + gRateTradYear) + contribToTrad - trdForced - wdTrd - conv);
    tradA = tradCombined > 0 ? Math.max(0, Math.min(tradCombined, tradANext)) : 0;
    tradB = tradCombined - tradA;
    roth  = Math.max(0, roth  * (1 + gRateRothYear) + contribToRoth - wdRth + conv);
    if (hasHSA) {
      hsaA = Math.max(0, hsaA * (1 + gRateHsaYear) + hsaContribExtA + hsaContribRetA - hsaPay.a);
      hsaB = Math.max(0, hsaB * (1 + gRateHsaYear) + hsaContribExtB + hsaContribRetB - hsaPay.b);
    }
    taxableBasis = Math.max(0, taxableBasis + contribToTax + (annualDivForBasis - divDistributed) + (exemptIntForBasis - exemptDistributed) - wdTax * (1 - gainFraction));

    // One-time income events: inject directly into target account.
    // Amount is nominal dollars in the event year (the UI asks for the nominal amount), so it is
    // injected as-is with no inflation adjustment. Taxable bucket gets full
    // stepped-up basis; inherited IRA types seed per-event depletion tracking.
    let lumpSumInjectTaxable = 0, lumpSumInjectTrad = 0, lumpSumInjectRoth = 0;
    let lumpSumHSAIncome = 0;
    for (const ev of (plan.lumpSumEvents ?? []) as LumpSumEvent[]) {
      const personAge = ev.whose === 'A' ? ageA : ev.whose === 'B' ? (ageB ?? -1) : ageA;
      const personAlive = ev.whose === 'A' ? aliveA : ev.whose === 'B' ? aliveB : (aliveA || aliveB);
      if (!personAlive || personAge !== ev.age) continue;
      if (ev.bucket === 'taxable') {
        taxable += ev.amount; taxableBasis += ev.amount; lumpSumInjectTaxable += ev.amount;
      } else if (ev.bucket === 'inheritedHSA') {
        lumpSumHSAIncome += ev.amount;
      } else if (ev.bucket === 'inheritedPreTaxIRA') {
        if (ev.whose === 'B') tradB += ev.amount; else tradA += ev.amount;
        lumpSumInjectTrad += ev.amount;
        const s = inheritedState.find(s => s.ev.id === ev.id);
        if (s) { s.remainingBal = ev.amount; s.injected = true; }
      } else if (ev.bucket === 'inheritedRoth') {
        roth += ev.amount; lumpSumInjectRoth += ev.amount;
        const s = inheritedState.find(s => s.ev.id === ev.id);
        if (s) { s.remainingBal = ev.amount; s.injected = true; }
      }
    }

    // Inherited IRA/Roth 10-year depletion (SECURE Act). The required minimum comes out first,
    // like an RMD, independent of the withdrawal strategy; strategy draws are attributed to the
    // inherited balance afterwards (inherited first, see below).
    let lumpSumForcedTradDist = 0, lumpSumForcedTradDistA = 0, lumpSumForcedTradDistB = 0;
    let lumpSumForcedRothDist = 0;
    for (const s of inheritedState) {
      if (!s.injected || s.remainingBal <= 0) continue;
      const personAge = s.ev.whose === 'A' ? ageA : s.ev.whose === 'B' ? (ageB ?? -1) : ageA;
      const personAlive = s.ev.whose === 'A' ? aliveA : s.ev.whose === 'B' ? aliveB : (aliveA || aliveB);
      if (!personAlive) continue;
      const yearsElapsed = personAge - s.ev.age;
      if (yearsElapsed < 0 || yearsElapsed > INHERITED_DEADLINE_YEARS) continue;

      const gRate = s.ev.bucket === 'inheritedPreTaxIRA' ? gRateTradYear : gRateRothYear;
      // Annual RMD is figured on the prior year-end balance, i.e. before this year's growth.
      const priorBal = s.remainingBal;
      const annualRmd = inheritedAnnualRmd(s.ev, priorBal, yearsElapsed);
      // Injected at year end (yearsElapsed 0), so it earns no growth this year, like the account holding it.
      if (yearsElapsed > 0) s.remainingBal *= (1 + gRate);

      // Years left including this one; 1 in the deadline year, which forces out the remainder.
      // Floor = even spread over the years left, or the annual RMD when that is larger. Once the
      // life-expectancy divisor runs out (RMD = whole prior balance), the account must be emptied.
      const yearsRemaining = INHERITED_DEADLINE_YEARS + 1 - yearsElapsed;
      const floor = (annualRmd > 0 && annualRmd >= priorBal) || yearsRemaining === 1
        ? s.remainingBal
        : Math.min(s.remainingBal, Math.max(s.remainingBal / yearsRemaining, annualRmd));
      s.remainingBal = Math.max(0, s.remainingBal - floor);

      if (s.ev.bucket === 'inheritedPreTaxIRA') {
        lumpSumForcedTradDist += floor;
        if (s.ev.whose === 'B' || !aliveA) lumpSumForcedTradDistB += floor;
        else lumpSumForcedTradDistA += floor;
      } else lumpSumForcedRothDist += floor;
    }

    const lumpSumOrdIncome = lumpSumHSAIncome + lumpSumForcedTradDist;
    const lumpSumTaxFreeCash = lumpSumForcedRothDist;
    // Last-resort HSA draws, added in the top-up loop below. Declared here so resolveYearTaxes sees them.
    let hsaQualLR = 0, hsaReimb = 0, hsaNonQual = 0, hsaPenalty = 0;

    // Re-solve every tax term from the year's actual withdrawals and inherited amounts.
    // Mirrors one pass of the gross-up loop body.
    const resolveYearTaxes = () => {
      const gains = wdTax * gainFraction + qualifiedDiv + tipsGain;
      const provisionalIncome = other.taxableAmt + exemptIncome + wdTrd + rmdIncome + conv + lumpSumOrdIncome + annualDiv + wdTax * gainFraction + tipsGain + 0.5 * ss.total + hsaNonQual - hsaContribRet + tipsTaxed;
      const taxableSS = taxableSocialSecurity(provisionalIncome, ss.total, filingStatus);
      const ordPreDed = taxableSS + other.taxableAmt + wdTrd + rmdIncome + conv + lumpSumOrdIncome + ordinaryDiv + hsaNonQual + tipsTaxed;
      const ordIncome = hsaDed(ordPreDed);
      const ltcg = hsaDedLtcg(ordPreDed, gains);
      const magi = ordIncome + ltcg;
      const surchargeMAGI = magi + exemptIncome;
      seniorBonus = seniorBonusDeduction(filingStatus, filerAge, ageB, magi, calYear);
      const t = yearFederalTax({ filingStatus, inflationFactor, ordinaryIncome: ordIncome, ltcgIncome: ltcg, standardDeduction: stdDEff + seniorBonus });
      fedTax = t.fedTax; effRate = t.effRate; marginalRate = t.marginalRate;
      ordIncomeFinal = ordIncome; ltcgFinal = ltcg; taxableSSFinal = taxableSS;
      irmaaMAGIFinal = i >= 2 ? surchargeMagiHistory[i - 2] : surchargeMAGI;
      const irmaaFS = i >= 2 ? filingStatusHistory[i - 2] : filingStatus;
      irmaa = numAt65Plus > 0 ? annualIRMAACost(irmaaMAGIFinal, inflationFactor, numAt65Plus, irmaaFS) : 0;
      niit = annualNIIT(magi, gains + ordinaryDiv + tipsTaxed, filingStatus);
      stateAmt = stateTax(
        plan.state,
        other.nonExempt + exemptInt * exemptStatePct + ordinaryDiv + gains + lumpSumHSAIncome + hsaNonQual,
        wdTrd + rmdIncome + conv + other.pensionAmt + lumpSumForcedTradDist,
        numPersons, inflationFactor, numAt65Plus, plan.customStateTaxRate, other.nonExemptSS, hsaStateDed(),
      );
      acaPremiumYear = acaPremiumFor(surchargeMAGI, taxableSS);
    };

    // Correct taxes when actual != estimate (e.g. owner died mid-plan) or the
    // de-minimis clamp removed a pre-tax draw the loop had taxed.
    if (trdClamped || lumpSumOrdIncome !== lumpSumOrdIncomeEst || lumpSumTaxFreeCash !== lumpSumTaxFreeEst) {
      resolveYearTaxes();
    }

    // Debit forced dist cash from host account (the cash is counted in the reconciliation below).
    if (lumpSumForcedTradDistA > 0) tradA = Math.max(0, tradA - lumpSumForcedTradDistA);
    if (lumpSumForcedTradDistB > 0) tradB = Math.max(0, tradB - lumpSumForcedTradDistB);
    if (lumpSumTaxFreeCash > 0) roth = Math.max(0, roth - lumpSumTaxFreeCash);

    // Year-end cash reconciliation (replaces the old surplus sweep), using actual amounts.
    // residual > 0: more cash received than needed -> sweep to taxable at full basis.
    // residual < 0: need exceeds cash received (gross-up drift, or the inherited estimate
    // exceeded the actual cash) -> top-up draw split by the same withdrawal strategy or blend
    // policy as the main draw. All taxes are re-solved after each draw because the draw itself
    // adds income. Each round leaves a deficit of roughly need x marginal rate, so the loop
    // converges geometrically; 40 rounds clears it even at very high combined rates.
    // Whatever the portfolio still cannot cover is the shortfall.
    const cashIn = ss.total + other.gross + distributedCash + trdForced + lumpSumOrdIncome + lumpSumTaxFreeCash + hsaQualFinal + tips.cash;
    const residualOf = () => cashIn + wdTax + wdTrd + wdRth
      - netSpend - fedTax - stateAmt - irmaa - niit - acaPremiumYear
      + (hsaQualLR + hsaReimb + hsaNonQual) - hsaPenalty - hsaContribRet;
    let residual = residualOf();
    let wdTrdFromA = wdTrd * ratioA, wdTrdFromB = wdTrd * (1 - ratioA);
    for (let k = 0; k < 40 && residual < -0.01; k++) {
      const need = -residual;
      const tradTotal = tradA + tradB;
      let top: WithdrawalOutputs;
      if (activePolicy) {
        // The window's pre-tax cap covers the whole year, so only the unused part is left.
        const bw = findWindow(activePolicy, ageA);
        const policy = bw?.tradCap != null
          ? { ...activePolicy, windows: activePolicy.windows.map((x) => x === bw ? { ...x, tradCap: Math.max(0, bw.tradCap! - wdTrd) } : x) }
          : activePolicy;
        top = applyBlendPolicy({ policy, ageA, gap: need, taxable, traditional: tradTotal, roth });
      } else {
        top = applyWithdrawalOrder({
          strategy: plan.withdrawalStrategy,
          gap: need, taxable, traditional: tradTotal, roth,
          rmd: rmdAmt, baseOrdinaryIncome: baseOrdIncForWd + wdTrd,
          bracketCeiling: effectiveBracketCeiling(plan.withdrawalBracketCeiling, filingStatus),
          stdD: stdDEff + seniorBonus, inflationFactor,
        });
      }
      const fromTax = Math.min(taxable, top.wdTax);
      const fromRoth = Math.min(roth, top.wdRth);
      const fromTrad = Math.min(tradTotal, top.wdTrd);
      if (fromTax + fromRoth + fromTrad <= 0) {
        // Every other account is spent: the HSA is the last resort. Unpaid qualified spending first
        // (tax-free), then receipts (tax-free), then non-qualified money (taxed, 20% penalty under 65).
        if (!hasHSA || hsaA + hsaB <= 0) break;
        // A retiree contribution the HSA itself would have to fund is pointless (the draw would be
        // taxed and penalized), so it is cancelled first and the year re-solved without it.
        if (hsaContribRet > 0) {
          const undoA = Math.min(hsaContribRetA, hsaA), undoB = Math.min(hsaContribRetB, hsaB);
          if (undoA + undoB > 0) {
            hsaA -= undoA; hsaB -= undoB;
            hsaContribRetA -= undoA; hsaContribRetB -= undoB;
            hsaContribRet = hsaContribRetA + hsaContribRetB;
            resolveYearTaxes();
            residual = residualOf();
            continue;
          }
        }
        const qualNeedLeft = Math.max(0, spend.medical + irmaa - hsaQualFinal - hsaQualLR);
        const d = hsaLastResortDraw({
          need,
          balA: hsaA, balB: hsaB,
          qualNeedLeft,
          irmaaNeedLeft: Math.min(qualNeedLeft, Math.max(0, irmaa - Math.max(0, hsaQualFinal + hsaQualLR - spend.medical))),
          receipts: hsaReceipts - hsaReimb,
          penalizedA: !(aliveA && ageA >= HSA_MEDICARE_AGE),
          penalizedB: !(aliveB && ageB !== undefined && ageB >= HSA_MEDICARE_AGE),
        });
        if (d.qualified + d.reimbursed + d.nonQual <= 0) break;
        hsaA = Math.max(0, hsaA - d.fromA); hsaB = Math.max(0, hsaB - d.fromB);
        hsaQualLR += d.qualified; hsaReimb += d.reimbursed; hsaNonQual += d.nonQual; hsaPenalty += d.penalty;
        resolveYearTaxes();
        residual = residualOf();
        continue;
      }
      if (top.bracketOverridden) overrideFiredThisYear = true;
      if (fromTax > 0) {
        wdTax += fromTax;
        taxable -= fromTax;
        taxableBasis = Math.max(0, taxableBasis - fromTax * (1 - gainFraction));
      }
      if (fromRoth > 0) {
        wdRth += fromRoth;
        roth -= fromRoth;
      }
      if (fromTrad > 0) {
        const shareA = tradA / tradTotal;
        tradA = Math.max(0, tradA - fromTrad * shareA);
        tradB = Math.max(0, tradB - fromTrad * (1 - shareA));
        wdTrd += fromTrad;
        wdTrdFromA += fromTrad * shareA;
        wdTrdFromB += fromTrad * (1 - shareA);
      }
      resolveYearTaxes();
      residual = residualOf();
    }

    // Inherited first: each owner's strategy draws come out of their inherited balance before
    // their own account. Inherited IRAs cannot be converted, so this preserves convertible room.
    let inheritedTradFromWd = 0, inheritedRothFromWd = 0, inheritedBal = 0, inheritedRothBal = 0;
    let rothWdLeft = wdRth;
    // The tracked balance is a label on part of the owner's account, so it can never exceed that account.
    // A spouse whose draws ran past their own money spent inherited money too (the split is pro-rata).
    let roomA = tradA, roomB = tradB;
    for (const s of inheritedState) {
      if (!s.injected || s.remainingBal <= 0) continue;
      const tracked = s.ev.whose === 'A' ? aliveA : s.ev.whose === 'B' ? aliveB : (aliveA || aliveB);
      if (!tracked) continue;
      let take: number;
      if (s.ev.bucket === 'inheritedPreTaxIRA') {
        if (s.ev.whose === 'B' || !aliveA) {
          take = Math.min(s.remainingBal, wdTrdFromB); wdTrdFromB -= take;
          const spill = Math.min(wdTrdFromA, Math.max(0, s.remainingBal - take - roomB));
          wdTrdFromA -= spill; take += spill;
          roomB -= s.remainingBal - take;
        } else {
          take = Math.min(s.remainingBal, wdTrdFromA); wdTrdFromA -= take;
          const spill = Math.min(wdTrdFromB, Math.max(0, s.remainingBal - take - roomA));
          wdTrdFromB -= spill; take += spill;
          roomA -= s.remainingBal - take;
        }
        inheritedTradFromWd += take;
      } else {
        take = Math.min(s.remainingBal, rothWdLeft); rothWdLeft -= take;
        inheritedRothFromWd += take;
      }
      s.remainingBal -= take;
      inheritedBal += s.remainingBal;
      if (s.ev.bucket !== 'inheritedPreTaxIRA') inheritedRothBal += s.remainingBal;
    }

    let cashSurplus = 0;
    if (residual > 0) {
      cashSurplus = residual;
      taxable += cashSurplus;
      taxableBasis += cashSurplus;
    }

    // Medical bills paid from other accounts become receipts the HSA can reimburse later.
    if (hasHSA) hsaReceipts = hsaReceipts - hsaReimb + Math.max(0, spend.medical - Math.min(hsaQualFinal + hsaQualLR, spend.medical));
    const endTotal = taxable + tradA + tradB + roth + hsaA + hsaB + tips.endTaxable + tips.endTrad + tips.endRoth;
    // Depletion is "could not fund the year's spending need from the portfolio", NOT just
    // "endTotal reached exactly zero". Each bucket's update is max(0, bal*g - wd), and wd is
    // capped at bal, so residuals decay geometrically toward zero but never quite hit it —
    // the old `endTotal <= 0` check failed to fire and the plan appeared to survive forever
    // while silently failing to pay expenses.
    let shortfall = 0;
    if (retired) {
      // Sub-dollar deficits are rounding drift, not unfunded spending.
      shortfall = residual <= -1 ? -residual : 0;
      if (!ranOut && shortfall > 1) ranOut = true;
    }
    lifetimeShortfallReal += shortfall / inflationFactor;

    lifetimeFedTax += fedTax;
    lifetimeFedTaxReal += fedTax / inflationFactor;
    surchargeMagiHistory.push(ordIncomeFinal + ltcgFinal + exemptIncome);  // surchargeMAGI for IRMAA lookback
    filingStatusHistory.push(filingStatus);

    // Advance the running inflation factor for the next year.
    runningInflationFactor *= (1 + (opts?.inflationOverrides?.[i] ?? plan.assumptions.inflation));

    const stateProfile = STATE_PROFILES[plan.state];
    const flatStateRate = plan.state === 'CUSTOM' ? (plan.customStateTaxRate ?? 0) : (stateProfile?.effectiveRate ?? 0);
    const stateMarginalRate = stateAmt > 0 ? flatStateRate : 0;

    rows.push({
      year: i + 1,
      ageA, ageB,
      phase,
      filingStatus,
      inflationFactor,
      contribA, contribB,
      spousalA, spousalB,
      ssA: ss.ssA, ssB: ss.ssB, totalSS: ss.total,
      otherIncome: other.gross,
      otherIncomeTaxable: other.taxableAmt,
      otherIncomeNonExempt: other.nonExempt,
      exemptInterest: exemptIncome,
      netSpend,
      wdTax, wdTrd, wdRth,
      totalWD: wdTax + wdTrd + wdRth,
      bracketOverridden: overrideFiredThisYear,
      rmd: rmdAmt,
      rothConv: conv,
      ordIncome: ordIncomeFinal,
      ltcg: ltcgFinal,
      ordinaryDiv,
      qualifiedDiv,
      distributedCash,
      distributedDiv: divDistributed,
      fedTax,
      stateTaxAmt: stateAmt,
      irmaa,
      niit,
      effRate,
      marginalRate,
      stateMarginalRate,
      stdDeduction: stdDEff + seniorBonus,
      seniorBonus,
      magi: ordIncomeFinal + ltcgFinal,
      acaMagi: ordIncomeFinal + ltcgFinal + exemptIncome + (ss.total - taxableSSFinal),
      irmaaMagi: irmaaMAGIFinal,
      acaPremium: acaPremiumYear,
      lumpSumInjectTaxable, lumpSumInjectTrad, lumpSumInjectRoth,
      lumpSumOrdinaryIncome: lumpSumOrdIncome,
      lumpSumForcedTradDist,
      lumpSumForcedRothDist,
      inheritedTradFromWd,
      inheritedRothFromWd,
      inheritedBegBal,
      inheritedBal,
      inheritedRothBegBal,
      inheritedRothBal,
      cashSurplus,
      begTaxable, begTraditional: begTrad, begRoth,
      endTaxable: taxable, endTraditional: tradA + tradB, endRoth: roth,
      endTotal,
      endTaxableBasis: taxableBasis,
      endTaxAdjusted: taxAdjustedValue(taxable, taxableBasis, tradA + tradB, roth, taxAdjRates.ordRate, taxAdjRates.ltcgRate,
        hasHSA || hasTips
          ? { ...(hasHSA ? { hsa: hsaA + hsaB, hsaReceipts } : {}), ...(hasTips ? { preTax: tips.endTrad, clean: tips.endTaxable + tips.endRoth } : {}) }
          : undefined),
      ranOut,
      shortfall,
      taxFromBrokerage: taxFromBrokFinal,
      medicalSpend: spend.medical,
      charitableSpend: spend.charitable,
      qcd: qcdTotal,
      qcdBeyondRmd: qcdTotal > 0 ? trdForced - rmdAmt : 0,
      qcdB,
      qcdTaxable,
      charityDeduction: charDed,
      begHSA,
      endHSA: hsaA + hsaB,
      hsaContrib: hsaContribExtA + hsaContribExtB + hsaContribRet,
      hsaContribRet,
      hsaQualifiedWD: hsaQualFinal + hsaQualLR,
      hsaReceiptsBal: hsaReceipts,
      hsaReimbursed: hsaReimb,
      hsaNonQualWD: hsaNonQual,
      hsaPenalty,
      begTips: tips.beg,
      endTipsTaxable: tips.endTaxable,
      endTipsTrad: tips.endTrad,
      endTipsRoth: tips.endRoth,
      tipsCoupon: tips.coupon,
      tipsAccrual: tips.accrual,
      tipsMaturity: tips.maturity,
      tipsFloorBonus: tips.floorBonus,
      tipsCash: tips.cash,
      tipsToTrad: tips.toTradA + tips.toTradB,
      tipsToRoth: tips.toRoth,
      tipsOrdInc: tipsTaxed,
      tipsGain,
      rmdUnmet,
      rmdUnmetB,
    });
  }

  // IRMAA/ACA headroom notes — post-hoc pass; optimizer never pays for this.
  if (opts?.explain) {
    for (let i = 0; i < rows.length; i++) {
      const in_ = irmaaHeadroomNote(rows, i);
      if (in_) decisionNotes.push(in_);
      const an = acaCliffNote(rows[i], plan.assumptions.acaHouseholdSize, plan.assumptions.modelACA);
      if (an) decisionNotes.push(an);
    }
  }

  const last = rows[rows.length - 1];
  const endTotalNominal = last?.endTotal ?? 0;
  const endTotalReal = last ? endTotalNominal / last.inflationFactor : 0;
  const endTaxAdjustedNominal = last?.endTaxAdjusted ?? 0;
  const endTaxAdjustedReal = last ? endTaxAdjustedNominal / last.inflationFactor : 0;

  return {
    rows,
    lifetimeFedTax,
    lifetimeFedTaxReal,
    lifetimeRMD,
    lifetimeRMDReal,
    lifetimeConversion,
    lifetimeConversionReal,
    endTotalNominal,
    endTotalReal,
    endTaxAdjustedNominal,
    endTaxAdjustedReal,
    yearsCovered: rows.length,
    lifetimeShortfallReal,
    ranOut,
    overrideEvents,
    decisionNotes,
  };
}

/**
 * Last age through which retirement spending is fully funded, or null if the plan lasts
 * the full horizon. Returns (first-underfunded-age − 1) so callers can display
 * "Funded through Age X" without off-by-one.
 */
export function depletionAge(proj: ProjectionResult): number | null {
  for (const r of proj.rows) {
    if ((r.phase === 'Retire' || r.phase === 'Survivor') && r.ranOut) {
      return r.ageA - 1;
    }
  }
  return null;
}

/**
 * Initial (year-1) withdrawal rate — the classic "4% rule" metric.
 * Numerator: gross portfolio withdrawals in the first retirement year that
 *   actually draws from accounts.
 * Denominator: portfolio value at the START of that year (end-of-year balance
 *   plus the withdrawals taken during it).
 * The ratio is unit-invariant (both terms are same-year nominal dollars), so it
 * reads identically in real and nominal mode. This is the single source of
 * truth — the top bar, dashboard, scenario compare, and the WR insight all use
 * it so the number is consistent everywhere.
 */
export function initialWithdrawalRate(proj: ProjectionResult): number {
  const r =
    proj.rows.find((row) => (row.phase === 'Retire' || row.phase === 'Survivor') && row.totalWD > 0) ??
    proj.rows.find((row) => row.totalWD > 0);
  if (!r) return 0;
  const startOfYear = r.endTotal + r.totalWD;
  return startOfYear > 0 ? r.totalWD / startOfYear : 0;
}
