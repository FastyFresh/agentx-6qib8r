import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

import Layout from '../components/layout/Layout';
import Button from '../components/common/Button';
import { trackError } from '../services/notificationService';
import { track404 } from '../services/analyticsService';

/**
 * NotFoundPage component that implements Material Design 3.0 specifications
 * Provides user-friendly 404 error page with proper error tracking and analytics
 */
const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Track 404 error occurrence with context
  useEffect(() => {
    const errorContext = {
      path: location.pathname,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };

    // Track error in notification service
    trackError({
      code: '404',
      message: `Page not found: ${location.pathname}`,
      details: errorContext
    });

    // Track in analytics
    track404({
      path: location.pathname,
      context: errorContext
    });
  }, [location.pathname]);

  // Handler for navigation back to dashboard
  const handleNavigateHome = () => {
    navigate('/');
  };

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <div role="alert">
          <h1>Error</h1>
          <p>{error.message}</p>
        </div>
      )}
    >
      <Layout
        role="main"
        aria-label="404 Not Found Page"
        className="not-found-page"
      >
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-primary">
            404
          </h1>
          <h2 className="text-2xl md:text-3xl font-medium mb-6 text-text-primary">
            Page Not Found
          </h2>
          <p className="text-lg md:text-xl text-text-secondary mb-8 max-w-md">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <Button
            variant="primary"
            onClick={handleNavigateHome}
            ariaLabel="Return to dashboard"
            className="min-w-[200px]"
          >
            Return to Dashboard
          </Button>
        </div>
      </Layout>
    </ErrorBoundary>
  );
};

// Display name for React DevTools
NotFoundPage.displayName = 'NotFoundPage';

export default NotFoundPage;