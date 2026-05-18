export type FilingStatus = 'MFJ' | 'Single';

/**
 * Per IRS: surviving spouse may file MFJ for year of death and the next 2 years,
 * then Single. If single in plan (no personB) → always Single.
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
  // One has passed. Determine the year of death and apply 2-year grace.
  const deathOfA = !aAlive ? passingAgeA - startAgeA : Infinity;
  const deathOfB = !bAlive ? passingAgeB - startAgeB : Infinity;
  const deathYear = Math.min(deathOfA, deathOfB);
  return yearIndex - deathYear <= 2 ? 'MFJ' : 'Single';
}
