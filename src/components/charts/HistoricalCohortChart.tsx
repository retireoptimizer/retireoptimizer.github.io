import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData, Plugin } from 'chart.js';
import { palette, fmtCompact, fmtFull, ageTooltipTitle } from './setup';
import type { HistoricalSweepResult } from '../../engine/monteCarlo';

/** Draws thin red lines for each failed full-coverage cohort directly on canvas. */
const failedCohortsPlugin: Plugin<'line'> = {
  id: 'failedCohorts',
  beforeDatasetsDraw: (chart) => {
    const cfg = (chart.config.options as Record<string, unknown>).plugins as Record<string, unknown> | undefined;
    const trajectories = (cfg?.failedCohorts as { trajectories?: number[][] } | undefined)?.trajectories;
    if (!trajectories?.length) return;
    const { ctx, scales, chartArea } = chart;
    if (!scales.x || !scales.y || !chartArea) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(192, 57, 43, 0.28)';
    ctx.lineWidth = 1;
    for (const traj of trajectories) {
      ctx.beginPath();
      let started = false;
      for (let i = 0; i < traj.length; i++) {
        const v = traj[i];
        if (isNaN(v)) break;
        const x = scales.x.getPixelForValue(i);
        const y = Math.max(chartArea.top, Math.min(chartArea.bottom, scales.y.getPixelForValue(v)));
        if (!started) { ctx.moveTo(x, y); started = true; }
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  },
};

interface Props {
  result: HistoricalSweepResult;
  height?: number;
}

export default function HistoricalCohortChart({ result, height = 320 }: Props) {
  const failedTrajectories = result.cohorts
    .filter((c) => c.fullCoverage && !c.survived)
    .map((c) => c.portfolioByAge);

  const data: ChartData<'line'> = {
    labels: result.ages,
    datasets: [
      { label: 'p10', data: result.p10, borderColor: 'transparent', backgroundColor: 'transparent', pointRadius: 0, fill: false },
      { label: 'p10–p25', data: result.p25, borderColor: 'transparent', backgroundColor: palette.gold + '22', pointRadius: 0, fill: '-1' },
      { label: '25th–75th Percentile', data: result.p75, borderColor: 'transparent', backgroundColor: palette.gold + '44', pointRadius: 0, fill: '-1' },
      { label: 'p75–p90', data: result.p90, borderColor: 'transparent', backgroundColor: palette.gold + '22', pointRadius: 0, fill: '-1' },
      {
        label: 'Median cohort',
        data: result.p50,
        borderColor: palette.navy,
        backgroundColor: palette.navy,
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.2,
        fill: false,
      },
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          filter: (item) =>
            item.text === 'Median cohort' || item.text === '25th–75th Percentile',
        },
      },
      tooltip: {
        filter: (item) =>
          ['p10', 'p10–p25', 'p75–p90', '25th–75th Percentile', 'Median cohort'].includes(item.dataset.label ?? ''),
        callbacks: {
          title: ageTooltipTitle,
          label: (item) => {
            const lbl =
              item.dataset.label === 'p10' ? '10th pct' :
              item.dataset.label === 'p10–p25' ? '25th pct' :
              item.dataset.label === 'p75–p90' ? '90th pct' :
              item.dataset.label === '25th–75th Percentile' ? '75th pct' : 'Median';
            return `${lbl}: ${fmtFull(item.parsed.y ?? 0)}`;
          },
        },
      },
      ...({ failedCohorts: { trajectories: failedTrajectories } } as Record<string, unknown>),
    },
    scales: {
      y: { ticks: { callback: (v) => fmtCompact(Number(v)) }, grid: { color: palette.borderLight } },
      x: { grid: { display: false } },
    },
  };

  return (
    <div style={{ position: 'relative', height }}>
      <Line data={data} options={options} plugins={[failedCohortsPlugin]} />
    </div>
  );
}
