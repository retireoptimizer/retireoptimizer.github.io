/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { planInputKey } from '../engine/planInputKey';
import { samplePlan } from '../schemas/plan';
import type { Plan } from '../schemas/plan';

// Mock the stores so we can control what usePlanStore/useOptimizerStore return
// without needing a real localStorage-backed persist layer in jsdom.
const mockPlan = vi.fn<[], Plan>(() => samplePlan());
const mockPendingPlan = vi.fn<[], Plan | null>(() => null);

vi.mock('../store/usePlanStore', () => ({
  usePlanStore: (selector: (s: { plan: Plan }) => unknown) => selector({ plan: mockPlan() }),
}));
vi.mock('../store/useOptimizerStore', () => ({
  useOptimizerStore: (selector: (s: { pendingPlan: Plan | null }) => unknown) =>
    selector({ pendingPlan: mockPendingPlan() }),
}));

// Import after mocks are set up
const { default: StalePlanGate } = await import('./StalePlanGate');

const BASE_WINDOW = {
  fromAge: 60, toAge: 95, pctTaxable: 0.5, pctTraditional: 0.3, pctRoth: 0.2,
} as const;

const renderGate = () => render(<MemoryRouter><StalePlanGate /></MemoryRouter>);

describe('StalePlanGate', () => {
  beforeEach(() => {
    mockPlan.mockReturnValue(samplePlan());
    mockPendingPlan.mockReturnValue(null);
  });

  it('renders nothing when policyStatus is none', () => {
    const { container } = renderGate();
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when policyStatus is fresh', () => {
    const base = samplePlan();
    mockPlan.mockReturnValue({
      ...base,
      customPolicy: { windows: [BASE_WINDOW], source: 'optimizer', inputKey: planInputKey(base) },
    });
    const { container } = renderGate();
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when policyStatus is hand-edited', () => {
    mockPlan.mockReturnValue({
      ...samplePlan(),
      customPolicy: { windows: [BASE_WINDOW], source: 'manual' },
    });
    const { container } = renderGate();
    expect(container.firstChild).toBeNull();
  });

  it('renders the gate when policyStatus is stale', () => {
    mockPlan.mockReturnValue({
      ...samplePlan(),
      customPolicy: { windows: [BASE_WINDOW], source: 'optimizer', inputKey: 'old-key' },
    });
    renderGate();
    expect(screen.getByText(/inputs have changed/i)).toBeTruthy();
    expect(screen.getByText(/Back to Inputs/i)).toBeTruthy();
  });

  it('renders nothing when pending even if stale key', () => {
    mockPlan.mockReturnValue({
      ...samplePlan(),
      customPolicy: { windows: [BASE_WINDOW], source: 'optimizer', inputKey: 'old-key' },
    });
    mockPendingPlan.mockReturnValue(samplePlan());
    const { container } = renderGate();
    expect(container.firstChild).toBeNull();
  });
});
