import { useRef } from 'react';
import { GuideContent, SECTIONS } from '../components/HowToGuide';

export default function HelpPage() {
  const bodyRef = useRef<HTMLDivElement>(null);

  const scrollTo = (id: string) => {
    const el = bodyRef.current?.querySelector(`#${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-surface, #fff)', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        padding: '14px 28px 12px',
        borderBottom: '1px solid var(--border-light)',
        background: 'rgba(250,247,242,0.95)',
        backdropFilter: 'blur(6px)',
      }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>Reference</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'Playfair Display', serif" }}>
            How to Use Retirement Optimizer
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={{
                background: 'var(--bg-muted, #f5f4f2)', border: '1px solid var(--border-light)',
                borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', color: 'var(--text-secondary)', whiteSpace: 'nowrap',
              }}
            >{s.label}</button>
          ))}
        </div>
      </div>

      <div ref={bodyRef} style={{ flex: 1, padding: '24px 28px', maxWidth: 820, margin: '0 auto', width: '100%' }}>
        <GuideContent />
      </div>
    </div>
  );
}
