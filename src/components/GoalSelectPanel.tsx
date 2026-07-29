import { USER_GOALS, type UserGoal } from '../engine/recommender';

interface Props {
  goal: UserGoal;
  onGoalChange: (g: UserGoal) => void;
}

export default function GoalSelectPanel({ goal, onGoalChange }: Props) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title"><div className="panel-title-dot"></div>What outcome do you want to optimize for?</div>
      </div>
      <div className="panel-body" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(Object.values(USER_GOALS) as Array<typeof USER_GOALS[UserGoal]>).map((g) => {
            const active = g.key === goal;
            return (
              <label key={g.key} onClick={() => onGoalChange(g.key)} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px',
                borderRadius: 10,
                background: active ? 'rgba(184,98,10,0.07)' : 'rgba(13,27,46,0.02)',
                cursor: 'pointer',
              }}>
                <input type="radio" name="opt-goal" checked={active} readOnly style={{ marginTop: 3, accentColor: 'var(--gold)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                    {g.label}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{g.description}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
