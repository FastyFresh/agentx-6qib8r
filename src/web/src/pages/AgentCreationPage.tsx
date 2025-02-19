import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { debounce } from 'lodash';
import { analytics } from '@segment/analytics-next';

import Layout from '../components/layout/Layout';
import PageHeader from '../components/common/PageHeader';
import AgentCreationForm from '../components/agents/AgentCreationForm';
import { useNotification } from '../hooks/useNotification';
import { PROTECTED_ROUTES } from '../constants/routes';
import { Agent } from '../types/agent.types';
import { ApiError } from '../types/api.types';
import { AGENT_ERRORS } from '../constants/errorMessages';

/**
 * AgentCreationPage component that provides the interface for creating new AI agents
 * Implements Material Design 3.0 guidelines with comprehensive error handling and analytics
 */
const AgentCreationPage: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track page view
  useEffect(() => {
    analytics.page('Agent Creation', {
      path: PROTECTED_ROUTES.AGENT_CREATION,
      title: 'Create New Agent'
    });
  }, []);

  // Debounced analytics tracking for form interactions
  const trackFormInteraction = useCallback(
    debounce((action: string, metadata: Record<string, unknown>) => {
      analytics.track(`Agent Form ${action}`, {
        ...metadata,
        timestamp: new Date().toISOString()
      });
    }, 500),
    []
  );

  /**
   * Handles successful agent creation
   */
  const handleCreationSuccess = useCallback((createdAgent: Agent) => {
    showNotification(
      'Agent created successfully',
      'success',
      5000
    );

    // Track successful creation
    analytics.track('Agent Created', {
      agentId: createdAgent.id,
      agentName: createdAgent.name,
      configurationType: createdAgent.config.schedule.type
    });

    // Navigate to agent list
    navigate(PROTECTED_ROUTES.AGENTS);
  }, [navigate, showNotification]);

  /**
   * Handles agent creation errors with detailed error reporting
   */
  const handleCreationError = useCallback((error: ApiError) => {
    const errorMessage = error.message || AGENT_ERRORS.CREATION_FAILED;
    
    showNotification(
      errorMessage,
      'error',
      7000
    );

    // Track error for monitoring
    analytics.track('Agent Creation Failed', {
      error: error.message,
      errorCode: error.code,
      timestamp: new Date().toISOString()
    });

    setIsSubmitting(false);
  }, [showNotification]);

  /**
   * Handles form validation errors
   */
  const handleValidationError = useCallback((errors: Record<string, unknown>) => {
    showNotification(
      'Please check the form for errors',
      'warning',
      5000
    );

    // Track validation failures
    analytics.track('Agent Form Validation Failed', {
      errors,
      timestamp: new Date().toISOString()
    });
  }, [showNotification]);

  return (
    <Layout>
      <PageHeader
        title="Create New Agent"
        subtitle="Configure your AI agent using natural language and advanced settings"
        actions={[
          {
            label: 'Cancel',
            onClick: () => navigate(PROTECTED_ROUTES.AGENTS),
            variant: 'secondary'
          }
        ]}
      />

      <div className="agent-creation-container">
        <AgentCreationForm
          onSuccess={handleCreationSuccess}
          onError={handleCreationError}
          onValidationError={handleValidationError}
          className="agent-creation-form"
        />
      </div>

      <style jsx>{`
        .agent-creation-container {
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
        }

        .agent-creation-form {
          background: var(--color-surface);
          border-radius: var(--border-radius-lg);
          padding: 32px;
          box-shadow: var(--shadow-md);
        }

        @media (max-width: 768px) {
          .agent-creation-container {
            padding: 16px;
          }

          .agent-creation-form {
            padding: 24px;
          }
        }
      `}</style>
    </Layout>
  );
});

// Display name for debugging
AgentCreationPage.displayName = 'AgentCreationPage';

export default AgentCreationPage;