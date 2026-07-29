import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import BottomTabBar from './BottomTabBar';

const renderWithRouter = (initialPath = '/') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomTabBar />
    </MemoryRouter>
  );

describe('BottomTabBar', () => {
  it('renders all 5 tabs', () => {
    renderWithRouter();
    expect(screen.getByText('Inputs')).toBeTruthy();
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Project')).toBeTruthy();
    expect(screen.getByText('Taxes')).toBeTruthy();
    expect(screen.getByText('Simulate')).toBeTruthy();
  });

  it('applies active class to the current route tab', () => {
    renderWithRouter('/inputs');
    const inputsTab = screen.getByText('Inputs').closest('a');
    expect(inputsTab?.className).toContain('active');
  });

  it('does not apply active class to non-current tabs', () => {
    renderWithRouter('/inputs');
    const dashTab = screen.getByText('Dashboard').closest('a');
    expect(dashTab?.className).not.toContain('active');
  });

  it('each tab links to the correct route', () => {
    renderWithRouter();
    expect(screen.getByText('Inputs').closest('a')?.getAttribute('href')).toBe('/inputs');
    expect(screen.getByText('Dashboard').closest('a')?.getAttribute('href')).toBe('/dashboard');
    expect(screen.getByText('Project').closest('a')?.getAttribute('href')).toBe('/projections');
    expect(screen.getByText('Taxes').closest('a')?.getAttribute('href')).toBe('/taxes');
    expect(screen.getByText('Simulate').closest('a')?.getAttribute('href')).toBe('/montecarlo');
  });

  it('has an accessible nav landmark', () => {
    renderWithRouter();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy();
  });
});
