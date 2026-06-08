import type { Insight } from '../engine/explain';

const severityToTone = (s: Insight['severity']): string => {
  if (s === 'warning') return 'danger';
  if (s === 'caution') return 'warning';
  return 'info';
};

const severityIcon = (s: Insight['severity']): string => {
  if (s === 'warning') return '⚠';
  if (s === 'caution') return '◆';
  return '◇';
};

interface Props {
  insight: Insight;
}

export default function InsightCard({ insight }: Props) {
  return (
    <div className={`insight-card ${severityToTone(insight.severity)}`}>
      <div className="insight-icon" aria-hidden="true">{severityIcon(insight.severity)}</div>
      <div className="insight-content">
        <div className="insight-title">{insight.title}</div>
        <div className="insight-body">
          {insight.body}
          {insight.evidence && (
            <span style={{ display: 'block', marginTop: 4, opacity: 0.75, fontSize: 11 }}>
              {insight.evidence}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
