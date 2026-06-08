import type { ReactNode } from 'react';
import { usePlanStore } from '../../store/usePlanStore';

interface Props {
  /** One-sentence caption describing what the chart shows. */
  caption?: string;
  /** Set false when the chart shows percentages or rates, not dollars — suppresses the real/nominal note. */
  showRealNote?: boolean;
  children: ReactNode;
}

/** Wrapper that adds a small explanatory caption below a chart and (optionally)
 *  a one-line reminder of whether values are inflation-adjusted. Keeps charts
 *  themselves free of UI chrome. */
export default function ChartFrame({ caption, showRealNote = true, children }: Props) {
  const displayMode = usePlanStore((s) => s.displayMode);
  const real = displayMode === 'real';

  return (
    <div>
      {children}
      {(caption || showRealNote) && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: 'var(--text-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            lineHeight: 1.5,
          }}
        >
          <span>{caption}</span>
          {showRealNote && (
            <span style={{ fontStyle: 'italic', whiteSpace: 'nowrap' }}>
              {real ? "Today's $ (inflation-adjusted)" : 'Nominal $'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
