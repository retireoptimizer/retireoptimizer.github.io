import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact, fmtFull, ageTooltipTitle } from './setup';
import type { ComparisonResult } from '../../engine/comparison';

interface Props {
  cmp: ComparisonResult;
  real?: boolean;
  height?: number;
  /** Plot after-tax (tax-adjusted) balances so the end gap equals the headline conversion benefit.
   *  This panel is a pure impact comparison, not an account-bucket view, so the haircut has no
   *  downside here — and it keeps the chart's sign consistent with the summary and the optimizer. */
  taxAdj?: boolean;
}

export default function BalanceCompare({ cmp, real = true, height = 220, taxAdj = false }: Props) {
  const labels = cmp.withConv.rows.map((r) => r.ageA);
  const balWith = taxAdj
    ? (real ? cmp.endTaxAdjWith : cmp.endTaxAdjWithNom)
    : (real ? cmp.endTotalWith : cmp.endTotalWithNom);
  const balNo = taxAdj
    ? (real ? cmp.endTaxAdjNo : cmp.endTaxAdjNoNom)
    : (real ? cmp.endTotalNo : cmp.endTotalNoNom);
  const suffix = taxAdj ? ' (after-tax)' : '';
  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: `With Conversions${suffix}`,
        data: balWith,
        borderColor: palette.gold,
        backgroundColor: palette.gold + '22',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.25,
        fill: true,
      },
      {
        label: `No Conversions${suffix}`,
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
