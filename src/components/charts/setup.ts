import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend,
  Title,
);

ChartJS.defaults.font.family = "'DM Sans', 'Inter', system-ui, sans-serif";
ChartJS.defaults.font.size = 12;
ChartJS.defaults.color = '#4a6080';
ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
ChartJS.defaults.plugins.legend.labels.boxWidth = 8;
ChartJS.defaults.plugins.legend.labels.boxHeight = 8;
ChartJS.defaults.plugins.legend.labels.padding = 14;
ChartJS.defaults.plugins.tooltip.backgroundColor = 'rgba(13,27,46,0.94)';
ChartJS.defaults.plugins.tooltip.titleColor = '#f5e9c8';
ChartJS.defaults.plugins.tooltip.bodyColor = '#ffffff';
ChartJS.defaults.plugins.tooltip.padding = 10;
ChartJS.defaults.plugins.tooltip.cornerRadius = 6;
ChartJS.defaults.plugins.tooltip.titleFont = { weight: 600, size: 12 };
// Give the right edge of every chart enough canvas room for the tooltip box to
// flip left before it would clip. Chart.js auto-sets xAlign='right' (tooltip
// extends leftward from the caret) only when the caret passes the midpoint, so
// without padding the last ~10 data points can still clip at the canvas edge.
ChartJS.defaults.layout.padding = { right: 20 };

export const palette = {
  navy: '#0d1b2e',
  navyMid: '#162438',
  navyLight: '#1e3450',
  slate: '#2a4060',
  gold: '#c9a84c',
  goldLight: '#e8c97a',
  goldPale: '#f5e9c8',
  success: '#1a8a5a',
  successLight: '#a8d8be',
  warning: '#b8620a',
  warningLight: '#f0c089',
  danger: '#c0392b',
  textMuted: '#7a96b0',
  borderLight: 'rgba(13,27,46,0.08)',

  // Semantic tokens — prefer these over raw color names in chart code. Lets us
  // recolor a concept (e.g. "Other income") in one place without hunting through
  // every chart that referenced palette.slate.
  bucketTaxable: '#1a8a5a',   // success — matches the Taxable bucket convention
  bucketTrad:    '#0d1b2e',   // navy
  bucketRoth:    '#c9a84c',   // gold
  incomeOther:   '#3b5e8a',   // blue-slate — distinct from textMuted
  taxOther:      '#7a96b0',   // textMuted — kept for state-tax / IRMAA aggregate
  acaBar:        '#c0714d',   // warm coral — ACA premium (spend, not tax)
};

export const bucketColors = {
  taxable: palette.bucketTaxable,
  traditional: palette.bucketTrad,
  roth: palette.bucketRoth,
};

export const fmtCompact = (n: number): string => {
  if (!isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return '$' + Math.round(n / 1_000) + 'K';
  return '$' + Math.round(n);
};

/** Full-precision currency formatter for tooltips and tables. Mirrors fmtFull from lib/format.ts
 *  but is kept here so chart files can import a single setup module without crossing layers. */
export const fmtFull = (n: number): string => {
  if (!isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return sign + '$' + Math.round(Math.abs(n)).toLocaleString();
};

/** Common interaction config: hover anywhere in the chart highlights all datasets
 *  at that x-position. Used by line/bar charts where multiple datasets share a year. */
export const indexInteraction = { mode: 'index' as const, intersect: false };

/** Tooltip title showing "Age <n>" for age-indexed charts. */
export const ageTooltipTitle = (items: Array<{ label: string }>): string => `Age ${items[0]?.label ?? ''}`;
