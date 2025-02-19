import React, { useState, useEffect, useMemo, useCallback } from 'react'; // ^18.2.0
import { useMediaQuery } from '@mui/material'; // ^5.12.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import { PROTECTED_ROUTES, ROUTE_PERMISSIONS } from '../../constants/routes';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from '../common/Sidebar';
import styles from './Navigation.module.css';

interface NavigationProps {
  className?: string;
  ariaLabel?: string;
  onError?: (error: Error) => void;
}

/**
 * Custom hook for managing responsive navigation state
 * Implements Material Design 3.0 responsive behavior
 */
const useResponsiveNavigation = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isCollapsed, setIsCollapsed] = useState(isMobile);
  const [error, setError] = useState<Error | null>(null);

  // Handle window resize with debouncing
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleResize = () => {
      try {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setIsCollapsed(window.innerWidth <= 768);
        }, 150); // Debounce resize events
      } catch (err) {
        setError(err as Error);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const toggleNavigation = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  return { isCollapsed, toggleNavigation, error };
};

/**
 * Enhanced Navigation component implementing Material Design 3.0
 * Features role-based access control, accessibility, and responsive design
 */
const Navigation: React.FC<NavigationProps> = ({
  className,
  ariaLabel = 'Main navigation',
  onError
}) => {
  const { isCollapsed, toggleNavigation, error } = useResponsiveNavigation();
  const { user, isLoading, error: authError } = useAuth();

  // Handle navigation errors
  useEffect(() => {
    if (error || authError) {
      onError?.(error || authError!);
    }
  }, [error, authError, onError]);

  // Memoized navigation items based on user role
  const navigationItems = useMemo(() => {
    const items = [
      {
        path: PROTECTED_ROUTES.DASHBOARD,
        label: 'Dashboard',
        icon: 'dashboard',
        roles: [],
        analyticsId: 'nav_dashboard'
      },
      {
        path: PROTECTED_ROUTES.AGENTS,
        label: 'Agents',
        icon: 'smart_toy',
        roles: [],
        analyticsId: 'nav_agents'
      },
      {
        path: PROTECTED_ROUTES.ANALYTICS,
        label: 'Analytics',
        icon: 'insights',
        roles: ROUTE_PERMISSIONS.ANALYTICS,
        analyticsId: 'nav_analytics'
      },
      {
        path: PROTECTED_ROUTES.INTEGRATIONS,
        label: 'Integrations',
        icon: 'integration_instructions',
        roles: ROUTE_PERMISSIONS.INTEGRATIONS,
        analyticsId: 'nav_integrations'
      },
      {
        path: PROTECTED_ROUTES.SETTINGS,
        label: 'Settings',
        icon: 'settings',
        roles: ROUTE_PERMISSIONS.SETTINGS,
        analyticsId: 'nav_settings'
      }
    ];

    // Filter items based on user role
    return items.filter(item => {
      if (!item.roles.length) return true;
      return user?.role && item.roles.includes(user.role);
    });
  }, [user?.role]);

  // Error boundary fallback
  const handleErrorFallback = ({ error }: { error: Error }) => (
    <div 
      className={styles.errorContainer} 
      role="alert"
      aria-live="assertive"
    >
      <p>Navigation Error: {error.message}</p>
      <button 
        onClick={() => window.location.reload()}
        className={styles.retryButton}
      >
        Retry
      </button>
    </div>
  );

  return (
    <ErrorBoundary
      FallbackComponent={handleErrorFallback}
      onError={onError}
    >
      <div 
        className={`${styles.navigationWrapper} ${className || ''}`}
        role="navigation"
        aria-label={ariaLabel}
      >
        {isLoading ? (
          <div 
            className={styles.loadingContainer}
            aria-busy="true"
            aria-label="Loading navigation"
          >
            <span className="material-icons">hourglass_empty</span>
            <span>Loading...</span>
          </div>
        ) : (
          <Sidebar
            isCollapsed={isCollapsed}
            onToggle={toggleNavigation}
            ariaLabel={ariaLabel}
            testId="main-navigation"
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(Navigation);