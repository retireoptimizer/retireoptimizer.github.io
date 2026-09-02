import type { Plan } from '../../schemas/plan';
import type { OptimizeResult } from '../optimizer';
import type { PolicyRationale } from './optimizerRationale';
import type { DecisionTrace, Counterfactual } from './decisionTrace';
import { fmtM, fmtUSD, fmtPct, fmtCompactWithSign } from '../../lib/format';

const ADAPTATION_LABELS: Record<Counterfactual['adaptation'], string> = {
  're-adapted': 're-adapted',
  'policy-held': 'policy held',
  rescored: 'rescored',
};

export function buildDiagnosticsMarkdown(
  plan: Plan,
  result: OptimizeResult,
  rationale: PolicyRationale,
  trace: DecisionTrace | null,
): string {
  const lines: string[] = [];
  const push = (...items: string[]) => lines.push(...items);

  // ── Objective ────────────────────────────────────────────────────────────────
  push('## Optimizer Diagnostics', '');
  push(
    `**Goal:** ${result.goalLabel}  `,
    `**Result:** ${result.metricFormatted}  `,
    `**Projections evaluated:** ${result.evaluations.toLocaleString()}`,
    '',
  );
  push('### Objective definition');
  const a = plan.assumptions;
  push(
    `Scored on **tax-adjusted end balance** (today's $).  `,
    `Traditional balance haircut at **${fmtPct(a.taxAdjOrdRate)}** effective rate.` +
      (a.taxAdjLtcgRate > 0
        ? `  Taxable unrealized-gain haircut at **${fmtPct(a.taxAdjLtcgRate)}** LTCG rate.`
        : ''),
    '_Disclosure: state tax, IRMAA surcharges, and NIIT are excluded from terminal valuation._',
    '',
  );

  // ── Plan summary ──────────────────────────────────────────────────────────────
  push('### Plan summary');
  const persons = ([plan.personA, plan.personB] as const).filter(Boolean) as NonNullable<typeof plan.personA>[];
  for (const p of persons) {
    push(
      `**${p.name}** · retire ${p.retirementAge} · plan through ${p.planThroughAge}` +
        ` · SS claim ${p.ssClaimAge} (PIA ${fmtUSD(p.ssPIA)}/yr)`,
    );
  }
  push('');
  push(
    `**Returns** — Taxable ${fmtPct(a.taxableReturn)} · Traditional ${fmtPct(a.tradReturn)} · Roth ${fmtPct(a.rothReturn)}  `,
    `**Inflation** ${fmtPct(a.inflation)} · **Equity** ${fmtPct(a.equityPct)}`,
    '',
  );

  // ── Settings ──────────────────────────────────────────────────────────────────
  push('### Settings');
  if (trace && trace.settings.length > 0) {
    push('| Setting | Value | Effect |');
    push('|---|---|---|');
    for (const s of trace.settings) {
      const label = s.inert ? `${s.label} _(inert)_` : s.label;
      push(`| ${label} | ${s.value} | ${s.effect} |`);
    }
  } else {
    push('_(settings data unavailable)_');
  }
  push('');

  // ── Chosen policy windows ─────────────────────────────────────────────────────
  push('### Chosen policy (compacted)');
  if (result.policy.windows.length === 0) {
    push('_(no custom policy — plan defaults apply every year)_');
  } else {
    push('| Ages | Taxable | Trad | Roth | Conv/yr |');
    push('|---|---|---|---|---|');
    for (const w of result.policy.windows) {
      const conv = w.convAmt != null ? fmtUSD(w.convAmt) : 'auto';
      push(
        `| ${w.fromAge}–${w.toAge}` +
          ` | ${fmtPct(w.pctTaxable)}` +
          ` | ${fmtPct(w.pctTraditional)}` +
          ` | ${fmtPct(w.pctRoth)}` +
          ` | ${conv} |`,
      );
    }
  }
  push('');

  // ── Counterfactual ledger ──────────────────────────────────────────────────────
  push('### Counterfactual ledger');
  if (!trace || trace.counterfactuals.length === 0) {
    push('_(ledger unavailable)_');
  } else {
    push(`Chosen score: **${fmtM(trace.chosenScore)}** (today's $, tax-adjusted end balance)`);
    push('');
    push('| Alternative | Adaptation | End Bal (tax-adj) | Fed Tax | Conversions | vs Chosen | Note |');
    push('|---|---|---|---|---|---|---|');
    for (const cf of trace.counterfactuals) {
      const isRunnerUp = cf.id === trace.runnerUpId;
      const label = isRunnerUp ? `${cf.label} ★` : cf.label;
      const delta = cf.applicable ? fmtCompactWithSign(cf.delta) : '—';
      const endBal = cf.applicable ? fmtM(cf.score) : '—';
      const fedTax = cf.applicable ? fmtM(cf.lifetimeFedTaxReal) : '—';
      const convs = cf.applicable ? fmtM(cf.lifetimeConversionReal) : '—';
      const applicableNote = !cf.applicable ? 'not applicable' : cf.ranOut ? 'depletes' : '';
      const note = [applicableNote, cf.note].filter(Boolean).join('; ');
      push(`| ${label} | ${ADAPTATION_LABELS[cf.adaptation]} | ${endBal} | ${fedTax} | ${convs} | ${delta} | ${note} |`);
    }
    push('');
    push("_All figures in today's $. Negative 'vs Chosen' = chosen wins._");
  }
  push('');

  // ── Rate sensitivity ───────────────────────────────────────────────────────────
  push('### Rate sensitivity');
  if (trace?.ordRate) {
    const { activeRate, breakevenRate, atMinus5pp, atActive, atPlus5pp } = trace.ordRate;
    push(
      breakevenRate !== null
        ? `Conversions win as long as your future effective rate exceeds **${fmtPct(breakevenRate)}**; you assumed **${fmtPct(activeRate)}**.`
        : 'Rate sensitivity is negligible — both plans have similar end traditional balances.',
    );
    push('');
    push('| Rate | Conversion advantage |');
    push('|---|---|');
    push(`| ${fmtPct(activeRate - 0.05)} | ${fmtCompactWithSign(atMinus5pp)} |`);
    push(`| ${fmtPct(activeRate)} (assumed) | ${fmtCompactWithSign(atActive)} |`);
    push(`| ${fmtPct(activeRate + 0.05)} | ${fmtCompactWithSign(atPlus5pp)} |`);
  } else {
    push('_(rate sensitivity unavailable)_');
  }
  push('');

  // ── Narrative ──────────────────────────────────────────────────────────────────
  push('### Rationale narrative');
  push(`**${rationale.headline}**`, '');
  for (const section of rationale.sections) {
    if (section.items.length === 0) continue;
    push(`_${section.kind}_`, '');
    for (const item of section.items) {
      push(item, '');
    }
  }

  // ── Caveats ─────────────────────────────────────────────────────────────────────
  if (trace && trace.degraded.length > 0) {
    push('### Caveats');
    for (const note of trace.degraded) {
      push(`- ${note}`);
    }
    push('');
  }

  return lines.join('\n');
}

/** Copy diagnostics markdown to clipboard.
 *  Falls back to a hidden textarea when the Clipboard API is unavailable (non-HTTPS / older Safari). */
export async function copyDiagnosticsToClipboard(markdown: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(markdown);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = markdown;
    ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}
