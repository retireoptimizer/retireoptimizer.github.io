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
import { rmdDivisor, rmdStartAgeForDob } from './rmd';
import { householdSS } from './socialSecurity';
import { yearFederalTax, standardDeduction, taxableSocialSecurity, seniorBonusDeduction } from './tax';
import { FED_BRACKETS_MFJ, FED_BRACKETS_SINGLE, IRA_CONTRIB_LIMIT, IRA_CATCHUP, IRA_CATCHUP_AGE } from './taxConstants';
import { rothConversion } from './conversion';
import { applyWithdrawalOrder, applyBlendPolicy, type SpillKind } from './withdrawal';
import type { BlendPolicy } from './blendPolicy';
import { findWindow } from './blendPolicy';
import { annualIRMAACost } from './irmaa';
import { annualNIIT } from './niit';
import { stateTax, STATE_PROFILES } from './stateTax';
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
  ltcg: number;
  ordinaryDiv: number;     // ordinary (non-qualified) dividends from taxable account
  qualifiedDiv: number;    // qualified dividends from taxable account (subset of ltcg)
  distributedCash: number; // yield paid out in cash (not reinvested); taxed same as reinvested yield
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
  lumpSumForcedTradDist: number;   // supplemental forced dists from inheritedPreTaxIRA
  lumpSumForcedRothDist: number;   // supplemental forced dists from inheritedRoth
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
): { gross: number; taxableAmt: number; exemptInterest: number; nonExempt: number; pensionAmt: number } => {
  let gross = 0, taxableAmt = 0, exemptInterest = 0, nonExempt = 0, pensionAmt = 0;
  for (const { s, w, growthRate } of resolved) {
    if (s.type === 'SS') continue; // SS handled separately via PIA
    const factor = streamFactor(w, ageA, ageB, aliveA, aliveB);
    if (factor === 0) continue;
    const amount = s.annualAmount * factor * Math.pow(1 + growthRate, yearIndex);
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
  return { gross, taxableAmt, exemptInterest, nonExempt, pensionAmt };
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
): number => {
  let total = 0;
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
    total += e.annualAmount * factor * growthFactor;
  }
  return total;
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
}

/** Map a stored MFJ bracket-fill ceiling to its Single equivalent by bracket index. */
// The stored bracketCeiling is always the filing-status-appropriate bracket top, because
// the UI dropdowns use FED_BRACKETS_MFJ for MFJ plans and FED_BRACKETS_SINGLE for Single plans.
// No remapping needed — return the stored value directly.
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

