/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from './useIsMobile';

describe('useIsMobile', () => {
  let listeners: ((e: MediaQueryListEvent) => void)[] = [];
  let mockMatches = false;

  beforeEach(() => {
    listeners = [];
    mockMatches = false;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: mockMatches,
        addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => listeners.push(fn),
        removeEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => {
          listeners = listeners.filter((l) => l !== fn);
        },
      })),
    });
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1280 });
  });

  it('returns false on desktop (>768px)', () => {
    window.innerWidth = 1024;
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it('returns true on mobile (≤768px)', () => {
    window.innerWidth = 390;
    mockMatches = true;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('updates when viewport changes', () => {
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => {
      listeners.forEach((fn) => fn({ matches: true } as MediaQueryListEvent));
    });
    expect(result.current).toBe(true);
  });

  it('accepts custom breakpoint', () => {
    window.innerWidth = 500;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        addEventListener: () => {},
        removeEventListener: () => {},
      }),
    });
    const { result } = renderHook(() => useIsMobile(480));
    expect(result.current).toBe(true);
  });

  it('cleans up event listener on unmount', () => {
    const { unmount } = renderHook(() => useIsMobile());
    expect(listeners.length).toBe(1);
    unmount();
    expect(listeners.length).toBe(0);
  });
});
