import type { ProjectionResult, ProjectionRow } from './projection';

export interface CashFlowYear {
  year: number;
  ageA: number;
  ageB?: number;
  phase: ProjectionRow['phase'];
  inflationFactor: number;
  sources: {
    socialSecurity: number;
    otherIncome: number;
    wdTaxable: number;
    wdTraditional: number;   // includes RMD
    wdRoth: number;
    rothConversion: number;  // shown as transfer (Trad→Roth), no cash to user
    total: number;
  };
  uses: {
    netSpending: number;
    federalTax: number;
    stateTax: number;
    irmaa: number;
    total: number;
  };
  netDelta: number;          // sources.total - uses.total (should be ~0 by construction)
}

const toReal = (n: number, inf: number, real: boolean): number => real ? n / inf : n;

/** Build a Sources & Uses statement per year. real=true returns today's $ values. */
export function buildCashFlowPlan(proj: ProjectionResult, real = true): CashFlowYear[] {
  return proj.rows.map((r) => {
    const inf = r.inflationFactor;
    const sources = {
      socialSecurity: toReal(r.totalSS, inf, real),
      otherIncome: toReal(r.otherIncome, inf, real),
      wdTaxable: toReal(r.wdTax, inf, real),
      wdTraditional: toReal(r.wdTrd + r.rmd, inf, real),
      wdRoth: toReal(r.wdRth, inf, real),
      rothConversion: toReal(r.rothConv, inf, real),
      total: 0,
    };
    sources.total = sources.socialSecurity + sources.otherIncome + sources.wdTaxable + sources.wdTraditional + sources.wdRoth;
    const uses = {
      netSpending: toReal(r.netSpend, inf, real),
      federalTax: toReal(r.fedTax, inf, real),
      stateTax: toReal(r.stateTaxAmt, inf, real),
      irmaa: toReal(r.irmaa, inf, real),
      total: 0,
    };
    uses.total = uses.netSpending + uses.federalTax + uses.stateTax + uses.irmaa;
    return {
      year: r.year,
      ageA: r.ageA,
      ageB: r.ageB,
      phase: r.phase,
      inflationFactor: r.inflationFactor,
      sources,
      uses,
      netDelta: sources.total - uses.total,
    };
  });
}

/** Filter to retirement years only (drops 'Accum.' rows). */
export function retirementCashFlows(proj: ProjectionResult, real = true): CashFlowYear[] {
  return buildCashFlowPlan(proj, real).filter((c) => c.phase === 'Retire' || c.phase === 'Survivor');
}
