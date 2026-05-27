import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData, Plugin } from 'chart.js';
import { palette, fmtCompact } from './setup';
import { IRMAA_TIERS_MFJ_2025 } from '../../engine/taxConstants';
import type { ProjectionResult } from '../../engine/projection';

interface Props {
  proj: ProjectionResult;
  height?: number;
  /** Show real (today's $) values instead of nominal. */
  real?: boolean;
}

const tierBandsPlugin: Plugin<'line'> = {
  id: 'irmaaTierBands',
  beforeDatasetsDraw: (chart) => {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.y) return;
    const yScale = scales.y;
    // Render the first 3 tier ceilings as horizontal threshold lines (in today's $)
    const tiers = IRMAA_TIERS_MFJ_2025.slice(0, 3);
    const colors = [palette.warning, palette.danger, '#7a1d12'];
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.font = "10px 'DM Sans', sans-serif";
    ctx.textAlign = 'right';
    tiers.forEach((t, i) => {
      const y = yScale.getPixelForValue(t.magiTop);
      if (y < chartArea.top || y > chartArea.bottom) return;
      ctx.strokeStyle = colors[i];
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      ctx.fillText(`Tier ${i + 1}: ${fmtCompact(t.magiTop)}`, chartArea.right - 6, y - 4);
    });
    ctx.restore();
  },
};

export default function IrmaaMagiLine({ proj, height = 280, real = true }: Props) {
  const rows = proj.rows.filter((r) => r.ageA >= 60);
  const labels = rows.map((r) => r.ageA);
  const scale = (n: number, inf: number) => (real ? n / inf : n);

  const data: ChartData<'line'> = {
    labels,
    datasets: [
      {
        label: 'MAGI',
        data: rows.map((r) => scale(r.ordIncome + r.ltcg, r.inflationFactor)),
        borderColor: palette.navy,
        backgroundColor: palette.navy + '22',
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
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          title: (items) => `Age ${items[0].label}`,
          label: (item) => `MAGI: ${fmtCompact(item.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      y: {
        ticks: { callback: (v) => fmtCompact(Number(v)) },
        grid: { color: palette.borderLight },
      },
      x: { grid: { display: false } },
    },
  };

  return (
    <div style={{ position: 'relative', height }}>
      <Line data={data} options={options} plugins={[tierBandsPlugin]} />
    </div>
  );
}
