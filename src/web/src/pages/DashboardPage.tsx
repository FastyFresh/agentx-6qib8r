import React, { useEffect, useCallback } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import DashboardGrid from '../components/dashboard/DashboardGrid';
import ErrorBoundary from '../components/common/ErrorBoundary';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { useAgent } from '../hooks/useAgent';
import { useMetrics } from '../hooks/useMetrics';
import styles from './DashboardPage.module.css';

/**
 * Main dashboard page component implementing Material Design 3.0 specifications
 * Displays system metrics, agent status, and quick actions in a responsive grid layout
 */
const DashboardPage: React.FC = React.memo(() => {
  // Initialize hooks for data management
  const { 
    agents, 
    loading: agentsLoading, 
    error: agentsError,
    fetchAgents 
  } = useAgent();

  const { 
    metrics,
    systemHealth,
    refreshMetrics,
    loading: metricsLoading,
    error: metricsError,
    isWebSocketConnected
  } = useMetrics({
    metricType: 'system_health',
    startTime: Date.now() - 3600000, // Last hour
    endTime: Date.now(),
    interval: '1m'
  });

  // Initial data fetch
  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        await Promise.all([
          fetchAgents(),
          refreshMetrics()
        ]);
      } catch (error) {
        console.error('Failed to initialize dashboard:', error);
      }
    };

    initializeDashboard();
  }, [fetchAgents, refreshMetrics]);

  // Error handler for child components
  const handleError = useCallback((error: Error) => {
    console.error('Dashboard component error:', error);
    // Additional error handling logic can be implemented here
  }, []);

  // Loading state handler
  if (agentsLoading && metricsLoading && !agents.length) {
    return (
      <DashboardLayout>
        <div className={styles.loadingContainer}>
          <LoadingSpinner 
            size="48px"
            ariaLabel="Loading dashboard data"
          />
          <p>Loading dashboard...</p>
        </div>
      </DashboardLayout>
    );
  }

  // Error state handler
  if ((agentsError || metricsError) && !agents.length) {
    return (
      <DashboardLayout>
        <div className={styles.errorContainer} role="alert">
          <h2>Dashboard Error</h2>
          <p>{agentsError?.message || metricsError?.message || 'Failed to load dashboard data'}</p>
          <button 
            onClick={() => {
              fetchAgents();
              refreshMetrics();
            }}
            className={styles.retryButton}
          >
            Retry
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <ErrorBoundary
        onError={handleError}
        fallback={
          <div className={styles.errorContainer} role="alert">
            <h2>Dashboard Error</h2>
            <p>There was an error loading the dashboard. Please try refreshing the page.</p>
          </div>
        }
      >
        <div className={styles.dashboardPage}>
          <DashboardGrid
            className={styles.dashboardGrid}
            testId="main-dashboard-grid"
          />
          {!isWebSocketConnected && (
            <div className={styles.websocketWarning} role="alert">
              <span className="material-icons">warning</span>
              <p>Real-time updates unavailable. Reconnecting...</p>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
});

// Display name for debugging
DashboardPage.displayName = 'DashboardPage';

export default DashboardPage;

// CSS Module definition
const styles = {
  dashboardPage: `
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    min-height: 100vh;
    width: 100%;
    max-width: var(--breakpoint-desktop);
    margin: 0 auto;
  `,
  dashboardGrid: `
    flex: 1;
  `,
  loadingContainer: `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    gap: var(--spacing-md);
    color: var(--color-text-secondary);
  `,
  errorContainer: `
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    gap: var(--spacing-md);
    color: var(--color-error);
    text-align: center;
    padding: var(--spacing-lg);
  `,
  retryButton: `
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--color-primary);
    color: var(--color-surface);
    border: none;
    border-radius: var(--border-radius-md);
    cursor: pointer;
    font-weight: var(--font-weight-medium);
    transition: background-color var(--transition-normal);

    &:hover {
      background-color: var(--color-primary-dark);
    }
  `,
  websocketWarning: `
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--color-warning);
    color: var(--color-surface);
    border-radius: var(--border-radius-md);
    position: fixed;
    bottom: var(--spacing-md);
    right: var(--spacing-md);
    z-index: var(--z-index-tooltip);
    box-shadow: var(--shadow-md);
  `
} as const;