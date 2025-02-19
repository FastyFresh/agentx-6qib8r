import React, { useEffect, useCallback, useMemo } from 'react';
import classNames from 'classnames'; // ^2.3.2
import { useVirtualizer } from '@tanstack/react-virtual'; // ^3.0.0

import IntegrationCard from './IntegrationCard';
import LoadingSpinner from '../common/LoadingSpinner';
import ErrorBoundary from '../common/ErrorBoundary';
import { useIntegration } from '../../hooks/useIntegration';
import { Integration } from '../../types/integration.types';

/**
 * Props for the IntegrationList component
 */
interface IntegrationListProps {
  /** Optional CSS class name */
  className?: string;
  /** Callback for edit action */
  onEdit: (id: string) => void;
  /** Grid gap in pixels */
  gridGap?: number;
  /** Number of items per row */
  itemsPerRow?: number;
  /** Enable virtualization for large lists */
  enableVirtualization?: boolean;
}

/**
 * Displays a responsive grid of integration cards with real-time updates
 * and virtualization support for optimal performance
 */
const IntegrationList: React.FC<IntegrationListProps> = ({
  className = '',
  onEdit,
  gridGap = 16,
  itemsPerRow = 3,
  enableVirtualization = true
}) => {
  // Integration state management
  const {
    integrations,
    loading,
    error,
    deleteIntegration,
    monitorHealth,
    trackPerformance
  } = useIntegration();

  // Container ref for virtualization
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Setup virtualization if enabled
  const rowVirtualizer = useVirtualizer({
    count: Math.ceil(integrations.length / itemsPerRow),
    getScrollElement: () => containerRef.current,
    estimateSize: useCallback(() => 200, []), // Estimated row height
    overscan: 2
  });

  // Calculate responsive grid layout
  const gridStyle = useMemo(() => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)`,
    gap: `${gridGap}px`,
    padding: `${gridGap}px`,
    width: '100%'
  }), [itemsPerRow, gridGap]);

  // Setup health monitoring for integrations
  useEffect(() => {
    const healthCheckInterval = setInterval(() => {
      integrations.forEach(integration => {
        monitorHealth(integration.id).catch(console.error);
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(healthCheckInterval);
  }, [integrations, monitorHealth]);

  /**
   * Handles integration deletion with confirmation
   */
  const handleDelete = useCallback(async (id: string) => {
    const startTime = performance.now();
    try {
      const confirmed = window.confirm('Are you sure you want to delete this integration?');
      if (!confirmed) return;

      await deleteIntegration(id);
      trackPerformance('deleteIntegration', startTime);
    } catch (err) {
      console.error('Error deleting integration:', err);
      throw err;
    }
  }, [deleteIntegration, trackPerformance]);

  /**
   * Renders integration cards with virtualization support
   */
  const renderIntegrations = () => {
    if (enableVirtualization) {
      return rowVirtualizer.getVirtualItems().map(virtualRow => {
        const startIndex = virtualRow.index * itemsPerRow;
        const rowIntegrations = integrations.slice(startIndex, startIndex + itemsPerRow);

        return (
          <div
            key={virtualRow.key}
            style={{
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
              display: 'grid',
              gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)`,
              gap: `${gridGap}px`
            }}
          >
            {rowIntegrations.map(integration => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onEdit={() => onEdit(integration.id)}
                onDelete={() => handleDelete(integration.id)}
              />
            ))}
          </div>
        );
      });
    }

    return integrations.map(integration => (
      <IntegrationCard
        key={integration.id}
        integration={integration}
        onEdit={() => onEdit(integration.id)}
        onDelete={() => handleDelete(integration.id)}
      />
    ));
  };

  if (loading) {
    return (
      <div className={classNames('integration-list__loading', className)}>
        <LoadingSpinner size={48} ariaLabel="Loading integrations" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={classNames('integration-list__error', className)}
        role="alert"
        aria-live="polite"
      >
        <p>Error loading integrations: {error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="integration-list__retry-button"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div
        ref={containerRef}
        className={classNames('integration-list', className)}
        style={gridStyle}
        role="grid"
        aria-label="Integration list"
      >
        {integrations.length === 0 ? (
          <div
            className="integration-list__empty"
            role="status"
            aria-live="polite"
          >
            <p>No integrations found</p>
          </div>
        ) : (
          renderIntegrations()
        )}
      </div>
    </ErrorBoundary>
  );
};

// Default props
IntegrationList.defaultProps = {
  className: '',
  gridGap: 16,
  itemsPerRow: 3,
  enableVirtualization: true
};

export default IntegrationList;