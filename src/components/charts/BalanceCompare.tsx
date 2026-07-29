import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact, fmtFull, ageTooltipTitle } from './setup';
import type { ComparisonResult } from '../../engine/comparison';

interface Props {
  cmp: ComparisonResult;
  real?: boolean;
  height?: number;
}

export default function BalanceCompare({ cmp, real = true, height = 220 }: Props) {
  const labels = cmp.withConv.rows.map((r) => r.ageA);
  const balWith = real ? cmp.endTotalWith : cmp.endTotalWithNom;
  const balNo   = real ? cmp.endTotalNo   : cmp.endTotalNoNom;
  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'With Conversions',
        data: balWith,
        borderColor: palette.gold,
        backgroundColor: palette.gold + '22',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
        fill: true,
      },
      {
        label: 'No Conversions',
        data: balNo,
        borderColor: palette.textMuted,
        backgroundColor: palette.textMuted + '22',
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
          title: ageTooltipTitle,
          label: (item) => `${item.dataset.label}: ${fmtFull(item.parsed.y ?? 0)}`,
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
