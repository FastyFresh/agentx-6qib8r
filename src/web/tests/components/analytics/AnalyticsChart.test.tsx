import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { axe, toHaveNoViolations } from 'jest-axe';
import { configureStore } from '@reduxjs/toolkit';
import { resizeWindow } from '@testing-library/dom';
import AnalyticsChart from '../../../../src/components/analytics/AnalyticsChart';
import { useMetrics } from '../../../../src/hooks/useMetrics';
import { MetricType } from '../../../../src/types/metrics.types';
import { LoadingState } from '../../../../src/types/common.types';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock useMetrics hook
jest.mock('../../../../src/hooks/useMetrics');

// Mock WebSocket
const mockWebSocket = {
  send: jest.fn(),
  close: jest.fn()
};

// Mock Redux store
const mockStore = configureStore({
  reducer: {
    metrics: (state = {}, action) => state
  }
});

// Mock metrics data
const mockMetricsData = {
  systemHealth: {
    cpuUsage: 45,
    memoryUsage: 35,
    uptime: 3600000,
    activeAgents: 5
  },
  agentMetrics: {
    successRate: 98.5,
    responseTime: 180,
    requestCount: 1000,
    errorCount: 15
  }
};

describe('AnalyticsChart Component', () => {
  // Setup before each test
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (useMetrics as jest.Mock).mockImplementation(() => ({
      metrics: [],
      loading: false,
      error: null,
      refreshMetrics: jest.fn()
    }));

    // Mock WebSocket
    (global as any).WebSocket = jest.fn(() => mockWebSocket);

    // Reset window dimensions
    window.innerWidth = 1024;
    window.innerHeight = 768;
  });

  it('should render chart with correct data', async () => {
    // Mock metrics data
    (useMetrics as jest.Mock).mockImplementation(() => ({
      metrics: mockMetricsData.systemHealth,
      loading: false,
      error: null,
      refreshMetrics: jest.fn()
    }));

    render(
      <Provider store={mockStore}>
        <AnalyticsChart
          metricType={MetricType.SYSTEM_HEALTH}
          title="System Health"
          chartType="line"
        />
      </Provider>
    );

    // Verify chart title
    expect(screen.getByText('System Health')).toBeInTheDocument();

    // Verify chart elements
    const chart = screen.getByTestId('analytics-chart');
    expect(chart).toBeInTheDocument();
    expect(chart.querySelector('svg')).toBeInTheDocument();
    expect(chart.querySelector('.recharts-line')).toBeInTheDocument();
  });

  it('should handle loading state correctly', () => {
    // Mock loading state
    (useMetrics as jest.Mock).mockImplementation(() => ({
      metrics: [],
      loading: true,
      error: null,
      refreshMetrics: jest.fn()
    }));

    render(
      <Provider store={mockStore}>
        <AnalyticsChart
          metricType={MetricType.SYSTEM_HEALTH}
          title="System Health"
        />
      </Provider>
    );

    // Verify loading spinner
    expect(screen.getByTestId('analytics-chart-loading')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should handle error state correctly', () => {
    const mockError = new Error('Failed to fetch metrics');
    const mockRefresh = jest.fn();

    // Mock error state
    (useMetrics as jest.Mock).mockImplementation(() => ({
      metrics: [],
      loading: false,
      error: mockError,
      refreshMetrics: mockRefresh
    }));

    render(
      <Provider store={mockStore}>
        <AnalyticsChart
          metricType={MetricType.SYSTEM_HEALTH}
          title="System Health"
        />
      </Provider>
    );

    // Verify error message
    expect(screen.getByText(/Failed to fetch metrics/i)).toBeInTheDocument();
    
    // Test retry functionality
    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('should handle real-time updates via WebSocket', async () => {
    const mockRefresh = jest.fn();
    let mockMetrics = [...mockMetricsData.systemHealth];

    // Mock metrics with WebSocket updates
    (useMetrics as jest.Mock).mockImplementation(() => ({
      metrics: mockMetrics,
      loading: false,
      error: null,
      refreshMetrics: mockRefresh
    }));

    render(
      <Provider store={mockStore}>
        <AnalyticsChart
          metricType={MetricType.SYSTEM_HEALTH}
          title="System Health"
        />
      </Provider>
    );

    // Simulate WebSocket message
    const wsMessage = {
      type: 'metrics_update',
      data: { cpuUsage: 55 }
    };

    mockWebSocket.onmessage({ data: JSON.stringify(wsMessage) });

    await waitFor(() => {
      const chart = screen.getByTestId('analytics-chart');
      expect(chart).toContainElement(screen.getByText('55%'));
    });
  });

  it('should be accessible', async () => {
    const { container } = render(
      <Provider store={mockStore}>
        <AnalyticsChart
          metricType={MetricType.SYSTEM_HEALTH}
          title="System Health"
        />
      </Provider>
    );

    // Run accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify ARIA attributes
    const chart = screen.getByRole('figure');
    expect(chart).toHaveAttribute('aria-label', 'System Health');

    // Test keyboard navigation
    const chartElement = screen.getByTestId('analytics-chart');
    chartElement.focus();
    expect(document.activeElement).toBe(chartElement);
  });

  it('should handle responsive behavior', async () => {
    render(
      <Provider store={mockStore}>
        <AnalyticsChart
          metricType={MetricType.SYSTEM_HEALTH}
          title="System Health"
        />
      </Provider>
    );

    // Test desktop view
    expect(screen.getByTestId('analytics-chart')).toHaveStyle({ width: '100%' });

    // Test tablet view
    resizeWindow(768, 1024);
    await waitFor(() => {
      expect(screen.getByTestId('analytics-chart')).toHaveStyle({ width: '100%' });
    });

    // Test mobile view
    resizeWindow(320, 568);
    await waitFor(() => {
      expect(screen.getByTestId('analytics-chart')).toHaveStyle({ width: '100%' });
    });
  });

  it('should apply correct chart configuration', () => {
    render(
      <Provider store={mockStore}>
        <AnalyticsChart
          metricType={MetricType.SYSTEM_HEALTH}
          title="System Health"
          chartType="area"
          config={{
            height: 400,
            showGrid: true,
            showLegend: true,
            strokeWidth: 2
          }}
        />
      </Provider>
    );

    const chart = screen.getByTestId('analytics-chart');
    expect(chart.querySelector('.recharts-area')).toBeInTheDocument();
    expect(chart.querySelector('.recharts-cartesian-grid')).toBeInTheDocument();
    expect(chart.querySelector('.recharts-legend')).toBeInTheDocument();
  });
});