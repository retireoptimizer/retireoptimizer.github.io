import { Doughnut } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { bucketColors, fmtCompact } from './setup';

interface Props {
  taxable: number;
  traditional: number;
  roth: number;
  height?: number;
}

export default function BucketDonut({ taxable, traditional, roth, height = 220 }: Props) {
  const total = taxable + traditional + roth;
  const data: ChartData<'doughnut'> = {
    labels: ['Taxable', 'Pre-tax 401(k)/IRA', 'Roth'],
    datasets: [
      {
        data: [taxable, traditional, roth],
        backgroundColor: [bucketColors.taxable, bucketColors.traditional, bucketColors.roth],
        borderColor: '#fff',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed;
            const pct = total > 0 ? Math.round((v / total) * 100) : 0;
            return `${ctx.label}: ${fmtCompact(v)} (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div style={{ position: 'relative', height }}>
      <Doughnut data={data} options={options} />
    </div>
  );
}
