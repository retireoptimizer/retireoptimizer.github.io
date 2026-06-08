import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData, Plugin } from 'chart.js';
import { bucketColors, fmtCompact, fmtFull, palette, ageTooltipTitle, indexInteraction } from './setup';
import type { ProjectionResult } from '../../engine/projection';

interface Props {
  proj: ProjectionResult;
  /** Show real (today's $) values instead of nominal. */
  real?: boolean;
  height?: number;
}

interface Marker {
  age: number;
  label: string;
  color: string;
}

/**
 * Custom plugin that draws vertical dashed reference lines for plan milestones
 * (retirement, SS start, RMD start, depletion). Cheaper than adding
 * chartjs-plugin-annotation as a dependency.
 */
const milestonePlugin: Plugin<'line'> = {
  id: 'milestoneRefs',
  afterDatasetsDraw: (chart) => {
    const markers = (chart.config.options as { plugins?: { milestoneRefs?: { markers?: Marker[] } } }).plugins?.milestoneRefs?.markers ?? [];
    if (!markers.length) return;
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.x) return;
    const xScale = scales.x;
    ctx.save();
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1.25;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (const m of markers) {
      const x = xScale.getPixelForValue(m.age);
      if (x < chartArea.left - 1 || x > chartArea.right + 1) continue;
      ctx.strokeStyle = m.color;
      ctx.beginPath();
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.fillStyle = m.color;
      ctx.fillText(m.label, x + 3, chartArea.top + 2);
    }
    ctx.restore();
  },
};

export default function PortfolioTrajectory({ proj, real = true, height = 320 }: Props) {
  const rows = proj.rows;
  const labels = rows.map((r) => r.ageA);
  const scale = (n: number, inf: number) => (real ? n / inf : n);

  // Derive milestone ages from the projection itself — no plan dependency needed.
  const ageRetire = rows.find((r) => r.phase === 'Retire')?.ageA;
  const ageSS = rows.find((r) => r.totalSS > 0)?.ageA;
  const ageRMD = rows.find((r) => r.rmd > 0)?.ageA;
  const ageDeplete = rows.find((r) => r.endTotal <= 0 && r.phase === 'Retire')?.ageA;

  const markers: Marker[] = [];
  if (ageRetire !== undefined) markers.push({ age: ageRetire, label: 'Retire', color: palette.gold });
  if (ageSS !== undefined && ageSS !== ageRetire) markers.push({ age: ageSS, label: 'SS', color: palette.success });
  if (ageRMD !== undefined) markers.push({ age: ageRMD, label: 'RMDs', color: palette.warning });
  if (ageDeplete !== undefined) markers.push({ age: ageDeplete, label: 'Depleted', color: palette.danger });

  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'Taxable',
        data: rows.map((r) => scale(r.endTaxable, r.inflationFactor)),
        backgroundColor: bucketColors.taxable + 'd0',
        borderColor: bucketColors.taxable,
        borderWidth: 0,
        fill: 'origin',
        pointRadius: 0,
        tension: 0.2,
      },
      {
        label: 'Pre-tax 401(k)/IRA',
        data: rows.map((r) => scale(r.endTraditional, r.inflationFactor)),
        backgroundColor: bucketColors.traditional + 'd0',
        borderColor: bucketColors.traditional,
        borderWidth: 0,
        fill: '-1',
        pointRadius: 0,
        tension: 0.2,
      },
      {
        label: 'Roth',
        data: rows.map((r) => scale(r.endRoth, r.inflationFactor)),
        backgroundColor: bucketColors.roth + 'd0',
        borderColor: bucketColors.roth,
        borderWidth: 1.5,
        fill: '-1',
        pointRadius: 0,
        tension: 0.2,
      },
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
          footer: (items) => {
            const total = items.reduce((s, it) => s + (it.parsed.y ?? 0), 0);
            return `Total: ${fmtFull(total)}`;
          },
        },
        footerColor: palette.gold,
        footerFont: { weight: 'bold' },
      },
      ...({ milestoneRefs: { markers } } as Record<string, unknown>),
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
      <Line data={data} options={options} plugins={[milestonePlugin]} />
    </div>
  );
}
