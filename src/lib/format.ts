export const fmtUSD = (n: number): string => {
  if (!isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.round(Math.abs(n)).toLocaleString();
};

export const fmtK = (n: number): string => {
  if (!isFinite(n) || n === 0) return '—';
  return '$' + Math.round(n / 1000).toLocaleString() + 'K';
};

export const fmtM = (n: number): string => {
  if (!isFinite(n) || n === 0) return '—';
  if (Math.abs(n) >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  return fmtK(n);
};

export const fmtPct = (n: number, digits = 1): string => {
  if (!isFinite(n)) return '—';
  return (n * 100).toFixed(digits) + '%';
};

export const toReal = (nominal: number, inflationFactor: number): number => {
  return nominal / inflationFactor;
};
