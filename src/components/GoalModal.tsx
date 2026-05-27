import { useState } from 'react';
import { NumberInput } from './inputs/NumberInput';
import type { Goal } from '../schemas/plan';

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (g: Goal) => void;
}

export default function GoalModal({ open, onClose, onSave }: Props) {
  const currentYear = new Date().getFullYear();
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState(100000);
  const [targetYear, setTargetYear] = useState(currentYear + 5);
  const [priority, setPriority] = useState<Goal['priority']>('Important');
  const [fundingMode, setFundingMode] = useState<Goal['fundingMode']>('external');
  const [extBalance, setExtBalance] = useState(0);
  const [extMonthly, setExtMonthly] = useState(500);
  const [extReturn, setExtReturn] = useState(0.06);

  if (!open) return null;

  const save = () => {
    if (!name.trim()) return;
    const goal: Goal = {
      id: `goal-${Date.now()}`,
      name: name.trim(),
      targetAmount,
      targetYear,
      priority,
      fundingMode,
      externalAccount: fundingMode === 'external' ? {
        currentBalance: extBalance,
        monthlyContribution: extMonthly,
        expectedReturn: extReturn,
      } : undefined,
    };
    onSave(goal);
    // Reset
    setName(''); setTargetAmount(100000); setTargetYear(currentYear + 5);
    setPriority('Important'); setFundingMode('external');
    setExtBalance(0); setExtMonthly(500); setExtReturn(0.06);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(13,27,46,0.55)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, maxWidth: 560, width: '100%',
          maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)' }}>Add Goal</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, marginTop: 4 }}>What's the goal?</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 22, color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ padding: '20px 24px' }}>
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Goal Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Fund college, Beach home, Estate transfer" />
            </div>
            <div className="form-group">
              <label>Target Amount (today's $)</label>
              <NumberInput value={targetAmount} min={0} onCommit={setTargetAmount} />
            </div>
            <div className="form-group">
              <label>Target Year</label>
              <NumberInput value={targetYear} digits={0} min={currentYear} max={currentYear + 80} onCommit={(v) => setTargetYear(Math.round(v))} />
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as Goal['priority'])}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: '#fff' }}>
                <option value="Essential">Essential (weight 3)</option>
                <option value="Important">Important (weight 2)</option>
                <option value="Aspirational">Aspirational (weight 1)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Funding Source</label>
              <select value={fundingMode} onChange={(e) => setFundingMode(e.target.value as Goal['fundingMode'])}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, background: '#fff' }}>
                <option value="external">External Account (separate)</option>
                <option value="from-plan">From Retirement Plan</option>
                <option value="aspirational">Aspirational (not funded yet)</option>
              </select>
            </div>
          </div>

          {fundingMode === 'external' && (
            <div style={{ marginTop: 16, padding: 14, background: 'rgba(13,27,46,0.03)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', marginBottom: 10 }}>External Account</div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Current Balance ($)</label>
                  <NumberInput value={extBalance} min={0} onCommit={setExtBalance} />
                </div>
                <div className="form-group">
                  <label>Monthly Contribution ($)</label>
                  <NumberInput value={extMonthly} min={0} onCommit={setExtMonthly} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Expected Annual Return (%)</label>
                  <NumberInput value={extReturn} scale={100} digits={2} min={0} max={0.2} onCommit={setExtReturn} />
                </div>
              </div>
            </div>
          )}

          {fundingMode === 'from-plan' && (
            <div style={{ marginTop: 16, padding: 12, background: 'var(--warning-light)', borderRadius: 8, fontSize: 12, color: 'var(--warning)' }}>
              ⚠ This goal will draw from the retirement plan at year {targetYear}. It may affect plan longevity.
            </div>
          )}

          {fundingMode === 'aspirational' && (
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(13,27,46,0.04)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              Tracked only — no contributions assigned. Dashboard will show projected gap.
            </div>
          )}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-gold" onClick={save} disabled={!name.trim()}>Add Goal</button>
        </div>
      </div>
    </div>
  );
}
