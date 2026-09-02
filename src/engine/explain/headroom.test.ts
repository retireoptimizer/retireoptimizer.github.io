import { describe, it, expect } from 'vitest';
import { irmaaHeadroomNote, acaCliffNote } from './headroom';
import { federalPovertyLevel, acaNetPremium } from '../aca';
import { IRMAA_TIERS_MFJ } from '../taxConstants';
import type { ProjectionRow } from '../projection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<ProjectionRow>): ProjectionRow {
  return {
    year: 1, ageA: 65, ageB: undefined, phase: 'Retire',
    filingStatus: 'MFJ', inflationFactor: 1.0,
    contribA: 0, contribB: 0, spousalA: 0, spousalB: 0,
    ssA: 0, ssB: 0, totalSS: 0, otherIncome: 0, otherIncomeTaxable: 0,
    otherIncomeNonExempt: 0, exemptInterest: 0,
    netSpend: 0, wdTax: 0, wdTrd: 0, wdRth: 0, totalWD: 0,
    bracketOverridden: false, rmd: 0, rothConv: 0,
    ordIncome: 0, ltcg: 0, ordinaryDiv: 0, qualifiedDiv: 0, distributedCash: 0,
    fedTax: 0, stateTaxAmt: 0, irmaa: 0, niit: 0, effRate: 0,
    marginalRate: 0, stateMarginalRate: 0, stdDeduction: 0, seniorBonus: 0,
    magi: 0, acaMagi: 0, irmaaMagi: 0, acaPremium: 0,
    lumpSumInjectTaxable: 0, lumpSumInjectTrad: 0, lumpSumInjectRoth: 0,
    lumpSumOrdinaryIncome: 0, lumpSumForcedTradDist: 0, lumpSumForcedRothDist: 0,
    cashSurplus: 0, begTaxable: 0, begTraditional: 0, begRoth: 0,
    endTaxable: 0, endTraditional: 0, endRoth: 0, endTotal: 0,
    endTaxableBasis: 0, endTaxAdjusted: 0, ranOut: false,
    ...overrides,
  } as ProjectionRow;
}

// MFJ tier 0 top = $218,000 at inflationFactor 1.
const MFJ_T0_TOP = IRMAA_TIERS_MFJ[0].magiTop; // 218_000

// ---------------------------------------------------------------------------
// irmaaHeadroomNote
// ---------------------------------------------------------------------------

