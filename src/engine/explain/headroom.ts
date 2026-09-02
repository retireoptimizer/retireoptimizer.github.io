// Pure post-hoc IRMAA and ACA headroom notes over already-built rows; zero engine coupling.
import type { ProjectionRow } from '../projection';
import type { YearDecision } from './yearDecisions';
import { IRMAA_TIERS_MFJ, IRMAA_TIERS_SINGLE } from '../taxConstants';
import { federalPovertyLevel } from '../aca';
import { fmtUSD } from '../../lib/format';

/**
 * Forward-framed IRMAA headroom: this year's surchargeMAGI (magi + exemptInterest) will be
 * used to compute the Medicare Part B surcharge two years hence. Emits when the future age
 * is Medicare-eligible and the user is in a surcharge tier or within 20% of the first tier.
 */
export function irmaaHeadroomNote(rows: ProjectionRow[], i: number): YearDecision | null {
  const row = rows[i];
  const surchargeMAGI = row.magi + row.exemptInterest;
  if (surchargeMAGI <= 0) return null;

  // The surcharge this MAGI will cause fires 2 years from now.
  const futureRow = rows[i + 2];
  const futureAge = futureRow?.ageA ?? (row.ageA + 2);
  if (futureAge < 65) return null;

  const futureFS = futureRow?.filingStatus ?? row.filingStatus;
  const futureIF  = futureRow?.inflationFactor ?? row.inflationFactor;
  const tiers     = futureFS === 'MFJ' ? IRMAA_TIERS_MFJ : IRMAA_TIERS_SINGLE;

  // Find which tier surchargeMAGI lands in (same scan as irmaaMonthlySurcharge).
  let tierIdx = tiers.length - 1;
  for (let t = 0; t < tiers.length; t++) {
    if (surchargeMAGI < tiers[t].magiTop * futureIF) { tierIdx = t; break; }
  }

  const currentSurcharge = (tiers[tierIdx].partB + tiers[tierIdx].partD) * 12;

  // At top tier: warning, no headroom to report.
  if (tierIdx === tiers.length - 1) {
    return {
      year: row.year, ageA: row.ageA, code: 'irmaa-tier',
      severity: 'warning', binding: false,
      text: `Age ${row.ageA} — income of ${fmtUSD(surchargeMAGI)} (IRMAA MAGI) sets ` +
        `the maximum Medicare surcharge at age ${futureAge}: ${fmtUSD(currentSurcharge)}/person/year.`,
      amounts: { surchargeMAGI, annualSurcharge: currentSurcharge },
    };
  }

  const threshold = tiers[tierIdx].magiTop * futureIF;
  const headroom  = threshold - surchargeMAGI;

  // Suppress when no surcharge yet AND far below first tier (> 20% of threshold away).
  if (currentSurcharge === 0 && headroom > threshold * 0.20) return null;

  const nextSurcharge = (tiers[tierIdx + 1].partB + tiers[tierIdx + 1].partD) * 12;
  const severity = headroom < threshold * 0.05 ? 'caution' : 'info';
  const tierDesc = currentSurcharge === 0
    ? `below the first IRMAA surcharge threshold`
    : `in an IRMAA surcharge tier (${fmtUSD(currentSurcharge)}/person/year)`;

  return {
    year: row.year, ageA: row.ageA, code: 'irmaa-tier',
    severity, binding: false,
    text: `Age ${row.ageA} — income of ${fmtUSD(surchargeMAGI)} (IRMAA MAGI) is ${tierDesc} ` +
      `and ${fmtUSD(headroom)} below the next threshold at age ${futureAge}; ` +
      `crossing it adds ${fmtUSD(nextSurcharge - currentSurcharge)}/person/year.`,
    amounts: { surchargeMAGI, headroom, threshold, annualSurcharge: currentSurcharge, nextAnnualSurcharge: nextSurcharge },
  };
}

/**
 * ACA cliff note: fires when the plan is modeling ACA and acaMagi is within 20% of the
 * 400% FPL cliff (or above it), where subsidies disappear entirely.
 */
export function acaCliffNote(row: ProjectionRow, householdSize: number, modelACA: boolean): YearDecision | null {
  if (!modelACA || row.acaPremium <= 0 || row.acaMagi <= 0) return null;

  const cliff   = federalPovertyLevel(householdSize) * 4 * row.inflationFactor;
  const headroom = cliff - row.acaMagi;

  if (headroom > 0 && headroom > cliff * 0.20) return null;

  const severity  = headroom <= 0 ? 'warning' : headroom < cliff * 0.05 ? 'caution' : 'info';
  const cliffDesc = headroom <= 0
    ? `has exceeded the 400% FPL threshold (${fmtUSD(cliff)})`
    : `is ${fmtUSD(headroom)} below the 400% FPL threshold (${fmtUSD(cliff)})`;

  return {
    year: row.year, ageA: row.ageA, code: 'aca-cliff',
    severity, binding: false,
    text: `Age ${row.ageA} — ACA MAGI of ${fmtUSD(row.acaMagi)} ${cliffDesc}. ` +
      `Exceeding this limit eliminates ACA premium subsidies entirely.`,
    amounts: { acaMagi: row.acaMagi, cliff, headroom },
  };
}
