import { useNavigate } from 'react-router-dom';
import { usePlanStore } from '../store/usePlanStore';
import { useOptimizerStore } from '../store/useOptimizerStore';
import { policyStatus } from '../engine/policyStatus';

/**
 * Renders a blocking prompt when the committed plan's optimizer policy is stale.
 * Mount as an early return on result pages (Dashboard, Projections, TaxPlanning, MonteCarlo).
 * Returns null when the gate should not fire.
 */
export default function StalePlanGate() {
  const plan = usePlanStore((s) => s.plan);
  const pendingPlan = useOptimizerStore((s) => s.pendingPlan);
  const navigate = useNavigate();

  // Never gate while an optimizer result is awaiting "Apply to Plan".
  if (pendingPlan !== null) return null;

  const status = policyStatus(plan);
  if (status !== 'stale') return null;

  return (
    <div style={{ padding: '48px 24px', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
      <div style={{
        background: '#fff8e1', border: '1px solid #f59e0b', borderRadius: 8,
        padding: '24px 28px', color: '#78350f',
      }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>⚠</div>
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>
          Your inputs have changed since the optimizer ran
        </div>
        <div style={{ fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
          The results shown here are based on a strategy built for your previous inputs.
          Re-run the optimizer to see accurate projections for your current plan.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={() => navigate('/personal')}
          >
            Back to Inputs
          </button>
        </div>
      </div>
    </div>
  );
}
