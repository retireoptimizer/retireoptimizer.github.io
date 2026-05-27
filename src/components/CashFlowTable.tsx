import { useState } from 'react';
import type { CashFlowYear } from '../engine/cashFlow';
import { fmtUSD } from '../lib/format';

interface Props {
  rows: CashFlowYear[];
  title?: string;
  maxHeight?: number;
}

export default function CashFlowTable({ rows, title = 'Cash Flow Plan (Today\'s $)', maxHeight = 420 }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
        {title} · {rows.length} retirement years · Sources stack into Uses each year.
      </div>
      <div style={{ maxHeight, overflowY: 'auto', border: '1px solid var(--border-light)', borderRadius: 8 }}>
        <table className="data-table" style={{ margin: 0 }}>
          <thead style={{ position: 'sticky', top: 0, background: 'var(--cream)', zIndex: 2 }}>
            <tr>
              <th>Age</th>
              <th>Phase</th>
              <th style={{ textAlign: 'right' }}>SS</th>
              <th style={{ textAlign: 'right' }}>Other</th>
              <th style={{ textAlign: 'right' }}>Withdraw · Taxable</th>
              <th style={{ textAlign: 'right' }}>Withdraw · Pre-tax</th>
              <th style={{ textAlign: 'right' }}>Withdraw · Roth</th>
              <th style={{ textAlign: 'right' }}>Sources</th>
              <th style={{ textAlign: 'right' }}>Spending</th>
              <th style={{ textAlign: 'right' }}>Fed Tax</th>
              <th style={{ textAlign: 'right' }}>State + IRMAA</th>
              <th style={{ textAlign: 'right' }}>Uses</th>
              <th style={{ textAlign: 'right' }}>Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isOpen = expanded === r.year;
              const goodDelta = Math.abs(r.netDelta) < 1.5;
              return (
                <>
                  <tr
                    key={r.year}
                    onClick={() => setExpanded(isOpen ? null : r.year)}
                    style={{ cursor: 'pointer', background: isOpen ? 'rgba(201,168,76,0.05)' : undefined }}
                  >
                    <td><strong>{r.ageA}</strong>{r.ageB ? ` / ${r.ageB}` : ''}</td>
                    <td><span className="badge badge-neutral">{r.phase}</span></td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{fmtUSD(r.sources.socialSecurity)}</td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{fmtUSD(r.sources.otherIncome)}</td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{fmtUSD(r.sources.wdTaxable)}</td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{fmtUSD(r.sources.wdTraditional)}</td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{fmtUSD(r.sources.wdRoth)}</td>
                    <td className="td-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{fmtUSD(r.sources.total)}</td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{fmtUSD(r.uses.netSpending)}</td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{fmtUSD(r.uses.federalTax)}</td>
                    <td className="td-mono" style={{ textAlign: 'right' }}>{fmtUSD(r.uses.stateTax + r.uses.irmaa)}</td>
                    <td className="td-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{fmtUSD(r.uses.total)}</td>
                    <td className="td-mono" style={{ textAlign: 'right', color: goodDelta ? 'var(--success)' : 'var(--warning)' }}>{fmtUSD(r.netDelta)}</td>
                  </tr>
                  {isOpen && r.sources.rothConversion > 0 && (
                    <tr key={`${r.year}-detail`}>
                      <td colSpan={13} style={{ background: 'rgba(13,27,46,0.03)', fontSize: 12, padding: '8px 16px' }}>
                        ↪ Roth conversion this year: <strong>{fmtUSD(r.sources.rothConversion)}</strong> (Trad → Roth; tax cost is bundled into Federal Tax above)
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
