import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact, fmtFull, ageTooltipTitle, indexInteraction } from './setup';
import type { ProjectionResult } from '../../engine/projection';

interface Props {
  proj: ProjectionResult;
  real?: boolean;
  height?: number;
}

/** Stacked area showing the retirement income sources (voluntary Withdrawals,
 *  forced RMDs, Social Security, Other Income) across all retirement years.
 *  Replaces the single-year donut on Dashboard — surfacing the *trajectory* of
 *  where retirement money comes from instead of just one cherry-picked year.
 *  RMDs are a distinct cash source from voluntary withdrawals (totalWD excludes
 *  the RMD), so they get their own band rather than being silently dropped. */
export default function IncomeSourcesArea({ proj, real = true, height = 240 }: Props) {
  // Only meaningful in retirement years where withdrawals or SS exist.
  const rows = proj.rows.filter((r) => r.phase === 'Retire' || r.phase === 'Survivor');
  const labels = rows.map((r) => r.ageA);
  const scale = (n: number, inf: number) => (real ? n / inf : n);

  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Portfolio Withdrawals',
        data: rows.map((r) => scale(r.totalWD, r.inflationFactor)),
        backgroundColor: palette.navy + 'd0',
        borderColor: palette.navy,
        borderWidth: 0,
        fill: 'origin',
        pointRadius: 0,
        tension: 0.2,
      },
      {
        label: 'RMDs',
        data: rows.map((r) => scale(r.rmd, r.inflationFactor)),
        backgroundColor: palette.warning + 'd0',
        borderColor: palette.warning,
        borderWidth: 0,
        fill: '-1',
        pointRadius: 0,
        tension: 0.2,
      },
      {
        label: 'Social Security',
        data: rows.map((r) => scale(r.totalSS, r.inflationFactor)),
        backgroundColor: palette.gold + 'd0',
        borderColor: palette.gold,
        borderWidth: 0,
        fill: '-1',
        pointRadius: 0,
        tension: 0.2,
      },
      {
        label: 'Other Income',
        data: rows.map((r) => scale(r.otherIncome, r.inflationFactor)),
        backgroundColor: palette.incomeOther + 'd0',
        borderColor: palette.incomeOther,
        borderWidth: 0,
        fill: '-1',
        pointRadius: 0,
        tension: 0.2,
      },
      ...(rows.some((r) => (r.distributedCash ?? 0) > 0) ? [{
        label: 'Dividends (paid out)',
        data: rows.map((r) => scale(r.distributedCash ?? 0, r.inflationFactor)),
        backgroundColor: palette.goldLight + 'd0',
        borderColor: palette.goldLight,
        borderWidth: 0,
        fill: '-1',
        pointRadius: 0,
        tension: 0.2,
      }] : []),
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: indexInteraction,
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          title: ageTooltipTitle,
          label: (item) => `${item.dataset.label}: ${fmtFull(item.parsed.y ?? 0)}`,
          footer: (items) => `Total: ${fmtFull(items.reduce((s, it) => s + (it.parsed.y ?? 0), 0))}`,
        },
        footerColor: palette.gold,
        footerFont: { weight: 'bold' },
      },
    },
    scales: {
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { callback: (v) => fmtCompact(Number(v)) },
        grid: { color: palette.borderLight },
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
