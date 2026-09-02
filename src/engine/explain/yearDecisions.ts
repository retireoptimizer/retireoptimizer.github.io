import { fmtUSD } from '../../lib/format';
import type { SpillKind } from '../withdrawal';

export type DecisionCode =
  | 'conv-bracket-headroom'
  | 'conv-trad-cap'
  | 'conv-policy-zero'
  | 'conv-with-trad-wd'
  | 'conv-during-rmd'
  | 'wd-policy-spill'
  | 'wd-bracket-override'
  | 'wd-bracketfill-room'
  | 'irmaa-tier'
  | 'aca-cliff';

export interface YearDecision {
  year: number;
  ageA: number;
  code: DecisionCode;
  severity: 'info' | 'caution' | 'warning';
  /** True when this constraint is what set the actual number, not just contextual commentary. */
  binding: boolean;
  text: string;
  amounts?: Record<string, number>;
}

export interface YearDecisionContext {
  year: number;
  ageA: number;
  // Conversion
  conv: number;
  /** convAmt was explicitly pinned to 0 (not undefined — undefined releases the path). */
  convPolicyZero: boolean;
  headroomNominal: number;
  maxConv: number;
  ceilForConv: number;
  baseOrdIncome: number;
  tradBalance: number;
  // Withdrawal
  wdTax: number;
  wdTrd: number;
  wdRth: number;
  gap: number;
  rmdAmt: number;
  bracketOverridden: boolean;
  spill?: { kind: SpillKind; amount: number; tradCap?: number };
  /** Active window percentages, present when a blend-policy window covers this age. */
  spillWindow?: { pctTaxable: number; pctTraditional: number; pctRoth: number };
  // Bracketfill withdrawal preset
  isActiveBracketfill: boolean;
  bracketfillRoom: number;
}

// ---------------------------------------------------------------------------
// Conversion notes
// ---------------------------------------------------------------------------

function convBracketHeadroom(ctx: YearDecisionContext): YearDecision {
  const { ageA, year, headroomNominal, ceilForConv, baseOrdIncome, conv } = ctx;
  return {
    year, ageA,
    code: 'conv-bracket-headroom',
    severity: 'info',
    binding: true,
    text: `Age ${ageA} — the bracket ceiling was the binding limit on this conversion. ` +
      `${fmtUSD(headroomNominal)} of room remained below the ${fmtUSD(ceilForConv)} ceiling ` +
      `after ${fmtUSD(baseOrdIncome)} of other ordinary income, ` +
      `and ${fmtUSD(conv)} was converted — the full available headroom.`,
    amounts: { headroomNominal, ceilForConv, baseOrdIncome, conv },
  };
}

function convTradCap(ctx: YearDecisionContext): YearDecision {
  const { ageA, year, headroomNominal, maxConv, conv } = ctx;
  return {
    year, ageA,
    code: 'conv-trad-cap',
    severity: 'info',
    binding: true,
    text: `Age ${ageA} — the pre-tax balance was the binding limit on this conversion. ` +
      `${fmtUSD(headroomNominal)} of bracket room was available, ` +
      `but only ${fmtUSD(maxConv)} remained in the pre-tax account, ` +
      `so ${fmtUSD(conv)} was converted.`,
    amounts: { headroomNominal, maxConv, conv },
  };
}

function convPolicyZero(ctx: YearDecisionContext): YearDecision {
  const { ageA, year } = ctx;
  return {
    year, ageA,
    code: 'conv-policy-zero',
    severity: 'info',
    binding: true,
    text: `Age ${ageA} — no Roth conversion was made. ` +
      `The manual schedule sets the conversion amount to zero for this year.`,
    amounts: {},
  };
}

function convWithTradWd(ctx: YearDecisionContext): YearDecision {
  const { ageA, year, conv, headroomNominal, ceilForConv, baseOrdIncome, gap, wdTax, wdRth, wdTrd } = ctx;
  return {
    year, ageA,
    code: 'conv-with-trad-wd',
    severity: 'info',
    binding: false,
    text: `Age ${ageA} — a Roth conversion and a pre-tax withdrawal are not in conflict. ` +
      `The conversion is sized first: ${fmtUSD(headroomNominal)} of bracket room remained ` +
      `below the ${fmtUSD(ceilForConv)} ceiling after ${fmtUSD(baseOrdIncome)} of other ordinary income, ` +
      `and ${fmtUSD(conv)} was converted. ` +
      `The withdrawal happens after, and funds a different need: of the ${fmtUSD(gap)} spending gap, ` +
      `${fmtUSD(wdTax)} came from taxable and ${fmtUSD(wdRth)} from Roth, ` +
      `leaving ${fmtUSD(wdTrd)} to draw from pre-tax. ` +
      `Converting more would not have reduced the withdrawal — it would have added to it, ` +
      `because conversion tax is part of the same gap.`,
    amounts: { conv, headroomNominal, ceilForConv, baseOrdIncome, gap, wdTax, wdRth, wdTrd },
  };
}

