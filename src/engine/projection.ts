import type { Plan, IncomeStream, ExpenseStream, LumpSumEvent } from '../schemas/plan';
import { householdTotals } from '../schemas/plan';
import { filingStatusForYear, type FilingStatus } from './filingStatus';
import { rmdDivisor, rmdStartAgeForDob } from './rmd';
import { householdSS } from './socialSecurity';
import { yearFederalTax, standardDeduction, taxableSocialSecurity } from './tax';
import { FED_BRACKETS_MFJ, FED_BRACKETS_SINGLE } from './taxConstants';
import { rothConversion } from './conversion';
import { applyWithdrawalOrder, applyBlendPolicy } from './withdrawal';
import type { BlendPolicy } from './blendPolicy';
import { findWindow } from './blendPolicy';
import { annualIRMAACost } from './irmaa';
import { annualNIIT } from './niit';
import { stateTax } from './stateTax';
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
  ordIncome: number;       // taxable ordinary income (after std deduction)
  ltcg: number;
  fedTax: number;
  stateTaxAmt: number;
  irmaa: number;
  niit: number;
  effRate: number;
  stdDeduction: number;
  magi: number;          // MAGI = ordIncome + ltcg (pre-deduction; used for IRMAA/ACA)
  acaPremium: number;    // net ACA premium after APTC (0 when modelACA=false or post-Medicare)
  // One-time events & surplus
  lumpSumInjectTaxable: number; // direct account injections from lump-sum events (taxable bucket)
  lumpSumInjectTrad: number;
  lumpSumInjectRoth: number;
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
): { taxableAmt: number; nonExempt: number; pensionAmt: number } => {
  let taxableAmt = 0, nonExempt = 0, pensionAmt = 0;
  for (const s of streams) {
    if (s.type === 'SS') continue; // SS handled separately via PIA
    const personAge = s.whose === 'A' ? ageA : s.whose === 'B' ? (ageB ?? -1) : ageA;
    const personAlive = s.whose === 'A' ? aliveA : s.whose === 'B' ? aliveB : (aliveA || aliveB);
    if (!personAlive) continue;
    if (personAge < s.startAge || personAge > s.stopAge) continue;
    const amount = s.annualAmount * Math.pow(1 + s.growthPct, yearIndex);
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
    // When actual per-year CPI overrides are active, streams whose inflationPct matches the
    // plan's baseline inflation are treated as CPI-indexed (lifestyle spending). Substitute
    // the actual cumulative inflation factor so these streams track historical CPI rather
    // than the fixed planning rate. All other rates (0%, healthcare premium, etc.) compound
    // at their own specified rate as before.
    const isCpiIndexed = cumulativeInflationFactor !== undefined
      && Math.abs(e.inflationPct - planInflation) < 1e-9;
    const growthFactor = isCpiIndexed
      ? cumulativeInflationFactor
      : Math.pow(1 + e.inflationPct, yearIndex);
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
   * - Expense streams whose inflationPct equals plan.assumptions.inflation (CPI-indexed lifestyle
   *   spending) track actual CPI instead of the fixed planning rate.
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
  const planToAge = plan.personA.planToAge;

  const totals = householdTotals(plan.portfolio);
  let taxable = totals.taxable;
  let trad = totals.traditional;
  let roth = totals.roth;
  const pfA = plan.portfolio.personA;
  const pfB = plan.portfolio.personB;
  let taxableBasis = (pfA.taxableBasis ?? 0) + (pfB?.taxableBasis ?? 0);

  const rows: ProjectionRow[] = [];
  let lifetimeFedTax = 0, lifetimeRMD = 0, lifetimeConversion = 0;
  let lifetimeFedTaxReal = 0, lifetimeRMDReal = 0, lifetimeConversionReal = 0;
  let ranOut = false;
  // Per-year MAGI + filing-status history for IRMAA 2-year lookback.
  const magiHistory: number[] = [];
  const filingStatusHistory: FilingStatus[] = [];

  const maxYears = Math.min(75, planToAge - startAgeA + 1);
  const rmdStartAge = rmdStartAgeForDob(plan.personA.dob);
  // Running inflation factor — compounded from per-year CPI overrides when provided,
  // otherwise from the plan's fixed inflation rate. Year 0 is always 1 (base year).
  let runningInflationFactor = 1;

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
    // own rate (contribGrowth now lives on the per-person portfolio, not assumptions).
    const cgFactorA = Math.pow(1 + (pfA.contribGrowth ?? 0), i);
    const cgFactorB = pfB ? Math.pow(1 + (pfB.contribGrowth ?? 0), i) : 1;
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
      ssStreams: plan.incomeStreams,
      yearIndex: i,
    });

    // Other income streams
    const other = sumIncomeStreams(plan.incomeStreams, ageA, ageB, aliveA, aliveB, i);

    // Expenses start when either person retires (semi-retirement or full retirement).
    // Per-whose gate inside sumExpenseStreams: A-tagged on retiredA, B-tagged on retiredB,
    // Household on retiredA||retiredB. Working person's contributions offset the portfolio draw.
    const netSpend = (retiredA || retiredB) ? sumExpenseStreams(
      plan.expenseStreams, ageA, ageB, i,
      plan.assumptions.inflation,
      opts?.inflationOverrides ? inflationFactor : undefined,
      retiredA, retiredB,
    ) : 0;

    // RMD on traditional balance (only if owner alive)
    const rmd = aliveA ? Math.max(0, trad) / rmdDivisor(ageA) : 0;
    const rmdAmt = ageA >= rmdStartAge && aliveA ? rmd : 0;
    lifetimeRMD += rmdAmt;
    lifetimeRMDReal += rmdAmt / inflationFactor;

    // Standard deduction this year. For Single filers where B is the survivor, use B's age.
    const filerAge = (filingStatus === 'Single' && !aliveA && aliveB && ageB !== undefined) ? ageB : ageA;
    const stdD = standardDeduction(filingStatus, filerAge, ageB, inflationFactor);

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

    // Base ordinary income for withdrawal bracket-fill sizing (conv now known; wdTrd unknown).
    const piForWd = other.taxableAmt + rmdAmt + conv + 0.5 * ss.total;
    const taxableSSForWd = taxableSocialSecurity(piForWd, ss.total, filingStatus);
    const baseOrdIncForWd = taxableSSForWd + rmdAmt + conv + other.taxableAmt;

    // Per-bucket "available to withdraw" caps. All three buckets are debited by the
    // end-of-year update `bucket = max(0, bucket*(1+g) + contrib +/- credits - withdrawal)`,
    // so the withdrawal must respect what that update would actually leave non-negative —
    // otherwise wdX exceeds the cap, the bucket clamps to zero, and the projection silently
    // funds the spending gap with phantom cash (the historic bug class). Same cap formula
    // applied to both withdrawal code paths (legacy preset + custom blend policy).
    // gRateThisYear + contribToTradEarly are declared earlier (for the conv cap).
    const contribToTaxEarly = contribA * pfA.contribSplit.taxable + contribB * (pfB?.contribSplit.taxable ?? 0);
    const contribToRothEarly = contribA * pfA.contribSplit.roth + contribB * (pfB?.contribSplit.roth ?? 0);
    const taxAvail = Math.max(0, taxable * (1 + gRateTaxYear) + contribToTaxEarly);
    const preBasisThisYear = taxableBasis + contribToTaxEarly;
    const gainFraction = taxAvail > 0 ? Math.max(0, Math.min(1, 1 - preBasisThisYear / taxAvail)) : 0;
    const tradAvail = Math.max(0, trad * (1 + gRateTradYear) + contribToTradEarly - rmdAmt - conv);
    const rothAvail = Math.max(0, roth * (1 + gRateRothYear) + contribToRothEarly + conv);

    // Gross-up loop: solve withdrawals to fund netSpend + fedTax + state + irmaa.
    // SS, other income, RMD, and conversions (which come from Trad → Roth, no cash to user)
    // are accounted for as resources. Conversion CREATES tax; loop sizes withdrawals to cover it.
    let prevTax = 0, prevIRMAA = 0, prevNIIT = 0, prevStateAmt = 0, prevACA = 0;
    let wdTax = 0, wdTrd = 0, wdRth = 0, fedTax = 0, ordIncomeFinal = 0, ltcgFinal = 0, effRate = 0;
    let irmaa = 0, niit = 0, acaPremiumYear = 0;
    let gap = 0;

    const numAt65Plus = (aliveA && ageA >= 65 ? 1 : 0) + (aliveB && ageB !== undefined && ageB >= 65 ? 1 : 0);
    // State tax — depends on state profile.
    // For IL/TX/FL/WA: only non-retirement non-exempt income is taxable.
    // For CA/NY: retirement withdrawals + conversions are also taxable.
    // We compute it once per iter pass (after withdrawal sizing) to capture CA/NY retirement-tax dependence.
    const numPersons = (aliveA ? 1 : 0) + (aliveB ? 1 : 0);
    let stateAmt = stateTax(plan.state, other.nonExempt, other.pensionAmt, numPersons, inflationFactor, numAt65Plus, plan.customStateTaxRate); // initial pass; ltcg unknown until loop iter 1

    // 16 iterations: 8 was enough for IL/TX plans but CA/NY (which tax retirement + conversions)
    // need more to fully converge fedTax + irmaa + stateAmt jointly.
    for (let iter = 0; iter < 16; iter++) {
      // Cash needed from withdrawals: spending + all taxes/surcharges, less RMD/SS/other (which arrive as cash).
      gap = Math.max(0, netSpend - ss.total - other.taxableAmt - rmdAmt + prevTax + stateAmt + prevIRMAA + prevNIIT + prevACA);
      const w = activePolicy
        ? applyBlendPolicy({ policy: activePolicy, ageA, gap, taxable: taxAvail, traditional: tradAvail, roth: rothAvail })
        : applyWithdrawalOrder({
            strategy: plan.withdrawalStrategy,
            gap, taxable: taxAvail, traditional: tradAvail, roth: rothAvail,
            rmd: rmdAmt, baseOrdinaryIncome: baseOrdIncForWd,
            bracketCeiling: effectiveBracketCeiling(plan.withdrawalBracketCeiling, filingStatus),
            stdD, inflationFactor,
          });
      wdTax = w.wdTax; wdTrd = w.wdTrd; wdRth = w.wdRth;

      const ltcg = wdTax * gainFraction;
      // SS taxability via IRC §86 provisional-income tiers (replaces flat 0.85).
      const provisionalIncome = other.taxableAmt + wdTrd + rmdAmt + conv + 0.5 * ss.total;
      const taxableSS = taxableSocialSecurity(provisionalIncome, ss.total, filingStatus);
      const ordIncome = taxableSS + other.taxableAmt + wdTrd + rmdAmt + conv;
      const t = yearFederalTax({
        filingStatus,
        inflationFactor,
        ordinaryIncome: ordIncome,
        ltcgIncome: ltcg,
        standardDeduction: stdD,
      });
      fedTax = t.fedTax; ordIncomeFinal = ordIncome; ltcgFinal = ltcg; effRate = t.effRate;

      const magi = ordIncomeFinal + ltcgFinal;
      // IRMAA 2-year lookback: year i's surcharge is based on MAGI from year i-2.
      // For the first two years, fall back to the current year's MAGI.
      const irmaaMAGI = i >= 2 ? magiHistory[i - 2] : magi;
      const irmaaFS = i >= 2 ? filingStatusHistory[i - 2] : filingStatus;
      irmaa = numAt65Plus > 0 ? annualIRMAACost(irmaaMAGI, inflationFactor, numAt65Plus, irmaaFS) : 0;
      niit = annualNIIT(magi, ltcg, filingStatus);

      // Refine state tax to include retirement distributions for states that tax them.
      // Include stateAmt in the convergence check — for CA/NY plans, state tax is a
      // material gross-up term and ignoring its delta caused ~$15 spending shortfalls
      // (caught by Layer-1's SPENDING COVERAGE invariant on planG_californiaCouple).
      // ltcg goes into nonExemptOrdinaryIncome so IL (retirementExempt:true) still taxes it —
      // IL exempts retirement distributions but NOT capital gains.
      stateAmt = stateTax(plan.state, other.nonExempt + ltcg, wdTrd + rmdAmt + conv + other.pensionAmt, numPersons, inflationFactor, numAt65Plus, plan.customStateTaxRate);

      // ACA marketplace premium (pre-Medicare years when the user has opted in).
      acaPremiumYear = 0;
      if (plan.assumptions.modelACA && plan.assumptions.acaBenchmarkPremium > 0) {
        const preMedicareCount = (aliveA && ageA < 65 ? 1 : 0) + (aliveB && ageB !== undefined && ageB < 65 ? 1 : 0);
        if (preMedicareCount > 0) {
          const scaledPremium = plan.assumptions.acaBenchmarkPremium * inflationFactor * preMedicareCount;
          acaPremiumYear = plan.assumptions.acaNoSubsidy
            ? scaledPremium  // full cost, no APTC applied
            : acaNetPremium({ magi, householdSize: plan.assumptions.acaHouseholdSize, annualBenchmarkPremium: scaledPremium });
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

    // Update balances. Withdrawals were sized to cover all cash needs.
    // Contributions are split per-person using each person's own contribSplit.
    const begTaxable = taxable, begTrad = trad, begRoth = roth;
    const splitAtoTax = pfA.contribSplit.taxable, splitAtoTrad = pfA.contribSplit.traditional, splitAtoRoth = pfA.contribSplit.roth;
    const splitBtoTax = pfB?.contribSplit.taxable ?? 0, splitBtoTrad = pfB?.contribSplit.traditional ?? 0, splitBtoRoth = pfB?.contribSplit.roth ?? 0;
    const contribToTax = contribA * splitAtoTax + contribB * splitBtoTax;
    const contribToTrad = contribA * splitAtoTrad + contribB * splitBtoTrad;
    const contribToRoth = contribA * splitAtoRoth + contribB * splitBtoRoth;

    taxable = Math.max(0, taxable * (1 + gRateTaxYear) + contribToTax - wdTax);
    trad    = Math.max(0, trad    * (1 + gRateTradYear) + contribToTrad - wdTrd - rmdAmt - conv);
    roth    = Math.max(0, roth    * (1 + gRateRothYear) + contribToRoth - wdRth + conv);
    taxableBasis = Math.max(0, taxableBasis + contribToTax - wdTax * (1 - gainFraction));

    // One-time income events: inject directly into target account.
    // Amount is stored in plan-start-year (today's) dollars — inflate to nominal at event year,
    // consistent with how income stream annualAmounts are treated. Taxable bucket gets full
    // stepped-up basis; trad/roth are balance-only transfers.
    let lumpSumInjectTaxable = 0, lumpSumInjectTrad = 0, lumpSumInjectRoth = 0;
    for (const ev of (plan.lumpSumEvents ?? []) as LumpSumEvent[]) {
      const personAge = ev.whose === 'A' ? ageA : ev.whose === 'B' ? (ageB ?? -1) : ageA;
      const personAlive = ev.whose === 'A' ? aliveA : ev.whose === 'B' ? aliveB : (aliveA || aliveB);
      if (!personAlive || personAge !== ev.age) continue;
      if (ev.bucket === 'taxable') { taxable += ev.amount; taxableBasis += ev.amount; lumpSumInjectTaxable += ev.amount; }
      else if (ev.bucket === 'trad') { trad += ev.amount; lumpSumInjectTrad += ev.amount; }
      else { roth += ev.amount; lumpSumInjectRoth += ev.amount; }
    }

    // Surplus sweep: when SS + other income + RMD exceed spending + all taxes, the leftover
    // cash is already received and taxed — sweep it into the taxable account at full basis.
    const cashSurplus = Math.max(0, ss.total + other.taxableAmt + rmdAmt - netSpend - fedTax - stateAmt - irmaa - niit - acaPremiumYear);
    if (cashSurplus > 0) { taxable += cashSurplus; taxableBasis += cashSurplus; }

    const endTotal = taxable + trad + roth;
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
    magiHistory.push(ordIncomeFinal + ltcgFinal);
    filingStatusHistory.push(filingStatus);

    // Advance the running inflation factor for the next year.
    runningInflationFactor *= (1 + (opts?.inflationOverrides?.[i] ?? plan.assumptions.inflation));

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
      fedTax,
      stateTaxAmt: stateAmt,
      irmaa,
      niit,
      effRate,
      stdDeduction: stdD,
      magi: ordIncomeFinal + ltcgFinal,
      acaPremium: acaPremiumYear,
      lumpSumInjectTaxable, lumpSumInjectTrad, lumpSumInjectRoth,
      cashSurplus,
      begTaxable, begTraditional: begTrad, begRoth,
      endTaxable: taxable, endTraditional: trad, endRoth: roth,
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
