import { Bar } from 'react-chartjs-2';
import type { ChartOptions, ChartData } from 'chart.js';
import { palette, fmtCompact } from './setup';
import type { ProjectionResult } from '../../engine/projection';

interface Props {
  proj: ProjectionResult;
  real?: boolean;
  height?: number;
}

/**
 * Combined cash-flow view: positive bars (income/contributions/withdrawals) above zero,
 * negative bars (spending/taxes) below zero, plus a net-change line overlay.
 */
export default function CashFlowsBalanced({ proj, real = true, height = 280 }: Props) {
  const rows = proj.rows;
  const labels = rows.map((r) => r.ageA);
  const scale = (n: number, inf: number) => (real ? n / inf : n);

  const data: ChartData<'bar' | 'line'> = {
    labels,
    datasets: [
      {
        type: 'bar',
        label: 'Contributions',
        data: rows.map((r) => scale(r.contribA + r.contribB, r.inflationFactor)),
        backgroundColor: palette.goldLight,
        stack: 'in',
      },
      {
        type: 'bar',
        label: 'Social Security',
        data: rows.map((r) => scale(r.totalSS, r.inflationFactor)),
        backgroundColor: palette.success,
        stack: 'in',
      },
      {
        type: 'bar',
        label: 'Other Income',
        data: rows.map((r) => scale(r.otherIncome, r.inflationFactor)),
        backgroundColor: palette.slate,
        stack: 'in',
      },
      {
        type: 'bar',
        label: 'Portfolio Withdrawals',
        data: rows.map((r) => scale(r.totalWD, r.inflationFactor)),
        backgroundColor: palette.navy,
        stack: 'in',
      },
      {
        type: 'bar',
        label: 'Spending',
        data: rows.map((r) => -scale(r.netSpend, r.inflationFactor)),
        backgroundColor: palette.danger,
        stack: 'out',
      },
      {
        type: 'bar',
        label: 'Federal Tax',
        data: rows.map((r) => -scale(r.fedTax, r.inflationFactor)),
        backgroundColor: palette.warning,
        stack: 'out',
      },
      {
        type: 'bar',
        label: 'State Tax + IRMAA',
        data: rows.map((r) => -scale(r.stateTaxAmt + r.irmaa, r.inflationFactor)),
        backgroundColor: palette.textMuted,
        stack: 'out',
      },
      {
        type: 'line',
        label: 'Net (Inflows − Outflows)',
        data: rows.map((r) => {
          const inflow = r.contribA + r.contribB + r.totalSS + r.otherIncome + r.totalWD;
          const outflow = r.netSpend + r.fedTax + r.stateTaxAmt + r.irmaa;
          return scale(inflow - outflow, r.inflationFactor);
        }),
        borderColor: palette.navy,
        backgroundColor: palette.navy,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
        fill: false,
        order: 0,
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
          label: (item) => {
            const v = item.parsed.y ?? 0;
            return `${item.dataset.label}: ${fmtCompact(Math.abs(v))}`;
          },
        },
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: {
        stacked: true,
        ticks: { callback: (v) => fmtCompact(Math.abs(Number(v))) },
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
