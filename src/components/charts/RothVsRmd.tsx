import { Bar } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact, fmtFull, ageTooltipTitle, indexInteraction } from './setup';
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

  // Diverging layout: Conversions above zero (positive bars), RMDs below zero
  // (negative bars). Visually separates the *voluntary* (top) and *forced* (bottom)
  // movements out of Pre-tax. Same stack so each year occupies one column.
  const data: ChartData<'bar'> = {
    labels,
    datasets: [
      {
        label: 'Roth Conversions (voluntary)',
        data: rows.map((r) => scale(r.rothConv, r.inflationFactor)),
        backgroundColor: palette.gold,
        stack: 'conv-rmd',
      },
      {
        label: 'RMDs (forced)',
        data: rows.map((r) => -scale(r.rmd, r.inflationFactor)),
        backgroundColor: palette.warning,
        stack: 'conv-rmd',
      },
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: indexInteraction,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          title: ageTooltipTitle,
          label: (item) => `${item.dataset.label}: ${fmtFull(Math.abs(item.parsed.y ?? 0))}`,
        },
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: {
        stacked: true,
        ticks: { callback: (v) => fmtCompact(Math.abs(Number(v))) },
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
