import React, { useState, useEffect, useCallback } from 'react'; // ^18.2.0
import { useSnackbar } from 'notistack'; // ^3.0.1
import { useAuth } from '../../hooks/useAuth';
import FormField from '../common/FormField';
import Button from '../common/Button';
import { Size } from '../../types/common.types';

interface SecuritySettingsProps {
  className?: string;
  onSecurityUpdate?: () => void;
}

interface SecurityNotificationPreferences {
  emailAlerts: boolean;
  browserNotifications: boolean;
  securityEvents: boolean;
  loginAttempts: boolean;
}

interface SecurityState {
  mfaEnabled: boolean;
  apiKeyVisible: boolean;
  sessionTimeout: number;
  lastPasswordChange: Date;
  failedLoginAttempts: number;
  securityQuestions: boolean;
  deviceManagement: boolean;
  notificationPreferences: SecurityNotificationPreferences;
}

const SecuritySettings: React.FC<SecuritySettingsProps> = ({
  className,
  onSecurityUpdate
}) => {
  const { user, verifyMFA } = useAuth();
  const { enqueueSnackbar } = useSnackbar();

  // Initialize security state
  const [securityState, setSecurityState] = useState<SecurityState>({
    mfaEnabled: user?.mfaEnabled || false,
    apiKeyVisible: false,
    sessionTimeout: 30,
    lastPasswordChange: new Date(),
    failedLoginAttempts: 0,
    securityQuestions: false,
    deviceManagement: true,
    notificationPreferences: {
      emailAlerts: true,
      browserNotifications: true,
      securityEvents: true,
      loginAttempts: true
    }
  });

  // Track loading states for async operations
  const [isLoading, setIsLoading] = useState<{
    mfa: boolean;
    apiKey: boolean;
    session: boolean;
  }>({
    mfa: false,
    apiKey: false,
    session: false
  });

  // Handle MFA toggle with enhanced security checks
  const handleMFAToggle = useCallback(async () => {
    try {
      setIsLoading(prev => ({ ...prev, mfa: true }));

      if (!securityState.mfaEnabled) {
        // Generate and verify MFA setup
        const verificationResult = await verifyMFA({
          code: '',
          mfaToken: '',
          rememberDevice: false
        });

        if (verificationResult) {
          setSecurityState(prev => ({
            ...prev,
            mfaEnabled: true
          }));
          enqueueSnackbar('Two-factor authentication enabled successfully', {
            variant: 'success'
          });
        }
      } else {
        // Require additional verification before disabling MFA
        const confirmDisable = window.confirm(
          'Disabling two-factor authentication will reduce account security. Are you sure?'
        );

        if (confirmDisable) {
          setSecurityState(prev => ({
            ...prev,
            mfaEnabled: false
          }));
          enqueueSnackbar('Two-factor authentication disabled', {
            variant: 'warning'
          });
        }
      }
    } catch (error) {
      enqueueSnackbar('Failed to update MFA settings', { variant: 'error' });
    } finally {
      setIsLoading(prev => ({ ...prev, mfa: false }));
    }
  }, [securityState.mfaEnabled, verifyMFA, enqueueSnackbar]);

  // Handle API key rotation with security confirmations
  const handleAPIKeyRotation = useCallback(async () => {
    try {
      setIsLoading(prev => ({ ...prev, apiKey: true }));

      // Security confirmation dialog
      const confirmRotation = window.confirm(
        'Rotating the API key will invalidate the existing key. Are you sure?'
      );

      if (confirmRotation) {
        // Simulate API key rotation
        const newKey = 'new-api-key-' + Date.now();
        
        setSecurityState(prev => ({
          ...prev,
          apiKeyVisible: true
        }));

        // Auto-hide API key after 30 seconds
        setTimeout(() => {
          setSecurityState(prev => ({
            ...prev,
            apiKeyVisible: false
          }));
        }, 30000);

        enqueueSnackbar('API key rotated successfully. Key will be hidden in 30 seconds', {
          variant: 'success'
        });
      }
    } catch (error) {
      enqueueSnackbar('Failed to rotate API key', { variant: 'error' });
    } finally {
      setIsLoading(prev => ({ ...prev, apiKey: false }));
    }
  }, [enqueueSnackbar]);

  // Handle session timeout updates
  const handleSessionTimeoutChange = useCallback(async (duration: number) => {
    try {
      setIsLoading(prev => ({ ...prev, session: true }));

      // Validate timeout duration
      if (duration < 5 || duration > 120) {
        throw new Error('Session timeout must be between 5 and 120 minutes');
      }

      setSecurityState(prev => ({
        ...prev,
        sessionTimeout: duration
      }));

      enqueueSnackbar('Session timeout updated successfully', {
        variant: 'success'
      });
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : 'Failed to update session timeout', {
        variant: 'error'
      });
    } finally {
      setIsLoading(prev => ({ ...prev, session: false }));
    }
  }, [enqueueSnackbar]);

  // Update notification preferences
  const handleNotificationPreferenceChange = useCallback((
    key: keyof SecurityNotificationPreferences,
    value: boolean
  ) => {
    setSecurityState(prev => ({
      ...prev,
      notificationPreferences: {
        ...prev.notificationPreferences,
        [key]: value
      }
    }));
  }, []);

  // Notify parent component of security updates
  useEffect(() => {
    onSecurityUpdate?.();
  }, [securityState, onSecurityUpdate]);

  return (
    <div className={className} data-testid="security-settings">
      {/* MFA Configuration Section */}
      <section className="security-section">
        <h2>Two-Factor Authentication</h2>
        <FormField
          label="Enable Two-Factor Authentication"
          helperText="Enhance your account security with 2FA verification"
          size={Size.MEDIUM}
        >
          <div className="mfa-controls">
            <Button
              variant={securityState.mfaEnabled ? 'secondary' : 'primary'}
              onClick={handleMFAToggle}
              loading={isLoading.mfa}
              disabled={isLoading.mfa}
              ariaLabel={`${securityState.mfaEnabled ? 'Disable' : 'Enable'} two-factor authentication`}
            >
              {securityState.mfaEnabled ? 'Disable 2FA' : 'Enable 2FA'}
            </Button>
          </div>
        </FormField>
      </section>

      {/* API Key Management Section */}
      <section className="security-section">
        <h2>API Key Management</h2>
        <FormField
          label="API Key"
          helperText="Securely manage your API key for integrations"
          size={Size.MEDIUM}
        >
          <div className="api-key-controls">
            {securityState.apiKeyVisible && (
              <div className="api-key-display" role="status">
                <code>{'your-api-key-here'}</code>
              </div>
            )}
            <Button
              variant="primary"
              onClick={handleAPIKeyRotation}
              loading={isLoading.apiKey}
              disabled={isLoading.apiKey}
              ariaLabel="Rotate API key"
            >
              Rotate API Key
            </Button>
          </div>
        </FormField>
      </section>

      {/* Session Management Section */}
      <section className="security-section">
        <h2>Session Management</h2>
        <FormField
          label="Session Timeout (minutes)"
          helperText="Set the duration of inactivity before automatic logout"
          size={Size.MEDIUM}
        >
          <input
            type="number"
            min="5"
            max="120"
            value={securityState.sessionTimeout}
            onChange={(e) => handleSessionTimeoutChange(parseInt(e.target.value, 10))}
            disabled={isLoading.session}
          />
        </FormField>
      </section>

      {/* Security Notifications Section */}
      <section className="security-section">
        <h2>Security Notifications</h2>
        <FormField
          label="Notification Preferences"
          helperText="Configure how you want to be notified about security events"
          size={Size.MEDIUM}
        >
          <div className="notification-preferences">
            {Object.entries(securityState.notificationPreferences).map(([key, value]) => (
              <label key={key} className="notification-option">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => handleNotificationPreferenceChange(
                    key as keyof SecurityNotificationPreferences,
                    e.target.checked
                  )}
                />
                {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </label>
            ))}
          </div>
        </FormField>
      </section>
    </div>
  );
};

SecuritySettings.displayName = 'SecuritySettings';

export default SecuritySettings;