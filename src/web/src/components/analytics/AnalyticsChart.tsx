import React, { useMemo, useCallback, useEffect, useRef } from 'react'; // ^18.2.0
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'; // ^2.7.2
import { useMetrics } from '../../hooks/useMetrics';
import { MetricType } from '../../types/metrics.types';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { ErrorBoundary } from '../common/ErrorBoundary';

// Chart type definitions
export type ChartType = 'line' | 'bar' | 'area';

// Chart configuration interface
interface ChartConfig {
  height?: number;
  animate?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  strokeWidth?: number;
  tooltipFormatter?: (value: number) => string;
  xAxisFormatter?: (value: string) => string;
  yAxisFormatter?: (value: number) => string;
}

// Chart component props
interface AnalyticsChartProps {
  metricType: MetricType;
  title: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  chartType?: ChartType;
  filter?: {
    startTime?: number;
    endTime?: number;
    interval?: string;
  };
  config?: ChartConfig;
  className?: string;
  testId?: string;
}

// Chart colors based on theme
const CHART_COLORS = {
  primary: '#2196F3',
  secondary: '#64B5F6',
  success: '#66BB6A',
  warning: '#FFB74D',
  error: '#EF5350',
  background: '#FFFFFF',
  text: '#333333'
} as const;

// Default chart configuration
const DEFAULT_CONFIG: ChartConfig = {
  height: 300,
  animate: true,
  showGrid: true,
  showLegend: true,
  strokeWidth: 2,
  tooltipFormatter: (value: number) => value.toFixed(2),
  xAxisFormatter: (value: string) => new Date(value).toLocaleTimeString(),
  yAxisFormatter: (value: number) => value.toFixed(1)
};

/**
 * AnalyticsChart component for rendering interactive metrics visualizations
 * Supports multiple chart types with real-time updates and accessibility features
 */
export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({
  metricType,
  title,
  xAxisLabel = 'Time',
  yAxisLabel = 'Value',
  chartType = 'line',
  filter = {},
  config = {},
  className = '',
  testId = 'analytics-chart'
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const { metrics, loading, error, refreshMetrics } = useMetrics(filter);

  // Format chart data with memoization
  const formattedData = useMemo(() => {
    if (!metrics?.length) return [];
    return metrics.map(metric => ({
      timestamp: mergedConfig.xAxisFormatter?.(metric.timestamp.toString()) || metric.timestamp,
      value: metric.value,
      category: metric.category
    }));
  }, [metrics, mergedConfig.xAxisFormatter]);

  // Handle chart resize with debouncing
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current) {
        chartRef.current.style.width = '100%';
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Render appropriate chart type
  const renderChart = useCallback(() => {
    const commonProps = {
      data: formattedData,
      margin: { top: 10, right: 30, left: 0, bottom: 0 }
    };

    const ChartComponent = {
      line: LineChart,
      bar: BarChart,
      area: AreaChart
    }[chartType];

    const DataComponent = {
      line: Line,
      bar: Bar,
      area: Area
    }[chartType];

    return (
      <ResponsiveContainer width="100%" height={mergedConfig.height}>
        <ChartComponent {...commonProps}>
          {mergedConfig.showGrid && (
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.secondary} />
          )}
          <XAxis
            dataKey="timestamp"
            label={{ value: xAxisLabel, position: 'bottom' }}
            tick={{ fill: CHART_COLORS.text }}
          />
          <YAxis
            label={{ value: yAxisLabel, angle: -90, position: 'left' }}
            tick={{ fill: CHART_COLORS.text }}
            tickFormatter={mergedConfig.yAxisFormatter}
          />
          <Tooltip
            formatter={mergedConfig.tooltipFormatter}
            contentStyle={{ background: CHART_COLORS.background }}
          />
          {mergedConfig.showLegend && <Legend />}
          <DataComponent
            type="monotone"
            dataKey="value"
            stroke={CHART_COLORS.primary}
            fill={CHART_COLORS.primary}
            strokeWidth={mergedConfig.strokeWidth}
            isAnimationActive={mergedConfig.animate}
          />
        </ChartComponent>
      </ResponsiveContainer>
    );
  }, [chartType, formattedData, mergedConfig, xAxisLabel, yAxisLabel]);

  // Handle error state
  if (error) {
    return (
      <div className={`analytics-chart-error ${className}`} data-testid={`${testId}-error`}>
        <p>Failed to load chart data: {error.message}</p>
        <button onClick={refreshMetrics}>Retry</button>
      </div>
    );
  }

  // Handle loading state
  if (loading) {
    return (
      <div className={`analytics-chart-loading ${className}`} data-testid={`${testId}-loading`}>
        <LoadingSpinner size={40} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div
        ref={chartRef}
        className={`analytics-chart ${className}`}
        data-testid={testId}
        role="figure"
        aria-label={title}
      >
        <h3 className="analytics-chart-title">{title}</h3>
        {renderChart()}
      </div>
    </ErrorBoundary>
  );
};

// Memoize component to prevent unnecessary re-renders
export default React.memo(AnalyticsChart);