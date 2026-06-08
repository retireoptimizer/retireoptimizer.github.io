/**
 * Number-formatting discipline. Use the right helper for the right surface:
 *
 *   - KPI tiles, big headline numbers   →  fmtM / fmtK     ($5.2M, $540K)
 *   - Chart axis ticks                  →  fmtCompact      ($5.2M)        (in charts/setup.ts)
 *   - Chart tooltips, tables            →  fmtFull         ($5,234,000)
 *   - Inputs                            →  the NumberInput component handles live comma formatting
 *
 * Returning the empty placeholder '—' for non-finite values is intentional —
 * never render `NaN` or `Infinity` to the user.
 */

export const fmtUSD = (n: number): string => {
  if (!isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.round(Math.abs(n)).toLocaleString();
};

/** Full precision dollars with grouping commas. Use in tables and chart tooltips. */
export const fmtFull = (n: number): string => fmtUSD(n);

export const fmtK = (n: number): string => {
  if (!isFinite(n) || n === 0) return '—';
  return '$' + Math.round(n / 1000).toLocaleString() + 'K';
};

export const fmtM = (n: number): string => {
  if (!isFinite(n) || n === 0) return '—';
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  return fmtK(n);
};

/** Signed compact: '+$5.2M' / '-$540K'. For deltas on KPI cards or comparison rows. */
export const fmtCompactWithSign = (n: number): string => {
  if (!isFinite(n) || n === 0) return '$0';
  const sign = n > 0 ? '+' : '-';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(2) + 'M';
  if (abs >= 1_000) return sign + '$' + Math.round(abs / 1_000).toLocaleString() + 'K';
  return sign + '$' + Math.round(abs).toLocaleString();
};

export const fmtPct = (n: number, digits = 1): string => {
  if (!isFinite(n)) return '—';
  return (n * 100).toFixed(digits) + '%';
};

export const toReal = (nominal: number, inflationFactor: number): number => {
  return nominal / inflationFactor;
};

/** Format a number string with grouping commas while preserving trailing decimals.
 *  Used by NumberInput for live-while-typing display. Returns the input unchanged
 *  if it's not a parseable number, so the user's intermediate text isn't disturbed. */
export const formatWithCommas = (raw: string): string => {
  if (raw === '' || raw === '-' || raw === '.' || raw === '-.') return raw;
  const negative = raw.startsWith('-');
  const body = negative ? raw.slice(1) : raw;
  const [intPart, decPart] = body.split('.');
  if (intPart === '' || !/^\d+$/.test(intPart)) return raw;
  const grouped = parseInt(intPart, 10).toLocaleString();
  const out = decPart !== undefined ? `${grouped}.${decPart}` : grouped;
  return negative ? '-' + out : out;
};
