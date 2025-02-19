import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import DashboardGrid from '../../src/components/dashboard/DashboardGrid';
import QuickActions from '../../src/components/dashboard/QuickActions';
import SystemHealthCard from '../../src/components/analytics/SystemHealthCard';
import RecentActivity from '../../src/components/dashboard/RecentActivity';
import { ThemeProvider } from '../../src/hooks/useTheme';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock child components
jest.mock('../../src/components/dashboard/QuickActions', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="quick-actions">Quick Actions</div>)
}));

jest.mock('../../src/components/analytics/SystemHealthCard', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="system-health">System Health</div>)
}));

jest.mock('../../src/components/dashboard/RecentActivity', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="recent-activity">Recent Activity</div>)
}));

// Mock ResizeObserver
const mockResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
window.ResizeObserver = mockResizeObserver;

describe('DashboardGrid', () => {
  const defaultProps = {
    className: 'custom-dashboard',
    theme: 'system' as const,
    errorBoundary: true,
    testId: 'dashboard-grid'
  };

  // Setup function for common test scenarios
  const setup = (props = {}) => {
    return render(
      <ThemeProvider>
        <DashboardGrid {...defaultProps} {...props} />
      </ThemeProvider>
    );
  };

  beforeAll(() => {
    // Configure axe for accessibility testing
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  it('renders all dashboard sections correctly', () => {
    setup();
    
    expect(screen.getByTestId('dashboard-grid')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
    expect(screen.getByTestId('system-health')).toBeInTheDocument();
    expect(screen.getByTestId('recent-activity')).toBeInTheDocument();
  });

  it('handles responsive layouts correctly', async () => {
    const { rerender } = setup();

    // Test mobile viewport
    window.innerWidth = 320;
    fireEvent(window, new Event('resize'));
    await waitFor(() => {
      const grid = screen.getByTestId('dashboard-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: 'repeat(4, 1fr)' });
    });

    // Test tablet viewport
    window.innerWidth = 768;
    fireEvent(window, new Event('resize'));
    await waitFor(() => {
      const grid = screen.getByTestId('dashboard-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: 'repeat(8, 1fr)' });
    });

    // Test desktop viewport
    window.innerWidth = 1024;
    fireEvent(window, new Event('resize'));
    await waitFor(() => {
      const grid = screen.getByTestId('dashboard-grid');
      expect(grid).toHaveStyle({ gridTemplateColumns: 'repeat(12, 1fr)' });
    });
  });

  it('meets accessibility requirements', async () => {
    const { container } = setup();
    
    // Run axe accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Check ARIA roles and labels
    expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Dashboard');
    expect(screen.getAllByRole('region')).toHaveLength(3);
  });

  it('handles theme changes correctly', async () => {
    const { rerender } = setup({ theme: 'light' });
    
    // Check light theme
    expect(screen.getByTestId('dashboard-grid')).toHaveClass('lightMode');
    
    // Switch to dark theme
    rerender(
      <ThemeProvider>
        <DashboardGrid {...defaultProps} theme="dark" />
      </ThemeProvider>
    );
    
    expect(screen.getByTestId('dashboard-grid')).toHaveClass('darkMode');
  });

  it('handles error boundary correctly', async () => {
    // Mock console.error to prevent noise in test output
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Force an error in a child component
    QuickActions.mockImplementation(() => {
      throw new Error('Test error');
    });

    setup();

    // Verify error boundary fallback renders
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/dashboard error/i)).toBeInTheDocument();
    });

    consoleError.mockRestore();
  });

  it('handles resize observer correctly', () => {
    setup();

    // Verify ResizeObserver is initialized
    expect(mockResizeObserver).toHaveBeenCalled();
    
    // Verify cleanup on unmount
    const { disconnect } = mockResizeObserver.mock.results[0].value;
    expect(disconnect).not.toHaveBeenCalled();
    
    // Unmount component
    screen.unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('supports RTL layout', async () => {
    // Set document direction to RTL
    document.documentElement.dir = 'rtl';
    
    const { container } = setup();
    
    expect(container.firstChild).toHaveStyle({ direction: 'rtl' });
    
    // Reset document direction
    document.documentElement.dir = 'ltr';
  });

  it('handles keyboard navigation correctly', async () => {
    setup();
    const user = userEvent.setup();

    // Tab through interactive elements
    await user.tab();
    expect(screen.getByTestId('quick-actions')).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId('system-health')).toHaveFocus();

    await user.tab();
    expect(screen.getByTestId('recent-activity')).toHaveFocus();
  });

  it('maintains correct grid layout on content updates', async () => {
    setup();
    
    // Simulate content update
    RecentActivity.mockImplementation(() => (
      <div data-testid="recent-activity" style={{ height: '500px' }}>
        Updated Activity
      </div>
    ));

    // Verify grid maintains structure
    await waitFor(() => {
      const grid = screen.getByTestId('dashboard-grid');
      expect(grid).toMatchSnapshot();
    });
  });
});