import { DEFAULT_EQUITY_PCT } from '../engine/returnModels';

/**
 * Monte Carlo simulation settings.
 *
 * These are stress-test controls, not plan data: the deterministic projection runs on the user's
 * entered expected return, while Monte Carlo asks the separate question "how does this plan hold
 * up against real history for a given stock/bond mix?". Keeping the mix out of the Plan also keeps
 * it out of planInputKey, so changing it cannot mark an optimizer policy stale and bounce the user
 * off the Monte Carlo page via StalePlanGate.
 */
const STORAGE_KEY = 'fireopt-mc-prefs-v1';

/** Equity share as a whole percent, 0..100 — the unit the input field uses. */
export const DEFAULT_EQUITY_PCT_WHOLE = Math.round(DEFAULT_EQUITY_PCT * 100);

export function loadEquityPct(): number {
  if (typeof window === 'undefined') return DEFAULT_EQUITY_PCT_WHOLE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const v = (JSON.parse(raw) as { equityPct?: unknown }).equityPct;
      if (typeof v === 'number' && Number.isFinite(v)) {
        return Math.max(0, Math.min(100, Math.round(v)));
      }
    }
  } catch { /* corrupt or unavailable storage — fall through to the default */ }
  return DEFAULT_EQUITY_PCT_WHOLE;
}

export function saveEquityPct(equityPct: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ equityPct }));
  } catch { /* quota or private mode — the setting just will not persist */ }
}
