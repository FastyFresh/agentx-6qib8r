import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider, useMediaQuery } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';
import { trackRouteTransition } from '@sentry/react';

import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import { useAuth } from './hooks/useAuth';
import { PROTECTED_ROUTES, PUBLIC_ROUTES, ROUTE_PERMISSIONS } from './constants/routes';
import { createAppTheme } from './config/theme.config';
import { store } from './store';

// Route transition tracking configuration
const routeTransitionOptions = {
  maxTransactionDuration: 5000,
  beforeNavigate: (context: any) => {
    return {
      ...context,
      tags: {
        'routing.path': context.location.pathname,
      },
    };
  },
};

/**
 * Protected route wrapper component with role-based access control
 */
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: string[];
}> = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div aria-busy="true">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={PUBLIC_ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && (!user?.role || !allowedRoles.includes(user.role))) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

/**
 * Root application component that handles routing, authentication,
 * and theme management following Material Design 3.0 specifications
 */
const App: React.FC = () => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  
  // Create theme based on system preferences
  const theme = React.useMemo(
    () => createAppTheme(
      prefersDarkMode ? 'dark' : 'light',
      prefersDarkMode,
      prefersReducedMotion
    ),
    [prefersDarkMode, prefersReducedMotion]
  );

  // Track route transitions for performance monitoring
  useEffect(() => {
    trackRouteTransition(routeTransitionOptions);
  }, []);

  return (
    <ErrorBoundary
      fallback={
        <div role="alert">
          <h2>Application Error</h2>
          <p>An unexpected error occurred. Please refresh the page.</p>
        </div>
      }
    >
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route element={<AuthLayout />}>
                <Route path={PUBLIC_ROUTES.LOGIN} element={<LoginForm />} />
                <Route path={PUBLIC_ROUTES.ERROR} element={<ErrorPage />} />
                <Route path={PUBLIC_ROUTES.NOT_FOUND} element={<NotFoundPage />} />
              </Route>

              {/* Protected Routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route path={PROTECTED_ROUTES.DASHBOARD} element={<Dashboard />} />
                
                <Route
                  path={PROTECTED_ROUTES.AGENTS}
                  element={
                    <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.AGENT_CREATION}>
                      <AgentsPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path={PROTECTED_ROUTES.ANALYTICS}
                  element={
                    <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.ANALYTICS}>
                      <AnalyticsPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path={PROTECTED_ROUTES.INTEGRATIONS}
                  element={
                    <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.INTEGRATIONS}>
                      <IntegrationsPage />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path={PROTECTED_ROUTES.SETTINGS}
                  element={
                    <ProtectedRoute allowedRoles={ROUTE_PERMISSIONS.SETTINGS}>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Fallback route */}
              <Route path="*" element={<Navigate to={PUBLIC_ROUTES.NOT_FOUND} replace />} />
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </Provider>
    </ErrorBoundary>
  );
};

export default App;