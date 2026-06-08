import { describe, it, expect } from 'vitest';
import { previewAllPresets } from './presetPreview';
import { runProjection, depletionAge } from './projection';
import { planA_simple, planF_allTradCouple } from './__golden/plans';
import type { Plan } from '../schemas/plan';

const PRESETS: Plan['withdrawalStrategy'][] = [
  'taxfirst', 'rothfirst', 'tradfirst', 'proportional', 'bracketfill',
];

describe('previewAllPresets correctness', () => {
  it('matches a direct runProjection for each preset on planA_simple', () => {
    const plan = planA_simple();
    const preview = previewAllPresets(plan);
    for (const preset of PRESETS) {
      const direct = runProjection({ ...plan, withdrawalStrategy: preset, customPolicy: undefined });
      const dep = depletionAge(direct);
      expect(preview[preset].endBalance).toBeCloseTo(direct.endTotalReal, 0);
      expect(preview[preset].lifetimeFedTax).toBeCloseTo(direct.lifetimeFedTax, 0);
      expect(preview[preset].longevityAge).toBe(dep ?? plan.personA.planToAge);
      expect(preview[preset].lasts).toBe(dep === null);
    }
  });

  it('matches a direct runProjection on a stress plan (planF_allTradCouple)', () => {
    const plan = planF_allTradCouple();
    const preview = previewAllPresets(plan);
    for (const preset of PRESETS) {
      const direct = runProjection({ ...plan, withdrawalStrategy: preset, customPolicy: undefined });
      expect(preview[preset].endBalance).toBeCloseTo(direct.endTotalReal, 0);
      expect(preview[preset].lifetimeFedTax).toBeCloseTo(direct.lifetimeFedTax, 0);
    }
  });

  it('ignores any existing customPolicy so previews reflect each preset\'s pure behavior', () => {
    // Force a customPolicy that would dominate withdrawals — preview must still
    // differ across presets (else the policy is leaking through).
    const base = planA_simple();
    const planWithPolicy: Plan = {
      ...base,
      customPolicy: {
        windows: [
          { fromAge: 65, toAge: 95, pctTaxable: 0, pctTraditional: 1, pctRoth: 0, convAmt: 0 },
        ],
      },
    };
    const preview = previewAllPresets(planWithPolicy);
    const values = PRESETS.map((p) => preview[p].endBalance);
    const unique = new Set(values.map((v) => Math.round(v / 1000)));
    expect(unique.size).toBeGreaterThan(1);
  });
});
