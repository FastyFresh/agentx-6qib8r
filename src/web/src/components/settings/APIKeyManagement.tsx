import React, { useCallback, useState, useEffect } from 'react';
import { Alert, CircularProgress, Snackbar } from '@mui/material';
import dayjs from 'dayjs';
import Button from '../common/Button';
import { authService } from '../../services/authService';
import { Size } from '../../types/common.types';

// API Key interface with enhanced security metadata
interface APIKey {
  id: string;
  key: string;
  createdAt: Date;
  lastUsed: Date | null;
  expiresAt: Date;
  rotationWarningDate: Date;
  usageCount: number;
  lastIpAddress: string;
  securityScore: number;
  isCompromised: boolean;
}

// Component state interface
interface APIKeyState {
  keys: APIKey[];
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
  keyGenerationQuota: number;
  showNewKey: boolean;
  newKeyData: APIKey | null;
}

/**
 * APIKeyManagement Component
 * Provides secure management of API keys with enhanced monitoring and security features
 * @version 1.0.0
 */
const APIKeyManagement: React.FC = () => {
  // Initialize state with security-focused defaults
  const [state, setState] = useState<APIKeyState>({
    keys: [],
    isLoading: true,
    error: null,
    successMessage: null,
    keyGenerationQuota: 5,
    showNewKey: false,
    newKeyData: null
  });

  // Fetch API keys with security validation
  const fetchAPIKeys = useCallback(async () => {
    try {
      const token = authService.getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/v1/api-keys', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-API-Version': '1.0',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json();
      setState(prev => ({
        ...prev,
        keys: data.keys,
        isLoading: false,
        keyGenerationQuota: data.quota
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      }));
    }
  }, []);

  // Generate new API key with enhanced security
  const generateNewKey = useCallback(async () => {
    try {
      const token = authService.getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-API-Version': '1.0',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expirationDays: 90, // 90-day expiration
          rotationWarningDays: 75 // Warning at 75 days
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate API key');
      }

      const newKey = await response.json();
      setState(prev => ({
        ...prev,
        isLoading: false,
        showNewKey: true,
        newKeyData: newKey,
        successMessage: 'New API key generated successfully',
        keyGenerationQuota: prev.keyGenerationQuota - 1
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      }));
    }
  }, []);

  // Revoke API key with security logging
  const revokeKey = useCallback(async (keyId: string) => {
    try {
      const token = authService.getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch(`/api/v1/api-keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-API-Version': '1.0',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to revoke API key');
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        keys: prev.keys.filter(key => key.id !== keyId),
        successMessage: 'API key revoked successfully'
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'An error occurred'
      }));
    }
  }, []);

  // Initialize component and fetch keys
  useEffect(() => {
    fetchAPIKeys();
  }, [fetchAPIKeys]);

  // Render API key management interface
  return (
    <div className="api-key-management">
      <h2>API Key Management</h2>
      
      {/* Security Status Banner */}
      {state.keys.some(key => key.isCompromised) && (
        <Alert severity="error" className="security-alert">
          Security Alert: One or more API keys may be compromised
        </Alert>
      )}

      {/* Key Generation Controls */}
      <div className="key-controls">
        <Button
          variant="primary"
          size={Size.MEDIUM}
          onClick={generateNewKey}
          disabled={state.isLoading || state.keyGenerationQuota <= 0}
        >
          Generate New API Key
        </Button>
        <span className="quota-info">
          Remaining quota: {state.keyGenerationQuota}
        </span>
      </div>

      {/* Loading State */}
      {state.isLoading && (
        <div className="loading-container">
          <CircularProgress size={24} />
        </div>
      )}

      {/* API Keys List */}
      <div className="keys-list">
        {state.keys.map(key => (
          <div key={key.id} className="key-item">
            <div className="key-info">
              <div className="key-header">
                <span className="key-id">ID: {key.id}</span>
                {key.isCompromised && (
                  <span className="compromise-warning">COMPROMISED</span>
                )}
              </div>
              
              <div className="key-details">
                <p>Created: {dayjs(key.createdAt).format('YYYY-MM-DD HH:mm:ss')}</p>
                <p>Expires: {dayjs(key.expiresAt).format('YYYY-MM-DD HH:mm:ss')}</p>
                <p>Last Used: {key.lastUsed ? 
                  dayjs(key.lastUsed).format('YYYY-MM-DD HH:mm:ss') : 'Never'}</p>
                <p>Usage Count: {key.usageCount}</p>
                <p>Security Score: {key.securityScore}/100</p>
              </div>

              {/* Expiration Warning */}
              {dayjs().isAfter(key.rotationWarningDate) && (
                <Alert severity="warning" className="rotation-warning">
                  Key rotation recommended
                </Alert>
              )}
            </div>

            <Button
              variant="secondary"
              size={Size.SMALL}
              onClick={() => revokeKey(key.id)}
              disabled={state.isLoading}
            >
              Revoke Key
            </Button>
          </div>
        ))}
      </div>

      {/* New Key Display Dialog */}
      {state.showNewKey && state.newKeyData && (
        <div className="new-key-dialog">
          <Alert severity="info">
            <h3>New API Key Generated</h3>
            <p className="key-value">{state.newKeyData.key}</p>
            <p className="key-warning">
              Copy this key now. For security reasons, it won't be shown again.
            </p>
          </Alert>
          <Button
            variant="primary"
            size={Size.SMALL}
            onClick={() => setState(prev => ({ ...prev, showNewKey: false, newKeyData: null }))}
          >
            Close
          </Button>
        </div>
      )}

      {/* Feedback Messages */}
      <Snackbar
        open={!!state.error}
        autoHideDuration={6000}
        onClose={() => setState(prev => ({ ...prev, error: null }))}
      >
        <Alert severity="error">{state.error}</Alert>
      </Snackbar>

      <Snackbar
        open={!!state.successMessage}
        autoHideDuration={6000}
        onClose={() => setState(prev => ({ ...prev, successMessage: null }))}
      >
        <Alert severity="success">{state.successMessage}</Alert>
      </Snackbar>
    </div>
  );
};

export default APIKeyManagement;