import { Bar } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact } from './setup';
import type { ProjectionResult } from '../../engine/projection';

interface Props {
  proj: ProjectionResult;
  real?: boolean;
  height?: number;
}

export default function AnnualOutflows({ proj, real = true, height = 220 }: Props) {
  const rows = proj.rows;
  const labels = rows.map((r) => r.ageA);
  const scale = (n: number, inf: number) => (real ? n / inf : n);

  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Net Spending',
        data: rows.map((r) => scale(r.netSpend, r.inflationFactor)),
        backgroundColor: palette.danger,
        stack: 'outflow',
      },
      {
        label: 'Federal Tax',
        data: rows.map((r) => scale(r.fedTax, r.inflationFactor)),
        backgroundColor: palette.warning,
        stack: 'outflow',
      },
      {
        label: 'State Tax + IRMAA',
        data: rows.map((r) => scale(r.stateTaxAmt + r.irmaa, r.inflationFactor)),
        backgroundColor: palette.textMuted,
        stack: 'outflow',
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
