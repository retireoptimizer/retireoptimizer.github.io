/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { loadEquityPct, saveEquityPct, DEFAULT_EQUITY_PCT_WHOLE } from './mcPrefs';

// jsdom in this setup exposes `localStorage` as a bare object with no Storage methods, so the
// real thing has to be stubbed in. mcPrefs guards every access in try/catch and falls back to the
// default, which is why the page still works rather than throwing when storage is unavailable.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
    },
  });
});

describe('Monte Carlo equity preference', () => {
  it('round-trips a saved value', () => {
    // The bug this guards: the MC page held equityPct in local React state only, so the chosen
    // mix drove the run in front of you and then vanished on reload.
    saveEquityPct(85);
    expect(loadEquityPct()).toBe(85);
  });

  it('falls back to the default when unset', () => {
    expect(loadEquityPct()).toBe(DEFAULT_EQUITY_PCT_WHOLE);
  });

  it('falls back to the default on corrupt or non-numeric storage', () => {
    store.set('fireopt-mc-prefs-v1', 'not json');
    expect(loadEquityPct()).toBe(DEFAULT_EQUITY_PCT_WHOLE);

    store.set('fireopt-mc-prefs-v1', JSON.stringify({ equityPct: 'lots' }));
    expect(loadEquityPct()).toBe(DEFAULT_EQUITY_PCT_WHOLE);
  });

  it('clamps out-of-range stored values into 0..100', () => {
    store.set('fireopt-mc-prefs-v1', JSON.stringify({ equityPct: 250 }));
    expect(loadEquityPct()).toBe(100);

    store.set('fireopt-mc-prefs-v1', JSON.stringify({ equityPct: -40 }));
    expect(loadEquityPct()).toBe(0);
  });

  it('does not throw when storage is entirely unavailable', () => {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {} });
    expect(() => saveEquityPct(70)).not.toThrow();
    expect(loadEquityPct()).toBe(DEFAULT_EQUITY_PCT_WHOLE);
  });
});
