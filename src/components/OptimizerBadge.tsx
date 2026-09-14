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

  if (state.kind === 'orphaned') {
    return (
      <span className="badge badge-neutral" style={style}>
        {label} · strategy cleared
      </span>
    );
  }

  if (state.kind === 'stale') {
    return (
      <span className="badge badge-warning" style={style}>
        ⚡ {label} · inputs changed
      </span>
    );
  }

  return (
    <span className="badge badge-neutral" style={style}>
      ✓ {label}
    </span>
  );
}
