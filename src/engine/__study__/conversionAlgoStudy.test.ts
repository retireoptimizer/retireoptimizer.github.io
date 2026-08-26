import { describe, it } from 'vitest';
import { optimizeStrategy } from '../optimizer';
import { runProjection } from '../projection';
import { rmdStartAgeForDob } from '../rmd';
import { FED_BRACKETS_MFJ } from '../taxConstants';
import type { Plan } from '../../schemas/plan';
import type { BlendPolicy, BlendWindow } from '../blendPolicy';
import type { ProjectionResult } from '../projection';
import {
  planA_simple, planB_largeTradSingle, planC_bracketFillConv,
  planD_singleFIRE, planE_allRothCouple, planF_allTradCouple,
  planG_californiaCouple, planH_survivorMidPlan, planI_multiStreamIncome,
  planJ_personBZeroBalance, planK_wideAgeGap, planL_survivorARMD,
  planM_survivorBRMD, planN_shortLivedA, planO_largePension, planP_tightPlan,
} from '../__golden/plans';

interface AlgoResult {
  endTotalReal: number;
  tvRatio: number;
  ranOut: boolean;
  evals: number;
}

function tvRatio(convAmts: number[]): number {
  const total = convAmts.reduce((a, b) => a + b, 0);
  if (total < 1000) return NaN;
  let tv = 0;
  for (let i = 1; i < convAmts.length; i++) tv += Math.abs(convAmts[i] - convAmts[i - 1]);
  return tv / total;
}

function getBaseSplits(plan: Plan): { policy: BlendPolicy; proj: ProjectionResult } {
  const p: Plan = { ...plan, conversion: { ...plan.conversion, mode: 'off', optimize: false } };
  const r = optimizeStrategy(p, 'max-end-balance', { thorough: false, useNelderMead: false });
  return { policy: r.perYearPolicy, proj: r.projection };
}

function algoNoConv(plan: Plan): AlgoResult {
  const { proj, policy } = getBaseSplits(plan);
  const convAmts = policy.windows.map(w => w.convAmt ?? 0);
  return { endTotalReal: proj.endTotalReal, tvRatio: tvRatio(convAmts), ranOut: proj.ranOut, evals: 0 };
}

function algoBracketFillGlobal(plan: Plan): AlgoResult {
  const { policy: basePol } = getBaseSplits(plan);
  const splitWindows = basePol.windows.map(w => ({ ...w, convAmt: undefined as number | undefined }));
  const CEILINGS = [0, 22_000, 44_600, 89_075, 133_600, 178_150, 267_225, 356_300];
  let best: AlgoResult = { endTotalReal: -Infinity, tvRatio: NaN, ranOut: true, evals: 0 };
  let evals = 0;
  for (const ceiling of CEILINGS) {
    const p: Plan = { ...plan, conversion: { ...plan.conversion, mode: 'bracket-fill', bracketCeiling: ceiling, startAge: plan.personA.retirementAge, endAge: plan.personA.planThroughAge, optimize: false } };
    const proj = runProjection(p, { policy: { windows: splitWindows, source: 'manual' } });
    evals++;
    const convAmts = proj.rows.map(r => r.rothConv / r.inflationFactor);
    const result: AlgoResult = { endTotalReal: proj.endTotalReal, tvRatio: tvRatio(convAmts), ranOut: proj.ranOut, evals };
    if (!proj.ranOut && proj.endTotalReal > best.endTotalReal) best = result;
    else if (best.ranOut && !proj.ranOut) best = result;
  }
  best.evals = evals;
  return best;
}

