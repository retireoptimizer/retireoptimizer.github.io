import type { Plan } from '../../schemas/plan';
import type { OptimizeResult } from '../optimizer';
import type { Counterfactual, SettingImpact } from './decisionTrace';
import { fmtM, fmtK, fmtUSD } from '../../lib/format';

const PRESET_LABELS: Record<string, string> = {
  taxfirst:     'Taxable → Traditional → Roth',
  rothfirst:    'Roth → Traditional → Taxable',
  tradfirst:    'Traditional → Taxable → Roth',
  proportional: 'Proportional',
  bracketfill:  'Bracket-fill',
};

/** Returns true when the optimizer is directly setting per-year conversion amounts,
 *  bypassing the bracket-ceiling mode. projection.ts:483 checks policyConv != null and
 *  short-circuits rothConversion() entirely, so the ceiling has no effect on sizing. */
function convCeilingIsInert(plan: Plan, result: OptimizeResult): boolean {
  if ((plan.conversion.optimize ?? true) === false) return false;
  return result.perYearPolicy.windows.some((w) => w.convAmt != null);
}

/** Best applicable counterfactual label from a set of ids; null when none beat the chosen plan. */
function bestAlt(ids: string[], cfs: Counterfactual[]): string | undefined {
  const applicable = cfs.filter((c) => ids.includes(c.id) && c.applicable);
  if (applicable.length === 0) return undefined;
  const best = applicable.reduce((a, b) => (b.delta > a.delta ? b : a));
  return best.delta > 0 ? best.label : undefined;
}

/**
 * Build one row per plan knob describing its current value and whether it is live or inert.
 * The two bracket ceilings (withdrawal + conversion) are placed adjacent so the UI can render
 * an explicit disambiguator between them — they are independent controls that happen to share
 * the word "ceiling" and are easily conflated.
 */
