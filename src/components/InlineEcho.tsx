interface Props {
  /** Short text to render below an input — typically "<derived fact>: <value>". */
  children: React.ReactNode;
  tone?: 'info' | 'positive' | 'warning';
}

/** Small inline-echo row that mirrors a derived fact back to the user under an input.
 *  Use to confirm immediate impact of a numeric change ("you'll retire in 8 years",
 *  "projected portfolio at retirement: $2.4M"). */
export default function InlineEcho({ children, tone = 'info' }: Props) {
  const color =
    tone === 'positive' ? 'var(--success)' :
    tone === 'warning' ? 'var(--warning)' :
    'var(--text-secondary)';
  return (
    <div
      style={{
        marginTop: 4,
        fontSize: 11,
        color,
        lineHeight: 1.5,
        fontStyle: 'italic',
      }}
    >
      {children}
    </div>
  );
}
