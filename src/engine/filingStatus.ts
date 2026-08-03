export type FilingStatus = 'MFJ' | 'Single';

/**
 * Per IRS: surviving spouse files MFJ for the year of death only, then Single.
 * (Qualifying Surviving Spouse status that extends MFJ rates 2 more years requires
 * a dependent child — not applicable for typical retirees.) Single in plan (no personB)
 * → always Single.
 *
 * @param yearIndex 0..N — year offset from plan start
 * @param passingAgeA / passingAgeB — passing age in plan years (or undefined for survivors)
 * @param startAgeA / startAgeB — age at year 0
 */
export function filingStatusForYear(
  yearIndex: number,
  startAgeA: number,
  passingAgeA: number,
  startAgeB?: number,
  passingAgeB?: number,
): FilingStatus {
  if (startAgeB === undefined || passingAgeB === undefined) return 'Single';
  const ageA = startAgeA + yearIndex;
  const ageB = startAgeB + yearIndex;
  const aAlive = ageA <= passingAgeA;
  const bAlive = ageB <= passingAgeB;
  if (aAlive && bAlive) return 'MFJ';
  if (!aAlive && !bAlive) return 'Single';
  // One has passed. Death year is already MFJ via the "both alive" branch above
  // (the deceased's age equals passingAge on that yearIndex). All subsequent years: Single.
  return 'Single';
}
