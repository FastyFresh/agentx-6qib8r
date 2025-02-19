import React from 'react'; // ^18.2.0
import classNames from 'classnames'; // ^2.3.2
import Card from '../common/Card';
import LoadingSpinner from '../common/LoadingSpinner';
import { MetricValue } from '../../types/metrics.types';
import { useTheme } from '../../hooks/useTheme';
import styles from './DashboardCard.module.css';

interface DashboardCardProps {
  /**
   * Card title text
   */
  title: string;

  /**
   * Metric data to display with unit support
   */
  metric: MetricValue;

  /**
   * Loading state indicator
   */
  loading?: boolean;

  /**
   * Optional CSS class name
   */
  className?: string;

  /**
   * Optional icon element
   */
  icon?: React.ReactNode;

  /**
   * Card theme variant following Material Design 3.0
   * @default 'default'
   */
  themeVariant?: 'default' | 'outlined' | 'elevated';

  /**
   * Optional click handler for metric interaction
   */
  onMetricClick?: () => void;

  /**
   * Custom accessibility label
   */
  accessibilityLabel?: string;
}

/**
 * A specialized card component for displaying metric data on the dashboard.
 * Implements Material Design 3.0 specifications with enhanced accessibility.
 */
const DashboardCard: React.FC<DashboardCardProps> = React.memo(({
  title,
  metric,
  loading = false,
  className,
  icon,
  themeVariant = 'default',
  onMetricClick,
  accessibilityLabel
}) => {
  const { theme, isDarkMode, prefersReducedMotion, isRTL } = useTheme();

  // Format metric value with proper unit display
  const formatMetricValue = (metric: MetricValue): string => {
    const { value, unit } = metric;
    if (typeof value !== 'number' || !isFinite(value)) {
      return 'N/A';
    }
    return unit ? `${value} ${unit}` : value.toString();
  };

  // Memoized click handler
  const handleClick = React.useCallback(() => {
    if (!loading && onMetricClick) {
      onMetricClick();
    }
  }, [loading, onMetricClick]);

  // Compute card elevation based on variant and interaction state
  const getElevation = (): number => {
    if (themeVariant === 'elevated') {
      return isDarkMode ? 2 : 1;
    }
    return 0;
  };

  // Compose class names with proper theme and state variations
  const cardClasses = classNames(
    styles.dashboardCard,
    {
      [styles.loading]: loading,
      [styles.clickable]: !!onMetricClick,
      [styles.elevated]: themeVariant === 'elevated',
      [styles.outlined]: themeVariant === 'outlined',
      [styles.darkMode]: isDarkMode,
      [styles.rtl]: isRTL
    },
    className
  );

  return (
    <Card
      className={cardClasses}
      elevation={getElevation()}
      variant={themeVariant}
      onClick={handleClick}
      focusable={!!onMetricClick}
      testId="dashboard-card"
      aria-label={accessibilityLabel || `${title} metric card`}
      aria-busy={loading}
    >
      <div className={styles.cardHeader}>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        <h3 className={styles.title}>{title}</h3>
      </div>

      <div className={styles.cardContent}>
        {loading ? (
          <LoadingSpinner
            size="24px"
            color={theme.palette.primary.main}
            className={styles.spinner}
            ariaLabel="Loading metric data"
          />
        ) : (
          <div
            className={styles.metricValue}
            role="text"
            aria-label={`${title} value: ${formatMetricValue(metric)}`}
          >
            {formatMetricValue(metric)}
          </div>
        )}
      </div>
    </Card>
  );
});

// Display name for debugging
DashboardCard.displayName = 'DashboardCard';

export default DashboardCard;