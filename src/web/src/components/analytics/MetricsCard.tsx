import React, { memo, useMemo, useEffect, useState, useCallback } from 'react';
import classNames from 'classnames'; // ^2.3.2
import debounce from 'lodash/debounce'; // ^4.0.8
import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';
import { MetricType } from '../../types/metrics.types';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useTheme } from '../../hooks/useTheme';

interface MetricsCardProps {
  title: string;
  metricType: MetricType;
  value: number;
  maxValue?: number;
  unit?: string;
  variant?: 'success' | 'warning' | 'error';
  className?: string;
  refreshInterval?: number;
  formatter?: (value: number) => string;
  onError?: (error: Error) => void;
  isLoading?: boolean;
  animationDuration?: number;
  thresholds?: {
    success: number;
    warning: number;
    error: number;
  };
}

const DEFAULT_THRESHOLDS = {
  success: 60,
  warning: 80,
  error: 90
};

const DEFAULT_ANIMATION_DURATION = 300;
const DEFAULT_REFRESH_INTERVAL = 5000;

const MetricsCard: React.FC<MetricsCardProps> = memo(({
  title,
  metricType,
  value,
  maxValue = 100,
  unit = '%',
  variant,
  className,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
  formatter,
  onError,
  isLoading = false,
  animationDuration = DEFAULT_ANIMATION_DURATION,
  thresholds = DEFAULT_THRESHOLDS
}) => {
  const { theme, isDarkMode } = useTheme();
  const [currentValue, setCurrentValue] = useState<number>(value);
  
  // WebSocket connection for real-time updates
  const { connectionState, subscribe, lastError } = useWebSocket(
    `${process.env.VITE_API_WS_URL}/metrics`,
    {
      autoConnect: true,
      reconnectAttempts: 3,
      heartbeatInterval: refreshInterval
    }
  );

  // Memoized variant color calculation
  const getVariantColor = useMemo(() => {
    if (variant) return variant;
    
    const percentage = (currentValue / maxValue) * 100;
    if (percentage <= thresholds.success) return 'success';
    if (percentage <= thresholds.warning) return 'warning';
    return 'error';
  }, [currentValue, maxValue, variant, thresholds]);

  // Memoized value formatting
  const formattedValue = useMemo(() => {
    if (formatter) return formatter(currentValue);
    
    const roundedValue = Math.round(currentValue * 100) / 100;
    return `${roundedValue}${unit}`;
  }, [currentValue, unit, formatter]);

  // Debounced value update to prevent rapid re-renders
  const updateValue = useCallback(
    debounce((newValue: number) => {
      setCurrentValue(newValue);
    }, animationDuration),
    [animationDuration]
  );

  // WebSocket subscription for real-time updates
  useEffect(() => {
    const unsubscribe = subscribe(metricType, (data) => {
      updateValue(data.value);
    });

    return () => {
      unsubscribe();
      updateValue.cancel();
    };
  }, [metricType, subscribe, updateValue]);

  // Error handling
  useEffect(() => {
    if (lastError && onError) {
      onError(lastError);
    }
  }, [lastError, onError]);

  // Update value when prop changes
  useEffect(() => {
    updateValue(value);
  }, [value, updateValue]);

  return (
    <Card
      className={classNames('metrics-card', className)}
      variant="elevated"
      elevation={2}
      testId={`metrics-card-${metricType}`}
    >
      <div
        className="metrics-card__content"
        style={{
          padding: theme.spacing(2),
          color: theme.palette.text.primary
        }}
      >
        <div
          className="metrics-card__header"
          style={{
            marginBottom: theme.spacing(2),
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: theme.typography.h6.fontSize,
              fontWeight: theme.typography.fontWeightMedium
            }}
          >
            {title}
          </h3>
          <span
            className={`metrics-card__value metrics-card__value--${getVariantColor}`}
            style={{
              color: theme.palette[getVariantColor].main,
              fontSize: theme.typography.h5.fontSize,
              fontWeight: theme.typography.fontWeightBold,
              transition: theme.transitions.create(['color'])
            }}
            role="status"
            aria-live="polite"
          >
            {formattedValue}
          </span>
        </div>

        <ProgressBar
          value={currentValue}
          maxValue={maxValue}
          variant={getVariantColor}
          animated={!isLoading}
          indeterminate={isLoading}
          showLabel={false}
          ariaLabel={`${title} metric`}
          ariaValuetext={formattedValue}
        />

        {connectionState === 'ERROR' && (
          <div
            className="metrics-card__error"
            style={{
              color: theme.palette.error.main,
              fontSize: theme.typography.caption.fontSize,
              marginTop: theme.spacing(1)
            }}
            role="alert"
          >
            Connection lost. Attempting to reconnect...
          </div>
        )}
      </div>
    </Card>
  );
});

MetricsCard.displayName = 'MetricsCard';

export default MetricsCard;