export function runProjection(plan: Plan, opts?: ProjectionOptions): ProjectionResult {
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

  const rows: ProjectionRow[] = [];
  const decisionNotes: YearDecision[] = [];
  let lifetimeFedTax = 0, lifetimeRMD = 0, lifetimeConversion = 0;
  let lifetimeFedTaxReal = 0, lifetimeRMDReal = 0, lifetimeConversionReal = 0;
  let ranOut = false;

  const inheritedState: Array<{ ev: LumpSumEvent; remainingBal: number; injected: boolean }> =
    (plan.lumpSumEvents ?? [])
      .filter(ev => ev.bucket === 'inheritedPreTaxIRA' || ev.bucket === 'inheritedRoth')
      .map(ev => ({ ev, remainingBal: 0, injected: false }));
  const filingStatusHistory: FilingStatus[] = [];

  const maxYears = Math.min(80, planToAge - startAgeA + 1);
  const rmdStartAgeA = rmdStartAgeForDob(plan.personA.dob);
  const rmdStartAgeB = plan.personB ? rmdStartAgeForDob(plan.personB.dob) : rmdStartAgeA;
  const planInflation = plan.assumptions.inflation;
  const rIncome = resolveIncomeStreams(plan.incomeStreams, frame, planInflation);
  const rExpense = resolveExpenseStreams(plan.expenseStreams, frame, planInflation);
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
    const contribToTax  = cA.tax  + cB.tax;
    const contribToTrad = cA.trad + cB.trad;
    const contribToRoth = cA.roth + cB.roth;

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
    });

    // Other income streams
    const other = sumIncomeStreams(rIncome, ageA, ageB, i, aliveA, aliveB);

    // Expenses start when either person retires (semi-retirement or full retirement).
    // Per-whose gate inside sumExpenseStreams: A-tagged on retiredA, B-tagged on retiredB,
    // Household on retiredA||retiredB. Working person's contributions offset the portfolio draw.
    const netSpend = (retiredA || retiredB) ? sumExpenseStreams(
      rExpense, ageA, ageB, i,
      aliveA, aliveB,
      opts?.inflationOverrides ? inflationFactor : undefined,
      retiredA, retiredB,
    ) : 0;

    // Spousal rollover: merge deceased person's traditional balance into the survivor's IRA.
    // Handles both death orders. Self-extinguishing once the balance reaches zero.
    if (!aliveA && tradA > 0) { tradB += tradA; tradA = 0; }
    if (plan.personB && !aliveB && tradB > 0) { tradA += tradB; tradB = 0; }
    const trad = tradA + tradB;

    // Per-person RMD — each governed by their own age and SECURE 2.0 start age.
    const rmdA = (aliveA && ageA >= rmdStartAgeA) ? Math.max(0, tradA) / rmdDivisor(ageA) : 0;
    const rmdB = (aliveB && ageB !== undefined && ageB >= rmdStartAgeB)
      ? Math.max(0, tradB) / rmdDivisor(ageB) : 0;
    const rmdAmt = rmdA + rmdB;
    lifetimeRMD += rmdAmt;
    lifetimeRMDReal += rmdAmt / inflationFactor;

    // Standard deduction this year. For Single filers where B is the survivor, use B's age.
    const filerAge = (filingStatus === 'Single' && !aliveA && aliveB && ageB !== undefined) ? ageB : ageA;
    const stdD = standardDeduction(filingStatus, filerAge, ageB, inflationFactor);
    const calYear = startYear + i;
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
    const tradAvailForEst = Math.max(0, trad * (1 + plan.assumptions.tradReturn) + contribToTrad - rmdAmt);
    const rothAvailForEst = Math.max(0, roth * (1 + plan.assumptions.rothReturn) + contribToRoth);
    // Exempt interest estimate (gated on retirement like the actual value).
    // other.exemptInterest is gated by the stream's own age window (not retirement) by design —
    // a muni stream correctly hits ACA MAGI for a pre-retirement marketplace enrollee.
    const exemptIntEst = (retiredA || retiredB) ? taxable * taxableExemptYield : 0;
    const exemptIncomeEst = other.exemptInterest + exemptIntEst;
    const annualDivEstForDist = (retiredA || retiredB) ? taxable * taxableDivYield : 0;
    const exemptIntEstForDist = (retiredA || retiredB) ? taxable * taxableExemptYield : 0;
    const distributedCashEst  = (annualDivEstForDist + exemptIntEstForDist) * distributePct;
    const spendingGapEst = Math.max(0, netSpend - ss.total - other.gross - rmdAmt - distributedCashEst);
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
    // Pass 1 — wdTrd estimate ignoring conversion taxes on taxable
    const wdTrdEst1  = _wdTrdEst(spendingGapEst, taxAvailEst);
    const piEst1     = other.taxableAmt + exemptIncomeEst + rmdAmt + wdTrdEst1 + annualDivEst + 0.5 * ss.total;
    const baseOrdEst1 = taxableSocialSecurity(piEst1, ss.total, filingStatus) + rmdAmt + other.taxableAmt + wdTrdEst1 + ordDivEst;
    const ceilForConv = effectiveBracketCeiling(plan.conversion.bracketCeiling, filingStatus) * inflationFactor;
    // Inherited pre-tax IRAs cannot be converted to Roth — exclude their tracked balance.
    const inheritedTradBal = inheritedState
      .filter(s => s.injected && s.remainingBal > 0 && s.ev.bucket === 'inheritedPreTaxIRA')
      .reduce((sum, s) => {
        const alive = s.ev.whose === 'A' ? aliveA : s.ev.whose === 'B' ? aliveB : (aliveA || aliveB);
        return alive ? sum + s.remainingBal : sum;
      }, 0);
    const maxConvEst  = Math.max(0, (trad - inheritedTradBal) * (1 + plan.assumptions.tradReturn) + contribToTrad - rmdAmt);
    // Senior bonus MAGI must include the conversion and LTCG from taxable withdrawals to correctly
    // model the OBBBA phase-out. Using pre-conversion ordinary income alone massively underestimates
    // MAGI (e.g. $38k vs $260k in taxfirst), causing the conversion to be oversized by ~the full
    // senior bonus. Two-pass: size conversion with no bonus to estimate post-conv MAGI, then resolve.
    const convEstNoSB = Math.min(maxConvEst, Math.max(0, ceilForConv - (baseOrdEst1 - stdD)));
    const qualDivEst = annualDivEst * taxableQualifiedPct;
    const gainFractionEst = taxAvailEst > 0 ? Math.max(0, Math.min(1, 1 - taxableBasis / taxAvailEst)) : 0;
    const ltcgEst = spendingGapEst * gainFractionEst + qualDivEst;
    const magiEstPostConv = baseOrdEst1 + convEstNoSB + ltcgEst;
    const seniorBonusEst = seniorBonusDeduction(filingStatus, filerAge, ageB, magiEstPostConv, calYear);
    const convEst    = Math.min(maxConvEst, Math.max(0, ceilForConv - (baseOrdEst1 - stdD - seniorBonusEst)));
    // Pass 2 — taxes on convEst also draw from taxable (payTaxFromBrokerage), leaving less for spending
    const convBracketRate = rateAtBracketCeiling(plan.conversion.bracketCeiling, filingStatus);
    const convTaxFromBrok = (plan.payTaxFromBrokerage ?? false)
      ? Math.min(convBracketRate * convEst, taxAvailEst) : 0;
    const taxAvailForSpendingEst = Math.max(0, taxAvailEst - convTaxFromBrok);
    const wdTrdEstForConv = _wdTrdEst(spendingGapEst, taxAvailForSpendingEst);
    const piForConv = other.taxableAmt + exemptIncomeEst + rmdAmt + wdTrdEstForConv + annualDivEst + 0.5 * ss.total;
    const taxableSSForConv = taxableSocialSecurity(piForConv, ss.total, filingStatus);
    const baseOrdIncForConv0 = taxableSSForConv + rmdAmt + other.taxableAmt + wdTrdEstForConv + ordDivEst;
    // Pass 3 — SS taxability feedback: if the conversion itself pushes PI above the 85% tier,
    // SS becomes more taxable, adding to ordIncome. Compute SS gain at full headroom and absorb
    // it into the base so rothConversion sizes conv to stay within the ceiling after the flip.
    const headroomNominal = Math.max(0, ceilForConv - (baseOrdIncForConv0 - stdD - seniorBonusEst));
    const piWithFullConv = other.taxableAmt + exemptIncomeEst + rmdAmt + wdTrdEstForConv + headroomNominal + annualDivEst + 0.5 * ss.total;
    const taxableSSWithFullConv = taxableSocialSecurity(piWithFullConv, ss.total, filingStatus);
    const ssGain = Math.max(0, taxableSSWithFullConv - taxableSSForConv);
    const baseOrdIncForConv = baseOrdIncForConv0 + ssGain;
    const policyConv = policyWindow?.convAmt;
    // True conversion cap: what's actually available in Trad AFTER growth + contrib
    // and AFTER RMD has been satisfied. Capping at the bare begin-of-year balance
    // (`trad`) let the optimizer pick conv values that, combined with rmd, exceeded
    // post-growth available — surfacing as a Trad OVERDRAW invariant violation.
    const override = opts?.returnOverrides?.[i];
    const gRateTaxYear  = override ?? plan.assumptions.taxableReturn;
    const gRateTradYear = override ?? plan.assumptions.tradReturn;
    const gRateRothYear = override ?? plan.assumptions.rothReturn;
    const maxConv = Math.max(0, (trad - inheritedTradBal) * (1 + gRateTradYear) + contribToTrad - rmdAmt);
    let conv: number;
    const eitherRetired = retiredA || retiredB;
    // Portfolio tax-exempt yield (munis held in brokerage). Gated on retirement like dividends.
    // Basis grows unconditionally (reinvested during accumulation too, same as annualDivForBasis).
    const exemptIntForBasis = taxable * taxableExemptYield;
    const exemptInt = eitherRetired ? exemptIntForBasis : 0;
    // Total §103 exempt interest: stream contributions + portfolio yield.
    // other.exemptInterest is gated by the stream's own age window (not retirement) by design.
    const exemptIncome = other.exemptInterest + exemptInt;
    if (eitherRetired && policyConv != null) {
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
        stdDeduction: stdD + seniorBonusEst,
      });
    }
    lifetimeConversion += conv;
    lifetimeConversionReal += conv / inflationFactor;

    // Pre-estimate inherited account income for gross-up loop sizing.
    // HSA: deterministic (event amount, no circularity). InheritedPreTaxIRA/Roth: use floor
    // from prior-year remainingBal (or ev.amount in the injection year) — overestimates in
    // tradfirst (strategy draws more than floor, supplement = 0) but exact in taxfirst.
    let lumpSumHSAIncomeEst = 0, lumpSumForcedTradDistEst = 0, lumpSumTaxFreeEst = 0;
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
      if (yearsElapsedEst < 0 || yearsElapsedEst >= 10) continue;
      const balEst = s.injected ? s.remainingBal : (evAge === s.ev.age ? s.ev.amount : 0);
      if (balEst <= 0) continue;
      const gRateEst = s.ev.bucket === 'inheritedPreTaxIRA' ? gRateTradYear : gRateRothYear;
      const floorEst = balEst * (1 + gRateEst) / (10 - yearsElapsedEst);
      if (s.ev.bucket === 'inheritedPreTaxIRA') lumpSumForcedTradDistEst += floorEst;
      else lumpSumTaxFreeEst += floorEst;
    }
    const lumpSumOrdIncomeEst = lumpSumHSAIncomeEst + lumpSumForcedTradDistEst;

    // Base ordinary income for withdrawal bracket-fill sizing (conv now known; wdTrd unknown).
    const piForWd = other.taxableAmt + exemptIncomeEst + rmdAmt + conv + lumpSumOrdIncomeEst + 0.5 * ss.total;
    const taxableSSForWd = taxableSocialSecurity(piForWd, ss.total, filingStatus);
    // Include ordinary dividends so bracketfill withdrawal sees the correct pre-wdTrd taxable income.
    const baseOrdIncForWd = taxableSSForWd + rmdAmt + conv + other.taxableAmt + lumpSumOrdIncomeEst
      + (eitherRetired ? taxable * taxableDivYield * (1 - taxableQualifiedPct) : 0);

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
    const tradAvail = Math.max(0, trad * (1 + gRateTradYear) + contribToTrad - rmdAmt - conv);
    const rothAvail = Math.max(0, roth * (1 + gRateRothYear) + contribToRoth + conv);

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
    let stateAmt = stateTax(plan.state, other.nonExempt + exemptInt * exemptStatePct + ordinaryDiv + lumpSumHSAIncomeEst, other.pensionAmt + lumpSumForcedTradDistEst, numPersons, inflationFactor, numAt65Plus, plan.customStateTaxRate); // initial pass; ltcg unknown until loop iter 1

    // 16 iterations: 8 was enough for IL/TX plans but CA/NY (which tax retirement + conversions)
    // need more to fully converge fedTax + irmaa + stateAmt jointly.
    for (let iter = 0; iter < 16; iter++) {
      // Cash needed from withdrawals: spending + all taxes/surcharges, less RMD/SS/other/inherited-dist cash.
      const taxBurden = prevTax + stateAmt + prevIRMAA + prevNIIT + prevACA;
      // When payTaxFromBrokerage is on, only pull the tax shortfall that income surplus cannot
      // cover. Pulling the full burden when income already covers taxes generates unnecessary
      // LTCG on the brokerage draw, which then increases the tax bill (NIIT, fed).
      const incomeAvailForTax = Math.max(0,
        ss.total + other.gross + distributedCash + rmdAmt + lumpSumOrdIncomeEst + lumpSumTaxFreeEst - netSpend
      );
      const taxFromBrok = (plan.payTaxFromBrokerage ?? false)
        ? Math.min(Math.max(0, taxBurden - incomeAvailForTax), taxAvail)
        : 0;
      taxFromBrokFinal = taxFromBrok;
      gap = Math.max(0, netSpend - ss.total - other.gross - distributedCash - rmdAmt - lumpSumOrdIncomeEst - lumpSumTaxFreeEst + taxBurden - taxFromBrok);
      const w = activePolicy
        ? applyBlendPolicy({ policy: activePolicy, ageA, gap, taxable: taxAvail - taxFromBrok, traditional: tradAvail, roth: rothAvail })
        : applyWithdrawalOrder({
            strategy: plan.withdrawalStrategy,
            gap, taxable: taxAvail - taxFromBrok, traditional: tradAvail, roth: rothAvail,
            rmd: rmdAmt, baseOrdinaryIncome: baseOrdIncForWd,
            bracketCeiling: effectiveBracketCeiling(plan.withdrawalBracketCeiling, filingStatus),
            stdD: stdD + seniorBonus, inflationFactor,
          });
      wdTax = w.wdTax + taxFromBrok; wdTrd = w.wdTrd; wdRth = w.wdRth;
      lastSpill = w.spill;
      if (w.bracketOverridden) overrideFiredThisYear = true;

      const ltcg = wdTax * gainFraction + qualifiedDiv;
      // SS taxability via IRC §86 provisional-income tiers (replaces flat 0.85).
      // annualDiv and §103 exempt interest count toward provisional income per IRC §86.
      const provisionalIncome = other.taxableAmt + exemptIncome + wdTrd + rmdAmt + conv + lumpSumOrdIncomeEst + annualDiv + 0.5 * ss.total;
      const taxableSS = taxableSocialSecurity(provisionalIncome, ss.total, filingStatus);
      // ordinaryDiv is ordinary income; qualifiedDiv is captured in ltcg (LTCG stack path).
      const ordIncome = taxableSS + other.taxableAmt + wdTrd + rmdAmt + conv + lumpSumOrdIncomeEst + ordinaryDiv;
      const magi = ordIncome + ltcg;  // NIIT + OBBBA senior bonus: exempt interest excluded
      const surchargeMAGI = magi + exemptIncome;  // IRMAA (§1395r(i)(4)) + ACA (§36B(d)(2)(B))
      seniorBonus = seniorBonusDeduction(filingStatus, filerAge, ageB, magi, calYear);
      const t = yearFederalTax({
        filingStatus,
        inflationFactor,
        ordinaryIncome: ordIncome,
        ltcgIncome: ltcg,
        standardDeduction: stdD + seniorBonus,
      });
      fedTax = t.fedTax; ordIncomeFinal = ordIncome; ltcgFinal = ltcg; effRate = t.effRate; marginalRate = t.marginalRate;
      taxableSSFinal = taxableSS;
      // IRMAA 2-year lookback: year i's surcharge is based on surchargeMAGI from year i-2.
      // For the first two years, fall back to the current year's surchargeMAGI.
      const irmaaMAGI = i >= 2 ? surchargeMagiHistory[i - 2] : surchargeMAGI;
      irmaaMAGIFinal = irmaaMAGI;
      const irmaaFS = i >= 2 ? filingStatusHistory[i - 2] : filingStatus;
      irmaa = numAt65Plus > 0 ? annualIRMAACost(irmaaMAGI, inflationFactor, numAt65Plus, irmaaFS) : 0;
      niit = annualNIIT(magi, ltcg, filingStatus);

      // Refine state tax to include retirement distributions for states that tax them.
      // Include stateAmt in the convergence check — for CA/NY plans, state tax is a
      // material gross-up term and ignoring its delta caused ~$15 spending shortfalls
      // (caught by Layer-1's SPENDING COVERAGE invariant on planG_californiaCouple).
      // ltcg goes into nonExemptOrdinaryIncome so IL (retirementExempt:true) still taxes it —
      // IL exempts retirement distributions but NOT capital gains.
      stateAmt = stateTax(plan.state, other.nonExempt + exemptInt * exemptStatePct + ordinaryDiv + ltcg + lumpSumHSAIncomeEst, wdTrd + rmdAmt + conv + other.pensionAmt + lumpSumForcedTradDistEst, numPersons, inflationFactor, numAt65Plus, plan.customStateTaxRate);

      // ACA marketplace premium (pre-Medicare years when the user has opted in).
      acaPremiumYear = 0;
      if (plan.assumptions.modelACA && plan.assumptions.acaBenchmarkPremium > 0) {
        const acaStartA = plan.assumptions.acaStartAgeA ?? retireAgeA;
        const acaStartB = plan.assumptions.acaStartAgeB ?? retireAgeB;
        const preMedicareCount = (aliveA && ageA >= acaStartA && ageA < 65 ? 1 : 0) + (aliveB && ageB !== undefined && ageB >= acaStartB && ageB < 65 ? 1 : 0);
        if (preMedicareCount > 0) {
          const scaledPremium = plan.assumptions.acaBenchmarkPremium * inflationFactor * preMedicareCount;
          acaPremiumYear = plan.assumptions.acaNoSubsidy
            ? scaledPremium  // full cost, no APTC applied
            : acaNetPremium({ magi: surchargeMAGI + (ss.total - taxableSS), householdSize: plan.assumptions.acaHouseholdSize, annualBenchmarkPremium: scaledPremium, inflationFactor });
        }
      }

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
    if (activePolicy) {
      const bw = findWindow(activePolicy, ageA);
      if (bw && bw.pctTraditional === 0 && wdTrd < 100) wdTrd = 0;
    }

    // Per-year decision attribution (gated on opts.explain so the optimizer never pays for it).
    // Build after the de-minimis clamp so notes cite the same values that appear in the row.
    if (opts?.explain) {
      const isActiveBracketfill = !activePolicy && plan.withdrawalStrategy === 'bracketfill';
      const wdBracketCeilNominal = effectiveBracketCeiling(plan.withdrawalBracketCeiling, filingStatus) * inflationFactor;
      // Mirror roomInBracket from withdrawal.ts:58 — uses the withdrawal ceiling, not ceilForConv.
      const bracketfillRoom = isActiveBracketfill
        ? Math.max(0, wdBracketCeilNominal + (stdD + seniorBonus) - baseOrdIncForWd - wdTrd)
        : 0;
      const activeWindow = activePolicy ? findWindow(activePolicy, ageA) : undefined;
      const spillWindow = activeWindow
        ? { pctTaxable: activeWindow.pctTaxable, pctTraditional: activeWindow.pctTraditional, pctRoth: activeWindow.pctRoth }
        : undefined;
      const notes = buildYearDecisions({
        year: i + 1,
        ageA,
        conv,
        convPolicyZero: policyConv === 0,
        headroomNominal,
        maxConv,
        ceilForConv,
        baseOrdIncome: baseOrdIncForConv,
        tradBalance: maxConv,
        wdTax: wdTax - taxFromBrokFinal,  // show only the withdrawal portion, not the tax-from-brok pull
        wdTrd,
        wdRth,
        gap,
        rmdAmt,
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

    taxable = Math.max(0, taxable * (1 + gRateTaxYear) + contribToTax - wdTax - distributedCash);
    // Split withdrawals and conversions pro-rata by each person's trad balance.
    // Combined max(0, ...) preserves the single-pool mass-balance invariant; tradANext
    // is clamped to [0, tradCombined] so tradA+tradB == tradCombined exactly even when
    // one person's RMD rate differs from the other's (different ages → per-person overdraft).
    const totalTradBeg = tradA + tradB;
    const ratioA = totalTradBeg > 0 ? tradA / totalTradBeg : 0;
    const tradANext = tradA * (1 + gRateTradYear) + cA.trad - rmdA - (wdTrd + conv) * ratioA;
    const tradCombined = Math.max(0, totalTradBeg * (1 + gRateTradYear) + contribToTrad - rmdAmt - wdTrd - conv);
    tradA = tradCombined > 0 ? Math.max(0, Math.min(tradCombined, tradANext)) : 0;
    tradB = tradCombined - tradA;
    roth  = Math.max(0, roth  * (1 + gRateRothYear) + contribToRoth - wdRth + conv);
    taxableBasis = Math.max(0, taxableBasis + contribToTax + (annualDivForBasis - divDistributed) + (exemptIntForBasis - exemptDistributed) - wdTax * (1 - gainFraction));

    // One-time income events: inject directly into target account.
    // Amount is stored in plan-start-year (today's) dollars — inflate to nominal at event year,
    // consistent with how income stream annualAmounts are treated. Taxable bucket gets full
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
        taxable += ev.amount; taxableBasis += ev.amount;
        lumpSumInjectTaxable += ev.amount;
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

    // Inherited IRA/Roth 10-year depletion (SECURE Act). Runs after withdrawal balances are
    // updated so proportional-credit uses current-year host balance post-strategy.
    let lumpSumForcedTradDist = 0, lumpSumForcedTradDistA = 0, lumpSumForcedTradDistB = 0;
    let lumpSumForcedRothDist = 0;
    for (const s of inheritedState) {
      if (!s.injected || s.remainingBal <= 0) continue;
      const personAge = s.ev.whose === 'A' ? ageA : s.ev.whose === 'B' ? (ageB ?? -1) : ageA;
      const personAlive = s.ev.whose === 'A' ? aliveA : s.ev.whose === 'B' ? aliveB : (aliveA || aliveB);
      if (!personAlive) continue;
      const yearsElapsed = personAge - s.ev.age;
      if (yearsElapsed < 0 || yearsElapsed >= 10) continue;

      const gRate = s.ev.bucket === 'inheritedPreTaxIRA' ? gRateTradYear : gRateRothYear;
      s.remainingBal *= (1 + gRate);

      const yearsRemaining = 10 - yearsElapsed;
      const floor = s.remainingBal / yearsRemaining;

      const hostBal = s.ev.bucket === 'inheritedPreTaxIRA'
        ? (s.ev.whose === 'B' ? tradB : tradA)
        : roth;
      const wdFromHost = s.ev.bucket === 'inheritedPreTaxIRA' ? wdTrd : wdRth;
      const proportionalDepleted = hostBal > 0
        ? Math.min(s.remainingBal, wdFromHost * (s.remainingBal / hostBal))
        : 0;
      s.remainingBal -= proportionalDepleted;

      const supplement = yearsRemaining === 1
        ? s.remainingBal
        : Math.max(0, floor - proportionalDepleted);
      s.remainingBal = Math.max(0, s.remainingBal - supplement);

      if (s.ev.bucket === 'inheritedPreTaxIRA') {
        lumpSumForcedTradDist += supplement;
        if (s.ev.whose === 'B') lumpSumForcedTradDistB += supplement;
        else lumpSumForcedTradDistA += supplement;
      } else lumpSumForcedRothDist += supplement;
    }

    const lumpSumOrdIncome = lumpSumHSAIncome + lumpSumForcedTradDist;
    const lumpSumTaxFreeCash = lumpSumForcedRothDist;

    // Correct ordIncome/tax/state for cases where actual != estimate (e.g. tradfirst zeroed supplement).
    if (lumpSumOrdIncome !== lumpSumOrdIncomeEst || lumpSumTaxFreeCash !== lumpSumTaxFreeEst) {
      const ordIncomeActual = ordIncomeFinal - lumpSumOrdIncomeEst + lumpSumOrdIncome;
      seniorBonus = seniorBonusDeduction(filingStatus, filerAge, ageB, ordIncomeActual + ltcgFinal, calYear);
      const tCorrected = yearFederalTax({ filingStatus, inflationFactor, ordinaryIncome: ordIncomeActual, ltcgIncome: ltcgFinal, standardDeduction: stdD + seniorBonus });
      fedTax = tCorrected.fedTax;
      ordIncomeFinal = ordIncomeActual;
      effRate = tCorrected.effRate;
      marginalRate = tCorrected.marginalRate;
      stateAmt = stateTax(
        plan.state,
        other.nonExempt + exemptInt * exemptStatePct + ltcgFinal + lumpSumHSAIncome,
        wdTrd + rmdAmt + conv + other.pensionAmt + lumpSumForcedTradDist,
        numPersons, inflationFactor, numAt65Plus, plan.customStateTaxRate,
      );
    }

    // Move supplemental forced dist cash from host account to taxable.
    if (lumpSumForcedTradDistA > 0) {
      tradA   = Math.max(0, tradA - lumpSumForcedTradDistA);
      taxable += lumpSumForcedTradDistA;
      taxableBasis += lumpSumForcedTradDistA;
    }
    if (lumpSumForcedTradDistB > 0) {
      tradB   = Math.max(0, tradB - lumpSumForcedTradDistB);
      taxable += lumpSumForcedTradDistB;
      taxableBasis += lumpSumForcedTradDistB;
    }
    if (lumpSumTaxFreeCash > 0) {
      roth    = Math.max(0, roth - lumpSumTaxFreeCash);
      taxable += lumpSumTaxFreeCash;
      taxableBasis += lumpSumTaxFreeCash;
    }

    // Surplus sweep: when SS + other income + RMD exceed spending + all taxes, the leftover
    // cash is already received and taxed — sweep it into the taxable account at full basis.
    const cashSurplus = Math.max(0, ss.total + other.gross + distributedCash + rmdAmt - netSpend - fedTax - stateAmt - irmaa - niit - acaPremiumYear);
    if (cashSurplus > 0) { taxable += cashSurplus; taxableBasis += cashSurplus; }

    const endTotal = taxable + tradA + tradB + roth;
    // Depletion is "could not fund the year's spending need from the portfolio", NOT just
    // "endTotal reached exactly zero". Each bucket's update is max(0, bal*g - wd), and wd is
    // capped at bal, so residuals decay geometrically toward zero but never quite hit it —
    // the old `endTotal <= 0` check failed to fire and the plan appeared to survive forever
    // while silently failing to pay expenses.
    if (retired && !ranOut) {
      const fundedFromPortfolio = wdTax + wdTrd + wdRth;
      const neededFromPortfolio = gap;  // gap is netSpend + taxes - SS - other - RMD
      if (neededFromPortfolio - fundedFromPortfolio > 1) ranOut = true;
    }

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
      fedTax,
      stateTaxAmt: stateAmt,
      irmaa,
      niit,
      effRate,
      marginalRate,
      stateMarginalRate,
      stdDeduction: stdD + seniorBonus,
      seniorBonus,
      magi: ordIncomeFinal + ltcgFinal,
      acaMagi: ordIncomeFinal + ltcgFinal + exemptIncome + (ss.total - taxableSSFinal),
      irmaaMagi: irmaaMAGIFinal,
      acaPremium: acaPremiumYear,
      lumpSumInjectTaxable, lumpSumInjectTrad, lumpSumInjectRoth,
      lumpSumOrdinaryIncome: lumpSumOrdIncome,
      lumpSumForcedTradDist,
      lumpSumForcedRothDist,
      cashSurplus,
      begTaxable, begTraditional: begTrad, begRoth,
      endTaxable: taxable, endTraditional: tradA + tradB, endRoth: roth,
      endTotal,
      endTaxableBasis: taxableBasis,
      endTaxAdjusted: taxAdjustedValue(taxable, taxableBasis, tradA + tradB, roth, taxAdjRates.ordRate, taxAdjRates.ltcgRate),
      ranOut,
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
