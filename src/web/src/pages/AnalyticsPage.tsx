import React, { useState, useCallback, useEffect } from 'react';
import { DatePicker } from '@mui/x-date-pickers'; // ^6.9.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import MetricsCard from '../components/analytics/MetricsCard';
import AnalyticsChart from '../components/analytics/AnalyticsChart';
import PerformanceGraph from '../components/analytics/PerformanceGraph';
import SystemHealthCard from '../components/analytics/SystemHealthCard';
import { useMetrics } from '../../hooks/useMetrics';
import { useTheme } from '../../hooks/useTheme';
import { MetricType, METRICS_CONSTANTS } from '../../types/metrics.types';
import { LoadingState } from '../../types/common.types';

const DEFAULT_TIME_RANGE = {
  start: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
  end: new Date()
};

const AnalyticsPage: React.FC = React.memo(() => {
  const { theme, isDarkMode } = useTheme();
  const [timeRange, setTimeRange] = useState(DEFAULT_TIME_RANGE);

  // Fetch metrics data with the selected time range
  const { 
    metrics, 
    systemHealth, 
    agentMetrics, 
    loading, 
    error, 
    refreshMetrics,
    isWebSocketConnected 
  } = useMetrics({
    startTime: timeRange.start.getTime(),
    endTime: timeRange.end.getTime(),
    interval: '5m'
  });

  // Handle time range changes with validation
  const handleTimeRangeChange = useCallback((start: Date, end: Date) => {
    if (start >= end) {
      console.error('Invalid time range: Start date must be before end date');
      return;
    }

    const maxRange = METRICS_CONSTANTS.MAX_RETENTION_DAYS * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxRange) {
      console.error(`Time range cannot exceed ${METRICS_CONSTANTS.MAX_RETENTION_DAYS} days`);
      return;
    }

    setTimeRange({ start, end });
  }, []);

  // Handle metrics refresh with loading state
  const handleMetricsRefresh = useCallback(async () => {
    if (loading === LoadingState.LOADING) return;
    
    try {
      await refreshMetrics();
    } catch (error) {
      console.error('Failed to refresh metrics:', error);
    }
  }, [loading, refreshMetrics]);

  // Set up periodic refresh
  useEffect(() => {
    const refreshInterval = setInterval(handleMetricsRefresh, 30000); // 30 seconds
    return () => clearInterval(refreshInterval);
  }, [handleMetricsRefresh]);

  return (
    <ErrorBoundary
      fallback={
        <div role="alert" className="error-container">
          <h2>Failed to load analytics dashboard</h2>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      }
    >
      <div className="analytics-page">
        <header className="analytics-header">
          <h1>Analytics Dashboard</h1>
          <div className="time-range-selector">
            <DatePicker
              label="Start Date"
              value={timeRange.start}
              onChange={(date) => date && handleTimeRangeChange(date, timeRange.end)}
              maxDate={timeRange.end}
              slotProps={{ textField: { size: 'small' } }}
            />
            <DatePicker
              label="End Date"
              value={timeRange.end}
              onChange={(date) => date && handleTimeRangeChange(timeRange.start, date)}
              minDate={timeRange.start}
              maxDate={new Date()}
              slotProps={{ textField: { size: 'small' } }}
            />
          </div>
        </header>

        <section className="system-health-section" aria-label="System Health">
          <SystemHealthCard
            showTooltips
            onError={(error) => console.error('System health error:', error)}
          />
        </section>

        <section className="performance-metrics-section" aria-label="Performance Metrics">
          <div className="metrics-grid">
            <MetricsCard
              title="API Response Time"
              metricType={MetricType.API_RESPONSE_TIME}
              value={metrics?.apiResponseTime || 0}
              maxValue={500}
              unit="ms"
              thresholds={{
                success: METRICS_CONSTANTS.PERFORMANCE_THRESHOLDS.RESPONSE_TIME_WARNING / 2,
                warning: METRICS_CONSTANTS.PERFORMANCE_THRESHOLDS.RESPONSE_TIME_WARNING,
                error: METRICS_CONSTANTS.PERFORMANCE_THRESHOLDS.RESPONSE_TIME_WARNING * 1.5
              }}
            />
            <MetricsCard
              title="Success Rate"
              metricType={MetricType.AGENT_PERFORMANCE}
              value={metrics?.successRate || 0}
              unit="%"
              thresholds={{
                success: METRICS_CONSTANTS.PERFORMANCE_THRESHOLDS.SUCCESS_RATE_WARNING,
                warning: METRICS_CONSTANTS.PERFORMANCE_THRESHOLDS.SUCCESS_RATE_WARNING * 0.9,
                error: METRICS_CONSTANTS.PERFORMANCE_THRESHOLDS.SUCCESS_RATE_WARNING * 0.8
              }}
            />
          </div>

          <PerformanceGraph
            metricType={MetricType.SYSTEM_HEALTH}
            timeRange={{
              start: timeRange.start.getTime(),
              end: timeRange.end.getTime()
            }}
            height={400}
            thresholds={{
              warning: METRICS_CONSTANTS.PERFORMANCE_THRESHOLDS.CPU_WARNING,
              critical: METRICS_CONSTANTS.PERFORMANCE_THRESHOLDS.CPU_WARNING * 1.2
            }}
          />
        </section>

        <section className="agent-metrics-section" aria-label="Agent Metrics">
          <AnalyticsChart
            metricType={MetricType.AGENT_PERFORMANCE}
            title="Agent Performance"
            xAxisLabel="Time"
            yAxisLabel="Response Time (ms)"
            chartType="line"
            filter={{
              startTime: timeRange.start.getTime(),
              endTime: timeRange.end.getTime(),
              interval: '5m'
            }}
          />
        </section>

        {!isWebSocketConnected && (
          <div className="connection-warning" role="alert">
            <span>Real-time updates disconnected. Attempting to reconnect...</span>
          </div>
        )}

        <style jsx>{`
          .analytics-page {
            padding: ${theme.spacing(3)};
            max-width: ${theme.breakpoints.values.xl}px;
            margin: 0 auto;
          }

          .analytics-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: ${theme.spacing(4)};
          }

          .time-range-selector {
            display: flex;
            gap: ${theme.spacing(2)};
          }

          .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: ${theme.spacing(3)};
            margin-bottom: ${theme.spacing(4)};
          }

          section {
            margin-bottom: ${theme.spacing(4)};
          }

          .connection-warning {
            position: fixed;
            bottom: ${theme.spacing(2)};
            right: ${theme.spacing(2)};
            padding: ${theme.spacing(2)};
            background-color: ${theme.palette.warning.main};
            color: ${theme.palette.warning.contrastText};
            border-radius: ${theme.shape.borderRadius}px;
            box-shadow: ${theme.shadows[2]};
          }

          @media (max-width: ${theme.breakpoints.values.sm}px) {
            .analytics-header {
              flex-direction: column;
              gap: ${theme.spacing(2)};
            }

            .time-range-selector {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </ErrorBoundary>
  );
});

AnalyticsPage.displayName = 'AnalyticsPage';

export default AnalyticsPage;