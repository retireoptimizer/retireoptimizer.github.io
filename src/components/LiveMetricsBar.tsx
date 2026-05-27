import { useProjection, usePlanStore } from '../store/usePlanStore';
import { depletionAge } from '../engine/projection';
import { fmtM, fmtK } from '../lib/format';

export default function LiveMetricsBar() {
  const proj = useProjection();
  const plan = usePlanStore((s) => s.plan);
  const retAge = plan.personA.retirementAge;
  const planTo = plan.personA.planToAge;

  const retRow = proj.rows.find((r) => r.ageA >= retAge);

  const depAge = depletionAge(proj);
  const fundsTo = depAge ?? planTo;
  const fundsBad = depAge !== null;

  // Initial withdrawal rate: Year-1 withdrawals ÷ portfolio at retirement (start-of-year balance).
  // endTotal is end-of-year so we add totalWD back to approximate start-of-year balance.
  const wdRate = retRow && (retRow.endTotal + retRow.totalWD) > 0
    ? retRow.totalWD / (retRow.endTotal + retRow.totalWD)
    : 0;
  const portAtRetReal = retRow ? retRow.endTotal / retRow.inflationFactor : 0;

  const cells = [
    { label: 'Portfolio @ Retirement', value: fmtM(portAtRetReal), sub: `Age ${retAge} · today's $` },
    {
      label: 'Plan Lasts To',
      value: `Age ${fundsTo}`,
      sub: fundsBad ? `⚠ runs out · target ${planTo}` : `Lasts full plan · target ${planTo}`,
      bad: fundsBad,
    },
    { label: 'End Balance', value: fmtM(proj.endTotalReal), sub: `Age ${planTo} · today's $` },
    { label: 'Lifetime Fed Tax', value: fmtK(proj.lifetimeFedTax), sub: 'Nominal · all years' },
    { label: 'Initial Withdrawal Rate', value: wdRate > 0 ? (wdRate * 100).toFixed(2) + '%' : '—', sub: 'Year-1 withdrawal ÷ portfolio at retirement' },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cells.length}, 1fr)`,
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
