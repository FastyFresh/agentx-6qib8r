import React, { useState, useCallback } from 'react'; // ^18.2.0
import { useNavigate } from 'react-router-dom'; // ^6.11.2
import analytics from '@segment/analytics-next'; // ^1.51.0
import Button from '../common/Button';
import { useAgent } from '../../hooks/useAgent';
import { Size } from '../../types/common.types';
import styles from './QuickActions.module.css';

/**
 * Props interface for QuickActions component
 */
interface QuickActionsProps {
  className?: string;
  testId?: string;
  theme?: 'light' | 'dark' | 'system';
}

/**
 * QuickActions Component
 * Provides rapid access to primary system actions with Material Design 3.0 specifications
 */
const QuickActions: React.FC<QuickActionsProps> = React.memo(({
  className = '',
  testId = 'quick-actions',
  theme = 'system'
}) => {
  const navigate = useNavigate();
  const { createAgent, importConfig } = useAgent();
  const [isNewAgentLoading, setNewAgentLoading] = useState(false);
  const [isImportLoading, setImportLoading] = useState(false);

  /**
   * Handles navigation to agent creation with analytics tracking
   */
  const handleNewAgent = useCallback(async () => {
    try {
      setNewAgentLoading(true);
      
      // Track analytics event
      analytics.track('quick_action_new_agent', {
        source: 'dashboard',
        timestamp: new Date().toISOString()
      });

      navigate('/agents/create');
    } catch (error) {
      console.error('Failed to navigate to agent creation:', error);
    } finally {
      setNewAgentLoading(false);
    }
  }, [navigate]);

  /**
   * Handles the import of existing agent configurations
   */
  const handleImportConfig = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setImportLoading(true);
      const file = event.target.files?.[0];
      
      if (!file) {
        throw new Error('No file selected');
      }

      // Validate file type
      if (!file.name.endsWith('.json')) {
        throw new Error('Invalid file type. Please select a JSON file.');
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File size exceeds 5MB limit.');
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const config = JSON.parse(e.target?.result as string);
          await importConfig(config);
          
          // Track successful import
          analytics.track('quick_action_import_success', {
            source: 'dashboard',
            fileSize: file.size,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error('Failed to parse or import configuration:', error);
          throw error;
        }
      };

      reader.readAsText(file);
    } catch (error) {
      console.error('Import configuration failed:', error);
      // Track import failure
      analytics.track('quick_action_import_error', {
        source: 'dashboard',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    } finally {
      setImportLoading(false);
    }
  }, [importConfig]);

  return (
    <section 
      className={`${styles.quickActions} ${className}`}
      data-testid={testId}
      role="region"
      aria-label="Quick Actions"
    >
      <div className={styles.actionsGrid}>
        <Button
          variant="primary"
          size={Size.MEDIUM}
          onClick={handleNewAgent}
          loading={isNewAgentLoading}
          ariaLabel="Create new agent"
          theme={theme}
          testId={`${testId}-new-agent`}
        >
          New Agent
        </Button>

        <div className={styles.importWrapper}>
          <input
            type="file"
            id="config-import"
            accept=".json"
            onChange={handleImportConfig}
            className={styles.fileInput}
            disabled={isImportLoading}
            data-testid={`${testId}-import-input`}
          />
          <Button
            variant="secondary"
            size={Size.MEDIUM}
            onClick={() => document.getElementById('config-import')?.click()}
            loading={isImportLoading}
            ariaLabel="Import agent configuration"
            theme={theme}
            testId={`${testId}-import-config`}
          >
            Import Config
          </Button>
        </div>
      </div>
    </section>
  );
});

// Display name for debugging
QuickActions.displayName = 'QuickActions';

export default QuickActions;