import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Sentry from '@sentry/browser'; // ^7.0.0
import Layout from '../components/layout/Layout';
import Button from '../components/common/Button';
import { PUBLIC_ROUTES } from '../constants/routes';
import styles from './ErrorPage.module.css';

/**
 * Interface for detailed error information
 */
interface ErrorDetails {
  timestamp: Date;
  stack?: string;
  context?: Record<string, unknown>;
}

/**
 * Props interface for the ErrorPage component
 */
interface ErrorPageProps {
  errorCode?: number;
  errorMessage?: string;
  errorDetails?: ErrorDetails;
}

/**
 * Tracks error page views for analytics
 */
const trackErrorPageView = (props: ErrorPageProps): void => {
  Sentry.withScope((scope) => {
    scope.setLevel(Sentry.Severity.Error);
    scope.setExtras({
      errorCode: props.errorCode,
      errorMessage: props.errorMessage,
      timestamp: props.errorDetails?.timestamp,
      context: props.errorDetails?.context
    });
    Sentry.captureMessage('Error page viewed', Sentry.Severity.Error);
  });
};

/**
 * Error page component implementing Material Design 3.0 specifications
 * Provides user-friendly error feedback with resolution options
 */
const ErrorPage: React.FC<ErrorPageProps> = ({
  errorCode = 500,
  errorMessage = 'An unexpected error occurred',
  errorDetails
}) => {
  const navigate = useNavigate();

  // Track error page view on mount
  useEffect(() => {
    trackErrorPageView({ errorCode, errorMessage, errorDetails });
  }, [errorCode, errorMessage, errorDetails]);

  // Handle navigation back to login
  const handleNavigateHome = useCallback(() => {
    Sentry.addBreadcrumb({
      category: 'navigation',
      message: 'User navigated from error page to login',
      level: Sentry.Severity.Info
    });
    navigate(PUBLIC_ROUTES.LOGIN);
  }, [navigate]);

  return (
    <Layout>
      <div 
        className={styles.errorContainer}
        role="alert"
        aria-live="polite"
      >
        <div className={styles.errorContent}>
          {/* Error Code */}
          <h1 
            className={styles.errorCode}
            aria-label={`Error ${errorCode}`}
          >
            {errorCode}
          </h1>

          {/* Error Message */}
          <h2 className={styles.errorMessage}>
            {errorMessage}
          </h2>

          {/* Error Details - Only shown in development */}
          {process.env.NODE_ENV === 'development' && errorDetails?.stack && (
            <pre 
              className={styles.errorStack}
              aria-label="Error stack trace"
            >
              {errorDetails.stack}
            </pre>
          )}

          {/* Action Buttons */}
          <div className={styles.actionButtons}>
            <Button
              variant="primary"
              onClick={handleNavigateHome}
              ariaLabel="Return to login page"
              testId="error-page-home-button"
            >
              Return to Login
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.location.reload()}
              ariaLabel="Reload the page"
              testId="error-page-reload-button"
            >
              Reload Page
            </Button>
          </div>

          {/* Support Information */}
          <p className={styles.supportInfo}>
            If the problem persists, please contact{' '}
            <a 
              href="mailto:support@agentai.com"
              className={styles.supportLink}
              aria-label="Contact support via email"
            >
              support@agentai.com
            </a>
          </p>
        </div>
      </div>
    </Layout>
  );
};

// Default props
ErrorPage.defaultProps = {
  errorCode: 500,
  errorMessage: 'An unexpected error occurred'
};

export default ErrorPage;