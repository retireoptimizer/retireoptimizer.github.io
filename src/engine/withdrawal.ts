import { PRESETS, type PresetKey } from './blendPolicy';

export interface WithdrawalInputs {
  strategy: PresetKey;
  gap: number;             // dollars to raise (net spending need - SS - other income - rmd)
  taxable: number;
  traditional: number;
  roth: number;
  rmd: number;
  ssA: number;
  ssB: number;
  ssTaxablePct: number;    // typically 0.85
  stdD: number;
  inflationFactor: number;
}

export interface WithdrawalOutputs {
  wdTax: number;           // from taxable brokerage (in addition to RMD)
  wdTrd: number;           // from traditional (in addition to RMD)
  wdRth: number;           // from Roth
}

/**
 * Given the user's strategy + dollar gap to fund, decide how much to draw from each bucket.
 * RMDs are assumed to already be subtracted from `gap` upstream (they are forced).
 */
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
        // Fill shortfall from largest remaining bucket
        const remTaxable = taxable - wdTax;
        const remTrad = traditional - wdTrd;
        const remRoth = roth - wdRth;
        if (remTaxable >= remTrad && remTaxable >= remRoth) wdTax += Math.min(remTaxable, leftover);
        else if (remTrad >= remRoth) wdTrd += Math.min(remTrad, leftover);
        else wdRth += Math.min(remRoth, leftover);
      }
    }
  } else if (preset.kind === 'bracketfill') {
    // Fill 12% bracket with Traditional, residual from Roth then Taxable
    const bracketTop12 = 96950 * inflationFactor;
    const baseOrdInc = ssA * ssTaxablePct + ssB * ssTaxablePct;
    const roomIn12 = Math.max(0, bracketTop12 - stdD - baseOrdInc);
    wdTrd = Math.min(traditional, Math.min(roomIn12, rem));
    rem -= wdTrd;
    if (roth > 0 && rem > 0) { wdRth = Math.min(roth, rem); rem -= wdRth; }
    if (taxable > 0 && rem > 0) { wdTax = Math.min(taxable, rem); rem -= wdTax; }
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
