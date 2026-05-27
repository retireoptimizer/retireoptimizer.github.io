import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact } from './setup';
import type { ComparisonResult } from '../../engine/comparison';

interface Props {
  cmp: ComparisonResult;
  height?: number;
}

export default function CumulativeTaxCompare({ cmp, height = 220 }: Props) {
  const labels = cmp.withConv.rows.map((r) => r.ageA);
  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'With Roth Conversions',
        data: cmp.cumulativeTaxWith,
        borderColor: palette.gold,
        backgroundColor: palette.gold + '33',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
        fill: false,
      },
      {
        label: 'No Conversions',
        data: cmp.cumulativeTaxNo,
        borderColor: palette.textMuted,
        backgroundColor: palette.textMuted + '33',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0.25,
        fill: false,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          title: (items) => `Age ${items[0].label}`,
          label: (item) => `${item.dataset.label}: ${fmtCompact(item.parsed.y ?? 0)}`,
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
