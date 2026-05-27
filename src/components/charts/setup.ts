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
};

export const bucketColors = {
  taxable: palette.success,
  traditional: palette.navy,
  roth: palette.gold,
};

export const fmtCompact = (n: number): string => {
  if (!isFinite(n)) return '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1) + 'M';
  if (abs >= 1_000) return '$' + Math.round(n / 1_000) + 'K';
  return '$' + Math.round(n);
};
