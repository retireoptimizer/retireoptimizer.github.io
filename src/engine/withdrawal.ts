import { PRESETS, findWindow, type PresetKey, type BlendPolicy } from './blendPolicy';

export interface WithdrawalInputs {
  strategy: PresetKey;
  gap: number;
  taxable: number;
  traditional: number;
  roth: number;
  rmd: number;
  ssA: number;
  ssB: number;
  ssTaxablePct: number;
  stdD: number;
  inflationFactor: number;
}

export interface WithdrawalOutputs {
  wdTax: number;
  wdTrd: number;
  wdRth: number;
}

export function applyWithdrawalOrder(inp: WithdrawalInputs): WithdrawalOutputs {
  const { strategy, taxable, traditional, roth, ssA, ssB, ssTaxablePct, stdD, inflationFactor } = inp;
  let rem = Math.max(0, inp.gap);
  let wdTax = 0, wdTrd = 0, wdRth = 0;

  const preset = PRESETS[strategy];

  if (preset.kind === 'proportional') {
    const total = taxable + traditional + roth;
    if (total > 0 && rem > 0) {
      wdTax = Math.min(taxable, rem * (taxable / total));
      wdTrd = Math.min(traditional, rem * (traditional / total));
      wdRth = Math.min(roth, rem * (roth / total));
      const filled = wdTax + wdTrd + wdRth;
      const leftover = rem - filled;
      if (leftover > 0.01) {
        const remTaxable = taxable - wdTax;
        const remTrad = traditional - wdTrd;
        const remRoth = roth - wdRth;
        if (remTaxable >= remTrad && remTaxable >= remRoth) wdTax += Math.min(remTaxable, leftover);
        else if (remTrad >= remRoth) wdTrd += Math.min(remTrad, leftover);
        else wdRth += Math.min(remRoth, leftover);
      }
    }
  } else if (preset.kind === 'bracketfill') {
    const bracketTop12 = 96950 * inflationFactor;
    const baseOrdInc = ssA * ssTaxablePct + ssB * ssTaxablePct;
    const roomIn12 = Math.max(0, bracketTop12 - stdD - baseOrdInc);
    wdTrd = Math.min(traditional, Math.min(roomIn12, rem));
    rem -= wdTrd;
    if (roth > 0 && rem > 0) { wdRth = Math.min(roth, rem); rem -= wdRth; }
    if (taxable > 0 && rem > 0) { wdTax = Math.min(taxable, rem); }
  } else {
    const order = preset.order!;
    for (const src of order) {
      if (rem <= 0) break;
      if (src === 'tax' && taxable > 0) { wdTax = Math.min(taxable, rem); rem -= wdTax; }
      else if (src === 'trad' && traditional > 0) { wdTrd = Math.min(traditional, rem); rem -= wdTrd; }
      else if (src === 'roth' && roth > 0) { wdRth = Math.min(roth, rem); rem -= wdRth; }
    }
  }

  return { wdTax, wdTrd, wdRth };
}

/**
 * Apply a custom blend policy: find the active age window, allocate the gap
 * by its percentages (honoring balance and optional Trad cap), then spill any
 * shortfall to Taxable → Traditional → Roth in order.
 */
export function applyBlendPolicy(inp: {
  policy: BlendPolicy;
  ageA: number;
  gap: number;
  taxable: number;
  traditional: number;
  roth: number;
}): WithdrawalOutputs {
  const rem = Math.max(0, inp.gap);
  if (rem <= 0) {
    return { wdTax: 0, wdTrd: 0, wdRth: 0 };
  }
  const w = findWindow(inp.policy, inp.ageA);
  // When the active age isn't covered by any window (manual-blend gaps, or a scenario that
  // shifts retirement age outside the optimizer's window range), spill the entire gap
  // taxable→traditional→roth so the projection still funds expenses rather than silently
  // recording unfilled withdrawals.
  if (!w) {
    let r = rem;
    const wdTaxF = Math.min(inp.taxable, r); r -= wdTaxF;
    const wdTrdF = Math.min(inp.traditional, r); r -= wdTrdF;
    const wdRthF = Math.min(inp.roth, r);
    return { wdTax: wdTaxF, wdTrd: wdTrdF, wdRth: wdRthF };
  }

  let wdTax = Math.min(inp.taxable, rem * w.pctTaxable);
  let wdTrd = Math.min(inp.traditional, rem * w.pctTraditional);
  let wdRth = Math.min(inp.roth, rem * w.pctRoth);

  if (w.tradCap != null && wdTrd > w.tradCap) {
    wdTrd = Math.max(0, Math.min(inp.traditional, w.tradCap));
  }

  let leftover = rem - (wdTax + wdTrd + wdRth);
  if (leftover > 0.01) {
    const addTax = Math.min(inp.taxable - wdTax, leftover);
    wdTax += addTax; leftover -= addTax;
  }
  if (leftover > 0.01) {
    const addTrd = Math.min(inp.traditional - wdTrd, leftover);
    wdTrd += addTrd; leftover -= addTrd;
  }
  if (leftover > 0.01) {
    const addRth = Math.min(inp.roth - wdRth, leftover);
    wdRth += addRth;
  }

  return { wdTax, wdTrd, wdRth };
}