function buildRegimeBreaks(plan: Plan): number[] {
  const breaks = new Set<number>();
  breaks.add(plan.personA.retirementAge);
  breaks.add(plan.personA.planThroughAge + 1);

  const ssAges = new Set<number>();
  for (const s of plan.incomeStreams ?? []) {
    if (s.type === 'SS') ssAges.add(s.startAge);
  }
  if (plan.personA.ssPIA > 0) ssAges.add(plan.personA.ssClaimAge);
  if (plan.personB && (plan.personB.ssPIA ?? 0) > 0) ssAges.add(plan.personB.ssClaimAge);
  for (const a of ssAges) if (a > plan.personA.retirementAge && a <= plan.personA.planThroughAge) breaks.add(a);

  // Filing status shift: the year after each person's planThroughAge is a break point.
  const horizonA = plan.personA.planThroughAge;
  if (plan.personB) {
    const birthYearA = parseInt(plan.personA.dob.slice(0, 4), 10);
    const birthYearB = parseInt(plan.personB.dob.slice(0, 4), 10);
    const bEndInAFrame = plan.personB.planThroughAge + (birthYearB - birthYearA);
    if (plan.personA.planThroughAge < bEndInAFrame) breaks.add(plan.personA.planThroughAge + 1);
    if (bEndInAFrame < horizonA) breaks.add(bEndInAFrame + 1);
  }

  const rmdA = rmdStartAgeForDob(plan.personA.dob);
  if (rmdA > plan.personA.retirementAge && rmdA <= plan.personA.planThroughAge) breaks.add(rmdA);
  if (plan.personB) {
    const rmdB = rmdStartAgeForDob(plan.personB.dob);
    if (rmdB > plan.personA.retirementAge && rmdB <= plan.personA.planThroughAge) breaks.add(rmdB);
  }

  return [...breaks].sort((a, b) => a - b);
}

function algoRegimeConst(plan: Plan): AlgoResult {
  const { policy: basePol } = getBaseSplits(plan);
  const BRACKET_12_TOP = FED_BRACKETS_MFJ[1][0];
  const MAX_CONV = 3 * BRACKET_12_TOP;
  const FRACS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];

  const regimeBreaks = buildRegimeBreaks(plan);
  const nRegimes = regimeBreaks.length - 1;

  const getRegimeIdx = (age: number): number => {
    for (let i = 0; i < nRegimes; i++) {
      if (age >= regimeBreaks[i] && age < regimeBreaks[i + 1]) return i;
    }
    return nRegimes - 1;
  };

  const buildWindows = (regimeAmounts: number[]): BlendWindow[] => {
    return basePol.windows.map(w => ({
      ...w,
      convAmt: regimeAmounts[getRegimeIdx(w.fromAge)] ?? 0,
    }));
  };

  let regimeAmounts = new Array(nRegimes).fill(0);
  let bestWindows = buildWindows(regimeAmounts);
  let bestProj = runProjection(plan, { policy: { windows: bestWindows, source: 'manual' } });
  let evals = 1;

  for (let pass = 0; pass < 4; pass++) {
    let improved = false;
    for (let ri = 0; ri < nRegimes; ri++) {
      const curAmt = regimeAmounts[ri];
      let bestAmt = curAmt;
      let bestScore = bestProj.ranOut ? -1e15 : bestProj.endTotalReal;

      for (const f of FRACS) {
        const amt = Math.round(f * MAX_CONV);
        if (Math.abs(amt - curAmt) < 100) continue;
        const amounts = [...regimeAmounts];
        amounts[ri] = amt;
        const proj = runProjection(plan, { policy: { windows: buildWindows(amounts), source: 'manual' } });
        evals++;
        const score = proj.ranOut ? -1e15 : proj.endTotalReal;
        if (score > bestScore) { bestScore = score; bestAmt = amt; bestProj = proj; }
      }
      if (bestAmt !== curAmt) { regimeAmounts[ri] = bestAmt; bestWindows = buildWindows(regimeAmounts); improved = true; }
    }
    if (!improved) break;
  }

  const convAmts = bestWindows.map(w => w.convAmt ?? 0);
  return { endTotalReal: bestProj.endTotalReal, tvRatio: tvRatio(convAmts), ranOut: bestProj.ranOut, evals };
}

