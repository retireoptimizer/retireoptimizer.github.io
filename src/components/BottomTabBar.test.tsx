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
    expect(screen.getByText('Plan')).toBeTruthy();
    expect(screen.getByText('Cash')).toBeTruthy();
    expect(screen.getByText('Portfolio')).toBeTruthy();
    expect(screen.getByText('Goals')).toBeTruthy();
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  it('applies active class to the current route tab', () => {
    renderWithRouter('/personal');
    const planTab = screen.getByText('Plan').closest('a');
    expect(planTab?.className).toContain('active');
  });

  it('does not apply active class to non-current tabs', () => {
    renderWithRouter('/personal');
    const dashTab = screen.getByText('Dashboard').closest('a');
    expect(dashTab?.className).not.toContain('active');
  });

  it('each tab links to the correct route', () => {
    renderWithRouter();
    expect(screen.getByText('Plan').closest('a')?.getAttribute('href')).toBe('/personal');
    expect(screen.getByText('Cash').closest('a')?.getAttribute('href')).toBe('/cash-flow');
    expect(screen.getByText('Portfolio').closest('a')?.getAttribute('href')).toBe('/portfolio');
    expect(screen.getByText('Goals').closest('a')?.getAttribute('href')).toBe('/strategy');
    expect(screen.getByText('Dashboard').closest('a')?.getAttribute('href')).toBe('/dashboard');
  });

  it('has an accessible nav landmark', () => {
    renderWithRouter();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy();
  });
});
