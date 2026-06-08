import { Chart } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact, fmtFull, ageTooltipTitle } from './setup';
import type { ProjectionResult } from '../../engine/projection';

interface Props {
  proj: ProjectionResult;
  real?: boolean;
  height?: number;
}

/** Dual-axis: federal tax bars (left $) + effective rate line (right %). */
export default function TaxDrag({ proj, real = true, height = 220 }: Props) {
  const rows = proj.rows;
  const labels = rows.map((r) => r.ageA);
  const scale = (n: number, inf: number) => (real ? n / inf : n);

  const data: ChartData<'bar' | 'line'> = {
    labels,
    datasets: [
      {
        type: 'bar' as const,
        label: 'Federal Tax Paid',
        data: rows.map((r) => scale(r.fedTax, r.inflationFactor)),
        backgroundColor: palette.danger + 'aa',
        borderColor: palette.danger,
        borderWidth: 1,
        yAxisID: 'y',
      },
      {
        type: 'line' as const,
        label: 'Effective Rate',
        data: rows.map((r) => +(r.effRate * 100).toFixed(2)),
        borderColor: palette.gold,
        backgroundColor: palette.gold,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
        yAxisID: 'y1',
        fill: false,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          title: ageTooltipTitle,
          label: (item) => {
            const v = item.parsed.y ?? 0;
            return item.dataset.yAxisID === 'y1'
              ? `${item.dataset.label}: ${v.toFixed(1)}%`
              : `${item.dataset.label}: ${fmtFull(v)}`;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        position: 'left',
        ticks: { callback: (v) => fmtCompact(Number(v)) },
        grid: { color: palette.borderLight },
      },
      y1: {
        position: 'right',
        ticks: { callback: (v) => `${Number(v).toFixed(0)}%` },
        grid: { display: false },
        min: 0,
      },
    },
  };

  return (
    <div style={{ position: 'relative', height }}>
      <Chart type="bar" data={data as ChartData<'bar'>} options={options} />
    </div>
  );
}
