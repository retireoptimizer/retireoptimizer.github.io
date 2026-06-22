import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData, Plugin } from 'chart.js';
import { palette, fmtCompact, fmtFull, ageTooltipTitle } from './setup';
import type { MonteCarloResult } from '../../engine/monteCarlo';

/** Draws a red-tinted depletion-probability ribbon along the bottom of the chart.
 *  At each x position, the ribbon's opacity scales with the fraction of trials
 *  whose portfolio is ≤0 by that age. Visually answers "by what age does failure
 *  start appearing, and how quickly does it accelerate?" */
const depleteRibbonPlugin: Plugin<'line'> = {
  id: 'depleteRibbon',
  afterDatasetsDraw: (chart) => {
    const data = (chart.config.options as { plugins?: { depleteRibbon?: { fracs?: number[] } } }).plugins?.depleteRibbon?.fracs;
    if (!data || data.length === 0) return;
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.x) return;
    const xScale = scales.x;
    const ribbonHeight = 6;
    const y0 = chartArea.bottom - ribbonHeight;
    ctx.save();
    for (let i = 0; i < data.length; i++) {
      const frac = data[i];
      if (frac <= 0.001) continue;
      const x = xScale.getPixelForValue(i);
      const nextX = i + 1 < data.length ? xScale.getPixelForValue(i + 1) : x + 2;
      const w = Math.max(1, nextX - x);
      // Alpha grows with depletion fraction (0–1 maps to 0.1–0.85).
      ctx.fillStyle = `rgba(192,57,43,${0.1 + frac * 0.75})`;
      ctx.fillRect(x, y0, w, ribbonHeight);
    }
    ctx.restore();
  },
};

interface Props {
  mc: MonteCarloResult;
  height?: number;
  /** Optional single-trajectory overlay (e.g. a stress scenario line). */
  overlay?: { label: string; data: number[]; color: string };
}

export default function MonteCarloFan({ mc, height = 300, overlay }: Props) {
  const data: ChartData<'line'> = {
    labels: mc.ages,
    datasets: [
      // Bottom 10% baseline (no fill)
      {
        label: 'p10',
        data: mc.p10,
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        pointRadius: 0,
        fill: false,
      },
      // p10-p25 lower band
      {
        label: 'p10-p25',
        data: mc.p25,
        borderColor: 'transparent',
        backgroundColor: palette.gold + '22',
        pointRadius: 0,
        fill: '-1',
      },
      // p25-p75 middle band
      {
        label: '25th–75th Percentile',
        data: mc.p75,
        borderColor: 'transparent',
        backgroundColor: palette.gold + '55',
        pointRadius: 0,
        fill: '-1',
      },
      // p75-p90 upper band
      {
        label: 'p75-p90',
        data: mc.p90,
        borderColor: 'transparent',
        backgroundColor: palette.gold + '22',
        pointRadius: 0,
        fill: '-1',
      },
      // Median line
      {
        label: 'Median Outcome',
        data: mc.p50,
        borderColor: palette.navy,
        backgroundColor: palette.navy,
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.2,
        fill: false,
      },
      // Optional stress scenario trajectory
      ...(overlay ? [{
        label: overlay.label,
        data: overlay.data,
        borderColor: overlay.color,
        backgroundColor: overlay.color,
        borderWidth: 2.5,
        borderDash: [5, 3],
        pointRadius: 0,
        tension: 0.2,
        fill: false,
      }] : []),
    ],
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { filter: (item) => item.text === 'Median Outcome' || item.text === '25th–75th Percentile' || (overlay !== undefined && item.text === overlay.label) },
      },
      tooltip: {
        filter: (item) => item.dataset.label === 'Median Outcome' || item.dataset.label === '25th–75th Percentile' || item.dataset.label === 'p10' || item.dataset.label === 'p10-p25' || item.dataset.label === 'p75-p90' || (overlay !== undefined && item.dataset.label === overlay.label),
        callbacks: {
          title: ageTooltipTitle,
          label: (item) => {
            const lbl = item.dataset.label === 'p10' ? '10th pct' : item.dataset.label === 'p10-p25' ? '25th pct' : item.dataset.label === 'p75-p90' ? '90th pct' : item.dataset.label === '25th–75th Percentile' ? '75th pct' : item.dataset.label ?? 'Median';
            return `${lbl}: ${fmtFull(item.parsed.y ?? 0)}`;
          },
        },
      },
      // Custom plugin config — typed loosely so Chart.js doesn't complain.
      ...({ depleteRibbon: { fracs: mc.depleteFracByAge ?? [] } } as Record<string, unknown>),
    },
    scales: {
      y: { ticks: { callback: (v) => fmtCompact(Number(v)) }, grid: { color: palette.borderLight } },
      x: { grid: { display: false } },
    },
  };

  return (
    <div style={{ position: 'relative', height }}>
      <Line data={data} options={options} plugins={[depleteRibbonPlugin]} />
    </div>
  );
}
