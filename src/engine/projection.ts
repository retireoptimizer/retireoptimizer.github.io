import type { Plan, IncomeStream, ExpenseStream, LumpSumEvent } from '../schemas/plan';
import { householdTotals, resolveGrowthRate } from '../schemas/plan';
import { householdPlanToAgeA } from './planInputKey';
import { filingStatusForYear, type FilingStatus } from './filingStatus';
import { rmdDivisor, rmdStartAgeForDob } from './rmd';
import { householdSS } from './socialSecurity';
import { yearFederalTax, standardDeduction, taxableSocialSecurity, seniorBonusDeduction } from './tax';
import { FED_BRACKETS_MFJ, FED_BRACKETS_SINGLE } from './taxConstants';
import { rothConversion } from './conversion';
import { applyWithdrawalOrder, applyBlendPolicy } from './withdrawal';
import type { BlendPolicy } from './blendPolicy';
import { findWindow } from './blendPolicy';
import { annualIRMAACost } from './irmaa';
import { annualNIIT } from './niit';
import { stateTax, STATE_PROFILES } from './stateTax';
import { acaNetPremium } from './aca';

export interface ProjectionRow {
  year: number;            // 1-indexed plan year
  ageA: number;
  ageB?: number;
  phase: 'Accum.' | 'SemiRetire' | 'Retire' | 'Survivor' | 'Past Plan';
  filingStatus: FilingStatus;
  inflationFactor: number;
  // Contributions
  contribA: number;
  contribB: number;
  // Income
  ssA: number;
  ssB: number;
  totalSS: number;
  otherIncome: number;     // pension, wages, rental, etc. (taxable portion summed)
  otherIncomeNonExempt: number; // subset of otherIncome that is NOT IL-exempt (wages, rental)
  // Spending
  netSpend: number;
  // Withdrawals
  wdTax: number;
  wdTrd: number;
  wdRth: number;
  totalWD: number;
  // Tax / conversions
  rmd: number;
  rothConv: number;
  ordIncome: number;       // taxable ordinary income (pre-deduction gross)
  ltcg: number;
  ordinaryDiv: number;     // ordinary (non-qualified) dividends from taxable account
  qualifiedDiv: number;    // qualified dividends from taxable account (subset of ltcg)
  fedTax: number;
  stateTaxAmt: number;
  irmaa: number;
  niit: number;
  effRate: number;
  marginalRate: number;         // top federal bracket rate on last dollar of taxable ordinary income
  stateMarginalRate: number;    // flat state rate when taxable state income > 0, else 0
  stdDeduction: number;  // base standard deduction + senior bonus combined
  seniorBonus: number;   // senior bonus deduction portion only ($6k/person 65+, OBBBA)
  magi: number;          // MAGI = ordIncome + ltcg (pre-deduction; IRMAA definition)
  acaMagi: number;       // ACA MAGI = magi + non-taxable SS (IRS ACA definition)
  irmaaMagi: number;     // IRMAA MAGI actually used (2-year lookback; same as magi[i-2])
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
  yearsCovered: number;
  ranOut: boolean;          // true if portfolio hit zero before plan-to age
  overrideEvents: { age: number; reason: string }[];  // bracket-fill ceiling overrides
}

const ageAt = (dob: string, planStartYear: number): number => {
  const birthYear = parseInt(dob.slice(0, 4), 10);
  return planStartYear - birthYear;
};

