import { Doughnut } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact } from './setup';

interface Props {
  withdrawals: number;
  socialSecurity: number;
  otherIncome: number;
  height?: number;
}

export default function IncomeSourcesDonut({ withdrawals, socialSecurity, otherIncome, height = 220 }: Props) {
  const total = withdrawals + socialSecurity + otherIncome;
  const data: ChartData<'doughnut'> = {
    labels: ['Portfolio Withdrawals', 'Social Security', 'Other Income'],
    datasets: [
      {
        data: [withdrawals, socialSecurity, otherIncome],
        backgroundColor: [palette.navy, palette.gold, palette.success],
        borderColor: '#fff',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const options: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
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
