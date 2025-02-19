import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import throttle from 'lodash/throttle';
import { useMetrics } from '../../hooks/useMetrics';
import { MetricType } from '../../types/metrics.types';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorBoundary from '../common/ErrorBoundary';

interface PerformanceGraphProps {
  metricType: MetricType;
  timeRange: { start: number; end: number };
  height?: number;
  className?: string;
  thresholds?: { warning: number; critical: number };
  refreshInterval?: number;
}

const DEFAULT_HEIGHT = 400;
const DATA_POINT_THRESHOLD = 1000;
const DEFAULT_REFRESH_INTERVAL = 30000;

const PerformanceGraph: React.FC<PerformanceGraphProps> = ({
  metricType,
  timeRange,
  height = DEFAULT_HEIGHT,
  className = '',
  thresholds,
  refreshInterval = DEFAULT_REFRESH_INTERVAL
}) => {
  const [localTimeRange, setLocalTimeRange] = useState(timeRange);

  // Fetch metrics data using the metrics hook
  const { metrics, loading, error } = useMetrics({
    metricType,
    startTime: localTimeRange.start,
    endTime: localTimeRange.end
  }, { interval: refreshInterval });

  // Throttle data points for performance
  const throttleData = useCallback((data: any[]) => {
    if (data.length <= DATA_POINT_THRESHOLD) return data;
    
    const interval = Math.ceil(data.length / DATA_POINT_THRESHOLD);
    return data.filter((_, index) => index % interval === 0);
  }, []);

  // Format tooltip values based on metric type
  const formatTooltip = useCallback((value: number) => {
    switch (metricType) {
      case MetricType.SYSTEM_HEALTH:
        return `${value.toFixed(1)}%`;
      case MetricType.API_RESPONSE:
        return `${value.toFixed(0)}ms`;
      default:
        return value.toLocaleString();
    }
  }, [metricType]);

  // Format X-axis timestamps
  const formatXAxis = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    const timeDiff = timeRange.end - timeRange.start;
    
    if (timeDiff <= 86400000) { // 24 hours
      return date.toLocaleTimeString();
    }
    return date.toLocaleDateString();
  }, [timeRange]);

  // Memoize processed data
  const processedData = useMemo(() => {
    if (!metrics?.length) return [];
    return throttleData(metrics);
  }, [metrics, throttleData]);

  // Update local time range when prop changes
  useEffect(() => {
    setLocalTimeRange(timeRange);
  }, [timeRange]);

  if (loading) {
    return <LoadingSpinner size={40} />;
  }

  if (error) {
    return (
      <div role="alert" className="error-message">
        Failed to load metrics: {error.message}
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div 
        className={`performance-graph ${className}`}
        style={{ height }}
        role="region"
        aria-label={`Performance metrics for ${metricType}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <Line
            data={processedData}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatXAxis}
              type="number"
              domain={[localTimeRange.start, localTimeRange.end]}
              scale="time"
            />
            <YAxis
              tickFormatter={formatTooltip}
              domain={['auto', 'auto']}
            />
            <Tooltip
              formatter={formatTooltip}
              labelFormatter={formatXAxis}
              contentStyle={{
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-outline)',
                borderRadius: 'var(--border-radius-sm)'
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-primary)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={!window.matchMedia('(prefers-reduced-motion: reduce)').matches}
            />
            {thresholds?.warning && (
              <Line
                type="monotone"
                dataKey={() => thresholds.warning}
                stroke="var(--color-warning)"
                strokeDasharray="5 5"
                strokeWidth={1}
                dot={false}
              />
            )}
            {thresholds?.critical && (
              <Line
                type="monotone"
                dataKey={() => thresholds.critical}
                stroke="var(--color-error)"
                strokeDasharray="5 5"
                strokeWidth={1}
                dot={false}
              />
            )}
          </Line>
        </ResponsiveContainer>
      </div>
    </ErrorBoundary>
  );
};

export default React.memo(PerformanceGraph);