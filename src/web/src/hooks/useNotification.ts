import { useCallback, useEffect } from 'react'; // ^18.2.0
import { notificationService } from '../services/notificationService';
import { Severity } from '../types/common.types';

/**
 * Configuration options for notifications
 */
interface NotificationOptions {
  defaultDuration?: number;
  maxNotifications?: number;
  position?: 'top' | 'bottom' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

/**
 * Type-safe interface for notification hook return value
 */
interface NotificationHookResult {
  showNotification: (message: string, severity?: Severity, duration?: number) => string;
  hideNotification: (id: string) => void;
  clearAllNotifications: () => void;
}

/**
 * Default configuration values
 */
const DEFAULT_OPTIONS: Required<NotificationOptions> = {
  defaultDuration: 5000,
  maxNotifications: 5,
  position: 'top-right'
};

/**
 * Custom hook for managing notifications in React components
 * Provides a simplified interface for displaying, hiding, and managing notifications
 * with automatic cleanup and performance optimization
 * 
 * @param options - Configuration options for notifications
 * @returns Object containing notification management functions
 */
export const useNotification = (options: NotificationOptions = {}): NotificationHookResult => {
  // Merge provided options with defaults
  const config = {
    ...DEFAULT_OPTIONS,
    ...options
  };

  /**
   * Shows a notification with the specified message and severity
   * Returns the notification ID for management purposes
   */
  const showNotification = useCallback((
    message: string,
    severity: Severity = Severity.INFO,
    duration?: number
  ): string => {
    return notificationService.show({
      message,
      severity,
      category: 'general',
      metadata: {
        duration: duration || config.defaultDuration,
        position: config.position,
        timestamp: Date.now()
      }
    });
  }, [config.defaultDuration, config.position]);

  /**
   * Hides a specific notification by ID
   */
  const hideNotification = useCallback((id: string): void => {
    notificationService.hide(id);
  }, []);

  /**
   * Clears all active notifications
   */
  const clearAllNotifications = useCallback((): void => {
    notificationService.clearAll();
  }, []);

  /**
   * Cleanup effect to remove notifications when component unmounts
   */
  useEffect(() => {
    // Ensure notifications are cleaned up on unmount
    return () => {
      clearAllNotifications();
    };
  }, [clearAllNotifications]);

  return {
    showNotification,
    hideNotification,
    clearAllNotifications
  };
};