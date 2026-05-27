import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette } from './setup';
import type { ProjectionResult } from '../../engine/projection';

interface Props {
  proj: ProjectionResult;
  height?: number;
}

export default function EffectiveTaxLine({ proj, height = 200 }: Props) {
  const rows = proj.rows;
  const labels = rows.map((r) => r.ageA);

  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Effective Federal Rate',
        data: rows.map((r) => +(r.effRate * 100).toFixed(2)),
        borderColor: palette.danger,
        backgroundColor: palette.danger + '22',
        fill: true,
        pointRadius: 0,
        borderWidth: 2,
        tension: 0.25,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => `Age ${items[0].label}`,
          label: (item) => `Effective rate: ${(item.parsed.y ?? 0).toFixed(1)}%`,
        },
      },
    },
    scales: {
      y: {
        ticks: { callback: (v) => `${Number(v).toFixed(0)}%` },
        grid: { color: palette.borderLight },
        min: 0,
      },
      x: {
        title: { display: true, text: 'Age', color: palette.textMuted, font: { size: 11 } },
        grid: { display: false },
      },
    },
  };

  return (
    <div style={{ position: 'relative', height }}>
      <Line data={data} options={options} />
    </div>
  );
}
