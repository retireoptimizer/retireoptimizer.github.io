export default function Projections() {
  return (
    <div className="page">
      <div className="page-header">
        <div className="page-header-inner">
          <div>
            <div className="page-eyebrow">Analysis</div>
            <div className="page-title">Year-by-Year Projections</div>
            <div className="page-subtitle">Full 75-year detail — matches spreadsheet columns</div>
          </div>
          <div className="header-actions">
            <div className="toggle-group" style={{ width: '220px' }}>
              <button className="toggle-opt active">Nominal $</button>
              <button className="toggle-opt">Today's $</button>
            </div>
          </div>
        </div>
      </div>
      <div className="page-body">
        {/* Column-group legend */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#0d1b2e20' }}></div>Identity</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(201,168,76,0.15)' }}></div>Contributions</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(26,138,90,0.15)' }}></div>Income</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(192,57,43,0.12)' }}></div>Outflows</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(59,94,138,0.12)' }}></div>Tax &amp; Conversions</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}><div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(13,27,46,0.05)' }}></div>Balances</div>
        </div>
        <div className="panel">
          <div className="panel-body" style={{ padding: '0', overflowX: 'auto' }}>
            <table className="data-table" style={{ minWidth: '1600px', fontSize: '12px' }}>
              <thead>
                <tr>
                  {/* Identity */}
                  <th style={{ background: '#0d1b2e10' }}>Yr</th>
                  <th style={{ background: '#0d1b2e10' }}>Age A</th>
                  <th style={{ background: '#0d1b2e10' }}>Age B</th>
                  <th style={{ background: '#0d1b2e10' }}>Phase</th>
                  {/* Contributions */}
                  <th style={{ background: 'rgba(201,168,76,0.12)' }}>Contrib A</th>
                  <th style={{ background: 'rgba(201,168,76,0.12)' }}>Contrib B</th>
                  {/* Income */}
                  <th style={{ background: 'rgba(26,138,90,0.1)' }}>SS A</th>
                  <th style={{ background: 'rgba(26,138,90,0.1)' }}>SS B</th>
                  <th style={{ background: 'rgba(26,138,90,0.1)' }}>Total SS</th>
                  {/* Outflows */}
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>Net Spend</th>
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>WD Taxable</th>
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>WD Trad.</th>
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>WD Roth</th>
                  <th style={{ background: 'rgba(192,57,43,0.08)' }}>Total WD</th>
                  {/* Tax & Conversions */}
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>RMD</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>Roth Conv.</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>Ord. Income</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>LTCG</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>Fed Tax</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>Eff. Rate</th>
                  <th style={{ background: 'rgba(59,94,138,0.1)' }}>Std Deduction</th>
                  {/* Balances */}
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>Beg Taxable</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>Beg Trad.</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>Beg Roth</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>End Taxable</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>End Trad.</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)' }}>End Roth</th>
                  <th style={{ background: 'rgba(13,27,46,0.05)', fontWeight: 700 }}>End Total</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [1,  52, 50, 'Accum.', '$23,000', '$18,000', '—',       '—',       '—',       '$95,000',  '—',        '—',        '—',        '—',        '—',    '—',       '$72,000',   '$18,000', '$8,500',  '9.2%',  '$29,200', '$420,000', '$680,000', '$185,000', '$435,000', '$705,000', '$196,000', '$1,336,000'],
                  [2,  53, 51, 'Accum.', '$23,600', '$18,360', '—',       '—',       '—',       '$97,375',  '—',        '—',        '—',        '—',        '—',    '—',       '$73,800',   '$18,450', '$8,670',  '9.2%',  '$29,200', '$435,000', '$705,000', '$196,000', '$451,000', '$731,000', '$207,000', '$1,389,000'],
                  [3,  54, 52, 'Accum.', '$24,200', '$18,720', '—',       '—',       '—',       '$99,810',  '—',        '—',        '—',        '—',        '—',    '$70,000', '$75,600',   '$18,900', '$17,800', '12.1%', '$29,200', '$451,000', '$731,000', '$207,000', '$468,000', '$691,000', '$286,000', '$1,445,000'],
                  [13, 64, 62, 'Accum.', '$28,000', '$0',      '—',       '$26,400', '$26,400', '$127,000', '—',        '—',        '—',        '—',        '—',    '$70,000', '$89,000',   '$22,000', '$19,200', '13.8%', '$29,200', '$620,000', '$910,000', '$490,000', '$641,000', '$942,000', '$565,000', '$2,148,000'],
                  [14, 65, 63, 'Retire', '$0',      '$0',      '$33,600', '$26,400', '$60,000', '$159,000', '$88,000',  '$41,000',  '$30,000',  '$159,000', '—',    '$70,000', '$148,000',  '$18,500', '$22,400', '11.4%', '$30,800', '$641,000', '$942,000', '$565,000', '$562,000', '$904,000', '$640,000', '$2,106,000'],
                  [25, 76, 74, 'Retire', '$0',      '$0',      '$43,200', '$33,900', '$77,100', '$178,000', '$48,000',  '$92,500',  '—',        '$140,500', '$82,000','—',      '$221,000',  '—',       '$38,200', '19.8%', '$32,400', '$310,000', '$820,000', '$890,000', '$262,000', '$754,000', '$952,000', '$1,968,000'],
                ].map(row => (
                  <tr key={String(row[0])}>
                    {row.map((cell, i) => (
                      <td key={i} style={{ textAlign: i > 3 ? 'right' : 'center', color: typeof cell === 'string' && cell.startsWith('$') ? 'var(--text-primary)' : undefined }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr><td colSpan={28} style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>Full 75-year table populates in Phase 2 when the engine is connected</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
