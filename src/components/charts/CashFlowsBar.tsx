import { Bar } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact } from './setup';
import type { ProjectionResult } from '../../engine/projection';

interface Props {
  proj: ProjectionResult;
  real?: boolean;
  height?: number;
}

/** Stacked income sources (Withdrawals split by bucket + SS + Other) with a spending line overlay. */
export default function CashFlowsBar({ proj, real = true, height = 280 }: Props) {
  const rows = proj.rows.filter((r) => r.phase === 'Retire' || r.phase === 'Survivor');
  const scale = (n: number, inf: number) => (real ? n / inf : n);
  const labels = rows.map((r) => r.ageA);

  const data: ChartData<'bar' | 'line'> = {
    labels,
    datasets: [
      {
        type: 'bar',
        label: 'Withdrawal · Taxable',
        data: rows.map((r) => scale(r.wdTax, r.inflationFactor)),
        backgroundColor: palette.success,
        stack: 'income',
      },
      {
        type: 'bar',
        label: 'Withdrawal · Pre-tax',
        data: rows.map((r) => scale(r.wdTrd + r.rmd, r.inflationFactor)),
        backgroundColor: palette.navy,
        stack: 'income',
      },
      {
        type: 'bar',
        label: 'Withdrawal · Roth',
        data: rows.map((r) => scale(r.wdRth, r.inflationFactor)),
        backgroundColor: palette.gold,
        stack: 'income',
      },
      {
        type: 'bar',
        label: 'Social Security',
        data: rows.map((r) => scale(r.totalSS, r.inflationFactor)),
        backgroundColor: palette.goldLight,
        stack: 'income',
      },
      {
        type: 'bar',
        label: 'Other Income',
        data: rows.map((r) => scale(r.otherIncome, r.inflationFactor)),
        backgroundColor: palette.slate,
        stack: 'income',
      },
      {
        type: 'line',
        label: 'Net Spending',
        data: rows.map((r) => scale(r.netSpend, r.inflationFactor)),
        borderColor: palette.danger,
        backgroundColor: palette.danger,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
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
          title: (items) => `Age ${items[0].label}`,
          label: (item) => `${item.dataset.label}: ${fmtCompact(item.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: {
        stacked: true,
        ticks: { callback: (v) => fmtCompact(Number(v)) },
        grid: { color: palette.borderLight },
      },
    },
  };

  return (
    <div style={{ position: 'relative', height }}>
      <Bar data={data as ChartData<'bar'>} options={options} />
    </div>
  );
}
