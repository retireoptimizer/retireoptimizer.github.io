import { Line } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact, fmtFull, ageTooltipTitle, indexInteraction } from './setup';
import { IRMAA_TIERS_MFJ, IRMAA_TIERS_SINGLE } from '../../engine/taxConstants';
import type { ProjectionResult } from '../../engine/projection';

interface Props {
  proj: ProjectionResult;
  height?: number;
  /** Show real (today's $) values instead of nominal. */
  real?: boolean;
}

const TIER_COLORS = [palette.warning, palette.danger, '#7a1d12', '#4b0082'];

export default function IrmaaMagiLine({ proj, height = 280, real = true }: Props) {
  const rows = proj.rows.filter((r) => r.ageA >= 60);
  const labels = rows.map((r) => r.ageA);
  const scale = (n: number, inf: number) => (real ? n / inf : n);

  const tierDatasets = [0, 1, 2, 3].map((i) => ({
    label: `IRMAA Tier ${i + 1}`,
    data: rows.map((r) => {
      const tiers = r.filingStatus === 'MFJ' ? IRMAA_TIERS_MFJ : IRMAA_TIERS_SINGLE;
      const threshold = tiers[i].magiTop;
      return real ? threshold : threshold * r.inflationFactor;
    }),
    borderColor: TIER_COLORS[i],
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderDash: [6, 4],
    pointRadius: 0,
    tension: 0,
  }));

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
      ...tierDatasets,
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
          label: (item) => {
            const label = item.dataset.label ?? '';
            return `${label}: ${fmtFull(item.parsed.y ?? 0)}`;
          },
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
      <Line data={data} options={options} />
    </div>
  );
}