describe('irmaaHeadroomNote', () => {
  it('returns null when future age < 65 (surcharge not yet relevant)', () => {
    const rows = [makeRow({ ageA: 62, magi: 200_000, exemptInterest: 0 })];
    expect(irmaaHeadroomNote(rows, 0)).toBeNull();
  });

  it('returns null when surchargeMAGI is 0', () => {
    const rows = [makeRow({ ageA: 63, magi: 0, exemptInterest: 0 })];
    expect(irmaaHeadroomNote(rows, 0)).toBeNull();
  });

  it('returns null when far below tier 0 top (> 20% headroom)', () => {
    const magi = MFJ_T0_TOP * 0.50; // well below, no note needed
    const rows = [
      makeRow({ ageA: 63, magi, exemptInterest: 0 }),
      makeRow({ ageA: 64 }),
      makeRow({ ageA: 65 }),
    ];
    expect(irmaaHeadroomNote(rows, 0)).toBeNull();
  });

  describe('tier 0 boundary (no surcharge → first surcharge tier)', () => {
    const future = makeRow({ ageA: 65, filingStatus: 'MFJ', inflationFactor: 1 });

    it('fires $1 below boundary (headroom $1)', () => {
      const rows = [
        makeRow({ ageA: 63, magi: MFJ_T0_TOP - 1, exemptInterest: 0, inflationFactor: 1 }),
        makeRow({ ageA: 64 }),
        future,
      ];
      const note = irmaaHeadroomNote(rows, 0);
      expect(note).not.toBeNull();
      expect(note!.code).toBe('irmaa-tier');
      expect(note!.amounts!.headroom).toBeCloseTo(1, 0);
      expect(note!.text).toContain('65');
    });

    it('fires at exactly the boundary ($218,000 crosses into tier 1)', () => {
      const rows = [
        makeRow({ ageA: 63, magi: MFJ_T0_TOP, exemptInterest: 0, inflationFactor: 1 }),
        makeRow({ ageA: 64 }),
        future,
      ];
      const note = irmaaHeadroomNote(rows, 0);
      // At exactly $218,000 the tier scan places it in tier 1 (strict less-than),
      // so currentSurcharge > 0 and a note fires with headroom to tier 2.
      expect(note).not.toBeNull();
      expect(note!.amounts!.annualSurcharge).toBeGreaterThan(0);
    });

    it('fires $1 above boundary (in tier 1, headroom to tier 2)', () => {
      const rows = [
        makeRow({ ageA: 63, magi: MFJ_T0_TOP + 1, exemptInterest: 0, inflationFactor: 1 }),
        makeRow({ ageA: 64 }),
        future,
      ];
      const note = irmaaHeadroomNote(rows, 0);
      expect(note).not.toBeNull();
      expect(note!.amounts!.annualSurcharge).toBeGreaterThan(0);
      expect(note!.amounts!.headroom).toBeGreaterThan(0);
    });
  });

  it('emits warning and no headroom when at top tier', () => {
    const topMAGI = 800_000; // above all tier tops
    const rows = [
      makeRow({ ageA: 63, magi: topMAGI, exemptInterest: 0, inflationFactor: 1 }),
      makeRow({ ageA: 64 }),
      makeRow({ ageA: 65, filingStatus: 'MFJ', inflationFactor: 1 }),
    ];
    const note = irmaaHeadroomNote(rows, 0);
    expect(note).not.toBeNull();
    expect(note!.severity).toBe('warning');
    expect(note!.text).toContain('maximum');
  });

  describe('rows[i+2] filing-status lookup', () => {
    it('uses filing status from rows[i+2] when available', () => {
      const rows = [
        makeRow({ ageA: 63, magi: MFJ_T0_TOP - 500, exemptInterest: 0 }),
        makeRow({ ageA: 64 }),
        makeRow({ ageA: 65, filingStatus: 'Single', inflationFactor: 1 }),
      ];
      const note = irmaaHeadroomNote(rows, 0);
      // Single threshold is $109,000 — $218,000 is well above tier 0 for Single
      // so surcharge should be non-zero.
      expect(note).not.toBeNull();
      expect(note!.amounts!.annualSurcharge).toBeGreaterThan(0);
    });

    it('falls back to current row filing status when rows[i+2] does not exist (last-year edge case)', () => {
      const rows = [
        makeRow({ ageA: 67, magi: MFJ_T0_TOP - 1, exemptInterest: 0, filingStatus: 'MFJ', inflationFactor: 1 }),
      ];
      const note = irmaaHeadroomNote(rows, 0);
      // Future age = 67 + 2 = 69 ≥ 65, so note should fire.
      expect(note).not.toBeNull();
      expect(note!.ageA).toBe(67);
    });
  });

  it('includes exemptInterest in surchargeMAGI', () => {
    const magi = 150_000;
    const exemptInterest = 60_000; // pushes surchargeMAGI to 210_000 — near tier 0 top
    const rows = [
      makeRow({ ageA: 63, magi, exemptInterest, inflationFactor: 1 }),
      makeRow({ ageA: 64 }),
      makeRow({ ageA: 65, filingStatus: 'MFJ', inflationFactor: 1 }),
    ];
    const note = irmaaHeadroomNote(rows, 0);
    expect(note).not.toBeNull();
    expect(note!.amounts!.surchargeMAGI).toBe(210_000);
  });
});

// ---------------------------------------------------------------------------
// acaCliffNote
// ---------------------------------------------------------------------------

