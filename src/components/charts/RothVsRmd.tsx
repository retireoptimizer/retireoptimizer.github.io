import { Bar } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact } from './setup';
import type { ProjectionResult } from '../../engine/projection';

interface Props {
  proj: ProjectionResult;
  real?: boolean;
  height?: number;
}

export default function RothVsRmd({ proj, real = true, height = 220 }: Props) {
  const rows = proj.rows.filter((r) => r.rothConv > 0 || r.rmd > 0);
  const labels = rows.map((r) => r.ageA);
  const scale = (n: number, inf: number) => (real ? n / inf : n);

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Roth Conversions',
        data: rows.map((r) => scale(r.rothConv, r.inflationFactor)),
        backgroundColor: palette.gold,
      },
      {
        label: 'RMDs',
        data: rows.map((r) => scale(r.rmd, r.inflationFactor)),
        backgroundColor: palette.warning,
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
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
      x: { grid: { display: false } },
      y: {
        ticks: { callback: (v) => fmtCompact(Number(v)) },
        grid: { color: palette.borderLight },
      },
    },
  };

  return (
    <div style={{ position: 'relative', height }}>
      <Bar data={data} options={options} />
    </div>
  );
}
