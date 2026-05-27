import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact } from './setup';
import type { MonteCarloResult } from '../../engine/monteCarlo';

interface Props {
  mc: MonteCarloResult;
  height?: number;
}

export default function MonteCarloFan({ mc, height = 300 }: Props) {
  const data: ChartData<'line'> = {
    labels: mc.ages,
    datasets: [
      // Bottom 10% baseline (no fill)
      {
        label: 'p10',
        data: mc.p10,
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        pointRadius: 0,
        fill: false,
      },
      // p10-p25 lower band
      {
        label: 'p10-p25',
        data: mc.p25,
        borderColor: 'transparent',
        backgroundColor: palette.gold + '22',
        pointRadius: 0,
        fill: '-1',
      },
      // p25-p75 middle band
      {
        label: '25th–75th Percentile',
        data: mc.p75,
        borderColor: 'transparent',
        backgroundColor: palette.gold + '55',
        pointRadius: 0,
        fill: '-1',
      },
      // p75-p90 upper band
      {
        label: 'p75-p90',
        data: mc.p90,
        borderColor: 'transparent',
        backgroundColor: palette.gold + '22',
        pointRadius: 0,
        fill: '-1',
      },
      // Median line
      {
        label: 'Median Outcome',
        data: mc.p50,
        borderColor: palette.navy,
        backgroundColor: palette.navy,
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.2,
        fill: false,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { filter: (item) => item.text === 'Median Outcome' || item.text === '25th–75th Percentile' },
      },
      tooltip: {
        filter: (item) => item.dataset.label === 'Median Outcome' || item.dataset.label === '25th–75th Percentile' || item.dataset.label === 'p10' || item.dataset.label === 'p10-p25' || item.dataset.label === 'p75-p90',
        callbacks: {
          title: (items) => `Age ${items[0].label}`,
          label: (item) => {
            const lbl = item.dataset.label === 'p10' ? '10th pct' : item.dataset.label === 'p10-p25' ? '25th pct' : item.dataset.label === 'p75-p90' ? '90th pct' : item.dataset.label === '25th–75th Percentile' ? '75th pct' : 'Median';
            return `${lbl}: ${fmtCompact(item.parsed.y ?? 0)}`;
          },
        },
      },
    },
    scales: {
      y: { ticks: { callback: (v) => fmtCompact(Number(v)) }, grid: { color: palette.borderLight } },
      x: { grid: { display: false } },
    },
  };

  return (
    <div style={{ position: 'relative', height }}>
      <Line data={data} options={options} />
    </div>
  );
}
