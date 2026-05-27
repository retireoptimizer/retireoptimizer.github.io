import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { bucketColors, palette } from './setup';
import type { ProjectionResult } from '../../engine/projection';

interface Props {
  proj: ProjectionResult;
  height?: number;
}

/** 100%-stacked area showing how the bucket MIX evolves over time. */
export default function BucketCompositionStacked({ proj, height = 220 }: Props) {
  const rows = proj.rows;
  const labels = rows.map((r) => r.ageA);
  const pct = (n: number, total: number) => (total > 0 ? (n / total) * 100 : 0);

  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Taxable',
        data: rows.map((r) => +pct(r.endTaxable, r.endTotal).toFixed(2)),
        backgroundColor: bucketColors.taxable + 'cc',
        borderColor: bucketColors.taxable,
        borderWidth: 1,
        fill: 'origin',
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: 'Pre-tax 401(k)/IRA',
        data: rows.map((r) => +pct(r.endTraditional, r.endTotal).toFixed(2)),
        backgroundColor: palette.warning + 'cc',
        borderColor: palette.warning,
        borderWidth: 1,
        fill: '-1',
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: 'Roth',
        data: rows.map((r) => +pct(r.endRoth, r.endTotal).toFixed(2)),
        backgroundColor: bucketColors.roth + 'cc',
        borderColor: bucketColors.roth,
        borderWidth: 1,
        fill: '-1',
        pointRadius: 0,
        tension: 0.25,
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
          label: (item) => `${item.dataset.label}: ${(item.parsed.y ?? 0).toFixed(1)}%`,
        },
      },
    },
    scales: {
      y: {
        stacked: true,
        min: 0,
        max: 100,
        ticks: { callback: (v) => `${v}%` },
        grid: { color: palette.borderLight },
      },
      x: { grid: { display: false } },
    },
  };

  return (
    <div style={{ position: 'relative', height }}>
      <Line data={data} options={options} />
    </div>
  );
}
