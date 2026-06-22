import { Chart } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact, fmtFull } from './setup';
import type { MonteCarloResult } from '../../engine/monteCarlo';

type ScenarioDetail = MonteCarloResult['stressScenarios'][number]['detail'];

interface Props {
  detail: ScenarioDetail;
  real?: boolean;
  height?: number;
}

/** Dual-axis: annual return bars (green/red, left %) + CPI line (left %) + portfolio line (right $).
 *  Shows the year-by-year sequence that drives a stress scenario's outcome. */
export default function StressReturnsChart({ detail, real = true, height = 260 }: Props) {
  const labels = detail.map((d) => d.calendarYear);

  const data: ChartData<'bar' | 'line'> = {
    labels,
    datasets: [
      {
        type: 'bar' as const,
        label: 'Annual Return',
        data: detail.map((d) => +(d.ret * 100).toFixed(2)),
        backgroundColor: detail.map((d) => (d.ret >= 0 ? palette.success + 'cc' : palette.danger + 'cc')),
        borderColor: detail.map((d) => (d.ret >= 0 ? palette.success : palette.danger)),
        borderWidth: 1,
        yAxisID: 'y',
      },
      {
        type: 'line' as const,
        label: 'CPI Inflation',
        data: detail.map((d) => +(d.cpi * 100).toFixed(2)),
        borderColor: palette.warning,
        backgroundColor: palette.warning,
        borderWidth: 1.5,
        borderDash: [4, 3],
        pointRadius: 0,
        tension: 0.25,
        yAxisID: 'y',
        fill: false,
      },
      {
        type: 'line' as const,
        label: 'Portfolio',
        data: detail.map((d) => (real ? d.portfolioReal : d.portfolioNominal)),
        borderColor: palette.navy,
        backgroundColor: palette.navy,
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.2,
        yAxisID: 'y1',
        fill: false,
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
          title: (items) => `Year ${items[0]?.label ?? ''}`,
          label: (item) => {
            const v = item.parsed.y ?? 0;
            return item.dataset.yAxisID === 'y1'
              ? `${item.dataset.label}: ${fmtFull(v)}`
              : `${item.dataset.label}: ${v.toFixed(1)}%`;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false } },
      y: {
        position: 'left',
        ticks: { callback: (v) => `${Number(v).toFixed(0)}%` },
        grid: { color: palette.borderLight },
      },
      y1: {
        position: 'right',
        ticks: { callback: (v) => fmtCompact(Number(v)) },
        grid: { display: false },
        min: 0,
      },
    },
  };

  return (
    <div style={{ position: 'relative', height }}>
      <Chart type="bar" data={data as ChartData<'bar'>} options={options} />
    </div>
  );
}
