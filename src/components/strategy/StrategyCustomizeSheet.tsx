import { useEffect } from 'react';
import { useProjection } from '../../store/usePlanStore';
import ConversionDetail from './ConversionDetail';
import CustomBlendPanel from './CustomBlendPanel';
import RothVsRmd from '../charts/RothVsRmd';
import { useIsMobile } from '../../hooks/useIsMobile';

/** Right-drawer side sheet. `mode` controls which panel is shown:
 *  'blend' → Custom Blend Editor; 'conversion' → the active conversion mode's detail fields;
 *  'chart' → the Conversions-vs-RMD chart. Mode/preset selection lives inline in StrategyChooser. */
export default function StrategyCustomizeSheet({ open, onClose, mode }: { open: boolean; onClose: () => void; mode: 'blend' | 'conversion' | 'chart' }) {
  const isMobile = useIsMobile();
  const proj = useProjection();
  const hasConvRmd = proj.rows.some((r) => r.rothConv > 0 || r.rmd > 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Customize strategy"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13,27,46,0.45)',
        zIndex: isMobile ? 160 : 200,
        display: 'flex',
        justifyContent: isMobile ? undefined : 'flex-end',
        alignItems: isMobile ? 'flex-end' : undefined,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? '100%' : mode === 'blend' ? 'min(800px, 100%)' : mode === 'chart' ? 'min(680px, 100%)' : 'min(560px, 100%)',
          height: isMobile ? '85vh' : '100%',
          borderRadius: isMobile ? '20px 20px 0 0' : undefined,
          background: 'var(--bg-surface, #fff)',
          boxShadow: isMobile ? '0 -8px 24px rgba(13,27,46,0.25)' : '-8px 0 24px rgba(13,27,46,0.25)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isMobile && (
          <div style={{ width: 40, height: 4, background: 'rgba(13,27,46,0.15)', borderRadius: 2, margin: '12px auto 0', flexShrink: 0 }} />
        )}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(250,247,242,0.6)',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>Customize</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Playfair Display', serif" }}>
              {mode === 'blend' ? 'Custom Blend Editor' : mode === 'chart' ? 'Conversions vs RMDs' : 'Conversion Details'}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: '1px solid var(--border-light)',
              background: 'transparent',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 13,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >Close</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', paddingBottom: isMobile ? 'calc(16px + env(safe-area-inset-bottom))' : 16 }}>
          {mode === 'conversion' && <ConversionDetail />}
          {mode === 'blend' && <CustomBlendPanel />}
          {mode === 'chart' && (
            <div>
              <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Voluntary Roth conversions (above zero) vs forced RMDs (below zero) by age.
              </div>
              {hasConvRmd ? (
                <RothVsRmd proj={proj} real height={340} />
              ) : (
                <div style={{ padding: '40px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', border: '1px solid var(--border-light)', borderRadius: 10 }}>
                  No Roth conversions or RMDs are projected for this plan yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
