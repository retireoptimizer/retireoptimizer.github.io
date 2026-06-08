import { Bar } from 'react-chartjs-2';
import type { ChartOptions, ChartData, Chart, TooltipModel } from 'chart.js';
import { palette, fmtCompact, fmtFull, ageTooltipTitle } from './setup';
import type { ProjectionResult } from '../../engine/projection';

interface Props {
  proj: ProjectionResult;
  real?: boolean;
  height?: number;
}

/**
 * HTML tooltip that groups the cash-flow bars into Income vs Spending & Taxes
 * sections (each with a subtotal) instead of one flat 9-line list. Zero-value
 * line items (e.g. RMDs before they start, Contributions after retirement) are
 * dropped so the hover shows only what's actually flowing that year.
 */
function cashFlowTooltip(ctx: { chart: Chart; tooltip: TooltipModel<'bar'> }) {
  const { chart, tooltip } = ctx;
  const parent = chart.canvas.parentNode as HTMLElement | null;
  if (!parent) return;

  let el = parent.querySelector<HTMLDivElement>('div.cf-tooltip');
  if (!el) {
    el = document.createElement('div');
    el.className = 'cf-tooltip';
    el.style.cssText = [
      'position:absolute', 'pointer-events:none', 'z-index:10',
      'background:rgba(13,27,46,0.94)', 'color:#fff', 'border-radius:6px',
      'padding:10px 12px', 'font-size:12px', 'min-width:190px',
      "font-family:'DM Sans','Inter',system-ui,sans-serif",
      'box-shadow:0 4px 16px rgba(0,0,0,0.25)', 'transition:opacity .1s ease',
    ].join(';');
    parent.appendChild(el);
  }

  if (tooltip.opacity === 0) { el.style.opacity = '0'; return; }

  const dps = tooltip.dataPoints ?? [];
  const nonZero = (d: typeof dps[number]) => Math.abs(d.parsed.y ?? 0) >= 1;
  const income = dps.filter((d) => d.dataset.stack === 'in' && nonZero(d));
  const expense = dps.filter((d) => d.dataset.stack === 'out' && nonZero(d));
  const lineDp = dps.find((d) => !d.dataset.stack);

  const incomeTotal = income.reduce((s, d) => s + (d.parsed.y ?? 0), 0);
  const expenseTotal = expense.reduce((s, d) => s + Math.abs(d.parsed.y ?? 0), 0);
  const net = incomeTotal - expenseTotal;

  const row = (color: string, label: string, value: number) =>
    `<div style="display:flex;align-items:center;gap:8px;margin:3px 0;">
       <span style="width:9px;height:9px;border-radius:2px;background:${color};flex:none;"></span>
       <span style="flex:1;color:#dde6f0;">${label}</span>
       <span style="font-variant-numeric:tabular-nums;">${fmtFull(value)}</span>
     </div>`;

  const sectionHead = (text: string) =>
    `<div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#7a96b0;margin:8px 0 2px;">${text}</div>`;

  const subtotal = (label: string, value: number, color = '#f5e9c8') =>
    `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:3px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.14);font-weight:700;">
       <span style="color:${color};">${label}</span>
       <span style="font-variant-numeric:tabular-nums;color:${color};">${fmtFull(value)}</span>
     </div>`;

  const bg = (d: typeof dps[number]) => String(d.dataset.backgroundColor ?? palette.navy);

  let html = `<div style="font-weight:600;color:#f5e9c8;margin-bottom:4px;">${tooltip.title?.[0] ?? ''}</div>`;
  if (income.length) {
    html += sectionHead('Income');
    html += income.map((d) => row(bg(d), d.dataset.label ?? '', d.parsed.y ?? 0)).join('');
    html += subtotal('Total income', incomeTotal);
  }
  if (expense.length) {
    html += sectionHead('Spending & Taxes');
    html += expense.map((d) => row(bg(d), d.dataset.label ?? '', Math.abs(d.parsed.y ?? 0))).join('');
    html += subtotal('Total out', expenseTotal);
  }
  html += subtotal(net >= 0 ? 'Net build' : 'Net draw', net, net >= 0 ? '#a8d8be' : '#f0c089');
  if (lineDp) {
    html += `<div style="margin-top:6px;font-size:11px;color:#7a96b0;">${lineDp.dataset.label ?? 'Portfolio'}: ${fmtFull(lineDp.parsed.y ?? 0)}</div>`;
  }
  el.innerHTML = html;

  el.style.opacity = '1';
  el.style.left = `${chart.canvas.offsetLeft + tooltip.caretX}px`;
  el.style.top = `${chart.canvas.offsetTop + tooltip.caretY}px`;
  // Nudge right of the caret and vertically centered; keep clear of the cursor.
  el.style.transform = 'translate(14px, -50%)';
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
        backgroundColor: palette.incomeOther,
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
        // RMDs are a forced pre-tax distribution tracked separately from totalWD,
        // so they need their own bar or the income side understates actual cash in.
        type: 'bar',
        label: 'RMDs',
        data: rows.map((r) => scale(r.rmd, r.inflationFactor)),
        backgroundColor: palette.warning,
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
        backgroundColor: palette.taxOther,
        stack: 'out',
      },
      {
        type: 'line',
        // Total portfolio balance — plotted on a secondary y-axis (right side) so its
        // scale ($M) doesn't compress the cash-flow bars. Shows the wealth trajectory
        // directly: trending up = building, trending down = drawing down, slope = pace.
        label: real ? 'Portfolio Total (real $)' : 'Portfolio Total (nominal $)',
        data: rows.map((r) => scale(r.endTotal, r.inflationFactor)),
        borderColor: palette.navy,
        backgroundColor: palette.navy,
        borderWidth: 2.5,
        pointRadius: 0,
        tension: 0.2,
        fill: false,
        yAxisID: 'yPortfolio',
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
        enabled: false,
        external: cashFlowTooltip as unknown as (this: TooltipModel<'bar'>, args: { chart: Chart; tooltip: TooltipModel<'bar'> }) => void,
        // Title still computed so the external handler can read tooltip.title.
        callbacks: { title: ageTooltipTitle },
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false } },
      y: {
        stacked: true,
        ticks: { callback: (v) => fmtCompact(Math.abs(Number(v))) },
        grid: { color: palette.borderLight },
        title: { display: true, text: 'Annual cash flow ($)', font: { size: 10 } },
      },
      yPortfolio: {
        position: 'right',
        beginAtZero: true,
        ticks: { callback: (v) => fmtCompact(Number(v)) },
        grid: { display: false },
        title: { display: true, text: 'Portfolio total ($)', font: { size: 10 } },
      },
    },
  };

  return (
    <div style={{ position: 'relative', height }}>
      <Bar data={data as ChartData<'bar'>} options={options} />
    </div>
  );
}
