import { useProjection, usePlanStore } from '../store/usePlanStore';
import { depletionAge, initialWithdrawalRate } from '../engine/projection';
import { fmtM, fmtK } from '../lib/format';
import { useIsMobile } from '../hooks/useIsMobile';

export default function LiveMetricsBar() {
  const proj = useProjection();
  const plan = usePlanStore((s) => s.plan);
  const isMobile = useIsMobile();
  const displayMode = usePlanStore((s) => s.displayMode);
  const real = displayMode === 'real';
  const retAge = plan.personA.retirementAge;
  const planTo = plan.personA.planToAge;

  const retRow = proj.rows.find((r) => r.ageA >= retAge);

  const depAge = depletionAge(proj);
  const fundsBad = depAge !== null;

  // Single source of truth for the withdrawal rate (see engine/projection.ts).
  const wdRate = initialWithdrawalRate(proj);
  // $-valued metrics honor the Real/Nominal toggle. Lifetime fed tax has no real
  // analogue at the projection-aggregate level (it's a sum of nominal dollars
  // across many years), so we still emit nominal there but the subtext makes
  // that explicit so users don't mistake it for real.
  const portAtRet = retRow ? (real ? retRow.endTotal / retRow.inflationFactor : retRow.endTotal) : 0;
  const endBalance = real ? proj.endTotalReal : proj.endTotalNominal;
  const dollarSub = real ? "today's $" : 'nominal $';

  const cells = [
    { label: 'Portfolio @ Retirement', value: fmtM(portAtRet), sub: `Age ${retAge} · ${dollarSub}` },
    // End Balance now carries the longevity status in its subtext — the old separate
    // "Plan Lasts To" card was redundant (both keyed to plan-to age).
    {
      label: `End Balance · Age ${planTo}`,
      value: fmtM(endBalance),
      sub: fundsBad ? `⚠ Runs out at age ${depAge} · ${dollarSub}` : `✓ Funds full plan · ${dollarSub}`,
      bad: fundsBad,
    },
    { label: 'Lifetime Fed Tax', value: fmtK(proj.lifetimeFedTax), sub: 'Nominal · all years' },
    { label: 'Initial Withdrawal Rate', value: wdRate > 0 ? (wdRate * 100).toFixed(2) + '%' : '—', sub: 'Year-1 withdrawal ÷ portfolio at retirement' },
  ];

  return (
    <div
      className="live-metrics-bar"
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${cells.length}, 1fr)`,
        gap: '1px',
        background: 'rgba(201,168,76,0.18)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 2px 8px rgba(13,27,46,0.35)',
        borderBottom: '2px solid var(--gold)',
      }}
    >
      {cells.map((c, i) => (
        <div
          key={i}
          style={{
            background: 'linear-gradient(180deg, #1a2b47 0%, #14233c 100%)',
            padding: '14px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '1.2px',
              color: 'var(--gold)',
            }}
          >
            {c.label}
          </div>
          <div
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: '24px',
              fontWeight: 600,
              color: c.bad ? '#ff6b6b' : '#ffffff',
              lineHeight: 1.1,
              letterSpacing: '-0.3px',
            }}
          >
            {c.value}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
