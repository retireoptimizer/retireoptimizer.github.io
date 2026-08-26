import type { ProjectionResult } from '../engine/projection';
import type { Plan } from '../schemas/plan';
import { taxAdjustedRates } from '../engine/taxAdjusted';
import { fmtFull, fmtM } from '../lib/format';

interface Props {
  proj: ProjectionResult;
  plan: Plan;
  real: boolean;
  onClose: () => void;
}

export default function TaxAdjustedBreakdown({ proj, plan, real, onClose }: Props) {
  const last = proj.rows[proj.rows.length - 1];
  const { ordRate, ltcgRate } = taxAdjustedRates(plan.assumptions);
  const inflFactor = last?.inflationFactor ?? 1;

  const endTaxable = last?.endTaxable ?? 0;
  const endTaxableBasis = last?.endTaxableBasis ?? 0;
  const endTraditional = last?.endTraditional ?? 0;
  const endRoth = last?.endRoth ?? 0;

  const basis = Math.min(endTaxableBasis, endTaxable);
  const unrealizedGain = Math.max(0, endTaxable - basis);
  const basisExceeds = endTaxableBasis > endTaxable;

  const rothAdj = endRoth;
  const basisAdj = basis;
  const gainAdj = unrealizedGain * (1 - ltcgRate);
  const tradAdj = endTraditional * (1 - ordRate);

  const toReal = (n: number) => (real ? n / inflFactor : n);
  const totalDisplay = real ? proj.endTaxAdjustedReal : proj.endTaxAdjustedNominal;

  const rows: Array<{ label: string; balance: number; rateLabel: string; result: number; note?: string }> = [
    { label: 'Roth balance', balance: endRoth, rateLabel: '0% (untaxed)', result: rothAdj },
    { label: 'Taxable cost basis', balance: basis, rateLabel: '0% (already taxed)', result: basisAdj },
    {
      label: 'Taxable unrealized gain',
      balance: unrealizedGain,
      rateLabel: `${(ltcgRate * 100).toFixed(0)}% cap-gains rate`,
      result: gainAdj,
      note: basisExceeds ? 'Basis clamped to balance (basis exceeded balance at plan end)' : undefined,
    },
    {
      label: 'Pre-tax (401k/IRA) balance',
      balance: endTraditional,
      rateLabel: `${(ordRate * 100).toFixed(0)}% blended effective rate`,
      result: tradAdj,
    },
  ];

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(13,27,46,0.55)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 14, maxWidth: 580, width: '100%', padding: '28px 32px', maxHeight: '85vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)' }}>Tax-Adjusted End Balance</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-muted)' }}>×</button>
        </div>

        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
          What the ending balance is worth after the tax still owed on it — at age {plan.personA.planThroughAge}, {real ? "today's $" : 'nominal $'}.
        </div>

        {/* Per-bucket table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '6px 0', color: 'var(--text-muted)', fontWeight: 600 }}>Bucket</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Balance</th>
              <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--text-muted)', fontWeight: 600 }}>Tax rate</th>
              <th style={{ textAlign: 'right', padding: '6px 0', color: 'var(--text-muted)', fontWeight: 600 }}>After-tax</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid var(--border)', opacity: toReal(r.balance) < 1 ? 0.45 : 1 }}>
                <td style={{ padding: '8px 0' }}>
                  <div>{r.label}</div>
                  {r.note && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>↳ {r.note}</div>}
                </td>
                <td style={{ textAlign: 'right', padding: '8px 8px', fontFamily: "'DM Mono',monospace" }}>{fmtFull(toReal(r.balance))}</td>
                <td style={{ textAlign: 'right', padding: '8px 8px', color: 'var(--text-muted)' }}>{r.rateLabel}</td>
                <td style={{ textAlign: 'right', padding: '8px 0', fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{fmtFull(toReal(r.result))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid var(--navy)' }}>
              <td colSpan={3} style={{ padding: '10px 0', fontWeight: 700, color: 'var(--navy)' }}>Tax-Adjusted Total</td>
              <td style={{ textAlign: 'right', padding: '10px 0', fontFamily: "'DM Mono',monospace", fontWeight: 700, fontSize: 15, color: '#c9a84c' }}>{fmtM(totalDisplay)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Disclosure footer */}
        <div style={{ marginTop: 20, padding: '12px 16px', background: '#f8f9fa', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong>Model assumptions:</strong> This adjustment applies to the ending balance only — every year before it is taxed with full bracket math by the projection engine. Flat effective rates on whole balances are used here, not bracket math. No state income tax, NIIT, IRMAA surcharges, or heirs' planning deductions are included. Rates assume a one-time full liquidation; actual tax in a phased drawdown will differ. Adjust the rates under Portfolio settings to reflect your situation.
        </div>
      </div>
    </div>
  );
}