function convDuringRmd(ctx: YearDecisionContext): YearDecision {
  const { ageA, year, rmdAmt, tradBalance, ceilForConv, headroomNominal, conv, gap } = ctx;
  return {
    year, ageA,
    code: 'conv-during-rmd',
    severity: 'info',
    binding: false,
    text: `Age ${ageA} — the RMD came first and shrank the conversion. ` +
      `Your ${fmtUSD(rmdAmt)} RMD is mandatory ordinary income and consumed that much bracket space ` +
      `before any conversion was considered; it also reduced the convertible pre-tax balance to ${fmtUSD(tradBalance)}. ` +
      `What remained below the ${fmtUSD(ceilForConv)} ceiling was ${fmtUSD(headroomNominal)}, ` +
      `and ${fmtUSD(conv)} was converted. ` +
      `The RMD is spending money, not a withdrawal, so it offsets your ${fmtUSD(gap)} of spending ` +
      `rather than appearing in the withdrawal columns.`,
    amounts: { rmdAmt, tradBalance, ceilForConv, headroomNominal, conv, gap },
  };
}

// ---------------------------------------------------------------------------
// Withdrawal notes
// ---------------------------------------------------------------------------

function spillReasonText(kind: SpillKind, ageA: number, spill: YearDecisionContext['spill']): string {
  switch (kind) {
    case 'no-window':
      return `age ${ageA} is not covered by any window in your policy`;
    case 'trad-cap':
      return `the window's traditional cap (${fmtUSD(spill?.tradCap ?? 0)}) limits this account`;
    case 'pct-unhonorable':
      return `account balances are too small to fill the requested percentages`;
    case 'balance-exhausted':
      return `all eligible accounts were exhausted`;
  }
}

function wdPolicySpill(ctx: YearDecisionContext): YearDecision {
  const { ageA, year, spill, spillWindow, gap, wdTax, wdTrd, wdRth } = ctx;
  if (!spill) throw new Error('wdPolicySpill called without spill');
  const totalWd = wdTax + wdTrd + wdRth;
  const pctTax = totalWd > 0 ? Math.round((wdTax / totalWd) * 100) : 0;
  const pctTrd = totalWd > 0 ? Math.round((wdTrd / totalWd) * 100) : 0;
  const pctRth = totalWd > 0 ? Math.round((wdRth / totalWd) * 100) : 0;
  const windowDesc = spillWindow
    ? `The window asks for ${Math.round(spillWindow.pctTaxable * 100)}% taxable / ` +
      `${Math.round(spillWindow.pctTraditional * 100)}% pre-tax / ` +
      `${Math.round(spillWindow.pctRoth * 100)}% Roth, but `
    : 'Your policy could not be honored: ';
  const reason = spillReasonText(spill.kind, ageA, spill);
  return {
    year, ageA,
    code: 'wd-policy-spill',
    severity: 'caution',
    binding: true,
    text: `Age ${ageA} — your withdrawal split could not be honored. ` +
      windowDesc +
      `${fmtUSD(spill.amount)} of the ${fmtUSD(gap)} needed could not be drawn that way — ` +
      `${reason}. ` +
      `The shortfall was refilled taxable → pre-tax → Roth, ` +
      `which is why the actual split is ${pctTax}/${pctTrd}/${pctRth}.`,
    amounts: { spillAmount: spill.amount, gap, wdTax, wdTrd, wdRth },
  };
}

function wdBracketOverride(ctx: YearDecisionContext): YearDecision {
  const { ageA, year, wdTrd, gap, wdTax, wdRth } = ctx;
  return {
    year, ageA,
    code: 'wd-bracket-override',
    severity: 'caution',
    binding: true,
    text: `Age ${ageA} — the bracket-fill ceiling was overridden. ` +
      `Taxable and Roth accounts could not cover the ${fmtUSD(gap)} spending need on their own, ` +
      `so ${fmtUSD(wdTrd)} was drawn from the pre-tax account past the bracket ceiling. ` +
      `Taxable covered ${fmtUSD(wdTax)} and Roth ${fmtUSD(wdRth)}.`,
    amounts: { gap, wdTrd, wdTax, wdRth },
  };
}

function wdBracketfillRoom(ctx: YearDecisionContext): YearDecision {
  const { ageA, year, bracketfillRoom, ceilForConv } = ctx;
  return {
    year, ageA,
    code: 'wd-bracketfill-room',
    severity: 'info',
    binding: false,
    text: `Age ${ageA} — the withdrawal preset filled the bracket up to ${fmtUSD(ceilForConv)}. ` +
      `${fmtUSD(bracketfillRoom)} of room remained after the pre-tax draw; ` +
      `remaining spending came from Roth and taxable.`,
    amounts: { bracketfillRoom, ceilForConv },
  };
}

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

export function buildYearDecisions(ctx: YearDecisionContext): YearDecision[] {
  const notes: YearDecision[] = [];

  if (ctx.conv > 1) {
    // Exactly one binding conversion-sizing note per year.
    const bindingConv = ctx.headroomNominal <= ctx.maxConv
      ? convBracketHeadroom(ctx)
      : convTradCap(ctx);
    notes.push(bindingConv);

    // Non-binding pattern callouts (can coexist).
    if (ctx.wdTrd > 1) notes.push(convWithTradWd(ctx));
    if (ctx.rmdAmt > 1) notes.push(convDuringRmd(ctx));
  } else if (ctx.convPolicyZero) {
    notes.push(convPolicyZero(ctx));
  }

  // At most one binding withdrawal-sizing note per year.
  if (ctx.spill && ctx.spill.amount > 0.01) {
    notes.push(wdPolicySpill(ctx));
  } else if (ctx.bracketOverridden) {
    notes.push(wdBracketOverride(ctx));
  }

  // Non-binding bracketfill informational note.
  if (ctx.isActiveBracketfill && ctx.bracketfillRoom > 1) {
    notes.push(wdBracketfillRoom(ctx));
  }

  return notes;
}
