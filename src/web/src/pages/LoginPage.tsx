import React, { useEffect, useCallback } from 'react'; // ^18.2.0
import { useNavigate } from 'react-router-dom'; // ^6.11.0
import { useAnalytics } from '@analytics/react'; // ^0.1.0
import AuthLayout from '../layouts/AuthLayout';
import LoginForm from '../components/auth/LoginForm';
import MFAVerification from '../components/auth/MFAVerification';
import ErrorBoundary from '../components/common/ErrorBoundary';
import { useAuth } from '../hooks/useAuth';

/**
 * Enhanced login page component implementing secure authentication flow
 * with MFA support, comprehensive error handling, and accessibility features
 */
const LoginPage = React.memo(() => {
  // Hooks initialization
  const navigate = useNavigate();
  const { track } = useAnalytics();
  const {
    isAuthenticated,
    isLoading,
    error,
    mfaRequired,
    login,
    verifyMFA,
    updateActivity
  } = useAuth();

  // Redirect authenticated users
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isLoading, navigate]);

  // Track page view for analytics
  useEffect(() => {
    track('page_view', {
      page_name: 'login',
      timestamp: new Date().toISOString()
    });
  }, [track]);

  /**
   * Handles successful login with analytics tracking
   */
  const handleLoginSuccess = useCallback(async () => {
    track('login_success', {
      method: 'password',
      timestamp: new Date().toISOString()
    });
    updateActivity();
    navigate('/dashboard');
  }, [track, updateActivity, navigate]);

  /**
   * Handles MFA requirement with device remember support
   */
  const handleMFARequired = useCallback(async (mfaToken: string, rememberDevice: boolean) => {
    track('mfa_required', {
      timestamp: new Date().toISOString()
    });

    // Set focus to MFA input for accessibility
    setTimeout(() => {
      const mfaInput = document.querySelector('[data-testid="mfa-code-input"]');
      if (mfaInput instanceof HTMLElement) {
        mfaInput.focus();
      }
    }, 100);
  }, [track]);

  /**
   * Handles authentication errors with tracking
   */
  const handleError = useCallback((error: Error) => {
    track('login_error', {
      error_type: error.name,
      error_message: error.message,
      timestamp: new Date().toISOString()
    });
  }, [track]);

  return (
    <ErrorBoundary
      onError={handleError}
      testId="login-page-error-boundary"
    >
      <AuthLayout>
        {mfaRequired ? (
          <MFAVerification
            onSuccess={handleLoginSuccess}
            onError={handleError}
            maxAttempts={5}
          />
        ) : (
          <LoginForm
            onSuccess={handleLoginSuccess}
            onMFARequired={handleMFARequired}
            onError={handleError}
          />
        )}

        {/* Accessibility announcements */}
        <div 
          className="visually-hidden" 
          role="status" 
          aria-live="polite"
        >
          {isLoading ? 'Authenticating...' : ''}
          {error ? `Authentication error: ${error.message}` : ''}
        </div>
      </AuthLayout>
    </ErrorBoundary>
  );
});

// Display name for debugging
LoginPage.displayName = 'LoginPage';

export default LoginPage;