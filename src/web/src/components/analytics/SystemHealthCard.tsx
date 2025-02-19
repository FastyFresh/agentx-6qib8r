import React, { memo, useCallback } from 'react';
import classNames from 'classnames'; // ^2.3.2
import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';
import { useMetrics } from '../../hooks/useMetrics';
import { useTheme } from '../../hooks/useTheme';
import { METRICS_CONSTANTS } from '../../types/metrics.types';

interface SystemHealthCardProps {
  className?: string;
  testId?: string;
  showTooltips?: boolean;
  onError?: (error: Error) => void;
}

/**
 * Formats uptime duration into human-readable string
 * @param uptimeInSeconds - System uptime in seconds
 * @param locale - Locale for formatting
 */
const formatUptime = (uptimeInSeconds: number, locale: string = 'en-US'): string => {
  const days = Math.floor(uptimeInSeconds / 86400);
  const hours = Math.floor((uptimeInSeconds % 86400) / 3600);
  const minutes = Math.floor((uptimeInSeconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return new Intl.ListFormat(locale, { style: 'narrow', type: 'unit' }).format(parts);
};

/**
 * Determines resource status variant and accessibility labels
 * @param usagePercentage - Resource usage percentage
 */
const getResourceStatus = (usagePercentage: number) => {
  const { CPU_WARNING, MEMORY_WARNING } = METRICS_CONSTANTS.PERFORMANCE_THRESHOLDS;
  
  if (usagePercentage >= 90) {
    return {
      variant: 'error' as const,
      ariaLabel: `Critical usage at ${usagePercentage}%`
    };
  }
  if (usagePercentage >= 70) {
    return {
      variant: 'warning' as const,
      ariaLabel: `High usage at ${usagePercentage}%`
    };
  }
  return {
    variant: 'success' as const,
    ariaLabel: `Normal usage at ${usagePercentage}%`
  };
};

/**
 * System Health Card Component
 * Displays real-time system health metrics with Material Design 3.0 compliance
 */
const SystemHealthCard = memo<SystemHealthCardProps>(({
  className,
  testId = 'system-health-card',
  showTooltips = true,
  onError
}) => {
  const { theme, isDarkMode } = useTheme();
  const { systemHealth, loading, error } = useMetrics({
    metricType: 'system_health',
    interval: '1m'
  });

  // Handle errors if provided callback
  React.useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  // Memoized resource status calculations
  const cpuStatus = useCallback(() => getResourceStatus(systemHealth?.cpuUsage || 0), [systemHealth?.cpuUsage]);
  const memoryStatus = useCallback(() => getResourceStatus(systemHealth?.memoryUsage || 0), [systemHealth?.memoryUsage]);

  return (
    <Card
      className={classNames('system-health-card', className)}
      testId={testId}
      elevation={2}
      aria-busy={loading}
      aria-live="polite"
    >
      <div className="system-health-header">
        <h2 className="system-health-title">System Health</h2>
        {loading && (
          <span className="loading-indicator" aria-label="Loading system health data">
            Updating...
          </span>
        )}
      </div>

      <div className="system-health-metrics">
        {/* CPU Usage */}
        <div className="metric-item" role="group" aria-labelledby="cpu-label">
          <div className="metric-header">
            <span id="cpu-label" className="metric-label">CPU Usage</span>
            {showTooltips && (
              <span className="metric-tooltip" role="tooltip">
                Current CPU utilization across all cores
              </span>
            )}
          </div>
          <ProgressBar
            value={systemHealth?.cpuUsage || 0}
            variant={cpuStatus().variant}
            animated={!loading}
            showLabel
            ariaLabel={cpuStatus().ariaLabel}
          />
        </div>

        {/* Memory Usage */}
        <div className="metric-item" role="group" aria-labelledby="memory-label">
          <div className="metric-header">
            <span id="memory-label" className="metric-label">Memory Usage</span>
            {showTooltips && (
              <span className="metric-tooltip" role="tooltip">
                Current system memory utilization
              </span>
            )}
          </div>
          <ProgressBar
            value={systemHealth?.memoryUsage || 0}
            variant={memoryStatus().variant}
            animated={!loading}
            showLabel
            ariaLabel={memoryStatus().ariaLabel}
          />
        </div>

        {/* System Uptime */}
        <div className="metric-item" role="group" aria-labelledby="uptime-label">
          <span id="uptime-label" className="metric-label">Uptime</span>
          <span className="metric-value" aria-label={`System uptime: ${formatUptime(systemHealth?.uptime || 0)}`}>
            {formatUptime(systemHealth?.uptime || 0)}
          </span>
        </div>

        {/* Active Agents */}
        <div className="metric-item" role="group" aria-labelledby="agents-label">
          <span id="agents-label" className="metric-label">Active Agents</span>
          <span className="metric-value" aria-label={`${systemHealth?.activeAgents || 0} active agents`}>
            {systemHealth?.activeAgents || 0}
          </span>
        </div>
      </div>

      <style jsx>{`
        .system-health-card {
          padding: ${theme.spacing(3)};
        }

        .system-health-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: ${theme.spacing(3)};
        }

        .system-health-title {
          font-size: ${theme.typography.h6.fontSize};
          font-weight: ${theme.typography.fontWeightMedium};
          color: ${theme.palette.text.primary};
          margin: 0;
        }

        .loading-indicator {
          font-size: ${theme.typography.caption.fontSize};
          color: ${theme.palette.text.secondary};
        }

        .system-health-metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: ${theme.spacing(3)};
        }

        .metric-item {
          display: flex;
          flex-direction: column;
          gap: ${theme.spacing(1)};
        }

        .metric-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .metric-label {
          font-size: ${theme.typography.body2.fontSize};
          color: ${theme.palette.text.secondary};
        }

        .metric-value {
          font-size: ${theme.typography.h6.fontSize};
          color: ${theme.palette.text.primary};
          font-weight: ${theme.typography.fontWeightMedium};
        }

        .metric-tooltip {
          font-size: ${theme.typography.caption.fontSize};
          color: ${theme.palette.text.secondary};
          opacity: 0;
          transition: opacity ${theme.transitions.duration.shorter}ms;
        }

        .metric-item:hover .metric-tooltip {
          opacity: 1;
        }

        @media (max-width: ${theme.breakpoints.values.sm}px) {
          .system-health-metrics {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </Card>
  );
});

SystemHealthCard.displayName = 'SystemHealthCard';

export default SystemHealthCard;