export function buildSettingsImpact(
  plan: Plan,
  result: OptimizeResult,
  counterfactuals: Counterfactual[],
): SettingImpact[] {
  const items: SettingImpact[] = [];
  const hasCustomPolicy = plan.customPolicy != null;
  const conv = plan.conversion;
  const optimizerOwns = (conv.optimize ?? true) !== false;

  // ── Withdrawal order preset ──────────────────────────────────────────────────
  // Inert whenever a customPolicy (optimizer- or user-authored) is active, because
  // applyBlendPolicy is called instead of applyWithdrawalOrder (projection.ts:599–607).
  const presetLabel = PRESET_LABELS[plan.withdrawalStrategy] ?? plan.withdrawalStrategy;
  const presetIds = [
    'preset-taxfirst', 'preset-rothfirst', 'preset-tradfirst',
    'preset-proportional', 'preset-bracketfill',
  ];
  items.push({
    id: 'withdrawalPreset',
    label: 'Withdrawal order',
    value: presetLabel,
    effect: hasCustomPolicy
      ? `The optimizer built a per-year policy that supersedes this preset; the preset setting has no effect while an optimizer policy is active.`
      : `Draws accounts in ${presetLabel.toLowerCase()} order.`,
    cfIds: presetIds,
    bestAlternative: bestAlt(presetIds, counterfactuals),
    inert: hasCustomPolicy,
    inertReason: hasCustomPolicy
      ? 'Optimizer policy is active; withdrawal-order preset is not used.'
      : undefined,
  });

  // ── Withdrawal bracket ceiling ───────────────────────────────────────────────
  // Active only when withdrawalStrategy === 'bracketfill' AND no customPolicy
  // (projection.ts:605 is in the else-branch of the activePolicy check at :599).
  // NOTE: this ceiling controls withdrawal sizing only — see convBracketCeiling below.
  const wdCeilActive = plan.withdrawalStrategy === 'bracketfill' && !hasCustomPolicy;
  items.push({
    id: 'withdrawalBracketCeiling',
    label: 'Withdrawal bracket ceiling',
    value: fmtK(plan.withdrawalBracketCeiling),
    effect: wdCeilActive
      ? `Keeps withdrawals below ${fmtK(plan.withdrawalBracketCeiling)}/yr (today's $) to stay within the target bracket.`
      : plan.withdrawalStrategy !== 'bracketfill'
        ? `Only used when withdrawal order is "Bracket-fill"; current order is "${presetLabel}".`
        : 'Optimizer policy controls ordering; this ceiling has no effect.',
    cfIds: ['preset-bracketfill'],
    inert: !wdCeilActive,
    inertReason: !wdCeilActive
      ? (hasCustomPolicy
        ? 'Optimizer policy overrides the bracketfill preset.'
        : `Withdrawal order is "${presetLabel}", not "Bracket-fill".`)
      : undefined,
  });

  // ── Conversion mode ──────────────────────────────────────────────────────────
  const totalConvReal = result.projection.lifetimeConversionReal;
  let convModeValue: string;
  let convModeEffect: string;
  if (optimizerOwns) {
    convModeValue = 'Optimizer';
    convModeEffect = totalConvReal > 0
      ? `Optimizer scheduled ${fmtM(totalConvReal)} (today's $) in Roth conversions across the plan.`
      : 'Optimizer found no beneficial conversions for this plan.';
  } else if (conv.mode === 'off') {
    convModeValue = 'Off';
    convModeEffect = 'No Roth conversions are scheduled.';
  } else if (conv.mode === 'bracket-fill') {
    convModeValue = `Bracket-fill to ${fmtK(conv.bracketCeiling)}`;
    convModeEffect = totalConvReal > 0
      ? `Fills each year's bracket headroom up to ${fmtK(conv.bracketCeiling)} (today's $); ${fmtM(totalConvReal)} converted total.`
      : `Fills each year's bracket headroom up to ${fmtK(conv.bracketCeiling)} (today's $); no conversions ran this plan.`;
  } else if (conv.mode === 'manual') {
    convModeValue = 'Manual schedule';
    convModeEffect = totalConvReal > 0
      ? `Manual per-year schedule; ${fmtM(totalConvReal)} (today's $) converted total.`
      : 'Manual schedule is set but no conversions ran this plan.';
  } else {
    convModeValue = conv.mode;
    convModeEffect = totalConvReal > 0
      ? `${fmtM(totalConvReal)} (today's $) converted total.`
      : 'No conversions ran this plan.';
  }
  items.push({
    id: 'convMode',
    label: 'Conversion mode',
    value: convModeValue,
    effect: convModeEffect,
    cfIds: ['conv-off'],
  });

  // ── Conversion bracket ceiling ───────────────────────────────────────────────
  // DISTINCT from the withdrawal bracket ceiling above — this controls conversion sizing only.
  // Inert when the optimizer is directly setting per-year convAmt values (projection.ts:483
  // short-circuits rothConversion() when policyConv != null). Its only residual effect then
  // is the payTaxFromBrokerage estimate at projection.ts:448–450.
  const ceilInert = convCeilingIsInert(plan, result);
  const ceilIds = ['conv-ceil-12', 'conv-ceil-22', 'conv-ceil-24'];
  items.push({
    id: 'convBracketCeiling',
    label: 'Conversion bracket ceiling',
    value: fmtUSD(conv.bracketCeiling),
    effect: ceilInert
      ? `Bypassed — the optimizer sets per-year conversion amounts directly (projection.ts:483), so the ceiling does not limit sizing. Its only residual effect is the ${fmtUSD(Math.round(conv.bracketCeiling * 0.22))}-range pre-estimate used for payTaxFromBrokerage.`
      : `Caps conversions at income below ${fmtK(conv.bracketCeiling)}/yr (today's $); headroom above other ordinary income determines the annual conversion amount.`,
    cfIds: ceilIds,
    bestAlternative: bestAlt(ceilIds, counterfactuals),
    inert: ceilInert,
    inertReason: ceilInert
      ? 'Optimizer directly schedules per-year convAmt values; rothConversion() is short-circuited (projection.ts:483).'
      : undefined,
  });

  // ── Tax sourcing ─────────────────────────────────────────────────────────────
  // payTaxFromBrokerage pulls in two opposite directions:
  //   1. Shrinks the conversion estimate (projection.ts:449–452): fewer conversion taxes
  //      expected to hit spending, so the ceiling estimate shifts.
  //   2. Routes withdrawal tax off the taxable account before the withdrawal split prices it
  //      (projection.ts:592–608): the split sees only the net spending gap, not taxes.
  items.push({
    id: 'payTaxFromBrokerage',
    label: 'Tax payment source',
    value: plan.payTaxFromBrokerage ? 'Taxable account (separate)' : 'Embedded in withdrawal',
    effect: plan.payTaxFromBrokerage
      ? 'Tax bills are paid from the taxable account as a separate transaction before the withdrawal split runs. Your pre-tax and Roth accounts are not tapped to cover taxes; only the net spending gap is drawn from the chosen sequence.'
      : 'Taxes are priced inside the withdrawal gross-up. The withdrawal strategy draws enough to cover both spending and the resulting tax bill from the same pool.',
    cfIds: ['paytax-flip'],
    bestAlternative: bestAlt(['paytax-flip'], counterfactuals),
  });

  return items;
}
