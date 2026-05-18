import type { Plan, IncomeStream, ExpenseStream } from '../schemas/plan';
import { SS_TAXABLE_PCT, TAXABLE_BASIS_PCT } from './taxConstants';
import { filingStatusForYear, type FilingStatus } from './filingStatus';
import { rmdDivisor } from './rmd';
import { householdSS } from './socialSecurity';
import { yearFederalTax, standardDeduction } from './tax';
import { rothConversion } from './conversion';
import { applyWithdrawalOrder } from './withdrawal';
import { annualIRMAACost } from './irmaa';
import { stateTax } from './stateTax';

export interface ProjectionRow {
  year: number;            // 1-indexed plan year
  ageA: number;
  ageB?: number;
  phase: 'Accum.' | 'Retire' | 'Survivor' | 'Past Plan';
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
  effRate: number;
  stdDeduction: number;
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
  lifetimeRMD: number;
  lifetimeConversion: number;
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
): { taxableAmt: number; nonExempt: number } => {
  let taxableAmt = 0, nonExempt = 0;
  for (const s of streams) {
    if (s.type === 'SS') continue; // SS handled separately via PIA
    const personAge = s.whose === 'A' ? ageA : s.whose === 'B' ? (ageB ?? -1) : ageA;
    const personAlive = s.whose === 'A' ? aliveA : s.whose === 'B' ? aliveB : (aliveA || aliveB);
    if (!personAlive) continue;
    if (personAge < s.startAge || personAge > s.stopAge) continue;
    const amount = s.annualAmount * Math.pow(1 + s.growthPct, yearIndex);
    const taxablePortion = amount * s.taxablePct;
    taxableAmt += taxablePortion;
    // IL-exemption: 401(k)/IRA/Roth/SS/pension exempt; Wages, Rental, Other = non-exempt
    if (s.type === 'Wages' || s.type === 'Rental' || s.type === 'Other') {
      nonExempt += taxablePortion;
    }
  }
  return { taxableAmt, nonExempt };
};

const sumExpenseStreams = (
  streams: ExpenseStream[],
  ageA: number,
  ageB: number | undefined,
  yearIndex: number,
): number => {
  let total = 0;
  for (const e of streams) {
    const personAge = e.whose === 'A' ? ageA : e.whose === 'B' ? (ageB ?? -1) : ageA;
    if (personAge < e.startAge || personAge > e.stopAge) continue;
    total += e.annualAmount * Math.pow(1 + e.inflationPct, yearIndex);
  }
  return total;
};

/**
 * Run the full 75-year projection. Year 0 = plan start (today's $ baseline).
 * Returns one row per year for ages startAgeA..startAgeA+74 (max plan span).
 */
