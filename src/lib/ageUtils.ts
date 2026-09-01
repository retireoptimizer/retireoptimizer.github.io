/**
 * Exact age as of today using full DOB, not just birth year.
 * Returns the last birthday age, not the "age you turn this year."
 */
export function exactAgeFromDob(iso: string): number {
  if (!iso || iso.length < 10) return 0;
  const dob = new Date(iso);
  if (isNaN(dob.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hadBirthday =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hadBirthday) age -= 1;
  return age;
}

/**
 * Calendar-year age: the age the person turns this calendar year (= what the engine uses).
 * Matches projection.ts ageAt() — planStartYear - birthYear.
 */
export function calendarYearAge(iso: string): number {
  if (!iso || iso.length < 4) return 0;
  return new Date().getFullYear() - parseInt(iso.slice(0, 4), 10);
}

/**
 * Age chip label: shows exact age and, if the birthday hasn't happened yet this year,
 * a note that they turn (calendarYearAge) this year.
 */
export function ageChipLabel(iso: string): string {
  const exact = exactAgeFromDob(iso);
  const cal = calendarYearAge(iso);
  if (exact <= 0) return 'Invalid';
  if (cal > exact) return `Age ${exact} · turns ${cal} this year`;
  return `Age ${exact}`;
}
