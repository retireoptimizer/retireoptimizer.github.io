import { Bar } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact } from './setup';
import type { ProjectionResult } from '../../engine/projection';

interface Props {
  proj: ProjectionResult;
  real?: boolean;
  height?: number;
}

export default function AnnualInflows({ proj, real = true, height = 220 }: Props) {
  const rows = proj.rows;
  const labels = rows.map((r) => r.ageA);
  const scale = (n: number, inf: number) => (real ? n / inf : n);

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Contributions',
        data: rows.map((r) => scale(r.contribA + r.contribB, r.inflationFactor)),
        backgroundColor: palette.gold,
        stack: 'inflow',
      },
      {
        label: 'Social Security',
        data: rows.map((r) => scale(r.totalSS, r.inflationFactor)),
        backgroundColor: palette.success,
        stack: 'inflow',
      },
      {
        label: 'Other Income',
        data: rows.map((r) => scale(r.otherIncome, r.inflationFactor)),
        backgroundColor: palette.slate,
        stack: 'inflow',
      },
      {
        label: 'Portfolio Withdrawals',
        data: rows.map((r) => scale(r.totalWD, r.inflationFactor)),
        backgroundColor: palette.navy,
        stack: 'inflow',
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
          title: (items) => `Age ${items[0].label}`,
          label: (item) => `${item.dataset.label}: ${fmtCompact(item.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: { stacked: true, ticks: { callback: (v) => fmtCompact(Number(v)) }, grid: { color: palette.borderLight } },
    },
  };

  return (
    <div style={{ position: 'relative', height }}>
      <Bar data={data} options={options} />
    </div>
  );
}