const sumIncomeStreams = (
  streams: IncomeStream[],
  ageA: number,
  ageB: number | undefined,
  aliveA: boolean,
  aliveB: boolean,
  yearIndex: number,
  inflation: number,
): { taxableAmt: number; nonExempt: number; pensionAmt: number } => {
  let taxableAmt = 0, nonExempt = 0, pensionAmt = 0;
  for (const s of streams) {
    if (s.type === 'SS') continue; // SS handled separately via PIA
    const personAge = s.whose === 'A' ? ageA : s.whose === 'B' ? (ageB ?? -1) : ageA;
    const personAlive = s.whose === 'A' ? aliveA : s.whose === 'B' ? aliveB : (aliveA || aliveB);
    if (!personAlive) continue;
    if (personAge < s.startAge || personAge > s.stopAge) continue;
    const amount = s.annualAmount * Math.pow(1 + resolveGrowthRate(s.growthPct, inflation), yearIndex);
    const taxablePortion = amount * s.taxablePct;
    taxableAmt += taxablePortion;
    const stf = s.stateTaxablePct ?? 1;
    if (s.type === 'Other') {
      nonExempt += taxablePortion * stf;
    } else if (s.type === 'Pension' || s.type === 'Annuity') {
      // IL exempts pension/annuity; CA/NY do not — tracked separately so stateTax()
      // can apply per-state retirementExempt logic alongside IRA/401(k) distributions.
      pensionAmt += taxablePortion * stf;
    }
  }
  return { taxableAmt, nonExempt, pensionAmt };
};

