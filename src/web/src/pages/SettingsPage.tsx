import React, { useState, useCallback, useEffect } from 'react';
import { useSnackbar } from 'notistack';
import { useAuth } from '../hooks/useAuth';
import { useRBAC } from '@auth/rbac';
import DashboardLayout from '../layouts/DashboardLayout';
import ProfileSettings from '../components/settings/ProfileSettings';
import SecuritySettings from '../components/settings/SecuritySettings';
import NotificationSettings from '../components/settings/NotificationSettings';
import APIKeyManagement from '../components/settings/APIKeyManagement';
import { Card } from '../components/common/Card';
import { Size, Severity } from '../types/common.types';
import { UserRole } from '../types/auth.types';

// Interface for settings tab state management
interface SettingsTab {
  id: 'profile' | 'security' | 'notifications' | 'api-keys';
  label: string;
  requiredRole: UserRole[];
  loading: boolean;
  error: string | null;
}

const SettingsPage: React.FC = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { hasPermission } = useRBAC();
  const { enqueueSnackbar } = useSnackbar();

  // Initialize settings tabs with role-based access control
  const [tabs] = useState<SettingsTab[]>([
    {
      id: 'profile',
      label: 'Profile Settings',
      requiredRole: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENT_MANAGER, UserRole.VIEWER],
      loading: false,
      error: null
    },
    {
      id: 'security',
      label: 'Security Settings',
      requiredRole: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
      loading: false,
      error: null
    },
    {
      id: 'notifications',
      label: 'Notification Settings',
      requiredRole: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.AGENT_MANAGER, UserRole.VIEWER],
      loading: false,
      error: null
    },
    {
      id: 'api-keys',
      label: 'API Key Management',
      requiredRole: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
      loading: false,
      error: null
    }
  ]);

  // Active tab state management
  const [activeTab, setActiveTab] = useState<SettingsTab['id']>('profile');

  // Handle settings updates with error handling and notifications
  const handleSettingsUpdate = useCallback(async (
    tab: SettingsTab['id'],
    data: unknown
  ) => {
    const currentTab = tabs.find(t => t.id === tab);
    if (!currentTab) return;

    try {
      // Validate user permissions
      if (!user?.role || !currentTab.requiredRole.includes(user.role)) {
        throw new Error('Insufficient permissions');
      }

      // Update settings based on tab type
      switch (tab) {
        case 'profile':
          await handleProfileUpdate(data);
          break;
        case 'security':
          await handleSecurityUpdate(data);
          break;
        case 'notifications':
          await handleNotificationUpdate(data);
          break;
        case 'api-keys':
          await handleAPIKeyUpdate(data);
          break;
      }

      enqueueSnackbar('Settings updated successfully', { variant: 'success' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update settings';
      enqueueSnackbar(errorMessage, { variant: 'error' });
    }
  }, [tabs, user, enqueueSnackbar]);

  // Tab change handler with unsaved changes check
  const handleTabChange = useCallback((newTab: SettingsTab['id']) => {
    // Add unsaved changes check here if needed
    setActiveTab(newTab);
  }, []);

  // Render tab content based on active tab
  const renderTabContent = useCallback(() => {
    if (authLoading) {
      return <div>Loading settings...</div>;
    }

    switch (activeTab) {
      case 'profile':
        return (
          <ProfileSettings
            onSave={(data) => handleSettingsUpdate('profile', data)}
            initialData={user}
          />
        );
      case 'security':
        return (
          <SecuritySettings
            onMFAChange={(enabled) => handleSettingsUpdate('security', { mfaEnabled: enabled })}
            securityData={user}
          />
        );
      case 'notifications':
        return (
          <NotificationSettings
            onPreferenceChange={(prefs) => handleSettingsUpdate('notifications', prefs)}
            preferences={user?.preferences}
          />
        );
      case 'api-keys':
        return (
          <APIKeyManagement
            onKeyGenerate={() => handleSettingsUpdate('api-keys', { action: 'generate' })}
            onKeyRevoke={(keyId) => handleSettingsUpdate('api-keys', { action: 'revoke', keyId })}
          />
        );
      default:
        return null;
    }
  }, [activeTab, authLoading, user, handleSettingsUpdate]);

  return (
    <DashboardLayout>
      <div className="settings-page">
        <h1 className="settings-page__title">Settings</h1>
        
        <div className="settings-page__content">
          {/* Settings Navigation */}
          <Card className="settings-page__nav" variant="outlined">
            <nav role="navigation" aria-label="Settings sections">
              {tabs.map(tab => {
                const isAccessible = user?.role && tab.requiredRole.includes(user.role);
                
                return (
                  <button
                    key={tab.id}
                    className={`settings-page__nav-item ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => handleTabChange(tab.id)}
                    disabled={!isAccessible}
                    aria-current={activeTab === tab.id ? 'page' : undefined}
                    aria-disabled={!isAccessible}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </Card>

          {/* Settings Content */}
          <Card 
            className="settings-page__tab-content"
            variant="outlined"
            testId={`settings-${activeTab}-content`}
          >
            {renderTabContent()}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;