function algoPerYearCD(plan: Plan): AlgoResult {
  const { policy: basePol, proj: baseProj } = getBaseSplits(plan);
  const retireAge = plan.personA.retirementAge;
  const BRACKET_12_TOP = FED_BRACKETS_MFJ[1][0];
  const FRACS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0];

  const retireOffset = baseProj.rows.findIndex(r => r.ageA === retireAge);
  const cap = (proj: ProjectionResult, yi: number): number => {
    const r = proj.rows[yi + retireOffset];
    if (!r) return 0;
    return Math.max(0, Math.min(r.begTraditional / r.inflationFactor, 3 * BRACKET_12_TOP));
  };

  let bestWindows: BlendWindow[] = basePol.windows.map(w => ({ ...w, convAmt: 0 }));
  let bestProj = runProjection(plan, { policy: { windows: bestWindows, source: 'manual' } });
  let bestScore = bestProj.ranOut ? -1e15 : bestProj.endTotalReal;
  let evals = 1;

  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (let yi = 0; yi < bestWindows.length; yi++) {
      const c = cap(bestProj, yi);
      if (c < 100) continue;
      const curAmt = bestWindows[yi].convAmt ?? 0;

      for (const f of FRACS) {
        const amt = Math.round(f * c);
        if (Math.abs(amt - curAmt) < 50) continue;
        const trial = bestWindows.map((w, i) => i === yi ? { ...w, convAmt: amt } : w);
        const proj = runProjection(plan, { policy: { windows: trial, source: 'manual' } });
        evals++;
        const score = proj.ranOut ? -1e15 : proj.endTotalReal;
        if (score > bestScore) {
          bestWindows = trial; bestProj = proj; bestScore = score; improved = true; break;
        }
      }
    }
    if (!improved) break;
  }

  const convAmts = bestWindows.map(w => w.convAmt ?? 0);
  return { endTotalReal: bestProj.endTotalReal, tvRatio: tvRatio(convAmts), ranOut: bestProj.ranOut, evals };
}

function algoKnotTier1(plan: Plan): AlgoResult {
  const r = optimizeStrategy(plan, 'max-end-balance', { thorough: false, useNelderMead: false });
  const convAmts = r.perYearPolicy.windows.map(w => w.convAmt ?? 0);
  return { endTotalReal: r.projection.endTotalReal, tvRatio: tvRatio(convAmts), ranOut: r.projection.ranOut, evals: r.evaluations };
}

function algoAnalytical(plan: Plan): AlgoResult {
  const { policy: basePol } = getBaseSplits(plan);
  const splitWindows = basePol.windows.map(w => ({ ...w, convAmt: undefined as number | undefined }));
  const retireAge = plan.personA.retirementAge;
  const rmdAge = rmdStartAgeForDob(plan.personA.dob);

  const noConvPlan: Plan = { ...plan, conversion: { ...plan.conversion, mode: 'off', optimize: false } };
  const noConvProj = runProjection(noConvPlan, { policy: { windows: splitWindows, source: 'manual' } });

  const rmdRows = noConvProj.rows.filter(r => r.rmd > 0);
  const avgEffRate = rmdRows.length > 0
    ? rmdRows.reduce((sum, r) => sum + r.effRate, 0) / rmdRows.length
    : 0.22;

  const BRACKET_TOPS = FED_BRACKETS_MFJ.map(b => b[0]);
  const BRACKET_RATES = FED_BRACKETS_MFJ.map(b => b[1]);
  let targetCeiling = BRACKET_TOPS[1];
  for (let i = 0; i < BRACKET_RATES.length; i++) {
    if (avgEffRate <= BRACKET_RATES[i] + 0.01) { targetCeiling = BRACKET_TOPS[i]; break; }
  }

  const convPlan: Plan = {
    ...plan,
    conversion: {
      ...plan.conversion,
      mode: 'bracket-fill',
      bracketCeiling: targetCeiling,
      startAge: retireAge,
      endAge: rmdAge - 1,
      optimize: false,
    },
  };
  const proj = runProjection(convPlan, { policy: { windows: splitWindows, source: 'manual' } });
  const convAmts = proj.rows.map(r => r.rothConv / r.inflationFactor);
  return { endTotalReal: proj.endTotalReal, tvRatio: tvRatio(convAmts), ranOut: proj.ranOut, evals: noConvProj.rows.length + 1 };
}

