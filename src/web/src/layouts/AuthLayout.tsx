import React, { useState, useEffect } from 'react'; // ^18.2.0
import { useNavigate, Navigate } from 'react-router-dom'; // ^6.11.0
import { styled } from '@mui/material/styles'; // ^5.12.0
import LoginForm from '../components/auth/LoginForm';
import MFAVerification from '../components/auth/MFAVerification';
import { useAuth } from '../hooks/useAuth';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Styled components for layout structure
const AuthContainer = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: theme.spacing(3),
  backgroundColor: theme.palette.background.default,
}));

const AuthCard = styled('div')(({ theme }) => ({
  width: '100%',
  maxWidth: '440px',
  padding: theme.spacing(4),
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[3],
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3),
    maxWidth: '100%',
  },
}));

const AuthLogo = styled('img')({
  width: 'auto',
  height: '48px',
  marginBottom: '2rem',
});

// Props interface for AuthLayout
interface AuthLayoutProps {
  children?: React.ReactNode;
  className?: string;
}

/**
 * Authentication Layout Component
 * Provides structure for authentication pages with MFA support and accessibility features
 */
const AuthLayout: React.FC<AuthLayoutProps> = ({ children, className }) => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  
  // MFA state management
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [showMFA, setShowMFA] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isLoading, navigate]);

  /**
   * Handles successful login by redirecting to dashboard
   */
  const handleLoginSuccess = () => {
    setError(null);
    setShowMFA(false);
    setMfaToken(null);
    navigate('/dashboard');
  };

  /**
   * Handles MFA requirement by showing verification component
   */
  const handleMFARequired = (token: string) => {
    setMfaToken(token);
    setShowMFA(true);
    setError(null);
  };

  /**
   * Handles authentication errors with user feedback
   */
  const handleAuthError = (error: Error) => {
    setError(error);
    setShowMFA(false);
    setMfaToken(null);
  };

  // Redirect if already authenticated
  if (isAuthenticated && !isLoading) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <ErrorBoundary>
      <AuthContainer className={className}>
        <AuthCard>
          <AuthLogo
            src="/logo.svg"
            alt="AGENT AI Platform"
            aria-label="Company logo"
          />
          
          {showMFA && mfaToken ? (
            <MFAVerification
              mfaToken={mfaToken}
              onSuccess={handleLoginSuccess}
              onError={handleAuthError}
              maxAttempts={5}
            />
          ) : (
            <LoginForm
              onSuccess={handleLoginSuccess}
              onMFARequired={handleMFARequired}
              onError={handleAuthError}
            />
          )}

          {error && (
            <div
              role="alert"
              aria-live="polite"
              style={{
                color: 'error.main',
                marginTop: '1rem',
                textAlign: 'center',
              }}
            >
              {error.message}
            </div>
          )}

          {children}
        </AuthCard>

        {/* Accessibility features */}
        <div aria-live="polite" className="visually-hidden">
          {isLoading ? 'Loading authentication system...' : ''}
        </div>
      </AuthContainer>
    </ErrorBoundary>
  );
};

// Display name for debugging
AuthLayout.displayName = 'AuthLayout';

export default AuthLayout;