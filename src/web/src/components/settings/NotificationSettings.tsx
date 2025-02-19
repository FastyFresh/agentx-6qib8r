import React, { useCallback, useEffect, useState, memo } from 'react'; // ^18.2.0
import { 
  Box, 
  Card, 
  CardContent, 
  FormControlLabel, 
  Switch, 
  Select, 
  MenuItem, 
  Typography, 
  Divider, 
  Alert,
  TextField,
  Button,
  CircularProgress
} from '@mui/material'; // ^5.14.0
import { FormField } from '../common/FormField';
import { useNotification } from '../../hooks/useNotification';
import { notificationService } from '../../services/notificationService';
import { Severity } from '../../types/common.types';

interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  notificationFrequency: string;
  systemAlerts: boolean;
  integrationAlerts: boolean;
  priorityLevel: string;
  notificationSound: string;
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  customCategories: string[];
}

const defaultPreferences: NotificationPreferences = {
  emailNotifications: true,
  pushNotifications: true,
  notificationFrequency: 'realtime',
  systemAlerts: true,
  integrationAlerts: true,
  priorityLevel: 'medium',
  notificationSound: 'default',
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00'
  },
  customCategories: []
};

const NotificationSettings: React.FC = memo(() => {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { showNotification } = useNotification();

  // Load saved preferences
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setIsLoading(true);
        const savedPreferences = await notificationService.getNotifications();
        setPreferences(savedPreferences || defaultPreferences);
        setError(null);
      } catch (err) {
        setError('Failed to load notification preferences');
        showNotification('Error loading preferences', Severity.ERROR);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [showNotification]);

  // Handle preference changes with debouncing
  const handlePreferenceChange = useCallback(async (
    key: keyof NotificationPreferences,
    value: any
  ) => {
    try {
      setIsSaving(true);
      setPreferences(prev => ({
        ...prev,
        [key]: value
      }));

      // Save to local storage for offline support
      localStorage.setItem('notificationPreferences', JSON.stringify({
        ...preferences,
        [key]: value
      }));

      // Sync with backend
      await notificationService.updatePreferences({
        [key]: value
      });

      showNotification('Preferences updated successfully', Severity.SUCCESS);
    } catch (err) {
      setError('Failed to save preferences');
      showNotification('Error saving preferences', Severity.ERROR);
    } finally {
      setIsSaving(false);
    }
  }, [preferences, showNotification]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h5" component="h2" gutterBottom>
          Notification Settings
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Delivery Methods
          </Typography>
          <FormField label="Email Notifications">
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.emailNotifications}
                  onChange={(e) => handlePreferenceChange('emailNotifications', e.target.checked)}
                  disabled={isSaving}
                />
              }
              label="Receive notifications via email"
            />
          </FormField>

          <FormField label="Push Notifications">
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.pushNotifications}
                  onChange={(e) => handlePreferenceChange('pushNotifications', e.target.checked)}
                  disabled={isSaving}
                />
              }
              label="Receive browser push notifications"
            />
          </FormField>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Notification Types
          </Typography>
          <FormField label="System Alerts">
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.systemAlerts}
                  onChange={(e) => handlePreferenceChange('systemAlerts', e.target.checked)}
                  disabled={isSaving}
                />
              }
              label="System status and maintenance alerts"
            />
          </FormField>

          <FormField label="Integration Alerts">
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.integrationAlerts}
                  onChange={(e) => handlePreferenceChange('integrationAlerts', e.target.checked)}
                  disabled={isSaving}
                />
              }
              label="Integration status and error notifications"
            />
          </FormField>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Preferences
          </Typography>
          <FormField label="Notification Frequency">
            <Select
              value={preferences.notificationFrequency}
              onChange={(e) => handlePreferenceChange('notificationFrequency', e.target.value)}
              disabled={isSaving}
              fullWidth
            >
              <MenuItem value="realtime">Real-time</MenuItem>
              <MenuItem value="hourly">Hourly Digest</MenuItem>
              <MenuItem value="daily">Daily Digest</MenuItem>
            </Select>
          </FormField>

          <FormField label="Priority Level">
            <Select
              value={preferences.priorityLevel}
              onChange={(e) => handlePreferenceChange('priorityLevel', e.target.value)}
              disabled={isSaving}
              fullWidth
            >
              <MenuItem value="high">High - All notifications</MenuItem>
              <MenuItem value="medium">Medium - Important updates only</MenuItem>
              <MenuItem value="low">Low - Critical alerts only</MenuItem>
            </Select>
          </FormField>

          <FormField label="Notification Sound">
            <Select
              value={preferences.notificationSound}
              onChange={(e) => handlePreferenceChange('notificationSound', e.target.value)}
              disabled={isSaving}
              fullWidth
            >
              <MenuItem value="default">Default</MenuItem>
              <MenuItem value="chime">Chime</MenuItem>
              <MenuItem value="bell">Bell</MenuItem>
              <MenuItem value="none">None</MenuItem>
            </Select>
          </FormField>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Quiet Hours
          </Typography>
          <FormField label="Enable Quiet Hours">
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.quietHours.enabled}
                  onChange={(e) => handlePreferenceChange('quietHours', {
                    ...preferences.quietHours,
                    enabled: e.target.checked
                  })}
                  disabled={isSaving}
                />
              }
              label="Mute notifications during specified hours"
            />
          </FormField>

          {preferences.quietHours.enabled && (
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <FormField label="Start Time">
                <TextField
                  type="time"
                  value={preferences.quietHours.start}
                  onChange={(e) => handlePreferenceChange('quietHours', {
                    ...preferences.quietHours,
                    start: e.target.value
                  })}
                  disabled={isSaving}
                  fullWidth
                />
              </FormField>

              <FormField label="End Time">
                <TextField
                  type="time"
                  value={preferences.quietHours.end}
                  onChange={(e) => handlePreferenceChange('quietHours', {
                    ...preferences.quietHours,
                    end: e.target.value
                  })}
                  disabled={isSaving}
                  fullWidth
                />
              </FormField>
            </Box>
          )}
        </Box>

        {isSaving && (
          <Box display="flex" justifyContent="center" mt={2}>
            <CircularProgress size={24} />
          </Box>
        )}
      </CardContent>
    </Card>
  );
});

NotificationSettings.displayName = 'NotificationSettings';

export default NotificationSettings;