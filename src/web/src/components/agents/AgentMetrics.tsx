import React, { useMemo, useEffect, useCallback, useRef } from 'react';
import { useMetrics } from '../../hooks/useMetrics';
import { PerformanceGraph } from '../analytics/PerformanceGraph';
import { Card } from '../common/Card';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { MetricType, AgentMetrics as AgentMetricsType, MetricThresholds } from '../../types/metrics.types';
import { Severity } from '../../types/common.types';
import { notificationService } from '../../services/notificationService';

interface AgentMetricsProps {
  agentId: string;
  timeRange: {
    start: number;
    end: number;
  };
  thresholds?: MetricThresholds;
  className?: string;
}

// Performance thresholds based on technical specifications
const DEFAULT_THRESHOLDS: MetricThresholds = {
  successRate: {
    warning: 95, // 95% minimum success rate
    critical: 90
  },
  responseTime: {
    warning: 200, // 200ms maximum response time
    critical: 500
  },
  errorRate: {
    warning: 5,
    critical: 10
  }
};

const formatMetricValue = (value: number, metricType: string): string => {
  switch (metricType) {
    case 'successRate':
    case 'errorRate':
      return `${value.toFixed(2)}%`;
    case 'responseTime':
      return `${value.toFixed(0)}ms`;
    case 'requestCount':
    case 'errorCount':
      return value.toLocaleString();
    default:
      return value.toString();
  }
};

const AgentMetrics: React.FC<AgentMetricsProps> = ({
  agentId,
  timeRange,
  thresholds = DEFAULT_THRESHOLDS,
  className = ''
}) => {
  const metricsRef = useRef<AgentMetricsType | null>(null);

  // Fetch metrics data with real-time updates
  const { metrics, agentMetrics, loading, error, isWebSocketConnected } = useMetrics({
    metricType: MetricType.AGENT_PERFORMANCE,
    startTime: timeRange.start,
    endTime: timeRange.end
  });

  // Check for threshold violations and send notifications
  const checkThresholds = useCallback((currentMetrics: AgentMetricsType) => {
    if (currentMetrics.successRate < thresholds.successRate.critical) {
      notificationService.addNotification({
        message: `Critical: Agent ${agentId} success rate below ${thresholds.successRate.critical}%`,
        severity: Severity.ERROR,
        category: 'performance'
      });
    } else if (currentMetrics.successRate < thresholds.successRate.warning) {
      notificationService.addNotification({
        message: `Warning: Agent ${agentId} success rate below ${thresholds.successRate.warning}%`,
        severity: Severity.WARNING,
        category: 'performance'
      });
    }

    if (currentMetrics.responseTime > thresholds.responseTime.critical) {
      notificationService.addNotification({
        message: `Critical: Agent ${agentId} response time above ${thresholds.responseTime.critical}ms`,
        severity: Severity.ERROR,
        category: 'performance'
      });
    }
  }, [agentId, thresholds]);

  // Monitor metrics changes for threshold violations
  useEffect(() => {
    const currentMetrics = agentMetrics[agentId];
    if (currentMetrics && (!metricsRef.current || 
        currentMetrics.successRate !== metricsRef.current.successRate ||
        currentMetrics.responseTime !== metricsRef.current.responseTime)) {
      checkThresholds(currentMetrics);
      metricsRef.current = currentMetrics;
    }
  }, [agentId, agentMetrics, checkThresholds]);

  // Memoize metric cards data
  const metricCards = useMemo(() => {
    const currentMetrics = agentMetrics[agentId];
    if (!currentMetrics) return [];

    return [
      {
        title: 'Success Rate',
        value: formatMetricValue(currentMetrics.successRate, 'successRate'),
        status: currentMetrics.successRate < thresholds.successRate.critical ? 'critical' :
               currentMetrics.successRate < thresholds.successRate.warning ? 'warning' : 'normal'
      },
      {
        title: 'Response Time',
        value: formatMetricValue(currentMetrics.responseTime, 'responseTime'),
        status: currentMetrics.responseTime > thresholds.responseTime.critical ? 'critical' :
               currentMetrics.responseTime > thresholds.responseTime.warning ? 'warning' : 'normal'
      },
      {
        title: 'Request Count',
        value: formatMetricValue(currentMetrics.requestCount, 'requestCount'),
        status: 'normal'
      },
      {
        title: 'Error Count',
        value: formatMetricValue(currentMetrics.errorCount, 'errorCount'),
        status: currentMetrics.errorCount > 0 ? 'warning' : 'normal'
      }
    ];
  }, [agentId, agentMetrics, thresholds]);

  if (loading) {
    return <LoadingSpinner size={40} />;
  }

  if (error) {
    return (
      <Card className={`agent-metrics-error ${className}`}>
        <div role="alert" className="error-message">
          Failed to load agent metrics: {error.message}
        </div>
      </Card>
    );
  }

  return (
    <div className={`agent-metrics ${className}`} role="region" aria-label="Agent Performance Metrics">
      <div className="agent-metrics__status">
        {!isWebSocketConnected && (
          <div className="connection-warning" role="alert">
            Real-time updates unavailable. Reconnecting...
          </div>
        )}
      </div>

      <div className="agent-metrics__cards">
        {metricCards.map((card, index) => (
          <Card
            key={index}
            className={`metric-card metric-card--${card.status}`}
            elevation={1}
            testId={`metric-card-${index}`}
          >
            <h3 className="metric-card__title">{card.title}</h3>
            <div className="metric-card__value">{card.value}</div>
          </Card>
        ))}
      </div>

      <Card className="agent-metrics__graph" elevation={2}>
        <PerformanceGraph
          metricType={MetricType.AGENT_PERFORMANCE}
          timeRange={timeRange}
          height={400}
          thresholds={thresholds}
        />
      </Card>
    </div>
  );
};

export default React.memo(AgentMetrics);