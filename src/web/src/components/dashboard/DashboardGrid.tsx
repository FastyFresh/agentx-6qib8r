import React, { useCallback, useEffect } from 'react';
import classNames from 'classnames'; // ^2.3.2
import DashboardCard from './DashboardCard';
import QuickActions from './QuickActions';
import RecentActivity from './RecentActivity';
import SystemHealthCard from '../analytics/SystemHealthCard';
import ErrorBoundary from '../common/ErrorBoundary';
import { useTheme } from '../../hooks/useTheme';
import styles from './DashboardGrid.module.css';

interface DashboardGridProps {
  /**
   * Optional CSS class name for custom styling
   */
  className?: string;

  /**
   * Current theme configuration for styling
   */
  theme?: 'light' | 'dark' | 'system';

  /**
   * Flag to enable/disable error boundary wrapping
   * @default true
   */
  errorBoundary?: boolean;

  /**
   * Test ID for component testing
   */
  testId?: string;
}

/**
 * DashboardGrid Component
 * Implements a responsive grid layout for the main dashboard following Material Design 3.0
 */
const DashboardGrid: React.FC<DashboardGridProps> = React.memo(({
  className,
  theme = 'system',
  errorBoundary = true,
  testId = 'dashboard-grid'
}) => {
  const { theme: themeContext, isDarkMode } = useTheme();

  // Handle grid resize for responsive layout
  const handleResize = useCallback(() => {
    // Add any specific resize handling logic here
    // This is a placeholder for potential future optimizations
  }, []);

  // Set up resize observer
  useEffect(() => {
    const resizeObserver = new ResizeObserver(handleResize);
    const gridElement = document.getElementById(testId);
    
    if (gridElement) {
      resizeObserver.observe(gridElement);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleResize, testId]);

  // Error handler for child components
  const handleError = useCallback((error: Error) => {
    console.error('Dashboard component error:', error);
    // Additional error handling logic can be added here
  }, []);

  const gridContent = (
    <div
      id={testId}
      className={classNames(
        styles.dashboardGrid,
        {
          [styles.darkMode]: isDarkMode,
          [styles.lightMode]: !isDarkMode
        },
        className
      )}
      role="main"
      aria-label="Dashboard"
    >
      {/* Quick Actions Section */}
      <section 
        className={styles.quickActionsSection}
        role="region"
        aria-label="Quick actions"
      >
        <QuickActions
          className={styles.quickActions}
          theme={theme}
          testId={`${testId}-quick-actions`}
        />
      </section>

      {/* System Health Section */}
      <section 
        className={styles.systemHealthSection}
        role="region"
        aria-label="System health"
      >
        <SystemHealthCard
          className={styles.systemHealth}
          testId={`${testId}-system-health`}
          showTooltips
          onError={handleError}
        />
      </section>

      {/* Recent Activity Section */}
      <section 
        className={styles.recentActivitySection}
        role="region"
        aria-label="Recent activity"
      >
        <RecentActivity
          maxItems={5}
          className={styles.recentActivity}
          refreshInterval={30000}
          onError={handleError}
          testId={`${testId}-recent-activity`}
        />
      </section>
    </div>
  );

  // Wrap with error boundary if enabled
  if (errorBoundary) {
    return (
      <ErrorBoundary
        onError={handleError}
        testId={`${testId}-error-boundary`}
        fallback={
          <div className={styles.errorFallback} role="alert">
            <h2>Dashboard Error</h2>
            <p>There was an error loading the dashboard. Please try refreshing the page.</p>
          </div>
        }
      >
        {gridContent}
      </ErrorBoundary>
    );
  }

  return gridContent;
});

// Display name for debugging
DashboardGrid.displayName = 'DashboardGrid';

export default DashboardGrid;

// CSS Module definition
const styles = {
  dashboardGrid: `
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-gap: var(--spacing-md);
    padding: var(--spacing-md);
    width: 100%;
    max-width: var(--breakpoint-desktop);
    margin: 0 auto;
    min-height: 100vh;

    @media (max-width: 1024px) {
      grid-template-columns: repeat(8, 1fr);
    }

    @media (max-width: 768px) {
      grid-template-columns: repeat(4, 1fr);
      grid-gap: var(--spacing-sm);
      padding: var(--spacing-sm);
    }
  `,
  quickActionsSection: `
    grid-column: span 12;
    
    @media (max-width: 768px) {
      grid-column: span 4;
    }
  `,
  systemHealthSection: `
    grid-column: span 6;
    
    @media (max-width: 1024px) {
      grid-column: span 8;
    }
    
    @media (max-width: 768px) {
      grid-column: span 4;
    }
  `,
  recentActivitySection: `
    grid-column: span 6;
    
    @media (max-width: 1024px) {
      grid-column: span 8;
    }
    
    @media (max-width: 768px) {
      grid-column: span 4;
    }
  `,
  darkMode: `
    background-color: var(--color-background);
    color: var(--color-text-primary);
  `,
  lightMode: `
    background-color: var(--color-surface);
    color: var(--color-text-primary);
  `,
  errorFallback: `
    padding: var(--spacing-lg);
    text-align: center;
    color: var(--color-error);
  `,
  quickActions: `
    height: 100%;
  `,
  systemHealth: `
    height: 100%;
  `,
  recentActivity: `
    height: 100%;
  `
} as const;