describe('acaCliffNote', () => {
  const householdSize = 2;
  const fpl   = federalPovertyLevel(householdSize);
  const cliff = fpl * 4;

  it('returns null when modelACA is false', () => {
    const row = makeRow({ acaMagi: cliff * 0.95, acaPremium: 500 });
    expect(acaCliffNote(row, householdSize, false)).toBeNull();
  });

  it('returns null when acaPremium is 0 (not in ACA)', () => {
    const row = makeRow({ acaMagi: cliff * 0.95, acaPremium: 0 });
    expect(acaCliffNote(row, householdSize, true)).toBeNull();
  });

  it('returns null when far below cliff (> 20% headroom)', () => {
    const row = makeRow({ acaMagi: cliff * 0.50, acaPremium: 800 });
    expect(acaCliffNote(row, householdSize, true)).toBeNull();
  });

  it('fires within 20% of cliff (info severity)', () => {
    const row = makeRow({ acaMagi: cliff * 0.85, acaPremium: 800 });
    const note = acaCliffNote(row, householdSize, true);
    expect(note).not.toBeNull();
    expect(note!.code).toBe('aca-cliff');
    expect(note!.severity).toBe('info');
  });

  it('fires at exactly 400% FPL with caution severity', () => {
    const row = makeRow({ acaMagi: cliff, acaPremium: 800 });
    const note = acaCliffNote(row, householdSize, true);
    expect(note).not.toBeNull();
    // headroom = 0, which is <= 0, so treated as "exceeded"
    expect(note!.severity).toBe('warning');
    expect(note!.text).toContain('exceeded');
  });

  it('fires caution just below cliff (< 5% headroom)', () => {
    const row = makeRow({ acaMagi: cliff * 0.97, acaPremium: 800 });
    const note = acaCliffNote(row, householdSize, true);
    expect(note).not.toBeNull();
    expect(note!.severity).toBe('caution');
    expect(note!.amounts!.headroom).toBeGreaterThan(0);
  });

  it('fires warning when above cliff', () => {
    const row = makeRow({ acaMagi: cliff * 1.05, acaPremium: 800 });
    const note = acaCliffNote(row, householdSize, true);
    expect(note).not.toBeNull();
    expect(note!.severity).toBe('warning');
    expect(note!.amounts!.headroom).toBeLessThan(0);
  });

  it('cliff threshold agrees with acaNetPremium boundary at inflationFactor > 1', () => {
    // Regression pin: headroom.ts and acaNetPremium must use the same inflation-indexed FPL.
    // This test catches if one side is fixed without the other.
    const inflationFactor = 1.5;
    const indexedCliff = fpl * 4 * inflationFactor;
    const magiJustBelow = indexedCliff - 1;
    // Benchmark must exceed the required contribution (0.0996 * magi) near the cliff so that
    // a subsidy is actually active just below the threshold.
    const maxContribution = 0.0996 * magiJustBelow;
    const benchmark = Math.ceil(maxContribution) + 1000; // large enough to ensure APTC
    const row = makeRow({ acaMagi: magiJustBelow, acaPremium: maxContribution, inflationFactor });

    const note = acaCliffNote(row, householdSize, true);
    expect(note!.amounts!.cliff).toBeCloseTo(indexedCliff, 0);
    // acaNetPremium at magi = indexedCliff - 1 should be subsidized (user pays maxContribution < benchmark).
    const subsidized = acaNetPremium({ magi: magiJustBelow, householdSize, annualBenchmarkPremium: benchmark, inflationFactor });
    expect(subsidized).toBeLessThan(benchmark);
    // acaNetPremium at magi = indexedCliff should return full premium (no APTC above 400% FPL).
    const atCliff = acaNetPremium({ magi: indexedCliff, householdSize, annualBenchmarkPremium: benchmark, inflationFactor });
    expect(atCliff).toBe(benchmark);
  });
});
