import { FPL_BASE, FPL_INCREMENT, ACA_PCT_BANDS } from './taxConstants';

/** Annual federal poverty level for a given household size (2026, 48 contiguous states + DC). */
export function federalPovertyLevel(householdSize: number): number {
  return FPL_BASE + Math.max(0, householdSize - 1) * FPL_INCREMENT;
}

/**
 * ACA applicable percentage for a given FPL ratio (linearly interpolated per IRS Rev. Proc. 2024-35).
 * Returns the fraction of MAGI the household must contribute toward the benchmark premium.
 */
function applicablePercentage(fplRatio: number): number {
  for (const [fplLow, fplHigh, pctLow, pctHigh] of ACA_PCT_BANDS) {
    if (fplRatio >= fplLow && fplRatio < fplHigh) {
      const t = (fplRatio - fplLow) / (fplHigh - fplLow);
      return pctLow + t * (pctHigh - pctLow);
    }
  }
  return Infinity; // ≥400% FPL: ARP/IRA subsidies expired Dec 2025; cliff restored — no APTC
}

/**
 * Net annual ACA marketplace premium after the advance premium tax credit (APTC).
 *
 * The APTC offsets the portion of the benchmark (SLCSP) premium above the household's
 * required contribution (applicable_pct × MAGI). The household pays the lesser of:
 *   - the full benchmark premium (no subsidy when income is very high), or
 *   - applicable_percentage × MAGI.
 *
 * Returns 0 when:
 *   - annualBenchmarkPremium is 0 (user hasn't entered a premium),
 *   - MAGI is below 100% FPL (marketplace eligibility requires ≥100% FPL), or
 *   - MAGI is between 100-133% FPL (Medicaid-eligible range — no marketplace premium).
 *
 * @param magi                    Household MAGI for the year
 * @param householdSize           Tax household size (for FPL lookup)
 * @param annualBenchmarkPremium  Annual SLCSP cost for the household (user-entered, inflation-scaled)
 */
export function acaNetPremium(params: {
  magi: number;
  householdSize: number;
  annualBenchmarkPremium: number;
}): number {
  const { magi, householdSize, annualBenchmarkPremium } = params;
  if (annualBenchmarkPremium <= 0 || magi <= 0) return 0;

  const fpl = federalPovertyLevel(householdSize);
  const fplRatio = magi / fpl;

  if (fplRatio < 1.00) return annualBenchmarkPremium; // below poverty: no APTC available
  if (fplRatio < 1.33) return 0;                      // Medicaid-eligible: no marketplace premium

  const appPct = applicablePercentage(fplRatio);
  if (!isFinite(appPct)) return annualBenchmarkPremium; // above 400% FPL cliff: no APTC
  const maxContribution = appPct * magi;
  return Math.min(annualBenchmarkPremium, Math.max(0, maxContribution));
}
