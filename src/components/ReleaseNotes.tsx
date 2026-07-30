import { useEffect } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { RELEASES } from '../releases';

export default function ReleaseNotes({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      aria-label="Release Notes"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
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
          width: isMobile ? '100%' : 'min(600px, 100%)',
          height: isMobile ? '88vh' : '100%',
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
          padding: '14px 20px 14px',
          borderBottom: '1px solid var(--border-light)',
          background: 'rgba(250,247,242,0.6)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>Changelog</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Playfair Display', serif" }}>
              Release Notes
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: '1px solid var(--border-light)', background: 'transparent',
              borderRadius: 8, padding: '6px 12px', fontSize: 13,
              cursor: 'pointer', color: 'var(--text-secondary)',
            }}
          >Close</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', paddingBottom: isMobile ? 'calc(24px + env(safe-area-inset-bottom))' : 24 }}>
          {RELEASES.map((release) => {
            const features = release.changes.filter((c) => c.kind === 'feature');
            const fixes = release.changes.filter((c) => c.kind === 'fix');
            const cosmetic = release.changes.filter((c) => c.kind === 'cosmetic');
            return (
              <div key={release.version} style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 17, fontWeight: 700, color: 'var(--text-primary)',
                    fontFamily: "'Playfair Display', serif",
                  }}>v{release.version}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{release.date}</span>
                </div>
                {release.summary && (
                  <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px', lineHeight: 1.5 }}>{release.summary}</p>
                )}

                {features.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', margin: '16px 0 8px' }}>
                      What's New
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {features.map((c, i) => (
                        <li key={i} style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.55 }}>{c.text}</li>
                      ))}
                    </ul>
                  </>
                )}

                {(fixes.length > 0 || cosmetic.length > 0) && (
                  <details style={{ marginTop: 14 }}>
                    <summary style={{
                      fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer',
                      listStyle: 'none', display: 'flex', alignItems: 'center', gap: 6,
                      userSelect: 'none',
                    }}>
                      <span style={{ fontSize: 10 }}>▶</span>
                      {fixes.length > 0 && cosmetic.length > 0
                        ? `${fixes.length} bug fix${fixes.length !== 1 ? 'es' : ''} · ${cosmetic.length} cosmetic change${cosmetic.length !== 1 ? 's' : ''}`
                        : fixes.length > 0
                        ? `${fixes.length} bug fix${fixes.length !== 1 ? 'es' : ''}`
                        : `${cosmetic.length} cosmetic change${cosmetic.length !== 1 ? 's' : ''}`}
                    </summary>
                    <ul style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[...fixes, ...cosmetic].map((c, i) => (
                        <li key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{c.text}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
