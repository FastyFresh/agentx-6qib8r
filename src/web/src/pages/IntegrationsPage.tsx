import React, { useState, useEffect, useCallback } from 'react'; // ^18.2.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.11

import PageHeader from '../components/common/PageHeader';
import IntegrationList from '../components/integrations/IntegrationList';
import IntegrationForm from '../components/integrations/IntegrationForm';
import { useIntegration } from '../hooks/useIntegration';
import useWebSocket from '../hooks/useWebSocket';
import useNotification from '../hooks/useNotification';
import { Integration } from '../types/integration.types';
import { Severity } from '../types/common.types';

/**
 * Main page component for managing external service integrations
 * Implements real-time status monitoring and comprehensive error handling
 */
const IntegrationsPage: React.FC = () => {
  // State management
  const [showForm, setShowForm] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  // Custom hooks
  const {
    integrations,
    loading,
    error,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    monitorHealth,
    trackPerformance
  } = useIntegration();

  const { showNotification } = useNotification();

  // WebSocket setup for real-time updates
  const { subscribe, disconnect } = useWebSocket(
    `${process.env.VITE_API_WS_URL}/integrations`,
    {
      autoConnect: true,
      reconnectAttempts: 3,
      heartbeatInterval: 30000
    }
  );

  // Subscribe to integration status updates
  useEffect(() => {
    const unsubscribe = subscribe('integration.status', (data) => {
      const { integrationId, status, error } = data;
      if (error) {
        showNotification(
          `Integration ${integrationId} error: ${error}`,
          Severity.ERROR
        );
      }
    });

    return () => {
      unsubscribe();
      disconnect();
    };
  }, [subscribe, disconnect, showNotification]);

  /**
   * Handles showing the integration creation form
   */
  const handleAddIntegration = useCallback(() => {
    setSelectedIntegration(null);
    setShowForm(true);
    trackPerformance('showIntegrationForm', performance.now());
  }, [trackPerformance]);

  /**
   * Handles showing the integration edit form
   */
  const handleEditIntegration = useCallback((id: string) => {
    const integration = integrations.find(i => i.id === id);
    if (integration) {
      setSelectedIntegration(integration);
      setShowForm(true);
      trackPerformance('showEditForm', performance.now());
    }
  }, [integrations, trackPerformance]);

  /**
   * Handles integration form submission with validation
   */
  const handleFormSubmit = useCallback(async (data: Integration) => {
    const startTime = performance.now();
    try {
      if (selectedIntegration) {
        await updateIntegration(selectedIntegration.id, data);
        showNotification('Integration updated successfully', Severity.SUCCESS);
      } else {
        await createIntegration(data);
        showNotification('Integration created successfully', Severity.SUCCESS);
      }
      setShowForm(false);
      setSelectedIntegration(null);
      trackPerformance('integrationFormSubmit', startTime);
    } catch (error) {
      showNotification(
        `Failed to ${selectedIntegration ? 'update' : 'create'} integration: ${error.message}`,
        Severity.ERROR
      );
      throw error;
    }
  }, [selectedIntegration, createIntegration, updateIntegration, showNotification, trackPerformance]);

  /**
   * Handles integration deletion with confirmation
   */
  const handleDelete = useCallback(async (id: string) => {
    const startTime = performance.now();
    try {
      await deleteIntegration(id);
      showNotification('Integration deleted successfully', Severity.SUCCESS);
      trackPerformance('deleteIntegration', startTime);
    } catch (error) {
      showNotification(
        `Failed to delete integration: ${error.message}`,
        Severity.ERROR
      );
      throw error;
    }
  }, [deleteIntegration, showNotification, trackPerformance]);

  return (
    <ErrorBoundary
      fallback={
        <div role="alert" className="error-container">
          <h2>Error Loading Integrations</h2>
          <p>An unexpected error occurred. Please try again later.</p>
        </div>
      }
    >
      <div className="integrations-page">
        <PageHeader
          title="Integrations"
          subtitle="Manage your external service connections"
          actions={[
            {
              label: 'Add Integration',
              onClick: handleAddIntegration,
              variant: 'primary'
            }
          ]}
        />

        <main className="integrations-content">
          {showForm ? (
            <IntegrationForm
              initialData={selectedIntegration}
              onSubmit={handleFormSubmit}
              onCancel={() => setShowForm(false)}
              healthCheckConfig={{
                interval: 30000,
                enabled: true
              }}
            />
          ) : (
            <IntegrationList
              onEdit={handleEditIntegration}
              onDelete={handleDelete}
              gridGap={16}
              itemsPerRow={3}
              enableVirtualization={true}
            />
          )}
        </main>
      </div>

      <style jsx>{`
        .integrations-page {
          padding: 24px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .integrations-content {
          flex: 1;
          margin-top: 24px;
          min-height: 0;
        }

        .error-container {
          padding: 24px;
          text-align: center;
          color: var(--color-error);
        }

        @media (max-width: 768px) {
          .integrations-page {
            padding: 16px;
          }

          .integrations-content {
            margin-top: 16px;
          }
        }
      `}</style>
    </ErrorBoundary>
  );
};

export default IntegrationsPage;