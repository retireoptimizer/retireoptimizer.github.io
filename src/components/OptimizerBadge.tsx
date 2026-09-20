import type { OptimizerAppliedState } from '../hooks/useOptimizerApplied';
import { GOAL_LABELS } from '../engine/goalLabels';

interface Props {
  state: OptimizerAppliedState;
  style?: React.CSSProperties;
}

/** Badge reflecting the committed optimizer state. Returns null for none/pending/hand-edited. */
export default function OptimizerBadge({ state, style }: Props) {
  if (state.kind === 'none' || state.kind === 'pending' || state.kind === 'hand-edited') return null;

  const label = GOAL_LABELS[state.goal] ?? state.goal;
  const mc = state.source === 'monte-carlo';
  const sourceText = mc ? ' · Monte Carlo tuned' : '';
  const title = mc
    ? 'This strategy came from Optimize for Robustness on the Monte Carlo page. It replaced the strategy the goal optimizer produced.'
    : 'This strategy came from the goal optimizer on the Inputs page.';

  if (state.kind === 'stale') {
    return (
      <span className="badge badge-warning" style={style} title={title}>
        ⚡ {label}{sourceText} · inputs changed
      </span>
    );
  }

  return (
    <span className="badge badge-neutral" style={style} title={title}>
      ✓ {label}{sourceText}
    </span>
  );
}