const sumExpenseStreams = (
  streams: ExpenseStream[],
  ageA: number,
  ageB: number | undefined,
  yearIndex: number,
  planInflation: number,
  cumulativeInflationFactor?: number,
  retiredA = true,
  retiredB = true,
): number => {
  let total = 0;
  for (const e of streams) {
    // Gate by whose retirement: A-tagged flows when A retires, B-tagged when B retires,
    // Household when EITHER retires (working person's contributions offset the draw).
    const eligible = e.whose === 'A' ? retiredA : e.whose === 'B' ? retiredB : (retiredA || retiredB);
    if (!eligible) continue;
    const personAge = e.whose === 'A' ? ageA : e.whose === 'B' ? (ageB ?? -1) : ageA;
    if (personAge < e.startAge || personAge > e.stopAge) continue;
    // CPI-mode streams (mode:'cpi') use the actual cumulative inflation factor in Monte Carlo
    // so they track stochastic CPI rather than the fixed planning rate. All other modes
    // compound at their own resolved rate as before.
    const isCpiIndexed = cumulativeInflationFactor !== undefined && e.inflationPct.mode === 'cpi';
    const growthFactor = isCpiIndexed
      ? cumulativeInflationFactor
      : Math.pow(1 + resolveGrowthRate(e.inflationPct, planInflation), yearIndex);
    total += e.annualAmount * growthFactor;
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
}

/** Map a stored MFJ bracket-fill ceiling to its Single equivalent by bracket index. */
function effectiveBracketCeiling(mfjCeiling: number, fs: FilingStatus): number {
  if (fs === 'MFJ') return mfjCeiling;
  const idx = FED_BRACKETS_MFJ.findIndex(([top]) => top >= mfjCeiling);
  if (idx < 0) return FED_BRACKETS_SINGLE[FED_BRACKETS_SINGLE.length - 1][0];
  return FED_BRACKETS_SINGLE[Math.min(idx, FED_BRACKETS_SINGLE.length - 1)][0];
}

export function runProjection(plan: Plan, opts?: ProjectionOptions): ProjectionResult {
  const activePolicy: BlendPolicy | undefined = opts?.policy ?? (plan.customPolicy as BlendPolicy | undefined);
  const startYear = new Date().getFullYear();
  const startAgeA = ageAt(plan.personA.dob, startYear);
  const startAgeB = plan.personB ? ageAt(plan.personB.dob, startYear) : undefined;
  const passingA = plan.personA.passingAge;
  const passingB = plan.personB?.passingAge;
  const retireAgeA = plan.personA.retirementAge;
  const retireAgeB = plan.personB?.retirementAge ?? retireAgeA;
  const planToAge = householdPlanToAgeA(plan);

  const totals = householdTotals(plan.portfolio);
  let taxable = totals.taxable;
  let tradA = plan.portfolio.personA.traditional;
  let tradB = plan.portfolio.personB?.traditional ?? 0;
  let roth = totals.roth;
  const pfA = plan.portfolio.personA;
  const pfB = plan.portfolio.personB;
  let taxableBasis = (pfA.taxableBasis ?? 0) + (pfB?.taxableBasis ?? 0);

  const rows: ProjectionRow[] = [];
  let lifetimeFedTax = 0, lifetimeRMD = 0, lifetimeConversion = 0;
  let lifetimeFedTaxReal = 0, lifetimeRMDReal = 0, lifetimeConversionReal = 0;
  let ranOut = false;

  const inheritedState: Array<{ ev: LumpSumEvent; remainingBal: number; injected: boolean }> =
    (plan.lumpSumEvents ?? [])
      .filter(ev => ev.bucket === 'inheritedPreTaxIRA' || ev.bucket === 'inheritedRoth')
      .map(ev => ({ ev, remainingBal: 0, injected: false }));
  // Per-year MAGI + filing-status history for IRMAA 2-year lookback.
  const magiHistory: number[] = [];
  const filingStatusHistory: FilingStatus[] = [];

  const maxYears = Math.min(75, planToAge - startAgeA + 1);
  const rmdStartAgeA = rmdStartAgeForDob(plan.personA.dob);
  const rmdStartAgeB = plan.personB ? rmdStartAgeForDob(plan.personB.dob) : rmdStartAgeA;
  const planInflation = plan.assumptions.inflation;
  const taxableDivYield    = plan.assumptions.taxableDivYield    ?? 0;
  const taxableQualifiedPct = plan.assumptions.taxableQualifiedPct ?? 0.80;
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
    if (!aliveA && !aliveB) phase = 'Past Plan';
    else if (!aliveA || !aliveB) phase = 'Survivor';
    else if (retired) phase = 'Retire';
    else if (retiredA || retiredB) phase = 'SemiRetire';
    else phase = 'Accum.';

    // Contributions during working years — each person's contribution grows at their
    // own rate (contribGrowth lives on the per-person portfolio).
    const cgFactorA = Math.pow(1 + resolveGrowthRate(pfA.contribGrowth, planInflation), i);
    const cgFactorB = pfB ? Math.pow(1 + resolveGrowthRate(pfB.contribGrowth, planInflation), i) : 1;
    const contribA = (!retiredA && aliveA) ? pfA.annualContribution * cgFactorA : 0;
    const contribB = (!retiredB && aliveB && plan.personB && pfB) ? pfB.annualContribution * cgFactorB : 0;

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
      ssStreams: plan.incomeStreams,
      yearIndex: i,
    });

    // Other income streams
    const other = sumIncomeStreams(plan.incomeStreams, ageA, ageB, aliveA, aliveB, i, planInflation);

    // Expenses start when either person retires (semi-retirement or full retirement).
    // Per-whose gate inside sumExpenseStreams: A-tagged on retiredA, B-tagged on retiredB,
    // Household on retiredA||retiredB. Working person's contributions offset the portfolio draw.
    const netSpend = (retiredA || retiredB) ? sumExpenseStreams(
      plan.expenseStreams, ageA, ageB, i,
      plan.assumptions.inflation,
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
    // Approximate SS taxability for conv sizing (wdTrd=0; withdrawals unknown pre-loop).
    const piForConv = other.taxableAmt + rmdAmt + 0.5 * ss.total;
    const taxableSSForConv = taxableSocialSecurity(piForConv, ss.total, filingStatus);
    const baseOrdIncForConv = taxableSSForConv + rmdAmt + other.taxableAmt;
    const policyWindow = activePolicy ? findWindow(activePolicy, ageA) : undefined;
    const policyConv = policyWindow?.convAmt;
    // True conversion cap: what's actually available in Trad AFTER growth + contrib
    // and AFTER RMD has been satisfied. Capping at the bare begin-of-year balance
    // (`trad`) let the optimizer pick conv values that, combined with rmd, exceeded
    // post-growth available — surfacing as a Trad OVERDRAW invariant violation.
    const override = opts?.returnOverrides?.[i];
    const gRateTaxYear  = override ?? plan.assumptions.taxableReturn;
    const gRateTradYear = override ?? plan.assumptions.tradReturn;
    const gRateRothYear = override ?? plan.assumptions.rothReturn;
    const contribToTradEarly = contribA * pfA.contribSplit.traditional + contribB * (pfB?.contribSplit.traditional ?? 0);
    const maxConv = Math.max(0, trad * (1 + gRateTradYear) + contribToTradEarly - rmdAmt);
    let conv: number;
    const eitherRetired = retiredA || retiredB;
    if (eitherRetired && policyConv != null) {
      conv = Math.min(maxConv, policyConv * inflationFactor);
    } else {
      conv = rothConversion({
        params: { ...plan.conversion, bracketCeiling: effectiveBracketCeiling(plan.conversion.bracketCeiling, filingStatus) },
        ageA,
        retired: eitherRetired,
        inflationFactor,
        traditionalBalance: maxConv,
        baseOrdinaryIncome: baseOrdIncForConv,
        stdDeduction: stdD,
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
    const piForWd = other.taxableAmt + rmdAmt + conv + lumpSumOrdIncomeEst + 0.5 * ss.total;
    const taxableSSForWd = taxableSocialSecurity(piForWd, ss.total, filingStatus);
    const baseOrdIncForWd = taxableSSForWd + rmdAmt + conv + other.taxableAmt + lumpSumOrdIncomeEst;

    // Per-bucket "available to withdraw" caps. All three buckets are debited by the
    // end-of-year update `bucket = max(0, bucket*(1+g) + contrib +/- credits - withdrawal)`,
    // so the withdrawal must respect what that update would actually leave non-negative —
    // otherwise wdX exceeds the cap, the bucket clamps to zero, and the projection silently
    // funds the spending gap with phantom cash (the historic bug class). Same cap formula
    // applied to both withdrawal code paths (legacy preset + custom blend policy).
    // gRateThisYear + contribToTradEarly are declared earlier (for the conv cap).
    const contribToTaxEarly = contribA * pfA.contribSplit.taxable + contribB * (pfB?.contribSplit.taxable ?? 0);
    const contribToRothEarly = contribA * pfA.contribSplit.roth + contribB * (pfB?.contribSplit.roth ?? 0);
    // Annual dividends/interest from taxable account.
    // Basis grows unconditionally (dividends are reinvested during accumulation too).
    // Tax impact is gated on retirement — the engine does not model working-year income taxes.
    const annualDivForBasis = taxable * taxableDivYield;
    const annualDiv    = eitherRetired ? annualDivForBasis : 0;
    const ordinaryDiv  = annualDiv * (1 - taxableQualifiedPct);
    const qualifiedDiv = annualDiv * taxableQualifiedPct;
    const taxAvail = Math.max(0, taxable * (1 + gRateTaxYear) + contribToTaxEarly);
    // Include annualDiv in basis: reinvested dividends reduce gain fraction for any withdrawal this year.
    const preBasisThisYear = taxableBasis + contribToTaxEarly + annualDiv;
    const gainFraction = taxAvail > 0 ? Math.max(0, Math.min(1, 1 - preBasisThisYear / taxAvail)) : 0;
    const tradAvail = Math.max(0, trad * (1 + gRateTradYear) + contribToTradEarly - rmdAmt - conv);
    const rothAvail = Math.max(0, roth * (1 + gRateRothYear) + contribToRothEarly + conv);

    // Gross-up loop: solve withdrawals to fund netSpend + fedTax + state + irmaa.
    // SS, other income, RMD, and conversions (which come from Trad → Roth, no cash to user)
    // are accounted for as resources. Conversion CREATES tax; loop sizes withdrawals to cover it.
    let prevTax = 0, prevIRMAA = 0, prevNIIT = 0, prevStateAmt = 0, prevACA = 0;
    let wdTax = 0, wdTrd = 0, wdRth = 0, fedTax = 0, ordIncomeFinal = 0, ltcgFinal = 0, effRate = 0, marginalRate = 0;
    let irmaa = 0, niit = 0, acaPremiumYear = 0, taxableSSFinal = 0, irmaaMAGIFinal = 0;
    let gap = 0;
    let overrideFiredThisYear = false;

    const numAt65Plus = (aliveA && ageA >= 65 ? 1 : 0) + (aliveB && ageB !== undefined && ageB >= 65 ? 1 : 0);
    // State tax — depends on state profile.
    // For IL/TX/FL/WA: only non-retirement non-exempt income is taxable.
    // For CA/NY: retirement withdrawals + conversions are also taxable.
    // We compute it once per iter pass (after withdrawal sizing) to capture CA/NY retirement-tax dependence.
    const numPersons = (aliveA ? 1 : 0) + (aliveB ? 1 : 0);
    let stateAmt = stateTax(plan.state, other.nonExempt + ordinaryDiv + lumpSumHSAIncomeEst, other.pensionAmt + lumpSumForcedTradDistEst, numPersons, inflationFactor, numAt65Plus, plan.customStateTaxRate); // initial pass; ltcg unknown until loop iter 1

    // 16 iterations: 8 was enough for IL/TX plans but CA/NY (which tax retirement + conversions)
    // need more to fully converge fedTax + irmaa + stateAmt jointly.
    for (let iter = 0; iter < 16; iter++) {
      // Cash needed from withdrawals: spending + all taxes/surcharges, less RMD/SS/other/inherited-dist cash.
      const taxBurden = prevTax + stateAmt + prevIRMAA + prevNIIT + prevACA;
      // When payTaxFromBrokerage is on, pull the tax portion from brokerage first so the
      // withdrawal strategy only needs to cover spending. Falls back to normal when brokerage is depleted.
      const taxFromBrok = (plan.payTaxFromBrokerage ?? false) ? Math.min(taxBurden, taxAvail) : 0;
      gap = Math.max(0, netSpend - ss.total - other.taxableAmt - rmdAmt - lumpSumOrdIncomeEst - lumpSumTaxFreeEst + taxBurden - taxFromBrok);
      const w = activePolicy
        ? applyBlendPolicy({ policy: activePolicy, ageA, gap, taxable: taxAvail - taxFromBrok, traditional: tradAvail, roth: rothAvail })
        : applyWithdrawalOrder({
            strategy: plan.withdrawalStrategy,
            gap, taxable: taxAvail - taxFromBrok, traditional: tradAvail, roth: rothAvail,
            rmd: rmdAmt, baseOrdinaryIncome: baseOrdIncForWd,
            bracketCeiling: effectiveBracketCeiling(plan.withdrawalBracketCeiling, filingStatus),
            stdD, inflationFactor,
          });
      wdTax = w.wdTax + taxFromBrok; wdTrd = w.wdTrd; wdRth = w.wdRth;
      if (w.bracketOverridden) overrideFiredThisYear = true;

      const ltcg = wdTax * gainFraction + qualifiedDiv;
      // SS taxability via IRC §86 provisional-income tiers (replaces flat 0.85).
      // annualDiv (ordinary + qualified) counts toward provisional income per IRC §86.
      const provisionalIncome = other.taxableAmt + wdTrd + rmdAmt + conv + lumpSumOrdIncomeEst + annualDiv + 0.5 * ss.total;
      const taxableSS = taxableSocialSecurity(provisionalIncome, ss.total, filingStatus);
      // ordinaryDiv is ordinary income; qualifiedDiv is captured in ltcg (LTCG stack path).
      const ordIncome = taxableSS + other.taxableAmt + wdTrd + rmdAmt + conv + lumpSumOrdIncomeEst + ordinaryDiv;
      const magi = ordIncome + ltcg;
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
      // IRMAA 2-year lookback: year i's surcharge is based on MAGI from year i-2.
      // For the first two years, fall back to the current year's MAGI.
      const irmaaMAGI = i >= 2 ? magiHistory[i - 2] : magi;
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
      stateAmt = stateTax(plan.state, other.nonExempt + ordinaryDiv + ltcg + lumpSumHSAIncomeEst, wdTrd + rmdAmt + conv + other.pensionAmt + lumpSumForcedTradDistEst, numPersons, inflationFactor, numAt65Plus, plan.customStateTaxRate);

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
            : acaNetPremium({ magi: magi + (ss.total - taxableSS), householdSize: plan.assumptions.acaHouseholdSize, annualBenchmarkPremium: scaledPremium });
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

    // Update balances. Withdrawals were sized to cover all cash needs.
    // Contributions are split per-person using each person's own contribSplit.
    const begTaxable = taxable, begTrad = trad, begRoth = roth;
    const splitAtoTax = pfA.contribSplit.taxable, splitAtoTrad = pfA.contribSplit.traditional, splitAtoRoth = pfA.contribSplit.roth;
    const splitBtoTax = pfB?.contribSplit.taxable ?? 0, splitBtoTrad = pfB?.contribSplit.traditional ?? 0, splitBtoRoth = pfB?.contribSplit.roth ?? 0;
    const contribToTax = contribA * splitAtoTax + contribB * splitBtoTax;
    const contribToRoth = contribA * splitAtoRoth + contribB * splitBtoRoth;

    taxable = Math.max(0, taxable * (1 + gRateTaxYear) + contribToTax - wdTax);
    // Split withdrawals and conversions pro-rata by each person's trad balance.
    // Combined max(0, ...) preserves the single-pool mass-balance invariant; tradANext
    // is clamped to [0, tradCombined] so tradA+tradB == tradCombined exactly even when
    // one person's RMD rate differs from the other's (different ages → per-person overdraft).
    const totalTradBeg = tradA + tradB;
    const ratioA = totalTradBeg > 0 ? tradA / totalTradBeg : 0;
    const tradANext = tradA * (1 + gRateTradYear) + contribA * splitAtoTrad - rmdA - (wdTrd + conv) * ratioA;
    const tradCombined = Math.max(0, totalTradBeg * (1 + gRateTradYear) + contribA * splitAtoTrad + contribB * splitBtoTrad - rmdAmt - wdTrd - conv);
    tradA = tradCombined > 0 ? Math.max(0, Math.min(tradCombined, tradANext)) : 0;
    tradB = tradCombined - tradA;
    roth  = Math.max(0, roth  * (1 + gRateRothYear) + contribToRoth - wdRth + conv);
    taxableBasis = Math.max(0, taxableBasis + contribToTax + annualDivForBasis - wdTax * (1 - gainFraction));

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
        other.nonExempt + ltcgFinal + lumpSumHSAIncome,
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
    const cashSurplus = Math.max(0, ss.total + other.taxableAmt + rmdAmt - netSpend - fedTax - stateAmt - irmaa - niit - acaPremiumYear);
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
    magiHistory.push(ordIncomeFinal + ltcgFinal);  // ordIncomeFinal includes lumpSumOrdIncome for IRMAA lookback
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
      ssA: ss.ssA, ssB: ss.ssB, totalSS: ss.total,
      otherIncome: other.taxableAmt,
      otherIncomeNonExempt: other.nonExempt,
      netSpend,
      wdTax, wdTrd, wdRth,
      totalWD: wdTax + wdTrd + wdRth,
      rmd: rmdAmt,
      rothConv: conv,
      ordIncome: ordIncomeFinal,
      ltcg: ltcgFinal,
      ordinaryDiv,
      qualifiedDiv,
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
      acaMagi: ordIncomeFinal + ltcgFinal + (ss.total - taxableSSFinal),
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
    });
  }

  const last = rows[rows.length - 1];
  const endTotalNominal = last?.endTotal ?? 0;
  const endTotalReal = last ? endTotalNominal / last.inflationFactor : 0;

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
    yearsCovered: rows.length,
    ranOut,
    overrideEvents,
  };
}

/**
 * First retirement-phase age where the portfolio hits zero, or null if it never does.
 * Use to drive "Plan Lasts To" / depletion warnings.
 */
export function depletionAge(proj: ProjectionResult): number | null {
  for (const r of proj.rows) {
    if ((r.phase === 'Retire' || r.phase === 'Survivor') && r.endTotal <= 0) {
      return r.ageA;
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