export function runProjection(plan: Plan): ProjectionResult {
  const startYear = new Date().getFullYear();
  const startAgeA = ageAt(plan.personA.dob, startYear);
  const startAgeB = plan.personB ? ageAt(plan.personB.dob, startYear) : undefined;
  const passingA = plan.personA.passingAge;
  const passingB = plan.personB?.passingAge;
  const retireAgeA = plan.personA.retirementAge;
  const retireAgeB = plan.personB?.retirementAge ?? retireAgeA;
  const planToAge = plan.personA.planToAge;

  let taxable = plan.portfolio.taxable;
  let trad = plan.portfolio.traditional;
  let roth = plan.portfolio.roth;

  const rows: ProjectionRow[] = [];
  let lifetimeFedTax = 0, lifetimeRMD = 0, lifetimeConversion = 0;
  let ranOut = false;

  const maxYears = Math.min(75, planToAge - startAgeA + 1);

  for (let i = 0; i < maxYears; i++) {
    const ageA = startAgeA + i;
    const ageB = startAgeB !== undefined ? startAgeB + i : undefined;
    const inflationFactor = Math.pow(1 + plan.assumptions.inflation, i);
    const aliveA = ageA <= passingA;
    const aliveB = startAgeB !== undefined && passingB !== undefined ? ageB! <= passingB : false;
    const retiredA = ageA >= retireAgeA;
    const retiredB = ageB !== undefined ? ageB >= retireAgeB : true;
    const retired = retiredA && retiredB;

    const filingStatus = filingStatusForYear(i, startAgeA, passingA, startAgeB, passingB);

    let phase: ProjectionRow['phase'];
    if (!aliveA && !aliveB) phase = 'Past Plan';
    else if (!aliveA || !aliveB) phase = 'Survivor';
    else if (retired) phase = 'Retire';
    else phase = 'Accum.';

    // Contributions during working years
    const cgFactor = Math.pow(1 + plan.assumptions.contribGrowth, i);
    const contribA = (!retiredA && aliveA) ? plan.portfolio.contribA * cgFactor : 0;
    const contribB = (!retiredB && aliveB && plan.personB) ? plan.portfolio.contribB * cgFactor : 0;

    // Social Security
    const ss = householdSS({
      piaA: plan.personA.ssPIA,
      claimAgeA: plan.personA.ssClaimAge,
      ageA, aliveA,
      piaB: plan.personB?.ssPIA,
      claimAgeB: plan.personB?.ssClaimAge,
      ageB, aliveB,
      inflationFactor,
    });

    // Other income streams
    const other = sumIncomeStreams(plan.incomeStreams, ageA, ageB, aliveA, aliveB, i);

    // Expenses (only after retirement; pre-retirement we assume wages cover expenses)
    const netSpend = retired ? sumExpenseStreams(plan.expenseStreams, ageA, ageB, i) : 0;

    // RMD on traditional balance (only if owner alive)
    const rmd = aliveA ? Math.max(0, trad) / rmdDivisor(ageA) : 0;
    const rmdAmt = ageA >= plan.assumptions.rmdStartAge && aliveA ? rmd : 0;
    lifetimeRMD += rmdAmt;

    // Standard deduction this year
    const stdD = standardDeduction(filingStatus, ageA, ageB, inflationFactor);

    // Roth conversion (BEFORE withdrawals — increases ord income for the year)
    const baseOrdIncForConv = ss.total * SS_TAXABLE_PCT + rmdAmt + other.taxableAmt;
    const conv = rothConversion({
      params: plan.conversion,
      ageA,
      retired,
      inflationFactor,
      traditionalBalance: trad,
      baseOrdinaryIncome: baseOrdIncForConv,
      stdDeduction: stdD,
    });
    lifetimeConversion += conv;

    // State tax — IL: only non-retirement non-exempt income is taxable.
    // Computed from inputs that don't depend on withdrawals, so we can lift it out of the loop.
    const stateAmt = stateTax(plan.state, other.nonExempt);

    // Gross-up loop: solve withdrawals to fund netSpend + fedTax + state + irmaa.
    // SS, other income, RMD, and conversions (which come from Trad → Roth, no cash to user)
    // are accounted for as resources. Conversion CREATES tax; loop sizes withdrawals to cover it.
    let prevTax = 0, prevIRMAA = 0;
    let wdTax = 0, wdTrd = 0, wdRth = 0, fedTax = 0, ordIncomeFinal = 0, ltcgFinal = 0, effRate = 0;
    let irmaa = 0;
    let gap = 0;

    const numAt65Plus = (aliveA && ageA >= 65 ? 1 : 0) + (aliveB && ageB !== undefined && ageB >= 65 ? 1 : 0);

    for (let iter = 0; iter < 8; iter++) {
      // Cash needed from withdrawals: spending + all taxes/surcharges, less RMD/SS/other (which arrive as cash).
      gap = Math.max(0, netSpend - ss.total - other.taxableAmt - rmdAmt + prevTax + stateAmt + prevIRMAA);
      const w = applyWithdrawalOrder({
        strategy: plan.withdrawalStrategy,
        gap, taxable, traditional: trad, roth,
        rmd: rmdAmt, ssA: ss.ssA, ssB: ss.ssB, ssTaxablePct: SS_TAXABLE_PCT,
        stdD, inflationFactor,
      });
      wdTax = w.wdTax; wdTrd = w.wdTrd; wdRth = w.wdRth;

      const ltcg = wdTax * (1 - TAXABLE_BASIS_PCT);
      const ordIncome = ss.total * SS_TAXABLE_PCT + other.taxableAmt + wdTrd + rmdAmt + conv;
      const t = yearFederalTax({
        filingStatus,
        inflationFactor,
        ordinaryIncome: ordIncome,
        ltcgIncome: ltcg,
        standardDeduction: stdD,
      });
      fedTax = t.fedTax; ordIncomeFinal = ordIncome; ltcgFinal = ltcg; effRate = t.effRate;

      const magi = ordIncomeFinal + ltcgFinal;
      irmaa = numAt65Plus > 0 ? annualIRMAACost(magi, inflationFactor, numAt65Plus) : 0;

      if (Math.abs(fedTax - prevTax) < 1 && Math.abs(irmaa - prevIRMAA) < 1) break;
      prevTax = fedTax;
      prevIRMAA = irmaa;
    }

    // Update balances. Withdrawals were sized to cover all cash needs.
    const totalContrib = contribA + contribB;
    const gRate = retired ? plan.assumptions.postRetReturn : plan.assumptions.preRetReturn;
    const begTaxable = taxable, begTrad = trad, begRoth = roth;

    taxable = Math.max(0, taxable * (1 + gRate) + totalContrib * plan.portfolio.splitTaxable - wdTax);
    trad    = Math.max(0, trad    * (1 + gRate) + totalContrib * plan.portfolio.splitTraditional - wdTrd - rmdAmt - conv);
    roth    = Math.max(0, roth    * (1 + gRate) + totalContrib * plan.portfolio.splitRoth - wdRth + conv);

    const endTotal = taxable + trad + roth;
    if (retired && endTotal <= 0 && !ranOut) ranOut = true;

    lifetimeFedTax += fedTax;

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
      effRate,
      stdDeduction: stdD,
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
    lifetimeRMD,
    lifetimeConversion,
    endTotalNominal,
    endTotalReal,
    yearsCovered: rows.length,
    ranOut,
  };
}
