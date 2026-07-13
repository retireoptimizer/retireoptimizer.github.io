import { useEffect } from 'react';
import { useProjection } from '../../store/usePlanStore';
import ConversionModePanel from './ConversionModePanel';
import CustomBlendPanel from './CustomBlendPanel';
import RothVsRmd from '../charts/RothVsRmd';
import { useIsMobile } from '../../hooks/useIsMobile';

/** Right-drawer side sheet hosting the rich strategy controls that don't fit
 *  inline on the Dashboard chip row. Closes on Escape or backdrop click. */
export default function StrategyCustomizeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const proj = useProjection();
  const isMobile = useIsMobile();

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
        zIndex: isMobile ? 160 : 100,
        display: 'flex',
        justifyContent: isMobile ? undefined : 'flex-end',
        alignItems: isMobile ? 'flex-end' : undefined,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? '100%' : 'min(560px, 100%)',
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
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Playfair Display', serif" }}>Strategy details</div>
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
          <ConversionModePanel />
          <CustomBlendPanel />
          <div className="panel" style={{ marginTop: 20 }}>
            <div className="panel-header"><div className="panel-title"><div className="panel-title-dot"></div>Conversions vs RMDs</div></div>
            <div className="panel-body"><RothVsRmd proj={proj} real height={240} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
