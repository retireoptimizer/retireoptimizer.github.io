import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { bucketColors, palette } from './setup';
import type { ProjectionResult } from '../../engine/projection';
import { fmtM } from '../../lib/format';

interface Props {
  proj: ProjectionResult;
  real?: boolean;
  height?: number;
}

/** 100%-stacked area showing how the bucket MIX evolves over time. */
export default function BucketCompositionStacked({ proj, real = true, height = 220 }: Props) {
  const rows = proj.rows;
  const labels = rows.map((r) => r.ageA);
  const pct = (n: number, total: number) => (total > 0 ? (n / total) * 100 : 0);
  const scale = (n: number, inf: number) => (real ? n / inf : n);

  const dollars = {
    taxable: rows.map((r) => scale(r.endTaxable, r.inflationFactor)),
    traditional: rows.map((r) => scale(r.endTraditional, r.inflationFactor)),
    roth: rows.map((r) => scale(r.endRoth, r.inflationFactor)),
    total: rows.map((r) => scale(r.endTotal, r.inflationFactor)),
  };

  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Taxable',
        data: rows.map((r) => +pct(r.endTaxable, r.endTotal).toFixed(2)),
        // @ts-expect-error custom property for tooltip
        rawDollars: dollars.taxable,
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
        // @ts-expect-error custom property for tooltip
        rawDollars: dollars.traditional,
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
        // @ts-expect-error custom property for tooltip
        rawDollars: dollars.roth,
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
          title: (items) => {
            const i = items[0].dataIndex;
            const total = dollars.total[i] ?? 0;
            return `Age ${items[0].label}  ·  Total ${fmtM(total)}`;
          },
          label: (item) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const raw = (item.dataset as any).rawDollars?.[item.dataIndex] ?? 0;
            return `${item.dataset.label}: ${(item.parsed.y ?? 0).toFixed(1)}%  (${fmtM(raw)})`;
          },
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
