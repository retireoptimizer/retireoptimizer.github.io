export const GOAL_LABELS: Record<string, string> = {
  'max-end-balance': 'Max End Balance',
  'max-sustainable-spending': 'Max Spending',
  'min-retirement-age': 'Earliest Retire',
};

/** Monte Carlo robustness posture. The page no longer asks the user to pick one (all three
 *  scored within a rounding error of each other on real plans), so this exists for the engine
 *  and for reading back `plan.mcTuning.posture` on plans saved earlier. */
export type McPosture = 'floor' | 'balanced' | 'growth';