describe('Conversion algorithm study', () => {
  it('compares 6 conversion algorithms across all plans', () => {
    const plans: Array<{ name: string; fn: () => Plan }> = [
      { name: 'A_simple', fn: planA_simple },
      { name: 'B_largeTrad', fn: planB_largeTradSingle },
      { name: 'C_bracketFill', fn: planC_bracketFillConv },
      { name: 'D_FIRE', fn: planD_singleFIRE },
      { name: 'E_allRoth', fn: planE_allRothCouple },
      { name: 'F_allTrad', fn: planF_allTradCouple },
      { name: 'G_california', fn: planG_californiaCouple },
      { name: 'H_survivor', fn: planH_survivorMidPlan },
      { name: 'I_multiIncome', fn: planI_multiStreamIncome },
      { name: 'J_bZeroBalance', fn: planJ_personBZeroBalance },
      { name: 'K_wideAgeGap', fn: planK_wideAgeGap },
      { name: 'L_survivorARMD', fn: planL_survivorARMD },
      { name: 'M_survivorBRMD', fn: planM_survivorBRMD },
      { name: 'N_shortLivedA', fn: planN_shortLivedA },
      { name: 'O_largePension', fn: planO_largePension },
      { name: 'P_tightPlan', fn: planP_tightPlan },
    ];

    const endTable: Record<string, Record<string, number | null>> = {};
    const tvTable: Record<string, Record<string, number | null>> = {};

    for (const { name, fn } of plans) {
      console.log(`\nRunning ${name}...`);
      const plan = fn();
      endTable[name] = {};
      tvTable[name] = {};

      const run = (algo: string, algoFn: () => AlgoResult) => {
        const r = algoFn();
        endTable[name][algo] = r.endTotalReal;
        tvTable[name][algo] = r.tvRatio;
        console.log(`  ${algo.padEnd(10)} end=$${(r.endTotalReal / 1000).toFixed(0)}K  tv=${isNaN(r.tvRatio) ? '  N/A' : r.tvRatio.toFixed(2)}  ${r.ranOut ? 'DEPLETES' : ''}  evals=${r.evals}`);
      };

      run('noConv',    () => algoNoConv(plan));
      run('bfGlobal',  () => algoBracketFillGlobal(plan));
      run('regConst',  () => algoRegimeConst(plan));
      run('perYearCD', () => algoPerYearCD(plan));
      run('knotT1',    () => algoKnotTier1(plan));
      run('analytic',  () => algoAnalytical(plan));
    }

    console.log('\n\n=== SUMMARY: endTotalReal lift over noConv ===');
    console.log('Plan              | bfGlobal | regConst | perYearCD | knotT1  | analytic');
    console.log('-'.repeat(78));
    for (const { name } of plans) {
      const base = endTable[name]['noConv'] ?? 0;
      const lift = (algo: string) => {
        const v = endTable[name][algo];
        if (v == null) return '    N/A';
        const d = v - base;
        return (d >= 0 ? '+' : '') + (d / 1000).toFixed(0) + 'K';
      };
      console.log(
        name.padEnd(18) + '| ' +
        lift('bfGlobal').padStart(7) + '  | ' +
        lift('regConst').padStart(7) + '  | ' +
        lift('perYearCD').padStart(8) + ' | ' +
        lift('knotT1').padStart(7) + ' | ' +
        lift('analytic').padStart(7),
      );
    }

    console.log('\n=== SMOOTHNESS: tvRatio (lower=smoother, NaN=no conversions) ===');
    console.log('Plan              | bfGlobal | regConst | perYearCD | knotT1  | analytic');
    console.log('-'.repeat(78));
    for (const { name } of plans) {
      const fmt = (algo: string) => {
        const v = tvTable[name][algo];
        if (v == null || isNaN(v as number)) return '    N/A';
        return (v as number).toFixed(2).padStart(7);
      };
      console.log(
        name.padEnd(18) + '| ' +
        fmt('bfGlobal').padStart(7) + '  | ' +
        fmt('regConst').padStart(7) + '  | ' +
        fmt('perYearCD').padStart(8) + ' | ' +
        fmt('knotT1').padStart(7) + ' | ' +
        fmt('analytic').padStart(7),
      );
    }
  }, 600_000);
});
